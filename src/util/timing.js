'use strict';

var window = require( '../window' );
var is = require( '../is' );
var performance = window ? window.performance : null;

var util = {};

var raf = !window ? null : ( window.requestAnimationFrame || window.mozRequestAnimationFrame ||
      window.webkitRequestAnimationFrame || window.msRequestAnimationFrame );

raf = raf || function( fn ){
  if( fn ){
    setTimeout( function(){
      fn( pnow() );
    }, 1000 / 60 );
  }
};

util.requestAnimationFrame = function( fn ){
  raf( fn );
};

var pnow = performance && performance.now ? function(){ return performance.now(); } : function(){ return Date.now(); };

util.performanceNow = pnow;

// ported lodash throttle function
util.throttle = function( func, wait, options ){
  var leading = true,
      trailing = true;

  if( options === false ){
    leading = false;
  } else if( is.plainObject( options ) ){
    leading = 'leading' in options ? options.leading : leading;
    trailing = 'trailing' in options ? options.trailing : trailing;
  }
  options = options || {};
  options.leading = leading;
  options.maxWait = wait;
  options.trailing = trailing;

  return util.debounce( func, wait, options );
};

util.now = function(){
  return Date.now();
};

util.debounce = function( func, wait, options ){ // ported lodash debounce function
  var util = this;
  var args,
      maxTimeoutId,
      result,
      stamp,
      thisArg,
      timeoutId,
      trailingCall,
      lastCalled = 0,
      maxWait = false,
      trailing = true;

  if( !is.fn( func ) ){
    return;
  }
  wait = Math.max( 0, wait ) || 0;
  if( options === true ){
    var leading = true;
    trailing = false;
  } else if( is.plainObject( options ) ){
    leading = options.leading;
    maxWait = 'maxWait' in options && (Math.max( wait, options.maxWait ) || 0);
    trailing = 'trailing' in options ? options.trailing : trailing;
  }
  var delayed = function(){
    var remaining = wait - (util.now() - stamp);
    if( remaining <= 0 ){
      if( maxTimeoutId ){
        clearTimeout( maxTimeoutId );
      }
      var isCalled = trailingCall;
      maxTimeoutId = timeoutId = trailingCall = undefined;
      if( isCalled ){
        lastCalled = util.now();
        result = func.apply( thisArg, args );
        if( !timeoutId && !maxTimeoutId ){
          args = thisArg = null;
        }
      }
    } else {
      timeoutId = setTimeout( delayed, remaining );
    }
  };

  var maxDelayed = function(){
    if( timeoutId ){
      clearTimeout( timeoutId );
    }
    maxTimeoutId = timeoutId = trailingCall = undefined;
    if( trailing || (maxWait !== wait) ){
      lastCalled = util.now();
      result = func.apply( thisArg, args );
      if( !timeoutId && !maxTimeoutId ){
        args = thisArg = null;
      }
    }
  };

  return function(){
    args = arguments;
    stamp = util.now();
    thisArg = this;
    trailingCall = trailing && (timeoutId || !leading);

    if( maxWait === false ){
      var leadingCall = leading && !timeoutId;
    } else {
      if( !maxTimeoutId && !leading ){
        lastCalled = stamp;
      }
      var remaining = maxWait - (stamp - lastCalled),
          isCalled = remaining <= 0;

      if( isCalled ){
        if( maxTimeoutId ){
          maxTimeoutId = clearTimeout( maxTimeoutId );
        }
        lastCalled = stamp;
        result = func.apply( thisArg, args );
      }
      else if( !maxTimeoutId ){
        maxTimeoutId = setTimeout( maxDelayed, remaining );
      }
    }
    if( isCalled && timeoutId ){
      timeoutId = clearTimeout( timeoutId );
    }
    else if( !timeoutId && wait !== maxWait ){
      timeoutId = setTimeout( delayed, wait );
    }
    if( leadingCall ){
      isCalled = true;
      result = func.apply( thisArg, args );
    }
    if( isCalled && !timeoutId && !maxTimeoutId ){
      args = thisArg = null;
    }
    return result;
  };
};

module.exports = util;
