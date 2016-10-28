var Suite = require('./suite');
var suite = new Suite('eles.dfs()', {
  setup: function( cytoscape ){
    return cytoscape({ elements: require('./graphs/gal') });
  }
});

suite
  .add( function( cy ) {
    cy.elements().dfs({
      root: cy.$('#367')
    });
  })
;

module.exports = suite;
