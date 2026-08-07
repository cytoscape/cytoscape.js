import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

var ids = (eles) => eles.map((ele) => ele.id()).sort();

describe('gpu/collection: set ops, iteration, degree stats', function () {
  var cy;

  beforeEach(function () {
    cy = cytoscape({
      elements: [
        { data: { id: 'n1' } },
        { data: { id: 'n2' } },
        { data: { id: 'n3' } },
        { data: { id: 'e12', source: 'n1', target: 'n2' } },
        { data: { id: 'e13', source: 'n1', target: 'n3' } },
      ],
    });
  });

  it('byGroup()', function () {
    var g = cy.elements().byGroup();

    expect(ids(g.nodes)).to.deep.equal(['n1', 'n2', 'n3']);
    expect(ids(g.edges)).to.deep.equal(['e12', 'e13']);
  });

  it('absoluteComplement() / complement / abscomp', function () {
    expect(ids(cy.nodes().absoluteComplement())).to.deep.equal(['e12', 'e13']);
    expect(ids(cy.nodes().complement())).to.deep.equal(['e12', 'e13']);
    expect(ids(cy.$id('n1').abscomp())).to.deep.equal([
      'e12',
      'e13',
      'n2',
      'n3',
    ]);
  });

  it('diff()', function () {
    var d = cy
      .$id('n1')
      .union(cy.$id('n2'))
      .diff(cy.$id('n2').union(cy.$id('n3')));

    expect(ids(d.left)).to.deep.equal(['n1']);
    expect(ids(d.right)).to.deep.equal(['n3']);
    expect(ids(d.both)).to.deep.equal(['n2']);
  });

  it('reduce()', function () {
    var count = cy.nodes().reduce((acc) => acc + 1, 0);

    expect(count).to.equal(3);
  });

  it('max() returns { value, ele }', function () {
    cy.$id('n1').data('w', 5);
    cy.$id('n2').data('w', 9);
    cy.$id('n3').data('w', 1);

    var m = cy.nodes().max((ele) => ele.data('w'));

    expect(m.value).to.equal(9);
    expect(m.ele.id()).to.equal('n2');
  });

  it('min() returns { value, ele }', function () {
    cy.$id('n1').data('w', 5);
    cy.$id('n2').data('w', 9);
    cy.$id('n3').data('w', 1);

    var m = cy.nodes().min((ele) => ele.data('w'));

    expect(m.value).to.equal(1);
    expect(m.ele.id()).to.equal('n3');
  });

  it('max() on an empty collection', function () {
    var m = cy.collection().max(() => 1);

    expect(m.value).to.equal(-Infinity);
    expect(m.ele).to.equal(undefined);
  });

  it('sort()', function () {
    var sorted = cy.nodes().sort((a, b) => b.id().localeCompare(a.id()));

    expect(sorted.map((e) => e.id())).to.deep.equal(['n3', 'n2', 'n1']);
  });

  it('merge (union alias) and unmerge (difference alias)', function () {
    expect(ids(cy.$id('n1').merge(cy.$id('n2')))).to.deep.equal(['n1', 'n2']);
    expect(ids(cy.nodes().unmerge(cy.$id('n2')))).to.deep.equal(['n1', 'n3']);
  });

  it('isLoop() / isSimple()', function () {
    var cy2 = cytoscape({
      elements: [
        { data: { id: 'a' } },
        { data: { id: 'loop', source: 'a', target: 'a' } },
        { data: { id: 'b' } },
        { data: { id: 'ab', source: 'a', target: 'b' } },
      ],
    });

    expect(cy2.$id('loop').isLoop()).to.equal(true);
    expect(cy2.$id('loop').isSimple()).to.equal(false);
    expect(cy2.$id('ab').isLoop()).to.equal(false);
    expect(cy2.$id('ab').isSimple()).to.equal(true);
    expect(cy2.$id('a').isLoop()).to.equal(false);
  });

  it('equal / equals alias for same', function () {
    expect(
      cy
        .$id('n1')
        .union(cy.$id('n2'))
        .equal(cy.$id('n2').union(cy.$id('n1'))),
    ).to.equal(true);
    expect(cy.$id('n1').equals(cy.$id('n2'))).to.equal(false);
  });

  it('allAreNeighbors()', function () {
    // n2 and n3 are both neighbors of n1
    expect(
      cy.$id('n1').allAreNeighbors(cy.$id('n2').union(cy.$id('n3'))),
    ).to.equal(true);
    expect(cy.$id('n1').allAreNeighbors(cy.$id('n1'))).to.equal(false);
  });

  it('degree stats: min/max degree, indegree, outdegree, totalDegree', function () {
    // n1: out 2 (e12,e13); n2: in 1; n3: in 1
    expect(cy.nodes().maxDegree()).to.equal(2);
    expect(cy.nodes().minDegree()).to.equal(1);
    expect(cy.nodes().maxOutdegree()).to.equal(2);
    expect(cy.nodes().maxIndegree()).to.equal(1);
    expect(cy.nodes().minOutdegree()).to.equal(0);
    expect(cy.nodes().minIndegree()).to.equal(0); // n1 has no incoming edges
    expect(cy.nodes().totalDegree()).to.equal(4);
    expect(cy.collection().maxDegree()).to.equal(undefined);
  });
});
