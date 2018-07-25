import * as is from '../../is';
import { defaults } from '../../util';

const floydWarshallDefaults = defaults({
  weight: edge => 1,
  directed: false
});

let elesfn = ({

  // Implemented from pseudocode from wikipedia
  floydWarshall: function( options ){
    let cy = this.cy();

    let { weight, directed } = floydWarshallDefaults(options);
    let weightFn = weight;

    let { nodes, edges } = this.byGroup();
    edges.filter( e => !e.isLoop() );

    let numNodes = nodes.length;

    let indexOf = node => nodes.indexOf(node);
    let atIndex = i => nodes[i];

    // Initialize distance matrix
    let dist = [];
    for( let i = 0; i < numNodes; i++ ){
      let newRow = new Array( numNodes );
      for( let j = 0; j < numNodes; j++ ){
        if( i === j ){
          newRow[ j ] = 0;
        } else {
          newRow[ j ] = Infinity;
        }
      }
      dist.push( newRow );
    }

    // Initialize matrix used for path reconstruction
    // Initialize distance matrix
    let next = [];
    let edgeNext = [];

    let initMatrix = function( next ){
      for( let i = 0; i < numNodes; i++ ){
        let newRow = new Array( numNodes );

        for( let j = 0; j < numNodes; j++ ){
          newRow[ j ] = undefined;
        }

        next.push( newRow );
      }
    };

    initMatrix( next );
    initMatrix( edgeNext );

    // Process edges
    for( let i = 0; i < edges.length; i++ ){
      let edge = edges[i];
      let s = indexOf( edge.source() );
      let t = indexOf( edge.target() );
      let weight = weightFn( edge );

      // Check if already process another edge between same 2 nodes
      if( dist[s][t] > weight ){
        dist[s][t] = weight;
        next[s][t] = t;
        edgeNext[s][t] = edge;
      }

      // If undirected graph, process 'reversed' edge
      if( !directed && dist[t][s] > weight ){
        dist[t][s] = weight;
        next[t][s] = s;
        edgeNext[t][s] = edge;
      }
    }

    // Main loop
    for( let k = 0; k < numNodes; k++ ){
      for( let i = 0; i < numNodes; i++ ){
        for( let j = 0; j < numNodes; j++ ){
          if( dist[i][k] + dist[k][j] < dist[i][j] ){
            dist[i][j] = dist[i][k] + dist[k][j];
            next[i][j] = next[i][k];
          }
        }
      }
    }

    let getArgEle = ele => ( is.string(ele) ? cy.filter(ele) : ele )[0];

    let res = {
      distance: function( from, to ){
        from = getArgEle(from);
        to = getArgEle(to);

        return dist[ indexOf(from) ][ indexOf(to) ];
      },

      path: function( from, to ){
        from = getArgEle(from);
        to = getArgEle(to);

        let i = indexOf(from);
        let j = indexOf(to);
        let fromNode = atIndex(i);

        if( i === j ){ return fromNode.collection(); }

        if( next[i][j] == null ){ return cy.collection(); }

        let path = cy.collection();
        let prev = i;
        let edge;

        path.merge( fromNode );

        while( i !== j ){
          prev = i;
          i = next[i][j];
          edge = edgeNext[prev][i];

          path.merge( edge );
          path.merge( atIndex(i) );
        }

        return path;
      }
    };

    return res;

  } // floydWarshall

}); // elesfn

export default elesfn;
