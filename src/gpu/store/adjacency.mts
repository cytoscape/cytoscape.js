const EMPTY = new Uint32Array( 0 );

/** What adjacency queries return: iterate or index it, don't mutate it. */
export type EdgeSlots = ArrayLike<number> & Iterable<number>;

/*
Incident-edge index: CSR base + incremental overlay.

A columnar bulk load builds CSR in two passes over the endpoints column
(count degrees → prefix sum → scatter): three Uint32Arrays per direction,
no per-node JS arrays.  Queries on a bulk-loaded graph return subarray
views — zero allocation.  Edges added after the build (or via the
per-element path) go to per-node overlay arrays; a query concatenates
only when a node actually has both CSR and overlay edges.

Removal compacts the edge out of its node's CSR run in place (order
preserved, O(degree) — the same cost the splice-based overlay pays), so
freed CSR space leaks until a future rebuild: the same accepted policy
as slot tombstones and id-blob bytes.
*/
export class Adjacency {
  // CSR base: prefix offsets (built once per bulk), effective lengths
  // (shrink on removal), edge slots.  Null until a bulk build happens.
  private csrOutOff: Uint32Array | null = null;
  private csrOutLen: Uint32Array | null = null;
  private csrOutE: Uint32Array | null = null;
  private csrInnOff: Uint32Array | null = null;
  private csrInnLen: Uint32Array | null = null;
  private csrInnE: Uint32Array | null = null;
  private csrN = 0;

  // incremental overlay
  private out: ( number[] | undefined )[] = [];
  private inn: ( number[] | undefined )[] = [];
  private overlayCount = 0;

  addEdge( edgeSlot: number, sourceSlot: number, targetSlot: number ): void {
    ( this.out[ sourceSlot ] ??= [] ).push( edgeSlot );
    ( this.inn[ targetSlot ] ??= [] ).push( edgeSlot );
    this.overlayCount++;
  }

  /**
   * Bulk registration from a columnar ingest: `endpoints` is the
   * interleaved edge.endpoints column, indexed by the slots in
   * `edgeSlots`.  On a fresh index this builds CSR in two counting
   * passes; otherwise the edges append to the overlay.
   */
  addBulk( edgeSlots: Uint32Array, endpoints: Uint32Array, nodeCap: number ): void {
    if( this.csrOutOff != null || this.overlayCount > 0 ){
      for( const slot of edgeSlots ){
        this.addEdge( slot, endpoints[ slot * 2 ], endpoints[ slot * 2 + 1 ] );
      }

      return;
    }

    const e = edgeSlots.length;
    const outLen = new Uint32Array( nodeCap );
    const innLen = new Uint32Array( nodeCap );

    for( let i = 0; i < e; i++ ){
      outLen[ endpoints[ edgeSlots[ i ] * 2 ] ]++;
      innLen[ endpoints[ edgeSlots[ i ] * 2 + 1 ] ]++;
    }

    const outOff = new Uint32Array( nodeCap + 1 );
    const innOff = new Uint32Array( nodeCap + 1 );

    for( let n = 0; n < nodeCap; n++ ){
      outOff[ n + 1 ] = outOff[ n ] + outLen[ n ];
      innOff[ n + 1 ] = innOff[ n ] + innLen[ n ];
    }

    const outE = new Uint32Array( e );
    const innE = new Uint32Array( e );
    const outCur = outOff.slice( 0, nodeCap );
    const innCur = innOff.slice( 0, nodeCap );

    for( let i = 0; i < e; i++ ){
      const slot = edgeSlots[ i ];

      outE[ outCur[ endpoints[ slot * 2 ] ]++ ] = slot;
      innE[ innCur[ endpoints[ slot * 2 + 1 ] ]++ ] = slot;
    }

    this.csrOutOff = outOff;
    this.csrOutLen = outLen;
    this.csrOutE = outE;
    this.csrInnOff = innOff;
    this.csrInnLen = innLen;
    this.csrInnE = innE;
    this.csrN = nodeCap;
  }

  removeEdge( edgeSlot: number, sourceSlot: number, targetSlot: number ): void {
    if( !this.removeFromCsr( edgeSlot, sourceSlot, this.csrOutOff, this.csrOutLen, this.csrOutE ) ){
      if( removeFrom( this.out[ sourceSlot ], edgeSlot ) ){ this.overlayCount--; }
    }

    if( !this.removeFromCsr( edgeSlot, targetSlot, this.csrInnOff, this.csrInnLen, this.csrInnE ) ){
      if( removeFrom( this.inn[ targetSlot ], edgeSlot ) ){ this.overlayCount--; }
    }
  }

  outEdges( nodeSlot: number ): EdgeSlots {
    return this.edgesFor( nodeSlot, this.csrOutOff, this.csrOutLen, this.csrOutE, this.out );
  }

  inEdges( nodeSlot: number ): EdgeSlots {
    return this.edgesFor( nodeSlot, this.csrInnOff, this.csrInnLen, this.csrInnE, this.inn );
  }

  outDegree( nodeSlot: number ): number {
    return this.csrLen( nodeSlot, this.csrOutLen ) + ( this.out[ nodeSlot ]?.length ?? 0 );
  }

  inDegree( nodeSlot: number ): number {
    return this.csrLen( nodeSlot, this.csrInnLen ) + ( this.inn[ nodeSlot ]?.length ?? 0 );
  }

  /** All incident edge slots (loop edges appear once). */
  connectedEdges( nodeSlot: number ): number[] {
    const out = this.outEdges( nodeSlot );
    const inn = this.inEdges( nodeSlot );
    const edges: number[] = [];

    for( const e of out ){ edges.push( e ); }

    for( const e of inn ){
      if( !includes( out, e ) ){ edges.push( e ); } // exclude loops already listed
    }

    return edges;
  }

  clearNode( nodeSlot: number ): void {
    if( this.csrOutLen != null && nodeSlot < this.csrN ){
      this.csrOutLen[ nodeSlot ] = 0;
      this.csrInnLen![ nodeSlot ] = 0;
    }

    this.overlayCount -= ( this.out[ nodeSlot ]?.length ?? 0 ) + ( this.inn[ nodeSlot ]?.length ?? 0 );
    this.out[ nodeSlot ] = undefined;
    this.inn[ nodeSlot ] = undefined;
  }

  // -- internals --

  private csrLen( nodeSlot: number, len: Uint32Array | null ): number {
    return len != null && nodeSlot < this.csrN ? len[ nodeSlot ] : 0;
  }

  private edgesFor(
    nodeSlot: number,
    off: Uint32Array | null, len: Uint32Array | null, e: Uint32Array | null,
    overlay: ( number[] | undefined )[]
  ): EdgeSlots {
    const extra = overlay[ nodeSlot ];
    const n = this.csrLen( nodeSlot, len );

    if( n === 0 ){ return extra ?? EMPTY; }

    const base = e!.subarray( off![ nodeSlot ], off![ nodeSlot ] + n );

    if( extra == null || extra.length === 0 ){ return base; }

    const both = new Array<number>( n + extra.length );

    for( let i = 0; i < n; i++ ){ both[ i ] = base[ i ]; }
    for( let i = 0; i < extra.length; i++ ){ both[ n + i ] = extra[ i ]; }

    return both;
  }

  /** Compact `edgeSlot` out of the node's CSR run, preserving order; false when not there. */
  private removeFromCsr(
    edgeSlot: number, nodeSlot: number,
    off: Uint32Array | null, len: Uint32Array | null, e: Uint32Array | null
  ): boolean {
    const n = this.csrLen( nodeSlot, len );

    if( n === 0 ){ return false; }

    const lo = off![ nodeSlot ];

    for( let i = lo; i < lo + n; i++ ){
      if( e![ i ] === edgeSlot ){
        e!.copyWithin( i, i + 1, lo + n );
        len![ nodeSlot ] = n - 1;

        return true;
      }
    }

    return false;
  }
}

const removeFrom = ( list: number[] | undefined, value: number ): boolean => {
  if( list == null ){ return false; }

  const i = list.indexOf( value );

  if( i < 0 ){ return false; }

  list.splice( i, 1 );

  return true;
};

const includes = ( list: EdgeSlots, value: number ): boolean => {
  for( let i = 0; i < list.length; i++ ){
    if( list[ i ] === value ){ return true; }
  }

  return false;
};
