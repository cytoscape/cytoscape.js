/*
The all-pairs heat kernel on the GPU (round 70).

The CPU reference (`heat-kernel.mts`) is the spec, and both executors
share the same approximation constants (the scaling exponent s and
`TAYLOR_TERMS`): the GPU sums the scaled Taylor series as a chain of
tiled matmuls — p ← p·M/k accumulated into the series — and then
squares the sum s times, where the CPU applies the identical operator
2^s times per column.  The whole chain is fixed work (no convergence),
encoded as one submission with one readback.
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
import { MATMUL, MM_TILE, TILE } from './algo-gpu-dense.mjs';
import {
  buildHeatStructure,
  heatKernelResultFrom,
  resolveHeatTime,
  TAYLOR_TERMS,
} from './heat-kernel.mjs';
import type { HeatDiffusionOptions, HeatKernelResult } from './heat-kernel.mjs';

/** After the matmul writes p2 = p·M: fold the k-th series term in —
 * p = p2/k (M^k/k!, ready for the next power) and acc += p2/k.  The
 * factor 1/k rides the shared P uniform's r slot. */
const POWER_ACC = wgsl`
struct P { n : u32, r : f32 }
@group(0) @binding(0) var<uniform> p : P;
@group(0) @binding(1) var<storage, read> p2 : array<f32>;
@group(0) @binding(2) var<storage, read_write> pw : array<f32>;
@group(0) @binding(3) var<storage, read_write> acc : array<f32>;

@compute @workgroup_size(${TILE}, ${TILE})
fn main(@builtin(global_invocation_id) gid : vec3u) {
  if (gid.x >= p.n || gid.y >= p.n) { return; }

  let i = gid.y * p.n + gid.x;
  let term = p2[i] * p.r;

  pw[i] = term;
  acc[i] = acc[i] + term;
}
`;

/**
 * The GPU heat-kernel executor.  Semantics match the CPU reference:
 * the same Laplacian, the same scaling, the same series — summed in
 * f32 as dense products rather than in f64 a column at a time.
 *
 * @param ctx — the shared device state
 * @param view — the subgraph view
 * @param options — as the CPU reference
 * @returns the `{ heat }` accessor over the read-back kernel
 * @throws GpuUnfitError when n² floats exceed the device's buffer
 *   limit; also if `time` is invalid or an edge weight is not positive
 */
export const heatKernelGpu = async (
  ctx: AlgoGpu,
  view: SubgraphView,
  options: HeatDiffusionOptions = {},
): Promise<HeatKernelResult> => {
  const time = resolveHeatTime(options);
  const n = view.nodeSlots.length;

  assertFits(ctx, n * n * 4, 'heatKernel');

  if (n === 0) {
    return heatKernelResultFrom(view, []);
  }

  const heat = buildHeatStructure(view, options);
  const step = -time / Math.pow(2, heat.squarings);

  // M = (−t/2^s)·L, dense: step·degree on the diagonal, −step·w off it
  const m32 = new Float32Array(n * n);

  for (let i = 0; i < n; i++) {
    m32[i * n + i] = step * heat.degrees[i];
  }

  for (let a = 0; a < heat.arcs; a++) {
    m32[heat.dsts[a] * n + heat.srcs[a]] -= step * heat.ws[a];
  }

  // acc⁰ = I + M (the k = 0 and k = 1 terms); the running power is M
  const acc32 = Float32Array.from(m32);

  for (let i = 0; i < n; i++) {
    acc32[i * n + i] += 1;
  }

  const m = storageFrom(ctx, m32);
  const pw = storageFrom(ctx, m32);
  const p2 = storageOf(ctx, n * n * 4);
  const acc = storageFrom(ctx, acc32);
  const acc2 = storageOf(ctx, n * n * 4);
  const flags = storageFrom(ctx, new Uint32Array([0, 0]));
  const pN = paramsNR(ctx, n, 0);

  const matmul = getPipeline(ctx, 'dense-matmul', MATMUL);
  const powerAcc = getPipeline(ctx, 'heat-power-acc', POWER_ACC);

  const mmTiles = Math.ceil(n / MM_TILE);
  const cells = Math.ceil(n / TILE);
  const all: Dispatch[] = [];
  const termParams: GPUBuffer[] = [];

  for (let k = 2; k <= TAYLOR_TERMS; k++) {
    const pK = paramsNR(ctx, n, 1 / k);

    termParams.push(pK);

    all.push({
      pipeline: matmul,
      group: groupFor(ctx, matmul, [pN, pw, m, p2, flags]),
      groups: [mmTiles, mmTiles],
    });
    all.push({
      pipeline: powerAcc,
      group: groupFor(ctx, powerAcc, [pK, p2, pw, acc]),
      groups: [cells, cells],
    });
  }

  // square the sum s times, ping-ponging acc ↔ acc2
  const pair = [acc, acc2];

  for (let j = 0; j < heat.squarings; j++) {
    const src = pair[j % 2];
    const dst = pair[(j + 1) % 2];

    all.push({
      pipeline: matmul,
      group: groupFor(ctx, matmul, [pN, src, src, dst, flags]),
      groups: [mmTiles, mmTiles],
    });
  }

  submitPass(ctx, all);

  const final = pair[heat.squarings % 2];
  const out = new Float32Array(await readBack(ctx, final, n * n * 4));

  for (const buffer of [m, pw, p2, acc, acc2, flags, pN, ...termParams]) {
    buffer.destroy();
  }

  return heatKernelResultFrom(view, out);
};
