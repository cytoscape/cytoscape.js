var expect = require('chai').expect;
var cytoscape = require('../../src', cytoscape);

var cytoscapeBrowserify;

try {
  cytoscapeBrowserify = require('../../build/cytoscape.js', cytoscape);
} catch(err){}

describe('Core initialisation', function(){

  it('inits via browserify build', function( done ){
    expect( cytoscapeBrowserify.version ).to.equal( cytoscape.version );

    var cy = cytoscapeBrowserify({ headless: true, elements: [ {} ] });

    cy.ready(function(){
      expect( cy.elements().size() ).to.equal( 1 );

      done();
    });
  });


});
