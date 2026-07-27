import { GpuCore } from './core.mjs';
import { Renderer } from './render/renderer.mjs';
import { PointerHandler } from './interact/pointer.mjs';
import { toColumnarElements } from './columnar.mjs';
import { deserializeElements, serializeElements } from './wire.mjs';
import type { CytoscapeGpuOptions } from './gpu-types.mjs';

export type * from './gpu-types.mjs';
export type { GpuCore } from './core.mjs';
export type { GpuCollection } from './collection.mjs';

/**
 * Create a GPU-prototype cytoscape instance (issue #3486, pass 1): a
 * columnar CPU-canonical model with a WebGPU render pipeline.
 *
 * With a `container`, WebGPU is required — this throws synchronously when
 * `navigator.gpu` is unavailable.  Without a container the instance is
 * headless (Node-friendly, never throws for a missing GPU).
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
