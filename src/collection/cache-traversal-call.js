let is = require( '../is' );

let cache = function( fn, name ){
  return function traversalCache( arg1, arg2, arg3, arg4 ){
    let selectorOrEles = arg1;
    let eles = this;
    let key;

    if( selectorOrEles == null ){
      key = 'null';
    } else if( is.elementOrCollection( selectorOrEles ) && selectorOrEles.length === 1 ){
      key = '#' + selectorOrEles.id();
    }

    if( eles.length === 1 && key ){
      let _p = eles[0]._private;
      let tch = _p.traversalCache = _p.traversalCache || {};
      let ch = tch[ name ] = tch[ name ] || {};
      let cacheHit = ch[ key ];

      if( cacheHit ){
        return cacheHit;
      } else {
        return ( ch[ key ] = fn.call( eles, arg1, arg2, arg3, arg4 ) );
      }
    } else {
      return fn.call( eles, arg1, arg2, arg3, arg4 );
    }
  };
};

module.exports = cache;
