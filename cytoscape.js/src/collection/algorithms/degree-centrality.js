'use strict';

var is = require( '../../is' );
var util = require( '../../util' );

var elesfn = ({

  degreeCentralityNormalized: function( options ){
    options = options || {};

    var cy = this.cy();

    // directed - optional
    if( options.directed != null ){
      var directed = options.directed;
    } else {
      var directed = false;
    }

    var nodes = this.nodes();
    var numNodes = nodes.length;

    if( !directed ){
      var degrees = {};
      var maxDegree = 0;

      for( var i = 0; i < numNodes; i++ ){
        var node = nodes[ i ];
        // add current node to the current options object and call degreeCentrality
        var currDegree = this.degreeCentrality( util.extend( {}, options, {root: node} ) );
        if( maxDegree < currDegree.degree )
          maxDegree = currDegree.degree;

        degrees[ node.id() ] = currDegree.degree;
      }

      return {
        degree: function( node ){
          if( is.string( node ) ){
            // from is a selector string
            var node = (cy.filter( node )[0]).id();
          } else {
            // from is a node
            var node = node.id();
          }

          return degrees[ node ] / maxDegree;
        }
      };
    } else {
      var indegrees = {};
      var outdegrees = {};
      var maxIndegree = 0;
      var maxOutdegree = 0;

      for( var i = 0; i < numNodes; i++ ){
        var node = nodes[ i ];
        // add current node to the current options object and call degreeCentrality
        var currDegree = this.degreeCentrality( util.extend( {}, options, {root: node} ) );

        if( maxIndegree < currDegree.indegree )
          maxIndegree = currDegree.indegree;

        if( maxOutdegree < currDegree.outdegree )
          maxOutdegree = currDegree.outdegree;

        indegrees[ node.id() ] = currDegree.indegree;
        outdegrees[ node.id() ] = currDegree.outdegree;
      }

      return {
        indegree: function( node ){
          if( is.string( node ) ){
            // from is a selector string
            var node = (cy.filter( node )[0]).id();
          } else {
            // from is a node
            var node = node.id();
          }

          return indegrees[ node ] / maxIndegree;
        },
        outdegree: function( node ){
          if( is.string( node ) ){
            // from is a selector string
            var node = (cy.filter( node )[0]).id();
          } else {
            // from is a node
            var node = node.id();
          }

          return outdegrees[ node ] / maxOutdegree;
        }

      };
    }

  }, // degreeCentralityNormalized

  // Implemented from the algorithm in Opsahl's paper
  // "Node centrality in weighted networks: Generalizing degree and shortest paths"
  // check the heading 2 "Degree"
  degreeCentrality: function( options ){
    options = options || {};

    var callingEles = this;

    // root - mandatory!
    if( options != null && options.root != null ){
      var root = is.string( options.root ) ? this.filter( options.root )[0] : options.root[0];
    } else {
      return undefined;
    }

    // weight - optional
    if( options.weight != null && is.fn( options.weight ) ){
      var weightFn = options.weight;
    } else {
      // If not specified, assume each edge has equal weight (1)
      var weightFn = function( e ){
        return 1;
      };
    }

    // directed - optional
    if( options.directed != null ){
      var directed = options.directed;
    } else {
      var directed = false;
    }

    // alpha - optional
    if( options.alpha != null && is.number( options.alpha ) ){
      var alpha = options.alpha;
    } else {
      alpha = 0;
    }


    if( !directed ){
      var connEdges = root.connectedEdges().intersection( callingEles );
      var k = connEdges.length;
      var s = 0;

      // Now, sum edge weights
      for( var i = 0; i < connEdges.length; i++ ){
        var edge = connEdges[ i ];
        s += weightFn.apply( edge, [ edge ] );
      }

      return {
        degree: Math.pow( k, 1 - alpha ) * Math.pow( s, alpha )
      };
    } else {
      var incoming = root.connectedEdges( 'edge[target = "' + root.id() + '"]' ).intersection( callingEles );
      var outgoing = root.connectedEdges( 'edge[source = "' + root.id() + '"]' ).intersection( callingEles );
      var k_in = incoming.length;
      var k_out = outgoing.length;
      var s_in = 0;
      var s_out = 0;

      // Now, sum incoming edge weights
      for( var i = 0; i < incoming.length; i++ ){
        var edge = incoming[ i ];
        s_in += weightFn.apply( edge, [ edge ] );
      }

      // Now, sum outgoing edge weights
      for( var i = 0; i < outgoing.length; i++ ){
        var edge = outgoing[ i ];
        s_out += weightFn.apply( edge, [ edge ] );
      }

      return {
        indegree: Math.pow( k_in, 1 - alpha ) * Math.pow( s_in, alpha ),
        outdegree: Math.pow( k_out, 1 - alpha ) * Math.pow( s_out, alpha )
      };
    }
  } // degreeCentrality

}); // elesfn

// nice, short mathemathical alias
elesfn.dc = elesfn.degreeCentrality;
elesfn.dcn = elesfn.degreeCentralityNormalised = elesfn.degreeCentralityNormalized;

module.exports = elesfn;
