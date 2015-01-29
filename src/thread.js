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
    var req;
    var fnName;

    if( $$.is.object(fn) && fn.fn ){ // manual fn
      req = fnAs( fn.fn, fn.name );
      fnName = fn.name;
      fn = fn.fn;
    } else if( $$.is.fn(fn) ){ // auto fn
      req = fn.toString();
      fnName = fn.name;
    } else if( $$.is.string(fn) ){ // stringified fn
      req = fn;
    } else if( $$.is.object(fn) ){ // plain object
      if( fn.proto ){
        req = '';
      } else {
        req = fn.name + ' = {};';
      }

      fnName = fn.name;
      fn = fn.obj;
    }

    req += '\n';

    var protoreq = function( val, subname ){
      if( val.prototype ){
        var protoNonempty = false;
        for( var prop in val.prototype ){ protoNonempty = true; break; };

        if( protoNonempty ){
          req += fnAsRequire( {
            name: subname,
            obj: val,
            proto: true
          }, val );
        }
      }
    };

    // pull in prototype
    if( fn.prototype && fnName != null ){

      for( var name in fn.prototype ){
        var protoStr = '';

        var val = fn.prototype[ name ];
        var valStr = stringifyFieldVal( val );
        var subname = fnName + '.prototype.' + name;

        protoStr += subname + ' = ' + valStr + ';\n';

        if( protoStr ){
          req += protoStr;
        }

        protoreq( val, subname ); // subobject with prototype
      }
  
    }

    // pull in properties for obj/fns
    if( !$$.is.string(fn) ){ for( var name in fn ){
      var propsStr = '';

      if( fn.hasOwnProperty(name) ){
        var val = fn[ name ];
        var valStr = stringifyFieldVal( val );
        var subname = fnName + '["' + name + '"]';

        propsStr += subname + ' = ' + valStr + ';\n';
      }

      if( propsStr ){
        req += propsStr;
      }

      protoreq( val, subname ); // subobject with prototype
    } }

    return req;
  };

  $$.fn.thread({

    require: function( fn, as ){
      if( as ){
        if( $$.is.fn(fn) ){
          // disabled b/c doesn't work with forced names on functions w/ prototypes
          //fn = fnAs( fn, as );

          as = as || fn.name;

          fn = { name: as, fn: fn };
        } else {
          fn = { name: as, obj: fn };
        }
      }

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

        var fnImplStr = $$.is.string( fn ) ? fn : fn.toString();

        // worker code to exec
        var fnStr = '\n' + ( _p.requires.map(function( r ){
          return fnAsRequire( r );
        }) ).concat([
          '( function(){',
            'var ret = (' + fnImplStr + ')(' + JSON.stringify(pass) + ');',
            'if( ret !== undefined ){ resolve(ret); }', // assume if ran fn returns defined value (incl. null), that we want to resolve to it
          '} )()\n'
        ]).join('\n');

        // because we've now consumed the requires, empty the list so we don't dupe on next run()
        _p.requires = [];

        if( window ){
          var fnBlob, fnUrl;

          // add normalised thread api functions
          if( !threadTechAlreadyExists ){
            var fnPre = fnStr + '';

            fnStr = [
              'function broadcast(m){ return message(m); };', // alias
              'function message(m){ postMessage(m); };',
              'function listen(fn){',
              '  self.addEventListener("message", function(m){ ',
              '    if( typeof m === "object" && (m.data.$$eval || m.data === "$$start") ){',
              '    } else { ',
              '      fn( m.data );',
              '    }',
              '  });',
              '};', 
              'self.addEventListener("message", function(m){  if( m.data.$$eval ){ eval( m.data.$$eval ); }  });',
              'function resolve(v){ postMessage({ $$resolve: v }); };', 
              'function reject(v){ postMessage({ $$reject: v }); };'
            ].join('\n');
          
            fnStr += fnPre;

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
            } else if( $$.is.object(m) && $$.is.object( m.data ) && ('$$reject' in m.data) ){
              ww.removeEventListener('message', cb); // done listening b/c reject()

              reject( m.data.$$reject );
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
            } else if( $$.is.object(m) && ('$$reject' in m) ){
              child.removeListener('message', cb); // done listening b/c reject()

              reject( m.$$reject );
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

  var fnAs = function( fn, name ){
    var fnStr = fn.toString();
    fnStr = fnStr.replace(/function.*\(/, 'function ' + name + '(');

    return fnStr;
  };

  var defineFnal = function( opts ){
    opts = opts || {};

    return function fnalImpl( fn ){
      var fnStr = fnAs( fn, '_$_$_' + opts.name );

      this.require( fnStr );

      return this.run( [ 
        'function( data ){',
        '  var origResolve = resolve;',
        '  var res = [];',
        '  ',
        '  resolve = function( val ){',
        '    res.push( val );',
        '  };',
        '  ',
        '  var ret = data.' + opts.name + '( _$_$_' + opts.name + ' );',
        '  ',
        '  resolve = origResolve;',
        '  resolve( res.length > 0 ? res : ret );',
        '}'
      ].join('\n') );
    };
  };

  $$.fn.thread({
    reduce: defineFnal({ name: 'reduce' }),

    reduceRight: defineFnal({ name: 'reduceRight' }),

    map: defineFnal({ name: 'map' })
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
