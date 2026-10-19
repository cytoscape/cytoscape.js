import { expect } from 'chai';
import {
  AVOID_IMPOSSIBLE_BEZIER_L,
  CURVE_SEGS,
  boundaryOffset,
  bundleOffset,
  curveDeviation,
  curvePointAt,
  emptyCurveEval,
  evalCurve,
  flattenCurve,
  loopAngles,
  loopRadius,
} from '../src/curve-geometry.mjs';
import {
  CURVE_BEZIER,
  CURVE_LOOP,
  CURVE_STRAIGHT,
  SHAPE_CIRCLE,
  SHAPE_ELLIPSE,
  SHAPE_RECTANGLE,
  SHAPE_ROUND_RECTANGLE,
  SHAPE_TRIANGLE,
} from '../src/contract.mjs';
// v3's leaf geometry, for the twin block below.  `v3/src/math.mts` has no
// runtime imports, so this stays safe for a root-only install — see the
// note on the twin describe().
import {
  generateUnitNgonPoints,
  generateUnitNgonPointsFitToSquare,
  intersectLineEllipse,
  polygonIntersectLine,
  roundRectangleIntersectLine,
} from '../v3/src/math.mjs';

// the expectations below are hand-derived from v3's formulas in
// src/extensions/renderer/base/coord-ele-math/edge-control-points.mts
// (bundle stagger, loop construction, the intersection frame and the
// impossible-bezier clamp), so this suite pins the port to v3's math

const close = (a, b, eps = 1e-6) => expect(a).to.be.closeTo(b, eps);

describe('gpu/curve-geometry', function () {
  describe('bundleOffset (v3 stagger)', function () {
    it('staggers a 3-bundle symmetrically about zero', function () {
      expect(bundleOffset(3, 0, 40)).to.equal(-40);
      expect(bundleOffset(3, 1, 40)).to.equal(0);
      expect(bundleOffset(3, 2, 40)).to.equal(40);
    });

    it('staggers a 2-bundle at half steps', function () {
      expect(bundleOffset(2, 0, 40)).to.equal(-20);
      expect(bundleOffset(2, 1, 40)).to.equal(20);
    });

    it('puts a lone edge at zero (the straight-middle rule input)', function () {
      expect(bundleOffset(1, 0, 40)).to.equal(0);
    });
  });

  describe('loop angles + radius (v3 construction)', function () {
    it('computes the default -45deg/-90deg loop rays', function () {
      const { out, in: inn } = loopAngles(-Math.PI / 4, -Math.PI / 2);

      close(out, -Math.PI / 2);
      close(inn, -Math.PI);
    });

    it('scales the radius by 1.4 x step x (j/3 + 1)', function () {
      close(loopRadius(40, 0), 56);
      close(loopRadius(40, 1), 1.4 * 40 * (4 / 3));
    });
  });

  describe('boundaryOffset', function () {
    it('is the radius for circles', function () {
      close(boundaryOffset(SHAPE_CIRCLE, 15, 15, 1, 0), 15);
      close(
        boundaryOffset(SHAPE_CIRCLE, 15, 15, Math.SQRT1_2, Math.SQRT1_2),
        15,
      );
    });

    it('is exact for ellipses along the axes and diagonals', function () {
      close(boundaryOffset(SHAPE_ELLIPSE, 20, 10, 1, 0), 20);
      close(boundaryOffset(SHAPE_ELLIPSE, 20, 10, 0, 1), 10);

      const d = Math.SQRT1_2;
      const expected = 1 / Math.sqrt((d / 20) ** 2 + (d / 10) ** 2);

      close(boundaryOffset(SHAPE_ELLIPSE, 20, 10, d, d), expected, 1e-4);
    });

    it('treats rectangles as their box', function () {
      close(boundaryOffset(SHAPE_RECTANGLE, 20, 10, 1, 0), 20);
      close(boundaryOffset(SHAPE_RECTANGLE, 20, 10, 0, -1), 10);

      const d = Math.SQRT1_2;

      close(boundaryOffset(SHAPE_RECTANGLE, 20, 10, d, d), 10 / d, 1e-4);
    });
  });

  // -- the v3 twin (round 55) -------------------------------------------------
  //
  // The block above pins v4's boundary offsets against numbers derived by
  // hand from v3's formulas.  This one pins them against v3's *code*, the
  // way `computeCorner` is already pinned against `getRoundCorner` below —
  // and it exists because `src/curve-geometry.mts`'s header describes an
  // approximation tier ("round-rectangles as their box, polygons as their
  // inscribed ellipse — a recorded deviation") in prose, with no number
  // anywhere saying how big the deviation is.  Here it is measured, so it
  // fails when it changes in either direction.
  //
  // v3's leaf math is import-safe from a root-only install: `v3/src/math.mts`
  // imports nothing at runtime (its one import is type-only), which is what
  // keeps `ci-node`'s no-v3-install invariant intact.  Do not reach for
  // v3's node-shapes registry here — that one is a renderer mixin and would
  // drag the whole browser renderer in.
  describe('boundaryOffset (v3 intersectLine twin)', function () {
    // v3's leaves answer with a *point* on the boundary of a shape centred
    // at (cx, cy), given an outside point to aim from.  v4 answers with the
    // distance along a unit direction.  This converts: walk far out along
    // the direction, ask v3 where the boundary is, and measure back.
    const FAR = 1e4;

    const v3Offset = (fn, dx, dy) => {
      const p = fn(FAR * dx, FAR * dy);

      if (p == null || p.length < 2) {
        return null;
      }

      return Math.sqrt(p[0] * p[0] + p[1] * p[1]);
    };

    // twelve directions, so a shape's corners and axes are both covered
    const DIRS = Array.from({ length: 12 }, (unused, i) => {
      const a = (i * Math.PI) / 6;

      return { a, dx: Math.cos(a), dy: Math.sin(a) };
    });

    const W = 40;
    const H = 24;

    it('matches v3 exactly for ellipses', function () {
      for (const { a, dx, dy } of DIRS) {
        const v3 = v3Offset(
          (x, y) => intersectLineEllipse(x, y, 0, 0, W / 2, H / 2),
          dx,
          dy,
        );

        expect(
          boundaryOffset(SHAPE_ELLIPSE, W / 2, H / 2, dx, dy),
          `ellipse at ${((a * 180) / Math.PI).toFixed(0)}deg`,
        ).to.be.closeTo(v3, 1e-9);
      }
    });

    it('matches v3 exactly for circles', function () {
      for (const { a, dx, dy } of DIRS) {
        const v3 = v3Offset(
          (x, y) => intersectLineEllipse(x, y, 0, 0, H / 2, H / 2),
          dx,
          dy,
        );

        expect(
          boundaryOffset(SHAPE_CIRCLE, H / 2, H / 2, dx, dy),
          `circle at ${((a * 180) / Math.PI).toFixed(0)}deg`,
        ).to.be.closeTo(v3, 1e-9);
      }
    });

    it('matches v3 exactly for rectangles', function () {
      // v3 builds `rectangle` as a generated polygon (node-shapes.mts:549,
      // a unit 4-gon fit to the square), so its leaf is polygonIntersectLine.
      // Note the call convention: v3 passes *half* extents (node-shapes.mts:36
      // — `width / 2, height / 2`), because polygonIntersectLine scales unit
      // base points by them.  Passing the full extents reads as a shape twice
      // the size, which is a silent 2x rather than an error.
      const square = generateUnitNgonPointsFitToSquare(4, 0);

      for (const { a, dx, dy } of DIRS) {
        const v3 = v3Offset(
          (x, y) => polygonIntersectLine(x, y, square, 0, 0, W / 2, H / 2, 0),
          dx,
          dy,
        );

        expect(
          boundaryOffset(SHAPE_RECTANGLE, W / 2, H / 2, dx, dy),
          `rectangle at ${((a * 180) / Math.PI).toFixed(0)}deg`,
        ).to.be.closeTo(v3, 1e-9);
      }
    });

    // The two approximation rows.  These assert a *band*, not a match: the
    // point is that the deviation is bounded and known, so shrinking it (a
    // fix) fails the spec just as loudly as growing it (a regression).
    it('approximates round-rectangles by their box, within a measured band', function () {
      let worst = 0;

      for (const { dx, dy } of DIRS) {
        const v3 = v3Offset(
          (x, y) => roundRectangleIntersectLine(x, y, 0, 0, W, H, 0, 'auto'),
          dx,
          dy,
        );

        if (v3 == null) {
          continue;
        }

        worst = Math.max(
          worst,
          Math.abs(
            boundaryOffset(SHAPE_ROUND_RECTANGLE, W / 2, H / 2, dx, dy) - v3,
          ),
        );
      }

      // measured 2026-08-06 on a 40x24 round-rectangle: **2.247 model px**
      // at the corners, where v4's box stands outside v3's rounded outline
      expect(worst, 'round-rectangle box-vs-outline deviation (model px)')
        .to.be.greaterThan(0.5)
        .and.to.be.lessThan(3);
    });

    it('approximates polygons by their inscribed ellipse, within a measured band', function () {
      const tri = generateUnitNgonPoints(3, 0);
      let worst = 0;

      for (const { dx, dy } of DIRS) {
        const v3 = v3Offset(
          (x, y) => polygonIntersectLine(x, y, tri, 0, 0, W / 2, H / 2, 0),
          dx,
          dy,
        );

        if (v3 == null) {
          continue;
        }

        worst = Math.max(
          worst,
          Math.abs(boundaryOffset(SHAPE_TRIANGLE, W / 2, H / 2, dx, dy) - v3),
        );
      }

      // a triangle is the worst case in v4's polygon tier: its inscribed
      // ellipse misses the apex and the two base corners by a wide margin —
      // measured **8.453 model px** on 40x24 — which is exactly why this is
      // recorded as a deviation rather than called a port.
      //
      // Control, run 2026-08-06: applying the *wrong* tier (the ellipse
      // formula against v3's rectangle, and the box formula against v3's
      // ellipse) reads 6.45 px on this fixture, against the 2e-13 the exact
      // rows above measure.  So those rows discriminate by ten orders of
      // magnitude, and these two bands sit well inside their bounds rather
      // than hugging one edge.
      expect(worst, 'triangle inscribed-ellipse deviation (model px)')
        .to.be.greaterThan(2)
        .and.to.be.lessThan(15);
    });
  });

  describe('evalCurve: bundled bezier', function () {
    const ev = emptyCurveEval();

    it('offsets the control point perpendicular from the intersection midpoint', function () {
      // circles r15 at (0,0) and (100,0): srcI (15,0), tgtI (85,0),
      // perp (0,1) -> ctrl (50, 40) at d = 40, w = 0.5
      evalCurve(
        ev,
        CURVE_BEZIER,
        40,
        0.5,
        0,
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

      close(ev.c1x, 50);
      close(ev.c1y, 40);

      // endpoints on the circle boundary toward the ctrl point
      const dirL = Math.sqrt(50 * 50 + 40 * 40);

      close(ev.sx, (15 * 50) / dirL, 1e-4);
      close(ev.sy, (15 * 40) / dirL, 1e-4);
      close(ev.ex, 100 - (15 * 50) / dirL, 1e-4);
      close(ev.ey, (15 * 40) / dirL, 1e-4);

      // midpoint = Q(0.5)
      close(ev.mx, 50, 1e-4);
      close(ev.my, 0.5 * 40 + 0.5 * ((15 * 40) / dirL), 1e-4);
    });

    it('applies control-point-weight along the intersection line', function () {
      evalCurve(
        ev,
        CURVE_BEZIER,
        40,
        0.25,
        0,
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

      close(ev.c1x, 15 + 70 * 0.25);
      close(ev.c1y, 40);
    });

    it('lands on the same world control point from either edge direction', function () {
      // the pair-orientation sign flip (sigma) is baked into d by the
      // store; the frames of antiparallel edges are mirrored, so
      // (frame flipped) x (d negated) = the same world point — v3's
      // swappedpairInfo invariant
      const fwd = emptyCurveEval();
      const rev = emptyCurveEval();

      evalCurve(
        fwd,
        CURVE_BEZIER,
        40,
        0.5,
        0,
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
      evalCurve(
        rev,
        CURVE_BEZIER,
        -40,
        0.5,
        0,
        100,
        0,
        15,
        15,
        SHAPE_CIRCLE,
        0,
        0,
        15,
        15,
        SHAPE_CIRCLE,
      );

      close(rev.c1x, fwd.c1x);
      close(rev.c1y, fwd.c1y);
    });

    it('clamps the impossible-bezier frame like v3', function () {
      // circles r15 at (0,0)/(30.05,0): the intersections nearly
      // coincide (dx = 0.05 < the clamp threshold), so l snaps to
      // sqrt(0.02) and the perpendicular shrinks rather than exploding
      evalCurve(
        ev,
        CURVE_BEZIER,
        40,
        0.5,
        0,
        0,
        0,
        15,
        15,
        SHAPE_CIRCLE,
        30.05,
        0,
        15,
        15,
        SHAPE_CIRCLE,
      );

      const dx = 0.05;
      const l = AVOID_IMPOSSIBLE_BEZIER_L;

      expect(isFinite(ev.c1x) && isFinite(ev.c1y)).to.equal(true);
      close(ev.c1y, 40 * (dx / l), 1e-3);
    });
  });

  describe('evalCurve: self-loop', function () {
    const ev = emptyCurveEval();

    it('builds the two control points and boundary endpoints', function () {
      // circle r15 at (10,20), default -45deg/-90deg, r = 56:
      // rays at -90deg (up) and -180deg (left)
      evalCurve(
        ev,
        CURVE_LOOP,
        -Math.PI / 2,
        -Math.PI,
        56,
        10,
        20,
        15,
        15,
        SHAPE_CIRCLE,
        10,
        20,
        15,
        15,
        SHAPE_CIRCLE,
      );

      close(ev.c1x, 10, 1e-4);
      close(ev.c1y, 20 - 56, 1e-4);
      close(ev.c2x, 10 - 56, 1e-4);
      close(ev.c2y, 20, 1e-4);

      close(ev.mx, (10 + 10 - 56) / 2, 1e-4);
      close(ev.my, (20 - 56 + 20) / 2, 1e-4);

      close(ev.sx, 10, 1e-4);
      close(ev.sy, 5, 1e-4);
      close(ev.ex, -5, 1e-4);
      close(ev.ey, 20, 1e-4);
    });

    it('is C1-continuous at the control midpoint', function () {
      const a = { x: 0, y: 0 };
      const b = { x: 0, y: 0 };
      const c = { x: 0, y: 0 };

      curvePointAt(ev, 0.5 - 1e-4, a);
      curvePointAt(ev, 0.5, b);
      curvePointAt(ev, 0.5 + 1e-4, c);

      close(b.x, ev.mx, 1e-6);
      close(b.y, ev.my, 1e-6);

      // tangent direction matches across the join
      const t1 = Math.atan2(b.y - a.y, b.x - a.x);
      const t2 = Math.atan2(c.y - b.y, c.x - b.x);

      close(t1, t2, 1e-3);
    });
  });

  describe('curvePointAt + flattenCurve', function () {
    it('hits the endpoints and midpoint exactly', function () {
      const ev = emptyCurveEval();
      const p = { x: 0, y: 0 };

      evalCurve(
        ev,
        CURVE_BEZIER,
        40,
        0.5,
        0,
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

      curvePointAt(ev, 0, p);
      close(p.x, ev.sx);
      close(p.y, ev.sy);

      curvePointAt(ev, 1, p);
      close(p.x, ev.ex);
      close(p.y, ev.ey);

      curvePointAt(ev, 0.5, p);
      close(p.x, ev.mx);
      close(p.y, ev.my);
    });

    it('flattens to segs + 1 points at the drawn subdivision', function () {
      const ev = emptyCurveEval();

      evalCurve(
        ev,
        CURVE_BEZIER,
        40,
        0.5,
        0,
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

      const pts = flattenCurve(ev);

      expect(pts.length).to.equal((CURVE_SEGS + 1) * 2);
      close(pts[0], ev.sx);
      close(pts[1], ev.sy);
      close(pts[pts.length - 2], ev.ex);
      close(pts[pts.length - 1], ev.ey);
    });
  });

  describe('curveDeviation', function () {
    it('bounds by the control offset / loop radius', function () {
      expect(curveDeviation(CURVE_BEZIER, -40, 0)).to.equal(40);
      expect(curveDeviation(CURVE_LOOP, 0, 56)).to.equal(56);
      expect(curveDeviation(CURVE_STRAIGHT, 40, 56)).to.equal(0);
    });
  });
});
