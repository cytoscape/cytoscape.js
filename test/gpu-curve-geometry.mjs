import { expect } from 'chai';
import {
  AVOID_IMPOSSIBLE_BEZIER_L, CURVE_SEGS,
  boundaryOffset, bundleOffset, curveDeviation, curvePointAt, emptyCurveEval,
  evalCurve, flattenCurve, loopAngles, loopRadius
} from '../src/gpu/curve-geometry.mjs';
import {
  CURVE_BEZIER, CURVE_LOOP, CURVE_STRAIGHT,
  SHAPE_CIRCLE, SHAPE_ELLIPSE, SHAPE_RECTANGLE
} from '../src/gpu/contract.mjs';

// the expectations below are hand-derived from v3's formulas in
// src/extensions/renderer/base/coord-ele-math/edge-control-points.mts
// (bundle stagger, loop construction, the intersection frame and the
// impossible-bezier clamp), so this suite pins the port to v3's math

const close = ( a, b, eps = 1e-6 ) => expect( a ).to.be.closeTo( b, eps );

describe('gpu/curve-geometry', function(){

  describe('bundleOffset (v3 stagger)', function(){
    it('staggers a 3-bundle symmetrically about zero', function(){
      expect( bundleOffset(3, 0, 40) ).to.equal(-40);
      expect( bundleOffset(3, 1, 40) ).to.equal(0);
      expect( bundleOffset(3, 2, 40) ).to.equal(40);
    });

    it('staggers a 2-bundle at half steps', function(){
      expect( bundleOffset(2, 0, 40) ).to.equal(-20);
      expect( bundleOffset(2, 1, 40) ).to.equal(20);
    });

    it('puts a lone edge at zero (the straight-middle rule input)', function(){
      expect( bundleOffset(1, 0, 40) ).to.equal(0);
    });
  });

  describe('loop angles + radius (v3 construction)', function(){
    it('computes the default -45deg/-90deg loop rays', function(){
      const { out, in: inn } = loopAngles(-Math.PI / 4, -Math.PI / 2);

      close( out, -Math.PI / 2 );
      close( inn, -Math.PI );
    });

    it('scales the radius by 1.4 x step x (j/3 + 1)', function(){
      close( loopRadius(40, 0), 56 );
      close( loopRadius(40, 1), 1.4 * 40 * (4 / 3) );
    });
  });

  describe('boundaryOffset', function(){
    it('is the radius for circles', function(){
      close( boundaryOffset(SHAPE_CIRCLE, 15, 15, 1, 0), 15 );
      close( boundaryOffset(SHAPE_CIRCLE, 15, 15, Math.SQRT1_2, Math.SQRT1_2), 15 );
    });

    it('is exact for ellipses along the axes and diagonals', function(){
      close( boundaryOffset(SHAPE_ELLIPSE, 20, 10, 1, 0), 20 );
      close( boundaryOffset(SHAPE_ELLIPSE, 20, 10, 0, 1), 10 );

      const d = Math.SQRT1_2;
      const expected = 1 / Math.sqrt( (d / 20) ** 2 + (d / 10) ** 2 );

      close( boundaryOffset(SHAPE_ELLIPSE, 20, 10, d, d), expected, 1e-4 );
    });

    it('treats rectangles as their box', function(){
      close( boundaryOffset(SHAPE_RECTANGLE, 20, 10, 1, 0), 20 );
      close( boundaryOffset(SHAPE_RECTANGLE, 20, 10, 0, -1), 10 );

      const d = Math.SQRT1_2;

      close( boundaryOffset(SHAPE_RECTANGLE, 20, 10, d, d), 10 / d, 1e-4 );
    });
  });

  describe('evalCurve: bundled bezier', function(){
    const ev = emptyCurveEval();

    it('offsets the control point perpendicular from the intersection midpoint', function(){
      // circles r15 at (0,0) and (100,0): srcI (15,0), tgtI (85,0),
      // perp (0,1) -> ctrl (50, 40) at d = 40, w = 0.5
      evalCurve( ev, CURVE_BEZIER, 40, 0.5, 0,
        0, 0, 15, 15, SHAPE_CIRCLE, 100, 0, 15, 15, SHAPE_CIRCLE );

      close( ev.c1x, 50 );
      close( ev.c1y, 40 );

      // endpoints on the circle boundary toward the ctrl point
      const dirL = Math.sqrt( 50 * 50 + 40 * 40 );

      close( ev.sx, 15 * 50 / dirL, 1e-4 );
      close( ev.sy, 15 * 40 / dirL, 1e-4 );
      close( ev.ex, 100 - 15 * 50 / dirL, 1e-4 );
      close( ev.ey, 15 * 40 / dirL, 1e-4 );

      // midpoint = Q(0.5)
      close( ev.mx, 50, 1e-4 );
      close( ev.my, 0.5 * 40 + 0.5 * ( 15 * 40 / dirL ), 1e-4 );
    });

    it('applies control-point-weight along the intersection line', function(){
      evalCurve( ev, CURVE_BEZIER, 40, 0.25, 0,
        0, 0, 15, 15, SHAPE_CIRCLE, 100, 0, 15, 15, SHAPE_CIRCLE );

      close( ev.c1x, 15 + 70 * 0.25 );
      close( ev.c1y, 40 );
    });

    it('lands on the same world control point from either edge direction', function(){
      // the pair-orientation sign flip (sigma) is baked into d by the
      // store; the frames of antiparallel edges are mirrored, so
      // (frame flipped) x (d negated) = the same world point — v3's
      // swappedpairInfo invariant
      const fwd = emptyCurveEval();
      const rev = emptyCurveEval();

      evalCurve( fwd, CURVE_BEZIER, 40, 0.5, 0,
        0, 0, 15, 15, SHAPE_CIRCLE, 100, 0, 15, 15, SHAPE_CIRCLE );
      evalCurve( rev, CURVE_BEZIER, -40, 0.5, 0,
        100, 0, 15, 15, SHAPE_CIRCLE, 0, 0, 15, 15, SHAPE_CIRCLE );

      close( rev.c1x, fwd.c1x );
      close( rev.c1y, fwd.c1y );
    });

    it('clamps the impossible-bezier frame like v3', function(){
      // circles r15 at (0,0)/(30.05,0): the intersections nearly
      // coincide (dx = 0.05 < the clamp threshold), so l snaps to
      // sqrt(0.02) and the perpendicular shrinks rather than exploding
      evalCurve( ev, CURVE_BEZIER, 40, 0.5, 0,
        0, 0, 15, 15, SHAPE_CIRCLE, 30.05, 0, 15, 15, SHAPE_CIRCLE );

      const dx = 0.05;
      const l = AVOID_IMPOSSIBLE_BEZIER_L;

      expect( isFinite( ev.c1x ) && isFinite( ev.c1y ) ).to.equal(true);
      close( ev.c1y, 40 * ( dx / l ), 1e-3 );
    });
  });

  describe('evalCurve: self-loop', function(){
    const ev = emptyCurveEval();

    it('builds the two control points and boundary endpoints', function(){
      // circle r15 at (10,20), default -45deg/-90deg, r = 56:
      // rays at -90deg (up) and -180deg (left)
      evalCurve( ev, CURVE_LOOP, -Math.PI / 2, -Math.PI, 56,
        10, 20, 15, 15, SHAPE_CIRCLE, 10, 20, 15, 15, SHAPE_CIRCLE );

      close( ev.c1x, 10, 1e-4 );
      close( ev.c1y, 20 - 56, 1e-4 );
      close( ev.c2x, 10 - 56, 1e-4 );
      close( ev.c2y, 20, 1e-4 );

      close( ev.mx, ( 10 + 10 - 56 ) / 2, 1e-4 );
      close( ev.my, ( 20 - 56 + 20 ) / 2, 1e-4 );

      close( ev.sx, 10, 1e-4 );
      close( ev.sy, 5, 1e-4 );
      close( ev.ex, -5, 1e-4 );
      close( ev.ey, 20, 1e-4 );
    });

    it('is C1-continuous at the control midpoint', function(){
      const a = { x: 0, y: 0 };
      const b = { x: 0, y: 0 };
      const c = { x: 0, y: 0 };

      curvePointAt( ev, 0.5 - 1e-4, a );
      curvePointAt( ev, 0.5, b );
      curvePointAt( ev, 0.5 + 1e-4, c );

      close( b.x, ev.mx, 1e-6 );
      close( b.y, ev.my, 1e-6 );

      // tangent direction matches across the join
      const t1 = Math.atan2( b.y - a.y, b.x - a.x );
      const t2 = Math.atan2( c.y - b.y, c.x - b.x );

      close( t1, t2, 1e-3 );
    });
  });

  describe('curvePointAt + flattenCurve', function(){
    it('hits the endpoints and midpoint exactly', function(){
      const ev = emptyCurveEval();
      const p = { x: 0, y: 0 };

      evalCurve( ev, CURVE_BEZIER, 40, 0.5, 0,
        0, 0, 15, 15, SHAPE_CIRCLE, 100, 0, 15, 15, SHAPE_CIRCLE );

      curvePointAt( ev, 0, p );
      close( p.x, ev.sx );
      close( p.y, ev.sy );

      curvePointAt( ev, 1, p );
      close( p.x, ev.ex );
      close( p.y, ev.ey );

      curvePointAt( ev, 0.5, p );
      close( p.x, ev.mx );
      close( p.y, ev.my );
    });

    it('flattens to segs + 1 points at the drawn subdivision', function(){
      const ev = emptyCurveEval();

      evalCurve( ev, CURVE_BEZIER, 40, 0.5, 0,
        0, 0, 15, 15, SHAPE_CIRCLE, 100, 0, 15, 15, SHAPE_CIRCLE );

      const pts = flattenCurve( ev );

      expect( pts.length ).to.equal( ( CURVE_SEGS + 1 ) * 2 );
      close( pts[0], ev.sx );
      close( pts[1], ev.sy );
      close( pts[ pts.length - 2 ], ev.ex );
      close( pts[ pts.length - 1 ], ev.ey );
    });
  });

  describe('curveDeviation', function(){
    it('bounds by the control offset / loop radius', function(){
      expect( curveDeviation(CURVE_BEZIER, -40, 0) ).to.equal(40);
      expect( curveDeviation(CURVE_LOOP, 0, 56) ).to.equal(56);
      expect( curveDeviation(CURVE_STRAIGHT, 40, 56) ).to.equal(0);
    });
  });
});
