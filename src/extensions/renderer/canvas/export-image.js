;(function($$){ 'use strict';

  var CanvasRenderer = $$('renderer', 'canvas');
  var CRp = CanvasRenderer.prototype;

  CRp.createBuffer = function(w, h) {
    var buffer = document.createElement('canvas');
    buffer.width = w;
    buffer.height = h;

    return [buffer, buffer.getContext('2d')];
  };

  CRp.bufferCanvasImage = function( options ){
    var data = this.data;
    var cy = this.cy;
    var bb = cy.elements().boundingBox();
    var width = options.full ? Math.ceil(bb.w) : this.container.clientWidth;
    var height = options.full ? Math.ceil(bb.h) : this.container.clientHeight;
    var scale = 1;

    if( options.scale !== undefined ){
      width *= options.scale;
      height *= options.scale;

      scale = options.scale;
    } else if( $$.is.number(options.maxWidth) || $$.is.number(options.maxHeight) ){
      var maxScaleW = Infinity;
      var maxScaleH = Infinity;

      if( $$.is.number(options.maxWidth) ){
        maxScaleW = scale * options.maxWidth / width;
      }

      if( $$.is.number(options.maxHeight) ){
        maxScaleH = scale * options.maxHeight / height;
      }

      scale = Math.min( maxScaleW, maxScaleH );

      width *= scale;
      height *= scale;
    }

    var buffCanvas = document.createElement('canvas');

    buffCanvas.width = width;
    buffCanvas.height = height;

    buffCanvas.style.width = width + 'px';
    buffCanvas.style.height = height + 'px';

    var buffCxt = buffCanvas.getContext('2d');

    // Rasterize the layers, but only if container has nonzero size
    if (width > 0 && height > 0) {

      buffCxt.clearRect( 0, 0, width, height );

      if( options.bg ){
        buffCxt.fillStyle = options.bg;
        buffCxt.rect( 0, 0, width, height );
        buffCxt.fill();
      }

      buffCxt.globalCompositeOperation = 'source-over';

      if( options.full ){ // draw the full bounds of the graph
        this.render({
          forcedContext: buffCxt,
          drawAllLayers: true,
          forcedZoom: scale,
          forcedPan: { x: -bb.x1*scale, y: -bb.y1*scale },
          forcedPxRatio: 1
        });
      } else { // draw the current view
        var cyPan = cy.pan();
        var pan = {
          x: cyPan.x * scale,
          y: cyPan.y * scale
        };
        var zoom = cy.zoom() * scale;

        this.render({
          forcedContext: buffCxt,
          drawAllLayers: true,
          forcedZoom: zoom,
          forcedPan: pan,
          forcedPxRatio: 1
        });
      }
    }

    return buffCanvas;
  };

  CRp.png = function( options ){
    return this.bufferCanvasImage( options ).toDataURL('image/png');
  };

  CRp.jpg = function( options ){
    return this.bufferCanvasImage( options ).toDataURL('image/jpeg');
  };

})( cytoscape );
