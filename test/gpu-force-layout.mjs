import { expect } from 'chai';
import cytoscapeGpu from '../src/gpu/index.mjs';

// round 18.2: the built-in `force` layout — the extension contract's
// first production consumer.  CPU executor (the reference sim);
// deterministic under a seed; leaves-only under compounds; locked
// nodes pin; live mode streams positions and stop() settles early.

const RING = ( n = 12 ) => {
  const elements = [];

  for( let i = 0; i < n; i++ ){
    elements.push( { data: { id: 'n' + i } } );
    elements.push( { data: { id: 'e' + i, source: 'n' + i, target: 'n' + ( ( i + 1 ) % n ) } } );
  }

  return elements;
};

describe('gpu/layout: the force layout (round 18.2)', function(){

  it('lays out, fits and completes the lifecycle', async function(){
    const cy = cytoscapeGpu( { elements: RING() } );
    const log = [];

    for( const type of [ 'layoutstart', 'layoutready', 'layoutstop' ] ){
      cy.on( type, () => log.push( type ) );
    }

    await cy.layout( { name: 'force', seed: 5 } ).run().promise();

    expect( log ).to.deep.equal( [ 'layoutstart', 'layoutready', 'layoutstop' ] );

    // a laid-out ring spreads: every link lands near the ideal length
    const nodes = cy.nodes();

    for( let i = 0; i < 12; i++ ){
      const a = cy.$id( 'n' + i ).position();
      const b = cy.$id( 'n' + ( ( i + 1 ) % 12 ) ).position();

      expect( Math.hypot( b.x - a.x, b.y - a.y ) ).to.be.within( 30, 120 );
    }

    // fit applied (the default): the viewport moved off zoom 1 / pan 0
    const pan = cy.pan();

    expect( cy.zoom() !== 1 || pan.x !== 0 || pan.y !== 0 ).to.equal( true );
    expect( nodes.length ).to.equal( 12 );
  });

  it('is deterministic under a seed', async function(){
    const run = async () => {
      const cy = cytoscapeGpu( { elements: RING() } );

      await cy.layout( { name: 'force', seed: 42, fit: false } ).run().promise();

      return cy.nodes().map( n => {
        const p = n.position();

        return [ p.x, p.y ];
      } );
    };

    expect( await run() ).to.deep.equal( await run() );
  });

  it('resolves per-edge lengths through a plain function', async function(){
    const cy = cytoscapeGpu( { elements: [
      { data: { id: 'a' } }, { data: { id: 'b' } }, { data: { id: 'c' } },
      { data: { id: 'short', source: 'a', target: 'b', len: 40 } },
      { data: { id: 'long', source: 'b', target: 'c', len: 160 } }
    ] } );

    await cy.layout( {
      name: 'force', seed: 3, fit: false,
      edgeLength: edge => edge.data( 'len' )
    } ).run().promise();

    const d = id => {
      const e = cy.$id( id );
      const s = e.source().position();
      const t = e.target().position();

      return Math.hypot( t.x - s.x, t.y - s.y );
    };

    expect( d( 'long' ) ).to.be.greaterThan( d( 'short' ) * 1.5 );
  });

  it('pins locked nodes in place', async function(){
    const cy = cytoscapeGpu( { elements: RING() } );

    cy.$id( 'n0' ).position( { x: 500, y: 500 } ).lock();

    await cy.layout( { name: 'force', seed: 1, fit: false } ).run().promise();

    expect( cy.$id( 'n0' ).position() ).to.deep.equal( { x: 500, y: 500 } );
    // and the ring still relaxed around the pin
    expect( cy.$id( 'n6' ).position() ).to.not.deep.equal( { x: 0, y: 0 } );
  });

  it('simulates leaves only under compounds', async function(){
    const cy = cytoscapeGpu( { elements: [
      { data: { id: 'p' } },
      { data: { id: 'a', parent: 'p' } },
      { data: { id: 'b', parent: 'p' } },
      { data: { id: 'ab', source: 'a', target: 'b' } }
    ] } );

    await cy.layout( { name: 'force', seed: 2, fit: false } ).run().promise();

    // the parent's box derives from its placed children
    const p = cy.$id( 'p' );
    const a = cy.$id( 'a' ).position();
    const b = cy.$id( 'b' ).position();
    const bb = p.boundingBox( { includeLabels: false } );

    expect( a.x ).to.be.within( bb.x1, bb.x2 );
    expect( b.x ).to.be.within( bb.x1, bb.x2 );
  });

  it('scopes to a subset via eles.layout', async function(){
    const cy = cytoscapeGpu( { elements: RING( 8 ) } );

    cy.$id( 'n7' ).position( { x: 9999, y: 9999 } );

    const scope = cy.elements().difference( cy.$id( 'n7' ) )
      .difference( cy.$id( 'e6' ) ).difference( cy.$id( 'e7' ) );

    await scope.layout( { name: 'force', seed: 1, fit: false } ).run().promise();

    // the out-of-scope node never moved
    expect( cy.$id( 'n7' ).position() ).to.deep.equal( { x: 9999, y: 9999 } );
  });

  it('streams positions in live mode and settles on stop()', async function(){
    const cy = cytoscapeGpu( { elements: RING() } );
    const layout = cy.layout( { name: 'force', seed: 4, animate: true, fit: false } );
    const snapshots = [];

    layout.run();

    // the sim streams through the bulk slot path (which, as recorded,
    // emits no per-node position events) — sample the live column
    for( let i = 0; i < 5; i++ ){
      await new Promise( resolve => setTimeout( resolve, 25 ) );
      snapshots.push( cy.$id( 'n0' ).position().x );
    }

    expect( new Set( snapshots ).size ).to.be.greaterThan( 1 );

    layout.stop();
    await layout.promise();

    expect( cy.$id( 'n0' ).position().x ).to.be.a( 'number' );
  });

});
