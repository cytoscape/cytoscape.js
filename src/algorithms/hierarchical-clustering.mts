// Agglomerative hierarchical clustering — a handle-level port of v3's pass
// (threshold and dendrogram modes, min/max/mean/other linkage).

import type { Collection } from '../collection.mjs';
import { namedMetricKind, resolveDistance } from './clustering-distances.mjs';
import type { DistanceMetric } from './clustering-distances.mjs';
import { resolveExecutor, runAlgo } from './executor.mjs';
import type { AlgoExecutor } from './executor.mjs';
import { hierarchicalClusteringGpu } from './algo-gpu-cluster.mjs';

export type HierarchicalAttributeFn = (node: Collection) => number;

export interface HierarchicalClusteringOptions {
  distance?: DistanceMetric;
  /** linkage criterion: 'min' (single), 'max' (complete), 'mean', or per-pair */
  linkage?: string;
  mode?: 'threshold' | 'dendrogram';
  threshold?: number;
  addDendrogram?: boolean;
  dendrogramDepth?: number;
  attributes?: HierarchicalAttributeFn[];
  /** where the run executes; see `AlgoExecutor` (default 'auto') */
  executor?: AlgoExecutor;
}

interface ClusterNode {
  value?: Collection | Collection[];
  key: number | null;
  index: number | null;
  size?: number;
  left?: ClusterNode;
  right?: ClusterNode;
}

export interface ResolvedHcaOptions {
  distance: DistanceMetric;
  linkage: string;
  mode: 'threshold' | 'dendrogram';
  threshold: number;
  addDendrogram: boolean;
  dendrogramDepth: number;
  attributes: HierarchicalAttributeFn[];
}

const linkageAliases: Record<string, string> = {
  single: 'min',
  complete: 'max',
};

/** Resolve the options to their defaults (linkage aliases folded) —
 * shared by the CPU reference and the GPU executor. */
export const resolveHcaOptions = (
  options: HierarchicalClusteringOptions = {},
): ResolvedHcaOptions => {
  const linkage = options.linkage ?? 'min';

  return {
    distance: options.distance ?? 'euclidean',
    linkage: linkageAliases[linkage] ?? linkage,
    mode: options.mode ?? 'threshold',
    threshold: options.threshold ?? Infinity,
    addDendrogram: options.addDendrogram ?? false,
    dendrogramDepth: options.dendrogramDepth ?? 0,
    attributes: options.attributes ?? [],
  };
};

const spawnHandles = (coll: Collection, eles: Collection[]): Collection =>
  coll._spawn(eles.map((ele) => ele._refs[0]));

/**
 * The pair-distance function for one run, with two per-run caches
 * (round 62.2): the metric impl resolved once, and each node's
 * attribute vector computed once — the round-18 algorithms rule (a
 * projection fn is evaluated once per node, not once per pair, which
 * on the N² matrix build turned N²·A data reads into N·A).  Handles
 * are interned singletons, so the vector cache keys on them directly.
 * A custom metric with no attributes keeps its (nodeP, nodeQ) calling
 * convention exactly as `clusteringDistance` defines it.  Exported
 * since round 65: the GPU executor's merge phase still needs it for
 * custom linkage.
 */
export const makeGetDist = (
  opts: ResolvedHcaOptions,
): ((n1: Collection, n2: Collection) => number) => {
  const attrs = opts.attributes;
  const impl = resolveDistance(opts.distance);
  const custom = typeof opts.distance === 'function' && attrs.length === 0;
  const vecs = new Map<Collection, number[]>();
  const vecOf = (n: Collection): number[] => {
    let v = vecs.get(n);

    if (v === undefined) {
      v = attrs.map((f) => f(n));
      vecs.set(n, v);
    }

    return v;
  };
  let vp: number[] = [];
  let vq: number[] = [];
  const getP = (i: number): number => vp[i];
  const getQ = (i: number): number => vq[i];

  return (n1, n2) => {
    if (custom) {
      return impl(n1, n2);
    }

    vp = vecOf(n1);
    vq = vecOf(n2);

    return impl(attrs.length, getP, getQ, n1, n2);
  };
};

const mergeClosest = (
  clusters: ClusterNode[],
  index: ClusterNode[],
  dists: number[][],
  mins: number[],
  opts: ResolvedHcaOptions,
  getDist: (n1: Collection, n2: Collection) => number,
): boolean => {
  let minKey = 0;
  let min = Infinity;

  for (let i = 0; i < clusters.length; i++) {
    const key = clusters[i].key as number;
    const dist = dists[key][mins[key]];

    if (dist < min) {
      minKey = key;
      min = dist;
    }
  }

  if (
    (opts.mode === 'threshold' && min >= opts.threshold) ||
    (opts.mode === 'dendrogram' && clusters.length === 1)
  ) {
    return false;
  }

  const c1 = index[minKey];
  const c2 = index[mins[minKey]];
  let merged: ClusterNode;

  if (opts.mode === 'dendrogram') {
    merged = { left: c1, right: c2, key: c1.key, index: null };
  } else {
    merged = {
      value: (c1.value as Collection[]).concat(c2.value as Collection[]),
      key: c1.key,
      index: null,
    };
  }

  clusters[c1.index as number] = merged;
  clusters.splice(c2.index as number, 1);
  index[c1.key as number] = merged;

  for (let i = 0; i < clusters.length; i++) {
    const cur = clusters[i];
    let dist: number;

    if (c1.key === cur.key) {
      dist = Infinity;
    } else if (opts.linkage === 'min') {
      dist = Math.min(
        dists[c1.key as number][cur.key as number],
        dists[c2.key as number][cur.key as number],
      );
    } else if (opts.linkage === 'max') {
      dist = Math.max(
        dists[c1.key as number][cur.key as number],
        dists[c2.key as number][cur.key as number],
      );
    } else if (opts.linkage === 'mean') {
      dist =
        (dists[c1.key as number][cur.key as number] * (c1.size as number) +
          dists[c2.key as number][cur.key as number] * (c2.size as number)) /
        ((c1.size as number) + (c2.size as number));
    } else if (opts.mode === 'dendrogram') {
      dist = getDist(cur.value as Collection, c1.value as Collection);
    } else {
      dist = getDist(
        (cur.value as Collection[])[0],
        (c1.value as Collection[])[0],
      );
    }

    dists[c1.key as number][cur.key as number] = dist;
    dists[cur.key as number][c1.key as number] = dist; // symmetric
  }

  for (let i = 0; i < clusters.length; i++) {
    const key1 = clusters[i].key as number;

    if (mins[key1] === c1.key || mins[key1] === c2.key) {
      let minK = key1;

      for (let j = 0; j < clusters.length; j++) {
        const key2 = clusters[j].key as number;

        if (dists[key1][key2] < dists[key1][minK]) {
          minK = key2;
        }
      }

      mins[key1] = minK;
    }

    clusters[i].index = i;
  }

  c1.key = c2.key = c1.index = c2.index = null;

  return true;
};

const getAllChildren = (
  root: ClusterNode | undefined,
  arr: Collection[],
): void => {
  if (!root) {
    return;
  }

  if (root.value) {
    arr.push(root.value as Collection);
  } else {
    getAllChildren(root.left, arr);
    getAllChildren(root.right, arr);
  }
};

const buildDendrogram = (
  root: ClusterNode | undefined,
  coll: Collection,
): string => {
  if (!root) {
    return '';
  }

  if (root.left && root.right) {
    const leftStr = buildDendrogram(root.left, coll);
    const rightStr = buildDendrogram(root.right, coll);
    const cy = coll.cy();
    const node = cy.add({
      group: 'nodes',
      data: { id: leftStr + ',' + rightStr },
    });

    cy.add({ group: 'edges', data: { source: leftStr, target: node.id() } });
    cy.add({ group: 'edges', data: { source: rightStr, target: node.id() } });

    return node.id() as string;
  }

  if (root.value) {
    return (root.value as Collection).id() as string;
  }

  return '';
};

const buildClustersFromTree = (
  root: ClusterNode | undefined,
  k: number,
  coll: Collection,
): Collection[] => {
  if (!root) {
    return [];
  }

  const left: Collection[] = [];
  const right: Collection[] = [];

  if (k === 0) {
    // don't cut: all nodes as one cluster
    getAllChildren(root.left, left);
    getAllChildren(root.right, right);

    return [spawnHandles(coll, left.concat(right))];
  }

  if (k === 1) {
    // cut at the root
    if (root.value) {
      return [spawnHandles(coll, [root.value as Collection])];
    }

    getAllChildren(root.left, left);
    getAllChildren(root.right, right);

    return [spawnHandles(coll, left), spawnHandles(coll, right)];
  }

  if (root.value) {
    return [spawnHandles(coll, [root.value as Collection])];
  }

  const leftC = root.left ? buildClustersFromTree(root.left, k - 1, coll) : [];
  const rightC = root.right
    ? buildClustersFromTree(root.right, k - 1, coll)
    : [];

  return leftC.concat(rightC);
};

/**
 * The async hierarchical-clustering entry point behind
 * `eles.hierarchicalClustering()`: validates `executor` synchronously,
 * then routes to the CPU reference implementation or the WGSL
 * distance-matrix kernels (the merge chain itself is
 * inherently sequential and stays on the CPU under every executor).
 *
 * @param coll — the calling collection
 * @param options — as `hierarchicalClustering`, plus `executor`
 * @returns a promise of the clusters
 * @throws if `executor` is not 'cpu', 'gpu' or 'auto'
 */
export const hierarchicalClusteringAsync = (
  coll: Collection,
  options?: HierarchicalClusteringOptions,
): Promise<Collection[]> => {
  const executor = resolveExecutor(options?.executor);
  const n = coll.nodes().length;
  const reason =
    typeof options?.distance === 'function'
      ? 'a custom distance function runs on the CPU — ' +
        "use executor 'cpu' or 'auto'"
      : (options?.attributes ?? []).length === 0
        ? 'the GPU path needs `attributes` to materialize features — ' +
          "use executor 'cpu' or 'auto'"
        : null;

  // 'auto' never routes hierarchical to the GPU since 65.10: the flat
  // merge engine plus the typed-vector matrix build took the CPU to a
  // wash with the GPU at every measured size (0.92–1.03x, amd gcn-4) —
  // the GPU's only edge was the pair-matrix build, and the merge chain
  // was always shared.  The GPU path stays for an explicit
  // `executor: 'gpu'` and the parity suite.
  return runAlgo(
    executor,
    n,
    Infinity,
    () => hierarchicalClustering(coll, options),
    reason == null
      ? (ctx) => hierarchicalClusteringGpu(ctx, coll, options)
      : null,
    reason ?? undefined,
  );
};

/**
 * Agglomerative hierarchical clustering over the calling collection's
 * nodes in attribute space — the adjacency is not consulted.  Starts with
 * one cluster per node and repeatedly merges the closest pair under
 * `linkage` ('min'/'single', 'max'/'complete', 'mean', or a custom
 * per-pair function).  In `threshold` mode merging stops once the closest
 * pair is farther apart than `threshold`, and the surviving clusters are
 * returned flat; in `dendrogram` mode it merges to a single root, which is
 * then cut at `dendrogramDepth`.  Holds a dense N-by-N distance matrix, so
 * cost is quadratic in node count.
 *
 * @param coll — the calling collection; only its nodes are clustered
 * @param options — `distance`, `linkage`, `mode`, `threshold`,
 *   `attributes`, and, for dendrogram mode, `dendrogramDepth` (0 means
 *   don't cut) and `addDendrogram`
 * @returns the clusters; empty when the collection has no nodes
 *
 * Note `addDendrogram` mutates the graph: it adds a node per internal
 * dendrogram node plus two edges joining it to its children, so it is not
 * a read-only query.
 */
export const hierarchicalClustering = (
  coll: Collection,
  options?: HierarchicalClusteringOptions,
): Collection[] => {
  const nodes = coll.nodes();

  if (nodes.length === 0) {
    return [];
  }

  const opts = resolveHcaOptions(options);
  const getDist = makeGetDist(opts);
  const d = opts.attributes.length;

  // named metric over attributes: materialize the vectors once and
  // inline the arithmetic (the 65.8 AP-build treatment — the per-pair
  // closure dominated the n² matrix fill).  Math.pow(x, 2) and x·x
  // round identically, so the entries are bit-identical to getDist's.
  if (typeof opts.distance !== 'function' && d > 0) {
    const n = nodes.length;
    const vecs = new Float64Array(n * d);

    for (let i = 0; i < n; i++) {
      const node = nodes[i];

      for (let k = 0; k < d; k++) {
        vecs[i * d + k] = opts.attributes[k](node);
      }
    }

    const kind0 = namedMetricKind(opts.distance);
    // euclidean over one attribute is |dx| (the reference's shortcut)
    const kind = kind0 === 0 && d === 1 ? 2 : kind0;
    const pairDist = (i: number, j: number): number => {
      const pi = i * d;
      const qi = j * d;
      let acc = kind === 3 ? -Infinity : 0;

      for (let k = 0; k < d; k++) {
        const ad = Math.abs(vecs[pi + k] - vecs[qi + k]);

        if (kind === 2) {
          acc += ad;
        } else if (kind === 3) {
          acc = Math.max(acc, ad);
        } else {
          acc += ad * ad;
        }
      }

      return kind === 0 && d >= 2 ? Math.sqrt(acc) : acc;
    };

    return hierarchicalRun(coll, nodes, opts, getDist, pairDist);
  }

  return hierarchicalRun(coll, nodes, opts, getDist, (i, j) =>
    getDist(nodes[i], nodes[j]),
  );
};

/**
 * The flat merge engine for the named linkages (round 65.10): the
 * distance matrix, min pointers, active-key order and cluster sizes
 * all live in typed arrays, and the merge *structure* is a log of
 * (left, right) tree-node pairs replayed once at the end — the object
 * path allocated per-cluster nodes, `number[][]` rows and concatenated
 * member arrays per merge, and its scans dominated both executors'
 * hierarchical profiles (the GPU pays this phase too).  Semantics are
 * the object path's exactly: the same lower-triangle min seeding, the
 * same first-in-order tie-breaks on the global-min scan, the same
 * stale-min repair rule, and members ordered by in-order traversal of
 * the merge tree (left subtree first), which is what the old
 * per-merge `concat` produced.
 *
 * One deliberate deviation, from a defect this rewrite surfaced:
 * **v3's `mean` linkage never worked** — its `size` field is read in
 * the weighted-average formula but never assigned, in v3 and in the
 * v4 port alike, so the first mean merge wrote NaN distances and NaN
 * comparisons made those rows unpickable ever after (v3 tests only
 * exercise `min`).  Here sizes are tracked (leaves 1, merged sums),
 * so `mean` is the weighted-average linkage its documentation always
 * claimed.
 *
 * @param coll — the calling collection
 * @param nodes — the nodes, in matrix order
 * @param opts — the resolved options (linkage ∈ min | max | mean)
 * @param pairDist — the initial matrix entry for dense pair (i, j)
 * @returns the clusters
 */
const hierarchicalRunFlat = (
  coll: Collection,
  nodes: Collection,
  opts: ResolvedHcaOptions,
  pairDist: (i: number, j: number) => number,
): Collection[] => {
  const n = nodes.length;
  const dist = new Float64Array(n * n);
  const minIdx = new Int32Array(n);
  const sizes = new Int32Array(n).fill(1);
  // active cluster keys, in the object path's array order (a merge
  // keeps the survivor in place and closes the gap left by the other)
  const active = new Int32Array(n);
  let activeCount = n;
  // merge log: tree-node ids (leaf i < n; merge m is node n + m)
  const treeNode = new Int32Array(n);
  const leftChild = new Int32Array(Math.max(0, n - 1));
  const rightChild = new Int32Array(Math.max(0, n - 1));
  let merges = 0;

  for (let i = 0; i < n; i++) {
    active[i] = i;
    treeNode[i] = i;
  }

  // the object path's exact init: symmetric fill, min pointers seeded
  // from the lower triangle only (row 0 starts at its Infinity
  // diagonal — its pairs are found through the higher-indexed rows)
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      const d = i === j ? Infinity : pairDist(i, j);

      dist[i * n + j] = d;
      dist[j * n + i] = d;

      if (d < dist[i * n + minIdx[i]]) {
        minIdx[i] = j;
      }
    }
  }

  const linkage = opts.linkage;

  for (;;) {
    // global min, first-in-order wins on ties (strict <)
    let minKey = active[0] ?? 0;
    let min = Infinity;

    for (let p = 0; p < activeCount; p++) {
      const key = active[p];
      const d = dist[key * n + minIdx[key]];

      if (d < min) {
        minKey = key;
        min = d;
      }
    }

    if (
      (opts.mode === 'threshold' && min >= opts.threshold) ||
      (opts.mode === 'dendrogram' && activeCount === 1)
    ) {
      break;
    }

    const c1 = minKey;
    const c2 = minIdx[minKey];

    // record the merge and take c2 out of the active order
    leftChild[merges] = treeNode[c1];
    rightChild[merges] = treeNode[c2];
    treeNode[c1] = n + merges;
    merges++;

    let at = 0;

    while (active[at] !== c2) {
      at++;
    }

    active.copyWithin(at, at + 1, activeCount);
    activeCount--;

    // linkage update of the survivor's row/column (mean uses the
    // pre-merge sizes, then the survivor absorbs the other's)
    const s1 = sizes[c1];
    const s2 = sizes[c2];

    for (let p = 0; p < activeCount; p++) {
      const cur = active[p];
      let d: number;

      if (cur === c1) {
        d = Infinity;
      } else if (linkage === 'min') {
        d = Math.min(dist[c1 * n + cur], dist[c2 * n + cur]);
      } else if (linkage === 'max') {
        d = Math.max(dist[c1 * n + cur], dist[c2 * n + cur]);
      } else {
        d = (dist[c1 * n + cur] * s1 + dist[c2 * n + cur] * s2) / (s1 + s2);
      }

      dist[c1 * n + cur] = d;
      dist[cur * n + c1] = d;
    }

    sizes[c1] = s1 + s2;

    // repair min pointers that referenced the merged pair (the object
    // path's rule: a linkage value is never below the smaller of the
    // two entries it replaces, so only those pointers can be stale)
    for (let p = 0; p < activeCount; p++) {
      const key1 = active[p];

      if (minIdx[key1] === c1 || minIdx[key1] === c2) {
        let minK = key1;

        for (let q = 0; q < activeCount; q++) {
          const key2 = active[q];

          if (dist[key1 * n + key2] < dist[key1 * n + minK]) {
            minK = key2;
          }
        }

        minIdx[key1] = minK;
      }
    }
  }

  // replay the merge log into the shapes the output builders expect —
  // iteratively, because a single-linkage chain makes the merge tree n
  // deep and recursion would overflow (the tarjan lesson, round 10)
  if (opts.mode === 'dendrogram') {
    // bottom-up: children always have smaller ids than their merge
    const byId: ClusterNode[] = new Array(n + merges);

    for (let i = 0; i < n; i++) {
      byId[i] = { value: nodes[i], key: null, index: null };
    }

    for (let m = 0; m < merges; m++) {
      byId[n + m] = {
        left: byId[leftChild[m]],
        right: byId[rightChild[m]],
        key: null,
        index: null,
      };
    }

    const root = byId[treeNode[active[0]]];
    const retClusters = buildClustersFromTree(root, opts.dendrogramDepth, coll);

    if (opts.addDendrogram) {
      buildDendrogram(root, coll);
    }

    return retClusters;
  }

  // threshold mode: in-order leaves of each surviving root (left
  // subtree first — the member order the old per-merge concat built)
  const out: Collection[] = [];
  const stack: number[] = [];

  for (let p = 0; p < activeCount; p++) {
    const members: Collection[] = [];

    stack.length = 0;
    stack.push(treeNode[active[p]]);

    while (stack.length > 0) {
      const id = stack.pop() as number;

      if (id < n) {
        members.push(nodes[id]);
      } else {
        stack.push(rightChild[id - n], leftChild[id - n]);
      }
    }

    out.push(spawnHandles(coll, members));
  }

  return out;
};

/**
 * The merge machinery both executors share: seed one cluster per node,
 * fill the pair matrix from `pairDist` (the executors differ only
 * here — the CPU evaluates the metric per pair, the GPU hands a
 * read-back matrix lookup), merge until the mode says stop, and build
 * the requested output.  `getDist` is still consulted by the merge
 * phase for custom linkage functions, on the CPU under every executor.
 *
 * @param coll — the calling collection
 * @param nodes — the nodes, in matrix order
 * @param opts — the resolved options
 * @param getDist — the per-pair distance fn (custom-linkage merges)
 * @param pairDist — the initial matrix entry for dense pair (i, j)
 * @returns the clusters
 */
export const hierarchicalRun = (
  coll: Collection,
  nodes: Collection,
  opts: ResolvedHcaOptions,
  getDist: (n1: Collection, n2: Collection) => number,
  pairDist: (i: number, j: number) => number,
): Collection[] => {
  // the named linkages take the flat typed-array engine (65.10); a
  // custom per-pair linkage *function* needs live Collection values at
  // every merge and keeps the object path below
  if (
    opts.linkage === 'min' ||
    opts.linkage === 'max' ||
    opts.linkage === 'mean'
  ) {
    return hierarchicalRunFlat(coll, nodes, opts, pairDist);
  }

  const clusters: ClusterNode[] = [];
  const dists: number[][] = [];
  const mins: number[] = [];
  const index: ClusterNode[] = [];

  for (let n = 0; n < nodes.length; n++) {
    const cluster: ClusterNode = {
      value: opts.mode === 'dendrogram' ? nodes[n] : [nodes[n]],
      key: n,
      index: n,
    };

    clusters[n] = cluster;
    index[n] = cluster;
    dists[n] = [];
    mins[n] = 0;
  }

  for (let i = 0; i < clusters.length; i++) {
    for (let j = 0; j <= i; j++) {
      const dist = i === j ? Infinity : pairDist(i, j);

      dists[i][j] = dist;
      dists[j][i] = dist;

      if (dist < dists[i][mins[i]]) {
        mins[i] = j;
      }
    }
  }

  while (mergeClosest(clusters, index, dists, mins, opts, getDist)) {
    /* merge until done */
  }

  if (opts.mode === 'dendrogram') {
    const retClusters = buildClustersFromTree(
      clusters[0],
      opts.dendrogramDepth,
      coll,
    );

    if (opts.addDendrogram) {
      buildDendrogram(clusters[0], coll);
    }

    return retClusters;
  }

  return clusters.map((cluster) => {
    cluster.key = cluster.index = null;

    return spawnHandles(coll, cluster.value as Collection[]);
  });
};
