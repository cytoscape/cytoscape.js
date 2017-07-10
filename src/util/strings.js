let memoize = require( './memoize' );
let is = require( '../is' );

module.exports = {

  camel2dash: memoize( function( str ){
    return str.replace( /([A-Z])/g, function( v ){
      return '-' + v.toLowerCase();
    } );
  } ),

  dash2camel: memoize( function( str ){
    return str.replace( /(-\w)/g, function( v ){
      return v[1].toUpperCase();
    } );
  } ),

  prependCamel: memoize( function( prefix, str ){
    return prefix + str[0].toUpperCase() + str.substring(1);
  }, function( prefix, str ){
    return prefix + '$' + str;
  } ),

  capitalize: function( str ){
    if( is.emptyString( str ) ){
      return str;
    }

    return str.charAt( 0 ).toUpperCase() + str.substring( 1 );
  }

};
