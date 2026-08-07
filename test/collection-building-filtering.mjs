import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

describe('gpu/collection: building and filtering', function () {
  var cy;

  var ids = (eles) => eles.map((ele) => ele.id());

  beforeEach(function () {
    cy = cytoscape({
      elements: [
        { data: { id: 'a' } },
        { data: { id: 'b' } },
        { data: { id: 'c' }, selected: true },
        { data: { id: 'ab', source: 'a', target: 'b' } },
        { data: { id: 'bc', source: 'b', target: 'c' } },
      ],
    });
  });

  it('unions collections', function () {
    var eles = cy.$id('a').union(cy.$id('b'));

    expect(ids(eles)).to.deep.equal(['a', 'b']);
    expect(ids(cy.$id('a').or(cy.$id('b')))).to.deep.equal(['a', 'b']);
    expect(ids(cy.$id('a').u(cy.$id('b')))).to.deep.equal(['a', 'b']);
    expect(ids(cy.$id('a').add(cy.$id('b')))).to.deep.equal(['a', 'b']);
  });

  it('takes differences', function () {
    expect(ids(cy.nodes().difference(cy.$id('b')))).to.deep.equal(['a', 'c']);
    expect(ids(cy.nodes().not(cy.$id('b')))).to.deep.equal(['a', 'c']);
    expect(
      ids(cy.nodes().subtract(cy.$id('a').union(cy.$id('c')))),
    ).to.deep.equal(['b']);
  });

  it('takes intersections', function () {
    expect(
      ids(cy.nodes().intersection(cy.filter({ selected: true }))),
    ).to.deep.equal(['c']);
    expect(ids(cy.elements().intersect(cy.edges()))).to.deep.equal([
      'ab',
      'bc',
    ]);
    expect(ids(cy.nodes().and(cy.$id('a').union(cy.$id('b'))))).to.deep.equal([
      'a',
      'b',
    ]);
  });

  it('intersecting with an empty collection is empty', function () {
    expect(cy.nodes().intersect(cy.collection()).empty()).to.be.true;
  });

  it('takes symmetric differences', function () {
    var bc = cy.$id('b').union(cy.$id('c'));

    expect(
      ids(cy.$id('a').union(cy.$id('b')).symmetricDifference(bc)),
    ).to.deep.equal(['a', 'c']);
    expect(ids(cy.$id('a').union(cy.$id('b')).xor(bc))).to.deep.equal([
      'a',
      'c',
    ]);
    expect(ids(cy.$id('a').union(cy.$id('b')).symdiff(bc))).to.deep.equal([
      'a',
      'c',
    ]);
  });

  it('filters with a query', function () {
    expect(ids(cy.elements().filter({ group: 'nodes' }))).to.deep.equal([
      'a',
      'b',
      'c',
    ]);
    expect(
      ids(cy.elements().filter({ group: 'nodes', selected: true })),
    ).to.deep.equal(['c']);
  });

  it('filters with a function', function () {
    var eles = cy.nodes().filter(function (ele, i, all) {
      expect(all).to.have.length(3);
      expect(this).to.be.undefined; // plain call without thisArg, like v3

      return i !== 1;
    });

    expect(ids(eles)).to.deep.equal(['a', 'c']);
  });

  it('filters from the core', function () {
    expect(ids(cy.filter({ group: 'edges' }))).to.deep.equal(['ab', 'bc']);
    expect(ids(cy.filter({ selected: true }))).to.deep.equal(['c']);
    expect(ids(cy.filter((ele) => ele.isEdge()))).to.deep.equal(['ab', 'bc']);
  });

  it('narrows with nodes()/edges()', function () {
    expect(ids(cy.elements().nodes())).to.deep.equal(['a', 'b', 'c']);
    expect(ids(cy.elements().edges())).to.deep.equal(['ab', 'bc']);
    expect(ids(cy.elements().nodes({ selected: true }))).to.deep.equal(['c']);
  });

  it('gets by id within a collection', function () {
    expect(cy.nodes().getElementById('b').id()).to.equal('b');
    expect(cy.nodes().getElementById('ab')).to.have.length(0);
  });

  it('selects with core queries', function () {
    expect(ids(cy.filter({ group: 'nodes' }))).to.deep.equal(['a', 'b', 'c']);
    expect(ids(cy.$id('a').union(cy.$id('ab')))).to.deep.equal(['a', 'ab']);
    expect(ids(cy.filter({}))).to.have.length(5);
  });
});
