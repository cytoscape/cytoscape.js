// `cy.patch()` (round 107): apply the store tier's plan — removals, adds,
// survivor writes — inside one batch, then announce it: the per-element
// events, once each, and one summary `patch` event carrying the diff.

import { Collection } from '../collection.mjs';
import { _removeClosure } from '../collection/manipulation.mjs';
import { isColumnarElements } from '../columnar.mjs';
import { partitionDefs } from '../element-defs.mjs';
import { deserializeElements, isSerializedElements } from '../wire.mjs';
import {
  COL,
  GROUP_EDGES,
  GROUP_NODES,
  FLAG_LOCKED,
  FLAG_PARENT,
} from '../contract.mjs';
import type { GroupName, Ref } from '../contract.mjs';
import type { ElementsInput } from '../public-types.mjs';
import {
  columnarPatchPayload,
  planPatch,
  takeEntries,
  toPatchPayload,
} from '../store/patch.mjs';
import type { PatchMode, PatchPayload, PatchPlan } from '../store/patch.mjs';
import type { FlagOverride } from '../columnar.mjs';
import type { Core } from '../core.mjs';
import { _applyStyle } from './batching.mjs';
import { _applyFlagOverrides, _newId } from './elements.mjs';

export type { PatchMode } from '../store/patch.mjs';

/** Options for `cy.patch()`. */
export interface PatchOptions {
  /**
   * `'reconcile'` (the default): the payload is the new state, and a live
   * element it does not name is removed.  `'merge'`: the payload is a set
   * of upserts, and a live element it does not name is kept — a
   * definition-form payload may then name kept nodes as endpoints and
   * parents.
   */
  mode?: PatchMode;
}

/**
 * What a patch did — returned by `cy.patch()` and carried by its `patch`
 * event as `event.diff`.  An edge the payload rewired (the same id, a new
 * source or target) is in both `removed` and `added`, since it was removed
 * and re-added; an element is never in `updated` and either of the others.
 */
export interface PatchDiff {
  /** the elements the patch added, nodes before edges, in payload order */
  added: Collection;
  /** the elements it removed, cascades included (the incident edges and
   * descendants of a removed node); removed elements keep their `id()`
   * and `group()` */
  removed: Collection;
  /** the surviving elements it changed — data, position or parent —
   * nodes before edges, in payload order */
  updated: Collection;
}

const MODES: readonly PatchMode[] = ['reconcile', 'merge'];

/** Validate the options, answering the mode. */
export function _patchMode(options: PatchOptions | undefined): PatchMode {
  if (options == null) {
    return 'reconcile';
  }

  for (const key of Object.keys(options)) {
    if (key !== 'mode') {
      throw new Error(`Unknown patch option '${key}'; supported: mode`);
    }
  }

  const mode = options.mode ?? 'reconcile';

  if (!MODES.includes(mode)) {
    throw new Error(
      `Unknown patch mode '${String(mode)}'; use 'reconcile' or 'merge'`,
    );
  }

  return mode;
}

/** Any input form, in the planner's one form. */
export function _patchPayload(input: ElementsInput): PatchPayload {
  const defs = isSerializedElements(input) ? deserializeElements(input) : input;

  return isColumnarElements(defs)
    ? columnarPatchPayload(defs)
    : toPatchPayload(partitionDefs(defs));
}

/** The overrides that belong to added entries, re-indexed into the add list. */
const addedOverrides = (
  overrides: FlagOverride[],
  added: number[],
): FlagOverride[] => {
  if (overrides.length === 0) {
    return overrides;
  }

  const at = new Map<number, number>();

  for (let j = 0; j < added.length; j++) {
    at.set(added[j], j);
  }

  const out: FlagOverride[] = [];

  for (const o of overrides) {
    const j = at.get(o.at);

    if (j != null) {
      out.push({ at: j, def: o.def });
    }
  }

  return out;
};

/** The payload's added nodes and edges, ingested through the columnar path. */
function addEntries(
  core: Core,
  payload: PatchPayload,
  plan: PatchPlan,
): { nodeSlots: Uint32Array; edgeSlots: Uint32Array } {
  const store = core._store;
  const newId = (): string => _newId(core);
  const nodesIn = payload.elements.nodes;
  const edgesIn = payload.elements.edges;
  let nodeSlots: Uint32Array = new Uint32Array(0);
  let edgeSlots: Uint32Array = new Uint32Array(0);

  if (nodesIn != null && plan.addNodes.length > 0) {
    // no parent column: parents link after every add, survivors included
    nodeSlots = store.addNodesColumnar(
      { count: plan.addNodes.length, ...takeEntries(nodesIn, plan.addNodes) },
      newId,
    );

    for (let j = 0; j < plan.addNodes.length; j++) {
      plan.nodeSlots[plan.addNodes[j]] = nodeSlots[j];
    }

    const flags = addedOverrides(payload.nodeFlags, plan.addNodes);

    if (flags.length > 0) {
      _applyFlagOverrides(core, GROUP_NODES, nodeSlots, flags, false);
    }
  }

  if (edgesIn != null && plan.addEdges.length > 0) {
    // endpoints may be survivors, so the edges index a slot table of
    // their own: sources in the first half, targets in the second
    const k = plan.addEdges.length;
    const table = new Uint32Array(k * 2);
    const sources = new Uint32Array(k);
    const targets = new Uint32Array(k);

    for (let j = 0; j < k; j++) {
      const e = plan.addEdges[j];

      table[j] = plan.nodeSlots[edgesIn.sources[e]];
      table[k + j] = plan.nodeSlots[edgesIn.targets[e]];
      sources[j] = j;
      targets[j] = k + j;
    }

    edgeSlots = store.addEdgesColumnar(
      { count: k, sources, targets, ...takeEntries(edgesIn, plan.addEdges) },
      table,
      newId,
    );

    const flags = addedOverrides(payload.edgeFlags, plan.addEdges);

    if (flags.length > 0) {
      _applyFlagOverrides(core, GROUP_EDGES, edgeSlots, flags, true);
    }
  }

  return { nodeSlots, edgeSlots };
}

/** Write the survivors' data; answer the slots written, for `updated` and the `data` events. */
function writeData(core: Core, group: GroupName, plan: PatchPlan): number[] {
  const store = core._store;
  const { slots, keys, values } = plan.writes[group];

  if (slots.length === 0) {
    return [];
  }

  const written: number[] = [];
  const seen = new Set<number>();
  const touchedKeys = new Set<string>();

  for (let j = 0; j < slots.length; j++) {
    store.setData(group, slots[j], keys[j], values[j]);
    touchedKeys.add(keys[j]);

    if (!seen.has(slots[j])) {
      seen.add(slots[j]);
      written.push(slots[j]);
    }
  }

  const keyList = [...touchedKeys];

  if (core._stylesDependOnData(group, keyList)) {
    core._refreshMappedStyles(group, written, keyList);
  }

  return written;
}

/** Write the survivors' positions a position write may move; answer the slots moved. */
function writePositions(core: Core, plan: PatchPlan): number[] {
  const { slots, xy } = plan.moves;

  // autolock holds every node, as it does against position()
  if (slots.length === 0 || core.autolock() === true) {
    return [];
  }

  const store = core._store;
  const flags = store.column(COL.NODE_FLAGS) as Uint32Array;
  const moved: number[] = [];
  const movedXY: number[] = [];

  for (let j = 0; j < slots.length; j++) {
    // a locked node holds its position against every API-tier write;
    // a compound parent's position is derived from its children, as at
    // load
    if ((flags[slots[j]] & (FLAG_LOCKED | FLAG_PARENT)) !== 0) {
      continue;
    }

    moved.push(slots[j]);
    movedXY.push(xy[j * 2], xy[j * 2 + 1]);
  }

  store.setPositions(moved, movedXY);

  return moved;
}

/**
 * Reconcile a fresh payload into the live graph by id.  See `Core#patch`
 * for the contract.
 *
 * @param core — the core to patch
 * @param input — the payload, in definition, columnar or wire form
 * @param options — the mode
 * @returns the diff
 */
export function patch(
  core: Core,
  input: ElementsInput,
  options?: PatchOptions,
): PatchDiff {
  const mode = _patchMode(options);
  const payload = _patchPayload(input);
  // everything that can throw on the payload throws here, before any
  // mutation
  const plan = planPatch(core._store, payload, mode);
  const store = core._store;
  const survivorParents = plan.parents.filter((p) => plan.nodeSlots[p.at] >= 0);
  let diff: PatchDiff;

  core.startBatch();

  try {
    // 1. detach the survivors changing parent, so a removed parent's
    //    cascade cannot take them
    for (const { at } of survivorParents) {
      store.setParent(plan.nodeSlots[at], -1);
    }

    // 2. removals (the closure: incident edges, descendants)
    let removedHandles: Collection[] = [];

    if (plan.removeNodes.length > 0 || plan.removeEdges.length > 0) {
      const refs: Ref[] = [];

      for (const slot of plan.removeEdges) {
        refs.push(store.ref(GROUP_EDGES, slot));
      }
      for (const slot of plan.removeNodes) {
        refs.push(store.ref(GROUP_NODES, slot));
      }

      removedHandles = _removeClosure(
        new Collection(core, refs, { unique: true }),
      );
    }

    // 3. adds, then every parent link (added members and survivors)
    const added = addEntries(core, payload, plan);

    for (const { at, parent } of plan.parents) {
      store.setParent(
        plan.nodeSlots[at],
        parent < 0 ? -1 : plan.nodeSlots[parent],
      );
    }

    _applyStyle(core, GROUP_NODES, added.nodeSlots);
    _applyStyle(core, GROUP_EDGES, added.edgeSlots);

    // 4. survivor writes
    const dataNodes = writeData(core, GROUP_NODES, plan);
    const dataEdges = writeData(core, GROUP_EDGES, plan);
    const moved = writePositions(core, plan);
    const reparented = survivorParents.map((p) => plan.nodeSlots[p.at]);

    // the diff's collections are built while the slots are still the
    // plan's: the outermost endBatch() may compact, and a collection
    // repairs its refs through the forwarding a compaction leaves, where
    // a bare slot list would not
    diff = {
      added: _addedCollection(core, added),
      removed: new Collection(
        core,
        removedHandles.map((ele) => ele._refs[0]),
        { unique: true, handles: removedHandles },
      ),
      updated: _updatedCollection(
        core,
        plan,
        [dataNodes, moved, reparented],
        dataEdges,
      ),
    };

    // 5. the element events, once each, after every mutation has landed
    for (const ele of removedHandles) {
      core._emitOnEle('remove', ele);
    }

    if (core._hasListeners('add')) {
      for (const slot of added.nodeSlots) {
        core._emitOnEle('add', core._ele(GROUP_NODES, slot));
      }
      for (const slot of added.edgeSlots) {
        core._emitOnEle('add', core._ele(GROUP_EDGES, slot));
      }
    }

    if (core._hasListeners('moveout') || core._hasListeners('move')) {
      for (const slot of reparented) {
        const ele = core._ele(GROUP_NODES, slot);

        core._emitOnEle('moveout', ele);
        core._emitOnEle('move', ele);
      }
    }

    if (core._hasListeners('data')) {
      for (const slot of dataNodes) {
        core._emitOnEle('data', core._ele(GROUP_NODES, slot));
      }
      for (const slot of dataEdges) {
        core._emitOnEle('data', core._ele(GROUP_EDGES, slot));
      }
    }

    if (core._hasListeners('position')) {
      for (const slot of moved) {
        core._emitOnEle('position', core._ele(GROUP_NODES, slot));
      }
    }
  } finally {
    core.endBatch();
  }

  core.emit({ type: 'patch', diff });

  return diff;
}

/** The added elements as one collection, nodes before edges. */
function _addedCollection(
  core: Core,
  added: { nodeSlots: Uint32Array; edgeSlots: Uint32Array },
): Collection {
  const refs: Ref[] = [];

  for (const slot of added.nodeSlots) {
    refs.push(core._store.ref(GROUP_NODES, slot));
  }
  for (const slot of added.edgeSlots) {
    refs.push(core._store.ref(GROUP_EDGES, slot));
  }

  return new Collection(core, refs, { unique: true, live: true });
}

/** The changed survivors, in payload order, nodes before edges. */
function _updatedCollection(
  core: Core,
  plan: PatchPlan,
  nodeLists: number[][],
  edgeSlots: number[],
): Collection {
  const refs: Ref[] = [];
  const pick = (group: GroupName, lists: number[][]): void => {
    const marked = new Set<number>();

    for (const list of lists) {
      for (const slot of list) {
        marked.add(slot);
      }
    }

    if (marked.size === 0) {
      return;
    }

    for (const slot of plan.survivors[group].slots) {
      if (marked.has(slot)) {
        refs.push(core._store.ref(group, slot));
      }
    }
  };

  pick(GROUP_NODES, nodeLists);
  pick(GROUP_EDGES, [edgeSlots]);

  return new Collection(core, refs, { unique: true, live: true });
}
