'use strict';

var util = require( '../../../util' );

// TODO optimise these values

var defNumLayers = 1; // default number of layers to use

var LayeredTextureCache = function( renderer ){
  this.renderer = renderer;
  this.layersByLevel = {}; // e.g. 2 => [ layer1, layer2, ..., layerN ]
};

var LTCp = LayeredTextureCache.prototype;

LTCp.getLayers = function(){};

LTCp.invalidateElement = function(){};

LTCp.retireTexture = function(){};

LTCp.recycleTexture = function(){};

LTCp.addTexture = function(){};

LTCp.dequeueLayers = function(){};

LTCp.setupDequeueing = function(){};


module.exports = LayeredTextureCache;
