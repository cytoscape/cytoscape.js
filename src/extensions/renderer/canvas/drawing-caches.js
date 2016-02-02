'use strict';

var math = require( '../../../math' );

var CRp = {};

CRp.drawCachedElement = function( context, ele, pxRatio, extent ){
  var r = this;
  var _p = ele._private;
  var rs = _p.rscratch;
  var caches = rs.imgCaches = rs.imgCaches || {};
  var bb = ele.boundingBox();
  var zoom = r.cy.zoom();
  var lvl = Math.ceil( Math.log2( zoom ) );
  var cacheZoom = Math.pow( 2, lvl );
  var cache = caches[lvl];

  if( !cache ){
    var lvlCanvas = document.createElement('canvas');
    var lvlContext = lvlCanvas.getContext('2d');
    var scale = pxRatio * cacheZoom;

    lvlCanvas.width = scale * bb.w;
    lvlCanvas.height = scale * bb.h;

    lvlContext.scale( scale, scale );

    r.drawElement( lvlContext, ele, bb );

    lvlContext.scale( 1/scale, 1/scale );

    cache = caches[lvl] = {
      canvas: lvlCanvas,
      context: lvlContext
    };
  }

  if( math.boundingBoxesIntersect( bb, extent ) ){
    context.drawImage( cache.canvas, bb.x1, bb.y1, bb.w, bb.h );
  }
};

CRp.drawElement = function( context, ele, shiftToOriginWithBb ){
  var r = this;

  if( ele.isNode() ){
    r.drawNode( context, ele, shiftToOriginWithBb );
  } else {
    r.drawEdge( context, ele, shiftToOriginWithBb );
  }
};

module.exports = CRp;
