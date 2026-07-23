import type { GroupName } from '../contract.mjs';
import type { GpuPackedIds } from '../gpu-types.mjs';
import { isPackedIds } from '../columnar.mjs';

export interface IdEntry {
  group: GroupName;
  slot: number;
}

/*
String id ⇄ slot dictionary, blob-native: ids live as UTF-8 bytes in one
growable blob, indexed by an open-addressing probe table (Uint32Array,
linear probing, FNV-1a over the bytes).  No JS strings are stored — a
packed bulk ingest (the wire format's id section) memcpys the bytes and
never materializes strings at all; `idAt` decodes lazily and caches per
slot, so string cost is paid per element *touched*, not per element
loaded.  Ids are unique across both groups (as in v3).

Removal tombstones the probe entry; the id's blob bytes leak until a
future compaction — the same policy as slot tombstones in the tables.
*/

const EMPTY = 0;
const TOMB = 1;
const BASE = 2; // live entries encode as ((slot << 1) | groupBit) + BASE

const decoder = new TextDecoder();
const encoder = new TextEncoder();

const fnv = ( bytes: Uint8Array, lo: number, hi: number ): number => {
  let h = 0x811c9dc5;

  for( let i = lo; i < hi; i++ ){
    h ^= bytes[ i ];
    h = Math.imul( h, 0x01000193 );
  }

  return h >>> 0;
};

interface GroupMeta {
  /** 1-based blob byte offsets per slot; 0 = no id at this slot */
  start: Uint32Array;
  end: Uint32Array;
  hash: Uint32Array;
  /** lazily decoded string cache */
  names: ( string | undefined )[];
}

const makeMeta = (): GroupMeta => ( {
  start: new Uint32Array( 0 ), end: new Uint32Array( 0 ), hash: new Uint32Array( 0 ), names: []
} );

export class IdMap {
  private blob = new Uint8Array( 1024 );
  private blobLen = 0;
  private table = new Uint32Array( 64 );
  private tombs = 0;
  private scratch = new Uint8Array( 256 );
  private meta: Record<GroupName, GroupMeta> = { nodes: makeMeta(), edges: makeMeta() };
  private _size = 0;

  has( id: string ): boolean {
    return this.findEntry( id ) !== EMPTY;
  }

  get( id: string ): IdEntry | undefined {
    const entry = this.findEntry( id );

    if( entry === EMPTY ){ return undefined; }

    return { group: ( entry - BASE ) & 1 ? 'edges' : 'nodes', slot: ( entry - BASE ) >>> 1 };
  }

  idAt( group: GroupName, slot: number ): string | undefined {
    const m = this.meta[ group ];
    const cached = m.names[ slot ];

    if( cached != null ){ return cached; }
    if( slot >= m.start.length || m.start[ slot ] === 0 ){ return undefined; }

    const name = this.decode( m.start[ slot ] - 1, m.end[ slot ] - 1 );

    m.names[ slot ] = name;

    return name;
  }

  set( id: string, group: GroupName, slot: number ): void {
    this.ensure( this._size + 1 );

    const len = this.encodeScratch( id );
    const h = fnv( this.scratch, 0, len );
    const { found, at } = this.probe( h, this.scratch, 0, len );

    if( found !== EMPTY ){
      throw new Error( `Can not create second element with id '${id}'` );
    }

    const lo = this.append( this.scratch, 0, len );

    this.place( at, group, slot, lo, lo + len, h );
  }

  /**
   * Bulk registration for columnar ingest.  The packed form (the wire
   * format's id section) is one blob memcpy + per-id hash/probe — no JS
   * strings.  Holes (zero-length / undefined ids) get `newId()`.
   */
  setBulk(
    group: GroupName, slots: Uint32Array,
    ids: ( string | undefined )[] | GpuPackedIds | undefined,
    newId: () => string
  ): void {
    this.ensure( this._size + slots.length );

    if( ids != null && isPackedIds( ids ) ){
      const base = this.append( ids.blob, 0, ids.offsets[ slots.length ] );

      for( let i = 0; i < slots.length; i++ ){
        const lo = base + ids.offsets[ i ];
        const hi = base + ids.offsets[ i + 1 ];

        if( hi <= lo ){
          this.set( newId(), group, slots[ i ] );
          continue;
        }

        const h = fnv( this.blob, lo, hi );
        const { found, at } = this.probe( h, this.blob, lo, hi );

        if( found !== EMPTY ){
          throw new Error( `Can not create second element with id '${this.decode( lo, hi )}'` );
        }

        this.place( at, group, slots[ i ], lo, hi, h );
      }

      return;
    }

    const list = ids as ( string | undefined )[] | undefined;

    for( let i = 0; i < slots.length; i++ ){
      this.set( list?.[ i ] ?? newId(), group, slots[ i ] );
    }
  }

  remove( id: string ): void {
    const len = this.encodeScratch( id );
    const h = fnv( this.scratch, 0, len );
    const { found, at } = this.probe( h, this.scratch, 0, len );

    if( found === EMPTY ){ return; }

    const slot = ( found - BASE ) >>> 1;
    const m = this.meta[ ( found - BASE ) & 1 ? 'edges' : 'nodes' ];

    this.table[ at ] = TOMB;
    this.tombs++;
    this._size--;
    m.start[ slot ] = 0;
    m.names[ slot ] = undefined;
  }

  get size(): number {
    return this._size;
  }

  // -- internals --

  /** Linear probe: EMPTY table code when absent (`at` = insertion point), else the entry code. */
  private probe( h: number, bytes: Uint8Array, lo: number, hi: number ): { found: number; at: number } {
    const mask = this.table.length - 1;
    let at = h & mask;
    let insertAt = -1;

    for( ;; ){
      const entry = this.table[ at ];

      if( entry === EMPTY ){
        return { found: EMPTY, at: insertAt === -1 ? at : insertAt };
      }

      if( entry === TOMB ){
        if( insertAt === -1 ){ insertAt = at; }
      } else {
        const slot = ( entry - BASE ) >>> 1;
        const m = this.meta[ ( entry - BASE ) & 1 ? 'edges' : 'nodes' ];

        if( m.hash[ slot ] === h ){
          const elo = m.start[ slot ] - 1;
          const ehi = m.end[ slot ] - 1;

          if( ehi - elo === hi - lo ){
            let eq = true;

            for( let i = elo, j = lo; i < ehi; i++, j++ ){
              if( this.blob[ i ] !== bytes[ j ] ){ eq = false; break; }
            }

            if( eq ){ return { found: entry, at }; }
          }
        }
      }

      at = ( at + 1 ) & mask;
    }
  }

  private findEntry( id: string ): number {
    const len = this.encodeScratch( id );

    return this.probe( fnv( this.scratch, 0, len ), this.scratch, 0, len ).found;
  }

  private place( at: number, group: GroupName, slot: number, lo: number, hi: number, h: number ): void {
    if( this.table[ at ] === TOMB ){ this.tombs--; }

    this.table[ at ] = ( ( slot << 1 ) | ( group === 'edges' ? 1 : 0 ) ) + BASE;

    const m = this.meta[ group ];

    if( slot >= m.start.length ){
      const newLen = Math.max( 64, m.start.length * 2, slot + 1 );
      const grow = ( old: Uint32Array ): Uint32Array => {
        const next = new Uint32Array( newLen );

        next.set( old );

        return next;
      };

      m.start = grow( m.start );
      m.end = grow( m.end );
      m.hash = grow( m.hash );
    }

    m.start[ slot ] = lo + 1;
    m.end[ slot ] = hi + 1;
    m.hash[ slot ] = h;
    m.names[ slot ] = undefined;
    this._size++;
  }

  /** Grow + rehash so live entries + tombstones stay under half the table. */
  private ensure( entries: number ): void {
    if( ( entries + this.tombs ) * 2 <= this.table.length ){ return; }

    let cap = this.table.length;

    while( entries * 2 > cap ){ cap *= 2; }

    const old = this.table;

    this.table = new Uint32Array( cap );
    this.tombs = 0;

    const mask = cap - 1;

    for( const entry of old ){
      if( entry === EMPTY || entry === TOMB ){ continue; }

      const slot = ( entry - BASE ) >>> 1;
      const m = this.meta[ ( entry - BASE ) & 1 ? 'edges' : 'nodes' ];
      let at = m.hash[ slot ] & mask;

      while( this.table[ at ] !== EMPTY ){ at = ( at + 1 ) & mask; }

      this.table[ at ] = entry;
    }
  }

  /** UTF-8 encode into the scratch buffer; returns the byte length. */
  private encodeScratch( id: string ): number {
    if( this.scratch.length < id.length * 3 ){
      this.scratch = new Uint8Array( Math.max( id.length * 3, this.scratch.length * 2 ) );
    }

    // ASCII fast path: charCode == byte
    for( let i = 0; i < id.length; i++ ){
      const c = id.charCodeAt( i );

      if( c > 127 ){ return encoder.encodeInto( id, this.scratch ).written; }

      this.scratch[ i ] = c;
    }

    return id.length;
  }

  private decode( lo: number, hi: number ): string {
    // ASCII fast path: fromCharCode beats a TextDecoder call for short ids
    if( hi - lo <= 64 ){
      let ascii = true;

      for( let i = lo; i < hi; i++ ){
        if( this.blob[ i ] > 127 ){ ascii = false; break; }
      }

      if( ascii ){ return String.fromCharCode( ...this.blob.subarray( lo, hi ) ); }
    }

    return decoder.decode( this.blob.subarray( lo, hi ) );
  }

  /** Append bytes to the blob (amortized-doubling growth); returns their offset. */
  private append( src: Uint8Array, lo: number, hi: number ): number {
    const len = hi - lo;

    if( this.blobLen + len > this.blob.length ){
      const next = new Uint8Array( Math.max( this.blob.length * 2, this.blobLen + len ) );

      next.set( this.blob.subarray( 0, this.blobLen ) );
      this.blob = next;
    }

    this.blob.set( src.subarray( lo, hi ), this.blobLen );

    const at = this.blobLen;

    this.blobLen += len;

    return at;
  }
}
