var Suite = require('./suite');

var a, b;

var suite = new Suite('eles.contains()', {
  setup: function( cytoscape ){
    var cy = cytoscape({ elements: require('./graphs/gal') });

    a = cy.nodes();
    b = cy.nodes();

    return cy;
  }
});

suite
  .add( function( cy ) {
    a.contains( b );
  })
;

module.exports = suite;
