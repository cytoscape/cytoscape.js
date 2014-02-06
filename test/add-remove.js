var expect = require('chai').expect;
var cytoscape = require('../build/cytoscape.js', cytoscape);

describe('Adding and removing entities', function(){

  var cy;

  // test setup
  beforeEach(function(done){
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

        done();
      }
    });
  });

  describe('cy.remove()', function(){

    it('Remove a single node', function(){
      var n1 = cy.$('#n1').remove();
      
      expect( cy.nodes() ).to.have.length(2);
      expect( cy.$('#n2') ).to.not.be.empty;
      expect( cy.$('#n3') ).to.not.be.empty;
      expect( n1.removed() ).to.be.true;

    });

  });

});