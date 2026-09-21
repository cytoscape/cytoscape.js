import {
  CURVE_BEZIER,
  CURVE_CMPD,
  CURVE_HAS_ENDPT,
  CURVE_LOOP,
  CURVE_MULTI,
  CURVE_SEGMENTS,
  SHAPE_RECTANGLE,
  SHAPE_ROUND_RECTANGLE,
} from '../contract.mjs';

/** quads per curved edge instance — one fixed subdivision for the whole
 * curved stream (one indirect draw needs one indexCount).  Raised 24 → 32
 * in round 93.2, priced on hardware (RX 580): 24 left a many-piece route
 * (5 rounded corners = 11 pieces) ~3 chords per arc — 0.384% v3 mismatch
 * on the close-up probe — while 32 closes it to 0.003% and the 25k-curved
 * scene's device time stays under the frame budget (9.6 → 13.2 ms);
 * 48 measured 25.7 ms device / 33 ms wall (two vsync frames) for no
 * measurable probe gain, so it was declined — the dash arc-length loop
 * is O(CURVE_SEGS²) per edge, so the budget prices superlinearly. */
export const CURVE_SEGS = 32;

/** v3's impossible-bezier guards (edge-control-points.mts). */
export const AVOID_IMPOSSIBLE_BEZIER = 0.01;
export const AVOID_IMPOSSIBLE_BEZIER_L = Math.sqrt(2 * AVOID_IMPOSSIBLE_BEZIER);

/** v3's loop radius factor: ctrl radius = 1.4 × loopDist × (j/3 + 1). */
const LOOP_RADIUS_FACTOR = 1.4;

/**
 * Distance from a node's center to its boundary along the *unit*
 * direction (dx, dy) — the WGSL `boundaryOffset` twin (arrow shader):
 * rectangles and round-rectangles as their box, everything else
 * (circle, ellipse, polygons) as the (inscribed) ellipse.
 */
export const boundaryOffset = (
  shape: number,
  halfW: number,
  halfH: number,
  dx: number,
  dy: number,
): number => {
  if (shape === SHAPE_RECTANGLE || shape === SHAPE_ROUND_RECTANGLE) {
    const ix = halfW / Math.max(Math.abs(dx), 1e-4);
    const iy = halfH / Math.max(Math.abs(dy), 1e-4);

    return Math.min(ix, iy);
  }

  const ex = dx / Math.max(halfW, 1e-4);
  const ey = dy / Math.max(halfH, 1e-4);

  return 1 / Math.max(Math.sqrt(ex * ex + ey * ey), 1e-6);
};

/** The bundled-bezier stagger: the i-th of n bundle members offsets by
 * this (× the pair-orientation sign) from the weighted midpoint. */
export const bundleOffset = (
  n: number,
  i: number,
  stepSize: number,
): number => {
  return (0.5 - n / 2 + i) * stepSize;
};

/** v3's loop-construction angles: the loop opens about loopDir - PI/2,
 * its two control rays loopSweep apart. */
export const loopAngles = (
  loopDir: number,
  loopSweep: number,
): { out: number; in: number } => {
  const loopAngle = loopDir - Math.PI / 2;

  return { out: loopAngle - loopSweep / 2, in: loopAngle + loopSweep / 2 };
};

/** v3's loop control radius for the j-th same-(direction, sweep) loop on a node. */
export const loopRadius = (stepSize: number, j: number): number => {
  return LOOP_RADIUS_FACTOR * stepSize * (j / 3 + 1);
};

/**
 * Per-end arrow shortenings for one edge, in model px (round 56).
 *
 * v3 keeps *two* shortened points per end and they are not the same
 * point: the drawn line stops `gap` behind the node boundary, while the
 * arrow tip sits `spacing` behind it.  Both are supplied by the caller
 * rather than derived here, because the arrow shape and scale live in
 * columns this module deliberately does not read — the same reason the
 * node halves arrive as numbers.
 *
 * The WGSL twins take the same two quantities out of `edge.width`'s
 * lane 1 and compute them with generated copies of `arrowGap` /
 * `arrowSpacing`, so the two sides agree by construction.
 */
export interface ArrowTrim {
  /** where the drawn line stops, behind the source/target boundary */
  srcGap: number;
  tgtGap: number;
  /** where the arrow tip sits, behind the source/target boundary */
  srcSpacing: number;
  tgtSpacing: number;
}

/** The trim of an edge with no heads — every term zero. */
export const NO_ARROW_TRIM: ArrowTrim = Object.freeze({
  srcGap: 0,
  tgtGap: 0,
  srcSpacing: 0,
  tgtSpacing: 0,
});

/**
 * v3's `shortenIntersection`, verbatim including its degenerate clamp:
 * `pt` moved `amount` toward `toward`, never past it.
 *
 * The clamp is not a nicety — a gap larger than the distance to the far
 * point would otherwise flip the line inside out, and v3's own answer
 * (collapse onto `toward`) is what its renderer draws.
 *
 * @param out — receives the shortened point
 * @param px — the point to shorten
 * @param py — the point to shorten
 * @param tx — the point to shorten toward
 * @param ty — the point to shorten toward
 * @param amount — how far to move, in model px
 */
export const shortenToward = (
  out: { x: number; y: number },
  px: number,
  py: number,
  tx: number,
  ty: number,
  amount: number,
): void => {
  const dx = px - tx;
  const dy = py - ty;
  const len = Math.sqrt(dx * dx + dy * dy);
  let ratio = (len - amount) / Math.max(len, 1e-6);

  if (ratio < 0) {
    ratio = 0.00001;
  }

  out.x = tx + dx * ratio;
  out.y = ty + dy * ratio;
};

/** One edge's evaluated curve: endpoints on the node boundaries, the
 * control point(s), and the label-anchor midpoint. */
export interface CurveEval {
  kind: number;
  /** start point (source-boundary) */
  sx: number;
  sy: number;
  /** end point (target-boundary) */
  ex: number;
  ey: number;
  /** control point (bezier), or the loop's first control */
  c1x: number;
  c1y: number;
  /** the loop's second control (loop only) */
  c2x: number;
  c2y: number;
  /** curve midpoint: bezier Q(0.5); loop: the control midpoint */
  mx: number;
  my: number;
  /** the *arrow* points (round 56) — `spacing` behind each boundary,
   * where `sx/sy` and `ex/ey` are `gap` behind it.  v3 keeps both
   * (`rs.arrowStartX/Y` against `rs.startX/Y`) and the public endpoint
   * accessors report these, not the line ends. */
  asx: number;
  asy: number;
  aex: number;
  aey: number;
}

/** A zeroed `CurveEval` for callers to reuse as `evalCurve`'s `out`
 * scratch — the evaluators never allocate on the hot path. */
export const emptyCurveEval = (): CurveEval => ({
  kind: 0,
  sx: 0,
  sy: 0,
  ex: 0,
  ey: 0,
  c1x: 0,
  c1y: 0,
  c2x: 0,
  c2y: 0,
  mx: 0,
  my: 0,
  asx: 0,
  asy: 0,
  aex: 0,
  aey: 0,
});

/**
 * Evaluate one curved edge's geometry from live inputs.  `p0..p2` are the
 * edge.curveParams column values — bezier: [d, w, -]; loop:
 * [outAngle, inAngle, r] — and the node halves are *outer* halves
 * (size/2 + border/2), matching v3's outerWidth/outerHeight frame.
 * The WGSL vertex stage runs this same computation per vertex.
 */
export const evalCurve = (
  out: CurveEval,
  kind: number,
  p0: number,
  p1: number,
  p2: number,
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
): CurveEval => {
  out.kind = kind;

  if (kind === CURVE_CMPD) {
    // v3's findCompoundLoopPoints: two controls off the endpoints' min
    // top-left corner, stretched by ln(outerWidth x 0.01) (min 0.5) to
    // avoid impossible beziers; p0 = loop distance, p1 = bundle index j
    const minX = Math.min(sxC - sHalfW, txC - tHalfW);
    const minY = Math.min(syC - sHalfH, tyC - tHalfH);
    const factor = (1 + Math.pow(50, 1.12) / 100) * p0 * (p1 / 3 + 1);
    const stretchA = Math.max(0.5, Math.log(2 * sHalfW * 0.01));
    const stretchB = Math.max(0.5, Math.log(2 * tHalfW * 0.01));
    const c1x = minX;
    const c1y = minY - factor * stretchA;
    const c2x = minX - factor * stretchB;
    const c2y = minY;

    out.c1x = c1x;
    out.c1y = c1y;
    out.c2x = c2x;
    out.c2y = c2y;
    out.mx = (c1x + c2x) / 2;
    out.my = (c1y + c2y) / 2;

    setBoundaryPoint(
      out,
      false,
      sxC,
      syC,
      sHalfW,
      sHalfH,
      sShape,
      c1x,
      c1y,
      trim.srcGap,
      trim.srcSpacing,
    );
    setBoundaryPoint(
      out,
      true,
      txC,
      tyC,
      tHalfW,
      tHalfH,
      tShape,
      c2x,
      c2y,
      trim.tgtGap,
      trim.tgtSpacing,
    );

    return out;
  }

  if (kind === CURVE_LOOP) {
    // two control points at the stagger radius; the curve is two
    // quadratics through their midpoint (v3's storeAllpts insertion)
    const c1x = sxC + Math.cos(p0) * p2;
    const c1y = syC + Math.sin(p0) * p2;
    const c2x = sxC + Math.cos(p1) * p2;
    const c2y = syC + Math.sin(p1) * p2;

    out.c1x = c1x;
    out.c1y = c1y;
    out.c2x = c2x;
    out.c2y = c2y;
    out.mx = (c1x + c2x) / 2;
    out.my = (c1y + c2y) / 2;

    setBoundaryPoint(
      out,
      false,
      sxC,
      syC,
      sHalfW,
      sHalfH,
      sShape,
      c1x,
      c1y,
      trim.srcGap,
      trim.srcSpacing,
    );
    setBoundaryPoint(
      out,
      true,
      txC,
      tyC,
      tHalfW,
      tHalfH,
      tShape,
      c2x,
      c2y,
      trim.tgtGap,
      trim.tgtSpacing,
    );

    return out;
  }

  // -- bundled bezier (kind === CURVE_BEZIER) --

  // the intersection frame: boundary points along the center line
  let ux = txC - sxC;
  let uy = tyC - syC;
  const uL = Math.max(Math.sqrt(ux * ux + uy * uy), 1e-6);

  ux /= uL;
  uy /= uL;

  const offS = boundaryOffset(sShape, sHalfW, sHalfH, ux, uy);
  const offT = boundaryOffset(tShape, tHalfW, tHalfH, -ux, -uy);
  const six = sxC + ux * offS;
  const siy = syC + uy * offS;
  const tix = txC - ux * offT;
  const tiy = tyC - uy * offT;

  // v3's impossible-bezier length clamp
  const dx = tix - six;
  const dy = tiy - siy;
  let l = Math.sqrt(dx * dx + dy * dy);

  if (!(l >= AVOID_IMPOSSIBLE_BEZIER_L)) {
    l = Math.sqrt(
      Math.max(dx * dx, AVOID_IMPOSSIBLE_BEZIER) +
        Math.max(dy * dy, AVOID_IMPOSSIBLE_BEZIER),
    );
  }

  // ctrl = weighted point between the intersections + perpendicular stagger
  const w2 = p1;
  const w1 = 1 - w2;
  const cx = six * w1 + tix * w2 + (-dy / l) * p0;
  const cy = siy * w1 + tiy * w2 + (dx / l) * p0;

  out.c1x = cx;
  out.c1y = cy;
  out.c2x = cx;
  out.c2y = cy;

  // endpoints on the boundary toward the control point
  setBoundaryPoint(
    out,
    false,
    sxC,
    syC,
    sHalfW,
    sHalfH,
    sShape,
    cx,
    cy,
    trim.srcGap,
    trim.srcSpacing,
  );
  setBoundaryPoint(
    out,
    true,
    txC,
    tyC,
    tHalfW,
    tHalfH,
    tShape,
    cx,
    cy,
    trim.tgtGap,
    trim.tgtSpacing,
  );

  // Q(0.5) — the label anchor
  out.mx = 0.25 * out.sx + 0.5 * cx + 0.25 * out.ex;
  out.my = 0.25 * out.sy + 0.5 * cy + 0.25 * out.ey;

  return out;
};

/**
 * Resolve one end's boundary point and both of v3's shortenings of it
 * (round 56): the line end `gap` behind the boundary, and the arrow tip
 * `spacing` behind it.
 *
 * Both shorten *toward the near control point*, which is v3's own
 * construction (`shortenIntersection( intersect, p1, ... )` where `p1`
 * is the control) — not toward the far node, and not along the curve's
 * arc.  On a straight edge the two coincide; on a bezier they do not,
 * and using the chord there would tilt the trimmed end off the curve.
 */
const setBoundaryPoint = (
  out: CurveEval,
  isEnd: boolean,
  cx: number,
  cy: number,
  halfW: number,
  halfH: number,
  shape: number,
  towardX: number,
  towardY: number,
  gap: number,
  spacing: number,
): void => {
  let dx = towardX - cx;
  let dy = towardY - cy;
  const l = Math.sqrt(dx * dx + dy * dy);

  if (l < 1e-6) {
    dx = 1;
    dy = 0;
  } else {
    dx /= l;
    dy /= l;
  }

  const off = boundaryOffset(shape, halfW, halfH, dx, dy);
  const bx = cx + dx * off;
  const by = cy + dy * off;

  shortenToward(SCRATCH, bx, by, towardX, towardY, gap);

  if (isEnd) {
    out.ex = SCRATCH.x;
    out.ey = SCRATCH.y;
  } else {
    out.sx = SCRATCH.x;
    out.sy = SCRATCH.y;
  }

  shortenToward(SCRATCH, bx, by, towardX, towardY, spacing);

  if (isEnd) {
    out.aex = SCRATCH.x;
    out.aey = SCRATCH.y;
  } else {
    out.asx = SCRATCH.x;
    out.asy = SCRATCH.y;
  }
};

/** module-level scratch — the evaluators never allocate on the hot path */
const SCRATCH = { x: 0, y: 0 };

/** One quadratic bezier coordinate at `t`: `p0` → control `c` → `p1`. */
export const qbezier = (
  p0: number,
  c: number,
  p1: number,
  t: number,
): number => {
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
export const curvePointAt = (
  ev: CurveEval,
  t: number,
  out: { x: number; y: number },
): void => {
  if (ev.kind === CURVE_LOOP || ev.kind === CURVE_CMPD) {
    if (t <= 0.5) {
      const tt = t * 2;

      out.x = qbezier(ev.sx, ev.c1x, ev.mx, tt);
      out.y = qbezier(ev.sy, ev.c1y, ev.my, tt);
    } else {
      const tt = t * 2 - 1;

      out.x = qbezier(ev.mx, ev.c2x, ev.ex, tt);
      out.y = qbezier(ev.my, ev.c2y, ev.ey, tt);
    }
  } else {
    out.x = qbezier(ev.sx, ev.c1x, ev.ex, t);
    out.y = qbezier(ev.sy, ev.c1y, ev.ey, t);
  }
};

/** Flatten the curve into 2·(segs + 1) interleaved coords (the polyline
 * the renderer draws at the same subdivision). */
export const flattenCurve = (
  ev: CurveEval,
  segs: number = CURVE_SEGS,
): Float64Array => {
  const pts = new Float64Array((segs + 1) * 2);
  const p = { x: 0, y: 0 };

  for (let i = 0; i <= segs; i++) {
    curvePointAt(ev, i / segs, p);

    pts[i * 2] = p.x;
    pts[i * 2 + 1] = p.y;
  }

  return pts;
};

/**
 * Exact segment-vs-axis-aligned-rect test (Liang-Barsky) — true when any
 * part of the segment lies inside the box, including a segment wholly
 * inside it and one that crosses without either end being in.
 *
 * The **CPU twin of `segmentHitsViewport`** in `render/cull.mts`, which
 * has run this clip per edge per frame since the first cull pass; round
 * 39.1's overlap box selection needs the same question answered on the
 * CPU, so it is extracted here rather than written a second time.  Keep
 * the two in step: they differ only in that the WGSL grows the rect by a
 * cull margin, which is a caller's job here.
 *
 * @param ax — the segment's first x
 * @param ay — the segment's first y
 * @param bx — the segment's second x
 * @param by — the segment's second y
 * @param lx — the box's low x
 * @param ly — the box's low y
 * @param hx — the box's high x
 * @param hy — the box's high y
 * @returns whether segment and box intersect at all
 */
export const segmentHitsBox = (
  ax: number,
  ay: number,
  bx: number,
  by: number,
  lx: number,
  ly: number,
  hx: number,
  hy: number,
): boolean => {
  const dx = bx - ax;
  const dy = by - ay;
  let t0 = 0;
  let t1 = 1;

  for (let axis = 0; axis < 2; axis++) {
    const d = axis === 0 ? dx : dy;
    const a = axis === 0 ? ax : ay;
    const lo = axis === 0 ? lx : ly;
    const hi = axis === 0 ? hx : hy;

    // parallel to this axis: in or out, no clipping to do.  The epsilon
    // is the WGSL's, so a degenerate (zero-length) segment answers the
    // same on both sides — loops have exactly that chord.
    if (Math.abs(d) < 1e-6) {
      if (a < lo || a > hi) {
        return false;
      }
    } else {
      let tNear = (lo - a) / d;
      let tFar = (hi - a) / d;

      if (tNear > tFar) {
        const t = tNear;
        tNear = tFar;
        tFar = t;
      }

      t0 = Math.max(t0, tNear);
      t1 = Math.min(t1, tFar);

      if (t0 > t1) {
        return false;
      }
    }
  }

  return true;
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
export const curveDeviation = (
  kind: number,
  p0: number,
  p2: number,
): number => {
  if (kind === CURVE_BEZIER) {
    return Math.abs(p0);
  }
  if (kind === CURVE_LOOP) {
    return Math.abs(p2);
  }
  if (kind === CURVE_CMPD) {
    return Math.abs(p2);
  } // the derivation-time excursion bound

  return 0;
};

/**
 * Header-aware conservative deviation (12b): what the params column
 * itself bounds.  Blob-backed hull kinds store their max|d| in the
 * header's [1]; taxi returns 0 — its routes are box-bounded, and
 * callers add the node-half margin (and, for extrapolated weights, the
 * chord length) per FLAG_CURVED_BOX instead.
 */
export const headerDeviation = (
  kind: number,
  p0: number,
  p1: number,
  p2: number,
): number => {
  if (kind === CURVE_CMPD) {
    return Math.abs(p2);
  } // raw kind: above the flag range

  if (kind >= CURVE_HAS_ENDPT) {
    kind -= CURVE_HAS_ENDPT;
  } // 12c endpoint-block kinds

  if (kind === CURVE_BEZIER) {
    return Math.abs(p0);
  }
  if (kind === CURVE_LOOP) {
    return Math.abs(p2);
  }
  if (kind === CURVE_MULTI || kind === CURVE_SEGMENTS) {
    return p1;
  }

  return 0;
};
