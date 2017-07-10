var math = require( '../../../math' );

var CRp = {};

CRp.drawElement = function( context, ele, shiftToOriginWithBb, showLabel ){
  var r = this;

  if( ele.isNode() ){
    r.drawNode( context, ele, shiftToOriginWithBb, showLabel );
  } else {
    r.drawEdge( context, ele, shiftToOriginWithBb, showLabel );
  }
};

CRp.drawCachedElement = function( context, ele, pxRatio, extent ){
  var r = this;
  var bb = ele.boundingBox();

  if( bb.w === 0 || bb.h === 0 ){ return; }

  if( !extent || math.boundingBoxesIntersect( bb, extent ) ){
    var cache = r.data.eleTxrCache.getElement( ele, bb, pxRatio );

    if( cache ){
      context.drawImage( cache.texture.canvas, cache.x, 0, cache.width, cache.height, bb.x1, bb.y1, bb.w, bb.h );
    } else { // if the element is not cacheable, then draw directly
      r.drawElement( context, ele );
    }
  }
};

CRp.drawElements = function( context, eles ){
  var r = this;

  for( var i = 0; i < eles.length; i++ ){
    var ele = eles[ i ];

    r.drawElement( context, ele );
  }
};

CRp.drawCachedElements = function( context, eles, pxRatio, extent ){
  var r = this;

  for( var i = 0; i < eles.length; i++ ){
    var ele = eles[ i ];

    r.drawCachedElement( context, ele, pxRatio, extent );
  }
};

CRp.drawCachedNodes = function( context, eles, pxRatio, extent ){
  var r = this;

  for( var i = 0; i < eles.length; i++ ){
    var ele = eles[ i ];

    if( !ele.isNode() ){ continue; }

    r.drawCachedElement( context, ele, pxRatio, extent );
  }
};

CRp.drawLayeredElements = function( context, eles, pxRatio, extent ){
  var r = this;

  var layers = r.data.lyrTxrCache.getLayers( eles, pxRatio );

  if( layers ){
    for( var i = 0; i < layers.length; i++ ){
      var layer = layers[i];
      var bb = layer.bb;

      if( bb.w === 0 || bb.h === 0 ){ continue; }

      context.drawImage( layer.canvas, bb.x1, bb.y1, bb.w, bb.h );
    }
  } else { // fall back on plain caching if no layers
    r.drawCachedElements( context, eles, pxRatio, extent );
  }
};

CRp.drawDebugPoints = function( context, eles ){
  var draw = function( x, y, color ){
    context.fillStyle = color;
    context.fillRect( x - 1, y - 1, 3, 3 );
  }

  for( var i = 0; i < eles.length; i++ ){
    var ele = eles[i];
    var rs = ele._private.rscratch;

    if( ele.isNode() ){
      var p = ele.position();

      draw( p.x, p.y, 'magenta' );
    } else {
      var pts = rs.allpts;

      for( var j = 0; j + 1 < pts.length; j += 2 ){
        var x = pts[ j ];
        var y = pts[ j + 1 ];

        draw( x, y, 'cyan' );
      }

      draw( rs.midX, rs.midY, 'yellow' );
    }
  }
};

module.exports = CRp;
