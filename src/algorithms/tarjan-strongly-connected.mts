import type { GpuCollection } from '../collection.mjs';
import type { Ref } from '../contract.mjs';
import { subgraph } from './algo-shared.mjs';

export interface TarjanStronglyConnectedResult {
  /** the elements not inside any component: the edges between components */
  cut: GpuCollection;
  components: GpuCollection[];
}

/**
 * Tarjan's strongly connected components over the calling collection
 * (directed; out-edges within the collection, loops never traversed).
 * Iterative — unlike v3's recursive form — so deep graphs cannot overflow
 * the JS stack; the component sets are identical.
 */
export const tarjanStronglyConnected = ( coll: GpuCollection ): TarjanStronglyConnectedResult => {
  const view = subgraph( coll );
  const { store, endpoints, index, nodeSlots, edgeIn } = view;
  const n = nodeSlots.length;

  const idx = new Int32Array( n ).fill( -1 );
  const low = new Int32Array( n );
  const onStack = new Uint8Array( n );
  const compId = new Int32Array( n ).fill( -1 );
  const sccStack: number[] = [];
  const componentNodes: number[][] = []; // dense indices, pop order
  let nextIndex = 0;

  // out-edges within the subgraph per dense node, precollected so the
  // iterative DFS can resume mid-edge-list
  const outAdj: number[][] = new Array( n );

  for( let i = 0; i < n; i++ ){
    const u = nodeSlots[ i ];
    const out = store.adj.outEdges( u );
    const targets: number[] = [];

    for( let j = 0; j < out.length; j++ ){
      const e = out[ j ];
      const t = endpoints[ e * 2 + 1 ];

      if( t === u || !edgeIn.has( e ) ){ continue; }

      const ti = index.get( t );

      if( ti != null ){ targets.push( ti ); }
    }

    outAdj[ i ] = targets;
  }

  const visit = ( start: number ): void => {
    const dfs: number[] = [ start ];
    const edgePos: number[] = [ 0 ];

    idx[ start ] = low[ start ] = nextIndex++;
    sccStack.push( start );
    onStack[ start ] = 1;

    while( dfs.length > 0 ){
      const v = dfs[ dfs.length - 1 ];
      const targets = outAdj[ v ];
      const p = edgePos[ edgePos.length - 1 ];

      if( p < targets.length ){
        edgePos[ edgePos.length - 1 ] = p + 1;

        const w = targets[ p ];

        if( idx[ w ] < 0 ){
          idx[ w ] = low[ w ] = nextIndex++;
          sccStack.push( w );
          onStack[ w ] = 1;
          dfs.push( w );
          edgePos.push( 0 );
        } else if( onStack[ w ] ){
          low[ v ] = Math.min( low[ v ], low[ w ] );
        }

        continue;
      }

      dfs.pop();
      edgePos.pop();

      if( dfs.length > 0 ){
        const parent = dfs[ dfs.length - 1 ];

        low[ parent ] = Math.min( low[ parent ], low[ v ] );
      }

      if( low[ v ] === idx[ v ] ){
        const comp: number[] = [];

        for( ;; ){
          const w = sccStack.pop() as number;

          onStack[ w ] = 0;
          compId[ w ] = componentNodes.length;
          comp.push( w );

          if( w === v ){ break; }
        }

        componentNodes.push( comp );
      }
    }
  };

  for( let i = 0; i < n; i++ ){
    if( idx[ i ] < 0 ){ visit( i ); }
  }

  // partition edges: internal to a component vs the cut between components
  const componentEdges: number[][] = componentNodes.map( () => [] );
  const cutRefs: Ref[] = [];

  for( const e of view.edgeSlots ){
    const s = index.get( endpoints[ e * 2 ] );
    const t = index.get( endpoints[ e * 2 + 1 ] );

    if( s != null && t != null && compId[ s ] === compId[ t ] ){
      componentEdges[ compId[ s ] ].push( e );
    } else {
      cutRefs.push( store.ref( 'edges', e ) );
    }
  }

  const components = componentNodes.map( ( comp, ci ) => {
    const refs: Ref[] = [];

    for( const di of comp ){ refs.push( store.ref( 'nodes', nodeSlots[ di ] ) ); }
    for( const e of componentEdges[ ci ] ){ refs.push( store.ref( 'edges', e ) ); }

    return coll._spawnLive( refs );
  } );

  return { cut: coll._spawnLive( cutRefs ), components };
};
