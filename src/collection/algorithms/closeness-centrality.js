'use strict';

var is = require( '../../is' );

var elesfn = ({

  closenessCentralityNormalized: function( options ){
    options = options || {};

    var cy = this.cy();

    var harmonic = options.harmonic;
    if( harmonic === undefined ){
      harmonic = true;
    }

    var closenesses = {};
    var maxCloseness = 0;
    var nodes = this.nodes();
    var fw = this.floydWarshall( { weight: options.weight, directed: options.directed } );

    // Compute closeness for every node and find the maximum closeness
    for( var i = 0; i < nodes.length; i++ ){
      var currCloseness = 0;
      for( var j = 0; j < nodes.length; j++ ){
        if( i != j ){
          var d = fw.distance( nodes[ i ], nodes[ j ] );

          if( harmonic ){
            currCloseness += 1 / d;
          } else {
            currCloseness += d;
          }
        }
      }

      if( !harmonic ){
        currCloseness = 1 / currCloseness;
      }

      if( maxCloseness < currCloseness ){
        maxCloseness = currCloseness;
      }

      closenesses[ nodes[ i ].id() ] = currCloseness;
    }

    return {
      closeness: function( node ){
        if( is.string( node ) ){
          // from is a selector string
          var node = (cy.filter( node )[0]).id();
        } else {
          // from is a node
          var node = node.id();
        }

        return closenesses[ node ] / maxCloseness;
      }
    };
  },

  // Implemented from pseudocode from wikipedia
  closenessCentrality: function( options ){
    options = options || {};

    // root - mandatory!
    if( options.root != null ){
      if( is.string( options.root ) ){
        // use it as a selector, e.g. "#rootID
        var root = this.filter( options.root )[0];
      } else {
        var root = options.root[0];
      }
    } else {
      return undefined;
    }

    // weight - optional
    if( options.weight != null && is.fn( options.weight ) ){
      var weight = options.weight;
    } else {
      var weight = function(){return 1;};
    }

    // directed - optional
    if( options.directed != null && is.bool( options.directed ) ){
      var directed = options.directed;
    } else {
      var directed = false;
    }

    var harmonic = options.harmonic;
    if( harmonic === undefined ){
      harmonic = true;
    }

    // we need distance from this node to every other node
    var dijkstra = this.dijkstra( {
      root: root,
      weight: weight,
      directed: directed
    } );
    var totalDistance = 0;

    var nodes = this.nodes();
    for( var i = 0; i < nodes.length; i++ ){
      if( nodes[ i ].id() != root.id() ){
        var d = dijkstra.distanceTo( nodes[ i ] );

        if( harmonic ){
          totalDistance += 1 / d;
        } else {
          totalDistance += d;
        }
      }
    }

    return harmonic ? totalDistance : 1 / totalDistance;
  } // closenessCentrality

}); // elesfn

// nice, short mathemathical alias
elesfn.cc = elesfn.closenessCentrality;
elesfn.ccn = elesfn.closenessCentralityNormalised = elesfn.closenessCentralityNormalized;

module.exports = elesfn;
