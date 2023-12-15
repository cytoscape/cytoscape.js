import * as math from '../../../math';

var CRp = {};

// @O Polygon drawing
CRp.drawPolygonPath = function(
  context, x, y, width, height, points ){

  var halfW = width / 2;
  var halfH = height / 2;

  if( context.beginPath ){ context.beginPath(); }

  context.moveTo( x + halfW * points[0], y + halfH * points[1] );

  for( var i = 1; i < points.length / 2; i++ ){
    context.lineTo( x + halfW * points[ i * 2], y + halfH * points[ i * 2 + 1] );
  }

  context.closePath();
};


// ctx is the context to add the path to
// points is a array of points [{x :?, y: ?},...
// radius is the max rounding radius
// this creates a closed polygon.
// To draw you must call between
//    ctx.beginPath();
//    roundedPoly(ctx, points, radius);
//    ctx.stroke();
//    ctx.fill();
// as it only adds a path and does not render.
// Source https://stackoverflow.com/a/44856925/11028828
function roundedPoly(ctx, points, radiusAll) {
  var i, x, y, len, p1, p2, p3, v1, v2, sinA, sinA90, radDirection, drawDirection, angle, halfAngle, cRadius, lenOut,radius;
  // convert 2 points into vector form, polar form, and normalised
  var asVec = function(p, pp, v) {
    v.x = pp.x - p.x;
    v.y = pp.y - p.y;
    v.len = Math.sqrt(v.x * v.x + v.y * v.y);
    v.nx = v.x / v.len;
    v.ny = v.y / v.len;
    v.ang = Math.atan2(v.ny, v.nx);
  }
  radius = radiusAll;
  v1 = {};
  v2 = {};
  len = points.length;
  p1 = points[len - 1];
  // for each point
  for (i = 0; i < len; i++) {
    p2 = points[(i) % len];
    p3 = points[(i + 1) % len];
    //-----------------------------------------
    // Part 1
    asVec(p2, p1, v1);
    asVec(p2, p3, v2);
    sinA = v1.nx * v2.ny - v1.ny * v2.nx;
    sinA90 = v1.nx * v2.nx - v1.ny * -v2.ny;
    angle = angle = Math.asin(Math.max(-1, Math.min(1, sinA)));
    //-----------------------------------------
    radDirection = 1;
    drawDirection = false;
    if (sinA90 < 0) {
      if (angle < 0) {
        angle = Math.PI + angle;
      } else {
        angle = Math.PI - angle;
        radDirection = -1;
        drawDirection = true;
      }
    } else {
      if (angle > 0) {
        radDirection = -1;
        drawDirection = true;
      }
    }
    if(p2.radius !== undefined){
      radius = p2.radius;
    }else{
      radius = radiusAll;
    }
    //-----------------------------------------
    // Part 2
    halfAngle = angle / 2;
    //-----------------------------------------

    //-----------------------------------------
    // Part 3
    lenOut = Math.abs(Math.cos(halfAngle) * radius / Math.sin(halfAngle));
    //-----------------------------------------

    //-----------------------------------------
    // Special part A
    if (lenOut > Math.min(v1.len / 2, v2.len / 2)) {
      lenOut = Math.min(v1.len / 2, v2.len / 2);
      cRadius = Math.abs(lenOut * Math.sin(halfAngle) / Math.cos(halfAngle));
    } else {
      cRadius = radius;
    }
    //-----------------------------------------
    // Part 4
    x = p2.x + v2.nx * lenOut;
    y = p2.y + v2.ny * lenOut;
    //-----------------------------------------
    // Part 5
    x += -v2.ny * cRadius * radDirection;
    y += v2.nx * cRadius * radDirection;
    //-----------------------------------------
    // Part 6
    ctx.arc(x, y, cRadius, v1.ang + Math.PI / 2 * radDirection, v2.ang - Math.PI / 2 * radDirection, drawDirection);
    //-----------------------------------------
    p1 = p2;
    p2 = p3;
  }
  ctx.closePath();
}

/**
 * Points in format [        <br>
 *   x_0, y_0, dx_0, dy_0,   <br>
 *   x_1, y_1, dx_1, dy_1,   <br>
 *   ...                     <br>
 * ]
 */
CRp.drawRoundPolygonPath = function(
    context, x, y, width, height, points, radius ){

    const halfW = width / 2;
    const halfH = height / 2;
    const cornerRadius = radius === 'auto' ? math.getRoundPolygonRadius( width, height ) : radius;
  // console.log(points)
  const p = new Array(points.length / 4)
  for ( let i = 0; i < points.length / 4; i++ ){
    p[i] = {x: x + halfW * points[i*4], y: y + halfH * points[i*4+1]}
  }
  //
  roundedPoly(context, p, cornerRadius)
  //   if( context.beginPath ){ context.beginPath(); }
  //
  //   for ( let i = 0; i < points.length / 4; i++ ){
  //       let sourceUv, destUv;
  //       if ( i === 0 ) {
  //           sourceUv = points.length - 2;
  //       } else {
  //           sourceUv = i * 4 - 2;
  //       }
  //       destUv = i * 4 + 2;
  //
  //       const p = {
  //         x: x + halfW * points[ i * 4 ],
  //         y: y + halfH * points[ i * 4 + 1 ]
  //       };
  //       const source = {
  //         x: x + halfW * points[ sourceUv - 2 ],
  //         y: y + halfH * points[ sourceUv - 1 ]
  //       };
  //       const dest = {
  //         x: x + halfW * points[ (destUv + 2) % points.length],
  //         y: y + halfH * points[ (destUv + 3) % points.length]
  //       };
  //
  //       const r = Math.min(
  //         Math.min(math.dist(p, source), math.dist(p, dest)) / 2,
  //           cornerRadius
  //       );
  //     // console.log({p, source, dest,
  //     //   dS: math.dist(source, p) / 2,
  //     //   dD: math.dist(p, dest) / 2,
  //     //   cornerRadius, r})
  //
  //
  //       const cosTheta = (-points[ sourceUv ] * points[ destUv ] - points[ sourceUv + 1 ] * points[ destUv + 1]);
  //       const offset = r / Math.tan(Math.acos(cosTheta) / 2) ;
  //
  //       const cp0x = p.x - offset * points[ sourceUv ];
  //       const cp0y = p.y - offset * points[ sourceUv + 1 ];
  //       const cp1x = p.x + offset * points[ destUv ];
  //       const cp1y = p.y + offset * points[ destUv + 1 ];
  //
  //       if (i === 0) {
  //           context.moveTo( cp0x, cp0y );
  //       } else {
  //           context.lineTo( cp0x, cp0y );
  //       }
  //
  //       context.arcTo( p.x, p.y, cp1x, cp1y, r );
  //   }
  //   context.closePath();
};

// Round rectangle drawing
CRp.drawRoundRectanglePath = function(
  context, x, y, width, height, radius){

  var halfWidth = width / 2;
  var halfHeight = height / 2;
  var cornerRadius = radius === 'auto' ? math.getRoundRectangleRadius( width, height ) : Math.min(radius, halfHeight, halfWidth);

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
  context, x, y, width, height, radius){

  var halfWidth = width / 2;
  var halfHeight = height / 2;
  var cornerRadius = radius === 'auto' ? math.getRoundRectangleRadius( width, height ) : radius;

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
  context, x, y, width, height ){

    var halfWidth = width / 2;
    var halfHeight = height / 2;
    var cornerLength = math.getCutRectangleCornerLength();

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
  context, x, y, width, height ){

    var halfWidth = width / 2;
    var halfHeight = height / 2;

    var xBegin = x - halfWidth;
    var xEnd = x + halfWidth;
    var yBegin = y - halfHeight;
    var yEnd = y + halfHeight;

    var barrelCurveConstants = math.getBarrelCurveConstants( width, height );
    var wOffset = barrelCurveConstants.widthOffset;
    var hOffset = barrelCurveConstants.heightOffset;
    var ctrlPtXOffset = barrelCurveConstants.ctrlPtOffsetPct * wOffset;

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


var sin0 = Math.sin( 0 );
var cos0 = Math.cos( 0 );

var sin = {};
var cos = {};

var ellipseStepSize = Math.PI / 40;

for( var i = 0 * Math.PI; i < 2 * Math.PI; i += ellipseStepSize ){
  sin[ i ] = Math.sin( i );
  cos[ i ] = Math.cos( i );
}

CRp.drawEllipsePath = function( context, centerX, centerY, width, height ){
    if( context.beginPath ){ context.beginPath(); }

    if( context.ellipse ){
      context.ellipse( centerX, centerY, width / 2, height / 2, 0, 0, 2 * Math.PI );
    } else {
      var xPos, yPos;
      var rw = width / 2;
      var rh = height / 2;
      for( var i = 0 * Math.PI; i < 2 * Math.PI; i += ellipseStepSize ){
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
