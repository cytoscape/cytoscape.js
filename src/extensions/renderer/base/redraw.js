;(function($$){ 'use strict';

  var BaseRenderer = $$('renderer', 'base');
  var BR = BaseRenderer;
  var BRp = BR.prototype;

  BRp.timeToRender = function(){
    return this.redrawTotalTime / this.redrawCount;
  };

  BR.minRedrawLimit = 1000/60; // people can't see much better than 60fps
  BR.maxRedrawLimit = 1000;  // don't cap max b/c it's more important to be responsive than smooth
  BR.motionBlurDelay = 100;

  BRp.redraw = function( options ){
    options = options || $$.util.staticEmptyObject();

    // console.log('redraw()')

    var r = this;
    var forcedContext = options.forcedContext;

    if( !forcedContext && r.motionBlurTimeout ){
      clearTimeout( r.motionBlurTimeout );
    }

    if( r.averageRedrawTime === undefined ){ r.averageRedrawTime = 0; }
    if( r.lastRedrawTime === undefined ){ r.lastRedrawTime = 0; }

    var minRedrawLimit = BR.minRedrawLimit;
    var maxRedrawLimit = BR.maxRedrawLimit;

    var redrawLimit = r.lastRedrawTime; // estimate the ideal redraw limit based on how fast we can draw
    redrawLimit = minRedrawLimit > redrawLimit ? minRedrawLimit : redrawLimit;
    redrawLimit = redrawLimit < maxRedrawLimit ? redrawLimit : maxRedrawLimit;

    //console.log('--\nideal: %i; effective: %i', this.averageRedrawTime, redrawLimit);

    if( r.lastDrawTime === undefined ){ r.lastDrawTime = 0; }

    var nowTime = Date.now();
    var timeElapsed = nowTime - r.lastDrawTime;
    var callAfterLimit = timeElapsed >= redrawLimit;

    if( !forcedContext && !r.clearingMotionBlur ){
      if( !callAfterLimit || r.currentlyDrawing ){
        // console.log('-- skip frame', redrawLimit);

        r.skipFrame = true;
        return;
      }
    }

    // console.log('-- render next frame', redrawLimit);

    r.requestedFrame = true;
    r.currentlyDrawing = true;
    r.renderOptions = options;
  };

  BRp.startRenderLoop = function(){
    var r = this;

    var renderFn = function(){
      if( r.destroyed ){ return; }

      if( r.requestedFrame && !r.skipFrame ){
        var startTime = $$.util.performanceNow();

        r.render( r.renderOptions );

        var endTime = r.lastRedrawTime = $$.util.performanceNow();

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
        r.averageRedrawTime = r.averageRedrawTime/2 + duration/2;
        // console.log('actual: %i, average: %i', endTime - startTime, r.averageRedrawTime);

        r.requestedFrame = false;
      }

      r.skipFrame = false;

      $$.util.requestAnimationFrame( renderFn );
    };

    $$.util.requestAnimationFrame( renderFn );

  };

})( cytoscape );
