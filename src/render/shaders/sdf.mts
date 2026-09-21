import { wgsl } from '../wgsl.mjs';
import {
  ARROW_AXIAL_DEPTH,
  ARROW_COMPOUND_POINTS,
  ARROW_GAP_CONST,
  ARROW_GAP_K,
  ARROW_GAP_K_DEFAULT,
  ARROW_POINTS,
  POLYGON_POINTS,
  ROUND_POLYGON_SOURCE,
} from '../../shape-points.mjs';
import {
  ARROW_SHAPE_MASK,
  ARROW_SHIFT_SCALE,
  ARROW_SHIFT_SOURCE,
  ARROW_SHIFT_SRC_SHOWS_LINE,
  ARROW_SHIFT_TARGET,
  ARROW_SHIFT_TGT_SHOWS_LINE,
  CUT_RECTANGLE_CORNER,
  ARROW_CIRCLE,
  ARROW_CIRCLE_TRIANGLE,
  ARROW_CIRCLE_TRIANGLE_RADIUS,
  ARROW_TEE,
  ARROW_TRIANGLE_CROSS,
  ARROW_TRIANGLE_TEE,
  BARREL_CTRL_OFFSET_PCT,
  BARREL_CURVE_SEGMENTS,
  BARREL_HEIGHT_OFFSET_MAX,
  BARREL_HEIGHT_OFFSET_PCT,
  BARREL_WIDTH_OFFSET_MAX,
  BARREL_WIDTH_OFFSET_PCT,
  ROUND_POLYGON_RADIUS_DIV,
  ROUND_POLYGON_RADIUS_MAX,
  SHAPE_BARREL,
  SHAPE_BOTTOM_ROUND_RECTANGLE,
  SHAPE_CUT_RECTANGLE,
  SHAPE_POLYGON_CUSTOM,
  SHAPE_ROUND_TAG,
  SHAPE_ROUND_TRIANGLE,
} from '../../contract.mjs';

// Polygon shape SDFs, generated from the shared unit point tables so the
// WGSL geometry is identical to the CPU pick's.  The unit vertices are
// scaled by the node's half-size and the distance evaluated in device
// space, so it is exact under anisotropy (crisp AA, uniform borders).
const fmtF32 = (x: number): string => x.toFixed(8);

const polygonSdFns = (): {
  fns: string;
  cases: string;
  perimFns: string;
  perimCases: string;
} => {
  let fns = '';
  let cases = '';
  let perimFns = '';
  let perimCases = '';

  for (const [id, pts] of POLYGON_POINTS) {
    const n = pts.length / 2;
    const lits = Array.from(
      { length: n },
      (_, i) => `vec2f(${fmtF32(pts[i * 2])}, ${fmtF32(pts[i * 2 + 1])})`,
    ).join(', ');

    // https://iquilezles.org/articles/distfunctions2d/ sdPolygon
    fns += `
fn poly${id}SD(p: vec2f, half: vec2f) -> f32 {
  var v = array<vec2f, ${n}>(${lits});
  for (var k = 0; k < ${n}; k++) { v[k] = v[k] * half; }
  var d = dot(p - v[0], p - v[0]);
  var s = 1.0;
  var j = ${n - 1};
  for (var i = 0; i < ${n}; i++) {
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
    cases += `    case ${id}u: { return poly${id}SD(p, half); }\n`;

    // round 38: the perimeter twin — the same vertex list walked in
    // v3's path order (drawPolygonPath: moveTo(points[0]), lineTo
    // forward), tracking the argmin edge and its clamped projection
    // against a cumulative arc length.  Scaled per fragment because the
    // half-size scales edges anisotropically.
    perimFns += `
fn poly${id}Perim(p: vec2f, half: vec2f) -> f32 {
  var v = array<vec2f, ${n}>(${lits});
  for (var k = 0; k < ${n}; k++) { v[k] = v[k] * half; }
  var best = 1e30;
  var u = 0.0;
  var cum = 0.0;
  for (var i = 0; i < ${n}; i++) {
    let a = v[i];
    let b = v[(i + 1) % ${n}];
    let e = b - a;
    let len = length(e);
    let t = clamp(dot(p - a, e) / max(dot(e, e), 1e-12), 0.0, 1.0);
    let q = a + e * t - p;
    let d = dot(q, q);
    if (d < best) { best = d; u = cum + t * len; }
    cum = cum + len;
  }
  return u;
}
`;
    perimCases += `    case ${id}u: { return poly${id}Perim(p, half); }\n`;
  }

  // Round-corner shapes (27.4).  A polygon with every corner replaced by
  // a tangent arc of radius r is exactly the Minkowski sum of the
  // *inward-offset* polygon with a disc of radius r — so the distance
  // field is sdPolygon(offset) - r, which stays exact under anisotropic
  // scaling where the naive "offset the sharp polygon's SDF" does not.
  // That anisotropy is precisely why the family was deferred in round 13.
  //
  // The offset vertices are the standard miter form
  //   o = v + r * (n1 + n2) / (1 + dot(n1, n2))
  // with n1/n2 the inward edge normals.  The winding sign is folded in
  // at codegen (signed area), so the shader does no orientation test.
  for (const [id, source] of ROUND_POLYGON_SOURCE) {
    const pts = POLYGON_POINTS.get(source) as readonly number[];
    const n = pts.length / 2;
    const lits = Array.from(
      { length: n },
      (_, i) => `vec2f(${fmtF32(pts[i * 2])}, ${fmtF32(pts[i * 2 + 1])})`,
    ).join(', ');

    // signed area in unit space: positive means counter-clockwise, which
    // decides which perpendicular of an edge points into the shape
    let area2 = 0;

    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;

      area2 += pts[i * 2] * pts[j * 2 + 1] - pts[j * 2] * pts[i * 2 + 1];
    }

    const wind = area2 > 0 ? '1.0' : '-1.0';

    fns += `
fn roundPoly${id}SD(p: vec2f, half: vec2f, r: f32) -> f32 {
  var v = array<vec2f, ${n}>(${lits});
  for (var k = 0; k < ${n}; k++) { v[k] = v[k] * half; }
  // keep the offset polygon non-degenerate; v3's 'auto' radius is well
  // inside this, and an over-large explicit corner-radius clamps here
  let rr = min(r, min(half.x, half.y) * 0.5);
  var o = array<vec2f, ${n}>();
  for (var i = 0; i < ${n}; i++) {
    let prev = v[(i + ${n - 1}) % ${n}];
    let next = v[(i + 1) % ${n}];
    let e1 = normalize(v[i] - prev);
    let e2 = normalize(next - v[i]);
    let n1 = vec2f(-e1.y, e1.x) * ${wind};
    let n2 = vec2f(-e2.y, e2.x) * ${wind};
    let denom = 1.0 + dot(n1, n2);
    o[i] = v[i] + select(vec2f(0.0), (n1 + n2) * (rr / denom), denom > 1e-4);
  }
  var d = dot(p - o[0], p - o[0]);
  var s = 1.0;
  var j = ${n - 1};
  for (var i = 0; i < ${n}; i++) {
    let e = o[j] - o[i];
    let w = p - o[i];
    let b = w - e * clamp(dot(w, e) / dot(e, e), 0.0, 1.0);
    d = min(d, dot(b, b));
    let c1 = p.y >= o[i].y;
    let c2 = p.y < o[j].y;
    let c3 = e.x * w.y > e.y * w.x;
    if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) { s = -s; }
    j = i;
  }
  return s * sqrt(d) - rr;
}
`;
    cases += `    case ${id}u: { return roundPoly${id}SD(p, half, radius); }\n`;
    // round 38: the round-* dash coordinate walks the SOURCE polygon's
    // edges — a recorded approximation: the drawn boundary's corner
    // arcs are slightly shorter than the sharp corners, so the dash
    // phase drifts by the arc/miter difference at each corner
    perimCases += `    case ${id}u: { return poly${source}Perim(p, half); }\n`;
  }

  return { fns, cases, perimFns, perimCases };
};

const POLY = polygonSdFns();

// Arrowhead SDFs generated from the shared v3 point tables (tip at the
// local origin, body toward negative y, scaled uniformly by `s`).
const arrowSdFns = (): { fns: string; cases: string } => {
  let fns = '';
  let cases = '';

  for (const [id, pts] of ARROW_POINTS) {
    const n = pts.length / 2;
    const lits = Array.from(
      { length: n },
      (_, i) => `vec2f(${fmtF32(pts[i * 2])}, ${fmtF32(pts[i * 2 + 1])})`,
    ).join(', ');

    fns += `
fn arrow${id}SD(p: vec2f, s: f32) -> f32 {
  var v = array<vec2f, ${n}>(${lits});
  for (var k = 0; k < ${n}; k++) { v[k] = v[k] * s; }
  var d = dot(p - v[0], p - v[0]);
  var sgn = 1.0;
  var j = ${n - 1};
  for (var i = 0; i < ${n}; i++) {
    let e = v[j] - v[i];
    let w = p - v[i];
    let b = w - e * clamp(dot(w, e) / dot(e, e), 0.0, 1.0);
    d = min(d, dot(b, b));
    let c1 = p.y >= v[i].y;
    let c2 = p.y < v[j].y;
    let c3 = e.x * w.y > e.y * w.x;
    if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) { sgn = -sgn; }
    j = i;
  }
  return sgn * sqrt(d);
}
`;
    cases += `    case ${id}u: { sd = arrow${id}SD(p, s); }\n`;
  }

  // Compound arrowheads (27.6): a union of disjoint parts.  Coverage is
  // a smoothstep over the distance, so the union is min(sdA, sdB) and
  // the parts need no stitching.  Each part gets its own generated
  // function; the dispatch case takes the min.
  for (const [id, parts] of ARROW_COMPOUND_POINTS) {
    parts.forEach((pts, part) => {
      const n = pts.length / 2;
      const lits = Array.from(
        { length: n },
        (_, i) => `vec2f(${fmtF32(pts[i * 2])}, ${fmtF32(pts[i * 2 + 1])})`,
      ).join(', ');

      fns += `
fn arrow${id}p${part}SD(p: vec2f, s: f32) -> f32 {
  var v = array<vec2f, ${n}>(${lits});
  for (var k = 0; k < ${n}; k++) { v[k] = v[k] * s; }
  var d = dot(p - v[0], p - v[0]);
  var sgn = 1.0;
  var j = ${n - 1};
  for (var i = 0; i < ${n}; i++) {
    let e = v[j] - v[i];
    let w = p - v[i];
    let b = w - e * clamp(dot(w, e) / dot(e, e), 0.0, 1.0);
    d = min(d, dot(b, b));
    let c1 = p.y >= v[i].y;
    let c2 = p.y < v[j].y;
    let c3 = e.x * w.y > e.y * w.x;
    if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) { sgn = -sgn; }
    j = i;
  }
  return sgn * sqrt(d);
}
`;
    });
  }

  // triangle-tee: the triangle plus its detached bar
  cases +=
    `    case ${ARROW_TRIANGLE_TEE}u: { ` +
    `sd = min(arrow${ARROW_TRIANGLE_TEE}p0SD(p, s), arrow${ARROW_TRIANGLE_TEE}p1SD(p, s)); }\n`;

  // circle-triangle: v3's frame, the disc centred on the arrow origin
  // with the triangle behind it.  Before round 56 both this disc and the
  // point table were shifted a radius back so the drawn result was right
  // without the tip carrying `spacing`; 56 applies `spacing` to the tip
  // for every shape instead, so the frame is v3's and the accessors can
  // report the same point.
  cases +=
    `    case ${ARROW_CIRCLE_TRIANGLE}u: { ` +
    `sd = min(arrow${ARROW_CIRCLE_TRIANGLE}p0SD(p, s), ` +
    `length(p) - ${ARROW_CIRCLE_TRIANGLE_RADIUS} * s); }\n`;

  // triangle-cross: the bar's thickness tracks the *edge width*, not the
  // arrow size, so its points cannot be a static table — this is why the
  // arrow fragment stage carries the model width as a varying (27.3)
  cases +=
    `    case ${ARROW_TRIANGLE_CROSS}u: { ` +
    `sd = min(arrow${ARROW_TRIANGLE_CROSS}p0SD(p, s), crossBarSD(p, s, in.widthModel * frame.zoomDpr)); }\n`;

  return { fns, cases };
};

export const ARROW_POLY = arrowSdFns();
/**
 * v3's `gap( edge )` and `spacing( edge )` as WGSL, **generated from the
 * same tables `arrowGap`/`arrowSpacing` read** (round 56).
 *
 * The dual-implementation discipline this file uses for curves says the
 * two sides must agree by construction rather than by review.  For a
 * lookup table the strongest form of that is to emit one side from the
 * other, which is what this does: adding a head to `ARROW_GAP_K` changes
 * the shader with no second edit, and a spec asserts the generated
 * source names every id the table does.
 *
 * `spacing` is not table-driven — it is three special cases in v3 — so it
 * is written out, with the two disc heads sharing `arrowSizeW`.
 */
const arrowGapFns = (): string => {
  let cases = '';

  for (const [id, k] of ARROW_GAP_K) {
    cases += `    case ${id}u: { return ${fmtF32(k)} * wModel * scale; }\n`;
  }

  for (const [id, c] of ARROW_GAP_CONST) {
    cases += `    case ${id}u: { return ${fmtF32(c)}; }\n`;
  }

  let depths = '';

  for (const [id, d] of ARROW_AXIAL_DEPTH) {
    depths += `    case ${id}u: { return ${fmtF32(d)}; }\n`;
  }

  return wgsl`
// v3's getArrowWidth: the arrow size unit, in *model* px (27.3 — the 29
// is a model-space floor, so this must not see a device width)
fn arrowSizeW(wModel: f32, scale: f32) -> f32 {
  return max(pow(wModel * 13.37, 0.9), 29.0) * scale;
}

// v3's arrowShapes[shape].gap(edge): how far behind the node boundary
// the drawn line stops.  Generated from ARROW_GAP_K / ARROW_GAP_CONST.
fn arrowGapW(shape: u32, wModel: f32, scale: f32) -> f32 {
  switch shape {
${cases}    default: { return ${fmtF32(ARROW_GAP_K_DEFAULT)} * wModel * scale; }
  }
}

// v3's arrowShapes[shape].spacing(edge): how far behind the node
// boundary the arrow *tip* sits.  Non-zero for three heads only.
fn arrowSpacingW(shape: u32, wModel: f32, scale: f32) -> f32 {
  if (shape == ${ARROW_TEE}u) { return 1.0; }
  if (shape == ${ARROW_CIRCLE}u || shape == ${ARROW_CIRCLE_TRIANGLE}u) {
    return arrowSizeW(wModel, scale) * ${fmtF32(ARROW_CIRCLE_TRIANGLE_RADIUS)};
  }
  return 0.0;
}

// The shape ids for this edge's two ends, unpacked from edge.width's
// lane 1 (round 56 — the arrow word rides there so the vertex stages,
// which have no spare storage-buffer slot, can reach it).
fn arrowWordOf(w: vec2f) -> u32 { return bitcast<u32>(w.y); }
fn srcShapeOf(word: u32) -> u32 { return (word >> ${ARROW_SHIFT_SOURCE}u) & ${ARROW_SHAPE_MASK}u; }
fn tgtShapeOf(word: u32) -> u32 { return (word >> ${ARROW_SHIFT_TARGET}u) & ${ARROW_SHAPE_MASK}u; }
fn scaleOfWord(word: u32) -> f32 {
  let q = word >> ${ARROW_SHIFT_SCALE}u;
  return select(f32(q) / 16.0, 1.0, q == 0u);
}

// How far back the head covers the edge's axis contiguously, in
// arrow-frame units.  Generated from ARROW_AXIAL_DEPTH — see the note
// there for why this is not ARROW_BACK.
fn arrowAxialDepthW(shape: u32) -> f32 {
  switch shape {
${depths}    default: { return 0.0; }
  }
}

// Where the *drawn* line stops, in model px.
//
// v3 does not trim: it paints the line in full and then erases the
// head's footprint out of the canvas (destination-out), so the visible
// line ends wherever the head's shape ends.  v4 reproduces that with a
// trim, which costs no second pass, no extra pipeline and no change to
// how cy.png composites its background — but a trim is one distance, so
// it takes the deeper of v3's own gap and the head's contiguous axial
// depth.  Under the gap the line is inside the head either way; past the
// depth the head no longer covers the axis and v3 would show the line
// (a vee's notch is the case that makes this not simply ARROW_BACK).
fn arrowDrawTrimW(shape: u32, showsLine: bool, wModel: f32, scale: f32) -> f32 {
  let gap = arrowGapW(shape, wModel, scale);

  // An opaque filled head hides the line under it either way, so v3's
  // gap is exactly right and shortening further would cut the slivers v3
  // leaves where the head is narrower than the line.  A head that shows
  // the line — hollow, or translucent — is hidden by v3's *erase*
  // instead, which reaches the head's own depth.
  if (!showsLine) { return gap; }

  return max(gap, arrowAxialDepthW(shape) * arrowSizeW(wModel, scale));
}

// The four shortenings for one edge, packed for the curve evaluators:
// (srcDrawTrim, tgtDrawTrim, srcSpacing, tgtSpacing).  The ArrowTrim
// twin — same order, same meaning.
fn arrowTrimOf(w: vec2f) -> vec4f {
  let word = arrowWordOf(w);
  let scale = scaleOfWord(word);
  let src = srcShapeOf(word);
  let tgt = tgtShapeOf(word);
  // derived by the store, mirror-only: hollow or translucent
  let srcShows = ((word >> ${ARROW_SHIFT_SRC_SHOWS_LINE}u) & 1u) == 1u;
  let tgtShows = ((word >> ${ARROW_SHIFT_TGT_SHOWS_LINE}u) & 1u) == 1u;

  return vec4f(
    arrowDrawTrimW(src, srcShows, w.x, scale),
    arrowDrawTrimW(tgt, tgtShows, w.x, scale),
    arrowSpacingW(src, w.x, scale),
    arrowSpacingW(tgt, w.x, scale));
}

// v3's shortenIntersection, verbatim including the degenerate clamp: the
// boundary point moved by 'amount' toward the far point, never past it.
fn shortenTowardW(pt: vec2f, toward: vec2f, amount: f32) -> vec2f {
  let disp = pt - toward;
  let len = length(disp);
  var ratio = (len - amount) / max(len, 1e-6);
  if (ratio < 0.0) { ratio = 0.00001; }
  return toward + disp * ratio;
}

// The accessor-semantics trim (round 58): v3's plain gap/spacing per
// end, the exact twin of GraphStore.arrowTrimAt.  arrowTrimOf above
// extends hollow/translucent heads to their axial depth because it
// positions *ink* (the drawn line, the layer strokes); anchors — label
// midpoints, mid arrows, end-label walks — sit at the gap, because that
// is what midpoint() answers and where v3 builds rs.allpts.
fn arrowGapTrimOf(w: vec2f) -> vec4f {
  let word = arrowWordOf(w);
  let scale = scaleOfWord(word);
  let src = srcShapeOf(word);
  let tgt = tgtShapeOf(word);

  return vec4f(
    arrowGapW(src, w.x, scale),
    arrowGapW(tgt, w.x, scale),
    arrowSpacingW(src, w.x, scale),
    arrowSpacingW(tgt, w.x, scale));
}

// v3's straight-edge rs.mid (round 58): the mean of the two
// gap-shortened line ends and the two spacing-shortened arrow points —
// NOT the centre-chord midpoint, which it equals only when both ends
// carry the same head.  bs/bt are the resolved boundary points, ca/cb
// the node centres (v3 shortens toward the far *centre*).  The CPU
// twin is Collection.midpoint()'s straight branch.
fn straightMidW(bs: vec2f, bt: vec2f, ca: vec2f, cb: vec2f, w: vec2f) -> vec2f {
  let t = arrowGapTrimOf(w);
  let l0 = shortenTowardW(bs, cb, t.x);
  let l1 = shortenTowardW(bt, ca, t.y);
  let a0 = shortenTowardW(bs, cb, t.z);
  let a1 = shortenTowardW(bt, ca, t.w);

  return (l0 + l1 + a0 + a1) * 0.25;
}
`;
};

export const ARROW_GAP_WGSL = arrowGapFns();

// SDFs ported from shader-sdf.mts (https://iquilezles.org/articles/distfunctions2d/)
export const SDF = wgsl`
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

${POLY.fns}
// custom polygon (C3): iq's sdPolygon over unit points from the poly
// blob, scaled to device space (exact distance, like the generated
// shapes); ref packs offset | count << 24
fn customPolySD(p: vec2f, half: vec2f, polyRef: u32) -> f32 {
  let off = polyRef & 0xffffffu;
  let count = polyRef >> 24u;

  if (count < 3u) { return 1e6; }

  let v0 = vec2f(polyBlob[off], polyBlob[off + 1u]) * half;
  var d = dot(p - v0, p - v0);
  var sgn = 1.0;
  var j = count - 1u;

  for (var i = 0u; i < count; i = i + 1u) {
    let vi = vec2f(polyBlob[off + i * 2u], polyBlob[off + i * 2u + 1u]) * half;
    let vj = vec2f(polyBlob[off + j * 2u], polyBlob[off + j * 2u + 1u]) * half;
    let e = vj - vi;
    let w = p - vi;
    let b = w - e * clamp(dot(w, e) / dot(e, e), 0.0, 1.0);

    d = min(d, dot(b, b));

    let c1 = p.y >= vi.y;
    let c2 = p.y < vj.y;
    let c3 = e.x * w.y > e.y * w.x;

    if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) { sgn = -sgn; }

    j = i;
  }

  return sgn * sqrt(d);
}

// A rectangle with its four corners chamfered by 'cut' (v3's
// cut-rectangle, round 27.2).  The chamfered box is the box intersected
// with the diagonal half-plane |x| + |y| <= hw + hh - cut, and the max
// of two exact convex distance fields is itself exact — the same
// standard the generated polygons meet.
fn cutRectangleSD(p: vec2f, half: vec2f, cut: f32) -> f32 {
  let c = min(cut, min(half.x, half.y));
  let diag = (abs(p.x) + abs(p.y) - (half.x + half.y - c)) * 0.70710678;

  return max(rectangleSD(p, half), diag);
}

// v3's barrel (27.5): a rectangle whose four corners are quadratic
// beziers.  The corner offsets are size-relative until they hit absolute
// caps, so the outline is rebuilt per fragment rather than baked into a
// unit table.  Each corner is sampled into BARREL_CURVE_SEGMENTS
// segments — the same fidelity v3's own hit test uses — and the
// resulting closed polygon runs through the standard exact-polygon
// distance loop, so sign and distance are exact for that outline.
fn barrelSD(p: vec2f, half: vec2f, zoomDpr: f32) -> f32 {
  let hOff = min(${BARREL_HEIGHT_OFFSET_MAX}.0 * zoomDpr, ${BARREL_HEIGHT_OFFSET_PCT} * half.y * 2.0);
  let wOff = min(${BARREL_WIDTH_OFFSET_MAX}.0 * zoomDpr, ${BARREL_WIDTH_OFFSET_PCT} * half.x * 2.0);
  let ctrl = ${BARREL_CTRL_OFFSET_PCT} * half.x * 2.0;
  let x0 = -half.x;
  let x1 = half.x;
  let y0 = -half.y;
  let y1 = half.y;

  // the four corners, clockwise from the top-left, as (start, control, end)
  var a = array<vec2f, 4>(
    vec2f(x0, y0 + hOff), vec2f(x1 - wOff, y0), vec2f(x1, y1 - hOff), vec2f(x0 + wOff, y1));
  var c = array<vec2f, 4>(
    vec2f(x0 + ctrl, y0), vec2f(x1 - ctrl, y0), vec2f(x1 - ctrl, y1), vec2f(x0 + ctrl, y1));
  var b = array<vec2f, 4>(
    vec2f(x0 + wOff, y0), vec2f(x1, y0 + hOff), vec2f(x1 - wOff, y1), vec2f(x0, y1 - hOff));

  const N: i32 = 4 * (${BARREL_CURVE_SEGMENTS} + 1);
  var v = array<vec2f, N>();
  var k = 0;

  for (var i = 0; i < 4; i++) {
    for (var j = 0; j <= ${BARREL_CURVE_SEGMENTS}; j++) {
      let t = f32(j) / ${BARREL_CURVE_SEGMENTS}.0;
      let u = 1.0 - t;

      v[k] = a[i] * (u * u) + c[i] * (2.0 * u * t) + b[i] * (t * t);
      k = k + 1;
    }
  }

  var d = dot(p - v[0], p - v[0]);
  var s = 1.0;
  var jj = N - 1;

  for (var i = 0; i < N; i++) {
    let e = v[jj] - v[i];
    let w = p - v[i];
    let bb = w - e * clamp(dot(w, e) / dot(e, e), 0.0, 1.0);
    d = min(d, dot(bb, bb));
    let c1 = p.y >= v[i].y;
    let c2 = p.y < v[jj].y;
    let c3 = e.x * w.y > e.y * w.x;
    if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) { s = -s; }
    jj = i;
  }

  return s * sqrt(d);
}

// v3's bottom-round-rectangle (27.4): only the two bottom corners are
// rounded.  Built from the round-rectangle field with the top corners'
// radius set to zero, which is a per-corner radius selected by the sign
// of p.y — exact, since the box SDF is separable that way.
fn bottomRoundRectangleSD(p: vec2f, half: vec2f, r: f32) -> f32 {
  let rr = select(0.0, min(r, min(half.x, half.y)), p.y > 0.0);
  let q = abs(p) - half + vec2f(rr, rr);

  return min(max(q.x, q.y), 0.0) + length(max(q, vec2f(0.0))) - rr;
}

// shape ids match contract.mts: 0 circle, 1 ellipse, 2 rectangle,
// 3 round-rectangle, 4+ generated polygon shapes, 14 custom polygon
// (C3 — polyRef packs its blob record), 17 cut-rectangle (27.2).
// radius is the round-rectangle corner radius in device px, pre-resolved
// (B2); cut-rectangle reads the same word as its chamfer length.
fn nodeSD(shape: u32, p: vec2f, half: vec2f, radius: f32, polyRef: u32, zoomDpr: f32) -> f32 {
  switch shape {
    case 0u: { return circleSD(p, half.x); }
    case 1u: { return ellipseSD(p, half); }
    case 2u: { return rectangleSD(p, half); }
${POLY.cases}
    case ${SHAPE_POLYGON_CUSTOM}u: { return customPolySD(p, half, polyRef); }
    case ${SHAPE_CUT_RECTANGLE}u: { return cutRectangleSD(p, half, radius); }
    case ${SHAPE_BOTTOM_ROUND_RECTANGLE}u: { return bottomRoundRectangleSD(p, half, radius); }
    case ${SHAPE_BARREL}u: { return barrelSD(p, half, zoomDpr); }
    default: { return roundRectangleSD(p, half, min(radius, min(half.x, half.y))); }
  }
}

// corner-radius 'auto' (B2): v3's min(w/4, h/4, 8) in model px.
// The stored value is u16.8 fixed-point; 0xffffffff means auto.
fn cornerRadiusPx(stored: u32, half: vec2f, zoomDpr: f32) -> f32 {
  if (stored == 0xffffffffu) { return min(min(half.x, half.y) * 0.5, 8.0 * zoomDpr); }
  return f32(stored) / 256.0 * zoomDpr;
}

// The same word, resolved for cut-rectangle (27.2): v3's 'auto' chamfer
// is a flat CUT_RECTANGLE_CORNER model px, *not* round-rectangle's
// size-relative rule — the two shapes read one prop with two defaults,
// as they do in v3.  (The constant's name is spelled out rather than
// interpolated: an interpolation inside a WGSL comment is a build error
// under the round-52 comment-strip transform.)
fn cornerLengthPx(shape: u32, stored: u32, half: vec2f, zoomDpr: f32) -> f32 {
  if (stored == 0xffffffffu) {
    if (shape == ${SHAPE_CUT_RECTANGLE}u) {
      return ${CUT_RECTANGLE_CORNER}.0 * zoomDpr;
    }
    // 27.4: the round-* family's 'auto' is v3's getRoundPolygonRadius —
    // a third meaning for the one prop, as in v3
    if (shape >= ${SHAPE_ROUND_TRIANGLE}u && shape <= ${SHAPE_ROUND_TAG}u) {
      return min(
        min(half.x, half.y) * 2.0 / ${ROUND_POLYGON_RADIUS_DIV}.0,
        ${ROUND_POLYGON_RADIUS_MAX}.0 * zoomDpr);
    }
  }
  return cornerRadiusPx(stored, half, zoomDpr);
}

// border-position (B2): how far the border band extends past the shape
// boundary — 0 for inside, bw/2 for center (v3's default), bw for outside
fn borderOutward(pos: u32, bw: f32) -> f32 {
  if (pos == 1u) { return 0.0; }
  if (pos == 2u) { return bw; }
  return bw * 0.5;
}

// outline extents from the packed word (B5): (width, offset) device px
fn outlineWO(packed: u32, zoomDpr: f32) -> vec2f {
  return vec2f(f32(packed & 0xffffu), f32(packed >> 16u)) / 256.0 * zoomDpr;
}
`;

/**
 * Round 38: the arc-length coordinate for dashed borders/outlines — the
 * position along the shape outline, in device px, of the boundary point
 * nearest the fragment.  u = 0 and the walk direction match v3's canvas
 * path construction per shape, because the dash pattern's phase starts
 * where the path starts and the parity diff sees a half-period phase
 * error as anti-aligned dashes.  Only evaluated when a dash style is
 * active (the fsNode branch), so solid borders pay nothing.
 */
export const NODE_PERIM_WGSL = wgsl`
// v3's ellipse path starts at parameter 0 (the rightmost point),
// sweeping y-down positive, and the canvas dashes it by TRUE arc
// length — so this integrates the elliptic arc numerically (composite
// Simpson, 20 intervals) rather than approximating by angle.  The
// round-38 plan budgeted an angle-parameterized approximation with a
// recorded deviation; measured, that deviation was LARGER than the
// difference dashing makes at all (5.0% vs 3.6% on the parity scene —
// the scene could not discriminate), so the exact integral is what
// shipped.  Cost is dash-gated: solid borders never run this.
// Two conversions matter: the fragment's RADIAL angle is not the
// path parameter (P = (a cos t, b sin t) sits at radial angle
// atan2(b sin t, a cos t)), so t recovers via atan2(y/b, x/a).
fn ellipsePerimCoord(p: vec2f, half: vec2f) -> f32 {
  let a = half.x;
  let b = half.y;
  var t = atan2(p.y / max(b, 1e-6), p.x / max(a, 1e-6));

  // the radial estimate SHEARS across the border band (measured: +-2 px
  // of phase over a +-2.5 px band — two whole dot periods), because a
  // fragment off the boundary is not radially aligned with its nearest
  // path point.  Two Newton steps to the nearest-point parameter bring
  // the worst error to 0.003 px.
  for (var k = 0; k < 2; k++) {
    let st = sin(t);
    let ct = cos(t);
    let fx = a * ct - p.x;
    let fy = b * st - p.y;
    let f = fx * (-a * st) + fy * (b * ct);
    let fp = (a * st) * (a * st) + fx * (-a * ct) + (b * ct) * (b * ct) + fy * (-b * st);

    if (abs(fp) > 1e-9) { t = t - f / fp; }
  }

  if (t < 0.0) { t = t + 6.28318530718; }

  // 48 intervals: v3's dotted borders are [1, 1] — a 2-model-px period
  // — so the phase needs sub-half-pixel accuracy over the whole arc
  let h = t / 48.0;
  var sum = 0.0;

  for (var i = 0; i <= 48; i++) {
    let ti = h * f32(i);
    let sn = sin(ti);
    let cs = cos(ti);
    let f = sqrt(a * a * sn * sn + b * b * cs * cs);
    var w = 2.0;

    if (i == 0 || i == 48) { w = 1.0; }
    else if ((i % 2) == 1) { w = 4.0; }

    sum = sum + w * f;
  }

  return sum * h / 3.0;
}

// v3's rectangle is the 4-gon (-1,-1) (-1,1) (1,1) (1,-1): the path
// starts at the top-left corner and runs DOWN the left side first
fn rectanglePerim(p: vec2f, half: vec2f) -> f32 {
  let dl = abs(p.x + half.x);
  let dr = abs(p.x - half.x);
  let dt = abs(p.y + half.y);
  let db = abs(p.y - half.y);
  let cx = clamp(p.x, -half.x, half.x);
  let cy = clamp(p.y, -half.y, half.y);
  let m = min(min(dl, dr), min(dt, db));

  if (m == dl) { return cy + half.y; }
  if (m == db) { return 2.0 * half.y + (cx + half.x); }
  if (m == dr) { return 2.0 * half.y + 2.0 * half.x + (half.y - cy); }
  return 4.0 * half.y + 2.0 * half.x + (half.x - cx);
}

// v3's round-rectangle path starts at the TOP MIDDLE and runs clockwise
// (arcTo corners); u accumulates run - arc - side - arc - ... exactly
fn roundRectanglePerim(p: vec2f, half: vec2f, rIn: f32) -> f32 {
  let r = min(rIn, min(half.x, half.y));
  let cx = half.x - r;
  let cy = half.y - r;
  let arc = 1.57079632679 * r;
  let cum1 = cx + arc;                    // right side start
  let cum2 = cum1 + 2.0 * cy + arc;       // bottom start
  let cum3 = cum2 + 2.0 * cx + arc;       // left side start
  let cum4 = cum3 + 2.0 * cy + arc;       // top-left run start

  let qx = abs(p.x) - cx;
  let qy = abs(p.y) - cy;

  if (qx > 0.0 && qy > 0.0) {
    let phi = atan2(qy, qx); // [0, pi/2] out from the corner centre
    if (p.x >= 0.0 && p.y < 0.0) { return cx + (1.57079632679 - phi) * r; }
    if (p.x >= 0.0) { return cum1 + 2.0 * cy + phi * r; }
    if (p.y >= 0.0) { return cum2 + 2.0 * cx + (1.57079632679 - phi) * r; }
    return cum3 + 2.0 * cy + phi * r;
  }

  var vertical = qy <= 0.0;
  if (qx <= 0.0 && qy <= 0.0) { // interior: nearest side line decides
    vertical = (half.x - abs(p.x)) < (half.y - abs(p.y));
  } else if (qx <= 0.0) {
    vertical = false;
  }

  if (vertical) {
    if (p.x >= 0.0) { return cum1 + (clamp(p.y, -cy, cy) + cy); }
    return cum3 + (cy - clamp(p.y, -cy, cy));
  }
  if (p.y >= 0.0) { return cum2 + (cx - clamp(p.x, -cx, cx)); }
  // top edge: +x from the top middle; x < 0 is the closing run
  if (p.x >= 0.0) { return clamp(p.x, 0.0, cx); }
  return cum4 + (clamp(p.x, -cx, 0.0) + cx);
}

// v3's bottom-round-rectangle path: top middle, clockwise, sharp top
// corners, arcTo bottom corners
fn bottomRoundRectanglePerim(p: vec2f, half: vec2f, rIn: f32) -> f32 {
  let r = min(rIn, min(half.x, half.y));
  let cx = half.x - r;
  let cy = half.y - r;
  let arc = 1.57079632679 * r;
  let cum1 = half.x;                       // right side start (top-right corner)
  let cum2 = cum1 + (half.y + cy) + arc;   // bottom start
  let cum3 = cum2 + 2.0 * cx + arc;        // left side start
  let cum4 = cum3 + (half.y + cy);         // top-left run start

  let qx = abs(p.x) - cx;

  if (p.y > cy && qx > 0.0) { // bottom corner arcs
    let phi = atan2(p.y - cy, qx);
    if (p.x >= 0.0) { return cum1 + (half.y + cy) + phi * r; }
    return cum2 + 2.0 * cx + (1.57079632679 - phi) * r;
  }

  let dl = abs(p.x + half.x);
  let dr = abs(p.x - half.x);
  let dt = abs(p.y + half.y);
  let db = abs(p.y - half.y);
  let m = min(min(dl, dr), min(dt, db));

  if (m == dr) { return cum1 + (clamp(p.y, -half.y, cy) + half.y); }
  if (m == db) { return cum2 + (cx - clamp(p.x, -cx, cx)); }
  if (m == dl) { return cum3 + (cy - clamp(p.y, -half.y, cy)); }
  // top edge: +x from the top middle
  if (p.x >= 0.0) { return clamp(p.x, 0.0, half.x); }
  return cum4 + (clamp(p.x, -half.x, 0.0) + half.x);
}

// v3's cut-rectangle path: an octagon from (-hx+c, -hy), clockwise
fn cutRectanglePerim(p: vec2f, half: vec2f, c: f32) -> f32 {
  var v = array<vec2f, 8>(
    vec2f(-half.x + c, -half.y), vec2f(half.x - c, -half.y),
    vec2f(half.x, -half.y + c), vec2f(half.x, half.y - c),
    vec2f(half.x - c, half.y), vec2f(-half.x + c, half.y),
    vec2f(-half.x, half.y - c), vec2f(-half.x, -half.y + c));
  var best = 1e30;
  var u = 0.0;
  var cum = 0.0;
  for (var i = 0; i < 8; i++) {
    let a = v[i];
    let b = v[(i + 1) % 8];
    let e = b - a;
    let len = length(e);
    let t = clamp(dot(p - a, e) / max(dot(e, e), 1e-12), 0.0, 1.0);
    let q = a + e * t - p;
    let d = dot(q, q);
    if (d < best) { best = d; u = cum + t * len; }
    cum = cum + len;
  }
  return u;
}

// v3's barrel path: from (x0, y0 + hOff) DOWN the left side, then the
// bottom-left curve, bottom, bottom-right, right side up, top-right,
// top (right to left), top-left curve closing.  Sampled at the same
// subdivision as barrelSD so the dash follows the drawn boundary.
fn barrelPerim(p: vec2f, half: vec2f, zoomDpr: f32) -> f32 {
  let hOff = min(${BARREL_HEIGHT_OFFSET_MAX}.0 * zoomDpr, ${BARREL_HEIGHT_OFFSET_PCT} * half.y * 2.0);
  let wOff = min(${BARREL_WIDTH_OFFSET_MAX}.0 * zoomDpr, ${BARREL_WIDTH_OFFSET_PCT} * half.x * 2.0);
  let ctrl = ${BARREL_CTRL_OFFSET_PCT} * half.x * 2.0;
  let x0 = -half.x;
  let x1 = half.x;
  let y0 = -half.y;
  let y1 = half.y;

  // the four corner curves, in v3's path order and direction
  var a = array<vec2f, 4>(
    vec2f(x0, y1 - hOff), vec2f(x1 - wOff, y1), vec2f(x1, y0 + hOff), vec2f(x0 + wOff, y0));
  var c = array<vec2f, 4>(
    vec2f(x0 + ctrl, y1), vec2f(x1 - ctrl, y1), vec2f(x1 - ctrl, y0), vec2f(x0 + ctrl, y0));
  var b = array<vec2f, 4>(
    vec2f(x0 + wOff, y1), vec2f(x1, y1 - hOff), vec2f(x1 - wOff, y0), vec2f(x0, y0 + hOff));

  const N: i32 = 4 * (${BARREL_CURVE_SEGMENTS} + 1);
  var v = array<vec2f, N>();
  var k = 0;

  for (var i = 0; i < 4; i++) {
    for (var j = 0; j <= ${BARREL_CURVE_SEGMENTS}; j++) {
      let t = f32(j) / ${BARREL_CURVE_SEGMENTS}.0;
      let u2 = 1.0 - t;

      v[k] = a[i] * (u2 * u2) + c[i] * (2.0 * u2 * t) + b[i] * (t * t);
      k = k + 1;
    }
  }

  var best = 1e30;
  var u = 0.0;
  var cum = 0.0;

  for (var i = 0; i < N; i++) {
    let va = v[i];
    let vb = v[(i + 1) % N];
    let e = vb - va;
    let len = length(e);
    let t = clamp(dot(p - va, e) / max(dot(e, e), 1e-12), 0.0, 1.0);
    let q = va + e * t - p;
    let d = dot(q, q);
    if (d < best) { best = d; u = cum + t * len; }
    cum = cum + len;
  }

  return u;
}

// custom polygon (C3): the blob walk, forward in the declared point
// order (v3's drawPolygonPath direction)
fn customPolyPerim(p: vec2f, half: vec2f, polyRef: u32) -> f32 {
  let off = polyRef & 0xffffffu;
  let count = polyRef >> 24u;

  if (count < 3u) { return 0.0; }

  var best = 1e30;
  var u = 0.0;
  var cum = 0.0;

  for (var i = 0u; i < count; i = i + 1u) {
    let j = (i + 1u) % count;
    let a = vec2f(polyBlob[off + i * 2u], polyBlob[off + i * 2u + 1u]) * half;
    let b = vec2f(polyBlob[off + j * 2u], polyBlob[off + j * 2u + 1u]) * half;
    let e = b - a;
    let len = length(e);
    let t = clamp(dot(p - a, e) / max(dot(e, e), 1e-12), 0.0, 1.0);
    let q = a + e * t - p;
    let d = dot(q, q);
    if (d < best) { best = d; u = cum + t * len; }
    cum = cum + len;
  }

  return u;
}
${POLY.perimFns}
fn perimeterCoord(shape: u32, p: vec2f, half: vec2f, radius: f32, polyRef: u32, zoomDpr: f32) -> f32 {
  switch shape {
    case 0u, 1u: { return ellipsePerimCoord(p, half); }
    case 2u: { return rectanglePerim(p, half); }
${POLY.perimCases}
    case ${SHAPE_POLYGON_CUSTOM}u: { return customPolyPerim(p, half, polyRef); }
    case ${SHAPE_CUT_RECTANGLE}u: { return cutRectanglePerim(p, half, radius); }
    case ${SHAPE_BOTTOM_ROUND_RECTANGLE}u: { return bottomRoundRectanglePerim(p, half, radius); }
    case ${SHAPE_BARREL}u: { return barrelPerim(p, half, zoomDpr); }
    default: { return roundRectanglePerim(p, half, radius); }
  }
}
`;
