import * as math from '../../../math.mjs';
import type { Renderer, Element } from '../renderer-types.mjs';
import type { BoundingBox } from '../../../types.mjs';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- internal element-drawing mixin object assembled onto the renderer prototype
let CRp: any = {};

CRp.drawElement = function( this: Renderer, context: CanvasRenderingContext2D, ele: Element, shiftToOriginWithBb?: unknown, showLabel?: boolean, showOverlay?: boolean, showOpacity?: boolean ){
  let r = this; // eslint-disable-line @typescript-eslint/no-this-alias

  if( ele.isNode() ){
    r.drawNode( context, ele, shiftToOriginWithBb, showLabel, showOverlay, showOpacity );
  } else {
    r.drawEdge( context, ele, shiftToOriginWithBb, showLabel, showOverlay, showOpacity );
  }
};

CRp.drawElementOverlay = function( this: Renderer, context: CanvasRenderingContext2D, ele: Element ){
  let r = this; // eslint-disable-line @typescript-eslint/no-this-alias

  if( ele.isNode() ){
    r.drawNodeOverlay( context, ele );
  } else {
    r.drawEdgeOverlay( context, ele );
  }
};

CRp.drawElementUnderlay = function( this: Renderer, context: CanvasRenderingContext2D, ele: Element ){
  let r = this; // eslint-disable-line @typescript-eslint/no-this-alias

  if( ele.isNode() ){
    r.drawNodeUnderlay( context, ele );
  } else {
    r.drawEdgeUnderlay( context, ele );
  }
};

CRp.drawCachedElementPortion = function(
  this: Renderer,
  context: CanvasRenderingContext2D,
  ele: Element,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- texture cache instance owned by ele-texture-cache mixin
  eleTxrCache: any,
  pxRatio: number,
  lvl: number,
  reason: unknown,
  getRotation: ( r: Renderer, ele: Element ) => number,
  getOpacity: ( r: Renderer, ele: Element ) => number
){
  let r = this; // eslint-disable-line @typescript-eslint/no-this-alias
  let bb = eleTxrCache.getBoundingBox(ele);

  if( bb.w === 0 || bb.h === 0 ){ return; } // ignore zero size case

  let eleCache = eleTxrCache.getElement( ele, bb, pxRatio, lvl, reason );

  if( eleCache != null ){
    let opacity = getOpacity(r, ele);

    if( opacity === 0 ){ return; }

    let theta = getRotation(r, ele);
    let { x1, y1, w, h } = bb;
    let x, y, sx, sy, smooth;

    if( theta !== 0 ){
      let rotPt = eleTxrCache.getRotationPoint(ele);

      sx = rotPt.x;
      sy = rotPt.y;

      context.translate(sx, sy);
      context.rotate(theta);

      smooth = r.getImgSmoothing(context);

      if( !smooth ){ r.setImgSmoothing(context, true); }

      let off = eleTxrCache.getRotationOffset(ele);

      x = off.x;
      y = off.y;
    } else {
      x = x1;
      y = y1;
    }

    let oldGlobalAlpha;

    if( opacity !== 1 ){
      oldGlobalAlpha = context.globalAlpha;
      context.globalAlpha = oldGlobalAlpha * opacity;
    }

    context.drawImage( eleCache.texture.canvas, eleCache.x, 0, eleCache.width, eleCache.height, x, y, w, h );

    if( opacity !== 1 ){
      context.globalAlpha = oldGlobalAlpha!; // set above under the same opacity !== 1 guard
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
const getLabelRotation = (r: Renderer, ele: Element): number => r.getTextAngle(ele, null);
const getSourceLabelRotation = (r: Renderer, ele: Element): number => r.getTextAngle(ele, 'source');
const getTargetLabelRotation = (r: Renderer, ele: Element): number => r.getTextAngle(ele, 'target');
const getOpacity = (r: Renderer, ele: Element): number => ele.effectiveOpacity() as number;
// pstyle result is non-null for built-in props here; cast pfValue to number (text-opacity is single-valued)
const getTextOpacity = (e: Renderer, ele: Element): number => ( ele.pstyle('text-opacity')!.pfValue as number ) * ( ele.effectiveOpacity() as number );

CRp.drawCachedElement = function( this: Renderer, context: CanvasRenderingContext2D, ele: Element, pxRatio?: number, extent?: BoundingBox, lvl?: number, requestHighQuality?: boolean ){
  let r = this; // eslint-disable-line @typescript-eslint/no-this-alias
  let { eleTxrCache, lblTxrCache, slbTxrCache, tlbTxrCache } = r.data;

  let bb = ele.boundingBox();
  let reason = requestHighQuality === true ? eleTxrCache.reasons.highQuality : null;

  if( bb.w === 0 || bb.h === 0 || !ele.visible() ){ return; }

  if( !extent || math.boundingBoxesIntersect( bb, extent ) ){
    let isEdge = ele.isEdge();
    let badLine = ele.element()!._private.rscratch.badLine;

    r.drawElementUnderlay( context, ele );

    r.drawCachedElementPortion( context, ele, eleTxrCache, pxRatio, lvl, reason, getZeroRotation, getOpacity );
    
    if( !isEdge || !badLine ){
      r.drawCachedElementPortion( context, ele, lblTxrCache, pxRatio, lvl, reason, getLabelRotation, getTextOpacity );
    }

    if( isEdge && !badLine ){
      r.drawCachedElementPortion( context, ele, slbTxrCache, pxRatio, lvl, reason, getSourceLabelRotation, getTextOpacity );
      r.drawCachedElementPortion( context, ele, tlbTxrCache, pxRatio, lvl, reason, getTargetLabelRotation, getTextOpacity );
    }

    r.drawElementOverlay( context, ele );
  }
};

CRp.drawElements = function( this: Renderer, context: CanvasRenderingContext2D, eles: Element[] ){
  let r = this; // eslint-disable-line @typescript-eslint/no-this-alias

  for( let i = 0; i < eles.length; i++ ){
    let ele = eles[ i ];

    r.drawElement( context, ele );
  }
};

CRp.drawCachedElements = function( this: Renderer, context: CanvasRenderingContext2D, eles: Element[], pxRatio: number, extent?: BoundingBox ){
  let r = this; // eslint-disable-line @typescript-eslint/no-this-alias

  for( let i = 0; i < eles.length; i++ ){
    let ele = eles[ i ];

    r.drawCachedElement( context, ele, pxRatio, extent );
  }
};

CRp.drawCachedNodes = function( this: Renderer, context: CanvasRenderingContext2D, eles: Element[], pxRatio: number, extent?: BoundingBox ){
  let r = this; // eslint-disable-line @typescript-eslint/no-this-alias

  for( let i = 0; i < eles.length; i++ ){
    let ele = eles[ i ];

    if( !ele.isNode() ){ continue; }

    r.drawCachedElement( context, ele, pxRatio, extent );
  }
};

CRp.drawLayeredElements = function( this: Renderer, context: CanvasRenderingContext2D, eles: Element[], pxRatio: number, extent?: BoundingBox ){
  let r = this; // eslint-disable-line @typescript-eslint/no-this-alias

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
  CRp.drawDebugPoints = function( context: CanvasRenderingContext2D, eles: Element[] ){
    let draw = function( x: number, y: number, color: string ){
      context.fillStyle = color;
      context.fillRect( x - 1, y - 1, 3, 3 );
    };

    for( let i = 0; i < eles.length; i++ ){
      let ele = eles[i];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- rscratch is an open render-scratch bag of numbers/arrays
      let rs = ele._private.rscratch as any;

      if( ele.isNode() ){
        let p = ele.position();

        draw( rs.labelX, rs.labelY, 'red' );
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
