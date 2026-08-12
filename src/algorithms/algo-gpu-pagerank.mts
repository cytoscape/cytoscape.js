/*
PageRank on the GPU (round 65).

The CPU reference (`page-rank.mts`) is the spec: both executors build
the identical f64 transition matrix; the GPU replaces the power-method
loop.  Each iteration is a dense mat-vec (one invocation per row) plus
three tiny serial kernels (sum, scale+diff, converge) — the serial
kernels are O(n) on one invocation, which at these n costs microseconds
and saves the two-stage-reduction machinery.  All `iterations` are
encoded up front with flags-guarded kernels and the run pays exactly
one readback (the converged vector), matching the CPU loop's
break-at-precision semantics: once the squared diff drops under
`precision` the converge bit sets and later kernels no-op.
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
} from './algo-gpu.mjs';
import type { Dispatch } from './algo-gpu.mjs';
import { WG } from './algo-gpu-dense.mjs';
import { buildPageRankMatrix, pageRankResultFrom } from './page-rank.mjs';
import type { PageRankOptions, PageRankResult } from './page-rank.mjs';

/** tmp = matrix × vec — one *workgroup* per row (round 65.8): 256
 * invocations stride the row (coalesced — consecutive invocations read
 * consecutive columns) and tree-reduce in workgroup memory.  The
 * original one-invocation-per-row version launched n threads total —
 * two workgroups at n=512 — and left the device idle; this shape is
 * what moved pageRank's crossover left.  The converge guard branches
 * the *work* and the store, never the barriers (uniformity analysis
 * forbids a divergent return before workgroupBarrier).  Exported since
 * round 69: the kernel is a generic flags-guarded tmp = m × v, and the
 * Katz iteration runs the identical product with its own epilogue. */
export const MATVEC = wgsl`
struct P { n : u32, r : f32 }
@group(0) @binding(0) var<uniform> p : P;
@group(0) @binding(1) var<storage, read> m : array<f32>;
@group(0) @binding(2) var<storage, read> v : array<f32>;
@group(0) @binding(3) var<storage, read_write> tmp : array<f32>;
@group(0) @binding(4) var<storage, read_write> flags : array<atomic<u32>>;

var<workgroup> partial : array<f32, ${WG}>;
var<workgroup> wflag : u32;

@compute @workgroup_size(${WG})
fn main(
  @builtin(workgroup_id) wid : vec3u,
  @builtin(local_invocation_id) lid : vec3u,
) {
  // workgroupUniformLoad makes the converged bit *uniform*, so the
  // whole workgroup may return before its barriers — a post-converge
  // no-op costs a flag read instead of a full reduction
  if (lid.x == 0u) { wflag = atomicLoad(&flags[0]); }
  if (workgroupUniformLoad(&wflag) == 1u) { return; }

  let i = wid.x;
  let n = p.n;
  var s = 0.0;

  for (var j = lid.x; j < n; j = j + ${WG}u) {
    s = s + m[i * n + j] * v[j];
  }

  partial[lid.x] = s;
  workgroupBarrier();

  for (var stride = ${WG / 2}u; stride > 0u; stride = stride >> 1u) {
    if (lid.x < stride) {
      partial[lid.x] = partial[lid.x] + partial[lid.x + stride];
    }
    workgroupBarrier();
  }

  if (lid.x == 0u) {
    tmp[i] = partial[0];
  }
}
`;

/** The whole between-matvec epilogue in one single-workgroup kernel
 * (round 65.8): reduce Σ tmp, scale v = tmp/Σ (skipping a zero sum,
 * as on the CPU), accumulate the squared step per lane, reduce it,
 * and set the converge bit when it drops under precision (p.r).  One
 * dispatch instead of three — at 200 encoded iterations the
 * per-dispatch overhead inside the pass was the dominant cost after
 * the matvec went workgroup-per-row.  The barrier after the first
 * reduction's readout is load-bearing: every lane reads partial[0]
 * before any lane reuses the array for the second reduction. */
const EPILOGUE = wgsl`
struct P { n : u32, r : f32 }
@group(0) @binding(0) var<uniform> p : P;
@group(0) @binding(1) var<storage, read> tmp : array<f32>;
@group(0) @binding(2) var<storage, read_write> v : array<f32>;
@group(0) @binding(3) var<storage, read_write> flags : array<atomic<u32>>;

var<workgroup> partial : array<f32, ${WG}>;
var<workgroup> wflag : u32;

@compute @workgroup_size(${WG})
fn main(@builtin(local_invocation_id) lid : vec3u) {
  if (lid.x == 0u) { wflag = atomicLoad(&flags[0]); }
  if (workgroupUniformLoad(&wflag) == 1u) { return; }

  var s = 0.0;

  for (var i = lid.x; i < p.n; i = i + ${WG}u) {
    s = s + tmp[i];
  }

  partial[lid.x] = s;
  workgroupBarrier();

  for (var stride = ${WG / 2}u; stride > 0u; stride = stride >> 1u) {
    if (lid.x < stride) {
      partial[lid.x] = partial[lid.x] + partial[lid.x + stride];
    }
    workgroupBarrier();
  }

  let total = partial[0];

  workgroupBarrier();

  var d = 0.0;

  for (var i = lid.x; i < p.n; i = i + ${WG}u) {
    var next = tmp[i];

    if (total != 0.0) {
      next = next / total;
    }

    let delta = v[i] - next;

    d = d + delta * delta;
    v[i] = next;
  }

  partial[lid.x] = d;
  workgroupBarrier();

  for (var stride = ${WG / 2}u; stride > 0u; stride = stride >> 1u) {
    if (lid.x < stride) {
      partial[lid.x] = partial[lid.x] + partial[lid.x + stride];
    }
    workgroupBarrier();
  }

  if (lid.x == 0u && partial[0] < p.r) {
    atomicStore(&flags[0], 1u);
  }
}
`;

/**
 * The GPU PageRank executor.  Semantics match the CPU reference: the
 * power method on the shared transition matrix, sum-normalized per
 * iteration, stopping once the squared step drops under `precision`.
 *
 * @param ctx — the shared device state
 * @param coll — the calling collection
 * @param options — as the CPU reference
 * @returns the `{ rank }` accessor over the read-back vector
 * @throws GpuUnfitError when n² floats exceed the device's buffer limit
 */
export const pageRankGpu = async (
  ctx: AlgoGpu,
  coll: Collection,
  options: PageRankOptions = {},
): Promise<PageRankResult> => {
  const precision = options.precision ?? 0.000001;
  const iterations = options.iterations ?? 200;

  const { view, n, matrix } = buildPageRankMatrix(coll, options);

  if (n === 0) {
    return pageRankResultFrom(view, []);
  }

  assertFits(ctx, n * n * 4, 'pageRank');

  const m = storageFrom(ctx, Float32Array.from(matrix));
  const v = storageFrom(ctx, new Float32Array(n).fill(1));
  const tmp = storageOf(ctx, n * 4);
  const flags = storageFrom(ctx, new Uint32Array([0]));
  const pIter = paramsNR(ctx, n, precision);

  const matvec = getPipeline(ctx, 'pr-matvec', MATVEC);
  const epilogue = getPipeline(ctx, 'pr-epilogue', EPILOGUE);

  const iteration: Dispatch[] = [
    {
      pipeline: matvec,
      // one workgroup per row
      group: groupFor(ctx, matvec, [pIter, m, v, tmp, flags]),
      groups: [n],
    },
    {
      pipeline: epilogue,
      group: groupFor(ctx, epilogue, [pIter, tmp, v, flags]),
      groups: [1],
    },
  ];

  const all: Dispatch[] = [];

  for (let it = 0; it < iterations; it++) {
    all.push(...iteration);
  }

  submitPass(ctx, all);

  const out = new Float32Array(await readBack(ctx, v, n * 4));

  for (const buffer of [m, v, tmp, flags, pIter]) {
    buffer.destroy();
  }

  return pageRankResultFrom(view, out);
};
