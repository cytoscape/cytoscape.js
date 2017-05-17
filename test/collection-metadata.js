var expect = require('chai').expect;
var cytoscape = require('../src/test.js', cytoscape);

describe('Collection metadata', function(){

  var cy;

  // test setup
  beforeEach(function(done){
    cytoscape({
      elements: {
        nodes: [
            { data: { id: 'n1' } },
            { data: { id: 'n2' } },
            { data: { id: 'n3' } },
            { data: { id: 'n4' } },
            { data: { id: 'n5' } }
        ],

        edges: [
            { data: { id: 'n1n2', source: 'n1', target: 'n2' } },
            { data: { id: 'n2n3', source: 'n2', target: 'n3' } },
            { data: { id: 'n3n4', source: 'n3', target: 'n4' } },
            { data: { id: 'n4n5', source: 'n4', target: 'n5' } },
            { data: { id: 'n5n1', source: 'n5', target: 'n1' } },
            { data: { id: 'n1n3', source: 'n1', target: 'n3' } },
            { data: { id: 'n3n5', source: 'n3', target: 'n5' } },
            { data: { id: 'n5n2', source: 'n5', target: 'n2' } },
            { data: { id: 'n2n4', source: 'n2', target: 'n4' } },
            { data: { id: 'n4n1', source: 'n4', target: 'n1' } }
        ]
      },
      ready: function(){
        cy = this;

        done();
      }
    });
  });


  it('node.degree()', function(){
    var nodes = cy.nodes();

    for( var i = 0; i < nodes.length; i++ ){
      expect( nodes[i].degree() ).to.equal( 4 );
    }
  });

  it('node.indegree()', function(){
    var nodes = cy.nodes();

    for( var i = 0; i < nodes.length; i++ ){
      expect( nodes[i].indegree() ).to.equal( 2 );
    }
  });

  it('node.outdegree()', function(){
    var nodes = cy.nodes();

    for( var i = 0; i < nodes.length; i++ ){
      expect( nodes[i].outdegree() ).to.equal( 2 );
    }
  });

  it('nodes.totalDegree()', function(){
    expect( cy.nodes().totalDegree() ).to.equal( 4 * 5 );
  });

  it('nodes.minDegree()', function(){
    expect( cy.nodes().minDegree() ).to.equal( 4 );
  });

  it('nodes.maxDegree()', function(){
    expect( cy.nodes().maxDegree() ).to.equal( 4 );
  });

  it('nodes.minIndegree()', function(){
    expect( cy.nodes().minIndegree() ).to.equal( 2 );
  });

  it('nodes.maxIndegree()', function(){
    expect( cy.nodes().maxIndegree() ).to.equal( 2 );
  });

  it('nodes.minOutdegree()', function(){
    expect( cy.nodes().minOutdegree() ).to.equal( 2 );
  });

  it('nodes.maxOutdegree()', function(){
    expect( cy.nodes().maxOutdegree() ).to.equal( 2 );
  });

});
