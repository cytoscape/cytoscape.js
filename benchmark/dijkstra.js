var Suite = require('./suite');
var suite = new Suite('eles.dijkstra()', {
  setup: function( cytoscape ){
    return cytoscape({ elements: require('./graphs/gal') });
  }
});

suite
  .add( function( cy ) {
    cy.elements().dijkstra({
      root: cy.$('#367')
    });
  })
;

module.exports = suite;
