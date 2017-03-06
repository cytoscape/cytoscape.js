var Suite = require('./suite');
var suite = new Suite('#id selector', {
  setup: function( cytoscape ){
    return cytoscape({ elements: require('./graphs/gal') });
  }
});

suite
  .add( function( cy ) {
    cy.$('#381');
  })
;

module.exports = suite;
