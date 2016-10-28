'use strict';

var BRp = {};

BRp.getCachedImage = function( url, onLoad ){
  var r = this;
  var imageCache = r.imageCache = r.imageCache || {};
  var cache = imageCache[ url ];

  if( cache ){
    if( !cache.image.complete ){
      cache.image.addEventListener('load', onLoad);
    }

    return cache.image;
  } else {
    cache = imageCache[ url ] = imageCache[ url ] || {};

    var image = cache.image = new Image(); // eslint-disable-line no-undef
    image.addEventListener('load', onLoad);
    image.crossOrigin = 'Anonymous'; // prevent tainted canvas
    image.src = url;

    return image;
  }
};

module.exports = BRp;
