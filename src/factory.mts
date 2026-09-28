/*
The capability seam (round 131.3): the body every entry's factory shares.

`cytoscape()` used to be one function in `index.mts` that closed over the
renderer, the pointer handler, both worker entries and the worker pool,
so that `container` and `mount()` could work — and so a consumer's
bundler could prove nothing unused (131 measured 877,780 of 890,212
minified bytes surviving a headless-only app's tree shaking).  Now the
entry files (`index.mts`, `headless.mts`, `headless-gpu.mts`) each
import exactly their tier and hand `createCore` the capabilities they
carry; this module imports none of them.

`@internal`: the composable factory — `cytoscape/core` plus capability
modules — is **not exposed at alpha** (the eleventh design sitting,
2026-09-28).  The mechanism is here so exposing it later is surface,
types and docs, not another refactor.

Every edge is loud (the guard-nothing-triggers rule): a build with no
renderer given a `container` throws its `noRendererMessage` at the point
the full build's WebGPU check throws, before `_bulkAdd` (an ingest error
must not win over the container error, `test/core-api.mjs`), and
`cy.mount()` throws the same (`core/lifecycle.mts`).
*/

import { Core } from './core.mjs';
import type { ForceHostLike } from './layout/force-host.mjs';
import type { CytoscapeOptions } from './public-types.mjs';

/**
 * What an entry carries beyond the headless core.
 *
 * @internal
 */
export interface CoreCaps {
  /**
   * Attach a renderer and pointer handler to a container (the full build),
   * or null in a build with no renderer.  Called at creation when a
   * container is given, and by `cy.mount()`.
   */
  attach:
    | ((cy: Core, container: HTMLElement, options: CytoscapeOptions) => void)
    | null;
  /** the build registered GPU executors (`algorithms/gpu-registry.mts`) */
  gpu: boolean;
  /**
   * The headless GPU force host (131.4): hosts an explicit
   * `executor: 'gpu'` force run where no renderer is attached, or null
   * where the build has none.
   */
  forceHost: ((cy: Core) => ForceHostLike | null) | null;
  /** the error a `container` or `mount()` gets where `attach` is null */
  noRendererMessage: string;
}

/** The message a slim build gives a `container` or a `mount()`. */
export const NO_RENDERER_BUILD =
  "this build has no renderer — import 'cytoscape'";

/**
 * Throw unless WebGPU is present — the renderer's precondition, checked
 * before any work at creation and again by the full build's attach
 * (`mount()` after construction reaches only the second).
 *
 * @internal
 * @throws when `navigator.gpu` is missing
 */
export function requireWebGpu(): void {
  const nav = (globalThis as { navigator?: { gpu?: unknown } }).navigator;

  if (nav?.gpu == null) {
    throw new Error(
      'WebGPU is required to render but is unavailable in this browser; ' +
        'omit the container option to run headless',
    );
  }
}

/**
 * The shared factory body: the container guard, the core, the bulk
 * ingest, `options.layout`, and — where the build has a renderer — the
 * attach path `cy.mount()` reuses.
 *
 * @internal
 * @param options — the instance options, as the entry's factory took them
 * @param caps — what the calling entry carries
 * @returns the new core
 * @throws when a `container` is given to a build with no renderer, or
 *   when a `container` is given and `navigator.gpu` is missing
 */
export function createCore(options: CytoscapeOptions, caps: CoreCaps): Core {
  if (options.container != null) {
    if (caps.attach == null) {
      throw new Error(caps.noRendererMessage);
    }

    requireWebGpu();
  }

  const cy = new Core(options);

  cy._caps = caps;

  if (options.elements != null) {
    // bulk path: no per-element handles, no add events (nobody can be
    // listening yet), one preallocation instead of a growth cascade
    cy._bulkAdd(options.elements);
  }

  if (options.layout != null) {
    cy.layout(options.layout).run();
  }

  const attach = caps.attach;

  if (attach != null) {
    // (re)attach a renderer + pointer to a container — used at creation
    // and by cy.mount() after an unmount()
    cy._attachFn = (container: HTMLElement) => attach(cy, container, options);

    if (options.container != null) {
      cy._attachFn(options.container);
    }
  }

  return cy;
}
