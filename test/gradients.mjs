import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

// round 13 C2: background-fill / line-fill gradients

describe('gpu/gradients (round 13 C2)', function(){

  var cy;

  var makeCy = ( nodeStyle, edgeStyle ) => cytoscape({
    elements: [
      { data: { id: 'a' }, position: { x: 0, y: 0 } },
      { data: { id: 'b' }, position: { x: 100, y: 0 } },
      { data: { id: 'e', source: 'a', target: 'b' } }
    ],
    style: { nodes: nodeStyle ?? {}, edges: edgeStyle ?? {} }
  });

  it('stores a linear background gradient and reads it back', function(){
    cy = makeCy({
      'background-fill': 'linear-gradient',
      'background-gradient-stop-colors': '#f00 #00f',
      'background-gradient-direction': 'to-right'
    });

    var n = cy.$id('a');

    expect( n.style('background-fill') ).to.equal( 'linear-gradient' );
    expect( n.style('background-gradient-direction') ).to.equal( 'to-right' );
    expect( n.style('background-gradient-stop-colors') ).to.equal( 'rgb(255,0,0) rgb(0,0,255)' );
    // even spread when positions unset
    expect( n.style('background-gradient-stop-positions') ).to.equal( '0% 100%' );
    expect( cy._store.gradientCount() ).to.be.greaterThan( 0 );
  });

  it('explicit positions clamp monotone and read back as percents', function(){
    cy = makeCy({
      'background-fill': 'radial-gradient',
      'background-gradient-stop-colors': [ '#fff', '#000', '#fff' ],
      'background-gradient-stop-positions': [ 10, 5, 90 ]
    });

    // 5% pulls up to 10% (canvas semantics)
    expect( cy.$id('a').style('background-gradient-stop-positions') ).to.equal( '10% 10% 90%' );
  });

  it('background-fill without stop colors stays solid', function(){
    cy = makeCy({ 'background-fill': 'linear-gradient' });

    expect( cy.$id('a').style('background-fill') ).to.equal( 'solid' );
  });

  it('line gradients store with line-opacity folded into the stops', function(){
    cy = makeCy( null, {
      'line-fill': 'linear-gradient',
      'line-gradient-stop-colors': '#f00 #0f0',
      'line-opacity': 0.5
    } );

    var e = cy.$id('e');

    expect( e.style('line-fill') ).to.equal( 'linear-gradient' );

    var rec = cy._store.column('edge.gradient');
    var slot = cy._store.lookup('e').slot;

    expect( rec[ slot * 8 + 1 ] >>> 24 ).to.equal( 128 ); // folded alpha
  });

  it('caps stops at five with the extra entries dropped', function(){
    cy = makeCy({
      'background-fill': 'linear-gradient',
      'background-gradient-stop-colors': '#111 #222 #333 #444 #555 #666 #777'
    });

    var rec = cy._store.column('node.gradient');
    var slot = cy._store.lookup('a').slot;

    expect( ( rec[ slot * 8 ] >>> 5 ) & 7 ).to.equal( 5 );
  });

  it('validates keywords', function(){
    expect( () => makeCy({ 'background-fill': 'conic-gradient' }) ).to.throw( /background-fill/ );
    expect( () => makeCy({ 'background-gradient-direction': 'sideways' }) ).to.throw( /direction/ );
  });

  // round 30.1: the stop-position parser's guard.  The keyword props
  // above were pinned in round 13; the *numeric list* parser was not,
  // on either fill, so a non-numeric stop was unmeasured.
  it('rejects a non-numeric stop position on either fill', function(){
    expect( () => makeCy({
      'background-fill': 'linear-gradient',
      'background-gradient-stop-colors': '#f00 #00f',
      'background-gradient-stop-positions': '0% half'
    }) ).to.throw( /'half' is not a valid percent for 'background-gradient-stop-positions'/ );

    expect( () => makeCy( undefined, {
      'line-fill': 'linear-gradient',
      'line-gradient-stop-colors': '#f00 #00f',
      'line-gradient-stop-positions': [ 0, 'x' ]
    } ) ).to.throw( /is not a valid percent for 'line-gradient-stop-positions'/ );
  });

  afterEach( function(){
    if( cy != null ){ cy.destroy(); cy = null; }
  });
});
