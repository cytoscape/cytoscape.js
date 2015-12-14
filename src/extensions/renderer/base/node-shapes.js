'use strict';

var math = require( '../../../math' );

var BRp = {};

BRp.registerNodeShapes = function(){
  var nodeShapes = this.nodeShapes = {};
  var renderer = this;

  nodeShapes[ 'ellipse' ] = {
    name: 'ellipse',

    draw: function( context, centerX, centerY, width, height ){
      renderer.nodeShapeImpl( this.name )( context, centerX, centerY, width, height );
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
      x -= centerX;
      y -= centerY;

      x /= (width / 2 + padding);
      y /= (height / 2 + padding);

      return x * x + y * y <= 1;
    }
  };

  function generatePolygon( name, points ){
    return ( nodeShapes[ name ] = {
      name: name,

      points: points,

      draw: function( context, centerX, centerY, width, height ){
        renderer.nodeShapeImpl( 'polygon' )( context, centerX, centerY, width, height, this.points );
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
        return math.pointInsidePolygon( x, y, nodeShapes[ name ].points,
          centerX, centerY, width, height, [0, -1], padding )
        ;
      }
    } );
  }

  generatePolygon( 'triangle', math.generateUnitNgonPointsFitToSquare( 3, 0 ) );

  generatePolygon( 'square', math.generateUnitNgonPointsFitToSquare( 4, 0 ) );
  nodeShapes[ 'rectangle' ] = nodeShapes[ 'square' ];

  nodeShapes[ 'roundrectangle' ] = {
    name: 'roundrectangle',

    points: math.generateUnitNgonPointsFitToSquare( 4, 0 ),

    draw: function( context, centerX, centerY, width, height ){
      renderer.nodeShapeImpl( this.name )( context, centerX, centerY, width, height );
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

    // Looks like the width passed into this function is actually the total width / 2
    checkPoint: function(
      x, y, padding, width, height, centerX, centerY ){

      var cornerRadius = math.getRoundRectangleRadius( width, height );

      // Check hBox
      if( math.pointInsidePolygon( x, y, this.points,
        centerX, centerY, width, height - 2 * cornerRadius, [0, -1], padding ) ){
        return true;
      }

      // Check vBox
      if( math.pointInsidePolygon( x, y, this.points,
        centerX, centerY, width - 2 * cornerRadius, height, [0, -1], padding ) ){
        return true;
      }

      var checkInEllipse = function( x, y, centerX, centerY, width, height, padding ){
        x -= centerX;
        y -= centerY;

        x /= (width / 2 + padding);
        y /= (height / 2 + padding);

        return (x * x + y * y <= 1);
      };


      // Check top left quarter circle
      if( checkInEllipse( x, y,
        centerX - width / 2 + cornerRadius,
        centerY - height / 2 + cornerRadius,
        cornerRadius * 2, cornerRadius * 2, padding ) ){

        return true;
      }

      // Check top right quarter circle
      if( checkInEllipse( x, y,
        centerX + width / 2 - cornerRadius,
        centerY - height / 2 + cornerRadius,
        cornerRadius * 2, cornerRadius * 2, padding ) ){

        return true;
      }

      // Check bottom right quarter circle
      if( checkInEllipse( x, y,
        centerX + width / 2 - cornerRadius,
        centerY + height / 2 - cornerRadius,
        cornerRadius * 2, cornerRadius * 2, padding ) ){

        return true;
      }

      // Check bottom left quarter circle
      if( checkInEllipse( x, y,
        centerX - width / 2 + cornerRadius,
        centerY + height / 2 - cornerRadius,
        cornerRadius * 2, cornerRadius * 2, padding ) ){

        return true;
      }

      return false;
    }
  };

  generatePolygon( 'diamond', [
    0, 1,
    1, 0,
    0, -1,
    -1, 0
  ] );

  generatePolygon( 'pentagon', math.generateUnitNgonPointsFitToSquare( 5, 0 ) );

  generatePolygon( 'hexagon', math.generateUnitNgonPointsFitToSquare( 6, 0 ) );

  generatePolygon( 'heptagon', math.generateUnitNgonPointsFitToSquare( 7, 0 ) );

  generatePolygon( 'octagon', math.generateUnitNgonPointsFitToSquare( 8, 0 ) );

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

  generatePolygon( 'star', star5Points );

  generatePolygon( 'vee', [
    -1, -1,
    0, -0.333,
    1, -1,
    0, 1
  ] );

  generatePolygon( 'rhomboid', [
    -1, -1,
    0.333, -1,
    1, 1,
    -0.333, 1
  ] );

  nodeShapes.makePolygon = function( points ){

    // use caching on user-specified polygons so they are as fast as native shapes

    var key = points.join( '$' );
    var name = 'polygon-' + key;
    var shape;

    if( (shape = nodeShapes[ name ]) ){ // got cached shape
      return shape;
    }

    // create and cache new shape
    return generatePolygon( name, points );
  };

};

module.exports = BRp;
