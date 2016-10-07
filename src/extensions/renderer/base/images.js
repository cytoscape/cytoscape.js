'use strict';

var BRp = {};

BRp.getCachedImage = function( url, onLoad ){
  var image = new Image(); // eslint-disable-line no-undef
  image.addEventListener('load', onLoad);
  image.crossOrigin = 'Anonymous'; // prevent tainted canvas
  image.src = url;

  return image;
};

module.exports = BRp;
