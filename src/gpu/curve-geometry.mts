import {
  CURVE_BEZIER, CURVE_LOOP, CURVE_MULTI, CURVE_SEGMENTS, CURVE_TAXI,
  SHAPE_RECTANGLE, SHAPE_ROUND_RECTANGLE
} from './contract.mjs';

/*
Curved-edge geometry (round 12a: bundled bezier + self-loops).

This is the CPU half of the dual-implementation discipline for expensive
GPU geometry (see src/gpu/README.md, "Expensive GPU-computed geometry"):
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
  between them along the perpendicular.  (v3's alternative frames —
  'node-position', 'endpoints' — come with the 12b/12c props.)
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

/** quads per curved edge instance — one fixed subdivision for the whole
 * curved stream (one indirect draw needs one indexCount).  24 keeps the
 * flattening error of typical bundle offsets and loops under ~1 px. */
export const CURVE_SEGS = 24;

/** v3's impossible-bezier guards (edge-control-points.mts). */
export const AVOID_IMPOSSIBLE_BEZIER = 0.01;
export const AVOID_IMPOSSIBLE_BEZIER_L = Math.sqrt( 2 * AVOID_IMPOSSIBLE_BEZIER );

/** v3's loop radius factor: ctrl radius = 1.4 × loopDist × (j/3 + 1). */
const LOOP_RADIUS_FACTOR = 1.4;

/**
 * Distance from a node's center to its boundary along the *unit*
 * direction (dx, dy) — the WGSL `boundaryOffset` twin (arrow shader):
 * rectangles and round-rectangles as their box, everything else
 * (circle, ellipse, polygons) as the (inscribed) ellipse.
 */
export const boundaryOffset = (
  shape: number, halfW: number, halfH: number, dx: number, dy: number
): number => {
  if( shape === SHAPE_RECTANGLE || shape === SHAPE_ROUND_RECTANGLE ){
    const ix = halfW / Math.max( Math.abs( dx ), 1e-4 );
    const iy = halfH / Math.max( Math.abs( dy ), 1e-4 );

    return Math.min( ix, iy );
  }

  const ex = dx / Math.max( halfW, 1e-4 );
  const ey = dy / Math.max( halfH, 1e-4 );

  return 1 / Math.max( Math.sqrt( ex * ex + ey * ey ), 1e-6 );
};

/** The bundled-bezier stagger: the i-th of n bundle members offsets by
 * this (× the pair-orientation sign) from the weighted midpoint. */
export const bundleOffset = ( n: number, i: number, stepSize: number ): number => {
  return ( 0.5 - n / 2 + i ) * stepSize;
};

/** v3's loop-construction angles: the loop opens about loopDir - PI/2,
 * its two control rays loopSweep apart. */
export const loopAngles = ( loopDir: number, loopSweep: number ): { out: number; in: number } => {
  const loopAngle = loopDir - Math.PI / 2;

  return { out: loopAngle - loopSweep / 2, in: loopAngle + loopSweep / 2 };
};

/** v3's loop control radius for the j-th same-(direction, sweep) loop on a node. */
export const loopRadius = ( stepSize: number, j: number ): number => {
  return LOOP_RADIUS_FACTOR * stepSize * ( j / 3 + 1 );
};

/** One edge's evaluated curve: endpoints on the node boundaries, the
 * control point(s), and the label-anchor midpoint. */
export interface CurveEval {
  kind: number;
  /** start point (source-boundary) */
  sx: number; sy: number;
  /** end point (target-boundary) */
  ex: number; ey: number;
  /** control point (bezier), or the loop's first control */
  c1x: number; c1y: number;
  /** the loop's second control (loop only) */
  c2x: number; c2y: number;
  /** curve midpoint: bezier Q(0.5); loop: the control midpoint */
  mx: number; my: number;
}

export const emptyCurveEval = (): CurveEval => ( {
  kind: 0, sx: 0, sy: 0, ex: 0, ey: 0, c1x: 0, c1y: 0, c2x: 0, c2y: 0, mx: 0, my: 0
} );

/**
 * Evaluate one curved edge's geometry from live inputs.  `p0..p2` are the
 * edge.curveParams column values — bezier: [d, w, -]; loop:
 * [outAngle, inAngle, r] — and the node halves are *outer* halves
 * (size/2 + border/2), matching v3's outerWidth/outerHeight frame.
 * The WGSL vertex stage runs this same computation per vertex.
 */
export const evalCurve = (
  out: CurveEval, kind: number, p0: number, p1: number, p2: number,
  sxC: number, syC: number, sHalfW: number, sHalfH: number, sShape: number,
  txC: number, tyC: number, tHalfW: number, tHalfH: number, tShape: number
): CurveEval => {
  out.kind = kind;

  if( kind === CURVE_LOOP ){
    // two control points at the stagger radius; the curve is two
    // quadratics through their midpoint (v3's storeAllpts insertion)
    const c1x = sxC + Math.cos( p0 ) * p2;
    const c1y = syC + Math.sin( p0 ) * p2;
    const c2x = sxC + Math.cos( p1 ) * p2;
    const c2y = syC + Math.sin( p1 ) * p2;

    out.c1x = c1x;
    out.c1y = c1y;
    out.c2x = c2x;
    out.c2y = c2y;
    out.mx = ( c1x + c2x ) / 2;
    out.my = ( c1y + c2y ) / 2;

    setBoundaryPoint( out, false, sxC, syC, sHalfW, sHalfH, sShape, c1x, c1y );
    setBoundaryPoint( out, true, txC, tyC, tHalfW, tHalfH, tShape, c2x, c2y );

    return out;
  }

  // -- bundled bezier (kind === CURVE_BEZIER) --

  // the intersection frame: boundary points along the center line
  let ux = txC - sxC;
  let uy = tyC - syC;
  const uL = Math.max( Math.sqrt( ux * ux + uy * uy ), 1e-6 );

  ux /= uL;
  uy /= uL;

  const offS = boundaryOffset( sShape, sHalfW, sHalfH, ux, uy );
  const offT = boundaryOffset( tShape, tHalfW, tHalfH, -ux, -uy );
  const six = sxC + ux * offS;
  const siy = syC + uy * offS;
  const tix = txC - ux * offT;
  const tiy = tyC - uy * offT;

  // v3's impossible-bezier length clamp
  const dx = tix - six;
  const dy = tiy - siy;
  let l = Math.sqrt( dx * dx + dy * dy );

  if( !( l >= AVOID_IMPOSSIBLE_BEZIER_L ) ){
    l = Math.sqrt(
      Math.max( dx * dx, AVOID_IMPOSSIBLE_BEZIER ) + Math.max( dy * dy, AVOID_IMPOSSIBLE_BEZIER )
    );
  }

  // ctrl = weighted point between the intersections + perpendicular stagger
  const w2 = p1;
  const w1 = 1 - w2;
  const cx = ( six * w1 + tix * w2 ) + ( -dy / l ) * p0;
  const cy = ( siy * w1 + tiy * w2 ) + ( dx / l ) * p0;

  out.c1x = cx;
  out.c1y = cy;
  out.c2x = cx;
  out.c2y = cy;

  // endpoints on the boundary toward the control point
  setBoundaryPoint( out, false, sxC, syC, sHalfW, sHalfH, sShape, cx, cy );
  setBoundaryPoint( out, true, txC, tyC, tHalfW, tHalfH, tShape, cx, cy );

  // Q(0.5) — the label anchor
  out.mx = 0.25 * out.sx + 0.5 * cx + 0.25 * out.ex;
  out.my = 0.25 * out.sy + 0.5 * cy + 0.25 * out.ey;

  return out;
};

const setBoundaryPoint = (
  out: CurveEval, isEnd: boolean,
  cx: number, cy: number, halfW: number, halfH: number, shape: number,
  towardX: number, towardY: number
): void => {
  let dx = towardX - cx;
  let dy = towardY - cy;
  const l = Math.sqrt( dx * dx + dy * dy );

  if( l < 1e-6 ){
    dx = 1;
    dy = 0;
  } else {
    dx /= l;
    dy /= l;
  }

  const off = boundaryOffset( shape, halfW, halfH, dx, dy );

  if( isEnd ){
    out.ex = cx + dx * off;
    out.ey = cy + dy * off;
  } else {
    out.sx = cx + dx * off;
    out.sy = cy + dy * off;
  }
};

const qbezier = ( p0: number, c: number, p1: number, t: number ): number => {
  const s = 1 - t;

  return s * s * p0 + 2 * s * t * c + t * t * p1;
};

/**
 * The curve point at global parameter t in [0, 1] — bezier: one
 * quadratic; loop: two quadratics through the control midpoint, split at
 * t = 0.5.  The WGSL vertex stage evaluates the same mapping at
 * t = (segment + corner) / CURVE_SEGS, so a CPU flatten at the same K
 * reproduces the drawn polyline exactly.
 */
export const curvePointAt = ( ev: CurveEval, t: number, out: { x: number; y: number } ): void => {
  if( ev.kind === CURVE_LOOP ){
    if( t <= 0.5 ){
      const tt = t * 2;

      out.x = qbezier( ev.sx, ev.c1x, ev.mx, tt );
      out.y = qbezier( ev.sy, ev.c1y, ev.my, tt );
    } else {
      const tt = t * 2 - 1;

      out.x = qbezier( ev.mx, ev.c2x, ev.ex, tt );
      out.y = qbezier( ev.my, ev.c2y, ev.ey, tt );
    }
  } else {
    out.x = qbezier( ev.sx, ev.c1x, ev.ex, t );
    out.y = qbezier( ev.sy, ev.c1y, ev.ey, t );
  }
};

/** Flatten the curve into 2·(segs + 1) interleaved coords (the polyline
 * the renderer draws at the same subdivision). */
export const flattenCurve = ( ev: CurveEval, segs: number = CURVE_SEGS ): Float64Array => {
  const pts = new Float64Array( ( segs + 1 ) * 2 );
  const p = { x: 0, y: 0 };

  for( let i = 0; i <= segs; i++ ){
    curvePointAt( ev, i / segs, p );

    pts[ i * 2 ] = p.x;
    pts[ i * 2 + 1 ] = p.y;
  }

  return pts;
};

/**
 * Conservative bound on how far the curve can stray from the segment
 * between its endpoint node centers, straight from the params (no
 * geometry eval): the quadratic lies in the convex hull of its
 * endpoints and control(s) — a bezier's control is |d| off the center
 * segment, a loop's controls are r from the center.  Curve *endpoints*
 * sit on the node boundary, so consumers add the node half-extent
 * separately where it isn't already covered.
 */
export const curveDeviation = ( kind: number, p0: number, p2: number ): number => {
  if( kind === CURVE_BEZIER ){ return Math.abs( p0 ); }
  if( kind === CURVE_LOOP ){ return Math.abs( p2 ); }

  return 0;
};

/**
 * Header-aware conservative deviation (12b): what the params column
 * itself bounds.  Blob-backed hull kinds store their max|d| in the
 * header's [1]; taxi returns 0 — its routes are box-bounded, and
 * callers add the node-half margin (and, for extrapolated weights, the
 * chord length) per FLAG_CURVED_BOX instead.
 */
export const headerDeviation = ( kind: number, p0: number, p1: number, p2: number ): number => {
  if( kind === CURVE_BEZIER ){ return Math.abs( p0 ); }
  if( kind === CURVE_LOOP ){ return Math.abs( p2 ); }
  if( kind === CURVE_MULTI || kind === CURVE_SEGMENTS ){ return p1; }

  return 0;
};

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
quads (one indirect draw needs one indexCount), and `quadPiece` maps
subdivision indices onto the route's pieces so that piece boundaries
land exactly on subdivision indices — straight legs stay pixel-straight
and sharp corners stay sharp regardless of how the quads distribute.
That requires pieces ≤ CURVE_SEGS, so the interior point counts are
capped (MAX_MULTI_CTRL controls, MAX_CURVE_PTS segment points) — a
recorded deviation from v3's unbounded lists; derivation clamps with a
console warning.
*/

/** interior-point caps: keep every route piece ≥ 1 quad of CURVE_SEGS
 * (round segments spend 2n+1 pieces on n points), with enough quads per
 * multibezier piece to stay smooth. */
export const MAX_MULTI_CTRL = 8;
export const MAX_CURVE_PTS = 11;

/** edge-distances modes as stored in the blob records. */
export const EDGE_DIST_INTERSECTION = 0;
export const EDGE_DIST_NODE_POSITION = 1;

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
}

export const emptyCurveRoute = (): CurveRoute => ( {
  kind: 0,
  n: 0,
  qx: new Float64Array( MAX_CURVE_PTS + 2 ),
  qy: new Float64Array( MAX_CURVE_PTS + 2 ),
  round: false,
  radius: new Float64Array( MAX_CURVE_PTS ),
  arcMode: new Uint8Array( MAX_CURVE_PTS )
} );

/** The intersection frame shared by MULTI and SEGMENTS (and the 12a
 * bundled bezier): boundary points along the center line + the
 * perpendicular unit normal with v3's impossible-bezier clamp. */
const frameScratch = { six: 0, siy: 0, tix: 0, tiy: 0, nx: 0, ny: 0 };

const computeFrame = (
  sxC: number, syC: number, sHalfW: number, sHalfH: number, sShape: number,
  txC: number, tyC: number, tHalfW: number, tHalfH: number, tShape: number
): typeof frameScratch => {
  let ux = txC - sxC;
  let uy = tyC - syC;
  const uL = Math.max( Math.sqrt( ux * ux + uy * uy ), 1e-6 );

  ux /= uL;
  uy /= uL;

  const offS = boundaryOffset( sShape, sHalfW, sHalfH, ux, uy );
  const offT = boundaryOffset( tShape, tHalfW, tHalfH, -ux, -uy );

  frameScratch.six = sxC + ux * offS;
  frameScratch.siy = syC + uy * offS;
  frameScratch.tix = txC - ux * offT;
  frameScratch.tiy = tyC - uy * offT;

  const dx = frameScratch.tix - frameScratch.six;
  const dy = frameScratch.tiy - frameScratch.siy;
  let l = Math.sqrt( dx * dx + dy * dy );

  if( !( l >= AVOID_IMPOSSIBLE_BEZIER_L ) ){
    l = Math.sqrt(
      Math.max( dx * dx, AVOID_IMPOSSIBLE_BEZIER ) + Math.max( dy * dy, AVOID_IMPOSSIBLE_BEZIER )
    );
  }

  frameScratch.nx = -dy / l;
  frameScratch.ny = dx / l;

  return frameScratch;
};

/** v3's subDWH: take the effective node body away from the delta. */
const subDWH = ( dxy: number, dwh: number ): number => {
  return dxy > 0 ? Math.max( dxy - dwh, 0 ) : Math.min( dxy + dwh, 0 );
};

/**
 * Evaluate a route-family edge from live inputs.  `blob` is the curve
 * param blob, `off`/`n` the edge's record offset and interior count from
 * the params-column header (n is unused for taxi — the routing derives
 * its own points).  Node halves are the *outer* halves (the
 * node.outerHalf column), matching v3's outerWidth/outerHeight frame.
 */
export const evalRoute = (
  out: CurveRoute, kind: number,
  blob: ArrayLike<number>, off: number, n: number,
  sxC: number, syC: number, sHalfW: number, sHalfH: number, sShape: number,
  txC: number, tyC: number, tHalfW: number, tHalfH: number, tShape: number
): CurveRoute => {
  out.kind = kind;
  out.round = false;

  if( kind === CURVE_MULTI || kind === CURVE_SEGMENTS ){
    const mode = blob[ off ];
    const f = computeFrame(
      sxC, syC, sHalfW, sHalfH, sShape, txC, tyC, tHalfW, tHalfH, tShape );
    // 'node-position' measures between the centers but keeps the
    // intersection-frame normal (v3's reused vectorNormInverse)
    const bx1 = mode === EDGE_DIST_NODE_POSITION ? sxC : f.six;
    const by1 = mode === EDGE_DIST_NODE_POSITION ? syC : f.siy;
    const bx2 = mode === EDGE_DIST_NODE_POSITION ? txC : f.tix;
    const by2 = mode === EDGE_DIST_NODE_POSITION ? tyC : f.tiy;

    if( kind === CURVE_MULTI ){
      for( let b = 0; b < n; b++ ){
        const d = blob[ off + 1 + b * 2 ];
        const w = blob[ off + 2 + b * 2 ];

        out.qx[ b + 1 ] = ( bx1 * ( 1 - w ) + bx2 * w ) + f.nx * d;
        out.qy[ b + 1 ] = ( by1 * ( 1 - w ) + by2 * w ) + f.ny * d;
      }
    } else {
      out.round = blob[ off + 1 ] !== 0;

      for( let s = 0; s < n; s++ ){
        const d = blob[ off + 2 + s * 4 ];
        const w = blob[ off + 3 + s * 4 ];

        out.qx[ s + 1 ] = ( bx1 * ( 1 - w ) + bx2 * w ) + f.nx * d;
        out.qy[ s + 1 ] = ( by1 * ( 1 - w ) + by2 * w ) + f.ny * d;
        out.radius[ s ] = blob[ off + 4 + s * 4 ];
        out.arcMode[ s ] = blob[ off + 5 + s * 4 ] !== 0 ? 1 : 0;
      }
    }

    out.n = n;
  } else if( kind === CURVE_TAXI ){
    evalTaxi( out, blob, off,
      sxC, syC, sHalfW, sHalfH, txC, tyC, tHalfW, tHalfH );
  }

  // endpoints on the node boundaries toward the first/last interior point
  const qn = out.n + 2;
  const s = setRouteBoundary(
    sxC, syC, sHalfW, sHalfH, sShape, out.qx[ 1 ], out.qy[ 1 ] );

  out.qx[ 0 ] = s.x;
  out.qy[ 0 ] = s.y;

  const e = setRouteBoundary(
    txC, tyC, tHalfW, tHalfH, tShape, out.qx[ qn - 2 ], out.qy[ qn - 2 ] );

  out.qx[ qn - 1 ] = e.x;
  out.qy[ qn - 1 ] = e.y;

  return out;
};

const boundaryScratch = { x: 0, y: 0 };

const setRouteBoundary = (
  cx: number, cy: number, halfW: number, halfH: number, shape: number,
  towardX: number, towardY: number
): { x: number; y: number } => {
  let dx = towardX - cx;
  let dy = towardY - cy;
  const l = Math.sqrt( dx * dx + dy * dy );

  if( l < 1e-6 ){
    dx = 1;
    dy = 0;
  } else {
    dx /= l;
    dy /= l;
  }

  const off = boundaryOffset( shape, halfW, halfH, dx, dy );

  boundaryScratch.x = cx + dx * off;
  boundaryScratch.y = cy + dy * off;

  return boundaryScratch;
};

/** v3's findTaxiPoints, verbatim (blob record: dir, turn, turnIsPercent,
 * minD, bodyMode, round, radius, arcMode). */
const evalTaxi = (
  out: CurveRoute, blob: ArrayLike<number>, off: number,
  sxC: number, syC: number, sHalfW: number, sHalfH: number,
  txC: number, tyC: number, tHalfW: number, tHalfH: number
): void => {
  const rawDir = blob[ off ];
  const turnVal = blob[ off + 1 ];
  const turnIsPercent = blob[ off + 2 ] !== 0;
  const minD = blob[ off + 3 ];
  const dIncludesNodeBody = blob[ off + 4 ] !== EDGE_DIST_NODE_POSITION;
  const round = blob[ off + 5 ] !== 0;
  const radiusVal = blob[ off + 6 ];
  const arcFlag = blob[ off + 7 ] !== 0 ? 1 : 0;

  const srcW = sHalfW * 2;
  const srcH = sHalfH * 2;
  const tgtW = tHalfW * 2;
  const tgtH = tHalfH * 2;

  const turnIsNegative = turnVal < 0;
  const dw = dIncludesNodeBody ? ( srcW + tgtW ) / 2 : 0;
  const dh = dIncludesNodeBody ? ( srcH + tgtH ) / 2 : 0;
  const pdx = txC - sxC;
  const pdy = tyC - syC;
  const dx = subDWH( pdx, dw );
  const dy = subDWH( pdy, dh );

  let isVert: boolean;
  let isExplicitDir = false;

  if( rawDir === TAXI_AUTO ){
    isVert = !( Math.abs( dx ) > Math.abs( dy ) );
  } else if( rawDir === TAXI_UPWARD || rawDir === TAXI_DOWNWARD ){
    isVert = true;
    isExplicitDir = true;
  } else if( rawDir === TAXI_LEFTWARD || rawDir === TAXI_RIGHTWARD ){
    isVert = false;
    isExplicitDir = true;
  } else {
    isVert = rawDir === TAXI_VERTICAL;
  }

  let l = isVert ? dy : dx;
  const pl = isVert ? pdy : pdx;
  let sgnL = Math.sign( pl );

  let forcedDir = false;

  if(
    !( isExplicitDir && ( turnIsPercent || turnIsNegative ) ) &&
    (
      ( rawDir === TAXI_DOWNWARD && pl < 0 ) ||
      ( rawDir === TAXI_UPWARD && pl > 0 ) ||
      ( rawDir === TAXI_LEFTWARD && pl > 0 ) ||
      ( rawDir === TAXI_RIGHTWARD && pl < 0 )
    )
  ){
    sgnL *= -1;
    l = sgnL * Math.abs( l );
    forcedDir = true;
  }

  let d: number;

  if( turnIsPercent ){
    const p = turnVal < 0 ? 1 + turnVal : turnVal;

    d = p * l;
  } else {
    const k = turnVal < 0 ? l : 0;

    d = k + turnVal * sgnL;
  }

  const isTooClose = ( v: number ): boolean => Math.abs( v ) < minD || Math.abs( v ) >= Math.abs( l );
  const tooClose = isTooClose( d ) || isTooClose( Math.abs( l ) - Math.abs( d ) );

  if( tooClose && !forcedDir ){ // non-ideal routing: Z- and L-shape fallbacks
    if( isVert ){
      const lShapeInsideSrc = Math.abs( pl ) <= srcH / 2;
      const lShapeInsideTgt = Math.abs( pdx ) <= tgtW / 2;

      if( lShapeInsideSrc ){ // horizontal Z-shape
        const x = ( sxC + txC ) / 2;

        out.n = 2;
        out.qx[ 1 ] = x; out.qy[ 1 ] = syC;
        out.qx[ 2 ] = x; out.qy[ 2 ] = tyC;
      } else if( lShapeInsideTgt ){ // vertical Z-shape
        const y = ( syC + tyC ) / 2;

        out.n = 2;
        out.qx[ 1 ] = sxC; out.qy[ 1 ] = y;
        out.qx[ 2 ] = txC; out.qy[ 2 ] = y;
      } else { // L-shape
        out.n = 1;
        out.qx[ 1 ] = sxC; out.qy[ 1 ] = tyC;
      }
    } else {
      const lShapeInsideSrc = Math.abs( pl ) <= srcW / 2;
      const lShapeInsideTgt = Math.abs( pdy ) <= tgtH / 2;

      if( lShapeInsideSrc ){ // vertical Z-shape
        const y = ( syC + tyC ) / 2;

        out.n = 2;
        out.qx[ 1 ] = sxC; out.qy[ 1 ] = y;
        out.qx[ 2 ] = txC; out.qy[ 2 ] = y;
      } else if( lShapeInsideTgt ){ // horizontal Z-shape
        const x = ( sxC + txC ) / 2;

        out.n = 2;
        out.qx[ 1 ] = x; out.qy[ 1 ] = syC;
        out.qx[ 2 ] = x; out.qy[ 2 ] = tyC;
      } else { // L-shape
        out.n = 1;
        out.qx[ 1 ] = txC; out.qy[ 1 ] = syC;
      }
    }
  } else { // ideal routing
    if( isVert ){
      const y = syC + d + ( dIncludesNodeBody ? srcH / 2 * sgnL : 0 );

      out.n = 2;
      out.qx[ 1 ] = sxC; out.qy[ 1 ] = y;
      out.qx[ 2 ] = txC; out.qy[ 2 ] = y;
    } else {
      const x = sxC + d + ( dIncludesNodeBody ? srcW / 2 * sgnL : 0 );

      out.n = 2;
      out.qx[ 1 ] = x; out.qy[ 1 ] = syC;
      out.qx[ 2 ] = x; out.qy[ 2 ] = tyC;
    }
  }

  out.round = round;

  if( round ){
    for( let i = 0; i < out.n; i++ ){
      out.radius[ i ] = radiusVal;
      out.arcMode[ i ] = arcFlag;
    }
  }
};

/** A round corner: the arc replacing an interior route point. */
export interface RouteCorner {
  cx: number; cy: number;
  r: number;
  startX: number; startY: number;
  stopX: number; stopY: number;
  a0: number; a1: number;
  /** canvas-arc counterclockwise flag (v3's drawDirection) */
  ccw: boolean;
}

export const emptyRouteCorner = (): RouteCorner => ( {
  cx: 0, cy: 0, r: 0, startX: 0, startY: 0, stopX: 0, stopY: 0, a0: 0, a1: 0, ccw: false
} );

/**
 * v3's getRoundCorner (src/round.mts) as a pure function — identical
 * numbers, none of the module-level scratch state.  `radiusMax` is the
 * per-point radius; `isArc` selects 'arc-radius' (the radius is the
 * arc's, clamped to fit) vs 'influence-radius' (the radius caps the
 * cut-back distance along the legs).
 */
export const computeCorner = (
  out: RouteCorner,
  prevX: number, prevY: number, curX: number, curY: number,
  nextX: number, nextY: number, radiusMax: number, isArc: boolean
): RouteCorner => {
  if( radiusMax === 0 ){
    out.cx = curX; out.cy = curY;
    out.r = 0;
    out.startX = curX; out.startY = curY;
    out.stopX = curX; out.stopY = curY;
    out.a0 = 0; out.a1 = 0;
    out.ccw = false;

    return out;
  }

  // vectors from the corner toward its neighbours (v3's asVec)
  const v1x = prevX - curX;
  const v1y = prevY - curY;
  const v1l = Math.sqrt( v1x * v1x + v1y * v1y );
  const v1nx = v1x / v1l;
  const v1ny = v1y / v1l;
  const v2x = nextX - curX;
  const v2y = nextY - curY;
  const v2l = Math.sqrt( v2x * v2x + v2y * v2y );
  const v2nx = v2x / v2l;
  const v2ny = v2y / v2l;

  const sinA = v1nx * v2ny - v1ny * v2nx;
  const sinA90 = v1nx * v2nx - v1ny * -v2ny;
  let angle = Math.asin( Math.max( -1, Math.min( 1, sinA ) ) );

  if( Math.abs( angle ) < 1e-6 ){ // collinear: no arc
    out.cx = curX; out.cy = curY;
    out.r = 0;
    out.startX = curX; out.startY = curY;
    out.stopX = curX; out.stopY = curY;
    out.a0 = 0; out.a1 = 0;
    out.ccw = false;

    return out;
  }

  let radDirection = 1;
  let drawDirection = false;

  if( sinA90 < 0 ){
    if( angle < 0 ){
      angle = Math.PI + angle;
    } else {
      angle = Math.PI - angle;
      radDirection = -1;
      drawDirection = true;
    }
  } else if( angle > 0 ){
    radDirection = -1;
    drawDirection = true;
  }

  const halfAngle = angle / 2;
  const limit = Math.min( v1l / 2, v2l / 2 );
  let lenOut: number;
  let cRadius: number;

  if( isArc ){
    lenOut = Math.abs( Math.cos( halfAngle ) * radiusMax / Math.sin( halfAngle ) );

    if( lenOut > limit ){
      lenOut = limit;
      cRadius = Math.abs( lenOut * Math.sin( halfAngle ) / Math.cos( halfAngle ) );
    } else {
      cRadius = radiusMax;
    }
  } else {
    lenOut = Math.min( limit, radiusMax );
    cRadius = Math.abs( lenOut * Math.sin( halfAngle ) / Math.cos( halfAngle ) );
  }

  out.stopX = curX + v2nx * lenOut;
  out.stopY = curY + v2ny * lenOut;
  out.cx = out.stopX - v2ny * cRadius * radDirection;
  out.cy = out.stopY + v2nx * cRadius * radDirection;
  out.startX = curX + v1nx * lenOut;
  out.startY = curY + v1ny * lenOut;
  out.r = cRadius;
  out.a0 = Math.atan2( v1ny, v1nx ) + Math.PI / 2 * radDirection;
  out.a1 = Math.atan2( v2ny, v2nx ) - Math.PI / 2 * radDirection;
  out.ccw = drawDirection;

  return out;
};

/** The corner at interior point j of a round route (raw polyline
 * neighbours, as v3 uses them — adjacent arcs can't overlap because
 * lenOut clamps at half of each leg). */
export const routeCorner = ( route: CurveRoute, j: number, out: RouteCorner ): RouteCorner => {
  return computeCorner(
    out,
    route.qx[ j ], route.qy[ j ],
    route.qx[ j + 1 ], route.qy[ j + 1 ],
    route.qx[ j + 2 ], route.qy[ j + 2 ],
    route.radius[ j ], route.arcMode[ j ] === 1
  );
};

/** Pieces the drawn strip must cover: multibezier has one quadratic per
 * control; polylines one leg per span, with an arc between legs when
 * round. */
export const routePieceCount = ( route: CurveRoute ): number => {
  if( route.kind === CURVE_MULTI ){ return Math.max( route.n, 1 ); }

  return route.round ? 2 * route.n + 1 : route.n + 1;
};

/**
 * Map a subdivision index (0..segs) onto (piece, local t): quads
 * distribute as evenly as integers allow (the first `segs % P` pieces
 * get one extra), and every piece boundary lands exactly on a
 * subdivision index.  Requires P ≤ segs (the derivation caps interior
 * counts to guarantee it).  The WGSL twin implements the same closed
 * form.
 */
export const quadPiece = (
  pieces: number, segs: number, idx: number, out: { piece: number; t: number }
): void => {
  if( idx >= segs ){
    out.piece = pieces - 1;
    out.t = 1;

    return;
  }

  const base = Math.floor( segs / pieces );
  const extra = segs % pieces;
  const threshold = ( base + 1 ) * extra;

  if( idx < threshold ){
    const piece = Math.floor( idx / ( base + 1 ) );

    out.piece = piece;
    out.t = ( idx - piece * ( base + 1 ) ) / ( base + 1 );
  } else {
    const j = idx - threshold;
    const piece = extra + Math.floor( j / base );

    out.piece = piece;
    out.t = ( j - ( piece - extra ) * base ) / base;
  }
};

/** Sweep from a0 to a1 in the canvas-arc direction (ccw = decreasing). */
export const arcSweep = ( a0: number, a1: number, ccw: boolean ): number => {
  let d = a1 - a0;

  if( ccw ){
    while( d > 0 ){ d -= 2 * Math.PI; }
  } else {
    while( d < 0 ){ d += 2 * Math.PI; }
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
  route: CurveRoute, idx: number, out: { x: number; y: number }, segs: number = CURVE_SEGS
): void => {
  const P = routePieceCount( route );

  quadPiece( P, segs, idx, quadPieceScratch );

  const p = quadPieceScratch.piece;
  const t = quadPieceScratch.t;

  if( route.kind === CURVE_MULTI ){
    if( route.n === 0 ){ // degenerate: no controls, draw the chord
      out.x = route.qx[ 0 ] + ( route.qx[ 1 ] - route.qx[ 0 ] ) * t;
      out.y = route.qy[ 0 ] + ( route.qy[ 1 ] - route.qy[ 0 ] ) * t;

      return;
    }

    // spline piece p: qbez(A, c_p, B) with A/B the inserted midpoints
    const cx = route.qx[ p + 1 ];
    const cy = route.qy[ p + 1 ];
    const ax = p === 0 ? route.qx[ 0 ] : ( route.qx[ p ] + cx ) / 2;
    const ay = p === 0 ? route.qy[ 0 ] : ( route.qy[ p ] + cy ) / 2;
    const bx = p === route.n - 1 ? route.qx[ route.n + 1 ] : ( cx + route.qx[ p + 2 ] ) / 2;
    const by = p === route.n - 1 ? route.qy[ route.n + 1 ] : ( cy + route.qy[ p + 2 ] ) / 2;

    out.x = qbezier( ax, cx, bx, t );
    out.y = qbezier( ay, cy, by, t );

    return;
  }

  if( !route.round ){ // sharp polyline: leg p runs q[p] -> q[p+1]
    out.x = route.qx[ p ] + ( route.qx[ p + 1 ] - route.qx[ p ] ) * t;
    out.y = route.qy[ p ] + ( route.qy[ p + 1 ] - route.qy[ p ] ) * t;

    return;
  }

  // round polyline: pieces alternate leg, arc, leg, ..., leg
  if( ( p & 1 ) === 1 ){ // arc piece for corner j
    const j = ( p - 1 ) / 2;
    const c = routeCorner( route, j, cornerScratchA );

    if( c.r === 0 ){ // collinear corner: stay on the point
      out.x = c.cx;
      out.y = c.cy;

      return;
    }

    const a = c.a0 + arcSweep( c.a0, c.a1, c.ccw ) * t;

    out.x = c.cx + Math.cos( a ) * c.r;
    out.y = c.cy + Math.sin( a ) * c.r;

    return;
  }

  // leg piece j = p/2: corner(j-1).stop -> corner(j).start (route ends at the tips)
  const j = p / 2;
  let ax: number, ay: number, bx: number, by: number;

  if( j === 0 ){
    ax = route.qx[ 0 ];
    ay = route.qy[ 0 ];
  } else {
    const c = routeCorner( route, j - 1, cornerScratchA );

    ax = c.stopX;
    ay = c.stopY;
  }

  if( j === route.n ){
    bx = route.qx[ route.n + 1 ];
    by = route.qy[ route.n + 1 ];
  } else {
    const c = routeCorner( route, j, cornerScratchB );

    bx = c.startX;
    by = c.startY;
  }

  out.x = ax + ( bx - ax ) * t;
  out.y = ay + ( by - ay ) * t;
};

/** Flatten the route at the drawn subdivision — 2·(segs + 1) interleaved
 * coords, exactly the strip's vertex centerline. */
export const flattenRoute = ( route: CurveRoute, segs: number = CURVE_SEGS ): Float64Array => {
  const pts = new Float64Array( ( segs + 1 ) * 2 );
  const p = { x: 0, y: 0 };

  for( let i = 0; i <= segs; i++ ){
    routeVertex( route, i, p, segs );

    pts[ i * 2 ] = p.x;
    pts[ i * 2 + 1 ] = p.y;
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
  route: CurveRoute, out: { x: number; y: number; tx: number; ty: number }
): void => {
  const n = route.n;

  if( route.kind === CURVE_MULTI ){
    if( n === 0 ){
      out.x = ( route.qx[ 0 ] + route.qx[ 1 ] ) / 2;
      out.y = ( route.qy[ 0 ] + route.qy[ 1 ] ) / 2;
      out.tx = route.qx[ 1 ] - route.qx[ 0 ];
      out.ty = route.qy[ 1 ] - route.qy[ 0 ];

      return;
    }

    if( n % 2 === 0 ){
      const i = n / 2; // interior indices i and i+1 are the middle controls

      out.x = ( route.qx[ i ] + route.qx[ i + 1 ] ) / 2;
      out.y = ( route.qy[ i ] + route.qy[ i + 1 ] ) / 2;
      out.tx = route.qx[ i + 1 ] - route.qx[ i ];
      out.ty = route.qy[ i + 1 ] - route.qy[ i ];
    } else {
      const p = ( n - 1 ) / 2;
      const cx = route.qx[ p + 1 ];
      const cy = route.qy[ p + 1 ];
      const ax = p === 0 ? route.qx[ 0 ] : ( route.qx[ p ] + cx ) / 2;
      const ay = p === 0 ? route.qy[ 0 ] : ( route.qy[ p ] + cy ) / 2;
      const bx = p === n - 1 ? route.qx[ n + 1 ] : ( cx + route.qx[ p + 2 ] ) / 2;
      const by = p === n - 1 ? route.qy[ n + 1 ] : ( cy + route.qy[ p + 2 ] ) / 2;

      out.x = qbezier( ax, cx, bx, 0.5 );
      out.y = qbezier( ay, cy, by, 0.5 );
      out.tx = bx - ax;
      out.ty = by - ay;
    }

    return;
  }

  // segments / taxi (interior points are the segpts)
  if( n % 2 === 0 && n > 0 ){
    const i = n / 2;

    out.x = ( route.qx[ i ] + route.qx[ i + 1 ] ) / 2;
    out.y = ( route.qy[ i ] + route.qy[ i + 1 ] ) / 2;
    out.tx = route.qx[ i + 1 ] - route.qx[ i ];
    out.ty = route.qy[ i + 1 ] - route.qy[ i ];

    return;
  }

  if( n === 0 ){ // no interior points: chord midpoint
    out.x = ( route.qx[ 0 ] + route.qx[ 1 ] ) / 2;
    out.y = ( route.qy[ 0 ] + route.qy[ 1 ] ) / 2;
    out.tx = route.qx[ 1 ] - route.qx[ 0 ];
    out.ty = route.qy[ 1 ] - route.qy[ 0 ];

    return;
  }

  const mid = ( n - 1 ) / 2; // odd n: the middle interior point (0-based)
  const px = route.qx[ mid + 1 ];
  const py = route.qy[ mid + 1 ];

  if( !route.round ){
    out.x = px;
    out.y = py;
    out.tx = px - route.qx[ mid ];
    out.ty = py - route.qy[ mid ];

    return;
  }

  const c = routeCorner( route, mid, cornerScratchA );

  if( c.r === 0 ){ // collinear: v3 keeps the point, tangent toward the next
    out.x = px;
    out.y = py;
    out.tx = route.qx[ mid + 2 ] - px;
    out.ty = route.qy[ mid + 2 ] - py;

    return;
  }

  let vx = px - c.cx;
  let vy = py - c.cy;
  const vl = Math.sqrt( vx * vx + vy * vy );

  vx = vx / vl * c.r;
  vy = vy / vl * c.r;

  out.x = c.cx + vx;
  out.y = c.cy + vy;
  // v3's arrow disp for the round mid: (midVector[1], -midVector[0])
  out.tx = vy;
  out.ty = -vx;
};
