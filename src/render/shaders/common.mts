import { wgsl } from '../wgsl.mjs';

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
