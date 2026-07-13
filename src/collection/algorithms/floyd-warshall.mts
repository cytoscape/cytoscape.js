import * as is from '../../is.mjs';
import { defaults } from '../../util/index.mjs';
import type { Collection, Element, SharedCollection } from '../eles-types.mjs';

/** Edge weighting function. */
export type FloydWarshallWeightFn = ( edge: Element ) => number;

/** Options accepted by `floydWarshall`. */
export interface FloydWarshallOptions {
  weight?: FloydWarshallWeightFn;
  directed?: boolean;
}

/** Result of `floydWarshall`: all-pairs distance/path lookups. */
export interface FloydWarshallResult {
  distance( from: SharedCollection | string, to: SharedCollection | string ): number;
  path( from: SharedCollection | string, to: SharedCollection | string ): Collection;
}

export interface AlgorithmsFloydWarshall {
  floydWarshall( this: SharedCollection, options?: FloydWarshallOptions ): FloydWarshallResult;
}

const floydWarshallDefaults = defaults({
  weight: ( ( _edge: Element ) => 1 ) as FloydWarshallWeightFn,
  directed: false
});

let elesfn = ({

  // Implemented from pseudocode from wikipedia
  floydWarshall: function( this: SharedCollection, options?: FloydWarshallOptions ): FloydWarshallResult {
    let cy = this.cy();

    let { weight, directed } = floydWarshallDefaults(options);
    let weightFn = weight;

    let { nodes, edges } = this.byGroup();

    let N = nodes.length;
    let Nsq = N * N;

    let indexOf = ( node: Element ) => nodes.indexOf(node);
    let atIndex = ( i: number ) => nodes[i];

    // Initialize distance matrix
    let dist: number[] = new Array(Nsq);
    for( let n = 0; n < Nsq; n++ ){
      let j = n % N;
      let i = (n - j) / N;

      if( i === j ){
        dist[n] = 0;
      } else {
        dist[n] = Infinity;
      }
    }

    // Initialize matrix used for path reconstruction
    // Initialize distance matrix
    let next: number[] = new Array(Nsq);
    let edgeNext: Element[] = new Array(Nsq);

    // Process edges
    for( let i = 0; i < edges.length; i++ ){
      let edge = edges[i];
      let src = edge.source()[0];
      let tgt = edge.target()[0];

      if( src === tgt ){ continue; } // exclude loops

      let s = indexOf( src );
      let t = indexOf( tgt );
      let st = s * N + t; // source to target index
      let weight = weightFn( edge );

      // Check if already process another edge between same 2 nodes
      if( dist[st] > weight ){
        dist[st] = weight;
        next[st] = t;
        edgeNext[st] = edge;
      }

      // If undirected graph, process 'reversed' edge
      if( !directed ){
        let ts = t * N + s; // target to source index

        if( !directed && dist[ts] > weight ){
          dist[ts] = weight;
          next[ts] = s;
          edgeNext[ts] = edge;
        }
      }
    }

    // Main loop
    for( let k = 0; k < N; k++ ){

      for( let i = 0; i < N; i++ ){
        let ik = i * N + k;

        for( let j = 0; j < N; j++ ){
          let ij = i * N + j;
          let kj = k * N + j;

          if( dist[ik] + dist[kj] < dist[ij] ){
            dist[ij] = dist[ik] + dist[kj];
            next[ij] = next[ik];
          }
        }
      }
    }

    let getArgEle = ( ele: SharedCollection | string ): Element => ( is.string(ele) ? cy.filter( ele ) : ele )[0] as Element;
    let indexOfArgEle = ( ele: SharedCollection | string ) => indexOf(getArgEle(ele));

    let res: FloydWarshallResult = {
      distance: function( from, to ){
        let i = indexOfArgEle(from);
        let j = indexOfArgEle(to);

        return dist[ i * N + j ];
      },

      path: function( from, to ){
        let i = indexOfArgEle(from);
        let j = indexOfArgEle(to);

        let fromNode = atIndex(i);

        if( i === j ){ return fromNode.collection(); }

        if( next[i * N + j] == null ){ return cy.collection(); }

        let path = cy.collection();
        let prev;
        let edge;

        path.merge( fromNode );

        while( i !== j ){
          prev = i;
          i = next[i * N + j];
          edge = edgeNext[prev * N + i];

          path.merge( edge );
          path.merge( atIndex(i) );
        }

        return path;
      }
    };

    return res;

  } // floydWarshall

}) satisfies AlgorithmsFloydWarshall; // elesfn

export default elesfn as AlgorithmsFloydWarshall;
