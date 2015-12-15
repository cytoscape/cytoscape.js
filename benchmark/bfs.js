var Suite = require('./suite');
var suite = new Suite('eles.bfs()', {
  setup: function( cytoscape ){
    return cytoscape({ elements: require('./graphs/gal') });
  }
});

suite
  .add( function( cy ) {
    cy.elements().bfs({
      root: cy.$('#367')
    });
  })
;

module.exports = suite;
