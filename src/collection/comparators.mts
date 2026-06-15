import Selector from '../selector/index.mjs';
import type { SelectorEle } from '../selector/type.mjs';
import type { Collection, SharedCollection, Element } from './eles-types.mjs';

/** Test callback for some()/every(). */
export type CollectionTestFn = ( ele: Element, i: number, eles: Collection ) => boolean | void;

/** Collection comparison/predicate methods contributed to the prototype. */
export interface CollectionComparators {
  allAre( selector: string ): boolean;
  is( selector: string ): boolean;
  some( fn: CollectionTestFn, thisArg?: unknown ): boolean;
  every( fn: CollectionTestFn, thisArg?: unknown ): boolean;
  same( collection: SharedCollection | string ): boolean;
  anySame( collection: SharedCollection | string ): boolean;
  allAreNeighbors( collection: SharedCollection | string ): boolean;
  allAreNeighbours( collection: SharedCollection | string ): boolean;
  contains( collection: SharedCollection | string ): boolean;
  has( collection: SharedCollection | string ): boolean;
  /** @internal */
  equal( collection: SharedCollection | string ): boolean;
  /** @internal */
  equals( collection: SharedCollection | string ): boolean;
}

let elesfn = ({
  allAre: function( this: Collection, selector: string ){
    let selObj = new Selector( selector );

    return this.every(function( ele ){
      return selObj.matches( ele as unknown as SelectorEle );
    });
  },

  is: function( this: Collection, selector: string ){
    let selObj = new Selector( selector );

    return this.some(function( ele ){
      return selObj.matches( ele as unknown as SelectorEle );
    });
  },

  some: function( this: Collection, fn: CollectionTestFn, thisArg?: unknown ){
    for( let i = 0; i < this.length; i++ ){
      let ret = !thisArg ? fn( this[ i ], i, this ) : fn.apply( thisArg, [ this[ i ], i, this ] );

      if( ret ){
        return true;
      }
    }

    return false;
  },

  every: function( this: Collection, fn: CollectionTestFn, thisArg?: unknown ){
    for( let i = 0; i < this.length; i++ ){
      let ret = !thisArg ? fn( this[ i ], i, this ) : fn.apply( thisArg, [ this[ i ], i, this ] );

      if( !ret ){
        return false;
      }
    }

    return true;
  },

  same: function( this: Collection, collection: SharedCollection | string ){
    // cheap collection ref check
    if( this === collection ){ return true; }

    let coll = this.cy().collection( collection );

    let thisLength = this.length;
    let collectionLength = coll.length;

    // cheap length check
    if( thisLength !== collectionLength ){ return false; }

    // cheap element ref check
    if( thisLength === 1 ){ return this[0] === coll[0]; }

    return this.every(function( ele ){
      return coll.hasElementWithId( ele.id()! );
    });
  },

  anySame: function( this: Collection, collection: SharedCollection | string ){
    let coll = this.cy().collection( collection );

    return this.some(function( ele ){
      return coll.hasElementWithId( ele.id()! );
    });
  },

  allAreNeighbors: function( this: Collection, collection: SharedCollection | string ){
    let coll = this.cy().collection( collection );

    let nhood = this.neighborhood();

    return coll.every(function( ele ){
      return nhood.hasElementWithId( ele.id()! );
    });
  },

  contains: function( this: Collection, collection: SharedCollection | string ){
    let coll = this.cy().collection( collection );

    let self = this; // eslint-disable-line @typescript-eslint/no-this-alias

    return coll.every(function( ele ){
      return self.hasElementWithId( ele.id()! );
    });
  }
}) as CollectionComparators;

elesfn.allAreNeighbours = elesfn.allAreNeighbors;
elesfn.has = elesfn.contains;
elesfn.equal = elesfn.equals = elesfn.same;

export default elesfn;
