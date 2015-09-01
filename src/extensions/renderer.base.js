(function($$) { 'use strict';

  var BaseRenderer = function(){};

  BaseRenderer.prototype.init = function( options ){
    var r = this;

    r.options = options;

    r.cy = options.cy;

    r.container = options.cy.container();

    r.selection = [undefined, undefined, undefined, undefined, 0]; // Coordinates for selection box, plus enabled flag

    //--Pointer-related data
    r.hoverData = {down: null, last: null,
        downTime: null, triggerMode: null,
        dragging: false,
        initialPan: [null, null], capture: false};

    r.dragData = {possibleDragElements: []};

    r.touchData = {
        start: null, capture: false,

        // These 3 fields related to tap, taphold events
        startPosition: [null, null, null, null, null, null],
        singleTouchStartTime: null,
        singleTouchMoved: true,

        now: [null, null, null, null, null, null],
        earlier: [null, null, null, null, null, null]
    };

    r.redraws = 0;
    r.showFps = options.showFps;

    r.hideEdgesOnViewport = options.hideEdgesOnViewport;
    r.hideLabelsOnViewport = options.hideLabelsOnViewport;
    r.textureOnViewport = options.textureOnViewport;
    r.wheelSensitivity = options.wheelSensitivity;
    r.motionBlurEnabled = options.motionBlur; // on by default
    r.forcedPixelRatio = options.pixelRatio;
    r.motionBlur = true; // for initial kick off
    r.motionBlurOpacity = options.motionBlurOpacity;
    r.motionBlurTransparency = 1 - r.motionBlurOpacity;
    r.motionBlurPxRatio = 1;
    r.mbPxRBlurry = 1; //0.8;
    r.minMbLowQualFrames = 4;
    r.fullQualityMb = false;
    r.clearedForMotionBlur = [];
    r.desktopTapThreshold = options.desktopTapThreshold;
    r.desktopTapThreshold2 = options.desktopTapThreshold * options.desktopTapThreshold;
    r.touchTapThreshold = options.touchTapThreshold;
    r.touchTapThreshold2 = options.touchTapThreshold * options.touchTapThreshold;
    r.tapholdDuration = 500;

    r.bindings = [];

    r.registerNodeShapes();
    r.load();
  };

  $$('renderer', 'base', BaseRenderer);

})( cytoscape );
