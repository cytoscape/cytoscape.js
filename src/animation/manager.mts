// The per-core animation manager (round 130 split): the tick loop, the
// registry and the GPU driver fleet.

import type { EasingProgram } from '../easing.mjs';
import { COL, GROUP_EDGES, GROUP_NODES } from '../contract.mjs';
import type { Ref } from '../contract.mjs';
import type { GraphStore } from '../store/graph-store.mjs';
import type { ChannelWrite } from './channels.mjs';
import { Animation } from './animation.mjs';
import { markStyleTouched } from './apply.mjs';

/** The renderer's GPU tween executor, seen by the manager. */
export interface GpuTweenSink {
  register(
    id: number,
    writes: readonly ChannelWrite[],
    start: number,
    duration: number,
    easing: EasingProgram,
  ): void;
  unregister(id: number): void;
  /**
   * Round 144: stop writing some entries of a registered batch — the
   * elements detached mid-flight (stopped, evicted, locked, removed)
   * while the rest of the animation runs on.  The CPU column already
   * holds each one's frozen value.  A sink without it has the
   * animation demoted to the CPU path instead.
   */
  detach?(id: number, column: string, indices: readonly number[]): void;
  /**
   * Round 144: the sink takes position tweens only — the worker host's
   * remote sink, which item 68 built for the layout tween; paint tweens
   * there keep the CPU path and cross as spans.
   */
  positionOnly?: boolean;
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
  /** every running element animation, once each (round 144: the tick
   * walks animations, not refs — a layout tween is one animation over
   * the whole scope, and a per-ref walk was O(nodes) a frame) */
  private all = new Set<Animation>();
  private viewportRunning: Animation[] = [];
  private onTick: () => void;
  private ticking = false;
  private raf: ((cb: (t: number) => void) => void) | null;
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
  constructor(onTick: () => void) {
    this.onTick = onTick;

    const g = globalThis as {
      requestAnimationFrame?: (cb: (t: number) => void) => void;
    };

    this.raf =
      typeof g.requestAnimationFrame === 'function'
        ? (cb) => g.requestAnimationFrame!(cb)
        : (cb) => {
            setTimeout(() => cb(now()), 16);
          };
  }

  /**
   * The renderer takes over the clock and provides the GPU tween sink.
   *
   * @param sink — the renderer's tween sink; the manager cedes its
   *   auto-loop to the render loop while it is attached
   * @param drives — false when the sink is a remote one (the worker
   *   host, round 144): its device evaluates the tweens, but the frames
   *   are drawn on another thread, so the manager keeps its own clock
   * @internal
   */
  attachDriver(sink: GpuTweenSink, drives = true): void {
    this.sink = sink;
    this.driven = drives;
  }

  /**
   * Give the clock back: settle every GPU-driven animation onto the CPU
   * columns and drop the sink.  Called when the renderer goes away.
   * @internal
   */
  detachDriver(): void {
    this.settleGpuAll();
    this.sink = null;
    this.driven = false;
  }

  /** Settle every GPU-driven animation onto the CPU columns and finish
   * it — the renderer going away.  (Round 14.11's reparent hook called
   * this too; since round 144 a reparent demotes instead, so the tweens
   * run on under the CPU-side derivations rather than stopping.)
   * @internal */
  settleGpuAll(): void {
    for (const ani of this.allRunning()) {
      if (ani.gpuId != null) {
        // released first (round 144): a settled animation left its batch
        // registered, the column leased and the kernel writing it
        this.sink?.unregister(ani.gpuId);
        ani.gpuId = null;
        ani.settleGpu(now());
      }
    }
  }

  /** Every distinct running element animation (one entry per animation,
   * however many refs it spans). */
  private allRunning(): Set<Animation> {
    return new Set(this.all);
  }

  /**
   * Slot compaction (19.4): demote every GPU-driven animation to the CPU
   * path — the device-side slot buffers hold pre-compaction slots.  Each
   * writes the exact value it reached onto the CPU columns, unregisters
   * its batch, and keeps running as a CPU tween (whose slot lists 19.3's
   * `onCompacted` repair re-points).  Unlike `settleGpuAll` (the
   * reparent path), the animation is *not* finished early.
   * @internal
   */
  demoteGpuAll(): void {
    if (this.sink == null) {
      return;
    }

    for (const ani of this.allRunning()) {
      if (ani.gpuId != null) {
        this.sink.unregister(ani.gpuId);
        ani.demoteGpu(now());
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
   * @internal
   */
  onCompacted(store: GraphStore): void {
    const next = new Map<number, Animation[]>();

    for (const ani of this.all) {
      ani.repairRefs(store);
    }

    for (const [key, arr] of this.running) {
      const isEdge = key >= 0x10000000000000;
      const rem = isEdge ? key - 0x10000000000000 : key;
      const ref: Ref = {
        group: isEdge ? GROUP_EDGES : GROUP_NODES,
        slot: Math.floor(rem / 0x1000000),
        gen: rem % 0x1000000,
      };

      store.isCurrent(ref); // repairs a forwarded identity in place
      next.set(packRef(ref), arr);
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
   * @internal
   */
  start(ani: Animation): void {
    if (ani.isViewport) {
      for (const other of [...this.viewportRunning]) {
        if ((ani.hasPan && other.hasPan) || (ani.hasZoom && other.hasZoom)) {
          other.stop(false);
        }
      }

      this.viewportRunning = this.viewportRunning.filter((a) => !a.done);
      this.viewportRunning.push(ani);
    } else {
      const cols = ani.touchedColumns();
      // allocated only when a running overlap actually exists — the
      // common case (nothing running on these refs) allocates nothing.
      // Per other animation, the refs it shares with this one: a
      // column animation gives up just those (round 144), any other is
      // stopped whole (round 21)
      let evicted: Map<Animation, Set<number>> | null = null;
      let overlaps: Map<Animation, boolean> | null = null;

      for (const ref of ani.refs) {
        const key = packRef(ref);
        const arr = this.running.get(key);

        if (arr == null) {
          continue;
        }

        for (const other of arr) {
          overlaps ??= new Map();

          let hit = overlaps.get(other);

          if (hit == null) {
            hit = false;

            for (const col of other.touchedColumns()) {
              if (cols.has(col)) {
                hit = true;
                break;
              }
            }

            overlaps.set(other, hit);
          }

          if (hit) {
            evicted ??= new Map();

            let keys = evicted.get(other);

            if (keys == null) {
              keys = new Set();
              evicted.set(other, keys);
            }

            keys.add(key);
          }
        }
      }

      if (evicted != null) {
        for (const [other, keys] of evicted) {
          if (other.perRef) {
            this.detachFrom(other, keys, false, false);
          } else {
            this.stopOne(other, false);
            this.remove(other);
          }
        }
      }

      this.all.add(ani);

      for (const ref of ani.refs) {
        const key = packRef(ref);
        const arr = this.running.get(key);

        if (arr == null) {
          this.running.set(key, [ani]);
        } else {
          arr.push(ani);
        }
      }
    }

    if (this.driven) {
      this.onTick();
    } else {
      this.schedule();
    } // wake the renderer, or auto-loop
  }

  /** Drop an animation from every ref's running set. */
  private remove(ani: Animation): void {
    this.all.delete(ani);

    for (const ref of ani.refs) {
      const key = packRef(ref);
      const arr = this.running.get(key);

      if (arr == null) {
        continue;
      }

      const filtered = arr.filter((a) => a !== ani);

      if (filtered.length === 0) {
        this.running.delete(key);
      } else {
        this.running.set(key, filtered);
      }
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
    return this.viewportRunning.length > 0 || this.all.size > 0;
  }

  /**
   * True when a specific element has a running animation.
   *
   * @param ref — the element to check
   * @returns whether anything is tweening it
   */
  isAnimating(ref: Ref): boolean {
    const arr = this.running.get(packRef(ref));

    return arr != null && arr.length > 0;
  }

  /** Whether any element animation is running at all — the O(1) gate in
   * front of per-ref queries (round 62.4).
   *
   * @returns true when any element animation is live */
  anyRunning(): boolean {
    return this.running.size > 0;
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
  stop(refs: Ref[], jumpToEnd: boolean): void {
    for (const [ani, keys] of this.touching(refs)) {
      // a column animation lets go of just these elements (round 144);
      // any other stops whole, as round 21 made it
      if (ani.perRef) {
        this.detachFrom(ani, keys, jumpToEnd, false);
      } else {
        this.stopOne(ani, jumpToEnd);
        this.remove(ani);
      }
    }
  }

  /**
   * Stop one animation whole — a handle's `stop()`.  Through the manager
   * rather than on the animation, so a GPU-driven one releases its
   * batch (round 144: a handle stopped under a sink used to leave the
   * batch registered, the column leased and the kernel writing it, for
   * good — `layout.cancel()` mid-tween on the same-thread host).
   *
   * @param ani — the animation to stop
   * @param jumpToEnd — land on the targets instead of freezing
   * @internal
   */
  stopAni(ani: Animation, jumpToEnd: boolean): void {
    if (ani.done) {
      return;
    }

    this.stopOne(ani, jumpToEnd);
    this.remove(ani);
  }

  /**
   * Elements leaving the graph (round 144): each is detached from every
   * animation that moves it, before the store frees its slot — a GPU
   * batch would otherwise go on writing a slot the next `add()` reuses.
   * An animation left with nothing to move finishes (its promise
   * resolves); the rest run on.
   *
   * @param refs — the elements about to be removed (still current)
   * @internal
   */
  dropRefs(refs: readonly Ref[]): void {
    if (this.running.size === 0) {
      return;
    }

    for (const [ani, keys] of this.touching(refs)) {
      this.detachFrom(ani, keys, false, false);
    }
  }

  /**
   * Nodes locked mid-flight (round 144; 114.3 at capture): each holds
   * where its position tween got to, as v3's step skips a locked node —
   * the rest of the animation, and the node's paint channels, run on.
   * With no refs, every running position tween (`cy.autolock( true )`).
   *
   * @param refs — the nodes just locked, or null for every node
   * @internal
   */
  lockRefs(refs: readonly Ref[] | null): void {
    if (this.running.size === 0) {
      return;
    }

    const touching =
      refs == null
        ? new Map(
            [...this.all]
              .filter((a) => a.touchedColumns().has(COL.NODE_POSITION))
              .map((a) => [a, new Set(a.refs.map(packRef))]),
          )
        : this.touching(refs);

    for (const [ani, keys] of touching) {
      if (ani.touchedColumns().has(COL.NODE_POSITION)) {
        this.detachFrom(ani, keys, false, true);
      }
    }
  }

  /** Per running animation, the packed refs of `refs` it covers. */
  private touching(refs: readonly Ref[]): Map<Animation, Set<number>> {
    const out = new Map<Animation, Set<number>>();

    for (const ref of refs) {
      const key = packRef(ref);
      const arr = this.running.get(key);

      if (arr == null) {
        continue;
      }

      for (const ani of arr) {
        let keys = out.get(ani);

        if (keys == null) {
          keys = new Set();
          out.set(ani, keys);
        }

        keys.add(key);
      }
    }

    return out;
  }

  /**
   * Detach `keys` from one animation (round 144): the entries freeze
   * (or land, with `jumpToEnd`), the device stops writing them, and a
   * ref with nothing left moving leaves the running set — so
   * `animated()` reads false for it and it can be grabbed.  An
   * animation left with nothing to move finishes.
   */
  private detachFrom(
    ani: Animation,
    keys: ReadonlySet<number>,
    jumpToEnd: boolean,
    positionOnly: boolean,
  ): void {
    const detached = ani.detach(keys, jumpToEnd, positionOnly);

    if (ani.allDetached) {
      if (ani.gpuId != null) {
        this.sink?.unregister(ani.gpuId);
        ani.gpuId = null;
        ani.gpuDriven = false;
      }

      ani.stop(false); // every value already stands where it froze
      this.remove(ani);

      return;
    }

    if (ani.gpuId != null && detached.length > 0) {
      const sink = this.sink as GpuTweenSink;

      if (sink.detach != null) {
        for (const d of detached) {
          sink.detach(ani.gpuId, d.column, d.indices);
        }
      } else {
        // a sink that cannot detach: the rest of the run goes CPU
        sink.unregister(ani.gpuId);
        ani.demoteGpu(ani.lastNow);
      }
    }

    for (const key of keys) {
      if (!ani.moves(key)) {
        this.removeKey(key, ani);
      }
    }
  }

  /** Drop one ref's entry for `ani` from the running map. */
  private removeKey(key: number, ani: Animation): void {
    const arr = this.running.get(key);

    if (arr == null) {
      return;
    }

    const filtered = arr.filter((a) => a !== ani);

    if (filtered.length === 0) {
      this.running.delete(key);
    } else {
      this.running.set(key, filtered);
    }
  }

  /**
   * The position a GPU-driven tween has drawn this node at, as of the
   * last frame (round 144) — what `position()` reads while the device
   * holds the column, where the CPU column still carries the start.
   *
   * @param ref — the node
   * @returns the tweened position, or null when no device-held tween
   *   moves it (the column is then current)
   * @internal
   */
  leasedPosition(ref: Ref): { x: number; y: number } | null {
    const key = packRef(ref);
    const arr = this.running.get(key);

    if (arr == null) {
      return null;
    }

    for (const ani of arr) {
      if (ani.gpuId != null) {
        const p = ani.leasedPosition(key);

        if (p != null) {
          return p;
        }
      }
    }

    return null;
  }

  /**
   * Stop one animation.  A GPU-driven one settles instead of plain-stopping:
   * its columns are leased to the device, so it has to write the value it
   * actually reached back onto the CPU (v3 leaves a stopped animation where
   * it got to) or the two would diverge with nothing to reconcile them.
   */
  private stopOne(ani: Animation, jumpToEnd: boolean): void {
    if (ani.gpuId == null) {
      ani.stop(jumpToEnd);
      return;
    }

    this.sink?.unregister(ani.gpuId);
    ani.gpuId = null;
    // frozen at the last frame's clock (round 144), which is what was
    // drawn and what position() read — the CPU path freezes there too
    ani.settleGpu(jumpToEnd ? ani.startMs + ani.durationMs : ani.lastNow);
  }

  /**
   * Stop every running viewport animation.
   *
   * @param jumpToEnd — finish at the target instead of freezing at the
   *   current value
   * @internal
   */
  stopViewport(jumpToEnd: boolean): void {
    for (const ani of this.viewportRunning) {
      ani.stop(jumpToEnd);
    }

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
   * @internal
   */
  pauseAni(ani: Animation): void {
    if (ani.done || ani.paused) {
      return;
    }

    if (ani.gpuId != null) {
      this.sink?.unregister(ani.gpuId);
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
   * @internal
   */
  resumeAni(ani: Animation): void {
    if (ani.done || !ani.paused) {
      return;
    }

    ani.resume();

    if (this.driven) {
      this.onTick();
    } else {
      this.schedule();
    }
  }

  /**
   * Reverse one animation in place.  A GPU-driven one leaves the device
   * at its current value first; the next advance re-registers the
   * swapped writes on the remapped clock.
   *
   * @param ani — the animation to reverse
   * @internal
   */
  reverseAni(ani: Animation): void {
    if (ani.done) {
      return;
    }

    if (ani.gpuId != null) {
      this.sink?.unregister(ani.gpuId);
      ani.gpuId = null;
      ani.gpuDriven = false;
      ani.applyNow();
    }

    ani.reverse();

    if (!ani.paused) {
      if (this.driven) {
        this.onTick();
      } else {
        this.schedule();
      }
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
   * @internal
   */
  tick(now: number): boolean {
    let finished: Animation[] | null = null;

    for (const ani of this.all) {
      if (this.advanceOne(ani, now)) {
        (finished ??= []).push(ani);
      }
    }

    if (finished != null) {
      for (const ani of finished) {
        this.remove(ani);
      }
    }

    if (this.viewportRunning.length > 0) {
      for (const ani of this.viewportRunning) {
        this.advanceOne(ani, now);
      }

      this.viewportRunning = this.viewportRunning.filter((a) => !a.done);
    }

    return this.active();
  }

  /** Advance one animation; returns true when it is finished. */
  private advanceOne(ani: Animation, now: number): boolean {
    ani.lastNow = now; // the controls' clock (pause/resume/reverse/progress)

    if (ani.done) {
      return true;
    } // completed (possibly via another queue, or stopped)

    if (ani.paused) {
      return false;
    } // frozen — and never (re-)registered on the GPU

    if (
      this.sink != null &&
      ani.gpuEligible &&
      (this.sink.positionOnly !== true || ani.positionOnly)
    ) {
      if (ani.gpuId == null) {
        ani.schedule(now);

        // capture after the delay, as the CPU path does
        if (now < ani.startMs) {
          return false;
        }

        const writes = ani.gpuBatches(now);

        ani.gpuId = ++this.gpuCounter;
        ani.gpuDriven = true;
        // the CPU columns are not written until the settle, but the
        // drawn values already left the sheet's (round 133)
        markStyleTouched(ani);
        this.sink.register(
          ani.gpuId,
          writes,
          ani.startMs,
          ani.durationMs,
          ani.easingProgram,
        );
      }

      if (now >= ani.startMs + ani.durationMs) {
        this.sink.unregister(ani.gpuId);
        ani.gpuId = null;
        ani.settleGpu(now); // writes the exact final onto the CPU columns
        return true;
      }

      return false;
    }

    return ani.tick(now);
  }

  private schedule(): void {
    if (this.ticking || this.raf == null) {
      return;
    }

    this.ticking = true;

    const loop = (t: number): void => {
      if (this.driven) {
        this.ticking = false;
        return;
      } // renderer took over the clock

      const stillActive = this.tick(t);

      this.onTick();

      if (stillActive) {
        this.raf!(loop);
      } else {
        this.ticking = false;
      }
    };

    this.raf(loop);
  }
}

/**
 * A monotonic clock in milliseconds: `performance.now()` where it exists,
 * else `Date.now()`.
 * @returns the current time in milliseconds
 */
export const now = (): number => {
  const p = globalThis as { performance?: { now(): number } };

  return p.performance != null ? p.performance.now() : Date.now();
};

const packRef = (r: Ref): number =>
  (r.group === GROUP_NODES ? 0 : 0x10000000000000) + r.slot * 0x1000000 + r.gen;
