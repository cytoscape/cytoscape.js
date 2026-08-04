var Suite = require('./suite');

var eles;

var suite = new Suite('eles.filter(selector)', {
  setup: function( cytoscape ){
    var cy = cytoscape({ elements: require('./graphs/gal') });

    eles = cy.nodes();

    return cy;
  }
});

suite
  .add( function( cy ) {
    // n.b.
    // - use a selector that matches all nodes so we really compare the selector matching rather than letting the matches exit early
    // - only create one selector : compare matching perf, not creation perf
    eles.filter('node:unselected:grabbable[gal80Rexp > 0][SUID > 0][Stress >= 5][AverageShortestPathLength > 0]');
  })
;

module.exports = suite;
