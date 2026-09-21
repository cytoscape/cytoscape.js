// The collection module's shared helpers (round 130 split): the packed
// ref key, the membership index and the cross-instance guard, plus the
// filter callback types.

import { GROUP_NODES } from '../contract.mjs';
import type { Ref } from '../contract.mjs';
import type { Query } from '../matcher.mjs';
import type { Position } from '../types.mjs';
import type { Core } from '../core.mjs';
import { PROP } from '../style-props.mjs';
import type { Collection } from '../collection.mjs';

export type EleFilterFn = (
  ele: Collection,
  i: number,
  eles: Collection,
) => boolean;
export type ElePositionFn = (
  ele: Collection,
  i: number,
) => Position | false | undefined;

/** A subset criterion: a structured query or a per-element predicate. */
export type FilterLike = Query | EleFilterFn;

// Pack a ref into a single safe integer (group in bit 52, slot in bits 24..51,
// gen in bits 0..23) for set membership. Avoids the per-element string
// allocation of refKey() in the hot dedupe and set-operation paths, while still
// keying on the full {group, slot, gen} identity. Safe for slot < 2^28 and
// gen < 2^24 — far beyond any practical graph.
/** A ref packed into one safe integer: the group in the top bit, then the slot and the generation. */
export const packRef = (r: Ref): number =>
  (r.group === GROUP_NODES ? 0 : 0x10000000000000) + r.slot * 0x1000000 + r.gen;

/** Model-px style props that renderedStyle() scales by the zoom. */
export const RENDERED_LENGTH_PROPS: ReadonlySet<string> = new Set([
  PROP.WIDTH,
  PROP.HEIGHT,
  PROP.BORDER_WIDTH,
  PROP.FONT_SIZE,
]);

/**
 * Guard for the methods that take another collection (29.3).  v4 has no
 * selector strings, so these take collections — but a v3-style string
 * used to reach the body and either crash with an internal TypeError
 * (`other._refs is not iterable`) or, worse, answer silently: `same('#a')`
 * returned false.
 *
 * @param other — the argument to check
 * @param method — the method name, for the message
 * @throws when `other` is not a collection
 */
export const assertCollection = (
  other: unknown,
  method: string,
  cy?: Core,
): void => {
  if (other == null || !Array.isArray((other as Collection)._refs)) {
    throw new Error(
      `${method}() takes a collection, not ${
        typeof other === 'string'
          ? `the selector string '${other}'`
          : `a ${other === null ? 'null' : typeof other}`
      } — ` +
        `v4 has no selector strings; use cy.$id( id ), a query object like ` +
        `cy.nodes({ selected: true }), or a predicate`,
    );
  }

  // Round 48.4, found by the multi-instance soak. A ref is
  // `{ group, slot, gen }` and identity keys on those three packed into an
  // integer — all of which are *per instance*, so the first node of one
  // graph and the first node of another pack identically. Every method
  // below then answered as though they were one element: `same()` was true,
  // `intersection()` returned everything, `difference()` returned nothing,
  // and `union()` silently dropped the other graph's elements entirely
  // (two graphs of two nodes united to two).
  //
  // A collection belongs to one core — mixing two is not a thing v4 can
  // represent, since `_refs` are meaningless outside their store — so the
  // answer is to refuse rather than to invent a cross-instance identity.
  // That is this repo's rule for the same shape of defect one round over:
  // round 29.3 added this guard because these twelve methods crashed on a
  // non-collection *or, in `same()`'s case, quietly returned false, which
  // reads as working code*. This is that sentence again with a different
  // wrong answer.
  if (cy != null && (other as Collection)._cy !== cy) {
    throw new Error(
      `${method}() takes a collection from the same instance — element ` +
        'identity is per instance in v4 (a ref is a slot in *this* store), so ' +
        'comparing across two cytoscape instances has no meaning',
    );
  }
};

// Round 34.1: a Map from packed key to *first index*, not a Set.  Set
// membership only ever asks `.has()`, which a Map answers identically,
// and carrying the index makes `indexOf` O(1) off the same cache
// instead of a linear scan that re-packs every ref (3.63 µs over a
// 2000-element collection, against v3's 45 ns).  One cache, two
// consumers — the shape this codebase reaches for elsewhere.
/** A map from packed ref key to first index, for membership and `indexOf` off one cache. */
export const refIndex = (refs: Ref[]): Map<number, number> => {
  const index = new Map<number, number>();

  for (let i = 0; i < refs.length; i++) {
    const key = packRef(refs[i]);

    // first index wins: collections are unique by construction, so this
    // only matters if one ever is not
    if (!index.has(key)) {
      index.set(key, i);
    }
  }

  return index;
};
