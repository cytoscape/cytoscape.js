import type { Ref } from '../contract.mjs';
import type { GraphStore } from '../store/graph-store.mjs';
import type { GpuCore } from '../core.mjs';
import type { GpuCollection } from '../collection.mjs';

/** Edge weighting function: receives the edge handle, returns its weight. */
export type WeightFn = ( edge: GpuCollection ) => number;

/**
 * A slot-native view of the calling collection as a subgraph: the live node
 * slots in collection order with a dense [0, N) index, plus the live edge
 * slots (in collection order) and their membership set.  Algorithms walk the
 * CSR adjacency but only traverse edges in `edgeIn` toward nodes in `index` —
 * v3's "the algorithm runs on the calling collection" semantics.
 */
export interface SubgraphView {
  cy: GpuCore;
  store: GraphStore;
  coll: GpuCollection;
  endpoints: Uint32Array;
  /** live node slots, collection order */
  nodeSlots: number[];
  /** node slot → dense index */
  index: Map<number, number>;
  /** live edge slots, collection order */
  edgeSlots: number[];
  edgeIn: Set<number>;
}

export const subgraph = ( coll: GpuCollection ): SubgraphView => {
  const cy = coll.cy();
  const store = cy._store;
  const endpoints = store.column( 'edge.endpoints' ) as Uint32Array;
  const nodeSlots: number[] = [];
  const index = new Map<number, number>();
  const edgeSlots: number[] = [];
  const edgeIn = new Set<number>();

  for( const ref of coll._liveRefs() ){
    if( ref.group === 'nodes' ){
      if( !index.has( ref.slot ) ){
        index.set( ref.slot, nodeSlots.length );
        nodeSlots.push( ref.slot );
      }
    } else if( !edgeIn.has( ref.slot ) ){
      edgeIn.add( ref.slot );
      edgeSlots.push( ref.slot );
    }
  }

  return { cy, store, coll, endpoints, nodeSlots, index, edgeSlots, edgeIn };
};

/**
 * Visit each subgraph edge incident to node slot `u` (skipping loops, edges
 * outside the collection, and edges whose far endpoint is outside it).
 * Directed: out-edges only; undirected: out then in.
 */
export const eachIncident = (
  view: SubgraphView,
  u: number,
  directed: boolean,
  cb: ( edgeSlot: number, otherSlot: number ) => void
): void => {
  const { store, endpoints, edgeIn, index } = view;
  const out = store.adj.outEdges( u );

  for( let i = 0; i < out.length; i++ ){
    const e = out[ i ];
    const t = endpoints[ e * 2 + 1 ];

    if( t === u || !edgeIn.has( e ) || !index.has( t ) ){ continue; }

    cb( e, t );
  }

  if( directed ){ return; }

  const inn = store.adj.inEdges( u );

  for( let i = 0; i < inn.length; i++ ){
    const e = inn[ i ];
    const s = endpoints[ e * 2 ];

    if( s === u || !edgeIn.has( e ) || !index.has( s ) ){ continue; }

    cb( e, s );
  }
};

/**
 * The first live node slot of an argument collection, or undefined.  v4 takes
 * collections only — a string argument throws, consistent with the matcher.
 */
export const firstNodeSlot = ( view: SubgraphView, arg: unknown, name: string ): number | undefined => {
  if( typeof arg === 'string' ){
    throw new TypeError( `\`${ name }\` must be a collection — v4 has no selector strings` );
  }

  const coll = arg as GpuCollection | null | undefined;

  if( coll == null || coll._liveRefs == null ){ return undefined; }

  for( const ref of coll._liveRefs() ){
    if( ref.group === 'nodes' ){ return ref.slot; }
  }

  return undefined;
};

/** Wrap a user weight function (handles interning per call) or default to 1. */
export const weightAt = ( view: SubgraphView, weight: WeightFn | undefined ): ( edgeSlot: number ) => number => {
  if( weight == null ){ return () => 1; }

  return edgeSlot => weight( view.cy._ele( 'edges', edgeSlot ) );
};

export const nodeRef = ( view: SubgraphView, slot: number ): Ref => view.store.ref( 'nodes', slot );

export const edgeRef = ( view: SubgraphView, slot: number ): Ref => view.store.ref( 'edges', slot );

/**
 * Indexed binary min-heap over dense node indices, keyed by a caller-owned
 * score array read at compare time.  Supports decrease-key via `update`.
 */
export class NodeHeap {
  private heap: Int32Array;
  private pos: Int32Array;
  private n = 0;

  constructor( capacity: number, private score: Float64Array ){
    this.heap = new Int32Array( capacity );
    this.pos = new Int32Array( capacity ).fill( -1 );
  }

  get size(): number {
    return this.n;
  }

  push( i: number ): void {
    this.heap[ this.n ] = i;
    this.pos[ i ] = this.n;
    this.up( this.n++ );
  }

  pop(): number {
    const root = this.heap[ 0 ];

    this.n--;
    this.pos[ root ] = -1;

    if( this.n > 0 ){
      const last = this.heap[ this.n ];

      this.heap[ 0 ] = last;
      this.pos[ last ] = 0;
      this.down( 0 );
    }

    return root;
  }

  /** Restore heap order after `score[i]` decreased. */
  update( i: number ): void {
    const p = this.pos[ i ];

    if( p >= 0 ){ this.up( p ); }
  }

  has( i: number ): boolean {
    return this.pos[ i ] >= 0;
  }

  private up( p: number ): void {
    const { heap, pos, score } = this;
    const item = heap[ p ];
    const s = score[ item ];

    while( p > 0 ){
      const parent = ( p - 1 ) >> 1;
      const parentItem = heap[ parent ];

      if( score[ parentItem ] <= s ){ break; }

      heap[ p ] = parentItem;
      pos[ parentItem ] = p;
      p = parent;
    }

    heap[ p ] = item;
    pos[ item ] = p;
  }

  private down( p: number ): void {
    const { heap, pos, score, n } = this;
    const item = heap[ p ];
    const s = score[ item ];

    for( ;; ){
      const left = p * 2 + 1;

      if( left >= n ){ break; }

      const right = left + 1;
      const child = right < n && score[ heap[ right ] ] < score[ heap[ left ] ] ? right : left;
      const childItem = heap[ child ];

      if( score[ childItem ] >= s ){ break; }

      heap[ p ] = childItem;
      pos[ childItem ] = p;
      p = child;
    }

    heap[ p ] = item;
    pos[ item ] = p;
  }
}
