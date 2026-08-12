/*
Effective resistance on the GPU (round 70).

The CPU reference (`effective-resistance.mts`) is the spec: both
executors invert the same shifted system B.  The GPU uses
Newton–Schulz iteration — X ← X·(2I − B·X) from X⁰ = B/‖B‖₁‖B‖∞,
which converges quadratically for the positive-definite B this
family builds — because it is nothing but the shared tiled matmul,
twice per iteration, plus two elementwise kernels.  All iterations
encode up front; the NS_COMPARE/converge pair freezes the chain once
X stops moving *relative to its own scale* — the inverse's entries
grow as 1/λ₂, so an absolute bound would sit under f32 noise on any
weakly-connected graph and the chain would never freeze (measured:
96 of 96 iterations at n=1024 under an absolute 1e-5).  f32 bounds the achievable accuracy on ill-conditioned systems
(a long path's λ₂ shrinks as 1/n²); `executor: 'cpu'` remains the
f64 elimination.
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
} from './algo-gpu.mjs';
import type { Dispatch } from './algo-gpu.mjs';
import {
  CONVERGE_ON_NO_DIFF,
  COPY_MAT,
  MATMUL,
  MM_TILE,
  RESET_DIFF,
  TILE,
} from './algo-gpu-dense.mjs';
import {
  buildResistanceSystem,
  resistanceResultFrom,
} from './effective-resistance.mjs';
import type {
  EffectiveResistanceOptions,
  EffectiveResistanceResult,
} from './effective-resistance.mjs';

/** Iteration cap: quadratic convergence needs ~log₂(cond²) + a few
 * steps, and f32 stagnation is caught by the no-diff converge, so a
 * generous cap costs only flag reads. */
const NS_ITERATIONS = 96;
/** The relative no-progress bound the converge pair watches — set at
 * f32's stagnation level, so the chain freezes once the iterate stops
 * moving beyond its own float noise. */
const NS_TOL = 0.00001;

/** Set the any-difference bit while X is still moving: relative to
 * each entry's own magnitude, because the inverse's scale varies with
 * the spectrum and an absolute bound would never be met on large
 * entries.  The NS chain's own compare; flags-guarded like the rest. */
const NS_COMPARE = wgsl`
struct P { n : u32, r : f32 }
@group(0) @binding(0) var<uniform> p : P;
@group(0) @binding(1) var<storage, read> g : array<f32>;
@group(0) @binding(2) var<storage, read> f : array<f32>;
@group(0) @binding(3) var<storage, read_write> flags : array<atomic<u32>>;

@compute @workgroup_size(${TILE}, ${TILE})
fn main(@builtin(global_invocation_id) gid : vec3u) {
  if (atomicLoad(&flags[0]) == 1u) { return; }
  if (gid.x >= p.n || gid.y >= p.n) { return; }

  let i = gid.y * p.n + gid.x;

  if (abs(g[i] - f[i]) > p.r * max(1.0, abs(f[i]))) {
    atomicStore(&flags[1], 1u);
  }
}
`;

/** y = 2I − bx, elementwise — the Newton–Schulz correction factor. */
const NS_Y = wgsl`
struct P { n : u32, r : f32 }
@group(0) @binding(0) var<uniform> p : P;
@group(0) @binding(1) var<storage, read> bx : array<f32>;
@group(0) @binding(2) var<storage, read_write> y : array<f32>;
@group(0) @binding(3) var<storage, read_write> flags : array<atomic<u32>>;

@compute @workgroup_size(${TILE}, ${TILE})
fn main(@builtin(global_invocation_id) gid : vec3u) {
  if (atomicLoad(&flags[0]) == 1u) { return; }
  if (gid.x >= p.n || gid.y >= p.n) { return; }

  let i = gid.y * p.n + gid.x;
  var v = -bx[i];

  if (gid.x == gid.y) { v = v + 2.0; }

  y[i] = v;
}
`;

/**
 * The GPU effective-resistance executor.  Semantics match the CPU
 * reference: the same B, inverted by f32 Newton–Schulz instead of f64
 * elimination, handed through the same accessors.
 *
 * @param ctx — the shared device state
 * @param view — the subgraph view
 * @param options — as the CPU reference
 * @returns the `{ resistance, commuteTime }` accessors over the
 *   read-back inverse
 * @throws GpuUnfitError when n² floats exceed the device's buffer
 *   limit; also if an edge weight is not positive
 */
export const effectiveResistanceGpu = async (
  ctx: AlgoGpu,
  view: SubgraphView,
  options: EffectiveResistanceOptions = {},
): Promise<EffectiveResistanceResult> => {
  const n = view.nodeSlots.length;

  assertFits(ctx, n * n * 4, 'effectiveResistance');

  const { b, comp, volumes } = buildResistanceSystem(view, options);

  if (n === 0) {
    return resistanceResultFrom(view, [], comp, volumes);
  }

  // X⁰ = B / (‖B‖₁·‖B‖∞); B is symmetric so both norms are the max
  // absolute row sum
  let norm = 0;

  for (let i = 0; i < n; i++) {
    let rowSum = 0;

    for (let j = 0; j < n; j++) {
      rowSum += Math.abs(b[i * n + j]);
    }

    norm = Math.max(norm, rowSum);
  }

  const b32 = Float32Array.from(b);
  const x32 = new Float32Array(n * n);
  const inv2 = 1 / (norm * norm);

  for (let i = 0; i < n * n; i++) {
    x32[i] = b[i] * inv2;
  }

  const bBuf = storageFrom(ctx, b32);
  const x = storageFrom(ctx, x32);
  const bx = storageOf(ctx, n * n * 4);
  const y = storageOf(ctx, n * n * 4);
  const x2 = storageOf(ctx, n * n * 4);
  const flags = storageFrom(ctx, new Uint32Array([0, 0]));
  const pN = paramsNR(ctx, n, 0);
  const pTol = paramsNR(ctx, n, NS_TOL);

  const matmul = getPipeline(ctx, 'dense-matmul', MATMUL);
  const nsY = getPipeline(ctx, 'ns-y', NS_Y);
  const compare = getPipeline(ctx, 'ns-compare', NS_COMPARE);
  const copy = getPipeline(ctx, 'dense-copy', COPY_MAT);
  const reset = getPipeline(ctx, 'dense-reset-diff', RESET_DIFF);
  const converge = getPipeline(ctx, 'dense-converge', CONVERGE_ON_NO_DIFF);

  const mmTiles = Math.ceil(n / MM_TILE);
  const cells = Math.ceil(n / TILE);
  const iteration: Dispatch[] = [
    { pipeline: reset, group: groupFor(ctx, reset, [flags]), groups: [1] },
    {
      pipeline: matmul,
      group: groupFor(ctx, matmul, [pN, bBuf, x, bx, flags]),
      groups: [mmTiles, mmTiles],
    },
    {
      pipeline: nsY,
      group: groupFor(ctx, nsY, [pN, bx, y, flags]),
      groups: [cells, cells],
    },
    {
      pipeline: matmul,
      group: groupFor(ctx, matmul, [pN, x, y, x2, flags]),
      groups: [mmTiles, mmTiles],
    },
    {
      pipeline: compare,
      group: groupFor(ctx, compare, [pTol, x2, x, flags]),
      groups: [cells, cells],
    },
    {
      pipeline: converge,
      group: groupFor(ctx, converge, [flags]),
      groups: [1],
    },
    {
      pipeline: copy,
      group: groupFor(ctx, copy, [pN, x2, x, flags]),
      groups: [cells, cells],
    },
  ];

  const all: Dispatch[] = [];

  for (let it = 0; it < NS_ITERATIONS; it++) {
    all.push(...iteration);
  }

  submitPass(ctx, all);

  const out = new Float32Array(await readBack(ctx, x, n * n * 4));

  for (const buffer of [bBuf, x, bx, y, x2, flags, pN, pTol]) {
    buffer.destroy();
  }

  return resistanceResultFrom(view, out, comp, volumes);
};
