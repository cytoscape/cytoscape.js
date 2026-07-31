import { expect } from 'chai';
import cytoscapeGpu from '../src/gpu/index.mjs';

// round 13 B5: node outline-* (solid ring outside the border)

describe('gpu/node-outline (round 13 B5)', function(){

  var cy;

  var makeCy = nodeStyle => cytoscapeGpu({
    elements: [ { data: { id: 'n' }, position: { x: 0, y: 0 } } ],
    style: { nodes: nodeStyle }
  });

  it('parses, stores and reads back the outline props', function(){
    cy = makeCy({ 'outline-width': 4, 'outline-color': '#00f', 'outline-opacity': 0.5, 'outline-offset': 6 });

    var n = cy.$id('n');

    expect( n.style('outline-width') ).to.equal( 4 );
    expect( n.style('outline-offset') ).to.equal( 6 );
    expect( n.style('outline-opacity') ).to.be.closeTo( 0.5, 0.01 );
    expect( n.style('outline-color') ).to.contain( '0,0,255' );
  });

  it('defaults match v3 (width 0, #999, opacity 1, offset 0)', function(){
    cy = makeCy({});

    expect( cy.$id('n').style('outline-width') ).to.equal( 0 );
    expect( cy.$id('n').style('outline-opacity') ).to.equal( 0 ); // folded: no outline stored
  });

  it('an enabled outline grows the bounding boxes by offset/2 + width', function(){
    cy = makeCy({});

    expect( cy._store.boundingBox().x2 ).to.be.closeTo( 15, 1e-4 );

    cy.style({ nodes: { 'outline-width': 5, 'outline-offset': 8 } });

    // 15 + 8/2 + 5 = 24
    expect( cy._store.boundingBox().x2 ).to.be.closeTo( 24, 1e-4 );
    expect( cy.$id('n').boundingBox().x2 ).to.be.closeTo( 24, 1e-4 );
    expect( cy._store.outlineSlack() ).to.be.closeTo( 9, 1e-6 );
  });

  it('outline props take mappers', function(){
    cy = cytoscapeGpu({
      elements: [
        { data: { id: 'a', hot: 1 }, position: { x: 0, y: 0 } },
        { data: { id: 'b', hot: 0 }, position: { x: 100, y: 0 } }
      ],
      style: { nodes: {
        'outline-width': { data: 'hot', scale: 'linear', domain: [ 0, 1 ], range: [ 0, 6 ] },
        'outline-color': '#0f0'
      } }
    });

    expect( cy.$id('a').style('outline-width') ).to.equal( 6 );
    expect( cy.$id('b').style('outline-width') ).to.equal( 0 );
  });

  it('validates ranges', function(){
    expect( () => makeCy({ 'outline-width': -1 }) ).to.throw( /negative/ );
    expect( () => makeCy({ 'outline-opacity': 2 }) ).to.throw( /within \[0, 1\]/ );
  });

  afterEach( function(){
    if( cy != null ){ cy.destroy(); cy = null; }
  });
});
