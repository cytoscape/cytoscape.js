;(function($$){ 'use strict';

  var CanvasRenderer = $$('renderer', 'canvas');
  var rendFunc = CanvasRenderer.prototype;
  var arrowShapes = CanvasRenderer.arrowShapes = {};

  CanvasRenderer.arrowShapeHeight = 0.3;

  // Contract for arrow shapes:
  // 0, 0 is arrow tip
  // (0, 1) is direction towards node
  // (1, 0) is right
  //
  // functional api:
  // collide: check x, y in shape
  // roughCollide: called before collide, no false negatives
  // draw: draw
  // spacing: dist(arrowTip, nodeBoundary)
  // gap: dist(edgeTip, nodeBoundary), edgeTip may != arrowTip

  var bbCollide = function(x, y, centerX, centerY, width, height, direction, padding){
    var x1 = centerX - width/2;
    var x2 = centerX + width/2;
    var y1 = centerY - height/2;
    var y2 = centerY + height/2;

    return (x1 <= x && x <= x2) && (y1 <= y && y <= y2);
  };

  arrowShapes['arrow'] = {
    _points: [
      -0.15, -0.3,
      0, 0,
      0.15, -0.3
    ],
    
    collide: function(x, y, centerX, centerY, width, height, direction, padding) {
      var points = arrowShapes['arrow']._points;
      
//      console.log("collide(): " + direction);
      
      return $$.math.pointInsidePolygon(
        x, y, points, centerX, centerY, width, height, direction, padding);
    },
    
    roughCollide: bbCollide,
    
    draw: function(context) {
      var points = arrowShapes['arrow']._points;
    
      for (var i = 0; i < points.length / 2; i++) {
        context.lineTo(points[i * 2], points[i * 2 + 1]);
      }

    },
    
    spacing: function(edge) {
      return 0;
    },
    
    gap: function(edge) {
      return edge._private.style['width'].pxValue * 2;
    }
  };

  arrowShapes['triangle'] = arrowShapes['arrow'];
  
  arrowShapes['triangle-backcurve'] = {
    _ctrlPt: [ 0, -0.15 ],

    collide: function(x, y, centerX, centerY, width, height, direction, padding) {
      var points = arrowShapes['triangle']._points;
      
//      console.log("collide(): " + direction);
      
      return $$.math.pointInsidePolygon(
        x, y, points, centerX, centerY, width, height, direction, padding);
    },
    
    roughCollide: bbCollide,
    
    draw: function(context) {
      var points = arrowShapes['triangle']._points;
    
      for (var i = 0; i < points.length / 2; i++) {
        context.lineTo(points[i * 2], points[i * 2 + 1]);
      }

      var ctrlPt = this._ctrlPt;

      context.quadraticCurveTo( ctrlPt[0], ctrlPt[1], points[0], points[1] );
    },
    
    spacing: function(edge) {
      return 0;
    },
    
    gap: function(edge) {
      return edge._private.style['width'].pxValue * 2;
    }
  };
  

  arrowShapes['triangle-tee'] = {
    _points: [
      -0.15, -0.3,
      0, 0,
      0.15, -0.3,
      -0.15, -0.3
    ],

    _pointsTee: [
      -0.15, -0.4,
      -0.15, -0.5,
      0.15, -0.5,
      0.15, -0.4
    ],
    
    collide: function(x, y, centerX, centerY, width, height, direction, padding) {
      var triPts = arrowShapes['triangle-tee']._points;
      var teePts = arrowShapes['triangle-tee']._pointsTee;
      
      var inside = $$.math.pointInsidePolygon(x, y, triPts, centerX, centerY, width, height, direction, padding) 
        || $$.math.pointInsidePolygon(x, y, triPts, centerX, centerY, width, height, direction, padding);

      return inside;
    },
    
    roughCollide: bbCollide,
    
    draw: function(context) {
      var triPts = arrowShapes['triangle-tee']._points;
      for (var i = 0; i < triPts.length / 2; i++){
        var pt1 = triPts[ i * 2 ];
        var pt2 = triPts[ i * 2 + 1 ];
        
        context.lineTo( pt1, pt2 );
      }

      var teePts = arrowShapes['triangle-tee']._pointsTee;
      context.moveTo( teePts[0], teePts[1] );
      for (var i = 0; i < teePts.length / 2; i++){
        var pt1 = teePts[ i * 2 ];
        var pt2 = teePts[ i * 2 + 1 ];
        
        context.lineTo( pt1, pt2 );
      }
    },
    
    spacing: function(edge) {
      return 0;
    },
    
    gap: function(edge) {
      return edge._private.style['width'].pxValue * 2;
    }
  };

  arrowShapes['none'] = {
    collide: function(x, y, centerX, centerY, width, height, direction, padding) {
      return false;
    },
    
    roughCollide: function(x, y, centerX, centerY, width, height, direction, padding) {
      return false;
    },
    
    draw: function(context) {
    },
    
    spacing: function(edge) {
      return 0;
    },
    
    gap: function(edge) {
      return 0;
    }
  };
  
  arrowShapes['circle'] = {
    _baseRadius: 0.15,
    
    collide: function(x, y, centerX, centerY, width, height, direction, padding) {
      // Transform x, y to get non-rotated ellipse
      
      if (width != height) {                  
        var aspectRatio = (height + padding) / (width + padding);
        y /= aspectRatio;
        centerY /= aspectRatio;
        
        return (Math.pow(centerX - x, 2) 
          + Math.pow(centerY - y, 2) <= Math.pow((width + padding)
            * arrowShapes['circle']._baseRadius, 2));
      } else {
        return (Math.pow(centerX - x, 2) 
          + Math.pow(centerY - y, 2) <= Math.pow((width + padding)
            * arrowShapes['circle']._baseRadius, 2));
      }
    },
    
    roughCollide: bbCollide,
    
    draw: function(context) {
      context.arc(0, 0, arrowShapes['circle']._baseRadius, 0, Math.PI * 2, false);
    },
    
    spacing: function(edge) {
      return rendFunc.getArrowWidth(edge._private.style['width'].pxValue)
        * arrowShapes['circle']._baseRadius;
    },
    
    gap: function(edge) {
      return edge._private.style['width'].pxValue * 2;
    }
  };
  
  arrowShapes['inhibitor'] = {
    _points: [
      -0.25, 0,
      -0.25, -0.1,
      0.25, -0.1,
      0.25, 0
    ],
    
    collide: function(x, y, centerX, centerY, width, height, direction, padding) {
      var points = arrowShapes['inhibitor']._points;
      
      return $$.math.pointInsidePolygon(
        x, y, points, centerX, centerY, width, height, direction, padding);
    },
    
    roughCollide: bbCollide,
    
    draw: function(context) {
      var points = arrowShapes['inhibitor']._points;
      
      for (var i = 0; i < points.length / 2; i++) {
        context.lineTo(points[i * 2], points[i * 2 + 1]);
      }
    },
    
    spacing: function(edge) {
      return 1;
    },
    
    gap: function(edge) {
      return 1;
    }
  };

  arrowShapes['tee'] = arrowShapes['inhibitor'];

  arrowShapes['square'] = {
    _points: [
      -0.12, 0.00,
      0.12, 0.00,
      0.12, -0.24,
      -0.12, -0.24
    ],
    
    collide: function(x, y, centerX, centerY, width, height, direction, padding) {
      var points = arrowShapes['square']._points;
      
      return $$.math.pointInsidePolygon(
        x, y, points, centerX, centerY, width, height, direction, padding);
    },
    
    roughCollide: bbCollide,
    
    draw: function(context) {
      var points = arrowShapes['square']._points;
    
      for (var i = 0; i < points.length / 2; i++) {
        context.lineTo(points[i * 2], points[i * 2 + 1]);
      }
    },
    
    spacing: function(edge) {
      return 0;
    },

    gap: function(edge) {
      return edge._private.style['width'].pxValue * 2;
    }
  };

  arrowShapes['diamond'] = {
    _points: [
      -0.14, -0.14,
      0, -0.28,
      0.14, -0.14,
      0, 0
    ],

    collide: function(x, y, centerX, centerY, width, height, direction, padding) {
      var points = arrowShapes['diamond']._points;
          
      return $$.math.pointInsidePolygon(
        x, y, points, centerX, centerY, width, height, direction, padding);
    },

    roughCollide: bbCollide,

    draw: function(context) {
      context.lineTo(-0.14, -0.14);
      context.lineTo(0, -0.28);
      context.lineTo(0.14, -0.14);
      context.lineTo(0, 0.0);
    },
    
    spacing: function(edge) {
      return 0;
    },
    
    gap: function(edge) {
      return edge._private.style['width'].pxValue;
    }
  };

})( cytoscape );