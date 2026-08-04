import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

// round 13 D1: font-style + font-weight — global constants like
// font-family (the glyph atlas rasters one face)

describe('gpu/style: font-style + font-weight (round 13 D1)', function(){

  var cy;

  var makeCy = nodeStyle => cytoscape({
    elements: [ { data: { id: 'n' }, position: { x: 0, y: 0 } } ],
    style: nodeStyle == null ? undefined : { nodes: nodeStyle }
  });

  it('parses and reads back both props', function(){
    cy = makeCy({ 'label': 'n', 'font-style': 'italic', 'font-weight': 'bold' });

    var n = cy.$id('n');

    expect( n.style('font-style') ).to.equal( 'italic' );
    expect( n.style('font-weight') ).to.equal( 'bold' );
  });

  it('defaults to normal/normal (v3)', function(){
    cy = makeCy( null );

    expect( cy.$id('n').style('font-style') ).to.equal( 'normal' );
    expect( cy.$id('n').style('font-weight') ).to.equal( 'normal' );
  });

  it('accepts numeric hundred weights, as strings or numbers', function(){
    cy = makeCy({ 'font-weight': 700 });

    expect( cy.$id('n').style('font-weight') ).to.equal( '700' );

    cy.style({ nodes: { 'font-weight': '300' } });

    expect( cy.$id('n').style('font-weight') ).to.equal( '300' );
  });

  it('throws on invalid values', function(){
    expect( () => makeCy({ 'font-style': 'slanted' }) ).to.throw( /font-style/ );
    expect( () => makeCy({ 'font-weight': 'heavy' }) ).to.throw( /font-weight/ );
    expect( () => makeCy({ 'font-weight': 450 }) ).to.throw( /font-weight/ );
  });

  it('is global: the store carries the face for the atlas', function(){
    cy = makeCy({ 'label': 'n', 'font-style': 'oblique', 'font-weight': 200 });

    expect( cy._store.labelFontStyle ).to.equal( 'oblique' );
    expect( cy._store.labelFontWeight ).to.equal( '200' );
  });

  it('a face change re-queues every labelled slot for glyph rebuild', function(){
    cy = makeCy({ 'label': 'n' });

    cy._store.takeLabelDirty( 'nodes' ); // drain the initial layout queue

    cy.style({ nodes: { 'label': 'n', 'font-weight': 'bold' } });

    expect( Array.from( cy._store.takeLabelDirty( 'nodes' ) ) ).to.include( 0 );
  });

  it('throws on the edges group and on mappers (global constants)', function(){
    expect( () => cytoscape({ style: { edges: { 'font-style': 'italic' } } }) )
      .to.throw( /node style property/ );
    expect( () => makeCy({ 'font-weight': { data: 'w' } }) )
      .to.throw( /constant only/ );
  });

  afterEach( function(){
    if( cy != null ){ cy.destroy(); cy = null; }
  });
});
