import * as math from '../../../../math.mjs';

import type { Renderer, Element } from '../../renderer-types.mjs';

let BRp: Record<string, unknown> = {};

BRp.calculateArrowAngles = function( edge: Element ){
  // rscratch is a loose geometry bag; the fields read/written here are
  // edge-type discriminants plus numeric coords / number[] control points.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- rscratch geometry bag
  let rs = edge._private.rscratch as any;
  let isHaystack = rs.edgeType === 'haystack';
  let isBezier = rs.edgeType === 'bezier';
  let isMultibezier = rs.edgeType === 'multibezier';
  let isSegments = rs.edgeType === 'segments';
  let isCompound = rs.edgeType === 'compound';
  let isSelf = rs.edgeType === 'self';

  // Displacement gives direction for arrowhead orientation
  let dispX: number, dispY: number;
  let startX: number, startY: number, endX: number, endY: number, midX: number, midY: number;

  if( isHaystack ){
    startX = rs.haystackPts[0];
    startY = rs.haystackPts[1];
    endX = rs.haystackPts[2];
    endY = rs.haystackPts[3];
  } else {
    startX = rs.arrowStartX;
    startY = rs.arrowStartY;
    endX = rs.arrowEndX;
    endY = rs.arrowEndY;
  }

  midX = rs.midX;
  midY = rs.midY;

  // source
  //

  if( isSegments ){
    dispX = startX - rs.segpts[0];
    dispY = startY - rs.segpts[1];
  } else if( isMultibezier || isCompound || isSelf || isBezier ){
    let pts = rs.allpts;
    let bX = math.qbezierAt( pts[0], pts[2], pts[4], 0.1 );
    let bY = math.qbezierAt( pts[1], pts[3], pts[5], 0.1 );

    dispX = startX - bX;
    dispY = startY - bY;
  } else {
    dispX = startX - midX;
    dispY = startY - midY;
  }

  rs.srcArrowAngle = math.getAngleFromDisp( dispX, dispY );

  // mid target
  //

  midX = rs.midX;
  midY = rs.midY;

  if( isHaystack ){
    midX = ( startX + endX ) / 2;
    midY = ( startY + endY ) / 2;
  }

  dispX = endX - startX;
  dispY = endY - startY;

  if( isSegments ){
    let pts = rs.allpts;

    if( pts.length / 2 % 2 === 0 ){
      let i2 = pts.length / 2;
      let i1 = i2 - 2;

      dispX = ( pts[ i2 ] - pts[ i1 ] );
      dispY = ( pts[ i2 + 1] - pts[ i1 + 1] );
    } else if( rs.isRound ){
     dispX = rs.midVector[1];
     dispY = -rs.midVector[0];
    } else {
      let i2 = pts.length / 2 - 1;
      let i1 = i2 - 2;

      dispX = ( pts[ i2 ] - pts[ i1 ] );
      dispY = ( pts[ i2 + 1] - pts[ i1 + 1] );
    }
  } else if( isMultibezier || isCompound || isSelf ){
    let pts = rs.allpts;
    let cpts = rs.ctrlpts;
    let bp0x: number, bp0y: number;
    let bp1x: number, bp1y: number;

    if( cpts.length / 2 % 2 === 0 ){
      let p0 = pts.length / 2 - 1; // startpt
      let ic = p0 + 2;
      let p1 = ic + 2;

      bp0x = math.qbezierAt( pts[ p0 ], pts[ ic ], pts[ p1 ], 0.0 );
      bp0y = math.qbezierAt( pts[ p0 + 1], pts[ ic + 1], pts[ p1 + 1], 0.0 );

      bp1x = math.qbezierAt( pts[ p0 ], pts[ ic ], pts[ p1 ], 0.0001 );
      bp1y = math.qbezierAt( pts[ p0 + 1], pts[ ic + 1], pts[ p1 + 1], 0.0001 );
    } else {
      let ic = pts.length / 2 - 1; // ctrpt
      let p0 = ic - 2; // startpt
      let p1 = ic + 2; // endpt

      bp0x = math.qbezierAt( pts[ p0 ], pts[ ic ], pts[ p1 ], 0.4999 );
      bp0y = math.qbezierAt( pts[ p0 + 1], pts[ ic + 1], pts[ p1 + 1], 0.4999 );

      bp1x = math.qbezierAt( pts[ p0 ], pts[ ic ], pts[ p1 ], 0.5 );
      bp1y = math.qbezierAt( pts[ p0 + 1], pts[ ic + 1], pts[ p1 + 1], 0.5 );
    }

    dispX = ( bp1x - bp0x );
    dispY = ( bp1y - bp0y );
  }

  rs.midtgtArrowAngle = math.getAngleFromDisp( dispX, dispY );

  rs.midDispX = dispX;
  rs.midDispY = dispY;

  // mid source
  //

  dispX *= -1;
  dispY *= -1;

  if( isSegments ){
    let pts = rs.allpts;

    if( pts.length / 2 % 2 === 0 ){
      // already ok
    } else if( !rs.isRound ){
      let i2 = pts.length / 2 - 1;
      let i3 = i2 + 2;

      dispX = -( pts[ i3 ] - pts[ i2 ] );
      dispY = -( pts[ i3 + 1] - pts[ i2 + 1] );
    }
  }

  rs.midsrcArrowAngle = math.getAngleFromDisp( dispX, dispY );

  // target
  //

  if( isSegments ){
    dispX = endX - rs.segpts[ rs.segpts.length - 2 ];
    dispY = endY - rs.segpts[ rs.segpts.length - 1 ];
  } else if( isMultibezier || isCompound || isSelf || isBezier ){
    let pts = rs.allpts;
    let l = pts.length;
    let bX = math.qbezierAt( pts[l-6], pts[l-4], pts[l-2], 0.9 );
    let bY = math.qbezierAt( pts[l-5], pts[l-3], pts[l-1], 0.9 );

    dispX = endX - bX;
    dispY = endY - bY;
  } else {
    dispX = endX - midX;
    dispY = endY - midY;
  }

  rs.tgtArrowAngle = math.getAngleFromDisp( dispX, dispY );
};

BRp.getArrowWidth = BRp.getArrowHeight = function( this: Renderer, edgeWidth: number, scale: number ){
  let cache = this.arrowWidthCache = this.arrowWidthCache || {};

  let cachedVal = cache[ edgeWidth + ', ' + scale ];
  if( cachedVal ){
    return cachedVal;
  }

  cachedVal =  Math.max( Math.pow( edgeWidth * 13.37, 0.9 ), 29 ) * scale;
  cache[ edgeWidth + ', ' + scale ] = cachedVal;

  return cachedVal;
};

export default BRp;
