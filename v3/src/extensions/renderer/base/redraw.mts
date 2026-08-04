import * as util from '../../../util/index.mjs';
import type { Renderer } from '../renderer-types.mjs';

interface RedrawOptions {
  [key: string]: unknown;
}

let BRp: Record<string, unknown> = {};

BRp.timeToRender = function( this: Renderer ){
  return this.redrawTotalTime / this.redrawCount;
};

BRp.redraw = function( this: Renderer, options?: RedrawOptions ){
  options = options || util.staticEmptyObject();

  let r = this; // eslint-disable-line @typescript-eslint/no-this-alias

  if( r.averageRedrawTime === undefined ){ r.averageRedrawTime = 0; }
  if( r.lastRedrawTime === undefined ){ r.lastRedrawTime = 0; }
  if( r.lastDrawTime === undefined ){ r.lastDrawTime = 0; }

  r.requestedFrame = true;
  r.renderOptions = options;
};

BRp.beforeRender = function( this: Renderer, fn: ( willDraw: boolean, startTime: number ) => void, priority: number ){
  // the renderer can't add tick callbacks when destroyed
  if( this.destroyed ){ return; }

  if( priority == null ){
    util.error('Priority is not optional for beforeRender');
  }

  let cbs = this.beforeRenderCallbacks;

  cbs.push({ fn: fn, priority: priority });

  // higher priority callbacks executed first
  cbs.sort(function( a: { priority: number }, b: { priority: number } ){ return b.priority - a.priority; });
};

let beforeRenderCallbacks = function( r: Renderer, willDraw: boolean, startTime: number ){
  let cbs = r.beforeRenderCallbacks;

  for( let i = 0; i < cbs.length; i++ ){
    cbs[i].fn( willDraw, startTime );
  }
};

BRp.startRenderLoop = function( this: Renderer ){
  let r = this; // eslint-disable-line @typescript-eslint/no-this-alias
  let cy = r.cy;

  if( r.renderLoopStarted ){
    return;
  } else {
    r.renderLoopStarted = true;
  }

  let renderFn = function( requestTime: number ){
    if( r.destroyed ){ return; }

    if( cy.batching() ){
      // mid-batch, none of these should run
      // - pre frame hooks (calculations, texture caches, style, etc.)
      // - any drawing
    } else if( r.requestedFrame && !r.skipFrame ){
      beforeRenderCallbacks( r, true, requestTime );

      let startTime = util.performanceNow();

      r.render( r.renderOptions );

      let endTime = r.lastDrawTime = util.performanceNow();

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

      let duration = endTime - startTime;

      r.redrawTotalTime += duration;
      r.lastRedrawTime = duration;

      // use a weighted average with a bias from the previous average so we don't spike so easily
      r.averageRedrawTime = r.averageRedrawTime / 2 + duration / 2;

      r.requestedFrame = false;
    } else {
      beforeRenderCallbacks( r, false, requestTime );
    }

    r.skipFrame = false;

    util.requestAnimationFrame( renderFn );
  };

  util.requestAnimationFrame( renderFn );

};

export default BRp;
