import { wgsl } from '../wgsl.mjs';
import {
  BORDER_STYLE_SHIFT,
  OUTLINE_STYLE_SHIFT,
  STROKE_STYLE_MASK,
  STROKE_DASHED,
  STROKE_DOTTED,
  STROKE_DOUBLE,
  SHAPE_MASK,
  SHAPE_SHIFT,
} from '../../contract.mjs';
import { COMMON, DASH_WGSL } from './common.mjs';
import { SDF, NODE_PERIM_WGSL } from './sdf.mjs';

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
