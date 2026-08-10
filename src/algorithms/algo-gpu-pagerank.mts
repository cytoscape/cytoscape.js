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

/** tmp = matrix × vec — one invocation per row. */
const MATVEC = wgsl`
struct P { n : u32, r : f32 }
@group(0) @binding(0) var<uniform> p : P;
@group(0) @binding(1) var<storage, read> m : array<f32>;
@group(0) @binding(2) var<storage, read> v : array<f32>;
@group(0) @binding(3) var<storage, read_write> tmp : array<f32>;
@group(0) @binding(4) var<storage, read_write> flags : array<atomic<u32>>;

@compute @workgroup_size(${WG})
fn main(@builtin(global_invocation_id) gid : vec3u) {
  if (atomicLoad(&flags[0]) == 1u) { return; }

  let i = gid.x;

  if (i >= p.n) { return; }

  var s = 0.0;

  for (var j = 0u; j < p.n; j = j + 1u) {
    s = s + m[i * p.n + j] * v[j];
  }

  tmp[i] = s;
}
`;

/** scratch[0] = Σ tmp — one serial invocation. */
const VEC_SUM = wgsl`
struct P { n : u32, r : f32 }
@group(0) @binding(0) var<uniform> p : P;
@group(0) @binding(1) var<storage, read> tmp : array<f32>;
@group(0) @binding(2) var<storage, read_write> scratch : array<f32>;
@group(0) @binding(3) var<storage, read_write> flags : array<atomic<u32>>;

@compute @workgroup_size(1)
fn main() {
  if (atomicLoad(&flags[0]) == 1u) { return; }

  var s = 0.0;

  for (var i = 0u; i < p.n; i = i + 1u) {
    s = s + tmp[i];
  }

  scratch[0] = s;
}
`;

/** v = tmp / scratch[0] (skipping a zero sum, as on the CPU) and the
 * per-element squared delta accumulates into sq for the converge test. */
const SCALE_DIFF = wgsl`
struct P { n : u32, r : f32 }
@group(0) @binding(0) var<uniform> p : P;
@group(0) @binding(1) var<storage, read> tmp : array<f32>;
@group(0) @binding(2) var<storage, read_write> v : array<f32>;
@group(0) @binding(3) var<storage, read_write> sq : array<f32>;
@group(0) @binding(4) var<storage, read> scratch : array<f32>;
@group(0) @binding(5) var<storage, read_write> flags : array<atomic<u32>>;

@compute @workgroup_size(${WG})
fn main(@builtin(global_invocation_id) gid : vec3u) {
  if (atomicLoad(&flags[0]) == 1u) { return; }

  let i = gid.x;

  if (i >= p.n) { return; }

  var next = tmp[i];

  if (scratch[0] != 0.0) {
    next = next / scratch[0];
  }

  let delta = v[i] - next;

  sq[i] = delta * delta;
  v[i] = next;
}
`;

/** Converge when Σ sq < precision (p.r) — one serial invocation. */
const CONVERGE = wgsl`
struct P { n : u32, r : f32 }
@group(0) @binding(0) var<uniform> p : P;
@group(0) @binding(1) var<storage, read> sq : array<f32>;
@group(0) @binding(2) var<storage, read_write> flags : array<atomic<u32>>;

@compute @workgroup_size(1)
fn main() {
  if (atomicLoad(&flags[0]) == 1u) { return; }

  var s = 0.0;

  for (var i = 0u; i < p.n; i = i + 1u) {
    s = s + sq[i];
  }

  if (s < p.r) {
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
  const sq = storageOf(ctx, n * 4);
  const scratch = storageOf(ctx, 4);
  const flags = storageFrom(ctx, new Uint32Array([0]));
  const pIter = paramsNR(ctx, n, precision);

  const matvec = getPipeline(ctx, 'pr-matvec', MATVEC);
  const vecSum = getPipeline(ctx, 'pr-vec-sum', VEC_SUM);
  const scaleDiff = getPipeline(ctx, 'pr-scale-diff', SCALE_DIFF);
  const converge = getPipeline(ctx, 'pr-converge', CONVERGE);

  const grid: [number] = [Math.ceil(n / WG)];
  const one: [number] = [1];
  const iteration: Dispatch[] = [
    {
      pipeline: matvec,
      group: groupFor(ctx, matvec, [pIter, m, v, tmp, flags]),
      groups: grid,
    },
    {
      pipeline: vecSum,
      group: groupFor(ctx, vecSum, [pIter, tmp, scratch, flags]),
      groups: one,
    },
    {
      pipeline: scaleDiff,
      group: groupFor(ctx, scaleDiff, [pIter, tmp, v, sq, scratch, flags]),
      groups: grid,
    },
    {
      pipeline: converge,
      group: groupFor(ctx, converge, [pIter, sq, flags]),
      groups: one,
    },
  ];

  const all: Dispatch[] = [];

  for (let it = 0; it < iterations; it++) {
    all.push(...iteration);
  }

  submitPass(ctx, all);

  const out = new Float32Array(await readBack(ctx, v, n * 4));

  for (const buffer of [m, v, tmp, sq, scratch, flags, pIter]) {
    buffer.destroy();
  }

  return pageRankResultFrom(view, out);
};
