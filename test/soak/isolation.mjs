import { expect } from 'chai';

import cytoscape from '../../src/index.mjs';

/*
Round 48.4: many instances on one page.

A real application is rarely one graph. It is a dashboard with six of them,
created and destroyed as views come and go, and every one of them assumes it
owns the world — its own id space, its own style, its own listeners. v4
makes that easy to get wrong in a way v3 did not: the store is columnar and
several of its structures are *shared-shaped* (the interned handle pool, the
id blob, dictionary columns), so a leak between instances would look like a
correctness bug a long way from its cause.

Nothing here is new API. What is new is that it is asserted: before this
round nothing in the suite ran two instances at once and checked they could
not see each other.
*/

const graph = ( ids, tag ) => ids.map( ( id, i ) => ( {
  data: { id, tag, n: i },
  position: { x: i * 10, y: 0 }
} ) );

describe( 'soak: multi-instance isolation', () => {
  it( 'gives each instance its own id space', () => {
    // The same ids in both, which is the case that would collide if the id
    // map were shared — and the realistic one, since two views of the same
    // data use the same element ids.
    const a = cytoscape( { elements: graph( [ 'x', 'y', 'z' ], 'a' ) } );
    const b = cytoscape( { elements: graph( [ 'x', 'y', 'z' ], 'b' ) } );

    expect( a.$id( 'x' ).data( 'tag' ) ).to.equal( 'a' );
    expect( b.$id( 'x' ).data( 'tag' ) ).to.equal( 'b' );

    a.$id( 'x' ).data( 'tag', 'changed' );

    expect( b.$id( 'x' ).data( 'tag' ), 'a write reached the other instance' ).to.equal( 'b' );

    a.destroy();
    b.destroy();
  } );

  it( 'refuses to compare elements across instances (round 48.4)', () => {
    // What this spec found, and why it is here rather than asserting
    // `same() === false`: identity keys on a packed `{ group, slot, gen }`,
    // all three of which are per instance, so the first node of one graph
    // and the first node of another packed identically. `same()` answered
    // true, `intersection()` returned everything, `difference()` returned
    // nothing, and `union()` silently dropped the other graph's elements —
    // two graphs of two nodes united to two.
    //
    // A collection belongs to one core, so v4 refuses rather than inventing
    // a cross-instance identity. Round 29.3 added this same guard for the
    // same reason one round over: these methods "crashed on `other._refs`
    // — or, in `same()`'s case, quietly returned false, which reads as
    // working code".
    const a = cytoscape( { elements: graph( [ 'x', 'y' ], 'a' ) } );
    const b = cytoscape( { elements: graph( [ 'x', 'y' ], 'b' ) } );

    const crossing = {
      same: () => a.$id( 'x' ).same( b.$id( 'x' ) ),
      anySame: () => a.nodes().anySame( b.nodes() ),
      contains: () => a.nodes().contains( b.$id( 'x' ) ),
      indexOf: () => a.nodes().indexOf( b.$id( 'x' ) ),
      union: () => a.nodes().union( b.nodes() ),
      intersection: () => a.nodes().intersection( b.nodes() ),
      difference: () => a.nodes().difference( b.nodes() ),
      symmetricDifference: () => a.nodes().symmetricDifference( b.nodes() ),
      diff: () => a.nodes().diff( b.nodes() ),
      allAreNeighbors: () => a.nodes().allAreNeighbors( b.nodes() ),
      edgesWith: () => a.$id( 'x' ).edgesWith( b.$id( 'y' ) ),
      edgesTo: () => a.$id( 'x' ).edgesTo( b.$id( 'y' ) )
    };

    for( const [ name, call ] of Object.entries( crossing ) ){
      expect( call, `${name}() accepted a collection from another instance` )
        .to.throw( /from the same instance/ );
    }

    // control: the identical calls within one instance still work
    expect( a.$id( 'x' ).same( a.$id( 'x' ) ) ).to.equal( true );
    expect( a.$id( 'x' ).same( a.$id( 'y' ) ) ).to.equal( false );
    expect( a.nodes().union( a.nodes() ).length ).to.equal( 2 );
    expect( a.nodes().difference( a.$id( 'x' ) ).length ).to.equal( 1 );

    a.destroy();
    b.destroy();
  } );

  it( 'keeps writes, style and selection to one instance', () => {
    const a = cytoscape( { elements: graph( [ 'x', 'y' ], 'a' ) } );
    const b = cytoscape( { elements: graph( [ 'x', 'y' ], 'b' ) } );

    a.style( { nodes: { 'background-color': '#ff0000', width: 77 } } );
    a.$id( 'x' ).select();
    a.$id( 'y' ).position( { x: 999, y: 999 } );

    expect( b.$id( 'x' ).style( 'width' ), 'style crossed instances' ).to.not.equal( 77 );
    expect( b.$id( 'x' ).selected(), 'selection crossed instances' ).to.equal( false );
    expect( b.$id( 'y' ).position().x, 'a position write crossed instances' ).to.equal( 10 );

    a.destroy();
    b.destroy();
  } );

  it( 'delivers events only to the instance they happened on', () => {
    const a = cytoscape( { elements: graph( [ 'x' ], 'a' ) } );
    const b = cytoscape( { elements: graph( [ 'x' ], 'b' ) } );
    const seen = { a: 0, b: 0 };

    a.on( 'data', () => seen.a++ );
    b.on( 'data', () => seen.b++ );

    a.$id( 'x' ).data( 'k', 1 );

    expect( seen ).to.deep.equal( { a: 1, b: 0 } );

    b.$id( 'x' ).data( 'k', 1 );

    expect( seen ).to.deep.equal( { a: 1, b: 1 } );

    a.destroy();
    b.destroy();
  } );

  it( 'leaves its neighbours working when one is destroyed, in either order', () => {
    const instances = [ 'a', 'b', 'c', 'd' ].map( tag =>
      cytoscape( { elements: graph( [ 'x', 'y', 'z' ], tag ) } ) );

    // destroy the middle first, then the ends inwards — the orders a view
    // stack actually produces
    instances[ 1 ].destroy();

    for( const i of [ 0, 2, 3 ] ){
      expect( instances[ i ].destroyed(), `instance ${i} died with its neighbour` ).to.equal( false );
      expect( instances[ i ].$id( 'x' ).data( 'n' ) ).to.equal( 0 );
      expect( instances[ i ].elements().length ).to.equal( 3 );
    }

    instances[ 3 ].destroy();
    instances[ 0 ].destroy();

    expect( instances[ 2 ].destroyed() ).to.equal( false );
    expect( instances[ 2 ].nodes().map( n => n.id() ).sort() ).to.deep.equal( [ 'x', 'y', 'z' ] );

    instances[ 2 ].destroy();
  } );

  it( 'compacts one instance without disturbing another', () => {
    // Compaction moves slots and re-keys the interned handle pool, which is
    // the most invasive thing an instance does to itself — and the one most
    // likely to reach across if any of that state were shared.
    const ids = Array.from( { length: 3000 }, ( _, i ) => `n${i}` );
    const a = cytoscape( { elements: graph( ids, 'a' ) } );
    const b = cytoscape( { elements: graph( ids, 'b' ) } );
    const held = b.nodes();

    a.nodes().slice( 0, 2500 ).remove();
    a.compact();

    expect( b.nodes().length, 'compacting one instance changed another' ).to.equal( 3000 );
    expect( held.length ).to.equal( 3000 );
    expect( b.$id( 'n2999' ).data( 'tag' ) ).to.equal( 'b' );
    expect( b.$id( 'n2999' ).position().x ).to.equal( 2999 * 10 );
    expect( a.nodes().length ).to.equal( 500 );

    a.destroy();
    b.destroy();
  } );

  it( 'survives many instances alive at once', () => {
    // Not a leak test — that is lifecycle.mjs — but the shape a dashboard
    // has: several live at once, each queried, then torn down.
    const many = [];

    for( let i = 0; i < 40; i++ ){
      many.push( cytoscape( { elements: graph( [ 'x', 'y', 'z' ], `t${i}` ) } ) );
    }

    many.forEach( ( cy, i ) => {
      expect( cy.$id( 'x' ).data( 'tag' ) ).to.equal( `t${i}` );
      expect( cy.elements().length ).to.equal( 3 );
    } );

    many.forEach( cy => cy.destroy() );
    many.forEach( cy => expect( cy.destroyed() ).to.equal( true ) );
  } );
} );
