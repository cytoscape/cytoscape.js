// Collection's compound hierarchy and DAG traversal (round 130 split).

import { GROUP_EDGES, GROUP_NODES, COL } from '../contract.mjs';
import type { Ref } from '../contract.mjs';
import type { FilterLike } from './shared.mjs';
import type { Collection } from '../collection.mjs';

/** Immediate parents of every node in the collection (unique).  v4
 * always returns a proper collection — v3's single-element raw-ref
 * shortcut (which also ignored the selector argument) is not ported.   *
 * @param criterion — an optional query object or predicate applied to
 *   the result, exactly as `filter()` takes it
 * @returns the immediate parents
 */
export function parent(self: Collection, criterion?: FilterLike): Collection {
  const store = self._store;
  const refs: Ref[] = [];
  const seen = new Set<number>();

  for (let i = 0; i < self._refs.length; i++) {
    const ref = self._refs[i];

    if (ref.group !== GROUP_NODES || !store.isCurrent(ref)) {
      continue;
    }

    const p = store.parentOf(ref.slot);

    if (p >= 0 && !seen.has(p)) {
      seen.add(p);
      refs.push(store.ref(GROUP_NODES, p));
    }
  }

  const eles = self._spawnLive(refs);

  return criterion == null ? eles : eles.filter(criterion);
}

/**
 * All ancestors, level by level: every nearest parent first, then the
 * grandparents, and so on (v3's iterated-parent() order).   *
 * @param criterion — an optional query object or predicate applied to
 *   the result, exactly as `filter()` takes it
 * @returns the ancestors, nearest first
 */
export function parents(self: Collection, criterion?: FilterLike): Collection {
  const store = self._store;
  const refs: Ref[] = [];
  const seen = new Set<number>();
  let level: number[] = [];

  for (let i = 0; i < self._refs.length; i++) {
    const ref = self._refs[i];

    if (ref.group === GROUP_NODES && store.isCurrent(ref)) {
      level.push(ref.slot);
    }
  }

  while (level.length > 0) {
    const next: number[] = [];

    for (const slot of level) {
      const p = store.parentOf(slot);

      if (p >= 0 && !seen.has(p)) {
        seen.add(p);
        refs.push(store.ref(GROUP_NODES, p));
        next.push(p);
      }
    }

    level = next;
  }

  const eles = self._spawnLive(refs);

  return criterion == null ? eles : eles.filter(criterion);
}

/**
 * Direct children of every node, in link order per parent.   *
 * @param criterion — an optional query object or predicate applied to
 *   the result, exactly as `filter()` takes it
 * @returns the children
 */
export function children(self: Collection, criterion?: FilterLike): Collection {
  const store = self._store;
  const refs: Ref[] = [];
  const seen = new Set<number>();

  for (let i = 0; i < self._refs.length; i++) {
    const ref = self._refs[i];

    if (ref.group !== GROUP_NODES || !store.isCurrent(ref)) {
      continue;
    }

    for (const child of store.childrenOf(ref.slot)) {
      if (!seen.has(child)) {
        seen.add(child);
        refs.push(store.ref(GROUP_NODES, child));
      }
    }
  }

  const eles = self._spawnLive(refs);

  return criterion == null ? eles : eles.filter(criterion);
}

/**
 * The subtree below every node in pre-order, excluding the nodes
 * themselves.   *
 * @param criterion — an optional query object or predicate applied to
 *   the result, exactly as `filter()` takes it
 * @returns the descendants
 */
export function descendants(
  self: Collection,
  criterion?: FilterLike,
): Collection {
  const store = self._store;
  const refs: Ref[] = [];
  const seen = new Set<number>();
  const stack: number[] = [];

  const pushChildren = (slot: number): void => {
    const kids = store.childrenOf(slot);

    for (let j = kids.length - 1; j >= 0; j--) {
      stack.push(kids[j]);
    }
  };

  for (let i = 0; i < self._refs.length; i++) {
    const ref = self._refs[i];

    if (ref.group !== GROUP_NODES || !store.isCurrent(ref)) {
      continue;
    }

    pushChildren(ref.slot);

    while (stack.length > 0) {
      const slot = stack.pop() as number;

      if (seen.has(slot)) {
        continue;
      }

      seen.add(slot);
      refs.push(store.ref(GROUP_NODES, slot));
      pushChildren(slot);
    }
  }

  const eles = self._spawnLive(refs);

  return criterion == null ? eles : eles.filter(criterion);
}

/** The nodes that have a parent (`wantChild`) or have none, filtered by `criterion` — `nonorphans` and `orphans`. */
export function _byParentedness(
  self: Collection,
  wantChild: boolean,
  criterion?: FilterLike,
): Collection {
  const store = self._store;
  const refs: Ref[] = [];

  for (let i = 0; i < self._refs.length; i++) {
    const ref = self._refs[i];

    if (ref.group !== GROUP_NODES || !store.isCurrent(ref)) {
      continue;
    }

    if (store.parentOf(ref.slot) >= 0 === wantChild) {
      refs.push(store.ref(GROUP_NODES, ref.slot));
    }
  }

  const eles = self._spawnLive(refs);

  return criterion == null ? eles : eles.filter(criterion);
}

/**
 * Ancestors common to every element, closest first (an edge in the
 * collection has no ancestors, so it empties the result — v3).   *
 * @param criterion — an optional query object or predicate applied to
 *   the result, exactly as `filter()` takes it
 * @returns the shared ancestors, closest first
 */
export function commonAncestors(
  self: Collection,
  criterion?: FilterLike,
): Collection {
  const store = self._store;
  let chain: number[] | null = null;

  for (let i = 0; i < self._refs.length; i++) {
    const ref = self._refs[i];

    if (!store.isCurrent(ref)) {
      continue;
    }

    const own: number[] = [];

    if (ref.group === GROUP_NODES) {
      for (let p = store.parentOf(ref.slot); p >= 0; p = store.parentOf(p)) {
        own.push(p);
      }
    }

    if (chain == null) {
      chain = own;
    } else {
      const keep = new Set(own);

      chain = chain.filter((slot) => keep.has(slot));
    }

    if (chain.length === 0) {
      break;
    }
  }

  const eles = self._spawnLive(
    (chain ?? []).map((slot) => store.ref(GROUP_NODES, slot)),
  );

  return criterion == null ? eles : eles.filter(criterion);
}

/** The first ref when it is a live node, else null — the raw-ref fast read the compound predicates share (the 62.6 shape). */
export function _liveNodeRef(self: Collection): Ref | null {
  // raw ref + isCurrent (which repairs a forwarded ref in place)
  // instead of the syncing getter — the 62.6 fast-read shape
  const ref = self.__refs[0];

  return ref != null && ref.group === GROUP_NODES && self._store.isCurrent(ref)
    ? ref
    : null;
}

/** The nodes with no incoming (`direction` 'in': roots) or outgoing ('out': leaves) edges, filtered by `criterion`. */
export function _dagExtremity(
  self: Collection,
  direction: 'in' | 'out',
  criterion?: FilterLike,
): Collection {
  const store = self._store;
  const adj = store.adj;
  const endpoints = store.column(COL.EDGE_ENDPOINTS) as Uint32Array;
  const refs: Ref[] = [];

  for (let i = 0; i < self._refs.length; i++) {
    const ref = self._refs[i];

    if (ref.group !== GROUP_NODES || !store.isCurrent(ref)) {
      continue;
    }

    const edges =
      direction === 'in' ? adj.inEdges(ref.slot) : adj.outEdges(ref.slot);
    let disqualified = false;

    for (let j = 0; j < edges.length; j++) {
      const edgeSlot = edges[j];

      // a loop (source === target) never disqualifies
      if (endpoints[edgeSlot * 2] !== endpoints[edgeSlot * 2 + 1]) {
        disqualified = true;
        break;
      }
    }

    if (!disqualified) {
      refs.push(ref);
    }
  }

  const eles = self._spawnLive(refs);

  return criterion == null ? eles : eles.filter(criterion);
}

/** Every node reachable along `direction` from the collection's nodes, with the edges walked — `successors` and `predecessors`. */
export function _dagAllHops(
  self: Collection,
  direction: 'out' | 'in',
  criterion?: FilterLike,
): Collection {
  const store = self._store;
  const adj = store.adj;
  const endpoints = store.column(COL.EDGE_ENDPOINTS) as Uint32Array;
  const acc: Ref[] = [];
  // packed (group, slot) keys: node = slot * 2, edge = slot * 2 + 1;
  // a raw slot BFS — no per-hop collection spawns or handle interning
  const seen = new Set<number>();
  let frontier: number[] = [];

  for (let i = 0; i < self._refs.length; i++) {
    const ref = self._refs[i];

    if (ref.group === GROUP_NODES && store.isCurrent(ref)) {
      frontier.push(ref.slot);
    }
  }

  while (frontier.length > 0) {
    const next: number[] = [];

    for (let i = 0; i < frontier.length; i++) {
      const nodeSlot = frontier[i];
      const edgeSlots =
        direction === 'out' ? adj.outEdges(nodeSlot) : adj.inEdges(nodeSlot);

      for (let j = 0; j < edgeSlots.length; j++) {
        const edgeSlot = edgeSlots[j];
        const otherSlot =
          direction === 'out'
            ? endpoints[edgeSlot * 2 + 1]
            : endpoints[edgeSlot * 2];

        if (!seen.has(edgeSlot * 2 + 1)) {
          seen.add(edgeSlot * 2 + 1);
          acc.push(store.ref(GROUP_EDGES, edgeSlot));
        }

        if (!seen.has(otherSlot * 2)) {
          seen.add(otherSlot * 2);
          acc.push(store.ref(GROUP_NODES, otherSlot));
          next.push(otherSlot);
        }
      }
    }

    frontier = next;
  }

  const out = self._spawnLive(acc);

  return criterion == null ? out : out.filter(criterion);
}
