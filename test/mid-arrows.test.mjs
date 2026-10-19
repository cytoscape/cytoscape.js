import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

// round 13 C1: mid-source/mid-target arrows

describe('gpu/mid-arrows (round 13 C1)', function () {
  var cy;

  var makeCy = (edgeStyle) =>
    cytoscape({
      elements: [
        { data: { id: 'a' }, position: { x: 0, y: 0 } },
        { data: { id: 'b' }, position: { x: 100, y: 0 } },
        { data: { id: 'e', source: 'a', target: 'b' } },
      ],
      style: { edges: edgeStyle },
    });

  it('packs mid shapes into bits 8..15 and stores folded colors (27.1)', function () {
    cy = makeCy({
      'mid-target-arrow-shape': 'diamond',
      'mid-target-arrow-color': '#f00',
      'mid-source-arrow-shape': 'tee',
      'mid-source-arrow-color': '#00f',
      opacity: 0.5,
    });

    var slot = cy._store.lookup('e').slot;
    var word = cy._store.column('edge.arrowShapes')[slot];

    // 27.1: four 4-bit ids — source, target, mid-source, mid-target
    expect((word >>> 8) & 0xf).to.equal(7); // tee
    expect((word >>> 12) & 0xf).to.equal(6); // diamond

    var tgt = cy._store.column('edge.midTargetArrow');

    expect(tgt[slot * 4]).to.equal(255);
    expect(tgt[slot * 4 + 3]).to.equal(128); // opacity folded

    expect(cy._store.midArrowCount()).to.equal(1);
  });

  it('reads back shapes and colors (transparent reads none)', function () {
    cy = makeCy({
      'mid-target-arrow-shape': 'circle',
      'mid-target-arrow-color': '#0f0',
    });

    var e = cy.$id('e');

    expect(e.style('mid-target-arrow-shape')).to.equal('circle');
    expect(e.style('mid-source-arrow-shape')).to.equal('none');
    expect(e.style('mid-target-arrow-color')).to.contain('0,255,0');

    cy.style({ edges: {} });

    expect(cy.$id('e').style('mid-target-arrow-shape')).to.equal('none');
    expect(cy._store.midArrowCount()).to.equal(0);
  });

  it('mid props take mappers', function () {
    cy = cytoscape({
      elements: [
        { data: { id: 'a' }, position: { x: 0, y: 0 } },
        { data: { id: 'b' }, position: { x: 100, y: 0 } },
        { data: { id: 'e1', source: 'a', target: 'b', dir: 1 } },
        { data: { id: 'e2', source: 'a', target: 'b', dir: 0 } },
      ],
      style: {
        edges: {
          'mid-target-arrow-shape': {
            case: [{ when: { data: 'dir', eq: 1 }, then: 'triangle' }],
            else: 'none',
          },
          'mid-target-arrow-color': '#f0f',
        },
      },
    });

    expect(cy.$id('e1').style('mid-target-arrow-shape')).to.equal('triangle');
    expect(cy.$id('e2').style('mid-target-arrow-shape')).to.equal('none');
    expect(cy._store.midArrowCount()).to.equal(1);
  });

  // round 76 (PLAN.md item 21's width half): v3's hollow-stroke width
  // for the mid heads.  Mid heads are always filled, and v3 reads the
  // width only to stroke a hollow head, so it draws nothing in either
  // library — what ports is the property: parse, bypass, readback.
  describe('mid-source/-target-arrow-width (round 76)', function () {
    it('reads back v3 default 1 and resolves match-line and % against the width', function () {
      cy = makeCy({
        width: 4,
        'mid-source-arrow-width': 'match-line',
        'mid-target-arrow-width': '50%',
      });

      var e = cy.$id('e');

      expect(makeCy({}).$id('e').style('mid-source-arrow-width')).to.equal(1);
      expect(e.style('mid-source-arrow-width')).to.equal(4);
      expect(e.style('mid-target-arrow-width')).to.equal(2);
      expect(e.style('midTargetArrowWidth')).to.equal(2);

      // a width change moves the relative forms with it, as the end
      // widths move at write
      e.style('width', 10);

      expect(e.style('mid-source-arrow-width')).to.equal(10);
      expect(e.style('mid-target-arrow-width')).to.equal(5);
    });

    it('a bypass wins over the sheet, and a sheet replace clears it', function () {
      cy = makeCy({ 'mid-source-arrow-width': 3 });

      var e = cy.$id('e');

      e.style('mid-source-arrow-width', 7);

      expect(e.style('mid-source-arrow-width')).to.equal(7);
      // the other mid is untouched by the patch
      expect(e.style('mid-target-arrow-width')).to.equal(1);

      // round 133's sheet diff takes the narrow (no-op) writer for a
      // mid-width-only change; readback follows the new sheet
      cy.style({ edges: { 'mid-source-arrow-width': 2 } });

      expect(e.style('mid-source-arrow-width')).to.equal(2);
    });

    it('is constants-only and non-negative, like the end widths', function () {
      expect(() =>
        makeCy({ 'mid-source-arrow-width': { data: 'w' } }),
      ).to.throw(/does not support mappers/);
      expect(() => makeCy({ 'mid-target-arrow-width': -1 })).to.throw(
        /may not be negative/,
      );
    });

    it('stores nothing: the mid heads draw the same bytes at any width', function () {
      var a = makeCy({ 'mid-target-arrow-shape': 'triangle' });
      var b = makeCy({
        'mid-target-arrow-shape': 'triangle',
        'mid-target-arrow-width': 9,
      });

      for (var id of [
        'edge.arrowShapes',
        'edge.arrowWidths',
        'edge.midTargetArrow',
        'edge.width',
      ]) {
        expect(Array.from(b._store.column(id)), id).to.deep.equal(
          Array.from(a._store.column(id)),
        );
      }

      a.destroy();
      b.destroy();
    });
  });

  afterEach(function () {
    if (cy != null) {
      cy.destroy();
      cy = null;
    }
  });
});
