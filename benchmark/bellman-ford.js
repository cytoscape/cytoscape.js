var root, eles;

var Suite = require('./suite');
var suite = new Suite('eles.bellmanFord()', {
  setup: function( cytoscape ){
    var cy = cytoscape({ elements: require('./graphs/gal') });

    eles = cy.elements();
    root = cy.$('#367');

    return cy;
  }
});

suite
  .add( function( cy ) {
    eles.bellmanFord({
      root: root
    });
  })
;

module.exports = suite;
