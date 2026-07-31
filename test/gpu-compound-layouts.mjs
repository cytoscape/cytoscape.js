import { expect } from 'chai';
import cytoscapeGpu from '../src/gpu/index.mjs';
import { Animation } from '../src/gpu/animation.mjs';

// round 14.11: layouts position leaves only (parents derive), the GPU
// tween demotion rule for compound-related targets, and the
// reparent-settle hook.

const make = () => cytoscapeGpu( {
  style: { parents: { padding: 0, borderWidth: 0 } },
  elements: {
    nodes: [
      { data: { id: 'p' } },
      { data: { id: 'a', parent: 'p' }, position: { x: 0, y: 0 } },
      { data: { id: 'b', parent: 'p' }, position: { x: 100, y: 0 } },
      { data: { id: 'q' }, position: { x: 300, y: 0 } }
    ],
    edges: []
  }
} );

describe('gpu/layouts: compound exclusion (round 14.11)', function(){

  it('grid lays out leaves only; parents derive from them', function(){
    const cy = make();

    cy.layout( { name: 'grid', fit: false } ).run();

    const a = cy.$id( 'a' ).position();
    const b = cy.$id( 'b' ).position();
    const q = cy.$id( 'q' ).position();
    const p = cy.$id( 'p' ).position();

    // three leaves land on three distinct cells
    const cells = new Set( [ a, b, q ].map( pt => `${pt.x}:${pt.y}` ) );

    expect( cells.size ).to.equal( 3 );

    // the parent derives over its children, never a grid cell of its own
    expect( p.x ).to.be.closeTo( ( a.x + b.x ) / 2, 1e-3 );
    expect( p.y ).to.be.closeTo( ( a.y + b.y ) / 2, 1e-3 );
  });

  it('circle places leaves on the ring; the parent stays derived', function(){
    const cy = make();

    cy.layout( { name: 'circle', fit: false } ).run();

    const pts = [ 'a', 'b', 'q' ].map( id => cy.$id( id ).position() );
    const cx = pts.reduce( ( s, pt ) => s + pt.x, 0 ) / 3;
    const cyy = pts.reduce( ( s, pt ) => s + pt.y, 0 ) / 3;
    const radii = pts.map( pt => Math.hypot( pt.x - cx, pt.y - cyy ) );

    expect( radii[ 0 ] ).to.be.closeTo( radii[ 1 ], 1e-3 );
    expect( radii[ 1 ] ).to.be.closeTo( radii[ 2 ], 1e-3 );

    const a = cy.$id( 'a' ).position();
    const b = cy.$id( 'b' ).position();
    const p = cy.$id( 'p' ).position();

    expect( p.x ).to.be.closeTo( ( a.x + b.x ) / 2, 1e-3 );
    expect( p.y ).to.be.closeTo( ( a.y + b.y ) / 2, 1e-3 );
  });

  it('preset ignores parent entries (their subtrees stay put)', function(){
    const cy = make();

    cy.layout( { name: 'preset', fit: false, positions: {
      a: { x: 10, y: 10 },
      p: { x: 500, y: 500 } // a parent write would shift the subtree — skipped
    } } ).run();

    expect( cy.$id( 'a' ).position() ).to.deep.equal( { x: 10, y: 10 } );
    expect( cy.$id( 'b' ).position() ).to.deep.equal( { x: 100, y: 0 } );
    expect( cy.$id( 'p' ).position().x ).to.be.closeTo( ( 10 + 100 ) / 2, 1e-3 );
  });

  it('boundingBoxAt covers the leaves at hypothetical positions, skipping parent bodies', function(){
    const cy = make();

    const bb = cy.nodes().boundingBoxAt( ( node ) =>
      node.id() === 'a' ? { x: -100, y: 0 } : node.position() );

    // default 30x30 leaves: a at (-100, 0) spans x >= -115
    expect( bb.x1 ).to.be.closeTo( -115, 1e-3 );
    expect( bb.x2 ).to.be.closeTo( 315, 1e-3 );
  });

});

describe('gpu/animation: compound tween rules (round 14.11)', function(){

  it('demotes position tweens with compound-related targets to the CPU', function(){
    const cy = make();

    const aniFor = ( id ) => new Animation(
      cy._store, null, [ cy.$id( id )._first() ], false,
      { position: { x: 500, y: 500 }, duration: 100 }, cy._styleEngine );

    expect( aniFor( 'a' ).gpuEligible ).to.equal( false ); // child
    expect( aniFor( 'p' ).gpuEligible ).to.equal( false ); // parent
    expect( aniFor( 'q' ).gpuEligible ).to.equal( true );  // unrelated leaf

    const flat = cytoscapeGpu( { elements: {
      nodes: [ { data: { id: 'x' }, position: { x: 0, y: 0 } } ], edges: []
    } } );
    const flatAni = new Animation(
      flat._store, null, [ flat.$id( 'x' )._first() ], false,
      { position: { x: 5, y: 5 }, duration: 100 }, flat._styleEngine );

    expect( flatAni.gpuEligible ).to.equal( true );
  });

  it('settles GPU leases on reparent (headless: a safe no-op)', function(){
    const cy = make();

    expect( () => cy._animations.settleGpuAll() ).to.not.throw();

    // the reparent hook runs it end to end
    cy.$id( 'q' ).move( { parent: 'p' } );

    expect( cy.$id( 'q' ).data( 'parent' ) ).to.equal( 'p' );
  });

});
