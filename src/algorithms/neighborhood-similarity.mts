/*
Neighborhood similarity (round 69) — pairwise Jaccard / cosine /
overlap coefficients over neighbor sets, the second matmul-first
family: the shared-neighbor counts for every pair are (A · Aᵀ), one
tiled product over the 0/1 adjacency, and each metric is a per-pair
normalization of that count by the two neighborhood sizes.

The collection reads as a simple graph: parallel edges collapse to one
adjacency and loops are excluded, as in the triangle family.
`directed: true` compares *out*-neighborhoods; the default compares
undirected neighborhoods.  The result is inherently all-pairs — the
counts matrix is O(n²) memory on either executor, like
`floydWarshall`'s distances.  There is no v3 counterpart — this API is
v4's own.
*/

import type { Collection } from '../collection.mjs';
import { subgraph, firstNodeSlot } from './algo-shared.mjs';
import type { SubgraphView } from './algo-shared.mjs';
import { GPU_MIN_N, resolveExecutor, runAlgo } from './executor.mjs';
import type { AlgoExecutor } from './executor.mjs';
import { neighborhoodSimilarityGpu } from './algo-gpu-similarity.mjs';

/** How a pair's shared-neighbor count is normalized: Jaccard divides
 * by the union, cosine by the geometric mean of the sizes, overlap by
 * the smaller size. */
export type SimilarityMetric = 'jaccard' | 'cosine' | 'overlap';

export interface NeighborhoodSimilarityOptions {
  /** the normalization (default 'jaccard') */
  metric?: SimilarityMetric;
  /** compare out-neighborhoods instead of undirected ones */
  directed?: boolean;
  /** where the run executes; see `AlgoExecutor` (default 'auto').
   * 'auto' routes to the GPU only on graphs dense enough that the
   * O(n³) matmul beats the CPU's O(n² + Σ deg²) wedge walk. */
  executor?: AlgoExecutor;
}

export interface NeighborhoodSimilarityResult {
  /** the two nodes' similarity in [0, 1], or undefined when either
   * node is outside the collection */
  similarity(a: Collection, b: Collection): number | undefined;
}

/**
 * Validate the `metric` option — called synchronously by the async
 * entry, so a bad value throws at the call site rather than surfacing
 * later as a rejection.
 *
 * @param metric — the option as passed, or undefined for the default
 * @returns the resolved metric ('jaccard' when omitted)
 * @throws if the value is not 'jaccard', 'cosine' or 'overlap'
 */
export const resolveMetric = (
  metric: SimilarityMetric | undefined,
): SimilarityMetric => {
  if (metric == null) {
    return 'jaccard';
  }

  if (metric === 'jaccard' || metric === 'cosine' || metric === 'overlap') {
    return metric;
  }

  throw new TypeError(
    `\`metric\` must be 'jaccard', 'cosine' or 'overlap' — got ` +
      String(metric),
  );
};

/**
 * The deduped neighbor sets both executors compare: per-node dense
 * neighbor lists (parallel edges collapse, loops and
 * out-of-collection endpoints drop) — undirected by default, out-only
 * under `directed` — plus the neighborhood sizes every metric's
 * denominator reads.
 *
 * @param view — the subgraph view
 * @param directed — compare out-neighborhoods only
 * @returns neighbor lists and sizes, plus the total adjacency count
 *   the density gate reads
 */
export const buildNeighborhoods = (
  view: SubgraphView,
  directed: boolean,
): { neighbors: Int32Array[]; sizes: Int32Array; adjacencies: number } => {
  const { endpoints, index, nodeSlots } = view;
  const n = nodeSlots.length;
  const sets: Set<number>[] = new Array(n);

  for (let i = 0; i < n; i++) {
    sets[i] = new Set();
  }

  for (const e of view.edgeSlots) {
    const sSlot = endpoints[e * 2];
    const tSlot = endpoints[e * 2 + 1];

    if (sSlot === tSlot) {
      continue;
    } // exclude loops

    const s = index.get(sSlot);
    const t = index.get(tSlot);

    if (s == null || t == null) {
      continue;
    }

    sets[s].add(t);

    if (!directed) {
      sets[t].add(s);
    }
  }

  const neighbors: Int32Array[] = new Array(n);
  const sizes = new Int32Array(n);
  let adjacencies = 0;

  for (let i = 0; i < n; i++) {
    neighbors[i] = Int32Array.from(sets[i]);
    sizes[i] = neighbors[i].length;
    adjacencies += sizes[i];
  }

  return { neighbors, sizes, adjacencies };
};

/**
 * Wrap the shared-neighbor counts as the public `{ similarity }`
 * accessor — shared by both executors (the GPU hands its read-back
 * product matrix through here).  The metric normalizes lazily per
 * query, so the counts stay exact integers in either precision.
 *
 * @param view — the subgraph view the counts were computed from
 * @param sizes — neighborhood sizes, by dense index
 * @param counts — the row-major shared-neighbor count matrix
 * @param metric — the resolved normalization
 * @returns the result object
 */
export const similarityResultFrom = (
  view: SubgraphView,
  sizes: Int32Array,
  counts: ArrayLike<number>,
  metric: SimilarityMetric,
): NeighborhoodSimilarityResult => {
  const n = sizes.length;

  const denseOf = (node: Collection, name: string): number | undefined => {
    const slot = firstNodeSlot(view, node, name);

    return slot == null ? undefined : view.index.get(slot);
  };

  return {
    similarity(a: Collection, b: Collection): number | undefined {
      const i = denseOf(a, 'a');
      const j = denseOf(b, 'b');

      if (i == null || j == null) {
        return undefined;
      }

      const c = counts[i * n + j];
      const si = sizes[i];
      const sj = sizes[j];
      let denominator: number;

      if (metric === 'jaccard') {
        denominator = si + sj - c;
      } else if (metric === 'cosine') {
        denominator = Math.sqrt(si * sj);
      } else {
        denominator = Math.min(si, sj);
      }

      return denominator === 0 ? 0 : c / denominator;
    },
  };
};

/**
 * The async similarity entry point behind
 * `eles.neighborhoodSimilarity()`: validates `executor` and `metric`
 * synchronously, then routes to the CPU reference implementation or
 * the WGSL matmul kernels.
 *
 * @param coll — the calling collection
 * @param options — `{ metric, directed, executor }`
 * @returns a promise of the `{ similarity }` accessor
 * @throws if `executor` or `metric` is invalid
 */
export const neighborhoodSimilarityAsync = (
  coll: Collection,
  options: NeighborhoodSimilarityOptions = {},
): Promise<NeighborhoodSimilarityResult> => {
  const executor = resolveExecutor(options.executor);
  const metric = resolveMetric(options.metric);
  const directed = options.directed === true;
  const view = subgraph(coll);
  const hoods = buildNeighborhoods(view, directed);
  const n = view.nodeSlots.length;

  // the CPU wedge walk is O(n² + Σ deg²) where the matmul is O(n³)
  // regardless, so 'auto' takes the GPU only on dense graphs — the
  // triangle family's gate, for the triangle family's reason
  const dense = hoods.adjacencies >= (n * n) / 16;

  return runAlgo(
    executor,
    n,
    dense ? GPU_MIN_N : Infinity,
    () => neighborhoodSimilarity(view, hoods, metric, directed),
    (ctx) => neighborhoodSimilarityGpu(ctx, view, hoods, metric, directed),
  );
};

/**
 * The CPU reference: wedge counting.  Every shared neighbor w of a
 * pair (u, v) is one wedge u–w–v, so walking w's *witness* list — the
 * nodes that count w as a neighbor — and crediting each pair fills
 * the count matrix in O(Σ witnesses²) without any per-pair set
 * intersection.  The diagonal is each node's own neighborhood size.
 *
 * @param view — the subgraph view
 * @param hoods — from `buildNeighborhoods`
 * @param metric — the resolved normalization
 * @param directed — whether `hoods` holds out-neighborhoods
 * @returns the `{ similarity }` accessor
 */
export const neighborhoodSimilarity = (
  view: SubgraphView,
  hoods: { neighbors: Int32Array[]; sizes: Int32Array },
  metric: SimilarityMetric,
  directed: boolean,
): NeighborhoodSimilarityResult => {
  const { neighbors, sizes } = hoods;
  const n = sizes.length;
  const counts = new Float64Array(n * n);

  // witness lists: rev[w] = the u with w ∈ N(u).  Undirected
  // neighborhoods are symmetric, so rev is the neighbor list itself.
  let rev: Int32Array[];

  if (directed) {
    const revCounts = new Int32Array(n);

    for (let u = 0; u < n; u++) {
      const nu = neighbors[u];

      for (let k = 0; k < nu.length; k++) {
        revCounts[nu[k]]++;
      }
    }

    rev = new Array(n);

    for (let w = 0; w < n; w++) {
      rev[w] = new Int32Array(revCounts[w]);
    }

    const fill = new Int32Array(n);

    for (let u = 0; u < n; u++) {
      const nu = neighbors[u];

      for (let k = 0; k < nu.length; k++) {
        const w = nu[k];

        rev[w][fill[w]++] = u;
      }
    }
  } else {
    rev = neighbors;
  }

  for (let w = 0; w < n; w++) {
    const witnesses = rev[w];

    for (let a = 0; a < witnesses.length; a++) {
      const u = witnesses[a];

      for (let b = a + 1; b < witnesses.length; b++) {
        const v = witnesses[b];

        counts[u * n + v]++;
        counts[v * n + u]++;
      }
    }
  }

  for (let i = 0; i < n; i++) {
    counts[i * n + i] = sizes[i];
  }

  return similarityResultFrom(view, sizes, counts, metric);
};
