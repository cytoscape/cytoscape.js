/*
All-pairs random-walk-with-restart proximity on the GPU (round 70).

The CPU reference (`random-walk.mts`) is the spec: it solves one
sparse seed vector per column, and both executors converge to the
same fixed point S = c·(I − (1−c)·W)⁻¹.  The GPU iterates the whole
matrix at once — S′ = M·S + c·I with M = (1−c)·W — one shared tiled
matmul plus an epilogue (add the restart diagonal, compare, write)
per step, every iteration encoded up front behind the converge flag,
one readback.
*/

import { wgsl } from '../render/wgsl.mjs';
import type { SubgraphView } from './algo-shared.mjs';
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
  MATMUL,
  MM_TILE,
  RESET_DIFF,
  TILE,
} from './algo-gpu-dense.mjs';
import {
  buildWalkArcs,
  resolveRestartProbability,
  rwrProximityResultFrom,
} from './random-walk.mjs';
import type {
  RandomWalkWithRestartOptions,
  RandomWalkWithRestartProximityResult,
} from './random-walk.mjs';

/** The per-iteration epilogue: s = t + c on the diagonal (the
 * Neumann step's restart term), with the any-difference bit set when
 * an element moved past the tolerance.  Element-wise, so reading and
 * writing `s` in one dispatch races nothing. */
const RWR_EPI = wgsl`
struct RP { n : u32, c : f32, tol : f32 }
@group(0) @binding(0) var<uniform> rp : RP;
@group(0) @binding(1) var<storage, read> t : array<f32>;
@group(0) @binding(2) var<storage, read_write> s : array<f32>;
@group(0) @binding(3) var<storage, read_write> flags : array<atomic<u32>>;

@compute @workgroup_size(${TILE}, ${TILE})
fn main(@builtin(global_invocation_id) gid : vec3u) {
  if (atomicLoad(&flags[0]) == 1u) { return; }
  if (gid.x >= rp.n || gid.y >= rp.n) { return; }

  let i = gid.y * rp.n + gid.x;
  var next = t[i];

  if (gid.x == gid.y) { next = next + rp.c; }

  if (abs(next - s[i]) > rp.tol) {
    atomicStore(&flags[1], 1u);
  }

  s[i] = next;
}
`;

/**
 * The GPU proximity executor.  Semantics match the CPU reference: the
 * same normalized walk, the same fixed point — iterated in f32 as a
 * whole matrix rather than in f64 a column at a time, so proximities
 * can differ in float detail.
 *
 * @param ctx — the shared device state
 * @param view — the subgraph view
 * @param options — as the CPU reference
 * @returns the `{ proximity }` accessor over the read-back matrix
 * @throws GpuUnfitError when n² floats exceed the device's buffer
 *   limit; also if `restartProbability` is invalid
 */
export const rwrProximityGpu = async (
  ctx: AlgoGpu,
  view: SubgraphView,
  options: RandomWalkWithRestartOptions = {},
): Promise<RandomWalkWithRestartProximityResult> => {
  const c = resolveRestartProbability(options);
  const maxIterations = options.maxIterations ?? 200;
  const tolerance = options.tolerance ?? 0.000001;
  const n = view.nodeSlots.length;

  assertFits(ctx, n * n * 4, 'randomWalkWithRestartProximity');

  if (n === 0) {
    return rwrProximityResultFrom(view, []);
  }

  const walk = buildWalkArcs(view, options);
  const m32 = new Float32Array(n * n);
  const follow = 1 - c;

  for (let a = 0; a < walk.arcs; a++) {
    m32[walk.dsts[a] * n + walk.srcs[a]] += follow * walk.ws[a];
  }

  const s32 = new Float32Array(n * n);

  for (let i = 0; i < n; i++) {
    s32[i * n + i] = c; // S⁰ = c·I, the series' first term
  }

  const m = storageFrom(ctx, m32);
  const s = storageFrom(ctx, s32);
  const t = storageOf(ctx, n * n * 4);
  const flags = storageFrom(ctx, new Uint32Array([0, 0]));
  const pN = paramsNR(ctx, n, 0);

  // RP { n, c, tol }
  const rpBytes = new ArrayBuffer(12);
  const rpWords = new Uint32Array(rpBytes);
  const rpFloats = new Float32Array(rpBytes);

  rpWords[0] = n;
  rpFloats[1] = c;
  rpFloats[2] = tolerance;

  const rp = uniformFrom(ctx, rpWords);

  const matmul = getPipeline(ctx, 'dense-matmul', MATMUL);
  const epi = getPipeline(ctx, 'rwr-epi', RWR_EPI);
  const reset = getPipeline(ctx, 'dense-reset-diff', RESET_DIFF);
  const converge = getPipeline(ctx, 'dense-converge', CONVERGE_ON_NO_DIFF);

  const mmTiles = Math.ceil(n / MM_TILE);
  const cells = Math.ceil(n / TILE);
  const iteration: Dispatch[] = [
    { pipeline: reset, group: groupFor(ctx, reset, [flags]), groups: [1] },
    {
      pipeline: matmul,
      group: groupFor(ctx, matmul, [pN, m, s, t, flags]),
      groups: [mmTiles, mmTiles],
    },
    {
      pipeline: epi,
      group: groupFor(ctx, epi, [rp, t, s, flags]),
      groups: [cells, cells],
    },
    {
      pipeline: converge,
      group: groupFor(ctx, converge, [flags]),
      groups: [1],
    },
  ];

  const all: Dispatch[] = [];

  for (let it = 0; it < maxIterations; it++) {
    all.push(...iteration);
  }

  submitPass(ctx, all);

  const out = new Float32Array(await readBack(ctx, s, n * n * 4));

  for (const buffer of [m, s, t, flags, pN, rp]) {
    buffer.destroy();
  }

  return rwrProximityResultFrom(view, out);
};
