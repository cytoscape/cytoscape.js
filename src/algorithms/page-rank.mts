import type { Collection } from '../collection.mjs';
import { subgraph, firstNodeSlot, weightAt } from './algo-shared.mjs';
import type { SubgraphView, WeightFn } from './algo-shared.mjs';
import { GPU_MIN_N, resolveExecutor, runAlgo } from './executor.mjs';
import type { AlgoExecutor } from './executor.mjs';
import { pageRankGpu } from './algo-gpu-pagerank.mjs';

export interface PageRankOptions {
  dampingFactor?: number;
  precision?: number;
  iterations?: number;
  weight?: WeightFn;
  /** where the run executes; see `AlgoExecutor` (default 'auto') */
  executor?: AlgoExecutor;
}

export interface PageRankResult {
  rank(node: Collection): number | undefined;
}

/**
 * The async PageRank entry point behind `eles.pageRank()`: validates
 * `executor` synchronously, then routes to the CPU reference
 * implementation or, in a later round, the WGSL kernels.
 *
 * @param coll — the calling collection
 * @param options — as `pageRank`, plus `executor`
 * @returns a promise of the `{ rank }` accessor
 * @throws if `executor` is not 'cpu', 'gpu' or 'auto'
 */
export const pageRankAsync = (
  coll: Collection,
  options: PageRankOptions = {},
): Promise<PageRankResult> => {
  const executor = resolveExecutor(options.executor);
  const n = subgraph(coll).nodeSlots.length;

  return runAlgo(
    executor,
    n,
    GPU_MIN_N,
    () => pageRank(coll, options),
    (ctx) => pageRankGpu(ctx, coll, options),
  );
};

/**
 * Build the damped, column-normalized transition matrix (transposed —
 * rows gather from sources) both executors iterate on, so the GPU path
 * starts from the identical f64 matrix the CPU reference uses.
 *
 * @param coll — the calling collection
 * @param options — the caller's options (weight, dampingFactor)
 * @returns the view, node count and row-major matrix
 */
export const buildPageRankMatrix = (
  coll: Collection,
  options: PageRankOptions,
): { view: SubgraphView; n: number; matrix: Float64Array } => {
  const dampingFactor = options.dampingFactor ?? 0.8;
  const view = subgraph(coll);
  const { endpoints, index, nodeSlots } = view;
  const weightOf = weightAt(view, options.weight);
  const n = nodeSlots.length;

  // transposed adjacency matrix + per-column (source) weight sums
  const matrix = new Float64Array(n * n);
  const columnSum = new Float64Array(n);
  const additionalProb = (1 - dampingFactor) / n;

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

    const w = weightOf(e);

    matrix[t * n + s] += w;
    columnSum[s] += w;
  }

  const p = 1.0 / n + additionalProb;

  for (let j = 0; j < n; j++) {
    if (columnSum[j] === 0) {
      // no links out of node j: assume equal probability for each node
      for (let i = 0; i < n; i++) {
        matrix[i * n + j] = p;
      }
    } else {
      for (let i = 0; i < n; i++) {
        matrix[i * n + j] = matrix[i * n + j] / columnSum[j] + additionalProb;
      }
    }
  }

  return { view, n, matrix };
};

/**
 * Wrap a converged eigenvector as the public `{ rank }` accessor —
 * shared by both executors.
 *
 * @param view — the subgraph view the matrix was built from
 * @param eigenvector — the converged, sum-normalized ranks
 * @returns the result object
 */
export const pageRankResultFrom = (
  view: SubgraphView,
  eigenvector: ArrayLike<number>,
): PageRankResult => ({
  rank(node: Collection): number | undefined {
    const slot = firstNodeSlot(view, node, 'node');
    const i = slot == null ? undefined : view.index.get(slot);

    return i == null ? undefined : eigenvector[i];
  },
});

/** PageRank over the calling collection (power method on the dense matrix). */
export const pageRank = (
  coll: Collection,
  options: PageRankOptions = {},
): PageRankResult => {
  const precision = options.precision ?? 0.000001;
  const iterations = options.iterations ?? 200;

  const { view, n, matrix } = buildPageRankMatrix(coll, options);

  // dominant eigenvector via the power method
  let eigenvector = new Float64Array(n).fill(1);
  let temp = new Float64Array(n);

  for (let iter = 0; iter < iterations; iter++) {
    temp.fill(0);

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        temp[i] += matrix[i * n + j] * eigenvector[j];
      }
    }

    let sum = 0;

    for (let i = 0; i < n; i++) {
      sum += temp[i];
    }

    if (sum !== 0) {
      for (let i = 0; i < n; i++) {
        temp[i] /= sum;
      }
    }

    const previous = eigenvector;

    eigenvector = temp;
    temp = previous;

    let diff = 0;

    for (let i = 0; i < n; i++) {
      const delta = previous[i] - eigenvector[i];

      diff += delta * delta;
    }

    if (diff < precision) {
      break;
    }
  }

  return pageRankResultFrom(view, eigenvector);
};
