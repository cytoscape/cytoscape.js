var Suite = require('./suite');

var a;

var suite = new Suite('eles.hasClass()', {
  setup: function( cytoscape ){
    var cy = cytoscape({ elements: require('./graphs/gal'), styleEnabled: false });

    a = cy.nodes();

    return cy;
  }
});

suite
  .add( function( cy ) {
    a.hasClass('foo');
  })
;
module.exports = suite;
