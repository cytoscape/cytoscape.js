var Suite = require('./suite');
var suite = new Suite('eles.classes()', {
  setup: function( cytoscape ){
    return cytoscape({ elements: require('./graphs/gal'), styleEnabled: false });
  }
});

suite
  .add( function( cy ) {
    cy.nodes().classes('foo bar');
  })
;
module.exports = suite;
