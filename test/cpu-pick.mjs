import { expect } from 'chai';
import { GraphStore } from '../src/store/graph-store.mjs';
import { pickNodeAt } from '../src/render/cpu-pick.mjs';
import {
  FLAG_VISIBLE, SHAPE_BARREL, SHAPE_BOTTOM_ROUND_RECTANGLE, SHAPE_CIRCLE,
  SHAPE_CUT_RECTANGLE, SHAPE_DIAMOND, SHAPE_ELLIPSE, SHAPE_HEXAGON,
  SHAPE_RECTANGLE, SHAPE_ROUND_HEXAGON, SHAPE_ROUND_RECTANGLE, SHAPE_STAR,
  SHAPE_TRIANGLE, SHAPE_VEE
} from '../src/contract.mjs';

describe('gpu/render: CPU node pick', function(){

  var store;
  var frame = { panXPx: 0, panYPx: 0, zoomDpr: 1, hidePx: 1, nodeLodPx: 3 };

  var addNode = function( id, x, y, w, h, shape ){
    var slot = store.addNode( id, x, y );

    store.setPair( 'node.size', slot, w, h );
    store.setScalar( 'node.shape', slot, shape );
    // the style engine always writes borderGeom on apply; mirror its
    // default here (corner-radius 'auto', border-position center — B2)
    store.setBorderGeom( slot, -1, 0, 0, 0, 0 );

    return slot;
  };

  beforeEach(function(){
    store = new GraphStore();
  });

  it('picks inside a circle and misses outside', function(){
    var n = addNode( 'a', 0, 0, 30, 30, SHAPE_CIRCLE );

    expect( pickNodeAt( store, frame, 10, 10 ) ).to.equal( n );  // r ≈ 14.1 ≤ 15
    expect( pickNodeAt( store, frame, 11, 11 ) ).to.equal( null ); // r ≈ 15.6 > 15
  });

  it('respects the ellipse extents', function(){
    var n = addNode( 'a', 0, 0, 40, 20, SHAPE_ELLIPSE );

    expect( pickNodeAt( store, frame, 19, 0 ) ).to.equal( n );
    expect( pickNodeAt( store, frame, 0, 9 ) ).to.equal( n );
    expect( pickNodeAt( store, frame, 15, 8 ) ).to.equal( null ); // outside the ellipse, inside the box
  });

  it('picks rectangle corners a circle would miss', function(){
    var n = addNode( 'a', 0, 0, 20, 10, SHAPE_RECTANGLE );

    expect( pickNodeAt( store, frame, 9.9, 4.9 ) ).to.equal( n );
    expect( pickNodeAt( store, frame, 9.9, 5.1 ) ).to.equal( null );
  });

  it('rounds round-rectangle corners off', function(){
    var n = addNode( 'a', 0, 0, 40, 40, SHAPE_ROUND_RECTANGLE ); // auto r = min(10, 10, 8) = 8 (B2, v3's rule)

    expect( pickNodeAt( store, frame, 0, 19 ) ).to.equal( n );       // edge midpoint
    expect( pickNodeAt( store, frame, 19.5, 19.5 ) ).to.equal( null ); // clipped corner
  });

  it('returns the topmost (highest-slot) node under the point', function(){
    addNode( 'a', 0, 0, 30, 30, SHAPE_CIRCLE );

    var b = addNode( 'b', 5, 0, 30, 30, SHAPE_CIRCLE );

    expect( pickNodeAt( store, frame, 3, 0 ) ).to.equal( b );
  });

  it('skips hidden nodes', function(){
    var a = addNode( 'a', 0, 0, 30, 30, SHAPE_CIRCLE );
    var b = addNode( 'b', 0, 0, 30, 30, SHAPE_CIRCLE );

    // the real hide path: clears FLAG_VISIBLE and the derived FLAG_DRAWN
    // (round 22 — the pick masks on ALIVE|DRAWN)
    store.setVisibility( [ store.ref( 'nodes', b ) ], false );

    expect( pickNodeAt( store, frame, 0, 0 ) ).to.equal( a );
  });

  it('skips removed nodes', function(){
    var a = addNode( 'a', 0, 0, 30, 30, SHAPE_CIRCLE );

    store.removeNode( a );

    expect( pickNodeAt( store, frame, 0, 0 ) ).to.equal( null );
  });

  it('floors sub-pixel nodes to hidePx for picking', function(){
    var n = addNode( 'a', 100, 100, 0.5, 0.5, SHAPE_CIRCLE );

    expect( pickNodeAt( store, frame, 100.3, 100.2 ) ).to.equal( n ); // within the 0.5 px floored radius
    expect( pickNodeAt( store, frame, 101.5, 100 ) ).to.equal( null );
  });

  it('collapses tiny nodes to plain discs (nodeLodPx), like rendering', function(){
    var n = addNode( 'a', 0, 0, 2, 1, SHAPE_ELLIPSE ); // 2 px < nodeLodPx

    // the ellipse test would miss (0, 0.9); the LOD disc (r = 1) hits it
    expect( pickNodeAt( store, frame, 0, 0.9 ) ).to.equal( n );
  });

  it('applies zoom and pan (device px)', function(){
    var n = addNode( 'a', 10, 10, 10, 10, SHAPE_CIRCLE );
    var zoomed = { panXPx: 5, panYPx: 5, zoomDpr: 2, hidePx: 1, nodeLodPx: 3 };

    expect( pickNodeAt( store, zoomed, 25, 25 ) ).to.equal( n ); // center: 10*2 + 5
    expect( pickNodeAt( store, zoomed, 10, 10 ) ).to.equal( null );
  });

  describe('polygon shapes (round 10)', function(){
    it('diamond picks its points and misses the square corners', function(){
      var n = addNode( 'a', 0, 0, 40, 40, SHAPE_DIAMOND );

      expect( pickNodeAt( store, frame, 0, 19 ) ).to.equal( n );
      expect( pickNodeAt( store, frame, 19, 0 ) ).to.equal( n );
      expect( pickNodeAt( store, frame, 10, 9 ) ).to.equal( n );   // |x|+|y| < 20
      expect( pickNodeAt( store, frame, 15, 15 ) ).to.equal( null ); // square corner, off the diamond
    });

    it('triangle misses its clipped top corners', function(){
      var n = addNode( 'a', 0, 0, 40, 40, SHAPE_TRIANGLE );

      expect( pickNodeAt( store, frame, 0, 0 ) ).to.equal( n ); // center
      // one horizontal edge of the box belongs to the triangle, the other
      // holds only one vertex: both box corners on some side must miss
      var missTop = pickNodeAt( store, frame, -19, -19 ) == null && pickNodeAt( store, frame, 19, -19 ) == null;
      var missBottom = pickNodeAt( store, frame, -19, 19 ) == null && pickNodeAt( store, frame, 19, 19 ) == null;

      expect( missTop || missBottom ).to.be.true;
    });

    it('vee has a notch a rectangle would hit', function(){
      var n = addNode( 'a', 0, 0, 40, 40, SHAPE_VEE );

      expect( pickNodeAt( store, frame, 0, 0 ) ).to.equal( n );      // inside the wedge
      expect( pickNodeAt( store, frame, 0, -10 ) ).to.equal( null ); // in the notch
    });

    it('star is concave between its spikes', function(){
      var n = addNode( 'a', 0, 0, 40, 40, SHAPE_STAR );

      expect( pickNodeAt( store, frame, 0, 0 ) ).to.equal( n );        // center
      expect( pickNodeAt( store, frame, 19, 19 ) ).to.equal( null );   // square corner
    });

    it('anisotropic hexagon picks in normalized space', function(){
      var n = addNode( 'a', 0, 0, 80, 20, SHAPE_HEXAGON );

      expect( pickNodeAt( store, frame, 0, 9 ) ).to.equal( n );    // mid-edge, tall axis
      expect( pickNodeAt( store, frame, 39, 9 ) ).to.equal( null ); // stretched corner clipped
    });
  });

  describe('round-27 shapes (28.1)', function(){

    /*
    Round 27 gave cpu-pick three new branches — cut-rectangle's chamfer
    (27.2), insideRoundPolygon (27.4) and insideBarrel (27.5).  The shader
    twins are pinned by live v3 parity diffs; these pin the CPU replica,
    which is a separate implementation of the same description.

    The cases target what is *particular* to each branch — the absolute
    (not size-relative) chamfer, the device-space rounding, the capped
    offsets — rather than re-checking that a shape has an inside.
    */

    var withRadius = function( id, w, h, shape, r ){
      var slot = store.addNode( id, 0, 0 );

      store.setPair( 'node.size', slot, w, h );
      store.setScalar( 'node.shape', slot, shape );
      store.setBorderGeom( slot, r, 0, 0, 0, 0 );

      return slot;
    };

    it('cut-rectangle chamfers by an absolute length, not a fraction of the node', function(){
      // 'auto' is a flat 8 model px at every size (v3's
      // getCutRectangleCornerLength), so the clipped corner keeps the same
      // 8 px legs as the node grows.  A unit point table — the thing this
      // shape is deliberately not — would scale the chamfer with the node.
      var small = addNode( 'small', 0, 0, 100, 100, SHAPE_CUT_RECTANGLE );

      expect( pickNodeAt( store, frame, 46, 46 ) ).to.equal( small );  // sum 92 = hw + hh - 8
      expect( pickNodeAt( store, frame, 49, 49 ) ).to.equal( null );   // sum 98, past the chamfer

      store = new GraphStore();

      var big = addNode( 'big', 0, 0, 400, 400, SHAPE_CUT_RECTANGLE );

      // still an 8 px chamfer: bound 392.  Scaled with the node it would
      // be 32 px (bound 368) and this point would miss.
      expect( pickNodeAt( store, frame, 195, 195 ) ).to.equal( big );
      expect( pickNodeAt( store, frame, 199, 199 ) ).to.equal( null );
    });

    it('cut-rectangle takes corner-radius as the chamfer length', function(){
      var n = withRadius( 'a', 100, 100, SHAPE_CUT_RECTANGLE, 30 );

      expect( pickNodeAt( store, frame, 30, 30 ) ).to.equal( n );    // sum 60 <= 70
      expect( pickNodeAt( store, frame, 40, 40 ) ).to.equal( null ); // sum 80 > 70

      store = new GraphStore();
      addNode( 'auto', 0, 0, 100, 100, SHAPE_CUT_RECTANGLE );

      // the control: under 'auto' (c = 8) that same point is inside, so
      // the explicit radius is what moved the boundary
      expect( pickNodeAt( store, frame, 40, 40 ) ).to.not.equal( null );
    });

    it('the round-* family rounds in device space, so zoom does not change the model outline', function(){
      // 27.4 recorded that insideRoundPolygon, unlike the sharp polygons,
      // is *not* affine-invariant: the radius is a device-px length, so it
      // must scale with the zoom.  At 400 model px the 'auto' radius is
      // capped at 8 model px (min(w/10, h/10, 8)), which is exactly where
      // an unscaled cap would show up.
      var n = addNode( 'a', 0, 0, 400, 400, SHAPE_ROUND_HEXAGON );
      var zoomed = { panXPx: 0, panYPx: 0, zoomDpr: 2, hidePx: 1, nodeLodPx: 3 };

      // model (-199, -2) sits just past the arc that replaces the left
      // vertex — inside the *sharp* hexagon, outside the rounded one — so
      // it misses at both zooms.  At zoom 2 it is the discriminating case:
      // with the 8 px cap left unscaled the radius would be half as big in
      // model terms and this point would pick.
      expect( pickNodeAt( store, frame, -199, -2 ) ).to.equal( null );
      expect( pickNodeAt( store, zoomed, -398, -4 ) ).to.equal( null );

      // and a point inside the arc agrees at both zooms
      expect( pickNodeAt( store, frame, -190, 6 ) ).to.equal( n );
      expect( pickNodeAt( store, zoomed, -380, 12 ) ).to.equal( n );
    });

    it('bottom-round-rectangle rounds only the bottom corners', function(){
      var n = addNode( 'a', 0, 0, 100, 100, SHAPE_BOTTOM_ROUND_RECTANGLE );

      expect( pickNodeAt( store, frame, 49, -49 ) ).to.equal( n );    // sharp top
      expect( pickNodeAt( store, frame, -49, -49 ) ).to.equal( n );
      expect( pickNodeAt( store, frame, 49, 49 ) ).to.equal( null );  // rounded bottom
      expect( pickNodeAt( store, frame, -49, 49 ) ).to.equal( null );
    });

    it('barrel caps its corner offsets absolutely, so it is not a unit shape', function(){
      // v3's height offset is min(15, 5% of height).  At 600 px tall the
      // cap binds at 15, so the corner curve starts 15 px from the end —
      // a purely relative offset would be 30 and would swallow this point.
      var tall = addNode( 'a', 0, 0, 100, 600, SHAPE_BARREL );

      expect( pickNodeAt( store, frame, 49, -282 ) ).to.equal( tall );
      expect( pickNodeAt( store, frame, 49, -288 ) ).to.equal( null ); // into the curve
      expect( pickNodeAt( store, frame, 0, 299 ) ).to.equal( tall );   // the end midpoint

      store = new GraphStore();

      // 100 px tall is the uncapped regime (5% = 5 px), so the *same
      // relative* point — 49/50 across, 47/50 up — lands outside instead:
      // the two sizes are genuinely different outlines
      var short = addNode( 'a', 0, 0, 100, 100, SHAPE_BARREL );

      expect( pickNodeAt( store, frame, 49, -47 ) ).to.equal( null );
      expect( pickNodeAt( store, frame, 49, -44 ) ).to.equal( short );
    });

  });

  describe('compound draw order (round 14.9)', function(){

    it('a leaf wins over the parent that covers it, whatever the slots say', function(){
      // parent allocated LAST (highest slot) — under the old
      // descending-slot rule it would swallow the child's picks
      var child = addNode( 'child', 0, 0, 20, 20, SHAPE_RECTANGLE );
      var parent = addNode( 'parent', 0, 0, 30, 30, SHAPE_RECTANGLE );

      store.setParent( child, parent );
      store.flushDerived(); // parent derives over the child (+ its own box)

      expect( pickNodeAt( store, frame, 0, 0 ) ).to.equal( child );
    });

    it('the parent-only band picks the parent; outside picks nothing', function(){
      var child = addNode( 'child', 0, 0, 20, 20, SHAPE_RECTANGLE );
      var parent = addNode( 'parent', 0, 0, 30, 30, SHAPE_RECTANGLE );

      store.setParent( child, parent );
      store.setCompoundStyle( parent, { padding: 20 } ); // box spans ±30
      store.flushDerived();

      expect( pickNodeAt( store, frame, 25, 0 ) ).to.equal( parent );
      expect( pickNodeAt( store, frame, 45, 0 ) ).to.equal( null );
    });

    it('nested parents pick the deepest (last-drawn) one', function(){
      var leaf = addNode( 'leaf', 0, 0, 10, 10, SHAPE_RECTANGLE );
      var inner = addNode( 'inner', 0, 0, 30, 30, SHAPE_RECTANGLE );
      var outer = addNode( 'outer', 0, 0, 30, 30, SHAPE_RECTANGLE );

      store.setParent( leaf, inner );
      store.setParent( inner, outer );
      store.setCompoundStyle( inner, { padding: 10 } ); // inner ±15
      store.setCompoundStyle( outer, { padding: 30 } ); // outer ±35
      store.flushDerived();

      expect( pickNodeAt( store, frame, 0, 0 ) ).to.equal( leaf );
      expect( pickNodeAt( store, frame, 12, 0 ) ).to.equal( inner ); // inner band
      expect( pickNodeAt( store, frame, 30, 0 ) ).to.equal( outer ); // outer band
    });

  });

});
