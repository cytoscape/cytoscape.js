// Collection's traversal (round 130 split): endpoints, incident edges
// and nodes, neighborhoods, edge relations and connected components.

import { GROUP_EDGES, GROUP_NODES, COL } from '../contract.mjs';
import type { Ref } from '../contract.mjs';
import type { FilterLike } from './shared.mjs';
import type { Collection } from '../collection.mjs';

/** The source (`which` 0) or target (1) node of the first edge, as a collection — empty when the first element is not an edge. */
export function _endpoint(self: Collection, which: 0 | 1): Collection {
  const ref = self._first();

  if (ref == null || ref.group !== GROUP_EDGES) {
    return self._spawn([]);
  }

  // the lean accessor: source()/target() lost to v3 on the per-call
  // column spec walk alone (round 62.4)
  const endpoints = self._store.edgeEndpoints();

  return self._cy._ele(GROUP_NODES, endpoints[ref.slot * 2 + which]);
}

/** The source (`which` 0) or target (1) nodes of every edge in the collection, unique, in edge order. */
export function _endpoints(self: Collection, which: 0 | 1): Collection {
  const store = self._store;
  const endpoints = store.column(COL.EDGE_ENDPOINTS) as Uint32Array;
  const refs: Ref[] = [];
  const seen = new Set<number>();

  for (let i = 0; i < self._refs.length; i++) {
    const ref = self._refs[i];

    if (ref.group !== GROUP_EDGES || !store.isCurrent(ref)) {
      continue;
    }

    const nodeSlot = endpoints[ref.slot * 2 + which];

    if (!seen.has(nodeSlot)) {
      seen.add(nodeSlot);
      refs.push(store.ref(GROUP_NODES, nodeSlot));
    }
  }

  return self._spawnLive(refs);
}

/**
 * Every edge incident on the nodes in this collection, deduped —
 * answered off the CSR adjacency index, so it is O(incident edges)
 * rather than a scan.  Loops appear once.
 *
 * @param criterion — an optional query object or predicate to filter
 *   the result
 * @returns the incident edges
 */
export function connectedEdges(
  self: Collection,
  criterion?: FilterLike,
): Collection {
  const store = self._store;
  const adj = store.adj;
  const list = self._refs; // hoisted: the getter syncs per call (62.6)
  const egen = store.edges.gen;
  const slots: number[] = [];
  const seen = new Set<number>(); // edge slots: dedupes loops and shared edges alike

  for (let i = 0; i < list.length; i++) {
    const ref = list[i];

    if (ref.group !== GROUP_NODES || !store.isCurrent(ref)) {
      continue;
    }

    // reads the CSR rows in place — no per-node subarray views (62.6)
    adj.appendIncident(ref.slot, seen, slots);
  }

  const refs: Ref[] = new Array(slots.length);

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];

    refs[i] = { group: GROUP_EDGES, slot, gen: egen[slot] };
  }

  const eles = self._spawnLive(refs);

  return criterion == null ? eles : eles.filter(criterion);
}

/**
 * The endpoint nodes of every edge in this collection, deduped.
 *
 * @param criterion — an optional query object or predicate to filter
 *   the result
 * @returns the endpoint nodes
 */
export function connectedNodes(
  self: Collection,
  criterion?: FilterLike,
): Collection {
  const store = self._store;
  const endpoints = store.column(COL.EDGE_ENDPOINTS) as Uint32Array;
  const list = self._refs; // hoisted: the getter syncs per call (62.6)
  const refs: Ref[] = [];
  const seen = new Set<number>();

  for (let i = 0; i < list.length; i++) {
    const ref = list[i];

    if (ref.group !== GROUP_EDGES || !store.isCurrent(ref)) {
      continue;
    }

    const source = endpoints[ref.slot * 2];
    const target = endpoints[ref.slot * 2 + 1];

    if (!seen.has(source)) {
      seen.add(source);
      refs.push(store.ref(GROUP_NODES, source));
    }

    if (!seen.has(target)) {
      seen.add(target);
      refs.push(store.ref(GROUP_NODES, target));
    }
  }

  const eles = self._spawnLive(refs);

  return criterion == null ? eles : eles.filter(criterion);
}

/** The outgoers (`direction` 'out') or incomers ('in') of the nodes: the incident edges in that direction and their far nodes, filtered by `criterion`. */
export function _goers(
  self: Collection,
  direction: 'out' | 'in',
  criterion?: FilterLike,
): Collection {
  const store = self._store;
  const adj = store.adj;
  const endpoints = store.column(COL.EDGE_ENDPOINTS) as Uint32Array;
  const refs: Ref[] = [];
  // packed (group, slot) keys: node = slot * 2, edge = slot * 2 + 1
  const seen = new Set<number>();

  for (let i = 0; i < self._refs.length; i++) {
    const ref = self._refs[i];

    if (ref.group !== GROUP_NODES || !store.isCurrent(ref)) {
      continue;
    }

    const edgeSlots =
      direction === 'out' ? adj.outEdges(ref.slot) : adj.inEdges(ref.slot);

    for (let j = 0; j < edgeSlots.length; j++) {
      const edgeSlot = edgeSlots[j];
      const otherSlot =
        direction === 'out'
          ? endpoints[edgeSlot * 2 + 1]
          : endpoints[edgeSlot * 2];

      if (!seen.has(edgeSlot * 2 + 1)) {
        seen.add(edgeSlot * 2 + 1);
        refs.push(store.ref(GROUP_EDGES, edgeSlot));
      }

      if (!seen.has(otherSlot * 2)) {
        seen.add(otherSlot * 2);
        refs.push(store.ref(GROUP_NODES, otherSlot));
      }
    }
  }

  const eles = self._spawnLive(refs);

  return criterion == null ? eles : eles.filter(criterion);
}

/**
 * The *open* neighbourhood: the incident edges and the nodes on their
 * far ends, ignoring edge direction, excluding the collection's own
 * elements.
 *
 * @param criterion — an optional query object or predicate to filter
 *   the result
 * @returns the neighbouring edges and nodes
 * @see Collection#closedNeighborhood to include these nodes
 */
export function neighborhood(
  self: Collection,
  criterion?: FilterLike,
): Collection {
  const store = self._store;
  const adj = store.adj;
  const endpoints = store.column(COL.EDGE_ENDPOINTS) as Uint32Array;
  const refs: Ref[] = [];
  // packed (group, slot) keys; the collection's own live elements are
  // pre-seeded so the open neighborhood excludes them during the walk
  const seen = new Set<number>();

  for (let i = 0; i < self._refs.length; i++) {
    const ref = self._refs[i];

    if (store.isCurrent(ref)) {
      seen.add(ref.group === GROUP_NODES ? ref.slot * 2 : ref.slot * 2 + 1);
    }
  }

  for (let i = 0; i < self._refs.length; i++) {
    const ref = self._refs[i];

    if (ref.group !== GROUP_NODES || !store.isCurrent(ref)) {
      continue;
    }

    const out = adj.outEdges(ref.slot);
    const inn = adj.inEdges(ref.slot);

    for (let pass = 0; pass < 2; pass++) {
      const edgeSlots = pass === 0 ? out : inn;

      for (let j = 0; j < edgeSlots.length; j++) {
        const edgeSlot = edgeSlots[j];
        const source = endpoints[edgeSlot * 2];
        const target = endpoints[edgeSlot * 2 + 1];
        const otherSlot = source === ref.slot ? target : source;

        if (!seen.has(edgeSlot * 2 + 1)) {
          seen.add(edgeSlot * 2 + 1);
          refs.push(store.ref(GROUP_EDGES, edgeSlot));
        }

        if (!seen.has(otherSlot * 2)) {
          seen.add(otherSlot * 2);
          refs.push(store.ref(GROUP_NODES, otherSlot));
        }
      }
    }
  }

  const eles = self._spawnLive(refs);

  return criterion == null ? eles : eles.filter(criterion);
}

/** The edges between this collection's nodes and `others` — any direction, or (`thisIsSrc`) only those leaving this collection. */
export function _edgesWith(
  self: Collection,
  others: Collection,
  thisIsSrc: boolean,
): Collection {
  const store = self._store;
  const endpoints = store.column(COL.EDGE_ENDPOINTS) as Uint32Array;
  const otherColl = others;

  const thisNodes = _nodeSlotSet(self);
  const otherNodes = _nodeSlotSet(otherColl);
  const refs: Ref[] = [];

  for (const oref of otherColl._liveRefs()) {
    if (oref.group !== GROUP_NODES) {
      continue;
    }

    for (const edgeSlot of store.adj.connectedEdges(oref.slot)) {
      const s = endpoints[edgeSlot * 2];
      const t = endpoints[edgeSlot * 2 + 1];
      const thisToOther = thisNodes.has(s) && otherNodes.has(t);
      const otherToThis = otherNodes.has(s) && thisNodes.has(t);

      if (!(thisToOther || otherToThis)) {
        continue;
      }
      if (thisIsSrc && !thisToOther) {
        continue;
      }

      refs.push(store.ref(GROUP_EDGES, edgeSlot));
    }
  }

  return self._spawn(refs);
}

/** The edges parallel to the collection's edges — sharing both endpoints in either direction, or (`codirectedOnly`) the same direction — filtered by `criterion`. */
export function _parallelEdges(
  self: Collection,
  codirectedOnly: boolean,
  criterion?: FilterLike,
): Collection {
  const store = self._store;
  const endpoints = store.column(COL.EDGE_ENDPOINTS) as Uint32Array;
  const refs: Ref[] = [];

  for (const ref of self._liveRefs()) {
    if (ref.group !== GROUP_EDGES) {
      continue;
    }

    const src1 = endpoints[ref.slot * 2];
    const tgt1 = endpoints[ref.slot * 2 + 1];

    // every edge parallel to self one is incident to its source node
    for (const e2 of store.adj.connectedEdges(src1)) {
      const s2 = endpoints[e2 * 2];
      const t2 = endpoints[e2 * 2 + 1];
      const codirected = s2 === src1 && t2 === tgt1;
      const opposed = s2 === tgt1 && t2 === src1;

      if (
        (codirectedOnly && codirected) ||
        (!codirectedOnly && (codirected || opposed))
      ) {
        refs.push(store.ref(GROUP_EDGES, e2));
      }
    }
  }

  const eles = self._spawn(refs);

  return criterion == null ? eles : eles.filter(criterion);
}

/**
 * Connected components within this collection (undirected), each as a
 * collection of the reached nodes plus the collection's edges internal
 * to that component.
 *
 * @param root — restricts the seed nodes; omit to seed from every node
 * @returns one collection per component
 */
export function components(
  self: Collection,
  root?: Collection | null,
): Collection[] {
  const store = self._store;
  const endpoints = store.column(COL.EDGE_ENDPOINTS) as Uint32Array;
  const nodeSlots = _nodeSlotSet(self);
  const edgeSlots: number[] = [];
  const edgeSlotSet = new Set<number>();

  for (const ref of self._liveRefs()) {
    if (ref.group === GROUP_EDGES) {
      edgeSlots.push(ref.slot);
      edgeSlotSet.add(ref.slot);
    }
  }

  let seeds: number[];

  if (root == null) {
    seeds = [...nodeSlots];
  } else {
    const rootColl = root;
    const rootNodes = _nodeSlotSet(rootColl);

    seeds =
      rootNodes.size > 0
        ? [...rootNodes].filter((s) => nodeSlots.has(s))
        : // root has only edges: seed from their source-side nodes
          rootColl
            ._liveRefs()
            .filter((r) => r.group === GROUP_EDGES)
            .map((r) => endpoints[r.slot * 2])
            .filter((s) => nodeSlots.has(s));
  }

  const visited = new Set<number>();
  const comps: Collection[] = [];

  for (const seed of seeds) {
    if (visited.has(seed)) {
      continue;
    }

    const compNodes = new Set<number>();
    const stack = [seed];

    visited.add(seed);

    while (stack.length > 0) {
      const n = stack.pop() as number;

      compNodes.add(n);

      for (const edgeSlot of store.adj.connectedEdges(n)) {
        if (!edgeSlotSet.has(edgeSlot)) {
          continue;
        } // only walk edges within self collection

        const s = endpoints[edgeSlot * 2];
        const t = endpoints[edgeSlot * 2 + 1];
        const other = s === n ? t : s;

        if (nodeSlots.has(other) && !visited.has(other)) {
          visited.add(other);
          stack.push(other);
        }
      }
    }

    const refs: Ref[] = [];

    for (const s of compNodes) {
      refs.push(store.ref(GROUP_NODES, s));
    }

    for (const edgeSlot of edgeSlots) {
      if (
        compNodes.has(endpoints[edgeSlot * 2]) &&
        compNodes.has(endpoints[edgeSlot * 2 + 1])
      ) {
        refs.push(store.ref(GROUP_EDGES, edgeSlot));
      }
    }

    comps.push(self._spawn(refs));
  }

  return comps;
}

/** The live node slots of the collection as a set — the membership test `components` and `_edgesWith` share. */
export function _nodeSlotSet(self: Collection): Set<number> {
  const set = new Set<number>();

  for (const ref of self._liveRefs()) {
    if (ref.group === GROUP_NODES) {
      set.add(ref.slot);
    }
  }

  return set;
}
