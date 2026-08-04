var eles;

var Suite = require('./suite');
var suite = new Suite('eles.kargerStein()', {
  setup: function( cytoscape ){
    var cy = cytoscape({ elements: require('./graphs/gal') });

    eles = cy.elements().components()[0]; // Karger-Stein can run only on connected (sub)graphs

    return cy;
  }
});

suite
  .add( function( cy ) {
    eles.kargerStein({});
  })
;

module.exports = suite;
