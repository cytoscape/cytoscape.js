import * as is from '../../is.mjs';
import * as util from '../../util/index.mjs';
import type { EdgeSingular, Element, SharedCollection } from '../eles-types.mjs';

/** Edge weighting function. */
export type ClosenessCentralityWeightFn = ( edge: EdgeSingular ) => number;

/** Options accepted by the closeness-centrality methods. */
export interface ClosenessCentralityOptions {
  harmonic?: boolean;
  weight?: ClosenessCentralityWeightFn;
  directed?: boolean;
  root?: SharedCollection | string | null;
}

/** Result of `closenessCentralityNormalized`. */
export interface ClosenessCentralityNormalizedResult {
  closeness( node: SharedCollection | string ): number;
}

export interface AlgorithmsClosenessCentrality {
  closenessCentralityNormalized( this: SharedCollection, options?: ClosenessCentralityOptions ): ClosenessCentralityNormalizedResult;
  closenessCentrality( this: SharedCollection, options?: ClosenessCentralityOptions ): number;
  cc( this: SharedCollection, options?: ClosenessCentralityOptions ): number;
  ccn( this: SharedCollection, options?: ClosenessCentralityOptions ): ClosenessCentralityNormalizedResult;
  closenessCentralityNormalised( this: SharedCollection, options?: ClosenessCentralityOptions ): ClosenessCentralityNormalizedResult;
}

const defaults = util.defaults({
  harmonic: true,
  weight: ( ( _edge: EdgeSingular ) => 1 ) as ClosenessCentralityWeightFn,
  directed: false,
  root: null as SharedCollection | string | null
});

const elesfn = ({

  closenessCentralityNormalized: function( this: SharedCollection, options?: ClosenessCentralityOptions ): ClosenessCentralityNormalizedResult {
    let { harmonic, weight, directed } = defaults(options);

    let cy = this.cy();
    let closenesses: Record<string, number> = {};
    let maxCloseness = 0;
    let nodes = this.nodes();
    let fw = this.floydWarshall({ weight, directed });

    // Compute closeness for every node and find the maximum closeness
    for( let i = 0; i < nodes.length; i++ ){
      let currCloseness = 0;
      let node_i = nodes[i];

      for( let j = 0; j < nodes.length; j++ ){
        if( i !== j ){
          let d = fw.distance( node_i, nodes[j] );

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

      closenesses[ node_i.id()! ] = currCloseness;
    }

    return {
      closeness: function( node: SharedCollection | string ): number {
        if( maxCloseness == 0 ){ return 0; }

        let id: string;
        if( is.string( node ) ){
          // from is a selector string
          id = (cy.filter( node )[0]).id()!;
        } else {
          // from is a node
          id = node.id()!;
        }

        return closenesses[ id ] / maxCloseness;
      }
    };
  },

  // Implemented from pseudocode from wikipedia
  closenessCentrality: function( this: SharedCollection, options?: ClosenessCentralityOptions ): number {
    let { root, weight, directed, harmonic } = defaults(options);

    let rootEle: Element = this.filter(root)[0];

    // we need distance from this node to every other node
    let dijkstra = this.dijkstra({ root: rootEle, weight, directed });
    let totalDistance = 0;
    let nodes = this.nodes();

    for( let i = 0; i < nodes.length; i++ ){
      let n = nodes[i];

      if( !n.same(rootEle) ){
        let d = dijkstra.distanceTo(n);

        if( harmonic ){
          totalDistance += 1 / d;
        } else {
          totalDistance += d;
        }
      }
    }

    return harmonic ? totalDistance : 1 / totalDistance;
  } // closenessCentrality

}) as AlgorithmsClosenessCentrality; // elesfn

// nice, short mathematical alias
elesfn.cc = elesfn.closenessCentrality;
elesfn.ccn = elesfn.closenessCentralityNormalised = elesfn.closenessCentralityNormalized;

export default elesfn;
