import window from './window.mjs';
import type Event from './event.mjs';
import type { BoundingBox12, CollectionShim, CoreShim, ElementShim } from './types.mjs';

let navigator = window ? window.navigator : null;
let document = window ? window.document : null;

let typeofstr = typeof '';
let typeofobj = typeof {};
let typeoffn = typeof function(){};
let typeofhtmlele = typeof HTMLElement;

// names probed with `typeof` for browser sniffing; never defined by us
declare const InstallTrigger: unknown;
declare const webkitURL: unknown;
declare const chrome: unknown;

interface InstanceStringable {
  instanceString(): string;
}

let instanceStr = function( obj: unknown ): string | null {
  let o = obj as Partial<InstanceStringable> | null | undefined;

  return o && o.instanceString && fn( o.instanceString ) ? o.instanceString() : null;
};

export const defined = <T,>( obj: T ): obj is NonNullable<T> =>
  obj != null; // not undefined or null

export const string = ( obj: unknown ): obj is string =>
  obj != null && typeof obj == typeofstr;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const fn = ( obj: unknown ): obj is ( ...args: any[] ) => any =>
  obj != null && typeof obj === typeoffn;

export const array = ( obj: unknown ): obj is unknown[] =>
  !(elementOrCollection(obj)) && (Array.isArray ? Array.isArray( obj ) : obj != null && obj instanceof Array);

export const plainObject = ( obj: unknown ): obj is Record<string, unknown> =>
  obj != null && typeof obj === typeofobj && !array( obj ) && ( obj as object ).constructor === Object;

export const object = ( obj: unknown ): obj is object =>
  obj != null && typeof obj === typeofobj;

export const number = ( obj: unknown ): obj is number =>
  obj != null && typeof obj === typeof 1 && !isNaN( obj as number );

export const integer = ( obj: unknown ): obj is number =>
  number( obj ) && Math.floor( obj ) === obj;

export const bool = ( obj: unknown ): obj is boolean =>
  obj != null && typeof obj === typeof true;

export const htmlElement = ( obj: unknown ): boolean | undefined => {
  if( 'undefined' === typeofhtmlele ){
    return undefined;
  } else {
    return null != obj && obj instanceof HTMLElement;
  }
};

export const elementOrCollection = ( obj: unknown ): obj is CollectionShim =>
  element( obj ) || collection( obj );

export const element = ( obj: unknown ): obj is ElementShim =>
  instanceStr( obj ) === 'collection' && ( obj as ElementShim )._private.single;

export const collection = ( obj: unknown ): obj is CollectionShim =>
  instanceStr( obj ) === 'collection' && !( obj as CollectionShim )._private.single;

export const core = ( obj: unknown ): obj is CoreShim =>
  instanceStr( obj ) === 'core';

export const style = ( obj: unknown ): boolean =>
  instanceStr( obj ) === 'style';

export const stylesheet = ( obj: unknown ): boolean =>
  instanceStr( obj ) === 'stylesheet';

export const event = ( obj: unknown ): obj is Event =>
  instanceStr( obj ) === 'event';

export const thread = ( obj: unknown ): boolean =>
  instanceStr( obj ) === 'thread';

export const fabric = ( obj: unknown ): boolean =>
  instanceStr( obj ) === 'fabric';

export const emptyString = ( obj: string | null | undefined ): boolean => {
  if( obj === undefined || obj === null ){ // null is empty
    return true;
  } else if( obj === '' || obj.match( /^\s+$/ ) ){
    return true; // empty string is empty
  }

  return false; // otherwise, we don't know what we've got
};

export const nonemptyString = ( obj: unknown ): obj is string => {
  if( obj && string( obj ) && obj !== '' && !obj.match( /^\s+$/ ) ){
    return true;
  }

  return false;
};

export const domElement = ( obj: unknown ): obj is HTMLElement => {
  if( typeof HTMLElement === 'undefined' ){
    return false; // we're not in a browser so it doesn't matter
  } else {
    return obj instanceof HTMLElement;
  }
};

export const boundingBox = ( obj: unknown ): obj is BoundingBox12 =>
  plainObject( obj ) &&
    number( obj.x1 ) && number( obj.x2 ) &&
    number( obj.y1 ) && number( obj.y2 )
  ;

export const promise = ( obj: unknown ): obj is Promise<unknown> =>
  object( obj ) && fn( ( obj as { then?: unknown } ).then );

// deprecated browser API not in lib.dom; only ever read off `window`
const DocumentTouch = window ? ( window as { DocumentTouch?: new () => unknown } ).DocumentTouch : undefined;

export const touch = () =>
  window && ( ('ontouchstart' in window) || ( DocumentTouch && document instanceof DocumentTouch ) );

export const gecko = () =>
  window && ( typeof InstallTrigger !== 'undefined' || ('MozAppearance' in document!.documentElement.style) );

export const webkit = () =>
  window && ( typeof webkitURL !== 'undefined' || ('WebkitAppearance' in document!.documentElement.style) );

export const chromium = () =>
  window && ( typeof chrome !== 'undefined' );

export const khtml = () =>
  navigator && navigator.vendor.match( /kde/i ); // probably a better way to detect this...

export const khtmlEtc = () =>
  khtml() || webkit() || chromium();

export const ms = () =>
  navigator && navigator.userAgent.match( /msie|trident|edge/i ); // probably a better way to detect this...

export const windows = () =>
  navigator && navigator.appVersion.match( /Win/i );

export const mac = () =>
  navigator && navigator.appVersion.match( /Mac/i );

export const linux = () =>
  navigator && navigator.appVersion.match( /Linux/i );

export const unix = () =>
  navigator && navigator.appVersion.match( /X11/i );
