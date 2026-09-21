// Core's element queries (round 130 split): the whole-graph memo, the
// structured query scan and the box scans.

import { Collection } from '../collection.mjs';
import { compileQuery } from '../matcher.mjs';
import type { FlagTest, Query } from '../matcher.mjs';
import { testCondition } from '../style-scales.mjs';
import type { CompiledCondition } from '../style-scales.mjs';
import { GROUP_EDGES, GROUP_NODES } from '../contract.mjs';
import type { GroupName, Ref } from '../contract.mjs';
import type { EleFilterFn } from '../collection.mjs';
import type { AllCache, Core } from '../core.mjs';

/**
 * The unfiltered whole-graph collections (`elements()`, `nodes()`,
 * `edges()` with no query), memoized against the store's structure
 * epoch (round 34.2).
 *
 * These are the calls an app makes in a loop, and each one was an
 * O(V+E) scan plus a handle intern per element — the whole-graph read
 * measured 121 µs at 2000 nodes against v3's 18 ns, because v3 hands
 * back a live internal collection and v4 built a fresh one every
 * time.  A v4 collection is an immutable snapshot, so the only thing
 * that can invalidate it is an element entering or leaving the graph,
 * which is exactly what the epoch counts.  Style, flag, position and
 * data writes do not move it, and a compaction does — refs would
 * self-repair anyway (19.3), but the cache drops rather than relying
 * on that.
 *
 * The visible consequence, deliberate: two calls with no structural
 * change between them now return **the same collection object**
 * where they used to return two equal ones.  Collections are
 * immutable, so nothing can observe the difference except identity
 * itself.
 */
export function _allOf(core: Core, restrict: GroupName | null): Collection {
  const epoch = core._store.structureEpoch;
  const cached = core._allCache;

  // a non-null cache is current: onStructureChange nulls it (62.5b)
  if (cached != null) {
    const hit =
      restrict == null
        ? cached.all
        : restrict === GROUP_NODES
          ? cached.nodes
          : cached.edges;

    if (hit != null) {
      return hit;
    }
  }

  const fresh = core._query(undefined, restrict);
  const slot =
    cached != null && cached.epoch === epoch
      ? cached
      : ({ epoch, all: null, nodes: null, edges: null } as AllCache);

  if (restrict == null) {
    slot.all = fresh;
    core._allEles = fresh;
  } else if (restrict === GROUP_NODES) {
    slot.nodes = fresh;
  } else {
    slot.edges = fresh;
  }

  core._allCache = slot;

  return fresh;
}

/**
 * Resolve a whole-graph query.  Structured queries compile to per-group
 * (mask, want) flag tests answered by one columnar scan — no element
 * handles, no per-element matching.  Predicate functions materialize
 * the group(s) and filter per element.  `restrict` narrows the result
 * to one group (for `cy.nodes(q)` / `cy.edges(q)`).
 */
export function _query(
  core: Core,
  query: Query | EleFilterFn | undefined,
  restrict: GroupName | null,
): Collection {
  if (typeof query === 'function') {
    // the predicate runs over the whole-graph memo (34.2), not a fresh
    // scan: `cy.filter( fn )` was compiling an empty query and
    // re-interning every element per call — 6,000 handles before the
    // predicate saw one — which is why the whole-graph pair read at v3
    // parity while `nodes().filter( fn )` on the same graph read 4x
    // faster.  Round 113.2.
    return core._allOf(restrict).filter(query);
  }

  const plan = compileQuery(query ?? {}, restrict);

  return _scanCollection(core, plan.nodes, plan.edges, plan.data);
}

/**
 * The *gesture's* box query: `elementsInBox` with this instance's
 * `boxSelectionMode` applied (round 39.1).  Internal because the mode
 * is an interaction preference — the public query stays geometric, and
 * both pointer paths (mouse/pen release and the three-finger touch box)
 * come through here so they cannot drift apart.
 */
export function _elementsInGestureBox(
  core: Core,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): Collection {
  return new Collection(
    core,
    core._store.refsInBox(
      x1,
      y1,
      x2,
      y2,
      core._boxSelectionIncludesLabels,
      core._boxSelectionMode,
    ),
    { unique: true, live: true },
  );
}

/** Collection of the live slots matching per-group flag tests (null matches nothing). */
export function _scanCollection(
  core: Core,
  nodeTest: FlagTest | null,
  edgeTest: FlagTest | null,
  dataConds: CompiledCondition[] | null = null,
): Collection {
  const store = core._store;
  const cap =
    (nodeTest == null ? 0 : store.count(GROUP_NODES)) +
    (edgeTest == null ? 0 : store.count(GROUP_EDGES));
  const refs: Ref[] = new Array(cap);
  const dataTests =
    dataConds == null
      ? undefined
      : dataConds.map((cond) => ({
          key: cond.key,
          test: (v: unknown) => testCondition(cond, v),
        }));
  let n = 0;

  if (nodeTest != null) {
    n = store.scanRefsInto(
      refs,
      n,
      GROUP_NODES,
      nodeTest.mask,
      nodeTest.want,
      dataTests,
    );
  }
  if (edgeTest != null) {
    n = store.scanRefsInto(
      refs,
      n,
      GROUP_EDGES,
      edgeTest.mask,
      edgeTest.want,
      dataTests,
    );
  }

  if (n !== refs.length) {
    refs.length = n;
  }

  return new Collection(core, refs, { unique: true, live: true });
}
