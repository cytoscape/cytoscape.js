import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

// round 13 B4: line-outline casing

describe('gpu/edge-casing (round 13 B4)', function(){

  var cy;

  var makeCy = edgeStyle => cytoscape({
    elements: [
      { data: { id: 'a' }, position: { x: 0, y: 0 } },
      { data: { id: 'b' }, position: { x: 100, y: 0 } },
      { data: { id: 'e', source: 'a', target: 'b' } }
    ],
    style: { edges: edgeStyle }
  });

  it('parses, stores and reads back the casing props', function(){
    cy = makeCy({ 'width': 4, 'line-outline-width': 6, 'line-outline-color': '#00f' });

    var e = cy.$id('e');

    expect( e.style('line-outline-width') ).to.equal( 6 );
    expect( e.style('line-outline-color') ).to.equal( 'rgb(0,0,255)' );
    expect( cy._store.casingCount() ).to.equal( 1 );

    var rec = cy._store.column('edge.casing');
    var slot = cy._store.lookup('e').slot;

    expect( rec[ slot * 2 + 1 ] / 256 ).to.be.closeTo( 10, 0.01 ); // width + outline
  });

  it('defaults: no casing (width 0), black', function(){
    cy = makeCy({});

    expect( cy.$id('e').style('line-outline-width') ).to.equal( 0 );
    expect( cy._store.casingCount() ).to.equal( 0 );
  });

  it('the casing alpha folds opacity × line-opacity (v3 effectiveLineOpacity)', function(){
    cy = makeCy({ 'line-outline-width': 4, 'opacity': 0.5, 'line-opacity': 0.5 });

    var rec = cy._store.column('edge.casing');
    var slot = cy._store.lookup('e').slot;

    expect( rec[ slot * 2 ] >>> 24 ).to.equal( 64 ); // 255 × 0.25
  });

  it('an enabled casing demotes the opacity mapper off the GPU kernel', function(){
    cy = makeCy({
      'line-outline-width': 4,
      'opacity': { data: 'x', scale: 'linear', domain: [ 0, 1 ], range: [ 0, 1 ] }
    });

    expect( cy._styleEngine.paintInputs('edges').some( i => i.m.prop === 'opacity' ) )
      .to.equal( false );
  });

  it('casing props take mappers', function(){
    cy = cytoscape({
      elements: [
        { data: { id: 'a' }, position: { x: 0, y: 0 } },
        { data: { id: 'b' }, position: { x: 100, y: 0 } },
        { data: { id: 'e1', source: 'a', target: 'b', hot: 1 } },
        { data: { id: 'e2', source: 'a', target: 'b', hot: 0 } }
      ],
      style: { edges: {
        'line-outline-width': { data: 'hot', scale: 'linear', domain: [ 0, 1 ], range: [ 0, 8 ] },
        'line-outline-color': '#f00'
      } }
    });

    expect( cy.$id('e1').style('line-outline-width') ).to.equal( 8 );
    expect( cy.$id('e2').style('line-outline-width') ).to.equal( 0 );
    expect( cy._store.casingCount() ).to.equal( 1 );
  });

  afterEach( function(){
    if( cy != null ){ cy.destroy(); cy = null; }
  });
});
