import memoize from './memoize';
import * as is from '../is';

export var camel2dash = memoize( function( str ){
  return str.replace( /([A-Z])/g, function( v ){
    return '-' + v.toLowerCase();
  } );
} );

export var dash2camel = memoize( function( str ){
  return str.replace( /(-\w)/g, function( v ){
    return v[1].toUpperCase();
  } );
} );

export var prependCamel = memoize( function( prefix, str ){
  return prefix + str[0].toUpperCase() + str.substring(1);
}, function( prefix, str ){
  return prefix + '$' + str;
} );

export function capitalize( str ){
  if( is.emptyString( str ) ){
    return str;
  }

  return str.charAt( 0 ).toUpperCase() + str.substring( 1 );
}
