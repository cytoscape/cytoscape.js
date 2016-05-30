'use strict';

var BRp = {};

BRp.getCachedImage = function( url, onLoad ){
  var r = this;
  var imageCache = r.imageCache = r.imageCache || {};

  if( imageCache[ url ] && imageCache[ url ].image ){
    return imageCache[ url ].image;
  }

  var cache = imageCache[ url ] = imageCache[ url ] || {};

  var image = cache.image = new Image();
  image.addEventListener('load', onLoad);
  image.crossOrigin = 'Anonymous'; // prevent tainted canvas
  image.src = url;

  return image;
};

module.exports = BRp;
