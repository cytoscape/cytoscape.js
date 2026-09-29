import type { Core } from './core.mjs';
import type { Untyped } from './data-typing.mjs';
import { Renderer } from './render/renderer.mjs';
import { coreRenderHost } from './render/host.mjs';
import { createBrowserImageDecoder } from './render/image-decoder.mjs';
import { WorkerRenderer } from './render/worker-renderer.mjs';
import { runRenderWorker } from './render/worker-main.mjs';
import { runForceSimWorker } from './layout/force-worker.mjs';
import {
  _forceWorkerStats,
  _resetForceWorker,
} from './layout/force-remote.mjs';
import {
  _algoWorkerSource,
  _algoWorkersStats,
  _resetAlgoWorkers,
} from './algorithms/algo-workers.mjs';
import { PointerHandler } from './interact/pointer.mjs';
import { toColumnarElements } from './columnar.mjs';
import { CancelledError } from './algorithms/cancel.mjs';
import { deserializeElements, serializeElements } from './wire.mjs';
import { GpuUnfitError, registerGpu } from './algorithms/gpu-registry.mjs';
import { GPU_RUNTIME } from './algorithms/gpu-lanes.mjs';
import { headlessForceHost } from './gpu/headless-force-host.mjs';
import { createCore, NO_RENDERER_BUILD, requireWebGpu } from './factory.mjs';
import type { CoreCaps } from './factory.mjs';
import type { CytoscapeOptions } from './public-types.mjs';

export type * from './public-exports.mjs';

/**
 * The full build's attach (round 131.3 lifted it out of the factory): a
 * renderer — same-thread or the worker host — and the pointer handler on
 * a container.
 */
const attachRenderer = (
  cy: Core,
  container: HTMLElement,
  options: CytoscapeOptions,
): void => {
  requireWebGpu();

  const rendererOpts = {
    pixelRatio: options.pixelRatio,
    ...options.renderer,
  };
  // the worker host (round 86.3): same seam, the engine in a worker;
  // rejects loudly where unsupported, never a silent fallback
  const renderer =
    options.renderer?.worker === true
      ? new WorkerRenderer(cy, container, rendererOpts)
      : new Renderer(
          coreRenderHost(cy, () => createBrowserImageDecoder()),
          container,
          rendererOpts,
        );

  renderer.onDeviceLost = (message) => cy._handleDeviceLost(message);
  cy._pointer = new PointerHandler(cy, renderer);
  cy._renderer = renderer;
  cy.ready = renderer.ready.then(() => {
    // an initial `cy.load()` holds readiness until its first chunk is
    // drawn (round 103) — it flips the flag itself then
    if (!cy._readyHeld) {
      cy._readyResolved = true;
    }

    return cy;
  });
};

/** Everything: the renderer, the pointer, the GPU executors (T3). */
const FULL: CoreCaps = {
  attach: attachRenderer,
  gpu: true,
  // a rendered instance hosts the GPU force run itself; an unmounted
  // one hosts an explicit 'gpu' run on the compute device (131.4), as
  // headless-gpu does — T3 carries T2
  forceHost: headlessForceHost,
  noRendererMessage: NO_RENDERER_BUILD,
};

/**
 * Create a GPU-prototype cytoscape instance (issue #3486, pass 1): a
 * columnar CPU-canonical model with a WebGPU render pipeline.
 *
 * With a `container`, WebGPU is required — this throws synchronously when
 * `navigator.gpu` is unavailable.  Without a container the instance is
 * headless (Node-friendly, never throws for a missing GPU).  Adapter
 * acquisition is asynchronous and reported separately: `cy.ready` rejects
 * when no adapter can be had, which this function cannot know yet.
 *
 * Beyond the constructor's work, the factory ingests `options.elements`
 * through the bulk path (no per-element handles, no `add` events — nothing
 * can be listening yet), runs `options.layout`, and attaches the renderer and
 * pointer handler when a container is given.
 *
 * This is the full build (`cytoscape`).  Two slimmer entries carry the
 * same core without the renderer (round 131): `cytoscape/headless` (no
 * renderer, no GPU executors) and `cytoscape/headless-gpu` (the GPU
 * algorithm lanes and a headless GPU force host, no renderer).
 *
 * **Unknown options are ignored, deliberately** (decided 2026-08-04, fifth
 * design sitting): unlike an unknown sheet key, style property or query key,
 * a misspelled option does not throw, because strictness here resolves at the
 * type layer — TypeScript's excess-property check rejects `{ motionBlur:
 * true }` against {@link CytoscapeOptions}, and v4 does not replicate at
 * runtime what the build already checks.
 *
 * @param options — the instance options; every field is optional, and an
 *   omitted `container` is what selects headless mode
 * @returns the new core, usable synchronously — reads and writes do not wait
 *   on the device, and a rendered instance additionally resolves `cy.ready`
 * @throws when `container` is given and `navigator.gpu` is missing
 */
export default function cytoscape<NodeData = Untyped, EdgeData = Untyped>(
  options: CytoscapeOptions = {},
): Core<NodeData, EdgeData> {
  return createCore(options, FULL);
}

// the GPU executors (131.2): the full entry carries every kernel
registerGpu(GPU_RUNTIME);

// exposed as properties (v3-style, like cytoscape.use) so the UMD global
// stays a plain callable
cytoscape.toColumnarElements = toColumnarElements;
cytoscape.serializeElements = serializeElements;
cytoscape.deserializeElements = deserializeElements;
// the cancellation class (round 128), a static for the same reason: a
// `.catch` that wants `instanceof` needs the value, and the UMD global
// has no named exports to carry it
cytoscape.CancelledError = CancelledError;
// the device-fit class (round 138): `cy.add()` past the mounted device's
// limits, and a GPU algorithm whose input does not fit, throw it
cytoscape.GpuUnfitError = GpuUnfitError;
// the worker-side entry (round 86.3): the proxy's spawn bootstrap loads
// this same bundle inside a worker and calls it.  Underscored because it
// is the machinery's own hook, not API — and assigned through a cast so
// neither the shipped declaration nor the docs generator picks it up as
// a factory static
(cytoscape as unknown as { __runRenderWorker__: unknown }).__runRenderWorker__ =
  runRenderWorker;
// the force sim worker's entry (129.3), the same way: the layout's
// spawn bootstrap loads this bundle inside a worker and calls it, so
// the CPU simulation runs off the main thread on the very same code
(
  cytoscape as unknown as { __runForceSimWorker__: unknown }
).__runForceSimWorker__ = runForceSimWorker;
(
  cytoscape as unknown as { __resetForceWorker__: unknown }
).__resetForceWorker__ = _resetForceWorker;
(
  cytoscape as unknown as { __forceWorkerStats__: unknown }
).__forceWorkerStats__ = _forceWorkerStats;

// the algorithm worker's source text (round 74.2), attached the same
// way: `test/modules/algo-worker-body.mjs` pulls it out of each built
// bundle and evaluates it in a bare scope, which is the one place the
// "self-contained body" claim can actually break
(
  cytoscape as unknown as { __algoWorkerSource__: unknown }
).__algoWorkerSource__ = _algoWorkerSource;
// and the pool's counters and reset (74.5): the `algorithms-workers`
// benchmark runs through the built ESM (the hot-path rule) and its rows
// assert they ran where their names say
(
  cytoscape as unknown as { __algoWorkersStats__: unknown }
).__algoWorkersStats__ = _algoWorkersStats;
(
  cytoscape as unknown as { __resetAlgoWorkers__: unknown }
).__resetAlgoWorkers__ = _resetAlgoWorkers;
