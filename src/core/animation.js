'use strict';

var define = require('../define');
var util = require('../util');
var is = require('../is');
var window = require('../window');

var corefn = ({

  // pull in animation functions
  animation: define.animation(),
  animated: define.animated(),
  clearQueue: define.clearQueue(),
  delay: define.delay(),
  delayPromise: define.delayPromise(),
  animate: define.animate(),
  animatePromise: define.animatePromise(),
  stop: define.stop(),

  addToAnimationPool: function( eles ){
    var cy = this;

    if( !cy.styleEnabled() ){ return; } // save cycles when no style used

    cy._private.aniEles.merge( eles );
  },

  stopAnimationLoop: function(){
    this._private.animationsRunning = false;
  },

  startAnimationLoop: function(){
    var cy = this;

    cy._private.animationsRunning = true;

    if( !cy.styleEnabled() ){ return; } // save cycles when no style used

    // don't execute the animation loop in headless environments
    if( !window ){
      return;
    }

    function globalAnimationStep(){
      if( !cy._private.animationsRunning ){ return; }

      util.requestAnimationFrame(function(now){
        handleElements(now);
        globalAnimationStep();
      });
    }

    globalAnimationStep(); // first call

    function handleElements( now ){
      var eles = cy._private.aniEles;
      var doneEles = [];

      function handleElement( ele, isCore ){
        var _p = ele._private;
        var current = _p.animation.current;
        var queue = _p.animation.queue;
        var ranAnis = false;

        // if nothing currently animating, get something from the queue
        if( current.length === 0 ){
          var next = queue.length > 0 ? queue.shift() : null;

          if( next ){
            current.push( next );
          }
        }

        // step and remove if done
        var completes = [];
        for( var i = current.length - 1; i >= 0; i-- ){
          var ani = current[i];
          var ani_p = ani._private;

          if( ani_p.stopped ){
            current.splice(i, 1);

            ani_p.hooked = false;
            ani_p.playing = false;
            ani_p.started = false;

            continue;
          }

          if( !ani_p.playing ){ continue; }

          if( !ani_p.started ){
            startAnimation( ele, ani, now );
          }

          step( ele, ani, now, isCore );

          if( ani.complete() ){
            completes.push( ani );
            current.splice(i, 1);

            ani_p.hooked = false;
            ani_p.playing = false;
            ani_p.started = false;
          }

          ranAnis = true;
        }

        // call complete callbacks
        for( var i = 0; i < completes.length; i++ ){
          var ani = completes[i];
          var complete = ani._private.complete;

          if( is.fn(complete) ){
            complete.apply( ele, [ now ] );
          }
        }

        if( !isCore && current.length === 0 && queue.length === 0 ){
          doneEles.push( ele );
        }

        return ranAnis;
      } // handleElements

      // handle all eles
      var ranEleAni = false;
      for( var e = 0; e < eles.length; e++ ){
        var ele = eles[e];

        ranEleAni = ranEleAni || handleElement( ele );
      } // each element

      var ranCoreAni = handleElement( cy, true );

      // notify renderer
      if( ranEleAni || ranCoreAni ){
        var toNotify;

        if( eles.length > 0 ){
          var updatedEles = eles.updateCompoundBounds();
          toNotify = updatedEles.length > 0 ? eles.add( updatedEles ) : eles;
        }

        cy.notify({
          type: 'draw',
          collection: toNotify
        });
      }

      // remove elements from list of currently animating if its queues are empty
      eles.unmerge( doneEles );

    } // handleElements

    function startAnimation( self, ani, now ){
      var isCore = is.core( self );
      var isEles = !isCore;
      var ele = self;
      var style = cy._private.style;
      var ani_p = ani._private;

      if( isEles ){
        var pos = ele._private.position;

        ani_p.startPosition = ani_p.startPosition || {
          x: pos.x,
          y: pos.y
        };

        ani_p.startStyle = ani_p.startStyle || style.getValueStyle( ele );
      }

      if( isCore ){
        var pan = cy._private.pan;

        ani_p.startPan = ani_p.startPan || {
          x: pan.x,
          y: pan.y
        };

        ani_p.startZoom = ani_p.startZoom != null ? ani_p.startZoom : cy._private.zoom;
      }

      ani_p.started = true;
      ani_p.startTime = now - ani_p.progress * ani_p.duration;
    }

    function step( self, ani, now, isCore ){
      var style = cy._private.style;
      var isEles = !isCore;
      var _p = self._private;
      var ani_p = ani._private;
      var pEasing = ani_p.easing;
      var startTime = ani_p.startTime;

      if( !ani_p.easingImpl ){

        if( pEasing == null ){ // use default
          ani_p.easingImpl = easings['linear'];

        } else { // then define w/ name
          var easingVals;

          if( is.string( pEasing ) ){
            var easingProp = style.parse('transition-timing-function', pEasing);

            easingVals = easingProp.value;

          } else { // then assume preparsed array
            easingVals = pEasing;
          }

          var name, args;

          if( is.string( easingVals ) ){
            name = easingVals;
            args = [];
          } else {
            name = easingVals[1];
            args = easingVals.slice(2).map(function(n){ return +n; });
          }

          if( args.length > 0 ){ // create with args
            if( name === 'spring' ){
              args.push( ani_p.duration ); // need duration to generate spring
            }

            ani_p.easingImpl = easings[ name ].apply( null, args );
          } else { // static impl by name
            ani_p.easingImpl = easings[ name ];
          }
        }

      }

      var easing = ani_p.easingImpl;
      var percent;

      if( ani_p.duration === 0 ){
        percent = 1;
      } else {
        percent = (now - startTime) / ani_p.duration;
      }

      if( percent < 0 ){
        percent = 0;
      } else if( percent > 1 ){
        percent = 1;
      }

      if( ani_p.delay == null ){ // then update

        var startPos = ani_p.startPosition;
        var endPos = ani_p.position;
        var pos = _p.position;
        if( endPos && isEles ){
          if( valid( startPos.x, endPos.x ) ){
            pos.x = ease( startPos.x, endPos.x, percent, easing );
          }

          if( valid( startPos.y, endPos.y ) ){
            pos.y = ease( startPos.y, endPos.y, percent, easing );
          }
        }

        var startPan = ani_p.startPan;
        var endPan = ani_p.pan;
        var pan = _p.pan;
        var animatingPan = endPan != null && isCore;
        if( animatingPan ){
          if( valid( startPan.x, endPan.x ) ){
            pan.x = ease( startPan.x, endPan.x, percent, easing );
          }

          if( valid( startPan.y, endPan.y ) ){
            pan.y = ease( startPan.y, endPan.y, percent, easing );
          }

          self.trigger('pan');
        }

        var startZoom = ani_p.startZoom;
        var endZoom = ani_p.zoom;
        var animatingZoom = endZoom != null && isCore;
        if( animatingZoom ){
          if( valid( startZoom, endZoom ) ){
            _p.zoom = ease( startZoom, endZoom, percent, easing );
          }

          self.trigger('zoom');
        }

        if( animatingPan || animatingZoom ){
          self.trigger('viewport');
        }

        var props = ani_p.style;
        if( props && isEles ){

          for( var i = 0; i < props.length; i++ ){
            var prop = props[i];
            var name = prop.name;
            var end = prop;

            var start = ani_p.startStyle[ name ];
            var easedVal = ease( start, end, percent, easing );

            style.overrideBypass( self, name, easedVal );
          } // for props

        } // if

      }

      if( is.fn(ani_p.step) ){
        ani_p.step.apply( self, [ now ] );
      }

      ani_p.progress = percent;

      return percent;
    }

    function valid(start, end){
      if( start == null || end == null ){
        return false;
      }

      if( is.number(start) && is.number(end) ){
        return true;
      } else if( (start) && (end) ){
        return true;
      }

      return false;
    }

    // assumes p0 = 0, p3 = 1
    function evalCubicBezier( p1, p2, t ){
      var one_t = 1 - t;
      var tsq = t*t;

      return ( 3 * one_t * one_t * t * p1 ) + ( 3 * one_t * tsq * p2 ) + tsq * t;
    };

    function cubicBezier( p1, p2 ){
      return function( start, end, percent ){
        return start + (end - start) * evalCubicBezier( p1, p2, percent );
      };
    }

    /* Runge-Kutta spring physics function generator. Adapted from Framer.js, copyright Koen Bok. MIT License: http://en.wikipedia.org/wiki/MIT_License */
    /* Given a tension, friction, and duration, a simulation at 60FPS will first run without a defined duration in order to calculate the full path. A second pass
       then adjusts the time delta -- using the relation between actual time and duration -- to calculate the path for the duration-constrained animation. */
    var generateSpringRK4 = (function () {
        function springAccelerationForState (state) {
            return (-state.tension * state.x) - (state.friction * state.v);
        }

        function springEvaluateStateWithDerivative (initialState, dt, derivative) {
            var state = {
                x: initialState.x + derivative.dx * dt,
                v: initialState.v + derivative.dv * dt,
                tension: initialState.tension,
                friction: initialState.friction
            };

            return { dx: state.v, dv: springAccelerationForState(state) };
        }

        function springIntegrateState (state, dt) {
            var a = {
                    dx: state.v,
                    dv: springAccelerationForState(state)
                },
                b = springEvaluateStateWithDerivative(state, dt * 0.5, a),
                c = springEvaluateStateWithDerivative(state, dt * 0.5, b),
                d = springEvaluateStateWithDerivative(state, dt, c),
                dxdt = 1.0 / 6.0 * (a.dx + 2.0 * (b.dx + c.dx) + d.dx),
                dvdt = 1.0 / 6.0 * (a.dv + 2.0 * (b.dv + c.dv) + d.dv);

            state.x = state.x + dxdt * dt;
            state.v = state.v + dvdt * dt;

            return state;
        }

        return function springRK4Factory (tension, friction, duration) {

            var initState = {
                    x: -1,
                    v: 0,
                    tension: null,
                    friction: null
                },
                path = [0],
                time_lapsed = 0,
                tolerance = 1 / 10000,
                DT = 16 / 1000,
                have_duration, dt, last_state;

            tension = parseFloat(tension) || 500;
            friction = parseFloat(friction) || 20;
            duration = duration || null;

            initState.tension = tension;
            initState.friction = friction;

            have_duration = duration !== null;

            /* Calculate the actual time it takes for this animation to complete with the provided conditions. */
            if (have_duration) {
                /* Run the simulation without a duration. */
                time_lapsed = springRK4Factory(tension, friction);
                /* Compute the adjusted time delta. */
                dt = time_lapsed / duration * DT;
            } else {
                dt = DT;
            }

            while (true) {
                /* Next/step function .*/
                last_state = springIntegrateState(last_state || initState, dt);
                /* Store the position. */
                path.push(1 + last_state.x);
                time_lapsed += 16;
                /* If the change threshold is reached, break. */
                if (!(Math.abs(last_state.x) > tolerance && Math.abs(last_state.v) > tolerance)) {
                    break;
                }
            }

            /* If duration is not defined, return the actual time required for completing this animation. Otherwise, return a closure that holds the
               computed path and returns a snapshot of the position according to a given percentComplete. */
            return !have_duration ? time_lapsed : function(percentComplete) { return path[ (percentComplete * (path.length - 1)) | 0 ]; };
        };
    }());

    var easings = {
      'linear': function( start, end, percent ){
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

      'spring': function( tension, friction, duration ){
        var spring = generateSpringRK4( tension, friction, duration );

        return function( start, end, percent ){
          return start + (end - start) * spring( percent );
        };
      },

      'cubic-bezier': function( x1, y1, x2, y2 ){
        return cubicBezier( x1, y1, x2, y2 );
      }
    };

    function ease( startProp, endProp, percent, easingFn ){
      if( percent < 0 ){
        percent = 0;
      } else if( percent > 1 ){
        percent = 1;
      }

      var start, end;

      if( startProp.pxValue != null || startProp.value != null ){
        start = startProp.pxValue != null ? startProp.pxValue : startProp.value;
      } else {
        start = startProp;
      }

      if( endProp.pxValue != null || endProp.value != null ){
        end = endProp.pxValue != null ? endProp.pxValue : endProp.value;
      } else {
        end = endProp;
      }

      if( is.number(start) && is.number(end) ){
        return easingFn( start, end, percent );

      } else if( is.number(start[0]) && is.number(end[0]) ){ // then assume a colour
        var c1 = start;
        var c2 = end;

        var ch = function(ch1, ch2){
          return Math.round( easingFn(ch1, ch2, percent) );
        };

        var r = ch( c1[0], c2[0] );
        var g = ch( c1[1], c2[1] );
        var b = ch( c1[2], c2[2] );

        return [r, g, b];
      }

      return undefined;
    }

  }

});

module.exports = corefn;
