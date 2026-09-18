/*
Unweighted Brandes betweenness on the GPU (round 65).

The CPU reference (`betweenness-centrality.mts`) is the spec: both
executors traverse the same deduped neighbor lists, uploaded once as
CSR.  The forward half — the batched, pulled, level-synchronous BFS
with its frontier-empty probes — lives in `algo-gpu-bfs.mts` since
round 72.3, shared with unweighted closeness; this module keeps what
is Brandes' alone: the dependency sweep pulled in reverse level order
over the batch's d/sigma, and the fold of the batch's deltas into the
C accumulator, serial per node.  Weighted runs never reach this
module: Brandes over weights needs a priority queue, and the wrapper
contracts them to the CPU.

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
} from './algo-gpu.mjs';
import type { Dispatch } from './algo-gpu.mjs';
import { WG } from './algo-gpu-dense.mjs';
import { BATCH, NO_SOURCE, bfsForwardBatch, bfsPlan } from './algo-gpu-bfs.mjs';
import {
  bcResultFrom,
  buildBrandesNeighbors,
} from './betweenness-centrality.mjs';
import type {
  BetweennessCentralityOptions,
  BetweennessCentralityResult,
} from './betweenness-centrality.mjs';

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

    if (src != ${NO_SOURCE}u && src != w) {
      acc = acc + delta[b * n + w];
    }
  }

  c[w] = acc;
}
`;

/** delta = 0 across the batch (the shared BFS init clears d and
 * sigma; the dependency accumulator is Brandes' own). */
const BC_ZERO = wgsl`
struct BP { n : u32, batch : u32 }
@group(0) @binding(0) var<uniform> bp : BP;
@group(0) @binding(1) var<storage, read_write> delta : array<f32>;

@compute @workgroup_size(${WG})
fn main(@builtin(global_invocation_id) gid : vec3u) {
  let idx = gid.x;

  if (idx >= bp.n * bp.batch) { return; }

  delta[idx] = 0.0;
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
  const plan = bfsPlan(ctx, neighbors, directed);
  const delta = storageOf(ctx, BATCH * n * 4);
  const cBuf = storageFrom(ctx, new Float32Array(n));

  const backStep = getPipeline(ctx, 'bc-back', BC_BACK);
  const accum = getPipeline(ctx, 'bc-accum', BC_ACCUM);
  const dec = getPipeline(ctx, 'dec-word', DEC_WORD);
  const zero = getPipeline(ctx, 'bc-zero', BC_ZERO);

  const one: [number] = [1];
  const backGroup = groupFor(ctx, backStep, [
    plan.bp,
    plan.fwdStarts,
    plan.fwdList,
    plan.d,
    plan.sigma,
    delta,
    plan.lvl,
  ]);
  const accumGroup = groupFor(ctx, accum, [plan.bp, plan.sources, delta, cBuf]);
  const zeroGroup = groupFor(ctx, zero, [plan.bp, delta]);
  const decGroup = groupFor(ctx, dec, [plan.lvl]);
  const queue = ctx.device.queue;

  for (let start = 0; start < n; start += BATCH) {
    submitPass(ctx, [
      { pipeline: zero, group: zeroGroup, groups: plan.gridBN },
    ]);

    const { maxLevel } = await bfsForwardBatch(ctx, plan, start);

    // backward: maxLevel..0, one dispatch per level, one submit
    queue.writeBuffer(plan.lvl, 0, new Uint32Array([maxLevel]));

    const back: Dispatch[] = [];

    for (let l = maxLevel; l >= 0; l--) {
      back.push({ pipeline: backStep, group: backGroup, groups: plan.gridBN });
      back.push({ pipeline: dec, group: decGroup, groups: one });
    }

    back.push({ pipeline: accum, group: accumGroup, groups: plan.gridN });
    submitPass(ctx, back);
  }

  const cOut = new Float32Array(await readBack(ctx, cBuf, n * 4));

  plan.destroy();
  delta.destroy();
  cBuf.destroy();

  let max = 0;

  for (let i = 0; i < n; i++) {
    if (cOut[i] > max) {
      max = cOut[i];
    }
  }

  return bcResultFrom(view, cOut, max);
};
