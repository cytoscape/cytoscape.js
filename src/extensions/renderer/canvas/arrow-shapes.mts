import type { Position } from '../renderer-types.mjs';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- internal arrow-shape mixin object assembled onto the renderer prototype
let CRp: any = {};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- impl maps shape names to draw fns of differing signatures
let impl: Record<string, ( ...args: any[] ) => void> | undefined;

function polygon( context: CanvasRenderingContext2D, points: Position[] ){
  for( let i = 0; i < points.length; i++ ){
    let pt = points[ i ];

    context.lineTo( pt.x, pt.y );
  }
}

function triangleBackcurve( context: CanvasRenderingContext2D, points: Position[], controlPoint: Position ){
  let firstPt: Position | undefined;

  for( let i = 0; i < points.length; i++ ){
    let pt = points[ i ];

    if( i === 0 ){
      firstPt = pt;
    }

    context.lineTo( pt.x, pt.y );
  }

  context.quadraticCurveTo( controlPoint.x, controlPoint.y, firstPt!.x, firstPt!.y );
}

function triangleTee( context: CanvasRenderingContext2D, trianglePoints: Position[], teePoints: Position[] ){
  if( context.beginPath ){ context.beginPath(); }

  let triPts = trianglePoints;
  for( let i = 0; i < triPts.length; i++ ){
    let pt = triPts[ i ];

    context.lineTo( pt.x, pt.y );
  }

  let teePts = teePoints;
  let firstTeePt = teePoints[0];
  context.moveTo( firstTeePt.x, firstTeePt.y );

  for( let i = 1; i < teePts.length; i++ ){
    let pt = teePts[ i ];

    context.lineTo( pt.x, pt.y );
  }

  if( context.closePath ){ context.closePath(); }
}

function circleTriangle(context: CanvasRenderingContext2D, trianglePoints: Position[], rx: number, ry: number, r: number) {
  if (context.beginPath) { context.beginPath(); }
  context.arc(rx, ry, r, 0, Math.PI * 2, false);
  let triPts = trianglePoints;
  let firstTrPt = triPts[0];
  context.moveTo(firstTrPt.x, firstTrPt.y);
  for (let i = 0; i < triPts.length; i++) {
    let pt = triPts[i];
    context.lineTo(pt.x, pt.y);
  }
  if (context.closePath) {
    context.closePath();
  }
}

function circle( context: CanvasRenderingContext2D, rx: number, ry: number, r: number ){
  context.arc( rx, ry, r, 0, Math.PI * 2, false );
}

CRp.arrowShapeImpl = function( name: string ){
  return ( impl || (impl = {
    'polygon': polygon,

    'triangle-backcurve': triangleBackcurve,

    'triangle-tee': triangleTee,

    'circle-triangle' : circleTriangle,

    'triangle-cross': triangleTee,

    'circle': circle
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- shape draw fns have differing signatures, indexed by name
  } as Record<string, ( ...args: any[] ) => void>) )[ name ];
};

export default CRp;
