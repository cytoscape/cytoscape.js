import * as is from '../is.mjs';
import * as util from '../util/index.mjs';
import type { Collection, ElementPrivate } from './eles-types.mjs';

// A traversal method: invoked with `this` bound to a Collection, accepting up
// to four positional args (typically a selector) and returning a Collection.
// Kept generic over the args so wrapped methods stay callable with their own
// (narrower) signatures.
type TraversalFn<A extends unknown[] = unknown[]> = ( this: Collection, ...args: A ) => Collection;

let cache = function<A extends unknown[]>( fn: TraversalFn<A>, name: string ): TraversalFn<A> {
  let traversalCache = function( this: Collection, arg1?: unknown, arg2?: unknown, arg3?: unknown, arg4?: unknown ): Collection {
    let selectorOrEles = arg1;
    let eles = this; // eslint-disable-line @typescript-eslint/no-this-alias
    let key: string | undefined;

    if( selectorOrEles == null ){
      key = '';
    } else if( is.elementOrCollection( selectorOrEles ) && ( selectorOrEles as unknown as Collection ).length === 1 ){
      key = ( selectorOrEles as unknown as Collection ).id();
    }

    let callArgs = [ arg1, arg2, arg3, arg4 ] as unknown as A;

    if( eles.length === 1 && key ){
      let _p = eles[0]._private as ElementPrivate;
      let tch = _p.traversalCache = _p.traversalCache || {};
      let ch = ( tch[ name ] = ( tch[ name ] as Collection[] ) || [] ) as Collection[];
      let hash = util.hashString( key );
      let cacheHit = ch[ hash ];

      if( cacheHit ){
        return cacheHit;
      } else {
        return ( ch[ hash ] = fn.call( eles, ...callArgs ) );
      }
    } else {
      return fn.call( eles, ...callArgs );
    }
  };

  return traversalCache as unknown as TraversalFn<A>;
};

export default cache;
