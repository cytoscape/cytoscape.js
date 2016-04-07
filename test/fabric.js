/*! Weaver licensed under MIT (https://tldrlegal.com/license/mit-license), copyright Max Franz */

var expect = require('chai').expect;
var cytoscape = require('../src', cytoscape);
var $$ = cytoscape;
var isNode = typeof module !== 'undefined';

describe('Fabric', function(){

  var fabric;

  if( isNode ){
    var cwd = process.cwd();

    before(function(){
      process.chdir('./test');
    });

    after(function(){
      process.chdir( cwd );
    });
  }

  beforeEach(function(){
    fabric = $$.Fabric();
  });

  afterEach(function(){
    fabric.stop();
  });

  it('gets a random thread', function(){
    var t = fabric.random();

    expect( t.instanceString() === 'thread' ).to.be.true;
  });

  it('runs on a random thread', function( next ){
    var t = fabric.random();

    t.promise(function(){
      return 1;
    }).then(function( n ){
      expect( n ).to.equal(1);

      next();
    });
  });

  it('runs with passed data on a random thread', function( next ){
    var t = fabric.random();

    t.pass( 1 ).promise(function( n ){
      return n;
    }).then(function( n ){
      expect( n ).to.equal(1);

      next();
    });
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

  it('maps correctly via return', function( next ){
    fabric.pass([ 1, 2, 3 ]).map(function( n ){
      return ( 4 - n );
    }).then(function( mapped ){
      expect( mapped ).to.deep.equal([ 3, 2, 1 ]);
      next();
    });
  });

  it('filters correctly', function( next ){
    fabric.pass([ -3, -2, -1, 0, 1, 2, 3 ]).filter(function( n ){
      resolve( n > 0 );
    }).then(function( filtered ){
      expect( filtered ).to.deep.equal([ 1, 2, 3 ]);
      next();
    });
  });

  it('filters correctly via return', function( next ){
    fabric.pass([ -3, -2, -1, 0, 1, 2, 3 ]).filter(function( n ){
      return ( n > 0 );
    }).then(function( filtered ){
      expect( filtered ).to.deep.equal([ 1, 2, 3 ]);
      next();
    });
  });

  it('sorts with no function', function( next ){
    fabric.pass([ 8, 3, 4, 7, 2, 9, 5, 1, 6, 0 ]).sort().then(function( sorted ){
      expect( sorted ).to.deep.equal([ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 ]);
      next();
    });
  });

  it('sorts with a function', function( next ){
    fabric.pass([ 8, 3, 4, 7, 2, 9, 5, 1, 6, 0 ]).sort(function(a, b){
      return b - a;
    }).then(function( sorted ){
      expect( sorted ).to.deep.equal([ 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 ]);
      next();
    });
  });

});
