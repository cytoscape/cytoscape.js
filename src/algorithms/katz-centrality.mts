/*
Katz centrality (round 69) — attenuated walk counting: a node is
central when many short walks end at it, each walk of length k worth
αᵏ, so x solves x = α·Aᵀ·x + β and the fixed point is reached by the
power-style iteration both executors run.

Directed runs count *incoming* walks (the prestige reading — column j
of A feeds node j); undirected runs read every edge both ways.
Parallel edges each contribute their weight, loops are excluded, and
the collection's own edges are the walk universe — the family
conventions `pageRank` set.  There is no v3 counterpart — this API is
v4's own.

Like `pageRank` — the same iteration shape — the CPU reference
iterates *sparsely* over the edges at O(E + n) per step, so the dense
O(n²) mat-vec kernels never win under 'auto' and the GPU path exists
for an explicit `executor: 'gpu'` and the parity suite (see the async
entry's note).
*/

import type { Collection } from '../collection.mjs';
import { subgraph, firstNodeSlot, weightAt } from './algo-shared.mjs';
import type { SubgraphView, WeightFn } from './algo-shared.mjs';
import { resolveExecutor, runAlgo } from './executor.mjs';
import type { AlgoExecutor } from './executor.mjs';
import { katzCentralityGpu } from './algo-gpu-katz.mjs';

export interface KatzCentralityOptions {
  /** the walk attenuation per step (default 0.1); must be positive,
   * and under 1/λ_max of the adjacency for the iteration to converge */
  alpha?: number;
  /** the baseline every node starts each step with (default 1) */
  beta?: number;
  /** iteration cap when the tolerance is never met (default 200) */
  maxIterations?: number;
  /** stop once Σ|Δx| < n · tolerance (default 1e-6) */
  tolerance?: number;
  /** count incoming walks only */
  directed?: boolean;
  weight?: WeightFn;
  /** where the run executes; see `AlgoExecutor` (default 'auto').
   * Like `pageRank`, 'auto' always stays on the sparse CPU iteration;
   * the GPU path serves an explicit 'gpu'. */
  executor?: AlgoExecutor;
}

export interface KatzCentralityResult {
  /** the node's converged walk sum, or undefined outside the collection */
  katz(node: Collection): number | undefined;
  /** the same, normalized by the maximum */
  katzNormalized(node: Collection): number;
  /** British-spelling alias of `katzNormalized` */
  katzNormalised(node: Collection): number;
}

/**
 * Validate `alpha` and `beta` — called synchronously by the async
 * entry, so a bad value throws at the call site rather than surfacing
 * later as a rejection.
 *
 * @param options — the caller's options
 * @returns the resolved `{ alpha, beta }`
 * @throws if `alpha` is not a positive finite number, or `beta` is
 *   not a finite number
 */
export const resolveKatzParams = (
  options: KatzCentralityOptions,
): { alpha: number; beta: number } => {
  const alpha = options.alpha ?? 0.1;
  const beta = options.beta ?? 1;

  if (!(alpha > 0) || !Number.isFinite(alpha)) {
    throw new TypeError(
      `\`alpha\` must be a positive finite number — got ${String(options.alpha)}`,
    );
  }

  if (typeof beta !== 'number' || !Number.isFinite(beta)) {
    throw new TypeError(
      `\`beta\` must be a finite number — got ${String(options.beta)}`,
    );
  }

  return { alpha, beta };
};

/**
 * The async Katz entry point behind `eles.katzCentrality()`: validates
 * `executor`, `alpha` and `beta` synchronously, then routes to the CPU
 * reference implementation or the WGSL mat-vec kernels.
 *
 * @param coll — the calling collection
 * @param options — `{ alpha, beta, maxIterations, tolerance, directed,
 *   weight, executor }`
 * @returns a promise of the `{ katz, katzNormalized }` accessors
 * @throws if `executor` is invalid, or `alpha`/`beta` are (see
 *   `resolveKatzParams`)
 */
export const katzCentralityAsync = (
  coll: Collection,
  options: KatzCentralityOptions = {},
): Promise<KatzCentralityResult> => {
  const executor = resolveExecutor(options.executor);

  resolveKatzParams(options); // an invalid alpha/beta throws at the call site

  const n = subgraph(coll).nodeSlots.length;

  // 'auto' never routes Katz to the GPU, for pageRank's reason
  // (65.10): the sparse CPU iteration pays O(E) per step where the
  // dense mat-vec pays O(n²) regardless, and the pageRank family —
  // the identical iteration shape — measured the sparse CPU 5× ahead
  // even at E = n²/12.  The GPU path stays for an explicit
  // `executor: 'gpu'` and the parity suite; a sparse SpMV kernel is
  // the revisit that could change the verdict.
  return runAlgo(
    executor,
    n,
    Infinity,
    () => katzCentrality(coll, options),
    (ctx) => katzCentralityGpu(ctx, coll, options),
  );
};

/**
 * Build the dense attenuated matrix the **GPU** executor iterates on:
 * M[t][s] = α · Σ w over the edges s→t (rows gather from sources —
 * the transposed adjacency, as `buildPageRankMatrix` lays out), both
 * directions under the undirected default.  The CPU reference runs
 * the same maths sparsely off the edge list.
 *
 * @param coll — the calling collection
 * @param options — the caller's options (alpha, weight, directed)
 * @returns the view, node count and row-major matrix
 */
export const buildKatzMatrix = (
  coll: Collection,
  options: KatzCentralityOptions,
): { view: SubgraphView; n: number; matrix: Float64Array } => {
  const { alpha } = resolveKatzParams(options);
  const directed = options.directed === true;
  const view = subgraph(coll);
  const { endpoints, index, nodeSlots } = view;
  const weightOf = weightAt(view, options.weight);
  const n = nodeSlots.length;
  const matrix = new Float64Array(n * n);

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

    const w = alpha * weightOf(e);

    matrix[t * n + s] += w;

    if (!directed) {
      matrix[s * n + t] += w;
    }
  }

  return { view, n, matrix };
};

/**
 * Wrap a converged walk-sum vector as the public accessors — shared
 * by both executors.
 *
 * @param view — the subgraph view the matrix was built from
 * @param katzOf — the converged per-node walk sums
 * @returns the result object
 */
export const katzResultFrom = (
  view: SubgraphView,
  katzOf: ArrayLike<number>,
): KatzCentralityResult => {
  let max = 0;

  for (let i = 0; i < katzOf.length; i++) {
    max = Math.max(max, katzOf[i]);
  }

  const katz = (node: Collection): number | undefined => {
    const slot = firstNodeSlot(view, node, 'node');
    const i = slot == null ? undefined : view.index.get(slot);

    return i == null ? undefined : katzOf[i];
  };

  const katzNormalized = (node: Collection): number => {
    if (max === 0) {
      return 0;
    }

    const value = katz(node);

    return value == null ? 0 : value / max;
  };

  return { katz, katzNormalized, katzNormalised: katzNormalized };
};

/**
 * Katz centrality over the calling collection — the sparse fixed-point
 * iteration: from x = 0, repeat x' = α·Aᵀ·x + β as an O(E) edge gather
 * until the L1 step drops under n·tolerance or `maxIterations` runs
 * out (the un-converged vector is returned as-is, like `pageRank` —
 * an `alpha` past 1/λ_max diverges rather than throwing, so check the
 * spectrum when scores explode).
 */
export const katzCentrality = (
  coll: Collection,
  options: KatzCentralityOptions = {},
): KatzCentralityResult => {
  const { alpha, beta } = resolveKatzParams(options);
  const maxIterations = options.maxIterations ?? 200;
  const tolerance = options.tolerance ?? 0.000001;
  const directed = options.directed === true;

  const view = subgraph(coll);
  const { endpoints, index, nodeSlots } = view;
  const weightOf = weightAt(view, options.weight);
  const n = nodeSlots.length;

  // sparse build: dense index pairs plus attenuated weights, exactly
  // the triplets the dense GPU matrix is assembled from
  const m = view.edgeSlots.length;
  const srcs = new Int32Array(m);
  const dsts = new Int32Array(m);
  const ws = new Float64Array(m);
  let edges = 0;

  for (const e of view.edgeSlots) {
    const sSlot = endpoints[e * 2];
    const tSlot = endpoints[e * 2 + 1];

    if (sSlot === tSlot) {
      continue;
    } // exclude loops

    const sIdx = index.get(sSlot);
    const tIdx = index.get(tSlot);

    if (sIdx == null || tIdx == null) {
      continue;
    }

    srcs[edges] = sIdx;
    dsts[edges] = tIdx;
    ws[edges] = alpha * weightOf(e);
    edges++;
  }

  let x = new Float64Array(n);
  let next = new Float64Array(n);

  for (let iter = 0; iter < maxIterations; iter++) {
    next.fill(beta);

    for (let e = 0; e < edges; e++) {
      next[dsts[e]] += ws[e] * x[srcs[e]];

      if (!directed) {
        next[srcs[e]] += ws[e] * x[dsts[e]];
      }
    }

    let diff = 0;

    for (let i = 0; i < n; i++) {
      diff += Math.abs(next[i] - x[i]);
    }

    const previous = x;

    x = next;
    next = previous;

    if (diff < n * tolerance) {
      break;
    }
  }

  return katzResultFrom(view, x);
};
