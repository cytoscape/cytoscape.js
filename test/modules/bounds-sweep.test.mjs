import { expect } from 'chai';
import cytoscape from '../../src/index.mjs';
import { FLAG_CURVED_BOX, CURVE_STRAIGHT } from '../../src/contract.mjs';

/*
Round 54: the randomized soundness sweep, promoted from 43.13's one-off
measurement to a standing gate.  Round 92 sharpened what it pins.

The fit scan (`GraphStore.boundingBox`) tiers its edge terms: the
box-bounded kinds (compound loops, taxi, weight-extrapolated blobs) are
EXACT via the memoized flattened curve bb — round 54 made taxi exact
when this sweep caught, on its first run, a forced-direction route
escaping any node-half margin, and round 92 retired the remaining
conservative terms (the directional compound-loop p2 box, the per-edge
outer-half + chord margin) because their cushion over-framed and
de-centered compound fits — while the chord-bounded kinds (bezier,
loops) keep the cheap hull bound.  Two properties, both directions of
the old containment:

  1. SOUNDNESS, every graph: the scan box contains the exact
     `cy.elements().boundingBox()` in all four directions — fit may
     over-fit, never under.
  2. EXACTNESS, every graph whose curved edges are all box-bounded: the
     scan box *equals* the exact box, which is what pins that the exact
     tier is live (with a conservative term reintroduced the sweep goes
     red here, not in the containment half).

Deterministic on purpose: a fixed-seed LCG, so a failure reproduces and
CI cannot flake.  The graph count trades coverage against suite time;
43.13's original one-off used 60 graphs and this keeps that order.
*/

// Numerical Recipes LCG — deterministic across runs and platforms
const lcg = (seed) => {
  let s = seed >>> 0;

  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
};

const GRAPHS = 60;

describe('bounds sweep (rounds 54/92)', function () {
  it('the scan box contains the exact box — and equals it where every curve is box-bounded', function () {
    const rnd = lcg(0xc0ffee);
    const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
    const between = (lo, hi) => lo + rnd() * (hi - lo);
    let exactGraphs = 0;

    for (let g = 0; g < GRAPHS; g++) {
      // -- build a random compound graph --
      const nodes = [];
      const edges = [];
      const leafIds = [];
      const size = () => Math.round(between(10, 250));
      const coord = () => Math.round(between(-300, 300));
      const leaf = (id, parent) => {
        nodes.push({
          data: { id, parent, w: size(), h: size() },
          position: { x: coord(), y: coord() },
        });
        leafIds.push(id);
      };

      // parent p1 with 2-4 children; sometimes a nested parent p2
      nodes.push({ data: { id: 'p1' } });
      const kids = 2 + Math.floor(rnd() * 3);

      for (let i = 0; i < kids; i++) {
        leaf(`c${i}`, 'p1');
      }

      const nested = rnd() < 0.5;

      if (nested) {
        nodes.push({ data: { id: 'p2', parent: 'p1' } });
        leaf('n0', 'p2');
        leaf('n1', 'p2');
      }

      // top-level leaves
      leaf('t0');
      leaf('t1');

      // ancestry edges: child -> ancestor (routes CURVE_CMPD whatever
      // the declared style), plus a parent self-loop half the time
      edges.push({ data: { id: 'cmpd0', source: 'c0', target: 'p1' } });

      if (nested) {
        edges.push({ data: { id: 'cmpd1', source: 'n0', target: 'p1' } });
      }
      if (rnd() < 0.5) {
        edges.push({ data: { id: 'ploop', source: 'p1', target: 'p1' } });
      }

      // ordinary edges between random leaves take the graph's declared
      // style — taxi and extrapolated-unbundled are the box-bounded
      // kinds whose margin went per-edge
      for (let i = 0; i < 3; i++) {
        edges.push({
          data: { id: `e${i}`, source: pick(leafIds), target: pick(leafIds) },
        });
      }

      const styleKind = pick(['taxi', 'extrapolated', 'bezier']);
      const edgeStyle =
        styleKind === 'taxi'
          ? {
              'curve-style': 'taxi',
              'taxi-direction': pick([
                'auto',
                'vertical',
                'horizontal',
                'downward',
                'rightward',
              ]),
              'taxi-turn': pick([
                Math.round(between(-80, 80)),
                `${Math.round(between(10, 90))}%`,
              ]),
            }
          : styleKind === 'extrapolated'
            ? {
                'curve-style': 'unbundled-bezier',
                'control-point-distances': [Math.round(between(-120, 120))],
                'control-point-weights': [pick([-0.6, -0.2, 1.3, 1.8])],
              }
            : { 'curve-style': 'bezier' };

      const cy = cytoscape({
        style: {
          nodes: {
            width: { data: 'w', domain: [10, 250], range: [10, 250] },
            height: { data: 'h', domain: [10, 250], range: [10, 250] },
          },
          parents: { padding: Math.round(between(0, 40)) },
          edges: {
            ...edgeStyle,
            'control-point-step-size': Math.round(between(5, 200)),
          },
        },
        elements: { nodes, edges },
      });

      const scan = cy._store.boundingBox();
      const exact = cy.elements().boundingBox();
      const label = `graph ${g} (${styleKind}${nested ? ', nested' : ''})`;

      expect(scan, label).to.not.equal(null);
      expect(scan.x1, `${label} x1`).to.be.at.most(exact.x1 + 1e-6);
      expect(scan.y1, `${label} y1`).to.be.at.most(exact.y1 + 1e-6);
      expect(scan.x2, `${label} x2`).to.be.at.least(exact.x2 - 1e-6);
      expect(scan.y2, `${label} y2`).to.be.at.least(exact.y2 - 1e-6);

      // exactness (round 92): when every curved edge is a box-bounded
      // kind, the scan reads the same memoized bbs the exact tier does,
      // so the boxes must coincide — the assertion a reintroduced
      // conservative term fails.  A leaf self-loop or a bundled-bezier
      // pair (the random e0..e2 can produce both) keeps its chord-hull
      // bound, so those graphs stay containment-only.
      cy._store.flushDerived();

      const params = cy._store.column('edge.curveParams');
      let allBox = true;

      cy.edges().forEach((edge) => {
        const slot = edge._first().slot;
        const kind = params[slot * 4 + 3];

        if (
          kind !== CURVE_STRAIGHT &&
          !cy._store.hasFlag('edges', slot, FLAG_CURVED_BOX)
        ) {
          allBox = false;
        }
      });

      if (allBox) {
        exactGraphs++;
        expect(scan.x1, `${label} exact x1`).to.be.closeTo(exact.x1, 1e-6);
        expect(scan.y1, `${label} exact y1`).to.be.closeTo(exact.y1, 1e-6);
        expect(scan.x2, `${label} exact x2`).to.be.closeTo(exact.x2, 1e-6);
        expect(scan.y2, `${label} exact y2`).to.be.closeTo(exact.y2, 1e-6);
      }

      cy.destroy();
    }

    // the exactness half must actually run — a generator drift that
    // stopped producing all-box graphs would leave it asserting nothing
    // (39 of the 60 seeded graphs exercise it today)
    expect(exactGraphs, 'graphs exercising the exactness half').to.be.at.least(
      10,
    );
  });

  it('taxi is exact in the scan: forced-direction overshoot included, unrelated giants excluded', function () {
    // the shape the sweep caught on its first run: a `downward` taxi
    // whose route dips a whole turn below both endpoints.  No node-half
    // margin bounds that — the scan uses the memoized exact curve bb
    // for taxi, so the overshoot is included exactly...
    const make = (extraNodes = []) =>
      cytoscape({
        style: {
          nodes: {
            width: {
              data: 'w',
              domain: [10, 400],
              range: [10, 400],
              fallback: 30,
            },
            height: {
              data: 'h',
              domain: [10, 400],
              range: [10, 400],
              fallback: 30,
            },
          },
          edges: {
            'curve-style': 'taxi',
            'taxi-direction': 'downward',
            'taxi-turn': 40,
          },
        },
        elements: {
          nodes: [
            { data: { id: 'x' }, position: { x: 0, y: 0 } },
            { data: { id: 'y' }, position: { x: 200, y: -150 } },
            ...extraNodes,
          ],
          edges: [{ data: { id: 'xy', source: 'x', target: 'y' } }],
        },
      });

    const cy = make();
    const box = cy._store.boundingBox();
    const exact = cy.elements().boundingBox();

    expect(box.y2, 'the turn dips below the nodes').to.be.greaterThan(40);
    expect(box.y2).to.be.closeTo(exact.y2, 1e-6);
    expect(box.y1).to.be.closeTo(exact.y1, 1e-6);

    // ...and `boundingBoxAt` routes at the hypothetical centres: shift
    // both nodes down 100 and the taxi box translates with them
    const at = cy
      .elements()
      .boundingBoxAt((n) => ({ x: n.position().x, y: n.position().y + 100 }));

    expect(at.y2).to.be.closeTo(box.y2 + 100, 1e-6);

    cy.destroy();

    // a 400px node far away must not move the taxi edge's share of the
    // box: the old global-margin formulation inflated every box-bounded
    // edge by the largest node in the graph
    const cy2 = make([
      { data: { id: 'big', w: 400, h: 400 }, position: { x: 2000, y: 0 } },
    ]);
    const box2 = cy2._store.boundingBox();

    expect(box2.y2).to.be.closeTo(Math.max(box.y2, 200), 1e-6);
    expect(box2.x1).to.be.closeTo(box.x1, 1e-6);

    cy2.destroy();
  });

  it('CONTROL: the sweep discriminates — a graph the old chord bug would have missed', function () {
    // one deterministic instance of the shape that motivated 43.13 and
    // this round: a compound loop on a graph that also carries one huge
    // node far away.  The huge node used to inflate the loop's box
    // through the global nodeHalfMax; now it must not.
    const cy = cytoscape({
      style: {
        parents: { padding: 0, borderWidth: 0 },
        nodes: {
          width: {
            data: 'w',
            domain: [10, 400],
            range: [10, 400],
            fallback: 30,
          },
          height: {
            data: 'h',
            domain: [10, 400],
            range: [10, 400],
            fallback: 30,
          },
        },
      },
      elements: {
        nodes: [
          { data: { id: 'p' } },
          { data: { id: 'a', parent: 'p' }, position: { x: 0, y: 0 } },
          { data: { id: 'b', parent: 'p' }, position: { x: 100, y: 0 } },
          {
            data: { id: 'big', w: 400, h: 400 },
            position: { x: 2000, y: 0 },
          },
        ],
        edges: [{ data: { id: 'ap', source: 'a', target: 'p' } }],
      },
    });

    cy._store.flushDerived();

    const slot = cy.$id('ap')._first().slot;
    const p2 = Math.abs(cy._store.column('edge.curveParams')[slot * 4 + 2]);
    const box = cy._store.boundingBox();
    const exact = cy.$id('ap').boundingBox();

    // the loop's corner is its OWN exact excursion (round 92; round 54
    // held it at the union corner minus p2) — the 400px node two
    // thousand px away contributes nothing to it (under the
    // global-margin formulation x1 would sit a further ~200px out, and
    // y2 would hang p2 + 200 below a graph whose lowest ink is big's
    // own bottom edge at 200)
    expect(box.x1).to.be.closeTo(exact.x1, 0.01);
    expect(box.x1).to.be.greaterThan(-15 - p2 + 1); // tighter than 54's pin
    expect(box.y2).to.be.closeTo(200, 0.01); // big's own bottom edge

    cy.destroy();
  });
});
