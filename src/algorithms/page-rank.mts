import type { Collection } from '../collection.mjs';
import { subgraph, firstNodeSlot, weightAt } from './algo-shared.mjs';
import type { WeightFn } from './algo-shared.mjs';

export interface PageRankOptions {
  dampingFactor?: number;
  precision?: number;
  iterations?: number;
  weight?: WeightFn;
}

export interface PageRankResult {
  rank( node: Collection ): number | undefined;
}

/** PageRank over the calling collection (power method on the dense matrix). */
export const pageRank = ( coll: Collection, options: PageRankOptions = {} ): PageRankResult => {
  const dampingFactor = options.dampingFactor ?? 0.8;
  const precision = options.precision ?? 0.000001;
  const iterations = options.iterations ?? 200;

  const view = subgraph( coll );
  const { endpoints, index, nodeSlots } = view;
  const weightOf = weightAt( view, options.weight );
  const n = nodeSlots.length;

  // transposed adjacency matrix + per-column (source) weight sums
  const matrix = new Float64Array( n * n );
  const columnSum = new Float64Array( n );
  const additionalProb = ( 1 - dampingFactor ) / n;

  for( const e of view.edgeSlots ){
    const sSlot = endpoints[ e * 2 ];
    const tSlot = endpoints[ e * 2 + 1 ];

    if( sSlot === tSlot ){ continue; } // exclude loops

    const s = index.get( sSlot );
    const t = index.get( tSlot );

    if( s == null || t == null ){ continue; }

    const w = weightOf( e );

    matrix[ t * n + s ] += w;
    columnSum[ s ] += w;
  }

  const p = 1.0 / n + additionalProb;

  for( let j = 0; j < n; j++ ){
    if( columnSum[ j ] === 0 ){
      // no links out of node j: assume equal probability for each node
      for( let i = 0; i < n; i++ ){ matrix[ i * n + j ] = p; }
    } else {
      for( let i = 0; i < n; i++ ){
        matrix[ i * n + j ] = matrix[ i * n + j ] / columnSum[ j ] + additionalProb;
      }
    }
  }

  // dominant eigenvector via the power method
  let eigenvector = new Float64Array( n ).fill( 1 );
  let temp = new Float64Array( n );

  for( let iter = 0; iter < iterations; iter++ ){
    temp.fill( 0 );

    for( let i = 0; i < n; i++ ){
      for( let j = 0; j < n; j++ ){
        temp[ i ] += matrix[ i * n + j ] * eigenvector[ j ];
      }
    }

    let sum = 0;

    for( let i = 0; i < n; i++ ){ sum += temp[ i ]; }

    if( sum !== 0 ){
      for( let i = 0; i < n; i++ ){ temp[ i ] /= sum; }
    }

    const previous = eigenvector;

    eigenvector = temp;
    temp = previous;

    let diff = 0;

    for( let i = 0; i < n; i++ ){
      const delta = previous[ i ] - eigenvector[ i ];

      diff += delta * delta;
    }

    if( diff < precision ){ break; }
  }

  return {
    rank( node: Collection ): number | undefined {
      const slot = firstNodeSlot( view, node, 'node' );
      const i = slot == null ? undefined : index.get( slot );

      return i == null ? undefined : eigenvector[ i ];
    }
  };
};
