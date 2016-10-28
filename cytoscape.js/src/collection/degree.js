'use strict';

var util = require( '../util' );

var elesfn = {};

function defineDegreeFunction( callback ){
  return function( includeLoops ){
    var self = this;

    if( includeLoops === undefined ){
      includeLoops = true;
    }

    if( self.length === 0 ){ return; }

    if( self.isNode() && !self.removed() ){
      var degree = 0;
      var node = self[0];
      var connectedEdges = node._private.edges;

      for( var i = 0; i < connectedEdges.length; i++ ){
        var edge = connectedEdges[ i ];

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

function defineDegreeBoundsFunction( degreeFn, callback ){
  return function( includeLoops ){
    var ret;
    var nodes = this.nodes();

    for( var i = 0; i < nodes.length; i++ ){
      var ele = nodes[ i ];
      var degree = ele[ degreeFn ]( includeLoops );
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
    var total = 0;
    var nodes = this.nodes();

    for( var i = 0; i < nodes.length; i++ ){
      total += nodes[ i ].degree( includeLoops );
    }

    return total;
  }
} );

module.exports = elesfn;
