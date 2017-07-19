var CRp = {};

CRp.safeDrawImage = function( context, img, ix, iy, iw, ih, x, y, w, h ){
  var r = this;

  // detect problematic cases for old browsers with bad images (cheaper than try-catch)
  if( iw <= 0 || ih <= 0 || w <= 0 || h <= 0 ){
    return;
  }

  context.drawImage( img, ix, iy, iw, ih, x, y, w, h );
};

CRp.drawInscribedImage = function( context, img, node, index, nodeOpacity ){
  var r = this;
  var pos = node.position();
  var nodeX = pos.x;
  var nodeY = pos.y;
  var styleObj = node.cy().style();
  var getIndexedStyle = styleObj.getIndexedStyle.bind( styleObj );
  var fit = getIndexedStyle( node, 'background-fit', 'value', index );
  var repeat = getIndexedStyle( node, 'background-repeat', 'value', index );
  var nodeW = node.width();
  var nodeH = node.height();
  var paddingX2 = node.padding() * 2;
  var nodeTW = nodeW + ( getIndexedStyle( node, 'background-width-relative-to', 'value', index ) === 'inner' ? 0 : paddingX2 );
  var nodeTH = nodeH + ( getIndexedStyle( node, 'background-height-relative-to', 'value', index ) === 'inner' ? 0 : paddingX2 );
  var rs = node._private.rscratch;
  var clip = node.pstyle( 'background-clip' ).value;
  var shouldClip = clip === 'node';
  var imgOpacity = getIndexedStyle( node, 'background-image-opacity', 'value', index ) * nodeOpacity;

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

  if( getIndexedStyle( node, 'background-width', 'value', index ) !== 'auto' ){
    if( getIndexedStyle( node, 'background-width', 'units', index ) === '%' ){
      w = getIndexedStyle( node, 'background-width', 'pfValue', index ) * nodeTW;
    } else {
      w = getIndexedStyle( node, 'background-width', 'pfValue', index );
    }
  }

  if( getIndexedStyle( node, 'background-height', 'value', index ) !== 'auto' ){
    if( getIndexedStyle( node, 'background-height', 'units', index ) === '%' ){
      h = getIndexedStyle( node, 'background-height', 'pfValue', index ) * nodeTH;
    } else {
      h = getIndexedStyle( node, 'background-height', 'pfValue', index );
    }
  }

  if( w === 0 || h === 0 ){
    return; // no point in drawing empty image (and chrome is broken in this case)
  }

  if( fit === 'contain' ){
    var scale = Math.min( nodeTW / w, nodeTH / h );

    w *= scale;
    h *= scale;

  } else if( fit === 'cover' ){
    var scale = Math.max( nodeTW / w, nodeTH / h );

    w *= scale;
    h *= scale;
  }

  var x = (nodeX - nodeTW / 2); // left
  if( getIndexedStyle( node, 'background-position-x', 'units', index ) === '%' ){
    x += (nodeTW - w) * getIndexedStyle( node, 'background-position-x', 'pfValue', index );
  } else {
    x += getIndexedStyle( node, 'background-position-x', 'pfValue', index );
  }

  var y = (nodeY - nodeTH / 2); // top
  if( getIndexedStyle( node, 'background-position-y', 'units', index ) === '%' ){
    y += (nodeTH - h) * getIndexedStyle( node, 'background-position-y', 'pfValue', index );
  } else {
    y += getIndexedStyle( node, 'background-position-y', 'pfValue', index );
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
          nodeTW, nodeTH );

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
        nodeTW, nodeTH );

    context.translate( x, y );
    context.fill();
    context.translate( -x, -y );
  }

  context.globalAlpha = gAlpha;

};

module.exports = CRp;
