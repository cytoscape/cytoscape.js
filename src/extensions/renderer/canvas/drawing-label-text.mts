import * as util from '../../../util/index.mjs';
import * as math from '../../../math.mjs';
import { labelHalign, labelValign } from '../../../style/align.mjs';
import type { Renderer, Element } from '../renderer-types.mjs';
import type { BoundingBox } from '../../../types.mjs';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- internal label-drawing mixin object assembled onto the renderer prototype
let CRp: any = {};

// Reading parsed style props returns ParsedStyleProperty | null | undefined whose
// value/pfValue fields are deliberately wide. For these built-in props the value is
// always present and of the documented numeric/string shape; this helper keeps the
// many local reads honest-but-terse with a single localized cast.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- built-in pstyle reads, see note above
const ps = ( ele: Element, prop: string ): any => ele.pstyle( prop );

CRp.eleTextBiggerThanMin = function( this: Renderer, ele: Element, scale?: number ){
  if( !scale ){
    let zoom = ele.cy().zoom();
    let pxRatio = this.getPixelRatio();
    let lvl = Math.ceil( math.log2( zoom * pxRatio ) ); // the effective texture level

    scale = Math.pow( 2, lvl );
  }

  let computedSize = ps( ele, 'font-size' ).pfValue * scale;
  let minSize = ps( ele, 'min-zoomed-font-size' ).pfValue;

  if( computedSize < minSize ){
    return false;
  }

  return true;
};

CRp.drawElementText = function( this: Renderer, context: CanvasRenderingContext2D, ele: Element, shiftToOriginWithBb?: BoundingBox | false, force?: boolean | null, prefix?: string | null, useEleOpacity = true ){
  let r = this; // eslint-disable-line @typescript-eslint/no-this-alias

  if( force == null ){
    if( useEleOpacity && !r.eleTextBiggerThanMin( ele ) ){ return; }
  } else if( force === false ){
    return;
  }

  if( ele.isNode() ){
    let label = ele.pstyle( 'label' );

    if( !label || !label.value ){ return; }

    let justification = r.getLabelJustification(ele);
    let isTextMetricsGlyph = ps( ele, 'text-metrics' ).strValue === 'glyph';

    context.textAlign = justification;
    context.textBaseline = isTextMetricsGlyph ? 'alphabetic' : 'bottom';
  } else {
    let badLine = ele.element()!._private.rscratch.badLine;
    let label = ele.pstyle( 'label' );
    let srcLabel = ele.pstyle( 'source-label' );
    let tgtLabel = ele.pstyle( 'target-label' );

    if(
      badLine || (
        ( !label || !label.value )
        && ( !srcLabel || !srcLabel.value )
        && ( !tgtLabel || !tgtLabel.value )
      )
    ){
      return;
    }

    context.textAlign = 'center';
    context.textBaseline = 'bottom';
  }

  let applyRotation = !shiftToOriginWithBb;

  let bb: BoundingBox | undefined;
  if( shiftToOriginWithBb ){
    bb = shiftToOriginWithBb;

    context.translate( -bb.x1, -bb.y1 );
  }

  if( prefix == null ){
    r.drawText( context, ele, null, applyRotation, useEleOpacity );

    if( ele.isEdge() ){
      r.drawText( context, ele, 'source', applyRotation, useEleOpacity );

      r.drawText( context, ele, 'target', applyRotation, useEleOpacity );
    }
  } else {
    r.drawText( context, ele, prefix, applyRotation, useEleOpacity );
  }

  if( shiftToOriginWithBb ){
    context.translate( bb!.x1, bb!.y1 ); // bb is set under the same guard above
  }
};

CRp.getFontCache = function( this: Renderer, context: CanvasRenderingContext2D ){
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- font cache entries are { context, ... } bookkeeping objects
  let cache: any;

  this.fontCaches = this.fontCaches || [];

  for( let i = 0; i < this.fontCaches.length; i++ ){
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
CRp.setupTextStyle = function( this: Renderer, context: CanvasRenderingContext2D, ele: Element, useEleOpacity = true ){
  // Font style
  let labelStyle = ps( ele, 'font-style' ).strValue;
  let labelSize = ps( ele, 'font-size' ).pfValue + 'px';
  let labelFamily = ps( ele, 'font-family' ).strValue;
  let labelWeight = ps( ele, 'font-weight' ).strValue;
  let opacity = (useEleOpacity ? ( ele.effectiveOpacity() as number ) * ps( ele, 'text-opacity' ).value : 1);
  let outlineOpacity = ps( ele, 'text-outline-opacity' ).value * opacity;
  let color = ps( ele, 'color' ).value;
  let outlineColor = ps( ele, 'text-outline-color' ).value;

  context.font = labelStyle + ' ' + labelWeight + ' ' + labelSize + ' ' + labelFamily;

  context.lineJoin = 'round'; // so text outlines aren't jagged

  this.colorFillStyle( context, color[ 0 ], color[ 1 ], color[ 2 ], opacity );

  this.colorStrokeStyle( context, outlineColor[ 0 ], outlineColor[ 1 ], outlineColor[ 2 ], outlineOpacity );
};

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) {
  const diameter = Math.min(width, height);
  const radius = diameter / 2;

  const centerX = x + width / 2;
  const centerY = y + height / 2;

  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.closePath();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius = 5) {
  const r = Math.min(radius, width / 2, height / 2); // prevent overflow
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

CRp.getTextAngle = function( this: Renderer, ele: Element, prefix?: string | null ){
  let theta;
  let _p = ele._private;
  let rscratch = _p.rscratch;
  let pdash = prefix ? prefix + '-' : '';
  let rotation = ps( ele, pdash + 'text-rotation' );
  
  if( rotation.strValue === 'autorotate' ){
    let textAngle = util.getPrefixedProperty( rscratch, 'labelAngle', prefix );
    theta = ele.isEdge() ? textAngle : 0;
  } else if( rotation.strValue === 'none' ){
    theta = 0;
  } else {
    theta = rotation.pfValue;
  }

  return theta;
};

CRp.drawText = function( this: Renderer, context: CanvasRenderingContext2D, ele: Element, prefix?: string | null, applyRotation = true, useEleOpacity = true ){
  let _p = ele._private;
  let rscratch = _p.rscratch;
  // prefixed rscratch reads are numbers/strings/arrays per key; keep local reads terse
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- prefixed rscratch property reads
  let gp = ( prop: string ): any => util.getPrefixedProperty( rscratch, prop, prefix );
  let parentOpacity = useEleOpacity ? ( ele.effectiveOpacity() as number ) : 1;

  if( useEleOpacity && (parentOpacity === 0 || ps( ele, 'text-opacity' ).value === 0) ){
    return;
  }

  // use 'main' as an alias for the main label (i.e. null prefix)
  if( prefix === 'main' ){ prefix = null; }

  let textX = gp( 'labelX' );
  let textY = gp( 'labelY' );
  let orgTextX, orgTextY; // used for rotation
  let text = this.getLabelText( ele, prefix );

  if( text != null && text !== '' && !isNaN( textX ) && !isNaN( textY ) ){
    this.setupTextStyle( context, ele, useEleOpacity );

    let pdash = prefix ? prefix + '-' : '';
    let textW = gp( 'labelWidth' );
    let textH = gp( 'labelHeight' );
    let labelActualDescent = gp( 'labelActualDescent' );
    let marginX = ps( ele, pdash + 'text-margin-x' ).pfValue;
    let marginY = ps( ele, pdash + 'text-margin-y' ).pfValue;

    let isEdge = ele.isEdge();

    let halign = ps( ele, 'text-halign' ).value;
    let valign = ps( ele, 'text-valign' ).value;

    if( isEdge ){
      halign = 'center';
      valign = 'center';
    }

    textX += marginX;
    textY += marginY;

    let theta;

    if( !applyRotation ){
      theta = 0;
    } else {
      theta = this.getTextAngle(ele, prefix);
    }

    if( theta !== 0 ){
      orgTextX = textX;
      orgTextY = textY;

      context.translate( orgTextX, orgTextY );
      context.rotate( theta );

      textX = 0;
      textY = 0;
    }

    let boxHalign = labelHalign( halign );
    let boxValign = labelValign( valign );

    switch( boxValign ){
      case 'top':
        break;
      case 'center':
        textY += textH / 2;
        break;
      case 'bottom':
        textY += textH;
        break;
    }

    let backgroundOpacity = ps( ele, 'text-background-opacity' ).value;
    let borderOpacity = ps( ele, 'text-border-opacity' ).value;
    let textBorderWidth = ps( ele, 'text-border-width' ).pfValue;
    let backgroundPadding = ps( ele, 'text-background-padding' ).pfValue;
    let styleShape = ps( ele, 'text-background-shape' ).strValue;
    let rounded = styleShape === 'round-rectangle' || styleShape === 'roundrectangle';
    let circled = styleShape === 'circle';
    let roundRadius = 2;

    if( backgroundOpacity > 0 || ( textBorderWidth > 0 && borderOpacity > 0 ) ){
      let textFill = context.fillStyle;
      let textStroke = context.strokeStyle;
      let textLineWidth = context.lineWidth;

      let textBackgroundColor = ps( ele, 'text-background-color' ).value;
      let textBorderColor = ps( ele, 'text-border-color' ).value;
      let textBorderStyle = ps( ele, 'text-border-style' ).value;

      let doFill = backgroundOpacity > 0;
      let doStroke = textBorderWidth > 0 && borderOpacity > 0;

      let bgX = textX - backgroundPadding;
      switch( boxHalign ){
        case 'left':   bgX -= textW; break;
        case 'center': bgX -= textW / 2; break;
      }

      let bgY = textY - textH - backgroundPadding;
      let bgW = textW + 2*backgroundPadding;
      let bgH = textH + 2*backgroundPadding;

      if( doFill ){
        context.fillStyle = `rgba(${textBackgroundColor[0]},${textBackgroundColor[1]},${textBackgroundColor[2]},${backgroundOpacity * parentOpacity})`;
      }

      if( doStroke ){
        context.strokeStyle = `rgba(${textBorderColor[0]},${textBorderColor[1]},${textBorderColor[2]},${borderOpacity * parentOpacity})`;
        context.lineWidth = textBorderWidth;

        if( context.setLineDash ){
          switch( textBorderStyle ){
            case 'dotted': context.setLineDash([1, 1]); break;
            case 'dashed': context.setLineDash([4, 2]); break;
            case 'double':
              context.lineWidth = textBorderWidth / 4;
              context.setLineDash([]);
              break;
            case 'solid': default: context.setLineDash([]); break;
          }
        }
      }

      if( rounded ){
        context.beginPath();
        roundRect(context, bgX, bgY, bgW, bgH, roundRadius); 
      } else if (circled){
        context.beginPath();
        circle(context, bgX, bgY, bgW, bgH); 
      } else {
        context.beginPath();
        context.rect(bgX, bgY, bgW, bgH);
      }

      if( doFill ) context.fill();
      if( doStroke ) context.stroke();

      // Double border pass for 'double' style
      if( doStroke && textBorderStyle === 'double' ){
        let whiteWidth = textBorderWidth / 2;
        context.beginPath();

        if( rounded ){
          roundRect(context, bgX + whiteWidth, bgY + whiteWidth, bgW - 2*whiteWidth, bgH - 2*whiteWidth, roundRadius);
        } else {
          context.rect(bgX + whiteWidth, bgY + whiteWidth, bgW - 2*whiteWidth, bgH - 2*whiteWidth);
        }

        context.stroke();
      }

      context.fillStyle = textFill;
      context.strokeStyle = textStroke;
      context.lineWidth = textLineWidth;
      if( context.setLineDash ) context.setLineDash([]);
    }

    let lineWidth = 2 * ps( ele, 'text-outline-width' ).pfValue; // *2 b/c the stroke is drawn centred on the middle

    if( lineWidth > 0 ){
      context.lineWidth = lineWidth;
    }
    
    textY -= labelActualDescent;
    if( ps( ele, 'text-wrap' ).value === 'wrap' ){
      let lines = gp( 'labelWrapCachedLines' );
      let lineHeight = gp( 'labelLineHeight' );
      let halfTextW = textW/2;
      let justification = this.getLabelJustification(ele);

      if( justification === 'auto' ){
        // then it's already ok, so skip all the other ifs
      } else if( boxHalign === 'left' ){ // auto justification : right
        if( justification === 'left' ){
          textX += -textW;
        } else if( justification === 'center' ){
          textX += -halfTextW;
        } // else same as auto
      } else if( boxHalign === 'center' ){ // auto justfication : center
        if( justification === 'left' ){
          textX += -halfTextW;
        } else if( justification === 'right' ){
          textX += halfTextW;
        } // else same as auto
      } else if( boxHalign === 'right' ){ // auto justification : left
        if( justification === 'center' ){
          textX += halfTextW;
        } else if( justification === 'right' ){
          textX += textW;
        } // else same as auto
      }

      switch( boxValign ){
        case 'top':
          textY -= ( lines.length - 1 ) * lineHeight;
          break;
        case 'center':
        case 'bottom':
          textY -= ( lines.length - 1 ) * lineHeight;
          break;
      }

      for( let l = 0; l < lines.length; l++ ){
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
  }
};

export default CRp;
