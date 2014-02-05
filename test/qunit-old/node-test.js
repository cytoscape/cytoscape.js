global.cytoscape = require('../build/cytoscape.js');
  
var cy;

// create an instance
cytoscape({
  elements: {
    nodes: [
      { data: { id: "n1", foo: "one", weight: 0.25 }, classes: "odd one" },
      { data: { id: "n2", foo: "two", weight: 0.5 }, classes: "even two" },
      { data: { id: "n3", foo: "three", weight: 0.75 }, classes: "odd three" }
    ],
    
    edges: [
      { data: { id: "n1n2", source: "n1", target: "n2", weight: 0.33 }, classes: "uh" },
      { data: { id: "n2n3", source: "n2", target: "n3", weight: 0.66 }, classes: "huh" }
    ]
  },

  ready: function(){
    cy = this;

    console.log('Cytoscape.js successfully started on Node.js with graph of size ' + cy.elements().size());
  }
});
