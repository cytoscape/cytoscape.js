/*
Triangle counting on the GPU (round 69).

The CPU reference (`triangle-counting.mts`) is the spec: both
executors count over the same deduped undirected adjacency.  The GPU
computes A² with the shared tiled matmul — the compute-bound kernel
the MCL family leads the benchmark with — and folds (A² ∘ A) per row,
so each node's read-back value is twice its triangle count (row i sums
paths i→k→j over the j adjacent to i; each triangle contributes the
two orderings of its far corners).  The readback is n floats.

Counts ride f32: A and A² entries are small integers, exact until a
row's ∘-product sum passes 2²⁴ — a regime (millions of triangles per
node) far past the graphs this tier prices, and `executor: 'cpu'`
remains the exact path.
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
import { MATMUL, MM_TILE, WG } from './algo-gpu-dense.mjs';
import { triangleResultFrom } from './triangle-counting.mjs';
import type { TriangleCountResult } from './triangle-counting.mjs';

/** out[i] = Σ_j c[i][j] · a[i][j] — a generic Hadamard row fold, one
 * workgroup per row with lanes striding and tree-reducing (the 65.8
 * occupancy rule).  Named for the triangle family that introduced it;
 * exported since round 70, when the motif census reuses it to fold
 * its seven trace products. */
export const TRI_ROWS = wgsl`
struct P { n : u32, r : f32 }
@group(0) @binding(0) var<uniform> p : P;
@group(0) @binding(1) var<storage, read> a : array<f32>;
@group(0) @binding(2) var<storage, read> c : array<f32>;
@group(0) @binding(3) var<storage, read_write> out : array<f32>;

var<workgroup> partial : array<f32, ${WG}>;

@compute @workgroup_size(${WG})
fn main(
  @builtin(workgroup_id) wid : vec3u,
  @builtin(local_invocation_id) lid : vec3u,
) {
  let i = wid.x;
  let n = p.n;
  var s = 0.0;

  for (var j = lid.x; j < n; j = j + ${WG}u) {
    s = s + c[i * n + j] * a[i * n + j];
  }

  partial[lid.x] = s;
  workgroupBarrier();

  for (var stride = ${WG / 2}u; stride > 0u; stride = stride >> 1u) {
    if (lid.x < stride) {
      partial[lid.x] = partial[lid.x] + partial[lid.x + stride];
    }
    workgroupBarrier();
  }

  if (lid.x == 0u) {
    out[i] = partial[0];
  }
}
`;

/**
 * The GPU triangle-counting executor.  Semantics match the CPU
 * reference: the same adjacency, counted through one tiled matmul and
 * a Hadamard row fold instead of sorted-list intersections.
 *
 * @param ctx — the shared device state
 * @param view — the subgraph view
 * @param adjacency — from `buildTriangleAdjacency` (shared with the
 *   CPU path by the async entry)
 * @returns the triangle/coefficient accessors
 * @throws GpuUnfitError when n² floats exceed the device's buffer limit
 */
export const triangleCountGpu = async (
  ctx: AlgoGpu,
  view: SubgraphView,
  adjacency: { neighbors: Int32Array[]; degrees: Int32Array },
): Promise<TriangleCountResult> => {
  const { neighbors, degrees } = adjacency;
  const n = degrees.length;

  assertFits(ctx, n * n * 4, 'triangleCount');

  if (n === 0) {
    return triangleResultFrom(view, degrees, new Float64Array(0));
  }

  const a32 = new Float32Array(n * n);

  for (let i = 0; i < n; i++) {
    const ni = neighbors[i];

    for (let k = 0; k < ni.length; k++) {
      a32[i * n + ni[k]] = 1;
    }
  }

  const a = storageFrom(ctx, a32);
  const c = storageOf(ctx, n * n * 4);
  const out = storageOf(ctx, n * 4);
  // the matmul's converge machinery is unused here: a single product
  // over a flags word that stays 0
  const flags = storageFrom(ctx, new Uint32Array([0, 0]));
  const pN = paramsNR(ctx, n, 0);

  const matmul = getPipeline(ctx, 'dense-matmul', MATMUL);
  const rows = getPipeline(ctx, 'tri-rows', TRI_ROWS);
  const tiles = Math.ceil(n / MM_TILE);

  const dispatches: Dispatch[] = [
    {
      pipeline: matmul,
      // c = a × a: the same buffer binds as both factors
      group: groupFor(ctx, matmul, [pN, a, a, c, flags]),
      groups: [tiles, tiles],
    },
    {
      pipeline: rows,
      // one workgroup per row
      group: groupFor(ctx, rows, [pN, a, c, out]),
      groups: [n],
    },
  ];

  submitPass(ctx, dispatches);

  const folded = new Float32Array(await readBack(ctx, out, n * 4));

  for (const buffer of [a, c, out, flags, pN]) {
    buffer.destroy();
  }

  // row i's fold counts each of its triangles twice (both orderings of
  // the far corners); rounding pins the f32 sums back to integers
  const triangles = new Float64Array(n);

  for (let i = 0; i < n; i++) {
    triangles[i] = Math.round(folded[i] / 2);
  }

  return triangleResultFrom(view, degrees, triangles);
};
