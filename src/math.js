'use strict';

var math = {};

math.arePositionsSame = function( p1, p2 ){
  return p1.x === p2.x && p1.y === p2.y;
};

math.copyPosition = function( p ){
  return { x: p.x, y: p.y };
};

math.array2point = function( arr ){
  return {
    x: arr[0],
    y: arr[1]
  };
};

math.deg2rad = function( deg ){
  return Math.PI * deg / 180;
};

math.log2 = Math.log2 || function( n ){
  return Math.log( n ) / Math.log( 2 );
};

math.signum = function( x ){
  if( x > 0 ){
    return 1;
  } else if( x < 0 ){
    return -1;
  } else {
    return 0;
  }
};

math.dist = function( p1, p2 ){
  return Math.sqrt( math.sqdist( p1, p2 ) );
};

math.sqdist = function( p1, p2 ){
  var dx = p2.x - p1.x;
  var dy = p2.y - p1.y;

  return dx * dx + dy * dy;
};

// from http://en.wikipedia.org/wiki/Bézier_curve#Quadratic_curves
math.qbezierAt = function( p0, p1, p2, t ){
  return (1 - t) * (1 - t) * p0 + 2 * (1 - t) * t * p1 + t * t * p2;
};

math.qbezierPtAt = function( p0, p1, p2, t ){
  return {
    x: math.qbezierAt( p0.x, p1.x, p2.x, t ),
    y: math.qbezierAt( p0.y, p1.y, p2.y, t )
  };
};

math.lineAt = function( p0, p1, t, d ){
  var vec = {
    x: p1.x - p0.x,
    y: p1.y - p0.y
  };

  var vecDist = math.dist( p0, p1 );

  var normVec = {
    x: vec.x / vecDist,
    y: vec.y / vecDist
  };

  t = t == null ? 0 : t;

  var d = d != null ? d : t * vecDist;

  return {
    x: p0.x + normVec.x * d,
    y: p0.y + normVec.y * d
  };
};

math.lineAtDist = function( p0, p1, d ){
  return math.lineAt( p0, p1, undefined, d );
};

// get angle at A via cosine law
math.triangleAngle = function( A, B, C ){
  var a = math.dist( B, C );
  var b = math.dist( A, C );
  var c = math.dist( A, B );

  return Math.acos( (a*a + b*b - c*c)/(2*a*b) );
};

math.bound = function( min, val, max ){
  return Math.max( min, Math.min( max, val ) );
};

// makes a full bb (x1, y1, x2, y2, w, h) from implicit params
math.makeBoundingBox = function( bb ){
  if( bb == null ){
    return {
      x1: Infinity,
      y1: Infinity,
      x2: -Infinity,
      y2: -Infinity,
      w: 0,
      h: 0
    };
  } else if( bb.x1 != null && bb.y1 != null ){
    if( bb.x2 != null && bb.y2 != null && bb.x2 >= bb.x1 && bb.y2 >= bb.y1 ){
      return {
        x1: bb.x1,
        y1: bb.y1,
        x2: bb.x2,
        y2: bb.y2,
        w: bb.x2 - bb.x1,
        h: bb.y2 - bb.y1
      };
    } else if( bb.w != null && bb.h != null && bb.w >= 0 && bb.h >= 0 ){
      return {
        x1: bb.x1,
        y1: bb.y1,
        x2: bb.x1 + bb.w,
        y2: bb.y1 + bb.h,
        w: bb.w,
        h: bb.h
      };
    }
  }
};

math.updateBoundingBox = function( bb1, bb2 ){
  // update bb1 with bb2 bounds

  bb1.x1 = Math.min( bb1.x1, bb2.x1 );
  bb1.x2 = Math.max( bb1.x2, bb2.x2 );
  bb1.w = bb1.x2 - bb1.x1;

  bb1.y1 = Math.min( bb1.y1, bb2.y1 );
  bb1.y2 = Math.max( bb1.y2, bb2.y2 );
  bb1.h = bb1.y2 - bb1.y1;
};

math.expandBoundingBox = function( bb, padding ){
  bb.x1 -= padding;
  bb.x2 += padding;
  bb.y1 -= padding;
  bb.y2 += padding;
  bb.w = bb.x2 - bb.x1;
  bb.h = bb.y2 - bb.y1;

  return bb;
};

math.boundingBoxesIntersect = function( bb1, bb2 ){
  // case: one bb to right of other
  if( bb1.x1 > bb2.x2 ){ return false; }
  if( bb2.x1 > bb1.x2 ){ return false; }

  // case: one bb to left of other
  if( bb1.x2 < bb2.x1 ){ return false; }
  if( bb2.x2 < bb1.x1 ){ return false; }

  // case: one bb above other
  if( bb1.y2 < bb2.y1 ){ return false; }
  if( bb2.y2 < bb1.y1 ){ return false; }

  // case: one bb below other
  if( bb1.y1 > bb2.y2 ){ return false; }
  if( bb2.y1 > bb1.y2 ){ return false; }

  // otherwise, must have some overlap
  return true;
};

math.inBoundingBox = function( bb, x, y ){
  return bb.x1 <= x && x <= bb.x2 && bb.y1 <= y && y <= bb.y2;
};

math.pointInBoundingBox = function( bb, pt ){
  return this.inBoundingBox( bb, pt.x, pt.y );
};

math.boundingBoxInBoundingBox = function( bb1, bb2 ){
  return (
       math.inBoundingBox( bb1, bb2.x1, bb2.y1 )
    && math.inBoundingBox( bb1, bb2.x2, bb2.y2 )
  );
};

math.roundRectangleIntersectLine = function(
  x, y, nodeX, nodeY, width, height, padding ){

  var cornerRadius = this.getRoundRectangleRadius( width, height );

  var halfWidth = width / 2;
  var halfHeight = height / 2;

  // Check intersections with straight line segments
  var straightLineIntersections;

  // Top segment, left to right
  {
    var topStartX = nodeX - halfWidth + cornerRadius - padding;
    var topStartY = nodeY - halfHeight - padding;
    var topEndX = nodeX + halfWidth - cornerRadius + padding;
    var topEndY = topStartY;

    straightLineIntersections = this.finiteLinesIntersect(
      x, y, nodeX, nodeY, topStartX, topStartY, topEndX, topEndY, false );

    if( straightLineIntersections.length > 0 ){
      return straightLineIntersections;
    }
  }

  // Right segment, top to bottom
  {
    var rightStartX = nodeX + halfWidth + padding;
    var rightStartY = nodeY - halfHeight + cornerRadius - padding;
    var rightEndX = rightStartX;
    var rightEndY = nodeY + halfHeight - cornerRadius + padding;

    straightLineIntersections = this.finiteLinesIntersect(
      x, y, nodeX, nodeY, rightStartX, rightStartY, rightEndX, rightEndY, false );

    if( straightLineIntersections.length > 0 ){
      return straightLineIntersections;
    }
  }

  // Bottom segment, left to right
  {
    var bottomStartX = nodeX - halfWidth + cornerRadius - padding;
    var bottomStartY = nodeY + halfHeight + padding;
    var bottomEndX = nodeX + halfWidth - cornerRadius + padding;
    var bottomEndY = bottomStartY;

    straightLineIntersections = this.finiteLinesIntersect(
      x, y, nodeX, nodeY, bottomStartX, bottomStartY, bottomEndX, bottomEndY, false );

    if( straightLineIntersections.length > 0 ){
      return straightLineIntersections;
    }
  }

  // Left segment, top to bottom
  {
    var leftStartX = nodeX - halfWidth - padding;
    var leftStartY = nodeY - halfHeight + cornerRadius - padding;
    var leftEndX = leftStartX;
    var leftEndY = nodeY + halfHeight - cornerRadius + padding;

    straightLineIntersections = this.finiteLinesIntersect(
      x, y, nodeX, nodeY, leftStartX, leftStartY, leftEndX, leftEndY, false );

    if( straightLineIntersections.length > 0 ){
      return straightLineIntersections;
    }
  }

  // Check intersections with arc segments
  var arcIntersections;

  // Top Left
  {
    var topLeftCenterX = nodeX - halfWidth + cornerRadius;
    var topLeftCenterY = nodeY - halfHeight + cornerRadius;
    arcIntersections = this.intersectLineCircle(
      x, y, nodeX, nodeY,
      topLeftCenterX, topLeftCenterY, cornerRadius + padding );

    // Ensure the intersection is on the desired quarter of the circle
    if( arcIntersections.length > 0
      && arcIntersections[0] <= topLeftCenterX
      && arcIntersections[1] <= topLeftCenterY ){
      return [ arcIntersections[0], arcIntersections[1] ];
    }
  }

  // Top Right
  {
    var topRightCenterX = nodeX + halfWidth - cornerRadius;
    var topRightCenterY = nodeY - halfHeight + cornerRadius;
    arcIntersections = this.intersectLineCircle(
      x, y, nodeX, nodeY,
      topRightCenterX, topRightCenterY, cornerRadius + padding );

    // Ensure the intersection is on the desired quarter of the circle
    if( arcIntersections.length > 0
      && arcIntersections[0] >= topRightCenterX
      && arcIntersections[1] <= topRightCenterY ){
      return [ arcIntersections[0], arcIntersections[1] ];
    }
  }

  // Bottom Right
  {
    var bottomRightCenterX = nodeX + halfWidth - cornerRadius;
    var bottomRightCenterY = nodeY + halfHeight - cornerRadius;
    arcIntersections = this.intersectLineCircle(
      x, y, nodeX, nodeY,
      bottomRightCenterX, bottomRightCenterY, cornerRadius + padding );

    // Ensure the intersection is on the desired quarter of the circle
    if( arcIntersections.length > 0
      && arcIntersections[0] >= bottomRightCenterX
      && arcIntersections[1] >= bottomRightCenterY ){
      return [ arcIntersections[0], arcIntersections[1] ];
    }
  }

  // Bottom Left
  {
    var bottomLeftCenterX = nodeX - halfWidth + cornerRadius;
    var bottomLeftCenterY = nodeY + halfHeight - cornerRadius;
    arcIntersections = this.intersectLineCircle(
      x, y, nodeX, nodeY,
      bottomLeftCenterX, bottomLeftCenterY, cornerRadius + padding );

    // Ensure the intersection is on the desired quarter of the circle
    if( arcIntersections.length > 0
      && arcIntersections[0] <= bottomLeftCenterX
      && arcIntersections[1] >= bottomLeftCenterY ){
      return [ arcIntersections[0], arcIntersections[1] ];
    }
  }

  return []; // if nothing
};

math.inLineVicinity = function( x, y, lx1, ly1, lx2, ly2, tolerance ){
  var t = tolerance;

  var x1 = Math.min( lx1, lx2 );
  var x2 = Math.max( lx1, lx2 );
  var y1 = Math.min( ly1, ly2 );
  var y2 = Math.max( ly1, ly2 );

  return x1 - t <= x && x <= x2 + t
    && y1 - t <= y && y <= y2 + t;
};

math.inBezierVicinity = function(
  x, y, x1, y1, x2, y2, x3, y3, tolerance ){

  var bb = {
    x1: Math.min( x1, x3, x2 ) - tolerance,
    x2: Math.max( x1, x3, x2 ) + tolerance,
    y1: Math.min( y1, y3, y2 ) - tolerance,
    y2: Math.max( y1, y3, y2 ) + tolerance
  };

  // if outside the rough bounding box for the bezier, then it can't be a hit
  if( x < bb.x1 || x > bb.x2 || y < bb.y1 || y > bb.y2 ){
    // console.log('bezier out of rough bb')
    return false;
  } else {
    // console.log('do more expensive check');
    return true;
  }

};

math.solveCubic = function( a, b, c, d, result ){

  // Solves a cubic function, returns root in form [r1, i1, r2, i2, r3, i3], where
  // r is the real component, i is the imaginary component

  // An implementation of the Cardano method from the year 1545
  // http://en.wikipedia.org/wiki/Cubic_function#The_nature_of_the_roots

  b /= a;
  c /= a;
  d /= a;

  var discriminant, q, r, dum1, s, t, term1, r13;

  q = (3.0 * c - (b * b)) / 9.0;
  r = -(27.0 * d) + b * (9.0 * c - 2.0 * (b * b));
  r /= 54.0;

  discriminant = q * q * q + r * r;
  result[1] = 0;
  term1 = (b / 3.0);

  if( discriminant > 0 ){
    s = r + Math.sqrt( discriminant );
    s = ((s < 0) ? -Math.pow( -s, (1.0 / 3.0) ) : Math.pow( s, (1.0 / 3.0) ));
    t = r - Math.sqrt( discriminant );
    t = ((t < 0) ? -Math.pow( -t, (1.0 / 3.0) ) : Math.pow( t, (1.0 / 3.0) ));
    result[0] = -term1 + s + t;
    term1 += (s + t) / 2.0;
    result[4] = result[2] = -term1;
    term1 = Math.sqrt( 3.0 ) * (-t + s) / 2;
    result[3] = term1;
    result[5] = -term1;
    return;
  }

  result[5] = result[3] = 0;

  if( discriminant === 0 ){
    r13 = ((r < 0) ? -Math.pow( -r, (1.0 / 3.0) ) : Math.pow( r, (1.0 / 3.0) ));
    result[0] = -term1 + 2.0 * r13;
    result[4] = result[2] = -(r13 + term1);
    return;
  }

  q = -q;
  dum1 = q * q * q;
  dum1 = Math.acos( r / Math.sqrt( dum1 ) );
  r13 = 2.0 * Math.sqrt( q );
  result[0] = -term1 + r13 * Math.cos( dum1 / 3.0 );
  result[2] = -term1 + r13 * Math.cos( (dum1 + 2.0 * Math.PI) / 3.0 );
  result[4] = -term1 + r13 * Math.cos( (dum1 + 4.0 * Math.PI) / 3.0 );

  return;
};

math.sqdistToQuadraticBezier = function(
  x, y, x1, y1, x2, y2, x3, y3 ){

  // Find minimum distance by using the minimum of the distance
  // function between the given point and the curve

  // This gives the coefficients of the resulting cubic equation
  // whose roots tell us where a possible minimum is
  // (Coefficients are divided by 4)

  var a = 1.0 * x1 * x1 - 4 * x1 * x2 + 2 * x1 * x3 + 4 * x2 * x2 - 4 * x2 * x3 + x3 * x3
    + y1 * y1 - 4 * y1 * y2 + 2 * y1 * y3 + 4 * y2 * y2 - 4 * y2 * y3 + y3 * y3;

  var b = 1.0 * 9 * x1 * x2 - 3 * x1 * x1 - 3 * x1 * x3 - 6 * x2 * x2 + 3 * x2 * x3
    + 9 * y1 * y2 - 3 * y1 * y1 - 3 * y1 * y3 - 6 * y2 * y2 + 3 * y2 * y3;

  var c = 1.0 * 3 * x1 * x1 - 6 * x1 * x2 + x1 * x3 - x1 * x + 2 * x2 * x2 + 2 * x2 * x - x3 * x
    + 3 * y1 * y1 - 6 * y1 * y2 + y1 * y3 - y1 * y + 2 * y2 * y2 + 2 * y2 * y - y3 * y;

  var d = 1.0 * x1 * x2 - x1 * x1 + x1 * x - x2 * x
    + y1 * y2 - y1 * y1 + y1 * y - y2 * y;

  // debug("coefficients: " + a / a + ", " + b / a + ", " + c / a + ", " + d / a);

  var roots = [];

  // Use the cubic solving algorithm
  this.solveCubic( a, b, c, d, roots );

  var zeroThreshold = 0.0000001;

  var params = [];

  for( var index = 0; index < 6; index += 2 ){
    if( Math.abs( roots[ index + 1] ) < zeroThreshold
        && roots[ index ] >= 0
        && roots[ index ] <= 1.0 ){
      params.push( roots[ index ] );
    }
  }

  params.push( 1.0 );
  params.push( 0.0 );

  var minDistanceSquared = -1;
  var closestParam;

  var curX, curY, distSquared;
  for( var i = 0; i < params.length; i++ ){
    curX = Math.pow( 1.0 - params[ i ], 2.0 ) * x1
      + 2.0 * (1 - params[ i ]) * params[ i ] * x2
      + params[ i ] * params[ i ] * x3;

    curY = Math.pow( 1 - params[ i ], 2.0 ) * y1
      + 2 * (1.0 - params[ i ]) * params[ i ] * y2
      + params[ i ] * params[ i ] * y3;

    distSquared = Math.pow( curX - x, 2 ) + Math.pow( curY - y, 2 );
    // debug('distance for param ' + params[i] + ": " + Math.sqrt(distSquared));
    if( minDistanceSquared >= 0 ){
      if( distSquared < minDistanceSquared ){
        minDistanceSquared = distSquared;
        closestParam = params[ i ];
      }
    } else {
      minDistanceSquared = distSquared;
      closestParam = params[ i ];
    }
  }

  return minDistanceSquared;
};

math.sqdistToFiniteLine = function( x, y, x1, y1, x2, y2 ){
  var offset = [ x - x1, y - y1 ];
  var line = [ x2 - x1, y2 - y1 ];

  var lineSq = line[0] * line[0] + line[1] * line[1];
  var hypSq = offset[0] * offset[0] + offset[1] * offset[1];

  var dotProduct = offset[0] * line[0] + offset[1] * line[1];
  var adjSq = dotProduct * dotProduct / lineSq;

  if( dotProduct < 0 ){
    return hypSq;
  }

  if( adjSq > lineSq ){
    return (x - x2) * (x - x2) + (y - y2) * (y - y2);
  }

  return hypSq - adjSq;
};

math.pointInsidePolygonPoints = function( x, y, points ){
  var x1, y1, x2, y2;
  var y3;

  // Intersect with vertical line through (x, y)
  var up = 0;
  var down = 0;
  for( var i = 0; i < points.length / 2; i++ ){

    x1 = points[ i * 2];
    y1 = points[ i * 2 + 1];

    if( i + 1 < points.length / 2 ){
      x2 = points[ (i + 1) * 2];
      y2 = points[ (i + 1) * 2 + 1];
    } else {
      x2 = points[ (i + 1 - points.length / 2) * 2];
      y2 = points[ (i + 1 - points.length / 2) * 2 + 1];
    }

    if( x1 == x && x2 == x ){
      // then ignore
    } else if( (x1 >= x && x >= x2)
      || (x1 <= x && x <= x2) ){

      y3 = (x - x1) / (x2 - x1) * (y2 - y1) + y1;

      if( y3 > y ){
        up++;
      }

      if( y3 < y ){
        down++;
      }

    } else {
      continue;
    }

  }

  if( up % 2 === 0 ){
    return false;
  } else {
    return true;
  }
};

math.pointInsidePolygon = function(
  x, y, basePoints, centerX, centerY, width, height, direction, padding ){

  //var direction = arguments[6];
  var transformedPoints = new Array( basePoints.length );

  // Gives negative angle
  var angle;

  if( direction[0] != null ){
    angle = Math.atan( direction[1] / direction[0] );

    if( direction[0] < 0 ){
      angle = angle + Math.PI / 2;
    } else {
      angle = -angle - Math.PI / 2;
    }
  } else {
    angle = direction;
  }

  var cos = Math.cos( -angle );
  var sin = Math.sin( -angle );

  //    console.log("base: " + basePoints);
  for( var i = 0; i < transformedPoints.length / 2; i++ ){
    transformedPoints[ i * 2] =
      width / 2 * (basePoints[ i * 2] * cos
        - basePoints[ i * 2 + 1] * sin);

    transformedPoints[ i * 2 + 1] =
      height / 2 * (basePoints[ i * 2 + 1] * cos
        + basePoints[ i * 2] * sin);

    transformedPoints[ i * 2] += centerX;
    transformedPoints[ i * 2 + 1] += centerY;
  }

  var points;

  if( padding > 0 ){
    var expandedLineSet = this.expandPolygon(
      transformedPoints,
      -padding );

    points = this.joinLines( expandedLineSet );
  } else {
    points = transformedPoints;
  }

  return math.pointInsidePolygonPoints( x, y, points );
};

math.joinLines = function( lineSet ){

  var vertices = new Array( lineSet.length / 2 );

  var currentLineStartX, currentLineStartY, currentLineEndX, currentLineEndY;
  var nextLineStartX, nextLineStartY, nextLineEndX, nextLineEndY;

  for( var i = 0; i < lineSet.length / 4; i++ ){
    currentLineStartX = lineSet[ i * 4];
    currentLineStartY = lineSet[ i * 4 + 1];
    currentLineEndX = lineSet[ i * 4 + 2];
    currentLineEndY = lineSet[ i * 4 + 3];

    if( i < lineSet.length / 4 - 1 ){
      nextLineStartX = lineSet[ (i + 1) * 4];
      nextLineStartY = lineSet[ (i + 1) * 4 + 1];
      nextLineEndX = lineSet[ (i + 1) * 4 + 2];
      nextLineEndY = lineSet[ (i + 1) * 4 + 3];
    } else {
      nextLineStartX = lineSet[0];
      nextLineStartY = lineSet[1];
      nextLineEndX = lineSet[2];
      nextLineEndY = lineSet[3];
    }

    var intersection = this.finiteLinesIntersect(
      currentLineStartX, currentLineStartY,
      currentLineEndX, currentLineEndY,
      nextLineStartX, nextLineStartY,
      nextLineEndX, nextLineEndY,
      true );

    vertices[ i * 2] = intersection[0];
    vertices[ i * 2 + 1] = intersection[1];
  }

  return vertices;
};

math.expandPolygon = function( points, pad ){

  var expandedLineSet = new Array( points.length * 2 );

  var currentPointX, currentPointY, nextPointX, nextPointY;

  for( var i = 0; i < points.length / 2; i++ ){
    currentPointX = points[ i * 2];
    currentPointY = points[ i * 2 + 1];

    if( i < points.length / 2 - 1 ){
      nextPointX = points[ (i + 1) * 2];
      nextPointY = points[ (i + 1) * 2 + 1];
    } else {
      nextPointX = points[0];
      nextPointY = points[1];
    }

    // Current line: [currentPointX, currentPointY] to [nextPointX, nextPointY]

    // Assume CCW polygon winding

    var offsetX = (nextPointY - currentPointY);
    var offsetY = -(nextPointX - currentPointX);

    // Normalize
    var offsetLength = Math.sqrt( offsetX * offsetX + offsetY * offsetY );
    var normalizedOffsetX = offsetX / offsetLength;
    var normalizedOffsetY = offsetY / offsetLength;

    expandedLineSet[ i * 4] = currentPointX + normalizedOffsetX * pad;
    expandedLineSet[ i * 4 + 1] = currentPointY + normalizedOffsetY * pad;
    expandedLineSet[ i * 4 + 2] = nextPointX + normalizedOffsetX * pad;
    expandedLineSet[ i * 4 + 3] = nextPointY + normalizedOffsetY * pad;
  }

  return expandedLineSet;
};

math.intersectLineEllipse = function(
  x, y, centerX, centerY, ellipseWradius, ellipseHradius ){

  var dispX = centerX - x;
  var dispY = centerY - y;

  dispX /= ellipseWradius;
  dispY /= ellipseHradius;

  var len = Math.sqrt( dispX * dispX + dispY * dispY );

  var newLength = len - 1;

  if( newLength < 0 ){
    return [];
  }

  var lenProportion = newLength / len;

  return [ (centerX - x) * lenProportion + x, (centerY - y) * lenProportion + y ];
};

// Returns intersections of increasing distance from line's start point
math.intersectLineCircle = function(
  x1, y1, x2, y2, centerX, centerY, radius ){

  // Calculate d, direction vector of line
  var d = [ x2 - x1, y2 - y1 ]; // Direction vector of line
  var c = [ centerX, centerY ]; // Center of circle
  var f = [ x1 - centerX, y1 - centerY ];

  var a = d[0] * d[0] + d[1] * d[1];
  var b = 2 * (f[0] * d[0] + f[1] * d[1]);
  var c = (f[0] * f[0] + f[1] * f[1]) - radius * radius ;

  var discriminant = b * b - 4 * a * c;

  if( discriminant < 0 ){
    return [];
  }

  var t1 = (-b + Math.sqrt( discriminant )) / (2 * a);
  var t2 = (-b - Math.sqrt( discriminant )) / (2 * a);

  var tMin = Math.min( t1, t2 );
  var tMax = Math.max( t1, t2 );
  var inRangeParams = [];

  if( tMin >= 0 && tMin <= 1 ){
    inRangeParams.push( tMin );
  }

  if( tMax >= 0 && tMax <= 1 ){
    inRangeParams.push( tMax );
  }

  if( inRangeParams.length === 0 ){
    return [];
  }

  var nearIntersectionX = inRangeParams[0] * d[0] + x1;
  var nearIntersectionY = inRangeParams[0] * d[1] + y1;

  if( inRangeParams.length > 1 ){

    if( inRangeParams[0] == inRangeParams[1] ){
      return [ nearIntersectionX, nearIntersectionY ];
    } else {

      var farIntersectionX = inRangeParams[1] * d[0] + x1;
      var farIntersectionY = inRangeParams[1] * d[1] + y1;

      return [ nearIntersectionX, nearIntersectionY, farIntersectionX, farIntersectionY ];
    }

  } else {
    return [ nearIntersectionX, nearIntersectionY ];
  }

};

math.findCircleNearPoint = function( centerX, centerY,
  radius, farX, farY ){

  var displacementX = farX - centerX;
  var displacementY = farY - centerY;
  var distance = Math.sqrt( displacementX * displacementX
    + displacementY * displacementY );

  var unitDisplacementX = displacementX / distance;
  var unitDisplacementY = displacementY / distance;

  return [ centerX + unitDisplacementX * radius,
    centerY + unitDisplacementY * radius ];
};

math.findMaxSqDistanceToOrigin = function( points ){
  var maxSqDistance = 0.000001;
  var sqDistance;

  for( var i = 0; i < points.length / 2; i++ ){

    sqDistance = points[ i * 2] * points[ i * 2]
      + points[ i * 2 + 1] * points[ i * 2 + 1];

    if( sqDistance > maxSqDistance ){
      maxSqDistance = sqDistance;
    }
  }

  return maxSqDistance;
};

math.midOfThree = function( a, b, c ){
  if( (b <= a && a <= c) || (c <= a && a <= b) ){
    return a;
  } else if( (a <= b && b <= c) || (c <= b && b <= a) ){
    return b;
  } else {
    return c;
  }
};

math.finiteLinesIntersect = function( x1, y1, x2, y2, x3, y3, x4, y4, infiniteLines ){

  var dx13 = x1 - x3;
  var dx21 = x2 - x1;
  var dx43 = x4 - x3;

  var dy13 = y1 - y3;
  var dy21 = y2 - y1;
  var dy43 = y4 - y3;

  var ua_t = dx43 * dy13 - dy43 * dx13;
  var ub_t = dx21 * dy13 - dy21 * dx13;
  var u_b  = dy43 * dx21 - dx43 * dy21;

  if( u_b !== 0 ){
    var ua = ua_t / u_b;
    var ub = ub_t / u_b;

    var flptThreshold = 0.001;
    var min = 0 - flptThreshold;
    var max = 1 + flptThreshold;

    if( min <= ua && ua <= max && min <= ub && ub <= max ){
      return [ x1 + ua * dx21, y1 + ua * dy21 ];

    } else {
      if( !infiniteLines ){
        return [];
      } else {
        return [ x1 + ua * dx21, y1 + ua * dy21 ];
      }
    }
  } else {
    if( ua_t === 0 || ub_t === 0 ){

      // Parallel, coincident lines. Check if overlap

      // Check endpoint of second line
      if( this.midOfThree( x1, x2, x4 ) === x4 ){
        return [ x4, y4 ];
      }

      // Check start point of second line
      if( this.midOfThree( x1, x2, x3 ) === x3 ){
        return [ x3, y3 ];
      }

      // Endpoint of first line
      if( this.midOfThree( x3, x4, x2 ) === x2 ){
        return [ x2, y2 ];
      }

      return [];
    } else {

      // Parallel, non-coincident
      return [];
    }
  }
};

math.polygonIntersectLine = function(
  x, y, basePoints, centerX, centerY, width, height, padding ){

  var intersections = [];
  var intersection;

  var transformedPoints = new Array( basePoints.length );

  for( var i = 0; i < transformedPoints.length / 2; i++ ){
    transformedPoints[ i * 2] = basePoints[ i * 2] * width + centerX;
    transformedPoints[ i * 2 + 1] = basePoints[ i * 2 + 1] * height + centerY;
  }

  var points;

  if( padding > 0 ){
    var expandedLineSet = math.expandPolygon(
      transformedPoints,
      -padding );

    points = math.joinLines( expandedLineSet );
  } else {
    points = transformedPoints;
  }
  // var points = transformedPoints;

  var currentX, currentY, nextX, nextY;

  for( var i = 0; i < points.length / 2; i++ ){

    currentX = points[ i * 2];
    currentY = points[ i * 2 + 1];

    if( i < points.length / 2 - 1 ){
      nextX = points[ (i + 1) * 2];
      nextY = points[ (i + 1) * 2 + 1];
    } else {
      nextX = points[0];
      nextY = points[1];
    }

    intersection = this.finiteLinesIntersect(
      x, y, centerX, centerY,
      currentX, currentY,
      nextX, nextY );

    if( intersection.length !== 0 ){
      intersections.push( intersection[0], intersection[1] );
    }
  }

  return intersections;
};

math.shortenIntersection = function(
  intersection, offset, amount ){

  var disp = [ intersection[0] - offset[0], intersection[1] - offset[1] ];

  var length = Math.sqrt( disp[0] * disp[0] + disp[1] * disp[1] );

  var lenRatio = (length - amount) / length;

  if( lenRatio < 0 ){
    lenRatio = 0.00001;
  }

  return [ offset[0] + lenRatio * disp[0], offset[1] + lenRatio * disp[1] ];
};

math.generateUnitNgonPointsFitToSquare = function( sides, rotationRadians ){
  var points = math.generateUnitNgonPoints( sides, rotationRadians );
  points = math.fitPolygonToSquare( points );

  return points;
};

math.fitPolygonToSquare = function( points ){
  var x, y;
  var sides = points.length / 2;
  var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for( var i = 0; i < sides; i++ ){
    x = points[2 * i ];
    y = points[2 * i + 1];

    minX = Math.min( minX, x );
    maxX = Math.max( maxX, x );
    minY = Math.min( minY, y );
    maxY = Math.max( maxY, y );
  }

  // stretch factors
  var sx = 2 / (maxX - minX);
  var sy = 2 / (maxY - minY);

  for( var i = 0; i < sides; i++ ){
    x = points[2 * i ] = points[2 * i ] * sx;
    y = points[2 * i + 1] = points[2 * i + 1] * sy;

    minX = Math.min( minX, x );
    maxX = Math.max( maxX, x );
    minY = Math.min( minY, y );
    maxY = Math.max( maxY, y );
  }

  if( minY < -1 ){
    for( var i = 0; i < sides; i++ ){
      y = points[2 * i + 1] = points[2 * i + 1] + (-1 - minY);
    }
  }

  return points;
};

math.generateUnitNgonPoints = function( sides, rotationRadians ){

  var increment = 1.0 / sides * 2 * Math.PI;
  var startAngle = sides % 2 === 0 ?
    Math.PI / 2.0 + increment / 2.0 : Math.PI / 2.0;
  //    console.log(nodeShapes['square']);
  startAngle += rotationRadians;

  var points = new Array( sides * 2 );

  var currentAngle, x, y;
  for( var i = 0; i < sides; i++ ){
    currentAngle = i * increment + startAngle;

    x = points[2 * i ] = Math.cos( currentAngle );// * (1 + i/2);
    y = points[2 * i + 1] = Math.sin( -currentAngle );//  * (1 + i/2);
  }

  return points;
};

math.getRoundRectangleRadius = function( width, height ){

  // Set the default radius, unless half of width or height is smaller than default
  return Math.min( width / 4, height / 4, 8 );
};

module.exports = math;
