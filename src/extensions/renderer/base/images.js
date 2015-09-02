(function($$) { 'use strict';

  var BaseRenderer = $$('renderer', 'base');
  var BR = BaseRenderer;
  var BRp = BR.prototype;

  BRp.getCachedImage = function(url, onLoad) {
    var r = this;
    var imageCache = r.imageCache = r.imageCache || {};

    if( imageCache[url] && imageCache[url].image ){
      return imageCache[url].image;
    }

    var cache = imageCache[url] = imageCache[url] || {};

    var image = cache.image = new Image();
    image.addEventListener('load', onLoad);
    image.src = url;

    return image;
  };

})( cytoscape );
