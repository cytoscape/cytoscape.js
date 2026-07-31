import { expect } from 'chai';
import cytoscapeGpu from '../src/gpu/index.mjs';

// round 13 C1: mid-source/mid-target arrows

describe('gpu/mid-arrows (round 13 C1)', function(){

  var cy;

  var makeCy = edgeStyle => cytoscapeGpu({
    elements: [
      { data: { id: 'a' }, position: { x: 0, y: 0 } },
      { data: { id: 'b' }, position: { x: 100, y: 0 } },
      { data: { id: 'e', source: 'a', target: 'b' } }
    ],
    style: { edges: edgeStyle }
  });

  it('packs mid shapes into bits 18..23 and stores folded colors', function(){
    cy = makeCy({
      'mid-target-arrow-shape': 'diamond', 'mid-target-arrow-color': '#f00',
      'mid-source-arrow-shape': 'tee', 'mid-source-arrow-color': '#00f',
      'opacity': 0.5
    });

    var slot = cy._store.lookup('e').slot;
    var word = cy._store.column('edge.arrowShapes')[ slot ];

    expect( ( word >>> 18 ) & 7 ).to.equal( 7 ); // tee
    expect( ( word >>> 21 ) & 7 ).to.equal( 6 ); // diamond

    var tgt = cy._store.column('edge.midTargetArrow');

    expect( tgt[ slot * 4 ] ).to.equal( 255 );
    expect( tgt[ slot * 4 + 3 ] ).to.equal( 128 ); // opacity folded

    expect( cy._store.midArrowCount() ).to.equal( 1 );
  });

  it('reads back shapes and colors (transparent reads none)', function(){
    cy = makeCy({ 'mid-target-arrow-shape': 'circle', 'mid-target-arrow-color': '#0f0' });

    var e = cy.$id('e');

    expect( e.style('mid-target-arrow-shape') ).to.equal( 'circle' );
    expect( e.style('mid-source-arrow-shape') ).to.equal( 'none' );
    expect( e.style('mid-target-arrow-color') ).to.contain( '0,255,0' );

    cy.style({ edges: {} });

    expect( cy.$id('e').style('mid-target-arrow-shape') ).to.equal( 'none' );
    expect( cy._store.midArrowCount() ).to.equal( 0 );
  });

  it('mid props take mappers', function(){
    cy = cytoscapeGpu({
      elements: [
        { data: { id: 'a' }, position: { x: 0, y: 0 } },
        { data: { id: 'b' }, position: { x: 100, y: 0 } },
        { data: { id: 'e1', source: 'a', target: 'b', dir: 1 } },
        { data: { id: 'e2', source: 'a', target: 'b', dir: 0 } }
      ],
      style: { edges: {
        'mid-target-arrow-shape': {
          case: [ { when: { data: 'dir', eq: 1 }, then: 'triangle' } ], else: 'none'
        },
        'mid-target-arrow-color': '#f0f'
      } }
    });

    expect( cy.$id('e1').style('mid-target-arrow-shape') ).to.equal( 'triangle' );
    expect( cy.$id('e2').style('mid-target-arrow-shape') ).to.equal( 'none' );
    expect( cy._store.midArrowCount() ).to.equal( 1 );
  });

  afterEach( function(){
    if( cy != null ){ cy.destroy(); cy = null; }
  });
});
