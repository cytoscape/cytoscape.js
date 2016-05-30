var expect = require('chai').expect;
var cytoscape = require('../src', cytoscape);

describe('Core export', function(){

  var cy;

  // test setup
  beforeEach(function(done){
    cytoscape({
      styleEnabled: true,

      elements: {
        nodes: [
            { data: { id: "n1", foo: "bar" }, classes: "odd one" },
        ]
      },
      ready: function(){
        cy = this;

        done();
      }
    });
  });

  afterEach(function(){
    cy.destroy();
  });

  it('has all properties defined', function(){
    var json = cy.json();

    expect( json ).to.have.property('elements');
    expect( json ).to.have.property('renderer');
    expect( json ).to.have.property('minZoom').that.equals( cy.minZoom() );
    expect( json ).to.have.property('maxZoom').that.equals( cy.maxZoom() );
    expect( json ).to.have.property('zoomingEnabled').that.equals( cy.zoomingEnabled() );
    expect( json ).to.have.property('userZoomingEnabled').that.equals( cy.userZoomingEnabled() );
    expect( json ).to.have.property('panningEnabled').that.equals( cy.panningEnabled() );
    expect( json ).to.have.property('userPanningEnabled').that.equals( cy.userPanningEnabled() );
    expect( json ).to.have.property('boxSelectionEnabled').that.equals( cy.boxSelectionEnabled() );
    expect( json ).to.have.property('zoom').that.equals( cy.zoom() );
    expect( json ).to.have.property('pan').that.deep.equals( cy.pan() );
    expect( json ).to.have.property('style');

    // these are optional so not important to check
    // expect( json ).to.have.property('hideEdgesOnViewport');
    // expect( json ).to.have.property('hideLabelsOnViewport');
    // expect( json ).to.have.property('textureOnViewport');
    // expect( json ).to.have.property('wheelSensitivity');
    // expect( json ).to.have.property('motionBlur');

  });

});
