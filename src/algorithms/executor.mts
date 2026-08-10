/*
The async algorithm executor contract (round 65).

The expensive whole-graph algorithms — the dense-matrix and clustering
tier — are Promise-returning in v4, with an `executor` option choosing
where the maths runs:

  'cpu'  — the reference implementation, bit-reproducible, always
           available.  What headless Node always runs.
  'gpu'  — the WGSL kernels; rejects when WebGPU (or the algorithm's
           GPU path) is unavailable rather than silently degrading.
  'auto' — the default: GPU when an adapter exists and the input is
           large enough to beat the dispatch/readback overhead,
           otherwise CPU.

Determinism follows the force-layout precedent (round 18.4): the CPU
executor is the reproducible spec; GPU results may differ within pinned
invariants (WGSL is f32, the reference is f64), and a caller that needs
bit-stable output says `executor: 'cpu'`.

Under 'auto', only *acquisition* failure falls back to the CPU — an
error thrown by a kernel run propagates, so a kernel defect is loud
rather than quietly rerouted (the guard-nothing-triggers rule).
*/

import { acquireAlgoGpu, algoGpuSupported } from './algo-gpu.mjs';
import type { AlgoGpu } from './algo-gpu.mjs';

/** Where an async algorithm runs: the reference CPU path, the WGSL
 * kernels, or (the default) whichever fits the input and environment. */
export type AlgoExecutor = 'cpu' | 'gpu' | 'auto';

/**
 * The node count under which `'auto'` stays on the CPU: below this the
 * upload + dispatch + readback overhead dominates whatever the kernel
 * saves.  A starting figure to be re-measured per family by the
 * GPU-vs-CPU benchmark sweep.
 */
export const GPU_MIN_N = 256;

/**
 * Validate the `executor` option — called synchronously by every async
 * algorithm entry, so a bad value throws at the call site rather than
 * surfacing later as a rejection.
 *
 * @param executor — the option as passed, or undefined for the default
 * @returns the resolved executor ('auto' when omitted)
 * @throws if the value is not 'cpu', 'gpu' or 'auto'
 */
export const resolveExecutor = (
  executor: AlgoExecutor | undefined,
): AlgoExecutor => {
  if (executor == null) {
    return 'auto';
  }

  if (executor === 'cpu' || executor === 'gpu' || executor === 'auto') {
    return executor;
  }

  throw new TypeError(
    `\`executor\` must be 'cpu', 'gpu' or 'auto' — got ${String(executor)}`,
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
 * @returns the algorithm result, from whichever executor ran
 * @throws if `executor: 'gpu'` is asked of an environment without
 *   WebGPU, or of an option combination with no GPU path
 */
export const runAlgo = async <T,>(
  executor: AlgoExecutor,
  n: number,
  minGpuN: number,
  cpu: () => T,
  gpu: ((ctx: AlgoGpu) => Promise<T>) | null,
  gpuNoPathReason?: string,
): Promise<T> => {
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
      return gpu(ctx);
    }
  }

  return cpu();
};
