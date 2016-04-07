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

  var has = {};
  for( var i = 0; i < types.length; i++ ){
    var type = types[i];

    has[ type ] = true;
  }

  if( has.destroy ){
    r.destroy();
    return;
  }

  if( has.add || has.remove || has.load ){
    r.updateElementsCache();
  }

  if( has.viewport ){
    r.redrawHint('select', true);
  }

  if( has.load || has.resize ){
    r.invalidateContainerClientCoordsCache();
    r.matchCanvasSize(r.container);
  }

  r.redrawHint('eles', true);
  r.redrawHint('drag', true);

  this.startRenderLoop();

  this.redraw();
};

BRp.destroy = function(){
  this.destroyed = true;

  this.cy.stopAnimationLoop();

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
