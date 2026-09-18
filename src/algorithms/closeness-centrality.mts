import type { Collection } from '../collection.mjs';
import { dijkstra } from './dijkstra.mjs';
import { initFloydWarshall, relaxFloydWarshall } from './floyd-warshall.mjs';
import { subgraph, firstNodeSlot } from './algo-shared.mjs';
import type { SubgraphView, WeightFn } from './algo-shared.mjs';
import { GPU_MIN_N, resolveExecutor, runAlgo } from './executor.mjs';
import type { AlgoExecutor } from './executor.mjs';
import type { AlgoWorkers } from './algo-workers.mjs';
import {
  closenessCentralityNormalizedBfsGpu,
  closenessCentralityNormalizedGpu,
} from './algo-gpu-closeness.mjs';
import { GROUP_NODES } from '../contract.mjs';
import { brandesCsr } from './betweenness-centrality.mjs';

/**
 * The node count above which `'auto'` takes the GPU BFS for an
 * unweighted closeness run on a sparse graph.  Measured 2026-09-18
 * (amd gcn-4, whole call, ring + chords at mean degree ~2.3): CPU BFS
 * 1.2 / 8.3 / 18.8 / 70.7 / 285.7 ms against GPU BFS 5.9 / 8.6 /
 * 12.7 / 25.3 / 83.0 ms at n = 256 / 512 / 1024 / 2048 / 4096 — a
 * wash at 512, the GPU ahead from 1024 and 3.4× at 4096.
 */
export const CLOSENESS_BFS_GPU_MIN_N = 1024;

/**
 * The density (arcs ≥ n² / this) past which `'auto'` takes the GPU
 * BFS at `GPU_MIN_N` already: the CPU's O(n·(n+E)) walk grows with E
 * where the level-synchronous GPU BFS finishes in a few levels.
 * Measured at mean degree 18 (arcs/n² = 0.036 at n=512): CPU 13.2 ms
 * against GPU 7.0 ms at n=512 and 52.1 against 16.8 at n=1024; at
 * n=256 the two are a wash (3.5 vs 3.9).
 */
export const CLOSENESS_BFS_DENSE_DIVISOR = 64;

/**
 * The density (arcs ≥ n² / this) past which an unweighted GPU run
 * relaxes Floyd–Warshall instead of walking the BFS: the pulled BFS
 * scans every reverse list per level, so at arcs/n² ≈ 0.17 the
 * blocked FW is the cheaper kernel — 9.6 against 13.4 ms at n=512
 * and 34.1 against 55.4 at n=1024 — while at 0.07 (n=256) the two
 * are level and at 0.036 the BFS wins.  The CPU side walks the BFS
 * regardless: it beats the CPU's FW at every density.
 */
export const CLOSENESS_FW_DENSE_DIVISOR = 8;

/**
 * The `'auto'` crossover to the worker pool for the unweighted BFS
 * route (74.5, i9-9900K, eight workers: 1.4× at n = 256, 3.9× at
 * 512, 5.1× at 1024, 6.4× at 4096).  On the *sparse* route the pool
 * is tried before the GPU: the same sweep read the pool ahead of the
 * RX 580's batched BFS at every size — 4.0 vs 14.6 ms at n = 1024,
 * 15.2 vs 28.3 at 2048, 50.1 vs 87.5 at 4096 — because a BFS per
 * source is a walk, not a product.  On the dense routes the GPU keeps
 * precedence (Floyd–Warshall 38.0 ms vs the pool's 74.4 at n = 1024
 * on the E ≈ n²/12 fixture; a tie at 512).
 */
export const CLOSENESS_WORKERS_MIN_N = 512;

export interface ClosenessCentralityOptions {
  root?: Collection | null;
  weight?: WeightFn;
  directed?: boolean;
  /** sum 1/d (default, tolerates disconnection) instead of 1/sum d */
  harmonic?: boolean;
  /** where the run executes; see `AlgoExecutor` (default 'auto').
   * Read by the whole-collection `closenessCentralityNormalized` only —
   * the single-root `closenessCentrality` is a cheap Dijkstra walk and
   * stays synchronous on the CPU.  Unweighted runs walk a BFS per
   * source on either executor (72.3); weighted runs relax
   * Floyd–Warshall. */
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

    const d = di.distanceTo(view.cy._ele(GROUP_NODES, slot)) as number;

    totalDistance += harmonic ? 1 / d : d;
  }

  return harmonic ? totalDistance : 1 / totalDistance;
};

/**
 * The async whole-collection closeness entry point behind
 * `eles.closenessCentralityNormalized()`: validates `executor`
 * synchronously, then routes to the CPU reference implementation or
 * the WGSL kernels — for unweighted runs the batched BFS shared with
 * Brandes, for weighted ones the blocked Floyd–Warshall relaxation —
 * each with a per-row fold on the device, so the readback is n floats
 * rather than the n² distance matrix.
 *
 * @param coll — the calling collection
 * @param options — as `closenessCentralityNormalized`, plus `executor`
 * @returns a promise of the `{ closeness }` accessor
 * @throws if `executor` is not 'cpu', 'gpu', 'workers' or 'auto'
 */
export const closenessCentralityNormalizedAsync = (
  coll: Collection,
  options: ClosenessCentralityOptions = {},
): Promise<ClosenessCentralityNormalizedResult> => {
  const executor = resolveExecutor(options.executor);
  const view = subgraph(coll);
  const n = view.nodeSlots.length;

  if (options.weight == null) {
    // unweighted (72.3): the CPU walks a BFS per source at every
    // density; the GPU walks the batched BFS, or on very dense graphs
    // relaxes Floyd–Warshall, whichever kernel measured cheaper.  The
    // constants above carry the measurements.
    const arcs = view.edgeSlots.length * (options.directed === true ? 1 : 2);
    const density = n === 0 ? 0 : arcs / (n * n);
    const veryDense = density >= 1 / CLOSENESS_FW_DENSE_DIVISOR;
    const dense = density >= 1 / CLOSENESS_BFS_DENSE_DIVISOR;

    return runAlgo(
      executor,
      n,
      dense ? GPU_MIN_N : CLOSENESS_BFS_GPU_MIN_N,
      () => closenessCentralityNormalized(coll, options),
      veryDense
        ? (ctx) => closenessCentralityNormalizedGpu(ctx, coll, options)
        : (ctx) => closenessCentralityNormalizedBfsGpu(ctx, coll, options),
      undefined,
      {
        minN: CLOSENESS_WORKERS_MIN_N,
        run: (pool) =>
          closenessCentralityNormalizedWorkers(pool, view, options),
        // sparse: the pool measured ahead of the GPU at every size
        first: !dense,
      },
    );
  }

  // weighted: the relaxation dominates and is Floyd–Warshall's, so the
  // family inherits FW's measured crossover (65.8: 3.4x GPU at n=256
  // already)
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

/**
 * The unweighted row sums by per-source BFS (round 72.3): one
 * breadth-first walk per node over the deduped neighbor lists both
 * executors share with Brandes, accumulating the row's closeness sum
 * as levels are assigned — O(n·(n + E)) where Floyd–Warshall is O(n³)
 * whatever the density.  Distances are exact integers, so plain-mode
 * sums are bit-identical to the FW route's and harmonic sums differ
 * only in f64 summation order.  A plain-mode row with an unreachable
 * node sums to Infinity, exactly as FW's Infinity entries do.
 *
 * @param view — the subgraph view
 * @param directed — out-neighbors only, or both sides
 * @param harmonic — the mode
 * @returns Σ over j≠i of (harmonic ? 1/d : d), per dense index
 */
export const closenessRowSumsBfs = (
  view: SubgraphView,
  directed: boolean,
  harmonic: boolean,
): Float64Array => {
  const n = view.nodeSlots.length;
  // flattened to CSR once (the snapshot the workers lane clones): the
  // per-source walk then touches typed arrays only (measured 84 → 72
  // ms at n=2048 over the nested lists)
  const { rowPtr: starts, colIdx: entries } = brandesCsr(
    view,
    directed,
    undefined,
  );
  const sums = new Float64Array(n);
  const dist = new Int32Array(n);
  const queue = new Int32Array(n);

  for (let s = 0; s < n; s++) {
    dist.fill(-1);
    dist[s] = 0;
    queue[0] = s;

    let head = 0;
    let tail = 1;
    let sum = 0;

    while (head < tail) {
      const v = queue[head++];
      const dv = dist[v] + 1;
      const term = harmonic ? 1 / dv : dv;
      const end = starts[v + 1];

      for (let e = starts[v]; e < end; e++) {
        const w = entries[e];

        if (dist[w] === -1) {
          dist[w] = dv;
          queue[tail++] = w;
          sum += term;
        }
      }
    }

    // plain mode: one unreachable node makes the row's sum infinite
    sums[s] = !harmonic && tail < n ? Infinity : sum;
  }

  return sums;
};

/**
 * The workers lane (round 74): the same BFS per source, one contiguous
 * source range per job; each row sum is computed whole by one worker
 * in the reference's operation order, so the scores are bit-identical
 * to `'cpu'`.
 *
 * @param pool — the acquired worker pool
 * @param view — the subgraph view
 * @param options — the caller's options
 * @returns the `{ closeness }` accessor
 */
export const closenessCentralityNormalizedWorkers = async (
  pool: AlgoWorkers,
  view: SubgraphView,
  options: ClosenessCentralityOptions,
): Promise<ClosenessCentralityNormalizedResult> => {
  const n = view.nodeSlots.length;
  const harmonic = options.harmonic !== false;
  const { rowPtr, colIdx } = brandesCsr(
    view,
    options.directed === true,
    undefined,
  );
  const parts = await pool.run(
    { kind: 'closeness', n, rowPtr, colIdx, harmonic },
    n,
  );
  const closenesses = new Float64Array(n);
  let at = 0;

  for (const part of parts) {
    for (let i = 0; i < part.length; i++) {
      closenesses[at++] = closenessOfRowSum(part[i], harmonic);
    }
  }

  return closenessResultFrom(view, closenesses);
};

/**
 * Closeness centrality of every collection node, normalized by the
 * maximum.  Unweighted runs walk a BFS per source (72.3); weighted
 * runs relax Floyd–Warshall over the shared init — the same numbers
 * either way, since unit weights make FW's distances the BFS levels.
 */
export const closenessCentralityNormalized = (
  coll: Collection,
  options: ClosenessCentralityOptions = {},
): ClosenessCentralityNormalizedResult => {
  const harmonic = options.harmonic !== false;

  if (options.weight == null) {
    const view = subgraph(coll);
    const sums = closenessRowSumsBfs(view, options.directed === true, harmonic);
    const closenesses = new Float64Array(sums.length);

    for (let i = 0; i < sums.length; i++) {
      closenesses[i] = closenessOfRowSum(sums[i], harmonic);
    }

    return closenessResultFrom(view, closenesses);
  }

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
