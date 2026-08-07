import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

// round 14.4: ancestor-gated visibility (FLAG_SELF_HIDDEN = own state,
// FLAG_VISIBLE = the effective shown bit every consumer already reads)
// and rendered effectiveOpacity (the ancestor product folded into the
// stored node opacity, with base tracking).

// p > (a, b); q top-level leaf; edge a-q
const make = () =>
  cytoscape({
    elements: {
      nodes: [
        { data: { id: 'p' } },
        { data: { id: 'a', parent: 'p' }, position: { x: 0, y: 0 } },
        { data: { id: 'b', parent: 'p' }, position: { x: 100, y: 0 } },
        { data: { id: 'q' }, position: { x: 200, y: 0 } },
      ],
      edges: [{ data: { id: 'aq', source: 'a', target: 'q' } }],
    },
  });

describe('gpu: ancestor-gated visibility (round 14.4)', function () {
  it('hiding a parent hides its subtree; showing restores it', function () {
    const cy = make();

    cy.$id('p').hide();

    expect(cy.$id('p').visible()).to.equal(false);
    expect(cy.$id('a').visible()).to.equal(false);
    expect(cy.$id('b').hidden()).to.equal(true);
    expect(cy.$id('q').visible()).to.equal(true);

    // the box query reads the effective bit: the subtree is gone
    const inBox = cy
      .elementsInBox(-1000, -1000, 1000, 1000)
      .map((e) => e.id())
      .sort();

    expect(inBox).to.deep.equal(['q']);

    cy.$id('p').show();

    expect(cy.$id('a').visible()).to.equal(true);
    expect(cy.$id('b').visible()).to.equal(true);
  });

  it('keeps a child’s own hidden state across parent toggles', function () {
    const cy = make();

    cy.$id('a').hide();
    cy.$id('p').hide();
    cy.$id('p').show();

    expect(cy.$id('a').visible()).to.equal(false); // own state preserved
    expect(cy.$id('b').visible()).to.equal(true);

    cy.$id('a').show();

    expect(cy.$id('a').visible()).to.equal(true);
  });

  it('showing a child inside a hidden parent keeps it effectively hidden', function () {
    const cy = make();

    cy.$id('p').hide();
    cy.$id('a').show(); // no-op: it was never self-hidden

    expect(cy.$id('a').visible()).to.equal(false);
    expect(cy.$id('a').takesUpSpace()).to.equal(false);
    expect(cy.$id('a').interactive()).to.equal(false);

    cy.$id('p').show();

    expect(cy.$id('a').visible()).to.equal(true);
  });

  it('reparenting into a hidden parent gates the moved subtree', function () {
    const cy = make();

    cy.$id('p').hide();
    cy.$id('q').move({ parent: 'p' });

    expect(cy.$id('q').visible()).to.equal(false);

    cy.$id('q').move({ parent: null });

    expect(cy.$id('q').visible()).to.equal(true);
  });

  it('def-ingested nodes under a hidden parent start gated', function () {
    const cy = make();

    cy.$id('p').hide();
    cy.add({ data: { id: 'c', parent: 'p' } });

    expect(cy.$id('c').visible()).to.equal(false);
  });
});

describe('gpu: effective opacity (round 14.4)', function () {
  const makeOpacity = () => {
    const cy = make();

    cy.style({ nodes: { opacity: { data: 'op', fallback: 1 } } });
    cy.$id('p').data('op', 0.5);
    cy.$id('a').data('op', 0.5);

    return cy;
  };

  it('folds the ancestor product into descendants’ drawn opacity', function () {
    const cy = makeOpacity();

    expect(cy.$id('p').effectiveOpacity()).to.equal(0.5);
    expect(cy.$id('a').effectiveOpacity()).to.equal(0.25);
    expect(cy.$id('b').effectiveOpacity()).to.equal(0.5); // base 1 x parent 0.5

    // style readback stays the base (v3's style('opacity'))
    expect(cy.$id('a').style('opacity')).to.equal(0.5);
    expect(cy.$id('b').numericStyle('opacity')).to.equal(1);
  });

  it('refolds the subtree when a parent’s opacity changes', function () {
    const cy = makeOpacity();

    cy.$id('p').data('op', 1);

    expect(cy.$id('a').effectiveOpacity()).to.equal(0.5);
    expect(cy.$id('b').effectiveOpacity()).to.equal(1);
  });

  it('restores the base when a node is orphaned', function () {
    const cy = makeOpacity();

    cy.$id('a').move({ parent: null });

    expect(cy.$id('a').effectiveOpacity()).to.equal(0.5);
    expect(cy.$id('a').style('opacity')).to.equal(0.5);
  });

  it('transparent() reads the effective value', function () {
    const cy = makeOpacity();

    cy.$id('p').data('op', 0);

    expect(cy.$id('a').transparent()).to.equal(true); // 0 x 0.5
    expect(cy.$id('a').style('opacity')).to.equal(0.5); // base untouched
    expect(cy.$id('q').transparent()).to.equal(false);
  });

  it('edges keep their own opacity (v3: edges have no parent)', function () {
    const cy = makeOpacity();

    expect(cy.$id('aq').effectiveOpacity()).to.equal(1);
  });

  it('demotes the node opacity mapper from GPU eval while compounds exist', function () {
    const cy = makeOpacity();
    const props = cy._styleEngine.paintInputs('nodes').map((i) => i.m.prop);

    expect(props).to.not.include('opacity');

    // a compound-free instance keeps the GPU path
    const flat = cytoscape({
      elements: { nodes: [{ data: { id: 'x' } }], edges: [] },
    });

    flat.style({ nodes: { opacity: { data: 'op', fallback: 1 } } });

    expect(
      flat._styleEngine.paintInputs('nodes').map((i) => i.m.prop),
    ).to.include('opacity');
  });
});
