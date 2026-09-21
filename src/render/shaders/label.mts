import { wgsl } from '../wgsl.mjs';
import { COMMON, GLYPH_STRUCT, BOUNDARY_WGSL } from './common.mjs';
import { CURVE_WGSL, ROUTE_WGSL } from './curve.mjs';
import { ARROW_GAP_WGSL } from './sdf.mjs';

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
// Round 58: this stage passes the *accessor* trim (arrowGapTrimOf —
// v3's plain gap/spacing, GraphStore.arrowTrimAt's twin) to the curve
// evaluators, so an edge label anchors exactly where midpoint()
// answers.  Round 56 had left it at a zero trim — the stage was at the
// 8-storage-buffer budget with no slot for edge.width — and the freed
// binding comes from the fused node.outerGeom column, which carries
// outerHalf + shape in one slot.
//
// flags columns are not bound here: the cull pass already dropped glyphs
// of dead/hidden owners.  The edge variant binds the curve inputs too —
// 7 storage buffers + the visible list (node geometry rides the fused
// outerGeom column; the curve param blob rides the freed slot), exactly
// the vertex-stage budget — so curved-edge labels anchor at the
// curve/route midpoint computed in the VS from live positions (zero
// rebuild on drags/layouts/tweens).
@group(0) @binding(0) var<uniform> frame: Frame;
@group(0) @binding(1) var<storage, read> glyphs: array<Glyph>;
${edge ? '@group(0) @binding(2) var<storage, read> endpoints: array<vec2u>;\n@group(0) @binding(3) var<storage, read> widths: array<vec2f>; // .x width, .y arrow bits (round 56)\n@group(0) @binding(4) var<storage, read> nodePositions: array<vec2f>;\n@group(0) @binding(5) var<storage, read> curveParams: array<vec4f>;\n@group(0) @binding(6) var<storage, read> nodeOuterGeom: array<vec4f>; // [hx, hy, shape, 0] (round 58)\n@group(0) @binding(7) var<storage, read> curveBlob: array<f32>;\n@group(0) @binding(8) var atlas: texture_2d<f32>;\n@group(0) @binding(9) var atlasSampler: sampler;' : '@group(0) @binding(2) var<storage, read> nodePositions: array<vec2f>;\n@group(0) @binding(3) var<storage, read> nodeOpacity: array<f32>; // element opacity (115.6: labels dim with their node, as v3)\n@group(0) @binding(4) var atlas: texture_2d<f32>;\n@group(0) @binding(5) var atlasSampler: sampler;'}

// Round 95: the outline goes under the ink.  Glyph quads overlap by
// construction (each carries the SDF pad halo past its ink), and one
// combined fill+outline pass composites glyph N's opaque outline ring
// over glyph N-1's already-blended fill — the white notches cut into a
// word's letters.  v3 never does this: it strokes the whole line, then
// fills over it.  So the pipeline specializes this constant into two
// variants — outline coverage only (1), drawn for every stream first,
// then fill (0) over it — same module, same instances, no new buffers.
// The fill variant keeps the boundary colour mixing and drops the max
// that let a ring beat ink; the renderer skips the outline pass
// entirely for streams with no outlined glyph.
override LABEL_PHASE: u32 = 0u;

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
  // element opacity (115.6): v3's effective label alpha is opacity x
  // text-opacity.  text-opacity is folded into the stored colour at
  // style-write; the node's own opacity column (ancestor-folded under
  // compounds) multiplies here, exactly as the body shader does — so a
  // dimmed node dims its label.  Edge labels are at the storage-buffer
  // budget and take the fold at style-write, like edge lines do.
  let fade = labelFade(heightPx, frame.labelFadePx)${edge ? '' : ' * nodeOpacity[g.nodeSlot]'};

  // glyphs read live positions: labels follow drags/layouts on-GPU
  ${
    edge
      ? `let owner = glyphOwner(g.nodeSlot);
  let ends = endpoints[owner];
  let pa = nodePositions[ends.x];
  let pb = nodePositions[ends.y];
  let params = curveParams[owner];
  // round 58: the accessor trim and the fused node geometry — the
  // anchor must land exactly where midpoint() answers
  let gs = nodeOuterGeom[ends.x];
  let gt = nodeOuterGeom[ends.y];
  let gTrim = arrowGapTrimOf(widths[owner]);
  var anchor = (pa + pb) * 0.5;
  // the autorotate frame endpoints: a bezier's t=0.5 tangent IS the
  // chord direction, so (pa, pb) stands; a loop's midpoint tangent runs
  // c1 -> c2; a 12b route's tangent comes from its midpoint rule
  var rotA = pa;
  var rotB = pb;

  if ((params.w != 0.0 && params.w <= 2.0) || params.w == 16.0) { // bezier / loop / compound midpoint
    let geom = evalCurveGeom(
      params,
      pa, gs.xy, u32(gs.z),
      pb, gt.xy, u32(gt.z),
      gTrim
    );

    anchor = geom.m;

    if (params.w == 2.0) {
      rotA = geom.c1;
      rotB = geom.c2;
    }
  } else if (params.w == 6.0) { // haystack (12c): the offset midpoint
    let ha = pa + vec2f(cos(params.x), sin(params.x)) * gs.xy * params.z;
    let hb = pb + vec2f(cos(params.y), sin(params.y)) * gt.xy * params.z;

    anchor = (ha + hb) * 0.5;
    rotA = ha;
    rotB = hb;
  } else if (params.w > 2.0 && params.w != 7.0) { // route families: v3's midpoint rules
    var route = evalRouteW(
      params,
      pa, gs.xy, u32(gs.z),
      pb, gt.xy, u32(gt.z),
      gTrim
    );
    let midTan = routeMidpointW(&route);

    anchor = midTan.xy;
    rotA = anchor;
    rotB = anchor + midTan.zw;
  } else {
    // straight / straight-triangle (round 58): v3's rs.mid is the
    // four-point mean straightMidW computes — what midpoint() answers —
    // not the centre chord; rotA/rotB stay the chord (same direction)
    var md = pb - pa;
    let ml = length(md);

    if (ml < 1e-6) { md = vec2f(1.0, 0.0); } else { md = md / ml; }

    let bs = pa + md * boundaryOffset(u32(gs.z), gs.xy, md);
    let bt = pb - md * boundaryOffset(u32(gt.z), gt.xy, -md);

    anchor = straightMidW(bs, bt, pa, pb, widths[owner]);
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
        pa, gs.xy, u32(gs.z),
        pb, gt.xy, u32(gt.z),
        gTrim
      );

      at = curveEndWalk(geom, fromSource, dist);
    } else if (params.w == 6.0) { // haystack: the offset segment
      let ha = pa + vec2f(cos(params.x), sin(params.x)) * gs.xy * params.z;
      let hb = pb + vec2f(cos(params.y), sin(params.y)) * gt.xy * params.z;

      at = segmentWalk(ha, hb, fromSource, dist);
    } else if (params.w > 2.0 && params.w != 7.0) { // route families
      var endRoute = evalRouteW(
        params,
        pa, gs.xy, u32(gs.z),
        pb, gt.xy, u32(gt.z),
        gTrim
      );

      at = routeEndWalkW(&endRoute, fromSource, dist);
    } else { // straight / straight-triangle: the gap-trimmed boundary chord
      var d = pb - pa;
      let l = length(d);

      if (l < 1e-6) { d = vec2f(1.0, 0.0); } else { d = d / l; }

      let sPt = pa + d * boundaryOffset(u32(gs.z), gs.xy, d);
      let ePt = pb - d * boundaryOffset(u32(gt.z), gt.xy, -d);

      // round 58: v3's allpts start at the *gap*-shortened line ends
      // (rs.startX/Y), so the end-label walk does too — shortened
      // toward the far node centre, exactly straightLineEndAt
      at = segmentWalk(
        shortenTowardW(sPt, pb, gTrim.x),
        shortenTowardW(ePt, pa, gTrim.y),
        fromSource, dist);
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
  // the edge AA scale-free.  The letterform itself is only as good as
  // the raster baked into the field, which is why the atlas re-rasters
  // at the 64 px tier under sustained zoom (round 94).  (Sampled
  // unconditionally: a branch around textureSample would be non-uniform.)
  let s = textureSample(atlas, atlasSampler, in.uv).r;
  let w = max(fwidth(s), 1e-4); // derivatives before any non-uniform branch

  if (in.solid != 0u) { // text background quad (B6: shape + border)
    // background quads already draw under their own run; they belong
    // to the fill pass under both phases (round 95)
    if (LABEL_PHASE == 1u) {
      return vec4f(0.0);
    }

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
  let outlined = in.outlineWidth > 0.0 && in.outlineColor.a > 0.0;

  // text-outline: a second, lower distance threshold ringing the glyph.
  // Pass 1 (round 95) draws the whole outline coverage — the fill pass
  // inks over it, exactly v3's strokeText-then-fillText layering.
  if (LABEL_PHASE == 1u) {
    if (!outlined) {
      return vec4f(0.0);
    }

    let outerA = clamp((s - (0.5 - in.outlineWidth)) / w + 0.5, 0.0, 1.0);
    let a = outerA * in.outlineColor.a * in.fade;

    return vec4f(in.outlineColor.rgb * a, a); // premultiplied
  }

  var rgb = in.color.rgb;

  // the phase split changes coverage, not the colour math: the fill
  // pass keeps the boundary mixing (or edges get a dark AA fringe on
  // light outlines) and drops the old max(alpha, ring alpha), which is
  // what let a glyph's ring beat the previous letter's ink
  if (outlined) {
    rgb = mix(in.outlineColor.rgb, in.color.rgb, fillA);
  }

  let alpha = fillA * in.color.a * in.fade;

  return vec4f(rgb * alpha, alpha); // premultiplied
}
`;

export const LABEL_SHADER = labelShader(false);
export const EDGE_LABEL_SHADER = labelShader(true);
