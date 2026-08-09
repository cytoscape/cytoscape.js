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

import { wgsl } from './wgsl.mjs';
import {
  ARROW_AXIAL_DEPTH,
  ARROW_COMPOUND_POINTS,
  ARROW_GAP_CONST,
  ARROW_GAP_K,
  ARROW_GAP_K_DEFAULT,
  ARROW_MAX_BACK,
  ARROW_MAX_FRONT,
  ARROW_POINTS,
  POLYGON_POINTS,
  ROUND_POLYGON_SOURCE,
} from '../shape-points.mjs';
import {
  IMAGE_TIER_SIZES as IMAGE_TIER_SIZES_WGSL,
  SDF_IMAGE_SIZE as SDF_IMAGE_SIZE_WGSL,
} from '../image-registry.mjs';
import {
  AVOID_IMPOSSIBLE_BEZIER,
  AVOID_IMPOSSIBLE_BEZIER_L,
  CURVE_SEGS,
  MAX_CURVE_PTS,
} from '../curve-geometry.mjs';
// the packing constants are interpolated into the WGSL below, so the
// shaders and the store read one source of truth (round 27.1)
import {
  ARROW_SHAPE_MASK,
  BORDER_STYLE_SHIFT,
  OUTLINE_STYLE_SHIFT,
  STROKE_STYLE_MASK,
  STROKE_DASHED,
  STROKE_DOTTED,
  STROKE_DOUBLE,
  ARROW_SHIFT_HOLLOW_SOURCE,
  ARROW_SHIFT_HOLLOW_TARGET,
  ARROW_SHIFT_MID_SOURCE,
  ARROW_SHIFT_MID_TARGET,
  ARROW_SHIFT_SCALE,
  ARROW_SHIFT_SOURCE,
  ARROW_SHIFT_SRC_SHOWS_LINE,
  ARROW_SHIFT_TARGET,
  ARROW_SHIFT_TGT_SHOWS_LINE,
  CUT_RECTANGLE_CORNER,
  ARROW_CIRCLE,
  ARROW_CIRCLE_TRIANGLE,
  ARROW_CIRCLE_TRIANGLE_RADIUS,
  ARROW_TEE,
  ARROW_TRIANGLE_CROSS,
  ARROW_TRIANGLE_TEE,
  BARREL_CTRL_OFFSET_PCT,
  BARREL_CURVE_SEGMENTS,
  BARREL_HEIGHT_OFFSET_MAX,
  BARREL_HEIGHT_OFFSET_PCT,
  BARREL_WIDTH_OFFSET_MAX,
  BARREL_WIDTH_OFFSET_PCT,
  ROUND_POLYGON_RADIUS_DIV,
  ROUND_POLYGON_RADIUS_MAX,
  SHAPE_BARREL,
  SHAPE_BOTTOM_ROUND_RECTANGLE,
  SHAPE_CUT_RECTANGLE,
  SHAPE_MASK,
  SHAPE_POLYGON_CUSTOM,
  SHAPE_ROUND_TAG,
  SHAPE_ROUND_TRIANGLE,
  SHAPE_SHIFT,
} from '../contract.mjs';

/**
 * The per-frame uniform block.  Not a mat3x3 (avoids WGSL alignment
 * footguns); computed CPU-side from the core viewport + device pixel ratio.
 * Layout must match Renderer's frame arrays: viewportPx, panPx, zoomDpr,
 * edgeWidthFloor, nodeLodPx, hidePx, edgeDim, labelFadePx, labelMinPx,
 * curveSlack, haystackSlack, outlineSlack, arrowScaleMax, imageMinPx,
 * pickMode, arrowWidthMax, pickPadPx — 19 floats; WGSL rounds the
 * struct to 80 bytes (align 8), so the arrays allocate 20.
 */
export const FRAME_STRUCT = wgsl`
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
  arrowScaleMax: f32,    // B7: max arrow-scale styled (arrow quads size for it)
  imageMinPx: f32,       // 15.7: skip image sampling below this on-screen node size (displayed px)
  pickMode: f32,         // 20.2: 1 in the pick pass — events:'no' elements drop from pick culling only
  arrowWidthMax: f32,    // 56: max hollow-arrow stroke, model px (the quad grows by half of it)
  pickPadPx: f32,        // 57.9: edge hit-test halo, device px — v3's edgeThreshold; 0 outside pick frames
}
`;

/** Shared WGSL prelude: flags, transforms, quad corners and the LOD
 * functions used by both the cull-pass predicates and the vertex shaders
 * (they must agree exactly on what is drawn and at what alpha). */
export const COMMON = wgsl`
${FRAME_STRUCT}

const FLAG_ALIVE: u32 = 1u;
const FLAG_VISIBLE: u32 = 2u;
const FLAG_CURVED: u32 = 1024u; // edge renders in the curved stream (store-managed)
// the curve is not chord-bounded (taxi, extrapolated weights): cull by
// the endpoint AABB grown by slack + chord length instead (12b)
const FLAG_CURVED_BOX: u32 = 2048u;
// compound parent (round 14.9, node-only, store-managed): parents draw
// in their own pre-edge stream, so the main node cull excludes them
const FLAG_PARENT: u32 = 4096u;
const FLAG_NO_EVENTS: u32 = 32768u; // 20.2: pointer-transparent (pick-mode culls only)
const SHOWN: u32 = 262145u; // ALIVE | DRAWN (round 22: the draw tier — visibility folds in)

// Selection has no shader constant since round 57.1: v4's *default
// stylesheet* gives it a colour, as a { selected: true } case mapper on
// the node fill, the edge line and the four arrow colours.  So the
// colour arrives here the way every other colour does — resolved into
// its channel column — and an app that declares those props replaces
// the rule, which a shader constant could not have allowed.
//
// v3's :active is still drawn (the layer shader below): it is an
// *overlay*, and an overlay for a transient pointer state has no stored
// truth to be the default of.

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
 * pass; matches GlyphBuffer's CPU layout (16 words / 64 bytes per glyph). */
export const GLYPH_STRUCT = wgsl`
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
  zoomDprMin: f32,   // min-zoomed-font-size / fontSize (D2); 0 = no floor
  endParam: f32,     // end-label encoding (D4): 0 = midpoint stream; else
                     // sign picks the end (+source / -target) and
                     // |endParam| - 1 is the arc offset in model px
  rotation: f32,     // 27.7: the label's own rotation, radians (0 = none;
                     // autorotate rides the owner word's flag instead)
  pad: f32,          // keeps the struct 8-byte aligned (16 words)
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
export const BOUNDARY_WGSL = wgsl`
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
export const DASH_WGSL = wgsl`
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
const fmtF32 = (x: number): string => x.toFixed(8);

const polygonSdFns = (): {
  fns: string;
  cases: string;
  perimFns: string;
  perimCases: string;
} => {
  let fns = '';
  let cases = '';
  let perimFns = '';
  let perimCases = '';

  for (const [id, pts] of POLYGON_POINTS) {
    const n = pts.length / 2;
    const lits = Array.from(
      { length: n },
      (_, i) => `vec2f(${fmtF32(pts[i * 2])}, ${fmtF32(pts[i * 2 + 1])})`,
    ).join(', ');

    // https://iquilezles.org/articles/distfunctions2d/ sdPolygon
    fns += `
fn poly${id}SD(p: vec2f, half: vec2f) -> f32 {
  var v = array<vec2f, ${n}>(${lits});
  for (var k = 0; k < ${n}; k++) { v[k] = v[k] * half; }
  var d = dot(p - v[0], p - v[0]);
  var s = 1.0;
  var j = ${n - 1};
  for (var i = 0; i < ${n}; i++) {
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
    cases += `    case ${id}u: { return poly${id}SD(p, half); }\n`;

    // round 38: the perimeter twin — the same vertex list walked in
    // v3's path order (drawPolygonPath: moveTo(points[0]), lineTo
    // forward), tracking the argmin edge and its clamped projection
    // against a cumulative arc length.  Scaled per fragment because the
    // half-size scales edges anisotropically.
    perimFns += `
fn poly${id}Perim(p: vec2f, half: vec2f) -> f32 {
  var v = array<vec2f, ${n}>(${lits});
  for (var k = 0; k < ${n}; k++) { v[k] = v[k] * half; }
  var best = 1e30;
  var u = 0.0;
  var cum = 0.0;
  for (var i = 0; i < ${n}; i++) {
    let a = v[i];
    let b = v[(i + 1) % ${n}];
    let e = b - a;
    let len = length(e);
    let t = clamp(dot(p - a, e) / max(dot(e, e), 1e-12), 0.0, 1.0);
    let q = a + e * t - p;
    let d = dot(q, q);
    if (d < best) { best = d; u = cum + t * len; }
    cum = cum + len;
  }
  return u;
}
`;
    perimCases += `    case ${id}u: { return poly${id}Perim(p, half); }\n`;
  }

  // Round-corner shapes (27.4).  A polygon with every corner replaced by
  // a tangent arc of radius r is exactly the Minkowski sum of the
  // *inward-offset* polygon with a disc of radius r — so the distance
  // field is sdPolygon(offset) - r, which stays exact under anisotropic
  // scaling where the naive "offset the sharp polygon's SDF" does not.
  // That anisotropy is precisely why the family was deferred in round 13.
  //
  // The offset vertices are the standard miter form
  //   o = v + r * (n1 + n2) / (1 + dot(n1, n2))
  // with n1/n2 the inward edge normals.  The winding sign is folded in
  // at codegen (signed area), so the shader does no orientation test.
  for (const [id, source] of ROUND_POLYGON_SOURCE) {
    const pts = POLYGON_POINTS.get(source) as readonly number[];
    const n = pts.length / 2;
    const lits = Array.from(
      { length: n },
      (_, i) => `vec2f(${fmtF32(pts[i * 2])}, ${fmtF32(pts[i * 2 + 1])})`,
    ).join(', ');

    // signed area in unit space: positive means counter-clockwise, which
    // decides which perpendicular of an edge points into the shape
    let area2 = 0;

    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;

      area2 += pts[i * 2] * pts[j * 2 + 1] - pts[j * 2] * pts[i * 2 + 1];
    }

    const wind = area2 > 0 ? '1.0' : '-1.0';

    fns += `
fn roundPoly${id}SD(p: vec2f, half: vec2f, r: f32) -> f32 {
  var v = array<vec2f, ${n}>(${lits});
  for (var k = 0; k < ${n}; k++) { v[k] = v[k] * half; }
  // keep the offset polygon non-degenerate; v3's 'auto' radius is well
  // inside this, and an over-large explicit corner-radius clamps here
  let rr = min(r, min(half.x, half.y) * 0.5);
  var o = array<vec2f, ${n}>();
  for (var i = 0; i < ${n}; i++) {
    let prev = v[(i + ${n - 1}) % ${n}];
    let next = v[(i + 1) % ${n}];
    let e1 = normalize(v[i] - prev);
    let e2 = normalize(next - v[i]);
    let n1 = vec2f(-e1.y, e1.x) * ${wind};
    let n2 = vec2f(-e2.y, e2.x) * ${wind};
    let denom = 1.0 + dot(n1, n2);
    o[i] = v[i] + select(vec2f(0.0), (n1 + n2) * (rr / denom), denom > 1e-4);
  }
  var d = dot(p - o[0], p - o[0]);
  var s = 1.0;
  var j = ${n - 1};
  for (var i = 0; i < ${n}; i++) {
    let e = o[j] - o[i];
    let w = p - o[i];
    let b = w - e * clamp(dot(w, e) / dot(e, e), 0.0, 1.0);
    d = min(d, dot(b, b));
    let c1 = p.y >= o[i].y;
    let c2 = p.y < o[j].y;
    let c3 = e.x * w.y > e.y * w.x;
    if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) { s = -s; }
    j = i;
  }
  return s * sqrt(d) - rr;
}
`;
    cases += `    case ${id}u: { return roundPoly${id}SD(p, half, radius); }\n`;
    // round 38: the round-* dash coordinate walks the SOURCE polygon's
    // edges — a recorded approximation: the drawn boundary's corner
    // arcs are slightly shorter than the sharp corners, so the dash
    // phase drifts by the arc/miter difference at each corner
    perimCases += `    case ${id}u: { return poly${source}Perim(p, half); }\n`;
  }

  return { fns, cases, perimFns, perimCases };
};

const POLY = polygonSdFns();

// Arrowhead SDFs generated from the shared v3 point tables (tip at the
// local origin, body toward negative y, scaled uniformly by `s`).
const arrowSdFns = (): { fns: string; cases: string } => {
  let fns = '';
  let cases = '';

  for (const [id, pts] of ARROW_POINTS) {
    const n = pts.length / 2;
    const lits = Array.from(
      { length: n },
      (_, i) => `vec2f(${fmtF32(pts[i * 2])}, ${fmtF32(pts[i * 2 + 1])})`,
    ).join(', ');

    fns += `
fn arrow${id}SD(p: vec2f, s: f32) -> f32 {
  var v = array<vec2f, ${n}>(${lits});
  for (var k = 0; k < ${n}; k++) { v[k] = v[k] * s; }
  var d = dot(p - v[0], p - v[0]);
  var sgn = 1.0;
  var j = ${n - 1};
  for (var i = 0; i < ${n}; i++) {
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
    cases += `    case ${id}u: { sd = arrow${id}SD(p, s); }\n`;
  }

  // Compound arrowheads (27.6): a union of disjoint parts.  Coverage is
  // a smoothstep over the distance, so the union is min(sdA, sdB) and
  // the parts need no stitching.  Each part gets its own generated
  // function; the dispatch case takes the min.
  for (const [id, parts] of ARROW_COMPOUND_POINTS) {
    parts.forEach((pts, part) => {
      const n = pts.length / 2;
      const lits = Array.from(
        { length: n },
        (_, i) => `vec2f(${fmtF32(pts[i * 2])}, ${fmtF32(pts[i * 2 + 1])})`,
      ).join(', ');

      fns += `
fn arrow${id}p${part}SD(p: vec2f, s: f32) -> f32 {
  var v = array<vec2f, ${n}>(${lits});
  for (var k = 0; k < ${n}; k++) { v[k] = v[k] * s; }
  var d = dot(p - v[0], p - v[0]);
  var sgn = 1.0;
  var j = ${n - 1};
  for (var i = 0; i < ${n}; i++) {
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
    });
  }

  // triangle-tee: the triangle plus its detached bar
  cases +=
    `    case ${ARROW_TRIANGLE_TEE}u: { ` +
    `sd = min(arrow${ARROW_TRIANGLE_TEE}p0SD(p, s), arrow${ARROW_TRIANGLE_TEE}p1SD(p, s)); }\n`;

  // circle-triangle: v3's frame, the disc centred on the arrow origin
  // with the triangle behind it.  Before round 56 both this disc and the
  // point table were shifted a radius back so the drawn result was right
  // without the tip carrying `spacing`; 56 applies `spacing` to the tip
  // for every shape instead, so the frame is v3's and the accessors can
  // report the same point.
  cases +=
    `    case ${ARROW_CIRCLE_TRIANGLE}u: { ` +
    `sd = min(arrow${ARROW_CIRCLE_TRIANGLE}p0SD(p, s), ` +
    `length(p) - ${ARROW_CIRCLE_TRIANGLE_RADIUS} * s); }\n`;

  // triangle-cross: the bar's thickness tracks the *edge width*, not the
  // arrow size, so its points cannot be a static table — this is why the
  // arrow fragment stage carries the model width as a varying (27.3)
  cases +=
    `    case ${ARROW_TRIANGLE_CROSS}u: { ` +
    `sd = min(arrow${ARROW_TRIANGLE_CROSS}p0SD(p, s), crossBarSD(p, s, in.widthModel * frame.zoomDpr)); }\n`;

  return { fns, cases };
};

const ARROW_POLY = arrowSdFns();
/**
 * v3's `gap( edge )` and `spacing( edge )` as WGSL, **generated from the
 * same tables `arrowGap`/`arrowSpacing` read** (round 56).
 *
 * The dual-implementation discipline this file uses for curves says the
 * two sides must agree by construction rather than by review.  For a
 * lookup table the strongest form of that is to emit one side from the
 * other, which is what this does: adding a head to `ARROW_GAP_K` changes
 * the shader with no second edit, and a spec asserts the generated
 * source names every id the table does.
 *
 * `spacing` is not table-driven — it is three special cases in v3 — so it
 * is written out, with the two disc heads sharing `arrowSizeW`.
 */
const arrowGapFns = (): string => {
  let cases = '';

  for (const [id, k] of ARROW_GAP_K) {
    cases += `    case ${id}u: { return ${fmtF32(k)} * wModel * scale; }\n`;
  }

  for (const [id, c] of ARROW_GAP_CONST) {
    cases += `    case ${id}u: { return ${fmtF32(c)}; }\n`;
  }

  let depths = '';

  for (const [id, d] of ARROW_AXIAL_DEPTH) {
    depths += `    case ${id}u: { return ${fmtF32(d)}; }\n`;
  }

  return wgsl`
// v3's getArrowWidth: the arrow size unit, in *model* px (27.3 — the 29
// is a model-space floor, so this must not see a device width)
fn arrowSizeW(wModel: f32, scale: f32) -> f32 {
  return max(pow(wModel * 13.37, 0.9), 29.0) * scale;
}

// v3's arrowShapes[shape].gap(edge): how far behind the node boundary
// the drawn line stops.  Generated from ARROW_GAP_K / ARROW_GAP_CONST.
fn arrowGapW(shape: u32, wModel: f32, scale: f32) -> f32 {
  switch shape {
${cases}    default: { return ${fmtF32(ARROW_GAP_K_DEFAULT)} * wModel * scale; }
  }
}

// v3's arrowShapes[shape].spacing(edge): how far behind the node
// boundary the arrow *tip* sits.  Non-zero for three heads only.
fn arrowSpacingW(shape: u32, wModel: f32, scale: f32) -> f32 {
  if (shape == ${ARROW_TEE}u) { return 1.0; }
  if (shape == ${ARROW_CIRCLE}u || shape == ${ARROW_CIRCLE_TRIANGLE}u) {
    return arrowSizeW(wModel, scale) * ${fmtF32(ARROW_CIRCLE_TRIANGLE_RADIUS)};
  }
  return 0.0;
}

// The shape ids for this edge's two ends, unpacked from edge.width's
// lane 1 (round 56 — the arrow word rides there so the vertex stages,
// which have no spare storage-buffer slot, can reach it).
fn arrowWordOf(w: vec2f) -> u32 { return bitcast<u32>(w.y); }
fn srcShapeOf(word: u32) -> u32 { return (word >> ${ARROW_SHIFT_SOURCE}u) & ${ARROW_SHAPE_MASK}u; }
fn tgtShapeOf(word: u32) -> u32 { return (word >> ${ARROW_SHIFT_TARGET}u) & ${ARROW_SHAPE_MASK}u; }
fn scaleOfWord(word: u32) -> f32 {
  let q = word >> ${ARROW_SHIFT_SCALE}u;
  return select(f32(q) / 16.0, 1.0, q == 0u);
}

// How far back the head covers the edge's axis contiguously, in
// arrow-frame units.  Generated from ARROW_AXIAL_DEPTH — see the note
// there for why this is not ARROW_BACK.
fn arrowAxialDepthW(shape: u32) -> f32 {
  switch shape {
${depths}    default: { return 0.0; }
  }
}

// Where the *drawn* line stops, in model px.
//
// v3 does not trim: it paints the line in full and then erases the
// head's footprint out of the canvas (destination-out), so the visible
// line ends wherever the head's shape ends.  v4 reproduces that with a
// trim, which costs no second pass, no extra pipeline and no change to
// how cy.png composites its background — but a trim is one distance, so
// it takes the deeper of v3's own gap and the head's contiguous axial
// depth.  Under the gap the line is inside the head either way; past the
// depth the head no longer covers the axis and v3 would show the line
// (a vee's notch is the case that makes this not simply ARROW_BACK).
fn arrowDrawTrimW(shape: u32, showsLine: bool, wModel: f32, scale: f32) -> f32 {
  let gap = arrowGapW(shape, wModel, scale);

  // An opaque filled head hides the line under it either way, so v3's
  // gap is exactly right and shortening further would cut the slivers v3
  // leaves where the head is narrower than the line.  A head that shows
  // the line — hollow, or translucent — is hidden by v3's *erase*
  // instead, which reaches the head's own depth.
  if (!showsLine) { return gap; }

  return max(gap, arrowAxialDepthW(shape) * arrowSizeW(wModel, scale));
}

// The four shortenings for one edge, packed for the curve evaluators:
// (srcDrawTrim, tgtDrawTrim, srcSpacing, tgtSpacing).  The ArrowTrim
// twin — same order, same meaning.
fn arrowTrimOf(w: vec2f) -> vec4f {
  let word = arrowWordOf(w);
  let scale = scaleOfWord(word);
  let src = srcShapeOf(word);
  let tgt = tgtShapeOf(word);
  // derived by the store, mirror-only: hollow or translucent
  let srcShows = ((word >> ${ARROW_SHIFT_SRC_SHOWS_LINE}u) & 1u) == 1u;
  let tgtShows = ((word >> ${ARROW_SHIFT_TGT_SHOWS_LINE}u) & 1u) == 1u;

  return vec4f(
    arrowDrawTrimW(src, srcShows, w.x, scale),
    arrowDrawTrimW(tgt, tgtShows, w.x, scale),
    arrowSpacingW(src, w.x, scale),
    arrowSpacingW(tgt, w.x, scale));
}

// v3's shortenIntersection, verbatim including the degenerate clamp: the
// boundary point moved by 'amount' toward the far point, never past it.
fn shortenTowardW(pt: vec2f, toward: vec2f, amount: f32) -> vec2f {
  let disp = pt - toward;
  let len = length(disp);
  var ratio = (len - amount) / max(len, 1e-6);
  if (ratio < 0.0) { ratio = 0.00001; }
  return toward + disp * ratio;
}
`;
};

const ARROW_GAP_WGSL = arrowGapFns();

// SDFs ported from shader-sdf.mts (https://iquilezles.org/articles/distfunctions2d/)
const SDF = wgsl`
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

${POLY.fns}
// custom polygon (C3): iq's sdPolygon over unit points from the poly
// blob, scaled to device space (exact distance, like the generated
// shapes); ref packs offset | count << 24
fn customPolySD(p: vec2f, half: vec2f, polyRef: u32) -> f32 {
  let off = polyRef & 0xffffffu;
  let count = polyRef >> 24u;

  if (count < 3u) { return 1e6; }

  let v0 = vec2f(polyBlob[off], polyBlob[off + 1u]) * half;
  var d = dot(p - v0, p - v0);
  var sgn = 1.0;
  var j = count - 1u;

  for (var i = 0u; i < count; i = i + 1u) {
    let vi = vec2f(polyBlob[off + i * 2u], polyBlob[off + i * 2u + 1u]) * half;
    let vj = vec2f(polyBlob[off + j * 2u], polyBlob[off + j * 2u + 1u]) * half;
    let e = vj - vi;
    let w = p - vi;
    let b = w - e * clamp(dot(w, e) / dot(e, e), 0.0, 1.0);

    d = min(d, dot(b, b));

    let c1 = p.y >= vi.y;
    let c2 = p.y < vj.y;
    let c3 = e.x * w.y > e.y * w.x;

    if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) { sgn = -sgn; }

    j = i;
  }

  return sgn * sqrt(d);
}

// A rectangle with its four corners chamfered by 'cut' (v3's
// cut-rectangle, round 27.2).  The chamfered box is the box intersected
// with the diagonal half-plane |x| + |y| <= hw + hh - cut, and the max
// of two exact convex distance fields is itself exact — the same
// standard the generated polygons meet.
fn cutRectangleSD(p: vec2f, half: vec2f, cut: f32) -> f32 {
  let c = min(cut, min(half.x, half.y));
  let diag = (abs(p.x) + abs(p.y) - (half.x + half.y - c)) * 0.70710678;

  return max(rectangleSD(p, half), diag);
}

// v3's barrel (27.5): a rectangle whose four corners are quadratic
// beziers.  The corner offsets are size-relative until they hit absolute
// caps, so the outline is rebuilt per fragment rather than baked into a
// unit table.  Each corner is sampled into BARREL_CURVE_SEGMENTS
// segments — the same fidelity v3's own hit test uses — and the
// resulting closed polygon runs through the standard exact-polygon
// distance loop, so sign and distance are exact for that outline.
fn barrelSD(p: vec2f, half: vec2f, zoomDpr: f32) -> f32 {
  let hOff = min(${BARREL_HEIGHT_OFFSET_MAX}.0 * zoomDpr, ${BARREL_HEIGHT_OFFSET_PCT} * half.y * 2.0);
  let wOff = min(${BARREL_WIDTH_OFFSET_MAX}.0 * zoomDpr, ${BARREL_WIDTH_OFFSET_PCT} * half.x * 2.0);
  let ctrl = ${BARREL_CTRL_OFFSET_PCT} * half.x * 2.0;
  let x0 = -half.x;
  let x1 = half.x;
  let y0 = -half.y;
  let y1 = half.y;

  // the four corners, clockwise from the top-left, as (start, control, end)
  var a = array<vec2f, 4>(
    vec2f(x0, y0 + hOff), vec2f(x1 - wOff, y0), vec2f(x1, y1 - hOff), vec2f(x0 + wOff, y1));
  var c = array<vec2f, 4>(
    vec2f(x0 + ctrl, y0), vec2f(x1 - ctrl, y0), vec2f(x1 - ctrl, y1), vec2f(x0 + ctrl, y1));
  var b = array<vec2f, 4>(
    vec2f(x0 + wOff, y0), vec2f(x1, y0 + hOff), vec2f(x1 - wOff, y1), vec2f(x0, y1 - hOff));

  const N: i32 = 4 * (${BARREL_CURVE_SEGMENTS} + 1);
  var v = array<vec2f, N>();
  var k = 0;

  for (var i = 0; i < 4; i++) {
    for (var j = 0; j <= ${BARREL_CURVE_SEGMENTS}; j++) {
      let t = f32(j) / ${BARREL_CURVE_SEGMENTS}.0;
      let u = 1.0 - t;

      v[k] = a[i] * (u * u) + c[i] * (2.0 * u * t) + b[i] * (t * t);
      k = k + 1;
    }
  }

  var d = dot(p - v[0], p - v[0]);
  var s = 1.0;
  var jj = N - 1;

  for (var i = 0; i < N; i++) {
    let e = v[jj] - v[i];
    let w = p - v[i];
    let bb = w - e * clamp(dot(w, e) / dot(e, e), 0.0, 1.0);
    d = min(d, dot(bb, bb));
    let c1 = p.y >= v[i].y;
    let c2 = p.y < v[jj].y;
    let c3 = e.x * w.y > e.y * w.x;
    if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) { s = -s; }
    jj = i;
  }

  return s * sqrt(d);
}

// v3's bottom-round-rectangle (27.4): only the two bottom corners are
// rounded.  Built from the round-rectangle field with the top corners'
// radius set to zero, which is a per-corner radius selected by the sign
// of p.y — exact, since the box SDF is separable that way.
fn bottomRoundRectangleSD(p: vec2f, half: vec2f, r: f32) -> f32 {
  let rr = select(0.0, min(r, min(half.x, half.y)), p.y > 0.0);
  let q = abs(p) - half + vec2f(rr, rr);

  return min(max(q.x, q.y), 0.0) + length(max(q, vec2f(0.0))) - rr;
}

// shape ids match contract.mts: 0 circle, 1 ellipse, 2 rectangle,
// 3 round-rectangle, 4+ generated polygon shapes, 14 custom polygon
// (C3 — polyRef packs its blob record), 17 cut-rectangle (27.2).
// radius is the round-rectangle corner radius in device px, pre-resolved
// (B2); cut-rectangle reads the same word as its chamfer length.
fn nodeSD(shape: u32, p: vec2f, half: vec2f, radius: f32, polyRef: u32, zoomDpr: f32) -> f32 {
  switch shape {
    case 0u: { return circleSD(p, half.x); }
    case 1u: { return ellipseSD(p, half); }
    case 2u: { return rectangleSD(p, half); }
${POLY.cases}
    case ${SHAPE_POLYGON_CUSTOM}u: { return customPolySD(p, half, polyRef); }
    case ${SHAPE_CUT_RECTANGLE}u: { return cutRectangleSD(p, half, radius); }
    case ${SHAPE_BOTTOM_ROUND_RECTANGLE}u: { return bottomRoundRectangleSD(p, half, radius); }
    case ${SHAPE_BARREL}u: { return barrelSD(p, half, zoomDpr); }
    default: { return roundRectangleSD(p, half, min(radius, min(half.x, half.y))); }
  }
}

// corner-radius 'auto' (B2): v3's min(w/4, h/4, 8) in model px.
// The stored value is u16.8 fixed-point; 0xffffffff means auto.
fn cornerRadiusPx(stored: u32, half: vec2f, zoomDpr: f32) -> f32 {
  if (stored == 0xffffffffu) { return min(min(half.x, half.y) * 0.5, 8.0 * zoomDpr); }
  return f32(stored) / 256.0 * zoomDpr;
}

// The same word, resolved for cut-rectangle (27.2): v3's 'auto' chamfer
// is a flat CUT_RECTANGLE_CORNER model px, *not* round-rectangle's
// size-relative rule — the two shapes read one prop with two defaults,
// as they do in v3.  (The constant's name is spelled out rather than
// interpolated: an interpolation inside a WGSL comment is a build error
// under the round-52 comment-strip transform.)
fn cornerLengthPx(shape: u32, stored: u32, half: vec2f, zoomDpr: f32) -> f32 {
  if (stored == 0xffffffffu) {
    if (shape == ${SHAPE_CUT_RECTANGLE}u) {
      return ${CUT_RECTANGLE_CORNER}.0 * zoomDpr;
    }
    // 27.4: the round-* family's 'auto' is v3's getRoundPolygonRadius —
    // a third meaning for the one prop, as in v3
    if (shape >= ${SHAPE_ROUND_TRIANGLE}u && shape <= ${SHAPE_ROUND_TAG}u) {
      return min(
        min(half.x, half.y) * 2.0 / ${ROUND_POLYGON_RADIUS_DIV}.0,
        ${ROUND_POLYGON_RADIUS_MAX}.0 * zoomDpr);
    }
  }
  return cornerRadiusPx(stored, half, zoomDpr);
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

/**
 * Round 38: the arc-length coordinate for dashed borders/outlines — the
 * position along the shape outline, in device px, of the boundary point
 * nearest the fragment.  u = 0 and the walk direction match v3's canvas
 * path construction per shape, because the dash pattern's phase starts
 * where the path starts and the parity diff sees a half-period phase
 * error as anti-aligned dashes.  Only evaluated when a dash style is
 * active (the fsNode branch), so solid borders pay nothing.
 */
const NODE_PERIM_WGSL = wgsl`
// v3's ellipse path starts at parameter 0 (the rightmost point),
// sweeping y-down positive, and the canvas dashes it by TRUE arc
// length — so this integrates the elliptic arc numerically (composite
// Simpson, 20 intervals) rather than approximating by angle.  The
// round-38 plan budgeted an angle-parameterized approximation with a
// recorded deviation; measured, that deviation was LARGER than the
// difference dashing makes at all (5.0% vs 3.6% on the parity scene —
// the scene could not discriminate), so the exact integral is what
// shipped.  Cost is dash-gated: solid borders never run this.
// Two conversions matter: the fragment's RADIAL angle is not the
// path parameter (P = (a cos t, b sin t) sits at radial angle
// atan2(b sin t, a cos t)), so t recovers via atan2(y/b, x/a).
fn ellipsePerimCoord(p: vec2f, half: vec2f) -> f32 {
  let a = half.x;
  let b = half.y;
  var t = atan2(p.y / max(b, 1e-6), p.x / max(a, 1e-6));

  // the radial estimate SHEARS across the border band (measured: +-2 px
  // of phase over a +-2.5 px band — two whole dot periods), because a
  // fragment off the boundary is not radially aligned with its nearest
  // path point.  Two Newton steps to the nearest-point parameter bring
  // the worst error to 0.003 px.
  for (var k = 0; k < 2; k++) {
    let st = sin(t);
    let ct = cos(t);
    let fx = a * ct - p.x;
    let fy = b * st - p.y;
    let f = fx * (-a * st) + fy * (b * ct);
    let fp = (a * st) * (a * st) + fx * (-a * ct) + (b * ct) * (b * ct) + fy * (-b * st);

    if (abs(fp) > 1e-9) { t = t - f / fp; }
  }

  if (t < 0.0) { t = t + 6.28318530718; }

  // 48 intervals: v3's dotted borders are [1, 1] — a 2-model-px period
  // — so the phase needs sub-half-pixel accuracy over the whole arc
  let h = t / 48.0;
  var sum = 0.0;

  for (var i = 0; i <= 48; i++) {
    let ti = h * f32(i);
    let sn = sin(ti);
    let cs = cos(ti);
    let f = sqrt(a * a * sn * sn + b * b * cs * cs);
    var w = 2.0;

    if (i == 0 || i == 48) { w = 1.0; }
    else if ((i % 2) == 1) { w = 4.0; }

    sum = sum + w * f;
  }

  return sum * h / 3.0;
}

// v3's rectangle is the 4-gon (-1,-1) (-1,1) (1,1) (1,-1): the path
// starts at the top-left corner and runs DOWN the left side first
fn rectanglePerim(p: vec2f, half: vec2f) -> f32 {
  let dl = abs(p.x + half.x);
  let dr = abs(p.x - half.x);
  let dt = abs(p.y + half.y);
  let db = abs(p.y - half.y);
  let cx = clamp(p.x, -half.x, half.x);
  let cy = clamp(p.y, -half.y, half.y);
  let m = min(min(dl, dr), min(dt, db));

  if (m == dl) { return cy + half.y; }
  if (m == db) { return 2.0 * half.y + (cx + half.x); }
  if (m == dr) { return 2.0 * half.y + 2.0 * half.x + (half.y - cy); }
  return 4.0 * half.y + 2.0 * half.x + (half.x - cx);
}

// v3's round-rectangle path starts at the TOP MIDDLE and runs clockwise
// (arcTo corners); u accumulates run - arc - side - arc - ... exactly
fn roundRectanglePerim(p: vec2f, half: vec2f, rIn: f32) -> f32 {
  let r = min(rIn, min(half.x, half.y));
  let cx = half.x - r;
  let cy = half.y - r;
  let arc = 1.57079632679 * r;
  let cum1 = cx + arc;                    // right side start
  let cum2 = cum1 + 2.0 * cy + arc;       // bottom start
  let cum3 = cum2 + 2.0 * cx + arc;       // left side start
  let cum4 = cum3 + 2.0 * cy + arc;       // top-left run start

  let qx = abs(p.x) - cx;
  let qy = abs(p.y) - cy;

  if (qx > 0.0 && qy > 0.0) {
    let phi = atan2(qy, qx); // [0, pi/2] out from the corner centre
    if (p.x >= 0.0 && p.y < 0.0) { return cx + (1.57079632679 - phi) * r; }
    if (p.x >= 0.0) { return cum1 + 2.0 * cy + phi * r; }
    if (p.y >= 0.0) { return cum2 + 2.0 * cx + (1.57079632679 - phi) * r; }
    return cum3 + 2.0 * cy + phi * r;
  }

  var vertical = qy <= 0.0;
  if (qx <= 0.0 && qy <= 0.0) { // interior: nearest side line decides
    vertical = (half.x - abs(p.x)) < (half.y - abs(p.y));
  } else if (qx <= 0.0) {
    vertical = false;
  }

  if (vertical) {
    if (p.x >= 0.0) { return cum1 + (clamp(p.y, -cy, cy) + cy); }
    return cum3 + (cy - clamp(p.y, -cy, cy));
  }
  if (p.y >= 0.0) { return cum2 + (cx - clamp(p.x, -cx, cx)); }
  // top edge: +x from the top middle; x < 0 is the closing run
  if (p.x >= 0.0) { return clamp(p.x, 0.0, cx); }
  return cum4 + (clamp(p.x, -cx, 0.0) + cx);
}

// v3's bottom-round-rectangle path: top middle, clockwise, sharp top
// corners, arcTo bottom corners
fn bottomRoundRectanglePerim(p: vec2f, half: vec2f, rIn: f32) -> f32 {
  let r = min(rIn, min(half.x, half.y));
  let cx = half.x - r;
  let cy = half.y - r;
  let arc = 1.57079632679 * r;
  let cum1 = half.x;                       // right side start (top-right corner)
  let cum2 = cum1 + (half.y + cy) + arc;   // bottom start
  let cum3 = cum2 + 2.0 * cx + arc;        // left side start
  let cum4 = cum3 + (half.y + cy);         // top-left run start

  let qx = abs(p.x) - cx;

  if (p.y > cy && qx > 0.0) { // bottom corner arcs
    let phi = atan2(p.y - cy, qx);
    if (p.x >= 0.0) { return cum1 + (half.y + cy) + phi * r; }
    return cum2 + 2.0 * cx + (1.57079632679 - phi) * r;
  }

  let dl = abs(p.x + half.x);
  let dr = abs(p.x - half.x);
  let dt = abs(p.y + half.y);
  let db = abs(p.y - half.y);
  let m = min(min(dl, dr), min(dt, db));

  if (m == dr) { return cum1 + (clamp(p.y, -half.y, cy) + half.y); }
  if (m == db) { return cum2 + (cx - clamp(p.x, -cx, cx)); }
  if (m == dl) { return cum3 + (cy - clamp(p.y, -half.y, cy)); }
  // top edge: +x from the top middle
  if (p.x >= 0.0) { return clamp(p.x, 0.0, half.x); }
  return cum4 + (clamp(p.x, -half.x, 0.0) + half.x);
}

// v3's cut-rectangle path: an octagon from (-hx+c, -hy), clockwise
fn cutRectanglePerim(p: vec2f, half: vec2f, c: f32) -> f32 {
  var v = array<vec2f, 8>(
    vec2f(-half.x + c, -half.y), vec2f(half.x - c, -half.y),
    vec2f(half.x, -half.y + c), vec2f(half.x, half.y - c),
    vec2f(half.x - c, half.y), vec2f(-half.x + c, half.y),
    vec2f(-half.x, half.y - c), vec2f(-half.x, -half.y + c));
  var best = 1e30;
  var u = 0.0;
  var cum = 0.0;
  for (var i = 0; i < 8; i++) {
    let a = v[i];
    let b = v[(i + 1) % 8];
    let e = b - a;
    let len = length(e);
    let t = clamp(dot(p - a, e) / max(dot(e, e), 1e-12), 0.0, 1.0);
    let q = a + e * t - p;
    let d = dot(q, q);
    if (d < best) { best = d; u = cum + t * len; }
    cum = cum + len;
  }
  return u;
}

// v3's barrel path: from (x0, y0 + hOff) DOWN the left side, then the
// bottom-left curve, bottom, bottom-right, right side up, top-right,
// top (right to left), top-left curve closing.  Sampled at the same
// subdivision as barrelSD so the dash follows the drawn boundary.
fn barrelPerim(p: vec2f, half: vec2f, zoomDpr: f32) -> f32 {
  let hOff = min(${BARREL_HEIGHT_OFFSET_MAX}.0 * zoomDpr, ${BARREL_HEIGHT_OFFSET_PCT} * half.y * 2.0);
  let wOff = min(${BARREL_WIDTH_OFFSET_MAX}.0 * zoomDpr, ${BARREL_WIDTH_OFFSET_PCT} * half.x * 2.0);
  let ctrl = ${BARREL_CTRL_OFFSET_PCT} * half.x * 2.0;
  let x0 = -half.x;
  let x1 = half.x;
  let y0 = -half.y;
  let y1 = half.y;

  // the four corner curves, in v3's path order and direction
  var a = array<vec2f, 4>(
    vec2f(x0, y1 - hOff), vec2f(x1 - wOff, y1), vec2f(x1, y0 + hOff), vec2f(x0 + wOff, y0));
  var c = array<vec2f, 4>(
    vec2f(x0 + ctrl, y1), vec2f(x1 - ctrl, y1), vec2f(x1 - ctrl, y0), vec2f(x0 + ctrl, y0));
  var b = array<vec2f, 4>(
    vec2f(x0 + wOff, y1), vec2f(x1, y1 - hOff), vec2f(x1 - wOff, y0), vec2f(x0, y0 + hOff));

  const N: i32 = 4 * (${BARREL_CURVE_SEGMENTS} + 1);
  var v = array<vec2f, N>();
  var k = 0;

  for (var i = 0; i < 4; i++) {
    for (var j = 0; j <= ${BARREL_CURVE_SEGMENTS}; j++) {
      let t = f32(j) / ${BARREL_CURVE_SEGMENTS}.0;
      let u2 = 1.0 - t;

      v[k] = a[i] * (u2 * u2) + c[i] * (2.0 * u2 * t) + b[i] * (t * t);
      k = k + 1;
    }
  }

  var best = 1e30;
  var u = 0.0;
  var cum = 0.0;

  for (var i = 0; i < N; i++) {
    let va = v[i];
    let vb = v[(i + 1) % N];
    let e = vb - va;
    let len = length(e);
    let t = clamp(dot(p - va, e) / max(dot(e, e), 1e-12), 0.0, 1.0);
    let q = va + e * t - p;
    let d = dot(q, q);
    if (d < best) { best = d; u = cum + t * len; }
    cum = cum + len;
  }

  return u;
}

// custom polygon (C3): the blob walk, forward in the declared point
// order (v3's drawPolygonPath direction)
fn customPolyPerim(p: vec2f, half: vec2f, polyRef: u32) -> f32 {
  let off = polyRef & 0xffffffu;
  let count = polyRef >> 24u;

  if (count < 3u) { return 0.0; }

  var best = 1e30;
  var u = 0.0;
  var cum = 0.0;

  for (var i = 0u; i < count; i = i + 1u) {
    let j = (i + 1u) % count;
    let a = vec2f(polyBlob[off + i * 2u], polyBlob[off + i * 2u + 1u]) * half;
    let b = vec2f(polyBlob[off + j * 2u], polyBlob[off + j * 2u + 1u]) * half;
    let e = b - a;
    let len = length(e);
    let t = clamp(dot(p - a, e) / max(dot(e, e), 1e-12), 0.0, 1.0);
    let q = a + e * t - p;
    let d = dot(q, q);
    if (d < best) { best = d; u = cum + t * len; }
    cum = cum + len;
  }

  return u;
}
${POLY.perimFns}
fn perimeterCoord(shape: u32, p: vec2f, half: vec2f, radius: f32, polyRef: u32, zoomDpr: f32) -> f32 {
  switch shape {
    case 0u, 1u: { return ellipsePerimCoord(p, half); }
    case 2u: { return rectanglePerim(p, half); }
${POLY.perimCases}
    case ${SHAPE_POLYGON_CUSTOM}u: { return customPolyPerim(p, half, polyRef); }
    case ${SHAPE_CUT_RECTANGLE}u: { return cutRectanglePerim(p, half, radius); }
    case ${SHAPE_BOTTOM_ROUND_RECTANGLE}u: { return bottomRoundRectanglePerim(p, half, radius); }
    case ${SHAPE_BARREL}u: { return barrelPerim(p, half, zoomDpr); }
    default: { return roundRectanglePerim(p, half, radius); }
  }
}
`;

export const NODE_SHADER = wgsl`
${COMMON}
${SDF}
${DASH_WGSL}
${NODE_PERIM_WGSL}

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
// background gradient record (round 13 C2 — took the shapes binding's
// slot; the FS reads the shape id from borderGeom.y bits 16..19)
@group(0) @binding(7) var<storage, read> gradients: array<array<u32, 8>>;
@group(0) @binding(8) var<storage, read> nodeFlags: array<u32>;
// ghost props [offsetX, offsetY, ghostOpacity, enabled] (round 13 A1);
// bound to both stages for the ghost entry points
@group(0) @binding(9) var<storage, read> ghosts: array<vec4f>;
// [cornerRadius×256 | auto | C3 polyRef, borderPosition | styles | shape<<16, outlineRgba, outlineWO]
@group(0) @binding(10) var<storage, read> borderGeom: array<vec4u>;
// round 38: the dashed border's pattern + [offset, reserved] — bound
// VERTEX-only (the FS is at its 8-storage-buffer budget) and handed to
// the fragment stage as flat varyings
@group(0) @binding(11) var<storage, read> borderDashes: array<vec4f>;
@group(0) @binding(12) var<storage, read> borderDashMetas: array<vec2f>;
// custom-polygon unit points (round 13 C3)
@group(0) @binding(13) var<storage, read> polyBlob: array<f32>;

// C2: sRGB gradient evaluation over the packed record (v3's canvas
// gradients interpolate in sRGB; OKLab stays the *mapper* default)
fn gradientStopPos(rec: array<u32, 8>, i: u32) -> f32 {
  if (i == 4u) { return f32(rec[7] & 0xffu) / 255.0; }
  return f32((rec[6] >> (i * 8u)) & 0xffu) / 255.0;
}

fn gradientColorAt(rec: array<u32, 8>, t: f32) -> vec4f {
  let count = (rec[0] >> 5u) & 7u;

  if (count == 0u) { return vec4f(0.0); }
  if (count == 1u) { return unpack4x8unorm(rec[1]); }

  var prevPos = gradientStopPos(rec, 0u);
  var prevColor = unpack4x8unorm(rec[1]);

  if (t <= prevPos) { return prevColor; }

  for (var i = 1u; i < count; i = i + 1u) {
    let pos = gradientStopPos(rec, i);
    let color = unpack4x8unorm(rec[1u + i]);

    if (t <= pos) {
      let span = max(pos - prevPos, 1e-5);

      return mix(prevColor, color, (t - prevPos) / span);
    }

    prevPos = pos;
    prevColor = color;
  }

  return prevColor;
}

// linear-gradient direction unit vectors (v3's to-* keywords)
fn gradientDir(id: u32) -> vec2f {
  switch id {
    case 1u: { return vec2f(0.0, -1.0); }              // to-top
    case 2u: { return vec2f(-1.0, 0.0); }              // to-left
    case 3u: { return vec2f(1.0, 0.0); }               // to-right
    case 4u: { return normalize(vec2f(1.0, 1.0)); }    // to-bottom-right
    case 5u: { return normalize(vec2f(-1.0, 1.0)); }   // to-bottom-left
    case 6u: { return normalize(vec2f(1.0, -1.0)); }   // to-top-right
    case 7u: { return normalize(vec2f(-1.0, -1.0)); }  // to-top-left
    default: { return vec2f(0.0, 1.0); }               // to-bottom
  }
}

struct NodeVSOut {
  @builtin(position) position: vec4f,
  @location(0) local: vec2f,      // device-px offset from the node center
  @location(1) halfSize: vec2f,   // device px
  @location(2) alphaComp: f32,    // sub-hidePx LOD alpha compensation
  @location(3) @interpolate(flat) instance: u32,
  // round 38: the border dash pattern + offset, read by the VS from the
  // vertex-only columns (see the bindings note above)
  @location(4) @interpolate(flat) dashPat: vec4f,
  @location(5) @interpolate(flat) dashOffset: f32,
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
  var borderOut = borderOutward(bg.y & 0xffu, borderWidths[slot] * frame.zoomDpr);

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
  out.dashPat = borderDashes[slot];
  out.dashOffset = borderDashMetas[slot].x;
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

  out.dashPat = vec4f(0.0);
  out.dashOffset = 0.0;

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

  var shape = (borderGeom[slot].y >> ${SHAPE_SHIFT}u) & ${SHAPE_MASK}u;
  var half = in.halfSize;

  if (plain) {
    shape = 0u;
    half = vec2f(max(in.halfSize.x, in.halfSize.y));
  }

  let radius = cornerLengthPx(shape, borderGeom[slot].x, half, frame.zoomDpr);
  let sd = nodeSD(shape, in.local, half, radius, borderGeom[slot].x, frame.zoomDpr);
  var color = unpack4x8unorm(fillColors[slot]);

  // background gradient (C2): overrides the flat fill inside the shape
  // (plain-LOD discs keep the flat base color — recorded)
  let grec = gradients[slot];

  if (!plain && (grec[0] & 3u) != 0u) {
    var t: f32;

    if ((grec[0] & 3u) == 2u) { // radial: center → the larger half
      t = length(in.local) / max(half.x, half.y);
    } else {
      let d = gradientDir((grec[0] >> 2u) & 7u);

      // the bb's support along d maps to [0, 1] (corner-to-corner on
      // diagonals, edge-to-edge on axes — v3's canvas geometry)
      t = (dot(in.local, d) / max(dot(half, abs(d)), 1e-4) + 1.0) * 0.5;
    }

    color = gradientColorAt(grec, clamp(t, 0.0, 1.0));
  }

  var edge = 0.0; // coverage boundary: sd <= edge is inked
  let flags = nodeFlags[slot];
  // round 38 dash state: 0 keeps the plain fill/solid-border epilogue;
  // dashed/dotted computes its own premultiplied layers below, and
  // double applies an erase-stripe factor after the epilogue
  var dashMode = 0u;
  var dashRgb = vec3f(0.0);
  var dashA = 0.0;
  var stripeKeep = 1.0;

  if (!plain) {
    let borderWidth = borderWidths[slot] * frame.zoomDpr;
    // border-position (B2): the band straddles the boundary by v3's
    // rule — center [−bw/2, bw/2] (the default), inside [−bw, 0],
    // outside [0, bw]
    let bOut = borderOutward(borderGeom[slot].y & 0xffu, borderWidth);

    if (borderWidth > 0.0 && sd > bOut - borderWidth) {
      let bStyle = (borderGeom[slot].y >> ${BORDER_STYLE_SHIFT}u) & ${STROKE_STYLE_MASK}u;

      if (bStyle == ${STROKE_DASHED}u || bStyle == ${STROKE_DOTTED}u) {
        // dashed reads the pattern varyings; dotted is v3's hardcoded
        // [1, 1] (it ignores the pattern — v3's drawBorder switch).
        // Dash lengths are MODEL px (v3 sets the line dash in the
        // transformed context), so u and the AA convert by zoomDpr.
        var pat = in.dashPat;
        var doff = in.dashOffset;

        if (bStyle == ${STROKE_DOTTED}u) {
          pat = vec4f(1.0, 1.0, 1.0, 1.0);
          doff = 0.0;
        }

        let u = perimeterCoord(shape, in.local, half, radius, borderGeom[slot].x, frame.zoomDpr) / frame.zoomDpr;
        let m = smoothstep(-0.75, 0.75, dashInsideSd(u, pat, doff) * frame.zoomDpr);
        // an on-segment draws the border band (coverage to bOut); an
        // off-segment falls back to the fill layer (coverage to 0),
        // which is what v3's stroke-over-fill shows through a gap
        let bc = unpack4x8unorm(borderColors[slot]);
        let aB = (1.0 - smoothstep(bOut - 0.75, bOut + 0.75, sd)) * bc.a;
        let aF = (1.0 - smoothstep(-0.75, 0.75, sd)) * color.a;

        dashRgb = mix(color.rgb * aF, bc.rgb * aB, m);
        dashA = mix(aF, aB, m);
        dashMode = 1u;
      } else {
        color = unpack4x8unorm(borderColors[slot]);
        edge = bOut;

        if (bStyle == ${STROKE_DOUBLE}u) {
          // v3's double: stroke solid, then erase the middle third
          // (destination-out at borderWidth / 3).  Fill and border are
          // one draw here, so the erase is these fragments' alpha
          // landing at 0 — the stripe shows whatever the scene drew
          // beneath the node, where v3 punches through to the page
          // (recorded; the depth prepass excludes double borders)
          let s1 = bOut - borderWidth * (2.0 / 3.0);
          let s2 = bOut - borderWidth * (1.0 / 3.0);

          stripeKeep = 1.0 - smoothstep(s1 - 0.75, s1 + 0.75, sd) *
            (1.0 - smoothstep(s2 - 0.75, s2 + 0.75, sd));
        }
      }
    }

  }

  let mul = opacities[slot] * in.alphaComp;
  var alpha = (1.0 - smoothstep(edge - 0.75, edge + 0.75, sd)) * mul * color.a;
  var rgbPre = color.rgb * alpha;

  if (dashMode == 1u) {
    alpha = dashA * mul;
    rgbPre = dashRgb * mul;
  }

  alpha = alpha * stripeKeep;
  rgbPre = rgbPre * stripeKeep;
  let og = borderGeom[slot];

  // outline ring (B5): a band outside the border at outline-offset/2,
  // disjoint from the body coverage
  if (!plain && (og.z >> 24u) != 0u) {
    let wo = outlineWO(og.w, frame.zoomDpr);
    let inner = borderOutward(og.y & 0xffu, borderWidths[slot] * frame.zoomDpr) + wo.y * 0.5;
    let oc = unpack4x8unorm(og.z);
    var ring = smoothstep(inner - 0.75, inner + 0.75, sd) *
      (1.0 - smoothstep(inner + wo.x - 0.75, inner + wo.x + 0.75, sd));
    // round 38: outline-style — v3 hardcodes [4, 2] dashed / [1, 1]
    // dotted and takes no props; its drawOutline has no double branch,
    // so double draws solid (a v3 quirk kept for parity).  The dash
    // coordinate reads the base shape's perimeter — the ring's own
    // path is a hair longer, a recorded approximation.
    let oStyle = (og.y >> ${OUTLINE_STYLE_SHIFT}u) & ${STROKE_STYLE_MASK}u;

    if (oStyle == ${STROKE_DASHED}u || oStyle == ${STROKE_DOTTED}u) {
      let pat = select(vec4f(4.0, 2.0, 4.0, 2.0), vec4f(1.0, 1.0, 1.0, 1.0), oStyle == ${STROKE_DOTTED}u);
      // v3 dashes the outline along an EXPANDED shape path, so the dash
      // coordinate evaluates at the ring's own radius — and for the
      // polygon family v3's expandPolygon pads in UNIT space (the pad is
      // divided by nodeWidth alone), so the y expansion scales by the
      // aspect ratio.  Without either, the phase drifts a period per
      // side on rectangles.
      let dOut = inner + wo.x * 0.5;
      var oHalf = half + vec2f(dOut);
      var oRadius = radius;

      if (shape == 2u || (shape >= 4u && shape <= 16u)) {
        // v3's expandPolygon pads in UNIT space (divided by nodeWidth
        // alone), so the y expansion scales by the aspect ratio
        oHalf = half + vec2f(dOut, dOut * half.y / max(half.x, 1e-6));
      } else if (shape == 3u || shape == 25u) {
        oRadius = radius + dOut; // v3 pads the outline path's corner radius
      } else if (shape == 17u) {
        oRadius = radius + dOut * 0.5; // v3's cut-rectangle: quarter pad
      }

      let u = perimeterCoord(shape, in.local, oHalf, oRadius, og.x, frame.zoomDpr) / frame.zoomDpr;

      ring = ring * smoothstep(-0.75, 0.75, dashInsideSd(u, pat, 0.0) * frame.zoomDpr);
    }

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
  var borderOut = borderOutward(bg.y & 0xffu, borderWidths[slot] * frame.zoomDpr);

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
  out.dashPat = borderDashes[slot];
  out.dashOffset = borderDashMetas[slot].x;
  return out;
}

@fragment
fn fsGhost(in: NodeVSOut) -> @location(0) vec4f {
  let slot = in.instance;
  let sizePx = max(in.halfSize.x, in.halfSize.y) * 2.0;
  let plain = sizePx < frame.nodeLodPx; // LOD: plain AA disc

  var shape = (borderGeom[slot].y >> ${SHAPE_SHIFT}u) & ${SHAPE_MASK}u;
  var half = in.halfSize;

  if (plain) {
    shape = 0u;
    half = vec2f(max(in.halfSize.x, in.halfSize.y));
  }

  let radius = cornerLengthPx(shape, borderGeom[slot].x, half, frame.zoomDpr);
  let sd = nodeSD(shape, in.local, half, radius, borderGeom[slot].x, frame.zoomDpr);
  var color = unpack4x8unorm(fillColors[slot]);

  // the ghost body carries the gradient too (C2/C3; v3 redraws the
  // full body)
  let ggrec = gradients[slot];

  if (!plain && (ggrec[0] & 3u) != 0u) {
    var t: f32;

    if ((ggrec[0] & 3u) == 2u) {
      t = length(in.local) / max(half.x, half.y);
    } else {
      let d = gradientDir((ggrec[0] >> 2u) & 7u);

      t = (dot(in.local, d) / max(dot(half, abs(d)), 1e-4) + 1.0) * 0.5;
    }

    color = gradientColorAt(ggrec, clamp(t, 0.0, 1.0));
  }

  var edge = 0.0;
  // round 38: the ghost body carries the border style like everything
  // else — same dash/double treatment as fsNode
  var dashMode = 0u;
  var dashRgb = vec3f(0.0);
  var dashA = 0.0;
  var stripeKeep = 1.0;

  if (!plain) {
    let borderWidth = borderWidths[slot] * frame.zoomDpr;
    let bOut = borderOutward(borderGeom[slot].y & 0xffu, borderWidth);

    if (borderWidth > 0.0 && sd > bOut - borderWidth) {
      let bStyle = (borderGeom[slot].y >> ${BORDER_STYLE_SHIFT}u) & ${STROKE_STYLE_MASK}u;

      if (bStyle == ${STROKE_DASHED}u || bStyle == ${STROKE_DOTTED}u) {
        var pat = in.dashPat;
        var doff = in.dashOffset;

        if (bStyle == ${STROKE_DOTTED}u) {
          pat = vec4f(1.0, 1.0, 1.0, 1.0);
          doff = 0.0;
        }

        let u = perimeterCoord(shape, in.local, half, radius, borderGeom[slot].x, frame.zoomDpr) / frame.zoomDpr;
        let m = smoothstep(-0.75, 0.75, dashInsideSd(u, pat, doff) * frame.zoomDpr);
        let bc = unpack4x8unorm(borderColors[slot]);
        let aB = (1.0 - smoothstep(bOut - 0.75, bOut + 0.75, sd)) * bc.a;
        let aF = (1.0 - smoothstep(-0.75, 0.75, sd)) * color.a;

        dashRgb = mix(color.rgb * aF, bc.rgb * aB, m);
        dashA = mix(aF, aB, m);
        dashMode = 1u;
      } else {
        color = unpack4x8unorm(borderColors[slot]);
        edge = bOut;

        if (bStyle == ${STROKE_DOUBLE}u) {
          let s1 = bOut - borderWidth * (2.0 / 3.0);
          let s2 = bOut - borderWidth * (1.0 / 3.0);

          stripeKeep = 1.0 - smoothstep(s1 - 0.75, s1 + 0.75, sd) *
            (1.0 - smoothstep(s2 - 0.75, s2 + 0.75, sd));
        }
      }
    }
  }

  let ghostA = clamp(ghosts[slot].z, 0.0, 1.0);
  let mul = opacities[slot] * in.alphaComp * ghostA;
  var alpha = (1.0 - smoothstep(edge - 0.75, edge + 0.75, sd)) * mul * color.a;
  var rgbPre = color.rgb * alpha;

  if (dashMode == 1u) {
    alpha = dashA * mul;
    rgbPre = dashRgb * mul;
  }

  alpha = alpha * stripeKeep;
  rgbPre = rgbPre * stripeKeep;
  let og = borderGeom[slot];

  if (!plain && (og.z >> 24u) != 0u) { // the ghost outline rides along (v3)
    let wo = outlineWO(og.w, frame.zoomDpr);
    let inner = borderOutward(og.y & 0xffu, borderWidths[slot] * frame.zoomDpr) + wo.y * 0.5;
    let oc = unpack4x8unorm(og.z);
    var ring = smoothstep(inner - 0.75, inner + 0.75, sd) *
      (1.0 - smoothstep(inner + wo.x - 0.75, inner + wo.x + 0.75, sd));
    let oStyle = (og.y >> ${OUTLINE_STYLE_SHIFT}u) & ${STROKE_STYLE_MASK}u;

    if (oStyle == ${STROKE_DASHED}u || oStyle == ${STROKE_DOTTED}u) {
      let pat = select(vec4f(4.0, 2.0, 4.0, 2.0), vec4f(1.0, 1.0, 1.0, 1.0), oStyle == ${STROKE_DOTTED}u);
      // v3 dashes the outline along an EXPANDED shape path, so the dash
      // coordinate evaluates at the ring's own radius — and for the
      // polygon family v3's expandPolygon pads in UNIT space (the pad is
      // divided by nodeWidth alone), so the y expansion scales by the
      // aspect ratio.  Without either, the phase drifts a period per
      // side on rectangles.
      let dOut = inner + wo.x * 0.5;
      var oHalf = half + vec2f(dOut);
      var oRadius = radius;

      if (shape == 2u || (shape >= 4u && shape <= 16u)) {
        // v3's expandPolygon pads in UNIT space (divided by nodeWidth
        // alone), so the y expansion scales by the aspect ratio
        oHalf = half + vec2f(dOut, dOut * half.y / max(half.x, 1e-6));
      } else if (shape == 3u || shape == 25u) {
        oRadius = radius + dOut; // v3 pads the outline path's corner radius
      } else if (shape == 17u) {
        oRadius = radius + dOut * 0.5; // v3's cut-rectangle: quarter pad
      }

      let u = perimeterCoord(shape, in.local, oHalf, oRadius, og.x, frame.zoomDpr) / frame.zoomDpr;

      ring = ring * smoothstep(-0.75, 0.75, dashInsideSd(u, pat, 0.0) * frame.zoomDpr);
    }

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
fn nodeInterior(shape: u32, p: vec2f, half: vec2f, m: f32, radius: f32, polyRef: u32) -> bool {
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
      return nodeSD(shape, p, half, radius, polyRef, frame.zoomDpr) <= -m;
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

  // round 38: a double border erases a stripe (its fragments' alpha is
  // 0), so the node is not fully opaque — the prepass must not claim it
  // (the gradient-fill precedent, one line below)
  if (borderWidth > 0.0 &&
      ((borderGeom[slot].y >> ${BORDER_STYLE_SHIFT}u) & ${STROKE_STYLE_MASK}u) == ${STROKE_DOUBLE}u) {
    discard;
  }

  // gradient fills may be translucent anywhere: conservative discard (C2)
  if ((gradients[slot][0] & 3u) != 0u) {
    discard;
  }

  let sizePx = max(in.halfSize.x, in.halfSize.y) * 2.0;
  var shape = (borderGeom[slot].y >> ${SHAPE_SHIFT}u) & ${SHAPE_MASK}u;
  var half = in.halfSize;

  if (sizePx < frame.nodeLodPx) {
    shape = 0u;
    half = vec2f(max(in.halfSize.x, in.halfSize.y));
  }

  let radius = cornerLengthPx(shape, borderGeom[slot].x, half, frame.zoomDpr);

  if (!nodeInterior(shape, in.local, half, 1.5, radius, borderGeom[slot].x)) { // stay inside the AA fringe
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
export const NODE_LAYER_SHADER = wgsl`
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

// Round 57.1 removed a second record here.  v3's :active used to be
// substituted in this function from the flags word, which meant the
// press affordance could not be restyled, could not be turned off, and
// disagreed with style( 'overlay-opacity' ) while it was showing.  It is
// an ordinary { active: true } case mapper in the default sheet now,
// so by the time the record reaches this shader a pressed element simply
// *has* an overlay, and nothing here knows why.
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

export const EDGE_SHADER = wgsl`
${COMMON}
${BOUNDARY_WGSL}
${ARROW_GAP_WGSL}
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
@group(0) @binding(2) var<storage, read> widths: array<vec2f>; // .x width, .y arrow bits (round 56)
@group(0) @binding(3) var<storage, read> nodePositions: array<vec2f>;
@group(0) @binding(4) var<storage, read> curveParams: array<vec4f>;
@group(0) @binding(5) var<storage, read> nodeOuterHalf: array<vec2f>;
@group(0) @binding(6) var<storage, read> nodeShapes: array<u32>;
// fragment-stage columns (flat instance fetch; the FS skips dashes on
// straight-triangle fills, and reads that kind off a flat varying rather
// than binding curveParams — round 57.1)
@group(0) @binding(7) var<storage, read> lineColors: array<u32>;
@group(0) @binding(8) var<storage, read> opacities: array<f32>;
@group(0) @binding(9) var<storage, read> lineStyles: array<u32>; // LINE_* ids
// dash pattern (two on/off pairs, model px) + [offset, cap] (round 13 B3)
@group(0) @binding(10) var<storage, read> dashPatterns: array<vec4f>;
@group(0) @binding(11) var<storage, read> dashMetas: array<vec2f>;
// overlay/underlay record [rgba folded, strokeWidth*256] — only the
// layer entry points bind it (round 13 A2)
@group(0) @binding(12) var<storage, read> edgeLayer: array<vec2u>;
// line-fill gradient record (round 13 C2), fragment-only
@group(0) @binding(13) var<storage, read> edgeGradients: array<array<u32, 8>>;

// C2: sRGB line gradient over the packed record (same layout as the
// node background gradient; linear runs along the edge, radial from
// the midpoint)
fn gradientStopPos(rec: array<u32, 8>, i: u32) -> f32 {
  if (i == 4u) { return f32(rec[7] & 0xffu) / 255.0; }
  return f32((rec[6] >> (i * 8u)) & 0xffu) / 255.0;
}

fn gradientColorAt(rec: array<u32, 8>, t: f32) -> vec4f {
  let count = (rec[0] >> 5u) & 7u;

  if (count == 0u) { return vec4f(0.0); }
  if (count == 1u) { return unpack4x8unorm(rec[1]); }

  var prevPos = gradientStopPos(rec, 0u);
  var prevColor = unpack4x8unorm(rec[1]);

  if (t <= prevPos) { return prevColor; }

  for (var i = 1u; i < count; i = i + 1u) {
    let pos = gradientStopPos(rec, i);
    let color = unpack4x8unorm(rec[1u + i]);

    if (t <= pos) {
      let span = max(pos - prevPos, 1e-5);

      return mix(prevColor, color, (t - prevPos) / span);
    }

    prevPos = pos;
    prevColor = color;
  }

  return prevColor;
}

struct EdgeVSOut {
  @builtin(position) position: vec4f,
  @location(0) v: f32,          // signed perpendicular distance, device px
  @location(1) halfWidth: f32,  // device px; tapers to 0 along a straight-triangle
  @location(2) @interpolate(flat) alphaComp: f32, // LOD alpha compensation
  @location(3) @interpolate(flat) instance: u32,
  @location(4) u: f32,          // longitudinal distance from the source, model px
  @location(5) @interpolate(flat) totalLen: f32, // model px (C2 gradients)
  // the curve kind, carried rather than re-read (round 57.1): the FS
  // wanted exactly one number out of edge.curveParams — the
  // straight-triangle kind — and a whole storage binding for one number
  // is what a stage at its 8-buffer budget cannot afford.
  @location(6) @interpolate(flat) kind: f32,
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
  let lod = edgeLod(slot, widths[slot].x * frame.zoomDpr, frame.edgeWidthFloor);
  let widthPx = max(widths[slot].x * frame.zoomDpr, frame.edgeWidthFloor);

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
  } else if (params.w != 6.0) {
    // Round 56: v3's arrow gap.  The drawn line stops gap(shape) behind
    // each node boundary, which is what makes a hollow or translucent
    // head read as one shape instead of a head laid over a line — the
    // line is strictly inside the head over that span, so trimming to it
    // reproduces v3's destination-out erase with no second pass.
    //
    // Haystack (kind 6) is excluded because v3 draws it no arrows at all
    // and routes it through a different path entirely; straight-triangle
    // (kind 7) above resolves its own boundary tips and tapers to a
    // point, so a trim there would cut the apex off.
    let word = arrowWordOf(widths[slot]);
    let wModel = widths[slot].x;
    let scale = scaleOfWord(word);

    var md = pb - pa;
    let ml = max(length(md), 1e-6);

    md = md / ml;

    let bs = pa + md * boundaryOffset(nodeShapes[ends.x], nodeOuterHalf[ends.x], md);
    let bt = pb - md * boundaryOffset(nodeShapes[ends.y], nodeOuterHalf[ends.y], -md);

    // v3 shortens each boundary point *toward the far end*, so the two
    // trims are independent and neither can cross the other
    let srcShows = ((word >> ${ARROW_SHIFT_SRC_SHOWS_LINE}u) & 1u) == 1u;
    let tgtShows = ((word >> ${ARROW_SHIFT_TGT_SHOWS_LINE}u) & 1u) == 1u;

    var ts = arrowDrawTrimW(srcShapeOf(word), srcShows, wModel, scale);
    var tt = arrowDrawTrimW(tgtShapeOf(word), tgtShows, wModel, scale);

    // Heads bigger than the edge they sit on: v3 shortens each end
    // independently, so its two line ends cross and it draws a short
    // *reversed* segment in the middle — visible through a hollow head as
    // a stub that has nothing to do with the edge.  Scaling both trims to
    // meet instead collapses the line to a point, which is what "the
    // heads cover the whole edge" should look like.  A deliberate
    // divergence, and only reachable where v3's own output is an artifact.
    let avail = length(bt - bs);
    let total = ts + tt;

    if (total > avail) {
      let k = avail / max(total, 1e-6);

      ts = ts * k;
      tt = tt * k;
    }

    pa = shortenTowardW(bs, bt, ts);
    pb = shortenTowardW(bt, bs, tt);
  }

  let a = modelToPx(frame, pa);
  let b = modelToPx(frame, pb);
  let ab = b - a;
  let len = max(length(ab), 1e-4); // zero-length edges were culled

  let halfW = widthPx * 0.5 * taper;
  let dir = ab / len;
  let n = vec2f(-dir.y, dir.x);
  // screen-space extrusion incl. 1px AA margin; pickPadPx widens the pick
  // quad by v3's hit halo (edgeThreshold) and is 0 in scene frames
  let s = corner.y * (halfW + frame.pickPadPx + 1.0);

  out.position = vec4f(pxToClip(frame, mix(a, b, t) + n * s), EDGE_Z, 1.0);
  out.v = s;
  out.halfWidth = halfW;
  out.alphaComp = lod.y;
  out.instance = slot;
  // Model px along the *drawn* line, which since round 56 is what this
  // quad spans: the branches above resolve pa/pb to the trimmed boundary
  // points, and haystack's offset points are its own line ends.  v3
  // launches the dash pattern and the line gradient at the same place —
  // its rs.startX/Y — so both now agree with v3 by construction rather
  // than by subtracting the boundary offsets back off a centre-to-centre
  // quad, which is what this did while the quad ran node centre to node
  // centre.
  out.u = t * (len / frame.zoomDpr);
  out.totalLen = max(len / frame.zoomDpr, 1e-4);
  out.kind = params.w;
  return out;
}

@fragment
fn fsEdge(in: EdgeVSOut) -> @location(0) vec4f {
  var c = unpack4x8unorm(lineColors[in.instance]);

  // line-fill gradient (C2): linear along the edge, radial from the mid
  let grec = edgeGradients[in.instance];

  if ((grec[0] & 3u) != 0u) {
    let tRaw = (in.u + 0.0) / max(in.totalLen, 1e-4);
    var t = tRaw;

    if ((grec[0] & 3u) == 2u) { t = abs(tRaw - 0.5) * 2.0; }

    c = gradientColorAt(grec, clamp(t, 0.0, 1.0));
  }

  var alpha = c.a * opacities[in.instance] * in.alphaComp * (1.0 - frame.edgeDim);

  // line-style: dashed uses the per-edge line-dash-pattern/-offset,
  // dotted is [1, 1] (v3); line-cap shapes each dash segment (B3).
  // Picking ignores the gaps, as v3 does.  Straight-triangle fills
  // ignore line-style (v3 fills the triangle path).
  let ls = lineStyles[in.instance];
  let isTriangle = in.kind == 7.0;

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
  // v3's edgeThreshold (57.9): a hit counts within pickPadPx of the stroke
  if (abs(in.v) > in.halfWidth + frame.pickPadPx) {
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
  out.kind = params.w;
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
export const CURVED_EDGE_SHADER = wgsl`
${COMMON}
${BOUNDARY_WGSL}
${ARROW_GAP_WGSL}
${CURVE_WGSL}
${ROUTE_WGSL}
${DASH_WGSL}

@group(0) @binding(0) var<uniform> frame: Frame;
// vertex-stage columns (7 + the visible list = the 8-buffer budget)
@group(0) @binding(1) var<storage, read> endpoints: array<vec2u>;
@group(0) @binding(2) var<storage, read> widths: array<vec2f>; // .x width, .y arrow bits (round 56)
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
// line-fill gradient record (round 13 C2), fragment-only
@group(0) @binding(14) var<storage, read> edgeGradients: array<array<u32, 8>>;

// C2: sRGB line gradient (same record layout as the node gradient)
fn gradientStopPos(rec: array<u32, 8>, i: u32) -> f32 {
  if (i == 4u) { return f32(rec[7] & 0xffu) / 255.0; }
  return f32((rec[6] >> (i * 8u)) & 0xffu) / 255.0;
}

fn gradientColorAt(rec: array<u32, 8>, t: f32) -> vec4f {
  let count = (rec[0] >> 5u) & 7u;

  if (count == 0u) { return vec4f(0.0); }
  if (count == 1u) { return unpack4x8unorm(rec[1]); }

  var prevPos = gradientStopPos(rec, 0u);
  var prevColor = unpack4x8unorm(rec[1]);

  if (t <= prevPos) { return prevColor; }

  for (var i = 1u; i < count; i = i + 1u) {
    let pos = gradientStopPos(rec, i);
    let color = unpack4x8unorm(rec[1u + i]);

    if (t <= pos) {
      let span = max(pos - prevPos, 1e-5);

      return mix(prevColor, color, (t - prevPos) / span);
    }

    prevPos = pos;
    prevColor = color;
  }

  return prevColor;
}

struct CurvedVSOut {
  @builtin(position) position: vec4f,
  @location(0) v: f32,          // signed perpendicular distance, device px
  @location(1) halfWidth: f32,  // device px
  @location(2) @interpolate(flat) alphaComp: f32, // width-floor LOD compensation
  @location(3) @interpolate(flat) instance: u32,
  @location(4) u: f32,          // longitudinal distance along the polyline, model px
  @location(5) @interpolate(flat) totalLen: f32, // full polyline length (C2)
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
  let widthPx = max(widths[slot].x * frame.zoomDpr, frame.edgeWidthFloor);
  let alphaComp = min(widths[slot].x * frame.zoomDpr / max(frame.edgeWidthFloor, 1e-4), 1.0);

  // this vertex's subdivision point + the extrusion normal there:
  // adjacent quads share exact vertex geometry, so the strip is
  // watertight; a vertex's normal depends only on its index, so both
  // quads sharing an index extrude identically
  let tIdx = seg + u32((corner.x + 1.0) * 0.5);
  var p: vec2f;
  var n: vec2f;
  var miterScale = 1.0;
  var uLen = 0.0;
  var totLen = 0.0;

  if (params.w <= 2.0 || params.w == 16.0) { // bezier / loop / compound loop: the analytic path
    let g = evalCurveGeom(
      params,
      nodePositions[ends.x], nodeOuterHalf[ends.x], nodeShapes[ends.x],
      nodePositions[ends.y], nodeOuterHalf[ends.y], nodeShapes[ends.y],
      arrowTrimOf(widths[slot])
    );
    let t = f32(tIdx) / CURVE_SEGS_F;

    p = curvePoint(g, t);

    var tangent = curveTangentAt(g, t);
    let tl = length(tangent);

    if (tl < 1e-6) { tangent = vec2f(1.0, 0.0); } else { tangent = tangent / tl; }

    n = vec2f(-tangent.y, tangent.x);

    // longitudinal model-px distance along the drawn polyline (for
    // dashes) + the full length (C2 gradients)
    var prev = g.s;

    for (var i = 1u; i <= CURVE_SEGS_U; i = i + 1u) {
      let q = curvePoint(g, f32(i) / CURVE_SEGS_F);

      if (i <= tIdx) { uLen = uLen + length(q - prev); }

      totLen = totLen + length(q - prev);
      prev = q;
    }
  } else { // 12b route families: evaluate the route from the param blob
    var route = evalRouteW(
      params,
      nodePositions[ends.x], nodeOuterHalf[ends.x], nodeShapes[ends.x],
      nodePositions[ends.y], nodeOuterHalf[ends.y], nodeShapes[ends.y],
      arrowTrimOf(widths[slot])
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

    // dash distance + the full polyline length (C2 gradients)
    var prev = route.q[0u];

    for (var i = 1u; i <= CURVE_SEGS_U; i = i + 1u) {
      let q = routeVertexW(&route, i);

      if (i <= tIdx) { uLen = uLen + length(q - prev); }

      totLen = totLen + length(q - prev);
      prev = q;
    }
  }

  let halfW = widthPx * 0.5;
  // screen-space extrusion incl. 1px AA margin; pickPadPx widens the pick
  // strip by v3's hit halo (edgeThreshold) and is 0 in scene frames
  let s = corner.y * (halfW + frame.pickPadPx + 1.0);

  out.position = vec4f(pxToClip(frame, modelToPx(frame, p) + n * s * miterScale), EDGE_Z, 1.0);
  out.v = s;
  out.halfWidth = halfW;
  out.alphaComp = alphaComp;
  out.instance = slot;
  out.u = uLen;
  out.totalLen = max(totLen, 1e-4);
  return out;
}

@fragment
fn fsCurvedEdge(in: CurvedVSOut) -> @location(0) vec4f {
  var c = unpack4x8unorm(lineColors[in.instance]);

  // line-fill gradient (C2): linear along the arc length, radial from
  // the arc midpoint
  let grec = edgeGradients[in.instance];

  if ((grec[0] & 3u) != 0u) {
    var t = in.u / in.totalLen;

    if ((grec[0] & 3u) == 2u) { t = abs(t - 0.5) * 2.0; }

    c = gradientColorAt(grec, clamp(t, 0.0, 1.0));
  }

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
  // v3's edgeThreshold (57.9): a hit counts within pickPadPx of the stroke
  if (abs(in.v) > in.halfWidth + frame.pickPadPx) {
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

  if (params.w <= 2.0 || params.w == 16.0) {
    let g = evalCurveGeom(
      params,
      nodePositions[ends.x], nodeOuterHalf[ends.x], nodeShapes[ends.x],
      nodePositions[ends.y], nodeOuterHalf[ends.y], nodeShapes[ends.y],
      // The overlay/underlay/casing strokes ride the *untrimmed* path
      // (round 56).  Not a choice: this pipeline has its own bind group
      // layout precisely because its vertex stage cannot afford a slot
      // for edge.width, so it has no way to reach the arrow word — and a
      // layout entry counts against the budget even for a binding the
      // shader never reads.  v3 strokes its casing along the *shortened*
      // path, so a layer on an arrowed edge runs a gap further than v3's
      // does; recorded as a deviation with a follow-up, and matched by
      // the straight-stream layer entry point so the two agree.
      vec4f(0.0)
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
      nodePositions[ends.y], nodeOuterHalf[ends.y], nodeShapes[ends.y],
      // The overlay/underlay/casing strokes ride the *untrimmed* path
      // (round 56).  Not a choice: this pipeline has its own bind group
      // layout precisely because its vertex stage cannot afford a slot
      // for edge.width, so it has no way to reach the arrow word — and a
      // layout entry counts against the budget even for a binding the
      // shader never reads.  v3 strokes its casing along the *shortened*
      // path, so a layer on an arrowed edge runs a gap further than v3's
      // does; recorded as a deviation with a follow-up, and matched by
      // the straight-stream layer entry point so the two agree.
      vec4f(0.0)
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

export const ARROW_SHADER = wgsl`
${COMMON}
${BOUNDARY_WGSL}
${ARROW_GAP_WGSL}

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
@group(0) @binding(2) var<storage, read> edgeWidths: array<vec2f>; // .x width, .y arrow bits (round 56)
@group(0) @binding(3) var<storage, read> nodePositions: array<vec2f>;
@group(0) @binding(4) var<storage, read> nodeOuterHalf: array<vec2f>;
@group(0) @binding(5) var<storage, read> nodeShapes: array<u32>;
@group(0) @binding(6) var<storage, read> arrows: array<u32>;

// which end this draw covers: 0 target, 1 source, 2 mid-target,
// 3 mid-source (C1) — the bind group also swaps in that end's colors
struct End { endId: u32 }
@group(0) @binding(7) var<uniform> end: End;
// shape ids packed source | target<<8, hollow bits 16/17, arrow-scale
// ×16 in the top byte (B7) and the mid shapes (C1) — see the layout
// above packArrowShapes in contract.mts.  Fragment stage only; the
// vertex stage reads the same word out of edge.width lane 1 (round 56).
@group(0) @binding(8) var<storage, read> arrowShapes: array<u32>;
// hollow stroke widths per end, model px (B7)
@group(0) @binding(9) var<storage, read> arrowWidths: array<vec2f>;
// curve params: the mid entry point reads the haystack kind (C1)
@group(0) @binding(10) var<storage, read> curveParams: array<vec4f>;

@group(1) @binding(0) var<storage, read> visible: array<u32>;

struct ArrowVSOut {
  @builtin(position) position: vec4f,
  @location(0) p: vec2f,    // arrow-local device px: x lateral, y (≤0) behind the tip
  @location(1) color: vec4f,
  @location(2) @interpolate(flat) widthModel: f32, // edge width in model px (27.3)
  @location(3) @interpolate(flat) slot: u32,
}

${ARROW_POLY.fns}

// per-edge arrow scale from the packed shapes word (B7): top byte, ×16
fn arrowScaleOf(pair: u32) -> f32 {
  let q = pair >> ${ARROW_SHIFT_SCALE}u;

  return select(f32(q) / 16.0, 1.0, q == 0u);
}

// arrow coverage (B7): filled tests sd, hollow strokes the outline at
// the per-end arrow width
fn arrowCoverage(sd: f32, hollow: bool, strokePx: f32) -> f32 {
  if (hollow) {
    return 1.0 - smoothstep(strokePx * 0.5 - 0.75, strokePx * 0.5 + 0.75, abs(sd));
  }

  return 1.0 - smoothstep(-0.75, 0.75, sd);
}


@vertex
fn vsArrow(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> ArrowVSOut {
  var out: ArrowVSOut;

  let slot = visible[ii];
  let isSource = end.endId == 1u;
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

  // The tip sits spacing(shape) behind the tip node's boundary (border
  // straddles half in, half out).  Round 56: before this the tip sat *on*
  // the boundary and the two disc heads compensated by carrying their
  // point tables and SDF shifted back a radius — exact, but it left
  // spacing meaning zero to the renderer and v3's value to the
  // accessors.  Now v3's rule applies to every head and the arrow frame
  // is v3's frame, so sourceEndpoint() can report the point drawn.
  let half = nodeOuterHalf[tipSlot] * frame.zoomDpr;
  let word = arrowWordOf(edgeWidths[slot]);
  let thisShape = select(tgtShapeOf(word), srcShapeOf(word), isSource);
  let spacing = arrowSpacingW(thisShape, edgeWidths[slot].x, scaleOfWord(word)) * frame.zoomDpr;
  let tip = tipC - dir * (boundaryOffset(nodeShapes[tipSlot], half, dir) + spacing);

  // sizing follows the drawn (floored) edge width; alpha matches the
  // edge LOD.  The quad covers the frame's max arrow-scale (B7) — the
  // FS renders the exact per-edge scale within it.
  let lod = edgeLod(slot, edgeWidths[slot].x * frame.zoomDpr, frame.edgeWidthFloor);
  let widthPx = max(edgeWidths[slot].x * frame.zoomDpr, frame.edgeWidthFloor);
  let sMax = max(frame.arrowScaleMax, 1.0);
  // 27.3: the quad covers the largest arrow this edge could draw (the
  // frame's max arrow-scale); the FS renders the exact per-edge size
  let sizeMax = arrowSizePx(edgeWidths[slot].x, sMax, frame.zoomDpr);
  // 56: a hollow head strokes its outline, so its ink reaches half a
  // stroke width *outside* the polygon — furthest out at the back
  // corners, where two edges meet acutely and the join juts past both.
  // That was clipped to the quad's 1px AA margin and read as flat-cut
  // corners against v3.  frame.arrowWidthMax is the monotone maximum of
  // the styled stroke widths (the vertex stage has no binding for the
  // per-edge column); over-growing a filled head's quad costs a few
  // transparent fragments.
  let hollowReach = frame.arrowWidthMax * frame.zoomDpr * 0.5;
  let arrowLen = sizeMax * ARROW_MAX_BACK + edgeWidths[slot].x * frame.zoomDpr + hollowReach;
  let halfBase = sizeMax * ARROW_HALF_LATERAL + hollowReach;

  let n = vec2f(-dir.y, dir.x);
  let corner = quadCorner(vi);
  let t = (corner.y + 1.0) * 0.5; // 0 at base, 1 at tip
  // arrow-local frame: y = 0 at the arrow origin, negative behind (v3's
  // arrow tables), positive in front — the disc heads are centred on the
  // origin and so reach ARROW_MAX_FRONT past it (round 56).  1px AA
  // margin on every side.
  // 1px AA margin; pickPadPx grows the pick quad by the hit halo (57.10)
  let yLocal = mix(-(arrowLen + frame.pickPadPx + 1.0), sizeMax * ARROW_MAX_FRONT + hollowReach + frame.pickPadPx + 1.0, t); // 56
  let lateral = corner.x * (halfBase + frame.pickPadPx + 1.0);

  out.position = vec4f(pxToClip(frame, tip + dir * yLocal + n * lateral), EDGE_Z, 1.0);
  out.p = vec2f(lateral, yLocal);
  out.widthModel = edgeWidths[slot].x;
  out.slot = slot;
  // edge opacity is pre-folded into c.a at style-write time
  out.color = vec4f(c.rgb, c.a * lod.y * (1.0 - frame.edgeDim));
  return out;
}

// v3's getArrowWidth (round 27.3): a nonlinear size with a 29-unit
// floor, evaluated in *model* space and only then scaled to device px.
// Evaluating in model space is load-bearing — v3's floor is a model
// floor, so applying the formula to the LOD-floored *device* width would
// make arrows grow as you zoom out instead of shrinking with the edge.
fn arrowSizePx(widthModel: f32, scale: f32, zoomDpr: f32) -> f32 {
  return max(pow(widthModel * 13.37, 0.9), 29.0) * scale * zoomDpr;
}

// v3's triangle-cross bar (27.6): a rectangle spanning the triangle's
// base, offset to y = -0.4 * s, whose thickness is the *edge width*
// rather than a fraction of the arrow — v3 shifts its two back points by
// edgeWidth / size so the bar reads as a continuation of the line.
fn crossBarSD(p: vec2f, s: f32, edgeWidthPx: f32) -> f32 {
  let halfX = 0.15 * s;
  let yTop = -0.4 * s;
  let yBot = yTop - edgeWidthPx;
  let c = vec2f(0.0, (yTop + yBot) * 0.5);
  let h = vec2f(halfX, (yTop - yBot) * 0.5);
  let q = abs(p - c) - h;

  return min(max(q.x, q.y), 0.0) + length(max(q, vec2f(0.0)));
}


// v3 scales its arrow point tables by 'size' directly, so 'size' is the
// point scale, not a length — getting that backwards makes arrows 3.3x
// too long, which is how it was caught (27.3).
//
// The quad has to cover the furthest-reaching head, which is *not* the
// plain triangle's 0.3: triangle-tee reaches 0.5 and the back-shifted
// circle-triangle 0.6.  ARROW_MAX_BACK is computed from the tables so
// adding a head cannot silently clip it (27.6).  triangle-cross's bar
// additionally hangs the edge width below its base, so that is added at
// the call site.
const ARROW_MAX_BACK: f32 = ${ARROW_MAX_BACK};
// how far in front of the origin a head reaches — nonzero only for the
// two disc heads, which v3 centres on the origin (round 56)
const ARROW_MAX_FRONT: f32 = ${ARROW_MAX_FRONT};
const ARROW_HALF_LATERAL: f32 = 0.15;

// this end's shape id from the packed word (C1: ends + mids)
fn endShapeOf(pair: u32, endId: u32) -> u32 {
  switch endId {
    case 1u: { return (pair >> ${ARROW_SHIFT_SOURCE}u) & ${ARROW_SHAPE_MASK}u; }     // source
    case 2u: { return (pair >> ${ARROW_SHIFT_MID_TARGET}u) & ${ARROW_SHAPE_MASK}u; } // mid-target
    case 3u: { return (pair >> ${ARROW_SHIFT_MID_SOURCE}u) & ${ARROW_SHAPE_MASK}u; } // mid-source
    default: { return (pair >> ${ARROW_SHIFT_TARGET}u) & ${ARROW_SHAPE_MASK}u; }     // target
  }
}

// hollow applies to the end arrows only (mids are always filled — C1)
fn endHollowOf(pair: u32, endId: u32) -> bool {
  if (endId == 1u) { return ((pair >> ${ARROW_SHIFT_HOLLOW_SOURCE}u) & 1u) == 1u; }
  if (endId == 0u) { return ((pair >> ${ARROW_SHIFT_HOLLOW_TARGET}u) & 1u) == 1u; }
  return false;
}

@fragment
fn fsArrow(in: ArrowVSOut) -> @location(0) vec4f {
  let pair = arrowShapes[in.slot];
  let shape = endShapeOf(pair, end.endId);
  let hollow = endHollowOf(pair, end.endId);
  let p = in.p;
  // exact per-edge sizing (B7): the uniform scale unit × arrow-scale
  // 27.3: v3's model-space size, resolved per fragment because the exact
  // arrow scale lives in the fragment-visible shapes word
  let s = arrowSizePx(in.widthModel, arrowScaleOf(pair), frame.zoomDpr);
  var sd = 1e6;

  switch shape {
${ARROW_POLY.cases}
    case 4u: { sd = length(p) - 0.15 * s; } // circle: v3's frame, centred on the origin (56)
    default: { sd = 1e6; } // none (already degenerate in the VS)
  }

  let aw = arrowWidths[in.slot];
  let strokePx = select(aw.y, aw.x, end.endId == 1u) * frame.zoomDpr;
  let alpha = in.color.a * arrowCoverage(sd, hollow, strokePx);
  return vec4f(in.color.rgb * alpha, alpha); // premultiplied
}

// Arrowhead picking (round 57.10): a head answers as its edge, with
// the same id the line writes, so overwrite order in the tile cannot
// matter.  The hit region is the head's *area* regardless of
// arrow-fill — v3's shape.collide tests the filled point table for
// hollow heads too — grown by the hit halo.  No-arrow ends already
// collapsed in the VS (c.a == 0), so no alpha test is needed here.
@fragment
fn fsArrowPick(in: ArrowVSOut) -> @location(0) u32 {
  let pair = arrowShapes[in.slot];
  let shape = endShapeOf(pair, end.endId);
  let p = in.p;
  let s = arrowSizePx(in.widthModel, arrowScaleOf(pair), frame.zoomDpr);
  var sd = 1e6;

  switch shape {
${ARROW_POLY.cases}
    case 4u: { sd = length(p) - 0.15 * s; } // circle: v3's frame (56)
    default: { sd = 1e6; } // none
  }

  if (sd > frame.pickPadPx) {
    discard;
  }

  return (in.slot + 1u) | 0x80000000u; // the owning edge's pick id
}

// Mid arrows (C1): tip at the edge midpoint (the haystack offset
// midpoint for kind 6), pointing along the chord — mid-source flipped
// backward, exactly v3's midsrcArrowAngle.
@vertex
fn vsMidArrow(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> ArrowVSOut {
  var out: ArrowVSOut;

  let slot = visible[ii];
  let c = unpack4x8unorm(arrows[slot]);

  if (c.a == 0.0) {
    out.position = vec4f(2.0, 2.0, 0.0, 1.0);
    return out;
  }

  let ends = endpoints[slot];
  let params = curveParams[slot];
  var pa = nodePositions[ends.x];
  var pb = nodePositions[ends.y];

  if (params.w == 6.0) { // haystack: mid of the offset points (v3's rs.mid)
    pa = pa + vec2f(cos(params.x), sin(params.x)) * nodeOuterHalf[ends.x] * params.z;
    pb = pb + vec2f(cos(params.y), sin(params.y)) * nodeOuterHalf[ends.y] * params.z;
  }

  let mid = modelToPx(frame, (pa + pb) * 0.5);
  let ab = modelToPx(frame, pb) - modelToPx(frame, pa);
  let len = max(length(ab), 1e-4);
  var dir = ab / len;

  if (end.endId == 3u) { dir = -dir; } // mid-source points backward

  let lod = edgeLod(slot, edgeWidths[slot].x * frame.zoomDpr, frame.edgeWidthFloor);
  let widthPx = max(edgeWidths[slot].x * frame.zoomDpr, frame.edgeWidthFloor);
  let sMax = max(frame.arrowScaleMax, 1.0);
  // 27.3: the quad covers the largest arrow this edge could draw (the
  // frame's max arrow-scale); the FS renders the exact per-edge size
  let sizeMax = arrowSizePx(edgeWidths[slot].x, sMax, frame.zoomDpr);
  // 56: a hollow head strokes its outline, so its ink reaches half a
  // stroke width *outside* the polygon — furthest out at the back
  // corners, where two edges meet acutely and the join juts past both.
  // That was clipped to the quad's 1px AA margin and read as flat-cut
  // corners against v3.  frame.arrowWidthMax is the monotone maximum of
  // the styled stroke widths (the vertex stage has no binding for the
  // per-edge column); over-growing a filled head's quad costs a few
  // transparent fragments.
  let hollowReach = frame.arrowWidthMax * frame.zoomDpr * 0.5;
  let arrowLen = sizeMax * ARROW_MAX_BACK + edgeWidths[slot].x * frame.zoomDpr + hollowReach;
  let halfBase = sizeMax * ARROW_HALF_LATERAL + hollowReach;

  let n = vec2f(-dir.y, dir.x);
  let corner = quadCorner(vi);
  let t = (corner.y + 1.0) * 0.5;
  // 1px AA margin; pickPadPx grows the pick quad by the hit halo (57.10)
  let yLocal = mix(-(arrowLen + frame.pickPadPx + 1.0), sizeMax * ARROW_MAX_FRONT + hollowReach + frame.pickPadPx + 1.0, t); // 56
  let lateral = corner.x * (halfBase + frame.pickPadPx + 1.0);

  out.position = vec4f(pxToClip(frame, mid + dir * yLocal + n * lateral), EDGE_Z, 1.0);
  out.p = vec2f(lateral, yLocal);
  out.widthModel = edgeWidths[slot].x;
  out.slot = slot;
  out.color = vec4f(c.rgb, c.a * lod.y * (1.0 - frame.edgeDim));
  return out;
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
export const CURVED_ARROW_SHADER = wgsl`
${COMMON}
${BOUNDARY_WGSL}
${ARROW_GAP_WGSL}
${CURVE_WGSL}
${ROUTE_WGSL}

@group(0) @binding(0) var<uniform> frame: Frame;
@group(0) @binding(1) var<storage, read> endpoints: array<vec2u>;
@group(0) @binding(2) var<storage, read> edgeWidths: array<vec2f>; // .x width, .y arrow bits (round 56)
@group(0) @binding(3) var<storage, read> nodePositions: array<vec2f>;
@group(0) @binding(4) var<storage, read> nodeOuterHalf: array<vec2f>;
@group(0) @binding(5) var<storage, read> nodeShapes: array<u32>;
@group(0) @binding(6) var<storage, read> curveParams: array<vec4f>;
@group(0) @binding(7) var<storage, read> curveBlob: array<f32>;

// 0 target, 1 source, 2 mid-target, 3 mid-source (C1)
struct End { endId: u32 }
@group(0) @binding(8) var<uniform> end: End;
// fragment-stage: this end's arrow colors + the packed shape ids +
// hollow stroke widths (B7)
@group(0) @binding(9) var<storage, read> arrows: array<u32>;
@group(0) @binding(10) var<storage, read> arrowShapes: array<u32>;
@group(0) @binding(11) var<storage, read> arrowWidths: array<vec2f>;

@group(1) @binding(0) var<storage, read> visible: array<u32>;

struct ArrowVSOut {
  @builtin(position) position: vec4f,
  @location(0) p: vec2f,    // arrow-local device px: x lateral, y (≤0) behind the tip
  @location(1) @interpolate(flat) alphaComp: f32,
  @location(2) @interpolate(flat) widthModel: f32, // edge width in model px (27.3)
  @location(3) @interpolate(flat) slot: u32,
}

${ARROW_POLY.fns}

// v3's getArrowWidth (27.3) — the twin of the straight shader's copy:
// a model-space nonlinear size with a 29-unit floor, then scaled to
// device px.  Keep the two in step.
fn arrowSizePx(widthModel: f32, scale: f32, zoomDpr: f32) -> f32 {
  return max(pow(widthModel * 13.37, 0.9), 29.0) * scale * zoomDpr;
}

// v3's triangle-cross bar (27.6): a rectangle spanning the triangle's
// base, offset to y = -0.4 * s, whose thickness is the *edge width*
// rather than a fraction of the arrow — v3 shifts its two back points by
// edgeWidth / size so the bar reads as a continuation of the line.
fn crossBarSD(p: vec2f, s: f32, edgeWidthPx: f32) -> f32 {
  let halfX = 0.15 * s;
  let yTop = -0.4 * s;
  let yBot = yTop - edgeWidthPx;
  let c = vec2f(0.0, (yTop + yBot) * 0.5);
  let h = vec2f(halfX, (yTop - yBot) * 0.5);
  let q = abs(p - c) - h;

  return min(max(q.x, q.y), 0.0) + length(max(q, vec2f(0.0)));
}


// v3 scales its arrow point tables by 'size' directly, so 'size' is the
// point scale, not a length — getting that backwards makes arrows 3.3x
// too long, which is how it was caught (27.3).
//
// The quad has to cover the furthest-reaching head, which is *not* the
// plain triangle's 0.3: triangle-tee reaches 0.5 and the back-shifted
// circle-triangle 0.6.  ARROW_MAX_BACK is computed from the tables so
// adding a head cannot silently clip it (27.6).  triangle-cross's bar
// additionally hangs the edge width below its base, so that is added at
// the call site.
const ARROW_MAX_BACK: f32 = ${ARROW_MAX_BACK};
// how far in front of the origin a head reaches — nonzero only for the
// two disc heads, which v3 centres on the origin (round 56)
const ARROW_MAX_FRONT: f32 = ${ARROW_MAX_FRONT};
const ARROW_HALF_LATERAL: f32 = 0.15;

// per-edge arrow scale from the packed shapes word (B7): top byte, ×16
fn arrowScaleOf(pair: u32) -> f32 {
  let q = pair >> ${ARROW_SHIFT_SCALE}u;

  return select(f32(q) / 16.0, 1.0, q == 0u);
}

fn arrowCoverage(sd: f32, hollow: bool, strokePx: f32) -> f32 {
  if (hollow) {
    return 1.0 - smoothstep(strokePx * 0.5 - 0.75, strokePx * 0.5 + 0.75, abs(sd));
  }

  return 1.0 - smoothstep(-0.75, 0.75, sd);
}
fn endShapeOf(pair: u32, endId: u32) -> u32 {
  switch endId {
    case 1u: { return (pair >> ${ARROW_SHIFT_SOURCE}u) & ${ARROW_SHAPE_MASK}u; }     // source
    case 2u: { return (pair >> ${ARROW_SHIFT_MID_TARGET}u) & ${ARROW_SHAPE_MASK}u; } // mid-target
    case 3u: { return (pair >> ${ARROW_SHIFT_MID_SOURCE}u) & ${ARROW_SHAPE_MASK}u; } // mid-source
    default: { return (pair >> ${ARROW_SHIFT_TARGET}u) & ${ARROW_SHAPE_MASK}u; }     // target
  }
}

fn endHollowOf(pair: u32, endId: u32) -> bool {
  if (endId == 1u) { return ((pair >> ${ARROW_SHIFT_HOLLOW_SOURCE}u) & 1u) == 1u; }
  if (endId == 0u) { return ((pair >> ${ARROW_SHIFT_HOLLOW_TARGET}u) & 1u) == 1u; }
  return false;
}


@vertex
fn vsArrow(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> ArrowVSOut {
  var out: ArrowVSOut;

  let slot = visible[ii];
  let isSource = end.endId == 1u;
  let ends = endpoints[slot];
  let params = curveParams[slot];
  let tipSlot = select(ends.y, ends.x, isSource);

  // the point the end tangent runs from: the near control (bezier /
  // loop), or the first/last interior route point (12b families; with
  // no interior points — the 12c endpoint chord — the far endpoint)
  var toward: vec2f;
  var tip: vec2f;

  if (params.w <= 2.0 || params.w == 16.0) {
    let g = evalCurveGeom(
      params,
      nodePositions[ends.x], nodeOuterHalf[ends.x], nodeShapes[ends.x],
      nodePositions[ends.y], nodeOuterHalf[ends.y], nodeShapes[ends.y],
      arrowTrimOf(edgeWidths[slot])
    );

    toward = select(g.c2, g.c1, isSource);
    // Round 56: the evaluator resolves both of v3's shortenings, and the
    // *arrow* point is the one a head sits on — spacing behind the
    // boundary, where g.s/g.e are the gap-shortened line ends.  Reading
    // the line end here and subtracting spacing on top of it would
    // double the shortening, which is what pulled the heads off their
    // nodes when this shader was first wired up.
    tip = modelToPx(frame, select(g.aE, g.aS, isSource));
  } else {
    var route = evalRouteW(
      params,
      nodePositions[ends.x], nodeOuterHalf[ends.x], nodeShapes[ends.x],
      nodePositions[ends.y], nodeOuterHalf[ends.y], nodeShapes[ends.y],
      arrowTrimOf(edgeWidths[slot])
    );
    let qn = route.n + 2u;

    if (route.n == 0u) { // the 12c endpoint chord: aim at the far endpoint
      toward = select(route.q[0u], route.q[1u], isSource);
    } else {
      toward = select(route.q[route.n], route.q[1u], isSource);
    }

    // the route's *arrow* point (56) — for default modes the boundary
    // point pulled back by spacing; for 12c manual endpoints the
    // manual/inside/shortened point (v3's arrowStart/End)
    tip = modelToPx(frame, select(route.aE, route.aS, isSource));
  }

  let toTip2 = tip - modelToPx(frame, toward);
  let len = max(length(toTip2), 1e-4);
  let dir = toTip2 / len;


  // sizing follows the drawn (floored) edge width; the curved stream is
  // never decimated, so the alpha comp is the plain width-floor ratio.
  // The quad covers the frame's max arrow-scale (B7); the FS renders
  // the exact per-edge scale within it.
  let widthPx = max(edgeWidths[slot].x * frame.zoomDpr, frame.edgeWidthFloor);
  let alphaComp = min(edgeWidths[slot].x * frame.zoomDpr / max(frame.edgeWidthFloor, 1e-4), 1.0);
  let sMax = max(frame.arrowScaleMax, 1.0);
  // 27.3: the quad covers the largest arrow this edge could draw (the
  // frame's max arrow-scale); the FS renders the exact per-edge size
  let sizeMax = arrowSizePx(edgeWidths[slot].x, sMax, frame.zoomDpr);
  // 56: a hollow head strokes its outline, so its ink reaches half a
  // stroke width *outside* the polygon — furthest out at the back
  // corners, where two edges meet acutely and the join juts past both.
  // That was clipped to the quad's 1px AA margin and read as flat-cut
  // corners against v3.  frame.arrowWidthMax is the monotone maximum of
  // the styled stroke widths (the vertex stage has no binding for the
  // per-edge column); over-growing a filled head's quad costs a few
  // transparent fragments.
  let hollowReach = frame.arrowWidthMax * frame.zoomDpr * 0.5;
  let arrowLen = sizeMax * ARROW_MAX_BACK + edgeWidths[slot].x * frame.zoomDpr + hollowReach;
  let halfBase = sizeMax * ARROW_HALF_LATERAL + hollowReach;

  let n = vec2f(-dir.y, dir.x);
  let corner = quadCorner(vi);
  let t = (corner.y + 1.0) * 0.5; // 0 at base, 1 at tip
  // 1px AA margin; pickPadPx grows the pick quad by the hit halo (57.10)
  let yLocal = mix(-(arrowLen + frame.pickPadPx + 1.0), sizeMax * ARROW_MAX_FRONT + hollowReach + frame.pickPadPx + 1.0, t); // 56
  let lateral = corner.x * (halfBase + frame.pickPadPx + 1.0);

  out.position = vec4f(pxToClip(frame, tip + dir * yLocal + n * lateral), EDGE_Z, 1.0);
  out.p = vec2f(lateral, yLocal);
  out.widthModel = edgeWidths[slot].x;
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
  let shape = endShapeOf(pair, end.endId);
  let hollow = endHollowOf(pair, end.endId);
  let p = in.p;
  // 27.3: v3's model-space size, resolved per fragment because the exact
  // arrow scale lives in the fragment-visible shapes word
  let s = arrowSizePx(in.widthModel, arrowScaleOf(pair), frame.zoomDpr);
  var sd = 1e6;

  switch shape {
${ARROW_POLY.cases}
    case 4u: { sd = length(p) - 0.15 * s; } // circle: v3's frame, centred on the origin (56)
    default: { sd = 1e6; } // none: fully discarded by alpha
  }

  let aw = arrowWidths[in.slot];
  let strokePx = select(aw.y, aw.x, end.endId == 1u) * frame.zoomDpr;
  let alpha = c.a * in.alphaComp * (1.0 - frame.edgeDim) * arrowCoverage(sd, hollow, strokePx);
  return vec4f(c.rgb * alpha, alpha); // premultiplied
}

// Arrowhead picking (round 57.10) — the straight shader's twin; see
// the note there.  One difference: this stream's no-arrow ends
// rasterize a small transparent quad rather than collapsing in the VS
// (the colors live in the fragment stage), so they are dropped by the
// alpha test the scene FS gets for free.
@fragment
fn fsArrowPick(in: ArrowVSOut) -> @location(0) u32 {
  if (unpack4x8unorm(arrows[in.slot]).a == 0.0) {
    discard;
  }

  let pair = arrowShapes[in.slot];
  let shape = endShapeOf(pair, end.endId);
  let p = in.p;
  let s = arrowSizePx(in.widthModel, arrowScaleOf(pair), frame.zoomDpr);
  var sd = 1e6;

  switch shape {
${ARROW_POLY.cases}
    case 4u: { sd = length(p) - 0.15 * s; } // circle: v3's frame (56)
    default: { sd = 1e6; } // none
  }

  if (sd > frame.pickPadPx) {
    discard;
  }

  return (in.slot + 1u) | 0x80000000u; // the owning edge's pick id
}

// Mid arrows on curved edges (C1): tip at the curve/route midpoint,
// along the midpoint tangent (v3's per-family disp rules — the same
// frame the edge labels rotate by); mid-source flips backward.
@vertex
fn vsMidArrow(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> ArrowVSOut {
  var out: ArrowVSOut;

  let slot = visible[ii];
  let ends = endpoints[slot];
  let params = curveParams[slot];
  var mid: vec2f;
  var tangent: vec2f;

  if (params.w <= 2.0 || params.w == 16.0) {
    let g = evalCurveGeom(
      params,
      nodePositions[ends.x], nodeOuterHalf[ends.x], nodeShapes[ends.x],
      nodePositions[ends.y], nodeOuterHalf[ends.y], nodeShapes[ends.y],
      arrowTrimOf(edgeWidths[slot])
    );

    mid = g.m;
    // a quadratic's t = 0.5 tangent is its chord; loops run c1 -> c2
    tangent = select(g.e - g.s, g.c2 - g.c1, params.w == 2.0);
  } else {
    var route = evalRouteW(
      params,
      nodePositions[ends.x], nodeOuterHalf[ends.x], nodeShapes[ends.x],
      nodePositions[ends.y], nodeOuterHalf[ends.y], nodeShapes[ends.y],
      arrowTrimOf(edgeWidths[slot])
    );
    let midTan = routeMidpointW(&route);

    mid = midTan.xy;
    tangent = midTan.zw;
  }

  let tl = max(length(tangent), 1e-6);
  var dir = tangent / tl;

  if (end.endId == 3u) { dir = -dir; } // mid-source points backward

  let midPx = modelToPx(frame, mid);
  let widthPx = max(edgeWidths[slot].x * frame.zoomDpr, frame.edgeWidthFloor);
  let alphaComp = min(edgeWidths[slot].x * frame.zoomDpr / max(frame.edgeWidthFloor, 1e-4), 1.0);
  let sMax = max(frame.arrowScaleMax, 1.0);
  // 27.3: the quad covers the largest arrow this edge could draw (the
  // frame's max arrow-scale); the FS renders the exact per-edge size
  let sizeMax = arrowSizePx(edgeWidths[slot].x, sMax, frame.zoomDpr);
  // 56: a hollow head strokes its outline, so its ink reaches half a
  // stroke width *outside* the polygon — furthest out at the back
  // corners, where two edges meet acutely and the join juts past both.
  // That was clipped to the quad's 1px AA margin and read as flat-cut
  // corners against v3.  frame.arrowWidthMax is the monotone maximum of
  // the styled stroke widths (the vertex stage has no binding for the
  // per-edge column); over-growing a filled head's quad costs a few
  // transparent fragments.
  let hollowReach = frame.arrowWidthMax * frame.zoomDpr * 0.5;
  let arrowLen = sizeMax * ARROW_MAX_BACK + edgeWidths[slot].x * frame.zoomDpr + hollowReach;
  let halfBase = sizeMax * ARROW_HALF_LATERAL + hollowReach;

  let n = vec2f(-dir.y, dir.x);
  let corner = quadCorner(vi);
  let t = (corner.y + 1.0) * 0.5;
  // 1px AA margin; pickPadPx grows the pick quad by the hit halo (57.10)
  let yLocal = mix(-(arrowLen + frame.pickPadPx + 1.0), sizeMax * ARROW_MAX_FRONT + hollowReach + frame.pickPadPx + 1.0, t); // 56
  let lateral = corner.x * (halfBase + frame.pickPadPx + 1.0);

  out.position = vec4f(pxToClip(frame, midPx + dir * yLocal + n * lateral), EDGE_Z, 1.0);
  out.p = vec2f(lateral, yLocal);
  out.widthModel = edgeWidths[slot].x;
  out.slot = slot;
  out.alphaComp = alphaComp;
  return out;
}
`;

/**
 * The label shader, generated for both variants: node labels anchor at
 * the node position; edge labels at the curve/route midpoint — or, for
 * the end-label streams (round 13 D4), at their arc offset from either
 * end — computed here in the VS, so every label follows
 * drags/layouts/position tweens on-GPU with zero rebuild.
 */
// end-label anchor walkers (round 13 D4): v3 anchors source/target
// labels at arc distance *-text-offset from each end along the drawn
// path.  Straight/haystack owners walk their segment exactly;
// bezier/loop owners walk a 32-sample polyline of the quad chain (v3
// itself walks a ~16-segment approximation); route families walk the
// route polyline — exactly v3's allpts walk for segments/taxi (both
// ignore corner rounding) — and multibezier walks its quad chain at 8
// samples per quad.  Returns (point.xy, tangent.zw).
const END_WALK_WGSL = wgsl`
fn segmentWalk(a: vec2f, b: vec2f, fromSource: bool, dist: f32) -> vec4f {
  let d = b - a;
  let l = max(length(d), 1e-6);
  let t = clamp(dist / l, 0.0, 1.0);

  if (fromSource) { return vec4f(a + d * t, d); }
  return vec4f(b - d * t, d);
}

fn curveEndWalk(g: CurveGeom, fromSource: bool, dist: f32) -> vec4f {
  let N = 32u;
  var remaining = dist;
  var p0 = curvePoint(g, select(1.0, 0.0, fromSource));
  var lastSeg = vec2f(1.0, 0.0);

  for (var i = 1u; i <= N; i = i + 1u) {
    let f = f32(i) / f32(N);
    let p1 = curvePoint(g, select(1.0 - f, f, fromSource));
    let seg = p1 - p0;
    let l = length(seg);

    if (remaining <= l) {
      return vec4f(p0 + seg * (remaining / max(l, 1e-6)), seg);
    }

    remaining = remaining - l;
    p0 = p1;
    lastSeg = seg;
  }

  return vec4f(p0, lastSeg); // past the far end: clamp there (v3's bound)
}

fn routeEndWalkW(r: ptr<function, Route>, fromSource: bool, dist: f32) -> vec4f {
  let n = (*r).n;
  var remaining = dist;

  if ((*r).kind == 3.0 && n > 0u) { // multibezier: the quad chain
    let S = 8u;
    var lastP = (*r).q[select(n + 1u, 0u, fromSource)];
    var lastSeg = vec2f(1.0, 0.0);

    for (var qi = 0u; qi < MAX_ROUTE_PTS; qi = qi + 1u) {
      if (qi >= n) { break; }

      let i = select(n - 1u - qi, qi, fromSource);
      let c = (*r).q[i + 1u];
      var a = (*r).q[0u];
      var b = (*r).q[n + 1u];

      if (i != 0u) { a = ((*r).q[i] + c) * 0.5; }
      if (i != n - 1u) { b = (c + (*r).q[i + 2u]) * 0.5; }

      for (var si = 0u; si < S; si = si + 1u) {
        let f0 = f32(si) / f32(S);
        let f1 = f32(si + 1u) / f32(S);
        let p0 = qbez(a, c, b, select(1.0 - f0, f0, fromSource));
        let p1 = qbez(a, c, b, select(1.0 - f1, f1, fromSource));
        let seg = p1 - p0;
        let l = length(seg);

        if (remaining <= l) {
          return vec4f(p0 + seg * (remaining / max(l, 1e-6)), seg);
        }

        remaining = remaining - l;
        lastP = p1;
        lastSeg = seg;
      }
    }

    return vec4f(lastP, lastSeg);
  }

  // polyline families: walk q[] from the chosen end
  var lastP = (*r).q[select(n + 1u, 0u, fromSource)];
  var lastSeg = vec2f(1.0, 0.0);

  for (var si = 0u; si < MAX_ROUTE_PTS + 1u; si = si + 1u) {
    if (si > n) { break; }

    let p0 = (*r).q[select(n + 1u - si, si, fromSource)];
    let p1 = (*r).q[select(n - si, si + 1u, fromSource)];
    let seg = p1 - p0;
    let l = length(seg);

    if (remaining <= l) {
      return vec4f(p0 + seg * (remaining / max(l, 1e-6)), seg);
    }

    remaining = remaining - l;
    lastP = p1;
    lastSeg = seg;
  }

  return vec4f(lastP, lastSeg);
}
`;

const labelShader = (edge: boolean): string => wgsl`
${COMMON}
${GLYPH_STRUCT}
${edge ? BOUNDARY_WGSL + ARROW_GAP_WGSL + CURVE_WGSL + ROUTE_WGSL + END_WALK_WGSL : ''}
// Round 56, a recorded deviation: this stage passes a **zero** arrow
// trim to the curve evaluators, so an edge label on an arrowed curved
// edge anchors at the *untrimmed* midpoint while midpoint() answers
// v3's trimmed one — about 2.6 model px apart on a bezier at
// arrow-scale 1.2.  The cause is a binding, not a decision: this vertex
// stage already binds 7 storage buffers plus the visible list, exactly
// the base budget, with no slot left for edge.width and therefore no way
// to reach the arrow word.  Closing it means freeing a binding here (the
// curved-edge pipeline's layout split is the precedent) and is logged as
// a follow-up rather than guessed at.
//
// flags columns are not bound here: the cull pass already dropped glyphs
// of dead/hidden owners.  The edge variant binds the curve inputs too —
// 7 storage buffers + the visible list (node size and border ride the
// derived outerHalf column; the curve param blob rides the freed slot),
// exactly the vertex-stage budget — so curved-edge labels anchor at the
// curve/route midpoint computed in the VS from live positions (zero
// rebuild on drags/layouts/tweens).
@group(0) @binding(0) var<uniform> frame: Frame;
@group(0) @binding(1) var<storage, read> glyphs: array<Glyph>;
${edge ? '@group(0) @binding(2) var<storage, read> endpoints: array<vec2u>;\n@group(0) @binding(3) var<storage, read> nodePositions: array<vec2f>;\n@group(0) @binding(4) var<storage, read> curveParams: array<vec4f>;\n@group(0) @binding(5) var<storage, read> nodeOuterHalf: array<vec2f>;\n@group(0) @binding(6) var<storage, read> nodeShapes: array<u32>;\n@group(0) @binding(7) var<storage, read> curveBlob: array<f32>;\n@group(0) @binding(8) var atlas: texture_2d<f32>;\n@group(0) @binding(9) var atlasSampler: sampler;' : '@group(0) @binding(2) var<storage, read> nodePositions: array<vec2f>;\n@group(0) @binding(3) var atlas: texture_2d<f32>;\n@group(0) @binding(4) var atlasSampler: sampler;'}

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
  ${
    edge
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

  if ((params.w != 0.0 && params.w <= 2.0) || params.w == 16.0) { // bezier / loop / compound midpoint
    let geom = evalCurveGeom(
      params,
      pa, nodeOuterHalf[ends.x], nodeShapes[ends.x],
      pb, nodeOuterHalf[ends.y], nodeShapes[ends.y],
      vec4f(0.0) // see the arrow-gap note below
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
      pb, nodeOuterHalf[ends.y], nodeShapes[ends.y],
      vec4f(0.0) // see the arrow-gap note below
    );
    let midTan = routeMidpointW(&route);

    anchor = midTan.xy;
    rotA = anchor;
    rotB = anchor + midTan.zw;
  }

  // end labels (round 13 D4): glyphs on the edgeSource/edgeTarget
  // streams re-anchor at |endParam| - 1 model px of arc distance from
  // their end (sign picks the end), walking the same drawn path the
  // edge shaders evaluate — v3's calculateEndProjection on-GPU
  if (g.endParam != 0.0) {
    let fromSource = g.endParam > 0.0;
    let dist = abs(g.endParam) - 1.0;
    var at: vec4f;

    if ((params.w != 0.0 && params.w <= 2.0) || params.w == 16.0) { // bezier / loop / compound
      let geom = evalCurveGeom(
        params,
        pa, nodeOuterHalf[ends.x], nodeShapes[ends.x],
        pb, nodeOuterHalf[ends.y], nodeShapes[ends.y],
        vec4f(0.0) // see the arrow-gap note below
      );

      at = curveEndWalk(geom, fromSource, dist);
    } else if (params.w == 6.0) { // haystack: the offset segment
      let ha = pa + vec2f(cos(params.x), sin(params.x)) * nodeOuterHalf[ends.x] * params.z;
      let hb = pb + vec2f(cos(params.y), sin(params.y)) * nodeOuterHalf[ends.y] * params.z;

      at = segmentWalk(ha, hb, fromSource, dist);
    } else if (params.w > 2.0 && params.w != 7.0) { // route families
      var endRoute = evalRouteW(
        params,
        pa, nodeOuterHalf[ends.x], nodeShapes[ends.x],
        pb, nodeOuterHalf[ends.y], nodeShapes[ends.y],
        vec4f(0.0) // see the arrow-gap note below
      );

      at = routeEndWalkW(&endRoute, fromSource, dist);
    } else { // straight / straight-triangle: the boundary chord
      var d = pb - pa;
      let l = length(d);

      if (l < 1e-6) { d = vec2f(1.0, 0.0); } else { d = d / l; }

      let sPt = pa + d * boundaryOffset(nodeShapes[ends.x], nodeOuterHalf[ends.x], d);
      let ePt = pb - d * boundaryOffset(nodeShapes[ends.y], nodeOuterHalf[ends.y], -d);

      at = segmentWalk(sPt, ePt, fromSource, dist);
    }

    anchor = at.xy;
    rotA = anchor;
    rotB = anchor + at.zw;
  }`
      : 'let anchor = nodePositions[g.nodeSlot];'
  }
  let originPx = modelToPx(frame, anchor) + g.offset * frame.zoomDpr;
  let sizePx = g.size * frame.zoomDpr;
  let t = (quadCorner(vi) + vec2f(1.0)) * 0.5;
  var posPx = originPx + t * sizePx;
  // text-rotation.  Autorotate (edge stream only) resolves the frame from
  // the edge's flip-normalized angle, live, so it follows drags and
  // tweens on-GPU; a numeric rotation (27.7) is a stored angle and works
  // on every stream, node labels included.  Both take the same path:
  // rotate the run's local rect about its anchor.
  ${
    edge
      ? `let autorot = (g.nodeSlot & GLYPH_ROTATE) != 0u;`
      : `let autorot = false;`
  }

  if (autorot || g.rotation != 0.0) {
    ${
      edge
        ? `let cs = select(vec2f(cos(g.rotation), sin(g.rotation)), autorotateFrame(rotA, rotB), autorot);`
        : `let cs = vec2f(cos(g.rotation), sin(g.rotation));`
    }
    let local = g.offset + t * g.size; // model px from the anchor

    posPx = modelToPx(frame, anchor) + rotateBy(cs, local) * frame.zoomDpr;
  }
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

export const LABEL_SHADER = labelShader(false);
export const EDGE_LABEL_SHADER = labelShader(true);

/*
Background-image compositing (round 15.3): imaged nodes draw one extra
instanced quad per node right after their body (leaf stream) or right
after the parent bodies (parent stream), off the same culled visible
lists.  The FS walks the node's image records (<= 4, the recorded cap)
in list order, compositing later images over earlier ones, and samples
the size-tiered texture arrays with explicit gradients
(textureSampleGrad), so the per-record control flow needs no
uniformity.  All placement math runs in model px straight from the
blob records; `clip: node` masks by the node SDF — containment
'inside' clips at the border's inner edge (the border stays visible
over the image; a translucent border shows fill, not image — a
recorded deviation beside the B1 band rule), 'over' clips at the shape
boundary.  Repeat tiles are confined to the node box (recorded).
*/
export const IMAGE_SHADER = wgsl`
${COMMON}
${SDF}

@group(0) @binding(0) var<uniform> frame: Frame;
@group(0) @binding(1) var<storage, read> positions: array<vec2f>;
@group(0) @binding(2) var<storage, read> sizes: array<vec2f>;
@group(0) @binding(3) var<storage, read> opacities: array<f32>;
@group(0) @binding(4) var<storage, read> borderGeom: array<vec4u>;
@group(0) @binding(5) var<storage, read> borderWidths: array<f32>;
@group(0) @binding(6) var<storage, read> imageRefs: array<u32>;
@group(0) @binding(7) var<storage, read> imageBlob: array<f32>;
@group(0) @binding(8) var<storage, read> imageTable: array<vec4u>;
@group(0) @binding(9) var<storage, read> polyBlob: array<f32>;
@group(1) @binding(0) var<storage, read> visible: array<u32>;
@group(2) @binding(0) var tier0: texture_2d_array<f32>;
@group(2) @binding(1) var tier1: texture_2d_array<f32>;
@group(2) @binding(2) var tier2: texture_2d_array<f32>;
@group(2) @binding(3) var imageSamp: sampler;
@group(2) @binding(4) var icons: texture_2d_array<f32>;

const IMG_STRIDE: u32 = 12u;

struct ImgRec {
  entry: u32,
  fit: u32,
  repeat: u32,
  clip: u32,
  containment: u32,
  smoothing: u32,
  sdf: u32,
  opacity: f32,
  tint: vec4f,
  // pos.xy = position-x/-y, pos.zw = offset-x/-y (values; units below)
  pos: vec4f,
  size: vec2f,
  units: u32,
}

fn readRec(off: u32, i: u32) -> ImgRec {
  let base = off + i * IMG_STRIDE;
  var rec: ImgRec;
  let flags = u32(imageBlob[base + 1u]);

  rec.entry = u32(imageBlob[base]);
  rec.fit = flags & 3u;
  rec.repeat = (flags >> 2u) & 3u;
  rec.clip = (flags >> 4u) & 1u;
  rec.containment = (flags >> 5u) & 1u;
  rec.smoothing = (flags >> 6u) & 1u;
  rec.sdf = (flags >> 7u) & 1u;
  rec.opacity = imageBlob[base + 2u];
  rec.pos = vec4f(imageBlob[base + 3u], imageBlob[base + 4u], imageBlob[base + 5u], imageBlob[base + 6u]);
  rec.size = vec2f(imageBlob[base + 7u], imageBlob[base + 8u]);
  rec.units = u32(imageBlob[base + 9u]);

  // the sdf tint rides two bytes per float (r + g*256, b + a*256)
  let rg = imageBlob[base + 10u];
  let ba = imageBlob[base + 11u];
  let tg = floor(rg / 256.0);
  let ta = floor(ba / 256.0);

  rec.tint = vec4f(rg - tg * 256.0, tg, ba - ta * 256.0, ta) / 255.0;

  return rec;
}

// resolve the image's draw rect in node-local model px:
// (origin.xy, size.zw), origin at the rect's top-left, node center at 0
fn imageRect(rec: ImgRec, half: vec2f, nat: vec2f) -> vec4f {
  let box = half * 2.0;
  var s: vec2f;

  if (rec.fit == 1u) { // contain
    let k = min(box.x / max(nat.x, 1.0), box.y / max(nat.y, 1.0));
    s = nat * k;
  } else if (rec.fit == 2u) { // cover
    let k = max(box.x / max(nat.x, 1.0), box.y / max(nat.y, 1.0));
    s = nat * k;
  } else {
    let wMode = (rec.units >> 4u) & 3u;
    let hMode = (rec.units >> 6u) & 3u;

    s.x = select(select(rec.size.x, rec.size.x / 100.0 * box.x, wMode == 2u), nat.x, wMode == 0u);
    s.y = select(select(rec.size.y, rec.size.y / 100.0 * box.y, hMode == 2u), nat.y, hMode == 0u);
  }

  var o = -half;

  // v3 position semantics: percent aligns within the free space
  // (box - image), px offsets from the node's top-left
  o.x += select(rec.pos.x, (box.x - s.x) * rec.pos.x / 100.0, (rec.units & 1u) == 1u);
  o.y += select(rec.pos.y, (box.y - s.y) * rec.pos.y / 100.0, ((rec.units >> 1u) & 1u) == 1u);
  // background-offset-x/-y adds px (or percent of the node box)
  o.x += select(rec.pos.z, box.x * rec.pos.z / 100.0, ((rec.units >> 2u) & 1u) == 1u);
  o.y += select(rec.pos.w, box.y * rec.pos.w / 100.0, ((rec.units >> 3u) & 1u) == 1u);

  return vec4f(o, s);
}

fn tierSizeOf(tier: u32) -> f32 {
  if (tier == 3u) { return f32(${SDF_IMAGE_SIZE_WGSL}); } // the r8 icon array
  if (tier == 0u) { return ${IMAGE_TIER_SIZES_WGSL[0]}.0; }
  if (tier == 1u) { return ${IMAGE_TIER_SIZES_WGSL[1]}.0; }
  return ${IMAGE_TIER_SIZES_WGSL[2]}.0;
}

struct ImageVSOut {
  @builtin(position) position: vec4f,
  @location(0) local: vec2f, // node-local model px
  @location(1) @interpolate(flat) instance: u32,
}

@vertex
fn vsImage(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> ImageVSOut {
  var out: ImageVSOut;
  let slot = visible[ii];
  let iref = imageRefs[slot];

  if (iref == 0u) { // imageless: collapse the quad
    out.position = vec4f(2.0, 2.0, 0.0, 1.0);
    out.local = vec2f(0.0);
    out.instance = slot;

    return out;
  }

  let count = iref >> 24u;
  let off = iref & 0xffffffu;
  let half = sizes[slot] * 0.5;

  // 15.7: below imageMinPx on-screen the image is unreadable anyway —
  // collapse the quad (the plain-disc LOD owns the pixel below ~3px)
  if (max(half.x, half.y) * 2.0 * frame.zoomDpr < frame.imageMinPx) {
    out.position = vec4f(2.0, 2.0, 0.0, 1.0);
    out.local = vec2f(0.0);
    out.instance = slot;

    return out;
  }

  var ext = half;

  // clip: none images may overflow the node box — grow the quad to the
  // union of their rects (repeat stays confined to the box, recorded)
  for (var i = 0u; i < count; i = i + 1u) {
    let rec = readRec(off, i);

    if (rec.clip != 0u) { continue; }

    let t = imageTable[rec.entry];

    if ((t.x & 3u) != 1u) { continue; }

    let nat = vec2f(f32(t.y & 0xffffu), f32(t.y >> 16u));
    let rect = imageRect(rec, half, nat);

    ext = max(ext, max(abs(rect.xy), abs(rect.xy + rect.zw)));
  }

  let margin = 2.0 / frame.zoomDpr; // AA slack, model px
  let corner = quadCorner(vi) * (ext + vec2f(margin));
  let px = modelToPx(frame, positions[slot] + corner);

  out.position = vec4f(pxToClip(frame, px), 0.0, 1.0);
  out.local = corner;
  out.instance = slot;

  return out;
}

@fragment
fn fsImage(in: ImageVSOut) -> @location(0) vec4f {
  let slot = in.instance;
  let iref = imageRefs[slot];

  if (iref == 0u) { discard; }

  let count = iref >> 24u;
  let off = iref & 0xffffffu;
  let half = sizes[slot] * 0.5;
  let p = in.local;

  // uniform-flow derivatives: everything the per-record branches sample
  // with derives from these (textureSampleGrad needs no uniformity)
  let dpx = dpdx(p);
  let dpy = dpdy(p);

  // the node SDF for clip: node (model px; radius resolves with zoomDpr 1
  // so 'auto' matches the body shader's model-space value)
  let bg = borderGeom[slot];
  let shape = (bg.y >> ${SHAPE_SHIFT}u) & ${SHAPE_MASK}u;
  let radius = cornerLengthPx(shape, bg.x, half, 1.0);
  let sd = nodeSD(shape, p, half, radius, bg.x, 1.0);
  let aa = max(fwidth(sd), 1e-4);
  let bw = borderWidths[slot];
  let bpos = bg.y & 0xffu;
  // the border's inner edge relative to the shape boundary (B2 bands):
  // center straddles (-bw/2), inside sits fully inside (-bw), outside 0
  var innerEdge = -bw * 0.5;

  if (bpos == 1u) { innerEdge = -bw; }
  if (bpos == 2u) { innerEdge = 0.0; }

  var acc = vec4f(0.0); // premultiplied running composite

  for (var i = 0u; i < count; i = i + 1u) {
    let rec = readRec(off, i);
    let t = imageTable[rec.entry];

    if ((t.x & 3u) != 1u) { continue; } // pending/failed: draw nothing

    let tier = (t.x >> 2u) & 3u;
    let layer = i32(t.x >> 4u);
    let nat = vec2f(f32(t.y & 0xffffu), f32(t.y >> 16u));
    let ras = vec2f(f32(t.z & 0xffffu), f32(t.z >> 16u));
    let rect = imageRect(rec, half, nat);
    var local = (p - rect.xy) / max(rect.zw, vec2f(1e-4));

    // repeat wraps its axes; the tile grid is confined to the node box
    if (rec.repeat == 1u || rec.repeat == 3u) { local.x = fract(local.x); }
    if (rec.repeat == 2u || rec.repeat == 3u) { local.y = fract(local.y); }
    if (local.x < 0.0 || local.x > 1.0 || local.y < 0.0 || local.y > 1.0) { continue; }
    if (rec.repeat != 0u && (abs(p.x) > half.x || abs(p.y) > half.y)) { continue; }

    // clip: node masks by the shape SDF; containment picks the edge
    var mask = 1.0;

    if (rec.clip == 1u) {
      let edge = select(0.0, innerEdge, rec.containment == 0u);

      mask = clamp((edge - sd) / aa + 0.5, 0.0, 1.0);
    }

    if (mask <= 0.0) { continue; }

    let tierPx = tierSizeOf(tier);
    let uvScale = ras / vec2f(tierPx);
    var uv = local * uvScale;
    let gx = dpx / max(rect.zw, vec2f(1e-4)) * uvScale;
    let gy = dpy / max(rect.zw, vec2f(1e-4)) * uvScale;

    if (rec.smoothing == 0u) {
      // nearest emulation: snap to texel centers at the raster resolution
      uv = (floor(local * ras) + vec2f(0.5)) / vec2f(tierPx);
    }

    var c: vec4f;

    if (rec.sdf == 1u) {
      // sdf icon (15.5): threshold the distance field at 0.5 with an
      // analytic AA width (fwidth is illegal in this non-uniform loop):
      // the field spans its full range over SDF_RADIUS(8) raster texels,
      // so coverage-per-screen-px = texels-per-px / 8
      let s = textureSampleGrad(icons, imageSamp, uv, layer, gx, gy).r;
      let texPerPx = max(length(vec2f(gx.x, gy.x)), length(vec2f(gx.y, gy.y))) * tierPx;
      let w = max(texPerPx / 8.0, 1e-4);
      let cov = clamp((s - 0.5) / w + 0.5, 0.0, 1.0);

      c = vec4f(rec.tint.rgb, cov * rec.tint.a);
    } else {
      switch tier {
        case 0u: { c = textureSampleGrad(tier0, imageSamp, uv, layer, gx, gy); }
        case 1u: { c = textureSampleGrad(tier1, imageSamp, uv, layer, gx, gy); }
        default: { c = textureSampleGrad(tier2, imageSamp, uv, layer, gx, gy); }
      }
    }

    let a = c.a * rec.opacity * mask;

    // later images composite over earlier ones (list order; pinned vs v3)
    acc = vec4f(c.rgb * a, a) + acc * (1.0 - a);
  }

  return acc * opacities[slot];
}
`;

/*
The chart pass (round 23): pie and stripe backgrounds, SDF-native.
Charted nodes draw one extra quad per stream off the same culled
visible lists as their bodies (right after the image pass — v3 draws
charts over background images), chartless instances collapsing in the
VS.  The FS clips to the node shape at the border's inner edge (the
image pass's rule), resolves the fraction coordinate — the clockwise
angle from 12 o'clock for pies, the advancing axis for stripes — and
walks the record's cumulative stops with px-space AA across slice
boundaries.  The remainder past the values' total stays unpainted
(v3's percent semantics).
*/
export const CHART_SHADER = wgsl`
${COMMON}
${SDF}

@group(0) @binding(0) var<uniform> frame: Frame;
@group(0) @binding(1) var<storage, read> positions: array<vec2f>;
@group(0) @binding(2) var<storage, read> sizes: array<vec2f>;
@group(0) @binding(3) var<storage, read> opacities: array<f32>;
@group(0) @binding(4) var<storage, read> borderGeom: array<vec4u>;
@group(0) @binding(5) var<storage, read> borderWidths: array<f32>;
@group(0) @binding(6) var<storage, read> chartRefs: array<u32>;
@group(0) @binding(7) var<storage, read> chartBlob: array<f32>;
@group(0) @binding(8) var<storage, read> polyBlob: array<f32>;
@group(1) @binding(0) var<storage, read> visible: array<u32>;

const CHART_HEADER: u32 = 7u;
const TAU: f32 = 6.28318530718;

struct ChartVSOut {
  @builtin(position) position: vec4f,
  @location(0) local: vec2f, // node-local model px
  @location(1) @interpolate(flat) instance: u32,
}

@vertex
fn vsChart(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> ChartVSOut {
  var out: ChartVSOut;
  let slot = visible[ii];
  let cref = chartRefs[slot];
  let half = sizes[slot] * 0.5;

  // chartless — or unreadably small (the imageMinPx floor, shared:
  // a chart on a sub-8px node is noise) — collapse the quad
  if (cref == 0u || max(half.x, half.y) * 2.0 * frame.zoomDpr < frame.imageMinPx) {
    out.position = vec4f(2.0, 2.0, 0.0, 1.0);
    out.local = vec2f(0.0);
    out.instance = slot;

    return out;
  }

  let margin = 2.0 / frame.zoomDpr; // AA slack, model px
  let corner = quadCorner(vi) * (half + vec2f(margin));
  let px = modelToPx(frame, positions[slot] + corner);

  out.position = vec4f(pxToClip(frame, px), 0.0, 1.0);
  out.local = corner;
  out.instance = slot;

  return out;
}

/** premultiplied slice color i (i == n reads the transparent remainder) */
fn chartColor(off: u32, n: u32, i: u32) -> vec4f {
  if (i >= n) { return vec4f(0.0); }

  let base = off + CHART_HEADER + i * 3u;
  let rg = chartBlob[base + 1u];
  let ba = chartBlob[base + 2u];
  let g = floor(rg / 256.0);
  let a = floor(ba / 256.0);
  let c = vec4f(rg - g * 256.0, g, ba - a * 256.0, a) / 255.0;

  return vec4f(c.rgb * c.a, c.a);
}

@fragment
fn fsChart(in: ChartVSOut) -> @location(0) vec4f {
  let slot = in.instance;
  let cref = chartRefs[slot];

  if (cref == 0u) { discard; }

  let n = cref >> 24u;
  let off = cref & 0xffffffu;
  let half = sizes[slot] * 0.5;
  let p = in.local;
  let kind = u32(chartBlob[off]);
  let size = chartBlob[off + 1u];
  let hole = chartBlob[off + 2u];
  let start = chartBlob[off + 3u];
  let dirH = u32(chartBlob[off + 4u]);

  // clip to the node shape at the border's inner edge (the image rule:
  // the border stays visible over the chart)
  let bg = borderGeom[slot];
  let shape = (bg.y >> ${SHAPE_SHIFT}u) & ${SHAPE_MASK}u;
  let radius = cornerLengthPx(shape, bg.x, half, 1.0);
  let sd = nodeSD(shape, p, half, radius, bg.x, 1.0);
  let aa = max(fwidth(sd), 1e-4);
  let bw = borderWidths[slot];
  let bpos = bg.y & 0xffu;
  var innerEdge = -bw * 0.5;

  if (bpos == 1u) { innerEdge = -bw; }
  if (bpos == 2u) { innerEdge = 0.0; }

  let clipA = 1.0 - smoothstep(innerEdge - aa, innerEdge, sd);

  // every derivative hoists above the kind branch and the discards
  // (uniform control flow); discard only demotes after this point
  let r = length(p);
  let rAA = max(fwidth(r), 1e-4);
  let aaX = max(fwidth(p.x), 1e-4);
  let aaY = max(fwidth(p.y), 1e-4);

  if (clipA <= 0.0) { discard; }

  // the fraction coordinate t in [0, 1), its boundary AA scale in
  // device px, and the kind's own coverage mask
  var t: f32;
  var scalePx: f32;
  var mask: f32;
  var wraps = false;

  if (kind == 1u) { // pie: clockwise from 12 o'clock (v3)
    let radiusPx = min(half.x, half.y) * size;
    let holeR = radiusPx * hole;

    mask = 1.0 - smoothstep(radiusPx - rAA, radiusPx, r);

    if (holeR > 0.0) {
      mask = mask * smoothstep(holeR - rAA, holeR, r);
    }

    if (mask <= 0.0) { discard; }

    t = fract((atan2(p.x, -p.y) - start) / TAU);
    scalePx = max(r, 1e-3) * TAU * frame.zoomDpr; // arc px per unit t
    wraps = true; // slice 0 neighbors the last region across t = 0
  } else { // stripes: a centered size-scaled sub-box
    let ext = half * size;

    mask = (1.0 - smoothstep(ext.x - aaX, ext.x, abs(p.x)))
      * (1.0 - smoothstep(ext.y - aaY, ext.y, abs(p.y)));

    if (mask <= 0.0) { discard; }

    t = select((p.y + ext.y) / max(ext.y * 2.0, 1e-4),
               (p.x + ext.x) / max(ext.x * 2.0, 1e-4), dirH == 1u);
    scalePx = select(ext.y, ext.x, dirH == 1u) * 2.0 * frame.zoomDpr;
  }

  // find the region at t: slices 0..n-1, then the transparent remainder
  var acc = 0.0;
  var k = n; // remainder by default
  var lower = 0.0;
  var upper = 1.0;

  for (var i = 0u; i < n; i = i + 1u) {
    let v = chartBlob[off + CHART_HEADER + i * 3u];
    let next = acc + v;

    if (t < next && k == n) {
      k = i;
      lower = acc;
      upper = next;
    }

    acc = next;
  }

  if (k == n) { lower = acc; } // the remainder runs [total, 1)

  var color = chartColor(off, n, k);

  // px-space AA across the slice boundaries: within half a px of a
  // boundary, blend toward the neighboring region's color
  let dLower = (t - lower) * scalePx;
  let dUpper = (upper - t) * scalePx;

  if (dLower < 0.5) {
    var prev = n; // below region 0: the wrap neighbor (pie) or nothing

    if (k > 0u) { prev = k - 1u; }
    else if (wraps && acc < 0.999) { prev = n; }    // remainder wraps in
    else if (wraps && n > 0u) { prev = n - 1u; }    // full pie: the last slice

    color = mix(chartColor(off, n, prev), color, clamp(0.5 + dLower, 0.0, 1.0));
  } else if (dUpper < 0.5 && k < n) {
    var next = k + 1u; // past the last slice: the remainder (transparent)

    color = mix(color, chartColor(off, n, next), clamp(0.5 - dUpper, 0.0, 1.0));
  }

  let alpha = clipA * mask * opacities[slot];

  if (color.a * alpha <= 0.004) { discard; }

  return color * alpha;
}
`;
