import * as math from '../../../math';
import * as util from '../../../util';
import Heap from '../../../heap';
import defs from './texture-cache-defs';
import ElementTextureCacheLookup from './ele-texture-cache-lookup';

const minTxrH = 25; // the size of the texture cache for small height eles (special case)
const txrStepH = 50; // the min size of the regular cache, and the size it increases with each step up
const minLvl = -4; // when scaling smaller than that we don't need to re-render
const maxLvl = 2; // when larger than this scale just render directly (caching is not helpful)
const maxZoom = 3.99; // beyond this zoom level, layered textures are not used
const eleTxrSpacing = 8; // spacing between elements on textures to avoid blitting overlaps
const defTxrWidth = 1024; // default/minimum texture width
const maxTxrW = 1024; // the maximum width of a texture
const maxTxrH = 1024;  // the maximum height of a texture
const minUtility = 0.5; // if usage of texture is less than this, it is retired
const maxFullness = 0.8; // fullness of texture after which queue removal is checked
const maxFullnessChecks = 10; // dequeued after this many checks
const allowEdgeTxrCaching = false; // whether edges can be cached as textures (TODO maybe better on if webgl supported?)
const allowParentTxrCaching = false; // whether parent nodes can be cached as textures (TODO maybe better on if webgl supported?)
const deqCost = 0.15; // % of add'l rendering cost allowed for dequeuing ele caches each frame
const deqAvgCost = 0.1; // % of add'l rendering cost compared to average overall redraw time
const deqNoDrawCost = 0.9; // % of avg frame time that can be used for dequeueing when not drawing
const deqFastCost = 0.9; // % of frame time to be used when >60fps
const deqRedrawThreshold = 100; // time to batch redraws together from dequeueing to allow more dequeueing calcs to happen in the meanwhile
const maxDeqSize = 1; // number of eles to dequeue and render at higher texture in each batch

const getTxrReasons = {
  dequeue: 'dequeue',
  downscale: 'downscale',
  highQuality: 'highQuality'
};

const ElementTextureCache = function( renderer ){
  let self = this;

  self.renderer = renderer;
  self.onDequeues = [];
  self.lookup = new ElementTextureCacheLookup( ele => ele[0]._private.styleKey );

  self.setupDequeueing();
};

const ETCp = ElementTextureCache.prototype;

ETCp.reasons = getTxrReasons;

// the list of textures in which new subtextures for elements can be placed
ETCp.getTextureQueue = function( txrH ){
  let self = this;
  self.eleImgCaches = self.eleImgCaches || {};

  return ( self.eleImgCaches[ txrH ] = self.eleImgCaches[ txrH ] || [] );
};

// the list of usused textures which can be recycled (in use in texture queue)
ETCp.getRetiredTextureQueue = function( txrH ){
  let self = this;

  let rtxtrQs = self.eleImgCaches.retired = self.eleImgCaches.retired || {};
  let rtxtrQ = rtxtrQs[ txrH ] = rtxtrQs[ txrH ] || [];

  return rtxtrQ;
};

// queue of element draw requests at different scale levels
ETCp.getElementQueue = function(){
  let self = this;

  let q = self.eleCacheQueue = self.eleCacheQueue || new Heap(function( a, b ){
    return b.reqs - a.reqs;
  });

  return q;
};

// queue of element draw requests at different scale levels (element id lookup)
ETCp.getElementIdToQueue = function(){
  let self = this;

  let id2q = self.eleIdToCacheQueue = self.eleIdToCacheQueue || {};

  return id2q;
};

ETCp.getElement = function( ele, bb, pxRatio, lvl, reason ){
  let self = this;
  let r = this.renderer;
  let zoom = r.cy.zoom();
  let lookup = this.lookup;

  if( bb.w === 0 || bb.h === 0 || !ele.visible() ){ return null; }

  if( lvl == null ){
    lvl = Math.ceil( math.log2( zoom * pxRatio ) );
  }

  if( lvl < minLvl ){
    lvl = minLvl;
  } else if( zoom >= maxZoom || lvl > maxLvl ){
    return null;
  }

  let scale = Math.pow( 2, lvl );
  let eleScaledH = bb.h * scale;
  let eleScaledW = bb.w * scale;
  let eleCache = lookup.get( ele, lvl );

  if( eleCache ){
    return eleCache;
  }

  let txrH; // which texture height this ele belongs to

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

  let txrQ = self.getTextureQueue( txrH );

  // first try the second last one in case it has space at the end
  let txr = txrQ[ txrQ.length - 2 ];

  let addNewTxr = function(){
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

  let scaledLabelShown = r.eleTextBiggerThanMin( ele, scale );
  let scalableFrom = function( otherCache ){
    return otherCache && otherCache.scaledLabelShown === scaledLabelShown;
  };

  let deqing = reason && reason === getTxrReasons.dequeue;
  let highQualityReq = reason && reason === getTxrReasons.highQuality;
  let downscaleReq = reason && reason === getTxrReasons.downscale;

  let higherCache; // the nearest cache with a higher level
  for( let l = lvl + 1; l <= maxLvl; l++ ){
    let c = lookup.get( ele, l );

    if( c ){ higherCache = c; break; }
  }

  let oneUpCache = higherCache && higherCache.level === lvl + 1 ? higherCache : null;

  let downscale = function(){
    txr.context.drawImage(
      oneUpCache.texture.canvas,
      oneUpCache.x, 0,
      oneUpCache.width, oneUpCache.height,
      txr.usedWidth, 0,
      eleScaledW, eleScaledH
    );
  };

  // reset ele area in texture
  txr.context.setTransform( 1, 0, 0, 1, 0, 0 );
  txr.context.clearRect( txr.usedWidth, 0, eleScaledW, txrH );

  if( scalableFrom(oneUpCache) ){
    // then we can relatively cheaply rescale the existing image w/o rerendering
    downscale();

  } else if( scalableFrom(higherCache) ){
    // then use the higher cache for now and queue the next level down
    // to cheaply scale towards the smaller level

    if( highQualityReq ){
      for( let l = higherCache.level; l > lvl; l-- ){
        oneUpCache = self.getElement( ele, bb, pxRatio, l, getTxrReasons.downscale );
      }

      downscale();

    } else {
      self.queueElement( ele, higherCache.level - 1 );

      return higherCache;
    }
  } else {

    let lowerCache; // the nearest cache with a lower level
    if( !deqing && !highQualityReq && !downscaleReq ){
      for( let l = lvl - 1; l >= minLvl; l-- ){
        let c = lookup.get( ele, l );

        if( c ){ lowerCache = c; break; }
      }
    }

    if( scalableFrom(lowerCache) ){
      // then use the lower quality cache for now and queue the better one for later

      self.queueElement( ele, lvl );

      return lowerCache;
    }

    txr.context.translate( txr.usedWidth, 0 );
    txr.context.scale( scale, scale );

    r.drawElement( txr.context, ele, bb, scaledLabelShown );

    txr.context.scale( 1/scale, 1/scale );
    txr.context.translate( -txr.usedWidth, 0 );
  }

  eleCache = {
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

  lookup.set( ele, lvl, eleCache );

  self.checkTextureFullness( txr );

  return eleCache;
};

ETCp.invalidateElements = function( eles ){
  for( let i = 0; i < eles.length; i++ ){
    this.invalidateElement(eles[i]);
  }
};

ETCp.invalidateElement = function( ele ){
  let self = this;
  let lookup = self.lookup;
  let caches = [];

  if( !lookup.keyHasChangedFor(ele) ){
    return; // override the invalidation request if the element key has not changed
  }

  for( let lvl = minLvl; lvl <= maxLvl; lvl++ ){
    let cache = lookup.get( ele, lvl );

    if( cache ){
      caches.push( cache );
    }
  }

  let noCacheRefsRemaining = lookup.invalidate( ele );

  if( noCacheRefsRemaining ){
    for( let i = 0; i < caches.length; i++ ){
      let cache = caches[i];
      let txr = cache.texture;

      // remove space from the texture it belongs to
      txr.invalidatedWidth += cache.width;

      // remove refs with the element
      util.removeFromArray( txr.eleCaches, cache );

      // might have to remove the entire texture if it's not efficiently using its space
      self.checkTextureUtility( txr );
    }
  }

  // remove from queue since the old req was for the old state
  self.removeFromQueue( ele );
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

  let self = this;
  let txrQ = self.getTextureQueue( txr.height );

  if( txr.usedWidth / txr.width > maxFullness && txr.fullnessChecks >= maxFullnessChecks ){
    util.removeFromArray( txrQ, txr );
  } else {
    txr.fullnessChecks++;
  }
};

ETCp.retireTexture = function( txr ){
  let self = this;
  let txrH = txr.height;
  let txrQ = self.getTextureQueue( txrH );
  let lookup = this.lookup;

  // retire the texture from the active / searchable queue:

  util.removeFromArray( txrQ, txr );

  txr.retired = true;

  // remove the refs from the eles to the caches:

  let eleCaches = txr.eleCaches;

  for( let i = 0; i < eleCaches.length; i++ ){
    let eleCache = eleCaches[i];

    lookup.deleteCache( eleCache.key, eleCache.level );
  }

  util.clearArray( eleCaches );

  // add the texture to a retired queue so it can be recycled in future:

  let rtxtrQ = self.getRetiredTextureQueue( txrH );

  rtxtrQ.push( txr );
};

ETCp.addTexture = function( txrH, minW ){
  let self = this;
  let txrQ = self.getTextureQueue( txrH );
  let txr = {};

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
  let self = this;
  let txrQ = self.getTextureQueue( txrH );
  let rtxtrQ = self.getRetiredTextureQueue( txrH );

  for( let i = 0; i < rtxtrQ.length; i++ ){
    let txr = rtxtrQ[i];

    if( txr.width >= minW ){
      txr.retired = false;

      txr.usedWidth = 0;
      txr.invalidatedWidth = 0;
      txr.fullnessChecks = 0;

      util.clearArray( txr.eleCaches );

      txr.context.setTransform( 1, 0, 0, 1, 0, 0 );
      txr.context.clearRect( 0, 0, txr.width, txr.height );

      util.removeFromArray( rtxtrQ, txr );
      txrQ.push( txr );

      return txr;
    }
  }
};

ETCp.queueElement = function( ele, lvl ){
  let self = this;
  let q = self.getElementQueue();
  let id2q = self.getElementIdToQueue();
  let id = ele.id();
  let existingReq = id2q[ id ];

  if( existingReq ){ // use the max lvl b/c in between lvls are cheap to make
    existingReq.level = Math.max( existingReq.level, lvl );
    existingReq.reqs++;

    q.updateItem( existingReq );
  } else {
    let req = {
      ele: ele,
      level: lvl,
      reqs: 1
    };

    q.push( req );

    id2q[ id ] = req;
  }
};

ETCp.dequeue = function( pxRatio /*, extent*/ ){
  let self = this;
  let q = self.getElementQueue();
  let id2q = self.getElementIdToQueue();
  let dequeued = [];
  let lookup = self.lookup;

  for( let i = 0; i < maxDeqSize; i++ ){
    if( q.size() > 0 ){
      let req = q.pop();
      let ele = req.ele;
      let cacheExists = lookup.has(ele, req.level);

      // dequeueing isn't necessary when an existing cache exists
      if( cacheExists ){ continue; }

      id2q[ ele.id() ] = null;

      dequeued.push( req );

      let bb = ele.boundingBox();

      self.getElement( ele, bb, pxRatio, req.level, getTxrReasons.dequeue );
    } else {
      break;
    }
  }

  return dequeued;
};

ETCp.removeFromQueue = function( ele ){
  let self = this;
  let q = self.getElementQueue();
  let id2q = self.getElementIdToQueue();
  let req = id2q[ ele.id() ];

  if( req != null ){
    // bring to front of queue
    req.reqs = util.MAX_INT;
    q.updateItem( req );

    q.pop(); // remove from queue

    id2q[ ele.id() ] = null; // remove from lookup map
  }
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
    for( let i = 0; i < self.onDequeues.length; i++ ){
      let fn = self.onDequeues[i];

      fn( deqd );
    }
  },
  shouldRedraw: function( self, deqd, pxRatio, extent ){
    for( let i = 0; i < deqd.length; i++ ){
      let bb = deqd[i].ele.boundingBox();

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

export default ElementTextureCache;
