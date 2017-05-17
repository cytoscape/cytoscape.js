var expect = require('chai').expect;
var cytoscape = require('../src/test.js', cytoscape);

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

  it('eles.edgesWith() same eles', function(){
    expect( cy.$('#n1, #n2').edgesWith('#n1, #n2').same(n1n2) ).to.be.true;
  });

  it('eles.edgesWith() intersecting eles', function(){
    expect( cy.$('#n1, #n2').edgesWith('#n1').same(n1n2) ).to.be.true;
  });

  it('eles.edgesTo()', function(){
    expect( n1.edgesTo(n2).same(n1n2) ).to.be.true;
    expect( n1.edgesTo(n3).empty() ).to.be.true;
    expect( n2.edgesTo(n3).same(n2n3) ).to.be.true;
    expect( n3.edgesTo(n2).empty() ).to.be.true;
  });

  it('eles.edgesTo() same eles', function(){
    expect( cy.$('#n1, #n2').edgesTo('#n1, #n2').same(n1n2) ).to.be.true;
  });

  it('eles.edgesTo() intersecting eles', function(){
    expect( cy.$('#n1, #n2').edgesTo('#n2').same(n1n2) ).to.be.true;
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

  it('eles.sources(), eles.targets()', function(){
    expect( cy.elements().sources().same( n1.add(n2) ) ).to.be.true;
    expect( cy.elements().targets().same( n2.add(n3) ) ).to.be.true;
  });

  it('edges.parallelEdges()', function(){
    var e = cy.add({
      group: 'edges',
      data: { source: 'n1', target: 'n2', id: 'e' }
    });

    expect( n1n2.parallelEdges().same( e.add(n1n2) ) ).to.be.true;
  });

  it('edges.codirectedEdges()', function(){
    var e = cy.add({
      group: 'edges',
      data: { source: 'n1', target: 'n2', id: 'e' }
    });

    expect( n1n2.codirectedEdges().same( e.add(n1n2) ) ).to.be.true;
  });

  it('nodes.roots()', function(){
    expect( cy.nodes().roots().same(n1) ).to.be.true;
  });

  it('nodes.leaves()', function(){
    expect( cy.nodes().leaves().same(n3) ).to.be.true;
  });

  it('nodes.incomers()', function(){
    expect( n2.incomers().same( n1.add(n1n2) ) ).to.be.true;

    // now check if it works w/ loops and cycles
    var loop = cy.add({ group: 'edges', data: { id: 'loop', source: 'n2', target: 'n2' } });

    expect( n2.outgoers().same('#n1, #n1n2, #n2, #loop') );
  });

  it('nodes.outgoers()', function(){
    expect( n2.outgoers().same( n2n3.add(n3) ) ).to.be.true;

    // now check if it works w/ loops and cycles
    var loop = cy.add({ group: 'edges', data: { id: 'loop', source: 'n2', target: 'n2' } });

    expect( n2.outgoers().same('#n2, #loop, #n2n3, #n3') );
  });

  it('nodes.predecessors()', function(){
    expect( n2.predecessors().same( n1.add(n1n2) ) ).to.be.true;

    // now check if it works w/ loops and cycles
    var loop = cy.add({ group: 'edges', data: { id: 'loop', source: 'n2', target: 'n2' } });
    var dagbreaker = cy.add({ group: 'edges', data: { id: 'dagbreaker', source: 'n3', target: 'n1' } });

    expect( n2.predecessors().same( cy.elements() ) ).to.be.true;
  });

  it('nodes.successors()', function(){
    expect( n2.successors().same( n2n3.add(n3) ) ).to.be.true;

    // now check if it works w/ loops and cycles
    var loop = cy.add({ group: 'edges', data: { id: 'loop', source: 'n2', target: 'n2' } });
    var dagbreaker = cy.add({ group: 'edges', data: { id: 'dagbreaker', source: 'n3', target: 'n1' } });

    expect( n2.successors().same( cy.elements() ) ).to.be.true;
  });

  it('eles.components() 1 component', function(){
    var cy = cytoscape({
      elements: [
        { data: { id: 'n1' } },
        { data: { id: 'n2' } },
        { data: { id: 'n1n2', source: 'n1', target: 'n2' } }
      ]
    });

    expect( cy.$().components().length ).to.equal(1);

    cy.$().components().forEach(function( c ){
      expect( c.length ).to.equal(3);
    });
  });

  it('eles.components() 2 components', function(){
    var cy = cytoscape({
      elements: [
        { data: { id: 'n1' } },
        { data: { id: 'n2' } },
        { data: { id: 'n1n2', source: 'n1', target: 'n2' } },

        { data: { id: 'n3' } },
        { data: { id: 'n4' } },
        { data: { id: 'n3n4', source: 'n3', target: 'n4' } }
      ]
    });

    expect( cy.$().components().length ).to.equal(2);

    cy.$().components().forEach(function( c ){
      expect( c.length ).to.equal(3);
    });
  });

  it('eles.components() 3 components', function(){
    var cy = cytoscape({
      elements: [
        { data: { id: 'n1' } },
        { data: { id: 'n2' } },
        { data: { id: 'n1n2', source: 'n1', target: 'n2' } },

        { data: { id: 'n3' } },
        { data: { id: 'n4' } },
        { data: { id: 'n3n4', source: 'n3', target: 'n4' } },

        { data: { id: 'n5' } },
        { data: { id: 'n6' } },
        { data: { id: 'n5n6', source: 'n5', target: 'n6' } }
      ]
    });

    expect( cy.$().components().length ).to.equal(3);

    cy.$().components().forEach(function( c ){
      expect( c.length ).to.equal(3);
    });
  });

  it('eles.components() 2 components and eles check', function(){
    var cy = cytoscape({
      elements: [
        { data: { id: 'n1' } },
        { data: { id: 'n2' } },
        { data: { id: 'n1n2', source: 'n1', target: 'n2' } },

        { data: { id: 'n3' } },
        { data: { id: 'n4' } },
        { data: { id: 'n3n4', source: 'n3', target: 'n4' } },
        { data: { id: 'n4n3', source: 'n4', target: 'n3' } }
      ]
    });

    expect( cy.$().components().length ).to.equal(2);

    var cs = cy.$().components().sort(function( c1, c2 ){
      return c1.length - c2.length;
    });

    expect( cs[0].length ).to.equal(3);
    expect( cs[1].length ).to.equal(4);

    expect( cs[0].same('#n1, #n2, #n1n2') ).to.be.true;
    expect( cs[1].same('#n3, #n4, #n3n4, #n4n3') ).to.be.true;
  });

  it('eles.components() of subgraph', function(){
    var cy = cytoscape({
      elements: [
        { data: { id: 'n1' } },
        { data: { id: 'n2' } },
        { data: { id: 'n1n2', source: 'n1', target: 'n2' } },

        { data: { id: 'n3' } },
        { data: { id: 'n4' } },
        { data: { id: 'n3n4', source: 'n3', target: 'n4' } },

        { data: { id: 'n5' } },
        { data: { id: 'n6' } },
        { data: { id: 'n5n6', source: 'n5', target: 'n6' } }
      ]
    });

    var components = cy.$('#n1,#n2,#n1n2, #n3').components();

    expect( components.length ).to.equal(2);

    var cs = components.sort(function( c1, c2 ){
      return c1.length - c2.length;
    });

    expect( cs.length ).to.equal(2);

    expect( cs[0].length ).to.equal(1);
    expect( cs[1].length ).to.equal(3);

    expect( cs[0].same('#n3') ).to.be.true;
    expect( cs[1].same('#n1, #n2, #n1n2') ).to.be.true;
  });

  it('eles.components() of connected subgraph', function(){
    var cy = cytoscape({
      elements: [
        { data: { id: 'n1' } },
        { data: { id: 'n2' } },
        { data: { id: 'n1n2', source: 'n1', target: 'n2' } }
      ]
    });

    var components = cy.$('#n1, #n2').components();
    var cs = components;

    expect( cs.length ).to.equal(2);

    expect( cs[0].length ).to.equal(1);
    expect( cs[1].length ).to.equal(1);

    if( cs[0].same('#n1') ){
      expect( cs[1].same('#n2') ).to.be.true;
    } else if( cs[0].same('#n2') ){
      expect( cs[1].same('#n1') ).to.be.true;
    } else {
      throw 'Not #n1 or #n2';
    }
  });

  it('eles.components() of empty graph', function(){
    var cy = cytoscape();

    var components = cy.elements().components();
    var cs = components;

    expect( cs.length ).to.equal(0);
  });

});
