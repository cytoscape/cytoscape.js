import {
  FLAG_ALIVE, FLAG_VISIBLE,
  SHAPE_CIRCLE, SHAPE_ELLIPSE, SHAPE_RECTANGLE, SHAPE_ROUND_RECTANGLE
} from '../contract.mjs';
import type { ModelView } from '../contract.mjs';
import { POLYGON_POINTS, insideUnitPolygon } from '../shape-points.mjs';

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

const SHOWN = FLAG_ALIVE | FLAG_VISIBLE;

/** device-px view state, mirroring writePickUniform */
export interface CpuPickFrame {
  panXPx: number;  // pan.x * dpr
  panYPx: number;  // pan.y * dpr
  zoomDpr: number; // zoom * dpr
  hidePx: number;
  nodeLodPx: number;
}

/** Topmost shown node at device-px (xPx, yPx), or null. */
export function pickNodeAt( view: ModelView, frame: CpuPickFrame, xPx: number, yPx: number ): number | null {
  const flags = view.column( 'node.flags' ) as Uint32Array;
  const pos = view.column( 'node.position' ) as Float32Array;
  const size = view.column( 'node.size' ) as Uint32Array | Float32Array;
  const shapes = view.column( 'node.shape' ) as Uint32Array;
  const borderGeom = view.column( 'node.borderGeom' ) as Float32Array;

  for( let slot = view.highWater( 'nodes' ) - 1; slot >= 0; slot-- ){
    if( ( flags[ slot ] & SHOWN ) !== SHOWN ){ continue; }

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

    if( Math.abs( dx ) > hmax || Math.abs( dy ) > hmax ){ continue; } // quick reject

    let shape = shapes[ slot ];

    // plain-disc LOD: below nodeLodPx everything draws (and picks) as a disc
    if( hmax * 2 < frame.nodeLodPx ){
      shape = SHAPE_CIRCLE;
      hw = hmax;
      hh = hmax;
    }

    // B2: per-node corner radius (device px; -1 = v3's auto formula)
    const storedR = borderGeom[ slot * 2 ];
    const radius = storedR < 0
      ? Math.min( Math.min( hw, hh ) * 0.5, 8 * frame.zoomDpr )
      : storedR * frame.zoomDpr;

    if( insideShape( shape, dx, dy, hw, hh, radius ) ){ return slot; }
  }

  return null;
}

// inside tests matching the sign of the shader SDFs (sd <= 0 picks)
function insideShape(
  shape: number, dx: number, dy: number, hw: number, hh: number, radius: number
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
    default: { // polygon shapes: inside-ness in normalized space (affine-invariant)
      const points = POLYGON_POINTS.get( shape );

      if( points == null ){ return Math.abs( dx ) <= hw && Math.abs( dy ) <= hh; }

      return insideUnitPolygon( points, dx / hw, dy / hh );
    }
  }
}
