'use strict';

var util = require( '../../../util' );
var math = require( '../../../math' );
var Heap = require( '../../../heap' );
var is = require( '../../../is' );
var defs = require( './texture-cache-defs' );

// TODO optimise these values

var defNumLayers = 2; // default number of layers to use
var minLvl = -4; // when scaling smaller than that we don't need to re-render
var maxLvl = 2; // when larger than this scale just render directly (caching is not helpful)
var maxZoom = 4; // beyond this zoom level, layered textures are not used
var minPxRatioForEleCache = 2; // increase the pixel ratio used in the ele cache for low density displays to avoid blurriness
var pxRatioMultForEleCache = 2; // multiplier for px ratio on low density displays to avoid blurriness
var deqRedrawThreshold = 200; // time to batch redraws together from dequeueing to allow more dequeueing calcs to happen in the meanwhile
var deqCost = 0.2; // % of add'l rendering cost allowed for dequeuing ele caches each frame
var deqAvgCost = 0.1; // % of add'l rendering cost compared to average overall redraw time
var deqNoDrawCost = 0.5; // % of avg frame time that can be used for dequeueing when not drawing
var deqFastCost = 0.5; // % of frame time to be used when >60fps
var maxDeqSize = 3; // number of eles to dequeue and render at higher texture in each batch

// TODO enable after layer dequeueing is tweaked
var useEleTxrCaching = false; // whether to use individual ele texture caching underneath this cache

var LayeredTextureCache = function( renderer, eleTxrCache ){
  var self = this;

  var r = self.renderer = renderer;

  self.layersByLevel = {}; // e.g. 2 => [ layer1, layer2, ..., layerN ]

  self.layersQueue = new Heap(function(a, b){
    return b.reqs - a.reqs;
  });

  self.eleTxrCache = eleTxrCache;

  self.setupEleCacheInvalidation();

  self.setupDequeueing();
};

var LTCp = LayeredTextureCache.prototype;

LTCp.getLayers = function( eles, pxRatio, lvl ){
  var self = this;
  var r = self.renderer;
  var cy = r.cy;
  var zoom = cy.zoom();

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

  var lvlComplete = self.levelIsComplete( lvl );
  var tmpLayers;

  if( !lvlComplete ){
    // if the current level is incomplete, then use the closest, best quality layerset temporarily
    // and later queue the current layerset so we can get the proper quality level soon

    var canUseAsTmpLvl = function( l ){
      if( self.levelIsComplete( l ) ){
        tmpLayers = layersByLvl[ l ];
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

  } else {
    return layers;
  }

  var makeLayer = function( opts ){
    opts = opts || {};

    var after = opts.after;

    bb = bb || cy.collection( eles ).boundingBox();

    var w = bb.w * scale;
    var h = bb.h * scale;

    var canvas = document.createElement('canvas');

    canvas.width = w;
    canvas.height = h;

    var layer = {
      bb: bb,
      level: lvl,
      width: w,
      height: h,
      canvas: canvas,
      context: canvas.getContext('2d'),
      eles: [],
      elesQueue: []
    };

    var cxt = layer.context;
    var dx = -layer.bb.x1;
    var dy = -layer.bb.y1;

    // do the transform on creation to save cycles (it's the same for all eles)
    cxt.scale( scale, scale );
    cxt.translate( dx, dy );

    if( after != null ){
      var index = layers.indexOf( after ) + 1;

      layers.splice( index, 0, layer );
    } else if( opts.insert === undefined || opts.insert ){
      // no after specified => first layer made so put at start
      layers.unshift( layer );
    }

    if( tmpLayers ){
      self.queueLayer( layer );
    }

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
      layer = existingLayer;
      continue;
    }

    if(
      !layer
      || layer.eles.length >= maxElesPerLayer
      || !math.boundingBoxInBoundingBox( layer.bb, ele.boundingBox() )
    ){
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

LTCp.levelIsComplete = function( lvl ){
  var self = this;
  var layers = self.layersByLevel[ lvl ];

  if( !layers || layers.length === 0 ){ return false; }

  for( var i = 0; i < layers.length; i++ ){
    var layer = layers[i];

    if( layer.reqs > 0 ){
      return false;
    }
  }

  return true;
};

// TODO fix invalidation case where node is dragged and N_layers > 1

// TODO fix invalidation case with ele texture invalidation causes multiple layer refreshes

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
        this.invalidateLayer( layer );
        break;
      }
    }
  }
};

LTCp.invalidateElements = function( eles ){
  var self = this;
  var r = self.renderer;
  var cy = r.cy;
  var isEles = is.elementOrCollection( eles );

  // collect invalid elements (cascaded from the layers) and invalidate each
  // layer itself along the way
  for( var i = 0; i < eles.length; i++ ){
    var req = isEles ? null : eles[i];
    var ele = isEles ? eles[i] : eles[i].ele;
    var rs = ele._private.rscratch;
    var caches = rs.imgLayerCaches = rs.imgLayerCaches || {};

    for( var l = minLvl; l <= maxLvl; l++ ){
      var layer = caches[l];

      if( !layer ){ continue; }

      // if invalidation is a request from the ele cache, then it affects only
      // the matching level
      if( req && self.getEleLevelForLayerLevel( layer.level ) !== req.level ){
        continue;
      }

      self.invalidateLayer( layer );
    }
  }
};

LTCp.invalidateLayer = function( layer ){
  var lvl = layer.level;
  var eles = layer.eles;

  util.removeFromArray( this.layersByLevel[ lvl ], layer );

  layer.invalid = true;

  for( var i = 0; i < eles.length; i++ ){
    var caches = eles[i]._private.rscratch.imgLayerCaches;

    if( caches ){
      caches[ lvl ] = null;
    }
  }
};

LTCp.setupEleCacheInvalidation = function(){
  var self = this;
  var r = self.renderer;
  var eleDeqs = [];

  if( !useEleTxrCaching ){ return; }

  var invalElesInLayers = util.debounce( function(){
    self.invalidateElements( eleDeqs );

    eleDeqs = [];

    r.redrawHint( 'eles', true );
    r.redrawHint( 'drag', true );
    r.redraw();
  }, 100 );

  self.eleTxrCache.onDequeue(function( reqs ){
    for( var i = 0; i < reqs.length; i++ ){
      eleDeqs.push( reqs[i] );
    }

    invalElesInLayers();
  });
};

LTCp.queueLayer = function( layer, ele ){
  var self = this;
  var q = self.layersQueue;
  var elesQ = layer.elesQueue;
  var hasId = elesQ.hasId = elesQ.hasId || {};

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
    var ele = layer.elesQueue.shift();

    self.drawEleInLayer( layer, ele, layer.level, pxRatio );

    eleDeqs++;

    if( deqd.length === 0 ){
      deqd.push( true );
    }

    // if the layer has all its eles done, then remove from the queue
    if( layer.elesQueue.length === 0 ){
      q.pop();

      layer.reqs = 0;
    }
  }

  return deqd;
};

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
