import { wgsl } from '../wgsl.mjs';
import {
  IMAGE_TIER_SIZES as IMAGE_TIER_SIZES_WGSL,
  SDF_IMAGE_SIZE as SDF_IMAGE_SIZE_WGSL,
} from '../../image-registry.mjs';
import { SHAPE_MASK, SHAPE_SHIFT } from '../../contract.mjs';
import { COMMON } from './common.mjs';
import { SDF } from './sdf.mjs';

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
