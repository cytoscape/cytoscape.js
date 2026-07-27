import type { GpuCollection } from '../collection.mjs';
import type { Ref } from '../contract.mjs';
import { subgraph, incidentEdgesInView as incidentEdges } from './algo-shared.mjs';

export interface HopcroftTarjanBiconnectedResult {
  /** the cut vertices (articulation points), in discovery order */
  cut: GpuCollection;
  components: GpuCollection[];
}

/**
 * Hopcroft-Tarjan biconnected components over the calling collection
 * (undirected).  A faithful port of the v3 pass, including its quirks: all
 * edges back to the DFS parent are skipped (parallel edges included), and a
 * component absorbs every subgraph edge of its non-cut vertices.
 */
export const hopcroftTarjanBiconnected = ( coll: GpuCollection ): HopcroftTarjanBiconnectedResult => {
  const view = subgraph( coll );
  const { store, endpoints, index, nodeSlots } = view;
  const n = nodeSlots.length;

  const id = new Int32Array( n ).fill( -1 );
  const low = new Int32Array( n );
  const cutVertex = new Uint8Array( n );
  const visitedEdges = new Set<number>();
  const stack: { x: number; y: number; edge: number }[] = []; // dense x/y, edge slot
  const components: GpuCollection[] = [];
  let nextId = 0;
  let edgeCount = 0;

  const buildComponent = ( x: number, y: number ): void => {
    let i = stack.length - 1;
    const cutset: number[] = [];

    while( stack[ i ].x !== x || stack[ i ].y !== y ){
      cutset.push( ( stack.pop() as { edge: number } ).edge );
      i--;
    }

    cutset.push( ( stack.pop() as { edge: number } ).edge );

    const refs: Ref[] = [];
    const seen = new Set<number>(); // packed: node = slot * 2, edge = slot * 2 + 1

    const pushEdge = ( e: number ): void => {
      if( !seen.has( e * 2 + 1 ) ){
        seen.add( e * 2 + 1 );
        refs.push( store.ref( 'edges', e ) );
      }
    };

    const pushNode = ( slot: number ): void => {
      if( !seen.has( slot * 2 ) ){
        seen.add( slot * 2 );
        refs.push( store.ref( 'nodes', slot ) );
      }
    };

    for( const e of cutset ){
      pushEdge( e );

      for( const which of [ 0, 1 ] ){
        const slot = endpoints[ e * 2 + which ];
        const di = index.get( slot );

        if( di == null || ( which === 1 && endpoints[ e * 2 ] === slot ) ){ continue; }

        pushNode( slot );

        for( const ie of incidentEdges( view, slot ) ){
          const isLoop = endpoints[ ie * 2 ] === endpoints[ ie * 2 + 1 ];

          if( !cutVertex[ di ] || isLoop ){ pushEdge( ie ); }
        }
      }
    }

    components.push( coll._spawnLive( refs ) );
  };

  const biconnectedSearch = ( root: number, current: number, parent: number ): void => {
    if( root === parent ){ edgeCount += 1; }

    id[ current ] = low[ current ] = nextId++;

    const edges = incidentEdges( view, nodeSlots[ current ] );

    if( edges.length === 0 ){
      components.push( coll._spawnLive( [ store.ref( 'nodes', nodeSlots[ current ] ) ] ) );

      return;
    }

    for( const e of edges ){
      const sSlot = endpoints[ e * 2 ];
      const tSlot = endpoints[ e * 2 + 1 ];
      const otherSlot = sSlot === nodeSlots[ current ] ? tSlot : sSlot;
      const other = index.get( otherSlot );

      if( other == null || other === parent ){ continue; }

      if( !visitedEdges.has( e ) ){
        visitedEdges.add( e );
        stack.push( { x: current, y: other, edge: e } );
      }

      if( id[ other ] < 0 ){
        biconnectedSearch( root, other, current );
        low[ current ] = Math.min( low[ current ], low[ other ] );

        if( id[ current ] <= low[ other ] ){
          cutVertex[ current ] = 1;
          buildComponent( current, other );
        }
      } else {
        low[ current ] = Math.min( low[ current ], id[ other ] );
      }
    }
  };

  for( let i = 0; i < n; i++ ){
    if( id[ i ] < 0 ){
      edgeCount = 0;
      biconnectedSearch( i, i, -1 );
      cutVertex[ i ] = edgeCount > 1 ? 1 : 0;
    }
  }

  const cutRefs: Ref[] = [];

  for( let i = 0; i < n; i++ ){
    if( cutVertex[ i ] ){ cutRefs.push( store.ref( 'nodes', nodeSlots[ i ] ) ); }
  }

  return { cut: coll._spawnLive( cutRefs ), components };
};
