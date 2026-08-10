/*
Affinity propagation on the GPU (round 65).

The CPU reference (`affinity-propagation.mts`) is the spec: both
executors share the validated similarity build (attribute callbacks and
custom distance functions run there, on the CPU) and the cluster
assignment tail — the GPU replaces the responsibility/availability
message passing, which is the O(n²·iterations) part.

Kernel shape: one invocation owns one whole row (responsibilities) or
one whole column (availabilities), because the damped update needs the
row's running top-two maximum and the column's positive sum — serial
per line, parallel across lines, exactly the CPU loops' structure with
the outer loop distributed.  Convergence is the CPU's exemplar-history
test verbatim: a bit per node per iteration lands in an n×minIterations
ring, a per-node kernel checks its column is all-0 or all-1, and a
serial kernel folds that to the converged flag.  All iterations encode
up front, flags-guarded; the run reads back only the R+A diagonal the
exemplar extraction needs.
*/

import type { Collection } from '../collection.mjs';
import { wgsl } from '../render/wgsl.mjs';
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
import { BUMP_WORD, WG } from './algo-gpu-dense.mjs';
import {
  apClustersFrom,
  buildAffinitySimilarity,
} from './affinity-propagation.mjs';
import type { AffinityPropagationOptions } from './affinity-propagation.mjs';

/** Damped responsibility update — one invocation per row i.  Pass one
 * finds the top-two of A+S over the row; pass two applies the damped
 * update, with the runner-up standing in for the maximum's own slot. */
const R_UPDATE = wgsl`
struct P { n : u32, r : f32 }
@group(0) @binding(0) var<uniform> p : P;
@group(0) @binding(1) var<storage, read> s : array<f32>;
@group(0) @binding(2) var<storage, read_write> rr : array<f32>;
@group(0) @binding(3) var<storage, read> a : array<f32>;
@group(0) @binding(4) var<storage, read_write> flags : array<atomic<u32>>;

@compute @workgroup_size(${WG})
fn main(@builtin(global_invocation_id) gid : vec3u) {
  if (atomicLoad(&flags[0]) == 1u) { return; }

  let i = gid.x;
  let n = p.n;

  if (i >= n) { return; }

  let damping = p.r;
  var maxAS = -3.4e38;
  var max2 = -3.4e38;
  var maxI = 0u;

  // 'as' is a WGSL reserved word, so the A+S sum is 'combined'
  for (var j = 0u; j < n; j = j + 1u) {
    let combined = a[i * n + j] + s[i * n + j];

    if (combined >= maxAS) {
      max2 = maxAS;
      maxAS = combined;
      maxI = j;
    } else if (combined > max2) {
      max2 = combined;
    }
  }

  for (var j = 0u; j < n; j = j + 1u) {
    let old = rr[i * n + j];
    var ceiling = maxAS;

    if (j == maxI) {
      ceiling = max2;
    }

    rr[i * n + j] =
      (1.0 - damping) * (s[i * n + j] - ceiling) + damping * old;
  }
}
`;

/** Damped availability update — one invocation per column i.  Pass one
 * sums the column's clipped responsibilities; pass two applies the
 * damped update, the diagonal taking the unclipped rule. */
const A_UPDATE = wgsl`
struct P { n : u32, r : f32 }
@group(0) @binding(0) var<uniform> p : P;
@group(0) @binding(1) var<storage, read> rr : array<f32>;
@group(0) @binding(2) var<storage, read_write> a : array<f32>;
@group(0) @binding(3) var<storage, read_write> flags : array<atomic<u32>>;

@compute @workgroup_size(${WG})
fn main(@builtin(global_invocation_id) gid : vec3u) {
  if (atomicLoad(&flags[0]) == 1u) { return; }

  let i = gid.x;
  let n = p.n;

  if (i >= n) { return; }

  let damping = p.r;
  var sum = 0.0;

  for (var j = 0u; j < n; j = j + 1u) {
    if (j == i) {
      sum = sum + rr[i * n + i];
    } else {
      sum = sum + max(0.0, rr[j * n + i]);
    }
  }

  for (var j = 0u; j < n; j = j + 1u) {
    var rp = max(0.0, rr[j * n + i]);

    if (j == i) {
      rp = rr[i * n + i];
    }

    let old = a[j * n + i];
    var next = (1.0 - damping) * min(0.0, sum - rp) + damping * old;

    if (j == i) {
      next = (1.0 - damping) * (sum - rp) + damping * old;
    }

    a[j * n + i] = next;
  }
}
`;

/** Write this iteration's exemplar bit (A+R diagonal > 0) into the
 * n×minIterations history ring — one invocation per node. */
const E_WRITE = wgsl`
struct P { n : u32, r : f32 }
struct Q { mi : u32, maxIter : f32 }
@group(0) @binding(0) var<uniform> p : P;
@group(0) @binding(1) var<uniform> q : Q;
@group(0) @binding(2) var<storage, read> rr : array<f32>;
@group(0) @binding(3) var<storage, read> a : array<f32>;
@group(0) @binding(4) var<storage, read_write> hist : array<u32>;
@group(0) @binding(5) var<storage, read> iter : array<u32>;
@group(0) @binding(6) var<storage, read_write> flags : array<atomic<u32>>;

@compute @workgroup_size(${WG})
fn main(@builtin(global_invocation_id) gid : vec3u) {
  if (atomicLoad(&flags[0]) == 1u) { return; }

  let i = gid.x;
  let n = p.n;

  if (i >= n) { return; }

  var e = 0u;

  if (a[i * n + i] + rr[i * n + i] > 0.0) {
    e = 1u;
  }

  hist[(iter[0] % q.mi) * n + i] = e;
}
`;

/** ok[i] = the node's history column is all-0 or all-1 — one
 * invocation per node. */
const HIST_CHECK = wgsl`
struct P { n : u32, r : f32 }
struct Q { mi : u32, maxIter : f32 }
@group(0) @binding(0) var<uniform> p : P;
@group(0) @binding(1) var<uniform> q : Q;
@group(0) @binding(2) var<storage, read> hist : array<u32>;
@group(0) @binding(3) var<storage, read_write> ok : array<u32>;
@group(0) @binding(4) var<storage, read_write> flags : array<atomic<u32>>;

@compute @workgroup_size(${WG})
fn main(@builtin(global_invocation_id) gid : vec3u) {
  if (atomicLoad(&flags[0]) == 1u) { return; }

  let i = gid.x;

  if (i >= p.n) { return; }

  var se = 0u;

  for (var j = 0u; j < q.mi; j = j + 1u) {
    se = se + hist[j * p.n + i];
  }

  var flag = 0u;

  if (se == 0u || se == q.mi) {
    flag = 1u;
  }

  ok[i] = flag;
}
`;

/** The CPU convergence rule, folded serially: some exemplar exists this
 * iteration, the window is full (or the run is ending), and every
 * node's history column is settled. */
const CONVERGE_AP = wgsl`
struct P { n : u32, r : f32 }
struct Q { mi : u32, maxIter : f32 }
@group(0) @binding(0) var<uniform> p : P;
@group(0) @binding(1) var<uniform> q : Q;
@group(0) @binding(2) var<storage, read> hist : array<u32>;
@group(0) @binding(3) var<storage, read> ok : array<u32>;
@group(0) @binding(4) var<storage, read> iter : array<u32>;
@group(0) @binding(5) var<storage, read_write> flags : array<atomic<u32>>;

@compute @workgroup_size(1)
fn main() {
  if (atomicLoad(&flags[0]) == 1u) { return; }

  let n = p.n;
  let it = iter[0];
  var k = 0u;

  for (var i = 0u; i < n; i = i + 1u) {
    k = k + hist[(it % q.mi) * n + i];
  }

  if (k == 0u) { return; }
  if (f32(it) < f32(q.mi) - 1.0 && f32(it) != q.maxIter - 1.0) { return; }

  var settled = 0u;

  for (var i = 0u; i < n; i = i + 1u) {
    settled = settled + ok[i];
  }

  if (settled == n) {
    atomicStore(&flags[0], 1u);
  }
}
`;

/** diag[i] = R[i][i] + A[i][i] — the exemplar test's input. */
const DIAG_SUM = wgsl`
struct P { n : u32, r : f32 }
@group(0) @binding(0) var<uniform> p : P;
@group(0) @binding(1) var<storage, read> rr : array<f32>;
@group(0) @binding(2) var<storage, read> a : array<f32>;
@group(0) @binding(3) var<storage, read_write> diag : array<f32>;

@compute @workgroup_size(${WG})
fn main(@builtin(global_invocation_id) gid : vec3u) {
  let i = gid.x;

  if (i >= p.n) { return; }

  diag[i] = rr[i * p.n + i] + a[i * p.n + i];
}
`;

/**
 * The GPU affinity-propagation executor.  Semantics match the CPU
 * reference: damped R/A message passing on the shared similarity
 * matrix, the exemplar-history convergence rule, then the shared
 * assignment tail over the read-back diagonal.
 *
 * @param ctx — the shared device state
 * @param coll — the calling collection
 * @param options — as the CPU reference
 * @returns one collection per exemplar
 * @throws as the CPU reference on invalid damping/preference;
 *   GpuUnfitError when n² floats exceed the device's buffer limit
 */
export const affinityPropagationGpu = async (
  ctx: AlgoGpu,
  coll: Collection,
  options: AffinityPropagationOptions = {},
): Promise<Collection[]> => {
  const { nodes, n, S, damping, maxIterations, minIterations } =
    buildAffinitySimilarity(coll, options);

  if (n === 0) {
    return [];
  }

  const bytes = n * n * 4;

  assertFits(
    ctx,
    Math.max(bytes, n * minIterations * 4),
    'affinityPropagation',
  );

  const sBuf = storageFrom(ctx, Float32Array.from(S));
  const rBuf = storageOf(ctx, bytes);
  const aBuf = storageOf(ctx, bytes);
  const hist = storageOf(ctx, n * minIterations * 4);
  const ok = storageOf(ctx, n * 4);
  const diag = storageOf(ctx, n * 4);
  const iterBuf = storageFrom(ctx, new Uint32Array([0]));
  const flags = storageFrom(ctx, new Uint32Array([0]));
  const pN = paramsNR(ctx, n, damping);

  const qBytes = new ArrayBuffer(8);

  new Uint32Array(qBytes)[0] = minIterations;
  new Float32Array(qBytes)[1] = maxIterations;

  const pQu = uniformFrom(ctx, new Uint32Array(qBytes));

  const rUpdate = getPipeline(ctx, 'ap-r-update', R_UPDATE);
  const aUpdate = getPipeline(ctx, 'ap-a-update', A_UPDATE);
  const eWrite = getPipeline(ctx, 'ap-e-write', E_WRITE);
  const histCheck = getPipeline(ctx, 'ap-hist-check', HIST_CHECK);
  const converge = getPipeline(ctx, 'ap-converge', CONVERGE_AP);
  const diagSum = getPipeline(ctx, 'ap-diag-sum', DIAG_SUM);
  const bump = getPipeline(ctx, 'bump-word', BUMP_WORD);

  const grid: [number] = [Math.ceil(n / WG)];
  const one: [number] = [1];
  const iteration: Dispatch[] = [
    {
      pipeline: rUpdate,
      group: groupFor(ctx, rUpdate, [pN, sBuf, rBuf, aBuf, flags]),
      groups: grid,
    },
    {
      pipeline: aUpdate,
      group: groupFor(ctx, aUpdate, [pN, rBuf, aBuf, flags]),
      groups: grid,
    },
    {
      pipeline: eWrite,
      group: groupFor(ctx, eWrite, [pN, pQu, rBuf, aBuf, hist, iterBuf, flags]),
      groups: grid,
    },
    {
      pipeline: histCheck,
      group: groupFor(ctx, histCheck, [pN, pQu, hist, ok, flags]),
      groups: grid,
    },
    {
      pipeline: converge,
      group: groupFor(ctx, converge, [pN, pQu, hist, ok, iterBuf, flags]),
      groups: one,
    },
    { pipeline: bump, group: groupFor(ctx, bump, [iterBuf]), groups: one },
  ];

  const all: Dispatch[] = [];

  for (let it = 0; it < maxIterations; it++) {
    all.push(...iteration);
  }

  all.push({
    pipeline: diagSum,
    group: groupFor(ctx, diagSum, [pN, rBuf, aBuf, diag]),
    groups: grid,
  });

  submitPass(ctx, all);

  const diagOut = new Float32Array(await readBack(ctx, diag, n * 4));

  for (const buffer of [
    sBuf,
    rBuf,
    aBuf,
    hist,
    ok,
    diag,
    iterBuf,
    flags,
    pN,
    pQu,
  ]) {
    buffer.destroy();
  }

  const exemplarsIndices: number[] = [];

  for (let i = 0; i < n; i++) {
    if (diagOut[i] > 0) {
      exemplarsIndices.push(i);
    }
  }

  return apClustersFrom(coll, nodes, n, S, exemplarsIndices);
};
