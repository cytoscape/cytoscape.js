// The animation handle a caller holds (round 130 split).

import { Animation } from './animation.mjs';
import { AnimationManager } from './manager.mjs';

export interface Position {
  x: number;
  y: number;
}

/** A handle to a built-but-controllable animation (from `animation()`). */
export interface AnimationHandle {
  /** Enqueue and start; resolves when it completes. */
  play(): Promise<void>;
  stop(jumpToEnd?: boolean): void;
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

/**
 * The one implementation behind every `animation()` handle (round 62):
 * prototype methods instead of nine per-handle closures.  Building a
 * handle cost ~2.9 µs through tsx — the round-34 `__name` tax landing
 * on closure *creation* — against v3's ~0.5 µs, for methods that never
 * differ between handles.  The trade, stated because the closures did
 * not have it: methods read `this`, so a destructured method must be
 * re-bound by the caller, exactly as v3's own animation object behaves.
 */
export class AnimationHandleImpl implements AnimationHandle {
  private mgr: AnimationManager;
  private ani: Animation;

  /**
   * @param mgr — the core's animation manager
   * @param ani — the built animation this handle controls
   */
  constructor(mgr: AnimationManager, ani: Animation) {
    this.mgr = mgr;
    this.ani = ani;
  }

  /** Enqueue and start.
   *
   * @returns resolves when the animation completes (or is stopped) */
  play(): Promise<void> {
    this.mgr.start(this.ani);

    return this.ani.promise();
  }

  /** Stop in place, or at the targets with `jumpToEnd`.
   *
   * @param jumpToEnd — apply the final values instead of freezing */
  stop(jumpToEnd = false): void {
    this.ani.stop(jumpToEnd);
  }

  /** The completion promise.
   *
   * @returns resolves when the animation completes (or is stopped) */
  promise(): Promise<void> {
    return this.ani.promise();
  }

  /** Whether the animation is running and not paused.
   *
   * @returns true while playing */
  playing(): boolean {
    return this.ani.running && !this.ani.paused;
  }

  /** Round 24.3: freeze in place; the paused span leaves the timeline.
   *
   * @returns this handle, for chaining */
  pause(): AnimationHandle {
    this.mgr.pauseAni(this.ani);

    return this;
  }

  /** Resume a paused animation with the clock shifted (round 24.3).
   *
   * @returns this handle, for chaining */
  resume(): AnimationHandle {
    this.mgr.resumeAni(this.ani);

    return this;
  }

  /** Swap the tween's ends with elapsed remapped (round 24.3).
   *
   * @returns this handle, for chaining */
  reverse(): AnimationHandle {
    this.mgr.reverseAni(this.ani);

    return this;
  }

  /** Elapsed fraction of the duration (read-only — no scrubbing).
   *
   * @returns the fraction in [0, 1] */
  progress(): number {
    return this.ani.progress;
  }

  /** Whether the animation is paused (round 24.3).
   *
   * @returns true while paused */
  paused(): boolean {
    return this.ani.paused;
  }
}
