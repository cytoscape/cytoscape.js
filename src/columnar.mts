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

/*
Definition-form (v3-style JSON) → columnar bulk-load form.  The columnar
form is what the loader ingests fastest — typed-array columns, edge
endpoints as node indices — and this converter is the compat path for
callers holding classic elements JSON.  Payloads are self-contained:
every edge endpoint must name a node in the same payload.
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
 * @returns the equivalent self-contained columnar payload
 * @throws if an edge names a source or target that is not a node in the
 *   same payload — columnar payloads must be self-contained
 */
export const toColumnarElements = (
  defs: ElementsDefinition | ElementDefinition,
): ColumnarElements => {
  return buildColumnar(partitionDefs(defs), true)!.elements;
};

/**
 * The conversion itself, over defs already partitioned by group.
 *
 * Two callers with two different needs, hence the mode.  The public
 * converter above is `strict` and throws on an endpoint it cannot
 * resolve; the core's bulk load path is not, because an unresolvable
 * endpoint there simply means the payload is not a candidate for this
 * route (it may reference nodes already in the graph, or be malformed) —
 * it answers `null` and the caller falls back to the definition path,
 * which is then the one that raises the error, with its own message.
 *
 * @param part — defs already split into nodes and edges
 * @param strict — throw on an unresolvable endpoint rather than
 *   answering null
 * @returns the payload and its flag deviations, or null when an edge
 *   endpoint does not name a node in the same payload (non-strict only)
 * @throws in strict mode, if an edge names a source or target that is
 *   not a node in the same payload
 */
export const buildColumnar = (
  part: PartitionedDefs,
  strict: boolean,
): ColumnarBulk | null => {
  const { nodes, edges } = part;
  const index = new Map<string, number>();

  const nodeIds = new Array<string | undefined>(nodes.length);
  const nodesOut: ColumnarNodes = {
    count: nodes.length,
    ids: nodeIds,
    positions: new Float32Array(nodes.length * 2),
  };

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
      nodesOut.positions![i * 2] = pos.x;
      nodesOut.positions![i * 2 + 1] = pos.y;
    }
  }

  const nodeFlags = applySelectionColumns(nodesOut, nodes, false);

  // def parents lift into the parent column (round 14.8): payload
  // indices, sentinel = orphan; an unknown in-payload parent warns and
  // orphans (the def-ingest rule — payloads are self-contained)
  let parents: Uint32Array | undefined;

  for (let i = 0; i < nodes.length; i++) {
    const rawParent = nodes[i].data?.parent;

    if (rawParent == null) {
      continue;
    }

    const at = index.get(String(rawParent));

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
    which: 'source' | 'target',
    raw: unknown,
  ): number => {
    if (raw == null) {
      if (!strict) {
        return -1;
      }

      throw new Error(
        `Can not create edge '${edgeId ?? '?'}' without a source and target`,
      );
    }

    const at = index.get(String(raw));

    if (at == null) {
      if (!strict) {
        return -1;
      }

      throw new Error(
        `The ${which} '${String(raw)}' of edge '${edgeId ?? '?'}' is not a node in this payload ` +
          `(columnar payloads are self-contained; use the definition form for cross-references)`,
      );
    }

    return at;
  };

  for (let i = 0; i < edges.length; i++) {
    const def = edges[i];
    const data = def.data ?? {};
    const id = data.id != null ? String(data.id) : undefined;
    const source = endpoint(id, 'source', data.source);
    const target = endpoint(id, 'target', data.target);

    if (source < 0 || target < 0) {
      // non-strict only: not a self-contained payload, so not this
      // route's to load — the caller's fallback reports why
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

  return {
    elements: { columnar: true, nodes: nodesOut, edges: edgesOut },
    nodeFlags,
    edgeFlags,
  };
};

/** Sidecar data() keys → sparse index-aligned columns (id/source/target
 * stay first-class; a node's parent is hierarchy, never sidecar). */
const collectDataColumns = (
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
        key === 'id' ||
        key === 'source' ||
        key === 'target' ||
        data[key] === undefined
      ) {
        continue;
      }
      if (skipParent && key === 'parent') {
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
const applySelectionColumns = (
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
