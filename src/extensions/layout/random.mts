import * as util from '../../util/index.mjs';
import * as math from '../../math.mjs';
import type { LayoutBase, LayoutOptionsBase, Collection } from './layout-base.mjs';
import type { LayoutLike, LayoutOptions } from '../../collection/layout.mjs';
import type { BoundingBox, Position } from '../../types.mjs';

/** Options accepted by the random layout. */
export interface RandomLayoutOptions extends LayoutOptionsBase {
  fit?: boolean;
  padding?: number;
}

/** The random layout instance (`this`). */
export interface RandomLayout extends LayoutBase {
  options: RandomLayoutOptions;
}

/* eslint-disable @typescript-eslint/no-unused-vars */
let defaults = {
  fit: true, // whether to fit to viewport
  padding: 30, // fit padding
  boundingBox: undefined, // constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
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
function RandomLayout( this: RandomLayout, options: RandomLayoutOptions ){
  this.options = util.extend( {}, defaults, options ) as RandomLayoutOptions;
}

RandomLayout.prototype.run = function( this: RandomLayout ){
  let options = this.options;
  let cy = options.cy;
  let eles = options.eles;


  let bb = math.makeBoundingBox( options.boundingBox ? options.boundingBox : {
    x1: 0, y1: 0, w: cy.width(), h: cy.height()
  } ) as BoundingBox; // input always yields a valid bounding box

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let getPos = function( node: Collection, i: number ){
    return {
      x: bb.x1 + Math.round( Math.random() * bb.w ),
      y: bb.y1 + Math.round( Math.random() * bb.h )
    };
  };

  eles.nodes().layoutPositions( this as unknown as LayoutLike, options as unknown as LayoutOptions, getPos );

  return this; // chaining
};

export default RandomLayout;
