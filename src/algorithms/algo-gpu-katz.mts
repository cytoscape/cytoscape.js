/*
Katz centrality on the GPU (round 69).

The CPU reference (`katz-centrality.mts`) is the spec: both executors
iterate the same attenuated fixed point x' = α·Aᵀ·x + β to the same
L1 stopping rule.  The GPU runs pageRank's flags-guarded mat-vec (the
matrix carries α already) with a Katz epilogue — add β, accumulate the
L1 step, set the converge bit — every iteration encoded up front, one
readback (the round-9 discipline).  Like pageRank, the dense mat-vec
never beats the sparse CPU under 'auto'; this path serves an explicit
`executor: 'gpu'` and the parity suite.
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
import { MATVEC } from './algo-gpu-pagerank.mjs';
import {
  buildKatzMatrix,
  katzResultFrom,
  resolveKatzParams,
} from './katz-centrality.mjs';
import type {
  KatzCentralityOptions,
  KatzCentralityResult,
} from './katz-centrality.mjs';

/** The between-matvec epilogue, pageRank's shape with Katz's maths
 * (round 69): v' = tmp + β per lane, the L1 step accumulated and
 * tree-reduced, and the converge bit set once it drops under
 * n·tolerance (kp.thresh — pre-multiplied on the CPU).  One
 * single-workgroup dispatch per iteration; the flags guard makes a
 * post-converge iteration cost a flag read. */
const KATZ_EPILOGUE = wgsl`
struct KP { n : u32, beta : f32, thresh : f32 }
@group(0) @binding(0) var<uniform> kp : KP;
@group(0) @binding(1) var<storage, read> tmp : array<f32>;
@group(0) @binding(2) var<storage, read_write> v : array<f32>;
@group(0) @binding(3) var<storage, read_write> flags : array<atomic<u32>>;

var<workgroup> partial : array<f32, ${WG}>;
var<workgroup> wflag : u32;

@compute @workgroup_size(${WG})
fn main(@builtin(local_invocation_id) lid : vec3u) {
  if (lid.x == 0u) { wflag = atomicLoad(&flags[0]); }
  if (workgroupUniformLoad(&wflag) == 1u) { return; }

  var d = 0.0;

  for (var i = lid.x; i < kp.n; i = i + ${WG}u) {
    let next = tmp[i] + kp.beta;

    d = d + abs(v[i] - next);
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

  if (lid.x == 0u && partial[0] < kp.thresh) {
    atomicStore(&flags[0], 1u);
  }
}
`;

/**
 * The GPU Katz executor.  Semantics match the CPU reference: the
 * attenuated fixed-point iteration from x = 0, stopping once the L1
 * step drops under n·tolerance, up to `maxIterations` passes.
 *
 * @param ctx — the shared device state
 * @param coll — the calling collection
 * @param options — as the CPU reference
 * @returns the `{ katz, katzNormalized }` accessors over the read-back
 *   vector
 * @throws GpuUnfitError when n² floats exceed the device's buffer
 *   limit; also if `alpha`/`beta` are invalid (see `resolveKatzParams`)
 */
export const katzCentralityGpu = async (
  ctx: AlgoGpu,
  coll: Collection,
  options: KatzCentralityOptions = {},
): Promise<KatzCentralityResult> => {
  const { beta } = resolveKatzParams(options);
  const maxIterations = options.maxIterations ?? 200;
  const tolerance = options.tolerance ?? 0.000001;

  const { view, n, matrix } = buildKatzMatrix(coll, options);

  if (n === 0) {
    return katzResultFrom(view, []);
  }

  assertFits(ctx, n * n * 4, 'katzCentrality');

  const m = storageFrom(ctx, Float32Array.from(matrix));
  const v = storageFrom(ctx, new Float32Array(n)); // x⁰ = 0, as on CPU
  const tmp = storageOf(ctx, n * 4);
  const flags = storageFrom(ctx, new Uint32Array([0]));
  const pIter = paramsNR(ctx, n, 0);

  // KP { n, beta, thresh } — the L1 bound n·tolerance premultiplied
  const kpBytes = new ArrayBuffer(12);
  const kpWords = new Uint32Array(kpBytes);
  const kpFloats = new Float32Array(kpBytes);

  kpWords[0] = n;
  kpFloats[1] = beta;
  kpFloats[2] = n * tolerance;

  const kp = uniformFrom(ctx, kpWords);

  const matvec = getPipeline(ctx, 'pr-matvec', MATVEC);
  const epilogue = getPipeline(ctx, 'katz-epilogue', KATZ_EPILOGUE);

  const iteration: Dispatch[] = [
    {
      pipeline: matvec,
      // one workgroup per row
      group: groupFor(ctx, matvec, [pIter, m, v, tmp, flags]),
      groups: [n],
    },
    {
      pipeline: epilogue,
      group: groupFor(ctx, epilogue, [kp, tmp, v, flags]),
      groups: [1],
    },
  ];

  const all: Dispatch[] = [];

  for (let it = 0; it < maxIterations; it++) {
    all.push(...iteration);
  }

  submitPass(ctx, all);

  const out = new Float32Array(await readBack(ctx, v, n * 4));

  for (const buffer of [m, v, tmp, flags, pIter, kp]) {
    buffer.destroy();
  }

  return katzResultFrom(view, out);
};
