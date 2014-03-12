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
        // This gives negative of the angle
        var angle = Math.asin(direction[1] / 
          (Math.sqrt(direction[0] * direction[0] 
            + direction[1] * direction[1])));
      
        var cos = Math.cos(-angle);
        var sin = Math.sin(-angle);
        
        var rotatedPoint = 
          [x * cos - y * sin,
            y * cos + x * sin];
        
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
      return 4;
    },
    
    gap: function(edge) {
      return 4;
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
      return edge._private.style['width'].pxValue * 2;
    }
  };

})( cytoscape );