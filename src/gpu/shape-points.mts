import {
  fitPolygonToSquare, generateUnitNgonPoints, generateUnitNgonPointsFitToSquare
} from '../math.mjs';
import {
  ARROW_CHEVRON, ARROW_DIAMOND, ARROW_SQUARE, ARROW_TEE, ARROW_TRIANGLE, ARROW_VEE,
  SHAPE_DIAMOND, SHAPE_HEPTAGON, SHAPE_HEXAGON, SHAPE_OCTAGON, SHAPE_PENTAGON,
  SHAPE_RHOMBOID, SHAPE_STAR, SHAPE_TAG, SHAPE_TRIANGLE, SHAPE_VEE
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
  [ SHAPE_TAG, [ -1, -1, 0.25, -1, 1, 0, 0.25, 1, -1, 1 ] ]
] );

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
  [ ARROW_TEE, [ -0.15, 0, -0.15, -0.1, 0.15, -0.1, 0.15, 0 ] ]
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
