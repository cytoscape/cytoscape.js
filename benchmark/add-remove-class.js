var Suite = require('./suite');

var a;

var suite = new Suite('eles.addClass(); ... eles.removeClass();', {
  setup: function( cytoscape ){
    var cy = cytoscape({ elements: require('./graphs/gal'), styleEnabled: false });

    a = cy.nodes();

    return cy
  }
});

suite
  .add( function( cy ) {
    a.addClass('foo bar');
    a.removeClass('foo bar');
  })
;
module.exports = suite;
