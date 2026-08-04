import { expect } from 'chai';
import cytoscape from '../src/index.mjs';
import { GraphStore } from '../src/store/graph-store.mjs';
import { FLAG_CHILD, FLAG_PARENT } from '../src/contract.mjs';

// round 14.1: the hierarchy model — parent links, derived flags, depth,
// the (depth, slot) parent draw permutation, and the reserved `parent`
// data key.  Auto-bounds (14.3) and the collection API (14.2) have their
// own suites.

const addNodes = ( store, ids ) => {
  const slots = {};

  for( const id of ids ){ slots[ id ] = store.addNode( id, 0, 0 ); }

  return slots;
};

const flagsOf = ( store, slot ) => store.column( 'node.flags' )[ slot ];

describe('gpu/store: hierarchy (round 14.1)', function(){

  it('links parents and children with derived flags and depth', function(){
    const store = new GraphStore();
    const s = addNodes( store, [ 'p', 'a', 'b' ] );

    expect( store.hasCompounds() ).to.equal( false );
    expect( store.parentCount() ).to.equal( 0 );
    expect( store.parentOf( s.a ) ).to.equal( -1 );
    expect( store.childrenOf( s.p ) ).to.deep.equal( [] );

    store.setParent( s.a, s.p );
    store.setParent( s.b, s.p );

    expect( store.hasCompounds() ).to.equal( true );
    expect( store.parentCount() ).to.equal( 1 );
    expect( store.parentOf( s.a ) ).to.equal( s.p );
    expect( store.parentOf( s.b ) ).to.equal( s.p );
    expect( store.parentOf( s.p ) ).to.equal( -1 );
    expect( Array.from( store.childrenOf( s.p ) ) ).to.deep.equal( [ s.a, s.b ] );

    expect( store.depthOf( s.p ) ).to.equal( 0 );
    expect( store.depthOf( s.a ) ).to.equal( 1 );

    expect( flagsOf( store, s.p ) & FLAG_PARENT ).to.not.equal( 0 );
    expect( flagsOf( store, s.p ) & FLAG_CHILD ).to.equal( 0 );
    expect( flagsOf( store, s.a ) & FLAG_CHILD ).to.not.equal( 0 );
    expect( flagsOf( store, s.a ) & FLAG_PARENT ).to.equal( 0 );
  });

  it('reparenting moves children lists, flags and subtree depths', function(){
    const store = new GraphStore();
    const s = addNodes( store, [ 'p', 'q', 'a', 'ga' ] );

    store.setParent( s.a, s.p );
    store.setParent( s.ga, s.a ); // p > a > ga

    expect( store.depthOf( s.ga ) ).to.equal( 2 );

    store.setParent( s.q, s.p ); // p > q
    store.setParent( s.a, s.q ); // p > q > a > ga

    expect( Array.from( store.childrenOf( s.p ) ) ).to.deep.equal( [ s.q ] );
    expect( Array.from( store.childrenOf( s.q ) ) ).to.deep.equal( [ s.a ] );
    expect( store.depthOf( s.a ) ).to.equal( 2 );
    expect( store.depthOf( s.ga ) ).to.equal( 3 );

    // orphaning the middle shifts the subtree back up
    store.setParent( s.a, -1 );

    expect( store.parentOf( s.a ) ).to.equal( -1 );
    expect( flagsOf( store, s.a ) & FLAG_CHILD ).to.equal( 0 );
    expect( flagsOf( store, s.a ) & FLAG_PARENT ).to.not.equal( 0 ); // still ga's parent
    expect( store.depthOf( s.a ) ).to.equal( 0 );
    expect( store.depthOf( s.ga ) ).to.equal( 1 );

    // q lost its only child: no longer a parent
    expect( flagsOf( store, s.q ) & FLAG_PARENT ).to.equal( 0 );
    expect( store.childrenOf( s.q ) ).to.deep.equal( [] );
    expect( store.parentCount() ).to.equal( 2 ); // p and a
  });

  it('no-ops on a same-parent write', function(){
    const store = new GraphStore();
    const s = addNodes( store, [ 'p', 'a' ] );

    store.setParent( s.a, s.p );
    store.takeDelta(); // drain

    store.setParent( s.a, s.p );

    expect( store.takeDelta().spans ).to.deep.equal( [] );
  });

  it('rejects cycles (and self-parenting) with a warn + no-op, as v3 drops the ref', function(){
    const store = new GraphStore();
    const s = addNodes( store, [ 'p', 'a', 'ga' ] );

    store.setParent( s.a, s.p );
    store.setParent( s.ga, s.a );

    const warnings = [];
    const original = console.warn;

    console.warn = ( msg ) => warnings.push( String( msg ) );

    try {
      store.setParent( s.p, s.ga ); // p under its own grandchild
      store.setParent( s.a, s.a ); // self
    } finally {
      console.warn = original;
    }

    expect( warnings.length ).to.equal( 2 );
    expect( store.parentOf( s.p ) ).to.equal( -1 );
    expect( store.parentOf( s.a ) ).to.equal( s.p );
    expect( store.depthOf( s.ga ) ).to.equal( 2 );
  });

  it('throws when removing a node that still has children', function(){
    const store = new GraphStore();
    const s = addNodes( store, [ 'p', 'a' ] );

    store.setParent( s.a, s.p );

    expect( () => store.removeNode( s.p ) ).to.throw( /children/ );
  });

  it('removing the last child severs the link and clears the parent flag', function(){
    const store = new GraphStore();
    const s = addNodes( store, [ 'p', 'a' ] );

    store.setParent( s.a, s.p );
    store.removeNode( s.a );

    expect( store.childrenOf( s.p ) ).to.deep.equal( [] );
    expect( flagsOf( store, s.p ) & FLAG_PARENT ).to.equal( 0 );
    expect( store.parentCount() ).to.equal( 0 );
    expect( store.hasCompounds() ).to.equal( false );
  });

  it('a recycled child slot starts fresh (no stale hierarchy state)', function(){
    const store = new GraphStore();
    const s = addNodes( store, [ 'p', 'a' ] );

    store.setParent( s.a, s.p );
    store.removeNode( s.a );

    const reused = store.addNode( 'a2', 0, 0 );

    expect( reused ).to.equal( s.a ); // free-list reuse (the point of the spec)
    expect( store.parentOf( reused ) ).to.equal( -1 );
    expect( store.depthOf( reused ) ).to.equal( 0 );
    expect( flagsOf( store, reused ) & ( FLAG_CHILD | FLAG_PARENT ) ).to.equal( 0 );
  });

  it('orders the parent draw permutation by (depth, slot)', function(){
    const store = new GraphStore();
    const s = addNodes( store, [ 'x1', 'outer', 'inner', 'x2', 'other', 'leaf1', 'leaf2' ] );

    store.setParent( s.inner, s.outer );
    store.setParent( s.leaf1, s.inner ); // outer(d0) > inner(d1) > leaf1
    store.setParent( s.leaf2, s.other ); // other(d0) > leaf2

    // depth 0 parents in slot order, then depth 1
    expect( Array.from( store.parentOrder() ) ).to.deep.equal( [ s.outer, s.other, s.inner ] );

    // reparenting rebuilds the permutation
    store.setParent( s.other, s.inner ); // other is now depth 2

    expect( Array.from( store.parentOrder() ) ).to.deep.equal( [ s.outer, s.inner, s.other ] );

    // removing the last child of a parent drops it from the permutation
    store.removeNode( s.leaf2 );

    expect( Array.from( store.parentOrder() ) ).to.deep.equal( [ s.outer, s.inner ] );
  });

  it('marks flags dirty on hierarchy changes', function(){
    const store = new GraphStore();
    const s = addNodes( store, [ 'p', 'a' ] );

    store.takeDelta(); // drain the adds

    store.setParent( s.a, s.p );

    const spans = store.takeDelta().spans.filter( sp => sp.column === 'node.flags' );

    expect( spans.length ).to.be.greaterThan( 0 );

    const covers = ( slot ) => spans.some( sp => sp.start <= slot && slot < sp.end );

    expect( covers( s.p ), 'parent flag span' ).to.equal( true );
    expect( covers( s.a ), 'child flag span' ).to.equal( true );
  });

});

describe('gpu/core: compound basics (round 14.1)', function(){

  it('hasCompoundNodes() reflects live parents', function(){
    const cy = cytoscape( { elements: {
      nodes: [ { data: { id: 'p' } }, { data: { id: 'a' } } ],
      edges: []
    } } );

    expect( cy.hasCompoundNodes() ).to.equal( false );

    const store = cy._store;

    store.setParent( cy.$id( 'a' )._first().slot, cy.$id( 'p' )._first().slot );

    expect( cy.hasCompoundNodes() ).to.equal( true );
  });

  it('reserves the parent data key: writes throw, reads synthesize', function(){
    const cy = cytoscape( { elements: {
      nodes: [ { data: { id: 'p' } }, { data: { id: 'a', weight: 3 } } ],
      edges: []
    } } );
    const a = cy.$id( 'a' );

    expect( () => a.data( 'parent', 'p' ) ).to.throw( /immutable|parent/ );
    expect( () => a.data( { parent: 'p' } ) ).to.throw( /immutable|parent/ );

    // orphan: no parent field synthesized
    expect( a.data( 'parent' ) ).to.equal( undefined );
    expect( a.data() ).to.not.have.property( 'parent' );

    cy._store.setParent( a._first().slot, cy.$id( 'p' )._first().slot );

    expect( a.data( 'parent' ) ).to.equal( 'p' );
    expect( a.data() ).to.have.property( 'parent', 'p' );
    expect( a.data( 'weight' ) ).to.equal( 3 ); // ordinary keys unaffected
  });

  it('drops the parent key from def data ingest (resolved as hierarchy in 14.2, never sidecar)', function(){
    const cy = cytoscape();

    cy.add( { data: { id: 'p' } } );
    cy.add( { data: { id: 'a', parent: 'zzz-not-yet-resolved' } } );

    // never lands in the sidecar: the read is synthesized (orphan => undefined)
    expect( cy.$id( 'a' ).data( 'parent' ) ).to.equal( undefined );
  });

});
