;(function($$){ 'use strict';

  var CanvasRenderer = $$('renderer', 'canvas');
  var imageCache = {};
  
  CanvasRenderer.prototype.getCachedImage = function(url, onLoadRedraw) {

    if (imageCache[url] && imageCache[url].image) {
      return imageCache[url].image;
    }
    
    var imageContainer = imageCache[url];
    
    if (imageContainer == undefined) { 
      imageCache[url] = new Object();
      imageCache[url].image = new Image();
      imageCache[url].image.onload = onLoadRedraw;
      
      imageCache[url].image.src = url;
      
      imageContainer = imageCache[url];
    }
    
    return imageContainer.image;
  }
  
  // Attempt to replace the image object with a canvas buffer to solve zooming problem
  CanvasRenderer.prototype.swapCachedImage = function(url) {
    if (imageCache[url]) {
      
      if (imageCache[url].image
          && imageCache[url].image.complete) {
        
        var image = imageCache[url].image;
        
        var buffer = document.createElement('canvas');
        buffer.width = image.width;
        buffer.height = image.height;
        
        buffer.getContext('2d').drawImage(image,
            0, 0
          );
        
        imageCache[url].image = buffer;
        imageCache[url].swappedWithCanvas = true;
        
        return buffer;
      } else {
        return null;
      } 
    } else {
      return null;
    }
  }
  
  CanvasRenderer.prototype.updateImageCaches = function() {
  }

  CanvasRenderer.prototype.drawInscribedImage = function(context, img, node) {
    var r = this;
    var zoom = this.data.cy._private.zoom;
    var nodeX = node._private.position.x;
    var nodeY = node._private.position.y;
    var style = node._private.style;
    var fit = style['background-fit'].value;
    var xPos = style['background-position-x'];
    var yPos = style['background-position-y'];
    var repeat = style['background-repeat'].value;
    var nodeW = this.getNodeWidth(node);
    var nodeH = this.getNodeHeight(node);
    
    context.save();
    
    CanvasRenderer.nodeShapes[r.getNodeShape(node)].drawPath(
        context,
        nodeX, nodeY, 
        nodeW, nodeH);
    
    context.clip();
    
    var w = img.width;
    var h = img.height;

    if( fit === 'contain' ){
      var scale = Math.min( nodeW/w, nodeH/h );

      w *= scale;
      h *= scale;

    } else if( fit === 'cover' ){
      var scale = Math.max( nodeW/w, nodeH/h );

      w *= scale;
      h *= scale;
    }

    var x = (nodeX - nodeW/2); // left
    if( xPos.units === '%' ){
      x += (nodeW - w) * xPos.value/100;
    } else {
      x += xPos.pxValue;
    }

    var y = (nodeY - nodeH/2); // top
    if( yPos.units === '%' ){
      y += (nodeH - h) * yPos.value/100;
    } else {
      y += yPos.pxValue;
    }

    if( repeat === 'repeat-x' || repeat === 'repeat-y' || repeat === 'repeat' ){
      var pattern = context.createPattern( img, repeat );

      x = Math.min(x, nodeX + nodeW/2);
      x = Math.max(x, nodeX - nodeW/2);
      y = Math.min(y, nodeY + nodeY/2);
      y = Math.max(y, nodeY - nodeY/2);

      context.fillStyle = pattern;
      context.translate(x, y);

      if( repeat === 'repeat-x' ){
        context.fillRect( -nodeW, 0, 2*nodeW, nodeH );
      } else if( repeat === 'repeat-y' ){
        context.fillRect( 0, -nodeH, nodeW, 2*nodeH );
      } else {
        context.fill();
      }

      
    } else {
      context.drawImage( img, x, y, w, h );  
    }
    
    context.restore();
  
    
  };

  
})( cytoscape );