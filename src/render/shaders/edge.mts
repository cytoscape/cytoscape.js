import { wgsl } from '../../gpu/wgsl.mjs';
import {
  ARROW_SHIFT_SRC_SHOWS_LINE,
  ARROW_SHIFT_TGT_SHOWS_LINE,
} from '../../contract.mjs';
import { COMMON, BOUNDARY_WGSL, DASH_WGSL, PICK_OUT_WGSL } from './common.mjs';
import { CURVE_WGSL, ROUTE_WGSL } from './curve.mjs';
import { ARROW_GAP_WGSL } from './sdf.mjs';

// Which ends of an *underlay* keep a flat end (round 88.3): v3 strokes
// the underlay before the heads, then erases each head's footprint out
// of the canvas — so at a head that shows the line (hollow, or
// translucent) the underlay is cut flat where the head begins, and a
// round cap there would poke into the hollow head where v3 shows the
// background.  v4's draw trim already ends the underlay at that cut, so
// such an end keeps its butt.  At an opaque filled head the head covers
// the cap exactly as v3's erase-then-fill does, and with no head the
// end is v3's round cap.  Bit 0 the source end, bit 1 the target.
const LAYER_BUTT_WGSL = wgsl`
fn layerButtEnds(w: vec2f) -> u32 {
  let word = arrowWordOf(w);
  let srcShows = ((word >> ${ARROW_SHIFT_SRC_SHOWS_LINE}u) & 1u) == 1u;
  let tgtShows = ((word >> ${ARROW_SHIFT_TGT_SHOWS_LINE}u) & 1u) == 1u;
  let src = select(0u, 1u, srcShows && srcShapeOf(word) != 0u);
  let tgt = select(0u, 2u, tgtShows && tgtShapeOf(word) != 0u);

  return src | tgt;
}
`;

export const EDGE_SHADER = wgsl`
${COMMON}
${BOUNDARY_WGSL}
${PICK_OUT_WGSL}
${ARROW_GAP_WGSL}
${LAYER_BUTT_WGSL}
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
  // 1 on the casing instance of the paired draw (round 124.4): the FS
  // shades it solid in the casing colour instead of the line
  @location(7) @interpolate(flat) casing: u32,
}

@group(1) @binding(0) var<storage, read> visible: array<u32>;

// Where the drawn line spans (round 56; factored in round 58 so the
// layer strokes hug the same rule): xy/zw are the source/target ends.
//
// v3's arrow gap: the drawn line stops gap(shape) behind each node
// boundary, which is what makes a hollow or translucent head read as
// one shape instead of a head laid over a line — the line is strictly
// inside the head over that span, so trimming to it reproduces v3's
// destination-out erase with no second pass.  Callers exclude haystack
// (kind 6 — v3 draws it no arrows and routes it elsewhere) and
// straight-triangle (kind 7 — it resolves its own boundary tips and
// tapers to a point, so a trim would cut the apex off).
fn drawnSpanW(slot: u32, pa: vec2f, pb: vec2f) -> vec4f {
  return spanTrimmedW(slot, pa, pb, true);
}

// The same span shortened by v3's plain gap only (arrowGapW) — where
// v3's rs.allpts ends, which is what its overlay strokes (round 88.3):
// no head erase reaches a layer drawn after the heads.
fn gapSpanW(slot: u32, pa: vec2f, pb: vec2f) -> vec4f {
  return spanTrimmedW(slot, pa, pb, false);
}

fn spanTrimmedW(slot: u32, pa: vec2f, pb: vec2f, drawTrim: bool) -> vec4f {
  let word = arrowWordOf(widths[slot]);
  let wModel = widths[slot].x;
  let scale = scaleOfWord(word);

  var md = pb - pa;
  let ml = max(length(md), 1e-6);

  md = md / ml;

  let ends = endpoints[slot];
  let bs = pa + md * boundaryOffset(nodeShapes[ends.x], nodeOuterHalf[ends.x], md);
  let bt = pb - md * boundaryOffset(nodeShapes[ends.y], nodeOuterHalf[ends.y], -md);

  // v3 shortens each boundary point *toward the far end*, so the two
  // trims are independent and neither can cross the other
  let srcShows = ((word >> ${ARROW_SHIFT_SRC_SHOWS_LINE}u) & 1u) == 1u;
  let tgtShows = ((word >> ${ARROW_SHIFT_TGT_SHOWS_LINE}u) & 1u) == 1u;

  var ts = arrowGapW(srcShapeOf(word), wModel, scale);
  var tt = arrowGapW(tgtShapeOf(word), wModel, scale);

  if (drawTrim) {
    ts = arrowDrawTrimW(srcShapeOf(word), srcShows, wModel, scale);
    tt = arrowDrawTrimW(tgtShapeOf(word), tgtShows, wModel, scale);
  }

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

  return vec4f(shortenTowardW(bs, bt, ts), shortenTowardW(bt, bs, tt));
}

// The straight-edge vertex at one slot, extruded to widthPx (device
// px).  Shared by the scene draw and the paired casing draw (124.4).
fn edgeVertexAt(slot: u32, vi: u32, widthPx: f32, alphaComp: f32) -> EdgeVSOut {
  var out: EdgeVSOut;

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
    let sp = drawnSpanW(slot, pa, pb);

    pa = sp.xy;
    pb = sp.zw;
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
  out.alphaComp = alphaComp;
  out.instance = slot;
  out.casing = 0u;
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

@vertex
fn vsEdge(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> EdgeVSOut {
  // the cull pass compacted the shown, on-screen, non-decimated,
  // non-degenerate edges (slot order preserved): no collapse branches here
  let slot = visible[ii];

  // LOD: floor hairline edges; edgeLod's alpha compensation must match the
  // cull predicate's decimation decision (shared WGSL)
  let lod = edgeLod(slot, widths[slot].x * frame.zoomDpr, frame.edgeWidthFloor);
  let widthPx = max(widths[slot].x * frame.zoomDpr, frame.edgeWidthFloor);

  return edgeVertexAt(slot, vi, widthPx, lod.y);
}

// The paired draw (round 124.4): two instances per visible edge, the
// even one its casing (edge.casing bound as the layer record), the odd
// one its line, so within one draw each edge's casing lands over every
// earlier edge's line — v3's per-edge outline-then-line order, which is
// what gaps the crossing.  An edge without a casing collapses its even
// instance.
@vertex
fn vsEdgeCased(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> EdgeVSOut {
  let slot = visible[ii >> 1u];
  let isCasing = (ii & 1u) == 0u;

  if (isCasing) {
    let rec = edgeLayer[slot];

    if ((rec.x >> 24u) == 0u) {
      var out: EdgeVSOut;

      out.position = vec4f(2.0, 2.0, 0.0, 1.0);
      return out;
    }

    var out = edgeVertexAt(slot, vi, f32(rec.y) / 256.0 * frame.zoomDpr, 1.0);

    out.casing = 1u;
    return out;
  }

  let lod = edgeLod(slot, widths[slot].x * frame.zoomDpr, frame.edgeWidthFloor);
  let widthPx = max(widths[slot].x * frame.zoomDpr, frame.edgeWidthFloor);

  return edgeVertexAt(slot, vi, widthPx, lod.y);
}

@fragment
fn fsEdge(in: EdgeVSOut) -> @location(0) vec4f {
  if (in.casing == 1u) { // the paired draw's casing instance (124.4)
    let cc = unpack4x8unorm(edgeLayer[in.instance].x);
    let ca = cc.a * (1.0 - smoothstep(in.halfWidth - 0.75, in.halfWidth + 0.75, abs(in.v)));

    return vec4f(cc.rgb * ca, ca);
  }

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
fn fsEdgePick(in: EdgeVSOut) -> PickOut {
  // v3's edgeThreshold (57.9): a hit counts within pickPadPx of the stroke
  if (abs(in.v) > in.halfWidth + frame.pickPadPx) {
    discard;
  }

  // high bit marks edges; the centreline distance resolves nearest-wins
  // (round 105) — v3 compares the same distance
  return pickOut((in.instance + 1u) | 0x80000000u, abs(in.v));
}

// Overlay/underlay strokes (round 13 A2): the edge geometry re-extruded
// at the layer's stroke width (edge width + 2 x padding, pre-derived),
// riding the same visible list — disabled instances collapse in the VS.
// Solid (no dashes), alpha = the folded layer opacity.
//
// Round caps (round 88): v3 strokes these with lineCap 'round', so the
// quad reaches half the stroke width past each end and the fragment
// stage shades the capsule about the span — u is the device-px distance
// along the span from its start (negative on the source cap), totalLen
// the span's device-px length.  A straight-triangle layer keeps its
// taper and its flat base: it has no span end to round.
fn layerVertex(slot: u32, vi: u32, spanTrim: bool) -> EdgeVSOut {
  var out: EdgeVSOut;
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
  let isTriangle = params.w == 7.0;

  if (isTriangle) { // straight-triangle layers taper like the fill
    var bd = pb - pa;
    let bl = max(length(bd), 1e-6);

    bd = bd / bl;
    pa = pa + bd * boundaryOffset(nodeShapes[ends.x], nodeOuterHalf[ends.x], bd);
    pb = pb - bd * boundaryOffset(nodeShapes[ends.y], nodeOuterHalf[ends.y], -bd);
    taper = 1.0 - t;
  } else if (params.w != 6.0) {
    // Round 58: the layer stroke hugs the drawn line — boundary points
    // plus the draw trim, the same drawnSpanW the line itself spans.
    // v3 strokes its layers along the *shortened* path and its head
    // erase reaches the ones drawn before the heads, so the draw trim
    // is the right distance for the underlay.  The overlay draws after
    // the heads in both libraries, nothing erases it, and v3's reaches
    // its path's gap-shortened end (round 88.3): spanTrim false spans
    // the accessor gap instead.
    var sp: vec4f;

    if (spanTrim) {
      sp = drawnSpanW(slot, pa, pb);
    } else {
      sp = gapSpanW(slot, pa, pb);
    }

    pa = sp.xy;
    pb = sp.zw;
  }

  let a = modelToPx(frame, pa);
  let b = modelToPx(frame, pb);
  let ab = b - a;
  let len = max(length(ab), 1e-4);
  let halfW = widthPx * 0.5 * taper;
  let dir = ab / len;
  let n = vec2f(-dir.y, dir.x);
  let s = corner.y * (halfW + 1.0);
  // the cap's reach past each end: none on a triangle's taper, none at
  // an underlay end a head's erase cuts flat (LAYER_BUTT_WGSL)
  var butt = 0u;

  if (spanTrim && params.w != 6.0) { butt = layerButtEnds(widths[slot]); }
  if (isTriangle) { butt = 3u; }

  let cap = widthPx * 0.5 + 1.0;
  let along = select(select(cap, 0.0, (butt & 2u) != 0u), -select(cap, 0.0, (butt & 1u) != 0u), corner.x < 0.0);

  out.position = vec4f(pxToClip(frame, mix(a, b, t) + dir * along + n * s), EDGE_Z, 1.0);
  out.v = s;
  out.halfWidth = halfW;
  out.alphaComp = 1.0;
  out.instance = slot;
  out.kind = params.w;
  out.u = t * len + along;
  out.totalLen = len;
  out.casing = 0u;
  return out;
}

@vertex
fn vsEdgeUnderlay(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> EdgeVSOut {
  return layerVertex(visible[ii], vi, true);
}

@vertex
fn vsEdgeOverlay(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> EdgeVSOut {
  return layerVertex(visible[ii], vi, false);
}

@fragment
fn fsEdgeLayer(in: EdgeVSOut) -> @location(0) vec4f {
  let c = unpack4x8unorm(edgeLayer[in.instance].x);
  // capsule distance about the span: the perpendicular offset inside
  // it, the distance to the nearer end past it (a flat end — a
  // straight-triangle's taper, an underlay end a head's erase cuts —
  // has no quad past the span, so nothing there to shade)
  var d = abs(in.v);

  if (in.kind != 7.0) {
    let past = max(max(-in.u, in.u - in.totalLen), 0.0);

    d = length(vec2f(past, in.v));
  }

  let alpha = c.a * (1.0 - smoothstep(in.halfWidth - 0.75, in.halfWidth + 0.75, d));

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
${PICK_OUT_WGSL}
${ARROW_GAP_WGSL}
${LAYER_BUTT_WGSL}
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
// drop the two node-geometry bindings (4/5) for the fused column below,
// which keeps the layer vertex stage at the 8-storage-buffer budget
// with a slot for widths (the arrow-trim word)
@group(0) @binding(13) var<storage, read> edgeLayer: array<vec2u>;
// line-fill gradient record (round 13 C2), fragment-only
@group(0) @binding(14) var<storage, read> edgeGradients: array<array<u32, 8>>;
// round 58: node.outerHalf + node.shape fused ([hx, hy, shape, 0]) —
// only the layer entry points bind it, in place of bindings 4/5
@group(0) @binding(15) var<storage, read> nodeOuterGeom: array<vec4f>;

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
  // 1 on the casing instance of the paired draw (round 124.4)
  @location(6) @interpolate(flat) casing: u32,
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

    // round 93: build the bend-weighted subdivision map before any
    // routeVertexW read — the dash loop below walks all of it
    allocRouteQuadsW(&route);

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
  out.casing = 0u;
  return out;
}

// The line's shading, shared by the scene draw and the paired casing
// draw (124.4) — the latter binds a different layout, so it has its
// own entry point.
fn shadeCurved(in: CurvedVSOut) -> vec4f {
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
fn fsCurvedEdge(in: CurvedVSOut) -> @location(0) vec4f {
  return shadeCurved(in);
}

@fragment
fn fsCurvedCased(in: CurvedVSOut) -> @location(0) vec4f {
  if (in.casing == 1u) {
    let cc = unpack4x8unorm(edgeLayer[in.instance].x);
    let ca = cc.a * (1.0 - smoothstep(in.halfWidth - 0.75, in.halfWidth + 0.75, abs(in.v)));

    return vec4f(cc.rgb * ca, ca);
  }

  return shadeCurved(in);
}

@fragment
fn fsCurvedEdgePick(in: CurvedVSOut) -> PickOut {
  // v3's edgeThreshold (57.9): a hit counts within pickPadPx of the stroke
  if (abs(in.v) > in.halfWidth + frame.pickPadPx) {
    discard;
  }

  // high bit marks edges; the centreline distance resolves nearest-wins
  // (round 105) — v3 compares the same distance
  return pickOut((in.instance + 1u) | 0x80000000u, abs(in.v));
}

// Curved overlay/underlay strokes (round 13 A2; rebuilt in round 88).
//
// v3 strokes a layer as one path stroked once, with round caps and
// round joins, and Canvas composites a stroke atomically — so a
// translucent layer never darkens where its own path folds.  The line's
// strip (a quad per step, mitred) folds at any corner sharper than its
// miter clamp or shorter than its half-width, and blended each fold
// twice.  The layer strip is therefore built another way:
//
// - Each quad is its step's *capsule* bound: the segment extended by
//   the half-width (+1 px of AA margin) along and across it, no miter.
//   The fragment stage shades the distance to the polyline about the
//   step (its own segment and two either side, from flat varyings), so
//   the union is v3's stroke: round caps at the ends, round joins at
//   every corner, whatever the angle.
// - The quads overlap at every joint by construction, so the pass
//   writes depth: each instance draws at its own depth (decreasing in
//   draw order), a fragment of the *same* edge fails the 'less' test
//   where an earlier one of its quads already drew, and a later edge
//   still passes and blends over an earlier one — v3 composites
//   separate edges separately too.  Zero-coverage fragments discard so
//   the AA margin never claims a pixel.
// - Every layer depth sits between EDGE_Z and the clear value, so the
//   lines and heads drawn after the underlay pass over it, the node
//   prepass still kills layer fragments under opaque bodies, and the
//   overlay's band sits under the underlay's so it passes over it.
//   LAYER_Z_SPAN instances fit each band at four depth units apiece
//   (a fringe fragment takes the half step between — see the fragment
//   stage); a visible list longer than that wraps, and two layer
//   strokes that many instances apart lose their blend where they
//   cross.
const LAYER_Z_UNDERLAY: f32 = 0.999;
const LAYER_Z_OVERLAY: f32 = 0.94;
const LAYER_Z_STEP: f32 = 2.3841858e-7; // 2^-22: four depth24 units
const LAYER_Z_FRINGE: f32 = 1.1920929e-7; // 2^-23: half a step
const LAYER_Z_SPAN: u32 = 200000u;

struct CurvedLayerOut {
  @builtin(position) position: vec4f,
  @location(0) px: vec2f, // this fragment, device px
  // the polyline about this quad's step, device px: three distinct
  // points either side of it, then the step's own two (q67)
  @location(1) @interpolate(flat) q01: vec4f,
  @location(2) @interpolate(flat) q23: vec4f,
  @location(3) @interpolate(flat) q45: vec4f,
  @location(4) @interpolate(flat) q67: vec4f,
  @location(5) @interpolate(flat) halfWidth: f32,
  @location(6) @interpolate(flat) instance: u32,
  @location(7) @interpolate(flat) layerZ: f32,
}

// How far a layer quad reaches past the joint between steps din and
// dout for its round join to be covered: reach x sin(turn / 2).  A
// zero step on one side is a path end (the neighbourhood walk below
// skips zero-length steps), and takes the whole reach: the cap.
fn joinReach(din: vec2f, dout: vec2f, reach: f32) -> f32 {
  let li = length(din);
  let lo = length(dout);

  if (li < 1e-6 || lo < 1e-6) { return reach; }

  let c = dot(din / li, dout / lo);

  return reach * sqrt(max((1.0 - c) * 0.5, 0.0));
}

// The subdivision point idx of either family, device px: the analytic
// curve (bezier / loop / compound loop) or the evaluated route.
fn layerPointAt(isBez: bool, g: CurveGeom, route: ptr<function, Route>, idx: u32) -> vec2f {
  if (isBez) {
    return modelToPx(frame, curvePoint(g, f32(idx) / CURVE_SEGS_F));
  }

  return modelToPx(frame, routeVertexW(route, idx));
}

fn curvedLayerAt(ii: u32, vi: u32, zBase: f32, gapSpan: bool) -> CurvedLayerOut {
  var out: CurvedLayerOut;
  let slot = visible[ii];
  let rec = edgeLayer[slot];

  if ((rec.x >> 24u) == 0u) { // disabled: degenerate, clipped
    out.position = vec4f(2.0, 2.0, 0.0, 1.0);
    return out;
  }

  let halfW = f32(rec.y) / 256.0 * frame.zoomDpr * 0.5;
  let seg = vi >> 2u;
  let corner = quadCorner(vi & 3u);
  let ends = endpoints[slot];
  let params = curveParams[slot];
  // Round 58: the underlay hugs the drawn line — the same draw trim the
  // line's strip spans, since v3's head erase reaches a layer drawn
  // before the heads.  The overlay draws after them and nothing erases
  // it, so it spans v3's gap-shortened path instead (round 88.3).  The
  // node geometry comes from the fused nodeOuterGeom column, whose
  // freed binding is what lets this stage reach widths at all.
  let ga = nodeOuterGeom[ends.x];
  let gb = nodeOuterGeom[ends.y];
  let trim = select(arrowTrimOf(widths[slot]), arrowGapTrimOf(widths[slot]), gapSpan);
  let isBez = params.w <= 2.0 || params.w == 16.0;
  var g: CurveGeom;
  var route: Route;

  if (isBez) {
    g = evalCurveGeom(
      params,
      nodePositions[ends.x], ga.xy, u32(ga.z),
      nodePositions[ends.y], gb.xy, u32(gb.z),
      trim
    );
  } else {
    route = evalRouteW(
      params,
      nodePositions[ends.x], ga.xy, u32(ga.z),
      nodePositions[ends.y], gb.xy, u32(gb.z),
      trim
    );
    allocRouteQuadsW(&route); // round 93: the map feeds routeVertexW
  }

  let a = layerPointAt(isBez, g, &route, seg);
  let b = layerPointAt(isBez, g, &route, seg + 1u);
  let ab = b - a;
  let l = length(ab);

  // The neighbourhood the fragment stage measures against: three
  // *distinct* points either side of this step (q[0..2] behind, q[5..7]
  // ahead; the step itself is q[3] -> q[4]).  Three, not two: at a
  // bend tighter than the band (a loop's inner side) the pixels on the
  // inner fringe sit that many short steps from the nearest one.  A route can spend a
  // run of quads on a zero-length piece (a taxi whose turn collapses, a
  // radius-0 corner), and a neighbourhood of plain indices would then
  // end at that point — the quads beside it would measure the stroke
  // from its end and shade an arc of it too light.  None found: the
  // path ends there, and q repeats the end point.
  var q: array<vec2f, 8>;

  q[3] = a;
  q[4] = b;

  var last = a;
  var k = 2;

  for (var i = i32(seg) - 1; i >= 0 && k >= 0; i = i - 1) {
    let p = layerPointAt(isBez, g, &route, u32(i));

    if (length(p - last) >= 1e-3) {
      q[k] = p;
      last = p;
      k = k - 1;
    }
  }

  for (; k >= 0; k = k - 1) { q[k] = last; }

  last = b;
  k = 5;

  for (var i = seg + 2u; i <= CURVE_SEGS_U && k <= 7; i = i + 1u) {
    let p = layerPointAt(isBez, g, &route, i);

    if (length(p - last) >= 1e-3) {
      q[k] = p;
      last = p;
      k = k + 1;
    }
  }

  for (; k <= 7; k = k + 1) { q[k] = last; }

  // A zero-length step draws nothing: its neighbours' joins, computed
  // across it, cover its point.  Only a path that is nothing but a
  // point (a degenerate edge the cull kept) draws its disc.
  if (l < 1e-3 && (length(q[2] - a) >= 1e-3 || length(q[5] - b) >= 1e-3)) {
    out.position = vec4f(2.0, 2.0, 0.0, 1.0);
    return out;
  }

  // this step's quad: a -> b, widened by the half-width plus the AA
  // margin across, and reaching past each end only as far as the round
  // join there needs — reach x sin(turn / 2), which is all of the reach
  // at a path end or a reversal and nothing along a straight run.  A
  // quad that reached its full capsule at every joint would cover
  // pixels nearest a step outside its neighbourhood (short steps, wide
  // bands), shade them too light, and — drawing first — keep them.
  let dir = select(vec2f(1.0, 0.0), ab / max(l, 1e-6), l >= 1e-3);
  let n = vec2f(-dir.y, dir.x);
  let reach = halfW + 1.0;
  var back = joinReach(q[3] - q[2], ab, reach);
  var fwd = joinReach(ab, q[5] - q[4], reach);

  // an underlay end a head's erase cuts flat keeps its butt
  // (LAYER_BUTT_WGSL): at the path's own end, the quad stops there
  if (!gapSpan) {
    let butt = layerButtEnds(widths[slot]);

    if ((butt & 1u) != 0u && length(q[3] - q[2]) < 1e-3) { back = 0.0; }
    if ((butt & 2u) != 0u && length(q[5] - q[4]) < 1e-3) { fwd = 0.0; }
  }
  let along = select(fwd, -back, corner.x < 0.0);
  let px = mix(a, b, (corner.x + 1.0) * 0.5) + dir * along + n * (corner.y * reach);

  out.layerZ = zBase - f32(ii % LAYER_Z_SPAN) * LAYER_Z_STEP;
  out.position = vec4f(pxToClip(frame, px), out.layerZ, 1.0);
  out.px = px;
  out.q01 = vec4f(q[0], q[1]);
  out.q23 = vec4f(q[2], q[3]);
  out.q45 = vec4f(q[4], q[5]);
  out.q67 = vec4f(q[6], q[7]);
  out.halfWidth = halfW;
  out.instance = slot;
  return out;
}

@vertex
fn vsCurvedUnderlay(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> CurvedLayerOut {
  return curvedLayerAt(ii, vi, LAYER_Z_UNDERLAY, false);
}

@vertex
fn vsCurvedOverlay(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> CurvedLayerOut {
  return curvedLayerAt(ii, vi, LAYER_Z_OVERLAY, true);
}

// The curved vertex at one slot over the *fused* node geometry
// (nodeOuterGeom in place of outerHalf + shape), extruded to widthPx:
// the paired casing draw (124.4) and its line instance share it.
// withLen walks the polyline for the dash distance and the full
// length, which only the line instance needs.
fn curvedVertexFused(slot: u32, vi: u32, widthPx: f32, alphaComp: f32, pad: f32, withLen: bool) -> CurvedVSOut {
  var out: CurvedVSOut;
  let seg = vi >> 2u;
  let corner = quadCorner(vi & 3u);
  let ends = endpoints[slot];
  let params = curveParams[slot];

  let tIdx = seg + u32((corner.x + 1.0) * 0.5);
  var p: vec2f;
  var n: vec2f;
  var miterScale = 1.0;
  var uLen = 0.0;
  var totLen = 0.0;

  // Round 58: the layer stroke hugs the drawn line — the same draw trim
  // the strip itself spans — where it used to ride the untrimmed path.
  // v3 strokes its overlay/underlay/casing along the *shortened* path
  // and its head erase reaches the layers too, so the draw trim (not
  // the accessor gap) is the right distance.  The node geometry comes
  // from the fused nodeOuterGeom column, whose freed binding is what
  // lets this stage reach widths at all.
  let ga = nodeOuterGeom[ends.x];
  let gb = nodeOuterGeom[ends.y];
  let trim = arrowTrimOf(widths[slot]);

  if (params.w <= 2.0 || params.w == 16.0) {
    let g = evalCurveGeom(
      params,
      nodePositions[ends.x], ga.xy, u32(ga.z),
      nodePositions[ends.y], gb.xy, u32(gb.z),
      trim
    );
    let t = f32(tIdx) / CURVE_SEGS_F;

    p = curvePoint(g, t);

    var tangent = curveTangentAt(g, t);
    let tl = length(tangent);

    if (tl < 1e-6) { tangent = vec2f(1.0, 0.0); } else { tangent = tangent / tl; }

    n = vec2f(-tangent.y, tangent.x);

    if (withLen) {
      var prev = g.s;

      for (var i = 1u; i <= CURVE_SEGS_U; i = i + 1u) {
        let q = curvePoint(g, f32(i) / CURVE_SEGS_F);

        if (i <= tIdx) { uLen = uLen + length(q - prev); }

        totLen = totLen + length(q - prev);
        prev = q;
      }
    }
  } else {
    var route = evalRouteW(
      params,
      nodePositions[ends.x], ga.xy, u32(ga.z),
      nodePositions[ends.y], gb.xy, u32(gb.z),
      trim
    );

    allocRouteQuadsW(&route); // round 93: the map feeds routeVertexW

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

    if (withLen) {
      var prev = route.q[0u];

      for (var i = 1u; i <= CURVE_SEGS_U; i = i + 1u) {
        let q = routeVertexW(&route, i);

        if (i <= tIdx) { uLen = uLen + length(q - prev); }

        totLen = totLen + length(q - prev);
        prev = q;
      }
    }
  }

  let halfW = widthPx * 0.5;
  let s = corner.y * (halfW + pad + 1.0);

  out.position = vec4f(pxToClip(frame, modelToPx(frame, p) + n * s * miterScale), EDGE_Z, 1.0);
  out.v = s;
  out.halfWidth = halfW;
  out.alphaComp = alphaComp;
  out.instance = slot;
  out.u = uLen;
  out.totalLen = max(totLen, 1e-4);
  out.casing = 0u;
  return out;
}

// The paired draw on the curved stream (124.4): even instances the
// casing, odd the line, off the fused layout (the casing record needs
// the binding the fused node geometry frees).
@vertex
fn vsCurvedCased(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> CurvedVSOut {
  let slot = visible[ii >> 1u];
  let isCasing = (ii & 1u) == 0u;

  if (isCasing) {
    let rec = edgeLayer[slot];

    if ((rec.x >> 24u) == 0u) {
      var out: CurvedVSOut;

      out.position = vec4f(2.0, 2.0, 0.0, 1.0);
      return out;
    }

    var out = curvedVertexFused(slot, vi, f32(rec.y) / 256.0 * frame.zoomDpr, 1.0, 0.0, false);

    out.casing = 1u;
    return out;
  }

  let widthPx = max(widths[slot].x * frame.zoomDpr, frame.edgeWidthFloor);
  let alphaComp = min(widths[slot].x * frame.zoomDpr / max(frame.edgeWidthFloor, 1e-4), 1.0);

  return curvedVertexFused(slot, vi, widthPx, alphaComp, frame.pickPadPx, true);
}

// distance from p to the segment a -> b (a point when a == b)
fn segDistW(p: vec2f, a: vec2f, b: vec2f) -> f32 {
  let ab = b - a;
  let h = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-8), 0.0, 1.0);

  return length(p - a - ab * h);
}

struct LayerFragOut {
  @location(0) color: vec4f,
  @builtin(frag_depth) depth: f32,
}

@fragment
fn fsCurvedLayer(in: CurvedLayerOut) -> LayerFragOut {
  let c = unpack4x8unorm(edgeLayer[in.instance].x);
  // the distance to the polyline about this step: every quad that
  // reaches a pixel computes (nearly) the same value, so whichever of
  // an edge's quads draws it first draws what the stroke would
  let p = in.px;
  let d = min(
    min(
      min(segDistW(p, in.q01.xy, in.q01.zw), segDistW(p, in.q01.zw, in.q23.xy)),
      min(segDistW(p, in.q23.xy, in.q23.zw), segDistW(p, in.q23.zw, in.q45.xy))
    ),
    min(
      min(segDistW(p, in.q45.xy, in.q45.zw), segDistW(p, in.q45.zw, in.q67.xy)),
      segDistW(p, in.q67.xy, in.q67.zw)
    )
  );
  let alpha = c.a * (1.0 - smoothstep(in.halfWidth - 0.75, in.halfWidth + 0.75, d));

  // the AA margin must not claim a pixel for this edge (it writes depth)
  if (alpha <= 0.0) { discard; }

  var out: LayerFragOut;

  out.color = vec4f(c.rgb * alpha, alpha); // premultiplied
  // The depth rides a flat varying, so every fragment of one instance
  // carries bit-identical depth whatever the rasterizer interpolates.
  // A fringe fragment (partial coverage) sits half a step deeper: it
  // cannot block a fully covered fragment of its own edge, which then
  // blends over it once, but still blocks another fringe fragment.
  // Within a step's neighbourhood every quad agrees on the coverage and
  // this changes nothing; it matters where the path comes back near
  // itself from outside the neighbourhood (a loop's two ends, a route
  // crossing itself) — there the earlier leg's fringe would otherwise
  // keep a light seam across the later leg's body.
  let full = d <= in.halfWidth - 0.75;

  out.depth = in.layerZ + select(LAYER_Z_FRINGE, 0.0, full);
  return out;
}
`;
