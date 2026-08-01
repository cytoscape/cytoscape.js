import {
  CURVE_MULTI, CURVE_STRAIGHT, CURVE_TAXI,
  FLAG_ACTIVE, FLAG_CURVED_BOX, FLAG_GRABBABLE, FLAG_GRABBED, FLAG_LOCKED, FLAG_NO_EVENTS,
  FLAG_PANNABLE, FLAG_PARENT, FLAG_SELECTABLE, FLAG_SELECTED, FLAG_VISIBLE
} from './contract.mjs';
import type { GroupName, Ref } from './contract.mjs';
import { headerDeviation, routeMidpoint } from './curve-geometry.mjs';
import type { CurveRoute } from './curve-geometry.mjs';
import { CURVE_STYLE_BEZIER } from './store/curve-index.mjs';
import { compileQuery, planMatchesRef } from './matcher.mjs';
import type { GpuQuery } from './matcher.mjs';
import { testCondition } from './style-scales.mjs';
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
  private __refs!: Ref[];
  /** the store's compactEpoch this collection last synced against (19.3) */
  private _syncEpoch = -1;
  _id: string | undefined;
  _group: GroupName | undefined;
  /** per-element scratchpad, lazily created on the interned singleton handle */
  _scratch?: Record<string, unknown>;
  /** lazily-built packed-key membership set; safe to cache since _refs is immutable */
  _keys?: Set<number>;

  /**
   * The collection's refs, repaired lazily after a slot compaction
   * (19.3): on first access past a new compaction epoch, every stale-
   * but-forwarded ref rewrites in place (fixing all holders of that ref
   * object) and the packed membership cache drops.  The array identity
   * and length never change — dead refs stay dead in place, matching
   * removed-element semantics.
   */
  get _refs(): Ref[] {
    const store = this._cy._store;

    if( this._syncEpoch !== store.compactEpoch ){
      this._syncEpoch = store.compactEpoch;

      const refs = this.__refs;

      for( let i = 0; i < refs.length; i++ ){ store.isCurrent( refs[ i ] ); }

      this._keys = undefined;
    }

    return this.__refs;
  }

  set _refs( refs: Ref[] ){
    this.__refs = refs;
    this._syncEpoch = this._cy._store.compactEpoch;
  }

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
        // intern first: _eleFromRef repairs a compaction-forwarded stale
        // ref in place, so the packed key below is its current identity
        const ele = cy._eleFromRef( ref );
        const key = packRef( ref );

        if( seen.has( key ) ){ continue; }

        seen.add( key );
        deduped.push( ref );
        this[ i ] = ele;
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
    const dataConds = plan.data;
    const refs: Ref[] = [];

    for( let i = 0; i < this._refs.length; i++ ){
      const ref = this._refs[ i ];
      const isNode = ref.group === 'nodes';
      const test = isNode ? nodeTest : edgeTest;

      if( test == null ){ continue; }

      if( ( isNode ? nodeGen : edgeGen )[ ref.slot ] !== ref.gen ){ continue; } // stale

      const flags = ( isNode ? nodeFlags : edgeFlags )[ ref.slot ];

      if( ( flags & test.mask ) !== test.want ){ continue; }

      if( dataConds != null ){
        let pass = true;

        for( const cond of dataConds ){
          if( !testCondition( cond, store.data.get( ref.group, ref.slot, cond.key ) ) ){ pass = false; break; }
        }

        if( !pass ){ continue; }
      }

      refs.push( ref );
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

      // parent positions are derived: settle pending auto-bounds first
      if( store.hasCompounds() ){ store.flushDerived(); }

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
   * `duration` ms, easing the normalized time.  Round 21: there is no
   * queue — the animation starts immediately; animations on disjoint
   * channels compose, and one overlapping a running animation's channels
   * stops that older one in place (sequence with `await
   * animation().play()` / `.promise()`).  Returns the collection; use
   * `animation()` for a handle with `.promise()`.
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
      play: () => { cy._animations.start( ani ); return ani.promise(); },
      stop: ( jumpToEnd = false ) => ani.stop( jumpToEnd ),
      promise: () => ani.promise(),
      playing: () => ani.running
    };
  }

  /** A no-op tween of `duration` ms — a timed pause that touches no
   * channels, so it composes with any running animation (round 21: use
   * `delayAnimation().play()` + await to sequence). */
  delay( duration: number, complete?: () => void ): this {
    return this.animate( { duration, complete } );
  }

  /** Like delay(), but returns the animation handle instead of chaining. */
  delayAnimation( duration: number, complete?: () => void ): AnimationHandle {
    return this.animation( { duration, complete } );
  }

  /** True when any of these elements has a running animation. */
  animated(): boolean {
    for( const ref of this._refs ){
      if( this._cy._animations.isAnimating( ref ) ){ return true; }
    }

    return false;
  }

  /** Stop every running animation on these elements (round 21: no queue —
   * the v3 clearQueue argument is gone; `jumpToEnd` applies final values). */
  stop( jumpToEnd: boolean = false ): this {
    this._cy._animations.stop( this._liveRefs(), jumpToEnd );

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

        this._emitSubtreePositions( emitIdx );
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

      this._emitSubtreePositions( emitIdx );
    }

    return this;
  }

  /**
   * v3 parity: descendants moved along by a parent's position write emit
   * 'position' too — once each (members that already emitted are skipped).
   * Only called when position listeners exist.
   */
  private _emitSubtreePositions( emitIdx: number[] ): void {
    const store = this._store;

    if( !store.hasCompounds() ){ return; }

    const emitted = new Set<number>();

    for( const i of emitIdx ){
      const ref = this._refs[ i ];

      if( ref.group === 'nodes' ){ emitted.add( ref.slot ); }
    }

    for( const i of emitIdx ){
      const ref = this._refs[ i ];

      if( ref.group !== 'nodes' || !store.hasFlag( 'nodes', ref.slot, FLAG_PARENT ) ){ continue; }

      const stack: number[] = [ ...store.childrenOf( ref.slot ) ];

      while( stack.length > 0 ){
        const s = stack.pop() as number;

        for( const kid of store.childrenOf( s ) ){ stack.push( kid ); }

        if( !emitted.has( s ) ){
          emitted.add( s );
          this._cy._emitOnEle( 'position', this._cy._ele( 'nodes', s ) );
        }
      }
    }
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

    // v3's shift dedupe: an element whose ancestor is also shifted is
    // skipped — the ancestor's subtree shift moves it exactly once
    const inSet: Set<number> | null = store.hasCompounds() ? new Set() : null;

    if( inSet != null ){
      for( const ref of this._refs ){
        if( ref.group === 'nodes' && store.isCurrent( ref ) ){ inSet.add( ref.slot ); }
      }
    }

    for( let i = 0; i < this.length; i++ ){
      const ref = this._refs[ i ];

      if( ref.group !== 'nodes' || !store.isCurrent( ref ) ){ continue; }

      if( inSet != null ){
        let ancestorInSet = false;

        for( let p = store.parentOf( ref.slot ); p >= 0; p = store.parentOf( p ) ){
          if( inSet.has( p ) ){ ancestorInSet = true; break; }
        }

        if( ancestorInSet ){ continue; }
      }

      slots.push( ref.slot );

      if( emitIdx != null ){ emitIdx.push( i ); }
    }

    store.shiftPositions( slots, dx, dy );

    if( emitIdx != null ){
      for( const i of emitIdx ){
        this._cy._emitOnEle( 'position', this[ i ] );
      }

      this._emitSubtreePositions( emitIdx );
    }

    return this;
  }

  /** Compound-relative position: the model position minus the immediate
   * parent's (derived) position — the model position for orphans and
   * compound-free graphs (round 14.3, v3 semantics). */
  relativePosition( dim?: string | Position, value?: number ): Position | number | undefined | this {
    const store = this._store;

    if( !store.hasCompounds() ){ return this._positionImpl( dim, value, false ); }

    // getter forms
    if( dim === undefined || ( typeof dim === 'string' && value === undefined ) ){
      const pos = this._positionImpl( undefined, undefined, false ) as Position | undefined;

      if( pos == null ){ return undefined; }

      const origin = this._relOrigin( this._refs[ 0 ] );
      const rel = { x: pos.x - origin.x, y: pos.y - origin.y };

      return typeof dim === 'string' ? rel[ dim as 'x' | 'y' ] : rel;
    }

    // setter forms: model = parent origin + rel, resolved per element
    if( typeof dim === 'string' ){
      return this._positions( ( ele ) => {
        const prev = ele.relativePosition() as Position;
        const origin = ele._relOrigin( ele._refs[ 0 ] );
        const rx = dim === 'x' ? ( value as number ) : prev.x;
        const ry = dim === 'y' ? ( value as number ) : prev.y;

        return { x: origin.x + rx, y: origin.y + ry };
      }, false );
    }

    return this._positions( ( ele ) => {
      const origin = ele._relOrigin( ele._refs[ 0 ] );

      return { x: origin.x + ( dim as Position ).x, y: origin.y + ( dim as Position ).y };
    }, false );
  }

  /** The immediate parent's position ({0, 0} for orphans); flushes first. */
  private _relOrigin( ref: Ref ): Position {
    const store = this._store;

    store.flushDerived();

    const p = store.parentOf( ref.slot );

    if( p < 0 ){ return { x: 0, y: 0 }; }

    const xy = store.column( 'node.position' ) as Float32Array;

    return { x: xy[ p * 2 ], y: xy[ p * 2 + 1 ] };
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
      ? this._nodeDim( ref, 0 )
      : ( this._store.column( 'edge.width' ) as Float32Array )[ ref.slot ];
  }

  height(): number | undefined {
    const ref = this._first();

    if( ref == null || !this._store.isCurrent( ref ) ){ return undefined; }

    return ref.group === 'nodes'
      ? this._nodeDim( ref, 1 )
      : ( this._store.column( 'edge.width' ) as Float32Array )[ ref.slot ];
  }

  /** A node's core width/height: for parents the column stores the
   * padded/drawn box (auto-bounds, round 14.3), so the readback
   * subtracts the padding — v3's autoWidth/autoHeight. */
  private _nodeDim( ref: Ref, axis: 0 | 1 ): number {
    const store = this._store;

    if( store.hasCompounds() && store.hasFlag( 'nodes', ref.slot, FLAG_PARENT ) ){
      store.flushDerived();

      const size = store.column( 'node.size' ) as Float32Array;

      return size[ ref.slot * 2 + axis ] - 2 * store.paddingOf( ref.slot );
    }

    return ( store.column( 'node.size' ) as Float32Array )[ ref.slot * 2 + axis ];
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
      } else {
        // parent is first-class hierarchy state, synthesized on read
        // like edge source/target (round 14); absent for orphans
        const parentSlot = this._store.parentOf( ref.slot );

        if( parentSlot >= 0 ){ out.parent = this._store.idAt( 'nodes', parentSlot ); }
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

      if( ref.group === 'nodes' && key === 'parent' ){
        const parentSlot = this._store.parentOf( ref.slot );

        return parentSlot < 0 ? undefined : this._store.idAt( 'nodes', parentSlot );
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

        if( ref.group === 'nodes' && k === 'parent' ){
          throw new Error( `Can not change the immutable data field 'parent' of a node; reparent with move()` );
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

  /** The rendered opacity: a node's own opacity times its ancestors'
   * (v3's product rule — the store keeps the folded value in the
   * column, round 14.4); an edge's own opacity (edges have no parent). */
  effectiveOpacity(): number | undefined {
    const ref = this._first();

    if( ref == null || !this._store.isCurrent( ref ) ){ return undefined; }

    if( ref.group === 'nodes' && this._store.hasCompounds() ){
      return ( this._store.column( 'node.opacity' ) as Float32Array )[ ref.slot ];
    }

    return this.numericStyle( 'opacity' );
  }

  transparent(): boolean {
    return this.effectiveOpacity() === 0;
  }

  /** Hidden elements are culled from drawing and picking, so only visible ones take up space. */
  takesUpSpace(): boolean {
    return this.visible();
  }

  /** Whether the element can be interacted with: visible and not
   * pointer-transparent (`events: 'no'` — round 20.2). */
  interactive(): boolean {
    return this.visible() && !this._hasBit( FLAG_NO_EVENTS );
  }

  /** The node's resolved label text ('' when none); read-only in the prototype. */
  label(): string | undefined {
    const ref = this._first();

    if( ref == null || !this._store.isCurrent( ref ) ){ return undefined; }

    return this._store.labelAt( ref.slot, ref.group )?.text ?? '';
  }

  /**
   * v3-parity accessor: node padding.  Leaves have no padding in v4
   * (no compound-free `padding` prop); parents answer the resolved
   * auto-bounds padding (round 14.3).
   */
  padding(): number | undefined {
    const ref = this._first();

    if( ref == null ){ return undefined; }

    if( ref.group !== 'nodes' || !this._store.isCurrent( ref ) || !this._store.hasCompounds() ){
      return 0;
    }

    return this._store.paddingOf( ref.slot );
  }

  /** The drawn box: core dims + 2 x padding (v3's paddedWidth). */
  paddedWidth(): number | undefined {
    return this._paddedDim( 0 );
  }

  paddedHeight(): number | undefined {
    return this._paddedDim( 1 );
  }

  private _paddedDim( axis: 0 | 1 ): number | undefined {
    const ref = this._first();

    if( ref == null || !this._store.isCurrent( ref ) ){ return undefined; }

    if( ref.group === 'nodes' && this._store.hasCompounds()
      && this._store.hasFlag( 'nodes', ref.slot, FLAG_PARENT ) ){
      this._store.flushDerived();

      // the size column stores the padded/drawn box for parents
      return ( this._store.column( 'node.size' ) as Float32Array )[ ref.slot * 2 + axis ];
    }

    return axis === 0 ? this.width() : this.height();
  }

  outerWidth(): number | undefined {
    const w = this.paddedWidth();

    return w == null ? undefined : w + this._borderWidth();
  }

  outerHeight(): number | undefined {
    const h = this.paddedHeight();

    return h == null ? undefined : h + this._borderWidth();
  }

  private _borderWidth(): number {
    const ref = this._first();

    if( ref == null || ref.group !== 'nodes' ){ return 0; }

    return ( this._store.column( 'node.borderWidth' ) as Float32Array )[ ref.slot ];
  }

  boundingBox( options?: { includeLabels?: boolean } ): { x1: number; y1: number; x2: number; y2: number; w: number; h: number } {
    // labels join the box by default (round 16.4); unknown keys throw —
    // a typo must not silently change fit semantics
    if( options != null ){
      for( const key of Object.keys( options ) ){
        if( key !== 'includeLabels' ){
          throw new Error( `Unknown boundingBox() option '${key}'; supported: includeLabels` );
        }
      }
    }

    const includeLabels = options?.includeLabels !== false;
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
    const ghost = store.column( 'node.ghost' ) as Float32Array;
    const bGeom = store.column( 'node.borderGeom' ) as Uint32Array;
    const endpoints = store.column( 'edge.endpoints' ) as Uint32Array;

    store.flushDerived(); // parent auto-bounds + curved-edge params derive below

    for( const ref of this._liveRefs() ){
      if( ref.group === 'nodes' ){
        const slot = ref.slot;
        let hw = size[ slot * 2 ] / 2 + border[ slot ] / 2;
        let hh = size[ slot * 2 + 1 ] / 2 + border[ slot ] / 2;

        // an outline ring grows the box (round 13 B5)
        if( bGeom[ slot * 4 + 2 ] >>> 24 !== 0 ){
          const wo = bGeom[ slot * 4 + 3 ];
          const extra = ( wo >>> 16 ) / 256 / 2 + ( wo & 0xffff ) / 256;

          hw += extra;
          hh += extra;
        }

        expandPoint( store.getX( slot ), store.getY( slot ), hw, hh );

        // a ghost duplicates the body at the offset (round 13 A1)
        if( ghost[ slot * 4 + 3 ] !== 0 ){
          expandPoint(
            store.getX( slot ) + ghost[ slot * 4 ],
            store.getY( slot ) + ghost[ slot * 4 + 1 ],
            hw, hh
          );
        }

        // the node label's laid box at its anchor (round 16.4)
        if( includeLabels ){
          const lb = store.nodeLabelBox( slot );

          if( lb != null ){
            expandPoint( store.getX( slot ) + lb.x1, store.getY( slot ) + lb.y1 );
            expandPoint( store.getX( slot ) + lb.x2, store.getY( slot ) + lb.y2 );
          }
        }
      } else {
        // curved edges use the exact lazy bound (memoized flattened
        // polyline); straight edges span their endpoint centers
        const curveBB = store.curveBBAt( ref.slot );
        const hay = curveBB == null ? store.haystackPointsAt( ref.slot ) : null;

        if( curveBB != null ){
          expandPoint( curveBB.x1, curveBB.y1 );
          expandPoint( curveBB.x2, curveBB.y2 );
        } else if( hay != null ){
          // haystack edges (12c) span their offset points (v3's allpts)
          expandPoint( hay.sx, hay.sy );
          expandPoint( hay.tx, hay.ty );
        } else {
          expandPoint( store.getX( endpoints[ ref.slot * 2 ] ), store.getY( endpoints[ ref.slot * 2 ] ) );
          expandPoint( store.getX( endpoints[ ref.slot * 2 + 1 ] ), store.getY( endpoints[ ref.slot * 2 + 1 ] ) );
        }

        // edge labels (16.4): the conservative block-covering radius
        // about both endpoints (the anchor lies on the drawn path) — a
        // recorded approximation; node labels are exact above
        if( includeLabels ){
          const r = store.edgeLabelSlack( ref.slot );

          if( r > 0 ){
            expandPoint( store.getX( endpoints[ ref.slot * 2 ] ), store.getY( endpoints[ ref.slot * 2 ] ), r, r );
            expandPoint( store.getX( endpoints[ ref.slot * 2 + 1 ] ), store.getY( endpoints[ ref.slot * 2 + 1 ] ), r, r );
          }
        }
      }
    }

    if( x1 === Infinity ){
      return { x1: 0, y1: 0, x2: 0, y2: 0, w: 0, h: 0 };
    }

    return { x1, y1, x2, y2, w: x2 - x1, h: y2 - y1 };
  }

  /**
   * The exact laid label boxes of this collection's elements, unioned
   * (round 16.4 — the v4 form of v3's text-metrics surface): node
   * labels at their anchors, edge mid-labels at the drawn midpoint,
   * end labels conservatively about their endpoint.  Empty (zero) when
   * nothing is labelled.  Headless dims are estimates (recorded).
   */
  labelBoundingBox(): { x1: number; y1: number; x2: number; y2: number; w: number; h: number } {
    const store = this._store;
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;

    const expand = ( bx1: number, by1: number, bx2: number, by2: number ): void => {
      x1 = Math.min( x1, bx1 );
      y1 = Math.min( y1, by1 );
      x2 = Math.max( x2, bx2 );
      y2 = Math.max( y2, by2 );
    };

    for( const ref of this._liveRefs() ){
      if( ref.group === 'nodes' ){
        const lb = store.nodeLabelBox( ref.slot );

        if( lb != null ){
          const x = store.getX( ref.slot );
          const y = store.getY( ref.slot );

          expand( x + lb.x1, y + lb.y1, x + lb.x2, y + lb.y2 );
        }

        continue;
      }

      // edge mid-labels: the block about the drawn midpoint; end labels
      // ride the conservative endpoint radius
      const entry = store.labelAt( ref.slot, 'edges' );
      const dims = store.labelDimsAt( ref.slot, 'edges' );

      if( entry != null && dims != null ){
        const m = this._cy._ele( ref.group, ref.slot ).midpoint() ?? { x: 0, y: 0 };
        const dx = entry.marginX;
        const pad = ( entry.bgColor >>> 24 ) > 0 ? entry.bgPadding : 0;

        expand(
          m.x + dx - dims.w / 2 - pad, m.y + entry.anchorY - pad,
          m.x + dx + dims.w / 2 + pad, m.y + entry.anchorY + dims.h + pad );
      }

      const r = Math.max(
        store.labelDimsAt( ref.slot, 'edgeSource' ) != null ? store.edgeLabelSlack( ref.slot ) : 0,
        store.labelDimsAt( ref.slot, 'edgeTarget' ) != null ? store.edgeLabelSlack( ref.slot ) : 0 );

      if( r > 0 ){
        const endpoints = store.column( 'edge.endpoints' ) as Uint32Array;

        for( let end = 0; end < 2; end++ ){
          const node = endpoints[ ref.slot * 2 + end ];

          expand( store.getX( node ) - r, store.getY( node ) - r,
            store.getX( node ) + r, store.getY( node ) + r );
        }
      }
    }

    if( x1 === Infinity ){
      return { x1: 0, y1: 0, x2: 0, y2: 0, w: 0, h: 0 };
    }

    return { x1, y1, x2, y2, w: x2 - x1, h: y2 - y1 };
  }

  /** boundingBox() transformed into rendered (on-screen) coordinates. */
  renderedBoundingBox( options?: { includeLabels?: boolean } ): { x1: number; y1: number; x2: number; y2: number; w: number; h: number } {
    const bb = this.boundingBox( options );
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

  /** Midpoint of the edge: the curve/route midpoint for curved edges
   * (v3's rs.mid rules per family), the endpoint-center average for
   * straight ones. */
  midpoint(): Position | undefined {
    const ref = this._first();

    if( ref == null || ref.group !== 'edges' || !this._store.isCurrent( ref ) ){ return undefined; }

    const ev = this._store.curveEvalAt( ref.slot );

    if( ev != null ){
      return { x: ev.mx, y: ev.my };
    }

    const route = this._store.curveRouteAt( ref.slot );

    if( route != null ){
      const m = { x: 0, y: 0, tx: 0, ty: 0 };

      routeMidpoint( route, m );

      return { x: m.x, y: m.y };
    }

    // haystack edges (12c): the offset-point average, v3's rs.mid
    const hay = this._store.haystackPointsAt( ref.slot );

    if( hay != null ){
      return { x: ( hay.sx + hay.tx ) / 2, y: ( hay.sy + hay.ty ) / 2 };
    }

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

  /** Whether the edge participates in bezier bundling — v3 semantics:
   * a style check (`curve-style: bezier`), true even for the lone or
   * odd-middle member that renders straight. */
  isBundledBezier(): boolean {
    const ref = this._first();

    if( ref == null || ref.group !== 'edges' || !this._store.isCurrent( ref ) ){ return false; }

    return this._store.curveStyleAt( ref.slot ).style === CURVE_STYLE_BEZIER;
  }

  /** The edge's curve control points (model coords): one for a bundled
   * bezier, two for a self-loop, the control list for an unbundled
   * bezier, undefined otherwise — v3's getControlPoints surface
   * (segments/taxi answer segmentPoints() instead). */
  controlPoints(): Position[] | undefined {
    const ref = this._first();

    if( ref == null || ref.group !== 'edges' || !this._store.isCurrent( ref ) ){ return undefined; }

    const ev = this._store.curveEvalAt( ref.slot );

    if( ev != null ){
      return ev.c1x === ev.c2x && ev.c1y === ev.c2y
        ? [ { x: ev.c1x, y: ev.c1y } ]
        : [ { x: ev.c1x, y: ev.c1y }, { x: ev.c2x, y: ev.c2y } ];
    }

    const route = this._store.curveRouteAt( ref.slot );

    // a straight-styled edge with manual endpoints derives as the
    // MULTI n = 0 chord (12c) — it has no control points
    if( route == null || route.kind !== CURVE_MULTI || route.n === 0 ){ return undefined; }

    return this._routeInteriorPoints( route );
  }

  renderedControlPoints(): Position[] | undefined {
    const pts = this.controlPoints();

    if( pts == null ){ return undefined; }

    return pts.map( p => this._toRenderedPoint( p ) as Position );
  }

  /** The edge's segment points (model coords) — v3's getSegmentPoints:
   * defined for segments *and* taxi edges (taxi derives its points),
   * undefined otherwise. */
  segmentPoints(): Position[] | undefined {
    const ref = this._first();

    if( ref == null || ref.group !== 'edges' || !this._store.isCurrent( ref ) ){ return undefined; }

    const route = this._store.curveRouteAt( ref.slot );

    if( route == null || route.kind === CURVE_MULTI ){ return undefined; }

    return this._routeInteriorPoints( route );
  }

  renderedSegmentPoints(): Position[] | undefined {
    const pts = this.segmentPoints();

    if( pts == null ){ return undefined; }

    return pts.map( p => this._toRenderedPoint( p ) as Position );
  }

  private _routeInteriorPoints( route: CurveRoute ): Position[] {
    const pts: Position[] = [];

    for( let i = 0; i < route.n; i++ ){
      pts.push( { x: route.qx[ i + 1 ], y: route.qy[ i + 1 ] } );
    }

    return pts;
  }

  private _endpointPoint( which: 0 | 1 ): Position | undefined {
    const ref = this._first();

    if( ref == null || ref.group !== 'edges' || !this._store.isCurrent( ref ) ){ return undefined; }

    // curved edges: the curve's boundary endpoints (closer to v3's
    // arrow endpoints than the straight-edge node-center approximation)
    const ev = this._store.curveEvalAt( ref.slot );

    if( ev != null ){
      return which === 0 ? { x: ev.sx, y: ev.sy } : { x: ev.ex, y: ev.ey };
    }

    const route = this._store.curveRouteAt( ref.slot );

    if( route != null ){
      const i = which === 0 ? 0 : route.n + 1;

      return { x: route.qx[ i ], y: route.qy[ i ] };
    }

    // haystack edges (12c): the offset points — v3's haystackPts
    const hay = this._store.haystackPointsAt( ref.slot );

    if( hay != null ){
      return which === 0 ? { x: hay.sx, y: hay.sy } : { x: hay.tx, y: hay.ty };
    }

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
    return this._setVisibility( true );
  }

  hide(): this {
    return this._setVisibility( false );
  }

  /** show/hide (round 14.4): the store records the own state in
   * FLAG_SELF_HIDDEN and recomputes the effective FLAG_VISIBLE over
   * affected subtrees — descendants gate on hidden ancestors, and
   * hidden children leave their ancestors' auto-bounds. */
  private _setVisibility( on: boolean ): this {
    this._store.setVisibility( this._refs, on );

    return this;
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

    // build the closure: requested live elements + their descendants
    // (compound removal cascades, v3) + incident edges of removed nodes
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

    const addNode = ( ele: GpuCollection ): void => {
      const key = packRef( ele._refs[0] );

      if( seen.has( key ) ){ return; }

      seen.add( key );
      nodeHandles.push( ele );

      const slot = ele._refs[0].slot;

      for( const edgeSlot of store.adj.connectedEdges( slot ) ){
        addEdge( cy._ele( 'edges', edgeSlot ) );
      }

      for( const childSlot of store.childrenOf( slot ) ){
        addNode( cy._ele( 'nodes', childSlot ) );
      }
    };

    for( let i = 0; i < this.length; i++ ){
      const ref = this._refs[ i ];

      if( !store.isCurrent( ref ) ){ continue; }

      if( ref.group === 'edges' ){
        addEdge( this[ i ] );
      } else {
        addNode( this[ i ] );
      }
    }

    // children before parents: the store refuses to remove a node whose
    // children are still alive (depths are strictly increasing down a chain)
    nodeHandles.sort( ( a, b ) => store.depthOf( b._refs[0].slot ) - store.depthOf( a._refs[0].slot ) );

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

    const removed = this._spawn( [ ...edgeHandles, ...nodeHandles ].map( ele => ele._refs[0] ) );

    cy._maybeCompact(); // the auto dead-slot trigger's safe boundary (19.5)

    return removed;
  }

  /**
   * Move elements in place, keeping slot, id and data: `{ parent }`
   * re-parents nodes (null orphans them; the compound move, round 14.2 —
   * emits `moveout` before and `move` after per changed node), while
   * `{ source, target }` re-points edges.  As in v3 the modes are
   * exclusive — a `parent` key takes precedence.  An unknown parent id is
   * a silent no-op (v3); a cyclic assignment warns and drops (the
   * hierarchy rule).  Returns this collection.
   */
  move( opts: { source?: string; target?: string; parent?: string | null } ): this {
    const store = this._store;

    if( opts.parent !== undefined ){
      let parentSlot = -1;

      if( opts.parent != null ){
        const parentRef = store.lookup( String( opts.parent ) );

        if( parentRef == null || parentRef.group !== 'nodes' ){ return this; } // v3: silent no-op

        parentSlot = parentRef.slot;
      }

      const wantEmit = hasListeners( this._cy._emitter, 'moveout' )
        || hasListeners( this._cy._emitter, 'move' );

      for( let i = 0; i < this.length; i++ ){
        const ref = this._refs[ i ];

        if( ref.group !== 'nodes' || !store.isCurrent( ref ) ){ continue; }
        if( store.parentOf( ref.slot ) === parentSlot ){ continue; }

        // a cyclic assignment is dropped by setParent (with its warning);
        // it gets no events since nothing changes
        const cyclic = parentSlot >= 0
          && ( parentSlot === ref.slot || store.isAncestorOf( ref.slot, parentSlot ) );

        if( !cyclic && wantEmit ){ this._cy._emitOnEle( 'moveout', this[ i ] ); }

        store.setParent( ref.slot, parentSlot );

        if( !cyclic && wantEmit ){ this._cy._emitOnEle( 'move', this[ i ] ); }
      }

      return this;
    }

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

  // -- compound hierarchy (round 14.2) --

  /** Immediate parents of every node in the collection (unique).  v4
   * always returns a proper collection — v3's single-element raw-ref
   * shortcut (which also ignored the selector argument) is not ported. */
  parent( criterion?: FilterLike ): GpuCollection {
    const store = this._store;
    const refs: Ref[] = [];
    const seen = new Set<number>();

    for( let i = 0; i < this._refs.length; i++ ){
      const ref = this._refs[ i ];

      if( ref.group !== 'nodes' || !store.isCurrent( ref ) ){ continue; }

      const p = store.parentOf( ref.slot );

      if( p >= 0 && !seen.has( p ) ){
        seen.add( p );
        refs.push( store.ref( 'nodes', p ) );
      }
    }

    const eles = this._spawnLive( refs );

    return criterion == null ? eles : eles.filter( criterion );
  }

  /** All ancestors, level by level: every nearest parent first, then the
   * grandparents, and so on (v3's iterated-parent() order). */
  parents( criterion?: FilterLike ): GpuCollection {
    const store = this._store;
    const refs: Ref[] = [];
    const seen = new Set<number>();
    let level: number[] = [];

    for( let i = 0; i < this._refs.length; i++ ){
      const ref = this._refs[ i ];

      if( ref.group === 'nodes' && store.isCurrent( ref ) ){ level.push( ref.slot ); }
    }

    while( level.length > 0 ){
      const next: number[] = [];

      for( const slot of level ){
        const p = store.parentOf( slot );

        if( p >= 0 && !seen.has( p ) ){
          seen.add( p );
          refs.push( store.ref( 'nodes', p ) );
          next.push( p );
        }
      }

      level = next;
    }

    const eles = this._spawnLive( refs );

    return criterion == null ? eles : eles.filter( criterion );
  }

  declare ancestors: this['parents'];

  /** Direct children of every node, in link order per parent. */
  children( criterion?: FilterLike ): GpuCollection {
    const store = this._store;
    const refs: Ref[] = [];
    const seen = new Set<number>();

    for( let i = 0; i < this._refs.length; i++ ){
      const ref = this._refs[ i ];

      if( ref.group !== 'nodes' || !store.isCurrent( ref ) ){ continue; }

      for( const child of store.childrenOf( ref.slot ) ){
        if( !seen.has( child ) ){
          seen.add( child );
          refs.push( store.ref( 'nodes', child ) );
        }
      }
    }

    const eles = this._spawnLive( refs );

    return criterion == null ? eles : eles.filter( criterion );
  }

  /** The subtree below every node in pre-order, excluding the nodes themselves. */
  descendants( criterion?: FilterLike ): GpuCollection {
    const store = this._store;
    const refs: Ref[] = [];
    const seen = new Set<number>();
    const stack: number[] = [];

    const pushChildren = ( slot: number ): void => {
      const kids = store.childrenOf( slot );

      for( let j = kids.length - 1; j >= 0; j-- ){ stack.push( kids[ j ] ); }
    };

    for( let i = 0; i < this._refs.length; i++ ){
      const ref = this._refs[ i ];

      if( ref.group !== 'nodes' || !store.isCurrent( ref ) ){ continue; }

      pushChildren( ref.slot );

      while( stack.length > 0 ){
        const slot = stack.pop() as number;

        if( seen.has( slot ) ){ continue; }

        seen.add( slot );
        refs.push( store.ref( 'nodes', slot ) );
        pushChildren( slot );
      }
    }

    const eles = this._spawnLive( refs );

    return criterion == null ? eles : eles.filter( criterion );
  }

  /** Nodes sharing a parent with the collection's nodes, excluding them;
   * orphans are nobody's siblings (v3). */
  siblings( criterion?: FilterLike ): GpuCollection {
    const eles = this.parent().children().difference( this );

    return criterion == null ? eles : eles.filter( criterion );
  }

  /** The collection's nodes without a parent. */
  orphans( criterion?: FilterLike ): GpuCollection {
    return this._byParentedness( false, criterion );
  }

  /** The collection's nodes that have a parent. */
  nonorphans( criterion?: FilterLike ): GpuCollection {
    return this._byParentedness( true, criterion );
  }

  private _byParentedness( wantChild: boolean, criterion?: FilterLike ): GpuCollection {
    const store = this._store;
    const refs: Ref[] = [];

    for( let i = 0; i < this._refs.length; i++ ){
      const ref = this._refs[ i ];

      if( ref.group !== 'nodes' || !store.isCurrent( ref ) ){ continue; }

      if( ( store.parentOf( ref.slot ) >= 0 ) === wantChild ){
        refs.push( store.ref( 'nodes', ref.slot ) );
      }
    }

    const eles = this._spawnLive( refs );

    return criterion == null ? eles : eles.filter( criterion );
  }

  /** Ancestors common to every element, closest first (an edge in the
   * collection has no ancestors, so it empties the result — v3). */
  commonAncestors( criterion?: FilterLike ): GpuCollection {
    const store = this._store;
    let chain: number[] | null = null;

    for( let i = 0; i < this._refs.length; i++ ){
      const ref = this._refs[ i ];

      if( !store.isCurrent( ref ) ){ continue; }

      const own: number[] = [];

      if( ref.group === 'nodes' ){
        for( let p = store.parentOf( ref.slot ); p >= 0; p = store.parentOf( p ) ){ own.push( p ); }
      }

      if( chain == null ){
        chain = own;
      } else {
        const keep = new Set( own );

        chain = chain.filter( slot => keep.has( slot ) );
      }

      if( chain.length === 0 ){ break; }
    }

    const eles = this._spawnLive( ( chain ?? [] ).map( slot => store.ref( 'nodes', slot ) ) );

    return criterion == null ? eles : eles.filter( criterion );
  }

  /** Whether the first element is a node with at least one child. */
  isParent(): boolean {
    const ref = this._liveNodeRef();

    return ref != null && this._store.childrenOf( ref.slot ).length > 0;
  }

  /** Whether the first element is a node with no children. */
  isChildless(): boolean {
    const ref = this._liveNodeRef();

    return ref != null && this._store.childrenOf( ref.slot ).length === 0;
  }

  /** Whether the first element is a node with a parent. */
  isChild(): boolean {
    const ref = this._liveNodeRef();

    return ref != null && this._store.parentOf( ref.slot ) >= 0;
  }

  /** Whether the first element is a node without a parent. */
  isOrphan(): boolean {
    const ref = this._liveNodeRef();

    return ref != null && this._store.parentOf( ref.slot ) < 0;
  }

  private _liveNodeRef(): Ref | null {
    const ref = this._first();

    return ref != null && ref.group === 'nodes' && this._store.isCurrent( ref ) ? ref : null;
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

  /**
   * The bounding box this collection would have if its nodes sat at the
   * given hypothetical positions (a position fn or one shared position) —
   * v3's boundingBoxAt, computed directly with no store writes.  Edges
   * span their endpoints' hypothetical (or, outside the collection,
   * current) positions.
   */
  boundingBoxAt(
    fn: Position | ( ( node: GpuCollection, i: number ) => Position )
  ): { x1: number; y1: number; x2: number; y2: number; w: number; h: number } {
    const nodes = this.nodes();
    const posFn = typeof fn === 'function' ? fn : () => fn;
    const posMap = new Map<GpuCollection, Position>();

    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;

    const expandPoint = ( x: number, y: number ): void => {
      x1 = Math.min( x1, x ); x2 = Math.max( x2, x );
      y1 = Math.min( y1, y ); y2 = Math.max( y2, y );
    };

    for( let i = 0; i < nodes.length; i++ ){
      const node = nodes[ i ];

      // parents derive from their children (14.11): the leaves'
      // hypothetical boxes stand in for the parent body (the padding
      // margin is not modeled — a recorded fit-target approximation)
      if( node.isParent() ){ continue; }

      const pos = posFn( node, i );

      posMap.set( node, pos );

      const halfW = ( node.outerWidth() ?? 0 ) / 2;
      const halfH = ( node.outerHeight() ?? 0 ) / 2;

      expandPoint( pos.x - halfW, pos.y - halfH );
      expandPoint( pos.x + halfW, pos.y + halfH );

      // the node-relative label box comes along (round 16.4): an
      // animated layout's fit target covers the labels too
      const lb = this._store.nodeLabelBox( node._refs[ 0 ].slot );

      if( lb != null ){
        expandPoint( pos.x + lb.x1, pos.y + lb.y1 );
        expandPoint( pos.x + lb.x2, pos.y + lb.y2 );
      }
    }

    const curveParams = this._store.column( 'edge.curveParams' ) as Float32Array;
    const edgeFlags = this._store.column( 'edge.flags' ) as Uint32Array;

    this._store.flushDerived();

    for( const ref of this._liveRefs() ){
      if( ref.group !== 'edges' ){ continue; }

      const edge = this._cy._ele( 'edges', ref.slot );

      // curved edges expand by the conservative hull deviation — exact
      // eval at hypothetical positions isn't needed for a fit target.
      // Box-bounded routes (taxi, extrapolated weights) add the
      // node-half margin (+ chord length for extrapolation).
      const at = ref.slot * 4;
      const kind = curveParams[ at + 3 ];
      let dev = kind === CURVE_STRAIGHT
        ? 0
        : headerDeviation( kind, curveParams[ at ], curveParams[ at + 1 ], curveParams[ at + 2 ] );
      const source = edge.source();
      const target = edge.target();
      const sPos = posMap.get( source ) ?? ( source.position() as Position );
      const tPos = posMap.get( target ) ?? ( target.position() as Position );

      if( ( edgeFlags[ ref.slot ] & FLAG_CURVED_BOX ) !== 0 ){
        dev += this._store.curveBoxMargin();

        if( kind !== CURVE_TAXI ){
          dev += Math.hypot( tPos.x - sPos.x, tPos.y - sPos.y );
        }
      }

      for( const pos of [ sPos, tPos ] ){
        expandPoint( pos.x - dev, pos.y - dev );
        expandPoint( pos.x + dev, pos.y + dev );
      }
    }

    if( x1 === Infinity ){ x1 = y1 = x2 = y2 = 0; }

    return { x1, y1, x2, y2, w: x2 - x1, h: y2 - y1 };
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
   * With `animate: true` the viewport animates concurrently (a fit targets
   * the bounding box at the *final* positions, as v3 does).
   */
  layoutPositions(
    layout: object,
    options: GpuLayoutBaseOptions,
    fn: ( node: GpuCollection, i: number ) => Position
  ): this {
    const cy = this._cy;
    // v3: parents are excluded from layout positioning (auto-bounds
    // derive them from their placed leaves, round 14.11)
    const nodes = cy._store.hasCompounds()
      ? this.nodes().filter( ( n: GpuCollection ) => !n.isParent() )
      : this.nodes();
    const eles = ( options.eles as GpuCollection | undefined ) ?? this;

    // the extension wrapper emits its own layoutstart before run()
    // (round 17.5); the finisher folds into that lifecycle
    if( ( options as { _startEmitted?: boolean } )._startEmitted !== true ){
      cy.emit( { type: 'layoutstart', layout } );
    }

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

      // the viewport animates alongside the nodes: a fit targets the box at
      // the final positions (v3 semantics)
      if( options.fit ){
        anis.push( cy.animation( {
          fit: { boundingBox: eles.boundingBoxAt( getFinalPos ), padding: options.padding ?? 30 },
          duration: options.animationDuration ?? 500,
          easing: options.animationEasing
        } ) );
      } else if( options.zoom != null && options.pan != null ){
        anis.push( cy.animation( {
          zoom: options.zoom,
          pan: options.pan,
          duration: options.animationDuration ?? 500,
          easing: options.animationEasing
        } ) );
      }

      for( const ani of anis ){ ani.play(); }

      options.ready?.();
      cy.emit( { type: 'layoutready', layout } );

      Promise.all( anis.map( ani => ani.promise() ) ).then( () => {
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
GpuCollection.prototype.ancestors = GpuCollection.prototype.parents;
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
