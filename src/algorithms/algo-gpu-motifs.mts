/*
The triad census on the GPU (round 70).

The CPU reference (`motif-census.mts`) is the spec, and both
executors share `censusFromPrimitives`: the GPU computes only the
seven traces — four tiled matmuls over the asymmetric mask C, its
transpose and the mutual mask M, each folded against a mask with the
triangle family's Hadamard row kernel — so the executors can only
disagree if a matmul disagrees with a wedge walk.  Every entry is a
0/1 product sum, exact in f32 until a fold row passes 2²⁴.  One
product buffer is reused across the four products (in-pass storage
writes are visible to later dispatches); the readback is 7·n floats.
*/

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
import { MATMUL, MM_TILE } from './algo-gpu-dense.mjs';
import { TRI_ROWS } from './algo-gpu-triangles.mjs';
import { censusFromPrimitives } from './motif-census.mjs';
import type {
  buildTriadStructure,
  MotifCensusResult,
} from './motif-census.mjs';

/**
 * The GPU census executor.  Semantics match the CPU reference: the
 * same masks, the same closed forms — only the traces come from
 * matmuls.
 *
 * @param ctx — the shared device state
 * @param structure — from `buildTriadStructure` (shared with the CPU
 *   path by the async entry)
 * @returns `{ counts }`
 * @throws GpuUnfitError when n² floats exceed the device's buffer limit
 */
export const motifCensusGpu = async (
  ctx: AlgoGpu,
  structure: ReturnType<typeof buildTriadStructure>,
): Promise<MotifCensusResult> => {
  const { outC, mut, base } = structure;
  const n = base.n;

  assertFits(ctx, n * n * 4, 'motifCensus');

  if (n < 3) {
    return {
      counts: censusFromPrimitives({
        ...base,
        s1: 0,
        s2: 0,
        s3: 0,
        s4: 0,
        s5: 0,
        s6: 0,
        s7: 0,
      }),
    };
  }

  const c32 = new Float32Array(n * n);
  const ct32 = new Float32Array(n * n);
  const m32 = new Float32Array(n * n);

  for (let i = 0; i < n; i++) {
    const out = outC[i];

    for (let k = 0; k < out.length; k++) {
      c32[i * n + out[k]] = 1;
      ct32[out[k] * n + i] = 1;
    }

    const mm = mut[i];

    for (let k = 0; k < mm.length; k++) {
      m32[i * n + mm[k]] = 1;
    }
  }

  const c = storageFrom(ctx, c32);
  const ct = storageFrom(ctx, ct32);
  const m = storageFrom(ctx, m32);
  const product = storageOf(ctx, n * n * 4);
  const flags = storageFrom(ctx, new Uint32Array([0, 0]));
  const pN = paramsNR(ctx, n, 0);

  const matmul = getPipeline(ctx, 'dense-matmul', MATMUL);
  const fold = getPipeline(ctx, 'tri-rows', TRI_ROWS);
  const mmTiles = Math.ceil(n / MM_TILE);

  // (left, right, masks folded against the product)
  const plan: [GPUBuffer, GPUBuffer, GPUBuffer[]][] = [
    [c, c, [c, ct, m]], // S₁ = C²∘C, S₂ = C²∘Cᵀ, S₃ = C²∘M
    [m, m, [m, c]], // S₄ = M²∘M, S₅ = M²∘C
    [ct, c, [m]], // S₆ = CᵀC∘M
    [c, ct, [m]], // S₇ = CCᵀ∘M
  ];

  const outs: GPUBuffer[] = [];
  const all: Dispatch[] = [];

  for (const [left, right, masks] of plan) {
    all.push({
      pipeline: matmul,
      group: groupFor(ctx, matmul, [pN, left, right, product, flags]),
      groups: [mmTiles, mmTiles],
    });

    for (const mask of masks) {
      const out = storageOf(ctx, n * 4);

      outs.push(out);
      all.push({
        pipeline: fold,
        // one workgroup per row
        group: groupFor(ctx, fold, [pN, mask, product, out]),
        groups: [n],
      });
    }
  }

  submitPass(ctx, all);

  const sums: number[] = [];

  for (const out of outs) {
    const rows = new Float32Array(await readBack(ctx, out, n * 4));
    let sum = 0;

    for (let i = 0; i < n; i++) {
      sum += rows[i];
    }

    sums.push(sum);
  }

  for (const buffer of [c, ct, m, product, flags, pN, ...outs]) {
    buffer.destroy();
  }

  const [s1, s2, s3, s4, s5, s6, s7] = sums;

  return {
    counts: censusFromPrimitives({ ...base, s1, s2, s3, s4, s5, s6, s7 }),
  };
};
