import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

describe('gpu/core: viewport gating booleans', function(){

  var cy;

  beforeEach(function(){
    cy = cytoscape({ elements: [ { data: { id: 'n1' } } ] });
  });

  it('defaults are all true', function(){
    expect( cy.panningEnabled() ).to.equal( true );
    expect( cy.userPanningEnabled() ).to.equal( true );
    expect( cy.zoomingEnabled() ).to.equal( true );
    expect( cy.userZoomingEnabled() ).to.equal( true );
    expect( cy.boxSelectionEnabled() ).to.equal( true );
  });

  it('getters/setters return the core when setting', function(){
    expect( cy.panningEnabled( false ) ).to.equal( cy );
    expect( cy.panningEnabled() ).to.equal( false );
  });

  it('panningEnabled(false) blocks pan() and panBy()', function(){
    cy.pan({ x: 10, y: 10 });
    cy.panningEnabled( false );

    cy.pan({ x: 99, y: 99 });
    expect( cy.pan() ).to.deep.equal({ x: 10, y: 10 });

    cy.panBy({ x: 5, y: 5 });
    expect( cy.pan() ).to.deep.equal({ x: 10, y: 10 });

    cy.panningEnabled( true );
    cy.pan({ x: 20, y: 20 });
    expect( cy.pan() ).to.deep.equal({ x: 20, y: 20 });
  });

  it('zoomingEnabled(false) blocks zoom()', function(){
    cy.zoom( 2 );
    cy.zoomingEnabled( false );

    cy.zoom( 5 );
    expect( cy.zoom() ).to.equal( 2 );

    cy.zoomingEnabled( true );
    cy.zoom( 3 );
    expect( cy.zoom() ).to.equal( 3 );
  });

  it('user*Enabled do not affect the programmatic API', function(){
    cy.userPanningEnabled( false );
    cy.userZoomingEnabled( false );

    cy.pan({ x: 7, y: 8 });
    cy.zoom( 4 );

    expect( cy.pan() ).to.deep.equal({ x: 7, y: 8 });
    expect( cy.zoom() ).to.equal( 4 );
  });

  it('constructor options', function(){
    var cy2 = cytoscape({
      panningEnabled: false, zoomingEnabled: false,
      userPanningEnabled: false, userZoomingEnabled: false, boxSelectionEnabled: false
    });

    expect( cy2.panningEnabled() ).to.equal( false );
    expect( cy2.zoomingEnabled() ).to.equal( false );
    expect( cy2.userPanningEnabled() ).to.equal( false );
    expect( cy2.userZoomingEnabled() ).to.equal( false );
    expect( cy2.boxSelectionEnabled() ).to.equal( false );
  });

});
