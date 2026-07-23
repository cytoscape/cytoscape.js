import {
  FLAG_SELECTABLE, FLAG_SELECTED
} from './contract.mjs';
import type { GroupName, Ref } from './contract.mjs';
import { matchesRef, parseSelector } from './selector.mjs';
import type { CompiledSelector } from './selector.mjs';
import { hasListeners, refKey, refQualifier } from './events.mjs';
import type { Position } from '../types.mjs';
import type { GpuCore } from './core.mjs';
import type { EventHandler } from '../emitter.mjs';
import type Event from '../event.mjs';

export type EleFilterFn = ( ele: GpuCollection, i: number, eles: GpuCollection ) => boolean;
export type ElePositionFn = ( ele: GpuCollection, i: number ) => Position | false | undefined;

type SelectorLike = string | CompiledSelector;

const compile = ( selector: SelectorLike ): CompiledSelector => {
  return typeof selector === 'string' ? parseSelector( selector ) : selector;
};

/**
 * A v3-style collection over the columnar store: an element is a length-1
 * collection, interned per live slot so `eles[0]`, `forEach` args and
 * `same()` behave as expected.  Handles hold `{ group, slot, gen }` refs
 * validated on access; stale refs (removed elements) read as no-ops or
 * `undefined`, though cached `id()`/`group()` stay readable.
 */
export class GpuCollection {
  [index: number]: GpuCollection;

  length: number;
  _cy: GpuCore;
  _refs: Ref[];
  _id: string | undefined;
  _group: GroupName | undefined;

  constructor( cy: GpuCore, refs: Ref[], opts: { singleton?: boolean } = {} ){
    this._cy = cy;

    if( opts.singleton ){
      const ref = refs[0];

      this._refs = [ ref ];
      this._id = cy._store.idAt( ref.group, ref.slot );
      this._group = ref.group;
      this[0] = this;
      this.length = 1;

      return;
    }

    // dedupe while preserving order; intern per-element handles
    const seen = new Set<string>();
    const deduped: Ref[] = [];
    let i = 0;

    for( const ref of refs ){
      const key = refKey( ref );

      if( seen.has( key ) ){ continue; }

      seen.add( key );
      deduped.push( ref );
      this[ i ] = cy._eleFromRef( ref );
      i++;
    }

    this._refs = deduped;
    this.length = deduped.length;

    if( deduped.length === 1 ){
      this._id = this[0]._id;
      this._group = deduped[0].group;
    }
  }

  // -- internals --

  get _store(){
    return this._cy._store;
  }

  _first(): Ref | undefined {
    return this._refs[0];
  }

  /** the event system's view of this collection (see events.mts) */
  _eventRef(): Ref | null {
    return this.length === 1 ? this._refs[0] : null;
  }

  _liveRefs(): Ref[] {
    return this._refs.filter( ref => this._store.isCurrent( ref ) );
  }

  _spawn( refs: Ref[] ): GpuCollection {
    return new GpuCollection( this._cy, refs );
  }

  // -- iteration --

  size(): number {
    return this.length;
  }

  empty(): boolean {
    return this.length === 0;
  }

  nonempty(): boolean {
    return this.length > 0;
  }

  forEach( fn: ( ele: GpuCollection, i: number, eles: GpuCollection ) => void | false, thisArg?: unknown ): this {
    for( let i = 0; i < this.length; i++ ){
      const ret = fn.call( thisArg ?? this[ i ], this[ i ], i, this );

      if( ret === false ){ break; } // exit early like v3
    }

    return this;
  }

  declare each: this['forEach'];

  toArray(): GpuCollection[] {
    const array: GpuCollection[] = [];

    for( let i = 0; i < this.length; i++ ){
      array.push( this[ i ] );
    }

    return array;
  }

  slice( start: number = 0, end: number = this.length ): GpuCollection {
    if( start < 0 ){ start = this.length + start; }
    if( end < 0 ){ end = this.length + end; }

    return this._spawn( this._refs.slice( start, end ) );
  }

  eq( i: number ): GpuCollection {
    return this[ i ] ?? this._spawn( [] );
  }

  first(): GpuCollection {
    return this.eq( 0 );
  }

  last(): GpuCollection {
    return this.eq( this.length - 1 );
  }

  map<T>( fn: ( ele: GpuCollection, i: number, eles: GpuCollection ) => T, thisArg?: unknown ): T[] {
    const array: T[] = [];

    for( let i = 0; i < this.length; i++ ){
      array.push( fn.call( thisArg ?? this[ i ], this[ i ], i, this ) );
    }

    return array;
  }

  some( fn: EleFilterFn, thisArg?: unknown ): boolean {
    for( let i = 0; i < this.length; i++ ){
      if( fn.call( thisArg ?? this[ i ], this[ i ], i, this ) ){ return true; }
    }

    return false;
  }

  every( fn: EleFilterFn, thisArg?: unknown ): boolean {
    for( let i = 0; i < this.length; i++ ){
      if( !fn.call( thisArg ?? this[ i ], this[ i ], i, this ) ){ return false; }
    }

    return true;
  }

  // -- identity --

  id(): string | undefined {
    return this[0]?._id;
  }

  group(): GroupName | undefined {
    return this[0]?._group;
  }

  isNode(): boolean {
    return this.group() === 'nodes';
  }

  isEdge(): boolean {
    return this.group() === 'edges';
  }

  removed(): boolean {
    const ref = this._first();

    return ref == null ? false : !this._store.isCurrent( ref );
  }

  inside(): boolean {
    const ref = this._first();

    return ref == null ? false : this._store.isCurrent( ref );
  }

  // -- comparison --

  same( other: GpuCollection ): boolean {
    if( this.length !== other.length ){ return false; }

    const keys = new Set( this._refs.map( refKey ) );

    return other._refs.every( ref => keys.has( refKey( ref ) ) );
  }

  anySame( other: GpuCollection ): boolean {
    const keys = new Set( this._refs.map( refKey ) );

    return other._refs.some( ref => keys.has( refKey( ref ) ) );
  }

  contains( other: GpuCollection ): boolean {
    const keys = new Set( this._refs.map( refKey ) );

    return other._refs.every( ref => keys.has( refKey( ref ) ) );
  }

  declare has: this['contains'];

  allAre( selector: SelectorLike ): boolean {
    const compiled = compile( selector );

    return this._refs.every( ref => matchesRef( this._store, ref, compiled ) );
  }

  is( selector: SelectorLike ): boolean {
    const compiled = compile( selector );

    return this._refs.some( ref => matchesRef( this._store, ref, compiled ) );
  }

  // -- building and filtering --

  union( other: GpuCollection | string ): GpuCollection {
    const otherEles = this._toEles( other );

    return this._spawn( [ ...this._refs, ...otherEles._refs ] );
  }

  declare u: this['union'];
  declare or: this['union'];
  declare add: this['union'];

  difference( other: GpuCollection | string ): GpuCollection {
    const keys = new Set( this._toEles( other )._refs.map( refKey ) );

    return this._spawn( this._refs.filter( ref => !keys.has( refKey( ref ) ) ) );
  }

  declare not: this['difference'];
  declare subtract: this['difference'];

  intersection( other: GpuCollection | string ): GpuCollection {
    const keys = new Set( this._toEles( other )._refs.map( refKey ) );

    return this._spawn( this._refs.filter( ref => keys.has( refKey( ref ) ) ) );
  }

  declare intersect: this['intersection'];
  declare and: this['intersection'];

  symmetricDifference( other: GpuCollection | string ): GpuCollection {
    const otherEles = this._toEles( other );
    const mine = new Set( this._refs.map( refKey ) );
    const theirs = new Set( otherEles._refs.map( refKey ) );

    return this._spawn( [
      ...this._refs.filter( ref => !theirs.has( refKey( ref ) ) ),
      ...otherEles._refs.filter( ref => !mine.has( refKey( ref ) ) )
    ] );
  }

  declare symdiff: this['symmetricDifference'];
  declare xor: this['symmetricDifference'];

  filter( selector: SelectorLike | EleFilterFn, thisArg?: unknown ): GpuCollection {
    if( typeof selector === 'function' ){
      const refs: Ref[] = [];

      for( let i = 0; i < this.length; i++ ){
        if( selector.call( thisArg ?? this[ i ], this[ i ], i, this ) ){
          refs.push( this._refs[ i ] );
        }
      }

      return this._spawn( refs );
    }

    const compiled = compile( selector );

    return this._spawn( this._refs.filter( ref => matchesRef( this._store, ref, compiled ) ) );
  }

  nodes( selector?: SelectorLike ): GpuCollection {
    const nodes = this._spawn( this._refs.filter( ref => ref.group === 'nodes' ) );

    return selector == null ? nodes : nodes.filter( selector );
  }

  edges( selector?: SelectorLike ): GpuCollection {
    const edges = this._spawn( this._refs.filter( ref => ref.group === 'edges' ) );

    return selector == null ? edges : edges.filter( selector );
  }

  getElementById( id: string ): GpuCollection {
    for( let i = 0; i < this.length; i++ ){
      if( this[ i ]._id === id ){ return this[ i ]; }
    }

    return this._spawn( [] );
  }

  private _toEles( other: GpuCollection | string ): GpuCollection {
    return typeof other === 'string' ? this._cy.$( other ) : other;
  }

  // -- position and dimensions --

  position( dim?: string | Position, value?: number ): Position | number | undefined | this {
    // getter forms
    if( dim === undefined || ( typeof dim === 'string' && value === undefined ) ){
      const ref = this._first();

      if( ref == null || ref.group !== 'nodes' || !this._store.isCurrent( ref ) ){ return undefined; }

      const pos = { x: this._store.getX( ref.slot ), y: this._store.getY( ref.slot ) };

      return typeof dim === 'string' ? pos[ dim as 'x' | 'y' ] : pos;
    }

    // setter forms
    if( typeof dim === 'string' ){
      const partial: Position = { x: NaN, y: NaN };

      return this.positions( ele => {
        const prev = ele.position() as Position;

        partial.x = dim === 'x' ? ( value as number ) : prev.x;
        partial.y = dim === 'y' ? ( value as number ) : prev.y;

        return partial;
      } );
    }

    return this.positions( dim );
  }

  positions( pos: Position | ElePositionFn ): this {
    const store = this._store;
    const slots: number[] = [];
    const xy: number[] = [];
    const moved: GpuCollection[] = [];

    for( let i = 0; i < this.length; i++ ){
      const ref = this._refs[ i ];

      if( ref.group !== 'nodes' || !store.isCurrent( ref ) ){ continue; }

      const p = typeof pos === 'function' ? pos( this[ i ], i ) : pos;

      if( p == null || p === false ){ continue; }

      slots.push( ref.slot );
      xy.push( p.x, p.y );
      moved.push( this[ i ] );
    }

    store.setPositions( slots, xy );

    if( hasListeners( this._cy._emitter, 'position' ) ){
      for( const ele of moved ){
        this._cy._emitOnEle( 'position', ele );
      }
    }

    return this;
  }

  renderedPosition(): Position | undefined {
    const pos = this.position() as Position | undefined;

    if( pos == null ){ return undefined; }

    const zoom = this._cy.zoom() as number;
    const pan = this._cy.pan() as Position;

    return { x: pos.x * zoom + pan.x, y: pos.y * zoom + pan.y };
  }

  width(): number | undefined {
    const ref = this._first();

    if( ref == null || !this._store.isCurrent( ref ) ){ return undefined; }

    return ref.group === 'nodes'
      ? ( this._store.column( 'node.size' ) as Float32Array )[ ref.slot * 2 ]
      : ( this._store.column( 'edge.width' ) as Float32Array )[ ref.slot ];
  }

  height(): number | undefined {
    const ref = this._first();

    if( ref == null || !this._store.isCurrent( ref ) ){ return undefined; }

    return ref.group === 'nodes'
      ? ( this._store.column( 'node.size' ) as Float32Array )[ ref.slot * 2 + 1 ]
      : ( this._store.column( 'edge.width' ) as Float32Array )[ ref.slot ];
  }

  /** The node's resolved label text ('' when none); read-only in the prototype. */
  label(): string | undefined {
    const ref = this._first();

    if( ref == null || ref.group !== 'nodes' || !this._store.isCurrent( ref ) ){ return undefined; }

    return this._store.labelAt( ref.slot )?.text ?? '';
  }

  outerWidth(): number | undefined {
    const w = this.width();

    return w == null ? undefined : w + this._borderWidth();
  }

  outerHeight(): number | undefined {
    const h = this.height();

    return h == null ? undefined : h + this._borderWidth();
  }

  private _borderWidth(): number {
    const ref = this._first();

    if( ref == null || ref.group !== 'nodes' ){ return 0; }

    return ( this._store.column( 'node.borderWidth' ) as Float32Array )[ ref.slot ];
  }

  boundingBox(): { x1: number; y1: number; x2: number; y2: number; w: number; h: number } {
    const store = this._store;
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;

    const expandPoint = ( x: number, y: number, halfW: number = 0, halfH: number = 0 ): void => {
      x1 = Math.min( x1, x - halfW );
      y1 = Math.min( y1, y - halfH );
      x2 = Math.max( x2, x + halfW );
      y2 = Math.max( y2, y + halfH );
    };

    const size = store.column( 'node.size' ) as Float32Array;
    const border = store.column( 'node.borderWidth' ) as Float32Array;
    const endpoints = store.column( 'edge.endpoints' ) as Uint32Array;

    for( const ref of this._liveRefs() ){
      if( ref.group === 'nodes' ){
        const slot = ref.slot;

        expandPoint(
          store.getX( slot ), store.getY( slot ),
          size[ slot * 2 ] / 2 + border[ slot ] / 2,
          size[ slot * 2 + 1 ] / 2 + border[ slot ] / 2
        );
      } else {
        expandPoint( store.getX( endpoints[ ref.slot * 2 ] ), store.getY( endpoints[ ref.slot * 2 ] ) );
        expandPoint( store.getX( endpoints[ ref.slot * 2 + 1 ] ), store.getY( endpoints[ ref.slot * 2 + 1 ] ) );
      }
    }

    if( x1 === Infinity ){
      return { x1: 0, y1: 0, x2: 0, y2: 0, w: 0, h: 0 };
    }

    return { x1, y1, x2, y2, w: x2 - x1, h: y2 - y1 };
  }

  // -- selection --

  selected(): boolean {
    const ref = this._first();

    return ref != null && this._store.isCurrent( ref )
      && this._store.hasFlag( ref.group, ref.slot, FLAG_SELECTED );
  }

  selectable(): boolean {
    const ref = this._first();

    return ref != null && this._store.isCurrent( ref )
      && this._store.hasFlag( ref.group, ref.slot, FLAG_SELECTABLE );
  }

  select(): this {
    return this._setSelected( true );
  }

  unselect(): this {
    return this._setSelected( false );
  }

  declare deselect: this['unselect'];

  private _setSelected( selected: boolean ): this {
    const store = this._store;

    for( let i = 0; i < this.length; i++ ){
      const ref = this._refs[ i ];

      if( !store.isCurrent( ref ) ){ continue; }
      if( !store.hasFlag( ref.group, ref.slot, FLAG_SELECTABLE ) ){ continue; }
      if( store.hasFlag( ref.group, ref.slot, FLAG_SELECTED ) === selected ){ continue; }

      store.setFlag( ref.group, ref.slot, FLAG_SELECTED, selected );
      this._cy._applyStyle( ref );
      this._cy._emitOnEle( selected ? 'select' : 'unselect', this[ i ] );
    }

    return this;
  }

  // -- graph manipulation --

  /**
   * Remove these elements from the graph; incident edges of removed nodes
   * cascade.  Returns the removed elements.  Already-removed elements are
   * skipped (no second `remove` event).
   */
  remove(): GpuCollection {
    const cy = this._cy;
    const store = this._store;

    // build the closure: requested live elements + incident edges of removed nodes
    const edgeHandles: GpuCollection[] = [];
    const nodeHandles: GpuCollection[] = [];
    const seen = new Set<string>();

    const addEdge = ( ele: GpuCollection ): void => {
      const key = refKey( ele._refs[0] );

      if( !seen.has( key ) ){
        seen.add( key );
        edgeHandles.push( ele );
      }
    };

    for( let i = 0; i < this.length; i++ ){
      const ref = this._refs[ i ];

      if( !store.isCurrent( ref ) ){ continue; }

      if( ref.group === 'edges' ){
        addEdge( this[ i ] );
      } else {
        nodeHandles.push( this[ i ] );

        for( const edgeSlot of store.adj.connectedEdges( ref.slot ) ){
          addEdge( cy._ele( 'edges', edgeSlot ) );
        }
      }
    }

    // edges first, then nodes; emit remove per element after the store mutation
    for( const edge of edgeHandles ){
      store.removeEdge( edge._refs[0].slot );
    }

    for( const node of nodeHandles ){
      store.removeNode( node._refs[0].slot );
    }

    for( const ele of [ ...edgeHandles, ...nodeHandles ] ){
      cy._emitOnEle( 'remove', ele );
    }

    return this._spawn( [ ...edgeHandles, ...nodeHandles ].map( ele => ele._refs[0] ) );
  }

  // -- traversal --

  source(): GpuCollection {
    return this._endpoint( 0 );
  }

  target(): GpuCollection {
    return this._endpoint( 1 );
  }

  sources(): GpuCollection {
    return this._endpoints( 0 );
  }

  targets(): GpuCollection {
    return this._endpoints( 1 );
  }

  private _endpoint( which: 0 | 1 ): GpuCollection {
    const ref = this._first();

    if( ref == null || ref.group !== 'edges' ){ return this._spawn( [] ); }

    const endpoints = this._store.column( 'edge.endpoints' ) as Uint32Array;

    return this._cy._ele( 'nodes', endpoints[ ref.slot * 2 + which ] );
  }

  private _endpoints( which: 0 | 1 ): GpuCollection {
    const endpoints = this._store.column( 'edge.endpoints' ) as Uint32Array;
    const refs: Ref[] = [];

    for( const ref of this._liveRefs() ){
      if( ref.group !== 'edges' ){ continue; }

      refs.push( this._store.ref( 'nodes', endpoints[ ref.slot * 2 + which ] ) );
    }

    return this._spawn( refs );
  }

  connectedEdges( selector?: SelectorLike ): GpuCollection {
    const refs: Ref[] = [];

    for( const ref of this._liveRefs() ){
      if( ref.group !== 'nodes' ){ continue; }

      for( const edgeSlot of this._store.adj.connectedEdges( ref.slot ) ){
        refs.push( this._store.ref( 'edges', edgeSlot ) );
      }
    }

    const eles = this._spawn( refs );

    return selector == null ? eles : eles.filter( selector );
  }

  connectedNodes( selector?: SelectorLike ): GpuCollection {
    const endpoints = this._store.column( 'edge.endpoints' ) as Uint32Array;
    const refs: Ref[] = [];

    for( const ref of this._liveRefs() ){
      if( ref.group !== 'edges' ){ continue; }

      refs.push( this._store.ref( 'nodes', endpoints[ ref.slot * 2 ] ) );
      refs.push( this._store.ref( 'nodes', endpoints[ ref.slot * 2 + 1 ] ) );
    }

    const eles = this._spawn( refs );

    return selector == null ? eles : eles.filter( selector );
  }

  outgoers( selector?: SelectorLike ): GpuCollection {
    return this._goers( 'out', selector );
  }

  incomers( selector?: SelectorLike ): GpuCollection {
    return this._goers( 'in', selector );
  }

  private _goers( direction: 'out' | 'in', selector?: SelectorLike ): GpuCollection {
    const store = this._store;
    const endpoints = store.column( 'edge.endpoints' ) as Uint32Array;
    const refs: Ref[] = [];

    for( const ref of this._liveRefs() ){
      if( ref.group !== 'nodes' ){ continue; }

      const edgeSlots = direction === 'out' ? store.adj.outEdges( ref.slot ) : store.adj.inEdges( ref.slot );

      for( const edgeSlot of edgeSlots ){
        const otherSlot = direction === 'out' ? endpoints[ edgeSlot * 2 + 1 ] : endpoints[ edgeSlot * 2 ];

        refs.push( store.ref( 'edges', edgeSlot ) );
        refs.push( store.ref( 'nodes', otherSlot ) );
      }
    }

    const eles = this._spawn( refs );

    return selector == null ? eles : eles.filter( selector );
  }

  neighborhood( selector?: SelectorLike ): GpuCollection {
    const store = this._store;
    const endpoints = store.column( 'edge.endpoints' ) as Uint32Array;
    const refs: Ref[] = [];

    for( const ref of this._liveRefs() ){
      if( ref.group !== 'nodes' ){ continue; }

      for( const edgeSlot of store.adj.connectedEdges( ref.slot ) ){
        const source = endpoints[ edgeSlot * 2 ];
        const target = endpoints[ edgeSlot * 2 + 1 ];
        const otherSlot = source === ref.slot ? target : source;

        refs.push( store.ref( 'edges', edgeSlot ) );
        refs.push( store.ref( 'nodes', otherSlot ) );
      }
    }

    // open neighborhood: exclude the collection's own elements
    const eles = this._spawn( refs ).difference( this );

    return selector == null ? eles : eles.filter( selector );
  }

  declare openNeighborhood: this['neighborhood'];

  closedNeighborhood( selector?: SelectorLike ): GpuCollection {
    const eles = this.neighborhood().union( this.nodes() );

    return selector == null ? eles : eles.filter( selector );
  }

  // -- degree --

  degree( includeLoops: boolean = true ): number {
    return this._degree( includeLoops, ( store, slot ) =>
      store.adj.outDegree( slot ) + store.adj.inDegree( slot ) );
  }

  outdegree( includeLoops: boolean = true ): number {
    return this._degree( includeLoops, ( store, slot ) => store.adj.outDegree( slot ), 'out' );
  }

  indegree( includeLoops: boolean = true ): number {
    return this._degree( includeLoops, ( store, slot ) => store.adj.inDegree( slot ), 'in' );
  }

  private _degree(
    includeLoops: boolean,
    count: ( store: GpuCore['_store'], slot: number ) => number,
    direction?: 'out' | 'in'
  ): number {
    const store = this._store;
    const endpoints = store.column( 'edge.endpoints' ) as Uint32Array;
    let total = 0;

    for( const ref of this._liveRefs() ){
      if( ref.group !== 'nodes' ){ continue; }

      total += count( store, ref.slot );

      if( !includeLoops ){
        // a loop contributes 1 to outdegree, 1 to indegree, 2 to degree
        for( const edgeSlot of store.adj.outEdges( ref.slot ) ){
          if( endpoints[ edgeSlot * 2 ] === endpoints[ edgeSlot * 2 + 1 ] ){
            total -= direction == null ? 2 : 1;
          }
        }
      }
    }

    return total;
  }

  // -- events --

  on( events: string, callback?: EventHandler ): this {
    for( const ref of this._refs ){
      this._cy._emitter.on( events, refQualifier( ref ), callback );
    }

    return this;
  }

  declare addListener: this['on'];

  one( events: string, callback?: EventHandler ): this {
    for( const ref of this._refs ){
      this._cy._emitter.on( events, refQualifier( ref ), callback, { one: true } );
    }

    return this;
  }

  off( events: string, callback?: EventHandler ): this {
    for( const ref of this._refs ){
      this._cy._emitter.off( events, refQualifier( ref ), callback );
    }

    return this;
  }

  declare removeListener: this['off'];

  emit( events: string, extraParams?: unknown[] ): this {
    for( let i = 0; i < this.length; i++ ){
      for( const type of events.split( /\s+/ ) ){
        if( type !== '' ){
          this._cy._emitOnEle( type, this[ i ], extraParams );
        }
      }
    }

    return this;
  }

  declare trigger: this['emit'];

  promiseOn( events: string ): Promise<Event> {
    return new Promise( resolve => {
      this.one( events, event => resolve( event ) );
    } );
  }
}

GpuCollection.prototype.each = GpuCollection.prototype.forEach;
GpuCollection.prototype.has = GpuCollection.prototype.contains;
GpuCollection.prototype.u = GpuCollection.prototype.union;
GpuCollection.prototype.or = GpuCollection.prototype.union;
GpuCollection.prototype.add = GpuCollection.prototype.union;
GpuCollection.prototype.not = GpuCollection.prototype.difference;
GpuCollection.prototype.subtract = GpuCollection.prototype.difference;
GpuCollection.prototype.intersect = GpuCollection.prototype.intersection;
GpuCollection.prototype.and = GpuCollection.prototype.intersection;
GpuCollection.prototype.symdiff = GpuCollection.prototype.symmetricDifference;
GpuCollection.prototype.xor = GpuCollection.prototype.symmetricDifference;
GpuCollection.prototype.deselect = GpuCollection.prototype.unselect;
GpuCollection.prototype.openNeighborhood = GpuCollection.prototype.neighborhood;
GpuCollection.prototype.addListener = GpuCollection.prototype.on;
GpuCollection.prototype.removeListener = GpuCollection.prototype.off;
GpuCollection.prototype.trigger = GpuCollection.prototype.emit;
