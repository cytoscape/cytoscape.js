'use strict';

var is = require( '../../is' );

var elesfn = ({

  pageRank: function( options ){
    options = options || {};

    var normalizeVector = function( vector ){
      var length = vector.length;

      // First, get sum of all elements
      var total = 0;
      for( var i = 0; i < length; i++ ){
        total += vector[ i ];
      }

      // Now, divide each by the sum of all elements
      for( var i = 0; i < length; i++ ){
        vector[ i ] = vector[ i ] / total;
      }
    };

    // dampingFactor - optional
    if( options != null &&
      options.dampingFactor != null ){
      var dampingFactor = options.dampingFactor;
    } else {
      var dampingFactor = 0.8; // Default damping factor
    }

    // desired precision - optional
    if( options != null &&
      options.precision != null ){
      var epsilon = options.precision;
    } else {
      var epsilon = 0.000001; // Default precision
    }

    // Max number of iterations - optional
    if( options != null &&
      options.iterations != null ){
      var numIter = options.iterations;
    } else {
      var numIter = 200; // Default number of iterations
    }

    // Weight function - optional
    if( options != null &&
      options.weight != null &&
      is.fn( options.weight ) ){
      var weightFn = options.weight;
    } else {
      // If not specified, assume each edge has equal weight (1)
      var weightFn = function( e ){return 1;};
    }

    var cy = this._private.cy;
    var edges = this.edges().stdFilter( function( e ){ return !e.isLoop(); } );
    var nodes = this.nodes();
    var numNodes = nodes.length;
    var numEdges = edges.length;

    // Create numerical identifiers for each node
    // mapping: node id -> position in nodes array
    // for reverse mapping, simply use nodes array
    var id2position = {};
    for( var i = 0; i < numNodes; i++ ){
      id2position[ nodes[ i ].id() ] = i;
    }

    // Construct transposed adjacency matrix
    // First lets have a zeroed matrix of the right size
    // We'll also keep track of the sum of each column
    var matrix = [];
    var columnSum = [];
    var additionalProb = (1 - dampingFactor) / numNodes;

    // Create null matric
    for( var i = 0; i < numNodes; i++ ){
      var newRow = [];
      for( var j = 0; j < numNodes; j++ ){
        newRow.push( 0.0 );
      }
      matrix.push( newRow );
      columnSum.push( 0.0 );
    }

    // Now, process edges
    for( var i = 0; i < numEdges; i++ ){
      var edge = edges[ i ];
      var s = id2position[ edge.source().id() ];
      var t = id2position[ edge.target().id() ];
      var w = weightFn.apply( edge, [ edge ] );

      // Update matrix
      matrix[ t ][ s ] += w;

      // Update column sum
      columnSum[ s ] += w;
    }

    // Add additional probability based on damping factor
    // Also, take into account columns that have sum = 0
    var p = 1.0 / numNodes + additionalProb; // Shorthand
    // Traverse matrix, column by column
    for( var j = 0; j < numNodes; j++ ){
      if( columnSum[ j ] === 0 ){
        // No 'links' out from node jth, assume equal probability for each possible node
        for( var i = 0; i < numNodes; i++ ){
          matrix[ i ][ j ] = p;
        }
      } else {
        // Node jth has outgoing link, compute normalized probabilities
        for( var i = 0; i < numNodes; i++ ){
          matrix[ i ][ j ] = matrix[ i ][ j ] / columnSum[ j ] + additionalProb;
        }
      }
    }

    // Compute dominant eigenvector using power method
    var eigenvector = [];
    var nullVector = [];
    var previous;

    // Start with a vector of all 1's
    // Also, initialize a null vector which will be used as shorthand
    for( var i = 0; i < numNodes; i++ ){
      eigenvector.push( 1.0 );
      nullVector.push( 0.0 );
    }

    for( var iter = 0; iter < numIter; iter++ ){
      // New array with all 0's
      var temp = nullVector.slice( 0 );

      // Multiply matrix with previous result
      for( var i = 0; i < numNodes; i++ ){
        for( var j = 0; j < numNodes; j++ ){
          temp[ i ] += matrix[ i ][ j ] * eigenvector[ j ];
        }
      }

      normalizeVector( temp );
      previous = eigenvector;
      eigenvector = temp;

      var diff = 0;
      // Compute difference (squared module) of both vectors
      for( var i = 0; i < numNodes; i++ ){
        diff += Math.pow( previous[ i ] - eigenvector[ i ], 2 );
      }

      // If difference is less than the desired threshold, stop iterating
      if( diff < epsilon ){
        break;
      }
    }

    // Construct result
    var res = {
      rank: function( node ){
        if( is.string( node ) ){
          // is a selector string
          var nodeId = (cy.filter( node )[0]).id();
        } else {
          // is a node object
          var nodeId = node.id();
        }
        return eigenvector[ id2position[ nodeId ] ];
      }
    };


    return res;
  } // pageRank

}); // elesfn

module.exports = elesfn;
