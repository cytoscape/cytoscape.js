import { color2tuple } from '../util/colors.mjs';
import { compileEasing } from './easing.mjs';
import { oklabToSrgb, srgbToOklab } from './style-schemes.mjs';
import type { Easing, EasingProgram } from './easing.mjs';
import { FLAG_CHILD, FLAG_PARENT } from './contract.mjs';
import type { ColumnId, GroupName, Ref } from './contract.mjs';
import type { GraphStore } from './store/graph-store.mjs';
import type { StyleEngine } from './style.mjs';
import type { Viewport } from './viewport.mjs';

/*
Animation — the CPU-canonical tween layer.

An animation interpolates element style channels and/or position (or the
viewport) from their captured start values to explicit targets over a
duration, easing the normalized time.  Each tick writes the store columns
(scheduling a redraw through the dirty tracker), so animation works
headless and is fully Node-testable.

Every tween is a pure function of time, so the CPU stays the reference even
when the GPU evaluates it: `capture()` resolves the animation into a list
of per-slot `ChannelWrite`s that the CPU lerps directly and the GPU tween
runtime (render/gpu-tween.mts) consumes verbatim.  One set of numbers, two
executors.

Ownership: a GPU-driven animation leases its columns for the duration —
CPU reads go stale mid-flight and `settleGpu` re-derives the exact value on
the CPU when it ends (no readback).  Elements can't be grabbed while
animating (the core checks `animated()` before starting a drag), so an
interactive override can't fight the tween.

Animatable: `position`, `opacity` (both groups), `background-color`,
`border-color`, `line-color`, `border-width`.  Colours interpolate in
OKLab — the same space mappers ramp in by default — so an animation to a
colour and a mapper ramp to it take the same path.  Size (width/height,
circle collapse) and label channels are a follow-up.

Easing curves live in easing.mts, which compiles a name (or
`cubic-bezier()`/`linear()`/`spring()`) into the one form both executors
evaluate.  A spring's `duration` is perceptual, so `durationMs` is the
requested duration times the easing's `durationScale`.
*/

const clamp01 = ( t: number ): number => t < 0 ? 0 : t > 1 ? 1 : t;

type RGBA = [ number, number, number, number ];

const GROUPS: GroupName[] = [ 'nodes', 'edges' ];

/**
 * Where an animatable style prop lands, per group — a shared name like
 * `opacity` resolves to a different column in each.
 *
 * `tier` decides GPU eligibility.  **Paint** channels have no CPU consumer:
 * culling, CPU picking and the columnar scans (`boundingBox`, `refsInBox`)
 * never read them, which is why they were the ones made GPU-evaluable in
 * the mapper split — so a GPU tween can own the column outright while it
 * runs.  **Geometry** channels are read by all three, so they stay
 * CPU-canonical; a GPU-owned size tween reopens the store→style layering
 * seam and belongs with that work, not here.
 */
interface StyleChannel {
  columns: Partial<Record<GroupName, ColumnId>>;
  kind: 'scalar' | 'color';
  tier: 'paint' | 'geometry';
  /**
   * Valid range for a scalar channel.  A bouncy easing overshoots its
   * endpoints on purpose — fine for position, but an opacity of 1.04 or a
   * negative border width is not a value the renderer should ever see, so
   * scalars clamp (as v3 does, via each property's own min/max).
   */
  min?: number;
  max?: number;
}

const STYLE_CHANNELS: Record<string, StyleChannel> = {
  'opacity': { columns: { nodes: 'node.opacity', edges: 'edge.opacity' }, kind: 'scalar', tier: 'paint', min: 0, max: 1 },
  'background-color': { columns: { nodes: 'node.fillColor' }, kind: 'color', tier: 'paint' },
  'border-color': { columns: { nodes: 'node.borderColor' }, kind: 'color', tier: 'paint' },
  'line-color': { columns: { edges: 'edge.lineColor' }, kind: 'color', tier: 'paint' },
  'border-width': { columns: { nodes: 'node.borderWidth' }, kind: 'scalar', tier: 'geometry', min: 0 }
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
  /**
   * viewport target: animate to the viewport that fits the given elements
   * (or an explicit model-space box).  Resolved to pan/zoom when the
   * animation is created, as v3 does.
   */
  fit?: {
    eles?: unknown;
    boundingBox?: { x1: number; y1: number; x2?: number; y2?: number; w?: number; h?: number };
    padding?: number;
  };
  /** viewport target: animate the pan that centers the given elements */
  center?: { eles?: unknown };
  duration?: number;
  /**
   * A name from the v3 enum, `cubic-bezier()`, `linear()` or
   * `spring(bounce)`.  For a spring, `duration` is the *perceptual*
   * duration and the animation runs on past it to settle, so its total
   * length is longer (see `durationMs`).
   */
  easing?: string;
  delay?: number;
  complete?: () => void;
}

interface CompiledStyle {
  prop: string;
  channel: StyleChannel;
  toScalar?: number;
  toColor?: RGBA;
}

export type WriteKind = 'position' | 'scalar' | 'color';

/**
 * One column's worth of resolved tween data, captured once at start.
 *
 * `data` is what both executors read.  Per slot: position `(fx, fy, tx,
 * ty)`; scalar `(from, to)`; colour two OKLab vec4s `(L, a, b, alpha)`,
 * alpha normalized — pre-converted on the CPU so the kernel only needs the
 * OKLab→sRGB direction it already has, and so both sides interpolate the
 * exact same numbers.
 */
export interface ChannelWrite {
  column: ColumnId;
  kind: WriteKind;
  /** the column has no CPU consumer, so a GPU tween may own it outright */
  paint: boolean;
  /** parallel to `slots`; carries the generation for liveness checks */
  refs: Ref[];
  slots: Uint32Array;
  data: Float32Array;
  /** scalar bounds against easing overshoot (see StyleChannel) */
  min: number;
  max: number;
}

const lerp = ( a: number, b: number, t: number ): number => a + ( b - a ) * t;

const clampTo = ( v: number, lo: number, hi: number ): number => v < lo ? lo : v > hi ? hi : v;

/** Floats per slot in `ChannelWrite.data`, by kind. */
export const STRIDE: Record<WriteKind, number> = { position: 4, scalar: 2, color: 8 };

const blankWrite = (
  column: ColumnId, kind: WriteKind, paint: boolean, refs: Ref[],
  min = -Infinity, max = Infinity
): ChannelWrite => ( {
  column, kind, paint, refs, min, max,
  slots: Uint32Array.from( refs, r => r.slot ),
  data: new Float32Array( refs.length * STRIDE[ kind ] )
} );

const readScalar = ( store: GraphStore, column: ColumnId, slot: number ): number =>
  ( store.column( column ) as Float32Array )[ slot ];

const readColor = ( store: GraphStore, column: ColumnId, slot: number ): RGBA => {
  const bytes = store.column( column ) as Uint8Array;
  const i = slot * 4;

  return [ bytes[ i ], bytes[ i + 1 ], bytes[ i + 2 ], bytes[ i + 3 ] ];
};

/** Write an sRGB byte tuple into `out` at `i` as OKLab + normalized alpha. */
const packOklab = ( out: Float32Array, i: number, rgba: RGBA ): void => {
  const [ L, a, b ] = srgbToOklab( rgba[ 0 ], rgba[ 1 ], rgba[ 2 ] );

  out[ i ] = L;
  out[ i + 1 ] = a;
  out[ i + 2 ] = b;
  out[ i + 3 ] = rgba[ 3 ] / 255;
};

/** Interpolate one colour slot of `data` in OKLab, back to sRGB bytes. */
const mixOklab = ( data: Float32Array, i: number, e: number ): RGBA => {
  const [ r, g, b ] = oklabToSrgb(
    lerp( data[ i ], data[ i + 4 ], e ),
    lerp( data[ i + 1 ], data[ i + 5 ], e ),
    lerp( data[ i + 2 ], data[ i + 6 ], e ) );

  // the rgb conversion clamps on its own; alpha would wrap in a byte column
  return [ r, g, b, Math.round( clampTo( lerp( data[ i + 3 ], data[ i + 7 ], e ), 0, 1 ) * 255 ) ];
};

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
  private styleEngine: StyleEngine | null;
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
  private captured = false;
  private writes: ChannelWrite[] = [];
  private fromPan: Position | null = null;
  private fromZoom: number | null = null;
  private _done = false;
  private resolvers: ( () => void )[] = [];
  /**
   * The animation's real length: the requested duration times the easing's
   * `durationScale`, which is 1 for every curve except a spring (whose
   * duration is perceptual — the pace of the key movement — leaving the
   * settling tail to run past it).
   */
  readonly durationMs: number;
  readonly easingProgram: EasingProgram;
  /** set when the renderer's GPU tween runtime drives this animation */
  gpuDriven = false;
  /** batch id in the GPU tween runtime (null until registered) */
  gpuId: number | null = null;

  constructor(
    store: GraphStore, viewport: Viewport | null,
    refs: Ref[], isViewport: boolean, opts: AnimateOptions,
    styleEngine: StyleEngine | null = null
  ){
    this.store = store;
    this.styleEngine = styleEngine;
    this.viewport = viewport;
    this.refs = refs;
    this.isViewport = isViewport;
    this.easingProgram = compileEasing( opts.easing );
    this.easing = this.easingProgram.fn;
    this.duration = Math.max( 0, opts.duration ?? 400 ) * this.easingProgram.durationScale;
    this.durationMs = this.duration;
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
        ? { prop: norm, channel, toColor: parseColor( value ) }
        : { prop: norm, channel, toScalar: parseNumber( value ) } );
    }
  }

  get done(): boolean { return this._done; }

  /**
   * Slot compaction (19.3): repair the target and channel-write refs
   * through the store's forwarding (in place) and re-point the parallel
   * slot arrays — `apply` indexes columns by `slots[i]`, which would
   * otherwise write the tween into whatever moved into the old slot.
   */
  repairRefs( store: GraphStore ): void {
    for( const ref of this.refs ){ store.isCurrent( ref ); }

    for( const w of this.writes ){
      for( let i = 0; i < w.refs.length; i++ ){
        store.isCurrent( w.refs[ i ] );
        w.slots[ i ] = w.refs[ i ].slot;
      }
    }
  }

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

  /**
   * Whether the GPU tween runtime can drive this animation outright.
   * All-or-nothing: a single non-offloadable channel keeps the whole
   * animation on the CPU, so a column is never half-owned.  Position
   * qualifies under the round-9 lease (cull reads the tweened positions
   * on-GPU); paint qualifies because nothing on the CPU reads it; geometry
   * style channels and the viewport do not.
   */
  get gpuEligible(): boolean {
    if( this.isViewport ){ return false; }

    if( this.position == null && this.style.length === 0 ){ return false; } // a bare delay

    // compounds (round 14.11): a GPU position lease leaves the CPU
    // columns stale, which the auto-bounds derivation reads — and a
    // tweened parent must shift its subtree per tick, which only the
    // CPU path does.  Compound-related targets stay CPU-driven.
    if( this.position != null && this.store.hasCompounds() ){
      for( const ref of this.refs ){
        if( ref.group === 'nodes'
          && ( this.store.flags( 'nodes', ref.slot ) & ( FLAG_PARENT | FLAG_CHILD ) ) !== 0 ){
          return false;
        }
      }
    }

    return this.style.every( s => s.channel.tier === 'paint' );
  }

  /**
   * Resolve this animation into per-column GPU batches, capturing start
   * values.  Sets the start clock so CPU settle and GPU evaluation share
   * it.
   */
  gpuBatches( now: number ): ChannelWrite[] {
    if( this.startTime == null ){ this.startTime = now + this.delay; }

    this.capture();
    this.started = true;

    return this.writes;
  }

  /** Pin the start clock on the first tick, so `startMs` reads true before capture. */
  schedule( now: number ): void {
    if( this.startTime == null ){ this.startTime = now + this.delay; }
  }

  /** Start time in the shared clock (set once scheduled); ms. */
  get startMs(): number { return this.startTime ?? 0; }

  /**
   * Settle a GPU-driven animation onto the CPU columns at `now` and finish
   * it — the tween is CPU-reproducible, so the exact current value is
   * `lerp(from, to, ease(t))` (t = 1 on natural completion).  Also how an
   * interrupted animation lands: without it the CPU would keep the start
   * values while the GPU buffers hold the last frame drawn, and nothing
   * would ever dirty the column to reconcile them.
   */
  settleGpu( now: number ): void {
    if( this._done ){ return; }

    if( !this.started ){ this.capture(); this.started = true; }

    const t = this.duration === 0 ? 1 : clamp01( ( now - ( this.startTime ?? now ) ) / this.duration );

    this.apply( this.easing( t ) );
    this.finish();
  }

  // -- internals --

  /**
   * Resolve the animation into `ChannelWrite`s against the live elements.
   * Idempotent — the first capture wins, so a queued animation still picks
   * up the state its predecessor left, and a GPU-driven animation settles
   * against the values it registered with.
   */
  private capture(): void {
    if( this.captured ){ return; }

    this.captured = true;

    for( const s of this.style ){
      for( const group of GROUPS ){
        const column = s.channel.columns[ group ];

        if( column == null ){ continue; }

        const refs = this.refs.filter( r => r.group === group && this.store.isCurrent( r ) );

        if( refs.length === 0 ){ continue; }

        const paint = s.channel.tier === 'paint';

        this.writes.push( s.channel.kind === 'color'
          ? this.colorWrite( column, refs, paint, () => s.toColor as RGBA )
          : this.scalarWrite( column, refs, paint, s.toScalar as number, s.channel ) );

        // edge opacity is pre-folded into the stored arrow alpha (the arrow
        // vertex stage has no spare storage binding for the opacity column),
        // so tweening it has to carry the arrows along.  The fold is linear
        // in opacity, so each arrow rides as a plain colour tween from its
        // stored bytes to base × the target opacity.
        if( column === 'edge.opacity' ){ this.captureArrowFold( refs, s.toScalar as number ); }
      }
    }

    if( this.position != null ){
      const refs = this.refs.filter( r => r.group === 'nodes' && this.store.isCurrent( r ) );

      if( refs.length > 0 ){ this.writes.push( this.positionWrite( refs ) ); }
    }

    if( this.viewport != null ){
      if( this.pan != null ){ this.fromPan = { ...this.viewport.pan() }; }
      if( this.zoom != null ){ this.fromZoom = this.viewport.zoom(); }
    }
  }

  private positionWrite( refs: Ref[] ): ChannelWrite {
    const pos = this.store.column( 'node.position' ) as Float32Array;
    const write = blankWrite( 'node.position', 'position', true, refs );

    for( let i = 0; i < refs.length; i++ ){
      const x = pos[ refs[ i ].slot * 2 ];
      const y = pos[ refs[ i ].slot * 2 + 1 ];

      write.data[ i * 4 ] = x;
      write.data[ i * 4 + 1 ] = y;
      write.data[ i * 4 + 2 ] = this.position?.x ?? x;
      write.data[ i * 4 + 3 ] = this.position?.y ?? y;
    }

    return write;
  }

  private scalarWrite(
    column: ColumnId, refs: Ref[], paint: boolean, to: number, channel: StyleChannel
  ): ChannelWrite {
    const write = blankWrite( column, 'scalar', paint, refs, channel.min, channel.max );

    for( let i = 0; i < refs.length; i++ ){
      write.data[ i * 2 ] = readScalar( this.store, column, refs[ i ].slot );
      write.data[ i * 2 + 1 ] = to;
    }

    return write;
  }

  private colorWrite( column: ColumnId, refs: Ref[], paint: boolean, to: ( ref: Ref ) => RGBA ): ChannelWrite {
    const write = blankWrite( column, 'color', paint, refs );

    for( let i = 0; i < refs.length; i++ ){
      packOklab( write.data, i * 8, readColor( this.store, column, refs[ i ].slot ) );
      packOklab( write.data, i * 8 + 4, to( refs[ i ] ) );
    }

    return write;
  }

  /** Arrow colour writes that keep the pre-folded alpha in step with an edge-opacity tween. */
  private captureArrowFold( refs: Ref[], toOpacity: number ): void {
    const engine = this.styleEngine;
    const ends = engine?.arrowEnds;

    if( engine == null || ends == null ){ return; }

    for( const [ enabled, column, colorProp ] of [
      [ ends.source, 'edge.sourceArrow', 'source-arrow-color' ],
      [ ends.target, 'edge.targetArrow', 'target-arrow-color' ]
    ] as const ){
      if( !enabled ){ continue; }

      this.writes.push( this.colorWrite( column, refs, true, ref => {
        const [ r, g, b, baseAlpha ] = engine.arrowBase( ref, colorProp );
        // B1: the stored fold is base.a × opacity × line-opacity
        const lineOp = engine.lineOpacityConst();

        return [ r, g, b, Math.round( baseAlpha * toOpacity * lineOp ) ];
      } ) );
    }
  }

  private apply( e: number ): void {
    const store = this.store;

    for( const w of this.writes ){
      for( let i = 0; i < w.refs.length; i++ ){
        const slot = w.slots[ i ];

        if( !store.isCurrent( w.refs[ i ] ) ){ continue; }

        switch( w.kind ){
          case 'position':
            store.setPosition( slot,
              lerp( w.data[ i * 4 ], w.data[ i * 4 + 2 ], e ),
              lerp( w.data[ i * 4 + 1 ], w.data[ i * 4 + 3 ], e ) );
            break;
          case 'scalar':
            store.setScalar( w.column, slot,
              clampTo( lerp( w.data[ i * 2 ], w.data[ i * 2 + 1 ], e ), w.min, w.max ) );
            break;
          case 'color': {
            const [ r, g, b, a ] = mixOklab( w.data, i * 8, e );

            store.setColor( w.column, slot, r, g, b, a );
            break;
          }
        }
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
/** The renderer's GPU tween executor, seen by the manager. */
export interface GpuTweenSink {
  register(
    id: number, writes: readonly ChannelWrite[],
    start: number, duration: number, easing: EasingProgram
  ): void;
  unregister( id: number ): void;
}

export class AnimationManager {
  private queues = new Map<number, Animation[]>(); // packed ref → queue
  private viewportQueue: Animation[] = [];
  private onTick: () => void;
  private ticking = false;
  private raf: ( ( cb: ( t: number ) => void ) => void ) | null;
  /** the renderer's GPU tween runtime (position animations offload here) */
  private sink: GpuTweenSink | null = null;
  /** true while the renderer drives ticks (its frame clock replaces the auto-loop) */
  private driven = false;
  private gpuCounter = 0;

  constructor( onTick: () => void ){
    this.onTick = onTick;

    const g = globalThis as { requestAnimationFrame?: ( cb: ( t: number ) => void ) => void };

    this.raf = typeof g.requestAnimationFrame === 'function'
      ? cb => g.requestAnimationFrame!( cb )
      : cb => { setTimeout( () => cb( now() ), 16 ); };
  }

  /** The renderer takes over the clock and provides the GPU tween sink. */
  attachDriver( sink: GpuTweenSink ): void {
    this.sink = sink;
    this.driven = true;
  }

  detachDriver(): void {
    this.settleGpuAll();
    this.sink = null;
    this.driven = false;
  }

  /** Settle every GPU-driven animation onto the CPU columns.  Round
   * 14.11: a reparent mid-flight moves the tweened slots under the
   * auto-bounds/fold derivations, which read the CPU columns — the
   * store's reparent hook settles active leases before they go stale. */
  settleGpuAll(): void {
    for( const q of this.queues.values() ){
      if( q[ 0 ]?.gpuId != null ){ q[ 0 ].settleGpu( now() ); }
    }
  }

  /**
   * Slot compaction (19.3): repair every queued animation's refs/slots
   * and re-key the per-element queues (keys pack the pre-move identity).
   * GPU-driven animations were settled by the caller before the store
   * compacted (`settleGpuAll`, the reparent precedent).
   */
  onCompacted( store: GraphStore ): void {
    const next = new Map<number, Animation[]>();
    const repaired = new Set<Animation>();

    for( const [ key, q ] of this.queues ){
      for( const ani of q ){
        if( !repaired.has( ani ) ){
          repaired.add( ani );
          ani.repairRefs( store );
        }
      }

      const isEdge = key >= 0x10000000000000;
      const rem = isEdge ? key - 0x10000000000000 : key;
      const ref: Ref = {
        group: isEdge ? 'edges' : 'nodes',
        slot: Math.floor( rem / 0x1000000 ),
        gen: rem % 0x1000000
      };

      store.isCurrent( ref ); // repairs a forwarded identity in place
      next.set( packRef( ref ), q );
    }

    this.queues = next;
  }

  /** Enqueue an animation; nudges the driver (or starts the auto-loop). */
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

    if( this.driven ){ this.onTick(); } else { this.schedule(); } // wake the renderer, or auto-loop
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

      if( q[ 0 ] != null ){ this.stopOne( q[ 0 ], jumpToEnd ); }

      if( clearQueue ){ this.queues.delete( key ); } else { q.shift(); if( q.length === 0 ){ this.queues.delete( key ); } }
    }
  }

  /**
   * Stop one animation.  A GPU-driven one settles instead of plain-stopping:
   * its columns are leased to the device, so it has to write the value it
   * actually reached back onto the CPU (v3 leaves a stopped animation where
   * it got to) or the two would diverge with nothing to reconcile them.
   */
  private stopOne( ani: Animation, jumpToEnd: boolean ): void {
    if( ani.gpuId == null ){ ani.stop( jumpToEnd ); return; }

    this.sink?.unregister( ani.gpuId );
    ani.gpuId = null;
    ani.settleGpu( jumpToEnd ? ani.startMs + ani.durationMs : now() );
  }

  stopViewport( clearQueue: boolean, jumpToEnd: boolean ): void {
    this.viewportQueue[ 0 ]?.stop( jumpToEnd );

    if( clearQueue ){ this.viewportQueue.length = 0; } else { this.viewportQueue.shift(); }
  }

  /**
   * Advance every queue head to `now`; dequeue finished animations so the
   * next queued one starts on the following tick.  Position and paint
   * animations route to the GPU sink when one is attached (registered once,
   * driven on-device, completion detected here from the shared clock).
   * Returns true if any animation remains active.
   */
  tick( now: number ): boolean {
    for( const [ key, q ] of this.queues ){
      while( q.length > 0 && this.advanceHead( q[ 0 ], now ) ){ q.shift(); }

      if( q.length === 0 ){ this.queues.delete( key ); }
    }

    while( this.viewportQueue.length > 0 && this.advanceHead( this.viewportQueue[ 0 ], now ) ){
      this.viewportQueue.shift();
    }

    return this.active();
  }

  /** Advance one head; returns true when it is finished (dequeue it). */
  private advanceHead( ani: Animation, now: number ): boolean {
    if( ani.done ){ return true; } // completed (possibly via another queue, or stopped)

    if( this.sink != null && ani.gpuEligible ){
      if( ani.gpuId == null ){
        ani.schedule( now );

        // capture after the delay, as the CPU path does
        if( now < ani.startMs ){ return false; }

        const writes = ani.gpuBatches( now );

        ani.gpuId = ++this.gpuCounter;
        ani.gpuDriven = true;
        this.sink.register( ani.gpuId, writes, ani.startMs, ani.durationMs, ani.easingProgram );
      }

      if( now >= ani.startMs + ani.durationMs ){
        this.sink.unregister( ani.gpuId );
        ani.gpuId = null;
        ani.settleGpu( now ); // writes the exact final onto the CPU columns
        return true;
      }

      return false;
    }

    return ani.tick( now );
  }

  private schedule(): void {
    if( this.ticking || this.raf == null ){ return; }

    this.ticking = true;

    const loop = ( t: number ): void => {
      if( this.driven ){ this.ticking = false; return; } // renderer took over the clock

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
