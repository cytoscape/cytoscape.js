'use strict';

var is = require('../../../is');
var util = require('../../../util');

var BaseRenderer = function(){};
var BR = BaseRenderer;
var BRp = BR.prototype;

BRp.clientFunctions = [ 'redrawHint', 'render', 'renderTo', 'matchCanvasSize', 'nodeShapeImpl', 'arrowShapeImpl' ];

BRp.init = function( options ){
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
  r.registerArrowShapes();
  r.load();
};

BRp.notify = function(params) {
  var types;
  var r = this;

  if( is.array( params.type ) ){
    types = params.type;

  } else {
    types = [ params.type ];
  }

  for( var i = 0; i < types.length; i++ ){
    var type = types[i];

    switch( type ){
      case 'destroy':
        r.destroy();
        return;

      case 'add':
      case 'remove':
      case 'load':
        r.updateElementsCache();
        break;

      case 'viewport':
        r.redrawHint('select', true);
        break;

      case 'style':
        r.updateCachedZSortedEles();
        break;
    }

    if( type === 'load' || type === 'resize' ){
      r.invalidateContainerClientCoordsCache();
      r.matchCanvasSize(r.container);
    }
  } // for

  r.redrawHint('eles', true);
  r.redrawHint('drag', true);

  this.startRenderLoop();

  this.redraw();
};

[
  require('./arrow-shapes'),
  require('./cached-eles'),
  require('./coord-ele-math'),
  require('./images'),
  require('./load-listeners'),
  require('./node-shapes'),
  require('./redraw')
].forEach(function( props ){
  util.extend( BRp, props );
});

module.exports = BR;
