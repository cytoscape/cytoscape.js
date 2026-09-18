/*
Batched level-synchronous BFS on the GPU (round 65's Brandes forward
half, extracted as a shared plan in round 72.3).

Sources process in batches of BATCH: the d/sigma arrays are BATCH×n,
so one dispatch advances BATCH independent traversals a level at a
time.  The BFS is **pulled** rather than pushed: a node at unknown
distance scans its reverse neighbors for the current frontier and,
finding any, takes level+1 and sums their sigmas — one writer per
node, so path counting needs no atomics (WebGPU has no f32 atomics to
lean on anyway).  Levels are encoded in chunks, and a per-level check
kernel latches the batch's *frontier-empty* bit the moment a level
assigns nothing — no deeper level can — so every remaining encoded
step no-ops at the cost of one flag read, and the readback between
chunks is a 16-byte completion probe rather than a pipeline sync per
level (65.8; the probe also carries the deepest level).

Two families ride it: betweenness (`algo-gpu-brandes.mts`) follows
each batch's forward pass with its dependency sweep over the same
d/sigma, and unweighted closeness (`algo-gpu-closeness.mts`) folds
each lane's distance row into one score.  Both share the CSR upload,
the working arrays and the per-batch loop here; what differs is what
runs after the frontier empties.
*/

import { wgsl } from '../render/wgsl.mjs';
import type { AlgoGpu } from './algo-gpu.mjs';
import {
  getPipeline,
  groupFor,
  readBack,
  storageFrom,
  storageOf,
  submitPass,
  uniformFrom,
} from './algo-gpu.mjs';
import type { Dispatch } from './algo-gpu.mjs';
import { BUMP_WORD, WG } from './algo-gpu-dense.mjs';

/** Sources per batch (BATCH×n working arrays). */
export const BATCH = 256;
/** Forward levels encoded per completion probe. */
export const CHUNK = 64;
/** The batch-lane sentinel for "no source here" (a short last batch). */
export const NO_SOURCE = 0xffffffff;

/** d = −1, sigma = 0 across the batch. */
const BFS_INIT = wgsl`
struct BP { n : u32, batch : u32 }
@group(0) @binding(0) var<uniform> bp : BP;
@group(0) @binding(1) var<storage, read_write> d : array<i32>;
@group(0) @binding(2) var<storage, read_write> sigma : array<f32>;

@compute @workgroup_size(${WG})
fn main(@builtin(global_invocation_id) gid : vec3u) {
  let idx = gid.x;

  if (idx >= bp.n * bp.batch) { return; }

  d[idx] = -1;
  sigma[idx] = 0.0;
}
`;

/** Seed each batch lane's source: distance 0, one path. */
const BFS_SEED = wgsl`
struct BP { n : u32, batch : u32 }
@group(0) @binding(0) var<uniform> bp : BP;
@group(0) @binding(1) var<storage, read> sources : array<u32>;
@group(0) @binding(2) var<storage, read_write> d : array<i32>;
@group(0) @binding(3) var<storage, read_write> sigma : array<f32>;

@compute @workgroup_size(${WG})
fn main(@builtin(global_invocation_id) gid : vec3u) {
  let b = gid.x;

  if (b >= bp.batch) { return; }

  let src = sources[b];

  if (src == ${NO_SOURCE}u) { return; }

  d[b * bp.n + src] = 0;
  sigma[b * bp.n + src] = 1.0;
}
`;

/** One pulled BFS level: an unvisited node scanning its reverse
 * neighbors for the frontier takes level+1 and sums their sigmas. */
const BFS_FWD = wgsl`
struct BP { n : u32, batch : u32 }
@group(0) @binding(0) var<uniform> bp : BP;
@group(0) @binding(1) var<storage, read> revStarts : array<u32>;
@group(0) @binding(2) var<storage, read> revList : array<u32>;
@group(0) @binding(3) var<storage, read_write> d : array<i32>;
@group(0) @binding(4) var<storage, read_write> sigma : array<f32>;
@group(0) @binding(5) var<storage, read> lvl : array<u32>;
@group(0) @binding(6) var<storage, read_write> flags : array<atomic<u32>>;

@compute @workgroup_size(${WG})
fn main(@builtin(global_invocation_id) gid : vec3u) {
  // flags[2] is the batch's frontier-empty bit: once no lane assigned
  // anything at some level, no deeper level can, and every remaining
  // encoded step no-ops here
  if (atomicLoad(&flags[2]) == 1u) { return; }

  let idx = gid.x;
  let n = bp.n;

  if (idx >= n * bp.batch) { return; }
  if (d[idx] != -1) { return; }

  let b = idx / n;
  let w = idx % n;
  let level = i32(lvl[0]);
  var found = false;
  var sg = 0.0;

  for (var e = revStarts[w]; e < revStarts[w + 1u]; e = e + 1u) {
    let u = b * n + revList[e];

    if (d[u] == level) {
      found = true;
      sg = sg + sigma[u];
    }
  }

  if (found) {
    d[idx] = level + 1;
    sigma[idx] = sg;
    atomicStore(&flags[1], 1u);
  }
}
`;

/** After each forward level: nothing assigned means the batch's BFS
 * frontier is empty — latch the done bit and the deepest level;
 * otherwise clear the per-level change bit. */
const BFS_LEVEL_CHECK = wgsl`
@group(0) @binding(0) var<storage, read> lvl : array<u32>;
@group(0) @binding(1) var<storage, read_write> flags : array<atomic<u32>>;

@compute @workgroup_size(1)
fn main() {
  if (atomicLoad(&flags[2]) == 1u) { return; }

  if (atomicLoad(&flags[1]) == 0u) {
    atomicStore(&flags[2], 1u);
    atomicStore(&flags[3], lvl[0]);
  } else {
    atomicStore(&flags[1], 0u);
  }
}
`;

/** Flatten dense-index neighbor lists into CSR. */
export const toCsr = (
  lists: number[][],
): { starts: Uint32Array; entries: Uint32Array } => {
  const n = lists.length;
  const starts = new Uint32Array(n + 1);

  for (let v = 0; v < n; v++) {
    starts[v + 1] = starts[v] + lists[v].length;
  }

  const entries = new Uint32Array(starts[n]);

  for (let v = 0; v < n; v++) {
    entries.set(lists[v], starts[v]);
  }

  return { starts, entries };
};

/** The uploaded graph, the batch working arrays and the forward
 * dispatches one run shares across its batches. */
export interface BfsPlan {
  n: number;
  /** `struct BP { n, batch }` */
  bp: GPUBuffer;
  fwdStarts: GPUBuffer;
  fwdList: GPUBuffer;
  /** the reverse CSR — the forward one again when undirected */
  revStarts: GPUBuffer;
  revList: GPUBuffer;
  /** BATCH×n levels (−1 unreached) */
  d: GPUBuffer;
  /** BATCH×n shortest-path counts */
  sigma: GPUBuffer;
  /** the batch's source per lane, NO_SOURCE past the end */
  sources: GPUBuffer;
  /** the current level, one word */
  lvl: GPUBuffer;
  /** [unused, changed-this-level, frontier-empty, levels-at-done] */
  flags: GPUBuffer;
  /** workgroups over BATCH×n */
  gridBN: [number];
  /** workgroups over n */
  gridN: [number];
  destroy(): void;
  /** @internal the per-batch dispatches */
  _init: Dispatch;
  _seed: Dispatch;
  _fwd: Dispatch;
  _check: Dispatch;
  _bump: Dispatch;
  _directed: boolean;
}

/**
 * Upload the neighbor lists as CSR (plus the reverse CSR when
 * directed) and allocate the batch working arrays.
 *
 * @param ctx — the shared device state
 * @param neighbors — deduped dense-index neighbor lists (n > 0)
 * @param directed — whether a reverse CSR is needed for the pull
 * @returns the plan, to run batches on and then destroy
 */
export const bfsPlan = (
  ctx: AlgoGpu,
  neighbors: number[][],
  directed: boolean,
): BfsPlan => {
  const n = neighbors.length;
  const fwd = toCsr(neighbors);
  let rev = fwd;

  if (directed) {
    const revLists: number[][] = Array.from({ length: n }, () => []);

    for (let u = 0; u < n; u++) {
      for (const w of neighbors[u]) {
        revLists[w].push(u);
      }
    }

    rev = toCsr(revLists);
  }

  const bp = uniformFrom(ctx, new Uint32Array([n, BATCH]));
  const fwdStarts = storageFrom(ctx, fwd.starts);
  const fwdList = storageFrom(ctx, fwd.entries);
  const revStarts = directed ? storageFrom(ctx, rev.starts) : fwdStarts;
  const revList = directed ? storageFrom(ctx, rev.entries) : fwdList;
  const d = storageOf(ctx, BATCH * n * 4);
  const sigma = storageOf(ctx, BATCH * n * 4);
  const sources = storageOf(ctx, BATCH * 4);
  const lvl = storageOf(ctx, 4);
  const flags = storageFrom(ctx, new Uint32Array([0, 0, 0, 0]));

  const init = getPipeline(ctx, 'bfs-init', BFS_INIT);
  const seed = getPipeline(ctx, 'bfs-seed', BFS_SEED);
  const fwdStep = getPipeline(ctx, 'bfs-fwd', BFS_FWD);
  const check = getPipeline(ctx, 'bfs-level-check', BFS_LEVEL_CHECK);
  const bump = getPipeline(ctx, 'bump-word', BUMP_WORD);

  const gridBN: [number] = [Math.ceil((BATCH * n) / WG)];
  const gridB: [number] = [Math.ceil(BATCH / WG)];
  const one: [number] = [1];

  return {
    n,
    bp,
    fwdStarts,
    fwdList,
    revStarts,
    revList,
    d,
    sigma,
    sources,
    lvl,
    flags,
    gridBN,
    gridN: [Math.ceil(n / WG)],
    _directed: directed,
    _init: {
      pipeline: init,
      group: groupFor(ctx, init, [bp, d, sigma]),
      groups: gridBN,
    },
    _seed: {
      pipeline: seed,
      group: groupFor(ctx, seed, [bp, sources, d, sigma]),
      groups: gridB,
    },
    _fwd: {
      pipeline: fwdStep,
      group: groupFor(ctx, fwdStep, [
        bp,
        revStarts,
        revList,
        d,
        sigma,
        lvl,
        flags,
      ]),
      groups: gridBN,
    },
    _check: {
      pipeline: check,
      group: groupFor(ctx, check, [lvl, flags]),
      groups: one,
    },
    _bump: { pipeline: bump, group: groupFor(ctx, bump, [lvl]), groups: one },
    destroy() {
      const toDestroy = [bp, fwdStarts, fwdList, d, sigma, sources, lvl, flags];

      if (directed) {
        toDestroy.push(revStarts, revList);
      }

      for (const buffer of toDestroy) {
        buffer.destroy();
      }
    },
  };
};

/**
 * Run one batch's forward BFS: seed the lanes from `start`, encode
 * CHUNK levels at a time, and probe between chunks until the
 * frontier-empty bit latches.  On return `d`/`sigma` hold the batch's
 * levels and path counts, `sources` its lanes, and `lvl` the deepest
 * level (which a dependency sweep counts down from).
 *
 * @param ctx — the shared device state
 * @param plan — from `bfsPlan`
 * @param start — the first source of this batch
 * @returns the batch's lanes and the deepest level reached
 */
export const bfsForwardBatch = async (
  ctx: AlgoGpu,
  plan: BfsPlan,
  start: number,
): Promise<{ sources: Uint32Array; maxLevel: number }> => {
  const { n } = plan;
  const queue = ctx.device.queue;
  const sources = new Uint32Array(BATCH).fill(NO_SOURCE);

  for (let b = 0; b < BATCH && start + b < n; b++) {
    sources[b] = start + b;
  }

  queue.writeBuffer(plan.sources, 0, sources);
  queue.writeBuffer(plan.lvl, 0, new Uint32Array([0]));
  queue.writeBuffer(plan.flags, 0, new Uint32Array([0, 0, 0, 0]));
  submitPass(ctx, [plan._init, plan._seed]);

  // forward: encode CHUNK levels at a time; the frontier-empty bit
  // no-ops any excess, so the probe between chunks is the batch's
  // only sync (a path has at most n-1 edges — the loop's hard cap)
  let maxLevel = 0;

  for (let encoded = 0; encoded < n + CHUNK; encoded += CHUNK) {
    const chunk: Dispatch[] = [];

    for (let l = 0; l < CHUNK; l++) {
      chunk.push(plan._fwd, plan._check, plan._bump);
    }

    submitPass(ctx, chunk);

    const words = new Uint32Array(await readBack(ctx, plan.flags, 16));

    if (words[2] === 1) {
      maxLevel = words[3];
      break;
    }
  }

  return { sources, maxLevel };
};
