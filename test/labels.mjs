import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

// The model half of SDF labels: the per-node label sidecar written by the
// style engine, and its dirty channel to the renderer.

describe('gpu/labels: model', function () {
  var cy;

  var labelOf = (id) => cy._store.labelAt(cy._store.lookup(id).slot);

  beforeEach(function () {
    cy = cytoscape({
      elements: [
        { data: { id: 'a' } },
        { data: { id: 'b' } },
        { data: { id: 'ab', source: 'a', target: 'b' } },
      ],
    });

    cy._store.takeLabelDirty(); // start clean
  });

  describe('style compilation', function () {
    it('has no label by default', function () {
      expect(labelOf('a')).to.be.undefined;
      expect(cy.$id('a').label()).to.equal('');
    });

    it('applies constant labels', function () {
      cy.style({ nodes: { label: 'hello' } });

      expect(labelOf('a').text).to.equal('hello');
      expect(cy.$id('a').label()).to.equal('hello');
    });

    it('resolves the data(id) mapper to the element id', function () {
      cy.style({ nodes: { label: 'data(id)' } });

      expect(labelOf('a').text).to.equal('a');
      expect(labelOf('b').text).to.equal('b');
    });

    it('accepts data(key) mappers but rejects mapData', function () {
      expect(function () {
        cy.style({ nodes: { label: 'data(name)' } });
      }).to.not.throw();

      expect(function () {
        cy.style({ nodes: { label: 'mapData(w, 0, 1, a, b)' } });
      }).to.throw();

      // the end-label twin shares the rule but not the guard
      expect(function () {
        cy.style({ edges: { 'source-label': 'mapData(w, 0, 1)' } });
      }).to.throw(/source-label value 'mapData\(w, 0, 1\)' is unsupported/);
    });

    it('applies font-size and color with v3-like defaults', function () {
      cy.style({ nodes: { label: 'x' } });

      expect(labelOf('a').fontSize).to.equal(16);
      expect(labelOf('a').color).to.equal(0xff000000); // opaque black, packed LE

      cy.style({ nodes: { label: 'x', 'font-size': 10, color: 'red' } });

      expect(labelOf('a').fontSize).to.equal(10);
      expect(labelOf('a').color).to.equal(0xff0000ff); // a<<24 | b<<16 | g<<8 | r
    });

    it('anchors below the node body', function () {
      cy.style({ nodes: { label: 'x', height: 50 } });

      expect(labelOf('a').anchorY).to.equal(29); // h/2 + 4px margin
    });

    it('clears the label when styled back to empty', function () {
      cy.style({ nodes: { label: 'x' } });
      cy.style({ nodes: {} });

      expect(labelOf('a')).to.be.undefined;
    });

    it('labels added elements', function () {
      cy.style({ nodes: { label: 'data(id)' } });

      cy.add({ data: { id: 'c' } });

      expect(labelOf('c').text).to.equal('c');
    });
  });

  describe('dirty channel', function () {
    it('marks labelled slots dirty and clears on take', function () {
      cy.style({ nodes: { label: 'data(id)' } });

      var dirty = cy._store.takeLabelDirty();

      expect(dirty).to.have.length(2);
      expect(cy._store.takeLabelDirty()).to.have.length(0);
    });

    it('does not re-mark unchanged labels', function () {
      cy.style({ nodes: { label: 'data(id)' } });
      cy._store.takeLabelDirty();

      cy.style({ nodes: { label: 'data(id)' } }); // same computed values

      expect(cy._store.takeLabelDirty()).to.have.length(0);
    });

    it('marks on removal of a labelled node', function () {
      cy.style({ nodes: { label: 'data(id)' } });
      cy._store.takeLabelDirty();

      var slot = cy._store.lookup('a').slot;

      cy.$id('a').remove();

      expect(cy._store.takeLabelDirty()).to.deep.equal([slot]);
      expect(cy._store.labelAt(slot)).to.be.undefined;
    });

    it('reports dirt through hasDirty and onInvalidate', async function () {
      cy._store.takeDelta();

      var calls = 0;

      cy._store.onInvalidate(function () {
        calls++;
      });
      cy.style({ nodes: { label: 'x' } });

      expect(cy._store.hasDirty()).to.be.true;

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(calls).to.equal(1);

      cy._store.takeDelta();

      expect(cy._store.hasDirty()).to.be.false;
    });

    it('marks when only the anchor height changes', function () {
      cy.style({ nodes: { label: 'x' } });
      cy._store.takeLabelDirty();

      cy.style({ nodes: { label: 'x', height: 60 } });

      expect(cy._store.takeLabelDirty()).to.have.length(2);
      expect(labelOf('a').anchorY).to.equal(34);
    });
  });
});
