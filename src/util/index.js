/*global console */

let is = require( '../is' );
let math = require( '../math' );

let util = {

  MAX_INT: Number.MAX_SAFE_INTEGER || 9007199254740991,

  trueify: function(){ return true; },

  falsify: function(){ return false; },

  zeroify: function(){ return 0; },

  noop: function(){},

  error: function( msg ){
    /* eslint-disable */
    if( console.error ){
      console.error.apply( console, arguments );

      if( console.trace ){ console.trace(); }
    } else {
      console.log.apply( console, arguments );

      if( console.trace ){ console.trace(); }
    }
    /* eslint-enable */
  },

  clone: function( obj ){
    return this.extend( {}, obj );
  },

  // gets a shallow copy of the argument
  copy: function( obj ){
    if( obj == null ){
      return obj;
    } if( is.array( obj ) ){
      return obj.slice();
    } else if( is.plainObject( obj ) ){
      return this.clone( obj );
    } else {
      return obj;
    }
  },

  copyArray: function( arr ){
    return arr.slice();
  },

  clonePosition: function( pos ){
    return { x: pos.x, y: pos.y };
  },

  uuid: function(
      a,b                // placeholders
  ){
      for(               // loop :)
          b=a='';        // b - result , a - numeric letiable
          a++<36;        //
          b+=a*51&52  // if "a" is not 9 or 14 or 19 or 24
                      ?  //  return a random number or 4
             (
               a^15      // if "a" is not 15
                  ?      // genetate a random number from 0 to 15
               8^Math.random()*
               (a^20?16:4)  // unless "a" is 20, in which case a random number from 8 to 11
                  :
               4            //  otherwise 4
               ).toString(16)
                      :
             '-'            //  in other cases (if "a" is 9,14,19,24) insert "-"
          );
      return b;
  }

};

util.makeBoundingBox = math.makeBoundingBox.bind( math );

util._staticEmptyObject = {};

util.staticEmptyObject = function(){
  return util._staticEmptyObject;
};

util.extend = Object.assign != null ? Object.assign.bind( Object ) : function( tgt ){
  let args = arguments;

  for( let i = 1; i < args.length; i++ ){
    let obj = args[ i ];

    if( obj == null ){ continue; }

    let keys = Object.keys( obj );

    for( let j = 0; j < keys.length; j++ ){
      let k = keys[j];

      tgt[ k ] = obj[ k ];
    }
  }

  return tgt;
};

util.assign = util.extend;

util.default = function( val, def ){
  if( val === undefined ){
    return def;
  } else {
    return val;
  }
};

util.removeFromArray = function( arr, ele, manyCopies ){
  for( let i = arr.length; i >= 0; i-- ){
    if( arr[i] === ele ){
      arr.splice( i, 1 );

      if( !manyCopies ){ break; }
    }
  }
};

util.clearArray = function( arr ){
  arr.splice( 0, arr.length );
};

util.push = function( arr, otherArr ){
  for( let i = 0; i < otherArr.length; i++ ){
    let el = otherArr[i];

    arr.push( el );
  }
};

util.getPrefixedProperty = function( obj, propName, prefix ){
  if( prefix ){
    propName = this.prependCamel( prefix, propName ); // e.g. (labelWidth, source) => sourceLabelWidth
  }

  return obj[ propName ];
};

util.setPrefixedProperty = function( obj, propName, prefix, value ){
  if( prefix ){
    propName = this.prependCamel( prefix, propName ); // e.g. (labelWidth, source) => sourceLabelWidth
  }

  obj[ propName ] = value;
};

[
  require( './colors' ),
  require( './maps' ),
  { memoize: require( './memoize' ) },
  require( './regex' ),
  require( './strings' ),
  require( './timing' ),
  require( './sort' )
].forEach( function( req ){
  util.extend( util, req );
} );

module.exports = util;
