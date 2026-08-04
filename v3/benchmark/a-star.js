var eles, root, goal;

var Suite = require('./suite');
var suite = new Suite('eles.aStar()', {
  setup: function( cytoscape ){
    var cy = cytoscape({ elements: require('./graphs/gal') });

    eles = cy.elements();
    root = cy.$('#367');
    goal = cy.$('#381');

    return cy;
  }
});

suite
  .add( function( cy ) {
    eles.aStar({
      root: root,
      goal: goal
    });
  })
;

module.exports = suite;
