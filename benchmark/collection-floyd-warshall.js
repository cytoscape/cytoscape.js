var Suite = require('./suite');
var suite = new Suite('eles.floydWarshall()', {
  setup: function( cytoscape ){
    return cytoscape({ elements: require('./graphs/gal') });
  }
});

suite
  .add( function( cy ) {
    cy.elements().floydWarshall({
    });
  })
;

module.exports = suite;
