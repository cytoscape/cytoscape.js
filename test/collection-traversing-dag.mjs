import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

var ids = eles => eles.map( ele => ele.id() ).sort();

describe('gpu/collection: DAG traversal, edge relations, components', function(){

  // n1 -> n2 -> n3 ; n1 -> n3 ; isolated n4 ; parallel n1->n2 (e1b) ; n2->n1 (e2r)
  var cy;

  beforeEach(function(){
    cy = cytoscape({
      elements: [
        { data: { id: 'n1' } },
        { data: { id: 'n2' } },
        { data: { id: 'n3' } },
        { data: { id: 'n4' } },
        { data: { id: 'e12', source: 'n1', target: 'n2' } },
        { data: { id: 'e12b', source: 'n1', target: 'n2' } },
        { data: { id: 'e23', source: 'n2', target: 'n3' } },
        { data: { id: 'e13', source: 'n1', target: 'n3' } },
        { data: { id: 'e21', source: 'n2', target: 'n1' } }
      ]
    });
  });

  it('roots() = nodes with no non-loop incoming edge', function(){
    expect( ids( cy.nodes().roots() ) ).to.deep.equal(['n4']);
  });

  it('leaves() = nodes with no non-loop outgoing edge', function(){
    expect( ids( cy.nodes().leaves() ) ).to.deep.equal(['n3', 'n4']);
  });

  it('roots() with a self-loop still counts as a root', function(){
    var cy2 = cytoscape({ elements: [
      { data: { id: 'a' } },
      { data: { id: 'loop', source: 'a', target: 'a' } }
    ] });

    expect( ids( cy2.nodes().roots() ) ).to.deep.equal(['a']);
    expect( ids( cy2.nodes().leaves() ) ).to.deep.equal(['a']);
  });

  it('successors() = transitive outgoing closure (nodes + edges)', function(){
    expect( ids( cy.$id('n1').successors().nodes() ) ).to.deep.equal(['n1', 'n2', 'n3']);
    expect( ids( cy.$id('n1').successors({ group: 'nodes' }) ) ).to.deep.equal(['n1', 'n2', 'n3']);
  });

  it('predecessors() = transitive incoming closure', function(){
    expect( ids( cy.$id('n3').predecessors({ group: 'nodes' }) ) ).to.deep.equal(['n1', 'n2']);
  });

  it('parallelEdges() includes the edge itself + same-direction + opposite', function(){
    // e12 shares endpoints with e12b (parallel, same dir) and e21 (opposite)
    expect( ids( cy.$id('e12').parallelEdges() ) ).to.deep.equal(['e12', 'e12b', 'e21']);
  });

  it('codirectedEdges() only same direction', function(){
    expect( ids( cy.$id('e12').codirectedEdges() ) ).to.deep.equal(['e12', 'e12b']);
  });

  it('edgesWith() = edges connecting this to others, either direction', function(){
    expect( ids( cy.$id('n1').edgesWith( cy.$id('n2') ) ) ).to.deep.equal(['e12', 'e12b', 'e21']);
  });

  it('edgesTo() = directed edges from this to others', function(){
    expect( ids( cy.$id('n1').edgesTo( cy.$id('n2') ) ) ).to.deep.equal(['e12', 'e12b']);
    expect( ids( cy.$id('n2').edgesTo( cy.$id('n1') ) ) ).to.deep.equal(['e21']);
  });

  it('edgesWith() accepts another collection', function(){
    expect( ids( cy.$id('n2').edgesWith( cy.$id('n3') ) ) ).to.deep.equal(['e23']);
  });

  it('components() splits the graph into connected components', function(){
    var comps = cy.elements().components();

    expect( comps.length ).to.equal( 2 );

    var byNodes = comps.map( c => ids( c.nodes() ) ).sort();

    expect( byNodes ).to.deep.equal([ ['n1', 'n2', 'n3'], ['n4'] ]);
  });

  it('components() includes internal edges', function(){
    var big = cy.elements().components().find( c => c.nodes().length === 3 );

    expect( ids( big.edges() ) ).to.deep.equal(['e12', 'e12b', 'e13', 'e21', 'e23']);
  });

  it('component() = whole-graph component containing the element', function(){
    expect( ids( cy.$id('n2').component().nodes() ) ).to.deep.equal(['n1', 'n2', 'n3']);
    expect( ids( cy.$id('n4').component().nodes() ) ).to.deep.equal(['n4']);
  });

});
