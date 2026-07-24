import { color2tuple } from '../util/colors.mjs';
import type { ColumnId, GroupName, Ref } from './contract.mjs';
import type { GraphStore } from './store/graph-store.mjs';
import type { Viewport } from './viewport.mjs';

/*
Animation — the CPU-canonical tween layer.

An animation interpolates element style channels and/or position (or the
viewport) from their captured start values to explicit targets over a
duration, easing the normalized time.  Each tick writes the store columns
(scheduling a redraw through the dirty tracker), so animation works
headless and is fully Node-testable; a GPU fast path (round 9.2) can later
evaluate the same tweens on-device without changing this contract — every
tween is a pure function of time, so the CPU remains the reference.

Ownership: a tween is CPU-reproducible, so the CPU columns stay
authoritative while it runs (unlike a GPU layout).  On completion the
final values are already in the columns; nothing to settle on the CPU
path.  Position animations take the "grab forbidden while animating" lease
(the core checks `animated()` before starting a drag) so an interactive
override can't fight the tween.

Animatable, MVP: `position`, node `opacity`, `border-width`, and the
`background-color` / `border-color` / `line-color` channels — the
coupling-free set (fade, move, recolour).  Size (width/height, circle
collapse), edge opacity (arrow-alpha fold) and label channels are a
follow-up.  Colors interpolate per-channel in sRGB (as v3).
*/

export type Easing = ( t: number ) => number;

const clamp01 = ( t: number ): number => t < 0 ? 0 : t > 1 ? 1 : t;

/** Standard easings; a string names one, or pass a custom function. */
export const EASINGS: Record<string, Easing> = {
  'linear': t => t,
  'ease': t => easeInOutCubicBezier( t ),
  'ease-in': t => t * t * t,
  'ease-out': t => 1 - Math.pow( 1 - t, 3 ),
  'ease-in-out': t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow( -2 * t + 2, 3 ) / 2,
  'ease-in-sine': t => 1 - Math.cos( ( t * Math.PI ) / 2 ),
  'ease-out-sine': t => Math.sin( ( t * Math.PI ) / 2 ),
  'ease-in-out-sine': t => -( Math.cos( Math.PI * t ) - 1 ) / 2
};

// a cheap approximation of CSS ease (cubic-bezier 0.25,0.1,0.25,1)
const easeInOutCubicBezier = ( t: number ): number => t * t * ( 3 - 2 * t );

export const resolveEasing = ( easing: string | Easing | undefined ): Easing => {
  if( typeof easing === 'function' ){ return easing; }

  return EASINGS[ easing ?? 'ease' ] ?? EASINGS.ease;
};

type RGBA = [ number, number, number, number ];

/** Where an animatable style prop lands (coupling-free channels only). */
interface StyleChannel {
  group: GroupName;
  column: ColumnId;
  kind: 'scalar' | 'color';
}

const STYLE_CHANNELS: Record<string, StyleChannel> = {
  'opacity': { group: 'nodes', column: 'node.opacity', kind: 'scalar' },
  'border-width': { group: 'nodes', column: 'node.borderWidth', kind: 'scalar' },
  'background-color': { group: 'nodes', column: 'node.fillColor', kind: 'color' },
  'border-color': { group: 'nodes', column: 'node.borderColor', kind: 'color' },
  'line-color': { group: 'edges', column: 'edge.lineColor', kind: 'color' }
};

const normalizeProp = ( prop: string ): string => prop.replace( /([A-Z])/g, '-$1' ).toLowerCase();

const parseColor = ( value: unknown ): RGBA => {
  const tuple = color2tuple( value as string );

  if( tuple == null ){ throw new Error( `Invalid animation colour '${String( value )}'` ); }

  const [ r, g, b, a ] = tuple;

  return [ r, g, b, Math.round( ( a ?? 1 ) * 255 ) ];
};

const parseNumber = ( value: unknown ): number => {
  const n = typeof value === 'number' ? value : parseFloat( String( value ) );

  if( !isFinite( n ) ){ throw new Error( `Invalid animation number '${String( value )}'` ); }

  return n;
};

export interface Position { x: number; y: number }

/** A handle to a built-but-controllable animation (from `animation()`). */
export interface AnimationHandle {
  /** Enqueue and start; resolves when it completes. */
  play(): Promise<void>;
  stop( jumpToEnd?: boolean ): void;
  promise(): Promise<void>;
  playing(): boolean;
}

/** Options accepted by animate()/animation(). */
export interface AnimateOptions {
  style?: Record<string, string | number>;
  position?: Partial<Position>;
  /** viewport targets (core.animate) */
  pan?: Position;
  zoom?: number;
  duration?: number;
  easing?: string | Easing;
  delay?: number;
  complete?: () => void;
}

interface CompiledStyle {
  channel: StyleChannel;
  toScalar?: number;
  toColor?: RGBA;
  /** captured at start */
  fromScalar?: number;
  fromColor?: RGBA;
}

const lerp = ( a: number, b: number, t: number ): number => a + ( b - a ) * t;

const lerpColor = ( a: RGBA, b: RGBA, t: number ): RGBA => [
  Math.round( lerp( a[ 0 ], b[ 0 ], t ) ),
  Math.round( lerp( a[ 1 ], b[ 1 ], t ) ),
  Math.round( lerp( a[ 2 ], b[ 2 ], t ) ),
  Math.round( lerp( a[ 3 ], b[ 3 ], t ) )
];

/**
 * One element (or viewport) animation.  `refs` is empty for a viewport
 * animation.  Start values are captured lazily on the first tick after
 * the delay elapses, so queued animations pick up the true state left by
 * whatever ran before them.
 */
export class Animation {
  readonly refs: Ref[];
  readonly isViewport: boolean;
  private store: GraphStore;
  private viewport: Viewport | null;
  private duration: number;
  private easing: Easing;
  private delay: number;
  private style: CompiledStyle[];
  private position: Partial<Position> | null;
  private pan: Position | null;
  private zoom: number | null;
  private onComplete: ( () => void ) | null;

  private startTime: number | null = null; // set on first post-delay tick
  private started = false;
  private fromPos: Position | null = null;
  private fromPan: Position | null = null;
  private fromZoom: number | null = null;
  private _done = false;
  private resolvers: ( () => void )[] = [];

  constructor(
    store: GraphStore, viewport: Viewport | null,
    refs: Ref[], isViewport: boolean, opts: AnimateOptions
  ){
    this.store = store;
    this.viewport = viewport;
    this.refs = refs;
    this.isViewport = isViewport;
    this.duration = Math.max( 0, opts.duration ?? 400 );
    this.easing = resolveEasing( opts.easing );
    this.delay = Math.max( 0, opts.delay ?? 0 );
    this.position = opts.position ?? null;
    this.pan = opts.pan ?? null;
    this.zoom = opts.zoom ?? null;
    this.onComplete = opts.complete ?? null;
    this.style = [];

    for( const prop of Object.keys( opts.style ?? {} ) ){
      const norm = normalizeProp( prop );
      const channel = STYLE_CHANNELS[ norm ];

      if( channel == null ){
        throw new Error( `Animating '${norm}' is unsupported in the GPU prototype ` +
          `(animatable: ${Object.keys( STYLE_CHANNELS ).join( ', ' )}, position)` );
      }

      const value = ( opts.style as Record<string, unknown> )[ prop ];

      this.style.push( channel.kind === 'color'
        ? { channel, toColor: parseColor( value ) }
        : { channel, toScalar: parseNumber( value ) } );
    }
  }

  get done(): boolean { return this._done; }

  /** True once the delay has elapsed and interpolation is under way. */
  get running(): boolean { return this.started && !this._done; }

  /** A promise that resolves when the animation completes (or is stopped). */
  promise(): Promise<void> {
    if( this._done ){ return Promise.resolve(); }

    return new Promise( resolve => { this.resolvers.push( resolve ); } );
  }

  /** Advance to `now` (ms).  Returns true when finished this tick. */
  tick( now: number ): boolean {
    if( this._done ){ return true; }

    if( this.startTime == null ){ this.startTime = now + this.delay; }

    if( now < this.startTime ){ return false; } // still in the delay

    if( !this.started ){ this.capture(); this.started = true; }

    const t = this.duration === 0 ? 1 : clamp01( ( now - this.startTime ) / this.duration );
    const e = this.easing( t );

    this.apply( e );

    if( t >= 1 ){ this.finish(); return true; }

    return false;
  }

  /** Stop now; `jumpToEnd` applies the final frame first. */
  stop( jumpToEnd: boolean ): void {
    if( this._done ){ return; }

    if( jumpToEnd ){
      if( !this.started ){ this.capture(); this.started = true; }

      this.apply( 1 );
    }

    this.finish();
  }

  // -- internals --

  private capture(): void {
    const store = this.store;

    for( const s of this.style ){
      if( this.refs.length === 0 ){ continue; }

      const slot = this.refs[ 0 ].slot; // uniform target: capture from the first, apply per ref
      const col = store.column( s.channel.column );

      if( s.channel.kind === 'scalar' ){
        s.fromScalar = ( col as Float32Array )[ slot ];
      } else {
        const b = col as Uint8Array;

        s.fromColor = [ b[ slot * 4 ], b[ slot * 4 + 1 ], b[ slot * 4 + 2 ], b[ slot * 4 + 3 ] ];
      }
    }

    if( this.position != null && this.refs.length > 0 ){
      const pos = store.column( 'node.position' ) as Float32Array;
      const slot = this.refs[ 0 ].slot;

      this.fromPos = { x: pos[ slot * 2 ], y: pos[ slot * 2 + 1 ] };
    }

    if( this.viewport != null ){
      if( this.pan != null ){ this.fromPan = { ...this.viewport.pan() }; }
      if( this.zoom != null ){ this.fromZoom = this.viewport.zoom(); }
    }
  }

  private apply( e: number ): void {
    const store = this.store;

    // style channels (per captured 'from', shared target across the refs)
    for( const s of this.style ){
      for( const ref of this.refs ){
        if( !store.isCurrent( ref ) || ref.group !== s.channel.group ){ continue; }

        if( s.channel.kind === 'scalar' && s.fromScalar != null && s.toScalar != null ){
          store.setScalar( s.channel.column, ref.slot, lerp( s.fromScalar, s.toScalar, e ) );
        } else if( s.channel.kind === 'color' && s.fromColor != null && s.toColor != null ){
          const [ r, g, b, a ] = lerpColor( s.fromColor, s.toColor, e );

          store.setColor( s.channel.column, ref.slot, r, g, b, a );
        }
      }
    }

    if( this.position != null && this.fromPos != null ){
      const toX = this.position.x ?? this.fromPos.x;
      const toY = this.position.y ?? this.fromPos.y;
      const x = lerp( this.fromPos.x, toX, e );
      const y = lerp( this.fromPos.y, toY, e );

      for( const ref of this.refs ){
        if( ref.group === 'nodes' && store.isCurrent( ref ) ){ store.setPosition( ref.slot, x, y ); }
      }
    }

    if( this.viewport != null ){
      if( this.pan != null && this.fromPan != null ){
        this.viewport.setPan( {
          x: lerp( this.fromPan.x, this.pan.x, e ),
          y: lerp( this.fromPan.y, this.pan.y, e )
        } );
      }

      if( this.zoom != null && this.fromZoom != null ){
        this.viewport.setZoom( lerp( this.fromZoom, this.zoom, e ) );
      }
    }
  }

  private finish(): void {
    this._done = true;
    this.onComplete?.();

    for( const resolve of this.resolvers ){ resolve(); }

    this.resolvers.length = 0;
  }
}

/**
 * Per-core animation manager: one queue per element (and one for the
 * viewport), advanced each tick.  The head of each queue runs; on
 * completion the next queued animation starts.  An auto-driver ticks via
 * rAF (or setTimeout when headless) while anything is active; tests can
 * drive `tick(now)` directly.
 */
export class AnimationManager {
  private queues = new Map<number, Animation[]>(); // packed ref → queue
  private viewportQueue: Animation[] = [];
  private onTick: () => void;
  private ticking = false;
  private raf: ( ( cb: ( t: number ) => void ) => void ) | null;

  constructor( onTick: () => void ){
    this.onTick = onTick;

    const g = globalThis as { requestAnimationFrame?: ( cb: ( t: number ) => void ) => void };

    this.raf = typeof g.requestAnimationFrame === 'function'
      ? cb => g.requestAnimationFrame!( cb )
      : cb => { setTimeout( () => cb( now() ), 16 ); };
  }

  /** Enqueue an animation; starts driving the loop if idle. */
  enqueue( ani: Animation ): void {
    if( ani.isViewport ){
      this.viewportQueue.push( ani );
    } else {
      for( const ref of ani.refs ){
        const key = packRef( ref );
        const q = this.queues.get( key );

        if( q == null ){ this.queues.set( key, [ ani ] ); } else { q.push( ani ); }
      }
    }

    this.schedule();
  }

  /** True while any animation is active or queued. */
  active(): boolean {
    return this.viewportQueue.length > 0 || this.queues.size > 0;
  }

  /** True when a specific element has a running or queued animation. */
  isAnimating( ref: Ref ): boolean {
    const q = this.queues.get( packRef( ref ) );

    return q != null && q.length > 0;
  }

  /** True when the viewport is animating. */
  isViewportAnimating(): boolean {
    return this.viewportQueue.length > 0;
  }

  /** Stop the running (and optionally queued) animations for the given refs. */
  stop( refs: Ref[], clearQueue: boolean, jumpToEnd: boolean ): void {
    for( const ref of refs ){
      const key = packRef( ref );
      const q = this.queues.get( key );

      if( q == null ){ continue; }

      q[ 0 ]?.stop( jumpToEnd );

      if( clearQueue ){ this.queues.delete( key ); } else { q.shift(); if( q.length === 0 ){ this.queues.delete( key ); } }
    }
  }

  stopViewport( clearQueue: boolean, jumpToEnd: boolean ): void {
    this.viewportQueue[ 0 ]?.stop( jumpToEnd );

    if( clearQueue ){ this.viewportQueue.length = 0; } else { this.viewportQueue.shift(); }
  }

  /**
   * Advance every queue head to `now`; dequeue finished animations so the
   * next queued one starts on the following tick.  Returns true if any
   * animation remains active.
   */
  tick( now: number ): boolean {
    for( const [ key, q ] of this.queues ){
      const head = q[ 0 ];

      if( head != null && head.tick( now ) ){
        q.shift();

        if( q.length === 0 ){ this.queues.delete( key ); }
      }
    }

    const vHead = this.viewportQueue[ 0 ];

    if( vHead != null && vHead.tick( now ) ){ this.viewportQueue.shift(); }

    return this.active();
  }

  private schedule(): void {
    if( this.ticking || this.raf == null ){ return; }

    this.ticking = true;

    const loop = ( t: number ): void => {
      const stillActive = this.tick( t );

      this.onTick();

      if( stillActive ){
        this.raf!( loop );
      } else {
        this.ticking = false;
      }
    };

    this.raf( loop );
  }
}

const now = (): number => {
  const p = globalThis as { performance?: { now(): number } };

  return p.performance != null ? p.performance.now() : Date.now();
};

const packRef = ( r: Ref ): number =>
  ( r.group === 'nodes' ? 0 : 0x10000000000000 ) + r.slot * 0x1000000 + r.gen;
