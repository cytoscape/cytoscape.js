var eles, root;

var Suite = require('./suite');
var suite = new Suite('eles.closenessCentrality()', {
  setup: function( cytoscape ){
    var cy = cytoscape({ elements: require('./graphs/gal') });

    eles = cy.elements();
    root = cy.$('#367');

    return cy;
  }
});

suite
  .add( function( cy ) {
    eles.closenessCentrality({
      root: root
    });
  })
;

module.exports = suite;
