var eles, root;

var Suite = require('./suite');
var eles, root;
var suite = new Suite('eles.dfs()', {
  setup: function( cytoscape ){
    var cy = cytoscape({ elements: require('./graphs/gal') });

    eles = cy.elements();
    root = cy.$('#367');

    return cy;
  }
});

suite
  .add( function( cy ) {
    eles.dfs({
      root: root
    });
  })
;

module.exports = suite;
