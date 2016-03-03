'use strict';

var util = require( '../../../util' );

// TODO optimise these values

var defNumLayers = 1; // default number of layers to use
var minLvl = -4; // when scaling smaller than that we don't need to re-render
var maxLvl = 2; // when larger than this scale just render directly (caching is not helpful)
var maxZoom = 1.99; // beyond this zoom level, layered textures are not used
var allowEdgeTxrCaching = true; // whether edges can be cached as textures (TODO maybe better on if webgl supported?)

var LayeredTextureCache = function( renderer ){
  this.renderer = renderer;
  this.layersByLevel = {}; // e.g. 2 => [ layer1, layer2, ..., layerN ]
};

var LTCp = LayeredTextureCache.prototype;

LTCp.getLayers = function( eles, pxRatio, lvl ){
  var r = this.renderer;
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

  var scale = Math.pow( 2, lvl );
  var layers = this.layersByLevel[ lvl ] = this.layersByLevel[ lvl ] || [];
  var bb;

  var makeLayer = function( oldLayer ){
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
      eles: cy.collection()
    };

    var cxt = layer.context;
    var dx = -layer.bb.x1;
    var dy = -layer.bb.y1;

    // do the transform on creation to save cycles (it's the same for all eles)
    cxt.scale( scale, scale );
    cxt.translate( dx, dy );

    if( oldLayer != null ){ // put after old layer
      var index = layers.indexOf( oldLayer ) + 1;

      layers.splice( index, 0, layer );
    } else {
      layers.push( layer );
    }

    return layer;
  };

  var layer;
  var maxElesPerLayer = eles.length / defNumLayers;
  var needFreshLayerNextMiss = false;

  for( var i = 0; i < eles.length; i++ ){
    var ele = eles[i];
    var rs = ele._private.rscratch;
    var caches = rs.imgLayerCaches = rs.imgLayerCaches || {};

    if( !caches[ lvl ] ){
      if( !layer || needFreshLayerNextMiss || layer.eles.length >= maxElesPerLayer ){
        layer = makeLayer( layer );
        needFreshLayerNextMiss = false;
      }

      // r.drawElement( layer.context, ele, pxRatio );
      // TODO invalidate when fresh ele caches are available
      r.drawCachedElement( layer.context, ele, pxRatio );

      layer.eles.merge( ele );

      caches[ lvl ] = layer;
    } else {
      // if we have (ele not in cached layer) then (ele in cached layer), then we
      // need to generate a fresh layer the next time we get another (ele not in cached layer)
      layer = caches[ lvl ];
      needFreshLayerNextMiss = true;
    }
  }

  return layers;
};

LTCp.invalidateElement = function(){
  // TODO
};

// maybe not needed? (simpler w/o)
LTCp.retireTexture = function(){};
LTCp.recycleTexture = function(){};
LTCp.addTexture = function(){};
LTCp.dequeueLayers = function(){};
LTCp.setupDequeueing = function(){};


module.exports = LayeredTextureCache;
