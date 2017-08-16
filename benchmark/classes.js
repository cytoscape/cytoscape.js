var Suite = require('./suite');

var a;

var suite = new Suite('eles.classes()', {
  setup: function( cytoscape ){
    var cy = cytoscape({ elements: require('./graphs/gal'), styleEnabled: false });

    a = cy.nodes();

    return cy
  }
});

suite
  .add( function( cy ) {
    a.classes('foo bar');
  })
;
module.exports = suite;
