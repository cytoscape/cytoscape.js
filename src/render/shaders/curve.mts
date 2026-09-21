import { wgsl } from '../wgsl.mjs';
import {
  AVOID_IMPOSSIBLE_BEZIER,
  AVOID_IMPOSSIBLE_BEZIER_L,
  CURVE_SEGS,
  MAX_CURVE_PTS,
  MAX_ROUTE_PIECES,
} from '../../curve-geometry.mjs';

/**
 * Curved-edge geometry (round 12a) — the WGSL twin of
 * curve-geometry.mts, evaluated per vertex from live endpoint positions,
 * node geometry columns and the per-edge curve params, so curves follow
 * drags/layouts/position tweens on-GPU with zero rebuild.  Change the
 * math here and in curve-geometry.mts together.  Requires BOUNDARY_WGSL.
 */
export const CURVE_WGSL = wgsl`
const CURVE_SEGS_F: f32 = ${CURVE_SEGS}.0;
const AVOID_BEZ: f32 = ${AVOID_IMPOSSIBLE_BEZIER};
const AVOID_BEZ_L: f32 = ${AVOID_IMPOSSIBLE_BEZIER_L.toFixed(9)};

struct CurveGeom {
  s: vec2f,   // start point (source boundary)
  e: vec2f,   // end point (target boundary)
  c1: vec2f,  // control point (bezier), or the loop's first control
  c2: vec2f,  // the loop's second control (loops; == c1 for bezier)
  m: vec2f,   // curve midpoint (bezier Q(0.5); loop control midpoint)
  aS: vec2f,  // 56: the source arrow point (spacing behind the boundary)
  aE: vec2f,  // 56: the target arrow point
  kind: f32,
}

fn curveBoundaryPoint(c: vec2f, half: vec2f, shape: u32, toward: vec2f) -> vec2f {
  var d = toward - c;
  let l = length(d);

  if (l < 1e-6) { d = vec2f(1.0, 0.0); } else { d = d / l; }

  return c + d * boundaryOffset(shape, half, d);
}

// setBoundaryPoint's twin (round 56): the boundary point shortened by
// 'amount' toward the near control, which is v3's own construction.
fn curveBoundaryShortened(
  c: vec2f, half: vec2f, shape: u32, toward: vec2f, amount: f32
) -> vec2f {
  return shortenTowardW(curveBoundaryPoint(c, half, shape, toward), toward, amount);
}

fn evalCurveGeom(
  params: vec4f,
  sC: vec2f, sHalf: vec2f, sShape: u32,
  tC: vec2f, tHalf: vec2f, tShape: u32,
  trim: vec4f
) -> CurveGeom {
  var g: CurveGeom;

  g.kind = params.w;

  if (params.w == 2.0) { // loop: two control rays from the node center
    let c1 = sC + vec2f(cos(params.x), sin(params.x)) * params.z;
    let c2 = sC + vec2f(cos(params.y), sin(params.y)) * params.z;

    g.c1 = c1;
    g.c2 = c2;
    g.m = (c1 + c2) * 0.5;
    g.s = curveBoundaryShortened(sC, sHalf, sShape, c1, trim.x);
    g.e = curveBoundaryShortened(tC, tHalf, tShape, c2, trim.y);
    g.aS = curveBoundaryShortened(sC, sHalf, sShape, c1, trim.z);
    g.aE = curveBoundaryShortened(tC, tHalf, tShape, c2, trim.w);

    return g;
  }

  if (params.w == 16.0) { // compound loop (14.10): v3's findCompoundLoopPoints
    // two controls off the endpoints' min top-left corner, stretched by
    // ln(outerWidth x 0.01) (min 0.5); params.x = loop distance,
    // params.y = bundle index j — the CPU twin is evalCurve's CMPD branch
    let minC = min(sC - sHalf, tC - tHalf);
    let factor = (1.0 + pow(50.0, 1.12) / 100.0) * params.x * (params.y / 3.0 + 1.0);
    let stretchA = max(0.5, log(2.0 * sHalf.x * 0.01));
    let stretchB = max(0.5, log(2.0 * tHalf.x * 0.01));
    let c1 = vec2f(minC.x, minC.y - factor * stretchA);
    let c2 = vec2f(minC.x - factor * stretchB, minC.y);

    g.c1 = c1;
    g.c2 = c2;
    g.m = (c1 + c2) * 0.5;
    g.s = curveBoundaryShortened(sC, sHalf, sShape, c1, trim.x);
    g.e = curveBoundaryShortened(tC, tHalf, tShape, c2, trim.y);
    g.aS = curveBoundaryShortened(sC, sHalf, sShape, c1, trim.z);
    g.aE = curveBoundaryShortened(tC, tHalf, tShape, c2, trim.w);

    return g;
  }

  // bundled bezier: the intersection frame + weighted midpoint + stagger
  var u = tC - sC;
  let uL = max(length(u), 1e-6);

  u = u / uL;

  let si = sC + u * boundaryOffset(sShape, sHalf, u);
  let ti = tC - u * boundaryOffset(tShape, tHalf, -u);
  let d = ti - si;
  var l = length(d);

  if (!(l >= AVOID_BEZ_L)) { // v3's impossible-bezier clamp
    l = sqrt(max(d.x * d.x, AVOID_BEZ) + max(d.y * d.y, AVOID_BEZ));
  }

  let c = mix(si, ti, params.y) + vec2f(-d.y / l, d.x / l) * params.x;

  g.c1 = c;
  g.c2 = c;
  g.s = curveBoundaryShortened(sC, sHalf, sShape, c, trim.x);
  g.e = curveBoundaryShortened(tC, tHalf, tShape, c, trim.y);
  g.aS = curveBoundaryShortened(sC, sHalf, sShape, c, trim.z);
  g.aE = curveBoundaryShortened(tC, tHalf, tShape, c, trim.w);
  g.m = 0.25 * g.s + 0.5 * c + 0.25 * g.e;

  return g;
}

fn qbez(p0: vec2f, c: vec2f, p1: vec2f, t: f32) -> vec2f {
  let s = 1.0 - t;

  return s * s * p0 + 2.0 * s * t * c + t * t * p1;
}

fn qbezTangent(p0: vec2f, c: vec2f, p1: vec2f, t: f32) -> vec2f {
  return 2.0 * ((1.0 - t) * (c - p0) + t * (p1 - c));
}

// global t in [0,1]: bezier is one quadratic; a loop is two C1 quadratics
// through the control midpoint, split at t = 0.5 (v3's allpts insertion)
fn curvePoint(g: CurveGeom, t: f32) -> vec2f {
  if (g.kind == 2.0 || g.kind == 16.0) {
    if (t <= 0.5) { return qbez(g.s, g.c1, g.m, t * 2.0); }
    return qbez(g.m, g.c2, g.e, t * 2.0 - 1.0);
  }
  return qbez(g.s, g.c1, g.e, t);
}

fn curveTangentAt(g: CurveGeom, t: f32) -> vec2f {
  if (g.kind == 2.0 || g.kind == 16.0) {
    if (t <= 0.5) { return qbezTangent(g.s, g.c1, g.m, t * 2.0); }
    return qbezTangent(g.m, g.c2, g.e, t * 2.0 - 1.0);
  }
  return qbezTangent(g.s, g.c1, g.e, t);
}
`;

/**
 * Route-family geometry (round 12b) — the WGSL twin of the CurveRoute
 * evaluator in curve-geometry.mts: unbundled bezier (kind 3), segments /
 * round-segments (kind 4) and taxi / round-taxi (kind 5), evaluated per
 * vertex from live positions + the params-column header + the curve
 * param blob (a `curveBlob: array<f32>` binding the including shader
 * declares).  Same formulas, same piece allocator, same corner math —
 * change here and in curve-geometry.mts together.  Requires
 * BOUNDARY_WGSL + CURVE_WGSL (boundary points, AVOID_BEZ, qbez).
 */
export const ROUTE_WGSL = wgsl`
const CURVE_SEGS_U: u32 = ${CURVE_SEGS}u;
const MAX_ROUTE_PTS: u32 = ${MAX_CURVE_PTS}u;
const MAX_ROUTE_PIECES_W: u32 = ${MAX_ROUTE_PIECES}u;
// below this total bend a route counts as straight (uniform split)
const BEND_EPS: f32 = 1e-4;
const ROUTE_PI: f32 = 3.14159265358979;
// 12c manual endpoints: kinds >= 8 prefix their blob record with the
// 10-float endpoint block [mode, a, b, pctBits, dist] x 2 (see
// curve-geometry.mts — the CPU twin reads the same layout)
const ENDPT_BLOCK_F: u32 = 10u;
const ENDPT_INSIDE_W: f32 = 1.0;
const ENDPT_LINE_W: f32 = 2.0;
const ENDPT_POINT_W: f32 = 3.0;
const ENDPT_ANGLE_W: f32 = 4.0;

// the raw anchor of an endpoint-block entry: the manual point for the
// point form, the ray's boundary point for the angle form, else the
// node center (rawEndpointAnchor's twin)
fn rawEndptAnchorW(off: u32, isTgt: bool, c: vec2f, half: vec2f, shape: u32) -> vec2f {
  let at = select(off, off + 5u, isTgt);
  let mode = curveBlob[at];

  if (mode == ENDPT_POINT_W) {
    let bits = curveBlob[at + 3u];
    let sx = select(1.0, 2.0 * half.x, (u32(bits) & 1u) != 0u);
    let sy = select(1.0, 2.0 * half.y, (u32(bits) & 2u) != 0u);

    return c + vec2f(curveBlob[at + 1u] * sx, curveBlob[at + 2u] * sy);
  }

  if (mode == ENDPT_ANGLE_W) {
    let d = vec2f(cos(curveBlob[at + 1u]), sin(curveBlob[at + 1u]));

    return c + d * boundaryOffset(shape, half, d);
  }

  return c;
}

// resolveEndpoint's twin: mode-pick + the distance shorten toward the aim
fn resolveEndptW(
  off: u32, isTgt: bool, c: vec2f, half: vec2f, shape: u32, aim: vec2f, framePt: vec2f
) -> vec2f {
  let at = select(off, off + 5u, isTgt);
  let mode = curveBlob[at];
  let dist = curveBlob[at + 4u];
  var p: vec2f;

  if (mode == ENDPT_INSIDE_W) {
    p = c;
  } else if (mode == ENDPT_LINE_W) {
    p = framePt;
  } else if (mode == ENDPT_POINT_W || mode == ENDPT_ANGLE_W) {
    p = rawEndptAnchorW(off, isTgt, c, half, shape);
  } else {
    p = curveBoundaryPoint(c, half, shape, aim);
  }

  if (dist != 0.0) {
    // v3's shortenIntersection: never past the aim (1e-5 floor)
    let d = p - aim;
    let l = length(d);

    if (l > 0.0) {
      let ratio = max((l - dist) / l, 0.00001);

      p = aim + ratio * d;
    }
  }

  return p;
}

struct Route {
  kind: f32,
  n: u32,
  round: u32,
  q: array<vec2f, ${MAX_CURVE_PTS + 2}>, // start, interior points, end
  radius: array<f32, ${MAX_CURVE_PTS}>,
  arcMode: array<u32, ${MAX_CURVE_PTS}>,
  aS: vec2f, // 56: the source arrow point (spacing behind the endpoint)
  aE: vec2f, // 56: the target arrow point
  // round 93: the bend-weighted subdivision map (allocRouteQuadsW) —
  // segEnd[p] is the first subdivision index after piece p.  Only the
  // entry points that read the map through quadPieceW fill it; the
  // arrow/label stages never subdivide and skip the alloc.
  pieces: u32,
  segEnd: array<u32, ${MAX_ROUTE_PIECES}>,
}

struct RouteFrame { b1: vec2f, b2: vec2f, nrm: vec2f, fsi: vec2f, fti: vec2f }

// the weighted-base frame: 'node-position' (mode 1) measures between the
// centers but keeps the intersection-frame normal (v3's quirk)
fn routeFrame(
  mode: f32, sC: vec2f, sHalf: vec2f, sShape: u32, tC: vec2f, tHalf: vec2f, tShape: u32
) -> RouteFrame {
  var u = tC - sC;
  let uL = max(length(u), 1e-6);

  u = u / uL;

  let si = sC + u * boundaryOffset(sShape, sHalf, u);
  let ti = tC - u * boundaryOffset(tShape, tHalf, -u);
  let d = ti - si;
  var l = length(d);

  if (!(l >= AVOID_BEZ_L)) {
    l = sqrt(max(d.x * d.x, AVOID_BEZ) + max(d.y * d.y, AVOID_BEZ));
  }

  var f: RouteFrame;

  f.nrm = vec2f(-d.y / l, d.x / l);
  f.fsi = si;
  f.fti = ti;

  if (mode == 1.0) { f.b1 = sC; f.b2 = tC; } else { f.b1 = si; f.b2 = ti; }

  return f;
}

// v3's subDWH: take the effective node body away from the delta
fn subDWH(dxy: f32, dwh: f32) -> f32 {
  if (dxy > 0.0) { return max(dxy - dwh, 0.0); }
  return min(dxy + dwh, 0.0);
}

fn evalRouteW(
  header: vec4f,
  sC: vec2f, sHalf: vec2f, sShape: u32,
  tC: vec2f, tHalf: vec2f, tShape: u32,
  trim: vec4f
) -> Route {
  var r: Route;

  // 12c: kinds >= 8 carry the endpoint-block prefix (base kind + 8)
  let hasEndpt = header.w >= 8.0;
  let kind = select(header.w, header.w - 8.0, hasEndpt);

  r.kind = kind;
  r.round = 0u;
  r.n = 0u;

  let blockOff = u32(header.x);
  let off = select(blockOff, blockOff + ENDPT_BLOCK_F, hasEndpt);

  // the intersection-frame boundary points (kept for outside-to-line)
  var fS = sC;
  var fT = tC;

  if (kind == 3.0 || kind == 4.0) { // MULTI / SEGMENTS
    let n = min(u32(header.z), MAX_ROUTE_PTS);
    let mode = curveBlob[off];
    var f = routeFrame(mode, sC, sHalf, sShape, tC, tHalf, tShape);

    fS = f.fsi;
    fT = f.fti;

    if (mode == 2.0 && hasEndpt) {
      // edge-distances: 'endpoints' — base points are the raw manual
      // anchors, normal recomputed from them (v3's recalcVectorNormInverse)
      f.b1 = rawEndptAnchorW(blockOff, false, sC, sHalf, sShape);
      f.b2 = rawEndptAnchorW(blockOff, true, tC, tHalf, tShape);

      let d = f.b2 - f.b1;
      let l = max(length(d), 1e-6);

      f.nrm = vec2f(-d.y / l, d.x / l);
    }

    if (kind == 3.0) {
      for (var b = 0u; b < n; b = b + 1u) {
        let d = curveBlob[off + 1u + b * 2u];
        let w = curveBlob[off + 2u + b * 2u];

        r.q[b + 1u] = mix(f.b1, f.b2, w) + f.nrm * d;
      }
    } else {
      r.round = u32(curveBlob[off + 1u] != 0.0);

      for (var s = 0u; s < n; s = s + 1u) {
        let d = curveBlob[off + 2u + s * 4u];
        let w = curveBlob[off + 3u + s * 4u];

        r.q[s + 1u] = mix(f.b1, f.b2, w) + f.nrm * d;
        r.radius[s] = curveBlob[off + 4u + s * 4u];
        r.arcMode[s] = u32(curveBlob[off + 5u + s * 4u] != 0.0);
      }
    }

    r.n = n;
  } else { // TAXI — v3's findTaxiPoints, verbatim (see curve-geometry.mts)
    let rawDir = curveBlob[off];
    // turn mode: 0 px, 1 percent, 2 auto — the px turn of an auto edge is
    // the header's n lane, written by the store's track pass (round 124)
    let turnMode = curveBlob[off + 2u];
    let turnIsAuto = turnMode == 2.0;
    let turnIsPercent = turnMode == 1.0;
    let turnVal = select(curveBlob[off + 1u], header.z, turnIsAuto);
    let minD = curveBlob[off + 3u];
    let dIncludesNodeBody = curveBlob[off + 4u] != 1.0;
    let taxiRound = curveBlob[off + 5u] != 0.0;
    let radiusVal = curveBlob[off + 6u];
    let arcFlag = u32(curveBlob[off + 7u] != 0.0);

    let srcWH = sHalf * 2.0;
    let tgtWH = tHalf * 2.0;
    let turnIsNegative = turnVal < 0.0;
    let dw = select(0.0, (srcWH.x + tgtWH.x) * 0.5, dIncludesNodeBody);
    let dh = select(0.0, (srcWH.y + tgtWH.y) * 0.5, dIncludesNodeBody);
    let pd = tC - sC;
    let dx = subDWH(pd.x, dw);
    let dy = subDWH(pd.y, dh);

    var isVert = false;
    var isExplicitDir = false;

    if (rawDir == 0.0) { // auto
      isVert = !(abs(dx) > abs(dy));
    } else if (rawDir == 3.0 || rawDir == 4.0) { // upward / downward
      isVert = true;
      isExplicitDir = true;
    } else if (rawDir == 5.0 || rawDir == 6.0) { // leftward / rightward
      isVert = false;
      isExplicitDir = true;
    } else {
      isVert = rawDir == 1.0; // vertical
    }

    var l = select(dx, dy, isVert);
    let pl = select(pd.x, pd.y, isVert);
    var sgnL = sign(pl);
    var forcedDir = false;

    if (
      !(isExplicitDir && (turnIsPercent || turnIsNegative || turnIsAuto)) &&
      ((rawDir == 4.0 && pl < 0.0) || (rawDir == 3.0 && pl > 0.0) ||
       (rawDir == 5.0 && pl > 0.0) || (rawDir == 6.0 && pl < 0.0))
    ) {
      sgnL = sgnL * -1.0;
      l = sgnL * abs(l);
      forcedDir = true;
    }

    var d = 0.0;

    if (turnIsPercent) {
      d = select(turnVal, 1.0 + turnVal, turnVal < 0.0) * l;
    } else {
      d = select(0.0, l, turnVal < 0.0) + turnVal * sgnL;
    }

    let tooCloseSrc = abs(d) < minD || abs(d) >= abs(l);
    let rest = abs(l) - abs(d);
    let tooCloseTgt = abs(rest) < minD || abs(rest) >= abs(l);

    if ((tooCloseSrc || tooCloseTgt) && !forcedDir) { // Z-/L-shape fallbacks
      if (isVert) {
        if (abs(pl) <= srcWH.y * 0.5) { // horizontal Z-shape
          let x = (sC.x + tC.x) * 0.5;

          r.n = 2u;
          r.q[1u] = vec2f(x, sC.y);
          r.q[2u] = vec2f(x, tC.y);
        } else if (abs(pd.x) <= tgtWH.x * 0.5) { // vertical Z-shape
          let y = (sC.y + tC.y) * 0.5;

          r.n = 2u;
          r.q[1u] = vec2f(sC.x, y);
          r.q[2u] = vec2f(tC.x, y);
        } else { // L-shape
          r.n = 1u;
          r.q[1u] = vec2f(sC.x, tC.y);
        }
      } else {
        if (abs(pl) <= srcWH.x * 0.5) { // vertical Z-shape
          let y = (sC.y + tC.y) * 0.5;

          r.n = 2u;
          r.q[1u] = vec2f(sC.x, y);
          r.q[2u] = vec2f(tC.x, y);
        } else if (abs(pd.y) <= tgtWH.y * 0.5) { // horizontal Z-shape
          let x = (sC.x + tC.x) * 0.5;

          r.n = 2u;
          r.q[1u] = vec2f(x, sC.y);
          r.q[2u] = vec2f(x, tC.y);
        } else { // L-shape
          r.n = 1u;
          r.q[1u] = vec2f(tC.x, sC.y);
        }
      }
    } else { // ideal routing
      if (isVert) {
        let y = sC.y + d + select(0.0, srcWH.y * 0.5 * sgnL, dIncludesNodeBody);

        r.n = 2u;
        r.q[1u] = vec2f(sC.x, y);
        r.q[2u] = vec2f(tC.x, y);
      } else {
        let x = sC.x + d + select(0.0, srcWH.x * 0.5 * sgnL, dIncludesNodeBody);

        r.n = 2u;
        r.q[1u] = vec2f(x, sC.y);
        r.q[2u] = vec2f(x, tC.y);
      }
    }

    r.round = u32(taxiRound);

    if (taxiRound) {
      for (var i = 0u; i < 2u; i = i + 1u) {
        r.radius[i] = radiusVal;
        r.arcMode[i] = arcFlag;
      }
    }
  }

  let qn = r.n + 2u;
  // each end shortens toward its aim — the near interior route point
  var sAim = r.q[1u];
  var tAim = r.q[qn - 2u];

  if (!hasEndpt) {
    // endpoints on the node boundaries toward the first/last interior point
    r.q[0u] = curveBoundaryPoint(sC, sHalf, sShape, sAim);
    r.q[qn - 1u] = curveBoundaryPoint(tC, tHalf, tShape, tAim);
  } else {
    // 12c: resolve each end through its endpoint-block entry.  With no
    // interior points (n = 0, the straight-with-endpoints chord) each end
    // aims at the other end's raw anchor (v3's lines path).
    if (r.n == 0u) {
      sAim = rawEndptAnchorW(blockOff, true, tC, tHalf, tShape);
      tAim = rawEndptAnchorW(blockOff, false, sC, sHalf, sShape);
    }

    r.q[0u] = resolveEndptW(blockOff, false, sC, sHalf, sShape, sAim, fS);
    r.q[qn - 1u] = resolveEndptW(blockOff, true, tC, tHalf, tShape, tAim, fT);
  }

  // Round 56: v3's two shortenings, the evalRoute twin.  The route's own
  // ends move by the draw trim, because v3 builds its drawn path from the
  // shortened points and everything derived from it follows; the arrow
  // points are kept separately for the head to sit on.
  r.aS = shortenTowardW(r.q[0u], sAim, trim.z);
  r.aE = shortenTowardW(r.q[qn - 1u], tAim, trim.w);
  r.q[0u] = shortenTowardW(r.q[0u], sAim, trim.x);
  r.q[qn - 1u] = shortenTowardW(r.q[qn - 1u], tAim, trim.y);

  return r;
}

struct RouteCornerW {
  c: vec2f,
  r: f32,
  cornerStart: vec2f,
  cornerStop: vec2f,
  a0: f32,
  a1: f32,
  ccw: u32,
}

// v3's getRoundCorner as a pure function — the computeCorner twin
fn computeCornerW(prev: vec2f, cur: vec2f, next: vec2f, radiusMax: f32, isArc: bool) -> RouteCornerW {
  var crn: RouteCornerW;

  crn.c = cur;
  crn.r = 0.0;
  crn.cornerStart = cur;
  crn.cornerStop = cur;
  crn.a0 = 0.0;
  crn.a1 = 0.0;
  crn.ccw = 0u;

  if (radiusMax == 0.0) { return crn; }

  let v1 = prev - cur;
  let v1l = length(v1);
  let v2 = next - cur;
  let v2l = length(v2);

  // A zero-length leg has no direction, so there is no corner to round,
  // and normalizing it would put NaN into every value below — on the GPU
  // that NaNs the clip position and the whole edge disappears.  The CPU
  // twin (computeCorner in src/curve-geometry.mts) carries the same guard
  // and the reasoning: this is a deliberate divergence from v3, which
  // divides unguarded here.  Axis-aligned round-taxi is the case.
  if (v1l == 0.0 || v2l == 0.0) { return crn; }

  let v1n = v1 / v1l;
  let v2n = v2 / v2l;

  let sinA = v1n.x * v2n.y - v1n.y * v2n.x;
  let sinA90 = v1n.x * v2n.x - v1n.y * -v2n.y;
  var angle = asin(clamp(sinA, -1.0, 1.0));

  if (abs(angle) < 1e-6) { return crn; } // collinear

  var radDirection = 1.0;
  var drawDirection = false;

  if (sinA90 < 0.0) {
    if (angle < 0.0) {
      angle = ROUTE_PI + angle;
    } else {
      angle = ROUTE_PI - angle;
      radDirection = -1.0;
      drawDirection = true;
    }
  } else if (angle > 0.0) {
    radDirection = -1.0;
    drawDirection = true;
  }

  let halfAngle = angle * 0.5;
  let limit = min(v1l, v2l) * 0.5;
  var lenOut = 0.0;
  var cRadius = 0.0;

  if (isArc) {
    lenOut = abs(cos(halfAngle) * radiusMax / sin(halfAngle));

    if (lenOut > limit) {
      lenOut = limit;
      cRadius = abs(lenOut * sin(halfAngle) / cos(halfAngle));
    } else {
      cRadius = radiusMax;
    }
  } else {
    lenOut = min(limit, radiusMax);
    cRadius = abs(lenOut * sin(halfAngle) / cos(halfAngle));
  }

  crn.cornerStop = cur + v2n * lenOut;
  crn.c = crn.cornerStop + vec2f(-v2n.y, v2n.x) * cRadius * radDirection;
  crn.cornerStart = cur + v1n * lenOut;
  crn.r = cRadius;
  crn.a0 = atan2(v1n.y, v1n.x) + (ROUTE_PI * 0.5) * radDirection;
  crn.a1 = atan2(v2n.y, v2n.x) - (ROUTE_PI * 0.5) * radDirection;
  crn.ccw = select(0u, 1u, drawDirection);

  return crn;
}

fn routeCornerW(r: ptr<function, Route>, j: u32) -> RouteCornerW {
  return computeCornerW(
    (*r).q[j], (*r).q[j + 1u], (*r).q[j + 2u], (*r).radius[j], (*r).arcMode[j] == 1u);
}

// sweep from a0 to a1 in the canvas-arc direction (ccw = decreasing)
fn arcSweepW(a0: f32, a1: f32, ccw: u32) -> f32 {
  var d = a1 - a0;

  if (ccw == 1u) {
    loop { if (d <= 0.0) { break; } d = d - 2.0 * ROUTE_PI; }
  } else {
    loop { if (d >= 0.0) { break; } d = d + 2.0 * ROUTE_PI; }
  }

  return d;
}

fn routePieceCountW(r: ptr<function, Route>) -> u32 {
  if ((*r).kind == 3.0) { return max((*r).n, 1u); }
  if ((*r).round == 1u) { return 2u * (*r).n + 1u; }
  return (*r).n + 1u;
}

// the tangent-turn bend of piece p, radians — the pieceBend twin
// (round 93): an arc piece by its sweep (pi minus the interior angle
// between its legs — the radius scales the arc, never the sweep), a
// multibezier piece by the turn between its control legs, a straight
// leg zero.  Degenerate legs and radius-0 corners weigh zero.
fn pieceBendW(r: ptr<function, Route>, p: u32) -> f32 {
  if ((*r).kind == 3.0) { // MULTI
    if ((*r).n == 0u) { return 0.0; } // the chord: one straight piece

    let c = (*r).q[p + 1u];
    var a = (*r).q[0u];
    var b = (*r).q[(*r).n + 1u];

    if (p != 0u) { a = ((*r).q[p] + c) * 0.5; }
    if (p != (*r).n - 1u) { b = (c + (*r).q[p + 2u]) * 0.5; }

    let u = c - a;
    let v = b - c;

    if (dot(u, u) < 1e-12 || dot(v, v) < 1e-12) { return 0.0; }

    return atan2(abs(u.x * v.y - u.y * v.x), dot(u, v));
  }

  if ((*r).round == 0u || (p & 1u) == 0u) { return 0.0; } // straight legs

  let j = (p - 1u) / 2u;

  if (!((*r).radius[j] > 0.0)) { return 0.0; } // no arc at this corner

  let v1 = (*r).q[j] - (*r).q[j + 1u];
  let v2 = (*r).q[j + 2u] - (*r).q[j + 1u];

  if (dot(v1, v1) < 1e-12 || dot(v2, v2) < 1e-12) { return 0.0; }

  return atan2(abs(v1.x * v2.y - v1.y * v2.x), -dot(v1, v2));
}

// build the subdivision map (round 93) — the allocRouteQuads twin:
// one mandatory quad per piece, the leftover split proportionally to
// the bend weights by cumulative floor, so the map is monotone, every
// piece keeps >= 1 quad and every piece boundary lands exactly on a
// subdivision index.  No bend at all: uniform split.  Pure function of
// the evaluated route, so canonical per index (the watertight rule).
fn allocRouteQuadsW(r: ptr<function, Route>) {
  let pieces = routePieceCountW(r);
  var w: array<f32, ${MAX_ROUTE_PIECES}>;
  var total = 0.0;

  for (var p = 0u; p < pieces; p = p + 1u) {
    let b = pieceBendW(r, p);

    w[p] = b;
    total = total + b;
  }

  let noBend = !(total > BEND_EPS);
  let denom = select(total, f32(pieces), noBend);
  let leftover = f32(CURVE_SEGS_U - pieces);
  var cum = 0.0;

  for (var p = 0u; p < pieces; p = p + 1u) {
    cum = cum + select(w[p], 1.0, noBend);
    // the 1e-4 nudge keeps exact ties deterministic across the f64/f32
    // twins — see allocRouteQuads
    (*r).segEnd[p] = p + 1u + u32(floor(leftover * cum / denom + 1e-4));
  }

  // the multiply/divide can round below the leftover: pin the end
  (*r).segEnd[pieces - 1u] = CURVE_SEGS_U;
  (*r).pieces = pieces;
}

// subdivision index -> (piece, local t) through the bend-weighted map;
// requires allocRouteQuadsW to have run on this route
fn quadPieceW(r: ptr<function, Route>, idx: u32) -> vec2f {
  if (idx >= CURVE_SEGS_U) { return vec2f(f32((*r).pieces - 1u), 1.0); }

  var start = 0u;
  var p = 0u;

  for (var i = 0u; i < MAX_ROUTE_PIECES_W; i = i + 1u) {
    let e = (*r).segEnd[p];

    if (idx < e) { break; }

    start = e;
    p = p + 1u;
  }

  return vec2f(f32(p), f32(idx - start) / f32((*r).segEnd[p] - start));
}

// the route point at subdivision index idx — the routeVertex twin
fn routeVertexW(r: ptr<function, Route>, idx: u32) -> vec2f {
  let pt = quadPieceW(r, idx);
  let p = u32(pt.x);
  let t = pt.y;

  if ((*r).kind == 3.0) { // MULTI: C1 spline through inserted midpoints
    if ((*r).n == 0u) { return mix((*r).q[0u], (*r).q[1u], t); }

    let c = (*r).q[p + 1u];
    var a = (*r).q[0u];
    var b = (*r).q[(*r).n + 1u];

    if (p != 0u) { a = ((*r).q[p] + c) * 0.5; }
    if (p != (*r).n - 1u) { b = (c + (*r).q[p + 2u]) * 0.5; }

    return qbez(a, c, b, t);
  }

  if ((*r).round == 0u) { // sharp polyline: leg p runs q[p] -> q[p+1]
    return mix((*r).q[p], (*r).q[p + 1u], t);
  }

  if ((p & 1u) == 1u) { // arc piece for corner j
    let j = (p - 1u) / 2u;
    let crn = routeCornerW(r, j);

    if (crn.r == 0.0) { return crn.c; }

    let a = crn.a0 + arcSweepW(crn.a0, crn.a1, crn.ccw) * t;

    return crn.c + vec2f(cos(a), sin(a)) * crn.r;
  }

  // leg piece j = p/2: corner(j-1).stop -> corner(j).start
  let j = p / 2u;
  var a = (*r).q[0u];
  var b = (*r).q[(*r).n + 1u];

  if (j != 0u) { a = routeCornerW(r, j - 1u).cornerStop; }
  if (j != (*r).n) { b = routeCornerW(r, j).cornerStart; }

  return mix(a, b, t);
}

// the route midpoint + tangent (v3's label anchor/autorotate rules —
// the routeMidpoint twin); xy = point, zw = tangent
fn routeMidpointW(r: ptr<function, Route>) -> vec4f {
  let n = (*r).n;

  if ((*r).kind == 3.0) { // MULTI
    if (n == 0u) {
      return vec4f(((*r).q[0u] + (*r).q[1u]) * 0.5, (*r).q[1u] - (*r).q[0u]);
    }

    if (n % 2u == 0u) {
      let i = n / 2u;

      return vec4f(((*r).q[i] + (*r).q[i + 1u]) * 0.5, (*r).q[i + 1u] - (*r).q[i]);
    }

    let p = (n - 1u) / 2u;
    let c = (*r).q[p + 1u];
    var a = (*r).q[0u];
    var b = (*r).q[n + 1u];

    if (p != 0u) { a = ((*r).q[p] + c) * 0.5; }
    if (p != n - 1u) { b = (c + (*r).q[p + 2u]) * 0.5; }

    return vec4f(qbez(a, c, b, 0.5), b - a);
  }

  if (n % 2u == 0u && n > 0u) {
    let i = n / 2u;

    return vec4f(((*r).q[i] + (*r).q[i + 1u]) * 0.5, (*r).q[i + 1u] - (*r).q[i]);
  }

  if (n == 0u) {
    return vec4f(((*r).q[0u] + (*r).q[1u]) * 0.5, (*r).q[1u] - (*r).q[0u]);
  }

  let mid = (n - 1u) / 2u;
  let p = (*r).q[mid + 1u];

  if ((*r).round == 0u) {
    return vec4f(p, p - (*r).q[mid]);
  }

  let crn = routeCornerW(r, mid);

  if (crn.r == 0.0) {
    return vec4f(p, (*r).q[mid + 2u] - p);
  }

  var v = p - crn.c;

  v = v / length(v) * crn.r;

  return vec4f(crn.c + v, vec2f(v.y, -v.x));
}
`;
