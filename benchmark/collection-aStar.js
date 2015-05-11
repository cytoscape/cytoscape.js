var CySuite = require('./CySuite');
var abcde = require('./graphs/abcde.json');
var setup = function( cytoscape ){
  return cytoscape({ elements: abcde });
};
var suite = new CySuite('eles.aStar()', {
  oldCy: setup,
  newCy: setup
});

suite
  .add( function( cy ) {
    cy.elements().aStar({
      root: cy.$('#a'),
      goal: cy.$('#b'),
      heuristic: function(a){ return 0; }
    });
  })
;

module.exports = suite;
