import { expect } from 'chai';
import { GraphStore } from '../src/gpu/store/graph-store.mjs';
import { pickNodeAt } from '../src/gpu/render/cpu-pick.mjs';
import {
  FLAG_VISIBLE, SHAPE_CIRCLE, SHAPE_DIAMOND, SHAPE_ELLIPSE, SHAPE_HEXAGON,
  SHAPE_RECTANGLE, SHAPE_ROUND_RECTANGLE, SHAPE_STAR, SHAPE_TRIANGLE, SHAPE_VEE
} from '../src/gpu/contract.mjs';

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

    store.setFlag( 'nodes', b, FLAG_VISIBLE, false );

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

});
