// Affinity propagation clustering — a port of v3's pass on dense matrices.

import type { Collection } from '../collection.mjs';
import { median, mean, min, max } from '../math.mjs';
import { clusteringDistance } from './clustering-distances.mjs';
import type { DistanceMetric } from './clustering-distances.mjs';
import { inThread, resolveExecutor, runAlgo } from './executor.mjs';
import type { AlgoExecutor, OffloadLane } from './executor.mjs';
import type { AlgoRun } from './cancel.mjs';
import { affinityPropagationGpu } from './algo-gpu-ap.mjs';

/**
 * The node count from which `'auto'` passes AP's messages on one pool
 * worker rather than in-thread (129.1).  Measured 2026-09-18
 * (i9-9900K): 3.6 / 13.5 / 47.2 / 186 / 989 ms in-thread at n = 16 /
 * 32 / 64 / 128 / 256 (two dense n² passes per iteration, hundreds of
 * iterations), the thread held 0.6 / 0.1 / 0.0 / 0.0 / 0.0 ms of those
 * under the lane.
 * Stamped 2026-09-18 from the `algorithms-workers` offload rows
 * (i9-9900K, one worker; the rule: the smallest size whose in-thread
 * run reaches ~4 ms, a quarter frame — a shorter run blocks nothing
 * perceptible, and the lane's clone-and-wake is 0.2–0.6 ms).
 */
export const AFFINITY_OFFLOAD_MIN_N = 32;

export type AffinityAttributeFn = (node: Collection) => number;
export type AffinityPreference = 'median' | 'mean' | 'min' | 'max' | number;

export interface AffinityPropagationOptions {
  distance?: DistanceMetric;
  preference?: AffinityPreference;
  damping?: number;
  maxIterations?: number;
  minIterations?: number;
  attributes?: AffinityAttributeFn[];
  /** where the run executes; see `AlgoExecutor` (default 'auto') */
  executor?: AlgoExecutor;
}

/** Named-metric code for the tight build loop: 0 euclidean,
 * 1 squaredEuclidean, 2 manhattan, 3 max (unknown → euclidean, as
 * `resolveDistance` falls back). */
const resolveMetricKind = (distance: DistanceMetric): number => {
  switch (distance) {
    case 'squaredEuclidean':
    case 'squared-euclidean':
    case 'squaredeuclidean':
      return 1;
    case 'manhattan':
      return 2;
    case 'max':
      return 3;
    default:
      return 0;
  }
};

const getPreference = (
  S: Float64Array,
  preference: AffinityPreference,
): number => {
  if (preference === 'median') {
    return median(S);
  }
  if (preference === 'mean') {
    return mean(S);
  }
  if (preference === 'min') {
    return min(S);
  }
  if (preference === 'max') {
    return max(S);
  }

  return preference; // custom number
};

const assignClusters = (
  n: number,
  S: Float64Array,
  exemplars: number[],
): number[] => {
  const clusters: number[] = [];

  for (let i = 0; i < n; i++) {
    let index = -1;
    let maxS = -Infinity;

    for (let ei = 0; ei < exemplars.length; ei++) {
      const e = exemplars[ei];

      if (S[i * n + e] > maxS) {
        index = e;
        maxS = S[i * n + e];
      }
    }

    if (index > 0) {
      clusters.push(index);
    }
  }

  for (let ei = 0; ei < exemplars.length; ei++) {
    clusters[exemplars[ei]] = exemplars[ei];
  }

  return clusters;
};

const assign = (n: number, S: Float64Array, exemplars: number[]): number[] => {
  let clusters = assignClusters(n, S, exemplars);

  for (let ei = 0; ei < exemplars.length; ei++) {
    const ii: number[] = [];

    for (let c = 0; c < clusters.length; c++) {
      if (clusters[c] === exemplars[ei]) {
        ii.push(c);
      }
    }

    let maxI = -1;
    let maxSum = -Infinity;

    for (let i = 0; i < ii.length; i++) {
      let sum = 0;

      for (let j = 0; j < ii.length; j++) {
        sum += S[ii[j] * n + ii[i]];
      }

      if (sum > maxSum) {
        maxI = i;
        maxSum = sum;
      }
    }

    exemplars[ei] = ii[maxI];
  }

  clusters = assignClusters(n, S, exemplars);

  return clusters;
};

/**
 * The async affinity-propagation entry point behind
 * `eles.affinityPropagation()`: validates `executor` synchronously,
 * then routes to the CPU reference implementation or the WGSL
 * kernels.
 *
 * @param coll — the calling collection
 * @param options — as `affinityPropagation`, plus `executor`
 * @returns a promise of the clusters
 * @throws if `executor` is not 'cpu', 'gpu' or 'auto'
 */
export const affinityPropagationAsync = (
  coll: Collection,
  options: AffinityPropagationOptions = {},
): AlgoRun<Collection[]> => {
  const executor = resolveExecutor(options.executor);
  const n = coll.nodes().length;

  // measured crossover (65.8, amd gcn-4): workgroup-per-line updates
  // and the shared-build fix moved it left — 2.5x at n=256, 3.8x at
  // n=1024 (iteration-capped rows)
  const lane = affinityLane(coll, options);

  return runAlgo(
    executor,
    n,
    256,
    () => inThread(lane),
    (ctx) => affinityPropagationGpu(ctx, coll, options),
    undefined,
    null,
    lane,
  );
};

/**
 * Affinity propagation's offload lane (129.1): the snapshot built here — every
 * closure evaluated on this thread — the maths as `affinityKernel`
 * (`algo-kernels.mts`), run in this thread under `'cpu'` and on one
 * pool worker under `'auto'` / `'workers'`, and the public result over
 * whichever answered.  One function on both sides, so the two agree
 * bit for bit.
 *
 * @param coll — the calling collection
 * @param options — the caller's options
 * @returns the lane
 * @throws if `damping` or `preference` is invalid (at the snapshot;
 *   see `buildAffinitySimilarity`)
 */
export const affinityLane = (
  coll: Collection,
  options: AffinityPropagationOptions,
): OffloadLane<Collection[]> => {
  let built: ReturnType<typeof buildAffinitySimilarity> | null = null;

  return {
    minN: AFFINITY_OFFLOAD_MIN_N,
    snapshot: () => {
      built = buildAffinitySimilarity(coll, options);

      return {
        kind: 'kernel',
        name: 'affinity',
        input: {
          n: built.n,
          S: built.S,
          damping: built.damping,
          maxIterations: built.maxIterations,
          minIterations: built.minIterations,
        },
      };
    },
    wrap: (out) => {
      const { nodes, n, S } = built as ReturnType<
        typeof buildAffinitySimilarity
      >;

      return apClustersFrom(
        coll,
        nodes,
        n,
        S,
        Array.from(out.exemplars as Int32Array),
      );
    },
  };
};

/**
 * Validate the options and build the similarity matrix S both
 * executors iterate from: pairwise negated distances with the resolved
 * preference on the diagonal.  Attribute callbacks (and any custom
 * distance function) are evaluated here, on the CPU — the GPU path
 * never needs them.
 *
 * @param coll — the calling collection
 * @param options — the caller's options
 * @returns the nodes, node count, matrix, and resolved iteration knobs
 * @throws if `damping` is outside [0.5, 1), or `preference` is neither
 *   a number nor one of 'median' / 'mean' / 'min' / 'max'
 */
export const buildAffinitySimilarity = (
  coll: Collection,
  options: AffinityPropagationOptions,
): {
  nodes: Collection;
  n: number;
  S: Float64Array;
  damping: number;
  maxIterations: number;
  minIterations: number;
} => {
  const damping = options.damping;
  const preference = options.preference;

  // v3 validates the raw options, so damping and preference are effectively required
  if (!(damping != null && 0.5 <= damping && damping < 1)) {
    throw new Error(`Damping must range on [0.5, 1).  Got: ${damping}`);
  }

  const validPrefs = ['median', 'mean', 'min', 'max'];

  if (
    !(
      validPrefs.some((v) => v === preference) || typeof preference === 'number'
    )
  ) {
    throw new Error(
      `Preference must be one of [${validPrefs.map((p) => `'${p}'`).join(', ')}] or a number.  Got: ${preference}`,
    );
  }

  const distance = options.distance ?? 'euclidean';
  const attributes = options.attributes ?? [];

  const nodes = coll.nodes();
  const n = nodes.length;
  const n2 = n * n;
  const d = attributes.length;

  // attribute vectors once per node — the round-18/62.2 rule.  The
  // original build evaluated the accessors per *pair* (n²·d calls),
  // and at n=1024 the build dwarfed the message passing it fed.
  const vecs = new Float64Array(n * d);

  for (let i = 0; i < n; i++) {
    const node = nodes[i];

    for (let k = 0; k < d; k++) {
      vecs[i * d + k] = attributes[k](node);
    }
  }

  // similarity matrix
  const S = new Float64Array(n2).fill(-Infinity);

  if (typeof distance === 'function' || d === 0) {
    // custom metrics keep their duck-typed calling convention (and may
    // be asymmetric, so both triangles are computed)
    let vp = 0;
    let vq = 0;
    const getP = (k: number): number => vecs[vp + k];
    const getQ = (k: number): number => vecs[vq + k];

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i !== j) {
          vp = i * d;
          vq = j * d;
          S[i * n + j] = -clusteringDistance(
            distance,
            d,
            getP,
            getQ,
            nodes[i],
            nodes[j],
          );
        }
      }
    }
  } else {
    // named metrics are symmetric: one tight typed-array pass over the
    // lower triangle, mirrored
    // euclidean over a single attribute is |dx| on the CPU reference
    // (`clustering-distances` skips the sqrt), i.e. manhattan
    const kind0 = resolveMetricKind(distance);
    const kind = kind0 === 0 && d === 1 ? 2 : kind0;

    for (let i = 0; i < n; i++) {
      const pi = i * d;

      for (let j = 0; j < i; j++) {
        const qi = j * d;
        let acc = kind === 3 ? -Infinity : 0;

        for (let k = 0; k < d; k++) {
          const ad = Math.abs(vecs[pi + k] - vecs[qi + k]);

          if (kind === 2) {
            acc += ad;
          } else if (kind === 3) {
            acc = Math.max(acc, ad);
          } else {
            acc += ad * ad;
          }
        }

        // euclidean keeps the reference's 1-D shortcut (no sqrt)
        const dist = kind === 0 && d >= 2 ? Math.sqrt(acc) : acc;

        S[i * n + j] = -dist;
        S[j * n + i] = -dist;
      }
    }
  }

  const p = getPreference(S, preference as AffinityPreference);

  for (let i = 0; i < n; i++) {
    S[i * n + i] = p;
  }

  return {
    nodes,
    n,
    S,
    damping,
    maxIterations: options.maxIterations ?? 1000,
    minIterations: options.minIterations ?? 100,
  };
};

/**
 * Assign every node to its exemplar's cluster and spawn the result
 * collections — the shared tail of both executors.
 *
 * @param coll — the calling collection
 * @param nodes — the clustered nodes, in matrix order
 * @param n — the node count
 * @param S — the similarity matrix from `buildAffinitySimilarity`
 * @param exemplarsIndices — the exemplar rows (R+A diagonal > 0)
 * @returns one collection per exemplar, in exemplar-index order
 */
export const apClustersFrom = (
  coll: Collection,
  nodes: Collection,
  n: number,
  S: Float64Array,
  exemplarsIndices: number[],
): Collection[] => {
  const clusterIndices = assign(n, S, exemplarsIndices);

  const clusters: Record<number, Collection[]> = {};

  for (let c = 0; c < exemplarsIndices.length; c++) {
    clusters[exemplarsIndices[c]] = [];
  }

  for (let i = 0; i < nodes.length; i++) {
    const clusterIndex = clusterIndices[i];

    if (clusterIndex != null) {
      clusters[clusterIndex].push(nodes[i]);
    }
  }

  return exemplarsIndices.map((ei) =>
    coll._spawn(clusters[ei].map((ele) => ele._refs[0])),
  );
};

/**
 * Affinity propagation over the calling collection's nodes.  Like the
 * other attribute-space clusterers it ignores the adjacency: similarity is
 * the negated `distance` between attribute vectors.  The number of
 * clusters is not given — it falls out of `preference`, the self-similarity
 * placed on the diagonal (lower preference yields fewer exemplars).
 * Allocates three dense N-by-N matrices plus an N-by-`minIterations`
 * convergence history, so cost is quadratic in node count in both time and
 * memory.  Stops early once the exemplar set is unchanged across
 * `minIterations` passes.
 *
 * @param coll — the calling collection; only its nodes are clustered
 * @param options — `damping` and `preference` are effectively required
 *   (v3 validates them); plus `distance`, `attributes`, `maxIterations`,
 *   `minIterations`
 * @returns one collection per exemplar, in exemplar-index order
 * @throws if `damping` is outside [0.5, 1), or `preference` is neither a
 *   number nor one of 'median' / 'mean' / 'min' / 'max'
 */
export const affinityPropagation = (
  coll: Collection,
  options: AffinityPropagationOptions = {},
): Collection[] => inThread(affinityLane(coll, options));
