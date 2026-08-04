import type { Renderer } from '../renderer-types.mjs';

interface CachedImage {
  image: HTMLImageElement & { error?: boolean };
}

let BRp: Record<string, unknown> = {};

BRp.getCachedImage = function( this: Renderer, url: string, crossOrigin: string | null, onLoad: () => void ){
  let r = this; // eslint-disable-line @typescript-eslint/no-this-alias
  let imageCache: Record<string, CachedImage> = r.imageCache = r.imageCache || {};
  let cache = imageCache[ url ];

  if( cache ){
    if( !cache.image.complete ){
      cache.image.addEventListener('load', onLoad);
    }

    return cache.image;
  } else {
    cache = imageCache[ url ] = imageCache[ url ] || {};

    let image = cache.image = new Image();

    image.addEventListener('load', onLoad);
    image.addEventListener('error', function(){ ( image as HTMLImageElement & { error?: boolean } ).error = true; });

    // #1582 safari doesn't load data uris with crossOrigin properly
    // https://bugs.webkit.org/show_bug.cgi?id=123978
    let dataUriPrefix = 'data:';
    let isDataUri = url.substring( 0, dataUriPrefix.length ).toLowerCase() === dataUriPrefix;
    if( !isDataUri ){
      // if crossorigin is 'null'(stringified), then manually set it to null
      crossOrigin = crossOrigin === 'null' ? null : crossOrigin;
      image.crossOrigin = crossOrigin; // prevent tainted canvas
    }

    image.src = url;

    return image;
  }
};

export default BRp;
