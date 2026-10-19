import { expect } from 'chai';
import cytoscape from '../src/index.mjs';
import {
  CURVE_BEZIER,
  CURVE_HAS_ENDPT,
  CURVE_HAYSTACK,
  CURVE_MULTI,
  CURVE_TAXI,
  CURVE_TRIANGLE,
  FLAG_CURVED,
  FLAG_CURVED_BOX,
} from '../src/contract.mjs';
import {
  EDGE_DIST_INTERSECTION,
  EDGE_DIST_ENDPOINTS,
  ENDPT_ANGLE,
  ENDPT_DEFAULT,
  ENDPT_POINT,
} from '../src/curve-geometry.mjs';

// round 12c: haystack / straight-triangle styles and the manual
// endpoint props, derived into straight-stream params or blob records

describe('gpu/curve-12c: haystack, triangle and endpoint derivation', function () {
  var cy;

  var refOf = (id) => cy._store.lookup(id);
  var paramsOf = (id) => cy._store.curveParamsAt(refOf(id).slot);
  var kindOf = (id) => paramsOf(id)[3];
  var flagOf = (id, flag) => {
    var ref = refOf(id);

    cy._store.curveParamsAt(ref.slot); // flush pending derivation

    return (cy._store.flags('edges', ref.slot) & flag) !== 0;
  };
  var blobSlice = (id, len) => {
    var p = paramsOf(id);
    var blob = cy._store.curveBlob();

    return Array.from(blob.subarray(p[0], p[0] + len));
  };

  var makeCy = (elements, edgeStyle) =>
    cytoscape({
      elements,
      style: edgeStyle == null ? undefined : { edges: edgeStyle },
    });

  var pairWith = (edgeStyle) =>
    makeCy(
      [
        { data: { id: 'a' }, position: { x: 0, y: 0 } },
        { data: { id: 'b' }, position: { x: 100, y: 0 } },
        { data: { id: 'e', source: 'a', target: 'b' } },
      ],
      edgeStyle,
    );

  describe('haystack', function () {
    it('derives a straight-stream CURVE_HAYSTACK kind (no FLAG_CURVED)', function () {
      cy = pairWith({ 'curve-style': 'haystack', 'haystack-radius': 0.75 });

      expect(kindOf('e')).to.equal(CURVE_HAYSTACK);
      expect(paramsOf('e')[2]).to.be.closeTo(0.75, 1e-6);
      expect(flagOf('e', FLAG_CURVED)).to.equal(false);
      expect(flagOf('e', FLAG_CURVED_BOX)).to.equal(false);
    });

    it('angles are deterministic across instances (id-hash seeded)', function () {
      cy = pairWith({ 'curve-style': 'haystack', 'haystack-radius': 1 });

      var p1 = paramsOf('e');
      var cy2 = pairWith({ 'curve-style': 'haystack', 'haystack-radius': 1 });
      var other = cy;

      cy = cy2;

      var p2 = paramsOf('e');

      cy = other;
      expect(p1[0]).to.equal(p2[0]);
      expect(p1[1]).to.equal(p2[1]);
      expect(p1[0]).to.not.equal(p1[1]); // the two ends differ
      cy2.destroy();
    });

    it('haystackPointsAt computes the offset endpoints', function () {
      cy = pairWith({ 'curve-style': 'haystack', 'haystack-radius': 0.5 });

      var pts = cy._store.haystackPointsAt(refOf('e').slot);
      var p = paramsOf('e');

      // default node size 30 → outer half 15; offset = cos/sin · 15 · 0.5
      expect(pts.sx).to.be.closeTo(0 + Math.cos(p[0]) * 15 * 0.5, 1e-4);
      expect(pts.sy).to.be.closeTo(0 + Math.sin(p[0]) * 15 * 0.5, 1e-4);
      expect(pts.tx).to.be.closeTo(100 + Math.cos(p[1]) * 15 * 0.5, 1e-4);
    });

    it('radius 0 (the default) pins endpoints at the centers', function () {
      cy = pairWith({ 'curve-style': 'haystack' });

      var pts = cy._store.haystackPointsAt(refOf('e').slot);

      expect(pts.sx).to.equal(0);
      expect(pts.sy).to.equal(0);
      expect(pts.tx).to.equal(100);
    });

    it('suppresses arrows (stored-truth reads none — a recorded deviation)', function () {
      cy = pairWith({
        'curve-style': 'haystack',
        'target-arrow-shape': 'triangle',
        'target-arrow-color': '#f00',
      });

      expect(cy.$id('e').style('target-arrow-shape')).to.equal('none');
    });

    it('reads back curve-style and haystack-radius from the styled record', function () {
      cy = pairWith({ 'curve-style': 'haystack', 'haystack-radius': 0.3 });

      expect(cy.$id('e').style('curve-style')).to.equal('haystack');
      expect(cy.$id('e').style('haystack-radius')).to.be.closeTo(0.3, 1e-6);
    });

    it('throws on out-of-range haystack-radius', function () {
      expect(() =>
        pairWith({ 'curve-style': 'haystack', 'haystack-radius': 1.5 }),
      ).to.throw();
    });

    it('box selection tests the haystack offset points', function () {
      cy = pairWith({ 'curve-style': 'haystack', 'haystack-radius': 1 });

      var pts = cy._store.haystackPointsAt(refOf('e').slot);
      // a box containing both offset points selects the edge...
      var inBox = cy.elementsInBox(
        Math.min(pts.sx, pts.tx) - 1,
        Math.min(pts.sy, pts.ty) - 1,
        Math.max(pts.sx, pts.tx) + 1,
        Math.max(pts.sy, pts.ty) + 1,
      );

      expect(inBox.filter((e) => e.isEdge()).length).to.equal(1);

      // ...but a box containing only the node *centers* need not: shrink
      // to exclude whichever offset point sticks out furthest
      var half = 0.1;
      var tight = cy.elementsInBox(-half, -half, 100 + half, half);
      var containsBoth = (x, y) =>
        x >= -half && x <= 100 + half && y >= -half && y <= half;
      var expected =
        containsBoth(pts.sx, pts.sy) && containsBoth(pts.tx, pts.ty) ? 1 : 0;

      expect(tight.filter((e) => e.isEdge()).length).to.equal(expected);
    });
  });

  describe('straight-triangle', function () {
    it('derives the CURVE_TRIANGLE straight-stream kind', function () {
      cy = pairWith({ 'curve-style': 'straight-triangle' });

      expect(kindOf('e')).to.equal(CURVE_TRIANGLE);
      expect(flagOf('e', FLAG_CURVED)).to.equal(false);
      expect(cy.$id('e').style('curve-style')).to.equal('straight-triangle');
    });
  });

  describe('manual endpoints', function () {
    it('a straight edge with endpoints derives the MULTI n=0 chord record', function () {
      cy = pairWith({
        'source-endpoint': '10 -5',
        'target-distance-from-node': 4,
      });

      expect(kindOf('e')).to.equal(CURVE_MULTI + CURVE_HAS_ENDPT);
      expect(paramsOf('e')[2]).to.equal(0); // n = 0
      expect(flagOf('e', FLAG_CURVED)).to.equal(true);

      var block = blobSlice('e', 11);

      expect(block[0]).to.equal(ENDPT_POINT);
      expect(block[1]).to.equal(10);
      expect(block[2]).to.equal(-5);
      expect(block[5]).to.equal(ENDPT_DEFAULT);
      expect(block[9]).to.equal(4); // tgtDist
      expect(block[10]).to.equal(EDGE_DIST_INTERSECTION);
    });

    it('px point offsets fold into the header deviation', function () {
      cy = pairWith({ 'source-endpoint': '30 40' }); // hypot = 50

      expect(paramsOf('e')[1]).to.be.closeTo(50, 1e-4);
    });

    it('pct endpoints past the node half mark the edge box-bounded', function () {
      cy = pairWith({ 'source-endpoint': '100% 0%' }); // 2·|1.0| = 2 > 1

      expect(flagOf('e', FLAG_CURVED_BOX)).to.equal(true);

      var cy2 = pairWith({ 'source-endpoint': '25% 0%' }); // 0.5 ≤ 1
      var keep = cy;

      cy = cy2;
      expect(flagOf('e', FLAG_CURVED_BOX)).to.equal(false);
      cy = keep;
      cy2.destroy();
    });

    it('a bundled bezier with endpoints promotes to MULTI n=1 per member', function () {
      cy = makeCy(
        [
          { data: { id: 'a' }, position: { x: 0, y: 0 } },
          { data: { id: 'b' }, position: { x: 100, y: 0 } },
          { data: { id: 'e1', source: 'a', target: 'b' } },
          { data: { id: 'e2', source: 'a', target: 'b' } },
        ],
        { 'curve-style': 'bezier', 'source-endpoint': 'inside-to-node' },
      );

      expect(kindOf('e1')).to.equal(CURVE_MULTI + CURVE_HAS_ENDPT);
      expect(kindOf('e2')).to.equal(CURVE_MULTI + CURVE_HAS_ENDPT);
      expect(paramsOf('e1')[2]).to.equal(1); // n = 1

      // the promoted records carry the ±step/2 stagger as their d
      var d1 = blobSlice('e1', 13)[11];
      var d2 = blobSlice('e2', 13)[11];

      expect(Math.abs(d1)).to.be.closeTo(20, 1e-4);
      expect(d1).to.be.closeTo(-d2, 1e-4);
    });

    it('a lone bezier with endpoints stays a straight chord (v3 bundle rule)', function () {
      cy = pairWith({ 'curve-style': 'bezier', 'source-endpoint': '0 10' });

      expect(kindOf('e')).to.equal(CURVE_MULTI + CURVE_HAS_ENDPT);
      expect(paramsOf('e')[2]).to.equal(0); // n = 0: renders as the chord
    });

    it('taxi keeps distances but drops manual endpoint modes (v3 override)', function () {
      cy = pairWith({
        'curve-style': 'taxi',
        'source-endpoint': '10 10',
        'source-distance-from-node': 6,
      });

      expect(kindOf('e')).to.equal(CURVE_TAXI + CURVE_HAS_ENDPT);

      var block = blobSlice('e', 10);

      expect(block[0]).to.equal(ENDPT_DEFAULT); // mode forced default
      expect(block[1]).to.equal(0);
      expect(block[4]).to.equal(6); // ...but the distance stays
    });

    it('a taxi with only endpoint modes (no distances) stays unflagged', function () {
      cy = pairWith({ 'curve-style': 'taxi', 'source-endpoint': '10 10' });

      expect(kindOf('e')).to.equal(CURVE_TAXI);
    });

    it('edge-distances: endpoints holds only with both ends manual', function () {
      cy = pairWith({
        'curve-style': 'unbundled-bezier',
        'control-point-distances': [20],
        'edge-distances': 'endpoints',
        'source-endpoint': '0 10',
        'target-endpoint': '90deg',
      });

      expect(blobSlice('e', 11)[10]).to.equal(EDGE_DIST_ENDPOINTS);

      // without manual endpoints: falls back to intersection (v3 warns)
      var cy2 = pairWith({
        'curve-style': 'unbundled-bezier',
        'control-point-distances': [20],
        'edge-distances': 'endpoints',
      });
      var keep = cy;

      cy = cy2;
      expect(kindOf('e')).to.equal(CURVE_MULTI); // no block at all
      expect(blobSlice('e', 1)[0]).to.equal(EDGE_DIST_INTERSECTION);
      cy = keep;
      cy2.destroy();
    });

    it('angle endpoints parse deg/rad strings and plain radians', function () {
      cy = pairWith({ 'source-endpoint': '90deg' });

      var block = blobSlice('e', 10);

      expect(block[0]).to.equal(ENDPT_ANGLE);
      // effective angle = π/2 − π/2 = 0 (12-o'clock start folded in)
      expect(block[1]).to.be.closeTo(0, 1e-6);
    });

    it("the '-or-label' keywords throw (no label bb in v4)", function () {
      expect(() =>
        pairWith({ 'source-endpoint': 'outside-to-node-or-label' }),
      ).to.throw(/label/);
    });

    // round 30.1: the point form's per-component guard.  The keyword
    // path above was pinned in 12c; the two-part point path validates
    // each component against ENDPT_COMPONENT and that throw had never
    // fired in the suite, so '10 left' was unmeasured.
    it('a malformed component of the point form throws', function () {
      expect(() => pairWith({ 'source-endpoint': '10 left' })).to.throw(
        /'left' is not a valid source-endpoint component/,
      );
      expect(() => pairWith({ 'target-endpoint': ['5em', 0] })).to.throw(
        /'5em' is not a valid target-endpoint component/,
      );

      // control: the units the component regex does accept
      cy = pairWith({
        'source-endpoint': '10px -5',
        'target-endpoint': ['25%', '0%'],
      });

      expect(cy.$id('e').style('target-endpoint')).to.equal('25% 0%');
    });

    it('endpoint props read back canonically from the styled record', function () {
      cy = pairWith({
        'source-endpoint': '50% -25%',
        'target-endpoint': 'inside-to-node',
        'source-distance-from-node': 3,
      });

      var e = cy.$id('e');

      expect(e.style('source-endpoint')).to.equal('50% -25%');
      expect(e.style('target-endpoint')).to.equal('inside-to-node');
      expect(e.style('source-distance-from-node')).to.equal(3);
      expect(e.style('target-distance-from-node')).to.equal(0);
    });

    it('restyling the endpoints away resets to plain straight params', function () {
      cy = pairWith({ 'source-endpoint': '10 0' });

      expect(kindOf('e')).to.equal(CURVE_MULTI + CURVE_HAS_ENDPT);

      cy.style({ edges: {} }); // defaults: no endpoints

      expect(kindOf('e')).to.equal(0); // CURVE_STRAIGHT
      expect(flagOf('e', FLAG_CURVED)).to.equal(false);
    });
  });

  afterEach(function () {
    if (cy != null) {
      cy.destroy();
      cy = null;
    }
  });
});
