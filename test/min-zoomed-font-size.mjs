import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

// round 13 D2: per-element min-zoomed-font-size — a per-glyph zoom
// floor baked into the run, tested in the glyph cull

describe('gpu/style: min-zoomed-font-size (round 13 D2)', function () {
  var cy;

  var makeCy = (nodeStyle, edgeStyle) =>
    cytoscape({
      elements: [
        { data: { id: 'a' }, position: { x: 0, y: 0 } },
        { data: { id: 'b' }, position: { x: 100, y: 0 } },
        { data: { id: 'ab', source: 'a', target: 'b' } },
      ],
      style: {
        nodes: Object.assign({ label: 'n' }, nodeStyle),
        edges: Object.assign({ label: 'e' }, edgeStyle),
      },
    });

  it('parses and reads back on both groups; defaults to 0 (v3)', function () {
    cy = makeCy({ 'min-zoomed-font-size': 8 }, { 'min-zoomed-font-size': 12 });

    expect(cy.$id('a').style('min-zoomed-font-size')).to.equal(8);
    expect(cy.$id('ab').style('min-zoomed-font-size')).to.equal(12);

    cy.style({ nodes: { label: 'n' }, edges: {} });

    expect(cy.$id('a').style('min-zoomed-font-size')).to.equal(0);
    expect(cy.$id('ab').style('min-zoomed-font-size')).to.equal(0);
  });

  it('throws on negative values', function () {
    expect(() => makeCy({ 'min-zoomed-font-size': -1 }, {})).to.throw();
  });

  it('bakes into the label sidecar for the glyph builder', function () {
    cy = makeCy({ 'min-zoomed-font-size': 9, 'font-size': 18 }, {});

    expect(cy._store.labelAt(0, 'nodes').minZoomedFontSize).to.equal(9);
  });

  it('takes mappers (per-element, like font-size)', function () {
    cy = cytoscape({
      elements: [
        { data: { id: 'big', floor: 20 }, position: { x: 0, y: 0 } },
        { data: { id: 'none', floor: 0 }, position: { x: 100, y: 0 } },
      ],
      style: {
        nodes: {
          label: 'n',
          'min-zoomed-font-size': {
            data: 'floor',
            scale: 'linear',
            domain: [0, 20],
            range: [0, 20],
          },
        },
      },
    });

    expect(cy.$id('big').style('min-zoomed-font-size')).to.be.closeTo(20, 1e-5);
    expect(cy.$id('none').style('min-zoomed-font-size')).to.equal(0);
    expect(cy._store.labelAt(0, 'nodes').minZoomedFontSize).to.be.closeTo(
      20,
      1e-5,
    );
  });

  afterEach(function () {
    if (cy != null) {
      cy.destroy();
      cy = null;
    }
  });
});
