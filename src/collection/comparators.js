import Selector from '../selector';

/**
 * @class eles
 */
let elesfn = ({

  /**
 * @typedef {object} eles_allAre
 * @property {object} selector -  The selector to match against.
 */

  /**
 * Determine whether all elements in the collection match a selector.
 * @memberof eles
 * @param {...eles_allAre} selector - Matching Selector
 * @namespace eles.allAre
 */
  allAre: function( selector ){
    let selObj = new Selector( selector );

    return this.every(function( ele ){
      return selObj.matches( ele );
    });
  },

  /**
 * @typedef {object} eles_is
 * @property {object} selector - The selector to match against.
 */

  /**
 * Determine whether any element in this collection matches a selector.
 * @memberof eles
 * @param {...eles_is} selector - Matching Selector
 * @namespace eles.is
 */
  is: function( selector ){
    let selObj = new Selector( selector );

    return this.some(function( ele ){
      return selObj.matches( ele );
    });
  },

  /**
 * function(ele, i, eles) [, thisArg]
 * @typedef {object} eles_some_callback_type
 * @property {object} ele - The event object.
 * @property {object} i - The index of the current element.
 * @property {object} eles - The collection of elements being tested.
 */

/**
 * @callback eles_some_callback
 * @property {eles_some_callback_type} function(ele,i,eles) - eles_some_callback_type
 */

/**
 * @typedef {object} eles_collection_some
 * @property {function(eles_some_callback):any} eles_some_callback -  The test function that returns truthy values for elements that satisfy the test and falsey values for elements that do not satisfy the test.
 * @property {object} thisArg -  [optional] The value for `this` within the test function.
 */

/**
 * @typedef {object} eles_some
 * @property {eles_collection_some} eles_collection_some
 */

  /**
 * Determine whether any element in this collection satisfies the specified test function.
 * @memberof eles
 * @param {...eles_some} fn - Listen to events that bubble up from elements matching the specified node selector:
 * @namespace eles.some
 */
  some: function( fn, thisArg ){
    for( let i = 0; i < this.length; i++ ){
      let ret = !thisArg ? fn( this[ i ], i, this ) : fn.apply( thisArg, [ this[ i ], i, this ] );

      if( ret ){
        return true;
      }
    }

    return false;
  },

  /**
 * function(ele, i, eles) [, thisArg]
 * @typedef {object} eles_every_callback_type
 * @property {object} ele - The event object.
 * @property {object} i - The index of the current element.
 * @property {object} eles - The collection of elements being tested.
 */

/**
 * @callback eles_every_callback
 * @property {eles_every_callback_type} function(ele,i,eles) - eles_every_callback_type
 */

/**
 * @typedef {object} eles_collection_every
 * @property {function(eles_every_callback):any} eles_every_callback -  The test function that returns truthy values for elements that satisfy the test and falsey values for elements that do not satisfy the test.
 * @property {object} thisArg -  [optional] The value for `this` within the test function.
 */

/**
 * @typedef {object} eles_every
 * @property {eles_collection_every} eles_collection_every
 */

  /**
 * Determine whether all elements in this collection satisfy the specified test function.
 * @memberof eles
 * @param {...eles_every} fn - Determine test function
 * @namespace eles.every
 */
  every: function( fn, thisArg ){
    for( let i = 0; i < this.length; i++ ){
      let ret = !thisArg ? fn( this[ i ], i, this ) : fn.apply( thisArg, [ this[ i ], i, this ] );

      if( !ret ){
        return false;
      }
    }

    return true;
  },

  /**
 * @typedef {object} eles_same
 * @property {object} eles - The other elements to compare to.
 */

  /**
 * Determine whether this collection contains exactly the same elements as another collection.
 * @memberof eles
 * @param {...eles_same} collection - Determine same collection
 * @namespace eles.same
 */
  same: function( collection ){
    // cheap collection ref check
    if( this === collection ){ return true; }

    collection = this.cy().collection( collection );

    let thisLength = this.length;
    let collectionLength = collection.length;

    // cheap length check
    if( thisLength !== collectionLength ){ return false; }

    // cheap element ref check
    if( thisLength === 1 ){ return this[0] === collection[0]; }

    return this.every(function( ele ){
      return collection.hasElementWithId( ele.id() );
    });
  },

  /**
 * @typedef {object} eles_anySame
 * @property {object} eles - The other elements to compare to.
 */

  /**
 * Determine whether this collection contains any of the same elements as another collection.
 * @memberof eles
 * @param {...eles_anySame} collection - Determine any same collection
 * @namespace eles.anySame
 */
  anySame: function( collection ){
    collection = this.cy().collection( collection );

    return this.some(function( ele ){
      return collection.hasElementWithId( ele.id() );
    });
  },

  /**
 * @typedef {object} eles_allAreNeighbors
 * @property {object} eles - The other elements to compare to.
 */

/**
 * Determine whether all elements in the specified collection are in the neighbourhood of the calling collection.
 * @memberof eles
 * @alias eles.allAreNeighbours
 * @param {...eles_allAreNeighbors} collection - Determine neighbourhood collection
 * @namespace eles.allAreNeighbors
 */
  allAreNeighbors: function( collection ){
    collection = this.cy().collection( collection );

    let nhood = this.neighborhood();

    return collection.every(function( ele ){
      return nhood.hasElementWithId( ele.id() );
    });
  },

  /**
 * @typedef {object} eles_contains
 * @property {object} eles - The other elements to compare to.
 */

/**
 * Determine whether this collection contains all of the elements of another collection.
 * @memberof eles
 * @alias eles.has
 * @param {...eles_contains} collection - Determine another collection
 * @namespace eles.contains
 */
  contains: function( collection ){
    collection = this.cy().collection( collection );

    let self = this;

    return collection.every(function( ele ){
      return self.hasElementWithId( ele.id() );
    });
  }
});

elesfn.allAreNeighbours = elesfn.allAreNeighbors;
elesfn.has = elesfn.contains;
elesfn.equal = elesfn.equals = elesfn.same;

export default elesfn;
