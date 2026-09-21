/*
Curved-edge geometry (round 12a: bundled bezier + self-loops).

This is the CPU half of the dual-implementation discipline for expensive
GPU geometry (see src/README.md, "Expensive GPU-computed geometry"):
the WGSL curve shaders in render/shaders.mts mirror these functions step
for step, both running on the same inputs (live endpoint positions +
node geometry columns + the per-edge curve params) — neither side ever
reads back the other's result.  Change the math here and in the WGSL
together.

The formulas are v3's, ported from
src/extensions/renderer/base/coord-ele-math/edge-control-points.mts:

- The *frame* is v3's `edge-distances: 'intersection'` default: the
  intersection points of each node's boundary with the line between the
  two node centers; the control point offsets from a weighted point
  between them along the perpendicular.  (The 'node-position' frame
  landed with the 12b route families below; 'endpoints' needs 12c's
  manual endpoints.)
- A bundled bezier's control offset is the stagger
  `(0.5 - n/2 + i) * stepSize`, n the bundle size and i the edge's
  index within it; the middle edge of an odd bundle is straight (that
  rule, with n = 1, is why a lone `bezier` edge renders straight).
- A self-loop's two control points sit at angles
  `loopDir - PI/2 -/+ loopSweep/2` and radius
  `1.4 * stepSize * (j/3 + 1)` (j the loop's per-(direction, sweep)
  stagger index on its node); the drawn curve is v3's two quadratics
  through the control midpoint (C1-continuous by construction).
- Curve endpoints sit on the node boundary along the ray to the near
  control point (v3's `outside-to-node` default; manual endpoints are
  12c).

Node boundaries use the same approximation tier the arrow shader
established: circles/ellipses exact, rectangles exact (their box),
round-rectangles as their box, polygons as their inscribed ellipse — a
recorded deviation from v3's exact per-shape intersections.
*/
export {
  CURVE_SEGS,
  AVOID_IMPOSSIBLE_BEZIER,
  AVOID_IMPOSSIBLE_BEZIER_L,
  boundaryOffset,
  bundleOffset,
  loopAngles,
  loopRadius,
  NO_ARROW_TRIM,
  shortenToward,
  emptyCurveEval,
  evalCurve,
  curvePointAt,
  flattenCurve,
  segmentHitsBox,
  curveDeviation,
  headerDeviation,
} from './curve-geometry/bezier.mjs';
export type { ArrowTrim, CurveEval } from './curve-geometry/bezier.mjs';
export {
  MAX_MULTI_CTRL,
  MAX_CURVE_PTS,
  MAX_ROUTE_PIECES,
  EDGE_DIST_INTERSECTION,
  EDGE_DIST_NODE_POSITION,
  EDGE_DIST_ENDPOINTS,
  ENDPT_DEFAULT,
  ENDPT_INSIDE,
  ENDPT_LINE,
  ENDPT_POINT,
  ENDPT_ANGLE,
  ENDPT_BLOCK_FLOATS,
  ENDPT_PCT_X,
  ENDPT_PCT_Y,
  TAXI_AUTO,
  TAXI_VERTICAL,
  TAXI_HORIZONTAL,
  TAXI_UPWARD,
  TAXI_DOWNWARD,
  TAXI_LEFTWARD,
  TAXI_RIGHTWARD,
  emptyCurveRoute,
  evalRoute,
  rawEndpointAnchor,
  resolveEndpoint,
  haystackPoint,
  haystackAngle,
} from './curve-geometry/route.mjs';
export type { CurveRoute } from './curve-geometry/route.mjs';
export {
  emptyRouteCorner,
  computeCorner,
  routeCorner,
  routePieceCount,
  allocRouteQuads,
  routeQuadPiece,
  arcSweep,
  routeVertex,
  flattenRoute,
  routeMidpoint,
} from './curve-geometry/route-quads.mjs';
export type { RouteCorner } from './curve-geometry/route-quads.mjs';
