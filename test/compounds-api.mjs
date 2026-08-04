import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

// round 14.2: the compound collection API + lifecycle — def-parent
// resolution (two-pass), traversal methods, the remove cascade,
// move({ parent }) and json round-tripping.

// p > q > (a, b); c orphan leaf; r > s; edge wiring for cascade specs
const FIXTURE = {
  nodes: [
    { data: { id: 'a', parent: 'q' } }, // child defined before its parent: forward refs resolve
    { data: { id: 'b', parent: 'q' } },
    { data: { id: 'q', parent: 'p' } },
    { data: { id: 'p' } },
    { data: { id: 'c' } },
    { data: { id: 's', parent: 'r' } },
    { data: { id: 'r' } }
  ],
  edges: [
    { data: { id: 'ab', source: 'a', target: 'b' } },
    { data: { id: 'ac', source: 'a', target: 'c' } },
    { data: { id: 'cs', source: 'c', target: 's' } }
  ]
};

const make = () => cytoscape( { elements: FIXTURE } );
const ids = ( eles ) => eles.map( e => e.id() );

describe('gpu/collection: compound API (round 14.2)', function(){

  it('resolves def parents in a second pass (forward references allowed)', function(){
    const cy = make();

    expect( cy.hasCompoundNodes() ).to.equal( true );
    expect( cy.$id( 'a' ).data( 'parent' ) ).to.equal( 'q' );
    expect( cy.$id( 'q' ).data( 'parent' ) ).to.equal( 'p' );
    expect( cy.$id( 'p' ).data( 'parent' ) ).to.equal( undefined );
  });

  it('warns and orphans on an unknown or non-node def parent', function(){
    const warnings = [];
    const original = console.warn;

    console.warn = ( msg ) => warnings.push( String( msg ) );

    let cy;

    try {
      cy = cytoscape( { elements: {
        nodes: [ { data: { id: 'n' } }, { data: { id: 'x', parent: 'nope' } }, { data: { id: 'y', parent: 'e' } } ],
        edges: [ { data: { id: 'e', source: 'n', target: 'n' } } ]
      } } );
    } finally {
      console.warn = original;
    }

    expect( warnings.length ).to.equal( 2 );
    expect( cy.$id( 'x' ).data( 'parent' ) ).to.equal( undefined );
    expect( cy.$id( 'y' ).data( 'parent' ) ).to.equal( undefined );
    expect( cy.hasCompoundNodes() ).to.equal( false );
  });

  it('coerces numeric def parents to string ids (v3)', function(){
    const cy = cytoscape( { elements: {
      nodes: [ { data: { id: '1' } }, { data: { id: 'kid', parent: 1 } } ],
      edges: []
    } } );

    expect( cy.$id( 'kid' ).data( 'parent' ) ).to.equal( '1' );
  });

  it('parent() returns immediate parents, unique across the collection', function(){
    const cy = make();

    expect( ids( cy.$id( 'a' ).parent() ) ).to.deep.equal( [ 'q' ] );
    expect( ids( cy.$id( 'a' ).union( cy.$id( 'b' ) ).parent() ) ).to.deep.equal( [ 'q' ] );
    expect( cy.$id( 'p' ).parent().length ).to.equal( 0 );
    expect( cy.$id( 'ab' ).parent().length ).to.equal( 0 ); // edges have no parent
    expect( ids( cy.$id( 'a' ).parent( e => e.id() === 'q' ) ) ).to.deep.equal( [ 'q' ] );
    expect( cy.$id( 'a' ).parent( () => false ).length ).to.equal( 0 );
  });

  it('parents()/ancestors() walk up level by level, nearest first', function(){
    const cy = make();

    expect( ids( cy.$id( 'a' ).parents() ) ).to.deep.equal( [ 'q', 'p' ] );
    expect( ids( cy.$id( 'a' ).ancestors() ) ).to.deep.equal( [ 'q', 'p' ] );
    expect( ids( cy.$id( 'a' ).union( cy.$id( 's' ) ).parents() ) ).to.deep.equal( [ 'q', 'r', 'p' ] );
    expect( cy.$id( 'p' ).parents().length ).to.equal( 0 );
  });

  it('children() returns direct children in link order', function(){
    const cy = make();

    expect( ids( cy.$id( 'p' ).children() ) ).to.deep.equal( [ 'q' ] );
    expect( ids( cy.$id( 'q' ).children() ) ).to.deep.equal( [ 'a', 'b' ] );
    expect( ids( cy.$id( 'q' ).children( e => e.id() !== 'a' ) ) ).to.deep.equal( [ 'b' ] );
    expect( cy.$id( 'c' ).children().length ).to.equal( 0 );
  });

  it('descendants() is the pre-order subtree, excluding self', function(){
    const cy = make();

    expect( ids( cy.$id( 'p' ).descendants() ) ).to.deep.equal( [ 'q', 'a', 'b' ] );
    expect( ids( cy.$id( 'q' ).descendants() ) ).to.deep.equal( [ 'a', 'b' ] );
    expect( cy.$id( 'a' ).descendants().length ).to.equal( 0 );
  });

  it('siblings() shares a parent and excludes self; orphans have none', function(){
    const cy = make();

    expect( ids( cy.$id( 'a' ).siblings() ) ).to.deep.equal( [ 'b' ] );
    expect( cy.$id( 'q' ).siblings().length ).to.equal( 0 ); // only child
    expect( cy.$id( 'p' ).siblings().length ).to.equal( 0 ); // orphans are nobody's siblings (v3)
    expect( cy.$id( 'c' ).siblings().length ).to.equal( 0 );
  });

  it('orphans()/nonorphans() filter the calling collection', function(){
    const cy = make();

    expect( ids( cy.nodes().orphans() ).sort() ).to.deep.equal( [ 'c', 'p', 'r' ] );
    expect( ids( cy.nodes().nonorphans() ).sort() ).to.deep.equal( [ 'a', 'b', 'q', 's' ] );
  });

  it('commonAncestors() intersects ancestor chains, closest first', function(){
    const cy = make();

    expect( ids( cy.$id( 'a' ).union( cy.$id( 'b' ) ).commonAncestors() ) ).to.deep.equal( [ 'q', 'p' ] );
    expect( ids( cy.$id( 'a' ).union( cy.$id( 'q' ) ).commonAncestors() ) ).to.deep.equal( [ 'p' ] );
    expect( cy.$id( 'a' ).union( cy.$id( 's' ) ).commonAncestors().length ).to.equal( 0 );
  });

  it('exposes the is* predicates', function(){
    const cy = make();

    expect( cy.$id( 'p' ).isParent() ).to.equal( true );
    expect( cy.$id( 'p' ).isChildless() ).to.equal( false );
    expect( cy.$id( 'p' ).isChild() ).to.equal( false );
    expect( cy.$id( 'p' ).isOrphan() ).to.equal( true );

    expect( cy.$id( 'q' ).isParent() ).to.equal( true );
    expect( cy.$id( 'q' ).isChild() ).to.equal( true );
    expect( cy.$id( 'q' ).isOrphan() ).to.equal( false );

    expect( cy.$id( 'a' ).isParent() ).to.equal( false );
    expect( cy.$id( 'a' ).isChildless() ).to.equal( true );
    expect( cy.$id( 'a' ).isChild() ).to.equal( true );

    expect( cy.$id( 'ab' ).isParent() ).to.equal( false ); // edges: false across the board
    expect( cy.$id( 'ab' ).isChild() ).to.equal( false );
  });

  it('remove() cascades over descendants and their incident edges', function(){
    const cy = make();

    const removed = cy.$id( 'p' ).remove();

    expect( ids( removed ).sort() ).to.deep.equal( [ 'a', 'ab', 'ac', 'b', 'p', 'q' ] );
    expect( cy.$id( 'a' ).length ).to.equal( 0 );
    expect( cy.$id( 'ac' ).length ).to.equal( 0 );
    expect( cy.$id( 'c' ).length ).to.equal( 1 ); // outside the subtree: kept
    expect( cy.$id( 'cs' ).length ).to.equal( 1 );
    expect( ids( cy.nodes() ).sort() ).to.deep.equal( [ 'c', 'r', 's' ] );
  });

  it('remove() tolerates a parent and its descendants both in the collection', function(){
    const cy = make();

    const removed = cy.$id( 'p' ).union( cy.$id( 'a' ) ).union( cy.$id( 'q' ) ).remove();

    expect( ids( removed ).sort() ).to.deep.equal( [ 'a', 'ab', 'ac', 'b', 'p', 'q' ] );
    expect( cy.hasCompoundNodes() ).to.equal( true ); // r > s survives
    cy.$id( 'r' ).remove();
    expect( cy.hasCompoundNodes() ).to.equal( false );
  });

  it('move({ parent }) reparents in place, keeping identity', function(){
    const cy = make();
    const a = cy.$id( 'a' );

    a.move( { parent: 'r' } );

    expect( a.data( 'parent' ) ).to.equal( 'r' );
    expect( ids( cy.$id( 'r' ).children() ) ).to.deep.equal( [ 's', 'a' ] );
    expect( ids( cy.$id( 'q' ).children() ) ).to.deep.equal( [ 'b' ] );
    expect( a.data( 'weight' ) ).to.equal( undefined ); // data intact (none set)
    expect( a.connectedEdges().length ).to.equal( 2 ); // edges untouched

    a.move( { parent: null } );

    expect( a.data( 'parent' ) ).to.equal( undefined );
    expect( a.isOrphan() ).to.equal( true );
  });

  it('move({ parent }) emits moveout then move per reparented node', function(){
    const cy = make();
    const events = [];

    cy.on( 'moveout', ( e ) => events.push( [ 'moveout', e.target.id() ] ) );
    cy.on( 'move', ( e ) => events.push( [ 'move', e.target.id() ] ) );

    cy.$id( 'a' ).move( { parent: 'r' } );
    cy.$id( 'a' ).move( { parent: 'r' } ); // no-op: same parent, no events

    expect( events ).to.deep.equal( [ [ 'moveout', 'a' ], [ 'move', 'a' ] ] );
  });

  it('move({ parent }) guards cycles and unknown parents', function(){
    const cy = make();
    const warnings = [];
    const original = console.warn;

    console.warn = ( msg ) => warnings.push( String( msg ) );

    try {
      cy.$id( 'p' ).move( { parent: 'a' } ); // p under its own grandchild
    } finally {
      console.warn = original;
    }

    expect( warnings.length ).to.equal( 1 );
    expect( cy.$id( 'p' ).isOrphan() ).to.equal( true );

    cy.$id( 'a' ).move( { parent: 'nope' } ); // v3: silent no-op

    expect( cy.$id( 'a' ).data( 'parent' ) ).to.equal( 'q' );
  });

  it('json() carries parent and round-trips through add()', function(){
    const cy = make();
    const json = cy.$id( 'a' ).json();

    expect( json.data.parent ).to.equal( 'q' );

    const cy2 = cytoscape( { elements: { nodes: [ { data: { id: 'q' } } ], edges: [] } } );

    cy2.add( json );

    expect( cy2.$id( 'a' ).data( 'parent' ) ).to.equal( 'q' );
    expect( cy2.$id( 'q' ).isParent() ).to.equal( true );
  });

});
