import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

// round 14.7: structural terms — `parent`/`child` boolean query keys
// (pure flag scans over FLAG_PARENT/FLAG_CHILD) and the matching `case`
// mapper conditions ({ when: { parent: true } } / { child: true }).

// p > q > a ; b child of p ; c orphan leaf
const make = ( style ) => cytoscape( { elements: {
  nodes: [
    { data: { id: 'p' } },
    { data: { id: 'q', parent: 'p' } },
    { data: { id: 'a', parent: 'q' } },
    { data: { id: 'b', parent: 'p' } },
    { data: { id: 'c' } }
  ],
  edges: [ { data: { id: 'ab', source: 'a', target: 'b' } } ]
}, ...( style != null ? { style } : {} ) } );

const ids = ( eles ) => eles.map( e => e.id() ).sort();

describe('gpu/query: structural keys (round 14.7)', function(){

  it('answers parent/child boolean queries with flag scans', function(){
    const cy = make();

    expect( ids( cy.nodes( { parent: true } ) ) ).to.deep.equal( [ 'p', 'q' ] );
    expect( ids( cy.nodes( { parent: false } ) ) ).to.deep.equal( [ 'a', 'b', 'c' ] ); // childless
    expect( ids( cy.nodes( { child: true } ) ) ).to.deep.equal( [ 'a', 'b', 'q' ] );
    expect( ids( cy.nodes( { child: false } ) ) ).to.deep.equal( [ 'c', 'p' ] ); // orphans
    expect( ids( cy.nodes( { parent: true, child: true } ) ) ).to.deep.equal( [ 'q' ] );
  });

  it('composes with the other query keys', function(){
    const cy = make();

    cy.$id( 'q' ).select();
    cy.$id( 'c' ).select();

    expect( ids( cy.nodes( { parent: true, selected: true } ) ) ).to.deep.equal( [ 'q' ] );
    expect( ids( cy.elements( { parent: true } ) ) ).to.deep.equal( [ 'p', 'q' ] ); // edges never match
  });

  it('filters collections through the same plan', function(){
    const cy = make();

    expect( ids( cy.$id( 'p' ).descendants().filter( { child: true } ) ) )
      .to.deep.equal( [ 'a', 'b', 'q' ] );
    expect( ids( cy.$id( 'p' ).descendants().filter( { parent: true } ) ) ).to.deep.equal( [ 'q' ] );
  });

  it('throws for structural keys on the edges group', function(){
    const cy = make();

    expect( () => cy.edges( { parent: true } ) ).to.throw( /node/ );
    expect( () => cy.filter( { group: 'edges', child: true } ) ).to.throw( /node/ );
    expect( () => cy.nodes( { nope: true } ) ).to.throw( /Unknown query key/ );
  });

  it('evaluates structural case conditions', function(){
    const cy = make( { nodes: {
      backgroundColor: { case: [ { when: { child: true }, then: '#111111' } ], else: '#222222' }
    } } );

    expect( cy.$id( 'a' ).style( 'background-color' ) ).to.equal( 'rgb(17,17,17)' );
    expect( cy.$id( 'c' ).style( 'background-color' ) ).to.equal( 'rgb(34,34,34)' );
  });

  it('refreshes structural case values when hierarchy changes', function(){
    const cy = make( { nodes: {
      backgroundColor: { case: [ { when: { child: true }, then: '#111111' } ], else: '#222222' }
    } } );

    cy.$id( 'c' ).move( { parent: 'p' } );

    expect( cy.$id( 'c' ).style( 'background-color' ) ).to.equal( 'rgb(17,17,17)' );

    cy.$id( 'c' ).move( { parent: null } );

    expect( cy.$id( 'c' ).style( 'background-color' ) ).to.equal( 'rgb(34,34,34)' );
  });

  it('ANDs structural conditions with data conditions in one clause', function(){
    const cy = make( { nodes: {
      borderWidth: {
        case: [ { when: [ { child: true }, { data: 'w', gt: 5 } ], then: 9 } ],
        else: 0
      }
    } } );

    cy.$id( 'a' ).data( 'w', 10 );
    cy.$id( 'c' ).data( 'w', 10 );

    expect( cy.$id( 'a' ).style( 'border-width' ) ).to.equal( 9 ); // child + w>5
    expect( cy.$id( 'c' ).style( 'border-width' ) ).to.equal( 0 ); // orphan
    expect( cy.$id( 'b' ).style( 'border-width' ) ).to.equal( 0 ); // child, no w
  });

  it('rejects malformed structural conditions', function(){
    expect( () => make( { nodes: {
      borderWidth: { case: [ { when: { parent: true, data: 'x', eq: 1 }, then: 1 } ], else: 0 }
    } } ) ).to.throw();

    expect( () => make( { nodes: {
      borderWidth: { case: [ { when: { parent: 'yes' }, then: 1 } ], else: 0 }
    } } ) ).to.throw();
  });

});
