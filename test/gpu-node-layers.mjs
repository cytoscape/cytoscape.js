import { expect } from 'chai';
import cytoscapeGpu from '../src/gpu/index.mjs';

// round 13 A2 (nodes): overlay/underlay theming props

describe('gpu/node-layers: overlay + underlay (round 13 A2)', function(){

  var cy;

  var makeCy = nodeStyle => cytoscapeGpu({
    elements: [ { data: { id: 'n' }, position: { x: 0, y: 0 } } ],
    style: nodeStyle == null ? undefined : { nodes: nodeStyle }
  });

  it('parses and reads back the overlay props (color folded with opacity)', function(){
    cy = makeCy({
      'overlay-color': '#ff0000', 'overlay-opacity': 0.5, 'overlay-padding': 12,
      'overlay-shape': 'ellipse', 'overlay-corner-radius': 6
    });

    var n = cy.$id('n');

    expect( n.style('overlay-color') ).to.equal( 'rgba(255,0,0,0.502)' );
    expect( n.style('overlay-opacity') ).to.be.closeTo( 0.5, 0.01 );
    expect( n.style('overlay-padding') ).to.equal( 12 );
    expect( n.style('overlay-shape') ).to.equal( 'ellipse' );
    expect( n.style('overlay-corner-radius') ).to.equal( 6 );
  });

  it('defaults match v3: opacity 0, padding 10, round-rectangle, auto radius', function(){
    cy = makeCy( null );

    var n = cy.$id('n');

    expect( n.style('overlay-opacity') ).to.equal( 0 );
    expect( n.style('overlay-padding') ).to.equal( 10 );
    expect( n.style('overlay-shape') ).to.equal( 'round-rectangle' );
    expect( n.style('overlay-corner-radius') ).to.equal( 'auto' );
    expect( n.style('underlay-opacity') ).to.equal( 0 );
  });

  it('tracks per-layer enabled counts', function(){
    cy = makeCy({ 'overlay-opacity': 0.25 });

    expect( cy._store.overlayCount() ).to.equal( 1 );
    expect( cy._store.underlayCount() ).to.equal( 0 );

    cy.style({ nodes: { 'underlay-opacity': 0.25 } });

    expect( cy._store.overlayCount() ).to.equal( 0 );
    expect( cy._store.underlayCount() ).to.equal( 1 );
  });

  it('an enabled layer grows the bb by its padding', function(){
    cy = makeCy( null );

    expect( cy._store.boundingBox().x2 ).to.be.closeTo( 15, 1e-4 );

    cy.style({ nodes: { 'overlay-opacity': 0.3, 'overlay-padding': 25 } });

    expect( cy._store.boundingBox().x2 ).to.be.closeTo( 40, 1e-4 );
  });

  it('a zero-opacity layer never affects bounds', function(){
    cy = makeCy({ 'overlay-padding': 50 }); // opacity 0

    expect( cy._store.boundingBox().x2 ).to.be.closeTo( 15, 1e-4 );
  });

  it('edge layers: color/opacity/padding apply; shape props throw', function(){
    cy = cytoscapeGpu({
      elements: [
        { data: { id: 'a' }, position: { x: 0, y: 0 } },
        { data: { id: 'b' }, position: { x: 100, y: 0 } },
        { data: { id: 'e', source: 'a', target: 'b' } }
      ],
      style: { edges: {
        'width': 4, 'overlay-color': '#0f0', 'overlay-opacity': 0.5, 'overlay-padding': 6
      } }
    });

    var e = cy.$id('e');

    expect( e.style('overlay-opacity') ).to.be.closeTo( 0.5, 0.01 );
    expect( e.style('overlay-padding') ).to.be.closeTo( 6, 0.01 );
    expect( cy._store.edgeOverlayCount() ).to.equal( 1 );
    expect( cy._store.edgeUnderlayCount() ).to.equal( 0 );

    // the stored stroke = width + 2·padding
    var rec = cy._store.column('edge.overlay');
    var slot = cy._store.lookup('e').slot;

    expect( rec[ slot * 2 + 1 ] / 256 ).to.be.closeTo( 16, 0.01 );

    expect( () => cytoscapeGpu({ style: { edges: { 'overlay-shape': 'ellipse' } } }) )
      .to.throw( /node style property/ );
  });

  it('validates shape keywords, radius and opacity range', function(){
    expect( () => makeCy({ 'overlay-shape': 'star' }) ).to.throw( /round-rectangle or ellipse/ );
    expect( () => makeCy({ 'overlay-opacity': 2 }) ).to.throw( /within \[0, 1\]/ );
    expect( () => makeCy({ 'overlay-corner-radius': -2 }) ).to.throw( /negative/ );
  });

  it('overlay props take mappers', function(){
    cy = cytoscapeGpu({
      elements: [
        { data: { id: 'a', hot: 1 }, position: { x: 0, y: 0 } },
        { data: { id: 'b', hot: 0 }, position: { x: 100, y: 0 } }
      ],
      style: { nodes: {
        'overlay-opacity': { data: 'hot', scale: 'linear', domain: [ 0, 1 ], range: [ 0, 0.4 ] },
        'overlay-color': '#00f'
      } }
    });

    expect( cy.$id('a').style('overlay-opacity') ).to.be.closeTo( 0.4, 0.01 );
    expect( cy.$id('b').style('overlay-opacity') ).to.equal( 0 );
    expect( cy._store.overlayCount() ).to.equal( 1 );
  });

  afterEach( function(){
    if( cy != null ){ cy.destroy(); cy = null; }
  });
});
