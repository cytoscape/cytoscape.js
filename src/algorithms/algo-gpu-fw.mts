/*
Floyd–Warshall on the GPU (round 65).

The CPU reference (`floyd-warshall.mts`) is the spec: both executors
share the init (edges → dist/next/edgeNext) and the result accessors —
the GPU replaces the O(n³) relaxation.  Step k is one n² dispatch: the
classic observation making it race-free is that row k and column k are
fixed points of step k (dist[k][k] = 0 absent a negative cycle, and a
write happens only on a strict improvement), so every thread reads
stable values.  The step counter lives in a storage word bumped by a
one-invocation kernel between relaxations, letting all n steps encode
into a single pass with no per-step uniforms.

Unreachable pairs carry a large finite sentinel rather than Infinity —
WGSL implementations may assume floats are finite, so the kernel never
manufactures or compares an Inf; the readback translates the sentinel
band back to Infinity before the shared accessors see it.  `next` is
relaxed alongside dist; `edgeNext` never changes after init (the CPU
relaxation does not touch it) and stays on the CPU.
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
 * enough below f32 max that sentinel + finite cannot overflow. */
const FINF = 3.0e38;
/** Readback values at or above this translate back to Infinity. */
const FINF_BAND = 1.5e38;

/** One relaxation step: dist[i][j] = min(dist[i][j], dist[i][k] +
 * dist[k][j]), with next following the improvement. */
const RELAX = wgsl`
struct P { n : u32, r : f32 }
@group(0) @binding(0) var<uniform> p : P;
@group(0) @binding(1) var<storage, read_write> dist : array<f32>;
@group(0) @binding(2) var<storage, read_write> nxt : array<i32>;
@group(0) @binding(3) var<storage, read> kbuf : array<u32>;

@compute @workgroup_size(${TILE}, ${TILE})
fn main(@builtin(global_invocation_id) gid : vec3u) {
  let n = p.n;
  let i = gid.y;
  let j = gid.x;

  if (i >= n || j >= n) { return; }

  let k = kbuf[0];
  let ik = i * n + k;
  let dik = dist[ik];

  if (dik >= ${FINF_BAND}) { return; }

  let alt = dik + dist[k * n + j];
  let ij = i * n + j;

  if (alt < dist[ij]) {
    dist[ij] = alt;
    nxt[ij] = nxt[ik];
  }
}
`;

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

  // Infinity → the finite sentinel the kernel understands
  const dist32 = new Float32Array(n * n);

  for (let i = 0; i < dist.length; i++) {
    dist32[i] = dist[i] === Infinity ? FINF : dist[i];
  }

  const distBuf = storageFrom(ctx, dist32);
  const nextBuf = storageFrom(ctx, Int32Array.from(next));
  const kbuf = storageFrom(ctx, new Uint32Array([0]));
  const pN = paramsNR(ctx, n, 0);

  const relax = getPipeline(ctx, 'fw-relax', RELAX);
  const bump = getPipeline(ctx, 'bump-word', BUMP_WORD);

  const grid2d: [number, number] = [Math.ceil(n / TILE), Math.ceil(n / TILE)];
  const relaxGroup = groupFor(ctx, relax, [pN, distBuf, nextBuf, kbuf]);
  const bumpGroup = groupFor(ctx, bump, [kbuf]);
  const all: Dispatch[] = [];

  for (let k = 0; k < n; k++) {
    all.push({ pipeline: relax, group: relaxGroup, groups: grid2d });
    all.push({ pipeline: bump, group: bumpGroup, groups: [1] });
  }

  submitPass(ctx, all);

  const outDist = new Float32Array(await readBack(ctx, distBuf, bytes));
  const outNext = new Int32Array(await readBack(ctx, nextBuf, bytes));

  for (const buffer of [distBuf, nextBuf, kbuf, pN]) {
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
