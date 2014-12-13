var expect = require('chai').expect;
var cytoscape = require('../build/cytoscape.js', cytoscape);
var $$ = cytoscape;

describe('Fabric', function(){

  var fabric;

  before(function(){
    fabric = $$.Fabric();
  });

  after(function(){
    fabric.stop();
  });

  it('gets a random thread', function(){
    var t = fabric.random();

    expect( $$.is.thread(t) ).to.be.true;
  });

  it('spreads correctly', function( next ){
    fabric.pass([ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12 ]).spread(function( split ){
      var ns = [];

      for( var i = 0; i < split.length; i++ ){
        var n = split[i];

        ns.push( 13 - n );  
      }

      resolve( ns );
    }).then(function( joined ){
      expect( joined ).to.deep.equal([ 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1 ]);
      next();
    });
  });

  it('spreads correctly on small dataset', function( next ){
    fabric.pass([ 1, 2, 3 ]).spread(function( split ){
      var ns = [];

      for( var i = 0; i < split.length; i++ ){
        var n = split[i];

        ns.push( 4 - n );  
      }

      resolve( ns );
    }).then(function( joined ){
      expect( joined ).to.deep.equal([ 3, 2, 1 ]);
      next();
    });
  });

  it('maps correctly', function( next ){
    fabric.pass([ 1, 2, 3 ]).map(function( n ){
      resolve( 4 - n );
    }).then(function( mapped ){
      expect( mapped ).to.deep.equal([ 3, 2, 1 ]);
      next();
    });
  });

});