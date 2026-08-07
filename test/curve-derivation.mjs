import { expect } from 'chai';
import cytoscape from '../src/index.mjs';
import {
  CURVE_BEZIER,
  CURVE_LOOP,
  CURVE_MULTI,
  CURVE_SEGMENTS,
  CURVE_STRAIGHT,
  CURVE_TAXI,
  FLAG_CURVED,
  FLAG_CURVED_BOX,
} from '../src/contract.mjs';

// round 12b: the unbundled-bezier / segments / taxi style props and
// their derivation into blob-backed curve params

describe('gpu/curve-derivation (12b families)', function () {
  var cy;

  var refOf = (id) => cy._store.lookup(id);
  var paramsOf = (id) => cy._store.curveParamsAt(refOf(id).slot);
  var kindOf = (id) => paramsOf(id)[3];
  var flagOf = (id, flag) => {
    var ref = refOf(id);

    cy._store.curveParamsAt(ref.slot); // flush pending derivation

    return (cy._store.flags('edges', ref.slot) & flag) !== 0;
  };
  var recordOf = (id) => {
    var p = paramsOf(id);
    var blob = cy._store.curveBlob();

    return { offset: p[0], dev: p[1], n: p[2], kind: p[3], blob };
  };
  var blobSlice = (id, len) => {
    var r = recordOf(id);

    return Array.from(r.blob.subarray(r.offset, r.offset + len));
  };

  var makeCy = (elements, edgeStyle) =>
    cytoscape({
      elements,
      style: edgeStyle == null ? undefined : { edges: edgeStyle },
    });

  var pairWith = (edgeStyle) =>
    makeCy(
      [
        { data: { id: 'a' } },
        { data: { id: 'b' } },
        { data: { id: 'e', source: 'a', target: 'b' } },
      ],
      edgeStyle,
    );

  describe('unbundled bezier', function () {
    it('derives a blob-backed multi record from distances/weights', function () {
      cy = pairWith({
        'curve-style': 'unbundled-bezier',
        'control-point-distances': [40, -40],
        'control-point-weights': [0.25, 0.75],
      });

      var r = recordOf('e');

      expect(r.kind).to.equal(CURVE_MULTI);
      expect(r.n).to.equal(2);
      expect(r.dev).to.equal(40); // max |d|
      expect(blobSlice('e', 5)).to.deep.equal([0, 40, 0.25, -40, 0.75]);
      expect(flagOf('e', FLAG_CURVED)).to.be.true;
      expect(flagOf('e', FLAG_CURVED_BOX)).to.be.false;
    });

    it('accepts v3 string-sheet list forms', function () {
      cy = pairWith({
        'curve-style': 'unbundled-bezier',
        'control-point-distances': '40 -40',
        'control-point-weights': '0.25 0.75',
      });

      expect(recordOf('e').n).to.equal(2);
    });

    it('v3 min rule: the shorter of distances/weights bounds the count', function () {
      cy = pairWith({
        'curve-style': 'unbundled-bezier',
        'control-point-distances': [40, -40, 40],
        // default weights [0.5] => n = 1
      });

      expect(recordOf('e').n).to.equal(1);
    });

    it('defaults to one control at the step size when distances are unset', function () {
      cy = pairWith({
        'curve-style': 'unbundled-bezier',
        'control-point-step-size': 55,
      });

      var r = recordOf('e');

      expect(r.kind).to.equal(CURVE_MULTI);
      expect(r.n).to.equal(1);
      expect(blobSlice('e', 3)).to.deep.equal([0, 55, 0.5]);
    });

    it('weights outside [0, 1] mark the edge box-bounded', function () {
      cy = pairWith({
        'curve-style': 'unbundled-bezier',
        'control-point-distances': [40],
        'control-point-weights': [1.5],
      });

      expect(flagOf('e', FLAG_CURVED_BOX)).to.be.true;
    });

    it('empty lists derive straight', function () {
      cy = pairWith({
        'curve-style': 'unbundled-bezier',
        'control-point-distances': [],
        'control-point-weights': [],
      });

      expect(kindOf('e')).to.equal(CURVE_STRAIGHT);
      expect(flagOf('e', FLAG_CURVED)).to.be.false;
    });

    it('caps the control count at the strip limit', function () {
      var dists = new Array(12).fill(10);
      var weights = new Array(12).fill(0.5);

      cy = pairWith({
        'curve-style': 'unbundled-bezier',
        'control-point-distances': dists,
        'control-point-weights': weights,
      });

      expect(recordOf('e').n).to.equal(8); // MAX_MULTI_CTRL
    });
  });

  describe('segments', function () {
    it('derives the v3 default single segment point', function () {
      cy = pairWith({ 'curve-style': 'segments' });

      var r = recordOf('e');

      expect(r.kind).to.equal(CURVE_SEGMENTS);
      expect(r.n).to.equal(1);
      expect(r.dev).to.equal(20);
      // [edgeDistances, round, d, w, radius, arcMode]
      expect(blobSlice('e', 6)).to.deep.equal([0, 0, 20, 0.5, 15, 1]);
    });

    it('round-segments sets the round flag', function () {
      cy = pairWith({ 'curve-style': 'round-segments', 'segment-radii': 8 });

      expect(blobSlice('e', 6)).to.deep.equal([0, 1, 20, 0.5, 8, 1]);
    });

    it('repeats the last radius and radius-type for missing entries (v3 rule)', function () {
      cy = pairWith({
        'curve-style': 'round-segments',
        'segment-distances': [20, -20, 20],
        'segment-weights': [0.25, 0.5, 0.75],
        'segment-radii': [4],
        'radius-type': 'influence-radius',
      });

      // per point: d, w, r, arc
      expect(blobSlice('e', 14)).to.deep.equal([
        0, 1, 20, 0.25, 4, 0, -20, 0.5, 4, 0, 20, 0.75, 4, 0,
      ]);
    });

    it('edge-distances node-position stores in the record', function () {
      cy = pairWith({
        'curve-style': 'segments',
        'edge-distances': 'node-position',
      });

      expect(blobSlice('e', 2)[0]).to.equal(1);
    });
  });

  describe('taxi', function () {
    it('derives the fixed record and the box flag', function () {
      cy = pairWith({ 'curve-style': 'taxi' });

      var r = recordOf('e');

      expect(r.kind).to.equal(CURVE_TAXI);
      // [dir(auto), turn(0.5), percent, minD, edgeDistances, round, radius, arc]
      expect(blobSlice('e', 8)).to.deep.equal([0, 0.5, 1, 10, 0, 0, 15, 1]);
      expect(flagOf('e', FLAG_CURVED_BOX)).to.be.true;
    });

    it('px and negative turns store as px', function () {
      cy = pairWith({ 'curve-style': 'taxi', 'taxi-turn': -32 });

      expect(blobSlice('e', 3)).to.deep.equal([0, -32, 0]);
    });

    it('round-taxi stores the round flag and radius', function () {
      cy = pairWith({
        'curve-style': 'round-taxi',
        'taxi-radius': 9,
        'taxi-direction': 'downward',
      });

      expect(blobSlice('e', 8)).to.deep.equal([4, 0.5, 1, 10, 0, 1, 9, 1]);
    });
  });

  describe('interaction with bezier bundles', function () {
    it('a blob-family member does not join the bundle nor lose its params', function () {
      cy = makeCy(
        [
          { data: { id: 'a' } },
          { data: { id: 'b' } },
          { data: { id: 'e0', source: 'a', target: 'b', kind: 'bez' } },
          { data: { id: 'e1', source: 'a', target: 'b', kind: 'bez' } },
          { data: { id: 'e2', source: 'a', target: 'b', kind: 'seg' } },
        ],
        {
          'curve-style': {
            case: [{ when: { data: 'kind', eq: 'seg' }, then: 'segments' }],
            else: 'bezier',
          },
        },
      );

      // the two bezier members bundle as a 2-bundle (both curved)...
      expect(kindOf('e0')).to.equal(CURVE_BEZIER);
      expect(kindOf('e1')).to.equal(CURVE_BEZIER);
      // ...and the segments member keeps its own derivation
      expect(kindOf('e2')).to.equal(CURVE_SEGMENTS);

      // removing a bezier member re-derives the pair without touching e2
      cy.$id('e1').remove();
      expect(kindOf('e0')).to.equal(CURVE_STRAIGHT); // lone bezier is straight
      expect(kindOf('e2')).to.equal(CURVE_SEGMENTS);
    });
  });

  describe('loops under 12b styles', function () {
    it('an unbundled-bezier loop takes control-point-distances[0] as its distance', function () {
      cy = makeCy(
        [
          { data: { id: 'n' } },
          { data: { id: 'loop', source: 'n', target: 'n' } },
        ],
        {
          'curve-style': 'unbundled-bezier',
          'control-point-distances': [50],
        },
      );

      var p = paramsOf('loop');

      expect(p[3]).to.equal(CURVE_LOOP);
      expect(p[2]).to.be.closeTo(1.4 * 50, 1e-6); // loopRadius(dist, j=0)
    });

    it('segments-styled loops still render as loops (12a deviation extended)', function () {
      cy = makeCy(
        [
          { data: { id: 'n' } },
          { data: { id: 'loop', source: 'n', target: 'n' } },
        ],
        { 'curve-style': 'segments' },
      );

      expect(kindOf('loop')).to.equal(CURVE_LOOP);
    });
  });

  describe('restyle transitions', function () {
    it('switching a taxi edge to straight clears kind, flags and blob use', function () {
      cy = pairWith({ 'curve-style': 'taxi' });
      expect(kindOf('e')).to.equal(CURVE_TAXI);

      cy.style({ edges: { 'curve-style': 'straight' } });

      expect(kindOf('e')).to.equal(CURVE_STRAIGHT);
      expect(flagOf('e', FLAG_CURVED)).to.be.false;
      expect(flagOf('e', FLAG_CURVED_BOX)).to.be.false;
    });

    it('switching families rewrites the record', function () {
      cy = pairWith({ 'curve-style': 'segments' });
      expect(kindOf('e')).to.equal(CURVE_SEGMENTS);

      cy.style({ edges: { 'curve-style': 'taxi' } });
      expect(kindOf('e')).to.equal(CURVE_TAXI);
    });
  });

  describe('validation', function () {
    it('rejects 12b curve props on the nodes group', function () {
      expect(() => makeCy([], undefined)).to.not.throw();
      expect(() =>
        cytoscape({
          style: { nodes: { 'taxi-direction': 'auto' } },
        }),
      ).to.throw(/edge style property/);
    });

    it('accepts edge-distances: endpoints (12c; falls back sans manual endpoints)', function () {
      cy = pairWith({
        'curve-style': 'segments',
        'edge-distances': 'endpoints',
      });

      // stored truth keeps the styled keyword even when derivation
      // falls back to the intersection frame (no manual endpoints)
      expect(cy.$id('e').style('edge-distances')).to.equal('endpoints');
    });

    it('rejects unknown taxi directions and radius types', function () {
      expect(() => pairWith({ 'taxi-direction': 'sideways' })).to.throw(
        /taxi-direction/,
      );
      expect(() => pairWith({ 'radius-type': 'bogus' })).to.throw(
        /radius-type/,
      );
    });

    it('rejects mappers on list props', function () {
      expect(() =>
        pairWith({
          'curve-style': 'segments',
          'segment-distances': { data: 'd' },
        }),
      ).to.throw(/does not support mappers/);
    });
  });

  describe('readback (stored truth)', function () {
    it('reads back the 12b props', function () {
      cy = pairWith({
        'curve-style': 'round-segments',
        'segment-distances': [20, -20],
        'segment-weights': [0.25, 0.75],
        'segment-radii': [4, 6],
        'radius-type': ['arc-radius', 'influence-radius'],
        'edge-distances': 'node-position',
      });

      var e = cy.$id('e');

      expect(e.style('curve-style')).to.equal('round-segments');
      expect(e.style('segment-distances')).to.equal('20 -20');
      expect(e.style('segment-weights')).to.equal('0.25 0.75');
      expect(e.style('segment-radii')).to.equal('4 6');
      expect(e.style('radius-type')).to.equal('arc-radius influence-radius');
      expect(e.style('edge-distances')).to.equal('node-position');
    });

    it('reads back taxi props incl. the percent form', function () {
      cy = pairWith({ 'curve-style': 'taxi', 'taxi-direction': 'downward' });

      var e = cy.$id('e');

      expect(e.style('taxi-direction')).to.equal('downward');
      expect(e.style('taxi-turn')).to.equal('50%');
      expect(e.style('taxi-turn-min-distance')).to.equal(10);
      expect(e.style('taxi-radius')).to.equal(15);

      cy.style({ edges: { 'curve-style': 'taxi', 'taxi-turn': -32 } });
      expect(cy.$id('e').style('taxi-turn')).to.equal(-32);
    });

    it('scalar/enum 12b props take mappers', function () {
      cy = makeCy(
        [
          { data: { id: 'a' } },
          { data: { id: 'b' } },
          { data: { id: 'e', source: 'a', target: 'b', dir: 'upward' } },
        ],
        {
          'curve-style': 'taxi',
          'taxi-direction': { data: 'dir' },
        },
      );

      expect(blobSlice('e', 1)[0]).to.equal(3); // TAXI_UPWARD
    });
  });
});
