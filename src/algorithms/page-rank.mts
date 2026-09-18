import type { Collection } from '../collection.mjs';
import { subgraph, firstNodeSlot, weightAt } from './algo-shared.mjs';
import type { SubgraphView, WeightFn } from './algo-shared.mjs';
import { resolveExecutor, runAlgo } from './executor.mjs';
import type { AlgoExecutor } from './executor.mjs';
import type { AlgoRun } from './cancel.mjs';
import { pageRankGpu } from './algo-gpu-pagerank.mjs';

/**
 * The node count above which `'auto'` would take the GPU for
 * pageRank: `Infinity` — the sparse CPU iteration wins at every
 * measured size and density (65.10; re-measured against the CSR
 * kernel in 72.1, amd gcn-4 — see the async wrapper).  Exported so
 * the sweep's verdict is spelled once.
 */
export const PAGE_RANK_GPU_MIN_N = Infinity;

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
): AlgoRun<PageRankResult> => {
  const executor = resolveExecutor(options.executor);
  const n = subgraph(coll).nodeSlots.length;

  // 'auto' never routes pageRank to the GPU (65.10; re-measured in
  // 72.1 against the sparse CSR kernel, amd gcn-4): on the sparse
  // bench fixture the whole CPU call is 0.3–0.6 ms at n=512–2048
  // where the GPU call floors at ~3.7 ms — one mapAsync readback —
  // and on the dense fixture (E = n²/12) the shared O(E) build
  // dominates both sides, 15.4 ms CPU vs 20.6 ms GPU at n=2048.  The
  // kernel itself is 18× the CPU iteration on dense (56 µs vs 1 ms),
  // so the crossover exists only past ~1M edges, beyond the sweep.
  // The GPU path stays for an explicit `executor: 'gpu'` and the
  // parity suite.
  return runAlgo(
    executor,
    n,
    PAGE_RANK_GPU_MIN_N,
    () => pageRank(coll, options),
    (ctx) => pageRankGpu(ctx, coll, options),
  );
};

/**
 * The sparse transition structure both executors iterate on (round
 * 65.10 for the CPU, 72.1 for the GPU): dense-index (source, target)
 * pairs with the weight column-normalized by the source's out-weight,
 * plus the dangling set — the sources with no out-edges, which the
 * dense form gave a uniform 1/n column.  Loops are excluded and edges
 * outside the collection ignored, exactly as the dense build did, so
 * the two executors agree within the parity suite's tolerances.
 *
 * @param coll — the calling collection
 * @param options — the caller's options (weight, dampingFactor)
 * @returns the view, node count, live edge count, the triplets and the
 *   dangling indices
 */
export const buildPageRankSparse = (
  coll: Collection,
  options: PageRankOptions,
): {
  view: SubgraphView;
  n: number;
  edges: number;
  srcs: Int32Array;
  dsts: Int32Array;
  ws: Float64Array;
  dangling: Int32Array;
  additionalProb: number;
} => {
  const dampingFactor = options.dampingFactor ?? 0.8;
  const view = subgraph(coll);
  const { endpoints, index, nodeSlots } = view;
  const weightOf = weightAt(view, options.weight);
  const n = nodeSlots.length;
  const additionalProb = (1 - dampingFactor) / n;

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

  let danglingCount = 0;

  for (let j = 0; j < n; j++) {
    if (columnSum[j] === 0) {
      danglingCount++;
    }
  }

  const dangling = new Int32Array(danglingCount);

  for (let j = 0, k = 0; j < n; j++) {
    if (columnSum[j] === 0) {
      dangling[k++] = j;
    }
  }

  return { view, n, edges, srcs, dsts, ws, dangling, additionalProb };
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
  const precision = options.precision ?? 0.000001;
  const iterations = options.iterations ?? 200;
  const { view, n, edges, srcs, dsts, ws, dangling, additionalProb } =
    buildPageRankSparse(coll, options);

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
