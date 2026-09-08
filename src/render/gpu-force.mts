/*
The GPU force integrator (round 18.3): the 18.1 reference simulation's
kernels, run on-device while a `force` layout animates a flat rendered
graph — the round-9 "GPU layouts" design, built.

Structure per iteration (encoded before the frame's cull pass so
edges/labels read the advanced positions):

  clear grid → bin count → serial exclusive scan → scatter →
  pyramid aggregate → pyramid reduce (per level) → force gather →
  apply

The 59.3 far field rides a **monopole pyramid** over the binning grid
(count/Σx/Σy per cell, each level halving the dims): the force kernel
gathers the finest 3×3 exactly and, per level, the aligned 6×6 block
refining the parent's 3×3 minus its own 3×3 — the CPU sim's scheme,
kernel for kernel.  `cellStart`, `cellItems` and the pyramid share
**one grid buffer** ([starts][items][f32 triplets, bitcast]), which is
what keeps the force kernel at 7 storage bindings after the far field
joined — the round-58 freed-binding lesson applied to compute.

The sim is **sim-indexed** (compacted over the participating leaves),
with a final publish step inside `apply` scattering movable nodes'
coordinates into the slot-indexed `node.position` mirror buffer — the
render source.  The mirror skips CPU uploads of `node.position` while
the run holds the lease (the tween-ownership machinery), so sync CPU
reads are stale-by-design mid-run (the motion-staleness rule; exactly
the position-tween contract).

Binding budget: compute stages carry the same base 8-storage-buffer
limit as everything else, so each kernel gets its **own** bind group
with exactly the buffers it touches, and the hot gather packs its
inputs — the incident CSR is one buffer ([n+1 starts][entries]),
edges ride a 3-word stride ([source, target, lengthBits]), the pin
flag rides bit 31 of the slot map, and the alpha window + tick +
displacement max share one atomic meta buffer.  The force kernel
lands at exactly 8 storage bindings.

Alpha annealing: the CPU precomputes ALPHA_WINDOW iterations' alphas
into the meta buffer each frame; `apply`'s invocation 0 bumps the
device tick that indexes the window, so any number of iterations can
be encoded per submit with no per-iteration uniform writes.

Convergence: `apply` folds displacements into an atomicMax over the
f32's monotonic u32 bits; a 4-byte staging readback per frame drives
the CPU-side settle call, then `readPositions()`'s one readback —
the sole readback exception in the architecture (round 9) — hands the
final coordinates back for the layout to write into the store.

Recorded narrowing vs the plan text: the grid *scatter* orders nodes
within a cell by atomic arrival, so GPU trajectories are not
guaranteed bit-identical run-to-run — seeded bit-reproducibility is
the CPU executor's guarantee; GPU correctness pins invariants (18.4).
*/

import { wgsl } from './wgsl.mjs';
import { BUFFER_USAGE, MAP_MODE } from './webgpu-constants.mjs';
import {
  FLOOR_SWEEP_BUDGET,
  REHEAT_ALPHA,
  SWEEP_QUIET,
  SWEEPS_PER_TICK,
} from '../layout/force-sim.mjs';
import type { ForceExtents, ForceParams } from '../layout/force-sim.mjs';

const WG = 64;
/** the cell scan's one workgroup (119): 256 threads over at most
 * MAX_GRID² cells, so a thread's chunk is at most 256 cells */
const SCAN_WG = 256;
const ALPHA_WINDOW = 64;
/** the most iterations one encode may carry: the alpha window the
 * CPU precomputes for the device tick (119) */
export const MAX_BATCH = ALPHA_WINDOW;

/**
 * The iterations the next frame of a *non-presenting* run should encode
 * (119).  A run nobody watches has no reason to be paced by vsync at the
 * live stream's `stepsPerFrame`: em-web's 300-iteration settle was 100
 * frames — 1.5 s — under that pacing, where the CPU sim takes 0.4 s.
 * So the batch doubles every frame the device keeps up and halves when
 * it falls behind — the renderer skipped a scene pass under its
 * frames-in-flight backpressure, which is the device's own signal (a
 * readback's latency is not: mapAsync resolves 4–100 ms after a trivial
 * batch here, erratically, and a batch that dropped on it ran em-web
 * at half the fixed-batch speed).  The settle test counts three quiet
 * polls whatever the batch, so a large batch past the field's rest
 * costs iterations the device had idle time for, not frames.  Pure, so
 * the module suite pins it.
 *
 * @param current — the batch encoded last frame
 * @param base — the run's `stepsPerFrame` (the floor)
 * @param behind — the last frame was skipped under backpressure
 * @returns the batch for this frame, within [base, MAX_BATCH]
 */
export function nextBatch(
  current: number,
  base: number,
  behind: boolean,
): number {
  const floor = Math.max(1, Math.min(base, MAX_BATCH));

  if (behind) {
    return Math.min(MAX_BATCH, Math.max(floor, Math.floor(current / 2)));
  }

  return Math.min(MAX_BATCH, Math.max(floor, current * 2));
}
/** grid capped at 256×256 cells (the serial scan's budget) */
const MAX_GRID = 256;

const PRELUDE = wgsl`
struct FParams {
  n: u32,
  gridCols: u32,
  gridRows: u32,
  cells: u32,
  gridX: f32,
  gridY: f32,
  cellSize: f32,
  cutoff: f32,
  repulsion: f32,
  stiffness: f32,
  gravity: f32,
  anchorBase: u32,
  levels: u32,
  pyrBase: u32,
  extBase: u32,
  hasExt: u32,
}
`;

/** the per-level uniform the pyramid reduce kernel takes (59.3) */
const LEVEL_PRELUDE = wgsl`
struct LParams {
  srcCols: u32,
  srcRows: u32,
  srcBase: u32,
  dstCols: u32,
  dstRows: u32,
  dstBase: u32,
  pad0: u32,
  pad1: u32,
}
`;

/** meta layout: [0] tick, [1] maxDispBits, [2..] the alpha window */
/** the separation sweep's largest push, its own atomic max (119.3):
 * the settle reads it against SWEEP_QUIET, not `threshold` */
const META_PUSH = 2;
const META_ALPHA0 = 3;

const KERNELS: Record<string, string> = {
  clearGrid: wgsl`${PRELUDE}
@group(0) @binding(0) var<uniform> params: FParams;
@group(0) @binding(1) var<storage, read_write> cellCount: array<atomic<u32>>;

@compute @workgroup_size(${WG})
fn main(@builtin(global_invocation_id) gid: vec3u) {
  if (gid.x < params.cells) { atomicStore(&cellCount[gid.x], 0u); }
}`,

  binCount: wgsl`${PRELUDE}
@group(0) @binding(0) var<uniform> params: FParams;
@group(0) @binding(1) var<storage, read> simPos: array<f32>;
@group(0) @binding(2) var<storage, read_write> cellOf: array<u32>;
@group(0) @binding(3) var<storage, read_write> cellCount: array<atomic<u32>>;

@compute @workgroup_size(${WG})
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  if (i >= params.n) { return; }
  let cx = u32(clamp((simPos[i * 2u] - params.gridX) / params.cellSize, 0.0, f32(params.gridCols - 1u)));
  let cy = u32(clamp((simPos[i * 2u + 1u] - params.gridY) / params.cellSize, 0.0, f32(params.gridRows - 1u)));
  let c = cy * params.gridCols + cx;
  cellOf[i] = c;
  atomicAdd(&cellCount[c], 1u);
}`,

  scanCells: wgsl`${PRELUDE}
@group(0) @binding(0) var<uniform> params: FParams;
@group(0) @binding(1) var<storage, read_write> cellCount: array<atomic<u32>>;
@group(0) @binding(2) var<storage, read_write> grid: array<u32>;

var<workgroup> chunkSums: array<u32, ${SCAN_WG}>;

// exclusive scan over the (bounded) cell array in one workgroup (119):
// each thread totals a contiguous chunk of cells, the chunk totals are
// scanned in shared memory (Hillis-Steele, uniform control flow), and
// each thread writes its chunk's prefixes and rewinds the counters so
// scatter can reuse them as cursors.  The serial single-thread scan
// this replaces walked every cell through one dependent chain — 3 ms
// per iteration at 10k cells, 19 ms at the 65k cap — and was what the
// GPU executor's iteration cost scaled with.  cellStart lives at the
// head of the shared grid buffer (59.3's fold).
@compute @workgroup_size(${SCAN_WG})
fn main(@builtin(local_invocation_id) lid3: vec3u) {
  let lid = lid3.x;
  let cells = params.cells;
  let chunk = (cells + ${SCAN_WG}u - 1u) / ${SCAN_WG}u;
  let begin = min(lid * chunk, cells);
  let end = min(begin + chunk, cells);
  var total = 0u;
  for (var c = begin; c < end; c = c + 1u) {
    total = total + atomicLoad(&cellCount[c]);
  }
  chunkSums[lid] = total;
  workgroupBarrier();
  for (var offset = 1u; offset < ${SCAN_WG}u; offset = offset << 1u) {
    var v = 0u;
    if (lid >= offset) { v = chunkSums[lid - offset]; }
    workgroupBarrier();
    chunkSums[lid] = chunkSums[lid] + v;
    workgroupBarrier();
  }
  var run = chunkSums[lid] - total;
  for (var c = begin; c < end; c = c + 1u) {
    let count = atomicLoad(&cellCount[c]);
    grid[c] = run;
    run = run + count;
    atomicStore(&cellCount[c], 0u);
  }
  if (lid == ${SCAN_WG}u - 1u) { grid[cells] = chunkSums[lid]; }
}`,

  scatter: wgsl`${PRELUDE}
@group(0) @binding(0) var<uniform> params: FParams;
@group(0) @binding(1) var<storage, read> cellOf: array<u32>;
@group(0) @binding(2) var<storage, read_write> cellCount: array<atomic<u32>>;
@group(0) @binding(3) var<storage, read_write> grid: array<u32>;

@compute @workgroup_size(${WG})
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  if (i >= params.n) { return; }
  let c = cellOf[i];
  let itemsBase = params.cells + 1u;
  grid[itemsBase + grid[c] + atomicAdd(&cellCount[c], 1u)] = i;
}`,

  // level-0 monopoles: one thread per finest cell walks its item list
  // and *writes* (never accumulates — no clear pass needed) the
  // count/Σx/Σy triplet into the pyramid region
  aggregate: wgsl`${PRELUDE}
@group(0) @binding(0) var<uniform> params: FParams;
@group(0) @binding(1) var<storage, read> simPos: array<f32>;
@group(0) @binding(2) var<storage, read_write> grid: array<u32>;

@compute @workgroup_size(${WG})
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let c = gid.x;
  if (c >= params.cells) { return; }
  let itemsBase = params.cells + 1u;
  var cnt = 0.0;
  var sx = 0.0;
  var sy = 0.0;
  for (var at = grid[c]; at < grid[c + 1u]; at = at + 1u) {
    let j = grid[itemsBase + at];
    cnt = cnt + 1.0;
    sx = sx + simPos[j * 2u];
    sy = sy + simPos[j * 2u + 1u];
  }
  let o = params.pyrBase + c * 3u;
  grid[o] = bitcast<u32>(cnt);
  grid[o + 1u] = bitcast<u32>(sx);
  grid[o + 2u] = bitcast<u32>(sy);
}`,

  // one dispatch per pyramid level: each coarse cell sums its <= 4
  // children — a fixed reduction, deterministic per executor
  reduce: wgsl`${LEVEL_PRELUDE}
@group(0) @binding(0) var<uniform> lp: LParams;
@group(0) @binding(1) var<storage, read_write> grid: array<u32>;

@compute @workgroup_size(${WG})
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let d = gid.x;
  if (d >= lp.dstCols * lp.dstRows) { return; }
  let dx = d % lp.dstCols;
  let dy = d / lp.dstCols;
  var cnt = 0.0;
  var sx = 0.0;
  var sy = 0.0;
  for (var oy = 0u; oy < 2u; oy = oy + 1u) {
    for (var ox = 0u; ox < 2u; ox = ox + 1u) {
      let sxc = dx * 2u + ox;
      let syc = dy * 2u + oy;
      if (sxc < lp.srcCols && syc < lp.srcRows) {
        let s = lp.srcBase + (syc * lp.srcCols + sxc) * 3u;
        cnt = cnt + bitcast<f32>(grid[s]);
        sx = sx + bitcast<f32>(grid[s + 1u]);
        sy = sy + bitcast<f32>(grid[s + 2u]);
      }
    }
  }
  let o = lp.dstBase + d * 3u;
  grid[o] = bitcast<u32>(cnt);
  grid[o + 1u] = bitcast<u32>(sx);
  grid[o + 2u] = bitcast<u32>(sy);
}`,

  force: wgsl`${PRELUDE}
@group(0) @binding(0) var<uniform> params: FParams;
@group(0) @binding(1) var<storage, read> simPos: array<f32>;
@group(0) @binding(2) var<storage, read_write> forces: array<f32>;
// [cellStart (cells+1)][cellItems (n)][pyramid f32 triplets] (59.3)
@group(0) @binding(3) var<storage, read> grid: array<u32>;
// the incident CSR packed as [n+1 starts][edge indices][anchors][extents]
@group(0) @binding(4) var<storage, read> csr: array<u32>;
// edges at stride 3: [source, target, bitcast(edgeLength)]
@group(0) @binding(5) var<storage, read> edgesPacked: array<u32>;
// slot | pinned << 31
@group(0) @binding(6) var<storage, read> slotPin: array<u32>;
@group(0) @binding(7) var<storage, read_write> fmeta: array<atomic<u32>>;

@compute @workgroup_size(${WG})
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  if (i >= params.n) { return; }
  if ((slotPin[i] >> 31u) == 1u) { forces[i * 2u] = 0.0; forces[i * 2u + 1u] = 0.0; return; }

  let tick = atomicLoad(&fmeta[0]);
  let alpha = bitcast<f32>(atomicLoad(&fmeta[${META_ALPHA0}u + (tick % ${ALPHA_WINDOW}u)]));
  let x = simPos[i * 2u];
  let y = simPos[i * 2u + 1u];
  var fx = 0.0;
  var fy = 0.0;
  let cutoff = params.cutoff;
  let cutoff2 = cutoff * cutoff;
  let itemsBase = params.cells + 1u;

  // near field: exact pairs over the finest 3x3 (the CPU gather,
  // verbatim); the cell recomputes from the position (cellOf unbound)
  let cx = i32(clamp((x - params.gridX) / params.cellSize, 0.0, f32(params.gridCols - 1u)));
  let cy = i32(clamp((y - params.gridY) / params.cellSize, 0.0, f32(params.gridRows - 1u)));

  for (var gy = max(0, cy - 1); gy <= min(i32(params.gridRows) - 1, cy + 1); gy = gy + 1) {
    for (var gx = max(0, cx - 1); gx <= min(i32(params.gridCols) - 1, cx + 1); gx = gx + 1) {
      let c = u32(gy) * params.gridCols + u32(gx);
      for (var at = grid[c]; at < grid[c + 1u]; at = at + 1u) {
        let j = grid[itemsBase + at];
        if (j == i) { continue; }
        var dx = x - simPos[j * 2u];
        var dy = y - simPos[j * 2u + 1u];
        var d2 = dx * dx + dy * dy;
        if (d2 < 1e-8) {
          let h = (i * 31u + j) * 2654435761u;
          let a = f32(h & 0xffffu) / 65536.0 * 6.28318530718;
          dx = cos(a) * 0.01;
          dy = sin(a) * 0.01;
          d2 = 1e-4;
        }
        let d = sqrt(d2);
        let f = params.repulsion * cutoff2 / max(1.0, d2) / d;
        fx = fx + dx * f;
        fy = fy + dy * f;
      }
    }
  }

  // far field (59.3): per pyramid level, the aligned 6x6 block
  // refining the parent's 3x3 minus this level's own 3x3, gathered as
  // monopoles — the CPU sim's rings, verbatim
  var lvCols = params.gridCols;
  var lvRows = params.gridRows;
  var lvBase = params.pyrBase;
  var cellX = cx;
  var cellY = cy;

  for (var lv = 0u; lv < params.levels; lv = lv + 1u) {
    let qx = cellX >> 1;
    let qy = cellY >> 1;
    let bx0 = max(0, 2 * qx - 2);
    let bx1 = min(i32(lvCols) - 1, 2 * qx + 3);
    let by0 = max(0, 2 * qy - 2);
    let by1 = min(i32(lvRows) - 1, 2 * qy + 3);

    for (var yy = by0; yy <= by1; yy = yy + 1) {
      for (var xx = bx0; xx <= bx1; xx = xx + 1) {
        if (abs(xx - cellX) <= 1 && abs(yy - cellY) <= 1) { continue; }
        let o = lvBase + (u32(yy) * lvCols + u32(xx)) * 3u;
        let cnt = bitcast<f32>(grid[o]);
        if (cnt == 0.0) { continue; }
        let dx = x - bitcast<f32>(grid[o + 1u]) / cnt;
        let dy = y - bitcast<f32>(grid[o + 2u]) / cnt;
        let d2 = max(1.0, dx * dx + dy * dy);
        let d = sqrt(d2);
        let f = cnt * params.repulsion * cutoff2 / d2 / d;
        fx = fx + dx * f;
        fy = fy + dy * f;
      }
    }

    lvBase = lvBase + lvCols * lvRows * 3u;
    cellX = qx;
    cellY = qy;
    lvCols = (lvCols + 1u) >> 1u;
    lvRows = (lvRows + 1u) >> 1u;
  }

  // springs (gather side of the packed incident CSR), degree-normalised
  // (59.1, the CPU sim's rule verbatim): degrees read straight off the
  // CSR starts, so no new data crosses to the device
  for (var at = csr[i]; at < csr[i + 1u]; at = at + 1u) {
    let e = csr[params.n + 1u + at];
    let s = edgesPacked[e * 3u];
    let t = edgesPacked[e * 3u + 1u];
    var other = s;
    if (s == i) { other = t; }
    let dx = simPos[other * 2u] - x;
    let dy = simPos[other * 2u + 1u] - y;
    let r = max(1e-4, sqrt(dx * dx + dy * dy));
    let degI = csr[i + 1u] - csr[i];
    let degO = csr[other + 1u] - csr[other];
    let k = params.stiffness / f32(min(degI, degO));
    let bias = f32(degO) / f32(degI + degO);
    let f = k * bias * (r - bitcast<f32>(edgesPacked[e * 3u + 2u])) / r;
    fx = fx + dx * f;
    fy = fy + dy * f;
  }

  // constant-magnitude gravity toward the node's component anchor
  // (59.2) — the anchors ride the csr buffer's tail (bitcast f32 at
  // params.anchorBase), so the kernel stays at its 8-binding budget
  let ax = bitcast<f32>(csr[params.anchorBase + i * 2u]);
  let ay = bitcast<f32>(csr[params.anchorBase + i * 2u + 1u]);
  let gvx = ax - x;
  let gvy = ay - y;
  let gd = sqrt(gvx * gvx + gvy * gvy);
  if (gd > 1.0) {
    fx = fx + gvx / gd * params.gravity;
    fy = fy + gvy / gd * params.gravity;
  }

  fx = fx * alpha;
  fy = fy * alpha;

  // the displacement cap (59.1): the step never exceeds an
  // alpha-annealed multiple of the repulsion range (the CPU sim's cap,
  // verbatim)
  let cap = params.cutoff * max(alpha, 0.15);
  let stepLen = sqrt(fx * fx + fy * fy);
  if (stepLen > cap) {
    fx = fx / stepLen * cap;
    fy = fy / stepLen * cap;
  }

  forces[i * 2u] = fx;
  forces[i * 2u + 1u] = fy;
}`,

  apply: wgsl`${PRELUDE}
@group(0) @binding(0) var<uniform> params: FParams;
@group(0) @binding(1) var<storage, read_write> simPos: array<f32>;
@group(0) @binding(2) var<storage, read> forces: array<f32>;
@group(0) @binding(3) var<storage, read> slotPin: array<u32>;
@group(0) @binding(4) var<storage, read_write> columnPos: array<f32>;
@group(0) @binding(5) var<storage, read_write> fmeta: array<atomic<u32>>;

@compute @workgroup_size(${WG})
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;

  // invocation 0 advances the annealing tick for the *next* iteration
  if (i == 0u) { atomicAdd(&fmeta[0], 1u); }
  if (i >= params.n) { return; }

  let sp = slotPin[i];
  if ((sp >> 31u) == 1u) { return; }

  let dx = forces[i * 2u];
  let dy = forces[i * 2u + 1u];

  simPos[i * 2u] = simPos[i * 2u] + dx;
  simPos[i * 2u + 1u] = simPos[i * 2u + 1u] + dy;

  // publish to the slot-indexed render column (the lease's source)
  let slot = sp & 0x7fffffffu;
  columnPos[slot * 2u] = simPos[i * 2u];
  columnPos[slot * 2u + 1u] = simPos[i * 2u + 1u];

  // displacement -> monotonic u32 bits (positive f32s order-preserve).
  // A NaN displacement bitcasts above every finite positive float, so a
  // destroyed iteration reads as a huge displacement and never settles
  // — the device-side twin of the CPU sim's non-finite guard (59.1)
  atomicMax(&fmeta[1], bitcast<u32>(abs(dx) + abs(dy)));
}`,

  // the per-tick separation (118.2): the settle's push — every
  // overlapping pair apart along the axis of smaller overlap, a hair
  // past touching, half each or all onto the free node — gathered
  // Jacobi-style per node over a grid rebuilt after apply (the CPU sim
  // sweeps Gauss–Seidel in index order; the executors agree on
  // invariants, not trajectories).  A node's summed push is clamped to
  // the largest single pair's, so a node hemmed in on every side moves
  // by what one pair asks and the rest converges over the ticks that
  // follow.  The boxes ride the csr tail at params.extBase, four
  // bitcast f32 per node: x1, y1, x2, y2 (node-local)
  separate: wgsl`${PRELUDE}
@group(0) @binding(0) var<uniform> params: FParams;
@group(0) @binding(1) var<storage, read> simPos: array<f32>;
@group(0) @binding(2) var<storage, read_write> pushes: array<f32>;
@group(0) @binding(3) var<storage, read> grid: array<u32>;
@group(0) @binding(4) var<storage, read> csr: array<u32>;
@group(0) @binding(5) var<storage, read> slotPin: array<u32>;

fn box(i: u32) -> vec4f {
  let b = params.extBase + i * 4u;
  return vec4f(bitcast<f32>(csr[b]), bitcast<f32>(csr[b + 1u]), bitcast<f32>(csr[b + 2u]), bitcast<f32>(csr[b + 3u]));
}

@compute @workgroup_size(${WG})
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  if (i >= params.n) { return; }
  if ((slotPin[i] >> 31u) == 1u) { pushes[i * 2u] = 0.0; pushes[i * 2u + 1u] = 0.0; return; }

  let x = simPos[i * 2u];
  let y = simPos[i * 2u + 1u];
  let bi = box(i);
  var px = 0.0;
  var py = 0.0;
  var maxAmt = 0.0;
  let itemsBase = params.cells + 1u;
  let cx = i32(clamp((x - params.gridX) / params.cellSize, 0.0, f32(params.gridCols - 1u)));
  let cy = i32(clamp((y - params.gridY) / params.cellSize, 0.0, f32(params.gridRows - 1u)));

  for (var gy = max(0, cy - 1); gy <= min(i32(params.gridRows) - 1, cy + 1); gy = gy + 1) {
    for (var gx = max(0, cx - 1); gx <= min(i32(params.gridCols) - 1, cx + 1); gx = gx + 1) {
      let c = u32(gy) * params.gridCols + u32(gx);
      for (var at = grid[c]; at < grid[c + 1u]; at = at + 1u) {
        let j = grid[itemsBase + at];
        if (j == i) { continue; }
        let xj = simPos[j * 2u];
        let yj = simPos[j * 2u + 1u];
        let bj = box(j);
        let ox = min(x + bi.z, xj + bj.z) - max(x + bi.x, xj + bj.x);
        let oy = min(y + bi.w, yj + bj.w) - max(y + bi.y, yj + bj.y);
        if (ox <= 0.0 || oy <= 0.0) { continue; }
        let alongX = ox <= oy;
        let amount = select(oy, ox, alongX) + 0.5;
        let ca = select(y, x, alongX);
        let cb = select(yj, xj, alongX);
        // the lower index goes to the negative side on a tie (the
        // CPU rule, so a coincident pair still separates)
        let negative = ca < cb || (ca == cb && i < j);
        let sign = select(1.0, -1.0, negative);
        let share = select(0.5, 1.0, (slotPin[j] >> 31u) == 1u);
        let push = sign * amount * share;
        if (alongX) { px = px + push; } else { py = py + push; }
        maxAmt = max(maxAmt, amount * share);
      }
    }
  }

  let len = sqrt(px * px + py * py);
  if (len > maxAmt && len > 0.0) {
    px = px / len * maxAmt;
    py = py / len * maxAmt;
  }
  pushes[i * 2u] = px;
  pushes[i * 2u + 1u] = py;
}`,

  // apply the separation pushes and republish (118.2) — no tick bump,
  // but the push does fold into the batch's displacement max, as the
  // CPU sim folds its sweep: a run must not stop while the sweep
  // still has work
  applySep: wgsl`${PRELUDE}
@group(0) @binding(0) var<uniform> params: FParams;
@group(0) @binding(1) var<storage, read_write> simPos: array<f32>;
@group(0) @binding(2) var<storage, read> pushes: array<f32>;
@group(0) @binding(3) var<storage, read> slotPin: array<u32>;
@group(0) @binding(4) var<storage, read_write> columnPos: array<f32>;
@group(0) @binding(5) var<storage, read_write> fmeta: array<atomic<u32>>;

@compute @workgroup_size(${WG})
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  if (i >= params.n) { return; }
  let sp = slotPin[i];
  if ((sp >> 31u) == 1u) { return; }
  let dx = pushes[i * 2u];
  let dy = pushes[i * 2u + 1u];
  simPos[i * 2u] = simPos[i * 2u] + dx;
  simPos[i * 2u + 1u] = simPos[i * 2u + 1u] + dy;
  let slot = sp & 0x7fffffffu;
  columnPos[slot * 2u] = simPos[i * 2u];
  columnPos[slot * 2u + 1u] = simPos[i * 2u + 1u];
  atomicMax(&fmeta[1], bitcast<u32>(abs(dx) + abs(dy)));
  atomicMax(&fmeta[${META_PUSH}], bitcast<u32>(abs(dx) + abs(dy)));
}`,
};

export interface ForceInputs {
  n: number;
  edges: Uint32Array;
  edgeLength: Float32Array;
  positions: Float32Array;
  pinned: Uint8Array;
  /** per-node gravity anchors, 2n interleaved (59.2) */
  anchors: Float32Array;
  /** per-node boxes the repulsion keeps apart (116.1), or null for
   * the point sim — the CPU sim's `extents` */
  extents?: ForceExtents | null;
  /** sim index → node slot (the publish map) */
  slots: number[];
  params: ForceParams;
  cutoff: number;
  /** the fixed grid frame for the whole run */
  frame: { x: number; y: number; w: number; h: number };
  /** the run has no end of its own (118.3): `converged()` is never
   * true, `idle()` says when encoding would move nothing */
  infinite?: boolean;
}

export class GpuForceRuntime {
  /** iterations executed on-device (CPU bookkeeping mirrors the tick) */
  iterations = 0;
  /** the CPU's mirror of the annealing alpha; decays once per encoded
   * iteration and is the second convergence test */
  alpha = 1;
  /** the last polled batch maximum displacement, in model px; Infinity
   * until the first pollConvergence() readback lands */
  lastMaxDisp = Infinity;
  /** the last polled batch's largest separation push (119.3) */
  lastMaxPush = Infinity;

  private device: GPUDevice;
  private inputs: ForceInputs;
  private pipelines: Record<string, GPUComputePipeline> = {};
  private groups: Record<string, GPUBindGroup> = {};
  private buffersByName = new Map<string, GPUBuffer>();
  private applyGroup: GPUBindGroup | null = null;
  private applySepGroup: GPUBindGroup | null = null;
  /** the per-tick separation is on (118.2): boxes were handed in */
  private readonly hasExt: boolean;
  private columnPos: GPUBuffer | null = null;
  private dispStaging: GPUBuffer;
  private dispInFlight = false;
  /** a batch's displacement max has been copied into the staging buffer
   * since the last map (116.1): the renderer polls at frame start,
   * before the frame's encode, so a poll that mapped unconditionally
   * had the copy skipped on every frame — the staging buffer never
   * received a batch and every readback was its initial zero, which
   * counted as settled: three polls in, any GPU run with the default
   * threshold stopped at nine iterations */
  private dispCopied = false;
  /** the iterations the batch in the staging buffer covers (119.3): a
   * quiet poll settles them all, since the batch's max is over every
   * one of them — the CPU sim's three consecutive quiet ticks, read
   * from one readback instead of three polls two frames apart */
  private copiedBatch = 0;
  private cells: number;
  private gridCols: number;
  private gridRows: number;
  /** per pyramid level: [cols, rows, cellCount] (59.3) */
  private levelDims: [number, number, number][] = [];
  /** one reduce bind group per level above the finest */
  private reduceGroups: GPUBindGroup[] = [];
  private settledRuns = 0;
  private destroyed = false;
  private readonly infinite: boolean;
  /** iterations encoded at alpha's floor, against `FLOOR_SWEEP_BUDGET` */
  private floorTicks = 0;
  /** the CPU copy of the slot | pinned words, for `setPinned` */
  private slotPinWords: Uint32Array;

  /**
   * Uploads the whole simulation to the device: the sim-indexed
   * positions, the incident CSR and packed edge table built here from
   * `inputs.edges`, the slot/pin map, the grid sized from the run's
   * fixed frame, and one bind group per kernel.  Everything but the
   * apply group is bound now, because only apply touches the mirror's
   * position buffer, whose identity can change under a realloc.
   *
   * `inputs` is retained by reference for params and slot lookups, so it
   * must not be mutated during the run; the grid frame in particular is
   * fixed for the run's whole life.
   *
   * @param device — the device that owns every buffer and pipeline
   * @param inputs — the compacted simulation: participating leaves, edge
   * list, initial positions, pins, publish map, params and grid frame
   */
  constructor(device: GPUDevice, inputs: ForceInputs) {
    this.device = device;
    this.inputs = inputs;
    this.infinite = inputs.infinite === true;

    // the cell: the cutoff, grown to the largest box (116.1) so the
    // separation pass (118.2) gathers every overlapping pair exactly
    // over the one grid the force kernel reads
    const ext = inputs.extents ?? null;

    this.hasExt = ext != null;
    const cellSize =
      ext == null ? inputs.cutoff : Math.max(inputs.cutoff, ext.maxW, ext.maxH);

    this.gridCols = Math.max(
      1,
      Math.min(MAX_GRID, Math.ceil(inputs.frame.w / cellSize)),
    );
    this.gridRows = Math.max(
      1,
      Math.min(MAX_GRID, Math.ceil(inputs.frame.h / cellSize)),
    );
    this.cells = this.gridCols * this.gridRows;

    const SU = BUFFER_USAGE.STORAGE | BUFFER_USAGE.COPY_DST;
    const n = inputs.n;
    const m = inputs.edges.length / 2;

    const mk = (
      name: string,
      size: number,
      usage: number,
      data?: ArrayBufferView,
    ): GPUBuffer => {
      const buffer = device.createBuffer({
        label: `cy-gpu:force-${name}`,
        size: Math.max(4, size),
        usage,
      });

      if (data != null) {
        device.queue.writeBuffer(
          buffer,
          0,
          data.buffer as ArrayBuffer,
          data.byteOffset,
          data.byteLength,
        );
      }

      this.buffersByName.set(name, buffer);

      return buffer;
    };

    // the pyramid's level dims (59.3): level 0 at grid resolution,
    // halving until a level is <= 3 cells on its longer side — the CPU
    // sim's rule, and the frame is fixed for the run so this is too
    this.levelDims = [[this.gridCols, this.gridRows, this.cells]];

    {
      let lc = this.gridCols;
      let lr = this.gridRows;

      while (Math.max(lc, lr) > 3) {
        lc = (lc + 1) >> 1;
        lr = (lr + 1) >> 1;
        this.levelDims.push([lc, lr, lc * lr]);
      }
    }

    const pyrBase = this.cells + 1 + n;
    let pyrCells = 0;

    for (const [, , count] of this.levelDims) {
      pyrCells += count;
    }

    mk('simPos', n * 8, SU | BUFFER_USAGE.COPY_SRC, inputs.positions);
    mk('forces', n * 8, SU);
    mk('cellOf', n * 4, SU);
    mk('cellCount', this.cells * 4, SU);
    // the shared grid buffer (59.3's fold): [cellStart][cellItems][pyr]
    mk('grid', (pyrBase + pyrCells * 3) * 4, SU);

    // packed incident CSR: [n+1 starts][edge indices][anchors] — the
    // 59.2 anchor field rides the tail (bitcast f32) so the force
    // kernel needs no ninth binding; params.anchorBase points at it
    const anchorBase = n + 1 + m * 2;
    // the boxes (116.1) ride behind the anchors, four f32 per node
    const extBase = anchorBase + n * 2;
    const csr = new Uint32Array(extBase + (ext == null ? 0 : n * 4));

    for (let e = 0; e < m; e++) {
      csr[inputs.edges[e * 2] + 1]++;
      csr[inputs.edges[e * 2 + 1] + 1]++;
    }

    for (let i = 0; i < n; i++) {
      csr[i + 1] += csr[i];
    }

    const cursor = csr.slice(0, n);

    for (let e = 0; e < m; e++) {
      csr[n + 1 + cursor[inputs.edges[e * 2]]++] = e;
      csr[n + 1 + cursor[inputs.edges[e * 2 + 1]]++] = e;
    }

    csr.set(
      new Uint32Array(inputs.anchors.buffer, inputs.anchors.byteOffset, n * 2),
      anchorBase,
    );

    if (ext != null) {
      const extF32 = new Float32Array(csr.buffer, extBase * 4, n * 4);

      for (let i = 0; i < n; i++) {
        extF32[i * 4] = ext.x1[i];
        extF32[i * 4 + 1] = ext.y1[i];
        extF32[i * 4 + 2] = ext.x2[i];
        extF32[i * 4 + 3] = ext.y2[i];
      }
    }

    mk('csr', csr.byteLength, SU, csr);

    // edges at stride 3: [source, target, bitcast(length)]
    const packed = new Uint32Array(m * 3);
    const lengthBits = new Uint32Array(
      inputs.edgeLength.buffer,
      inputs.edgeLength.byteOffset,
      inputs.edgeLength.length,
    );

    for (let e = 0; e < m; e++) {
      packed[e * 3] = inputs.edges[e * 2];
      packed[e * 3 + 1] = inputs.edges[e * 2 + 1];
      packed[e * 3 + 2] = lengthBits[e];
    }

    mk('edgesPacked', packed.byteLength, SU, packed);

    // slot | pinned << 31
    const slotPin = new Uint32Array(n);

    for (let i = 0; i < n; i++) {
      slotPin[i] =
        (inputs.slots[i] | (inputs.pinned[i] === 1 ? 0x80000000 : 0)) >>> 0;
    }

    mk('slotPin', slotPin.byteLength, SU, slotPin);
    this.slotPinWords = slotPin;

    // meta: [tick, maxDispBits, alpha window]
    mk('meta', (META_ALPHA0 + ALPHA_WINDOW) * 4, SU | BUFFER_USAGE.COPY_SRC);

    this.dispStaging = device.createBuffer({
      label: 'cy-gpu:force-disp-staging',
      size: 12,
      usage: BUFFER_USAGE.COPY_DST | BUFFER_USAGE.MAP_READ,
    });

    const p = inputs.params;
    const uniform = mk(
      'params',
      64,
      BUFFER_USAGE.UNIFORM | BUFFER_USAGE.COPY_DST,
    );
    const u = new ArrayBuffer(64);
    const u32 = new Uint32Array(u);
    const f32 = new Float32Array(u);

    u32[0] = n;
    u32[1] = this.gridCols;
    u32[2] = this.gridRows;
    u32[3] = this.cells;
    f32[4] = inputs.frame.x;
    f32[5] = inputs.frame.y;
    f32[6] = cellSize;
    f32[7] = inputs.cutoff;
    f32[8] = p.repulsion;
    f32[9] = p.stiffness;
    f32[10] = p.gravity;
    u32[11] = anchorBase;
    u32[12] = this.levelDims.length;
    u32[13] = pyrBase;
    u32[14] = extBase;
    u32[15] = ext == null ? 0 : 1;
    device.queue.writeBuffer(uniform, 0, u);

    // per-kernel pipelines (layout 'auto' — each kernel's bindings are
    // exactly its own; the apply group rebinds when the mirror reallocs)
    for (const name of Object.keys(KERNELS)) {
      this.pipelines[name] = device.createComputePipeline({
        label: `cy-gpu:force-${name}`,
        layout: 'auto',
        compute: {
          module: device.createShaderModule({
            label: `cy-gpu:force-${name}`,
            code: KERNELS[name],
          }),
          entryPoint: 'main',
        },
      });
    }

    const bind = (name: string, buffers: string[]): void => {
      this.groups[name] = device.createBindGroup({
        label: `cy-gpu:force-${name}-group`,
        layout: this.pipelines[name].getBindGroupLayout(0),
        entries: buffers.map((buf, i) => ({
          binding: i,
          resource: { buffer: this.buffersByName.get(buf) as GPUBuffer },
        })),
      });
    };

    bind('clearGrid', ['params', 'cellCount']);
    bind('binCount', ['params', 'simPos', 'cellOf', 'cellCount']);
    bind('scanCells', ['params', 'cellCount', 'grid']);
    bind('scatter', ['params', 'cellOf', 'cellCount', 'grid']);
    bind('aggregate', ['params', 'simPos', 'grid']);
    bind('force', [
      'params',
      'simPos',
      'forces',
      'grid',
      'csr',
      'edgesPacked',
      'slotPin',
      'meta',
    ]);
    bind('separate', ['params', 'simPos', 'forces', 'grid', 'csr', 'slotPin']);

    // one uniform + bind group per pyramid level above the finest —
    // the frame (and so every level's dims and offset) is fixed for
    // the run, so these are built once
    {
      let srcBase = pyrBase;

      for (let lv = 1; lv < this.levelDims.length; lv++) {
        const [srcCols, srcRows, srcCount] = this.levelDims[lv - 1];
        const [dstCols, dstRows] = this.levelDims[lv];
        const dstBase = srcBase + srcCount * 3;
        const lu = new Uint32Array([
          srcCols,
          srcRows,
          srcBase,
          dstCols,
          dstRows,
          dstBase,
          0,
          0,
        ]);
        const lbuf = device.createBuffer({
          label: `cy-gpu:force-level-${lv}`,
          size: 32,
          usage: BUFFER_USAGE.UNIFORM | BUFFER_USAGE.COPY_DST,
        });

        device.queue.writeBuffer(lbuf, 0, lu.buffer);
        this.buffersByName.set(`level${lv}`, lbuf);
        this.reduceGroups.push(
          device.createBindGroup({
            label: `cy-gpu:force-reduce-${lv}-group`,
            layout: this.pipelines.reduce.getBindGroupLayout(0),
            entries: [
              { binding: 0, resource: { buffer: lbuf } },
              {
                binding: 1,
                resource: {
                  buffer: this.buffersByName.get('grid') as GPUBuffer,
                },
              },
            ],
          }),
        );
        srcBase = dstBase;
      }
    }
  }

  /**
   * Whether the run is finished — iteration budget spent, alpha annealed
   * out (with boxes, 118.2: and the last polled batch quiet, since at
   * the floor each tick is a separation sweep and a pile opens slowly —
   * the CPU sim's rule), or three consecutive polls under the
   * displacement threshold.
   * encode() is a no-op once this is true, so the caller must stop the
   * run and hand ownership back rather than keep encoding.
   */
  converged(): boolean {
    if (this.infinite) {
      return false;
    }

    return this.iterations >= this.inputs.params.iterations || this.idle();
  }

  /**
   * Whether encoding would move anything (118.3): the settle test
   * without the iteration cap — the CPU sim's `idle()`.  The renderer
   * skips the encode and lets its clock stop on it; `reheat()` clears
   * it.
   *
   * @returns true when the field is at rest
   */
  idle(): boolean {
    return (
      (this.alpha < 0.001 &&
        (!this.hasExt ||
          this.lastMaxPush < SWEEP_QUIET ||
          this.floorTicks >= FLOOR_SWEEP_BUDGET)) ||
      this.settledRuns >= 3
    );
  }

  /**
   * Heat the run back up (118.3): the CPU sim's `reheat`, for the
   * mirror alpha the encode precomputes its window from.
   *
   * @param alpha — the temperature to restore, `REHEAT_ALPHA` by default
   */
  reheat(alpha: number = REHEAT_ALPHA): void {
    this.alpha = Math.max(this.alpha, alpha);
    this.settledRuns = 0;
    this.floorTicks = 0;
    this.lastMaxDisp = Infinity;
    this.lastMaxPush = Infinity;
  }

  /**
   * Write one node's sim position (118.3): a dragged or moved node's
   * store coordinates, handed to the device ahead of the next encode
   * (queue writes order before the submit that follows them).  The
   * apply kernel publishes it to the render column on that tick.
   *
   * @param i — the sim index
   * @param x — model x
   * @param y — model y
   */
  setPosition(i: number, x: number, y: number): void {
    if (this.destroyed) {
      return;
    }

    this.device.queue.writeBuffer(
      this.buffersByName.get('simPos') as GPUBuffer,
      i * 8,
      new Float32Array([x, y]).buffer,
    );
  }

  /**
   * Pin or release one node on the device (118.3): the pin bit rides
   * bit 31 of the slot word, so this rewrites that one word.
   *
   * @param i — the sim index
   * @param pinned — whether it holds still
   */
  setPinned(i: number, pinned: boolean): void {
    if (this.destroyed) {
      return;
    }

    const slot = this.slotPinWords[i] & 0x7fffffff;

    this.slotPinWords[i] = (slot | (pinned ? 0x80000000 : 0)) >>> 0;
    this.device.queue.writeBuffer(
      this.buffersByName.get('slotPin') as GPUBuffer,
      i * 4,
      this.slotPinWords.buffer,
      i * 4,
      4,
    );
  }

  /**
   * The mirror columns this run owns while it is live.  The caller
   * passes them to the mirror's tween-ownership set so CPU span uploads
   * skip them — without that, a stale CPU write would clobber the
   * positions the apply kernel publishes each iteration.  Ownership must
   * be released once readPositions() has settled the values back.
   *
   * A silent run (87.2) never takes ownership: it publishes into
   * `silentTarget()` instead of the mirror's column, so the mirror is
   * simply not involved.
   */
  ownedColumns(): string[] {
    return ['node.position'];
  }

  /**
   * The publish target for a non-presenting run (87.2): a runtime-owned,
   * slot-capacity scratch buffer the apply kernel scatters into instead
   * of the mirror's position column.  Nothing reads it — the settle
   * comes from `readPositions()`, which reads the sim-indexed positions
   * — so the screen keeps drawing the untouched mirror column for the
   * whole run.  Created lazily, destroyed with the rest of the buffers.
   *
   * @returns the scratch publish buffer, sized to the highest slot in
   *   the publish map
   */
  silentTarget(): GPUBuffer {
    let buf = this.buffersByName.get('silentColumn');

    if (buf == null) {
      let maxSlot = 0;

      for (const slot of this.inputs.slots) {
        maxSlot = Math.max(maxSlot, slot);
      }

      buf = this.device.createBuffer({
        label: 'cy-gpu:force-silent-column',
        size: (maxSlot + 1) * 8,
        usage: BUFFER_USAGE.STORAGE,
      });
      this.buffersByName.set('silentColumn', buf);
    }

    return buf;
  }

  /**
   * Encode k iterations against the mirror's position buffer (the
   * apply group rebinds when the mirror reallocates).  Precomputes the
   * alpha window for the device tick and advances the CPU bookkeeping.
   */
  encode(encoder: GPUCommandEncoder, columnPos: GPUBuffer, k: number): void {
    if (this.destroyed || this.converged()) {
      return;
    }

    // the meta carries one alpha per iteration of the window, and the
    // iteration cap is the run's contract (119: a batch is no longer
    // the live stream's three)
    k = Math.min(
      k,
      ALPHA_WINDOW,
      this.infinite
        ? ALPHA_WINDOW
        : this.inputs.params.iterations - this.iterations,
    );

    if (k <= 0) {
      return;
    }

    if (this.columnPos !== columnPos || this.applyGroup == null) {
      this.columnPos = columnPos;
      this.applySepGroup = this.device.createBindGroup({
        label: 'cy-gpu:force-apply-sep-group',
        layout: this.pipelines.applySep.getBindGroupLayout(0),
        entries: ['params', 'simPos', 'forces', 'slotPin']
          .map((buf, i) => ({
            binding: i,
            resource: { buffer: this.buffersByName.get(buf) as GPUBuffer },
          }))
          .concat([
            { binding: 4, resource: { buffer: columnPos } },
            {
              binding: 5,
              resource: { buffer: this.buffersByName.get('meta') as GPUBuffer },
            },
          ]),
      });
      this.applyGroup = this.device.createBindGroup({
        label: 'cy-gpu:force-apply-group',
        layout: this.pipelines.apply.getBindGroupLayout(0),
        entries: ['params', 'simPos', 'forces', 'slotPin']
          .map((buf, i) => ({
            binding: i,
            resource: { buffer: this.buffersByName.get(buf) as GPUBuffer },
          }))
          .concat([
            { binding: 4, resource: { buffer: columnPos } },
            {
              binding: 5,
              resource: { buffer: this.buffersByName.get('meta') as GPUBuffer },
            },
          ]),
      });
    }

    // the alpha window for the iterations this frame will execute,
    // and a rewound displacement max for the batch
    const meta = new Uint32Array(META_ALPHA0 + ALPHA_WINDOW);
    const metaF = new Float32Array(meta.buffer);

    meta[0] = this.iterations;
    meta[1] = 0;
    meta[META_PUSH] = 0;

    let a = this.alpha;

    for (let i = 0; i < ALPHA_WINDOW; i++) {
      metaF[META_ALPHA0 + ((this.iterations + i) % ALPHA_WINDOW)] = a;
      a += (0 - a) * this.inputs.params.decay;
    }

    this.device.queue.writeBuffer(
      this.buffersByName.get('meta') as GPUBuffer,
      0,
      meta.buffer,
    );

    const n = this.inputs.n;
    const pass = encoder.beginComputePass({ label: 'cy-gpu:force' });
    const run = (name: string, groups: number): void => {
      pass.setPipeline(this.pipelines[name]);
      pass.setBindGroup(
        0,
        name === 'apply'
          ? (this.applyGroup as GPUBindGroup)
          : name === 'applySep'
            ? (this.applySepGroup as GPUBindGroup)
            : this.groups[name],
      );
      pass.dispatchWorkgroups(groups);
    };

    for (let i = 0; i < k; i++) {
      run('clearGrid', Math.ceil(this.cells / WG));
      run('binCount', Math.ceil(n / WG));
      run('scanCells', 1);
      run('scatter', Math.ceil(n / WG));
      run('aggregate', Math.ceil(this.cells / WG));

      for (let lv = 1; lv < this.levelDims.length; lv++) {
        pass.setPipeline(this.pipelines.reduce);
        pass.setBindGroup(0, this.reduceGroups[lv - 1]);
        pass.dispatchWorkgroups(Math.ceil(this.levelDims[lv][2] / WG));
      }

      run('force', Math.ceil(n / WG));
      run('apply', Math.ceil(n / WG));

      // the per-tick separation (118.2) reads the stepped positions,
      // so the grid is rebuilt (the pyramid is not needed) before the
      // pushes are gathered and applied — the CPU sim's sweep count,
      // each on a fresh grid
      if (this.hasExt) {
        for (let s = 0; s < SWEEPS_PER_TICK; s++) {
          run('clearGrid', Math.ceil(this.cells / WG));
          run('binCount', Math.ceil(n / WG));
          run('scanCells', 1);
          run('scatter', Math.ceil(n / WG));
          run('separate', Math.ceil(n / WG));
          run('applySep', Math.ceil(n / WG));
        }
      }
    }

    pass.end();

    for (let i = 0; i < k; i++) {
      this.alpha += (0 - this.alpha) * this.inputs.params.decay;
      this.iterations++;

      if (this.alpha < 0.001) {
        this.floorTicks++;
      }
    }

    // skip the copy while the staging buffer is mapped (latest-wins)
    if (!this.dispInFlight) {
      encoder.copyBufferToBuffer(
        this.buffersByName.get('meta') as GPUBuffer,
        0,
        this.dispStaging,
        0,
        12,
      );
      this.dispCopied = true;
      this.copiedBatch = k;
    }
  }

  /** Poll the batch's max displacement (latest-wins; drives the settle).
   * Maps only once a copy has been encoded since the last map, so a
   * poll ahead of the frame's encode reads a batch rather than the
   * staging buffer's initial zero (116.1). */
  pollConvergence(): void {
    if (this.dispInFlight || this.destroyed || !this.dispCopied) {
      return;
    }

    this.dispInFlight = true;
    this.dispCopied = false;
    this.dispStaging.mapAsync(MAP_MODE.READ).then(
      () => {
        if (this.destroyed) {
          return;
        }

        const words = new Uint32Array(this.dispStaging.getMappedRange());
        const buffer = new ArrayBuffer(4);

        new Uint32Array(buffer)[0] = words[1];
        this.lastMaxDisp = new Float32Array(buffer)[0];
        new Uint32Array(buffer)[0] = words[META_PUSH];
        this.lastMaxPush = new Float32Array(buffer)[0];
        this.dispStaging.unmap();
        this.dispInFlight = false;

        // the CPU sim's rule (119.3): a boxed batch settles only under
        // its own quiet sweep
        this.settledRuns =
          this.lastMaxDisp < this.inputs.params.threshold &&
          (!this.hasExt || this.lastMaxPush < SWEEP_QUIET)
            ? this.settledRuns + this.copiedBatch
            : 0;
      },
      () => {
        this.dispInFlight = false;
      },
    );
  }

  /** The one readback (round 9): the final sim positions, for the
   * layout to settle into the CPU columns and reclaim ownership. */
  async readPositions(): Promise<Float32Array> {
    const staging = this.device.createBuffer({
      label: 'cy-gpu:force-settle',
      size: this.inputs.n * 8,
      usage: BUFFER_USAGE.COPY_DST | BUFFER_USAGE.MAP_READ,
    });
    const encoder = this.device.createCommandEncoder();

    encoder.copyBufferToBuffer(
      this.buffersByName.get('simPos') as GPUBuffer,
      0,
      staging,
      0,
      this.inputs.n * 8,
    );
    this.device.queue.submit([encoder.finish()]);

    await staging.mapAsync(MAP_MODE.READ);

    const out = new Float32Array(staging.getMappedRange().slice(0));

    staging.unmap();
    staging.destroy();

    return out;
  }

  /**
   * Destroys every simulation buffer and latches encode(),
   * pollConvergence() and the in-flight readback callbacks off.  Call
   * only after the final readPositions() has resolved — the sim
   * positions are gone afterwards, and the mirror's position column is
   * left holding whatever the last published iteration wrote.
   */
  destroy(): void {
    this.destroyed = true;

    for (const buffer of this.buffersByName.values()) {
      buffer.destroy();
    }

    this.dispStaging.destroy();
  }
}
