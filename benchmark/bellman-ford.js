var Suite = require('./suite');
var suite = new Suite('eles.bellmanFord()', {
  setup: function( cytoscape ){
    return cytoscape({ elements: require('./graphs/gal') });
  }
});

suite
  .add( function( cy ) {
    cy.elements().bellmanFord({
      root: cy.$('#367')
    });
  })
;

module.exports = suite;
