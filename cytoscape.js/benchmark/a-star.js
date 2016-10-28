var Suite = require('./suite');
var suite = new Suite('eles.aStar()', {
  setup: function( cytoscape ){
    return cytoscape({ elements: require('./graphs/gal') });
  }
});

suite
  .add( function( cy ) {
    cy.elements().aStar({
      root: cy.$('#367'),
      goal: cy.$('#381')
    });
  })
;

module.exports = suite;
