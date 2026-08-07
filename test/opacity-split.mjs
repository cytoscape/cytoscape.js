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

  it('a non-1 channel opacity demotes that color channel off the GPU kernel', function () {
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

    expect(cy._styleEngine.paintInputs('nodes').length).to.equal(0);

    var cy2 = makeCy({
      nodes: {
        'background-color': {
          data: 'x',
          scale: 'linear',
          domain: [0, 1],
          range: ['#000', '#fff'],
        },
      },
    });
    var keep = cy;

    cy = cy2;
    expect(cy2._styleEngine.paintInputs('nodes').length).to.equal(1);
    cy = keep;
    cy2.destroy();
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
