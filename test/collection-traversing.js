var expect = require('chai').expect;
var cytoscape = require('../build/cytoscape.js', cytoscape);

describe('Collection traversing', function(){

  var cy, n1, n2, n3, n1n2, n2n3;

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
        n1 = cy.$('#n1');
        n2 = cy.$('#n2');
        n3 = cy.$('#n3');
        n1n2 = cy.$('#n1n2');
        n2n3 = cy.$('#n2n3');

        done();
      }
    });
  });

  it('eles.neighborhood() etc', function(){
    var nbhd = cy.$('#n2').neighborhood();

    expect( nbhd.same( cy.$('#n1, #n3, #n1n2, #n2n3') ) ).to.be.true;
    expect( cy.$('#n1').neighborhood().same( cy.$('#n2, #n1n2') ) ).to.be.true;
    expect( cy.$('#n2').closedNeighborhood().same( cy.$('#n1, #n2, #n3, #n1n2, #n2n3') ) ).to.be.true;
  });

  it('eles.edgesWith()', function(){
    expect( n1.edgesWith(n2).same(n1n2) ).to.be.true;
    expect( n1.edgesWith(n3).empty() ).to.be.true;
    expect( n2.edgesWith(n3).same(n2n3) ).to.be.true;
  });

  it('eles.edgesTo()', function(){
    expect( n1.edgesTo(n2).same(n1n2) ).to.be.true;
    expect( n1.edgesTo(n3).empty() ).to.be.true;
    expect( n2.edgesTo(n3).same(n2n3) ).to.be.true;
    expect( n3.edgesTo(n2).empty() ).to.be.true;
  });

  it('eles.connectedNodes()', function(){
    expect( n1n2.connectedNodes().same( n1.add(n2) ) ).to.be.true;
    expect( n2n3.connectedNodes().same( n2.add(n3) ) ).to.be.true;
  });

  it('nodes.connectedEdges()', function(){
    expect( n1.connectedEdges().same( n1n2 ) ).to.be.true;
    expect( n2.connectedEdges().same( n1n2.add(n2n3) ) ).to.be.true;
    expect( n3.connectedEdges().same( n2n3 ) ).to.be.true;
  });

  it('eles.source(), eles.target()', function(){
    expect( n1n2.source().same(n1) ).to.be.true;
    expect( n1n2.target().same(n2) ).to.be.true;
    expect( n2n3.source().same(n2) ).to.be.true;
    expect( n2n3.target().same(n3) ).to.be.true;
  });

  it('edges.parallelEdges()', function(){
    var e = cy.add({
      group: 'edges',
      data: { source: 'n1', target: 'n2', id: 'e' }
    });

    console.log(e)

    expect( n1n2.parallelEdges().same( e.add(n1n2) ) ).to.be.true;
  });

  it('edges.codirectedEdges()', function(){
    var e = cy.add({
      group: 'edges',
      data: { source: 'n1', target: 'n2', id: 'e' }
    });

    expect( n1n2.codirectedEdges().same( e.add(n1n2) ) ).to.be.true;
  });

  it('eles.breadthFirstSearch()', function(){
    var ids = [];

    n1.breadthFirstSearch(function(i, depth){
      ids.push( this.id() );
    });

    expect( ids ).to.deep.equal(['n1', 'n2', 'n3']);
  });

  it('eles.breadthFirstSearch() undirected', function(){
    var ids = [];

    n3.breadthFirstSearch(function(i, depth){
      ids.push( this.id() );
    });    

    expect( ids ).to.deep.equal(['n3', 'n2', 'n1']);
  });

});