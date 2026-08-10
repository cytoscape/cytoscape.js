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
import { WG } from './algo-gpu-dense.mjs';
import {
  apClustersFrom,
  buildAffinitySimilarity,
} from './affinity-propagation.mjs';
import type { AffinityPropagationOptions } from './affinity-propagation.mjs';

/** Damped responsibility update — one *workgroup* per row i
 * (round 65.8; the one-invocation-per-row version left the device
 * idle).  Phase one tree-reduces the row's top-two of A+S with the
 * CPU's exact tie-break — the champion compares (value, index)
 * lexicographically, matching the reference's ascending `>=` scan
 * where the *last* equal value wins — and phase two applies the
 * damped update with all lanes writing the row coalesced. */
const R_UPDATE = wgsl`
struct P { n : u32, r : f32 }
@group(0) @binding(0) var<uniform> p : P;
@group(0) @binding(1) var<storage, read> s : array<f32>;
@group(0) @binding(2) var<storage, read_write> rr : array<f32>;
@group(0) @binding(3) var<storage, read> a : array<f32>;
@group(0) @binding(4) var<storage, read_write> flags : array<atomic<u32>>;

var<workgroup> sm1 : array<f32, ${WG}>;
var<workgroup> sm2 : array<f32, ${WG}>;
var<workgroup> si1 : array<u32, ${WG}>;
var<workgroup> wflag : u32;

@compute @workgroup_size(${WG})
fn main(
  @builtin(workgroup_id) wid : vec3u,
  @builtin(local_invocation_id) lid : vec3u,
) {
  if (lid.x == 0u) { wflag = atomicLoad(&flags[0]); }
  if (workgroupUniformLoad(&wflag) == 1u) { return; }

  let i = wid.x;
  let n = p.n;
  let damping = p.r;

  // local ascending scan: the CPU's >= rule (later equal j replaces)
  var m1 = -3.4e38;
  var m2 = -3.4e38;
  var i1 = 0u;

  for (var j = lid.x; j < n; j = j + ${WG}u) {
    let combined = a[i * n + j] + s[i * n + j];

    if (combined >= m1) {
      m2 = m1;
      m1 = combined;
      i1 = j;
    } else if (combined > m2) {
      m2 = combined;
    }
  }

  sm1[lid.x] = m1;
  sm2[lid.x] = m2;
  si1[lid.x] = i1;
  workgroupBarrier();

  for (var stride = ${WG / 2}u; stride > 0u; stride = stride >> 1u) {
    if (lid.x < stride) {
      let bm1 = sm1[lid.x + stride];
      let bm2 = sm2[lid.x + stride];
      let bi1 = si1[lid.x + stride];

      // champion by (value, index): the larger value wins, and on an
      // exact tie the larger index — the CPU's last-max rule
      if (bm1 > sm1[lid.x] || (bm1 == sm1[lid.x] && bi1 > si1[lid.x])) {
        sm2[lid.x] = max(sm1[lid.x], bm2);
        sm1[lid.x] = bm1;
        si1[lid.x] = bi1;
      } else {
        sm2[lid.x] = max(sm2[lid.x], bm1);
      }
    }
    workgroupBarrier();
  }

  let maxAS = sm1[0];
  let max2 = sm2[0];
  let maxI = si1[0];

  for (var j = lid.x; j < n; j = j + ${WG}u) {
    let old = rr[i * n + j];
    var ceiling = maxAS;

    if (j == maxI) {
      ceiling = max2;
    }

    rr[i * n + j] = (1.0 - damping) * (s[i * n + j] - ceiling) + damping * old;
  }
}
`;

/** Damped availability update — one *workgroup* per column i
 * (round 65.8): phase one tree-reduces the column's clipped
 * responsibility sum, phase two applies the damped update with the
 * diagonal taking the unclipped rule. */
const A_UPDATE = wgsl`
struct P { n : u32, r : f32 }
@group(0) @binding(0) var<uniform> p : P;
@group(0) @binding(1) var<storage, read> rr : array<f32>;
@group(0) @binding(2) var<storage, read_write> a : array<f32>;
@group(0) @binding(3) var<storage, read_write> flags : array<atomic<u32>>;

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
  let n = p.n;
  let damping = p.r;
  var sum = 0.0;

  for (var j = lid.x; j < n; j = j + ${WG}u) {
    if (j == i) {
      sum = sum + rr[i * n + i];
    } else {
      sum = sum + max(0.0, rr[j * n + i]);
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

  let total = partial[0];

  for (var j = lid.x; j < n; j = j + ${WG}u) {
    var rp = max(0.0, rr[j * n + i]);

    if (j == i) {
      rp = rr[i * n + i];
    }

    let old = a[j * n + i];
    var next = (1.0 - damping) * min(0.0, total - rp) + damping * old;

    if (j == i) {
      next = (1.0 - damping) * (total - rp) + damping * old;
    }

    a[j * n + i] = next;
  }
}
`;

/** Track this iteration per node (round 65.8, fusing the old E-write
 * and history-check kernels — safe because a node's history column is
 * only ever written by its own invocation): write the exemplar bit
 * into the ring, then re-check the column is all-0 or all-1. */
const AP_TRACK = wgsl`
struct P { n : u32, r : f32 }
struct Q { mi : u32, maxIter : f32 }
@group(0) @binding(0) var<uniform> p : P;
@group(0) @binding(1) var<uniform> q : Q;
@group(0) @binding(2) var<storage, read> rr : array<f32>;
@group(0) @binding(3) var<storage, read> a : array<f32>;
@group(0) @binding(4) var<storage, read_write> hist : array<u32>;
@group(0) @binding(5) var<storage, read> iter : array<u32>;
@group(0) @binding(6) var<storage, read_write> ok : array<u32>;
@group(0) @binding(7) var<storage, read_write> flags : array<atomic<u32>>;

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

  var se = 0u;

  for (var j = 0u; j < q.mi; j = j + 1u) {
    se = se + hist[j * n + i];
  }

  var flag = 0u;

  if (se == 0u || se == q.mi) {
    flag = 1u;
  }

  ok[i] = flag;
}
`;

/** The CPU convergence rule, tree-reduced in one workgroup (round
 * 65.8 — the serial single-invocation fold was latency-bound), plus
 * the iteration bump the old separate kernel carried: some exemplar
 * exists this iteration, the window is full (or the run is ending),
 * and every node's history column is settled. */
const AP_CONVERGE = wgsl`
struct P { n : u32, r : f32 }
struct Q { mi : u32, maxIter : f32 }
@group(0) @binding(0) var<uniform> p : P;
@group(0) @binding(1) var<uniform> q : Q;
@group(0) @binding(2) var<storage, read> hist : array<u32>;
@group(0) @binding(3) var<storage, read> ok : array<u32>;
@group(0) @binding(4) var<storage, read_write> iter : array<u32>;
@group(0) @binding(5) var<storage, read_write> flags : array<atomic<u32>>;

var<workgroup> pk : array<u32, ${WG}>;
var<workgroup> ps : array<u32, ${WG}>;
var<workgroup> wflag : u32;

@compute @workgroup_size(${WG})
fn main(@builtin(local_invocation_id) lid : vec3u) {
  if (lid.x == 0u) { wflag = atomicLoad(&flags[0]); }
  if (workgroupUniformLoad(&wflag) == 1u) { return; }

  let n = p.n;
  let it = iter[0];
  var k = 0u;
  var settled = 0u;

  for (var i = lid.x; i < n; i = i + ${WG}u) {
    k = k + hist[(it % q.mi) * n + i];
    settled = settled + ok[i];
  }

  pk[lid.x] = k;
  ps[lid.x] = settled;
  workgroupBarrier();

  for (var stride = ${WG / 2}u; stride > 0u; stride = stride >> 1u) {
    if (lid.x < stride) {
      pk[lid.x] = pk[lid.x] + pk[lid.x + stride];
      ps[lid.x] = ps[lid.x] + ps[lid.x + stride];
    }
    workgroupBarrier();
  }

  if (lid.x == 0u) {
    let windowReady =
      f32(it) >= f32(q.mi) - 1.0 || f32(it) == q.maxIter - 1.0;

    if (pk[0] > 0u && windowReady && ps[0] == n) {
      atomicStore(&flags[0], 1u);
    }

    iter[0] = it + 1u;
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
  const track = getPipeline(ctx, 'ap-track', AP_TRACK);
  const converge = getPipeline(ctx, 'ap-converge', AP_CONVERGE);
  const diagSum = getPipeline(ctx, 'ap-diag-sum', DIAG_SUM);

  const grid: [number] = [Math.ceil(n / WG)];
  const one: [number] = [1];
  const iteration: Dispatch[] = [
    {
      pipeline: rUpdate,
      // one workgroup per row
      group: groupFor(ctx, rUpdate, [pN, sBuf, rBuf, aBuf, flags]),
      groups: [n],
    },
    {
      pipeline: aUpdate,
      // one workgroup per column
      group: groupFor(ctx, aUpdate, [pN, rBuf, aBuf, flags]),
      groups: [n],
    },
    {
      pipeline: track,
      group: groupFor(ctx, track, [
        pN,
        pQu,
        rBuf,
        aBuf,
        hist,
        iterBuf,
        ok,
        flags,
      ]),
      groups: grid,
    },
    {
      pipeline: converge,
      group: groupFor(ctx, converge, [pN, pQu, hist, ok, iterBuf, flags]),
      groups: one,
    },
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
