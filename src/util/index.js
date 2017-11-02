/*global console */

import * as is from '../is';
import * as math from '../math';
import * as strings from './strings';

export * from './colors';
export * from './maps';
export { default as memoize } from './memoize';
export * from './regex';
export * from './strings';
export * from './timing';
export * from './sort';

export var MAX_INT = Number.MAX_SAFE_INTEGER || 9007199254740991;

export function trueify(){ return true; }

export function falsify(){ return false; }

export function zeroify(){ return 0; }

export function noop(){}

export function error( msg ){
  /* eslint-disable */
  if( console.error ){
    console.error.apply( console, arguments );

    if( console.trace ){ console.trace(); }
  } else {
    console.log.apply( console, arguments );

    if( console.trace ){ console.trace(); }
  }
  /* eslint-enable */
}

export function clone( obj ){
  return extend( {}, obj );
}

// gets a shallow copy of the argument
export function copy( obj ){
  if( obj == null ){
    return obj;
  } if( is.array( obj ) ){
    return obj.slice();
  } else if( is.plainObject( obj ) ){
    return clone( obj );
  } else {
    return obj;
  }
}

export function copyArray( arr ){
  return arr.slice();
}

export function clonePosition( pos ){
  return { x: pos.x, y: pos.y };
}

export function uuid(
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

export var makeBoundingBox = math.makeBoundingBox.bind( math );

export var _staticEmptyObject = {};

export function staticEmptyObject(){
  return _staticEmptyObject;
}

export var extend = Object.assign != null ? Object.assign.bind( Object ) : function( tgt ){
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

export var assign = extend;

// TODO rename to not conflict reserved word
export default function _default( val, def ){
  if( val === undefined ){
    return def;
  } else {
    return val;
  }
}

export function removeFromArray( arr, ele, manyCopies ){
  for( let i = arr.length; i >= 0; i-- ){
    if( arr[i] === ele ){
      arr.splice( i, 1 );

      if( !manyCopies ){ break; }
    }
  }
}

export function clearArray( arr ){
  arr.splice( 0, arr.length );
}

export function push( arr, otherArr ){
  for( let i = 0; i < otherArr.length; i++ ){
    let el = otherArr[i];

    arr.push( el );
  }
};

export function getPrefixedProperty( obj, propName, prefix ){
  if( prefix ){
    propName = strings.prependCamel( prefix, propName ); // e.g. (labelWidth, source) => sourceLabelWidth
  }

  return obj[ propName ];
}

export function setPrefixedProperty( obj, propName, prefix, value ){
  if( prefix ){
    propName = strings.prependCamel( prefix, propName ); // e.g. (labelWidth, source) => sourceLabelWidth
  }

  obj[ propName ] = value;
}
