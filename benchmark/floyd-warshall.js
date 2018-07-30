var eles;

var Suite = require('./suite');
var suite = new Suite('eles.floydWarshall()', {
  setup: function( cytoscape ){
    var cy = cytoscape({ elements: require('./graphs/gal') });

    eles = cy.elements();

    return cy;
  }
});

suite
  .add( function( cy ) {
    eles.floydWarshall();
  })
;

module.exports = suite;
