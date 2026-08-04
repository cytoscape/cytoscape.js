import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

describe('gpu/core: viewport setters & math', function(){

  var cy;

  beforeEach(function(){
    cy = cytoscape({
      elements: [
        { data: { id: 'n1' }, position: { x: 0, y: 0 } },
        { data: { id: 'n2' }, position: { x: 100, y: 100 } }
      ],
      headlessWidth: 200,
      headlessHeight: 200
    });
  });

  it('reset() sets zoom 1, pan (0,0)', function(){
    cy.zoom( 3 );
    cy.pan({ x: 50, y: 60 });
    cy.reset();

    expect( cy.zoom() ).to.equal( 1 );
    expect( cy.pan() ).to.deep.equal({ x: 0, y: 0 });
  });

  it('viewport({zoom, pan}) sets both and emits once each', function(){
    var events = [];
    cy.on('zoom pan viewport', e => events.push( e.type ));

    cy.viewport({ zoom: 2, pan: { x: 5, y: 5 } });

    expect( cy.zoom() ).to.equal( 2 );
    expect( cy.pan() ).to.deep.equal({ x: 5, y: 5 });
    expect( events ).to.deep.equal(['zoom', 'pan', 'viewport']);
  });

  it('minZoom/maxZoom getter and setter', function(){
    cy.minZoom( 0.5 );
    cy.maxZoom( 4 );

    expect( cy.minZoom() ).to.equal( 0.5 );
    expect( cy.maxZoom() ).to.equal( 4 );
  });

  it('setting maxZoom re-clamps the current zoom', function(){
    cy.zoom( 10 );
    cy.maxZoom( 4 );

    expect( cy.zoom() ).to.equal( 4 );
  });

  it('zoomRange(min, max)', function(){
    cy.zoomRange( 0.25, 8 );
    expect( cy.minZoom() ).to.equal( 0.25 );
    expect( cy.maxZoom() ).to.equal( 8 );

    cy.zoomRange({ min: 1, max: 2 });
    expect( cy.minZoom() ).to.equal( 1 );
    expect( cy.maxZoom() ).to.equal( 2 );
  });

  it('renderedExtent()', function(){
    expect( cy.renderedExtent() ).to.deep.equal({ x1: 0, y1: 0, x2: 200, y2: 200, w: 200, h: 200 });
  });

  it('size()', function(){
    expect( cy.size() ).to.deep.equal({ width: 200, height: 200 });
  });

  it('getFitViewport() computes without applying', function(){
    var before = cy.zoom();
    var vp = cy.getFitViewport();

    expect( vp ).to.have.property('zoom');
    expect( vp ).to.have.property('pan');
    // not applied
    expect( cy.zoom() ).to.equal( before );

    // applying fit() should match the computed viewport
    cy.fit();
    expect( cy.zoom() ).to.be.closeTo( vp.zoom, 1e-9 );
    expect( cy.pan().x ).to.be.closeTo( vp.pan.x, 1e-9 );
  });

  it('getFitViewport() is null when empty', function(){
    expect( cy.collection().length ).to.equal( 0 );
    // empty selector target
    expect( cy.getFitViewport( cy.collection() ) ).to.equal( null );
  });

  it('getCenterPan() computes the centering pan', function(){
    cy.zoom( 1 );
    var pan = cy.getCenterPan();

    // bb center is (50,50); centered in 200x200 at zoom 1 => pan (50,50)
    expect( pan.x ).to.be.closeTo( 50, 1e-9 );
    expect( pan.y ).to.be.closeTo( 50, 1e-9 );
  });

  it('centre alias', function(){
    expect( cy.centre ).to.equal( cy.center );
  });

});
