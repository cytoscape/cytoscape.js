/*
Floyd–Warshall on the GPU (round 65, blocked in 65.8).

The CPU reference (`floyd-warshall.mts`) is the spec: both executors
share the init (edges → dist/next/edgeNext) and the result accessors —
the GPU replaces the O(n³) relaxation.  Round 65's first version ran
one n² dispatch per k with a bumped step counter: correct, but 2n
dispatches deep, and at n=1024 the dispatch overhead was most of the
run.  This is the classic three-phase *blocked* formulation instead —
per 32-wide k-panel: (1) Floyd–Warshall inside the diagonal block,
(2) the panel's block-row and block-column against the diagonal,
(3) a min-plus product updating every remaining block from its row and
column panels — four dispatches per panel, n/8 fewer than before, and
each phase works out of workgroup-shared tiles.

The phase-order dependency argument is the textbook one, and the
in-phase race-freedom argument is the round-65 kernel's: row k and
column k of the block being iterated are fixed points of step k
(D[k][k] = 0 absent a negative cycle; writes happen only on strict
improvement), so per-k barriers are all the synchronisation phases 1
and 2 need.  Phase 3 has no in-phase dependency at all and
accumulates its 2×2 register block with a best-k index, touching
global `next` once per improved cell.

Unreachable pairs carry a large finite sentinel rather than Infinity —
WGSL implementations may assume floats are finite, so the kernels
never manufacture or compare an Inf: a relaxation is attempted only
when both operands sit under the sentinel band (two in-band values
cannot overflow f32).  The readback translates the band back to
Infinity before the shared accessors see it.  `next` relaxes alongside
dist; `edgeNext` never changes after init (true on the CPU too) and
stays CPU-side.
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
  storageFrom,
  submitPass,
} from './algo-gpu.mjs';
import type { Dispatch } from './algo-gpu.mjs';
import { BUMP_WORD, TILE } from './algo-gpu-dense.mjs';
import {
  floydWarshallResultFrom,
  initFloydWarshall,
} from './floyd-warshall.mjs';
import type {
  FloydWarshallOptions,
  FloydWarshallResult,
} from './floyd-warshall.mjs';

/** The finite stand-in for Infinity: far above any real path sum, far
 * enough below f32 max that sentinel + sentinel cannot overflow.
 * Shared with the closeness reduction (round 69), whose kernel reads
 * the relaxed matrix in place. */
export const FINF = 3.0e38;
/** Values at or above this band are treated as unreachable. */
export const FINF_BAND = 1.5e38;
/** Block edge: 32×32 cells per block, walked by 16×16 invocations
 * owning 2×2 cells each. */
const BS = 32;

/** The shared preamble: params, matrices, the block counter, and the
 * tile-loading helper indices. */
const FW_PRELUDE = wgsl`
struct P { n : u32, r : f32 }
@group(0) @binding(0) var<uniform> p : P;
@group(0) @binding(1) var<storage, read_write> dist : array<f32>;
@group(0) @binding(2) var<storage, read_write> nxt : array<i32>;
@group(0) @binding(3) var<storage, read> kb : array<u32>;
`;

/** Phase 1: Floyd–Warshall inside the diagonal block, dist and next
 * both in shared tiles. */
const FW_P1 = wgsl`
${FW_PRELUDE}

var<workgroup> sd : array<f32, ${BS * BS}>;
var<workgroup> sn : array<i32, ${BS * BS}>;

@compute @workgroup_size(${TILE}, ${TILE})
fn main(@builtin(local_invocation_id) lid : vec3u) {
  let n = p.n;
  let base = kb[0] * ${BS}u;
  let t = lid.y * ${TILE}u + lid.x;

  for (var e = 0u; e < 4u; e = e + 1u) {
    let linear = t + e * 256u;
    let r = base + linear / ${BS}u;
    let c = base + linear % ${BS}u;
    var dv = ${FINF};
    var nv = -1;

    if (r < n && c < n) {
      dv = dist[r * n + c];
      nv = nxt[r * n + c];
    }

    sd[linear] = dv;
    sn[linear] = nv;
  }
  workgroupBarrier();

  let i0 = lid.y * 2u;
  let j0 = lid.x * 2u;

  for (var k = 0u; k < ${BS}u; k = k + 1u) {
    for (var di = 0u; di < 2u; di = di + 1u) {
      for (var dj = 0u; dj < 2u; dj = dj + 1u) {
        let i = i0 + di;
        let j = j0 + dj;
        let a = sd[i * ${BS}u + k];
        let b = sd[k * ${BS}u + j];

        if (a < ${FINF_BAND} && b < ${FINF_BAND}) {
          let alt = a + b;

          if (alt < sd[i * ${BS}u + j]) {
            sd[i * ${BS}u + j] = alt;
            sn[i * ${BS}u + j] = sn[i * ${BS}u + k];
          }
        }
      }
    }
    workgroupBarrier();
  }

  for (var e = 0u; e < 4u; e = e + 1u) {
    let linear = t + e * 256u;
    let r = base + linear / ${BS}u;
    let c = base + linear % ${BS}u;

    if (r < n && c < n) {
      dist[r * n + c] = sd[linear];
      nxt[r * n + c] = sn[linear];
    }
  }
}
`;

/** Phase 2, block-row half: block (kb, w) relaxes through the
 * finalized diagonal block on its left; the improving successor comes
 * from the diagonal block's next.  Row k of the block is a fixed
 * point of step k, so per-k barriers suffice. */
const FW_P2_ROW = wgsl`
${FW_PRELUDE}

var<workgroup> dd : array<f32, ${BS * BS}>;
var<workgroup> cd : array<f32, ${BS * BS}>;

@compute @workgroup_size(${TILE}, ${TILE})
fn main(
  @builtin(workgroup_id) wid : vec3u,
  @builtin(local_invocation_id) lid : vec3u,
) {
  if (wid.x == kb[0]) { return; }

  let n = p.n;
  let base = kb[0] * ${BS}u;
  let cbase = wid.x * ${BS}u;
  let t = lid.y * ${TILE}u + lid.x;

  for (var e = 0u; e < 4u; e = e + 1u) {
    let linear = t + e * 256u;
    let tr = linear / ${BS}u;
    let tc = linear % ${BS}u;
    var dv = ${FINF};
    var cv = ${FINF};

    if (base + tr < n && base + tc < n) {
      dv = dist[(base + tr) * n + base + tc];
    }

    if (base + tr < n && cbase + tc < n) {
      cv = dist[(base + tr) * n + cbase + tc];
    }

    dd[linear] = dv;
    cd[linear] = cv;
  }
  workgroupBarrier();

  let i0 = lid.y * 2u;
  let j0 = lid.x * 2u;

  for (var k = 0u; k < ${BS}u; k = k + 1u) {
    for (var di = 0u; di < 2u; di = di + 1u) {
      for (var dj = 0u; dj < 2u; dj = dj + 1u) {
        let i = i0 + di;
        let j = j0 + dj;
        let a = dd[i * ${BS}u + k];
        let b = cd[k * ${BS}u + j];

        if (a < ${FINF_BAND} && b < ${FINF_BAND}) {
          let alt = a + b;

          if (alt < cd[i * ${BS}u + j]) {
            cd[i * ${BS}u + j] = alt;

            if (base + i < n && cbase + j < n) {
              nxt[(base + i) * n + cbase + j] =
                nxt[(base + i) * n + base + k];
            }
          }
        }
      }
    }
    workgroupBarrier();
  }

  for (var e = 0u; e < 4u; e = e + 1u) {
    let linear = t + e * 256u;
    let r = base + linear / ${BS}u;
    let c = cbase + linear % ${BS}u;

    if (r < n && c < n) {
      dist[r * n + c] = cd[linear];
    }
  }
}
`;

/** Phase 2, block-column half: block (w, kb) relaxes through the
 * diagonal block beneath it; the improving successor comes from the
 * block's *own* next column k, which earlier steps may have written —
 * hence the storageBarrier beside the workgroup one. */
const FW_P2_COL = wgsl`
${FW_PRELUDE}

var<workgroup> dd : array<f32, ${BS * BS}>;
var<workgroup> cd : array<f32, ${BS * BS}>;

@compute @workgroup_size(${TILE}, ${TILE})
fn main(
  @builtin(workgroup_id) wid : vec3u,
  @builtin(local_invocation_id) lid : vec3u,
) {
  if (wid.x == kb[0]) { return; }

  let n = p.n;
  let base = kb[0] * ${BS}u;
  let rbase = wid.x * ${BS}u;
  let t = lid.y * ${TILE}u + lid.x;

  for (var e = 0u; e < 4u; e = e + 1u) {
    let linear = t + e * 256u;
    let tr = linear / ${BS}u;
    let tc = linear % ${BS}u;
    var dv = ${FINF};
    var cv = ${FINF};

    if (base + tr < n && base + tc < n) {
      dv = dist[(base + tr) * n + base + tc];
    }

    if (rbase + tr < n && base + tc < n) {
      cv = dist[(rbase + tr) * n + base + tc];
    }

    dd[linear] = dv;
    cd[linear] = cv;
  }
  workgroupBarrier();

  let i0 = lid.y * 2u;
  let j0 = lid.x * 2u;

  for (var k = 0u; k < ${BS}u; k = k + 1u) {
    for (var di = 0u; di < 2u; di = di + 1u) {
      for (var dj = 0u; dj < 2u; dj = dj + 1u) {
        let i = i0 + di;
        let j = j0 + dj;
        let a = cd[i * ${BS}u + k];
        let b = dd[k * ${BS}u + j];

        if (a < ${FINF_BAND} && b < ${FINF_BAND}) {
          let alt = a + b;

          if (alt < cd[i * ${BS}u + j]) {
            cd[i * ${BS}u + j] = alt;

            if (rbase + i < n && base + j < n) {
              nxt[(rbase + i) * n + base + j] =
                nxt[(rbase + i) * n + base + k];
            }
          }
        }
      }
    }
    workgroupBarrier();
    storageBarrier();
  }

  for (var e = 0u; e < 4u; e = e + 1u) {
    let linear = t + e * 256u;
    let r = rbase + linear / ${BS}u;
    let c = base + linear % ${BS}u;

    if (r < n && c < n) {
      dist[r * n + c] = cd[linear];
    }
  }
}
`;

/** Phase 3: every remaining block against its row and column panels —
 * a min-plus product with no in-phase dependency.  Each invocation
 * accumulates its 2×2 cells in registers with the best k per cell,
 * touching dist and next once per improved cell. */
const FW_P3 = wgsl`
${FW_PRELUDE}

var<workgroup> ad : array<f32, ${BS * BS}>;
var<workgroup> bd : array<f32, ${BS * BS}>;

@compute @workgroup_size(${TILE}, ${TILE})
fn main(
  @builtin(workgroup_id) wid : vec3u,
  @builtin(local_invocation_id) lid : vec3u,
) {
  if (wid.x == kb[0] || wid.y == kb[0]) { return; }

  let n = p.n;
  let base = kb[0] * ${BS}u;
  let rbase = wid.y * ${BS}u;
  let cbase = wid.x * ${BS}u;
  let t = lid.y * ${TILE}u + lid.x;

  for (var e = 0u; e < 4u; e = e + 1u) {
    let linear = t + e * 256u;
    let tr = linear / ${BS}u;
    let tc = linear % ${BS}u;
    var av = ${FINF};
    var bv = ${FINF};

    if (rbase + tr < n && base + tc < n) {
      av = dist[(rbase + tr) * n + base + tc];
    }

    if (base + tr < n && cbase + tc < n) {
      bv = dist[(base + tr) * n + cbase + tc];
    }

    ad[linear] = av;
    bd[linear] = bv;
  }
  workgroupBarrier();

  let i0 = lid.y * 2u;
  let j0 = lid.x * 2u;

  for (var di = 0u; di < 2u; di = di + 1u) {
    for (var dj = 0u; dj < 2u; dj = dj + 1u) {
      let i = i0 + di;
      let j = j0 + dj;
      let r = rbase + i;
      let c = cbase + j;

      if (r >= n || c >= n) { continue; }

      var cur = dist[r * n + c];
      var bestK = -1;

      for (var k = 0u; k < ${BS}u; k = k + 1u) {
        let a = ad[i * ${BS}u + k];
        let b = bd[k * ${BS}u + j];

        if (a < ${FINF_BAND} && b < ${FINF_BAND}) {
          let alt = a + b;

          if (alt < cur) {
            cur = alt;
            bestK = i32(k);
          }
        }
      }

      if (bestK >= 0) {
        dist[r * n + c] = cur;
        nxt[r * n + c] = nxt[r * n + base + u32(bestK)];
      }
    }
  }
}
`;

/**
 * Upload the sentinel-encoded matrices and build the blocked-relaxation
 * dispatch chain — the piece the closeness family shares (round 69):
 * closeness runs the same relaxation and then reduces each row on the
 * device instead of reading n² distances back.
 *
 * @param ctx — the shared device state
 * @param n — the node count (must be > 0)
 * @param dist — the f64 init distances (Infinity where unconnected)
 * @param next — the dense-index successor matrix from init
 * @returns the uploaded dist/next buffers, the dispatch chain that
 *   relaxes them in place, and the scratch buffers to destroy after
 *   submission
 */
export const fwRelaxPlan = (
  ctx: AlgoGpu,
  n: number,
  dist: Float64Array,
  next: Int32Array,
): {
  distBuf: GPUBuffer;
  nextBuf: GPUBuffer;
  dispatches: Dispatch[];
  scratch: GPUBuffer[];
} => {
  // Infinity → the finite sentinel the kernels understand
  const dist32 = new Float32Array(n * n);

  for (let i = 0; i < dist.length; i++) {
    dist32[i] = dist[i] === Infinity ? FINF : dist[i];
  }

  const distBuf = storageFrom(ctx, dist32);
  const nextBuf = storageFrom(ctx, Int32Array.from(next));
  const kbuf = storageFrom(ctx, new Uint32Array([0]));
  const pN = paramsNR(ctx, n, 0);

  const p1 = getPipeline(ctx, 'fw-p1', FW_P1);
  const p2row = getPipeline(ctx, 'fw-p2-row', FW_P2_ROW);
  const p2col = getPipeline(ctx, 'fw-p2-col', FW_P2_COL);
  const p3 = getPipeline(ctx, 'fw-p3', FW_P3);
  const bump = getPipeline(ctx, 'bump-word', BUMP_WORD);

  const nb = Math.ceil(n / BS);
  const mats = [pN, distBuf, nextBuf, kbuf];
  const p1Group = groupFor(ctx, p1, mats);
  const p2RowGroup = groupFor(ctx, p2row, mats);
  const p2ColGroup = groupFor(ctx, p2col, mats);
  const p3Group = groupFor(ctx, p3, mats);
  const bumpGroup = groupFor(ctx, bump, [kbuf]);
  const dispatches: Dispatch[] = [];

  for (let block = 0; block < nb; block++) {
    dispatches.push({ pipeline: p1, group: p1Group, groups: [1] });
    dispatches.push({ pipeline: p2row, group: p2RowGroup, groups: [nb] });
    dispatches.push({ pipeline: p2col, group: p2ColGroup, groups: [nb] });
    dispatches.push({ pipeline: p3, group: p3Group, groups: [nb, nb] });
    dispatches.push({ pipeline: bump, group: bumpGroup, groups: [1] });
  }

  return { distBuf, nextBuf, dispatches, scratch: [kbuf, pN] };
};

/**
 * The GPU Floyd–Warshall executor.  Shares init and result accessors
 * with the CPU reference; distances relax in f32, so a GPU distance
 * can differ from the CPU's f64 in float detail while the successor
 * matrix stays a valid shortest-path routing.
 *
 * @param ctx — the shared device state
 * @param coll — the calling collection
 * @param options — as the CPU reference
 * @returns the `{ distance, path }` accessors over read-back matrices
 * @throws GpuUnfitError when n² floats exceed the device's buffer limit
 */
export const floydWarshallGpu = async (
  ctx: AlgoGpu,
  coll: Collection,
  options: FloydWarshallOptions = {},
): Promise<FloydWarshallResult> => {
  const { view, n, dist, next, edgeNext } = initFloydWarshall(coll, options);
  const bytes = n * n * 4;

  assertFits(ctx, bytes, 'floydWarshall');

  if (n === 0) {
    return floydWarshallResultFrom(coll, view, n, dist, next, edgeNext);
  }

  const { distBuf, nextBuf, dispatches, scratch } = fwRelaxPlan(
    ctx,
    n,
    dist,
    next,
  );

  submitPass(ctx, dispatches);

  const outDist = new Float32Array(await readBack(ctx, distBuf, bytes));
  const outNext = new Int32Array(await readBack(ctx, nextBuf, bytes));

  for (const buffer of [distBuf, nextBuf, ...scratch]) {
    buffer.destroy();
  }

  // the sentinel band reads back as Infinity, as the accessors expect
  for (let i = 0; i < outDist.length; i++) {
    if (outDist[i] >= FINF_BAND) {
      outDist[i] = Infinity;
    }
  }

  return floydWarshallResultFrom(coll, view, n, outDist, outNext, edgeNext);
};
