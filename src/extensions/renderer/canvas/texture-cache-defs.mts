import * as util from '../../../util/index.mjs';

let fullFpsTime = 1000/60; // assume 60 frames per second

// Dequeueing configuration passed by each texture cache; fields are read-only knobs/callbacks
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- open-ended dequeueing options/callbacks
type DequeueOpts = any;

// `this` is the texture-cache instance (has .renderer, .dequeueingSetup, ...)
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- texture-cache instance owned by ele/layered-texture-cache mixins
type TextureCache = any;

export default {
  setupDequeueing: function( opts: DequeueOpts ){
    return function setupDequeueingImpl( this: TextureCache ){
      let self = this; // eslint-disable-line @typescript-eslint/no-this-alias
      let r = this.renderer;

      if( self.dequeueingSetup ){
        return;
      } else {
        self.dequeueingSetup = true;
      }

      let queueRedraw = util.debounce( function(){
        r.redrawHint( 'eles', true );
        r.redrawHint( 'drag', true );

        r.redraw();
      }, opts.deqRedrawThreshold );

      let dequeue = function( willDraw: boolean, frameStartTime: number ){
        let startTime = util.performanceNow();
        let avgRenderTime = r.averageRedrawTime;
        let renderTime = r.lastRedrawTime;
        let deqd = [];
        let extent = r.cy.extent();
        let pixelRatio = r.getPixelRatio();

        // if we aren't in a tick that causes a draw, then the rendered style
        // queue won't automatically be flushed before dequeueing starts
        if( !willDraw ){
          r.flushRenderedStyleQueue();
        }

        while( true ){  
          let now = util.performanceNow();
          let duration = now - startTime;
          let frameDuration = now - frameStartTime;

          if( renderTime < fullFpsTime ){
            // if we're rendering faster than the ideal fps, then do dequeueing
            // during all of the remaining frame time

            let timeAvailable = fullFpsTime - ( willDraw ? avgRenderTime : 0 );

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

          let thisDeqd = opts.deq( self, pixelRatio, extent );

          if( thisDeqd.length > 0 ){
            for( let i = 0; i < thisDeqd.length; i++ ){
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

      let priority = opts.priority || util.noop;

      r.beforeRender( dequeue, priority( self ) );
    };
  }
};
