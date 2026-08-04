import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

/*
Round 19.5 — the compaction trigger policy: automatic on the round-11
waste-over-half rule (dead slots exceeding the live count, past a floor
that keeps small graphs from churning), checked at safe boundaries (a
completed removal; the outermost endBatch) — plus the explicit
`cy.compact()` for apps that want deterministic timing.
*/

function makeCy( n ){
  const elements = [];

  for( let i = 0; i < n; i++ ){
    elements.push( { data: { id: `n${i}` }, position: { x: i, y: 0 } } );
  }

  return cytoscape( { elements } );
}

function removeRange( cy, from, to ){
  const doomed = cy.nodes().filter( ele => {
    const i = Number( ele.id().slice( 1 ) );

    return i >= from && i < to;
  } );

  doomed.remove();
}

describe( 'gpu: compaction triggers (19.5)', function(){

  it( 'auto-compacts when dead slots pass the floor and the live count', function(){
    const cy = makeCy( 2600 );

    removeRange( cy, 1200, 2600 ); // dead 1400 > floor and > live 1200

    expect( cy._store.highWater( 'nodes' ) ).to.equal( 1200 );
    expect( cy.nodes().length ).to.equal( 1200 );
    expect( cy.getElementById( 'n0' ).position() ).to.eql( { x: 0, y: 0 } );
  } );

  it( 'stays put below the floor (small graphs never churn)', function(){
    const cy = makeCy( 300 );

    removeRange( cy, 100, 300 ); // dead 200 > live 100, but under the floor

    expect( cy._store.highWater( 'nodes' ) ).to.equal( 300 );
  } );

  it( 'defers the auto trigger to the outermost endBatch', function(){
    const cy = makeCy( 2600 );

    cy.startBatch();
    removeRange( cy, 1200, 2600 );

    expect( cy._store.highWater( 'nodes' ) ).to.equal( 2600 ); // deferred

    cy.endBatch();

    expect( cy._store.highWater( 'nodes' ) ).to.equal( 1200 );
  } );

  it( 'compact() compacts on demand below the auto threshold', function(){
    const cy = makeCy( 100 );

    removeRange( cy, 60, 100 );

    expect( cy._store.highWater( 'nodes' ) ).to.equal( 100 );

    cy.compact();

    expect( cy._store.highWater( 'nodes' ) ).to.equal( 60 );

    cy.compact(); // idempotent no-op

    expect( cy._store.highWater( 'nodes' ) ).to.equal( 60 );
  } );

  it( 'compact() throws inside a batch', function(){
    const cy = makeCy( 10 );

    cy.startBatch();

    expect( () => cy.compact() ).to.throw( /batch/i );

    cy.endBatch();
  } );
} );
