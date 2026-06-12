import * as is from '../is.mjs' ;
import zIndexSort from './zsort.mjs' ;
import * as util from '../util/index.mjs';
import type { Collection, Element, ElementPrivate } from './eles-types.mjs';

/** Callback invoked per element during iteration. */
export type EachFn = ( ele: Element, i: number, eles: Collection ) => unknown;

/** Callback returning a value per element (map/min/max). */
export type MapFn<T> = ( ele: Element, i: number, eles: Collection ) => T;

/** Reducer callback. */
export type ReduceFn<T> = ( acc: T, ele: Element, i: number, eles: Collection ) => T;

/** Comparator used by sort(). */
export type SortFn = ( a: Element, b: Element ) => number;

/** Result of min()/max(). */
export interface MinMaxResult<T = number> {
  value: T;
  ele: Element | undefined;
}

export interface CollectionIteration {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- thisArg may be any object
  forEach( fn: EachFn, thisArg?: any ): Collection;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  each( fn: EachFn, thisArg?: any ): Collection;
  toArray(): Element[];
  slice( start?: number, end?: number ): Collection;
  size(): number;
  eq( i: number ): Collection;
  first(): Collection;
  last(): Collection;
  empty(): boolean;
  nonempty(): boolean;
  sort( sortFn: SortFn ): Collection;
  /** @internal */
  sortByZIndex(): Collection;
  /** @internal */
  zDepth(): number | undefined;
  map<T>( mapFn: MapFn<T>, thisArg?: unknown ): T[];
  reduce<T>( fn: ReduceFn<T>, initialValue: T ): T;
  max( valFn: MapFn<number>, thisArg?: unknown ): MinMaxResult;
  min( valFn: MapFn<number>, thisArg?: unknown ): MinMaxResult;
  [ Symbol.iterator ](): Iterator<Element>;
}

let elesfn = ({
  forEach: function( this: Collection, fn: EachFn, thisArg?: unknown ){
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

  toArray: function( this: Collection ){
    let array: Element[] = [];

    for( let i = 0; i < this.length; i++ ){
      array.push( this[ i ] );
    }

    return array;
  },

  slice: function( this: Collection, start?: number, end?: number ){
    let array: Element[] = [];
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

  size: function( this: Collection ){
    return this.length;
  },

  eq: function( this: Collection, i: number ){
    return this[ i ] || this.spawn();
  },

  first: function( this: Collection ){
    return this[0] || this.spawn();
  },

  last: function( this: Collection ){
    return this[ this.length - 1 ] || this.spawn();
  },

  empty: function( this: Collection ){
    return this.length === 0;
  },

  nonempty: function( this: Collection ){
    return !this.empty();
  },

  sort: function( this: Collection, sortFn: SortFn ){
    if( !is.fn( sortFn ) ){
      return this;
    }

    let sorted = this.toArray().sort( sortFn );

    return this.spawn( sorted );
  },

  sortByZIndex: function( this: Collection ){
    return this.sort( zIndexSort );
  },

  zDepth: function( this: Collection ): number | undefined {
    let ele = this[0];
    if( !ele ){ return undefined; }

    // let cy = ele.cy();
    let _p = ele._private as ElementPrivate;
    let group = _p.group;

    if( group === 'nodes' ){
      // TODO(eles-types): parents()/isParent() come from the compounds mixin, not
      // yet exposed on Element via eles-types; cast until that mixin is converted
      let eleCompound = ele as unknown as { parents(): Collection; isParent(): boolean };
      let depth = _p.data.parent ? eleCompound.parents().size() : 0;

      if( !eleCompound.isParent() ){
        return util.MAX_INT - 1; // childless nodes always on top
      }

      return depth;
    } else {
      let src = _p.source as Element;
      let tgt = _p.target as Element;
      let srcDepth = src.zDepth();
      let tgtDepth = tgt.zDepth();

      return Math.max( srcDepth as number, tgtDepth as number, 0 ); // depth of deepest parent
    }
  },

  map: function<T>( this: Collection, mapFn: MapFn<T>, thisArg?: unknown ): T[] {
    let arr: T[] = [];
    let eles = this; // eslint-disable-line @typescript-eslint/no-this-alias

    for( let i = 0; i < eles.length; i++ ){
      let ele = eles[ i ];
      let ret = thisArg ? mapFn.apply( thisArg, [ ele, i, eles ] ) : mapFn( ele, i, eles );

      arr.push( ret );
    }

    return arr;
  },

  reduce: function<T>( this: Collection, fn: ReduceFn<T>, initialValue: T ): T {
    let val = initialValue;
    let eles = this; // eslint-disable-line @typescript-eslint/no-this-alias

    for( let i = 0; i < eles.length; i++ ){
      val = fn( val, eles[i], i, eles );
    }

    return val;
  },

  max: function( this: Collection, valFn: MapFn<number>, thisArg?: unknown ): MinMaxResult {
    let max = -Infinity;
    let maxEle: Element | undefined;
    let eles = this; // eslint-disable-line @typescript-eslint/no-this-alias

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

  min: function( this: Collection, valFn: MapFn<number>, thisArg?: unknown ): MinMaxResult {
    let min = Infinity;
    let minEle: Element | undefined;
    let eles = this; // eslint-disable-line @typescript-eslint/no-this-alias

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

( elesfn as unknown as { each: typeof elesfn.forEach } ).each = elesfn.forEach;

const defineSymbolIterator = () => {
  const typeofUndef = typeof undefined;
  const isIteratorSupported = typeof Symbol != typeofUndef && typeof Symbol.iterator != typeofUndef;

  if (isIteratorSupported) {
    ( elesfn as Record<symbol, unknown> )[Symbol.iterator] = function( this: Collection ) {
      let entry: { value: Element | undefined; done: boolean } = { value: undefined, done: false };
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
        [Symbol.iterator]: function() {
          return this;
        }
      };
    };
  }
};
defineSymbolIterator();

export default elesfn as unknown as CollectionIteration;
