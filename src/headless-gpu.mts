/*
`cytoscape/headless-gpu` (round 131): tiers T0 + T1 + T2 of round 100.1's
ladder — everything `cytoscape/headless` carries, plus the GPU algorithm
lanes (`algorithms/gpu-lanes.mts`, registered below) and a headless GPU
force host (`gpu/headless-force-host.mts`).  No renderer and no pointer
handler: the build for a GPU with no DOM — Deno's native WebGPU, a
compute-only server.

A `container` (or `cy.mount()`) throws `this build has no renderer —
import 'cytoscape'`.  An explicit force `executor: 'gpu'` runs on the
compute device; `'auto'` stays on the CPU paths (the MIGRATING.md
contract: a headless `'auto'` force run never waits on a device), so the
GPU host is reached only by an explicit `'gpu'`.  The algorithms' `'auto'`
takes the GPU lane where an adapter exists and the input clears the
family's crossover, as in the full build.  `test/modules/import-graph.mjs`
walks this file's imports and fails if anything under `render/` or
`interact/` is reachable.
*/

import type { Core } from './core.mjs';
import type { DefaultEdgeData, Untyped } from './data-typing.mjs';
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
import { toColumnarElements } from './columnar.mjs';
import { CancelledError } from './algorithms/cancel.mjs';
import { deserializeElements, serializeElements } from './wire.mjs';
import { createCore, NO_RENDERER_BUILD } from './factory.mjs';
import type { CoreCaps } from './factory.mjs';
import type { HeadlessOptions } from './public-types.mjs';
import { GpuUnfitError, registerGpu } from './algorithms/gpu-registry.mjs';
import { GPU_RUNTIME } from './algorithms/gpu-lanes.mjs';
import { headlessForceHost } from './gpu/headless-force-host.mjs';

export type * from './public-exports.mjs';

/** T0 + T1 + T2: the GPU executors, no renderer. */
const HEADLESS_GPU: CoreCaps = {
  attach: null,
  gpu: true,
  forceHost: headlessForceHost,
  noRendererMessage: NO_RENDERER_BUILD,
};

/**
 * Create a headless cytoscape instance with the GPU executors — the
 * `cytoscape/headless-gpu` build (round 131): everything
 * `cytoscape/headless` carries, plus the WGSL algorithm kernels and a
 * compute-only host for an explicit `executor: 'gpu'` force run, and no
 * renderer.
 *
 * The factory ingests `options.elements` through the bulk path and runs
 * `options.layout`, exactly as the full build's does.  Unknown options are
 * ignored, as there (the type rejects them), and the generics type the
 * element data as there (round 140).
 *
 * @param options — the instance options, without the renderer- and
 *   pointer-only fields ({@link HeadlessOptions})
 * @returns the new core
 * @throws when a `container` is given — this build has no renderer
 */
export default function cytoscape<
  NodeData = Untyped,
  EdgeData = DefaultEdgeData<NodeData>,
>(
  options: HeadlessOptions<NoInfer<NodeData>, NoInfer<EdgeData>> = {},
): Core<NodeData, EdgeData> {
  return createCore(options, HEADLESS_GPU);
}

// the GPU executors (131.2)
registerGpu(GPU_RUNTIME);

// exposed as properties (v3-style) so the factory stays a plain callable,
// the same statics the full entry carries
cytoscape.toColumnarElements = toColumnarElements;
cytoscape.serializeElements = serializeElements;
cytoscape.deserializeElements = deserializeElements;
cytoscape.CancelledError = CancelledError;
// the device-fit class (round 138): `cy.add()` past the mounted device's
// limits, and a GPU algorithm whose input does not fit, throw it
cytoscape.GpuUnfitError = GpuUnfitError;
// the worker machinery's hooks (129.3, 74.2, 74.5), underscored and
// assigned through a cast as in the full entry: the force sim worker's
// spawn bootstrap loads *this* bundle inside the worker and calls its
// entry, so a slim build carries it; the render worker's does not exist
// here
(
  cytoscape as unknown as { __runForceSimWorker__: unknown }
).__runForceSimWorker__ = runForceSimWorker;
(
  cytoscape as unknown as { __resetForceWorker__: unknown }
).__resetForceWorker__ = _resetForceWorker;
(
  cytoscape as unknown as { __forceWorkerStats__: unknown }
).__forceWorkerStats__ = _forceWorkerStats;
(
  cytoscape as unknown as { __algoWorkerSource__: unknown }
).__algoWorkerSource__ = _algoWorkerSource;
(
  cytoscape as unknown as { __algoWorkersStats__: unknown }
).__algoWorkersStats__ = _algoWorkersStats;
(
  cytoscape as unknown as { __resetAlgoWorkers__: unknown }
).__resetAlgoWorkers__ = _resetAlgoWorkers;
