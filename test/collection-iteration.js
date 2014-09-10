var expect = require('chai').expect;
var cytoscape = require('../build/cytoscape.js', cytoscape);

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

  it('eles.each()', function(){
    var count = 0;

    cy.nodes().each(function( i, ele ){
      expect( cytoscape.is.elementOrCollection(this) ).to.be.true;
      expect( cytoscape.is.elementOrCollection(ele) ).to.be.true;
      expect( i ).to.equal( count );

      count++;
    });

    expect( count ).to.equal(3);
  });

  it('eles.forEach()', function(){
    var count = 0;

    cy.nodes().forEach(function( ele, i, eles ){
      expect( cytoscape.is.elementOrCollection(ele) ).to.be.true;
      expect( cytoscape.is.elementOrCollection(eles) ).to.be.true;
      expect( i ).to.equal( count );

      count++;
    });

    expect( count ).to.equal(3);
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