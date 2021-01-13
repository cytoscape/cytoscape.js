import define from '../define';

let elesfn = ({

    /**
 * @callback animate_options
 * @property {animate_options_type} options - animate_options_type
 */

/**
 * options
 * @typedef {object} animate_options_type
 * @property {object} options - A position to which the elements will be animated.
 * @property {object} renderedPosition -  A rendered position to which the elements will be animated.
 * @property {object} style - An object containing name-value pairs of style properties to animate.
 * @property {object} duration - The duration of the animation in milliseconds.
 * @property {object} queue - A boolean indicating whether to queue the animation (default `true`).
 * @property {object} easing - A `transition-timing-function` easing style string that shapes the animation progress curve.
 * @property {object} complete - A function to call when the animation is done.
 * @property {object} step - A function to call each time the animation steps.
 */

/**
 * @typedef {object} eles_animate
 * @property {function(animate_options):any} animate_options - An object containing the details of the animation.
 */

  /**
 * Animate the elements.
 * @memberof eles
 * @path Collection/Animation
 * @param {...eles_animate} params - NULL
 * @methodName eles.animate
 */
  animate: define.animate(),

      /**
 * @callback animation_options
 * @property {animation_options_type} options - animation_options_type
 */

/**
 * options
 * @typedef {object} animation_options_type
 * @property {object} options - A position to which the elements will be animated.
 * @property {object} renderedPosition -  A rendered position to which the elements will be animated.
 * @property {object} style - An object containing name-value pairs of style properties to animate.
 * @property {object} duration - The duration of the animation in milliseconds.
 * @property {object} easing - A `transition-timing-function` easing style string that shapes the animation progress curve.
 * @property {object} complete - A function to call when the animation is done.
 * @property {object} step - A function to call each time the animation steps.
 */

/**
 * @typedef {object} ele_animation
 * @property {function(animation_options):any} animation_options - An object containing the details of the animation.
 */

  /**
 * Get an [animation](#animations) for the element.
 * @memberof ele
 * @path Collection/Animation
 * @param {...ele_animation} params - NULL
 * @methodName ele.animation
 */
  animation: define.animation(),
   /**
 * Get whether the element is currently being animated.
 * @memberof ele
 * @path Collection/Animation
 * @methodName ele.animated
 */
  animated: define.animated(),
     /**
 * Remove all queued animations for the elements.
 * @memberof eles
 * @path Collection/Animation
 * @methodName eles.clearQueue
 */
  clearQueue: define.clearQueue(),
  /**
 * @typedef {object} eles_delay_type
 * @property {object} duration - How long the delay should be in milliseconds.
 * @property {object} complete - A function to call when the delay is complete.
 */

  /**
 * @typedef {object} eles_delay
 * @property {eles_delay_type} eles_delay_type
 */

  /**
 * Add a delay between queued animations for the elements.
 * @memberof eles
 * @path Collection/Animation
 * @param {...eles_delay} params - NULL
 * @methodName eles.delay
 */
  delay: define.delay(),

    /**
 * @typedef {object} ele_delayAnimation_type
 * @property {object} duration - How long the delay should be in milliseconds.
 */

  /**
 * @typedef {object} ele_delayAnimation
 * @property {ele_delayAnimation_type} ele_delayAnimation_type
 */

  /**
 * Get a delay [animation](#animations) for the element.
 * @memberof ele
 * @path Collection/Animation
 * @param {...ele_delayAnimation} params - NULL
 * @methodName ele.delayAnimation
 */
  delayAnimation: define.delayAnimation(),
    /**
 * @typedef {object} eles_stop_type
 * @property {object} clearQueue - A boolean, indicating whether the queue of animations should be emptied.
 * @property {object} jumpToEnd - A boolean, indicating whether the currently-running animations should jump to their ends rather than just stopping midway.
 */

  /**
 * @typedef {object} eles_stop
 * @property {eles_stop_type} eles_stop_type
 */

  /**
 * Stop all animations that are currently running.
 * @memberof eles
 * @path Collection/Animation
 * @param {...eles_stop} params - NULL
 * @methodName eles.stop
 */
  stop: define.stop()
});

export default elesfn;
