/*
  The canvas renderer was written by Yue Dong.

  Modifications tracked on Github.
*/

(function($$) { 'use strict';

  function CanvasRenderer(options) {
    
    CanvasRenderer.CANVAS_LAYERS = 5;
    CanvasRenderer.SELECT_BOX = 0;
    CanvasRenderer.DRAG = 2;
    CanvasRenderer.NODE = 4;
    CanvasRenderer.BUFFER_COUNT = 2;

    this.options = options;

    this.data = {
        
      select: [undefined, undefined, undefined, undefined, 0], // Coordinates for selection box, plus enabled flag 
      renderer: this, cy: options.cy, container: options.cy.container(),
      
      canvases: new Array(CanvasRenderer.CANVAS_LAYERS),
      canvasNeedsRedraw: new Array(CanvasRenderer.CANVAS_LAYERS),
      
      bufferCanvases: new Array(CanvasRenderer.BUFFER_COUNT)

    };
    
    //--Pointer-related data
    this.hoverData = {down: null, last: null, 
        downTime: null, triggerMode: null, 
        dragging: false, 
        initialPan: [null, null], capture: false};
    
    this.timeoutData = {panTimeout: null};
    
    this.dragData = {possibleDragElements: []};
    
    this.touchData = {start: null, capture: false,
        // These 3 fields related to tap, taphold events
        startPosition: [null, null, null, null, null, null],
        singleTouchStartTime: null,
        singleTouchMoved: true,
        
        
        now: [null, null, null, null, null, null], 
        earlier: [null, null, null, null, null, null] };
    //--
    
    //--Wheel-related data 
    this.zoomData = {freeToZoom: false, lastPointerX: null};
    //--
    
    this.redraws = 0;

    this.bindings = [];
    
    this.data.canvasContainer = document.createElement('div');
    var containerStyle = this.data.canvasContainer.style;
    containerStyle.position = 'absolute';
    containerStyle.zIndex = '0';

    this.data.container.appendChild( this.data.canvasContainer );

    for (var i = 0; i < CanvasRenderer.CANVAS_LAYERS; i++) {
      this.data.canvases[i] = document.createElement('canvas');
      this.data.canvases[i].style.position = 'absolute';
      this.data.canvases[i].setAttribute('data-id', 'layer' + i);
      this.data.canvases[i].style.zIndex = String(CanvasRenderer.CANVAS_LAYERS - i);
      this.data.canvasContainer.appendChild(this.data.canvases[i]);
      
      this.data.canvasNeedsRedraw[i] = false;
    }

    this.data.canvases[CanvasRenderer.NODE].setAttribute('data-id', 'layer' + CanvasRenderer.NODE + '-node');
    this.data.canvases[CanvasRenderer.SELECT_BOX].setAttribute('data-id', 'layer' + CanvasRenderer.SELECT_BOX + '-selectbox');
    this.data.canvases[CanvasRenderer.DRAG].setAttribute('data-id', 'layer' + CanvasRenderer.DRAG + '-drag');
    
    for (var i = 0; i < CanvasRenderer.BUFFER_COUNT; i++) {
      this.data.bufferCanvases[i] = document.createElement('canvas');
      this.data.bufferCanvases[i].style.position = 'absolute';
      this.data.bufferCanvases[i].setAttribute('data-id', 'buffer' + i);
      this.data.bufferCanvases[i].style.zIndex = String(-i - 1);
      this.data.bufferCanvases[i].style.visibility = 'hidden';
      this.data.canvasContainer.appendChild(this.data.bufferCanvases[i]);
    }

    this.hideEdgesOnViewport = options.hideEdgesOnViewport;
    this.hideLabelsOnViewport = options.hideLabelsOnViewport;
    this.textureOnViewport = options.textureOnViewport;

    this.load();
  }

  CanvasRenderer.panOrBoxSelectDelay = 400;
  CanvasRenderer.isTouch = $$.is.touch();

  // whether to use Path2D caching for drawing
  var pathsImpld = typeof Path2D !== 'undefined';
  CanvasRenderer.usePaths = function(){
    return pathsImpld;
  };

  CanvasRenderer.prototype.notify = function(params) {
    switch( params.type ){

    case 'destroy':
      this.destroy();
      return;

    case 'add':
    case 'remove':
    case 'load':
      this.updateNodesCache();
      this.updateEdgesCache();
      break;

    case 'viewport':
      this.data.canvasNeedsRedraw[CanvasRenderer.SELECT_BOX] = true;
      break;

    case 'style':
      this.updateCachedZSortedEles();
      break;
    }

    if( params.type === 'load' || params.type === 'resize' ){
      this.matchCanvasSize(this.data.container);
    }
    
    this.data.canvasNeedsRedraw[CanvasRenderer.NODE] = true;

    this.redraw();
  };

  CanvasRenderer.prototype.destroy = function(){
    this.destroyed = true;

    for( var i = 0; i < this.bindings.length; i++ ){
      var binding = this.bindings[i];
      var b = binding;

      b.target.removeEventListener(b.event, b.handler, b.useCapture);
    }
  };

  

  // copy the math functions into the renderer prototype
  // unfortunately these functions are used interspersed t/o the code
  // and this makes sure things work just in case a ref was missed in refactoring
  // TODO remove this eventually
  for( var fnName in $$.math ){
    CanvasRenderer.prototype[ fnName ] = $$.math[ fnName ];
  }
  
  
  var debug = function(){};
  $$('renderer', 'canvas', CanvasRenderer);
  
})( cytoscape );
