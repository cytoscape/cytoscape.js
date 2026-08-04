import * as util from '../util/index.mjs';
import type { Collection, Element } from './eles-types.mjs';

/** Degree calculation methods contributed to the collection prototype. */
export interface CollectionDegree {
  degree( includeLoops?: boolean ): number | undefined;
  indegree( includeLoops?: boolean ): number | undefined;
  outdegree( includeLoops?: boolean ): number | undefined;
  minDegree( includeLoops?: boolean ): number | undefined;
  maxDegree( includeLoops?: boolean ): number | undefined;
  minIndegree( includeLoops?: boolean ): number | undefined;
  maxIndegree( includeLoops?: boolean ): number | undefined;
  minOutdegree( includeLoops?: boolean ): number | undefined;
  maxOutdegree( includeLoops?: boolean ): number | undefined;
  totalDegree( includeLoops?: boolean ): number;
}

type DegreeFnName = 'degree' | 'indegree' | 'outdegree';
type DegreeCallback = ( node: Element, edge: Element ) => number;
type DegreeBoundsCallback = ( degree: number, ret: number ) => boolean;

let elesfn = {} as CollectionDegree;

function defineDegreeFunction( callback: DegreeCallback ){
  return function( this: Collection, includeLoops?: boolean ): number | undefined {
    let self = this; // eslint-disable-line @typescript-eslint/no-this-alias

    if( includeLoops === undefined ){
      includeLoops = true;
    }

    if( self.length === 0 ){ return; }

    if( self.isNode() && !self.removed() ){
      let degree = 0;
      let node = self[0];
      let connectedEdges = node._private.edges;

      for( let i = 0; i < connectedEdges.length; i++ ){
        let edge = connectedEdges[ i ];

        if( !includeLoops && edge.isLoop() ){
          continue;
        }

        degree += callback( node, edge );
      }

      return degree;
    } else {
      return;
    }
  };
}

util.extend( elesfn, {
  degree: defineDegreeFunction( function( node, edge ){
    if( edge.source().same( edge.target() ) ){
      return 2;
    } else {
      return 1;
    }
  } ),

  indegree: defineDegreeFunction( function( node, edge ){
    if( edge.target().same( node ) ){
      return 1;
    } else {
      return 0;
    }
  } ),

  outdegree: defineDegreeFunction( function( node, edge ){
    if( edge.source().same( node ) ){
      return 1;
    } else {
      return 0;
    }
  } )
} );

function defineDegreeBoundsFunction( degreeFn: DegreeFnName, callback: DegreeBoundsCallback ){
  return function( this: Collection, includeLoops?: boolean ): number | undefined {
    let ret: number | undefined;
    let nodes = this.nodes();

    for( let i = 0; i < nodes.length; i++ ){
      let ele = nodes[ i ];
      let degree = ele[ degreeFn ]( includeLoops );
      if( degree !== undefined && (ret === undefined || callback( degree, ret )) ){
        ret = degree;
      }
    }

    return ret;
  };
}

util.extend( elesfn, {
  minDegree: defineDegreeBoundsFunction( 'degree', function( degree, min ){
    return degree < min;
  } ),

  maxDegree: defineDegreeBoundsFunction( 'degree', function( degree, max ){
    return degree > max;
  } ),

  minIndegree: defineDegreeBoundsFunction( 'indegree', function( degree, min ){
    return degree < min;
  } ),

  maxIndegree: defineDegreeBoundsFunction( 'indegree', function( degree, max ){
    return degree > max;
  } ),

  minOutdegree: defineDegreeBoundsFunction( 'outdegree', function( degree, min ){
    return degree < min;
  } ),

  maxOutdegree: defineDegreeBoundsFunction( 'outdegree', function( degree, max ){
    return degree > max;
  } )
} );

util.extend( elesfn, {
  totalDegree: function( this: Collection, includeLoops?: boolean ){
    let total = 0;
    let nodes = this.nodes();

    for( let i = 0; i < nodes.length; i++ ){
      total += nodes[ i ].degree( includeLoops )!;
    }

    return total;
  }
} );

export default elesfn;
