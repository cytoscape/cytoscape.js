;(function($$){ 'use strict';

  var CanvasRenderer = $$('renderer', 'canvas');
  var renderer = CanvasRenderer.prototype;
  var usePaths = CanvasRenderer.usePaths();

  // Node shape contract:
  //
  // draw: draw
  // intersectLine: report intersection from x, y, to node center
  // checkPoint: check x, y in node

  var nodeShapes = CanvasRenderer.nodeShapes = {};

  var sin0 = Math.sin(0);
  var cos0 = Math.cos(0);

  var sin = {};
  var cos = {};

  var ellipseStepSize = 0.1;

  for (var i = 0 * Math.PI; i < 2 * Math.PI; i += ellipseStepSize ) {
    sin[i] = Math.sin(i);
    cos[i] = Math.cos(i);
  }

  nodeShapes['ellipse'] = {
    draw: function(context, centerX, centerY, width, height) {
      nodeShapes['ellipse'].drawPath(context, centerX, centerY, width, height);
      context.fill();
    },

    drawPath: function(context, centerX, centerY, width, height) {

      if( usePaths ){
        if( context.beginPath ){ context.beginPath(); }

        var xPos, yPos;
        var rw = width/2;
        var rh = height/2;
        for (var i = 0 * Math.PI; i < 2 * Math.PI; i += ellipseStepSize ) {
            xPos = centerX - (rw * sin[i]) * sin0 + (rw * cos[i]) * cos0;
            yPos = centerY + (rh * cos[i]) * sin0 + (rh * sin[i]) * cos0;

            if (i === 0) {
                context.moveTo(xPos, yPos);
            } else {
                context.lineTo(xPos, yPos);
            }
        }
        context.closePath();

      } else {

        if( context.beginPath ){ context.beginPath(); }
        context.translate(centerX, centerY);
        context.scale(width / 2, height / 2);
        // At origin, radius 1, 0 to 2pi
        context.arc(0, 0, 1, 0, Math.PI * 2 * 0.999, false); // *0.999 b/c chrome rendering bug on full circle
        context.closePath();

        context.scale(2/width, 2/height);
        context.translate(-centerX, -centerY);

      }

    },

    intersectLine: function(nodeX, nodeY, width, height, x, y, padding) {
      var intersect = $$.math.intersectLineEllipse(
        x, y,
        nodeX,
        nodeY,
        width / 2 + padding,
        height / 2 + padding);

      return intersect;
    },

    intersectBox: function(
      x1, y1, x2, y2, width, height, centerX, centerY, padding) {

      return $$.math.boxIntersectEllipse(
        x1, y1, x2, y2, padding, width, height, centerX, centerY);
    },

    checkPoint: function(
      x, y, padding, width, height, centerX, centerY) {

//      console.log(arguments);

      x -= centerX;
      y -= centerY;

      x /= (width / 2 + padding);
      y /= (height / 2 + padding);

      return (Math.pow(x, 2) + Math.pow(y, 2) <= 1);
    }
  };

  function generatePolygon( name, points ){
    nodeShapes[name] = {
      points: points,

      draw: function(context, centerX, centerY, width, height) {
        renderer.drawPolygon(context,
          centerX, centerY,
          width, height,
          nodeShapes[name].points);
      },

      drawPath: function(context, centerX, centerY, width, height) {
        renderer.drawPolygonPath(context,
          centerX, centerY,
          width, height,
          nodeShapes[name].points);
      },

      intersectLine: function(nodeX, nodeY, width, height, x, y, padding) {
        return $$.math.polygonIntersectLine(
            x, y,
            nodeShapes[name].points,
            nodeX,
            nodeY,
            width / 2, height / 2,
            padding);
      },

      intersectBox: function(
        x1, y1, x2, y2,
        width, height, centerX,
        centerY, padding) {

        var points = nodeShapes[name].points;

        return $$.math.boxIntersectPolygon(
          x1, y1, x2, y2,
          points, width, height, centerX,
          centerY, [0, -1], padding);
      },

      checkPoint: function(
        x, y, padding, width, height, centerX, centerY) {

        return $$.math.pointInsidePolygon(x, y, nodeShapes[name].points,
          centerX, centerY, width, height, [0, -1], padding);
      }
    };
  }

  generatePolygon( 'triangle', $$.math.generateUnitNgonPointsFitToSquare(3, 0) );

  generatePolygon( 'square', $$.math.generateUnitNgonPointsFitToSquare(4, 0) );
  nodeShapes['rectangle'] = nodeShapes['square'];

  nodeShapes['roundrectangle'] = {
    points: $$.math.generateUnitNgonPointsFitToSquare(4, 0),

    draw: function(context, centerX, centerY, width, height) {
      renderer.drawRoundRectangle(context,
        centerX, centerY,
        width, height,
        10);
    },

    drawPath: function(context, centerX, centerY, width, height) {
      renderer.drawRoundRectanglePath(context,
        centerX, centerY,
        width, height,
        10);
    },

    intersectLine: function(nodeX, nodeY, width, height, x, y, padding) {
      return $$.math.roundRectangleIntersectLine(
          x, y,
          nodeX,
          nodeY,
          width, height,
          padding);
    },

    intersectBox: function(
      x1, y1, x2, y2,
      width, height, centerX,
      centerY, padding) {

      return $$.math.roundRectangleIntersectBox(
        x1, y1, x2, y2,
        width, height, centerX, centerY, padding);
    },

    // Looks like the width passed into this function is actually the total width / 2
    checkPoint: function(
      x, y, padding, width, height, centerX, centerY) {

      var cornerRadius = $$.math.getRoundRectangleRadius(width, height);

      // Check hBox
      if ($$.math.pointInsidePolygon(x, y, nodeShapes['roundrectangle'].points,
        centerX, centerY, width, height - 2 * cornerRadius, [0, -1], padding)) {
        return true;
      }

      // Check vBox
      if ($$.math.pointInsidePolygon(x, y, nodeShapes['roundrectangle'].points,
        centerX, centerY, width - 2 * cornerRadius, height, [0, -1], padding)) {
        return true;
      }

      var checkInEllipse = function(x, y, centerX, centerY, width, height, padding) {
        x -= centerX;
        y -= centerY;

        x /= (width / 2 + padding);
        y /= (height / 2 + padding);

        return (Math.pow(x, 2) + Math.pow(y, 2) <= 1);
      };


      // Check top left quarter circle
      if (checkInEllipse(x, y,
        centerX - width / 2 + cornerRadius,
        centerY - height / 2 + cornerRadius,
        cornerRadius * 2, cornerRadius * 2, padding)) {

        return true;
      }

      /*
      if (renderer.boxIntersectEllipse(x, y, x, y, padding,
        cornerRadius * 2, cornerRadius * 2,
        centerX - width + cornerRadius,
        centerY - height + cornerRadius)) {
        return true;
      }
      */

      // Check top right quarter circle
      if (checkInEllipse(x, y,
        centerX + width / 2 - cornerRadius,
        centerY - height / 2 + cornerRadius,
        cornerRadius * 2, cornerRadius * 2, padding)) {

        return true;
      }

      // Check bottom right quarter circle
      if (checkInEllipse(x, y,
        centerX + width / 2 - cornerRadius,
        centerY + height / 2 - cornerRadius,
        cornerRadius * 2, cornerRadius * 2, padding)) {

        return true;
      }

      // Check bottom left quarter circle
      if (checkInEllipse(x, y,
        centerX - width / 2 + cornerRadius,
        centerY + height / 2 - cornerRadius,
        cornerRadius * 2, cornerRadius * 2, padding)) {

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

  generatePolygon( 'pentagon', $$.math.generateUnitNgonPointsFitToSquare(5, 0) );

  generatePolygon( 'hexagon', $$.math.generateUnitNgonPointsFitToSquare(6, 0) );

  generatePolygon( 'heptagon', $$.math.generateUnitNgonPointsFitToSquare(7, 0) );

  generatePolygon( 'octagon', $$.math.generateUnitNgonPointsFitToSquare(8, 0) );

  var star5Points = new Array(20);
  {
    var outerPoints = $$.math.generateUnitNgonPoints(5, 0);
    var innerPoints = $$.math.generateUnitNgonPoints(5, Math.PI / 5);

  //  console.log(outerPoints);
  //  console.log(innerPoints);

    // Outer radius is 1; inner radius of star is smaller
    var innerRadius = 0.5 * (3 - Math.sqrt(5));
    innerRadius *= 1.57;

    for (var i=0;i<innerPoints.length/2;i++) {
      innerPoints[i*2] *= innerRadius;
      innerPoints[i*2+1] *= innerRadius;
    }

    for (var i=0;i<20/4;i++) {
      star5Points[i*4] = outerPoints[i*2];
      star5Points[i*4+1] = outerPoints[i*2+1];

      star5Points[i*4+2] = innerPoints[i*2];
      star5Points[i*4+3] = innerPoints[i*2+1];
    }

  //  console.log(star5Points);
  }

  star5Points = $$.math.fitPolygonToSquare( star5Points );

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

})( cytoscape );
