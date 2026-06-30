import { defaults } from '../../util/index.mjs';
import { inPlaceSumNormalize } from '../../math.mjs';
import type { Collection, Element, SharedCollection } from '../eles-types.mjs';

/** Edge weighting function. */
export type PageRankWeightFn = ( edge: Element ) => number;

/** Options accepted by `pageRank`. */
export interface PageRankOptions {
  dampingFactor?: number;
  precision?: number;
  iterations?: number;
  weight?: PageRankWeightFn;
}

/** Result of `pageRank`: the rank of a given node. */
export interface PageRankResult {
  rank( node: Collection | Element | string ): number;
}

export interface AlgorithmsPageRank {
  pageRank( this: SharedCollection, options?: PageRankOptions ): PageRankResult;
}

const pageRankDefaults = defaults({
  dampingFactor: 0.8,
  precision: 0.000001,
  iterations: 200,
  weight: ( ( _edge: Element ) => 1 ) as PageRankWeightFn
});

let elesfn = ({

  pageRank: function( this: SharedCollection, options?: PageRankOptions ): PageRankResult {
    let { dampingFactor, precision, iterations, weight } = pageRankDefaults(options);
    let cy = this._private.cy;
    let { nodes, edges } = this.byGroup();
    let numNodes = nodes.length;
    let numNodesSqd = numNodes * numNodes;
    let numEdges = edges.length;

    // Construct transposed adjacency matrix
    // First lets have a zeroed matrix of the right size
    // We'll also keep track of the sum of each column
    let matrix: number[] = new Array(numNodesSqd);
    let columnSum: number[] = new Array(numNodes);
    let additionalProb = (1 - dampingFactor) / numNodes;

    // Create null matrix
    for( let i = 0; i < numNodes; i++ ){
      for( let j = 0; j < numNodes; j++ ){
        let n = i * numNodes + j;

        matrix[n] = 0;
      }

      columnSum[i] = 0;
    }

    // Now, process edges
    for( let i = 0; i < numEdges; i++ ){
      let edge = edges[ i ];
      let srcId = edge.data('source') as string;
      let tgtId = edge.data('target') as string;

      // Don't include loops in the matrix
      if( srcId === tgtId ){ continue; }

      let s = nodes.indexOfId( srcId );
      let t = nodes.indexOfId( tgtId );
      let w = weight( edge );
      let n = t * numNodes + s;

      // Update matrix
      matrix[n] += w;

      // Update column sum
      columnSum[s] += w;
    }

    // Add additional probability based on damping factor
    // Also, take into account columns that have sum = 0
    let p = 1.0 / numNodes + additionalProb; // Shorthand

    // Traverse matrix, column by column
    for( let j = 0; j < numNodes; j++ ){
      if( columnSum[j] === 0 ){
        // No 'links' out from node jth, assume equal probability for each possible node
        for( let i = 0; i < numNodes; i++ ){
          let n = i * numNodes + j;
          matrix[n] = p;
        }
      } else {
        // Node jth has outgoing link, compute normalized probabilities
        for( let i = 0; i < numNodes; i++ ){
          let n = i * numNodes + j;

          matrix[n] = matrix[n] / columnSum[j] + additionalProb;
        }
      }
    }

    // Compute dominant eigenvector using power method
    let eigenvector: number[] = new Array(numNodes);
    let temp: number[] = new Array(numNodes);
    let previous: number[];

    // Start with a vector of all 1's
    // Also, initialize a null vector which will be used as shorthand
    for( let i = 0; i < numNodes; i++ ){
      eigenvector[i] = 1;
    }

    for( let iter = 0; iter < iterations; iter++ ){
      // Temp array with all 0's
      for( let i = 0; i < numNodes; i++ ){
        temp[i] = 0;
      }

      // Multiply matrix with previous result
      for( let i = 0; i < numNodes; i++ ){
        for( let j = 0; j < numNodes; j++ ){
          let n = i * numNodes + j;

          temp[i] += matrix[n] * eigenvector[j];
        }
      }

      inPlaceSumNormalize( temp );
      previous = eigenvector;
      eigenvector = temp;
      temp = previous;

      let diff = 0;
      // Compute difference (squared module) of both vectors
      for( let i = 0; i < numNodes; i++ ){
        let delta = previous[i] - eigenvector[i];

        diff += delta * delta;
      }

      // If difference is less than the desired threshold, stop iterating
      if( diff < precision ){
        break;
      }
    }

    // Construct result
    let res: PageRankResult = {
      rank: function( node: Collection | Element | string ): number {
        let n: Element = cy.collection(node)[0];

        return eigenvector[ nodes.indexOf(n) ];
      }
    };


    return res;
  } // pageRank

}) satisfies AlgorithmsPageRank; // elesfn

export default elesfn as AlgorithmsPageRank;
