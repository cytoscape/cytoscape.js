/*global HTMLElement DocumentTouch */

let window = require( './window' );
let navigator = window ? window.navigator : null;
let document = window ? window.document : null;

let typeofstr = typeof '';
let typeofobj = typeof {};
let typeoffn = typeof function(){};
let typeofhtmlele = typeof HTMLElement;

let instanceStr = function( obj ){
  return obj && obj.instanceString && is.fn( obj.instanceString ) ? obj.instanceString() : null;
};

let is = {
  defined: function( obj ){
    return obj != null; // not undefined or null
  },

  string: function( obj ){
    return obj != null && typeof obj == typeofstr;
  },

  fn: function( obj ){
    return obj != null && typeof obj === typeoffn;
  },

  array: function( obj ){
    return Array.isArray ? Array.isArray( obj ) : obj != null && obj instanceof Array;
  },

  plainObject: function( obj ){
    return obj != null && typeof obj === typeofobj && !is.array( obj ) && obj.constructor === Object;
  },

  object: function( obj ){
    return obj != null && typeof obj === typeofobj;
  },

  number: function( obj ){
    return obj != null && typeof obj === typeof 1 && !isNaN( obj );
  },

  integer: function( obj ){
    return is.number( obj ) && Math.floor( obj ) === obj;
  },

  bool: function( obj ){
    return obj != null && typeof obj === typeof true;
  },

  htmlElement: function( obj ){
    if( 'undefined' === typeofhtmlele ){
      return undefined;
    } else {
      return null != obj && obj instanceof HTMLElement;
    }
  },

  elementOrCollection: function( obj ){
    return is.element( obj ) || is.collection( obj );
  },

  element: function( obj ){
    return instanceStr( obj ) === 'collection' && obj._private.single;
  },

  collection: function( obj ){
    return instanceStr( obj ) === 'collection' && !obj._private.single;
  },

  core: function( obj ){
    return instanceStr( obj ) === 'core';
  },

  style: function( obj ){
    return instanceStr( obj ) === 'style';
  },

  stylesheet: function( obj ){
    return instanceStr( obj ) === 'stylesheet';
  },

  event: function( obj ){
    return instanceStr( obj ) === 'event';
  },

  thread: function( obj ){
    return instanceStr( obj ) === 'thread';
  },

  fabric: function( obj ){
    return instanceStr( obj ) === 'fabric';
  },

  emptyString: function( obj ){
    if( obj === undefined || obj === null ){ // null is empty
      return true;
    } else if( obj === '' || obj.match( /^\s+$/ ) ){
      return true; // empty string is empty
    }

    return false; // otherwise, we don't know what we've got
  },

  nonemptyString: function( obj ){
    if( obj && is.string( obj ) && obj !== '' && !obj.match( /^\s+$/ ) ){
      return true;
    }

    return false;
  },

  domElement: function( obj ){
    if( typeof HTMLElement === 'undefined' ){
      return false; // we're not in a browser so it doesn't matter
    } else {
      return obj instanceof HTMLElement;
    }
  },

  boundingBox: function( obj ){
    return is.plainObject( obj ) &&
      is.number( obj.x1 ) && is.number( obj.x2 ) &&
      is.number( obj.y1 ) && is.number( obj.y2 )
    ;
  },

  promise: function( obj ){
    return is.object( obj ) && is.fn( obj.then );
  },

  touch: function(){
    return window && ( ('ontouchstart' in window) || window.DocumentTouch && document instanceof DocumentTouch );
  },

  gecko: function(){
    return window && ( typeof InstallTrigger !== 'undefined' || ('MozAppearance' in document.documentElement.style) );
  },

  webkit: function(){
    return window && ( typeof webkitURL !== 'undefined' || ('WebkitAppearance' in document.documentElement.style) );
  },

  chromium: function(){
    return window && ( typeof chrome !== 'undefined' );
  },

  khtml: function(){
    return navigator && navigator.vendor.match( /kde/i ); // probably a better way to detect this...
  },

  khtmlEtc: function(){
    return is.khtml() || is.webkit() || is.chromium();
  },

  ms: function(){
    return navigator && navigator.userAgent.match( /msie|trident|edge/i ); // probably a better way to detect this...
  },

  windows: function(){
    return navigator && navigator.appVersion.match( /Win/i );
  },

  mac: function(){
    return navigator && navigator.appVersion.match( /Mac/i );
  },

  linux: function(){
    return navigator && navigator.appVersion.match( /Linux/i );
  },

  unix: function(){
    return navigator && navigator.appVersion.match( /X11/i );
  }
};

module.exports = is;
