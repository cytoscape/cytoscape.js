// Collection's model, relative and rendered positions and node
// dimensions (round 130 split).

import { GROUP_NODES, COL, FLAG_LOCKED, FLAG_PARENT } from '../contract.mjs';
import type { Ref } from '../contract.mjs';
import { hasListeners } from '../events.mjs';
import type { Position } from '../types.mjs';
import type { ElePositionFn } from './shared.mjs';
import type { Collection } from '../collection.mjs';

/** The `position()`/`silentPosition()` body: the getter forms (whole position, one dimension) and the setter forms, `silent` skipping the events. */
export function _positionImpl(
  self: Collection,
  dim: string | Position | undefined,
  value: number | undefined,
  silent: boolean,
): Position | number | undefined | Collection {
  // getter forms
  if (dim === undefined || (typeof dim === 'string' && value === undefined)) {
    const ref = self._refs[0];
    const store = self._store;

    if (ref == null || ref.group !== GROUP_NODES || !store.isCurrent(ref)) {
      return undefined;
    }

    // parent positions are derived: settle pending auto-bounds first
    if (store.hasCompounds()) {
      store.flushDerived();
    }

    // the hot cache (round 62.5): no Map hop at all on the array the
    // most-read accessor in the API reads
    const xy = store.nodePositions();
    const slot = ref.slot;
    const pos = { x: xy[slot * 2], y: xy[slot * 2 + 1] };

    return typeof dim === 'string' ? pos[dim as 'x' | 'y'] : pos;
  }

  // setter forms
  if (typeof dim === 'string') {
    return self._positions(dim === 'x' ? { x: value } : { y: value }, silent);
  }

  return self._positions(dim, silent);
}

/** Write positions onto every live node from a constant or a per-element callback, emitting `position` per node (and on the compound subtree) unless `silent`. */
export function _positions(
  self: Collection,
  pos: Partial<Position> | ElePositionFn,
  silent: boolean,
): Collection {
  const store = self._store;
  const wantEmit = !silent && hasListeners(self._cy._emitter, 'position');

  // a locked node holds its position against every API-tier write
  // (114.3 — v3's rule, and what locked() always promised); autolock
  // locks them all
  if (self._cy.autolock() === true) {
    return self;
  }

  const flags = store.column(COL.NODE_FLAGS) as Uint32Array;

  // constant (possibly partial) object: direct columnar write — no
  // per-element handles, callbacks, or Position allocations
  if (typeof pos !== 'function') {
    const x = pos.x ?? null;
    const y = pos.y ?? null;

    if (x == null && y == null) {
      return self;
    }

    const slots: number[] = [];
    const emitIdx: number[] | null = wantEmit ? [] : null;

    for (let i = 0; i < self.length; i++) {
      const ref = self._refs[i];

      if (
        ref.group !== GROUP_NODES ||
        !store.isCurrent(ref) ||
        (flags[ref.slot] & FLAG_LOCKED) !== 0
      ) {
        continue;
      }

      slots.push(ref.slot);

      if (emitIdx != null) {
        emitIdx.push(i);
      }
    }

    store.setPositionsConst(slots, x, y);

    if (emitIdx != null) {
      for (const i of emitIdx) {
        self._cy._emitOnEle('position', self[i]);
      }

      _emitSubtreePositions(self, emitIdx);
    }

    return self;
  }

  const posCol = store.column(COL.NODE_POSITION) as Float32Array;
  const slots: number[] = [];
  const xy: number[] = [];
  const emitIdx: number[] | null = wantEmit ? [] : null;

  for (let i = 0; i < self.length; i++) {
    const ref = self._refs[i];

    if (
      ref.group !== GROUP_NODES ||
      !store.isCurrent(ref) ||
      (flags[ref.slot] & FLAG_LOCKED) !== 0
    ) {
      continue;
    }

    const p = pos(self[i], i);

    if (p == null || (p as unknown) === false) {
      continue;
    }

    // a partial object (e.g. { y: 3 }) leaves the omitted axis unchanged,
    // matching v3's position() merge semantics
    const pp = p as { x?: number; y?: number };
    const px = pp.x ?? posCol[ref.slot * 2];
    const py = pp.y ?? posCol[ref.slot * 2 + 1];

    slots.push(ref.slot);
    xy.push(px, py);

    if (emitIdx != null) {
      emitIdx.push(i);
    }
  }

  store.setPositions(slots, xy);

  if (emitIdx != null) {
    for (const i of emitIdx) {
      self._cy._emitOnEle('position', self[i]);
    }

    _emitSubtreePositions(self, emitIdx);
  }

  return self;
}

/**
 * v3 parity: descendants moved along by a parent's position write emit
 * 'position' too — once each (members that already emitted are skipped).
 * Only called when position listeners exist.
 */
export function _emitSubtreePositions(
  self: Collection,
  emitIdx: number[],
): void {
  const store = self._store;

  if (!store.hasCompounds()) {
    return;
  }

  const emitted = new Set<number>();

  for (const i of emitIdx) {
    const ref = self._refs[i];

    if (ref.group === GROUP_NODES) {
      emitted.add(ref.slot);
    }
  }

  for (const i of emitIdx) {
    const ref = self._refs[i];

    if (
      ref.group !== GROUP_NODES ||
      !store.hasFlag(GROUP_NODES, ref.slot, FLAG_PARENT)
    ) {
      continue;
    }

    const stack: number[] = [...store.childrenOf(ref.slot)];

    while (stack.length > 0) {
      const s = stack.pop() as number;

      // a locked descendant stayed, and its subtree with it (116.3):
      // nothing moved there, so nothing to announce
      if (store.hasFlag(GROUP_NODES, s, FLAG_LOCKED)) {
        continue;
      }

      for (const kid of store.childrenOf(s)) {
        stack.push(kid);
      }

      if (!emitted.has(s)) {
        emitted.add(s);
        self._cy._emitOnEle('position', self._cy._ele(GROUP_NODES, s));
      }
    }
  }
}

/** Shift every node's position by a delta on one dimension or both, through `_positions`. */
export function _shift(
  self: Collection,
  dim: string | Position,
  value: number | undefined,
  silent: boolean,
): Collection {
  const dx =
    typeof dim === 'string'
      ? dim === 'x'
        ? (value as number)
        : 0
      : dim.x || 0;
  const dy =
    typeof dim === 'string'
      ? dim === 'y'
        ? (value as number)
        : 0
      : dim.y || 0;

  if (dx === 0 && dy === 0) {
    return self;
  }

  // a locked node holds against a shift as against any write (114.3)
  if (self._cy.autolock() === true) {
    return self;
  }

  // direct columnar offset — no callbacks or per-element Position objects
  const store = self._store;
  const wantEmit = !silent && hasListeners(self._cy._emitter, 'position');
  const slots: number[] = [];
  const emitIdx: number[] | null = wantEmit ? [] : null;
  const flags = store.column(COL.NODE_FLAGS) as Uint32Array;

  // v3's shift dedupe: an element whose ancestor is also shifted is
  // skipped — the ancestor's subtree shift moves it exactly once
  const inSet: Set<number> | null = store.hasCompounds() ? new Set() : null;

  if (inSet != null) {
    for (const ref of self._refs) {
      if (ref.group === GROUP_NODES && store.isCurrent(ref)) {
        inSet.add(ref.slot);
      }
    }
  }

  for (let i = 0; i < self.length; i++) {
    const ref = self._refs[i];

    if (
      ref.group !== GROUP_NODES ||
      !store.isCurrent(ref) ||
      (flags[ref.slot] & FLAG_LOCKED) !== 0
    ) {
      continue;
    }

    if (inSet != null) {
      let ancestorInSet = false;

      for (let p = store.parentOf(ref.slot); p >= 0; p = store.parentOf(p)) {
        if (inSet.has(p)) {
          ancestorInSet = true;
          break;
        }
      }

      if (ancestorInSet) {
        continue;
      }
    }

    slots.push(ref.slot);

    if (emitIdx != null) {
      emitIdx.push(i);
    }
  }

  store.shiftPositions(slots, dx, dy);

  if (emitIdx != null) {
    for (const i of emitIdx) {
      self._cy._emitOnEle('position', self[i]);
    }

    _emitSubtreePositions(self, emitIdx);
  }

  return self;
}

/**
 * Compound-relative position: the model position minus the immediate
 * parent's (derived) position — the model position for orphans and
 * compound-free graphs (round 14.3, v3 semantics).
 *
 * @param dim — omit to read the pair, 'x' / 'y' to read one axis, or
 *   pass a `{ x, y }` (with no `value`) to write both
 * @param value — the relative coordinate to write, when `dim` names an axis
 * @returns the position or coordinate when reading, this when writing
 */
export function relativePosition(
  self: Collection,
  dim?: string | Position,
  value?: number,
): Position | number | undefined | Collection {
  const store = self._store;

  if (!store.hasCompounds()) {
    return self._positionImpl(dim, value, false);
  }

  // getter forms
  if (dim === undefined || (typeof dim === 'string' && value === undefined)) {
    const pos = self._positionImpl(undefined, undefined, false) as
      | Position
      | undefined;

    if (pos == null) {
      return undefined;
    }

    const origin = _relOrigin(self, self._refs[0]);
    const rel = { x: pos.x - origin.x, y: pos.y - origin.y };

    return typeof dim === 'string' ? rel[dim as 'x' | 'y'] : rel;
  }

  // setter forms: model = parent origin + rel, resolved per element
  if (typeof dim === 'string') {
    return self._positions((ele) => {
      const prev = ele.relativePosition() as Position;
      const origin = _relOrigin(ele, ele._refs[0]);
      const rx = dim === 'x' ? (value as number) : prev.x;
      const ry = dim === 'y' ? (value as number) : prev.y;

      return { x: origin.x + rx, y: origin.y + ry };
    }, false);
  }

  return self._positions((ele) => {
    const origin = _relOrigin(ele, ele._refs[0]);

    return {
      x: origin.x + (dim as Position).x,
      y: origin.y + (dim as Position).y,
    };
  }, false);
}

/** The immediate parent's position ({0, 0} for orphans); flushes first. */
export function _relOrigin(self: Collection, ref: Ref): Position {
  const store = self._store;

  store.flushDerived();

  const p = store.parentOf(ref.slot);

  if (p < 0) {
    return { x: 0, y: 0 };
  }

  const xy = store.column(COL.NODE_POSITION) as Float32Array;

  return { x: xy[p * 2], y: xy[p * 2 + 1] };
}

/**
 * Get or set the first element's position in rendered (CSS px) space —
 * `position()` put through the current pan and zoom.  Writing
 * unprojects back to model space, so the element lands under the given
 * screen point at the current viewport.
 *
 * @param dim — `'x'`/`'y'`, or a `{ x, y }` object to write both;
 *   omit to read the pair
 * @param value — the new coordinate, with the `'x'`/`'y'` form
 * @returns the rendered position when reading, this collection when
 *   writing
 */
export function renderedPosition(
  self: Collection,
  dim?: string | Position,
  value?: number,
): Position | number | undefined | Collection {
  const zoom = self._cy.zoom() as number;
  const pan = self._cy.pan() as Position;

  // getter forms
  if (dim === undefined || (typeof dim === 'string' && value === undefined)) {
    const pos = self.position() as Position | undefined;

    if (pos == null) {
      return undefined;
    }

    const rendered = { x: pos.x * zoom + pan.x, y: pos.y * zoom + pan.y };

    return typeof dim === 'string' ? rendered[dim as 'x' | 'y'] : rendered;
  }

  // setter forms: rendered → model
  const toModel = (rx: number, ry: number): Position => ({
    x: (rx - pan.x) / zoom,
    y: (ry - pan.y) / zoom,
  });

  if (typeof dim === 'string') {
    return self._positions((ele) => {
      const prev = ele.renderedPosition() as Position;
      const rx = dim === 'x' ? (value as number) : prev.x;
      const ry = dim === 'y' ? (value as number) : prev.y;

      return toModel(rx, ry);
    }, false);
  }

  return self._positions(toModel(dim.x, dim.y), false);
}

/**
 * The first element's width — a node's model-space width, or an edge's
 * stroke width.
 *
 * For a compound parent this is the *content* width, with the padding
 * subtracted from the stored drawn box (v3's `autoWidth`).  Mid-tween
 * this reads the exact current value: geometry tweens are
 * CPU-canonical every tick and never leased to the GPU (round 25), so
 * unlike a position tween there is no staleness window.
 *
 * @returns the width, or undefined when empty or removed
 * @see Collection#outerWidth to include the border
 */
export function width(self: Collection): number | undefined {
  const ref = self._first();

  if (ref == null || !self._store.isCurrent(ref)) {
    return undefined;
  }

  return ref.group === GROUP_NODES
    ? _nodeDim(self, ref, 0)
    : (self._store.column(COL.EDGE_WIDTH) as Float32Array)[ref.slot * 2];
}

/**
 * The first element's height — a node's model-space height, or an
 * edge's stroke width (as in v3, where an edge's `height` is its
 * width).
 *
 * For a compound parent this is the *content* height: the column
 * stores the padded drawn box, so the padding is subtracted here
 * (v3's `autoHeight`).  Mid-tween this reads the exact current value:
 * geometry tweens are CPU-canonical every tick and never leased to the
 * GPU (round 25).
 *
 * @returns the height, or undefined when empty or removed
 */
export function height(self: Collection): number | undefined {
  const ref = self._first();

  if (ref == null || !self._store.isCurrent(ref)) {
    return undefined;
  }

  return ref.group === GROUP_NODES
    ? _nodeDim(self, ref, 1)
    : (self._store.column(COL.EDGE_WIDTH) as Float32Array)[ref.slot * 2];
}

/** A node's core width/height: for parents the column stores the
 * padded/drawn box (auto-bounds, round 14.3), so the readback
 * subtracts the padding — v3's autoWidth/autoHeight. */
export function _nodeDim(self: Collection, ref: Ref, axis: 0 | 1): number {
  const store = self._store;

  if (
    store.hasCompounds() &&
    store.hasFlag(GROUP_NODES, ref.slot, FLAG_PARENT)
  ) {
    store.flushDerived();

    const size = store.column(COL.NODE_SIZE) as Float32Array;

    // the per-axis sums, so asymmetric per-side padding (85.4)
    // still reads back the true core size
    return size[ref.slot * 2 + axis] - store.paddingSumsOf(ref.slot)[axis];
  }

  return (store.column(COL.NODE_SIZE) as Float32Array)[ref.slot * 2 + axis];
}
