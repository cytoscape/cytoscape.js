import { FLAG_CHILD, FLAG_PARENT } from '../contract.mjs';

/*
The compound hierarchy index (round 14): parent links, per-parent child
lists, depth, and the derived FLAG_PARENT / FLAG_CHILD bits.

Modeled on the CurveIndex: the index never touches the store's columns
directly — it reads and writes through a narrow host-callback object, so
it stays independently testable and the store keeps sole ownership of
dirty tracking.  Slot-indexed state grows lazily like the CurveIndex's
styled records.

Invariants:
- A parent link is severed eagerly on node removal (the collection layer
  cascades descendants first, and the store throws on removing a node
  that still has children), so links can never point at a freed slot.
  `parentGen` still records the parent's generation at link time as an
  assertion-grade guard: a mismatch on read means the slot was recycled
  under a live link, and the node reads as an orphan (with one warning).
- Cycle safety is v3's rule: a `setParent` that would make a node its
  own ancestor (including self) warns and no-ops — the ref is dropped,
  no error is thrown.
- `parentOrder()` is the parent draw permutation: live parent slots
  sorted by (depth asc, slot asc), which is the paint order that puts
  outer parents under inner ones (slot order breaks ties, matching the
  in-group z-order rule).  Rebuilt lazily on hierarchy change; the
  renderer uploads it when it changes (round 14.9).
*/

/** What the index needs from the store (kept narrow for testability). */
export interface HierarchyHost {
  /** the node.flags column (re-fetch per call — tables realloc on growth) */
  flags(): Uint32Array;
  /** the node table's per-slot generation counters */
  gen(): Uint32Array;
  /** mark a node.flags slot dirty (renderer upload span) */
  markFlag( slot: number ): void;
  /** schedule a frame / mark non-column dirt (DirtyTracker.touch) */
  schedule(): void;
}

export class HierarchyIndex {
  private host: HierarchyHost;

  /** parent node slot per node slot; -1 = orphan (grows lazily) */
  private parent: Int32Array;
  /** the parent's generation at link time (see the module doc) */
  private parentGen: Uint32Array;
  /** nesting depth (0 = orphan/top-level); valid only for linked slots */
  private depth: Uint16Array;
  /** parent slot -> child slots in link order (sparse; parents are few) */
  private children: Map<number, number[]>;

  /** live parents (slots holding FLAG_PARENT) */
  private nParents: number;
  /** the (depth, slot) draw permutation; null when stale */
  private order: Uint32Array | null;
  private warnedGen: boolean;

  constructor( host: HierarchyHost ){
    this.host = host;
    this.parent = new Int32Array( 0 );
    this.parentGen = new Uint32Array( 0 );
    this.depth = new Uint16Array( 0 );
    this.children = new Map();
    this.nParents = 0;
    this.order = null;
    this.warnedGen = false;
  }

  // -- reads --

  parentCount(): number {
    return this.nParents;
  }

  hasCompounds(): boolean {
    return this.nParents > 0;
  }

  parentOf( slot: number ): number {
    if( slot >= this.parent.length ){ return -1; }

    const p = this.parent[ slot ];

    if( p < 0 ){ return -1; }

    if( this.host.gen()[ p ] !== this.parentGen[ slot ] ){
      // unreachable while removal severs links eagerly; guard anyway
      if( !this.warnedGen ){
        this.warnedGen = true;
        console.warn( 'A compound parent slot was recycled under a live link; treating the child as an orphan' );
      }

      return -1;
    }

    return p;
  }

  childrenOf( slot: number ): readonly number[] {
    return this.children.get( slot ) ?? EMPTY;
  }

  depthOf( slot: number ): number {
    return slot < this.depth.length && this.parent[ slot ] >= 0 ? this.depth[ slot ] : 0;
  }

  /** True when `ancestor` is on `slot`'s parent chain (not reflexive). */
  isAncestorOf( ancestor: number, slot: number ): boolean {
    for( let p = this.parentOf( slot ); p >= 0; p = this.parentOf( p ) ){
      if( p === ancestor ){ return true; }
    }

    return false;
  }

  /**
   * The parent draw permutation: live parent slots sorted (depth asc,
   * slot asc).  The returned array is owned by the index — treat as
   * read-only and re-fetch after hierarchy changes.
   */
  parentOrder(): Uint32Array {
    if( this.order == null ){
      const slots: number[] = [];

      for( const slot of this.children.keys() ){ slots.push( slot ); }

      slots.sort( ( a, b ) => ( this.depthOf( a ) - this.depthOf( b ) ) || ( a - b ) );
      this.order = Uint32Array.from( slots );
    }

    return this.order;
  }

  // -- maintenance --

  /**
   * Link `slot` under `parentSlot` (-1 to orphan).  Cycle-safe (warn +
   * no-op, v3's dropped-ref rule); maintains children lists, subtree
   * depths, FLAG_PARENT/FLAG_CHILD and the draw permutation.
   */
  setParent( slot: number, parentSlot: number ): void {
    const current = this.parentOf( slot );
    const next = parentSlot < 0 ? -1 : parentSlot;

    if( current === next ){ return; }

    if( next >= 0 && ( next === slot || this.isAncestorOf( slot, next ) ) ){
      console.warn( 'Node can not be made its own ancestor; parent assignment dropped' );

      return;
    }

    this.ensure( Math.max( slot, next ) );

    if( current >= 0 ){ this.unlink( slot, current ); }

    if( next >= 0 ){
      let list = this.children.get( next );

      if( list == null ){
        list = [];
        this.children.set( next, list );
        this.setFlag( next, FLAG_PARENT, true );
        this.nParents++;
      }

      list.push( slot );
      this.parent[ slot ] = next;
      this.parentGen[ slot ] = this.host.gen()[ next ];
      this.setFlag( slot, FLAG_CHILD, true );
    } else {
      this.parent[ slot ] = -1;
      this.setFlag( slot, FLAG_CHILD, false );
    }

    this.updateDepths( slot );
    this.order = null;
    this.host.schedule();
  }

  /** Sever the node's own link and assert it has no children left. */
  onRemoveNode( slot: number ): void {
    const p = this.parentOf( slot );

    if( p >= 0 ){
      this.unlink( slot, p );
      this.parent[ slot ] = -1;
      this.setFlag( slot, FLAG_CHILD, false );
      this.order = null;
      this.host.schedule();
    }
  }

  /** Whether the node still has children (removal must cascade them first). */
  hasChildren( slot: number ): boolean {
    return ( this.children.get( slot )?.length ?? 0 ) > 0;
  }

  // -- internals --

  private unlink( slot: number, parentSlot: number ): void {
    const list = this.children.get( parentSlot );

    if( list != null ){
      const i = list.indexOf( slot );

      if( i >= 0 ){ list.splice( i, 1 ); }

      if( list.length === 0 ){
        this.children.delete( parentSlot );
        this.setFlag( parentSlot, FLAG_PARENT, false );
        this.nParents--;
        this.order = null;
      }
    }
  }

  /** Recompute the subtree's depths from the (already-linked) root. */
  private updateDepths( root: number ): void {
    const p = this.parent[ root ];
    const queue: number[] = [ root ];
    const depths: number[] = [ p < 0 ? 0 : this.depth[ p ] + 1 ];

    while( queue.length > 0 ){
      const slot = queue.pop() as number;
      const d = depths.pop() as number;

      this.depth[ slot ] = d;

      const kids = this.children.get( slot );

      if( kids != null ){
        for( const kid of kids ){
          queue.push( kid );
          depths.push( d + 1 );
        }
      }
    }
  }

  private setFlag( slot: number, bit: number, on: boolean ): void {
    const flags = this.host.flags();
    const next = on ? ( flags[ slot ] | bit ) : ( flags[ slot ] & ~bit );

    if( next !== flags[ slot ] ){
      flags[ slot ] = next;
      this.host.markFlag( slot );
    }
  }

  private ensure( slot: number ): void {
    if( slot < this.parent.length ){ return; }

    const cap = Math.max( 32, slot + 1, this.parent.length * 2 );
    const parent = new Int32Array( cap ).fill( -1 );
    const parentGen = new Uint32Array( cap );
    const depth = new Uint16Array( cap );

    parent.set( this.parent );
    parentGen.set( this.parentGen );
    depth.set( this.depth );

    this.parent = parent;
    this.parentGen = parentGen;
    this.depth = depth;
  }
}

const EMPTY: readonly number[] = [];
