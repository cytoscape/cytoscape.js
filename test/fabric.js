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

  it('filters correctly', function( next ){
    fabric.pass([ -3, -2, -1, 0, 1, 2, 3 ]).filter(function( n ){
      resolve( n > 0 );
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

  it('passes eles', function( next ){
    var cy = cytoscape({
      headless: true,
      elements: [
        {
          group: 'nodes',
          data: { foo: 'bar' }
        },

        {
          group: 'nodes',
          data: { foo: 'baz' }
        }
      ]
    });

    var eles = cy.elements().sort(function( a, b ){
      if( a.data('foo') === 'bar' ){
        return -1;
      }

      return 1;
    });

    fabric.pass( eles ).map(function( ele ){
      resolve( ele.data.foo );
    }).then(function( mapped ){
      expect( mapped ).to.deep.equal([ 'bar', 'baz' ]);

      next();
    });
  });

});