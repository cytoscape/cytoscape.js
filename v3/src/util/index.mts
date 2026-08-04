import * as is from '../is.mjs';
import * as strings from './strings.mjs';
import * as regex from './regex.mjs';
import * as sort from './sort.mjs';
import { memoize } from './memoize.mjs';
import { extend } from './extend.mjs';
import type { Position } from '../types.mjs';

export * from './colors.mjs';
export * from './maps.mjs';
export * from './strings.mjs';
export * from './timing.mjs';
export * from './hash.mjs';
export * from './position.mjs';

export { strings, extend, extend as assign, memoize, regex, sort };

let warningsEnabled = true;
let warnSupported = console.warn != null;
let traceSupported = console.trace != null;

export const MAX_INT = Number.MAX_SAFE_INTEGER || 9007199254740991;

export const trueify = () => true;

export const falsify = () => false;

export const zeroify = () => 0;

export const noop = () => {};

export const error = ( msg: string ): never => {
  throw new Error( msg );
};

export const warnings = ( enabled?: boolean ): boolean | undefined => {
  if( enabled !== undefined ){
    warningsEnabled = !!enabled;
  } else {
    return warningsEnabled;
  }
};

export const warn = ( msg: string ): void => {
  if( !warnings() ){ return; }

  if( warnSupported ){
    console.warn( msg );
  } else {
    console.log( msg );

    if( traceSupported ){
      console.trace();
    }
  }
};

export const clone = <T,>( obj: T ): T => {
  return extend( {}, obj );
};

// gets a shallow copy of the argument
export const copy = <T,>( obj: T ): T => {
  if( obj == null ){
    return obj;
  } if( is.array( obj ) ){
    return obj.slice() as T;
  } else if( is.plainObject( obj ) ){
    return clone( obj );
  } else {
    return obj;
  }
};

export const copyArray = <T,>( arr: T[] ): T[] => {
  return arr.slice();
};

export const clonePosition = ( pos: Position ): Position => {
  return { x: pos.x, y: pos.y };
};

// any is required: the params are placeholder vars abused by the obfuscated, code-golfed uuid generator below
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const uuid = ( a?: any, b?: any /* placeholders */): string => {
    for(               // loop :)
        b=a='';        // b - result , a - numeric letiable
        a++<36;        //
        b+=a*51&52  // if "a" is not 9 or 14 or 19 or 24
                    ?  //  return a random number or 4
           (
             a^15      // if "a" is not 15
                ?      // generate a random number from 0 to 15
             8^Math.random()*
             (a^20?16:4)  // unless "a" is 20, in which case a random number from 8 to 11
                :
             4            //  otherwise 4
             ).toString(16)
                    :
           '-'            //  in other cases (if "a" is 9,14,19,24) insert "-"
        );
    return b;
};

const _staticEmptyObject = {};

export const staticEmptyObject = () => _staticEmptyObject;

export const defaults = <D extends Record<string, unknown>,>( defaults: D ) => {
  let keys = Object.keys( defaults ) as ( keyof D )[];

  return ( opts?: Partial<D> | null ): D => {
    let filledOpts = {} as D;

    for( let i = 0; i < keys.length; i++ ){
      let key = keys[i];
      let optVal = opts == null ? undefined : opts[key];

      filledOpts[key] = optVal === undefined ? defaults[key] : optVal;
    }

    return filledOpts;
  };
};

export const removeFromArray = <T,>( arr: T[], ele: T, oneCopy?: boolean ): void => {
  for( let i = arr.length - 1; i >= 0; i-- ){
    if( arr[i] === ele ){
      arr.splice( i, 1 );

      if( oneCopy ){ break; }
    }
  }
};

export const clearArray = <T,>( arr: T[] ): void => {
  arr.splice( 0, arr.length );
};

export const push = <T,>( arr: T[], otherArr: ArrayLike<T> ): void => {
  for( let i = 0; i < otherArr.length; i++ ){
    let el = otherArr[i];

    arr.push( el );
  }
};

export const getPrefixedProperty = ( obj: Record<string, unknown>, propName: string, prefix?: string | null ): unknown => {
  if( prefix ){
    propName = strings.prependCamel( prefix, propName ); // e.g. (labelWidth, source) => sourceLabelWidth
  }

  return obj[ propName ];
};

export const setPrefixedProperty = ( obj: Record<string, unknown>, propName: string, prefix: string | null | undefined, value: unknown ): void => {
  if( prefix ){
    propName = strings.prependCamel( prefix, propName ); // e.g. (labelWidth, source) => sourceLabelWidth
  }

  obj[ propName ] = value;
};
