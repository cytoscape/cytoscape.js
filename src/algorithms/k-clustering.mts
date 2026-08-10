// k-means / k-medoids / fuzzy c-means over node attribute vectors — a
// handle-level port of v3's k-clustering (the algorithms are feature-space,
// not adjacency-walks, so handles are the natural representation).

import type { Collection } from '../collection.mjs';
import { resolveDistance } from './clustering-distances.mjs';
import type { DistanceMetric } from './clustering-distances.mjs';
import { resolveExecutor, runAlgo } from './executor.mjs';
import type { AlgoExecutor } from './executor.mjs';
import { fuzzyCMeansGpu, kMeansGpu, kMedoidsGpu } from './algo-gpu-cluster.mjs';

/** Why a feature-space run has no GPU path, when it doesn't. */
const featureGpuReason = (options?: KClusteringOptions): string | null => {
  if (typeof options?.distance === 'function') {
    return (
      'a custom distance function runs on the CPU — ' +
      "use executor 'cpu' or 'auto'"
    );
  }

  if ((options?.attributes ?? []).length === 0) {
    return (
      'the GPU path needs `attributes` to materialize features — ' +
      "use executor 'cpu' or 'auto'"
    );
  }

  return null;
};

/** A node attribute accessor used as a clustering feature. */
export type KAttributeFn = (node: Collection) => number;

export type FeatureCentroid = number[];

export interface KClusteringOptions {
  k?: number;
  m?: number;
  sensitivityThreshold?: number;
  distance?: DistanceMetric;
  maxIterations?: number;
  attributes?: KAttributeFn[];
  testMode?: boolean;
  testCentroids?: number | FeatureCentroid[] | Collection[] | null;
  /** where the run executes; see `AlgoExecutor` (default 'auto') */
  executor?: AlgoExecutor;
}

export interface FuzzyCMeansResult {
  clusters: Collection[];
  degreeOfMembership: number[][];
}

type KMode = 'kMeans' | 'kMedoids' | 'cmeans';

export interface ResolvedKOptions {
  k: number;
  m: number;
  sensitivityThreshold: number;
  distance: DistanceMetric;
  maxIterations: number;
  attributes: KAttributeFn[];
  testMode: boolean;
  testCentroids: number | FeatureCentroid[] | Collection[] | null;
}

/** Resolve the k-clustering options to their defaults — shared by the
 * CPU reference and the GPU executors. */
export const resolveKOptions = (
  options: KClusteringOptions = {},
): ResolvedKOptions => ({
  k: options.k ?? 2,
  m: options.m ?? 2,
  sensitivityThreshold: options.sensitivityThreshold ?? 0.0001,
  distance: options.distance ?? 'euclidean',
  maxIterations: options.maxIterations ?? 10,
  attributes: options.attributes ?? [],
  testMode: options.testMode ?? false,
  testCentroids: options.testCentroids ?? null,
});

const spawnHandles = (coll: Collection, eles: Collection[]): Collection =>
  coll._spawn(eles.map((ele) => ele._refs[0]));

/**
 * Per-run caches for the distance hot path (round 62.2), kept behind
 * the unchanged `getDist` signature: each public entry bumps
 * `distRunToken`, and a node's attribute vector is computed once per
 * run (the round-18 algorithms rule — a projection evaluated once per
 * node, not once per pair) rather than at every classify/cost call.
 * The cache keys on the interned singleton handles; the token is what
 * keeps a second run from reading vectors of data that changed between
 * runs.  kMeans/cmeans centroids are plain feature arrays that mutate
 * between iterations, so they are read live and never cached.
 */
let distRunToken = 0;
const nodeVecs = new WeakMap<
  Collection,
  { token: number; attrs: KAttributeFn[]; vec: number[] }
>();
let lastMetric: DistanceMetric | null = null;
let lastImpl = resolveDistance('euclidean');

const vecOf = (node: Collection, attributes: KAttributeFn[]): number[] => {
  const hit = nodeVecs.get(node);

  if (hit != null && hit.token === distRunToken && hit.attrs === attributes) {
    return hit.vec;
  }

  const vec = attributes.map((f) => f(node));

  nodeVecs.set(node, { token: distRunToken, attrs: attributes, vec });

  return vec;
};

let distP: ArrayLike<number> = [];
let distQ: ArrayLike<number> = [];
const readP = (i: number): number => distP[i];
const readQ = (i: number): number => distQ[i];

const getDist = (
  type: DistanceMetric,
  node: Collection,
  centroid: FeatureCentroid | Collection,
  attributes: KAttributeFn[],
  mode: KMode,
): number => {
  if (type !== lastMetric) {
    lastMetric = type;
    lastImpl = resolveDistance(type);
  }

  if (attributes.length === 0 && typeof type === 'function') {
    return lastImpl(centroid, node);
  }

  distP =
    mode !== 'kMedoids'
      ? (centroid as FeatureCentroid)
      : vecOf(centroid as Collection, attributes);
  distQ = vecOf(node, attributes);

  return lastImpl(attributes.length, readP, readQ, centroid, node);
};

/** Uniform-random centroids within the data's per-dimension range —
 * the shared seeding for both executors' non-test mode. */
export const randomCentroids = (
  nodes: Collection,
  k: number,
  attributes: KAttributeFn[],
): FeatureCentroid[] => {
  const ndim = attributes.length;
  const min = new Array<number>(ndim);
  const max = new Array<number>(ndim);
  const centroids: FeatureCentroid[] = new Array(k);

  for (let i = 0; i < ndim; i++) {
    min[i] = nodes.min(attributes[i]).value as number;
    max[i] = nodes.max(attributes[i]).value as number;
  }

  for (let c = 0; c < k; c++) {
    const centroid: FeatureCentroid = [];

    for (let i = 0; i < ndim; i++) {
      centroid[i] = Math.random() * (max[i] - min[i]) + min[i];
    }

    centroids[c] = centroid;
  }

  return centroids;
};

const classify = (
  node: Collection,
  centroids: FeatureCentroid[] | Collection[],
  distance: DistanceMetric,
  attributes: KAttributeFn[],
  type: KMode,
): number => {
  let min = Infinity;
  let index = 0;

  for (let i = 0; i < centroids.length; i++) {
    const dist = getDist(distance, node, centroids[i], attributes, type);

    if (dist < min) {
      min = dist;
      index = i;
    }
  }

  return index;
};

const buildCluster = (
  centroid: number,
  nodes: Collection,
  assignment: Record<string, number>,
): Collection[] => {
  const cluster: Collection[] = [];

  for (let n = 0; n < nodes.length; n++) {
    if (assignment[nodes[n].id() as string] === centroid) {
      cluster.push(nodes[n]);
    }
  }

  return cluster;
};

const haveValuesConverged = (
  v1: number,
  v2: number,
  sensitivityThreshold: number,
): boolean => Math.abs(v2 - v1) <= sensitivityThreshold;

const haveMatricesConverged = (
  v1: number[][],
  v2: number[][],
  sensitivityThreshold: number,
): boolean => {
  for (let i = 0; i < v1.length; i++) {
    for (let j = 0; j < v1[i].length; j++) {
      if (Math.abs(v1[i][j] - v2[i][j]) > sensitivityThreshold) {
        return false;
      }
    }
  }

  return true;
};

const seenBefore = (
  node: Collection,
  medoids: Collection[],
  n: number,
): boolean => {
  for (let i = 0; i < n; i++) {
    if (node === medoids[i]) {
      return true;
    } // handles are interned singletons
  }

  return false;
};

/** Random distinct-ish medoid seeding — the shared seeding for both
 * executors' non-test mode. */
export const randomMedoids = (nodes: Collection, k: number): Collection[] => {
  const medoids: Collection[] = new Array(k);

  if (nodes.length < 50) {
    // small sets: medoid conflicts are likely, so re-roll duplicates
    for (let i = 0; i < k; i++) {
      let node = nodes[Math.floor(Math.random() * nodes.length)];

      while (seenBefore(node, medoids, i)) {
        node = nodes[Math.floor(Math.random() * nodes.length)];
      }

      medoids[i] = node;
    }
  } else {
    for (let i = 0; i < k; i++) {
      medoids[i] = nodes[Math.floor(Math.random() * nodes.length)];
    }
  }

  return medoids;
};

/**
 * Materialize the attribute callbacks into a row-major n×d feature
 * matrix — the single CPU pass that lets the GPU executors run without
 * ever calling back into user code.
 *
 * @param nodes — the nodes, in matrix-row order
 * @param attributes — the feature accessors
 * @returns the f32 features
 */
export const featuresOf = (
  nodes: Collection,
  attributes: KAttributeFn[],
): Float32Array => {
  const n = nodes.length;
  const d = attributes.length;
  const features = new Float32Array(n * d);

  for (let i = 0; i < n; i++) {
    const node = nodes[i];

    for (let j = 0; j < d; j++) {
      features[i * d + j] = attributes[j](node);
    }
  }

  return features;
};

/**
 * Spawn the k cluster collections from a dense assignment vector.
 * Matches the CPU shape: a centroid that attracted no node leaves its
 * entry `undefined`, as in v3.
 *
 * @param coll — the calling collection
 * @param nodes — the nodes, in assignment order
 * @param k — the cluster count
 * @param assignment — per-node cluster index
 * @returns the sparse cluster array
 */
export const kClustersFromAssignment = (
  coll: Collection,
  nodes: Collection,
  k: number,
  assignment: ArrayLike<number>,
): Collection[] => {
  const members: Collection[][] = [];

  for (let c = 0; c < k; c++) {
    members.push([]);
  }

  for (let i = 0; i < nodes.length; i++) {
    members[assignment[i]]?.push(nodes[i]);
  }

  const clusters: Collection[] = new Array(k);

  for (let c = 0; c < k; c++) {
    if (members[c].length > 0) {
      clusters[c] = spawnHandles(coll, members[c]);
    }
  }

  return clusters;
};

/**
 * Wrap a membership matrix as the public fuzzy c-means result — the
 * crisp clusters are the per-node arg-max, as on the CPU.
 *
 * @param coll — the calling collection
 * @param nodes — the nodes, in matrix-row order
 * @param U — the n×k membership rows
 * @param opts — the resolved options (for k)
 * @returns `{ clusters, degreeOfMembership }`
 */
export const fcmResultFrom = (
  coll: Collection,
  nodes: Collection,
  U: number[][],
  opts: ResolvedKOptions,
): FuzzyCMeansResult => ({
  clusters: assign(coll, nodes, U, opts),
  degreeOfMembership: U,
});

const findCost = (
  potentialNewMedoid: Collection,
  cluster: Collection[],
  attributes: KAttributeFn[],
): number => {
  let cost = 0;

  for (let n = 0; n < cluster.length; n++) {
    cost += getDist(
      'manhattan',
      cluster[n],
      potentialNewMedoid,
      attributes,
      'kMedoids',
    );
  }

  return cost;
};

/**
 * The async k-means entry point behind `eles.kMeans()`: validates
 * `executor` synchronously, then routes to the CPU reference
 * implementation or, in a later round, the WGSL kernels.
 *
 * @param coll — the calling collection
 * @param options — as `kMeans`, plus `executor`
 * @returns a promise of the clusters
 * @throws if `executor` is not 'cpu', 'gpu' or 'auto'
 */
export const kMeansAsync = (
  coll: Collection,
  options?: KClusteringOptions,
): Promise<Collection[]> => {
  const executor = resolveExecutor(options?.executor);
  const n = coll.nodes().length;
  const reason = featureGpuReason(options);

  // measured crossover (65.6, amd gcn-4): 1.9x at n=4096; the fixed
  // ~15 ms GPU overhead puts the wash near n=2048
  return runAlgo(
    executor,
    n,
    2048,
    () => kMeans(coll, options),
    reason == null ? (ctx) => kMeansGpu(ctx, coll, options) : null,
    reason ?? undefined,
  );
};

/**
 * The async k-medoids entry point behind `eles.kMedoids()`: validates
 * `executor` synchronously, then routes to the CPU reference
 * implementation or, in a later round, the WGSL kernels.
 *
 * @param coll — the calling collection
 * @param options — as `kMedoids`, plus `executor`
 * @returns a promise of the clusters
 * @throws if `executor` is not 'cpu', 'gpu' or 'auto'
 */
export const kMedoidsAsync = (
  coll: Collection,
  options?: KClusteringOptions,
): Promise<Collection[]> => {
  const executor = resolveExecutor(options?.executor);
  const n = coll.nodes().length;
  const reason = featureGpuReason(options);

  // measured crossover (65.6, amd gcn-4): 9.6x at n=1024 (the n^2 cost
  // matrices dominate the CPU well before that)
  return runAlgo(
    executor,
    n,
    512,
    () => kMedoids(coll, options),
    reason == null ? (ctx) => kMedoidsGpu(ctx, coll, options) : null,
    reason ?? undefined,
  );
};

/**
 * The async fuzzy c-means entry point behind `eles.fuzzyCMeans()`:
 * validates `executor` synchronously, then routes to the CPU reference
 * implementation or, in a later round, the WGSL kernels.
 *
 * @param coll — the calling collection
 * @param options — as `fuzzyCMeans`, plus `executor`
 * @returns a promise of `{ clusters, degreeOfMembership }`
 * @throws if `executor` is not 'cpu', 'gpu' or 'auto'
 */
export const fuzzyCMeansAsync = (
  coll: Collection,
  options?: KClusteringOptions,
): Promise<FuzzyCMeansResult> => {
  const executor = resolveExecutor(options?.executor);
  const n = coll.nodes().length;
  const reason = featureGpuReason(options);

  // measured crossover (65.6, amd gcn-4): 7.2x at n=4096, scaling flat
  return runAlgo(
    executor,
    n,
    1024,
    () => fuzzyCMeans(coll, options),
    reason == null ? (ctx) => fuzzyCMeansGpu(ctx, coll, options) : null,
    reason ?? undefined,
  );
};

/**
 * k-means over the calling collection's nodes in attribute space.  Unlike
 * the graph-walk algorithms this one never touches the adjacency: nodes
 * are points given by `attributes`, so the edges of the collection are
 * irrelevant.  Seeded randomly (uniform within the per-dimension range of
 * the data) unless `testMode` supplies `testCentroids`, so repeat runs on
 * the same graph need not agree.  Iterates until every centroid moves less
 * than `sensitivityThreshold` per dimension, or `maxIterations` passes.
 *
 * @param coll — the calling collection; only its nodes are clustered
 * @param options — `k` (default 2), `attributes`, `distance`,
 *   `maxIterations`, `sensitivityThreshold`
 * @returns `k` collections; entries stay empty (`undefined`) for centroids
 *   that attracted no node, as in v3
 */
export const kMeans = (
  coll: Collection,
  options?: KClusteringOptions,
): Collection[] => {
  distRunToken++;
  const nodes = coll.nodes();
  const opts = resolveKOptions(options);

  const clusters: Collection[] = new Array(opts.k);
  const assignment: Record<string, number> = {};
  let centroids: FeatureCentroid[];

  if (
    opts.testMode &&
    typeof opts.testCentroids === 'object' &&
    opts.testCentroids != null
  ) {
    centroids = opts.testCentroids as FeatureCentroid[];
  } else {
    centroids = randomCentroids(nodes, opts.k, opts.attributes);
  }

  let isStillMoving = true;
  let iterations = 0;

  while (isStillMoving && iterations < opts.maxIterations) {
    for (let n = 0; n < nodes.length; n++) {
      assignment[nodes[n].id() as string] = classify(
        nodes[n],
        centroids,
        opts.distance,
        opts.attributes,
        'kMeans',
      );
    }

    isStillMoving = false;

    for (let c = 0; c < opts.k; c++) {
      const cluster = buildCluster(c, nodes, assignment);

      if (cluster.length === 0) {
        continue;
      }

      const ndim = opts.attributes.length;
      const centroid = centroids[c];
      const newCentroid: FeatureCentroid = new Array(ndim);

      for (let d = 0; d < ndim; d++) {
        let sum = 0.0;

        for (let i = 0; i < cluster.length; i++) {
          sum += opts.attributes[d](cluster[i]);
        }

        newCentroid[d] = sum / cluster.length;

        if (
          !haveValuesConverged(
            newCentroid[d],
            centroid[d],
            opts.sensitivityThreshold,
          )
        ) {
          isStillMoving = true;
        }
      }

      centroids[c] = newCentroid;
      clusters[c] = spawnHandles(coll, cluster);
    }

    iterations++;
  }

  return clusters;
};

/**
 * k-medoids: like `kMeans`, but each cluster centre is one of the nodes
 * rather than a synthetic point, and the swap cost is always Manhattan
 * (v3's choice) regardless of `distance`, which only governs assignment.
 * Cost is quadratic in cluster size per iteration, so it is markedly more
 * expensive than k-means on large clusters.
 *
 * @param coll — the calling collection; only its nodes are clustered
 * @param options — as `kMeans`; `testCentroids` here are node handles
 * @returns `k` collections, empty entries left `undefined` as in v3
 * @throws if `k` exceeds the node count — distinct medoids are required
 */
export const kMedoids = (
  coll: Collection,
  options?: KClusteringOptions,
): Collection[] => {
  distRunToken++;
  const nodes = coll.nodes();
  const opts = resolveKOptions(options);

  // k distinct medoids are required, so k cannot exceed the node count
  if (opts.k > nodes.length) {
    throw new Error(
      `kMedoids: k (${opts.k}) cannot exceed the number of nodes (${nodes.length}).`,
    );
  }

  const clusters: Collection[] = new Array(opts.k);
  const assignment: Record<string, number> = {};
  const minCosts: number[] = new Array(opts.k);
  let medoids: Collection[];

  if (
    opts.testMode &&
    typeof opts.testCentroids === 'object' &&
    opts.testCentroids != null
  ) {
    medoids = opts.testCentroids as Collection[];
  } else {
    medoids = randomMedoids(nodes, opts.k);
  }

  let isStillMoving = true;
  let iterations = 0;

  while (isStillMoving && iterations < opts.maxIterations) {
    for (let n = 0; n < nodes.length; n++) {
      assignment[nodes[n].id() as string] = classify(
        nodes[n],
        medoids,
        opts.distance,
        opts.attributes,
        'kMedoids',
      );
    }

    isStillMoving = false;

    for (let m = 0; m < medoids.length; m++) {
      const cluster = buildCluster(m, nodes, assignment);

      if (cluster.length === 0) {
        continue;
      }

      minCosts[m] = findCost(medoids[m], cluster, opts.attributes);

      for (let n = 0; n < cluster.length; n++) {
        const curCost = findCost(cluster[n], cluster, opts.attributes);

        if (curCost < minCosts[m]) {
          minCosts[m] = curCost;
          medoids[m] = cluster[n];
          isStillMoving = true;
        }
      }

      clusters[m] = spawnHandles(coll, cluster);
    }

    iterations++;
  }

  return clusters;
};

const updateCentroids = (
  centroids: FeatureCentroid[],
  nodes: Collection,
  U: number[][],
  weight: number[][],
  opts: ResolvedKOptions,
): void => {
  for (let n = 0; n < nodes.length; n++) {
    for (let c = 0; c < centroids.length; c++) {
      weight[n][c] = Math.pow(U[n][c], opts.m);
    }
  }

  for (let c = 0; c < centroids.length; c++) {
    for (let dim = 0; dim < opts.attributes.length; dim++) {
      let numerator = 0;
      let denominator = 0;

      for (let n = 0; n < nodes.length; n++) {
        numerator += weight[n][c] * opts.attributes[dim](nodes[n]);
        denominator += weight[n][c];
      }

      centroids[c][dim] = numerator / denominator;
    }
  }
};

const updateMembership = (
  U: number[][],
  _U: number[][],
  centroids: FeatureCentroid[],
  nodes: Collection,
  opts: ResolvedKOptions,
): void => {
  for (let i = 0; i < U.length; i++) {
    _U[i] = U[i].slice();
  }

  const pow = 2 / (opts.m - 1);

  for (let c = 0; c < centroids.length; c++) {
    for (let n = 0; n < nodes.length; n++) {
      let sum = 0;

      // the numerator does not depend on k — hoisted (round 62.2), the
      // same value the k-loop recomputed; the sum is float-identical
      const numerator = getDist(
        opts.distance,
        nodes[n],
        centroids[c],
        opts.attributes,
        'cmeans',
      );

      for (let k = 0; k < centroids.length; k++) {
        const denominator = getDist(
          opts.distance,
          nodes[n],
          centroids[k],
          opts.attributes,
          'cmeans',
        );

        sum += Math.pow(numerator / denominator, pow);
      }

      U[n][c] = 1 / sum;
    }
  }
};

const assign = (
  coll: Collection,
  nodes: Collection,
  U: number[][],
  opts: ResolvedKOptions,
): Collection[] => {
  const clustersArr: Collection[][] = new Array(opts.k);

  for (let c = 0; c < clustersArr.length; c++) {
    clustersArr[c] = [];
  }

  for (let n = 0; n < U.length; n++) {
    let max = -Infinity;
    let index = -1;

    for (let c = 0; c < U[0].length; c++) {
      if (U[n][c] > max) {
        max = U[n][c];
        index = c;
      }
    }

    clustersArr[index].push(nodes[n]);
  }

  return clustersArr.map((cluster) => spawnHandles(coll, cluster));
};

/**
 * Fuzzy c-means: every node holds a graded membership in every cluster
 * instead of a single assignment.  Membership is seeded randomly and
 * normalised per node, then alternately updated with the centroids until
 * the membership matrix changes by less than `sensitivityThreshold`
 * everywhere, or `maxIterations` passes.  The returned crisp `clusters`
 * are the arg-max of each node's memberships.
 *
 * @param coll — the calling collection; only its nodes are clustered
 * @param options — as `kMeans`, plus `m`, the fuzziness exponent
 *   (default 2; must be > 1)
 * @returns the `k` crisp clusters plus `degreeOfMembership`, an
 *   N-by-`k` matrix in node order whose rows sum to 1
 */
export const fuzzyCMeans = (
  coll: Collection,
  options?: KClusteringOptions,
): FuzzyCMeansResult => {
  distRunToken++;
  const nodes = coll.nodes();
  const opts = resolveKOptions(options);

  const _U: number[][] = new Array(nodes.length);
  const U: number[][] = new Array(nodes.length);
  const weight: number[][] = new Array(nodes.length);

  for (let i = 0; i < nodes.length; i++) {
    _U[i] = new Array(opts.k);
    U[i] = new Array(opts.k);
    weight[i] = new Array(opts.k);
  }

  for (let i = 0; i < nodes.length; i++) {
    let total = 0;

    for (let j = 0; j < opts.k; j++) {
      U[i][j] = Math.random();
      total += U[i][j];
    }

    for (let j = 0; j < opts.k; j++) {
      U[i][j] = U[i][j] / total;
    }
  }

  const centroids: FeatureCentroid[] = new Array(opts.k);

  for (let i = 0; i < opts.k; i++) {
    centroids[i] = new Array(opts.attributes.length);
  }

  let isStillMoving = true;
  let iterations = 0;

  while (isStillMoving && iterations < opts.maxIterations) {
    isStillMoving = false;

    updateCentroids(centroids, nodes, U, weight, opts);
    updateMembership(U, _U, centroids, nodes, opts);

    if (!haveMatricesConverged(U, _U, opts.sensitivityThreshold)) {
      isStillMoving = true;
    }

    iterations++;
  }

  return {
    clusters: assign(coll, nodes, U, opts),
    degreeOfMembership: U,
  };
};
