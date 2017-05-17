var expect = require('chai').expect;
var cytoscape = require('../src/test.js', cytoscape);

var is = {
  elementOrCollection: function(o){
    return o != null && o.instanceString && o.instanceString() === 'collection';
  },

  number: function(o){ return typeof o === 'number'; }
};

describe('Collection iteration', function(){

  var cy;

  // test setup
  beforeEach(function(done){
    cytoscape({
      elements: {
        nodes: [
            { data: { id: 'n1' } },
            { data: { id: 'n2' } },
            { data: { id: 'n3' } }
        ],

        edges: [
            { data: { id: 'n1n2', source: 'n1', target: 'n2' } },
            { data: { id: 'n2n3', source: 'n2', target: 'n3' } }
        ]
      },
      ready: function(){
        cy = this;

        done();
      }
    });
  });

  it('eles.size()', function(){
    expect( cy.$('node').size() ).to.equal(3);
    expect( cy.$('node').length ).to.equal(3);
    expect( cy.$('#n1, #n2').size() ).to.equal(2);
    expect( cy.$('#n1, #n2').length ).to.equal(2);
  });

  it('eles.empty() etc', function(){
    expect( cy.$('node[foo]').empty() ).to.be.true;
    expect( cy.$('node[foo]').nonempty() ).to.be.false;
    expect( cy.$('node').empty() ).to.be.false;
    expect( cy.$('node').nonempty() ).to.be.true;
  });

  it('eles.forEach()', function(){
    var count = 0;
    var that = {};

    cy.nodes().forEach(function( ele, i, eles ){
      expect( is.elementOrCollection(ele) ).to.be.true;
      expect( is.elementOrCollection(eles) ).to.be.true;
      expect( i ).to.equal( count );
      expect( this ).to.equal( that );

      count++;
    }, that);

    expect( count ).to.equal(3);
  });

  it('eles.reduce()', function(){
    var eles = cy.$('#n1, #n2, #n3');
    var index = 0;
    var vals =  [1, 2, 3];
    var prevs = [0, 1, 3];
    var end = 1 + 2 + 3;
    var sum = function( a, b ){ return a + b; }

    eles.forEach(function( ele, i ){
      ele.data( 'foo', vals[i] );
    });
    
    var callback = function( prev, ele, i, eles ){
      expect( index++, 'i' ).to.equal( i );

      expect( eles[0].same( cy.$('#n1') ), 'n1' ).to.be.true;
      expect( eles[1].same( cy.$('#n2') ), 'n2' ).to.be.true;
      expect( eles[2].same( cy.$('#n3') ), 'n3' ).to.be.true;

      expect( ele.same( eles[i] ), 'ele' ).to.be.true;

      expect( prev, 'prev' ).to.equal( prevs[i] );

      return prev + ele.data('foo');
    };

    expect( eles.reduce( callback, 0 ), 'ret' ).to.equal( end );
  });

  it('eles.eq()', function(){
    expect( cy.$('#n1, #n2').eq(0).id() ).to.equal('n1');
    expect( cy.$('#n1, #n2').eq(1).id() ).to.equal('n2');
  });

  it('eles.slice()', function(){
    expect( cy.nodes().slice().same( cy.nodes() ) ).to.be.true;
    expect( cy.nodes().slice(1).same( cy.$('#n2, #n3') ) ).to.be.true;
    expect( cy.nodes().slice(1, 2).same( cy.$('#n2') ) ).to.be.true;
    expect( cy.nodes().slice(1, -1).same( cy.$('#n2') ) ).to.be.true;
  });

});
