/*
Sparse mat-vec on the GPU (round 72.1).

pageRank and Katz iterate tmp = M·v where M is structurally the
(weighted, transposed) adjacency: O(E) non-zeros in an n×n matrix.
Round 65's `MATVEC` uploaded the dense n² f32 matrix and read all of it
per iteration, which is why the sparse CPU iteration (65.10) owned
both families outright under 'auto'.  This module is the sparse
formulation: the matrix uploads once as CSR — rowPtr / colIdx / vals,
O(E) bytes — and the kernel gathers each row's non-zeros.

Kernel shape: a fixed `ROW_LANES` lanes per row, `WG / ROW_LANES` rows
per workgroup, the lanes striding the row's CSR range and tree-reducing
in workgroup memory.  Measured at n=2048 over 1000 forced iterations
(amd gcn-4, 2026-09-18; the sparse fixture has ~2.3k edges, the dense
one ~350k):

  lanes    sparse     dense
      1   25.6 ms   229.3 ms
      8   25.1 ms    65.1 ms
     16   25.2 ms    64.5 ms
     32   26.1 ms    55.8 ms
     64   29.6 ms    56.7 ms

On the sparse fixture every shape sits at the two-dispatch-per-
iteration floor (~25 µs), so the constant is chosen on the dense
column: 32.  One invocation per row (the `1` row) serializes a
170-entry row per thread and is 4× off the best; a whole workgroup per
row would waste 254 of 256 lanes on a degree-2 row.  Like `MATVEC` the
kernel is flags-guarded — a converged run's remaining encoded
iterations cost one uniform flag read per workgroup — and the guard
never branches a barrier.

Two things the measurement taught, worth keeping: (1) a pipeline whose
WGSL fails to compile *runs as a no-op* and reads back its initial
vector — `precision` is a reserved word, and the first epilogue draft
used it as a field name; the parity spec caught it because the
unchanged vector is nowhere near the reference.  A timing row must
check its result or it will price an empty command buffer as a fast
kernel, which is exactly what the first lane sweep here did with a
`0.5u` stride.  (2) The per-call floor on this box is the `mapAsync`
readback, ~3.5 ms, not the kernel: see the round-72 record for why
'auto' keeps both families on the CPU.
*/

import { wgsl } from '../render/wgsl.mjs';
import type { AlgoGpu } from './algo-gpu.mjs';
import { getPipeline, groupFor, storageFrom } from './algo-gpu.mjs';
import type { Dispatch } from './algo-gpu.mjs';
import { WG } from './algo-gpu-dense.mjs';

/** Lanes cooperating on one CSR row. */
export const ROW_LANES = 32;
/** Rows one workgroup covers. */
export const ROWS_PER_WG = WG / ROW_LANES;

/** A row-major CSR matrix in the upload-ready typed arrays. */
export interface Csr {
  rowPtr: Uint32Array;
  colIdx: Uint32Array;
  vals: Float32Array;
}

/**
 * Build CSR from (row, col, val) triplets by counting sort on the row,
 * so a row's entries keep their input order.  Entries past `count`
 * are ignored (the builders over-allocate to the edge count and fill
 * fewer once loops drop out).
 *
 * @param n — the row count
 * @param rows — the row index per entry
 * @param cols — the column index per entry
 * @param vals — the value per entry (f64; stored as f32)
 * @param count — how many leading entries are live
 * @returns the CSR arrays
 */
export const csrFromTriplets = (
  n: number,
  rows: Int32Array,
  cols: Int32Array,
  vals: Float64Array,
  count: number,
): Csr => {
  const rowPtr = new Uint32Array(n + 1);

  for (let e = 0; e < count; e++) {
    rowPtr[rows[e] + 1]++;
  }

  for (let i = 0; i < n; i++) {
    rowPtr[i + 1] += rowPtr[i];
  }

  const fill = new Uint32Array(n);
  const colIdx = new Uint32Array(count);
  const out = new Float32Array(count);

  for (let e = 0; e < count; e++) {
    const r = rows[e];
    const at = rowPtr[r] + fill[r];

    colIdx[at] = cols[e];
    out[at] = vals[e];
    fill[r]++;
  }

  return { rowPtr, colIdx, vals: out };
};

/** tmp = csr × v, ROW_LANES lanes per row, flags-guarded. */
export const SPMV = wgsl`
struct P { n : u32, r : f32 }
@group(0) @binding(0) var<uniform> p : P;
@group(0) @binding(1) var<storage, read> rowPtr : array<u32>;
@group(0) @binding(2) var<storage, read> colIdx : array<u32>;
@group(0) @binding(3) var<storage, read> vals : array<f32>;
@group(0) @binding(4) var<storage, read> v : array<f32>;
@group(0) @binding(5) var<storage, read_write> tmp : array<f32>;
@group(0) @binding(6) var<storage, read_write> flags : array<atomic<u32>>;

var<workgroup> partial : array<f32, ${WG}>;
var<workgroup> wflag : u32;

@compute @workgroup_size(${WG})
fn main(
  @builtin(workgroup_id) wid : vec3u,
  @builtin(local_invocation_id) lid : vec3u,
) {
  if (lid.x == 0u) { wflag = atomicLoad(&flags[0]); }
  if (workgroupUniformLoad(&wflag) == 1u) { return; }

  let lane = lid.x % ${ROW_LANES}u;
  let i = wid.x * ${ROWS_PER_WG}u + lid.x / ${ROW_LANES}u;
  var s = 0.0;

  if (i < p.n) {
    let end = rowPtr[i + 1u];

    for (var e = rowPtr[i] + lane; e < end; e = e + ${ROW_LANES}u) {
      s = s + vals[e] * v[colIdx[e]];
    }
  }

  partial[lid.x] = s;
  workgroupBarrier();

  for (var stride = ${ROW_LANES >> 1}u; stride > 0u; stride = stride >> 1u) {
    if (lane < stride) {
      partial[lid.x] = partial[lid.x] + partial[lid.x + stride];
    }
    workgroupBarrier();
  }

  if (lane == 0u && i < p.n) {
    tmp[i] = partial[lid.x];
  }
}
`;

/** The uploaded CSR buffers of one run. */
export interface CsrBuffers {
  rowPtr: GPUBuffer;
  colIdx: GPUBuffer;
  vals: GPUBuffer;
}

/**
 * Upload a CSR matrix as three storage buffers.
 *
 * @param ctx — the shared device state
 * @param csr — the matrix
 * @returns the buffers, to destroy after the run
 */
export const uploadCsr = (ctx: AlgoGpu, csr: Csr): CsrBuffers => ({
  rowPtr: storageFrom(ctx, csr.rowPtr),
  colIdx: storageFrom(ctx, csr.colIdx),
  vals: storageFrom(ctx, csr.vals),
});

/**
 * The SpMV dispatch tmp = csr × v for an n-row matrix.
 *
 * @param ctx — the shared device state
 * @param n — the row count
 * @param p — the `P { n, r }` uniform (r unused here)
 * @param csr — the uploaded matrix
 * @param v — the input vector
 * @param tmp — the output vector
 * @param flags — the converge flag word
 * @returns the dispatch to encode once per iteration
 */
export const spmvDispatch = (
  ctx: AlgoGpu,
  n: number,
  p: GPUBuffer,
  csr: CsrBuffers,
  v: GPUBuffer,
  tmp: GPUBuffer,
  flags: GPUBuffer,
): Dispatch => {
  const pipeline = getPipeline(ctx, 'spmv', SPMV);

  return {
    pipeline,
    group: groupFor(ctx, pipeline, [
      p,
      csr.rowPtr,
      csr.colIdx,
      csr.vals,
      v,
      tmp,
      flags,
    ]),
    groups: [Math.ceil(n / ROWS_PER_WG)],
  };
};
