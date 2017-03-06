var Suite = require('./suite');
var suite = new Suite('new Collection()', {
  setup: function( cytoscape ){
    return cytoscape({ elements: require('./graphs/gal') });
  }
});

suite
  .add( function( cy ) {
    var eles = cy.elements();

    // make sure the collection is used so it's not optimised out

    var n = 0;

    for( var i = 0; i < eles.length; i++ ){
      n++;
    }

    return n;
  })
;

module.exports = suite;
