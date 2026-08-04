import generateCubicBezier from './cubic-bezier.mjs';
import generateSpringRK4 from './spring.mjs';

/** A concrete easing: interpolates from start to end given a percent in [0,1]. */
export type EasingFn = ( start: number, end: number, percent: number ) => number;

/**
 * An entry in the easings map: either a ready-to-use easing function, or a
 * factory that builds one from user params (e.g. spring, cubic-bezier).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- heterogeneous map of easings and easing factories with differing arities
export type EasingEntry = ( ...args: any[] ) => any;

let cubicBezier = function( t1: number, p1: number, t2: number, p2: number ): EasingFn {
  let bezier = generateCubicBezier( t1, p1, t2, p2 ) as ( aX: number ) => number;

  return function( start: number, end: number, percent: number ){
    return start + ( end - start ) * bezier( percent );
  };
};

let easings: Record<string, EasingEntry> = {
  'linear': function( start: number, end: number, percent: number ){
    return start + (end - start) * percent;
  },

  // default easings
  'ease': cubicBezier( 0.25, 0.1, 0.25, 1 ),
  'ease-in': cubicBezier( 0.42, 0, 1, 1 ),
  'ease-out': cubicBezier( 0, 0, 0.58, 1 ),
  'ease-in-out': cubicBezier( 0.42, 0, 0.58, 1 ),

  // sine
  'ease-in-sine': cubicBezier( 0.47, 0, 0.745, 0.715 ),
  'ease-out-sine': cubicBezier( 0.39, 0.575, 0.565, 1 ),
  'ease-in-out-sine': cubicBezier( 0.445, 0.05, 0.55, 0.95 ),

  // quad
  'ease-in-quad': cubicBezier( 0.55, 0.085, 0.68, 0.53 ),
  'ease-out-quad': cubicBezier( 0.25, 0.46, 0.45, 0.94 ),
  'ease-in-out-quad': cubicBezier( 0.455, 0.03, 0.515, 0.955 ),

  // cubic
  'ease-in-cubic': cubicBezier( 0.55, 0.055, 0.675, 0.19 ),
  'ease-out-cubic': cubicBezier( 0.215, 0.61, 0.355, 1 ),
  'ease-in-out-cubic': cubicBezier( 0.645, 0.045, 0.355, 1 ),

  // quart
  'ease-in-quart': cubicBezier( 0.895, 0.03, 0.685, 0.22 ),
  'ease-out-quart': cubicBezier( 0.165, 0.84, 0.44, 1 ),
  'ease-in-out-quart': cubicBezier( 0.77, 0, 0.175, 1 ),

  // quint
  'ease-in-quint': cubicBezier( 0.755, 0.05, 0.855, 0.06 ),
  'ease-out-quint': cubicBezier( 0.23, 1, 0.32, 1 ),
  'ease-in-out-quint': cubicBezier( 0.86, 0, 0.07, 1 ),

  // expo
  'ease-in-expo': cubicBezier( 0.95, 0.05, 0.795, 0.035 ),
  'ease-out-expo': cubicBezier( 0.19, 1, 0.22, 1 ),
  'ease-in-out-expo': cubicBezier( 1, 0, 0, 1 ),

  // circ
  'ease-in-circ': cubicBezier( 0.6, 0.04, 0.98, 0.335 ),
  'ease-out-circ': cubicBezier( 0.075, 0.82, 0.165, 1 ),
  'ease-in-out-circ': cubicBezier( 0.785, 0.135, 0.15, 0.86 ),


  // user param easings...

  'spring': function( tension: number, friction: number, duration: number ){
    if( duration === 0 ){ // can't get a spring w/ duration 0
      return easings.linear; // duration 0 => jump to end so impl doesn't matter
    }

    let spring = generateSpringRK4( tension, friction, duration ) as ( percentComplete: number ) => number;

    return function( start: number, end: number, percent: number ){
      return start + (end - start) * spring( percent );
    };
  },

  'cubic-bezier': cubicBezier
};

export default easings;
