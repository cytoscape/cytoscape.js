var is = require( '../../is' );

var elesfn = ({

  // Implemented from pseudocode from wikipedia
  floydWarshall: function( options ){
    options = options || {};

    var cy = this.cy();

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

    var edges = this.edges().stdFilter( function( e ){ return !e.isLoop(); } );
    var nodes = this.nodes();
    var numNodes = nodes.length;

    // mapping: node id -> position in nodes array
    var id2position = {};
    for( var i = 0; i < numNodes; i++ ){
      id2position[ nodes[ i ].id() ] = i;
    }

    // Initialize distance matrix
    var dist = [];
    for( var i = 0; i < numNodes; i++ ){
      var newRow = new Array( numNodes );
      for( var j = 0; j < numNodes; j++ ){
        if( i == j ){
          newRow[ j ] = 0;
        } else {
          newRow[ j ] = Infinity;
        }
      }
      dist.push( newRow );
    }

    // Initialize matrix used for path reconstruction
    // Initialize distance matrix
    var next = [];
    var edgeNext = [];

    var initMatrix = function( next ){
      for( var i = 0; i < numNodes; i++ ){
        var newRow = new Array( numNodes );
        for( var j = 0; j < numNodes; j++ ){
          newRow[ j ] = undefined;
        }
        next.push( newRow );
      }
    };

    initMatrix( next );
    initMatrix( edgeNext );

    // Process edges
    for( var i = 0; i < edges.length ; i++ ){
      var sourceIndex = id2position[ edges[ i ].source().id() ];
      var targetIndex = id2position[ edges[ i ].target().id() ];
      var weight = weightFn( edges[ i ] );

      // Check if already process another edge between same 2 nodes
      if( dist[ sourceIndex ][ targetIndex ] > weight ){
        dist[ sourceIndex ][ targetIndex ] = weight;
        next[ sourceIndex ][ targetIndex ] = targetIndex;
        edgeNext[ sourceIndex ][ targetIndex ] = edges[ i ];
      }
    }

    // If undirected graph, process 'reversed' edges
    if( !directed ){
      for( var i = 0; i < edges.length ; i++ ){
        var sourceIndex = id2position[ edges[ i ].target().id() ];
        var targetIndex = id2position[ edges[ i ].source().id() ];
        var weight = weightFn( edges[ i ] );

        // Check if already process another edge between same 2 nodes
        if( dist[ sourceIndex ][ targetIndex ] > weight ){
          dist[ sourceIndex ][ targetIndex ] = weight;
          next[ sourceIndex ][ targetIndex ] = targetIndex;
          edgeNext[ sourceIndex ][ targetIndex ] = edges[ i ];
        }
      }
    }

    // Main loop
    for( var k = 0; k < numNodes; k++ ){
      for( var i = 0; i < numNodes; i++ ){
        for( var j = 0; j < numNodes; j++ ){
          if( dist[ i ][ k ] + dist[ k ][ j ] < dist[ i ][ j ] ){
            dist[ i ][ j ] = dist[ i ][ k ] + dist[ k ][ j ];
            next[ i ][ j ] = next[ i ][ k ];
          }
        }
      }
    }

    // Build result object
    var position2id = [];
    for( var i = 0; i < numNodes; i++ ){
      position2id.push( nodes[ i ].id() );
    }

    var res = {
      distance: function( from, to ){
        if( is.string( from ) ){
          // from is a selector string
          var fromId = (cy.filter( from )[0]).id();
        } else {
          // from is a node
          var fromId = from.id();
        }

        if( is.string( to ) ){
          // to is a selector string
          var toId = (cy.filter( to )[0]).id();
        } else {
          // to is a node
          var toId = to.id();
        }

        return dist[ id2position[ fromId ] ][ id2position[ toId ] ];
      },

      path: function( from, to ){
        var reconstructPathAux = function( from, to, next, position2id, edgeNext ){
          if( from === to ){
            return cy.getElementById( position2id[ from ] );
          }
          if( next[ from ][ to ] === undefined ){
            return undefined;
          }

          var path = [ cy.getElementById( position2id[ from ] ) ];
          var prev = from;
          while( from !== to ){
            prev = from;
            from = next[ from ][ to ];

            var edge = edgeNext[ prev ][ from ];
            path.push( edge );

            path.push( cy.getElementById( position2id[ from ] ) );
          }
          return path;
        };

        if( is.string( from ) ){
          // from is a selector string
          var fromId = (cy.filter( from )[0]).id();
        } else {
          // from is a node
          var fromId = from.id();
        }

        if( is.string( to ) ){
          // to is a selector string
          var toId = (cy.filter( to )[0]).id();
        } else {
          // to is a node
          var toId = to.id();
        }

        var pathArr = reconstructPathAux( id2position[ fromId ],
                      id2position[ toId ],
                      next,
                      position2id,
                      edgeNext );

        return cy.collection( pathArr );
      }
    };

    return res;

  } // floydWarshall

}); // elesfn

module.exports = elesfn;
