// Agglomerative hierarchical clustering — a handle-level port of v3's pass
// (threshold and dendrogram modes, min/max/mean/other linkage).

import type { Collection } from '../collection.mjs';
import { clusteringDistance } from './clustering-distances.mjs';
import type { DistanceMetric } from './clustering-distances.mjs';

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
}

interface ClusterNode {
  value?: Collection | Collection[];
  key: number | null;
  index: number | null;
  size?: number;
  left?: ClusterNode;
  right?: ClusterNode;
}

interface ResolvedOptions {
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

const setOptions = (
  options: HierarchicalClusteringOptions = {},
): ResolvedOptions => {
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

const mergeClosest = (
  clusters: ClusterNode[],
  index: ClusterNode[],
  dists: number[][],
  mins: number[],
  opts: ResolvedOptions,
): boolean => {
  let minKey = 0;
  let min = Infinity;
  const attrs = opts.attributes;

  const getDist = (n1: Collection, n2: Collection): number =>
    clusteringDistance(
      opts.distance,
      attrs.length,
      (i) => attrs[i](n1),
      (i) => attrs[i](n2),
      n1,
      n2,
    );

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

  const opts = setOptions(options);
  const attrs = opts.attributes;

  const getDist = (n1: Collection, n2: Collection): number =>
    clusteringDistance(
      opts.distance,
      attrs.length,
      (i) => attrs[i](n1),
      (i) => attrs[i](n2),
      n1,
      n2,
    );

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
      const dist =
        i === j
          ? Infinity
          : opts.mode === 'dendrogram'
            ? getDist(
                clusters[i].value as Collection,
                clusters[j].value as Collection,
              )
            : getDist(
                (clusters[i].value as Collection[])[0],
                (clusters[j].value as Collection[])[0],
              );

      dists[i][j] = dist;
      dists[j][i] = dist;

      if (dist < dists[i][mins[i]]) {
        mins[i] = j;
      }
    }
  }

  while (mergeClosest(clusters, index, dists, mins, opts)) {
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
