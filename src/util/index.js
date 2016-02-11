'use strict';

var is = require( '../is' );
var math = require( '../math' );

var util = {

  falsify: function(){ return false; },

  zeroify: function(){ return 0; },

  noop: function(){},

  /* jshint ignore:start */
  error: function( msg ){
    if( console.error ){
      console.error.apply( console, arguments );

      if( console.trace ){ console.trace(); }
    } else {
      console.log.apply( console, arguments );

      if( console.trace ){ console.trace(); }
    }
  },
  /* jshint ignore:end */

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
  }

};

util.makeBoundingBox = math.makeBoundingBox.bind( math );

util._staticEmptyObject = {};

util.staticEmptyObject = function(){
  return util._staticEmptyObject;
};

util.extend = Object.assign != null ? Object.assign : function( tgt ){
  var args = arguments;

  for( var i = 1; i < args.length; i++ ){
    var obj = args[ i ];

    for( var k in obj ){
      tgt[ k ] = obj[ k ];
    }
  }

  return tgt;
};

util.removeFromArray = function( arr, ele, manyCopies ){
  for( var i = arr.length; i >= 0; i-- ){
    if( arr[i] === ele ){
      arr.splice( i, 1 );

      if( !manyCopies ){ break; }
    }
  }
};

util.clearArray = function( arr ){
  arr.splice( 0, arr.length );
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
  require( './timing' )
].forEach( function( req ){
  util.extend( util, req );
} );

module.exports = util;
