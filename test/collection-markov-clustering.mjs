var expect = require('chai').expect;
var cytoscape = require('../src/test.js', cytoscape);

// Expected results generated from the numerical example found at:
// http://micans.org/mcl/src_attic/mcl-04-314/doc/mcxio.html

describe('eles.markovClustering()', function() {

  var cy;
  var nodes;
  var n11, n22, n33, n44, n55, n66, n77, n88, n99, n123, n456, n2147483647;

  var options;
  var expectedClusters;
  var clusters;

  before(function(done) {
    cytoscape({
      elements: {
        nodes: [
          { data: { id: '11' } },
          { data: { id: '22' } },
          { data: { id: '33' } },
          { data: { id: '44' } },
          { data: { id: '55' } },
          { data: { id: '66' } },
          { data: { id: '77' } },
          { data: { id: '88' } },
          { data: { id: '99' } },
          { data: { id: '123' } },
          { data: { id: '456' } },
          { data: { id: '2147483647' } }
        ],
        edges: [
          { data: { source: '11', target: '22', weight: 2 } },
          { data: { source: '11', target: '66', weight: 3.4 } },
          { data: { source: '11', target: '77', weight: 3 } },
          { data: { source: '11', target: '123', weight: 8 } },

          { data: { source: '22', target: '11', weight: 2 } },
          { data: { source: '22', target: '33', weight: 3.8 } },
          { data: { source: '22', target: '55', weight: 8.1 } },

          { data: { source: '33', target: '22', weight: 3.8 } },
          { data: { source: '33', target: '44', weight: 7 } },
          { data: { source: '33', target: '55', weight: 6.2 } },

          { data: { source: '44', target: '33', weight: 7 } },
          { data: { source: '44', target: '88', weight: 5.7 } },
          { data: { source: '44', target: '99', weight: 7.0 } },
          { data: { source: '44', target: '456', weight: 3 } },

          { data: { source: '55', target: '22', weight: 8.1 } },
          { data: { source: '55', target: '33', weight: 6.2 } },
          { data: { source: '55', target: '77', weight: 2.9 } },
          { data: { source: '55', target: '88', weight: 3.0 } },

          { data: { source: '66', target: '11', weight: 3.4 } },
          { data: { source: '66', target: '123', weight: 5.1 } },

          { data: { source: '77', target: '11', weight: 3 } },
          { data: { source: '77', target: '55', weight: 2.9 } },
          { data: { source: '77', target: '123', weight: 1.5 } },

          { data: { source: '88', target: '44', weight: 5.7 } },
          { data: { source: '88', target: '55', weight: 3.0 } },
          { data: { source: '88', target: '99', weight: 3.0 } },
          { data: { source: '88', target: '456', weight: 4.2 } },

          { data: { source: '99', target: '44', weight: 7.0 } },
          { data: { source: '99', target: '88', weight: 3.0 } },
          { data: { source: '99', target: '456', weight: 1.8 } },
          { data: { source: '99', target: '2147483647', weight: 3.9 } },

          { data: { source: '123', target: '11', weight: 8 } },
          { data: { source: '123', target: '66', weight: 5.1 } },
          { data: { source: '123', target: '77', weight: 1.5 } },

          { data: { source: '456', target: '44', weight: 3 } },
          { data: { source: '456', target: '88', weight: 4.2 } },
          { data: { source: '456', target: '99', weight: 1.8 } },
          { data: { source: '456', target: '2147483647', weight: 6.3 } },

          { data: { source: '2147483647', target: '99', weight: 3.9 } },
          { data: { source: '2147483647', target: '456', weight: 6.3 } }
        ]
      },
      ready: function() {
        cy    = this;
        nodes = cy.nodes();

        n11 = cy.$('#11');
        n22 = cy.$('#22');
        n33 = cy.$('#33');
        n44 = cy.$('#44');
        n55 = cy.$('#55');
        n66 = cy.$('#66');
        n77 = cy.$('#77');
        n88 = cy.$('#88');
        n99 = cy.$('#99');
        n123 = cy.$('#123');
        n456 = cy.$('#456');
        n2147483647 = cy.$('#2147483647');

        options = {
          inflateFactor: 1.8,
          attributes: [
            function(edge) {
              return edge.data('weight');
            }
          ]
        };

        expectedClusters = [
          [ n44, n88, n99, n456, n2147483647 ], [ n22, n33, n55 ], [ n11, n66, n77, n123 ]
        ];

        clusters = cy.elements().markovClustering( options );

        done();
      }
    });
  });

  function classify(node, clusters) {
    var found = null;

    for (var c = 0; clusters.length; c++) {
      var cluster = clusters[c];
      for (var e = 0; e < cluster.length; e++) {
        if (node === cluster[e]) {
          found = c;
          return found;
        }
      }
    }
  }

  function found(node, cluster) {
    for (var n = 0; n < cluster.length; n++) {
      if (node === cluster[n]) {
        return true;
      }
    }
    return false;
  }


  it('clusters should be returned in an array', function() {
    expect(clusters).to.exist;
    expect(clusters.constructor === Array).to.be.true;
  });

  it('all nodes should be assigned to a cluster', function() {
    var total = 0;
    for (var i = 0; i < clusters.length; i++) {
      total += clusters[i].length;
    }
    expect(total).to.equal(nodes.length);
  });

  it('nodes cannot be assigned to more than one cluster', function() {
    for (var n = 0; n < nodes.length; n++) {
      var node = nodes[n];

      // Find which cluster the node belongs to.
      var cluster = classify(node, clusters);
      expect(cluster).to.exist;

      // Iterate through all other clusters to make sure the node
      // is not found in any other cluster.
      for (var c = 0; c < clusters.length; c++) {
        if (cluster !== c) {
          var duplicate = found(node, clusters[c]);
          expect(duplicate).to.be.false;
        }
      }
    }
  });

  it('should always return the same clusters (analogous to setting seed)', function() {
    // Run markov cluster several times.
    for (var i = 0; i < 10; i++) {
      var clusters2 = cy.elements().markovClustering( options );

      expect(clusters2).to.exist;
      expect(clusters2.length).to.equal(clusters.length);

      for( var j = 0; j < clusters2.length; j++ ){
        var cluster = clusters[j];
        var cluster2 = clusters2[j];

        expect( cluster.equals( cluster2 ) ).to.be.true;
      }
    }
  });

  it('should return the numerically correct clusters (expected results)', function() {

    expect(clusters.length).to.equal(expectedClusters.length);

    for (var i = 0; i < clusters.length; i++) {
      for (var j = 0; j < clusters[i].length; j++) {
        expect(clusters[i][j].id()).to.equal(expectedClusters[i][j].id());
      }
    }
  });

});
