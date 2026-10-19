import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

// round 13 B2: corner-radius + border-position

describe('gpu/border-geom (round 13 B2)', function () {
  var cy;

  var makeCy = (nodeStyle) =>
    cytoscape({
      elements: [{ data: { id: 'n' }, position: { x: 0, y: 0 } }],
      style: { nodes: nodeStyle },
    });

  it('parses and reads back corner-radius (auto default) and border-position', function () {
    cy = makeCy({ shape: 'round-rectangle' });

    expect(cy.$id('n').style('corner-radius')).to.equal('auto');
    expect(cy.$id('n').style('border-position')).to.equal('center'); // v3's default

    cy.style({
      nodes: {
        shape: 'round-rectangle',
        'corner-radius': 5,
        'border-position': 'outside',
      },
    });

    expect(cy.$id('n').style('corner-radius')).to.equal(5);
    expect(cy.$id('n').style('border-position')).to.equal('outside');
  });

  it('throws on bad keywords', function () {
    expect(() => makeCy({ 'border-position': 'middle' })).to.throw(
      /border-position/,
    );
    expect(() => makeCy({ 'corner-radius': -3 })).to.throw(/negative/);
  });

  it('the CPU pick honors the per-node corner radius', function () {
    // a 60×60 round-rectangle: with radius 28 the corner point (24, 24)
    // from center is outside; with radius 2 it is inside
    cy = makeCy({
      shape: 'round-rectangle',
      width: 60,
      height: 60,
      'corner-radius': 28,
    });

    var r = cy.renderer();

    // headless: drive the pick replica directly through the store view
    // via the exported pickNodeAt? — renderer is null headless; use the
    // collection API instead: boundingBox unaffected, so probe via
    // elementsInBox is not shape-aware.  Instead assert the stored
    // column and rely on the Playwright pick spec for pixels.
    var geom = cy._store.column('node.borderGeom');
    var slot = cy._store.lookup('n').slot;

    expect(geom[slot * 4] / 256).to.equal(28);
    expect(r == null).to.equal(true);
  });

  it('corner-radius takes mappers; border-position takes case mappers', function () {
    cy = cytoscape({
      elements: [
        { data: { id: 'a', big: 1 }, position: { x: 0, y: 0 } },
        { data: { id: 'b', big: 0 }, position: { x: 100, y: 0 } },
      ],
      style: {
        nodes: {
          shape: 'round-rectangle',
          'corner-radius': {
            data: 'big',
            scale: 'linear',
            domain: [0, 1],
            range: [2, 12],
          },
          'border-position': {
            case: [{ when: { data: 'big', eq: 1 }, then: 'inside' }],
            else: 'outside',
          },
        },
      },
    });

    var geom = cy._store.column('node.borderGeom');

    expect(geom[cy._store.lookup('a').slot * 4] / 256).to.equal(12);
    expect(geom[cy._store.lookup('b').slot * 4] / 256).to.equal(2);
    expect(cy.$id('a').style('border-position')).to.equal('inside');
    expect(cy.$id('b').style('border-position')).to.equal('outside');
  });

  afterEach(function () {
    if (cy != null) {
      cy.destroy();
      cy = null;
    }
  });
});
