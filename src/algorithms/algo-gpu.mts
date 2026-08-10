/*
Standalone WebGPU acquisition for the algorithm executors (round 65).

Unlike the renderer's `src/gpu-context.mts` this needs no canvas, no
presentation format and no Core instance: algorithm kernels are pure
compute — they snapshot their inputs from the store on the CPU side,
upload their own buffers, dispatch, and read one result back — so they
never touch the renderer's mirrors or the tween/force lease machinery,
and a headless instance can run GPU algorithms wherever `navigator.gpu`
exists.  One device is acquired lazily per page/process and shared by
every run; compute pipelines are compiled once per (device, kernel id)
and cached, because Dawn defers compilation to first use and the
compile stall must be paid once, not per call (the round-53 tween
lesson).

Device loss clears the cache so the next run re-acquires; in-flight
runs surface the loss as a rejection, which `executor: 'auto'` treats
as any other kernel failure (it propagates — only *acquisition*
failures fall back to the CPU, so a kernel defect can never be
silently papered over by the router).
*/

/** The shared per-device state every GPU algorithm run borrows. */
export interface AlgoGpu {
  device: GPUDevice;
  /** compute pipelines keyed by kernel id, compiled once per device */
  pipelines: Map<string, GPUComputePipeline>;
}

let cached: Promise<AlgoGpu> | null = null;

/**
 * Whether this environment can host the GPU executor at all — the sync
 * half of availability (`navigator.gpu` present).  A `true` here does
 * not promise an adapter: `about:blank`-style contexts answer `null`
 * to `requestAdapter()` (the round-18.5/27.9 lesson), which
 * `acquireAlgoGpu` surfaces async.
 *
 * @returns true when `navigator.gpu` exists
 */
export const algoGpuSupported = (): boolean =>
  (globalThis.navigator as Navigator | undefined)?.gpu != null;

/**
 * Acquire (or reuse) the shared compute device for algorithm runs.
 * Cached across calls; a device loss clears the cache so the next run
 * re-acquires rather than dispatching into a dead device.
 *
 * @returns the shared device state
 * @throws if WebGPU is unavailable or no adapter can be acquired
 */
export const acquireAlgoGpu = (): Promise<AlgoGpu> => {
  if (cached == null) {
    cached = (async () => {
      const gpu = (globalThis.navigator as Navigator | undefined)?.gpu;

      if (gpu == null) {
        throw new Error(
          'WebGPU is required for the GPU algorithm executor but is ' +
            'unavailable in this environment',
        );
      }

      const adapter = await gpu.requestAdapter();

      if (adapter == null) {
        throw new Error(
          'WebGPU is available but no adapter could be acquired for the ' +
            'GPU algorithm executor; the GPU may be blocklisted or ' +
            'unsupported',
        );
      }

      const device = await adapter.requestDevice();

      device.lost.then(() => {
        cached = null;
      });

      return { device, pipelines: new Map() };
    })();

    // an acquisition failure must not poison every later attempt
    cached.catch(() => {
      cached = null;
    });
  }

  return cached;
};

/** Test hook: drop the cached device so the next run re-acquires. */
export const _resetAlgoGpu = (): void => {
  cached = null;
};
