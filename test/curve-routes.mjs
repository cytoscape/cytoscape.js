import { expect } from 'chai';
import {
  CURVE_SEGS,
  MAX_CURVE_PTS,
  EDGE_DIST_INTERSECTION,
  EDGE_DIST_NODE_POSITION,
  TAXI_AUTO,
  TAXI_VERTICAL,
  TAXI_DOWNWARD,
  emptyCurveRoute,
  evalRoute,
  routeVertex,
  flattenRoute,
  routeMidpoint,
  routePieceCount,
  allocRouteQuads,
  routeQuadPiece,
  MAX_ROUTE_PIECES,
  computeCorner,
  emptyRouteCorner,
  arcSweep,
} from '../src/curve-geometry.mjs';
import {
  CURVE_MULTI,
  CURVE_SEGMENTS,
  CURVE_TAXI,
  SHAPE_CIRCLE,
} from '../src/contract.mjs';
import { getRoundCorner } from '../v3/src/round.mjs';

// two circle nodes on the x axis: an exactly hand-derivable frame
// (si = (15, 0), ti = (85, 0), normal = (0, 1))
const CIRCLES = [0, 0, 15, 15, SHAPE_CIRCLE, 100, 0, 15, 15, SHAPE_CIRCLE];

const evalWith = (kind, blob, n, nodes = CIRCLES) => {
  const route = emptyCurveRoute();

  return evalRoute(route, kind, blob, 0, n, ...nodes);
};

// taxi blob record: [dir, turn, turnIsPercent, minD, bodyMode, round, radius, arc]
const taxiBlob = (over = {}) => {
  const rec = {
    dir: TAXI_AUTO,
    turn: 0.5,
    pct: 1,
    minD: 10,
    body: EDGE_DIST_INTERSECTION,
    round: 0,
    radius: 0,
    arc: 1,
    ...over,
  };

  return [
    rec.dir,
    rec.turn,
    rec.pct,
    rec.minD,
    rec.body,
    rec.round,
    rec.radius,
    rec.arc,
  ];
};

describe('gpu/curve-routes: 12b route geometry', function () {
  describe('computeCorner (v3 getRoundCorner twin)', function () {
    const triples = [
      // right angle
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
      ],
      // acute
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 20, y: 30 },
      ],
      // obtuse, other winding
      [
        { x: 0, y: 50 },
        { x: 80, y: 0 },
        { x: 160, y: 60 },
      ],
      // short legs (limit clamp engages)
      [
        { x: 0, y: 0 },
        { x: 12, y: 0 },
        { x: 12, y: 14 },
      ],
    ];

    for (const isArc of [true, false]) {
      for (const radius of [15, 4]) {
        it(`matches v3 exactly (${isArc ? 'arc' : 'influence'}-radius, r=${radius})`, function () {
          for (const [p, c, n] of triples) {
            const v3 = getRoundCorner(p, c, n, radius, isArc);
            const out = computeCorner(
              emptyRouteCorner(),
              p.x,
              p.y,
              c.x,
              c.y,
              n.x,
              n.y,
              radius,
              isArc,
            );

            expect(out.cx).to.be.closeTo(v3.cx, 1e-12);
            expect(out.cy).to.be.closeTo(v3.cy, 1e-12);
            expect(out.r).to.be.closeTo(v3.radius, 1e-12);
            expect(out.startX).to.be.closeTo(v3.startX, 1e-12);
            expect(out.startY).to.be.closeTo(v3.startY, 1e-12);
            expect(out.stopX).to.be.closeTo(v3.stopX, 1e-12);
            expect(out.stopY).to.be.closeTo(v3.stopY, 1e-12);
            expect(out.a0).to.be.closeTo(v3.startAngle, 1e-12);
            expect(out.a1).to.be.closeTo(v3.endAngle, 1e-12);
            expect(out.ccw).to.equal(v3.counterClockwise);
          }
        });
      }
    }

    it('collapses collinear corners to the point, radius 0', function () {
      const v3 = getRoundCorner(
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 100, y: 0 },
        10,
        true,
      );
      const out = computeCorner(
        emptyRouteCorner(),
        0,
        0,
        50,
        0,
        100,
        0,
        10,
        true,
      );

      expect(v3.radius).to.equal(0);
      expect(out.r).to.equal(0);
      expect(out.cx).to.equal(50);
      expect(out.cy).to.equal(0);
    });

    /*
     * Round 55: the one place computeCorner deliberately does NOT match
     * v3, pinned here so the divergence is a decision on the record
     * rather than a drift.
     *
     * A zero-length leg — two coincident route points — has no direction.
     * v3's `asVec` divides by it unguarded and returns NaN for every
     * field, and v3's own collinear short-circuit cannot save it because
     * that test runs *after* the normalize, where `abs(NaN) < 1e-6` is
     * false.  The configuration is ordinary: an axis-aligned node pair
     * under `round-taxi` makes `evalTaxi` emit two coincident interior
     * points in both libraries (a faithful port), which is what a grid
     * layout produces — four edges of `debug/`'s `v3-default` network are
     * exactly this.
     *
     * v4's consequence was strictly worse than v3's, which is why
     * matching v3 was not an option: the NaN reached `boundingBox()`,
     * which answered all-null, so the edge became unpickable and
     * corrupted any bound containing it.
     */
    describe('a zero-length leg (round 55, a deliberate divergence)', function () {
      const cases = [
        ['prev coincides with the corner', 50, 0, 50, 0, 100, 0],
        ['next coincides with the corner', 0, 0, 50, 0, 50, 0],
        ['both coincide', 50, 0, 50, 0, 50, 0],
      ];

      for (const [label, px, py, cx, cy, nx, ny] of cases) {
        it(`collapses to the point where v3 returns NaN — ${label}`, function () {
          const v3 = getRoundCorner(
            { x: px, y: py },
            { x: cx, y: cy },
            { x: nx, y: ny },
            15,
            true,
          );

          // the control: v3 really is NaN here, so this spec is pinning a
          // divergence rather than describing agreement
          expect(Number.isNaN(v3.cx), 'v3 is expected to be NaN here').to.equal(
            true,
          );

          const out = computeCorner(
            emptyRouteCorner(),
            px,
            py,
            cx,
            cy,
            nx,
            ny,
            15,
            true,
          );

          expect(out.r).to.equal(0);
          expect(out.cx).to.equal(cx);
          expect(out.cy).to.equal(cy);
          expect(out.startX).to.equal(cx);
          expect(out.stopY).to.equal(cy);

          for (const v of [
            out.cx,
            out.cy,
            out.r,
            out.startX,
            out.startY,
            out.stopX,
            out.stopY,
            out.a0,
            out.a1,
          ]) {
            expect(Number.isFinite(v), 'every field must be finite').to.equal(
              true,
            );
          }
        });
      }
    });
  });

  describe('routeQuadPiece allocator (round 93: bend-weighted)', function () {
    /** quads per piece over the drawn subdivision */
    const pieceCounts = (route, segs = CURVE_SEGS) => {
      const out = { piece: 0, t: 0 };
      const counts = new Array(routePieceCount(route)).fill(0);

      for (let idx = 0; idx < segs; idx++) {
        routeQuadPiece(route, idx, out, segs);
        counts[out.piece]++;
      }

      return counts;
    };

    // one route per family shape the allocator distinguishes
    const fixtures = () => [
      [
        'sharp segments',
        evalWith(
          CURVE_SEGMENTS,
          [EDGE_DIST_INTERSECTION, 0, 30, 0.25, 0, 0, 30, 0.75, 0, 0],
          2,
        ),
      ],
      [
        'round segments',
        evalWith(
          CURVE_SEGMENTS,
          [EDGE_DIST_INTERSECTION, 1, 30, 0.25, 8, 1, 30, 0.75, 8, 1],
          2,
        ),
      ],
      [
        'round taxi',
        evalWith(CURVE_TAXI, taxiBlob({ round: 1, radius: 12 }), 0, [
          0,
          0,
          15,
          15,
          SHAPE_CIRCLE,
          10,
          200,
          15,
          15,
          SHAPE_CIRCLE,
        ]),
      ],
      [
        'sharp taxi',
        evalWith(CURVE_TAXI, taxiBlob(), 0, [
          0,
          0,
          15,
          15,
          SHAPE_CIRCLE,
          10,
          200,
          15,
          15,
          SHAPE_CIRCLE,
        ]),
      ],
      [
        'multibezier n=2',
        evalWith(CURVE_MULTI, [EDGE_DIST_INTERSECTION, 40, 0.25, -40, 0.75], 2),
      ],
      [
        'multibezier n=1',
        evalWith(CURVE_MULTI, [EDGE_DIST_INTERSECTION, 40, 0.5], 1),
      ],
    ];

    it('lands every piece boundary exactly on a subdivision index', function () {
      const out = { piece: 0, t: 0 };

      for (const [label, route] of fixtures()) {
        const P = routePieceCount(route);
        const starts = new Set();
        let lastPiece = -1;

        for (let idx = 0; idx < CURVE_SEGS; idx++) {
          routeQuadPiece(route, idx, out);

          expect(out.piece, label).to.be.at.least(lastPiece); // monotone
          if (out.t === 0) {
            starts.add(out.piece);
          }
          lastPiece = out.piece;
        }

        // every piece starts at t=0 on some index
        expect(starts.size, label).to.equal(P);

        routeQuadPiece(route, CURVE_SEGS, out);
        expect(out.piece, label).to.equal(P - 1);
        expect(out.t, label).to.equal(1);
      }
    });

    it('every piece keeps at least one quad, and the budget is spent exactly', function () {
      for (const [label, route] of fixtures()) {
        const counts = pieceCounts(route);

        expect(Math.min(...counts), label).to.be.at.least(1);
        expect(
          counts.reduce((a, b) => a + b, 0),
          label,
        ).to.equal(CURVE_SEGS);
      }
    });

    it('straight legs get exactly one quad when the route has bends', function () {
      // round taxi: pieces leg, arc, leg, arc, leg — the legs are
      // pixel-straight and one quad draws each exactly, so the whole
      // leftover goes to the two arcs
      const route = evalWith(
        CURVE_TAXI,
        taxiBlob({ round: 1, radius: 12 }),
        0,
        [0, 0, 15, 15, SHAPE_CIRCLE, 10, 200, 15, 15, SHAPE_CIRCLE],
      );
      const counts = pieceCounts(route);

      expect(counts).to.have.length(5);
      expect(counts[0]).to.equal(1);
      expect(counts[2]).to.equal(1);
      expect(counts[4]).to.equal(1);
      // the two ~90-degree arcs split the remaining 19 near-evenly
      expect(counts[1]).to.be.at.least(9);
      expect(counts[3]).to.be.at.least(9);
    });

    it('a deeper corner gets more quads than a shallower one', function () {
      // both corners rounded, but the second bends much harder: point 2
      // sits far off the frame so the turn at it approaches 180 degrees
      const route = evalWith(
        CURVE_SEGMENTS,
        [EDGE_DIST_INTERSECTION, 1, 8, 0.3, 6, 1, 60, 0.5, 6, 1],
        2,
      );
      const counts = pieceCounts(route);

      expect(counts[3], 'the deep corner').to.be.greaterThan(counts[1]);
      expect(counts[0]).to.equal(1); // legs stay at one quad
      expect(counts[2]).to.equal(1);
      expect(counts[4]).to.equal(1);
    });

    it('routes with no bend keep the uniform split', function () {
      for (const [label, route] of [fixtures()[0], fixtures()[3]]) {
        const counts = pieceCounts(route);

        expect(
          Math.max(...counts) - Math.min(...counts),
          `${label} spreads evenly`,
        ).to.be.at.most(1);
      }
    });

    it('a radius-50 arc flattens to within 0.05 model px of the true circle', function () {
      // the maintainer's round-93 case: one 90-degree round-taxi corner
      // at radius 50 rendered as ~6 visible facets under the uniform
      // split; bend-weighting gives the arc 30 of the 32 chords
      // (round 93.2's budget), whose worst sagitta
      // r(1 - cos(sweep/2k)) measures 0.017 px.  A uniform split's 11
      // chords put it at ~0.13 px by the same closed form (0.24
      // measured for 8 chords at the old 24 budget), so this bound
      // fails by 2.5x+ if the allocation regresses.
      const route = evalWith(
        CURVE_TAXI,
        taxiBlob({ dir: TAXI_VERTICAL, turn: 5, pct: 0, round: 1, radius: 50 }),
        0,
        [0, 0, 15, 15, SHAPE_CIRCLE, 220, 300, 15, 15, SHAPE_CIRCLE],
      );

      expect(routePieceCount(route)).to.equal(3); // leg, arc, leg (L-shape)

      const corner = computeCorner(
        emptyRouteCorner(),
        route.qx[0],
        route.qy[0],
        route.qx[1],
        route.qy[1],
        route.qx[2],
        route.qy[2],
        50,
        true,
      );

      expect(corner.r).to.be.closeTo(50, 1e-9);

      const out = { piece: 0, t: 0 };
      const a = { x: 0, y: 0 };
      const b = { x: 0, y: 0 };
      let maxSagitta = 0;

      for (let idx = 0; idx < CURVE_SEGS; idx++) {
        routeQuadPiece(route, idx, out);

        if (out.piece !== 1) {
          continue;
        } // the arc piece

        routeVertex(route, idx, a);
        routeVertex(route, idx + 1, b);

        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        const sagitta = corner.r - Math.hypot(mx - corner.cx, my - corner.cy);

        maxSagitta = Math.max(maxSagitta, sagitta);
      }

      expect(maxSagitta).to.be.greaterThan(0); // the probe saw the arc
      expect(maxSagitta).to.be.at.most(0.05);
    });

    it('the flattened arc length tracks the true arc length (dashes ride it)', function () {
      // the dash coordinate is the accumulated chord length of the drawn
      // polyline, so a coarse arc shortens every dash cycle along it —
      // the "dash pattern that breathes" regression the round-93 plan
      // names.  True arc length here: r * sweep = 50 * pi/2 = 78.54; at
      // round 93.2's 32 budget the bend-weighted 30 chords sum to 78.53
      // (0.009 short) while a uniform split's 11 chords come to ~78.47
      // (~0.07 short, past the 0.05 bound; the margin was 2.4x at the
      // old 24 budget) — so the bound still fails if the allocation
      // regresses
      const route = evalWith(
        CURVE_TAXI,
        taxiBlob({ dir: TAXI_VERTICAL, turn: 5, pct: 0, round: 1, radius: 50 }),
        0,
        [0, 0, 15, 15, SHAPE_CIRCLE, 220, 300, 15, 15, SHAPE_CIRCLE],
      );
      const corner = computeCorner(
        emptyRouteCorner(),
        route.qx[0],
        route.qy[0],
        route.qx[1],
        route.qy[1],
        route.qx[2],
        route.qy[2],
        50,
        true,
      );
      const sweep = Math.abs(arcSweep(corner.a0, corner.a1, corner.ccw));
      const trueArc = corner.r * sweep;

      const out = { piece: 0, t: 0 };
      const a = { x: 0, y: 0 };
      const b = { x: 0, y: 0 };
      let chordSum = 0;

      for (let idx = 0; idx < CURVE_SEGS; idx++) {
        routeQuadPiece(route, idx, out);

        if (out.piece !== 1) {
          continue;
        } // the arc piece

        routeVertex(route, idx, a);
        routeVertex(route, idx + 1, b);
        chordSum += Math.hypot(b.x - a.x, b.y - a.y);
      }

      expect(trueArc).to.be.greaterThan(78); // the fixture is the 90-degree arc
      expect(trueArc - chordSum).to.be.at.least(0); // chords never overshoot
      expect(trueArc - chordSum).to.be.at.most(0.05);
    });

    it('re-evaluating into the same scratch rebuilds the map', function () {
      // the evaluators share scratch instances, so a stale map from the
      // previous edge is the failure mode to pin: a round route's
      // leg-1 arc-heavy map must not leak into a sharp route
      const route = emptyCurveRoute();

      evalRoute(
        route,
        CURVE_TAXI,
        taxiBlob({ round: 1, radius: 12 }),
        0,
        0,
        0,
        0,
        15,
        15,
        SHAPE_CIRCLE,
        10,
        200,
        15,
        15,
        SHAPE_CIRCLE,
      );

      expect(pieceCounts(route)[0]).to.equal(1); // bend-weighted

      evalRoute(
        route,
        CURVE_SEGMENTS,
        [EDGE_DIST_INTERSECTION, 0, 30, 0.25, 0, 0, 30, 0.75, 0, 0],
        0,
        2,
        0,
        0,
        15,
        15,
        SHAPE_CIRCLE,
        100,
        0,
        15,
        15,
        SHAPE_CIRCLE,
      );

      const counts = pieceCounts(route);

      expect(Math.max(...counts) - Math.min(...counts)).to.be.at.most(1);
    });

    it('rebuilds for a non-default subdivision and back', function () {
      const route = evalWith(
        CURVE_TAXI,
        taxiBlob({ round: 1, radius: 12 }),
        0,
        [0, 0, 15, 15, SHAPE_CIRCLE, 10, 200, 15, 15, SHAPE_CIRCLE],
      );
      const at48 = pieceCounts(route, 48);

      expect(at48.reduce((a, b) => a + b, 0)).to.equal(48);
      expect(Math.min(...at48)).to.be.at.least(1);

      const atDefault = pieceCounts(route);

      expect(atDefault.reduce((a, b) => a + b, 0)).to.equal(CURVE_SEGS);
    });

    it('allocRouteQuads pins the last piece end to the budget', function () {
      const route = evalWith(
        CURVE_SEGMENTS,
        [EDGE_DIST_INTERSECTION, 1, 30, 0.25, 8, 1, 30, 0.75, 8, 1],
        2,
      );

      allocRouteQuads(route);
      expect(route.segEnd[route.pieces - 1]).to.equal(CURVE_SEGS);
    });
  });

  describe('unbundled bezier (CURVE_MULTI)', function () {
    it('places the control at the weighted frame point + normal offset', function () {
      // mode, then (d, w) pairs
      const route = evalWith(CURVE_MULTI, [EDGE_DIST_INTERSECTION, 40, 0.5], 1);

      // si=(15,0), ti=(85,0); base = (50,0); normal = (0,1) => ctrl (50,40)
      expect(route.qx[1]).to.be.closeTo(50, 1e-9);
      expect(route.qy[1]).to.be.closeTo(40, 1e-9);
    });

    it('weights measure along the intersection frame by default', function () {
      const route = evalWith(CURVE_MULTI, [EDGE_DIST_INTERSECTION, 40, 0], 1);

      expect(route.qx[1]).to.be.closeTo(15, 1e-9); // at si
      expect(route.qy[1]).to.be.closeTo(40, 1e-9);
    });

    it('edge-distances node-position measures between centers with the intersection normal', function () {
      // asymmetric radii so the two bases differ
      const nodes = [0, 0, 15, 15, SHAPE_CIRCLE, 100, 0, 25, 25, SHAPE_CIRCLE];
      const inter = evalWith(
        CURVE_MULTI,
        [EDGE_DIST_INTERSECTION, 40, 0.5],
        1,
        nodes,
      );
      const posMode = evalWith(
        CURVE_MULTI,
        [EDGE_DIST_NODE_POSITION, 40, 0.5],
        1,
        nodes,
      );

      // intersection frame: si=(15,0), ti=(75,0) => base (45,0)
      expect(inter.qx[1]).to.be.closeTo(45, 1e-9);
      // node-position frame: centers => base (50,0); same (0,1) normal
      expect(posMode.qx[1]).to.be.closeTo(50, 1e-9);
      expect(posMode.qy[1]).to.be.closeTo(40, 1e-9);
    });

    it('endpoints sit on the node boundary toward the near control', function () {
      const route = evalWith(CURVE_MULTI, [EDGE_DIST_INTERSECTION, 40, 0.5], 1);

      // on the circle of radius 15 about (0,0), along the ray to (50,40)
      const l = Math.hypot(route.qx[0], route.qy[0]);

      expect(l).to.be.closeTo(15, 1e-9);

      const dir = Math.atan2(route.qy[0], route.qx[0]);

      expect(dir).to.be.closeTo(Math.atan2(40, 50), 1e-9);
    });

    it('n=2 splines through the inserted midpoint (C1), boundary lands on an index', function () {
      const route = evalWith(
        CURVE_MULTI,
        [EDGE_DIST_INTERSECTION, 40, 0.25, -40, 0.75],
        2,
      );

      // ctrl1 = (15 + 70*0.25, 40) = (32.5, 40); ctrl2 = (67.5, -40)
      expect(route.qx[1]).to.be.closeTo(32.5, 1e-9);
      expect(route.qy[1]).to.be.closeTo(40, 1e-9);
      expect(route.qx[2]).to.be.closeTo(67.5, 1e-9);
      expect(route.qy[2]).to.be.closeTo(-40, 1e-9);

      // the two equal pieces split the budget in half, so the piece
      // boundary is segEnd[0] (CURVE_SEGS / 2 for an even budget) and
      // the vertex there is the inserted midpoint m12
      const p = { x: 0, y: 0 };

      allocRouteQuads(route);
      expect(route.segEnd[0]).to.equal(CURVE_SEGS / 2);
      routeVertex(route, route.segEnd[0], p);
      expect(p.x).to.be.closeTo((32.5 + 67.5) / 2, 1e-9);
      expect(p.y).to.be.closeTo(0, 1e-9);
    });

    it('midpoint: even control counts take the inserted midpoint (v3 rule)', function () {
      const route = evalWith(
        CURVE_MULTI,
        [EDGE_DIST_INTERSECTION, 40, 0.25, -40, 0.75],
        2,
      );
      const m = { x: 0, y: 0, tx: 0, ty: 0 };

      routeMidpoint(route, m);

      expect(m.x).to.be.closeTo(50, 1e-9);
      expect(m.y).to.be.closeTo(0, 1e-9);
      // tangent runs between the middle controls
      expect(Math.atan2(m.ty, m.tx)).to.be.closeTo(Math.atan2(-80, 35), 1e-9);
    });

    it('midpoint: odd control counts take Q(0.5) of the middle piece', function () {
      const route = evalWith(CURVE_MULTI, [EDGE_DIST_INTERSECTION, 40, 0.5], 1);
      const m = { x: 0, y: 0, tx: 0, ty: 0 };
      const p = { x: 0, y: 0 };

      routeMidpoint(route, m);
      routeVertex(route, CURVE_SEGS / 2, p); // t = 0.5 of the single piece

      expect(m.x).to.be.closeTo(p.x, 1e-9);
      expect(m.y).to.be.closeTo(p.y, 1e-9);
    });
  });

  describe('segments (CURVE_SEGMENTS)', function () {
    // mode, round, then (d, w, r, arc) per point
    const sharpBlob = [
      EDGE_DIST_INTERSECTION,
      0,
      30,
      0.25,
      0,
      0,
      30,
      0.75,
      0,
      0,
    ];

    it('places segment points on the weighted frame + normal offset', function () {
      const route = evalWith(CURVE_SEGMENTS, sharpBlob, 2);

      expect(route.qx[1]).to.be.closeTo(32.5, 1e-9);
      expect(route.qy[1]).to.be.closeTo(30, 1e-9);
      expect(route.qx[2]).to.be.closeTo(67.5, 1e-9);
      expect(route.qy[2]).to.be.closeTo(30, 1e-9);
      expect(route.round).to.be.false;
    });

    it('sharp legs land segment points exactly on subdivision indices', function () {
      const route = evalWith(CURVE_SEGMENTS, sharpBlob, 2);
      const p = { x: 0, y: 0 };

      // P = 3 equal legs keep the uniform split, and every piece
      // boundary lands exactly on a subdivision index — segEnd holds
      // those indices at any budget
      allocRouteQuads(route);
      routeVertex(route, route.segEnd[0], p);
      expect(p.x).to.be.closeTo(32.5, 1e-9);
      expect(p.y).to.be.closeTo(30, 1e-9);

      routeVertex(route, route.segEnd[1], p);
      expect(p.x).to.be.closeTo(67.5, 1e-9);
      expect(p.y).to.be.closeTo(30, 1e-9);
    });

    it('midpoint: even point counts average the middle points', function () {
      const route = evalWith(CURVE_SEGMENTS, sharpBlob, 2);
      const m = { x: 0, y: 0, tx: 0, ty: 0 };

      routeMidpoint(route, m);
      expect(m.x).to.be.closeTo(50, 1e-9);
      expect(m.y).to.be.closeTo(30, 1e-9);
      expect(m.ty).to.be.closeTo(0, 1e-9);
    });

    it('midpoint: odd sharp counts take the middle point, tangent into it', function () {
      const route = evalWith(
        CURVE_SEGMENTS,
        [EDGE_DIST_INTERSECTION, 0, 30, 0.5, 0, 0],
        1,
      );
      const m = { x: 0, y: 0, tx: 0, ty: 0 };

      routeMidpoint(route, m);
      expect(m.x).to.be.closeTo(50, 1e-9);
      expect(m.y).to.be.closeTo(30, 1e-9);
      // tangent from the start boundary point into the middle point
      expect(m.tx).to.be.closeTo(50 - route.qx[0], 1e-9);
      expect(m.ty).to.be.closeTo(30 - route.qy[0], 1e-9);
    });

    describe('round segments', function () {
      const roundBlob = [
        EDGE_DIST_INTERSECTION,
        1,
        30,
        0.25,
        8,
        1,
        30,
        0.75,
        8,
        1,
      ];

      it('arc pieces sample the corner circle exactly', function () {
        const route = evalWith(CURVE_SEGMENTS, roundBlob, 2);

        expect(route.round).to.be.true;

        // P = 5 pieces (leg arc leg arc leg); find an arc-piece index
        const out = { piece: 0, t: 0 };
        const p = { x: 0, y: 0 };
        const corner = computeCorner(
          emptyRouteCorner(),
          route.qx[0],
          route.qy[0],
          route.qx[1],
          route.qy[1],
          route.qx[2],
          route.qy[2],
          8,
          true,
        );

        for (let idx = 0; idx <= CURVE_SEGS; idx++) {
          routeQuadPiece(route, idx, out);

          if (out.piece === 1) {
            // the first corner's arc
            routeVertex(route, idx, p);

            const dist = Math.hypot(p.x - corner.cx, p.y - corner.cy);

            expect(dist).to.be.closeTo(corner.r, 1e-9);
          }
        }
      });

      it('legs join the corner start/stop points', function () {
        const route = evalWith(CURVE_SEGMENTS, roundBlob, 2);
        const p = { x: 0, y: 0 };
        const corner = computeCorner(
          emptyRouteCorner(),
          route.qx[0],
          route.qy[0],
          route.qx[1],
          route.qy[1],
          route.qx[2],
          route.qy[2],
          8,
          true,
        );

        // P=5, bend-weighted (round 93): the straight legs take one
        // quad each and the two equal corners split the leftover, so
        // piece 1 (the first arc) spans segEnd[0]..segEnd[1] — derived
        // from the allocator so the spec holds at any budget
        allocRouteQuads(route);
        expect(route.segEnd[0]).to.equal(1); // the first leg keeps 1 quad
        routeVertex(route, route.segEnd[0], p);
        expect(p.x).to.be.closeTo(corner.startX, 1e-9);
        expect(p.y).to.be.closeTo(corner.startY, 1e-9);

        routeVertex(route, route.segEnd[1], p);
        expect(p.x).to.be.closeTo(corner.stopX, 1e-9);
        expect(p.y).to.be.closeTo(corner.stopY, 1e-9);
      });

      it('odd round midpoints sit on the arc apex with the arc tangent', function () {
        const route = evalWith(
          CURVE_SEGMENTS,
          [EDGE_DIST_INTERSECTION, 1, 30, 0.5, 8, 1],
          1,
        );
        const m = { x: 0, y: 0, tx: 0, ty: 0 };
        const corner = computeCorner(
          emptyRouteCorner(),
          route.qx[0],
          route.qy[0],
          route.qx[1],
          route.qy[1],
          route.qx[2],
          route.qy[2],
          8,
          true,
        );

        routeMidpoint(route, m);

        const dist = Math.hypot(m.x - corner.cx, m.y - corner.cy);

        expect(dist).to.be.closeTo(corner.r, 1e-9);
        // tangent perpendicular to the radial direction
        const dot = (m.x - corner.cx) * m.tx + (m.y - corner.cy) * m.ty;

        expect(dot).to.be.closeTo(0, 1e-9);
      });
    });
  });

  describe('taxi (CURVE_TAXI)', function () {
    // 30x30 outer nodes (halves 15)
    const nodes = (sx, sy, tx, ty) => [
      sx,
      sy,
      15,
      15,
      SHAPE_CIRCLE,
      tx,
      ty,
      15,
      15,
      SHAPE_CIRCLE,
    ];

    it('ideal vertical routing with a percent turn (v3 values)', function () {
      const route = evalWith(CURVE_TAXI, taxiBlob(), 0, nodes(0, 0, 10, 200));

      // dy = 200 - 30 = 170; d = 0.5*170 = 85; y = 0 + 85 + 15 = 100
      expect(route.n).to.equal(2);
      expect(route.qx[1]).to.equal(0);
      expect(route.qy[1]).to.equal(100);
      expect(route.qx[2]).to.equal(10);
      expect(route.qy[2]).to.equal(100);
    });

    it('pixel turns offset from the source side', function () {
      const route = evalWith(
        CURVE_TAXI,
        taxiBlob({ turn: 20, pct: 0 }),
        0,
        nodes(0, 0, 10, 200),
      );

      expect(route.qy[1]).to.equal(35); // 0 + 20 + 15
    });

    it('negative pixel turns measure from the target side', function () {
      const route = evalWith(
        CURVE_TAXI,
        taxiBlob({ turn: -20, pct: 0 }),
        0,
        nodes(0, 0, 10, 200),
      );

      // k = l = 170; d = 170 - 20 = 150; y = 150 + 15 = 165
      expect(route.qy[1]).to.equal(165);
    });

    it('auto direction picks the dominant axis', function () {
      const route = evalWith(CURVE_TAXI, taxiBlob(), 0, nodes(0, 0, 200, 10));

      // horizontal: dx = 170, d = 85, x = 85 + 15 = 100
      expect(route.qy[1]).to.equal(0);
      expect(route.qx[1]).to.equal(100);
      expect(route.qy[2]).to.equal(10);
    });

    it('too-close turns fall back to the Z-shape', function () {
      const route = evalWith(CURVE_TAXI, taxiBlob(), 0, nodes(0, 0, 10, 40));

      // dy = 10, d = 5 < minD 10 => vertical fallback; |pdx| = 10 <= 15
      // => vertical Z at y = (0+40)/2
      expect(route.n).to.equal(2);
      expect(route.qx[1]).to.equal(0);
      expect(route.qy[1]).to.equal(20);
      expect(route.qx[2]).to.equal(10);
      expect(route.qy[2]).to.equal(20);
    });

    it('far-off fallbacks take the L-shape', function () {
      const route = evalWith(
        CURVE_TAXI,
        taxiBlob({ dir: TAXI_VERTICAL, turn: 5, pct: 0 }),
        0,
        nodes(0, 0, 100, 200),
      );

      // d = 5 < minD; neither Z-shape applies => L at (x1, y2)
      expect(route.n).to.equal(1);
      expect(route.qx[1]).to.equal(0);
      expect(route.qy[1]).to.equal(200);
    });

    it('explicit downward against the delta forces the direction (v3 growth)', function () {
      const route = evalWith(
        CURVE_TAXI,
        taxiBlob({ dir: TAXI_DOWNWARD, turn: 20, pct: 0 }),
        0,
        nodes(0, 0, 0, -200),
      );

      // pl = -200 < 0 with DOWNWARD => sgnL flips to +1, route grows downward
      expect(route.qy[1]).to.equal(35); // 0 + 20*1 + 15*1
      expect(route.qx[1]).to.equal(0);
    });

    it('round-taxi fills radius and arc mode per point', function () {
      const route = evalWith(
        CURVE_TAXI,
        taxiBlob({ round: 1, radius: 12 }),
        0,
        nodes(0, 0, 10, 200),
      );

      expect(route.round).to.be.true;
      expect(route.radius[0]).to.equal(12);
      expect(route.radius[1]).to.equal(12);
      expect(route.arcMode[0]).to.equal(1);
    });

    it('taxi endpoints launch along the first/last leg', function () {
      const route = evalWith(CURVE_TAXI, taxiBlob(), 0, nodes(0, 0, 10, 200));

      // boundary toward (0, 100): straight down from the source center
      expect(route.qx[0]).to.be.closeTo(0, 1e-9);
      expect(route.qy[0]).to.be.closeTo(15, 1e-9);
    });
  });

  describe('flattenRoute', function () {
    it('starts and ends on the boundary endpoints', function () {
      const route = evalWith(
        CURVE_SEGMENTS,
        [EDGE_DIST_INTERSECTION, 0, 30, 0.25, 0, 0, 30, 0.75, 0, 0],
        2,
      );
      const pts = flattenRoute(route);

      expect(pts[0]).to.be.closeTo(route.qx[0], 1e-12);
      expect(pts[1]).to.be.closeTo(route.qy[0], 1e-12);
      expect(pts[pts.length - 2]).to.be.closeTo(route.qx[3], 1e-12);
      expect(pts[pts.length - 1]).to.be.closeTo(route.qy[3], 1e-12);
    });

    it('arcSweep follows the canvas arc direction', function () {
      expect(arcSweep(0, Math.PI / 2, false)).to.be.closeTo(Math.PI / 2, 1e-12);
      expect(arcSweep(0, Math.PI / 2, true)).to.be.closeTo(
        (-3 * Math.PI) / 2,
        1e-12,
      );
      expect(arcSweep(Math.PI / 2, 0, true)).to.be.closeTo(-Math.PI / 2, 1e-12);
    });
  });

  describe('caps', function () {
    it('MAX_CURVE_PTS keeps round routes within the strip subdivision', function () {
      expect(2 * MAX_CURVE_PTS + 1).to.be.at.most(CURVE_SEGS);
    });
  });
});
