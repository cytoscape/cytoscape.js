/*
The built-in `force` layout (round 18.2): the round-17 extension
contract's first production consumer — `cy.layout({ name: 'force' })`
simply wraps ForceLayoutImpl in the same CustomLayout plumbing an
external layout would use.

Executors: the CPU reference simulation always exists (headless
instances, compound graphs — a GPU lease would leave the CPU columns
the auto-bounds derivation reads stale, the 14.11 rule) and is the
correctness spec; the GPU fast path (18.3) takes over per-iteration
integration for flat rendered graphs regardless of how the run is
shown (87.2 — presentation is not what picks the executor).

Presentation (114.5): `animate: true` means what it means for every
other layout — the sim settles silently, then the nodes tween from
where they are to where they landed through the shared finisher, the
viewport fitting alongside.  `animateLive: true` is the streaming run
(the pre-114 `animate: true`): positions land per frame while the sim
runs, presenting each frame on the GPU executor.  Either way a
rendered flat-graph run is async — read positions at `layoutstop` /
`promise()`.

Overlap (114.5; the dense case rebuilt in 115): the sim is point-based,
so `avoidOverlap` (default true) separates node bodies — labels on
request (`nodeDimensionsIncludeLabels`) — after the
settle, pinned nodes as obstacles, before the component re-pack.  A
constructive rule cannot exist for a force field, so this is the one
post-pass in the layout portfolio; invisible under the tween, an
end-of-run adjustment under `animateLive` (the same class as the
re-pack shift 59.2 recorded).

Scoping: leaves only (parents derive from their placed children);
locked nodes are *pinned* — they take part in every force pair but
never move; subset scopes (`eles.layout`) simulate the subset only,
non-members ignored entirely (recorded).
*/

import { GROUP_NODES } from '../contract.mjs';
import type { LayoutComponent } from './per-component.mjs';
import type { LayoutContext, LayoutImpl } from './contract.mjs';
import type { Event } from '../event.mjs';
import type { Position } from '../public-types.mjs';
import type { Collection } from '../collection.mjs';
import type { ForceRunOptions } from './force-options.mjs';
import * as forceRunImpl from './force-run.mjs';
export { resolveForceExecutor, resolveOverlapMode } from './force-options.mjs';
export type {
  ForceExecutor,
  ForceRunOptions,
  OverlapMode,
} from './force-options.mjs';
export { separateBodies } from './force-separate.mjs';
/**
 * A disconnected component as the settle describes it to
 * `componentGroup` and `componentOrder` (121.1): its nodes, how many,
 * and the width and height of its packed body box — labels included
 * under `nodeDimensionsIncludeLabels` — as the re-pack will see them.
 * The store's positions are the pre-run ones at that point, so a
 * caller reads data from the nodes and geometry from here.
 */
export type { LayoutComponent };

/**
 * The built-in force layout (round 18; model rebuilt in round 59):
 * spring–electric with uniform-grid repulsion, degree-normalised
 * springs toward per-edge ideal lengths, component-aware
 * constant-magnitude gravity, and capped damped gradient integration
 * under d3-shaped alpha annealing.  Disconnected components lay out
 * around packed anchors and are re-packed exactly at settle
 * (`componentSpacing`), so multi-component graphs neither interleave
 * nor drift.
 *
 * It is an ordinary consumer of the round-17 extension contract — the
 * built-in is the contract's first production user, so an external
 * layout has exactly the same capabilities.
 *
 * Deviations worth knowing: GPU trajectories are not bit-stable run to
 * run because in-cell scatter order is atomic — seeded
 * bit-reproducibility is the CPU executor's guarantee, and the two
 * executors agree on invariants, not trajectories.  The settle re-pack
 * is skipped whenever the scope holds a pinned (locked) node, since a
 * re-pack translates whole components and a locked node must never
 * move.
 */
/** What a running sim exposes to the infinite run's event wiring
 * (118.3): the same four verbs on either executor. */
interface ActiveRun {
  /** node slot → sim index */
  indexOf(slot: number): number | undefined;
  setPosition(i: number, x: number, y: number): void;
  setPinned(i: number, pinned: boolean): void;
  reheat(alpha?: number): void;
  /** resume ticking after an idle */
  wake(): void;
}

export class ForceLayoutImpl implements LayoutImpl {
  /** @internal */
  stopped = false;
  /** a cancel (round 128): the loop exits as on `stop()`, and no
   * settle lands — the wrapper restores the pre-run positions
   * @internal */
  cancelled = false;
  /** the sim under way (118.3), for the drag / position / reheat wiring @internal */
  current: ActiveRun | null = null;
  /** an add or remove asked for the sim to be rebuilt on the live graph @internal */
  restartWanted = false;
  /** a rebuilt run relaxes the positions where they stand @internal */
  resumed = false;

  /**
   * Run the layout (118.3 added the infinite shape).  A one-shot run
   * is `runOnce`; an `infinite` run wires the graph's grab / free /
   * position / add / remove events to the sim and re-runs the sim on
   * the live graph whenever the topology changes, until `stop()`.
   *
   * @param ctx — the layout context
   * @returns a promise that resolves at `stop()` for an infinite run;
   *   otherwise `runOnce`'s
   */
  run(ctx: LayoutContext): void | Promise<void> {
    const options = ctx.options as ForceRunOptions;

    this.stopped = false;
    this.cancelled = false;
    this.resumed = false;
    this.restartWanted = false;

    if (options.infinite !== true) {
      return this.runOnce(ctx);
    }

    const cy = ctx.cy;
    const subset = (ctx.options as { eles?: unknown }).eles != null;
    const indexOfTarget = (target: unknown): number | undefined => {
      const ref = (target as Collection | undefined)?._eventRef?.();

      return ref != null && ref.group === GROUP_NODES
        ? this.current?.indexOf(ref.slot)
        : undefined;
    };
    const onGrab = (e: Event): void => {
      const i = indexOfTarget(e.target);

      if (i != null) {
        this.current?.setPinned(i, true);
      }
    };
    const onFree = (e: Event): void => {
      const i = indexOfTarget(e.target);

      if (i != null) {
        this.current?.setPinned(i, false);
        this.current?.reheat();
        this.current?.wake();
      }
    };
    const onPosition = (e: Event): void => {
      const i = indexOfTarget(e.target);

      if (i != null) {
        const p = (e.target as Collection).position() as Position;

        this.current?.setPosition(i, p.x, p.y);
        this.current?.reheat();
        this.current?.wake();
      }
    };
    const onTopology = (): void => {
      // a subset scope is the caller's collection and stays what it was
      if (!subset) {
        this.restartWanted = true;
        this.current?.wake();
      }
    };

    cy.on('grab', onGrab);
    cy.on('free', onFree);
    cy.on('position', onPosition);
    cy.on('add', onTopology);
    cy.on('remove', onTopology);

    return (async () => {
      try {
        do {
          this.restartWanted = false;
          ctx.refreshScope();
          await this.runOnce(ctx);
          this.resumed = true;
        } while (this.restartWanted && !this.stopped);
      } finally {
        cy.off('grab', onGrab);
        cy.off('free', onFree);
        cy.off('position', onPosition);
        cy.off('add', onTopology);
        cy.off('remove', onTopology);
        this.current = null;
      }
    })();
  }

  /**
   * Run the simulation.  Two executors, one spec: the CPU reference is
   * always available (headless instances, compound graphs, no device)
   * and is what the specs pin, while on a flat rendered graph the GPU
   * integrator takes over however the run is shown (87.2 —
   * availability-driven, not presentation-driven): seven named passes
   * plus a per-level reduce per iteration, encoded ahead of the cull
   * pass, so 100k-node layouts settle with edges and labels following
   * on-device.
   *
   * Presentation (114.5): `animateLive` streams — a presenting run owns
   * `node.position` (the tween lease), so CPU position reads are stale
   * for the duration.  Otherwise the run publishes off-mirror, the
   * screen holds the pre-run frame, and convergence triggers a single
   * readback that settles the columns — then `animate: true` tweens
   * the nodes into place through the shared finisher.  A rendered
   * flat-graph run is async either way, settling at `layoutstop` /
   * `promise()`; headless `animate: false` is the synchronous spelling.
   *
   * @param ctx — the layout context: unlocked leaf slots, live position
   *   views, O(1) CSR degrees and the bulk `setPositions` write
   * @returns a promise that resolves at convergence, or void when the
   *   run completed synchronously (headless / compound / no device
   *   with neither `animate` nor `animateLive`)
   * @internal
   */
  runOnce(ctx: LayoutContext): void | Promise<void> {
    return forceRunImpl.runOnce(this, ctx);
  }

  /**
   * Stop the simulation at the next iteration boundary, leaving nodes
   * where they have reached.  An idle infinite run is woken so the
   * stop lands (118.3).
   */
  stop(): void {
    this.stopped = true;
    this.current?.wake();
  }

  /**
   * Abandon the run (round 128): the loop exits as on `stop()`, but no
   * settle, re-pack, fit or tween lands — the wrapper puts the nodes
   * back where the run found them.
   */
  cancel(): void {
    this.cancelled = true;
    this.stop();
  }

  /**
   * Heat a running sim back up (118.3): alpha rises to `alpha` (0.3 by
   * default) and an idle infinite run resumes ticking.  A one-shot run
   * that has already converged is unaffected.
   *
   * @param alpha — the temperature to restore
   */
  reheat(alpha?: number): void {
    this.current?.reheat(alpha);
    this.current?.wake();
  }
}
