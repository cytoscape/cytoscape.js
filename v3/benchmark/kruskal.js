var eles;

var Suite = require('./suite');
var suite = new Suite('eles.kruskal()', {
  setup: function( cytoscape ){
    var cy =  cytoscape({ elements: require('./graphs/gal') });

    eles = cy.elements();

    return cy;
  }
});

suite
  .add( function( cy ) {
    eles.kruskal();
  })
;

module.exports = suite;
