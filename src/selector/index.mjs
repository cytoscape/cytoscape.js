import * as is from '../is.mjs';
import * as util from '../util/index.mjs';

import parse from './parse.mjs';
import matching from './matching.mjs';
import Type from './type.mjs';

let Selector = function( selector ){
  this.inputText = selector;
  this.currentSubject = null;
  this.compoundCount = 0;
  this.edgeCount = 0;
  this.length = 0;

  if( selector == null || ( is.string( selector ) && selector.match( /^\s*$/ ) ) ){
    // leave empty

  } else if( is.elementOrCollection( selector ) ){

    this.addQuery({
      checks: [ {
        type: Type.COLLECTION,
        value: selector.collection()
      } ]
    });

  } else if( is.fn( selector ) ){

    this.addQuery({
      checks: [ {
        type: Type.FILTER,
        value: selector
      } ]
    });

  } else if( is.string( selector ) ){
    if( !this.parse( selector ) ){
      this.invalid = true;
    }

  } else {
    util.error( 'A selector must be created from a string; found ', selector );
  }
};

let selfn = Selector.prototype;

// Copy the mixins by defining their properties rather than assigning them.  When
// Object.prototype is frozen (a hardening against prototype pollution), assigning
// `toString` throws because the inherited property is read-only (the "override mistake").
// Same keys as Object.assign: own enumerable string keys, then own enumerable symbols.
let ownEnumerableKeys = obj => {
  let keys = Object.keys( obj );

  if( Object.getOwnPropertySymbols != null ){
    keys = keys.concat( Object.getOwnPropertySymbols( obj ).filter( sym => Object.prototype.propertyIsEnumerable.call( obj, sym ) ) );
  }

  return keys;
};

[
  parse,
  matching
].forEach( p => ownEnumerableKeys( p ).forEach( k => Object.defineProperty( selfn, k, {
  value: p[ k ],
  writable: true,
  enumerable: true,
  configurable: true
} ) ) );

selfn.text = function(){
  return this.inputText;
};

selfn.size = function(){
  return this.length;
};

selfn.eq = function( i ){
  return this[ i ];
};

selfn.sameText = function( otherSel ){
  return !this.invalid && !otherSel.invalid && this.text() === otherSel.text();
};

selfn.addQuery = function( q ){
  this[ this.length++ ] = q;
};

selfn.selector = selfn.toString;

export default Selector;
