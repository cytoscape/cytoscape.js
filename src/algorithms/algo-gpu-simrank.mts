/*
SimRank on the GPU (round 70).

The CPU reference (`sim-rank.mts`) is the spec: both executors iterate
the same fixed point S′ = C·Q·S·Qᵀ (diagonal pinned to 1) from S⁰ = I
to the same max-|Δ| stopping rule.  The GPU runs two shared tiled
matmuls per iteration plus one epilogue kernel (decay, pin, compare),
every iteration encoded up front behind the converge flag, one
readback (the round-9 discipline).
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
import { resolveSimRankDamping, simRankResultFrom } from './sim-rank.mjs';
import type { SimRankOptions, SimRankResult } from './sim-rank.mjs';

/** The per-iteration epilogue: s = C·u off the diagonal, 1 on it, and
 * the any-difference bit set when an element moved past the tolerance.
 * Element-wise (each invocation owns its own cell), so reading and
 * writing `s` in one dispatch races nothing. */
const SIMRANK_EPI = wgsl`
struct SP { n : u32, c : f32, tol : f32 }
@group(0) @binding(0) var<uniform> sp : SP;
@group(0) @binding(1) var<storage, read> u : array<f32>;
@group(0) @binding(2) var<storage, read_write> s : array<f32>;
@group(0) @binding(3) var<storage, read_write> flags : array<atomic<u32>>;

@compute @workgroup_size(${TILE}, ${TILE})
fn main(@builtin(global_invocation_id) gid : vec3u) {
  if (atomicLoad(&flags[0]) == 1u) { return; }
  if (gid.x >= sp.n || gid.y >= sp.n) { return; }

  let i = gid.y * sp.n + gid.x;
  var next = sp.c * u[i];

  if (gid.x == gid.y) { next = 1.0; }

  if (abs(next - s[i]) > sp.tol) {
    atomicStore(&flags[1], 1u);
  }

  s[i] = next;
}
`;

/**
 * The GPU SimRank executor.  Semantics match the CPU reference: the
 * same neighborhoods, the same fixed point, the same stopping rule —
 * scores iterate in f32, so they can differ from the CPU's f64 in
 * float detail.
 *
 * @param ctx — the shared device state
 * @param view — the subgraph view
 * @param hoods — from `buildSimRankNeighborhoods` (shared with the
 *   CPU path by the async entry)
 * @param options — as the CPU reference
 * @returns the `{ similarity }` accessor over the read-back matrix
 * @throws GpuUnfitError when n² floats exceed the device's buffer
 *   limit; also if `dampingFactor` is invalid
 */
export const simRankGpu = async (
  ctx: AlgoGpu,
  view: SubgraphView,
  hoods: { inLists: Int32Array[] },
  options: SimRankOptions = {},
): Promise<SimRankResult> => {
  const c = resolveSimRankDamping(options);
  const maxIterations = options.maxIterations ?? 50;
  const tolerance = options.tolerance ?? 0.0001;
  const { inLists } = hoods;
  const n = inLists.length;

  assertFits(ctx, n * n * 4, 'simRank');

  if (n === 0) {
    return simRankResultFrom(view, []);
  }

  const q32 = new Float32Array(n * n);
  const qt32 = new Float32Array(n * n);
  const s32 = new Float32Array(n * n);

  for (let a = 0; a < n; a++) {
    const list = inLists[a];
    const inv = list.length === 0 ? 0 : 1 / list.length;

    for (let k = 0; k < list.length; k++) {
      q32[a * n + list[k]] = inv;
      qt32[list[k] * n + a] = inv;
    }

    s32[a * n + a] = 1;
  }

  const q = storageFrom(ctx, q32);
  const qt = storageFrom(ctx, qt32);
  const s = storageFrom(ctx, s32);
  const t = storageOf(ctx, n * n * 4);
  const u = storageOf(ctx, n * n * 4);
  const flags = storageFrom(ctx, new Uint32Array([0, 0]));
  const pN = paramsNR(ctx, n, 0);

  // SP { n, c, tol }
  const spBytes = new ArrayBuffer(12);
  const spWords = new Uint32Array(spBytes);
  const spFloats = new Float32Array(spBytes);

  spWords[0] = n;
  spFloats[1] = c;
  spFloats[2] = tolerance;

  const sp = uniformFrom(ctx, spWords);

  const matmul = getPipeline(ctx, 'dense-matmul', MATMUL);
  const epi = getPipeline(ctx, 'simrank-epi', SIMRANK_EPI);
  const reset = getPipeline(ctx, 'dense-reset-diff', RESET_DIFF);
  const converge = getPipeline(ctx, 'dense-converge', CONVERGE_ON_NO_DIFF);

  const mmTiles = Math.ceil(n / MM_TILE);
  const cells = Math.ceil(n / TILE);
  const iteration: Dispatch[] = [
    { pipeline: reset, group: groupFor(ctx, reset, [flags]), groups: [1] },
    {
      pipeline: matmul,
      group: groupFor(ctx, matmul, [pN, q, s, t, flags]),
      groups: [mmTiles, mmTiles],
    },
    {
      pipeline: matmul,
      group: groupFor(ctx, matmul, [pN, t, qt, u, flags]),
      groups: [mmTiles, mmTiles],
    },
    {
      pipeline: epi,
      group: groupFor(ctx, epi, [sp, u, s, flags]),
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

  for (const buffer of [q, qt, s, t, u, flags, pN, sp]) {
    buffer.destroy();
  }

  return simRankResultFrom(view, out);
};
