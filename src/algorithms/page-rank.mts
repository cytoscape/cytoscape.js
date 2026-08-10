import type { Collection } from '../collection.mjs';
import { subgraph, firstNodeSlot, weightAt } from './algo-shared.mjs';
import type { SubgraphView, WeightFn } from './algo-shared.mjs';
import { resolveExecutor, runAlgo } from './executor.mjs';
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
 * implementation or the WGSL kernels.
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
  const view = subgraph(coll);
  const n = view.nodeSlots.length;
  const m = view.edgeSlots.length;

  // 'auto' never routes pageRank to the GPU since the CPU went sparse
  // (65.10): the CPU pays O(E) per iteration where the GPU's dense
  // mat-vec pays O(n²) regardless — and denser graphs converge in
  // *fewer* power iterations, so even at E = n²/12 the sparse CPU
  // measured 5× ahead (16.5 ms vs 82.1 at n=2048, amd gcn-4; ~200×
  // ahead on the sparse fixture).  The GPU path stays for an explicit
  // `executor: 'gpu'` and the parity suite; the revisit that could
  // change this verdict is a sparse SpMV kernel, logged in the round
  // record.
  void m;

  return runAlgo(
    executor,
    n,
    Infinity,
    () => pageRank(coll, options),
    (ctx) => pageRankGpu(ctx, coll, options),
  );
};

/**
 * Build the damped, column-normalized transition matrix (transposed —
 * rows gather from sources) the **GPU** executor iterates on.  Since
 * round 65.10 the CPU reference iterates sparsely over the edges
 * instead — the same maths, refactored (see `pageRank`) — so this
 * dense build is the GPU path's alone; both executors still agree
 * within the parity suite's tolerances.
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

/**
 * PageRank over the calling collection — the power method, iterated
 * **sparsely** since round 65.10: the dense form multiplied an n×n
 * matrix per iteration where the matrix is structurally
 *
 *   M[t][s] = w_ts / colSum[s] + (1−d)/n        (s has out-edges)
 *   M[t][s] = 1/n + (1−d)/n                      (s dangling)
 *
 * so temp = M·v decomposes into an O(E) edge gather plus two rank-1
 * terms (the damping teleport over Σv and the dangling mass over
 * Σ_dangling v) that are constant per row.  Same maths, O(E + n) per
 * iteration instead of O(n²) — on sparse graphs that is orders of
 * magnitude, and it moved the GPU crossover accordingly (see the
 * async wrapper).  Summation order differs from the dense form, so
 * ranks can differ in ulps; the public contract (tolerance-based) and
 * the CPU-vs-GPU parity suite are unaffected.
 */
export const pageRank = (
  coll: Collection,
  options: PageRankOptions = {},
): PageRankResult => {
  const dampingFactor = options.dampingFactor ?? 0.8;
  const precision = options.precision ?? 0.000001;
  const iterations = options.iterations ?? 200;

  const view = subgraph(coll);
  const { endpoints, index, nodeSlots } = view;
  const weightOf = weightAt(view, options.weight);
  const n = nodeSlots.length;
  const additionalProb = (1 - dampingFactor) / n;

  // sparse build: dense source/target index pairs, normalized weights,
  // and the dangling set (no out-edges → uniform teleport, as dense)
  const m = view.edgeSlots.length;
  const srcs = new Int32Array(m);
  const dsts = new Int32Array(m);
  const ws = new Float64Array(m);
  const columnSum = new Float64Array(n);
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

    const w = weightOf(e);

    srcs[edges] = sIdx;
    dsts[edges] = tIdx;
    ws[edges] = w;
    columnSum[sIdx] += w;
    edges++;
  }

  for (let e = 0; e < edges; e++) {
    ws[e] /= columnSum[srcs[e]]; // srcs always have columnSum > 0
  }

  const dangling: number[] = [];

  for (let j = 0; j < n; j++) {
    if (columnSum[j] === 0) {
      dangling.push(j);
    }
  }

  // dominant eigenvector via the power method
  let eigenvector = new Float64Array(n).fill(1);
  let temp = new Float64Array(n);

  for (let iter = 0; iter < iterations; iter++) {
    let vSum = 0;

    for (let i = 0; i < n; i++) {
      vSum += eigenvector[i];
    }

    let danglingSum = 0;

    for (let k = 0; k < dangling.length; k++) {
      danglingSum += eigenvector[dangling[k]];
    }

    const base = additionalProb * vSum + danglingSum / n;

    temp.fill(base);

    for (let e = 0; e < edges; e++) {
      temp[dsts[e]] += ws[e] * eigenvector[srcs[e]];
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
