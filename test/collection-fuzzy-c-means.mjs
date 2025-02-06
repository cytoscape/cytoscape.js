import { expect } from 'chai';
import cytoscape from '../src/test.mjs';

// Expected results generated from the numerical example found in the paper:
// "FCM: The fuzzy c-means clustering algorithm" by JC Bezdek

describe('Algorithms', function(){
  describe('eles.fuzzyCMeans()', function() {

    var cy;
    var nodes;
    var n1, n2, n3, n4, n5, n6, n7, n8, n9, n10, n11, n12, n13, n14, n15, n16;

    var options;
    var results;
    var expectedClusters;
    var clusters;

    before(function() {
      cy = cytoscape({
        elements: {
          nodes: [{
              data: {
                id: '1',
                attrA: 0,
                attrB: 4
              }
            },
            {
              data: {
                id: '2',
                attrA: 0,
                attrB: 3
              }
            },
            {
              data: {
                id: '3',
                attrA: 1,
                attrB: 5
              }
            },
            {
              data: {
                id: '4',
                attrA: 2,
                attrB: 4
              }
            },
            {
              data: {
                id: '5',
                attrA: 3,
                attrB: 3
              }
            },
            {
              data: {
                id: '6',
                attrA: 2,
                attrB: 2
              }
            },
            {
              data: {
                id: '7',
                attrA: 2,
                attrB: 1
              }
            },
            {
              data: {
                id: '8',
                attrA: 1,
                attrB: 0
              }
            },
            {
              data: {
                id: '9',
                attrA: 5,
                attrB: 5
              }
            },
            {
              data: {
                id: '10',
                attrA: 6,
                attrB: 5
              }
            },
            {
              data: {
                id: '11',
                attrA: 7,
                attrB: 6
              }
            },
            {
              data: {
                id: '12',
                attrA: 5,
                attrB: 3
              }
            },
            {
              data: {
                id: '13',
                attrA: 7,
                attrB: 3
              }
            },
            {
              data: {
                id: '14',
                attrA: 6,
                attrB: 2
              }
            },
            {
              data: {
                id: '15',
                attrA: 6,
                attrB: 1
              }
            },
            {
              data: {
                id: '16',
                attrA: 8,
                attrB: 1
              }
            }
          ]
        }
      });

      // increase the distance between the expected clusters to ensure the correct result
      // TODO with this turned off, should we always get the expected result anyway?
      for( var i = 9; i <= 16; i++ ){
        var id = '' + i;
        var el = cy.getElementById(id);

        el.data('attrA', el.data('attrA') + 6);
      }

      nodes = cy.nodes();

      n1 = cy.$('#1');
      n2 = cy.$('#2');
      n3 = cy.$('#3');
      n4 = cy.$('#4');
      n5 = cy.$('#5');
      n6 = cy.$('#6');
      n7 = cy.$('#7');
      n8 = cy.$('#8');
      n9 = cy.$('#9');
      n10 = cy.$('#10');
      n11 = cy.$('#11');
      n12 = cy.$('#12');
      n13 = cy.$('#13');
      n14 = cy.$('#14');
      n15 = cy.$('#15');
      n16 = cy.$('#16');

      options = {
        m: 2,
        distance: 'manhattan',
        maxIterations: 10,
        attributes: [
          function(node) {
            return node.data('attrA');
          },
          function(node) {
            return node.data('attrB');
          }
        ],
        testMode: true
      };

      expectedClusters = [{
          elements: [n1, n2, n3, n4, n5, n6, n7, n8]
        },
        {
          elements: [n9, n10, n11, n12, n13, n14, n15, n16]
        }
      ];

      results = cy.elements().fuzzyCMeans(options);
      clusters = results.clusters;
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

    it('should always return the same clusters if we run the algorithm multiple times', function() {
      // Run fuzzy c-means several times. Due to the non-deterministic nature of the algorithm,
      // sometimes the order of the two (# of clusters returned in this example) clusters will be swapped.
      // Example: [ [1,2,3] , [4,5,6] ] swapped to [ [4,5,6] , [1,2,3] ]
      // However, the same nodes should still be grouped together.

      this.timeout(10000);

      for (var i = 0; i < 1000; i++) {
        var clusters2 = cy.elements().fuzzyCMeans(options).clusters;

        expect(clusters2).to.exist;
        expect(clusters2.length).to.equal(clusters.length);

        var sortAsNum = function( a, b ){
          return (+a) - (+b);
        };

        var getId = function(el){ return el.id(); };

        var asString = function( clusters ){
          return clusters.map(function( cluster ){
            return cluster.map( getId ).sort( sortAsNum ).join(',');
          }).sort().join(' | ');
        };

        expect( asString(clusters2) ).to.equal( asString(clusters) );
      }
    });

    it('should return the numerically correct clusters (expected results)', function() {
      for (var c = 0; c < clusters.length; c++) {
        expect(clusters[c].length).to.equal(expectedClusters[c].elements.length);
      }

      var start = (clusters[0].id() === '1') ? 0 : 1;

      expect(clusters[start][0].id()).to.equal(n1.id());
      expect(clusters[start][1].id()).to.equal(n2.id());
      expect(clusters[start][2].id()).to.equal(n3.id());
      expect(clusters[start][3].id()).to.equal(n4.id());
      expect(clusters[start][4].id()).to.equal(n5.id());
      expect(clusters[start][5].id()).to.equal(n6.id());
      expect(clusters[start][6].id()).to.equal(n7.id());
      expect(clusters[start][7].id()).to.equal(n8.id());

      start = (start + 1) % 2;

      expect(clusters[start][0].id()).to.equal(n9.id());
      expect(clusters[start][1].id()).to.equal(n10.id());
      expect(clusters[start][2].id()).to.equal(n11.id());
      expect(clusters[start][3].id()).to.equal(n12.id());
      expect(clusters[start][4].id()).to.equal(n13.id());
      expect(clusters[start][5].id()).to.equal(n14.id());
      expect(clusters[start][6].id()).to.equal(n15.id());
      expect(clusters[start][7].id()).to.equal(n16.id());

    });

  });
});
