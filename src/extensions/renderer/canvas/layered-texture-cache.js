'use strict';

var util = require( '../../../util' );
var math = require( '../../../math' );

// TODO optimise these values

var defNumLayers = 1; // default number of layers to use
var minLvl = -4; // when scaling smaller than that we don't need to re-render
var maxLvl = 2; // when larger than this scale just render directly (caching is not helpful)
var maxZoom = 1.99; // beyond this zoom level, layered textures are not used
var allowEdgeTxrCaching = true; // whether edges can be cached as textures (TODO maybe better on if webgl supported?)

var LayeredTextureCache = function( renderer ){
  this.renderer = renderer;
  this.layersByLevel = {}; // e.g. 2 => [ layer1, layer2, ..., layerN ]

  window.cache = this; // TODO remove this debugging line
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
      eles: cy.collection()
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

    return layer;
  };

  // console.log( eles.map(function(ele){ return ele.id() }).join(' ') ); // TODO remove

  var layer;
  var maxElesPerLayer = eles.length / defNumLayers;

  this.validateLayersElesOrdering( lvl, eles );

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
      // console.log('make layer for', ele.id()) // TODO remove
      layer = makeLayer({ insert: true, after: layer });
    }

    // TODO invalidate when fresh ele caches are available
    r.drawCachedElement( layer.context, ele, pxRatio );

    layer.eles.merge( ele );

    caches[ lvl ] = layer;
  }

  return layers;
};

LTCp.validateLayersElesOrdering = function( lvl, eles ){
  var layers = this.layersByLevel[ lvl ];

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
    for( var j = 0; j < layer.eles.length; j++ ){
      if( layer.eles[ j ] !== eles[ offset + j ] ){
        this.invalidateLayer( layer );
        break;
      }
    }
  }
};

LTCp.invalidateElements = function( eles ){
  var r = this.renderer;
  var cy = r.cy;
  var invals = cy.collection();

  // collect invalid elements (cascaded from the layers) and invalidate each
  // layer itself along the way
  for( var i = 0; i < eles.length; i++ ){
    var ele = eles[i];
    var rs = ele._private.rscratch;
    var caches = rs.imgLayerCaches = rs.imgLayerCaches || {};

    for( var l = minLvl; l <= maxLvl; l++ ){
      var layer = caches[l];

      if( !layer ){ continue; }

      invals.merge( layer.eles );

      if( !layer.invalid ){
        util.removeFromArray( this.layersByLevel[l], layer );

        layer.invalid = true;
      }
    }
  }

  // clear the caches of invalid elements
  for( var i = 0; i < invals.length; i++ ){
    var ele = invals[i];

    ele._private.rscratch.imgLayerCaches = null;
  }
};

LTCp.invalidateLayer = function( layer ){
  var lvl = layer.level;
  var eles = layer.eles;

  // console.log('invalidate layer', layer)

  util.removeFromArray( this.layersByLevel[ lvl ], layer );

  layer.invalid = true;

  for( var i = 0; i < eles.length; i++ ){
    var caches = eles[i]._private.rscratch.imgLayerCaches;

    if( caches ){
      caches[ lvl ] = null;
    }
  }
};

module.exports = LayeredTextureCache;
