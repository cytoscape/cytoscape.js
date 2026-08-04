import * as is from '../is.mjs';
import * as util from '../util/index.mjs';

import parse from './parse.mjs';
import matching from './matching.mjs';
import Type from './type.mjs';
import type { FilterFn, Query, SelectorCollection, SelectorEle } from './type.mjs';
import type { CollectionShim } from '../types.mjs';

/** What a Selector may be constructed from */
export type SelectorInput = string | CollectionShim | FilterFn | null | undefined;

// n.b. `Selector` is only ever `new`-constructed across the codebase, so it is
// safe as a class; the parse/matching methods are mixed onto the prototype
// below and `declare`d here for typing
class Selector {
  // parsed queries are stored array-style on the selector itself
  [ index: number ]: Query;

  inputText: SelectorInput;
  currentSubject: Query | null;
  compoundCount: number;
  edgeCount: number;
  length: number;
  invalid?: boolean;
  toStringCache?: string | null;

  constructor( selector?: SelectorInput ){
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
          // duck-typing boundary: the collection shim doesn't model collection()
          value: ( selector as unknown as SelectorCollection ).collection()
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
      // the extra arg has always been ignored by util.error (it throws just the msg); kept for fidelity
      ( util.error as ( msg: string, extra?: unknown ) => never )( 'A selector must be created from a string; found ', selector );
    }
  }

  // assigned onto the prototype below (mixins and prototype methods); declared here for typing
  declare parse: ( selector: string ) => boolean;
  declare toString: () => string;
  declare matches: ( ele: SelectorEle ) => boolean;
  declare filter: ( collection: SelectorCollection ) => SelectorCollection;
  declare text: () => SelectorInput;
  declare size: () => number;
  declare eq: ( i: number ) => Query;
  declare sameText: ( otherSel: Selector ) => boolean;
  declare addQuery: ( q: Query ) => void;
  declare selector: () => string;
}

let selfn = Selector.prototype;

[
  parse,
  matching
].forEach( p => util.assign( selfn, p ) );

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
