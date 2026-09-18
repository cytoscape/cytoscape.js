/*
Whole-collection closeness centrality on the GPU (round 69; the
unweighted BFS path since 72.3).

The CPU reference (`closeness-centrality.mts`) is the spec, and it has
two routes.  **Weighted** runs relax Floyd–Warshall over the shared
init matrices: the GPU reuses the blocked FW relaxation
(`algo-gpu-fw.mts`, `fwRelaxPlan`) unchanged and adds a per-row
reduction kernel behind it in the same pass, so the readback is n
floats — the row sums — rather than the n² distance matrix.
**Unweighted** runs walk a BFS per source: the GPU runs the batched
level-synchronous BFS shared with Brandes (`algo-gpu-bfs.mts`) and
folds each batch lane's distance row on the device — O(n·(n+E)) work
where FW is O(n³), and a readback of n floats either way.

Unreachable pairs ride the FW sentinel band; neither fold ever
manufactures an Inf (the WGSL finite-math rule): a row that must read
as infinite (plain mode with an unreachable pair, harmonic mode with a
zero distance) writes the sentinel once, and the readback maps the
band back before the shared final step and normalization run on the
CPU.
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
  storageOf,
  submitPass,
} from './algo-gpu.mjs';
import { WG } from './algo-gpu-dense.mjs';
import { FINF, FINF_BAND, fwRelaxPlan } from './algo-gpu-fw.mjs';
import { BATCH, NO_SOURCE, bfsForwardBatch, bfsPlan } from './algo-gpu-bfs.mjs';
import { initFloydWarshall } from './floyd-warshall.mjs';
import { buildBrandesNeighbors } from './betweenness-centrality.mjs';
import { subgraph } from './algo-shared.mjs';
import {
  closenessOfRowSum,
  closenessResultFrom,
} from './closeness-centrality.mjs';
import type {
  ClosenessCentralityOptions,
  ClosenessCentralityNormalizedResult,
} from './closeness-centrality.mjs';

/** Fold each relaxed distance row into its closeness row sum — one
 * workgroup per row, lanes striding columns and tree-reducing, the
 * shape every row reduction here takes (the 65.8 occupancy rule).
 * p.r carries the mode (1 = harmonic, 0 = plain).  Harmonic sums 1/d
 * for reachable pairs (an unreachable pair contributes 0, as on the
 * CPU where 1/Infinity vanishes); plain sums d.  A row that the CPU
 * would sum to Infinity — plain with any unreachable pair, harmonic
 * with a zero distance — is *marked* via a second reduction and
 * written as the sentinel once, because summing sentinels could
 * overflow f32 and WGSL implementations may assume floats are
 * finite. */
const CLOSENESS_ROWS = wgsl`
struct P { n : u32, r : f32 }
@group(0) @binding(0) var<uniform> p : P;
@group(0) @binding(1) var<storage, read> dist : array<f32>;
@group(0) @binding(2) var<storage, read_write> sums : array<f32>;

var<workgroup> partial : array<f32, ${WG}>;

@compute @workgroup_size(${WG})
fn main(
  @builtin(workgroup_id) wid : vec3u,
  @builtin(local_invocation_id) lid : vec3u,
) {
  let i = wid.x;
  let n = p.n;
  let harmonic = p.r == 1.0;
  var s = 0.0;
  var marked = 0.0;

  for (var j = lid.x; j < n; j = j + ${WG}u) {
    if (j == i) { continue; }

    let d = dist[i * n + j];

    if (harmonic) {
      if (d < ${FINF_BAND}) {
        if (d <= 0.0) {
          marked = 1.0;
        } else {
          s = s + 1.0 / d;
        }
      }
    } else {
      if (d < ${FINF_BAND}) {
        s = s + d;
      } else {
        marked = 1.0;
      }
    }
  }

  partial[lid.x] = s;
  workgroupBarrier();

  for (var stride = ${WG / 2}u; stride > 0u; stride = stride >> 1u) {
    if (lid.x < stride) {
      partial[lid.x] = partial[lid.x] + partial[lid.x + stride];
    }
    workgroupBarrier();
  }

  let total = partial[0];

  // the barrier before reuse is load-bearing: every lane reads
  // partial[0] before any lane overwrites it for the mark reduction
  workgroupBarrier();

  partial[lid.x] = marked;
  workgroupBarrier();

  for (var stride = ${WG / 2}u; stride > 0u; stride = stride >> 1u) {
    if (lid.x < stride) {
      partial[lid.x] = max(partial[lid.x], partial[lid.x + stride]);
    }
    workgroupBarrier();
  }

  if (lid.x == 0u) {
    sums[i] = select(total, ${FINF}, partial[0] > 0.0);
  }
}
`;

/**
 * The GPU whole-collection closeness executor.  Semantics match the
 * CPU reference: Floyd–Warshall over the shared init, then each row's
 * distances folded into one score and normalized by the maximum —
 * distances relax in f32, so scores can differ from the CPU's f64 in
 * float detail.
 *
 * @param ctx — the shared device state
 * @param coll — the calling collection
 * @param options — as the CPU reference
 * @returns the `{ closeness }` accessor over the read-back row sums
 * @throws GpuUnfitError when n² floats exceed the device's buffer limit
 */
export const closenessCentralityNormalizedGpu = async (
  ctx: AlgoGpu,
  coll: Collection,
  options: ClosenessCentralityOptions = {},
): Promise<ClosenessCentralityNormalizedResult> => {
  const harmonic = options.harmonic !== false;
  const { view, n, dist, next } = initFloydWarshall(coll, options);

  assertFits(ctx, n * n * 4, 'closenessCentralityNormalized');

  if (n === 0) {
    return closenessResultFrom(view, []);
  }

  const { distBuf, nextBuf, dispatches, scratch } = fwRelaxPlan(
    ctx,
    n,
    dist,
    next,
  );

  const sums = storageOf(ctx, n * 4);
  const pRows = paramsNR(ctx, n, harmonic ? 1 : 0);
  const rows = getPipeline(ctx, 'closeness-rows', CLOSENESS_ROWS);

  dispatches.push({
    pipeline: rows,
    // one workgroup per row
    group: groupFor(ctx, rows, [pRows, distBuf, sums]),
    groups: [n],
  });

  submitPass(ctx, dispatches);

  const rowSums = new Float32Array(await readBack(ctx, sums, n * 4));

  for (const buffer of [distBuf, nextBuf, sums, pRows, ...scratch]) {
    buffer.destroy();
  }

  const closenesses = new Float64Array(n);

  for (let i = 0; i < n; i++) {
    const sum = rowSums[i] >= FINF_BAND ? Infinity : rowSums[i];

    closenesses[i] = closenessOfRowSum(sum, harmonic);
  }

  return closenessResultFrom(view, closenesses);
};

/** Fold one batch lane's BFS levels into its source's row sum — one
 * workgroup per lane, lanes striding the row and tree-reducing.
 * p.r carries the mode (1 = harmonic, 0 = plain).  A level of −1 is
 * unreached (harmonic contributes 0; plain marks the row infinite),
 * the source's own 0 is skipped, so a zero distance never reaches the
 * harmonic 1/d.  The marked rows write the sentinel once, as the FW
 * fold does. */
const CLOSENESS_BFS_FOLD = wgsl`
struct BP { n : u32, batch : u32 }
struct P { n : u32, r : f32 }
@group(0) @binding(0) var<uniform> bp : BP;
@group(0) @binding(1) var<uniform> p : P;
@group(0) @binding(2) var<storage, read> sources : array<u32>;
@group(0) @binding(3) var<storage, read> d : array<i32>;
@group(0) @binding(4) var<storage, read_write> sums : array<f32>;

var<workgroup> partial : array<f32, ${WG}>;

@compute @workgroup_size(${WG})
fn main(
  @builtin(workgroup_id) wid : vec3u,
  @builtin(local_invocation_id) lid : vec3u,
) {
  let b = wid.x;
  let src = sources[b];

  // a short last batch: the whole workgroup returns before any barrier
  if (src == ${NO_SOURCE}u) { return; }

  let n = bp.n;
  let harmonic = p.r == 1.0;
  var s = 0.0;
  var marked = 0.0;

  for (var w = lid.x; w < n; w = w + ${WG}u) {
    if (w == src) { continue; }

    let level = d[b * n + w];

    if (level < 0) {
      if (!harmonic) {
        marked = 1.0;
      }
    } else if (harmonic) {
      s = s + 1.0 / f32(level);
    } else {
      s = s + f32(level);
    }
  }

  partial[lid.x] = s;
  workgroupBarrier();

  for (var stride = ${WG / 2}u; stride > 0u; stride = stride >> 1u) {
    if (lid.x < stride) {
      partial[lid.x] = partial[lid.x] + partial[lid.x + stride];
    }
    workgroupBarrier();
  }

  let total = partial[0];

  workgroupBarrier();

  partial[lid.x] = marked;
  workgroupBarrier();

  for (var stride = ${WG / 2}u; stride > 0u; stride = stride >> 1u) {
    if (lid.x < stride) {
      partial[lid.x] = max(partial[lid.x], partial[lid.x + stride]);
    }
    workgroupBarrier();
  }

  if (lid.x == 0u) {
    sums[src] = select(total, ${FINF}, partial[0] > 0.0);
  }
}
`;

/**
 * The GPU unweighted closeness executor (72.3): the batched BFS
 * shared with Brandes, each batch's rows folded on the device.
 * Semantics match the CPU BFS route exactly — integer levels, so
 * plain sums agree bit-for-bit up to f32 range and harmonic sums to
 * f32 summation.  The wrapper never routes a weighted run here.
 *
 * @param ctx — the shared device state
 * @param coll — the calling collection
 * @param options — as the CPU reference (weight must be absent)
 * @returns the `{ closeness }` accessor over the read-back row sums
 */
export const closenessCentralityNormalizedBfsGpu = async (
  ctx: AlgoGpu,
  coll: Collection,
  options: ClosenessCentralityOptions = {},
): Promise<ClosenessCentralityNormalizedResult> => {
  const harmonic = options.harmonic !== false;
  const directed = options.directed === true;
  const view = subgraph(coll);
  const n = view.nodeSlots.length;

  if (n === 0) {
    return closenessResultFrom(view, []);
  }

  const { neighbors } = buildBrandesNeighbors(view, directed);
  const plan = bfsPlan(ctx, neighbors, directed);
  const sums = storageOf(ctx, n * 4);
  const pRows = paramsNR(ctx, n, harmonic ? 1 : 0);
  const fold = getPipeline(ctx, 'closeness-bfs-fold', CLOSENESS_BFS_FOLD);
  const foldGroup = groupFor(ctx, fold, [
    plan.bp,
    pRows,
    plan.sources,
    plan.d,
    sums,
  ]);

  for (let start = 0; start < n; start += BATCH) {
    await bfsForwardBatch(ctx, plan, start);
    // one workgroup per batch lane
    submitPass(ctx, [{ pipeline: fold, group: foldGroup, groups: [BATCH] }]);
  }

  const rowSums = new Float32Array(await readBack(ctx, sums, n * 4));

  plan.destroy();
  sums.destroy();
  pRows.destroy();

  const closenesses = new Float64Array(n);

  for (let i = 0; i < n; i++) {
    const sum = rowSums[i] >= FINF_BAND ? Infinity : rowSums[i];

    closenesses[i] = closenessOfRowSum(sum, harmonic);
  }

  return closenessResultFrom(view, closenesses);
};
