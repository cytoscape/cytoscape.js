var expect = require('chai').expect;
var cytoscape = require('../build/cytoscape.js', cytoscape);

describe('Collection graph manipulation', function(){

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


  describe('eles.remove()', function(){

    it('should remove a single element', function(){
      cy.$('#n1').remove();

      expect( cy.$('#n1') ).to.have.length(0);
    });

    it('should remove several elements', function(){
      cy.$('#n1, #n2').remove();

      expect( cy.$('#n1') ).to.have.length(0);
      expect( cy.$('#n2') ).to.have.length(0);
    });

    it('should remove edges connected to removed node', function(){
      cy.$('#n1').remove();

      expect( cy.$('#n1n2') ).to.have.length(0);
    });

  });

  describe('ele.removed()', function(){

    it('should be true for removed node', function(){
      var n1 = cy.$('#n1').remove();

      expect( n1.removed() ).to.be.true;
    });

    it('should be false for inside node', function(){
      var n1 = cy.$('#n1');

      expect( n1.removed() ).to.be.false;
    });

  });

  describe('ele.inside()', function(){

    it('should be false for removed node', function(){
      var n1 = cy.$('#n1').remove();

      expect( n1.inside() ).to.be.false;
    });

    it('should be true for inside node', function(){
      var n1 = cy.$('#n1');

      expect( n1.inside() ).to.be.true;
    });

  });

  describe('ele.restore()', function(){

    it('should put back a node in the graph', function(){
      var n1 = cy.$('#n1').remove();

      n1.restore();
      expect( n1.inside() ).to.be.true;
      expect( cy.$('#n1') ).to.have.length(1);
    });

  });


});