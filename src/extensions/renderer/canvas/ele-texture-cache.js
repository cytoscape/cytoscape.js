'use strict';

var math = require( '../../../math' );
var util = require( '../../../util' );
var Heap = require( '../../../heap' );
var defs = require( './texture-cache-defs' );

var minTxrH = 25; // the size of the texture cache for small height eles (special case)
var txrStepH = 50; // the min size of the regular cache, and the size it increases with each step up
var minLvl = -4; // when scaling smaller than that we don't need to re-render
var maxLvl = 2; // when larger than this scale just render directly (caching is not helpful)
var maxZoom = 3.99; // beyond this zoom level, layered textures are not used
var eleTxrSpacing = 8; // spacing between elements on textures to avoid blitting overlaps
var defTxrWidth = 1024; // default/minimum texture width
var maxTxrW = 1024; // the maximum width of a texture
var maxTxrH = 1024;  // the maximum height of a texture
var minUtility = 0.5; // if usage of texture is less than this, it is retired
var maxFullness = 0.8; // fullness of texture after which queue removal is checked
var maxFullnessChecks = 10; // dequeued after this many checks
var allowEdgeTxrCaching = false; // whether edges can be cached as textures (TODO maybe better on if webgl supported?)
var allowParentTxrCaching = false; // whether parent nodes can be cached as textures (TODO maybe better on if webgl supported?)
var deqCost = 0.15; // % of add'l rendering cost allowed for dequeuing ele caches each frame
var deqAvgCost = 0.1; // % of add'l rendering cost compared to average overall redraw time
var deqNoDrawCost = 0.9; // % of avg frame time that can be used for dequeueing when not drawing
var deqFastCost = 0.9; // % of frame time to be used when >60fps
var deqRedrawThreshold = 100; // time to batch redraws together from dequeueing to allow more dequeueing calcs to happen in the meanwhile
var maxDeqSize = 1; // number of eles to dequeue and render at higher texture in each batch

var getTxrReasons = {
  dequeue: 'dequeue',
  downscale: 'downscale',
  highQuality: 'highQuality'
};

var ElementTextureCache = function( renderer ){
  var self = this;

  self.renderer = renderer;
  self.onDequeues = [];

  self.setupDequeueing();
};

var ETCp = ElementTextureCache.prototype;

ETCp.reasons = getTxrReasons;

// the list of textures in which new subtextures for elements can be placed
ETCp.getTextureQueue = function( txrH ){
  var self = this;
  self.eleImgCaches = self.eleImgCaches || {};

  return ( self.eleImgCaches[ txrH ] = self.eleImgCaches[ txrH ] || [] );
};

// the list of usused textures which can be recycled (in use in texture queue)
ETCp.getRetiredTextureQueue = function( txrH ){
  var self = this;

  var rtxtrQs = self.eleImgCaches.retired = self.eleImgCaches.retired || {};
  var rtxtrQ = rtxtrQs[ txrH ] = rtxtrQs[ txrH ] || [];

  return rtxtrQ;
};

// queue of element draw requests at different scale levels
ETCp.getElementQueue = function(){
  var self = this;

  var q = self.eleCacheQueue = self.eleCacheQueue || new Heap(function( a, b ){
    return b.reqs - a.reqs;
  });

  return q;
};

// queue of element draw requests at different scale levels (element id lookup)
ETCp.getElementIdToQueue = function(){
  var self = this;

  var id2q = self.eleIdToCacheQueue = self.eleIdToCacheQueue || {};

  return id2q;
};

ETCp.getElement = function( ele, bb, pxRatio, lvl, reason ){
  var self = this;
  var r = this.renderer;
  var rs = ele._private.rscratch;
  var zoom = r.cy.zoom();

  if( bb.w === 0 || bb.h === 0 ){ return null; }

  if( lvl == null ){
    lvl = Math.ceil( math.log2( zoom * pxRatio ) );
  }

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

  var txrH; // which texture height this ele belongs to

  if( eleScaledH <= minTxrH ){
    txrH = minTxrH;
  } else if( eleScaledH <= txrStepH ){
    txrH = txrStepH;
  } else {
    txrH = Math.ceil( eleScaledH / txrStepH ) * txrStepH;
  }

  if(
    eleScaledH > maxTxrH
    || eleScaledW > maxTxrW
    || ( !allowEdgeTxrCaching && ele.isEdge() )
    || ( !allowParentTxrCaching && ele.isParent() )
  ){
    return null; // caching large elements is not efficient
  }

  var txrQ = self.getTextureQueue( txrH );

  // first try the second last one in case it has space at the end
  var txr = txrQ[ txrQ.length - 2 ];

  var addNewTxr = function(){
    return self.recycleTexture( txrH, eleScaledW ) || self.addTexture( txrH, eleScaledW );
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

  var scaledLabelShown = r.eleTextBiggerThanMin( ele, scale );
  var scalableFrom = function( otherCache ){
    return otherCache && otherCache.scaledLabelShown === scaledLabelShown;
  };

  var deqing = reason && reason === getTxrReasons.dequeue;
  var highQualityReq = reason && reason === getTxrReasons.highQuality;
  var downscaleReq = reason && reason === getTxrReasons.downscale;

  var higherCache; // the nearest cache with a higher level
  for( var l = lvl + 1; l <= maxLvl; l++ ){
    var c = caches[l];

    if( c ){ higherCache = c; break; }
  }

  var oneUpCache = higherCache && higherCache.level === lvl + 1 ? higherCache : null;

  var downscale = function(){
    txr.context.drawImage(
      oneUpCache.texture.canvas,
      oneUpCache.x, 0,
      oneUpCache.width, oneUpCache.height,
      txr.usedWidth, 0,
      eleScaledW, eleScaledH
    );
  };

  if( scalableFrom(oneUpCache) ){
    // then we can relatively cheaply rescale the existing image w/o rerendering
    downscale();

  } else if( scalableFrom(higherCache) ){
    // then use the higher cache for now and queue the next level down
    // to cheaply scale towards the smaller level

    if( highQualityReq ){
      for( var l = higherCache.level; l > lvl; l-- ){
        oneUpCache = self.getElement( ele, bb, pxRatio, l, getTxrReasons.downscale );
      }

      downscale();

    } else {
      self.queueElement( ele, bb, higherCache.level - 1 );

      return higherCache;
    }
  } else {

    var lowerCache; // the nearest cache with a lower level
    if( !deqing && !highQualityReq && !downscaleReq ){
      for( var l = lvl - 1; l >= minLvl; l-- ){
        var c = caches[l];

        if( c ){ lowerCache = c; break; }
      }
    }

    if( scalableFrom(lowerCache) ){
      // then use the lower quality cache for now and queue the better one for later

      self.queueElement( ele, bb, lvl );

      return lowerCache;
    }

    txr.context.translate( txr.usedWidth, 0 );
    txr.context.scale( scale, scale );

    r.drawElement( txr.context, ele, bb, scaledLabelShown );

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
    height: eleScaledH,
    scaledLabelShown: scaledLabelShown
  };

  txr.usedWidth += Math.ceil( eleScaledW + eleTxrSpacing );

  txr.eleCaches.push( eleCache );

  self.checkTextureFullness( txr );

  return eleCache;
};

ETCp.invalidateElement = function( ele ){
  var self = this;
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
        self.checkTextureUtility( txr );
      }
    }
  }
};

ETCp.checkTextureUtility = function( txr ){
  // invalidate all entries in the cache if the cache size is small
  if( txr.invalidatedWidth >= minUtility * txr.width ){
    this.retireTexture( txr );
  }
};

ETCp.checkTextureFullness = function( txr ){
  // if texture has been mostly filled and passed over several times, remove
  // it from the queue so we don't need to waste time looking at it to put new things

  var self = this;
  var txrQ = self.getTextureQueue( txr.height );

  if( txr.usedWidth / txr.width > maxFullness && txr.fullnessChecks >= maxFullnessChecks ){
    util.removeFromArray( txrQ, txr );
  } else {
    txr.fullnessChecks++;
  }
};

ETCp.retireTexture = function( txr ){
  var self = this;
  var txrH = txr.height;
  var txrQ = self.getTextureQueue( txrH );

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

  var rtxtrQ = self.getRetiredTextureQueue( txrH );

  rtxtrQ.push( txr );
};

ETCp.addTexture = function( txrH, minW ){
  var self = this;
  var txrQ = self.getTextureQueue( txrH );
  var txr = {};

  txrQ.push( txr );

  txr.eleCaches = [];

  txr.height = txrH;
  txr.width = Math.max( defTxrWidth, minW );
  txr.usedWidth = 0;
  txr.invalidatedWidth = 0;
  txr.fullnessChecks = 0;

  txr.canvas = document.createElement('canvas'); // eslint-disable-line no-undef
  txr.canvas.width = txr.width;
  txr.canvas.height = txr.height;

  txr.context = txr.canvas.getContext('2d');

  return txr;
};

ETCp.recycleTexture = function( txrH, minW ){
  var self = this;
  var txrQ = self.getTextureQueue( txrH );
  var rtxtrQ = self.getRetiredTextureQueue( txrH );

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

ETCp.queueElement = function( ele, bb, lvl ){
  var self = this;
  var q = self.getElementQueue();
  var id2q = self.getElementIdToQueue();
  var id = ele.id();
  var existingReq = id2q[ id ];

  if( existingReq ){ // use the max lvl b/c in between lvls are cheap to make
    existingReq.level = Math.max( existingReq.level, lvl );
    existingReq.reqs++;

    q.updateItem( existingReq );
  } else {
    var req = {
      ele: ele,
      bb: bb,
      position: math.copyPosition( ele.position() ),
      level: lvl,
      reqs: 1
    };

    if( ele.isEdge() ){
      req.positions = {
        source: math.copyPosition( ele.source().position() ),
        target: math.copyPosition( ele.target().position() )
      };
    }

    q.push( req );

    id2q[ id ] = req;
  }
};

ETCp.dequeue = function( pxRatio, extent ){
  var self = this;
  var q = self.getElementQueue();
  var id2q = self.getElementIdToQueue();
  var dequeued = [];

  for( var i = 0; i < maxDeqSize; i++ ){
    if( q.size() > 0 ){
      var req = q.pop();

      id2q[ req.ele.id() ] = null;

      dequeued.push( req );

      var ele = req.ele;
      var bb;

      if(
        ( ele.isEdge()
          && (
            !math.arePositionsSame( ele.source().position(), req.positions.source )
            || !math.arePositionsSame( ele.target().position(), req.positions.target )
          )
        )
        || ( !math.arePositionsSame( ele.position(), req.position ) )
      ){
        bb = ele.boundingBox();
      } else {
        bb = req.bb;
      }

      self.getElement( req.ele, bb, pxRatio, req.level, getTxrReasons.dequeue );
    } else {
      break;
    }
  }

  return dequeued;
};

ETCp.onDequeue = function( fn ){ this.onDequeues.push( fn ); };
ETCp.offDequeue = function( fn ){ util.removeFromArray( this.onDequeues, fn ); };

ETCp.setupDequeueing = defs.setupDequeueing({
  deqRedrawThreshold: deqRedrawThreshold,
  deqCost: deqCost,
  deqAvgCost: deqAvgCost,
  deqNoDrawCost: deqNoDrawCost,
  deqFastCost: deqFastCost,
  deq: function( self, pxRatio, extent ){
    return self.dequeue( pxRatio, extent );
  },
  onDeqd: function( self, deqd ){
    for( var i = 0; i < self.onDequeues.length; i++ ){
      var fn = self.onDequeues[i];

      fn( deqd );
    }
  },
  shouldRedraw: function( self, deqd, pxRatio, extent ){
    for( var i = 0; i < deqd.length; i++ ){
      var bb = deqd[i].bb;

      if( math.boundingBoxesIntersect( bb, extent ) ){
        return true;
      }
    }

    return false;
  },
  priority: function( self ){
    return self.renderer.beforeRenderPriorities.eleTxrDeq;
  }
});

module.exports = ElementTextureCache;
