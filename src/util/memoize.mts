// any[] / any are required to describe arbitrary memoizable functions
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = ( ...args: any[] ) => any;

export type Memoized<F extends AnyFn> = F & { cache: Record<string, ReturnType<F>> };

export const memoize = <F extends AnyFn,>( fn: F, keyFn?: ( ...args: Parameters<F> ) => string ): F => {
  if( !keyFn ){
    keyFn = function(){
      if( arguments.length === 1 ){
        // eslint-disable-next-line prefer-rest-params -- kept as `arguments` to preserve the original runtime exactly
        return arguments[0];
      } else if( arguments.length === 0 ){
        return 'undefined';
      }

      let args = [];

      for( let i = 0; i < arguments.length; i++ ){
        // eslint-disable-next-line prefer-rest-params -- kept as `arguments` to preserve the original runtime exactly
        args.push( arguments[ i ] );
      }

      return args.join( '$' );
    };
  }

  let memoizedFn: Memoized<F> = function( this: ThisParameterType<F> ){
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let self = this;
    // eslint-disable-next-line prefer-rest-params -- kept as `arguments` to preserve the original runtime exactly
    let args = arguments as unknown as Parameters<F>;
    let ret;
    let k = keyFn!.apply( self, args );
    let cache = memoizedFn.cache;

    if( !(ret = cache[ k ]) ){
      ret = cache[ k ] = fn.apply( self, args );
    }

    return ret;
  } as Memoized<F>;

  memoizedFn.cache = {};

  return memoizedFn;
};
