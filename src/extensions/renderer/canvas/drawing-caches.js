'use strict';

var math = require( '../../../math' );

var CRp = {};

var minLvl = -2; // -2 => 0.25 scale ; when scaling smaller than that we don't need to re-render
var maxLvl = 3; // 3 => 8 scale ; when larger than this scale just render directly (caching is not helpful)
var maxZoom = 4; // TODO this value may need tweaking/optimising
var eleTxrSpacing = 1; // spacing between elements on textures to avoid blitting overlaps (only need 1 b/c of rounding)

CRp.getElementTextureCache = function( ele, bb, pxRatio ){
  var r = this;
  var rs = ele._private.rscratch;
  var minTxrH = 50; // the size of the texture cache for small height eles (special case)
  var txrStepH = 100; // the min size of the regular cache, and the size it increases with each step up
  var txrH; // which texture height this ele belongs to
  var maxA = 1e6; // the max area each texture should support
  var zoom = r.cy.zoom();
  var lvl = Math.ceil( Math.log2( zoom * pxRatio ) );

  if( lvl < minLvl ){
    lvl = minLvl;
  } else if( zoom >= maxZoom || lvl > maxLvl ){
    return null;
  }

  var scale = Math.pow( 2, lvl );
  var eleScaledH = bb.h * scale;
  var eleScaledW = bb.w * scale;
  var caches = rs.imgCaches = rs.imgCaches || {};
  var eleCache = caches[lvl];

  if( eleCache ){
    return eleCache;
  }

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

    txr.queue = txrQ;

    txr.height = txrH;
    txr.width = Math.max( 1000, eleScaledW ); // TODO this size needs optimising!!
    txr.usedWidth = 0;
    txr.invalidatedWidth = 0;

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

  eleCache = caches[lvl] = {
    x: txr.usedWidth,
    texture: txr,
    level: lvl,
    scale: scale,
    width: eleScaledW,
    height: eleScaledH
  };

  txr.usedWidth += eleScaledW + eleTxrSpacing;

  return eleCache;
};

CRp.invalidateElementTextureCaches = function( eles ){
  if( eles ){
    for( var i = 0; i < eles.length; i++ ){
      this.invalidateElementTextureCache( eles[i] );
    }
  }
};

CRp.invalidateElementTextureCache = function( ele ){
  var caches = ele._private.rscratch.imgCaches;

  if( caches ){
    for( var lvl = minLvl; lvl <= maxLvl; lvl++ ){
      var cache = caches[ lvl ];

      if( cache ){
        // remove space from the texture it belongs to
        cache.texture.invalidatedWidth += cache.width;

        // remove refs from the element
        caches[ lvl ] = null;

        // TODO invalidate all entries in the cache if the cache size is small
      }
    }
  }
};

CRp.drawCachedElementShared = function( context, ele, pxRatio, extent ){
  var r = this;
  var _p = ele._private;
  var rs = _p.rscratch;
  var bb = ele.boundingBox();

  if( math.boundingBoxesIntersect( bb, extent ) ){
    var cache = r.getElementTextureCache( ele, bb, pxRatio );

    if( cache ){
      context.drawImage( cache.texture.canvas, cache.x, 0, cache.width, cache.height, bb.x1, bb.y1, bb.w, bb.h );
    } else { // if the element is not cacheable, then draw directly
      r.drawElement( context, ele );
    }
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
CRp.drawCachedElement = CRp.drawCachedElementShared;

CRp.drawElement = function( context, ele, shiftToOriginWithBb ){
  var r = this;

  if( ele.isNode() ){
    r.drawNode( context, ele, shiftToOriginWithBb );
  } else {
    r.drawEdge( context, ele, shiftToOriginWithBb );
  }
};

module.exports = CRp;
