// The movable units in a scoped layout: ordinary leaves, plus a collapsed
// parent when the scope contains none of its descendants.

import { FLAG_PARENT, GROUP_NODES } from '../contract.mjs';
import type { Ref } from '../contract.mjs';
import type { GraphStore } from '../store/graph-store.mjs';
import type { Collection } from '../collection.mjs';

/**
 * Keep leaf nodes and collapsed parents that are not shadowed by another
 * scoped node below them. Classification happens before the parent filter,
 * so parent-only scopes can move a collapsed compound as one unit while a
 * scope containing descendants follows the ordinary compound rule.
 *
 * @param store — the graph store for the scope
 * @param refs — the scope's live refs, in collection order
 * @returns refs for the movable layout units, in the same order
 */
export function layoutUnitRefs(store: GraphStore, refs: readonly Ref[]): Ref[] {
  const nodeRefs = refs.filter((ref) => ref.group === GROUP_NODES);
  const scope = new Set(nodeRefs.map((ref) => ref.slot));
  const hasScopedDescendant = new Set<number>();

  for (const ref of nodeRefs) {
    for (
      let parent = store.parentOf(ref.slot);
      parent >= 0;
      parent = store.parentOf(parent)
    ) {
      if (scope.has(parent)) {
        hasScopedDescendant.add(parent);
      }
    }
  }

  return nodeRefs.filter((ref) => {
    if (!store.hasFlag(GROUP_NODES, ref.slot, FLAG_PARENT)) {
      return true;
    }

    return store.isCollapsed(ref.slot) && !hasScopedDescendant.has(ref.slot);
  });
}

/** Return the scope's layout units as a collection in scope order. */
export function layoutUnitNodes(eles: Collection): Collection {
  return eles._spawnUnique(layoutUnitRefs(eles._store, eles._liveRefs()));
}
