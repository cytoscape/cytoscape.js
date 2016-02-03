'use strict';

var math = require( '../../../math' );

var CRp = {};

CRp.getElementTextureCache = function( ele, bb, pxRatio ){
  var r = this;
  var rs = ele._private.rscratch;
  var minTxrH = 50; // the size of the texture cache for small height eles (special case)
  var txrStepH = 100; // the min size of the regular cache, and the size it increases with each step up
  var txrH; // which texture height this ele belongs to
  var maxA = 1e7; // the max area each texture should support
  var zoom = r.cy.zoom();
  var lvl = Math.ceil( Math.log2( zoom * pxRatio ) );
  var scale = Math.pow( 2, lvl );
  var eleScaledH = bb.h * scale;
  var eleScaledW = bb.w * scale;

  if( eleScaledH <= minTxrH ){
    txrH = minTxrH;
  } else if( eleScaledH <= txrStepH ){
    txrH = txrStepH;
  } else {
    txrH = Math.ceil( eleScaledH / txrStepH ) * txrStepH;
  }

  var txrQ = r.data.eleImgCaches[ txrH ] = r.data.eleImgCaches[ txrH ] || [];

  // first try the second last one in case it has space at the end
  var txr = txrQ[ txrQ.length - 2 ];

  var addNewTxr = function(){
    var txr = {};

    txrQ.push( txr );

    txr.height = txrH;
    txr.width = Math.ceil( maxA / txrH );
    txr.usedWidth = 0;

    txr.canvas = document.createElement('canvas');
    txr.canvas.width = txr.width;
    txr.canvas.height = txr.height;

    txr.context = txr.canvas.getContext('2d');

    return txr;
  };

  // try the last one if there is no second last one
  if( !txr ){
    txr = txrQ[ txrQ.length - 1 ];
  }

  // if the last one doesn't exist, we need a first one
  if( !txr ){
    txr = addNewTxr();
  }

  // if there's no room in the current texture, we need a new one
  if( txr.width - txr.usedWidth < eleScaledW ){
    txr = addNewTxr();
  }

  txr.context.translate( txr.usedWidth, 0 );
  txr.context.scale( scale, scale );

  r.drawElement( txr.context, ele, bb );

  txr.context.scale( 1/scale, 1/scale );
  txr.context.translate( -txr.usedWidth, 0 );

  var eleCache = caches[lvl] = {
    x: txr.usedWidth,
    texture: txr,
    level: lvl,
    width: eleScaledW,
    height: eleScaledH
  };

  txr.usedWidth += eleScaledW;

  return eleCache;
};

CRp.invalidateElementTextureCache = function( ele ){
  // TODO

  // for each cache the ele has

    // decrement used width in cache

    // invalidate all entries in the cache if the cache size is small

    // remove the cache references from the element
};


CRp.drawCachedElementShared = function( context, ele, pxRatio, extent ){
  var r = this;
  var _p = ele._private;
  var rs = _p.rscratch;
  var bb = ele.boundingBox();
  var cache = r.getElementTextureCache( ele, bb, pxRatio );

  if( math.boundingBoxesIntersect( bb, extent ) ){
    context.drawImage( cache.texture.canvas, cache.x, 0, cache.width, cache.height, bb.x1, bb.y1, bb.w, bb.h );
  }
};

CRp.drawCachedElementIndiv = function( context, ele, pxRatio, extent ){
  var r = this;
  var _p = ele._private;
  var rs = _p.rscratch;
  var caches = rs.imgCaches = rs.imgCaches || {};
  var bb = ele.boundingBox();
  var zoom = r.cy.zoom();
  var lvl = Math.ceil( Math.log2( zoom * pxRatio ) );
  var cacheZoom = Math.pow( 2, lvl );
  var cache = caches[lvl];

  if( !cache ){
    var lvlCanvas = document.createElement('canvas');
    var lvlContext = lvlCanvas.getContext('2d');
    var scale = cacheZoom;

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

// switch to compare individual and shared cache methods
CRp.drawCachedElement = CRp.drawCachedElementIndiv;

CRp.drawElement = function( context, ele, shiftToOriginWithBb ){
  var r = this;

  if( ele.isNode() ){
    r.drawNode( context, ele, shiftToOriginWithBb );
  } else {
    r.drawEdge( context, ele, shiftToOriginWithBb );
  }
};

module.exports = CRp;
