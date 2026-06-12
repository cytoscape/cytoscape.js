import * as util from '../../util/index.mjs';
import * as is from '../../is.mjs';
import { copyPosition } from '../../math.mjs';
import type { LayoutBase, LayoutOptionsBase, Collection } from './layout-base.mjs';
import type { LayoutLike, LayoutOptions, LayoutPositionFn } from '../../collection/layout.mjs';
import type { ElementPrivate } from '../../collection/eles-types.mjs';
import type { Position } from '../../types.mjs';

/** Options accepted by the preset layout. */
export interface PresetLayoutOptions extends LayoutOptionsBase {
  positions?: Record<string, Position> | ( ( node: Collection ) => Position | null | undefined );
  zoom?: number;
  pan?: Position;
  fit?: boolean;
  padding?: number;
  spacingFactor?: number;
}

/** The preset layout instance (`this`). */
export interface PresetLayout extends LayoutBase {
  options: PresetLayoutOptions;
}

/* eslint-disable @typescript-eslint/no-unused-vars */
let defaults = {
  positions: undefined, // map of (node id) => (position obj); or function(node){ return somPos; }
  zoom: undefined, // the zoom level to set (prob want fit = false if set)
  pan: undefined, // the pan level to set (prob want fit = false if set)
  fit: true, // whether to fit to viewport
  padding: 30, // padding on fit
  spacingFactor: undefined, // Applies a multiplicative factor (>0) to expand or compress the overall area that the nodes take up
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
function PresetLayout( this: PresetLayout, options: PresetLayoutOptions ){
  this.options = util.extend( {}, defaults, options ) as PresetLayoutOptions;
}

PresetLayout.prototype.run = function( this: PresetLayout ){
  let options = this.options;
  let eles = options.eles;

  let nodes = eles.nodes();
  let posIsFn = is.fn( options.positions );

  function getPosition( node: Collection ): Position | null {
    if( options.positions == null ){
      return copyPosition( node.position() );
    }

    if( posIsFn ){
      return ( options.positions as ( node: Collection ) => Position | null | undefined )( node ) ?? null;
    }

    let pos = ( options.positions as Record<string, Position> )[ ( node._private as ElementPrivate ).data.id! ];

    if( pos == null ){
      return null;
    }

    return pos;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  nodes.layoutPositions( this as unknown as LayoutLike, options as unknown as LayoutOptions, ( function( node: Collection, i: number ){
    let position = getPosition( node );

    if( node.locked() || position == null ){
      return false;
    }

    return position;
  } ) as unknown as LayoutPositionFn ); // fn may return false to skip a node

  return this; // chaining
};

export default PresetLayout;
