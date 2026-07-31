import { expect } from 'chai';
import cytoscapeGpu from '../src/gpu/index.mjs';

// round 14.3: the auto-bounds flush — parent geometry derived from
// children (v3's updateCompoundBounds math with the simplified centered
// min clamp), materialized into the node.size/node.position columns.
// Default nodes are 30x30 with border 0, so a child at (x, y) spans
// x +/- 15.  Compound style is set through the store API here; the
// parents sheet group wires it in 14.6.

const slotOf = ( cy, id ) => cy.$id( id )._first().slot;

// p > (a at (0,0), b at (100,0)) => children bb x [-15, 115], y [-15, 15].
// The suite pins raw auto-bounds math, so the sheet zeroes the v3-default
// parent padding (10) and border (1) from the 14.6 parents group.
const make = ( extra = {} ) => cytoscapeGpu( {
  style: { parents: { padding: 0, borderWidth: 0 } },
  elements: {
    nodes: [
      { data: { id: 'p' } },
      { data: { id: 'a', parent: 'p' }, position: { x: 0, y: 0 } },
      { data: { id: 'b', parent: 'p' }, position: { x: 100, y: 0 } },
      ...( extra.nodes ?? [] )
    ],
    edges: extra.edges ?? []
  }
} );

describe('gpu/store: compound auto-bounds (round 14.3)', function(){

  it('derives parent size and position from the children bb', function(){
    const cy = make();
    const p = cy.$id( 'p' );

    expect( p.position() ).to.deep.equal( { x: 50, y: 0 } );
    expect( p.width() ).to.equal( 130 );
    expect( p.height() ).to.equal( 30 );
    expect( p.paddedWidth() ).to.equal( 130 );
    expect( p.padding() ).to.equal( 0 );

    const bb = p.boundingBox();

    expect( bb.x1 ).to.equal( -15 );
    expect( bb.x2 ).to.equal( 115 );
    expect( bb.w ).to.equal( 130 );
  });

  it('includes child borders in the derived bb', function(){
    const cy = make();

    cy.style( { nodes: { borderWidth: 4, borderColor: '#000' }, parents: { padding: 0, borderWidth: 0 } } );

    // child extent grows by border/2 = 2 per side
    expect( cy.$id( 'p' ).width() ).to.equal( 134 );
    expect( cy.$id( 'p' ).height() ).to.equal( 34 );
  });

  it('derives nested parents from the inner parent’s derived box', function(){
    const cy = make( { nodes: [ { data: { id: 'gp' } } ] } );

    cy.$id( 'p' ).move( { parent: 'gp' } );

    const gp = cy.$id( 'gp' );

    expect( gp.position() ).to.deep.equal( { x: 50, y: 0 } );
    expect( gp.width() ).to.equal( 130 ); // p has border 0 and padding 0
    expect( gp.height() ).to.equal( 30 );
  });

  it('re-derives lazily when a child moves', function(){
    const cy = make();

    cy.$id( 'b' ).position( { x: 200, y: 0 } );

    expect( cy.$id( 'p' ).width() ).to.equal( 230 );
    expect( cy.$id( 'p' ).position() ).to.deep.equal( { x: 100, y: 0 } );

    cy.$id( 'a' ).shift( { x: -100, y: 0 } );

    expect( cy.$id( 'p' ).width() ).to.equal( 330 );
    expect( cy.$id( 'p' ).position() ).to.deep.equal( { x: 50, y: 0 } );
  });

  it('setting a parent’s position shifts its descendants by the delta', function(){
    const cy = make( { nodes: [ { data: { id: 'gp' } } ] } );

    cy.$id( 'p' ).move( { parent: 'gp' } );

    const positions = [];

    cy.on( 'position', ( e ) => positions.push( e.target.id() ) );

    cy.$id( 'p' ).position( { x: 60, y: 10 } );

    expect( cy.$id( 'a' ).position() ).to.deep.equal( { x: 10, y: 10 } );
    expect( cy.$id( 'b' ).position() ).to.deep.equal( { x: 110, y: 10 } );
    expect( cy.$id( 'p' ).position() ).to.deep.equal( { x: 60, y: 10 } );
    expect( cy.$id( 'gp' ).position() ).to.deep.equal( { x: 60, y: 10 } ); // re-derived

    // v3 emits position for the shifted children too
    expect( positions.sort() ).to.deep.equal( [ 'a', 'b', 'p' ] );
  });

  it('clamps to min-width/min-height centered (the simplified v3 clamp)', function(){
    const cy = make();
    const store = cy._store;

    store.setCompoundStyle( slotOf( cy, 'p' ), { minWidth: 300, minHeight: 100 } );

    const p = cy.$id( 'p' );

    expect( p.width() ).to.equal( 300 );
    expect( p.height() ).to.equal( 100 );
    expect( p.position() ).to.deep.equal( { x: 50, y: 0 } ); // center unchanged

    const bb = p.boundingBox();

    expect( bb.x1 ).to.equal( 50 - 150 );
    expect( bb.x2 ).to.equal( 50 + 150 );
  });

  it('applies px padding around the children bb', function(){
    const cy = make();
    const store = cy._store;
    const p = cy.$id( 'p' );

    store.setCompoundStyle( slotOf( cy, 'p' ), { padding: 10 } );

    expect( p.padding() ).to.equal( 10 );
    expect( p.width() ).to.equal( 130 );  // width() reads the core box (v3 autoWidth)
    expect( p.paddedWidth() ).to.equal( 150 ); // the drawn size
    expect( p.paddedHeight() ).to.equal( 50 );
    expect( p.outerWidth() ).to.equal( 150 ); // border 0
    expect( p.boundingBox().x1 ).to.equal( -25 );
  });

  it('resolves % padding against the children bb per padding-relative-to', function(){
    const cy = make();
    const store = cy._store;
    const slot = slotOf( cy, 'p' );
    const p = cy.$id( 'p' );

    // children bb is 130 x 30 (v3 computes % padding from the pre-clamp bb)
    store.setCompoundStyle( slot, { padding: 0.1, paddingUnit: '%', relativeTo: 'width' } );
    expect( p.padding() ).to.equal( 13 );

    store.setCompoundStyle( slot, { padding: 0.1, paddingUnit: '%', relativeTo: 'height' } );
    expect( p.padding() ).to.equal( 3 );

    store.setCompoundStyle( slot, { padding: 0.1, paddingUnit: '%', relativeTo: 'average' } );
    expect( p.padding() ).to.equal( 8 );

    store.setCompoundStyle( slot, { padding: 0.1, paddingUnit: '%', relativeTo: 'min' } );
    expect( p.padding() ).to.equal( 3 );

    store.setCompoundStyle( slot, { padding: 0.1, paddingUnit: '%', relativeTo: 'max' } );
    expect( p.padding() ).to.equal( 13 );
  });

  it('falls back to the stashed style size when no shown children remain', function(){
    const cy = make();
    const p = cy.$id( 'p' );

    expect( p.width() ).to.equal( 130 ); // derived while children are shown

    cy.$id( 'a' ).hide();
    cy.$id( 'b' ).hide();

    expect( p.width() ).to.equal( 30 ); // the style size
    expect( p.height() ).to.equal( 30 );
    expect( p.position() ).to.deep.equal( { x: 50, y: 0 } ); // kept where it was

    cy.$id( 'a' ).show();

    expect( p.width() ).to.equal( 30 ); // one shown 30x30 child at (0,0)
    expect( p.position() ).to.deep.equal( { x: 0, y: 0 } );
  });

  it('restores the style size when the last child is removed', function(){
    const cy = make();
    const p = cy.$id( 'p' );

    expect( p.width() ).to.equal( 130 );

    cy.$id( 'a' ).remove();
    cy.$id( 'b' ).remove();

    expect( p.isParent() ).to.equal( false );
    expect( p.width() ).to.equal( 30 );
    expect( p.height() ).to.equal( 30 );
    expect( p.padding() ).to.equal( 0 );
  });

  it('answers relativePosition against the immediate parent', function(){
    const cy = make();
    const a = cy.$id( 'a' );

    // p derives to (50, 0)
    expect( a.relativePosition() ).to.deep.equal( { x: -50, y: 0 } );
    expect( a.relativePosition( 'x' ) ).to.equal( -50 );

    a.relativePosition( { x: 0, y: 20 } ); // model = parent + rel

    expect( a.position().y ).to.equal( 20 );
    // the parent re-derives after the move, so the rel read is against the new origin
    expect( cy.$id( 'p' ).position().y ).to.equal( 10 );
    expect( a.relativePosition().y ).to.equal( 10 );

    // orphans: relative position is the model position
    expect( cy.$id( 'p' ).relativePosition() ).to.deep.equal( cy.$id( 'p' ).position() );
  });

  it('shift() skips elements whose ancestor is also shifted (v3 dedupe)', function(){
    const cy = make();

    cy.$id( 'p' ).union( cy.$id( 'a' ) ).shift( { x: 10, y: 0 } );

    expect( cy.$id( 'a' ).position() ).to.deep.equal( { x: 10, y: 0 } ); // once, not twice
    expect( cy.$id( 'b' ).position() ).to.deep.equal( { x: 110, y: 0 } );
  });

  it('does not re-trigger itself: a flush leaves no pending work behind', function(){
    const cy = make();
    const store = cy._store;

    cy.$id( 'p' ).boundingBox(); // forces the flush
    store.takeDelta(); // drain everything

    const delta = store.takeDelta();

    expect( delta.spans ).to.deep.equal( [] );

    // repeated reads are stable
    const w1 = cy.$id( 'p' ).width();

    expect( cy.$id( 'p' ).width() ).to.equal( w1 );
  });

  it('re-anchors a parent’s label when auto-bounds resize it', function(){
    const cy = make();

    cy.style( { nodes: { label: { data: 'id' } }, parents: { padding: 0 } } ); // default valign: bottom

    const store = cy._store;
    const slot = slotOf( cy, 'p' );

    cy.$id( 'p' ).boundingBox(); // flush

    let entry = store.labelAt( slot, 'nodes' );

    expect( entry.anchorY ).to.equal( 30 / 2 + 4 ); // height 30, LABEL_MARGIN 4

    cy.$id( 'b' ).position( { x: 100, y: 100 } ); // children bb height grows to 130
    cy.$id( 'p' ).boundingBox();

    entry = store.labelAt( slot, 'nodes' );

    expect( entry.anchorY ).to.equal( 130 / 2 + 4 );
  });

});
