import { GpuCore } from './core.mjs';
import { Renderer } from './render/renderer.mjs';
import { PointerHandler } from './interact/pointer.mjs';
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
    cy.add( options.elements );
  }

  if( options.layout != null ){
    cy.layout( options.layout ).run();
  }

  if( options.container != null ){
    const renderer = new Renderer( cy, options.container, {
      pixelRatio: options.pixelRatio,
      ...options.renderer
    } );
    const pointer = new PointerHandler( cy, renderer );

    cy.on( 'destroy', () => pointer.destroy() );
    cy._renderer = renderer;
    cy.ready = renderer.ready.then( () => cy );
  }

  return cy;
}
