// GraphStore's element mutation (round 130 split): add, remove, move,
// the columnar bulk loads and the slot allocator behind them.

import { ColumnTable } from '../table.mjs';
import {
  GROUP_EDGES,
  GROUP_NODES,
  DATA_TARGET,
  DATA_SOURCE,
  DATA_PARENT,
  DATA_ID,
  COL,
  FLAG_ALIVE,
  FLAG_GRABBABLE,
  FLAG_DRAWN,
  FLAG_PANNABLE,
  FLAG_SELECTABLE,
  FLAG_SELECTED,
  FLAG_VISIBLE,
} from '../../contract.mjs';
import type { LabelStream, ColumnId, GroupName } from '../../contract.mjs';
import { NO_PARENT } from '../../public-types.mjs';
import type {
  ColumnarEdges,
  ColumnarNodes,
  DataColumn,
  PackedIds,
} from '../../public-types.mjs';
import { initialFlags } from './shared.mjs';
import type { AddElementOpts, GraphStore } from '../graph-store.mjs';
import { compactOrder } from './compaction.mjs';

/**
 * Preallocate ahead of a bulk add: grows each table at most once for the
 * incoming element counts (net of reusable free slots), so the adds
 * themselves never hit the doubling cascade.
 */
export function reserve(
  gs: GraphStore,
  nodeCount: number,
  edgeCount: number,
): void {
  const minCap = (table: ColumnTable, adding: number): number =>
    table.highWater + Math.max(0, adding - table.freeCount);

  if (gs.nodes.reserve(minCap(gs.nodes, nodeCount))) {
    gs.dirty.markResized(GROUP_NODES);
  }

  if (gs.edges.reserve(minCap(gs.edges, edgeCount))) {
    gs.dirty.markResized(GROUP_EDGES);
  }
}

/**
 * Add one node at a model position, reusing a free slot when there is
 * one.  Only position and flags are written — every style column keeps
 * its zero default until the StyleEngine writes it.
 *
 * @param id — must be unused across both groups
 * @param opts — initial state bits; unset ones take v3's defaults
 * (visible, selectable, grabbable, unselected, unlocked, not pannable)
 * @returns the allocated slot
 * @throws when the id already exists
 */
export function addNode(
  gs: GraphStore,
  id: string,
  x: number,
  y: number,
  opts: AddElementOpts = {},
): number {
  const { slot, resized } = allocSlot(gs, GROUP_NODES, id);

  const pos = gs.nodes.column(COL.NODE_POSITION) as Float32Array;

  pos[slot * 2] = x;
  pos[slot * 2 + 1] = y;
  gs.geoEpoch++;

  (gs.nodes.column(COL.NODE_FLAGS) as Uint32Array)[slot] = initialFlags(
    opts,
    false,
  );

  if (!resized) {
    // resized already implies a full re-upload
    gs.dirty.mark(COL.NODE_POSITION, slot);
    gs.dirty.mark(COL.NODE_FLAGS, slot);
  }

  return slot;
}

/**
 * Add one edge between two existing nodes, given by *id* (the def
 * path; the columnar path takes payload indices instead).  Registers
 * the edge with the adjacency index and the CurveIndex — the latter
 * makes it a member of its endpoint pair's bundle, so its siblings
 * re-fan lazily.
 *
 * @param opts — as addNode, except `pannable` defaults true (v3)
 * @returns the allocated slot
 * @throws when the id already exists, or either endpoint id is not a
 * live node
 */
export function addEdge(
  gs: GraphStore,
  id: string,
  sourceId: string,
  targetId: string,
  opts: AddElementOpts = {},
): number {
  const source = gs.ids.get(sourceId);
  const target = gs.ids.get(targetId);

  if (source == null || source.group !== GROUP_NODES) {
    throw new Error(
      `Can not create edge '${id}' with nonexistant source '${sourceId}'`,
    );
  }

  if (target == null || target.group !== GROUP_NODES) {
    throw new Error(
      `Can not create edge '${id}' with nonexistant target '${targetId}'`,
    );
  }

  const { slot, resized } = allocSlot(gs, GROUP_EDGES, id);

  const endpoints = gs.edges.column(COL.EDGE_ENDPOINTS) as Uint32Array;

  endpoints[slot * 2] = source.slot;
  endpoints[slot * 2 + 1] = target.slot;

  (gs.edges.column(COL.EDGE_FLAGS) as Uint32Array)[slot] = initialFlags(
    opts,
    true,
  );

  gs.adj.addEdge(slot, source.slot, target.slot);
  maybeRebuildAdjacency(gs);
  gs.curves.onAddEdge(slot, source.slot, target.slot);

  if (!resized) {
    gs.dirty.mark(COL.EDGE_ENDPOINTS, slot);
    gs.dirty.mark(COL.EDGE_FLAGS, slot);
  }

  return slot;
}

/**
 * Columnar bulk node add: typed-array columns write straight into the
 * store (one memcpy for the contiguous fresh run), with no per-element
 * def objects.  Returns the allocated slots, index-aligned with the
 * payload arrays.  On error the graph may be partially mutated (as with
 * a mid-list throw in the def path).
 */
export function addNodesColumnar(
  gs: GraphStore,
  cols: ColumnarNodes,
  newId: () => string,
): Uint32Array {
  const count = cols.count;
  const { slots, resized, contiguousFrom } = gs.nodes.allocBulk(count);

  if (resized) {
    gs.dirty.markResized(GROUP_NODES);
  }

  registerBulk(gs, GROUP_NODES, slots, cols.ids, newId);

  const pos = gs.nodes.column(COL.NODE_POSITION) as Float32Array;

  if (cols.positions != null) {
    if (cols.positions.length < count * 2) {
      throw new Error(
        `Columnar node positions must hold ${count * 2} floats; got ${cols.positions.length}`,
      );
    }

    if (contiguousFrom < count) {
      // fresh run: one memcpy
      pos.set(
        cols.positions.subarray(contiguousFrom * 2, count * 2),
        slots[contiguousFrom] * 2,
      );
    }

    for (let i = 0; i < contiguousFrom; i++) {
      // reused slots: scattered
      pos[slots[i] * 2] = cols.positions[i * 2];
      pos[slots[i] * 2 + 1] = cols.positions[i * 2 + 1];
    }
  }

  gs.geoEpoch++;
  writeBulkFlags(gs, GROUP_NODES, slots, contiguousFrom, cols);

  // parent column (round 14.8): payload indices, sentinel = orphan;
  // linked after the flags fill so the derived bits survive it
  if (cols.parent != null) {
    if (cols.parent.length < count) {
      throw new Error(
        `Columnar node parent column must hold ${count} entries; got ${cols.parent.length}`,
      );
    }

    for (let i = 0; i < count; i++) {
      const at = cols.parent[i];

      if (at === NO_PARENT) {
        continue;
      }

      if (at >= count) {
        throw new Error(
          `Columnar node ${i} references parent index ${at} but the payload has ${count} nodes ` +
            `(columnar payloads are self-contained; use the definition form for cross-references)`,
        );
      }

      gs.setParent(slots[i], slots[at]); // cycle-guarded (warn + drop)
    }
  }

  ingestDataColumns(gs, GROUP_NODES, slots, cols.data);

  if (!resized) {
    markBulk(gs, COL.NODE_POSITION, slots);
    markBulk(gs, COL.NODE_FLAGS, slots);
  }

  return slots;
}

/**
 * Columnar bulk edge add: endpoints are indices into `nodeSlots` (the
 * same payload's nodes) — no id lookups per edge.
 */
export function addEdgesColumnar(
  gs: GraphStore,
  cols: ColumnarEdges,
  nodeSlots: Uint32Array,
  newId: () => string,
): Uint32Array {
  const count = cols.count;

  if (
    cols.sources == null ||
    cols.targets == null ||
    cols.sources.length < count ||
    cols.targets.length < count
  ) {
    throw new Error(`Columnar edges must provide ${count} sources and targets`);
  }

  for (let i = 0; i < count; i++) {
    if (
      cols.sources[i] >= nodeSlots.length ||
      cols.targets[i] >= nodeSlots.length
    ) {
      throw new Error(
        `Columnar edge ${i} references node index ` +
          `${Math.max(cols.sources[i], cols.targets[i])} but the payload has ${nodeSlots.length} nodes ` +
          `(columnar payloads are self-contained; use the definition form for cross-references)`,
      );
    }
  }

  const { slots, resized, contiguousFrom } = gs.edges.allocBulk(count);

  if (resized) {
    gs.dirty.markResized(GROUP_EDGES);
  }

  registerBulk(gs, GROUP_EDGES, slots, cols.ids, newId);

  const endpoints = gs.edges.column(COL.EDGE_ENDPOINTS) as Uint32Array;

  for (let i = 0; i < count; i++) {
    const slot = slots[i];
    const sourceSlot = nodeSlots[cols.sources[i]];
    const targetSlot = nodeSlots[cols.targets[i]];

    endpoints[slot * 2] = sourceSlot;
    endpoints[slot * 2 + 1] = targetSlot;

    // loop registration (and pair membership when the index is live)
    gs.curves.onAddEdge(slot, sourceSlot, targetSlot);
  }

  // fresh index: builds CSR in two counting passes; otherwise overlays
  gs.adj.addBulk(slots, endpoints, gs.nodes.cap);
  maybeRebuildAdjacency(gs);

  writeBulkFlags(gs, GROUP_EDGES, slots, contiguousFrom, cols);
  ingestDataColumns(gs, GROUP_EDGES, slots, cols.data);

  if (!resized) {
    markBulk(gs, COL.EDGE_ENDPOINTS, slots);
    markBulk(gs, COL.EDGE_FLAGS, slots);
  }

  return slots;
}

/**
 * Remove one edge: unlinks it from the adjacency index and its curve
 * bundle (siblings re-fan), then tombstones the slot for reuse.  The
 * slot's generation bumps, so every outstanding ref to it goes stale
 * — and stays stale, since ref repair never resurrects a removal.
 */
export function removeEdge(gs: GraphStore, slot: number): void {
  const endpoints = gs.edges.column(COL.EDGE_ENDPOINTS) as Uint32Array;

  gs.adj.removeEdge(slot, endpoints[slot * 2], endpoints[slot * 2 + 1]);
  gs.curves.onRemoveEdge(slot, endpoints[slot * 2], endpoints[slot * 2 + 1]);
  freeSlot(gs, GROUP_EDGES, slot);
  maybeRebuildAdjacency(gs);
}

/** Re-point an existing edge at new endpoint node slots (updates adjacency in place). */
export function moveEdge(
  gs: GraphStore,
  slot: number,
  source: number,
  target: number,
): void {
  const endpoints = gs.edges.column(COL.EDGE_ENDPOINTS) as Uint32Array;
  const oldSource = endpoints[slot * 2];
  const oldTarget = endpoints[slot * 2 + 1];

  if (oldSource === source && oldTarget === target) {
    return;
  }

  gs.adj.removeEdge(slot, oldSource, oldTarget);

  endpoints[slot * 2] = source;
  endpoints[slot * 2 + 1] = target;

  gs.adj.addEdge(slot, source, target);
  maybeRebuildAdjacency(gs);
  gs.curves.onMoveEdge(slot, oldSource, oldTarget, source, target);
  gs.geoEpoch++;
  gs.dirty.mark(COL.EDGE_ENDPOINTS, slot);
}

/** The node must have no incident edges or children left; the caller cascades removal of them first. */
export function removeNode(gs: GraphStore, slot: number): void {
  if (gs.adj.outDegree(slot) > 0 || gs.adj.inDegree(slot) > 0) {
    throw new Error('Can not remove a node before its incident edges');
  }

  if (gs.hierarchy.hasChildren(slot)) {
    throw new Error('Can not remove a node before its children');
  }

  gs.hierarchy.onRemoveNode(slot);
  gs.adj.clearNode(slot);
  gs.polyPool.free(slot);
  gs.setNodeImages(slot, null); // releases registry refs too (15.2)
  gs.setChart(slot, null); // frees the chart record (round 23)
  freeSlot(gs, GROUP_NODES, slot);
}

/** Sidecar data() values from a def's data object (id/source/target/parent stay first-class). */
export function setDefData(
  gs: GraphStore,
  group: GroupName,
  slot: number,
  data: Record<string, unknown> | undefined,
): void {
  if (data == null) {
    return;
  }

  for (const key of Object.keys(data)) {
    if (key === DATA_ID || key === DATA_SOURCE || key === DATA_TARGET) {
      continue;
    }

    // round 14: a node def's parent resolves as hierarchy (in a second
    // pass, once the batch's nodes all exist), never as sidecar data
    if (key === DATA_PARENT && group === GROUP_NODES) {
      continue;
    }

    gs.data.set(group, slot, key, data[key]);
    gs.markDataWrite(group, key, slot, slot + 1);
  }
}

/** Write the columnar `data` blocks of a bulk load onto the given slots, key by key, marking the data epoch once. */
export function ingestDataColumns(
  gs: GraphStore,
  group: GroupName,
  slots: Uint32Array,
  data: Record<string, DataColumn> | undefined,
): void {
  if (data == null) {
    return;
  }

  let min = Infinity;
  let max = -Infinity;

  if (gs.watchedKeys[group].size > 0 && slots.length > 0) {
    for (let i = 0; i < slots.length; i++) {
      if (slots[i] < min) {
        min = slots[i];
      }
      if (slots[i] > max) {
        max = slots[i];
      }
    }
  }

  for (const key of Object.keys(data)) {
    gs.data.ingestColumn(group, slots, key, data[key]);

    if (max >= 0) {
      gs.markDataWrite(group, key, min, max + 1);
    }
  }
}

/** Register bulk-allocated slots: ids (auto-generated on holes) + insertion order. */
export function registerBulk(
  gs: GraphStore,
  group: GroupName,
  slots: Uint32Array,
  ids: (string | undefined)[] | PackedIds | undefined,
  newId: () => string,
): void {
  gs.ids.setBulk(group, slots, ids, newId); // throws on a duplicate id

  const order = gs.order[group];
  const gen = gs.table(group).gen;

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];

    order.slots.push(slot);
    order.gens.push(gen[slot]);
  }

  gs.bumpStructureEpoch();
}

/** Default flags for the whole bulk, then per-element deviations. */
export function writeBulkFlags(
  gs: GraphStore,
  group: GroupName,
  slots: Uint32Array,
  contiguousFrom: number,
  cols: { selected?: Uint8Array; selectable?: Uint8Array },
): void {
  const flagsId: ColumnId =
    group === GROUP_NODES ? COL.NODE_FLAGS : COL.EDGE_FLAGS;
  const flags = gs.table(group).column(flagsId) as Uint32Array;
  const defaults =
    FLAG_ALIVE |
    FLAG_VISIBLE |
    FLAG_DRAWN |
    FLAG_SELECTABLE |
    FLAG_GRABBABLE |
    (group === GROUP_EDGES ? FLAG_PANNABLE : 0); // edges default pannable, as in v3
  const count = slots.length;

  if (contiguousFrom < count) {
    // fresh run: one fill
    flags.fill(defaults, slots[contiguousFrom], slots[count - 1] + 1);
  }

  for (let i = 0; i < contiguousFrom; i++) {
    flags[slots[i]] = defaults;
  }

  if (cols.selected != null) {
    for (let i = 0; i < count; i++) {
      if (cols.selected[i] !== 0) {
        flags[slots[i]] |= FLAG_SELECTED;
      }
    }
  }

  if (cols.selectable != null) {
    for (let i = 0; i < count; i++) {
      if (cols.selectable[i] === 0) {
        flags[slots[i]] &= ~FLAG_SELECTABLE;
      }
    }
  }
}

/** One coalesced dirty span covering all of `slots`. */
export function markBulk(
  gs: GraphStore,
  id: ColumnId,
  slots: Uint32Array,
): void {
  if (slots.length === 0) {
    return;
  }

  let min = slots[0];
  let max = slots[0];

  for (let i = 1; i < slots.length; i++) {
    const slot = slots[i];

    if (slot < min) {
      min = slot;
    }
    if (slot > max) {
      max = slot;
    }
  }

  gs.dirty.mark(id, min, max + 1);
}

/** Allocate a slot for a new element of `group` under `id` (which must be unused), growing the table when the free list is empty; `resized` says whether the columns reallocated. */
export function allocSlot(
  gs: GraphStore,
  group: GroupName,
  id: string,
): { slot: number; resized: boolean } {
  if (gs.ids.has(id)) {
    throw new Error(`Can not create second element with id '${id}'`);
  }

  const table = gs.table(group);
  const { slot, resized } = table.alloc();

  if (resized) {
    gs.dirty.markResized(group);
  }

  gs.ids.set(id, group, slot);

  const order = gs.order[group];

  order.slots.push(slot);
  order.gens.push(table.gen[slot]);
  gs.bumpStructureEpoch();

  return { slot, resized };
}

/** Release a slot: the id leaves the map, the adjacency and hierarchy forget the element, the slot joins the free list. */
export function freeSlot(gs: GraphStore, group: GroupName, slot: number): void {
  const id = gs.ids.idAt(group, slot);

  if (id != null) {
    gs.ids.remove(id);
  }

  if (group === GROUP_NODES) {
    // recycled slots must not inherit compound state
    gs.parentFallback.delete(slot);
    gs.opacityBase.delete(slot);
  }

  gs.data.clearSlot(group, slot);

  if (gs.labels[group][slot] != null) {
    gs.setLabel(slot, null, group);
  }

  if (group === GROUP_EDGES) {
    for (const stream of ['edgeSource', 'edgeTarget'] as LabelStream[]) {
      if (gs.labels[stream][slot] != null) {
        gs.setLabel(slot, null, stream);
      }
    }
  }

  // tombstone: cleared flags (no ALIVE bit) collapse the instance to a degenerate quad
  const flagsId: ColumnId =
    group === GROUP_NODES ? COL.NODE_FLAGS : COL.EDGE_FLAGS;

  (gs.table(group).column(flagsId) as Uint32Array)[slot] = 0;
  gs.dirty.mark(flagsId, slot);

  gs.table(group).freeSlot(slot);

  const order = gs.order[group];

  order.stale++;
  gs.bumpStructureEpoch();

  if (order.stale > order.slots.length / 2) {
    compactOrder(gs, group);
  }
}

/**
 * Rebuild the CSR adjacency when the waste meters cross the threshold:
 * stranded CSR entries (removals) plus overlay entries (post-build
 * adds) exceeding half the live entry count.  A rebuild walks the live
 * edges in insertion order — so it also folds a purely incremental
 * graph's overlay into the compact CSR shape — and O(edges) at a
 * proportional-growth threshold amortizes to O(1) per mutation.  The
 * floor keeps tiny graphs from rebuilding on every mutation.
 */
export function maybeRebuildAdjacency(gs: GraphStore): void {
  const waste = gs.adj.csrStranded + gs.adj.overlayEntries;

  // live entries = 2 × edge count, so waste > count is waste > live/2
  if (waste <= 64 || waste <= gs.edges.count) {
    return;
  }

  gs.adj.rebuild(
    gs.slotsOrdered(GROUP_EDGES),
    gs.edges.column(COL.EDGE_ENDPOINTS) as Uint32Array,
    gs.nodes.cap,
  );
}

/**
 * Coalesce a watched-key write span.  Schedules a frame via touch() —
 * deliberately not a column span, so paint-only data writes leave the
 * pick-tile cache valid.
 */
export function markDataWrite(
  gs: GraphStore,
  group: GroupName,
  key: string,
  start: number,
  end: number,
): void {
  if (!gs.watchedKeys[group].has(key)) {
    return;
  }

  const id = `${group}:${key}`;
  const span = gs.mapperSpans.get(id);

  if (span == null) {
    gs.mapperSpans.set(id, { group, key, start, end });
  } else {
    span.start = Math.min(span.start, start);
    span.end = Math.max(span.end, end);
  }

  gs.dirty.touch();
}
