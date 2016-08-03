'use strict';

var CRp = {};

var impl;

CRp.arrowShapeImpl = function( name ){
  return ( impl || (impl = {
    'polygon': function( context, points ){
      for( var i = 0; i < points.length; i++ ){
        var pt = points[ i ];

        context.lineTo( pt.x, pt.y );
      }
    },

    'triangle-backcurve': function( context, points, controlPoint ){
      var firstPt;

      for( var i = 0; i < points.length; i++ ){
        var pt = points[ i ];

        if( i === 0 ){
          firstPt = pt;
        }

        context.lineTo( pt.x, pt.y );
      }

      context.quadraticCurveTo( controlPoint.x, controlPoint.y, firstPt.x, firstPt.y );
    },

    'triangle-tee': function( context, trianglePoints, teePoints ){
      if( context.beginPath ){ context.beginPath(); }

        var triPts = trianglePoints;
        for( var i = 0; i < triPts.length; i++ ){
          var pt = triPts[ i ];

          context.lineTo( pt.x, pt.y );
        }

      if( context.closePath ){ context.closePath(); }

      if( context.beginPath ){ context.beginPath(); }

        var teePts = teePoints;
        var firstTeePt = teePoints[0];
        context.moveTo( firstTeePt.x, firstTeePt.y );

        for( var i = 0; i < teePts.length; i++ ){
          var pt = teePts[ i ];

          context.lineTo( pt.x, pt.y );
        }

      if( context.closePath ){ context.closePath(); }
    },

    'circle': function( context, rx, ry, r ){
      context.arc( rx, ry, r, 0, Math.PI * 2, false );
    }
  }) )[ name ];
};

module.exports = CRp;
