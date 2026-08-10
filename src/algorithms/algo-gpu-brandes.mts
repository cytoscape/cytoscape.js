/*
Unweighted Brandes betweenness on the GPU (round 65).

The CPU reference (`betweenness-centrality.mts`) is the spec: both
executors traverse the same deduped neighbor lists, uploaded once as
CSR.  The GPU runs level-synchronous BFS **pulled** rather than pushed:
a node at unknown distance scans its reverse neighbors for the current
frontier and, finding any, takes level+1 and sums their sigmas — one
writer per node, so path counting needs no atomics (WebGPU has no f32
atomics to lean on anyway).  The dependency sweep pulls the same way in
reverse level order, and a final kernel folds the batch's deltas into
the C accumulator serially per node.

Sources process in batches of B: the d/sigma/delta arrays are B×n, so
one dispatch advances B independent BFS traversals a level at a time.
Levels are encoded in chunks, and a per-level check kernel latches the
batch's *frontier-empty* bit the moment a level assigns nothing — no
deeper level can — so every remaining encoded step no-ops at the cost
of one flag read, and the readback between chunks is a 16-byte
completion probe rather than a pipeline sync per level (65.8; the
probe also carries the deepest level, which sizes the dependency
sweep exactly).  Weighted runs never reach this module: Brandes over
weights needs a priority queue, and the wrapper contracts them to the
CPU.

sigma counts ride f32 (the CPU uses f64): graphs whose shortest-path
counts overflow f32 lose precision here — the invariant-parity specs
pin well-conditioned fixtures, and `executor: 'cpu'` remains the exact
path.
*/

import type { Collection } from '../collection.mjs';
import { wgsl } from '../render/wgsl.mjs';
import { subgraph } from './algo-shared.mjs';
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
import {
  bcResultFrom,
  buildBrandesNeighbors,
} from './betweenness-centrality.mjs';
import type {
  BetweennessCentralityOptions,
  BetweennessCentralityResult,
} from './betweenness-centrality.mjs';

/** Sources per batch (B×n working arrays). */
const BATCH = 256;
/** Forward levels encoded per completion probe (round 65.8: the
 * frontier-empty bit lets a whole chunk no-op once every lane's BFS
 * has finished, so a probe is a 16-byte readback per chunk, not a
 * pipeline sync every level). */
const CHUNK = 64;

/** d = −1, sigma = 0, delta = 0 across the batch. */
const BC_INIT = wgsl`
struct BP { n : u32, batch : u32 }
@group(0) @binding(0) var<uniform> bp : BP;
@group(0) @binding(1) var<storage, read_write> d : array<i32>;
@group(0) @binding(2) var<storage, read_write> sigma : array<f32>;
@group(0) @binding(3) var<storage, read_write> delta : array<f32>;

@compute @workgroup_size(${WG})
fn main(@builtin(global_invocation_id) gid : vec3u) {
  let idx = gid.x;

  if (idx >= bp.n * bp.batch) { return; }

  d[idx] = -1;
  sigma[idx] = 0.0;
  delta[idx] = 0.0;
}
`;

/** Seed each batch lane's source: distance 0, one path. */
const BC_SEED = wgsl`
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

  if (src == 0xffffffffu) { return; }

  d[b * bp.n + src] = 0;
  sigma[b * bp.n + src] = 1.0;
}
`;

/** One pulled BFS level: an unvisited node scanning its reverse
 * neighbors for the frontier takes level+1 and sums their sigmas. */
const BC_FWD = wgsl`
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
 * frontier is empty — latch the done bit and the deepest level for
 * the dependency sweep; otherwise clear the per-level change bit. */
const BC_LEVEL_CHECK = wgsl`
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

/** One pulled dependency level: a node at the current level gathers
 * sigma[u]/sigma[w]·(1+delta[w]) over its forward successors. */
const BC_BACK = wgsl`
struct BP { n : u32, batch : u32 }
@group(0) @binding(0) var<uniform> bp : BP;
@group(0) @binding(1) var<storage, read> fwdStarts : array<u32>;
@group(0) @binding(2) var<storage, read> fwdList : array<u32>;
@group(0) @binding(3) var<storage, read> d : array<i32>;
@group(0) @binding(4) var<storage, read> sigma : array<f32>;
@group(0) @binding(5) var<storage, read_write> delta : array<f32>;
@group(0) @binding(6) var<storage, read> lvl : array<u32>;

@compute @workgroup_size(${WG})
fn main(@builtin(global_invocation_id) gid : vec3u) {
  let idx = gid.x;
  let n = bp.n;

  if (idx >= n * bp.batch) { return; }

  let level = i32(lvl[0]);

  if (d[idx] != level) { return; }

  let b = idx / n;
  let u = idx % n;
  var acc = 0.0;

  for (var e = fwdStarts[u]; e < fwdStarts[u + 1u]; e = e + 1u) {
    let w = b * n + fwdList[e];

    if (d[w] == level + 1 && sigma[w] > 0.0) {
      acc = acc + (sigma[idx] / sigma[w]) * (1.0 + delta[w]);
    }
  }

  delta[idx] = acc;
}
`;

/** Fold the batch's deltas into C — serial over the batch per node,
 * so no atomics; each lane's own source contributes nothing. */
const BC_ACCUM = wgsl`
struct BP { n : u32, batch : u32 }
@group(0) @binding(0) var<uniform> bp : BP;
@group(0) @binding(1) var<storage, read> sources : array<u32>;
@group(0) @binding(2) var<storage, read> delta : array<f32>;
@group(0) @binding(3) var<storage, read_write> c : array<f32>;

@compute @workgroup_size(${WG})
fn main(@builtin(global_invocation_id) gid : vec3u) {
  let w = gid.x;
  let n = bp.n;

  if (w >= n) { return; }

  var acc = c[w];

  for (var b = 0u; b < bp.batch; b = b + 1u) {
    let src = sources[b];

    if (src != 0xffffffffu && src != w) {
      acc = acc + delta[b * n + w];
    }
  }

  c[w] = acc;
}
`;

/** Decrement the level counter (one invocation). */
const DEC_WORD = wgsl`
@group(0) @binding(0) var<storage, read_write> word : array<u32>;

@compute @workgroup_size(1)
fn main() {
  word[0] = word[0] - 1u;
}
`;

/** Flatten dense-index neighbor lists into CSR. */
const toCsr = (
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

/**
 * The GPU unweighted-Brandes executor.  Traverses the shared neighbor
 * lists; scores land in the shared accessors.  The wrapper never
 * routes a weighted run here.
 *
 * @param ctx — the shared device state
 * @param coll — the calling collection
 * @param options — as the CPU reference (weight must be absent)
 * @returns the betweenness accessors over the read-back scores
 */
export const betweennessCentralityGpu = async (
  ctx: AlgoGpu,
  coll: Collection,
  options: BetweennessCentralityOptions = {},
): Promise<BetweennessCentralityResult> => {
  const view = subgraph(coll);
  const directed = options.directed === true;
  const n = view.nodeSlots.length;

  if (n === 0) {
    return bcResultFrom(view, [], 0);
  }

  const { neighbors } = buildBrandesNeighbors(view, directed);
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
  const delta = storageOf(ctx, BATCH * n * 4);
  const sources = storageOf(ctx, BATCH * 4);
  const cBuf = storageFrom(ctx, new Float32Array(n));
  const lvl = storageOf(ctx, 4);
  // [changed-this-level (1), frontier-empty (2), levels-at-done (3)]
  const flags = storageFrom(ctx, new Uint32Array([0, 0, 0, 0]));

  const init = getPipeline(ctx, 'bc-init', BC_INIT);
  const seed = getPipeline(ctx, 'bc-seed', BC_SEED);
  const fwdStep = getPipeline(ctx, 'bc-fwd', BC_FWD);
  const levelCheck = getPipeline(ctx, 'bc-level-check', BC_LEVEL_CHECK);
  const backStep = getPipeline(ctx, 'bc-back', BC_BACK);
  const accum = getPipeline(ctx, 'bc-accum', BC_ACCUM);
  const bump = getPipeline(ctx, 'bump-word', BUMP_WORD);
  const dec = getPipeline(ctx, 'dec-word', DEC_WORD);

  const gridBN: [number] = [Math.ceil((BATCH * n) / WG)];
  const gridB: [number] = [Math.ceil(BATCH / WG)];
  const gridN: [number] = [Math.ceil(n / WG)];
  const one: [number] = [1];

  const initGroup = groupFor(ctx, init, [bp, d, sigma, delta]);
  const seedGroup = groupFor(ctx, seed, [bp, sources, d, sigma]);
  const fwdGroup = groupFor(ctx, fwdStep, [
    bp,
    revStarts,
    revList,
    d,
    sigma,
    lvl,
    flags,
  ]);
  const backGroup = groupFor(ctx, backStep, [
    bp,
    fwdStarts,
    fwdList,
    d,
    sigma,
    delta,
    lvl,
  ]);
  const accumGroup = groupFor(ctx, accum, [bp, sources, delta, cBuf]);
  const checkGroup = groupFor(ctx, levelCheck, [lvl, flags]);
  const bumpGroup = groupFor(ctx, bump, [lvl]);
  const decGroup = groupFor(ctx, dec, [lvl]);
  const queue = ctx.device.queue;

  for (let start = 0; start < n; start += BATCH) {
    const batchSources = new Uint32Array(BATCH).fill(0xffffffff);

    for (let b = 0; b < BATCH && start + b < n; b++) {
      batchSources[b] = start + b;
    }

    queue.writeBuffer(sources, 0, batchSources);
    queue.writeBuffer(lvl, 0, new Uint32Array([0]));
    queue.writeBuffer(flags, 0, new Uint32Array([0, 0, 0, 0]));
    submitPass(ctx, [
      { pipeline: init, group: initGroup, groups: gridBN },
      { pipeline: seed, group: seedGroup, groups: gridB },
    ]);

    // forward: encode CHUNK levels at a time; the frontier-empty bit
    // no-ops any excess, so the probe between chunks is the batch's
    // only sync (a path has at most n-1 edges — the loop's hard cap)
    let maxLevel = 0;

    for (let encoded = 0; encoded < n + CHUNK; encoded += CHUNK) {
      const chunk: Dispatch[] = [];

      for (let l = 0; l < CHUNK; l++) {
        chunk.push({ pipeline: fwdStep, group: fwdGroup, groups: gridBN });
        chunk.push({ pipeline: levelCheck, group: checkGroup, groups: one });
        chunk.push({ pipeline: bump, group: bumpGroup, groups: one });
      }

      submitPass(ctx, chunk);

      const words = new Uint32Array(await readBack(ctx, flags, 16));

      if (words[2] === 1) {
        maxLevel = words[3];
        break;
      }
    }

    // backward: maxLevel..0, one dispatch per level, one submit
    queue.writeBuffer(lvl, 0, new Uint32Array([maxLevel]));

    const back: Dispatch[] = [];

    for (let l = maxLevel; l >= 0; l--) {
      back.push({ pipeline: backStep, group: backGroup, groups: gridBN });
      back.push({ pipeline: dec, group: decGroup, groups: one });
    }

    back.push({ pipeline: accum, group: accumGroup, groups: gridN });
    submitPass(ctx, back);
  }

  const cOut = new Float32Array(await readBack(ctx, cBuf, n * 4));

  const toDestroy = [
    bp,
    fwdStarts,
    fwdList,
    d,
    sigma,
    delta,
    sources,
    cBuf,
    lvl,
    flags,
  ];

  if (directed) {
    toDestroy.push(revStarts, revList);
  }

  for (const buffer of toDestroy) {
    buffer.destroy();
  }

  let max = 0;

  for (let i = 0; i < n; i++) {
    if (cOut[i] > max) {
      max = cOut[i];
    }
  }

  return bcResultFrom(view, cOut, max);
};
