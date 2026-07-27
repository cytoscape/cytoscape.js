import {
  FLAG_ACTIVE, FLAG_GRABBABLE, FLAG_GRABBED, FLAG_LOCKED, FLAG_PANNABLE, FLAG_SELECTABLE,
  FLAG_SELECTED, FLAG_VISIBLE
} from './contract.mjs';
import type { GroupName, Ref } from './contract.mjs';
import { compileQuery, planMatchesRef } from './matcher.mjs';
import type { GpuQuery } from './matcher.mjs';
import { hasListeners, refQualifier } from './events.mjs';
import { normalizeProp as normalizeCss } from './style.mjs';
import { Animation } from './animation.mjs';
import type { AnimateOptions, AnimationHandle } from './animation.mjs';
import type { Position } from '../types.mjs';
import type { GpuLayoutBaseOptions, GpuLayoutOptions } from './gpu-types.mjs';
import {
  search as searchImpl, dijkstra as dijkstraImpl, aStar as aStarImpl,
  bellmanFord as bellmanFordImpl, floydWarshall as floydWarshallImpl, kruskal as kruskalImpl,
  tarjanStronglyConnected as tarjanImpl, hopcroftTarjanBiconnected as hopcroftTarjanImpl,
  hierholzer as hierholzerImpl, kargerStein as kargerSteinImpl,
  pageRank as pageRankImpl, degreeCentrality as degreeCentralityImpl,
  degreeCentralityNormalized as degreeCentralityNormalizedImpl,
  closenessCentrality as closenessCentralityImpl,
  closenessCentralityNormalized as closenessCentralityNormalizedImpl,
  betweennessCentrality as betweennessCentralityImpl,
  kMeans as kMeansImpl, kMedoids as kMedoidsImpl, fuzzyCMeans as fuzzyCMeansImpl,
  hierarchicalClustering as hierarchicalClusteringImpl,
  markovClustering as markovClusteringImpl, affinityPropagation as affinityPropagationImpl
} from './algorithms/index.mjs';
import type {
  SearchArgs, SearchResult, DijkstraArgs, DijkstraResult, AStarOptions, AStarResult,
  BellmanFordOptions, BellmanFordResult, FloydWarshallOptions, FloydWarshallResult, WeightFn,
  TarjanStronglyConnectedResult, HopcroftTarjanBiconnectedResult, HierholzerArgs,
  HierholzerResult, KargerSteinResult, PageRankOptions, PageRankResult,
  DegreeCentralityOptions, DegreeCentralityResult, DegreeCentralityNormalizedResult,
  ClosenessCentralityOptions, ClosenessCentralityNormalizedResult,
  BetweennessCentralityOptions, BetweennessCentralityResult,
  KClusteringOptions, FuzzyCMeansResult, HierarchicalClusteringOptions,
  MarkovClusteringOptions, AffinityPropagationOptions
} from './algorithms/index.mjs';
import type { GpuCore } from './core.mjs';
import type { EventHandler } from '../emitter.mjs';
import type Event from '../event.mjs';

export type EleFilterFn = ( ele: GpuCollection, i: number, eles: GpuCollection ) => boolean;
export type ElePositionFn = ( ele: GpuCollection, i: number ) => Position | false | undefined;

/** A subset criterion: a structured query or a per-element predicate. */
type FilterLike = GpuQuery | EleFilterFn;

// Pack a ref into a single safe integer (group in bit 52, slot in bits 24..51,
// gen in bits 0..23) for set membership. Avoids the per-element string
// allocation of refKey() in the hot dedupe and set-operation paths, while still
// keying on the full {group, slot, gen} identity. Safe for slot < 2^28 and
// gen < 2^24 — far beyond any practical graph.
const packRef = ( r: Ref ): number =>
  ( r.group === 'nodes' ? 0 : 0x10000000000000 ) + r.slot * 0x1000000 + r.gen;

/** Model-px style props that renderedStyle() scales by the zoom. */
const RENDERED_LENGTH_PROPS: ReadonlySet<string> = new Set( [ 'width', 'height', 'border-width', 'font-size' ] );

const refSet = ( refs: Ref[] ): Set<number> => {
  const set = new Set<number>();

  for( let i = 0; i < refs.length; i++ ){ set.add( packRef( refs[ i ] ) ); }

  return set;
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
  /** lazily-built packed-key membership set; safe to cache since _refs is immutable */
  _keys?: Set<number>;

  constructor( cy: GpuCore, refs: Ref[], opts: { singleton?: boolean; unique?: boolean; live?: boolean } = {} ){
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

      if( opts.live ){
        // trusted further: the refs are current (store-scan / id-index
        // output), so intern with the pool and gen lookups hoisted out of
        // the per-element path instead of going through _eleFromRef
        const nodePool = cy._pool.nodes;
        const edgePool = cy._pool.edges;

        for( let i = 0; i < refs.length; i++ ){
          const ref = refs[ i ];
          const pool = ref.group === 'nodes' ? nodePool : edgePool;
          let ele = pool[ ref.slot ];

          if( ele == null || ele._refs[0].gen !== ref.gen ){
            ele = new GpuCollection( cy, [ ref ], { singleton: true } );
            pool[ ref.slot ] = ele;
          }

          this[ i ] = ele;
        }
      } else {
        for( let i = 0; i < refs.length; i++ ){
          this[ i ] = cy._eleFromRef( refs[ i ] );
        }
      }
    } else {
      // dedupe while preserving order; intern per-element handles
      const seen = new Set<number>();

      deduped = [];

      let i = 0;

      for( const ref of refs ){
        const key = packRef( ref );

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

  /**
   * Like `_spawn`, but for refs already known to be distinct (a subset of this
   * collection's deduped refs). Skips the dedupe Set build.
   */
  _spawnUnique( refs: Ref[] ): GpuCollection {
    return new GpuCollection( this._cy, refs, { unique: true } );
  }

  /**
   * Like `_spawnUnique`, but for refs also known to be current (freshly
   * read off the store, e.g. traversal output): interning skips the
   * per-element gen re-validation of `_eleFromRef`.
   */
  _spawnLive( refs: Ref[] ): GpuCollection {
    return new GpuCollection( this._cy, refs, { unique: true, live: true } );
  }

  /**
   * A cached Set of this collection's packed element keys, for set membership.
   * Sound to cache: `_refs` is fixed at construction, and a packed key encodes
   * the ref's own {group, slot, gen}, so it stays valid even as the store
   * mutates. Built lazily — collections that never do a set op pay nothing.
   */
  _keySet(): Set<number> {
    return ( this._keys ??= refSet( this._refs ) );
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

    const key = packRef( ref );

    for( let i = 0; i < this._refs.length; i++ ){
      if( packRef( this._refs[ i ] ) === key ){ return i; }
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
    const n = this.length;

    // exit early like v3 when the callback returns false; a plain call when
    // there is no thisArg, like v3 — rebinding the receiver per element via
    // fn.call() costs ~2x on large collections
    if( thisArg == null ){
      for( let i = 0; i < n; i++ ){ if( fn( this[ i ], i, this ) === false ){ break; } }
    } else {
      for( let i = 0; i < n; i++ ){ if( fn.call( thisArg, this[ i ], i, this ) === false ){ break; } }
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

    return this._spawnUnique( this._refs.slice( start, end ) );
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
    const n = this.length;
    const array: T[] = new Array( n );

    if( thisArg == null ){
      for( let i = 0; i < n; i++ ){ array[ i ] = fn( this[ i ], i, this ); }
    } else {
      for( let i = 0; i < n; i++ ){ array[ i ] = fn.call( thisArg, this[ i ], i, this ); }
    }

    return array;
  }

  some( fn: EleFilterFn, thisArg?: unknown ): boolean {
    for( let i = 0; i < this.length; i++ ){
      const ret = thisArg == null ? fn( this[ i ], i, this ) : fn.call( thisArg, this[ i ], i, this );

      if( ret ){ return true; }
    }

    return false;
  }

  every( fn: EleFilterFn, thisArg?: unknown ): boolean {
    for( let i = 0; i < this.length; i++ ){
      const ret = thisArg == null ? fn( this[ i ], i, this ) : fn.call( thisArg, this[ i ], i, this );

      if( !ret ){ return false; }
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
      locked: this.locked(),
      // the raw grabbable field, not the pannable-overridden getter (as in v3 json)
      grabbable: this._hasBit( FLAG_GRABBABLE ),
      pannable: this.pannable(),
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
    if( this === other ){ return true; }
    if( this.length !== other.length ){ return false; }

    const keys = this._keySet();
    const or = other._refs;

    for( let i = 0; i < or.length; i++ ){
      if( !keys.has( packRef( or[ i ] ) ) ){ return false; }
    }

    return true;
  }

  anySame( other: GpuCollection ): boolean {
    if( this === other ){ return this.length > 0; }

    const keys = this._keySet();
    const or = other._refs;

    for( let i = 0; i < or.length; i++ ){
      if( keys.has( packRef( or[ i ] ) ) ){ return true; }
    }

    return false;
  }

  contains( other: GpuCollection ): boolean {
    if( this === other ){ return true; }
    if( other.length > this.length ){ return false; }

    const keys = this._keySet();
    const or = other._refs;

    for( let i = 0; i < or.length; i++ ){
      if( !keys.has( packRef( or[ i ] ) ) ){ return false; }
    }

    return true;
  }

  declare has: this['contains'];
  declare equal: this['same'];
  declare equals: this['same'];

  /** Whether every element of `other` is in this collection's neighborhood. */
  allAreNeighbors( other: GpuCollection ): boolean {
    const nhood = this.neighborhood();

    return other.every( ele => nhood.hasElementWithId( ele.id() as string ) );
  }

  declare allAreNeighbours: this['allAreNeighbors'];

  allAre( criterion: FilterLike ): boolean {
    if( typeof criterion === 'function' ){
      return this.every( criterion );
    }

    const plan = compileQuery( criterion );

    return this._refs.every( ref => planMatchesRef( this._store, ref, plan ) );
  }

  is( criterion: FilterLike ): boolean {
    if( typeof criterion === 'function' ){
      return this.some( criterion );
    }

    const plan = compileQuery( criterion );

    return this._refs.some( ref => planMatchesRef( this._store, ref, plan ) );
  }

  // -- building and filtering --

  union( other: GpuCollection ): GpuCollection {
    return this._spawn( [ ...this._refs, ...other._refs ] );
  }

  declare u: this['union'];
  declare or: this['union'];
  declare add: this['union'];
  declare merge: this['union'];

  difference( other: GpuCollection ): GpuCollection {
    const keys = other._keySet();

    return this._spawnUnique( this._refs.filter( ref => !keys.has( packRef( ref ) ) ) );
  }

  declare not: this['difference'];
  declare subtract: this['difference'];
  declare unmerge: this['difference'];
  declare relativeComplement: this['difference'];

  intersection( other: GpuCollection ): GpuCollection {
    const keys = other._keySet();

    return this._spawnUnique( this._refs.filter( ref => keys.has( packRef( ref ) ) ) );
  }

  declare intersect: this['intersection'];
  declare and: this['intersection'];

  symmetricDifference( other: GpuCollection ): GpuCollection {
    const otherEles = other;
    const mine = this._keySet();
    const theirs = otherEles._keySet();

    // the two parts are disjoint by construction, so the result is unique
    return this._spawnUnique( [
      ...this._refs.filter( ref => !theirs.has( packRef( ref ) ) ),
      ...otherEles._refs.filter( ref => !mine.has( packRef( ref ) ) )
    ] );
  }

  declare symdiff: this['symmetricDifference'];
  declare xor: this['symmetricDifference'];

  filter( criterion: FilterLike, thisArg?: unknown ): GpuCollection {
    // the result is a subset of this collection's (already unique) refs
    if( typeof criterion === 'function' ){
      const refs: Ref[] = [];
      const n = this.length;

      for( let i = 0; i < n; i++ ){
        const include = thisArg == null ? criterion( this[ i ], i, this ) : criterion.call( thisArg, this[ i ], i, this );

        if( include ){
          refs.push( this._refs[ i ] );
        }
      }

      return this._spawnUnique( refs );
    }

    // structured query: test each ref against its group's (mask, want)
    // directly on the flags column — no per-ref handles or closures
    const store = this._store;
    const plan = compileQuery( criterion );
    const nodeTest = plan.nodes;
    const edgeTest = plan.edges;
    const nodeGen = store.nodes.gen;
    const edgeGen = store.edges.gen;
    const nodeFlags = store.column( 'node.flags' ) as Uint32Array;
    const edgeFlags = store.column( 'edge.flags' ) as Uint32Array;
    const refs: Ref[] = [];

    for( let i = 0; i < this._refs.length; i++ ){
      const ref = this._refs[ i ];
      const isNode = ref.group === 'nodes';
      const test = isNode ? nodeTest : edgeTest;

      if( test == null ){ continue; }

      if( ( isNode ? nodeGen : edgeGen )[ ref.slot ] !== ref.gen ){ continue; } // stale

      const flags = ( isNode ? nodeFlags : edgeFlags )[ ref.slot ];

      if( ( flags & test.mask ) === test.want ){ refs.push( ref ); }
    }

    return this._spawnUnique( refs );
  }

  nodes( criterion?: FilterLike ): GpuCollection {
    const nodes = this._spawnUnique( this._refs.filter( ref => ref.group === 'nodes' ) );

    return criterion == null ? nodes : nodes.filter( criterion );
  }

  edges( criterion?: FilterLike ): GpuCollection {
    const edges = this._spawnUnique( this._refs.filter( ref => ref.group === 'edges' ) );

    return criterion == null ? edges : edges.filter( criterion );
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
  diff( other: GpuCollection ): {
    left: GpuCollection; right: GpuCollection; both: GpuCollection;
  } {
    const otherColl = other;
    const mine = this._keySet();
    const theirs = otherColl._keySet();

    return {
      left: this._spawnUnique( this._refs.filter( ref => !theirs.has( packRef( ref ) ) ) ),
      right: this._spawnUnique( otherColl._refs.filter( ref => !mine.has( packRef( ref ) ) ) ),
      both: this._spawnUnique( this._refs.filter( ref => theirs.has( packRef( ref ) ) ) )
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
      const val = thisArg == null ? valFn( this[ i ], i, this ) : valFn.call( thisArg, this[ i ], i, this );

      if( sign * val > sign * best ){
        best = val;
        bestEle = this[ i ];
      }
    }

    return { value: best, ele: bestEle };
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
      const ref = this._refs[ 0 ];
      const store = this._store;

      if( ref == null || ref.group !== 'nodes' || !store.isCurrent( ref ) ){ return undefined; }

      // one column fetch instead of getX()+getY() (two Map.gets)
      const xy = store.nodes.column( 'node.position' ) as Float32Array;
      const slot = ref.slot;
      const pos = { x: xy[ slot * 2 ], y: xy[ slot * 2 + 1 ] };

      return typeof dim === 'string' ? pos[ dim as 'x' | 'y' ] : pos;
    }

    // setter forms
    if( typeof dim === 'string' ){
      return this._positions( dim === 'x' ? { x: value } : { y: value }, silent );
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

  // -- animation --

  /**
   * Animate these elements' style/position to explicit targets over
   * `duration` ms, easing the normalized time.  Queues per element (a
   * second animate() on the same element runs after the first).  Returns
   * the collection; use `animation()` for a handle with `.promise()`.
   * Animatable: position, opacity, background-color, border-color,
   * line-color, border-width.  Colours interpolate in OKLab.
   */
  animate( opts: AnimateOptions ): this {
    this.animation( opts ).play();

    return this;
  }

  /** Build an animation for these elements without starting it (call `.play()`). */
  animation( opts: AnimateOptions ): AnimationHandle {
    const cy = this._cy;
    const ani = new Animation( cy._store, null, this._liveRefs(), false, opts, cy._styleEngine );

    return {
      play: () => { cy._animations.enqueue( ani ); return ani.promise(); },
      stop: ( jumpToEnd = false ) => ani.stop( jumpToEnd ),
      promise: () => ani.promise(),
      playing: () => ani.running
    };
  }

  /** A no-op tween of `duration` ms — chains a pause into an element's queue. */
  delay( duration: number, complete?: () => void ): this {
    return this.animate( { duration, complete } );
  }

  /** Like delay(), but returns the animation handle instead of chaining. */
  delayAnimation( duration: number, complete?: () => void ): AnimationHandle {
    return this.animation( { duration, complete } );
  }

  /** True when any of these elements has a running or queued animation. */
  animated(): boolean {
    for( const ref of this._refs ){
      if( this._cy._animations.isAnimating( ref ) ){ return true; }
    }

    return false;
  }

  /** Stop (and optionally clear the queue / jump to end) animations on these elements. */
  stop( clearQueue: boolean = true, jumpToEnd: boolean = false ): this {
    this._cy._animations.stop( this._liveRefs(), clearQueue, jumpToEnd );

    return this;
  }

  private _positions( pos: Partial<Position> | ElePositionFn, silent: boolean ): this {
    const store = this._store;
    const wantEmit = !silent && hasListeners( this._cy._emitter, 'position' );

    // constant (possibly partial) object: direct columnar write — no
    // per-element handles, callbacks, or Position allocations
    if( typeof pos !== 'function' ){
      const x = pos.x ?? null;
      const y = pos.y ?? null;

      if( x == null && y == null ){ return this; }

      const slots: number[] = [];
      const emitIdx: number[] | null = wantEmit ? [] : null;

      for( let i = 0; i < this.length; i++ ){
        const ref = this._refs[ i ];

        if( ref.group !== 'nodes' || !store.isCurrent( ref ) ){ continue; }

        slots.push( ref.slot );

        if( emitIdx != null ){ emitIdx.push( i ); }
      }

      store.setPositionsConst( slots, x, y );

      if( emitIdx != null ){
        for( const i of emitIdx ){
          this._cy._emitOnEle( 'position', this[ i ] );
        }
      }

      return this;
    }

    const posCol = store.column( 'node.position' ) as Float32Array;
    const slots: number[] = [];
    const xy: number[] = [];
    const emitIdx: number[] | null = wantEmit ? [] : null;

    for( let i = 0; i < this.length; i++ ){
      const ref = this._refs[ i ];

      if( ref.group !== 'nodes' || !store.isCurrent( ref ) ){ continue; }

      const p = pos( this[ i ], i );

      if( p == null || ( p as unknown ) === false ){ continue; }

      // a partial object (e.g. { y: 3 }) leaves the omitted axis unchanged,
      // matching v3's position() merge semantics
      const pp = p as { x?: number; y?: number };
      const px = pp.x ?? posCol[ ref.slot * 2 ];
      const py = pp.y ?? posCol[ ref.slot * 2 + 1 ];

      slots.push( ref.slot );
      xy.push( px, py );

      if( emitIdx != null ){ emitIdx.push( i ); }
    }

    store.setPositions( slots, xy );

    if( emitIdx != null ){
      for( const i of emitIdx ){
        this._cy._emitOnEle( 'position', this[ i ] );
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
    const dx = typeof dim === 'string' ? ( dim === 'x' ? ( value as number ) : 0 ) : ( dim.x || 0 );
    const dy = typeof dim === 'string' ? ( dim === 'y' ? ( value as number ) : 0 ) : ( dim.y || 0 );

    if( dx === 0 && dy === 0 ){ return this; }

    // direct columnar offset — no callbacks or per-element Position objects
    const store = this._store;
    const wantEmit = !silent && hasListeners( this._cy._emitter, 'position' );
    const slots: number[] = [];
    const emitIdx: number[] | null = wantEmit ? [] : null;

    for( let i = 0; i < this.length; i++ ){
      const ref = this._refs[ i ];

      if( ref.group !== 'nodes' || !store.isCurrent( ref ) ){ continue; }

      slots.push( ref.slot );

      if( emitIdx != null ){ emitIdx.push( i ); }
    }

    store.shiftPositions( slots, dx, dy );

    if( emitIdx != null ){
      for( const i of emitIdx ){
        this._cy._emitOnEle( 'position', this[ i ] );
      }
    }

    return this;
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
    const wantEmit = hasListeners( cy._emitter, 'data' );
    // a data write can only change computed style through a mapper (or a
    // mapped label) on one of the written keys — decided once per group,
    // not per element
    const touched: Record<'nodes' | 'edges', number[] | null> = {
      nodes: cy._stylesDependOnData( 'nodes', keys ) ? [] : null,
      edges: cy._stylesDependOnData( 'edges', keys ) ? [] : null
    };

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

        store.setData( ref.group, ref.slot, k, patch[ k ] );
      }

      touched[ ref.group ]?.push( ref.slot );
    }

    // mapped style refreshes before emits so data listeners observe fresh state
    for( const group of [ 'nodes', 'edges' ] as const ){
      const slots = touched[ group ];

      if( slots != null && slots.length > 0 ){
        cy._refreshMappedStyles( group, slots, keys );
      }
    }

    if( wantEmit ){
      for( let i = 0; i < this.length; i++ ){
        if( store.isCurrent( this._refs[ i ] ) ){
          cy._emitOnEle( 'data', this[ i ] );
        }
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

  // -- style (read-only) --

  /**
   * Resolved style read off the stored channels: `style()` returns all of
   * the first element's group props, `style(name)` one value (numbers for
   * numeric props, `rgb()`/`rgba()` strings for colors, keywords
   * otherwise).  Setter forms throw — v4 has no per-element bypass; use
   * the fn form of the stylesheet.
   */
  style( name?: string | Record<string, unknown>, value?: unknown ): unknown {
    if( value !== undefined || ( name != null && typeof name !== 'string' ) ){
      throw new Error(
        'Per-element style bypass is not supported in the GPU prototype; ' +
        'use the function form of the stylesheet for per-element styling'
      );
    }

    const ref = this._first();

    if( ref == null || !this._store.isCurrent( ref ) ){ return undefined; }

    const engine = this._cy.style();

    return name == null ? engine.readProps( ref ) : engine.readProp( ref, name );
  }

  declare css: this['style'];

  /**
   * Like `style()`, but with length props (width, height, border-width,
   * font-size) scaled into rendered (on-screen) px by the zoom.
   */
  renderedStyle( name?: string ): unknown {
    const value = this.style( name );

    if( value === undefined ){ return undefined; }

    const zoom = this._cy.zoom() as number;

    if( name != null ){
      return RENDERED_LENGTH_PROPS.has( normalizeCss( name ) ) ? ( value as number ) * zoom : value;
    }

    const props = value as Record<string, string | number>;

    for( const prop of RENDERED_LENGTH_PROPS ){
      if( typeof props[ prop ] === 'number' ){ props[ prop ] = ( props[ prop ] as number ) * zoom; }
    }

    return props;
  }

  declare renderedCss: this['renderedStyle'];

  /** The numeric value of a numeric style prop (throws for colors/keywords). */
  numericStyle( name: string ): number | undefined {
    const value = this.style( name );

    if( value === undefined ){ return undefined; }

    if( typeof value !== 'number' ){
      throw new Error( `The style property '${name}' is not numeric` );
    }

    return value;
  }

  /** Without compound nodes, effective opacity is the element's own opacity. */
  effectiveOpacity(): number | undefined {
    return this.numericStyle( 'opacity' );
  }

  transparent(): boolean {
    return this.effectiveOpacity() === 0;
  }

  /** Hidden elements are culled from drawing and picking, so only visible ones take up space. */
  takesUpSpace(): boolean {
    return this.visible();
  }

  /** Whether the element can be interacted with (visible; v4 has no 'events' prop). */
  interactive(): boolean {
    return this.visible();
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

  /** Pannable elements are not draggable, so pannable overrides grabbable (as in v3). */
  grabbable(): boolean {
    return this._hasBit( FLAG_GRABBABLE ) && !this._hasBit( FLAG_PANNABLE );
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

  // -- active / pannable --

  /** Whether the first element is in the transient pressed ("active") state. */
  active(): boolean {
    return this._hasBit( FLAG_ACTIVE );
  }

  /** True when the first element is live and not active (v3 `inactive()`). */
  inactive(): boolean {
    const ref = this._first();

    return ref != null && this._store.isCurrent( ref )
      && !this._store.hasFlag( ref.group, ref.slot, FLAG_ACTIVE );
  }

  activate(): this {
    return this._setBit( FLAG_ACTIVE, true );
  }

  unactivate(): this {
    return this._setBit( FLAG_ACTIVE, false );
  }

  /** Whether dragging the first element pans the graph instead of grabbing it. */
  pannable(): boolean {
    return this._hasBit( FLAG_PANNABLE );
  }

  panify(): this {
    return this._setBit( FLAG_PANNABLE, true );
  }

  unpanify(): this {
    return this._setBit( FLAG_PANNABLE, false );
  }

  private _hasBit( bit: number ): boolean {
    const ref = this._first();

    return ref != null && this._store.isCurrent( ref ) && this._store.hasFlag( ref.group, ref.slot, bit );
  }

  private _setBit( bit: number, on: boolean ): this {
    this._store.flagRefs( this._refs, bit, on );

    return this;
  }

  private _setSelected( selected: boolean ): this {
    const cy = this._cy;
    const changedIdx: number[] = [];

    this._store.flagRefs( this._refs, FLAG_SELECTED, selected, FLAG_SELECTABLE, changedIdx );

    if( changedIdx.length === 0 ){ return this; }

    // a selection change never restyles: the v4 sheet has no selection
    // terms (the accent ring is shader-drawn), and fn styles by policy
    // re-run only on an explicit style set, not on state changes

    const type = selected ? 'select' : 'unselect';

    if( cy._hasListeners( type ) ){
      for( const i of changedIdx ){
        cy._emitOnEle( type, this[ i ] );
      }
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
    const seen = new Set<number>();

    const addEdge = ( ele: GpuCollection ): void => {
      const key = packRef( ele._refs[0] );

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
    const store = this._store;
    const endpoints = store.column( 'edge.endpoints' ) as Uint32Array;
    const refs: Ref[] = [];
    const seen = new Set<number>();

    for( let i = 0; i < this._refs.length; i++ ){
      const ref = this._refs[ i ];

      if( ref.group !== 'edges' || !store.isCurrent( ref ) ){ continue; }

      const nodeSlot = endpoints[ ref.slot * 2 + which ];

      if( !seen.has( nodeSlot ) ){
        seen.add( nodeSlot );
        refs.push( store.ref( 'nodes', nodeSlot ) );
      }
    }

    return this._spawnLive( refs );
  }

  connectedEdges( criterion?: FilterLike ): GpuCollection {
    const store = this._store;
    const adj = store.adj;
    const refs: Ref[] = [];
    const seen = new Set<number>(); // edge slots: dedupes loops and shared edges alike

    for( let i = 0; i < this._refs.length; i++ ){
      const ref = this._refs[ i ];

      if( ref.group !== 'nodes' || !store.isCurrent( ref ) ){ continue; }

      const out = adj.outEdges( ref.slot );
      const inn = adj.inEdges( ref.slot );

      for( let j = 0; j < out.length; j++ ){
        const edgeSlot = out[ j ];

        if( !seen.has( edgeSlot ) ){
          seen.add( edgeSlot );
          refs.push( store.ref( 'edges', edgeSlot ) );
        }
      }

      for( let j = 0; j < inn.length; j++ ){
        const edgeSlot = inn[ j ];

        if( !seen.has( edgeSlot ) ){
          seen.add( edgeSlot );
          refs.push( store.ref( 'edges', edgeSlot ) );
        }
      }
    }

    const eles = this._spawnLive( refs );

    return criterion == null ? eles : eles.filter( criterion );
  }

  connectedNodes( criterion?: FilterLike ): GpuCollection {
    const store = this._store;
    const endpoints = store.column( 'edge.endpoints' ) as Uint32Array;
    const refs: Ref[] = [];
    const seen = new Set<number>();

    for( let i = 0; i < this._refs.length; i++ ){
      const ref = this._refs[ i ];

      if( ref.group !== 'edges' || !store.isCurrent( ref ) ){ continue; }

      const source = endpoints[ ref.slot * 2 ];
      const target = endpoints[ ref.slot * 2 + 1 ];

      if( !seen.has( source ) ){
        seen.add( source );
        refs.push( store.ref( 'nodes', source ) );
      }

      if( !seen.has( target ) ){
        seen.add( target );
        refs.push( store.ref( 'nodes', target ) );
      }
    }

    const eles = this._spawnLive( refs );

    return criterion == null ? eles : eles.filter( criterion );
  }

  outgoers( criterion?: FilterLike ): GpuCollection {
    return this._goers( 'out', criterion );
  }

  incomers( criterion?: FilterLike ): GpuCollection {
    return this._goers( 'in', criterion );
  }

  private _goers( direction: 'out' | 'in', criterion?: FilterLike ): GpuCollection {
    const store = this._store;
    const adj = store.adj;
    const endpoints = store.column( 'edge.endpoints' ) as Uint32Array;
    const refs: Ref[] = [];
    // packed (group, slot) keys: node = slot * 2, edge = slot * 2 + 1
    const seen = new Set<number>();

    for( let i = 0; i < this._refs.length; i++ ){
      const ref = this._refs[ i ];

      if( ref.group !== 'nodes' || !store.isCurrent( ref ) ){ continue; }

      const edgeSlots = direction === 'out' ? adj.outEdges( ref.slot ) : adj.inEdges( ref.slot );

      for( let j = 0; j < edgeSlots.length; j++ ){
        const edgeSlot = edgeSlots[ j ];
        const otherSlot = direction === 'out' ? endpoints[ edgeSlot * 2 + 1 ] : endpoints[ edgeSlot * 2 ];

        if( !seen.has( edgeSlot * 2 + 1 ) ){
          seen.add( edgeSlot * 2 + 1 );
          refs.push( store.ref( 'edges', edgeSlot ) );
        }

        if( !seen.has( otherSlot * 2 ) ){
          seen.add( otherSlot * 2 );
          refs.push( store.ref( 'nodes', otherSlot ) );
        }
      }
    }

    const eles = this._spawnLive( refs );

    return criterion == null ? eles : eles.filter( criterion );
  }

  neighborhood( criterion?: FilterLike ): GpuCollection {
    const store = this._store;
    const adj = store.adj;
    const endpoints = store.column( 'edge.endpoints' ) as Uint32Array;
    const refs: Ref[] = [];
    // packed (group, slot) keys; the collection's own live elements are
    // pre-seeded so the open neighborhood excludes them during the walk
    const seen = new Set<number>();

    for( let i = 0; i < this._refs.length; i++ ){
      const ref = this._refs[ i ];

      if( store.isCurrent( ref ) ){
        seen.add( ref.group === 'nodes' ? ref.slot * 2 : ref.slot * 2 + 1 );
      }
    }

    for( let i = 0; i < this._refs.length; i++ ){
      const ref = this._refs[ i ];

      if( ref.group !== 'nodes' || !store.isCurrent( ref ) ){ continue; }

      const out = adj.outEdges( ref.slot );
      const inn = adj.inEdges( ref.slot );

      for( let pass = 0; pass < 2; pass++ ){
        const edgeSlots = pass === 0 ? out : inn;

        for( let j = 0; j < edgeSlots.length; j++ ){
          const edgeSlot = edgeSlots[ j ];
          const source = endpoints[ edgeSlot * 2 ];
          const target = endpoints[ edgeSlot * 2 + 1 ];
          const otherSlot = source === ref.slot ? target : source;

          if( !seen.has( edgeSlot * 2 + 1 ) ){
            seen.add( edgeSlot * 2 + 1 );
            refs.push( store.ref( 'edges', edgeSlot ) );
          }

          if( !seen.has( otherSlot * 2 ) ){
            seen.add( otherSlot * 2 );
            refs.push( store.ref( 'nodes', otherSlot ) );
          }
        }
      }
    }

    const eles = this._spawnLive( refs );

    return criterion == null ? eles : eles.filter( criterion );
  }

  declare openNeighborhood: this['neighborhood'];

  closedNeighborhood( criterion?: FilterLike ): GpuCollection {
    const eles = this.neighborhood().union( this.nodes() );

    return criterion == null ? eles : eles.filter( criterion );
  }

  // -- DAG traversal --

  /** Collection nodes with no non-loop incoming edge (whole-graph incidence, as in v3). */
  roots( criterion?: FilterLike ): GpuCollection {
    return this._dagExtremity( 'in', criterion );
  }

  /** Collection nodes with no non-loop outgoing edge. */
  leaves( criterion?: FilterLike ): GpuCollection {
    return this._dagExtremity( 'out', criterion );
  }

  private _dagExtremity( direction: 'in' | 'out', criterion?: FilterLike ): GpuCollection {
    const store = this._store;
    const adj = store.adj;
    const endpoints = store.column( 'edge.endpoints' ) as Uint32Array;
    const refs: Ref[] = [];

    for( let i = 0; i < this._refs.length; i++ ){
      const ref = this._refs[ i ];

      if( ref.group !== 'nodes' || !store.isCurrent( ref ) ){ continue; }

      const edges = direction === 'in' ? adj.inEdges( ref.slot ) : adj.outEdges( ref.slot );
      let disqualified = false;

      for( let j = 0; j < edges.length; j++ ){
        const edgeSlot = edges[ j ];

        // a loop (source === target) never disqualifies
        if( endpoints[ edgeSlot * 2 ] !== endpoints[ edgeSlot * 2 + 1 ] ){ disqualified = true; break; }
      }

      if( !disqualified ){ refs.push( ref ); }
    }

    const eles = this._spawnLive( refs );

    return criterion == null ? eles : eles.filter( criterion );
  }

  successors( criterion?: FilterLike ): GpuCollection {
    return this._dagAllHops( 'out', criterion );
  }

  predecessors( criterion?: FilterLike ): GpuCollection {
    return this._dagAllHops( 'in', criterion );
  }

  private _dagAllHops( direction: 'out' | 'in', criterion?: FilterLike ): GpuCollection {
    const store = this._store;
    const adj = store.adj;
    const endpoints = store.column( 'edge.endpoints' ) as Uint32Array;
    const acc: Ref[] = [];
    // packed (group, slot) keys: node = slot * 2, edge = slot * 2 + 1;
    // a raw slot BFS — no per-hop collection spawns or handle interning
    const seen = new Set<number>();
    let frontier: number[] = [];

    for( let i = 0; i < this._refs.length; i++ ){
      const ref = this._refs[ i ];

      if( ref.group === 'nodes' && store.isCurrent( ref ) ){ frontier.push( ref.slot ); }
    }

    while( frontier.length > 0 ){
      const next: number[] = [];

      for( let i = 0; i < frontier.length; i++ ){
        const nodeSlot = frontier[ i ];
        const edgeSlots = direction === 'out' ? adj.outEdges( nodeSlot ) : adj.inEdges( nodeSlot );

        for( let j = 0; j < edgeSlots.length; j++ ){
          const edgeSlot = edgeSlots[ j ];
          const otherSlot = direction === 'out' ? endpoints[ edgeSlot * 2 + 1 ] : endpoints[ edgeSlot * 2 ];

          if( !seen.has( edgeSlot * 2 + 1 ) ){
            seen.add( edgeSlot * 2 + 1 );
            acc.push( store.ref( 'edges', edgeSlot ) );
          }

          if( !seen.has( otherSlot * 2 ) ){
            seen.add( otherSlot * 2 );
            acc.push( store.ref( 'nodes', otherSlot ) );
            next.push( otherSlot );
          }
        }
      }

      frontier = next;
    }

    const out = this._spawnLive( acc );

    return criterion == null ? out : out.filter( criterion );
  }

  // -- edge relations --

  edgesWith( others: GpuCollection ): GpuCollection {
    return this._edgesWith( others, false );
  }

  edgesTo( others: GpuCollection ): GpuCollection {
    return this._edgesWith( others, true );
  }

  private _edgesWith( others: GpuCollection, thisIsSrc: boolean ): GpuCollection {
    const store = this._store;
    const endpoints = store.column( 'edge.endpoints' ) as Uint32Array;
    const otherColl = others;

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

  parallelEdges( criterion?: FilterLike ): GpuCollection {
    return this._parallelEdges( false, criterion );
  }

  codirectedEdges( criterion?: FilterLike ): GpuCollection {
    return this._parallelEdges( true, criterion );
  }

  private _parallelEdges( codirectedOnly: boolean, criterion?: FilterLike ): GpuCollection {
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

    return criterion == null ? eles : eles.filter( criterion );
  }

  // -- connected components --

  /**
   * Connected components within this collection (undirected), each as a
   * collection of the reached nodes plus the collection's edges internal
   * to that component.  `root` restricts the seed nodes.
   */
  components( root?: GpuCollection | null ): GpuCollection[] {
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
      const rootColl = root;
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

  // -- layouts --

  /** Node dimensions for layout spacing, as v3's layoutDimensions. */
  layoutDimensions( options: { nodeDimensionsIncludeLabels?: boolean } = {} ): { w: number; h: number } {
    let dims: { w: number; h: number };

    if( !this.takesUpSpace() ){
      dims = { w: 0, h: 0 };
    } else if( options.nodeDimensionsIncludeLabels ){
      const bb = this.boundingBox();

      dims = { w: bb.w, h: bb.h };
    } else {
      dims = { w: this.outerWidth() ?? 0, h: this.outerHeight() ?? 0 };
    }

    // sanitise for layouts (avoid division by zero)
    if( dims.w === 0 || dims.h === 0 ){
      dims.w = dims.h = 1;
    }

    return dims;
  }

  /**
   * Apply a layout's position function to this collection's nodes with the
   * standard layout options (spacingFactor, transform, fit/zoom/pan, animate)
   * and the layoutstart/layoutready/layoutstop event flow — v3's helper.
   * With `animate: true` the viewport applies at layoutstop (an *animated*
   * fit is the viewport-animation-targets follow-up).
   */
  layoutPositions(
    layout: object,
    options: GpuLayoutBaseOptions,
    fn: ( node: GpuCollection, i: number ) => Position
  ): this {
    const cy = this._cy;
    const nodes = this.nodes();
    const eles = ( options.eles as GpuCollection | undefined ) ?? this;

    cy.emit( { type: 'layoutstart', layout } );

    // memoize by handle: handles are interned singletons
    const rawMemo = new Map<GpuCollection, Position>();

    const rawPos = ( node: GpuCollection, i: number ): Position => {
      let p = rawMemo.get( node );

      if( p == null ){
        p = fn( node, i );
        rawMemo.set( node, p );
      }

      return p;
    };

    const factor = options.spacingFactor;
    const useSpacing = factor != null && factor !== 1 && nodes.length > 0;
    let center: Position | null = null;

    if( useSpacing ){
      let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;

      for( let i = 0; i < nodes.length; i++ ){
        const p = rawPos( nodes[ i ], i );

        x1 = Math.min( x1, p.x ); x2 = Math.max( x2, p.x );
        y1 = Math.min( y1, p.y ); y2 = Math.max( y2, p.y );
      }

      center = { x: ( x1 + x2 ) / 2, y: ( y1 + y2 ) / 2 };
    }

    const finalMemo = new Map<GpuCollection, Position>();

    const getFinalPos = ( node: GpuCollection, i: number ): Position => {
      let p = finalMemo.get( node );

      if( p != null ){ return p; }

      p = rawPos( node, i );

      if( useSpacing && center != null ){
        const spacing = Math.abs( factor as number );

        p = {
          x: center.x + ( p.x - center.x ) * spacing,
          y: center.y + ( p.y - center.y ) * spacing
        };
      }

      if( options.transform != null ){
        p = options.transform( node, p );
      }

      finalMemo.set( node, p );

      return p;
    };

    const applyViewport = (): void => {
      if( options.fit ){
        cy.fit( eles, options.padding ?? 30 );
      } else {
        if( options.zoom != null ){ cy.zoom( options.zoom ); }
        if( options.pan != null ){ cy.pan( options.pan ); }
      }
    };

    if( options.animate ){
      const anis: AnimationHandle[] = [];

      for( let i = 0; i < nodes.length; i++ ){
        const node = nodes[ i ];
        const newPos = getFinalPos( node, i );
        const animateNode = options.animateFilter == null || options.animateFilter( node, i );

        if( animateNode ){
          anis.push( node.animation( {
            position: newPos,
            duration: options.animationDuration ?? 500,
            easing: options.animationEasing
          } ) );
        } else {
          node.position( newPos );
        }
      }

      for( const ani of anis ){ ani.play(); }

      options.ready?.();
      cy.emit( { type: 'layoutready', layout } );

      Promise.all( anis.map( ani => ani.promise() ) ).then( () => {
        applyViewport();
        options.stop?.();
        cy.emit( { type: 'layoutstop', layout } );
      } );
    } else {
      nodes.positions( getFinalPos );
      applyViewport();

      options.ready?.();
      cy.emit( { type: 'layoutready', layout } );

      options.stop?.();
      cy.emit( { type: 'layoutstop', layout } );
    }

    return this;
  }

  /** A layout scoped to this collection (`options.eles` is set to it). */
  layout( options: GpuLayoutOptions ): ReturnType<GpuCore['layout']> {
    return this._cy.layout( { ...options, eles: this } );
  }

  declare makeLayout: this['layout'];
  declare createLayout: this['layout'];

  // -- graph algorithms (slot-native implementations in ./algorithms/) --

  breadthFirstSearch( ...args: SearchArgs ): SearchResult {
    return searchImpl( this, true, args );
  }

  depthFirstSearch( ...args: SearchArgs ): SearchResult {
    return searchImpl( this, false, args );
  }

  declare bfs: this['breadthFirstSearch'];
  declare dfs: this['depthFirstSearch'];

  dijkstra( ...args: DijkstraArgs ): DijkstraResult {
    return dijkstraImpl( this, args );
  }

  aStar( options?: AStarOptions ): AStarResult {
    return aStarImpl( this, options );
  }

  bellmanFord( options?: BellmanFordOptions ): BellmanFordResult {
    return bellmanFordImpl( this, options );
  }

  floydWarshall( options?: FloydWarshallOptions ): FloydWarshallResult {
    return floydWarshallImpl( this, options );
  }

  kruskal( weight?: WeightFn ): GpuCollection {
    return kruskalImpl( this, weight );
  }

  tarjanStronglyConnected(): TarjanStronglyConnectedResult {
    return tarjanImpl( this );
  }

  declare tsc: this['tarjanStronglyConnected'];
  declare tscc: this['tarjanStronglyConnected'];
  declare tarjanStronglyConnectedComponents: this['tarjanStronglyConnected'];

  hopcroftTarjanBiconnected(): HopcroftTarjanBiconnectedResult {
    return hopcroftTarjanImpl( this );
  }

  declare htbc: this['hopcroftTarjanBiconnected'];
  declare htb: this['hopcroftTarjanBiconnected'];
  declare hopcroftTarjanBiconnectedComponents: this['hopcroftTarjanBiconnected'];

  hierholzer( ...args: HierholzerArgs ): HierholzerResult {
    return hierholzerImpl( this, args );
  }

  kargerStein(): KargerSteinResult {
    return kargerSteinImpl( this );
  }

  pageRank( options?: PageRankOptions ): PageRankResult {
    return pageRankImpl( this, options );
  }

  degreeCentrality( options?: DegreeCentralityOptions ): DegreeCentralityResult {
    return degreeCentralityImpl( this, options );
  }

  declare dc: this['degreeCentrality'];

  degreeCentralityNormalized( options?: DegreeCentralityOptions ): DegreeCentralityNormalizedResult {
    return degreeCentralityNormalizedImpl( this, options );
  }

  declare dcn: this['degreeCentralityNormalized'];
  declare degreeCentralityNormalised: this['degreeCentralityNormalized'];

  closenessCentrality( options?: ClosenessCentralityOptions ): number {
    return closenessCentralityImpl( this, options );
  }

  declare cc: this['closenessCentrality'];

  closenessCentralityNormalized( options?: ClosenessCentralityOptions ): ClosenessCentralityNormalizedResult {
    return closenessCentralityNormalizedImpl( this, options );
  }

  declare ccn: this['closenessCentralityNormalized'];
  declare closenessCentralityNormalised: this['closenessCentralityNormalized'];

  betweennessCentrality( options?: BetweennessCentralityOptions ): BetweennessCentralityResult {
    return betweennessCentralityImpl( this, options );
  }

  declare bc: this['betweennessCentrality'];

  kMeans( options?: KClusteringOptions ): GpuCollection[] {
    return kMeansImpl( this, options );
  }

  kMedoids( options?: KClusteringOptions ): GpuCollection[] {
    return kMedoidsImpl( this, options );
  }

  fuzzyCMeans( options?: KClusteringOptions ): FuzzyCMeansResult {
    return fuzzyCMeansImpl( this, options );
  }

  declare fcm: this['fuzzyCMeans'];

  hierarchicalClustering( options?: HierarchicalClusteringOptions ): GpuCollection[] {
    return hierarchicalClusteringImpl( this, options );
  }

  declare hca: this['hierarchicalClustering'];

  markovClustering( options?: MarkovClusteringOptions ): GpuCollection[] {
    return markovClusteringImpl( this, options );
  }

  declare mcl: this['markovClustering'];

  affinityPropagation( options?: AffinityPropagationOptions ): GpuCollection[] {
    return affinityPropagationImpl( this, options );
  }

  declare ap: this['affinityPropagation'];

  // -- degree --

  // degree()/indegree()/outdegree() are singular accessors: they report the
  // FIRST element's degree (undefined if it isn't a live node), as in v3. The
  // whole-collection sum is totalDegree().
  degree( includeLoops: boolean = true ): number | undefined {
    return this._degree( includeLoops, ( store, slot ) =>
      store.adj.outDegree( slot ) + store.adj.inDegree( slot ) );
  }

  outdegree( includeLoops: boolean = true ): number | undefined {
    return this._degree( includeLoops, ( store, slot ) => store.adj.outDegree( slot ), 'out' );
  }

  indegree( includeLoops: boolean = true ): number | undefined {
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
      const d = this[ i ].degree( includeLoops );

      if( d !== undefined ){ total += d; }
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

      if( degree === undefined ){ continue; }

      if( ret === undefined || sign * degree > sign * ret ){ ret = degree; }
    }

    return ret;
  }

  private _degree(
    includeLoops: boolean,
    count: ( store: GpuCore['_store'], slot: number ) => number,
    direction?: 'out' | 'in'
  ): number | undefined {
    const store = this._store;
    const ref = this._first();

    // first element must be a live node, else undefined (as in v3)
    if( ref == null || ref.group !== 'nodes' || !store.isCurrent( ref ) ){ return undefined; }

    let total = count( store, ref.slot );

    if( !includeLoops ){
      const endpoints = store.column( 'edge.endpoints' ) as Uint32Array;

      // a loop contributes 1 to outdegree, 1 to indegree, 2 to degree
      for( const edgeSlot of store.adj.outEdges( ref.slot ) ){
        if( endpoints[ edgeSlot * 2 ] === endpoints[ edgeSlot * 2 + 1 ] ){
          total -= direction == null ? 2 : 1;
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
GpuCollection.prototype.makeLayout = GpuCollection.prototype.layout;
GpuCollection.prototype.createLayout = GpuCollection.prototype.layout;
GpuCollection.prototype.bfs = GpuCollection.prototype.breadthFirstSearch;
GpuCollection.prototype.dfs = GpuCollection.prototype.depthFirstSearch;
GpuCollection.prototype.tsc = GpuCollection.prototype.tarjanStronglyConnected;
GpuCollection.prototype.tscc = GpuCollection.prototype.tarjanStronglyConnected;
GpuCollection.prototype.tarjanStronglyConnectedComponents = GpuCollection.prototype.tarjanStronglyConnected;
GpuCollection.prototype.htbc = GpuCollection.prototype.hopcroftTarjanBiconnected;
GpuCollection.prototype.htb = GpuCollection.prototype.hopcroftTarjanBiconnected;
GpuCollection.prototype.hopcroftTarjanBiconnectedComponents = GpuCollection.prototype.hopcroftTarjanBiconnected;
GpuCollection.prototype.dc = GpuCollection.prototype.degreeCentrality;
GpuCollection.prototype.dcn = GpuCollection.prototype.degreeCentralityNormalized;
GpuCollection.prototype.degreeCentralityNormalised = GpuCollection.prototype.degreeCentralityNormalized;
GpuCollection.prototype.cc = GpuCollection.prototype.closenessCentrality;
GpuCollection.prototype.ccn = GpuCollection.prototype.closenessCentralityNormalized;
GpuCollection.prototype.closenessCentralityNormalised = GpuCollection.prototype.closenessCentralityNormalized;
GpuCollection.prototype.bc = GpuCollection.prototype.betweennessCentrality;
GpuCollection.prototype.fcm = GpuCollection.prototype.fuzzyCMeans;
GpuCollection.prototype.hca = GpuCollection.prototype.hierarchicalClustering;
GpuCollection.prototype.mcl = GpuCollection.prototype.markovClustering;
GpuCollection.prototype.ap = GpuCollection.prototype.affinityPropagation;
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
GpuCollection.prototype.css = GpuCollection.prototype.style;
GpuCollection.prototype.renderedCss = GpuCollection.prototype.renderedStyle;
