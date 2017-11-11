/*global HTMLElement DocumentTouch */

import window from './window';
let navigator = window ? window.navigator : null;
let document = window ? window.document : null;

let typeofstr = typeof '';
let typeofobj = typeof {};
let typeoffn = typeof function(){};
let typeofhtmlele = typeof HTMLElement;

let instanceStr = function( obj ){
  return obj && obj.instanceString && fn( obj.instanceString ) ? obj.instanceString() : null;
};

export function defined( obj ){
  return obj != null; // not undefined or null
}

export function string( obj ){
  return obj != null && typeof obj == typeofstr;
}

export function fn( obj ){
  return obj != null && typeof obj === typeoffn;
}

export function array( obj ){
  return Array.isArray ? Array.isArray( obj ) : obj != null && obj instanceof Array;
}

export function plainObject( obj ){
  return obj != null && typeof obj === typeofobj && !array( obj ) && obj.constructor === Object;
}

export function object( obj ){
  return obj != null && typeof obj === typeofobj;
}

export function number( obj ){
  return obj != null && typeof obj === typeof 1 && !isNaN( obj );
}

export function integer( obj ){
  return number( obj ) && Math.floor( obj ) === obj;
}

export function bool( obj ){
  return obj != null && typeof obj === typeof true;
}

export function htmlElement( obj ){
  if( 'undefined' === typeofhtmlele ){
    return undefined;
  } else {
    return null != obj && obj instanceof HTMLElement;
  }
}

export function elementOrCollection( obj ){
  return element( obj ) || collection( obj );
}

export function element( obj ){
  return instanceStr( obj ) === 'collection' && obj._private.single;
}

export function collection( obj ){
  return instanceStr( obj ) === 'collection' && !obj._private.single;
}

export function core( obj ){
  return instanceStr( obj ) === 'core';
}

export function style( obj ){
  return instanceStr( obj ) === 'style';
}

export function stylesheet( obj ){
  return instanceStr( obj ) === 'stylesheet';
}

export function event( obj ){
  return instanceStr( obj ) === 'event';
}

export function thread( obj ){
  return instanceStr( obj ) === 'thread';
}

export function fabric( obj ){
  return instanceStr( obj ) === 'fabric';
}

export function emptyString( obj ){
  if( obj === undefined || obj === null ){ // null is empty
    return true;
  } else if( obj === '' || obj.match( /^\s+$/ ) ){
    return true; // empty string is empty
  }

  return false; // otherwise, we don't know what we've got
}

export function nonemptyString( obj ){
  if( obj && string( obj ) && obj !== '' && !obj.match( /^\s+$/ ) ){
    return true;
  }

  return false;
}

export function domElement( obj ){
  if( typeof HTMLElement === 'undefined' ){
    return false; // we're not in a browser so it doesn't matter
  } else {
    return obj instanceof HTMLElement;
  }
}

export function boundingBox( obj ){
  return plainObject( obj ) &&
    number( obj.x1 ) && number( obj.x2 ) &&
    number( obj.y1 ) && number( obj.y2 )
  ;
}

export function promise( obj ){
  return object( obj ) && fn( obj.then );
}

export function touch(){
  return window && ( ('ontouchstart' in window) || window.DocumentTouch && document instanceof DocumentTouch );
}

export function gecko(){
  return window && ( typeof InstallTrigger !== 'undefined' || ('MozAppearance' in document.documentElement.style) );
}

export function webkit(){
  return window && ( typeof webkitURL !== 'undefined' || ('WebkitAppearance' in document.documentElement.style) );
}

export function chromium(){
  return window && ( typeof chrome !== 'undefined' );
}

export function khtml(){
  return navigator && navigator.vendor.match( /kde/i ); // probably a better way to detect this...
}

export function khtmlEtc(){
  return khtml() || webkit() || chromium();
}

export function ms(){
  return navigator && navigator.userAgent.match( /msie|trident|edge/i ); // probably a better way to detect this...
}

export function windows(){
  return navigator && navigator.appVersion.match( /Win/i );
}

export function mac(){
  return navigator && navigator.appVersion.match( /Mac/i );
}

export function linux(){
  return navigator && navigator.appVersion.match( /Linux/i );
}

export function unix(){
  return navigator && navigator.appVersion.match( /X11/i );
}
