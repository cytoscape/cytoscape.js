/*
`cy.patch()`'s store tier (round 107): the id-keyed reconcile of a fresh
payload against the live graph, computed as a **plan** — which live
elements survive, which payload entries are added, which live elements
go, and the exact data, position and parent writes each survivor needs —
before anything mutates.  A payload that fails validation (a repeated
id, an edge naming no node) therefore throws with the graph untouched.
`core/patch.mts` applies the plan: removals, adds, writes and events,
inside one batch.

**One funnel with the load path** (round 66).  Every input form reaches
the planner as the columnar form: the wire buffer deserialized — its ids
stay packed and resolve through `IdMap.codeBytes`, so no id string is
decoded for a survivor — the columnar form as given, and the definition
form converted by {@link toPatchPayload} with the same
`collectDataColumns` the load path's converter uses, so a key the load
keeps is exactly a key the reconcile compares.  A data column is
compared **column against store**: a payload value reader against the
`DataStore`'s per-key reader, one key at a time, with no per-element
data object built on either side.

The semantics, fixed at planning (see the round file):

- an id the live graph holds in the same group **survives**; its data
  record is **replaced** (a key the payload element lacks is cleared —
  not a deep merge), its position is written when the payload carries
  one and kept otherwise, and its parent follows the payload;
- an **edge whose source or target changed identity** is removed and
  re-added under its id — rewiring is not a patch;
- an id that changed group (a node's id now names an edge) is likewise
  a remove + add;
- in `'reconcile'` mode every live element the payload does not name is
  removed; in `'merge'` mode it is kept, and a definition-form payload
  may reference kept nodes as endpoints and parents;
- session flags — selection, the `selectable`/`locked`/`grabbable`/
  `pannable` flags — are not read from the payload for a survivor;
  miniature state is, because it describes the current geometry that
  travels with the supplied positions.
*/

import {
  applySelectionColumns,
  collectDataColumns,
  isPackedIds,
} from '../columnar.mjs';
import type { FlagOverride } from '../columnar.mjs';
import type { PartitionedDefs } from '../element-defs.mjs';
import {
  GROUP_EDGES,
  GROUP_NODES,
  DATA_TARGET,
  DATA_SOURCE,
} from '../contract.mjs';
import type { EndKey, GroupName } from '../contract.mjs';
import { NO_PARENT } from '../public-types.mjs';
import type {
  ColumnarEdges,
  ColumnarElements,
  ColumnarNodes,
  DataColumn,
  PackedIds,
} from '../public-types.mjs';
import { isDictColumn } from './data-store.mjs';
import type { GraphStore } from './graph-store.mjs';
import { IdMap } from './id-map.mjs';

/**
 * How a patch treats the live elements its payload does not name:
 * `'reconcile'` removes them (the payload is the new state), `'merge'`
 * keeps them (the payload is a set of upserts).
 */
export type PatchMode = 'reconcile' | 'merge';

/**
 * A payload in the planner's one form: the columnar elements plus what
 * a definition carries and a column cannot.
 */
export interface PatchPayload {
  elements: ColumnarElements;
  /**
   * Node entries at and past this index are **references**, not payload
   * members: an endpoint or parent a definition-form payload names but
   * does not carry.  Only `'merge'` resolves them, against the live graph;
   * the columnar and wire forms have none (they are self-contained).
   */
  memberNodes: number;
  /** per member node, 1 where the definition carried a `position`; null
   * when the payload's positions (if any) cover every node */
  positioned: Uint8Array | null;
  /** the definitions' `locked`/`grabbable`/`pannable` deviations — they
   * apply to added elements only */
  nodeFlags: FlagOverride[];
  edgeFlags: FlagOverride[];
  /** sparse state mask for definition-form patches; absent means every
   * member represented by miniature columns is explicit */
  miniatureSpecified?: Uint8Array;
}

/** One group's survivor writes as parallel arrays; a value of undefined
 * clears the key. */
export interface DataWrites {
  slots: number[];
  keys: string[];
  values: unknown[];
}

/** One group's surviving members: payload index and live slot, in payload order. */
export interface Survivors {
  at: number[];
  slots: number[];
}

/**
 * What a patch will do, computed before it does any of it.  Indices are
 * into the payload's node and edge arrays; slots are live slots.
 */
export interface PatchPlan {
  /** live slots to remove — the core's removal closes over cascades
   * (incident edges, descendants) */
  removeNodes: number[];
  removeEdges: number[];
  /** member payload indices to add, in payload order */
  addNodes: number[];
  addEdges: number[];
  /**
   * Per payload node (members and references): its live slot, or −1
   * while it is yet to be added (the core fills those in as it adds).
   */
  nodeSlots: Int32Array;
  /** the surviving members of each group */
  survivors: Record<GroupName, Survivors>;
  /**
   * Parent assignments: every surviving member whose parent changes and
   * every added member with a parent.  `parent` is a payload node index,
   * or −1 for an orphan.
   */
  parents: { at: number; parent: number }[];
  /** survivor data writes per group */
  writes: Record<GroupName, DataWrites>;
  /** survivor position writes: slots and interleaved x, y */
  moves: { slots: number[]; xy: number[] };
  /** explicit miniature-state adoption, in payload order */
  miniatures: {
    at: number;
    slot: number;
    collapsed: boolean;
    appliedScale: number;
    wasCollapsed: boolean;
  }[];
}

const NO_ID = -2;
const UNKNOWN = -1;
const CLAIM_SURVIVES = 1;
const CLAIM_REPLACED = 2;

const EMPTY_NODES: ColumnarNodes = { count: 0 };
const EMPTY_EDGES: ColumnarEdges = {
  count: 0,
  sources: new Uint32Array(0),
  targets: new Uint32Array(0),
};

const decoder = new TextDecoder();

/**
 * The columnar form of a payload with no references — the columnar and
 * wire inputs.
 *
 * @param elements — a columnar payload (a deserialized wire buffer is one)
 * @returns the planner's form of it
 */
export const columnarPatchPayload = (
  elements: ColumnarElements,
): PatchPayload => ({
  elements,
  memberNodes: elements.nodes?.count ?? 0,
  positioned: null,
  nodeFlags: [],
  edgeFlags: [],
});

/**
 * Convert a definition-form payload to the planner's form.  Unlike the
 * load path's converter it never answers null: an endpoint or parent the
 * payload does not carry becomes a *reference* entry past the members,
 * which `'merge'` mode resolves against the live graph — the one place
 * the definition form is not self-contained, by design.  Positions keep
 * a per-node presence mask, since "absent" means "keep" here where the
 * load path reads it as (0, 0).
 *
 * @param part — the definitions, split by group
 * @returns the planner's form of the payload
 * @throws if an edge definition lacks a source or a target
 */
export const toPatchPayload = (part: PartitionedDefs): PatchPayload => {
  const { nodes, edges } = part;

  if (
    edges.some(
      (def) => def.collapsed != null || def.appliedCollapseScale != null,
    )
  ) {
    throw new Error('Miniature state is supported on nodes only');
  }

  const members = nodes.length;
  const ids: (string | undefined)[] = new Array(members);
  const index = new Map<string, number>();
  let positions: Float32Array | undefined;
  let positioned: Uint8Array | null = null;
  let miniatureSpecified: Uint8Array | undefined;

  for (let i = 0; i < members; i++) {
    const def = nodes[i];
    const raw = def.data?.id;
    const id = raw != null ? String(raw) : undefined;

    ids[i] = id;

    // the first holder keeps the index; a repeat is the planner's error
    if (id != null && !index.has(id)) {
      index.set(id, i);
    }

    const pos = def.position;

    if (pos != null) {
      positions ??= new Float32Array(members * 2);
      positioned ??= new Uint8Array(members);
      positions[i * 2] = pos.x;
      positions[i * 2 + 1] = pos.y;
      positioned[i] = 1;
    }
  }

  const ref = (id: string): number => {
    let at = index.get(id);

    if (at == null) {
      at = ids.length;
      ids.push(id);
      index.set(id, at);
    }

    return at;
  };

  let parent: Uint32Array | undefined;

  for (let i = 0; i < members; i++) {
    const raw = nodes[i].data?.parent;

    if (raw != null) {
      parent ??= new Uint32Array(members).fill(NO_PARENT);
      parent[i] = ref(String(raw));
    }
  }

  const nodesOut: ColumnarNodes = { count: members, ids };

  if (positions != null) {
    nodesOut.positions = positions;
  }
  if (parent != null) {
    nodesOut.parent = parent;
  }

  const nodeData = collectDataColumns(nodes, true);

  if (nodeData != null) {
    nodesOut.data = nodeData;
  }

  const nodeFlags = applySelectionColumns(nodesOut, nodes, false);
  const edgeIds: (string | undefined)[] = new Array(edges.length);
  const edgesOut: ColumnarEdges = {
    count: edges.length,
    ids: edgeIds,
    sources: new Uint32Array(edges.length),
    targets: new Uint32Array(edges.length),
  };

  for (let i = 0; i < edges.length; i++) {
    const data = edges[i].data ?? {};
    const id = data.id != null ? String(data.id) : undefined;

    if (data.source == null || data.target == null) {
      throw new Error(
        `Can not create edge '${id ?? '?'}' without a source and target`,
      );
    }

    edgeIds[i] = id;
    edgesOut.sources[i] = ref(String(data.source));
    edgesOut.targets[i] = ref(String(data.target));
  }

  const edgeData = collectDataColumns(edges);

  if (edgeData != null) {
    edgesOut.data = edgeData;
  }

  const edgeFlags = applySelectionColumns(edgesOut, edges, true);

  const hasMiniatureState = nodes.some(
    (def) => def.collapsed != null || def.appliedCollapseScale != null,
  );

  if (hasMiniatureState) {
    const collapsed = new Uint8Array(ids.length);
    const appliedCollapseScale = new Float64Array(ids.length).fill(1);
    miniatureSpecified = new Uint8Array(ids.length);

    for (let i = 0; i < members; i++) {
      const def = nodes[i];
      const hasState =
        def.collapsed != null || def.appliedCollapseScale != null;

      if (!hasState) {
        continue;
      }

      const on = def.collapsed ?? false;
      const scale = def.appliedCollapseScale;

      if (typeof on !== 'boolean') {
        throw new Error(`Node ${i} collapsed state must be a boolean`);
      }
      if (scale != null && !on && scale !== 1) {
        throw new Error(
          `Node ${i} has an applied collapse scale but is not collapsed`,
        );
      }
      if (
        on &&
        scale != null &&
        (!Number.isFinite(scale) ||
          scale <= 0 ||
          scale > 1 ||
          Math.fround(scale) === 0)
      ) {
        throw new Error(
          `Invalid applied collapse scale '${String(scale)}' (expected a representable value with 0 < scale <= 1)`,
        );
      }

      miniatureSpecified[i] = 1;
      if (on) {
        collapsed[i] = 1;
        appliedCollapseScale[i] = scale == null ? 0 : scale;
      }
    }

    nodesOut.collapsed = collapsed;
    nodesOut.appliedCollapseScale = appliedCollapseScale;
  }

  // the references ride past the members: the node count covers them,
  // every per-member column stops at `members`
  nodesOut.count = ids.length;

  return {
    elements: { columnar: true, nodes: nodesOut, edges: edgesOut },
    memberNodes: members,
    positioned,
    nodeFlags,
    edgeFlags,
    miniatureSpecified,
  };
};

/** Per-entry id access over either id column form. */
interface IdColumn {
  /** the packed store code of entry `i`'s id, UNKNOWN, or NO_ID */
  code(i: number): number;
  /** entry `i`'s id as a string (decoded on demand for a packed column) */
  id(i: number): string | undefined;
  /** bind entry `i`'s id in the scratch map of fresh ids at `slot`;
   * false when it is already there (a packed id is never decoded) */
  claim(i: number, fresh: IdMap, slot: number): boolean;
}

const idColumn = (
  store: GraphStore,
  ids: (string | undefined)[] | PackedIds | undefined,
  count: number,
  what: string,
): IdColumn => {
  if (ids == null) {
    return { code: () => NO_ID, id: () => undefined, claim: () => true };
  }

  if (isPackedIds(ids)) {
    const { offsets, blob } = ids;

    // the corrupt-payload guards `IdMap.setBulk` makes (round 48.3), made
    // before anything is resolved against them
    if (offsets.length < count + 1 || offsets[count] > blob.length) {
      throw new Error(
        `Packed ${what} ids do not fit their blob — the payload is corrupt`,
      );
    }

    return {
      code: (i) => {
        const lo = offsets[i];
        const hi = offsets[i + 1];

        if (hi <= lo) {
          return NO_ID;
        }
        if (hi > offsets[count]) {
          throw new Error(
            `Packed ${what} id ${i} ends past its blob — the payload is corrupt`,
          );
        }

        return store.ids.codeBytes(blob, lo, hi);
      },
      id: (i) =>
        offsets[i + 1] > offsets[i]
          ? decoder.decode(blob.subarray(offsets[i], offsets[i + 1]))
          : undefined,
      claim: (i, fresh, slot) =>
        fresh.setBytes(blob, offsets[i], offsets[i + 1], GROUP_NODES, slot),
    };
  }

  return {
    code: (i) => {
      const id = ids[i];

      return id == null ? NO_ID : store.ids.code(String(id));
    },
    id: (i) => (ids[i] == null ? undefined : String(ids[i])),
    claim: (i, fresh, slot) => {
      const id = String(ids[i]);

      if (fresh.has(id)) {
        return false;
      }

      fresh.set(id, GROUP_NODES, slot);

      return true;
    },
  };
};

/** A payload column's per-entry value, absent as undefined (the ingest's
 * rule: a dictionary index of 0, null and NaN are all absence). */
const valueReader = (
  key: string,
  column: DataColumn,
): ((i: number) => unknown) => {
  if (isDictColumn(column)) {
    const { dict, indices } = column;

    return (i) => {
      const at = indices[i];

      if (at === 0) {
        return undefined;
      }
      if (at > dict.length) {
        throw new Error(
          `Data column '${key}' entry ${i} indexes past its ${dict.length}-entry dictionary ` +
            '— the payload is corrupt',
        );
      }

      return dict[at - 1];
    };
  }

  const values = column as ArrayLike<unknown>;

  return (i) => {
    const v = values[i];

    return v == null || (typeof v === 'number' && Number.isNaN(v))
      ? undefined
      : v;
  };
};

/**
 * Whether two data values are the same value: identical, or structurally
 * equal plain arrays and objects — a fresh payload's objects are never
 * the stored ones, and a patch that rewrote every object-valued key on
 * every refresh would be a patch that never reads as a no-op.
 *
 * @param a — one value
 * @param b — the other
 * @returns true when they are the same value
 */
export const sameValue = (a: unknown, b: unknown): boolean => {
  if (a === b) {
    return true;
  }

  if (typeof a !== 'object' || typeof b !== 'object') {
    return false;
  }
  if (a == null || b == null) {
    return false;
  }

  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) {
      return false;
    }

    for (let i = 0; i < a.length; i++) {
      if (!sameValue(a[i], b[i])) {
        return false;
      }
    }

    return true;
  }

  if (Array.isArray(b)) {
    return false;
  }

  const protoA = Object.getPrototypeOf(a);

  if (
    protoA !== Object.getPrototypeOf(b) ||
    (protoA !== Object.prototype && protoA !== null)
  ) {
    return false;
  }

  const ka = Object.keys(a);

  if (ka.length !== Object.keys(b).length) {
    return false;
  }

  for (const k of ka) {
    if (
      !Object.prototype.hasOwnProperty.call(b, k) ||
      !sameValue(
        (a as Record<string, unknown>)[k],
        (b as Record<string, unknown>)[k],
      )
    ) {
      return false;
    }
  }

  return true;
};

/** Compare one group's payload data against the store, survivor by survivor, key by key. */
const diffData = (
  store: GraphStore,
  group: GroupName,
  columns: Record<string, DataColumn> | undefined,
  survivors: Survivors,
  out: DataWrites,
): void => {
  const n = survivors.at.length;

  if (n === 0) {
    return;
  }

  const payloadKeys = columns == null ? [] : Object.keys(columns);

  for (const key of payloadKeys) {
    const read = valueReader(key, (columns as Record<string, DataColumn>)[key]);
    const stored = store.data.reader(group, key);

    for (let j = 0; j < n; j++) {
      const value = read(survivors.at[j]);
      const slot = survivors.slots[j];

      if (!sameValue(value, stored(slot))) {
        out.slots.push(slot);
        out.keys.push(key);
        out.values.push(value);
      }
    }
  }

  // replace, not merge: a key the store holds and the payload does not
  // is cleared
  const carried = new Set(payloadKeys);

  for (const key of store.data.keys(group)) {
    if (carried.has(key)) {
      continue;
    }

    const stored = store.data.reader(group, key);

    for (let j = 0; j < n; j++) {
      const slot = survivors.slots[j];

      if (stored(slot) !== undefined) {
        out.slots.push(slot);
        out.keys.push(key);
        out.values.push(undefined);
      }
    }
  }
};

/**
 * Plan a patch: resolve every payload id against the live graph, decide
 * survive / add / remove / replace, and compute each survivor's writes.
 * Reads the store and writes nothing.
 *
 * @param store — the live graph
 * @param payload — the payload in the planner's form
 * @param mode — `'reconcile'` removes what the payload does not name;
 *   `'merge'` keeps it
 * @returns the plan
 * @throws if the payload names an id twice, if an edge's source or
 *   target is not a node (in the payload, or — merge mode, definition
 *   form — in the graph), or if a column's length or a packed id section
 *   does not fit the payload's counts
 */
export const planPatch = (
  store: GraphStore,
  payload: PatchPayload,
  mode: PatchMode,
): PatchPlan => {
  const nodesIn = payload.elements.nodes ?? EMPTY_NODES;
  const edgesIn = payload.elements.edges ?? EMPTY_EDGES;
  const nodeCount = nodesIn.count;
  const members = payload.memberNodes;
  const edgeCount = edgesIn.count;

  if (
    edgesIn.sources == null ||
    edgesIn.targets == null ||
    edgesIn.sources.length < edgeCount ||
    edgesIn.targets.length < edgeCount
  ) {
    throw new Error(
      `Columnar edges must provide ${edgeCount} sources and targets`,
    );
  }
  if (nodesIn.positions != null && nodesIn.positions.length < members * 2) {
    throw new Error(
      `Columnar node positions must hold ${members * 2} floats; got ${nodesIn.positions.length}`,
    );
  }
  if (nodesIn.parent != null && nodesIn.parent.length < members) {
    throw new Error(
      `Columnar node parent column must hold ${members} entries; got ${nodesIn.parent.length}`,
    );
  }
  if (nodesIn.collapsed != null && nodesIn.collapsed.length < members) {
    throw new Error(
      `Columnar node collapsed column must hold ${members} entries; got ${nodesIn.collapsed.length}`,
    );
  }
  if (
    nodesIn.appliedCollapseScale != null &&
    nodesIn.appliedCollapseScale.length < members
  ) {
    throw new Error(
      `Columnar node applied collapse scale column must hold ${members} entries; got ${nodesIn.appliedCollapseScale.length}`,
    );
  }
  if (
    payload.miniatureSpecified != null &&
    payload.miniatureSpecified.length < members
  ) {
    throw new Error(`Patch miniature state mask must hold ${members} entries`);
  }

  const nodeIds = idColumn(store, nodesIn.ids, nodeCount, 'node');
  const edgeIds = idColumn(store, edgesIn.ids, edgeCount, 'edge');
  const nodeClaim = new Uint8Array(store.highWater(GROUP_NODES));
  const edgeClaim = new Uint8Array(store.highWater(GROUP_EDGES));
  const edgeCodes = new Int32Array(edgeCount);
  // the ids no live element holds, or being re-added under a new
  // identity: repeats among these are caught in a scratch id map (bytes
  // in, nothing decoded), repeats among survivors by the claim arrays
  const fresh = new IdMap();
  const duplicate = (id: string | undefined): never => {
    throw new Error(`The patch payload names the id '${id}' more than once`);
  };
  let freshCount = 0;
  const claimFresh = (column: IdColumn, i: number): void => {
    if (!column.claim(i, fresh, freshCount++)) {
      duplicate(column.id(i));
    }
  };

  const plan: PatchPlan = {
    removeNodes: [],
    removeEdges: [],
    addNodes: [],
    addEdges: [],
    nodeSlots: new Int32Array(nodeCount).fill(-1),
    survivors: {
      nodes: { at: [], slots: [] },
      edges: { at: [], slots: [] },
    },
    parents: [],
    writes: {
      nodes: { slots: [], keys: [], values: [] },
      edges: { slots: [], keys: [], values: [] },
    },
    moves: { slots: [], xy: [] },
    miniatures: [],
  };

  // 1. edge ids naming live nodes: those nodes are replaced, which the
  //    node pass and the references must know before they run
  for (let e = 0; e < edgeCount; e++) {
    const code = edgeIds.code(e);

    edgeCodes[e] = code;

    if (code >= 0 && (code & 1) === 0) {
      const slot = code >>> 1;

      if (nodeClaim[slot] !== 0) {
        duplicate(edgeIds.id(e));
      }

      nodeClaim[slot] = CLAIM_REPLACED;
      plan.removeNodes.push(slot);
    }
  }

  // 2. member nodes: survive, or add (a fresh id, no id, or an id an
  //    edge holds — that edge is replaced)
  for (let i = 0; i < members; i++) {
    const code = nodeIds.code(i);

    if (code === NO_ID) {
      plan.addNodes.push(i);
    } else if (code === UNKNOWN) {
      claimFresh(nodeIds, i);
      plan.addNodes.push(i);
    } else if ((code & 1) === 1) {
      const slot = code >>> 1;

      if (edgeClaim[slot] !== 0) {
        duplicate(nodeIds.id(i));
      }

      edgeClaim[slot] = CLAIM_REPLACED;
      plan.removeEdges.push(slot);
      claimFresh(nodeIds, i);
      plan.addNodes.push(i);
    } else {
      const slot = code >>> 1;

      if (nodeClaim[slot] !== 0) {
        duplicate(nodeIds.id(i));
      }

      nodeClaim[slot] = CLAIM_SURVIVES;
      plan.nodeSlots[i] = slot;
      plan.survivors.nodes.at.push(i);
      plan.survivors.nodes.slots.push(slot);
    }
  }

  // 3. references (definition form only): a live node the patch keeps,
  //    and only in merge mode — reconcile removes whatever it does not name
  for (let i = members; i < nodeCount; i++) {
    const code = nodeIds.code(i);

    if (
      mode === 'merge' &&
      code >= 0 &&
      (code & 1) === 0 &&
      nodeClaim[code >>> 1] !== CLAIM_REPLACED
    ) {
      plan.nodeSlots[i] = code >>> 1;
    }
  }

  // 4. edges: survive when the id and both endpoint identities hold;
  //    rewired, or an id a node held, is remove + add
  const endpoints = store.edgeEndpoints();
  const endpoint = (e: number, which: EndKey, at: number): number => {
    if (at >= nodeCount) {
      throw new Error(
        `Columnar edge ${e} references node index ${at} but the payload has ${nodeCount} nodes ` +
          `(columnar payloads are self-contained; use the definition form for cross-references)`,
      );
    }

    if (at >= members && plan.nodeSlots[at] < 0) {
      throw new Error(
        `The ${which} '${nodeIds.id(at)}' of edge '${edgeIds.id(e) ?? '?'}' is not a node ` +
          (mode === 'merge'
            ? 'in this payload or the graph'
            : "in this payload (a 'reconcile' patch removes every node its payload does not name; " +
              "use mode 'merge' to reference nodes already in the graph)"),
      );
    }

    return plan.nodeSlots[at];
  };

  for (let e = 0; e < edgeCount; e++) {
    const source = endpoint(e, DATA_SOURCE, edgesIn.sources[e]);
    const target = endpoint(e, DATA_TARGET, edgesIn.targets[e]);
    const code = edgeCodes[e];

    if (code === NO_ID) {
      plan.addEdges.push(e);
      continue;
    }
    if (code === UNKNOWN || (code & 1) === 0) {
      claimFresh(edgeIds, e);
      plan.addEdges.push(e);
      continue;
    }

    const slot = code >>> 1;

    if (edgeClaim[slot] !== 0) {
      duplicate(edgeIds.id(e));
    }

    if (
      source >= 0 &&
      target >= 0 &&
      endpoints[slot * 2] === source &&
      endpoints[slot * 2 + 1] === target
    ) {
      edgeClaim[slot] = CLAIM_SURVIVES;
      plan.survivors.edges.at.push(e);
      plan.survivors.edges.slots.push(slot);
    } else {
      edgeClaim[slot] = CLAIM_REPLACED;
      plan.removeEdges.push(slot);
      claimFresh(edgeIds, e);
      plan.addEdges.push(e);
    }
  }

  // 5. reconcile: everything unclaimed goes (the replaced are unclaimed
  //    as survivors, and were listed above — reset so the scan owns them)
  if (mode === 'reconcile') {
    plan.removeNodes = [];
    plan.removeEdges = [];
    store.forEachAlive(GROUP_NODES, (slot) => {
      if (nodeClaim[slot] !== CLAIM_SURVIVES) {
        plan.removeNodes.push(slot);
      }
    });
    store.forEachAlive(GROUP_EDGES, (slot) => {
      if (edgeClaim[slot] !== CLAIM_SURVIVES) {
        plan.removeEdges.push(slot);
      }
    });
  }

  // 6. parents: structure, so replaced like data — a member without one
  //    is an orphan after the patch
  const parentsIn = nodesIn.parent;

  for (let i = 0; i < members; i++) {
    let parent = -1;
    const at = parentsIn == null ? NO_PARENT : parentsIn[i];

    if (at !== NO_PARENT) {
      if (at >= nodeCount) {
        throw new Error(
          `Columnar node ${i} references parent index ${at} but the payload has ${nodeCount} nodes ` +
            `(columnar payloads are self-contained; use the definition form for cross-references)`,
        );
      }

      if (at >= members && plan.nodeSlots[at] < 0) {
        // the load path's rule for a parent it cannot find
        console.warn(
          `Node '${nodeIds.id(i) ?? '?'}' has nonexistant parent '${nodeIds.id(at)}'; patched as an orphan`,
        );
      } else {
        parent = at;
      }
    }

    const slot = plan.nodeSlots[i];

    if (slot < 0) {
      if (parent >= 0) {
        plan.parents.push({ at: i, parent });
      }

      continue;
    }

    const current = store.parentOf(slot);
    const changed =
      parent < 0
        ? current !== -1
        : plan.nodeSlots[parent] < 0 || plan.nodeSlots[parent] !== current;

    if (changed) {
      plan.parents.push({ at: i, parent });
    }
  }

  // 7. explicit miniature state: patch adopts current positions and factors
  // together; it never calls the public operation that rescales positions.
  if (nodesIn.collapsed != null || nodesIn.appliedCollapseScale != null) {
    const collapsed = nodesIn.collapsed;
    const scales = nodesIn.appliedCollapseScale;

    for (let i = 0; i < members; i++) {
      if (payload.miniatureSpecified?.[i] === 0) {
        continue;
      }

      const on = collapsed?.[i] ?? 0;
      const scale = scales?.[i] ?? (on === 1 ? 0 : 1);

      if (on !== 0 && on !== 1) {
        throw new Error(`Columnar node collapsed value at ${i} must be 0 or 1`);
      }
      if (on === 1) {
        if (
          !Number.isFinite(scale) ||
          scale < 0 ||
          scale > 1 ||
          (scale > 0 && Math.fround(scale) === 0)
        ) {
          throw new Error(
            `Invalid applied collapse scale at node ${i} (expected 0 for configured scale, or 0 < scale <= 1)`,
          );
        }
      } else if (scale !== 1) {
        throw new Error(
          `Expanded node ${i} must have applied collapse scale 1`,
        );
      }

      const slot = plan.nodeSlots[i];
      const appliedScale =
        on === 0
          ? 1
          : scale === 0 && slot >= 0
            ? store.collapseScaleOf(slot)
            : scale;
      const wasCollapsed = slot >= 0 && store.isCollapsed(slot);

      if (
        (slot < 0 && on === 1) ||
        (slot >= 0 &&
          (wasCollapsed !== (on === 1) ||
            (on === 1 && store.appliedCollapseScaleOf(slot) !== appliedScale)))
      ) {
        plan.miniatures.push({
          at: i,
          slot,
          collapsed: on === 1,
          appliedScale,
          wasCollapsed,
        });
      }
    }

    const collapsedChanges = plan.miniatures.filter((state) => state.collapsed);

    if (collapsedChanges.length > 0) {
      const removed = new Set(plan.removeNodes);
      const parentChanges = new Map<number, number>();
      const childrenBySlot = new Set<number>();
      const childrenByAt = new Set<number>();

      for (const change of plan.parents) {
        const slot = plan.nodeSlots[change.at];
        const parent = change.parent < 0 ? -1 : plan.nodeSlots[change.parent];

        if (slot >= 0) {
          parentChanges.set(slot, parent);
        }
      }

      store.forEachAlive(GROUP_NODES, (child) => {
        if (removed.has(child)) {
          return;
        }

        const parent = parentChanges.has(child)
          ? parentChanges.get(child)!
          : store.parentOf(child);

        if (parent >= 0) {
          childrenBySlot.add(parent);
        }
      });

      for (const change of plan.parents) {
        if (plan.nodeSlots[change.at] < 0 && change.parent >= 0) {
          const parent = plan.nodeSlots[change.parent];

          if (parent >= 0) {
            childrenBySlot.add(parent);
          } else {
            childrenByAt.add(change.parent);
          }
        }
      }

      for (const state of collapsedChanges) {
        const hasChild =
          state.slot >= 0
            ? childrenBySlot.has(state.slot)
            : childrenByAt.has(state.at);

        if (!hasChild) {
          throw new Error(
            `Node '${nodeIds.id(state.at) ?? '?'}' can only be collapsed when it is a compound parent`,
          );
        }
      }
    }
  }

  // 8. positions: present in the payload → written, absent → kept
  const positions = nodesIn.positions;

  if (positions != null) {
    const stored = store.nodePositions();
    const { at, slots } = plan.survivors.nodes;

    for (let j = 0; j < at.length; j++) {
      const i = at[j];

      if (payload.positioned != null && payload.positioned[i] === 0) {
        continue;
      }

      const slot = slots[j];
      const x = Math.fround(positions[i * 2]);
      const y = Math.fround(positions[i * 2 + 1]);

      if (x !== stored[slot * 2] || y !== stored[slot * 2 + 1]) {
        plan.moves.slots.push(slot);
        plan.moves.xy.push(x, y);
      }
    }
  }

  // 9. data: replace the record, compared column against store
  diffData(
    store,
    GROUP_NODES,
    nodesIn.data,
    plan.survivors.nodes,
    plan.writes.nodes,
  );
  diffData(
    store,
    GROUP_EDGES,
    edgesIn.data,
    plan.survivors.edges,
    plan.writes.edges,
  );

  return plan;
};

/**
 * A subset of a columnar group's entries, as a columnar group of its own
 * — what the adds ingest.  Packed ids stay packed (their bytes copy, no
 * string is decoded); data columns keep their kind.
 *
 * @param group — the payload group
 * @param indices — the entries to take, in order
 * @returns the entries' ids, positions, selection columns and data
 */
export const takeEntries = (
  group: ColumnarNodes | ColumnarEdges,
  indices: number[],
): {
  ids?: (string | undefined)[] | PackedIds;
  positions?: Float32Array;
  collapsed?: Uint8Array;
  appliedCollapseScale?: Float64Array;
  selected?: Uint8Array;
  selectable?: Uint8Array;
  data?: Record<string, DataColumn>;
} => {
  const k = indices.length;
  const out: ReturnType<typeof takeEntries> = {};
  const ids = group.ids;

  if (ids != null) {
    if (isPackedIds(ids)) {
      const offsets = new Uint32Array(k + 1);
      let total = 0;

      for (let j = 0; j < k; j++) {
        const i = indices[j];

        total += ids.offsets[i + 1] - ids.offsets[i];
        offsets[j + 1] = total;
      }

      const blob = new Uint8Array(total);

      for (let j = 0; j < k; j++) {
        const i = indices[j];

        blob.set(
          ids.blob.subarray(ids.offsets[i], ids.offsets[i + 1]),
          offsets[j],
        );
      }

      out.ids = { offsets, blob };
    } else {
      out.ids = indices.map((i) => ids[i]);
    }
  }

  const positions = (group as ColumnarNodes).positions;

  if (positions != null) {
    const xy = new Float32Array(k * 2);

    for (let j = 0; j < k; j++) {
      xy[j * 2] = positions[indices[j] * 2];
      xy[j * 2 + 1] = positions[indices[j] * 2 + 1];
    }

    out.positions = xy;
  }

  const nodes = group as ColumnarNodes;

  if (nodes.collapsed != null) {
    out.collapsed = Uint8Array.from(indices, (i) => nodes.collapsed![i]);
  }
  if (nodes.appliedCollapseScale != null) {
    out.appliedCollapseScale = Float64Array.from(
      indices,
      (i) => nodes.appliedCollapseScale![i],
    );
  }

  if (group.selected != null) {
    out.selected = Uint8Array.from(indices, (i) => group.selected![i]);
  }
  if (group.selectable != null) {
    out.selectable = Uint8Array.from(indices, (i) => group.selectable![i]);
  }

  if (group.data != null) {
    const data: Record<string, DataColumn> = {};

    for (const [key, column] of Object.entries(group.data)) {
      if (isDictColumn(column)) {
        data[key] = {
          dict: column.dict,
          indices: Uint32Array.from(indices, (i) => column.indices[i]),
        };
      } else if (column instanceof Float64Array) {
        data[key] = Float64Array.from(indices, (i) => column[i]);
      } else {
        const values = column as ArrayLike<unknown>;

        data[key] = indices.map((i) => values[i]);
      }
    }

    out.data = data;
  }

  return out;
};
