var expect = require('chai').expect;
var cytoscape = require('../build/cytoscape.js', cytoscape);

describe('Graph theory algorithms (advanced) ', function(){

  var cy; 
  var nodes;
  var edges;

  beforeEach(function(done) {
    cytoscape({
      elements: {
        nodes: [
          { data: { id: '1-1'} },
          { data: { id: '1-2'} },
          { data: { id: '1-3'} },
          { data: { id: '1-4'} },
          { data: { id: '1-5'} },
          { data: { id: '1-6'} },

          { data: { id: '2-1'} },
          { data: { id: '2-2'} },
          { data: { id: '2-3'} },
          { data: { id: '2-4'} },
          { data: { id: '2-5'} },
          { data: { id: '2-6'} },

          { data: { id: '3-1'} },
          { data: { id: '3-2'} },
          { data: { id: '3-3'} },
          { data: { id: '3-4'} },
          { data: { id: '3-5'} },
          { data: { id: '3-6'} },

          { data: { id: '4-1'} },
          { data: { id: '4-2'} },
          { data: { id: '4-3'} },
          { data: { id: '4-4'} },
          { data: { id: '4-5'} },
          { data: { id: '4-6'} },

          { data: { id: '5-1'} },
          { data: { id: '5-2'} },
          { data: { id: '5-3'} },
          { data: { id: '5-4'} },
          { data: { id: '5-5'} },
          { data: { id: '5-6'} },

          { data: { id: '6-1'} },
          { data: { id: '6-2'} },
          { data: { id: '6-3'} },
          { data: { id: '6-4'} },
          { data: { id: '6-5'} },
          { data: { id: '6-6'} }
        ], 
        
        edges: [
          { data: { source: '6-1', target: '5-1', weight: 1.0 } },
          { data: { source: '5-1', target: '4-1', weight: 1.0 } },
          { data: { source: '4-1', target: '3-1', weight: 1.0 } },
          { data: { source: '3-1', target: '2-1', weight: 1.0 } },
          { data: { source: '2-1', target: '1-1', weight: 1.0 } },
          { data: { source: '6-2', target: '5-2', weight: 1.0 } },
          { data: { source: '5-2', target: '4-2', weight: 1.0 } },
          { data: { source: '6-3', target: '5-3', weight: 1.0 } },
          { data: { source: '5-3', target: '4-3', weight: 1.0 } },
          { data: { source: '4-3', target: '3-3', weight: 1.0 } },
          { data: { source: '4-4', target: '3-4', weight: 1.0 } },
          { data: { source: '6-6', target: '5-6', weight: 1.0 } },
          { data: { source: '5-6', target: '4-6', weight: 1.0 } },
          { data: { source: '4-6', target: '3-6', weight: 1.0 } },
          { data: { source: '3-6', target: '2-6', weight: 1.0 } },
          { data: { source: '2-6', target: '1-6', weight: 1.0 } },

          { data: { source: '6-1', target: '6-2', weight: 1.0 } },
          { data: { source: '6-2', target: '6-3', weight: 1.0 } },
          { data: { source: '6-3', target: '6-4', weight: 1.0 } },
          { data: { source: '6-4', target: '6-5', weight: 1.0 } },
          { data: { source: '6-5', target: '6-6', weight: 1.0 } },
          { data: { source: '5-1', target: '5-2', weight: 1.0 } },
          { data: { source: '5-2', target: '5-3', weight: 1.0 } },
          { data: { source: '4-1', target: '4-2', weight: 1.0 } },
          { data: { source: '4-2', target: '4-3', weight: 1.0 } },
          { data: { source: '4-3', target: '4-4', weight: 1.0 } },
          { data: { source: '3-3', target: '3-4', weight: 1.0 } },
          { data: { source: '1-1', target: '1-2', weight: 1.0 } },
          { data: { source: '1-2', target: '1-3', weight: 1.0 } },
          { data: { source: '1-3', target: '1-4', weight: 1.0 } },
          { data: { source: '1-4', target: '1-5', weight: 1.0 } },
          { data: { source: '1-5', target: '1-6', weight: 1.0 } },
        ]
      },

      ready: function(){
        cy = this;

        // nodes
        nodes = ["dummy"];
        for (var i = 1; i <= 6; i++) {
          var tempArray = ["dummy"];
          for (var j = 1; j <= 6; j++) {
            tempArray.push(cy.$('#' + i + '-' + j));
          }
          nodes.push(tempArray);
        }
        
        done();
      }
    });
  });

  function eles() {
    var col = cy.collection();
    
    for (var i = 0; i < arguments.length; i++) {
      var ele = arguments[i];
      col = col.add(ele);
    }
    
    return col;
  };

  // Computes euclidean distance between 2 nodes
  function euclid(node1, node2) {
    var n1 = node1.id().split("-"); 
    var n2 = node2.id().split("-"); 
    return Math.sqrt( Math.pow(n1[0] - n2[0], 2) + Math.pow(n1[1] - n2[1], 2));
  };

  function ele2id( ele ){
    return ele.id();
  }

  function isNode( ele ){
    return ele.isNode();
  }

  it('eles.aStar(): directed, null heuristic, unweighted', function(){
    var options = {root: nodes[6][1], 
             goal: nodes[1][5], 
             directed: true, 
             heuristic: function(a){return 0;}
            };
    var res = cy.elements().aStar(options);
    expect(res.found).to.equal(true);
    expect(res.distance).to.equal(9);
    expect(res.path.stdFilter(isNode).map(ele2id)).to.deep.equal(["6-1", "5-1", "4-1", "3-1", "2-1", "1-1", "1-2", "1-3", "1-4", "1-5"]);
  });
  
  it('eles.aStar(): directed, heuristic, unweighted', function(){
    var options = {root: nodes[6][1], 
             goal: nodes[2][6], 
             directed: true, 
             heuristic: function(node) {return euclid(node, nodes[2][6]);}
            };
    var res = cy.elements().aStar(options);
    expect(res.found).to.equal(true);
    expect(res.distance).to.equal(9);
    expect(res.path.stdFilter(isNode).map(ele2id)).to.deep.equal(["6-1", "6-2", "6-3", "6-4", "6-5", "6-6", "5-6", "4-6", "3-6", "2-6"]);
  });

  it('eles.aStar(): undirected, heuristic vs null heuristic (performance), ', function(){
    var options1 = {root: nodes[3][3], 
            goal: nodes[1][5], 
            directed: false, 
            heuristic: function(node) {return euclid(node, nodes[1][5]);}
            };
    var res1 = cy.elements().aStar(options1);
    expect(res1.found).to.equal(true);
    expect(res1.distance).to.equal(10);
    expect(res1.path.stdFilter(isNode).map(ele2id)).to.deep.equal(["3-3", "4-3", "4-2", "4-1", "3-1", "2-1", "1-1", "1-2", "1-3", "1-4", "1-5"]);   

    var options2 = {root: nodes[3][3], 
            goal: nodes[1][5], 
            directed: false, 
            heuristic: function(a){return 0;}
            };
    var res2 = cy.elements().aStar(options2);
    expect(res2.found).to.equal(true);
    expect(res2.distance).to.equal(10);
    expect(res2.path.stdFilter(isNode).map(ele2id)).to.deep.equal(["3-3", "4-3", "4-2", "4-1", "3-1", "2-1", "1-1", "1-2", "1-3", "1-4", "1-5"]);   

    // Performance with heuristic should be better than without it
    expect(res1.steps).to.be.below(res2.steps);
  });

});