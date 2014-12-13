var expect = require('chai').expect;
var cytoscape = require('../build/cytoscape.js', cytoscape);
var $$ = cytoscape;

describe('Thread', function(){

  var cy;

  before(function(next){
    cy = cytoscape({
      ready: function(){
        next();
      }
    });
  });

  it('resolves a simple value', function( next ){
    var t = $$.Thread();

    t.run(function(){
      resolve( 3 );
    }).then(function( val ){
      expect( val ).to.equal(3);

      t.stop();

      next();
    });
  });

  it('reports as stopped when stopped', function( next ){
    var t = $$.Thread();

    t.run(function(){
      resolve( 3 );
    }).then(function( val ){
      t.stop();

      expect( t.stopped() ).to.be.true;

      next();
    });
  });

  it('works with 2 threads at once', function( next ){
    var t1 = $$.Thread();
    var t2 = $$.Thread();

    $$.Promise.all([ // both threads done
      t1.run(function(){
        resolve( 1 );
      }),

      t2.run(function(){
        resolve( 2 );
      })
    ]).then(function( thens ){
      var v1 = thens[0];
      var v2 = thens[1];

      expect( v1 ).to.equal( 1 );
      expect( v2 ).to.equal( 2 );

      t1.stop();
      t2.stop();

      next();
    });
  });

  it('hears a message and roundtrips back', function( next ){
    var t = $$.Thread();
    var msg;

    t.run(function(){
      listen(function( m ){
        message(m);
      });
    });

    t.on('message', function(e){
      expect( e.message ).to.equal('hello there');

      t.stop();

      next();
    });

    t.message('hello there');
  });

  it('requires a named function', function( next ){
    var t = $$.Thread();
    
    function foo(){
      return 'bar';
    }

    t.require( foo );

    t.run(function(){
      message( foo() );
    });

    t.on('message', function(e){
      expect( e.message ).to.equal('bar');

      t.stop();

      next();
    });
  });

  // TODO this isn't supported in the api yet...
  it('requires a function with a prototype', function( next ){
    var t = $$.Thread();
    
    function foo(){
      
    }

    foo.prototype.bar = function(){
      return 'baz';
    };

    t.require( foo );

    t.run(function(){
      message( foo.bar() );
    });

    t.on('message', function(e){
      expect( e.message ).to.equal('baz');

      t.stop();

      next();
    });
  });

  it('calls multiple runs in order', function( next ){
    var t = $$.Thread();
    var thens = [];

    t.run(function(){
      console.log('resolve(0)');

      resolve( 0 );
    }).then(function( r ){
      thens.push( r );
    });

    t.run(function(){
      console.log('resolve(1)');

      resolve( 1 );
    }).then(function( r ){
      thens.push( r );
    });

    t.run(function(){
      console.log('resolve(2)');

      resolve( 2 );
    }).then(function( r ){
      thens.push( r );
    });

    setTimeout(function(){
      expect( thens ).to.deep.equal([ 0, 1, 2 ]);

      t.stop();

      next();
    }, 250);
  });

  it('passes a string param', function( next ){
    var t = $$.Thread();

    t.pass('foo').run(function( param ){
      broadcast( param );
    });

    t.on('message', function(e){
      expect( e.message ).to.equal('foo');

      t.stop();

      next();
    });
  });

  it('passes an object param', function( next ){
    var t = $$.Thread();

    t.pass({ foo: 'bar' }).run(function( param ){
      broadcast( param );
    });

    t.on('message', function(e){
      expect( e.message ).to.deep.equal({ foo: 'bar' });

      t.stop();

      next();
    });
  });

  it('passes correctly for multiple runs', function( next ){
    var t = $$.Thread();
    var vals = [];

    t.pass('alpha').run(function( param ){
      resolve( param + '-beta' );
    }).then(function( val ){
      vals.push( val );
    });

    t.pass('gamma').run(function( param ){
      resolve( param + '-delta' );
    }).then(function( val ){
      vals.push( val );
    });

    t.pass('epsilon').run(function( param ){
      resolve( param + '-zeta' );
    }).then(function( val ){
      vals.push( val );
    });

    setTimeout(function(){
      expect( vals.length ).to.equal(3);

      for( var i = 0; i < vals.length; i++ ){
        var val = vals[i];
        var ls = val.split('-');

        if( ls[0] === 'alpha' ){
          expect( ls[1] ).to.equal('beta');
        } else if( ls[0] === 'gamma' ){
          expect( ls[1] ).to.equal('delta');
        } else if( ls[0] === 'epsilon' ){
          expect( ls[1] ).to.equal('zeta');
        }
      }

      t.stop();
      next();
    }, 250);

  });

});