import type { Collection } from '../collection.mjs';
import { dijkstraDense } from './dijkstra.mjs';
import { initFloydWarshall } from './floyd-warshall.mjs';
import { subgraph, firstNodeSlot, weightAt } from './algo-shared.mjs';
import type { SubgraphView, WeightFn } from './algo-shared.mjs';
import { GPU_MIN_N, inThread, resolveExecutor, runAlgo } from './executor.mjs';
import type { AlgoExecutor, OffloadLane } from './executor.mjs';
import type { AlgoRun } from './cancel.mjs';
import type { AlgoWorkers } from './algo-workers.mjs';
import { gpuCall } from './gpu-registry.mjs';
import { brandesCsr } from './betweenness-centrality.mjs';
import { FLOYD_WARSHALL_OFFLOAD_MIN_N } from './floyd-warshall.mjs';

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
  /**
   * which distances a directed run sums (round 150): `'out'` (default)
   * from the node to the others — v3's, R igraph's `mode = "out"` and
   * graph-tool's — or `'in'`, from the others to the node — NetworkX's,
   * Neo4j GDS's and Boldi–Vigna's.  Ignored when undirected.
   */
  direction?: 'out' | 'in';
  /**
   * Σ 1/d (default, tolerates disconnection), or the classic
   * (n − 1)/Σd with the Wasserman–Faust correction (round 150): over
   * the r nodes reachable, (r/Σd)·(r/(n − 1)), 0 when none is
   */
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

/**
 * Whether a run walks the transposed graph: a directed run asked for
 * incoming distances.  Validates `direction`.
 *
 * @param options — the caller's options
 * @returns true when the walk follows in-edges
 * @throws if `direction` is neither 'out' nor 'in'
 */
export const closenessReverse = (
  options: ClosenessCentralityOptions,
): boolean => {
  const direction = options.direction ?? 'out';

  if (direction !== 'out' && direction !== 'in') {
    throw new TypeError(
      "`direction` must be 'out' or 'in' — got " + String(options.direction),
    );
  }

  return options.directed === true && direction === 'in';
};

/** Closeness centrality of `root` within the calling collection. */
export const closenessCentrality = (
  coll: Collection,
  options: ClosenessCentralityOptions = {},
): number => {
  const harmonic = options.harmonic !== false;
  const reverse = closenessReverse(options);
  const view = subgraph(coll);
  const rootSlot = firstNodeSlot(view, options.root, 'root');
  const root = rootSlot == null ? undefined : view.index.get(rootSlot);

  if (root == null) {
    throw new TypeError(
      'closenessCentrality requires a `root` node in the calling collection',
    );
  }

  const { dist } = dijkstraDense(
    view,
    root,
    weightAt(view, options.weight),
    options.directed === true,
    reverse,
  );
  const n = dist.length;
  let sum = 0;
  let reached = 0;

  for (let j = 0; j < n; j++) {
    const d = dist[j];

    if (j === root || d === Infinity) {
      continue;
    }

    sum += harmonic ? 1 / d : d;
    reached++;
  }

  return closenessOfRow(sum, reached, n, harmonic);
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
): AlgoRun<ClosenessCentralityNormalizedResult> => {
  const executor = resolveExecutor(options.executor);

  closenessReverse(options); // an invalid direction throws at the call site

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
        ? gpuCall('closenessDense', coll, options)
        : gpuCall('closenessBfs', coll, options),
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
  // already) — and FW's offload lane (129.1): the same relaxation
  // kernel on one pool worker, the rows folded here
  const lane = closenessWeightedLane(coll, options);

  return runAlgo(
    executor,
    n,
    GPU_MIN_N,
    () => inThread(lane),
    gpuCall('closenessDense', coll, options),
    undefined,
    null,
    lane,
  );
};

/**
 * The weighted route's offload lane (129.1): Floyd–Warshall's matrices
 * built here, relaxed by `floydWarshallKernel` (`algo-kernels.mts`) —
 * in this thread under `'cpu'`, on one pool worker under `'auto'` /
 * `'workers'` — and the rows folded into scores over whichever
 * answered.
 *
 * @param coll — the calling collection
 * @param options — the caller's options (weighted)
 * @returns the lane
 */
export const closenessWeightedLane = (
  coll: Collection,
  options: ClosenessCentralityOptions,
): OffloadLane<ClosenessCentralityNormalizedResult> => {
  const harmonic = options.harmonic !== false;
  const reverse = closenessReverse(options);
  let view: SubgraphView | null = null;

  return {
    minN: FLOYD_WARSHALL_OFFLOAD_MIN_N,
    snapshot: () => {
      const built = initFloydWarshall(coll, options);

      view = built.view;

      return {
        kind: 'kernel',
        name: 'floydWarshall',
        input: { n: built.n, dist: built.dist, next: built.next },
      };
    },
    wrap: (out) =>
      closenessResultFrom(
        view as SubgraphView,
        closenessFromDistances(
          (view as SubgraphView).nodeSlots.length,
          out.dist as Float64Array,
          harmonic,
          reverse,
        ),
      ),
  };
};

/**
 * Fold a relaxed distance matrix into per-node scores — the weighted
 * route's tail, shared by the in-thread reference and the offload
 * lane.
 *
 * @param n — the node count
 * @param dist — the row-major relaxed distances
 * @param harmonic — sum 1/d instead of the classic form
 * @param reverse — fold column i (distances *to* i) instead of row i
 * @returns the scores, by dense index
 */
export const closenessFromDistances = (
  n: number,
  dist: Float64Array,
  harmonic: boolean,
  reverse = false,
): Float64Array => {
  const closenesses = new Float64Array(n);

  for (let i = 0; i < n; i++) {
    let sum = 0;
    let reached = 0;

    for (let j = 0; j < n; j++) {
      const d = reverse ? dist[j * n + i] : dist[i * n + j];

      if (i === j || d === Infinity) {
        continue;
      }

      sum += harmonic ? 1 / d : d;
      reached++;
    }

    closenesses[i] = closenessOfRow(sum, reached, n, harmonic);
  }

  return closenesses;
};

/**
 * Fold one node's reachable distances into its closeness score.
 * Harmonic: Σ 1/d, where an unreachable node contributes nothing.
 * Classic (round 150, NetworkX's definition): (n − 1)/Σd when every
 * node is reachable, and over r reachable nodes the Wasserman–Faust
 * form (r/Σd)·(r/(n − 1)), which scales a node that reaches few others
 * down rather than to 0 — v3's 1/Σd gave 0 once any node was
 * unreachable, and was (n − 1) times smaller otherwise.  Shared by
 * every lane: the CPU and worker walks, Floyd–Warshall's fold and the
 * GPU readback.
 *
 * @param sum — Σ over reachable j ≠ i of (harmonic ? 1/d : d)
 * @param reached — how many j ≠ i are reachable
 * @param n — the node count
 * @param harmonic — the mode
 * @returns the node's closeness score before normalization
 */
export const closenessOfRow = (
  sum: number,
  reached: number,
  n: number,
  harmonic: boolean,
): number => {
  if (harmonic) {
    return sum;
  }

  return reached === 0 ? 0 : (reached / sum) * (reached / (n - 1));
};

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
 * only in f64 summation order.  Unreachable nodes are left out of the
 * sum and counted out of `reached`, as FW's fold leaves out its
 * Infinity entries.
 *
 * @param view — the subgraph view
 * @param directed — out-neighbors only, or both sides
 * @param harmonic — the mode
 * @param reverse — when directed, walk in-edges (distances to the node)
 * @returns the scores, by dense index
 */
export const closenessRowsBfs = (
  view: SubgraphView,
  directed: boolean,
  harmonic: boolean,
  reverse = false,
): Float64Array => {
  const n = view.nodeSlots.length;
  // flattened to CSR once (the snapshot the workers lane clones): the
  // per-source walk then touches typed arrays only (measured 84 → 72
  // ms at n=2048 over the nested lists)
  const { rowPtr: starts, colIdx: entries } = brandesCsr(
    view,
    directed,
    undefined,
    reverse,
  );
  const closenesses = new Float64Array(n);
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

    closenesses[s] = closenessOfRow(sum, tail - 1, n, harmonic);
  }

  return closenesses;
};

/**
 * The workers lane (round 74): the same BFS per source, one contiguous
 * source range per job; each row's sum and reached count are computed
 * whole by one worker in the reference's operation order, so the
 * scores are bit-identical to `'cpu'`.
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
    closenessReverse(options),
  );
  const parts = await pool.run(
    { kind: 'closeness', n, rowPtr, colIdx, harmonic },
    n,
  );
  const closenesses = new Float64Array(n);
  let at = 0;

  // each part interleaves (sum, reached) per source
  for (const part of parts) {
    for (let i = 0; i < part.length; i += 2) {
      closenesses[at++] = closenessOfRow(part[i], part[i + 1], n, harmonic);
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
  const reverse = closenessReverse(options);

  if (options.weight == null) {
    const view = subgraph(coll);

    return closenessResultFrom(
      view,
      closenessRowsBfs(view, options.directed === true, harmonic, reverse),
    );
  }

  return inThread(closenessWeightedLane(coll, options));
};
