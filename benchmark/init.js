var Suite = require('./suite');

var Cytoscape;
var eles;

var suite = new Suite('new Cytoscape()', {
  setup: function( cytoscapeImpl ){
    Cytoscape = cytoscapeImpl;

    eles = JSON.parse( JSON.stringify( require('./graphs/gal') ) );
  }
});

suite
  .add( function() {
    return new Cytoscape({ elements: eles });
  })
;

module.exports = suite;
