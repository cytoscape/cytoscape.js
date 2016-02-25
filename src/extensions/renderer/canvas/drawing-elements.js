'use strict';

var math = require( '../../../math' );

var CRp = {};

CRp.drawCachedElement = function( context, ele, pxRatio, extent ){
  var r = this;
  var _p = ele._private;
  var rs = _p.rscratch;
  var bb = ele.boundingBox();

  if( math.boundingBoxesIntersect( bb, extent ) ){
    var cache = r.data.eleTxrCache.getElement( ele, bb, pxRatio );

    if( cache ){
      context.drawImage( cache.texture.canvas, cache.x, 0, cache.width, cache.height, bb.x1, bb.y1, bb.w, bb.h );
    } else { // if the element is not cacheable, then draw directly
      r.drawElement( context, ele );
    }
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

CRp.drawElements = function( context, eles, pxRatio, extent ){
  var r = this;

  for( var i = 0; i < eles.length; i++ ){
    var ele = eles[ i ];

    // r.drawElement( context, ele );
    r.drawCachedElement( context, ele, pxRatio, extent );
  }
};

module.exports = CRp;
