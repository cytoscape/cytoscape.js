import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

// ported from the in-scope assertions of test/collection-traversing.mjs
describe('gpu/collection: traversing', function () {
  var cy;

  var ids = (eles) => eles.map((ele) => ele.id()).sort();

  beforeEach(function () {
    cy = cytoscape({
      elements: [
        { data: { id: 'n1' } },
        { data: { id: 'n2' } },
        { data: { id: 'n3' } },
        { data: { id: 'n1n2', source: 'n1', target: 'n2' } },
        { data: { id: 'n2n3', source: 'n2', target: 'n3' } },
        { data: { id: 'n3n1', source: 'n3', target: 'n1' } },
      ],
    });
  });

  it('edge.source() and edge.target()', function () {
    expect(cy.$id('n1n2').source().id()).to.equal('n1');
    expect(cy.$id('n1n2').target().id()).to.equal('n2');
  });

  it('edges.sources() and edges.targets()', function () {
    expect(ids(cy.$id('n1n2').union(cy.$id('n2n3')).sources())).to.deep.equal([
      'n1',
      'n2',
    ]);
    expect(ids(cy.$id('n1n2').union(cy.$id('n2n3')).targets())).to.deep.equal([
      'n2',
      'n3',
    ]);
  });

  it('node.connectedEdges()', function () {
    expect(ids(cy.$id('n2').connectedEdges())).to.deep.equal(['n1n2', 'n2n3']);
    expect(ids(cy.nodes().connectedEdges())).to.deep.equal([
      'n1n2',
      'n2n3',
      'n3n1',
    ]);
  });

  it('edge.connectedNodes()', function () {
    expect(ids(cy.$id('n1n2').connectedNodes())).to.deep.equal(['n1', 'n2']);
  });

  it('node.outgoers()', function () {
    expect(ids(cy.$id('n1').outgoers())).to.deep.equal(['n1n2', 'n2']);
    expect(ids(cy.$id('n1').outgoers({ group: 'nodes' }))).to.deep.equal([
      'n2',
    ]);
    expect(ids(cy.$id('n1').outgoers({ group: 'edges' }))).to.deep.equal([
      'n1n2',
    ]);
  });

  it('node.incomers()', function () {
    expect(ids(cy.$id('n1').incomers())).to.deep.equal(['n3', 'n3n1']);
    expect(ids(cy.$id('n1').incomers({ group: 'nodes' }))).to.deep.equal([
      'n3',
    ]);
  });

  it('node.neighborhood()', function () {
    expect(ids(cy.$id('n2').neighborhood())).to.deep.equal([
      'n1',
      'n1n2',
      'n2n3',
      'n3',
    ]);
    expect(ids(cy.$id('n2').neighborhood({ group: 'nodes' }))).to.deep.equal([
      'n1',
      'n3',
    ]);
    expect(ids(cy.$id('n2').openNeighborhood())).to.deep.equal([
      'n1',
      'n1n2',
      'n2n3',
      'n3',
    ]);
  });

  it('node.closedNeighborhood()', function () {
    expect(ids(cy.$id('n2').closedNeighborhood())).to.deep.equal([
      'n1',
      'n1n2',
      'n2',
      'n2n3',
      'n3',
    ]);
  });

  it('does not include removed elements in traversals', function () {
    cy.$id('n1n2').remove();

    expect(ids(cy.$id('n1').outgoers())).to.deep.equal([]);
    expect(ids(cy.$id('n2').connectedEdges())).to.deep.equal(['n2n3']);
  });

  describe('edgesWith / edgesTo across collections', function () {
    it('edgesWith() with identical node collections on both sides', function () {
      expect(
        ids(
          cy
            .$id('n1')
            .union(cy.$id('n2'))
            .edgesWith(cy.$id('n1').union(cy.$id('n2'))),
        ),
      ).to.deep.equal(['n1n2']);
    });

    it('edgesWith() with intersecting collections', function () {
      expect(
        ids(cy.$id('n1').union(cy.$id('n2')).edgesWith(cy.$id('n1'))),
      ).to.deep.equal(['n1n2']);
    });

    it('edgesWith() is empty when no edge joins the two collections', function () {
      cy.add({ data: { id: 'n4' } });

      expect(cy.$id('n1').edgesWith(cy.$id('n4')).empty()).to.be.true;
    });

    it('edgesTo() with identical node collections respects direction', function () {
      expect(
        ids(
          cy
            .$id('n1')
            .union(cy.$id('n2'))
            .edgesTo(cy.$id('n1').union(cy.$id('n2'))),
        ),
      ).to.deep.equal(['n1n2']);
    });

    it('edgesTo() with intersecting collections respects direction', function () {
      // n1->n2 counts; the reverse (n2->n1) does not exist
      expect(
        ids(cy.$id('n1').union(cy.$id('n2')).edgesTo(cy.$id('n2'))),
      ).to.deep.equal(['n1n2']);
    });

    it('edgesTo() is empty in the wrong direction', function () {
      expect(cy.$id('n2').edgesTo(cy.$id('n1')).empty()).to.be.true;
    });
  });

  describe('components restricted to the collection', function () {
    it('splits a sub-collection into its internal components', function () {
      // only n1n2 is internal to the collection; n3 is isolated within it
      var comps = cy
        .$id('n1')
        .union(cy.$id('n2'))
        .union(cy.$id('n1n2'))
        .union(cy.$id('n3'))
        .components();

      expect(comps.length).to.equal(2);
      expect(comps.map((c) => c.length).sort()).to.deep.equal([1, 3]);
    });

    it('yields singletons when the connecting edge is excluded', function () {
      var comps = cy.$id('n1').union(cy.$id('n2')).components();

      expect(comps.length).to.equal(2);
      comps.forEach((c) => expect(c.nodes().length).to.equal(1));
    });

    it('of an empty collection has no components', function () {
      expect(cy.collection().components().length).to.equal(0);
    });
  });

  describe('degree', function () {
    it('node.degree()', function () {
      expect(cy.$id('n1').degree()).to.equal(2);
      expect(cy.$id('n2').degree()).to.equal(2);
    });

    it('node.indegree() and node.outdegree()', function () {
      expect(cy.$id('n1').indegree()).to.equal(1);
      expect(cy.$id('n1').outdegree()).to.equal(1);
    });

    it('degree() reports the first element; totalDegree() sums', function () {
      // singular accessor: first element's degree (each node has degree 2), not the sum
      expect(cy.nodes().degree()).to.equal(2);
      expect(cy.nodes().totalDegree()).to.equal(6);
    });

    it('degree() is undefined for an empty collection or non-node first element', function () {
      expect(cy.collection().degree()).to.equal(undefined);
      expect(cy.edges().degree()).to.equal(undefined); // first element is an edge
    });

    it('counts loops twice in degree, once per direction', function () {
      cy.add({ data: { id: 'loop', source: 'n1', target: 'n1' } });

      expect(cy.$id('n1').degree()).to.equal(4);
      expect(cy.$id('n1').degree(false)).to.equal(2);
      expect(cy.$id('n1').indegree()).to.equal(2);
      expect(cy.$id('n1').indegree(false)).to.equal(1);
      expect(cy.$id('n1').outdegree()).to.equal(2);
      expect(cy.$id('n1').outdegree(false)).to.equal(1);
    });
  });
});
