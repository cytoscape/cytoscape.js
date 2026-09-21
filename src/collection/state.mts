// Collection's state bits (round 130 split): the flag reads and writes
// behind selection, grab, visibility, lock, active and pannable.

import { FLAG_SELECTABLE, FLAG_SELECTED } from '../contract.mjs';
import type { Collection } from '../collection.mjs';

/** Whether the first element is live and carries the flag `bit`. */
export function _hasBit(self: Collection, bit: number): boolean {
  const ref = self._first();

  return (
    ref != null &&
    self._store.isCurrent(ref) &&
    self._store.hasFlag(ref.group, ref.slot, bit)
  );
}

/** Set or clear the flag `bit` on every element, returning the collection. */
export function _setBit(
  self: Collection,
  bit: number,
  on: boolean,
): Collection {
  self._store.flagRefs(self._refs, bit, on);

  return self;
}

/** Select or unselect every selectable element, emitting `select`/`unselect` for the elements whose state changed. */
export function _setSelected(self: Collection, selected: boolean): Collection {
  const cy = self._cy;
  const changedIdx: number[] = [];

  self._store.flagRefs(
    self._refs,
    FLAG_SELECTED,
    selected,
    FLAG_SELECTABLE,
    changedIdx,
  );

  if (changedIdx.length === 0) {
    return self;
  }

  // The restyle a selection change may need is not here: `flagRefs`
  // notifies the store's `onStateChange`, which the core wires to the
  // round-61 state refresh (the partition-record diff; refreshMapped
  // before that).  Round 57.1 wrote that hook by hand at self one
  // site and then wanted it at six more (lock, grab, activate,
  // selectify, grabify, hover), which is the argument for it living at
  // the flag choke point instead.
  const type = selected ? 'select' : 'unselect';

  if (cy._hasListeners(type)) {
    for (const i of changedIdx) {
      cy._emitOnEle(type, self[i]);
    }
  }

  return self;
}

/** show/hide (round 14.4): the store records the own state in
 * FLAG_SELF_HIDDEN and recomputes the effective FLAG_VISIBLE over
 * affected subtrees — descendants gate on hidden ancestors, and
 * hidden children leave their ancestors' auto-bounds. */
export function _setVisibility(self: Collection, on: boolean): Collection {
  self._store.setVisibility(self._refs, on);

  return self;
}
