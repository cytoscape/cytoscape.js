import * as util from '../util';

let elesfn = {};

function defineDegreeFunction( callback ){
  return function( includeLoops ){
    let self = this;

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
  /**
 * @typedef {object} node_degree
 * @property {object} includeLoops - A boolean, indicating whether loops are to be included in degree calculations.
 * @property {object} includeLoops - A boolean, indicating whether loops are to be included in degree calculations.
 * @property {object} includeLoops - A boolean, indicating whether loops are to be included in degree calculations.
 * @property {object} includeLoops - A boolean, indicating whether loops are to be included in degree calculations.
 * @property {object} includeLoops - A boolean, indicating whether loops are to be included in degree calculations.
 * @property {object} includeLoops - A boolean, indicating whether loops are to be included in degree calculations.
 * @property {object} includeLoops - A boolean, indicating whether loops are to be included in degree calculations.
 * @property {object} includeLoops - A boolean, indicating whether loops are to be included in degree calculations.
 * @property {object} includeLoops - A boolean, indicating whether loops are to be included in degree calculations.
 * @property {object} includeLoops - A boolean, indicating whether loops are to be included in degree calculations.
 */

  /**
 * Get the degree of a node.
 * @memberof node
 * @path Collection/Metadata
 * @sub_functions node.degree|node.indegree|node.outdegree|nodes.totalDegree|nodes.minDegree|nodes.maxDegree|nodes.minIndegree|nodes.maxIndegree|nodes.minOutdegree|nodes.maxOutdegree
 * @param {...node_degree} node - Get the degree of a node. | Get the indegree of a node. | Get the outdegree of a node. | Get the total degree of a collection of nodes. | Get the minimum degree of the nodes in the collection. | Get the maximum degree of the nodes in the collection. | Get the minimum indegree of the nodes in the collection. | Get the maximum indegree of the nodes in the collection. | Get the minimum outdegree of the nodes in the collection. | Get the maximum outdegree of the nodes in the collection.
 * @methodName node.degree
 */
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

function defineDegreeBoundsFunction( degreeFn, callback ){
  return function( includeLoops ){
    let ret;
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
  totalDegree: function( includeLoops ){
    let total = 0;
    let nodes = this.nodes();

    for( let i = 0; i < nodes.length; i++ ){
      total += nodes[ i ].degree( includeLoops );
    }

    return total;
  }
} );

export default elesfn;
