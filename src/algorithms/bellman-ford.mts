import type { Collection } from '../collection.mjs';
import type { Ref } from '../contract.mjs';
import { subgraph, firstNodeSlot, weightAt } from './algo-shared.mjs';
import type { WeightFn } from './algo-shared.mjs';

export interface BellmanFordOptions {
  root?: Collection | null;
  weight?: WeightFn;
  directed?: boolean;
  findNegativeWeightCycles?: boolean;
}

export interface BellmanFordResult {
  distanceTo( node: Collection ): number | undefined;
  pathTo( node: Collection, thisStart?: Collection ): Collection;
  hasNegativeWeightCycle: boolean;
  negativeWeightCycles: Collection[];
}

/** Single-source shortest paths allowing negative weights, with cycle detection. */
export const bellmanFord = ( coll: Collection, options: BellmanFordOptions = {} ): BellmanFordResult => {
  const view = subgraph( coll );
  const { store, endpoints, index, nodeSlots } = view;
  const rootSlot = firstNodeSlot( view, options.root, 'root' );

  if( rootSlot == null || !index.has( rootSlot ) ){
    throw new TypeError( 'bellmanFord requires a `root` node in the calling collection' );
  }

  const directed = options.directed === true;
  const weightOf = weightAt( view, options.weight );
  const n = nodeSlots.length;

  const dist = new Float64Array( n ).fill( Infinity );
  const pred = new Int32Array( n ).fill( -1 ); // dense index
  const edgeOf = new Int32Array( n ).fill( -1 ); // edge slot reaching each node

  dist[ index.get( rootSlot ) as number ] = 0;

  // non-loop subgraph edges whose endpoints are both in the subgraph
  const edges: number[] = [];

  for( const e of view.edgeSlots ){
    const s = endpoints[ e * 2 ];
    const t = endpoints[ e * 2 + 1 ];

    if( s !== t && index.has( s ) && index.has( t ) ){ edges.push( e ); }
  }

  const m = edges.length;
  const weights = new Float64Array( m );
  const srcIdx = new Int32Array( m );
  const tgtIdx = new Int32Array( m );

  for( let i = 0; i < m; i++ ){
    weights[ i ] = weightOf( edges[ i ] );
    srcIdx[ i ] = index.get( endpoints[ edges[ i ] * 2 ] ) as number;
    tgtIdx[ i ] = index.get( endpoints[ edges[ i ] * 2 + 1 ] ) as number;
  }

  let replacedEdge = false;

  // relax u → v via edge e, with v3's same-edge guard (never relax straight
  // back over the edge that reached u)
  const relax = ( u: number, v: number, e: number, w: number ): void => {
    const d = dist[ u ] + w;

    if( d < dist[ v ] && e !== edgeOf[ u ] ){
      dist[ v ] = d;
      pred[ v ] = u;
      edgeOf[ v ] = e;
      replacedEdge = true;
    }
  };

  for( let i = 1; i < n; i++ ){
    replacedEdge = false;

    for( let e = 0; e < m; e++ ){
      relax( srcIdx[ e ], tgtIdx[ e ], edges[ e ], weights[ e ] );

      if( !directed ){ relax( tgtIdx[ e ], srcIdx[ e ], edges[ e ], weights[ e ] ); }
    }

    if( !replacedEdge ){ break; }
  }

  let hasNegativeWeightCycle = false;
  const negativeWeightCycles: Collection[] = [];

  if( replacedEdge ){
    const cycleIds: string[] = [];

    for( let e = 0; e < m; e++ ){
      const u = srcIdx[ e ];
      const v = tgtIdx[ e ];
      const w = weights[ e ];
      const forward = dist[ u ] + w < dist[ v ];
      const backward = !directed && dist[ v ] + w < dist[ u ];

      if( !forward && !backward ){ continue; }

      if( !hasNegativeWeightCycle ){
        console.warn( 'Graph contains a negative weight cycle for Bellman-Ford' );
        hasNegativeWeightCycle = true;
      }

      if( options.findNegativeWeightCycles === false ){ break; }

      const negativeNodes: number[] = [];

      if( forward ){ negativeNodes.push( u ); }
      if( backward ){ negativeNodes.push( v ); }

      for( const start of negativeNodes ){
        // walk pred until a node repeats: entries alternate node dense index /
        // edge slot, mirroring v3's element cycle array
        let nodes: number[] = [ start ];
        let cycleEdges: number[] = [ edgeOf[ start ] ];
        let node = pred[ start ];

        while( nodes.indexOf( node ) === -1 ){
          nodes.push( node );
          cycleEdges.push( edgeOf[ node ] );
          node = pred[ node ];
        }

        const at = nodes.indexOf( node );

        nodes = nodes.slice( at );
        cycleEdges = cycleEdges.slice( at );

        // rotate the smallest node id to the front (v3's canonical form)
        let smallestId = store.idAt( 'nodes', nodeSlots[ nodes[ 0 ] ] ) as string;
        let smallestIndex = 0;

        for( let c = 1; c < nodes.length; c++ ){
          const id = store.idAt( 'nodes', nodeSlots[ nodes[ c ] ] ) as string;

          if( id < smallestId ){
            smallestId = id;
            smallestIndex = c;
          }
        }

        nodes = nodes.slice( smallestIndex ).concat( nodes.slice( 0, smallestIndex ) );
        cycleEdges = cycleEdges.slice( smallestIndex ).concat( cycleEdges.slice( 0, smallestIndex ) );

        const cycleId = nodes
          .map( ( ni, c ) => `${ store.idAt( 'nodes', nodeSlots[ ni ] ) },${ store.idAt( 'edges', cycleEdges[ c ] ) }` )
          .join( ',' );

        if( cycleIds.indexOf( cycleId ) === -1 ){
          cycleIds.push( cycleId );

          const refs: Ref[] = [];

          for( let c = 0; c < nodes.length; c++ ){
            refs.push( store.ref( 'nodes', nodeSlots[ nodes[ c ] ] ) );
            refs.push( store.ref( 'edges', cycleEdges[ c ] ) );
          }

          refs.push( store.ref( 'nodes', nodeSlots[ nodes[ 0 ] ] ) ); // close the cycle (deduped)
          negativeWeightCycles.push( coll._spawn( refs ) );
        }
      }
    }
  }

  const denseOf = ( node: Collection | undefined, name: string ): number | undefined => {
    const slot = firstNodeSlot( view, node, name );

    return slot == null ? undefined : index.get( slot );
  };

  return {
    distanceTo( node: Collection ): number | undefined {
      const i = denseOf( node, 'node' );

      return i == null ? undefined : dist[ i ];
    },

    pathTo( node: Collection, thisStart?: Collection ): Collection {
      const end = denseOf( node, 'node' );
      const start = thisStart == null ? ( index.get( rootSlot ) as number ) : denseOf( thisStart, 'thisStart' );
      const refs: Ref[] = [];
      let u = end;

      for( ;; ){
        if( u == null || u < 0 ){ return coll._spawn( [] ); } // unreachable → empty, as v3

        refs.unshift( store.ref( 'nodes', nodeSlots[ u ] ) );

        if( u === start ){ break; }

        if( edgeOf[ u ] >= 0 ){ refs.unshift( store.ref( 'edges', edgeOf[ u ] ) ); }

        u = pred[ u ];
      }

      return coll._spawnLive( refs );
    },

    hasNegativeWeightCycle,
    negativeWeightCycles
  };
};
