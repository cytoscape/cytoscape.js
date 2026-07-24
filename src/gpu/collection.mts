import {
  FLAG_GRABBABLE, FLAG_GRABBED, FLAG_LOCKED, FLAG_SELECTABLE, FLAG_SELECTED, FLAG_VISIBLE
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
  /** per-element scratchpad, lazily created on the interned singleton handle */
  _scratch?: Record<string, unknown>;

  constructor( cy: GpuCore, refs: Ref[], opts: { singleton?: boolean; unique?: boolean } = {} ){
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

    let deduped: Ref[];

    if( opts.unique ){
      // trusted internal path: the refs are known distinct (fresh adds,
      // ordered-slot iteration), so skip the refKey/Set dedupe pass
      deduped = refs;

      for( let i = 0; i < refs.length; i++ ){
        this[ i ] = cy._eleFromRef( refs[ i ] );
      }
    } else {
      // dedupe while preserving order; intern per-element handles
      const seen = new Set<string>();

      deduped = [];

      let i = 0;

      for( const ref of refs ){
        const key = refKey( ref );

        if( seen.has( key ) ){ continue; }

        seen.add( key );
        deduped.push( ref );
        this[ i ] = cy._eleFromRef( ref );
        i++;
      }
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

  // -- core reference & identity --

  instanceString(): string {
    return 'collection';
  }

  /** The core this collection belongs to. */
  cy(): GpuCore {
    return this._cy;
  }

  /** The renderer, or null when headless. */
  renderer(): GpuCore['_renderer'] {
    return this._cy._renderer;
  }

  /** The first element as a length-1 collection (empty collection when empty). */
  element(): GpuCollection {
    return this.eq( 0 );
  }

  /** An empty collection in the same core. */
  collection(): GpuCollection {
    return this._cy.collection();
  }

  hasElementWithId( id: string ): boolean {
    return this.getElementById( id ).nonempty();
  }

  /** Index of `ele` (the first element of it) within this collection, or -1. */
  indexOf( ele: GpuCollection ): number {
    const ref = ele._first();

    if( ref == null ){ return -1; }

    const key = refKey( ref );

    for( let i = 0; i < this._refs.length; i++ ){
      if( refKey( this._refs[ i ] ) === key ){ return i; }
    }

    return -1;
  }

  indexOfId( id: string ): number {
    for( let i = 0; i < this.length; i++ ){
      if( this[ i ]._id === id ){ return i; }
    }

    return -1;
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

  sort( sortFn: ( a: GpuCollection, b: GpuCollection ) => number ): GpuCollection {
    if( typeof sortFn !== 'function' ){ return this; }

    const sorted = this.toArray().sort( sortFn );

    return this._spawn( sorted.map( ele => ele._refs[ 0 ] ) );
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

  /** Plain-object form of the first element (undefined when empty). */
  json(): Record<string, unknown> | undefined {
    const ref = this._first();

    if( ref == null ){ return undefined; }

    const group = this._group ?? ref.group;
    const data = ( this.data() as Record<string, unknown> ) ?? { id: this.id() };
    const json: Record<string, unknown> = {
      group,
      data,
      removed: this.removed(),
      selected: this.selected(),
      selectable: this.selectable(),
      classes: ''
    };

    if( group === 'nodes' ){
      json.position = ( this.position() as Position | undefined ) ?? { x: 0, y: 0 };
    }

    return json;
  }

  /** Plain-object form of every element. */
  jsons(): ( Record<string, unknown> | undefined )[] {
    const out: ( Record<string, unknown> | undefined )[] = [];

    for( let i = 0; i < this.length; i++ ){
      out.push( this[ i ].json() );
    }

    return out;
  }

  isNode(): boolean {
    return this.group() === 'nodes';
  }

  isEdge(): boolean {
    return this.group() === 'edges';
  }

  isLoop(): boolean {
    return this._isLoop( true );
  }

  isSimple(): boolean {
    return this._isLoop( false );
  }

  private _isLoop( wantLoop: boolean ): boolean {
    const ref = this._first();

    if( ref == null || ref.group !== 'edges' || !this._store.isCurrent( ref ) ){ return false; }

    const endpoints = this._store.column( 'edge.endpoints' ) as Uint32Array;
    const isLoop = endpoints[ ref.slot * 2 ] === endpoints[ ref.slot * 2 + 1 ];

    return wantLoop ? isLoop : !isLoop;
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
  declare equal: this['same'];
  declare equals: this['same'];

  /** Whether every element of `other` is in this collection's neighborhood. */
  allAreNeighbors( other: GpuCollection | string ): boolean {
    const coll = this._toEles( other );
    const nhood = this.neighborhood();

    return coll.every( ele => nhood.hasElementWithId( ele.id() as string ) );
  }

  declare allAreNeighbours: this['allAreNeighbors'];

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
  declare merge: this['union'];

  difference( other: GpuCollection | string ): GpuCollection {
    const keys = new Set( this._toEles( other )._refs.map( refKey ) );

    return this._spawn( this._refs.filter( ref => !keys.has( refKey( ref ) ) ) );
  }

  declare not: this['difference'];
  declare subtract: this['difference'];
  declare unmerge: this['difference'];
  declare relativeComplement: this['difference'];

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

  /** Split into { nodes, edges }. */
  byGroup(): { nodes: GpuCollection; edges: GpuCollection } {
    return { nodes: this.nodes(), edges: this.edges() };
  }

  /** All elements of the graph not in this collection. */
  absoluteComplement(): GpuCollection {
    return this._cy.elements().difference( this );
  }

  declare complement: this['absoluteComplement'];
  declare abscomp: this['absoluteComplement'];

  /** { left: only in this, right: only in other, both: in both }. */
  diff( other: GpuCollection | string ): {
    left: GpuCollection; right: GpuCollection; both: GpuCollection;
  } {
    const otherColl = this._toEles( other );
    const mine = new Set( this._refs.map( refKey ) );
    const theirs = new Set( otherColl._refs.map( refKey ) );

    return {
      left: this._spawn( this._refs.filter( ref => !theirs.has( refKey( ref ) ) ) ),
      right: this._spawn( otherColl._refs.filter( ref => !mine.has( refKey( ref ) ) ) ),
      both: this._spawn( this._refs.filter( ref => theirs.has( refKey( ref ) ) ) )
    };
  }

  reduce<T>( fn: ( acc: T, ele: GpuCollection, i: number, eles: GpuCollection ) => T, initial: T ): T {
    let val = initial;

    for( let i = 0; i < this.length; i++ ){
      val = fn( val, this[ i ], i, this );
    }

    return val;
  }

  /** The element maximizing `valFn`, with its value ({ value: -Infinity, ele: undefined } when empty). */
  max(
    valFn: ( ele: GpuCollection, i: number, eles: GpuCollection ) => number, thisArg?: unknown
  ): { value: number; ele: GpuCollection | undefined } {
    return this._extremum( valFn, thisArg, 1 );
  }

  min(
    valFn: ( ele: GpuCollection, i: number, eles: GpuCollection ) => number, thisArg?: unknown
  ): { value: number; ele: GpuCollection | undefined } {
    return this._extremum( valFn, thisArg, -1 );
  }

  private _extremum(
    valFn: ( ele: GpuCollection, i: number, eles: GpuCollection ) => number,
    thisArg: unknown, sign: 1 | -1
  ): { value: number; ele: GpuCollection | undefined } {
    let best = sign * -Infinity;
    let bestEle: GpuCollection | undefined;

    for( let i = 0; i < this.length; i++ ){
      const val = valFn.call( thisArg ?? this[ i ], this[ i ], i, this );

      if( sign * val > sign * best ){
        best = val;
        bestEle = this[ i ];
      }
    }

    return { value: best, ele: bestEle };
  }

  private _toEles( other: GpuCollection | string ): GpuCollection {
    return typeof other === 'string' ? this._cy.$( other ) : other;
  }

  // -- position and dimensions --

  position( dim?: string | Position, value?: number ): Position | number | undefined | this {
    return this._positionImpl( dim, value, false );
  }

  silentPosition( dim?: string | Position, value?: number ): Position | number | undefined | this {
    return this._positionImpl( dim, value, true );
  }

  declare modelPosition: this['position'];
  declare point: this['position'];

  private _positionImpl(
    dim: string | Position | undefined, value: number | undefined, silent: boolean
  ): Position | number | undefined | this {
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

      return this._positions( ele => {
        const prev = ele.position() as Position;

        partial.x = dim === 'x' ? ( value as number ) : prev.x;
        partial.y = dim === 'y' ? ( value as number ) : prev.y;

        return partial;
      }, silent );
    }

    return this._positions( dim, silent );
  }

  positions( pos: Position | ElePositionFn ): this {
    return this._positions( pos, false );
  }

  silentPositions( pos: Position | ElePositionFn ): this {
    return this._positions( pos, true );
  }

  declare modelPositions: this['positions'];
  declare points: this['positions'];

  private _positions( pos: Position | ElePositionFn, silent: boolean ): this {
    const store = this._store;
    const slots: number[] = [];
    const xy: number[] = [];
    const moved: GpuCollection[] = [];

    for( let i = 0; i < this.length; i++ ){
      const ref = this._refs[ i ];

      if( ref.group !== 'nodes' || !store.isCurrent( ref ) ){ continue; }

      const p = typeof pos === 'function' ? pos( this[ i ], i ) : pos;

      if( p == null || p === false ){ continue; }

      // a partial object (e.g. { y: 3 }) leaves the omitted axis unchanged,
      // matching v3's position() merge semantics
      const pp = p as { x?: number; y?: number };
      let px: number;
      let py: number;

      if( pp.x == null || pp.y == null ){
        const prev = this[ i ].position() as Position;

        px = pp.x == null ? prev.x : pp.x;
        py = pp.y == null ? prev.y : pp.y;
      } else {
        px = pp.x;
        py = pp.y;
      }

      slots.push( ref.slot );
      xy.push( px, py );
      moved.push( this[ i ] );
    }

    store.setPositions( slots, xy );

    if( !silent && hasListeners( this._cy._emitter, 'position' ) ){
      for( const ele of moved ){
        this._cy._emitOnEle( 'position', ele );
      }
    }

    return this;
  }

  /** Offset positions by a vector or a single dimension. */
  shift( dim: string | Position, value?: number ): this {
    return this._shift( dim, value, false );
  }

  silentShift( dim: string | Position, value?: number ): this {
    return this._shift( dim, value, true );
  }

  private _shift( dim: string | Position, value: number | undefined, silent: boolean ): this {
    const delta: Position = typeof dim === 'string'
      ? { x: dim === 'x' ? ( value as number ) : 0, y: dim === 'y' ? ( value as number ) : 0 }
      : { x: dim.x || 0, y: dim.y || 0 };

    return this._positions( ele => {
      const p = ele.position() as Position;

      return { x: p.x + delta.x, y: p.y + delta.y };
    }, silent );
  }

  /** Without compound nodes, relative position is the model position. */
  relativePosition( dim?: string | Position, value?: number ): Position | number | undefined | this {
    return this._positionImpl( dim, value, false );
  }

  declare relativePoint: this['relativePosition'];

  renderedPosition( dim?: string | Position, value?: number ): Position | number | undefined | this {
    const zoom = this._cy.zoom() as number;
    const pan = this._cy.pan() as Position;

    // getter forms
    if( dim === undefined || ( typeof dim === 'string' && value === undefined ) ){
      const pos = this.position() as Position | undefined;

      if( pos == null ){ return undefined; }

      const rendered = { x: pos.x * zoom + pan.x, y: pos.y * zoom + pan.y };

      return typeof dim === 'string' ? rendered[ dim as 'x' | 'y' ] : rendered;
    }

    // setter forms: rendered → model
    const toModel = ( rx: number, ry: number ): Position => ( { x: ( rx - pan.x ) / zoom, y: ( ry - pan.y ) / zoom } );

    if( typeof dim === 'string' ){
      return this._positions( ele => {
        const prev = ele.renderedPosition() as Position;
        const rx = dim === 'x' ? ( value as number ) : prev.x;
        const ry = dim === 'y' ? ( value as number ) : prev.y;

        return toModel( rx, ry );
      }, false );
    }

    return this._positions( toModel( dim.x, dim.y ), false );
  }

  declare renderedPoint: this['renderedPosition'];

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

  /**
   * data() over the sidecar columns.  `id` (and `source`/`target` on
   * edges) are first-class and immutable — reading them works, writing
   * them throws.  Setters apply to every element in the collection and
   * emit `data` per element; a write refreshes data-mapped labels.
   */
  data( ...args: [] | [ string ] | [ string, unknown ] | [ Record<string, unknown> ] ): unknown {
    const [ key, value ] = args;

    // whole-object getter
    if( args.length === 0 ){
      const ref = this._first();

      if( ref == null || !this._store.isCurrent( ref ) ){ return undefined; }

      const out: Record<string, unknown> = { id: this._store.idAt( ref.group, ref.slot ) };

      if( ref.group === 'edges' ){
        out.source = this.source().id();
        out.target = this.target().id();
      }

      return Object.assign( out, this._store.data.object( ref.group, ref.slot ) );
    }

    // single-key getter
    if( typeof key === 'string' && args.length === 1 ){
      const ref = this._first();

      if( ref == null || !this._store.isCurrent( ref ) ){ return undefined; }
      if( key === 'id' ){ return this._store.idAt( ref.group, ref.slot ); }

      if( ref.group === 'edges' && ( key === 'source' || key === 'target' ) ){
        return ( key === 'source' ? this.source() : this.target() ).id();
      }

      return this._store.data.get( ref.group, ref.slot, key );
    }

    // setter forms: one key (undefined clears it) or an object of keys
    const patch: Record<string, unknown> = typeof key === 'string'
      ? { [ key ]: value }
      : key as Record<string, unknown>;

    return this._setData( patch );
  }

  private _setData( patch: Record<string, unknown> ): this {
    const store = this._store;
    const cy = this._cy;
    const keys = Object.keys( patch );

    for( const k of keys ){
      if( k === 'id' ){
        throw new Error( `Can not change the immutable data field 'id'` );
      }
    }

    for( let i = 0; i < this.length; i++ ){
      const ref = this._refs[ i ];

      if( !store.isCurrent( ref ) ){ continue; }

      for( const k of keys ){
        if( ref.group === 'edges' && ( k === 'source' || k === 'target' ) ){
          throw new Error( `Can not change the immutable data field '${k}' of an edge` );
        }

        store.data.set( ref.group, ref.slot, k, patch[ k ] );
      }

      cy._onDataChanged( ref );

      if( hasListeners( cy._emitter, 'data' ) ){
        cy._emitOnEle( 'data', this[ i ] );
      }
    }

    return this;
  }

  /** Remove named sidecar keys (space-separated), or all of them when omitted. */
  removeData( names?: string ): this {
    const store = this._store;
    const requested = names == null ? null : names.split( /\s+/ ).filter( n => n !== '' );

    for( let i = 0; i < this.length; i++ ){
      const ref = this._refs[ i ];

      if( !store.isCurrent( ref ) ){ continue; }

      const keys = requested ?? Object.keys( store.data.object( ref.group, ref.slot ) );
      const patch: Record<string, unknown> = {};

      for( const k of keys ){ patch[ k ] = undefined; }

      if( Object.keys( patch ).length > 0 ){ this[ i ]._setData( patch ); }
    }

    return this;
  }

  declare attr: this['data'];
  declare removeAttr: this['removeData'];

  /**
   * Per-element scratchpad (plain JS, not a column): `scratch()` reads the
   * first element's whole object, `scratch(ns)` one namespace, `scratch(ns,
   * val)` / `scratch(obj)` write to every element.
   */
  scratch(
    ...args: [] | [ string ] | [ string, unknown ] | [ Record<string, unknown> ]
  ): unknown {
    const [ ns, value ] = args;

    // whole-object getter
    if( args.length === 0 ){
      return this[ 0 ]?._scratch ?? {};
    }

    // single-namespace getter
    if( typeof ns === 'string' && args.length === 1 ){
      return this[ 0 ]?._scratch?.[ ns ];
    }

    const patch: Record<string, unknown> = typeof ns === 'string'
      ? { [ ns ]: value }
      : ns as Record<string, unknown>;

    for( let i = 0; i < this.length; i++ ){
      const ele = this[ i ];

      ele._scratch ??= {};
      Object.assign( ele._scratch, patch );
    }

    return this;
  }

  removeScratch( namespace?: string ): this {
    for( let i = 0; i < this.length; i++ ){
      const ele = this[ i ];

      if( ele._scratch == null ){ continue; }

      if( namespace == null ){
        ele._scratch = {};
      } else {
        delete ele._scratch[ namespace ];
      }
    }

    return this;
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

  /** boundingBox() transformed into rendered (on-screen) coordinates. */
  renderedBoundingBox(): { x1: number; y1: number; x2: number; y2: number; w: number; h: number } {
    const bb = this.boundingBox();
    const zoom = this._cy.zoom() as number;
    const pan = this._cy.pan() as Position;
    const x1 = bb.x1 * zoom + pan.x;
    const y1 = bb.y1 * zoom + pan.y;
    const x2 = bb.x2 * zoom + pan.x;
    const y2 = bb.y2 * zoom + pan.y;

    return { x1, y1, x2, y2, w: x2 - x1, h: y2 - y1 };
  }

  declare renderedBoundingbox: this['renderedBoundingBox'];

  renderedWidth(): number | undefined {
    return this._rendered( this.width() );
  }

  renderedHeight(): number | undefined {
    return this._rendered( this.height() );
  }

  renderedOuterWidth(): number | undefined {
    return this._rendered( this.outerWidth() );
  }

  renderedOuterHeight(): number | undefined {
    return this._rendered( this.outerHeight() );
  }

  private _rendered( modelLength: number | undefined ): number | undefined {
    return modelLength == null ? undefined : modelLength * ( this._cy.zoom() as number );
  }

  /** Midpoint of the edge (endpoint node centers; edges are straight in the prototype). */
  midpoint(): Position | undefined {
    const ref = this._first();

    if( ref == null || ref.group !== 'edges' || !this._store.isCurrent( ref ) ){ return undefined; }

    const endpoints = this._store.column( 'edge.endpoints' ) as Uint32Array;
    const s = endpoints[ ref.slot * 2 ];
    const t = endpoints[ ref.slot * 2 + 1 ];

    return {
      x: ( this._store.getX( s ) + this._store.getX( t ) ) / 2,
      y: ( this._store.getY( s ) + this._store.getY( t ) ) / 2
    };
  }

  renderedMidpoint(): Position | undefined {
    return this._toRenderedPoint( this.midpoint() );
  }

  /** The edge's source-side endpoint (node center approximation for straight edges). */
  sourceEndpoint(): Position | undefined {
    return this._endpointPoint( 0 );
  }

  targetEndpoint(): Position | undefined {
    return this._endpointPoint( 1 );
  }

  renderedSourceEndpoint(): Position | undefined {
    return this._toRenderedPoint( this.sourceEndpoint() );
  }

  renderedTargetEndpoint(): Position | undefined {
    return this._toRenderedPoint( this.targetEndpoint() );
  }

  private _endpointPoint( which: 0 | 1 ): Position | undefined {
    const ref = this._first();

    if( ref == null || ref.group !== 'edges' || !this._store.isCurrent( ref ) ){ return undefined; }

    const endpoints = this._store.column( 'edge.endpoints' ) as Uint32Array;
    const node = endpoints[ ref.slot * 2 + which ];

    return { x: this._store.getX( node ), y: this._store.getY( node ) };
  }

  private _toRenderedPoint( pos: Position | undefined ): Position | undefined {
    if( pos == null ){ return undefined; }

    const zoom = this._cy.zoom() as number;
    const pan = this._cy.pan() as Position;

    return { x: pos.x * zoom + pan.x, y: pos.y * zoom + pan.y };
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

  selectify(): this {
    return this._setBit( FLAG_SELECTABLE, true );
  }

  unselectify(): this {
    return this._setBit( FLAG_SELECTABLE, false );
  }

  // -- grab / lock --

  grabbable(): boolean {
    return this._hasBit( FLAG_GRABBABLE );
  }

  grabbed(): boolean {
    return this._hasBit( FLAG_GRABBED );
  }

  grabify(): this {
    return this._setBit( FLAG_GRABBABLE, true );
  }

  ungrabify(): this {
    return this._setBit( FLAG_GRABBABLE, false );
  }

  // -- visibility --

  /**
   * Whether the first element is shown (FLAG_VISIBLE).  The renderer's cull
   * pass and CPU picking both mask on ALIVE|VISIBLE, so hiding removes an
   * element from drawing and picking; edges of a hidden node also drop out.
   */
  visible(): boolean {
    return this._hasBit( FLAG_VISIBLE );
  }

  hidden(): boolean {
    const ref = this._first();

    return ref == null || !this._store.isCurrent( ref ) || !this._store.hasFlag( ref.group, ref.slot, FLAG_VISIBLE );
  }

  show(): this {
    return this._setBit( FLAG_VISIBLE, true );
  }

  hide(): this {
    return this._setBit( FLAG_VISIBLE, false );
  }

  locked(): boolean {
    return this._hasBit( FLAG_LOCKED );
  }

  lock(): this {
    return this._setBit( FLAG_LOCKED, true );
  }

  unlock(): this {
    return this._setBit( FLAG_LOCKED, false );
  }

  private _hasBit( bit: number ): boolean {
    const ref = this._first();

    return ref != null && this._store.isCurrent( ref ) && this._store.hasFlag( ref.group, ref.slot, bit );
  }

  private _setBit( bit: number, on: boolean ): this {
    const store = this._store;

    for( let i = 0; i < this.length; i++ ){
      const ref = this._refs[ i ];

      if( store.isCurrent( ref ) ){ store.setFlag( ref.group, ref.slot, bit, on ); }
    }

    return this;
  }

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

  /**
   * Re-point edges at a new source and/or target node (by id), in place —
   * the edge keeps its slot, id and data.  Node `parent` moves (compounds)
   * are out of scope and ignored.  Returns this collection.
   */
  move( opts: { source?: string; target?: string } ): this {
    const store = this._store;

    if( opts.source == null && opts.target == null ){ return this; }

    const newSource = opts.source != null ? this._resolveNode( opts.source, 'source' ) : null;
    const newTarget = opts.target != null ? this._resolveNode( opts.target, 'target' ) : null;

    for( let i = 0; i < this.length; i++ ){
      const ref = this._refs[ i ];

      if( ref.group !== 'edges' || !store.isCurrent( ref ) ){ continue; }

      const endpoints = store.column( 'edge.endpoints' ) as Uint32Array;

      store.moveEdge(
        ref.slot,
        newSource ?? endpoints[ ref.slot * 2 ],
        newTarget ?? endpoints[ ref.slot * 2 + 1 ]
      );

      if( hasListeners( this._cy._emitter, 'move' ) ){ this._cy._emitOnEle( 'move', this[ i ] ); }
    }

    return this;
  }

  private _resolveNode( id: string, role: string ): number {
    const ref = this._store.lookup( id );

    if( ref == null || ref.group !== 'nodes' ){
      throw new Error( `Can not move edge to nonexistant ${role} node '${id}'` );
    }

    return ref.slot;
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

  // -- DAG traversal --

  /** Collection nodes with no non-loop incoming edge (whole-graph incidence, as in v3). */
  roots( selector?: SelectorLike ): GpuCollection {
    return this._dagExtremity( 'in', selector );
  }

  /** Collection nodes with no non-loop outgoing edge. */
  leaves( selector?: SelectorLike ): GpuCollection {
    return this._dagExtremity( 'out', selector );
  }

  private _dagExtremity( direction: 'in' | 'out', selector?: SelectorLike ): GpuCollection {
    const store = this._store;
    const endpoints = store.column( 'edge.endpoints' ) as Uint32Array;
    const refs: Ref[] = [];

    for( const ref of this._liveRefs() ){
      if( ref.group !== 'nodes' ){ continue; }

      const edges = direction === 'in' ? store.adj.inEdges( ref.slot ) : store.adj.outEdges( ref.slot );
      let disqualified = false;

      for( const edgeSlot of edges ){
        // a loop (source === target) never disqualifies
        if( endpoints[ edgeSlot * 2 ] !== endpoints[ edgeSlot * 2 + 1 ] ){ disqualified = true; break; }
      }

      if( !disqualified ){ refs.push( ref ); }
    }

    const eles = this._spawn( refs );

    return selector == null ? eles : eles.filter( selector );
  }

  successors( selector?: SelectorLike ): GpuCollection {
    return this._dagAllHops( 'out', selector );
  }

  predecessors( selector?: SelectorLike ): GpuCollection {
    return this._dagAllHops( 'in', selector );
  }

  private _dagAllHops( direction: 'out' | 'in', selector?: SelectorLike ): GpuCollection {
    const acc: Ref[] = [];
    const seen = new Set<string>();
    const hop = ( eles: GpuCollection ): GpuCollection =>
      direction === 'out' ? eles.outgoers() : eles.incomers();

    let frontier = hop( this );

    for( ;; ){
      if( frontier.length === 0 ){ break; }

      let newNext = false;

      for( let i = 0; i < frontier.length; i++ ){
        const key = refKey( frontier._refs[ i ] );

        if( !seen.has( key ) ){
          seen.add( key );
          acc.push( frontier._refs[ i ] );
          newNext = true;
        }
      }

      if( !newNext ){ break; } // reached the closure

      frontier = hop( frontier );
    }

    const out = this._spawn( acc );

    return selector == null ? out : out.filter( selector );
  }

  // -- edge relations --

  edgesWith( others: GpuCollection | string ): GpuCollection {
    return this._edgesWith( others, false );
  }

  edgesTo( others: GpuCollection | string ): GpuCollection {
    return this._edgesWith( others, true );
  }

  private _edgesWith( others: GpuCollection | string, thisIsSrc: boolean ): GpuCollection {
    const store = this._store;
    const endpoints = store.column( 'edge.endpoints' ) as Uint32Array;
    const otherColl = this._toEles( others );

    const thisNodes = this._nodeSlotSet();
    const otherNodes = otherColl._nodeSlotSet();
    const refs: Ref[] = [];

    for( const oref of otherColl._liveRefs() ){
      if( oref.group !== 'nodes' ){ continue; }

      for( const edgeSlot of store.adj.connectedEdges( oref.slot ) ){
        const s = endpoints[ edgeSlot * 2 ];
        const t = endpoints[ edgeSlot * 2 + 1 ];
        const thisToOther = thisNodes.has( s ) && otherNodes.has( t );
        const otherToThis = otherNodes.has( s ) && thisNodes.has( t );

        if( !( thisToOther || otherToThis ) ){ continue; }
        if( thisIsSrc && !thisToOther ){ continue; }

        refs.push( store.ref( 'edges', edgeSlot ) );
      }
    }

    return this._spawn( refs );
  }

  parallelEdges( selector?: SelectorLike ): GpuCollection {
    return this._parallelEdges( false, selector );
  }

  codirectedEdges( selector?: SelectorLike ): GpuCollection {
    return this._parallelEdges( true, selector );
  }

  private _parallelEdges( codirectedOnly: boolean, selector?: SelectorLike ): GpuCollection {
    const store = this._store;
    const endpoints = store.column( 'edge.endpoints' ) as Uint32Array;
    const refs: Ref[] = [];

    for( const ref of this._liveRefs() ){
      if( ref.group !== 'edges' ){ continue; }

      const src1 = endpoints[ ref.slot * 2 ];
      const tgt1 = endpoints[ ref.slot * 2 + 1 ];

      // every edge parallel to this one is incident to its source node
      for( const e2 of store.adj.connectedEdges( src1 ) ){
        const s2 = endpoints[ e2 * 2 ];
        const t2 = endpoints[ e2 * 2 + 1 ];
        const codirected = s2 === src1 && t2 === tgt1;
        const opposed = s2 === tgt1 && t2 === src1;

        if( ( codirectedOnly && codirected ) || ( !codirectedOnly && ( codirected || opposed ) ) ){
          refs.push( store.ref( 'edges', e2 ) );
        }
      }
    }

    const eles = this._spawn( refs );

    return selector == null ? eles : eles.filter( selector );
  }

  // -- connected components --

  /**
   * Connected components within this collection (undirected), each as a
   * collection of the reached nodes plus the collection's edges internal
   * to that component.  `root` restricts the seed nodes.
   */
  components( root?: GpuCollection | string | null ): GpuCollection[] {
    const store = this._store;
    const endpoints = store.column( 'edge.endpoints' ) as Uint32Array;
    const nodeSlots = this._nodeSlotSet();
    const edgeSlots: number[] = [];
    const edgeSlotSet = new Set<number>();

    for( const ref of this._liveRefs() ){
      if( ref.group === 'edges' ){ edgeSlots.push( ref.slot ); edgeSlotSet.add( ref.slot ); }
    }

    let seeds: number[];

    if( root == null ){
      seeds = [ ...nodeSlots ];
    } else {
      const rootColl = this._toEles( root );
      const rootNodes = rootColl._nodeSlotSet();

      seeds = rootNodes.size > 0
        ? [ ...rootNodes ].filter( s => nodeSlots.has( s ) )
        // root has only edges: seed from their source-side nodes
        : rootColl._liveRefs()
          .filter( r => r.group === 'edges' )
          .map( r => endpoints[ r.slot * 2 ] )
          .filter( s => nodeSlots.has( s ) );
    }

    const visited = new Set<number>();
    const comps: GpuCollection[] = [];

    for( const seed of seeds ){
      if( visited.has( seed ) ){ continue; }

      const compNodes = new Set<number>();
      const stack = [ seed ];

      visited.add( seed );

      while( stack.length > 0 ){
        const n = stack.pop() as number;

        compNodes.add( n );

        for( const edgeSlot of store.adj.connectedEdges( n ) ){
          if( !edgeSlotSet.has( edgeSlot ) ){ continue; } // only walk edges within this collection

          const s = endpoints[ edgeSlot * 2 ];
          const t = endpoints[ edgeSlot * 2 + 1 ];
          const other = s === n ? t : s;

          if( nodeSlots.has( other ) && !visited.has( other ) ){
            visited.add( other );
            stack.push( other );
          }
        }
      }

      const refs: Ref[] = [];

      for( const s of compNodes ){ refs.push( store.ref( 'nodes', s ) ); }

      for( const edgeSlot of edgeSlots ){
        if( compNodes.has( endpoints[ edgeSlot * 2 ] ) && compNodes.has( endpoints[ edgeSlot * 2 + 1 ] ) ){
          refs.push( store.ref( 'edges', edgeSlot ) );
        }
      }

      comps.push( this._spawn( refs ) );
    }

    return comps;
  }

  declare componentsOf: this['components'];

  /** The whole-graph connected component containing the first element. */
  component(): GpuCollection {
    if( this._first() == null ){ return this._spawn( [] ); }

    return this._cy.elements().components( this )[ 0 ] ?? this._spawn( [] );
  }

  private _nodeSlotSet(): Set<number> {
    const set = new Set<number>();

    for( const ref of this._liveRefs() ){
      if( ref.group === 'nodes' ){ set.add( ref.slot ); }
    }

    return set;
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

  minDegree( includeLoops: boolean = true ): number | undefined {
    return this._degreeBound( 'degree', includeLoops, -1 );
  }

  maxDegree( includeLoops: boolean = true ): number | undefined {
    return this._degreeBound( 'degree', includeLoops, 1 );
  }

  minIndegree( includeLoops: boolean = true ): number | undefined {
    return this._degreeBound( 'indegree', includeLoops, -1 );
  }

  maxIndegree( includeLoops: boolean = true ): number | undefined {
    return this._degreeBound( 'indegree', includeLoops, 1 );
  }

  minOutdegree( includeLoops: boolean = true ): number | undefined {
    return this._degreeBound( 'outdegree', includeLoops, -1 );
  }

  maxOutdegree( includeLoops: boolean = true ): number | undefined {
    return this._degreeBound( 'outdegree', includeLoops, 1 );
  }

  totalDegree( includeLoops: boolean = true ): number {
    let total = 0;

    for( let i = 0; i < this.length; i++ ){
      if( this[ i ].isNode() ){ total += this[ i ].degree( includeLoops ); }
    }

    return total;
  }

  private _degreeBound(
    fn: 'degree' | 'indegree' | 'outdegree', includeLoops: boolean, sign: 1 | -1
  ): number | undefined {
    let ret: number | undefined;

    for( let i = 0; i < this.length; i++ ){
      if( !this[ i ].isNode() ){ continue; }

      const degree = fn === 'degree'
        ? this[ i ].degree( includeLoops )
        : fn === 'indegree' ? this[ i ].indegree( includeLoops ) : this[ i ].outdegree( includeLoops );

      if( ret === undefined || sign * degree > sign * ret ){ ret = degree; }
    }

    return ret;
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

  declare once: this['one'];
  declare listen: this['on'];
  declare bind: this['on'];

  off( events: string, callback?: EventHandler ): this {
    for( const ref of this._refs ){
      this._cy._emitter.off( events, refQualifier( ref ), callback );
    }

    return this;
  }

  declare removeListener: this['off'];
  declare unlisten: this['off'];
  declare unbind: this['off'];

  emit( events: string, extraParams?: unknown[] ): this {
    // v4 does not support event namespaces (see PLAN.md); types are emitted verbatim
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

  declare pon: this['promiseOn'];
}

GpuCollection.prototype.each = GpuCollection.prototype.forEach;
GpuCollection.prototype.has = GpuCollection.prototype.contains;
GpuCollection.prototype.u = GpuCollection.prototype.union;
GpuCollection.prototype.or = GpuCollection.prototype.union;
GpuCollection.prototype.add = GpuCollection.prototype.union;
GpuCollection.prototype.merge = GpuCollection.prototype.union;
GpuCollection.prototype.not = GpuCollection.prototype.difference;
GpuCollection.prototype.subtract = GpuCollection.prototype.difference;
GpuCollection.prototype.unmerge = GpuCollection.prototype.difference;
GpuCollection.prototype.relativeComplement = GpuCollection.prototype.difference;
GpuCollection.prototype.complement = GpuCollection.prototype.absoluteComplement;
GpuCollection.prototype.abscomp = GpuCollection.prototype.absoluteComplement;
GpuCollection.prototype.equal = GpuCollection.prototype.same;
GpuCollection.prototype.equals = GpuCollection.prototype.same;
GpuCollection.prototype.allAreNeighbours = GpuCollection.prototype.allAreNeighbors;
GpuCollection.prototype.modelPosition = GpuCollection.prototype.position;
GpuCollection.prototype.point = GpuCollection.prototype.position;
GpuCollection.prototype.modelPositions = GpuCollection.prototype.positions;
GpuCollection.prototype.points = GpuCollection.prototype.positions;
GpuCollection.prototype.relativePoint = GpuCollection.prototype.relativePosition;
GpuCollection.prototype.renderedPoint = GpuCollection.prototype.renderedPosition;
GpuCollection.prototype.renderedBoundingbox = GpuCollection.prototype.renderedBoundingBox;
GpuCollection.prototype.intersect = GpuCollection.prototype.intersection;
GpuCollection.prototype.and = GpuCollection.prototype.intersection;
GpuCollection.prototype.symdiff = GpuCollection.prototype.symmetricDifference;
GpuCollection.prototype.xor = GpuCollection.prototype.symmetricDifference;
GpuCollection.prototype.deselect = GpuCollection.prototype.unselect;
GpuCollection.prototype.openNeighborhood = GpuCollection.prototype.neighborhood;
GpuCollection.prototype.componentsOf = GpuCollection.prototype.components;
GpuCollection.prototype.addListener = GpuCollection.prototype.on;
GpuCollection.prototype.removeListener = GpuCollection.prototype.off;
GpuCollection.prototype.trigger = GpuCollection.prototype.emit;
GpuCollection.prototype.once = GpuCollection.prototype.one;
GpuCollection.prototype.listen = GpuCollection.prototype.on;
GpuCollection.prototype.bind = GpuCollection.prototype.on;
GpuCollection.prototype.unlisten = GpuCollection.prototype.off;
GpuCollection.prototype.unbind = GpuCollection.prototype.off;
GpuCollection.prototype.pon = GpuCollection.prototype.promiseOn;
GpuCollection.prototype.attr = GpuCollection.prototype.data;
GpuCollection.prototype.removeAttr = GpuCollection.prototype.removeData;
