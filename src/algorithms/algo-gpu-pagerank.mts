/*
PageRank on the GPU (round 65; sparse since 72.1).

The CPU reference (`page-rank.mts`) is the spec: both executors build
the identical sparse transition structure (`buildPageRankSparse`) and
the GPU replaces the power-method loop.  Each iteration is one CSR
SpMV (`algo-gpu-spmv.mts` — the edge-gather term, O(E)) plus one
single-workgroup epilogue carrying the two rank-1 terms the CPU split
out in 65.10: the damping teleport over Σv and the dangling mass over
Σ_dangling v, reduced on the device from the same vector.  All
`iterations` are encoded up front with flags-guarded kernels and the
run pays exactly one readback (the converged vector), matching the CPU
loop's break-at-precision semantics: once the squared step drops under
`precision` the converge bit sets and later kernels no-op.

Round 65's dense n² mat-vec (`MATVEC`) is gone with this: the sparse
kernel is the same maths at O(E) bytes, and it lifted the n²-buffer
`assertFits` ceiling with it.
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
import { csrFromTriplets, spmvDispatch, uploadCsr } from './algo-gpu-spmv.mjs';
import { buildPageRankSparse, pageRankResultFrom } from './page-rank.mjs';
import type { PageRankOptions, PageRankResult } from './page-rank.mjs';

/** The whole between-SpMV epilogue in one single-workgroup kernel
 * (65.8's fused shape, with 72.1's rank-1 terms): reduce Σ tmp, Σ v
 * and Σ_dangling v together; base = teleport·Σv + Σ_dangling/n and
 * total = Σtmp + n·base are then the CPU's `base` and `sum`; scale
 * v = (tmp + base)/total (skipping a zero total, as on the CPU),
 * accumulate the squared step per lane, reduce it, and set the
 * converge bit when it drops under precision.  The barriers between
 * the reductions' readouts and the array reuse are load-bearing. */
const EPILOGUE = wgsl`
struct PR { n : u32, eps : f32, dangling : u32, teleport : f32 }
@group(0) @binding(0) var<uniform> pr : PR;
@group(0) @binding(1) var<storage, read> tmp : array<f32>;
@group(0) @binding(2) var<storage, read_write> v : array<f32>;
@group(0) @binding(3) var<storage, read> dangIdx : array<u32>;
@group(0) @binding(4) var<storage, read_write> flags : array<atomic<u32>>;

var<workgroup> pt : array<f32, ${WG}>;
var<workgroup> pv : array<f32, ${WG}>;
var<workgroup> pd : array<f32, ${WG}>;
var<workgroup> wflag : u32;

@compute @workgroup_size(${WG})
fn main(@builtin(local_invocation_id) lid : vec3u) {
  if (lid.x == 0u) { wflag = atomicLoad(&flags[0]); }
  if (workgroupUniformLoad(&wflag) == 1u) { return; }

  let n = pr.n;
  var st = 0.0;
  var sv = 0.0;
  var sd = 0.0;

  for (var i = lid.x; i < n; i = i + ${WG}u) {
    st = st + tmp[i];
    sv = sv + v[i];
  }

  for (var k = lid.x; k < pr.dangling; k = k + ${WG}u) {
    sd = sd + v[dangIdx[k]];
  }

  pt[lid.x] = st;
  pv[lid.x] = sv;
  pd[lid.x] = sd;
  workgroupBarrier();

  for (var stride = ${WG / 2}u; stride > 0u; stride = stride >> 1u) {
    if (lid.x < stride) {
      pt[lid.x] = pt[lid.x] + pt[lid.x + stride];
      pv[lid.x] = pv[lid.x] + pv[lid.x + stride];
      pd[lid.x] = pd[lid.x] + pd[lid.x + stride];
    }
    workgroupBarrier();
  }

  let base = pr.teleport * pv[0] + pd[0] / f32(n);
  let total = pt[0] + f32(n) * base;

  workgroupBarrier();

  var d = 0.0;

  for (var i = lid.x; i < n; i = i + ${WG}u) {
    var next = tmp[i] + base;

    if (total != 0.0) {
      next = next / total;
    }

    let delta = v[i] - next;

    d = d + delta * delta;
    v[i] = next;
  }

  pt[lid.x] = d;
  workgroupBarrier();

  for (var stride = ${WG / 2}u; stride > 0u; stride = stride >> 1u) {
    if (lid.x < stride) {
      pt[lid.x] = pt[lid.x] + pt[lid.x + stride];
    }
    workgroupBarrier();
  }

  if (lid.x == 0u && pt[0] < pr.eps) {
    atomicStore(&flags[0], 1u);
  }
}
`;

/**
 * The GPU PageRank executor.  Semantics match the CPU reference: the
 * power method on the shared sparse transition structure,
 * sum-normalized per iteration, stopping once the squared step drops
 * under `precision`.
 *
 * @param ctx — the shared device state
 * @param coll — the calling collection
 * @param options — as the CPU reference
 * @returns the `{ rank }` accessor over the read-back vector
 * @throws GpuUnfitError when the CSR (E entries) or a vector exceeds
 *   the device's buffer limit
 */
export const pageRankGpu = async (
  ctx: AlgoGpu,
  coll: Collection,
  options: PageRankOptions = {},
): Promise<PageRankResult> => {
  const precision = options.precision ?? 0.000001;
  const iterations = options.iterations ?? 200;

  const { view, n, edges, srcs, dsts, ws, dangling, additionalProb } =
    buildPageRankSparse(coll, options);

  if (n === 0) {
    return pageRankResultFrom(view, []);
  }

  assertFits(ctx, Math.max(edges, n) * 4, 'pageRank');

  // rows gather from sources: row = target, column = source
  const csr = uploadCsr(ctx, csrFromTriplets(n, dsts, srcs, ws, edges));
  const v = storageFrom(ctx, new Float32Array(n).fill(1));
  const tmp = storageOf(ctx, n * 4);
  const flags = storageFrom(ctx, new Uint32Array([0]));
  const dangIdx = storageFrom(ctx, Uint32Array.from(dangling));
  const pIter = paramsNR(ctx, n, 0);

  // PR { n, eps (precision — a WGSL reserved word), dangling, teleport }
  const prBytes = new ArrayBuffer(16);
  const prWords = new Uint32Array(prBytes);
  const prFloats = new Float32Array(prBytes);

  prWords[0] = n;
  prFloats[1] = precision;
  prWords[2] = dangling.length;
  prFloats[3] = additionalProb;

  const pr = uniformFrom(ctx, prWords);
  const epilogue = getPipeline(ctx, 'pr-epilogue', EPILOGUE);

  const iteration: Dispatch[] = [
    spmvDispatch(ctx, n, pIter, csr, v, tmp, flags),
    {
      pipeline: epilogue,
      group: groupFor(ctx, epilogue, [pr, tmp, v, dangIdx, flags]),
      groups: [1],
    },
  ];

  const all: Dispatch[] = [];

  for (let it = 0; it < iterations; it++) {
    all.push(...iteration);
  }

  submitPass(ctx, all);

  const out = new Float32Array(await readBack(ctx, v, n * 4));

  for (const buffer of [
    csr.rowPtr,
    csr.colIdx,
    csr.vals,
    v,
    tmp,
    flags,
    dangIdx,
    pIter,
    pr,
  ]) {
    buffer.destroy();
  }

  return pageRankResultFrom(view, out);
};
