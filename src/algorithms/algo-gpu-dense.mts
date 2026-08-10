/*
The shared dense-matrix WGSL kernels (round 65).

MCL, PageRank, affinity propagation and Floyd–Warshall all iterate
over dense row-major matrices, and their kernels compose from the same
few pieces defined here.  Two conventions every kernel follows:

- **The flags buffer is the run's control word**: `flags[0]` is the
  converged bit, `flags[1]` the iteration's any-difference accumulator.
  Every iteration of every algorithm is encoded up front (no
  per-iteration readback — the round-9 one-readback discipline), so
  kernels neutralise themselves once `flags[0]` is set: barrier-free
  kernels early-return on a plain read, and barrier kernels read the
  bit through `workgroupUniformLoad`, which makes it *uniform* and so
  lets the whole workgroup return before its barriers (65.8 — a raw
  storage read is non-uniform under the analysis, and round 65's
  first version had to run converged matmuls to completion and merely
  skip their stores).  Either way the matrices stop changing at
  convergence, exactly like the CPU loop's `break`.

- **f32 everywhere** — WGSL has no f64.  The CPU reference is the
  spec; parity is pinned by invariants, not bits.

- **Occupancy is the first number to check** (65.8).  A kernel with
  one invocation per row/column/cluster launches n-ish threads — a
  handful of workgroups — and idles the device; the 65.8 rewrites
  made those one *workgroup* per row with lanes striding and
  tree-reducing, which is where the biggest single-family wins of the
  perf pass came from.
*/

import { wgsl } from '../render/wgsl.mjs';

/** Workgroup edge for 2D matrix kernels (16×16 = 256 invocations). */
export const TILE = 16;
/** Workgroup size for 1D vector kernels. */
export const WG = 256;

const PRELUDE = wgsl`
struct P {
  n : u32,
  r : f32,
}
@group(0) @binding(0) var<uniform> p : P;
`;

/** Matmul tile edge: 32×32 tiles walked by 16×16 invocations, each
 * accumulating a 2×2 register block (round 65.8 — the plain 16×16
 * one-output-per-invocation version measured memory-bound well under
 * the device's throughput). */
export const MM_TILE = 32;

/** c = a × b, tiled with 2×2 register blocking; a converged run
 * early-exits whole workgroups via the uniform flag load. */
export const MATMUL = wgsl`
${PRELUDE}
@group(0) @binding(1) var<storage, read> a : array<f32>;
@group(0) @binding(2) var<storage, read> b : array<f32>;
@group(0) @binding(3) var<storage, read_write> c : array<f32>;
@group(0) @binding(4) var<storage, read_write> flags : array<atomic<u32>>;

var<workgroup> ta : array<f32, ${MM_TILE * MM_TILE}>;
var<workgroup> tb : array<f32, ${MM_TILE * MM_TILE}>;
var<workgroup> wflag : u32;

@compute @workgroup_size(${TILE}, ${TILE})
fn main(
  @builtin(workgroup_id) wid : vec3u,
  @builtin(local_invocation_id) lid : vec3u,
) {
  // uniform early exit: a post-converge matmul must cost a flag read,
  // not a full tile walk (workgroupUniformLoad makes the bit uniform,
  // which a raw storage read is not under the uniformity analysis)
  if (lid.x == 0u && lid.y == 0u) { wflag = atomicLoad(&flags[0]); }
  if (workgroupUniformLoad(&wflag) == 1u) { return; }

  let n = p.n;
  let row0 = wid.y * ${MM_TILE}u + lid.y * 2u;
  let col0 = wid.x * ${MM_TILE}u + lid.x * 2u;
  let t = lid.y * ${TILE}u + lid.x;
  var acc00 = 0.0;
  var acc01 = 0.0;
  var acc10 = 0.0;
  var acc11 = 0.0;
  let tiles = (n + ${MM_TILE - 1}u) / ${MM_TILE}u;

  for (var tt = 0u; tt < tiles; tt = tt + 1u) {
    // 1024 tile elements over 256 invocations: 4 coalesced loads each
    for (var e = 0u; e < 4u; e = e + 1u) {
      let linear = t + e * 256u;
      let tr = linear / ${MM_TILE}u;
      let tc = linear % ${MM_TILE}u;
      let ar = wid.y * ${MM_TILE}u + tr;
      let ac = tt * ${MM_TILE}u + tc;
      let br = tt * ${MM_TILE}u + tr;
      let bc = wid.x * ${MM_TILE}u + tc;
      var av = 0.0;
      var bv = 0.0;

      if (ar < n && ac < n) { av = a[ar * n + ac]; }
      if (br < n && bc < n) { bv = b[br * n + bc]; }

      ta[linear] = av;
      tb[linear] = bv;
    }
    workgroupBarrier();

    for (var k = 0u; k < ${MM_TILE}u; k = k + 1u) {
      let a0 = ta[(lid.y * 2u) * ${MM_TILE}u + k];
      let a1 = ta[(lid.y * 2u + 1u) * ${MM_TILE}u + k];
      let b0 = tb[k * ${MM_TILE}u + lid.x * 2u];
      let b1 = tb[k * ${MM_TILE}u + lid.x * 2u + 1u];

      acc00 = acc00 + a0 * b0;
      acc01 = acc01 + a0 * b1;
      acc10 = acc10 + a1 * b0;
      acc11 = acc11 + a1 * b1;
    }
    workgroupBarrier();
  }

  if (row0 < n && col0 < n) { c[row0 * n + col0] = acc00; }
  if (row0 < n && col0 + 1u < n) { c[row0 * n + col0 + 1u] = acc01; }
  if (row0 + 1u < n && col0 < n) { c[(row0 + 1u) * n + col0] = acc10; }
  if (row0 + 1u < n && col0 + 1u < n) {
    c[(row0 + 1u) * n + col0 + 1u] = acc11;
  }
}
`;

/** dst[i] = pow(src[i], p.r), element-wise over the n×n matrix. */
export const POW_MAT = wgsl`
${PRELUDE}
@group(0) @binding(1) var<storage, read> src : array<f32>;
@group(0) @binding(2) var<storage, read_write> dst : array<f32>;
@group(0) @binding(3) var<storage, read_write> flags : array<atomic<u32>>;

@compute @workgroup_size(${TILE}, ${TILE})
fn main(@builtin(global_invocation_id) gid : vec3u) {
  if (atomicLoad(&flags[0]) == 1u) { return; }
  if (gid.x >= p.n || gid.y >= p.n) { return; }

  let i = gid.y * p.n + gid.x;

  dst[i] = pow(src[i], p.r);
}
`;

/** sums[j] = Σ_i m[i][j] — one invocation per column. */
export const COL_SUMS = wgsl`
${PRELUDE}
@group(0) @binding(1) var<storage, read> m : array<f32>;
@group(0) @binding(2) var<storage, read_write> sums : array<f32>;
@group(0) @binding(3) var<storage, read_write> flags : array<atomic<u32>>;

@compute @workgroup_size(${WG})
fn main(@builtin(global_invocation_id) gid : vec3u) {
  if (atomicLoad(&flags[0]) == 1u) { return; }

  let j = gid.x;

  if (j >= p.n) { return; }

  var s = 0.0;

  for (var i = 0u; i < p.n; i = i + 1u) {
    s = s + m[i * p.n + j];
  }

  sums[j] = s;
}
`;

/** m[i][j] /= sums[j] in place (0-sum columns divide to NaN, as on CPU). */
export const COL_NORMALIZE = wgsl`
${PRELUDE}
@group(0) @binding(1) var<storage, read_write> m : array<f32>;
@group(0) @binding(2) var<storage, read> sums : array<f32>;
@group(0) @binding(3) var<storage, read_write> flags : array<atomic<u32>>;

@compute @workgroup_size(${TILE}, ${TILE})
fn main(@builtin(global_invocation_id) gid : vec3u) {
  if (atomicLoad(&flags[0]) == 1u) { return; }
  if (gid.x >= p.n || gid.y >= p.n) { return; }

  let i = gid.y * p.n + gid.x;

  m[i] = m[i] / sums[gid.x];
}
`;

/** Set flags[1] when g and f differ after rounding to p.r decimals'
 * scale (the uniform carries the scale, e.g. 1e4 for 4 decimals). */
export const ROUND_COMPARE = wgsl`
${PRELUDE}
@group(0) @binding(1) var<storage, read> g : array<f32>;
@group(0) @binding(2) var<storage, read> f : array<f32>;
@group(0) @binding(3) var<storage, read_write> flags : array<atomic<u32>>;

@compute @workgroup_size(${TILE}, ${TILE})
fn main(@builtin(global_invocation_id) gid : vec3u) {
  if (atomicLoad(&flags[0]) == 1u) { return; }
  if (gid.x >= p.n || gid.y >= p.n) { return; }

  let i = gid.y * p.n + gid.x;

  if (round(g[i] * p.r) != round(f[i] * p.r)) {
    atomicStore(&flags[1], 1u);
  }
}
`;

/** dst = src, element-wise over the n×n matrix. */
export const COPY_MAT = wgsl`
${PRELUDE}
@group(0) @binding(1) var<storage, read> src : array<f32>;
@group(0) @binding(2) var<storage, read_write> dst : array<f32>;
@group(0) @binding(3) var<storage, read_write> flags : array<atomic<u32>>;

@compute @workgroup_size(${TILE}, ${TILE})
fn main(@builtin(global_invocation_id) gid : vec3u) {
  if (atomicLoad(&flags[0]) == 1u) { return; }
  if (gid.x >= p.n || gid.y >= p.n) { return; }

  let i = gid.y * p.n + gid.x;

  dst[i] = src[i];
}
`;

/** Advance a one-word storage counter (one invocation) — the step/
 * iteration index kernels read, letting a whole run encode into one
 * pass with no per-step uniform writes. */
export const BUMP_WORD = wgsl`
@group(0) @binding(0) var<storage, read_write> word : array<u32>;

@compute @workgroup_size(1)
fn main() {
  word[0] = word[0] + 1u;
}
`;

/** Clear the iteration's any-difference bit (one invocation). */
export const RESET_DIFF = wgsl`
@group(0) @binding(0) var<storage, read_write> flags : array<atomic<u32>>;

@compute @workgroup_size(1)
fn main() {
  if (atomicLoad(&flags[0]) == 1u) { return; }

  atomicStore(&flags[1], 0u);
}
`;

/** After an iteration: nothing differed means converged (one invocation). */
export const CONVERGE_ON_NO_DIFF = wgsl`
@group(0) @binding(0) var<storage, read_write> flags : array<atomic<u32>>;

@compute @workgroup_size(1)
fn main() {
  if (atomicLoad(&flags[0]) == 1u) { return; }

  if (atomicLoad(&flags[1]) == 0u) {
    atomicStore(&flags[0], 1u);
  }
}
`;
