'use strict';

var math = require( '../../../math' );
var util = require( '../../../util' );
var Heap = require( '../../../heap' );

var CRp = {};

// TODO optimise these values

var deqEleCost = 0.2; // % of add'l rendering cost allowed for dequeuing ele caches each frame
var deqEleAvgCost = 0.1; // % of add'l rendering cost compared to average overall redraw time
var deqEleNoDrawCost = 0.5; // % of avg frame time that can be used for dequeueing when not drawing

var minTxrH = 25; // the size of the texture cache for small height eles (special case)
var txrStepH = 50; // the min size of the regular cache, and the size it increases with each step up
var minLvl = -4; // -4 => 0.00625 scale ; when scaling smaller than that we don't need to re-render
var maxLvl = 2; // 2 => 4 scale ; when larger than this scale just render directly (caching is not helpful)
var maxZoom = 3.99; // beyond this zoom level, textures are not used
var eleTxrSpacing = 4; // spacing between elements on textures to avoid blitting overlaps
var defTxrWidth = 8192; //4096; // default/minimum texture width
var minUtility = 0.5; // if usage of texture is less than this, it is retired
var maxFullness = 0.8; // fullness of texture after which queue removal is checked
var maxFullnessChecks = 10; // dequeued after this many checks
var maxDeqSize = 10; // number of eles to dequeue and render at higher texture in each batch
var deqRedrawThreshold = 100; // time to batch redraws together from dequeueing to allow more dequeueing calcs to happen in the meanwhile

var getTxrReasons = {
  dequeue: 'dequeue',
  downscale: 'downscale'
};

// the list of textures in which new subtextures for elements can be placed
var getTextureQueue = function( r, txrH ){
  window.qs = r.data.eleImgCaches;

  return r.data.eleImgCaches[ txrH ] = r.data.eleImgCaches[ txrH ] || [];
};

// the list of usused textures which can be recycled (in use in texture queue)
var getRetiredTextureQueue = function( r, txrH ){
  var rtxtrQs = r.data.eleImgCaches.retired = r.data.eleImgCaches.retired || {};
  var rtxtrQ = r.data.eleImgCaches.retired[ txrH ] = r.data.eleImgCaches.retired[ txrH ] || [];

  return rtxtrQ;
};

// queue of element draw requests at different scale levels
var getEleCacheQueue = function( r ){
  var q = r.data.eleCacheQueue = r.data.eleCacheQueue || new Heap(function( a, b ){
    return b.reqs - a.reqs;
  });

  return q;
};

// queue of element draw requests at different scale levels (element id lookup)
var getEleIdToCacheQueue = function( r ){
  var id2q = r.data.eleIdToCacheQueue = r.data.eleIdToCacheQueue || {};

  return id2q;
};

CRp.getElementTextureCache = function( ele, bb, pxRatio, lvl, reason ){
  var r = this;
  var rs = ele._private.rscratch;
  var zoom = r.cy.zoom();

  if( lvl == null ){
    lvl = Math.ceil( Math.log2( zoom * pxRatio ) );

    if( lvl < minLvl ){
      lvl = minLvl;
    } else if( zoom >= maxZoom || lvl > maxLvl ){
      return null;
    }
  }

  var scale = Math.pow( 2, lvl );
  var eleScaledH = bb.h * scale;
  var eleScaledW = bb.w * scale;
  var caches = rs.imgCaches = rs.imgCaches || {};
  var eleCache = caches[lvl];

  if( eleCache ){
    return eleCache;
  }

  var txrH; // which texture height this ele belongs to

  if( eleScaledH <= minTxrH ){
    txrH = minTxrH;
  } else if( eleScaledH <= txrStepH ){
    txrH = txrStepH;
  } else {
    txrH = Math.ceil( eleScaledH / txrStepH ) * txrStepH;
  }

  var txrQ = getTextureQueue( r, txrH );

  // first try the second last one in case it has space at the end
  var txr = txrQ[ txrQ.length - 2 ];

  var addNewTxr = function(){
    return r.recycleTexture( txrH, eleScaledW ) || r.addTexture( txrH, eleScaledW );
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

  var deqing = reason && reason === getTxrReasons.dequeue;

  var higherCache; // the nearest cache with a higher level
  for( var l = lvl + 1; l <= maxLvl; l++ ){
    var c = caches[l];

    if( c ){ higherCache = c; break; }
  }

  var oneUpCache = higherCache && higherCache.level === lvl + 1 ? higherCache : null;

  if( oneUpCache && deqing ){
    // then we can relatively cheaply rescale the existing image w/o rerendering

    txr.context.drawImage(
      oneUpCache.texture.canvas,
      oneUpCache.x, 0,
      oneUpCache.width, oneUpCache.height,
      txr.usedWidth, 0,
      eleScaledW, eleScaledH
    );
  } else if( higherCache ){
    // then use the higher cache for now and queue the next level down
    // to cheaply scale towards the smaller level

    r.queueElementCache( ele, bb, higherCache.level - 1 );

    return higherCache;
  } else {

    var lowerCache; // the nearest cache with a lower level
    if( !deqing ){
      for( var l = lvl - 1; l >= minLvl; l-- ){
        var c = caches[l];

        if( c ){ lowerCache = c; break; }
      }
    }

    if( lowerCache ){
      // then use the lower quality cache for now and queue the better one for later

      r.queueElementCache( ele, bb, lvl );

      return lowerCache;
    }

    txr.context.translate( txr.usedWidth, 0 );
    txr.context.scale( scale, scale );

    r.drawElement( txr.context, ele, bb );

    txr.context.scale( 1/scale, 1/scale );
    txr.context.translate( -txr.usedWidth, 0 );
  }

  eleCache = caches[lvl] = {
    ele: ele,
    x: txr.usedWidth,
    texture: txr,
    level: lvl,
    scale: scale,
    width: eleScaledW,
    height: eleScaledH
  };

  txr.usedWidth += Math.ceil( eleScaledW + eleTxrSpacing );

  txr.eleCaches.push( eleCache );

  r.checkTextureFullness( txr );

  return eleCache;
};

CRp.invalidateElementInTexture = function( ele ){
  var r = this;
  var caches = ele._private.rscratch.imgCaches;

  if( caches ){
    for( var lvl = minLvl; lvl <= maxLvl; lvl++ ){
      var cache = caches[ lvl ];

      if( cache ){
        var txr = cache.texture;

        // remove space from the texture it belongs to
        txr.invalidatedWidth += cache.width;

        // remove refs with the element
        caches[ lvl ] = null;
        util.removeFromArray( txr.eleCaches, cache );

        // might have to remove the entire texture if it's not efficiently using its space
        r.checkTextureUtility( txr );
      }
    }
  }
};

CRp.checkTextureUtility = function( txr ){
  // invalidate all entries in the cache if the cache size is small
  if( txr.invalidatedWidth >= minUtility * txr.width ){
    this.retireTexture( txr );
  }
};

CRp.checkTextureFullness = function( txr ){
  // if texture has been mostly filled and passed over several times, remove
  // it from the queue so we don't need to waste time looking at it to put new things

  var r = this;
  var txrQ = getTextureQueue( r, txr.height );

  if( txr.usedWidth / txr.width > maxFullness && txr.fullnessChecks >= maxFullnessChecks ){
    util.removeFromArray( txrQ, txr );
  } else {
    txr.fullnessChecks++;
  }
};

CRp.retireTexture = function( txr ){
  var r = this;
  var txrH = txr.height;
  var txrQ = getTextureQueue( r, txrH );

  // retire the texture from the active / searchable queue:

  util.removeFromArray( txrQ, txr );

  txr.retired = true;

  // remove the refs from the eles to the caches:

  var eleCaches = txr.eleCaches;

  for( var i = 0; i < eleCaches.length; i++ ){
    var eleCache = eleCaches[i];
    var ele = eleCache.ele;
    var lvl = eleCache.level;
    var imgCaches = ele._private.rscratch.imgCaches;

    if( imgCaches ){
      imgCaches[ lvl ] = null;
    }
  }

  util.clearArray( eleCaches );

  // add the texture to a retired queue so it can be recycled in future:

  var rtxtrQ = getRetiredTextureQueue( r, txrH );

  rtxtrQ.push( txr );
};

CRp.addTexture = function( txrH, minW ){
  var r = this;
  var txrQ = getTextureQueue( r, txrH );
  var txr = {};

  txrQ.push( txr );

  txr.eleCaches = [];

  txr.height = txrH;
  txr.width = Math.max( defTxrWidth, minW );
  txr.usedWidth = 0;
  txr.invalidatedWidth = 0;
  txr.fullnessChecks = 0;

  txr.canvas = document.createElement('canvas');
  txr.canvas.width = txr.width;
  txr.canvas.height = txr.height;

  txr.context = txr.canvas.getContext('2d');

  return txr;
};

CRp.recycleTexture = function( txrH, minW ){
  var r = this;
  var txrQ = getTextureQueue( r, txrH );
  var rtxtrQ = getRetiredTextureQueue( r, txrH );

  for( var i = 0; i < rtxtrQ.length; i++ ){
    var txr = rtxtrQ[i];

    if( txr.width >= minW ){
      txr.retired = false;

      txr.usedWidth = 0;
      txr.invalidatedWidth = 0;
      txr.fullnessChecks = 0;

      util.clearArray( txr.eleCaches );

      txr.context.clearRect( 0, 0, txr.width, txr.height );

      util.removeFromArray( rtxtrQ, txr );
      txrQ.push( txr );

      return txr;
    }
  }
};

CRp.queueElementCache = function( ele, bb, lvl ){
  var r = this;
  var q = getEleCacheQueue( r );
  var id2q = getEleIdToCacheQueue( r );
  var id = ele.id();
  var existingReq = id2q[ id ];

  if( existingReq ){ // use the max lvl b/c in between lvls are cheap to make
    existingReq.lvl = Math.max( existingReq.lvl, lvl );
    existingReq.reqs++;

    q.updateItem( existingReq );
  } else {
    var req = {
      ele: ele,
      bb: bb,
      lvl: lvl,
      reqs: 1
    };

    q.push( req );

    id2q[ id ] = req;
  }
};

CRp.dequeueElementCaches = function( pxRatio, extent ){
  var r = this;
  var q = getEleCacheQueue( r );
  var id2q = getEleIdToCacheQueue( r );
  var dequeued = [];

  for( var i = 0; i < maxDeqSize; i++ ){
    if( q.size() > 0 ){
      var req = q.pop();

      id2q[ req.ele.id() ] = null;

      dequeued.push( req );
      r.getElementTextureCache( req.ele, req.bb, pxRatio, req.lvl, getTxrReasons.dequeue );
    } else {
      break;
    }
  }

  return dequeued;
};

CRp.setupElementCacheDequeueing = function(){
  var r = this;

  if( r.data.eleCacheDeqSetup ){
    return;
  } else {
    r.data.eleCacheDeqSetup = true;
  }

  var queueRedraw = util.debounce( function(){
    r.redrawHint( 'eles', true );
    r.redrawHint( 'drag', true );

    r.redraw();
  }, deqRedrawThreshold );

  var dequeue = function( willDraw ){
    var startTime = util.performanceNow();
    var avgRenderTime = r.averageRedrawTime;
    var renderTime = r.lastRedrawTime;
    var deqd = [];
    var extent = r.cy.extent();
    var pixelRatio = r.getPixelRatio();

    while( true ){
      var duration = util.performanceNow() - startTime;

      if( willDraw ){
        if(
             duration > deqEleCost * renderTime
          || duration > deqEleAvgCost * avgRenderTime
        ){
          break;
        }
      } else if( duration > deqEleNoDrawCost * avgRenderTime ){
        break;
      }

      var thisDeqd = r.dequeueElementCaches( pixelRatio, extent );

      if( thisDeqd.length > 0 ){
        for( var i = 0; i < thisDeqd.length; i++ ){
          deqd.push( thisDeqd[i] );
        }
      } else {
        break;
      }
    }

    if( !willDraw && deqd.length > 0 ){
      var anyDeqdInViewport = false;

      for( var i = 0; i < deqd.length; i++ ){
        var bb = deqd[i].bb;

        if( math.boundingBoxesIntersect( bb, extent ) ){
          anyDeqdInViewport = true;
          break;
        }
      }

      if( anyDeqdInViewport ){
        queueRedraw();
      }
    }
  };

  r.beforeRender( dequeue );
};

CRp.drawCachedElement = function( context, ele, pxRatio, extent ){
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

CRp.drawElement = function( context, ele, shiftToOriginWithBb ){
  var r = this;

  if( ele.isNode() ){
    r.drawNode( context, ele, shiftToOriginWithBb );
  } else {
    r.drawEdge( context, ele, shiftToOriginWithBb );
  }
};

module.exports = CRp;
