import {
  fitPolygonToSquare, generateUnitNgonPoints, generateUnitNgonPointsFitToSquare
} from './math.mjs';
import {
  ARROW_BACKCURVE_SEGMENTS, ARROW_CHEVRON, ARROW_CIRCLE, ARROW_CIRCLE_TRIANGLE,
  ARROW_CIRCLE_TRIANGLE_RADIUS, ARROW_DIAMOND, ARROW_NONE,
  ARROW_SQUARE, ARROW_TEE, ARROW_TRIANGLE, ARROW_TRIANGLE_BACKCURVE,
  ARROW_TRIANGLE_CROSS, ARROW_TRIANGLE_TEE, ARROW_VEE,
  SHAPE_CONCAVE_HEXAGON, SHAPE_DIAMOND, SHAPE_HEPTAGON, SHAPE_HEXAGON,
  SHAPE_OCTAGON, SHAPE_PENTAGON, SHAPE_RHOMBOID, SHAPE_RIGHT_RHOMBOID,
  SHAPE_ROUND_DIAMOND, SHAPE_ROUND_HEPTAGON, SHAPE_ROUND_HEXAGON,
  SHAPE_ROUND_OCTAGON, SHAPE_ROUND_PENTAGON, SHAPE_ROUND_TAG,
  SHAPE_ROUND_TRIANGLE,
  SHAPE_STAR, SHAPE_TAG, SHAPE_TRIANGLE, SHAPE_VEE
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
  const points = new Array<number>( 20 );
  const outerPoints = generateUnitNgonPoints( 5, 0 );
  const innerPoints = generateUnitNgonPoints( 5, Math.PI / 5 );

  // outer radius 1; the star's inner radius is smaller (v3's constant)
  const innerRadius = 0.5 * ( 3 - Math.sqrt( 5 ) ) * 1.57;

  for( let i = 0; i < innerPoints.length / 2; i++ ){
    innerPoints[ i * 2 ] *= innerRadius;
    innerPoints[ i * 2 + 1 ] *= innerRadius;
  }

  for( let i = 0; i < 5; i++ ){
    points[ i * 4 ] = outerPoints[ i * 2 ];
    points[ i * 4 + 1 ] = outerPoints[ i * 2 + 1 ];
    points[ i * 4 + 2 ] = innerPoints[ i * 2 ];
    points[ i * 4 + 3 ] = innerPoints[ i * 2 + 1 ];
  }

  return fitPolygonToSquare( points );
};

/**
 * v3's triangle-backcurve as a flat point list: the tip, the right base
 * corner, then the quadratic base sampled back to the left corner.
 */
const backcurvePoints = (): number[] => {
  const pts = [ 0, 0, 0.15, -0.3 ];
  const [ ax, ay ] = [ 0.15, -0.3 ];
  const [ cx, cy ] = [ 0, -0.15 ]; // v3's controlPoint
  const [ bx, by ] = [ -0.15, -0.3 ];

  for( let i = 1; i <= ARROW_BACKCURVE_SEGMENTS; i++ ){
    const t = i / ARROW_BACKCURVE_SEGMENTS;
    const u = 1 - t;

    pts.push(
      ax * u * u + cx * 2 * u * t + bx * t * t,
      ay * u * u + cy * 2 * u * t + by * t * t
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
export const ARROW_COMPOUND_POINTS: ReadonlyMap<number, readonly ( readonly number[] )[]> = new Map( [
  [ ARROW_TRIANGLE_TEE, [
    [ 0, 0, 0.15, -0.3, -0.15, -0.3 ],
    [ -0.15, -0.4, -0.15, -0.5, 0.15, -0.5, 0.15, -0.4 ]
  ] ],
  // v3 pulls circle-triangle back by its circle radius (the shape's
  // `spacing`), so the *disc* touches the node boundary rather than the
  // disc's centre sitting on it.  Baking that 0.15 shift into the points
  // (and into the disc centre in the shader) makes it exact with no
  // runtime spacing logic — the only head v3 offsets at all.
  [ ARROW_CIRCLE_TRIANGLE, [
    [ 0, -0.3, 0.15, -0.6, -0.15, -0.6 ]
  ] ],
  [ ARROW_TRIANGLE_CROSS, [
    [ 0, 0, 0.15, -0.3, -0.15, -0.3 ]
  ] ]
] );

/** shape id → flat [x0, y0, x1, y1, ...] unit points (matching v3's tables) */
export const POLYGON_POINTS: ReadonlyMap<number, readonly number[]> = new Map( [
  [ SHAPE_TRIANGLE, generateUnitNgonPointsFitToSquare( 3, 0 ) ],
  [ SHAPE_PENTAGON, generateUnitNgonPointsFitToSquare( 5, 0 ) ],
  [ SHAPE_HEXAGON, generateUnitNgonPointsFitToSquare( 6, 0 ) ],
  [ SHAPE_HEPTAGON, generateUnitNgonPointsFitToSquare( 7, 0 ) ],
  [ SHAPE_OCTAGON, generateUnitNgonPointsFitToSquare( 8, 0 ) ],
  [ SHAPE_DIAMOND, [ 0, 1, 1, 0, 0, -1, -1, 0 ] ],
  [ SHAPE_RHOMBOID, [ -1, -1, 0.333, -1, 1, 1, -0.333, 1 ] ],
  [ SHAPE_VEE, [ -1, -1, 0, -0.333, 1, -1, 0, 1 ] ],
  [ SHAPE_STAR, star5() ],
  [ SHAPE_TAG, [ -1, -1, 0.25, -1, 1, 0, 0.25, 1, -1, 1 ] ],
  // round 27.2 — v3's tables verbatim.  right-rhomboid slants the other
  // way from `rhomboid`; concave-hexagon's waist is the mid-side pair
  // pulled inward to ±0.75.
  [ SHAPE_RIGHT_RHOMBOID, [ -0.333, -1, 1, -1, 0.333, 1, -1, 1 ] ],
  [ SHAPE_CONCAVE_HEXAGON,
    [ -1, -0.95, -0.75, 0, -1, 0.95, 1, 0.95, 0.75, 0, 1, -0.95 ] ]
] );

/**
 * Round-corner shape id → the sharp shape whose point table it reuses
 * (round 27.4).  v3 registers `round-pentagon` from the same
 * `generateUnitNgonPointsFitToSquare( 5, 0 )` as `pentagon`, and so on,
 * so the family costs one shared rounded-polygon SDF rather than seven
 * new tables.
 */
export const ROUND_POLYGON_SOURCE: ReadonlyMap<number, number> = new Map( [
  [ SHAPE_ROUND_TRIANGLE, SHAPE_TRIANGLE ],
  [ SHAPE_ROUND_DIAMOND, SHAPE_DIAMOND ],
  [ SHAPE_ROUND_PENTAGON, SHAPE_PENTAGON ],
  [ SHAPE_ROUND_HEXAGON, SHAPE_HEXAGON ],
  [ SHAPE_ROUND_HEPTAGON, SHAPE_HEPTAGON ],
  [ SHAPE_ROUND_OCTAGON, SHAPE_OCTAGON ],
  [ SHAPE_ROUND_TAG, SHAPE_TAG ]
] );

/**
 * The unit point table a shape draws from, following the round-corner
 * indirection.
 *
 * @param shape — a shape id
 * @returns the flat unit point list, or undefined for shapes that are
 *   not polygon-backed (circle, the rectangles, custom polygons)
 */
export const pointsForShape = ( shape: number ): readonly number[] | undefined => {
  return POLYGON_POINTS.get( ROUND_POLYGON_SOURCE.get( shape ) ?? shape );
};

/**
 * Arrowhead polygon points per ARROW_* id, in v3's arrow frame: the tip at
 * (0, 0), the body extending toward negative y, lateral extent ±0.15 —
 * exactly v3's arrow-shapes tables.  ARROW_CIRCLE is analytic (radius 0.15
 * centered at (0, -0.15)) and has no entry here.
 */
export const ARROW_POINTS: ReadonlyMap<number, readonly number[]> = new Map( [
  [ ARROW_TRIANGLE, [ -0.15, -0.3, 0, 0, 0.15, -0.3 ] ],
  [ ARROW_VEE, [ -0.15, -0.3, 0, 0, 0.15, -0.3, 0, -0.15 ] ],
  [ ARROW_CHEVRON, [ 0, 0, -0.15, -0.15, -0.1, -0.2, 0, -0.1, 0.1, -0.2, 0.15, -0.15 ] ],
  [ ARROW_SQUARE, [ -0.15, 0, 0.15, 0, 0.15, -0.3, -0.15, -0.3 ] ],
  [ ARROW_DIAMOND, [ -0.15, -0.15, 0, -0.3, 0.15, -0.15, 0, 0 ] ],
  [ ARROW_TEE, [ -0.15, 0, -0.15, -0.1, 0.15, -0.1, 0.15, 0 ] ],
  // round 27.6: triangle-backcurve is v3's triangle with its base edge
  // drawn as a quadratic through the control point (0, -0.15).  Sampling
  // that curve at codegen turns it into an ordinary point table, so it
  // needs no per-fragment curve maths and no new SDF — the same finding
  // round 27.5 measured for barrel.
  [ ARROW_TRIANGLE_BACKCURVE, backcurvePoints() ]
] );

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
export const ARROW_MAX_BACK: number = ( () => {
  let max = 0;

  const scan = ( pts: readonly number[] ): void => {
    for( let i = 1; i < pts.length; i += 2 ){ max = Math.max( max, -pts[ i ] ); }
  };

  for( const pts of ARROW_POINTS.values() ){ scan( pts ); }
  for( const parts of ARROW_COMPOUND_POINTS.values() ){ for( const pts of parts ){ scan( pts ); } }

  // the analytic circle reaches 2 x its radius behind the tip
  return Math.max( max, 2 * ARROW_CIRCLE_TRIANGLE_RADIUS );
} )();

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
export const ARROW_BACK: ReadonlyMap<number, number> = ( () => {
  const back = new Map<number, number>();

  const scan = ( pts: readonly number[] ): number => {
    let max = 0;

    for( let i = 1; i < pts.length; i += 2 ){ max = Math.max( max, -pts[ i ] ); }

    return max;
  };

  for( const [ id, pts ] of ARROW_POINTS ){ back.set( id, scan( pts ) ); }

  for( const [ id, parts ] of ARROW_COMPOUND_POINTS ){
    let max = 0;

    for( const pts of parts ){ max = Math.max( max, scan( pts ) ); }

    back.set( id, max );
  }

  back.set( ARROW_NONE, 0 );
  // analytic, so it has no point table: the disc is centred a radius
  // behind the tip and reaches a radius further again
  back.set( ARROW_CIRCLE, 2 * ARROW_CIRCLE_TRIANGLE_RADIUS );

  return back;
} )();

/**
 * v3's `arrowShapes[shape].gap(edge)` as a multiple of
 * `width x arrow-scale` (round 55).
 *
 * **Not yet wired to anything.**  These three tables are the verified
 * data half of round 55's fix 3; the plumbing that would consume them —
 * widening `edge.width` to carry the arrow record so the edge vertex
 * shaders can derive a trim — is the half that did not land.  See
 * PLAN.md's round-55 record.  Until then v4 draws no gap at all, and the
 * `parity-arrow-*` scenes are marked `test.fail()` for exactly that.
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
export const ARROW_GAP_K: ReadonlyMap<number, number> = new Map( [
  [ ARROW_NONE, 0 ],
  [ ARROW_VEE, 1.05 ],                 // v3: standardGap x 0.525
  [ ARROW_TRIANGLE_BACKCURVE, 1.6 ],   // v3: standardGap x 0.8
  [ ARROW_DIAMOND, 1 ],                // v3: width x scale, not doubled
  [ ARROW_CHEVRON, 0.95 ]
] );

/** v3's default gap: `width x arrow-scale x 2`. */
export const ARROW_GAP_K_DEFAULT = 2;

/** Shapes whose gap is a constant in model px rather than width-scaled. */
export const ARROW_GAP_CONST: ReadonlyMap<number, number> = new Map( [
  [ ARROW_TEE, 1 ]
] );

/**
 * v3's `arrowShapes[shape].spacing(edge)` — how far behind the node
 * boundary the arrow *tip* sits, in model px.
 *
 * Only `tee` needs an entry.  v3 also gives `circle` and
 * `circle-triangle` a spacing of `getArrowWidth x 0.15`, but v4's SDFs
 * for both are authored with the disc already shifted a radius behind
 * the tip (`ARROW_CIRCLE_TRIANGLE_RADIUS`), so applying the spacing again
 * would double it.  A comment in this file used to claim circle-triangle
 * was the only head v3 offsets at all; it is not, and `tee` being missed
 * was a real 1 model px placement error.
 */
export const ARROW_SPACING_CONST: ReadonlyMap<number, number> = new Map( [
  [ ARROW_TEE, 1 ]
] );


/**
 * Even-odd point-in-polygon over a flat unit point list.  The shapes above
 * are simple (non-self-intersecting) polygons, so even-odd agrees with
 * nonzero winding — and with the WGSL SDF's sign.
 */
export const insideUnitPolygon = ( points: ArrayLike<number>, x: number, y: number ): boolean => {
  const n = points.length / 2;
  let inside = false;

  for( let i = 0, j = n - 1; i < n; j = i, i++ ){
    const xi = points[ i * 2 ], yi = points[ i * 2 + 1 ];
    const xj = points[ j * 2 ], yj = points[ j * 2 + 1 ];

    if( ( yi > y ) !== ( yj > y ) && x < ( xj - xi ) * ( y - yi ) / ( yj - yi ) + xi ){
      inside = !inside;
    }
  }

  return inside;
};
