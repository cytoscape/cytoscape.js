// GraphStore's dirty-stream consumers (round 106): the store-level half of
// the consumer cursors.  The tracker (`dirty.mts`) folds the column spans;
// this module folds the two drain-once channels the store owns beside it
// — the four blob pools' dirty ranges and the watched-key mapper spans —
// on the same drain-and-republish rule, so a second reader of the store
// (a following clone's trigger, a devtools observer) cannot starve the
// renderer's frame, or be starved by it.

import { GROUP_EDGES, GROUP_NODES } from '../../contract.mjs';
import type { DeltaConsumer, StoreDelta } from '../../contract.mjs';
import type { DirtyCursor } from '../dirty.mjs';
import type { GraphStore, MapperSpan } from '../graph-store.mjs';

/** A blob pool's dirty range, as `takeDirty()` answers it. */
export type BlobDirt = { resized: boolean; start: number; end: number };

/** The delta fields the four blob pools fill, in pool order. */
const BLOB_KEYS = ['curveBlob', 'polyBlob', 'imageBlob', 'chartBlob'] as const;

/** One consumer's folded-but-untaken store-level state. */
export interface StoreFold {
  /** per pool, in BLOB_KEYS order; null when nothing is pending */
  blobs: (BlobDirt | null)[];
  /** keyed 'group:key', as the store's own mapperSpans map */
  mapper: Map<string, MapperSpan> | null;
}

/** A fold with nothing pending. */
export const emptyFold = (): StoreFold => ({
  blobs: [null, null, null, null],
  mapper: null,
});

/** The pools, in BLOB_KEYS order. */
const pools = (gs: GraphStore) => [
  gs.blob,
  gs.polyPool,
  gs.imagePool,
  gs.chartPool,
];

/** Union two blob ranges (a resize outranks, as with columns). */
function mergeBlob(a: BlobDirt | null, b: BlobDirt | null): BlobDirt | null {
  if (a == null) {
    return b == null ? null : { ...b };
  }

  if (b == null) {
    return a;
  }

  return {
    resized: a.resized || b.resized,
    start: Math.min(a.start, b.start),
    end: Math.max(a.end, b.end),
  };
}

/** Widen a mapper-span map by one span (a copy, never the object). */
function mergeSpan(
  into: Map<string, MapperSpan>,
  id: string,
  span: MapperSpan,
): void {
  const at = into.get(id);

  if (at == null) {
    into.set(id, { ...span });
  } else {
    at.start = Math.min(at.start, span.start);
    at.end = Math.max(at.end, span.end);
  }
}

/** Every fold but `self`: the primary's and each registered consumer's. */
function others(gs: GraphStore, self: StoreFold): StoreFold[] {
  const out: StoreFold[] = [];

  if (gs.primaryFold !== self) {
    out.push(gs.primaryFold);
  }

  for (const c of gs.consumers) {
    if (c.fold !== self) {
      out.push(c.fold);
    }
  }

  return out;
}

/**
 * Drain the blob pools into `delta` for the consumer owning `self`,
 * folding what it drained into every other consumer's pending ranges.
 *
 * @param gs — the store
 * @param self — the taking consumer's fold
 * @param delta — the delta to attach the blob ranges to
 */
export function takeBlobs(
  gs: GraphStore,
  self: StoreFold,
  delta: StoreDelta,
): void {
  const all = pools(gs);
  const peers = others(gs, self);

  for (let i = 0; i < all.length; i++) {
    const live = all[i].takeDirty();

    if (live != null) {
      for (const peer of peers) {
        peer.blobs[i] = mergeBlob(peer.blobs[i], live);
      }
    }

    const own = mergeBlob(self.blobs[i], live);

    self.blobs[i] = null;

    if (own != null) {
      delta[BLOB_KEYS[i]] = own;
    }
  }
}

/**
 * Drain the watched-key mapper spans for the consumer owning `self`,
 * folding them into every other consumer's pending spans.
 *
 * @param gs — the store
 * @param self — the taking consumer's fold
 * @returns the spans, coalesced per (group, key)
 */
export function takeMapperSpans(gs: GraphStore, self: StoreFold): MapperSpan[] {
  const live = gs.mapperSpans;

  if (live.size > 0) {
    for (const peer of others(gs, self)) {
      const into = (peer.mapper ??= new Map());

      for (const [id, span] of live) {
        mergeSpan(into, id, span);
      }
    }
  }

  const own = self.mapper;

  self.mapper = null;

  if (own != null) {
    for (const [id, span] of live) {
      mergeSpan(own, id, span);
    }
  }

  const out = [...(own ?? live).values()];

  live.clear();

  return out;
}

/** A registered store consumer (see `DeltaConsumer` in the contract). */
export class StoreConsumer implements DeltaConsumer {
  /** @internal */
  readonly fold: StoreFold;
  private disposed = false;

  /**
   * @param gs — the store read
   * @param cursor — the tracker cursor carrying the column half
   */
  constructor(
    private readonly gs: GraphStore,
    private readonly cursor: DirtyCursor,
  ) {
    this.fold = emptyFold();
  }

  /**
   * This consumer's delta, cleared: derivations flushed first, then the
   * column spans and the blob ranges, each folded for the peers.
   *
   * @returns the delta; an empty one once disposed
   */
  take(): StoreDelta {
    const gs = this.gs;

    if (!this.disposed) {
      gs.flushDerived();
    }

    const delta = this.cursor.take(gs.nodes.highWater, gs.edges.highWater);

    if (!this.disposed) {
      takeBlobs(gs, this.fold, delta);
    }

    return delta;
  }

  /**
   * This consumer's watched-key data-write spans, cleared (the renderer's
   * `takeMapperSpans()` channel, per consumer).
   *
   * @returns the spans; empty once disposed
   */
  takeMapperSpans(): MapperSpan[] {
    return this.disposed ? [] : takeMapperSpans(this.gs, this.fold);
  }

  /** Whether this consumer has anything to take. */
  hasDirty(): boolean {
    return this.cursor.hasDirty();
  }

  /**
   * Subscribe to this consumer's invalidation.
   *
   * @param cb — run on the microtask after a burst this consumer must see
   * @returns an unsubscribe function
   */
  onInvalidate(cb: () => void): () => void {
    return this.cursor.onInvalidate(cb);
  }

  /** Unregister (idempotent); the other consumers are unaffected. */
  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.cursor.dispose();
    this.fold.blobs.fill(null);
    this.fold.mapper = null;

    const i = this.gs.consumers.indexOf(this);

    if (i >= 0) {
      this.gs.consumers.splice(i, 1);
    }
  }
}

/**
 * Register a store consumer.  It starts with a full sync: the tracker
 * cursor's (both groups resized), every blob pool resized over its used
 * length, and a mapper span over each watched key's whole group.
 *
 * @param gs — the store
 * @returns the consumer
 */
export function registerConsumer(gs: GraphStore): StoreConsumer {
  const consumer = new StoreConsumer(gs, gs.dirty.registerCursor());
  const all = pools(gs);

  for (let i = 0; i < all.length; i++) {
    consumer.fold.blobs[i] = { resized: true, start: 0, end: all[i].length() };
  }

  for (const group of [GROUP_NODES, GROUP_EDGES] as const) {
    const end = gs.highWater(group);

    for (const key of gs.watchedKeys[group]) {
      (consumer.fold.mapper ??= new Map()).set(`${group}:${key}`, {
        group,
        key,
        start: 0,
        end,
      });
    }
  }

  gs.consumers.push(consumer);

  return consumer;
}

/**
 * Dispose every registered consumer (the owner is being destroyed): no
 * callback of theirs fires afterwards.
 *
 * @param gs — the store
 */
export function disposeConsumers(gs: GraphStore): void {
  for (const consumer of gs.consumers.slice()) {
    consumer.dispose();
  }

  gs.dirty.releaseAll();
}
