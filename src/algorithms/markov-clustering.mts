// Markov clustering (MCL) — a port of v3's pass on dense Float64 matrices.

import type { Collection } from '../collection.mjs';
import { subgraph } from './algo-shared.mjs';
import type { SubgraphView } from './algo-shared.mjs';
import { inThread, resolveExecutor, runAlgo } from './executor.mjs';
import type { AlgoExecutor, OffloadLane } from './executor.mjs';
import type { AlgoRun } from './cancel.mjs';
import { markovClusteringGpu } from './algo-gpu-mcl.mjs';

/**
 * The node count from which `'auto'` iterates MCL on one pool worker
 * rather than in-thread (129.1).  Measured 2026-09-18 (i9-9900K): 1.1
 * / 11.9 / 79.6 / 593 ms in-thread at n = 32 / 64 / 128 / 256 (a dense
 * matrix product per iteration), the thread held 0.3 / 0.7 / 0.0 /
 * 0.0 ms of those under the lane.
 * Stamped 2026-09-18 from the `algorithms-workers` offload rows
 * (i9-9900K, one worker; the rule: the smallest size whose in-thread
 * run reaches ~4 ms, a quarter frame — a shorter run blocks nothing
 * perceptible, and the lane's clone-and-wake is 0.2–0.6 ms).
 */
export const MARKOV_OFFLOAD_MIN_N = 64;
import { GROUP_EDGES, GROUP_NODES } from '../contract.mjs';

/** A similarity function: maps an edge to a numeric contribution. */
export type MarkovAttributeFn = (edge: Collection) => number;

export interface MarkovClusteringOptions {
  expandFactor?: number;
  inflateFactor?: number;
  multFactor?: number;
  maxIterations?: number;
  attributes?: MarkovAttributeFn[];
  /** where the run executes; see `AlgoExecutor` (default 'auto') */
  executor?: AlgoExecutor;
}

const normalize = (M: Float64Array, n: number): void => {
  for (let col = 0; col < n; col++) {
    let sum = 0;

    for (let row = 0; row < n; row++) {
      sum += M[row * n + col];
    }

    for (let row = 0; row < n; row++) {
      M[row * n + col] = M[row * n + col] / sum;
    }
  }
};

/**
 * The async MCL entry point behind `eles.markovClustering()`: validates
 * `executor` synchronously (so a bad value throws at the call site),
 * then routes to the CPU reference implementation or the WGSL
 * kernels.
 *
 * @param coll — the calling collection
 * @param options — as `markovClustering`, plus `executor`
 * @returns a promise of the clusters
 * @throws if `executor` is not 'cpu', 'gpu' or 'auto'
 */
export const markovClusteringAsync = (
  coll: Collection,
  options: MarkovClusteringOptions = {},
): AlgoRun<Collection[]> => {
  const executor = resolveExecutor(options.executor);
  const n = subgraph(coll).nodeSlots.length;

  // measured crossover (65.8, amd gcn-4): 70x GPU at n=256 and n^3
  // growth put the wash near n=128
  const lane = markovLane(coll, options);

  return runAlgo(
    executor,
    n,
    128,
    () => inThread(lane),
    (ctx) => markovClusteringGpu(ctx, coll, options),
    undefined,
    null,
    lane,
  );
};

/**
 * Markov clustering's offload lane (129.1): the snapshot built here — every
 * closure evaluated on this thread — the maths as `markovKernel`
 * (`algo-kernels.mts`), run in this thread under `'cpu'` and on one
 * pool worker under `'auto'` / `'workers'`, and the public result over
 * whichever answered.  One function on both sides, so the two agree
 * bit for bit.
 *
 * @param coll — the calling collection
 * @param options — the caller's options
 * @returns the lane
 */
export const markovLane = (
  coll: Collection,
  options: MarkovClusteringOptions,
): OffloadLane<Collection[]> => {
  let built: ReturnType<typeof buildMarkovMatrix> | null = null;

  return {
    minN: MARKOV_OFFLOAD_MIN_N,
    snapshot: () => {
      built = buildMarkovMatrix(coll, options);

      return {
        kind: 'kernel',
        name: 'markov',
        input: {
          n: built.n,
          M: built.M,
          expandFactor: options.expandFactor ?? 2,
          inflateFactor: options.inflateFactor ?? 2,
          maxIterations: options.maxIterations ?? 20,
        },
      };
    },
    wrap: (out) => {
      const { view, n } = built as ReturnType<typeof buildMarkovMatrix>;

      return markovClustersFrom(coll, view, out.M as Float64Array, n);
    },
  };
};

/**
 * Build MCL's initial column-stochastic matrix from the subgraph —
 * shared by the CPU reference and the GPU path, so both executors
 * iterate from the identical (f64) starting matrix.
 *
 * @param coll — the calling collection
 * @param options — the caller's options (attributes, multFactor)
 * @returns the view, the node count and the normalized matrix
 */
export const buildMarkovMatrix = (
  coll: Collection,
  options: MarkovClusteringOptions,
): { view: SubgraphView; n: number; M: Float64Array } => {
  const multFactor = options.multFactor ?? 1;
  const attributes: MarkovAttributeFn[] = options.attributes ?? [() => 1];

  const view = subgraph(coll);
  const { cy, endpoints, index, nodeSlots } = view;
  const n = nodeSlots.length;

  // stochastic matrix from the (symmetric, undirected) input graph
  const M = new Float64Array(n * n);

  for (const e of view.edgeSlots) {
    const i = index.get(endpoints[e * 2]);
    const j = index.get(endpoints[e * 2 + 1]);

    if (i == null || j == null) {
      continue;
    }

    let sim = 0;
    const edge = cy._ele(GROUP_EDGES, e);

    for (const attr of attributes) {
      sim += attr(edge);
    }

    M[i * n + j] += sim;
    M[j * n + i] += sim;
  }

  // self loops (multFactor on the diagonal), then normalize
  for (let i = 0; i < n; i++) {
    M[i * n + i] = multFactor;
  }

  normalize(M, n);

  return { view, n, M };
};

/**
 * Extract MCL's clusters from a converged matrix: row-wise attractors
 * and their attracted nodes, de-duplicated by member set.  Shared by
 * both executors (the GPU path hands a read-back Float32Array here).
 *
 * @param coll — the calling collection
 * @param view — the subgraph view the matrix was built from
 * @param M — the converged matrix, row-major n-by-n
 * @param n — the node count
 * @returns one collection per attractor row
 */
export const markovClustersFrom = (
  coll: Collection,
  view: SubgraphView,
  M: ArrayLike<number>,
  n: number,
): Collection[] => {
  const clusters: Collection[] = [];
  const seen = new Set<string>(); // dedupe symmetric duplicates by member key

  for (let i = 0; i < n; i++) {
    const cluster: number[] = [];

    for (let j = 0; j < n; j++) {
      if (Math.round(M[i * n + j] * 1000) / 1000 > 0) {
        cluster.push(j);
      }
    }

    if (cluster.length === 0) {
      continue;
    }

    const key = cluster.join(',');

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    clusters.push(
      coll._spawnLive(
        cluster.map((di) => view.store.ref(GROUP_NODES, view.nodeSlots[di])),
      ),
    );
  }

  return clusters;
};

/**
 * Markov clustering (MCL) over the calling collection.  Unlike the
 * attribute-space clusterers this one is a graph algorithm: it builds a
 * column-stochastic matrix from the subgraph's edges (treated as
 * undirected — each edge contributes to both entries), adds `multFactor`
 * self loops on the diagonal, then alternates expansion and inflation
 * until the matrix stops changing to four decimal places or
 * `maxIterations` passes.  The matrix is dense N-by-N and expansion
 * multiplies it, so cost is cubic in node count per iteration.  The
 * loop is `markovKernel` (`algo-kernels.mts`) since 129.1.
 *
 * @param coll — the calling collection; only edges inside it contribute
 * @param options — `expandFactor` (matrix power, default 2),
 *   `inflateFactor` (element-wise power, default 2), `multFactor`
 *   (diagonal self-loop weight, default 1), `maxIterations`, and
 *   `attributes`, summed per edge for the similarity (default: 1 each)
 * @returns one collection per attractor row, de-duplicated by member set
 */
export const markovClustering = (
  coll: Collection,
  options: MarkovClusteringOptions = {},
): Collection[] => inThread(markovLane(coll, options));
