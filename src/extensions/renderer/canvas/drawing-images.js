'use strict';

var CRp = {};

CRp.safeDrawImage = function( context, img, ix, iy, iw, ih, x, y, w, h ){
  var r = this;

  try {
    context.drawImage( img, ix, iy, iw, ih, x, y, w, h );
  } catch(e){
    r.data.canvasNeedsRedraw[r.NODE] = true;
    r.data.canvasNeedsRedraw[r.DRAG] = true;

    r.drawingImage = true;

    r.redraw();
  }
};

CRp.drawInscribedImage = function(context, img, node) {
  var r = this;
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
  var imgOpacity = style['background-image-opacity'].value;

  var imgW = img.width || img.cachedW;
  var imgH = img.height || img.cachedH;

  // workaround for broken browsers like ie
  if( (img.width === undefined || img.height === undefined) ){
    document.body.appendChild( img );

    imgW = img.cachedW = img.width;
    imgW = img.cachedH = img.height;

    document.body.removeChild( img );
  }

  var w = imgW;
  var h = imgH;

  if( w === 0 || h === 0 ){
    return; // no point in drawing empty image (and chrome is broken in this case)
  }

  var bgW = style['background-width'];
  if( bgW.value !== 'auto' ){
    if( bgW.units === '%' ){
      w = bgW.value/100 * nodeW;
    } else {
      w = bgW.pxValue;
    }
  }

  var bgH = style['background-height'];
  if( bgH.value !== 'auto' ){
    if( bgH.units === '%' ){
      h = bgH.value/100 * nodeH;
    } else {
      h = bgH.pxValue;
    }
  }

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

  var gAlpha = context.globalAlpha;

  context.globalAlpha = imgOpacity;

  if( repeat === 'no-repeat' ){

    if( shouldClip ){
      context.save();

      if( rs.pathCache ){
        context.clip( rs.pathCache );
      } else {
        r.nodeShapes[r.getNodeShape(node)].draw(
          context,
          nodeX, nodeY,
          nodeW, nodeH);

        context.clip();
      }
    }

    r.safeDrawImage( context, img, 0, 0, imgW, imgH, x, y, w, h );

    if( shouldClip ){
      context.restore();
    }
  } else {
    var pattern = context.createPattern( img, repeat );
    context.fillStyle = pattern;

    r.nodeShapes[r.getNodeShape(node)].draw(
        context,
        nodeX, nodeY,
        nodeW, nodeH);

      context.translate(x, y);
      context.fill();
      context.translate(-x, -y);
  }

  context.globalAlpha = gAlpha;

};

module.exports = CRp;
