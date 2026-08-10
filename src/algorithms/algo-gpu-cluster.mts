/*
The feature-space clusterers on the GPU (round 65).

k-means, k-medoids, fuzzy c-means and hierarchical clustering are
attribute-space by design (round 10 A4): nodes are points given by the
`attributes` accessors, and the adjacency is never consulted.  The GPU
path honours that split exactly — `featuresOf` materializes the user
callbacks into an n×d f32 matrix in one CPU pass, and no kernel ever
calls back into user code, which is also why a custom distance
*function* has no GPU path (the wrappers route it to the CPU with a
reason).

Named metrics compile into the kernels as a code (0 euclidean,
1 squaredEuclidean, 2 manhattan, 3 max — an unrecognised name falls
back to euclidean, as `resolveDistance` does).  Iterations follow the
house discipline: all of them encoded up front, flags-guarded kernels,
one readback.  One deliberate deviation from the CPU reference, noted
on the membership kernel: fuzzy c-means clamps its ratio denominators
to a tiny epsilon where the CPU would produce NaN/Infinity memberships
for a node sitting exactly on a centroid — WGSL implementations may
assume floats are finite, so the kernel must not manufacture an Inf.
*/

import type { Collection } from '../collection.mjs';
import { wgsl } from '../render/wgsl.mjs';
import type { DistanceMetric } from './clustering-distances.mjs';
import type { AlgoGpu } from './algo-gpu.mjs';
import {
  assertFits,
  getPipeline,
  groupFor,
  paramsNR,
  readBack,
  storageFrom,
  storageOf,
  submitPass,
  uniformFrom,
} from './algo-gpu.mjs';
import type { Dispatch } from './algo-gpu.mjs';
import {
  CONVERGE_ON_NO_DIFF,
  RESET_DIFF,
  TILE,
  WG,
} from './algo-gpu-dense.mjs';
import {
  fcmResultFrom,
  featuresOf,
  kClustersFromAssignment,
  randomCentroids,
  randomMedoids,
  resolveKOptions,
} from './k-clustering.mjs';
import type {
  FeatureCentroid,
  FuzzyCMeansResult,
  KClusteringOptions,
} from './k-clustering.mjs';
import {
  hierarchicalRun,
  makeGetDist,
  resolveHcaOptions,
} from './hierarchical-clustering.mjs';
import type { HierarchicalClusteringOptions } from './hierarchical-clustering.mjs';

/** Resolve a named metric to its kernel code (unknown → euclidean). */
export const metricCode = (distance: DistanceMetric): number => {
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

/** The FP uniform: n, d, k, metric. */
const fpUniform = (
  ctx: AlgoGpu,
  n: number,
  d: number,
  k: number,
  metric: number,
): GPUBuffer => uniformFrom(ctx, new Uint32Array([n, d, k, metric]));

/** The WGSL distance fold every feature kernel inlines: given running
 * state and a per-dimension |p−q|, produce the next state; `finish`
 * applies the metric's closing step. */
const DIST_FNS = wgsl`
fn distStep(metric : u32, acc : f32, ad : f32) -> f32 {
  if (metric == 2u) { return acc + ad; }
  if (metric == 3u) { return max(acc, ad); }
  return acc + ad * ad;
}

fn distFinish(metric : u32, acc : f32) -> f32 {
  if (metric == 0u) { return sqrt(acc); }
  return acc;
}
`;

/** Pairwise feature distances: out[i][j] = dist(F_i, F_j). */
const PAIR_DIST = wgsl`
struct FP { n : u32, d : u32, k : u32, metric : u32 }
@group(0) @binding(0) var<uniform> fp : FP;
@group(0) @binding(1) var<storage, read> feats : array<f32>;
@group(0) @binding(2) var<storage, read_write> out : array<f32>;

${DIST_FNS}

@compute @workgroup_size(${TILE}, ${TILE})
fn main(@builtin(global_invocation_id) gid : vec3u) {
  let n = fp.n;
  let i = gid.y;
  let j = gid.x;

  if (i >= n || j >= n) { return; }

  var acc = 0.0;

  for (var dd = 0u; dd < fp.d; dd = dd + 1u) {
    let ad = abs(feats[i * fp.d + dd] - feats[j * fp.d + dd]);

    acc = distStep(fp.metric, acc, ad);
  }

  out[i * n + j] = distFinish(fp.metric, acc);
}
`;

/** k-means assignment: nearest centroid, first-wins on ties (strict <,
 * ascending c — the CPU classify order). */
const KM_ASSIGN = wgsl`
struct FP { n : u32, d : u32, k : u32, metric : u32 }
@group(0) @binding(0) var<uniform> fp : FP;
@group(0) @binding(1) var<storage, read> feats : array<f32>;
@group(0) @binding(2) var<storage, read> cents : array<f32>;
@group(0) @binding(3) var<storage, read_write> assign : array<u32>;
@group(0) @binding(4) var<storage, read_write> flags : array<atomic<u32>>;

${DIST_FNS}

@compute @workgroup_size(${WG})
fn main(@builtin(global_invocation_id) gid : vec3u) {
  if (atomicLoad(&flags[0]) == 1u) { return; }

  let i = gid.x;

  if (i >= fp.n) { return; }

  var best = 3.4e38;
  var bestC = 0u;

  for (var c = 0u; c < fp.k; c = c + 1u) {
    var acc = 0.0;

    for (var dd = 0u; dd < fp.d; dd = dd + 1u) {
      let ad = abs(feats[i * fp.d + dd] - cents[c * fp.d + dd]);

      acc = distStep(fp.metric, acc, ad);
    }

    let dist = distFinish(fp.metric, acc);

    if (dist < best) {
      best = dist;
      bestC = c;
    }
  }

  assign[i] = bestC;
}
`;

/** k-means centroid update — one *workgroup* per (cluster, dimension)
 * (round 65.8; the one-invocation-per-pair version launched k·d
 * invocations total — sixteen, for the benchmark's shape — and ran
 * its O(n) fold on a single lane each).  Lanes stride the nodes, the
 * member sum and count tree-reduce, and lane 0 applies the mean: an
 * empty cluster keeps its centroid, a dimension moved past the
 * threshold (p.r) raises the moved bit. */
const KM_UPDATE = wgsl`
struct FP { n : u32, d : u32, k : u32, metric : u32 }
struct P { n : u32, r : f32 }
@group(0) @binding(0) var<uniform> fp : FP;
@group(0) @binding(1) var<uniform> p : P;
@group(0) @binding(2) var<storage, read> feats : array<f32>;
@group(0) @binding(3) var<storage, read> assign : array<u32>;
@group(0) @binding(4) var<storage, read_write> cents : array<f32>;
@group(0) @binding(5) var<storage, read_write> flags : array<atomic<u32>>;

var<workgroup> psum : array<f32, ${WG}>;
var<workgroup> pcount : array<u32, ${WG}>;
var<workgroup> wflag : u32;

@compute @workgroup_size(${WG})
fn main(
  @builtin(workgroup_id) wid : vec3u,
  @builtin(local_invocation_id) lid : vec3u,
) {
  if (lid.x == 0u) { wflag = atomicLoad(&flags[0]); }
  if (workgroupUniformLoad(&wflag) == 1u) { return; }

  let c = wid.x / fp.d;
  let dd = wid.x % fp.d;
  var sum = 0.0;
  var count = 0u;

  for (var i = lid.x; i < fp.n; i = i + ${WG}u) {
    if (assign[i] == c) {
      sum = sum + feats[i * fp.d + dd];
      count = count + 1u;
    }
  }

  psum[lid.x] = sum;
  pcount[lid.x] = count;
  workgroupBarrier();

  for (var stride = ${WG / 2}u; stride > 0u; stride = stride >> 1u) {
    if (lid.x < stride) {
      psum[lid.x] = psum[lid.x] + psum[lid.x + stride];
      pcount[lid.x] = pcount[lid.x] + pcount[lid.x + stride];
    }
    workgroupBarrier();
  }

  if (lid.x == 0u && pcount[0] > 0u) {
    let mean = psum[0] / f32(pcount[0]);
    let idx = c * fp.d + dd;

    if (abs(mean - cents[idx]) > p.r) {
      atomicStore(&flags[1], 1u);
    }

    cents[idx] = mean;
  }
}
`;

/** k-medoids assignment: nearest medoid by the precomputed assignment
 * matrix, first-wins on ties. */
const KMED_ASSIGN = wgsl`
struct FP { n : u32, d : u32, k : u32, metric : u32 }
@group(0) @binding(0) var<uniform> fp : FP;
@group(0) @binding(1) var<storage, read> dmat : array<f32>;
@group(0) @binding(2) var<storage, read> medoids : array<u32>;
@group(0) @binding(3) var<storage, read_write> assign : array<u32>;
@group(0) @binding(4) var<storage, read_write> flags : array<atomic<u32>>;

@compute @workgroup_size(${WG})
fn main(@builtin(global_invocation_id) gid : vec3u) {
  if (atomicLoad(&flags[0]) == 1u) { return; }

  let i = gid.x;
  let n = fp.n;

  if (i >= n) { return; }

  var best = 3.4e38;
  var bestC = 0u;

  for (var c = 0u; c < fp.k; c = c + 1u) {
    let dist = dmat[i * n + medoids[c]];

    if (dist < best) {
      best = dist;
      bestC = c;
    }
  }

  assign[i] = bestC;
}
`;

/** Every node's swap cost within its own cluster — one *workgroup*
 * per node (round 65.8), lanes striding the row and tree-reducing: the
 * sum of manhattan distances to fellow members (the cost matrix is
 * always manhattan, as on the CPU, whatever the assignment metric). */
const KMED_COST = wgsl`
struct FP { n : u32, d : u32, k : u32, metric : u32 }
@group(0) @binding(0) var<uniform> fp : FP;
@group(0) @binding(1) var<storage, read> dcost : array<f32>;
@group(0) @binding(2) var<storage, read> assign : array<u32>;
@group(0) @binding(3) var<storage, read_write> cost : array<f32>;
@group(0) @binding(4) var<storage, read_write> flags : array<atomic<u32>>;

var<workgroup> partial : array<f32, ${WG}>;
var<workgroup> wflag : u32;

@compute @workgroup_size(${WG})
fn main(
  @builtin(workgroup_id) wid : vec3u,
  @builtin(local_invocation_id) lid : vec3u,
) {
  if (lid.x == 0u) { wflag = atomicLoad(&flags[0]); }
  if (workgroupUniformLoad(&wflag) == 1u) { return; }

  let i = wid.x;
  let n = fp.n;
  let mine = assign[i];
  var sum = 0.0;

  for (var j = lid.x; j < n; j = j + ${WG}u) {
    if (assign[j] == mine) {
      sum = sum + dcost[i * n + j];
    }
  }

  partial[lid.x] = sum;
  workgroupBarrier();

  for (var stride = ${WG / 2}u; stride > 0u; stride = stride >> 1u) {
    if (lid.x < stride) {
      partial[lid.x] = partial[lid.x] + partial[lid.x + stride];
    }
    workgroupBarrier();
  }

  if (lid.x == 0u) {
    cost[i] = partial[0];
  }
}
`;

/** Per-cluster medoid swap — one *workgroup* per cluster (round
 * 65.8): the current medoid's cost over the members reduces first as
 * the baseline, then the members' precomputed costs reduce to a
 * (cost, index)-lexicographic argmin — exactly the CPU's ascending
 * strict-< scan, where the first occurrence of the minimum wins — and
 * lane 0 swaps on a strict improvement. */
const KMED_PICK = wgsl`
struct FP { n : u32, d : u32, k : u32, metric : u32 }
@group(0) @binding(0) var<uniform> fp : FP;
@group(0) @binding(1) var<storage, read> dcost : array<f32>;
@group(0) @binding(2) var<storage, read> assign : array<u32>;
@group(0) @binding(3) var<storage, read> cost : array<f32>;
@group(0) @binding(4) var<storage, read_write> medoids : array<u32>;
@group(0) @binding(5) var<storage, read_write> flags : array<atomic<u32>>;

var<workgroup> psum : array<f32, ${WG}>;
var<workgroup> pcost : array<f32, ${WG}>;
var<workgroup> pidx : array<u32, ${WG}>;
var<workgroup> wflag : u32;

@compute @workgroup_size(${WG})
fn main(
  @builtin(workgroup_id) wid : vec3u,
  @builtin(local_invocation_id) lid : vec3u,
) {
  if (lid.x == 0u) { wflag = atomicLoad(&flags[0]); }
  if (workgroupUniformLoad(&wflag) == 1u) { return; }

  let c = wid.x;
  let n = fp.n;
  let med = medoids[c];

  // baseline: the current medoid's cost over the cluster's members
  var base = 0.0;
  var members = 0u;

  for (var i = lid.x; i < n; i = i + ${WG}u) {
    if (assign[i] == c) {
      base = base + dcost[med * n + i];
      members = members + 1u;
    }
  }

  psum[lid.x] = base;
  pidx[lid.x] = members;
  workgroupBarrier();

  for (var stride = ${WG / 2}u; stride > 0u; stride = stride >> 1u) {
    if (lid.x < stride) {
      psum[lid.x] = psum[lid.x] + psum[lid.x + stride];
      pidx[lid.x] = pidx[lid.x] + pidx[lid.x + stride];
    }
    workgroupBarrier();
  }

  let baseCost = psum[0];
  let memberCount = pidx[0];

  workgroupBarrier();

  // candidate argmin by (cost, index) — the CPU's first-minimum rule
  var bestCost = 3.4e38;
  var bestI = 0xffffffffu;

  for (var i = lid.x; i < n; i = i + ${WG}u) {
    if (assign[i] == c) {
      if (cost[i] < bestCost || (cost[i] == bestCost && i < bestI)) {
        bestCost = cost[i];
        bestI = i;
      }
    }
  }

  pcost[lid.x] = bestCost;
  pidx[lid.x] = bestI;
  workgroupBarrier();

  for (var stride = ${WG / 2}u; stride > 0u; stride = stride >> 1u) {
    if (lid.x < stride) {
      let oc = pcost[lid.x + stride];
      let oi = pidx[lid.x + stride];

      if (oc < pcost[lid.x] || (oc == pcost[lid.x] && oi < pidx[lid.x])) {
        pcost[lid.x] = oc;
        pidx[lid.x] = oi;
      }
    }
    workgroupBarrier();
  }

  if (
    lid.x == 0u && memberCount > 0u && pidx[0] != 0xffffffffu &&
    pcost[0] < baseCost && pidx[0] != med
  ) {
    medoids[c] = pidx[0];
    atomicStore(&flags[1], 1u);
  }
}
`;

/** Fuzzy distances: dist[i][c] = dist(F_i, C_c). */
const FCM_DIST = wgsl`
struct FP { n : u32, d : u32, k : u32, metric : u32 }
@group(0) @binding(0) var<uniform> fp : FP;
@group(0) @binding(1) var<storage, read> feats : array<f32>;
@group(0) @binding(2) var<storage, read> cents : array<f32>;
@group(0) @binding(3) var<storage, read_write> dist : array<f32>;
@group(0) @binding(4) var<storage, read_write> flags : array<atomic<u32>>;

${DIST_FNS}

@compute @workgroup_size(${WG})
fn main(@builtin(global_invocation_id) gid : vec3u) {
  if (atomicLoad(&flags[0]) == 1u) { return; }

  let idx = gid.x;

  if (idx >= fp.n * fp.k) { return; }

  let i = idx / fp.k;
  let c = idx % fp.k;
  var acc = 0.0;

  for (var dd = 0u; dd < fp.d; dd = dd + 1u) {
    let ad = abs(feats[i * fp.d + dd] - cents[c * fp.d + dd]);

    acc = distStep(fp.metric, acc, ad);
  }

  dist[idx] = distFinish(fp.metric, acc);
}
`;

/** Fuzzy centroid update — one *workgroup* per (cluster, dimension)
 * with tree-reduced numerator and denominator (round 65.8), weights
 * U^m (p.r carries m). */
const FCM_CENTROIDS = wgsl`
struct FP { n : u32, d : u32, k : u32, metric : u32 }
struct P { n : u32, r : f32 }
@group(0) @binding(0) var<uniform> fp : FP;
@group(0) @binding(1) var<uniform> p : P;
@group(0) @binding(2) var<storage, read> feats : array<f32>;
@group(0) @binding(3) var<storage, read> u : array<f32>;
@group(0) @binding(4) var<storage, read_write> cents : array<f32>;
@group(0) @binding(5) var<storage, read_write> flags : array<atomic<u32>>;

var<workgroup> pnum : array<f32, ${WG}>;
var<workgroup> pden : array<f32, ${WG}>;
var<workgroup> wflag : u32;

@compute @workgroup_size(${WG})
fn main(
  @builtin(workgroup_id) wid : vec3u,
  @builtin(local_invocation_id) lid : vec3u,
) {
  if (lid.x == 0u) { wflag = atomicLoad(&flags[0]); }
  if (workgroupUniformLoad(&wflag) == 1u) { return; }

  let c = wid.x / fp.d;
  let dd = wid.x % fp.d;
  var num = 0.0;
  var den = 0.0;

  for (var i = lid.x; i < fp.n; i = i + ${WG}u) {
    let w = pow(u[i * fp.k + c], p.r);

    num = num + w * feats[i * fp.d + dd];
    den = den + w;
  }

  pnum[lid.x] = num;
  pden[lid.x] = den;
  workgroupBarrier();

  for (var stride = ${WG / 2}u; stride > 0u; stride = stride >> 1u) {
    if (lid.x < stride) {
      pnum[lid.x] = pnum[lid.x] + pnum[lid.x + stride];
      pden[lid.x] = pden[lid.x] + pden[lid.x + stride];
    }
    workgroupBarrier();
  }

  if (lid.x == 0u) {
    cents[c * fp.d + dd] = pnum[0] / pden[0];
  }
}
`;

/** Copy U into Uprev for the convergence compare. */
const FCM_SAVE_U = wgsl`
struct FP { n : u32, d : u32, k : u32, metric : u32 }
@group(0) @binding(0) var<uniform> fp : FP;
@group(0) @binding(1) var<storage, read> u : array<f32>;
@group(0) @binding(2) var<storage, read_write> uprev : array<f32>;
@group(0) @binding(3) var<storage, read_write> flags : array<atomic<u32>>;

@compute @workgroup_size(${WG})
fn main(@builtin(global_invocation_id) gid : vec3u) {
  if (atomicLoad(&flags[0]) == 1u) { return; }

  let idx = gid.x;

  if (idx >= fp.n * fp.k) { return; }

  uprev[idx] = u[idx];
}
`;

/** Fuzzy membership update: U[i][c] = 1 / Σ_kk (d_ic / d_ikk)^(2/(m−1))
 * (p.r carries the exponent).  Deliberate deviation from the CPU: the
 * denominators clamp to 1e-30 where the CPU would divide by zero into
 * NaN/Infinity for a node exactly on a centroid — WGSL must not
 * manufacture an Inf. */
const FCM_MEMBERSHIP = wgsl`
struct FP { n : u32, d : u32, k : u32, metric : u32 }
struct P { n : u32, r : f32 }
@group(0) @binding(0) var<uniform> fp : FP;
@group(0) @binding(1) var<uniform> p : P;
@group(0) @binding(2) var<storage, read> dist : array<f32>;
@group(0) @binding(3) var<storage, read_write> u : array<f32>;
@group(0) @binding(4) var<storage, read_write> flags : array<atomic<u32>>;

@compute @workgroup_size(${WG})
fn main(@builtin(global_invocation_id) gid : vec3u) {
  if (atomicLoad(&flags[0]) == 1u) { return; }

  let idx = gid.x;

  if (idx >= fp.n * fp.k) { return; }

  let i = idx / fp.k;
  let c = idx % fp.k;
  let num = dist[i * fp.k + c];
  var sum = 0.0;

  for (var kk = 0u; kk < fp.k; kk = kk + 1u) {
    let den = max(dist[i * fp.k + kk], 1e-30);

    sum = sum + pow(num / den, p.r);
  }

  u[idx] = 1.0 / max(sum, 1e-30);
}
`;

/** Raise the moved bit where |U − Uprev| exceeds the threshold (p.r). */
const FCM_COMPARE = wgsl`
struct FP { n : u32, d : u32, k : u32, metric : u32 }
struct P { n : u32, r : f32 }
@group(0) @binding(0) var<uniform> fp : FP;
@group(0) @binding(1) var<uniform> p : P;
@group(0) @binding(2) var<storage, read> u : array<f32>;
@group(0) @binding(3) var<storage, read> uprev : array<f32>;
@group(0) @binding(4) var<storage, read_write> flags : array<atomic<u32>>;

@compute @workgroup_size(${WG})
fn main(@builtin(global_invocation_id) gid : vec3u) {
  if (atomicLoad(&flags[0]) == 1u) { return; }

  let idx = gid.x;

  if (idx >= fp.n * fp.k) { return; }

  if (abs(u[idx] - uprev[idx]) > p.r) {
    atomicStore(&flags[1], 1u);
  }
}
`;

/**
 * Compute the full pairwise distance matrix on the device and read it
 * back — the hierarchical clusterer's O(n²·d) half, and the k-medoids
 * cost matrix.
 *
 * @param ctx — the shared device state
 * @param features — the n×d feature matrix
 * @param n — the node count
 * @param d — the dimension count
 * @param metric — the kernel metric code
 * @param what — the caller name, for the unfit error
 * @returns the n×n distances, row-major
 */
export const pairwiseDistancesGpu = async (
  ctx: AlgoGpu,
  features: Float32Array,
  n: number,
  d: number,
  metric: number,
  what: string,
): Promise<Float32Array> => {
  const bytes = n * n * 4;

  assertFits(ctx, bytes, what);

  const fp = fpUniform(ctx, n, d, 0, metric);
  const feats = storageFrom(ctx, features);
  const out = storageOf(ctx, bytes);
  const pair = getPipeline(ctx, 'feat-pair-dist', PAIR_DIST);

  submitPass(ctx, [
    {
      pipeline: pair,
      group: groupFor(ctx, pair, [fp, feats, out]),
      groups: [Math.ceil(n / TILE), Math.ceil(n / TILE)],
    },
  ]);

  const result = new Float32Array(await readBack(ctx, out, bytes));

  for (const buffer of [fp, feats, out]) {
    buffer.destroy();
  }

  return result;
};

/**
 * The GPU hierarchical-clustering executor: the O(n²·d) initial pair
 * matrix builds on the device; the inherently sequential merge chain
 * then runs on the CPU over matrix lookups, via the shared
 * `hierarchicalRun` (custom linkage still consults `getDist` there).
 *
 * @param ctx — the shared device state
 * @param coll — the calling collection
 * @param options — as the CPU reference (named metric, attributes)
 * @returns the clusters
 * @throws GpuUnfitError when n² floats exceed the device's buffer limit
 */
export const hierarchicalClusteringGpu = async (
  ctx: AlgoGpu,
  coll: Collection,
  options?: HierarchicalClusteringOptions,
): Promise<Collection[]> => {
  const nodes = coll.nodes();

  if (nodes.length === 0) {
    return [];
  }

  const opts = resolveHcaOptions(options);
  const n = nodes.length;
  const d = opts.attributes.length;
  const matrix = await pairwiseDistancesGpu(
    ctx,
    featuresOf(nodes, opts.attributes),
    n,
    d,
    metricCode(opts.distance),
    'hierarchicalClustering',
  );

  return hierarchicalRun(
    coll,
    nodes,
    opts,
    makeGetDist(opts),
    (i, j) => matrix[i * n + j],
  );
};

/**
 * The GPU k-means executor: assignment and centroid-update kernels
 * iterate on materialized features, converging when no centroid
 * dimension moves past the sensitivity threshold.
 *
 * @param ctx — the shared device state
 * @param coll — the calling collection
 * @param options — as the CPU reference (named metric, attributes)
 * @returns the sparse cluster array, as the CPU shape
 * @throws GpuUnfitError when the feature/assignment buffers exceed the
 *   device limit
 */
export const kMeansGpu = async (
  ctx: AlgoGpu,
  coll: Collection,
  options?: KClusteringOptions,
): Promise<Collection[]> => {
  const nodes = coll.nodes();
  const opts = resolveKOptions(options);
  const n = nodes.length;
  const d = opts.attributes.length;

  assertFits(ctx, n * d * 4, 'kMeans');

  const centroids: FeatureCentroid[] =
    opts.testMode &&
    typeof opts.testCentroids === 'object' &&
    opts.testCentroids != null
      ? (opts.testCentroids as FeatureCentroid[])
      : randomCentroids(nodes, opts.k, opts.attributes);

  const cents = new Float32Array(opts.k * d);

  for (let c = 0; c < opts.k; c++) {
    for (let dd = 0; dd < d; dd++) {
      cents[c * d + dd] = centroids[c][dd];
    }
  }

  const fp = fpUniform(ctx, n, d, opts.k, metricCode(opts.distance));
  const pT = paramsNR(ctx, n, opts.sensitivityThreshold);
  const feats = storageFrom(ctx, featuresOf(nodes, opts.attributes));
  const centBuf = storageFrom(ctx, cents);
  const assign = storageOf(ctx, n * 4);
  const flags = storageFrom(ctx, new Uint32Array([0, 0]));

  const kmAssign = getPipeline(ctx, 'km-assign', KM_ASSIGN);
  const kmUpdate = getPipeline(ctx, 'km-update', KM_UPDATE);
  const reset = getPipeline(ctx, 'dense-reset-diff', RESET_DIFF);
  const converge = getPipeline(ctx, 'dense-converge', CONVERGE_ON_NO_DIFF);

  const one: [number] = [1];
  const iteration: Dispatch[] = [
    { pipeline: reset, group: groupFor(ctx, reset, [flags]), groups: one },
    {
      pipeline: kmAssign,
      group: groupFor(ctx, kmAssign, [fp, feats, centBuf, assign, flags]),
      groups: [Math.ceil(n / WG)],
    },
    {
      pipeline: kmUpdate,
      // one workgroup per (cluster, dimension)
      group: groupFor(ctx, kmUpdate, [fp, pT, feats, assign, centBuf, flags]),
      groups: [opts.k * d],
    },
    {
      pipeline: converge,
      group: groupFor(ctx, converge, [flags]),
      groups: one,
    },
  ];

  const all: Dispatch[] = [];

  for (let it = 0; it < opts.maxIterations; it++) {
    all.push(...iteration);
  }

  submitPass(ctx, all);

  const out = new Uint32Array(await readBack(ctx, assign, n * 4));

  for (const buffer of [fp, pT, feats, centBuf, assign, flags]) {
    buffer.destroy();
  }

  return kClustersFromAssignment(coll, nodes, opts.k, out);
};

/**
 * The GPU k-medoids executor: assignment rides a metric pairwise
 * matrix, the swap step a manhattan one (the CPU's fixed cost metric),
 * both computed once on the device — the per-iteration work is then
 * O(n²) lookups instead of O(n²·d) evaluations.
 *
 * @param ctx — the shared device state
 * @param coll — the calling collection
 * @param options — as the CPU reference (named metric, attributes)
 * @returns the sparse cluster array, as the CPU shape
 * @throws as the CPU when `k` exceeds the node count; GpuUnfitError on
 *   device-limit overflow
 */
export const kMedoidsGpu = async (
  ctx: AlgoGpu,
  coll: Collection,
  options?: KClusteringOptions,
): Promise<Collection[]> => {
  const nodes = coll.nodes();
  const opts = resolveKOptions(options);
  const n = nodes.length;
  const d = opts.attributes.length;

  // k distinct medoids are required, so k cannot exceed the node count
  if (opts.k > n) {
    throw new Error(
      `kMedoids: k (${opts.k}) cannot exceed the number of nodes (${n}).`,
    );
  }

  assertFits(ctx, n * n * 4, 'kMedoids');

  const medoidNodes: Collection[] =
    opts.testMode &&
    typeof opts.testCentroids === 'object' &&
    opts.testCentroids != null
      ? (opts.testCentroids as Collection[])
      : randomMedoids(nodes, opts.k);

  // handles → dense indices (handles are interned singletons)
  const indexOf = new Map<Collection, number>();

  for (let i = 0; i < n; i++) {
    indexOf.set(nodes[i], i);
  }

  const medoids = new Uint32Array(opts.k);

  for (let c = 0; c < opts.k; c++) {
    medoids[c] = indexOf.get(medoidNodes[c]) ?? 0;
  }

  const features = featuresOf(nodes, opts.attributes);
  const metric = metricCode(opts.distance);
  const bytes = n * n * 4;

  const fp = fpUniform(ctx, n, d, opts.k, metric);
  const feats = storageFrom(ctx, features);
  const dmat = storageOf(ctx, bytes);
  const dcost = storageOf(ctx, bytes);
  const assign = storageOf(ctx, n * 4);
  const cost = storageOf(ctx, n * 4);
  const medBuf = storageFrom(ctx, medoids);
  const flags = storageFrom(ctx, new Uint32Array([0, 0]));

  const pair = getPipeline(ctx, 'feat-pair-dist', PAIR_DIST);
  const kmedAssign = getPipeline(ctx, 'kmed-assign', KMED_ASSIGN);
  const kmedCost = getPipeline(ctx, 'kmed-cost', KMED_COST);
  const kmedPick = getPipeline(ctx, 'kmed-pick', KMED_PICK);
  const reset = getPipeline(ctx, 'dense-reset-diff', RESET_DIFF);
  const converge = getPipeline(ctx, 'dense-converge', CONVERGE_ON_NO_DIFF);

  const grid2d: [number, number] = [Math.ceil(n / TILE), Math.ceil(n / TILE)];
  const gridN: [number] = [Math.ceil(n / WG)];
  const one: [number] = [1];

  // the two matrices, once; a manhattan assignment metric shares dcost
  const fpCost = fpUniform(ctx, n, d, opts.k, 2);
  const all: Dispatch[] = [
    {
      pipeline: pair,
      group: groupFor(ctx, pair, [fp, feats, dmat]),
      groups: grid2d,
    },
    {
      pipeline: pair,
      group: groupFor(ctx, pair, [fpCost, feats, dcost]),
      groups: grid2d,
    },
  ];

  const iteration: Dispatch[] = [
    { pipeline: reset, group: groupFor(ctx, reset, [flags]), groups: one },
    {
      pipeline: kmedAssign,
      group: groupFor(ctx, kmedAssign, [fp, dmat, medBuf, assign, flags]),
      groups: gridN,
    },
    {
      pipeline: kmedCost,
      // one workgroup per node
      group: groupFor(ctx, kmedCost, [fp, dcost, assign, cost, flags]),
      groups: [n],
    },
    {
      pipeline: kmedPick,
      // one workgroup per cluster
      group: groupFor(ctx, kmedPick, [fp, dcost, assign, cost, medBuf, flags]),
      groups: [opts.k],
    },
    {
      pipeline: converge,
      group: groupFor(ctx, converge, [flags]),
      groups: one,
    },
  ];

  for (let it = 0; it < opts.maxIterations; it++) {
    all.push(...iteration);
  }

  submitPass(ctx, all);

  const out = new Uint32Array(await readBack(ctx, assign, n * 4));

  for (const buffer of [
    fp,
    fpCost,
    feats,
    dmat,
    dcost,
    assign,
    cost,
    medBuf,
    flags,
  ]) {
    buffer.destroy();
  }

  return kClustersFromAssignment(coll, nodes, opts.k, out);
};

/**
 * The GPU fuzzy c-means executor: centroid, distance, membership and
 * compare kernels iterate until the membership matrix settles under
 * the sensitivity threshold.  Membership seeding is random and
 * row-normalized, as on the CPU.
 *
 * @param ctx — the shared device state
 * @param coll — the calling collection
 * @param options — as the CPU reference (named metric, attributes)
 * @returns `{ clusters, degreeOfMembership }`, memberships in f32
 * @throws GpuUnfitError on device-limit overflow
 */
export const fuzzyCMeansGpu = async (
  ctx: AlgoGpu,
  coll: Collection,
  options?: KClusteringOptions,
): Promise<FuzzyCMeansResult> => {
  const nodes = coll.nodes();
  const opts = resolveKOptions(options);
  const n = nodes.length;
  const d = opts.attributes.length;
  const k = opts.k;

  assertFits(ctx, Math.max(n * d, n * k) * 4, 'fuzzyCMeans');

  // random membership, rows normalized to 1 (the CPU seeding)
  const u0 = new Float32Array(n * k);

  for (let i = 0; i < n; i++) {
    let total = 0;

    for (let c = 0; c < k; c++) {
      u0[i * k + c] = Math.random();
      total += u0[i * k + c];
    }

    for (let c = 0; c < k; c++) {
      u0[i * k + c] /= total;
    }
  }

  const fp = fpUniform(ctx, n, d, k, metricCode(opts.distance));
  const pM = paramsNR(ctx, n, opts.m);
  const pPow = paramsNR(ctx, n, 2 / (opts.m - 1));
  const pT = paramsNR(ctx, n, opts.sensitivityThreshold);
  const feats = storageFrom(ctx, featuresOf(nodes, opts.attributes));
  const uBuf = storageFrom(ctx, u0);
  const uPrev = storageOf(ctx, n * k * 4);
  const dist = storageOf(ctx, n * k * 4);
  const cents = storageOf(ctx, k * d * 4);
  const flags = storageFrom(ctx, new Uint32Array([0, 0]));

  const fcmCent = getPipeline(ctx, 'fcm-centroids', FCM_CENTROIDS);
  const fcmSave = getPipeline(ctx, 'fcm-save-u', FCM_SAVE_U);
  const fcmDist = getPipeline(ctx, 'fcm-dist', FCM_DIST);
  const fcmMember = getPipeline(ctx, 'fcm-membership', FCM_MEMBERSHIP);
  const fcmCompare = getPipeline(ctx, 'fcm-compare', FCM_COMPARE);
  const reset = getPipeline(ctx, 'dense-reset-diff', RESET_DIFF);
  const converge = getPipeline(ctx, 'dense-converge', CONVERGE_ON_NO_DIFF);

  const gridNK: [number] = [Math.ceil((n * k) / WG)];
  const one: [number] = [1];
  const iteration: Dispatch[] = [
    { pipeline: reset, group: groupFor(ctx, reset, [flags]), groups: one },
    {
      pipeline: fcmCent,
      // one workgroup per (cluster, dimension)
      group: groupFor(ctx, fcmCent, [fp, pM, feats, uBuf, cents, flags]),
      groups: [k * d],
    },
    {
      pipeline: fcmSave,
      group: groupFor(ctx, fcmSave, [fp, uBuf, uPrev, flags]),
      groups: gridNK,
    },
    {
      pipeline: fcmDist,
      group: groupFor(ctx, fcmDist, [fp, feats, cents, dist, flags]),
      groups: gridNK,
    },
    {
      pipeline: fcmMember,
      group: groupFor(ctx, fcmMember, [fp, pPow, dist, uBuf, flags]),
      groups: gridNK,
    },
    {
      pipeline: fcmCompare,
      group: groupFor(ctx, fcmCompare, [fp, pT, uBuf, uPrev, flags]),
      groups: gridNK,
    },
    {
      pipeline: converge,
      group: groupFor(ctx, converge, [flags]),
      groups: one,
    },
  ];

  const all: Dispatch[] = [];

  for (let it = 0; it < opts.maxIterations; it++) {
    all.push(...iteration);
  }

  submitPass(ctx, all);

  const uOut = new Float32Array(await readBack(ctx, uBuf, n * k * 4));

  for (const buffer of [
    fp,
    pM,
    pPow,
    pT,
    feats,
    uBuf,
    uPrev,
    dist,
    cents,
    flags,
  ]) {
    buffer.destroy();
  }

  const U: number[][] = [];

  for (let i = 0; i < n; i++) {
    const row: number[] = new Array(k);

    for (let c = 0; c < k; c++) {
      row[c] = uOut[i * k + c];
    }

    U.push(row);
  }

  return fcmResultFrom(coll, nodes, U, opts);
};
