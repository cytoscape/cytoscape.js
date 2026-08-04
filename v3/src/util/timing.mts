import window from '../window.mjs';
import debounce from 'lodash/debounce.js';

// standard and legacy vendor-prefixed versions of window.requestAnimationFrame; all
// marked optional since the runtime checks below guard old environments lacking them
interface RafWindow {
  requestAnimationFrame?: ( fn: FrameRequestCallback ) => number;
  mozRequestAnimationFrame?: ( fn: FrameRequestCallback ) => number;
  webkitRequestAnimationFrame?: ( fn: FrameRequestCallback ) => number;
  msRequestAnimationFrame?: ( fn: FrameRequestCallback ) => number;
}

// `now` is marked optional since the runtime check below guards old environments lacking it
let performance: ( Omit<Performance, 'now'> & { now?: Performance['now'] } ) | null = window ? window.performance : null;

let pnow = performance && performance.now ? () => performance!.now!() : () => Date.now();

let raf = (function(){
  if( window ) {
    if( ( window as RafWindow ).requestAnimationFrame ){
      return function( fn: FrameRequestCallback ){ window!.requestAnimationFrame( fn ); };
    } else if( ( window as RafWindow ).mozRequestAnimationFrame ){
      return function( fn: FrameRequestCallback ){ ( window as RafWindow ).mozRequestAnimationFrame!( fn ); };
    } else if( ( window as RafWindow ).webkitRequestAnimationFrame ){
      return function( fn: FrameRequestCallback ){ ( window as RafWindow ).webkitRequestAnimationFrame!( fn ); };
    } else if( ( window as RafWindow ).msRequestAnimationFrame ){
      return function( fn: FrameRequestCallback ){ ( window as RafWindow ).msRequestAnimationFrame!( fn ); };
    }
  }

  return function( fn: FrameRequestCallback ){
    if( fn ){
      setTimeout( function(){
        fn( pnow() );
      }, 1000 / 60 );
    }
  };
})();

export const requestAnimationFrame = ( fn: FrameRequestCallback ) => raf( fn );

export const performanceNow = pnow;

export const now = () => Date.now();

export { debounce };
