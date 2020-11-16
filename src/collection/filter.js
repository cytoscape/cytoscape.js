import * as is from '../is';
import Selector from '../selector';

let elesfn = ({
  nodes: function( selector ){
    return this.filter( ele => ele.isNode() ).filter( selector );
  },

  edges: function( selector ){
    return this.filter( ele => ele.isEdge() ).filter( selector );
  },

  // internal helper to get nodes and edges as separate collections with single iteration over elements
  byGroup: function(){
    let nodes = this.spawn();
    let edges = this.spawn();

    for( let i = 0; i < this.length; i++ ){
      let ele = this[i];

      if( ele.isNode() ){
        nodes.merge(ele);
      } else {
        edges.merge(ele);
      }
    }

    return { nodes, edges };
  },

  filter: function( filter, thisArg ){
    if( filter === undefined ){ // check this first b/c it's the most common/performant case
      return this;
    } else if( is.string( filter ) || is.elementOrCollection( filter ) ){
      return new Selector( filter ).filter( this );
    } else if( is.fn( filter ) ){
      let filterEles = this.spawn();
      let eles = this;

      for( let i = 0; i < eles.length; i++ ){
        let ele = eles[ i ];
        let include = thisArg ? filter.apply( thisArg, [ ele, i, eles ] ) : filter( ele, i, eles );

        if( include ){
          filterEles.merge( ele );
        }
      }

      return filterEles;
    }

    return this.spawn(); // if not handled by above, give 'em an empty collection
  },

  not: function( toRemove ){
    if( !toRemove ){
      return this;
    } else {

      if( is.string( toRemove ) ){
        toRemove = this.filter( toRemove );
      }

      let elements = [];
      let rMap = toRemove._private.map;

      for( let i = 0; i < this.length; i++ ){
        let element = this[ i ];

        let remove = rMap.has( element.id() );
        if( !remove ){
          elements.push( element );
        }
      }

      return this.spawn( elements );
    }

  },

  /**
 * Get all elements in the graph that are not in the calling collection.
 * @memberof nodes
 * @alias eles.abscomp|eles.complement
 * @namespace nodes.absoluteComplement
 */
  absoluteComplement: function(){
    let cy = this.cy();

    return cy.mutableElements().not( this );
  },

  intersect: function( other ){
    // if a selector is specified, then filter by it instead
    if( is.string( other ) ){
      let selector = other;
      return this.filter( selector );
    }

    let elements = [];
    let col1 = this;
    let col2 = other;
    let col1Smaller = this.length < other.length;
    let map2 = col1Smaller ? col2._private.map : col1._private.map;
    let col = col1Smaller ? col1 : col2;

    for( let i = 0; i < col.length; i++ ){
      let id = col[ i ]._private.data.id;
      let entry = map2.get( id );

      if( entry ){
        elements.push( entry.ele );
      }
    }

    return this.spawn( elements );
  },

  xor: function( other ){
    let cy = this._private.cy;

    if( is.string( other ) ){
      other = cy.$( other );
    }

    let elements = [];
    let col1 = this;
    let col2 = other;

    let add = function( col, other ){
      for( let i = 0; i < col.length; i++ ){
        let ele = col[ i ];
        let id = ele._private.data.id;
        let inOther = other.hasElementWithId( id );

        if( !inOther ){
          elements.push( ele );
        }
      }

    };

    add( col1, col2 );
    add( col2, col1 );

    return this.spawn( elements );
  },

  /**
 * @typedef {object} eles_diff
 * @property {object} eles - The elements on the right side of the diff.
 * @property {object} selector - A selector representing the elements on the right side of the diff. All elements in the graph matching the selector are used as the passed collection.
 */

/**
 * Perform a traditional left/right diff on the two collections.
 * @memberof eles
 * @param {...eles_diff} other - diff Event | diff Event
 * @namespace eles.diff
 */
  diff: function( other ){
    let cy = this._private.cy;

    if( is.string( other ) ){
      other = cy.$( other );
    }

    let left = [];
    let right = [];
    let both = [];
    let col1 = this;
    let col2 = other;

    let add = function( col, other, retEles ){

      for( let i = 0; i < col.length; i++ ){
        let ele = col[ i ];
        let id = ele._private.data.id;
        let inOther = other.hasElementWithId( id );

        if( inOther ){
          both.push( ele );
        } else {
          retEles.push( ele );
        }
      }

    };

    add( col1, col2, left );
    add( col2, col1, right );

    return {
      left: this.spawn( left, { unique: true } ),
      right: this.spawn( right, { unique: true } ),
      both: this.spawn( both, { unique: true } )
    };
  },

  add: function( toAdd ){
    let cy = this._private.cy;

    if( !toAdd ){
      return this;
    }

    if( is.string( toAdd ) ){
      let selector = toAdd;
      toAdd = cy.mutableElements().filter( selector );
    }

    let elements = [];

    for( let i = 0; i < this.length; i++ ){
      elements.push( this[ i ] );
    }

    let map = this._private.map;

    for( let i = 0; i < toAdd.length; i++ ){

      let add = !map.has( toAdd[ i ].id() );
      if( add ){
        elements.push( toAdd[ i ] );
      }
    }

    return this.spawn( elements );
  },

  // in place merge on calling collection
  merge: function( toAdd ){
    let _p = this._private;
    let cy = _p.cy;

    if( !toAdd ){
      return this;
    }

    if( toAdd && is.string( toAdd ) ){
      let selector = toAdd;
      toAdd = cy.mutableElements().filter( selector );
    }

    let map = _p.map;

    for( let i = 0; i < toAdd.length; i++ ){
      let toAddEle = toAdd[ i ];
      let id = toAddEle._private.data.id;
      let add = !map.has( id );

      if( add ){
        let index = this.length++;

        this[ index ] = toAddEle;

        map.set( id, { ele: toAddEle, index: index } );
      } else { // replace
        let index = map.get( id ).index;

        this[ index ] = toAddEle;
        map.set( id, { ele: toAddEle, index: index } );
      }
    }

    return this; // chaining
  },

  unmergeAt: function( i ){
    let ele = this[i];
    let id = ele.id();
    let _p = this._private;
    let map = _p.map;

    // remove ele
    this[ i ] = undefined;
    map.delete( id );

    let unmergedLastEle = i === this.length - 1;

    // replace empty spot with last ele in collection
    if( this.length > 1 && !unmergedLastEle ){
      let lastEleI = this.length - 1;
      let lastEle = this[ lastEleI ];
      let lastEleId = lastEle._private.data.id;

      this[ lastEleI ] = undefined;
      this[ i ] = lastEle;
      map.set( lastEleId, { ele: lastEle, index: i } );
    }

    // the collection is now 1 ele smaller
    this.length--;

    return this;
  },

  // remove single ele in place in calling collection
  unmergeOne: function( ele ){
    ele = ele[0];

    let _p = this._private;
    let id = ele._private.data.id;
    let map = _p.map;
    let entry =  map.get( id );

    if( !entry ){
      return this; // no need to remove
    }

    let i = entry.index;

    this.unmergeAt(i);

    return this;
  },

  // remove eles in place on calling collection
  /**
 * @typedef {object} eles_unmerge
 * @property {object} eles - The elements to remove in-place.
 * @property {object} selector - A selector representing the elements to remove. All elements in the graph matching the selector are used as the passed collection.
 */

/**
 * Perform an in-place operation on the calling collection to remove the given elements.
 * @memberof eles
 * @param {...eles_unmerge} toRemove - unmerge Event | unmerge Event
 * @namespace eles.unmerge
 */
  unmerge: function( toRemove ){
    let cy = this._private.cy;

    if( !toRemove ){
      return this;
    }

    if( toRemove && is.string( toRemove ) ){
      let selector = toRemove;
      toRemove = cy.mutableElements().filter( selector );
    }

    for( let i = 0; i < toRemove.length; i++ ){
      this.unmergeOne( toRemove[ i ] );
    }

    return this; // chaining
  },

  unmergeBy: function( toRmFn ){
    for( let i = this.length - 1; i >= 0; i-- ){
      let ele = this[i];

      if( toRmFn(ele) ){
        this.unmergeAt(i);
      }
    }

    return this;
  },

  /**
 * function(ele, i, eles) [, thisArg]
 * @typedef {object} eles_map_callback_type
 * @property {object} ele - The current element.
 * @property {object} i - The index of the current element.
 * @property {object} eles - The collection of elements being mapped.
 */

/**
 * @callback eles_map_callback
 * @property {eles_map_callback_type} function(ele,i,eles) - eles_map_callback_type
 */

/**
 * @typedef {object} eles_collection_map
 * @property {function(eles_map_callback):any} eles_map_callback - The function that returns the mapped value for each element.
 * @property {object} thisArg - [optional] The value for `this` within the iterating function.
 */

/**
 * @typedef {object} eles_map
 * @property {eles_collection_map} eles_collection_map
 */

  /**
 * Get an array containing values mapped from the collection.
 * @memberof eles
 * @param {...eles_map} mapFn - Determine test function
 * @namespace eles.map
 */
  map: function( mapFn, thisArg ){
    let arr = [];
    let eles = this;

    for( let i = 0; i < eles.length; i++ ){
      let ele = eles[ i ];
      let ret = thisArg ? mapFn.apply( thisArg, [ ele, i, eles ] ) : mapFn( ele, i, eles );

      arr.push( ret );
    }

    return arr;
  },

  /**
 * function(prevVal, ele, i, eles)
 * @typedef {object} eles_reduce_callback_type
 * @property {object} prevVal - The value accumulated from previous elements.
 * @property {object} ele - The current element.
 * @property {object} i - The index of the current element.
 * @property {object} eles - The collection of elements being reduced.
 */

/**
 * @callback eles_reduce_callback
 * @property {eles_reduce_callback_type} function(prevVal,ele,i,eles) - eles_reduce_callback_type
 */

/**
 * @typedef {object} eles_collection_reduce
 * @property {function(eles_reduce_callback):any} eles_reduce_callback - The function that returns the accumulated value given the previous value and the current element.
 */

/**
 * @typedef {object} eles_reduce
 * @property {eles_collection_reduce} eles_collection_reduce
 */

  /**
 * Reduce a single value by applying a function against an accumulator and each value of the collection.
 * @memberof eles
 * @param {...eles_reduce} fn - Determine reduce function
 * @namespace eles.reduce
 */
  reduce: function( fn, initialValue ){
    let val = initialValue;
    let eles = this;

    for( let i = 0; i < eles.length; i++ ){
      val = fn( val, eles[i], i, eles );
    }

    return val;
  },

  /**
 * function(ele, i, eles) [, thisArg]
 * @typedef {object} eles_max_callback_type
 * @property {object} ele - The current element.
 * @property {object} i - The index of the current element.
 * @property {object} eles - The collection of elements being searched.
 */

/**
 * @callback eles_max_callback
 * @property {eles_max_callback_type} function(ele,i,eles) - eles_max_callback_type
 */

/**
 * @typedef {object} eles_collection_max
 * @property {function(eles_max_callback):any} eles_max_callback - The function that returns the value to compare for each element.
 * @property {object} thisArg - [optional] The value for `this` within the iterating function.
 */

/**
 * @typedef {object} eles_max
 * @property {eles_collection_max} eles_collection_max
 */

  /**
 * Find a maximum value and the corresponding element.
 * @memberof eles
 * @param {...eles_max} valFn - Determine max function
 * @namespace eles.max
 */
  max: function( valFn, thisArg ){
    let max = -Infinity;
    let maxEle;
    let eles = this;

    for( let i = 0; i < eles.length; i++ ){
      let ele = eles[ i ];
      let val = thisArg ? valFn.apply( thisArg, [ ele, i, eles ] ) : valFn( ele, i, eles );

      if( val > max ){
        max = val;
        maxEle = ele;
      }
    }

    return {
      value: max,
      ele: maxEle
    };
  },

  /**
 * function(ele, i, eles) [, thisArg]
 * @typedef {object} eles_min_callback_type
 * @property {object} ele - The current element.
 * @property {object} i - The index of the current element.
 * @property {object} eles - The collection of elements being searched.
 */

/**
 * @callback eles_min_callback
 * @property {eles_min_callback_type} function(ele,i,eles) - eles_min_callback_type
 */

/**
 * @typedef {object} eles_collection_min
 * @property {function(eles_min_callback):any} eles_min_callback - The function that returns the value to compare for each element.
 * @property {object} thisArg - [optional] The value for `this` within the iterating function.
 */

/**
 * @typedef {object} eles_min
 * @property {eles_collection_min} eles_collection_min
 */

  /**
 * Find a minimum value and the corresponding element.
 * @memberof eles
 * @param {...eles_min} valFn - Determine min function
 * @namespace eles.min
 */
  min: function( valFn, thisArg ){
    let min = Infinity;
    let minEle;
    let eles = this;

    for( let i = 0; i < eles.length; i++ ){
      let ele = eles[ i ];
      let val = thisArg ? valFn.apply( thisArg, [ ele, i, eles ] ) : valFn( ele, i, eles );

      if( val < min ){
        min = val;
        minEle = ele;
      }
    }

    return {
      value: min,
      ele: minEle
    };
  }
});

// aliases
let fn = elesfn;
fn[ 'u' ] = fn[ '|' ] = fn[ '+' ] = fn.union = fn.or = fn.add;
fn[ '\\' ] = fn[ '!' ] = fn[ '-' ] = fn.difference = fn.relativeComplement = fn.subtract = fn.not;
fn[ 'n' ] = fn[ '&' ] = fn[ '.' ] = fn.and = fn.intersection = fn.intersect;
fn[ '^' ] = fn[ '(+)' ] = fn[ '(-)' ] = fn.symmetricDifference = fn.symdiff = fn.xor;
fn.fnFilter = fn.filterFn = fn.stdFilter = fn.filter;
fn.complement = fn.abscomp = fn.absoluteComplement;

export default elesfn;
