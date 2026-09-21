import { CURVE_MULTI } from '../contract.mjs';
import { CURVE_SEGS, qbezier } from './bezier.mjs';
import { MAX_ROUTE_PIECES } from './route.mjs';
import type { CurveRoute } from './route.mjs';

/** A round corner: the arc replacing an interior route point. */
export interface RouteCorner {
  cx: number;
  cy: number;
  r: number;
  startX: number;
  startY: number;
  stopX: number;
  stopY: number;
  a0: number;
  a1: number;
  /** canvas-arc counterclockwise flag (v3's drawDirection) */
  ccw: boolean;
}

/** A zeroed `RouteCorner` for callers to reuse as `computeCorner`'s
 * `out` scratch. */
export const emptyRouteCorner = (): RouteCorner => ({
  cx: 0,
  cy: 0,
  r: 0,
  startX: 0,
  startY: 0,
  stopX: 0,
  stopY: 0,
  a0: 0,
  a1: 0,
  ccw: false,
});

/**
 * v3's getRoundCorner (src/round.mts) as a pure function — identical
 * numbers, none of the module-level scratch state.  `radiusMax` is the
 * per-point radius; `isArc` selects 'arc-radius' (the radius is the
 * arc's, clamped to fit) vs 'influence-radius' (the radius caps the
 * cut-back distance along the legs).
 */
export const computeCorner = (
  out: RouteCorner,
  prevX: number,
  prevY: number,
  curX: number,
  curY: number,
  nextX: number,
  nextY: number,
  radiusMax: number,
  isArc: boolean,
): RouteCorner => {
  /** The no-arc answer: the corner stays a corner. */
  const noArc = (): RouteCorner => {
    out.cx = curX;
    out.cy = curY;
    out.r = 0;
    out.startX = curX;
    out.startY = curY;
    out.stopX = curX;
    out.stopY = curY;
    out.a0 = 0;
    out.a1 = 0;
    out.ccw = false;

    return out;
  };

  if (radiusMax === 0) {
    return noArc();
  }

  // vectors from the corner toward its neighbours (v3's asVec)
  const v1x = prevX - curX;
  const v1y = prevY - curY;
  const v1l = Math.sqrt(v1x * v1x + v1y * v1y);
  const v2x = nextX - curX;
  const v2y = nextY - curY;
  const v2l = Math.sqrt(v2x * v2x + v2y * v2y);

  // A zero-length leg has no direction, so there is no corner to round —
  // and normalizing it would put NaN into every value below.
  //
  // This is a **deliberate divergence from v3**, and the only one in this
  // function: v3's `asVec` (src/round.mts) divides unguarded and produces
  // NaN corners here, and its own collinear check sits *after* the
  // normalize, where `abs(NaN) < 1e-6` is false, so it never fires
  // either.  The configuration is not exotic — an axis-aligned pair of
  // nodes under `round-taxi` produces two coincident interior points in
  // both libraries (that part is a faithful port), which is what a grid
  // layout hands you.  Four edges of debug/'s `v3-default` network are
  // exactly this.
  //
  // v4's consequence was worse than v3's, which is why matching v3 here
  // was not an option: the NaN propagated out to `boundingBox()`, which
  // answered `{x1: null, y1: null, x2: null, y2: null}` — so the edge was
  // unpickable, uncullable and corrupted any bound that included it.
  if (v1l === 0 || v2l === 0) {
    return noArc();
  }

  const v1nx = v1x / v1l;
  const v1ny = v1y / v1l;
  const v2nx = v2x / v2l;
  const v2ny = v2y / v2l;

  const sinA = v1nx * v2ny - v1ny * v2nx;
  const sinA90 = v1nx * v2nx - v1ny * -v2ny;
  let angle = Math.asin(Math.max(-1, Math.min(1, sinA)));

  if (Math.abs(angle) < 1e-6) {
    return noArc();
  } // collinear: no arc

  let radDirection = 1;
  let drawDirection = false;

  if (sinA90 < 0) {
    if (angle < 0) {
      angle = Math.PI + angle;
    } else {
      angle = Math.PI - angle;
      radDirection = -1;
      drawDirection = true;
    }
  } else if (angle > 0) {
    radDirection = -1;
    drawDirection = true;
  }

  const halfAngle = angle / 2;
  const limit = Math.min(v1l / 2, v2l / 2);
  let lenOut: number;
  let cRadius: number;

  if (isArc) {
    lenOut = Math.abs((Math.cos(halfAngle) * radiusMax) / Math.sin(halfAngle));

    if (lenOut > limit) {
      lenOut = limit;
      cRadius = Math.abs((lenOut * Math.sin(halfAngle)) / Math.cos(halfAngle));
    } else {
      cRadius = radiusMax;
    }
  } else {
    lenOut = Math.min(limit, radiusMax);
    cRadius = Math.abs((lenOut * Math.sin(halfAngle)) / Math.cos(halfAngle));
  }

  out.stopX = curX + v2nx * lenOut;
  out.stopY = curY + v2ny * lenOut;
  out.cx = out.stopX - v2ny * cRadius * radDirection;
  out.cy = out.stopY + v2nx * cRadius * radDirection;
  out.startX = curX + v1nx * lenOut;
  out.startY = curY + v1ny * lenOut;
  out.r = cRadius;
  out.a0 = Math.atan2(v1ny, v1nx) + (Math.PI / 2) * radDirection;
  out.a1 = Math.atan2(v2ny, v2nx) - (Math.PI / 2) * radDirection;
  out.ccw = drawDirection;

  return out;
};

/** The corner at interior point j of a round route (raw polyline
 * neighbours, as v3 uses them — adjacent arcs can't overlap because
 * lenOut clamps at half of each leg). */
export const routeCorner = (
  route: CurveRoute,
  j: number,
  out: RouteCorner,
): RouteCorner => {
  return computeCorner(
    out,
    route.qx[j],
    route.qy[j],
    route.qx[j + 1],
    route.qy[j + 1],
    route.qx[j + 2],
    route.qy[j + 2],
    route.radius[j],
    route.arcMode[j] === 1,
  );
};

/** Pieces the drawn strip must cover: multibezier has one quadratic per
 * control; polylines one leg per span, with an arc between legs when
 * round. */
export const routePieceCount = (route: CurveRoute): number => {
  if (route.kind === CURVE_MULTI) {
    return Math.max(route.n, 1);
  }

  return route.round ? 2 * route.n + 1 : route.n + 1;
};

/** below this total bend (radians) a route counts as straight and the
 * leftover quads distribute uniformly — the bend-weighted split would
 * otherwise hand everything to sub-arcsecond noise. */
const BEND_EPS = 1e-4;

/**
 * The tangent-turn bend of piece p, in radians — the round-93 weight:
 * an arc piece turns by its sweep angle (π minus the interior angle
 * between its legs — the radius only scales the arc, never its sweep,
 * and the clamped-`lenOut` case keeps the same sweep too), a
 * multibezier piece by the angle between its control legs (a
 * quadratic's tangent rotates monotonically from `c - a` to `b - c`),
 * and a straight leg by zero.  Degenerate legs and radius-0 corners —
 * where `computeCorner` draws no arc — weigh zero.  The WGSL twin is
 * `pieceBendW`.
 */
const pieceBend = (route: CurveRoute, p: number): number => {
  if (route.kind === CURVE_MULTI) {
    if (route.n === 0) {
      return 0;
    } // the chord: one straight piece

    const cx = route.qx[p + 1];
    const cy = route.qy[p + 1];
    const ax = p === 0 ? route.qx[0] : (route.qx[p] + cx) / 2;
    const ay = p === 0 ? route.qy[0] : (route.qy[p] + cy) / 2;
    const bx =
      p === route.n - 1 ? route.qx[route.n + 1] : (cx + route.qx[p + 2]) / 2;
    const by =
      p === route.n - 1 ? route.qy[route.n + 1] : (cy + route.qy[p + 2]) / 2;
    const ux = cx - ax;
    const uy = cy - ay;
    const vx = bx - cx;
    const vy = by - cy;

    if (ux * ux + uy * uy < 1e-12 || vx * vx + vy * vy < 1e-12) {
      return 0;
    }

    return Math.atan2(Math.abs(ux * vy - uy * vx), ux * vx + uy * vy);
  }

  if (!route.round || (p & 1) === 0) {
    return 0;
  } // straight legs, sharp polylines

  const j = (p - 1) / 2;

  if (!(route.radius[j] > 0)) {
    return 0;
  } // no arc drawn at this corner

  const v1x = route.qx[j] - route.qx[j + 1];
  const v1y = route.qy[j] - route.qy[j + 1];
  const v2x = route.qx[j + 2] - route.qx[j + 1];
  const v2y = route.qy[j + 2] - route.qy[j + 1];

  if (v1x * v1x + v1y * v1y < 1e-12 || v2x * v2x + v2y * v2y < 1e-12) {
    return 0;
  }

  return Math.atan2(Math.abs(v1x * v2y - v1y * v2x), -(v1x * v2x + v1y * v2y));
};

/** module-level weight scratch — the allocator never allocates */
const bendScratch = new Float64Array(MAX_ROUTE_PIECES);

/**
 * Build the route's subdivision map (round 93): every piece gets one
 * mandatory quad, and the `segs - P` leftover quads split
 * proportionally to the pieces' bend weights by cumulative floor —
 * `segEnd[p] = (p + 1) + ⌊leftover · cum(p)/W⌋` — so the map is
 * monotone, every piece keeps ≥ 1 quad, and every piece boundary lands
 * exactly on a subdivision index.  A route with no bend (W ≤ BEND_EPS)
 * splits uniformly.  Requires P ≤ segs (the derivation caps interior
 * counts to guarantee it).  The WGSL twin is `allocRouteQuadsW`.
 */
export const allocRouteQuads = (
  route: CurveRoute,
  segs: number = CURVE_SEGS,
): void => {
  const P = routePieceCount(route);
  let W = 0;

  for (let p = 0; p < P; p++) {
    const b = pieceBend(route, p);

    bendScratch[p] = b;
    W += b;
  }

  const noBend = !(W > BEND_EPS);
  const total = noBend ? P : W;
  const leftover = segs - P;
  let cum = 0;

  for (let p = 0; p < P; p++) {
    cum += noBend ? 1 : bendScratch[p];
    // the 1e-4 nudge keeps exact ties deterministic across the f64/f32
    // twins: a symmetric route's split lands exactly on an integer, and
    // without it the floor answers 10 or 11 on rounding noise — the CPU
    // flatten and the GPU strip would disagree by one whole subdivision
    route.segEnd[p] = p + 1 + Math.floor((leftover * cum) / total + 1e-4);
  }

  // the final cum equals the total bit-for-bit (same additions), but
  // the multiply/divide can still round below `leftover`: pin the end
  route.segEnd[P - 1] = segs;
  route.pieces = P;
  route.allocSegs = segs;
};

/**
 * Map a subdivision index (0..segs) onto (piece, local t) through the
 * route's bend-weighted map, rebuilding it if it is not current for
 * this `segs` (the evaluators share scratch instances, so `evalRoute`
 * invalidates rather than rebuilds).  The WGSL twin is `quadPieceW`.
 */
export const routeQuadPiece = (
  route: CurveRoute,
  idx: number,
  out: { piece: number; t: number },
  segs: number = CURVE_SEGS,
): void => {
  if (route.allocSegs !== segs) {
    allocRouteQuads(route, segs);
  }

  if (idx >= segs) {
    out.piece = route.pieces - 1;
    out.t = 1;

    return;
  }

  let start = 0;
  let p = 0;

  while (idx >= route.segEnd[p]) {
    start = route.segEnd[p];
    p++;
  }

  out.piece = p;
  out.t = (idx - start) / (route.segEnd[p] - start);
};

/** Sweep from a0 to a1 in the canvas-arc direction (ccw = decreasing). */
export const arcSweep = (a0: number, a1: number, ccw: boolean): number => {
  let d = a1 - a0;

  if (ccw) {
    while (d > 0) {
      d -= 2 * Math.PI;
    }
  } else {
    while (d < 0) {
      d += 2 * Math.PI;
    }
  }

  return d;
};

const quadPieceScratch = { piece: 0, t: 0 };
const cornerScratchA = emptyRouteCorner();
const cornerScratchB = emptyRouteCorner();

/**
 * The route point at subdivision index idx (0..segs) — the exact vertex
 * the strip draws there.  Piece boundaries land on indices, so legs are
 * exact and corners sharp (or exactly the arc) by construction.
 */
export const routeVertex = (
  route: CurveRoute,
  idx: number,
  out: { x: number; y: number },
  segs: number = CURVE_SEGS,
): void => {
  routeQuadPiece(route, idx, quadPieceScratch, segs);

  const p = quadPieceScratch.piece;
  const t = quadPieceScratch.t;

  if (route.kind === CURVE_MULTI) {
    if (route.n === 0) {
      // degenerate: no controls, draw the chord
      out.x = route.qx[0] + (route.qx[1] - route.qx[0]) * t;
      out.y = route.qy[0] + (route.qy[1] - route.qy[0]) * t;

      return;
    }

    // spline piece p: qbez(A, c_p, B) with A/B the inserted midpoints
    const cx = route.qx[p + 1];
    const cy = route.qy[p + 1];
    const ax = p === 0 ? route.qx[0] : (route.qx[p] + cx) / 2;
    const ay = p === 0 ? route.qy[0] : (route.qy[p] + cy) / 2;
    const bx =
      p === route.n - 1 ? route.qx[route.n + 1] : (cx + route.qx[p + 2]) / 2;
    const by =
      p === route.n - 1 ? route.qy[route.n + 1] : (cy + route.qy[p + 2]) / 2;

    out.x = qbezier(ax, cx, bx, t);
    out.y = qbezier(ay, cy, by, t);

    return;
  }

  if (!route.round) {
    // sharp polyline: leg p runs q[p] -> q[p+1]
    out.x = route.qx[p] + (route.qx[p + 1] - route.qx[p]) * t;
    out.y = route.qy[p] + (route.qy[p + 1] - route.qy[p]) * t;

    return;
  }

  // round polyline: pieces alternate leg, arc, leg, ..., leg
  if ((p & 1) === 1) {
    // arc piece for corner j
    const j = (p - 1) / 2;
    const c = routeCorner(route, j, cornerScratchA);

    if (c.r === 0) {
      // collinear corner: stay on the point
      out.x = c.cx;
      out.y = c.cy;

      return;
    }

    const a = c.a0 + arcSweep(c.a0, c.a1, c.ccw) * t;

    out.x = c.cx + Math.cos(a) * c.r;
    out.y = c.cy + Math.sin(a) * c.r;

    return;
  }

  // leg piece j = p/2: corner(j-1).stop -> corner(j).start (route ends at the tips)
  const j = p / 2;
  let ax: number, ay: number, bx: number, by: number;

  if (j === 0) {
    ax = route.qx[0];
    ay = route.qy[0];
  } else {
    const c = routeCorner(route, j - 1, cornerScratchA);

    ax = c.stopX;
    ay = c.stopY;
  }

  if (j === route.n) {
    bx = route.qx[route.n + 1];
    by = route.qy[route.n + 1];
  } else {
    const c = routeCorner(route, j, cornerScratchB);

    bx = c.startX;
    by = c.startY;
  }

  out.x = ax + (bx - ax) * t;
  out.y = ay + (by - ay) * t;
};

/** Flatten the route at the drawn subdivision — 2·(segs + 1) interleaved
 * coords, exactly the strip's vertex centerline. */
export const flattenRoute = (
  route: CurveRoute,
  segs: number = CURVE_SEGS,
): Float64Array => {
  const pts = new Float64Array((segs + 1) * 2);
  const p = { x: 0, y: 0 };

  for (let i = 0; i <= segs; i++) {
    routeVertex(route, i, p, segs);

    pts[i * 2] = p.x;
    pts[i * 2 + 1] = p.y;
  }

  return pts;
};

/**
 * The route midpoint + its tangent direction (v3's rules, verbatim —
 * the label anchor and the autorotate frame):
 * - multibezier, even controls: the inserted midpoint between the two
 *   middle controls; tangent runs between those controls.
 * - multibezier, odd: Q(0.5) of the middle piece; tangent is that
 *   piece's chord.
 * - segments/taxi, even points: the average of the two middle points;
 *   tangent runs between them.
 * - segments/taxi, odd sharp: the middle point; tangent runs into it
 *   from the previous route point.
 * - segments/taxi, odd round: the middle corner's arc apex (center +
 *   radial · r); tangent is the arc tangent there (v3's midVector
 *   perpendicular).  A collinear (radius-0) corner keeps the point,
 *   with the tangent toward the next point.
 */
export const routeMidpoint = (
  route: CurveRoute,
  out: { x: number; y: number; tx: number; ty: number },
): void => {
  const n = route.n;

  if (route.kind === CURVE_MULTI) {
    if (n === 0) {
      out.x = (route.qx[0] + route.qx[1]) / 2;
      out.y = (route.qy[0] + route.qy[1]) / 2;
      out.tx = route.qx[1] - route.qx[0];
      out.ty = route.qy[1] - route.qy[0];

      return;
    }

    if (n % 2 === 0) {
      const i = n / 2; // interior indices i and i+1 are the middle controls

      out.x = (route.qx[i] + route.qx[i + 1]) / 2;
      out.y = (route.qy[i] + route.qy[i + 1]) / 2;
      out.tx = route.qx[i + 1] - route.qx[i];
      out.ty = route.qy[i + 1] - route.qy[i];
    } else {
      const p = (n - 1) / 2;
      const cx = route.qx[p + 1];
      const cy = route.qy[p + 1];
      const ax = p === 0 ? route.qx[0] : (route.qx[p] + cx) / 2;
      const ay = p === 0 ? route.qy[0] : (route.qy[p] + cy) / 2;
      const bx = p === n - 1 ? route.qx[n + 1] : (cx + route.qx[p + 2]) / 2;
      const by = p === n - 1 ? route.qy[n + 1] : (cy + route.qy[p + 2]) / 2;

      out.x = qbezier(ax, cx, bx, 0.5);
      out.y = qbezier(ay, cy, by, 0.5);
      out.tx = bx - ax;
      out.ty = by - ay;
    }

    return;
  }

  // segments / taxi (interior points are the segpts)
  if (n % 2 === 0 && n > 0) {
    const i = n / 2;

    out.x = (route.qx[i] + route.qx[i + 1]) / 2;
    out.y = (route.qy[i] + route.qy[i + 1]) / 2;
    out.tx = route.qx[i + 1] - route.qx[i];
    out.ty = route.qy[i + 1] - route.qy[i];

    return;
  }

  if (n === 0) {
    // no interior points: chord midpoint
    out.x = (route.qx[0] + route.qx[1]) / 2;
    out.y = (route.qy[0] + route.qy[1]) / 2;
    out.tx = route.qx[1] - route.qx[0];
    out.ty = route.qy[1] - route.qy[0];

    return;
  }

  const mid = (n - 1) / 2; // odd n: the middle interior point (0-based)
  const px = route.qx[mid + 1];
  const py = route.qy[mid + 1];

  if (!route.round) {
    out.x = px;
    out.y = py;
    out.tx = px - route.qx[mid];
    out.ty = py - route.qy[mid];

    return;
  }

  const c = routeCorner(route, mid, cornerScratchA);

  if (c.r === 0) {
    // collinear: v3 keeps the point, tangent toward the next
    out.x = px;
    out.y = py;
    out.tx = route.qx[mid + 2] - px;
    out.ty = route.qy[mid + 2] - py;

    return;
  }

  let vx = px - c.cx;
  let vy = py - c.cy;
  const vl = Math.sqrt(vx * vx + vy * vy);

  vx = (vx / vl) * c.r;
  vy = (vy / vl) * c.r;

  out.x = c.cx + vx;
  out.y = c.cy + vy;
  // v3's arrow disp for the round mid: (midVector[1], -midVector[0])
  out.tx = vy;
  out.ty = -vx;
};
