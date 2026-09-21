// GraphStore's compound hierarchy (round 130 split): parent geometry,
// reparenting, visibility and the effective-opacity folds.

import { EDGE_DIST_NODE_POSITION } from '../../curve-geometry.mjs';
import { assignTaxiTracks } from '../../taxi-tracks.mjs';
import type { TrackEdge } from '../../taxi-tracks.mjs';
import {
  GROUP_EDGES,
  GROUP_NODES,
  COL,
  EDGE_STYLE_COLUMNS,
  CURVE_CMPD,
  FLAG_ALIVE,
  FLAG_LOCKED,
  FLAG_DRAWN,
  FLAG_PARENT,
  FLAG_SELF_HIDDEN,
  FLAG_SELF_INVISIBLE,
  FLAG_VISIBLE,
  LABEL_MARGIN,
} from '../../contract.mjs';
import type { ColumnId, GroupName, Ref } from '../../contract.mjs';
import type { GraphStore } from '../graph-store.mjs';
import { updateOuterHalf } from './channels.mjs';

/**
 * The taxi-track pass (round 124): assign every `taxi-turn: auto`
 * edge its px turn from live positions, into the params header's n
 * lane, which both `evalTaxi` and the WGSL twin read for a taxi
 * record whose turn mode is 2.  Lazy off the geo epoch — a drag fires
 * many pointermoves per frame and a layout writes positions in
 * several passes, so the sweep runs once per epoch, at frame start
 * (`takeDelta`) and on the CPU readers (`flushDerived`), and is a
 * single size check when no edge is `auto`.  It writes a column,
 * never the blob, and never bumps the epoch it is keyed on.
 */
export function refreshTaxiTracks(gs: GraphStore): void {
  const slots = gs.curves.taxiAutoSlots();

  if (slots.size === 0 || gs.taxiTrackEpoch === gs.geoEpoch) {
    return;
  }

  gs.taxiTrackEpoch = gs.geoEpoch;

  const endpoints = gs.edges.column(COL.EDGE_ENDPOINTS) as Uint32Array;
  const pos = gs.nodes.column(COL.NODE_POSITION) as Float32Array;
  const half = gs.nodes.column(COL.NODE_OUTER_HALF) as Float32Array;
  const nodeFlags = gs.nodes.column(COL.NODE_FLAGS) as Uint32Array;
  const params = gs.edges.column(COL.EDGE_CURVE_PARAMS) as Float32Array;
  const edges: TrackEdge[] = [];
  const edgeSlots: number[] = [];

  for (const slot of slots) {
    const ex = gs.curves.styleAt(slot).extras;

    if (ex == null) {
      continue;
    }

    edges.push({
      src: endpoints[slot * 2],
      tgt: endpoints[slot * 2 + 1],
      dir: ex.taxiDir,
      minDist: ex.taxiTurnMinDist,
      body: ex.edgeDistances !== EDGE_DIST_NODE_POSITION,
      group: ex.taxiTrack,
      spacing: ex.taxiTrackSpacing,
    });
    edgeSlots.push(slot);
  }

  // a run avoids the shown leaf bodies; parents are boxes around
  // their children, not obstacles
  const obstacles: number[] = [];
  const shownLeaf = FLAG_ALIVE | FLAG_VISIBLE;

  for (let n = 0; n < gs.nodes.highWater; n++) {
    const f = nodeFlags[n];

    if ((f & shownLeaf) === shownLeaf && (f & FLAG_PARENT) === 0) {
      obstacles.push(n);
    }
  }

  const { turn } = assignTaxiTracks({ edges, pos, half, obstacles });
  let min = Infinity;
  let max = -1;

  for (let i = 0; i < edgeSlots.length; i++) {
    const slot = edgeSlots[i];
    const at = slot * 4 + 2;

    if (params[at] !== turn[i]) {
      params[at] = turn[i];
      min = Math.min(min, slot);
      max = Math.max(max, slot);
    }
  }

  if (max >= 0) {
    gs.dirty.mark(COL.EDGE_CURVE_PARAMS, min, max + 1);
  }
}

/**
 * Copy every style-owned edge column from the run's first slot across
 * the rest of it (round 67.2), and mark each column's span once.
 *
 * The run must be contiguous and ascending — the caller checks, and a
 * bulk load's slots are exactly that.  Filling proceeds by doubling
 * (`copyWithin` over an ever-larger prefix), so a 464,657-slot run is
 * ~19 MB of `memmove` rather than 464,657 × 17 setter calls: measured
 * 0.1 ns per element against 26 ns for one `setScalar`, whose cost is
 * mostly the two string-keyed lookups behind `column( id )`.
 *
 * Safety rests entirely on {@link EDGE_PER_ELEMENT_COLUMNS} being the
 * complete list of edge columns a shared styled record does *not*
 * determine; a spec pins the two lists against `COLUMN_SPECS`.
 *
 * @param start — the run's first slot, which is also the template
 * @param count — how many slots the run covers, template included
 */
export function replicateEdgeStyle(
  gs: GraphStore,
  start: number,
  count: number,
): void {
  if (count < 2) {
    return;
  }

  for (const spec of EDGE_STYLE_COLUMNS) {
    const arr = gs.edges.column(spec.id);
    const c = spec.components;

    // doubling fill: [start, start+done) is already the pattern, so
    // copy it onto itself until the run is covered
    let done = 1;

    while (done < count) {
      const n = Math.min(done, count - done);

      arr.copyWithin((start + done) * c, start * c, (start + n) * c);
      done += n;
    }

    gs.dirty.mark(spec.id, start, start + count);
  }

  gs.geoEpoch++;
}

/**
 * The hierarchy flush's write sink: derived parent geometry lands in
 * the real columns (position, size, outerHalf) with normal dirty
 * spans — but never re-marks the hierarchy, so a flush can not
 * re-trigger itself.  A size change re-anchors the parent's label
 * (the sidecar entry bakes anchors from the node extents) and feeds
 * the monotone cull-slack meter.
 */
export function materializeParentGeom(
  gs: GraphStore,
  slot: number,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const pos = gs.nodes.column(COL.NODE_POSITION) as Float32Array;
  const size = gs.nodes.column(COL.NODE_SIZE) as Float32Array;
  const posChanged = pos[slot * 2] !== x || pos[slot * 2 + 1] !== y;
  const sizeChanged = size[slot * 2] !== w || size[slot * 2 + 1] !== h;

  if (!posChanged && !sizeChanged) {
    return;
  }

  if (posChanged) {
    pos[slot * 2] = x;
    pos[slot * 2 + 1] = y;
    gs.dirty.mark(COL.NODE_POSITION, slot);
  }

  if (sizeChanged) {
    size[slot * 2] = w;
    size[slot * 2 + 1] = h;
    gs.dirty.mark(COL.NODE_SIZE, slot);

    const half = Math.max(w, h) / 2;

    if (half > gs.nodeHalfMax) {
      gs.nodeHalfMax = half;
    }

    updateOuterHalf(gs, slot);
    reanchorLabel(gs, slot, w, h);

    // compound-loop excursion bounds are derivation-time (14.10):
    // refresh them for the resized parent's incident edges (the
    // geometry itself always evaluates from live sizes)
    const endpoints = gs.edges.column(COL.EDGE_ENDPOINTS) as Uint32Array;

    for (const edgeSlot of gs.adj.connectedEdges(slot)) {
      const a = endpoints[edgeSlot * 2];
      const b = endpoints[edgeSlot * 2 + 1];

      if (
        (gs.edges.column(COL.EDGE_CURVE_PARAMS) as Float32Array)[
          edgeSlot * 4 + 3
        ] === CURVE_CMPD
      ) {
        gs.curves.invalidateRelation(a, b);
      }
    }
  }

  gs.geoEpoch++;
}

/**
 * Re-derive a node label's anchor from new drawn extents.  The sidecar
 * entry carries enough to invert the StyleEngine's bake: halign/valign
 * reconstruct from the block-fraction shifts, and the anchor formulas
 * are the engine's own (see writeLabel) — no engine round trip needed.
 */
export function reanchorLabel(
  gs: GraphStore,
  slot: number,
  w: number,
  h: number,
): void {
  const entry = gs.labels.nodes[slot];

  if (entry == null) {
    return;
  }

  const halign = entry.halignShift * 2 + 1;
  const valign = entry.valignShift * 2 + 2;
  const anchorX = ((halign - 1) * w) / 2;
  const anchorY =
    (valign === 0
      ? -h / 2 - LABEL_MARGIN
      : valign === 2
        ? h / 2 + LABEL_MARGIN
        : 0) + entry.marginY;

  if (anchorX !== entry.anchorX || anchorY !== entry.anchorY) {
    gs.setLabel(slot, { ...entry, anchorX, anchorY }, GROUP_NODES);
  }
}

/**
 * Shift a parent's subtree by a delta (raw writes, one span).  A
 * locked descendant stays, and so does its own subtree (116.3 — v3's
 * rule: a parent write shifts `children()` through the locked-aware
 * shift, so a locked child's `shift` is refused and its children are
 * never reached).  Every ancestor of a node left behind re-derives —
 * their boxes now span the stayers and the movers, so a uniform
 * translation of the written position no longer describes them.
 */
export function shiftSubtree(
  gs: GraphStore,
  slot: number,
  dx: number,
  dy: number,
): void {
  const pos = gs.nodes.column(COL.NODE_POSITION) as Float32Array;
  const flags = gs.nodes.column(COL.NODE_FLAGS) as Uint32Array;
  const stack: number[] = [];
  let min = Infinity;
  let max = -1;

  for (const kid of gs.hierarchy.childrenOf(slot)) {
    stack.push(kid);
  }

  while (stack.length > 0) {
    const s = stack.pop() as number;

    if ((flags[s] & FLAG_LOCKED) !== 0) {
      gs.hierarchy.markAncestors(s);
      continue;
    }

    pos[s * 2] += dx;
    pos[s * 2 + 1] += dy;

    if (s < min) {
      min = s;
    }
    if (s > max) {
      max = s;
    }

    for (const kid of gs.hierarchy.childrenOf(s)) {
      stack.push(kid);
    }
  }

  if (max >= 0) {
    gs.geoEpoch++;
    gs.dirty.mark(COL.NODE_POSITION, min, max + 1);
  }
}

/**
 * Link a node under a parent node slot (-1 to orphan).  Cycle-safe:
 * a link that would make the node its own ancestor warns and no-ops
 * (v3's dropped-ref rule).  Maintains FLAG_PARENT/FLAG_CHILD, depths
 * and the parent draw permutation.
 */
export function setParent(
  gs: GraphStore,
  slot: number,
  parentSlot: number,
): void {
  const before = gs.hierarchy.parentOf(slot);

  gs.hierarchy.setParent(slot, parentSlot);

  if (gs.hierarchy.parentOf(slot) === before) {
    return;
  } // no-op or cycle drop

  // the moved subtree's ancestor-derived state re-resolves against the
  // new chain (round 14.4): effective visibility and the opacity fold
  refreshEffectiveVisibility(gs, slot);
  refoldOpacitySubtree(gs, slot);

  // structural case conditions on the moved node re-evaluate (14.7)
  gs.onReparented?.(slot);

  // compound-loop routing (14.10): the moved subtree's incident edges
  // may have entered or left an ancestor/descendant relation
  invalidateSubtreeEdgeRelations(gs, slot);
}

/** Re-derive curve routing for every edge incident to a subtree (14.10). */
export function invalidateSubtreeEdgeRelations(
  gs: GraphStore,
  root: number,
): void {
  const endpoints = gs.edges.column(COL.EDGE_ENDPOINTS) as Uint32Array;
  const stack: number[] = [root];

  while (stack.length > 0) {
    const slot = stack.pop() as number;

    for (const edgeSlot of gs.adj.connectedEdges(slot)) {
      gs.curves.invalidateRelation(
        endpoints[edgeSlot * 2],
        endpoints[edgeSlot * 2 + 1],
      );
    }

    for (const kid of gs.hierarchy.childrenOf(slot)) {
      stack.push(kid);
    }
  }
}

/**
 * show()/hide() (round 14.4): FLAG_SELF_HIDDEN records the element's
 * own state; the effective FLAG_VISIBLE recomputes over affected node
 * subtrees (pruned — an unchanged effective bit means an unchanged
 * subtree).  Hidden children leave their ancestors' auto-bounds.
 * Returns the refs-array indices whose own state changed.
 */
export function setVisibility(
  gs: GraphStore,
  refs: readonly Ref[],
  visible: boolean,
  changedIdx: number[] | null = null,
): number {
  const changed: number[] = changedIdx ?? [];
  const n = gs.flagRefs(refs, FLAG_SELF_HIDDEN, !visible, 0, changed);

  for (const i of changed) {
    const ref = refs[i];

    if (ref.group === GROUP_EDGES) {
      // edges have no ancestors: effective = own state; DRAWN also
      // folds the visibility prop (round 22)
      gs.setFlag(GROUP_EDGES, ref.slot, FLAG_VISIBLE, visible);
      refreshEdgeDrawn(gs, ref.slot);
      // display-tier semantics (22.3): a hidden bezier-bundle member
      // leaves its bundle — siblings re-fan
      gs.curves.onEdgeShownChanged(ref.slot);
    } else {
      refreshEffectiveVisibility(gs, ref.slot);
    }
  }

  return n;
}

/**
 * The `visibility` style prop (round 22): paint-only invisibility.
 * Sets the element's own FLAG_SELF_INVISIBLE and re-derives FLAG_DRAWN
 * (over the subtree for nodes — descendants of an invisible parent are
 * invisible, v3's rule).  Deliberately touches nothing else: space
 * consumers (bb, auto-bounds) and the curve bundles read FLAG_VISIBLE,
 * so an invisible element keeps its space and its bundle rank.
 */
export function setInvisibility(
  gs: GraphStore,
  group: GroupName,
  slot: number,
  invisible: boolean,
): void {
  const id: ColumnId = group === GROUP_NODES ? COL.NODE_FLAGS : COL.EDGE_FLAGS;
  const flags = gs.table(group).column(id) as Uint32Array;
  const cur = (flags[slot] & FLAG_SELF_INVISIBLE) !== 0;

  if (cur === invisible) {
    return;
  }

  gs.setFlag(group, slot, FLAG_SELF_INVISIBLE, invisible);

  if (group === GROUP_EDGES) {
    refreshEdgeDrawn(gs, slot);
  } else {
    refreshEffectiveVisibility(gs, slot);
  }
}

/** Re-derive an edge's FLAG_DRAWN from its shown + invisible state.
 * (Endpoint invisibility is folded by the consumers — the kernels'
 * endpoint tests and the edge `visible()` read — not stored here.) */
export function refreshEdgeDrawn(gs: GraphStore, slot: number): void {
  const flags = gs.edges.column(COL.EDGE_FLAGS) as Uint32Array;
  const drawn =
    (flags[slot] & FLAG_VISIBLE) !== 0 &&
    (flags[slot] & FLAG_SELF_INVISIBLE) === 0;

  gs.setFlag(GROUP_EDGES, slot, FLAG_DRAWN, drawn);
}

/** Whether the element renders (round 22): the derived FLAG_DRAWN, with
 * edges additionally folding their endpoints (v3's visible() rule). */
export function isDrawn(gs: GraphStore, ref: Ref): boolean {
  if (ref.group === GROUP_NODES) {
    return gs.hasFlag(GROUP_NODES, ref.slot, FLAG_DRAWN);
  }

  if (!gs.hasFlag(GROUP_EDGES, ref.slot, FLAG_DRAWN)) {
    return false;
  }

  const endpoints = gs.edges.column(COL.EDGE_ENDPOINTS) as Uint32Array;
  const nodeFlags = gs.nodes.column(COL.NODE_FLAGS) as Uint32Array;
  const drawnMask = FLAG_ALIVE | FLAG_DRAWN;

  return (
    (nodeFlags[endpoints[ref.slot * 2]] & drawnMask) === drawnMask &&
    (nodeFlags[endpoints[ref.slot * 2 + 1]] & drawnMask) === drawnMask
  );
}

/**
 * Recompute effective FLAG_VISIBLE — and, round 22, the derived
 * FLAG_DRAWN (visible AND no `visibility: 'hidden'` on self or any
 * ancestor) — for a node subtree, top-down with pruning: a node with
 * both bits unchanged has consistent descendants (their inputs did not
 * move).  A shown-bit change marks the ancestor chain's auto-bounds
 * stale (it entered or left the bb); a drawn-only change is paint-only
 * (invisible elements keep their space).
 */
export function refreshEffectiveVisibility(gs: GraphStore, root: number): void {
  const flags = gs.nodes.column(COL.NODE_FLAGS) as Uint32Array;
  const stack: number[] = [root];

  while (stack.length > 0) {
    const slot = stack.pop() as number;
    const p = gs.hierarchy.parentOf(slot);
    const parentEff = p < 0 || (flags[p] & FLAG_VISIBLE) !== 0;
    const parentDrawn = p < 0 || (flags[p] & FLAG_DRAWN) !== 0;
    const eff =
      parentEff &&
      (flags[slot] & FLAG_SELF_HIDDEN) === 0 &&
      (flags[slot] & FLAG_ALIVE) !== 0;
    const drawn =
      eff && parentDrawn && (flags[slot] & FLAG_SELF_INVISIBLE) === 0;
    const cur = (flags[slot] & FLAG_VISIBLE) !== 0;
    const curDrawn = (flags[slot] & FLAG_DRAWN) !== 0;

    if (eff === cur && drawn === curDrawn) {
      continue;
    }

    flags[slot] = eff
      ? flags[slot] | FLAG_VISIBLE
      : flags[slot] & ~FLAG_VISIBLE;
    flags[slot] = drawn ? flags[slot] | FLAG_DRAWN : flags[slot] & ~FLAG_DRAWN;
    gs.dirty.mark(COL.NODE_FLAGS, slot);

    if (eff !== cur) {
      // the space tier moved: bounds re-derive
      gs.geoEpoch++;
      gs.hierarchy.markGeo(slot);
    }

    for (const kid of gs.hierarchy.childrenOf(slot)) {
      stack.push(kid);
    }
  }
}

/** The product of the strict ancestors' bases. */
export function ancestorOpacityProduct(gs: GraphStore, slot: number): number {
  let product = 1;

  for (
    let p = gs.hierarchy.parentOf(slot);
    p >= 0;
    p = gs.hierarchy.parentOf(p)
  ) {
    product *= gs.baseOpacityOf(p);
  }

  return product;
}

/**
 * A node opacity write under compounds: `base` is the declared value;
 * the stored column takes base x the ancestor product (v3's rendered
 * effectiveOpacity), and a parent's write refolds its subtree.
 */
export function writeBaseOpacity(
  gs: GraphStore,
  slot: number,
  base: number,
): void {
  const col = gs.nodes.column(COL.NODE_OPACITY) as Float32Array;
  const product = ancestorOpacityProduct(gs, slot);
  const folded = base * product;

  if (product !== 1) {
    gs.opacityBase.set(slot, base);
  } else {
    gs.opacityBase.delete(slot);
  }

  if (col[slot] !== folded) {
    col[slot] = folded;
    gs.dirty.mark(COL.NODE_OPACITY, slot);
  }

  if (gs.hierarchy.childrenOf(slot).length > 0) {
    refoldChildren(gs, slot, base * product);
  }
}

/** Refold a whole subtree against its (possibly new) ancestor chain. */
export function refoldOpacitySubtree(gs: GraphStore, slot: number): void {
  writeBaseOpacity(gs, slot, gs.baseOpacityOf(slot));
}

/** Recursive half of the fold: children of a node whose folded value is `parentFolded`. */
export function refoldChildren(
  gs: GraphStore,
  slot: number,
  parentFolded: number,
): void {
  const col = gs.nodes.column(COL.NODE_OPACITY) as Float32Array;

  for (const kid of gs.hierarchy.childrenOf(slot)) {
    const base = gs.baseOpacityOf(kid);
    const folded = base * parentFolded;

    if (parentFolded !== 1) {
      gs.opacityBase.set(kid, base);
    } else {
      gs.opacityBase.delete(kid);
    }

    if (col[kid] !== folded) {
      col[kid] = folded;
      gs.dirty.mark(COL.NODE_OPACITY, kid);
    }

    refoldChildren(gs, kid, folded);
  }
}
