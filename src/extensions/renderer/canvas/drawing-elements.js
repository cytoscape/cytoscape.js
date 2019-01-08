import * as math from '../../../math';

let CRp = {};

CRp.drawElement = function( context, ele, shiftToOriginWithBb, showLabel, showOverlay, showOpacity ){
  let r = this;

  if( ele.isNode() ){
    r.drawNode( context, ele, shiftToOriginWithBb, showLabel, showOverlay, showOpacity );
  } else {
    r.drawEdge( context, ele, shiftToOriginWithBb, showLabel, showOverlay, showOpacity );
  }
};

CRp.drawElementOverlay = function( context, ele ){
  let r = this;

  if( ele.isNode() ){
    r.drawNodeOverlay( context, ele );
  } else {
    r.drawEdgeOverlay( context, ele );
  }
};

CRp.drawCachedElementPortion = function( context, ele, eleTxrCache, pxRatio, lvl, reason, getRotation ){
  let r = this;
  let bb = eleTxrCache.getBoundingBox(ele);

  if( bb.w === 0 || bb.h === 0 ){ return; } // ignore zero size case

  let eleCache = eleTxrCache.getElement( ele, bb, pxRatio, lvl, reason );

  if( eleCache != null ){
    let opacity = ele.pstyle('opacity').pfValue;

    if( opacity === 0 ){ return; }

    let theta = getRotation(r, ele);
    let { x1, y1, w, h } = bb;
    let x, y, sx, sy, smooth;

    if( theta !== 0 ){
      let halfW = w/2;
      let halfH = h/2;

      sx = x1 + halfW;
      sy = y1 + halfH;

      context.translate(sx, sy);
      context.rotate(theta);

      smooth = r.getImgSmoothing(context);

      if( !smooth ){ r.setImgSmoothing(context, true); }

      x = -halfW;
      y = -halfH;
    } else {
      x = x1;
      y = y1;
    }

    let oldGlobalAlpha;

    if( opacity !== 1 ){
      oldGlobalAlpha = context.globalAlpha;
      context.globalAlpha = oldGlobalAlpha * opacity;
    }

    context.drawImage( eleCache.texture.canvas, eleCache.x, 0, eleCache.width, eleCache.height, x, y, bb.w, bb.h );

    if( opacity !== 1 ){
      context.globalAlpha = oldGlobalAlpha;
    }

    if( theta !== 0 ){
      context.rotate(-theta);
      context.translate(-sx, -sy);

      if( !smooth ){ r.setImgSmoothing(context, false); }
    }
  } else {
    eleTxrCache.drawElement( context, ele ); // direct draw fallback
  }
};

const getZeroRotation = () => 0;
const getLabelRotation = (r, ele) => r.getTextAngle(ele, null);
const getSourceLabelRotation = (r, ele) => r.getTextAngle(ele, 'source');
const getTargetLabelRotation = (r, ele) => r.getTextAngle(ele, 'target');

CRp.drawCachedElement = function( context, ele, pxRatio, extent, lvl, requestHighQuality ){
  let r = this;
  let { eleTxrCache, lblTxrCache, slbTxrCache, tlbTxrCache } = r.data;

  let bb = ele.boundingBox();
  let reason = requestHighQuality === true ? eleTxrCache.reasons.highQuality : null;

  if( bb.w === 0 || bb.h === 0 || !ele.visible() ){ return; }

  if( !extent || math.boundingBoxesIntersect( bb, extent ) ){
    r.drawCachedElementPortion( context, ele, eleTxrCache, pxRatio, lvl, reason, getZeroRotation );
    r.drawCachedElementPortion( context, ele, lblTxrCache, pxRatio, lvl, reason, getLabelRotation );

    if( ele.isEdge() ){
      r.drawCachedElementPortion( context, ele, slbTxrCache, pxRatio, lvl, reason, getSourceLabelRotation );
      r.drawCachedElementPortion( context, ele, tlbTxrCache, pxRatio, lvl, reason, getTargetLabelRotation );
    }

    r.drawElementOverlay( context, ele );
  }
};

CRp.drawElements = function( context, eles ){
  let r = this;

  for( let i = 0; i < eles.length; i++ ){
    let ele = eles[ i ];

    r.drawElement( context, ele );
  }
};

CRp.drawCachedElements = function( context, eles, pxRatio, extent ){
  let r = this;

  for( let i = 0; i < eles.length; i++ ){
    let ele = eles[ i ];

    r.drawCachedElement( context, ele, pxRatio, extent );
  }
};

CRp.drawCachedNodes = function( context, eles, pxRatio, extent ){
  let r = this;

  for( let i = 0; i < eles.length; i++ ){
    let ele = eles[ i ];

    if( !ele.isNode() ){ continue; }

    r.drawCachedElement( context, ele, pxRatio, extent );
  }
};

CRp.drawLayeredElements = function( context, eles, pxRatio, extent ){
  let r = this;

  let layers = r.data.lyrTxrCache.getLayers( eles, pxRatio );

  if( layers ){
    for( let i = 0; i < layers.length; i++ ){
      let layer = layers[i];
      let bb = layer.bb;

      if( bb.w === 0 || bb.h === 0 ){ continue; }

      context.drawImage( layer.canvas, bb.x1, bb.y1, bb.w, bb.h );
    }
  } else { // fall back on plain caching if no layers
    r.drawCachedElements( context, eles, pxRatio, extent );
  }
};

if( process.env.NODE_ENV !== 'production' ){
  CRp.drawDebugPoints = function( context, eles ){
    let draw = function( x, y, color ){
      context.fillStyle = color;
      context.fillRect( x - 1, y - 1, 3, 3 );
    };

    for( let i = 0; i < eles.length; i++ ){
      let ele = eles[i];
      let rs = ele._private.rscratch;

      if( ele.isNode() ){
        let p = ele.position();

        draw( p.x, p.y, 'magenta' );
      } else {
        let pts = rs.allpts;

        for( let j = 0; j + 1 < pts.length; j += 2 ){
          let x = pts[ j ];
          let y = pts[ j + 1 ];

          draw( x, y, 'cyan' );
        }

        draw( rs.midX, rs.midY, 'yellow' );
      }
    }
  };
}

export default CRp;
