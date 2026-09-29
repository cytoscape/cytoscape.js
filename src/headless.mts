/*
`cytoscape/headless` (round 131): tiers T0 + T1 of round 100.1's ladder —
the store, style, collections, the CPU algorithms, every layout,
animation, the wire, the worker pool and the force sim worker.  No
renderer, no pointer handler, no WebGPU code at all: the build for CI and
for edge isolates (a Cloudflare Worker has no GPU, no `Worker`, and a
script-size ceiling — `test/modules/bundle-size.mjs` gates this build's
minified artifact).

What it does not carry is loud, never a silent fallback: a `container`
(or `cy.mount()`) throws `this build has no renderer — import
'cytoscape'`; an explicit `executor: 'gpu'`, on an algorithm or a force
layout, rejects `this build has no GPU executors — import
'cytoscape/headless-gpu' or 'cytoscape'`; `'auto'` simply finds no GPU
lane.  `test/modules/import-graph.mjs` walks this file's imports and
fails if anything under `render/`, `interact/`, `gpu/`, an `algo-gpu-*`
kernel or `gpu-lanes.mts` is reachable.
*/

import type { Core } from './core.mjs';
import type { Untyped } from './data-typing.mjs';
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
import { GpuUnfitError } from './algorithms/gpu-registry.mjs';
import { deserializeElements, serializeElements } from './wire.mjs';
import { createCore, NO_RENDERER_BUILD } from './factory.mjs';
import type { CoreCaps } from './factory.mjs';
import type { HeadlessOptions } from './public-types.mjs';

export type * from './public-exports.mjs';

/** T0 + T1: no renderer, no GPU executors, no device force host. */
const HEADLESS: CoreCaps = {
  attach: null,
  gpu: false,
  forceHost: null,
  noRendererMessage: NO_RENDERER_BUILD,
};

/**
 * Create a headless cytoscape instance — the `cytoscape/headless` build
 * (round 131): the whole graph model, style, collection API, the CPU
 * algorithms and every layout, with the worker pool where the platform
 * offers workers, and neither a renderer nor any WebGPU code.
 *
 * The factory ingests `options.elements` through the bulk path and runs
 * `options.layout`, exactly as the full build's does.  Unknown options are
 * ignored, as there (the type rejects them).
 *
 * @param options — the instance options, without the renderer- and
 *   pointer-only fields ({@link HeadlessOptions})
 * @returns the new core
 * @throws when a `container` is given — this build has no renderer
 */
export default function cytoscape<NodeData = Untyped, EdgeData = Untyped>(
  options: HeadlessOptions = {},
): Core<NodeData, EdgeData> {
  return createCore(options, HEADLESS);
}

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
