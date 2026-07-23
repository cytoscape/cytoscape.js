import { GraphStore } from './store/graph-store.mjs';
import { GpuCollection } from './collection.mjs';
import { hasListeners, makeCoreEmitter, selectorQualifier } from './events.mjs';
import type { GpuQualifier } from './events.mjs';
import { Viewport } from './viewport.mjs';
import { StyleEngine } from './style.mjs';
import { GridLayout } from './layout/grid.mjs';
import type Emitter from '../emitter.mjs';
import type { EventHandler } from '../emitter.mjs';
import type Event from '../event.mjs';
import type { EventProps } from '../event.mjs';
import type { GroupName, Ref } from './contract.mjs';
import type {
  CytoscapeGpuOptions, GpuElementDefinition, GpuElementsDefinition, GpuGridLayoutOptions,
  GpuStyleBlock, Position
} from './gpu-types.mjs';
import type { EleFilterFn } from './collection.mjs';

/** What the core needs from the renderer (wired by the factory). */
export interface RendererLike {
  destroy(): void;
  pick( x: number, y: number ): Promise<GpuCollection | null>;
}

export interface LayoutLike {
  run(): LayoutLike;
}

const DEFAULT_HEADLESS_WIDTH = 800;
const DEFAULT_HEADLESS_HEIGHT = 600;

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

  private _pool: { nodes: Map<number, GpuCollection>; edges: Map<number, GpuCollection> };
  private _container: HTMLElement | null;
  private _headlessWidth: number;
  private _headlessHeight: number;
  private _destroyed: boolean;
  private _idCounter: number;

  constructor( options: CytoscapeGpuOptions = {} ){
    this._store = new GraphStore();
    this._emitter = makeCoreEmitter<GpuCore>( this );
    this._styleEngine = new StyleEngine( this._store );
    this._renderer = null;
    this._pool = { nodes: new Map(), edges: new Map() };
    this._container = options.container ?? null;
    this._headlessWidth = options.headlessWidth ?? DEFAULT_HEADLESS_WIDTH;
    this._headlessHeight = options.headlessHeight ?? DEFAULT_HEADLESS_HEIGHT;
    this._destroyed = false;
    this._idCounter = 0;
    this._viewport = new Viewport( this, {
      zoom: options.zoom,
      pan: options.pan,
      minZoom: options.minZoom,
      maxZoom: options.maxZoom
    } );
    this.ready = Promise.resolve( this );

    if( options.style != null ){
      this._styleEngine.setBlocks( options.style );
    }
  }

  // -- style --

  style( blocks?: GpuStyleBlock[] ): StyleEngine {
    if( blocks != null ){
      this._styleEngine.setBlocks( blocks );
      this.emit( 'style' );
    }

    return this._styleEngine;
  }

  // -- layout --

  layout( options: GpuGridLayoutOptions ): GridLayout {
    if( options == null || options.name !== 'grid' ){
      throw new Error(
        `Only the 'grid' layout is available in the GPU prototype` +
        ( options?.name != null ? `; got '${options.name}'` : '' )
      );
    }

    return new GridLayout( this, options );
  }

  // -- graph manipulation --

  add( defs: GpuElementsDefinition | GpuElementDefinition ): GpuCollection {
    const list = normalizeDefs( defs );

    // nodes first so edges can reference nodes added in the same call
    const ordered = [
      ...list.filter( def => inferGroup( def ) === 'nodes' ),
      ...list.filter( def => inferGroup( def ) === 'edges' )
    ];

    const refs: Ref[] = [];

    for( const def of ordered ){
      const group = inferGroup( def );
      const data = def.data ?? {};
      const id = data.id != null ? String( data.id ) : this._newId();
      let slot: number;

      if( group === 'nodes' ){
        const pos = def.position ?? { x: 0, y: 0 };

        slot = this._store.addNode( id, pos.x, pos.y, def );
      } else {
        if( data.source == null || data.target == null ){
          throw new Error( `Can not create edge '${id}' without a source and target` );
        }

        slot = this._store.addEdge( id, String( data.source ), String( data.target ), def );
      }

      const ref = this._store.ref( group, slot );

      this._applyStyle( ref );
      refs.push( ref );
    }

    const added = new GpuCollection( this, refs );

    for( let i = 0; i < added.length; i++ ){
      this._emitOnEle( 'add', added[ i ] );
    }

    return added;
  }

  remove( eles: string | GpuCollection ): GpuCollection {
    return this._toCollection( eles ).remove();
  }

  // -- collections --

  collection(): GpuCollection {
    return new GpuCollection( this, [] );
  }

  getElementById( id: string ): GpuCollection {
    const ref = this._store.lookup( id );

    return ref == null ? this.collection() : this._ele( ref.group, ref.slot );
  }

  elements( selector?: string ): GpuCollection {
    const refs: Ref[] = [];

    this._store.forEachAlive( 'nodes', slot => refs.push( this._store.ref( 'nodes', slot ) ) );
    this._store.forEachAlive( 'edges', slot => refs.push( this._store.ref( 'edges', slot ) ) );

    const eles = new GpuCollection( this, refs );

    return selector == null ? eles : eles.filter( selector );
  }

  nodes( selector?: string ): GpuCollection {
    const refs: Ref[] = [];

    this._store.forEachAlive( 'nodes', slot => refs.push( this._store.ref( 'nodes', slot ) ) );

    const eles = new GpuCollection( this, refs );

    return selector == null ? eles : eles.filter( selector );
  }

  edges( selector?: string ): GpuCollection {
    const refs: Ref[] = [];

    this._store.forEachAlive( 'edges', slot => refs.push( this._store.ref( 'edges', slot ) ) );

    const eles = new GpuCollection( this, refs );

    return selector == null ? eles : eles.filter( selector );
  }

  filter( selector: string | EleFilterFn ): GpuCollection {
    return this.elements().filter( selector );
  }

  declare $: this['filter'];

  // -- events --

  on( events: string, selectorOrCb?: string | EventHandler, callback?: EventHandler ): this {
    if( typeof selectorOrCb === 'string' ){
      this._emitter.on( events, selectorQualifier( selectorOrCb ), callback );
    } else {
      this._emitter.on( events, null, selectorOrCb );
    }

    return this;
  }

  declare addListener: this['on'];

  one( events: string, selectorOrCb?: string | EventHandler, callback?: EventHandler ): this {
    if( typeof selectorOrCb === 'string' ){
      this._emitter.one( events, selectorQualifier( selectorOrCb ), callback );
    } else {
      this._emitter.one( events, null, selectorOrCb );
    }

    return this;
  }

  off( events: string, selectorOrCb?: string | EventHandler, callback?: EventHandler ): this {
    if( typeof selectorOrCb === 'string' ){
      this._emitter.off( events, selectorQualifier( selectorOrCb ), callback );
    } else {
      this._emitter.off( events, null, selectorOrCb );
    }

    return this;
  }

  declare removeListener: this['off'];

  removeAllListeners(): this {
    this._emitter.removeAllListeners();

    return this;
  }

  emit( events: string | EventProps, extraParams?: unknown[] ): this {
    this._emitter.emit( events, extraParams );

    return this;
  }

  declare trigger: this['emit'];

  promiseOn( events: string, selector?: string ): Promise<Event> {
    return new Promise( resolve => {
      if( selector != null ){
        this.one( events, selector, event => resolve( event ) );
      } else {
        this.one( events, event => resolve( event ) );
      }
    } );
  }

  // -- viewport --

  zoom( zoom?: number | Parameters<Viewport['setZoom']>[0] ): number | this {
    if( zoom === undefined ){
      return this._viewport.zoom();
    }

    if( this._viewport.setZoom( zoom ) ){
      this._emitViewportEvents( [ 'zoom' ] );
    }

    return this;
  }

  pan( pan?: Position ): Position | this {
    if( pan === undefined ){
      return this._viewport.pan();
    }

    if( this._viewport.setPan( pan ) ){
      this._emitViewportEvents( [ 'pan' ] );
    }

    return this;
  }

  panBy( delta: Position ): this {
    if( this._viewport.panBy( delta ) ){
      this._emitViewportEvents( [ 'pan' ] );
    }

    return this;
  }

  fit( eles?: GpuCollection | string, padding: number = 0 ): this {
    const bb = this._boundsOf( eles );

    if( bb == null ){ return this; }

    this._viewport.fit( bb, padding );
    this._emitViewportEvents( [ 'zoom', 'pan', 'fit' ] );

    return this;
  }

  center( eles?: GpuCollection | string ): this {
    const bb = this._boundsOf( eles );

    if( bb == null ){ return this; }

    if( this._viewport.centerOn( bb ) ){
      this._emitViewportEvents( [ 'pan' ] );
    }

    return this;
  }

  extent(): ReturnType<Viewport['extent']> {
    return this._viewport.extent();
  }

  minZoom(): number {
    return this._viewport.minZoom;
  }

  maxZoom(): number {
    return this._viewport.maxZoom;
  }

  /**
   * Async GPU pick at a rendered (CSS px) position; resolves with the
   * element under the point or null (always null when headless).
   */
  pick( x: number, y: number ): Promise<GpuCollection | null> {
    return this._renderer != null ? this._renderer.pick( x, y ) : Promise.resolve( null );
  }

  // -- environment --

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
    let ele = pool.get( slot );

    if( ele == null || ele._refs[0].gen !== gen ){
      ele = new GpuCollection( this, [ this._store.ref( group, slot ) ], { singleton: true } );
      pool.set( slot, ele );
    }

    return ele;
  }

  /** Handle for a ref that may be stale (prefers the interned pre-removal handle). */
  _eleFromRef( ref: Ref ): GpuCollection {
    if( this._store.isCurrent( ref ) ){
      return this._ele( ref.group, ref.slot );
    }

    const pooled = this._pool[ ref.group ].get( ref.slot );

    if( pooled != null && pooled._refs[0].gen === ref.gen ){
      return pooled;
    }

    return new GpuCollection( this, [ ref ], { singleton: true } );
  }

  _toCollection( eles: string | GpuCollection ): GpuCollection {
    return typeof eles === 'string' ? this.$( eles ) : eles;
  }

  _applyStyle( ref: Ref ): void {
    this._styleEngine.apply( ref );
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

  private _boundsOf( eles?: GpuCollection | string ): ReturnType<GpuCollection['boundingBox']> | null {
    if( eles == null ){
      // whole-graph fast path: columnar scan in the store, skipping the
      // per-element handle layer entirely
      return this._store.boundingBox();
    }

    const collection = this._toCollection( eles );

    if( collection.length === 0 ){ return null; }

    return collection.boundingBox();
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

GpuCore.prototype.$ = GpuCore.prototype.filter;
GpuCore.prototype.addListener = GpuCore.prototype.on;
GpuCore.prototype.removeListener = GpuCore.prototype.off;
GpuCore.prototype.trigger = GpuCore.prototype.emit;

const inferGroup = ( def: GpuElementDefinition ): GroupName => {
  if( def.group != null ){
    if( def.group !== 'nodes' && def.group !== 'edges' ){
      throw new Error( `An element must be of group 'nodes' or 'edges'; got '${def.group}'` );
    }

    return def.group;
  }

  return def.data?.source != null && def.data?.target != null ? 'edges' : 'nodes';
};

const normalizeDefs = ( defs: GpuElementsDefinition | GpuElementDefinition ): GpuElementDefinition[] => {
  if( Array.isArray( defs ) ){
    return defs;
  }

  const asMap = defs as { nodes?: GpuElementDefinition[]; edges?: GpuElementDefinition[] };

  if( asMap.nodes != null || asMap.edges != null ){
    return [
      ...( asMap.nodes ?? [] ).map( def => ( { ...def, group: 'nodes' as const } ) ),
      ...( asMap.edges ?? [] ).map( def => ( { ...def, group: 'edges' as const } ) )
    ];
  }

  return [ defs as GpuElementDefinition ];
};
