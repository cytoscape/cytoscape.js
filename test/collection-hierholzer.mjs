var expect = require('chai').expect;
var cytoscape = require('../src/test.js', cytoscape);

describe('Algorithms', function(){
  describe('eles.hierholzer()', function(){

    var cy;

    beforeEach(function(done) {
      cytoscape({
        elements: {
          nodes: [
            { data: { id: '0', name: '0' } },
            { data: { id: '1', name: '1' } },
            { data: { id: '2', name: '2' } },
            { data: { id: '3', name: '3' } },
            { data: { id: '4', name: '4' } },
            { data: { id: '5', name: '5' } },
            { data: { id: '6', name: '6' } },
            { data: { id: '7', name: '7' } },
          ],

          edges: [
            { data: { source: '0', target: '1' } },
            { data: { source: '0', target: '1' } },
            { data: { source: '1', target: '2' } },
            { data: { source: '1', target: '2' } },
            { data: { source: '2', target: '3' } },
            { data: { source: '2', target: '3' } },
            { data: { source: '0', target: '6' } },
            { data: { source: '2', target: '0' } },
            { data: { source: '3', target: '4' } },
            { data: { source: '3', target: '4' } },
            { data: { source: '4', target: '2' } },
            { data: { source: '4', target: '5' } },
            { data: { source: '4', target: '5' } },
            { data: { source: '5', target: '0' } },
            { data: { source: '5', target: '0' } },
            { data: { source: '6', target: '4' } }
          ]
        },

        ready: function(){
          cy = this;
          done();
        }
      });
    });

    function ele2id( ele ){
      return ele.id();
    }

    function isNode( ele ){
      return ele.isNode();
    }

    it('eles.hierholzer(): directed', function(){
      var options = {
        root: "#0",
        directed: true
      };
      var res = cy.elements().hierholzer(options);
      expect(res.found).to.equal(true);
      expect(res.trail.stdFilter(isNode).map(ele2id)).to.deep.equal(["0", "1", "2", "3", "4", "5", "6"]);
    });

    it('eles.hierholzer(): undirected', function(){
      var options = {
        root: "#0",
        directed: false
      };
      var res = cy.elements().hierholzer(options);
      expect(res.found).to.equal(true);
      expect(res.trail.stdFilter(isNode).map(ele2id)).to.deep.equal(["0", "1", "6", "4", "3", "2", "5"]);
    });

  });
});
