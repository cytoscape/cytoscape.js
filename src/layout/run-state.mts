/*
The per-run state a layout keeps while it runs (round 128), so that
`layout.cancel()` can abandon it: the scope's positions as they stood
at `run()`, the tweens the finisher started, and the one closing that
ends the run whichever way it ends.

`stop()` keeps its meaning — end here, keep what stands.  `cancel()`
abandons the run: the impl's loop exits, a running tween is dropped
where it is, the scope's node positions go back to the snapshot, the
viewport is left as it is (a fit that already applied stays; one not
yet applied never does), `layoutstop` still fires — the lifecycle
always closes, so UI that re-enables on it keeps working — carrying
`cancelled: true`, and a `promise()` rejects with `CancelledError`.
`cy.destroy()` is the last cancel: every run still open closes this
way before the renderer goes.

The snapshot is one `Float32Array` copy of the scoped leaf slots'
positions, taken once — cheap even at 500k nodes — and restored through
the store's bulk write, so the renderer sees one dirty span.
*/

import { COL, GROUP_NODES, FLAG_ALIVE, FLAG_PARENT } from '../contract.mjs';
import type { Core } from '../core.mjs';
import type { Collection } from '../collection.mjs';
import type { AnimationHandle } from '../animation.mjs';
import { CancelledError } from '../algorithms/cancel.mjs';

/** One layout run, from `run()` to its `layoutstop`. */
export class LayoutRun {
  /** set by `cancel()`; the finisher and the wrappers read it */
  cancelled = false;
  /** the run has closed (its `layoutstop` fired) */
  closed = false;
  /** the tweens the finisher started under `animate: true` */
  anis: AnimationHandle[] = [];
  /** a custom impl's `run` has settled (its wrapper's `.then` ran): a
   * later cancel closes at once rather than waiting for it */
  implSettled = false;
  /** the wrapper's hook: a custom layout resolves or rejects its
   * `promise()` here */
  onClose: ((cancelled: boolean) => void) | null = null;
  /** what `cy.destroy()` calls: the owner's own `cancel()`, so an impl
   * is asked to stop as well as the run being closed */
  cancelNow: () => void;

  private readonly cy: Core;
  private readonly layout: object;
  private readonly slots: number[];
  private readonly xy: Float32Array;
  private readonly stop: (() => void) | undefined;

  /**
   * Open a run: snapshot the scope's positions and register it.
   *
   * @param cy — the core being laid out
   * @param layout — the wrapper (the object `event.layout` carries)
   * @param eles — the scope, or undefined for the whole graph
   * @param stop — the caller's `stop` callback, called on a cancel too
   * @param cancelNow — the owner's `cancel()`, for `destroy()`
   */
  constructor(
    cy: Core,
    layout: object,
    eles: Collection | undefined,
    stop: (() => void) | undefined,
    cancelNow: () => void,
  ) {
    this.cy = cy;
    this.layout = layout;
    this.stop = stop;
    this.cancelNow = cancelNow;

    const store = cy._store;
    const slots: number[] = [];

    if (eles == null) {
      store.scanSlotsInto(
        slots,
        0,
        GROUP_NODES,
        FLAG_ALIVE | FLAG_PARENT,
        FLAG_ALIVE,
      );
    } else {
      for (const ref of eles._liveRefs()) {
        if (
          ref.group === GROUP_NODES &&
          !store.hasFlag(GROUP_NODES, ref.slot, FLAG_PARENT)
        ) {
          slots.push(ref.slot);
        }
      }
    }

    const pos = store.column(COL.NODE_POSITION) as Float32Array;
    const xy = new Float32Array(slots.length * 2);

    for (let i = 0; i < slots.length; i++) {
      xy[i * 2] = pos[slots[i] * 2];
      xy[i * 2 + 1] = pos[slots[i] * 2 + 1];
    }

    this.slots = slots;
    this.xy = xy;

    // a layout that runs again replaces its earlier run's entry
    cy._layoutRuns.get(layout)?.unregister();
    cy._layoutRuns.set(layout, this);
    cy._inflight.add(this);
  }

  /** `destroy()`'s entry point: the owner's cancel, then the close. */
  cancel(): void {
    this.cancelNow();
    this.close(true);
  }

  /**
   * End the run.  Idempotent: the first call closes, later ones are
   * ignored — so an impl settling after a cancel closed the run
   * changes nothing.
   *
   * @param cancelled — true to abandon: drop the tweens, restore the
   *   snapshot, fire `layoutstop` with `cancelled: true`
   */
  close(cancelled: boolean): void {
    if (this.closed) {
      return;
    }

    this.closed = true;
    this.unregister();

    if (cancelled) {
      this.cancelled = true;

      for (const ani of this.anis) {
        ani.stop(false);
      }

      this.anis = [];
      this.restore();
      this.stop?.();
      this.cy.emit({
        type: 'layoutstop',
        layout: this.layout,
        cancelled: true,
      });
    }

    this.onClose?.(cancelled);
  }

  /** Put the scope's leaves back where `run()` found them. */
  private restore(): void {
    const store = this.cy._store;
    const flags = store.column(COL.NODE_FLAGS) as Uint32Array;
    const slots: number[] = [];
    const xy: number[] = [];

    // a slot removed during the run is skipped; the rest go back in
    // one bulk write (one dirty span, the same path a layout takes)
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];

      if ((flags[slot] & FLAG_ALIVE) !== 0) {
        slots.push(slot);
        xy.push(this.xy[i * 2], this.xy[i * 2 + 1]);
      }
    }

    store.setPositions(slots, xy);
  }

  private unregister(): void {
    if (this.cy._layoutRuns.get(this.layout) === this) {
      this.cy._layoutRuns.delete(this.layout);
    }

    this.cy._inflight.delete(this);
  }
}

/**
 * Open a run for a layout wrapper (the built-ins and `CustomLayout`).
 *
 * @param cy — the core being laid out
 * @param layout — the wrapper
 * @param eles — the scope, or undefined for the whole graph
 * @param stop — the caller's `stop` callback
 * @param cancelNow — the wrapper's `cancel()`, for `destroy()`
 * @returns the open run
 */
export const openLayoutRun = (
  cy: Core,
  layout: object,
  eles: Collection | undefined,
  stop: (() => void) | undefined,
  cancelNow: () => void,
): LayoutRun => new LayoutRun(cy, layout, eles, stop, cancelNow);

/**
 * The run a layout object has open, if any.
 *
 * @param cy — the core
 * @param layout — the wrapper
 * @returns the open run, or undefined once it closed (or never ran)
 */
export const layoutRunOf = (cy: Core, layout: object): LayoutRun | undefined =>
  cy._layoutRuns.get(layout);

/**
 * The rejection a cancelled layout's `promise()` carries.
 *
 * @returns a fresh `CancelledError` naming the layout
 */
export const layoutCancelled = (): CancelledError =>
  new CancelledError('the layout was cancelled');
