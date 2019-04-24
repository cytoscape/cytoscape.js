var expect = require('chai').expect;
var cytoscape = require('../src/test.js', cytoscape);

// Expected results from: http://www.inf.unibz.it/dis/teaching/DWDM/slides2010/lesson8-Clustering.pdf
//                        https://en.wikipedia.org/wiki/K-medoids

describe('Algorithms', function(){
  describe('eles.kMediods()', function() {

    var cy;
    var nodes;
    var n1, n2, n3, n4, n5, n6, n7, n8, n9, n10;

    var options;
    var expectedClusters;
    var clusters;

    before(function(done) {
      cytoscape({
        elements: {
          nodes: [{
              data: {
                id: '1',
                attrA: 2,
                attrB: 6
              }
            },
            {
              data: {
                id: '2',
                attrA: 3,
                attrB: 4
              }
            },
            {
              data: {
                id: '3',
                attrA: 3,
                attrB: 8
              }
            },
            {
              data: {
                id: '4',
                attrA: 4,
                attrB: 7
              }
            },
            {
              data: {
                id: '5',
                attrA: 6,
                attrB: 2
              }
            },
            {
              data: {
                id: '6',
                attrA: 6,
                attrB: 4
              }
            },
            {
              data: {
                id: '7',
                attrA: 7,
                attrB: 3
              }
            },
            {
              data: {
                id: '8',
                attrA: 7,
                attrB: 4
              }
            },
            {
              data: {
                id: '9',
                attrA: 8,
                attrB: 5
              }
            },
            {
              data: {
                id: '10',
                attrA: 7,
                attrB: 6
              }
            }
          ]
        },
        ready: function() {
          cy = this;
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

          options = {
            k: 2,
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
            testMode: true,
            testCentroids: [n2, n8]
          };

          expectedClusters = [{
              elements: [n1, n2, n3, n4]
            },
            {
              elements: [n5, n6, n7, n8, n9, n10]
            }
          ];

          clusters = cy.elements().kMedoids(options);

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

    it('should always return the same clusters if we hard-code medoid values (analogous to setting seed)', function() {
      // Run k-medoids several times. Setting testMode to true and hard-coding medoid values
      // (analogous to setting a seed) should return the same clusters every time.
      for (var i = 0; i < 10; i++) {
        var clusters2 = cy.elements().kMedoids( options );

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
      for (var c = 0; c < clusters.length; c++) {
        expect(clusters[c].length).to.equal(expectedClusters[c].elements.length);
      }

      expect(clusters[0][0].id()).to.equal(n1.id());
      expect(clusters[0][1].id()).to.equal(n2.id());
      expect(clusters[0][2].id()).to.equal(n3.id());
      expect(clusters[0][3].id()).to.equal(n4.id());

      expect(clusters[1][0].id()).to.equal(n5.id());
      expect(clusters[1][1].id()).to.equal(n6.id());
      expect(clusters[1][2].id()).to.equal(n7.id());
      expect(clusters[1][3].id()).to.equal(n8.id());
      expect(clusters[1][4].id()).to.equal(n9.id());
      expect(clusters[1][5].id()).to.equal(n10.id());

    });

    it('allows a custom 2-arg distance function', function(){
      var cltrs = cy.elements().kMedoids({
        k: 2,
        maxIterations: 10,
        testMode: true,
        testCentroids: [n2, n8],
        distance: function(nodeP, nodeQ){
          expect(nodeP).to.exist;
          expect(nodeQ).to.exist;

          // are the args collection-like?
          expect(nodeP.id()).to.exist;
          expect(nodeQ.id()).to.exist;

          var da = Math.abs(nodeP.data('attrA') - nodeQ.data('attrA'));
          var db = Math.abs(nodeP.data('attrB') - nodeQ.data('attrB'));

          return da + db;
        }
      });

      var cltrIExpected = function(i){
        var expected = expectedClusters[i].elements.reduce(function(eles, ele){
          return eles.merge(ele);
        }, cy.collection());
        var actual = cltrs[i];

        return expected.same(actual);
      };

      expect(cltrs).to.exist;
      expect(cltrs.length).to.equal(2);

      expect(cltrIExpected(0), '0th cluster expected').to.be.true;
      expect(cltrIExpected(1), '1st cluster expected').to.be.true;
    });

  });
});
