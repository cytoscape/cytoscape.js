import { expect } from 'chai';
import cytoscapeGpu from '../src/gpu/index.mjs';

// round 13 B6: text-transform, text-border-*, text-background-shape

describe('gpu/label-box (round 13 B6)', function(){

  var cy;

  var makeCy = nodeStyle => cytoscapeGpu({
    elements: [ { data: { id: 'n', name: 'Ada' }, position: { x: 0, y: 0 } } ],
    style: { nodes: nodeStyle }
  });

  it('text-transform rewrites the glyph run text', function(){
    cy = makeCy({ 'label': { data: 'name' }, 'text-transform': 'uppercase' });

    expect( cy._store.labelAt( cy._store.lookup('n').slot ).text ).to.equal( 'ADA' );
    expect( cy.$id('n').style('text-transform') ).to.equal( 'uppercase' );

    cy.style({ nodes: { 'label': { data: 'name' }, 'text-transform': 'lowercase' } });

    expect( cy._store.labelAt( cy._store.lookup('n').slot ).text ).to.equal( 'ada' );
  });

  it('text-border folds opacity into the stored border color', function(){
    cy = makeCy({
      'label': 'x', 'text-background-color': '#ff0', 'text-background-opacity': 1,
      'text-border-width': 2, 'text-border-color': '#f00', 'text-border-opacity': 0.5
    });

    var entry = cy._store.labelAt( cy._store.lookup('n').slot );

    expect( entry.bgBorderWidth ).to.equal( 2 );
    expect( ( entry.bgBorderColor >>> 24 ) & 0xff ).to.equal( 128 );
    expect( cy.$id('n').style('text-border-width') ).to.equal( 2 );
    expect( cy.$id('n').style('text-border-opacity') ).to.be.closeTo( 0.5, 0.01 );
  });

  it('text-background-shape stores and reads back', function(){
    cy = makeCy({
      'label': 'x', 'text-background-color': '#0f0', 'text-background-opacity': 1,
      'text-background-shape': 'round-rectangle'
    });

    expect( cy._store.labelAt( cy._store.lookup('n').slot ).bgShape ).to.equal( 1 );
    expect( cy.$id('n').style('text-background-shape') ).to.equal( 'round-rectangle' );
  });

  it('defaults match v3 (none, rectangle, border 0 at opacity 0)', function(){
    cy = makeCy({ 'label': 'x' });

    expect( cy.$id('n').style('text-transform') ).to.equal( 'none' );
    expect( cy.$id('n').style('text-background-shape') ).to.equal( 'rectangle' );
    expect( cy.$id('n').style('text-border-width') ).to.equal( 0 );
  });

  it('the B6 props take mappers (case on data)', function(){
    cy = cytoscapeGpu({
      elements: [
        { data: { id: 'a', shout: 1, name: 'hi' }, position: { x: 0, y: 0 } },
        { data: { id: 'b', shout: 0, name: 'hi' }, position: { x: 100, y: 0 } }
      ],
      style: { nodes: {
        'label': { data: 'name' },
        'text-transform': { case: [ { when: { data: 'shout', eq: 1 }, then: 'uppercase' } ], else: 'none' }
      } }
    });

    expect( cy._store.labelAt( cy._store.lookup('a').slot ).text ).to.equal( 'HI' );
    expect( cy._store.labelAt( cy._store.lookup('b').slot ).text ).to.equal( 'hi' );
  });

  it('validates keywords', function(){
    expect( () => makeCy({ 'text-transform': 'shouting' }) ).to.throw( /text-transform/ );
    expect( () => makeCy({ 'text-background-shape': 'circle' }) ).to.throw( /text-background-shape/ );
  });

  afterEach( function(){
    if( cy != null ){ cy.destroy(); cy = null; }
  });
});
