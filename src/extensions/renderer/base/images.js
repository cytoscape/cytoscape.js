'use strict';

var BRp = {};

BRp.getCachedImage = function( url, crossOrigin, onLoad ){
  var r = this;
  var imageCache = r.imageCache = r.imageCache || {};
  var cache = imageCache[ url ];

  if( cache ){
    if( !cache.image.complete ){
      cache.image.addEventListener('load', onLoad);
      cache.image.addEventListener('error', function(){ cache.image.renderable = cache.image.renderable = false; });
    }

    return cache.image;
  } else {
    cache = imageCache[ url ] = imageCache[ url ] || {};

    var image = cache.image = new Image(); // eslint-disable-line no-undef
    image.addEventListener('load', onLoad);
    image.addEventListener('error', function(){ image.renderable = image.renderable = false; });

    // #1582 safari doesn't load data uris with crossOrigin properly
    // https://bugs.webkit.org/show_bug.cgi?id=123978
    var dataUriPrefix = 'data:';
    var isDataUri = url.substring( 0, dataUriPrefix.length ).toLowerCase() === dataUriPrefix;
    if( !isDataUri ){
      image.crossOrigin = crossOrigin; // prevent tainted canvas
    }

    image.src = url;

    return image;
  }
};

module.exports = BRp;
