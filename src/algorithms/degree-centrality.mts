import type { Collection } from '../collection.mjs';
import { subgraph, incidentEdgesInView, firstNodeSlot, weightAt } from './algo-shared.mjs';
import type { SubgraphView, WeightFn } from './algo-shared.mjs';

export interface DegreeCentralityOptions {
  root?: Collection | null;
  weight?: WeightFn;
  directed?: boolean;
  /** 0 = count degree, 1 = weight sum (Opsahl's generalized degree) */
  alpha?: number;
}

export interface UndirectedDegreeCentrality { degree: number; }
export interface DirectedDegreeCentrality { indegree: number; outdegree: number; }
export type DegreeCentralityResult = UndirectedDegreeCentrality | DirectedDegreeCentrality;

export interface UndirectedDegreeCentralityNormalized {
  degree( node: Collection ): number;
}
export interface DirectedDegreeCentralityNormalized {
  indegree( node: Collection ): number;
  outdegree( node: Collection ): number;
}
export type DegreeCentralityNormalizedResult =
  UndirectedDegreeCentralityNormalized | DirectedDegreeCentralityNormalized;

const degreeOf = (
  view: SubgraphView, rootSlot: number, directed: boolean,
  weightOf: ( edgeSlot: number ) => number, alpha: number
): { degree: number } & { indegree: number; outdegree: number } => {
  const { endpoints } = view;
  const edges = incidentEdgesInView( view, rootSlot );

  if( !directed ){
    let s = 0;

    for( const e of edges ){ s += weightOf( e ); }

    const degree = Math.pow( edges.length, 1 - alpha ) * Math.pow( s, alpha );

    return { degree, indegree: degree, outdegree: degree };
  }

  let kIn = 0, kOut = 0, sIn = 0, sOut = 0;

  for( const e of edges ){
    const w = weightOf( e );

    // a loop counts on both sides, as in v3
    if( endpoints[ e * 2 + 1 ] === rootSlot ){ kIn++; sIn += w; }
    if( endpoints[ e * 2 ] === rootSlot ){ kOut++; sOut += w; }
  }

  const indegree = Math.pow( kIn, 1 - alpha ) * Math.pow( sIn, alpha );
  const outdegree = Math.pow( kOut, 1 - alpha ) * Math.pow( sOut, alpha );

  return { degree: indegree, indegree, outdegree };
};

/** Opsahl's generalized degree centrality of `root` within the calling collection. */
export const degreeCentrality = ( coll: Collection, options: DegreeCentralityOptions = {} ): DegreeCentralityResult => {
  const view = subgraph( coll );
  const rootSlot = firstNodeSlot( view, options.root, 'root' );

  if( rootSlot == null ){
    throw new TypeError( 'degreeCentrality requires a `root` node' );
  }

  const directed = options.directed === true;
  const weightOf = weightAt( view, options.weight );
  const alpha = options.alpha ?? 0;
  const d = degreeOf( view, rootSlot, directed, weightOf, alpha );

  return directed ? { indegree: d.indegree, outdegree: d.outdegree } : { degree: d.degree };
};

/** Degree centrality of every collection node, normalized by the maximum. */
export const degreeCentralityNormalized = ( coll: Collection, options: DegreeCentralityOptions = {} ): DegreeCentralityNormalizedResult => {
  const view = subgraph( coll );
  const { index, nodeSlots } = view;
  const directed = options.directed === true;
  const weightOf = weightAt( view, options.weight );
  const alpha = options.alpha ?? 0;
  const n = nodeSlots.length;

  const denseOf = ( node: Collection ): number | undefined => {
    const slot = firstNodeSlot( view, node, 'node' );

    return slot == null ? undefined : index.get( slot );
  };

  if( !directed ){
    const degrees = new Float64Array( n );
    let maxDegree = 0;

    for( let i = 0; i < n; i++ ){
      degrees[ i ] = degreeOf( view, nodeSlots[ i ], false, weightOf, alpha ).degree;
      maxDegree = Math.max( maxDegree, degrees[ i ] );
    }

    return {
      degree( node: Collection ): number {
        if( maxDegree === 0 ){ return 0; }

        const i = denseOf( node );

        return i == null ? 0 : degrees[ i ] / maxDegree;
      }
    };
  }

  const indegrees = new Float64Array( n );
  const outdegrees = new Float64Array( n );
  let maxIndegree = 0;
  let maxOutdegree = 0;

  for( let i = 0; i < n; i++ ){
    const d = degreeOf( view, nodeSlots[ i ], true, weightOf, alpha );

    indegrees[ i ] = d.indegree;
    outdegrees[ i ] = d.outdegree;
    maxIndegree = Math.max( maxIndegree, d.indegree );
    maxOutdegree = Math.max( maxOutdegree, d.outdegree );
  }

  return {
    indegree( node: Collection ): number {
      if( maxIndegree === 0 ){ return 0; }

      const i = denseOf( node );

      return i == null ? 0 : indegrees[ i ] / maxIndegree;
    },

    outdegree( node: Collection ): number {
      if( maxOutdegree === 0 ){ return 0; }

      const i = denseOf( node );

      return i == null ? 0 : outdegrees[ i ] / maxOutdegree;
    }
  };
};
