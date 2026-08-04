import { GpuCore } from './core.mjs';
import { Renderer } from './render/renderer.mjs';
import { PointerHandler } from './interact/pointer.mjs';
import { toColumnarElements } from './columnar.mjs';
import { deserializeElements, serializeElements } from './wire.mjs';
import type { CytoscapeGpuOptions } from './gpu-types.mjs';

export type * from './gpu-types.mjs';
export type { GpuCore } from './core.mjs';
export type { GpuCollection } from './collection.mjs';
// round 41: v4's own event object, so a handler's parameter has a real type
// and `event.target` is no longer `unknown`
export type { GpuEvent, GpuEventProps, GpuEventTarget } from './event.mjs';
export type { EventHandler } from './emitter.mjs';

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
 * **Unknown options are ignored, deliberately** (decided 2026-08-04, fifth
 * design sitting): unlike an unknown sheet key, style property or query key,
 * a misspelled option does not throw, because strictness here resolves at the
 * type layer — TypeScript's excess-property check rejects `{ motionBlur:
 * true }` against {@link CytoscapeGpuOptions}, and v4 does not replicate at
 * runtime what the build already checks.
 *
 * @param options — the instance options; every field is optional, and an
 *   omitted `container` is what selects headless mode
 * @returns the new core, usable synchronously — reads and writes do not wait
 *   on the device, and a rendered instance additionally resolves `cy.ready`
 * @throws when `container` is given and `navigator.gpu` is missing
 */
export default function cytoscapeGpu( options: CytoscapeGpuOptions = {} ): GpuCore {
  if( options.container != null ){
    const nav = ( globalThis as { navigator?: { gpu?: unknown } } ).navigator;

    if( nav?.gpu == null ){
      throw new Error(
        'WebGPU is required to render but is unavailable in this browser; ' +
        'omit the container option to run headless'
      );
    }
  }

  const cy = new GpuCore( options );

  if( options.elements != null ){
    // bulk path: no per-element handles, no add events (nobody can be
    // listening yet), one preallocation instead of a growth cascade
    cy._bulkAdd( options.elements );
  }

  if( options.layout != null ){
    cy.layout( options.layout ).run();
  }

  // (re)attach a renderer + pointer to a container — used at creation and
  // by cy.mount() after an unmount()
  cy._attachFn = ( container: HTMLElement ) => {
    const nav = ( globalThis as { navigator?: { gpu?: unknown } } ).navigator;

    if( nav?.gpu == null ){
      throw new Error(
        'WebGPU is required to render but is unavailable in this browser; ' +
        'omit the container option to run headless'
      );
    }

    const renderer = new Renderer( cy, container, {
      pixelRatio: options.pixelRatio,
      ...options.renderer
    } );

    renderer.onDeviceLost = message => cy._handleDeviceLost( message );
    cy._pointer = new PointerHandler( cy, renderer );
    cy._renderer = renderer;
    cy.ready = renderer.ready.then( () => {
      cy._readyResolved = true;

      return cy;
    } );
  };

  if( options.container != null ){
    cy._attachFn( options.container );
  }

  return cy;
}

// exposed as properties (v3-style, like cytoscape.use) so the UMD global
// stays a plain callable
cytoscapeGpu.toColumnarElements = toColumnarElements;
cytoscapeGpu.serializeElements = serializeElements;
cytoscapeGpu.deserializeElements = deserializeElements;
