import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

// round 13 D3: text-valign/text-halign — v3's 3x3 node-label anchor grid

describe('gpu/style: text-valign + text-halign (round 13 D3)', function(){

  var cy;

  var makeCy = nodeStyle => cytoscape({
    elements: [ { data: { id: 'n' }, position: { x: 0, y: 0 } } ],
    style: { nodes: Object.assign( { 'label': 'n', 'width': 40, 'height': 20 }, nodeStyle ) }
  });

  it('parses and reads back both props', function(){
    cy = makeCy({ 'text-halign': 'left', 'text-valign': 'top' });

    expect( cy.$id('n').style('text-halign') ).to.equal( 'left' );
    expect( cy.$id('n').style('text-valign') ).to.equal( 'top' );
  });

  it('defaults to center / bottom (v4 keeps the below-node placement)', function(){
    cy = makeCy( null );

    expect( cy.$id('n').style('text-halign') ).to.equal( 'center' );
    expect( cy.$id('n').style('text-valign') ).to.equal( 'bottom' );
  });

  it('throws on invalid keywords and on the edges group', function(){
    expect( () => makeCy({ 'text-halign': 'above' }) ).to.throw( /text-halign/ );
    expect( () => makeCy({ 'text-valign': 'left' }) ).to.throw( /text-valign/ );
    expect( () => cytoscape({ style: { edges: { 'text-valign': 'top' } } }) )
      .to.throw( /node style property/ );
  });

  it('bakes the anchor bases and block-fraction shifts into the sidecar', function(){
    cy = makeCy({ 'text-halign': 'left', 'text-valign': 'top' });

    var entry = cy._store.labelAt( 0, 'nodes' );

    // width 40 -> anchor at the left edge; run's right edge lands there
    expect( entry.anchorX ).to.equal( -20 );
    expect( entry.halignShift ).to.equal( -0.5 );
    // height 20 -> base above the top edge (margin 4); block shifts fully up
    expect( entry.anchorY ).to.equal( -14 );
    expect( entry.valignShift ).to.equal( -1 );
  });

  it('center/center anchors on the node center', function(){
    cy = makeCy({ 'text-halign': 'center', 'text-valign': 'center' });

    var entry = cy._store.labelAt( 0, 'nodes' );

    expect( entry.anchorX ).to.equal( 0 );
    expect( entry.halignShift ).to.equal( 0 );
    expect( entry.anchorY ).to.equal( 0 );
    expect( entry.valignShift ).to.equal( -0.5 );
  });

  it('takes mappers (per-element placement)', function(){
    cy = cytoscape({
      elements: [
        { data: { id: 'up', v: 'top' }, position: { x: 0, y: 0 } },
        { data: { id: 'down', v: 'bottom' }, position: { x: 100, y: 0 } }
      ],
      style: { nodes: {
        'label': 'x',
        'text-valign': { case: [ { when: { data: 'v', eq: 'top' }, then: 'top' } ], else: 'bottom' }
      } }
    });

    expect( cy.$id('up').style('text-valign') ).to.equal( 'top' );
    expect( cy.$id('down').style('text-valign') ).to.equal( 'bottom' );
  });

  afterEach( function(){
    if( cy != null ){ cy.destroy(); cy = null; }
  });
});
