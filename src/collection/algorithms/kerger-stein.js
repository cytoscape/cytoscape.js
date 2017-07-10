var util = require( '../../util' );

var elesfn = ({

  // Computes the minimum cut of an undirected graph
  // Returns the correct answer with high probability
  kargerStein: function( options ){
    var eles = this;

    options = options || {};

    // Function which colapses 2 (meta) nodes into one
    // Updates the remaining edge lists
    // Receives as a paramater the edge which causes the collapse
    var colapse = function( edgeIndex, nodeMap, remainingEdges ){
      var edgeInfo = remainingEdges[ edgeIndex ];
      var sourceIn = edgeInfo[1];
      var targetIn = edgeInfo[2];
      var partition1 = nodeMap[ sourceIn ];
      var partition2 = nodeMap[ targetIn ];

      // Delete all edges between partition1 and partition2
      var newEdges = remainingEdges.filter( function( edge ){
        if( nodeMap[ edge[1] ] === partition1 && nodeMap[ edge[2] ] === partition2 ){
          return false;
        }
        if( nodeMap[ edge[1] ] === partition2 && nodeMap[ edge[2] ] === partition1 ){
          return false;
        }
        return true;
      } );

      // All edges pointing to partition2 should now point to partition1
      for( var i = 0; i < newEdges.length; i++ ){
        var edge = newEdges[ i ];
        if( edge[1] === partition2 ){ // Check source
          newEdges[ i ] = edge.slice( 0 );
          newEdges[ i ][1] = partition1;
        } else if( edge[2] === partition2 ){ // Check target
          newEdges[ i ] = edge.slice( 0 );
          newEdges[ i ][2] = partition1;
        }
      }

      // Move all nodes from partition2 to partition1
      for( var i = 0; i < nodeMap.length; i++ ){
        if( nodeMap[ i ] === partition2 ){
          nodeMap[ i ] = partition1;
        }
      }

      return newEdges;
    };


    // Contracts a graph until we reach a certain number of meta nodes
    var contractUntil = function( metaNodeMap,
                   remainingEdges,
                   size,
                   sizeLimit ){
      // Stop condition
      if( size <= sizeLimit ){
        return remainingEdges;
      }

      // Choose an edge randomly
      var edgeIndex = Math.floor( (Math.random() * remainingEdges.length) );

      // Colapse graph based on edge
      var newEdges = colapse( edgeIndex, metaNodeMap, remainingEdges );

      return contractUntil( metaNodeMap,
                 newEdges,
                 size - 1,
                 sizeLimit );
    };

    var cy = this._private.cy;
    var edges = this.edges().stdFilter( function( e ){ return !e.isLoop(); } );
    var nodes = this.nodes();
    var numNodes = nodes.length;
    var numEdges = edges.length;
    var numIter = Math.ceil( Math.pow( Math.log( numNodes ) / Math.LN2, 2 ) );
    var stopSize = Math.floor( numNodes / Math.sqrt( 2 ) );

    if( numNodes < 2 ){
      util.error( 'At least 2 nodes are required for Karger-Stein algorithm' );
      return undefined;
    }

    // Create numerical identifiers for each node
    // mapping: node id -> position in nodes array
    // for reverse mapping, simply use nodes array
    var id2position = {};
    for( var i = 0; i < numNodes; i++ ){
      id2position[ nodes[ i ].id() ] = i;
    }

    // Now store edge destination as indexes
    // Format for each edge (edge index, source node index, target node index)
    var edgeIndexes = [];
    for( var i = 0; i < numEdges; i++ ){
      var e = edges[ i ];
      edgeIndexes.push( [ i, id2position[ e.source().id() ], id2position[ e.target().id() ] ] );
    }

    // We will store the best cut found here
    var minCutSize = Infinity;
    var minCut;

    // Initial meta node partition
    var originalMetaNode = [];
    for( var i = 0; i < numNodes; i++ ){
      originalMetaNode.push( i );
    }

    // Main loop
    for( var iter = 0; iter <= numIter; iter++ ){
      // Create new meta node partition
      var metaNodeMap = originalMetaNode.slice( 0 );

      // Contract until stop point (stopSize nodes)
      var edgesState = contractUntil( metaNodeMap, edgeIndexes, numNodes, stopSize );

      // Create a copy of the colapsed nodes state
      var metaNodeMap2 = metaNodeMap.slice( 0 );

      // Run 2 iterations starting in the stop state
      var res1 = contractUntil( metaNodeMap, edgesState, stopSize, 2 );
      var res2 = contractUntil( metaNodeMap2, edgesState, stopSize, 2 );

      // Is any of the 2 results the best cut so far?
      if( res1.length <= res2.length && res1.length < minCutSize ){
        minCutSize = res1.length;
        minCut = [ res1, metaNodeMap ];
      } else if( res2.length <= res1.length && res2.length < minCutSize ){
        minCutSize = res2.length;
        minCut = [ res2, metaNodeMap2 ];
      }
    } // end of main loop


    // Construct result
    var resEdges = (minCut[0]).map( function( e ){ return edges[ e[0] ]; } );
    var partition1 = [];
    var partition2 = [];

    // traverse metaNodeMap for best cut
    var witnessNodePartition = minCut[1][0];
    for( var i = 0; i < minCut[1].length; i++ ){
      var partitionId = minCut[1][ i ];
      if( partitionId === witnessNodePartition ){
        partition1.push( nodes[ i ] );
      } else {
        partition2.push( nodes[ i ] );
      }
    }

    var ret = {
      cut: eles.spawn( cy, resEdges ),
      partition1: eles.spawn( partition1 ),
      partition2: eles.spawn( partition2 )
    };

    return ret;
  }
}); // elesfn


module.exports = elesfn;
