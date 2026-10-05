import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

// round 14.6: the `parents` sheet group — parent nodes resolve through
// the nodes props overlaid with v3's :parent defaults and the user's
// parents block; the compound props (padding / padding-relative-to /
// min-width / min-height / compound-sizing-wrt-labels) live there too.

// p > (a at (0,0), b at (100,0)); q top-level leaf
const ELEMENTS = {
  nodes: [
    { data: { id: 'p' } },
    { data: { id: 'a', parent: 'p' }, position: { x: 0, y: 0 } },
    { data: { id: 'b', parent: 'p' }, position: { x: 100, y: 0 } },
    { data: { id: 'q' }, position: { x: 300, y: 0 } },
  ],
  edges: [],
};

const make = (style) =>
  cytoscape({ elements: ELEMENTS, ...(style != null ? { style } : {}) });

describe('gpu/style: parents sheet group (round 14.6)', function () {
  it('gives parents v3’s :parent defaults; leaves keep the node defaults', function () {
    const cy = make();
    const p = cy.$id('p');
    const q = cy.$id('q');

    expect(p.style('shape')).to.equal('rectangle');
    expect(p.style('background-color')).to.equal('rgb(238,238,238)');
    expect(p.style('border-width')).to.equal(1);
    expect(p.style('border-color')).to.equal('rgb(204,204,204)');
    expect(p.style('padding')).to.equal(10);
    expect(p.padding()).to.equal(10); // resolved = declared for px

    expect(q.style('shape')).to.equal('ellipse');
    expect(q.style('background-color')).to.equal('rgb(153,153,153)');
    expect(q.style('padding')).to.equal(0);
  });

  it('overlays: :parent defaults < user nodes block < user parents block (v3 order)', function () {
    const cy = make({
      nodes: { backgroundColor: '#ff0000' },
      parents: { borderWidth: 3 },
    });

    // v3 precedence is order-based: the user nodes block sits after the
    // default :parent block and overrides it (parity-pinned)
    expect(cy.$id('p').style('background-color')).to.equal('rgb(255,0,0)');
    expect(cy.$id('p').style('border-width')).to.equal(3); // user parents block wins
    expect(cy.$id('p').style('shape')).to.equal('rectangle'); // un-overridden default holds
    expect(cy.$id('q').style('background-color')).to.equal('rgb(255,0,0)');

    const cy2 = make({ parents: { backgroundColor: '#0000ff' } });

    expect(cy2.$id('p').style('background-color')).to.equal('rgb(0,0,255)');
  });

  it('un-overridden nodes props flow through to parents (the fallback size)', function () {
    const cy = make({ nodes: { width: 50, height: 40 } });

    cy.$id('a').hide();
    cy.$id('b').hide();

    // degenerate fallback = the style size, which parents inherit from
    // the nodes block (the default :parent block has no width)
    expect(cy.$id('p').paddedWidth()).to.equal(50 + 20); // + default padding 10
    expect(cy.$id('p').width()).to.equal(50);
    expect(cy.$id('p').height()).to.equal(40);
  });

  it('applies sheet compound props: padding, % padding, min sizes', function () {
    const cy = make({ parents: { padding: 5 } });
    const p = cy.$id('p');

    expect(p.padding()).to.equal(5);
    expect(p.width()).to.equal(130);
    expect(p.paddedWidth()).to.equal(140);

    const cy2 = make({
      parents: { padding: '10%', 'padding-relative-to': 'height' },
    });

    // children bb is 130 x 30: 10% of the height = 3
    expect(cy2.$id('p').padding()).to.equal(3);
    expect(cy2.$id('p').style('padding-relative-to')).to.equal('height');

    const cy3 = make({
      parents: { padding: 0, minWidth: 300, 'min-height': 100 },
    });
    const p3 = cy3.$id('p');

    expect(p3.width()).to.equal(300);
    expect(p3.height()).to.equal(100);
    expect(p3.position()).to.deep.equal({ x: 50, y: 0 }); // centered clamp
    expect(p3.style('min-width')).to.equal(300);
  });

  it('accepts and reads both compound-sizing-wrt-labels values', function () {
    const cy = make({ parents: { 'compound-sizing-wrt-labels': 'exclude' } });

    expect(cy.$id('p').style('compound-sizing-wrt-labels')).to.equal('exclude');
    const included = make({
      parents: { 'compound-sizing-wrt-labels': 'include' },
    });

    expect(included.$id('p').style('compound-sizing-wrt-labels')).to.equal(
      'include',
    );
    expect(() =>
      make({ parents: { 'compound-sizing-wrt-labels': 'nope' } }),
    ).to.throw();
  });

  it('includes direct child label boxes in model space, including rotation, without self-sizing', function () {
    const elements = {
      nodes: [
        { data: { id: 'p', label: 'a very long parent label' } },
        {
          data: { id: 'a', parent: 'p', label: 'a long child label' },
          position: { x: 0, y: 0 },
        },
        {
          data: { id: 'b', parent: 'p', label: 'another long child label' },
          position: { x: 100, y: 0 },
        },
      ],
      edges: [],
    };
    const shared = {
      nodes: {
        width: 20,
        height: 20,
        label: { data: 'label' },
        'text-halign': 'left',
        'text-valign': 'top',
        'text-rotation': Math.PI / 4,
      },
      parents: { padding: 0 },
    };
    const exclude = cytoscape({ elements, style: shared });
    const include = cytoscape({
      elements,
      style: {
        ...shared,
        parents: {
          ...shared.parents,
          'compound-sizing-wrt-labels': 'include',
        },
      },
    });
    const pExclude = exclude.$id('p');
    const pInclude = include.$id('p');
    const includedWidth = pInclude.paddedWidth();
    const includedHeight = pInclude.paddedHeight();

    expect(pExclude.paddedWidth()).to.equal(120);
    expect(includedWidth).to.be.greaterThan(pExclude.paddedWidth());
    expect(includedHeight).to.be.greaterThan(pExclude.paddedHeight());

    // The parent's own label does not feed its size back into itself.
    pInclude.data('label', 'a much much much much much longer parent label');
    expect(pInclude.paddedWidth()).to.equal(includedWidth);
    expect(pInclude.paddedHeight()).to.equal(includedHeight);

    include.zoom({ level: 0.1 });
    expect(pInclude.paddedWidth()).to.equal(includedWidth);
    expect(pInclude.paddedHeight()).to.equal(includedHeight);

    include.destroy();
    exclude.destroy();
  });

  it('updates label-inclusive bounds on label changes and ignores inkless labels', function () {
    const elements = {
      nodes: [
        { data: { id: 'p' } },
        { data: { id: 'a', parent: 'p', label: 'short' } },
      ],
      edges: [],
    };
    const cy = cytoscape({
      elements,
      style: {
        nodes: {
          width: 20,
          height: 20,
          label: { data: 'label' },
        },
        parents: { padding: 0, 'compound-sizing-wrt-labels': 'include' },
      },
    });
    const p = cy.$id('p');
    const before = p.paddedWidth();

    cy.$id('a').data('label', 'this label is much longer and visible');
    const long = p.paddedWidth();

    expect(long).to.be.greaterThan(before);

    cy.$id('a').data('label', 'tiny');
    expect(p.paddedWidth()).to.be.lessThan(long);
    cy.$id('a').hide();
    expect(p.paddedWidth()).to.equal(20);

    const inkless = cytoscape({
      elements,
      style: {
        nodes: {
          width: 20,
          height: 20,
          label: { data: 'label' },
          'text-opacity': 0,
        },
        parents: { padding: 0, 'compound-sizing-wrt-labels': 'include' },
      },
    });

    expect(inkless.$id('p').paddedWidth()).to.equal(20);

    cy.destroy();
    inkless.destroy();
  });

  it('rejects compound props outside the parents group, and mappers on them', function () {
    expect(() => make({ nodes: { padding: 10 } })).to.throw(/parents/);
    expect(() => make({ edges: { 'min-width': 5 } })).to.throw();
    expect(() => make({ parents: { padding: { data: 'pad' } } })).to.throw(
      /constant/i,
    );
  });

  it('evaluates parents-block mappers for parent slots only', function () {
    const cy = make({ parents: { borderWidth: { data: 'bw', fallback: 2 } } });

    cy.$id('p').data('bw', 7);

    expect(cy.$id('p').style('border-width')).to.equal(7);
    expect(cy.$id('q').style('border-width')).to.equal(0); // leaf default

    cy.$id('p').data('bw', 9); // the data-write refresh gates on parents deps

    expect(cy.$id('p').style('border-width')).to.equal(9);
  });

  it('restyles on leaf <-> parent flips', function () {
    const cy = make();

    expect(cy.$id('q').style('shape')).to.equal('ellipse');

    cy.$id('b').move({ parent: 'q' }); // q becomes a parent

    expect(cy.$id('q').style('shape')).to.equal('rectangle');
    expect(cy.$id('q').style('background-color')).to.equal('rgb(238,238,238)');

    cy.$id('b').move({ parent: 'p' }); // q back to a leaf

    expect(cy.$id('q').style('shape')).to.equal('ellipse');
    expect(cy.$id('q').style('background-color')).to.equal('rgb(153,153,153)');
    expect(cy.$id('q').width()).to.equal(30); // style size restored
  });

  it('demotes nodes paint mappers only where the parents group resolves differently', function () {
    const mapper = { data: 'c', domain: [0, 1], range: ['#000000', '#ffffff'] };

    // the parents block overrides the mapped channel: the kernel would
    // repaint parents with the nodes value — demoted to CPU
    const cy = make({
      nodes: { backgroundColor: mapper },
      parents: { backgroundColor: '#0000ff' },
    });

    expect(
      cy._styleEngine.paintInputs('nodes').map((i) => i.m.prop),
    ).to.not.include('background-color');

    // no parents override: the user nodes block replaces the default
    // :parent background (v3 order), so parents share the mapper and the
    // channel stays GPU-evaluated even under compounds
    const cy2 = make({ nodes: { backgroundColor: mapper } });

    expect(
      cy2._styleEngine.paintInputs('nodes').map((i) => i.m.prop),
    ).to.include('background-color');

    // a nodes mapper on a default-overlay channel replaces the overlay
    // for parents too (order-based precedence), so it also stays on GPU
    const cy3 = make({ nodes: { borderColor: mapper } });

    expect(
      cy3._styleEngine.paintInputs('nodes').map((i) => i.m.prop),
    ).to.include('border-color');
  });
});
