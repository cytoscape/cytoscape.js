// GraphStore's insertion-order iteration, box scans and bounding box
// (round 130 split).

import {
  CURVE_SEGS,
  curvePointAt,
  headerDeviation,
  routeVertex,
  segmentHitsBox,
} from '../../curve-geometry.mjs';
import type { CurveRoute } from '../../curve-geometry.mjs';
import {
  GROUP_EDGES,
  GROUP_NODES,
  COL,
  CURVE_STRAIGHT,
  FLAG_ALIVE,
  FLAG_CURVED,
  FLAG_CURVED_BOX,
  FLAG_VISIBLE,
} from '../../contract.mjs';
import type { LabelStream, GroupName, Ref } from '../../contract.mjs';
import type { BoxSelectionMode } from '../../public-types.mjs';
import type { GraphStore } from '../graph-store.mjs';

/**
 * Visit every live slot in insertion order, skipping tombstones by
 * generation compare.  A reused slot is visited at its *re-insertion*
 * position, not its original one.  The callback must not add or
 * remove elements in the group being walked.
 */
export function forEachAlive(
  gs: GraphStore,
  group: GroupName,
  cb: (slot: number) => void,
): void {
  const order = gs.order[group];
  const gen = gs.table(group).gen;

  for (let i = 0; i < order.slots.length; i++) {
    const slot = order.slots[i];

    if (gen[slot] === order.gens[i]) {
      cb(slot);
    }
  }
}

/**
 * The slot-only twin of `scanRefsInto` (round 34.2/34.4): the same
 * insertion-order walk with the same `(mask, want)` flag test, writing
 * bare slot numbers instead of allocating a `Ref` each.  Callers that
 * work in slot space — the layout contract's `nodeSlots()`/
 * `edgeSlots()` — used to reach them through element handles, which
 * cost a handle intern per element for information the order list
 * already has.
 *
 * Same order as `scanRefsInto`, which is what keeps layouts placing
 * elements where they placed them before.
 *
 * @param out — destination array, written from `at`
 * @param at — first index to write
 * @param group — which group to scan
 * @param mask — flag bits to test
 * @param want — the value those bits must have
 * @returns the index one past the last slot written
 */
export function scanSlotsInto(
  gs: GraphStore,
  out: number[],
  at: number,
  group: GroupName,
  mask: number,
  want: number,
): number {
  const order = gs.order[group];
  const slots = order.slots;
  const gens = order.gens;
  const gen = gs.table(group).gen;
  const flags = gs.column(
    group === GROUP_NODES ? COL.NODE_FLAGS : COL.EDGE_FLAGS,
  ) as Uint32Array;
  let n = at;

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];

    if (gen[slot] !== gens[i] || (flags[slot] & mask) !== want) {
      continue;
    }

    out[n++] = slot;
  }

  return n;
}

/**
 * Scan one group's flags column, writing a ref into `out` (from index
 * `at`) for every live slot (insertion order) whose flags satisfy
 * (flags & mask) === want.  Returns the index one past the last write —
 * the columnar scan behind the whole-graph materializers and structured
 * queries, callable back to back so `out` covers several groups.  The
 * caller preallocates `out` to the live count (the exact match count for
 * a mask-0 scan, an upper bound otherwise) and trims afterwards.
 */
export function scanRefsInto(
  gs: GraphStore,
  out: Ref[],
  at: number,
  group: GroupName,
  mask: number,
  want: number,
  dataTests?: { test: (v: unknown) => boolean; key: string }[],
): number {
  const order = gs.order[group];
  const slots = order.slots;
  const gens = order.gens;
  const gen = gs.table(group).gen;
  const flags = gs.column(
    group === GROUP_NODES ? COL.NODE_FLAGS : COL.EDGE_FLAGS,
  ) as Uint32Array;
  let n = at;

  // hoist a per-slot reader per condition key out of the scan loop
  const readers =
    dataTests == null || dataTests.length === 0
      ? null
      : dataTests.map((t) => ({
          test: t.test,
          read: gs.data.reader(group, t.key),
        }));

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const g = gens[i];

    if (gen[slot] !== g || (flags[slot] & mask) !== want) {
      continue;
    }

    if (readers != null) {
      let pass = true;

      for (let t = 0; t < readers.length; t++) {
        if (!readers[t].test(readers[t].read(slot))) {
          pass = false;
          break;
        }
      }

      if (!pass) {
        continue;
      }
    }

    out[n++] = { group, slot, gen: g };
  }

  return n;
}

/**
 * Live, visible elements in the model-coordinate box — the
 * box-selection query, answered by one columnar scan.  Corners may be
 * given in any order.
 *
 * **'contain'** (the default, v3's): a node counts when its bounding
 * box (position ± size/2 ± border/2) lies fully inside the box; an edge
 * counts when both of its endpoints do.  Since 12b, curved edges test
 * their *curve* boundary endpoints (exactly v3's on-boundary rule — the
 * revisit deferred from 12a); straight edges keep the endpoint-center
 * approximation (a recorded deviation).  `includeLabels` **narrows**
 * this: the node's label box must be contained too.
 *
 * **'overlap'** (round 39.1): a node counts when its bounding box
 * *intersects* the box; an edge counts when any part of its drawn path
 * does — either endpoint inside, or a flattened segment crossing, by
 * the Liang-Barsky clip the cull pass runs per frame (`segmentHitsBox`
 * is its CPU twin).  `includeLabels` **widens** this instead: a node
 * whose body misses but whose label box overlaps counts.  The
 * asymmetry is v3's and is the only thing either mode can mean —
 * containment is an AND over parts, overlap an OR.
 */
export function refsInBox(
  gs: GraphStore,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  includeLabels: boolean = false,
  mode: BoxSelectionMode = 'contain',
): Ref[] {
  gs.flushDerived(); // curved edges read derived params below
  const overlap = mode === 'overlap';
  const lx = Math.min(x1, x2);
  const hx = Math.max(x1, x2);
  const ly = Math.min(y1, y2);
  const hy = Math.max(y1, y2);
  const shown = FLAG_ALIVE | FLAG_VISIBLE;
  const out: Ref[] = [];

  const pos = gs.column(COL.NODE_POSITION) as Float32Array;
  const size = gs.column(COL.NODE_SIZE) as Float32Array;
  const border = gs.column(COL.NODE_BORDER_WIDTH) as Float32Array;
  const nodeFlags = gs.column(COL.NODE_FLAGS) as Uint32Array;
  const nodeOrder = gs.order.nodes;
  const nodeGen = gs.nodes.gen;

  for (let i = 0; i < nodeOrder.slots.length; i++) {
    const slot = nodeOrder.slots[i];
    const g = nodeOrder.gens[i];

    if (nodeGen[slot] !== g || (nodeFlags[slot] & shown) !== shown) {
      continue;
    }

    const hw = size[slot * 2] / 2 + border[slot] / 2;
    const hh = size[slot * 2 + 1] / 2 + border[slot] / 2;
    const x = pos[slot * 2];
    const y = pos[slot * 2 + 1];

    if (overlap) {
      let hit = x + hw >= lx && x - hw <= hx && y + hh >= ly && y - hh <= hy;

      // the label *widens* an overlap (39.1), where it narrows a
      // containment: a node whose body misses the band but whose label
      // crosses it is touched by the band
      if (!hit && includeLabels) {
        const lb = gs.nodeLabelBox(slot);

        hit =
          lb != null &&
          x + lb.x2 >= lx &&
          x + lb.x1 <= hx &&
          y + lb.y2 >= ly &&
          y + lb.y1 <= hy;
      }

      if (hit) {
        out.push({ group: GROUP_NODES, slot, gen: g });
      }

      continue;
    }

    if (x - hw >= lx && x + hw <= hx && y - hh >= ly && y + hh <= hy) {
      // boxSelectionIncludesLabels (16.5, default off — v3's default):
      // the label box must be contained too
      if (includeLabels) {
        const lb = gs.nodeLabelBox(slot);

        if (
          lb != null &&
          !(
            x + lb.x1 >= lx &&
            x + lb.x2 <= hx &&
            y + lb.y1 >= ly &&
            y + lb.y2 <= hy
          )
        ) {
          continue;
        }
      }

      out.push({ group: GROUP_NODES, slot, gen: g });
    }
  }

  const endpoints = gs.column(COL.EDGE_ENDPOINTS) as Uint32Array;
  const edgeFlags = gs.column(COL.EDGE_FLAGS) as Uint32Array;
  const edgeOrder = gs.order.edges;
  const edgeGen = gs.edges.gen;
  const centerIn = (node: number): boolean => {
    const x = pos[node * 2];
    const y = pos[node * 2 + 1];

    return x >= lx && x <= hx && y >= ly && y <= hy;
  };

  const pointIn = (x: number, y: number): boolean => {
    return x >= lx && x <= hx && y >= ly && y <= hy;
  };

  for (let i = 0; i < edgeOrder.slots.length; i++) {
    const slot = edgeOrder.slots[i];
    const g = edgeOrder.gens[i];

    if (edgeGen[slot] !== g || (edgeFlags[slot] & shown) !== shown) {
      continue;
    }

    // both endpoints must be shown — the drawn-edge rule the cull
    // kernels apply, which ancestor gating (round 14.4) also feeds
    if (
      (nodeFlags[endpoints[slot * 2]] & shown) !== shown ||
      (nodeFlags[endpoints[slot * 2 + 1]] & shown) !== shown
    ) {
      continue;
    }

    if (overlap) {
      if (gs.edgeHitsBox(slot, lx, ly, hx, hy)) {
        out.push({ group: GROUP_EDGES, slot, gen: g });
      }

      continue;
    }

    let contained: boolean;

    if ((edgeFlags[slot] & FLAG_CURVED) !== 0) {
      // the curve's boundary endpoints — v3's exact 'contain' rule
      const ev = gs.curveEvalAt(slot);

      if (ev != null) {
        contained = pointIn(ev.sx, ev.sy) && pointIn(ev.ex, ev.ey);
      } else {
        const route = gs.curveRouteAt(slot) as CurveRoute;

        contained =
          pointIn(route.qx[0], route.qy[0]) &&
          pointIn(route.qx[route.n + 1], route.qy[route.n + 1]);
      }
    } else {
      const hay = gs.haystackPointsAt(slot);

      // haystack edges (12c) test their offset endpoints — v3's
      // haystackPts; straight/triangle edges keep the
      // endpoint-center approximation (recorded deviation)
      contained =
        hay != null
          ? pointIn(hay.sx, hay.sy) && pointIn(hay.tx, hay.ty)
          : centerIn(endpoints[slot * 2]) && centerIn(endpoints[slot * 2 + 1]);
    }

    if (contained) {
      out.push({ group: GROUP_EDGES, slot, gen: g });
    }
  }

  return out;
}

/**
 * Does any part of an edge's drawn path lie in the model-space box?
 * The 'overlap' box-selection test (round 39.1), and the exact one:
 * a segment crossing the band counts even when neither endpoint is in
 * it, which is the case containment can never express.
 *
 * Curved edges take the **conservative-then-exact** shape the rest of
 * the curve geometry uses: the memoized exact bb rejects the common
 * miss for the price of a cached box, and only a survivor pays for the
 * flattened walk at the drawn subdivision — the same polyline the
 * renderer strips, so what the band catches is what the band crosses.
 *
 * @param slot — the edge slot
 * @param lx — the box's low x, in model coordinates
 * @param ly — the box's low y
 * @param hx — the box's high x
 * @param hy — the box's high y
 * @returns whether the drawn path meets the box
 */
export function edgeHitsBox(
  gs: GraphStore,
  slot: number,
  lx: number,
  ly: number,
  hx: number,
  hy: number,
): boolean {
  const endpoints = gs.column(COL.EDGE_ENDPOINTS) as Uint32Array;
  const edgeFlags = gs.column(COL.EDGE_FLAGS) as Uint32Array;

  if ((edgeFlags[slot] & FLAG_CURVED) !== 0) {
    const bb = gs.curveBBAt(slot);

    // conservative reject on the memoized exact box
    if (bb != null && (bb.x2 < lx || bb.x1 > hx || bb.y2 < ly || bb.y1 > hy)) {
      return false;
    }

    const ev = gs.curveEvalAt(slot);
    const route = ev == null ? gs.curveRouteAt(slot) : null;

    if (ev == null && route == null) {
      return false;
    }

    const a = { x: 0, y: 0 };
    const b = { x: 0, y: 0 };

    for (let i = 0; i < CURVE_SEGS; i++) {
      if (ev != null) {
        curvePointAt(ev, i / CURVE_SEGS, a);
        curvePointAt(ev, (i + 1) / CURVE_SEGS, b);
      } else {
        routeVertex(route as CurveRoute, i, a);
        routeVertex(route as CurveRoute, i + 1, b);
      }

      if (segmentHitsBox(a.x, a.y, b.x, b.y, lx, ly, hx, hy)) {
        return true;
      }
    }

    return false;
  }

  const hay = gs.haystackPointsAt(slot);

  if (hay != null) {
    return segmentHitsBox(hay.sx, hay.sy, hay.tx, hay.ty, lx, ly, hx, hy);
  }

  // straight edges keep the endpoint-center approximation containment
  // uses: the two modes agree with each other, but since round 56 the
  // drawn line stops short of its arrowheads, so both are a little
  // longer than the ink.  Kept deliberately (ledger item 22): a stub
  // of an edge beside a node is not a distinction box selection is
  // making, and the cheap answer is the right one on UX grounds
  const pos = gs.column(COL.NODE_POSITION) as Float32Array;
  const s = endpoints[slot * 2];
  const t = endpoints[slot * 2 + 1];

  return segmentHitsBox(
    pos[s * 2],
    pos[s * 2 + 1],
    pos[t * 2],
    pos[t * 2 + 1],
    lx,
    ly,
    hx,
    hy,
  );
}

/**
 * A node label's box in node-local model px (round 16.4): the laid
 * (or headless-estimated) block at its D3 anchor, grown by the
 * text-background padding when a box draws.  Null when unlabelled.
 */
export function nodeLabelBox(
  gs: GraphStore,
  slot: number,
): { x1: number; y1: number; x2: number; y2: number } | null {
  const entry = gs.labels.nodes[slot];
  const dims = gs.labelDims.nodes.get(slot);

  if (entry == null || dims == null) {
    return null;
  }

  const pad = entry.bgColor >>> 24 > 0 ? entry.bgPadding : 0;
  const dx = entry.anchorX + entry.halignShift * dims.w + entry.marginX;
  const dy = entry.anchorY + entry.valignShift * dims.h;

  return {
    x1: dx - dims.w / 2 - pad,
    y1: dy - pad,
    x2: dx + dims.w / 2 + pad,
    y2: dy + dims.h + pad,
  };
}

/**
 * The conservative edge-label slack (16.4): a radius covering the
 * label block wherever its anchor lands on the drawn path (mid or
 * end streams, rotation included), added to the edge term's growth.
 */
export function edgeLabelSlack(gs: GraphStore, slot: number): number {
  let r = 0;

  for (const stream of [
    GROUP_EDGES,
    'edgeSource',
    'edgeTarget',
  ] as LabelStream[]) {
    const entry = gs.labels[stream][slot];
    const dims = gs.labelDims[stream].get(slot);

    if (entry == null || dims == null) {
      continue;
    }

    const pad = entry.bgColor >>> 24 > 0 ? entry.bgPadding : 0;
    const vert = Math.max(
      Math.abs(entry.anchorY),
      Math.abs(entry.anchorY + dims.h),
    );
    const own =
      dims.w / 2 + Math.abs(entry.marginX) + vert + pad + entry.endOffset;

    if (own > r) {
      r = own;
    }
  }

  return r;
}

/**
 * Whole-graph bounding box as a direct columnar scan — no element
 * handles (a no-arg fit() on a 500k-element graph is a fraction of a
 * millisecond instead of hundreds).  Nodes contribute position ±
 * (size/2 + border/2), grown by their outline, overlay/underlay
 * padding, ghost offset and label box where those apply.  Edges
 * contribute their own extent as a first-class term: the two endpoint
 * node centers, grown by the conservative hull deviation for
 * chord-bounded curved kinds (rounds 12a/12b), while the box-bounded
 * kinds — compound loops, taxi, extrapolated weights — read the
 * exact memoized curve bb (rounds 54/92: conservative margins for
 * them misframed compound fits).  Future edge geometry (arrow
 * heads, 12c endpoints) extends the edge term here and there
 * together.  Only the space tier counts (round 22): display-hidden
 * elements are excluded, `visibility: 'hidden'` ones still take
 * space.  Conservative by design — fit may over-fit, never under.
 *
 * @param includeLabels — whether label boxes join the box (v3's
 * default, on)
 * @returns null when nothing visible remains
 */
export function boundingBox(
  gs: GraphStore,
  includeLabels: boolean = true,
): {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  w: number;
  h: number;
} | null {
  gs.flushDerived(); // the edge term reads derived curve params

  let x1 = Infinity,
    y1 = Infinity,
    x2 = -Infinity,
    y2 = -Infinity;

  const pos = gs.column(COL.NODE_POSITION) as Float32Array;
  const size = gs.column(COL.NODE_SIZE) as Float32Array;
  const border = gs.column(COL.NODE_BORDER_WIDTH) as Float32Array;

  const ghost = gs.column(COL.NODE_GHOST) as Float32Array;
  const anyGhosts = gs.ghosts > 0;
  const anyNodeLabels = includeLabels && gs.hasNodeLabels();
  const anyEdgeLabels = includeLabels && gs.hasEdgeLabels();
  const over = gs.column(COL.NODE_OVERLAY) as Uint32Array;
  const under = gs.column(COL.NODE_UNDERLAY) as Uint32Array;
  const anyLayers = gs.overlays > 0 || gs.underlays > 0;
  const bGeom = gs.column(COL.NODE_BORDER_GEOM) as Uint32Array;
  const anyOutlines = gs.outlineSlackMax > 0;
  // the space tier (round 22): display-hidden elements take no space
  // (v3's rule — previously the fit scan included them, a gap gs
  // closed); `visibility: 'hidden'` ones keep theirs (VISIBLE, not DRAWN)
  const nodeFlags = gs.column(COL.NODE_FLAGS) as Uint32Array;

  gs.forEachAlive(GROUP_NODES, (slot) => {
    if ((nodeFlags[slot] & FLAG_VISIBLE) === 0) {
      return;
    }

    const x = pos[slot * 2];
    const y = pos[slot * 2 + 1];
    let hw = size[slot * 2] / 2 + border[slot] / 2;
    let hh = size[slot * 2 + 1] / 2 + border[slot] / 2;

    // an outline ring grows the body box (round 13 B5; conservative
    // for inside borders — the center convention, like the border term)
    if (anyOutlines && bGeom[slot * 4 + 2] >>> 24 !== 0) {
      const wo = bGeom[slot * 4 + 3];
      const extra = (wo >>> 16) / 256 / 2 + (wo & 0xffff) / 256;

      hw += extra;
      hh += extra;
    }

    // overlay/underlay pads grow the body box (round 13 A2; v3's
    // overlay sits on the inner size, so border-inclusive halves +
    // padding are conservative)
    if (anyLayers) {
      let pad = 0;

      if (over[slot * 4] >>> 24 !== 0) {
        pad = over[slot * 4 + 1] / 256;
      }
      if (under[slot * 4] >>> 24 !== 0) {
        pad = Math.max(pad, under[slot * 4 + 1] / 256);
      }

      hw += pad;
      hh += pad;
    }

    if (x - hw < x1) {
      x1 = x - hw;
    }
    if (y - hh < y1) {
      y1 = y - hh;
    }
    if (x + hw > x2) {
      x2 = x + hw;
    }
    if (y + hh > y2) {
      y2 = y + hh;
    }

    // a ghost duplicates the body at the offset (round 13 A1)
    if (anyGhosts && ghost[slot * 4 + 3] !== 0) {
      const gx = x + ghost[slot * 4];
      const gy = y + ghost[slot * 4 + 1];

      if (gx - hw < x1) {
        x1 = gx - hw;
      }
      if (gy - hh < y1) {
        y1 = gy - hh;
      }
      if (gx + hw > x2) {
        x2 = gx + hw;
      }
      if (gy + hh > y2) {
        y2 = gy + hh;
      }
    }

    // labels join the box by default (round 16.4): the laid (or
    // headless-estimated) block at its anchor
    if (anyNodeLabels) {
      const lb = gs.nodeLabelBox(slot);

      if (lb != null) {
        if (x + lb.x1 < x1) {
          x1 = x + lb.x1;
        }
        if (y + lb.y1 < y1) {
          y1 = y + lb.y1;
        }
        if (x + lb.x2 > x2) {
          x2 = x + lb.x2;
        }
        if (y + lb.y2 > y2) {
          y2 = y + lb.y2;
        }
      }
    }
  });

  const endpoints = gs.column(COL.EDGE_ENDPOINTS) as Uint32Array;
  const curveParams = gs.column(COL.EDGE_CURVE_PARAMS) as Float32Array;
  const edgeFlags = gs.column(COL.EDGE_FLAGS) as Uint32Array;

  gs.forEachAlive(GROUP_EDGES, (slot) => {
    // the space tier (round 22): hidden edges — or edges with a hidden
    // endpoint (the drawn-edge rule) — take no space
    if (
      (edgeFlags[slot] & FLAG_VISIBLE) === 0 ||
      (nodeFlags[endpoints[slot * 2]] & FLAG_VISIBLE) === 0 ||
      (nodeFlags[endpoints[slot * 2 + 1]] & FLAG_VISIBLE) === 0
    ) {
      return;
    }

    // curved edges: chord-bounded kinds take the conservative hull
    // bound — the quadratic lies within the endpoint/control hull,
    // whose controls sit at most the header deviation from the center
    // segment.  Cheap, symmetric and tight enough that exactness buys
    // no visible framing (fit may slightly over-fit, never under).
    const at = slot * 4;
    const kind = curveParams[at + 3];
    const labelSlack = anyEdgeLabels ? gs.edgeLabelSlack(slot) : 0;

    // box-bounded kinds — compound loops (14.10) and the blob routes
    // no chord bound covers (taxi, extrapolated weights) — are EXACT
    // here via the memoized flattened bb (curveBBAt,
    // epoch-invalidated), which the box-selection path already
    // computes per curved edge, so the scan pays it once per geometry
    // change rather than per call.  Round 54 made taxi exact when its
    // sweep caught a forced-direction route escaping any node-half
    // margin; round 92 retired the two remaining conservative terms —
    // the directional compound-loop box and the per-edge outer-half +
    // chord margin — because the kept p2 cushion over-framed the
    // compound fixture 1.23x and, growing up-left only, de-centered
    // every compound fit (fit centers the box it is given).
    if ((edgeFlags[slot] & FLAG_CURVED_BOX) !== 0) {
      const bb = gs.curveBBAt(slot);

      if (bb != null) {
        if (bb.x1 - labelSlack < x1) {
          x1 = bb.x1 - labelSlack;
        }
        if (bb.y1 - labelSlack < y1) {
          y1 = bb.y1 - labelSlack;
        }
        if (bb.x2 + labelSlack > x2) {
          x2 = bb.x2 + labelSlack;
        }
        if (bb.y2 + labelSlack > y2) {
          y2 = bb.y2 + labelSlack;
        }

        return;
      }
    }

    let dev =
      kind === CURVE_STRAIGHT
        ? 0
        : headerDeviation(
            kind,
            curveParams[at],
            curveParams[at + 1],
            curveParams[at + 2],
          );

    // edge labels (16.4): conservative — the block-covering radius,
    // valid wherever the anchor lands along the drawn path
    dev += labelSlack;

    for (let end = 0; end < 2; end++) {
      const node = endpoints[slot * 2 + end];
      const x = pos[node * 2];
      const y = pos[node * 2 + 1];

      if (x - dev < x1) {
        x1 = x - dev;
      }
      if (y - dev < y1) {
        y1 = y - dev;
      }
      if (x + dev > x2) {
        x2 = x + dev;
      }
      if (y + dev > y2) {
        y2 = y + dev;
      }
    }
  });

  if (x1 === Infinity) {
    return null;
  }

  return { x1, y1, x2, y2, w: x2 - x1, h: y2 - y1 };
}
