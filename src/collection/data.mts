// Collection's `data()` and `scratch()` (round 130 split).

import {
  GROUP_EDGES,
  GROUP_NODES,
  DATA_TARGET,
  DATA_SOURCE,
  DATA_PARENT,
  DATA_ID,
} from '../contract.mjs';
import type { GroupName } from '../contract.mjs';
import { hasListeners } from '../events.mjs';
import type { Collection } from '../collection.mjs';

/** Apply a data patch to every element: the reserved keys are refused, the store is written once, and `data` emits per element when listened for. */
export function _setData(
  self: Collection,
  patch: Record<string, unknown>,
): Collection {
  const store = self._store;
  const cy = self._cy;
  const keys = Object.keys(patch);
  const wantEmit = hasListeners(cy._emitter, 'data');
  // a data write can only change computed style through a mapper (or a
  // mapped label) on one of the written keys — decided once per group,
  // not per element
  const touched: Record<GroupName, number[] | null> = {
    nodes: cy._stylesDependOnData(GROUP_NODES, keys) ? [] : null,
    edges: cy._stylesDependOnData(GROUP_EDGES, keys) ? [] : null,
  };

  for (const k of keys) {
    if (k === DATA_ID) {
      throw new Error(`Can not change the immutable data field 'id'`);
    }
  }

  for (let i = 0; i < self.length; i++) {
    const ref = self._refs[i];

    if (!store.isCurrent(ref)) {
      continue;
    }

    for (const k of keys) {
      if (
        ref.group === GROUP_EDGES &&
        (k === DATA_SOURCE || k === DATA_TARGET)
      ) {
        throw new Error(
          `Can not change the immutable data field '${k}' of an edge`,
        );
      }

      if (ref.group === GROUP_NODES && k === DATA_PARENT) {
        throw new Error(
          `Can not change the immutable data field 'parent' of a node; reparent with move()`,
        );
      }

      store.setData(ref.group, ref.slot, k, patch[k]);
    }

    touched[ref.group]?.push(ref.slot);
  }

  // mapped style refreshes before emits so data listeners observe fresh state
  for (const group of [GROUP_NODES, GROUP_EDGES] as const) {
    const slots = touched[group];

    if (slots != null && slots.length > 0) {
      cy._refreshMappedStyles(group, slots, keys);
    }
  }

  if (wantEmit) {
    for (let i = 0; i < self.length; i++) {
      if (store.isCurrent(self._refs[i])) {
        cy._emitOnEle('data', self[i]);
      }
    }
  }

  return self;
}

/**
 * Remove sidecar data keys.
 *
 * @param names — space-separated key names; omit to clear every key
 * @returns this collection, for chaining
 */
export function removeData(self: Collection, names?: string): Collection {
  const store = self._store;
  const requested =
    names == null ? null : names.split(/\s+/).filter((n) => n !== '');

  for (let i = 0; i < self.length; i++) {
    const ref = self._refs[i];

    if (!store.isCurrent(ref)) {
      continue;
    }

    const keys =
      requested ?? Object.keys(store.data.object(ref.group, ref.slot));
    const patch: Record<string, unknown> = {};

    for (const k of keys) {
      patch[k] = undefined;
    }

    if (Object.keys(patch).length > 0) {
      self[i]._setData(patch);
    }
  }

  return self;
}

/**
 * Per-element scratchpad (plain JS, not a column): `scratch()` reads the
 * first element's whole object, `scratch(ns)` one namespace, `scratch(ns,
 * val)` / `scratch(obj)` write to every element.
 *
 * @param args — the form to take: nothing (read the whole object), a
 *   namespace (read it), a namespace and a value (write it to every
 *   element), or one object (merge its keys into every element)
 * @returns the reader forms answer the first element — the whole
 *   scratch object under no argument, one namespace's value under
 *   `scratch(ns)`, undefined when the collection is empty — while the
 *   writer forms return this collection for chaining
 */
export function scratch(
  self: Collection,
  ...args: [] | [string] | [string, unknown] | [Record<string, unknown>]
): unknown {
  const [ns, value] = args;

  // whole-object getter
  if (args.length === 0) {
    return self[0]?._scratch ?? {};
  }

  // single-namespace getter
  if (typeof ns === 'string' && args.length === 1) {
    return self[0]?._scratch?.[ns];
  }

  const patch: Record<string, unknown> =
    typeof ns === 'string' ? { [ns]: value } : (ns as Record<string, unknown>);

  for (let i = 0; i < self.length; i++) {
    const ele = self[i];

    ele._scratch ??= {};
    Object.assign(ele._scratch, patch);
  }

  return self;
}

/**
 * Delete scratchpad keys from every element.
 *
 * @param namespace — the key to remove; omit to clear each element's
 *   whole scratchpad
 * @returns this collection, for chaining
 */
export function removeScratch(
  self: Collection,
  namespace?: string,
): Collection {
  for (let i = 0; i < self.length; i++) {
    const ele = self[i];

    if (ele._scratch == null) {
      continue;
    }

    if (namespace == null) {
      ele._scratch = {};
    } else {
      delete ele._scratch[namespace];
    }
  }

  return self;
}
