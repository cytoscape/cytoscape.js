/*!
Embeddable Minimum Strictly-Compliant Promises/A+ 1.1.1 Thenable
Copyright (c) 2013-2014 Ralf S. Engelschall (http://engelschall.com)
Licensed under The MIT License (http://opensource.org/licenses/MIT)
*/

/* eslint-disable no-var -- preserve the original third-party polyfill code verbatim */

/*  promise states [Promises/A+ 2.1]  */
var STATE_PENDING   = 0;                                         /*  [Promises/A+ 2.1.1]  */
var STATE_FULFILLED = 1;                                         /*  [Promises/A+ 2.1.2]  */
var STATE_REJECTED  = 2;                                         /*  [Promises/A+ 2.1.3]  */

/*  `setImmediate` is a non-standard global (Node, old IE); probed via `typeof` below  */
declare const setImmediate: ( ( fn: () => void ) => void ) | undefined;

type Handler = ( value?: unknown ) => void;

type ThenableExecutor = ( fulfill: Handler, reject: Handler ) => void;

interface ThenableProxy {
  then( onFulfilled?: unknown, onRejected?: unknown ): ThenableProxy;
}

interface Thenable {
  id: string;
  state: number;
  fulfillValue: unknown;
  rejectReason: unknown;
  onFulfilled: Handler[];
  onRejected: Handler[];
  proxy: ThenableProxy;
  fulfill( value?: unknown ): Thenable;
  reject( value?: unknown ): Thenable;
  then( onFulfilled?: unknown, onRejected?: unknown ): ThenableProxy;
}

interface ThenableApi {
  ( executor?: ThenableExecutor ): Thenable;
  new ( executor?: ThenableExecutor ): Thenable;
  prototype: Pick<Thenable, 'fulfill' | 'reject' | 'then'>;
  all( ps: ArrayLike<unknown> ): Thenable;
  resolve( val?: unknown ): Thenable;
  reject( val?: unknown ): Thenable;
}

/**
 * The structural subset of the Promise API provided by both the native
 * `Promise` and the Thenable polyfill (construct with executor, `then`,
 * `resolve`, `reject`, `all`).
 */
export interface PromiseLikeObject<T> {
  then<TResult1 = T, TResult2 = never>(
    onFulfilled?: ( ( value: T ) => TResult1 | PromiseLike<TResult1> ) | null,
    onRejected?: ( ( reason: unknown ) => TResult2 | PromiseLike<TResult2> ) | null
  ): PromiseLikeObject<TResult1 | TResult2>;
}

/**
 * Minimal structural constructor type for the default export.
 */
export interface PromiseConstructorLike {
  new <T>( executor: ( resolve: ( value: T | PromiseLike<T> ) => void, reject: ( reason?: unknown ) => void ) => void ): PromiseLikeObject<T>;
  resolve(): PromiseLikeObject<void>;
  resolve<T>( value: T | PromiseLike<T> ): PromiseLikeObject<T>;
  reject( reason?: unknown ): PromiseLikeObject<never>;
  all<T>( values: readonly ( T | PromiseLike<T> )[] ): PromiseLikeObject<T[]>;
}

/*  promise object constructor  */
var api = function( this: Thenable, executor?: ThenableExecutor ){
  /*  optionally support non-constructor/plain-function call  */
  if( !(this instanceof api) )
    return new api( executor );

  /*  initialize object  */
  this.id           = 'Thenable/1.0.7';
  this.state        = STATE_PENDING; /*  initial state  */
  this.fulfillValue = undefined;     /*  initial value  */     /*  [Promises/A+ 1.3, 2.1.2.2]  */
  this.rejectReason = undefined;     /*  initial reason */     /*  [Promises/A+ 1.5, 2.1.3.2]  */
  this.onFulfilled  = [];            /*  initial handlers  */
  this.onRejected   = [];            /*  initial handlers  */

  /*  provide optional information-hiding proxy  */
  this.proxy = {
    then: this.then.bind( this )
  };

  /*  support optional executor function  */
  if( typeof executor === 'function' )
    executor.call( this, this.fulfill.bind( this ), this.reject.bind( this ) );
} as ThenableApi;

/*  promise API methods  */
api.prototype = {
  /*  promise resolving methods  */
  fulfill: function( this: Thenable, value?: unknown ){ return deliver( this, STATE_FULFILLED, 'fulfillValue', value ); },
  reject:  function( this: Thenable, value?: unknown ){ return deliver( this, STATE_REJECTED,  'rejectReason', value ); },

  /*  "The then Method" [Promises/A+ 1.1, 1.2, 2.2]  */
  then: function( this: Thenable, onFulfilled?: unknown, onRejected?: unknown ){
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- preserve the original polyfill code verbatim
    var curr = this;
    var next = new api();                                    /*  [Promises/A+ 2.2.7]  */
    curr.onFulfilled.push(
      resolver( onFulfilled, next, 'fulfill' ) );             /*  [Promises/A+ 2.2.2/2.2.6]  */
    curr.onRejected.push(
      resolver( onRejected,  next, 'reject' ) );             /*  [Promises/A+ 2.2.3/2.2.6]  */
    execute( curr );
    return next.proxy;                                       /*  [Promises/A+ 2.2.7, 3.3]  */
  }
};

/*  deliver an action  */
var deliver = function( curr: Thenable, state: number, name: 'fulfillValue' | 'rejectReason', value: unknown ){
  if( curr.state === STATE_PENDING ){
    curr.state = state;                                      /*  [Promises/A+ 2.1.2.1, 2.1.3.1]  */
    curr[ name ] = value;                                      /*  [Promises/A+ 2.1.2.2, 2.1.3.2]  */
    execute( curr );
  }
  return curr;
};

/*  execute all handlers  */
var execute = function( curr: Thenable ){
  if( curr.state === STATE_FULFILLED )
    execute_handlers( curr, 'onFulfilled', curr.fulfillValue );
  else if( curr.state === STATE_REJECTED )
    execute_handlers( curr, 'onRejected',  curr.rejectReason );
};

/*  execute particular set of handlers  */
var execute_handlers = function( curr: Thenable, name: 'onFulfilled' | 'onRejected', value: unknown ){
  /* global setImmediate: true */
  /* global setTimeout: true */

  /*  short-circuit processing  */
  if( curr[ name ].length === 0 )
    return;

  /*  iterate over all handlers, exactly once  */
  var handlers = curr[ name ];
  curr[ name ] = [];                                             /*  [Promises/A+ 2.2.2.3, 2.2.3.3]  */
  var func = function(){
    for( var i = 0; i < handlers.length; i++ )
      handlers[ i ]( value );                                  /*  [Promises/A+ 2.2.5]  */
  };

  /*  execute procedure asynchronously  */                     /*  [Promises/A+ 2.2.4, 3.1]  */
  if( typeof setImmediate === 'function' )
    setImmediate( func );
  else
    setTimeout( func, 0 );
};

/*  generate a resolver function  */
var resolver = function( cb: unknown, next: Thenable, method: 'fulfill' | 'reject' ): Handler {
  return function( value ){
    if( typeof cb !== 'function' )                            /*  [Promises/A+ 2.2.1, 2.2.7.3, 2.2.7.4]  */
      next[ method ].call( next, value );                      /*  [Promises/A+ 2.2.7.3, 2.2.7.4]  */
    else {
      var result;
      try { result = cb( value ); }                          /*  [Promises/A+ 2.2.2.1, 2.2.3.1, 2.2.5, 3.2]  */
      catch( e ){
        next.reject( e );                                  /*  [Promises/A+ 2.2.7.2]  */
        return;
      }
      resolve( next, result );                               /*  [Promises/A+ 2.2.7.1]  */
    }
  };
};

/*  "Promise Resolution Procedure"  */                           /*  [Promises/A+ 2.3]  */
var resolve = function( promise: Thenable, x: unknown ){
  /*  sanity check arguments  */                               /*  [Promises/A+ 2.3.1]  */
  if( promise === x || promise.proxy === x ){
    promise.reject( new TypeError( 'cannot resolve promise with itself' ) );
    return;
  }

  /*  surgically check for a "then" method
    (mainly to just call the "getter" of "then" only once)  */
  var then;
  if( (typeof x === 'object' && x !== null) || typeof x === 'function' ){
    try { then = ( x as { then?: unknown } ).then; }         /*  [Promises/A+ 2.3.3.1, 3.5]  */
    catch( e ){
      promise.reject( e );                                   /*  [Promises/A+ 2.3.3.2]  */
      return;
    }
  }

  /*  handle own Thenables    [Promises/A+ 2.3.2]
    and similar "thenables" [Promises/A+ 2.3.3]  */
  if( typeof then === 'function' ){
    var resolved = false;
    try {
      /*  call retrieved "then" method */                  /*  [Promises/A+ 2.3.3.3]  */
      then.call( x,
        /*  resolvePromise  */                           /*  [Promises/A+ 2.3.3.3.1]  */
        function( y: unknown ){
          if( resolved ) return; resolved = true;       /*  [Promises/A+ 2.3.3.3.3]  */
          if( y === x )                                 /*  [Promises/A+ 3.6]  */
            promise.reject( new TypeError( 'circular thenable chain' ) );
          else
            resolve( promise, y );
        },

        /*  rejectPromise  */                            /*  [Promises/A+ 2.3.3.3.2]  */
        function( r: unknown ){
          if( resolved ) return; resolved = true;       /*  [Promises/A+ 2.3.3.3.3]  */
          promise.reject( r );
        }
      );
    }
    catch( e ){
      if( !resolved )                                       /*  [Promises/A+ 2.3.3.3.3]  */
        promise.reject( e );                               /*  [Promises/A+ 2.3.3.3.4]  */
    }
    return;
  }

  /*  handle other values  */
  promise.fulfill( x );                                          /*  [Promises/A+ 2.3.4, 2.3.3.4]  */
};

// so we always have Promise.all()
api.all = function( ps ){
  return new api(function( resolveAll, rejectAll ){
    var vals = new Array( ps.length );
    var doneCount = 0;

    var fulfill = function( i: number, val: unknown ){
      vals[ i ] = val;
      doneCount++;

      if( doneCount === ps.length ){
        resolveAll( vals );
      }
    };

    for( var i = 0; i < ps.length; i++ ){
      (function( i: number ){
        var p = ps[i] as { then?: ( onFulfilled: Handler, onRejected: Handler ) => void } | null | undefined;
        var isPromise = p != null && p.then != null;

        if( isPromise ){
          p!.then!( function( val ){
            fulfill( i, val );
          }, function( err ){
            rejectAll( err );
          } );
        } else {
          var val = p;
          fulfill( i, val );
        }
      })( i );
    }

  } );
};

api.resolve = function( val ){
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- keep the original executor signature
  return new api(function( resolve, reject ){ resolve( val ); });
};

api.reject = function( val ){
  return new api(function( resolve, reject ){ reject( val ); });
};

// The polyfill provides only the subset of the Promise API above, so the
// default export is typed with the honest, minimal structural constructor
// shared by both implementations.
export default (typeof Promise !== 'undefined' ? Promise : api) as unknown as PromiseConstructorLike;
