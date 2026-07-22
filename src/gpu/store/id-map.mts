import type { GroupName } from '../contract.mjs';

export interface IdEntry {
  group: GroupName;
  slot: number;
}

/**
 * String id ⇄ slot dictionary.  Ids are unique across both groups (as in
 * v3).  Slot → id lookup is a per-group dense array indexed by slot.
 */
export class IdMap {
  private entries: Map<string, IdEntry>;
  private names: { nodes: ( string | undefined )[]; edges: ( string | undefined )[] };

  constructor(){
    this.entries = new Map();
    this.names = { nodes: [], edges: [] };
  }

  has( id: string ): boolean {
    return this.entries.has( id );
  }

  get( id: string ): IdEntry | undefined {
    return this.entries.get( id );
  }

  idAt( group: GroupName, slot: number ): string | undefined {
    return this.names[ group ][ slot ];
  }

  set( id: string, group: GroupName, slot: number ): void {
    if( this.entries.has( id ) ){
      throw new Error( `Can not create second element with id '${id}'` );
    }

    this.entries.set( id, { group, slot } );
    this.names[ group ][ slot ] = id;
  }

  remove( id: string ): void {
    const entry = this.entries.get( id );

    if( entry == null ){ return; }

    this.names[ entry.group ][ entry.slot ] = undefined;
    this.entries.delete( id );
  }

  get size(): number {
    return this.entries.size;
  }
}
