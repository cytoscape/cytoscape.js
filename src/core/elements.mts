// Core's add pipeline (round 130 split): definitions, columnar and wire
// inputs, the flag overrides and the bulk-add events.

import { Collection } from '../collection.mjs';
import {
  buildColumnar,
  isColumnarElements,
  isPackedIds,
  refCount,
} from '../columnar.mjs';
import type { FlagOverride } from '../columnar.mjs';
import { deserializeElements, isSerializedElements } from '../wire.mjs';
import { partitionDefs } from '../element-defs.mjs';
import type { PartitionedDefs } from '../element-defs.mjs';
import {
  GROUP_EDGES,
  GROUP_NODES,
  FLAG_GRABBABLE,
  FLAG_LOCKED,
  FLAG_PANNABLE,
} from '../contract.mjs';
import type { GroupName, Ref } from '../contract.mjs';
import type {
  ColumnarEdges,
  ColumnarElements,
  ElementDefinition,
  ElementsDefinition,
  ElementsInput,
  PackedIds,
} from '../public-types.mjs';
import type { Core } from '../core.mjs';
import { _applyStyle } from './batching.mjs';

/**
 * Add elements to the graph and return them as a collection.
 *
 * Takes all three input forms: the classic v3 definition form (one
 * object, an array, or `{ nodes, edges }`), the columnar bulk form
 * (typed-array columns with edge endpoints as node *indices*), and the
 * binary wire buffer produced by `serializeElements`/`cy.serialize()`.
 * Nodes are added before edges, so an edge may reference a node added in
 * the same call.
 *
 * Fires `add` per element.  Inside a batch the first style application
 * of the new elements defers to the outermost `endBatch()`, so
 * style-derived reads (`width()`, `label()`) may be stale until then.
 *
 * **Graph-level `data()` in a wire buffer is ignored here** (round
 * 39.2), where `options.elements` applies it: adding elements to a
 * populated graph must not overwrite that graph's own `data()`.  Apply
 * it explicitly with `cy.data( deserializeElements( buf ).data )` if
 * that is what you want.
 *
 * @param input — elements in definition, columnar or wire form
 * @returns a collection of the added elements
 */
export function add(core: Core, input: ElementsInput): Collection {
  const defs = isSerializedElements(input) ? deserializeElements(input) : input;
  const refs = isColumnarElements(defs)
    ? _columnarRefs(core, _addColumnar(core, defs))
    : _addDefs(core, defs);
  const added = new Collection(core, refs, { unique: true });

  if (core._hasListeners('add')) {
    for (let i = 0; i < added.length; i++) {
      core._emitOnEle('add', added[i]);
    }
  }

  return added;
}

/**
 * Bulk load path (the factory's `options.elements`): adds without
 * materializing per-element handles or a return collection — on a
 * 500k-element load the handle layer costs more than the model writes
 * and the caller uses none of it.  `add` events still fire per element
 * when anyone is listening (never the case at construction time).
 *
 * **A definition-form payload loads through the columnar ingest too**
 * (round 66): it is converted first, because convert-then-ingest is
 * cheaper than the def loop — measured 1.2-1.8x end to end, from 4k to
 * 800k elements and on the ndex-x-large renderer scene (1696 -> 980 ms).
 * The def loop pays a `Table.alloc` per element and two
 * `IdIndex` lookups per edge, where the columnar path takes one
 * contiguous `allocBulk` run and resolves endpoints by index; the
 * conversion costs about a tenth of what that saves.  The route is
 * taken only when the payload is self-contained (every edge endpoint
 * names a node in the same payload) — otherwise `buildColumnar` answers
 * null and the def path runs, and reports the error, as before.
 */
export function _bulkAdd(core: Core, input: ElementsInput): void {
  // round 67: one bulk-load window over the whole ingest, so the curve
  // index takes one pass over the finished pair map instead of a mark
  // per edge.  `cy.add()` gets no window, deliberately — it adds into
  // a populated graph, where the pairs it touches are a small subset.
  core._store.beginBulkLoad();

  try {
    _bulkAddInner(core, input);
  } finally {
    core._store.endBulkLoad();
  }
}

/** The add pipeline proper: partition the input by group, allocate slots, ingest data, apply the style and emit the adds, inside one batch. */
export function _bulkAddInner(core: Core, input: ElementsInput): void {
  const defs = isSerializedElements(input) ? deserializeElements(input) : input;

  if (isColumnarElements(defs)) {
    // graph-level data rides the wire since round 39.2, and only core
    // path applies it: at construction the graph's data() is empty, so
    // there is nothing to clobber.  `add()` deliberately drops it.
    if (defs.data != null) {
      Object.assign(core._graphData, defs.data);
    }

    const { nodeSlots, edgeSlots } = _addColumnar(core, defs);

    _emitBulkAdds(core, nodeSlots, edgeSlots);

    return;
  }

  const part = partitionDefs(defs);
  const bulk = buildColumnar(part, 'bulk');

  if (bulk != null) {
    const { nodeSlots, edgeSlots } = _addColumnar(
      core,
      bulk.elements,
      bulk.nodeFlags,
      bulk.edgeFlags,
    );

    _emitBulkAdds(core, nodeSlots, edgeSlots);

    return;
  }

  const refs = _addPartition(core, part);

  if (core._hasListeners('add')) {
    for (const ref of refs) {
      core._emitOnEle('add', core._eleFromRef(ref));
    }
  }
}

/** Per-element `add` for a columnar bulk, nodes before edges. */
export function _emitBulkAdds(
  core: Core,
  nodeSlots: Uint32Array,
  edgeSlots: Uint32Array,
): void {
  if (!core._hasListeners('add')) {
    return;
  }

  for (const slot of nodeSlots) {
    core._emitOnEle('add', core._ele(GROUP_NODES, slot));
  }
  for (const slot of edgeSlots) {
    core._emitOnEle('add', core._ele(GROUP_EDGES, slot));
  }
}

/**
 * Columnar ingest: store-level bulk adds + one bulk style pass.
 *
 * The optional flag overrides come from a converted definition payload
 * — `locked`, `grabbable` and `pannable` have no column.  They are
 * written before the style pass, where the def path also has them: a
 * later write would still be *correct*, since `::locked` and
 * `::grabbable` are styleable conditions and a condition-flag write
 * restyles its slot, but it would pay for that restyle.
 */
export function _addColumnar(
  core: Core,
  elements: ColumnarElements,
  nodeFlags?: FlagOverride[],
  edgeFlags?: FlagOverride[],
): {
  nodeSlots: Uint32Array;
  edgeSlots: Uint32Array;
} {
  const newId = (): string => _newId(core);
  // round 103: node references resolve before anything is added, so a
  // chunk naming a node the graph does not hold fails whole
  const refSlots = _resolveRefs(core, elements);
  const nodeSlots =
    elements.nodes != null && elements.nodes.count > 0
      ? core._store.addNodesColumnar(
          elements.nodes,
          newId,
          refSlots ?? undefined,
        )
      : new Uint32Array(0);
  let endpointSlots = nodeSlots;

  if (refSlots != null) {
    // the endpoint table: the payload's own nodes, then its references
    // (every endpoint ref resolved — `_resolveRefs` checked)
    endpointSlots = new Uint32Array(nodeSlots.length + refSlots.length);
    endpointSlots.set(nodeSlots);
    endpointSlots.set(refSlots, nodeSlots.length);
  }

  const edgeSlots =
    elements.edges != null && elements.edges.count > 0
      ? core._store.addEdgesColumnar(elements.edges, endpointSlots, newId)
      : new Uint32Array(0);

  if (nodeFlags != null && nodeFlags.length > 0) {
    _applyFlagOverrides(core, GROUP_NODES, nodeSlots, nodeFlags, false);
  }
  if (edgeFlags != null && edgeFlags.length > 0) {
    _applyFlagOverrides(core, GROUP_EDGES, edgeSlots, edgeFlags, true);
  }

  _applyStyle(core, GROUP_NODES, nodeSlots);
  _applyStyle(core, GROUP_EDGES, edgeSlots);

  return { nodeSlots, edgeSlots };
}

/**
 * Resolve a columnar payload's node references (round 103) to live
 * slots, one probe per reference however many edges index it.
 *
 * An endpoint must resolve — an edge cannot exist without its node — so
 * a reference an edge indexes that names no node in the graph throws
 * here, before anything is added.  A reference only parents index
 * resolves to −1 when it names nothing, and the ingest warns and
 * orphans, as the definition path does for an unknown parent.
 *
 * @param elements — the payload
 * @returns the live slot per reference (−1 = unresolved parent), or
 *   null when the payload carries none
 * @throws if an edge endpoint's reference names no node in the graph,
 *   or names an edge
 */
export function _resolveRefs(
  core: Core,
  elements: ColumnarElements,
): Int32Array | null {
  const count = refCount(elements);

  if (count === 0) {
    return null;
  }

  const refs = elements.refs!;
  const store = core._store;
  const slots = new Int32Array(count);
  const idOf = (i: number): string =>
    isPackedIds(refs) ? decodeRef(refs, i) : String(refs[i]);

  for (let i = 0; i < count; i++) {
    const code = isPackedIds(refs)
      ? store.ids.codeBytes(refs.blob, refs.offsets[i], refs.offsets[i + 1])
      : store.lookupCode(String(refs[i]));

    if (code >= 0 && (code & 1) === 1) {
      throw new Error(
        `The payload's node reference '${idOf(i)}' names an edge, not a node`,
      );
    }

    slots[i] = code < 0 ? -1 : code >>> 1;
  }

  // an endpoint's reference must have resolved
  const members = elements.nodes?.count ?? 0;
  const edges = elements.edges;

  if (edges != null) {
    for (let e = 0; e < edges.count; e++) {
      for (const at of [edges.sources[e], edges.targets[e]]) {
        if (at >= members && at - members < count && slots[at - members] < 0) {
          throw new Error(
            `Can not create edge ${edgeLabel(edges, e)}: its node reference ` +
              `'${idOf(at - members)}' is not a node in the graph`,
          );
        }
      }
    }
  }

  return slots;
}

const refDecoder = new TextDecoder();

/** One packed reference's id, decoded — for an error message only. */
const decodeRef = (refs: PackedIds, i: number): string =>
  refDecoder.decode(refs.blob.subarray(refs.offsets[i], refs.offsets[i + 1]));

/** An edge's id for a message, or its payload index when it has none. */
const edgeLabel = (edges: ColumnarEdges, e: number): string => {
  const ids = edges.ids;

  if (ids == null) {
    return `#${e}`;
  }

  const id = isPackedIds(ids)
    ? refDecoder.decode(ids.blob.subarray(ids.offsets[e], ids.offsets[e + 1]))
    : ids[e];

  return id != null && id !== '' ? `'${id}'` : `#${e}`;
};

/** Write the def flags the columnar columns cannot carry. */
export function _applyFlagOverrides(
  core: Core,
  group: GroupName,
  slots: Uint32Array,
  overrides: FlagOverride[],
  pannableDefault: boolean,
): void {
  for (const { at, def } of overrides) {
    const slot = slots[at];

    if (def.locked === true) {
      core._store.setFlag(group, slot, FLAG_LOCKED, true);
    }
    if (def.grabbable === false) {
      core._store.setFlag(group, slot, FLAG_GRABBABLE, false);
    }
    if (def.pannable != null && def.pannable !== pannableDefault) {
      core._store.setFlag(group, slot, FLAG_PANNABLE, def.pannable);
    }
  }
}

/** The refs of the slots a columnar load allocated, in load order. */
export function _columnarRefs(
  core: Core,
  {
    nodeSlots,
    edgeSlots,
  }: {
    nodeSlots: Uint32Array;
    edgeSlots: Uint32Array;
  },
): Ref[] {
  const refs: Ref[] = [];

  for (const slot of nodeSlots) {
    refs.push(core._store.ref(GROUP_NODES, slot));
  }
  for (const slot of edgeSlots) {
    refs.push(core._store.ref(GROUP_EDGES, slot));
  }

  return refs;
}

/** Shared add loop: nodes first so edges can reference same-call nodes. */
export function _addDefs(
  core: Core,
  defs: ElementsDefinition | ElementDefinition,
): Ref[] {
  return _addPartition(core, partitionDefs(defs));
}

/**
 * `_addDefs` over defs already split by group, so the bulk load path
 * can partition once and hand the same split to whichever route it
 * takes.
 */
export function _addPartition(core: Core, part: PartitionedDefs): Ref[] {
  const { nodes: nodeDefs, edges: edgeDefs } = part;

  core._store.reserve(nodeDefs.length, edgeDefs.length);

  const refs: Ref[] = [];
  const nodeSlots: number[] = [];
  const edgeSlots: number[] = [];

  for (const def of nodeDefs) {
    const data = def.data ?? {};
    const id = data.id != null ? String(data.id) : _newId(core);
    const pos = def.position ?? { x: 0, y: 0 };
    const slot = core._store.addNode(id, pos.x, pos.y, def);

    core._store.setDefData(GROUP_NODES, slot, data);
    nodeSlots.push(slot);
    refs.push(core._store.ref(GROUP_NODES, slot));
  }

  // second pass (round 14.2): resolve def parents once the batch's nodes
  // all exist, so forward references work in any def order; an unknown or
  // non-node parent warns and leaves the node an orphan (v3's rule, with
  // the silent-drop case upgraded to a warning)
  for (let i = 0; i < nodeDefs.length; i++) {
    const parent = nodeDefs[i].data?.parent;

    if (parent == null) {
      continue;
    }

    const parentRef = core._store.lookup(String(parent));

    if (parentRef == null || parentRef.group !== GROUP_NODES) {
      console.warn(
        `Node '${core._store.idAt(GROUP_NODES, nodeSlots[i])}' has nonexistant parent ` +
          `'${String(parent)}'; added as an orphan`,
      );

      continue;
    }

    core._store.setParent(nodeSlots[i], parentRef.slot);
  }

  for (const def of edgeDefs) {
    const data = def.data ?? {};
    const id = data.id != null ? String(data.id) : _newId(core);

    if (data.source == null || data.target == null) {
      throw new Error(
        `Can not create edge '${id}' without a source and target`,
      );
    }

    const slot = core._store.addEdge(
      id,
      String(data.source),
      String(data.target),
      def,
    );

    core._store.setDefData(GROUP_EDGES, slot, data);
    edgeSlots.push(slot);
    refs.push(core._store.ref(GROUP_EDGES, slot));
  }

  _applyStyle(core, GROUP_NODES, nodeSlots);
  _applyStyle(core, GROUP_EDGES, edgeSlots);

  return refs;
}

/**
 * A synthetic id for an element added without one.  The prefix read `gpu-`
 * until round 43 — a leftover the 42.6 rename missed, and a user-visible one,
 * since it is what `ele.id()` returns.
 */
export function _newId(core: Core): string {
  let id: string;

  do {
    id = 'cy-' + core._idCounter;
    core._idCounter++;
  } while (core._store.ids.has(id));

  return id;
}
