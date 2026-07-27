import * as math from '../../math.mjs';
import type { BoundingBox } from '../../types.mjs';
import type { GpuRandomLayoutOptions } from '../gpu-types.mjs';
import type { GpuCollection } from '../collection.mjs';
import type { GpuCore } from '../core.mjs';

/** Random layout: v3's, over the collection scope via layoutPositions. */

const defaults: Omit<GpuRandomLayoutOptions, 'name'> = {
  fit: true,
  padding: 30,
  boundingBox: undefined,
  animate: false,
  animationDuration: 500,
  animationEasing: undefined,
  animateFilter: undefined,
  ready: undefined,
  stop: undefined,
  transform: undefined
};

export class RandomLayout {
  options: GpuRandomLayoutOptions;

  private cy: GpuCore;

  constructor( cy: GpuCore, options: GpuRandomLayoutOptions ){
    this.cy = cy;
    this.options = { ...defaults, ...options };
  }

  run(): this {
    const cy = this.cy;
    const options = this.options;
    const eles = ( options.eles as GpuCollection | undefined ) ?? cy.elements();

    const bb = math.makeBoundingBox( options.boundingBox ?? {
      x1: 0, y1: 0, w: cy.width(), h: cy.height()
    } ) as BoundingBox;

    const getPos = (): { x: number; y: number } => ( {
      x: bb.x1 + Math.round( Math.random() * bb.w ),
      y: bb.y1 + Math.round( Math.random() * bb.h )
    } );

    eles.nodes().layoutPositions( this, { ...options, eles }, getPos );

    return this;
  }
}
