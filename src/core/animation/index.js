import define from '../../define';
import * as util from '../../util';
import stepAll from './step-all';

let corefn = ({

  // pull in animation functions
  animate: define.animate(),
  animation: define.animation(),
     /**
 * Get whether the viewport is currently being animated.
 * @memberof cy
 * @path Core/Animation
 * @methodName cy.animated
 */
  animated: define.animated(),
  clearQueue: define.clearQueue(),

/**
 * @typedef {object} cy_delay_type
 * @property {object} duration - How long the delay should be in milliseconds.
 * @property {object} complete - A function to call when the delay is complete.
 */

/**
 * @typedef {object} cy_delay
 * @property {object} cy_delay_type
 */

  /**
 * Add a delay between queued animations for the viewport.
 * @memberof cy
 * @path Core/Animation
 * @param {...cy_delay} events - NULL
 * @methodName cy.delay
 */
  delay: define.delay(),

/**
 * @typedef {object} cy_delayAnimation
 * @property {object} duration How long the delay should be in milliseconds.
 */

  /**
 * Get a delay [animation](#animations) for the element.
 * @memberof cy
 * @path Core/Animation
 * @param {...cy_delayAnimation} duration - NULL
 * @methodName cy.delayAnimation
 */
  delayAnimation: define.delayAnimation(),
  /**
 * @typedef {object} cy_stop_type
 * @property {object} clearQueue - A boolean (default `false`), indicating whether the queue of animations should be emptied.
 * @property {object} jumpToEnd - A boolean (default `false`), indicating whether the currently-running animations should jump to their ends rather than just stopping midway.
 */

/**
 * @typedef {object} cy_stop
 * @property {object} cy_stop_type
 */

  /**
 * Stop all viewport animations that are currently running.
 * @memberof cy
 * @path Core/Animation
 * @param {...cy_stop} events - NULL
 * @methodName cy.stop
 */
  stop: define.stop(),

   /**
 * Remove all queued animations for the viewport.
 * @memberof cy
 * @path Core/Animation
 * @methodName cy.clearQueue
 */

  addToAnimationPool: function( eles ){
    let cy = this;

    if( !cy.styleEnabled() ){ return; } // save cycles when no style used

    cy._private.aniEles.merge( eles );
  },

  stopAnimationLoop: function(){
    this._private.animationsRunning = false;
  },

  startAnimationLoop: function(){
    let cy = this;

    cy._private.animationsRunning = true;

    if( !cy.styleEnabled() ){ return; } // save cycles when no style used

    // NB the animation loop will exec in headless environments if style enabled
    // and explicit cy.destroy() is necessary to stop the loop

    function headlessStep(){
      if( !cy._private.animationsRunning ){ return; }

      util.requestAnimationFrame( function animationStep( now ){
        stepAll( now, cy );
        headlessStep();
      } );
    }

    let renderer = cy.renderer();

    if( renderer && renderer.beforeRender ){ // let the renderer schedule animations
      renderer.beforeRender( function rendererAnimationStep( willDraw, now ){
        stepAll( now, cy );
      }, renderer.beforeRenderPriorities.animations );
    } else { // manage the animation loop ourselves
      headlessStep(); // first call
    }
  }

});

export default corefn;
