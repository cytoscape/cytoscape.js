var eles;

var Suite = require('./suite');
var suite = new Suite('eles.pageRank()', {
  setup: function( cytoscape ){
    var cy = cytoscape({ elements: require('./graphs/gal') });

    eles = cy.elements();

    return cy;
  }
});

suite
  .add( function( cy ) {
    eles.pageRank({});
  })
;

module.exports = suite;
