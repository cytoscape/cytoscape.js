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

import { BUFFER_USAGE, MAP_MODE } from '../render/webgpu-constants.mjs';

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

// -- the kernel-runner helpers every GPU algorithm shares ------------------

/**
 * Thrown by a GPU implementation whose input does not fit the device
 * (a dense matrix past the storage-binding limit, say).  `runAlgo`
 * treats it like an acquisition failure: under `'auto'` the run falls
 * back to the CPU reference, under an explicit `'gpu'` it propagates —
 * unlike every other kernel error, which always propagates.
 */
export class GpuUnfitError extends Error {}

/**
 * Assert a dense allocation fits the device's storage-binding limit.
 *
 * @param ctx — the shared device state
 * @param bytes — the largest single storage buffer the run will bind
 * @param what — the algorithm name, for the error message
 * @throws GpuUnfitError when the buffer would exceed the device limit
 */
export const assertFits = (ctx: AlgoGpu, bytes: number, what: string): void => {
  const limit = ctx.device.limits.maxStorageBufferBindingSize;

  if (bytes > limit) {
    throw new GpuUnfitError(
      `${what}: a ${bytes}-byte matrix exceeds this device's ` +
        `${limit}-byte storage binding limit`,
    );
  }
};

/**
 * Get (or compile and cache) the compute pipeline for a kernel.  One
 * compile per (device, id) — Dawn defers compilation to first use, so
 * caching is what keeps the stall from being paid per call.
 *
 * @param ctx — the shared device state
 * @param id — the cache key; also the pipeline label
 * @param code — the WGSL source with a `main` entry point
 * @returns the cached pipeline
 */
export const getPipeline = (
  ctx: AlgoGpu,
  id: string,
  code: string,
): GPUComputePipeline => {
  let pipeline = ctx.pipelines.get(id);

  if (pipeline == null) {
    pipeline = ctx.device.createComputePipeline({
      label: `cy-gpu:algo-${id}`,
      layout: 'auto',
      compute: {
        module: ctx.device.createShaderModule({
          label: `cy-gpu:algo-${id}`,
          code,
        }),
        entryPoint: 'main',
      },
    });
    ctx.pipelines.set(id, pipeline);
  }

  return pipeline;
};

const STORAGE_USAGE =
  BUFFER_USAGE.STORAGE | BUFFER_USAGE.COPY_DST | BUFFER_USAGE.COPY_SRC;
const UNIFORM_USAGE = BUFFER_USAGE.UNIFORM | BUFFER_USAGE.COPY_DST;
const STAGING_USAGE = BUFFER_USAGE.COPY_DST | BUFFER_USAGE.MAP_READ;
const MAP_READ_MODE = MAP_MODE.READ;

/** Upload a typed array as a storage buffer (STORAGE|COPY_DST|COPY_SRC). */
export const storageFrom = (
  ctx: AlgoGpu,
  data: Float32Array | Uint32Array | Int32Array,
): GPUBuffer => {
  const buffer = ctx.device.createBuffer({
    label: 'cy-gpu:algo-storage',
    size: Math.max(4, data.byteLength),
    usage: STORAGE_USAGE,
  });

  ctx.device.queue.writeBuffer(buffer, 0, data as unknown as BufferSource);

  return buffer;
};

/** An uninitialised (zeroed) storage buffer of `bytes` length. */
export const storageOf = (ctx: AlgoGpu, bytes: number): GPUBuffer =>
  ctx.device.createBuffer({
    label: 'cy-gpu:algo-storage',
    size: Math.max(4, bytes),
    usage: STORAGE_USAGE,
  });

/** Upload a small uniform buffer (UNIFORM|COPY_DST). */
export const uniformFrom = (
  ctx: AlgoGpu,
  data: Float32Array | Uint32Array | Int32Array,
): GPUBuffer => {
  const buffer = ctx.device.createBuffer({
    label: 'cy-gpu:algo-uniform',
    size: Math.max(16, data.byteLength),
    usage: UNIFORM_USAGE,
  });

  ctx.device.queue.writeBuffer(buffer, 0, data as unknown as BufferSource);

  return buffer;
};

/**
 * The `struct P { n : u32, r : f32 }` uniform most dense kernels take —
 * a u32 count beside an f32 parameter, packed via mixed views.
 *
 * @param ctx — the shared device state
 * @param n — the matrix edge (or vector length)
 * @param r — the kernel's scalar parameter (exponent, rounding scale…)
 * @returns the uploaded 8-byte uniform buffer
 */
export const paramsNR = (ctx: AlgoGpu, n: number, r: number): GPUBuffer => {
  const bytes = new ArrayBuffer(8);

  new Uint32Array(bytes)[0] = n;
  new Float32Array(bytes)[1] = r;

  return uniformFrom(ctx, new Uint32Array(bytes));
};

/** Bind `buffers` in order as group 0 of `pipeline`. */
export const groupFor = (
  ctx: AlgoGpu,
  pipeline: GPUComputePipeline,
  buffers: GPUBuffer[],
): GPUBindGroup =>
  ctx.device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: buffers.map((buffer, i) => ({
      binding: i,
      resource: { buffer },
    })),
  });

/** One encoded dispatch: pipeline + bind group + workgroup counts. */
export interface Dispatch {
  pipeline: GPUComputePipeline;
  group: GPUBindGroup;
  /** [x] or [x, y] workgroup counts */
  groups: [number] | [number, number];
}

/**
 * Encode a sequence of dispatches as one compute pass and submit it.
 * Storage-buffer writes are visible to later dispatches in the same
 * pass, so an iteration's kernels chain without extra submits.
 *
 * @param ctx — the shared device state
 * @param dispatches — run in order
 */
export const submitPass = (ctx: AlgoGpu, dispatches: Dispatch[]): void => {
  const encoder = ctx.device.createCommandEncoder();
  const pass = encoder.beginComputePass();

  for (const d of dispatches) {
    pass.setPipeline(d.pipeline);
    pass.setBindGroup(0, d.group);
    pass.dispatchWorkgroups(d.groups[0], d.groups[1] ?? 1);
  }

  pass.end();
  ctx.device.queue.submit([encoder.finish()]);
};

/**
 * Read a buffer back: copy to a fresh staging buffer, await the map,
 * and hand back a copy of the bytes.  The one stall every GPU
 * algorithm pays exactly once per run (plus any convergence probes).
 *
 * @param ctx — the shared device state
 * @param src — the storage buffer to read (COPY_SRC)
 * @param bytes — how many bytes to read from offset 0
 * @returns a detached copy of the bytes
 */
export const readBack = async (
  ctx: AlgoGpu,
  src: GPUBuffer,
  bytes: number,
): Promise<ArrayBuffer> => {
  const staging = ctx.device.createBuffer({
    label: 'cy-gpu:algo-staging',
    size: bytes,
    usage: STAGING_USAGE,
  });
  const encoder = ctx.device.createCommandEncoder();

  encoder.copyBufferToBuffer(src, 0, staging, 0, bytes);
  ctx.device.queue.submit([encoder.finish()]);

  await staging.mapAsync(MAP_READ_MODE);

  const out = staging.getMappedRange().slice(0);

  staging.unmap();
  staging.destroy();

  return out;
};
