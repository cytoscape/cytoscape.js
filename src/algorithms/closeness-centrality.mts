import type { Collection } from '../collection.mjs';
import { dijkstra } from './dijkstra.mjs';
import { initFloydWarshall, relaxFloydWarshall } from './floyd-warshall.mjs';
import { subgraph, firstNodeSlot } from './algo-shared.mjs';
import type { SubgraphView, WeightFn } from './algo-shared.mjs';
import { GPU_MIN_N, resolveExecutor, runAlgo } from './executor.mjs';
import type { AlgoExecutor } from './executor.mjs';
import { closenessCentralityNormalizedGpu } from './algo-gpu-closeness.mjs';

export interface ClosenessCentralityOptions {
  root?: Collection | null;
  weight?: WeightFn;
  directed?: boolean;
  /** sum 1/d (default, tolerates disconnection) instead of 1/sum d */
  harmonic?: boolean;
  /** where the run executes; see `AlgoExecutor` (default 'auto').
   * Read by the whole-collection `closenessCentralityNormalized` only —
   * the single-root `closenessCentrality` is a cheap Dijkstra walk and
   * stays synchronous on the CPU. */
  executor?: AlgoExecutor;
}

export interface ClosenessCentralityNormalizedResult {
  closeness(node: Collection): number;
}

/** Closeness centrality of `root` within the calling collection. */
export const closenessCentrality = (
  coll: Collection,
  options: ClosenessCentralityOptions = {},
): number => {
  const harmonic = options.harmonic !== false;
  const view = subgraph(coll);
  const rootSlot = firstNodeSlot(view, options.root, 'root');

  if (rootSlot == null) {
    throw new TypeError('closenessCentrality requires a `root` node');
  }

  const di = dijkstra(coll, [
    {
      root: options.root as Collection,
      weight: options.weight,
      directed: options.directed,
    },
  ]);
  let totalDistance = 0;

  for (const slot of view.nodeSlots) {
    if (slot === rootSlot) {
      continue;
    }

    const d = di.distanceTo(view.cy._ele('nodes', slot)) as number;

    totalDistance += harmonic ? 1 / d : d;
  }

  return harmonic ? totalDistance : 1 / totalDistance;
};

/**
 * The async whole-collection closeness entry point behind
 * `eles.closenessCentralityNormalized()`: validates `executor`
 * synchronously, then routes to the CPU reference implementation or
 * the WGSL kernels (the blocked Floyd–Warshall relaxation plus a
 * per-row reduction, so the readback is n floats rather than the n²
 * distance matrix).
 *
 * @param coll — the calling collection
 * @param options — as `closenessCentralityNormalized`, plus `executor`
 * @returns a promise of the `{ closeness }` accessor
 * @throws if `executor` is not 'cpu', 'gpu' or 'auto'
 */
export const closenessCentralityNormalizedAsync = (
  coll: Collection,
  options: ClosenessCentralityOptions = {},
): Promise<ClosenessCentralityNormalizedResult> => {
  const executor = resolveExecutor(options.executor);
  const n = subgraph(coll).nodeSlots.length;

  // the relaxation dominates and is Floyd–Warshall's, so the family
  // inherits FW's measured crossover (65.8: 3.4x GPU at n=256 already)
  return runAlgo(
    executor,
    n,
    GPU_MIN_N,
    () => closenessCentralityNormalized(coll, options),
    (ctx) => closenessCentralityNormalizedGpu(ctx, coll, options),
  );
};

/**
 * Fold one node's relaxed distance row into its closeness score:
 * harmonic sums 1/d (an unreachable pair contributes 0), plain sums d
 * and reciprocates (one unreachable pair makes the sum infinite and
 * the score 0).  Shared by the CPU reference and the GPU readback,
 * which hands the row sums computed on the device through the same
 * final step.
 *
 * @param sum — Σ over j≠i of (harmonic ? 1/d : d)
 * @param harmonic — the mode
 * @returns the node's closeness score before max-normalization
 */
export const closenessOfRowSum = (sum: number, harmonic: boolean): number =>
  harmonic ? sum : 1 / sum;

/**
 * Wrap per-node closeness scores as the public `{ closeness }`
 * accessor, normalized by the maximum — shared by both executors.
 *
 * @param view — the subgraph view the scores were computed from
 * @param closenesses — one score per dense node index
 * @returns the result object
 */
export const closenessResultFrom = (
  view: SubgraphView,
  closenesses: ArrayLike<number>,
): ClosenessCentralityNormalizedResult => {
  let maxCloseness = 0;

  for (let i = 0; i < closenesses.length; i++) {
    maxCloseness = Math.max(maxCloseness, closenesses[i]);
  }

  return {
    closeness(node: Collection): number {
      if (maxCloseness === 0) {
        return 0;
      }

      const slot = firstNodeSlot(view, node, 'node');
      const i = slot == null ? undefined : view.index.get(slot);

      return i == null ? 0 : closenesses[i] / maxCloseness;
    },
  };
};

/** Closeness centrality of every collection node, normalized by the maximum. */
export const closenessCentralityNormalized = (
  coll: Collection,
  options: ClosenessCentralityOptions = {},
): ClosenessCentralityNormalizedResult => {
  const harmonic = options.harmonic !== false;
  const { view, n, dist, next } = initFloydWarshall(coll, options);

  relaxFloydWarshall(n, dist, next);

  const closenesses = new Float64Array(n);

  for (let i = 0; i < n; i++) {
    let sum = 0;

    for (let j = 0; j < n; j++) {
      if (i === j) {
        continue;
      }

      const d = dist[i * n + j];

      sum += harmonic ? 1 / d : d;
    }

    closenesses[i] = closenessOfRowSum(sum, harmonic);
  }

  return closenessResultFrom(view, closenesses);
};
