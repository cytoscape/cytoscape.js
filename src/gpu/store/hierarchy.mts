import { FLAG_ALIVE, FLAG_CHILD, FLAG_PARENT, FLAG_VISIBLE, NO_SLOT } from '../contract.mjs';

const SHOWN = FLAG_ALIVE | FLAG_VISIBLE;

/**
 * Per-parent compound style inputs (CPU-only; written by the StyleEngine
 * via GraphStore.setCompoundStyle).  `padding` is px, or a fraction when
 * `paddingUnit` is '%' (v3's pfValue convention) resolved against the
 * children bb per `relativeTo`.  The four v3 min-size bias props are
 * dropped by decided design (round 14): the min clamp splits overflow
 * evenly about the children center — exactly v3's default-bias behavior.
 */
export interface CompoundStyle {
  padding: number;
  paddingUnit: 'px' | '%';
  relativeTo: 'width' | 'height' | 'average' | 'min' | 'max';
  minWidth: number;
  minHeight: number;
}

const COMPOUND_STYLE_DEFAULTS: CompoundStyle = {
  padding: 0, paddingUnit: 'px', relativeTo: 'width', minWidth: 0, minHeight: 0
};

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
  /** the node.position column (auto-bounds inputs) */
  positions(): Float32Array;
  /** the node.outerHalf column (border-inclusive child half-extents) */
  outerHalf(): Float32Array;
  /** the node's current style size (stashed as the degenerate fallback) */
  readSize( slot: number ): [ number, number ];
  /** a node flipped leaf<->parent (the store stashes/restores its style size) */
  onFlip( slot: number, becameParent: boolean ): void;
  /** write derived parent geometry into the real columns (never re-marks) */
  materialize( slot: number, x: number, y: number, w: number, h: number ): void;
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

  /** parents whose derived geometry is stale (drained by flush()) */
  private pending: Set<number>;
  /** per-parent compound style inputs (absent = defaults) */
  private compoundStyle: Map<number, CompoundStyle>;
  /** the resolved px padding written at the last flush, per parent */
  private resolvedPad: Map<number, number>;

  constructor( host: HierarchyHost ){
    this.host = host;
    this.parent = new Int32Array( 0 );
    this.parentGen = new Uint32Array( 0 );
    this.depth = new Uint16Array( 0 );
    this.children = new Map();
    this.nParents = 0;
    this.order = null;
    this.warnedGen = false;
    this.pending = new Set();
    this.compoundStyle = new Map();
    this.resolvedPad = new Map();
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

  // -- geometry pending / flush (round 14.3) --

  /**
   * A node's geometry changed: mark every ancestor's derived bounds
   * stale, and the node's own when it is itself a parent (a style write
   * clobbered its derived size).  Chains early-exit on an
   * already-pending ancestor — markGeo always marks whole chains, so a
   * pending ancestor implies a pending chain above it.
   */
  markGeo( slot: number ): void {
    if( this.children.has( slot ) && !this.pending.has( slot ) ){
      this.pending.add( slot );
      this.host.schedule();
    }

    this.markAncestors( slot );
  }

  /** Mark only the ancestor chain (a moved parent's own value stays exact). */
  markAncestors( slot: number ): void {
    for( let p = this.parentOf( slot ); p >= 0; p = this.parentOf( p ) ){
      if( this.pending.has( p ) ){ break; }

      this.pending.add( p );
      this.host.schedule();
    }
  }

  hasPending(): boolean {
    return this.pending.size > 0;
  }

  /** Store a parent's compound style inputs (partial; merged over defaults). */
  setCompoundStyle( slot: number, style: Partial<CompoundStyle> ): void {
    this.compoundStyle.set( slot, { ...COMPOUND_STYLE_DEFAULTS, ...style } );
    this.markGeo( slot );
  }

  /** The px padding resolved at the last flush (0 for non-parents). */
  paddingOf( slot: number ): number {
    return this.resolvedPad.get( slot ) ?? 0;
  }

  /** The declared compound style record (defaults for leaves). */
  compoundStyleOf( slot: number ): CompoundStyle {
    return this.compoundStyle.get( slot ) ?? COMPOUND_STYLE_DEFAULTS;
  }

  /**
   * Materialize stale parent geometry into the columns: deepest parents
   * first (their derived boxes are their ancestors' inputs), each from
   * its direct children's border-inclusive extents — hidden children are
   * excluded (v3's display:none rule), and a parent with no shown
   * children keeps its position at the stashed style size (v3's
   * degenerate fallback).  Padding resolves against the children bb
   * (v3 computes % padding pre-clamp), the min clamp splits overflow
   * evenly about the children center, and the stored size is the
   * padded/drawn box (readbacks subtract the padding).  Writes go
   * through host.materialize, which never re-marks — the flush can not
   * re-trigger itself.
   */
  flush(): void {
    if( this.pending.size === 0 ){ return; }

    const order = Array.from( this.pending )
      .sort( ( a, b ) => this.depthOf( b ) - this.depthOf( a ) );

    this.pending.clear();

    const pos = this.host.positions();
    const outer = this.host.outerHalf();
    const flags = this.host.flags();

    for( const slot of order ){
      const kids = this.children.get( slot );

      if( kids == null || kids.length === 0 ){ continue; } // stale entry

      let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;

      for( const kid of kids ){
        if( ( flags[ kid ] & SHOWN ) !== SHOWN ){ continue; }

        const kx = pos[ kid * 2 ];
        const ky = pos[ kid * 2 + 1 ];
        const hw = outer[ kid * 2 ];
        const hh = outer[ kid * 2 + 1 ];

        if( kx - hw < x1 ){ x1 = kx - hw; }
        if( kx + hw > x2 ){ x2 = kx + hw; }
        if( ky - hh < y1 ){ y1 = ky - hh; }
        if( ky + hh > y2 ){ y2 = ky + hh; }
      }

      let bbW = x2 - x1;
      let bbH = y2 - y1;
      let cx: number;
      let cy: number;

      if( !( bbW > 0 ) || !( bbH > 0 ) ){ // no shown children / zero area
        const [ fw, fh ] = this.host.readSize( slot );

        bbW = fw;
        bbH = fh;
        cx = pos[ slot * 2 ];
        cy = pos[ slot * 2 + 1 ];
      } else {
        cx = ( x1 + x2 ) / 2;
        cy = ( y1 + y2 ) / 2;
      }

      const style = this.compoundStyle.get( slot ) ?? COMPOUND_STYLE_DEFAULTS;
      const pad = resolvePadding( style, bbW, bbH );
      const coreW = Math.max( bbW, style.minWidth );
      const coreH = Math.max( bbH, style.minHeight );

      this.resolvedPad.set( slot, pad );
      this.host.materialize( slot, cx, cy, coreW + 2 * pad, coreH + 2 * pad );
    }
  }

  // -- maintenance --

  /**
   * Link `slot` under `parentSlot` (-1 to orphan).  Cycle-safe (warn +
   * no-op, v3's dropped-ref rule); maintains children lists, subtree
   * depths, FLAG_PARENT/FLAG_CHILD, the draw permutation, and the
   * pending sets of both affected chains.
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

    if( current >= 0 ){
      this.markGeo( current ); // the old chain re-derives (it lost a child)
      this.unlink( slot, current );
    }

    if( next >= 0 ){
      let list = this.children.get( next );

      if( list == null ){
        list = [];
        this.children.set( next, list );
        this.setFlag( next, FLAG_PARENT, true );
        this.nParents++;
        this.host.onFlip( next, true );
      }

      list.push( slot );
      this.parent[ slot ] = next;
      this.parentGen[ slot ] = this.host.gen()[ next ];
      this.setFlag( slot, FLAG_CHILD, true );
      this.markGeo( next ); // the new chain re-derives (it gained a child)
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
      this.markGeo( p ); // the chain re-derives (it lost a child)
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
        this.pending.delete( parentSlot );
        this.resolvedPad.delete( parentSlot );
        this.host.onFlip( parentSlot, false ); // restore the style size
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

  /**
   * Slot compaction (19.2): repoint every slot-keyed structure through
   * the monotone remap.  `parent` is both slot-indexed and slot-valued;
   * `parentGen` re-stamps against the *post-compaction* gen array (moved
   * parents took fresh generations); child lists keep link order; the
   * draw permutation regenerates lazily.  Call with derived geometry
   * flushed (`pending` is remapped defensively all the same).
   */
  remapSlots( remap: Uint32Array, gen: Uint32Array ): void {
    const oldLen = this.parent.length;
    const n = Math.min( remap.length, oldLen );
    const parent = new Int32Array( oldLen ).fill( -1 );
    const parentGen = new Uint32Array( oldLen );
    const depth = new Uint16Array( oldLen );

    for( let s = 0; s < n; s++ ){
      const d = remap[ s ];

      if( d === NO_SLOT ){ continue; }

      const p = this.parent[ s ];

      if( p >= 0 ){
        const dp = p < remap.length ? remap[ p ] : NO_SLOT;

        if( dp !== NO_SLOT ){
          parent[ d ] = dp;
          parentGen[ d ] = gen[ dp ];
        }
      }

      depth[ d ] = this.depth[ s ];
    }

    this.parent = parent;
    this.parentGen = parentGen;
    this.depth = depth;

    const rekey = ( old: number ): number =>
      old < remap.length ? remap[ old ] : NO_SLOT;

    const children = new Map<number, number[]>();

    for( const [ p, kids ] of this.children ){
      const dp = rekey( p );

      if( dp === NO_SLOT ){ continue; }

      children.set( dp, kids
        .map( rekey )
        .filter( d => d !== NO_SLOT ) );
    }

    this.children = children;
    this.order = null;

    const pending = new Set<number>();

    for( const p of this.pending ){
      const dp = rekey( p );

      if( dp !== NO_SLOT ){ pending.add( dp ); }
    }

    this.pending = pending;

    const styles = new Map<number, CompoundStyle>();

    for( const [ p, style ] of this.compoundStyle ){
      const dp = rekey( p );

      if( dp !== NO_SLOT ){ styles.set( dp, style ); }
    }

    this.compoundStyle = styles;

    const pads = new Map<number, number>();

    for( const [ p, pad ] of this.resolvedPad ){
      const dp = rekey( p );

      if( dp !== NO_SLOT ){ pads.set( dp, pad ); }
    }

    this.resolvedPad = pads;
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

/** v3's computePaddingValues: px verbatim; '%' is a fraction (pfValue)
 * of the children bb per padding-relative-to (zero-guarded like v3). */
const resolvePadding = ( style: CompoundStyle, bbW: number, bbH: number ): number => {
  if( style.padding === 0 ){ return 0; }
  if( style.paddingUnit === 'px' ){ return style.padding; }

  switch( style.relativeTo ){
    case 'width': return bbW > 0 ? style.padding * bbW : 0;
    case 'height': return bbH > 0 ? style.padding * bbH : 0;
    case 'average': return bbW > 0 && bbH > 0 ? style.padding * ( bbW + bbH ) / 2 : 0;
    case 'min': return bbW > 0 && bbH > 0 ? style.padding * Math.min( bbW, bbH ) : 0;
    case 'max': return bbW > 0 && bbH > 0 ? style.padding * Math.max( bbW, bbH ) : 0;
  }
};
