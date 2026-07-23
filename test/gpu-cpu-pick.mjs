import { expect } from 'chai';
import { GraphStore } from '../src/gpu/store/graph-store.mjs';
import { pickNodeAt } from '../src/gpu/render/cpu-pick.mjs';
import {
  FLAG_VISIBLE, SHAPE_CIRCLE, SHAPE_ELLIPSE, SHAPE_RECTANGLE, SHAPE_ROUND_RECTANGLE
} from '../src/gpu/contract.mjs';

describe('gpu/render: CPU node pick', function(){

  var store;
  var frame = { panXPx: 0, panYPx: 0, zoomDpr: 1, hidePx: 1, nodeLodPx: 3 };

  var addNode = function( id, x, y, w, h, shape ){
    var slot = store.addNode( id, x, y );

    store.setPair( 'node.size', slot, w, h );
    store.setScalar( 'node.shape', slot, shape );

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
    var n = addNode( 'a', 0, 0, 40, 40, SHAPE_ROUND_RECTANGLE ); // r = 5

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

});
