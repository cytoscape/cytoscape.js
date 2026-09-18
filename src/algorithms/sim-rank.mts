/*
SimRank (round 70) — "two nodes are similar when their neighbors are
similar": the Jeh–Widom fixed point

  s(a, b) = C / (|I(a)|·|I(b)|) · Σ_{i∈I(a)} Σ_{j∈I(b)} s(i, j)

with s(a, a) = 1 and s = 0 where either neighborhood is empty.  In
matrix form one iteration is S′ = C·Q·S·Qᵀ with the diagonal pinned
to 1, where Q is the row-normalized neighborhood matrix — two dense
products per iteration, which is what puts the family on the GPU
matmul tier beside MCL.

Neighborhoods follow the library's family conventions: deduped simple
adjacency, loops excluded; the undirected default reads all neighbors,
`directed: true` reads the classic in-neighbors.  The result is
all-pairs (O(n²) memory, like `floydWarshall`).  No v3 counterpart.
*/

import type { Collection } from '../collection.mjs';
import { subgraph, firstNodeSlot } from './algo-shared.mjs';
import type { SubgraphView } from './algo-shared.mjs';
import {
  GPU_MIN_N,
  OFFLOAD_MIN_N,
  inThread,
  resolveExecutor,
  runAlgo,
} from './executor.mjs';
import type { AlgoExecutor, OffloadLane } from './executor.mjs';
import type { AlgoRun } from './cancel.mjs';
import { simRankGpu } from './algo-gpu-simrank.mjs';
import { listsToCsr } from './algo-kernels.mjs';

/**
 * The node count from which `'auto'` iterates SimRank on one pool
 * worker rather than in-thread (129.1).  Measured 2026-09-18
 * (i9-9900K): 1.4 / 6.3 / 25.0 / 80.1 ms in-thread at n = 64 / 128 /
 * 256 / 512, the thread held 0.8 / 0.4 / 0.0 / 0.0 ms of those under
 * the lane.
 * Stamped 2026-09-18 from the `algorithms-workers` offload rows
 * (i9-9900K, one worker; the rule: the smallest size whose in-thread
 * run reaches ~4 ms, a quarter frame — a shorter run blocks nothing
 * perceptible, and the lane's clone-and-wake is 0.2–0.6 ms).
 */
export const SIM_RANK_OFFLOAD_MIN_N = OFFLOAD_MIN_N;

export interface SimRankOptions {
  /** the decay per neighborhood step (default 0.8); must sit in (0, 1) */
  dampingFactor?: number;
  /** iteration cap when the tolerance is never met (default 50) */
  maxIterations?: number;
  /** stop once max |Δs| ≤ tolerance (default 1e-4) */
  tolerance?: number;
  /** compare in-neighborhoods (the classic form) instead of undirected ones */
  directed?: boolean;
  /** where the run executes; see `AlgoExecutor` (default 'auto').
   * 'auto' takes the GPU from `GPU_MIN_N` nodes at any density
   * (72.6: the products beat the per-pair CPU iteration everywhere). */
  executor?: AlgoExecutor;
}

export interface SimRankResult {
  /** the pair's SimRank score in [0, 1], or undefined when either
   * node is outside the collection */
  similarity(a: Collection, b: Collection): number | undefined;
}

/**
 * Validate `dampingFactor` — called synchronously by the async entry,
 * so a bad value throws at the call site rather than surfacing later
 * as a rejection.
 *
 * @param options — the caller's options
 * @returns the resolved damping factor (0.8 when omitted)
 * @throws if the value is not a number strictly between 0 and 1
 */
export const resolveSimRankDamping = (options: SimRankOptions): number => {
  const c = options.dampingFactor ?? 0.8;

  if (!(c > 0 && c < 1)) {
    throw new TypeError(
      '`dampingFactor` must sit strictly between 0 and 1 — got ' +
        String(options.dampingFactor),
    );
  }

  return c;
};

/**
 * The deduped neighborhoods both executors iterate over: per-node
 * dense-index lists (in-neighbors under `directed`, all neighbors
 * otherwise; parallel edges collapse, loops and out-of-collection
 * endpoints drop).
 *
 * @param view — the subgraph view
 * @param directed — use in-neighborhoods only
 * @returns the lists plus the total adjacency count the density gate
 *   reads
 */
export const buildSimRankNeighborhoods = (
  view: SubgraphView,
  directed: boolean,
): { inLists: Int32Array[]; adjacencies: number } => {
  const { endpoints, index, nodeSlots } = view;
  const n = nodeSlots.length;
  const sets: Set<number>[] = new Array(n);

  for (let i = 0; i < n; i++) {
    sets[i] = new Set();
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

    sets[t].add(s); // s is an in-neighbor of t

    if (!directed) {
      sets[s].add(t);
    }
  }

  const inLists: Int32Array[] = new Array(n);
  let adjacencies = 0;

  for (let i = 0; i < n; i++) {
    inLists[i] = Int32Array.from(sets[i]);
    adjacencies += inLists[i].length;
  }

  return { inLists, adjacencies };
};

/**
 * Wrap a converged score matrix as the public `{ similarity }`
 * accessor — shared by both executors.
 *
 * @param view — the subgraph view the matrix was computed from
 * @param scores — the row-major SimRank matrix
 * @returns the result object
 */
export const simRankResultFrom = (
  view: SubgraphView,
  scores: ArrayLike<number>,
): SimRankResult => {
  const n = view.nodeSlots.length;

  const denseOf = (node: Collection, name: string): number | undefined => {
    const slot = firstNodeSlot(view, node, name);

    return slot == null ? undefined : view.index.get(slot);
  };

  return {
    similarity(a: Collection, b: Collection): number | undefined {
      const i = denseOf(a, 'a');
      const j = denseOf(b, 'b');

      return i == null || j == null ? undefined : scores[i * n + j];
    },
  };
};

/**
 * The async SimRank entry point behind `eles.simRank()`: validates
 * `executor` and `dampingFactor` synchronously, then routes to the
 * CPU reference implementation or the WGSL matmul kernels.
 *
 * @param coll — the calling collection
 * @param options — `{ dampingFactor, maxIterations, tolerance,
 *   directed, executor }`
 * @returns a promise of the `{ similarity }` accessor
 * @throws if `executor` or `dampingFactor` is invalid
 */
export const simRankAsync = (
  coll: Collection,
  options: SimRankOptions = {},
): AlgoRun<SimRankResult> => {
  const executor = resolveExecutor(options.executor);

  resolveSimRankDamping(options); // an invalid damping throws at the call site

  const directed = options.directed === true;
  const view = subgraph(coll);
  const hoods = buildSimRankNeighborhoods(view, directed);
  const n = view.nodeSlots.length;

  // round 70 gated this on density like the triangle family; the
  // 72.6 sweep found the GPU ahead at every density — 4.1× / 6.1× /
  // 9.6× at n = 256 / 512 / 1024 on the sparsest fixture (E = n/2),
  // 40× / 98× / 197× on the densest — so 'auto' takes the GPU on size
  // alone.  (The CPU's O(n·m) per step is per *pair*, n² of them.)
  const lane = simRankLane(view, hoods, options);

  return runAlgo(
    executor,
    n,
    GPU_MIN_N,
    () => inThread(lane),
    (ctx) => simRankGpu(ctx, view, hoods, options),
    undefined,
    null,
    lane,
  );
};

/**
 * SimRank's offload lane (129.1): the snapshot built here — every
 * closure evaluated on this thread — the maths as `simRankKernel`
 * (`algo-kernels.mts`), run in this thread under `'cpu'` and on one
 * pool worker under `'auto'` / `'workers'`, and the public result over
 * whichever answered.  One function on both sides, so the two agree
 * bit for bit.
 *
 * @param view — the subgraph view
 * @param hoods — from `buildSimRankNeighborhoods`
 * @param options — the caller's options
 * @returns the lane
 * @throws if `dampingFactor` is invalid (see `resolveSimRankDamping`)
 */
export const simRankLane = (
  view: SubgraphView,
  hoods: { inLists: Int32Array[] },
  options: SimRankOptions = {},
): OffloadLane<SimRankResult> => ({
  minN: SIM_RANK_OFFLOAD_MIN_N,
  snapshot: () => {
    const c = resolveSimRankDamping(options);
    const { rowPtr, colIdx } = listsToCsr(hoods.inLists);

    return {
      kind: 'kernel',
      name: 'simRank',
      input: {
        n: hoods.inLists.length,
        inPtr: rowPtr,
        inIdx: colIdx,
        c,
        maxIterations: options.maxIterations ?? 50,
        tolerance: options.tolerance ?? 0.0001,
      },
    };
  },
  wrap: (out) => simRankResultFrom(view, out.scores as Float64Array),
});

/**
 * The CPU reference: the same fixed point iterated sparsely — Q·S as
 * per-row neighbor sums, (Q·S)·Qᵀ as per-column neighbor sums, both
 * O(n·m) per iteration — from S⁰ = I, stopping once max |Δs| drops
 * under `tolerance` or `maxIterations` runs out.  The loop is
 * `simRankKernel` (`algo-kernels.mts`) since 129.1.
 *
 * @param view — the subgraph view
 * @param hoods — from `buildSimRankNeighborhoods`
 * @param options — the caller's options
 * @returns the `{ similarity }` accessor
 * @throws if `dampingFactor` is invalid (see `resolveSimRankDamping`)
 */
export const simRank = (
  view: SubgraphView,
  hoods: { inLists: Int32Array[] },
  options: SimRankOptions = {},
): SimRankResult => inThread(simRankLane(view, hoods, options));
