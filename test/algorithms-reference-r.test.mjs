import { expect } from 'chai';
import { readFileSync } from 'node:fs';
import cytoscape from '../src/index.mjs';

/*
Round 150: v4's graph algorithms against R — igraph, stats, cluster,
e1071 and MCL — the second library beside test/algorithms-reference.test.mjs's
NetworkX / SciPy / scikit-learn.  scripts/algorithm-references.R computed
these once into test/fixtures/algorithm-references-r.json, on the graphs and
points the Python reference recorded; nothing here runs R.

Where R's convention differs from v4's, the case says so and converts:
igraph's normalized closeness is r / Σd over the r reachable nodes, v4's
classic (NetworkX's) multiplies that by r / (n − 1).  Everything else is
compared as computed.  Every async algorithm runs with `executor: 'cpu'`.
*/

const read = (file) =>
  JSON.parse(
    readFileSync(new URL(`./fixtures/${file}`, import.meta.url), 'utf8'),
  );

const { graphs, points, gridPoints } = read('algorithm-references.json');
const { references: REF } = read('algorithm-references-r.json');
const cpu = { executor: 'cpu' };
const weight = (e) => e.data('w');

const build = (name, directedOverride) => {
  const g = graphs[name];
  const cy = cytoscape({
    headless: true,
    elements: [
      ...g.nodes.map((id) => ({ data: { id } })),
      ...g.edges.map(([id, source, target, w]) => ({
        data: { id, source, target, w },
      })),
    ],
  });

  return {
    g,
    eles: cy.elements(),
    node: (id) => cy.$id(id),
    directed: directedOverride ?? g.directed,
  };
};

// null in the JSON is Infinity
const near = (actual, expected, tol, label) => {
  const want = expected == null ? Infinity : expected;

  if (!Number.isFinite(want)) {
    expect(actual, label).to.equal(want);
  } else {
    expect(actual, label).to.be.closeTo(want, tol);
  }
};

const perNode = (g, fn, expected, tol, label) => {
  for (const id of g.nodes) {
    near(fn(id), expected[id], tol, `${label} at ${id}`);
  }
};

const perPair = (g, fn, rows, tol, label) =>
  g.nodes.forEach((a, i) =>
    g.nodes.forEach((b, j) =>
      near(fn(a, b), rows[i][j], tol, `${label} ${a} -> ${b}`),
    ),
  );

const sortedSets = (sets) => sets.map((s) => [...s].map(String).sort()).sort();
const nodeIdSets = (collections) =>
  sortedSets(collections.map((c) => c.nodes().map((n) => n.id())));

describe('algorithms against R references (igraph, stats, cluster, e1071, MCL)', function () {
  describe('shortest paths, forests, components, search', function () {
    for (const [name, ref] of Object.entries(REF.dijkstra)) {
      it(`dijkstra on ${name}: igraph's distances`, function () {
        const { g, eles, node, directed } = build(name);
        const res = eles.dijkstra({ root: node(ref.root), weight, directed });

        perNode(
          g,
          (id) => res.distanceTo(node(id)),
          ref.distance,
          1e-9,
          'distance',
        );
      });
    }

    for (const [name, rows] of Object.entries(REF.floydWarshall)) {
      it(`floydWarshall on ${name}: igraph's all-pairs distances`, async function () {
        const { g, eles, node, directed } = build(name);
        const res = await eles.floydWarshall({ weight, directed, ...cpu });

        perPair(
          g,
          (a, b) => res.distance(node(a), node(b)),
          rows,
          1e-9,
          'distance',
        );
      });
    }

    for (const [name, ref] of Object.entries(REF.bellmanFord)) {
      it(`bellmanFord on ${name}: igraph's Bellman–Ford`, function () {
        const { g, eles, node, directed } = build(name);
        const res = eles.bellmanFord({
          root: node(ref.root),
          weight,
          directed,
        });

        if (ref.hasNegativeWeightCycle) {
          expect(res.hasNegativeWeightCycle).to.equal(true);

          return;
        }

        expect(res.hasNegativeWeightCycle).to.equal(false);
        perNode(
          g,
          (id) => res.distanceTo(node(id)),
          ref.distance,
          1e-9,
          'distance',
        );
      });
    }

    for (const [name, ref] of Object.entries(REF.kruskal)) {
      it(`kruskal on ${name}: igraph's minimum spanning forest`, function () {
        const { eles } = build(name);
        const tree = eles.kruskal(weight);

        expect(tree.edges().length).to.equal(ref.edges);
        expect(
          tree.edges().reduce((sum, e) => sum + e.data('w'), 0),
        ).to.be.closeTo(ref.weight, 1e-9);
      });
    }

    it("tarjanStronglyConnected on wd: igraph's strong components", function () {
      const { eles } = build('wd');

      expect(
        nodeIdSets(eles.tarjanStronglyConnected().components),
      ).to.deep.equal(sortedSets(REF.tarjanStronglyConnected.wd));
    });

    for (const [name, ref] of Object.entries(REF.hopcroftTarjanBiconnected)) {
      it(`hopcroftTarjanBiconnected on ${name}: igraph's cut vertices and blocks`, function () {
        const { eles } = build(name);
        const res = eles.hopcroftTarjanBiconnected();

        expect(res.cut.map((n) => n.id()).sort()).to.deep.equal(
          [...ref.cut].sort(),
        );
        // v4 lists an isolated node as a one-node component; igraph does not
        expect(
          nodeIdSets(res.components.filter((c) => c.edges().length > 0)),
        ).to.deep.equal(sortedSets(ref.components));
      });
    }

    for (const [name, minCut] of Object.entries(REF.kargerStein)) {
      it(`kargerStein on ${name}: igraph's min cut`, function () {
        const { eles } = build(name);
        const random = Math.random;
        let seed = 7;

        // seeded, so the randomised contraction is reproducible
        Math.random = () => {
          seed = (seed * 16807) % 2147483647;

          return seed / 2147483647;
        };

        try {
          expect(eles.kargerStein().cut.length).to.equal(minCut);
        } finally {
          Math.random = random;
        }
      });
    }

    for (const [name, ref] of Object.entries(REF.search)) {
      it(`breadth- and depth-first search on ${name}: igraph's bfs and dfs`, function () {
        const { eles, node, directed } = build(name);
        const root = node(ref.root);
        const order = eles
          .breadthFirstSearch({ root, directed })
          .path.nodes()
          .map((n) => n.id());

        expect([...order].sort()).to.deep.equal(Object.keys(ref.depth).sort());

        for (let i = 1; i < order.length; i++) {
          expect(ref.depth[order[i]], order[i]).to.be.at.least(
            ref.depth[order[i - 1]],
          );
        }

        expect(
          eles
            .depthFirstSearch({ root, directed })
            .path.nodes()
            .map((n) => n.id())
            .sort(),
        ).to.deep.equal([...ref.dfsReach].sort());
      });
    }

    for (const [name, ref] of Object.entries(REF.hierholzer)) {
      it(`hierholzer on ${name}: igraph's has_eulerian_path`, function () {
        const { eles, directed } = build(name);

        expect(eles.hierholzer({ directed }).found).to.equal(ref.hasPath);
      });
    }
  });

  describe('centralities', function () {
    for (const [key, ref] of Object.entries(REF.pageRank)) {
      it(`pageRank ${key}: igraph's page_rank`, async function () {
        const [name, ...rest] = key.split('-');
        const { g, eles, node, directed } = build(name);
        const res = await eles.pageRank({
          dampingFactor: Number(rest.at(-1).slice(1)),
          directed: directed || rest.includes('dir'),
          precision: 1e-30,
          iterations: 100000,
          ...(rest.includes('w') ? { weight } : {}),
          ...cpu,
        });

        perNode(g, (id) => res.rank(node(id)), ref, 1e-10, 'rank');
      });
    }

    for (const [name, ref] of Object.entries(REF.degreeCentrality)) {
      it(`degreeCentralityNormalized on ${name}: igraph's degree, normalized`, function () {
        const { g, eles, node, directed } = build(name);
        const sized = eles.degreeCentralityNormalized({
          directed,
          normalization: 'size',
        });

        for (const key of directed ? ['indegree', 'outdegree'] : ['degree']) {
          perNode(
            g,
            (id) => sized[key](node(id)),
            ref[key + 'Size'],
            1e-12,
            key,
          );
        }
      });
    }

    for (const [name, ref] of Object.entries(REF.closenessCentrality)) {
      it(`closenessCentrality on ${name}: igraph's closeness and harmonic_centrality`, async function () {
        const { g, eles, node, directed } = build(name);
        const n = g.nodes.length;

        for (const direction of directed ? ['out', 'in'] : ['out']) {
          const s = direction === 'in' ? 'In' : '';
          const opts = {
            directed,
            direction,
            ...(ref.weighted ? { weight } : {}),
          };
          // igraph: r / Σd; v4 (NetworkX, Wasserman–Faust): × r / (n − 1)
          const classic = Object.fromEntries(
            g.nodes.map((id) => {
              const r = ref['reached' + s][id];

              return [
                id,
                r === 0
                  ? 0
                  : (ref['closenessNormalized' + s][id] * r) / (n - 1),
              ];
            }),
          );
          const sized = await eles.closenessCentralityNormalized({
            ...opts,
            normalization: 'size',
            ...cpu,
          });

          perNode(
            g,
            (id) =>
              eles.closenessCentrality({
                ...opts,
                harmonic: false,
                root: node(id),
              }),
            classic,
            1e-10,
            `classic ${direction}`,
          );
          perNode(
            g,
            (id) => eles.closenessCentrality({ ...opts, root: node(id) }),
            ref['harmonic' + s],
            1e-10,
            `harmonic ${direction}`,
          );
          perNode(
            g,
            (id) => sized.closeness(node(id)),
            ref['harmonicSize' + s],
            1e-10,
            `harmonic, normalization 'size', ${direction}`,
          );
        }
      });
    }

    for (const [name, ref] of Object.entries(REF.betweennessCentrality)) {
      it(`betweennessCentrality on ${name}: igraph's betweenness, raw and normalized`, async function () {
        const { g, eles, node, directed } = build(name);
        const opts = { directed, ...(ref.weighted ? { weight } : {}), ...cpu };
        const raw = await eles.betweennessCentrality(opts);
        const sized = await eles.betweennessCentrality({
          ...opts,
          normalization: 'size',
        });

        perNode(
          g,
          (id) => raw.betweenness(node(id)),
          ref.betweenness,
          1e-9,
          'raw',
        );
        perNode(
          g,
          (id) => sized.betweennessNormalized(node(id)),
          ref.normalizedSize,
          1e-12,
          'size',
        );
      });
    }

    for (const [name, ref] of Object.entries(REF.katzCentrality)) {
      it(`katzCentrality on ${name}: igraph's alpha_centrality`, async function () {
        const { g, eles, node, directed } = build(name);
        const res = await eles.katzCentrality({
          alpha: ref.alpha,
          directed,
          weight,
          tolerance: 1e-15,
          maxIterations: 100000,
          ...cpu,
        });

        perNode(g, (id) => res.katz(node(id)), ref.katz, 1e-9, 'katz');
      });
    }

    for (const [name, ref] of Object.entries(REF.triangleCount)) {
      it(`triangleCount on ${name}: igraph's count_triangles and transitivity`, async function () {
        const { g, eles, node } = build(name);
        const res = await eles.triangleCount(cpu);

        perNode(
          g,
          (id) => res.triangles(node(id)),
          ref.triangles,
          0,
          'triangles',
        );
        perNode(
          g,
          (id) => res.clusteringCoefficient(node(id)),
          ref.clusteringCoefficient,
          1e-12,
          'local',
        );
        expect(res.transitivity).to.be.closeTo(ref.transitivity, 1e-12);
      });
    }
  });

  describe('proximity and structure census', function () {
    for (const [name, ref] of Object.entries(REF.neighborhoodSimilarity)) {
      it(`neighborhoodSimilarity on ${name}: igraph's Jaccard similarity`, async function () {
        const { g, eles, node, directed } = build(name);
        const res = await eles.neighborhoodSimilarity({
          metric: 'jaccard',
          directed,
          ...cpu,
        });

        g.nodes.forEach((a, i) =>
          g.nodes.forEach((b, j) => {
            const v4 = res.similarity(node(a), node(b));

            // igraph: a node is wholly similar to itself, even with no
            // neighbours; v4 (and NetworkX's set arithmetic) answer 0/0
            // as 0 there
            if (i === j && ref.jaccard[i][j] === 1 && v4 === 0) {
              expect(
                directed
                  ? node(a).outgoers().nodes()
                  : node(a).neighborhood().nodes(),
                `${a} has no neighbours`,
              ).to.have.length(0);

              return;
            }

            near(v4, ref.jaccard[i][j], 1e-12, `jaccard ${a} -> ${b}`);
          }),
        );
      });
    }

    it("motifCensus on wd: igraph's triad_census", async function () {
      const { eles } = build('wd');
      const res = await eles.motifCensus({ directed: true, ...cpu });

      for (const [triad, count] of Object.entries(REF.motifCensus.wd)) {
        expect(res.counts[triad], triad).to.equal(count);
      }
    });

    for (const [name, ref] of Object.entries(REF.randomWalkWithRestart)) {
      it(`randomWalkWithRestart on ${name}: igraph's personalized page_rank`, async function () {
        const { g, eles, node, directed } = build(name);
        const res = await eles.randomWalkWithRestart({
          seeds: node(ref.seed),
          directed,
          weight,
          restartProbability: 0.15,
          tolerance: 1e-15,
          maxIterations: 100000,
          ...cpu,
        });

        g.nodes.forEach((id, i) =>
          near(
            res.score(node(id)),
            ref.scoreRestart[i],
            1e-10,
            `score at ${id}`,
          ),
        );
      });
    }
  });

  describe('clustering', function () {
    const pointsCy = (set) =>
      cytoscape({
        headless: true,
        elements: set.map(([x, y], i) => ({ data: { id: `p${i}`, x, y } })),
      });
    const attributes = [(n) => n.data('x'), (n) => n.data('y')];
    const indexSets = (clusters) =>
      clusters
        .filter((c) => c != null && c.length > 0)
        .map((c) => c.map((n) => Number(n.id().slice(1))).sort((a, b) => a - b))
        .sort((a, b) => a[0] - b[0]);
    const sortedIndexSets = (sets) =>
      sets.map((s) => [...s].sort((a, b) => a - b)).sort((a, b) => a[0] - b[0]);

    for (const [key, ref] of Object.entries(REF.hierarchicalClustering)) {
      it(`hierarchicalClustering ${key}: hclust and cutree`, async function () {
        const [set, linkage, t] = key.split('-');
        const res = await pointsCy(set === 'grid' ? gridPoints : points)
          .nodes()
          .hierarchicalClustering({
            attributes,
            linkage,
            mode: 'threshold',
            threshold: Number(t),
            ...cpu,
          });

        expect(indexSets(res)).to.deep.equal(sortedIndexSets(ref));
      });
    }

    it("kMeans from fixed centroids: stats' kmeans (Lloyd)", async function () {
      const ref = REF.kMeans.blobs;
      const res = await pointsCy(points)
        .nodes()
        .kMeans({
          k: 3,
          attributes,
          testMode: true,
          testCentroids: ref.initial.map((c) => [...c]),
          maxIterations: 100,
          sensitivityThreshold: 0,
          ...cpu,
        });

      expect(indexSets(res)).to.deep.equal(
        sortedIndexSets(ref.clusters.filter((c) => c.length > 0)),
      );
    });

    it("kMedoids from cluster's PAM medoids keeps PAM's partition", async function () {
      const ref = REF.kMedoids.blobs;
      const cy = pointsCy(points);
      const res = await cy.nodes().kMedoids({
        k: 3,
        attributes,
        testMode: true,
        testCentroids: ref.medoids.map((i) => cy.$id(`p${i}`)),
        ...cpu,
      });

      expect(indexSets(res)).to.deep.equal(sortedIndexSets(ref.clusters));
    });

    it("fuzzyCMeans reaches e1071's cmeans fixed point", async function () {
      const ref = REF.fuzzyCMeans.blobs;
      const nodes = pointsCy(points).nodes();
      const res = await nodes.fuzzyCMeans({
        k: 3,
        m: 2,
        attributes,
        sensitivityThreshold: 1e-12,
        maxIterations: 10000,
        ...cpu,
      });
      const U = res.degreeOfMembership;
      const centroidX = [0, 1, 2].map((k) => {
        let num = 0;
        let den = 0;

        nodes.forEach((n, i) => {
          num += U[i][k] ** 2 * n.data('x');
          den += U[i][k] ** 2;
        });

        return num / den;
      });
      const order = [0, 1, 2].sort((a, b) => centroidX[a] - centroidX[b]);

      order.forEach((k, j) =>
        near(centroidX[k], ref.centroids[j][0], 1e-6, `centroid ${j}`),
      );
      ref.membership.forEach((row, i) =>
        order.forEach((k, j) =>
          near(U[i][k], row[j], 1e-6, `membership ${i} in ${j}`),
        ),
      );
    });

    for (const [name, ref] of Object.entries(REF.markovClustering)) {
      it(`markovClustering on ${name}: R's MCL`, async function () {
        const { eles } = build(name);
        const res = await eles.markovClustering(cpu);

        expect(
          sortedIndexSets(res.map((c) => c.map((n) => Number(n.id())))),
        ).to.deep.equal(sortedIndexSets(ref.clusters));
      });
    }
  });
});
