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

import { POLYGON_POINTS } from '../shape-points.mjs';

/**
 * The per-frame uniform block.  Not a mat3x3 (avoids WGSL alignment
 * footguns); computed CPU-side from the core viewport + device pixel ratio.
 * Layout must match Renderer's Float32Array(12): viewportPx, panPx, zoomDpr,
 * edgeWidthFloor, nodeLodPx, hidePx, edgeDim, labelFadePx, labelMinPx,
 * 1 pad — 48 bytes.
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
  pad1: f32,
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
 * pass; matches GlyphBuffer's CPU layout (10 words / 40 bytes per glyph). */
export const GLYPH_STRUCT = `
struct Glyph {
  nodeSlot: u32,   // 0xffffffff = dead (tombstoned run)
  color: u32,      // packed RGBA bytes
  offset: vec2f,   // quad top-left from the node center, model px
  size: vec2f,     // model px
  uv0: vec2f,
  uv1: vec2f,
}

const DEAD_GLYPH: u32 = 0xffffffffu;
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
// 3 round-rectangle, 4+ generated polygon shapes
fn nodeSD(shape: u32, p: vec2f, half: vec2f) -> f32 {
  switch shape {
    case 0u: { return circleSD(p, half.x); }
    case 1u: { return ellipseSD(p, half); }
    case 2u: { return rectangleSD(p, half); }
${ POLY.cases }
    default: { return roundRectangleSD(p, half, min(half.x, half.y) * 0.25); }
  }
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
  let ext = half + vec2f(margin);
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

  let sd = nodeSD(shape, in.local, half);
  var color = unpack4x8unorm(fillColors[slot]);

  if (!plain) {
    let borderWidth = borderWidths[slot] * frame.zoomDpr;
    let flags = nodeFlags[slot];

    // border band, drawn inward from the shape boundary
    if (borderWidth > 0.0 && sd > -borderWidth) {
      color = unpack4x8unorm(borderColors[slot]);
    }

    // selection accent ring at the boundary
    if ((flags & FLAG_SELECTED) != 0u && sd > -max(2.0, borderWidth)) {
      color = vec4f(SELECT_ACCENT, 1.0);
    }

    // hover/grab brighten
    if ((flags & (FLAG_HOVERED | FLAG_GRABBED)) != 0u) {
      color = vec4f(min(color.rgb + vec3f(0.15), vec3f(1.0)), color.a);
    }
  }

  let alpha = (1.0 - smoothstep(-0.75, 0.75, sd)) * opacities[slot] * in.alphaComp * color.a;
  return vec4f(color.rgb * alpha, alpha); // premultiplied
}

// (node picking is a synchronous CPU test — see cpu-pick.mts — so there is
// no node pick fragment shader; the GPU pick pass draws edges only)

// Conservative interior test for the depth prepass: true only when p is
// at least m device px inside the shape.  Deliberately cheap — no Newton
// ellipse solver; the ellipse bound uses the normalized-space distance
// (the map x -> x/half expands distances by at most 1/min(half), so
// |q| <= 1 - m/min(half) guarantees true distance >= m).  Under-covering
// only costs occlusion, never correctness.
fn nodeInterior(shape: u32, p: vec2f, half: vec2f, m: f32) -> bool {
  let minAxis = min(half.x, half.y);

  if (minAxis <= m) { return false; }

  switch shape {
    case 2u: { // rectangle: exact shrink
      let d = abs(p) - (half - vec2f(m));
      return max(d.x, d.y) <= 0.0;
    }
    case 3u: { // round-rectangle: cheap exact SD
      return roundRectangleSD(p, half, minAxis * 0.25) <= -m;
    }
    case 0u, 1u: { // circle + ellipse: normalized-space bound (exact for circles)
      let q = p / half;
      let lim = 1.0 - m / minAxis;
      return dot(q, q) <= lim * lim;
    }
    default: { // polygons: the normalized SD × min axis under-estimates depth
      return nodeSD(shape, p, half) <= -m;
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

  if (!nodeInterior(shape, in.local, half, 1.5)) { // stay inside the AA fringe
    discard;
  }

  return vec4f(0.0); // color writes are masked off
}
`;

export const EDGE_SHADER = `
${COMMON}

// flags columns are not bound here: the cull pass already dropped dead or
// hidden edges (and edges with dead/hidden endpoints)
@group(0) @binding(0) var<uniform> frame: Frame;
@group(0) @binding(1) var<storage, read> endpoints: array<vec2u>; // source,target node slots
@group(0) @binding(2) var<storage, read> lineColors: array<u32>;
@group(0) @binding(3) var<storage, read> widths: array<f32>;
@group(0) @binding(4) var<storage, read> opacities: array<f32>;
@group(0) @binding(5) var<storage, read> nodePositions: array<vec2f>;
@group(0) @binding(6) var<storage, read> lineStyles: array<u32>; // LINE_* ids

struct EdgeVSOut {
  @builtin(position) position: vec4f,
  @location(0) v: f32,          // signed perpendicular distance, device px
  @location(1) halfWidth: f32,  // device px
  @location(2) color: vec4f,    // straight-alpha rgba with opacity/LOD applied to a
  @location(3) @interpolate(flat) instance: u32,
  @location(4) u: f32,          // longitudinal distance from the source, model px
  @location(5) @interpolate(flat) lineStyle: u32,
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

  // endpoints are read from the node position buffer: dragging a node
  // uploads one row and its edges follow on-GPU
  let a = modelToPx(frame, nodePositions[ends.x]);
  let b = modelToPx(frame, nodePositions[ends.y]);
  let ab = b - a;
  let len = max(length(ab), 1e-4); // zero-length edges were culled

  let halfW = widthPx * 0.5;
  let dir = ab / len;
  let n = vec2f(-dir.y, dir.x);
  let corner = quadCorner(vi);
  let t = (corner.x + 1.0) * 0.5; // 0 at source, 1 at target
  let s = corner.y * (halfW + 1.0); // screen-space extrusion incl. 1px AA margin

  out.position = vec4f(pxToClip(frame, mix(a, b, t) + n * s), EDGE_Z, 1.0);
  out.v = s;
  out.halfWidth = halfW;

  let c = unpack4x8unorm(lineColors[slot]);

  out.color = vec4f(c.rgb, c.a * opacities[slot] * lod.y * (1.0 - frame.edgeDim));
  out.instance = slot;
  out.u = t * (len / frame.zoomDpr); // model px along the edge
  out.lineStyle = lineStyles[slot];
  return out;
}

// AA'd on/off mask for a dash period (lengths in model px, as v3's canvas
// dashes: setLineDash in the model-space-transformed context)
fn dashMask(u: f32, onLen: f32, offLen: f32, aaModel: f32) -> f32 {
  let period = onLen + offLen;
  let x = fract(u / period) * period;
  // signed distance to the nearest on/off boundary: + inside the on segment
  var sd = 0.0;
  if (x < onLen) { sd = min(x, onLen - x); }
  else { sd = -min(x - onLen, period - x); }
  return smoothstep(-aaModel, aaModel, sd);
}

@fragment
fn fsEdge(in: EdgeVSOut) -> @location(0) vec4f {
  var alpha = in.color.a * (1.0 - smoothstep(in.halfWidth - 0.75, in.halfWidth + 0.75, abs(in.v)));

  // line-style: dashed [6, 3] / dotted [1, 1] in model px (v3's patterns);
  // picking ignores the gaps, as v3 does
  if (in.lineStyle == 1u) {
    alpha = alpha * dashMask(in.u, 6.0, 3.0, 0.75 / frame.zoomDpr);
  } else if (in.lineStyle == 2u) {
    alpha = alpha * dashMask(in.u, 1.0, 1.0, 0.75 / frame.zoomDpr);
  }

  return vec4f(in.color.rgb * alpha, alpha); // premultiplied
}

@fragment
fn fsEdgePick(in: EdgeVSOut) -> @location(0) u32 {
  if (abs(in.v) > in.halfWidth) {
    discard;
  }

  return (in.instance + 1u) | 0x80000000u; // high bit marks edges
}
`;

export const ARROW_SHADER = `
${COMMON}

// One arrowhead quad per visible edge, per end: reuses the edge cull
// pass's visible list and indirect args (indexCount 6, one quad per
// instance).  Which end this draw covers comes from the tiny End
// uniform (two cached bind groups, one draw call each).  Edges whose
// arrow color has a=0 (shape 'none') collapse to a degenerate quad.
// this end's arrow colors bind at 7 (source or target column per bind
// group).  The vertex stage stays at WebGPU's base limit of 8 storage
// buffers (7 columns + the visible list in group 1); edge opacity is
// folded into the stored arrow alpha at style-write time for the same
// reason.
@group(0) @binding(0) var<uniform> frame: Frame;
@group(0) @binding(1) var<storage, read> endpoints: array<vec2u>;
@group(0) @binding(2) var<storage, read> edgeWidths: array<f32>;
@group(0) @binding(3) var<storage, read> nodePositions: array<vec2f>;
@group(0) @binding(4) var<storage, read> nodeSizes: array<vec2f>;
@group(0) @binding(5) var<storage, read> nodeBorders: array<f32>;
@group(0) @binding(6) var<storage, read> nodeShapes: array<u32>;
@group(0) @binding(7) var<storage, read> arrows: array<u32>;

struct End { isSource: u32 }
@group(0) @binding(8) var<uniform> end: End;

@group(1) @binding(0) var<storage, read> visible: array<u32>;

struct ArrowVSOut {
  @builtin(position) position: vec4f,
  @location(0) v: f32,      // signed lateral offset, device px
  @location(1) limit: f32,  // lateral half-width at this longitudinal t, device px
  @location(2) color: vec4f,
}

// distance from the node center to its boundary along unit direction d
fn boundaryOffset(shape: u32, half: vec2f, d: vec2f) -> f32 {
  switch shape {
    case 2u, 3u: { // rectangle (round-rect approximated as its box)
      let inv = 1.0 / max(abs(d), vec2f(1e-4));
      return min(half.x * inv.x, half.y * inv.y);
    }
    default: { // circle + ellipse: exact radius along d
      return 1.0 / max(length(d / max(half, vec2f(1e-4))), 1e-6);
    }
  }
}

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
  let half = (nodeSizes[tipSlot] * 0.5 + vec2f(nodeBorders[tipSlot] * 0.5)) * frame.zoomDpr;
  let tip = tipC - dir * boundaryOffset(nodeShapes[tipSlot], half, dir);

  // sizing follows the drawn (floored) edge width; alpha matches the edge LOD
  let lod = edgeLod(slot, edgeWidths[slot] * frame.zoomDpr, frame.edgeWidthFloor);
  let widthPx = max(edgeWidths[slot] * frame.zoomDpr, frame.edgeWidthFloor);
  let arrowLen = widthPx * 3.0 + 2.0;
  let halfBase = widthPx * 1.5 + 1.0;

  let n = vec2f(-dir.y, dir.x);
  let corner = quadCorner(vi);
  let t = (corner.y + 1.0) * 0.5; // 0 at base, 1 at tip
  let limit = halfBase * (1.0 - t);
  let lateral = corner.x * (limit + 1.0); // 1px AA margin

  out.position = vec4f(pxToClip(frame, tip - dir * arrowLen * (1.0 - t) + n * lateral), EDGE_Z, 1.0);
  out.v = lateral;
  out.limit = limit;
  // edge opacity is pre-folded into c.a at style-write time
  out.color = vec4f(c.rgb, c.a * lod.y * (1.0 - frame.edgeDim));
  return out;
}

@fragment
fn fsArrow(in: ArrowVSOut) -> @location(0) vec4f {
  let alpha = in.color.a * (1.0 - smoothstep(in.limit - 0.75, in.limit + 0.75, abs(in.v)));
  return vec4f(in.color.rgb * alpha, alpha); // premultiplied
}
`;

export const LABEL_SHADER = `
${COMMON}
${GLYPH_STRUCT}

// node flags are not bound here: the cull pass already dropped glyphs of
// dead/hidden nodes
@group(0) @binding(0) var<uniform> frame: Frame;
@group(0) @binding(1) var<storage, read> glyphs: array<Glyph>;
@group(0) @binding(2) var<storage, read> nodePositions: array<vec2f>;
@group(0) @binding(3) var atlas: texture_2d<f32>;
@group(0) @binding(4) var atlasSampler: sampler;

struct LabelVSOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
  @location(1) color: vec4f,
  @location(2) fade: f32,
}

@group(1) @binding(0) var<storage, read> visible: array<u32>;

@vertex
fn vsLabel(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> LabelVSOut {
  var out: LabelVSOut;

  // the cull pass compacted live, on-screen, non-faded glyphs
  let g = glyphs[visible[ii]];

  // LOD: fade out as the on-screen glyph shrinks (fully-faded glyphs were culled)
  let heightPx = g.size.y * frame.zoomDpr;
  let fade = labelFade(heightPx, frame.labelFadePx);

  // glyphs read the node position buffer: labels follow drags/layouts on-GPU
  let originPx = modelToPx(frame, nodePositions[g.nodeSlot]) + g.offset * frame.zoomDpr;
  let sizePx = g.size * frame.zoomDpr;
  let t = (quadCorner(vi) + vec2f(1.0)) * 0.5;

  out.position = vec4f(pxToClip(frame, originPx + t * sizePx), 0.0, 1.0);
  out.uv = mix(g.uv0, g.uv1, t);
  out.color = unpack4x8unorm(g.color);
  out.fade = fade;
  return out;
}

@fragment
fn fsLabel(in: LabelVSOut) -> @location(0) vec4f {
  // the SDF encodes the glyph edge at 0.5; fwidth-based smoothing keeps
  // text crisp at any zoom from the one 32px-per-glyph atlas
  let s = textureSample(atlas, atlasSampler, in.uv).r;
  let w = max(fwidth(s), 1e-4);
  let alpha = clamp((s - 0.5) / w + 0.5, 0.0, 1.0) * in.fade * in.color.a;

  return vec4f(in.color.rgb * alpha, alpha); // premultiplied
}
`;
