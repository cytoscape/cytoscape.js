import { expect } from 'chai';
import cytoscape from '../src/index.mjs';
import {
  CURVE_BEZIER,
  CURVE_LOOP,
  CURVE_STRAIGHT,
  FLAG_CURVED,
} from '../src/contract.mjs';

// round 12a: the curve-style props, the bundle membership index and the
// derived edge.curveParams column (v3's stagger/loop math; see
// src/store/curve-index.mts)

describe('gpu/curve-index', function () {
  var cy;

  var paramsOf = (id) => cy._store.curveParamsAt(cy._store.lookup(id).slot);
  var kindOf = (id) => paramsOf(id)[3];
  var dOf = (id) => paramsOf(id)[0];
  var curvedFlagOf = (id) => {
    var ref = cy._store.lookup(id);

    cy._store.curveParamsAt(ref.slot); // flush pending derivation

    return (cy._store.flags('edges', ref.slot) & FLAG_CURVED) !== 0;
  };

  var makeCy = (elements, edgeStyle) =>
    cytoscape({
      elements,
      style: edgeStyle == null ? undefined : { edges: edgeStyle },
    });

  var pairGraph = (n) => {
    var elements = [{ data: { id: 'a' } }, { data: { id: 'b' } }];

    for (var i = 0; i < n; i++) {
      elements.push({ data: { id: 'e' + i, source: 'a', target: 'b' } });
    }

    return elements;
  };

  describe('defaults (curve-style: straight)', function () {
    it('derives straight params and no FLAG_CURVED', function () {
      cy = makeCy(pairGraph(2));

      expect(kindOf('e0')).to.equal(CURVE_STRAIGHT);
      expect(kindOf('e1')).to.equal(CURVE_STRAIGHT);
      expect(curvedFlagOf('e0')).to.equal(false);
    });

    it('reads back curve-style straight with v3 numeric defaults', function () {
      cy = makeCy(pairGraph(1));

      var e = cy.$id('e0');

      expect(e.style('curve-style')).to.equal('straight');
      expect(e.style('control-point-step-size')).to.equal(40);
      expect(e.style('control-point-weight')).to.equal(0.5);
      expect(e.style('loop-direction')).to.be.closeTo(-Math.PI / 4, 1e-6);
      expect(e.style('loop-sweep')).to.be.closeTo(-Math.PI / 2, 1e-6);
    });
  });

  describe('bundled bezier derivation', function () {
    it('keeps a lone bezier edge straight (the v3 rule) but reads back bezier', function () {
      cy = makeCy(pairGraph(1), { 'curve-style': 'bezier' });

      expect(kindOf('e0')).to.equal(CURVE_STRAIGHT);
      expect(curvedFlagOf('e0')).to.equal(false);
      expect(cy.$id('e0').style('curve-style')).to.equal('bezier');
    });

    it('staggers a 2-bundle at -20/+20 with the default step', function () {
      cy = makeCy(pairGraph(2), { 'curve-style': 'bezier' });

      expect(kindOf('e0')).to.equal(CURVE_BEZIER);
      expect(kindOf('e1')).to.equal(CURVE_BEZIER);
      expect(dOf('e0')).to.equal(-20);
      expect(dOf('e1')).to.equal(20);
      expect(paramsOf('e0')[1]).to.equal(0.5); // weight
      expect(curvedFlagOf('e0')).to.equal(true);
    });

    it('makes the middle edge of an odd bundle straight', function () {
      cy = makeCy(pairGraph(3), { 'curve-style': 'bezier' });

      expect(dOf('e0')).to.equal(-40);
      expect(kindOf('e1')).to.equal(CURVE_STRAIGHT);
      expect(dOf('e2')).to.equal(40);
    });

    it('flips the sign for an antiparallel member (same world side pair-wise)', function () {
      // frames of antiparallel edges are mirrored, so equal signed d
      // means opposite world sides — the v3 fan
      cy = makeCy(
        [
          { data: { id: 'a' } },
          { data: { id: 'b' } },
          { data: { id: 'e0', source: 'a', target: 'b' } },
          { data: { id: 'e1', source: 'b', target: 'a' } },
        ],
        { 'curve-style': 'bezier' },
      );

      expect(dOf('e0')).to.equal(-20);
      expect(dOf('e1')).to.equal(-20);
    });

    it('uses the per-edge step size', function () {
      cy = makeCy(pairGraph(2), {
        'curve-style': 'bezier',
        'control-point-step-size': 60,
      });

      expect(dOf('e0')).to.equal(-30);
      expect(dOf('e1')).to.equal(30);
    });

    it('re-derives when a member is removed', function () {
      cy = makeCy(pairGraph(3), { 'curve-style': 'bezier' });

      cy.$id('e1').remove();

      expect(dOf('e0')).to.equal(-20);
      expect(dOf('e2')).to.equal(20);
    });

    it('re-derives when a parallel edge is added later', function () {
      cy = makeCy(pairGraph(1), { 'curve-style': 'bezier' });

      cy.add({ data: { id: 'e1', source: 'a', target: 'b' } });

      expect(dOf('e0')).to.equal(-20);
      expect(dOf('e1')).to.equal(20);
    });

    it('re-derives across an edge move()', function () {
      cy = makeCy([...pairGraph(2), { data: { id: 'c' } }], {
        'curve-style': 'bezier',
      });

      cy.$id('e1').move({ target: 'c' });

      // the old bundle shrank to one; the moved edge is a lone bezier
      expect(kindOf('e0')).to.equal(CURVE_STRAIGHT);
      expect(kindOf('e1')).to.equal(CURVE_STRAIGHT);

      // moving back re-forms the bundle
      cy.$id('e1').move({ target: 'b' });

      expect(dOf('e0')).to.equal(-20);
      expect(dOf('e1')).to.equal(20);
    });

    it('resets params when restyled back to straight', function () {
      cy = makeCy(pairGraph(2), { 'curve-style': 'bezier' });

      expect(kindOf('e0')).to.equal(CURVE_BEZIER);

      cy.style({ edges: {} }); // back to the straight default

      expect(kindOf('e0')).to.equal(CURVE_STRAIGHT);
      expect(kindOf('e1')).to.equal(CURVE_STRAIGHT);
      expect(curvedFlagOf('e0')).to.equal(false);
    });

    it('supports a per-edge curve-style case mapper', function () {
      var elements = pairGraph(2);

      elements[2].data.kind = 'curvy';
      elements[3].data.kind = 'straight';

      cy = makeCy(elements, {
        'curve-style': {
          case: [{ when: { data: 'kind', eq: 'curvy' }, then: 'bezier' }],
          else: 'straight',
        },
      });

      // a 1-member bundle: the bezier edge is the straight middle
      expect(kindOf('e0')).to.equal(CURVE_STRAIGHT);
      expect(cy.$id('e0').style('curve-style')).to.equal('bezier');
      expect(cy.$id('e1').style('curve-style')).to.equal('straight');

      // flipping the data re-derives through the mapper refresh
      cy.$id('e1').data('kind', 'curvy');

      expect(dOf('e0')).to.equal(-20);
      expect(dOf('e1')).to.equal(20);
    });
  });

  describe('self-loops', function () {
    var loopGraph = (n) => {
      var elements = [{ data: { id: 'a' } }];

      for (var i = 0; i < n; i++) {
        elements.push({ data: { id: 'l' + i, source: 'a', target: 'a' } });
      }

      return elements;
    };

    it('derives loop params under the default straight style', function () {
      cy = makeCy(loopGraph(1));

      var p = paramsOf('l0');

      expect(p[3]).to.equal(CURVE_LOOP);
      expect(p[0]).to.be.closeTo(-Math.PI / 2, 1e-6); // out ray (up)
      expect(p[1]).to.be.closeTo(-Math.PI, 1e-6); // in ray (left)
      expect(p[2]).to.be.closeTo(56, 1e-4); // 1.4 x 40
      expect(curvedFlagOf('l0')).to.equal(true);
    });

    it('staggers same-direction loops by j', function () {
      cy = makeCy(loopGraph(2));

      expect(paramsOf('l0')[2]).to.be.closeTo(56, 1e-4);
      expect(paramsOf('l1')[2]).to.be.closeTo(1.4 * 40 * (4 / 3), 1e-4);
    });

    it('keeps differently-directed loops unstaggered', function () {
      var elements = loopGraph(2);

      elements[1].data.dir = 'a';
      elements[2].data.dir = 'b';

      cy = makeCy(elements, {
        'loop-direction': {
          case: [{ when: { data: 'dir', eq: 'a' }, then: -Math.PI / 4 }],
          else: Math.PI / 4,
        },
      });

      expect(paramsOf('l0')[2]).to.be.closeTo(56, 1e-4);
      expect(paramsOf('l1')[2]).to.be.closeTo(56, 1e-4);
    });

    it('re-staggers when a loop is removed', function () {
      cy = makeCy(loopGraph(2));

      cy.$id('l0').remove();

      expect(paramsOf('l1')[2]).to.be.closeTo(56, 1e-4);
    });

    it('parses loop-direction/loop-sweep deg strings', function () {
      cy = makeCy(loopGraph(1), {
        'loop-direction': '90deg',
        'loop-sweep': '-60deg',
      });

      var p = paramsOf('l0');
      // loopAngle = 90deg - 90deg = 0; sweep -60: out = 30deg, in = -30deg

      expect(p[0]).to.be.closeTo(Math.PI / 6, 1e-6);
      expect(p[1]).to.be.closeTo(-Math.PI / 6, 1e-6);
    });

    it('an edge move() out of a loop clears the loop params', function () {
      cy = makeCy([...loopGraph(1), { data: { id: 'b' } }]);

      expect(kindOf('l0')).to.equal(CURVE_LOOP);

      cy.$id('l0').move({ target: 'b' });

      expect(kindOf('l0')).to.equal(CURVE_STRAIGHT);
      expect(curvedFlagOf('l0')).to.equal(false);

      cy.$id('l0').move({ target: 'a' });

      expect(kindOf('l0')).to.equal(CURVE_LOOP);
    });
  });

  describe('style prop surface', function () {
    it('throws on unsupported curve-style keywords', function () {
      // every v3 keyword parses since 12c; only genuinely unknown ones throw
      expect(() => makeCy(pairGraph(1), { 'curve-style': 'zigzag' })).to.throw(
        /curve-style 'zigzag' is unsupported/,
      );
    });

    it('throws on invalid angles', function () {
      expect(() =>
        makeCy(pairGraph(1), { 'loop-direction': 'sideways' }),
      ).to.throw(/not a valid angle/);
    });

    it('throws for curve props on the nodes group', function () {
      expect(() =>
        cytoscape({ style: { nodes: { 'curve-style': 'bezier' } } }),
      ).to.throw(/'curve-style' is an edge style property/);
      expect(() =>
        cytoscape({ style: { nodes: { 'loop-sweep': 1 } } }),
      ).to.throw(/'loop-sweep' is an edge style property/);
    });

    it('supports numeric mappers for step size', function () {
      var elements = pairGraph(2);

      elements[2].data.w = 10;
      elements[3].data.w = 10;

      cy = makeCy(elements, {
        'curve-style': 'bezier',
        'control-point-step-size': {
          data: 'w',
          domain: [0, 10],
          range: [0, 80],
        },
      });

      expect(dOf('e0')).to.equal(-40);
      expect(dOf('e1')).to.equal(40);
    });
  });

  describe('bounding box + slack', function () {
    it('expands the whole-graph bb by the conservative curve bound', function () {
      cy = makeCy(pairGraph(2));
      cy.nodes().positions((ele) => ({ x: ele.id() === 'a' ? 0 : 100, y: 0 }));

      var before = cy._store.boundingBox();

      expect(before.y1).to.equal(-15);
      expect(before.y2).to.equal(15);

      cy.style({ edges: { 'curve-style': 'bezier' } });

      var after = cy._store.boundingBox();

      // both endpoints expand by the hull deviation (|d| = 20)
      expect(after.y1).to.equal(-20);
      expect(after.y2).to.equal(20);
      expect(after.x1).to.equal(-20);
      expect(after.x2).to.equal(120);
    });

    it('reports zero curve slack until something curves, then a conservative bound', function () {
      cy = makeCy(pairGraph(2));

      expect(cy._store.curveSlack()).to.equal(0);

      cy.style({ edges: { 'curve-style': 'bezier' } });
      cy._store.curveParamsAt(0); // flush

      // dev 20 + default node half 15
      expect(cy._store.curveSlack()).to.equal(35);
    });
  });
});
