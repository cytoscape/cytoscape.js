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
  kernels early-return, and the tiled matmul — whose workgroup
  barriers forbid a divergent return under WGSL's uniformity analysis
  — computes normally but skips its store.  Either way the matrices
  stop changing at convergence, exactly like the CPU loop's `break`.

- **f32 everywhere** — WGSL has no f64.  The CPU reference is the
  spec; parity is pinned by invariants, not bits.
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

/** c = a × b, tiled; the store is skipped once the run has converged. */
export const MATMUL = wgsl`
${PRELUDE}
@group(0) @binding(1) var<storage, read> a : array<f32>;
@group(0) @binding(2) var<storage, read> b : array<f32>;
@group(0) @binding(3) var<storage, read_write> c : array<f32>;
@group(0) @binding(4) var<storage, read_write> flags : array<atomic<u32>>;

var<workgroup> ta : array<f32, ${TILE * TILE}>;
var<workgroup> tb : array<f32, ${TILE * TILE}>;

@compute @workgroup_size(${TILE}, ${TILE})
fn main(
  @builtin(global_invocation_id) gid : vec3u,
  @builtin(local_invocation_id) lid : vec3u,
) {
  let n = p.n;
  let row = gid.y;
  let col = gid.x;
  var sum = 0.0;
  let tiles = (n + ${TILE - 1}u) / ${TILE}u;

  for (var t = 0u; t < tiles; t = t + 1u) {
    let ac = t * ${TILE}u + lid.x;
    let br = t * ${TILE}u + lid.y;
    var av = 0.0;
    var bv = 0.0;

    if (row < n && ac < n) { av = a[row * n + ac]; }
    if (br < n && col < n) { bv = b[br * n + col]; }

    ta[lid.y * ${TILE}u + lid.x] = av;
    tb[lid.y * ${TILE}u + lid.x] = bv;
    workgroupBarrier();

    for (var k = 0u; k < ${TILE}u; k = k + 1u) {
      sum = sum + ta[lid.y * ${TILE}u + k] * tb[k * ${TILE}u + lid.x];
    }
    workgroupBarrier();
  }

  if (row < n && col < n && atomicLoad(&flags[0]) == 0u) {
    c[row * n + col] = sum;
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
