// Collection's bounding boxes (round 130 split): model, label, rendered
// and the layout-time `boundingBoxAt`.

import {
  GROUP_EDGES,
  GROUP_NODES,
  COL,
  CURVE_STRAIGHT,
  FLAG_ALIVE,
  FLAG_CURVED_BOX,
  FLAG_VISIBLE,
} from '../contract.mjs';
import { headerDeviation } from '../curve-geometry.mjs';
import type { Position } from '../types.mjs';
import type { Collection } from '../collection.mjs';

/**
 * The model-space box enclosing every element of the collection.
 *
 * **Labels are included by default** (round 16.4) — v3 excluded them
 * unless asked.  Node label terms are exact (the laid text block at its
 * anchor plus text-box padding); edge label terms are conservative (a
 * rotation-safe radius about both endpoints), so a box may be slightly
 * larger than the ink but never smaller.  The box also covers ghost
 * offsets, overlay/underlay padding and outlines.
 *
 * @param options — `{ includeLabels }` (default true)
 * @returns `{ x1, y1, x2, y2, w, h }` in model coordinates
 * @throws on an unknown option key — a typo must not silently change
 *   fit semantics
 * @see Collection#labelBoundingBox for the label box alone
 */
export function boundingBox(
  self: Collection,
  options?: { includeLabels?: boolean },
): {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  w: number;
  h: number;
} {
  // labels join the box by default (round 16.4); unknown keys throw —
  // a typo must not silently change fit semantics
  if (options != null) {
    for (const key of Object.keys(options)) {
      if (key !== 'includeLabels') {
        throw new Error(
          `Unknown boundingBox() option '${key}'; supported: includeLabels`,
        );
      }
    }
  }

  const includeLabels = options?.includeLabels !== false;
  const store = self._store;
  let x1 = Infinity,
    y1 = Infinity,
    x2 = -Infinity,
    y2 = -Infinity;

  const expandPoint = (
    x: number,
    y: number,
    halfW: number = 0,
    halfH: number = 0,
  ): void => {
    x1 = Math.min(x1, x - halfW);
    y1 = Math.min(y1, y - halfH);
    x2 = Math.max(x2, x + halfW);
    y2 = Math.max(y2, y + halfH);
  };

  const size = store.column(COL.NODE_SIZE) as Float32Array;
  const border = store.column(COL.NODE_BORDER_WIDTH) as Float32Array;
  const ghost = store.column(COL.NODE_GHOST) as Float32Array;
  const bGeom = store.column(COL.NODE_BORDER_GEOM) as Uint32Array;
  const endpoints = store.column(COL.EDGE_ENDPOINTS) as Uint32Array;

  store.flushDerived(); // parent auto-bounds + curved-edge params derive below

  // the space tier (round 22): display-hidden elements take no space
  // (v3's rule; the whole-graph fit scan already excluded them), while
  // `visibility: 'hidden'` elements keep theirs — the mask is VISIBLE,
  // not DRAWN.  An edge needs both endpoints shown (the drawn-edge rule).
  const nodeFlags = store.column(COL.NODE_FLAGS) as Uint32Array;
  const edgeFlags = store.column(COL.EDGE_FLAGS) as Uint32Array;
  const shownMask = FLAG_ALIVE | FLAG_VISIBLE;
  const shown = (flags: Uint32Array, slot: number): boolean =>
    (flags[slot] & shownMask) === shownMask;

  for (const ref of self._liveRefs()) {
    if (ref.group === GROUP_NODES && !shown(nodeFlags, ref.slot)) {
      continue;
    }

    if (
      ref.group === GROUP_EDGES &&
      !(
        shown(edgeFlags, ref.slot) &&
        shown(nodeFlags, endpoints[ref.slot * 2]) &&
        shown(nodeFlags, endpoints[ref.slot * 2 + 1])
      )
    ) {
      continue;
    }

    if (ref.group === GROUP_NODES) {
      const slot = ref.slot;
      let hw = size[slot * 2] / 2 + border[slot] / 2;
      let hh = size[slot * 2 + 1] / 2 + border[slot] / 2;

      // an outline ring grows the box (round 13 B5)
      if (bGeom[slot * 4 + 2] >>> 24 !== 0) {
        const wo = bGeom[slot * 4 + 3];
        const extra = (wo >>> 16) / 256 / 2 + (wo & 0xffff) / 256;

        hw += extra;
        hh += extra;
      }

      expandPoint(store.getX(slot), store.getY(slot), hw, hh);

      // a ghost duplicates the body at the offset (round 13 A1)
      if (ghost[slot * 4 + 3] !== 0) {
        expandPoint(
          store.getX(slot) + ghost[slot * 4],
          store.getY(slot) + ghost[slot * 4 + 1],
          hw,
          hh,
        );
      }

      // the node label's laid box at its anchor (round 16.4)
      if (includeLabels) {
        const lb = store.nodeLabelBox(slot);

        if (lb != null) {
          expandPoint(store.getX(slot) + lb.x1, store.getY(slot) + lb.y1);
          expandPoint(store.getX(slot) + lb.x2, store.getY(slot) + lb.y2);
        }
      }
    } else {
      // curved edges use the exact lazy bound (memoized flattened
      // polyline); straight edges span their endpoint centers
      const curveBB = store.curveBBAt(ref.slot);
      const hay = curveBB == null ? store.haystackPointsAt(ref.slot) : null;

      if (curveBB != null) {
        expandPoint(curveBB.x1, curveBB.y1);
        expandPoint(curveBB.x2, curveBB.y2);
      } else if (hay != null) {
        // haystack edges (12c) span their offset points (v3's allpts)
        expandPoint(hay.sx, hay.sy);
        expandPoint(hay.tx, hay.ty);
      } else {
        expandPoint(
          store.getX(endpoints[ref.slot * 2]),
          store.getY(endpoints[ref.slot * 2]),
        );
        expandPoint(
          store.getX(endpoints[ref.slot * 2 + 1]),
          store.getY(endpoints[ref.slot * 2 + 1]),
        );
      }

      // edge labels (16.4): the conservative block-covering radius
      // about both endpoints (the anchor lies on the drawn path) — a
      // recorded approximation; node labels are exact above
      if (includeLabels) {
        const r = store.edgeLabelSlack(ref.slot);

        if (r > 0) {
          expandPoint(
            store.getX(endpoints[ref.slot * 2]),
            store.getY(endpoints[ref.slot * 2]),
            r,
            r,
          );
          expandPoint(
            store.getX(endpoints[ref.slot * 2 + 1]),
            store.getY(endpoints[ref.slot * 2 + 1]),
            r,
            r,
          );
        }
      }
    }
  }

  if (x1 === Infinity) {
    return { x1: 0, y1: 0, x2: 0, y2: 0, w: 0, h: 0 };
  }

  return { x1, y1, x2, y2, w: x2 - x1, h: y2 - y1 };
}

/**
 * The exact laid label boxes of this collection's elements, unioned
 * (round 16.4 — the v4 form of v3's text-metrics surface): node
 * labels at their anchors, edge mid-labels at the drawn midpoint,
 * end labels conservatively about their endpoint.  Empty (zero) when
 * nothing is labelled.  Headless dims are estimates (recorded).
 */
export function labelBoundingBox(self: Collection): {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  w: number;
  h: number;
} {
  const store = self._store;
  let x1 = Infinity,
    y1 = Infinity,
    x2 = -Infinity,
    y2 = -Infinity;

  const expand = (bx1: number, by1: number, bx2: number, by2: number): void => {
    x1 = Math.min(x1, bx1);
    y1 = Math.min(y1, by1);
    x2 = Math.max(x2, bx2);
    y2 = Math.max(y2, by2);
  };

  for (const ref of self._liveRefs()) {
    if (ref.group === GROUP_NODES) {
      const lb = store.nodeLabelBox(ref.slot);

      if (lb != null) {
        const x = store.getX(ref.slot);
        const y = store.getY(ref.slot);

        expand(x + lb.x1, y + lb.y1, x + lb.x2, y + lb.y2);
      }

      continue;
    }

    // edge mid-labels: the block about the drawn midpoint; end labels
    // ride the conservative endpoint radius
    const entry = store.labelAt(ref.slot, GROUP_EDGES);
    const dims = store.labelDimsAt(ref.slot, GROUP_EDGES);

    if (entry != null && dims != null) {
      const m = self._cy._ele(ref.group, ref.slot).midpoint() ?? {
        x: 0,
        y: 0,
      };
      const dx = entry.marginX;
      const pad = entry.bgColor >>> 24 > 0 ? entry.bgPadding : 0;

      expand(
        m.x + dx - dims.w / 2 - pad,
        m.y + entry.anchorY - pad,
        m.x + dx + dims.w / 2 + pad,
        m.y + entry.anchorY + dims.h + pad,
      );
    }

    const r = Math.max(
      store.labelDimsAt(ref.slot, 'edgeSource') != null
        ? store.edgeLabelSlack(ref.slot)
        : 0,
      store.labelDimsAt(ref.slot, 'edgeTarget') != null
        ? store.edgeLabelSlack(ref.slot)
        : 0,
    );

    if (r > 0) {
      const endpoints = store.column(COL.EDGE_ENDPOINTS) as Uint32Array;

      for (let end = 0; end < 2; end++) {
        const node = endpoints[ref.slot * 2 + end];

        expand(
          store.getX(node) - r,
          store.getY(node) - r,
          store.getX(node) + r,
          store.getY(node) + r,
        );
      }
    }
  }

  if (x1 === Infinity) {
    return { x1: 0, y1: 0, x2: 0, y2: 0, w: 0, h: 0 };
  }

  return { x1, y1, x2, y2, w: x2 - x1, h: y2 - y1 };
}

/**
 * `boundingBox()` transformed into rendered (on-screen) coordinates.
 *
 * @param options — as `boundingBox()`: `{ includeLabels }`, default
 *   true; an unknown key throws
 * @returns the rendered-space box
 */
export function renderedBoundingBox(
  self: Collection,
  options?: { includeLabels?: boolean },
): {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  w: number;
  h: number;
} {
  const bb = self.boundingBox(options);
  const zoom = self._cy.zoom() as number;
  const pan = self._cy.pan() as Position;
  const x1 = bb.x1 * zoom + pan.x;
  const y1 = bb.y1 * zoom + pan.y;
  const x2 = bb.x2 * zoom + pan.x;
  const y2 = bb.y2 * zoom + pan.y;

  return { x1, y1, x2, y2, w: x2 - x1, h: y2 - y1 };
}

/**
 * The bounding box this collection would have if its nodes sat at the
 * given hypothetical positions (a position fn or one shared position) —
 * v3's boundingBoxAt, computed directly with no store writes.  Edges
 * span their endpoints' hypothetical (or, outside the collection,
 * current) positions.
 *
 * @param fn — one position shared by every node, or `( node, i ) =>
 *   position` evaluated per node in this collection's order
 * @returns the hypothetical box, in model coordinates
 * @internal
 */
export function boundingBoxAt(
  self: Collection,
  fn: Position | ((node: Collection, i: number) => Position),
): {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  w: number;
  h: number;
} {
  const nodes = self.nodes();
  const posFn = typeof fn === 'function' ? fn : () => fn;
  const posMap = new Map<Collection, Position>();

  let x1 = Infinity,
    y1 = Infinity,
    x2 = -Infinity,
    y2 = -Infinity;

  const expandPoint = (x: number, y: number): void => {
    x1 = Math.min(x1, x);
    x2 = Math.max(x2, x);
    y1 = Math.min(y1, y);
    y2 = Math.max(y2, y);
  };

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];

    // parents derive from their children (14.11): the leaves'
    // hypothetical boxes stand in for the parent body (the padding
    // margin is not modeled — a recorded fit-target approximation)
    if (node.isParent()) {
      continue;
    }

    const pos = posFn(node, i);

    posMap.set(node, pos);

    const halfW = (node.outerWidth() ?? 0) / 2;
    const halfH = (node.outerHeight() ?? 0) / 2;

    expandPoint(pos.x - halfW, pos.y - halfH);
    expandPoint(pos.x + halfW, pos.y + halfH);

    // the node-relative label box comes along (round 16.4): an
    // animated layout's fit target covers the labels too
    const lb = self._store.nodeLabelBox(node._refs[0].slot);

    if (lb != null) {
      expandPoint(pos.x + lb.x1, pos.y + lb.y1);
      expandPoint(pos.x + lb.x2, pos.y + lb.y2);
    }
  }

  const curveParams = self._store.column(COL.EDGE_CURVE_PARAMS) as Float32Array;
  const edgeFlags = self._store.column(COL.EDGE_FLAGS) as Uint32Array;

  self._store.flushDerived();

  for (const ref of self._liveRefs()) {
    if (ref.group !== GROUP_EDGES) {
      continue;
    }

    const edge = self._cy._ele(GROUP_EDGES, ref.slot);

    // curved edges: chord-bounded kinds expand by the conservative
    // hull deviation — cheap, symmetric, and tight enough for a fit
    // target — twinned with `GraphStore.boundingBox`.
    const at = ref.slot * 4;
    const kind = curveParams[at + 3];
    const source = edge.source();
    const target = edge.target();
    const sPos = posMap.get(source) ?? (source.position() as Position);
    const tPos = posMap.get(target) ?? (target.position() as Position);

    // box-bounded kinds — compound loops, taxi, extrapolated
    // weights — evaluate EXACTLY at the hypothetical centres
    // (rounds 54/92, the same tiering as the whole-graph scan):
    // round 54's sweep caught a forced-direction taxi escaping any
    // node-half margin, and round 92 retired the compound-loop and
    // extrapolated-margin terms whose p2 cushion misframed and
    // de-centered compound fits.  The flattened polyline hull-bounds
    // the drawn path.
    if ((edgeFlags[ref.slot] & FLAG_CURVED_BOX) !== 0) {
      const bb = self._store.curveBBAtPositions(
        ref.slot,
        sPos.x,
        sPos.y,
        tPos.x,
        tPos.y,
      );

      if (bb != null) {
        expandPoint(bb.x1, bb.y1);
        expandPoint(bb.x2, bb.y2);
        continue;
      }
    }

    const dev =
      kind === CURVE_STRAIGHT
        ? 0
        : headerDeviation(
            kind,
            curveParams[at],
            curveParams[at + 1],
            curveParams[at + 2],
          );

    for (const pos of [sPos, tPos]) {
      expandPoint(pos.x - dev, pos.y - dev);
      expandPoint(pos.x + dev, pos.y + dev);
    }
  }

  if (x1 === Infinity) {
    x1 = y1 = x2 = y2 = 0;
  }

  return { x1, y1, x2, y2, w: x2 - x1, h: y2 - y1 };
}
