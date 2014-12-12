// cross-env thread/worker
// NB : uses (heavyweight) processes on nodejs so best not to create too many threads

;(function($$, window){ 'use strict';

  $$.Thread = function( fn ){
    if( !(this instanceof $$.Thread) ){
      return new $$.Thread( fn );
    }

    var _p = this._private = {
      requires: []
    };

    if( fn ){
      this.run( fn );
    }

  };

  $$.thread = $$.Thread;
  $$.thdfn = $$.Thread.prototype; // short alias

  $$.fn.thread = function( fnMap, options ){
    for( var name in fnMap ){
      var fn = fnMap[name];
      $$.Thread.prototype[ name ] = fn;
    }
  };

  $$.fn.thread({

    require: function( fn ){
      this._private.requires.push( fn );

      return this; // chaining
    },

    run: function( fn ){ // fn used like main()
      var self = this;
      var _p = this._private;

      if( _p.ran ){
        return new $$.Promise(function( resolve, reject ){
          reject('This thread has already been run!');
        });
      }

      _p.ran = true;
      _p.running = true;

      self.trigger('run');

      return new $$.Promise(function( resolve, reject ){

        // worker code to exec
        var fnStr = _p.requires.map(function( r ){
          return r.toString() + '\n';
        }).concat([ '(' + fn.toString() + ')();\n' ]).join('\n');

        if( window ){
          // add normalised worker api functions
          fnStr += 'function broadcast(m){ return message(m); };\n'; // alias
          fnStr += 'function message(m){ postMessage(m); };\n';
          fnStr += 'function listen(fn){ self.addEventListener("message", function(m){  if( typeof m === "object" && (m.$$eval || m.data === "$$start") ){} else { fn(m.data); } });  };\n'; 
          fnStr += 'function resolve(v){ postMessage({ $$resolve: v }); };\n'; 

          // create webworker and let it exec the serialised code
          var fnBlob = new Blob([ fnStr ]);
          var fnUrl = window.URL.createObjectURL( fnBlob );
          var ww = _p.webworker = new Worker( fnUrl );

          // worker messages => events
          ww.addEventListener('message', function( m ){
            if( $$.is.object(m) && $$.is.object( m.data ) && ('$$resolve' in m.data) ){
              resolve( m.data.$$resolve );
            } else {
              self.trigger( new $$.Event(m, { type: 'message', message: m.data }) );
            }
          }, false);

          ww.postMessage('$$start'); // start

        } else if( typeof module !== 'undefined' ){
          // create a new process
          var path = require('path');
          var child_process = require('child_process');
          var child = _p.child = child_process.fork( path.join(__dirname, 'thread-node-fork') );

          // child process messages => events
          child.on('message', function( m ){
            if( $$.is.object(m) && ('$$resolve' in m) ){
              resolve( m.$$resolve );
            } else {
              self.trigger( new $$.Event({}, { type: 'message', message: m }) );
            }
          });

          // ask the child process to eval the worker code
          child.send({
            $$eval: fnStr
          });
        } else {
          $$.error('Tried to create thread but no underlying tech found');
        }

      }).then(function( v ){
        _p.running = false;

        return v;
      });
    
    },

    // send the thread a message
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

      // TODO may need to allow stop always
      //if( !_p.running ){ return; } // can stop only if running

      if( _p.webworker ){
        _p.webworker.terminate();
      }

      if( _p.child ){
        _p.child.kill();
      } 

      return this.trigger('stop'); // chaining
    }

  });

  // aliases
  var fn = $$.thdfn;
  fn.promise = fn.run;
  fn.terminate = fn.halt = fn.stop;

  // higher level alias (in case you like the worker metaphor)
  $$.worker = $$.Worker = $$.Thread;

  // pull in event apis
  $$.fn.thread({
    on: $$.define.on(),
    one: $$.define.on({ unbindSelfOnTrigger: true }),
    once: $$.define.on({ unbindAllBindersOnTrigger: true }),
    off: $$.define.off(), 
    trigger: $$.define.trigger()
  });

  $$.define.eventAliasesOn( $$.thdfn );
  
})( cytoscape, typeof window === 'undefined' ? null : window );
