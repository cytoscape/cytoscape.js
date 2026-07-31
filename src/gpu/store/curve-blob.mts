/*
CurveBlob (round 12b): the variable-length curve parameter pool.

The fixed f32×4 edge.curveParams column cannot hold the 12b families'
lists (control-point distances/weights, segment distance/weight/radius
records), so blob-backed kinds store a header there —
[blobOffset, dev, n, kind] — pointing into this pool of f32 records:

- CURVE_MULTI:    [edgeDistances, d0, w0, d1, w1, ...]        (1 + 2n)
- CURVE_SEGMENTS: [edgeDistances, round, d0, w0, r0, arc0, ...] (2 + 4n)
- CURVE_TAXI:     [dir, turn, turnIsPercent, minD, edgeDistances,
                   round, radius, arcMode]                      (8)

Records are position-independent (offsets/weights in the endpoint
frame), so drags/layouts/position tweens follow on-GPU with zero blob
traffic — a record is written only when the edge's *style* re-derives.

Storage behaviour follows the slot-stable compaction policy (round 11):
append allocation with per-slot ranges, same-length rewrites in place,
freed ranges metered as waste, and automatic compaction when waste
exceeds half the live floats (256-float floor).  Compaction rewrites
records in slot order and reports each move through `onRelocate` so the
store can rewrite the params-column header (a normal column write, so
the renderer sees it as a dirty span).  The renderer mirrors
[0, length()) into a storage buffer via the usual coalesced-span /
realloc-on-resize rules (the delta's `curveBlob` entry).
*/

const FLOOR_FLOATS = 256;

export class CurveBlob {
  private pool: Float32Array;
  /** append cursor (floats) */
  private used: number;
  /** per-slot record offsets (-1 = none) and lengths */
  private offsets: Int32Array;
  private lengths: Int32Array;
  private liveFloats: number;
  private wasteFloats: number;
  /** coalesced dirty span [start, end) in floats; -1 start = clean */
  private dirtyStart: number;
  private dirtyEnd: number;
  private resized: boolean;
  private onRelocate: ( slot: number, offset: number ) => void;

  constructor( onRelocate: ( slot: number, offset: number ) => void ){
    this.pool = new Float32Array( 0 );
    this.used = 0;
    this.offsets = new Int32Array( 0 );
    this.lengths = new Int32Array( 0 );
    this.liveFloats = 0;
    this.wasteFloats = 0;
    this.dirtyStart = -1;
    this.dirtyEnd = -1;
    this.resized = false;
    this.onRelocate = onRelocate;
  }

  data(): Float32Array {
    return this.pool;
  }

  /** floats in use (the renderer mirrors [0, length())) */
  length(): number {
    return this.used;
  }

  /** the record offset for a slot, or -1 */
  offsetOf( slot: number ): number {
    return slot < this.offsets.length ? this.offsets[ slot ] : -1;
  }

  /**
   * Write a slot's record: same-length records rewrite in place, others
   * free the old range and append.  Returns the record's offset (which
   * the caller stores in the params-column header).
   */
  write( slot: number, values: ArrayLike<number> ): number {
    this.ensureSlot( slot );

    const len = values.length;
    let off = this.offsets[ slot ];

    if( off >= 0 && this.lengths[ slot ] === len ){
      // in-place rewrite
      for( let i = 0; i < len; i++ ){ this.pool[ off + i ] = values[ i ]; }

      this.mark( off, off + len );

      return off;
    }

    if( off >= 0 ){ this.freeRange( slot ); }

    off = this.used;
    this.ensureCapacity( off + len );

    for( let i = 0; i < len; i++ ){ this.pool[ off + i ] = values[ i ]; }

    this.used = off + len;
    this.offsets[ slot ] = off;
    this.lengths[ slot ] = len;
    this.liveFloats += len;
    this.mark( off, off + len );
    this.maybeCompact();

    return this.offsets[ slot ];
  }

  /** Release a slot's record (no-op when it has none). */
  free( slot: number ): void {
    if( slot >= this.offsets.length || this.offsets[ slot ] < 0 ){ return; }

    this.freeRange( slot );
    this.maybeCompact();
  }

  /** The blob's dirty state since the last call; returns-and-clears. */
  takeDirty(): { resized: boolean; start: number; end: number } | null {
    if( !this.resized && this.dirtyStart < 0 ){ return null; }

    const out = {
      resized: this.resized,
      start: this.resized ? 0 : this.dirtyStart,
      end: this.resized ? this.used : this.dirtyEnd
    };

    this.resized = false;
    this.dirtyStart = -1;
    this.dirtyEnd = -1;

    return out;
  }

  /** metering introspection (tests) */
  stats(): { used: number; live: number; waste: number; capacity: number } {
    return {
      used: this.used,
      live: this.liveFloats,
      waste: this.wasteFloats,
      capacity: this.pool.length
    };
  }

  private freeRange( slot: number ): void {
    const len = this.lengths[ slot ];

    this.offsets[ slot ] = -1;
    this.lengths[ slot ] = 0;
    this.liveFloats -= len;
    this.wasteFloats += len;
  }

  private mark( start: number, end: number ): void {
    if( this.dirtyStart < 0 ){
      this.dirtyStart = start;
      this.dirtyEnd = end;
    } else {
      this.dirtyStart = Math.min( this.dirtyStart, start );
      this.dirtyEnd = Math.max( this.dirtyEnd, end );
    }
  }

  private ensureSlot( slot: number ): void {
    if( slot < this.offsets.length ){ return; }

    let cap = Math.max( 16, this.offsets.length );

    while( cap <= slot ){ cap *= 2; }

    const offsets = new Int32Array( cap );
    const lengths = new Int32Array( cap );

    offsets.fill( -1 );
    offsets.set( this.offsets );
    lengths.set( this.lengths );

    this.offsets = offsets;
    this.lengths = lengths;
  }

  private ensureCapacity( floats: number ): void {
    if( floats <= this.pool.length ){ return; }

    let cap = Math.max( FLOOR_FLOATS, this.pool.length );

    while( cap < floats ){ cap *= 2; }

    const pool = new Float32Array( cap );

    pool.set( this.pool );
    this.pool = pool;
    this.resized = true;
  }

  /** Round-11 policy: reclaim when waste exceeds half the live floats
   * (with a floor so tiny pools never churn). */
  private maybeCompact(): void {
    if( this.wasteFloats <= Math.max( this.liveFloats, FLOOR_FLOATS ) / 2 ){ return; }

    let cap = FLOOR_FLOATS;

    while( cap < this.liveFloats ){ cap *= 2; }

    const pool = new Float32Array( cap );
    let cursor = 0;

    for( let slot = 0; slot < this.offsets.length; slot++ ){
      const off = this.offsets[ slot ];

      if( off < 0 ){ continue; }

      const len = this.lengths[ slot ];

      pool.set( this.pool.subarray( off, off + len ), cursor );

      if( cursor !== off ){
        this.offsets[ slot ] = cursor;
        this.onRelocate( slot, cursor );
      }

      cursor += len;
    }

    this.pool = pool;
    this.used = cursor;
    this.wasteFloats = 0;
    this.resized = true;
  }
}
