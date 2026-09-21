import { wgsl } from '../wgsl.mjs';
import { SHAPE_MASK, SHAPE_SHIFT } from '../../contract.mjs';
import { COMMON } from './common.mjs';
import { SDF } from './sdf.mjs';

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
