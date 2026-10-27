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
manufactures an Inf (the WGSL finite-math rule).  Each fold writes a
row's sum over the reachable nodes and, in plain mode, how many there
are (round 150: the classic form's Wasserman–Faust correction needs
the count); a harmonic row with a zero distance, which the CPU sums to
Infinity, writes the sentinel once, and the readback maps the band
back before the shared final step (`closenessOfRow`) and
normalization run on the CPU.  Incoming closeness (`direction: 'in'`)
folds Floyd–Warshall's column instead of its row, and walks the BFS
over the transposed neighbor lists.
*/

import type { Collection } from '../collection.mjs';
import { wgsl } from '../gpu/wgsl.mjs';
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
  closenessOfRow,
  closenessResultFrom,
  closenessReverse,
} from './closeness-centrality.mjs';
import type {
  ClosenessCentralityOptions,
  ClosenessCentralityNormalizedResult,
} from './closeness-centrality.mjs';

/** Fold each relaxed distance row (or column) into its closeness row
 * sum — one workgroup per node, lanes striding the other index and
 * tree-reducing, the shape every row reduction here takes (the 65.8
 * occupancy rule).  p.r carries two flags: 1 = harmonic, 2 = fold the
 * column (distances *to* the node, `direction: 'in'`).  Both modes
 * skip unreachable pairs.  Plain sums d and counts the reachable
 * nodes into `reached` (round 150's Wasserman–Faust form needs r);
 * harmonic sums 1/d, and a row with a zero distance, which the CPU
 * sums to Infinity, is *marked* by the second reduction and written as
 * the sentinel once, because WGSL implementations may assume floats
 * are finite. */
const CLOSENESS_ROWS = wgsl`
struct P { n : u32, r : f32 }
@group(0) @binding(0) var<uniform> p : P;
@group(0) @binding(1) var<storage, read> dist : array<f32>;
@group(0) @binding(2) var<storage, read_write> sums : array<f32>;
@group(0) @binding(3) var<storage, read_write> reached : array<f32>;

var<workgroup> partial : array<f32, ${WG}>;

@compute @workgroup_size(${WG})
fn main(
  @builtin(workgroup_id) wid : vec3u,
  @builtin(local_invocation_id) lid : vec3u,
) {
  let i = wid.x;
  let n = p.n;
  let flags = u32(p.r);
  let harmonic = (flags & 1u) == 1u;
  let column = (flags & 2u) == 2u;
  var s = 0.0;
  var c = 0.0;

  for (var j = lid.x; j < n; j = j + ${WG}u) {
    if (j == i) { continue; }

    let d = select(dist[i * n + j], dist[j * n + i], column);

    if (d < ${FINF_BAND}) {
      if (harmonic) {
        if (d <= 0.0) {
          c = 1.0;
        } else {
          s = s + 1.0 / d;
        }
      } else {
        s = s + d;
        c = c + 1.0;
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
  // partial[0] before any lane overwrites it for the second reduction
  workgroupBarrier();

  partial[lid.x] = c;
  workgroupBarrier();

  // plain counts (a sum); harmonic marks (a max)
  for (var stride = ${WG / 2}u; stride > 0u; stride = stride >> 1u) {
    if (lid.x < stride) {
      let a = partial[lid.x];
      let b = partial[lid.x + stride];

      partial[lid.x] = select(a + b, max(a, b), harmonic);
    }
    workgroupBarrier();
  }

  if (lid.x == 0u) {
    sums[i] = select(total, ${FINF}, harmonic && partial[0] > 0.0);
    reached[i] = partial[0];
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
  const reverse = closenessReverse(options);
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
  const reached = storageOf(ctx, n * 4);
  const pRows = paramsNR(ctx, n, (harmonic ? 1 : 0) + (reverse ? 2 : 0));
  const rows = getPipeline(ctx, 'closeness-rows', CLOSENESS_ROWS);

  dispatches.push({
    pipeline: rows,
    // one workgroup per row
    group: groupFor(ctx, rows, [pRows, distBuf, sums, reached]),
    groups: [n],
  });

  submitPass(ctx, dispatches);

  const rowSums = new Float32Array(await readBack(ctx, sums, n * 4));
  const rowReached = new Float32Array(await readBack(ctx, reached, n * 4));

  for (const buffer of [distBuf, nextBuf, sums, reached, pRows, ...scratch]) {
    buffer.destroy();
  }

  return closenessResultFrom(
    view,
    closenessesFromReadback(n, rowSums, rowReached, harmonic),
  );
};

/**
 * Map the read-back row sums and reached counts through the shared
 * final step — the sentinel band back to Infinity first.
 *
 * @param n — the node count
 * @param rowSums — per-node sums
 * @param rowReached — per-node reached counts (plain mode)
 * @param harmonic — the mode
 * @returns the scores, by dense index
 */
const closenessesFromReadback = (
  n: number,
  rowSums: Float32Array,
  rowReached: Float32Array,
  harmonic: boolean,
): Float64Array => {
  const closenesses = new Float64Array(n);

  for (let i = 0; i < n; i++) {
    const sum = rowSums[i] >= FINF_BAND ? Infinity : rowSums[i];

    closenesses[i] = closenessOfRow(sum, rowReached[i], n, harmonic);
  }

  return closenesses;
};

/** Fold one batch lane's BFS levels into its source's row sum — one
 * workgroup per lane, lanes striding the row and tree-reducing.
 * p.r carries the mode (1 = harmonic, 0 = plain).  A level of −1 is
 * unreached and skipped; the source's own 0 is skipped, so a zero
 * distance never reaches the harmonic 1/d.  Plain also counts the
 * reached nodes into `reached`, as the FW fold does (round 150). */
const CLOSENESS_BFS_FOLD = wgsl`
struct BP { n : u32, batch : u32 }
struct P { n : u32, r : f32 }
@group(0) @binding(0) var<uniform> bp : BP;
@group(0) @binding(1) var<uniform> p : P;
@group(0) @binding(2) var<storage, read> sources : array<u32>;
@group(0) @binding(3) var<storage, read> d : array<i32>;
@group(0) @binding(4) var<storage, read_write> sums : array<f32>;
@group(0) @binding(5) var<storage, read_write> reached : array<f32>;

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
  var c = 0.0;

  for (var w = lid.x; w < n; w = w + ${WG}u) {
    if (w == src) { continue; }

    let level = d[b * n + w];

    if (level >= 0) {
      if (harmonic) {
        s = s + 1.0 / f32(level);
      } else {
        s = s + f32(level);
      }

      c = c + 1.0;
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

  partial[lid.x] = c;
  workgroupBarrier();

  for (var stride = ${WG / 2}u; stride > 0u; stride = stride >> 1u) {
    if (lid.x < stride) {
      partial[lid.x] = partial[lid.x] + partial[lid.x + stride];
    }
    workgroupBarrier();
  }

  if (lid.x == 0u) {
    sums[src] = total;
    reached[src] = partial[0];
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
  const reverse = closenessReverse(options);
  const view = subgraph(coll);
  const n = view.nodeSlots.length;

  if (n === 0) {
    return closenessResultFrom(view, []);
  }

  const { neighbors } = buildBrandesNeighbors(view, directed, reverse);
  const plan = bfsPlan(ctx, neighbors, directed);
  const sums = storageOf(ctx, n * 4);
  const reached = storageOf(ctx, n * 4);
  const pRows = paramsNR(ctx, n, harmonic ? 1 : 0);
  const fold = getPipeline(ctx, 'closeness-bfs-fold', CLOSENESS_BFS_FOLD);
  const foldGroup = groupFor(ctx, fold, [
    plan.bp,
    pRows,
    plan.sources,
    plan.d,
    sums,
    reached,
  ]);

  for (let start = 0; start < n; start += BATCH) {
    await bfsForwardBatch(ctx, plan, start);
    // one workgroup per batch lane
    submitPass(ctx, [{ pipeline: fold, group: foldGroup, groups: [BATCH] }]);
  }

  const rowSums = new Float32Array(await readBack(ctx, sums, n * 4));
  const rowReached = new Float32Array(await readBack(ctx, reached, n * 4));

  plan.destroy();
  sums.destroy();
  reached.destroy();
  pRows.destroy();

  return closenessResultFrom(
    view,
    closenessesFromReadback(n, rowSums, rowReached, harmonic),
  );
};
