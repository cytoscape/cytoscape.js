import type { Collection } from '../collection.mjs';
import type { Ref } from '../contract.mjs';
import { subgraph, firstNodeSlot, weightAt } from './algo-shared.mjs';
import type { SubgraphView, WeightFn } from './algo-shared.mjs';
import { GPU_MIN_N, resolveExecutor, runAlgo } from './executor.mjs';
import type { AlgoExecutor } from './executor.mjs';
import { floydWarshallGpu } from './algo-gpu-fw.mjs';

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
): Promise<FloydWarshallResult> => {
  const executor = resolveExecutor(options.executor);
  const n = subgraph(coll).nodeSlots.length;

  // measured crossover (65.8, amd gcn-4): 3.4x GPU at n=256 already
  // (28x at n=1024, blocked) — the default threshold is the measured
  // one
  return runAlgo(
    executor,
    n,
    GPU_MIN_N,
    () => floydWarshall(coll, options),
    (ctx) => floydWarshallGpu(ctx, coll, options),
  );
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
        return cy._ele('nodes', nodeSlots[i]);
      }

      if (next[i * n + j] < 0) {
        return cy.collection();
      }

      const refs: Ref[] = [store.ref('nodes', nodeSlots[i])];

      while (i !== j) {
        const prev = i;

        i = next[i * n + j] as number;
        refs.push(store.ref('edges', edgeNext[prev * n + i] as number));
        refs.push(store.ref('nodes', nodeSlots[i]));
      }

      return coll._spawn(refs);
    },
  };
};

/** All-pairs shortest paths over the calling collection (dense N² matrices). */
export const floydWarshall = (
  coll: Collection,
  options: FloydWarshallOptions = {},
): FloydWarshallResult => {
  const { view, n, dist, next, edgeNext } = initFloydWarshall(coll, options);

  for (let k = 0; k < n; k++) {
    const kn = k * n;

    for (let i = 0; i < n; i++) {
      const rowI = i * n;
      const ik = rowI + k;
      const dik = dist[ik];

      // Infinity relaxes nothing (Inf + x is never < anything finite or
      // not), so an unreachable (i, k) pair skips its whole j row — a
      // real win on sparse graphs early in k, and a no-op otherwise.
      if (dik === Infinity) {
        continue;
      }

      // dist[ik] is loop-invariant across j: the only ij aliasing ik is
      // j === k, where the update needs dist[kk] < 0 — a negative cycle,
      // on which Floyd–Warshall is undefined either way (v3 reloads and
      // is equally undefined there).  Running ij/kj indices replace the
      // two per-iteration multiplies, and the sum is computed once.
      for (let j = 0, ij = rowI, kj = kn; j < n; j++, ij++, kj++) {
        const alt = dik + dist[kj];

        if (alt < dist[ij]) {
          dist[ij] = alt;
          next[ij] = next[ik];
        }
      }
    }
  }

  return floydWarshallResultFrom(coll, view, n, dist, next, edgeNext);
};
