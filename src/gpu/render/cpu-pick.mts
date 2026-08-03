import {
  FLAG_ALIVE, FLAG_DRAWN, FLAG_NO_EVENTS, FLAG_PARENT, FLAG_TEXT_EVENTS,
  BARREL_CTRL_OFFSET_PCT, BARREL_CURVE_SEGMENTS,
  BARREL_HEIGHT_OFFSET_MAX, BARREL_HEIGHT_OFFSET_PCT,
  BARREL_WIDTH_OFFSET_MAX, BARREL_WIDTH_OFFSET_PCT,
  CUT_RECTANGLE_CORNER, ROUND_POLYGON_RADIUS_DIV, ROUND_POLYGON_RADIUS_MAX,
  SHAPE_BARREL, SHAPE_BOTTOM_ROUND_RECTANGLE,
  SHAPE_CIRCLE, SHAPE_CUT_RECTANGLE, SHAPE_ELLIPSE, SHAPE_POLYGON_CUSTOM,
  SHAPE_RECTANGLE, SHAPE_ROUND_RECTANGLE, SHAPE_ROUND_TAG, SHAPE_ROUND_TRIANGLE
} from '../contract.mjs';
import type { ModelView } from '../contract.mjs';
import { POLYGON_POINTS, ROUND_POLYGON_SOURCE, insideUnitPolygon } from '../shape-points.mjs';

/*
Synchronous CPU node picking.

Node positions and sizes are CPU-canonical, so a node pick never needs the
GPU: a brute-force scan over the columns costs ~0.1 ms at 20k nodes and
answers in the same microtask — no rAF alignment, no queue position behind
in-flight scene frames, no mapAsync roundtrip.  Only edges (whose raster
coverage is genuinely a GPU question at scale) go through the pick pass.

Semantics replicate the GPU pick exactly — same device-px sizing, hidePx
flooring, plain-disc LOD circle collapse and shape inside-tests as
fsNodePick with the pick Frame uniform — and slots are scanned descending
so the topmost drawn node (highest slot; draw order is slot order) wins,
matching the r32uint target's overwrite order.

A uniform spatial grid is the follow-up if node counts grow ~10×.
*/

// round 22: picking is a draw-tier consumer — `visibility: 'hidden'`
// elements neither render nor pick, so the mask is ALIVE|DRAWN
const SHOWN = FLAG_ALIVE | FLAG_DRAWN;

/** device-px view state, mirroring writePickUniform */
export interface CpuPickFrame {
  panXPx: number;  // pan.x * dpr
  panYPx: number;  // pan.y * dpr
  zoomDpr: number; // zoom * dpr
  hidePx: number;
  nodeLodPx: number;
}

/**
 * Topmost shown node at device-px (xPx, yPx), or null.  Two passes
 * mirroring draw order (round 14.9): leaves scan descending slot (the
 * leaf stream's overwrite order), and only when no leaf hits do parents
 * test in *reverse* draw-permutation order (the last-drawn — deepest —
 * parent wins), so a parent can never swallow its children's picks.
 */
export function pickNodeAt( view: ModelView, frame: CpuPickFrame, xPx: number, yPx: number ): number | null {
  const flags = view.column( 'node.flags' ) as Uint32Array;
  const pos = view.column( 'node.position' ) as Float32Array;
  const size = view.column( 'node.size' ) as Uint32Array | Float32Array;
  const shapes = view.column( 'node.shape' ) as Uint32Array;
  const borderGeom = view.column( 'node.borderGeom' ) as Uint32Array;

  const hits = ( slot: number ): boolean => {
    if( ( flags[ slot ] & SHOWN ) !== SHOWN ){ return false; }

    // 20.2: events:'no' nodes are pointer-transparent — the scan falls
    // through to whatever draws beneath them
    if( ( flags[ slot ] & FLAG_NO_EVENTS ) !== 0 ){ return false; }

    // device-px half sizes with the sub-pixel floor, as in nodeLod()
    let hw = size[ slot * 2 ] * 0.5 * frame.zoomDpr;
    let hh = size[ slot * 2 + 1 ] * 0.5 * frame.zoomDpr;

    if( Math.max( hw, hh ) * 2 < frame.hidePx ){
      hw = frame.hidePx / 2;
      hh = frame.hidePx / 2;
    }

    const dx = xPx - ( pos[ slot * 2 ] * frame.zoomDpr + frame.panXPx );
    const dy = yPx - ( pos[ slot * 2 + 1 ] * frame.zoomDpr + frame.panYPx );
    const hmax = Math.max( hw, hh );

    // 20.3: with text-events the label block is part of the node — its
    // box (node-local model px, round 16.4) tests in device px.  Checked
    // before the quick reject: label boxes extend outside the node body.
    //
    // 27.7: a node label can now carry a numeric text-rotation, so the
    // AABB is no longer exact.  When the label is turned, the point is
    // un-rotated about the label's anchor and tested against the
    // unrotated box — an OBB test, which is what the drawn glyphs
    // actually occupy.
    if( ( flags[ slot ] & FLAG_TEXT_EVENTS ) !== 0 ){
      const lb = view.nodeLabelBox( slot );

      if( lb != null ){
        const rot = view.labelAt( slot, 'nodes' )?.rotation ?? 0;
        let lx = dx / frame.zoomDpr;
        let ly = dy / frame.zoomDpr;

        if( rot !== 0 ){
          const cos = Math.cos( rot );
          const sin = Math.sin( rot );

          // rotate by -rot: the VS turns the box by +rot about the anchor
          const rx = lx * cos + ly * sin;
          const ry = -lx * sin + ly * cos;

          lx = rx;
          ly = ry;
        }

        if( lx >= lb.x1 && lx <= lb.x2 && ly >= lb.y1 && ly <= lb.y2 ){
          return true;
        }
      }
    }

    if( Math.abs( dx ) > hmax || Math.abs( dy ) > hmax ){ return false; } // quick reject

    let shape = shapes[ slot ];

    // plain-disc LOD: below nodeLodPx everything draws (and picks) as a disc
    if( hmax * 2 < frame.nodeLodPx ){
      shape = SHAPE_CIRCLE;
      hw = hmax;
      hh = hmax;
    }

    // B2: per-node corner radius (device px; 0xffffffff = v3's auto).
    // 27.2: cut-rectangle reads the same word as its chamfer length, but
    // its 'auto' is a flat 8 model px rather than the size-relative rule
    // — the twin of the shader's cornerLengthPx.
    const storedR = borderGeom[ slot * 4 ];
    const radius = storedR !== 0xffffffff
      ? storedR / 256 * frame.zoomDpr
      : shape === SHAPE_CUT_RECTANGLE
        ? CUT_RECTANGLE_CORNER * frame.zoomDpr
        : shape >= SHAPE_ROUND_TRIANGLE && shape <= SHAPE_ROUND_TAG
          // 27.4: v3's getRoundPolygonRadius, the family's own 'auto'
          ? Math.min(
            Math.min( hw, hh ) * 2 / ROUND_POLYGON_RADIUS_DIV,
            ROUND_POLYGON_RADIUS_MAX * frame.zoomDpr )
          : Math.min( Math.min( hw, hh ) * 0.5, 8 * frame.zoomDpr );

    // C3: custom polygons test their blob points (the same record the
    // FS reads — dual consumers of one ref, agreeing by construction)
    if( shape === SHAPE_POLYGON_CUSTOM ){
      const ref = borderGeom[ slot * 4 ];
      const off = ref & 0xffffff;
      const count = ref >>> 24;
      const points = view.polyBlob().subarray( off, off + count * 2 );

      return insideUnitPolygon( points, dx / hw, dy / hh );
    }

    return insideShape( shape, dx, dy, hw, hh, radius, frame.zoomDpr );
  };

  for( let slot = view.highWater( 'nodes' ) - 1; slot >= 0; slot-- ){
    if( ( flags[ slot ] & FLAG_PARENT ) !== 0 ){ continue; } // the parent pass below

    if( hits( slot ) ){ return slot; }
  }

  const order = view.parentOrder();

  for( let i = order.length - 1; i >= 0; i-- ){
    if( hits( order[ i ] ) ){ return order[ i ]; }
  }

  return null;
}

// inside tests matching the sign of the shader SDFs (sd <= 0 picks)
function insideShape(
  shape: number, dx: number, dy: number, hw: number, hh: number, radius: number,
  zoomDpr: number
): boolean {
  switch( shape ){
    case SHAPE_CIRCLE: // circleSD uses half.x as the radius
      return dx * dx + dy * dy <= hw * hw;
    case SHAPE_ELLIPSE:
      return ( dx * dx ) / ( hw * hw ) + ( dy * dy ) / ( hh * hh ) <= 1;
    case SHAPE_RECTANGLE:
      return Math.abs( dx ) <= hw && Math.abs( dy ) <= hh;
    case SHAPE_ROUND_RECTANGLE: { // the resolved corner radius, as in nodeSD (B2)
      const r = Math.min( radius, Math.min( hw, hh ) );
      const qx = Math.abs( dx ) - hw + r;
      const qy = Math.abs( dy ) - hh + r;
      const mx = Math.max( qx, 0 );
      const my = Math.max( qy, 0 );

      return Math.min( Math.max( qx, qy ), 0 ) + Math.sqrt( mx * mx + my * my ) - r <= 0;
    }
    case SHAPE_BARREL: // 27.5: the same sampled outline the shader builds
      return insideBarrel( dx, dy, hw, hh, zoomDpr );
    case SHAPE_BOTTOM_ROUND_RECTANGLE: { // 27.4: only the bottom corners round
      const r = dy > 0 ? Math.min( radius, Math.min( hw, hh ) ) : 0;
      const qx = Math.abs( dx ) - hw + r;
      const qy = Math.abs( dy ) - hh + r;
      const mx = Math.max( qx, 0 );
      const my = Math.max( qy, 0 );

      return Math.min( Math.max( qx, qy ), 0 ) + Math.sqrt( mx * mx + my * my ) - r <= 0;
    }
    case SHAPE_CUT_RECTANGLE: { // 27.2: the box intersected with the corner chamfers
      const c = Math.min( radius, Math.min( hw, hh ) );

      return Math.abs( dx ) <= hw && Math.abs( dy ) <= hh
        && Math.abs( dx ) + Math.abs( dy ) <= hw + hh - c;
    }
    default: {
      const round = ROUND_POLYGON_SOURCE.get( shape );

      // 27.4: the round-* family is the offset polygon dilated by r, so
      // inside-ness is a distance test in *device* space — unlike the
      // sharp polygons, it is not affine-invariant and cannot be done in
      // normalized space.  The twin of the shader's roundPolySD.
      if( round != null ){
        const points = POLYGON_POINTS.get( round ) as readonly number[];

        return insideRoundPolygon( points, dx, dy, hw, hh, radius );
      }

      // polygon shapes: inside-ness in normalized space (affine-invariant)
      const points = POLYGON_POINTS.get( shape );

      if( points == null ){ return Math.abs( dx ) <= hw && Math.abs( dy ) <= hh; }

      return insideUnitPolygon( points, dx / hw, dy / hh );
    }
  }
}

/**
 * Inside-ness for v3's barrel (27.5): rebuild the same sampled outline
 * the shader's `barrelSD` builds — four quadratic-bezier corners at
 * BARREL_CURVE_SEGMENTS segments each — and run an even-odd test over
 * it.  Built from the same constants so the two consumers agree by
 * construction.
 *
 * @param dx — the point's x offset from the node centre, device px
 * @param dy — the point's y offset from the node centre, device px
 * @param hw — half width, device px
 * @param hh — half height, device px
 * @param zoomDpr — model-to-device scale, for the absolute offset caps
 * @returns true when the point is inside the barrel outline
 */
function insideBarrel(
  dx: number, dy: number, hw: number, hh: number, zoomDpr: number
): boolean {
  const hOff = Math.min( BARREL_HEIGHT_OFFSET_MAX * zoomDpr, BARREL_HEIGHT_OFFSET_PCT * hh * 2 );
  const wOff = Math.min( BARREL_WIDTH_OFFSET_MAX * zoomDpr, BARREL_WIDTH_OFFSET_PCT * hw * 2 );
  const ctrl = BARREL_CTRL_OFFSET_PCT * hw * 2;
  const x0 = -hw, x1 = hw, y0 = -hh, y1 = hh;
  const a = [ [ x0, y0 + hOff ], [ x1 - wOff, y0 ], [ x1, y1 - hOff ], [ x0 + wOff, y1 ] ];
  const c = [ [ x0 + ctrl, y0 ], [ x1 - ctrl, y0 ], [ x1 - ctrl, y1 ], [ x0 + ctrl, y1 ] ];
  const b = [ [ x0 + wOff, y0 ], [ x1, y0 + hOff ], [ x1 - wOff, y1 ], [ x0, y1 - hOff ] ];
  const pts: number[] = [];

  for( let i = 0; i < 4; i++ ){
    for( let j = 0; j <= BARREL_CURVE_SEGMENTS; j++ ){
      const t = j / BARREL_CURVE_SEGMENTS;
      const u = 1 - t;

      pts.push(
        a[ i ][ 0 ] * u * u + c[ i ][ 0 ] * 2 * u * t + b[ i ][ 0 ] * t * t,
        a[ i ][ 1 ] * u * u + c[ i ][ 1 ] * 2 * u * t + b[ i ][ 1 ] * t * t
      );
    }
  }

  let inside = false;

  for( let i = 0, j = pts.length / 2 - 1; i < pts.length / 2; j = i, i++ ){
    const xi = pts[ i * 2 ], yi = pts[ i * 2 + 1 ];
    const xj = pts[ j * 2 ], yj = pts[ j * 2 + 1 ];

    if( ( yi > dy ) !== ( yj > dy )
      && dx < ( xj - xi ) * ( dy - yi ) / ( yj - yi ) + xi ){
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Inside-ness for a round-corner polygon (27.4): miter-offset the scaled
 * vertices inward by r, then test the point against that polygon dilated
 * by r — the CPU twin of the shader's generated `roundPoly*SD`, built
 * from the same table so the two agree by construction.
 *
 * @param unit — the sharp shape's flat unit point list
 * @param dx — the point's x offset from the node centre, device px
 * @param dy — the point's y offset from the node centre, device px
 * @param hw — half width, device px
 * @param hh — half height, device px
 * @param radius — the resolved corner radius, device px
 * @returns true when the point is inside the rounded outline
 */
function insideRoundPolygon(
  unit: readonly number[], dx: number, dy: number, hw: number, hh: number, radius: number
): boolean {
  const n = unit.length / 2;
  const r = Math.min( radius, Math.min( hw, hh ) * 0.5 );
  const vx = new Array<number>( n );
  const vy = new Array<number>( n );

  for( let i = 0; i < n; i++ ){
    vx[ i ] = unit[ i * 2 ] * hw;
    vy[ i ] = unit[ i * 2 + 1 ] * hh;
  }

  let area2 = 0;

  for( let i = 0; i < n; i++ ){
    const j = ( i + 1 ) % n;

    area2 += vx[ i ] * vy[ j ] - vx[ j ] * vy[ i ];
  }

  const wind = area2 > 0 ? 1 : -1;
  const ox = new Array<number>( n );
  const oy = new Array<number>( n );

  for( let i = 0; i < n; i++ ){
    const p = ( i + n - 1 ) % n;
    const q = ( i + 1 ) % n;
    let e1x = vx[ i ] - vx[ p ];
    let e1y = vy[ i ] - vy[ p ];
    let e2x = vx[ q ] - vx[ i ];
    let e2y = vy[ q ] - vy[ i ];
    const l1 = Math.hypot( e1x, e1y ) || 1;
    const l2 = Math.hypot( e2x, e2y ) || 1;

    e1x /= l1; e1y /= l1; e2x /= l2; e2y /= l2;

    const n1x = -e1y * wind, n1y = e1x * wind;
    const n2x = -e2y * wind, n2y = e2x * wind;
    const denom = 1 + ( n1x * n2x + n1y * n2y );
    const k = denom > 1e-4 ? r / denom : 0;

    ox[ i ] = vx[ i ] + ( n1x + n2x ) * k;
    oy[ i ] = vy[ i ] + ( n1y + n2y ) * k;
  }

  // signed distance to the offset polygon, then dilate by r
  let d = ( dx - ox[ 0 ] ) ** 2 + ( dy - oy[ 0 ] ) ** 2;
  let sign = 1;

  for( let i = 0, j = n - 1; i < n; j = i, i++ ){
    const ex = ox[ j ] - ox[ i ];
    const ey = oy[ j ] - oy[ i ];
    const wx = dx - ox[ i ];
    const wy = dy - oy[ i ];
    const t = Math.max( 0, Math.min( 1, ( wx * ex + wy * ey ) / ( ex * ex + ey * ey ) ) );
    const bx = wx - ex * t;
    const by = wy - ey * t;

    d = Math.min( d, bx * bx + by * by );

    const c1 = dy >= oy[ i ];
    const c2 = dy < oy[ j ];
    const c3 = ex * wy > ey * wx;

    if( ( c1 && c2 && c3 ) || ( !c1 && !c2 && !c3 ) ){ sign = -sign; }
  }

  return sign * Math.sqrt( d ) - r <= 0;
}
