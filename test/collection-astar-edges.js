var expect = require('chai').expect;
var cytoscape = require('../src/test.js', cytoscape);

describe('Algorithms', function(){
  describe('eles.aStar()', function(){ describe('issue #2830', function(){
    var cy;

    beforeEach(function(done) {
      cytoscape({
        elements: {
          edges: [
            { data: { source: "(4,2)",      target: "(5,2)", id: "((4,2),(5,2))"      } },
            { data: { source: "(5,3)",      target: "(6,3)", id: "((5,3),(6,3))"      } },
            { data: { source: "(1,1)-asm",  target: "(4,2)", id: "((1,1)-asm,(4,2))"  } },
            { data: { source: "(9,2)",      target: "(9,3)", id: "((9,2),(9,3))"      } },
            { data: { source: "(12,1)-asm", target: "(9,2)", id: "((12,1)-asm,(9,2))" } },
            { data: { source: "(6,3)",      target: "(7,3)", id: "((6,3),(7,3))"      } },
            { data: { source: "(4,1)",      target: "(4,2)", id: "((4,1),(4,2))"      } },
            { data: { source: "(5,1)",      target: "(5,2)", id: "((5,1),(5,2))"      } },
            { data: { source: "(4,1)",      target: "(5,1)", id: "((4,1),(5,1))"      } },
            { data: { source: "(8,3)",      target: "(9,3)", id: "((8,3),(9,3))"      } },
            { data: { source: "(5,2)",      target: "(5,3)", id: "((5,2),(5,3))"      } },
            { data: { source: "(7,3)",      target: "(8,3)", id: "((7,3),(8,3))"      } },
            { data: { source: "(1,1)-asm",  target: "(4,1)", id: "((1,1)-asm,(4,1))"  } }
          ],
          "nodes": [
            { data: { id: "(1,1)-asm",  estimate: 5 } },
            { data: { id: "(12,1)-asm", estimate: 0 } },
            { data: { id: "(5,3)",      estimate: 6 } },
            { data: { id: "(4,2)",      estimate: 6 } },
            { data: { id: "(5,2)",      estimate: 5 } },
            { data: { id: "(4,1)",      estimate: 5 } },
            { data: { id: "(5,1)",      estimate: 4 } },
            { data: { id: "(9,2)",      estimate: 1 } },
            { data: { id: "(9,3)",      estimate: 2 } },
            { data: { id: "(8,3)",      estimate: 3 } },
            { data: { id: "(7,3)",      estimate: 4 } },
            { data: { id: "(6,3)",      estimate: 5 } }
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

    function isContinuous(edges) {
      for (var i = 0; i < edges.length -1; ++i) {
        var edge = edges[i];
        var nextEdge = edges[i+1];
        if (! areConnected(edge, nextEdge)) {
          return false;
        }
      }
      return true;
    }

    function areConnected(edgeA, edgeB) {
      return edgeA.target() === edgeB.source() ||
             edgeA.source() === edgeB.target() ||
             edgeA.target() === edgeB.target() ||
             edgeA.source() === edgeB.source();
    }

    it('eles.aStar(): path.edges() must contain the correct edges in the correct order', function(){
      var options = {root: cy.nodes("[id = '(1,1)-asm']"),
               goal: cy.nodes("[id = '(12,1)-asm']"),
               directed: false,
               heuristic: function(a){return a.data('estimate');}
              };
      var res = cy.elements().aStar(options);
      expect(res.path.edges().map(ele2id)).to.deep.equal([
        "((1,1)-asm,(4,2))",
        "((4,2),(5,2))",
        "((5,2),(5,3))",
        "((5,3),(6,3))",
        "((6,3),(7,3))",
        "((7,3),(8,3))",
        "((8,3),(9,3))",
        "((9,2),(9,3))",
        "((12,1)-asm,(9,2))"]);
    });

    it('eles.aStar(): edges must form a continuous path', function(){
      var options = {root: cy.nodes("[id = '(1,1)-asm']"),
               goal: cy.nodes("[id = '(12,1)-asm']"),
               directed: false,
               heuristic: function(a) { return a.data('estimate'); }
              };
      var res = cy.elements().aStar(options);
      expect(isContinuous(res.path.edges())).to.equal(true);
    });
  });
});});

