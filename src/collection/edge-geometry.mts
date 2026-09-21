// Collection's edge geometry (round 130 split): midpoints, endpoints,
// control and segment points, model and rendered.

import { GROUP_EDGES, CURVE_MULTI } from '../contract.mjs';
import { routeMidpoint } from '../curve-geometry.mjs';
import type { CurveRoute } from '../curve-geometry.mjs';
import { CURVE_STYLE_BEZIER } from '../store/curve-index.mjs';
import type { Position } from '../types.mjs';
import type { Collection } from '../collection.mjs';

/** Midpoint of the edge: the curve/route midpoint for curved edges
 * (v3's rs.mid rules per family), the endpoint-center average for
 * straight ones.
 *
 * @returns the point a mid-label and a mid-arrow anchor at, in model
 *   space; undefined for non-edges.  Mid-tween it inherits the position
 *   lease's staleness, like the endpoints it derives from
 */
export function midpoint(self: Collection): Position | undefined {
  const ref = self._first();

  if (ref == null || ref.group !== GROUP_EDGES || !self._store.isCurrent(ref)) {
    return undefined;
  }

  const ev = self._store.curveEvalAt(ref.slot);

  if (ev != null) {
    return { x: ev.mx, y: ev.my };
  }

  const route = self._store.curveRouteAt(ref.slot);

  if (route != null) {
    const m = { x: 0, y: 0, tx: 0, ty: 0 };

    routeMidpoint(route, m);

    return { x: m.x, y: m.y };
  }

  // haystack edges (12c): the offset-point average, v3's rs.mid
  const hay = self._store.haystackPointsAt(ref.slot);

  if (hay != null) {
    return { x: (hay.sx + hay.tx) / 2, y: (hay.sy + hay.ty) / 2 };
  }

  // Straight edges: v3's `storeAllpts` does *not* answer the chord
  // midpoint here, it answers
  //
  //     ( startX + endX + arrowStartX + arrowEndX ) / 4
  //
  // — the mean of the two gap-shortened line ends and the two
  // spacing-shortened arrow points.  With the same head at both ends
  // the shortenings cancel and it lands back on the chord midpoint,
  // which is why self read as correct for four rounds; give the ends
  // different heads and it stops cancelling.  It matters beyond the
  // accessor: self is where a mid-arrow sits and an edge label
  // anchors.
  const line = self._store.straightLineEndAt(ref.slot, 0);
  const lineEnd = self._store.straightLineEndAt(ref.slot, 1);
  const arrow = self._store.straightEndpointAt(ref.slot, 0);
  const arrowEnd = self._store.straightEndpointAt(ref.slot, 1);

  return {
    x: (line.x + lineEnd.x + arrow.x + arrowEnd.x) / 4,
    y: (line.y + lineEnd.y + arrow.y + arrowEnd.y) / 4,
  };
}

/** Whether the edge participates in bezier bundling — v3 semantics:
 * a style check (`curve-style: bezier`), true even for the lone or
 * odd-middle member that renders straight.
 *
 * @returns whether the *styled record* says bezier — a question about
 *   style, not about the rendered shape, which is why a lone edge under
 *   `curve-style: bezier` answers true while drawing as a line.  False
 *   for nodes and for removed elements
 * @internal
 */
export function isBundledBezier(self: Collection): boolean {
  const ref = self._first();

  if (ref == null || ref.group !== GROUP_EDGES || !self._store.isCurrent(ref)) {
    return false;
  }

  return self._store.curveStyleAt(ref.slot).style === CURVE_STYLE_BEZIER;
}

/** The edge's curve control points (model coords): one for a bundled
 * bezier, two for a self-loop, the control list for an unbundled
 * bezier, undefined otherwise — v3's getControlPoints surface
 * (segments/taxi answer segmentPoints() instead).
 *
 * @returns the control points in model space, or undefined when the
 *   edge has none — which covers straight edges, segments/taxi routes,
 *   and a straight edge carrying manual endpoints (the 12c `n = 0`
 *   chord)
 */
export function controlPoints(self: Collection): Position[] | undefined {
  const ref = self._first();

  if (ref == null || ref.group !== GROUP_EDGES || !self._store.isCurrent(ref)) {
    return undefined;
  }

  const ev = self._store.curveEvalAt(ref.slot);

  if (ev != null) {
    return ev.c1x === ev.c2x && ev.c1y === ev.c2y
      ? [{ x: ev.c1x, y: ev.c1y }]
      : [
          { x: ev.c1x, y: ev.c1y },
          { x: ev.c2x, y: ev.c2y },
        ];
  }

  const route = self._store.curveRouteAt(ref.slot);

  // a straight-styled edge with manual endpoints derives as the
  // MULTI n = 0 chord (12c) — it has no control points
  if (route == null || route.kind !== CURVE_MULTI || route.n === 0) {
    return undefined;
  }

  return _routeInteriorPoints(self, route);
}

/** The edge's segment points (model coords) — v3's getSegmentPoints:
 * defined for segments *and* taxi edges (taxi derives its points),
 * undefined otherwise.
 *
 * @returns the interior route points in model space — *derived* ones
 *   for taxi, which computes rather than declares them — or undefined
 *   for every other family
 */
export function segmentPoints(self: Collection): Position[] | undefined {
  const ref = self._first();

  if (ref == null || ref.group !== GROUP_EDGES || !self._store.isCurrent(ref)) {
    return undefined;
  }

  const route = self._store.curveRouteAt(ref.slot);

  if (route == null || route.kind === CURVE_MULTI) {
    return undefined;
  }

  return _routeInteriorPoints(self, route);
}

/** The interior points of a route (control or segment points) as positions, in route order. */
export function _routeInteriorPoints(
  self: Collection,
  route: CurveRoute,
): Position[] {
  const pts: Position[] = [];

  for (let i = 0; i < route.n; i++) {
    pts.push({ x: route.qx[i + 1], y: route.qy[i + 1] });
  }

  return pts;
}

/** The model point where the first edge meets its source (`which` 0) or target (1) node, or undefined when there is no live edge. */
export function _endpointPoint(
  self: Collection,
  which: 0 | 1,
): Position | undefined {
  const ref = self._first();

  if (ref == null || ref.group !== GROUP_EDGES || !self._store.isCurrent(ref)) {
    return undefined;
  }

  // v3 answers its *arrow* points here (`rs.arrowStartX/Y`), which sit
  // `spacing` behind the boundary — not the drawn line's ends, which
  // sit `gap` behind it.  The evaluators carry both since round 56.
  const ev = self._store.curveEvalAt(ref.slot);

  if (ev != null) {
    return which === 0 ? { x: ev.asx, y: ev.asy } : { x: ev.aex, y: ev.aey };
  }

  const route = self._store.curveRouteAt(ref.slot);

  if (route != null) {
    return which === 0
      ? { x: route.asx, y: route.asy }
      : { x: route.aex, y: route.aey };
  }

  // haystack edges (12c): the offset points — v3's haystackPts
  const hay = self._store.haystackPointsAt(ref.slot);

  if (hay != null) {
    return which === 0 ? { x: hay.sx, y: hay.sy } : { x: hay.tx, y: hay.ty };
  }

  // straight edges (round 55): the node boundary along the chord, which
  // is both what v3 answers and what v4's arrow shader draws to.  This
  // used to return the node *centre* — off by a whole node radius, and
  // visible to anyone using renderedTargetEndpoint() to place an
  // overlay.  v3 additionally pulls the point back by the arrow shape's
  // `spacing`, which is zero for every head except `tee`; that term
  // lands with the gap/trim port, so that the accessor never describes
  // a point the renderer does not draw.
  return self._store.straightEndpointAt(ref.slot, which);
}

/** A model point in rendered (viewport) pixels, or undefined for undefined. */
export function _toRenderedPoint(
  self: Collection,
  pos: Position | undefined,
): Position | undefined {
  if (pos == null) {
    return undefined;
  }

  const zoom = self._cy.zoom() as number;
  const pan = self._cy.pan() as Position;

  return { x: pos.x * zoom + pan.x, y: pos.y * zoom + pan.y };
}
