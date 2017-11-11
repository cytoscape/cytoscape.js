/*
The canvas renderer was written by Yue Dong.

Modifications tracked on Github.
*/

import * as util from '../../../util';
import * as is from '../../../is';
import ElementTextureCache from './ele-texture-cache';
import LayeredTextureCache from './layered-texture-cache';
import arrowShapes from './arrow-shapes';
import drawingElements from './drawing-elements';
import drawingEdges from './drawing-edges';
import drawingImages from './drawing-images';
import drawingLabelText from './drawing-label-text';
import drawingNodes from './drawing-nodes';
import drawingRedraw from './drawing-redraw';
import drawingShapes from './drawing-shapes';
import exportImage from './export-image';
import nodeShapes from './node-shapes';

var CR = CanvasRenderer;
var CRp = CanvasRenderer.prototype;

CRp.CANVAS_LAYERS = 3;
//
CRp.SELECT_BOX = 0;
CRp.DRAG = 1;
CRp.NODE = 2;

CRp.BUFFER_COUNT = 3;
//
CRp.TEXTURE_BUFFER = 0;
CRp.MOTIONBLUR_BUFFER_NODE = 1;
CRp.MOTIONBLUR_BUFFER_DRAG = 2;

function CanvasRenderer( options ){
  var r = this;

  r.data = {
    canvases: new Array( CRp.CANVAS_LAYERS ),
    contexts: new Array( CRp.CANVAS_LAYERS ),
    canvasNeedsRedraw: new Array( CRp.CANVAS_LAYERS ),

    bufferCanvases: new Array( CRp.BUFFER_COUNT ),
    bufferContexts: new Array( CRp.CANVAS_LAYERS ),
  };

  var tapHlOff = '-webkit-tap-highlight-color: rgba(0,0,0,0);';

  r.data.canvasContainer = document.createElement( 'div' ); // eslint-disable-line no-undef
  var containerStyle = r.data.canvasContainer.style;
  r.data.canvasContainer.setAttribute( 'style', tapHlOff );
  containerStyle.position = 'relative';
  containerStyle.zIndex = '0';
  containerStyle.overflow = 'hidden';

  var container = options.cy.container();
  container.appendChild( r.data.canvasContainer );

  if( (container.getAttribute('style') || '').indexOf(tapHlOff) < 0 ){
    container.setAttribute( 'style', ( container.getAttribute( 'style' ) || '' ) + tapHlOff );
  }

  for( var i = 0; i < CRp.CANVAS_LAYERS; i++ ){
    var canvas = r.data.canvases[ i ] = document.createElement( 'canvas' );  // eslint-disable-line no-undef
    r.data.contexts[ i ] = canvas.getContext( '2d' );
    canvas.setAttribute( 'style', '-webkit-user-select: none; -moz-user-select: -moz-none; user-select: none; -webkit-tap-highlight-color: rgba(0,0,0,0); outline-style: none;' + ( is.ms() ? ' -ms-touch-action: none; touch-action: none; ' : '' ) );
    canvas.style.position = 'absolute';
    canvas.setAttribute( 'data-id', 'layer' + i );
    canvas.style.zIndex = String( CRp.CANVAS_LAYERS - i );
    r.data.canvasContainer.appendChild( canvas );

    r.data.canvasNeedsRedraw[ i ] = false;
  }
  r.data.topCanvas = r.data.canvases[0];

  r.data.canvases[ CRp.NODE ].setAttribute( 'data-id', 'layer' + CRp.NODE + '-node' );
  r.data.canvases[ CRp.SELECT_BOX ].setAttribute( 'data-id', 'layer' + CRp.SELECT_BOX + '-selectbox' );
  r.data.canvases[ CRp.DRAG ].setAttribute( 'data-id', 'layer' + CRp.DRAG + '-drag' );

  for( var i = 0; i < CRp.BUFFER_COUNT; i++ ){
    r.data.bufferCanvases[ i ] = document.createElement( 'canvas' );  // eslint-disable-line no-undef
    r.data.bufferContexts[ i ] = r.data.bufferCanvases[ i ].getContext( '2d' );
    r.data.bufferCanvases[ i ].style.position = 'absolute';
    r.data.bufferCanvases[ i ].setAttribute( 'data-id', 'buffer' + i );
    r.data.bufferCanvases[ i ].style.zIndex = String( -i - 1 );
    r.data.bufferCanvases[ i ].style.visibility = 'hidden';
    //r.data.canvasContainer.appendChild(r.data.bufferCanvases[i]);
  }

  r.pathsEnabled = true;

  r.data.eleTxrCache = new ElementTextureCache( r );
  r.data.lyrTxrCache = new LayeredTextureCache( r, r.data.eleTxrCache );

  r.onUpdateEleCalcs(function invalidateTextureCaches( willDraw, eles ){
    for( var i = 0; i < eles.length; i++ ){
      var ele = eles[i];
      var rs = ele._private.rstyle;
      var de = rs.dirtyEvents;

      if( ele.isNode() && de && de.length === 1 && de['position'] ){
        // then keep cached ele texture
      } else {
        r.data.eleTxrCache.invalidateElement( ele );
      }
    }

    if( eles.length > 0 ){
      r.data.lyrTxrCache.invalidateElements( eles );
    }
  });
}

CRp.redrawHint = function( group, bool ){
  var r = this;

  switch( group ){
    case 'eles':
      r.data.canvasNeedsRedraw[ CRp.NODE ] = bool;
      break;
    case 'drag':
      r.data.canvasNeedsRedraw[ CRp.DRAG ] = bool;
      break;
    case 'select':
      r.data.canvasNeedsRedraw[ CRp.SELECT_BOX ] = bool;
      break;
  }
};

// whether to use Path2D caching for drawing
var pathsImpld = typeof Path2D !== 'undefined';

CRp.path2dEnabled = function( on ){
  if( on === undefined ){
    return this.pathsEnabled;
  }

  this.pathsEnabled = on ? true : false;
};

CRp.usePaths = function(){
  return pathsImpld && this.pathsEnabled;
};

[
  arrowShapes,
  drawingElements,
  drawingEdges,
  drawingImages,
  drawingLabelText,
  drawingNodes,
  drawingRedraw,
  drawingShapes,
  exportImage,
  nodeShapes
].forEach( function( props ){
  util.extend( CRp, props );
} );

export default CR;
