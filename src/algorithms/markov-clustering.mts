// Markov clustering (MCL) — a port of v3's pass on dense Float64 matrices.

import type { Collection } from '../collection.mjs';
import { subgraph } from './algo-shared.mjs';

/** A similarity function: maps an edge to a numeric contribution. */
export type MarkovAttributeFn = ( edge: Collection ) => number;

export interface MarkovClusteringOptions {
  expandFactor?: number;
  inflateFactor?: number;
  multFactor?: number;
  maxIterations?: number;
  attributes?: MarkovAttributeFn[];
}

const normalize = ( M: Float64Array, n: number ): void => {
  for( let col = 0; col < n; col++ ){
    let sum = 0;

    for( let row = 0; row < n; row++ ){ sum += M[ row * n + col ]; }

    for( let row = 0; row < n; row++ ){ M[ row * n + col ] = M[ row * n + col ] / sum; }
  }
};

const mmult = ( A: Float64Array, B: Float64Array, n: number ): Float64Array => {
  const C = new Float64Array( n * n );

  for( let i = 0; i < n; i++ ){
    for( let k = 0; k < n; k++ ){
      const a = A[ i * n + k ];

      for( let j = 0; j < n; j++ ){
        C[ i * n + j ] += a * B[ k * n + j ];
      }
    }
  }

  return C;
};

const expand = ( M: Float64Array, n: number, expandFactor: number ): Float64Array => {
  const _M = M.slice();

  for( let p = 1; p < expandFactor; p++ ){
    M = mmult( M, _M, n );
  }

  return M;
};

const inflate = ( M: Float64Array, n: number, inflateFactor: number ): Float64Array => {
  const _M = new Float64Array( n * n );

  for( let i = 0; i < n * n; i++ ){
    _M[ i ] = Math.pow( M[ i ], inflateFactor );
  }

  normalize( _M, n );

  return _M;
};

const hasConverged = ( M: Float64Array, _M: Float64Array, n2: number, roundFactor: number ): boolean => {
  const scale = Math.pow( 10, roundFactor );

  for( let i = 0; i < n2; i++ ){
    if( Math.round( M[ i ] * scale ) / scale !== Math.round( _M[ i ] * scale ) / scale ){
      return false;
    }
  }

  return true;
};

/**
 * Markov clustering (MCL) over the calling collection.  Unlike the
 * attribute-space clusterers this one is a graph algorithm: it builds a
 * column-stochastic matrix from the subgraph's edges (treated as
 * undirected — each edge contributes to both entries), adds `multFactor`
 * self loops on the diagonal, then alternates expansion and inflation
 * until the matrix stops changing to four decimal places or
 * `maxIterations` passes.  The matrix is dense N-by-N and expansion
 * multiplies it, so cost is cubic in node count per iteration.
 *
 * @param coll — the calling collection; only edges inside it contribute
 * @param options — `expandFactor` (matrix power, default 2),
 *   `inflateFactor` (element-wise power, default 2), `multFactor`
 *   (diagonal self-loop weight, default 1), `maxIterations`, and
 *   `attributes`, summed per edge for the similarity (default: 1 each)
 * @returns one collection per attractor row, de-duplicated by member set
 */
export const markovClustering = ( coll: Collection, options: MarkovClusteringOptions = {} ): Collection[] => {
  const expandFactor = options.expandFactor ?? 2;
  const inflateFactor = options.inflateFactor ?? 2;
  const multFactor = options.multFactor ?? 1;
  const maxIterations = options.maxIterations ?? 20;
  const attributes: MarkovAttributeFn[] = options.attributes ?? [ () => 1 ];

  const view = subgraph( coll );
  const { cy, endpoints, index, nodeSlots } = view;
  const n = nodeSlots.length;
  const n2 = n * n;

  // stochastic matrix from the (symmetric, undirected) input graph
  let M: Float64Array = new Float64Array( n2 );

  for( const e of view.edgeSlots ){
    const i = index.get( endpoints[ e * 2 ] );
    const j = index.get( endpoints[ e * 2 + 1 ] );

    if( i == null || j == null ){ continue; }

    let sim = 0;
    const edge = cy._ele( 'edges', e );

    for( const attr of attributes ){ sim += attr( edge ); }

    M[ i * n + j ] += sim;
    M[ j * n + i ] += sim;
  }

  // self loops (multFactor on the diagonal), then normalize
  for( let i = 0; i < n; i++ ){ M[ i * n + i ] = multFactor; }

  normalize( M, n );

  let isStillMoving = true;
  let iterations = 0;

  while( isStillMoving && iterations < maxIterations ){
    isStillMoving = false;

    const _M = expand( M, n, expandFactor );

    M = inflate( _M, n, inflateFactor );

    if( !hasConverged( M, _M, n2, 4 ) ){
      isStillMoving = true;
    }

    iterations++;
  }

  // row-wise attractors and their attracted nodes form the clusters
  const clusters: Collection[] = [];
  const seen = new Set<string>(); // dedupe symmetric duplicates by member key

  for( let i = 0; i < n; i++ ){
    const cluster: number[] = [];

    for( let j = 0; j < n; j++ ){
      if( Math.round( M[ i * n + j ] * 1000 ) / 1000 > 0 ){
        cluster.push( j );
      }
    }

    if( cluster.length === 0 ){ continue; }

    const key = cluster.join( ',' );

    if( seen.has( key ) ){ continue; }

    seen.add( key );
    clusters.push( coll._spawnLive( cluster.map( di => view.store.ref( 'nodes', nodeSlots[ di ] ) ) ) );
  }

  return clusters;
};
