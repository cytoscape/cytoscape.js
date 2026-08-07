import { color2tuple } from './util/colors.mjs';
import { compileEasing } from './easing.mjs';
import { oklabToSrgb, srgbToOklab } from './style-schemes.mjs';
import type { Easing, EasingProgram } from './easing.mjs';
import { columnSpec, FLAG_CHILD, FLAG_PARENT } from './contract.mjs';
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
`border-color`, `line-color`, `border-width`, and — round 25 — node
`width`/`height` (two lanes of the size pair column; the store's lane
writer runs the per-tick cascade: outerHalf, label re-anchor, compound
auto-bounds), edge `width` (its style-write-baked derivatives — casing
and overlay/underlay strokes, match-line/percent arrow widths — ride
along), compound `padding` (parents only; the declared value in its
declared unit) and `font-size` (the label sidecar, patched per tick).
Colours interpolate in OKLab — the same space mappers ramp in by
default — so an animation to a colour and a mapper ramp to it take the
same path.  Geometry tweens never offload and are never stale: every
tick is a CPU column write, so `width()`/`bb()`/pick mid-tween read
the mid-flight value.

Style transitions (round 24) ride this layer as *preset* animations:
the style engine diffs stored truth around a restyle into per-column
ChannelWrites and `Animation.preset` wraps them — capture is a no-op,
and eligibility/columns derive from the writes.  Controls (round 24.3):
`pause`/`resume`/`reverse` freeze, continue (excluding the paused
span) and swap-the-ends in place, with read-only `progress`; a
GPU-driven animation settles its lease for a pause/reverse and
re-acquires on the next advance.

Easing curves live in easing.mts, which compiles a name (or
`cubic-bezier()`/`linear()`/`spring()`) into the one form both executors
evaluate.  A spring's `duration` is perceptual, so `durationMs` is the
requested duration times the easing's `durationScale`.
*/

const clamp01 = ( t: number ): number => t < 0 ? 0 : t > 1 ? 1 : t;

export type RGBA = [ number, number, number, number ];

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
  columns: Partial<Record<GroupName, TweenColumn>>;
  kind: 'scalar' | 'color';
  tier: 'paint' | 'geometry';
  /** round 25: the channel is one lane of a multi-component column
   * (node.size lanes 0/1) — tweened via the `lane` write kind, which
   * routes through the store's cascading lane writer */
  lanes?: Partial<Record<GroupName, number>>;
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
  'border-width': { columns: { nodes: 'node.borderWidth' }, kind: 'scalar', tier: 'geometry', min: 0 },
  // round 25.1: node size — two lanes of one pair column.  Sharing the
  // column means width and height share the round-21 eviction channel
  // (recorded).  Compound parents are skipped at capture *and* per tick
  // (auto-bounds own their size column).  25.2: three derived channels
  // bake the edge width at style-write — the capture carries them as
  // ride-along lane writes (see captureEdgeWidthRides).
  // Round 56: edge width became lane 0 of a two-lane column (lane 1 is
  // the arrow-bits mirror), so this is a lane write on both groups now.
  // It costs nothing: lane writes never offload, and the geometry tier
  // never did.
  'width': { columns: { nodes: 'node.size', edges: 'edge.width' }, lanes: { nodes: 0, edges: 0 }, kind: 'scalar', tier: 'geometry', min: 0 },
  'height': { columns: { nodes: 'node.size' }, lanes: { nodes: 1 }, kind: 'scalar', tier: 'geometry', min: 0 },
  // round 25.4: compound padding — the declared value in its declared
  // unit (px, or a fraction under '%'); parents only, resolved by the
  // auto-bounds flush per tick
  'padding': { columns: { nodes: 'node.padding' }, kind: 'scalar', tier: 'geometry', min: 0 },
  // round 25.5: label font-size — the sidecar, patched per tick;
  // unlabelled elements are filtered at capture
  'font-size': { columns: { nodes: 'node.fontSize', edges: 'edge.fontSize' }, kind: 'scalar', tier: 'geometry', min: 0 }
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
  /** Round 24.3: freeze in place — values hold, the promise stays
   * pending, and the paused span is excluded from the timeline. */
  pause(): AnimationHandle;
  resume(): AnimationHandle;
  /** Swap the tween's ends, remapping elapsed so the current value is
   * continuous (exactly for point-symmetric easings — linear included). */
  reverse(): AnimationHandle;
  /** Elapsed fraction of the duration (read-only — no scrubbing). */
  progress(): number;
  paused(): boolean;
}

/** Options accepted by animate()/animation(). */
export interface AnimateOptions {
  style?: Record<string, string | number>;
  position?: Partial<Position>;
  /** viewport targets (core.animate) */
  pan?: Position;
  /**
   * viewport target: pan by a delta rather than to an absolute position.
   * Resolved against the pan at creation time (v3's rule), so a manual
   * pan afterwards does not move the target.  Throws alongside `pan` —
   * the two spell the same channel, where v3 silently prefers `panBy`.
   * Core-only, as in v3: an element animation ignores it.
   */
  panBy?: Position;
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

export type WriteKind = 'position' | 'scalar' | 'color' | 'lane' | 'padding' | 'fontSize';

/**
 * Tween write targets: the real columns plus the pseudo-columns of the
 * round-25 geometry kinds — compound padding (25.4: a per-parent
 * compound style input routed through `updateCompoundStyle`, resolved
 * by the auto-bounds flush) and label font-size (25.5: the label
 * sidecar, patched per tick through `setLabelFontSize` — an edge's
 * write drives its end-label streams and fontSize-derived anchorY
 * along).
 */
export type TweenColumn = ColumnId | 'node.padding' | 'node.fontSize' | 'edge.fontSize';

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
  column: TweenColumn;
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
  /** round 25: which component a `lane` write targets.  Lane writes are
   * geometry-tier (never GPU-registered) and route through the store's
   * cascading lane writer. */
  lane?: number;
}

const lerp = ( a: number, b: number, t: number ): number => a + ( b - a ) * t;

const clampTo = ( v: number, lo: number, hi: number ): number => v < lo ? lo : v > hi ? hi : v;

/** Floats per slot in `ChannelWrite.data`, by kind. */
export const STRIDE: Record<WriteKind, number> = { position: 4, scalar: 2, color: 8, lane: 2, padding: 2, fontSize: 2 };

const blankWrite = (
  column: TweenColumn, kind: WriteKind, paint: boolean, refs: Ref[],
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
 * Round 24.1: build a pre-resolved ChannelWrite for a style transition.
 * The style engine diffs stored truth around a restyle (from = the
 * pre-restyle values, to = the newly resolved ones) and the tween
 * machinery consumes the write exactly as it would a captured
 * animation's — one set of numbers, the same two executors.
 *
 * @param column — the target column, or a `padding`/`fontSize` pseudo
 *   column for the two channels that are not stored as one (round 25)
 * @param kind — how the packed numbers are read back: a whole scalar or
 *   colour, one `lane` of a multi-lane column, or the two pseudo kinds
 * @param paint — whether the channel is paint-tier, which is what makes
 *   the write eligible to offload; geometry-tier writes never are
 * @param refs — the elements, parallel to `from`/`to`
 * @param from — the pre-restyle values, read from stored truth
 * @param to — the newly resolved values
 * @param min — lower clamp for the tweened value, as v3 clamps by
 *   property (`opacity` at 0, `border-width` at 0); bouncy easings
 *   overshoot without it
 * @param max — upper clamp, likewise
 * @param lane — which lane of the column, for the `lane` kind
 * @returns a write already carrying its from/to values, so the animation
 *   it is handed to has nothing to capture at play time — which is what
 *   keeps a whole-channel transition one bulk record instead of one
 *   Animation per element
 */
export const buildChannelWrite = (
  column: TweenColumn, kind: 'scalar' | 'color' | 'lane' | 'padding' | 'fontSize', paint: boolean, refs: Ref[],
  from: ( number | RGBA )[], to: ( number | RGBA )[],
  min = -Infinity, max = Infinity, lane?: number
): ChannelWrite => {
  const write = blankWrite( column, kind, paint, refs, min, max );

  if( lane != null ){ write.lane = lane; }

  for( let i = 0; i < refs.length; i++ ){
    if( kind === 'color' ){
      packOklab( write.data, i * 8, from[ i ] as RGBA );
      packOklab( write.data, i * 8 + 4, to[ i ] as RGBA );
    } else { // scalar and lane share the (from, to) stride
      write.data[ i * 2 ] = from[ i ] as number;
      write.data[ i * 2 + 1 ] = to[ i ] as number;
    }
  }

  return write;
};

/**
 * One element (or viewport) animation.  `refs` is empty for a viewport
 * animation.  Start values are captured lazily on the first tick after
 * the delay elapses, so queued animations pick up the true state left by
 * whatever ran before them.
 */
export class Animation {
  // -- state --

  /** the elements being animated (empty for a viewport animation) */
  readonly refs: Ref[];

  /** true when this animates the viewport rather than elements */
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
  /**
   * The compiled easing: a kind plus either a bezier tuple or a
   * progression array.  One curve layer, two executors — the CPU tick
   * calls it directly and the GPU kernel reads it out of its params, so
   * the two agree to float precision without parallel implementations.
   */
  readonly easingProgram: EasingProgram;
  /** set when the renderer's GPU tween runtime drives this animation */
  gpuDriven = false;
  /** batch id in the GPU tween runtime (null until registered) */
  gpuId: number | null = null;
  /** round 24.1: a transition built from pre-resolved ChannelWrites —
   * capture is a no-op and eligibility/columns derive from the writes */
  private preset = false;
  /** round 24.3: paused state — values hold, the promise stays pending */
  private _paused = false;
  private pausedAt: number | null = null;
  /** the shared clock as of the last manager tick — what pause/resume/
   * reverse/progress read, so the controls stay deterministic under
   * test-driven ticks (the manager stamps it every advance) */
  lastNow = 0;

  /**
   * A transition animation (round 24.1): the style engine diffed stored
   * truth around a restyle into per-column writes; nothing to capture.
   *
   * @returns an animation whose values are already resolved — it never
   *   reads the columns at play time, so the restyle's own diff is the
   *   only place stored truth is consulted
   */
  static preset(
    store: GraphStore, refs: Ref[], writes: ChannelWrite[],
    opts: { duration: number; delay?: number; easing?: string }
  ): Animation {
    const ani = new Animation( store, null, refs, false, opts );

    ani.writes = writes;
    ani.captured = true;
    ani.preset = true;

    return ani;
  }

  /**
   * Build an animation.  Reached through `eles.animate()`/
   * `eles.animation()` and `cy.animate()`/`cy.animation()` rather than
   * constructed directly.
   *
   * @param store — the columnar store the tween writes into
   * @param viewport — the viewport, for a viewport animation
   * @param refs — the elements to animate
   * @param isViewport — whether this targets the viewport
   * @param opts — targets, `duration`, `easing`, `delay`, `complete`
   * @param styleEngine — needed to resolve style targets and the arrow
   *   colour fold
   * @throws if `easing` is a function — a closure cannot cross to the
   *   device, so accepting one would make the curve depend on whether
   *   the animation got offloaded
   */
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

    // round 21: v4 has no animation queue and no step callback — reject
    // the v3 spellings loudly rather than silently ignoring them
    if( 'queue' in ( opts as Record<string, unknown> ) ){
      throw new Error( `v4 animations have no queue (the 'queue' option does not exist) — ` +
        `sequence animations with 'await animation.promise()' instead` );
    }

    if( 'step' in ( opts as Record<string, unknown> ) ){
      throw new Error( `The 'step' callback is not supported in v4 — ` +
        `observe progress via 'onRender' or poll between awaits` );
    }

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

  /**
   * True once the animation has completed or been stopped.
   *
   * @returns whether it is over, *not* whether it succeeded — a stop and
   *   a natural completion are the same answer here, and both resolve
   *   the promise
   */
  get done(): boolean { return this._done; }

  /** Columns this animation writes (round 21: the concurrency contract —
   * animations sharing an element may run together iff these are
   * disjoint).  A no-op tween (delay()) touches nothing. */
  private _columns: ReadonlySet<string> | null = null;

  /**
   * The store columns this animation writes — the round-21 concurrency
   * contract: two animations on the same element run together exactly
   * when their column sets are disjoint, and overlap evicts the older
   * one.  A no-op tween (`delay()`) touches nothing.
   *
   * @returns the set of column ids, computed once and cached
   */
  touchedColumns(): ReadonlySet<string> {
    if( this._columns == null ){
      const cols = new Set<string>();

      if( this.position != null ){ cols.add( 'node.position' ); }

      for( const s of this.style ){
        for( const col of Object.values( s.channel.columns ) ){ cols.add( col ); }
      }

      // a preset transition's channels live in its pre-resolved writes
      for( const w of this.writes ){ cols.add( w.column ); }

      this._columns = cols;
    }

    return this._columns;
  }

  /**
   * Viewport channels (round 21): pan and zoom compose when disjoint.
   *
   * @returns whether this animation tweens the pan — the pair are
   *   separate channels, so a pan animation and a zoom animation run
   *   together rather than evicting each other
   */
  get hasPan(): boolean { return this.pan != null; }

  /**
   * Whether this viewport animation tweens the zoom.
   *
   * @returns whether the zoom channel is claimed; see `hasPan` for why
   *   the two are tracked apart
   */
  get hasZoom(): boolean { return this.zoom != null; }

  /**
   * Slot compaction (19.3): repair the target and channel-write refs
   * through the store's forwarding (in place) and re-point the parallel
   * slot arrays — `apply` indexes columns by `slots[i]`, which would
   * otherwise write the tween into whatever moved into the old slot.
   *
   * @param store — the store that just compacted, whose forwarding chain
   *   resolves the pre-move refs
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

  // -- playback --

  /**
   * True once the delay has elapsed and interpolation is under way.
   *
   * @returns whether values are actually moving — false *during* the
   *   delay, when the animation is live and owns its channels but has
   *   not started interpolating
   */
  get running(): boolean { return this.started && !this._done; }

  /** A promise that resolves when the animation completes (or is stopped). */
  promise(): Promise<void> {
    if( this._done ){ return Promise.resolve(); }

    return new Promise( resolve => { this.resolvers.push( resolve ); } );
  }

  /**
   * Advance this animation.
   *
   * @param now — the shared clock in ms
   * @returns true when the animation finished on this tick
   */
  tick( now: number ): boolean {
    this.lastNow = now;

    if( this._done ){ return true; }

    if( this._paused ){ return false; } // frozen — the clock still stamps lastNow

    if( this.startTime == null ){ this.startTime = now + this.delay; }

    if( now < this.startTime ){ return false; } // still in the delay

    if( !this.started ){ this.capture(); this.started = true; }

    const t = this.duration === 0 ? 1 : clamp01( ( now - this.startTime ) / this.duration );
    const e = this.easing( t );

    this.apply( e );

    if( t >= 1 ){ this.finish(); return true; }

    return false;
  }

  /**
   * Stop now.
   *
   * @param jumpToEnd — apply the final frame first, instead of freezing
   *   at the value the tween reached
   */
  stop( jumpToEnd: boolean ): void {
    if( this._done ){ return; }

    if( jumpToEnd ){
      if( !this.started ){ this.capture(); this.started = true; }

      this.apply( 1 );
    }

    this.finish();
  }

  // -- controls (round 24.3) --

  /**
   * Whether the animation is paused: values hold where they are and the
   * promise stays pending.  A paused animation still owns its channels,
   * so the round-21 eviction stops it like any running one.
   *
   * @returns whether the clock is frozen; a paused animation is not a
   *   stopped one — it still holds its channels against everything else
   */
  get paused(): boolean { return this._paused; }

  /**
   * Elapsed fraction of the duration (0 before start, 1 when done;
   * frozen at the pause point while paused).  Read-only — no scrubbing.
   *
   * @returns the eased-time input in [0, 1], *before* the easing curve is
   *   applied — so it is linear in wall time, not in the value being
   *   tweened
   */
  get progress(): number {
    if( this._done ){ return 1; }
    if( this.startTime == null ){ return 0; }
    if( this.duration === 0 ){ return this.started ? 1 : 0; }

    const basis = this._paused && this.pausedAt != null ? this.pausedAt : this.lastNow;

    return clamp01( ( basis - this.startTime ) / this.duration );
  }

  /**
   * Freeze in place.
   *
   * @param now — the clock to freeze against; defaults to the last tick
   */
  pause( now: number = this.lastNow ): void {
    if( this._done || this._paused ){ return; }

    this._paused = true;
    this.pausedAt = now;
  }

  /**
   * Continue, excluding the paused span from the timeline.
   *
   * @param now — the clock to resume against; defaults to the last tick
   */
  resume( now: number = this.lastNow ): void {
    if( !this._paused ){ return; }

    if( this.startTime != null && this.pausedAt != null ){
      this.startTime += now - this.pausedAt;
    }

    this._paused = false;
    this.pausedAt = null;
  }

  /**
   * Swap the tween's ends and remap elapsed to `1 − t`, so the current
   * value is continuous (exactly for point-symmetric easings — linear
   * included; v3's start/end swap carried the same rule).  Reversing
   * inside the delay completes at the captured start state.  Works
   * paused (the frozen value is the pivot) — resume plays backward.
   */
  reverse(): void {
    if( this._done ){ return; }

    const nowMs = this._paused && this.pausedAt != null ? this.pausedAt : this.lastNow;

    if( this.startTime == null ){ this.startTime = nowMs + this.delay; }

    if( !this.started ){ this.capture(); this.started = true; }

    const t = this.duration === 0 ? 1 : clamp01( ( nowMs - this.startTime ) / this.duration );

    this.swapEnds();
    this.startTime = nowMs - ( 1 - t ) * this.duration;
  }

  /** Write the value reached at `now` onto the CPU columns without
   * finishing — how a GPU-driven animation leaves the device for a
   * pause or reverse (the caller unregisters the batch).
   *
   * @param now — the clock to evaluate at; defaults to the last tick
   */
  applyNow( now: number = this.lastNow ): void {
    if( this._done ){ return; }

    if( !this.started ){ this.capture(); this.started = true; }

    const t = this.duration === 0 ? 1 : clamp01( ( now - ( this.startTime ?? now ) ) / this.duration );

    this.apply( this.easing( t ) );
  }

  /** Swap every write's from/to halves (and the viewport targets). */
  private swapEnds(): void {
    for( const w of this.writes ){
      const stride = STRIDE[ w.kind ];
      const half = stride / 2;
      const data = w.data;

      for( let i = 0; i < w.refs.length; i++ ){
        const base = i * stride;

        for( let j = 0; j < half; j++ ){
          const a = data[ base + j ];

          data[ base + j ] = data[ base + half + j ];
          data[ base + half + j ] = a;
        }
      }
    }

    if( this.pan != null && this.fromPan != null ){
      const p = this.pan;

      this.pan = this.fromPan;
      this.fromPan = p;
    }

    if( this.zoom != null && this.fromZoom != null ){
      const z = this.zoom;

      this.zoom = this.fromZoom;
      this.fromZoom = z;
    }
  }

  /** set when a slot compaction demoted this animation mid-flight: the
   * rest of its run stays on the CPU (its GPU buffers held old slots) */
  private _barred = false;

  /**
   * Whether the GPU tween runtime can drive this animation outright.
   *
   * All-or-nothing: one non-offloadable channel keeps the whole
   * animation on the CPU, so a column is never half-owned.  Position
   * qualifies under the round-9 lease (the pass barrier lets cull and
   * the edge shaders read the tweened positions, so edges follow for
   * free); paint qualifies because nothing on the CPU reads it;
   * geometry channels and the viewport do not — geometry is read by
   * cull, the CPU pick replica and every columnar scan, so it stays
   * CPU-canonical (round 25).
   *
   * @returns whether **every** write may offload — all-or-nothing per
   *   animation, so one geometry channel among the writes keeps the whole
   *   animation on the CPU rather than splitting it
   */
  get gpuEligible(): boolean {
    if( this._barred ){ return false; }
    if( this.isViewport ){ return false; }

    // a preset transition's tier is per write: all-paint may offload
    // (24.2's territory); a geometry write (border-width) keeps it CPU
    if( this.preset ){
      return this.writes.length > 0 && this.writes.every( w => w.paint );
    }

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
   *
   * @param now — the clock the batch's params are anchored to
   * @returns one ChannelWrite per tweened column
   */
  gpuBatches( now: number ): ChannelWrite[] {
    if( this.startTime == null ){ this.startTime = now + this.delay; }

    this.capture();
    this.started = true;

    return this.writes;
  }

  /**
   * Pin the start clock on the first tick, so `startMs` reads true before
   * capture.
   *
   * @param now — the clock of that first tick
   */
  schedule( now: number ): void {
    if( this.startTime == null ){ this.startTime = now + this.delay; }
  }

  /**
   * Start time in the shared clock (set once scheduled); ms.
   *
   * @returns the instant interpolation begins — the delay is already
   *   added in, so this is not the moment `play()` was called; 0 before
   *   the animation has been scheduled at all
   */
  get startMs(): number { return this.startTime ?? 0; }

  /**
   * Settle a GPU-driven animation onto the CPU columns at `now` and finish
   * it — the tween is CPU-reproducible, so the exact current value is
   * `lerp(from, to, ease(t))` (t = 1 on natural completion).  Also how an
   * interrupted animation lands: without it the CPU would keep the start
   * values while the GPU buffers hold the last frame drawn, and nothing
   * would ever dirty the column to reconcile them.
   *
   * @param now — the clock to settle at; t = 1 on natural completion
   */
  settleGpu( now: number ): void {
    if( this._done ){ return; }

    if( !this.started ){ this.capture(); this.started = true; }

    const t = this.duration === 0 ? 1 : clamp01( ( now - ( this.startTime ?? now ) ) / this.duration );

    this.apply( this.easing( t ) );
    this.finish();
  }

  /**
   * Leave the GPU path mid-flight without ending the animation (slot
   * compaction, 19.4): write the exact value reached onto the CPU
   * columns and keep ticking as a CPU tween — the device-side slot
   * buffers held pre-compaction slots, and 19.3's repair re-points the
   * CPU slot arrays.  The caller unregisters the GPU batch.
   *
   * @param now — the clock whose value is written to the CPU columns
   */
  demoteGpu( now: number ): void {
    this._barred = true;

    if( this._done || this.gpuId == null ){ return; }

    this.gpuId = null;
    this.gpuDriven = false;

    if( !this.started ){ this.capture(); this.started = true; }

    const t = this.duration === 0 ? 1 : clamp01( ( now - ( this.startTime ?? now ) ) / this.duration );

    this.apply( this.easing( t ) );
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

        let refs = this.refs.filter( r => r.group === group && this.store.isCurrent( r ) );

        // round 25.1: a compound parent's size is auto-bounds-derived —
        // width/height tweens skip parent slots (padding is the parent
        // knob; recorded); 25.4: padding conversely is parents-only
        const lane = s.channel.lanes?.[ group ];

        if( column === 'node.size' ){
          refs = refs.filter( r =>
            ( this.store.flags( 'nodes', r.slot ) & FLAG_PARENT ) === 0 );
        } else if( column === 'node.padding' ){
          refs = refs.filter( r =>
            ( this.store.flags( 'nodes', r.slot ) & FLAG_PARENT ) !== 0 );
        } else if( column === 'node.fontSize' || column === 'edge.fontSize' ){
          // 25.5: only labelled elements have a fontSize to tween
          refs = refs.filter( r =>
            this.store.labelAt( r.slot, r.group === 'nodes' ? 'nodes' : 'edges' ) != null );
        }

        if( refs.length === 0 ){ continue; }

        const paint = s.channel.tier === 'paint';

        this.writes.push( s.channel.kind === 'color'
          ? this.colorWrite( column as ColumnId, refs, paint, () => s.toColor as RGBA )
          : column === 'node.padding'
            ? this.paddingWrite( refs, s.toScalar as number, s.channel )
            : column === 'node.fontSize' || column === 'edge.fontSize'
              ? this.fontSizeWrite( column, group, refs, s.toScalar as number, s.channel )
              : lane != null
                ? this.laneWrite( column as ColumnId, refs, lane, s.toScalar as number, s.channel )
                : this.scalarWrite( column as ColumnId, refs, paint, s.toScalar as number, s.channel ) );

        // edge opacity is pre-folded into the stored arrow alpha (the arrow
        // vertex stage has no spare storage binding for the opacity column),
        // so tweening it has to carry the arrows along.  The fold is linear
        // in opacity, so each arrow rides as a plain colour tween from its
        // stored bytes to base × the target opacity.
        if( column === 'edge.opacity' ){ this.captureArrowFold( refs, s.toScalar as number ); }

        // 25.2: three derived channels bake the edge width at style-write
        // (all linear in width), so a width tween carries them along
        if( column === 'edge.width' ){ this.captureEdgeWidthRides( refs, s.toScalar as number ); }
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

  /** Round 25.4: tween a parent's declared compound padding — from is
   * the stored declaration in its declared unit; the auto-bounds flush
   * resolves it per tick. */
  private paddingWrite( refs: Ref[], to: number, channel: StyleChannel ): ChannelWrite {
    const write = blankWrite( 'node.padding', 'padding', false, refs, channel.min, channel.max );

    for( let i = 0; i < refs.length; i++ ){
      write.data[ i * 2 ] = this.store.compoundStyleOf( refs[ i ].slot ).padding;
      write.data[ i * 2 + 1 ] = to;
    }

    return write;
  }

  /** Round 25.5: tween a label's font-size — from is the sidecar
   * entry's current value (refs are pre-filtered to labelled slots). */
  private fontSizeWrite(
    column: TweenColumn, group: GroupName, refs: Ref[], to: number, channel: StyleChannel
  ): ChannelWrite {
    const write = blankWrite( column, 'fontSize', false, refs, channel.min, channel.max );
    const stream = group === 'nodes' ? 'nodes' : 'edges';

    for( let i = 0; i < refs.length; i++ ){
      write.data[ i * 2 ] = this.store.labelAt( refs[ i ].slot, stream )?.fontSize ?? to;
      write.data[ i * 2 + 1 ] = to;
    }

    return write;
  }

  /** Round 25: tween one component of a multi-lane column (node size).
   * Geometry-tier by construction — lane writes never offload. */
  private laneWrite(
    column: ColumnId, refs: Ref[], lane: number, to: number, channel: StyleChannel
  ): ChannelWrite {
    const write = blankWrite( column, 'lane', false, refs, channel.min, channel.max );
    const arr = this.store.column( column ) as Float32Array;
    const comps = columnSpec( column ).components;

    write.lane = lane;

    for( let i = 0; i < refs.length; i++ ){
      write.data[ i * 2 ] = arr[ refs[ i ].slot * comps + lane ];
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

  /**
   * Ride-along writes for an edge-width tween (25.2): the derived
   * channels that resolve against the width at style-write, all linear
   * in it.  Strokes ride additively from stored truth
   * (to = stored + Δwidth — mapper-resolved paddings/outline widths
   * need no engine round trip), gated per slot on the layer being
   * enabled; hollow-arrow strokes ride by mode ('match-line' → the
   * target width, percent → pct × target; plain numbers never baked
   * the width, so they stay).  Arrow-width modes are constants-only
   * sheet props, answered by the engine.
   */
  private captureEdgeWidthRides( refs: Ref[], toWidth: number ): void {
    const store = this.store;
    const width = store.column( 'edge.width' ) as Float32Array;

    for( const column of [ 'edge.casing', 'edge.overlay', 'edge.underlay' ] as const ){
      const rec = store.column( column ) as Uint32Array;
      const enabled = refs.filter( r => rec[ r.slot * 2 ] !== 0 );

      if( enabled.length === 0 ){ continue; }

      const write = blankWrite( column, 'lane', false, enabled, 0, Infinity );

      write.lane = 1;

      for( let i = 0; i < enabled.length; i++ ){
        const slot = enabled[ i ].slot;
        const stroke = rec[ slot * 2 + 1 ] / 256;

        write.data[ i * 2 ] = stroke;
        write.data[ i * 2 + 1 ] = stroke + ( toWidth - width[ slot * 2 ] );
      }

      this.writes.push( write );
    }

    const modes = this.styleEngine?.arrowWidthModes();

    if( modes == null ){ return; }

    const aw = store.column( 'edge.arrowWidths' ) as Float32Array;

    for( const [ mode, lane ] of [ [ modes.source, 0 ], [ modes.target, 1 ] ] as const ){
      if( typeof mode === 'number' ){ continue; }

      const to = mode === 'match-line' ? toWidth : mode.percent * toWidth;
      const write = blankWrite( 'edge.arrowWidths', 'lane', false, refs, 0, Infinity );

      write.lane = lane;

      for( let i = 0; i < refs.length; i++ ){
        write.data[ i * 2 ] = aw[ refs[ i ].slot * 2 + lane ];
        write.data[ i * 2 + 1 ] = to;
      }

      this.writes.push( write );
    }
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
            store.setScalar( w.column as ColumnId, slot,
              clampTo( lerp( w.data[ i * 2 ], w.data[ i * 2 + 1 ], e ), w.min, w.max ) );
            break;
          case 'color': {
            const [ r, g, b, a ] = mixOklab( w.data, i * 8, e );

            store.setColor( w.column as ColumnId, slot, r, g, b, a );
            break;
          }
          case 'lane':
            // a mid-tween leaf→parent flip hands the slot to auto-bounds
            // rather than fighting the derivation (round 25.1)
            if( w.column === 'node.size'
              && ( store.flags( 'nodes', slot ) & FLAG_PARENT ) !== 0 ){ break; }

            store.setLane( w.column as ColumnId, slot, w.lane as number,
              clampTo( lerp( w.data[ i * 2 ], w.data[ i * 2 + 1 ], e ), w.min, w.max ) );
            break;
          case 'padding':
            // parents only — a mid-tween parent→leaf flip drops the slot
            if( ( store.flags( 'nodes', slot ) & FLAG_PARENT ) === 0 ){ break; }

            store.updateCompoundStyle( slot, {
              padding: clampTo( lerp( w.data[ i * 2 ], w.data[ i * 2 + 1 ], e ), w.min, w.max )
            } );
            break;
          case 'fontSize':
            store.setLabelFontSize( slot,
              w.column === 'node.fontSize' ? 'nodes' : 'edges',
              clampTo( lerp( w.data[ i * 2 ], w.data[ i * 2 + 1 ], e ), w.min, w.max ) );
            break;
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

/** The renderer's GPU tween executor, seen by the manager. */
export interface GpuTweenSink {
  register(
    id: number, writes: readonly ChannelWrite[],
    start: number, duration: number, easing: EasingProgram
  ): void;
  unregister( id: number ): void;
}

/**
 * Per-core animation manager (round 21: no queue).  Every started
 * animation runs immediately; animations sharing an element compose when
 * their channel columns are disjoint, and starting one that overlaps a
 * running animation's columns stops that older animation in place (its
 * promise resolves, values freeze where they got to, any GPU lease
 * settles) — whole-animation eviction, never a half-stopped animation.
 * Sequencing is the caller's job via `await animation.promise()`.  An
 * auto-driver ticks via rAF (or setTimeout when headless) while anything
 * is active; tests can drive `tick(now)` directly.
 */
export class AnimationManager {
  private running = new Map<number, Animation[]>(); // packed ref → running set
  private viewportRunning: Animation[] = [];
  private onTick: () => void;
  private ticking = false;
  private raf: ( ( cb: ( t: number ) => void ) => void ) | null;
  /** the renderer's GPU tween runtime (position animations offload here) */
  private sink: GpuTweenSink | null = null;
  /** true while the renderer drives ticks (its frame clock replaces the auto-loop) */
  private driven = false;
  private gpuCounter = 0;

  /**
   * @param onTick — run after each tick; the core uses it to request a
   *   redraw and to emit viewport events while a viewport animation
   *   pans or zooms
   */
  constructor( onTick: () => void ){
    this.onTick = onTick;

    const g = globalThis as { requestAnimationFrame?: ( cb: ( t: number ) => void ) => void };

    this.raf = typeof g.requestAnimationFrame === 'function'
      ? cb => g.requestAnimationFrame!( cb )
      : cb => { setTimeout( () => cb( now() ), 16 ); };
  }

  /**
   * The renderer takes over the clock and provides the GPU tween sink.
   *
   * @param sink — the renderer's tween sink; the manager cedes its
   *   auto-loop to the render loop while it is attached
   */
  attachDriver( sink: GpuTweenSink ): void {
    this.sink = sink;
    this.driven = true;
  }

  /**
   * Give the clock back: settle every GPU-driven animation onto the CPU
   * columns and drop the sink.  Called when the renderer goes away.
   */
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
    for( const ani of this.allRunning() ){
      if( ani.gpuId != null ){ ani.settleGpu( now() ); }
    }
  }

  /** Every distinct running element animation (one entry per animation,
   * however many refs it spans). */
  private allRunning(): Set<Animation> {
    const seen = new Set<Animation>();

    for( const arr of this.running.values() ){
      for( const ani of arr ){ seen.add( ani ); }
    }

    return seen;
  }

  /**
   * Slot compaction (19.4): demote every GPU-driven animation to the CPU
   * path — the device-side slot buffers hold pre-compaction slots.  Each
   * writes the exact value it reached onto the CPU columns, unregisters
   * its batch, and keeps running as a CPU tween (whose slot lists 19.3's
   * `onCompacted` repair re-points).  Unlike `settleGpuAll` (the
   * reparent path), the animation is *not* finished early.
   */
  demoteGpuAll(): void {
    if( this.sink == null ){ return; }

    for( const ani of this.allRunning() ){
      if( ani.gpuId != null ){
        this.sink.unregister( ani.gpuId );
        ani.demoteGpu( now() );
      }
    }
  }

  /**
   * Slot compaction (19.3): repair every queued animation's refs/slots
   * and re-key the per-element queues (keys pack the pre-move identity).
   * GPU-driven animations were demoted to the CPU by the caller before
   * the store compacted (`demoteGpuAll`).
   *
   * @param store — the store that just compacted
   */
  onCompacted( store: GraphStore ): void {
    const next = new Map<number, Animation[]>();
    const repaired = new Set<Animation>();

    for( const [ key, arr ] of this.running ){
      for( const ani of arr ){
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
      next.set( packRef( ref ), arr );
    }

    this.running = next;
  }

  /**
   * Start an animation (round 21: immediately — there is no queue).  A
   * running animation sharing a ref *and* a channel column with the new
   * one is stopped in place first (whole-animation eviction); disjoint
   * channels compose.  Nudges the driver (or starts the auto-loop).
   *
   * @param ani — the animation to run
   */
  start( ani: Animation ): void {
    if( ani.isViewport ){
      for( const other of [ ...this.viewportRunning ] ){
        if( ( ani.hasPan && other.hasPan ) || ( ani.hasZoom && other.hasZoom ) ){
          other.stop( false );
        }
      }

      this.viewportRunning = this.viewportRunning.filter( a => !a.done );
      this.viewportRunning.push( ani );
    } else {
      const cols = ani.touchedColumns();
      const evicted = new Set<Animation>();

      for( const ref of ani.refs ){
        const arr = this.running.get( packRef( ref ) );

        if( arr == null ){ continue; }

        for( const other of arr ){
          if( evicted.has( other ) ){ continue; }

          for( const col of other.touchedColumns() ){
            if( cols.has( col ) ){ evicted.add( other ); break; }
          }
        }
      }

      for( const other of evicted ){
        this.stopOne( other, false );
        this.remove( other );
      }

      for( const ref of ani.refs ){
        const key = packRef( ref );
        const arr = this.running.get( key );

        if( arr == null ){ this.running.set( key, [ ani ] ); } else { arr.push( ani ); }
      }
    }

    if( this.driven ){ this.onTick(); } else { this.schedule(); } // wake the renderer, or auto-loop
  }

  /** Drop an animation from every ref's running set. */
  private remove( ani: Animation ): void {
    for( const ref of ani.refs ){
      const key = packRef( ref );
      const arr = this.running.get( key );

      if( arr == null ){ continue; }

      const filtered = arr.filter( a => a !== ani );

      if( filtered.length === 0 ){ this.running.delete( key ); } else { this.running.set( key, filtered ); }
    }
  }

  /**
   * True while any animation is running.
   *
   * @returns whether anything at all is tweening, element or viewport —
   *   the renderer cedes its auto-loop and drives the frame clock while
   *   this holds
   */
  active(): boolean {
    return this.viewportRunning.length > 0 || this.running.size > 0;
  }

  /**
   * True when a specific element has a running animation.
   *
   * @param ref — the element to check
   * @returns whether anything is tweening it
   */
  isAnimating( ref: Ref ): boolean {
    const arr = this.running.get( packRef( ref ) );

    return arr != null && arr.length > 0;
  }

  /**
   * True when the viewport is animating.
   *
   * @returns whether a pan/zoom animation is live; element animations do
   *   not count, which is the split `cy.animated()` exposes
   */
  isViewportAnimating(): boolean {
    return this.viewportRunning.length > 0;
  }

  /**
   * Stop every running animation on the given refs (round 21: there is
   * no queue to clear — all of them are running).
   *
   * @param refs — the elements whose animations stop
   * @param jumpToEnd — apply each animation's final frame first
   */
  stop( refs: Ref[], jumpToEnd: boolean ): void {
    const toStop = new Set<Animation>();

    for( const ref of refs ){
      const arr = this.running.get( packRef( ref ) );

      if( arr == null ){ continue; }

      for( const ani of arr ){ toStop.add( ani ); }
    }

    for( const ani of toStop ){
      this.stopOne( ani, jumpToEnd );
      this.remove( ani );
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

  /**
   * Stop every running viewport animation.
   *
   * @param jumpToEnd — finish at the target instead of freezing at the
   *   current value
   */
  stopViewport( jumpToEnd: boolean ): void {
    for( const ani of this.viewportRunning ){ ani.stop( jumpToEnd ); }

    this.viewportRunning.length = 0;
  }

  // -- controls (round 24.3) --

  /**
   * Pause one animation.  A GPU-driven one settles its lease first —
   * the device is released and the CPU columns hold the exact value it
   * reached — so the freeze is readable and the mirror resumes its
   * uploads; resume re-acquires through the normal advance path.
   *
   * @param ani — the animation to freeze
   */
  pauseAni( ani: Animation ): void {
    if( ani.done || ani.paused ){ return; }

    if( ani.gpuId != null ){
      this.sink?.unregister( ani.gpuId );
      ani.gpuId = null;
      ani.gpuDriven = false;
      ani.applyNow();
    }

    ani.pause();
  }

  /**
   * Resume a paused animation.  The paused span is excluded from the
   * timeline, so the remaining motion keeps its original pace, and a
   * previously GPU-driven tween re-acquires the device on the shifted
   * clock.
   *
   * @param ani — the animation to resume
   */
  resumeAni( ani: Animation ): void {
    if( ani.done || !ani.paused ){ return; }

    ani.resume();

    if( this.driven ){ this.onTick(); } else { this.schedule(); }
  }

  /**
   * Reverse one animation in place.  A GPU-driven one leaves the device
   * at its current value first; the next advance re-registers the
   * swapped writes on the remapped clock.
   *
   * @param ani — the animation to reverse
   */
  reverseAni( ani: Animation ): void {
    if( ani.done ){ return; }

    if( ani.gpuId != null ){
      this.sink?.unregister( ani.gpuId );
      ani.gpuId = null;
      ani.gpuDriven = false;
      ani.applyNow();
    }

    ani.reverse();

    if( !ani.paused ){
      if( this.driven ){ this.onTick(); } else { this.schedule(); }
    }
  }

  /**
   * Advance every running animation to `now`; drop finished ones.
   * Position and paint animations route to the GPU sink when one is
   * attached (registered once, driven on-device, completion detected here
   * from the shared clock).
   *
   * @param now — the shared clock in ms
   * @returns true while any animation remains active
   */
  tick( now: number ): boolean {
    const advanced = new Set<Animation>();

    for( const [ key, arr ] of this.running ){
      for( const ani of arr ){
        if( !advanced.has( ani ) ){
          advanced.add( ani );
          this.advanceOne( ani, now );
        }
      }

      const alive = arr.filter( a => !a.done );

      if( alive.length === 0 ){ this.running.delete( key ); }
      else if( alive.length !== arr.length ){ this.running.set( key, alive ); }
    }

    if( this.viewportRunning.length > 0 ){
      for( const ani of this.viewportRunning ){ this.advanceOne( ani, now ); }

      this.viewportRunning = this.viewportRunning.filter( a => !a.done );
    }

    return this.active();
  }

  /** Advance one animation; returns true when it is finished. */
  private advanceOne( ani: Animation, now: number ): boolean {
    ani.lastNow = now; // the controls' clock (pause/resume/reverse/progress)

    if( ani.done ){ return true; } // completed (possibly via another queue, or stopped)

    if( ani.paused ){ return false; } // frozen — and never (re-)registered on the GPU

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
