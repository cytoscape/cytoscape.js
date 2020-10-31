import * as is from '../is' ;
import zIndexSort from './zsort' ;
import * as util from '../util';

let elesfn = ({

  /**
 * function(ele, i, eles) [, thisArg]
 * @typedef {object} eles_forEach_callback_type
 * @property {object} ele - The current element.
 * @property {object} i - The index of the current element.
 * @property {object} eles - The collection of elements being searched.
 */

/**
 * @callback eles_forEach_callback
 * @property {eles_forEach_callback_type} function(ele,i,eles) - eles_forEach_callback_type
 */

/**
 * @typedef {object} eles_collection_forEach
 * @property {function(eles_forEach_callback):any} eles_forEach_callback - The function executed each iteration.
 * @property {object} thisArg - [optional] The value for `this` within the iterating function.
 */

/**
 * @typedef {object} eles_forEach
 * @property {eles_collection_forEach} eles_collection_forEach
 */

  /**
 * Iterate over the elements in the collection.
 * @memberof eles
 * @alias eles.each
 * @param {...eles_forEach} fn - Determine forEach function
 * @namespace eles.forEach
 */
  forEach: function( fn, thisArg ){
    if( is.fn( fn ) ){
      let N = this.length;

      for( let i = 0; i < N; i++ ){
        let ele = this[ i ];
        let ret = thisArg ? fn.apply( thisArg, [ ele, i, this ] ) : fn( ele, i, this );

        if( ret === false ){ break; } // exit each early on return false
      }
    }

    return this;
  },

  /**
 * Get the collection as an array, maintaining the order of the elements.
 * @memberof nodes
 * @namespace nodes.toArray
 */
  toArray: function(){
    let array = [];

    for( let i = 0; i < this.length; i++ ){
      array.push( this[ i ] );
    }

    return array;
  },

  /**
 * @typedef {object} eles_events_slice
 * @property {object} start - [optional] An integer that specifies where to start the selection. The first element has an index of 0. Use negative numbers to select from the end of an array.
 * @property {object} end - [optional] An integer that specifies where to end the selection. If omitted, all elements from the start position and to the end of the array will be selected. Use negative numbers to select from the end of an array.
 */

/**
 * @typedef {object} eles_slice
 * @property {eles_events_slice} eles_events_slice
 */

  /**
 * Get a subset of the elements in the collection based on specified indices.
 * @memberof eles
 * @param {...eles_slice} start - Slice
 * @namespace eles.slice
 */
  slice: function( start, end ){
    let array = [];
    let thisSize = this.length;

    if( end == null ){
      end = thisSize;
    }

    if( start == null ){
      start = 0;
    }

    if( start < 0 ){
      start = thisSize + start;
    }

    if( end < 0 ){
      end = thisSize + end;
    }

    for( let i = start; i >= 0 && i < end && i < thisSize; i++ ){
      array.push( this[ i ] );
    }

    return this.spawn( array );
  },

  /**
 * Get the number of elements in the collection.
 * @memberof eles
 * @namespace eles.size
 */
  size: function(){
    return this.length;
  },

  /**
 *  name, value
 * @typedef {object} eles_eq_index
 * @property {object} index - The index of the element to get.
 */

/**
 * @typedef {object} eles_eq
 * @property {eles_eq_index} eles_eq_index - Set a particular data field.
 * @property {object} NULL
 * @property {object} NULL
 */

  /**
 * Get an element at a particular index in the collection.
 * @memberof eles
 * @sub_functions eles.eq|eles.first|eles.last
 * @param {...eles_eq} i - Get the index of the element. | Get the first element in the collection. | Get the last element in the collection.
 * @namespace eles.eq
 */
  eq: function( i ){
    return this[ i ] || this.spawn();
  },

  first: function(){
    return this[0] || this.spawn();
  },

  last: function(){
    return this[ this.length - 1 ] || this.spawn();
  },

  /**
 * @typedef {object} eles_empty
 * @property {object} NULL
 * @property {object} NULL
 */

  /**
 * Get whether the collection is empty, meaning it has no elements.
 * @memberof eles
 * @sub_functions eles.empty|eles.nonempty
 * @param {...eles_empty} x - Get whether the collection is empty. | Get whether the collection is nonempty.
 * @namespace eles.empty
 */
  empty: function(){
    return this.length === 0;
  },

  nonempty: function(){
    return !this.empty();
  },

  /**
 * @typedef {object} eles_sort
 * @property {object} function(ele1,ele2) - Get a new collection containing the elements sorted by the specified comparison function.
 */

  /**
 * Get a new collection containing the elements sorted by the specified comparison function.
 * @memberof eles
 * @param {...eles_sort} sortFn - The sorting comparison function.
 * @namespace eles.sort
 */
  sort: function( sortFn ){
    if( !is.fn( sortFn ) ){
      return this;
    }

    let sorted = this.toArray().sort( sortFn );

    return this.spawn( sorted );
  },

  sortByZIndex: function(){
    return this.sort( zIndexSort );
  },

  zDepth: function(){
    let ele = this[0];
    if( !ele ){ return undefined; }

    // let cy = ele.cy();
    let _p = ele._private;
    let group = _p.group;

    if( group === 'nodes' ){
      let depth = _p.data.parent ? ele.parents().size() : 0;

      if( !ele.isParent() ){
        return util.MAX_INT - 1; // childless nodes always on top
      }

      return depth;
    } else {
      let src = _p.source;
      let tgt = _p.target;
      let srcDepth = src.zDepth();
      let tgtDepth = tgt.zDepth();

      return Math.max( srcDepth, tgtDepth, 0 ); // depth of deepest parent
    }
  }
});

elesfn.each = elesfn.forEach;

const defineSymbolIterator = () => {
  const typeofUndef = typeof undefined;
  const isIteratorSupported = typeof Symbol != typeofUndef && typeof Symbol.iterator != typeofUndef; // eslint-disable-line no-undef

  if (isIteratorSupported) {
    elesfn[Symbol.iterator] = function() { // eslint-disable-line no-undef
      let entry = { value: undefined, done: false };
      let i = 0;
      let length = this.length;

      return {
        next: () => {
          if ( i < length ) {
            entry.value = this[i++];
          } else {
            entry.value = undefined;
            entry.done = true;
          }

          return entry;
        },
        [Symbol.iterator]: function() { // eslint-disable-line no-undef
          return this;
        }
      };
    };
  }
};
defineSymbolIterator();

export default elesfn;
