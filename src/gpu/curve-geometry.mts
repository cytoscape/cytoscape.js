import { CURVE_BEZIER, CURVE_LOOP, SHAPE_RECTANGLE, SHAPE_ROUND_RECTANGLE } from './contract.mjs';

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
