import { expect } from 'chai';
import cytoscape from '../src/index.mjs';
import { FLAG_CURVED, FLAG_CURVED_BOX } from '../src/contract.mjs';

// round 14.10: compound loop edges — an edge between a node and its own
// ancestor/descendant (or a self-loop on a parent) routes around the
// outside via v3's findCompoundLoopPoints, whatever its curve style.

// p > (a at (0,0), b at (100,0)); q top-level leaf at (300, 0).
// The parents sheet zeroes padding/border so the derived boxes pin
// hand-computed numbers: p = pos (50, 0), size 130 x 30.
const make = (edges, style = {}) =>
  cytoscape({
    style: { parents: { padding: 0, borderWidth: 0 }, ...style },
    elements: {
      nodes: [
        { data: { id: 'p' } },
        { data: { id: 'a', parent: 'p' }, position: { x: 0, y: 0 } },
        { data: { id: 'b', parent: 'p' }, position: { x: 100, y: 0 } },
        { data: { id: 'q' }, position: { x: 300, y: 0 } },
      ],
      edges,
    },
  });

// v3's construction, for expected values
const compoundControls = (
  sx,
  sy,
  sHalfW,
  sHalfH,
  tx,
  ty,
  tHalfW,
  tHalfH,
  dist,
  j,
) => {
  const minX = Math.min(sx - sHalfW, tx - tHalfW);
  const minY = Math.min(sy - sHalfH, ty - tHalfH);
  const factor = (1 + Math.pow(50, 1.12) / 100) * dist * (j / 3 + 1);
  const stretchA = Math.max(0.5, Math.log(2 * sHalfW * 0.01));
  const stretchB = Math.max(0.5, Math.log(2 * tHalfW * 0.01));

  return [
    { x: minX, y: minY - factor * stretchA },
    { x: minX - factor * stretchB, y: minY },
  ];
};

describe('gpu/curves: compound loop edges (round 14.10)', function () {
  it('routes a child-to-parent edge around the outside (v3 formula)', function () {
    const cy = make([{ data: { id: 'ap', source: 'a', target: 'p' } }]);
    const ap = cy.$id('ap');

    cy.$id('p').position(); // settle auto-bounds

    const pts = ap.controlPoints();
    // a: (0,0) halves 15x15; p (derived): (50,0) halves 65x15; step 40, j = 0
    const want = compoundControls(0, 0, 15, 15, 50, 0, 65, 15, 40, 0);

    expect(pts.length).to.equal(2);
    expect(pts[0].x).to.be.closeTo(want[0].x, 0.01);
    expect(pts[0].y).to.be.closeTo(want[0].y, 0.01);
    expect(pts[1].x).to.be.closeTo(want[1].x, 0.01);
    expect(pts[1].y).to.be.closeTo(want[1].y, 0.01);

    expect(ap.isBundledBezier()).to.equal(false);

    // the label anchor is the control midpoint (the loop rule)
    const mid = ap.midpoint();

    expect(mid.x).to.be.closeTo((want[0].x + want[1].x) / 2, 0.01);
    expect(mid.y).to.be.closeTo((want[0].y + want[1].y) / 2, 0.01);
  });

  it('marks compound edges curved and box-bounded, and grows the cull slack', function () {
    const cy = make([{ data: { id: 'ap', source: 'a', target: 'p' } }]);
    const store = cy._store;

    store.flushDerived();

    const slot = cy.$id('ap')._first().slot;

    expect(store.hasFlag('edges', slot, FLAG_CURVED)).to.equal(true);
    expect(store.hasFlag('edges', slot, FLAG_CURVED_BOX)).to.equal(true);
    expect(store.curveSlack()).to.be.greaterThan(30); // the excursion bound feeds it
  });

  it('extends the exact edge bb by the outside excursion', function () {
    const cy = make([{ data: { id: 'ap', source: 'a', target: 'p' } }]);
    const bb = cy.$id('ap').boundingBox();

    // the loop swings up-left past the min corner (-15, -15)
    expect(bb.x1).to.be.lessThan(-16);
    expect(bb.y1).to.be.lessThan(-16);
  });

  // The conservative fit box: the endpoint AABB grown by the header
  // deviation plus the node-half margin — and *not* by the chord, which
  // belongs to the weight-extrapolated blob routes that share
  // FLAG_CURVED_BOX.  A compound loop's controls hang off the union of
  // the two node boxes, at most p2 / 2 past its top-left corner, so the
  // grown AABB already contains the curve; the chord was making `fit()`
  // draw every compound graph at a fraction of its size.
  it('does not grow a compound loop’s conservative box by the chord', function () {
    const cy = make([{ data: { id: 'ap', source: 'a', target: 'p' } }]);
    const store = cy._store;

    store.flushDerived();

    const slot = cy.$id('ap')._first().slot;
    const p2 = Math.abs(store.column('edge.curveParams')[slot * 4 + 2]);
    const margin = store.curveBoxMargin();
    const chord = 50; // a at (0, 0) to p's derived centre at (50, 0)
    const box = store.boundingBox();

    expect(p2).to.be.greaterThan(1); // the bound is doing something
    expect(box.x1).to.be.closeTo(-(p2 + margin), 0.01);
    expect(box.y1).to.be.closeTo(-(p2 + margin), 0.01);
    // the discriminating half: with the chord back in, x1 sits a whole
    // chord further out and the graph fits into a third of the viewport
    expect(box.x1).to.be.greaterThan(-(p2 + margin + chord) + 1);

    // `boundingBoxAt` carries the same formula for animated-layout fit
    // targets, so it is pinned here rather than left to drift apart
    const at = cy.elements().boundingBoxAt((node) => node.position());

    expect(at.x1).to.be.closeTo(-(p2 + margin), 0.01);
  });

  it('keeps the conservative box containing the exact one', function () {
    // soundness is the half that must not regress: fit may over-fit,
    // never under.  Three arrangements, because the bound is a max over
    // node halves and the excursion scales with the step size.
    const cases = [
      [[{ data: { id: 'ap', source: 'a', target: 'p' } }], {}],
      [
        [{ data: { id: 'ap', source: 'a', target: 'p' } }],
        { edges: { 'control-point-step-size': 300 } },
      ],
      [
        [
          { data: { id: 'pp', source: 'p', target: 'p' } },
          { data: { id: 'ap', source: 'a', target: 'p' } },
        ],
        { nodes: { width: 200, height: 120 } },
      ],
    ];

    for (const [edges, style] of cases) {
      const cy = make(edges, style);
      const conservative = cy._store.boundingBox();
      const exact = cy.elements().boundingBox();

      expect(conservative.x1, 'x1').to.be.at.most(exact.x1 + 1e-6);
      expect(conservative.y1, 'y1').to.be.at.most(exact.y1 + 1e-6);
      expect(conservative.x2, 'x2').to.be.at.least(exact.x2 - 1e-6);
      expect(conservative.y2, 'y2').to.be.at.least(exact.y2 - 1e-6);
      cy.destroy();
    }
  });

  it('routes ancestor edges across multiple levels', function () {
    const cy = make([{ data: { id: 'aq', source: 'a', target: 'q' } }]);

    expect(cy.$id('aq').controlPoints()).to.equal(undefined); // unrelated: straight

    cy.$id('q').move({ parent: null }); // no-op guard
    cy.$id('p').move({ parent: 'q' }); // q > p > a: a-q is now ancestor-related

    const pts = cy.$id('aq').controlPoints();

    expect(pts).to.not.equal(undefined);
    expect(pts.length).to.equal(2);
  });

  it('reverts to the styled routing when the relation ends', function () {
    const cy = make([{ data: { id: 'ap', source: 'a', target: 'p' } }]);

    expect(cy.$id('ap').controlPoints().length).to.equal(2);

    cy.$id('a').move({ parent: null }); // relation gone

    expect(cy.$id('ap').controlPoints()).to.equal(undefined); // default straight
  });

  it('preempts the declared curve style (v3’s edge:compound default)', function () {
    const cy = make([{ data: { id: 'ap', source: 'a', target: 'p' } }], {
      edges: { curveStyle: 'taxi' },
    });

    // a related edge never takes the taxi route: segmentPoints answers
    // for taxi edges, and a compound loop has none
    expect(cy.$id('ap').segmentPoints()).to.equal(undefined);
    expect(cy.$id('ap').controlPoints().length).to.equal(2);
  });

  it('routes a parent self-loop around the outside; leaf loops stay loops', function () {
    const cy = make([
      { data: { id: 'pp', source: 'p', target: 'p' } },
      { data: { id: 'qq', source: 'q', target: 'q' } },
    ]);

    cy.$id('p').position(); // settle auto-bounds

    const pp = cy.$id('pp').controlPoints();
    // p self-loop: both ends (50,0) halves 65x15 → min corner (-15,-15)
    const want = compoundControls(50, 0, 65, 15, 50, 0, 65, 15, 40, 0);

    expect(pp[0].x).to.be.closeTo(want[0].x, 0.01);
    expect(pp[0].y).to.be.closeTo(want[0].y, 0.01);
    expect(pp[1].x).to.be.closeTo(want[1].x, 0.01);
    expect(pp[1].y).to.be.closeTo(want[1].y, 0.01);

    // the leaf self-loop keeps v3's center-ray construction: both
    // controls sit at the loop radius from the node center
    const qq = cy.$id('qq').controlPoints();
    const r = (dx, dy) => Math.sqrt(dx * dx + dy * dy);

    expect(r(qq[0].x - 300, qq[0].y)).to.be.closeTo(1.4 * 40, 0.01);
    expect(r(qq[1].x - 300, qq[1].y)).to.be.closeTo(1.4 * 40, 0.01);
  });

  it('re-routes a leaf self-loop when its node becomes a parent', function () {
    const cy = make([{ data: { id: 'qq', source: 'q', target: 'q' } }]);

    cy.$id('b').move({ parent: 'q' }); // q flips to a parent

    const pts = cy.$id('qq').controlPoints();
    // q derives over b at (100, 0): pos (100, 0), size 30 x 30
    const want = compoundControls(100, 0, 15, 15, 100, 0, 15, 15, 40, 0);

    expect(pts[0].x).to.be.closeTo(want[0].x, 0.01);
    expect(pts[0].y).to.be.closeTo(want[0].y, 0.01);

    cy.$id('b').move({ parent: 'p' }); // q back to a leaf

    // q keeps its derived position (v3: a parent's position persists),
    // so the plain loop re-centers there
    const qPos = cy.$id('q').position();
    const back = cy.$id('qq').controlPoints();

    expect(r2(back[0].x - qPos.x, back[0].y - qPos.y)).to.be.closeTo(
      1.4 * 40,
      0.01,
    );
  });

  it('follows auto-bounds resizes with live control points', function () {
    const cy = make([{ data: { id: 'ap', source: 'a', target: 'p' } }]);
    const before = cy.$id('ap').controlPoints();

    cy.$id('b').position({ x: 100, y: -200 }); // p grows upward

    const after = cy.$id('ap').controlPoints();

    // p's top edge (the min corner's y) moved up, so the controls moved too
    expect(after[0].y).to.be.lessThan(before[0].y - 50);
  });
});

const r2 = (dx, dy) => Math.sqrt(dx * dx + dy * dy);
