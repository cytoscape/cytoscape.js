import { expect } from 'chai';
import cytoscapeGpu from '../src/gpu/index.mjs';

// viewport animation targets: cy.animate({ fit }) / ({ center }), cy.animation(),
// boundingBoxAt, and the animated layout fit
describe('gpu/viewport animation targets', function(){

  var cy;

  beforeEach(function(){
    cy = cytoscapeGpu({
      elements: [
        { data: { id: 'a' }, position: { x: 0, y: 0 } },
        { data: { id: 'b' }, position: { x: 100, y: 50 } },
        { data: { id: 'c' }, position: { x: 300, y: 200 } },
        { data: { id: 'ab', source: 'a', target: 'b' } }
      ]
    });
  });

  it('cy.animate({ fit }) animates to the fitting viewport', async function(){
    var want = cy.getFitViewport( undefined, 20 );

    cy.animate({ fit: { padding: 20 }, duration: 40 });

    await cy.promiseOn('viewport'); // starts moving

    // wait for the queue to drain
    while( cy.animated() ){
      await new Promise( r => setTimeout( r, 10 ) );
    }

    expect( cy.zoom() ).to.be.closeTo( want.zoom, 1e-9 );
    expect( cy.pan().x ).to.be.closeTo( want.pan.x, 1e-9 );
    expect( cy.pan().y ).to.be.closeTo( want.pan.y, 1e-9 );
  });

  it('cy.animation({ fit: { eles } }) resolves through the handle promise', async function(){
    var sub = cy.$id('a').union( cy.$id('b') );
    var want = cy.getFitViewport( sub, 0 );

    await cy.animation({ fit: { eles: sub }, duration: 40 }).play();

    expect( cy.zoom() ).to.be.closeTo( want.zoom, 1e-9 );
    expect( cy.pan().x ).to.be.closeTo( want.pan.x, 1e-9 );
  });

  it('cy.animation({ fit: { boundingBox } }) fits an explicit box', async function(){
    await cy.animation({
      fit: { boundingBox: { x1: 0, y1: 0, w: 100, h: 100 }, padding: 0 },
      duration: 40
    }).play();

    // 800x600 viewport fitting a 100x100 box: zoom limited by height
    expect( cy.zoom() ).to.be.closeTo( 6, 1e-9 );
  });

  it('cy.animate({ center }) animates the centering pan at the current zoom', async function(){
    cy.zoom( 2 );

    var want = cy.getCenterPan( cy.$id('c'), 2 );

    await cy.animation({ center: { eles: cy.$id('c') }, duration: 40 }).play();

    expect( cy.zoom() ).to.equal( 2 );
    expect( cy.pan().x ).to.be.closeTo( want.x, 1e-9 );
    expect( cy.pan().y ).to.be.closeTo( want.y, 1e-9 );
  });

  it('fit targets resolve when the animation is created, as v3', async function(){
    var want = cy.getFitViewport( undefined, 0 );
    var ani = cy.animation({ fit: {}, duration: 40 });

    // moving a node afterwards must not change the resolved target
    cy.$id('c').position({ x: 5000, y: 5000 });

    await ani.play();

    expect( cy.zoom() ).to.be.closeTo( want.zoom, 1e-9 );
  });

  describe('eles.boundingBoxAt()', function(){
    it('computes the box at hypothetical positions without moving nodes', function(){
      var before = { ...cy.$id('a').position() };

      var bb = cy.nodes().boundingBoxAt( ( node, i ) => ( { x: i * 100, y: 0 } ) );
      var w = cy.$id('a').outerWidth();
      var h = cy.$id('a').outerHeight();

      expect( bb.x1 ).to.equal( 0 - w / 2 );
      expect( bb.x2 ).to.equal( 200 + w / 2 );
      expect( bb.y1 ).to.equal( 0 - h / 2 );
      expect( bb.y2 ).to.equal( 0 + h / 2 );

      expect( cy.$id('a').position() ).to.deep.equal( before ); // untouched
    });

    it('accepts one shared position', function(){
      var bb = cy.nodes().boundingBoxAt({ x: 10, y: 10 });
      var w = cy.$id('a').outerWidth();

      expect( bb.w ).to.equal( w );
      expect( bb.x1 ).to.equal( 10 - w / 2 );
    });

    it('edges span endpoints outside the collection at their current positions', function(){
      // only node a + edge ab in the collection; b stays at (100, 50)
      var sub = cy.$id('a').union( cy.$id('ab') );
      var bb = sub.boundingBoxAt( () => ( { x: -500, y: 0 } ) );

      expect( bb.x2 ).to.be.at.least( 100 ); // b's current x
      expect( bb.x1 ).to.be.below( -500 + 1 );
    });
  });

  it('layout animate: true animates the fit to the final arrangement', async function(){
    // reference: non-animated layout with fit
    cy.layout({ name: 'circle', radius: 100, avoidOverlap: false, padding: 30 }).run();

    var wantZoom = cy.zoom();
    var wantPan = { ...cy.pan() };

    // scatter + dezoom, then animate back
    cy.layout({ name: 'random', fit: false }).run();
    cy.zoom( 0.1 );

    var stopped = cy.promiseOn('layoutstop');

    cy.layout({
      name: 'circle', radius: 100, avoidOverlap: false, padding: 30,
      animate: true, animationDuration: 40
    }).run();

    await stopped;

    expect( cy.zoom() ).to.be.closeTo( wantZoom, 1e-3 );
    expect( cy.pan().x ).to.be.closeTo( wantPan.x, 1e-1 );
    expect( cy.pan().y ).to.be.closeTo( wantPan.y, 1e-1 );
  });
});
