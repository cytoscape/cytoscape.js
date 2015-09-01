;(function($$){ 'use strict';

  var CanvasRenderer = $$('renderer', 'canvas');
  var renderer = CanvasRenderer.prototype;
  
  renderer.drawNodeShape = {
    'ellipse': function( context, centerX, centerY, width, height ){
      renderer.drawEllipsePath( context, centerX, centerY, width, height );
    },

    'polygon': function( context, centerX, centerY, width, height, points ){
      renderer.drawPolygonPath(context,
        centerX, centerY,
        width, height,
        points)
      ;
    },

    'roundrectangle': function( context, centerX, centerY, width, height ){
      renderer.drawRoundRectanglePath(context,
        centerX, centerY,
        width, height,
        10)
      ;
    }
  };

})( cytoscape );
