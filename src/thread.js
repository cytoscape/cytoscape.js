// cross-env thread/worker
// NB : uses (heavyweight) processes on nodejs so best not to create too many threads

;(function($$, window){ 'use strict';

  $$.Thread = function( fn ){
    if( !(this instanceof $$.Thread) ){
      return new $$.Thread( fn );
    }

    var _p = this._private = {
      requires: [],
      queue: null,
      pass: []
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

  var stringifyFieldVal = function( val ){
    var valStr = $$.is.fn( val ) ? val.toString() : 'JSON.parse("' + JSON.stringify(val) + '")';

    return valStr;
  };

  // allows for requires with prototypes and subobjs etc
  var fnAsRequire = function( fn ){
    var req = ( $$.is.string(fn) ? fn : fn.toString() ) + '\n';

    // pull in prototype
    if( fn.prototype && fn.name != null ){

      var protoStr = '';
      for( var name in fn.prototype ){
        var val = fn.prototype[ name ];
        var valStr = stringifyFieldVal( val );

        protoStr += fn.name + '.prototype.' + name + ' = ' + valStr + ';\n';
      }

      if( protoStr ){
        req += protoStr;
      }
    
    }

    // pull in properties for obj/fns
    if( !$$.is.string(fn) ){ for( var name in fn ){
      var propsStr = '';

      if( fn.hasOwnProperty(name) ){
        var val = fn[ name ];
        var valStr = stringifyFieldVal( val );

        propsStr += fn.name + '["' + name + '"] = ' + valStr + ';\n';
      }

      if( propsStr ){
        req += propsStr;
      }
    } }

    return req;
  };

  $$.fn.thread({

    require: function( fn ){
      this._private.requires.push( fn );

      return this; // chaining
    },

    pass: function( data ){
      if( $$.is.element(data) ){
        data = data.json();
      } else if( $$.is.collection(data) ){
        data = data.jsons();
      }

      this._private.pass.push( data );

      return this; // chaining
    },

    run: function( fn, pass ){ // fn used like main()
      var self = this;
      var _p = this._private;
      pass = pass || _p.pass.shift();

      if( _p.stopped ){
        $$.util.error('Attempted to run a stopped thread!  Start a new thread or do not stop the existing thread and reuse it.');
        return;
      }

      if( _p.running ){
        return _p.queue = _p.queue.then(function(){ // inductive step
          return self.run( fn, pass );
        });
      }

      self.trigger('run');

      var runP = new $$.Promise(function( resolve, reject ){

        _p.running = true;

        var threadTechAlreadyExists = _p.ran;

        // worker code to exec
        var fnStr = ( _p.requires.map(function( r ){
          return fnAsRequire( r );
        }) ).concat([ '(' + fn.toString() + ')(' + JSON.stringify(pass) + ');\n' ]).join('\n');

        // because we've now consumed the requires, empty the list so we don't dupe on next run()
        _p.requires = [];

        if( window ){
          var fnBlob, fnUrl;

          // add normalised thread api functions
          if( !threadTechAlreadyExists ){
            fnStr += 'function broadcast(m){ return message(m); };\n'; // alias
            fnStr += 'function message(m){ postMessage(m); };\n';
            fnStr += 'function listen(fn){\n';
            fnStr += '  self.addEventListener("message", function(m){ \n';
            fnStr += '    if( typeof m === "object" && (m.data.$$eval || m.data === "$$start") ){\n';
            fnStr += '    } else { \n';
            fnStr += '      fn( m.data );\n';
            fnStr += '    }\n'
            fnStr += '  });\n'
            fnStr += '};\n'; 
            fnStr += 'self.addEventListener("message", function(m){  if( m.data.$$eval ){ eval( m.data.$$eval ); }  });\n';
            fnStr += 'function resolve(v){ postMessage({ $$resolve: v }); };\n'; 
          
            fnBlob = new Blob([ fnStr ], {
              type: 'application/javascript'
            });
            fnUrl = window.URL.createObjectURL( fnBlob );
          }
          // create webworker and let it exec the serialised code
          var ww = _p.webworker = _p.webworker || new Worker( fnUrl );

          if( threadTechAlreadyExists ){ // then just exec new run() code
            ww.postMessage({
              $$eval: fnStr
            });
          }

          // worker messages => events
          var cb;
          ww.addEventListener('message', cb = function( m ){
            if( $$.is.object(m) && $$.is.object( m.data ) && ('$$resolve' in m.data) ){
              ww.removeEventListener('message', cb); // done listening b/c resolve()

              resolve( m.data.$$resolve );
            } else {
              self.trigger( new $$.Event(m, { type: 'message', message: m.data }) );
            }
          }, false);

          if( !threadTechAlreadyExists ){
            ww.postMessage('$$start'); // start up the worker
          }

        } else if( typeof module !== 'undefined' ){
          // create a new process
          var path = require('path');
          var child_process = require('child_process');
          var child = _p.child = _p.child || child_process.fork( path.join(__dirname, 'thread-node-fork') );

          // child process messages => events
          var cb;
          child.on('message', cb = function( m ){
            if( $$.is.object(m) && ('$$resolve' in m) ){
              child.removeListener('message', cb); // done listening b/c resolve()

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
          $$.error('Tried to create thread but no underlying tech found!');
          // TODO fallback on main JS thread?
        }

      }).then(function( v ){
        _p.running = false;
        _p.ran = true;

        self.trigger('ran');

        return v;
      });

      if( _p.queue == null ){
        _p.queue = runP; // i.e. first step of inductive promise chain (for queue)
      }

      return runP;
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

      if( _p.webworker ){
        _p.webworker.terminate();
      }

      if( _p.child ){
        _p.child.kill();
      } 

      _p.stopped = true;

      return this.trigger('stop'); // chaining
    },

    stopped: function(){
      return this._private.stopped;
    }

  });

  // return fn impl as string with specified _$_$_name as new function name
  var $$fnImpl = function( fn, name ){
    var fnStr = fn.toString();
    fnStr = fnStr.replace(/function.*\(/, 'function _$_$_' + name + '(');

    return fnStr;
  };

  $$.fn.thread({
    reduce: function( fn ){
      var fnStr = $$fnImpl( fn, 'reduce' );

      this.require( fnStr );

      return this.run(function( data ){
        var ret = data.reduce( _$_$_reduce );

        resolve( ret );
      });
    },

    reduceRight: function( fn ){
      var fnStr = $$fnImpl( fn, 'reduceRight' );

      this.require( fnStr );

      return this.run(function( data ){
        var ret = data.reduceRight( _$_$_reduceRight );

        resolve( ret );
      });
    },

    map: function( fn ){
      var fnStr = $$fnImpl( fn, 'map' );

      this.require( fnStr );

      return this.run(function( data ){
        var ret = data.map( _$_$_map );

        resolve( ret );
      });
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
