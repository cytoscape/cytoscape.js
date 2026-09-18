/*
Triangle counting, local clustering coefficients and transitivity
(round 69) — the first family designed matmul-first for the GPU
executor tier: the whole computation is A² ∘ A over the 0/1 adjacency,
which is the same compute-bound dense product Markov clustering leads
the benchmark with.

Triangles are an undirected notion, so the family reads the collection
as a simple undirected graph: edge direction is ignored, parallel
edges collapse to one adjacency, and loops are excluded.  There is no
v3 counterpart — this API is v4's own.
*/

import type { Collection } from '../collection.mjs';
import { subgraph, firstNodeSlot } from './algo-shared.mjs';
import type { SubgraphView } from './algo-shared.mjs';
import {
  GPU_MIN_EDGES_PER_NODE,
  GPU_MIN_N,
  OFFLOAD_MIN_N,
  inThread,
  resolveExecutor,
  runAlgo,
} from './executor.mjs';
import type { AlgoExecutor, OffloadLane } from './executor.mjs';
import type { AlgoRun } from './cancel.mjs';
import { triangleCountGpu } from './algo-gpu-triangles.mjs';
import { listsToCsr } from './algo-kernels.mjs';

/**
 * The node count from which `'auto'` counts triangles on one pool
 * worker rather than in-thread (129.1).  Measured 2026-09-18 (sparse
 * fixture, i9-9900K): 0.8 / 1.4 / 2.9 ms in-thread at n = 2048 / 4096
 * / 8192 — the sorted-intersection walk is O(Σ deg²), cheap on a sparse
 * graph however large — so the lane opens at the size where the run
 * nears a quarter frame; a dense graph takes the GPU before that.
 */
export const TRIANGLES_OFFLOAD_MIN_N = 8192;

export interface TriangleCountOptions {
  /** where the run executes; see `AlgoExecutor` (default 'auto').
   * 'auto' routes to the GPU only on graphs dense enough that the
   * O(n³) matmul beats the CPU's O(Σ deg²) sparse walk. */
  executor?: AlgoExecutor;
}

export interface TriangleCountResult {
  /** how many triangles pass through the node */
  triangles(node: Collection): number | undefined;
  /** 2T / (deg · (deg − 1)) — the local clustering coefficient */
  clusteringCoefficient(node: Collection): number | undefined;
  /** distinct triangles in the collection */
  totalTriangles: number;
  /** 3 · triangles / connected triples — the global coefficient */
  transitivity: number;
}

/**
 * The simple undirected adjacency both executors count over: per-node
 * sorted dense-index neighbor lists, deduped (parallel edges collapse,
 * loops and out-of-collection endpoints drop), plus the degree array
 * the coefficient formulas read.
 *
 * @param view — the subgraph view
 * @returns sorted neighbor lists and degrees, plus the deduped
 *   undirected edge count the density gate reads
 */
export const buildTriangleAdjacency = (
  view: SubgraphView,
): { neighbors: Int32Array[]; degrees: Int32Array; edges: number } => {
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

    sets[s].add(t);
    sets[t].add(s);
  }

  const neighbors: Int32Array[] = new Array(n);
  const degrees = new Int32Array(n);
  let twice = 0;

  for (let i = 0; i < n; i++) {
    neighbors[i] = Int32Array.from(sets[i]).sort();
    degrees[i] = neighbors[i].length;
    twice += degrees[i];
  }

  return { neighbors, degrees, edges: twice / 2 };
};

/**
 * Wrap per-node triangle counts as the public result — shared by both
 * executors (the GPU hands counts recovered from its read-back row
 * products through here).
 *
 * @param view — the subgraph view the counts were computed from
 * @param degrees — deduped undirected degrees, by dense index
 * @param triangles — triangles through each node, by dense index
 * @returns the result object
 */
export const triangleResultFrom = (
  view: SubgraphView,
  degrees: Int32Array,
  triangles: Float64Array,
): TriangleCountResult => {
  const n = degrees.length;
  let triangleSum = 0;
  let triples = 0;

  for (let i = 0; i < n; i++) {
    triangleSum += triangles[i];
    triples += (degrees[i] * (degrees[i] - 1)) / 2;
  }

  // every triangle passes through three nodes
  const totalTriangles = triangleSum / 3;

  const denseOf = (node: Collection): number | undefined => {
    const slot = firstNodeSlot(view, node, 'node');

    return slot == null ? undefined : view.index.get(slot);
  };

  return {
    triangles(node: Collection): number | undefined {
      const i = denseOf(node);

      return i == null ? undefined : triangles[i];
    },

    clusteringCoefficient(node: Collection): number | undefined {
      const i = denseOf(node);

      if (i == null) {
        return undefined;
      }

      const pairs = (degrees[i] * (degrees[i] - 1)) / 2;

      return pairs === 0 ? 0 : triangles[i] / pairs;
    },

    totalTriangles,
    transitivity: triples === 0 ? 0 : triangleSum / triples,
  };
};

/**
 * The async triangle-counting entry point behind `eles.triangleCount()`:
 * validates `executor` synchronously, then routes to the CPU reference
 * implementation or the WGSL matmul kernels.
 *
 * @param coll — the calling collection
 * @param options — `{ executor }`
 * @returns a promise of the triangle/coefficient accessors
 * @throws if `executor` is not 'cpu', 'gpu' or 'auto'
 */
export const triangleCountAsync = (
  coll: Collection,
  options: TriangleCountOptions = {},
): AlgoRun<TriangleCountResult> => {
  const executor = resolveExecutor(options.executor);
  const view = subgraph(coll);
  const adjacency = buildTriangleAdjacency(view);
  const n = view.nodeSlots.length;

  // the CPU walk is O(Σ deg²) where the matmul is O(n³) regardless, so
  // 'auto' takes the GPU only on graphs dense enough for the cubic
  // side to win — measured in 72.6 as a mean degree, not a share of
  // n²: E ≥ 32·n (triangles 1.7× / 1.7× / 1.2× GPU at n = 512 / 1024
  // / 2048 there, 0.8× / 0.8× / 0.5× one step sparser).  Sparse
  // graphs stay on the CPU however large they are.
  const dense = adjacency.edges >= GPU_MIN_EDGES_PER_NODE * n;

  const lane = triangleLane(view, adjacency);

  return runAlgo(
    executor,
    n,
    dense ? GPU_MIN_N : Infinity,
    () => inThread(lane),
    (ctx) => triangleCountGpu(ctx, view, adjacency),
    undefined,
    null,
    lane,
  );
};

/**
 * Triangle counting's offload lane (129.1): the snapshot built here — every
 * closure evaluated on this thread — the maths as `triangleKernel`
 * (`algo-kernels.mts`), run in this thread under `'cpu'` and on one
 * pool worker under `'auto'` / `'workers'`, and the public result over
 * whichever answered.  One function on both sides, so the two agree
 * bit for bit.
 *
 * @param view — the subgraph view
 * @param adjacency — from `buildTriangleAdjacency`
 * @returns the lane
 */
export const triangleLane = (
  view: SubgraphView,
  adjacency: { neighbors: Int32Array[]; degrees: Int32Array },
): OffloadLane<TriangleCountResult> => ({
  minN: TRIANGLES_OFFLOAD_MIN_N,
  snapshot: () => {
    const { rowPtr, colIdx } = listsToCsr(adjacency.neighbors);

    return {
      kind: 'kernel',
      name: 'triangles',
      input: { n: adjacency.degrees.length, rowPtr, colIdx },
    };
  },
  wrap: (out) =>
    triangleResultFrom(view, adjacency.degrees, out.triangles as Float64Array),
});

/**
 * The CPU reference: for every edge (u, v) with u < v, walk the sorted
 * neighbor lists' intersection counting the w > v that close a
 * triangle — each triangle is found exactly once, at its sorted (u, v)
 * edge, and credits all three corners.  The walk is `triangleKernel`
 * (`algo-kernels.mts`) since 129.1.
 *
 * @param view — the subgraph view
 * @param adjacency — from `buildTriangleAdjacency`
 * @returns the triangle/coefficient accessors
 */
export const triangleCount = (
  view: SubgraphView,
  adjacency: { neighbors: Int32Array[]; degrees: Int32Array },
): TriangleCountResult => inThread(triangleLane(view, adjacency));
