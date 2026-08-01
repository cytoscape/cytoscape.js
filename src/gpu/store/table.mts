import type { ColumnArray, ColumnId, ColumnSpec, GroupName } from '../contract.mjs';
import { NO_SLOT } from '../contract.mjs';

const INITIAL_CAP = 32;

export interface AllocResult {
  slot: number;
  /** true when the allocation grew the table's capacity */
  resized: boolean;
}

/**
 * Struct-of-arrays storage for one element group: typed-array columns with
 * ×2 growth, a free-list of reusable slots (stable slots, no compaction) and
 * per-slot generation counters so stale handles can be detected.
 */
export class ColumnTable {
  group: GroupName;
  /** current capacity, in slots */
  cap: number;
  /** one past the highest slot ever allocated; the renderer draws this many instances */
  highWater: number;
  /** number of live slots */
  count: number;
  /** per-slot generation counters (model-only; never uploaded) */
  gen: Uint32Array;

  private specs: ColumnSpec[];
  private arrays: Map<ColumnId, ColumnArray>;
  private free: number[];

  constructor( group: GroupName, specs: ColumnSpec[], initialCap: number = INITIAL_CAP ){
    this.group = group;
    this.cap = initialCap;
    this.highWater = 0;
    this.count = 0;
    this.gen = new Uint32Array( initialCap );
    this.specs = specs;
    this.arrays = new Map();
    this.free = [];

    for( const spec of specs ){
      this.arrays.set( spec.id, new spec.ctor( spec.components * initialCap ) );
    }
  }

  /** number of freed slots available for reuse */
  get freeCount(): number {
    return this.free.length;
  }

  column( id: ColumnId ): ColumnArray {
    const arr = this.arrays.get( id );

    if( arr == null ){
      throw new Error( `Column '${id}' does not belong to the '${this.group}' table` );
    }

    return arr;
  }

  /** Allocate a slot, reusing a freed one when possible.  Newly allocated slots are zeroed. */
  alloc(): AllocResult {
    let slot: number;
    let resized = false;

    if( this.free.length > 0 ){
      slot = this.free.pop() as number;
    } else {
      if( this.highWater === this.cap ){
        this.grow();
        resized = true;
      }

      slot = this.highWater;
      this.highWater++;
    }

    // zero the slot so reused slots don't leak stale channel data
    for( const spec of this.specs ){
      const arr = this.arrays.get( spec.id ) as ColumnArray;

      arr.fill( 0, slot * spec.components, ( slot + 1 ) * spec.components );
    }

    this.count++;

    return { slot, resized };
  }

  /**
   * Allocate `count` slots at once: freed slots first (zeroed, like
   * alloc()), then one contiguous fresh run at highWater — fresh slots
   * have never been written, so they skip the per-slot zeroing loop
   * entirely.  Returns the slots in allocation order; entries from
   * `contiguousFrom` on are the ascending fresh run.
   */
  allocBulk( count: number ): { slots: Uint32Array; resized: boolean; contiguousFrom: number } {
    const slots = new Uint32Array( count );
    let n = 0;

    while( n < count && this.free.length > 0 ){
      const slot = this.free.pop() as number;

      for( const spec of this.specs ){
        const arr = this.arrays.get( spec.id ) as ColumnArray;

        arr.fill( 0, slot * spec.components, ( slot + 1 ) * spec.components );
      }

      slots[ n++ ] = slot;
    }

    const contiguousFrom = n;
    const fresh = count - n;
    const resized = this.reserve( this.highWater + fresh );

    for( let i = 0; i < fresh; i++ ){
      slots[ n + i ] = this.highWater + i;
    }

    this.highWater += fresh;
    this.count += count;

    return { slots, resized, contiguousFrom };
  }

  /** Free a slot for reuse; bumps its generation so outstanding refs go stale. */
  freeSlot( slot: number ): void {
    this.gen[ slot ]++;
    this.free.push( slot );
    this.count--;
  }

  /**
   * Grow capacity to at least `minCap` slots, staying on the ×2 growth
   * curve — one realloc up front instead of a doubling cascade during a
   * bulk add.  Returns whether the table grew (the caller marks resized).
   */
  reserve( minCap: number ): boolean {
    if( minCap <= this.cap ){ return false; }

    let newCap = this.cap;

    while( newCap < minCap ){ newCap *= 2; }

    this.grow( newCap );

    return true;
  }

  /**
   * Slot-moving compaction (round 19.1): rebuild every column (and the
   * gen array) against a *monotone* remap — `remap[oldSlot]` is the new
   * slot for live elements (ascending: relative order is preserved by
   * construction, the stable-draw-order rule) or NO_SLOT for holes.
   * Capacity shrinks to the ×2 step covering the live count, `highWater`
   * drops to it, and the free-list clears (a dense prefix has no holes).
   *
   * Generations: an element whose slot is unchanged keeps its gen, so
   * refs to the stable prefix stay valid with zero repair.  Every other
   * position — moved-into, vacated, or tail — takes `oldGenAt(pos) + 1`,
   * which is strictly greater than any gen ever handed out at that
   * position: *all* stale refs fail plain validation and route to the
   * forwarding repair (19.3) instead of silently matching a mover.
   */
  compact( remap: Uint32Array, newCount: number ): void {
    let newCap = INITIAL_CAP;

    while( newCap < newCount ){ newCap *= 2; }

    for( const spec of this.specs ){
      const old = this.arrays.get( spec.id ) as ColumnArray;
      const next = new spec.ctor( spec.components * newCap );
      const c = spec.components;

      for( let s = 0; s < this.highWater; s++ ){
        const d = remap[ s ];

        if( d === NO_SLOT ){ continue; }

        for( let k = 0; k < c; k++ ){
          next[ d * c + k ] = old[ s * c + k ];
        }
      }

      this.arrays.set( spec.id, next );
    }

    const oldGen = this.gen;
    const nextGen = new Uint32Array( newCap );
    const carry = Math.min( newCap, this.cap );

    for( let p = 0; p < carry; p++ ){
      nextGen[ p ] = oldGen[ p ] + 1;
    }

    for( let s = 0; s < this.highWater; s++ ){
      if( remap[ s ] === s ){ nextGen[ s ] = oldGen[ s ]; }
    }

    this.gen = nextGen;
    this.cap = newCap;
    this.highWater = newCount;
    this.count = newCount;
    this.free = [];
  }

  private grow( newCap: number = this.cap * 2 ): void {
    for( const spec of this.specs ){
      const old = this.arrays.get( spec.id ) as ColumnArray;
      const grown = new spec.ctor( spec.components * newCap );

      ( grown as Float32Array ).set( old as Float32Array );
      this.arrays.set( spec.id, grown );
    }

    const oldGen = this.gen;

    this.gen = new Uint32Array( newCap );
    this.gen.set( oldGen );

    this.cap = newCap;
  }
}
