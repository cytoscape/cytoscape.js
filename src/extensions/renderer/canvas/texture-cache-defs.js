var util = require( '../../../util' );

var fullFpsTime = 1000/60; // assume 60 frames per second

module.exports = {
  setupDequeueing: function( opts ){
    return function setupDequeueingImpl(){
      var self = this;
      var r = this.renderer;

      if( self.dequeueingSetup ){
        return;
      } else {
        self.dequeueingSetup = true;
      }

      var queueRedraw = util.debounce( function(){
        r.redrawHint( 'eles', true );
        r.redrawHint( 'drag', true );

        r.redraw();
      }, opts.deqRedrawThreshold );

      var dequeue = function( willDraw, frameStartTime ){
        var startTime = util.performanceNow();
        var avgRenderTime = r.averageRedrawTime;
        var renderTime = r.lastRedrawTime;
        var deqd = [];
        var extent = r.cy.extent();
        var pixelRatio = r.getPixelRatio();

        while( true ){
          var now = util.performanceNow();
          var duration = now - startTime;
          var frameDuration = now - frameStartTime;

          if( renderTime < fullFpsTime ){
            // if we're rendering faster than the ideal fps, then do dequeueing
            // during all of the remaining frame time

            var timeAvailable = fullFpsTime - ( willDraw ? avgRenderTime : 0 );

            if( frameDuration >= opts.deqFastCost * timeAvailable ){
              break;
            }
          } else {
            if( willDraw ){
              if(
                   duration >= opts.deqCost * renderTime
                || duration >= opts.deqAvgCost * avgRenderTime
              ){
                break;
              }
            } else if( frameDuration >= opts.deqNoDrawCost * fullFpsTime ){
              break;
            }
          }

          var thisDeqd = opts.deq( self, pixelRatio, extent );

          if( thisDeqd.length > 0 ){
            for( var i = 0; i < thisDeqd.length; i++ ){
              deqd.push( thisDeqd[i] );
            }
          } else {
            break;
          }
        }

        // callbacks on dequeue
        if( deqd.length > 0 ){
          opts.onDeqd( self, deqd );

          if( !willDraw && opts.shouldRedraw( self, deqd, pixelRatio, extent ) ){
            queueRedraw();
          }
        }
      };

      var priority = opts.priority || util.noop;

      r.beforeRender( dequeue, priority( self ) );
    };
  }
};
