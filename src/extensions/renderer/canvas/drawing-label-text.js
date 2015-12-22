'use strict';

var is = require( '../../../is' );
var util = require( '../../../util' );

var CRp = {};

CRp.drawElementText = function( context, ele ){
  var _p = ele._private;

  var computedSize = ele.pstyle( 'font-size' ).pfValue * ele.cy().zoom();
  var minSize = ele.pstyle( 'min-zoomed-font-size' ).pfValue;

  if( computedSize < minSize ){
    return;
  }

  var rs = _p.rscratch;

  if( ele.isNode() ){
    var textHalign = ele.pstyle( 'text-halign' ).strValue;
    var textValign = ele.pstyle( 'text-valign' ).strValue;

    switch( textHalign ){
      case 'left':
        context.textAlign = 'right';
        break;

      case 'right':
        context.textAlign = 'left';
        break;

      default: // e.g. center
        context.textAlign = 'center';
    }

    switch( textValign ){
      case 'top':
        context.textBaseline = 'bottom';
        break;

      case 'bottom':
        context.textBaseline = 'top';
        break;

      default: // e.g. center
        context.textBaseline = 'middle';
    }
  } else {
    context.textAlign = 'center';
    context.textBaseline = 'middle';
  }


  this.drawText( context, ele );

  if( ele.isEdge() ){
    this.drawText( context, ele, 'source' );

    this.drawText( context, ele, 'target' );
  }
};

CRp.drawNodeText = CRp.drawEdgeText = CRp.drawElementText;

CRp.getFontCache = function( context ){
  var cache;

  this.fontCaches = this.fontCaches || [];

  for( var i = 0; i < this.fontCaches.length; i++ ){
    cache = this.fontCaches[ i ];

    if( cache.context === context ){
      return cache;
    }
  }

  cache = {
    context: context
  };
  this.fontCaches.push( cache );

  return cache;
};

// set up canvas context with font
// returns transformed text string
CRp.setupTextStyle = function( context, ele ){
  // Font style
  var parentOpacity = ele.effectiveOpacity();
  var labelStyle = ele.pstyle( 'font-style' ).strValue;
  var labelSize = ele.pstyle( 'font-size' ).pfValue + 'px';
  var labelFamily = ele.pstyle( 'font-family' ).strValue;
  var labelWeight = ele.pstyle( 'font-weight' ).strValue;
  var opacity = ele.pstyle( 'text-opacity' ).value * ele.pstyle( 'opacity' ).value * parentOpacity;
  var outlineOpacity = ele.pstyle( 'text-outline-opacity' ).value * opacity;
  var color = ele.pstyle( 'color' ).value;
  var outlineColor = ele.pstyle( 'text-outline-color' ).value;
  var shadowBlur = ele.pstyle( 'text-shadow-blur' ).pfValue;
  var shadowOpacity = ele.pstyle( 'text-shadow-opacity' ).value;
  var shadowColor = ele.pstyle( 'text-shadow-color' ).value;
  var shadowOffsetX = ele.pstyle( 'text-shadow-offset-x' ).pfValue;
  var shadowOffsetY = ele.pstyle( 'text-shadow-offset-y' ).pfValue;

  var fontCacheKey = ele._private.fontKey;
  var cache = this.getFontCache( context );

  if( cache.key !== fontCacheKey ){
    context.font = labelStyle + ' ' + labelWeight + ' ' + labelSize + ' ' + labelFamily;

    cache.key = fontCacheKey;
  }

  // Calculate text draw position based on text alignment

  // so text outlines aren't jagged
  context.lineJoin = 'round';

  this.fillStyle( context, color[ 0 ], color[ 1 ], color[ 2 ], opacity );

  this.strokeStyle( context, outlineColor[ 0 ], outlineColor[ 1 ], outlineColor[ 2 ], outlineOpacity );

  this.shadowStyle( context, shadowColor, shadowOpacity, shadowBlur, shadowOffsetX, shadowOffsetY );
};

function roundRect( ctx, x, y, width, height, radius ){
  var radius = radius || 5;
  ctx.beginPath();
  ctx.moveTo( x + radius, y );
  ctx.lineTo( x + width - radius, y );
  ctx.quadraticCurveTo( x + width, y, x + width, y + radius );
  ctx.lineTo( x + width, y + height - radius );
  ctx.quadraticCurveTo( x + width, y + height, x + width - radius, y + height );
  ctx.lineTo( x + radius, y + height );
  ctx.quadraticCurveTo( x, y + height, x, y + height - radius );
  ctx.lineTo( x, y + radius );
  ctx.quadraticCurveTo( x, y, x + radius, y );
  ctx.closePath();
  ctx.fill();
}

// Draw text
CRp.drawText = function( context, ele, prefix ){
  var _p = ele._private;
  var rstyle = _p.rstyle;
  var rscratch = _p.rscratch;
  var parentOpacity = ele.effectiveOpacity();
  if( parentOpacity === 0 || ele.pstyle( 'text-opacity' ).value === 0 ){
    return;
  }

  var pdash = prefix ? prefix + '-' : '';
  var textX = util.getPrefixedProperty( rscratch, 'labelX', prefix );
  var textY = util.getPrefixedProperty( rscratch, 'labelY', prefix );
  var textW = util.getPrefixedProperty( rscratch, 'labelWidth', prefix );
  var textH = util.getPrefixedProperty( rscratch, 'labelHeight', prefix );
  var textAngle = util.getPrefixedProperty( rscratch, 'labelAngle', prefix );
  var marginX = ele.pstyle( pdash + 'text-margin-x' ).pfValue;
  var marginY = ele.pstyle( pdash + 'text-margin-y' ).pfValue;
  var text = this.getLabelText( ele, prefix );

  this.setupTextStyle( context, ele );

  if( text != null && !isNaN( textX ) && !isNaN( textY ) ){
    var isEdge = ele.isEdge();
    var isNode = ele.isNode();

    var halign = ele.pstyle( 'text-halign' ).value;
    var valign = ele.pstyle( 'text-valign' ).value;

    if( isEdge ){
      halign = 'center';
      valign = 'center';
    }

    textX += marginX;
    textY += marginY;

    var rotation = ele.pstyle( 'text-rotation' );
    var theta;

    if( rotation.strValue === 'autorotate' ){
      theta = isEdge ? textAngle : 0;
    } else if( rotation.strValue === 'none' ){
      theta = 0;
    } else {
      theta = rotation.pfValue;
    }

    if( theta !== 0 ){
      var orgTextX = textX;
      var orgTextY = textY;

      context.translate( orgTextX, orgTextY );
      context.rotate( theta );

      textX = 0;
      textY = 0;
    }

    if( isNode ){
      var pLeft = ele.pstyle( 'padding-left' ).pfValue;
      var pRight = ele.pstyle( 'padding-right' ).pfValue;
      var pTop = ele.pstyle( 'padding-top' ).pfValue;
      var pBottom = ele.pstyle( 'padding-bottom' ).pfValue;

      textX += pLeft / 2;
      textX -= pRight / 2;

      textY += pTop / 2;
      textY -= pBottom / 2;
    }

    var backgroundOpacity = ele.pstyle( 'text-background-opacity' ).value;
    var borderOpacity = ele.pstyle( 'text-border-opacity' ).value;
    var textBorderWidth = ele.pstyle( 'text-border-width' ).pfValue;

    if( backgroundOpacity > 0 || ( textBorderWidth > 0 && borderOpacity > 0 ) ){
      var margin = 4 + textBorderWidth / 2;

      if( isNode ){
        //Move textX, textY to include the background margins
        if( valign === 'top' ){
          textY -= margin;
        } else if( valign === 'bottom' ){
          textY += margin;
        }
        if( halign === 'left' ){
          textX -= margin;
        } else if( halign === 'right' ){
          textX += margin;
        }
      }

      var bgWidth = textW;
      var bgHeight = textH;
      var bgX = textX;

      if( halign ){
        if( halign == 'center' ){
          bgX = bgX - bgWidth / 2;
        } else if( halign == 'left' ){
          bgX = bgX - bgWidth;
        }
      }

      var bgY = textY;

      if( isNode ){
        if( valign == 'top' ){
          bgY = bgY - bgHeight;
        } else if( valign == 'center' ){
          bgY = bgY - bgHeight / 2;
        }
      } else {
        bgY = bgY - bgHeight / 2;
      }

      // TODO #382 strongly suspect this is not needed
      if( ele.pstyle( 'text-rotation' ).strValue === 'autorotate' ){
        textY = 0;
        bgWidth += 4;
        bgX = textX - bgWidth / 2;
        bgY = textY - bgHeight / 2;
      } else {
        // Adjust with border width & margin
        bgX -= margin;
        bgY -= margin;
        bgHeight += margin * 2;
        bgWidth += margin * 2;
      }

      if( backgroundOpacity > 0 ){
        var textFill = context.fillStyle;
        var textBackgroundColor = ele.pstyle( 'text-background-color' ).value;

        context.fillStyle = 'rgba(' + textBackgroundColor[ 0 ] + ',' + textBackgroundColor[ 1 ] + ',' + textBackgroundColor[ 2 ] + ',' + backgroundOpacity * parentOpacity + ')';
        var styleShape = ele.pstyle( 'text-background-shape' ).strValue;
        if( styleShape == 'roundrectangle' ){
          roundRect( context, bgX, bgY, bgWidth, bgHeight, 2 );
        } else {
          context.fillRect( bgX, bgY, bgWidth, bgHeight );
        }
        context.fillStyle = textFill;
      }

      if( textBorderWidth > 0 && borderOpacity > 0 ){
        var textStroke = context.strokeStyle;
        var textLineWidth = context.lineWidth;
        var textBorderColor = ele.pstyle( 'text-border-color' ).value;
        var textBorderStyle = ele.pstyle( 'text-border-style' ).value;

        context.strokeStyle = 'rgba(' + textBorderColor[ 0 ] + ',' + textBorderColor[ 1 ] + ',' + textBorderColor[ 2 ] + ',' + borderOpacity * parentOpacity + ')';
        context.lineWidth = textBorderWidth;

        if( context.setLineDash ){ // for very outofdate browsers
          switch( textBorderStyle ){
            case 'dotted':
              context.setLineDash( [ 1, 1 ] );
              break;
            case 'dashed':
              context.setLineDash( [ 4, 2 ] );
              break;
            case 'double':
              context.lineWidth = textBorderWidth / 4; // 50% reserved for white between the two borders
              context.setLineDash( [] );
              break;
            case 'solid':
              context.setLineDash( [] );
              break;
          }
        }

        context.strokeRect( bgX, bgY, bgWidth, bgHeight );

        if( textBorderStyle === 'double' ){
          var whiteWidth = textBorderWidth / 2;

          context.strokeRect( bgX + whiteWidth, bgY + whiteWidth, bgWidth - whiteWidth * 2, bgHeight - whiteWidth * 2 );
        }

        if( context.setLineDash ){ // for very outofdate browsers
          context.setLineDash( [] );
        }
        context.lineWidth = textLineWidth;
        context.strokeStyle = textStroke;
      }

    }

    var lineWidth = 2 * ele.pstyle( 'text-outline-width' ).pfValue; // *2 b/c the stroke is drawn centred on the middle

    if( lineWidth > 0 ){
      context.lineWidth = lineWidth;
    }

    if( ele.pstyle( 'text-wrap' ).value === 'wrap' ){
      var lines = rscratch.labelWrapCachedLines;
      var lineHeight = textH / lines.length;

      switch( valign ){
        case 'top':
          textY -= ( lines.length - 1 ) * lineHeight;
          break;

        case 'bottom':
          // nothing required
          break;

        default:
        case 'center':
          textY -= ( lines.length - 1 ) * lineHeight / 2;
      }

      for( var l = 0; l < lines.length; l++ ){
        if( lineWidth > 0 ){
          context.strokeText( lines[ l ], textX, textY );
        }

        context.fillText( lines[ l ], textX, textY );

        textY += lineHeight;
      }

    } else {
      if( lineWidth > 0 ){
        context.strokeText( text, textX, textY );
      }

      context.fillText( text, textX, textY );
    }

    if( theta !== 0 ){
      context.rotate( -theta );
      context.translate( -orgTextX, -orgTextY );
    }

    this.shadowStyle( context, 'transparent', 0 ); // reset for next guy
  }
};

module.exports = CRp;
