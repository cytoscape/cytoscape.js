/*
Markov clustering on the GPU (round 65).

The CPU reference (`markov-clustering.mts`) is the spec: both executors
build the identical f64 stochastic matrix and extract clusters with the
identical rounding — the GPU replaces only the expand/inflate iteration,
which is the O(n³·iterations) part.  Every iteration is encoded up
front with the flags-guarded kernels from `algo-gpu-dense.mts`, so the
run costs exactly one readback (the converged matrix) regardless of
when it converges — the kernels self-neutralise after the converge bit
sets, leaving the matrix at its converged value like the CPU loop's
`break`.
*/

import type { Collection } from '../collection.mjs';
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
  COL_NORMALIZE,
  COL_SUMS,
  CONVERGE_ON_NO_DIFF,
  COPY_MAT,
  MATMUL,
  MM_TILE,
  POW_MAT,
  RESET_DIFF,
  ROUND_COMPARE,
  TILE,
  WG,
} from './algo-gpu-dense.mjs';
import { buildMarkovMatrix, markovClustersFrom } from './markov-clustering.mjs';
import type { MarkovClusteringOptions } from './markov-clustering.mjs';

/**
 * The GPU MCL executor.  Semantics match the CPU reference: expand
 * (matrix power), inflate (element-wise power + column normalize),
 * converge when the inflated matrix equals the expanded one to four
 * decimals, up to `maxIterations` passes.
 *
 * @param ctx — the shared device state
 * @param coll — the calling collection
 * @param options — as the CPU reference
 * @returns the clusters, extracted from the read-back matrix
 * @throws GpuUnfitError when n² floats exceed the device's buffer limit
 */
export const markovClusteringGpu = async (
  ctx: AlgoGpu,
  coll: Collection,
  options: MarkovClusteringOptions = {},
): Promise<Collection[]> => {
  const expandFactor = options.expandFactor ?? 2;
  const inflateFactor = options.inflateFactor ?? 2;
  const maxIterations = options.maxIterations ?? 20;

  const { view, n, M } = buildMarkovMatrix(coll, options);

  if (n === 0) {
    return [];
  }

  const bytes = n * n * 4;

  assertFits(ctx, bytes, 'markovClustering');

  // buffers: A holds the current matrix; s1/s2 are the expand/inflate
  // scratch pair (the expand chain ping-pongs, the inflate lands in
  // whichever scratch the chain did not end in)
  const a = storageFrom(ctx, Float32Array.from(M));
  const s1 = storageOf(ctx, bytes);
  const s2 = storageOf(ctx, bytes);
  const sums = storageOf(ctx, n * 4);
  const flags = storageFrom(ctx, new Uint32Array([0, 0]));
  const pInflate = paramsNR(ctx, n, inflateFactor);
  const pRound = paramsNR(ctx, n, 1e4);

  const matmul = getPipeline(ctx, 'dense-matmul', MATMUL);
  const powMat = getPipeline(ctx, 'dense-pow', POW_MAT);
  const colSums = getPipeline(ctx, 'dense-col-sums', COL_SUMS);
  const colNorm = getPipeline(ctx, 'dense-col-normalize', COL_NORMALIZE);
  const compare = getPipeline(ctx, 'dense-round-compare', ROUND_COMPARE);
  const copyMat = getPipeline(ctx, 'dense-copy', COPY_MAT);
  const reset = getPipeline(ctx, 'dense-reset-diff', RESET_DIFF);
  const converge = getPipeline(ctx, 'dense-converge', CONVERGE_ON_NO_DIFF);

  const grid2d: [number, number] = [Math.ceil(n / TILE), Math.ceil(n / TILE)];
  // the register-blocked matmul walks 32-wide tiles with 16x16 invocations
  const gridMM: [number, number] = [
    Math.ceil(n / MM_TILE),
    Math.ceil(n / MM_TILE),
  ];
  const grid1d: [number] = [Math.ceil(n / WG)];
  const one: [number] = [1];

  // the expand chain: cur × A → next, ping-ponging s1/s2.  An
  // expandFactor of 1 multiplies nothing (the CPU loop's `p < 1`), so
  // the expanded matrix is A itself.
  const mults: Dispatch[] = [];
  let cur = a;

  for (let m = 0; m < expandFactor - 1; m++) {
    const dst = m % 2 === 0 ? s1 : s2;

    mults.push({
      pipeline: matmul,
      group: groupFor(ctx, matmul, [pInflate, cur, a, dst, flags]),
      groups: gridMM,
    });
    cur = dst;
  }

  const expanded = cur; // E: the matrix power, kept for the compare
  const inflated = expanded === s1 ? s2 : s1; // G: pow + normalize land here

  const iteration: Dispatch[] = [
    { pipeline: reset, group: groupFor(ctx, reset, [flags]), groups: one },
    ...mults,
    {
      pipeline: powMat,
      group: groupFor(ctx, powMat, [pInflate, expanded, inflated, flags]),
      groups: grid2d,
    },
    {
      pipeline: colSums,
      group: groupFor(ctx, colSums, [pInflate, inflated, sums, flags]),
      groups: grid1d,
    },
    {
      pipeline: colNorm,
      group: groupFor(ctx, colNorm, [pInflate, inflated, sums, flags]),
      groups: grid2d,
    },
    {
      pipeline: compare,
      group: groupFor(ctx, compare, [pRound, inflated, expanded, flags]),
      groups: grid2d,
    },
    {
      pipeline: copyMat,
      group: groupFor(ctx, copyMat, [pInflate, inflated, a, flags]),
      groups: grid2d,
    },
    {
      pipeline: converge,
      group: groupFor(ctx, converge, [flags]),
      groups: one,
    },
  ];

  const all: Dispatch[] = [];

  for (let it = 0; it < maxIterations; it++) {
    all.push(...iteration);
  }

  submitPass(ctx, all);

  const out = new Float32Array(await readBack(ctx, a, bytes));

  for (const buffer of [a, s1, s2, sums, flags, pInflate, pRound]) {
    buffer.destroy();
  }

  return markovClustersFrom(coll, view, out, n);
};
