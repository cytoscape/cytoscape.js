import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

/*
Round 27.7: per-element numeric `text-rotation`.

Before this, rotation was one bit — `autorotate`, edge labels only, with
the angle derived live on the GPU from the edge's slope.  v3 also accepts
a plain number of radians, on any label.

The stored value is the angle in radians with `NaN` meaning autorotate.
That encoding works because 'none' and a rotation of 0 radians are the
same rendering, so collapsing them costs nothing, and it leaves the whole
real line free for numeric values — an enum id would have collided, since
1 radian is a perfectly ordinary rotation.
*/

const GRAPH = [
  { data: { id: 'a' }, position: { x: 0, y: 0 } },
  { data: { id: 'b' }, position: { x: 120, y: 0 } },
  { data: { id: 'e', source: 'a', target: 'b' } },
];

const makeCy = (nodes = {}, edges = {}) =>
  cytoscape({
    elements: GRAPH,
    style: {
      nodes: { label: 'hi', 'font-size': 12, ...nodes },
      edges: { label: 'edge', 'font-size': 12, ...edges },
    },
  });

describe('gpu/style: numeric text-rotation (round 27.7)', function () {
  describe('the keyword modes still work', function () {
    it('defaults to none', function () {
      const cy = makeCy();

      expect(cy.$id('e').style('text-rotation')).to.equal('none');
      cy.destroy();
    });

    it('keeps autorotate on edge labels', function () {
      const cy = makeCy({}, { 'text-rotation': 'autorotate' });

      expect(cy.$id('e').style('text-rotation')).to.equal('autorotate');
      cy.destroy();
    });
  });

  describe('numeric rotations', function () {
    it('are accepted on edge labels and read back as the number', function () {
      const cy = makeCy({}, { 'text-rotation': 0.5 });

      expect(cy.$id('e').style('text-rotation')).to.equal(0.5);
      cy.destroy();
    });

    it('are accepted on node labels — the mode v4 had no path for', function () {
      const cy = makeCy({ 'text-rotation': Math.PI / 4 });

      expect(cy.$id('a').style('text-rotation')).to.be.closeTo(
        Math.PI / 4,
        1e-6,
      );
      cy.destroy();
    });

    it('do not collide with the autorotate sentinel at 1 radian', function () {
      // the reason the encoding is an angle with a NaN sentinel rather
      // than an enum id: 1 was autorotate's id before 27.7
      const cy = makeCy({}, { 'text-rotation': 1 });

      expect(cy.$id('e').style('text-rotation')).to.equal(1);
      cy.destroy();
    });

    it('treat 0 as none — the same rendering, so the same value', function () {
      const cy = makeCy({}, { 'text-rotation': 0 });

      expect(cy.$id('e').style('text-rotation')).to.equal('none');
      cy.destroy();
    });

    it('accept negative angles', function () {
      const cy = makeCy({ 'text-rotation': -0.75 });

      expect(cy.$id('a').style('text-rotation')).to.equal(-0.75);
      cy.destroy();
    });

    it('reach the label sidecar as an angle, with the flag clear', function () {
      const cy = makeCy({ 'text-rotation': 0.3 });
      const slot = cy._store.lookup('a').slot;
      const entry = cy._store.labelAt(slot, 'nodes');

      expect(entry.rotation).to.be.closeTo(0.3, 1e-6);
      expect(entry.rotate, 'nodes never autorotate').to.equal(false);
      cy.destroy();
    });

    it('keep autorotate and the angle apart in the sidecar', function () {
      const cy = makeCy({}, { 'text-rotation': 'autorotate' });
      const slot = cy._store.lookup('e').slot;
      const entry = cy._store.labelAt(slot, 'edges');

      expect(entry.rotate).to.equal(true);
      expect(entry.rotation, 'the angle stays 0 under autorotate').to.equal(0);
      cy.destroy();
    });
  });

  describe('the end-label streams', function () {
    it('take numeric rotations too', function () {
      const cy = cytoscape({
        elements: GRAPH,
        style: {
          edges: {
            'source-label': 'S',
            'source-text-rotation': 0.4,
            'target-label': 'T',
            'target-text-rotation': 'autorotate',
            'font-size': 12,
          },
        },
      });
      const e = cy.$id('e');

      expect(e.style('source-text-rotation')).to.be.closeTo(0.4, 1e-6);
      expect(e.style('target-text-rotation')).to.equal('autorotate');
      cy.destroy();
    });
  });

  describe('validation', function () {
    it('rejects a non-numeric, non-keyword value', function () {
      expect(() => makeCy({}, { 'text-rotation': 'sideways' })).to.throw(
        /text-rotation/,
      );
    });

    it('rejects a non-finite number', function () {
      expect(() => makeCy({}, { 'text-rotation': Infinity })).to.throw(
        /text-rotation/,
      );
    });
  });

  describe('mappers', function () {
    it('drive the rotation from data', function () {
      const cy = cytoscape({
        elements: [
          { data: { id: 'a', turn: 0.2 }, position: { x: 0, y: 0 } },
          { data: { id: 'b', turn: 1.1 }, position: { x: 80, y: 0 } },
        ],
        style: {
          nodes: {
            label: 'x',
            'font-size': 12,
            'text-rotation': { data: 'turn' },
          },
        },
      });

      expect(cy.$id('a').style('text-rotation')).to.be.closeTo(0.2, 1e-6);
      expect(cy.$id('b').style('text-rotation')).to.be.closeTo(1.1, 1e-6);
      cy.destroy();
    });
  });
});
