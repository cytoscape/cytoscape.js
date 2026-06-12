import * as is from '../is.mjs';
import { memoize } from './memoize.mjs';

export const camel2dash = memoize(( str: string ) => {
  return str.replace( /([A-Z])/g, v => {
    return '-' + v.toLowerCase();
  } );
});

export const dash2camel = memoize(( str: string ) => {
  return str.replace( /(-\w)/g, v => {
    return v[1].toUpperCase();
  } );
});

export const prependCamel = memoize(( prefix: string, str: string ) => {
  return prefix + str[0].toUpperCase() + str.substring(1);
}, ( prefix, str ) => {
  return prefix + '$' + str;
});

export const capitalize = ( str: string ): string => {
  if( is.emptyString( str ) ){
    return str;
  }

  return str.charAt( 0 ).toUpperCase() + str.substring( 1 );
};


export const endsWith = (string: string, suffix: string): boolean => string.slice(-1 * suffix.length) === suffix;
