import * as util from '../../../util/index.mjs';
import * as math from '../../../math.mjs';
import Heap from '../../../heap.mjs';
import * as is from '../../../is.mjs';
import defs from './texture-cache-defs.mjs';
import type { Renderer, Element, Collection } from '../renderer-types.mjs';
import type { BoundingBox } from '../../../types.mjs';

// An offscreen canvas onto which a group of elements is composited at a level.
interface Layer {
  id: number;
  bb: BoundingBox;
  level: number;
  width: number;
  height: number;
  canvas: HTMLCanvasElement | OffscreenCanvas;
  context: CanvasRenderingContext2D;
  eles: Element[];
  elesQueue: Element[] & { hasId?: Record<string, boolean> };
  reqs: number;
  invalid?: boolean;
  replacement?: Layer | null;
  replaces?: Layer | null;
}

// A per-ele update request fed through updateElementsInLayers.
interface LayerEleReq {
  ele: Element;
  level: number;
}

// The runtime instance assembled from the constructor + prototype below.
interface LayeredTextureCacheInstance {
  renderer: Renderer;
  layersByLevel: Record<number, Layer[]>;
  firstGet: boolean;
  lastInvalidationTime: number;
  skipping: boolean;
  eleTxrDeqs: Collection;
  scheduleElementRefinement: () => void;
  layersQueue: Heap<Layer>;
  setupDequeueing(): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- open-ended prototype-mixin surface
  [key: string]: any;
}

let defNumLayers = 1; // default number of layers to use
let minLvl = -4; // when scaling smaller than that we don't need to re-render
let maxLvl = 2; // when larger than this scale just render directly (caching is not helpful)
let maxZoom = 3.99; // beyond this zoom level, layered textures are not used
let deqRedrawThreshold = 50; // time to batch redraws together from dequeueing to allow more dequeueing calcs to happen in the meanwhile
let refineEleDebounceTime = 50; // time to debounce sharper ele texture updates
let disableEleImgSmoothing = true; // when drawing eles on layers from an ele cache ; crisper and more performant when true
let deqCost = 0.15; // % of add'l rendering cost allowed for dequeuing ele caches each frame
let deqAvgCost = 0.1; // % of add'l rendering cost compared to average overall redraw time
let deqNoDrawCost = 0.9; // % of avg frame time that can be used for dequeueing when not drawing
let deqFastCost = 0.9; // % of frame time to be used when >60fps
let maxDeqSize = 1; // number of eles to dequeue and render at higher texture in each batch
let invalidThreshold = 250; // time threshold for disabling b/c of invalidations
let maxLayerArea = 4000 * 4000; // layers can't be bigger than this
let maxLayerDim = 32767; // maximum size for the width/height of layer canvases
let alwaysQueue = true; // never draw all the layers in a level on a frame; draw directly until all dequeued
let useHighQualityEleTxrReqs = true; // whether to use high quality ele txr requests (generally faster and cheaper in the longterm)

let useEleTxrCaching = true; // whether to use individual ele texture caching underneath this cache

// var log = function(){ console.log.apply( console, arguments ); };

let LayeredTextureCache = function( this: LayeredTextureCacheInstance, renderer: Renderer ){
  let self = this; // eslint-disable-line @typescript-eslint/no-this-alias
  let r = self.renderer = renderer;
  let cy = r.cy;

  self.layersByLevel = {}; // e.g. 2 => [ layer1, layer2, ..., layerN ]

  self.firstGet = true;

  self.lastInvalidationTime = util.performanceNow() - 2*invalidThreshold;

  self.skipping = false;

  self.eleTxrDeqs = cy.collection();

  self.scheduleElementRefinement = util.debounce( function(){
    self.refineElementTextures( self.eleTxrDeqs );

    self.eleTxrDeqs.unmerge( self.eleTxrDeqs );
  }, refineEleDebounceTime );

  r.beforeRender(function( willDraw: boolean, now: number ){
    if( now - self.lastInvalidationTime <= invalidThreshold ){
      self.skipping = true;
    } else {
      self.skipping = false;
    }
  }, r.beforeRenderPriorities.lyrTxrSkip);

  let qSort = function( a: Layer, b: Layer ){
    return b.reqs - a.reqs;
  };

  self.layersQueue = new Heap( qSort );

  self.setupDequeueing();
} as unknown as { new ( renderer: Renderer ): LayeredTextureCacheInstance; prototype: LayeredTextureCacheInstance };

let LTCp = LayeredTextureCache.prototype;

let layerIdPool = 0;
let MAX_INT = Math.pow(2, 53) - 1;

LTCp.makeLayer = function( this: LayeredTextureCacheInstance, bb: BoundingBox, lvl: number ){
  let scale = Math.pow( 2, lvl );

  let w = Math.ceil( bb.w * scale );
  let h = Math.ceil( bb.h * scale );

  let canvas = this.renderer.makeOffscreenCanvas(w, h);

  let layer: Layer = {
    id: (layerIdPool = ++layerIdPool % MAX_INT ),
    bb: bb,
    level: lvl,
    width: w,
    height: h,
    canvas: canvas,
    context: canvas.getContext('2d') as CanvasRenderingContext2D,
    eles: [],
    elesQueue: [],
    reqs: 0
  };

  // log('make layer %s with w %s and h %s and lvl %s', layer.id, layer.width, layer.height, layer.level);

  let cxt = layer.context;
  let dx = -layer.bb.x1;
  let dy = -layer.bb.y1;

  // do the transform on creation to save cycles (it's the same for all eles)
  cxt.scale( scale, scale );
  cxt.translate( dx, dy );

  return layer;
};

LTCp.getLayers = function( this: LayeredTextureCacheInstance, eles: Collection, pxRatio: number, lvl?: number | null ){
  let self = this; // eslint-disable-line @typescript-eslint/no-this-alias
  let r = self.renderer;
  let cy = r.cy;
  let zoom = cy.zoom();
  let firstGet = self.firstGet;

  self.firstGet = false;

  // log('--\nget layers with %s eles', eles.length);
  //log eles.map(function(ele){ return ele.id() }) );

  if( lvl == null ){
    lvl = Math.ceil( math.log2( zoom * pxRatio ) );

    if( lvl < minLvl ){
      lvl = minLvl;
    } else if( zoom >= maxZoom || lvl > maxLvl ){
      return null;
    }
  }

  self.validateLayersElesOrdering( lvl, eles );

  let layersByLvl = self.layersByLevel;
  let scale = Math.pow( 2, lvl );
  let layers = layersByLvl[ lvl ] = layersByLvl[ lvl ] || [];
  let bb: BoundingBox | undefined;

  let lvlComplete = self.levelIsComplete( lvl, eles );
  let tmpLayers: Layer[] | undefined;

  let checkTempLevels = function(){
    let canUseAsTmpLvl = function( l: number ){
      self.validateLayersElesOrdering( l, eles );

      if( self.levelIsComplete( l, eles ) ){
        tmpLayers = layersByLvl[l];
        return true;
      }
    };

    let checkLvls = function( dir: number ){
      if( tmpLayers ){ return; }

      for( let l = lvl! + dir; minLvl <= l && l <= maxLvl; l += dir ){
        if( canUseAsTmpLvl(l) ){ break; }
      }
    };

    checkLvls( +1 );
    checkLvls( -1 );

    // remove the invalid layers; they will be replaced as needed later in this function
    for( let i = layers.length - 1; i >= 0; i-- ){
      let layer = layers[i];

      if( layer.invalid ){
        util.removeFromArray( layers, layer );
      }
    }
  };

  if( !lvlComplete ){
    // if the current level is incomplete, then use the closest, best quality layerset temporarily
    // and later queue the current layerset so we can get the proper quality level soon

    checkTempLevels();

  } else {
    // log('level complete, using existing layers\n--');
    return layers;
  }

  let getBb = function(){
    if( !bb ){
      bb = math.makeBoundingBox();

      for( let i = 0; i < eles.length; i++ ){
        math.updateBoundingBox( bb, eles[i].boundingBox() );
      }
    }

    return bb;
  };

  let makeLayer = function( opts?: { after?: Layer | null; insert?: boolean } ){
    opts = opts || {};

    let after = opts.after;

    getBb();

    let w = Math.ceil( bb!.w * scale );
    let h = Math.ceil( bb!.h * scale );

    if( w > maxLayerDim || h > maxLayerDim ){
      return null;
    }

    let area = w * h;

    if( area > maxLayerArea ){
      return null;
    }

    let layer = self.makeLayer( bb, lvl );

    if( after != null ){
      let index = layers.indexOf( after ) + 1;

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

  if( self.skipping && !firstGet ){
    // log('skip layers');
    return null;
  }

  // log('do layers');

  let layer = null;
  let maxElesPerLayer = eles.length / defNumLayers;
  let allowLazyQueueing = alwaysQueue && !firstGet;

  for( let i = 0; i < eles.length; i++ ){
    let ele = eles[i];
    let rs = ele._private.rscratch;
    let caches = ( rs.imgLayerCaches = rs.imgLayerCaches || {} ) as Record<number, Layer | null>;

    // log('look at ele', ele.id());

    let existingLayer = caches[ lvl! ];

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
      // log('make new layer for ele %s', ele.id());

      layer = makeLayer({ insert: true, after: layer });

      // if now layer can be built then we can't use layers at this level
      if( !layer ){ return null; }

      // log('new layer with id %s', layer.id);
    }

    if( tmpLayers || allowLazyQueueing ){
      // log('queue ele %s in layer %s', ele.id(), layer.id);
      self.queueLayer( layer, ele );
    } else {
      // log('draw ele %s in layer %s', ele.id(), layer.id);
      self.drawEleInLayer( layer, ele, lvl, pxRatio );
    }

    layer.eles.push( ele );

    caches[ lvl! ] = layer;
  }

  // log('--');

  if( tmpLayers ){ // then we only queued the current layerset and can't draw it yet
    return tmpLayers;
  }

  if( allowLazyQueueing ){
    // log('lazy queue level', lvl);
    return null;
  }

  return layers;
};

// a layer may want to use an ele cache of a higher level to avoid blurriness
// so the layer level might not equal the ele level
LTCp.getEleLevelForLayerLevel = function( this: LayeredTextureCacheInstance, lvl: number, _pxRatio?: number ){
  return lvl;
};

LTCp.drawEleInLayer = function( this: LayeredTextureCacheInstance, layer: Layer, ele: Element, lvl: number, pxRatio: number ){
  let self = this; // eslint-disable-line @typescript-eslint/no-this-alias
  let r = this.renderer;
  let context = layer.context;
  let bb = ele.boundingBox();

  if( bb.w === 0 || bb.h === 0 || !ele.visible() ){ return; }

  lvl = self.getEleLevelForLayerLevel( lvl, pxRatio );

  if( disableEleImgSmoothing ){ r.setImgSmoothing( context, false ); }

  if( useEleTxrCaching ){
    r.drawCachedElement( context, ele, null, null, lvl, useHighQualityEleTxrReqs );
  } else { // if the element is not cacheable, then draw directly
    r.drawElement( context, ele );
  }

  if( disableEleImgSmoothing ){ r.setImgSmoothing( context, true ); }
};

LTCp.levelIsComplete = function( this: LayeredTextureCacheInstance, lvl: number, eles: Collection ){
  let self = this; // eslint-disable-line @typescript-eslint/no-this-alias
  let layers = self.layersByLevel[ lvl ];

  if( !layers || layers.length === 0 ){ return false; }

  let numElesInLayers = 0;

  for( let i = 0; i < layers.length; i++ ){
    let layer = layers[i];

    // if there are any eles needed to be drawn yet, the level is not complete
    if( layer.reqs > 0 ){ return false; }

    // if the layer is invalid, the level is not complete
    if( layer.invalid ){ return false; }

    numElesInLayers += layer.eles.length;
  }

  // we should have exactly the number of eles passed in to be complete
  if( numElesInLayers !== eles.length ){ return false; }

  return true;
};

LTCp.validateLayersElesOrdering = function( this: LayeredTextureCacheInstance, lvl: number, eles: Collection ){
  let layers = this.layersByLevel[ lvl ];

  if( !layers ){ return; }

  // if in a layer the eles are not in the same order, then the layer is invalid
  // (i.e. there is an ele in between the eles in the layer)

  for( let i = 0; i < layers.length; i++ ){
    let layer = layers[i];
    let offset = -1;

    // find the offset
    for( let j = 0; j < eles.length; j++ ){
      if( layer.eles[0] === eles[j] ){
        offset = j;
        break;
      }
    }

    if( offset < 0 ){
      // then the layer has nonexistent elements and is invalid
      this.invalidateLayer( layer );
      continue;
    }

    // the eles in the layer must be in the same continuous order, else the layer is invalid

    let o = offset;

    for( let j = 0; j < layer.eles.length; j++ ){
      if( layer.eles[j] !== eles[o+j] ){
        // log('invalidate based on ordering', layer.id);

        this.invalidateLayer( layer );
        break;
      }
    }
  }
};

LTCp.updateElementsInLayers = function( this: LayeredTextureCacheInstance, eles: Collection | LayerEleReq[], update: ( layer: Layer, ele: Element, req: LayerEleReq | null ) => void ){
  let self = this; // eslint-disable-line @typescript-eslint/no-this-alias
  let isEles = is.element( eles[0] );

  // collect udpated elements (cascaded from the layers) and update each
  // layer itself along the way
  for( let i = 0; i < eles.length; i++ ){
    let req: LayerEleReq | null = isEles ? null : ( eles[i] as LayerEleReq );
    let ele: Element = isEles ? ( eles[i] as Element ) : ( eles[i] as LayerEleReq ).ele;
    let rs = ele._private.rscratch;
    let caches = ( rs.imgLayerCaches = rs.imgLayerCaches || {} ) as Record<number, Layer | null>;

    for( let l = minLvl; l <= maxLvl; l++ ){
      let layer = caches[l];

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

LTCp.haveLayers = function( this: LayeredTextureCacheInstance ){
  let self = this; // eslint-disable-line @typescript-eslint/no-this-alias
  let haveLayers = false;

  for( let l = minLvl; l <= maxLvl; l++ ){
    let layers = self.layersByLevel[l];

    if( layers && layers.length > 0 ){
      haveLayers = true;
      break;
    }
  }

  return haveLayers;
};

LTCp.invalidateElements = function( this: LayeredTextureCacheInstance, eles: Collection ){
  let self = this; // eslint-disable-line @typescript-eslint/no-this-alias

  if( eles.length === 0 ){ return; }

  self.lastInvalidationTime = util.performanceNow();

  // log('update invalidate layer time from eles');

  if( eles.length === 0 || !self.haveLayers() ){ return; }

  self.updateElementsInLayers( eles, function invalAssocLayers( layer: Layer, _ele: Element, _req: LayerEleReq | null ){
    self.invalidateLayer( layer );
  } );
};

LTCp.invalidateLayer = function( this: LayeredTextureCacheInstance, layer: Layer ){
  // log('update invalidate layer time');

  this.lastInvalidationTime = util.performanceNow();

  if( layer.invalid ){ return; } // save cycles

  let lvl = layer.level;
  let eles = layer.eles;
  let layers = this.layersByLevel[ lvl ];

   // log('invalidate layer', layer.id );

  util.removeFromArray( layers, layer );
  // layer.eles = [];

  layer.elesQueue = [];

  layer.invalid = true;

  if( layer.replacement ){
    layer.replacement.invalid = true;
  }

  for( let i = 0; i < eles.length; i++ ){
    let caches = eles[i]._private.rscratch.imgLayerCaches as Record<number, Layer | null> | undefined;

    if( caches ){
      caches[ lvl ] = null;
    }
  }
};

LTCp.refineElementTextures = function( this: LayeredTextureCacheInstance, eles: Collection ){
  let self = this; // eslint-disable-line @typescript-eslint/no-this-alias

  // log('refine', eles.length);

  self.updateElementsInLayers( eles, function refineEachEle( layer: Layer, _ele: Element, _req: LayerEleReq | null ){
    let rLyr: Layer = layer.replacement!;

    if( !rLyr ){
      rLyr = layer.replacement = self.makeLayer( layer.bb, layer.level ) as Layer;
      rLyr.replaces = layer;
      rLyr.eles = layer.eles;

       // log('make replacement layer %s for %s with level %s', rLyr.id, layer.id, rLyr.level);
    }

    if( !rLyr.reqs ){
      for( let i = 0; i < rLyr.eles.length; i++ ){
        self.queueLayer( rLyr, rLyr.eles[i] );
      }

       // log('queue replacement layer refinement', rLyr.id);
    }
  } );
};

LTCp.enqueueElementRefinement = function( this: LayeredTextureCacheInstance, ele: Element ){
  if( !useEleTxrCaching ){ return; }

  this.eleTxrDeqs.merge( ele );
  this.scheduleElementRefinement();
};

LTCp.queueLayer = function( this: LayeredTextureCacheInstance, layer: Layer, ele?: Element ){
  let self = this; // eslint-disable-line @typescript-eslint/no-this-alias
  let q = self.layersQueue;
  let elesQ = layer.elesQueue;
  let hasId = elesQ.hasId = elesQ.hasId || {};

  // if a layer is going to be replaced, queuing is a waste of time
  if( layer.replacement ){ return; }

  if( ele ){
    if( hasId[ ele.id()! ] ){
      return;
    }

    elesQ.push( ele );
    hasId[ ele.id()! ] = true;
  }

  if( layer.reqs ){
    layer.reqs++;

    q.updateItem( layer );
  } else {
    layer.reqs = 1;

    q.push( layer );
  }
};

LTCp.dequeue = function( this: LayeredTextureCacheInstance, pxRatio: number ){
  let self = this; // eslint-disable-line @typescript-eslint/no-this-alias
  let q = self.layersQueue;
  let deqd: boolean[] = [];
  let eleDeqs = 0;

  while( eleDeqs < maxDeqSize ){
    if( q.size() === 0 ){ break; }

    let layer = q.peek()!;

    // if a layer has been or will be replaced, then don't waste time with it
    if( layer.replacement ){
       // log('layer %s in queue skipped b/c it already has a replacement', layer.id);
      q.pop();
      continue;
    }

    // if this is a replacement layer that has been superceded, then forget it
    if( layer.replaces && layer !== layer.replaces.replacement ){
       // log('layer is no longer the most uptodate replacement; dequeued', layer.id)
      q.pop();
      continue;
    }

    if( layer.invalid ){
       // log('replacement layer %s is invalid; dequeued', layer.id);
      q.pop();
      continue;
    }

    let ele = layer.elesQueue.shift();

    if( ele ){
       // log('dequeue layer %s', layer.id);

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

       // log('dequeue of layer %s complete', layer.id);

      // when a replacement layer is dequeued, it replaces the old layer in the level
      if( layer.replaces ){
        self.applyLayerReplacement( layer );
      }

      self.requestRedraw();
    }
  }

  return deqd;
};

LTCp.applyLayerReplacement = function( this: LayeredTextureCacheInstance, layer: Layer ){
  let self = this; // eslint-disable-line @typescript-eslint/no-this-alias
  let layersInLevel = self.layersByLevel[ layer.level ];
  let replaced = layer.replaces as Layer; // only called for replacement layers, which always have `replaces`
  let index = layersInLevel.indexOf( replaced );

  // if the replaced layer is not in the active list for the level, then replacing
  // refs would be a mistake (i.e. overwriting the true active layer)
  if( index < 0 || replaced.invalid ){
     // log('replacement layer would have no effect', layer.id);
    return;
  }

  layersInLevel[ index ] = layer; // replace level ref

  // replace refs in eles
  for( let i = 0; i < layer.eles.length; i++ ){
    let _p = layer.eles[i]._private;
    let cache = ( _p.imgLayerCaches = _p.imgLayerCaches || {} ) as Record<number, Layer>;

    if( cache ){
      cache[ layer.level ] = layer;
    }
  }

   // log('apply replacement layer %s over %s', layer.id, replaced.id);

  self.requestRedraw();
};

LTCp.requestRedraw = util.debounce( function( this: LayeredTextureCacheInstance ){
  let r = this.renderer;

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
  deq: function( self: LayeredTextureCacheInstance, pxRatio: number ){
    return self.dequeue( pxRatio );
  },
  onDeqd: util.noop,
  shouldRedraw: util.trueify,
  priority: function( self: LayeredTextureCacheInstance ){
    return self.renderer.beforeRenderPriorities.lyrTxrDeq;
  }
});

export default LayeredTextureCache;
