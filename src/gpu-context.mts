/*
WebGPU adapter/device acquisition and canvas configuration.

`cytoscape()` already hard-errors synchronously when a container is given
and `navigator.gpu` is missing; this module covers the async half: a null
adapter rejects the instance's `.ready` promise with a clear message.
Device loss is surfaced via the `onLost` callback for every loss —
including reason 'destroyed', so the *caller* distinguishes its own
teardown (renderer.destroy() flags itself first) from an external loss,
which the core recovers from by re-mounting (round 10).

**Every renderer in a realm shares one device**.  A device's
shader modules and pipelines are compiled per device, and on the
SwiftShader adapter that compile was ~3 s of every instance's first
frame — a second instance in the same page paid it again in full.  So
the first renderer acquires the device and later ones reuse it, along
with a cache of its immutable objects (shader modules, layouts,
samplers, pipelines), keyed by descriptor: a renderer that builds a
pipeline another already built gets the same object back.  Nothing in
the renderers changes for it:

- each renderer holds its own **view** of the device ({@link deviceView}),
  whose own-property shadows (the GPU ledger's `createBuffer` and
  `createTexture` wraps) stay private to it, so `stats().gpu` still
  counts one instance's allocations;
- the view's `destroy()` **releases** that renderer's hold — its
  `uncapturederror` listeners are removed and its ledger closes — and
  leaves the device for the others and for the next instance;
- the device outlives its last renderer, deliberately: create, destroy,
  create is the common sequence (and every spec's), and an idle device
  holds no scene memory, only its compiled pipelines;
- a real loss reaches every view (it is one device), every instance
  re-mounts as before, and the first re-mount acquires a fresh device.
*/

import { adapterBufferLimits } from './device-fit.mjs';

export interface GpuContext {
  device: GPUDevice;
  context: GPUCanvasContext;
  format: GPUTextureFormat;
}

/** The device methods whose results are immutable, so safe to share. */
const MEMO_METHODS = [
  'createShaderModule',
  'createBindGroupLayout',
  'createPipelineLayout',
  'createSampler',
  'createRenderPipeline',
  'createComputePipeline',
] as const;

let shared: Promise<GPUDevice> | null = null;
const realOf = new WeakMap<object, GPUDevice>();

/**
 * Make the device return one object per distinct descriptor from the
 * {@link MEMO_METHODS}.  A descriptor's key is its JSON with labels
 * dropped and every GPU object it references (a module, a layout)
 * replaced by that object's id — so two pipelines over cached modules
 * and layouts key alike.
 *
 * @param device — the shared device; its methods are shadowed by own
 *   properties, the prototype is untouched
 */
const memoize = (device: GPUDevice): void => {
  const ids = new WeakMap<object, number>();
  let nextId = 0;
  const keyOf = (desc: unknown): string =>
    JSON.stringify(desc ?? null, (key, value: unknown) => {
      if (key === 'label') {
        return undefined;
      }

      if (
        value != null &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        Object.getPrototypeOf(value) !== Object.prototype
      ) {
        let id = ids.get(value);

        if (id == null) {
          id = nextId++;
          ids.set(value, id);
        }

        return '#' + id;
      }

      return value;
    });
  const target = device as unknown as Record<string, unknown>;

  for (const name of MEMO_METHODS) {
    const create = (target[name] as (d: unknown) => object).bind(device);
    const cache = new Map<string, object>();

    target[name] = (desc: unknown) => {
      const key = keyOf(desc);
      let obj = cache.get(key);

      if (obj == null) {
        obj = create(desc);
        cache.set(key, obj);
      }

      return obj;
    };
  }
};

/**
 * The realm's shared device, acquired on first call.  Requests
 * `timestamp-query` when the adapter offers it, so `stats()` can report
 * real GPU frame times; its absence is not an error.  Requests the
 * adapter's own buffer and dispatch limits (round 138) — the default
 * device's 128 MiB storage binding blanked every frame past 4,194,304
 * elements — so the renderer's ceiling is the card's, and the model's
 * `cy.add()` pre-flight reads the same numbers.  A loss, or a failed
 * acquisition, clears it, so the next call acquires afresh.
 *
 * @returns the shared device
 * @throws if `navigator.gpu` is missing, or no adapter can be acquired
 */
const sharedDevice = (): Promise<GPUDevice> => {
  if (shared == null) {
    const pending = (async () => {
      const gpu = navigator.gpu;

      if (gpu == null) {
        throw new Error(
          'WebGPU is required to render but is unavailable in this browser',
        );
      }

      const adapter = await gpu.requestAdapter();

      if (adapter == null) {
        throw new Error(
          'WebGPU is available but no adapter could be acquired; ' +
            'the GPU may be blocklisted or unsupported',
        );
      }

      // optional profiling feature: real GPU frame times for stats() (see gpu-timer.mts)
      const requiredFeatures: GPUFeatureName[] = adapter.features.has(
        'timestamp-query',
      )
        ? ['timestamp-query']
        : [];

      const device = await adapter.requestDevice({
        requiredFeatures,
        requiredLimits: adapterBufferLimits(adapter),
      });

      // registered before any view's handler, so a re-mount that runs
      // from one acquires a fresh device rather than this lost one
      void device.lost.then(() => {
        if (shared === pending) {
          shared = null;
        }
      });
      memoize(device);

      return device;
    })();

    shared = pending;

    // an acquisition failure must not poison every later attempt
    pending.catch(() => {
      if (shared === pending) {
        shared = null;
      }
    });
  }

  return shared;
};

/**
 * One renderer's handle on the shared device: reads and calls go to the
 * device, but properties *set* on the view stay on it (the GPU ledger's
 * wraps), `addEventListener` registrations are remembered, and
 * `destroy()` releases them instead of destroying the device.  Pass the
 * real device, not a view, to any WebGPU call that takes a device as an
 * argument (`GPUCanvasContext.configure`).
 *
 * @param device — the shared device
 * @returns a fresh view of it
 */
export const deviceView = (device: GPUDevice): GPUDevice => {
  const own = new Map<PropertyKey, unknown>();
  const bound = new Map<PropertyKey, unknown>();
  const listeners: [string, EventListenerOrEventListenerObject][] = [];

  own.set('addEventListener', (type: string, cb: EventListener) => {
    listeners.push([type, cb]);
    device.addEventListener(type, cb);
  });
  own.set('destroy', () => {
    for (const [type, cb] of listeners) {
      device.removeEventListener(type, cb);
    }

    listeners.length = 0;
  });

  const view = new Proxy(device, {
    get(target, prop) {
      if (own.has(prop)) {
        return own.get(prop);
      }

      const value: unknown = Reflect.get(target, prop, target);

      if (typeof value !== 'function') {
        return value;
      }

      // re-bind when the device's own shadow changed (memoize)
      const hit = bound.get(prop) as { of: unknown; fn: unknown } | undefined;

      if (hit?.of === value) {
        return hit.fn;
      }

      const fn = (value as (...a: unknown[]) => unknown).bind(target);

      bound.set(prop, { of: value, fn });

      return fn;
    },
    set(_target, prop, value) {
      own.set(prop, value);

      return true;
    },
  });

  realOf.set(view, device);

  return view;
};

/**
 * Destroy the device under a view — every renderer sharing it loses it
 * (the device-loss hook, `renderer._debugLoseDevice()`).
 *
 * @param view — a view from {@link deviceView}, or a plain device
 */
export const loseDevice = (view: GPUDevice): void => {
  (realOf.get(view) ?? view).destroy();
};

/**
 * Acquire a view of the shared device and configure the canvas for
 * presentation.
 *
 * @param canvas — the canvas to configure with the preferred format
 * @param onLost — called for *every* device loss, reason 'destroyed'
 *   included, so the caller distinguishes its own teardown from an
 *   external loss it must re-mount from (round 10)
 * @returns this renderer's view of the device, the configured canvas
 *   context, and the format
 * @throws if `navigator.gpu` is missing, or no adapter can be acquired
 */
export const initGpuContext = async (
  canvas: HTMLCanvasElement | OffscreenCanvas,
  onLost: (info: GPUDeviceLostInfo) => void,
): Promise<GpuContext> => {
  const device = await sharedDevice();

  device.lost.then((info) => {
    onLost(info);
  });

  const context = canvas.getContext('webgpu');

  if (context == null) {
    throw new Error('Could not get a webgpu canvas context');
  }

  const format = navigator.gpu.getPreferredCanvasFormat();

  context.configure({ device, format, alphaMode: 'premultiplied' });

  return { device: deviceView(device), context, format };
};
