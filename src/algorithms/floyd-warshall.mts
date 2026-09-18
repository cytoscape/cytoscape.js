import type { Collection } from '../collection.mjs';
import type { Ref } from '../contract.mjs';
import { subgraph, firstNodeSlot, weightAt } from './algo-shared.mjs';
import type { SubgraphView, WeightFn } from './algo-shared.mjs';
import {
  GPU_MIN_N,
  OFFLOAD_MIN_N,
  inThread,
  resolveExecutor,
  runAlgo,
} from './executor.mjs';
import type { AlgoExecutor, OffloadLane } from './executor.mjs';
import type { AlgoRun } from './cancel.mjs';
import { floydWarshallGpu } from './algo-gpu-fw.mjs';
import { floydWarshallKernel } from './algo-kernels.mjs';

/**
 * The node count from which `'auto'` relaxes Floyd–Warshall on one
 * pool worker rather than in-thread (129.1): a starting figure,
 * stamped from the `algorithms-workers` offload rows.  O(n³): at 128
 * the in-thread run is already a couple of milliseconds.
 */
export const FLOYD_WARSHALL_OFFLOAD_MIN_N = OFFLOAD_MIN_N;
import { GROUP_EDGES, GROUP_NODES } from '../contract.mjs';

export interface FloydWarshallOptions {
  weight?: WeightFn;
  directed?: boolean;
  /** where the run executes; see `AlgoExecutor` (default 'auto') */
  executor?: AlgoExecutor;
}

export interface FloydWarshallResult {
  distance(from: Collection, to: Collection): number | undefined;
  path(from: Collection, to: Collection): Collection;
}

/**
 * The async Floyd–Warshall entry point behind `eles.floydWarshall()`:
 * validates `executor` synchronously, then routes to the CPU reference
 * implementation or the WGSL relaxation kernels.
 *
 * @param coll — the calling collection
 * @param options — as `floydWarshall`, plus `executor`
 * @returns a promise of the `{ distance, path }` accessors
 * @throws if `executor` is not 'cpu', 'gpu' or 'auto'
 */
export const floydWarshallAsync = (
  coll: Collection,
  options: FloydWarshallOptions = {},
): AlgoRun<FloydWarshallResult> => {
  const executor = resolveExecutor(options.executor);
  const n = subgraph(coll).nodeSlots.length;

  // measured crossover (65.8, amd gcn-4): 3.4x GPU at n=256 already
  // (28x at n=1024, blocked) — the default threshold is the measured
  // one
  const lane = floydWarshallLane(coll, options);

  return runAlgo(
    executor,
    n,
    GPU_MIN_N,
    () => inThread(lane),
    (ctx) => floydWarshallGpu(ctx, coll, options),
    undefined,
    null,
    lane,
  );
};

/**
 * Floyd–Warshall's offload lane (129.1): the snapshot built here — every
 * closure evaluated on this thread — the maths as `floydWarshallKernel`
 * (`algo-kernels.mts`), run in this thread under `'cpu'` and on one
 * pool worker under `'auto'` / `'workers'`, and the public result over
 * whichever answered.  One function on both sides, so the two agree
 * bit for bit.
 *
 * @param coll — the calling collection
 * @param options — the caller's options
 * @returns the lane
 */
export const floydWarshallLane = (
  coll: Collection,
  options: FloydWarshallOptions,
): OffloadLane<FloydWarshallResult> => {
  let built: ReturnType<typeof initFloydWarshall> | null = null;

  return {
    minN: FLOYD_WARSHALL_OFFLOAD_MIN_N,
    snapshot: () => {
      built = initFloydWarshall(coll, options);

      return {
        kind: 'kernel',
        name: 'floydWarshall',
        input: { n: built.n, dist: built.dist, next: built.next },
      };
    },
    wrap: (out) => {
      const { view, n, edgeNext } = built as ReturnType<
        typeof initFloydWarshall
      >;

      return floydWarshallResultFrom(
        coll,
        view,
        n,
        out.dist as Float64Array,
        out.next as Int32Array,
        edgeNext,
      );
    },
  };
};

/**
 * Build the initial dense matrices both executors relax: distances
 * (Infinity where unconnected), the dense-index successor matrix, and
 * the representative-edge matrix for direct hops.  Parallel edges keep
 * the lightest, loops are excluded — v3 semantics.
 *
 * @param coll — the calling collection
 * @param options — the caller's options (weight, directed)
 * @returns the view, node count and the three matrices
 */
export const initFloydWarshall = (
  coll: Collection,
  options: FloydWarshallOptions,
): {
  view: SubgraphView;
  n: number;
  dist: Float64Array;
  next: Int32Array;
  edgeNext: Int32Array;
} => {
  const view = subgraph(coll);
  const { endpoints, index, nodeSlots } = view;
  const directed = options.directed === true;
  const weightOf = weightAt(view, options.weight);

  const n = nodeSlots.length;
  const nsq = n * n;
  const dist = new Float64Array(nsq).fill(Infinity);
  const next = new Int32Array(nsq).fill(-1); // dense index
  const edgeNext = new Int32Array(nsq).fill(-1); // edge slot

  for (let i = 0; i < n; i++) {
    dist[i * n + i] = 0;
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

    const w = weightOf(e);
    const st = s * n + t;

    // parallel edges: keep the lightest
    if (dist[st] > w) {
      dist[st] = w;
      next[st] = t;
      edgeNext[st] = e;
    }

    if (!directed) {
      const ts = t * n + s;

      if (dist[ts] > w) {
        dist[ts] = w;
        next[ts] = s;
        edgeNext[ts] = e;
      }
    }
  }

  return { view, n, dist, next, edgeNext };
};

/**
 * Wrap relaxed matrices as the public `{ distance, path }` accessors —
 * shared by both executors (the GPU path hands read-back f32/i32
 * arrays here).
 *
 * @param coll — the calling collection
 * @param view — the subgraph view the matrices were built from
 * @param n — the node count
 * @param dist — the relaxed distances, row-major
 * @param next — the dense-index successor matrix
 * @param edgeNext — the representative-edge matrix from init
 * @returns the result object
 */
export const floydWarshallResultFrom = (
  coll: Collection,
  view: SubgraphView,
  n: number,
  dist: ArrayLike<number>,
  next: ArrayLike<number>,
  edgeNext: ArrayLike<number>,
): FloydWarshallResult => {
  const { cy, store, nodeSlots } = view;

  const denseOf = (node: Collection, name: string): number | undefined => {
    const slot = firstNodeSlot(view, node, name);

    return slot == null ? undefined : view.index.get(slot);
  };

  return {
    distance(from: Collection, to: Collection): number | undefined {
      const i = denseOf(from, 'from');
      const j = denseOf(to, 'to');

      return i == null || j == null ? undefined : dist[i * n + j];
    },

    path(from: Collection, to: Collection): Collection {
      let i = denseOf(from, 'from');
      const j = denseOf(to, 'to');

      if (i == null || j == null) {
        return cy.collection();
      }

      if (i === j) {
        return cy._ele(GROUP_NODES, nodeSlots[i]);
      }

      if (next[i * n + j] < 0) {
        return cy.collection();
      }

      const refs: Ref[] = [store.ref(GROUP_NODES, nodeSlots[i])];

      while (i !== j) {
        const prev = i;

        i = next[i * n + j] as number;
        refs.push(store.ref(GROUP_EDGES, edgeNext[prev * n + i] as number));
        refs.push(store.ref(GROUP_NODES, nodeSlots[i]));
      }

      return coll._spawn(refs);
    },
  };
};

/**
 * The O(n³) relaxation both the CPU reference and the CPU side of the
 * closeness family run: relax `dist` (and the successor matrix) in
 * place over every intermediate k.  Extracted from `floydWarshall` in
 * round 69 so closeness centrality can share the loop rather than
 * paying the accessor-per-pair cost of reading distances back through
 * the public result.
 *
 * @param n — the node count
 * @param dist — the row-major distance matrix from `initFloydWarshall`
 * @param next — the dense-index successor matrix, relaxed alongside
 */
export const relaxFloydWarshall = (
  n: number,
  dist: Float64Array,
  next: Int32Array,
): void => {
  // the loop is `floydWarshallKernel` (`algo-kernels.mts`) since 129.1
  // — the one function the in-thread reference and the offload lane
  // run; this is its in-place spelling for the callers that hold the
  // matrices (the closeness family's weighted route)
  floydWarshallKernel({ n, dist, next });
};

/** All-pairs shortest paths over the calling collection (dense N² matrices). */
export const floydWarshall = (
  coll: Collection,
  options: FloydWarshallOptions = {},
): FloydWarshallResult => inThread(floydWarshallLane(coll, options));
