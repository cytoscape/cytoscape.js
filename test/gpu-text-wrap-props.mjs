import { expect } from 'chai';
import cytoscapeGpu from '../src/gpu/index.mjs';

// round 16.2: the wrap prop family on the label sidecar — parse,
// v3 defaults, auto-justification resolution, readback, mappers, and
// the store's estimated label dims (the headless bb term's input).

const mk = ( style, elements ) => cytoscapeGpu( {
  elements: elements ?? [
    { data: { id: 'a' } }, { data: { id: 'b' } },
    { data: { id: 'ab', source: 'a', target: 'b' } }
  ],
  style
} );

const entryOf = ( cy, id, stream = 'nodes' ) =>
  cy._store.labelAt( cy._store.lookup( id ).slot, stream );

const dimsOf = ( cy, id, stream = 'nodes' ) =>
  cy._store.labelDimsAt( cy._store.lookup( id ).slot, stream );

describe('gpu/style: text wrap props (round 16.2)', function(){

  it('parses the wrap family onto the label sidecar', function(){
    const cy = mk( { nodes: {
      'label': 'hello world wrapping',
      'text-wrap': 'wrap',
      'text-max-width': 40,
      'line-height': 1.5,
      'text-overflow-wrap': 'anywhere',
      'text-justification': 'left'
    } } );
    const entry = entryOf( cy, 'a' );

    expect( entry.wrap ).to.equal( 1 );
    expect( entry.maxWidth ).to.equal( 40 );
    expect( entry.lineHeight ).to.equal( 1.5 );
    expect( entry.overflowWrap ).to.equal( 1 );
    expect( entry.justification ).to.equal( 0 ); // left
  });

  it('applies the v3 defaults', function(){
    const cy = mk( { nodes: { 'label': 'plain' } } );
    const entry = entryOf( cy, 'a' );

    expect( entry.wrap ).to.equal( 0 ); // none
    expect( entry.maxWidth ).to.equal( 9999 );
    expect( entry.lineHeight ).to.equal( 1 );
    expect( entry.overflowWrap ).to.equal( 0 ); // whitespace
    expect( entry.justification ).to.equal( 1 ); // auto @ center halign -> center
  });

  it("resolves justification 'auto' against text-halign (v3)", function(){
    // a label hanging left of its node right-justifies, and vice versa
    const left = mk( { nodes: { 'label': 'x', 'text-halign': 'left' } } );
    const right = mk( { nodes: { 'label': 'x', 'text-halign': 'right' } } );

    expect( entryOf( left, 'a' ).justification ).to.equal( 2 ); // right
    expect( entryOf( right, 'a' ).justification ).to.equal( 0 ); // left
  });

  it('reads back through the sidecar, with sheet fallbacks unlabelled', function(){
    const cy = mk( { nodes: {
      'label': 'text', 'text-wrap': 'ellipsis', 'text-max-width': 80,
      'line-height': 2, 'text-overflow-wrap': 'anywhere', 'text-justification': 'right'
    } } );
    const a = cy.$id( 'a' );

    expect( a.style( 'text-wrap' ) ).to.equal( 'ellipsis' );
    expect( a.style( 'text-max-width' ) ).to.equal( 80 );
    expect( a.style( 'line-height' ) ).to.equal( 2 );
    expect( a.style( 'text-overflow-wrap' ) ).to.equal( 'anywhere' );
    expect( a.style( 'text-justification' ) ).to.equal( 'right' );

    const bare = mk( {} ).$id( 'a' );

    expect( bare.style( 'text-wrap' ) ).to.equal( 'none' );
    expect( bare.style( 'text-max-width' ) ).to.equal( 9999 );
    expect( bare.style( 'text-justification' ) ).to.equal( 'auto' );
  });

  it('takes mappers on the scalar/enum forms', function(){
    const cy = mk(
      { nodes: {
        'label': 'some longer label text',
        'text-wrap': 'wrap',
        'text-max-width': { data: 'w' }
      } },
      [ { data: { id: 'a', w: 30 } }, { data: { id: 'b', w: 300 } } ]
    );

    expect( entryOf( cy, 'a' ).maxWidth ).to.equal( 30 );
    expect( entryOf( cy, 'b' ).maxWidth ).to.equal( 300 );
  });

  it('estimates label dims into the store (the headless bb input)', function(){
    const cy = mk( { nodes: { 'label': 'four words of text', 'font-size': 16 } } );
    const single = dimsOf( cy, 'a' );

    expect( single ).to.not.equal( null );
    expect( single.exact ).to.equal( false ); // headless: estimated
    expect( single.w ).to.be.greaterThan( 0 );
    expect( single.h ).to.equal( 16 ); // one line = the em

    cy.style( { nodes: {
      'label': 'four words of text', 'font-size': 16,
      'text-wrap': 'wrap', 'text-max-width': 60, 'line-height': 1.25
    } } );

    const wrapped = dimsOf( cy, 'a' );

    expect( wrapped.h ).to.be.greaterThan( single.h ); // multiple lines
    expect( wrapped.w ).to.be.lessThan( single.w );
    // height follows the estimator's formula: (n-1)·fs·lh + fs
    expect( ( wrapped.h - 16 ) % ( 16 * 1.25 ) ).to.be.closeTo( 0, 1e-6 );
  });

  it('re-estimates dims when a mapped label refreshes on a data write', function(){
    const cy = mk(
      { nodes: { 'label': { data: 'name' } } },
      [ { data: { id: 'a', name: 'ab' } } ]
    );
    const short = dimsOf( cy, 'a' ).w;

    cy.$id( 'a' ).data( 'name', 'a considerably longer label' );

    expect( dimsOf( cy, 'a' ).w ).to.be.greaterThan( short );
  });

  it('clears dims with the label', function(){
    const cy = mk( { nodes: { 'label': 'x' } } );

    expect( dimsOf( cy, 'a' ) ).to.not.equal( null );

    cy.style( { nodes: {} } );

    expect( dimsOf( cy, 'a' ) ).to.equal( null );
  });

  it('upgrades to exact dims via setLabelDims until the label rewrites', function(){
    const cy = mk( { nodes: { 'label': 'text' } } );
    const slot = cy._store.lookup( 'a' ).slot;

    cy._store.setLabelDims( slot, 'nodes', 123, 45 );

    expect( dimsOf( cy, 'a' ) ).to.deep.equal( { w: 123, h: 45, exact: true } );

    // 25.5: a pure font-size change with unchanged breaking (wrap none)
    // is scale-linear — the dims patch by the ratio and *keep* their
    // exactness (16 → 20 = ×1.25)
    cy.style( { nodes: { 'label': 'text', 'font-size': 20 } } );

    expect( dimsOf( cy, 'a' ).exact ).to.equal( true );
    expect( dimsOf( cy, 'a' ).w ).to.be.closeTo( 123 * 1.25, 1e-6 );
    expect( dimsOf( cy, 'a' ).h ).to.be.closeTo( 45 * 1.25, 1e-6 );

    // a text change re-estimates (the renderer feeds exact dims back
    // after the next glyph build)
    cy.style( { nodes: { 'label': 'other text', 'font-size': 20 } } );

    expect( dimsOf( cy, 'a' ).exact ).to.equal( false );
  });

  it('carries the wrap family on edge labels too', function(){
    const cy = mk( { edges: {
      'label': 'edge label text', 'text-wrap': 'wrap', 'text-max-width': 50
    } } );
    const entry = entryOf( cy, 'ab', 'edges' );

    expect( entry.wrap ).to.equal( 1 );
    expect( entry.maxWidth ).to.equal( 50 );
    expect( dimsOf( cy, 'ab', 'edges' ) ).to.not.equal( null );
  });

  // round 30.1: the wrap family's keyword guard.  All three props share
  // one `parseKeyword` closure, and until this spec nothing in the suite
  // had ever taken its throw — a typo in any of them was unmeasured.
  it('rejects an unsupported keyword, listing the supported set', function(){
    expect( () => mk( { nodes: { 'label': 'x', 'text-wrap': 'wrapp' } } ) )
      .to.throw( /text-wrap.*unsupported.*none, wrap, ellipsis/ );
    expect( () => mk( { nodes: { 'label': 'x', 'text-overflow-wrap': 'break-word' } } ) )
      .to.throw( /text-overflow-wrap.*unsupported/ );
    expect( () => mk( { nodes: { 'label': 'x', 'text-justification': 'justify' } } ) )
      .to.throw( /text-justification.*unsupported/ );

    // control: the v3 keywords each prop does accept still compile
    const ok = mk( { nodes: {
      'label': 'x', 'text-wrap': 'ellipsis',
      'text-overflow-wrap': 'anywhere', 'text-justification': 'right'
    } } );

    expect( entryOf( ok, 'a' ).wrap ).to.equal( 2 );
    ok.destroy();
  });

});
