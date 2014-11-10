// cross-env worker
// NB : uses (heavyweight) processes on nodejs so best not to create too many workers

;(function($$, window){ 'use strict';

  $$.Worker = function( fn ){
    if( !(this instanceof $$.Worker) ){
      return new $$.Worker(opts);
    }

    var _p = this._private = {
      requires: []
    };

  };

  $$.worker = $$.Worker;
  $$.wkrfn = $$.Worker.prototype; // short alias

  $$.fn.worker = function( fnMap, options ){
    for( var name in fnMap ){
      var fn = fnMap[name];
      $$.Worker.prototype[ name ] = fn;
    }
  };

  $$.fn.worker({

    require: function( fn ){
      this._private.requires.push( fn );

      return this; // chaining
    },

    run: function( fn ){
      var self = this;
      var _p = this._private;

      if( fn ){ // optional require; probably used like main()
        this.require( fn );
      }

      _p.running = true;

      self.trigger('run');

      return new $$.Promise(function( resolve, reject ){

        var msgIsResolve( m ){
          return ( typeof m === 'object' ) && ( '$$resolve' in m );
        }

        // worker code to exec
        var fnStr = _p.requires.map(function( r ){ return r.toString(); }).join(';\n');

        if( window ){
          // add normalised worker api functions
          fnStr += 'function message(m){ postMessage(m); };\n';
          fnStr += 'function listen(fn){ self.addEventListener("message", function(m){  if( typeof m === "object" && m.$$eval ){} else { fn(m); } });  };\n'; 
          fnStr += 'function resolve(v){ postMessage({ $$resolve: v }); };\n'; 

          // create webworker and let it exec the serialised code
          var fnBlob = new Blob([ fnStr ]);
          var fnUrl = window.URL.createObjectURL( fnBlob );
          var ww = _p.webworker = new Worker( fnUrl );

          // worker messages => events
          ww.addEventListener('message', function( m ){
            if( msgIsResolve(m) ){
              resolve( m );
            } else {
              self.trigger( new $$.Event(m, { type: 'message' }) );
            }
          }, false);

          ww.postMessage(''); // start

        } else if( typeof module !== 'undefined' ){
          // create a new process
          var child = _p.child = child_process.fork( path.join(__dirname, 'worker-node-fork') );

          // child process messages => events
          child.on('message', function( m ){
            if( msgIsResolve(m) ){
              resolve( m );
            } else {
              self.trigger( new $$.Event(m, { type: 'message' }) );
            }
          });

          // ask the child process to eval the worker code
          child.send({
            $$eval: fnStr
          });
        } else {
          $$.error('Tried to create worker but no underlying tech found');
        }

      }).then(function( v ){
        _p.running = false;

        return v;
      });
    
    },

    // send the worker a message
    message: function( m ){
      var _p = this._private;

      if( _p.webworker ){
        _p.webworker.postMessage( m );
      }

      if( _p.child ){
        _p.child.send( m );
      } 

      return this; // chaining
    },

    stop: function(){
      var _p = this._private;

      if( !_p.running ){ return; } // can stop only if running

      if( _p.webworker ){
        _p.webworker.terminate();
      }

      if( _p.child ){
        _p.child.kill();
      } 

      return this.trigger('stop'); // chaining
    }

  });

  // pull in event apis
  $$.fn.worker({
    on: $$.define.on(),
    one: $$.define.on({ unbindSelfOnTrigger: true }),
    once: $$.define.on({ unbindAllBindersOnTrigger: true }),
    off: $$.define.off(), 
    trigger: $$.define.trigger()
  });
  
})( cytoscape, typeof window === 'undefined' ? null : window );
