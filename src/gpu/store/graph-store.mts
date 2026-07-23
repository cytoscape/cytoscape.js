import { ColumnTable } from './table.mjs';
import { IdMap } from './id-map.mjs';
import { Adjacency } from './adjacency.mjs';
import { DirtyTracker } from './dirty.mjs';
import {
  columnSpec, columnSpecsForGroup,
  FLAG_ALIVE, FLAG_SELECTABLE, FLAG_SELECTED, FLAG_VISIBLE
} from '../contract.mjs';
import type { ColumnArray, ColumnId, GroupName, LabelEntry, ModelView, Ref, StoreDelta } from '../contract.mjs';

export interface AddElementOpts {
  selected?: boolean;
  selectable?: boolean;
  visible?: boolean;
}

/** Insertion-order slot list with tombstone skipping and lazy compaction. */
interface OrderList {
  slots: number[];
  gens: number[];
  stale: number;
}

const emptyOrder = (): OrderList => ( { slots: [], gens: [], stale: 0 } );

/**
 * The CPU-canonical columnar model: NodeTable + EdgeTable + IdMap +
 * Adjacency, with per-column dirty spans for the renderer.  Synchronous API
 * reads always hit these typed-array columns; the store works headless (no
 * GPU, Node-testable).  The store itself never emits events — the core does.
 */
export class GraphStore implements ModelView {
  readonly nodes: ColumnTable;
  readonly edges: ColumnTable;
  readonly ids: IdMap;
  readonly adj: Adjacency;
  readonly dirty: DirtyTracker;

  private order: { nodes: OrderList; edges: OrderList };
  private labels: ( LabelEntry | undefined )[];
  private labelDirty: Set<number>;

  constructor(){
    this.nodes = new ColumnTable( 'nodes', columnSpecsForGroup( 'nodes' ) );
    this.edges = new ColumnTable( 'edges', columnSpecsForGroup( 'edges' ) );
    this.ids = new IdMap();
    this.adj = new Adjacency();
    this.dirty = new DirtyTracker();
    this.order = { nodes: emptyOrder(), edges: emptyOrder() };
    this.labels = [];
    this.labelDirty = new Set();
  }

  table( group: GroupName ): ColumnTable {
    return group === 'nodes' ? this.nodes : this.edges;
  }

  // -- ModelView (the renderer's read surface) --

  capacity( group: GroupName ): number {
    return this.table( group ).cap;
  }

  highWater( group: GroupName ): number {
    return this.table( group ).highWater;
  }

  column( id: ColumnId ): ColumnArray {
    return this.table( columnSpec( id ).group ).column( id );
  }

  hasDirty(): boolean {
    return this.dirty.hasDirty();
  }

  takeDelta(): StoreDelta {
    return this.dirty.take( this.nodes.highWater, this.edges.highWater );
  }

  onInvalidate( cb: () => void ): () => void {
    return this.dirty.onInvalidate( cb );
  }

  // -- refs --

  ref( group: GroupName, slot: number ): Ref {
    return { group, slot, gen: this.table( group ).gen[ slot ] };
  }

  /** Whether a ref still points at the live element it was created for. */
  isCurrent( ref: Ref ): boolean {
    const table = this.table( ref.group );

    return ref.slot < table.cap && table.gen[ ref.slot ] === ref.gen;
  }

  lookup( id: string ): Ref | undefined {
    const entry = this.ids.get( id );

    return entry == null ? undefined : this.ref( entry.group, entry.slot );
  }

  idAt( group: GroupName, slot: number ): string | undefined {
    return this.ids.idAt( group, slot );
  }

  // -- mutation --

  addNode( id: string, x: number, y: number, opts: AddElementOpts = {} ): number {
    const { slot, resized } = this.allocSlot( 'nodes', id );

    const pos = this.nodes.column( 'node.position' ) as Float32Array;

    pos[ slot * 2 ] = x;
    pos[ slot * 2 + 1 ] = y;

    ( this.nodes.column( 'node.flags' ) as Uint32Array )[ slot ] = initialFlags( opts );

    if( !resized ){ // resized already implies a full re-upload
      this.dirty.mark( 'node.position', slot );
      this.dirty.mark( 'node.flags', slot );
    }

    return slot;
  }

  addEdge( id: string, sourceId: string, targetId: string, opts: AddElementOpts = {} ): number {
    const source = this.ids.get( sourceId );
    const target = this.ids.get( targetId );

    if( source == null || source.group !== 'nodes' ){
      throw new Error( `Can not create edge '${id}' with nonexistant source '${sourceId}'` );
    }

    if( target == null || target.group !== 'nodes' ){
      throw new Error( `Can not create edge '${id}' with nonexistant target '${targetId}'` );
    }

    const { slot, resized } = this.allocSlot( 'edges', id );

    const endpoints = this.edges.column( 'edge.endpoints' ) as Uint32Array;

    endpoints[ slot * 2 ] = source.slot;
    endpoints[ slot * 2 + 1 ] = target.slot;

    ( this.edges.column( 'edge.flags' ) as Uint32Array )[ slot ] = initialFlags( opts );

    this.adj.addEdge( slot, source.slot, target.slot );

    if( !resized ){
      this.dirty.mark( 'edge.endpoints', slot );
      this.dirty.mark( 'edge.flags', slot );
    }

    return slot;
  }

  removeEdge( slot: number ): void {
    const endpoints = this.edges.column( 'edge.endpoints' ) as Uint32Array;

    this.adj.removeEdge( slot, endpoints[ slot * 2 ], endpoints[ slot * 2 + 1 ] );
    this.freeSlot( 'edges', slot );
  }

  /** The node must have no incident edges left; the caller cascades removal of them first. */
  removeNode( slot: number ): void {
    if( this.adj.outDegree( slot ) > 0 || this.adj.inDegree( slot ) > 0 ){
      throw new Error( 'Can not remove a node before its incident edges' );
    }

    this.adj.clearNode( slot );
    this.freeSlot( 'nodes', slot );
  }

  // -- positions --

  getX( slot: number ): number {
    return ( this.nodes.column( 'node.position' ) as Float32Array )[ slot * 2 ];
  }

  getY( slot: number ): number {
    return ( this.nodes.column( 'node.position' ) as Float32Array )[ slot * 2 + 1 ];
  }

  setPosition( slot: number, x: number, y: number ): void {
    const pos = this.nodes.column( 'node.position' ) as Float32Array;

    pos[ slot * 2 ] = x;
    pos[ slot * 2 + 1 ] = y;

    this.dirty.mark( 'node.position', slot );
  }

  /** Bulk position write (e.g. from a layout): one coalesced dirty span. */
  setPositions( slots: number[], xy: number[] | Float32Array ): void {
    if( slots.length === 0 ){ return; }

    const pos = this.nodes.column( 'node.position' ) as Float32Array;
    let min = Infinity;
    let max = -Infinity;

    for( let i = 0; i < slots.length; i++ ){
      const slot = slots[ i ];

      pos[ slot * 2 ] = xy[ i * 2 ];
      pos[ slot * 2 + 1 ] = xy[ i * 2 + 1 ];

      min = Math.min( min, slot );
      max = Math.max( max, slot );
    }

    this.dirty.mark( 'node.position', min, max + 1 );
  }

  // -- flags --

  flags( group: GroupName, slot: number ): number {
    const id: ColumnId = group === 'nodes' ? 'node.flags' : 'edge.flags';

    return ( this.table( group ).column( id ) as Uint32Array )[ slot ];
  }

  hasFlag( group: GroupName, slot: number, bit: number ): boolean {
    return ( this.flags( group, slot ) & bit ) !== 0;
  }

  setFlag( group: GroupName, slot: number, bit: number, on: boolean ): void {
    const id: ColumnId = group === 'nodes' ? 'node.flags' : 'edge.flags';
    const arr = this.table( group ).column( id ) as Uint32Array;
    const prev = arr[ slot ];
    const next = on ? ( prev | bit ) : ( prev & ~bit );

    if( next === prev ){ return; }

    arr[ slot ] = next;
    this.dirty.mark( id, slot );
  }

  // -- style channel writers --

  setScalar( id: ColumnId, slot: number, value: number ): void {
    const spec = columnSpec( id );
    const arr = this.table( spec.group ).column( id ) as Float32Array | Uint32Array;

    if( arr[ slot ] === value ){ return; }

    arr[ slot ] = value;
    this.dirty.mark( id, slot );
  }

  setPair( id: ColumnId, slot: number, a: number, b: number ): void {
    const spec = columnSpec( id );
    const arr = this.table( spec.group ).column( id ) as Float32Array | Uint32Array;

    if( arr[ slot * 2 ] === a && arr[ slot * 2 + 1 ] === b ){ return; }

    arr[ slot * 2 ] = a;
    arr[ slot * 2 + 1 ] = b;
    this.dirty.mark( id, slot );
  }

  /** RGBA bytes on [0, 255]. */
  setColor( id: ColumnId, slot: number, r: number, g: number, b: number, a: number ): void {
    const spec = columnSpec( id );
    const arr = this.table( spec.group ).column( id ) as Uint8Array;
    const at = slot * 4;

    if( arr[ at ] === r && arr[ at + 1 ] === g && arr[ at + 2 ] === b && arr[ at + 3 ] === a ){ return; }

    arr[ at ] = r;
    arr[ at + 1 ] = g;
    arr[ at + 2 ] = b;
    arr[ at + 3 ] = a;
    this.dirty.mark( id, slot );
  }

  // -- labels (model-only sidecar; see LabelEntry in contract.mts) --

  labelAt( slot: number ): LabelEntry | undefined {
    return this.labels[ slot ];
  }

  /** Set or clear (null) a node's label; no-ops when nothing changed. */
  setLabel( slot: number, entry: LabelEntry | null ): void {
    const prev = this.labels[ slot ];

    if( entry == null ){
      if( prev == null ){ return; }

      this.labels[ slot ] = undefined;
    } else {
      if(
        prev != null && prev.text === entry.text && prev.fontSize === entry.fontSize &&
        prev.color === entry.color && prev.anchorY === entry.anchorY
      ){ return; }

      this.labels[ slot ] = entry;
    }

    this.labelDirty.add( slot );
    this.dirty.touch();
  }

  takeLabelDirty(): number[] {
    if( this.labelDirty.size === 0 ){ return []; }

    const slots = [ ...this.labelDirty ];

    this.labelDirty.clear();

    return slots;
  }

  // -- iteration (insertion order) --

  count( group: GroupName ): number {
    return this.table( group ).count;
  }

  forEachAlive( group: GroupName, cb: ( slot: number ) => void ): void {
    const order = this.order[ group ];
    const gen = this.table( group ).gen;

    for( let i = 0; i < order.slots.length; i++ ){
      const slot = order.slots[ i ];

      if( gen[ slot ] === order.gens[ i ] ){
        cb( slot );
      }
    }
  }

  /** Live slots in insertion order (reused slots re-appear at their re-insertion position). */
  slotsOrdered( group: GroupName ): number[] {
    const slots: number[] = [];

    this.forEachAlive( group, slot => slots.push( slot ) );

    return slots;
  }

  // -- internals --

  private allocSlot( group: GroupName, id: string ): { slot: number; resized: boolean } {
    if( this.ids.has( id ) ){
      throw new Error( `Can not create second element with id '${id}'` );
    }

    const table = this.table( group );
    const { slot, resized } = table.alloc();

    if( resized ){
      this.dirty.markResized( group );
    }

    this.ids.set( id, group, slot );

    const order = this.order[ group ];

    order.slots.push( slot );
    order.gens.push( table.gen[ slot ] );

    return { slot, resized };
  }

  private freeSlot( group: GroupName, slot: number ): void {
    const id = this.ids.idAt( group, slot );

    if( id != null ){ this.ids.remove( id ); }

    if( group === 'nodes' && this.labels[ slot ] != null ){
      this.setLabel( slot, null );
    }

    // tombstone: cleared flags (no ALIVE bit) collapse the instance to a degenerate quad
    const flagsId: ColumnId = group === 'nodes' ? 'node.flags' : 'edge.flags';

    ( this.table( group ).column( flagsId ) as Uint32Array )[ slot ] = 0;
    this.dirty.mark( flagsId, slot );

    this.table( group ).freeSlot( slot );

    const order = this.order[ group ];

    order.stale++;

    if( order.stale > order.slots.length / 2 ){
      this.compactOrder( group );
    }
  }

  private compactOrder( group: GroupName ): void {
    const order = this.order[ group ];
    const gen = this.table( group ).gen;
    const slots: number[] = [];
    const gens: number[] = [];

    for( let i = 0; i < order.slots.length; i++ ){
      const slot = order.slots[ i ];

      if( gen[ slot ] === order.gens[ i ] ){
        slots.push( slot );
        gens.push( order.gens[ i ] );
      }
    }

    this.order[ group ] = { slots, gens, stale: 0 };
  }
}

const initialFlags = ( opts: AddElementOpts ): number => {
  let flags = FLAG_ALIVE;

  if( opts.visible !== false ){ flags |= FLAG_VISIBLE; }
  if( opts.selectable !== false ){ flags |= FLAG_SELECTABLE; }
  if( opts.selected === true ){ flags |= FLAG_SELECTED; }

  return flags;
};
