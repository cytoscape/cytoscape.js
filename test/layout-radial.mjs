import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

// round 85.1 (#2493): the radial tree layout — hierarchy-aware angular
// wedges, each subtree a contiguous sector sized by its weight.  The
// discriminating property throughout is exactly what breadthfirst's
// circle: true does NOT have: a child's angle stays inside its
// parent's wedge, and a heavy subtree is measurably wider.  Controls
// (round 27, run once by hand): with the weights forced to 1 the
// exact-span specs go red; with uniform per-ring index angles the
// containment specs go red too.

const TAU = 2 * Math.PI;

describe('gpu/layout: radial (round 85.1)', function () {
  var cy;

  var mk = (elements) =>
    (cy = cytoscape({
      headlessWidth: 400,
      headlessHeight: 400,
      elements,
    }));

  var center = { x: 200, y: 200 };
  var posOf = (id) => cy.$id(id).position();
  var radiusOf = (id) =>
    Math.hypot(posOf(id).x - center.x, posOf(id).y - center.y);
  // angle in [0, 2π) measured the way the layout hands out wedges:
  // from startAngle, in sweep direction (the specs pass startAngle 0)
  var angleOf = (id) => {
    var p = posOf(id);
    var a = Math.atan2(p.y - center.y, p.x - center.x);

    return (a + TAU) % TAU;
  };

  // root → A (8 leaves) vs B (2 leaves): the unbalanced fixture
  var unbalanced = () => {
    var els = [{ data: { id: 'r' } }];

    for (var branch of [
      ['a', 8],
      ['b', 2],
    ]) {
      var name = branch[0];
      var leaves = branch[1];

      els.push({ data: { id: name } });
      els.push({ data: { id: 'r' + name, source: 'r', target: name } });

      for (var i = 0; i < leaves; i++) {
        els.push({ data: { id: name + i } });
        els.push({
          data: { id: name + 'e' + i, source: name, target: name + i },
        });
      }
    }

    return els;
  };

  var ids = (prefix, n) => Array.from({ length: n }, (_, i) => prefix + i);

  it('radius is monotone by depth, uniform within a ring', function () {
    mk(unbalanced());
    cy.layout({ name: 'radial', roots: ['r'], fit: false }).run();

    expect(radiusOf('r')).to.be.closeTo(0, 1e-6); // lone root at centre

    var r1 = radiusOf('a');

    expect(r1).to.be.above(0);
    expect(radiusOf('b')).to.be.closeTo(r1, 1e-3);

    for (var id of [...ids('a', 8), ...ids('b', 2)]) {
      var r2 = radiusOf(id);

      expect(r2).to.be.above(r1);
      expect(r2).to.be.closeTo(radiusOf('a0'), 1e-3);
    }
  });

  it('a child sits inside its parent wedge; sibling wedges are disjoint', function () {
    mk(unbalanced());
    cy.layout({
      name: 'radial',
      roots: ['r'],
      startAngle: 0,
      fit: false,
    }).run();

    // leaves weighting: A carries 8 of 10 leaves — wedge [0, 0.8·2π);
    // B the rest.  Every A-leaf must land in A's wedge, every B-leaf
    // in B's, with no interleaving — the #2493 ask.
    var aEnd = 0.8 * TAU;

    for (var idA of ids('a', 8)) {
      expect(angleOf(idA), idA).to.be.below(aEnd);
    }

    for (var idB of ids('b', 2)) {
      expect(angleOf(idB), idB).to.be.above(aEnd);
    }

    // the parents sit at their wedge bisectors
    expect(angleOf('a')).to.be.closeTo(aEnd / 2, 1e-6);
    expect(angleOf('b')).to.be.closeTo(aEnd + (TAU - aEnd) / 2, 1e-6);
  });

  it('the heavy subtree is measurably wider — exact spans', function () {
    mk(unbalanced());
    cy.layout({
      name: 'radial',
      roots: ['r'],
      startAngle: 0,
      fit: false,
    }).run();

    var span = (list) => {
      var angles = list.map(angleOf);

      return Math.max(...angles) - Math.min(...angles);
    };

    // 8 children at bisectors of equal shares of A's 0.8·2π wedge:
    // first-to-last spread is (7/8)·0.8·2π; B's likewise (1/2)·0.2·2π.
    // The weights are the whole difference — the run-once control
    // forcing every weight to 1 reads (7/8)·π and (1/2)·π here and
    // goes red on both.
    expect(span(ids('a', 8))).to.be.closeTo((7 / 8) * 0.8 * TAU, 1e-6);
    expect(span(ids('b', 2))).to.be.closeTo((1 / 2) * 0.2 * TAU, 1e-6);
  });

  it("weight: 'subtree' counts nodes where 'leaves' counts leaves", function () {
    // A: a chain of 4 (1 leaf, 4 nodes); B: a star of 4 leaves
    // (4 leaves, 5 nodes).  leaves → A:B = 1:4; subtree → 4:5.
    var els = [
      { data: { id: 'r' } },
      { data: { id: 'a' } },
      { data: { id: 'b' } },
      { data: { id: 'ra', source: 'r', target: 'a' } },
      { data: { id: 'rb', source: 'r', target: 'b' } },
      { data: { id: 'c1' } },
      { data: { id: 'c2' } },
      { data: { id: 'c3' } },
      { data: { id: 'ac1', source: 'a', target: 'c1' } },
      { data: { id: 'c1c2', source: 'c1', target: 'c2' } },
      { data: { id: 'c2c3', source: 'c2', target: 'c3' } },
    ];

    for (var i = 0; i < 4; i++) {
      els.push({ data: { id: 's' + i } });
      els.push({ data: { id: 'bs' + i, source: 'b', target: 's' + i } });
    }

    mk(els);
    cy.layout({
      name: 'radial',
      roots: ['r'],
      startAngle: 0,
      fit: false,
    }).run();

    // leaves: A gets 1/5 of the sweep — bisector at (1/5)·2π/2
    expect(angleOf('a')).to.be.closeTo(TAU / 10, 1e-6);

    cy.layout({
      name: 'radial',
      roots: ['r'],
      startAngle: 0,
      weight: 'subtree',
      fit: false,
    }).run();

    // subtree: A gets 4/9 — a different bisector, from the same graph
    expect(angleOf('a')).to.be.closeTo((4 / 9 / 2) * TAU, 1e-6);
  });

  it('multiple roots partition the sweep and leave the centre', function () {
    // two disjoint stars: r1 with 3 leaves, r2 with 1
    var els = [];

    for (var branch of [
      ['r1', 3],
      ['r2', 1],
    ]) {
      var name = branch[0];

      els.push({ data: { id: name } });

      for (var i = 0; i < branch[1]; i++) {
        els.push({ data: { id: name + 'l' + i } });
        els.push({
          data: { id: name + 'e' + i, source: name, target: name + 'l' + i },
        });
      }
    }

    mk(els);
    cy.layout({
      name: 'radial',
      roots: ['r1', 'r2'],
      startAngle: 0,
      fit: false,
    }).run();

    // both roots move out to the first ring (they cannot share the
    // centre), at their trees' wedge bisectors: 3/4 vs 1/4 of the sweep
    var r = radiusOf('r1');

    expect(r).to.be.above(0);
    expect(radiusOf('r2')).to.be.closeTo(r, 1e-3);
    expect(angleOf('r1')).to.be.closeTo((3 / 4 / 2) * TAU, 1e-6);
    expect(angleOf('r2')).to.be.closeTo((3 / 4 + 1 / 8) * TAU, 1e-6);

    // and an unrooted disconnected component still gets a wedge: drop
    // r2 from roots and it is discovered as its own tree
    cy.layout({
      name: 'radial',
      roots: ['r1'],
      startAngle: 0,
      fit: false,
    }).run();

    expect(radiusOf('r2')).to.be.above(0);
    expect(Number.isFinite(angleOf('r2l0'))).to.equal(true);
  });

  it('clockwise: false mirrors the sweep', function () {
    mk(unbalanced());
    cy.layout({
      name: 'radial',
      roots: ['r'],
      startAngle: 0,
      fit: false,
    }).run();

    var cw = angleOf('a');

    cy.layout({
      name: 'radial',
      roots: ['r'],
      startAngle: 0,
      clockwise: false,
      fit: false,
    }).run();

    expect(angleOf('a')).to.be.closeTo(TAU - cw, 1e-6);
  });

  it('levelSpacing sets the ring gap exactly (avoidOverlap off)', function () {
    mk(unbalanced());
    cy.layout({
      name: 'radial',
      roots: ['r'],
      levelSpacing: 37,
      fit: false,
      avoidOverlap: false,
    }).run();

    expect(radiusOf('a')).to.be.closeTo(37, 1e-4);
    expect(radiusOf('a0')).to.be.closeTo(74, 1e-4);
  });

  it('levelSpacing is a floor under avoidOverlap (114.6; exact since 115)', function () {
    // 30 px bodies padded by 10 are 40 px boxes: two rings cannot sit
    // 37 apart without touching, so the first ring grows past the floor
    // — to no more than the 40 px band plus what its own neighbours
    // need, not the 56.6 px diagonal 114.6 charged — and the second,
    // holding eight leaves in A's wedge, grows well past 74
    mk(unbalanced());
    cy.layout({
      name: 'radial',
      roots: ['r'],
      levelSpacing: 37,
      fit: false,
    }).run();

    expect(radiusOf('a')).to.be.greaterThan(40 - 1e-4);
    expect(radiusOf('a')).to.be.lessThan(40 * Math.SQRT2);
    expect(radiusOf('a0')).to.be.greaterThan(74);
  });

  it('throws on a selector-string roots, and joins the dispatch throw', function () {
    mk(unbalanced());

    expect(() => cy.layout({ name: 'radial', roots: '#r' }).run()).to.throw(
      /collection or an array of node ids/,
    );

    // the unknown-name throw now lists radial among the built-ins
    expect(() => cy.layout({ name: 'cose' })).to.throw(/'radial'/);
  });

  // Round 114.6: rings grow to clear overlap; the wedge angles never move.
  describe('avoidOverlap (114.6)', function () {
    var star = (leaves) => {
      var els = [{ data: { id: 'r' } }];

      for (var i = 0; i < leaves; i++) {
        els.push({ data: { id: 'l' + i } });
        els.push({ data: { id: 'e' + i, source: 'r', target: 'l' + i } });
      }

      return els;
    };

    var overlapping = (includeLabels) => {
      var boxes = cy.nodes().map((n) => n.boundingBox({ includeLabels }));
      var count = 0;

      for (var i = 0; i < boxes.length; i++) {
        for (var j = i + 1; j < boxes.length; j++) {
          var a = boxes[i];
          var b = boxes[j];

          if (a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2) {
            count++;
          }
        }
      }

      return count;
    };

    it('a 24-leaf star of 40 px nodes has no overlapping bodies', function () {
      mk(star(24));
      cy.style({ nodes: { width: 40, height: 40 } });
      cy.layout({ name: 'radial', roots: ['r'], fit: false }).run();

      expect(overlapping(false)).to.equal(0);
    });

    it('control: avoidOverlap: false keeps the bounding-box ring, and the leaves overlap', function () {
      mk(star(24));
      cy.style({ nodes: { width: 40, height: 40 } });
      cy.layout({
        name: 'radial',
        roots: ['r'],
        fit: false,
        avoidOverlap: false,
      }).run();

      // the pre-114 radius: half the 400 box over (maxRing + 1) rings
      expect(radiusOf('l0')).to.be.closeTo(100, 1e-4);
      expect(overlapping(false)).to.be.greaterThan(0);
    });

    it('keeps every wedge angle: only the radius moves', function () {
      mk(unbalanced());
      cy.style({ nodes: { width: 40, height: 40 } });
      cy.layout({
        name: 'radial',
        roots: ['r'],
        startAngle: 0,
        fit: false,
      }).run();

      var grown = Object.fromEntries(
        cy.nodes().map((n) => [n.id(), angleOf(n.id())]),
      );

      cy.layout({
        name: 'radial',
        roots: ['r'],
        startAngle: 0,
        fit: false,
        avoidOverlap: false,
      }).run();

      for (var id of Object.keys(grown)) {
        if (id === 'r') {
          continue;
        }

        expect(angleOf(id), id).to.be.closeTo(grown[id], 1e-6);
      }
    });

    it('labels widen the rings on request; the default (bodies alone) does not', function () {
      mk(star(12));
      cy.style({
        nodes: {
          width: 20,
          height: 20,
          label: 'a label wide enough to matter',
        },
      });
      cy.layout({
        name: 'radial',
        roots: ['r'],
        fit: false,
        nodeDimensionsIncludeLabels: true,
      }).run();

      var withLabels = radiusOf('l0');

      expect(overlapping(true)).to.equal(0);

      cy.layout({
        name: 'radial',
        roots: ['r'],
        fit: false,
        nodeDimensionsIncludeLabels: false,
      }).run();

      expect(radiusOf('l0')).to.be.lessThan(withLabels);
      // the control: bodies clear, the labels do not
      expect(overlapping(false)).to.equal(0);
      expect(overlapping(true)).to.be.greaterThan(0);
    });
  });
});
