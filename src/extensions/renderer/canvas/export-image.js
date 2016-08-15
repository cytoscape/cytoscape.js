'use strict';

var is = require( '../../../is' );

var CRp = {};

CRp.createBuffer = function( w, h ){
  var buffer = document.createElement( 'canvas' ); // eslint-disable-line no-undef
  buffer.width = w;
  buffer.height = h;

  return [ buffer, buffer.getContext( '2d' ) ];
};

CRp.bufferCanvasImage = function( options ){
  var cy = this.cy;
  var eles = cy.mutableElements();
  var bb = eles.boundingBox();
  var width = options.full ? Math.ceil( bb.w ) : this.container.clientWidth;
  var height = options.full ? Math.ceil( bb.h ) : this.container.clientHeight;
  var specdMaxDims = is.number( options.maxWidth ) || is.number( options.maxHeight );
  var pxRatio = this.getPixelRatio();
  var scale = 1;

  if( options.scale !== undefined ){
    width *= options.scale;
    height *= options.scale;

    scale = options.scale;
  } else if( specdMaxDims ){
    var maxScaleW = Infinity;
    var maxScaleH = Infinity;

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

  var buffCanvas = document.createElement( 'canvas' ); // eslint-disable-line no-undef

  buffCanvas.width = width;
  buffCanvas.height = height;

  buffCanvas.style.width = width + 'px';
  buffCanvas.style.height = height + 'px';

  var buffCxt = buffCanvas.getContext( '2d' );

  // Rasterize the layers, but only if container has nonzero size
  if( width > 0 && height > 0 ){

    buffCxt.clearRect( 0, 0, width, height );

    if( options.bg ){
      buffCxt.fillStyle = options.bg;
      buffCxt.rect( 0, 0, width, height );
      buffCxt.fill();
    }

    buffCxt.globalCompositeOperation = 'source-over';

    var zsortedEles = this.getCachedZSortedEles();

    if( options.full ){ // draw the full bounds of the graph
      buffCxt.translate( -bb.x1 * scale, -bb.y1 * scale );
      buffCxt.scale( scale, scale );

      this.drawElements( buffCxt, zsortedEles );
    } else { // draw the current view
      var pan = cy.pan();

      var translation = {
        x: pan.x * scale,
        y: pan.y * scale
      };

      scale *= cy.zoom();

      buffCxt.translate( translation.x, translation.y );
      buffCxt.scale( scale, scale );

      this.drawElements( buffCxt, zsortedEles );
    }
  }

  return buffCanvas;
};

CRp.png = function( options ){
  return this.bufferCanvasImage( options ).toDataURL( 'image/png' );
};

CRp.jpg = function( options ){
  return this.bufferCanvasImage( options ).toDataURL( 'image/jpeg' );
};

module.exports = CRp;
