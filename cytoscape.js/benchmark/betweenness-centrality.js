var Suite = require('./suite');
var suite = new Suite('eles.betweennessCentrality()', {
  setup: function( cytoscape ){
    return cytoscape({ elements: require('./graphs/gal') });
  }
});

suite
  .add( function( cy ) {
    cy.elements().betweennessCentrality({
      root: cy.$('#269')
    });
  })
;

module.exports = suite;
