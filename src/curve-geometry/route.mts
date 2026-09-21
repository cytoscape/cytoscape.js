import {
  CURVE_HAS_ENDPT,
  CURVE_MULTI,
  CURVE_SEGMENTS,
  CURVE_TAXI,
} from '../contract.mjs';
import {
  AVOID_IMPOSSIBLE_BEZIER,
  AVOID_IMPOSSIBLE_BEZIER_L,
  boundaryOffset,
  NO_ARROW_TRIM,
  shortenToward,
} from './bezier.mjs';
import type { ArrowTrim } from './bezier.mjs';
import { setRouteBoundary, evalTaxi } from './taxi.mjs';

/*
Round 12b — the route families: unbundled bezier (CURVE_MULTI),
segments / round-segments (CURVE_SEGMENTS) and taxi / round-taxi
(CURVE_TAXI).  Same dual-implementation discipline as above: the WGSL
route functions in render/shaders.mts mirror these step for step on the
same inputs (live positions, the outerHalf/shape columns, the curve
param blob) — change the math here and in the WGSL together.

The math is v3's, ported verbatim:

- The *frame* per edge-distances: 'intersection' (default) measures the
  weighted base point between the node-boundary intersection points;
  'node-position' between the node centers.  The perpendicular unit
  normal always comes from the intersection frame (v3 computes
  vectorNormInverse once, from the intersections, and reuses it for
  'node-position' — a quirk kept for parity).  'endpoints' needs the
  12c manual endpoints and falls back to 'intersection' with a warning
  at style time, exactly as v3 warns.
- Unbundled bezier: control point b = lerp(frame, w_b) + normal · d_b;
  the drawn curve is v3's multibezier spline — one quadratic per
  control, joined C1 through the inserted midpoints between consecutive
  controls (v3's storeAllpts).
- Segments: segment point s = lerp(frame, w_s) + normal · d_s; round
  variants replace each interior corner with the arc of v3's
  getRoundCorner (src/round.mts), ported here as the pure
  `computeCorner` (identical numbers, none of v3's module-level state).
- Taxi: v3's findTaxiPoints verbatim — auto/explicit direction, percent
  or px turns (negative = from the target side), the
  taxi-turn-min-distance clamps and their Z-/L-shape fallbacks, node
  body offsets per edge-distances.

The drawn subdivision: every curved edge is one strip of CURVE_SEGS
quads (one indirect draw needs one indexCount), and `routeQuadPiece`
maps subdivision indices onto the route's pieces so that piece
boundaries land exactly on subdivision indices — straight legs stay
pixel-straight and sharp corners stay sharp regardless of how the quads
distribute.  That requires pieces ≤ CURVE_SEGS, so the interior point
counts are capped (MAX_MULTI_CTRL controls, MAX_CURVE_PTS segment
points) — a recorded deviation from v3's unbounded lists; derivation
clamps with a console warning.

Round 93: the quads distribute by **bend**, not uniformly.  Each piece
gets one mandatory quad (a straight leg needs exactly one), and the
leftover budget splits proportionally to each piece's tangent turn — an
arc piece by its sweep angle (π minus the interior angle between its
legs), a multibezier piece by the turn between its control legs, a
straight leg zero — so a 90° round-taxi corner gets ~20 chords instead
of the 3–8 the uniform split left it beside pixel-straight legs.  A
route with no bend at all (sharp polylines) keeps a uniform split.  The
allocation is a pure function of the evaluated route, so it stays
canonical per subdivision index (the watertight-strip rule), and it is
computed lazily on the first map read because the evaluators share
scratch instances (`evalRoute` invalidates `allocSegs`).
*/

/** interior-point caps: keep every route piece ≥ 1 quad of CURVE_SEGS
 * (round segments spend 2n+1 pieces on n points), with enough quads per
 * multibezier piece to stay smooth. */
export const MAX_MULTI_CTRL = 8;
export const MAX_CURVE_PTS = 11;

/** the most pieces any route can have: round routes spend 2n+1 pieces
 * on n interior points (leg, arc, leg, ..., leg). */
export const MAX_ROUTE_PIECES = 2 * MAX_CURVE_PTS + 1;

/** edge-distances modes as stored in the blob records. */
export const EDGE_DIST_INTERSECTION = 0;
export const EDGE_DIST_NODE_POSITION = 1;
/** 12c: frame between the resolved manual endpoints (v3 requires both
 * ends manual — the derivation enforces it and falls back with v3's
 * warning otherwise). */
export const EDGE_DIST_ENDPOINTS = 2;

/*
Round 12c — manual endpoints, haystack, straight-triangle.

`source/target-endpoint` and `source/target-distance-from-node` resolve
through a fixed 10-float *endpoint block* prefixed to a blob record
whose kind carries the CURVE_HAS_ENDPT flag:

  [0] srcMode  [1] srcA  [2] srcB  [3] srcPctBits  [4] srcDist
  [5] tgtMode  [6] tgtA  [7] tgtB  [8] tgtPctBits  [9] tgtDist

Modes are v3's `edgeEndpoint` forms: DEFAULT = outside-to-node (the
existing boundary-toward-interior), INSIDE = the node center, LINE =
outside-to-line (the intersection-frame boundary point along the
center line), POINT = a coordinate pair (A, B in model px, or — per
the pct bits — fractions of the node's outer width/height, v3's `%`
units), ANGLE = a ray from the center (A = the effective angle in
radians, v3's 12-o'clock start already folded in at parse time).
The `-or-label` keywords need the label bounding box v4 doesn't have —
they throw at parse time (a recorded deviation, deferred to the
label-bb round).  Distances shorten the resolved point toward the
near interior anchor by v3's `shortenIntersection` rule (clamped so
the point never passes the anchor).

v3 scope quirks kept: taxi forces the endpoint *keywords* to
outside-to-node (distances still apply), and self-loops override
endpoints entirely (v4 additionally ignores loop distances — a
recorded deviation).  A bundled bezier with manual endpoints promotes
to CURVE_MULTI n = 1 (the control formula is identical), and a
straight edge with manual endpoints derives as CURVE_MULTI n = 0 —
the route degenerates to the chord between the resolved endpoints.

Haystack endpoints offset by (cos/sin(angle) · outerHalf · radius)
inside each node body; the angles are a hash of the edge's id (stable
across runs and machines — v3 uses Math.random(), so haystack scenes
are only *statistically* comparable to v3).  v4 scales by the outer
halves where v3 uses the inner size — identical at the default border
width 0, a recorded deviation otherwise.
*/

export const ENDPT_DEFAULT = 0;
export const ENDPT_INSIDE = 1;
export const ENDPT_LINE = 2;
export const ENDPT_POINT = 3;
export const ENDPT_ANGLE = 4;
export const ENDPT_BLOCK_FLOATS = 10;
/** pct bits for ENDPT_POINT: A/B are fractions of outer width/height */
export const ENDPT_PCT_X = 1;
export const ENDPT_PCT_Y = 2;

/** taxi-direction ids as stored in the blob record. */
export const TAXI_AUTO = 0;
export const TAXI_VERTICAL = 1;
export const TAXI_HORIZONTAL = 2;
export const TAXI_UPWARD = 3;
export const TAXI_DOWNWARD = 4;
export const TAXI_LEFTWARD = 5;
export const TAXI_RIGHTWARD = 6;

/**
 * One evaluated route: the two boundary endpoints plus the interior
 * points (multibezier: the control points; segments/taxi: the segment
 * points), stored as q[0] = start, q[1..n] = interior, q[n+1] = end.
 * Round variants carry a radius + arc-mode per interior point.
 */
export interface CurveRoute {
  kind: number;
  /** interior point count */
  n: number;
  qx: Float64Array;
  qy: Float64Array;
  round: boolean;
  radius: Float64Array;
  arcMode: Uint8Array;
  /** the *arrow* points (round 56): `spacing` behind each resolved
   * endpoint, where `q[0]`/`q[n+1]` are `gap` behind it. */
  asx: number;
  asy: number;
  aex: number;
  aey: number;
  /** round 93: the bend-weighted subdivision map — the piece count and
   * the cumulative piece end indices (`segEnd[p]` = the first
   * subdivision index after piece p) at the `allocSegs` the map was
   * built for.  `allocSegs` 0 means not built: `evalRoute` invalidates
   * it (the evaluators share scratch instances) and `routeQuadPiece`
   * rebuilds on first read. */
  pieces: number;
  allocSegs: number;
  segEnd: Uint8Array;
}

/** A zeroed `CurveRoute` for callers to reuse as an `out` scratch.  Its
 * typed arrays are sized for `MAX_CURVE_PTS` interior points once, so a
 * single instance serves every route the evaluators produce. */
export const emptyCurveRoute = (): CurveRoute => ({
  kind: 0,
  n: 0,
  qx: new Float64Array(MAX_CURVE_PTS + 2),
  qy: new Float64Array(MAX_CURVE_PTS + 2),
  round: false,
  radius: new Float64Array(MAX_CURVE_PTS),
  arcMode: new Uint8Array(MAX_CURVE_PTS),
  asx: 0,
  asy: 0,
  aex: 0,
  aey: 0,
  pieces: 0,
  allocSegs: 0,
  segEnd: new Uint8Array(MAX_ROUTE_PIECES),
});

/** The intersection frame shared by MULTI and SEGMENTS (and the 12a
 * bundled bezier): boundary points along the center line + the
 * perpendicular unit normal with v3's impossible-bezier clamp. */
const frameScratch = { six: 0, siy: 0, tix: 0, tiy: 0, nx: 0, ny: 0 };

const computeFrame = (
  sxC: number,
  syC: number,
  sHalfW: number,
  sHalfH: number,
  sShape: number,
  txC: number,
  tyC: number,
  tHalfW: number,
  tHalfH: number,
  tShape: number,
): typeof frameScratch => {
  let ux = txC - sxC;
  let uy = tyC - syC;
  const uL = Math.max(Math.sqrt(ux * ux + uy * uy), 1e-6);

  ux /= uL;
  uy /= uL;

  const offS = boundaryOffset(sShape, sHalfW, sHalfH, ux, uy);
  const offT = boundaryOffset(tShape, tHalfW, tHalfH, -ux, -uy);

  frameScratch.six = sxC + ux * offS;
  frameScratch.siy = syC + uy * offS;
  frameScratch.tix = txC - ux * offT;
  frameScratch.tiy = tyC - uy * offT;

  const dx = frameScratch.tix - frameScratch.six;
  const dy = frameScratch.tiy - frameScratch.siy;
  let l = Math.sqrt(dx * dx + dy * dy);

  if (!(l >= AVOID_IMPOSSIBLE_BEZIER_L)) {
    l = Math.sqrt(
      Math.max(dx * dx, AVOID_IMPOSSIBLE_BEZIER) +
        Math.max(dy * dy, AVOID_IMPOSSIBLE_BEZIER),
    );
  }

  frameScratch.nx = -dy / l;
  frameScratch.ny = dx / l;

  return frameScratch;
};

/** v3's subDWH: take the effective node body away from the delta. */
export const subDWH = (dxy: number, dwh: number): number => {
  return dxy > 0 ? Math.max(dxy - dwh, 0) : Math.min(dxy + dwh, 0);
};

/**
 * Evaluate a route-family edge from live inputs.  `blob` is the curve
 * param blob, `off`/`n` the edge's record offset and interior count from
 * the params-column header (for taxi, whose routing derives its own
 * points, the n lane carries the px turn of a `taxi-turn: auto` edge —
 * round 124's track).  Node halves are the *outer* halves (the
 * node.outerHalf column), matching v3's outerWidth/outerHeight frame.
 */
export const evalRoute = (
  out: CurveRoute,
  kind: number,
  blob: ArrayLike<number>,
  off: number,
  n: number,
  sxC: number,
  syC: number,
  sHalfW: number,
  sHalfH: number,
  sShape: number,
  txC: number,
  tyC: number,
  tHalfW: number,
  tHalfH: number,
  tShape: number,
  trim: ArrowTrim = NO_ARROW_TRIM,
): CurveRoute => {
  const hasEndpt = kind >= CURVE_HAS_ENDPT;
  const base = hasEndpt ? kind - CURVE_HAS_ENDPT : kind;
  const body = hasEndpt ? off + ENDPT_BLOCK_FLOATS : off;

  out.kind = base;
  out.round = false;
  out.n = 0;
  out.allocSegs = 0; // round 93: the subdivision map follows the new route

  // the intersection-frame boundary points (kept for ENDPT_LINE)
  let fSix = 0,
    fSiy = 0,
    fTix = 0,
    fTiy = 0;

  if (base === CURVE_MULTI || base === CURVE_SEGMENTS) {
    const mode = blob[body];
    const f = computeFrame(
      sxC,
      syC,
      sHalfW,
      sHalfH,
      sShape,
      txC,
      tyC,
      tHalfW,
      tHalfH,
      tShape,
    );

    fSix = f.six;
    fSiy = f.siy;
    fTix = f.tix;
    fTiy = f.tiy;

    // 'node-position' measures between the centers but keeps the
    // intersection-frame normal (v3's reused vectorNormInverse);
    // 'endpoints' (12c) measures between the raw manual anchors and
    // recomputes the normal from them (v3's recalcVectorNormInverse)
    let bx1 = mode === EDGE_DIST_NODE_POSITION ? sxC : f.six;
    let by1 = mode === EDGE_DIST_NODE_POSITION ? syC : f.siy;
    let bx2 = mode === EDGE_DIST_NODE_POSITION ? txC : f.tix;
    let by2 = mode === EDGE_DIST_NODE_POSITION ? tyC : f.tiy;
    let nx = f.nx;
    let ny = f.ny;

    if (mode === EDGE_DIST_ENDPOINTS && hasEndpt) {
      rawEndpointAnchor(
        blob,
        off,
        false,
        sxC,
        syC,
        sHalfW,
        sHalfH,
        sShape,
        anchorScratch,
      );
      bx1 = anchorScratch.x;
      by1 = anchorScratch.y;
      rawEndpointAnchor(
        blob,
        off,
        true,
        txC,
        tyC,
        tHalfW,
        tHalfH,
        tShape,
        anchorScratch,
      );
      bx2 = anchorScratch.x;
      by2 = anchorScratch.y;

      const dx = bx2 - bx1;
      const dy = by2 - by1;
      const l = Math.max(Math.sqrt(dx * dx + dy * dy), 1e-6); // v3 divides raw (NaN at 0)

      nx = -dy / l;
      ny = dx / l;
    }

    if (base === CURVE_MULTI) {
      for (let b = 0; b < n; b++) {
        const d = blob[body + 1 + b * 2];
        const w = blob[body + 2 + b * 2];

        out.qx[b + 1] = bx1 * (1 - w) + bx2 * w + nx * d;
        out.qy[b + 1] = by1 * (1 - w) + by2 * w + ny * d;
      }
    } else {
      out.round = blob[body + 1] !== 0;

      for (let s = 0; s < n; s++) {
        const d = blob[body + 2 + s * 4];
        const w = blob[body + 3 + s * 4];

        out.qx[s + 1] = bx1 * (1 - w) + bx2 * w + nx * d;
        out.qy[s + 1] = by1 * (1 - w) + by2 * w + ny * d;
        out.radius[s] = blob[body + 4 + s * 4];
        out.arcMode[s] = blob[body + 5 + s * 4] !== 0 ? 1 : 0;
      }
    }

    out.n = n;
  } else if (base === CURVE_TAXI) {
    evalTaxi(
      out,
      blob,
      body,
      n, // the track lane (124): the px turn of a `taxi-turn: auto` edge
      sxC,
      syC,
      sHalfW,
      sHalfH,
      txC,
      tyC,
      tHalfW,
      tHalfH,
    );
  }

  const qn = out.n + 2;
  // each end shortens *toward* its aim point, which is the near interior
  // route point — v3's `shortenIntersection( intersect, p1, ... )`
  let sAimX: number, sAimY: number, tAimX: number, tAimY: number;

  if (!hasEndpt) {
    // endpoints on the node boundaries toward the first/last interior point
    sAimX = out.qx[1];
    sAimY = out.qy[1];
    tAimX = out.qx[qn - 2];
    tAimY = out.qy[qn - 2];

    const s = setRouteBoundary(sxC, syC, sHalfW, sHalfH, sShape, sAimX, sAimY);

    out.qx[0] = s.x;
    out.qy[0] = s.y;

    const e = setRouteBoundary(txC, tyC, tHalfW, tHalfH, tShape, tAimX, tAimY);

    out.qx[qn - 1] = e.x;
    out.qy[qn - 1] = e.y;
  } else {
    // 12c: resolve each end through its endpoint-block entry.  The "aim"
    // is the near interior point; with no interior points (n = 0, the
    // straight-with-endpoints chord) each end aims at the *other end's
    // raw anchor* (v3's lines path: tgtPos + tgtManEndptPt et al.)
    if (out.n > 0) {
      sAimX = out.qx[1];
      sAimY = out.qy[1];
      tAimX = out.qx[qn - 2];
      tAimY = out.qy[qn - 2];
    } else {
      rawEndpointAnchor(
        blob,
        off,
        true,
        txC,
        tyC,
        tHalfW,
        tHalfH,
        tShape,
        anchorScratch,
      );
      sAimX = anchorScratch.x;
      sAimY = anchorScratch.y;
      rawEndpointAnchor(
        blob,
        off,
        false,
        sxC,
        syC,
        sHalfW,
        sHalfH,
        sShape,
        anchorScratch,
      );
      tAimX = anchorScratch.x;
      tAimY = anchorScratch.y;
    }

    resolveEndpoint(
      blob,
      off,
      false,
      sxC,
      syC,
      sHalfW,
      sHalfH,
      sShape,
      sAimX,
      sAimY,
      fSix,
      fSiy,
      anchorScratch,
    );
    out.qx[0] = anchorScratch.x;
    out.qy[0] = anchorScratch.y;

    resolveEndpoint(
      blob,
      off,
      true,
      txC,
      tyC,
      tHalfW,
      tHalfH,
      tShape,
      tAimX,
      tAimY,
      fTix,
      fTiy,
      anchorScratch,
    );
    out.qx[qn - 1] = anchorScratch.x;
    out.qy[qn - 1] = anchorScratch.y;
  }

  // Round 56: v3's two shortenings, applied to whichever endpoints the
  // branches above resolved.  The *arrow* points are recorded separately
  // and the route's own ends move by the gap, because v3's `storeAllpts`
  // builds the drawn path from the gap-shortened points — so a head
  // shortens the route itself, and everything derived from it (the
  // midpoint, the flattened bound) follows.  The 12c distance shortening
  // has already been applied by `resolveEndpoint`; these compose, exactly
  // as v3's `gap( edge ) + tgtDist` does.
  shortenToward(
    anchorScratch,
    out.qx[0],
    out.qy[0],
    sAimX,
    sAimY,
    trim.srcSpacing,
  );
  out.asx = anchorScratch.x;
  out.asy = anchorScratch.y;

  shortenToward(
    anchorScratch,
    out.qx[qn - 1],
    out.qy[qn - 1],
    tAimX,
    tAimY,
    trim.tgtSpacing,
  );
  out.aex = anchorScratch.x;
  out.aey = anchorScratch.y;

  shortenToward(anchorScratch, out.qx[0], out.qy[0], sAimX, sAimY, trim.srcGap);
  out.qx[0] = anchorScratch.x;
  out.qy[0] = anchorScratch.y;

  shortenToward(
    anchorScratch,
    out.qx[qn - 1],
    out.qy[qn - 1],
    tAimX,
    tAimY,
    trim.tgtGap,
  );
  out.qx[qn - 1] = anchorScratch.x;
  out.qy[qn - 1] = anchorScratch.y;

  return out;
};

const anchorScratch = { x: 0, y: 0 };

/**
 * The *raw* anchor of an endpoint-block entry — what the other pieces
 * of the geometry aim at before boundary/shorten resolution: the manual
 * point for ENDPT_POINT, the ray's boundary point for ENDPT_ANGLE
 * (v3's manualEndptToPx), and the node center otherwise.
 */
export const rawEndpointAnchor = (
  blob: ArrayLike<number>,
  off: number,
  isTarget: boolean,
  cx: number,
  cy: number,
  halfW: number,
  halfH: number,
  shape: number,
  out: { x: number; y: number },
): void => {
  const at = isTarget ? off + 5 : off;
  const mode = blob[at];

  if (mode === ENDPT_POINT) {
    const bits = blob[at + 3];

    out.x = cx + blob[at + 1] * (bits % 2 === 1 ? 2 * halfW : 1);
    out.y = cy + blob[at + 2] * (bits >= ENDPT_PCT_Y ? 2 * halfH : 1);

    return;
  }

  if (mode === ENDPT_ANGLE) {
    const a = blob[at + 1];
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const bOff = boundaryOffset(shape, halfW, halfH, dx, dy);

    out.x = cx + dx * bOff;
    out.y = cy + dy * bOff;

    return;
  }

  out.x = cx;
  out.y = cy;
};

/**
 * Resolve one end through its endpoint-block entry: the mode picks the
 * raw point (boundary-toward-aim for DEFAULT, center for INSIDE, the
 * intersection-frame point for LINE, the manual point/ray otherwise),
 * then `distance-from-node` shortens it toward the aim by v3's
 * shortenIntersection rule (clamped so it never passes the aim).
 */
export const resolveEndpoint = (
  blob: ArrayLike<number>,
  off: number,
  isTarget: boolean,
  cx: number,
  cy: number,
  halfW: number,
  halfH: number,
  shape: number,
  aimX: number,
  aimY: number,
  frameX: number,
  frameY: number,
  out: { x: number; y: number },
): void => {
  const at = isTarget ? off + 5 : off;
  const mode = blob[at];
  const dist = blob[at + 4];

  if (mode === ENDPT_INSIDE) {
    out.x = cx;
    out.y = cy;
  } else if (mode === ENDPT_LINE) {
    out.x = frameX;
    out.y = frameY;
  } else if (mode === ENDPT_POINT || mode === ENDPT_ANGLE) {
    rawEndpointAnchor(blob, off, isTarget, cx, cy, halfW, halfH, shape, out);
  } else {
    const b = setRouteBoundary(cx, cy, halfW, halfH, shape, aimX, aimY);

    out.x = b.x;
    out.y = b.y;
  }

  if (dist !== 0) {
    // v3's shortenIntersection: p = aim + max((len - d)/len, 1e-5)·(p - aim)
    const dx = out.x - aimX;
    const dy = out.y - aimY;
    const l = Math.sqrt(dx * dx + dy * dy);

    if (l > 0) {
      let ratio = (l - dist) / l;

      if (ratio < 0) {
        ratio = 0.00001;
      }

      out.x = aimX + ratio * dx;
      out.y = aimY + ratio * dy;
    }
  }
};

/**
 * A haystack endpoint (12c): the hash-stable offset point inside the
 * node body — center + (cos/sin(angle) · outerHalf · radius).  The WGSL
 * twin in the straight edge shader computes the same point.
 */
export const haystackPoint = (
  cx: number,
  cy: number,
  halfW: number,
  halfH: number,
  angle: number,
  radius: number,
  out: { x: number; y: number },
): void => {
  out.x = cx + Math.cos(angle) * halfW * radius;
  out.y = cy + Math.sin(angle) * halfH * radius;
};

/**
 * The hash-stable haystack angle for one end of an edge, from the
 * edge's id hash (stable across sessions and machines, unlike v3's
 * Math.random()): a Wang-style integer mix folded to [0, 2π).
 */
export const haystackAngle = (idHash: number, isTarget: boolean): number => {
  let h = (idHash ^ (isTarget ? 0x9e3779b9 : 0x85ebca6b)) >>> 0;

  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;

  return (h / 4294967296) * 2 * Math.PI;
};
