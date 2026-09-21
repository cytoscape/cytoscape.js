// GraphStore's position writers (round 130 split).

import { COL, FLAG_CHILD, FLAG_PARENT } from '../../contract.mjs';
import type { GraphStore } from '../graph-store.mjs';
import { shiftSubtree } from './compound.mjs';

/**
 * Move one node.  Under compounds this carries v3's beforePositionSet
 * semantics: moving a parent translates its whole subtree by the
 * delta (so the parent's own auto-derived position then equals the
 * written one exactly), and moving a child marks its ancestor chain's
 * bounds stale.  Bumps the geometry epoch, invalidating the exact
 * curve-bb memo.
 */
export function setPosition(
  gs: GraphStore,
  slot: number,
  x: number,
  y: number,
): void {
  const pos = gs.nodes.column(COL.NODE_POSITION) as Float32Array;

  if (gs.hierarchy.hasCompounds()) {
    const flags = (gs.nodes.column(COL.NODE_FLAGS) as Uint32Array)[slot];

    if ((flags & FLAG_PARENT) !== 0) {
      // the delta is against the parent's *derived* position, so any
      // pending auto-bounds settle first (materialize never re-enters
      // setPosition, so gs can not recurse)
      gs.hierarchy.flush();

      // v3's beforePositionSet: moving a parent shifts its subtree by
      // the delta; the parent's own derived value then equals the
      // written position exactly (uniform translation), so only its
      // ancestors re-derive — unless a locked descendant stayed
      // (116.3), when shiftSubtree marks the chain above it, gs
      // parent included, to re-derive about the stayers and the movers
      const dx = x - pos[slot * 2];
      const dy = y - pos[slot * 2 + 1];

      if (dx !== 0 || dy !== 0) {
        shiftSubtree(gs, slot, dx, dy);
      }
    }

    if ((flags & FLAG_CHILD) !== 0) {
      gs.hierarchy.markAncestors(slot);
    }
  }

  pos[slot * 2] = x;
  pos[slot * 2 + 1] = y;
  gs.geoEpoch++;

  gs.dirty.mark(COL.NODE_POSITION, slot);
}

/** Bulk position write (e.g. from a layout): one coalesced dirty span.
 * With compounds, each slot takes the sequential setPosition semantics
 * (a parent's write shifts its subtree first — v3's per-element order). */
export function setPositions(
  gs: GraphStore,
  slots: number[],
  xy: number[] | Float32Array,
): void {
  if (slots.length === 0) {
    return;
  }

  if (gs.hierarchy.hasCompounds()) {
    for (let i = 0; i < slots.length; i++) {
      gs.setPosition(slots[i], xy[i * 2], xy[i * 2 + 1]);
    }

    return;
  }

  const pos = gs.nodes.column(COL.NODE_POSITION) as Float32Array;
  let min = Infinity;
  let max = -Infinity;

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];

    pos[slot * 2] = xy[i * 2];
    pos[slot * 2 + 1] = xy[i * 2 + 1];

    min = Math.min(min, slot);
    max = Math.max(max, slot);
  }

  gs.geoEpoch++;
  gs.dirty.mark(COL.NODE_POSITION, min, max + 1);
}

/**
 * Bulk constant/axis position write over node slots: sets x and/or y
 * (null leaves that axis unchanged) with one coalesced dirty span.
 */
export function setPositionsConst(
  gs: GraphStore,
  slots: ArrayLike<number>,
  x: number | null,
  y: number | null,
): void {
  if (slots.length === 0 || (x == null && y == null)) {
    return;
  }

  const pos = gs.nodes.column(COL.NODE_POSITION) as Float32Array;

  if (gs.hierarchy.hasCompounds()) {
    gs.hierarchy.flush(); // the kept axis reads derived parent positions

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];

      gs.setPosition(slot, x ?? pos[slot * 2], y ?? pos[slot * 2 + 1]);
    }

    return;
  }
  let min = Infinity;
  let max = -1;

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];

    if (x != null) {
      pos[slot * 2] = x;
    }
    if (y != null) {
      pos[slot * 2 + 1] = y;
    }

    if (slot < min) {
      min = slot;
    }
    if (slot > max) {
      max = slot;
    }
  }

  gs.geoEpoch++;
  gs.dirty.mark(COL.NODE_POSITION, min, max + 1);
}

/** Bulk position offset over node slots: one coalesced dirty span.
 * With compounds, v3's shift dedupe applies: a slot whose ancestor is
 * also in the set is skipped (the ancestor's subtree shift moves it). */
export function shiftPositions(
  gs: GraphStore,
  slots: ArrayLike<number>,
  dx: number,
  dy: number,
): void {
  if (slots.length === 0) {
    return;
  }

  if (gs.hierarchy.hasCompounds()) {
    gs.hierarchy.flush(); // offsets apply to derived parent positions

    const inSet = new Set<number>();

    for (let i = 0; i < slots.length; i++) {
      inSet.add(slots[i]);
    }

    const pos = gs.nodes.column(COL.NODE_POSITION) as Float32Array;

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      let ancestorInSet = false;

      for (
        let p = gs.hierarchy.parentOf(slot);
        p >= 0;
        p = gs.hierarchy.parentOf(p)
      ) {
        if (inSet.has(p)) {
          ancestorInSet = true;
          break;
        }
      }

      if (ancestorInSet) {
        continue;
      }

      gs.setPosition(slot, pos[slot * 2] + dx, pos[slot * 2 + 1] + dy);
    }

    return;
  }

  const pos = gs.nodes.column(COL.NODE_POSITION) as Float32Array;
  let min = Infinity;
  let max = -1;

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];

    pos[slot * 2] += dx;
    pos[slot * 2 + 1] += dy;

    if (slot < min) {
      min = slot;
    }
    if (slot > max) {
      max = slot;
    }
  }

  gs.geoEpoch++;
  gs.dirty.mark(COL.NODE_POSITION, min, max + 1);
}
