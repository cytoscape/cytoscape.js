var Suite = require('./suite');
var suite = new Suite('eles.degreeCentrality()', {
  setup: function( cytoscape ){
    return cytoscape({ elements: require('./graphs/gal') });
  }
});

suite
  .add( function( cy ) {
    cy.elements().degreeCentrality({
      root: cy.$('#367')
    });
  })
;

module.exports = suite;
