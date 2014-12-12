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

  it('multiple runs per thread forbidden', function( next ){
    var t = $$.Thread();

    $$.Promise.all([ // both workers done
      t.run(function(){
        resolve( 1 );
      }),

      t.run(function(){
        resolve( 2 );
      })
    ]).then(function( thens ){
      expect( thens ).to.be.undefined;

      t.stop();

      next();
    }, function( err ){
      t.stop();

      next();
    });
  });

});