import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

// Round 124.3: `taxi-turn: auto`, `taxi-track` and `taxi-track-spacing`
// through the public surface — the props parse, store and read back;
// the store's track pass writes the params header's n lane from live
// positions (lazily, off the geo epoch); the route accessors, the
// bounding box and a drag all read the same track.
//
// Fixtures are 30x30 nodes (outer half 15) in a downward drawing with
// rank 0 at y = 0 and rank 1 at y = 200: an edge's ideal band is
// [25, 175], and the 50 % turn is the line y = 100.

describe('gpu/taxi-auto (round 124.3)', function () {
  var cy;

  var node = (id, x, y) => ({ data: { id }, position: { x, y } });
  var edge = (s, t) => ({ data: { id: `${s}->${t}`, source: s, target: t } });

  var make = (elements, edgeStyle) =>
    (cy = cytoscape({
      elements,
      style: {
        edges: {
          'curve-style': 'taxi',
          'taxi-direction': 'downward',
          'taxi-turn': 'auto',
          ...edgeStyle,
        },
      },
    }));

  // A at x=0 fans to 100 and 200; B at x=100 fans to 0 and 300: the
  // two runs overlap, so the pass separates them
  var twoFans = () => [
    node('A', 0, 0),
    node('B', 100, 0),
    node('a1', 100, 200),
    node('a2', 200, 200),
    node('b1', 0, 200),
    node('b2', 300, 200),
    edge('A', 'a1'),
    edge('A', 'a2'),
    edge('B', 'b1'),
    edge('B', 'b2'),
  ];

  var lineOf = (id) => cy.$id(id).segmentPoints()[0].y;

  afterEach(function () {
    if (cy != null) {
      cy.destroy();
      cy = null;
    }
  });

  describe('the props', function () {
    it("'taxi-turn: auto' reads back as 'auto'; the track props take their defaults", function () {
      make([node('a', 0, 0), node('b', 0, 200), edge('a', 'b')]);

      var e = cy.$id('a->b');

      expect(e.style('taxi-turn')).to.equal('auto');
      expect(e.style('taxi-track')).to.equal('source');
      expect(e.style('taxi-track-spacing')).to.equal(10);
    });

    it('taxi-track and taxi-track-spacing parse, store and read back', function () {
      make([node('a', 0, 0), node('b', 0, 200), edge('a', 'b')], {
        'taxi-track': 'family',
        'taxi-track-spacing': 14,
      });

      var e = cy.$id('a->b');

      expect(e.style('taxi-track')).to.equal('family');
      expect(e.style('taxi-track-spacing')).to.equal(14);
      expect(e.style('taxiTrack')).to.equal('family');
    });

    it('an invalid taxi-track throws, naming the keywords', function () {
      expect(() =>
        make([node('a', 0, 0), node('b', 0, 200), edge('a', 'b')], {
          'taxi-track': 'parent',
        }),
      ).to.throw(
        /taxi-track 'parent' is invalid; use one of: source, target, family/,
      );
    });

    it("a mapped taxi-turn takes `fallback: 'auto'`", function () {
      make(
        [
          node('a', 0, 0),
          node('b', 0, 200),
          { data: { id: 'px', source: 'a', target: 'b', turn: 40 } },
          { data: { id: 'auto', source: 'a', target: 'b' } },
        ],
        { 'taxi-turn': { data: 'turn', fallback: 'auto' } },
      );

      expect(cy.$id('px').style('taxi-turn')).to.equal(40);
      expect(cy.$id('auto').style('taxi-turn')).to.equal('auto');
      expect(cy._store.curves.taxiAutoSlots().size).to.equal(1);
    });

    it('a bypass to and from auto keeps the pass membership exact', function () {
      make([node('a', 0, 0), node('b', 0, 200), edge('a', 'b')], {
        'taxi-turn': '50%',
      });

      var e = cy.$id('a->b');
      var slots = cy._store.curves.taxiAutoSlots();

      expect(slots.size).to.equal(0);
      e.style('taxi-turn', 'auto');
      expect(slots.size).to.equal(1);
      expect(e.style('taxi-turn')).to.equal('auto');
      e.style('taxi-turn', 20);
      expect(slots.size).to.equal(0);
      e.style('taxi-turn', 'auto');
      e.remove();
      expect(slots.size).to.equal(0);
    });
  });

  describe('the track pass', function () {
    it('two overlapping fan-outs land on distinct lines, each a bus sharing one turn', function () {
      make(twoFans());

      expect(lineOf('A->a1')).to.equal(lineOf('A->a2'));
      expect(lineOf('B->b1')).to.equal(lineOf('B->b2'));
      expect(lineOf('A->a1')).to.not.equal(lineOf('B->b1'));
      // ideal routes, 10 px apart around the 50 % line
      expect(Math.abs(lineOf('A->a1') - lineOf('B->b1'))).to.equal(10);
      expect(cy.$id('A->a1').segmentPoints()).to.have.length(2);
    });

    it("the control: a '50%' turn puts both fan-outs on one line", function () {
      make(twoFans(), { 'taxi-turn': '50%' });

      expect(lineOf('A->a1')).to.equal(100);
      expect(lineOf('B->b1')).to.equal(100);
      expect(cy._store.curves.taxiAutoSlots().size).to.equal(0);
    });

    it('a lone bundle draws the 50 % line (the identity)', function () {
      make([node('a', 0, 0), node('b', 10, 200), edge('a', 'b')]);

      expect(lineOf('a->b')).to.equal(100);
    });

    it("'family' puts two sources on one trunk where per-source draws two", function () {
      var fam = () => [
        node('A', 0, 0),
        node('B', 100, 0),
        node('c', 0, 200),
        node('d', 100, 200),
        edge('A', 'c'),
        edge('A', 'd'),
        edge('B', 'c'),
        edge('B', 'd'),
      ];

      make(fam(), { 'taxi-track': 'family' });

      var lines = new Set(['A->c', 'A->d', 'B->c', 'B->d'].map(lineOf));

      expect(lines.size).to.equal(1);
      expect([...lines][0]).to.equal(100);

      make(fam());
      lines = new Set(['A->c', 'A->d', 'B->c', 'B->d'].map(lineOf));
      expect(lines.size).to.equal(2);
    });

    it('a drag that moves a source off the other run re-assigns before the next read', function () {
      make(twoFans());

      var before = [lineOf('A->a1'), lineOf('B->b1')];

      expect(before[0]).to.not.equal(before[1]);

      // B and its children move far right: the runs no longer overlap
      cy.$id('B').position({ x: 1000, y: 0 });
      cy.$id('b1').position({ x: 900, y: 200 });
      cy.$id('b2').position({ x: 1200, y: 200 });

      expect(lineOf('A->a1')).to.equal(100);
      expect(lineOf('B->b1')).to.equal(100);

      // and back
      cy.$id('B').position({ x: 100, y: 0 });
      cy.$id('b1').position({ x: 0, y: 200 });
      cy.$id('b2').position({ x: 300, y: 200 });

      expect(lineOf('A->a1')).to.not.equal(lineOf('B->b1'));
    });

    it('every auto turn in a crowded gap stays ideal (never the Z-shape)', function () {
      var elements = [];

      for (var i = 0; i < 20; i++) {
        elements.push(node(`s${i}`, i * 10, 0), node(`t${i}`, i * 10, 200));
      }

      for (i = 0; i < 20; i++) {
        elements.push(edge(`s${i}`, 't0'), edge(`s${i}`, 't19'));
      }

      make(elements);

      var lines = new Set();

      cy.edges().forEach((e) => {
        var pts = e.segmentPoints();

        expect(pts).to.have.length(2);
        expect(pts[0].y).to.equal(pts[1].y);
        // inside the band [25, 175] at both ends
        expect(pts[0].y).to.be.at.least(25);
        expect(pts[0].y).to.be.at.most(175);
        lines.add(pts[0].y);
      });

      expect(lines.size).to.equal(20);
    });

    it('the bounding box reads the same track', function () {
      make(twoFans());

      var e = cy.$id('B->b2');
      var y = lineOf('B->b2');
      var bb = e.boundingBox();

      // the run at y spans x 100..300; the box's y extent holds the line
      expect(bb.y1).to.be.at.most(y);
      expect(bb.y2).to.be.at.least(y);
      expect(bb.x2).to.be.closeTo(300, 2);
    });

    it('the pass writes the params n lane and never the blob', function () {
      make(twoFans());

      var slot = cy._store.lookup('A->a1').slot;
      var params = cy._store.curveParamsAt(slot);
      var blob = cy._store.curveBlob();

      expect(params[2]).to.be.greaterThan(0); // the px turn
      expect(blob[params[0] + 1]).to.equal(0.5); // the record keeps the default
      expect(blob[params[0] + 2]).to.equal(2); // auto mode
      // the route agrees with the lane: y = turn + source half
      expect(lineOf('A->a1')).to.equal(params[2] + 15);
    });
  });
});
