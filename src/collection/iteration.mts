// Collection's array-like iteration (round 130 split), as functions over
// the collection.  See `Collection` in ../collection.mts for the surface.

import type { Ref } from '../contract.mjs';
import type { EleFilterFn } from './shared.mjs';
import { Collection } from '../collection.mjs';

/** The interned handles as a cached dense array — the iteration
 * family's backing (round 62.5).  Internal: never handed out (the
 * public form is toArray(), which copies). */
export function _arr(self: Collection): Collection[] {
  let arr = self._eles;

  if (arr == null) {
    const n = self.length;

    arr = new Array(n);

    for (let i = 0; i < n; i++) {
      arr[i] = self[i];
    }

    self._eles = arr;
  }

  return arr;
}

/**
 * Call `fn` for each element.  Returning `false` from the callback
 * stops the iteration early, as in v3.
 *
 * With no `thisArg` the callback is plain-called, so `this` is
 * undefined inside it — v3's semantics, and deliberate: rebinding the
 * receiver per element costs about 2x on large collections.
 *
 * @param fn — `( ele, i, eles )`; return `false` to stop
 * @param thisArg — optional receiver for the callback
 * @returns this collection, for chaining
 */
export function forEach(
  self: Collection,
  fn: (ele: Collection, i: number, eles: Collection) => void | false,
  thisArg?: unknown,
): Collection {
  const arr = self._arr();
  const n = arr.length;

  // exit early like v3 when the callback returns false; a plain call when
  // there is no thisArg, like v3 — rebinding the receiver per element via
  // fn.call() costs ~2x on large collections
  if (thisArg == null) {
    for (let i = 0; i < n; i++) {
      if (fn(arr[i], i, self) === false) {
        break;
      }
    }
  } else {
    for (let i = 0; i < n; i++) {
      if (fn.call(thisArg, arr[i], i, self) === false) {
        break;
      }
    }
  }

  return self;
}

/**
 * A sub-range of the collection, with `Array#slice` semantics
 * (negative indices count from the end).
 *
 * @param start — first index, inclusive
 * @param end — last index, exclusive
 * @returns the sub-range as a new collection
 */
export function slice(
  self: Collection,
  start: number = 0,
  end: number = Collection.length,
): Collection {
  if (start < 0) {
    start = self.length + start;
  }
  if (end < 0) {
    end = self.length + end;
  }

  // the _refs getter syncs the compaction epoch first, so the copied
  // refs and handles are current together (round 62.4)
  const refs = self._refs.slice(start, end);
  const handles: Collection[] = new Array(refs.length);

  for (let i = 0; i < refs.length; i++) {
    handles[i] = self[start + i];
  }

  return new Collection(self._cy, refs, { unique: true, handles });
}

/**
 * A copy sorted by a comparator.  Note that sort order is a property
 * of the *collection*, not of drawing: v4 draw order is structural and
 * there is no `z-index`.
 *
 * @param sortFn — `( a, b )` comparator over length-1 collections; a
 *   non-function is ignored and returns this collection unchanged
 * @returns a new, sorted collection
 */
export function sort(
  self: Collection,
  sortFn: (a: Collection, b: Collection) => number,
): Collection {
  if (typeof sortFn !== 'function') {
    return self;
  }

  const sorted = self.toArray().sort(sortFn);
  // the sorted handles are self collection's own interned singletons,
  // so they pass straight through as the new collection's handles —
  // no per-element re-validation or dedupe (round 62.5)
  const refs: Ref[] = new Array(sorted.length);

  for (let i = 0; i < sorted.length; i++) {
    refs[i] = sorted[i]._refs[0];
  }

  return new Collection(self._cy, refs, { unique: true, handles: sorted });
}

/**
 * Map each element through `fn` into a plain array.
 *
 * @param fn — `( ele, i, eles )`
 * @param thisArg — optional receiver for the callback
 * @returns an array of the results
 */
export function map<T>(
  self: Collection,
  fn: (ele: Collection, i: number, eles: Collection) => T,
  thisArg?: unknown,
): T[] {
  const arr = self._arr();
  const n = arr.length;
  const array: T[] = new Array(n);

  if (thisArg == null) {
    for (let i = 0; i < n; i++) {
      array[i] = fn(arr[i], i, self);
    }
  } else {
    for (let i = 0; i < n; i++) {
      array[i] = fn.call(thisArg, arr[i], i, self);
    }
  }

  return array;
}

/**
 * Whether any element satisfies the predicate.  Short-circuits.
 *
 * @param fn — `( ele, i, eles ) => boolean`
 * @param thisArg — optional receiver for the callback
 * @returns true when at least one element matches
 */
export function some(
  self: Collection,
  fn: EleFilterFn,
  thisArg?: unknown,
): boolean {
  const arr = self._arr();

  for (let i = 0; i < arr.length; i++) {
    const ret =
      thisArg == null ? fn(arr[i], i, self) : fn.call(thisArg, arr[i], i, self);

    if (ret) {
      return true;
    }
  }

  return false;
}

/**
 * Whether every element satisfies the predicate.  Short-circuits, and
 * is vacuously true for an empty collection.
 *
 * @param fn — `( ele, i, eles ) => boolean`
 * @param thisArg — optional receiver for the callback
 * @returns true when all elements match
 */
export function every(
  self: Collection,
  fn: EleFilterFn,
  thisArg?: unknown,
): boolean {
  for (let i = 0; i < self.length; i++) {
    const ret =
      thisArg == null
        ? fn(self[i], i, self)
        : fn.call(thisArg, self[i], i, self);

    if (!ret) {
      return false;
    }
  }

  return true;
}
