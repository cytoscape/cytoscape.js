/*
All WGSL for the GPU prototype, as template-literal strings.

Pure vertex pulling: no vertex buffers; instance data is read from
read-only storage buffers indexed by @builtin(instance_index).  Dead or
hidden instances (and conservatively off-viewport ones) collapse to a
degenerate quad.  The SDF bodies are ported from the canvas renderer's
WebGL shaders (src/extensions/renderer/canvas/webgl/shader-sdf.mts).

Colour columns are RGBA bytes bound as array<u32> and expanded with
unpack4x8unorm — byte-identical to the CPU columns, zero conversion.
*/

import { ARROW_POINTS, POLYGON_POINTS } from '../shape-points.mjs';
import {
  AVOID_IMPOSSIBLE_BEZIER, AVOID_IMPOSSIBLE_BEZIER_L, CURVE_SEGS, MAX_CURVE_PTS
} from '../curve-geometry.mjs';

/**
 * The per-frame uniform block.  Not a mat3x3 (avoids WGSL alignment
 * footguns); computed CPU-side from the core viewport + device pixel ratio.
 * Layout must match Renderer's Float32Array(16): viewportPx, panPx, zoomDpr,
 * edgeWidthFloor, nodeLodPx, hidePx, edgeDim, labelFadePx, labelMinPx,
 * curveSlack, haystackSlack (+3 pads) — 64 bytes.
 */
export const FRAME_STRUCT = `
struct Frame {
  viewportPx: vec2f,     // canvas size in device px
  panPx: vec2f,          // pan in device px
  zoomDpr: f32,          // model px -> device px (zoom * devicePixelRatio)
  edgeWidthFloor: f32,   // LOD: minimum edge width in device px (alpha-compensated)
  nodeLodPx: f32,        // LOD: below this device-px size nodes are plain AA discs
  hidePx: f32,           // LOD: below this device-px size sizes are floored + alpha-compensated
  edgeDim: f32,          // LOD: zoom-based edge dimming [0,1)
  labelFadePx: f32,      // LOD: labels fade out as glyph height drops below this, device px
  labelMinPx: f32,       // LOD: labels below this glyph height are culled outright (0 = off)
  curveSlack: f32,       // conservative curved-edge deviation bound, model px (0 = nothing curved)
  haystackSlack: f32,    // 12c: haystack endpoint-offset bound, model px (0 = no haystack)
  outlineSlack: f32,     // B5: max outline outward extent, model px (ghost cull bound)
  pad1: f32,
  pad2: f32,
}
`;

/** Shared WGSL prelude: flags, transforms, quad corners and the LOD
 * functions used by both the cull-pass predicates and the vertex shaders
 * (they must agree exactly on what is drawn and at what alpha). */
export const COMMON = `
${FRAME_STRUCT}

const FLAG_ALIVE: u32 = 1u;
const FLAG_VISIBLE: u32 = 2u;
const FLAG_SELECTED: u32 = 4u;
const FLAG_GRABBED: u32 = 16u;
const FLAG_HOVERED: u32 = 32u;
const FLAG_CURVED: u32 = 1024u; // edge renders in the curved stream (store-managed)
// the curve is not chord-bounded (taxi, extrapolated weights): cull by
// the endpoint AABB grown by slack + chord length instead (12b)
const FLAG_CURVED_BOX: u32 = 2048u;
const SHOWN: u32 = 3u; // ALIVE | VISIBLE

const SELECT_ACCENT = vec3f(0.00392, 0.41176, 0.85098); // #0169d9

// early-z depth ranks: the node depth prepass writes NODE_Z for opaque
// node interiors; edges draw at EDGE_Z with a 'less' test so fragments
// under opaque nodes are killed before blending.  A future z-index pass
// generalizes this to depth = f(z-rank) with more batches.
const NODE_Z = 0.5;
const EDGE_Z = 0.9;

fn modelToPx(frame: Frame, p: vec2f) -> vec2f {
  return p * frame.zoomDpr + frame.panPx;
}

fn pxToClip(frame: Frame, px: vec2f) -> vec2f {
  return vec2f(px.x / frame.viewportPx.x * 2.0 - 1.0, 1.0 - px.y / frame.viewportPx.y * 2.0);
}

// 4 unique corners, indexed [0,1,2, 2,1,3] (see quad-index.mts): drawIndexed
// lets vertex reuse collapse the 6 index entries to 4 VS invocations
fn quadCorner(vi: u32) -> vec2f {
  switch vi {
    case 0u: { return vec2f(-1.0, -1.0); }
    case 1u: { return vec2f(1.0, -1.0); }
    case 2u: { return vec2f(-1.0, 1.0); }
    default: { return vec2f(1.0, 1.0); }
  }
}

// LOD: floored half-size + alpha compensation for sub-hidePx nodes,
// as (half.x, half.y, alphaComp)
fn nodeLod(halfIn: vec2f, hidePx: f32) -> vec3f {
  let maxDim = max(halfIn.x, halfIn.y) * 2.0;

  if (maxDim < hidePx) {
    return vec3f(hidePx * 0.5, hidePx * 0.5, max(maxDim / hidePx, 0.05));
  }

  return vec3f(halfIn, 1.0);
}

// LOD for edges under the width floor, as (keep 0/1, alphaComp).
// Decimation ladder: once floored edges fall below half alpha, a
// hash-stable 1-in-N subset draws at N x alpha (N a power of two <= 64) —
// aggregate coverage is preserved while the massed same-pixel blend cost
// at far zoom drops ~N-fold.
fn edgeLod(slot: u32, widthPx: f32, floorPx: f32) -> vec2f {
  if (widthPx >= floorPx) { return vec2f(1.0, 1.0); }

  var alphaComp = max(widthPx / floorPx, 0.0);
  var n = 1u;

  while (alphaComp * f32(n) < 0.5 && n < 64u) { n = n * 2u; }

  if (n > 1u) {
    let h = slot * 2654435761u; // Knuth hash decorrelates from slot order

    if (((h >> 16u) & (n - 1u)) != 0u) { return vec2f(0.0, 0.0); }

    alphaComp = alphaComp * f32(n);
  }

  return vec2f(1.0, alphaComp);
}

// LOD: labels fade out (and cull away) as the on-screen glyph shrinks
fn labelFade(heightPx: f32, fadePx: f32) -> f32 {
  return smoothstep(fadePx * 0.5, fadePx, heightPx);
}
`;

/** Glyph instance layout, shared by the label shader and the glyph cull
 * pass; matches GlyphBuffer's CPU layout (12 words / 48 bytes per glyph). */
export const GLYPH_STRUCT = `
struct Glyph {
  nodeSlot: u32,     // owner word: 0xffffffff = dead (tombstoned run); else
                     // bits 0..30 the owner slot, bit 31 the autorotate
                     // flag (edge glyph stream only)
  color: u32,        // packed RGBA bytes
  offset: vec2f,     // quad top-left from the anchor, model px
  size: vec2f,       // model px
  uv0: vec2f,        // uv0.x < 0: solid background quad; uv0.y = LOD height
  uv1: vec2f,
  outlineColor: u32, // packed RGBA (a=0: no outline)
  outlineWidth: f32, // half-width in SDF sample units (0 = none)
}

const DEAD_GLYPH: u32 = 0xffffffffu;
const GLYPH_ROTATE: u32 = 0x80000000u;

// owner slot from the glyph's owner word (check DEAD_GLYPH against the
// full word first; element slots stay far below 2^31, so the flag can't
// collide with a live slot)
fn glyphOwner(word: u32) -> u32 {
  return word & 0x7fffffffu;
}

// text-rotation: autorotate — (cos, sin) of the edge's undirected slope
// angle.  The delta is negated when it points left (or straight up), so
// rotated text never reads upside-down: the baseline angle stays within
// (-90°, 90°], exactly v3's atan(dy/dx) rule (verticals read at +90°).
fn autorotateFrame(a: vec2f, b: vec2f) -> vec2f {
  var d = b - a;

  if (d.x < 0.0 || (d.x == 0.0 && d.y < 0.0)) { d = -d; }

  let len = length(d);

  if (len < 1e-6) { return vec2f(1.0, 0.0); }

  return d / len;
}

fn rotateBy(cs: vec2f, p: vec2f) -> vec2f {
  return vec2f(cs.x * p.x - cs.y * p.y, cs.y * p.x + cs.x * p.y);
}

// backgrounds carry the run's glyph-block height for LOD so they fade and
// cull exactly with their text
fn glyphLodHeight(g: Glyph) -> f32 {
  return select(g.size.y, g.uv0.y, g.uv0.x < 0.0);
}
`;

/** Distance from a node's center to its boundary along unit direction d —
 * shared by the arrow, curved-edge and edge-label shaders; the CPU twin
 * is curve-geometry.mts's boundaryOffset (they must agree exactly). */
export const BOUNDARY_WGSL = `
fn boundaryOffset(shape: u32, half: vec2f, d: vec2f) -> f32 {
  switch shape {
    case 2u, 3u: { // rectangle (round-rect approximated as its box)
      let inv = 1.0 / max(abs(d), vec2f(1e-4));
      return min(half.x * inv.x, half.y * inv.y);
    }
    default: { // circle + ellipse (polygons as their inscribed ellipse)
      return 1.0 / max(length(d / max(half, vec2f(1e-4))), 1e-6);
    }
  }
}
`;

/** AA'd on/off mask for a dash period (lengths in model px, as v3's canvas
 * dashes: setLineDash in the model-space-transformed context). */
export const DASH_WGSL = `
fn dashMask(u: f32, onLen: f32, offLen: f32, aaModel: f32) -> f32 {
  let period = onLen + offLen;
  let x = fract(u / period) * period;
  // signed distance to the nearest on/off boundary: + inside the on segment
  var sd = 0.0;
  if (x < onLen) { sd = min(x, onLen - x); }
  else { sd = -min(x - onLen, period - x); }
  return smoothstep(-aaModel, aaModel, sd);
}

// B3: signed model-px distance INSIDE the nearest on-segment of a
// two-pair dash pattern (negative in gaps); the wrap-around copy of
// the first segment keeps the period seam exact
fn dashInsideSd(u: f32, pat: vec4f, offset: f32) -> f32 {
  let period = max(pat.x + pat.y + pat.z + pat.w, 1e-4);
  let x = fract((u + offset) / period) * period;

  var sd = min(x, pat.x - x); // segment 1: [0, pat.x)
  let x2 = x - (pat.x + pat.y); // segment 2

  sd = max(sd, min(x2, pat.z - x2));

  let xw = x - period; // wrapped segment 1

  return max(sd, min(xw, pat.x - xw));
}

// B3: combined dash + lateral coverage with the line-cap applied per
// dash segment — butt (0) is the plain product, round (1) a capsule
// end, square (2) extends each dash by the half width
fn dashCoverage(u: f32, v: f32, halfW: f32, pat: vec4f, offset: f32, cap: f32, zoomDpr: f32) -> f32 {
  let sdIn = dashInsideSd(u, pat, offset) * zoomDpr; // device px

  if (cap == 1.0) { // round: capsule distance about the segment
    let d = length(vec2f(max(-sdIn, 0.0), abs(v)));

    return 1.0 - smoothstep(halfW - 0.75, halfW + 0.75, d);
  }

  let s = select(sdIn, sdIn + halfW, cap == 2.0);

  return smoothstep(-0.75, 0.75, s) * (1.0 - smoothstep(halfW - 0.75, halfW + 0.75, abs(v)));
}
`;

/**
 * Curved-edge geometry (round 12a) — the WGSL twin of
 * curve-geometry.mts, evaluated per vertex from live endpoint positions,
 * node geometry columns and the per-edge curve params, so curves follow
 * drags/layouts/position tweens on-GPU with zero rebuild.  Change the
 * math here and in curve-geometry.mts together.  Requires BOUNDARY_WGSL.
 */
export const CURVE_WGSL = `
const CURVE_SEGS_F: f32 = ${ CURVE_SEGS }.0;
const AVOID_BEZ: f32 = ${ AVOID_IMPOSSIBLE_BEZIER };
const AVOID_BEZ_L: f32 = ${ AVOID_IMPOSSIBLE_BEZIER_L.toFixed( 9 ) };

struct CurveGeom {
  s: vec2f,   // start point (source boundary)
  e: vec2f,   // end point (target boundary)
  c1: vec2f,  // control point (bezier), or the loop's first control
  c2: vec2f,  // the loop's second control (loops; == c1 for bezier)
  m: vec2f,   // curve midpoint (bezier Q(0.5); loop control midpoint)
  kind: f32,
}

fn curveBoundaryPoint(c: vec2f, half: vec2f, shape: u32, toward: vec2f) -> vec2f {
  var d = toward - c;
  let l = length(d);

  if (l < 1e-6) { d = vec2f(1.0, 0.0); } else { d = d / l; }

  return c + d * boundaryOffset(shape, half, d);
}

fn evalCurveGeom(
  params: vec4f,
  sC: vec2f, sHalf: vec2f, sShape: u32,
  tC: vec2f, tHalf: vec2f, tShape: u32
) -> CurveGeom {
  var g: CurveGeom;

  g.kind = params.w;

  if (params.w == 2.0) { // loop: two control rays from the node center
    let c1 = sC + vec2f(cos(params.x), sin(params.x)) * params.z;
    let c2 = sC + vec2f(cos(params.y), sin(params.y)) * params.z;

    g.c1 = c1;
    g.c2 = c2;
    g.m = (c1 + c2) * 0.5;
    g.s = curveBoundaryPoint(sC, sHalf, sShape, c1);
    g.e = curveBoundaryPoint(tC, tHalf, tShape, c2);

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
  g.s = curveBoundaryPoint(sC, sHalf, sShape, c);
  g.e = curveBoundaryPoint(tC, tHalf, tShape, c);
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
  if (g.kind == 2.0) {
    if (t <= 0.5) { return qbez(g.s, g.c1, g.m, t * 2.0); }
    return qbez(g.m, g.c2, g.e, t * 2.0 - 1.0);
  }
  return qbez(g.s, g.c1, g.e, t);
}

fn curveTangentAt(g: CurveGeom, t: f32) -> vec2f {
  if (g.kind == 2.0) {
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
export const ROUTE_WGSL = `
const CURVE_SEGS_U: u32 = ${ CURVE_SEGS }u;
const MAX_ROUTE_PTS: u32 = ${ MAX_CURVE_PTS }u;
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
  q: array<vec2f, ${ MAX_CURVE_PTS + 2 }>, // start, interior points, end
  radius: array<f32, ${ MAX_CURVE_PTS }>,
  arcMode: array<u32, ${ MAX_CURVE_PTS }>,
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
  tC: vec2f, tHalf: vec2f, tShape: u32
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
    let turnVal = curveBlob[off + 1u];
    let turnIsPercent = curveBlob[off + 2u] != 0.0;
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
      !(isExplicitDir && (turnIsPercent || turnIsNegative)) &&
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

  if (!hasEndpt) {
    // endpoints on the node boundaries toward the first/last interior point
    r.q[0u] = curveBoundaryPoint(sC, sHalf, sShape, r.q[1u]);
    r.q[qn - 1u] = curveBoundaryPoint(tC, tHalf, tShape, r.q[qn - 2u]);

    return r;
  }

  // 12c: resolve each end through its endpoint-block entry.  With no
  // interior points (n = 0, the straight-with-endpoints chord) each end
  // aims at the other end's raw anchor (v3's lines path).
  var sAim = r.q[1u];
  var tAim = r.q[qn - 2u];

  if (r.n == 0u) {
    sAim = rawEndptAnchorW(blockOff, true, tC, tHalf, tShape);
    tAim = rawEndptAnchorW(blockOff, false, sC, sHalf, sShape);
  }

  r.q[0u] = resolveEndptW(blockOff, false, sC, sHalf, sShape, sAim, fS);
  r.q[qn - 1u] = resolveEndptW(blockOff, true, tC, tHalf, tShape, tAim, fT);

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
  let v1n = v1 / v1l;
  let v2 = next - cur;
  let v2l = length(v2);
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

// subdivision index -> (piece, local t); piece boundaries land exactly
// on indices (requires pieces <= CURVE_SEGS — derivation caps counts)
fn quadPieceW(pieces: u32, idx: u32) -> vec2f {
  if (idx >= CURVE_SEGS_U) { return vec2f(f32(pieces - 1u), 1.0); }

  let base = CURVE_SEGS_U / pieces;
  let extra = CURVE_SEGS_U % pieces;
  let threshold = (base + 1u) * extra;

  if (idx < threshold) {
    let piece = idx / (base + 1u);

    return vec2f(f32(piece), f32(idx - piece * (base + 1u)) / f32(base + 1u));
  }

  let j = idx - threshold;
  let piece = extra + j / base;

  return vec2f(f32(piece), f32(j - (piece - extra) * base) / f32(base));
}

// the route point at subdivision index idx — the routeVertex twin
fn routeVertexW(r: ptr<function, Route>, idx: u32) -> vec2f {
  let pt = quadPieceW(routePieceCountW(r), idx);
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

// Polygon shape SDFs, generated from the shared unit point tables so the
// WGSL geometry is identical to the CPU pick's.  The unit vertices are
// scaled by the node's half-size and the distance evaluated in device
// space, so it is exact under anisotropy (crisp AA, uniform borders).
const fmtF32 = ( x: number ): string => x.toFixed( 8 );

const polygonSdFns = (): { fns: string; cases: string } => {
  let fns = '';
  let cases = '';

  for( const [ id, pts ] of POLYGON_POINTS ){
    const n = pts.length / 2;
    const lits = Array.from( { length: n }, ( _, i ) =>
      `vec2f(${ fmtF32( pts[ i * 2 ] ) }, ${ fmtF32( pts[ i * 2 + 1 ] ) })` ).join( ', ' );

    // https://iquilezles.org/articles/distfunctions2d/ sdPolygon
    fns += `
fn poly${ id }SD(p: vec2f, half: vec2f) -> f32 {
  var v = array<vec2f, ${ n }>(${ lits });
  for (var k = 0; k < ${ n }; k++) { v[k] = v[k] * half; }
  var d = dot(p - v[0], p - v[0]);
  var s = 1.0;
  var j = ${ n - 1 };
  for (var i = 0; i < ${ n }; i++) {
    let e = v[j] - v[i];
    let w = p - v[i];
    let b = w - e * clamp(dot(w, e) / dot(e, e), 0.0, 1.0);
    d = min(d, dot(b, b));
    let c1 = p.y >= v[i].y;
    let c2 = p.y < v[j].y;
    let c3 = e.x * w.y > e.y * w.x;
    if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) { s = -s; }
    j = i;
  }
  return s * sqrt(d);
}
`;
    cases += `    case ${ id }u: { return poly${ id }SD(p, half); }\n`;
  }

  return { fns, cases };
};

const POLY = polygonSdFns();

// Arrowhead SDFs generated from the shared v3 point tables (tip at the
// local origin, body toward negative y, scaled uniformly by `s`).
const arrowSdFns = (): { fns: string; cases: string } => {
  let fns = '';
  let cases = '';

  for( const [ id, pts ] of ARROW_POINTS ){
    const n = pts.length / 2;
    const lits = Array.from( { length: n }, ( _, i ) =>
      `vec2f(${ fmtF32( pts[ i * 2 ] ) }, ${ fmtF32( pts[ i * 2 + 1 ] ) })` ).join( ', ' );

    fns += `
fn arrow${ id }SD(p: vec2f, s: f32) -> f32 {
  var v = array<vec2f, ${ n }>(${ lits });
  for (var k = 0; k < ${ n }; k++) { v[k] = v[k] * s; }
  var d = dot(p - v[0], p - v[0]);
  var sgn = 1.0;
  var j = ${ n - 1 };
  for (var i = 0; i < ${ n }; i++) {
    let e = v[j] - v[i];
    let w = p - v[i];
    let b = w - e * clamp(dot(w, e) / dot(e, e), 0.0, 1.0);
    d = min(d, dot(b, b));
    let c1 = p.y >= v[i].y;
    let c2 = p.y < v[j].y;
    let c3 = e.x * w.y > e.y * w.x;
    if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) { sgn = -sgn; }
    j = i;
  }
  return sgn * sqrt(d);
}
`;
    cases += `    case ${ id }u: { sd = arrow${ id }SD(p, s); }\n`;
  }

  return { fns, cases };
};

const ARROW_POLY = arrowSdFns();

// SDFs ported from shader-sdf.mts (https://iquilezles.org/articles/distfunctions2d/)
const SDF = `
fn circleSD(p: vec2f, r: f32) -> f32 {
  return length(p) - r;
}

fn rectangleSD(p: vec2f, b: vec2f) -> f32 {
  let d = abs(p) - b;
  return length(max(d, vec2f(0.0))) + min(max(d.x, d.y), 0.0);
}

fn roundRectangleSD(p: vec2f, b: vec2f, r: f32) -> f32 {
  let q = abs(p) - b + vec2f(r);
  return min(max(q.x, q.y), 0.0) + length(max(q, vec2f(0.0))) - r;
}

// ellipse: https://www.shadertoy.com/view/4lsXDN (Newton solver)
fn ellipseSD(p0: vec2f, ab: vec2f) -> f32 {
  let p = abs(p0); // symmetry

  var w = 0.0;
  let q = ab * (p - ab);
  if (q.x < q.y) { w = 1.570796327; }

  for (var i = 0; i < 5; i++) {
    let cs = vec2f(cos(w), sin(w));
    let u = ab * cs;
    let v = ab * vec2f(-cs.y, cs.x);
    w = w + dot(p - u, v) / (dot(p - u, u) + dot(v, v));
  }

  let d = length(p - ab * vec2f(cos(w), sin(w)));

  if (dot(p / ab, p / ab) > 1.0) { return d; }
  return -d;
}

${ POLY.fns }
// shape ids match contract.mts: 0 circle, 1 ellipse, 2 rectangle,
// 3 round-rectangle, 4+ generated polygon shapes.  radius is the
// round-rectangle corner radius in device px, pre-resolved (B2).
fn nodeSD(shape: u32, p: vec2f, half: vec2f, radius: f32) -> f32 {
  switch shape {
    case 0u: { return circleSD(p, half.x); }
    case 1u: { return ellipseSD(p, half); }
    case 2u: { return rectangleSD(p, half); }
${ POLY.cases }
    default: { return roundRectangleSD(p, half, min(radius, min(half.x, half.y))); }
  }
}

// corner-radius 'auto' (B2): v3's min(w/4, h/4, 8) in model px.
// The stored value is u16.8 fixed-point; 0xffffffff means auto.
fn cornerRadiusPx(stored: u32, half: vec2f, zoomDpr: f32) -> f32 {
  if (stored == 0xffffffffu) { return min(min(half.x, half.y) * 0.5, 8.0 * zoomDpr); }
  return f32(stored) / 256.0 * zoomDpr;
}

// border-position (B2): how far the border band extends past the shape
// boundary — 0 for inside, bw/2 for center (v3's default), bw for outside
fn borderOutward(pos: u32, bw: f32) -> f32 {
  if (pos == 1u) { return 0.0; }
  if (pos == 2u) { return bw; }
  return bw * 0.5;
}

// outline extents from the packed word (B5): (width, offset) device px
fn outlineWO(packed: u32, zoomDpr: f32) -> vec2f {
  return vec2f(f32(packed & 0xffffu), f32(packed >> 16u)) / 256.0 * zoomDpr;
}
`;

export const NODE_SHADER = `
${COMMON}
${SDF}

// VS reads only geometry columns; decoration columns (colors, border,
// shape, opacity, flags) are fetched in the FS via the flat instance
// index — that keeps each stage within the 8-storage-buffer limit and
// drops interpolated varyings to a minimum
@group(0) @binding(0) var<uniform> frame: Frame;
@group(0) @binding(1) var<storage, read> positions: array<vec2f>;
@group(0) @binding(2) var<storage, read> sizes: array<vec2f>;
@group(0) @binding(3) var<storage, read> fillColors: array<u32>;
@group(0) @binding(4) var<storage, read> borderColors: array<u32>;
@group(0) @binding(5) var<storage, read> borderWidths: array<f32>;
@group(0) @binding(6) var<storage, read> opacities: array<f32>;
@group(0) @binding(7) var<storage, read> shapes: array<u32>;
@group(0) @binding(8) var<storage, read> nodeFlags: array<u32>;
// ghost props [offsetX, offsetY, ghostOpacity, enabled] (round 13 A1);
// bound to both stages for the ghost entry points
@group(0) @binding(9) var<storage, read> ghosts: array<vec4f>;
// [cornerRadius×256 | auto, borderPosition, outlineRgba, outlineWO] (B2/B5)
@group(0) @binding(10) var<storage, read> borderGeom: array<vec4u>;

struct NodeVSOut {
  @builtin(position) position: vec4f,
  @location(0) local: vec2f,      // device-px offset from the node center
  @location(1) halfSize: vec2f,   // device px
  @location(2) alphaComp: f32,    // sub-hidePx LOD alpha compensation
  @location(3) @interpolate(flat) instance: u32,
}

@group(1) @binding(0) var<storage, read> visible: array<u32>;

@vertex
fn vsNode(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> NodeVSOut {
  var out: NodeVSOut;

  // the cull pass compacted the live on-screen slots (slot order preserved),
  // so there are no collapse branches here
  let slot = visible[ii];

  // LOD: floor sub-pixel nodes to a visible minimum, compensating with alpha
  let lod = nodeLod(sizes[slot] * 0.5 * frame.zoomDpr, frame.hidePx);
  let half = lod.xy;

  let centerPx = modelToPx(frame, positions[slot]);
  let margin = 2.0; // AA + accent-ring slack, device px
  // center/outside borders and outlines extend past the boundary (B2/B5)
  let bg = borderGeom[slot];
  var borderOut = borderOutward(bg.y, borderWidths[slot] * frame.zoomDpr);

  if ((bg.z >> 24u) != 0u) {
    let wo = outlineWO(bg.w, frame.zoomDpr);

    borderOut = borderOut + wo.y * 0.5 + wo.x;
  }

  let ext = half + vec2f(margin + borderOut);
  let local = quadCorner(vi) * ext;

  out.position = vec4f(pxToClip(frame, centerPx + local), NODE_Z, 1.0);
  out.local = local;
  out.halfSize = half;
  out.alphaComp = lod.z;
  out.instance = slot;
  return out;
}

// depth-prepass VS: collapses nodes that can't occlude anything —
// LOD-translucent (sub-hidePx floored) or tiny — so the prepass costs
// nothing in regimes it can't help (e.g. far zoom)
@vertex
fn vsNodeDepth(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> NodeVSOut {
  var out: NodeVSOut;
  let slot = visible[ii];
  let lod = nodeLod(sizes[slot] * 0.5 * frame.zoomDpr, frame.hidePx);
  let half = lod.xy;

  if (lod.z < 1.0 || max(half.x, half.y) < 2.0) {
    out.position = vec4f(2.0, 2.0, 0.0, 1.0); // degenerate quad
    return out;
  }

  let centerPx = modelToPx(frame, positions[slot]);
  let ext = half + vec2f(2.0);
  let local = quadCorner(vi) * ext;

  out.position = vec4f(pxToClip(frame, centerPx + local), NODE_Z, 1.0);
  out.local = local;
  out.halfSize = half;
  out.alphaComp = lod.z;
  out.instance = slot;
  return out;
}

@fragment
fn fsNode(in: NodeVSOut) -> @location(0) vec4f {
  let slot = in.instance;
  let sizePx = max(in.halfSize.x, in.halfSize.y) * 2.0;
  let plain = sizePx < frame.nodeLodPx; // LOD: plain AA disc, no decorations

  var shape = shapes[slot];
  var half = in.halfSize;

  if (plain) {
    shape = 0u;
    half = vec2f(max(in.halfSize.x, in.halfSize.y));
  }

  let radius = cornerRadiusPx(borderGeom[slot].x, half, frame.zoomDpr);
  let sd = nodeSD(shape, in.local, half, radius);
  var color = unpack4x8unorm(fillColors[slot]);
  var edge = 0.0; // coverage boundary: sd <= edge is inked

  if (!plain) {
    let borderWidth = borderWidths[slot] * frame.zoomDpr;
    let flags = nodeFlags[slot];
    // border-position (B2): the band straddles the boundary by v3's
    // rule — center [−bw/2, bw/2] (the default), inside [−bw, 0],
    // outside [0, bw]
    let bOut = borderOutward(borderGeom[slot].y, borderWidth);

    if (borderWidth > 0.0 && sd > bOut - borderWidth) {
      color = unpack4x8unorm(borderColors[slot]);
      edge = bOut;
    }

    // selection accent ring at the boundary
    if ((flags & FLAG_SELECTED) != 0u && sd > -max(2.0, borderWidth)) {
      color = vec4f(SELECT_ACCENT, 1.0);
      edge = max(edge, 0.0);
    }

    // hover/grab brighten
    if ((flags & (FLAG_HOVERED | FLAG_GRABBED)) != 0u) {
      color = vec4f(min(color.rgb + vec3f(0.15), vec3f(1.0)), color.a);
    }
  }

  let mul = opacities[slot] * in.alphaComp;
  var alpha = (1.0 - smoothstep(edge - 0.75, edge + 0.75, sd)) * mul * color.a;
  var rgbPre = color.rgb * alpha;
  let og = borderGeom[slot];

  // outline ring (B5): a solid band outside the border at
  // outline-offset/2, disjoint from the body coverage
  if (!plain && (og.z >> 24u) != 0u) {
    let wo = outlineWO(og.w, frame.zoomDpr);
    let inner = borderOutward(og.y, borderWidths[slot] * frame.zoomDpr) + wo.y * 0.5;
    let oc = unpack4x8unorm(og.z);
    let ring = smoothstep(inner - 0.75, inner + 0.75, sd) *
      (1.0 - smoothstep(inner + wo.x - 0.75, inner + wo.x + 0.75, sd));
    let ringA = ring * mul * oc.a;

    rgbPre = rgbPre + oc.rgb * ringA;
    alpha = alpha + ringA;
  }

  return vec4f(rgbPre, alpha); // premultiplied
}

// Ghost pass (round 13 A1): the node body duplicated at the ghost
// offset — shape, border and background only (no accent ring, no
// hover/grab brighten, not pickable), alpha additionally scaled by
// ghost-opacity.  Draws off its own cull stream after edges/arrows and
// under the nodes, so the node body composites over its own ghost
// (v3's layering).
@vertex
fn vsGhost(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> NodeVSOut {
  var out: NodeVSOut;
  let slot = visible[ii];
  let lod = nodeLod(sizes[slot] * 0.5 * frame.zoomDpr, frame.hidePx);
  let half = lod.xy;

  let centerPx = modelToPx(frame, positions[slot] + ghosts[slot].xy);
  let bg = borderGeom[slot];
  var borderOut = borderOutward(bg.y, borderWidths[slot] * frame.zoomDpr);

  if ((bg.z >> 24u) != 0u) {
    let wo = outlineWO(bg.w, frame.zoomDpr);

    borderOut = borderOut + wo.y * 0.5 + wo.x;
  }

  let ext = half + vec2f(2.0 + borderOut);
  let local = quadCorner(vi) * ext;

  out.position = vec4f(pxToClip(frame, centerPx + local), NODE_Z, 1.0);
  out.local = local;
  out.halfSize = half;
  out.alphaComp = lod.z;
  out.instance = slot;
  return out;
}

@fragment
fn fsGhost(in: NodeVSOut) -> @location(0) vec4f {
  let slot = in.instance;
  let sizePx = max(in.halfSize.x, in.halfSize.y) * 2.0;
  let plain = sizePx < frame.nodeLodPx; // LOD: plain AA disc

  var shape = shapes[slot];
  var half = in.halfSize;

  if (plain) {
    shape = 0u;
    half = vec2f(max(in.halfSize.x, in.halfSize.y));
  }

  let radius = cornerRadiusPx(borderGeom[slot].x, half, frame.zoomDpr);
  let sd = nodeSD(shape, in.local, half, radius);
  var color = unpack4x8unorm(fillColors[slot]);
  var edge = 0.0;

  if (!plain) {
    let borderWidth = borderWidths[slot] * frame.zoomDpr;
    let bOut = borderOutward(borderGeom[slot].y, borderWidth);

    if (borderWidth > 0.0 && sd > bOut - borderWidth) {
      color = unpack4x8unorm(borderColors[slot]);
      edge = bOut;
    }
  }

  let ghostA = clamp(ghosts[slot].z, 0.0, 1.0);
  let mul = opacities[slot] * in.alphaComp * ghostA;
  var alpha = (1.0 - smoothstep(edge - 0.75, edge + 0.75, sd)) * mul * color.a;
  var rgbPre = color.rgb * alpha;
  let og = borderGeom[slot];

  if (!plain && (og.z >> 24u) != 0u) { // the ghost outline rides along (v3)
    let wo = outlineWO(og.w, frame.zoomDpr);
    let inner = borderOutward(og.y, borderWidths[slot] * frame.zoomDpr) + wo.y * 0.5;
    let oc = unpack4x8unorm(og.z);
    let ring = smoothstep(inner - 0.75, inner + 0.75, sd) *
      (1.0 - smoothstep(inner + wo.x - 0.75, inner + wo.x + 0.75, sd));
    let ringA = ring * mul * oc.a;

    rgbPre = rgbPre + oc.rgb * ringA;
    alpha = alpha + ringA;
  }

  return vec4f(rgbPre, alpha); // premultiplied
}

// (node picking is a synchronous CPU test — see cpu-pick.mts — so there is
// no node pick fragment shader; the GPU pick pass draws edges only)

// Conservative interior test for the depth prepass: true only when p is
// at least m device px inside the shape.  Deliberately cheap — no Newton
// ellipse solver; the ellipse bound uses the normalized-space distance
// (the map x -> x/half expands distances by at most 1/min(half), so
// |q| <= 1 - m/min(half) guarantees true distance >= m).  Under-covering
// only costs occlusion, never correctness.
fn nodeInterior(shape: u32, p: vec2f, half: vec2f, m: f32, radius: f32) -> bool {
  let minAxis = min(half.x, half.y);

  if (minAxis <= m) { return false; }

  switch shape {
    case 2u: { // rectangle: exact shrink
      let d = abs(p) - (half - vec2f(m));
      return max(d.x, d.y) <= 0.0;
    }
    case 3u: { // round-rectangle: cheap exact SD
      return roundRectangleSD(p, half, min(radius, minAxis)) <= -m;
    }
    case 0u, 1u: { // circle + ellipse: normalized-space bound (exact for circles)
      let q = p / half;
      let lim = 1.0 - m / minAxis;
      return dot(q, q) <= lim * lim;
    }
    default: { // polygons: the normalized SD × min axis under-estimates depth
      return nodeSD(shape, p, half, radius) <= -m;
    }
  }
}

/**
 * Early-z depth prepass: writes depth only where this node is guaranteed
 * fully opaque — skips translucent nodes (style or LOD alpha), the AA
 * fringe, and translucent border bands — so the later blended passes
 * composite exactly as without the prepass.
 */
@fragment
fn fsNodeDepth(in: NodeVSOut) -> @location(0) vec4f {
  let slot = in.instance;
  let fill = unpack4x8unorm(fillColors[slot]);
  let borderColor = unpack4x8unorm(borderColors[slot]);
  let borderWidth = borderWidths[slot] * frame.zoomDpr;

  if (opacities[slot] * in.alphaComp < 1.0 || fill.a < 1.0 ||
      (borderWidth > 0.0 && borderColor.a < 1.0)) {
    discard;
  }

  let sizePx = max(in.halfSize.x, in.halfSize.y) * 2.0;
  var shape = shapes[slot];
  var half = in.halfSize;

  if (sizePx < frame.nodeLodPx) {
    shape = 0u;
    half = vec2f(max(in.halfSize.x, in.halfSize.y));
  }

  let radius = cornerRadiusPx(borderGeom[slot].x, half, frame.zoomDpr);

  if (!nodeInterior(shape, in.local, half, 1.5, radius)) { // stay inside the AA fringe
    discard;
  }

  return vec4f(0.0); // color writes are masked off
}
`;

/**
 * Overlay/underlay quads (round 13 A2): a filled round-rectangle or
 * ellipse around the node's inner size + padding (v3's
 * drawNodeOverlay), one column per layer — the same shader draws both
 * (the pipeline binds the layer's column).  Not pickable; alpha is the
 * layer's own opacity (folded into the stored color, v3 semantics —
 * element opacity does not multiply).
 */
export const NODE_LAYER_SHADER = `
${COMMON}

@group(0) @binding(0) var<uniform> frame: Frame;
@group(0) @binding(1) var<storage, read> positions: array<vec2f>;
@group(0) @binding(2) var<storage, read> sizes: array<vec2f>;
// [rgba, padding*256, shape, radius*256 | 0xffffffff = auto]
@group(0) @binding(3) var<storage, read> layers: array<vec4u>;

struct LayerVSOut {
  @builtin(position) position: vec4f,
  @location(0) local: vec2f,     // device px from the node center
  @location(1) halfSize: vec2f,  // device px, incl. padding
  @location(2) @interpolate(flat) instance: u32,
}

@group(1) @binding(0) var<storage, read> visible: array<u32>;

@vertex
fn vsLayer(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> LayerVSOut {
  var out: LayerVSOut;
  let slot = visible[ii];
  let padding = f32(layers[slot].y) / 256.0 * frame.zoomDpr;
  let half = sizes[slot] * 0.5 * frame.zoomDpr + vec2f(padding);

  let centerPx = modelToPx(frame, positions[slot]);
  let ext = half + vec2f(1.0); // AA margin
  let local = quadCorner(vi) * ext;

  out.position = vec4f(pxToClip(frame, centerPx + local), NODE_Z, 1.0);
  out.local = local;
  out.halfSize = half;
  out.instance = slot;
  return out;
}

fn layerRoundRectSD(p: vec2f, b: vec2f, r: f32) -> f32 {
  let q = abs(p) - b + vec2f(r);
  return min(max(q.x, q.y), 0.0) + length(max(q, vec2f(0.0))) - r;
}

@fragment
fn fsLayer(in: LayerVSOut) -> @location(0) vec4f {
  let rec = layers[in.instance];
  let color = unpack4x8unorm(rec.x);
  var sd = 0.0;

  if (rec.z == 1u) { // ellipse: normalized-space approximation (cheap, AA-exact enough)
    let q = length(in.local / max(in.halfSize, vec2f(1e-4)));
    sd = (q - 1.0) * min(in.halfSize.x, in.halfSize.y);
  } else { // round-rectangle; radius 'auto' = v3's min(w/4, h/4, 8)
    var radius: f32;

    if (rec.w == 0xffffffffu) {
      radius = min(min(in.halfSize.x, in.halfSize.y) * 0.5, 8.0 * frame.zoomDpr);
    } else {
      radius = f32(rec.w) / 256.0 * frame.zoomDpr;
    }

    radius = min(radius, min(in.halfSize.x, in.halfSize.y));
    sd = layerRoundRectSD(in.local, in.halfSize, radius);
  }

  let alpha = (1.0 - smoothstep(-0.75, 0.75, sd)) * color.a;
  return vec4f(color.rgb * alpha, alpha); // premultiplied
}
`;

export const EDGE_SHADER = `
${COMMON}
${BOUNDARY_WGSL}
${DASH_WGSL}

// flags columns are not bound here: the cull pass already dropped dead or
// hidden edges (and edges with dead/hidden endpoints).  Paint columns
// (line color / opacity / line-style) bind to the *fragment* stage via
// flat instance fetch (the curved pipeline's split), freeing vertex-stage
// slots for the 12c straight-stream kinds: curveParams (haystack
// angles/radius, the triangle kind) plus outerHalf/shape (haystack
// offsets, triangle boundary tips) — 6 VS storage buffers + the visible
// list, within the base 8-buffer budget.
@group(0) @binding(0) var<uniform> frame: Frame;
@group(0) @binding(1) var<storage, read> endpoints: array<vec2u>; // source,target node slots
@group(0) @binding(2) var<storage, read> widths: array<f32>;
@group(0) @binding(3) var<storage, read> nodePositions: array<vec2f>;
@group(0) @binding(4) var<storage, read> curveParams: array<vec4f>;
@group(0) @binding(5) var<storage, read> nodeOuterHalf: array<vec2f>;
@group(0) @binding(6) var<storage, read> nodeShapes: array<u32>;
// fragment-stage columns (flat instance fetch; curveParams binds to both
// stages — the FS skips dashes on straight-triangle fills)
@group(0) @binding(7) var<storage, read> lineColors: array<u32>;
@group(0) @binding(8) var<storage, read> opacities: array<f32>;
@group(0) @binding(9) var<storage, read> lineStyles: array<u32>; // LINE_* ids
// dash pattern (two on/off pairs, model px) + [offset, cap] (round 13 B3)
@group(0) @binding(10) var<storage, read> dashPatterns: array<vec4f>;
@group(0) @binding(11) var<storage, read> dashMetas: array<vec2f>;
// overlay/underlay record [rgba folded, strokeWidth*256] — only the
// layer entry points bind it (round 13 A2)
@group(0) @binding(12) var<storage, read> edgeLayer: array<vec2u>;

struct EdgeVSOut {
  @builtin(position) position: vec4f,
  @location(0) v: f32,          // signed perpendicular distance, device px
  @location(1) halfWidth: f32,  // device px; tapers to 0 along a straight-triangle
  @location(2) @interpolate(flat) alphaComp: f32, // LOD alpha compensation
  @location(3) @interpolate(flat) instance: u32,
  @location(4) u: f32,          // longitudinal distance from the source, model px
}

@group(1) @binding(0) var<storage, read> visible: array<u32>;

@vertex
fn vsEdge(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> EdgeVSOut {
  var out: EdgeVSOut;

  // the cull pass compacted the shown, on-screen, non-decimated,
  // non-degenerate edges (slot order preserved): no collapse branches here
  let slot = visible[ii];

  // LOD: floor hairline edges; edgeLod's alpha compensation must match the
  // cull predicate's decimation decision (shared WGSL)
  let lod = edgeLod(slot, widths[slot] * frame.zoomDpr, frame.edgeWidthFloor);
  let widthPx = max(widths[slot] * frame.zoomDpr, frame.edgeWidthFloor);

  let ends = endpoints[slot];
  let params = curveParams[slot];

  // endpoints are read from the node position buffer: dragging a node
  // uploads one row and its edges follow on-GPU
  var pa = nodePositions[ends.x];
  var pb = nodePositions[ends.y];

  if (params.w == 6.0) { // haystack (12c): hash-stable offsets inside the bodies
    pa = pa + vec2f(cos(params.x), sin(params.x)) * nodeOuterHalf[ends.x] * params.z;
    pb = pb + vec2f(cos(params.y), sin(params.y)) * nodeOuterHalf[ends.y] * params.z;
  }

  let corner = quadCorner(vi);
  let t = (corner.x + 1.0) * 0.5; // 0 at source, 1 at target
  var taper = 1.0;

  if (params.w == 7.0) { // straight-triangle (12c): boundary base -> boundary apex
    var bd = pb - pa;
    let bl = max(length(bd), 1e-6);

    bd = bd / bl;
    pa = pa + bd * boundaryOffset(nodeShapes[ends.x], nodeOuterHalf[ends.x], bd);
    pb = pb - bd * boundaryOffset(nodeShapes[ends.y], nodeOuterHalf[ends.y], -bd);
    taper = 1.0 - t; // full width at the base, a point at the apex
  }

  let a = modelToPx(frame, pa);
  let b = modelToPx(frame, pb);
  let ab = b - a;
  let len = max(length(ab), 1e-4); // zero-length edges were culled

  let halfW = widthPx * 0.5 * taper;
  let dir = ab / len;
  let n = vec2f(-dir.y, dir.x);
  let s = corner.y * (halfW + 1.0); // screen-space extrusion incl. 1px AA margin

  out.position = vec4f(pxToClip(frame, mix(a, b, t) + n * s), EDGE_Z, 1.0);
  out.v = s;
  out.halfWidth = halfW;
  out.alphaComp = lod.y;
  out.instance = slot;
  // model px along the edge.  v3 launches the dash pattern at the
  // *source boundary* (its line starts there); center-to-center quads
  // subtract the source boundary offset so dash phases match (B3) —
  // haystack lines start at their offset points, like v3's.
  var u0 = 0.0;

  if (params.w != 6.0) {
    let dirM = (pb - pa) / max(length(pb - pa), 1e-6);

    u0 = boundaryOffset(nodeShapes[ends.x], nodeOuterHalf[ends.x], dirM);
  }

  out.u = t * (len / frame.zoomDpr) - u0;
  return out;
}

@fragment
fn fsEdge(in: EdgeVSOut) -> @location(0) vec4f {
  let c = unpack4x8unorm(lineColors[in.instance]);
  var alpha = c.a * opacities[in.instance] * in.alphaComp * (1.0 - frame.edgeDim);

  // line-style: dashed uses the per-edge line-dash-pattern/-offset,
  // dotted is [1, 1] (v3); line-cap shapes each dash segment (B3).
  // Picking ignores the gaps, as v3 does.  Straight-triangle fills
  // ignore line-style (v3 fills the triangle path).
  let ls = lineStyles[in.instance];
  let isTriangle = curveParams[in.instance].w == 7.0;

  if (!isTriangle && ls != 0u) {
    let pat = select(dashPatterns[in.instance], vec4f(1.0, 1.0, 1.0, 1.0), ls == 2u);
    let dm = dashMetas[in.instance];

    alpha = alpha * dashCoverage(in.u, in.v, in.halfWidth, pat, dm.x, dm.y, frame.zoomDpr);
  } else {
    alpha = alpha * (1.0 - smoothstep(in.halfWidth - 0.75, in.halfWidth + 0.75, abs(in.v)));
  }

  return vec4f(c.rgb * alpha, alpha); // premultiplied
}

@fragment
fn fsEdgePick(in: EdgeVSOut) -> @location(0) u32 {
  if (abs(in.v) > in.halfWidth) {
    discard;
  }

  return (in.instance + 1u) | 0x80000000u; // high bit marks edges
}

// Overlay/underlay strokes (round 13 A2): the edge geometry re-extruded
// at the layer's stroke width (edge width + 2 x padding, pre-derived),
// riding the same visible list — disabled instances collapse in the VS.
// Solid (no dashes; v3 strokes overlays solid with round caps — v4 keeps
// butt caps, a recorded deviation), alpha = the folded layer opacity.
@vertex
fn vsEdgeLayer(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> EdgeVSOut {
  var out: EdgeVSOut;
  let slot = visible[ii];
  let rec = edgeLayer[slot];

  if ((rec.x >> 24u) == 0u) { // disabled: degenerate, clipped
    out.position = vec4f(2.0, 2.0, 0.0, 1.0);
    return out;
  }

  let widthPx = f32(rec.y) / 256.0 * frame.zoomDpr;
  let ends = endpoints[slot];
  let params = curveParams[slot];

  var pa = nodePositions[ends.x];
  var pb = nodePositions[ends.y];

  if (params.w == 6.0) { // haystack offsets apply to the layer stroke too
    pa = pa + vec2f(cos(params.x), sin(params.x)) * nodeOuterHalf[ends.x] * params.z;
    pb = pb + vec2f(cos(params.y), sin(params.y)) * nodeOuterHalf[ends.y] * params.z;
  }

  let corner = quadCorner(vi);
  let t = (corner.x + 1.0) * 0.5;
  var taper = 1.0;

  if (params.w == 7.0) { // straight-triangle layers taper like the fill
    var bd = pb - pa;
    let bl = max(length(bd), 1e-6);

    bd = bd / bl;
    pa = pa + bd * boundaryOffset(nodeShapes[ends.x], nodeOuterHalf[ends.x], bd);
    pb = pb - bd * boundaryOffset(nodeShapes[ends.y], nodeOuterHalf[ends.y], -bd);
    taper = 1.0 - t;
  }

  let a = modelToPx(frame, pa);
  let b = modelToPx(frame, pb);
  let ab = b - a;
  let len = max(length(ab), 1e-4);
  let halfW = widthPx * 0.5 * taper;
  let dir = ab / len;
  let n = vec2f(-dir.y, dir.x);
  let s = corner.y * (halfW + 1.0);

  out.position = vec4f(pxToClip(frame, mix(a, b, t) + n * s), EDGE_Z, 1.0);
  out.v = s;
  out.halfWidth = halfW;
  out.alphaComp = 1.0;
  out.instance = slot;
  out.u = 0.0;
  return out;
}

@fragment
fn fsEdgeLayer(in: EdgeVSOut) -> @location(0) vec4f {
  let c = unpack4x8unorm(edgeLayer[in.instance].x);
  let alpha = c.a * (1.0 - smoothstep(in.halfWidth - 0.75, in.halfWidth + 0.75, abs(in.v)));

  return vec4f(c.rgb * alpha, alpha); // premultiplied
}
`;

/**
 * The curved-edge shader (round 12a): each instance is a strip of
 * CURVE_SEGS quads whose vertices evaluate the curve analytically from
 * live endpoint positions + node geometry + the per-edge curve params —
 * drags, layouts and position tweens re-shape the curve on-GPU with
 * zero rebuild.  Vertices extrude along the curve *normal at their own
 * t* (identical for the shared edge of adjacent quads), so the strip is
 * watertight without miter joints.  The vertex stage binds 6 columns +
 * the visible list (within WebGPU's base 8-storage-buffer budget — node
 * size and border ride the derived outerHalf column, leaving one slot
 * for the curve param blob); color/opacity/line-style move to the
 * fragment stage (flat instance fetch), like the node pipeline's
 * decoration split.
 */
export const CURVED_EDGE_SHADER = `
${COMMON}
${BOUNDARY_WGSL}
${CURVE_WGSL}
${ROUTE_WGSL}
${DASH_WGSL}

@group(0) @binding(0) var<uniform> frame: Frame;
// vertex-stage columns (7 + the visible list = the 8-buffer budget)
@group(0) @binding(1) var<storage, read> endpoints: array<vec2u>;
@group(0) @binding(2) var<storage, read> widths: array<f32>;
@group(0) @binding(3) var<storage, read> nodePositions: array<vec2f>;
@group(0) @binding(4) var<storage, read> nodeOuterHalf: array<vec2f>;
@group(0) @binding(5) var<storage, read> nodeShapes: array<u32>;
@group(0) @binding(6) var<storage, read> curveParams: array<vec4f>;
@group(0) @binding(7) var<storage, read> curveBlob: array<f32>;
// fragment-stage columns (flat instance fetch)
@group(0) @binding(8) var<storage, read> lineColors: array<u32>;
@group(0) @binding(9) var<storage, read> opacities: array<f32>;
@group(0) @binding(10) var<storage, read> lineStyles: array<u32>;
// dash pattern + [offset, cap] (round 13 B3)
@group(0) @binding(11) var<storage, read> dashPatterns: array<vec4f>;
@group(0) @binding(12) var<storage, read> dashMetas: array<vec2f>;
// overlay/underlay record — only the layer entry points bind it; they
// drop the widths binding (the stroke width is pre-derived), which
// keeps the layer vertex stage at the 8-storage-buffer budget
@group(0) @binding(13) var<storage, read> edgeLayer: array<vec2u>;

struct CurvedVSOut {
  @builtin(position) position: vec4f,
  @location(0) v: f32,          // signed perpendicular distance, device px
  @location(1) halfWidth: f32,  // device px
  @location(2) @interpolate(flat) alphaComp: f32, // width-floor LOD compensation
  @location(3) @interpolate(flat) instance: u32,
  @location(4) u: f32,          // longitudinal distance along the polyline, model px
}

@group(1) @binding(0) var<storage, read> visible: array<u32>;

@vertex
fn vsCurvedEdge(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> CurvedVSOut {
  var out: CurvedVSOut;

  // the cull pass compacted the shown curved edges (slot order preserved)
  let slot = visible[ii];
  let seg = vi >> 2u;               // strip quad index, 0..CURVE_SEGS-1
  let corner = quadCorner(vi & 3u);

  let ends = endpoints[slot];
  let params = curveParams[slot];

  // LOD: width floor with alpha compensation; the curved stream is not
  // decimated (its cull predicate draws every shown curved edge)
  let widthPx = max(widths[slot] * frame.zoomDpr, frame.edgeWidthFloor);
  let alphaComp = min(widths[slot] * frame.zoomDpr / max(frame.edgeWidthFloor, 1e-4), 1.0);

  // this vertex's subdivision point + the extrusion normal there:
  // adjacent quads share exact vertex geometry, so the strip is
  // watertight; a vertex's normal depends only on its index, so both
  // quads sharing an index extrude identically
  let tIdx = seg + u32((corner.x + 1.0) * 0.5);
  var p: vec2f;
  var n: vec2f;
  var miterScale = 1.0;
  var uLen = 0.0;

  if (params.w <= 2.0) { // bezier / loop: the 12a analytic path, unchanged
    let g = evalCurveGeom(
      params,
      nodePositions[ends.x], nodeOuterHalf[ends.x], nodeShapes[ends.x],
      nodePositions[ends.y], nodeOuterHalf[ends.y], nodeShapes[ends.y]
    );
    let t = f32(tIdx) / CURVE_SEGS_F;

    p = curvePoint(g, t);

    var tangent = curveTangentAt(g, t);
    let tl = length(tangent);

    if (tl < 1e-6) { tangent = vec2f(1.0, 0.0); } else { tangent = tangent / tl; }

    n = vec2f(-tangent.y, tangent.x);

    // longitudinal model-px distance along the drawn polyline (for dashes)
    var prev = g.s;

    for (var i = 1u; i <= tIdx; i = i + 1u) {
      let q = curvePoint(g, f32(i) / CURVE_SEGS_F);

      uLen = uLen + length(q - prev);
      prev = q;
    }
  } else { // 12b route families: evaluate the route from the param blob
    var route = evalRouteW(
      params,
      nodePositions[ends.x], nodeOuterHalf[ends.x], nodeShapes[ends.x],
      nodePositions[ends.y], nodeOuterHalf[ends.y], nodeShapes[ends.y]
    );

    p = routeVertexW(&route, tIdx);

    // discrete miter normal from the neighbouring subdivision points:
    // exact miters at sharp polyline corners (v3's canvas join),
    // chord-normals elsewhere — canonical per index, so watertight
    var dirIn = vec2f(0.0);
    var dirOut = vec2f(0.0);

    if (tIdx > 0u) { dirIn = p - routeVertexW(&route, tIdx - 1u); }
    if (tIdx < CURVE_SEGS_U) { dirOut = routeVertexW(&route, tIdx + 1u) - p; }
    if (length(dirIn) < 1e-6) { dirIn = dirOut; }
    if (length(dirOut) < 1e-6) { dirOut = dirIn; }

    let lIn = max(length(dirIn), 1e-6);
    let lOut = max(length(dirOut), 1e-6);
    let nIn = vec2f(-dirIn.y, dirIn.x) / lIn;
    let nOut = vec2f(-dirOut.y, dirOut.x) / lOut;
    var m = nIn + nOut;

    if (length(m) < 1e-4) { m = nIn; } // 180-degree reversal: fall back

    n = m / max(length(m), 1e-6);
    // extruding along the miter by s/cos(halfAngle) keeps the strip's
    // perpendicular half-width exact (clamped like a miter limit)
    miterScale = 1.0 / clamp(dot(n, nIn), 0.1666, 1.0);

    // dash distance: the same chord sum over the drawn polyline
    var prev = route.q[0u];

    for (var i = 1u; i <= tIdx; i = i + 1u) {
      let q = routeVertexW(&route, i);

      uLen = uLen + length(q - prev);
      prev = q;
    }
  }

  let halfW = widthPx * 0.5;
  let s = corner.y * (halfW + 1.0); // screen-space extrusion incl. 1px AA margin

  out.position = vec4f(pxToClip(frame, modelToPx(frame, p) + n * s * miterScale), EDGE_Z, 1.0);
  out.v = s;
  out.halfWidth = halfW;
  out.alphaComp = alphaComp;
  out.instance = slot;
  out.u = uLen;
  return out;
}

@fragment
fn fsCurvedEdge(in: CurvedVSOut) -> @location(0) vec4f {
  let c = unpack4x8unorm(lineColors[in.instance]);
  var alpha = c.a * opacities[in.instance] * in.alphaComp * (1.0 - frame.edgeDim);

  // line-style dashes ride the polyline's longitudinal coordinate;
  // dashed uses the per-edge pattern/offset with the line-cap (B3)
  let ls = lineStyles[in.instance];

  if (ls != 0u) {
    let pat = select(dashPatterns[in.instance], vec4f(1.0, 1.0, 1.0, 1.0), ls == 2u);
    let dm = dashMetas[in.instance];

    alpha = alpha * dashCoverage(in.u, in.v, in.halfWidth, pat, dm.x, dm.y, frame.zoomDpr);
  } else {
    alpha = alpha * (1.0 - smoothstep(in.halfWidth - 0.75, in.halfWidth + 0.75, abs(in.v)));
  }

  return vec4f(c.rgb * alpha, alpha); // premultiplied
}

@fragment
fn fsCurvedEdgePick(in: CurvedVSOut) -> @location(0) u32 {
  if (abs(in.v) > in.halfWidth) {
    discard;
  }

  return (in.instance + 1u) | 0x80000000u; // high bit marks edges
}

// Curved overlay/underlay strokes (round 13 A2): the curved strip
// re-extruded at the layer's pre-derived stroke width, riding the
// curved visible list; disabled instances collapse in the VS.
@vertex
fn vsCurvedLayer(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> CurvedVSOut {
  var out: CurvedVSOut;
  let slot = visible[ii];
  let rec = edgeLayer[slot];

  if ((rec.x >> 24u) == 0u) {
    out.position = vec4f(2.0, 2.0, 0.0, 1.0);
    return out;
  }

  let seg = vi >> 2u;
  let corner = quadCorner(vi & 3u);
  let ends = endpoints[slot];
  let params = curveParams[slot];
  let widthPx = f32(rec.y) / 256.0 * frame.zoomDpr;

  let tIdx = seg + u32((corner.x + 1.0) * 0.5);
  var p: vec2f;
  var n: vec2f;
  var miterScale = 1.0;

  if (params.w <= 2.0) {
    let g = evalCurveGeom(
      params,
      nodePositions[ends.x], nodeOuterHalf[ends.x], nodeShapes[ends.x],
      nodePositions[ends.y], nodeOuterHalf[ends.y], nodeShapes[ends.y]
    );
    let t = f32(tIdx) / CURVE_SEGS_F;

    p = curvePoint(g, t);

    var tangent = curveTangentAt(g, t);
    let tl = length(tangent);

    if (tl < 1e-6) { tangent = vec2f(1.0, 0.0); } else { tangent = tangent / tl; }

    n = vec2f(-tangent.y, tangent.x);
  } else {
    var route = evalRouteW(
      params,
      nodePositions[ends.x], nodeOuterHalf[ends.x], nodeShapes[ends.x],
      nodePositions[ends.y], nodeOuterHalf[ends.y], nodeShapes[ends.y]
    );

    p = routeVertexW(&route, tIdx);

    var dirIn = vec2f(0.0);
    var dirOut = vec2f(0.0);

    if (tIdx > 0u) { dirIn = p - routeVertexW(&route, tIdx - 1u); }
    if (tIdx < CURVE_SEGS_U) { dirOut = routeVertexW(&route, tIdx + 1u) - p; }
    if (length(dirIn) < 1e-6) { dirIn = dirOut; }
    if (length(dirOut) < 1e-6) { dirOut = dirIn; }

    let lIn = max(length(dirIn), 1e-6);
    let lOut = max(length(dirOut), 1e-6);
    let nIn = vec2f(-dirIn.y, dirIn.x) / lIn;
    let nOut = vec2f(-dirOut.y, dirOut.x) / lOut;
    var m = nIn + nOut;

    if (length(m) < 1e-4) { m = nIn; }

    n = m / max(length(m), 1e-6);
    miterScale = 1.0 / clamp(dot(n, nIn), 0.1666, 1.0);
  }

  let halfW = widthPx * 0.5;
  let s = corner.y * (halfW + 1.0);

  out.position = vec4f(pxToClip(frame, modelToPx(frame, p) + n * s * miterScale), EDGE_Z, 1.0);
  out.v = s;
  out.halfWidth = halfW;
  out.alphaComp = 1.0;
  out.instance = slot;
  out.u = 0.0;
  return out;
}

@fragment
fn fsCurvedLayer(in: CurvedVSOut) -> @location(0) vec4f {
  let c = unpack4x8unorm(edgeLayer[in.instance].x);
  let alpha = c.a * (1.0 - smoothstep(in.halfWidth - 0.75, in.halfWidth + 0.75, abs(in.v)));

  return vec4f(c.rgb * alpha, alpha); // premultiplied
}
`;

export const ARROW_SHADER = `
${COMMON}
${BOUNDARY_WGSL}

// One arrowhead quad per visible edge, per end: reuses the edge cull
// pass's visible list and indirect args (indexCount 6, one quad per
// instance).  Which end this draw covers comes from the tiny End
// uniform (two cached bind groups, one draw call each).  Edges whose
// arrow color has a=0 (shape 'none') collapse to a degenerate quad.
// this end's arrow colors bind at 6 (source or target column per bind
// group).  The vertex stage binds 6 columns + the visible list (node
// size and border ride the derived outerHalf column), within WebGPU's
// base limit of 8 storage buffers; edge opacity is folded into the
// stored arrow alpha at style-write time for the same reason.
@group(0) @binding(0) var<uniform> frame: Frame;
@group(0) @binding(1) var<storage, read> endpoints: array<vec2u>;
@group(0) @binding(2) var<storage, read> edgeWidths: array<f32>;
@group(0) @binding(3) var<storage, read> nodePositions: array<vec2f>;
@group(0) @binding(4) var<storage, read> nodeOuterHalf: array<vec2f>;
@group(0) @binding(5) var<storage, read> nodeShapes: array<u32>;
@group(0) @binding(6) var<storage, read> arrows: array<u32>;

struct End { isSource: u32 }
@group(0) @binding(7) var<uniform> end: End;
// shape ids packed source | target<<8 — bound to the fragment stage only,
// keeping the vertex stage at its 8-storage-buffer budget
@group(0) @binding(8) var<storage, read> arrowShapes: array<u32>;

@group(1) @binding(0) var<storage, read> visible: array<u32>;

struct ArrowVSOut {
  @builtin(position) position: vec4f,
  @location(0) p: vec2f,    // arrow-local device px: x lateral, y (≤0) behind the tip
  @location(1) color: vec4f,
  @location(2) @interpolate(flat) scale: f32, // device px per arrow unit
  @location(3) @interpolate(flat) slot: u32,
}

${ ARROW_POLY.fns }

@vertex
fn vsArrow(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> ArrowVSOut {
  var out: ArrowVSOut;

  let slot = visible[ii];
  let isSource = end.isSource == 1u;
  let c = unpack4x8unorm(arrows[slot]);

  if (c.a == 0.0) { // no arrow at this end: degenerate, clipped
    out.position = vec4f(2.0, 2.0, 0.0, 1.0);
    return out;
  }

  let ends = endpoints[slot];
  let tipSlot = select(ends.y, ends.x, isSource);
  let fromSlot = select(ends.x, ends.y, isSource);
  let tipC = modelToPx(frame, nodePositions[tipSlot]);
  let fromC = modelToPx(frame, nodePositions[fromSlot]);
  let toTip = tipC - fromC;
  let len = max(length(toTip), 1e-4); // zero-length edges were culled
  let dir = toTip / len;

  // the tip sits on the tip node's boundary (border straddles half in, half out)
  let half = nodeOuterHalf[tipSlot] * frame.zoomDpr;
  let tip = tipC - dir * boundaryOffset(nodeShapes[tipSlot], half, dir);

  // sizing follows the drawn (floored) edge width; alpha matches the edge LOD
  let lod = edgeLod(slot, edgeWidths[slot] * frame.zoomDpr, frame.edgeWidthFloor);
  let widthPx = max(edgeWidths[slot] * frame.zoomDpr, frame.edgeWidthFloor);
  let arrowLen = widthPx * 3.0 + 2.0;
  let halfBase = widthPx * 1.5 + 1.0;

  let n = vec2f(-dir.y, dir.x);
  let corner = quadCorner(vi);
  let t = (corner.y + 1.0) * 0.5; // 0 at base, 1 at tip
  // arrow-local frame: y = 0 at the tip, negative behind (v3's arrow tables);
  // 1px AA margin on every side
  let yLocal = mix(-(arrowLen + 1.0), 1.0, t);
  let lateral = corner.x * (halfBase + 1.0);

  out.position = vec4f(pxToClip(frame, tip + dir * yLocal + n * lateral), EDGE_Z, 1.0);
  out.p = vec2f(lateral, yLocal);
  // the sizing makes this uniform: halfBase / 0.15 == arrowLen / 0.3
  out.scale = arrowLen / 0.3;
  out.slot = slot;
  // edge opacity is pre-folded into c.a at style-write time
  out.color = vec4f(c.rgb, c.a * lod.y * (1.0 - frame.edgeDim));
  return out;
}

@fragment
fn fsArrow(in: ArrowVSOut) -> @location(0) vec4f {
  let pair = arrowShapes[in.slot];
  let shape = select(pair >> 8u, pair & 0xffu, end.isSource == 1u);
  let p = in.p;
  let s = in.scale;
  var sd = 1e6;

  switch shape {
${ ARROW_POLY.cases }
    case 4u: { sd = length(p - vec2f(0.0, -0.15 * s)) - 0.15 * s; } // circle
    default: { sd = 1e6; } // none (already degenerate in the VS)
  }

  let alpha = in.color.a * (1.0 - smoothstep(-0.75, 0.75, sd));
  return vec4f(in.color.rgb * alpha, alpha); // premultiplied
}
`;

/**
 * Arrowheads for curved edges (round 12a): the straight arrow math with
 * the curve's *control point* substituted for the far endpoint — a
 * quadratic's end tangent points from the control to the endpoint, so
 * dir = normalize(tipCenter − ctrl) puts the tip on the node boundary
 * along the curve's true end tangent (source end uses c1, target end
 * c2; for a bundled bezier they coincide).  The 12b route families
 * generalize the same insight: a route's end tangent runs from the
 * first/last interior route point to the boundary endpoint, so the
 * arrow is the straight arrow math with that point substituted.  Rides
 * the curved cull stream's single-quad args block.  The vertex stage
 * binds 7 columns + the visible list (the base 8-storage-buffer
 * budget — node size/border ride outerHalf, and this end's arrow
 * *colors* moved to the fragment stage to make room for the curve
 * param blob; no-arrow ends rasterize a small transparent quad instead
 * of collapsing in the VS).  Since 12b the frame uses border-inclusive
 * outer halves like the straight arrows (the 12a border-exclusive
 * deviation is gone).
 */
export const CURVED_ARROW_SHADER = `
${COMMON}
${BOUNDARY_WGSL}
${CURVE_WGSL}
${ROUTE_WGSL}

@group(0) @binding(0) var<uniform> frame: Frame;
@group(0) @binding(1) var<storage, read> endpoints: array<vec2u>;
@group(0) @binding(2) var<storage, read> edgeWidths: array<f32>;
@group(0) @binding(3) var<storage, read> nodePositions: array<vec2f>;
@group(0) @binding(4) var<storage, read> nodeOuterHalf: array<vec2f>;
@group(0) @binding(5) var<storage, read> nodeShapes: array<u32>;
@group(0) @binding(6) var<storage, read> curveParams: array<vec4f>;
@group(0) @binding(7) var<storage, read> curveBlob: array<f32>;

struct End { isSource: u32 }
@group(0) @binding(8) var<uniform> end: End;
// fragment-stage: this end's arrow colors + the packed shape ids
@group(0) @binding(9) var<storage, read> arrows: array<u32>;
@group(0) @binding(10) var<storage, read> arrowShapes: array<u32>;

@group(1) @binding(0) var<storage, read> visible: array<u32>;

struct ArrowVSOut {
  @builtin(position) position: vec4f,
  @location(0) p: vec2f,    // arrow-local device px: x lateral, y (≤0) behind the tip
  @location(1) @interpolate(flat) alphaComp: f32,
  @location(2) @interpolate(flat) scale: f32, // device px per arrow unit
  @location(3) @interpolate(flat) slot: u32,
}

${ ARROW_POLY.fns }

@vertex
fn vsArrow(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> ArrowVSOut {
  var out: ArrowVSOut;

  let slot = visible[ii];
  let isSource = end.isSource == 1u;
  let ends = endpoints[slot];
  let params = curveParams[slot];
  let tipSlot = select(ends.y, ends.x, isSource);

  // the point the end tangent runs from: the near control (bezier /
  // loop), or the first/last interior route point (12b families; with
  // no interior points — the 12c endpoint chord — the far endpoint)
  var toward: vec2f;
  var tip: vec2f;

  if (params.w <= 2.0) {
    let g = evalCurveGeom(
      params,
      nodePositions[ends.x], nodeOuterHalf[ends.x], nodeShapes[ends.x],
      nodePositions[ends.y], nodeOuterHalf[ends.y], nodeShapes[ends.y]
    );

    toward = select(g.c2, g.c1, isSource);

    // the tip sits on the tip node's boundary along the curve's end
    // tangent (border-inclusive outer halves, like the straight arrows)
    let tipC = modelToPx(frame, nodePositions[tipSlot]);
    let toTip = tipC - modelToPx(frame, toward);
    let dirB = toTip / max(length(toTip), 1e-4);
    let half = nodeOuterHalf[tipSlot] * frame.zoomDpr;

    tip = tipC - dirB * boundaryOffset(nodeShapes[tipSlot], half, dirB);
  } else {
    var route = evalRouteW(
      params,
      nodePositions[ends.x], nodeOuterHalf[ends.x], nodeShapes[ends.x],
      nodePositions[ends.y], nodeOuterHalf[ends.y], nodeShapes[ends.y]
    );
    let qn = route.n + 2u;

    if (route.n == 0u) { // the 12c endpoint chord: aim at the far endpoint
      toward = select(route.q[0u], route.q[1u], isSource);
    } else {
      toward = select(route.q[route.n], route.q[1u], isSource);
    }

    // the route's resolved endpoint IS the tip — for default modes it
    // equals the boundary point; for 12c manual endpoints it is the
    // manual/inside/shortened point (v3's arrowStart/End)
    tip = modelToPx(frame, select(route.q[qn - 1u], route.q[0u], isSource));
  }

  let toTip2 = tip - modelToPx(frame, toward);
  let len = max(length(toTip2), 1e-4);
  let dir = toTip2 / len;

  // sizing follows the drawn (floored) edge width; the curved stream is
  // never decimated, so the alpha comp is the plain width-floor ratio
  let widthPx = max(edgeWidths[slot] * frame.zoomDpr, frame.edgeWidthFloor);
  let alphaComp = min(edgeWidths[slot] * frame.zoomDpr / max(frame.edgeWidthFloor, 1e-4), 1.0);
  let arrowLen = widthPx * 3.0 + 2.0;
  let halfBase = widthPx * 1.5 + 1.0;

  let n = vec2f(-dir.y, dir.x);
  let corner = quadCorner(vi);
  let t = (corner.y + 1.0) * 0.5; // 0 at base, 1 at tip
  let yLocal = mix(-(arrowLen + 1.0), 1.0, t);
  let lateral = corner.x * (halfBase + 1.0);

  out.position = vec4f(pxToClip(frame, tip + dir * yLocal + n * lateral), EDGE_Z, 1.0);
  out.p = vec2f(lateral, yLocal);
  out.scale = arrowLen / 0.3;
  out.slot = slot;
  out.alphaComp = alphaComp;
  return out;
}

@fragment
fn fsArrow(in: ArrowVSOut) -> @location(0) vec4f {
  // edge opacity is pre-folded into the stored alpha at style-write
  // time; a=0 (no arrow at this end) renders fully transparent
  let c = unpack4x8unorm(arrows[in.slot]);
  let pair = arrowShapes[in.slot];
  let shape = select(pair >> 8u, pair & 0xffu, end.isSource == 1u);
  let p = in.p;
  let s = in.scale;
  var sd = 1e6;

  switch shape {
${ ARROW_POLY.cases }
    case 4u: { sd = length(p - vec2f(0.0, -0.15 * s)) - 0.15 * s; } // circle
    default: { sd = 1e6; } // none: fully discarded by alpha
  }

  let alpha = c.a * in.alphaComp * (1.0 - frame.edgeDim) * (1.0 - smoothstep(-0.75, 0.75, sd));
  return vec4f(c.rgb * alpha, alpha); // premultiplied
}
`;

/**
 * The label shader, generated for both streams: node labels anchor at the
 * node position, edge labels at the midpoint of the edge's endpoints —
 * computed here in the VS, so edge labels follow drags/layouts/position
 * tweens on-GPU with zero rebuild.
 */
const labelShader = ( edge: boolean ): string => `
${COMMON}
${GLYPH_STRUCT}
${ edge ? BOUNDARY_WGSL + CURVE_WGSL + ROUTE_WGSL : '' }
// flags columns are not bound here: the cull pass already dropped glyphs
// of dead/hidden owners.  The edge variant binds the curve inputs too —
// 7 storage buffers + the visible list (node size and border ride the
// derived outerHalf column; the curve param blob rides the freed slot),
// exactly the vertex-stage budget — so curved-edge labels anchor at the
// curve/route midpoint computed in the VS from live positions (zero
// rebuild on drags/layouts/tweens).
@group(0) @binding(0) var<uniform> frame: Frame;
@group(0) @binding(1) var<storage, read> glyphs: array<Glyph>;
${ edge ? '@group(0) @binding(2) var<storage, read> endpoints: array<vec2u>;\n@group(0) @binding(3) var<storage, read> nodePositions: array<vec2f>;\n@group(0) @binding(4) var<storage, read> curveParams: array<vec4f>;\n@group(0) @binding(5) var<storage, read> nodeOuterHalf: array<vec2f>;\n@group(0) @binding(6) var<storage, read> nodeShapes: array<u32>;\n@group(0) @binding(7) var<storage, read> curveBlob: array<f32>;\n@group(0) @binding(8) var atlas: texture_2d<f32>;\n@group(0) @binding(9) var atlasSampler: sampler;' : '@group(0) @binding(2) var<storage, read> nodePositions: array<vec2f>;\n@group(0) @binding(3) var atlas: texture_2d<f32>;\n@group(0) @binding(4) var atlasSampler: sampler;' }

struct LabelVSOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
  @location(1) color: vec4f,
  @location(2) fade: f32,
  @location(3) outlineColor: vec4f,
  @location(4) @interpolate(flat) outlineWidth: f32,
  // 0: glyph; 1: rectangle background quad; 2: round-rectangle quad (B6)
  @location(5) @interpolate(flat) solid: u32,
  @location(6) local: vec2f,                  // corner space [0,1]² (B6)
  @location(7) @interpolate(flat) quadPx: vec2f, // quad size, device px (B6)
}

@group(1) @binding(0) var<storage, read> visible: array<u32>;

@vertex
fn vsLabel(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> LabelVSOut {
  var out: LabelVSOut;

  // the cull pass compacted live, on-screen, non-faded glyphs
  let g = glyphs[visible[ii]];

  // LOD: fade out as the on-screen glyph shrinks (fully-faded glyphs were culled)
  let heightPx = glyphLodHeight(g) * frame.zoomDpr;
  let fade = labelFade(heightPx, frame.labelFadePx);

  // glyphs read live positions: labels follow drags/layouts on-GPU
  ${ edge
    ? `let owner = glyphOwner(g.nodeSlot);
  let ends = endpoints[owner];
  let pa = nodePositions[ends.x];
  let pb = nodePositions[ends.y];
  let params = curveParams[owner];
  var anchor = (pa + pb) * 0.5;
  // the autorotate frame endpoints: a bezier's t=0.5 tangent IS the
  // chord direction, so (pa, pb) stands; a loop's midpoint tangent runs
  // c1 -> c2; a 12b route's tangent comes from its midpoint rule
  var rotA = pa;
  var rotB = pb;

  if (params.w != 0.0 && params.w <= 2.0) { // bezier / loop midpoint
    let geom = evalCurveGeom(
      params,
      pa, nodeOuterHalf[ends.x], nodeShapes[ends.x],
      pb, nodeOuterHalf[ends.y], nodeShapes[ends.y]
    );

    anchor = geom.m;

    if (params.w == 2.0) {
      rotA = geom.c1;
      rotB = geom.c2;
    }
  } else if (params.w == 6.0) { // haystack (12c): the offset midpoint
    let ha = pa + vec2f(cos(params.x), sin(params.x)) * nodeOuterHalf[ends.x] * params.z;
    let hb = pb + vec2f(cos(params.y), sin(params.y)) * nodeOuterHalf[ends.y] * params.z;

    anchor = (ha + hb) * 0.5;
    rotA = ha;
    rotB = hb;
  } else if (params.w > 2.0 && params.w != 7.0) { // route families: v3's midpoint rules
    // (7.0 = straight-triangle keeps the chord default)
    var route = evalRouteW(
      params,
      pa, nodeOuterHalf[ends.x], nodeShapes[ends.x],
      pb, nodeOuterHalf[ends.y], nodeShapes[ends.y]
    );
    let midTan = routeMidpointW(&route);

    anchor = midTan.xy;
    rotA = anchor;
    rotB = anchor + midTan.zw;
  }`
    : 'let anchor = nodePositions[g.nodeSlot];' }
  let originPx = modelToPx(frame, anchor) + g.offset * frame.zoomDpr;
  let sizePx = g.size * frame.zoomDpr;
  let t = (quadCorner(vi) + vec2f(1.0)) * 0.5;
  var posPx = originPx + t * sizePx;
${ edge
    ? `
  // text-rotation: autorotate — rotate the run's local rect about the
  // midpoint anchor by the edge's flip-normalized angle (the angle reads
  // live positions too, so rotation follows drags/tweens on-GPU)
  if ((g.nodeSlot & GLYPH_ROTATE) != 0u) {
    let cs = autorotateFrame(rotA, rotB);
    let local = g.offset + t * g.size; // model px from the anchor

    posPx = modelToPx(frame, anchor) + rotateBy(cs, local) * frame.zoomDpr;
  }
`
    : '' }
  out.position = vec4f(pxToClip(frame, posPx), 0.0, 1.0);
  out.uv = mix(max(g.uv0, vec2f(0.0)), max(g.uv1, vec2f(0.0)), t);
  out.color = unpack4x8unorm(g.color);
  out.fade = fade;
  out.outlineColor = unpack4x8unorm(g.outlineColor);
  out.outlineWidth = g.outlineWidth;
  // solid quads: 2 = round-rectangle background (shape rides uv1.x — B6)
  out.solid = select(0u, select(1u, 2u, g.uv1.x == 1.0), g.uv0.x < 0.0);
  out.local = t;
  out.quadPx = g.size * frame.zoomDpr;
  return out;
}

@fragment
fn fsLabel(in: LabelVSOut) -> @location(0) vec4f {
  // the SDF encodes the glyph edge at 0.5; fwidth-based smoothing keeps
  // text crisp at any zoom from the one 32px-per-glyph atlas.  (Sampled
  // unconditionally: a branch around textureSample would be non-uniform.)
  let s = textureSample(atlas, atlasSampler, in.uv).r;
  let w = max(fwidth(s), 1e-4); // derivatives before any non-uniform branch

  if (in.solid != 0u) { // text background quad (B6: shape + border)
    let half = in.quadPx * 0.5;
    let p = (in.local - vec2f(0.5)) * in.quadPx;
    var sdq: f32;

    if (in.solid == 2u) { // round-rectangle, v3's auto radius
      let r = min(min(half.x, half.y) * 0.5, 8.0 * frame.zoomDpr);
      let q = abs(p) - half + vec2f(r);

      sdq = min(max(q.x, q.y), 0.0) + length(max(q, vec2f(0.0))) - r;
    } else {
      let d = abs(p) - half;

      sdq = min(max(d.x, d.y), 0.0) + length(max(d, vec2f(0.0)));
    }

    var rgb = in.color.rgb;
    var colA = in.color.a;
    // text-border (B6): a band drawn inward from the padded box
    // (in.outlineColor/Width double as the border for solid quads;
    // the width is model px here, unlike the glyphs' SDF units)
    let bw = in.outlineWidth * frame.zoomDpr;

    if (bw > 0.0 && in.outlineColor.a > 0.0 && sdq > -bw) {
      rgb = in.outlineColor.rgb;
      colA = in.outlineColor.a;
    }

    let a = (1.0 - smoothstep(-0.75, 0.75, sdq)) * colA * in.fade;

    return vec4f(rgb * a, a);
  }

  let fillA = clamp((s - 0.5) / w + 0.5, 0.0, 1.0);
  var rgb = in.color.rgb;
  var alpha = fillA * in.color.a;

  // text-outline: a second, lower distance threshold ringing the glyph
  if (in.outlineWidth > 0.0 && in.outlineColor.a > 0.0) {
    let outerA = clamp((s - (0.5 - in.outlineWidth)) / w + 0.5, 0.0, 1.0);
    rgb = mix(in.outlineColor.rgb, in.color.rgb, fillA);
    alpha = max(alpha, outerA * in.outlineColor.a);
  }

  alpha = alpha * in.fade;
  return vec4f(rgb * alpha, alpha); // premultiplied
}
`;

export const LABEL_SHADER = labelShader( false );
export const EDGE_LABEL_SHADER = labelShader( true );
