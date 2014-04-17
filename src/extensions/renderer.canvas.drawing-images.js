;(function($$){ 'use strict';

  var CanvasRenderer = $$('renderer', 'canvas');
  
  var imageCache

  CanvasRenderer.prototype.getCachedImage = function(url, onLoad) {
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
    var nodeW = node.width();
    var nodeH = node.height();
    var rs = node._private.rscratch;
    var clip = style['background-clip'].value;
    var shouldClip = clip === 'node';
    
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

    if( rs.pathCache ){
      x -= nodeX;
      y -= nodeY;

      nodeX = 0;
      nodeY = 0;
    }

    if( repeat === 'no-repeat' ){

      if( shouldClip ){
        context.save();

        if( rs.pathCache ){
          context.clip( rs.pathCache );
        } else {
          CanvasRenderer.nodeShapes[r.getNodeShape(node)].drawPath(
            context,
            nodeX, nodeY, 
            nodeW, nodeH);

          context.clip();
        }
      }

      context.drawImage( img, 0, 0, img.width, img.height, x, y, w, h );

      if( shouldClip ){
        context.restore();
      }
    } else {
      var pattern = context.createPattern( img, repeat );
      context.fillStyle = pattern;

      CanvasRenderer.nodeShapes[r.getNodeShape(node)].drawPath(
          context,
          nodeX, nodeY, 
          nodeW, nodeH);

        context.translate(x, y);
        context.fill();
        context.translate(-x, -y);
    }
    
  };

  
})( cytoscape );