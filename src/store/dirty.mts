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

/** A consumer's folded-but-untaken state (round 106). */
interface Pending {
  spans: Map<ColumnId, Span>;
  nodes: boolean;
  edges: boolean;
  touched: boolean;
  /** an unwatched data write (extra consumers only; see `markData`) */
  data: boolean;
}

const emptyPending = (): Pending => ({
  spans: new Map(),
  nodes: false,
  edges: false,
  touched: false,
  data: false,
});

/**
 * One reader's cursor over a {@link DirtyTracker} (round 106): its
 * pending state (what peers drained on its behalf) and its invalidation
 * callbacks.  The tracker's own `take()`/`hasDirty()`/`onInvalidate()`
 * are the primary cursor's; `registerCursor()` makes the others.
 */
export class DirtyCursor {
  /** folded-but-untaken state; null when nothing is pending
   * @internal */
  pending: Pending | null = null;
  /** @internal */
  cbs: (() => void)[] = [];
  /** @internal */
  disposed = false;

  /**
   * @param tracker — the tracker this cursor reads
   * @param primary — whether this is the tracker's own (renderer) cursor,
   *   which never sees `dataWritten` and is never disposed
   */
  constructor(
    private readonly tracker: DirtyTracker,
    readonly primary: boolean,
  ) {}

  /**
   * This cursor's delta, cleared: its pending state plus the live state,
   * which is folded into every other cursor's pending on the way.
   *
   * @param nodeHighWater — the node table's current high water mark
   * @param edgeHighWater — the edge table's current high water mark
   * @returns the spans, resize flags and high water marks
   */
  take(nodeHighWater: number, edgeHighWater: number): StoreDelta {
    return this.tracker.takeFor(this, nodeHighWater, edgeHighWater);
  }

  /** Whether this cursor has anything to take. */
  hasDirty(): boolean {
    return this.tracker.hasDirtyFor(this);
  }

  /**
   * Subscribe to this cursor's invalidation (see the tracker's).
   *
   * @param cb — run on the microtask after a burst this cursor must see
   * @returns an unsubscribe function
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

  /** Unregister (idempotent): pending state and callbacks are dropped. */
  dispose(): void {
    this.tracker.release(this);
  }
}

/**
 * Tracks one coalesced `[min, end)` dirty span per column per frame, plus a
 * per-group `resized` flag (capacity growth ⇒ the renderer reallocates the
 * group's buffers and re-uploads in full).  `take()` returns-and-clears.
 * Invalidation callbacks fire at most once per microtask so a burst of
 * mutations schedules a single frame.
 *
 * Since round 106 the tracker has **consumer cursors**: `take()`,
 * `hasDirty()` and `onInvalidate()` are the primary cursor's (the
 * renderer's frame), and `registerCursor()` adds readers that cannot
 * starve it or each other.  The mutation half (`mark` / `markResized` /
 * `touch`) is unchanged — it writes one live state — and the fan-out
 * happens at drain time (drain-and-republish): the first cursor to take
 * drains the live state and folds it into every other cursor's pending
 * buffer.  With no extra cursor registered, `take()` is the one-consumer
 * code it always was.
 */
export class DirtyTracker {
  private spans: Map<ColumnId, Span>;
  private resized: { nodes: boolean; edges: boolean };
  private scheduled: boolean;
  private touched: boolean;
  /** an unwatched data write since the last drain (round 106) */
  private dataWritten: boolean;
  private readonly primary: DirtyCursor;
  /** the registered cursors beyond the primary */
  private extras: DirtyCursor[];

  /** Starts clean: no spans, neither group resized, no subscribers. */
  constructor() {
    this.spans = new Map();
    this.resized = { nodes: false, edges: false };
    this.scheduled = false;
    this.touched = false;
    this.dataWritten = false;
    this.primary = new DirtyCursor(this, true);
    this.extras = [];
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

  /**
   * Record an element data write that marks no column (round 106) — for
   * the registered cursors only, as `StoreDelta.dataWritten`; the primary
   * never sees it.  A no-op, scheduling nothing, while no cursor beyond
   * the primary is registered, so a data write costs what it did.
   */
  markData(): void {
    if (this.extras.length === 0) {
      return;
    }

    this.dataWritten = true;
    this.schedule();
  }

  /** Whether anything is pending for the primary cursor — spans, a resize, or a bare touch(). */
  hasDirty(): boolean {
    return this.hasDirtyFor(this.primary);
  }

  /**
   * The primary cursor's take: return the accumulated delta and reset to
   * clean, all at once.  A second call before the next mutation yields an
   * empty delta.  Draining is what makes the accumulated spans safe to
   * widen: nothing outlives a frame.  Any other reader registers its own
   * cursor instead ({@link registerCursor}).
   *
   * @param nodeHighWater — the node table's current high water mark
   * @param edgeHighWater — the edge table's current high water mark
   * @returns the spans, resize flags and high water marks for this frame
   */
  take(nodeHighWater: number, edgeHighWater: number): StoreDelta {
    return this.takeFor(this.primary, nodeHighWater, edgeHighWater);
  }

  /**
   * Subscribe to the primary cursor's invalidation.  Callbacks fire on a
   * microtask, once per burst of mutations, and are skipped entirely
   * when the state was already drained synchronously — so a caller that
   * mutates and then renders in the same task never schedules a
   * redundant frame.
   *
   * @param cb — run when the tracker goes from clean to dirty
   * @returns an unsubscribe function (safe to call from within `cb`;
   *   the callback list is snapshotted before dispatch)
   */
  onInvalidate(cb: () => void): () => void {
    return this.primary.onInvalidate(cb);
  }

  /**
   * Register another reader (round 106).  It starts with a full sync —
   * both groups `resized`, `touched` and `dataWritten` — since it saw
   * none of the history, and its first wake is scheduled now.
   *
   * @returns the new cursor; `dispose()` it when done
   */
  registerCursor(): DirtyCursor {
    const cursor = new DirtyCursor(this, false);

    cursor.pending = {
      spans: new Map(),
      nodes: true,
      edges: true,
      touched: true,
      data: true,
    };
    this.extras.push(cursor);
    this.schedule();

    return cursor;
  }

  /** How many cursors beyond the primary are registered. */
  cursorCount(): number {
    return this.extras.length;
  }

  /** Dispose every registered cursor (the owner is going away). */
  releaseAll(): void {
    for (const cursor of this.extras.slice()) {
      this.release(cursor);
    }
  }

  /** @internal */
  release(cursor: DirtyCursor): void {
    if (cursor.primary || cursor.disposed) {
      return;
    }

    cursor.disposed = true;
    cursor.pending = null;
    cursor.cbs = [];

    const i = this.extras.indexOf(cursor);

    if (i >= 0) {
      this.extras.splice(i, 1);
    }
  }

  /** @internal */
  hasDirtyFor(cursor: DirtyCursor): boolean {
    if (cursor.disposed) {
      return false;
    }

    if (
      this.spans.size > 0 ||
      this.resized.nodes ||
      this.resized.edges ||
      this.touched ||
      (this.dataWritten && !cursor.primary)
    ) {
      return true;
    }

    const p = cursor.pending;

    return (
      p != null &&
      (p.spans.size > 0 || p.nodes || p.edges || p.touched || p.data)
    );
  }

  /** @internal */
  takeFor(
    cursor: DirtyCursor,
    nodeHighWater: number,
    edgeHighWater: number,
  ): StoreDelta {
    if (cursor.disposed) {
      return {
        resized: { nodes: false, edges: false },
        spans: [],
        nodeHighWater,
        edgeHighWater,
      };
    }

    if (this.extras.length === 0 && cursor.pending == null) {
      // one consumer: the pre-106 drain, unchanged
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
      this.dataWritten = false;

      return delta;
    }

    const live: Pending = {
      spans: this.spans,
      nodes: this.resized.nodes,
      edges: this.resized.edges,
      touched: this.touched,
      data: this.dataWritten,
    };

    this.spans = new Map();
    this.resized = { nodes: false, edges: false };
    this.touched = false;
    this.dataWritten = false;

    // republish: every other cursor gets the live state folded in
    if (
      live.spans.size > 0 ||
      live.nodes ||
      live.edges ||
      live.touched ||
      live.data
    ) {
      if (cursor !== this.primary) {
        fold(this.primary, live);
      }

      for (const other of this.extras) {
        if (other !== cursor) {
          fold(other, live);
        }
      }
    }

    // this cursor's own answer: pending ∪ live
    const own = cursor.pending;

    cursor.pending = null;

    if (own != null) {
      for (const [column, span] of own.spans) {
        widen(live.spans, column, span);
      }

      live.nodes ||= own.nodes;
      live.edges ||= own.edges;
      live.data ||= own.data;
    }

    const spans: DirtySpan[] = [];

    for (const [column, span] of live.spans) {
      spans.push({ column, start: span.start, end: span.end });
    }

    const delta: StoreDelta = {
      resized: { nodes: live.nodes, edges: live.edges },
      spans,
      nodeHighWater,
      edgeHighWater,
    };

    if (live.data && !cursor.primary) {
      delta.dataWritten = true;
    }

    return delta;
  }

  private schedule(): void {
    if (this.scheduled) {
      return;
    }

    this.scheduled = true;

    queueMicrotask(() => {
      this.scheduled = false;

      // per-cursor wake (round 106): a cursor is skipped only when *it*
      // has nothing to take — e.g. it drained synchronously before the
      // microtask ran — so one consumer's drain never cancels another's
      // wake (the drained state sits in the others' pending buffers)
      if (this.hasDirtyFor(this.primary)) {
        for (const cb of this.primary.cbs.slice()) {
          cb();
        }
      }

      if (this.extras.length === 0) {
        return;
      }

      for (const cursor of this.extras.slice()) {
        if (!this.hasDirtyFor(cursor)) {
          continue;
        }

        for (const cb of cursor.cbs.slice()) {
          cb();
        }
      }
    });
  }
}

/** Widen `spans`' entry for `column` to cover `span` (a copy, never the object). */
function widen(spans: Map<ColumnId, Span>, column: ColumnId, span: Span): void {
  const at = spans.get(column);

  if (at == null) {
    spans.set(column, { start: span.start, end: span.end });
  } else {
    at.start = Math.min(at.start, span.start);
    at.end = Math.max(at.end, span.end);
  }
}

/** Fold drained live state into a cursor's pending buffer. */
function fold(cursor: DirtyCursor, live: Pending): void {
  const p = (cursor.pending ??= emptyPending());

  for (const [column, span] of live.spans) {
    widen(p.spans, column, span);
  }

  p.nodes ||= live.nodes;
  p.edges ||= live.edges;
  p.touched ||= live.touched;

  if (!cursor.primary) {
    p.data ||= live.data;
  }
}
