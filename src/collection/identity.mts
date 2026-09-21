// Collection's identity and comparison (round 130 split): `indexOf`,
// `json`, `same`/`anySame`/`contains` and the loop test.

import {
  GROUP_EDGES,
  GROUP_NODES,
  COL,
  FLAG_GRABBABLE,
  FLAG_LOCKED,
} from '../contract.mjs';
import type { Position } from '../types.mjs';
import { packRef, assertCollection } from './shared.mjs';
import type { Collection } from '../collection.mjs';

/**
 * Index of an element within this collection.
 *
 * Public in v4 by decision (round 90) — v3 kept its counterpart internal.
 *
 * @param ele — the element to find; only its first element is used
 * @returns the index, or -1 when it is not in this collection
 */
export function indexOf(self: Collection, ele: Collection): number {
  // same-instance collections skip the full guard on one identity
  // compare (round 62.6); anything else takes the 29.3/48.4 throw
  if (ele == null || ele._cy !== self._cy) {
    assertCollection(ele, 'indexOf', self._cy);
  }

  const ref = ele.__refs[0];

  if (ref == null) {
    return -1;
  }

  // isCurrent repairs a forwarded ref in place, so the packed key
  // below is its current identity without the full getter sync
  self._store.isCurrent(ref);

  // O(1) off the shared packed-key cache (34.1), which set membership
  // builds anyway; a linear re-packing scan was 81× v3 here
  return self._keySet().get(packRef(ref)) ?? -1;
}

/**
 * Position of the element with this id within the collection.
 *
 * Public in v4 by decision (round 90) — v3 kept its counterpart internal.
 *
 * @param id — the element id
 * @returns the index, or -1 when absent
 */
export function indexOfId(self: Collection, id: string): number {
  // Lazily-built id → index map, sound for the same reason `_keys`
  // is: `_refs` is immutable, ids are immutable, and a removed
  // member's handle keeps its cached `_id` — which is exactly what
  // the linear scan compared, so the map preserves the
  // still-answers-for-removed-elements contract round 34.1 kept
  // self method out of the id index for (round 62.4: the scan read
  // 0.02× against v3's indexed lookup).
  let map = self._idIdx;

  if (map == null) {
    map = new Map();

    for (let i = self.length - 1; i >= 0; i--) {
      const id0 = self[i]._id;

      if (id0 != null) {
        map.set(id0, i);
      }
    }

    self._idIdx = map;
  }

  const at = map.get(id);

  return at === undefined ? -1 : at;
}

/**
 * Plain-object form of the first element (undefined when empty).
 *
 * @returns the definition-form object for the **first** element, or
 *   undefined when the collection is empty; it round-trips through
 *   `cy.add()`, which is the supported restore path since `cy.json()`'s
 *   import form is not in v4
 */
export function json(self: Collection): Record<string, unknown> | undefined {
  const ref = self._first();

  if (ref == null) {
    return undefined;
  }

  const group = self._group ?? ref.group;
  const data = (self.data() as Record<string, unknown>) ?? { id: self.id() };
  const json: Record<string, unknown> = {
    group,
    data,
    removed: self.removed(),
    selected: self.selected(),
    selectable: self.selectable(),
    locked: self._hasBit(FLAG_LOCKED), // the node's own flag, not autolock's
    // the raw grabbable field, not the pannable-overridden getter (as in v3 json)
    grabbable: self._hasBit(FLAG_GRABBABLE),
    pannable: self.pannable(),
    classes: '',
  };

  if (group === GROUP_NODES) {
    json.position = (self.position() as Position | undefined) ?? {
      x: 0,
      y: 0,
    };
  }

  return json;
}

/** Whether the first edge is a self-loop (`wantLoop`) or not; false for a non-edge. */
export function _isLoop(self: Collection, wantLoop: boolean): boolean {
  const ref = self._first();

  if (ref == null || ref.group !== GROUP_EDGES || !self._store.isCurrent(ref)) {
    return false;
  }

  const endpoints = self._store.column(COL.EDGE_ENDPOINTS) as Uint32Array;
  const isLoop = endpoints[ref.slot * 2] === endpoints[ref.slot * 2 + 1];

  return wantLoop ? isLoop : !isLoop;
}

/**
 * Whether both collections hold exactly the same elements, ignoring
 * order.
 *
 * @param other — the collection to compare against
 * @returns true when the element sets are equal
 */
export function same(self: Collection, other: Collection): boolean {
  assertCollection(other, 'same', self._cy);

  if (self === other) {
    return true;
  }
  if (self.length !== other.length) {
    return false;
  }

  const keys = self._keySet();
  const or = other._refs;

  for (let i = 0; i < or.length; i++) {
    if (!keys.has(packRef(or[i]))) {
      return false;
    }
  }

  return true;
}

/**
 * Whether the two collections share at least one element.
 *
 * @param other — the collection to compare against
 * @returns true when the sets intersect
 */
export function anySame(self: Collection, other: Collection): boolean {
  assertCollection(other, 'anySame', self._cy);

  if (self === other) {
    return self.length > 0;
  }

  const keys = self._keySet();
  const or = other._refs;

  for (let i = 0; i < or.length; i++) {
    if (keys.has(packRef(or[i]))) {
      return true;
    }
  }

  return false;
}

/**
 * Whether every element of `other` is also in this collection.
 *
 * @param other — the candidate subset
 * @returns true when `other` is contained
 */
export function contains(self: Collection, other: Collection): boolean {
  assertCollection(other, 'contains', self._cy);

  if (self === other) {
    return true;
  }
  if (other.length > self.length) {
    return false;
  }

  const keys = self._keySet();
  const or = other._refs;

  for (let i = 0; i < or.length; i++) {
    if (!keys.has(packRef(or[i]))) {
      return false;
    }
  }

  return true;
}
