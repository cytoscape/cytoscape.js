import * as math from '../../math.mjs';
import type { BoundingBox, Position } from '../../types.mjs';
import type { GpuCircleLayoutOptions } from '../gpu-types.mjs';
import type { GpuCollection } from '../collection.mjs';
import type { GpuCore } from '../core.mjs';

/*
Circle layout: v3's math verbatim over the collection scope.  One
deliberate correction vs the repo's v3 file: `layoutPositions` is called
on the *sorted* node collection (as upstream v3 does), so the `sort`
option actually orders nodes around the circle.
*/

const defaults: Omit<GpuCircleLayoutOptions, 'name'> = {
  fit: true,
  padding: 30,
  boundingBox: undefined,
  avoidOverlap: true,
  spacingFactor: undefined,
  radius: undefined,
  startAngle: 3 / 2 * Math.PI,
  sweep: undefined,
  clockwise: true,
  sort: undefined,
  animate: false,
  animationDuration: 500,
  animationEasing: undefined,
  animateFilter: undefined,
  ready: undefined,
  stop: undefined,
  transform: undefined
};

export class CircleLayout {
  options: GpuCircleLayoutOptions;

  private cy: GpuCore;

  constructor( cy: GpuCore, options: GpuCircleLayoutOptions ){
    this.cy = cy;
    this.options = { ...defaults, ...options };
  }

  run(): this {
    const cy = this.cy;
    const options = this.options;
    const eles = ( options.eles as GpuCollection | undefined ) ?? cy.elements();
    const clockwise = options.counterclockwise !== undefined ? !options.counterclockwise : options.clockwise;

    let nodes = eles.nodes().filter( ( n: GpuCollection ) => !n.isParent() );

    if( options.sort != null ){
      nodes = nodes.sort( options.sort as ( a: GpuCollection, b: GpuCollection ) => number );
    }

    const bb = math.makeBoundingBox( options.boundingBox ?? {
      x1: 0, y1: 0, w: cy.width(), h: cy.height()
    } ) as BoundingBox;

    const center = {
      x: bb.x1 + bb.w / 2,
      y: bb.y1 + bb.h / 2
    };

    const sweep = options.sweep === undefined
      ? 2 * Math.PI - 2 * Math.PI / nodes.length
      : options.sweep;
    const dTheta = sweep / Math.max( 1, nodes.length - 1 );
    let r: number;

    let minDistance = 0;

    for( let i = 0; i < nodes.length; i++ ){
      const nbb = nodes[ i ].layoutDimensions( options );

      minDistance = Math.max( minDistance, nbb.w, nbb.h );
    }

    if( typeof options.radius === 'number' ){
      r = options.radius;
    } else if( nodes.length <= 1 ){
      r = 0;
    } else {
      r = Math.min( bb.h, bb.w ) / 2 - minDistance;
    }

    // adjust the radius so nodes can't overlap
    if( nodes.length > 1 && options.avoidOverlap ){
      minDistance *= 1.75; // just to have some nice spacing

      const dcos = Math.cos( dTheta ) - Math.cos( 0 );
      const dsin = Math.sin( dTheta ) - Math.sin( 0 );
      const rMin = Math.sqrt( minDistance * minDistance / ( dcos * dcos + dsin * dsin ) );

      r = Math.max( rMin, r );
    }

    const getPos = ( _ele: GpuCollection, i: number ): Position => {
      const theta = ( options.startAngle as number ) + i * dTheta * ( clockwise ? 1 : -1 );

      return {
        x: center.x + r * Math.cos( theta ),
        y: center.y + r * Math.sin( theta )
      };
    };

    nodes.layoutPositions( this, { ...options, eles }, getPos );

    return this;
  }
}
