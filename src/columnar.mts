import { partitionDefs } from './element-defs.mjs';
import type { PartitionedDefs } from './element-defs.mjs';
import { NO_PARENT } from './public-types.mjs';
import type {
  ColumnarEdges,
  ColumnarElements,
  ColumnarNodes,
  ElementDefinition,
  ElementsDefinition,
  PackedIds,
} from './public-types.mjs';
import { DATA_TARGET, DATA_SOURCE, DATA_PARENT, DATA_ID } from './contract.mjs';
import type { EndKey } from './contract.mjs';

/*
Definition-form (v3-style JSON) → columnar bulk-load form.  The columnar
form is what the loader ingests fastest — typed-array columns, edge
endpoints as node indices — and this converter is the compat path for
callers holding classic elements JSON.  Payloads are self-contained —
every edge endpoint must name a node in the same payload — unless they
carry node references (round 103): the ids of nodes already in the graph,
indexed past the payload's own nodes.
*/

/**
 * Whether an id column is in the packed byte form rather than a plain
 * array of strings.
 *
 * @param ids — the id column to test
 * @returns true for the `{ offsets, blob }` packed form
 */
export const isPackedIds = (
  ids: (string | undefined)[] | PackedIds,
): ids is PackedIds => {
  return !Array.isArray(ids);
};

/**
 * Whether an elements payload is in the columnar bulk-load form.
 *
 * @param elements — a payload in definition or columnar form
 * @returns true when it carries `columnar: true`
 */
export const isColumnarElements = (
  elements: ElementsDefinition | ElementDefinition | ColumnarElements,
): elements is ColumnarElements => {
  return (elements as ColumnarElements).columnar === true;
};

/**
 * A definition whose flags the columnar form cannot carry, paired with
 * its payload index.  The columnar columns cover `selected` and
 * `selectable`; `locked`, `grabbable` and `pannable` have no column, so
 * the bulk load path writes them per element after the ingest.
 */
export interface FlagOverride {
  /** index into the payload's nodes or edges */
  at: number;
  def: ElementDefinition;
}

/**
 * A converted payload plus the flag deviations it could not carry — what
 * the core's bulk load path needs to reproduce the definition path
 * exactly.  {@link toColumnarElements} is the lossy public view of this.
 */
export interface ColumnarBulk {
  elements: ColumnarElements;
  /** empty in the overwhelmingly common case (no def sets these flags) */
  nodeFlags: FlagOverride[];
  edgeFlags: FlagOverride[];
}

/** Options for {@link toColumnarElements}. */
export interface ToColumnarOptions {
  /**
   * Carry what the payload names but does not hold as **node references**
   * (round 103) instead of throwing: an edge endpoint or a node parent
   * that is not a node in the payload goes into the result's `refs`,
   * indexed past its own nodes, to be resolved against the graph the
   * payload loads into.  This is how a chunk of a progressive
   * `cy.load()` carries its cut edges in the columnar and wire forms.
   * Default false: the payload must be self-contained.
   */
  refs?: boolean;
}

/**
 * Convert classic v3-style elements JSON into the columnar bulk-load
 * form: typed-array columns with edge endpoints as node *indices*.
 *
 * This is the compatibility path for callers holding definition-form
 * JSON; the columnar form is what the loader ingests fastest, since
 * contiguous slot runs become memcpys and no per-element objects or
 * per-edge id lookups are needed.  Exposed publicly as
 * `cytoscape.toColumnarElements`.
 *
 * **The columnar form has no column for `locked`, `grabbable` or
 * `pannable`**, so a def setting one of those converts without it.  The
 * factory's own definition-form load does not go through this function
 * for that reason — it uses the internal {@link buildColumnar}, which
 * reports the deviations so it can write them after the ingest.
 *
 * @param defs — one element, an array, or `{ nodes, edges }`
 * @param options — `{ refs }`: carry endpoints and parents the payload
 *   does not hold as node references rather than throwing (round 103)
 * @returns the equivalent columnar payload — self-contained, or with
 *   `refs` when that option is on and something was referenced
 * @throws if an edge lacks a source or target; without `refs`, also if
 *   an edge names a source or target that is not a node in the same
 *   payload — columnar payloads are self-contained unless they carry
 *   references; and on an unknown option
 */
export const toColumnarElements = (
  defs: ElementsDefinition | ElementDefinition,
  options: ToColumnarOptions = {},
): ColumnarElements => {
  for (const key of Object.keys(options)) {
    if (key !== 'refs') {
      throw new Error(
        `Unknown toColumnarElements() option '${key}' (the one option is 'refs')`,
      );
    }
  }

  return buildColumnar(
    partitionDefs(defs),
    options.refs === true ? 'refs' : 'strict',
  )!.elements;
};

/**
 * How {@link buildColumnar} treats a name the payload does not hold:
 * `'strict'` throws (the public converter's default), `'bulk'` answers
 * null so the caller falls back to the definition path (the factory's
 * load), `'refs'` carries it as a node reference (round 103).
 */
export type ColumnarMode = 'strict' | 'bulk' | 'refs';

/**
 * The conversion itself, over defs already partitioned by group.
 *
 * Three callers with three different needs, hence the mode.  The public
 * converter is `'strict'` and throws on an endpoint it cannot resolve;
 * the core's bulk load path is `'bulk'`, because an unresolvable
 * endpoint there simply means the payload is not a candidate for this
 * route (it may be malformed) — it answers `null` and the caller falls
 * back to the definition path, which is then the one that raises the
 * error, with its own message.  `cy.load()`'s chunks and the public
 * converter's `refs` option are `'refs'` (round 103): an endpoint or a
 * parent outside the payload becomes an entry of `refs`, indexed past
 * the payload's nodes, for the ingest to resolve against the graph.
 *
 * @param part — defs already split into nodes and edges
 * @param mode — what an unresolvable name does (see {@link ColumnarMode})
 * @returns the payload and its flag deviations, or null when an edge
 *   endpoint does not name a node in the same payload (`'bulk'` only)
 * @throws in `'strict'` mode, if an edge names a source or target that
 *   is not a node in the same payload; in `'strict'` and `'refs'`
 *   modes, if an edge lacks a source or target
 */
export const buildColumnar = (
  part: PartitionedDefs,
  mode: ColumnarMode,
): ColumnarBulk | null => {
  const { nodes, edges } = part;
  const index = new Map<string, number>();
  const strict = mode === 'strict';

  const nodeIds = new Array<string | undefined>(nodes.length);
  const nodesOut: ColumnarNodes = {
    count: nodes.length,
    ids: nodeIds,
    positions: new Float32Array(nodes.length * 2),
  };
  let sawPosition = false;

  for (let i = 0; i < nodes.length; i++) {
    const def = nodes[i];
    const rawId = def.data?.id;
    const id = rawId != null ? String(rawId) : undefined;

    nodeIds[i] = id;

    if (id != null) {
      index.set(id, i);
    }

    const pos = def.position;

    if (pos != null) {
      sawPosition = true;
      nodesOut.positions![i * 2] = pos.x;
      nodesOut.positions![i * 2 + 1] = pos.y;
    }
  }

  // a payload with no positions at all stays positionless (the spec's
  // "omitted = all (0,0)") — round 112: fabricating the column made a
  // positionless definition graph round-trip through the wire as a
  // positioned one, which flipped the debug harness's
  // lay-out-at-load rule off for real fixtures
  if (!sawPosition) {
    delete nodesOut.positions;
  }

  const nodeFlags = applySelectionColumns(nodesOut, nodes, false);

  // round 103: the names the payload does not hold, in first-seen order,
  // indexed past its own nodes ('refs' mode only)
  const refs: string[] = [];
  const refIndex = new Map<string, number>();
  const refAt = (id: string): number => {
    let at = refIndex.get(id);

    if (at == null) {
      at = nodes.length + refs.length;
      refs.push(id);
      refIndex.set(id, at);
    }

    return at;
  };

  // def parents lift into the parent column (round 14.8): payload
  // indices, sentinel = orphan; an unknown in-payload parent warns and
  // orphans (the def-ingest rule — payloads are self-contained), or —
  // 'refs' mode — becomes a reference the ingest resolves, and warns
  // and orphans there if the graph does not hold it either
  let parents: Uint32Array | undefined;

  for (let i = 0; i < nodes.length; i++) {
    const rawParent = nodes[i].data?.parent;

    if (rawParent == null) {
      continue;
    }

    let at = index.get(String(rawParent));

    if (at == null && mode === 'refs') {
      at = refAt(String(rawParent));
    }

    if (at == null) {
      console.warn(
        `Node '${nodeIds[i] ?? '?'}' has nonexistant parent '${String(rawParent)}'; added as an orphan`,
      );

      continue;
    }

    parents ??= new Uint32Array(nodes.length).fill(NO_PARENT);
    parents[i] = at;
  }

  if (parents != null) {
    nodesOut.parent = parents;
  }

  const nodeData = collectDataColumns(nodes, true);

  if (nodeData != null) {
    nodesOut.data = nodeData;
  }

  const edgeIds = new Array<string | undefined>(edges.length);
  const edgesOut: ColumnarEdges = {
    count: edges.length,
    ids: edgeIds,
    sources: new Uint32Array(edges.length),
    targets: new Uint32Array(edges.length),
  };

  /** The payload index of an endpoint, or -1 when it does not resolve. */
  const endpoint = (
    edgeId: string | undefined,
    which: EndKey,
    raw: unknown,
  ): number => {
    if (raw == null) {
      if (mode === 'bulk') {
        return -1;
      }

      throw new Error(
        `Can not create edge '${edgeId ?? '?'}' without a source and target`,
      );
    }

    const at = index.get(String(raw));

    if (at == null) {
      if (mode === 'refs') {
        return refAt(String(raw));
      }

      if (!strict) {
        return -1;
      }

      throw new Error(
        `The ${which} '${String(raw)}' of edge '${edgeId ?? '?'}' is not a node in this payload ` +
          `(columnar payloads are self-contained; convert with { refs: true } to reference nodes already in the graph)`,
      );
    }

    return at;
  };

  for (let i = 0; i < edges.length; i++) {
    const def = edges[i];
    const data = def.data ?? {};
    const id = data.id != null ? String(data.id) : undefined;
    const source = endpoint(id, DATA_SOURCE, data.source);
    const target = endpoint(id, DATA_TARGET, data.target);

    if (source < 0 || target < 0) {
      // 'bulk' only: not a self-contained payload, so not this route's
      // to load — the caller's fallback reports why
      return null;
    }

    edgeIds[i] = id;
    edgesOut.sources[i] = source;
    edgesOut.targets[i] = target;
  }

  const edgeFlags = applySelectionColumns(edgesOut, edges, true);

  const edgeData = collectDataColumns(edges);

  if (edgeData != null) {
    edgesOut.data = edgeData;
  }

  const elements: ColumnarElements = {
    columnar: true,
    nodes: nodesOut,
    edges: edgesOut,
  };

  if (refs.length > 0) {
    elements.refs = refs;
  }

  return { elements, nodeFlags, edgeFlags };
};

/**
 * How many node references a columnar payload carries (round 103).
 *
 * @param elements — a columnar payload
 * @returns the length of its `refs`, in either id form; 0 when absent
 */
export const refCount = (elements: ColumnarElements): number => {
  const refs = elements.refs;

  if (refs == null) {
    return 0;
  }

  return isPackedIds(refs) ? Math.max(0, refs.offsets.length - 1) : refs.length;
};

/**
 * Sidecar data() keys → sparse index-aligned columns (id/source/target
 * stay first-class; a node's parent is hierarchy, never sidecar).  Shared
 * with `cy.patch()`'s definition-form converter (round 107), so a key
 * the load path keeps is exactly a key the reconcile compares.
 *
 * @param defs — one group's definitions
 * @param skipParent — true for nodes, whose `parent` is hierarchy
 * @returns the columns by key, or undefined when no def carries data
 */
export const collectDataColumns = (
  defs: ElementDefinition[],
  skipParent: boolean = false,
): Record<string, unknown[]> | undefined => {
  let cols: Record<string, unknown[]> | undefined;

  for (let i = 0; i < defs.length; i++) {
    const data = defs[i].data;

    if (data == null) {
      continue;
    }

    for (const key of Object.keys(data)) {
      if (
        key === DATA_ID ||
        key === DATA_SOURCE ||
        key === DATA_TARGET ||
        data[key] === undefined
      ) {
        continue;
      }
      if (skipParent && key === DATA_PARENT) {
        continue;
      }

      ((cols ??= {})[key] ??= new Array(defs.length))[i] = data[key];
    }
  }

  return cols;
};

/**
 * Build selected/selectable arrays only when some def deviates from the
 * defaults, and collect the deviations no column can carry.
 *
 * The `locked`/`grabbable`/`pannable` scan rides this walk rather than
 * taking one of its own: the decision has to be made over every def, and
 * this loop is already reading a property off each of them.
 *
 * @param out — the columnar group being built
 * @param defs — that group's defs, index-aligned with `out`
 * @param isEdge — edges default to pannable, nodes do not (v3's rule)
 * @returns the defs whose uncarryable flags the caller must write itself
 */
export const applySelectionColumns = (
  out: { count: number; selected?: Uint8Array; selectable?: Uint8Array },
  defs: ElementDefinition[],
  isEdge: boolean,
): FlagOverride[] => {
  const overrides: FlagOverride[] = [];

  for (let i = 0; i < defs.length; i++) {
    const def = defs[i];

    if (def.selected === true) {
      out.selected ??= new Uint8Array(out.count);
      out.selected[i] = 1;
    }

    if (def.selectable === false) {
      out.selectable ??= new Uint8Array(out.count).fill(1);
      out.selectable[i] = 0;
    }

    if (
      def.locked === true ||
      def.grabbable === false ||
      (def.pannable != null && def.pannable !== isEdge)
    ) {
      overrides.push({ at: i, def });
    }
  }

  return overrides;
};
