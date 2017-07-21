var Suite = require('./suite');
var suite = new Suite('eles.addClass(); ... eles.removeClass();', {
  setup: function( cytoscape ){
    return cytoscape({ elements: require('./graphs/gal'), styleEnabled: false });
  }
});

suite
  .add( function( cy ) {
    cy.nodes().addClass('foo bar');
    cy.nodes().removeClass('foo bar');
  })
;
module.exports = suite;
