;(function($$){ 'use strict';

  var CanvasRenderer = $$('renderer', 'canvas');
  var CRp = CanvasRenderer.prototype;

  // Draw edge text
  CRp.drawEdgeText = function(context, edge) {
    var text = edge._private.style['content'].strValue;

    if( !text || text.match(/^\s+$/) ){
      return;
    }

    if( this.hideEdgesOnViewport && (this.dragData.didDrag || this.pinching || this.hoverData.dragging || this.data.wheel || this.swipePanning) ){ return; } // save cycles on pinching

    var computedSize = edge._private.style['font-size'].pxValue * edge.cy().zoom();
    var minSize = edge._private.style['min-zoomed-font-size'].pxValue;

    if( computedSize < minSize ){
      return;
    }

    // Calculate text draw position

    context.textAlign = 'center';
    context.textBaseline = 'middle';
    
    var rs = edge._private.rscratch;
    if( !$$.is.number( rs.labelX ) || !$$.is.number( rs.labelY ) ){ return; } // no pos => label can't be rendered

    var style = edge._private.style;
    var autorotate = style['edge-text-rotation'].strValue === 'autorotate';
    var theta, dx, dy;

    if( autorotate ){
      switch( rs.edgeType ){
        case 'haystack':
          dx = rs.haystackPts[2] - rs.haystackPts[0];
          dy = rs.haystackPts[3] - rs.haystackPts[1];
          break;
        default:
          dx = rs.endX - rs.startX;
          dy = rs.endY - rs.startY;
      }

      theta = Math.atan( dy / dx );

      context.translate(rs.labelX, rs.labelY);
      context.rotate(theta);

      this.drawText(context, edge, 0, 0);

      context.rotate(-theta);
      context.translate(-rs.labelX, -rs.labelY);
    } else {
      this.drawText(context, edge, rs.labelX, rs.labelY);
    }

  };

  // Draw node text
  CRp.drawNodeText = function(context, node) {
    var text = node._private.style['content'].strValue;

    if ( !text || text.match(/^\s+$/) ) {
      return;
    }

    var computedSize = node._private.style['font-size'].pxValue * node.cy().zoom();
    var minSize = node._private.style['min-zoomed-font-size'].pxValue;

    if( computedSize < minSize ){
      return;
    }

    // this.recalculateNodeLabelProjection( node );

    var textHalign = node._private.style['text-halign'].strValue;
    var textValign = node._private.style['text-valign'].strValue;
    var rs = node._private.rscratch;
    if( !$$.is.number( rs.labelX ) || !$$.is.number( rs.labelY ) ){ return; } // no pos => label can't be rendered

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

    this.drawText(context, node, rs.labelX, rs.labelY);
  };

  CRp.getFontCache = function(context){
    var cache;

    this.fontCaches = this.fontCaches || [];

    for( var i = 0; i < this.fontCaches.length; i++ ){
      cache = this.fontCaches[i];

      if( cache.context === context ){
        return cache;
      }
    }

    cache = {
      context: context
    };
    this.fontCaches.push(cache);

    return cache;
  };

  // set up canvas context with font
  // returns transformed text string
  CRp.setupTextStyle = function( context, element ){
    // Font style
    var parentOpacity = element.effectiveOpacity();
    var style = element._private.style;
    var labelStyle = style['font-style'].strValue;
    var labelSize = style['font-size'].pxValue + 'px';
    var labelFamily = style['font-family'].strValue;
    var labelWeight = style['font-weight'].strValue;
    var opacity = style['text-opacity'].value * style['opacity'].value * parentOpacity;
    var outlineOpacity = style['text-outline-opacity'].value * opacity;
    var color = style['color'].value;
    var outlineColor = style['text-outline-color'].value;
    var shadowBlur = style['text-shadow-blur'].pxValue;
    var shadowOpacity = style['text-shadow-opacity'].value;
    var shadowColor = style['text-shadow-color'].value;
    var shadowOffsetX = style['text-shadow-offset-x'].pxValue;
    var shadowOffsetY = style['text-shadow-offset-y'].pxValue;

    var fontCacheKey = element._private.fontKey;
    var cache = this.getFontCache(context);

    if( cache.key !== fontCacheKey ){
      context.font = labelStyle + ' ' + labelWeight + ' ' + labelSize + ' ' + labelFamily;

      cache.key = fontCacheKey;
    }

    var text = this.getLabelText( element );

    // Calculate text draw position based on text alignment

    // so text outlines aren't jagged
    context.lineJoin = 'round';

    this.fillStyle(context, color[0], color[1], color[2], opacity);

    this.strokeStyle(context, outlineColor[0], outlineColor[1], outlineColor[2], outlineOpacity);

    this.shadowStyle(context, shadowColor, shadowOpacity, shadowBlur, shadowOffsetX, shadowOffsetY);

    return text;
  };

  function roundRect(ctx, x, y, width, height, radius) {
    var radius = radius || 5;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
  }

  // Draw text
  CRp.drawText = function(context, element, textX, textY) {
    var _p = element._private;
    var style = _p.style;
    var rstyle = _p.rstyle;
    var rscratch = _p.rscratch;
    var parentOpacity = element.effectiveOpacity();
    if( parentOpacity === 0 || style["text-opacity"].value === 0){ return; }

    var text = this.setupTextStyle( context, element );
    var halign = style["text-halign"].value;
    var valign = style["text-valign"].value;

    if( element.isEdge() ){
      halign = 'center';
      valign = 'center';
    }

    if ( text != null && !isNaN(textX) && !isNaN(textY)) {
      var backgroundOpacity = style["text-background-opacity"].value;
      if ((style["text-background-color"] && style["text-background-color"].value != "none" || style["text-border-width"].pxValue > 0) && backgroundOpacity > 0) {
        var textBorderWidth = style["text-border-width"].pxValue;
        var margin = 4 + textBorderWidth/2;

        if (element.isNode()) {
          //Move textX, textY to include the background margins
          if (valign == "top") {
            textY -=margin;
          } else if (valign == "bottom") {
            textY +=margin;
          }
          if (halign == "left") {
            textX -=margin;
          } else if (halign == "right") {
            textX +=margin;
          }
        }

        var bgWidth = rstyle.labelWidth;
        var bgHeight = rstyle.labelHeight;
        var bgX = textX;

        if (halign) {
          if (halign == "center") {
            bgX = bgX - bgWidth / 2;
          } else if (halign == "left") {
            bgX = bgX- bgWidth;
          }
        }

        var bgY = textY;

        if (element.isNode()) {
          if (valign == "top") {
             bgY = bgY - bgHeight;
          } else if (valign == "center") {
            bgY = bgY- bgHeight / 2;
          }
        } else {
          bgY = bgY - bgHeight / 2;
        }

        if (style['edge-text-rotation'].strValue === 'autorotate') {
          textY = 0;
          bgWidth += 4;
          bgX = textX - bgWidth / 2;
          bgY = textY - bgHeight / 2;
        } else {
          // Adjust with border width & margin
          bgX -= margin;
          bgY -= margin;
          bgHeight += margin*2;
          bgWidth += margin*2;
        }

        if (style["text-background-color"]) {
          var textFill = context.fillStyle;
          var textBackgroundColor = style["text-background-color"].value;

          context.fillStyle = "rgba(" + textBackgroundColor[0] + "," + textBackgroundColor[1] + "," + textBackgroundColor[2] + "," + backgroundOpacity * parentOpacity + ")";
          var styleShape = style['text-background-shape'].strValue;
          if (styleShape == "roundrectangle") {
            roundRect(context, bgX, bgY, bgWidth, bgHeight, 2);
          } else {
            context.fillRect(bgX,bgY,bgWidth,bgHeight);
          }
          context.fillStyle = textFill;
        }

        if (textBorderWidth > 0) {
          var textStroke = context.strokeStyle;
          var textLineWidth = context.lineWidth;
          var textBorderColor = style["text-border-color"].value;
          var textBorderStyle = style['text-border-style'].value;

          context.strokeStyle = "rgba(" + textBorderColor[0] + "," + textBorderColor[1] + "," + textBorderColor[2] + "," + backgroundOpacity * parentOpacity + ")";
          context.lineWidth = textBorderWidth;

          if( context.setLineDash ){ // for very outofdate browsers
            switch( textBorderStyle ){
              case 'dotted':
                context.setLineDash([ 1, 1 ]);
                break;
              case 'dashed':
                context.setLineDash([ 4, 2 ]);
                break;
              case 'double':
                context.lineWidth = textBorderWidth/4; // 50% reserved for white between the two borders
              case 'solid':
                context.setLineDash([ ]);
                break;
            }
          }

          context.strokeRect(bgX,bgY,bgWidth,bgHeight);

          if( textBorderStyle === 'double' ){
            var whiteWidth = textBorderWidth/2;

            context.strokeRect(bgX+whiteWidth,bgY+whiteWidth,bgWidth-whiteWidth*2,bgHeight-whiteWidth*2);
          }

          if( context.setLineDash ){ // for very outofdate browsers
            context.setLineDash([ ]);
          }
          context.lineWidth = textLineWidth;
          context.strokeStyle = textStroke;
        }

      }

      var lineWidth = 2  * style['text-outline-width'].pxValue; // *2 b/c the stroke is drawn centred on the middle

      if( lineWidth > 0 ){
        context.lineWidth = lineWidth;
      }

      if( style['text-wrap'].value === 'wrap' ){ //console.log('draw wrap');
        var lines = rscratch.labelWrapCachedLines;
        var lineHeight = rstyle.labelHeight / lines.length;

        //console.log('lines', lines);

        switch( valign ){
          case 'top':
            textY -= (lines.length - 1) * lineHeight;
            break;

          case 'bottom':
            // nothing required
            break;

          default:
          case 'center':
            textY -= (lines.length - 1) * lineHeight / 2;
        }

        for( var l = 0; l < lines.length; l++ ){
          if( lineWidth > 0 ){
            context.strokeText( lines[l], textX, textY );
          }

          context.fillText( lines[l], textX, textY );

          textY += lineHeight;
        }

        // var fontSize = style['font-size'].pxValue;
        // wrapText(context, text, textX, textY, style['text-max-width'].pxValue, fontSize + 1);
      } else {
        if( lineWidth > 0 ){
          context.strokeText( text, textX, textY );
        }

        context.fillText( text, textX, textY );
      }


      this.shadowStyle(context, 'transparent', 0); // reset for next guy
    }
  };


})( cytoscape );
