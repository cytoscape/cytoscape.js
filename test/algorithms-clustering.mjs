import { expect } from 'chai';
import cytoscape from '../src/index.mjs';
import { clusteringDistance } from '../src/algorithms/clustering-distances.mjs';

// ported from test/collection-k-means.mjs, -k-medoids, -fuzzy-c-means,
// -hierarchical, -markov-clustering; affinity propagation gets a compact
// deterministic fixture instead of v3's 700-line weighted-graph fixture.
describe('gpu/algorithms: clustering', function () {
  var ids = (eles) => eles.map((ele) => ele.id());

  describe('eles.kMeans()', function () {
    var cy, options;

    beforeEach(function () {
      cy = cytoscape({
        elements: [
          { data: { id: '1', attrA: 1.0, attrB: 1.0 } },
          { data: { id: '2', attrA: 1.5, attrB: 2.0 } },
          { data: { id: '3', attrA: 3.0, attrB: 4.0 } },
          { data: { id: '4', attrA: 5.0, attrB: 7.0 } },
          { data: { id: '5', attrA: 3.5, attrB: 5.0 } },
          { data: { id: '6', attrA: 4.5, attrB: 5.0 } },
          { data: { id: '7', attrA: 3.5, attrB: 4.5 } },
        ],
      });

      options = {
        k: 2,
        distance: 'euclidean',
        maxIterations: 10,
        attributes: [
          (node) => node.data('attrA'),
          (node) => node.data('attrB'),
        ],
        testMode: true,
        testCentroids: [
          [1.0, 1.0],
          [5.0, 7.0],
        ],
      };
    });

    it('returns k clusters covering every node exactly once', function () {
      var clusters = cy.elements().kMeans(options);

      expect(clusters.length).to.equal(2);
      expect(clusters[0].length + clusters[1].length).to.equal(7);
      expect(clusters[0].intersection(clusters[1]).length).to.equal(0);
    });

    it('returns the numerically correct clusters', function () {
      var clusters = cy.elements().kMeans(options);

      expect(ids(clusters[0])).to.deep.equal(['1', '2']);
      expect(ids(clusters[1])).to.deep.equal(['3', '4', '5', '6', '7']);
    });

    it('is deterministic with hard-coded centroids', function () {
      var first = cy.elements().kMeans(options);

      for (var i = 0; i < 5; i++) {
        var again = cy.elements().kMeans(options);

        for (var j = 0; j < first.length; j++) {
          expect(again[j].same(first[j])).to.be.true;
        }
      }
    });
  });

  describe('eles.kMedoids()', function () {
    var cy, options;

    beforeEach(function () {
      cy = cytoscape({
        elements: [
          { data: { id: '1', attrA: 2, attrB: 6 } },
          { data: { id: '2', attrA: 3, attrB: 4 } },
          { data: { id: '3', attrA: 3, attrB: 8 } },
          { data: { id: '4', attrA: 4, attrB: 7 } },
          { data: { id: '5', attrA: 6, attrB: 2 } },
          { data: { id: '6', attrA: 6, attrB: 4 } },
          { data: { id: '7', attrA: 7, attrB: 3 } },
          { data: { id: '8', attrA: 7, attrB: 4 } },
          { data: { id: '9', attrA: 8, attrB: 5 } },
          { data: { id: '10', attrA: 7, attrB: 6 } },
        ],
      });

      options = {
        k: 2,
        distance: 'manhattan',
        maxIterations: 10,
        attributes: [
          (node) => node.data('attrA'),
          (node) => node.data('attrB'),
        ],
        testMode: true,
        testCentroids: [cy.$id('2'), cy.$id('8')],
      };
    });

    it('returns the numerically correct clusters', function () {
      var clusters = cy.elements().kMedoids(options);

      expect(clusters.length).to.equal(2);
      expect(ids(clusters[0])).to.deep.equal(['1', '2', '3', '4']);
      expect(ids(clusters[1])).to.deep.equal(['5', '6', '7', '8', '9', '10']);
    });

    it('allows a custom 2-arg distance function', function () {
      var clusters = cy.elements().kMedoids({
        k: 2,
        maxIterations: 10,
        testMode: true,
        testCentroids: [cy.$id('2'), cy.$id('8')],
        // no attributes: the custom fn receives the operands directly, as v3
        distance: (nodeP, nodeQ) => {
          expect(nodeP.id()).to.exist;
          expect(nodeQ.id()).to.exist;

          return (
            Math.abs(nodeP.data('attrA') - nodeQ.data('attrA')) +
            Math.abs(nodeP.data('attrB') - nodeQ.data('attrB'))
          );
        },
      });

      expect(ids(clusters[0])).to.deep.equal(['1', '2', '3', '4']);
      expect(ids(clusters[1])).to.deep.equal(['5', '6', '7', '8', '9', '10']);
    });

    it('throws when k exceeds the number of nodes', function () {
      expect(() =>
        cy.elements().kMedoids({ ...options, testMode: false, k: 11 }),
      ).to.throw(/cannot exceed the number of nodes/);
    });

    it('throws for an empty collection instead of hanging', function () {
      var emptyCy = cytoscape({ elements: [] });

      expect(() => emptyCy.elements().kMedoids({ k: 2 })).to.throw(
        /cannot exceed the number of nodes/,
      );
    });
  });

  describe('eles.fuzzyCMeans()', function () {
    var cy, options;

    beforeEach(function () {
      cy = cytoscape({
        elements: [
          { data: { id: '1', attrA: 0, attrB: 4 } },
          { data: { id: '2', attrA: 0, attrB: 3 } },
          { data: { id: '3', attrA: 1, attrB: 5 } },
          { data: { id: '4', attrA: 2, attrB: 4 } },
          { data: { id: '5', attrA: 3, attrB: 3 } },
          { data: { id: '6', attrA: 2, attrB: 2 } },
          { data: { id: '7', attrA: 2, attrB: 1 } },
          { data: { id: '8', attrA: 1, attrB: 0 } },
          { data: { id: '9', attrA: 5, attrB: 5 } },
          { data: { id: '10', attrA: 6, attrB: 5 } },
          { data: { id: '11', attrA: 7, attrB: 6 } },
          { data: { id: '12', attrA: 5, attrB: 3 } },
          { data: { id: '13', attrA: 7, attrB: 3 } },
          { data: { id: '14', attrA: 6, attrB: 2 } },
          { data: { id: '15', attrA: 6, attrB: 1 } },
          { data: { id: '16', attrA: 8, attrB: 1 } },
        ],
      });

      options = {
        m: 2,
        distance: 'manhattan',
        maxIterations: 10,
        attributes: [
          (node) => node.data('attrA'),
          (node) => node.data('attrB'),
        ],
        testMode: true,
      };
    });

    it('returns the numerically correct clusters (random init, separated data)', function () {
      var results = cy.elements().fuzzyCMeans(options);
      var clusters = results.clusters;

      expect(clusters.length).to.equal(2);

      var start = clusters[0].contains(cy.$id('1')) ? 0 : 1;

      expect(ids(clusters[start])).to.deep.equal([
        '1',
        '2',
        '3',
        '4',
        '5',
        '6',
        '7',
        '8',
      ]);
      expect(ids(clusters[(start + 1) % 2])).to.deep.equal([
        '9',
        '10',
        '11',
        '12',
        '13',
        '14',
        '15',
        '16',
      ]);
    });

    it('degreeOfMembership rows sum to ~1', function () {
      var results = cy.elements().fuzzyCMeans(options);
      var U = results.degreeOfMembership;

      expect(U.length).to.equal(16);

      for (var i = 0; i < U.length; i++) {
        var sum = U[i].reduce((a, b) => a + b, 0);

        expect(Math.abs(sum - 1)).to.be.below(1e-6);
      }
    });

    it('fcm alias resolves', function () {
      expect(cy.elements().fcm(options).clusters.length).to.equal(2);
    });
  });

  describe('eles.hierarchicalClustering()', function () {
    var cy, options;

    beforeEach(function () {
      cy = cytoscape({
        elements: [
          { data: { id: 'A', X1: 1, X2: 1 } },
          { data: { id: 'B', X1: 1.5, X2: 1.5 } },
          { data: { id: 'C', X1: 5, X2: 5 } },
          { data: { id: 'D', X1: 3, X2: 4 } },
          { data: { id: 'E', X1: 4, X2: 4 } },
          { data: { id: 'F', X1: 3, X2: 3.5 } },
        ],
      });

      options = {
        distance: 'euclidean',
        linkage: 'min',
        attributes: [(node) => node.data('X1'), (node) => node.data('X2')],
        mode: 'dendrogram',
        dendrogramDepth: 2,
        addDendrogram: false,
      };
    });

    it('dendrogram level 0: one cluster with all nodes', function () {
      var clusters = cy
        .elements()
        .hierarchicalClustering({ ...options, dendrogramDepth: 0 });

      expect(clusters.length).to.equal(1);
      expect(clusters[0].length).to.equal(6);
    });

    it('dendrogram level 1: two clusters', function () {
      var clusters = cy
        .elements()
        .hierarchicalClustering({ ...options, dendrogramDepth: 1 });

      expect(clusters.length).to.equal(2);
      expect(ids(clusters[0])).to.deep.equal(['B', 'A']);
      expect(ids(clusters[1])).to.deep.equal(['C', 'E', 'F', 'D']);
    });

    it('dendrogram level 2: four clusters', function () {
      var clusters = cy
        .elements()
        .hierarchicalClustering({ ...options, dendrogramDepth: 2 });

      expect(clusters.length).to.equal(4);
      expect(ids(clusters[0])).to.deep.equal(['B']);
      expect(ids(clusters[1])).to.deep.equal(['A']);
      expect(ids(clusters[2])).to.deep.equal(['C']);
      expect(ids(clusters[3])).to.deep.equal(['E', 'F', 'D']);
    });

    it('dendrogram level 3: five clusters', function () {
      var clusters = cy
        .elements()
        .hierarchicalClustering({ ...options, dendrogramDepth: 3 });

      expect(clusters.length).to.equal(5);
      expect(ids(clusters[4])).to.deep.equal(['F', 'D']);
    });

    it('dendrogram levels 4+: one node per cluster (fails safely)', function () {
      for (var depth of [4, 5, 10]) {
        var clusters = cy
          .elements()
          .hierarchicalClustering({ ...options, dendrogramDepth: depth });

        expect(clusters.length).to.equal(6);
        expect(ids(clusters[0])).to.deep.equal(['B']);
        expect(ids(clusters[5])).to.deep.equal(['D']);
      }
    });

    it('threshold mode with default Infinity merges everything', function () {
      var clusters = cy.elements().hierarchicalClustering({
        distance: 'euclidean',
        linkage: 'min',
        attributes: options.attributes,
      });

      expect(clusters.length).to.equal(1);
      expect(clusters[0].length).to.equal(6);
    });

    it('allows a custom 2-arg distance function', function () {
      var clusters = cy.elements().hierarchicalClustering({
        linkage: 'min',
        mode: 'dendrogram',
        dendrogramDepth: 1,
        // no attributes: the custom fn receives the operands directly, as v3
        distance: (nodeP, nodeQ) =>
          Math.abs(nodeP.data('X1') - nodeQ.data('X1')) +
          Math.abs(nodeP.data('X2') - nodeQ.data('X2')),
      });

      expect(clusters.length).to.equal(2);
    });

    it('addDendrogram adds intermediary nodes and edges', function () {
      var before = cy.nodes().length;

      cy.elements().hierarchicalClustering({
        ...options,
        dendrogramDepth: 0,
        addDendrogram: true,
      });

      expect(cy.nodes().length).to.be.above(before);
      expect(cy.edges().length).to.be.above(0);
    });

    it('returns an empty array for an empty collection', function () {
      var emptyCy = cytoscape({ elements: [] });

      expect(emptyCy.elements().hierarchicalClustering(options)).to.deep.equal(
        [],
      );
    });

    it('hca alias resolves', function () {
      expect(
        cy.elements().hca({ ...options, dendrogramDepth: 0 }).length,
      ).to.equal(1);
    });
  });

  describe('eles.markovClustering()', function () {
    var cy;

    beforeEach(function () {
      var edge = (s, t, w) => ({ data: { source: s, target: t, weight: w } });

      cy = cytoscape({
        elements: [
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
          { data: { id: '2147483647' } },
          edge('11', '22', 2),
          edge('11', '66', 3.4),
          edge('11', '77', 3),
          edge('11', '123', 8),
          edge('22', '11', 2),
          edge('22', '33', 3.8),
          edge('22', '55', 8.1),
          edge('33', '22', 3.8),
          edge('33', '44', 7),
          edge('33', '55', 6.2),
          edge('44', '33', 7),
          edge('44', '88', 5.7),
          edge('44', '99', 7.0),
          edge('44', '456', 3),
          edge('55', '22', 8.1),
          edge('55', '33', 6.2),
          edge('55', '77', 2.9),
          edge('55', '88', 3.0),
          edge('66', '11', 3.4),
          edge('66', '123', 5.1),
          edge('77', '11', 3),
          edge('77', '55', 2.9),
          edge('77', '123', 1.5),
          edge('88', '44', 5.7),
          edge('88', '55', 3.0),
          edge('88', '99', 3.0),
          edge('88', '456', 4.2),
          edge('99', '44', 7.0),
          edge('99', '88', 3.0),
          edge('99', '456', 1.8),
          edge('99', '2147483647', 3.9),
          edge('123', '11', 8),
          edge('123', '66', 5.1),
          edge('123', '77', 1.5),
          edge('456', '44', 3),
          edge('456', '88', 4.2),
          edge('456', '99', 1.8),
          edge('456', '2147483647', 6.3),
          edge('2147483647', '99', 3.9),
          edge('2147483647', '456', 6.3),
        ],
      });
    });

    it('returns the numerically correct clusters', function () {
      var clusters = cy.elements().markovClustering({
        inflateFactor: 1.8,
        attributes: [(edge) => edge.data('weight')],
      });

      expect(clusters.length).to.equal(3);
      expect(ids(clusters[0])).to.deep.equal([
        '44',
        '88',
        '99',
        '456',
        '2147483647',
      ]);
      expect(ids(clusters[1])).to.deep.equal(['22', '33', '55']);
      expect(ids(clusters[2])).to.deep.equal(['11', '66', '77', '123']);
    });

    it('every node lands in exactly one cluster', function () {
      var clusters = cy.elements().mcl({
        inflateFactor: 1.8,
        attributes: [(edge) => edge.data('weight')],
      });

      var total = clusters.reduce((sum, cluster) => sum + cluster.length, 0);

      expect(total).to.equal(12);
    });
  });

  describe('eles.affinityPropagation()', function () {
    var cy;

    beforeEach(function () {
      cy = cytoscape({
        elements: [
          { data: { id: 'a1', v: 1.0 } },
          { data: { id: 'a2', v: 1.1 } },
          { data: { id: 'a3', v: 1.2 } },
          { data: { id: 'b1', v: 8.0 } },
          { data: { id: 'b2', v: 8.1 } },
          { data: { id: 'b3', v: 8.2 } },
        ],
      });
    });

    var opts = () => ({
      distance: 'euclidean',
      preference: 'median',
      damping: 0.8,
      attributes: [(node) => node.data('v')],
    });

    it('partitions well-separated data', function () {
      var clusters = cy.elements().affinityPropagation(opts());
      var total = clusters.reduce((sum, cluster) => sum + cluster.length, 0);

      expect(total).to.equal(6);

      // near neighbors share a cluster; far ones do not
      var clusterOf = (id) => clusters.findIndex((c) => c.contains(cy.$id(id)));

      expect(clusterOf('a1')).to.equal(clusterOf('a2'));
      expect(clusterOf('b1')).to.equal(clusterOf('b2'));
      expect(clusterOf('a1')).to.not.equal(clusterOf('b1'));
    });

    it('validates damping and preference like v3', function () {
      expect(() =>
        cy.elements().affinityPropagation({ ...opts(), damping: 1.5 }),
      ).to.throw(/Damping/);
      expect(() =>
        cy.elements().affinityPropagation({ ...opts(), preference: 'bogus' }),
      ).to.throw(/Preference/);
    });

    it('ap alias resolves', function () {
      expect(cy.elements().ap(opts()).length).to.be.above(0);
    });
  });

  // round 30.3: the two metrics no spec had ever selected.  Every
  // clustering spec above passes 'euclidean', 'manhattan' or a custom
  // function, so `squaredEuclidean` and `max` — both public option
  // values — ran nowhere.  Asserting the arithmetic directly is what
  // separates them: a clustering run can land on the same partition
  // under several metrics, so an end-to-end spec would not notice one
  // metric silently resolving to another.
  describe('the distance metrics', function () {
    // p = (0, 0), q = (3, 4): the 3-4-5 triangle makes every metric a
    // different number — 5, 25, 7 and 4 respectively
    var p = [0, 0],
      q = [3, 4];
    var at = (v) => (dim) => v[dim];
    var d = (name) => clusteringDistance(name, 2, at(p), at(q));

    it('squaredEuclidean skips the square root', function () {
      expect(d('euclidean')).to.equal(5);
      expect(d('squaredEuclidean')).to.equal(25);
    });

    it("v3's alternate spellings resolve to the same metric", function () {
      expect(d('squared-euclidean')).to.equal(25);
      expect(d('squaredeuclidean')).to.equal(25);
    });

    it('max is the Chebyshev distance, not a sum', function () {
      expect(d('manhattan')).to.equal(7);
      expect(d('max')).to.equal(4);
    });

    it('an unrecognised name silently falls back to euclidean (v3)', function () {
      expect(d('mahalanobis')).to.equal(d('euclidean'));
    });

    it('kMeans accepts them as option values', function () {
      // the metrics reach the algorithms through the same option the
      // specs above exercise with 'euclidean'
      var cy2 = cytoscape({
        elements: [
          { data: { id: '1', a: 0, b: 0 } },
          { data: { id: '2', a: 1, b: 0 } },
          { data: { id: '3', a: 9, b: 9 } },
          { data: { id: '4', a: 10, b: 9 } },
        ],
      });
      var attributes = [(n) => n.data('a'), (n) => n.data('b')];

      for (var metric of ['squaredEuclidean', 'max']) {
        var clusters = cy2.elements().kMeans({
          k: 2,
          distance: metric,
          maxIterations: 20,
          attributes,
          testMode: true,
          testCentroids: [
            [0, 0],
            [10, 9],
          ],
        });

        expect(ids(clusters[0]).sort(), metric).to.deep.equal(['1', '2']);
        expect(ids(clusters[1]).sort(), metric).to.deep.equal(['3', '4']);
      }
    });
  });
});
