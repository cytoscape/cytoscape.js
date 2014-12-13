;(function($$, window){ 'use strict';

  $$.Fabric = function(){
    if( !(this instanceof $$.Fabric) ){
      return new $$.Fabric();
    }

    var _p = this._private = {
      pass: []
    };

    var defN = 4;
    var N = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || defN : defN; // assume 4 if unreported

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
    require: function( fn ){
      for( var i = 0; i < this.length; i++ ){
        var thread = this[i];

        thread.require( fn );
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
      if( $$.is.array(data) ){
        this._private.pass.push( data );
      } else if( $$.is.elementOrCollection(data) ){
        var eles = data;
        this._private.pass.push( eles.jsons() );
      } else {
        $$.util.error('Only arrays or collections may be used with fabric.pass()');
      }

      return this; // chaining
    },

    // split the data into slices to spread the data equally among threads
    spread: function( fn ){
      var self = this;
      var _p = self._private;
      var pass = _p.pass.shift();
      var runPs = [];
      var subsize = Math.round( pass.length / this.length ); // number of pass eles to handle in each thread

      subsize = Math.max( 1, subsize ); // don't pass less than one ele to each thread

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

    // TODO more efficient impl that uses blocks instead of individual values like .spread()
    // may need to add a helper function directly in the woker/child process for this
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

        var doneEarly = pass.length === 0;
        if( doneEarly ){ break; }

        // move on to next thread
        ti = (ti + 1) % this.length;
      }

      return $$.Promise.all( runPs );
    },

    reduce: function(){} // TODO

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
