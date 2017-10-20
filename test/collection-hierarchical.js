var expect = require('chai').expect;
var cytoscape = require('../src/test.js', cytoscape);

// Expected results generated from the numerical example found at:
// http://people.revoledu.com/kardi/tutorial/Clustering/Numerical%20Example.htm

// TODO re-enable the tests if we support building dendrograms
var apiSupportsDendrogram = true;

describe('Algorithms', function(){
  describe('eles.hierarchicalClustering()', function() {

    var cy;
    var nodes;
    var options;
    var clusters;

    before(function() {
      cy = cytoscape({
        elements: {
          nodes: [
            { data: { id: 'A', X1: 1, X2: 1 } },
            { data: { id: 'B', X1: 1.5, X2: 1.5 } },
            { data: { id: 'C', X1: 5, X2: 5 } },
            { data: { id: 'D', X1: 3, X2: 4 } },
            { data: { id: 'E', X1: 4, X2: 4 } },
            { data: { id: 'F', X1: 3, X2: 3.5 } }
          ]
        }
      });

      nodes = cy.nodes();

      options = {
        distance: 'euclidean',
        linkage: 'min',
        attributes: [
          function(node) {
            return node.data('X1');
          },
          function(node) {
            return node.data('X2');
          }
        ],
        mode: 'dendrogram',
        dendrogramDepth: 2,
        addDendrogram: false
      };

      clusters = cy.elements().hierarchicalClustering( options );
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

    it('should return the same clusters if we run the algorithm multiple times', function() {
      for (var i = 0; i < 10; i++) {
        var clusters2 = cy.elements().hierarchicalClustering( options );

        expect(clusters2).to.exist;
        expect(clusters2.length).to.equal(clusters.length);

        for( var j = 0; j < clusters2.length; j++ ){
          var cluster = clusters[j];
          var cluster2 = clusters2[j];

          expect( cluster.equals( cluster2 ) ).to.be.true;
        }
      }
    });

    if( apiSupportsDendrogram ){
      it('Check level 0 of dendrogram: should return the numerically correct clusters (expected results)', function() {
        // Set algorithm to cut the dendrogram tree at level 0
        options.dendrogramDepth = 0;
        var clustersAtLevel0 = cy.elements().hierarchicalClustering( options );

        // At level 0, we expect the algorithm (for this exmaple) to return all nodes in one single cluster
        expect(clustersAtLevel0.length).to.equal(1);
      });

      it('Check level 1 of dendrogram: should return the numerically correct clusters (expected results)', function() {
        // Set algorithm to cut the dendrogram tree at level 1
        options.dendrogramDepth = 1;
        var clustersAtLevel1 = cy.elements().hierarchicalClustering( options );

        // At level 1, we expect the algorithm (for this example) to return 2 clusters
        expect(clustersAtLevel1.length).to.equal(2);

        expect(clustersAtLevel1[0][0].id()).to.equal('B');
        expect(clustersAtLevel1[0][1].id()).to.equal('A');

        expect(clustersAtLevel1[1][0].id()).to.equal('C');
        expect(clustersAtLevel1[1][1].id()).to.equal('E');
        expect(clustersAtLevel1[1][2].id()).to.equal('F');
        expect(clustersAtLevel1[1][3].id()).to.equal('D');
      });

      it('Check level 2 of dendrogram: should return the numerically correct clusters (expected results)', function() {
        // Set algorithm to cut the dendrogram tree at level 2
        options.dendrogramDepth = 2;
        var clustersAtLevel2 = cy.elements().hierarchicalClustering( options );

        // At level 2, we expect the algorithm (for this example) to return 4 clusters
        expect(clustersAtLevel2.length).to.equal(4);

        expect(clustersAtLevel2[0][0].id()).to.equal('B');
        expect(clustersAtLevel2[1][0].id()).to.equal('A');
        expect(clustersAtLevel2[2][0].id()).to.equal('C');
        expect(clustersAtLevel2[3][0].id()).to.equal('E');
        expect(clustersAtLevel2[3][1].id()).to.equal('F');
        expect(clustersAtLevel2[3][2].id()).to.equal('D');
      });

      it('Check level 3 of dendrogram: should return the numerically correct clusters (expected results)', function() {
        // Set algorithm to cut the dendrogram tree at level 3
        options.dendrogramDepth = 3;
        var clustersAtLevel3 = cy.elements().hierarchicalClustering( options );

        // At level 3, we expect the algorithm (for this example) to return 5 clusters
        expect(clustersAtLevel3.length).to.equal(5);

        expect(clustersAtLevel3[0][0].id()).to.equal('B');
        expect(clustersAtLevel3[1][0].id()).to.equal('A');
        expect(clustersAtLevel3[2][0].id()).to.equal('C');
        expect(clustersAtLevel3[3][0].id()).to.equal('E');
        expect(clustersAtLevel3[4][0].id()).to.equal('F');
        expect(clustersAtLevel3[4][1].id()).to.equal('D');

      });

      it('Check level 4 of dendrogram: should have 1 node per cluster (expected results)', function() {
        // Set algorithm to cut the dendrogram tree at level 4
        options.dendrogramDepth = 4;
        var clustersAtLevel4 = cy.elements().hierarchicalClustering( options );

        // At level 4, we expect the algorithm (for this example) to return 6 clusters
        expect(clustersAtLevel4.length).to.equal(6);

        expect(clustersAtLevel4[0][0].id()).to.equal('B');
        expect(clustersAtLevel4[1][0].id()).to.equal('A');
        expect(clustersAtLevel4[2][0].id()).to.equal('C');
        expect(clustersAtLevel4[3][0].id()).to.equal('E');
        expect(clustersAtLevel4[4][0].id()).to.equal('F');
        expect(clustersAtLevel4[5][0].id()).to.equal('D');

      });

      it('Check level 5+ of dendrogram: should have 1 node per cluster (fail safely)', function() {
        // Set algorithm to cut the dendrogram tree at level 5
        options.dendrogramDepth = 5;
        var clustersAtLevel5 = cy.elements().hierarchicalClustering( options );

        // At level 5, we expect the algorithm (for this example) to return 6 clusters
        expect(clustersAtLevel5.length).to.equal(6);

        expect(clustersAtLevel5[0][0].id()).to.equal('B');
        expect(clustersAtLevel5[1][0].id()).to.equal('A');
        expect(clustersAtLevel5[2][0].id()).to.equal('C');
        expect(clustersAtLevel5[3][0].id()).to.equal('E');
        expect(clustersAtLevel5[4][0].id()).to.equal('F');
        expect(clustersAtLevel5[5][0].id()).to.equal('D');

        // Set algorithm to cut the dendrogram tree at level 10
        options.dendrogramDepth = 10;
        var clustersAtLevel10 = cy.elements().hierarchicalClustering( options );

        // At level 10, we expect the algorithm (for this example) to return 6 clusters
        expect(clustersAtLevel10.length).to.equal(6);

        expect(clustersAtLevel10[0][0].id()).to.equal('B');
        expect(clustersAtLevel10[1][0].id()).to.equal('A');
        expect(clustersAtLevel10[2][0].id()).to.equal('C');
        expect(clustersAtLevel10[3][0].id()).to.equal('E');
        expect(clustersAtLevel10[4][0].id()).to.equal('F');
        expect(clustersAtLevel10[5][0].id()).to.equal('D');
      });
    }

  });
});
