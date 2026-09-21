// Core's `serialize()` and `json()` (round 130 split).

import { serializeElements } from '../wire.mjs';
import {
  GROUP_EDGES,
  GROUP_NODES,
  COL,
  FLAG_SELECTABLE,
  FLAG_SELECTED,
} from '../contract.mjs';
import { NO_PARENT } from '../public-types.mjs';
import type { Position } from '../public-types.mjs';
import type { Core } from '../core.mjs';

/**
 * Export the live graph as the binary wire format (the buffer
 * `options.elements`/`add()` accept directly): the columnar counterpart
 * of `json()`.  Carries ids, positions, selection state, the data()
 * sidecar and — since round 39.2 — graph-level `data()`; style,
 * viewport and scratch are not part of the wire.
 *
 * Note the asymmetry in *loading* that graph data back: `options.
 * elements` applies it, `cy.add( buffer )` ignores it.  Adding elements
 * to a populated graph must not overwrite that graph's own `data()`,
 * and there is no third answer that is right in both places.
 *
 * @returns a fresh little-endian buffer, self-contained (every edge
 *   endpoint indexes a node in the same payload) and directly loadable —
 *   derived geometry is flushed first, so parent boxes are the current
 *   ones rather than whatever was last materialized
 */
export function serialize(core: Core): ArrayBuffer {
  const store = core._store;

  store.flushDerived(); // parent positions are derived (round 14.8)

  const nodeSlots = store.slotsOrdered(GROUP_NODES);
  const edgeSlots = store.slotsOrdered(GROUP_EDGES);
  const pos = store.column(COL.NODE_POSITION) as Float32Array;
  const nodeFlags = store.column(COL.NODE_FLAGS) as Uint32Array;
  const edgeFlags = store.column(COL.EDGE_FLAGS) as Uint32Array;
  const endpoints = store.column(COL.EDGE_ENDPOINTS) as Uint32Array;

  const nodeIds: string[] = new Array(nodeSlots.length);
  const positions = new Float32Array(nodeSlots.length * 2);
  const nodeSelected = new Uint8Array(nodeSlots.length);
  const nodeSelectable = new Uint8Array(nodeSlots.length);
  const indexOfSlot = new Map<number, number>();

  for (let i = 0; i < nodeSlots.length; i++) {
    const slot = nodeSlots[i];

    indexOfSlot.set(slot, i);
    nodeIds[i] = store.idAt(GROUP_NODES, slot) as string;
    positions[i * 2] = pos[slot * 2];
    positions[i * 2 + 1] = pos[slot * 2 + 1];
    nodeSelected[i] = (nodeFlags[slot] & FLAG_SELECTED) !== 0 ? 1 : 0;
    nodeSelectable[i] = (nodeFlags[slot] & FLAG_SELECTABLE) !== 0 ? 1 : 0;
  }

  // hierarchy (round 14.8): parent slots -> payload indices (a second
  // pass — a parent may sit later in slot order than its children)
  let nodeParents: Uint32Array | undefined;

  if (store.hasCompounds()) {
    nodeParents = new Uint32Array(nodeSlots.length).fill(NO_PARENT);

    for (let i = 0; i < nodeSlots.length; i++) {
      const parentSlot = store.parentOf(nodeSlots[i]);

      if (parentSlot >= 0) {
        nodeParents[i] = indexOfSlot.get(parentSlot) as number;
      }
    }
  }

  const edgeIds: string[] = new Array(edgeSlots.length);
  const sources = new Uint32Array(edgeSlots.length);
  const targets = new Uint32Array(edgeSlots.length);
  const edgeSelected = new Uint8Array(edgeSlots.length);
  const edgeSelectable = new Uint8Array(edgeSlots.length);

  for (let i = 0; i < edgeSlots.length; i++) {
    const slot = edgeSlots[i];

    edgeIds[i] = store.idAt(GROUP_EDGES, slot) as string;
    sources[i] = indexOfSlot.get(endpoints[slot * 2]) as number;
    targets[i] = indexOfSlot.get(endpoints[slot * 2 + 1]) as number;
    edgeSelected[i] = (edgeFlags[slot] & FLAG_SELECTED) !== 0 ? 1 : 0;
    edgeSelectable[i] = (edgeFlags[slot] & FLAG_SELECTABLE) !== 0 ? 1 : 0;
  }

  return serializeElements({
    columnar: true,
    nodes: {
      count: nodeSlots.length,
      ids: nodeIds,
      positions,
      selected: nodeSelected,
      selectable: nodeSelectable,
      ...(nodeParents != null ? { parent: nodeParents } : {}),
      data: store.data.exportColumns(GROUP_NODES, nodeSlots),
    },
    edges: {
      count: edgeSlots.length,
      ids: edgeIds,
      sources,
      targets,
      selected: edgeSelected,
      selectable: edgeSelectable,
      data: store.data.exportColumns(GROUP_EDGES, edgeSlots),
    },
    // graph-level data (round 39.2), copied rather than held by
    // reference: the buffer is a snapshot, and a later cy.data() write
    // must not reach back into a payload the caller may still be
    // serializing
    ...(Object.keys(core._graphData).length > 0
      ? { data: { ...core._graphData } }
      : {}),
  });
}

/**
 * Export the graph as a plain object — elements, stylesheet, viewport,
 * gating flags and graph-level data.
 *
 * Export-only: the v3 import/restore form (`json( obj )`) is not
 * supported, because rebuilding from a snapshot needs the stored
 * element definitions that the columnar model deliberately does not
 * keep.  Use `serialize()` for the compact binary counterpart, which
 * *can* be fed back in.
 *
 * @param flat — when true, elements export as one flat array instead of
 *   `{ nodes, edges }` (v3's option)
 * @returns the exported graph
 * @throws if given anything but a boolean — the guard that catches an
 *   attempted `json( obj )` import
 */
export function json(core: Core, flat?: boolean): Record<string, unknown> {
  if (flat != null && typeof flat !== 'boolean') {
    throw new Error(
      'cy.json() is export-only in the GPU prototype; the import/restore form is not supported',
    );
  }

  const elements =
    flat === true
      ? core.elements().jsons()
      : { nodes: core.nodes().jsons(), edges: core.edges().jsons() };

  return {
    elements,
    style: core._styleEngine.json(),
    data: { ...core._graphData },
    zoom: core._viewport.zoom(),
    pan: { ...(core._viewport.pan() as Position) },
    minZoom: core._viewport.minZoom,
    maxZoom: core._viewport.maxZoom,
    zoomingEnabled: core._zoomingEnabled,
    userZoomingEnabled: core._userZoomingEnabled,
    panningEnabled: core._panningEnabled,
    userPanningEnabled: core._userPanningEnabled,
    boxSelectionEnabled: core._boxSelectionEnabled,
    selectionType: core._selectionType,
    autolock: core._autolock,
    autoungrabify: core._autoungrabify,
    autounselectify: core._autounselectify,
    headless: core.headless(),
    styleEnabled: core.styleEnabled(),
  };
}
