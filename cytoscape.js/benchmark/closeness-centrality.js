var Suite = require('./suite');
var suite = new Suite('eles.closenessCentrality()', {
  setup: function( cytoscape ){
    return cytoscape({ elements: require('./graphs/gal') });
  }
});

suite
  .add( function( cy ) {
    cy.elements().closenessCentrality({
      root: cy.$('#367')
    });
  })
;

module.exports = suite;
