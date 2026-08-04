import Heap from '../../heap.mjs';
import * as util from '../../util/index.mjs';
import type { EdgeSingular, SharedCollection, Element } from '../eles-types.mjs';

/** Edge weighting function. */
export type BetweennessWeightFn = ( edge: EdgeSingular ) => number;

/** Options accepted by `betweennessCentrality`. */
export interface BetweennessCentralityOptions {
  weight?: BetweennessWeightFn | null;
  directed?: boolean;
}

/** Result of `betweennessCentrality`. */
export interface BetweennessCentralityResult {
  betweenness( node: SharedCollection | string ): number | undefined;
  betweennessNormalized( node: SharedCollection | string ): number;
  betweennessNormalised( node: SharedCollection | string ): number;
}

export interface AlgorithmsBetweennessCentrality {
  betweennessCentrality( this: SharedCollection, options?: BetweennessCentralityOptions ): BetweennessCentralityResult;
  bc( this: SharedCollection, options?: BetweennessCentralityOptions ): BetweennessCentralityResult;
}

const defaults = util.defaults({
  weight: null as BetweennessWeightFn | null,
  directed: false
});

let elesfn = ({

  // Implemented from the algorithm in the paper "On Variants of Shortest-Path Betweenness Centrality and their Generic Computation" by Ulrik Brandes
  betweennessCentrality: function( this: SharedCollection, options?: BetweennessCentralityOptions ): BetweennessCentralityResult {
    let { directed, weight } = defaults(options);
    let weighted = weight != null;
    let cy = this.cy();

    // starting
    let V = this.nodes();
    let A: Record<string, SharedCollection> = {};
    let _C: Record<string, number> = {};
    let max = 0;
    let C = {
      set: function( key: string, val: number ){
        _C[ key ] = val;

        if( val > max ){ max = val; }
      },

      get: function( key: string ){ return _C[ key ]; }
    };

    // A contains the neighborhoods of every node
    for( let i = 0; i < V.length; i++ ){
      let v = V[ i ];
      let vid = v.id()!;

      if( directed ){
        A[ vid ] = v.outgoers().nodes(); // get outgoers of every node
      } else {
        A[ vid ] = v.openNeighborhood().nodes(); // get neighbors of every node
      }

      C.set( vid, 0 );
    }

    for( let s = 0; s < V.length; s++ ){
      let sid = V[s].id()!;
      let S: string[] = []; // stack
      let P: Record<string, string[]> = {};
      let g: Record<string, number> = {};
      let d: Record<string, number> = {};
      let Q = new Heap<string>(function( a, b ){
        return d[a] - d[b];
      }); // queue

      // init dictionaries
      for( let i = 0; i < V.length; i++ ){
        let vid = V[ i ].id()!;

        P[ vid ] = [];
        g[ vid ] = 0;
        d[ vid ] = Infinity;
      }

      g[ sid ] = 1; // sigma
      d[ sid ] = 0; // distance to s

      Q.push( sid );

      while( !Q.empty() ){
        let v = Q.pop() as string;

        S.push( v );

        if( weighted ){
          for( let j = 0; j < A[v].length; j++ ){
            let wEle: Element = A[v][j];
            let vEle = cy.getElementById( v );

            let edge: Element;
            if( vEle.edgesTo( wEle ).length > 0 ){
              edge = vEle.edgesTo( wEle )[0];
            } else {
              edge = wEle.edgesTo( vEle )[0];
            }

            let edgeWeight = ( weight as BetweennessWeightFn )( edge as unknown as EdgeSingular );

            let w = wEle.id()!;

            if( d[w] > d[v] + edgeWeight ){
              d[w] = d[v] + edgeWeight;

              if( ( Q as unknown as { nodes: string[] } ).nodes.indexOf( w ) < 0 ){ // nodes is an undeclared internal of the heap package
                Q.push( w );
              } else { // update position if w is in Q
                Q.updateItem( w );
              }

              g[w] = 0;
              P[w] = [];
            }

            if( d[w] == d[v] + edgeWeight ){
              g[w] = g[w] + g[v];
              P[w].push( v );
            }
          }
        } else {
          for( let j = 0; j < A[v].length; j++ ){
            let w = A[v][j].id()!;

            if( d[w] == Infinity ){
              Q.push( w );

              d[w] = d[v] + 1;
            }

            if( d[w] == d[v] + 1 ){
              g[w] = g[w] + g[v];
              P[w].push( v );
            }
          }
        }
      }

      let e: Record<string, number> = {};
      for( let i = 0; i < V.length; i++ ){
        e[ V[ i ].id()! ] = 0;
      }

      while( S.length > 0 ){
        let w = S.pop() as string;

        for( let j = 0; j < P[w].length; j++ ){
          let v = P[w][j];

          e[v] = e[v] + (g[v] / g[w]) * (1 + e[w]);
        }

        if( w != V[s].id() ){
          C.set( w, ( C.get( w ) as number ) + e[w] );
        }
      }
    }

    let ret = {
      betweenness: function( node: SharedCollection | string ): number | undefined {
        let id = cy.collection(node).id()!;

        return C.get( id );
      },

      betweennessNormalized: function( node: SharedCollection | string ): number {
        if ( max == 0 ){ return 0; }

        let id = cy.collection(node).id()!;

        return ( C.get( id ) as number ) / max;
      }
    } as BetweennessCentralityResult;

    // alias
    ret.betweennessNormalised = ret.betweennessNormalized;

    return ret;
  } // betweennessCentrality

}) as AlgorithmsBetweennessCentrality; // elesfn

// nice, short mathematical alias
elesfn.bc = elesfn.betweennessCentrality;

export default elesfn;
