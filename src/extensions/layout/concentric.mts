import * as util from '../../util/index.mjs';
import * as math from '../../math.mjs';
import type { LayoutBase, LayoutOptionsBase, Collection } from './layout-base.mjs';
import type { LayoutLike, LayoutOptions } from '../../collection/layout.mjs';
import type { ElementPrivate } from '../../collection/eles-types.mjs';
import type { BoundingBox, Position } from '../../types.mjs';

/** Options accepted by the concentric layout. */
export interface ConcentricLayoutOptions extends LayoutOptionsBase {
  fit?: boolean;
  padding?: number;
  startAngle?: number;
  sweep?: number;
  clockwise?: boolean;
  counterclockwise?: boolean;
  equidistant?: boolean;
  minNodeSpacing?: number;
  avoidOverlap?: boolean;
  nodeDimensionsIncludeLabels?: boolean;
  height?: number;
  width?: number;
  spacingFactor?: number;
  concentric?: ( node: Collection ) => number;
  levelWidth?: ( nodes: Collection ) => number;
}

/** The concentric layout instance (`this`). */
export interface ConcentricLayout extends LayoutBase {
  options: ConcentricLayoutOptions;
}

/** A value paired with its node, as binned into concentric levels. */
interface NodeValue {
  value: number;
  node: Collection;
}

/** A concentric level: an array of node values with derived metrics. */
type Level = NodeValue[] & { dTheta?: number; r?: number };

/* eslint-disable @typescript-eslint/no-unused-vars */
let defaults = {
  fit: true, // whether to fit the viewport to the graph
  padding: 30, // the padding on fit
  startAngle: 3 / 2 * Math.PI, // where nodes start in radians
  sweep: undefined, // how many radians should be between the first and last node (defaults to full circle)
  clockwise: true, // whether the layout should go clockwise (true) or counterclockwise/anticlockwise (false)
  equidistant: false, // whether levels have an equal radial distance betwen them, may cause bounding box overflow
  minNodeSpacing: 10, // min spacing between outside of nodes (used for radius adjustment)
  boundingBox: undefined, // constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
  avoidOverlap: true, // prevents node overlap, may overflow boundingBox if not enough space
  nodeDimensionsIncludeLabels: false, // Excludes the label when calculating node bounding boxes for the layout algorithm
  height: undefined, // height of layout area (overrides container height)
  width: undefined, // width of layout area (overrides container width)
  spacingFactor: undefined, // Applies a multiplicative factor (>0) to expand or compress the overall area that the nodes take up
  concentric: function( node: Collection ){ // returns numeric value for each node, placing higher nodes in levels towards the centre
    return node.degree()!;
  },
  levelWidth: function( nodes: Collection ){ // the variation of concentric values in each level
    return nodes.maxDegree()! / 4;
  },
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
function ConcentricLayout( this: ConcentricLayout, options: ConcentricLayoutOptions ){
  this.options = util.extend( {}, defaults, options ) as ConcentricLayoutOptions;
}

ConcentricLayout.prototype.run = function( this: ConcentricLayout ){
  let params = this.options;
  let options = params;

  let clockwise = options.counterclockwise !== undefined ? !options.counterclockwise : options.clockwise;

  let cy = params.cy;

  let eles = options.eles;
  let nodes = eles.nodes().not( ':parent' );

  let bb = math.makeBoundingBox( options.boundingBox ? options.boundingBox : {
    x1: 0, y1: 0, w: cy.width(), h: cy.height()
  } ) as BoundingBox; // input always yields a valid bounding box

  let center = {
    x: bb.x1 + bb.w / 2,
    y: bb.y1 + bb.h / 2
  };

  let nodeValues: NodeValue[] = []; // { node, value }
  let maxNodeSize = 0;

  for( let i = 0; i < nodes.length; i++ ){
    let node = nodes[ i ];
    let value;

    // calculate the node value
    value = options.concentric!( node );
    nodeValues.push( {
      value: value,
      node: node
    } );

    // for style mapping
    ( node._private as ElementPrivate ).scratch.concentric = value;
  }

  // in case we used the `concentric` in style
  nodes.updateStyle();

  // calculate max size now based on potentially updated mappers
  for( let i = 0; i < nodes.length; i++ ){
    let node = nodes[ i ];
    let nbb = node.layoutDimensions( options );

    maxNodeSize = Math.max( maxNodeSize, nbb.w, nbb.h );
  }

  // sort node values in descreasing order
  nodeValues.sort( function( a, b ){
    return b.value - a.value;
  } );

  let levelWidth = options.levelWidth!( nodes );

  // put the values into levels
  let levels: Level[] = [ [] ];
  let currentLevel = levels[0];
  for( let i = 0; i < nodeValues.length; i++ ){
    let val = nodeValues[ i ];

    if( currentLevel.length > 0 ){
      let diff = Math.abs( currentLevel[0].value - val.value );

      if( diff >= levelWidth ){
        currentLevel = [];
        levels.push( currentLevel );
      }
    }

    currentLevel.push( val );
  }

  // create positions from levels

  let minDist = maxNodeSize + options.minNodeSpacing!; // min dist between nodes

  if( !options.avoidOverlap ){ // then strictly constrain to bb
    let firstLvlHasMulti = levels.length > 0 && levels[0].length > 1;
    let maxR = ( Math.min( bb.w, bb.h ) / 2 - minDist );
    let rStep = maxR / ( levels.length + ( firstLvlHasMulti as unknown as number ) ? 1 : 0 ); // preserve JS boolean->number coercion

    minDist = Math.min( minDist, rStep );
  }

  // find the metrics for each level
  let r = 0;
  for( let i = 0; i < levels.length; i++ ){
    let level = levels[ i ];
    let sweep = options.sweep === undefined ? 2 * Math.PI - 2 * Math.PI / level.length : options.sweep;
    let dTheta = level.dTheta = sweep / ( Math.max( 1, level.length - 1 ) );

    // calculate the radius
    if( level.length > 1 && options.avoidOverlap ){ // but only if more than one node (can't overlap)
      let dcos = Math.cos( dTheta ) - Math.cos( 0 );
      let dsin = Math.sin( dTheta ) - Math.sin( 0 );
      let rMin = Math.sqrt( minDist * minDist / ( dcos * dcos + dsin * dsin ) ); // s.t. no nodes overlapping

      r = Math.max( rMin, r );
    }

    level.r = r;

    r += minDist;
  }

  if( options.equidistant ){
    let rDeltaMax = 0;
    let r = 0;

    for( let i = 0; i < levels.length; i++ ){
      let level = levels[ i ];
      let rDelta = level.r! - r;

      rDeltaMax = Math.max( rDeltaMax, rDelta );
    }

    r = 0;
    for( let i = 0; i < levels.length; i++ ){
      let level = levels[ i ];

      if( i === 0 ){
        r = level.r!;
      }

      level.r = r;

      r += rDeltaMax;
    }
  }

  // calculate the node positions
  let pos: Record<string, Position> = {}; // id => position
  for( let i = 0; i < levels.length; i++ ){
    let level = levels[ i ];
    let dTheta = level.dTheta!;
    let r = level.r!;

    for( let j = 0; j < level.length; j++ ){
      let val = level[ j ];
      let theta = options.startAngle! + (clockwise ? 1 : -1) * dTheta * j;

      let p = {
        x: center.x + r * Math.cos( theta ),
        y: center.y + r * Math.sin( theta )
      };

      pos[ val.node.id()! ] = p;
    }
  }

  // position the nodes
  eles.nodes().layoutPositions( this as unknown as LayoutLike, options as unknown as LayoutOptions, function( ele ){
    let id = ele.id()!;

    return pos[ id ];
  } );

  return this; // chaining
};

export default ConcentricLayout;
