var math = require('../../../math');

var BRp = {};

BRp.generatePolygon = function( name, points ){
  return ( this.nodeShapes[ name ] = {
    renderer: this,

    name: name,

    points: points,

    draw: function( context, centerX, centerY, width, height ){
      this.renderer.nodeShapeImpl( 'polygon', context, centerX, centerY, width, height, this.points );
    },

    intersectLine: function( nodeX, nodeY, width, height, x, y, padding ){
      return math.polygonIntersectLine(
          x, y,
          this.points,
          nodeX,
          nodeY,
          width / 2, height / 2,
          padding )
        ;
    },

    checkPoint: function( x, y, padding, width, height, centerX, centerY ){
      return math.pointInsidePolygon( x, y, this.points,
        centerX, centerY, width, height, [0, -1], padding )
      ;
    }
  } );
};

BRp.generateEllipse = function(){
  return ( this.nodeShapes['ellipse'] = {
    renderer: this,

    name: 'ellipse',

    draw: function( context, centerX, centerY, width, height ){
      this.renderer.nodeShapeImpl( this.name, context, centerX, centerY, width, height );
    },

    intersectLine: function( nodeX, nodeY, width, height, x, y, padding ){
      return math.intersectLineEllipse(
        x, y,
        nodeX,
        nodeY,
        width / 2 + padding,
        height / 2 + padding )
      ;
    },

    checkPoint: function( x, y, padding, width, height, centerX, centerY ){
      return math.checkInEllipse( x, y, width, height, centerX, centerY, padding );
    }
  } );
};

BRp.generateRoundRectangle = function(){
  return ( this.nodeShapes['roundrectangle'] = {
    renderer: this,

    name: 'roundrectangle',

    points: math.generateUnitNgonPointsFitToSquare( 4, 0 ),

    draw: function( context, centerX, centerY, width, height ){
      this.renderer.nodeShapeImpl( this.name, context, centerX, centerY, width, height );
    },

    intersectLine: function( nodeX, nodeY, width, height, x, y, padding ){
      return math.roundRectangleIntersectLine(
        x, y,
        nodeX,
        nodeY,
        width, height,
        padding )
      ;
    },

    checkPoint: function(
      x, y, padding, width, height, centerX, centerY ){

      var cornerRadius = math.getRoundRectangleRadius( width, height );
      var diam = cornerRadius * 2;

      // Check hBox
      if( math.pointInsidePolygon( x, y, this.points,
        centerX, centerY, width, height - diam, [0, -1], padding ) ){
        return true;
      }

      // Check vBox
      if( math.pointInsidePolygon( x, y, this.points,
        centerX, centerY, width - diam, height, [0, -1], padding ) ){
        return true;
      }

      // Check top left quarter circle
      if( math.checkInEllipse( x, y,
        diam, diam,
        centerX - width / 2 + cornerRadius,
        centerY - height / 2 + cornerRadius,
        padding ) ){

        return true;
      }

      // Check top right quarter circle
      if( math.checkInEllipse( x, y,
        diam, diam,
        centerX + width / 2 - cornerRadius,
        centerY - height / 2 + cornerRadius,
        padding ) ){

        return true;
      }

      // Check bottom right quarter circle
      if( math.checkInEllipse( x, y,
        diam, diam,
        centerX + width / 2 - cornerRadius,
        centerY + height / 2 - cornerRadius,
        padding ) ){

        return true;
      }

      // Check bottom left quarter circle
      if( math.checkInEllipse( x, y,
        diam, diam,
        centerX - width / 2 + cornerRadius,
        centerY + height / 2 - cornerRadius,
        padding ) ){

        return true;
      }

      return false;
    }
  } );
};

BRp.generateCutRectangle = function(){
  return ( this.nodeShapes['cutrectangle'] = {
    renderer: this,

    name: 'cutrectangle',

    cornerLength: math.getCutRectangleCornerLength(),

    points: math.generateUnitNgonPointsFitToSquare( 4, 0 ),

    draw: function( context, centerX, centerY, width, height ){
      this.renderer.nodeShapeImpl( this.name, context, centerX, centerY, width, height );
    },

    generateCutTrianglePts: function( width, height, centerX, centerY ){
      var cl = this.cornerLength;
      var hh = height / 2;
      var hw = width / 2;
      var xBegin = centerX - hw;
      var xEnd = centerX + hw;
      var yBegin = centerY - hh;
      var yEnd = centerY + hh;

      // points are in clockwise order, inner (imaginary) triangle pt on [4, 5]
      return {
        topLeft: [ xBegin, yBegin + cl, xBegin + cl, yBegin, xBegin + cl, yBegin + cl ],
        topRight: [ xEnd - cl, yBegin, xEnd, yBegin + cl, xEnd - cl, yBegin + cl ],
        bottomRight: [ xEnd, yEnd - cl, xEnd - cl, yEnd, xEnd - cl, yEnd - cl ],
        bottomLeft: [ xBegin + cl, yEnd, xBegin, yEnd - cl, xBegin + cl, yEnd - cl ]
      };
    },

    intersectLine: function( nodeX, nodeY, width, height, x, y, padding ){
      var cPts = this.generateCutTrianglePts( width + 2*padding, height+2*padding, nodeX, nodeY );
      var pts = [].concat.apply([],
       [cPts.topLeft.splice(0, 4), cPts.topRight.splice(0, 4),
         cPts.bottomRight.splice(0, 4), cPts.bottomLeft.splice(0, 4)
       ]);

      return math.polygonIntersectLine( x, y, pts, nodeX, nodeY );
    },

    checkPoint: function( x, y, padding, width, height, centerX, centerY ){
      // Check hBox
      if( math.pointInsidePolygon( x, y, this.points,
        centerX, centerY, width, height - 2 * this.cornerLength, [0, -1], padding ) ){
        return true;
      }

      // Check vBox
      if( math.pointInsidePolygon( x, y, this.points,
        centerX, centerY, width - 2 * this.cornerLength, height, [0, -1], padding ) ){
        return true;
      }
      var cutTrianglePts = this.generateCutTrianglePts(width, height, centerX, centerY);
      return math.pointInsidePolygonPoints( x, y, cutTrianglePts.topLeft)
       || math.pointInsidePolygonPoints( x, y, cutTrianglePts.topRight )
       || math.pointInsidePolygonPoints( x, y, cutTrianglePts.bottomRight )
       || math.pointInsidePolygonPoints( x, y, cutTrianglePts.bottomLeft );
    }

  } );
};

BRp.generateBarrel = function(){
  return ( this.nodeShapes['barrel'] = {
    renderer: this,

    name: 'barrel',

    points: math.generateUnitNgonPointsFitToSquare( 4, 0 ),

    draw: function( context, centerX, centerY, width, height ){
      this.renderer.nodeShapeImpl( this.name, context, centerX, centerY, width, height );
    },

    intersectLine: function( nodeX, nodeY, width, height, x, y, padding ){
      var bPts = this.generateBarrelBezierPts( width + 2*padding, height + 2*padding, nodeX, nodeY );

      var pts = [].concat(bPts.topLeft, bPts.topRight, bPts.bottomRight, bPts.bottomLeft);

      return math.polygonIntersectLine( x, y, pts, nodeX, nodeY );
    },

    generateBarrelBezierPts: function( width, height, centerX, centerY ){
      var hh = height / 2;
      var hw = width / 2;
      var xBegin = centerX - hw;
      var xEnd = centerX + hw;
      var yBegin = centerY - hh;
      var yEnd = centerY + hh;

      var curveConstants = math.getBarrelCurveConstants( width, height );
      var hOffset = curveConstants.heightOffset;
      var wOffset = curveConstants.widthOffset;
      var ctrlPtXOffset = curveConstants.ctrlPtOffsetPct * width;

      // points are in clockwise order, inner (imaginary) control pt on [4, 5]
      var pts = {
        topLeft: [ xBegin, yBegin + hOffset, xBegin + ctrlPtXOffset, yBegin, xBegin + wOffset, yBegin ],
        topRight: [ xEnd - wOffset, yBegin, xEnd - ctrlPtXOffset, yBegin, xEnd, yBegin + hOffset ],
        bottomRight: [ xEnd, yEnd - hOffset, xEnd - ctrlPtXOffset, yEnd, xEnd - wOffset, yEnd ],
        bottomLeft: [ xBegin + wOffset, yEnd, xBegin + ctrlPtXOffset, yEnd, xBegin, yEnd - hOffset ]
      };

      pts.topLeft.isTop = true;
      pts.topRight.isTop = true;
      pts.bottomLeft.isBottom = true;
      pts.bottomRight.isBottom = true;

      return pts;
    },

    checkPoint: function(
      x, y, padding, width, height, centerX, centerY ){

      var curveConstants = math.getBarrelCurveConstants( width, height );
      var hOffset = curveConstants.heightOffset;
      var wOffset = curveConstants.widthOffset;

      // Check hBox
      if( math.pointInsidePolygon( x, y, this.points,
        centerX, centerY, width, height - 2 *  hOffset, [0, -1], padding ) ){
        return true;
      }

      // Check vBox
      if( math.pointInsidePolygon( x, y, this.points,
        centerX, centerY, width - 2 * wOffset, height, [0, -1], padding ) ){
        return true;
      }

      var barrelCurvePts = this.generateBarrelBezierPts( width, height, centerX, centerY );

      var getCurveT = function (x, y, curvePts) {
        var x0 = curvePts[ 4 ];
        var x1 = curvePts[ 2 ];
        var x2 = curvePts[ 0 ];
        var y0 = curvePts[ 5 ];
        // var y1 = curvePts[ 3 ];
        var y2 = curvePts[ 1 ];

        var xMin = Math.min( x0, x2 );
        var xMax = Math.max( x0, x2 );
        var yMin = Math.min( y0, y2 );
        var yMax = Math.max( y0, y2 );

        if( xMin <= x && x <= xMax  && yMin <= y && y <= yMax ){
          var coeff = math.bezierPtsToQuadCoeff( x0, x1, x2 );
          var roots = math.solveQuadratic( coeff[0], coeff[1], coeff[2], x );

          var validRoots = roots.filter(function( r ){
            return 0 <= r && r <= 1;
          });

          if( validRoots.length > 0 ){
            return validRoots[ 0 ];
          }
        }
        return null;
      };

      var curveRegions = Object.keys( barrelCurvePts );
      for( var i = 0; i < curveRegions.length; i++ ){
        var corner = curveRegions[ i ];
        var cornerPts = barrelCurvePts[ corner ];
        var t = getCurveT( x, y, cornerPts );

        if( t == null ){ continue; }

        var y0 = cornerPts[ 5 ];
        var y1 = cornerPts[ 3 ];
        var y2 = cornerPts[ 1 ];
        var bezY = math.qbezierAt( y0, y1, y2, t );

        if( cornerPts.isTop && bezY <= y ){
          return true;
        }
        if( cornerPts.isBottom && y <= bezY ){
          return true;
        }
      }
      return false;
    }
  } );
};

BRp.generateBottomRoundrectangle = function(){
  return ( this.nodeShapes['bottomroundrectangle'] = {
    renderer: this,

    name: 'bottomroundrectangle',

    points: math.generateUnitNgonPointsFitToSquare( 4, 0 ),

    draw: function( context, centerX, centerY, width, height ){
      this.renderer.nodeShapeImpl( this.name, context, centerX, centerY, width, height );
    },

    intersectLine: function( nodeX, nodeY, width, height, x, y, padding ){
      var topStartX = nodeX - ( width / 2 + padding );
      var topStartY = nodeY - ( height / 2 + padding );
      var topEndY = topStartY;
      var topEndX = nodeX + ( width / 2 + padding );

      var topIntersections = math.finiteLinesIntersect(
        x, y, nodeX, nodeY, topStartX, topStartY, topEndX, topEndY, false );
      if( topIntersections.length > 0 ){
        return topIntersections;
      }

      return math.roundRectangleIntersectLine(
        x, y,
        nodeX,
        nodeY,
        width, height,
        padding )
      ;
    },

    checkPoint: function(
      x, y, padding, width, height, centerX, centerY ){

      var cornerRadius = math.getRoundRectangleRadius( width, height );
      var diam = 2 * cornerRadius;

      // Check hBox
      if( math.pointInsidePolygon( x, y, this.points,
        centerX, centerY, width, height - diam, [0, -1], padding ) ){
        return true;
      }

      // Check vBox
      if( math.pointInsidePolygon( x, y, this.points,
        centerX, centerY, width - diam, height, [0, -1], padding ) ){
        return true;
      }

      // check non-rounded top side
      var outerWidth = ( ( width / 2 ) + 2 * padding );
      var outerHeight = ( ( height / 2 ) + 2 * padding );
      var points = [
        centerX - outerWidth, centerY - outerHeight,
        centerX - outerWidth, centerY,
        centerX + outerWidth, centerY,
        centerX + outerWidth, centerY - outerHeight
      ];
      if( math.pointInsidePolygonPoints( x, y, points) ){
        return true;
      }

      // Check bottom right quarter circle
      if( math.checkInEllipse( x, y,
        diam, diam,
        centerX + width / 2 - cornerRadius,
        centerY + height / 2 - cornerRadius,
        padding ) ){

        return true;
      }

      // Check bottom left quarter circle
      if( math.checkInEllipse( x, y,
        diam, diam,
        centerX - width / 2 + cornerRadius,
        centerY + height / 2 - cornerRadius,
        padding ) ){

        return true;
      }

      return false;
    }
  } );
};


BRp.registerNodeShapes = function(){
  var nodeShapes = this.nodeShapes = {};
  var renderer = this;

  this.generateEllipse();

  this.generatePolygon( 'triangle', math.generateUnitNgonPointsFitToSquare( 3, 0 ) );

  this.generatePolygon( 'rectangle', math.generateUnitNgonPointsFitToSquare( 4, 0 ) );
  nodeShapes[ 'square' ] = nodeShapes[ 'rectangle' ];

  this.generateRoundRectangle();

  this.generateCutRectangle();

  this.generateBarrel();

  this.generateBottomRoundrectangle();

  this.generatePolygon( 'diamond', [
    0, 1,
    1, 0,
    0, -1,
    -1, 0
  ] );

  this.generatePolygon( 'pentagon', math.generateUnitNgonPointsFitToSquare( 5, 0 ) );

  this.generatePolygon( 'hexagon', math.generateUnitNgonPointsFitToSquare( 6, 0 ) );

  this.generatePolygon( 'heptagon', math.generateUnitNgonPointsFitToSquare( 7, 0 ) );

  this.generatePolygon( 'octagon', math.generateUnitNgonPointsFitToSquare( 8, 0 ) );

  var star5Points = new Array( 20 );
  {
    var outerPoints = math.generateUnitNgonPoints( 5, 0 );
    var innerPoints = math.generateUnitNgonPoints( 5, Math.PI / 5 );

    // Outer radius is 1; inner radius of star is smaller
    var innerRadius = 0.5 * (3 - Math.sqrt( 5 ));
    innerRadius *= 1.57;

    for( var i = 0;i < innerPoints.length / 2;i++ ){
      innerPoints[ i * 2] *= innerRadius;
      innerPoints[ i * 2 + 1] *= innerRadius;
    }

    for( var i = 0;i < 20 / 4;i++ ){
      star5Points[ i * 4] = outerPoints[ i * 2];
      star5Points[ i * 4 + 1] = outerPoints[ i * 2 + 1];

      star5Points[ i * 4 + 2] = innerPoints[ i * 2];
      star5Points[ i * 4 + 3] = innerPoints[ i * 2 + 1];
    }
  }

  star5Points = math.fitPolygonToSquare( star5Points );

  this.generatePolygon( 'star', star5Points );

  this.generatePolygon( 'vee', [
    -1, -1,
    0, -0.333,
    1, -1,
    0, 1
  ] );

  this.generatePolygon( 'rhomboid', [
    -1, -1,
    0.333, -1,
    1, 1,
    -0.333, 1
  ] );

  this.generatePolygon( 'concavehexagon', [
    -1, -0.95,
    -0.75, 0,
    -1, 0.95,
    1, 0.95,
    0.75, 0,
    1, -0.95
  ] );

  this.generatePolygon( 'tag', [
    -1, -1,
    0.25, -1,
    1, 0,
    0.25,1,
    -1, 1
  ]);

  nodeShapes.makePolygon = function( points ){

    // use caching on user-specified polygons so they are as fast as native shapes

    var key = points.join( '$' );
    var name = 'polygon-' + key;
    var shape;

    if( (shape = this[ name ]) ){ // got cached shape
      return shape;
    }

    // create and cache new shape
    return renderer.generatePolygon( name, points );
  };

};

module.exports = BRp;
