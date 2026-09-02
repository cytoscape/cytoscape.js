import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

// round 13 B1: the channel-opacity split (folded into stored alphas)

describe('gpu/opacity-split (round 13 B1)', function () {
  var cy;

  var makeCy = (style, extraEles) =>
    cytoscape({
      elements: [
        { data: { id: 'a' }, position: { x: 0, y: 0 } },
        { data: { id: 'b' }, position: { x: 100, y: 0 } },
        { data: { id: 'e', source: 'a', target: 'b' } },
        ...(extraEles ?? []),
      ],
      style,
    });

  it('background-opacity folds into the stored fill alpha', function () {
    cy = makeCy({
      nodes: { 'background-color': '#ff0000', 'background-opacity': 0.5 },
    });

    var fill = cy._store.column('node.fillColor');
    var slot = cy._store.lookup('a').slot;

    expect(fill[slot * 4 + 3]).to.equal(128);
    expect(cy.$id('a').style('background-opacity')).to.be.closeTo(0.5, 0.01);
  });

  it('border-opacity folds into the stored border alpha', function () {
    cy = makeCy({
      nodes: {
        'border-width': 4,
        'border-color': '#00f',
        'border-opacity': 0.25,
      },
    });

    var border = cy._store.column('node.borderColor');
    var slot = cy._store.lookup('a').slot;

    expect(border[slot * 4 + 3]).to.equal(64);
    expect(cy.$id('a').style('border-opacity')).to.be.closeTo(0.25, 0.01);
  });

  it('line-opacity folds into the line and arrow alphas (v3 effective opacities)', function () {
    cy = makeCy({
      edges: {
        'line-opacity': 0.5,
        'target-arrow-shape': 'triangle',
        'target-arrow-color': '#0f0',
      },
    });

    var line = cy._store.column('edge.lineColor');
    var arrow = cy._store.column('edge.targetArrow');
    var slot = cy._store.lookup('e').slot;

    expect(line[slot * 4 + 3]).to.equal(128);
    expect(arrow[slot * 4 + 3]).to.equal(128);
    expect(cy.$id('e').style('line-opacity')).to.be.closeTo(0.5, 0.01);

    // a fully line-transparent edge reads its arrows as none (stored truth)
    var cy2 = makeCy({
      edges: { 'line-opacity': 0, 'target-arrow-shape': 'triangle' },
    });
    var keep = cy;

    cy = cy2;
    expect(cy2.$id('e').style('target-arrow-shape')).to.equal('none');
    cy = keep;
    cy2.destroy();
  });

  it('text-opacity folds into the label text/outline/background alphas', function () {
    cy = makeCy({
      nodes: {
        label: 'hi',
        color: '#000',
        'text-opacity': 0.5,
        'text-outline-width': 2,
        'text-outline-color': '#f00',
        'text-outline-opacity': 1,
        'text-background-color': '#0f0',
        'text-background-opacity': 1,
      },
    });

    var entry = cy._store.labelAt(cy._store.lookup('a').slot);

    expect((entry.color >>> 24) & 0xff).to.equal(128);
    expect((entry.outlineColor >>> 24) & 0xff).to.equal(128);
    expect((entry.bgColor >>> 24) & 0xff).to.equal(128);
    expect(cy.$id('a').style('text-opacity')).to.be.closeTo(0.5, 0.01);
  });

  it('element opacity reaches labels (115.6): folded for edge labels, a column for node labels', function () {
    cy = makeCy({
      nodes: { label: 'hi', color: '#000', 'text-opacity': 0.5 },
      edges: { label: 'e', color: '#000', 'text-opacity': 0.5, opacity: 0.4 },
    });

    // the edge label pipeline is at its storage-buffer budget, so the
    // element opacity folds into the stored alpha like edge lines do:
    // 0.5 x 0.4 = 0.2 — and the reader divides it back out
    var edgeSlot = cy._store.lookup('e').slot;
    var entry = cy._store.labelAt(edgeSlot, 'edges');

    expect((entry.color >>> 24) & 0xff).to.equal(Math.round(0.2 * 255));
    expect(cy.$id('e').style('text-opacity')).to.be.closeTo(0.5, 0.01);
    expect(cy.$id('e').style('opacity')).to.be.closeTo(0.4, 0.01);

    // a bypass re-folds: the label follows the edge it belongs to
    cy.$id('e').style({ opacity: 1 });
    entry = cy._store.labelAt(edgeSlot, 'edges');
    expect((entry.color >>> 24) & 0xff).to.equal(128);

    // node labels keep the declared text alpha in the entry — the
    // node.opacity column multiplies on the GPU, as the body shader does
    cy.$id('a').style({ opacity: 0.25 });

    var nodeEntry = cy._store.labelAt(cy._store.lookup('a').slot);

    expect((nodeEntry.color >>> 24) & 0xff).to.equal(128);
    expect(cy.$id('a').style('text-opacity')).to.be.closeTo(0.5, 0.01);
    expect(
      cy._store.column('node.opacity')[cy._store.lookup('a').slot],
    ).to.be.closeTo(0.25, 1e-6);
  });

  it('the channel opacities take (CPU) mappers', function () {
    cy = cytoscape({
      elements: [
        { data: { id: 'a', dim: 1 }, position: { x: 0, y: 0 } },
        { data: { id: 'b', dim: 0 }, position: { x: 100, y: 0 } },
      ],
      style: {
        nodes: {
          'background-opacity': {
            data: 'dim',
            scale: 'linear',
            domain: [0, 1],
            range: [1, 0.2],
          },
        },
      },
    });

    var fill = cy._store.column('node.fillColor');

    expect(fill[cy._store.lookup('a').slot * 4 + 3]).to.equal(51);
    expect(fill[cy._store.lookup('b').slot * 4 + 3]).to.equal(255);
  });

  // Round 66.3 replaced this pair's contract.  A *constant* channel
  // opacity no longer demotes: the multiplier rides the packed program
  // (`alphaMul` -> `domain.w`) and the kernel folds exactly what the CPU
  // write path folds, so the channel stays kernel-owned.  A *mapped*
  // channel opacity still demotes — its value varies per element, and
  // the state `case` form real sheets use is not packable at all.
  it('a constant channel opacity keeps the color channel on the kernel', function () {
    cy = makeCy({
      nodes: {
        'background-color': {
          data: 'x',
          scale: 'linear',
          domain: [0, 1],
          range: ['#000', '#fff'],
        },
        'background-opacity': 0.5,
      },
    });

    const inputs = cy._styleEngine.paintInputs('nodes');

    expect(inputs.length).to.equal(1);
    expect(inputs[0].m.prop).to.equal('background-color');
    // and it carries the fold the CPU would have applied
    expect(inputs[0].alphaMul).to.equal(0.5);
  });

  it('a mapped channel opacity still demotes it', function () {
    cy = makeCy({
      nodes: {
        'background-color': {
          data: 'x',
          scale: 'linear',
          domain: [0, 1],
          range: ['#000', '#fff'],
        },
        'background-opacity': { data: 'x', domain: [0, 1], range: [1, 0.2] },
      },
    });

    expect(cy._styleEngine.paintInputs('nodes').length).to.equal(0);
  });

  it('an opacity of 1 folds nothing', function () {
    cy = makeCy({
      nodes: {
        'background-color': {
          data: 'x',
          scale: 'linear',
          domain: [0, 1],
          range: ['#000', '#fff'],
        },
      },
    });

    const inputs = cy._styleEngine.paintInputs('nodes');

    expect(inputs.length).to.equal(1);
    expect(inputs[0].alphaMul).to.equal(1);
  });

  it('the edge line and node border channels fold their own opacity', function () {
    cy = makeCy({
      nodes: {
        'border-color': {
          data: 'x',
          scale: 'linear',
          domain: [0, 1],
          range: ['#000', '#fff'],
        },
        'border-opacity': 0.25,
      },
      edges: {
        'line-color': {
          data: 'x',
          scale: 'linear',
          domain: [0, 1],
          range: ['#000', '#fff'],
        },
        'line-opacity': 0.75,
      },
    });

    const byProp = (group) =>
      Object.fromEntries(
        cy._styleEngine.paintInputs(group).map((i) => [i.m.prop, i.alphaMul]),
      );

    expect(byProp('nodes')['border-color']).to.equal(0.25);
    expect(byProp('edges')['line-color']).to.equal(0.75);
  });

  it('validates the [0, 1] range', function () {
    expect(() => makeCy({ nodes: { 'background-opacity': 1.5 } })).to.throw(
      /within \[0, 1\]/,
    );
    expect(() => makeCy({ edges: { 'line-opacity': -0.1 } })).to.throw(
      /within \[0, 1\]/,
    );
  });

  afterEach(function () {
    if (cy != null) {
      cy.destroy();
      cy = null;
    }
  });
});
