import { compileEasing } from '../easing.mjs';
import type { Easing, EasingProgram } from '../easing.mjs';
import { GROUP_NODES, COL, FLAG_CHILD, FLAG_PARENT } from '../contract.mjs';
import type { Ref } from '../contract.mjs';
import type { GraphStore } from '../store/graph-store.mjs';
import type { StyleEngine } from '../style.mjs';
import type { Viewport } from '../viewport.mjs';
import {
  clamp01,
  STYLE_CHANNELS,
  normalizeProp,
  parseColor,
  parseNumber,
} from './channels.mjs';
import type { RGBA, StyleChannel, ChannelWrite } from './channels.mjs';
import type { Position } from './handle.mjs';
import * as captureImpl from './capture.mjs';
import * as applyImpl from './apply.mjs';

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
    boundingBox?: {
      x1: number;
      y1: number;
      x2?: number;
      y2?: number;
      w?: number;
      h?: number;
    };
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

/**
 * One element (or viewport) animation.  `refs` is empty for a viewport
 * animation.  Start values are captured lazily on the first tick after
 * the delay elapses, so queued animations pick up the true state left by
 * whatever ran before them.
 */
export class Animation {
  // -- state --

  /** the elements being animated (empty for a viewport animation)
   *
   * @internal */
  readonly refs: Ref[];

  /** `cy.autolock()` at creation: the position channel then moves
   * nothing (114.3 — a locked node holds against tweens as against
   * writes); style channels still animate
   *
   * @internal */
  lockAll = false;

  /** true when this animates the viewport rather than elements
   *
   * @internal */
  readonly isViewport: boolean;
  /** @internal */
  store: GraphStore;
  /** @internal */
  styleEngine: StyleEngine | null;
  /** @internal */
  viewport: Viewport | null;
  private duration: number;
  private easing: Easing;
  private delay: number;
  /** @internal */
  style: CompiledStyle[];
  /** @internal */
  position: Partial<Position> | null;
  /** @internal */
  pan: Position | null;
  /** @internal */
  zoom: number | null;
  /** @internal */
  onComplete: (() => void) | null;

  private startTime: number | null = null; // set on first post-delay tick
  private started = false;
  /** @internal */
  captured = false;
  /** @internal */
  writes: ChannelWrite[] = [];
  /** @internal */
  fromPan: Position | null = null;
  /** @internal */
  fromZoom: number | null = null;
  /** @internal */
  _done = false;
  /** @internal */
  resolvers: (() => void)[] = [];
  /**
   * The animation's real length: the requested duration times the easing's
   * `durationScale`, which is 1 for every curve except a spring (whose
   * duration is perceptual — the pace of the key movement — leaving the
   * settling tail to run past it).
   * @internal
   */
  readonly durationMs: number;
  /**
   * The compiled easing: a kind plus either a bezier tuple or a
   * progression array.  One curve layer, two executors — the CPU tick
   * calls it directly and the GPU kernel reads it out of its params, so
   * the two agree to float precision without parallel implementations.
   * @internal
   */
  readonly easingProgram: EasingProgram;
  /** set when the renderer's GPU tween runtime drives this animation
   *
   * @internal */
  gpuDriven = false;
  /** batch id in the GPU tween runtime (null until registered)
   *
   * @internal */
  gpuId: number | null = null;
  /** round 24.1: a transition built from pre-resolved ChannelWrites —
   * capture is a no-op and eligibility/columns derive from the writes */
  private preset = false;
  /** round 24.3: paused state — values hold, the promise stays pending */
  private _paused = false;
  private pausedAt: number | null = null;
  /** the shared clock as of the last manager tick — what pause/resume/
   * reverse/progress read, so the controls stay deterministic under
   * test-driven ticks (the manager stamps it every advance)
   * @internal */
  lastNow = 0;

  /**
   * A transition animation (round 24.1): the style engine diffed stored
   * truth around a restyle into per-column writes; nothing to capture.
   *
   * @param store — the store whose columns the writes address
   * @param refs — the elements the transition covers, for eviction and
   *   ref repair; the writes carry their own slot lists
   * @param writes — the diffed per-column from/to records
   * @param opts — `duration`, and the `delay`/`easing` the sheet's
   *   `transition-*` config resolved to
   * @returns an animation whose values are already resolved — it never
   *   reads the columns at play time, so the restyle's own diff is the
   *   only place stored truth is consulted
   * @internal
   */
  static preset(
    store: GraphStore,
    refs: Ref[],
    writes: ChannelWrite[],
    opts: { duration: number; delay?: number; easing?: string },
  ): Animation {
    const ani = new Animation(store, null, refs, false, opts);

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
   * @internal
   */
  constructor(
    store: GraphStore,
    viewport: Viewport | null,
    refs: Ref[],
    isViewport: boolean,
    opts: AnimateOptions,
    styleEngine: StyleEngine | null = null,
  ) {
    this.store = store;
    this.styleEngine = styleEngine;
    this.viewport = viewport;
    this.refs = refs;
    this.isViewport = isViewport;
    this.easingProgram = compileEasing(opts.easing);
    this.easing = this.easingProgram.fn;
    this.duration =
      Math.max(0, opts.duration ?? 400) * this.easingProgram.durationScale;
    this.durationMs = this.duration;
    this.delay = Math.max(0, opts.delay ?? 0);
    this.position = opts.position ?? null;
    this.pan = opts.pan ?? null;
    this.zoom = opts.zoom ?? null;
    this.onComplete = opts.complete ?? null;
    this.style = [];

    // round 21: v4 has no animation queue and no step callback — reject
    // the v3 spellings loudly rather than silently ignoring them
    if ('queue' in (opts as Record<string, unknown>)) {
      throw new Error(
        `v4 animations have no queue (the 'queue' option does not exist) — ` +
          `sequence animations with 'await animation.promise()' instead`,
      );
    }

    if ('step' in (opts as Record<string, unknown>)) {
      throw new Error(
        `The 'step' callback is not supported in v4 — ` +
          `observe progress via cy.on( 'render', … ) or poll between awaits`,
      );
    }

    for (const prop of Object.keys(opts.style ?? {})) {
      const norm = normalizeProp(prop);
      const channel = STYLE_CHANNELS[norm];

      if (channel == null) {
        throw new Error(
          `Animating '${norm}' is unsupported in the GPU prototype ` +
            `(animatable: ${Object.keys(STYLE_CHANNELS).join(', ')}, position)`,
        );
      }

      const value = (opts.style as Record<string, unknown>)[prop];

      this.style.push(
        channel.kind === 'color'
          ? { prop: norm, channel, toColor: parseColor(value) }
          : { prop: norm, channel, toScalar: parseNumber(value) },
      );
    }
  }

  /**
   * True once the animation has completed or been stopped.
   *
   * @returns whether it is over, *not* whether it succeeded — a stop and
   *   a natural completion are the same answer here, and both resolve
   *   the promise
   * @internal
   */
  get done(): boolean {
    return this._done;
  }

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
   * @internal
   */
  touchedColumns(): ReadonlySet<string> {
    if (this._columns == null) {
      const cols = new Set<string>();

      if (this.position != null) {
        cols.add(COL.NODE_POSITION);
      }

      for (const s of this.style) {
        for (const col of Object.values(s.channel.columns)) {
          cols.add(col);
        }
      }

      // a preset transition's channels live in its pre-resolved writes
      for (const w of this.writes) {
        cols.add(w.column);
      }

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
   * @internal
   */
  get hasPan(): boolean {
    return this.pan != null;
  }

  /**
   * Whether this viewport animation tweens the zoom.
   *
   * @returns whether the zoom channel is claimed; see `hasPan` for why
   *   the two are tracked apart
   * @internal
   */
  get hasZoom(): boolean {
    return this.zoom != null;
  }

  /**
   * Slot compaction (19.3): repair the target and channel-write refs
   * through the store's forwarding (in place) and re-point the parallel
   * slot arrays — `apply` indexes columns by `slots[i]`, which would
   * otherwise write the tween into whatever moved into the old slot.
   *
   * @param store — the store that just compacted, whose forwarding chain
   *   resolves the pre-move refs
   * @internal
   */
  repairRefs(store: GraphStore): void {
    for (const ref of this.refs) {
      store.isCurrent(ref);
    }

    for (const w of this.writes) {
      for (let i = 0; i < w.refs.length; i++) {
        store.isCurrent(w.refs[i]);
        w.slots[i] = w.refs[i].slot;
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
   * @internal
   */
  get running(): boolean {
    return this.started && !this._done;
  }

  /** A promise that resolves when the animation completes (or is stopped).
   *
   * @internal */
  promise(): Promise<void> {
    if (this._done) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this.resolvers.push(resolve);
    });
  }

  /**
   * Advance this animation.
   *
   * @param now — the shared clock in ms
   * @returns true when the animation finished on this tick
   * @internal
   */
  tick(now: number): boolean {
    this.lastNow = now;

    if (this._done) {
      return true;
    }

    if (this._paused) {
      return false;
    } // frozen — the clock still stamps lastNow

    if (this.startTime == null) {
      this.startTime = now + this.delay;
    }

    if (now < this.startTime) {
      return false;
    } // still in the delay

    if (!this.started) {
      this.capture();
      this.started = true;
    }

    const t =
      this.duration === 0 ? 1 : clamp01((now - this.startTime) / this.duration);
    const e = this.easing(t);

    this.apply(e);

    if (t >= 1) {
      this.finish();
      return true;
    }

    return false;
  }

  /**
   * Stop now.
   *
   * @param jumpToEnd — apply the final frame first, instead of freezing
   *   at the value the tween reached
   * @internal
   */
  stop(jumpToEnd: boolean): void {
    if (this._done) {
      return;
    }

    if (jumpToEnd) {
      if (!this.started) {
        this.capture();
        this.started = true;
      }

      this.apply(1);
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
   * @internal
   */
  get paused(): boolean {
    return this._paused;
  }

  /**
   * Elapsed fraction of the duration (0 before start, 1 when done;
   * frozen at the pause point while paused).  Read-only — no scrubbing.
   *
   * @returns the eased-time input in [0, 1], *before* the easing curve is
   *   applied — so it is linear in wall time, not in the value being
   *   tweened
   * @internal
   */
  get progress(): number {
    if (this._done) {
      return 1;
    }
    if (this.startTime == null) {
      return 0;
    }
    if (this.duration === 0) {
      return this.started ? 1 : 0;
    }

    const basis =
      this._paused && this.pausedAt != null ? this.pausedAt : this.lastNow;

    return clamp01((basis - this.startTime) / this.duration);
  }

  /**
   * Freeze in place.
   *
   * @param now — the clock to freeze against; defaults to the last tick
   * @internal
   */
  pause(now: number = this.lastNow): void {
    if (this._done || this._paused) {
      return;
    }

    this._paused = true;
    this.pausedAt = now;
  }

  /**
   * Continue, excluding the paused span from the timeline.
   *
   * @param now — the clock to resume against; defaults to the last tick
   * @internal
   */
  resume(now: number = this.lastNow): void {
    if (!this._paused) {
      return;
    }

    if (this.startTime != null && this.pausedAt != null) {
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
   * @internal
   */
  reverse(): void {
    if (this._done) {
      return;
    }

    const nowMs =
      this._paused && this.pausedAt != null ? this.pausedAt : this.lastNow;

    if (this.startTime == null) {
      this.startTime = nowMs + this.delay;
    }

    if (!this.started) {
      this.capture();
      this.started = true;
    }

    const t =
      this.duration === 0
        ? 1
        : clamp01((nowMs - this.startTime) / this.duration);

    applyImpl.swapEnds(this);
    this.startTime = nowMs - (1 - t) * this.duration;
  }

  /** Write the value reached at `now` onto the CPU columns without
   * finishing — how a GPU-driven animation leaves the device for a
   * pause or reverse (the caller unregisters the batch).
   *
   * @param now — the clock to evaluate at; defaults to the last tick
   * @internal
   */
  applyNow(now: number = this.lastNow): void {
    if (this._done) {
      return;
    }

    if (!this.started) {
      this.capture();
      this.started = true;
    }

    const t =
      this.duration === 0
        ? 1
        : clamp01((now - (this.startTime ?? now)) / this.duration);

    this.apply(this.easing(t));
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
   * @internal
   */
  get gpuEligible(): boolean {
    if (this._barred) {
      return false;
    }
    if (this.isViewport) {
      return false;
    }

    // a preset transition's tier is per write: all-paint may offload
    // (24.2's territory); a geometry write (border-width) keeps it CPU
    if (this.preset) {
      return this.writes.length > 0 && this.writes.every((w) => w.paint);
    }

    if (this.position == null && this.style.length === 0) {
      return false;
    } // a bare delay

    // compounds (round 14.11): a GPU position lease leaves the CPU
    // columns stale, which the auto-bounds derivation reads — and a
    // tweened parent must shift its subtree per tick, which only the
    // CPU path does.  Compound-related targets stay CPU-driven.
    if (this.position != null && this.store.hasCompounds()) {
      for (const ref of this.refs) {
        if (
          ref.group === GROUP_NODES &&
          (this.store.flags(GROUP_NODES, ref.slot) &
            (FLAG_PARENT | FLAG_CHILD)) !==
            0
        ) {
          return false;
        }
      }
    }

    return this.style.every((s) => s.channel.tier === 'paint');
  }

  /**
   * Resolve this animation into per-column GPU batches, capturing start
   * values.  Sets the start clock so CPU settle and GPU evaluation share
   * it.
   *
   * @param now — the clock the batch's params are anchored to
   * @returns one ChannelWrite per tweened column
   * @internal
   */
  gpuBatches(now: number): ChannelWrite[] {
    if (this.startTime == null) {
      this.startTime = now + this.delay;
    }

    this.capture();
    this.started = true;

    return this.writes;
  }

  /**
   * Pin the start clock on the first tick, so `startMs` reads true before
   * capture.
   *
   * @param now — the clock of that first tick
   * @internal
   */
  schedule(now: number): void {
    if (this.startTime == null) {
      this.startTime = now + this.delay;
    }
  }

  /**
   * Start time in the shared clock (set once scheduled); ms.
   *
   * @returns the instant interpolation begins — the delay is already
   *   added in, so this is not the moment `play()` was called; 0 before
   *   the animation has been scheduled at all
   * @internal
   */
  get startMs(): number {
    return this.startTime ?? 0;
  }

  /**
   * Settle a GPU-driven animation onto the CPU columns at `now` and finish
   * it — the tween is CPU-reproducible, so the exact current value is
   * `lerp(from, to, ease(t))` (t = 1 on natural completion).  Also how an
   * interrupted animation lands: without it the CPU would keep the start
   * values while the GPU buffers hold the last frame drawn, and nothing
   * would ever dirty the column to reconcile them.
   *
   * @param now — the clock to settle at; t = 1 on natural completion
   * @internal
   */
  settleGpu(now: number): void {
    if (this._done) {
      return;
    }

    if (!this.started) {
      this.capture();
      this.started = true;
    }

    const t =
      this.duration === 0
        ? 1
        : clamp01((now - (this.startTime ?? now)) / this.duration);

    this.apply(this.easing(t));
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
   * @internal
   */
  demoteGpu(now: number): void {
    this._barred = true;

    if (this._done || this.gpuId == null) {
      return;
    }

    this.gpuId = null;
    this.gpuDriven = false;

    if (!this.started) {
      this.capture();
      this.started = true;
    }

    const t =
      this.duration === 0
        ? 1
        : clamp01((now - (this.startTime ?? now)) / this.duration);

    this.apply(this.easing(t));
  }

  // -- internals --

  /**
   * Resolve the animation into `ChannelWrite`s against the live elements.
   * Idempotent — the first capture wins, so a queued animation still picks
   * up the state its predecessor left, and a GPU-driven animation settles
   * against the values it registered with.
   * @internal
   */
  capture(): void {
    captureImpl.capture(this);
  }

  /** @internal */
  apply(e: number): void {
    applyImpl.apply(this, e);
  }

  /** @internal */
  finish(): void {
    applyImpl.finish(this);
  }
}
