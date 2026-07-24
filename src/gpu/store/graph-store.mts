import { ColumnTable } from './table.mjs';
import { IdMap } from './id-map.mjs';
import { Adjacency } from './adjacency.mjs';
import { DataStore } from './data-store.mjs';
import { DirtyTracker } from './dirty.mjs';
import {
  columnSpec, columnSpecsForGroup,
  FLAG_ALIVE, FLAG_GRABBABLE, FLAG_LOCKED, FLAG_SELECTABLE, FLAG_SELECTED, FLAG_VISIBLE
} from '../contract.mjs';
import type { ColumnArray, ColumnId, GroupName, LabelEntry, ModelView, Ref, StoreDelta } from '../contract.mjs';
import type { GpuColumnarEdges, GpuColumnarNodes, GpuDataColumn, GpuPackedIds } from '../gpu-types.mjs';

export interface AddElementOpts {
  selected?: boolean;
  selectable?: boolean;
  visible?: boolean;
  grabbable?: boolean;
  locked?: boolean;
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
  readonly data: DataStore;
  readonly dirty: DirtyTracker;

  private order: { nodes: OrderList; edges: OrderList };
  private labels: ( LabelEntry | undefined )[];
  private labelDirty: Set<number>;

  constructor(){
    this.nodes = new ColumnTable( 'nodes', columnSpecsForGroup( 'nodes' ) );
    this.edges = new ColumnTable( 'edges', columnSpecsForGroup( 'edges' ) );
    this.ids = new IdMap();
    this.adj = new Adjacency();
    this.data = new DataStore();
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

  /**
   * Preallocate ahead of a bulk add: grows each table at most once for the
   * incoming element counts (net of reusable free slots), so the adds
   * themselves never hit the doubling cascade.
   */
  reserve( nodeCount: number, edgeCount: number ): void {
    const minCap = ( table: ColumnTable, adding: number ): number =>
      table.highWater + Math.max( 0, adding - table.freeCount );

    if( this.nodes.reserve( minCap( this.nodes, nodeCount ) ) ){
      this.dirty.markResized( 'nodes' );
    }

    if( this.edges.reserve( minCap( this.edges, edgeCount ) ) ){
      this.dirty.markResized( 'edges' );
    }
  }

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

  /**
   * Columnar bulk node add: typed-array columns write straight into the
   * store (one memcpy for the contiguous fresh run), with no per-element
   * def objects.  Returns the allocated slots, index-aligned with the
   * payload arrays.  On error the graph may be partially mutated (as with
   * a mid-list throw in the def path).
   */
  addNodesColumnar( cols: GpuColumnarNodes, newId: () => string ): Uint32Array {
    const count = cols.count;
    const { slots, resized, contiguousFrom } = this.nodes.allocBulk( count );

    if( resized ){ this.dirty.markResized( 'nodes' ); }

    this.registerBulk( 'nodes', slots, cols.ids, newId );

    const pos = this.nodes.column( 'node.position' ) as Float32Array;

    if( cols.positions != null ){
      if( cols.positions.length < count * 2 ){
        throw new Error( `Columnar node positions must hold ${count * 2} floats; got ${cols.positions.length}` );
      }

      if( contiguousFrom < count ){ // fresh run: one memcpy
        pos.set( cols.positions.subarray( contiguousFrom * 2, count * 2 ), slots[ contiguousFrom ] * 2 );
      }

      for( let i = 0; i < contiguousFrom; i++ ){ // reused slots: scattered
        pos[ slots[ i ] * 2 ] = cols.positions[ i * 2 ];
        pos[ slots[ i ] * 2 + 1 ] = cols.positions[ i * 2 + 1 ];
      }
    }

    this.writeBulkFlags( 'nodes', slots, contiguousFrom, cols );
    this.ingestDataColumns( 'nodes', slots, cols.data );

    if( !resized ){
      this.markBulk( 'node.position', slots );
      this.markBulk( 'node.flags', slots );
    }

    return slots;
  }

  /**
   * Columnar bulk edge add: endpoints are indices into `nodeSlots` (the
   * same payload's nodes) — no id lookups per edge.
   */
  addEdgesColumnar( cols: GpuColumnarEdges, nodeSlots: Uint32Array, newId: () => string ): Uint32Array {
    const count = cols.count;

    if( cols.sources == null || cols.targets == null || cols.sources.length < count || cols.targets.length < count ){
      throw new Error( `Columnar edges must provide ${count} sources and targets` );
    }

    for( let i = 0; i < count; i++ ){
      if( cols.sources[ i ] >= nodeSlots.length || cols.targets[ i ] >= nodeSlots.length ){
        throw new Error(
          `Columnar edge ${i} references node index ` +
          `${Math.max( cols.sources[ i ], cols.targets[ i ] )} but the payload has ${nodeSlots.length} nodes ` +
          `(columnar payloads are self-contained; use the definition form for cross-references)`
        );
      }
    }

    const { slots, resized, contiguousFrom } = this.edges.allocBulk( count );

    if( resized ){ this.dirty.markResized( 'edges' ); }

    this.registerBulk( 'edges', slots, cols.ids, newId );

    const endpoints = this.edges.column( 'edge.endpoints' ) as Uint32Array;

    for( let i = 0; i < count; i++ ){
      const slot = slots[ i ];

      endpoints[ slot * 2 ] = nodeSlots[ cols.sources[ i ] ];
      endpoints[ slot * 2 + 1 ] = nodeSlots[ cols.targets[ i ] ];
    }

    // fresh index: builds CSR in two counting passes; otherwise overlays
    this.adj.addBulk( slots, endpoints, this.nodes.cap );

    this.writeBulkFlags( 'edges', slots, contiguousFrom, cols );
    this.ingestDataColumns( 'edges', slots, cols.data );

    if( !resized ){
      this.markBulk( 'edge.endpoints', slots );
      this.markBulk( 'edge.flags', slots );
    }

    return slots;
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

  /**
   * Whole-graph bounding box as a direct columnar scan — no element
   * handles (a no-arg fit() on a 500k-element graph is a fraction of a
   * millisecond instead of hundreds).  Nodes contribute position ±
   * (size/2 + border/2).  Edges contribute their own extent as a
   * first-class term: today that is the two endpoint node centers (edges
   * are straight center-to-center segments), and future edge geometry —
   * bezier control points, arrow heads — extends the edge term here and
   * in GpuCollection.boundingBox together.  Returns null when empty.
   */
  boundingBox(): { x1: number; y1: number; x2: number; y2: number; w: number; h: number } | null {
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;

    const pos = this.column( 'node.position' ) as Float32Array;
    const size = this.column( 'node.size' ) as Float32Array;
    const border = this.column( 'node.borderWidth' ) as Float32Array;

    this.forEachAlive( 'nodes', slot => {
      const x = pos[ slot * 2 ];
      const y = pos[ slot * 2 + 1 ];
      const hw = size[ slot * 2 ] / 2 + border[ slot ] / 2;
      const hh = size[ slot * 2 + 1 ] / 2 + border[ slot ] / 2;

      if( x - hw < x1 ){ x1 = x - hw; }
      if( y - hh < y1 ){ y1 = y - hh; }
      if( x + hw > x2 ){ x2 = x + hw; }
      if( y + hh > y2 ){ y2 = y + hh; }
    } );

    const endpoints = this.column( 'edge.endpoints' ) as Uint32Array;

    this.forEachAlive( 'edges', slot => {
      for( let end = 0; end < 2; end++ ){
        const node = endpoints[ slot * 2 + end ];
        const x = pos[ node * 2 ];
        const y = pos[ node * 2 + 1 ];

        if( x < x1 ){ x1 = x; }
        if( y < y1 ){ y1 = y; }
        if( x > x2 ){ x2 = x; }
        if( y > y2 ){ y2 = y; }
      }
    } );

    if( x1 === Infinity ){ return null; }

    return { x1, y1, x2, y2, w: x2 - x1, h: y2 - y1 };
  }

  // -- internals --

  /** Sidecar data() values from a def's data object (id/source/target stay first-class). */
  setDefData( group: GroupName, slot: number, data: Record<string, unknown> | undefined ): void {
    if( data == null ){ return; }

    for( const key of Object.keys( data ) ){
      if( key === 'id' || key === 'source' || key === 'target' ){ continue; }

      this.data.set( group, slot, key, data[ key ] );
    }
  }

  private ingestDataColumns(
    group: GroupName, slots: Uint32Array,
    data: Record<string, GpuDataColumn> | undefined
  ): void {
    if( data == null ){ return; }

    for( const key of Object.keys( data ) ){
      this.data.ingestColumn( group, slots, key, data[ key ] );
    }
  }

  /** Register bulk-allocated slots: ids (auto-generated on holes) + insertion order. */
  private registerBulk(
    group: GroupName, slots: Uint32Array,
    ids: ( string | undefined )[] | GpuPackedIds | undefined, newId: () => string
  ): void {
    this.ids.setBulk( group, slots, ids, newId ); // throws on a duplicate id

    const order = this.order[ group ];
    const gen = this.table( group ).gen;

    for( let i = 0; i < slots.length; i++ ){
      const slot = slots[ i ];

      order.slots.push( slot );
      order.gens.push( gen[ slot ] );
    }
  }

  /** Default flags for the whole bulk, then per-element deviations. */
  private writeBulkFlags(
    group: GroupName, slots: Uint32Array, contiguousFrom: number,
    cols: { selected?: Uint8Array; selectable?: Uint8Array }
  ): void {
    const flagsId: ColumnId = group === 'nodes' ? 'node.flags' : 'edge.flags';
    const flags = this.table( group ).column( flagsId ) as Uint32Array;
    const defaults = FLAG_ALIVE | FLAG_VISIBLE | FLAG_SELECTABLE | FLAG_GRABBABLE;
    const count = slots.length;

    if( contiguousFrom < count ){ // fresh run: one fill
      flags.fill( defaults, slots[ contiguousFrom ], slots[ count - 1 ] + 1 );
    }

    for( let i = 0; i < contiguousFrom; i++ ){
      flags[ slots[ i ] ] = defaults;
    }

    if( cols.selected != null ){
      for( let i = 0; i < count; i++ ){
        if( cols.selected[ i ] !== 0 ){ flags[ slots[ i ] ] |= FLAG_SELECTED; }
      }
    }

    if( cols.selectable != null ){
      for( let i = 0; i < count; i++ ){
        if( cols.selectable[ i ] === 0 ){ flags[ slots[ i ] ] &= ~FLAG_SELECTABLE; }
      }
    }
  }

  /** One coalesced dirty span covering all of `slots`. */
  private markBulk( id: ColumnId, slots: Uint32Array ): void {
    if( slots.length === 0 ){ return; }

    let min = slots[ 0 ];
    let max = slots[ 0 ];

    for( let i = 1; i < slots.length; i++ ){
      const slot = slots[ i ];

      if( slot < min ){ min = slot; }
      if( slot > max ){ max = slot; }
    }

    this.dirty.mark( id, min, max + 1 );
  }

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

    this.data.clearSlot( group, slot );

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
  if( opts.grabbable !== false ){ flags |= FLAG_GRABBABLE; }
  if( opts.locked === true ){ flags |= FLAG_LOCKED; }

  return flags;
};
