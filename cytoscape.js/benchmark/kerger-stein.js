var Suite = require('./suite');
var suite = new Suite('eles.kargerStein()', {
  setup: function( cytoscape ){
    return cytoscape({ elements: require('./graphs/gal') });
  }
});

suite
  .add( function( cy ) {
    cy.elements().kargerStein({
    });
  })
;

module.exports = suite;
