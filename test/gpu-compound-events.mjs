import { expect } from 'chai';
import cytoscapeGpu from '../src/gpu/index.mjs';

// round 14.5: event bubbling — element events bubble child -> ancestors
// -> core with v3 semantics (event.target stays the originator, the
// callback context is the phase element, stopPropagation/return-false
// halts, predicates keep their fire-once core-phase delegation).

// gp > p > a; q top-level leaf; edge a-q
const make = () => cytoscapeGpu( { elements: {
  nodes: [
    { data: { id: 'gp' } },
    { data: { id: 'p', parent: 'gp' } },
    { data: { id: 'a', parent: 'p' } },
    { data: { id: 'q' } }
  ],
  edges: [ { data: { id: 'aq', source: 'a', target: 'q' } } ]
} } );

describe('gpu/events: compound bubbling (round 14.5)', function(){

  it('bubbles child -> ancestors -> core, in that order', function(){
    const cy = make();
    const order = [];

    cy.$id( 'a' ).on( 'foo', () => order.push( 'a' ) );
    cy.$id( 'p' ).on( 'foo', () => order.push( 'p' ) );
    cy.$id( 'gp' ).on( 'foo', () => order.push( 'gp' ) );
    cy.on( 'foo', () => order.push( 'core' ) );

    cy.$id( 'a' ).emit( 'foo' );

    expect( order ).to.deep.equal( [ 'a', 'p', 'gp', 'core' ] );
  });

  it('keeps event.target as the originator; the callback context is the phase element', function(){
    const cy = make();
    const seen = [];

    cy.$id( 'p' ).on( 'foo', function( e ){
      seen.push( [ this.id(), e.target.id() ] );
    } );

    cy.$id( 'a' ).emit( 'foo' );

    expect( seen ).to.deep.equal( [ [ 'p', 'a' ] ] );
  });

  it('halts on return false from a lower phase (v3)', function(){
    const cy = make();
    const order = [];

    cy.$id( 'a' ).on( 'foo', () => { order.push( 'a' ); return false; } );
    cy.$id( 'p' ).on( 'foo', () => order.push( 'p' ) );
    cy.on( 'foo', () => order.push( 'core' ) );

    cy.$id( 'a' ).emit( 'foo' );

    expect( order ).to.deep.equal( [ 'a' ] );
  });

  it('halts on stopPropagation() mid-chain', function(){
    const cy = make();
    const order = [];

    cy.$id( 'a' ).on( 'foo', () => order.push( 'a' ) );
    cy.$id( 'p' ).on( 'foo', ( e ) => { order.push( 'p' ); e.stopPropagation(); } );
    cy.$id( 'gp' ).on( 'foo', () => order.push( 'gp' ) );
    cy.on( 'foo', () => order.push( 'core' ) );

    cy.$id( 'a' ).emit( 'foo' );

    expect( order ).to.deep.equal( [ 'a', 'p' ] );
  });

  it('fires core predicates once, against the originator (delegation)', function(){
    const cy = make();
    const seen = [];

    cy.on( 'foo', ( ele ) => ele.isNode(), ( e ) => seen.push( e.target.id() ) );

    cy.$id( 'a' ).emit( 'foo' );

    expect( seen ).to.deep.equal( [ 'a' ] ); // once, not once per phase
  });

  it('bubbles built-in element events (data) through parents', function(){
    const cy = make();
    const order = [];

    cy.$id( 'p' ).on( 'data', ( e ) => order.push( [ 'p', e.target.id() ] ) );
    cy.on( 'data', ( e ) => order.push( [ 'core', e.target.id() ] ) );

    cy.$id( 'a' ).data( 'k', 1 );

    expect( order ).to.deep.equal( [ [ 'p', 'a' ], [ 'core', 'a' ] ] );
  });

  it('keeps edges and orphans flat', function(){
    const cy = make();
    const order = [];

    cy.$id( 'aq' ).on( 'foo', () => order.push( 'edge' ) );
    cy.$id( 'q' ).on( 'foo', () => order.push( 'q' ) );
    cy.on( 'foo', () => order.push( 'core' ) );

    cy.$id( 'aq' ).emit( 'foo' );
    cy.$id( 'q' ).emit( 'foo' );

    expect( order ).to.deep.equal( [ 'edge', 'core', 'q', 'core' ] );
  });

  it('changes nothing in compound-free graphs', function(){
    const cy = cytoscapeGpu( { elements: {
      nodes: [ { data: { id: 'x' } }, { data: { id: 'y' } } ],
      edges: [ { data: { id: 'xy', source: 'x', target: 'y' } } ]
    } } );
    const order = [];

    cy.$id( 'x' ).on( 'foo', function( e ){ order.push( [ this.id(), e.target.id() ] ); } );
    cy.on( 'foo', ( e ) => order.push( [ 'core', e.target.id() ] ) );

    cy.$id( 'x' ).emit( 'foo' );

    expect( order ).to.deep.equal( [ [ 'x', 'x' ], [ 'core', 'x' ] ] );
  });

  it('a reparent mid-flight does not confuse later emits (chain read per emit)', function(){
    const cy = make();
    const order = [];

    cy.$id( 'gp' ).on( 'foo', () => order.push( 'gp' ) );
    cy.on( 'foo', () => order.push( 'core' ) );

    cy.$id( 'a' ).move( { parent: null } );
    cy.$id( 'a' ).emit( 'foo' );

    expect( order ).to.deep.equal( [ 'core' ] ); // orphan: flat emit
  });

});
