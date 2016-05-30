'use strict';

var is = require( '../../is' );
var util = require( '../../util' );

var elesfn = ({

  // Implemented from pseudocode from wikipedia
  bellmanFord: function( options ){
    var eles = this;

    options = options || {};

    // Weight function - optional
    if( options.weight != null && is.fn( options.weight ) ){
      var weightFn = options.weight;
    } else {
      // If not specified, assume each edge has equal weight (1)
      var weightFn = function( e ){return 1;};
    }

    // directed - optional
    if( options.directed != null ){
      var directed = options.directed;
    } else {
      var directed = false;
    }

    // root - mandatory!
    if( options.root != null ){
      if( is.string( options.root ) ){
        // use it as a selector, e.g. "#rootID
        var source = this.filter( options.root )[0];
      } else {
        var source = options.root[0];
      }
    } else {
      return undefined;
    }

    var cy = this._private.cy;
    var edges = this.edges().stdFilter( function( e ){ return !e.isLoop(); } );
    var nodes = this.nodes();
    var numNodes = nodes.length;

    // mapping: node id -> position in nodes array
    var id2position = {};
    for( var i = 0; i < numNodes; i++ ){
      id2position[ nodes[ i ].id() ] = i;
    }

    // Initializations
    var cost = [];
    var predecessor = [];
    var predEdge = [];

    for( var i = 0; i < numNodes; i++ ){
      if( nodes[ i ].id() === source.id() ){
        cost[ i ] = 0;
      } else {
        cost[ i ] = Infinity;
      }
      predecessor[ i ] = undefined;
    }

    // Edges relaxation
    var flag = false;
    for( var i = 1; i < numNodes; i++ ){
      flag = false;
      for( var e = 0; e < edges.length; e++ ){
        var sourceIndex = id2position[ edges[ e ].source().id() ];
        var targetIndex = id2position[ edges[ e ].target().id() ];
        var weight = weightFn.apply( edges[ e ], [ edges[ e ] ] );

        var temp = cost[ sourceIndex ] + weight;
        if( temp < cost[ targetIndex ] ){
          cost[ targetIndex ] = temp;
          predecessor[ targetIndex ] = sourceIndex;
          predEdge[ targetIndex ] = edges[ e ];
          flag = true;
        }

        // If undirected graph, we need to take into account the 'reverse' edge
        if( !directed ){
          var temp = cost[ targetIndex ] + weight;
          if( temp < cost[ sourceIndex ] ){
            cost[ sourceIndex ] = temp;
            predecessor[ sourceIndex ] = targetIndex;
            predEdge[ sourceIndex ] = edges[ e ];
            flag = true;
          }
        }
      }

      if( !flag ){
        break;
      }
    }

    if( flag ){
      // Check for negative weight cycles
      for( var e = 0; e < edges.length; e++ ){
        var sourceIndex = id2position[ edges[ e ].source().id() ];
        var targetIndex = id2position[ edges[ e ].target().id() ];
        var weight = weightFn.apply( edges[ e ], [ edges[ e ] ] );

        if( cost[ sourceIndex ] + weight < cost[ targetIndex ] ){
          util.error( 'Graph contains a negative weight cycle for Bellman-Ford' );
          return { pathTo: undefined,
               distanceTo: undefined,
               hasNegativeWeightCycle: true};
        }
      }
    }

    // Build result object
    var position2id = [];
    for( var i = 0; i < numNodes; i++ ){
      position2id.push( nodes[ i ].id() );
    }


    var res = {
      distanceTo: function( to ){
        if( is.string( to ) ){
          // to is a selector string
          var toId = (cy.filter( to )[0]).id();
        } else {
          // to is a node
          var toId = to.id();
        }

        return cost[ id2position[ toId ] ];
      },

      pathTo: function( to ){

        var reconstructPathAux = function( predecessor, fromPos, toPos, position2id, acumPath, predEdge ){
          for( ;; ){
            // Add toId to path
            acumPath.push( cy.getElementById( position2id[ toPos ] ) );
            acumPath.push( predEdge[ toPos ] );

            if( fromPos === toPos ){
              // reached starting node
              return acumPath;
            }

            // If no path exists, discart acumulated path and return undefined
            var predPos = predecessor[ toPos ];
            if( typeof predPos === 'undefined' ){
              return undefined;
            }

            toPos = predPos;
          }

        };

        if( is.string( to ) ){
          // to is a selector string
          var toId = (cy.filter( to )[0]).id();
        } else {
          // to is a node
          var toId = to.id();
        }
        var path = [];

        // This returns a reversed path
        var res =  reconstructPathAux( predecessor,
                      id2position[ source.id() ],
                      id2position[ toId ],
                      position2id,
                      path,
                      predEdge );

        // Get it in the correct order and return it
        if( res != null ){
          res.reverse();
        }

        return eles.spawn( res );
      },

      hasNegativeWeightCycle: false
    };

    return res;

  } // bellmanFord

}); // elesfn

module.exports = elesfn;
