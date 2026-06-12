/*
The canvas renderer was written by Yue Dong.

Modifications tracked on Github.
*/

/* global OffscreenCanvas */

import * as util from '../../../util/index.mjs';
import * as is from '../../../is.mjs';
import { makeBoundingBox } from '../../../math.mjs';
import { labelHalign, labelValign } from '../../../style/align.mjs';
import ElementTextureCache from './ele-texture-cache.mjs';
import LayeredTextureCache from './layered-texture-cache.mjs';
import type { Renderer, RendererOptions, Element, Position } from '../renderer-types.mjs';

import arrowShapes from './arrow-shapes.mjs';
import drawingElements from './drawing-elements.mjs';
import drawingEdges from './drawing-edges.mjs';
import drawingImages from './drawing-images.mjs';
import drawingLabelText from './drawing-label-text.mjs';
import drawingNodes from './drawing-nodes.mjs';
import drawingRedraw from './drawing-redraw.mjs';
import drawingRedrawWebGL from './webgl/drawing-redraw-webgl.mjs';
import drawingShapes from './drawing-shapes.mjs';
import exportImage from './export-image.mjs';
import nodeShapes from './node-shapes.mjs';

let CR = CanvasRenderer;
let CRp = CanvasRenderer.prototype as unknown as Renderer;

CRp.CANVAS_LAYERS = 3;
//
CRp.SELECT_BOX = 0;
CRp.DRAG = 1;
CRp.NODE = 2;
CRp.WEBGL = 3;

CRp.CANVAS_TYPES = [ '2d', '2d', '2d', 'webgl2' ];

CRp.BUFFER_COUNT = 3;
//
CRp.TEXTURE_BUFFER = 0;
CRp.MOTIONBLUR_BUFFER_NODE = 1;
CRp.MOTIONBLUR_BUFFER_DRAG = 2;

function CanvasRenderer( this: Renderer, options: RendererOptions ){
  let r = this; // eslint-disable-line @typescript-eslint/no-this-alias

  let containerWindow = r.cy.window()!;
  let document = containerWindow.document;

  if( options.webgl ){
    CRp.CANVAS_LAYERS = r.CANVAS_LAYERS = 4;
    console.log('webgl rendering enabled');
  }

  r.data = {
    canvases: new Array( CRp.CANVAS_LAYERS ),
    contexts: new Array( CRp.CANVAS_LAYERS ),
    canvasNeedsRedraw: new Array( CRp.CANVAS_LAYERS ),

    bufferCanvases: new Array( CRp.BUFFER_COUNT ),
    bufferContexts: new Array( CRp.CANVAS_LAYERS ),
  };

  let tapHlOffAttr = '-webkit-tap-highlight-color';
  let tapHlOffStyle = 'rgba(0,0,0,0)';
  r.data.canvasContainer = document.createElement( 'div' );  
  let containerStyle = r.data.canvasContainer.style;
  // CSSStyleDeclaration has no string index signature for vendor-prefixed props
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- string-indexed CSS prop assignment
  ( r.data.canvasContainer.style as any )[tapHlOffAttr] = tapHlOffStyle;
  containerStyle.position = 'relative';
  containerStyle.zIndex = '0';
  containerStyle.overflow = 'hidden';

  let container = options.cy.container()!;
  container.appendChild( r.data.canvasContainer );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- string-indexed CSS prop assignment
  ( container.style as any )[tapHlOffAttr] = tapHlOffStyle;

  let styleMap: Record<string, string> = {
    '-webkit-user-select': 'none',
    '-moz-user-select': '-moz-none',
    'user-select': 'none',
    '-webkit-tap-highlight-color': 'rgba(0,0,0,0)',
    'outline-style': 'none',
  };

  if(is.ms()) {
    styleMap['-ms-touch-action'] = 'none';
    styleMap['touch-action'] = 'none';
  }

  // local handles to the just-initialised, definitely-present bookkeeping arrays
  let canvases = r.data.canvases!;
  let contexts = r.data.contexts!;
  let canvasNeedsRedraw = r.data.canvasNeedsRedraw!;
  let bufferCanvases = r.data.bufferCanvases!;
  let bufferContexts = r.data.bufferContexts!;

  for( let i = 0; i < CRp.CANVAS_LAYERS; i++ ){
    let canvas = canvases[ i ] = document.createElement( 'canvas' );
    let type = CRp.CANVAS_TYPES[ i ];
    contexts[ i ] = canvas.getContext( type );
    if( !contexts[ i ] ) {
      util.error( 'Could not create canvas of type ' + type );
    }
    Object.keys(styleMap).forEach((k) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- string-indexed CSS prop assignment
      ( canvas.style as any )[k] = styleMap[k];
    });
    canvas.style.position = 'absolute';
    canvas.setAttribute( 'data-id', 'layer' + i );
    canvas.style.zIndex = String( CRp.CANVAS_LAYERS - i );
    r.data.canvasContainer.appendChild( canvas );

    canvasNeedsRedraw[ i ] = false;
  }
  r.data.topCanvas = canvases[0];

  canvases[ CRp.NODE ].setAttribute( 'data-id', 'layer' + CRp.NODE + '-node' );
  canvases[ CRp.SELECT_BOX ].setAttribute( 'data-id', 'layer' + CRp.SELECT_BOX + '-selectbox' );
  canvases[ CRp.DRAG ].setAttribute( 'data-id', 'layer' + CRp.DRAG + '-drag' );
  if( canvases[ CRp.WEBGL ] ) {
    canvases[ CRp.WEBGL ].setAttribute( 'data-id', 'layer' + CRp.WEBGL + '-webgl' );
  }

  for( let i = 0; i < CRp.BUFFER_COUNT; i++ ){
    bufferCanvases[ i ] = document.createElement( 'canvas' );
    bufferContexts[ i ] = bufferCanvases[ i ].getContext( '2d' );
    bufferCanvases[ i ].style.position = 'absolute';
    bufferCanvases[ i ].setAttribute( 'data-id', 'buffer' + i );
    bufferCanvases[ i ].style.zIndex = String( -i - 1 );
    bufferCanvases[ i ].style.visibility = 'hidden';
    //r.data.canvasContainer.appendChild(r.data.bufferCanvases[i]);
  }

  r.pathsEnabled = true;

  let emptyBb = makeBoundingBox();

  // bb here is any of the renderer's bounding-box shapes (bodyBounds/labelBounds/...),
  // which carry the standard x1/x2/y1/y2/w/h plus optional pad fields
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- renderer bounding-box shape with optional pad fields
  type Bb = any;

  let getBoxCenter = ( bb: Bb ) => ({ x: (bb.x1 + bb.x2)/2, y: (bb.y1 + bb.y2)/2 });

  let getCenterOffset = ( bb: Bb ) => ({ x: -bb.w/2, y: -bb.h/2 });

  let backgroundTimestampHasChanged = ( ele: Element ) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- _private holds open render bookkeeping fields
    let _p = ele[0]._private as any;
    let same = _p.oldBackgroundTimestamp === _p.backgroundTimestamp;

    return !same;
  };

  let getStyleKey = ( ele: Element ) => ele[0]._private.nodeKey;
  let getLabelKey = ( ele: Element ) => ele[0]._private.labelStyleKey;
  let getSourceLabelKey = ( ele: Element ) => ele[0]._private.sourceLabelStyleKey;
  let getTargetLabelKey = ( ele: Element ) => ele[0]._private.targetLabelStyleKey;

  let drawElement = (context: CanvasRenderingContext2D, ele: Element, bb: Bb, scaledLabelShown: boolean, useEleOpacity: boolean) => r.drawElement( context, ele, bb, false, false, useEleOpacity );
  let drawLabel = (context: CanvasRenderingContext2D, ele: Element, bb: Bb, scaledLabelShown: boolean, useEleOpacity: boolean) => r.drawElementText( context, ele, bb, scaledLabelShown, 'main', useEleOpacity );
  let drawSourceLabel = (context: CanvasRenderingContext2D, ele: Element, bb: Bb, scaledLabelShown: boolean, useEleOpacity: boolean) => r.drawElementText( context, ele, bb, scaledLabelShown, 'source', useEleOpacity );
  let drawTargetLabel = (context: CanvasRenderingContext2D, ele: Element, bb: Bb, scaledLabelShown: boolean, useEleOpacity: boolean) => r.drawElementText( context, ele, bb, scaledLabelShown, 'target', useEleOpacity );

  let getElementBox = ( ele: Element ): Bb => { ele.boundingBox(); return ele[0]._private.bodyBounds; };
  let getLabelBox   = ( ele: Element ): Bb => { ele.boundingBox(); return ele[0]._private.labelBounds.main || emptyBb; };
  let getSourceLabelBox = ( ele: Element ): Bb => { ele.boundingBox(); return ele[0]._private.labelBounds.source || emptyBb; };
  let getTargetLabelBox = ( ele: Element ): Bb => { ele.boundingBox(); return ele[0]._private.labelBounds.target || emptyBb; };

  let isLabelVisibleAtScale = ( ele: Element, scaledLabelShown: boolean ) => scaledLabelShown;

  let getElementRotationPoint = ( ele: Element ) => getBoxCenter( getElementBox(ele) );

  let addTextMargin = ( prefix: string, pt: Position, ele: Element ) => {
    let pre = prefix ? prefix + '-' : '';

    return {
      x: pt.x + ( ele.pstyle(pre + 'text-margin-x')!.pfValue as number ),
      y: pt.y + ( ele.pstyle(pre + 'text-margin-y')!.pfValue as number )
    };
  };

  let getRsPt = ( ele: Element, x: string, y: string ): Position => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- rscratch is an open render-scratch bag
    let rs = ele[0]._private.rscratch as any;

    return { x: rs[x], y: rs[y] };
  };

  let getLabelRotationPoint = ( ele: Element ) => addTextMargin('', getRsPt(ele, 'labelX', 'labelY'), ele);
  let getSourceLabelRotationPoint = ( ele: Element ) => addTextMargin('source', getRsPt(ele, 'sourceLabelX', 'sourceLabelY'), ele);
  let getTargetLabelRotationPoint = ( ele: Element ) => addTextMargin('target', getRsPt(ele, 'targetLabelX', 'targetLabelY'), ele);

  let getElementRotationOffset = ( ele: Element ) => getCenterOffset( getElementBox(ele) );
  let getSourceLabelRotationOffset = ( ele: Element ) => getCenterOffset( getSourceLabelBox(ele) );
  let getTargetLabelRotationOffset = ( ele: Element ) => getCenterOffset( getTargetLabelBox(ele) );

  let getLabelRotationOffset = ( ele: Element ) => {
    let bb = getLabelBox(ele);
    let p = getCenterOffset( getLabelBox(ele) );

    if( ele.isNode() ){
      switch( labelHalign( ele.pstyle('text-halign')!.value as string ) ){
        case 'left':
          p.x = -bb.w - (bb.leftPad || 0);
          break;
        case 'right':
          p.x = -(bb.rightPad || 0);
          break;
      }

      switch( labelValign( ele.pstyle('text-valign')!.value as string ) ){
        case 'top':
          p.y = -bb.h - (bb.topPad || 0);
          break;
        case 'bottom':
          p.y = -(bb.botPad || 0);
          break;
      }
    }

    return p;
  };

  let eleTxrCache = r.data.eleTxrCache = new ElementTextureCache( r, {
    getKey: getStyleKey,
    doesEleInvalidateKey: backgroundTimestampHasChanged,
    drawElement: drawElement,
    getBoundingBox: getElementBox,
    getRotationPoint: getElementRotationPoint,
    getRotationOffset: getElementRotationOffset,
    allowEdgeTxrCaching: false,
    allowParentTxrCaching: false
  } );

  let lblTxrCache = r.data.lblTxrCache = new ElementTextureCache( r, {
    getKey: getLabelKey,
    drawElement: drawLabel,
    getBoundingBox: getLabelBox,
    getRotationPoint: getLabelRotationPoint,
    getRotationOffset: getLabelRotationOffset,
    isVisible: isLabelVisibleAtScale
  } );

  let slbTxrCache = r.data.slbTxrCache = new ElementTextureCache( r, {
    getKey: getSourceLabelKey,
    drawElement: drawSourceLabel,
    getBoundingBox: getSourceLabelBox,
    getRotationPoint: getSourceLabelRotationPoint,
    getRotationOffset: getSourceLabelRotationOffset,
    isVisible: isLabelVisibleAtScale
  } );

  let tlbTxrCache = r.data.tlbTxrCache = new ElementTextureCache( r, {
    getKey: getTargetLabelKey,
    drawElement: drawTargetLabel,
    getBoundingBox: getTargetLabelBox,
    getRotationPoint: getTargetLabelRotationPoint,
    getRotationOffset: getTargetLabelRotationOffset,
    isVisible: isLabelVisibleAtScale
  } );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- LayeredTextureCache is an untyped constructor function owned by another module
  let lyrTxrCache = r.data.lyrTxrCache = new ( LayeredTextureCache as any )( r );

  r.onUpdateEleCalcs(function invalidateTextureCaches( willDraw: boolean, eles: Element[] ){
    // each cache should check for sub-key diff to see that the update affects that cache particularly
    eleTxrCache.invalidateElements( eles );
    lblTxrCache.invalidateElements( eles );
    slbTxrCache.invalidateElements( eles );
    tlbTxrCache.invalidateElements( eles );

    // any change invalidates the layers
    lyrTxrCache.invalidateElements( eles );

    // update the old bg timestamp so diffs can be done in the ele txr caches
    for( let i = 0; i < eles.length; i++ ){
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- _private holds open render bookkeeping fields
      let _p = eles[i]._private as any;

      _p.oldBackgroundTimestamp = _p.backgroundTimestamp;
    }
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- refinement requests are opaque { ele, ... } records from the texture caches
  let refineInLayers = ( reqs: any[] ) => {
    for( let i = 0; i < reqs.length; i++ ){
      lyrTxrCache.enqueueElementRefinement( reqs[i].ele );
    }
  };

  eleTxrCache.onDequeue(refineInLayers);
  lblTxrCache.onDequeue(refineInLayers);
  slbTxrCache.onDequeue(refineInLayers);
  tlbTxrCache.onDequeue(refineInLayers);

  if( options.webgl ) {
    r.initWebgl( options, {
      getStyleKey,
      getLabelKey,
      getSourceLabelKey,
      getTargetLabelKey,
      drawElement,
      drawLabel,
      drawSourceLabel,
      drawTargetLabel,
      getElementBox,
      getLabelBox,
      getSourceLabelBox,
      getTargetLabelBox,
      getElementRotationPoint,
      getElementRotationOffset,
      getLabelRotationPoint,
      getSourceLabelRotationPoint,
      getTargetLabelRotationPoint,
      getLabelRotationOffset,
      getSourceLabelRotationOffset,
      getTargetLabelRotationOffset
    } );
  }
}

CRp.redrawHint = function( this: Renderer, group: string, bool: boolean ){
  let r = this; // eslint-disable-line @typescript-eslint/no-this-alias

  switch( group ){
    case 'eles':
      r.data.canvasNeedsRedraw![ CRp.NODE ] = bool;
      break;
    case 'drag':
      r.data.canvasNeedsRedraw![ CRp.DRAG ] = bool;
      break;
    case 'select':
      r.data.canvasNeedsRedraw![ CRp.SELECT_BOX ] = bool;
      break;
    case 'gc':
      r.data.gc = true;
      break;
  }
};

// whether to use Path2D caching for drawing
let pathsImpld = typeof Path2D !== 'undefined';

CRp.path2dEnabled = function( this: Renderer, on?: boolean ){
  if( on === undefined ){
    return this.pathsEnabled;
  }

  this.pathsEnabled = on ? true : false;
};

CRp.usePaths = function( this: Renderer ){
  return pathsImpld && this.pathsEnabled;
};

CRp.setImgSmoothing = function( this: Renderer, context: CanvasRenderingContext2D, bool: boolean ){
  // vendor-prefixed smoothing flags aren't in lib.dom; treat the context loosely
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- legacy vendor smoothing flags
  let ctx = context as any;
  if( ctx.imageSmoothingEnabled != null ){
    ctx.imageSmoothingEnabled = bool;
  } else {
    ctx.webkitImageSmoothingEnabled = bool;
    ctx.mozImageSmoothingEnabled = bool;
    ctx.msImageSmoothingEnabled = bool;
  }
};

CRp.getImgSmoothing = function( this: Renderer, context: CanvasRenderingContext2D ){
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- legacy vendor smoothing flags
  let ctx = context as any;
  if( ctx.imageSmoothingEnabled != null ){
    return ctx.imageSmoothingEnabled;
  } else {
    return ctx.webkitImageSmoothingEnabled || ctx.mozImageSmoothingEnabled || ctx.msImageSmoothingEnabled;
  }
};

CRp.makeOffscreenCanvas = function( this: Renderer, width: number, height: number ){
  let canvas: OffscreenCanvas | HTMLCanvasElement;

  if( typeof OffscreenCanvas !== typeof undefined ){
    canvas = new OffscreenCanvas(width, height);
  } else {
    let containerWindow = this.cy.window()!;
    let document = containerWindow.document;
    canvas = document.createElement('canvas');  
    canvas.width = width;
    canvas.height = height;
  }

  return canvas;
};

[
  arrowShapes,
  drawingElements,
  drawingEdges,
  drawingImages,
  drawingLabelText,
  drawingNodes,
  drawingRedraw,
  drawingRedrawWebGL,
  drawingShapes,
  exportImage,
  nodeShapes
].forEach( function( props ){
  util.extend( CRp, props );
} );

export default CR;
