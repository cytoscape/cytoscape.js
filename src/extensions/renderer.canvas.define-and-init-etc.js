/*
  The canvas renderer was written by Yue Dong.

  Modifications tracked on Github.
*/

(function($$) { 'use strict';

  CanvasRenderer.CANVAS_LAYERS = 3;
  //
  CanvasRenderer.SELECT_BOX = 0;
  CanvasRenderer.DRAG = 1;
  CanvasRenderer.NODE = 2;

  CanvasRenderer.BUFFER_COUNT = 3;
  //
  CanvasRenderer.TEXTURE_BUFFER = 0;
  CanvasRenderer.MOTIONBLUR_BUFFER_NODE = 1;
  CanvasRenderer.MOTIONBLUR_BUFFER_DRAG = 2;

  function CanvasRenderer(options) {

    this.options = options;

    this.data = {

      select: [undefined, undefined, undefined, undefined, 0], // Coordinates for selection box, plus enabled flag
      renderer: this, cy: options.cy, container: options.cy.container(),

      canvases: new Array(CanvasRenderer.CANVAS_LAYERS),
      contexts: new Array(CanvasRenderer.CANVAS_LAYERS),
      canvasNeedsRedraw: new Array(CanvasRenderer.CANVAS_LAYERS),

      bufferCanvases: new Array(CanvasRenderer.BUFFER_COUNT),
      bufferContexts: new Array(CanvasRenderer.CANVAS_LAYERS)

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
    this.showFps = options.showFps;

    this.bindings = [];

    this.data.canvasContainer = document.createElement('div');
    var containerStyle = this.data.canvasContainer.style;
    containerStyle.position = 'absolute';
    containerStyle.zIndex = '0';
    containerStyle.overflow = 'hidden';

    this.data.container.appendChild( this.data.canvasContainer );

    for (var i = 0; i < CanvasRenderer.CANVAS_LAYERS; i++) {
      this.data.canvases[i] = document.createElement('canvas');
      this.data.contexts[i] = this.data.canvases[i].getContext('2d');
      this.data.canvases[i].style.position = 'absolute';
      this.data.canvases[i].setAttribute('data-id', 'layer' + i);
      this.data.canvases[i].style.zIndex = String(CanvasRenderer.CANVAS_LAYERS - i);
      this.data.canvasContainer.appendChild(this.data.canvases[i]);

      this.data.canvasNeedsRedraw[i] = false;
    }
    this.data.topCanvas = this.data.canvases[0];

    this.data.canvases[CanvasRenderer.NODE].setAttribute('data-id', 'layer' + CanvasRenderer.NODE + '-node');
    this.data.canvases[CanvasRenderer.SELECT_BOX].setAttribute('data-id', 'layer' + CanvasRenderer.SELECT_BOX + '-selectbox');
    this.data.canvases[CanvasRenderer.DRAG].setAttribute('data-id', 'layer' + CanvasRenderer.DRAG + '-drag');

    for (var i = 0; i < CanvasRenderer.BUFFER_COUNT; i++) {
      this.data.bufferCanvases[i] = document.createElement('canvas');
      this.data.bufferContexts[i] = this.data.bufferCanvases[i].getContext('2d');
      this.data.bufferCanvases[i].style.position = 'absolute';
      this.data.bufferCanvases[i].setAttribute('data-id', 'buffer' + i);
      this.data.bufferCanvases[i].style.zIndex = String(-i - 1);
      this.data.bufferCanvases[i].style.visibility = 'hidden';
      //this.data.canvasContainer.appendChild(this.data.bufferCanvases[i]);
    }

    this.hideEdgesOnViewport = options.hideEdgesOnViewport;
    this.hideLabelsOnViewport = options.hideLabelsOnViewport;
    this.textureOnViewport = options.textureOnViewport;
    this.wheelSensitivity = options.wheelSensitivity;
    this.motionBlurEnabled = options.motionBlur; // on by default
    this.forcedPixelRatio = options.pixelRatio;
    this.motionBlur = true; // for initial kick off
    this.motionBlurOpacity = options.motionBlurOpacity;
    this.motionBlurTransparency = 1 - this.motionBlurOpacity;
    this.motionBlurPxRatio = 1;
    this.mbPxRBlurry = 1; //0.8;
    this.minMbLowQualFrames = 4;
    this.fullQualityMb = false;
    this.clearedForMotionBlur = [];
    this.desktopTapThreshold = options.desktopTapThreshold;
    this.desktopTapThreshold2 = options.desktopTapThreshold * options.desktopTapThreshold;
    this.touchTapThreshold = options.touchTapThreshold;
    this.touchTapThreshold2 = options.touchTapThreshold * options.touchTapThreshold;
    this.tapholdDuration = 500;

    this.load();
  }

  CanvasRenderer.panOrBoxSelectDelay = 400;

  // whether to use Path2D caching for drawing
  var pathsImpld = typeof Path2D !== 'undefined';
  CanvasRenderer.usePaths = function(){
    return pathsImpld;
  };

  CanvasRenderer.prototype.notify = function(params) {
    var types;

    if( $$.is.array( params.type ) ){
      types = params.type;

    } else {
      types = [ params.type ];
    }

    for( var i = 0; i < types.length; i++ ){
      var type = types[i];

      switch( type ){
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

      if( type === 'load' || type === 'resize' ){
        this.invalidateContainerClientCoordsCache();
        this.matchCanvasSize(this.data.container);
      }
    } // for

    this.data.canvasNeedsRedraw[CanvasRenderer.NODE] = true;
    this.data.canvasNeedsRedraw[CanvasRenderer.DRAG] = true;

    this.redraw();
  };

  CanvasRenderer.prototype.destroy = function(){
    this.destroyed = true;

    for( var i = 0; i < this.bindings.length; i++ ){
      var binding = this.bindings[i];
      var b = binding;

      b.target.removeEventListener(b.event, b.handler, b.useCapture);
    }

    if( this.removeObserver ){
      this.removeObserver.disconnect();
    }

    if( this.labelCalcDiv ){
      try{
        document.body.removeChild(this.labelCalcDiv);
      } catch(e){
        // ie10 issue #1014
      }
    }
  };



  // copy the math functions into the renderer prototype
  // unfortunately these functions are used interspersed t/o the code
  // and this makes sure things work just in case a ref was missed in refactoring
  // TODO remove this eventually
  for( var fnName in $$.math ){
    CanvasRenderer.prototype[ fnName ] = $$.math[ fnName ];
  }


  $$('renderer', 'canvas', CanvasRenderer);

})( cytoscape );
