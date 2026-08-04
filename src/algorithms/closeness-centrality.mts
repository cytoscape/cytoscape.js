import type { Collection } from '../collection.mjs';
import { dijkstra } from './dijkstra.mjs';
import { floydWarshall } from './floyd-warshall.mjs';
import { subgraph, firstNodeSlot } from './algo-shared.mjs';
import type { WeightFn } from './algo-shared.mjs';

export interface ClosenessCentralityOptions {
  root?: Collection | null;
  weight?: WeightFn;
  directed?: boolean;
  /** sum 1/d (default, tolerates disconnection) instead of 1/sum d */
  harmonic?: boolean;
}

export interface ClosenessCentralityNormalizedResult {
  closeness( node: Collection ): number;
}

/** Closeness centrality of `root` within the calling collection. */
export const closenessCentrality = ( coll: Collection, options: ClosenessCentralityOptions = {} ): number => {
  const harmonic = options.harmonic !== false;
  const view = subgraph( coll );
  const rootSlot = firstNodeSlot( view, options.root, 'root' );

  if( rootSlot == null ){
    throw new TypeError( 'closenessCentrality requires a `root` node' );
  }

  const di = dijkstra( coll, [ {
    root: options.root as Collection, weight: options.weight, directed: options.directed
  } ] );
  let totalDistance = 0;

  for( const slot of view.nodeSlots ){
    if( slot === rootSlot ){ continue; }

    const d = di.distanceTo( view.cy._ele( 'nodes', slot ) ) as number;

    totalDistance += harmonic ? 1 / d : d;
  }

  return harmonic ? totalDistance : 1 / totalDistance;
};

/** Closeness centrality of every collection node, normalized by the maximum. */
export const closenessCentralityNormalized = ( coll: Collection, options: ClosenessCentralityOptions = {} ): ClosenessCentralityNormalizedResult => {
  const harmonic = options.harmonic !== false;
  const view = subgraph( coll );
  const { cy, index, nodeSlots } = view;
  const n = nodeSlots.length;
  const fw = floydWarshall( coll, { weight: options.weight, directed: options.directed } );

  const closenesses = new Float64Array( n );
  let maxCloseness = 0;

  for( let i = 0; i < n; i++ ){
    let curr = 0;
    const ni = cy._ele( 'nodes', nodeSlots[ i ] );

    for( let j = 0; j < n; j++ ){
      if( i === j ){ continue; }

      const d = fw.distance( ni, cy._ele( 'nodes', nodeSlots[ j ] ) ) as number;

      curr += harmonic ? 1 / d : d;
    }

    if( !harmonic ){ curr = 1 / curr; }

    maxCloseness = Math.max( maxCloseness, curr );
    closenesses[ i ] = curr;
  }

  return {
    closeness( node: Collection ): number {
      if( maxCloseness === 0 ){ return 0; }

      const slot = firstNodeSlot( view, node, 'node' );
      const i = slot == null ? undefined : index.get( slot );

      return i == null ? 0 : closenesses[ i ] / maxCloseness;
    }
  };
};
