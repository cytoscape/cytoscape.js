const EMPTY: readonly number[] = [];

/**
 * Incremental per-node incident-edge lists: `outEdges[nodeSlot]` and
 * `inEdges[nodeSlot]` hold edge slots.  O(1) degree reads, direct
 * outgoers/incomers/connectedEdges, and cascade removal of incident edges.
 * (CSR is deferred; see issue #3486.)
 */
export class Adjacency {
  private out: ( number[] | undefined )[];
  private inn: ( number[] | undefined )[];

  constructor(){
    this.out = [];
    this.inn = [];
  }

  addEdge( edgeSlot: number, sourceSlot: number, targetSlot: number ): void {
    ( this.out[ sourceSlot ] ??= [] ).push( edgeSlot );
    ( this.inn[ targetSlot ] ??= [] ).push( edgeSlot );
  }

  removeEdge( edgeSlot: number, sourceSlot: number, targetSlot: number ): void {
    removeFrom( this.out[ sourceSlot ], edgeSlot );
    removeFrom( this.inn[ targetSlot ], edgeSlot );
  }

  outEdges( nodeSlot: number ): readonly number[] {
    return this.out[ nodeSlot ] ?? EMPTY;
  }

  inEdges( nodeSlot: number ): readonly number[] {
    return this.inn[ nodeSlot ] ?? EMPTY;
  }

  outDegree( nodeSlot: number ): number {
    return this.outEdges( nodeSlot ).length;
  }

  inDegree( nodeSlot: number ): number {
    return this.inEdges( nodeSlot ).length;
  }

  /** All incident edge slots (loop edges appear once). */
  connectedEdges( nodeSlot: number ): number[] {
    const out = this.outEdges( nodeSlot );
    const inn = this.inEdges( nodeSlot );
    const edges: number[] = [];

    for( const e of out ){ edges.push( e ); }

    for( const e of inn ){
      if( !out.includes( e ) ){ edges.push( e ); } // exclude loops already listed
    }

    return edges;
  }

  clearNode( nodeSlot: number ): void {
    this.out[ nodeSlot ] = undefined;
    this.inn[ nodeSlot ] = undefined;
  }
}

const removeFrom = ( list: number[] | undefined, value: number ): void => {
  if( list == null ){ return; }

  const i = list.indexOf( value );

  if( i >= 0 ){ list.splice( i, 1 ); }
};
