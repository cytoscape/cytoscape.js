import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

// Round 75.4: `cy.nodeAt( x, y )` (alias `cy.pickNode`), the sync half of
// the pick pair.  Headless it *computes* — the eleventh sitting's call —
// from the store and the viewport at dpr 1 with the renderer's default
// thresholds, so everything here runs in Node.  The shape spec is the
// round-27 lesson made a control: it asserts through the pick itself, and
// it fails when cpu-pick's shape test is swapped for the bounding box.

describe('cy.nodeAt (round 75.4)', function () {
  var cy;

  beforeEach(function () {
    cy = cytoscape({
      elements: [
        { data: { id: 'a' }, position: { x: 100, y: 100 } },
        { data: { id: 'b' }, position: { x: 300, y: 100 } },
        { data: { id: 'ab', source: 'a', target: 'b' } },
      ],
      style: {
        nodes: { width: 40, height: 40, shape: 'rectangle' },
      },
      zoom: 1,
      pan: { x: 0, y: 0 },
    });
  });

  it('answers the node under a rendered point, headless', function () {
    expect(cy.nodeAt(100, 100).id()).to.equal('a');
    expect(cy.nodeAt(118, 82).id()).to.equal('a'); // inside the corner
    expect(cy.nodeAt(300, 100).id()).to.equal('b');
  });

  it('answers null over background and over an edge alone', function () {
    expect(cy.nodeAt(10, 10)).to.equal(null);
    // mid-edge: nodes only — the edge answers through cy.pick()
    expect(cy.nodeAt(200, 100)).to.equal(null);
  });

  it('reads rendered coordinates through the viewport', function () {
    cy.zoom(2);
    cy.pan({ x: -100, y: -50 });

    // model (100, 100) renders at (100 * 2 - 100, 100 * 2 - 50)
    expect(cy.nodeAt(100, 150).id()).to.equal('a');
    expect(cy.nodeAt(100, 100)).to.equal(null); // model (100, 75): outside
  });

  it('answers the topmost of overlapping nodes', function () {
    cy.add({ data: { id: 'c' }, position: { x: 110, y: 100 } });

    // c was added after a, so it draws over a where they overlap
    expect(cy.nodeAt(105, 100).id()).to.equal('c');
    expect(cy.nodeAt(85, 100).id()).to.equal('a');
  });

  it('answers a leaf over its compound parent, the parent over its own body', function () {
    cy.add([
      { data: { id: 'p' } },
      { data: { id: 'k', parent: 'p' }, position: { x: 600, y: 100 } },
      { data: { id: 'k2', parent: 'p' }, position: { x: 700, y: 100 } },
    ]);

    expect(cy.nodeAt(600, 100).id()).to.equal('k');
    expect(cy.nodeAt(650, 100).id()).to.equal('p');
  });

  it('does not pick what is not drawn', function () {
    cy.$id('a').style('visibility', 'hidden');
    expect(cy.nodeAt(100, 100)).to.equal(null);

    cy.$id('b').hide();
    expect(cy.nodeAt(300, 100)).to.equal(null);
  });

  it('picks by the drawn shape, not its bounding box (the round-27 control)', function () {
    cy.$id('a').style('shape', 'diamond');

    // the diamond's centre, and a point inside its outline
    expect(cy.nodeAt(100, 100).id()).to.equal('a');
    expect(cy.nodeAt(108, 100).id()).to.equal('a');
    // inside the 40x40 box, outside the diamond's slanted edge
    expect(cy.nodeAt(117, 83)).to.equal(null);
  });

  it('pickNode is the same method', function () {
    expect(cy.pickNode).to.equal(cy.nodeAt);
    expect(cy.pickNode(100, 100).id()).to.equal('a');
  });

  it('answers null on a destroyed instance', function () {
    cy.destroy();
    expect(cy.nodeAt(100, 100)).to.equal(null);
  });

  it('agrees with the returned handle identity', function () {
    expect(cy.nodeAt(100, 100)).to.equal(cy.$id('a')[0]);
  });
});
