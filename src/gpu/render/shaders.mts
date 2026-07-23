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

/**
 * The per-frame uniform block.  Not a mat3x3 (avoids WGSL alignment
 * footguns); computed CPU-side from the core viewport + device pixel ratio.
 * Layout must match Renderer's Float32Array(12): viewportPx, panPx, zoomDpr,
 * edgeWidthFloor, nodeLodPx, hidePx, edgeDim, labelFadePx, 2 pads — 48 bytes.
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
  pad1: f32,
  pad2: f32,
}
`;

const COMMON = `
${FRAME_STRUCT}

const FLAG_ALIVE: u32 = 1u;
const FLAG_VISIBLE: u32 = 2u;
const FLAG_SELECTED: u32 = 4u;
const FLAG_GRABBED: u32 = 16u;
const FLAG_HOVERED: u32 = 32u;
const SHOWN: u32 = 3u; // ALIVE | VISIBLE

const SELECT_ACCENT = vec3f(0.00392, 0.41176, 0.85098); // #0169d9

fn modelToPx(frame: Frame, p: vec2f) -> vec2f {
  return p * frame.zoomDpr + frame.panPx;
}

fn pxToClip(frame: Frame, px: vec2f) -> vec2f {
  return vec2f(px.x / frame.viewportPx.x * 2.0 - 1.0, 1.0 - px.y / frame.viewportPx.y * 2.0);
}

const DEGENERATE = vec4f(2.0, 2.0, 0.0, 1.0); // constant clip position -> zero-area quad

fn quadCorner(vi: u32) -> vec2f {
  switch vi {
    case 0u: { return vec2f(-1.0, -1.0); }
    case 1u: { return vec2f(1.0, -1.0); }
    case 2u: { return vec2f(-1.0, 1.0); }
    case 3u: { return vec2f(-1.0, 1.0); }
    case 4u: { return vec2f(1.0, -1.0); }
    default: { return vec2f(1.0, 1.0); }
  }
}
`;

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

// shape ids match contract.mts: 0 circle, 1 ellipse, 2 rectangle, 3 round-rectangle
fn nodeSD(shape: u32, p: vec2f, half: vec2f) -> f32 {
  switch shape {
    case 0u: { return circleSD(p, half.x); }
    case 1u: { return ellipseSD(p, half); }
    case 2u: { return rectangleSD(p, half); }
    default: { return roundRectangleSD(p, half, min(half.x, half.y) * 0.25); }
  }
}
`;

export const NODE_SHADER = `
${COMMON}
${SDF}

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
  @location(2) fill: vec4f,
  @location(3) borderColor: vec4f,
  @location(4) borderWidth: f32,  // device px
  @location(5) opacity: f32,
  @location(6) @interpolate(flat) shape: u32,
  @location(7) @interpolate(flat) flags: u32,
  @location(8) @interpolate(flat) instance: u32,
}

@vertex
fn vsNode(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> NodeVSOut {
  var out: NodeVSOut;
  let flags = nodeFlags[ii];

  if ((flags & SHOWN) != SHOWN) { // tombstone or hidden
    out.position = DEGENERATE;
    return out;
  }

  var half = sizes[ii] * 0.5 * frame.zoomDpr;
  var alphaComp = 1.0;
  let maxDim = max(half.x, half.y) * 2.0;

  // LOD: floor sub-pixel nodes to a visible minimum, compensating with alpha
  if (maxDim < frame.hidePx) {
    alphaComp = max(maxDim / frame.hidePx, 0.05);
    half = vec2f(frame.hidePx * 0.5);
  }

  let centerPx = modelToPx(frame, positions[ii]);
  let margin = 2.0; // AA + accent-ring slack, device px
  let ext = half + vec2f(margin);

  // conservative off-viewport collapse
  if (centerPx.x + ext.x < 0.0 || centerPx.x - ext.x > frame.viewportPx.x ||
      centerPx.y + ext.y < 0.0 || centerPx.y - ext.y > frame.viewportPx.y) {
    out.position = DEGENERATE;
    return out;
  }

  let local = quadCorner(vi) * ext;

  out.position = vec4f(pxToClip(frame, centerPx + local), 0.0, 1.0);
  out.local = local;
  out.halfSize = half;
  out.fill = unpack4x8unorm(fillColors[ii]);
  out.borderColor = unpack4x8unorm(borderColors[ii]);
  out.borderWidth = borderWidths[ii] * frame.zoomDpr;
  out.opacity = opacities[ii] * alphaComp;
  out.shape = shapes[ii];
  out.flags = flags;
  out.instance = ii;
  return out;
}

@fragment
fn fsNode(in: NodeVSOut) -> @location(0) vec4f {
  let sizePx = max(in.halfSize.x, in.halfSize.y) * 2.0;
  let plain = sizePx < frame.nodeLodPx; // LOD: plain AA disc, no decorations

  var shape = in.shape;
  var half = in.halfSize;

  if (plain) {
    shape = 0u;
    half = vec2f(max(in.halfSize.x, in.halfSize.y));
  }

  let sd = nodeSD(shape, in.local, half);
  var color = in.fill;

  if (!plain) {
    // border band, drawn inward from the shape boundary
    if (in.borderWidth > 0.0 && sd > -in.borderWidth) {
      color = in.borderColor;
    }

    // selection accent ring at the boundary
    if ((in.flags & FLAG_SELECTED) != 0u && sd > -max(2.0, in.borderWidth)) {
      color = vec4f(SELECT_ACCENT, 1.0);
    }

    // hover/grab brighten
    if ((in.flags & (FLAG_HOVERED | FLAG_GRABBED)) != 0u) {
      color = vec4f(min(color.rgb + vec3f(0.15), vec3f(1.0)), color.a);
    }
  }

  let alpha = (1.0 - smoothstep(-0.75, 0.75, sd)) * in.opacity * color.a;
  return vec4f(color.rgb * alpha, alpha); // premultiplied
}

@fragment
fn fsNodePick(in: NodeVSOut) -> @location(0) u32 {
  let sizePx = max(in.halfSize.x, in.halfSize.y) * 2.0;

  var shape = in.shape;
  var half = in.halfSize;

  if (sizePx < frame.nodeLodPx) {
    shape = 0u;
    half = vec2f(max(in.halfSize.x, in.halfSize.y));
  }

  if (nodeSD(shape, in.local, half) > 0.0) {
    discard;
  }

  return in.instance + 1u; // 0 = background
}
`;

export const EDGE_SHADER = `
${COMMON}

@group(0) @binding(0) var<uniform> frame: Frame;
@group(0) @binding(1) var<storage, read> endpoints: array<vec2u>; // source,target node slots
@group(0) @binding(2) var<storage, read> lineColors: array<u32>;
@group(0) @binding(3) var<storage, read> widths: array<f32>;
@group(0) @binding(4) var<storage, read> opacities: array<f32>;
@group(0) @binding(5) var<storage, read> edgeFlags: array<u32>;
@group(0) @binding(6) var<storage, read> nodePositions: array<vec2f>;
@group(0) @binding(7) var<storage, read> nodeFlags: array<u32>;

struct EdgeVSOut {
  @builtin(position) position: vec4f,
  @location(0) v: f32,          // signed perpendicular distance, device px
  @location(1) halfWidth: f32,  // device px
  @location(2) color: vec4f,    // straight-alpha rgba with opacity/LOD applied to a
  @location(3) @interpolate(flat) instance: u32,
}

@vertex
fn vsEdge(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> EdgeVSOut {
  var out: EdgeVSOut;

  var widthPx = widths[ii] * frame.zoomDpr;
  var alphaComp = 1.0;

  // LOD: floor hairline edges, compensating with alpha
  if (widthPx < frame.edgeWidthFloor) {
    alphaComp = max(widthPx / frame.edgeWidthFloor, 0.0);
    widthPx = frame.edgeWidthFloor;

    // decimation ladder: once floored edges fall below half alpha, draw a
    // hash-stable 1-in-N subset at N x alpha (N a power of two <= 64).
    // Aggregate coverage is preserved — (count/N) * (alpha*N) — while the
    // massed same-pixel blend cost at far zoom drops ~N-fold.  Runs before
    // any endpoint fetch so dropped instances cost no memory traffic.
    var n = 1u;
    while (alphaComp * f32(n) < 0.5 && n < 64u) { n = n * 2u; }

    if (n > 1u) {
      let h = ii * 2654435761u; // Knuth hash decorrelates from slot order

      if (((h >> 16u) & (n - 1u)) != 0u) {
        out.position = DEGENERATE;
        return out;
      }

      alphaComp = alphaComp * f32(n);
    }
  }

  let ends = endpoints[ii];

  // hidden when the edge or either endpoint is dead/hidden
  if ((edgeFlags[ii] & SHOWN) != SHOWN ||
      (nodeFlags[ends.x] & SHOWN) != SHOWN ||
      (nodeFlags[ends.y] & SHOWN) != SHOWN) {
    out.position = DEGENERATE;
    return out;
  }

  // endpoints are read from the node position buffer: dragging a node
  // uploads one row and its edges follow on-GPU
  let a = modelToPx(frame, nodePositions[ends.x]);
  let b = modelToPx(frame, nodePositions[ends.y]);
  let ab = b - a;
  let len = length(ab);

  if (len < 1e-4) {
    out.position = DEGENERATE;
    return out;
  }

  let halfW = widthPx * 0.5;
  let m = halfW + 1.0;

  // conservative off-viewport collapse (both endpoints beyond the same side)
  if ((a.x < -m && b.x < -m) || (a.y < -m && b.y < -m) ||
      (a.x > frame.viewportPx.x + m && b.x > frame.viewportPx.x + m) ||
      (a.y > frame.viewportPx.y + m && b.y > frame.viewportPx.y + m)) {
    out.position = DEGENERATE;
    return out;
  }

  let dir = ab / len;
  let n = vec2f(-dir.y, dir.x);
  let corner = quadCorner(vi);
  let t = (corner.x + 1.0) * 0.5; // 0 at source, 1 at target
  let s = corner.y * (halfW + 1.0); // screen-space extrusion incl. 1px AA margin

  out.position = vec4f(pxToClip(frame, mix(a, b, t) + n * s), 0.0, 1.0);
  out.v = s;
  out.halfWidth = halfW;

  let c = unpack4x8unorm(lineColors[ii]);

  out.color = vec4f(c.rgb, c.a * opacities[ii] * alphaComp * (1.0 - frame.edgeDim));
  out.instance = ii;
  return out;
}

@fragment
fn fsEdge(in: EdgeVSOut) -> @location(0) vec4f {
  let alpha = in.color.a * (1.0 - smoothstep(in.halfWidth - 0.75, in.halfWidth + 0.75, abs(in.v)));
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

export const LABEL_SHADER = `
${COMMON}

// matches GlyphBuffer's CPU layout: 10 words / 40 bytes per glyph
struct Glyph {
  nodeSlot: u32,   // 0xffffffff = dead (tombstoned run)
  color: u32,      // packed RGBA bytes
  offset: vec2f,   // quad top-left from the node center, model px
  size: vec2f,     // model px
  uv0: vec2f,
  uv1: vec2f,
}

const DEAD_GLYPH: u32 = 0xffffffffu;

@group(0) @binding(0) var<uniform> frame: Frame;
@group(0) @binding(1) var<storage, read> glyphs: array<Glyph>;
@group(0) @binding(2) var<storage, read> nodePositions: array<vec2f>;
@group(0) @binding(3) var<storage, read> nodeFlags: array<u32>;
@group(0) @binding(4) var atlas: texture_2d<f32>;
@group(0) @binding(5) var atlasSampler: sampler;

struct LabelVSOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
  @location(1) color: vec4f,
  @location(2) fade: f32,
}

@vertex
fn vsLabel(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> LabelVSOut {
  var out: LabelVSOut;
  let g = glyphs[ii];

  if (g.nodeSlot == DEAD_GLYPH || (nodeFlags[g.nodeSlot] & SHOWN) != SHOWN) {
    out.position = DEGENERATE;
    return out;
  }

  // LOD: fade out (and finally collapse) as the on-screen glyph shrinks
  let heightPx = g.size.y * frame.zoomDpr;
  let fade = smoothstep(frame.labelFadePx * 0.5, frame.labelFadePx, heightPx);

  if (fade <= 0.001) {
    out.position = DEGENERATE;
    return out;
  }

  // glyphs read the node position buffer: labels follow drags/layouts on-GPU
  let originPx = modelToPx(frame, nodePositions[g.nodeSlot]) + g.offset * frame.zoomDpr;
  let sizePx = g.size * frame.zoomDpr;

  // conservative off-viewport collapse
  if (originPx.x + sizePx.x < 0.0 || originPx.x > frame.viewportPx.x ||
      originPx.y + sizePx.y < 0.0 || originPx.y > frame.viewportPx.y) {
    out.position = DEGENERATE;
    return out;
  }

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
