import { expect } from 'chai';
import cytoscapeGpu from '../src/gpu/index.mjs';
import { FLAG_CURVED, FLAG_CURVED_BOX } from '../src/gpu/contract.mjs';

// round 14.10: compound loop edges — an edge between a node and its own
// ancestor/descendant (or a self-loop on a parent) routes around the
// outside via v3's findCompoundLoopPoints, whatever its curve style.

// p > (a at (0,0), b at (100,0)); q top-level leaf at (300, 0).
// The parents sheet zeroes padding/border so the derived boxes pin
// hand-computed numbers: p = pos (50, 0), size 130 x 30.
const make = ( edges, style = {} ) => cytoscapeGpu( {
  style: { parents: { padding: 0, borderWidth: 0 }, ...style },
  elements: {
    nodes: [
      { data: { id: 'p' } },
      { data: { id: 'a', parent: 'p' }, position: { x: 0, y: 0 } },
      { data: { id: 'b', parent: 'p' }, position: { x: 100, y: 0 } },
      { data: { id: 'q' }, position: { x: 300, y: 0 } }
    ],
    edges
  }
} );

// v3's construction, for expected values
const compoundControls = ( sx, sy, sHalfW, sHalfH, tx, ty, tHalfW, tHalfH, dist, j ) => {
  const minX = Math.min( sx - sHalfW, tx - tHalfW );
  const minY = Math.min( sy - sHalfH, ty - tHalfH );
  const factor = ( 1 + Math.pow( 50, 1.12 ) / 100 ) * dist * ( j / 3 + 1 );
  const stretchA = Math.max( 0.5, Math.log( 2 * sHalfW * 0.01 ) );
  const stretchB = Math.max( 0.5, Math.log( 2 * tHalfW * 0.01 ) );

  return [
    { x: minX, y: minY - factor * stretchA },
    { x: minX - factor * stretchB, y: minY }
  ];
};

describe('gpu/curves: compound loop edges (round 14.10)', function(){

  it('routes a child-to-parent edge around the outside (v3 formula)', function(){
    const cy = make( [ { data: { id: 'ap', source: 'a', target: 'p' } } ] );
    const ap = cy.$id( 'ap' );

    cy.$id( 'p' ).position(); // settle auto-bounds

    const pts = ap.controlPoints();
    // a: (0,0) halves 15x15; p (derived): (50,0) halves 65x15; step 40, j = 0
    const want = compoundControls( 0, 0, 15, 15, 50, 0, 65, 15, 40, 0 );

    expect( pts.length ).to.equal( 2 );
    expect( pts[ 0 ].x ).to.be.closeTo( want[ 0 ].x, 0.01 );
    expect( pts[ 0 ].y ).to.be.closeTo( want[ 0 ].y, 0.01 );
    expect( pts[ 1 ].x ).to.be.closeTo( want[ 1 ].x, 0.01 );
    expect( pts[ 1 ].y ).to.be.closeTo( want[ 1 ].y, 0.01 );

    expect( ap.isBundledBezier() ).to.equal( false );

    // the label anchor is the control midpoint (the loop rule)
    const mid = ap.midpoint();

    expect( mid.x ).to.be.closeTo( ( want[ 0 ].x + want[ 1 ].x ) / 2, 0.01 );
    expect( mid.y ).to.be.closeTo( ( want[ 0 ].y + want[ 1 ].y ) / 2, 0.01 );
  });

  it('marks compound edges curved and box-bounded, and grows the cull slack', function(){
    const cy = make( [ { data: { id: 'ap', source: 'a', target: 'p' } } ] );
    const store = cy._store;

    store.flushDerived();

    const slot = cy.$id( 'ap' )._first().slot;

    expect( store.hasFlag( 'edges', slot, FLAG_CURVED ) ).to.equal( true );
    expect( store.hasFlag( 'edges', slot, FLAG_CURVED_BOX ) ).to.equal( true );
    expect( store.curveSlack() ).to.be.greaterThan( 30 ); // the excursion bound feeds it
  });

  it('extends the exact edge bb by the outside excursion', function(){
    const cy = make( [ { data: { id: 'ap', source: 'a', target: 'p' } } ] );
    const bb = cy.$id( 'ap' ).boundingBox();

    // the loop swings up-left past the min corner (-15, -15)
    expect( bb.x1 ).to.be.lessThan( -16 );
    expect( bb.y1 ).to.be.lessThan( -16 );
  });

  it('routes ancestor edges across multiple levels', function(){
    const cy = make( [ { data: { id: 'aq', source: 'a', target: 'q' } } ] );

    expect( cy.$id( 'aq' ).controlPoints() ).to.equal( undefined ); // unrelated: straight

    cy.$id( 'q' ).move( { parent: null } ); // no-op guard
    cy.$id( 'p' ).move( { parent: 'q' } ); // q > p > a: a-q is now ancestor-related

    const pts = cy.$id( 'aq' ).controlPoints();

    expect( pts ).to.not.equal( undefined );
    expect( pts.length ).to.equal( 2 );
  });

  it('reverts to the styled routing when the relation ends', function(){
    const cy = make( [ { data: { id: 'ap', source: 'a', target: 'p' } } ] );

    expect( cy.$id( 'ap' ).controlPoints().length ).to.equal( 2 );

    cy.$id( 'a' ).move( { parent: null } ); // relation gone

    expect( cy.$id( 'ap' ).controlPoints() ).to.equal( undefined ); // default straight
  });

  it('preempts the declared curve style (v3’s edge:compound default)', function(){
    const cy = make(
      [ { data: { id: 'ap', source: 'a', target: 'p' } } ],
      { edges: { curveStyle: 'taxi' } }
    );

    // a related edge never takes the taxi route: segmentPoints answers
    // for taxi edges, and a compound loop has none
    expect( cy.$id( 'ap' ).segmentPoints() ).to.equal( undefined );
    expect( cy.$id( 'ap' ).controlPoints().length ).to.equal( 2 );
  });

  it('routes a parent self-loop around the outside; leaf loops stay loops', function(){
    const cy = make( [
      { data: { id: 'pp', source: 'p', target: 'p' } },
      { data: { id: 'qq', source: 'q', target: 'q' } }
    ] );

    cy.$id( 'p' ).position(); // settle auto-bounds

    const pp = cy.$id( 'pp' ).controlPoints();
    // p self-loop: both ends (50,0) halves 65x15 → min corner (-15,-15)
    const want = compoundControls( 50, 0, 65, 15, 50, 0, 65, 15, 40, 0 );

    expect( pp[ 0 ].x ).to.be.closeTo( want[ 0 ].x, 0.01 );
    expect( pp[ 0 ].y ).to.be.closeTo( want[ 0 ].y, 0.01 );
    expect( pp[ 1 ].x ).to.be.closeTo( want[ 1 ].x, 0.01 );
    expect( pp[ 1 ].y ).to.be.closeTo( want[ 1 ].y, 0.01 );

    // the leaf self-loop keeps v3's center-ray construction: both
    // controls sit at the loop radius from the node center
    const qq = cy.$id( 'qq' ).controlPoints();
    const r = ( dx, dy ) => Math.sqrt( dx * dx + dy * dy );

    expect( r( qq[ 0 ].x - 300, qq[ 0 ].y ) ).to.be.closeTo( 1.4 * 40, 0.01 );
    expect( r( qq[ 1 ].x - 300, qq[ 1 ].y ) ).to.be.closeTo( 1.4 * 40, 0.01 );
  });

  it('re-routes a leaf self-loop when its node becomes a parent', function(){
    const cy = make( [ { data: { id: 'qq', source: 'q', target: 'q' } } ] );

    cy.$id( 'b' ).move( { parent: 'q' } ); // q flips to a parent

    const pts = cy.$id( 'qq' ).controlPoints();
    // q derives over b at (100, 0): pos (100, 0), size 30 x 30
    const want = compoundControls( 100, 0, 15, 15, 100, 0, 15, 15, 40, 0 );

    expect( pts[ 0 ].x ).to.be.closeTo( want[ 0 ].x, 0.01 );
    expect( pts[ 0 ].y ).to.be.closeTo( want[ 0 ].y, 0.01 );

    cy.$id( 'b' ).move( { parent: 'p' } ); // q back to a leaf

    // q keeps its derived position (v3: a parent's position persists),
    // so the plain loop re-centers there
    const qPos = cy.$id( 'q' ).position();
    const back = cy.$id( 'qq' ).controlPoints();

    expect( r2( back[ 0 ].x - qPos.x, back[ 0 ].y - qPos.y ) ).to.be.closeTo( 1.4 * 40, 0.01 );
  });

  it('follows auto-bounds resizes with live control points', function(){
    const cy = make( [ { data: { id: 'ap', source: 'a', target: 'p' } } ] );
    const before = cy.$id( 'ap' ).controlPoints();

    cy.$id( 'b' ).position( { x: 100, y: -200 } ); // p grows upward

    const after = cy.$id( 'ap' ).controlPoints();

    // p's top edge (the min corner's y) moved up, so the controls moved too
    expect( after[ 0 ].y ).to.be.lessThan( before[ 0 ].y - 50 );
  });

});

const r2 = ( dx, dy ) => Math.sqrt( dx * dx + dy * dy );
