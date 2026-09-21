import { wgsl } from '../wgsl.mjs';
import {
  ARROW_SHIFT_SRC_SHOWS_LINE,
  ARROW_SHIFT_TGT_SHOWS_LINE,
} from '../../contract.mjs';
import { COMMON, BOUNDARY_WGSL, DASH_WGSL } from './common.mjs';
import { CURVE_WGSL, ROUTE_WGSL } from './curve.mjs';
import { ARROW_GAP_WGSL } from './sdf.mjs';

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
  } else if (params.w != 6.0) {
    // Round 58: the layer stroke hugs the drawn line — boundary points
    // plus the draw trim, the same drawnSpanW the line itself spans —
    // where it used to run node centre to node centre.  v3 strokes its
    // overlay/underlay/casing along the *shortened* path and its head
    // erase reaches the layers too, so the draw trim (not the accessor
    // gap) is the right distance here.
    let sp = drawnSpanW(slot, pa, pb);

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

  out.position = vec4f(pxToClip(frame, mix(a, b, t) + n * s), EDGE_Z, 1.0);
  out.v = s;
  out.halfWidth = halfW;
  out.alphaComp = 1.0;
  out.instance = slot;
  out.kind = params.w;
  out.u = 0.0;
  out.casing = 0u;
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
// The curved vertex at one slot over the *fused* node geometry
// (nodeOuterGeom in place of outerHalf + shape), extruded to widthPx:
// the layer strokes and the paired casing draw (124.4) share it.
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

@vertex
fn vsCurvedLayer(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> CurvedVSOut {
  let slot = visible[ii];
  let rec = edgeLayer[slot];

  if ((rec.x >> 24u) == 0u) {
    var out: CurvedVSOut;

    out.position = vec4f(2.0, 2.0, 0.0, 1.0);
    return out;
  }

  return curvedVertexFused(slot, vi, f32(rec.y) / 256.0 * frame.zoomDpr, 1.0, 0.0, false);
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

@fragment
fn fsCurvedLayer(in: CurvedVSOut) -> @location(0) vec4f {
  let c = unpack4x8unorm(edgeLayer[in.instance].x);
  let alpha = c.a * (1.0 - smoothstep(in.halfWidth - 0.75, in.halfWidth + 0.75, abs(in.v)));

  return vec4f(c.rgb * alpha, alpha); // premultiplied
}
`;
