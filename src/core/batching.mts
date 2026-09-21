// Core's batching and compaction (round 130 split), as functions over the
// core, and the style-apply helpers that share the batch state.  See
// `Core` in ../core.mts for the surface.

import { refKey } from '../events.mjs';
import { GROUP_EDGES, GROUP_NODES, NO_SLOT } from '../contract.mjs';
import type { GroupName } from '../contract.mjs';
import { COMPACT_FLOOR } from '../core.mjs';
import type { BatchPending, Core } from '../core.mjs';

/**
 * The automatic trigger (19.5), checked at safe boundaries — a
 * completed removal, the outermost endBatch: compact when a group's
 * dead slots exceed its live count (the round-11 waste-over-half
 * policy) past a floor that keeps small graphs from churning.  Defers
 * silently while batching or while a GPU force run owns positions.
 */
export function _maybeCompact(core: Core): void {
  if (core._batchDepth > 0 || core._destroyed) {
    return;
  }
  if (core._renderer?.forceActive()) {
    return;
  } // re-checked on the next boundary

  for (const group of [GROUP_NODES, GROUP_EDGES] as GroupName[]) {
    const table = core._store.table(group);
    const dead = table.highWater - table.count;

    if (dead > COMPACT_FLOOR && dead > table.count) {
      core._compact();

      return;
    }
  }
}

/**
 * Slot compaction, core tier (round 19.3; the public trigger policy is
 * 19.5): settle any GPU-driven tweens (the reparent precedent), compact
 * the store, then repair the core-held slot-keyed state — the interned
 * handle pool moves with its elements (handle identity and scratch
 * survive), element-bound listener qualifiers repair in place and
 * re-key so later off() calls match, and the animation queues re-key
 * with their slot arrays re-pointed.  Throws mid-batch: the deferred
 * style refs hold slots and the flush must not straddle a remap.
 */
export function _compact(core: Core): void {
  if (core._batchDepth > 0) {
    throw new Error('Can not compact inside a batch');
  }

  if (core._renderer?.forceActive()) {
    // the sim owns node.position on-device (the 18.3 lease); moving
    // slots under it would scatter the integrator's writes — defer
    console.warn('Deferring slot compaction: a GPU force layout is running');

    return;
  }

  // GPU-driven tweens leave the device (their slot buffers hold the
  // old slots) but keep running on the CPU with repaired slot lists
  core._animations.demoteGpuAll();

  const result = core._store.compact();

  if (result.nodes == null && result.edges == null) {
    return;
  }

  _remapPool(core, GROUP_NODES, result.nodes?.remap ?? null);
  _remapPool(core, GROUP_EDGES, result.edges?.remap ?? null);

  for (const listener of core._emitter.listeners) {
    const qualifier = listener.qualifier;

    if (qualifier?.ref != null) {
      core._store.isCurrent(qualifier.ref); // repairs in place
      qualifier.key = 'ref:' + refKey(qualifier.ref);
    }
  }

  core._animations.onCompacted(core._store);
  core._styleEngine.onCompacted(); // refresh the styled-generation marks (24.1)
}

/** Move the interned singleton handles to their elements' new slots
 * (dead slots' handles drop out of the pool; holders keep dead reads). */
export function _remapPool(
  core: Core,
  group: GroupName,
  remap: Uint32Array | null,
): void {
  if (remap == null) {
    return;
  }

  const pool = core._pool[group];
  const n = Math.min(remap.length, pool.length);

  for (let s = 0; s < n; s++) {
    const ele = pool[s];

    if (ele == null) {
      continue;
    }

    pool[s] = undefined;

    const d = remap[s];

    if (d === NO_SLOT) {
      continue;
    }

    void ele._refs; // the epoch-guarded getter repairs the singleton's ref
    pool[d] = ele;
  }
}

/**
 * Open a batch: defer style application until the matching `endBatch()`.
 * Pairs nest — only the outermost `endBatch()` flushes.  Prefer
 * `batch( fn )`, which cannot leak a depth on an exception.
 *
 * @returns this core, for chaining
 */
export function startBatch(core: Core): Core {
  if (core._batchDepth === 0) {
    core._batchPending = {
      sheet: false,
      style: [],
      mapped: [],
      mappedKeys: new Set(),
    };
  }

  core._batchDepth++;

  return core;
}

/**
 * Close a batch.  At the outermost close the deferred work flushes as
 * one bulk pass — filtered to elements still live, so adding and
 * removing within the same batch costs nothing — and the automatic
 * slot-compaction trigger gets its boundary check.  A sheet change
 * during the batch subsumes the per-element work: one `applyAll()`
 * covers every live element.
 *
 * Unbalanced calls are a no-op rather than an error, matching v3.
 *
 * @returns this core, for chaining
 */
export function endBatch(core: Core): Core {
  if (core._batchDepth === 0) {
    return core;
  }

  core._batchDepth--;

  if (core._batchDepth > 0) {
    return core;
  }

  const pending = core._batchPending as BatchPending;

  core._batchPending = null;

  if (pending.sheet) {
    core._styleEngine.applyAll(); // covers every live element, so the per-slot work is subsumed
    core._maybeCompact();

    return core;
  }

  const store = core._store;
  const nodeSlots: number[] = [];
  const edgeSlots: number[] = [];

  for (const ref of pending.style) {
    if (!store.isCurrent(ref)) {
      continue;
    } // added then removed within the batch

    (ref.group === GROUP_NODES ? nodeSlots : edgeSlots).push(ref.slot);
  }

  core._styleEngine.applyBulk(GROUP_NODES, nodeSlots);
  core._styleEngine.applyBulk(GROUP_EDGES, edgeSlots);

  const mappedNodes: number[] = [];
  const mappedEdges: number[] = [];

  for (const ref of pending.mapped) {
    if (!store.isCurrent(ref)) {
      continue;
    }

    (ref.group === GROUP_NODES ? mappedNodes : mappedEdges).push(ref.slot);
  }

  const keys = [...pending.mappedKeys];

  core._styleEngine.refreshMapped(GROUP_NODES, mappedNodes, keys);
  core._styleEngine.refreshMapped(GROUP_EDGES, mappedEdges, keys);

  core._maybeCompact(); // removals inside the batch deferred to here

  return core;
}

/** Refresh style channels computed from data() (mapped channels + labels), deferred while batching. */
export function _refreshMappedStyles(
  core: Core,
  group: GroupName,
  slots: number[],
  keys: string[],
): void {
  if (core._batchPending != null) {
    for (const slot of slots) {
      core._batchPending.mapped.push(core._store.ref(group, slot));
    }

    for (const key of keys) {
      core._batchPending.mappedKeys.add(key);
    }

    return;
  }

  core._styleEngine.refreshMapped(group, slots, keys);
}

/** First style apply for freshly-added slots, deferred while batching. */
export function _applyStyle(
  core: Core,
  group: GroupName,
  slots: ArrayLike<number>,
): void {
  if (core._batchPending != null) {
    for (let i = 0; i < slots.length; i++) {
      core._batchPending.style.push(core._store.ref(group, slots[i]));
    }

    return;
  }

  core._styleEngine.applyBulk(group, slots);
}
