var expect = require('chai').expect;
var cytoscape = require('../build/cytoscape.js', cytoscape);
var $$ = cytoscape;

describe('Worker', function(){

  var cy;

  before(function(next){
    cy = cytoscape({
      ready: function(){
        next();
      }
    });
  });

  it('resolves a simple value', function( next ){
    var w = $$.Worker();

    w.run(function(){
      resolve( 3 );
    }).then(function( val ){
      expect( val ).to.equal(3);

      w.stop();

      next();
    });
  });

  it('works with 2 workers at once', function( next ){
    var w1 = $$.Worker();
    var w2 = $$.Worker();

    $$.Promise.all([ // both workers done
      w1.run(function(){
        resolve( 1 );
      }),

      w2.run(function(){
        resolve( 2 );
      })
    ]).then(function( thens ){
      var v1 = thens[0];
      var v2 = thens[1];

      expect( v1 ).to.equal( 1 );
      expect( v2 ).to.equal( 2 );

      w1.stop();
      w2.stop();

      next();
    });
  });

  it('hears a message and roundtrips back', function( next ){
    var w = $$.Worker();
    var msg;

    w.run(function(){
      listen(function( m ){
        message(m);
      });
    });

    w.on('message', function(e){
      expect( e.message ).to.equal('hello there');

      w.stop();

      next();
    });

    w.message('hello there');
  });

  it('requires a named function', function( next ){
    var w = $$.Worker();
    
    function foo(){
      return 'bar';
    }

    w.require( foo );

    w.run(function(){
      message( foo() );
    });

    w.on('message', function(e){
      expect( e.message ).to.equal('bar');

      w.stop();

      next();
    });
  });

  it('multiple runs per worker forbidden', function( next ){
    var w = $$.Worker();

    $$.Promise.all([ // both workers done
      w.run(function(){
        resolve( 1 );
      }),

      w.run(function(){
        resolve( 2 );
      })
    ]).then(function( thens ){
      expect( thens ).to.be.undefined;

      w.stop();

      next();
    }, function( err ){
      w.stop();

      next();
    });
  });

});