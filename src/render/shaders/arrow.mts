import { wgsl } from '../wgsl.mjs';
import { ARROW_MAX_BACK, ARROW_MAX_FRONT } from '../../shape-points.mjs';
import {
  ARROW_SHAPE_MASK,
  ARROW_SHIFT_HOLLOW_SOURCE,
  ARROW_SHIFT_HOLLOW_TARGET,
  ARROW_SHIFT_MID_SOURCE,
  ARROW_SHIFT_MID_TARGET,
  ARROW_SHIFT_SCALE,
  ARROW_SHIFT_SOURCE,
  ARROW_SHIFT_TARGET,
} from '../../contract.mjs';
import { COMMON, BOUNDARY_WGSL } from './common.mjs';
import { CURVE_WGSL, ROUTE_WGSL } from './curve.mjs';
import { ARROW_POLY, ARROW_GAP_WGSL } from './sdf.mjs';

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

  var anchor = (pa + pb) * 0.5;

  if (params.w == 6.0) { // haystack: mid of the offset points (v3's rs.mid)
    pa = pa + vec2f(cos(params.x), sin(params.x)) * nodeOuterHalf[ends.x] * params.z;
    pb = pb + vec2f(cos(params.y), sin(params.y)) * nodeOuterHalf[ends.y] * params.z;
    anchor = (pa + pb) * 0.5;
  } else {
    // Round 58: the anchor is v3's rs.mid — the four-point mean
    // straightMidW computes, which is what midpoint() answers — not the
    // centre chord, which equals it only when both ends carry the same
    // head.  Mirrors GraphStore.straightEndpointAt's degenerate +x
    // fallback for coincident endpoints.
    var md = pb - pa;
    let ml = length(md);

    if (ml < 1e-6) { md = vec2f(1.0, 0.0); } else { md = md / ml; }

    let bs = pa + md * boundaryOffset(nodeShapes[ends.x], nodeOuterHalf[ends.x], md);
    let bt = pb - md * boundaryOffset(nodeShapes[ends.y], nodeOuterHalf[ends.y], -md);

    anchor = straightMidW(bs, bt, pa, pb, edgeWidths[slot]);
  }

  let mid = modelToPx(frame, anchor);
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
      arrowGapTrimOf(edgeWidths[slot]) // round 58: an anchor, not ink — must land on midpoint()
    );

    mid = g.m;
    // a quadratic's t = 0.5 tangent is its chord; loops run c1 -> c2
    tangent = select(g.e - g.s, g.c2 - g.c1, params.w == 2.0);
  } else {
    var route = evalRouteW(
      params,
      nodePositions[ends.x], nodeOuterHalf[ends.x], nodeShapes[ends.x],
      nodePositions[ends.y], nodeOuterHalf[ends.y], nodeShapes[ends.y],
      arrowGapTrimOf(edgeWidths[slot]) // round 58: an anchor, not ink — must land on midpoint()
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
