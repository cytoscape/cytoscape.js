import * as math from '../../../math.mjs';
import * as round from '../../../round.mjs';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- internal shape-drawing mixin object assembled onto the renderer prototype
let CRp: any = {};

// @O Polygon drawing
CRp.drawPolygonPath = function(
  context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, points: number[] ){

  let halfW = width / 2;
  let halfH = height / 2;

  if( context.beginPath ){ context.beginPath(); }

  context.moveTo( x + halfW * points[0], y + halfH * points[1] );

  for( let i = 1; i < points.length / 2; i++ ){
    context.lineTo( x + halfW * points[ i * 2], y + halfH * points[ i * 2 + 1] );
  }

  context.closePath();
};

CRp.drawRoundPolygonPath = function(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- corners is an opaque prepared-corner descriptor array
    context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, points: number[], corners: any[] ){
    corners.forEach( corner => round.drawPreparedRoundCorner( context, corner ) );
    context.closePath();
};

// Round rectangle drawing
CRp.drawRoundRectanglePath = function(
  context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number | 'auto' ){

  let halfWidth = width / 2;
  let halfHeight = height / 2;
  let cornerRadius = radius === 'auto' ? math.getRoundRectangleRadius( width, height ) : Math.min(radius, halfHeight, halfWidth);

  if( context.beginPath ){ context.beginPath(); }

  // Start at top middle
  context.moveTo( x, y - halfHeight );
  // Arc from middle top to right side
  context.arcTo( x + halfWidth, y - halfHeight, x + halfWidth, y, cornerRadius );
  // Arc from right side to bottom
  context.arcTo( x + halfWidth, y + halfHeight, x, y + halfHeight, cornerRadius );
  // Arc from bottom to left side
  context.arcTo( x - halfWidth, y + halfHeight, x - halfWidth, y, cornerRadius );
  // Arc from left side to topBorder
  context.arcTo( x - halfWidth, y - halfHeight, x, y - halfHeight, cornerRadius );
  // Join line
  context.lineTo( x, y - halfHeight );


  context.closePath();
};

CRp.drawBottomRoundRectanglePath = function(
  context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number | 'auto' ){

  let halfWidth = width / 2;
  let halfHeight = height / 2;
  let cornerRadius = radius === 'auto' ? math.getRoundRectangleRadius( width, height ) : radius;

  if( context.beginPath ){ context.beginPath(); }

  // Start at top middle
  context.moveTo( x, y - halfHeight );
  context.lineTo( x + halfWidth, y - halfHeight );
  context.lineTo( x + halfWidth, y );

  context.arcTo( x + halfWidth, y + halfHeight, x, y + halfHeight, cornerRadius);
  context.arcTo( x - halfWidth, y + halfHeight, x - halfWidth, y, cornerRadius );

  context.lineTo( x - halfWidth, y - halfHeight );
  context.lineTo( x, y - halfHeight );

  context.closePath();
};

CRp.drawCutRectanglePath = function(
  context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, points: number[], corners: number | 'auto' ){

    let halfWidth = width / 2;
    let halfHeight = height / 2;
    let cornerLength = corners === 'auto' ? math.getCutRectangleCornerLength() : corners;

    if( context.beginPath ){ context.beginPath(); }

    context.moveTo( x - halfWidth + cornerLength, y - halfHeight );

    context.lineTo( x + halfWidth - cornerLength, y - halfHeight );
    context.lineTo( x + halfWidth, y - halfHeight + cornerLength );
    context.lineTo( x + halfWidth, y + halfHeight - cornerLength );
    context.lineTo( x + halfWidth - cornerLength, y + halfHeight );
    context.lineTo( x - halfWidth + cornerLength,  y + halfHeight );
    context.lineTo( x - halfWidth, y + halfHeight - cornerLength );
    context.lineTo( x - halfWidth, y - halfHeight + cornerLength );

    context.closePath();
};

CRp.drawBarrelPath = function(
  context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number ){

    let halfWidth = width / 2;
    let halfHeight = height / 2;

    let xBegin = x - halfWidth;
    let xEnd = x + halfWidth;
    let yBegin = y - halfHeight;
    let yEnd = y + halfHeight;

    let barrelCurveConstants = math.getBarrelCurveConstants( width, height );
    let wOffset = barrelCurveConstants.widthOffset;
    let hOffset = barrelCurveConstants.heightOffset;
    let ctrlPtXOffset = barrelCurveConstants.ctrlPtOffsetPct * wOffset;

    if( context.beginPath ){ context.beginPath(); }

    context.moveTo( xBegin, yBegin + hOffset );

    context.lineTo( xBegin, yEnd - hOffset );
    context.quadraticCurveTo( xBegin + ctrlPtXOffset, yEnd, xBegin + wOffset, yEnd );

    context.lineTo( xEnd - wOffset, yEnd );
    context.quadraticCurveTo( xEnd - ctrlPtXOffset, yEnd, xEnd, yEnd - hOffset );

    context.lineTo( xEnd, yBegin + hOffset );
    context.quadraticCurveTo( xEnd - ctrlPtXOffset, yBegin, xEnd -  wOffset, yBegin );

    context.lineTo( xBegin + wOffset, yBegin );
    context.quadraticCurveTo( xBegin + ctrlPtXOffset, yBegin, xBegin, yBegin + hOffset );

    context.closePath();
};


let sin0 = Math.sin( 0 );
let cos0 = Math.cos( 0 );

let sin: Record<number, number> = {};
let cos: Record<number, number> = {};

let ellipseStepSize = Math.PI / 40;

for( let i = 0 * Math.PI; i < 2 * Math.PI; i += ellipseStepSize ){
  sin[ i ] = Math.sin( i );
  cos[ i ] = Math.cos( i );
}

CRp.drawEllipsePath = function( context: CanvasRenderingContext2D, centerX: number, centerY: number, width: number, height: number ){
    if( context.beginPath ){ context.beginPath(); }

    if( context.ellipse ){
      context.ellipse( centerX, centerY, width / 2, height / 2, 0, 0, 2 * Math.PI );
    } else {
      let xPos: number, yPos: number;
      let rw = width / 2;
      let rh = height / 2;
      for( let i = 0 * Math.PI; i < 2 * Math.PI; i += ellipseStepSize ){
        xPos = centerX - (rw * sin[ i ]) * sin0 + (rw * cos[ i ]) * cos0;
        yPos = centerY + (rh * cos[ i ]) * sin0 + (rh * sin[ i ]) * cos0;

        if( i === 0 ){
          context.moveTo( xPos, yPos );
        } else {
          context.lineTo( xPos, yPos );
        }
      }
    }

    context.closePath();
  };

export default CRp;
