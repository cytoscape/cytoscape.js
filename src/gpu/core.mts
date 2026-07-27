import { GraphStore } from './store/graph-store.mjs';
import { GpuCollection } from './collection.mjs';
import { isColumnarElements } from './columnar.mjs';
import { deserializeElements, isSerializedElements, serializeElements } from './wire.mjs';
import { partitionDefs } from './element-defs.mjs';
import { hasListeners, makeCoreEmitter, predicateQualifier } from './events.mjs';
import type { ElePredicate, GpuQualifier } from './events.mjs';
import { compileQuery } from './matcher.mjs';
import type { FlagTest, GpuQuery } from './matcher.mjs';
import { testCondition } from './style-scales.mjs';
import type { CompiledCondition } from './style-scales.mjs';
import { Viewport } from './viewport.mjs';
import { StyleEngine } from './style.mjs';
import { Animation, AnimationManager } from './animation.mjs';
import type { AnimateOptions, AnimationHandle } from './animation.mjs';
import * as math from '../math.mjs';
import type { BoundsLike } from './viewport.mjs';
import { GridLayout } from './layout/grid.mjs';
import { PresetLayout } from './layout/preset.mjs';
import { CircleLayout } from './layout/circle.mjs';
import { ConcentricLayout } from './layout/concentric.mjs';
import { BreadthFirstLayout } from './layout/breadthfirst.mjs';
import { RandomLayout } from './layout/random.mjs';

export type GpuLayout =
  GridLayout | PresetLayout | CircleLayout | ConcentricLayout | BreadthFirstLayout | RandomLayout;
import type Emitter from '../emitter.mjs';
import type { EventHandler } from '../emitter.mjs';
import type Event from '../event.mjs';
import type { EventProps } from '../event.mjs';
import { FLAG_SELECTABLE, FLAG_SELECTED } from './contract.mjs';
import type { GroupName, Ref } from './contract.mjs';
import type {
  CytoscapeGpuOptions, GpuColumnarElements, GpuElementDefinition, GpuElementsDefinition,
  GpuElementsInput, GpuExportOptions, GpuLayoutOptions, GpuStylesheet, Position
} from './gpu-types.mjs';
import type { EleFilterFn } from './collection.mjs';

/** What the core needs from the renderer (wired by the factory). */
export interface RendererLike {
  destroy(): void;
  pick( x: number, y: number ): Promise<GpuCollection | null>;
  requestRender(): void;
  resize(): void;
  exportImage( options: GpuExportOptions ): Promise<{ data: Uint8ClampedArray<ArrayBuffer>; width: number; height: number }>;
}

export interface LayoutLike {
  run(): LayoutLike;
}

const DEFAULT_HEADLESS_WIDTH = 800;
const DEFAULT_HEADLESS_HEIGHT = 600;

/** Style work deferred by an open batch (flushed once at the outermost endBatch). */
interface BatchPending {
  /** the sheet changed during the batch: one applyAll() subsumes the per-slot work */
  sheet: boolean;
  /** freshly-added elements awaiting their first style apply */
  style: Ref[];
  /** elements whose data()-mapped style channels need re-deriving */
  mapped: Ref[];
  /** the data keys those writes touched (refresh gates per group on them) */
  mappedKeys: Set<string>;
}

/**
 * The GpuCore facade: the familiar synchronous core API over the columnar
 * store.  Scope (pass 1 of #3486): viewport fns, events, graph manipulation
 * and the grid layout; no animations, no compound nodes, no `data()`.
 */
export class GpuCore {
  _store: GraphStore;
  _emitter: Emitter<GpuCore, GpuQualifier>;
  _styleEngine: StyleEngine;
  _renderer: RendererLike | null;
  _viewport: Viewport;

  /** resolves once the render pipeline is usable (immediately when headless) */
  ready: Promise<GpuCore>;

  /** true once the render pipeline is usable (immediately when headless) */
  _readyResolved: boolean;

  /** interned singleton handles, dense by slot (slots are dense, so an array beats a Map) */
  _pool: { nodes: ( GpuCollection | undefined )[]; edges: ( GpuCollection | undefined )[] };
  private _container: HTMLElement | null;
  private _options: CytoscapeGpuOptions;
  private _headlessWidth: number;
  private _headlessHeight: number;
  private _destroyed: boolean;
  private _idCounter: number;
  private _scratch: Record<string, unknown>;
  private _graphData: Record<string, unknown>;
  private _autolock: boolean;
  private _autoungrabify: boolean;
  private _autounselectify: boolean;
  private _panningEnabled: boolean;
  private _userPanningEnabled: boolean;
  private _zoomingEnabled: boolean;
  private _userZoomingEnabled: boolean;
  private _boxSelectionEnabled: boolean;
  private _selectionType: 'single' | 'additive';
  private _multiClickDebounceTime: number;
  private _batchDepth: number;
  private _batchPending: BatchPending | null;
  _animations: AnimationManager;

  constructor( options: CytoscapeGpuOptions = {} ){
    this._store = new GraphStore();
    this._emitter = makeCoreEmitter<GpuCore>( this );
    this._styleEngine = new StyleEngine( this._store );
    this._animations = new AnimationManager( () => this._afterAnimationTick() );
    this._renderer = null;
    this._pool = { nodes: [], edges: [] };
    this._container = options.container ?? null;
    this._options = options;
    this._headlessWidth = options.headlessWidth ?? DEFAULT_HEADLESS_WIDTH;
    this._headlessHeight = options.headlessHeight ?? DEFAULT_HEADLESS_HEIGHT;
    this._destroyed = false;
    this._idCounter = 0;
    this._scratch = {};
    this._graphData = {};
    this._autolock = options.autolock ?? false;
    this._autoungrabify = options.autoungrabify ?? false;
    this._autounselectify = options.autounselectify ?? false;
    this._panningEnabled = options.panningEnabled ?? true;
    this._userPanningEnabled = options.userPanningEnabled ?? true;
    this._zoomingEnabled = options.zoomingEnabled ?? true;
    this._userZoomingEnabled = options.userZoomingEnabled ?? true;
    this._boxSelectionEnabled = options.boxSelectionEnabled ?? true;
    this._selectionType = 'single';
    this._multiClickDebounceTime = 250; // v3's default
    this._batchDepth = 0;
    this._batchPending = null;

    if( options.selectionType != null ){
      this.selectionType( options.selectionType );
    }

    if( options.multiClickDebounceTime != null ){
      this.multiClickDebounceTime( options.multiClickDebounceTime );
    }
    this._readyResolved = this._container == null; // headless is ready immediately
    this._viewport = new Viewport( this, {
      zoom: options.zoom,
      pan: options.pan,
      minZoom: options.minZoom,
      maxZoom: options.maxZoom
    } );
    this.ready = Promise.resolve( this );

    if( options.style != null ){
      this._styleEngine.setSheet( options.style );
    }
  }

  // -- style --

  style( sheet?: GpuStylesheet ): StyleEngine {
    if( sheet != null ){
      if( this._batchPending != null ){
        // compile (and validate) now; apply once at the outermost endBatch
        this._styleEngine.setSheet( sheet, false );
        this._batchPending.sheet = true;
      } else {
        this._styleEngine.setSheet( sheet );
      }

      this.emit( 'style' );
    }

    return this._styleEngine;
  }

  // -- batching --

  /*
  Batch semantics (as in v3): a batch defers *style application* — the
  first style apply of added elements, sheet re-application, and
  data-mapped label refresh — until the outermost endBatch(), where the
  deferred work flushes as one bulk pass.  Events still fire during the
  batch, and reads of style-derived state (width(), label(), ...) may be
  stale inside it.  Renderer scheduling needs no deferral: the dirty
  tracker already coalesces per microtask, after the batch's synchronous
  block.
  */

  /** True while inside a startBatch()/endBatch() pair. */
  batching(): boolean {
    return this._batchDepth > 0;
  }

  startBatch(): this {
    if( this._batchDepth === 0 ){
      this._batchPending = { sheet: false, style: [], mapped: [], mappedKeys: new Set() };
    }

    this._batchDepth++;

    return this;
  }

  endBatch(): this {
    if( this._batchDepth === 0 ){ return this; }

    this._batchDepth--;

    if( this._batchDepth > 0 ){ return this; }

    const pending = this._batchPending as BatchPending;

    this._batchPending = null;

    if( pending.sheet ){
      this._styleEngine.applyAll(); // covers every live element, so the per-slot work is subsumed

      return this;
    }

    const store = this._store;
    const nodeSlots: number[] = [];
    const edgeSlots: number[] = [];

    for( const ref of pending.style ){
      if( !store.isCurrent( ref ) ){ continue; } // added then removed within the batch

      ( ref.group === 'nodes' ? nodeSlots : edgeSlots ).push( ref.slot );
    }

    this._styleEngine.applyBulk( 'nodes', nodeSlots );
    this._styleEngine.applyBulk( 'edges', edgeSlots );

    const mappedNodes: number[] = [];
    const mappedEdges: number[] = [];

    for( const ref of pending.mapped ){
      if( !store.isCurrent( ref ) ){ continue; }

      ( ref.group === 'nodes' ? mappedNodes : mappedEdges ).push( ref.slot );
    }

    const keys = [ ...pending.mappedKeys ];

    this._styleEngine.refreshMapped( 'nodes', mappedNodes, keys );
    this._styleEngine.refreshMapped( 'edges', mappedEdges, keys );

    return this;
  }

  batch( fn: () => void ): this {
    this.startBatch();

    try {
      fn();
    } finally {
      this.endBatch();
    }

    return this;
  }

  /** v3 compat: per-id data() patches applied in one batch. */
  batchData( map: Record<string, Record<string, unknown>> ): this {
    return this.batch( () => {
      for( const id of Object.keys( map ) ){
        this.getElementById( id ).data( map[ id ] );
      }
    } );
  }

  // -- layout --

  layout( options: GpuLayoutOptions ): GpuLayout {
    if( options?.name === 'grid' ){ return new GridLayout( this, options ); }
    if( options?.name === 'preset' ){ return new PresetLayout( this, options ); }
    if( options?.name === 'circle' ){ return new CircleLayout( this, options ); }
    if( options?.name === 'concentric' ){ return new ConcentricLayout( this, options ); }
    if( options?.name === 'breadthfirst' ){ return new BreadthFirstLayout( this, options ); }
    if( options?.name === 'random' ){ return new RandomLayout( this, options ); }

    const got = ( options as { name?: string } | null )?.name;

    throw new Error(
      `Only the 'grid', 'preset', 'circle', 'concentric', 'breadthfirst' and 'random' ` +
      `layouts are available in the GPU prototype` +
      ( got != null ? `; got '${got}'` : '' )
    );
  }

  declare makeLayout: this['layout'];
  declare createLayout: this['layout'];

  // -- graph manipulation --

  add( input: GpuElementsInput ): GpuCollection {
    const defs = isSerializedElements( input ) ? deserializeElements( input ) : input;
    const refs = isColumnarElements( defs )
      ? this._columnarRefs( this._addColumnar( defs ) )
      : this._addDefs( defs );
    const added = new GpuCollection( this, refs, { unique: true } );

    if( this._hasListeners( 'add' ) ){
      for( let i = 0; i < added.length; i++ ){
        this._emitOnEle( 'add', added[ i ] );
      }
    }

    return added;
  }

  /**
   * Bulk load path (the factory's `options.elements`): adds without
   * materializing per-element handles or a return collection — on a
   * 500k-element load the handle layer costs more than the model writes
   * and the caller uses none of it.  `add` events still fire per element
   * when anyone is listening (never the case at construction time).
   */
  _bulkAdd( input: GpuElementsInput ): void {
    const defs = isSerializedElements( input ) ? deserializeElements( input ) : input;

    if( isColumnarElements( defs ) ){
      const { nodeSlots, edgeSlots } = this._addColumnar( defs );

      if( this._hasListeners( 'add' ) ){
        for( const slot of nodeSlots ){ this._emitOnEle( 'add', this._ele( 'nodes', slot ) ); }
        for( const slot of edgeSlots ){ this._emitOnEle( 'add', this._ele( 'edges', slot ) ); }
      }

      return;
    }

    const refs = this._addDefs( defs );

    if( this._hasListeners( 'add' ) ){
      for( const ref of refs ){
        this._emitOnEle( 'add', this._eleFromRef( ref ) );
      }
    }
  }

  /** Columnar ingest: store-level bulk adds + one bulk style pass. */
  private _addColumnar( elements: GpuColumnarElements ): { nodeSlots: Uint32Array; edgeSlots: Uint32Array } {
    const newId = (): string => this._newId();
    const nodeSlots = elements.nodes != null && elements.nodes.count > 0
      ? this._store.addNodesColumnar( elements.nodes, newId )
      : new Uint32Array( 0 );
    const edgeSlots = elements.edges != null && elements.edges.count > 0
      ? this._store.addEdgesColumnar( elements.edges, nodeSlots, newId )
      : new Uint32Array( 0 );

    this._applyStyle( 'nodes', nodeSlots );
    this._applyStyle( 'edges', edgeSlots );

    return { nodeSlots, edgeSlots };
  }

  private _columnarRefs( { nodeSlots, edgeSlots }: { nodeSlots: Uint32Array; edgeSlots: Uint32Array } ): Ref[] {
    const refs: Ref[] = [];

    for( const slot of nodeSlots ){ refs.push( this._store.ref( 'nodes', slot ) ); }
    for( const slot of edgeSlots ){ refs.push( this._store.ref( 'edges', slot ) ); }

    return refs;
  }

  /** Shared add loop: nodes first so edges can reference same-call nodes. */
  private _addDefs( defs: GpuElementsDefinition | GpuElementDefinition ): Ref[] {
    const { nodes: nodeDefs, edges: edgeDefs } = partitionDefs( defs );

    this._store.reserve( nodeDefs.length, edgeDefs.length );

    const refs: Ref[] = [];
    const nodeSlots: number[] = [];
    const edgeSlots: number[] = [];

    for( const def of nodeDefs ){
      const data = def.data ?? {};
      const id = data.id != null ? String( data.id ) : this._newId();
      const pos = def.position ?? { x: 0, y: 0 };
      const slot = this._store.addNode( id, pos.x, pos.y, def );

      this._store.setDefData( 'nodes', slot, data );
      nodeSlots.push( slot );
      refs.push( this._store.ref( 'nodes', slot ) );
    }

    for( const def of edgeDefs ){
      const data = def.data ?? {};
      const id = data.id != null ? String( data.id ) : this._newId();

      if( data.source == null || data.target == null ){
        throw new Error( `Can not create edge '${id}' without a source and target` );
      }

      const slot = this._store.addEdge( id, String( data.source ), String( data.target ), def );

      this._store.setDefData( 'edges', slot, data );
      edgeSlots.push( slot );
      refs.push( this._store.ref( 'edges', slot ) );
    }

    this._applyStyle( 'nodes', nodeSlots );
    this._applyStyle( 'edges', edgeSlots );

    return refs;
  }

  remove( eles: GpuCollection ): GpuCollection {
    return eles.remove();
  }

  // -- collections --

  collection(): GpuCollection {
    return new GpuCollection( this, [] );
  }

  getElementById( id: string ): GpuCollection {
    const ref = this._store.lookup( id );

    return ref == null ? this.collection() : this._ele( ref.group, ref.slot );
  }

  elements( query?: GpuQuery | EleFilterFn ): GpuCollection {
    return this._query( query, null );
  }

  nodes( query?: GpuQuery | EleFilterFn ): GpuCollection {
    return this._query( query, 'nodes' );
  }

  edges( query?: GpuQuery | EleFilterFn ): GpuCollection {
    return this._query( query, 'edges' );
  }

  filter( query: GpuQuery | EleFilterFn ): GpuCollection {
    return this._query( query, null );
  }

  /**
   * Resolve a whole-graph query.  Structured queries compile to per-group
   * (mask, want) flag tests answered by one columnar scan — no element
   * handles, no per-element matching.  Predicate functions materialize
   * the group(s) and filter per element.  `restrict` narrows the result
   * to one group (for `cy.nodes(q)` / `cy.edges(q)`).
   */
  private _query( query: GpuQuery | EleFilterFn | undefined, restrict: GroupName | null ): GpuCollection {
    if( typeof query === 'function' ){
      return this._query( undefined, restrict ).filter( query );
    }

    const plan = compileQuery( query ?? {}, restrict );

    return this._scanCollection( plan.nodes, plan.edges, plan.data );
  }

  /**
   * Live, visible elements contained in the model-coordinate box (corners
   * in any order): the box-selection query, answered by one columnar
   * scan.  Nodes count when their bounding box lies fully inside; edges
   * when both endpoint node centers do (v3's default 'contain'
   * semantics, with straight-edge endpoints taken at the node centers).
   */
  elementsInBox( x1: number, y1: number, x2: number, y2: number ): GpuCollection {
    return new GpuCollection( this, this._store.refsInBox( x1, y1, x2, y2 ), { unique: true, live: true } );
  }

  /** Collection of the live slots matching per-group flag tests (null matches nothing). */
  private _scanCollection(
    nodeTest: FlagTest | null, edgeTest: FlagTest | null,
    dataConds: CompiledCondition[] | null = null
  ): GpuCollection {
    const store = this._store;
    const cap = ( nodeTest == null ? 0 : store.count( 'nodes' ) )
      + ( edgeTest == null ? 0 : store.count( 'edges' ) );
    const refs: Ref[] = new Array( cap );
    const dataTests = dataConds == null
      ? undefined
      : dataConds.map( cond => ( { key: cond.key, test: ( v: unknown ) => testCondition( cond, v ) } ) );
    let n = 0;

    if( nodeTest != null ){ n = store.scanRefsInto( refs, n, 'nodes', nodeTest.mask, nodeTest.want, dataTests ); }
    if( edgeTest != null ){ n = store.scanRefsInto( refs, n, 'edges', edgeTest.mask, edgeTest.want, dataTests ); }

    if( n !== refs.length ){ refs.length = n; }

    return new GpuCollection( this, refs, { unique: true, live: true } );
  }

  // -- events --

  // Delegation is predicate-based (no selector strings): with a trailing
  // callback, the middle argument is a predicate over the event target,
  // e.g. `cy.on('tap', ele => ele.isNode(), cb)`.  Predicates compare by
  // function identity in off().
  on( events: string, predicateOrCb?: ElePredicate | EventHandler, callback?: EventHandler ): this {
    if( callback != null ){
      this._emitter.on( events, predicateQualifier( predicateOrCb as ElePredicate ), callback );
    } else {
      this._emitter.on( events, null, predicateOrCb as EventHandler | undefined );
    }

    return this;
  }

  declare addListener: this['on'];

  declare listen: this['on'];
  declare bind: this['on'];

  one( events: string, predicateOrCb?: ElePredicate | EventHandler, callback?: EventHandler ): this {
    if( callback != null ){
      this._emitter.one( events, predicateQualifier( predicateOrCb as ElePredicate ), callback );
    } else {
      this._emitter.one( events, null, predicateOrCb as EventHandler | undefined );
    }

    return this;
  }

  declare once: this['one'];

  off( events: string, predicateOrCb?: ElePredicate | EventHandler, callback?: EventHandler ): this {
    if( callback != null ){
      this._emitter.off( events, predicateQualifier( predicateOrCb as ElePredicate ), callback );
    } else {
      this._emitter.off( events, null, predicateOrCb as EventHandler | undefined );
    }

    return this;
  }

  declare removeListener: this['off'];
  declare unlisten: this['off'];
  declare unbind: this['off'];

  removeAllListeners(): this {
    this._emitter.removeAllListeners();

    return this;
  }

  emit( events: string | EventProps, extraParams?: unknown[] ): this {
    this._emitter.emit( events, extraParams );

    return this;
  }

  declare trigger: this['emit'];

  promiseOn( events: string, predicate?: ElePredicate ): Promise<Event> {
    return new Promise( resolve => {
      if( predicate != null ){
        this.one( events, predicate, event => resolve( event ) );
      } else {
        this.one( events, ( event: Event ) => resolve( event ) );
      }
    } );
  }

  declare pon: this['promiseOn'];

  // -- viewport --

  zoom( zoom?: number | Parameters<Viewport['setZoom']>[0] ): number | this {
    if( zoom === undefined ){
      return this._viewport.zoom();
    }

    if( this._zoomingEnabled && this._viewport.setZoom( zoom ) ){
      this._emitViewportEvents( [ 'zoom' ] );
    }

    return this;
  }

  pan( pan?: Position ): Position | this {
    if( pan === undefined ){
      return this._viewport.pan();
    }

    if( this._panningEnabled && this._viewport.setPan( pan ) ){
      this._emitViewportEvents( [ 'pan' ] );
    }

    return this;
  }

  panBy( delta: Position ): this {
    if( this._panningEnabled && this._viewport.panBy( delta ) ){
      this._emitViewportEvents( [ 'pan' ] );
    }

    return this;
  }

  fit( eles?: GpuCollection, padding: number = 0 ): this {
    const bb = this._boundsOf( eles );

    if( bb == null ){ return this; }

    this._viewport.fit( bb, padding );
    this._emitViewportEvents( [ 'zoom', 'pan', 'fit' ] );

    return this;
  }

  center( eles?: GpuCollection ): this {
    const bb = this._boundsOf( eles );

    if( bb == null ){ return this; }

    if( this._viewport.centerOn( bb ) ){
      this._emitViewportEvents( [ 'pan' ] );
    }

    return this;
  }

  declare centre: this['center'];

  // -- animation (viewport) --

  /**
   * Animate the viewport (`pan`/`zoom`) over `duration` ms.  Element
   * animation is on the collection (`eles.animate`).  Tweens are
   * CPU-canonical; a data write / manual pan mid-animation is not
   * prevented but will be overwritten by the next tick.
   */
  animate( opts: AnimateOptions ): this {
    if( opts.fit == null && opts.center == null ){
      if( opts.pan != null && !this._panningEnabled ){ return this; }
      if( opts.zoom != null && !this._zoomingEnabled ){ return this; }
    }

    this._animations.enqueue(
      new Animation( this._store, this._viewport, [], true, this._resolveViewportTargets( opts ) ) );

    return this;
  }

  /**
   * Like `animate`, but returns a handle with `play`/`stop`/`promise` —
   * the viewport counterpart of `eles.animation`.
   */
  animation( opts: AnimateOptions ): AnimationHandle {
    const ani = new Animation( this._store, this._viewport, [], true, this._resolveViewportTargets( opts ) );

    return {
      play: () => { this._animations.enqueue( ani ); return ani.promise(); },
      stop: ( jumpToEnd = false ) => ani.stop( jumpToEnd ),
      promise: () => ani.promise(),
      playing: () => ani.running
    };
  }

  /** Resolve `fit`/`center` targets to concrete pan/zoom at creation time, as v3 does. */
  private _resolveViewportTargets( opts: AnimateOptions ): AnimateOptions {
    if( opts.fit != null ){
      const fit = opts.fit;
      const padding = fit.padding ?? 0;
      const fv = fit.boundingBox != null
        ? this._viewport.fitViewport( math.makeBoundingBox( fit.boundingBox ) as BoundsLike, padding )
        : this.getFitViewport( fit.eles as GpuCollection | undefined, padding );

      if( fv != null ){ return { ...opts, pan: fv.pan, zoom: fv.zoom }; }
    } else if( opts.center != null ){
      const pan = this.getCenterPan( opts.center.eles as GpuCollection | undefined );

      if( pan != null ){ return { ...opts, pan }; }
    }

    return opts;
  }

  /** True while the viewport is animating. */
  animated(): boolean {
    return this._animations.isViewportAnimating();
  }

  /** Stop the viewport animation. */
  stop( clearQueue: boolean = true, jumpToEnd: boolean = false ): this {
    this._animations.stopViewport( clearQueue, jumpToEnd );

    return this;
  }

  /** Called after each animation tick: redraw, and emit viewport events while it pans/zooms. */
  private _afterAnimationTick(): void {
    if( this._animations.isViewportAnimating() ){
      this._emitViewportEvents( [ 'pan', 'zoom', 'viewport' ] );
    }

    this._renderer?.requestRender();
  }

  extent(): ReturnType<Viewport['extent']> {
    return this._viewport.extent();
  }

  /** The rendered (on-screen) viewport rectangle. */
  renderedExtent(): ReturnType<Viewport['renderedExtent']> {
    return this._viewport.renderedExtent();
  }

  /** Rendered dimensions as { width, height }. */
  size(): { width: number; height: number } {
    return { width: this.width(), height: this.height() };
  }

  minZoom( zoom?: number ): number | this {
    if( zoom === undefined ){ return this._viewport.minZoom; }

    if( this._viewport.setMinZoom( zoom ) ){ this._emitViewportEvents( [ 'zoom' ] ); }

    return this;
  }

  maxZoom( zoom?: number ): number | this {
    if( zoom === undefined ){ return this._viewport.maxZoom; }

    if( this._viewport.setMaxZoom( zoom ) ){ this._emitViewportEvents( [ 'zoom' ] ); }

    return this;
  }

  /** Set both zoom bounds; accepts (min, max) or { min, max }. */
  zoomRange( min: number | { min?: number; max?: number }, max?: number ): this {
    const lo = typeof min === 'object' ? min.min : min;
    const hi = typeof min === 'object' ? min.max : max;
    let changed = false;

    if( lo != null && this._viewport.setMinZoom( lo ) ){ changed = true; }
    if( hi != null && this._viewport.setMaxZoom( hi ) ){ changed = true; }

    if( changed ){ this._emitViewportEvents( [ 'zoom' ] ); }

    return this;
  }

  /** Set zoom and/or pan together, emitting once. */
  viewport( opts: { zoom?: number; pan?: Position } ): this {
    const events: string[] = [];

    if( opts.zoom != null && this._viewport.setZoom( opts.zoom ) ){ events.push( 'zoom' ); }
    if( opts.pan != null && this._viewport.setPan( opts.pan ) ){ events.push( 'pan' ); }

    if( events.length > 0 ){ this._emitViewportEvents( events ); }

    return this;
  }

  /** Reset the viewport to zoom 1, pan (0, 0). */
  reset(): this {
    return this.viewport( { zoom: 1, pan: { x: 0, y: 0 } } );
  }

  /** The { zoom, pan } that would fit the given elements (null when empty) — computed, not applied. */
  getFitViewport( eles?: GpuCollection, padding: number = 0 ): { zoom: number; pan: Position } | null {
    const bb = this._boundsOf( eles );

    return bb == null ? null : this._viewport.fitViewport( bb, padding );
  }

  /** The pan that would center the given elements at `zoom` (null when empty). */
  getCenterPan( eles?: GpuCollection, zoom?: number ): Position | null {
    const bb = this._boundsOf( eles );

    return bb == null ? null : this._viewport.centerPan( bb, zoom );
  }

  /**
   * Async GPU pick at a rendered (CSS px) position; resolves with the
   * element under the point or null (always null when headless).
   */
  pick( x: number, y: number ): Promise<GpuCollection | null> {
    return this._renderer != null ? this._renderer.pick( x, y ) : Promise.resolve( null );
  }

  // -- renderer --

  renderer(): RendererLike | null {
    return this._renderer;
  }

  /** Force a redraw next frame (no-op when headless; the loop is render-on-dirty). */
  forceRender(): this {
    this._renderer?.requestRender();

    return this;
  }

  /** Re-measure the container and redraw (no-op when headless). */
  resize(): this {
    this._renderer?.resize();
    this.emit( 'resize' );

    return this;
  }

  declare invalidateSize: this['resize'];

  onRender( callback: EventHandler ): this {
    return this.on( 'render', callback );
  }

  offRender( callback?: EventHandler ): this {
    return this.off( 'render', callback );
  }

  // -- image export --

  /**
   * Export the rendered graph as a PNG.  Async — the pixels live on the
   * GPU (offscreen render + readback), unlike v3's synchronous base64
   * form; every output form resolves through the returned promise.
   * Options as in v3: `bg`, `full`, `scale` or `maxWidth`/`maxHeight`,
   * `output` ('base64uri' default | 'base64' | 'blob'; 'blob-promise' is
   * an accepted alias of 'blob').  Headless instances reject — there is
   * no renderer to export from.
   */
  png( options: GpuExportOptions = {} ): Promise<string | Blob> {
    return this._exportImage( 'image/png', options );
  }

  /** Export as JPEG: as {@link png}, plus `quality` (0..1) and a white
   * default `bg` (JPEG has no alpha channel). */
  jpg( options: GpuExportOptions = {} ): Promise<string | Blob> {
    return this._exportImage( 'image/jpeg', { bg: '#fff', ...options } );
  }

  declare jpeg: this['jpg'];

  private async _exportImage( mime: string, options: GpuExportOptions ): Promise<string | Blob> {
    const output = options.output ?? 'base64uri';

    if( output !== 'base64uri' && output !== 'base64' && output !== 'blob' && output !== 'blob-promise' ){
      throw new Error(
        `Invalid image export output '${String( output )}'; use 'base64uri', 'base64' or 'blob'`
      );
    }

    if( this._renderer == null ){
      throw new Error( 'An image can only be exported from a rendered instance; this instance is headless' );
    }

    const { data, width, height } = await this._renderer.exportImage( options );
    const doc = ( this._container as HTMLElement ).ownerDocument as Document;
    const canvas = doc.createElement( 'canvas' );

    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext( '2d' ) as CanvasRenderingContext2D;

    context.putImageData( new ImageData( data, width, height ), 0, 0 );

    const quality = options.quality;

    if( output === 'blob' || output === 'blob-promise' ){
      return new Promise( ( resolve, reject ) => {
        canvas.toBlob(
          blob => blob != null
            ? resolve( blob )
            : reject( new Error( `Could not encode the exported image as ${mime}` ) ),
          mime, quality
        );
      } );
    }

    const uri = canvas.toDataURL( mime, quality );

    return output === 'base64' ? uri.substring( uri.indexOf( ',' ) + 1 ) : uri;
  }

  // -- graph-level data & scratch (plain objects, not columns) --

  data( ...args: [] | [ string ] | [ string, unknown ] | [ Record<string, unknown> ] ): unknown {
    return this._objectAccess( this._graphData, args, 'data' );
  }

  removeData( names?: string ): this {
    return this._objectRemove( this._graphData, names, 'data' );
  }

  declare attr: this['data'];
  declare removeAttr: this['removeData'];

  scratch( ...args: [] | [ string ] | [ string, unknown ] | [ Record<string, unknown> ] ): unknown {
    return this._objectAccess( this._scratch, args, null );
  }

  removeScratch( names?: string ): this {
    return this._objectRemove( this._scratch, names, null );
  }

  private _objectAccess(
    target: Record<string, unknown>,
    args: [] | [ string ] | [ string, unknown ] | [ Record<string, unknown> ],
    event: string | null
  ): unknown {
    const [ key, value ] = args;

    if( args.length === 0 ){ return target; }
    if( typeof key === 'string' && args.length === 1 ){ return target[ key ]; }

    const patch: Record<string, unknown> = typeof key === 'string' ? { [ key ]: value } : key as Record<string, unknown>;

    Object.assign( target, patch );

    if( event != null ){ this.emit( event ); }

    return this;
  }

  private _objectRemove( target: Record<string, unknown>, names: string | undefined, event: string | null ): this {
    const keys = names == null ? Object.keys( target ) : names.split( /\s+/ ).filter( n => n !== '' );

    for( const k of keys ){ delete target[ k ]; }

    if( event != null && keys.length > 0 ){ this.emit( event ); }

    return this;
  }

  // -- interaction gating --

  autolock( bool?: boolean ): boolean | this {
    if( bool === undefined ){ return this._autolock; }

    this._autolock = bool;

    return this;
  }

  autoungrabify( bool?: boolean ): boolean | this {
    if( bool === undefined ){ return this._autoungrabify; }

    this._autoungrabify = bool;

    return this;
  }

  autounselectify( bool?: boolean ): boolean | this {
    if( bool === undefined ){ return this._autounselectify; }

    this._autounselectify = bool;

    return this;
  }

  declare autolockNodes: this['autolock'];
  declare autoungrabifyNodes: this['autoungrabify'];

  panningEnabled( bool?: boolean ): boolean | this {
    if( bool === undefined ){ return this._panningEnabled; }

    this._panningEnabled = bool;

    return this;
  }

  userPanningEnabled( bool?: boolean ): boolean | this {
    if( bool === undefined ){ return this._userPanningEnabled; }

    this._userPanningEnabled = bool;

    return this;
  }

  zoomingEnabled( bool?: boolean ): boolean | this {
    if( bool === undefined ){ return this._zoomingEnabled; }

    this._zoomingEnabled = bool;

    return this;
  }

  userZoomingEnabled( bool?: boolean ): boolean | this {
    if( bool === undefined ){ return this._userZoomingEnabled; }

    this._userZoomingEnabled = bool;

    return this;
  }

  boxSelectionEnabled( bool?: boolean ): boolean | this {
    if( bool === undefined ){ return this._boxSelectionEnabled; }

    this._boxSelectionEnabled = bool;

    return this;
  }

  /**
   * How user selection composes: 'single' (a tap or box replaces the
   * selection) or 'additive' (taps toggle and boxes add, as if a
   * multiple-select key were always held).
   */
  selectionType( type?: 'single' | 'additive' ): ( 'single' | 'additive' ) | this {
    if( type === undefined ){ return this._selectionType; }

    if( type !== 'single' && type !== 'additive' ){
      throw new Error( `Invalid selection type '${String( type )}'; use 'single' or 'additive'` );
    }

    this._selectionType = type;

    return this;
  }
  /** The dbltap/onetap debounce window in ms (v3 parity; default 250). */
  multiClickDebounceTime( ms?: number ): number | this {
    if( ms === undefined ){ return this._multiClickDebounceTime; }

    if( typeof ms !== 'number' || !isFinite( ms ) || ms < 0 ){
      throw new Error( `multiClickDebounceTime must be a non-negative number; got '${String( ms )}'` );
    }

    this._multiClickDebounceTime = ms;

    return this;
  }


  // -- environment --

  instanceString(): string {
    return 'core';
  }

  isReady(): boolean {
    return this._readyResolved;
  }

  headless(): boolean {
    return this._container == null;
  }

  styleEnabled(): boolean {
    return true;
  }

  hasCompoundNodes(): boolean {
    return false;
  }

  hasElementWithId( id: string ): boolean {
    return this._store.lookup( id ) != null;
  }

  declare $id: this['getElementById'];

  /** All elements (the prototype has no immutable/"read-only" collections). */
  mutableElements(): GpuCollection {
    return this.elements();
  }

  window(): ( Window & typeof globalThis ) | null {
    return typeof window !== 'undefined' ? window : null;
  }

  /** The options the instance was constructed with. */
  options(): CytoscapeGpuOptions {
    return this._options;
  }

  /**
   * Export the graph as a plain object (elements, stylesheet, viewport,
   * gating flags, graph-level data).  `json(true)` exports elements as one
   * flat array instead of `{ nodes, edges }` (as in v3).  The v3 import/
   * restore form (`json(obj)`) is not supported — rebuilding from a
   * snapshot needs stored defs, which the prototype does not keep.
   */
  /**
   * Export the live graph as the binary wire format (the buffer
   * `options.elements`/`add()` accept directly): the columnar counterpart
   * of `json()`.  Carries ids, positions, selection state and the data()
   * sidecar; style, viewport and scratch are not part of the wire.
   */
  serialize(): ArrayBuffer {
    const store = this._store;
    const nodeSlots = store.slotsOrdered( 'nodes' );
    const edgeSlots = store.slotsOrdered( 'edges' );
    const pos = store.column( 'node.position' ) as Float32Array;
    const nodeFlags = store.column( 'node.flags' ) as Uint32Array;
    const edgeFlags = store.column( 'edge.flags' ) as Uint32Array;
    const endpoints = store.column( 'edge.endpoints' ) as Uint32Array;

    const nodeIds: string[] = new Array( nodeSlots.length );
    const positions = new Float32Array( nodeSlots.length * 2 );
    const nodeSelected = new Uint8Array( nodeSlots.length );
    const nodeSelectable = new Uint8Array( nodeSlots.length );
    const indexOfSlot = new Map<number, number>();

    for( let i = 0; i < nodeSlots.length; i++ ){
      const slot = nodeSlots[ i ];

      indexOfSlot.set( slot, i );
      nodeIds[ i ] = store.idAt( 'nodes', slot ) as string;
      positions[ i * 2 ] = pos[ slot * 2 ];
      positions[ i * 2 + 1 ] = pos[ slot * 2 + 1 ];
      nodeSelected[ i ] = ( nodeFlags[ slot ] & FLAG_SELECTED ) !== 0 ? 1 : 0;
      nodeSelectable[ i ] = ( nodeFlags[ slot ] & FLAG_SELECTABLE ) !== 0 ? 1 : 0;
    }

    const edgeIds: string[] = new Array( edgeSlots.length );
    const sources = new Uint32Array( edgeSlots.length );
    const targets = new Uint32Array( edgeSlots.length );
    const edgeSelected = new Uint8Array( edgeSlots.length );
    const edgeSelectable = new Uint8Array( edgeSlots.length );

    for( let i = 0; i < edgeSlots.length; i++ ){
      const slot = edgeSlots[ i ];

      edgeIds[ i ] = store.idAt( 'edges', slot ) as string;
      sources[ i ] = indexOfSlot.get( endpoints[ slot * 2 ] ) as number;
      targets[ i ] = indexOfSlot.get( endpoints[ slot * 2 + 1 ] ) as number;
      edgeSelected[ i ] = ( edgeFlags[ slot ] & FLAG_SELECTED ) !== 0 ? 1 : 0;
      edgeSelectable[ i ] = ( edgeFlags[ slot ] & FLAG_SELECTABLE ) !== 0 ? 1 : 0;
    }

    return serializeElements( {
      columnar: true,
      nodes: {
        count: nodeSlots.length,
        ids: nodeIds,
        positions,
        selected: nodeSelected,
        selectable: nodeSelectable,
        data: store.data.exportColumns( 'nodes', nodeSlots )
      },
      edges: {
        count: edgeSlots.length,
        ids: edgeIds,
        sources,
        targets,
        selected: edgeSelected,
        selectable: edgeSelectable,
        data: store.data.exportColumns( 'edges', edgeSlots )
      }
    } );
  }

  json( flat?: boolean ): Record<string, unknown> {
    if( flat != null && typeof flat !== 'boolean' ){
      throw new Error(
        'cy.json() is export-only in the GPU prototype; the import/restore form is not supported'
      );
    }

    const elements = flat === true
      ? this.elements().jsons()
      : { nodes: this.nodes().jsons(), edges: this.edges().jsons() };

    return {
      elements,
      style: this._styleEngine.json(),
      data: { ...this._graphData },
      zoom: this._viewport.zoom(),
      pan: { ...( this._viewport.pan() as Position ) },
      minZoom: this._viewport.minZoom,
      maxZoom: this._viewport.maxZoom,
      zoomingEnabled: this._zoomingEnabled,
      userZoomingEnabled: this._userZoomingEnabled,
      panningEnabled: this._panningEnabled,
      userPanningEnabled: this._userPanningEnabled,
      boxSelectionEnabled: this._boxSelectionEnabled,
      selectionType: this._selectionType,
      autolock: this._autolock,
      autoungrabify: this._autoungrabify,
      autounselectify: this._autounselectify,
      headless: this.headless(),
      styleEnabled: this.styleEnabled()
    };
  }

  container(): HTMLElement | null {
    return this._container;
  }

  width(): number {
    return this._container != null
      ? ( this._container.clientWidth || this._headlessWidth )
      : this._headlessWidth;
  }

  height(): number {
    return this._container != null
      ? ( this._container.clientHeight || this._headlessHeight )
      : this._headlessHeight;
  }

  destroy(): this {
    if( this._destroyed ){ return this; }

    this.emit( 'destroy' );
    this._emitter.removeAllListeners();

    if( this._renderer != null ){
      this._renderer.destroy();
      this._renderer = null;
    }

    this._destroyed = true;

    return this;
  }

  destroyed(): boolean {
    return this._destroyed;
  }

  // -- internals --

  /** Interned singleton handle for a live slot. */
  _ele( group: GroupName, slot: number ): GpuCollection {
    const pool = this._pool[ group ];
    const gen = this._store.table( group ).gen[ slot ];
    let ele = pool[ slot ];

    if( ele == null || ele._refs[0].gen !== gen ){
      ele = new GpuCollection( this, [ this._store.ref( group, slot ) ], { singleton: true } );
      pool[ slot ] = ele;
    }

    return ele;
  }

  /** Handle for a ref that may be stale (prefers the interned pre-removal handle). */
  _eleFromRef( ref: Ref ): GpuCollection {
    if( this._store.isCurrent( ref ) ){
      return this._ele( ref.group, ref.slot );
    }

    const pooled = this._pool[ ref.group ][ ref.slot ];

    if( pooled != null && pooled._refs[0].gen === ref.gen ){
      return pooled;
    }

    return new GpuCollection( this, [ ref ], { singleton: true } );
  }

  /** True when writing any of these data() keys can change the group's computed style. */
  _stylesDependOnData( group: GroupName, keys: string[] ): boolean {
    return this._styleEngine.stylesDependOnData( group, keys );
  }

  /** Refresh style channels computed from data() (mapped channels + labels), deferred while batching. */
  _refreshMappedStyles( group: GroupName, slots: number[], keys: string[] ): void {
    if( this._batchPending != null ){
      for( const slot of slots ){
        this._batchPending.mapped.push( this._store.ref( group, slot ) );
      }

      for( const key of keys ){
        this._batchPending.mappedKeys.add( key );
      }

      return;
    }

    this._styleEngine.refreshMapped( group, slots, keys );
  }

  /** First style apply for freshly-added slots, deferred while batching. */
  private _applyStyle( group: GroupName, slots: ArrayLike<number> ): void {
    if( this._batchPending != null ){
      for( let i = 0; i < slots.length; i++ ){
        this._batchPending.style.push( this._store.ref( group, slots[ i ] ) );
      }

      return;
    }

    this._styleEngine.applyBulk( group, slots );
  }

  _emitOnEle( type: string, ele: GpuCollection, extraParams?: unknown[], props?: Partial<EventProps> ): void {
    this._emitter.emit( { type, target: ele, ...props }, extraParams );
  }

  _hasListeners( type: string ): boolean {
    return hasListeners( this._emitter, type );
  }

  _emitViewportEvents( types: string[] ): void {
    for( const type of [ ...types, 'viewport' ] ){
      this.emit( type );
    }
  }

  private _boundsOf( eles?: GpuCollection ): ReturnType<GpuCollection['boundingBox']> | null {
    if( eles == null ){
      // whole-graph fast path: columnar scan in the store, skipping the
      // per-element handle layer entirely
      return this._store.boundingBox();
    }

    if( eles.length === 0 ){ return null; }

    return eles.boundingBox();
  }

  private _newId(): string {
    let id: string;

    do {
      id = 'gpu-' + this._idCounter;
      this._idCounter++;
    } while( this._store.ids.has( id ) );

    return id;
  }
}

GpuCore.prototype.centre = GpuCore.prototype.center;
GpuCore.prototype.addListener = GpuCore.prototype.on;
GpuCore.prototype.listen = GpuCore.prototype.on;
GpuCore.prototype.bind = GpuCore.prototype.on;
GpuCore.prototype.removeListener = GpuCore.prototype.off;
GpuCore.prototype.unlisten = GpuCore.prototype.off;
GpuCore.prototype.unbind = GpuCore.prototype.off;
GpuCore.prototype.once = GpuCore.prototype.one;
GpuCore.prototype.pon = GpuCore.prototype.promiseOn;
GpuCore.prototype.trigger = GpuCore.prototype.emit;
GpuCore.prototype.$id = GpuCore.prototype.getElementById;
GpuCore.prototype.makeLayout = GpuCore.prototype.layout;
GpuCore.prototype.createLayout = GpuCore.prototype.layout;
GpuCore.prototype.invalidateSize = GpuCore.prototype.resize;
GpuCore.prototype.attr = GpuCore.prototype.data;
GpuCore.prototype.removeAttr = GpuCore.prototype.removeData;
GpuCore.prototype.autolockNodes = GpuCore.prototype.autolock;
GpuCore.prototype.autoungrabifyNodes = GpuCore.prototype.autoungrabify;
GpuCore.prototype.jpeg = GpuCore.prototype.jpg;

