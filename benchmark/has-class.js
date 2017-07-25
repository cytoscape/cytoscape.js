var Suite = require('./suite');
var suite = new Suite('eles.hasClass()', {
  setup: function( cytoscape ){
    return cytoscape({ elements: require('./graphs/gal'), styleEnabled: false });
  }
});

suite
  .add( function( cy ) {
    cy.nodes().hasClass('foo');
  })
;
module.exports = suite;
