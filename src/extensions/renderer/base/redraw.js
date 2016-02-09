'use strict';

var util = require( '../../../util' );

var BRp = {};

BRp.timeToRender = function(){
  return this.redrawTotalTime / this.redrawCount;
};

var minRedrawLimit = 1000 / 60; // people can't see much better than 60fps
var maxRedrawLimit = 1000;  // don't cap max b/c it's more important to be responsive than smooth

BRp.redraw = function( options ){
  options = options || util.staticEmptyObject();

  var r = this;
  var forcedContext = options.forcedContext;

  if( r.averageRedrawTime === undefined ){ r.averageRedrawTime = 0; }
  if( r.lastRedrawTime === undefined ){ r.lastRedrawTime = 0; }

  var redrawLimit = r.lastRedrawTime; // estimate the ideal redraw limit based on how fast we can draw
  redrawLimit = minRedrawLimit > redrawLimit ? minRedrawLimit : redrawLimit;
  redrawLimit = redrawLimit < maxRedrawLimit ? redrawLimit : maxRedrawLimit;

  if( r.lastDrawTime === undefined ){ r.lastDrawTime = 0; }

  var nowTime = Date.now();
  var timeElapsed = nowTime - r.lastDrawTime;
  var callAfterLimit = timeElapsed >= redrawLimit;

  if( !forcedContext ){
    if( !callAfterLimit ){
      r.skipFrame = true;
      return;
    }
  }

  r.requestedFrame = true;
  r.renderOptions = options;
};

BRp.beforeRender = function( fn ){
  this.beforeRenderCallbacks.push( fn );
};

BRp.startRenderLoop = function(){
  var r = this;

  if( r.renderLoopStarted ){
    return;
  } else {
    r.renderLoopStarted = true;
  }

  var renderFn = function(){
    if( r.destroyed ){ return; }

    if( r.requestedFrame && !r.skipFrame ){
      var startTime = util.performanceNow();

      var cbs = r.beforeRenderCallbacks;
      for( var i = 0; i < cbs.length; i++ ){ cbs[i](); }

      r.render( r.renderOptions );

      var endTime = r.lastRedrawTime = util.performanceNow();

      if( r.averageRedrawTime === undefined ){
        r.averageRedrawTime = endTime - startTime;
      }

      if( r.redrawCount === undefined ){
        r.redrawCount = 0;
      }

      r.redrawCount++;

      if( r.redrawTotalTime === undefined ){
        r.redrawTotalTime = 0;
      }

      var duration = endTime - startTime;

      r.redrawTotalTime += duration;
      r.lastRedrawTime = duration;

      // use a weighted average with a bias from the previous average so we don't spike so easily
      r.averageRedrawTime = r.averageRedrawTime / 2 + duration / 2;

      r.requestedFrame = false;
    }

    r.skipFrame = false;

    util.requestAnimationFrame( renderFn );
  };

  util.requestAnimationFrame( renderFn );

};

module.exports = BRp;
