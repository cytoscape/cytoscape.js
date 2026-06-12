/* global atob, ArrayBuffer, Uint8Array, Blob */

import * as is from '../../../is.mjs';
import Promise from '../../../promise.mjs';
import type { Renderer } from '../renderer-types.mjs';

// export options bag (full/scale/maxWidth/maxHeight/bg/output/quality)
interface ExportImageOptions {
  full?: boolean;
  scale?: number;
  maxWidth?: number;
  maxHeight?: number;
  bg?: string;
  output?: 'blob-promise' | 'blob' | 'base64' | 'base64uri' | string;
  quality?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- internal export-image mixin object assembled onto the renderer prototype
let CRp: any = {};

CRp.createBuffer = function( this: Renderer, w: number, h: number ){
  let buffer = document.createElement( 'canvas' );  
  buffer.width = w;
  buffer.height = h;

  return [ buffer, buffer.getContext( '2d' ) ];
};

CRp.bufferCanvasImage = function( this: Renderer, options: ExportImageOptions ){
  let cy = this.cy;
  let eles = cy.mutableElements();
  let bb = eles.boundingBox();
  let ctrRect = this.findContainerClientCoords();
  let width = options.full ? Math.ceil( bb.w ) : ctrRect[2];
  let height = options.full ? Math.ceil( bb.h ) : ctrRect[3];
  let specdMaxDims = is.number( options.maxWidth ) || is.number( options.maxHeight );
  let pxRatio = this.getPixelRatio();
  let scale = 1;

  if( options.scale !== undefined ){
    width *= options.scale;
    height *= options.scale;

    scale = options.scale;
  } else if( specdMaxDims ){
    let maxScaleW = Infinity;
    let maxScaleH = Infinity;

    if( is.number( options.maxWidth ) ){
      maxScaleW = scale * options.maxWidth / width;
    }

    if( is.number( options.maxHeight ) ){
      maxScaleH = scale * options.maxHeight / height;
    }

    scale = Math.min( maxScaleW, maxScaleH );

    width *= scale;
    height *= scale;
  }

  if( !specdMaxDims ){
    width *= pxRatio;
    height *= pxRatio;
    scale *= pxRatio;
  }

  let buffCanvas = document.createElement( 'canvas' );  

  buffCanvas.width = width;
  buffCanvas.height = height;

  buffCanvas.style.width = width + 'px';
  buffCanvas.style.height = height + 'px';

  let buffCxt = buffCanvas.getContext( '2d' )!; // 2d context always available on a fresh canvas

  // Rasterize the layers, but only if container has nonzero size
  if( width > 0 && height > 0 ){

    buffCxt.clearRect( 0, 0, width, height );

    buffCxt.globalCompositeOperation = 'source-over';

    let zsortedEles = this.getCachedZSortedEles();

    if( options.full ){ // draw the full bounds of the graph
      buffCxt.translate( -bb.x1 * scale, -bb.y1 * scale );
      buffCxt.scale( scale, scale );

      this.drawElements( buffCxt, zsortedEles );

      buffCxt.scale( 1/scale, 1/scale );
      buffCxt.translate( bb.x1 * scale, bb.y1 * scale );
    } else { // draw the current view
      let pan = cy.pan();

      let translation = {
        x: pan.x * scale,
        y: pan.y * scale
      };

      scale *= cy.zoom();

      buffCxt.translate( translation.x, translation.y );
      buffCxt.scale( scale, scale );

      this.drawElements( buffCxt, zsortedEles );

      buffCxt.scale( 1/scale, 1/scale );
      buffCxt.translate( -translation.x, -translation.y );
    }

    // need to fill bg at end like this in order to fill cleared transparent pixels in jpgs
    if( options.bg ){
      buffCxt.globalCompositeOperation = 'destination-over';

      buffCxt.fillStyle = options.bg;
      buffCxt.rect( 0, 0, width, height );
      buffCxt.fill();
    }
  }

  return buffCanvas;
};

function b64ToBlob( b64: string, mimeType: string ){
  let bytes = atob( b64 );
  let buff = new ArrayBuffer( bytes.length );
  let buffUint8 = new Uint8Array( buff );

  for( let i = 0; i < bytes.length; i++ ){
    buffUint8[i] = bytes.charCodeAt(i);
  }

  return new Blob( [buff], { type: mimeType } );
}

function b64UriToB64( b64uri: string ){
  let i = b64uri.indexOf(',');

  return b64uri.substr( i + 1 );
}

function output( options: ExportImageOptions, canvas: HTMLCanvasElement, mimeType: string ){
  let getB64Uri = () => canvas.toDataURL( mimeType, options.quality );

  switch( options.output ){
    case 'blob-promise':
      return new Promise((resolve, reject) => {
        try {
          canvas.toBlob(blob => {
            if( blob != null ){
              resolve(blob);
            } else {
              reject( new Error('`canvas.toBlob()` sent a null value in its callback') );
            }
          }, mimeType, options.quality);
        } catch( err ){
          reject(err);
        }
      });

    case 'blob':
      return b64ToBlob( b64UriToB64( getB64Uri() ), mimeType );

    case 'base64':
      return b64UriToB64( getB64Uri() );

    case 'base64uri':
    default:
      return getB64Uri();
  }
}

CRp.png = function( this: Renderer, options: ExportImageOptions ){
  return output( options, this.bufferCanvasImage( options ), 'image/png' );
};

CRp.jpg = function( this: Renderer, options: ExportImageOptions ){
  return output( options, this.bufferCanvasImage( options ), 'image/jpeg' );
};

export default CRp;
