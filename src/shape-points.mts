import {
  fitPolygonToSquare,
  generateUnitNgonPoints,
  generateUnitNgonPointsFitToSquare,
} from './math.mjs';
import {
  ARROW_BACKCURVE_SEGMENTS,
  ARROW_CHEVRON,
  ARROW_CIRCLE,
  ARROW_CIRCLE_TRIANGLE,
  ARROW_CIRCLE_TRIANGLE_RADIUS,
  ARROW_DIAMOND,
  ARROW_NONE,
  ARROW_SQUARE,
  ARROW_TEE,
  ARROW_TRIANGLE,
  ARROW_TRIANGLE_BACKCURVE,
  ARROW_TRIANGLE_CROSS,
  ARROW_TRIANGLE_TEE,
  ARROW_VEE,
  SHAPE_CONCAVE_HEXAGON,
  SHAPE_DIAMOND,
  SHAPE_HEPTAGON,
  SHAPE_HEXAGON,
  SHAPE_OCTAGON,
  SHAPE_PENTAGON,
  SHAPE_RHOMBOID,
  SHAPE_RIGHT_RHOMBOID,
  SHAPE_ROUND_DIAMOND,
  SHAPE_ROUND_HEPTAGON,
  SHAPE_ROUND_HEXAGON,
  SHAPE_ROUND_OCTAGON,
  SHAPE_ROUND_PENTAGON,
  SHAPE_ROUND_TAG,
  SHAPE_ROUND_TRIANGLE,
  SHAPE_STAR,
  SHAPE_TAG,
  SHAPE_TRIANGLE,
  SHAPE_VEE,
} from './contract.mjs';

/*
Unit polygon points per shape id, in the [-1, 1] square — the same tables
v3's node-shapes registration builds (via the shared math generators, so
the geometry is identical).  Both consumers evaluate in *normalized* space
(point / half-size): the WGSL SDF (shaders.mts bakes these points into
per-shape functions, scaling the normalized distance by min(half) — sign
exact, AA-fringe width approximate under anisotropy) and the CPU pick
(point-in-polygon, exact — inside-ness is affine-invariant).
*/

const star5 = (): number[] => {
  const points = new Array<number>(20);
  const outerPoints = generateUnitNgonPoints(5, 0);
  const innerPoints = generateUnitNgonPoints(5, Math.PI / 5);

  // outer radius 1; the star's inner radius is smaller (v3's constant)
  const innerRadius = 0.5 * (3 - Math.sqrt(5)) * 1.57;

  for (let i = 0; i < innerPoints.length / 2; i++) {
    innerPoints[i * 2] *= innerRadius;
    innerPoints[i * 2 + 1] *= innerRadius;
  }

  for (let i = 0; i < 5; i++) {
    points[i * 4] = outerPoints[i * 2];
    points[i * 4 + 1] = outerPoints[i * 2 + 1];
    points[i * 4 + 2] = innerPoints[i * 2];
    points[i * 4 + 3] = innerPoints[i * 2 + 1];
  }

  return fitPolygonToSquare(points);
};

/**
 * v3's triangle-backcurve as a flat point list: the tip, the right base
 * corner, then the quadratic base sampled back to the left corner.
 */
const backcurvePoints = (): number[] => {
  const pts = [0, 0, 0.15, -0.3];
  const [ax, ay] = [0.15, -0.3];
  const [cx, cy] = [0, -0.15]; // v3's controlPoint
  const [bx, by] = [-0.15, -0.3];

  for (let i = 1; i <= ARROW_BACKCURVE_SEGMENTS; i++) {
    const t = i / ARROW_BACKCURVE_SEGMENTS;
    const u = 1 - t;

    pts.push(
      ax * u * u + cx * 2 * u * t + bx * t * t,
      ay * u * u + cy * 2 * u * t + by * t * t,
    );
  }

  return pts;
};

/**
 * Arrowheads that are a *union* of two disjoint parts (round 27.6), as
 * flat point lists.  Coverage is a smoothstep over the distance, so a
 * union is `min( sdA, sdB )` — the parts need no stitching.
 * `circle-triangle`'s disc is analytic and lives in the shader.
 */
export const ARROW_COMPOUND_POINTS: ReadonlyMap<
  number,
  readonly (readonly number[])[]
> = new Map([
  [
    ARROW_TRIANGLE_TEE,
    [
      [0, 0, 0.15, -0.3, -0.15, -0.3],
      [-0.15, -0.4, -0.15, -0.5, 0.15, -0.5, 0.15, -0.4],
    ],
  ],
  // v3's `pointsTr`, verbatim.  Until round 56 this table was shifted
  // 0.15 back and the disc centre with it, to bake in the shape's
  // `spacing` without any runtime offset logic.  That was exact, but it
  // made `spacing` mean two different things — zero to the renderer,
  // v3's value to the accessors — and the endpoint accessors have to
  // report v3's.  56 applies `spacing` to the *tip* for every shape
  // instead, so one table serves both and the arrow frame is v3's.
  [ARROW_CIRCLE_TRIANGLE, [[0, -0.15, 0.15, -0.45, -0.15, -0.45]]],
  [ARROW_TRIANGLE_CROSS, [[0, 0, 0.15, -0.3, -0.15, -0.3]]],
]);

/** shape id → flat [x0, y0, x1, y1, ...] unit points (matching v3's tables) */
export const POLYGON_POINTS: ReadonlyMap<number, readonly number[]> = new Map([
  [SHAPE_TRIANGLE, generateUnitNgonPointsFitToSquare(3, 0)],
  [SHAPE_PENTAGON, generateUnitNgonPointsFitToSquare(5, 0)],
  [SHAPE_HEXAGON, generateUnitNgonPointsFitToSquare(6, 0)],
  [SHAPE_HEPTAGON, generateUnitNgonPointsFitToSquare(7, 0)],
  [SHAPE_OCTAGON, generateUnitNgonPointsFitToSquare(8, 0)],
  [SHAPE_DIAMOND, [0, 1, 1, 0, 0, -1, -1, 0]],
  [SHAPE_RHOMBOID, [-1, -1, 0.333, -1, 1, 1, -0.333, 1]],
  [SHAPE_VEE, [-1, -1, 0, -0.333, 1, -1, 0, 1]],
  [SHAPE_STAR, star5()],
  [SHAPE_TAG, [-1, -1, 0.25, -1, 1, 0, 0.25, 1, -1, 1]],
  // round 27.2 — v3's tables verbatim.  right-rhomboid slants the other
  // way from `rhomboid`; concave-hexagon's waist is the mid-side pair
  // pulled inward to ±0.75.
  [SHAPE_RIGHT_RHOMBOID, [-0.333, -1, 1, -1, 0.333, 1, -1, 1]],
  [
    SHAPE_CONCAVE_HEXAGON,
    [-1, -0.95, -0.75, 0, -1, 0.95, 1, 0.95, 0.75, 0, 1, -0.95],
  ],
]);

/**
 * Round-corner shape id → the sharp shape whose point table it reuses
 * (round 27.4).  v3 registers `round-pentagon` from the same
 * `generateUnitNgonPointsFitToSquare( 5, 0 )` as `pentagon`, and so on,
 * so the family costs one shared rounded-polygon SDF rather than seven
 * new tables.
 */
export const ROUND_POLYGON_SOURCE: ReadonlyMap<number, number> = new Map([
  [SHAPE_ROUND_TRIANGLE, SHAPE_TRIANGLE],
  [SHAPE_ROUND_DIAMOND, SHAPE_DIAMOND],
  [SHAPE_ROUND_PENTAGON, SHAPE_PENTAGON],
  [SHAPE_ROUND_HEXAGON, SHAPE_HEXAGON],
  [SHAPE_ROUND_HEPTAGON, SHAPE_HEPTAGON],
  [SHAPE_ROUND_OCTAGON, SHAPE_OCTAGON],
  [SHAPE_ROUND_TAG, SHAPE_TAG],
]);

/**
 * The unit point table a shape draws from, following the round-corner
 * indirection.
 *
 * @param shape — a shape id
 * @returns the flat unit point list, or undefined for shapes that are
 *   not polygon-backed (circle, the rectangles, custom polygons)
 */
export const pointsForShape = (
  shape: number,
): readonly number[] | undefined => {
  return POLYGON_POINTS.get(ROUND_POLYGON_SOURCE.get(shape) ?? shape);
};

/**
 * Arrowhead polygon points per ARROW_* id, in v3's arrow frame: the tip at
 * (0, 0), the body extending toward negative y, lateral extent ±0.15 —
 * exactly v3's arrow-shapes tables.  ARROW_CIRCLE is analytic (radius 0.15
 * centered at (0, -0.15)) and has no entry here.
 */
export const ARROW_POINTS: ReadonlyMap<number, readonly number[]> = new Map([
  [ARROW_TRIANGLE, [-0.15, -0.3, 0, 0, 0.15, -0.3]],
  [ARROW_VEE, [-0.15, -0.3, 0, 0, 0.15, -0.3, 0, -0.15]],
  [
    ARROW_CHEVRON,
    [0, 0, -0.15, -0.15, -0.1, -0.2, 0, -0.1, 0.1, -0.2, 0.15, -0.15],
  ],
  [ARROW_SQUARE, [-0.15, 0, 0.15, 0, 0.15, -0.3, -0.15, -0.3]],
  [ARROW_DIAMOND, [-0.15, -0.15, 0, -0.3, 0.15, -0.15, 0, 0]],
  [ARROW_TEE, [-0.15, 0, -0.15, -0.1, 0.15, -0.1, 0.15, 0]],
  // round 27.6: triangle-backcurve is v3's triangle with its base edge
  // drawn as a quadratic through the control point (0, -0.15).  Sampling
  // that curve at codegen turns it into an ordinary point table, so it
  // needs no per-fragment curve maths and no new SDF — the same finding
  // round 27.5 measured for barrel.
  [ARROW_TRIANGLE_BACKCURVE, backcurvePoints()],
]);

/**
 * How far behind the tip any arrowhead reaches, in arrow-frame units —
 * the max over every table, compound parts included.
 *
 * The arrow quad is sized from this.  Before round 27.6 it was hardcoded
 * to 0.3, which was the max over the *simple* heads; the compound ones
 * reach 0.5 (triangle-tee) and 0.6 (the shifted circle-triangle), so
 * they drew clipped until this became a computed bound.  Deriving it
 * keeps the next added head from repeating that.
 */
export const ARROW_MAX_BACK: number = (() => {
  let max = 0;

  const scan = (pts: readonly number[]): void => {
    for (let i = 1; i < pts.length; i += 2) {
      max = Math.max(max, -pts[i]);
    }
  };

  for (const pts of ARROW_POINTS.values()) {
    scan(pts);
  }
  for (const parts of ARROW_COMPOUND_POINTS.values()) {
    for (const pts of parts) {
      scan(pts);
    }
  }

  // the analytic circle reaches 2 x its radius behind the tip
  return Math.max(max, 2 * ARROW_CIRCLE_TRIANGLE_RADIUS);
})();

/**
 * How far **in front of** the tip any arrowhead reaches, in arrow-frame
 * units (round 56).
 *
 * Zero for every polygon head — v3's tables all sit at y <= 0 — and
 * `ARROW_CIRCLE_TRIANGLE_RADIUS` for the two disc heads, whose circle is
 * centred on the arrow origin and so reaches a radius *past* it.  That
 * is exactly compensated by the `spacing` those heads carry, but the
 * arrow quad is built in the arrow frame and has to cover it.
 *
 * The pair with `ARROW_MAX_BACK` exists for the same reason that one is
 * computed rather than hardcoded (round 27.6 shipped clipped compound
 * heads behind a hardcoded 0.3): a new head with a forward extent must
 * grow the quad without anyone remembering to.
 */
export const ARROW_MAX_FRONT: number = (() => {
  let max = 0;

  const scan = (pts: readonly number[]): void => {
    for (let i = 1; i < pts.length; i += 2) {
      max = Math.max(max, pts[i]);
    }
  };

  for (const pts of ARROW_POINTS.values()) {
    scan(pts);
  }
  for (const parts of ARROW_COMPOUND_POINTS.values()) {
    for (const pts of parts) {
      scan(pts);
    }
  }

  // the disc heads are centred on the origin, so they reach a radius forward
  return Math.max(max, ARROW_CIRCLE_TRIANGLE_RADIUS);
})();

/**
 * How far behind the tip **each** arrowhead reaches, in arrow-frame
 * units — `ARROW_MAX_BACK` per shape rather than the max over all of
 * them (round 55).
 *
 * The global max sizes the arrow quad, where over-sizing costs a few
 * transparent fragments.  This one decides where the *edge line* stops,
 * where over-shortening would leave a visible gap between the line and
 * the head, so it has to be per shape.
 */
export const ARROW_BACK: ReadonlyMap<number, number> = (() => {
  const back = new Map<number, number>();

  const scan = (pts: readonly number[]): number => {
    let max = 0;

    for (let i = 1; i < pts.length; i += 2) {
      max = Math.max(max, -pts[i]);
    }

    return max;
  };

  for (const [id, pts] of ARROW_POINTS) {
    back.set(id, scan(pts));
  }

  for (const [id, parts] of ARROW_COMPOUND_POINTS) {
    let max = 0;

    for (const pts of parts) {
      max = Math.max(max, scan(pts));
    }

    back.set(id, max);
  }

  back.set(ARROW_NONE, 0);
  // analytic, so it has no point table: the disc is centred a radius
  // behind the tip and reaches a radius further again
  back.set(ARROW_CIRCLE, 2 * ARROW_CIRCLE_TRIANGLE_RADIUS);

  return back;
})();

/**
 * v3's `arrowShapes[shape].gap(edge)` as a multiple of
 * `width x arrow-scale` (round 55).
 *
 * Read through `arrowGap` below rather than directly.  Round 55 verified
 * these constants and round 56 wired them up: `edge.width` lane 1 carries
 * the arrow word to the edge vertex stages, which shorten the line, and
 * `shaders.mts` generates its WGSL twin of `arrowGap` from these same
 * tables so there is one source of truth rather than two.
 *
 * v3 keeps two shortened endpoints per edge end: the arrow tip at
 * `spacing(edge)` behind the node boundary, and the *drawn line's* end at
 * `gap(edge)` behind it.  v4 had neither, which is why its line ran to
 * the node centre and spilled around the tip.
 *
 * Transcribed from `v3/src/extensions/renderer/base/arrow-shapes.mts`,
 * where the default is `standardGap = width x arrow-scale x 2` and only
 * these five shapes override it.  `tee` is the one shape whose gap is not
 * a multiple of anything — a constant 1 px — so it lives in
 * `ARROW_GAP_CONST` instead.
 *
 * **Verified against v3's own functions**, not just read off the source.
 * v3's `registerArrowShapes` only touches `this.arrowShapes` and
 * `this.arrowShapeWidth`, so calling it on a bare object with a
 * `getArrowWidth` stub yields the real table.  At `width: 5`,
 * `arrow-scale: 1.5` (2026-08-06):
 *
 *     shape                 gap   spacing   gap / (w x s)
 *     none               0.0000    0.0000          0.0000
 *     triangle          15.0000    0.0000          2.0000
 *     triangle-backcurve 12.0000   0.0000          1.6000
 *     triangle-tee      15.0000    0.0000          2.0000
 *     circle-triangle   15.0000    9.8804          2.0000
 *     triangle-cross    15.0000    0.0000          2.0000
 *     vee                7.8750    0.0000          1.0500
 *     circle            15.0000    9.8804          2.0000
 *     tee                1.0000    1.0000          (constant)
 *     square            15.0000    0.0000          2.0000
 *     diamond            7.5000    0.0000          1.0000
 *     chevron            7.1250    0.0000          0.9500
 *
 * The routing harness reaches the same 9.8804 for `circle` from the
 * other direction — it measures v3's rendered endpoint — so the spacing
 * column has two independent confirmations.
 *
 * The twin is not a spec, deliberately: importing v3's arrow-shapes pulls
 * `v3/src/util/index.mjs`, which imports `lodash/debounce`, and the Node
 * tier is required to run from a root-only install (AGENTS.md; it is what
 * round 53's `ci-node` split protects).  The behavioural gate is the
 * `parity-arrow-*` scenes: a wrong constant here moves their ratios.
 */
export const ARROW_GAP_K: ReadonlyMap<number, number> = new Map([
  [ARROW_NONE, 0],
  [ARROW_VEE, 1.05], // v3: standardGap x 0.525
  [ARROW_TRIANGLE_BACKCURVE, 1.6], // v3: standardGap x 0.8
  [ARROW_DIAMOND, 1], // v3: width x scale, not doubled
  [ARROW_CHEVRON, 0.95],
]);

/** v3's default gap: `width x arrow-scale x 2`. */
export const ARROW_GAP_K_DEFAULT = 2;

/** Shapes whose gap is a constant in model px rather than width-scaled. */
export const ARROW_GAP_CONST: ReadonlyMap<number, number> = new Map([
  [ARROW_TEE, 1],
]);

/**
 * v3's `getArrowWidth( width, scale )` — the arrowhead's size unit in
 * **model** px, before any device scaling.
 *
 * Evaluating in model space is load-bearing and was round 27.3's finding:
 * the 29 is a model-space floor, so applying the power law to a
 * LOD-floored *device* width would make arrows grow as you zoom out.
 *
 * @param width — the edge width in model px
 * @param scale — the edge's `arrow-scale`
 * @returns the size unit v3's arrow point tables are multiplied by
 */
export const arrowSizeModel = (width: number, scale: number): number =>
  Math.max(Math.pow(width * 13.37, 0.9), 29) * scale;

/**
 * v3's `arrowShapes[shape].gap( edge )` — how far behind the node
 * boundary, along the edge, the **drawn line** stops.
 *
 * @param shape — an ARROW_* id
 * @param width — the edge width in model px
 * @param scale — the edge's `arrow-scale`
 * @returns the gap in model px (0 for `none`)
 */
export const arrowGap = (
  shape: number,
  width: number,
  scale: number,
): number => {
  const constant = ARROW_GAP_CONST.get(shape);

  if (constant != null) {
    return constant;
  }

  return (ARROW_GAP_K.get(shape) ?? ARROW_GAP_K_DEFAULT) * width * scale;
};

/**
 * v3's `arrowShapes[shape].spacing( edge )` — how far behind the node
 * boundary the arrow **tip** sits.
 *
 * Non-zero for exactly three heads: `tee` by a constant 1 px, and the
 * two disc-bearing heads by their radius, so that the *disc* touches the
 * boundary rather than its centre sitting on it.
 *
 * @param shape — an ARROW_* id
 * @param width — the edge width in model px
 * @param scale — the edge's `arrow-scale`
 * @returns the spacing in model px
 */
export const arrowSpacing = (
  shape: number,
  width: number,
  scale: number,
): number => {
  if (shape === ARROW_TEE) {
    return 1;
  }

  if (shape === ARROW_CIRCLE || shape === ARROW_CIRCLE_TRIANGLE) {
    return arrowSizeModel(width, scale) * ARROW_CIRCLE_TRIANGLE_RADIUS;
  }

  return 0;
};

/**
 * Even-odd point-in-polygon over a flat unit point list.  The shapes above
 * are simple (non-self-intersecting) polygons, so even-odd agrees with
 * nonzero winding — and with the WGSL SDF's sign.
 */
export const insideUnitPolygon = (
  points: ArrayLike<number>,
  x: number,
  y: number,
): boolean => {
  const n = points.length / 2;
  let inside = false;

  for (let i = 0, j = n - 1; i < n; j = i, i++) {
    const xi = points[i * 2],
      yi = points[i * 2 + 1];
    const xj = points[j * 2],
      yj = points[j * 2 + 1];

    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }

  return inside;
};

/**
 * How far back from the tip a head covers the edge's **axis**
 * continuously, in arrow-frame units (round 56).
 *
 * This is the quantity the *drawn* line is trimmed to, and it is not
 * `ARROW_BACK`.  v3 does not trim at all — it paints the line in full and
 * then erases the head's footprint out of the canvas
 * (`globalCompositeOperation = 'destination-out'`), so what a viewer sees
 * is the line minus the head's shape.  v4 reproduces that by stopping the
 * line instead, which costs no second pass — but a trim is a single
 * distance, so it can only reproduce the erase where the head covers the
 * line *contiguously from the tip*.
 *
 * For the convex heads that is the whole head and this equals
 * `ARROW_BACK`.  For the concave ones it is strictly less, and using
 * `ARROW_BACK` there would be a visible over-trim rather than a
 * conservative one:
 *
 *   - `vee` is a notch — on the axis the polygon stops at 0.15 while the
 *     arms run back to 0.3, and v3 shows the line *through* the notch.
 *   - `chevron` likewise, at 0.1.
 *   - `triangle-tee` and `triangle-cross` carry a detached bar behind a
 *     gap, so the contiguous depth is the triangle's 0.3, not the bar's.
 *
 * Computed by walking the axis rather than declared, for the reason
 * round 27.6 made `ARROW_MAX_BACK` computed: a hand-written table is a
 * silent clip (or a silent over-trim) the next time a head is added.
 */
export const ARROW_AXIAL_DEPTH: ReadonlyMap<number, number> = (() => {
  const depth = new Map<number, number>();
  const STEP = 1 / 2048;

  /** is the axis point (0, -k) inside any part of this head? */
  const covered = (id: number, k: number): boolean => {
    if (id === ARROW_CIRCLE || id === ARROW_CIRCLE_TRIANGLE) {
      // the disc is centred on the arrow origin (v3's frame)
      if (k <= ARROW_CIRCLE_TRIANGLE_RADIUS) {
        return true;
      }
    }

    const simple = ARROW_POINTS.get(id);

    if (simple != null && insideUnitPolygon(simple, 0, -k)) {
      return true;
    }

    const parts = ARROW_COMPOUND_POINTS.get(id);

    if (parts != null) {
      for (const pts of parts) {
        if (insideUnitPolygon(pts, 0, -k)) {
          return true;
        }
      }
    }

    return false;
  };

  const ids = new Set<number>([
    ...ARROW_POINTS.keys(),
    ...ARROW_COMPOUND_POINTS.keys(),
    ARROW_CIRCLE,
  ]);

  for (const id of ids) {
    let k = 0;

    // walk out from just inside the tip until the axis leaves the shape
    while (k < ARROW_MAX_BACK && covered(id, k + STEP)) {
      k += STEP;
    }

    // then bisect the last step, so the answer is the true boundary and
    // not the sampling grid — half a step of under-trim is a hairline of
    // line left showing inside a hollow head, which is the whole defect
    let lo = k;
    let hi = Math.min(k + STEP, ARROW_MAX_BACK);

    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;

      if (covered(id, mid)) {
        lo = mid;
      } else {
        hi = mid;
      }
    }

    depth.set(id, lo);
  }

  depth.set(ARROW_NONE, 0);

  return depth;
})();
