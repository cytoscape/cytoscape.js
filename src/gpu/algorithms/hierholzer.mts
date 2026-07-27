import type { GpuCollection } from '../collection.mjs';
import type { Ref } from '../contract.mjs';
import { subgraph, incidentEdgesInView, firstNodeSlot } from './algo-shared.mjs';

export interface HierholzerOptions {
  root?: GpuCollection;
  directed?: boolean;
}

export interface HierholzerResult {
  found: boolean;
  /**
   * the trail's elements in first-traversal order (a collection is a set, so
   * revisited nodes appear once — v3's trail dedupes the same way)
   */
  trail: GpuCollection | undefined;
}

export type HierholzerArgs = [ ( HierholzerOptions | GpuCollection )?, boolean? ];

const isCollection = ( value: unknown ): value is GpuCollection =>
  value != null && typeof value === 'object' && ( value as GpuCollection )._refs != null;

/**
 * Hierholzer's algorithm: an Eulerian trail/circuit over the calling
 * collection, if one exists.  A faithful port of the v3 pass, on slot-keyed
 * adjacency.
 */
export const hierholzer = ( coll: GpuCollection, args: HierholzerArgs ): HierholzerResult => {
  let options: HierholzerOptions;

  if( args[0] != null && !isCollection( args[0] ) && typeof args[0] === 'object' ){
    options = args[0];
  } else {
    options = { root: args[0] as GpuCollection | undefined, directed: args[1] };
  }

  const view = subgraph( coll );
  const { store, endpoints, index, nodeSlots } = view;
  const dir = options.directed === true;
  const result: HierholzerResult = { found: false, trail: undefined };

  if( nodeSlots.length === 0 ){ return result; }

  let startVertex = firstNodeSlot( view, options.root, 'root' );

  // adjacency (edge slot lists) and degree imbalance bookkeeping, as v3
  const nodesAdj = new Map<number, number[]>();
  let dflag = false;
  let oddIn: number | undefined;
  let oddOut: number | undefined;

  if( dir ){
    const ind = new Int32Array( nodeSlots.length );
    const outd = new Int32Array( nodeSlots.length );

    for( const e of view.edgeSlots ){
      const s = index.get( endpoints[ e * 2 ] );
      const t = index.get( endpoints[ e * 2 + 1 ] );

      if( s == null || t == null ){ continue; }

      outd[ s ]++;
      ind[ t ]++;
    }

    for( let i = 0; i < nodeSlots.length; i++ ){
      const slot = nodeSlots[ i ];
      const d1 = ind[ i ] - outd[ i ];
      const d2 = outd[ i ] - ind[ i ];

      if( d1 === 1 ){
        if( oddIn != null ){ dflag = true; }
        else { oddIn = slot; }
      } else if( d2 === 1 ){
        if( oddOut != null ){ dflag = true; }
        else { oddOut = slot; }
      } else if( d2 > 1 || d1 > 1 ){
        dflag = true;
      }

      const outEdges: number[] = [];

      for( const e of store.adj.outEdges( slot ) ){
        if( view.edgeIn.has( e ) && index.has( endpoints[ e * 2 + 1 ] ) ){ outEdges.push( e ); }
      }

      nodesAdj.set( slot, outEdges );
    }
  } else {
    const deg = new Int32Array( nodeSlots.length );

    for( const e of view.edgeSlots ){
      const s = index.get( endpoints[ e * 2 ] );
      const t = index.get( endpoints[ e * 2 + 1 ] );

      if( s == null || t == null ){ continue; }

      deg[ s ]++;
      deg[ t ]++; // loops count twice, matching v3's degree(true)
    }

    for( let i = 0; i < nodeSlots.length; i++ ){
      const slot = nodeSlots[ i ];

      if( deg[ i ] % 2 ){
        if( oddIn == null ){ oddIn = slot; }
        else if( oddOut == null ){ oddOut = slot; }
        else { dflag = true; }
      }

      nodesAdj.set( slot, incidentEdgesInView( view, slot ).filter( e =>
        index.has( endpoints[ e * 2 ] ) && index.has( endpoints[ e * 2 + 1 ] ) ) );
    }
  }

  if( dflag ){ return result; }

  if( oddOut != null && oddIn != null ){
    if( dir ){
      if( startVertex != null && oddOut !== startVertex ){ return result; }

      startVertex = oddOut;
    } else {
      if( startVertex != null && oddOut !== startVertex && oddIn !== startVertex ){
        return result;
      } else if( startVertex == null ){
        startVertex = oddOut;
      }
    }
  } else if( startVertex == null ){
    startVertex = nodeSlots[ 0 ];
  }

  // walk until stuck; subtour is the reversed walk: [node, edge, ..., start]
  const walk = ( v: number ): number[] => {
    let current = v;
    const subtour: number[] = [ v ];

    for( ;; ){
      const adjList = nodesAdj.get( current ) as number[];

      if( adjList.length === 0 ){ break; }

      const adj = adjList.shift() as number;
      const tail = endpoints[ adj * 2 ];
      const head = endpoints[ adj * 2 + 1 ];

      if( current !== head ){
        nodesAdj.set( head, ( nodesAdj.get( head ) as number[] ).filter( e => e !== adj ) );
        current = head;
      } else if( !dir && current !== tail ){
        nodesAdj.set( tail, ( nodesAdj.get( tail ) as number[] ).filter( e => e !== adj ) );
        current = tail;
      }

      subtour.unshift( adj );
      subtour.unshift( current );
    }

    return subtour;
  };

  const trailRefs: Ref[] = [];
  let subtour = walk( startVertex );

  while( subtour.length !== 1 ){
    if( ( nodesAdj.get( subtour[ 0 ] ) as number[] ).length === 0 ){
      trailRefs.unshift( store.ref( 'nodes', subtour.shift() as number ) );
      trailRefs.unshift( store.ref( 'edges', subtour.shift() as number ) );
    } else {
      subtour = walk( subtour.shift() as number ).concat( subtour );
    }
  }

  trailRefs.unshift( store.ref( 'nodes', subtour.shift() as number ) ); // final node

  for( const adjList of nodesAdj.values() ){
    if( adjList.length > 0 ){ return result; } // unreached edges: no trail
  }

  result.found = true;
  result.trail = coll._spawn( trailRefs ); // dedupes: first-traversal order

  return result;
};
