import { expect } from 'chai';
import cytoscapeGpu from '../src/gpu/index.mjs';

// ported from the in-scope assertions of test/collection-traversing.mjs
describe('gpu/collection: traversing', function(){

  var cy;

  var ids = eles => eles.map( ele => ele.id() ).sort();

  beforeEach(function(){
    cy = cytoscapeGpu({
      elements: [
        { data: { id: 'n1' } },
        { data: { id: 'n2' } },
        { data: { id: 'n3' } },
        { data: { id: 'n1n2', source: 'n1', target: 'n2' } },
        { data: { id: 'n2n3', source: 'n2', target: 'n3' } },
        { data: { id: 'n3n1', source: 'n3', target: 'n1' } }
      ]
    });
  });

  it('edge.source() and edge.target()', function(){
    expect( cy.$('#n1n2').source().id() ).to.equal('n1');
    expect( cy.$('#n1n2').target().id() ).to.equal('n2');
  });

  it('edges.sources() and edges.targets()', function(){
    expect( ids( cy.$('#n1n2, #n2n3').sources() ) ).to.deep.equal(['n1', 'n2']);
    expect( ids( cy.$('#n1n2, #n2n3').targets() ) ).to.deep.equal(['n2', 'n3']);
  });

  it('node.connectedEdges()', function(){
    expect( ids( cy.$('#n2').connectedEdges() ) ).to.deep.equal(['n1n2', 'n2n3']);
    expect( ids( cy.nodes().connectedEdges() ) ).to.deep.equal(['n1n2', 'n2n3', 'n3n1']);
  });

  it('edge.connectedNodes()', function(){
    expect( ids( cy.$('#n1n2').connectedNodes() ) ).to.deep.equal(['n1', 'n2']);
  });

  it('node.outgoers()', function(){
    expect( ids( cy.$('#n1').outgoers() ) ).to.deep.equal(['n1n2', 'n2']);
    expect( ids( cy.$('#n1').outgoers('node') ) ).to.deep.equal(['n2']);
    expect( ids( cy.$('#n1').outgoers('edge') ) ).to.deep.equal(['n1n2']);
  });

  it('node.incomers()', function(){
    expect( ids( cy.$('#n1').incomers() ) ).to.deep.equal(['n3', 'n3n1']);
    expect( ids( cy.$('#n1').incomers('node') ) ).to.deep.equal(['n3']);
  });

  it('node.neighborhood()', function(){
    expect( ids( cy.$('#n2').neighborhood() ) ).to.deep.equal(['n1', 'n1n2', 'n2n3', 'n3']);
    expect( ids( cy.$('#n2').neighborhood('node') ) ).to.deep.equal(['n1', 'n3']);
    expect( ids( cy.$('#n2').openNeighborhood() ) ).to.deep.equal(['n1', 'n1n2', 'n2n3', 'n3']);
  });

  it('node.closedNeighborhood()', function(){
    expect( ids( cy.$('#n2').closedNeighborhood() ) ).to.deep.equal(['n1', 'n1n2', 'n2', 'n2n3', 'n3']);
  });

  it('does not include removed elements in traversals', function(){
    cy.$('#n1n2').remove();

    expect( ids( cy.$('#n1').outgoers() ) ).to.deep.equal([]);
    expect( ids( cy.$('#n2').connectedEdges() ) ).to.deep.equal(['n2n3']);
  });

  describe('degree', function(){
    it('node.degree()', function(){
      expect( cy.$('#n1').degree() ).to.equal(2);
      expect( cy.$('#n2').degree() ).to.equal(2);
    });

    it('node.indegree() and node.outdegree()', function(){
      expect( cy.$('#n1').indegree() ).to.equal(1);
      expect( cy.$('#n1').outdegree() ).to.equal(1);
    });

    it('sums over a collection', function(){
      expect( cy.nodes().degree() ).to.equal(6);
    });

    it('counts loops twice in degree, once per direction', function(){
      cy.add({ data: { id: 'loop', source: 'n1', target: 'n1' } });

      expect( cy.$('#n1').degree() ).to.equal(4);
      expect( cy.$('#n1').degree(false) ).to.equal(2);
      expect( cy.$('#n1').indegree() ).to.equal(2);
      expect( cy.$('#n1').indegree(false) ).to.equal(1);
      expect( cy.$('#n1').outdegree() ).to.equal(2);
      expect( cy.$('#n1').outdegree(false) ).to.equal(1);
    });
  });

});
