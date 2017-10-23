var expect = require('chai').expect;
var cytoscape = require('../src/test.js', cytoscape);

// Expected results generated from the numerical example found at:
// http://mnemstudio.org/clustering-k-means-example-1.htm

describe('Algorithms', function(){
  describe('ele.kMeans()', function() {

    var cy;
    var nodes;
    var n1, n2, n3, n4, n5, n6, n7;

    var options;
    var expectedClusters;
    var clusters;

    before(function(done) {
      cytoscape({
        elements: {
          nodes: [
            { data: { id: '1', attrA: 1.0, attrB: 1.0 } },
            { data: { id: '2', attrA: 1.5, attrB: 2.0 } },
            { data: { id: '3', attrA: 3.0, attrB: 4.0 } },
            { data: { id: '4', attrA: 5.0, attrB: 7.0 } },
            { data: { id: '5', attrA: 3.5, attrB: 5.0 } },
            { data: { id: '6', attrA: 4.5, attrB: 5.0 } },
            { data: { id: '7', attrA: 3.5, attrB: 4.5 } }
          ]
        },
        ready: function() {
          cy    = this;
          nodes = cy.nodes();

          n1 = cy.$('#1');
          n2 = cy.$('#2');
          n3 = cy.$('#3');
          n4 = cy.$('#4');
          n5 = cy.$('#5');
          n6 = cy.$('#6');
          n7 = cy.$('#7');

          options = {
            k: 2,
            distance: 'euclidean',
            maxIterations: 10,
            attributes: [
              function(node) {
                return node.data('attrA');
              },
              function(node) {
                return node.data('attrB');
              }
            ],
            testMode: true,
            testCentroids: [ [1.0, 1.0], [5.0, 7.0] ]
          };

          expectedClusters = [
            { elements: [n1, n2], centroid: [1.3, 1.5] },
            { elements: [n3, n4, n5, n6, n7], centroid: [3.9, 5.1] }
          ];

          clusters = cy.elements().kMeans( options );

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

    it('the number of clusters returned should match the value the user specified', function() {
      expect(clusters.length).to.equal(options.k);
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

    it('should always return the same clusters if we hard-code centroid values (analogous to setting seed)', function() {
      // Run k-means several times. Setting testMode to true and hard-coding centroid values
      // (analogous to setting a seed) should return the same clusters every time.
      for (var i = 0; i < 10; i++) {
        var clusters2 = cy.elements().kMeans( options );

        expect(clusters2).to.exist;
        expect(clusters2.length).to.equal(clusters.length);

        for( var j = 0; j < clusters2.length; j++ ){
          var cluster = clusters[j];
          var cluster2 = clusters2[j];

          expect( cluster2.length, 'cluster length' ).to.equal( cluster.length );

          for( var l = 0; l < cluster2.length; l++ ){
            var ele = cluster[l];
            var ele2 = cluster2[l];

            expect( ele.same(ele2), 'same ele' ).to.be.true;
          }
        }
      }
    });

    it('should return the numerically correct clusters (expected results)', function() {
      for (var c = 0; c < clusters.length; c++) {
        expect(clusters[c].length).to.equal(expectedClusters[c].elements.length);
      }

      expect(clusters[0][0].id()).to.equal(n1.id());
      expect(clusters[0][1].id()).to.equal(n2.id());

      expect(clusters[1][0].id()).to.equal(n3.id());
      expect(clusters[1][1].id()).to.equal(n4.id());
      expect(clusters[1][2].id()).to.equal(n5.id());
      expect(clusters[1][3].id()).to.equal(n6.id());
      expect(clusters[1][4].id()).to.equal(n7.id());

      var ndim        = options.attributes.length;
      var centroids   = new Array(options.k);
      var sum         = new Array(ndim);

      for ( var c = 0; c < options.k; c++ ) {
        var newCentroid = new Array(ndim);

        for (var d = 0; d < ndim; d++) {
          sum[d] = 0.0;
          for (var i = 0; i < clusters[c].length; i++) {
            var node = clusters[c][i];
            sum[d] += options.attributes[d](node);
          }
          newCentroid[d] = sum[d] / clusters[c].length;
        }
        centroids[c] = newCentroid;
      }

      for (var c = 0; c < centroids.length; c++) {
        for (var d = 0; d < ndim; d++) {
          //console.log(centroids[c][d] + ' ~= ' + expectedClusters[c].centroid[d]);
          expect(centroids[c][d]).to.be.within(expectedClusters[c].centroid[d]-0.1, expectedClusters[c].centroid[d]+0.1);
        }
      }
    });

  });
});
