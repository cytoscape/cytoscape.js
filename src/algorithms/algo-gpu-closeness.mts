/*
Whole-collection closeness centrality on the GPU (round 69).

The CPU reference (`closeness-centrality.mts`) is the spec: both
executors run Floyd–Warshall over the shared init matrices and fold
each node's distance row into one score.  The GPU reuses the blocked
FW relaxation (`algo-gpu-fw.mts`, `fwRelaxPlan`) unchanged and adds a
per-row reduction kernel behind it in the same pass, so the readback
is n floats — the row sums — rather than the n² distance matrix the
public `floydWarshall` must return.  Unreachable pairs ride the FW
sentinel band; the reduction never manufactures an Inf (the WGSL
finite-math rule): a row that must read as infinite (plain mode with
an unreachable pair, harmonic mode with a zero distance) writes the
sentinel once, and the readback maps the band back before the shared
final step and normalization run on the CPU.
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
import { initFloydWarshall } from './floyd-warshall.mjs';
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
