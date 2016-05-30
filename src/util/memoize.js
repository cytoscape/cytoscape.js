'use strict';

module.exports = function memoize( fn, keyFn ){
  var cache = {};

  if( !keyFn ){
    keyFn = function(){
      if( arguments.length === 1 ){
        return arguments[0];
      } else if( arguments.length === 0 ){
        return 'undefined';
      }

      var args = [];

      for( var i = 0; i < arguments.length; i++ ){
        args.push( arguments[ i ] );
      }

      return args.join( '$' );
    };
  }

  return function memoizedFn(){
    var self = this;
    var args = arguments;
    var ret;
    var k = keyFn.apply( self, args );

    if( !(ret = cache[ k ]) ){
      ret = cache[ k ] = fn.apply( self, args );
    }

    return ret;
  };
};
