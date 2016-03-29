'use strict';

var util = require( '../../../util' );
var math = require( '../../../math' );
var Heap = require( '../../../heap' );
var is = require( '../../../is' );
var defs = require( './texture-cache-defs' );

// TODO fix invalidation case where node is dragged and N_layers > 1 ( edge z-order )

// TODO round layers so that they always have integer pixel sizes

// TODO optimise these values

var defNumLayers = 1; // default number of layers to use
var minLvl = -4; // when scaling smaller than that we don't need to re-render
var maxLvl = 2; // when larger than this scale just render directly (caching is not helpful)
var maxZoom = 4; // beyond this zoom level, layered textures are not used
var minPxRatioForEleCache = 2; // increase the pixel ratio used in the ele cache for low density displays to avoid blurriness
var deqRedrawThreshold = 50; // time to batch redraws together from dequeueing to allow more dequeueing calcs to happen in the meanwhile
var refineEleDebounceTime = 50; // time to debounce sharper ele texture updates
var deqCost = 0.3; // % of add'l rendering cost allowed for dequeuing ele caches each frame
var deqAvgCost = 0.2; // % of add'l rendering cost compared to average overall redraw time
var deqNoDrawCost = 0.95; // % of avg frame time that can be used for dequeueing when not drawing
var deqFastCost = 0.95; // % of frame time to be used when >60fps
var maxDeqSize = 1; // number of eles to dequeue and render at higher texture in each batch

var useEleTxrCaching = false; // whether to use individual ele texture caching underneath this cache

var log = function(){ console.log.apply( console, arguments ); };
log = function(){};

var LayeredTextureCache = function( renderer, eleTxrCache ){
  var self = this;

  var r = self.renderer = renderer;

  window.cache = self.layersByLevel = {}; // e.g. 2 => [ layer1, layer2, ..., layerN ]

  self.layersQueue = new Heap(function(a, b){
    return b.reqs - a.reqs;
  });

  self.eleTxrCache = eleTxrCache;

  self.setupEleCacheInvalidation();

  self.setupDequeueing();
};

var LTCp = LayeredTextureCache.prototype;

var ID = 0;

LTCp.makeLayer = function( bb, lvl ){
  var scale = Math.pow( 2, lvl );

  var w = bb.w * scale;
  var h = bb.h * scale;

  var canvas = document.createElement('canvas');

  canvas.width = w;
  canvas.height = h;

  var layer = {
    id: ID++,
    bb: bb,
    level: lvl,
    width: w,
    height: h,
    canvas: canvas,
    context: canvas.getContext('2d'),
    eles: [],
    elesQueue: [],
    reqs: 0
  };

  var cxt = layer.context;
  var dx = -layer.bb.x1;
  var dy = -layer.bb.y1;

  // do the transform on creation to save cycles (it's the same for all eles)
  cxt.scale( scale, scale );
  cxt.translate( dx, dy );

  return layer;
};

LTCp.getLayers = function( eles, pxRatio, lvl ){
  var self = this;
  var r = self.renderer;
  var cy = r.cy;
  var zoom = cy.zoom();

  log('get layers with %s eles', eles.length);

  if( lvl == null ){
    lvl = Math.ceil( Math.log2( zoom * pxRatio ) );

    if( lvl < minLvl ){
      lvl = minLvl;
    } else if( zoom >= maxZoom || lvl > maxLvl ){
      return null;
    }
  }

  self.validateLayersElesOrdering( lvl, eles );

  var layersByLvl = self.layersByLevel;
  var scale = Math.pow( 2, lvl );
  var layers = layersByLvl[ lvl ] = layersByLvl[ lvl ] || [];
  var bb;

  var lvlComplete = self.levelIsComplete( lvl, eles );
  var tmpLayers;

  if( !lvlComplete ){
    // if the current level is incomplete, then use the closest, best quality layerset temporarily
    // and later queue the current layerset so we can get the proper quality level soon

    var canUseAsTmpLvl = function( l ){
      self.validateLayersElesOrdering( l, eles );

      if( self.levelIsComplete( l, eles ) ){
        tmpLayers = layersByLvl[l];
        return true;
      }
    };

    var checkLvls = function( dir ){
      if( tmpLayers ){ return; }

      for( var l = lvl + dir; minLvl <= l && l <= maxLvl; l += dir ){
        if( canUseAsTmpLvl(l) ){ break; }
      }
    };

    checkLvls( +1 );
    checkLvls( -1 );

    // if( tmpLayers ){ return tmpLayers; }

    // remove the invalid layers; they will be replaced as needed later in this function
    for( var i = layers.length - 1; i >= 0; i-- ){
      var layer = layers[i];

      if( layer.invalid ){
        util.removeFromArray( layers, layer );
      }
    }

  } else {
    log('level complete, using existing layers');
    return layers;
  }

  var getBb = function(){
    if( !bb ){
      bb = math.makeBoundingBox();

      for( var i = 0; i < eles.length; i++ ){
        math.updateBoundingBox( bb, eles[i].boundingBox() );
      }
    }

    return bb;
  };

  var makeLayer = function( opts ){
    opts = opts || {};

    var after = opts.after;

    getBb();

    var layer = self.makeLayer( bb, lvl );

    if( after != null ){
      var index = layers.indexOf( after ) + 1;

      layers.splice( index, 0, layer );
    } else if( opts.insert === undefined || opts.insert ){
      // no after specified => first layer made so put at start
      layers.unshift( layer );
    }

    // if( tmpLayers ){
      //self.queueLayer( layer );
    // }

    return layer;
  };

  var layer;
  var maxElesPerLayer = eles.length / defNumLayers;

  for( var i = 0; i < eles.length; i++ ){
    var ele = eles[i];
    var rs = ele._private.rscratch;
    var caches = rs.imgLayerCaches = rs.imgLayerCaches || {};

    var existingLayer = caches[ lvl ];

    if( existingLayer ){
      // reuse layer for later eles
      // log('reuse layer for', ele.id());
      layer = existingLayer;
      continue;
    }

    if(
      !layer
      || layer.eles.length >= maxElesPerLayer
      || !math.boundingBoxInBoundingBox( layer.bb, ele.boundingBox() )
    ){
      log('make new layer for ele', ele.id());

      layer = makeLayer({ insert: true, after: layer });
    }

    if( tmpLayers ){
      self.queueLayer( layer, ele );
    } else {
      self.drawEleInLayer( layer, ele, lvl, pxRatio );
    }

    layer.eles.push( ele );

    caches[ lvl ] = layer;
  }

  if( tmpLayers ){ // then we only queued the current layerset and can't draw it yet
    return tmpLayers;
  }

  return layers;
};

// a layer may want to use an ele cache of a higher level to avoid blurriness
// so the layer level might not equal the ele level
LTCp.getEleLevelForLayerLevel = function( lvl, pxRatio ){
  if( pxRatio === undefined ){
    pxRatio = this.renderer.getPixelRatio();
  }

  if( pxRatio != null && pxRatio < minPxRatioForEleCache ){
    lvl += 1;
  }

  return lvl;
};

LTCp.drawEleInLayer = function( layer, ele, lvl, pxRatio ){
  var self = this;
  var r = this.renderer;
  var context = layer.context;
  var bb = ele.boundingBox();

  lvl = self.getEleLevelForLayerLevel( lvl, pxRatio );

  var cache = useEleTxrCaching ? self.eleTxrCache.getElement( ele, bb, null, lvl ) : null;

  if( cache ){
    context.drawImage( cache.texture.canvas, cache.x, 0, cache.width, cache.height, bb.x1, bb.y1, bb.w, bb.h );
  } else { // if the element is not cacheable, then draw directly
    r.drawElement( context, ele );
  }
};

LTCp.levelIsComplete = function( lvl, eles ){
  var self = this;
  var layers = self.layersByLevel[ lvl ];

  if( !layers || layers.length === 0 ){ return false; }

  for( var i = 0; i < layers.length; i++ ){
    var layer = layers[i];

    // if there are any eles needed to be drawn yet, the level is not complete
    if( layer.reqs > 0 ){ return false; }

    // if the layer is invalid, the level is not complete
    if( layer.invalid ){ return false; }
  }

  return true;
};

LTCp.validateLayersElesOrdering = function( lvl, eles ){
  var layers = this.layersByLevel[ lvl ];

  if( !layers ){ return; }

  // if in a layer the eles are not in the same order, then the layer is invalid
  // (i.e. there is an ele in between the eles in the layer)

  for( var i = 0; i < layers.length; i++ ){
    var layer = layers[i];
    var offset = -1;

    // find the offset
    for( var j = 0; j < eles.length; j++ ){
      if( layer.eles[0] === eles[j] ){
        offset = j;
        break;
      }
    }


    // the eles in the layer must be in the same continuous order, else the layer is invalid

    var o = offset;

    for( var j = 0; j < layer.eles.length; j++ ){
      if( layer.eles[j] !== eles[o+j] ){
        log('invalidate based on ordering', layer.id);

        this.invalidateLayer( layer );
        break;
      }
    }
  }
};

LTCp.updateElementsInLayers = function( eles, update ){
  var self = this;
  var r = self.renderer;
  var cy = r.cy;
  var isEles = is.element( eles[0] );

  // collect udpated elements (cascaded from the layers) and update each
  // layer itself along the way
  for( var i = 0; i < eles.length; i++ ){
    var req = isEles ? null : eles[i];
    var ele = isEles ? eles[i] : eles[i].ele;
    var rs = ele._private.rscratch;
    var caches = rs.imgLayerCaches = rs.imgLayerCaches || {};

    for( var l = minLvl; l <= maxLvl; l++ ){
      var layer = caches[l];

      if( !layer ){ continue; }

      // if update is a request from the ele cache, then it affects only
      // the matching level
      if( req && self.getEleLevelForLayerLevel( layer.level ) !== req.level ){
        continue;
      }

      update( layer, ele, req );
    }
  }
};

LTCp.invalidateElements = function( eles ){
  var self = this;

  self.updateElementsInLayers( eles, function( layer, ele, req ){
    self.invalidateLayer( layer );
  } );
};

LTCp.invalidateLayer = function( layer ){
  if( layer.invalid ){ return } // save cycles

  var lvl = layer.level;
  var eles = layer.eles;
  var layers = this.layersByLevel[ lvl ];

  log( 'invalidate layer', layer.id );

  // util.removeFromArray( layers, layer );
  // layer.eles = [];

  layer.elesQueue = [];

  layer.invalid = true;

  for( var i = 0; i < eles.length; i++ ){
    var caches = eles[i]._private.rscratch.imgLayerCaches;

    if( caches ){
      caches[ lvl ] = null;
    }
  }
};

LTCp.refineElementTextures = function( eles ){
  var self = this;

  log('refine', eles.length);

  self.updateElementsInLayers( eles, function( layer, ele, req ){
    var rLyr = layer.replacement;

    if( !rLyr ){
      rLyr = layer.replacement = self.makeLayer( layer.bb, layer.level );
      rLyr.replaces = layer;
      rLyr.eles = layer.eles.concat( layer.elesQueue );

      log('make replacement layer %s with level %s', rLyr.id, rLyr.level);
    }

    if( !rLyr.reqs ){
      for( var i = 0; i < rLyr.eles.length; i++ ){
        self.queueLayer( rLyr, rLyr.eles[i] );
      }

      log('queue replacement layer refinement', rLyr.id);
    }
  } );
};

LTCp.setupEleCacheInvalidation = function(){
  var self = this;
  var r = self.renderer;
  var eleDeqs = [];

  if( !useEleTxrCaching ){ return; }

  var updatedElesInLayers = util.debounce( function(){
    self.refineElementTextures( eleDeqs );

    eleDeqs = [];
  }, refineEleDebounceTime );

  self.eleTxrCache.onDequeue(function( reqs ){
    for( var i = 0; i < reqs.length; i++ ){
      eleDeqs.push( reqs[i] );
    }

    updatedElesInLayers();
  });
};

LTCp.queueLayer = function( layer, ele ){
  var self = this;
  var q = self.layersQueue;
  var elesQ = layer.elesQueue;
  var hasId = elesQ.hasId = elesQ.hasId || {};

  // if a layer is going to be replaced, queuing is a waste of time
  if( layer.replacement ){ return }

  if( ele ){
    if( hasId[ ele.id() ] ){
      return;
    }

    elesQ.push( ele );
    hasId[ ele.id() ] = true;
  }

  if( layer.reqs ){
    layer.reqs++;

    q.updateItem( layer );
  } else {
    layer.reqs = 1;

    q.push( layer );
  }
};

LTCp.dequeue = function( pxRatio ){
  var self = this;
  var r = self.renderer;
  var q = self.layersQueue;
  var deqd = [];
  var eleDeqs = 0;

  while( eleDeqs < maxDeqSize ){
    if( q.size() === 0 ){ break; }

    var layer = q.peek();

    // if a layer has been or will be replaced, then don't waste time with it
    if( layer.replacement ){
      q.pop();
      continue;
    }

    // if this is a replacement layer that has been superceded, then forget it
    if( layer.replaces && layer.replaces !== layer.replaces.replacement ){
      q.pop();
      continue;
    }

    var ele = layer.elesQueue.shift();

    if( ele ){
      log('dequeue');

      layer.elesQueue.hasId[ ele.id() ] = false;

      self.drawEleInLayer( layer, ele, layer.level, pxRatio );

      eleDeqs++;
    }

    if( deqd.length === 0 ){
      // we need only one entry in deqd to queue redrawing etc
      deqd.push( true );
    }

    // if the layer has all its eles done, then remove from the queue
    if( layer.elesQueue.length === 0 ){
      q.pop();

      layer.reqs = 0;

      // when a replacement layer is dequeued, it replaces the old layer in the level
      if( layer.replaces ){
        self.applyLayerReplacement( layer );
      }

      self.requestRedraw();
    }
  }

  return deqd;
};

LTCp.applyLayerReplacement = function( layer ){
  var self = this;
  var layersInLevel = self.layersByLevel[ layer.level ];
  var replaced = layer.replaces;
  var index = layersInLevel.indexOf( replaced );

  // if the replaced layer is not in the active list for the level, then replacing
  // refs would be a mistake (i.e. overwriting the true active layer)
  if( index < 0 || replaced.invalid ){
    log('replacement layer would have no effect', layer.id);
    return;
  }

  layersInLevel[ index ] = layer // replace level ref

  // replace refs in eles
  for( var i = 0; i < layer.eles.length; i++ ){
    var _p = layer.eles[i]._private;
    var cache = _p.imgLayerCaches = _p.imgLayerCaches || {};

    if( cache ){
      cache[ layer.level ] = layer;
    }
  }

  log('apply replacement layer', layer.id);

  self.requestRedraw();
};

LTCp.requestRedraw = util.debounce( function(){
  var r = this.renderer;

  r.redrawHint( 'eles', true );
  r.redrawHint( 'drag', true );
  r.redraw();
}, 100 );

LTCp.setupDequeueing = defs.setupDequeueing({
  deqRedrawThreshold: deqRedrawThreshold,
  deqCost: deqCost,
  deqAvgCost: deqAvgCost,
  deqNoDrawCost: deqNoDrawCost,
  deqFastCost: deqFastCost,
  deq: function( self, pxRatio ){
    return self.dequeue( pxRatio );
  },
  onDeqd: util.noop,
  shouldRedraw: util.trueify
});

module.exports = LayeredTextureCache;
