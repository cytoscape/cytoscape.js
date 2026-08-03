// Affinity propagation clustering — a port of v3's pass on dense matrices.

import type { GpuCollection } from '../collection.mjs';
import { median, mean, min, max } from '../../math.mjs';
import { clusteringDistance } from './clustering-distances.mjs';
import type { DistanceMetric } from './clustering-distances.mjs';

export type AffinityAttributeFn = ( node: GpuCollection ) => number;
export type AffinityPreference = 'median' | 'mean' | 'min' | 'max' | number;

export interface AffinityPropagationOptions {
  distance?: DistanceMetric;
  preference?: AffinityPreference;
  damping?: number;
  maxIterations?: number;
  minIterations?: number;
  attributes?: AffinityAttributeFn[];
}

const getPreference = ( S: number[], preference: AffinityPreference ): number => {
  if( preference === 'median' ){ return median( S ); }
  if( preference === 'mean' ){ return mean( S ); }
  if( preference === 'min' ){ return min( S ); }
  if( preference === 'max' ){ return max( S ); }

  return preference; // custom number
};

const findExemplars = ( n: number, R: number[], A: number[] ): number[] => {
  const indices: number[] = [];

  for( let i = 0; i < n; i++ ){
    if( R[ i * n + i ] + A[ i * n + i ] > 0 ){ indices.push( i ); }
  }

  return indices;
};

const assignClusters = ( n: number, S: number[], exemplars: number[] ): number[] => {
  const clusters: number[] = [];

  for( let i = 0; i < n; i++ ){
    let index = -1;
    let maxS = -Infinity;

    for( let ei = 0; ei < exemplars.length; ei++ ){
      const e = exemplars[ ei ];

      if( S[ i * n + e ] > maxS ){
        index = e;
        maxS = S[ i * n + e ];
      }
    }

    if( index > 0 ){ clusters.push( index ); }
  }

  for( let ei = 0; ei < exemplars.length; ei++ ){
    clusters[ exemplars[ ei ] ] = exemplars[ ei ];
  }

  return clusters;
};

const assign = ( n: number, S: number[], exemplars: number[] ): number[] => {
  let clusters = assignClusters( n, S, exemplars );

  for( let ei = 0; ei < exemplars.length; ei++ ){
    const ii: number[] = [];

    for( let c = 0; c < clusters.length; c++ ){
      if( clusters[ c ] === exemplars[ ei ] ){ ii.push( c ); }
    }

    let maxI = -1;
    let maxSum = -Infinity;

    for( let i = 0; i < ii.length; i++ ){
      let sum = 0;

      for( let j = 0; j < ii.length; j++ ){
        sum += S[ ii[ j ] * n + ii[ i ] ];
      }

      if( sum > maxSum ){
        maxI = i;
        maxSum = sum;
      }
    }

    exemplars[ ei ] = ii[ maxI ];
  }

  clusters = assignClusters( n, S, exemplars );

  return clusters;
};

/**
 * Affinity propagation over the calling collection's nodes.  Like the
 * other attribute-space clusterers it ignores the adjacency: similarity is
 * the negated `distance` between attribute vectors.  The number of
 * clusters is not given — it falls out of `preference`, the self-similarity
 * placed on the diagonal (lower preference yields fewer exemplars).
 * Allocates three dense N-by-N matrices plus an N-by-`minIterations`
 * convergence history, so cost is quadratic in node count in both time and
 * memory.  Stops early once the exemplar set is unchanged across
 * `minIterations` passes.
 *
 * @param coll — the calling collection; only its nodes are clustered
 * @param options — `damping` and `preference` are effectively required
 *   (v3 validates them); plus `distance`, `attributes`, `maxIterations`,
 *   `minIterations`
 * @returns one collection per exemplar, in exemplar-index order
 * @throws if `damping` is outside [0.5, 1), or `preference` is neither a
 *   number nor one of 'median' / 'mean' / 'min' / 'max'
 */
export const affinityPropagation = ( coll: GpuCollection, options: AffinityPropagationOptions = {} ): GpuCollection[] => {
  const damping = options.damping;
  const preference = options.preference;

  // v3 validates the raw options, so damping and preference are effectively required
  if( !( damping != null && 0.5 <= damping && damping < 1 ) ){
    throw new Error( `Damping must range on [0.5, 1).  Got: ${ damping }` );
  }

  const validPrefs = [ 'median', 'mean', 'min', 'max' ];

  if( !( validPrefs.some( v => v === preference ) || typeof preference === 'number' ) ){
    throw new Error(
      `Preference must be one of [${ validPrefs.map( p => `'${ p }'` ).join( ', ' ) }] or a number.  Got: ${ preference }` );
  }

  const distance = options.distance ?? 'euclidean';
  const maxIterations = options.maxIterations ?? 1000;
  const minIterations = options.minIterations ?? 100;
  const attributes = options.attributes ?? [];

  const nodes = coll.nodes();
  const n = nodes.length;
  const n2 = n * n;

  const getSimilarity = ( n1: GpuCollection, n2ele: GpuCollection ): number => {
    // negative: similarity is inverse to distance
    return -clusteringDistance(
      distance, attributes.length,
      i => attributes[ i ]( n1 ), i => attributes[ i ]( n2ele ), n1, n2ele );
  };

  // similarity matrix
  const S: number[] = new Array( n2 ).fill( -Infinity );

  for( let i = 0; i < n; i++ ){
    for( let j = 0; j < n; j++ ){
      if( i !== j ){
        S[ i * n + j ] = getSimilarity( nodes[ i ], nodes[ j ] );
      }
    }
  }

  const p = getPreference( S, preference as AffinityPreference );

  for( let i = 0; i < n; i++ ){ S[ i * n + i ] = p; }

  const R: number[] = new Array( n2 ).fill( 0 );
  const A: number[] = new Array( n2 ).fill( 0 );
  const old: number[] = new Array( n ).fill( 0 );
  const Rp: number[] = new Array( n ).fill( 0 );
  const se: number[] = new Array( n ).fill( 0 );
  const e: number[] = new Array( n * minIterations ).fill( 0 );

  for( let iter = 0; iter < maxIterations; iter++ ){
    // update responsibilities
    for( let i = 0; i < n; i++ ){
      let maxAS = -Infinity;
      let max2 = -Infinity;
      let maxI = -1;

      for( let j = 0; j < n; j++ ){
        old[ j ] = R[ i * n + j ];

        const AS = A[ i * n + j ] + S[ i * n + j ];

        if( AS >= maxAS ){
          max2 = maxAS;
          maxAS = AS;
          maxI = j;
        } else if( AS > max2 ){
          max2 = AS;
        }
      }

      for( let j = 0; j < n; j++ ){
        R[ i * n + j ] = ( 1 - damping ) * ( S[ i * n + j ] - maxAS ) + damping * old[ j ];
      }

      R[ i * n + maxI ] = ( 1 - damping ) * ( S[ i * n + maxI ] - max2 ) + damping * old[ maxI ];
    }

    // update availabilities
    for( let i = 0; i < n; i++ ){
      let sum = 0;

      for( let j = 0; j < n; j++ ){
        old[ j ] = A[ j * n + i ];
        Rp[ j ] = Math.max( 0, R[ j * n + i ] );
        sum += Rp[ j ];
      }

      sum -= Rp[ i ];
      Rp[ i ] = R[ i * n + i ];
      sum += Rp[ i ];

      for( let j = 0; j < n; j++ ){
        A[ j * n + i ] = ( 1 - damping ) * Math.min( 0, sum - Rp[ j ] ) + damping * old[ j ];
      }

      A[ i * n + i ] = ( 1 - damping ) * ( sum - Rp[ i ] ) + damping * old[ i ];
    }

    // convergence check
    let K = 0;

    for( let i = 0; i < n; i++ ){
      const E = A[ i * n + i ] + R[ i * n + i ] > 0 ? 1 : 0;

      e[ ( iter % minIterations ) * n + i ] = E;
      K += E;
    }

    if( K > 0 && ( iter >= minIterations - 1 || iter === maxIterations - 1 ) ){
      let sum = 0;

      for( let i = 0; i < n; i++ ){
        se[ i ] = 0;

        for( let j = 0; j < minIterations; j++ ){
          se[ i ] += e[ j * n + i ];
        }

        if( se[ i ] === 0 || se[ i ] === minIterations ){ sum++; }
      }

      if( sum === n ){ break; } // converged
    }
  }

  const exemplarsIndices = findExemplars( n, R, A );
  const clusterIndices = assign( n, S, exemplarsIndices );

  const clusters: Record<number, GpuCollection[]> = {};

  for( let c = 0; c < exemplarsIndices.length; c++ ){
    clusters[ exemplarsIndices[ c ] ] = [];
  }

  for( let i = 0; i < nodes.length; i++ ){
    const clusterIndex = clusterIndices[ i ];

    if( clusterIndex != null ){
      clusters[ clusterIndex ].push( nodes[ i ] );
    }
  }

  return exemplarsIndices.map( ei =>
    coll._spawn( clusters[ ei ].map( ele => ele._refs[ 0 ] ) ) );
};
