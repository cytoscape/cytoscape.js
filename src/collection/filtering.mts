// Collection's building and filtering (round 130 split): `filter`, the
// set-algebra bodies, `diff`, `reduce` and the extremum search.

import { GROUP_NODES, COL } from '../contract.mjs';
import type { Ref } from '../contract.mjs';
import { compileQuery } from '../matcher.mjs';
import { testCondition } from '../style-scales.mjs';
import { packRef, assertCollection } from './shared.mjs';
import type { FilterLike } from './shared.mjs';
import { Collection } from '../collection.mjs';

/**
 * The subset matching the criterion.
 *
 * A structured **query object** is answered directly off the flags
 * column — no per-element handles and no closures — while a
 * **predicate function** is called per element.  v4 has no selector
 * strings, so those two forms cover what v3 spelled with a selector.
 *
 * @param criterion — a query object (`{ selected: true }`,
 *   `{ data: { weight: { gt: 0.5 } } }`, …) or an
 *   `( ele, i, eles ) => boolean` predicate
 * @param thisArg — optional receiver, for the predicate form
 * @returns a new collection of the matching elements
 * @throws if a query object carries an unknown key — a typo must not
 *   silently match everything
 */
export function filter(
  self: Collection,
  criterion: FilterLike,
  thisArg?: unknown,
): Collection {
  // the result is a subset of self collection's (already unique) refs,
  // and the handles the predicate was just called with are exactly what
  // re-interning each kept ref would return — so pass them through the
  // slice path (round 62.4's `handles`) instead of paying `_eleFromRef`
  // per kept element.  Round 113.2: `nodes().filter( fn )` at 2,000
  // nodes went 127 → 107 µs through the bundle (v3: 249).
  if (typeof criterion === 'function') {
    const refs: Ref[] = [];
    const handles: Collection[] = [];
    const n = self.length;

    for (let i = 0; i < n; i++) {
      const ele = self[i];
      const include =
        thisArg == null
          ? criterion(ele, i, self)
          : criterion.call(thisArg, ele, i, self);

      if (include) {
        refs.push(self._refs[i]);
        handles.push(ele);
      }
    }

    return new Collection(self._cy, refs, { handles });
  }

  // structured query: test each ref against its group's (mask, want)
  // directly on the flags column — no per-ref handles or closures
  const store = self._store;
  const plan = compileQuery(criterion);
  const nodeTest = plan.nodes;
  const edgeTest = plan.edges;
  const nodeGen = store.nodes.gen;
  const edgeGen = store.edges.gen;
  const nodeFlags = store.column(COL.NODE_FLAGS) as Uint32Array;
  const edgeFlags = store.column(COL.EDGE_FLAGS) as Uint32Array;
  const dataConds = plan.data;
  const refs: Ref[] = [];

  for (let i = 0; i < self._refs.length; i++) {
    const ref = self._refs[i];
    const isNode = ref.group === GROUP_NODES;
    const test = isNode ? nodeTest : edgeTest;

    if (test == null) {
      continue;
    }

    if ((isNode ? nodeGen : edgeGen)[ref.slot] !== ref.gen) {
      continue;
    } // stale

    const flags = (isNode ? nodeFlags : edgeFlags)[ref.slot];

    if ((flags & test.mask) !== test.want) {
      continue;
    }

    if (dataConds != null) {
      let pass = true;

      for (const cond of dataConds) {
        if (
          !testCondition(cond, store.data.get(ref.group, ref.slot, cond.key))
        ) {
          pass = false;
          break;
        }
      }

      if (!pass) {
        continue;
      }
    }

    refs.push(ref);
  }

  return self._spawnUnique(refs);
}

/**
 * The elements in exactly one of the two collections.
 *
 * @param other — the other collection
 * @returns a new collection
 */
export function symmetricDifference(
  self: Collection,
  other: Collection,
): Collection {
  assertCollection(other, 'symmetricDifference', self._cy);

  const otherEles = other;
  const mine = self._keySet();
  const theirs = otherEles._keySet();

  // the two parts are disjoint by construction, so the result is unique
  return self._spawnUnique([
    ...self._refs.filter((ref) => !theirs.has(packRef(ref))),
    ...otherEles._refs.filter((ref) => !mine.has(packRef(ref))),
  ]);
}

/**
 * Three-way set difference against another collection.
 *
 * @param other — the collection to compare with
 * @returns `{ left: only in this, right: only in other, both: in both }`
 */
export function diff(
  self: Collection,
  other: Collection,
): {
  left: Collection;
  right: Collection;
  both: Collection;
} {
  assertCollection(other, 'diff', self._cy);

  const otherColl = other;
  const mine = self._keySet();
  const theirs = otherColl._keySet();

  return {
    left: self._spawnUnique(
      self._refs.filter((ref) => !theirs.has(packRef(ref))),
    ),
    right: self._spawnUnique(
      otherColl._refs.filter((ref) => !mine.has(packRef(ref))),
    ),
    both: self._spawnUnique(
      self._refs.filter((ref) => theirs.has(packRef(ref))),
    ),
  };
}

/**
 * Fold the collection into a single value.
 *
 * @param fn — `( accumulator, ele, i, eles )`
 * @param initial — the starting accumulator (required, unlike
 *   `Array#reduce`)
 * @returns the final accumulator
 */
export function reduce<T>(
  self: Collection,
  fn: (acc: T, ele: Collection, i: number, eles: Collection) => T,
  initial: T,
): T {
  let val = initial;

  for (let i = 0; i < self.length; i++) {
    val = fn(val, self[i], i, self);
  }

  return val;
}

/** The element and value maximising (`sign` 1) or minimising (-1) `valFn` — the body of `max` and `min`. */
export function _extremum(
  self: Collection,
  valFn: (ele: Collection, i: number, eles: Collection) => number,
  thisArg: unknown,
  sign: 1 | -1,
): { value: number; ele: Collection | undefined } {
  let best = sign * -Infinity;
  let bestEle: Collection | undefined;

  for (let i = 0; i < self.length; i++) {
    const val =
      thisArg == null
        ? valFn(self[i], i, self)
        : valFn.call(thisArg, self[i], i, self);

    if (sign * val > sign * best) {
      best = val;
      bestEle = self[i];
    }
  }

  return { value: best, ele: bestEle };
}
