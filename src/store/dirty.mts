import type {
  ColumnId,
  DirtySpan,
  GroupName,
  StoreDelta,
} from '../contract.mjs';

interface Span {
  start: number;
  end: number;
}

/**
 * Tracks one coalesced `[min, end)` dirty span per column per frame, plus a
 * per-group `resized` flag (capacity growth ⇒ the renderer reallocates the
 * group's buffers and re-uploads in full).  `take()` returns-and-clears.
 * Invalidation callbacks fire at most once per microtask so a burst of
 * mutations schedules a single frame.
 */
export class DirtyTracker {
  private spans: Map<ColumnId, Span>;
  private resized: { nodes: boolean; edges: boolean };
  private cbs: (() => void)[];
  private scheduled: boolean;
  private touched: boolean;

  /** Starts clean: no spans, neither group resized, no subscribers. */
  constructor() {
    this.spans = new Map();
    this.resized = { nodes: false, edges: false };
    this.cbs = [];
    this.scheduled = false;
    this.touched = false;
  }

  /**
   * Mark non-column model state dirty (e.g. the label sidecar, which is
   * consumed separately from the span delta) so a frame gets scheduled and
   * `hasDirty()` reports work until the next `take()`.
   */
  touch(): void {
    this.touched = true;
    this.schedule();
  }

  /**
   * Mark `[start, end)` of a column dirty.  Marks coalesce into the one
   * span per column: a scattered write pattern widens the span rather
   * than accumulating entries, so the renderer re-uploads a contiguous
   * range (cheap) instead of tracking every touched slot (expensive) —
   * over-uploading unchanged slots inside the hull is the accepted cost.
   *
   * @param column — the column to dirty
   * @param start — first slot touched
   * @param end — one past the last slot touched; defaults to one slot
   */
  mark(column: ColumnId, start: number, end: number = start + 1): void {
    const span = this.spans.get(column);

    if (span == null) {
      this.spans.set(column, { start, end });
    } else {
      span.start = Math.min(span.start, start);
      span.end = Math.max(span.end, end);
    }

    this.schedule();
  }

  /**
   * Flag that a group's tables grew.  Capacity growth invalidates the
   * renderer's buffers wholesale, so the flag outranks the spans: the
   * consumer reallocates and re-uploads `[0, highWater)` regardless of
   * what any span says.
   *
   * @param group — the group whose capacity changed
   */
  markResized(group: GroupName): void {
    this.resized[group] = true;
    this.schedule();
  }

  /** Whether anything is pending — spans, a resize, or a bare touch(). */
  hasDirty(): boolean {
    return (
      this.spans.size > 0 ||
      this.resized.nodes ||
      this.resized.edges ||
      this.touched
    );
  }

  /**
   * Return the accumulated delta and reset to clean, all at once — there
   * is exactly one consumer (the renderer's frame), and a second call
   * before the next mutation yields an empty delta.  Draining is what
   * makes the accumulated spans safe to widen: nothing outlives a frame.
   *
   * @param nodeHighWater — the node table's current high water mark
   * @param edgeHighWater — the edge table's current high water mark
   * @returns the spans, resize flags and high water marks for this frame
   */
  take(nodeHighWater: number, edgeHighWater: number): StoreDelta {
    const spans: DirtySpan[] = [];

    for (const [column, span] of this.spans) {
      spans.push({ column, start: span.start, end: span.end });
    }

    const delta: StoreDelta = {
      resized: this.resized,
      spans,
      nodeHighWater,
      edgeHighWater,
    };

    this.spans = new Map();
    this.resized = { nodes: false, edges: false };
    this.touched = false;

    return delta;
  }

  /**
   * Subscribe to invalidation.  Callbacks fire on a microtask, once per
   * burst of mutations, and are skipped entirely when the state was
   * already drained synchronously — so a caller that mutates and then
   * renders in the same task never schedules a redundant frame.
   *
   * @param cb — run when the tracker goes from clean to dirty
   * @returns an unsubscribe function (safe to call from within `cb`;
   *   the callback list is snapshotted before dispatch)
   */
  onInvalidate(cb: () => void): () => void {
    this.cbs.push(cb);

    return () => {
      const i = this.cbs.indexOf(cb);

      if (i >= 0) {
        this.cbs.splice(i, 1);
      }
    };
  }

  private schedule(): void {
    if (this.scheduled) {
      return;
    }

    this.scheduled = true;

    queueMicrotask(() => {
      this.scheduled = false;

      if (!this.hasDirty()) {
        return;
      } // e.g. taken synchronously before the microtask ran

      for (const cb of this.cbs.slice()) {
        cb();
      }
    });
  }
}
