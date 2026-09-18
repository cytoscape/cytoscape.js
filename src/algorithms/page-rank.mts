import type { Collection } from '../collection.mjs';
import { subgraph, firstNodeSlot, weightAt } from './algo-shared.mjs';
import type { SubgraphView, WeightFn } from './algo-shared.mjs';
import { inThread, resolveExecutor, runAlgo } from './executor.mjs';
import type { AlgoExecutor, OffloadLane } from './executor.mjs';
import type { AlgoRun } from './cancel.mjs';
import { pageRankGpu } from './algo-gpu-pagerank.mjs';

/**
 * The node count from which `'auto'` runs pageRank on one pool worker
 * rather than in-thread (129.1).  Measured 2026-09-18 on the sparse
 * fixture (mean degree 2.7, i9-9900K): the whole call is 0.7 / 1.2 /
 * 2.4 / 5.5 ms at n = 2048 / 8192 / 16384 / 32768, and the lane frees
 * the thread for the *kernel's* share only — the sparse structure is
 * built in-thread, and at 32768 that build is 4.0 of the 5.5 ms — so
 * the lane opens where the run first reaches a quarter frame, and
 * what it buys on a sparse graph is the iteration, not the build.
 */
export const PAGE_RANK_OFFLOAD_MIN_N = 32768;

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
  const lane = pageRankLane(coll, options);

  return runAlgo(
    executor,
    n,
    PAGE_RANK_GPU_MIN_N,
    () => inThread(lane),
    (ctx) => pageRankGpu(ctx, coll, options),
    undefined,
    null,
    lane,
  );
};

/**
 * PageRank's offload lane (129.1): the snapshot built here — every
 * closure evaluated on this thread — the maths as `pageRankKernel`
 * (`algo-kernels.mts`), run in this thread under `'cpu'` and on one
 * pool worker under `'auto'` / `'workers'`, and the public result over
 * whichever answered.  One function on both sides, so the two agree
 * bit for bit.
 *
 * @param coll — the calling collection
 * @param options — the caller's options
 * @returns the lane
 */
export const pageRankLane = (
  coll: Collection,
  options: PageRankOptions,
): OffloadLane<PageRankResult> => {
  let view: SubgraphView | null = null;

  return {
    minN: PAGE_RANK_OFFLOAD_MIN_N,
    snapshot: () => {
      const built = buildPageRankSparse(coll, options);

      view = built.view;

      return {
        kind: 'kernel',
        name: 'pageRank',
        input: {
          n: built.n,
          edges: built.edges,
          srcs: built.srcs,
          dsts: built.dsts,
          ws: built.ws,
          dangling: built.dangling,
          additionalProb: built.additionalProb,
          precision: options.precision ?? 0.000001,
          iterations: options.iterations ?? 200,
        },
      };
    },
    wrap: (out) =>
      pageRankResultFrom(view as SubgraphView, out.ranks as Float64Array),
  };
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
 * the CPU-vs-GPU parity suite are unaffected.  The loop itself is
 * `pageRankKernel` (`algo-kernels.mts`) since 129.1, so the in-thread
 * reference and the offload lane run one function.
 */
export const pageRank = (
  coll: Collection,
  options: PageRankOptions = {},
): PageRankResult => inThread(pageRankLane(coll, options));
