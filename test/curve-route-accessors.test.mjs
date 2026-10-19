import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

// round 12b: route-family accessors — segmentPoints, multibezier
// controlPoints, midpoint/endpoints and the exact lazy bb

describe('gpu/curve-route-accessors (12b)', function () {
  var cy;

  // default 30x30 ellipse nodes compile to circles of radius 15; on the
  // x axis the intersection frame is si=(15,0), ti=(85,0), normal (0,1)
  var makePair = (edgeStyle) =>
    cytoscape({
      elements: [
        { data: { id: 'a' }, position: { x: 0, y: 0 } },
        { data: { id: 'b' }, position: { x: 100, y: 0 } },
        { data: { id: 'e', source: 'a', target: 'b' } },
      ],
      style: { edges: edgeStyle },
    });

  describe('segmentPoints', function () {
    it('returns the derived segment points for segments edges', function () {
      cy = makePair({ 'curve-style': 'segments' }); // default d=20, w=0.5

      var pts = cy.$id('e').segmentPoints();

      expect(pts).to.have.length(1);
      expect(pts[0].x).to.be.closeTo(50, 1e-6);
      expect(pts[0].y).to.be.closeTo(20, 1e-6);
    });

    it('returns the taxi routing points (v3: taxi is a segments type)', function () {
      cy = cytoscape({
        elements: [
          { data: { id: 'a' }, position: { x: 0, y: 0 } },
          { data: { id: 'b' }, position: { x: 10, y: 200 } },
          { data: { id: 'e', source: 'a', target: 'b' } },
        ],
        style: { edges: { 'curve-style': 'taxi' } },
      });

      var pts = cy.$id('e').segmentPoints();

      // dy = 170, d = 85, y = 85 + 15 = 100
      expect(pts).to.have.length(2);
      expect(pts[0].x).to.equal(0);
      expect(pts[0].y).to.equal(100);
      expect(pts[1].x).to.equal(10);
      expect(pts[1].y).to.equal(100);
    });

    it('is undefined for straight, bezier and unbundled-bezier edges', function () {
      cy = makePair({ 'curve-style': 'unbundled-bezier' });
      expect(cy.$id('e').segmentPoints()).to.equal(undefined);

      cy = makePair({});
      expect(cy.$id('e').segmentPoints()).to.equal(undefined);
    });

    it('renderedSegmentPoints applies the viewport transform', function () {
      cy = makePair({ 'curve-style': 'segments' });
      cy.zoom(2);
      cy.pan({ x: 10, y: 20 });

      var pts = cy.$id('e').renderedSegmentPoints();

      expect(pts[0].x).to.be.closeTo(50 * 2 + 10, 1e-6);
      expect(pts[0].y).to.be.closeTo(20 * 2 + 20, 1e-6);
    });
  });

  describe('controlPoints for unbundled bezier', function () {
    it('returns the full control list', function () {
      cy = makePair({
        'curve-style': 'unbundled-bezier',
        'control-point-distances': [40, -40],
        'control-point-weights': [0.25, 0.75],
      });

      var pts = cy.$id('e').controlPoints();

      expect(pts).to.have.length(2);
      expect(pts[0].x).to.be.closeTo(32.5, 1e-6);
      expect(pts[0].y).to.be.closeTo(40, 1e-6);
      expect(pts[1].x).to.be.closeTo(67.5, 1e-6);
      expect(pts[1].y).to.be.closeTo(-40, 1e-6);
    });

    it('stays undefined for segments/taxi (they answer segmentPoints)', function () {
      cy = makePair({ 'curve-style': 'segments' });
      expect(cy.$id('e').controlPoints()).to.equal(undefined);

      cy = makePair({ 'curve-style': 'taxi' });
      expect(cy.$id('e').controlPoints()).to.equal(undefined);
    });
  });

  describe('midpoint and endpoints', function () {
    it('midpoint of a single-point segments edge is the segment point (v3 odd rule)', function () {
      cy = makePair({ 'curve-style': 'segments' });

      var m = cy.$id('e').midpoint();

      expect(m.x).to.be.closeTo(50, 1e-6);
      expect(m.y).to.be.closeTo(20, 1e-6);
    });

    it('midpoint of an even multibezier is the inserted midpoint', function () {
      cy = makePair({
        'curve-style': 'unbundled-bezier',
        'control-point-distances': [40, -40],
        'control-point-weights': [0.25, 0.75],
      });

      var m = cy.$id('e').midpoint();

      expect(m.x).to.be.closeTo(50, 1e-6);
      expect(m.y).to.be.closeTo(0, 1e-6);
    });

    it('endpoints sit on the node boundary toward the first/last route point', function () {
      cy = makePair({ 'curve-style': 'segments' });

      var s = cy.$id('e').sourceEndpoint();
      var t = cy.$id('e').targetEndpoint();

      // on the r=15 circle toward (50, 20)
      expect(Math.hypot(s.x, s.y)).to.be.closeTo(15, 1e-6);
      expect(s.y).to.be.greaterThan(0);
      expect(Math.hypot(t.x - 100, t.y)).to.be.closeTo(15, 1e-6);
    });
  });

  describe('exact lazy bounding box', function () {
    it('the edge bb follows the drawn route polyline', function () {
      cy = makePair({ 'curve-style': 'segments' });

      var bb = cy.$id('e').boundingBox();

      // the polyline peaks exactly at the segment point (a piece boundary)
      expect(bb.y2).to.be.closeTo(20, 1e-6);
      expect(bb.y1).to.be.closeTo(5.57, 0.02); // the boundary endpoints' y
      expect(bb.x1).to.be.closeTo(13.93, 0.02);
      expect(bb.x2).to.be.closeTo(86.07, 0.02);
    });

    it('taxi bbs cover the full route', function () {
      cy = cytoscape({
        elements: [
          { data: { id: 'a' }, position: { x: 0, y: 0 } },
          { data: { id: 'b' }, position: { x: 10, y: 200 } },
          { data: { id: 'e', source: 'a', target: 'b' } },
        ],
        style: { edges: { 'curve-style': 'taxi' } },
      });

      var bb = cy.$id('e').boundingBox();

      expect(bb.x1).to.be.closeTo(0, 1e-6);
      expect(bb.x2).to.be.closeTo(10, 1e-6);
      expect(bb.y1).to.be.closeTo(15, 1e-6); // launch boundary
      expect(bb.y2).to.be.closeTo(185, 1e-6);
    });

    it('the bb memo invalidates on position writes', function () {
      cy = makePair({ 'curve-style': 'segments' });

      var before = cy.$id('e').boundingBox();

      cy.$id('b').position({ x: 200, y: 0 });

      var after = cy.$id('e').boundingBox();

      expect(after.x2).to.be.greaterThan(before.x2);
    });
  });

  /*
   * Round 55: axis-aligned round-taxi and round-segments used to answer
   * `{x1: null, y1: null, x2: null, y2: null}`.
   *
   * `evalTaxi` emits two *coincident* interior points when the endpoints
   * share an axis — a faithful port of v3, which does the same — and
   * `computeCorner` then normalized a zero-length leg, so NaN reached
   * every strip vertex, the bounding box and the hit test.  The edge was
   * invisible on the GPU (a NaN clip position is dropped), unpickable,
   * and poisoned any bound that included it.
   *
   * A grid layout is what produces this, so it was not a corner case: it
   * is what a maintainer saw on `debug/?network=v3-default`, four of
   * whose edges are round-taxi.
   *
   * These specs are the deterministic pin.  The browser tier finds the
   * same defect (`finite geometry: taxi` in playwright-tests/routing.spec.js),
   * but a guard reachable only from the browser suite is invisible to the
   * Node tier and to the throw gate.
   *
   * Control, run with the guard removed: **only the bounding-box spec of
   * the three fails.**  The midpoint and hit-test specs pass either way,
   * because a NaN *corner* does not reach the midpoint (which comes from
   * the route points, not the arcs) and `elementsInBox` answers from the
   * conservative store bound rather than the exact polyline on this
   * path.  They are kept deliberately, as contract breadth against a
   * future regression that does reach them — but they are not what makes
   * this block discriminate, and a reader should not assume they are.
   */
  describe('degenerate rounded routes stay finite (round 55)', function () {
    var aligned = (style, dx, dy) =>
      cytoscape({
        elements: [
          { data: { id: 'a' }, position: { x: 0, y: 0 } },
          { data: { id: 'b' }, position: { x: dx, y: dy } },
          { data: { id: 'e', source: 'a', target: 'b' } },
        ],
        style: { edges: style },
      });

    var finiteBox = (bb) =>
      ['x1', 'y1', 'x2', 'y2', 'w', 'h'].every((k) => Number.isFinite(bb[k]));

    var cases = [
      ['round-taxi, vertical', { 'curve-style': 'round-taxi' }, 0, 160],
      ['round-taxi, horizontal', { 'curve-style': 'round-taxi' }, 200, 0],
      [
        'round-segments with coincident points',
        {
          'curve-style': 'round-segments',
          'segment-distances': [20, 20],
          'segment-weights': [0.5, 0.5],
        },
        200,
        0,
      ],
    ];

    cases.forEach(function (entry) {
      var label = entry[0];
      var style = entry[1];
      var dx = entry[2];
      var dy = entry[3];

      it(`${label}: the bounding box is finite`, function () {
        cy = aligned(style, dx, dy);

        var bb = cy.$id('e').boundingBox();

        expect(finiteBox(bb), `bb was ${JSON.stringify(bb)}`).to.equal(true);

        // and it actually spans the edge rather than collapsing
        expect(bb.w + bb.h).to.be.greaterThan(100);
      });

      it(`${label}: the midpoint and endpoints are finite`, function () {
        cy = aligned(style, dx, dy);

        var e = cy.$id('e');

        for (var p of [e.midpoint(), e.sourceEndpoint(), e.targetEndpoint()]) {
          expect(
            Number.isFinite(p.x) && Number.isFinite(p.y),
            `got ${JSON.stringify(p)}`,
          ).to.equal(true);
        }
      });

      it(`${label}: the WHOLE GRAPH's bounding box stays finite`, function () {
        cy = aligned(style, dx, dy);

        var bb = cy.elements().boundingBox();

        // The severe half of this defect, and the one measured last:
        // a single degenerate edge poisoned the *graph* bound, not just
        // its own, because the min/max fold never took a comparable
        // value.  `cy.fit()` reads this, so one round-taxi edge between
        // two nodes sharing a row broke framing for the entire graph.
        expect(finiteBox(bb), `graph bb was ${JSON.stringify(bb)}`).to.equal(
          true,
        );
      });

      it(`${label}: it is still hit-testable`, function () {
        cy = aligned(style, dx, dy);

        var bb = cy.$id('e').boundingBox();

        // a box over the whole edge must find it — with NaN geometry the
        // comparison silently answered false and the edge vanished from
        // box selection
        var hit = cy.elementsInBox(bb.x1 - 5, bb.y1 - 5, bb.x2 + 5, bb.y2 + 5);

        expect(hit.filter((el) => el.isEdge()).length).to.equal(1);
      });
    });
  });
});
