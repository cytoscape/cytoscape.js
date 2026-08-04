var eles, root;

var Suite = require('./suite');
var suite = new Suite('eles.betweennessCentrality()', {
  setup: function( cytoscape ){
    var cy = cytoscape({ elements: require('./graphs/gal') });

    eles = cy.elements();
    root = cy.$('#269');

    return cy;
  }
});

suite
  .add( function( cy ) {
    eles.betweennessCentrality({
      root: root
    });
  })
;

module.exports = suite;
