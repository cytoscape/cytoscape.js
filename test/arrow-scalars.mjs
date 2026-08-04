import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

// round 13 B7: arrow-scale, arrow-fill, arrow-width

describe('gpu/arrow-scalars (round 13 B7)', function(){

  var cy;

  var makeCy = edgeStyle => cytoscape({
    elements: [
      { data: { id: 'a' }, position: { x: 0, y: 0 } },
      { data: { id: 'b' }, position: { x: 100, y: 0 } },
      { data: { id: 'e', source: 'a', target: 'b' } }
    ],
    style: { edges: Object.assign( { 'target-arrow-shape': 'triangle' }, edgeStyle ) }
  });

  it('packs scale and fill into the shapes word; reads back', function(){
    cy = makeCy({ 'arrow-scale': 2, 'target-arrow-fill': 'hollow' });

    var word = cy._store.column('edge.arrowShapes')[ cy._store.lookup('e').slot ];

    expect( word >>> 24 ).to.equal( 32 ); // 2 × 16
    expect( ( word >>> 17 ) & 1 ).to.equal( 1 );
    expect( ( word >>> 16 ) & 1 ).to.equal( 0 );

    var e = cy.$id('e');

    expect( e.style('arrow-scale') ).to.equal( 2 );
    expect( e.style('target-arrow-fill') ).to.equal( 'hollow' );
    expect( e.style('source-arrow-fill') ).to.equal( 'filled' );
  });

  it('resolves arrow widths: px, match-line and percent', function(){
    cy = makeCy({ 'width': 6, 'source-arrow-width': 2, 'target-arrow-width': 'match-line' });

    var e = cy.$id('e');

    expect( e.style('source-arrow-width') ).to.equal( 2 );
    expect( e.style('target-arrow-width') ).to.equal( 6 );

    cy.style({ edges: { 'width': 8, 'target-arrow-shape': 'triangle', 'target-arrow-width': '50%' } });

    expect( cy.$id('e').style('target-arrow-width') ).to.equal( 4 );
  });

  it('defaults: scale 1, filled, width 1 (v3)', function(){
    cy = makeCy({});

    expect( cy.$id('e').style('arrow-scale') ).to.equal( 1 );
    expect( cy.$id('e').style('target-arrow-fill') ).to.equal( 'filled' );
    expect( cy.$id('e').style('target-arrow-width') ).to.equal( 1 );
  });

  it('tracks the monotone arrow-scale max for the quad bound', function(){
    cy = makeCy({ 'arrow-scale': 3 });

    expect( cy._store.arrowScaleMax() ).to.equal( 3 );
  });

  it('scale and fill take mappers', function(){
    cy = cytoscape({
      elements: [
        { data: { id: 'a' }, position: { x: 0, y: 0 } },
        { data: { id: 'b' }, position: { x: 100, y: 0 } },
        { data: { id: 'e1', source: 'a', target: 'b', big: 1 } },
        { data: { id: 'e2', source: 'a', target: 'b', big: 0 } }
      ],
      style: { edges: {
        'target-arrow-shape': 'triangle',
        'arrow-scale': { data: 'big', scale: 'linear', domain: [ 0, 1 ], range: [ 1, 2 ] },
        'target-arrow-fill': { case: [ { when: { data: 'big', eq: 1 }, then: 'hollow' } ], else: 'filled' }
      } }
    });

    expect( cy.$id('e1').style('arrow-scale') ).to.equal( 2 );
    expect( cy.$id('e2').style('arrow-scale') ).to.equal( 1 );
    expect( cy.$id('e1').style('target-arrow-fill') ).to.equal( 'hollow' );
  });

  it('validates keywords and positivity', function(){
    expect( () => makeCy({ 'arrow-scale': 0 }) ).to.throw( /positive/ );
    expect( () => makeCy({ 'target-arrow-fill': 'wireframe' }) ).to.throw( /arrow-fill/ );
  });

  afterEach( function(){
    if( cy != null ){ cy.destroy(); cy = null; }
  });
});
