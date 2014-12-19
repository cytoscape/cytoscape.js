;(function($$, window){ 'use strict';

  $$.Fabric = function(){
    if( !(this instanceof $$.Fabric) ){
      return new $$.Fabric();
    }

    var _p = this._private = {
      pass: []
    };

    var defN = 4;
    var N;

    if( typeof navigator !== 'undefined' && navigator.hardwareConcurrency != null ){
      N = navigator.hardwareConcurrency;
    } else if( typeof module !== 'undefined' ){
      N = require('os').cpus().length;
    } else { // TODO could use an estimation here but would the additional expense be worth it?
      N = defN;
    }

    for( var i = 0; i < N; i++ ){
      this[i] = $$.Thread();
    }

    this.length = N;
  };

  $$.fabric = $$.Fabric;
  $$.fabfn = $$.Fabric.prototype; // short alias

  $$.fn.fabric = function( fnMap, options ){
    for( var name in fnMap ){
      var fn = fnMap[name];
      $$.Fabric.prototype[ name ] = fn;
    }
  };

  $$.fn.fabric({

    // require fn in all threads
    require: function( fn, as ){
      for( var i = 0; i < this.length; i++ ){
        var thread = this[i];

        thread.require( fn, as );
      }

      return this;
    },

    // get a random thread
    random: function(){
      var i = Math.round( (this.length - 1) * Math.random() );
      var thread = this[i];

      return thread;
    },

    // run on random thread
    run: function( fn ){ 
      return this.random().run( fn );
    },

    // sends a random thread a message
    message: function( m ){
      return this.random().message( m );
    },

    // send all threads a message
    broadcast: function( m ){
      for( var i = 0; i < this.length; i++ ){
        var thread = this[i];

        thread.message( m );
      }

      return this; // chaining
    },

    // stop all threads
    stop: function(){
      for( var i = 0; i < this.length; i++ ){
        var thread = this[i];

        thread.stop();
      }

      return this.trigger('stop'); // chaining
    },

    // pass data to be used with .spread() etc.
    pass: function( data ){
      var pass = this._private.pass;

      if( $$.is.array(data) ){
        pass.push( data );
      } else if( $$.is.elementOrCollection(data) ){
        var eles = data;
        pass.push( eles.jsons() );
      } else {
        $$.util.error('Only arrays or collections may be used with fabric.pass()');
      }

      return this; // chaining
    },

    spreadSize: function(){
      var subsize =  Math.ceil( this._private.pass[0].length / this.length );

      subsize = Math.max( 1, subsize ); // don't pass less than one ele to each thread

      return subsize;
    },

    // split the data into slices to spread the data equally among threads
    spread: function( fn ){
      var self = this;
      var _p = self._private;
      var subsize = self.spreadSize(); // number of pass eles to handle in each thread
      var pass = _p.pass.shift();
      var runPs = [];

      for( var i = 0; i < this.length; i++ ){
        var thread = this[i];
        var slice = pass.splice( 0, subsize );

        var runP = thread.pass( slice ).run( fn );

        runPs.push( runP );

        var doneEarly = pass.length === 0;
        if( doneEarly ){ break; }
      }

      return $$.Promise.all( runPs ).then(function( thens ){
        var postpass = new Array();
        var p = 0;

        // fill postpass with the total result joined from all threads
        for( var i = 0; i < thens.length; i++ ){
          var then = thens[i]; // array result from thread i

          for( var j = 0; j < then.length; j++ ){
            var t = then[j]; // array element

            postpass[ p++ ] = t;
          }
        }

        return postpass;
      });
    },

    // parallel version of array.map()
    map: function( fn ){
      var self = this;
      var _p = self._private;
      var pass = _p.pass.shift();
      var runPs = [];
      var ti = 0;

      for( var i = 0; i < pass.length; i++ ){
        var datum = pass[i];
        var thread = this[ ti ];
        var runP = thread.pass( datum ).run( fn );

        runPs.push( runP );

        // move on to next thread
        ti = (ti + 1) % this.length;
      }

      return $$.Promise.all( runPs );
    },

    // parallel version of array.filter()
    filter: function( fn ){
      var _p = this._private;
      var pass = _p.pass[0];

      return this.map( fn ).then(function( include ){
        var ret = [];

        for( var i = 0; i < pass.length; i++ ){
          var datum = pass[i];
          var incDatum = include[i];

          if( incDatum ){
            ret.push( datum );
          }
        }

        return ret;
      });
    },

    // sorts the passed array using a divide and conquer strategy
    sort: function( cmp ){
      var self = this;
      var subsize = this.spreadSize();
      var N = this.length;

      cmp = cmp || function( a, b ){ // default comparison function
        if( a < b ){
          return -1;
        } else if( a > b ){
          return 1;
        } 
        
        return 0;
      };

      self.require( cmp, '_$_$_sort' );

      return self.spread(function( split ){ // sort each split normally
        var sortedSplit = split.sort( _$_$_sort );
        resolve( sortedSplit ); 

      }).then(function( joined ){ // "merge" the splits together, similar to mergesort
        var ret = new Array( joined.length );
        var ri = 0;
        var m = new Array( N ); // thread index => merge index
        var mMax = new Array( N ); // thread index => max merge index

        // init indices
        for( var ti = 0; ti < N; ti++ ){ 
          var m_ti = m[ti] = ti * subsize; // each merge index starts at the split start
          
          var mMax_ti = m_ti + subsize - 1;
          mMax_ti = Math.min( mMax_ti, joined.length - 1 ); // constrain to end of array
          mMax[ti] = mMax_ti;
        }

        var next = {
          val: joined[0],
          mti: 0,
          ti: 0
        };

        // "merges" the next ele to ret
        var pushNext = function(){
          for( var ti = 0; ti < N; ti++ ){
            var mti = m[ ti ];
            var val = joined[ mti ];

            if( mti > mMax[ ti ] ){ continue; } // => thread done

            var nextCmp = !next ? -1 : cmp( val, next.val );

            if( nextCmp < 0 ){ // then this val supercedes the old one
              next = {
                val: val,
                mti: mti,
                ti: ti
              };
            }
          } // for

          // now we're sure we have the best next
          ret[ ri++ ] = next.val; // store sorted val
          m[ next.ti ]++; // move along corresponding thread

          next = null;
        } // pushNext

        while( ri < joined.length ){
          pushNext();
        }

        return ret;
      });
    }


  });
  
  var defineRandomPasser = function( opts ){
    opts = opts || {};

    return function( fn ){
      var pass = this._private.pass.shift();

      return this.random().pass( pass )[ opts.threadFn ]( fn );
    };
  };

  $$.fn.fabric({
    randomMap: defineRandomPasser({ threadFn: 'map' }),

    reduce: defineRandomPasser({ threadFn: 'reduce' }),
    
    reduceRight: defineRandomPasser({ threadFn: 'reduceRight' })
  });

  // aliases
  var fn = $$.fabfn;
  fn.promise = fn.run;
  fn.terminate = fn.halt = fn.stop;

  // pull in event apis
  $$.fn.fabric({
    on: $$.define.on(),
    one: $$.define.on({ unbindSelfOnTrigger: true }),
    once: $$.define.on({ unbindAllBindersOnTrigger: true }),
    off: $$.define.off(), 
    trigger: $$.define.trigger()
  });

  $$.define.eventAliasesOn( $$.fabfn );
  
})( cytoscape, typeof window === 'undefined' ? null : window );
