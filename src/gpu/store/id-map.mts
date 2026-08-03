import type { GroupName } from '../contract.mjs';
import { NO_SLOT } from '../contract.mjs';
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

Removal tombstones the probe entry and strands the id's blob bytes.
Stranded bytes are metered (`wasteBytes`) and reclaimed automatically:
when they exceed half the blob, the live byte ranges compact into a
fresh right-sized blob (peak-then-small graphs shrink back down).  The
probe table stores (group, slot) codes — never offsets — so it survives
a blob compaction untouched, as do the hashes and the decoded-name
cache; only the per-slot start/end offsets move.  Probe-table tombstones
reclaim separately, on the rehash in `ensure`.
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

const BLOB_MIN = 1024;
/** blobs smaller than this never compact (nothing worth reclaiming) */
const BLOB_COMPACT_FLOOR = 4096;

export class IdMap {
  private blob = new Uint8Array( BLOB_MIN );
  private blobLen = 0;
  private table = new Uint32Array( 64 );
  private tombs = 0;
  private scratch = new Uint8Array( 256 );
  private meta: Record<GroupName, GroupMeta> = { nodes: makeMeta(), edges: makeMeta() };
  private _size = 0;
  private waste = 0;

  /** stranded blob bytes from removed ids (the compaction meter) */
  get wasteBytes(): number {
    return this.waste;
  }

  /** blob bytes in use, stranded bytes included */
  get blobBytes(): number {
    return this.blobLen;
  }

  /** current blob capacity, in bytes */
  get blobCapacity(): number {
    return this.blob.length;
  }

  /**
   * Whether any element — node or edge — holds this id.  Ids are unique
   * across both groups, so this is also the uniqueness check `set` makes.
   *
   * @param id — the id to look up
   */
  has( id: string ): boolean {
    return this.findEntry( id ) !== EMPTY;
  }

  /**
   * Resolve an id to its group and slot.  Allocates a fresh result
   * object per hit but decodes no strings — the probe compares UTF-8
   * bytes in the blob against the encoded query.
   *
   * @param id — the id to look up
   * @returns the entry, or undefined when no element holds the id
   */
  get( id: string ): IdEntry | undefined {
    const entry = this.findEntry( id );

    if( entry === EMPTY ){ return undefined; }

    return { group: ( entry - BASE ) & 1 ? 'edges' : 'nodes', slot: ( entry - BASE ) >>> 1 };
  }

  /**
   * The id string at a slot — the reverse direction, and the only place
   * a JS string is ever materialized.  Decoding is lazy and cached per
   * slot, so a bulk-loaded graph pays string cost only for the elements
   * something actually asks about.
   *
   * @param group — the element group
   * @param slot — the slot within that group
   * @returns the id, or undefined when the slot holds none
   */
  idAt( group: GroupName, slot: number ): string | undefined {
    const m = this.meta[ group ];
    const cached = m.names[ slot ];

    if( cached != null ){ return cached; }
    if( slot >= m.start.length || m.start[ slot ] === 0 ){ return undefined; }

    const name = this.decode( m.start[ slot ] - 1, m.end[ slot ] - 1 );

    m.names[ slot ] = name;

    return name;
  }

  /** The stored id hash for a slot (0 when none) — stable across
   * sessions and machines for a given id string; the curve derivation
   * seeds hash-stable haystack angles from it (12c). */
  hashAt( group: GroupName, slot: number ): number {
    const m = this.meta[ group ];

    return slot < m.hash.length ? m.hash[ slot ] : 0;
  }

  /**
   * Bind an id to a (group, slot).  The id's bytes append to the blob;
   * nothing is written and no bytes are stranded when the id is already
   * taken, since the duplicate check runs before the append.
   *
   * @param id — the id to bind (unique across both groups)
   * @param group — the element group
   * @param slot — the slot within that group
   * @throws if another element already holds this id
   */
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

  /**
   * Unbind an id; a no-op when it is not registered.  The probe entry
   * becomes a tombstone and the id's blob bytes are stranded, so removal
   * itself is O(1) — but it may trigger the blob compaction (O(live
   * bytes)) once stranded bytes exceed half the blob.
   *
   * @param id — the id to unbind
   */
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
    this.waste += m.end[ slot ] - m.start[ slot ];
    m.start[ slot ] = 0;
    m.names[ slot ] = undefined;

    if( this.waste * 2 > this.blobLen && this.blobLen >= BLOB_COMPACT_FLOOR ){
      this.compactBlob();
    }
  }

  /** live ids across both groups (tombstones excluded) */
  get size(): number {
    return this._size;
  }

  /**
   * Slot-moving compaction (19.1): repoint one group's per-slot meta
   * through a monotone remap (`remap[old]` = new slot, or NO_SLOT) and
   * rebuild the probe table — its entries encode (group, slot) codes, so
   * every moved code changes.  Monotone means destinations sit at or
   * below their sources, so the ascending in-place walk never clobbers
   * an unconsumed entry (a lower slot's meta has already moved down, or
   * was a hole whose start offset is 0).  Blob offsets are untouched
   * (they key on bytes, not slots).
   */
  remapSlots( group: GroupName, remap: Uint32Array ): void {
    const m = this.meta[ group ];
    const n = Math.min( remap.length, m.start.length );

    for( let s = 0; s < n; s++ ){
      const d = remap[ s ];

      if( d === NO_SLOT || d === s ){ continue; }

      m.start[ d ] = m.start[ s ];
      m.end[ d ] = m.end[ s ];
      m.hash[ d ] = m.hash[ s ];
      m.names[ d ] = m.names[ s ];
      m.start[ s ] = 0;
      m.names[ s ] = undefined;
    }

    this.rehashFromMeta();
  }

  // -- internals --

  /** Rebuild the probe table from the per-slot meta of both groups
   * (entry codes embed slots, so a slot remap invalidates them all). */
  private rehashFromMeta(): void {
    this.table = new Uint32Array( this.table.length );
    this.tombs = 0;

    const mask = this.table.length - 1;

    for( const group of [ 'nodes', 'edges' ] as GroupName[] ){
      const m = this.meta[ group ];
      const bit = group === 'edges' ? 1 : 0;

      for( let slot = 0; slot < m.start.length; slot++ ){
        if( m.start[ slot ] === 0 ){ continue; }

        let at = m.hash[ slot ] & mask;

        while( this.table[ at ] !== EMPTY ){ at = ( at + 1 ) & mask; }

        this.table[ at ] = ( ( slot << 1 ) | bit ) + BASE;
      }
    }
  }

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

  /**
   * Reclaim stranded blob bytes: copy every live id's bytes into a fresh
   * right-sized blob and repoint the per-slot offsets.  The probe table,
   * hashes and name cache reference slots, not offsets, so they are
   * untouched.  O(live bytes); runs when stranded bytes exceed half the
   * blob, so the cost amortizes over the removals that stranded them.
   */
  private compactBlob(): void {
    // upper bound: bytes leaked on an error path aren't metered but are
    // dropped here all the same, so the copy may come in under this
    const liveLen = this.blobLen - this.waste;
    let cap = BLOB_MIN;

    while( cap < liveLen ){ cap *= 2; }

    const next = new Uint8Array( cap );
    let at = 0;

    for( const group of [ 'nodes', 'edges' ] as GroupName[] ){
      const m = this.meta[ group ];

      for( let slot = 0; slot < m.start.length; slot++ ){
        const lo = m.start[ slot ];

        if( lo === 0 ){ continue; }

        const len = m.end[ slot ] - lo;

        next.set( this.blob.subarray( lo - 1, lo - 1 + len ), at );
        m.start[ slot ] = at + 1;
        m.end[ slot ] = at + 1 + len;
        at += len;
      }
    }

    this.blob = next;
    this.blobLen = at;
    this.waste = 0;
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
