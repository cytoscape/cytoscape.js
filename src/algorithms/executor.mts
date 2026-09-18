/*
The async algorithm executor contract (round 65).

The expensive whole-graph algorithms — the dense-matrix and clustering
tier — are Promise-returning in v4, with an `executor` option choosing
where the maths runs:

  'cpu'  — the reference implementation, bit-reproducible, always
           available.  What headless Node always runs.
  'gpu'  — the WGSL kernels; rejects when WebGPU (or the algorithm's
           GPU path) is unavailable rather than silently degrading.
  'workers' — (round 74) the per-source-parallel families behind a
           pool of plain workers: the same f64 arithmetic as 'cpu',
           partitioned by source range; rejects when the family has no
           workers path or the environment cannot construct a worker.
  'auto' — the default: GPU when an adapter exists and the input is
           large enough to beat the dispatch/readback overhead; else
           workers where the family has that lane, a pool can spawn
           and the input clears its crossover; otherwise CPU.

The determinism ladder callers read: **cpu > workers > gpu**.  'cpu' is
the bit-reproducible reference.  'workers' is bit-stable across runs,
machines and pool sizes (the partition is a function of n alone), and
bit-identical to 'cpu' for the families whose output element is
computed whole from one source (closeness scores, heat and RWR
columns); betweenness sums across sources and its range-wise merge
rounds differently from the sequential reference — f64-tight parity,
not bits.  'gpu' is f32 and agrees on invariants.

Determinism follows the force-layout precedent (round 18.4): the CPU
executor is the reproducible spec; GPU results may differ within pinned
invariants (WGSL is f32, the reference is f64), and a caller that needs
bit-stable output says `executor: 'cpu'`.

Under 'auto', only *acquisition* failure and `GpuUnfitError` (an input
too large for the device's buffer limits) fall back from the GPU — to
the workers lane where one exists, else the CPU — and only pool
acquisition failure (no worker platform, a CSP refusal) falls back
from workers to the CPU; any other error thrown by a kernel or a
worker run propagates, so a defect is loud rather than quietly
rerouted (the guard-nothing-triggers rule).
*/

import {
  acquireAlgoGpu,
  algoGpuSupported,
  GpuUnfitError,
} from './algo-gpu.mjs';
import type { AlgoGpu } from './algo-gpu.mjs';
import { acquireAlgoWorkers, algoWorkersSupported } from './algo-workers.mjs';
import type { AlgoWorkers } from './algo-workers.mjs';

/** Where an async algorithm runs: the reference CPU path, the WGSL
 * kernels, the worker pool (round 74), or (the default) whichever fits
 * the input and environment. */
export type AlgoExecutor = 'cpu' | 'gpu' | 'workers' | 'auto';

/**
 * The node count under which `'auto'` prefers the CPU to the worker
 * pool, for every family with a workers lane: below it the per-worker
 * snapshot clone and the message round trips outweigh the division of
 * the walk.  A starting figure from the 74.1 probe (the pool answered
 * 12× at n = 1024 and 3.5× cold), to be stamped per family by the
 * `algorithms-workers` sweep (74.5).
 */
export const WORKERS_MIN_N = 256;

/** A family's workers lane, as `runAlgo` routes it. */
export interface WorkersLane<T> {
  /** the `'auto'` crossover: below it the CPU runs instead */
  minN: number;
  /** the lane: build the snapshot, run the ranges, merge */
  run: (pool: AlgoWorkers) => Promise<T>;
}

/**
 * The node count under which `'auto'` stays on the CPU: below this the
 * upload + dispatch + readback overhead dominates whatever the kernel
 * saves.  A starting figure to be re-measured per family by the
 * GPU-vs-CPU benchmark sweep.
 */
export const GPU_MIN_N = 256;

/**
 * The density gate for the families whose CPU walk is O(Σ deg²) and
 * whose kernel is a dense O(n³) product (triangles, neighborhood
 * similarity, the triad census): `'auto'` takes the GPU once the
 * graph carries at least this many *edges per node* — E ≥ 32·n, a
 * mean degree of 64 undirected.  Round 72.6 measured the crossover at
 * n = 512 / 1024 / 2048 on ring-plus-chord fixtures across six
 * densities (amd gcn-4) and found it a constant mean degree rather
 * than the n²/k form the families first shipped with: the GPU is
 * ahead at E = n²/16 / n²/32 / n²/64 respectively — E/n = 32 at every
 * size — and behind one step sparser (0.8×, 0.8×, 0.5×).  The full
 * table is in the round-72 record.
 */
export const GPU_MIN_EDGES_PER_NODE = 32;

/**
 * Validate the `executor` option — called synchronously by every async
 * algorithm entry, so a bad value throws at the call site rather than
 * surfacing later as a rejection.
 *
 * @param executor — the option as passed, or undefined for the default
 * @returns the resolved executor ('auto' when omitted)
 * @throws if the value is not 'cpu', 'gpu', 'workers' or 'auto'
 */
export const resolveExecutor = (
  executor: AlgoExecutor | undefined,
): AlgoExecutor => {
  if (executor == null) {
    return 'auto';
  }

  if (
    executor === 'cpu' ||
    executor === 'gpu' ||
    executor === 'workers' ||
    executor === 'auto'
  ) {
    return executor;
  }

  throw new TypeError(
    "`executor` must be 'cpu', 'gpu', 'workers' or 'auto' — got " +
      String(executor),
  );
};

/**
 * Route one algorithm run to its executor.  `cpu` is the sync reference
 * implementation; `gpu` is the kernel path, or null when the algorithm
 * (or this particular option combination) has no GPU path, in which
 * case `gpuNoPathReason` says why an explicit `executor: 'gpu'` must
 * reject.
 *
 * @param executor — the resolved executor (see `resolveExecutor`)
 * @param n — the input size the `'auto'` threshold is judged on
 * @param minGpuN — the family's crossover size ('auto' stays on the
 *   CPU below it; an explicit 'gpu' ignores it)
 * @param cpu — the sync reference implementation
 * @param gpu — the kernel path, or null when none exists
 * @param gpuNoPathReason — the rejection message for `executor: 'gpu'`
 *   when `gpu` is null
 * @param workers — the family's workers lane (round 74), or null when
 *   the family has none; under `'auto'` it sits between the GPU and
 *   the CPU, taken when no GPU lane fits and n clears `minN`
 * @returns the algorithm result, from whichever executor ran
 * @throws if `executor: 'gpu'` is asked of an environment without
 *   WebGPU, or of an option combination with no GPU path; if
 *   `executor: 'workers'` is asked of a family with no workers lane,
 *   or of an environment where no worker can be constructed
 */
export const runAlgo = async <T,>(
  executor: AlgoExecutor,
  n: number,
  minGpuN: number,
  cpu: () => T,
  gpu: ((ctx: AlgoGpu) => Promise<T>) | null,
  gpuNoPathReason?: string,
  workers: WorkersLane<T> | null = null,
): Promise<T> => {
  if (executor === 'workers') {
    if (workers == null) {
      throw new Error(
        "this algorithm has no workers path — use executor 'cpu' or 'auto'",
      );
    }

    // acquisition failure propagates: an explicit 'workers' is loud
    return workers.run(await acquireAlgoWorkers());
  }

  if (executor === 'gpu') {
    if (!algoGpuSupported()) {
      throw new Error(
        "executor 'gpu' requires WebGPU, which is unavailable in this " +
          "environment — use 'cpu' or 'auto'",
      );
    }

    if (gpu == null) {
      throw new Error(
        gpuNoPathReason ??
          "this algorithm has no GPU path — use executor 'cpu' or 'auto'",
      );
    }

    return gpu(await acquireAlgoGpu());
  }

  if (
    executor === 'auto' &&
    gpu != null &&
    n >= minGpuN &&
    algoGpuSupported()
  ) {
    let ctx: AlgoGpu | null;

    try {
      ctx = await acquireAlgoGpu();
    } catch {
      ctx = null; // no adapter: 'auto' falls back to the reference path
    }

    if (ctx != null) {
      try {
        return await gpu(ctx);
      } catch (err) {
        // an input the device cannot fit routes to the next lane; any
        // *other* kernel error propagates (a defect must be loud)
        if (!(err instanceof GpuUnfitError)) {
          throw err;
        }
      }
    }
  }

  if (
    executor === 'auto' &&
    workers != null &&
    n >= workers.minN &&
    algoWorkersSupported()
  ) {
    let pool: AlgoWorkers | null;

    try {
      pool = await acquireAlgoWorkers();
    } catch {
      pool = null; // no pool (a CSP refusal, say): the reference path
    }

    if (pool != null) {
      // a failed run propagates, exactly as a kernel error does
      return workers.run(pool);
    }
  }

  return cpu();
};
