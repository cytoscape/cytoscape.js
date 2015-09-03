;(function($$, window){ 'use strict';

  $$.Fabric = function( N ){
    if( !(this instanceof $$.Fabric) ){
      return new $$.Fabric( N );
    }

    this._private = {
      pass: []
    };

    var defN = 4;

    if( $$.is.number(N) ){
      // then use the specified number of threads
    } if( typeof navigator !== 'undefined' && navigator.hardwareConcurrency != null ){
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
      var pass = this._private.pass.shift();

      return this.random().pass( pass ).run( fn );
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

      return this; // chaining
    },

    // pass data to be used with .spread() etc.
    pass: function( data ){
      var pass = this._private.pass;

      if( $$.is.array(data) ){
        pass.push( data );
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
      var pass = _p.pass.shift().concat([]); // keep a copy
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
        var postpass = [];
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

      self.require( fn, '_$_$_fabmap' );

      return self.spread(function( split ){
        var mapped = [];
        var origResolve = resolve;

        resolve = function( val ){
          mapped.push( val );
        };

        for( var i = 0; i < split.length; i++ ){
          var oldLen = mapped.length;
          var ret = _$_$_fabmap( split[i] );
          var nothingInsdByResolve = oldLen === mapped.length;

          if( nothingInsdByResolve ){
            mapped.push( ret );
          }
        }

        resolve = origResolve;

        return mapped;
      });

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
      var P = this._private.pass[0].length;
      var subsize = this.spreadSize();

      cmp = cmp || function( a, b ){ // default comparison function
        if( a < b ){
          return -1;
        } else if( a > b ){
          return 1;
        }

        return 0;
      };

      self.require( cmp, '_$_$_cmp' );

      return self.spread(function( split ){ // sort each split normally
        var sortedSplit = split.sort( _$_$_cmp );
        resolve( sortedSplit );

      }).then(function( joined ){
        // do all the merging in the main thread to minimise data transfer

        // TODO could do merging in separate threads but would incur add'l cost of data transfer
        // for each level of the merge

        var merge = function( i, j, max ){
          // don't overflow array
          j = Math.min( j, P );
          max = Math.min( max, P );

          // left and right sides of merge
          var l = i;
          var r = j;

          var sorted = [];

          for( var k = l; k < max; k++ ){

            var eleI = joined[i];
            var eleJ = joined[j];

            if( i < r && ( j >= max || cmp(eleI, eleJ) <= 0 ) ){
              sorted.push( eleI );
              i++;
            } else {
              sorted.push( eleJ );
              j++;
            }

          }

          // in the array proper, put the sorted values
          for( var k = 0; k < sorted.length; k++ ){ // kth sorted item
            var index = l + k;

            joined[ index ] = sorted[k];
          }
        };

        for( var splitL = subsize; splitL < P; splitL *= 2 ){ // merge until array is "split" as 1

          for( var i = 0; i < P; i += 2*splitL ){
            merge( i, i + splitL, i + 2*splitL );
          }

        }

        return joined;
      });
    }


  });

  var defineRandomPasser = function( opts ){
    opts = opts || {};

    return function( fn, arg1 ){
      var pass = this._private.pass.shift();

      return this.random().pass( pass )[ opts.threadFn ]( fn, arg1 );
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
  fn.include = fn.require;

  // pull in event apis
  $$.fn.fabric({
    on: $$.define.on(),
    one: $$.define.on({ unbindSelfOnTrigger: true }),
    off: $$.define.off(),
    trigger: $$.define.trigger()
  });

  $$.define.eventAliasesOn( $$.fabfn );

})( cytoscape, typeof window === 'undefined' ? null : window );
