var Suite = require('./suite');
var suite = new Suite('eles.pageRank()', {
  setup: function( cytoscape ){
    return cytoscape({ elements: require('./graphs/gal') });
  }
});

suite
  .add( function( cy ) {
    cy.elements().pageRank({
    });
  })
;

module.exports = suite;
