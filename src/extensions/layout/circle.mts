import * as util from '../../util/index.mjs';
import * as math from '../../math.mjs';
import * as is from '../../is.mjs';
import type { LayoutBase, LayoutOptionsBase, Collection } from './layout-base.mjs';
import type { LayoutLike, LayoutOptions } from '../../collection/layout.mjs';
import type { Element, NodeSingular } from '../../collection/eles-types.mjs';
import type { BoundingBox, Position } from '../../types.mjs';

/** Options accepted by the circle layout. */
export interface CircleLayoutOptions extends LayoutOptionsBase {
  fit?: boolean;
  padding?: number;
  avoidOverlap?: boolean;
  nodeDimensionsIncludeLabels?: boolean;
  spacingFactor?: number;
  radius?: number;
  startAngle?: number;
  sweep?: number;
  clockwise?: boolean;
  counterclockwise?: boolean;
  sort?: ( a: NodeSingular, b: NodeSingular ) => number;
}

/** The circle layout instance (`this`). */
export interface CircleLayout extends LayoutBase {
  options: CircleLayoutOptions;
}

/* eslint-disable @typescript-eslint/no-unused-vars */
let defaults = {
  fit: true, // whether to fit the viewport to the graph
  padding: 30, // the padding on fit
  boundingBox: undefined, // constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
  avoidOverlap: true, // prevents node overlap, may overflow boundingBox and radius if not enough space
  nodeDimensionsIncludeLabels: false, // Excludes the label when calculating node bounding boxes for the layout algorithm
  spacingFactor: undefined, // Applies a multiplicative factor (>0) to expand or compress the overall area that the nodes take up
  radius: undefined, // the radius of the circle
  startAngle: 3 / 2 * Math.PI, // where nodes start in radians
  sweep: undefined, // how many radians should be between the first and last node (defaults to full circle)
  clockwise: true, // whether the layout should go clockwise (true) or counterclockwise/anticlockwise (false)
  sort: undefined, // a sorting function to order the nodes; e.g. function(a, b){ return a.data('weight') - b.data('weight') }
  animate: false, // whether to transition the node positions
  animationDuration: 500, // duration of animation in ms if enabled
  animationEasing: undefined, // easing of animation if enabled
  animateFilter: function ( node: Collection, i: number ){ return true; }, // a function that determines whether the node should be animated.  All nodes animated by default on animate enabled.  Non-animated nodes are positioned immediately when the layout starts
  ready: undefined, // callback on layoutready
  stop: undefined, // callback on layoutstop
  transform: function (node: Collection, position: Position ){ return position; } // transform a given node position. Useful for changing flow direction in discrete layouts

};
/* eslint-enable @typescript-eslint/no-unused-vars */

// eslint-disable-next-line @typescript-eslint/no-redeclare -- intentional declaration merging with the interface above
function CircleLayout( this: CircleLayout, options: CircleLayoutOptions ){
  this.options = util.extend( {}, defaults, options ) as CircleLayoutOptions;
}

CircleLayout.prototype.run = function( this: CircleLayout ){
  let params = this.options;
  let options = params;

  let cy = params.cy;
  let eles = options.eles;

  let clockwise = options.counterclockwise !== undefined ? !options.counterclockwise : options.clockwise;

  let nodes = eles.nodes().not( ':parent' );

  if( options.sort ){
    nodes = nodes.sort( options.sort as unknown as ( a: Element, b: Element ) => number );
  }

  let bb = math.makeBoundingBox( options.boundingBox ? options.boundingBox : {
    x1: 0, y1: 0, w: cy.width(), h: cy.height()
  } ) as BoundingBox; // input always yields a valid bounding box

  let center = {
    x: bb.x1 + bb.w / 2,
    y: bb.y1 + bb.h / 2
  };

  let sweep = options.sweep === undefined ? 2 * Math.PI - 2 * Math.PI / nodes.length : options.sweep;
  let dTheta = sweep / ( Math.max( 1, nodes.length - 1 ) );
  let r;

  let minDistance = 0;
  for( let i = 0; i < nodes.length; i++ ){
    let n = nodes[ i ];
    let nbb = n.layoutDimensions( options );
    let w = nbb.w;
    let h = nbb.h;

    minDistance = Math.max( minDistance, w, h );
  }

  if( is.number( options.radius ) ){
    r = options.radius;
  } else if( nodes.length <= 1 ){
    r = 0;
  } else {
    r = Math.min( bb.h, bb.w ) / 2 - minDistance;
  }

  // calculate the radius
  if( nodes.length > 1 && options.avoidOverlap ){ // but only if more than one node (can't overlap)
    minDistance *= 1.75; // just to have some nice spacing

    let dcos = Math.cos( dTheta ) - Math.cos( 0 );
    let dsin = Math.sin( dTheta ) - Math.sin( 0 );
    let rMin = Math.sqrt( minDistance * minDistance / ( dcos * dcos + dsin * dsin ) ); // s.t. no nodes overlapping
    r = Math.max( rMin, r );
  }

  let getPos = function( ele: Collection, i: number ){
    let theta = options.startAngle! + i * dTheta * ( clockwise ? 1 : -1 );

    let rx = r * Math.cos( theta );
    let ry = r * Math.sin( theta );
    let pos = {
      x: center.x + rx,
      y: center.y + ry
    };

    return pos;
  };

  eles.nodes().layoutPositions( this as unknown as LayoutLike, options as unknown as LayoutOptions, getPos );

  return this; // chaining
};

export default CircleLayout;
