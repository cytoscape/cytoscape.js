import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

// Round 52: the renderer builds its curved-edge and curved-arrow pipelines
// on the first frame that draws them rather than at init, because compiling
// the two costs ~0.96 s of the ~4.6 s first frame on a software adapter and
// a graph that never curves an edge never draws either.  `hasCurvedEdges()`
// is the gate, so it has to be true for every kind that reaches the curved
// stream and false for the three that draw in the straight pipeline.

describe('gpu/curve-stream gate', function () {
  var cy;
  var make = (elements, style) => {
    cy = cytoscape({ headless: true, elements, style });
    cy._store.flushDerived(); // the gate reads derived curve params

    return cy;
  };

  var pair = [
    { data: { id: 'a' }, position: { x: 0, y: 0 } },
    { data: { id: 'b' }, position: { x: 100, y: 0 } },
    { data: { id: 'e', source: 'a', target: 'b' } },
  ];

  afterEach(function () {
    if (cy != null) {
      cy.destroy();
    }

    cy = null;
  });

  it('is false for a graph with no edge at all', function () {
    make([{ data: { id: 'a' } }]);

    expect(cy._store.hasCurvedEdges()).to.equal(false);
  });

  it('is false for a lone straight edge', function () {
    make(pair, { edges: { 'curve-style': 'straight' } });

    expect(cy._store.hasCurvedEdges()).to.equal(false);
  });

  it('is false for the two straight-stream kinds (12c)', function () {
    for (const style of ['haystack', 'straight-triangle']) {
      make(pair, { edges: { 'curve-style': style } });

      expect(cy._store.hasCurvedEdges(), style).to.equal(false);

      cy.destroy();
      cy = null;
    }
  });

  it('is false for bezier on a single edge — it bundles only multi-edges', function () {
    make(pair, { edges: { 'curve-style': 'bezier' } });

    expect(cy._store.hasCurvedEdges()).to.equal(false);
  });

  it('is true for every kind that draws in the curved stream', function () {
    for (const style of [
      'unbundled-bezier',
      'segments',
      'taxi',
      'round-segments',
      'round-taxi',
    ]) {
      make(pair, { edges: { 'curve-style': style } });

      expect(cy._store.hasCurvedEdges(), style).to.equal(true);

      cy.destroy();
      cy = null;
    }
  });

  it('is true once a parallel pair bundles under bezier', function () {
    make([...pair, { data: { id: 'e2', source: 'a', target: 'b' } }], {
      edges: { 'curve-style': 'bezier' },
    });

    expect(cy._store.hasCurvedEdges()).to.equal(true);
  });

  it('is true for a self-loop', function () {
    make([
      { data: { id: 'a' }, position: { x: 0, y: 0 } },
      { data: { id: 'loop', source: 'a', target: 'a' } },
    ]);

    expect(cy._store.hasCurvedEdges()).to.equal(true);
  });

  it('stays true after the last curved edge goes away', function () {
    make(pair, { edges: { 'curve-style': 'unbundled-bezier' } });

    expect(cy._store.hasCurvedEdges()).to.equal(true);

    cy.$id('e').remove();
    cy._store.flushDerived();

    // monotone on purpose: recompiling the pipelines costs more than
    // holding them, and the gate is read once per frame
    expect(cy._store.hasCurvedEdges()).to.equal(true);
  });
});
