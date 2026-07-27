import type { GpuCollection } from '../collection.mjs';
import type { Ref } from '../contract.mjs';
import { subgraph, eachIncident } from './algo-shared.mjs';

/**
 * Visit callback: `(v, e, u, i, depth)` — the visited node, the edge and
 * node it was reached from (undefined at roots), the visit counter, and the
 * depth from the nearest root.  Return `true` to stop and record `v` as
 * found; `false` to stop without.
 */
export type SearchVisitFn = (
  v: GpuCollection,
  e: GpuCollection | undefined,
  u: GpuCollection | undefined,
  i: number,
  depth: number
) => boolean | void;

export interface SearchOptions {
  roots?: GpuCollection;
  root?: GpuCollection;
  visit?: SearchVisitFn;
  directed?: boolean;
}

export interface SearchResult {
  path: GpuCollection;
  found: GpuCollection;
}

export type SearchArgs = [ ( SearchOptions | GpuCollection )?, ( SearchVisitFn | boolean )?, boolean? ];

const isCollection = ( value: unknown ): value is GpuCollection =>
  value != null && typeof value === 'object' && ( value as GpuCollection )._refs != null;

/**
 * Breadth/depth-first search over the calling collection's subgraph, with
 * v3's exact queue mechanics (visit order, multi-root behaviour, path
 * construction) transplanted onto slot-native iteration.
 */
export const search = ( coll: GpuCollection, bfs: boolean, args: SearchArgs ): SearchResult => {
  const [ rootsArg ] = args;
  let [ , fn, directed ] = args;
  let roots: GpuCollection | undefined;

  if( isCollection( rootsArg ) ){
    roots = rootsArg;
  } else if( rootsArg != null && typeof rootsArg === 'object' ){
    const options = rootsArg;
    const optRoots = options.roots ?? options.root;

    if( typeof optRoots === 'string' ){
      throw new TypeError( '`roots` must be a collection — v4 has no selector strings' );
    }

    roots = optRoots;
    fn = options.visit;
    directed = options.directed;
  } else if( typeof rootsArg === 'string' ){
    throw new TypeError( '`roots` must be a collection — v4 has no selector strings' );
  }

  // the v3 two-arg form: bfs(roots, directed)
  if( args.length === 2 && typeof fn !== 'function' ){ directed = fn as unknown as boolean; }

  const visit: SearchVisitFn = typeof fn === 'function' ? fn : () => undefined;
  const view = subgraph( coll );
  const { cy, store, endpoints, index, nodeSlots } = view;
  const n = nodeSlots.length;

  const visited = new Uint8Array( n );
  const depthOf = new Int32Array( n );
  const connectedBy = new Int32Array( n ).fill( -1 ); // edge slot reaching each node
  const visitOrder: number[] = []; // dense indices in connection order

  // v3 unshifts each root, so the initial queue is the roots reversed; the
  // main loop pushes to the back, bfs shifts from the front, dfs pops the back
  const q: number[] = [];
  let head = 0;

  if( roots != null ){
    for( const ref of roots._liveRefs() ){
      if( ref.group !== 'nodes' ){ continue; }

      const di = index.get( ref.slot );

      if( di == null ){ continue; }

      q.unshift( di );
      depthOf[ di ] = 0;

      if( bfs && !visited[ di ] ){
        visited[ di ] = 1;
        visitOrder.push( di );
      }
    }
  }

  let j = 0;
  let found = -1;

  while( q.length - head > 0 ){
    const v = bfs ? q[ head++ ] : ( q.pop() as number );

    if( !bfs ){
      if( visited[ v ] ){ continue; }

      visited[ v ] = 1;
      visitOrder.push( v );
    }

    const vSlot = nodeSlots[ v ];
    const prevEdgeSlot = connectedBy[ v ];
    let prevEdge: GpuCollection | undefined;
    let prevNode: GpuCollection | undefined;

    if( prevEdgeSlot >= 0 ){
      const s = endpoints[ prevEdgeSlot * 2 ];
      const t = endpoints[ prevEdgeSlot * 2 + 1 ];

      prevEdge = cy._ele( 'edges', prevEdgeSlot );
      prevNode = cy._ele( 'nodes', s === vSlot ? t : s );
    }

    const ret = visit( cy._ele( 'nodes', vSlot ), prevEdge, prevNode, j++, depthOf[ v ] );

    if( ret === true ){
      found = vSlot;
      break;
    }

    if( ret === false ){ break; }

    eachIncident( view, vSlot, directed === true, ( edgeSlot, otherSlot ) => {
      const w = index.get( otherSlot ) as number;

      if( visited[ w ] ){ return; }

      q.push( w );

      if( bfs ){
        visited[ w ] = 1;
        visitOrder.push( w );
      }

      connectedBy[ w ] = edgeSlot;
      depthOf[ w ] = depthOf[ v ] + 1;
    } );
  }

  const pathRefs: Ref[] = [];

  for( const di of visitOrder ){
    if( connectedBy[ di ] >= 0 ){ pathRefs.push( store.ref( 'edges', connectedBy[ di ] ) ); }

    pathRefs.push( store.ref( 'nodes', nodeSlots[ di ] ) );
  }

  return {
    path: coll._spawnLive( pathRefs ),
    found: found >= 0 ? cy._ele( 'nodes', found ) : cy.collection()
  };
};
