/*
Neighborhood similarity on the GPU (round 69).

The CPU reference (`neighborhood-similarity.mts`) is the spec: both
executors compare the same deduped neighbor sets.  The GPU computes
the whole shared-neighbor count matrix as one tiled product —
C = A · Aᵀ over the 0/1 adjacency (A is symmetric in the undirected
default, so the same buffer binds as both factors; a directed run
uploads the transpose as the second factor) — and reads back the n²
counts, which the shared accessor normalizes lazily per query.
Counts are small exact integers in f32, so the two executors agree
bit-for-bit until a pair shares 2²⁴ neighbors.
*/

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
import { MATMUL, MM_TILE } from './algo-gpu-dense.mjs';
import { similarityResultFrom } from './neighborhood-similarity.mjs';
import type {
  NeighborhoodSimilarityResult,
  SimilarityMetric,
} from './neighborhood-similarity.mjs';

/**
 * The GPU similarity executor.  Semantics match the CPU reference:
 * the same neighbor sets, counted through one tiled matmul instead of
 * the wedge walk.
 *
 * @param ctx — the shared device state
 * @param view — the subgraph view
 * @param hoods — from `buildNeighborhoods` (shared with the CPU path
 *   by the async entry)
 * @param metric — the resolved normalization
 * @param directed — whether `hoods` holds out-neighborhoods
 * @returns the `{ similarity }` accessor over the read-back counts
 * @throws GpuUnfitError when n² floats exceed the device's buffer limit
 */
export const neighborhoodSimilarityGpu = async (
  ctx: AlgoGpu,
  view: SubgraphView,
  hoods: { neighbors: Int32Array[]; sizes: Int32Array },
  metric: SimilarityMetric,
  directed: boolean,
): Promise<NeighborhoodSimilarityResult> => {
  const { neighbors, sizes } = hoods;
  const n = sizes.length;

  assertFits(ctx, n * n * 4, 'neighborhoodSimilarity');

  if (n === 0) {
    return similarityResultFrom(view, sizes, [], metric);
  }

  const a32 = new Float32Array(n * n);

  for (let i = 0; i < n; i++) {
    const ni = neighbors[i];

    for (let k = 0; k < ni.length; k++) {
      a32[i * n + ni[k]] = 1;
    }
  }

  const a = storageFrom(ctx, a32);
  let b = a;

  if (directed) {
    // out-neighborhoods are not symmetric: the second factor is Aᵀ
    const t32 = new Float32Array(n * n);

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        t32[j * n + i] = a32[i * n + j];
      }
    }

    b = storageFrom(ctx, t32);
  }

  const c = storageOf(ctx, n * n * 4);
  // the matmul's converge machinery is unused here: a single product
  // over a flags word that stays 0
  const flags = storageFrom(ctx, new Uint32Array([0, 0]));
  const pN = paramsNR(ctx, n, 0);

  const matmul = getPipeline(ctx, 'dense-matmul', MATMUL);
  const tiles = Math.ceil(n / MM_TILE);

  submitPass(ctx, [
    {
      pipeline: matmul,
      group: groupFor(ctx, matmul, [pN, a, b, c, flags]),
      groups: [tiles, tiles],
    },
  ]);

  const counts = new Float32Array(await readBack(ctx, c, n * n * 4));
  const buffers = directed ? [a, b, c, flags, pN] : [a, c, flags, pN];

  for (const buffer of buffers) {
    buffer.destroy();
  }

  return similarityResultFrom(view, sizes, counts, metric);
};
