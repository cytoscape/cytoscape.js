// Collection's `remove()` and `move()` (round 130 split).

import {
  GROUP_EDGES,
  GROUP_NODES,
  DATA_TARGET,
  DATA_SOURCE,
  COL,
} from '../contract.mjs';
import { hasListeners } from '../events.mjs';
import { packRef } from './shared.mjs';
import type { Collection } from '../collection.mjs';

/**
 * Remove these elements from the graph; incident edges of removed nodes
 * cascade.  Already-removed elements are skipped (no second `remove`
 * event).
 *
 * @returns the elements actually removed — the closure, so it can be
 *   *larger* than the receiver: removing a parent brings its
 *   descendants, and removing a node brings its incident edges.  The
 *   returned refs are dead by construction (v4 removals are terminal),
 *   so only their cached `id()`/`group()` still read
 */
export function remove(self: Collection): Collection {
  const cy = self._cy;
  const store = self._store;

  // build the closure: requested live elements + their descendants
  // (compound removal cascades, v3) + incident edges of removed nodes
  const edgeHandles: Collection[] = [];
  const nodeHandles: Collection[] = [];
  const seen = new Set<number>();

  const addEdge = (ele: Collection): void => {
    const key = packRef(ele._refs[0]);

    if (!seen.has(key)) {
      seen.add(key);
      edgeHandles.push(ele);
    }
  };

  const addNode = (ele: Collection): void => {
    const key = packRef(ele._refs[0]);

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    nodeHandles.push(ele);

    const slot = ele._refs[0].slot;

    for (const edgeSlot of store.adj.connectedEdges(slot)) {
      addEdge(cy._ele(GROUP_EDGES, edgeSlot));
    }

    for (const childSlot of store.childrenOf(slot)) {
      addNode(cy._ele(GROUP_NODES, childSlot));
    }
  };

  for (let i = 0; i < self.length; i++) {
    const ref = self._refs[i];

    if (!store.isCurrent(ref)) {
      continue;
    }

    if (ref.group === GROUP_EDGES) {
      addEdge(self[i]);
    } else {
      addNode(self[i]);
    }
  }

  // children before parents: the store refuses to remove a node whose
  // children are still alive (depths are strictly increasing down a chain)
  nodeHandles.sort(
    (a, b) => store.depthOf(b._refs[0].slot) - store.depthOf(a._refs[0].slot),
  );

  // edges first, then nodes; emit remove per element after the store mutation
  for (const edge of edgeHandles) {
    store.removeEdge(edge._refs[0].slot);
  }

  for (const node of nodeHandles) {
    store.removeNode(node._refs[0].slot);
  }

  for (const ele of [...edgeHandles, ...nodeHandles]) {
    cy._emitOnEle('remove', ele);
  }

  const removed = self._spawn(
    [...edgeHandles, ...nodeHandles].map((ele) => ele._refs[0]),
  );

  cy._maybeCompact(); // the auto dead-slot trigger's safe boundary (19.5)

  return removed;
}

/**
 * Move elements in place, keeping slot, id and data: `{ parent }`
 * re-parents nodes (null orphans them; the compound move, round 14.2 —
 * emits `moveout` before and `move` after per changed node), while
 * `{ source, target }` re-points edges.  As in v3 the modes are
 * exclusive — a `parent` key takes precedence.  An unknown parent id is
 * a silent no-op (v3); a cyclic assignment warns and drops (the
 * hierarchy rule).
 *
 * @param opts — `{ parent }` to re-parent nodes (null orphans them), or
 *   `{ source, target }` to re-point edges; `parent` wins if both are
 *   given
 * @returns this collection, for chaining
 */
export function move(
  self: Collection,
  opts: {
    source?: string;
    target?: string;
    parent?: string | null;
  },
): Collection {
  const store = self._store;

  if (opts.parent !== undefined) {
    let parentSlot = -1;

    if (opts.parent != null) {
      const parentRef = store.lookup(String(opts.parent));

      if (parentRef == null || parentRef.group !== GROUP_NODES) {
        return self;
      } // v3: silent no-op

      parentSlot = parentRef.slot;
    }

    const wantEmit =
      hasListeners(self._cy._emitter, 'moveout') ||
      hasListeners(self._cy._emitter, 'move');

    for (let i = 0; i < self.length; i++) {
      const ref = self._refs[i];

      if (ref.group !== GROUP_NODES || !store.isCurrent(ref)) {
        continue;
      }
      if (store.parentOf(ref.slot) === parentSlot) {
        continue;
      }

      // a cyclic assignment is dropped by setParent (with its warning);
      // it gets no events since nothing changes
      const cyclic =
        parentSlot >= 0 &&
        (parentSlot === ref.slot || store.isAncestorOf(ref.slot, parentSlot));

      if (!cyclic && wantEmit) {
        self._cy._emitOnEle('moveout', self[i]);
      }

      store.setParent(ref.slot, parentSlot);

      if (!cyclic && wantEmit) {
        self._cy._emitOnEle('move', self[i]);
      }
    }

    return self;
  }

  if (opts.source == null && opts.target == null) {
    return self;
  }

  const newSource =
    opts.source != null ? _resolveNode(self, opts.source, DATA_SOURCE) : null;
  const newTarget =
    opts.target != null ? _resolveNode(self, opts.target, DATA_TARGET) : null;

  for (let i = 0; i < self.length; i++) {
    const ref = self._refs[i];

    if (ref.group !== GROUP_EDGES || !store.isCurrent(ref)) {
      continue;
    }

    const endpoints = store.column(COL.EDGE_ENDPOINTS) as Uint32Array;

    store.moveEdge(
      ref.slot,
      newSource ?? endpoints[ref.slot * 2],
      newTarget ?? endpoints[ref.slot * 2 + 1],
    );

    if (hasListeners(self._cy._emitter, 'move')) {
      self._cy._emitOnEle('move', self[i]);
    }
  }

  return self;
}

/** The live node slot for `id`, throwing when it names no node — `move()`'s `role` names which endpoint the error is about. */
export function _resolveNode(
  self: Collection,
  id: string,
  role: string,
): number {
  const ref = self._store.lookup(id);

  if (ref == null || ref.group !== GROUP_NODES) {
    throw new Error(`Can not move edge to nonexistant ${role} node '${id}'`);
  }

  return ref.slot;
}
