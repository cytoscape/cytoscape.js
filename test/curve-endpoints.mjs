import { expect } from 'chai';
import {
  EDGE_DIST_INTERSECTION, EDGE_DIST_ENDPOINTS,
  ENDPT_DEFAULT, ENDPT_INSIDE, ENDPT_LINE, ENDPT_POINT, ENDPT_ANGLE,
  ENDPT_PCT_X, ENDPT_PCT_Y, ENDPT_BLOCK_FLOATS,
  TAXI_AUTO,
  emptyCurveRoute, emptyCurveEval, evalRoute, evalCurve, routeMidpoint,
  haystackPoint, haystackAngle
} from '../src/curve-geometry.mjs';
import {
  CURVE_BEZIER, CURVE_MULTI, CURVE_SEGMENTS, CURVE_TAXI, CURVE_HAS_ENDPT, SHAPE_CIRCLE
} from '../src/contract.mjs';

// two circle nodes on the x axis: an exactly hand-derivable frame
// (si = (15, 0), ti = (85, 0), normal = (0, 1))
const CIRCLES = [ 0, 0, 15, 15, SHAPE_CIRCLE, 100, 0, 15, 15, SHAPE_CIRCLE ];

/** a 10-float endpoint block from per-end specs */
const block = ( src = {}, tgt = {} ) => {
  const end = ( s ) => [
    s.mode ?? ENDPT_DEFAULT, s.a ?? 0, s.b ?? 0, s.pct ?? 0, s.dist ?? 0
  ];

  return [ ...end( src ), ...end( tgt ) ];
};

const evalWith = ( kind, blob, n, nodes = CIRCLES ) => {
  const route = emptyCurveRoute();

  return evalRoute( route, kind, blob, 0, n, ...nodes );
};

/** circle-boundary point of the node at (cx, cy) r=15 toward (tx, ty) */
const onCircle = ( cx, cy, tx, ty, r = 15 ) => {
  const dx = tx - cx;
  const dy = ty - cy;
  const l = Math.sqrt( dx * dx + dy * dy );

  return { x: cx + dx / l * r, y: cy + dy / l * r };
};

describe('gpu/curve-endpoints: 12c manual endpoints + haystack', function(){

  describe('straight + endpoints (CURVE_MULTI n = 0, the chord)', function(){

    it('resolves a px point endpoint verbatim and aims the other end at it', function(){
      // src: manual point (10, -5); tgt: default boundary
      const r = evalWith(
        CURVE_MULTI + CURVE_HAS_ENDPT,
        [ ...block( { mode: ENDPT_POINT, a: 10, b: -5 } ), EDGE_DIST_INTERSECTION ], 0 );

      expect( r.n ).to.equal( 0 );
      expect( r.qx[ 0 ] ).to.be.closeTo( 10, 1e-9 );
      expect( r.qy[ 0 ] ).to.be.closeTo( -5, 1e-9 );

      // the target end aims at the source's *raw* manual point (v3's
      // lines path), so its boundary point is toward (10, -5)
      const e = onCircle( 100, 0, 10, -5 );

      expect( r.qx[ 1 ] ).to.be.closeTo( e.x, 1e-6 );
      expect( r.qy[ 1 ] ).to.be.closeTo( e.y, 1e-6 );
    });

    it('percent points scale by the outer width/height (v3 % units)', function(){
      // 50% of outer width = 0.5 · 2 · 15 = 15 → exactly the boundary
      const r = evalWith(
        CURVE_MULTI + CURVE_HAS_ENDPT,
        [ ...block( { mode: ENDPT_POINT, a: 0.5, b: 0, pct: ENDPT_PCT_X | ENDPT_PCT_Y } ),
          EDGE_DIST_INTERSECTION ], 0 );

      expect( r.qx[ 0 ] ).to.be.closeTo( 15, 1e-9 );
      expect( r.qy[ 0 ] ).to.be.closeTo( 0, 1e-9 );
    });

    it('mixed units: px x with percent y', function(){
      const r = evalWith(
        CURVE_MULTI + CURVE_HAS_ENDPT,
        [ ...block( { mode: ENDPT_POINT, a: 7, b: 0.25, pct: ENDPT_PCT_Y } ),
          EDGE_DIST_INTERSECTION ], 0 );

      expect( r.qx[ 0 ] ).to.be.closeTo( 7, 1e-9 );
      expect( r.qy[ 0 ] ).to.be.closeTo( 0.25 * 2 * 15, 1e-9 );
    });

    it('angle endpoints sit on the boundary along the ray', function(){
      // effective angle 0 → +x boundary; π/2 → +y boundary
      const r = evalWith(
        CURVE_MULTI + CURVE_HAS_ENDPT,
        [ ...block( { mode: ENDPT_ANGLE, a: Math.PI / 2 } ), EDGE_DIST_INTERSECTION ], 0 );

      expect( r.qx[ 0 ] ).to.be.closeTo( 0, 1e-6 );
      expect( r.qy[ 0 ] ).to.be.closeTo( 15, 1e-6 );
    });

    it('inside-to-node is the node center', function(){
      const r = evalWith(
        CURVE_MULTI + CURVE_HAS_ENDPT,
        [ ...block( { mode: ENDPT_INSIDE } ), EDGE_DIST_INTERSECTION ], 0 );

      expect( r.qx[ 0 ] ).to.equal( 0 );
      expect( r.qy[ 0 ] ).to.equal( 0 );
    });

    it('outside-to-line takes the intersection-frame point', function(){
      const r = evalWith(
        CURVE_MULTI + CURVE_HAS_ENDPT,
        [ ...block( { mode: ENDPT_LINE }, { mode: ENDPT_LINE } ), EDGE_DIST_INTERSECTION ], 0 );

      expect( r.qx[ 0 ] ).to.be.closeTo( 15, 1e-6 );
      expect( r.qy[ 0 ] ).to.be.closeTo( 0, 1e-6 );
      expect( r.qx[ 1 ] ).to.be.closeTo( 85, 1e-6 );
      expect( r.qy[ 1 ] ).to.be.closeTo( 0, 1e-6 );
    });

    it('distance-from-node shortens toward the aim (v3 shortenIntersection)', function(){
      const r = evalWith(
        CURVE_MULTI + CURVE_HAS_ENDPT,
        [ ...block( { dist: 5 }, { dist: 3 } ), EDGE_DIST_INTERSECTION ], 0 );

      // default boundaries (15, 0) / (85, 0), aims at the opposite centers
      expect( r.qx[ 0 ] ).to.be.closeTo( 20, 1e-6 );
      expect( r.qy[ 0 ] ).to.be.closeTo( 0, 1e-6 );
      expect( r.qx[ 1 ] ).to.be.closeTo( 82, 1e-6 );
      expect( r.qy[ 1 ] ).to.be.closeTo( 0, 1e-6 );
    });

    it('a distance past the aim clamps just short of it (v3 lenRatio floor)', function(){
      const r = evalWith(
        CURVE_MULTI + CURVE_HAS_ENDPT,
        [ ...block( { dist: 1e5 } ), EDGE_DIST_INTERSECTION ], 0 );

      // aim is the target center (100, 0); the clamp leaves it 1e-5 of
      // the way back from the aim
      expect( r.qx[ 0 ] ).to.be.closeTo( 100, 1e-2 );
      expect( r.qx[ 0 ] ).to.be.lessThan( 100 );
    });

    it('routeMidpoint of the chord is the endpoint average', function(){
      const r = evalWith(
        CURVE_MULTI + CURVE_HAS_ENDPT,
        [ ...block( { mode: ENDPT_POINT, a: 0, b: 10 }, { mode: ENDPT_POINT, a: 0, b: 10 } ),
          EDGE_DIST_INTERSECTION ], 0 );
      const mid = { x: 0, y: 0, tx: 0, ty: 0 };

      routeMidpoint( r, mid );
      expect( mid.x ).to.be.closeTo( 50, 1e-9 );
      expect( mid.y ).to.be.closeTo( 10, 1e-9 );
      expect( mid.ty ).to.be.closeTo( 0, 1e-9 );
    });
  });

  describe('curved families + endpoints', function(){

    it('a promoted bundled bezier (MULTI n = 1) matches the 12a analytic curve', function(){
      const d = 30;
      const w = 0.5;
      const flagged = evalWith(
        CURVE_MULTI + CURVE_HAS_ENDPT,
        [ ...block(), EDGE_DIST_INTERSECTION, d, w ], 1 );
      const analytic = evalCurve(
        emptyCurveEval(), CURVE_BEZIER, d, w, 0, ...CIRCLES );

      // same control point and same boundary endpoints
      expect( flagged.qx[ 1 ] ).to.be.closeTo( analytic.c1x, 1e-5 );
      expect( flagged.qy[ 1 ] ).to.be.closeTo( analytic.c1y, 1e-5 );
      expect( flagged.qx[ 0 ] ).to.be.closeTo( analytic.sx, 1e-5 );
      expect( flagged.qy[ 0 ] ).to.be.closeTo( analytic.sy, 1e-5 );
      expect( flagged.qx[ 2 ] ).to.be.closeTo( analytic.ex, 1e-5 );
      expect( flagged.qy[ 2 ] ).to.be.closeTo( analytic.ey, 1e-5 );
    });

    it('segments keep their interior points; only the ends resolve manually', function(){
      const plain = evalWith(
        CURVE_SEGMENTS,
        [ EDGE_DIST_INTERSECTION, 0, 20, 0.5, 0, 0 ], 1 );
      const flagged = evalWith(
        CURVE_SEGMENTS + CURVE_HAS_ENDPT,
        [ ...block( { mode: ENDPT_POINT, a: -5, b: -5 } ),
          EDGE_DIST_INTERSECTION, 0, 20, 0.5, 0, 0 ], 1 );

      expect( flagged.qx[ 1 ] ).to.be.closeTo( plain.qx[ 1 ], 1e-9 );
      expect( flagged.qy[ 1 ] ).to.be.closeTo( plain.qy[ 1 ], 1e-9 );
      expect( flagged.qx[ 0 ] ).to.be.closeTo( -5, 1e-9 );
      expect( flagged.qy[ 0 ] ).to.be.closeTo( -5, 1e-9 );
      // the target end still resolves toward the interior point
      expect( flagged.qx[ 2 ] ).to.be.closeTo( plain.qx[ 2 ], 1e-9 );
    });

    it('edge-distances: endpoints re-bases the frame on the manual anchors', function(){
      // both ends manual points 20 above the centers; d = 10, w = 0.5:
      // base = (0, 20) → (100, 20), normal = (0, 1), ctrl = (50, 30)
      const r = evalWith(
        CURVE_MULTI + CURVE_HAS_ENDPT,
        [ ...block(
          { mode: ENDPT_POINT, a: 0, b: 20 },
          { mode: ENDPT_POINT, a: 0, b: 20 } ),
          EDGE_DIST_ENDPOINTS, 10, 0.5 ], 1 );

      expect( r.qx[ 1 ] ).to.be.closeTo( 50, 1e-6 );
      expect( r.qy[ 1 ] ).to.be.closeTo( 30, 1e-6 );
      expect( r.qx[ 0 ] ).to.be.closeTo( 0, 1e-9 );
      expect( r.qy[ 0 ] ).to.be.closeTo( 20, 1e-9 );
    });

    it('taxi applies distances while keeping default endpoint modes', function(){
      // vertical-ish taxi: auto direction picks vert for this layout
      const nodes = [ 0, 0, 15, 15, SHAPE_CIRCLE, 0, 100, 15, 15, SHAPE_CIRCLE ];
      const plain = evalWith(
        CURVE_TAXI,
        [ TAXI_AUTO, 0.5, 1, 10, EDGE_DIST_INTERSECTION, 0, 0, 1 ], 0, nodes );
      const flagged = evalWith(
        CURVE_TAXI + CURVE_HAS_ENDPT,
        [ ...block( { dist: 5 } ),
          TAXI_AUTO, 0.5, 1, 10, EDGE_DIST_INTERSECTION, 0, 0, 1 ], 0, nodes );

      // same routing points
      expect( flagged.n ).to.equal( plain.n );
      expect( flagged.qx[ 1 ] ).to.be.closeTo( plain.qx[ 1 ], 1e-9 );

      // source endpoint shortened 5 px along the first leg (downward)
      expect( flagged.qy[ 0 ] ).to.be.closeTo( plain.qy[ 0 ] + 5, 1e-6 );
      expect( flagged.qx[ 0 ] ).to.be.closeTo( plain.qx[ 0 ], 1e-6 );
    });
  });

  describe('haystack (12c)', function(){

    it('haystackPoint offsets by cos/sin · outerHalf · radius', function(){
      const p = { x: 0, y: 0 };

      haystackPoint( 10, 20, 15, 25, 0, 0.5, p );
      expect( p.x ).to.be.closeTo( 10 + 15 * 0.5, 1e-9 );
      expect( p.y ).to.be.closeTo( 20, 1e-9 );

      haystackPoint( 10, 20, 15, 25, Math.PI / 2, 1, p );
      expect( p.x ).to.be.closeTo( 10, 1e-9 );
      expect( p.y ).to.be.closeTo( 45, 1e-9 );
    });

    it('haystackAngle is deterministic, end-distinct and in [0, 2π)', function(){
      const a1 = haystackAngle( 12345, false );
      const a2 = haystackAngle( 12345, false );
      const b1 = haystackAngle( 12345, true );
      const c1 = haystackAngle( 54321, false );

      expect( a1 ).to.equal( a2 );
      expect( a1 ).to.not.equal( b1 );
      expect( a1 ).to.not.equal( c1 );

      for( const a of [ a1, b1, c1 ] ){
        expect( a ).to.be.at.least( 0 );
        expect( a ).to.be.below( 2 * Math.PI );
      }
    });

    it('a radius-0 haystack point is the node center', function(){
      const p = { x: -1, y: -1 };

      haystackPoint( 7, 9, 15, 15, 1.234, 0, p );
      expect( p.x ).to.equal( 7 );
      expect( p.y ).to.equal( 9 );
    });
  });

  it('the endpoint block is 10 floats (the WGSL twin depends on it)', function(){
    expect( block().length ).to.equal( ENDPT_BLOCK_FLOATS );
  });
});
