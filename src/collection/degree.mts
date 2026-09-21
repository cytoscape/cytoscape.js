// Collection's degree family (round 130 split).

import { GROUP_NODES, COL } from '../contract.mjs';
import type { Core } from '../core.mjs';
import type { Collection } from '../collection.mjs';

/**
 * The summed degree of every node in the collection — the
 * whole-collection figure that `degree()` deliberately is not.
 *
 * @param includeLoops — whether self-loops count
 * @returns the total degree (0 when there are no nodes)
 */
export function totalDegree(
  self: Collection,
  includeLoops: boolean = true,
): number {
  let total = 0;

  for (let i = 0; i < self.length; i++) {
    const d = self[i].degree(includeLoops);

    if (d !== undefined) {
      total += d;
    }
  }

  return total;
}

/** The minimum (`sign` -1) or maximum (1) of `fn` over the collection's nodes, or undefined when it has none. */
export function _degreeBound(
  self: Collection,
  fn: 'degree' | 'indegree' | 'outdegree',
  includeLoops: boolean,
  sign: 1 | -1,
): number | undefined {
  let ret: number | undefined;

  for (let i = 0; i < self.length; i++) {
    if (!self[i].isNode()) {
      continue;
    }

    const degree =
      fn === 'degree'
        ? self[i].degree(includeLoops)
        : fn === 'indegree'
          ? self[i].indegree(includeLoops)
          : self[i].outdegree(includeLoops);

    if (degree === undefined) {
      continue;
    }

    if (ret === undefined || sign * degree > sign * ret) {
      ret = degree;
    }
  }

  return ret;
}

/** The first node's degree under `count` (edges, in-edges or out-edges), `includeLoops` counting self-loops, or undefined for a non-node. */
export function _degree(
  self: Collection,
  includeLoops: boolean,
  count: (store: Core['_store'], slot: number) => number,
  direction?: 'out' | 'in',
): number | undefined {
  const store = self._store;
  const ref = self._first();

  // first element must be a live node, else undefined (as in v3)
  if (ref == null || ref.group !== GROUP_NODES || !store.isCurrent(ref)) {
    return undefined;
  }

  let total = count(store, ref.slot);

  if (!includeLoops) {
    const endpoints = store.column(COL.EDGE_ENDPOINTS) as Uint32Array;

    // a loop contributes 1 to outdegree, 1 to indegree, 2 to degree
    for (const edgeSlot of store.adj.outEdges(ref.slot)) {
      if (endpoints[edgeSlot * 2] === endpoints[edgeSlot * 2 + 1]) {
        total -= direction == null ? 2 : 1;
      }
    }
  }

  return total;
}
