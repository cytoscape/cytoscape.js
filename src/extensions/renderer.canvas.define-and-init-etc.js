/*
  The canvas renderer was written by Yue Dong.

  Modifications tracked on Github.
*/

(function($$) { 'use strict';

  var CR = CanvasRenderer;
  var CRp = CanvasRenderer.prototype;

  CR.CANVAS_LAYERS = 3;
  //
  CR.SELECT_BOX = 0;
  CR.DRAG = 1;
  CR.NODE = 2;

  CR.BUFFER_COUNT = 3;
  //
  CR.TEXTURE_BUFFER = 0;
  CR.MOTIONBLUR_BUFFER_NODE = 1;
  CR.MOTIONBLUR_BUFFER_DRAG = 2;

  function CanvasRenderer(options) {
    var r = this;

    r.data = {
      canvases: new Array(CR.CANVAS_LAYERS),
      contexts: new Array(CR.CANVAS_LAYERS),
      canvasNeedsRedraw: new Array(CR.CANVAS_LAYERS),

      bufferCanvases: new Array(CR.BUFFER_COUNT),
      bufferContexts: new Array(CR.CANVAS_LAYERS)
    };

    r.data.canvasContainer = document.createElement('div');
    var containerStyle = r.data.canvasContainer.style;
    containerStyle.position = 'absolute';
    containerStyle.zIndex = '0';
    containerStyle.overflow = 'hidden';

    options.cy.container().appendChild( r.data.canvasContainer );

    for (var i = 0; i < CR.CANVAS_LAYERS; i++) {
      r.data.canvases[i] = document.createElement('canvas');
      r.data.contexts[i] = r.data.canvases[i].getContext('2d');
      r.data.canvases[i].style.position = 'absolute';
      r.data.canvases[i].setAttribute('data-id', 'layer' + i);
      r.data.canvases[i].style.zIndex = String(CR.CANVAS_LAYERS - i);
      r.data.canvasContainer.appendChild(r.data.canvases[i]);

      r.data.canvasNeedsRedraw[i] = false;
    }
    r.data.topCanvas = r.data.canvases[0];

    r.data.canvases[CR.NODE].setAttribute('data-id', 'layer' + CR.NODE + '-node');
    r.data.canvases[CR.SELECT_BOX].setAttribute('data-id', 'layer' + CR.SELECT_BOX + '-selectbox');
    r.data.canvases[CR.DRAG].setAttribute('data-id', 'layer' + CR.DRAG + '-drag');

    for (var i = 0; i < CR.BUFFER_COUNT; i++) {
      r.data.bufferCanvases[i] = document.createElement('canvas');
      r.data.bufferContexts[i] = r.data.bufferCanvases[i].getContext('2d');
      r.data.bufferCanvases[i].style.position = 'absolute';
      r.data.bufferCanvases[i].setAttribute('data-id', 'buffer' + i);
      r.data.bufferCanvases[i].style.zIndex = String(-i - 1);
      r.data.bufferCanvases[i].style.visibility = 'hidden';
      //r.data.canvasContainer.appendChild(r.data.bufferCanvases[i]);
    }

    r.pathsEnabled = true;
  }

  CRp.redrawHint = function( group, bool ){
    var r = this;

    switch( group ){
      case 'eles':
        r.data.canvasNeedsRedraw[ CR.NODE ] = bool;
        break;
      case 'drag':
        r.data.canvasNeedsRedraw[ CR.DRAG ] = bool;
        break;
      case 'select':
        r.data.canvasNeedsRedraw[ CR.SELECT_BOX ] = bool;
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


  // copy the math functions into the renderer prototype
  // unfortunately these functions are used interspersed t/o the code
  // and this makes sure things work just in case a ref was missed in refactoring
  // TODO remove this eventually
  // for( var fnName in $$.math ){
  //   CRp[ fnName ] = $$.math[ fnName ];
  // }


  $$('renderer', 'canvas', CanvasRenderer);

})( cytoscape );
