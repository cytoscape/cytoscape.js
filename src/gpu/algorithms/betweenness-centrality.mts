import type { GpuCollection } from '../collection.mjs';
import { subgraph, firstNodeSlot, weightAt, NodeHeap } from './algo-shared.mjs';
import type { WeightFn } from './algo-shared.mjs';

export interface BetweennessCentralityOptions {
  weight?: WeightFn | null;
  directed?: boolean;
}

export interface BetweennessCentralityResult {
  betweenness( node: GpuCollection ): number | undefined;
  betweennessNormalized( node: GpuCollection ): number;
  betweennessNormalised( node: GpuCollection ): number;
}

/**
 * Brandes' betweenness centrality over the calling collection.  Neighbor
 * sets dedupe parallel edges; when weighted, the first subgraph edge between
 * the pair (v→w, else w→v) supplies the weight, as in v3.
 */
export const betweennessCentrality = ( coll: GpuCollection, options: BetweennessCentralityOptions = {} ): BetweennessCentralityResult => {
  const view = subgraph( coll );
  const { store, endpoints, index, nodeSlots, edgeIn } = view;
  const directed = options.directed === true;
  const weighted = options.weight != null;
  const weightOf = weightAt( view, options.weight ?? undefined );
  const n = nodeSlots.length;

  // deduped neighbor lists (dense indices) + one representative edge slot per pair
  const neighbors: number[][] = new Array( n );
  const neighborEdge: number[][] = new Array( n );

  for( let v = 0; v < n; v++ ){
    const vSlot = nodeSlots[ v ];
    const seen = new Map<number, number>(); // dense neighbor -> list position
    const list: number[] = [];
    const eList: number[] = [];

    const consider = ( e: number, otherSlot: number, isForward: boolean ): void => {
      if( otherSlot === vSlot || !edgeIn.has( e ) ){ return; } // loops never traverse

      const w = index.get( otherSlot );

      if( w == null ){ return; }

      const at = seen.get( w );

      if( at == null ){
        seen.set( w, list.length );
        list.push( w );
        eList.push( e );
      } else if( isForward && endpoints[ eList[ at ] * 2 ] !== vSlot ){
        // prefer the first forward (v→w) edge over a backward one, as v3's
        // edgesTo(v, w)[0] does
        eList[ at ] = e;
      }
    };

    const out = store.adj.outEdges( vSlot );

    for( let i = 0; i < out.length; i++ ){
      consider( out[ i ], endpoints[ out[ i ] * 2 + 1 ], true );
    }

    if( !directed ){
      const inn = store.adj.inEdges( vSlot );

      for( let i = 0; i < inn.length; i++ ){
        consider( inn[ i ], endpoints[ inn[ i ] * 2 ], false );
      }
    }

    neighbors[ v ] = list;
    neighborEdge[ v ] = eList;
  }

  const C = new Float64Array( n );
  let max = 0;

  const d = new Float64Array( n );
  const g = new Float64Array( n ); // sigma: shortest-path counts
  const e = new Float64Array( n ); // dependency accumulator
  const P: number[][] = new Array( n ); // predecessor lists

  for( let s = 0; s < n; s++ ){
    const S: number[] = []; // nodes in non-decreasing distance order

    d.fill( Infinity );
    g.fill( 0 );
    e.fill( 0 );

    for( let i = 0; i < n; i++ ){ P[ i ] = []; }

    g[ s ] = 1;
    d[ s ] = 0;

    const Q = new NodeHeap( n, d );

    Q.push( s );

    const settled = new Uint8Array( n );

    while( Q.size > 0 ){
      const v = Q.pop();

      settled[ v ] = 1;
      S.push( v );

      const vNeighbors = neighbors[ v ];

      for( let j = 0; j < vNeighbors.length; j++ ){
        const w = vNeighbors[ j ];
        const step = weighted ? weightOf( neighborEdge[ v ][ j ] ) : 1;

        if( !settled[ w ] && d[ v ] + step < d[ w ] ){
          d[ w ] = d[ v ] + step;

          if( Q.has( w ) ){ Q.update( w ); }
          else { Q.push( w ); }

          g[ w ] = 0;
          P[ w ] = [];
        }

        if( d[ w ] === d[ v ] + step ){
          g[ w ] += g[ v ];
          P[ w ].push( v );
        }
      }
    }

    for( let i = S.length - 1; i >= 0; i-- ){
      const w = S[ i ];
      const pw = P[ w ];

      for( let j = 0; j < pw.length; j++ ){
        const v = pw[ j ];

        e[ v ] += ( g[ v ] / g[ w ] ) * ( 1 + e[ w ] );
      }

      if( w !== s ){
        C[ w ] += e[ w ];

        if( C[ w ] > max ){ max = C[ w ]; }
      }
    }
  }

  const denseOf = ( node: GpuCollection ): number | undefined => {
    const slot = firstNodeSlot( view, node, 'node' );

    return slot == null ? undefined : index.get( slot );
  };

  const ret: BetweennessCentralityResult = {
    betweenness( node: GpuCollection ): number | undefined {
      const i = denseOf( node );

      return i == null ? undefined : C[ i ];
    },

    betweennessNormalized( node: GpuCollection ): number {
      if( max === 0 ){ return 0; }

      const i = denseOf( node );

      return i == null ? 0 : C[ i ] / max;
    },

    betweennessNormalised( node: GpuCollection ): number {
      return ret.betweennessNormalized( node );
    }
  };

  return ret;
};
