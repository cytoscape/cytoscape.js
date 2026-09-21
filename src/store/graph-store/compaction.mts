// GraphStore's slot compaction and stale-ref repair (round 130 split).

import {
  GROUP_EDGES,
  GROUP_NODES,
  COL,
  FLAG_ALIVE,
  NO_SLOT,
} from '../../contract.mjs';
import type { LabelStream, ColumnId, GroupName, Ref } from '../../contract.mjs';
import { rekeyMap } from './shared.mjs';
import type { GroupCompaction, GraphStore } from '../graph-store.mjs';

/**
 * Slot-moving compaction (round 19.1, store core): move live elements
 * down to a dense slot prefix per group with a **monotone** remap —
 * relative slot order is preserved, so draw order, curve bundle ranks
 * and CSR incident order are all unchanged by construction (the
 * round-19 stable-draw-order call).  Shrinks `highWater` to the live
 * count (and column capacity with it), rewrites `edge.endpoints` when
 * nodes move, fuses the id index and the insertion-order list, rebuilds
 * CSR, and marks the compacted groups `resized` so the renderer's
 * existing realloc + full re-upload path takes over.  Returns each
 * group's remap (null where nothing needed doing) for the callers that
 * hold slots — 19.2 wires the dependent store indexes, 19.3 the ref
 * forwarding, 19.4 the renderer, 19.5 the triggers; until then nothing
 * calls this in production.
 */
export function compact(gs: GraphStore): {
  nodes: GroupCompaction | null;
  edges: GroupCompaction | null;
} {
  gs.flushDerived(); // settle derived geometry before anything moves

  const edgesRes = compactGroup(gs, GROUP_EDGES);
  const nodesRes = compactGroup(gs, GROUP_NODES);

  if (nodesRes != null) {
    // endpoints hold node slots — the one column with cross-group slots
    const endpoints = gs.edges.column(COL.EDGE_ENDPOINTS) as Uint32Array;
    const remap = nodesRes.remap;
    const hw = gs.edges.highWater;

    for (let i = 0; i < hw * 2; i++) {
      endpoints[i] = remap[endpoints[i]];
    }

    if (hw > 0) {
      gs.dirty.mark(COL.EDGE_ENDPOINTS, 0, hw);
    }
  }

  if (nodesRes != null || edgesRes != null) {
    gs.adj.rebuild(
      gs.slotsOrdered(GROUP_EDGES),
      gs.edges.column(COL.EDGE_ENDPOINTS) as Uint32Array,
      gs.nodes.cap,
    );
    gs.geoEpoch++; // the slot-indexed edge-bb memo is stale wholesale
    gs._compactEpoch++; // collections invalidate cached membership sets
    gs.bumpStructureEpoch(); // and whole-graph collection caches drop
    gs.dirty.touch();
  }

  // -- dependent store indexes (19.2) --

  if (edgesRes != null) {
    gs.blob.remapSlots(edgesRes.remap);
    gs.data.remapSlots(GROUP_EDGES, edgesRes.remap);
    remapLabelStream(gs, GROUP_EDGES, edgesRes.remap);
    remapLabelStream(gs, 'edgeSource', edgesRes.remap);
    remapLabelStream(gs, 'edgeTarget', edgesRes.remap);
  }

  if (nodesRes != null) {
    gs.polyPool.remapSlots(nodesRes.remap);
    gs.imagePool.remapSlots(nodesRes.remap);
    gs.chartPool.remapSlots(nodesRes.remap);
    gs.data.remapSlots(GROUP_NODES, nodesRes.remap);
    remapLabelStream(gs, GROUP_NODES, nodesRes.remap);
    gs.hierarchy.remapSlots(nodesRes.remap, gs.nodes.gen);
    gs.opacityBase = rekeyMap(gs.opacityBase, nodesRes.remap);
    gs.parentFallback = rekeyMap(gs.parentFallback, nodesRes.remap);
  }

  if (nodesRes != null || edgesRes != null) {
    // pair/loop keys are node slots and member lists edge slots — the
    // index rebuilds both from the rewritten endpoints; derived params
    // stay valid (the remap is monotone, so bundle order is unchanged)
    gs.curves.remapSlots(edgesRes?.remap ?? null);

    // stale mapper spans carry old-coordinate ranges: replace them
    // with whole-column spans per watched key of a compacted group
    for (const group of [GROUP_NODES, GROUP_EDGES] as GroupName[]) {
      const res = group === GROUP_NODES ? nodesRes : edgesRes;

      if (res == null) {
        continue;
      }

      for (const key of Array.from(gs.mapperSpans.keys())) {
        if (key.startsWith(`${group}:`)) {
          gs.mapperSpans.delete(key);
        }
      }

      for (const key of gs.watchedKeys[group]) {
        gs.markDataWrite(group, key, 0, gs.table(group).highWater);
      }
    }

    // owner slots are baked into the renderer's glyph instances; the
    // label-dirty channel is the existing rebuild path (19.4 consumes)
    gs.markAllLabelsDirty();
  }

  return { nodes: nodesRes, edges: edgesRes };
}

/** Permute one label stream's entries, dims and dirty slots (19.2). */
export function remapLabelStream(
  gs: GraphStore,
  stream: LabelStream,
  remap: Uint32Array,
): void {
  const entries = gs.labels[stream];
  const n = Math.min(remap.length, entries.length);

  for (let s = 0; s < n; s++) {
    const d = remap[s];

    if (d === NO_SLOT || d === s) {
      continue;
    }

    entries[d] = entries[s];
    entries[s] = undefined;
  }

  gs.labelDims[stream] = rekeyMap(gs.labelDims[stream], remap);

  const dirty = new Set<number>();

  for (const s of gs.labelDirty[stream]) {
    const d = s < remap.length ? remap[s] : NO_SLOT;

    if (d !== NO_SLOT) {
      dirty.add(d);
    }
  }

  gs.labelDirty[stream] = dirty;
}

/** Compact one group's slots toward zero: every column, sidecar and index remaps through the returned `GroupCompaction`, or null when nothing moved. */
export function compactGroup(
  gs: GraphStore,
  group: GroupName,
): GroupCompaction | null {
  const table = gs.table(group);
  const hw = table.highWater;
  const flagsId: ColumnId =
    group === GROUP_NODES ? COL.NODE_FLAGS : COL.EDGE_FLAGS;
  const flags = table.column(flagsId) as Uint32Array;
  const remap = new Uint32Array(hw);
  let next = 0;
  let moved = 0;

  for (let s = 0; s < hw; s++) {
    if ((flags[s] & FLAG_ALIVE) !== 0) {
      remap[s] = next;

      if (next !== s) {
        moved++;
      }

      next++;
    } else {
      remap[s] = NO_SLOT;
    }
  }

  if (moved === 0 && next === hw) {
    return null;
  } // already dense

  // table.compact swaps in a fresh gen array, so holding the old one
  // is the pre-move snapshot the order-list fusion validates against
  const oldGen = table.gen;

  table.compact(remap, next);

  // forwarding entries for every moved element (19.3): stale refs
  // chase these chains and repair in place; identity slots need none
  const fwd = gs.forwards[group];

  for (let s = 0; s < hw; s++) {
    const d = remap[s];

    if (d === NO_SLOT || d === s) {
      continue;
    }

    fwd.set(s * 0x1000000 + oldGen[s], d * 0x1000000 + table.gen[d]);
  }

  const order = gs.order[group];
  const slots: number[] = [];
  const gens: number[] = [];

  for (let i = 0; i < order.slots.length; i++) {
    const s = order.slots[i];

    if (order.gens[i] !== oldGen[s]) {
      continue;
    } // tombstoned entry

    const d = remap[s];

    if (d === NO_SLOT) {
      continue;
    }

    slots.push(d);
    gens.push(table.gen[d]);
  }

  gs.order[group] = { slots, gens, stale: 0 };

  gs.ids.remapSlots(group, remap);
  gs.dirty.markResized(group);

  return { remap, moved, oldHighWater: hw };
}

/** Rebuild a group's insertion-order list after a compaction: the stale entries drop and the surviving slots keep their order. */
export function compactOrder(gs: GraphStore, group: GroupName): void {
  const order = gs.order[group];
  const gen = gs.table(group).gen;
  const slots: number[] = [];
  const gens: number[] = [];

  for (let i = 0; i < order.slots.length; i++) {
    const slot = order.slots[i];

    if (gen[slot] === order.gens[i]) {
      slots.push(slot);
      gens.push(order.gens[i]);
    }
  }

  gs.order[group] = { slots, gens, stale: 0 };
}

/**
 * Chase a stale ref through the forwarding chain (each compaction a
 * moved element survives adds one link) and, on reaching a live
 * identity, rewrite the ref in place.  Entries persist and compose, so
 * repair is total for any ref whose element still exists.
 */
export function repairStale(gs: GraphStore, ref: Ref): boolean {
  const fwd = gs.forwards[ref.group];

  if (fwd.size === 0) {
    return false;
  }

  let cur = fwd.get(ref.slot * 0x1000000 + ref.gen);

  if (cur == null) {
    return false;
  }

  for (;;) {
    const next = fwd.get(cur);

    if (next == null) {
      break;
    }

    cur = next;
  }

  const slot = Math.floor(cur / 0x1000000);
  const gen = cur % 0x1000000;
  const table = gs.table(ref.group);

  if (slot >= table.cap || table.gen[slot] !== gen) {
    return false;
  } // moved, then removed

  ref.slot = slot;
  ref.gen = gen;

  return true;
}
