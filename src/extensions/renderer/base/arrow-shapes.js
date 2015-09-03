'use strict';

var math = require('../../../math');
var is = require('../../../is');
var util = require('../../../util');

var BRp = {};

BRp.arrowShapeHeight = 0.3;

BRp.registerArrowShapes = function(){
  var arrowShapes = this.arrowShapes = {};
  var renderer = this;

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

  var bbCollide = function( x, y, centerX, centerY, width, height, direction, padding ){
    var x1 = centerX - width/2;
    var x2 = centerX + width/2;
    var y1 = centerY - height/2;
    var y2 = centerY + height/2;

    return (x1 <= x && x <= x2) && (y1 <= y && y <= y2);
  };

  var transform = function( x, y, size, angle, translation ){
    angle = -angle; // b/c of notation used in arrow draw fn

    var xRotated = x * Math.cos(angle) - y * Math.sin(angle);
    var yRotated = x * Math.sin(angle) + y * Math.cos(angle);

    var xScaled = xRotated * size;
    var yScaled = yRotated * size;

    var xTranslated = xScaled + translation.x;
    var yTranslated = yScaled + translation.y;

    return {
      x: xTranslated,
      y: yTranslated
    };
  };

  var transformPoints = function( pts, size, angle, translation ){
    var retPts = [];

    for( var i = 0; i < pts.length; i += 2 ){
      var x = pts[i];
      var y = pts[i + 1];

      retPts.push( transform(x, y, size, angle, translation) );
    }

    return retPts;
  };

  var defineArrowShape = function( name, defn ){
    if( is.string(defn) ){
      defn = arrowShapes[ defn ];
    }

    arrowShapes[ name ] = util.extend( {
      name: name,

      points: [
        -0.15, -0.3,
        0.15, -0.3,
        0.15, 0.3,
        -0.15, 0.3
      ],

      collide: function( x, y, centerX, centerY, width, height, direction, padding ){
        return math.pointInsidePolygon(
          x, y, this.points, centerX, centerY, width, height, direction, padding);
      },

      roughCollide: bbCollide,

      draw: function( context, size, angle, translation ){
        var points = transformPoints( this.points, size, angle, translation );

        renderer.arrowShapeImpl('polygon')( context, points );
      },

      spacing: function( edge ){
        return 0;
      },

      gap: function( edge ){
        return edge._private.style['width'].pxValue * 2;
      }
    }, defn );
  };

  defineArrowShape( 'none', {
    collide: util.falsify,

    roughCollide: util.falsify,

    draw: util.noop,

    spacing: util.zeroify,

    gap: util.zeroify
  } );

  defineArrowShape( 'triangle', {
    points: [
      -0.15, -0.3,
      0, 0,
      0.15, -0.3
    ]
  } );

  defineArrowShape( 'arrow', 'triangle' );

  defineArrowShape( 'triangle-backcurve', {
    points: arrowShapes['triangle'].points,

    controlPoint: [ 0, -0.15 ],

    roughCollide: bbCollide,

    draw: function( context, size, angle, translation ){
      var ptsTrans = transformPoints( this.points, size, angle, translation );
      var ctrlPt = this.controlPoint;
      var ctrlPtTrans = transform( ctrlPt[0], ctrlPt[1], size, angle, translation );

      renderer.arrowShapeImpl( this.name )( context, ptsTrans, ctrlPtTrans );
    },

    gap: function( edge ){
      return edge._private.style['width'].pxValue;
    }
  } );


  defineArrowShape( 'triangle-tee', {
    points: [
      -0.15, -0.3,
      0, 0,
      0.15, -0.3,
      -0.15, -0.3
    ],

    pointsTee: [
      -0.15, -0.4,
      -0.15, -0.5,
      0.15, -0.5,
      0.15, -0.4
    ],

    collide: function( x, y, centerX, centerY, width, height, direction, padding ){
      var triPts = this.points;
      var teePts = this.pointsTee;

      var inside = math.pointInsidePolygon(x, y, teePts, centerX, centerY, width, height, direction, padding)
        || math.pointInsidePolygon(x, y, triPts, centerX, centerY, width, height, direction, padding);

      return inside;
    },

    draw: function( context, size, angle, translation ){
      var triPts = transformPoints( this.points, size, angle, translation );
      var teePts = transformPoints( this.pointsTee, size, angle, translation );

      renderer.arrowShapeImpl( this.name )( context, triPts, teePts );
    }
  } );

  defineArrowShape( 'vee', {
    points: [
      -0.15, -0.3,
      0, 0,
      0.15, -0.3,
      0, -0.15,
    ],

    gap: function( edge ){
      return edge._private.style['width'].pxValue;
    }
  } );

  defineArrowShape( 'half-triangle-overshot', {
    points: [
      0, -0.25,
      -0.5, -0.25,
      0.5, 0.25
    ],

    leavePathOpen: true,

    matchEdgeWidth: true
  } );

  defineArrowShape( 'circle', {
    radius: 0.15,

    collide: function( x, y, centerX, centerY, width, height, direction, padding ){
      // Transform x, y to get non-rotated ellipse

      if (width != height ){
        var aspectRatio = (height + padding) / (width + padding);
        y /= aspectRatio;
        centerY /= aspectRatio;

        return (Math.pow(centerX - x, 2)
          + Math.pow(centerY - y, 2) <= Math.pow((width + padding)
            * this.radius, 2));
      } else {
        return (Math.pow(centerX - x, 2)
          + Math.pow(centerY - y, 2) <= Math.pow((width + padding)
            * this.radius, 2));
      }
    },

    draw: function( context, size, angle, translation ){
      renderer.arrowShapeImpl[ this.name ]( context, translation.x, translation.y, this.radius * size );
    },

    spacing: function( edge ){
      return renderer.getArrowWidth(edge._private.style['width'].pxValue)
        * this.radius;
    },
  } );

  defineArrowShape( 'inhibitor', {
    points: [
      -0.25, 0,
      -0.25, -0.1,
      0.25, -0.1,
      0.25, 0
    ],

    spacing: function( edge ){
      return 1;
    },

    gap: function( edge ){
      return 1;
    }
  } );

  defineArrowShape( 'tee', 'inhibitor' );

  defineArrowShape( 'square', {
    points: [
      -0.15, 0.00,
      0.15, 0.00,
      0.15, -0.3,
      -0.15, -0.3
    ]
  } );

  defineArrowShape( 'diamond', {
    points: [
      -0.15, -0.15,
      0, -0.3,
      0.15, -0.15,
      0, 0
    ],

    gap: function( edge ){
      return edge._private.style['width'].pxValue;
    }
  } );

};

module.exports = BRp;
