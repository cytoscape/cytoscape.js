'use strict';

var CRp = {};

CRp.safeDrawImage = function( context, img, ix, iy, iw, ih, x, y, w, h ){
  var r = this;

  try {
    context.drawImage( img, ix, iy, iw, ih, x, y, w, h );
  } catch( e ){
    r.redrawHint( 'eles', true );
    r.redrawHint( 'drag', true );

    r.drawingImage = true;

    r.redraw();
  }
};

CRp.drawInscribedImage = function( context, img, node ){
  var r = this;
  var nodeX = node._private.position.x;
  var nodeY = node._private.position.y;
  var fit = node.pstyle( 'background-fit' ).value;
  var xPos = node.pstyle( 'background-position-x' );
  var yPos = node.pstyle( 'background-position-y' );
  var repeat = node.pstyle( 'background-repeat' ).value;
  var nodeW = node.width();
  var nodeH = node.height();
  var rs = node._private.rscratch;
  var clip = node.pstyle( 'background-clip' ).value;
  var shouldClip = clip === 'node';
  var imgOpacity = node.pstyle( 'background-image-opacity' ).value;

  var imgW = img.width || img.cachedW;
  var imgH = img.height || img.cachedH;

  // workaround for broken browsers like ie
  if( null == imgW || null == imgH ){
    document.body.appendChild( img ); // eslint-disable-line no-undef

    imgW = img.cachedW = img.width || img.offsetWidth;
    imgH = img.cachedH = img.height || img.offsetHeight;

    document.body.removeChild( img ); // eslint-disable-line no-undef
  }

  var w = imgW;
  var h = imgH;

  var bgW = node.pstyle( 'background-width' );
  if( bgW.value !== 'auto' ){
    if( bgW.units === '%' ){
      w = bgW.value / 100 * nodeW;
    } else {
      w = bgW.pfValue;
    }
  }

  var bgH = node.pstyle( 'background-height' );
  if( bgH.value !== 'auto' ){
    if( bgH.units === '%' ){
      h = bgH.value / 100 * nodeH;
    } else {
      h = bgH.pfValue;
    }
  }

  if( w === 0 || h === 0 ){
    return; // no point in drawing empty image (and chrome is broken in this case)
  }

  if( fit === 'contain' ){
    var scale = Math.min( nodeW / w, nodeH / h );

    w *= scale;
    h *= scale;

  } else if( fit === 'cover' ){
    var scale = Math.max( nodeW / w, nodeH / h );

    w *= scale;
    h *= scale;
  }

  var x = (nodeX - nodeW / 2); // left
  if( xPos.units === '%' ){
    x += (nodeW - w) * xPos.value / 100;
  } else {
    x += xPos.pfValue;
  }

  var y = (nodeY - nodeH / 2); // top
  if( yPos.units === '%' ){
    y += (nodeH - h) * yPos.value / 100;
  } else {
    y += yPos.pfValue;
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
        r.nodeShapes[ r.getNodeShape( node ) ].draw(
          context,
          nodeX, nodeY,
          nodeW, nodeH );

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

    r.nodeShapes[ r.getNodeShape( node ) ].draw(
        context,
        nodeX, nodeY,
        nodeW, nodeH );

    context.translate( x, y );
    context.fill();
    context.translate( -x, -y );
  }

  context.globalAlpha = gAlpha;

};

module.exports = CRp;
