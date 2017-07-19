let math = require( '../../../math' );

let CRp = {};

CRp.drawElement = function( context, ele, shiftToOriginWithBb, showLabel ){
  let r = this;

  if( ele.isNode() ){
    r.drawNode( context, ele, shiftToOriginWithBb, showLabel );
  } else {
    r.drawEdge( context, ele, shiftToOriginWithBb, showLabel );
  }
};

CRp.drawCachedElement = function( context, ele, pxRatio, extent ){
  let r = this;
  let bb = ele.boundingBox();

  if( bb.w === 0 || bb.h === 0 ){ return; }

  if( !extent || math.boundingBoxesIntersect( bb, extent ) ){
    let cache = r.data.eleTxrCache.getElement( ele, bb, pxRatio );

    if( cache != null ){
      context.drawImage( cache.texture.canvas, cache.x, 0, cache.width, cache.height, bb.x1, bb.y1, bb.w, bb.h );
    } else { // if the element is not cacheable, then draw directly
      r.drawElement( context, ele );
    }
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

module.exports = CRp;
