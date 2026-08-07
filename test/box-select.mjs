import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

describe('gpu/box-select', function () {
  describe('cy.selectionType()', function () {
    it('defaults to single', function () {
      var cy = cytoscape();

      expect(cy.selectionType()).to.equal('single');
    });

    it('is settable via the option and the method', function () {
      var cy = cytoscape({ selectionType: 'additive' });

      expect(cy.selectionType()).to.equal('additive');

      cy.selectionType('single');

      expect(cy.selectionType()).to.equal('single');
    });

    it('rejects invalid values', function () {
      var cy = cytoscape();

      expect(function () {
        cy.selectionType('bogus');
      }).to.throw(/selection type/);
      expect(function () {
        cytoscape({ selectionType: 'bogus' });
      }).to.throw(/selection type/);
    });

    it('is included in the json() export', function () {
      expect(cytoscape().json().selectionType).to.equal('single');
    });
  });

  describe('cy.elementsInBox()', function () {
    var cy;

    beforeEach(function () {
      // default node size 30x30, so a node "contains" iff its 30x30 box fits
      cy = cytoscape({
        elements: [
          { data: { id: 'in1' }, position: { x: 50, y: 50 } },
          { data: { id: 'in2' }, position: { x: 80, y: 80 } },
          { data: { id: 'edgeOfBox' }, position: { x: 10, y: 50 } }, // bb sticks out at x < 0
          { data: { id: 'out' }, position: { x: 500, y: 500 } },
          { data: { id: 'inIn', source: 'in1', target: 'in2' } },
          { data: { id: 'inOut', source: 'in1', target: 'out' } },
        ],
      });
    });

    it('contains nodes whose bounding box lies fully inside', function () {
      var box = cy.elementsInBox(0, 0, 100, 100);

      expect(box.nodes().map((n) => n.id())).to.deep.equal(['in1', 'in2']);
    });

    it('excludes nodes that only partially overlap', function () {
      // edgeOfBox at x=10 has bb x1 = -5 < 0
      expect(
        cy.elementsInBox(0, 0, 100, 100).getElementById('edgeOfBox'),
      ).to.have.length(0);

      // a box that also covers the negative-x fringe contains it
      expect(
        cy.elementsInBox(-10, 0, 100, 100).getElementById('edgeOfBox'),
      ).to.have.length(1);
    });

    it('accounts for the border width in the node bounding box', function () {
      cy.style({ nodes: { 'border-width': 20 } });

      // 30/2 + 20/2 = 25 half-extent; in1 at (50,50) no longer fits in x >= 30
      expect(
        cy.elementsInBox(30, 0, 100, 100).getElementById('in1'),
      ).to.have.length(0);
      expect(
        cy.elementsInBox(0, 0, 100, 100).getElementById('in1'),
      ).to.have.length(1);
    });

    it('contains edges when both endpoint centers are inside', function () {
      var box = cy.elementsInBox(0, 0, 100, 100);

      expect(box.edges().map((e) => e.id())).to.deep.equal(['inIn']);
    });

    it('accepts corners in any order', function () {
      expect(cy.elementsInBox(100, 100, 0, 0).nodes()).to.have.length(2);
    });

    it('excludes hidden elements', function () {
      cy.$id('in1').hide();

      var box = cy.elementsInBox(0, 0, 100, 100);

      expect(box.getElementById('in1')).to.have.length(0);
      // edges of a hidden node still report: visibility masks per element,
      // and inIn itself is visible with both endpoints inside
      expect(box.getElementById('in2')).to.have.length(1);
    });

    it('excludes removed elements', function () {
      cy.$id('in2').remove();

      var box = cy.elementsInBox(0, 0, 100, 100);

      expect(box.getElementById('in2')).to.have.length(0);
      expect(box.getElementById('inIn')).to.have.length(0); // cascaded away
    });

    it('feeds the usual selection flow', function () {
      var box = cy.elementsInBox(0, 0, 100, 100);

      box.filter((ele) => ele.selectable() && !ele.selected()).select();

      expect(cy.elements({ selected: true }).map((e) => e.id())).to.deep.equal([
        'in1',
        'in2',
        'inIn',
      ]);
    });
  });

  describe('curved edges (12b: the curve-endpoint upgrade)', function () {
    it('a curved edge tests its curve boundary endpoints, not just centers', function () {
      // a segments edge whose route bulges: the *curve endpoints* sit on
      // the node boundaries, so a box containing both boundary points —
      // but not the full node boxes — still contains the edge
      var cy = cytoscape({
        elements: [
          { data: { id: 'a' }, position: { x: 0, y: 0 } },
          { data: { id: 'b' }, position: { x: 100, y: 0 } },
          { data: { id: 'e', source: 'a', target: 'b' } },
        ],
        style: {
          edges: { 'curve-style': 'segments', 'segment-distances': 20 },
        },
      });

      var s = cy.$id('e').sourceEndpoint();
      var t = cy.$id('e').targetEndpoint();

      // a box just around the two curve endpoints contains the edge...
      var box = cy.elementsInBox(
        s.x - 1,
        Math.min(s.y, t.y) - 1,
        t.x + 1,
        Math.max(s.y, t.y) + 25,
      );

      expect(box.filter((e) => e.isEdge()).map((e) => e.id())).to.deep.equal([
        'e',
      ]);

      // ...and a box that excludes the source-side boundary point does not
      var miss = cy.elementsInBox(s.x + 2, -100, t.x + 1, 100);

      expect(miss.filter((e) => e.isEdge())).to.have.length(0);
    });

    it('a taxi edge is contained by the box around its launch endpoints', function () {
      var cy = cytoscape({
        elements: [
          { data: { id: 'a' }, position: { x: 0, y: 0 } },
          { data: { id: 'b' }, position: { x: 10, y: 200 } },
          { data: { id: 'e', source: 'a', target: 'b' } },
        ],
        style: { edges: { 'curve-style': 'taxi' } },
      });

      // launch endpoints: (0, 15) and (10, 185)
      var hit = cy.elementsInBox(-5, 10, 15, 190);

      expect(hit.filter((e) => e.isEdge()).map((e) => e.id())).to.deep.equal([
        'e',
      ]);

      var miss = cy.elementsInBox(-5, 20, 15, 190); // cuts the source launch

      expect(miss.filter((e) => e.isEdge())).to.have.length(0);
    });
  });
  /*
  Round 39.1: the overlap mode.  v3 offers containment *and* overlap;
  v4 had containment only, and the fifth design sitting decided to build
  the other half.

  Two boundaries are worth stating because the specs below are shaped by
  them.  The mode is read by the **gesture**, not by cy.elementsInBox(),
  which stays the pure geometric containment query — an interaction
  preference should not move a programmatic caller's results.  And
  boxSelectionIncludesLabels reverses sense with the mode: under
  'contain' the label box must *also* be inside, under 'overlap' a label
  crossing the band is *enough*.  That is not a special case, it is what
  each mode can mean — containment is an AND over an element's parts,
  overlap an OR.
  */
  describe('cy.boxSelectionMode() (round 39.1)', function () {
    it('defaults to contain', function () {
      expect(cytoscape().boxSelectionMode()).to.equal('contain');
    });

    it('is settable via the option and the method', function () {
      var cy = cytoscape({ boxSelectionMode: 'overlap' });

      expect(cy.boxSelectionMode()).to.equal('overlap');

      cy.boxSelectionMode('contain');

      expect(cy.boxSelectionMode()).to.equal('contain');
    });

    it('rejects invalid values, at the ctor and the setter', function () {
      expect(function () {
        cytoscape().boxSelectionMode('touching');
      }).to.throw(/box selection mode/);
      expect(function () {
        cytoscape({ boxSelectionMode: 'touching' });
      }).to.throw(/box selection mode/);
    });
  });

  describe('overlap selection (round 39.1)', function () {
    // the gesture's query, which is what the mode reaches; the public
    // elementsInBox stays contain and is asserted to below
    var caught = (cy, x1, y1, x2, y2) =>
      cy
        ._elementsInGestureBox(x1, y1, x2, y2)
        .map((e) => e.id())
        .sort();

    it('takes a node the band merely touches', function () {
      var cy = cytoscape({
        elements: [
          { data: { id: 'straddles' }, position: { x: 100, y: 50 } }, // bb 85..115
          { data: { id: 'inside' }, position: { x: 50, y: 50 } },
          { data: { id: 'clear' }, position: { x: 400, y: 50 } },
        ],
      });

      cy.boxSelectionMode('overlap');

      expect(caught(cy, 0, 0, 90, 100)).to.deep.equal(['inside', 'straddles']);

      cy.boxSelectionMode('contain');

      expect(caught(cy, 0, 0, 90, 100)).to.deep.equal(['inside']);
    });

    it('takes an edge that crosses the band with both ends outside it', function () {
      // the case containment can never express, and the reason the test
      // is a segment clip rather than an endpoint check
      var cy = cytoscape({
        elements: [
          { data: { id: 'a' }, position: { x: -500, y: 0 } },
          { data: { id: 'b' }, position: { x: 500, y: 0 } },
          { data: { id: 'e', source: 'a', target: 'b' } },
        ],
      });

      cy.boxSelectionMode('overlap');

      // a tall thin band across the middle: no node in it, the edge through it
      expect(caught(cy, -20, -200, 20, 200)).to.deep.equal(['e']);

      cy.boxSelectionMode('contain');

      expect(caught(cy, -20, -200, 20, 200)).to.deep.equal([]);
    });

    it('misses an edge whose line passes outside the band', function () {
      // the control for the spec above: same band, edge moved off it, so
      // "the clip returns true for everything" would show here
      var cy = cytoscape({
        elements: [
          { data: { id: 'a' }, position: { x: -500, y: 300 } },
          { data: { id: 'b' }, position: { x: 500, y: 300 } },
          { data: { id: 'e', source: 'a', target: 'b' } },
        ],
      });

      cy.boxSelectionMode('overlap');

      expect(caught(cy, -20, -200, 20, 200)).to.deep.equal([]);
    });

    it('takes a curved edge by its curve, not its chord', function () {
      // a bezier bulging away from the straight line between its ends:
      // a band the *curve* enters but the chord misses is caught only by
      // walking the flattened path
      var cy = cytoscape({
        elements: [
          { data: { id: 'a' }, position: { x: -200, y: 0 } },
          { data: { id: 'b' }, position: { x: 200, y: 0 } },
          { data: { id: 'e1', source: 'a', target: 'b' } },
          { data: { id: 'e2', source: 'a', target: 'b' } },
        ],
        style: {
          edges: { 'curve-style': 'bezier', 'control-point-step-size': 120 },
        },
      });

      cy.boxSelectionMode('overlap');

      var mid = cy.$id('e1').midpoint();

      expect(
        Math.abs(mid.y),
        'the fixture is not curved; this spec proves nothing',
      ).to.be.greaterThan(20);

      // a band around the curve's apex, well clear of the chord at y = 0
      var band = caught(cy, mid.x - 5, mid.y - 5, mid.x + 5, mid.y + 5);

      expect(band).to.include('e1');

      // and the mirrored sibling curves the other way, so it is not in it
      expect(band).to.not.include('e2');
    });

    it('misses a band inside a curved edge bb that the curve does not reach', function () {
      // the control that made the spec above mean something.  Written
      // first without this, all the overlap specs passed with the exact
      // flattened walk deliberately removed — the conservative bb reject
      // was doing every bit of the work, so nothing tested the walk.
      var cy = cytoscape({
        elements: [
          { data: { id: 'a' }, position: { x: -200, y: 0 } },
          { data: { id: 'b' }, position: { x: 200, y: 0 } },
          { data: { id: 'e1', source: 'a', target: 'b' } },
          { data: { id: 'e2', source: 'a', target: 'b' } },
        ],
        style: {
          edges: { 'curve-style': 'bezier', 'control-point-step-size': 120 },
        },
      });

      cy.boxSelectionMode('overlap');

      var bb = cy.$id('e1').boundingBox();

      // the top-left corner of the arc's box: inside the bb, ~18 model px
      // clear of the curve, which near that x has barely left its endpoint
      var band = [bb.x1 + 5, bb.y1, bb.x1 + 15, bb.y1 + 7];

      expect(caught(cy, ...band)).to.deep.equal([]);

      // and the same band moved onto the curve does catch it, so the
      // scene is not simply out of range
      expect(caught(cy, bb.x1 + 5, -9, bb.x1 + 15, -5)).to.include('e1');
    });

    it('misses a band inside a straight edge bb that the line does not reach', function () {
      // the same control for the straight path: a diagonal edge's bb
      // covers two corners the line comes nowhere near
      var cy = cytoscape({
        elements: [
          { data: { id: 'a' }, position: { x: 0, y: 0 } },
          { data: { id: 'b' }, position: { x: 400, y: 400 } },
          { data: { id: 'e', source: 'a', target: 'b' } },
        ],
      });

      cy.boxSelectionMode('overlap');

      // the off-diagonal corner: well inside the edge's bb, far off its line
      expect(caught(cy, 300, 40, 380, 90)).to.deep.equal([]);

      // on the diagonal, it is caught
      expect(caught(cy, 300, 290, 380, 340)).to.deep.equal(['e']);
    });

    it('lets a label widen an overlap where it narrows a containment', function () {
      var cy = cytoscape({
        elements: [
          {
            data: { id: 'n', label: 'a long label indeed' },
            position: { x: 0, y: 0 },
          },
        ],
        boxSelectionIncludesLabels: true,
        style: {
          nodes: {
            label: { data: 'label' },
            'text-halign': 'right',
            'font-size': 20,
          },
        },
      });

      var lb = cy.$id('n').labelBoundingBox();

      expect(
        lb.w,
        'the label has no width; this spec proves nothing',
      ).to.be.greaterThan(30);

      // a band out to the right of the node body, over the label only
      var band = [30, -20, lb.x2 - 1, 20];

      cy.boxSelectionMode('overlap');

      expect(caught(cy, ...band)).to.deep.equal(['n']);

      // under contain the same band takes nothing: the body is not in it
      cy.boxSelectionMode('contain');

      expect(caught(cy, ...band)).to.deep.equal([]);
    });

    it('leaves cy.elementsInBox() geometric whatever the gesture is set to', function () {
      var cy = cytoscape({
        elements: [{ data: { id: 'straddles' }, position: { x: 100, y: 50 } }],
      });

      cy.boxSelectionMode('overlap');

      expect(cy.elementsInBox(0, 0, 90, 100).length).to.equal(0);
      expect(caught(cy, 0, 0, 90, 100)).to.deep.equal(['straddles']);
    });
  });
});
