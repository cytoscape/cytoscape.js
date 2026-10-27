import { expect } from 'chai';
import { readFileSync } from 'node:fs';
import cytoscape from '../src/index.mjs';

/*
v4's graph algorithms against independent implementations.

test/fixtures/algorithm-references.json holds seeded fixture graphs (30+
nodes, weighted, directed, disconnected, multigraph, negative-weight) and
what NetworkX 3.7 / SciPy / NumPy compute on them, generated once by
scripts/algorithm-references.py — nothing here runs Python.  The hand
fixtures in test/algorithms*.mjs pin v3's numbers on graphs small enough
to check by hand; these catch what a 6-node graph cannot.

The references compute v4's definitions, which keep v3's where v3
differed from a textbook; the generator notes each mapping at its call
(closeness measured from the node).
Every async algorithm runs with `executor: 'cpu'`: the
GPU lanes are f32 and have their own parity specs.
*/

const FIXTURE = JSON.parse(
  readFileSync(
    new URL('./fixtures/algorithm-references.json', import.meta.url),
    'utf8',
  ),
);
const { graphs, points, gridPoints, references: REF } = FIXTURE;
const cpu = { executor: 'cpu' };
const weight = (e) => e.data('w');

const build = (name) => {
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
  const node = (id) => cy.$id(id);

  return { cy, g, eles: cy.elements(), node, directed: g.directed };
};

// null in the JSON is Infinity (JSON has no non-finite numbers)
const value = (x) => (x == null ? Infinity : x);

/** expect `actual` within `tol` of `expected`, both maybe Infinity */
const near = (actual, expected, tol, label) => {
  const want = value(expected);

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

const perPair = (g, fn, expected, tol, label) => {
  g.nodes.forEach((a, i) =>
    g.nodes.forEach((b, j) =>
      near(fn(a, b), expected[i][j], tol, `${label} ${a} -> ${b}`),
    ),
  );
};

const idSets = (collections) =>
  collections
    .map((c) =>
      c
        .nodes()
        .map((n) => n.id())
        .sort(),
    )
    .sort((a, b) => a.join().localeCompare(b.join()));

const sortedSets = (sets) =>
  sets
    .map((s) => s.map(String).sort())
    .sort((a, b) => a.join().localeCompare(b.join()));

describe('algorithms against NetworkX / SciPy references', function () {
  describe('shortest paths', function () {
    for (const [name, ref] of Object.entries(REF.dijkstra)) {
      it(`dijkstra on ${name}`, function () {
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

      it(`aStar with no heuristic agrees on ${name}`, function () {
        const { g, eles, node, directed } = build(name);

        for (const id of g.nodes) {
          const res = eles.aStar({
            root: node(ref.root),
            goal: node(id),
            weight,
            directed,
          });

          near(
            res.found ? res.distance : Infinity,
            ref.distance[id],
            1e-9,
            `distance to ${id}`,
          );
        }
      });
    }

    for (const [name, ref] of Object.entries(REF.floydWarshall)) {
      it(`floydWarshall on ${name}`, async function () {
        const { g, eles, node, directed } = build(name);
        const res = await eles.floydWarshall({ weight, directed, ...cpu });

        perPair(
          g,
          (a, b) => res.distance(node(a), node(b)),
          ref,
          1e-9,
          'distance',
        );
      });
    }

    it('bellmanFord on a DAG with negative edges', function () {
      const ref = REF.bellmanFord.negd;
      const { g, eles, node } = build('negd');
      const res = eles.bellmanFord({
        root: node(ref.root),
        weight,
        directed: true,
      });

      expect(res.hasNegativeWeightCycle).to.equal(false);
      perNode(
        g,
        (id) => res.distanceTo(node(id)),
        ref.distance,
        1e-9,
        'distance',
      );
    });

    for (const name of ['wu', 'multi']) {
      it(`bellmanFord on ${name}, undirected, matches the shortest paths`, function () {
        const ref = REF.bellmanFord[name];
        const { g, eles, node } = build(name);
        const res = eles.bellmanFord({
          root: node(ref.root),
          weight,
          directed: false,
        });

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

    it('bellmanFord reads a negative undirected edge as a negative cycle', function () {
      const ref = REF.bellmanFord['negd-undirected'];
      const { eles, node } = build('negd');
      const res = eles.bellmanFord({
        root: node(ref.root),
        weight,
        directed: false,
      });

      expect(ref.hasNegativeWeightCycle).to.equal(true);
      expect(res.hasNegativeWeightCycle).to.equal(true);
      expect(res.negativeWeightCycles.length).to.be.above(0);

      // each found cycle is a negative closed walk: one negative edge
      // walked both ways, or a longer cycle whose edges sum negative
      for (const cycle of res.negativeWeightCycles) {
        const edges = cycle.edges();
        const sum = edges.reduce((total, e) => total + weight(e), 0);

        expect(edges.length === 1 ? 2 * sum : sum).to.be.below(0);
      }
    });

    it('bellmanFord finds the negative cycle', function () {
      const ref = REF.bellmanFord.negcyc;
      const { eles, node } = build('negcyc');
      const res = eles.bellmanFord({
        root: node(ref.root),
        weight,
        directed: true,
        findNegativeWeightCycles: true,
      });

      expect(res.hasNegativeWeightCycle).to.equal(ref.hasNegativeWeightCycle);
      expect(idSets(res.negativeWeightCycles)).to.deep.include(ref.cycle);
    });

    for (const [name, ref] of Object.entries(REF.kruskal)) {
      it(`kruskal on ${name}: the minimum spanning forest's weight and size`, function () {
        const { eles } = build(name);
        const forest = eles.kruskal(weight).edges();

        expect(forest.length).to.equal(ref.edges);
        expect(forest.reduce((sum, e) => sum + weight(e), 0)).to.equal(
          ref.weight,
        );
      });
    }
  });

  describe('structure', function () {
    it('tarjanStronglyConnected on wd', function () {
      const { eles } = build('wd');

      expect(idSets(eles.tarjanStronglyConnected().components)).to.deep.equal(
        sortedSets(REF.tarjanStronglyConnected.wd),
      );
    });

    for (const [name, ref] of Object.entries(REF.hopcroftTarjanBiconnected)) {
      it(`hopcroftTarjanBiconnected on ${name}`, function () {
        const { eles } = build(name);
        const res = eles.hopcroftTarjanBiconnected();
        // v4 lists an isolated node as a one-node component; NetworkX
        // lists no component for it
        const components = res.components.filter((c) => c.edges().length > 0);

        expect(res.cut.map((n) => n.id()).sort()).to.deep.equal(
          ref.cut.map(String).sort(),
        );
        expect(idSets(components)).to.deep.equal(sortedSets(ref.components));

        // and every edge lands in exactly one component
        const seen = components.flatMap((c) => c.edges().map((e) => e.id()));

        expect(seen.sort()).to.deep.equal(
          eles
            .edges()
            .filter((e) => !e.isLoop())
            .map((e) => e.id())
            .sort(),
        );
      });
    }

    for (const [name, minCut] of Object.entries(REF.kargerStein)) {
      it(`kargerStein on ${name} finds the Stoer-Wagner min cut`, function () {
        const { eles } = build(name);
        const random = Math.random;
        let seed = 7;

        // seeded, so the randomised contraction is reproducible
        Math.random = () => {
          seed = (seed * 16807) % 2147483647;

          return seed / 2147483647;
        };

        try {
          const res = eles.kargerStein();
          const one = new Set(res.partition1.map((n) => n.id()));
          const crossing = eles
            .edges()
            .filter(
              (e) => one.has(e.source().id()) !== one.has(e.target().id()),
            );

          expect(res.cut.length).to.equal(minCut);
          expect(res.cut.map((e) => e.id()).sort()).to.deep.equal(
            crossing.map((e) => e.id()).sort(),
          );
          expect(res.partition1.length + res.partition2.length).to.equal(
            eles.nodes().length,
          );
        } finally {
          Math.random = random;
        }
      });
    }
  });

  describe('centralities', function () {
    for (const [key, ref] of Object.entries(REF.pageRank)) {
      it(`pageRank ${key}`, async function () {
        const [name, ...rest] = key.split('-');
        const weighted = rest.includes('w');
        const dampingFactor = Number(rest.at(-1).slice(1));
        const { g, eles, node, directed } = build(name);
        const res = await eles.pageRank({
          dampingFactor,
          // `-dir` reads an undirected graph's edge list as stored
          directed: directed || rest.includes('dir'),
          precision: 1e-30,
          iterations: 100000,
          ...(weighted ? { weight } : {}),
          ...cpu,
        });

        perNode(g, (id) => res.rank(node(id)), ref, 1e-12, 'rank');
      });
    }

    for (const [name, ref] of Object.entries(REF.closenessCentrality)) {
      it(`closenessCentrality on ${name}, harmonic and classic`, async function () {
        const { g, eles, node, directed } = build(name);

        for (const [harmonic, direction] of [
          [true, 'out'],
          [false, 'out'],
          ...(directed
            ? [
                [true, 'in'],
                [false, 'in'],
              ]
            : []),
        ]) {
          const opts = {
            directed,
            direction,
            ...(ref.weighted ? { weight } : {}),
          };
          const suffix = direction === 'in' ? 'In' : '';
          const want = harmonic
            ? ref['harmonic' + suffix]
            : ref['classic' + suffix];
          const max = Math.max(...g.nodes.map((id) => want[id]));
          const normalized = await eles.closenessCentralityNormalized({
            ...opts,
            harmonic,
            ...cpu,
          });

          perNode(
            g,
            (id) =>
              eles.closenessCentrality({ ...opts, harmonic, root: node(id) }),
            want,
            1e-12,
            (harmonic ? 'harmonic ' : 'classic ') + direction,
          );
          // normalised by the collection's maximum (0 when every score is)
          perNode(
            g,
            (id) => normalized.closeness(node(id)),
            Object.fromEntries(
              g.nodes.map((id) => [id, max === 0 ? 0 : want[id] / max]),
            ),
            1e-12,
            'normalised',
          );
        }
      });
    }

    for (const [name, ref] of Object.entries(REF.betweennessCentrality)) {
      it(`betweennessCentrality on ${name}`, async function () {
        const { g, eles, node, directed } = build(name);
        const res = await eles.betweennessCentrality({
          directed,
          ...(ref.weighted ? { weight } : {}),
          ...cpu,
        });

        perNode(
          g,
          (id) => res.betweenness(node(id)),
          ref.betweenness,
          1e-9,
          'betweenness',
        );

        const sized = await eles.betweennessCentrality({
          directed,
          normalization: 'size',
          ...(ref.weighted ? { weight } : {}),
          ...cpu,
        });

        perNode(
          g,
          (id) => sized.betweennessNormalized(node(id)),
          ref.normalizedSize,
          1e-12,
          "normalization: 'size'",
        );
      });
    }

    for (const [name, ref] of Object.entries(REF.katzCentrality)) {
      it(`katzCentrality on ${name}`, async function () {
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

        const l2 = await eles.katzCentrality({
          alpha: ref.alpha,
          directed,
          weight,
          tolerance: 1e-15,
          maxIterations: 100000,
          normalization: 'l2',
          ...cpu,
        });

        perNode(
          g,
          (id) => l2.katzNormalized(node(id)),
          ref.normalizedL2,
          1e-9,
          "normalization: 'l2'",
        );
      });
    }

    for (const [name, ref] of Object.entries(REF.degreeCentrality)) {
      it(`degreeCentralityNormalized on ${name}, max and size`, function () {
        const { g, eles, node, directed } = build(name);
        const series = directed ? ['indegree', 'outdegree'] : ['degree'];
        const byMax = eles.degreeCentralityNormalized({ directed });
        const bySize = eles.degreeCentralityNormalized({
          directed,
          normalization: 'size',
        });

        for (const key of series) {
          const max = Math.max(...g.nodes.map((id) => ref[key][id]));

          perNode(
            g,
            (id) => byMax[key](node(id)),
            Object.fromEntries(g.nodes.map((id) => [id, ref[key][id] / max])),
            1e-12,
            `${key} by max`,
          );
          perNode(
            g,
            (id) => bySize[key](node(id)),
            ref[key + 'Size'],
            1e-12,
            `${key} by size`,
          );
        }
      });
    }

    for (const [name, ref] of Object.entries(REF.triangleCount)) {
      it(`triangleCount on ${name}`, async function () {
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
          'clustering coefficient',
        );
        expect(res.totalTriangles).to.equal(ref.totalTriangles);
        expect(res.transitivity).to.be.closeTo(ref.transitivity, 1e-12);
      });
    }
  });

  describe('proximity and structure census', function () {
    for (const [name, ref] of Object.entries(REF.neighborhoodSimilarity)) {
      it(`neighborhoodSimilarity on ${name}, every metric`, async function () {
        const { g, eles, node, directed } = build(name);

        for (const [metric, want] of Object.entries(ref)) {
          const res = await eles.neighborhoodSimilarity({
            metric,
            directed,
            ...cpu,
          });

          perPair(
            g,
            (a, b) => res.similarity(node(a), node(b)),
            want,
            1e-12,
            metric,
          );
        }
      });
    }

    for (const [name, ref] of Object.entries(REF.simRank)) {
      it(`simRank on ${name} reaches the exact fixed point`, async function () {
        const { g, eles, node, directed } = build(name);
        const res = await eles.simRank({
          directed,
          dampingFactor: 0.8,
          tolerance: 1e-14,
          maxIterations: 5000,
          ...cpu,
        });

        perPair(
          g,
          (a, b) => res.similarity(node(a), node(b)),
          ref,
          1e-10,
          'simrank',
        );
      });
    }

    for (const [name, ref] of Object.entries(REF.randomWalkWithRestart)) {
      it(`randomWalkWithRestart on ${name}, scores and proximity`, async function () {
        const { g, eles, node, directed } = build(name);
        const opts = {
          directed,
          weight,
          restartProbability: 0.15,
          tolerance: 1e-15,
          maxIterations: 100000,
          ...cpu,
        };
        const walk = await eles.randomWalkWithRestart({
          ...opts,
          seeds: node(ref.seed),
        });
        const prox = await eles.randomWalkWithRestartProximity(opts);

        perNode(
          g,
          (id) => walk.score(node(id)),
          Object.fromEntries(g.nodes.map((id, i) => [id, ref.score[i]])),
          1e-10,
          'score',
        );
        perPair(
          g,
          (a, b) => prox.proximity(node(a), node(b)),
          ref.proximity,
          1e-10,
          'proximity',
        );
      });
    }

    for (const [name, ref] of Object.entries(REF.heatKernel)) {
      it(`heatKernel on ${name}, both Laplacians, short and long times`, async function () {
        const { g, eles, node } = build(name);

        for (const [key, want] of Object.entries(ref)) {
          const [laplacian, time] = key.split('-');
          const res = await eles.heatKernel({
            laplacian,
            time: Number(time),
            weight,
            ...cpu,
          });

          perPair(g, (a, b) => res.heat(node(a), node(b)), want, 1e-10, key);
        }
      });
    }

    for (const [name, ref] of Object.entries(REF.effectiveResistance)) {
      it(`effectiveResistance on ${name}, weights both ways`, async function () {
        const { g, eles, node } = build(name);

        for (const weightAs of ['conductance', 'resistance']) {
          const res = await eles.effectiveResistance({
            weight,
            weightAs,
            ...cpu,
          });

          perPair(
            g,
            (a, b) => res.resistance(node(a), node(b)),
            ref[weightAs],
            1e-10,
            `resistance, weights as ${weightAs}s`,
          );
        }
      });
    }

    it('motifCensus on wd matches the triadic census', async function () {
      const { eles } = build('wd');
      const res = await eles.motifCensus({ directed: true, ...cpu });

      for (const [triad, count] of Object.entries(REF.motifCensus.wd)) {
        expect(res.counts[triad], triad).to.equal(count);
      }
    });
  });

  describe('clustering', function () {
    const pointsCy = (set = points) => {
      const cy = cytoscape({
        headless: true,
        elements: set.map(([x, y], i) => ({ data: { id: `p${i}`, x, y } })),
      });

      return cy;
    };
    const attributes = [(n) => n.data('x'), (n) => n.data('y')];
    const indexSets = (clusters) =>
      clusters
        .filter((c) => c != null)
        .map((c) => c.map((n) => Number(n.id().slice(1))).sort((a, b) => a - b))
        .sort((a, b) => a[0] - b[0]);

    for (const [key, ref] of Object.entries(REF.hierarchicalClustering)) {
      it(`hierarchicalClustering ${key}`, async function () {
        // `grid-` cases sit merges exactly on the threshold
        const grid = key.startsWith('grid-');
        const [linkage, threshold] = key.replace(/^grid-/, '').split('-');
        const res = await pointsCy(grid ? gridPoints : points)
          .nodes()
          .hierarchicalClustering({
            attributes,
            linkage,
            mode: 'threshold',
            threshold: Number(threshold),
            ...cpu,
          });

        expect(indexSets(res)).to.deep.equal(
          [...ref].sort((a, b) => a[0] - b[0]),
        );
      });
    }

    it('kMeans from fixed centroids', async function () {
      const ref = REF.kMeans.blobs;
      const res = await pointsCy()
        .nodes()
        .kMeans({
          k: ref.initial.length,
          attributes,
          testMode: true,
          testCentroids: ref.initial.map((c) => [...c]),
          maxIterations: 100,
          sensitivityThreshold: 0,
          ...cpu,
        });

      expect(indexSets(res)).to.deep.equal(
        ref.clusters.filter((c) => c.length > 0).sort((a, b) => a[0] - b[0]),
      );
    });

    for (const [key, ref] of Object.entries(REF.affinityPropagation)) {
      it(`affinityPropagation ${key}`, async function () {
        const res = await pointsCy()
          .nodes()
          .affinityPropagation({
            attributes,
            damping: 0.5,
            preference: Number(key.slice(4)),
            ...cpu,
          });

        expect(indexSets(res)).to.deep.equal(ref.clusters);
      });
    }

    it('markovClustering on the karate club', async function () {
      const { eles } = build('karate');
      const res = await eles.markovClustering(cpu);

      expect(
        res.map((c) => c.map((n) => Number(n.id())).sort((a, b) => a - b)),
      ).to.deep.equal(REF.markovClustering.karate);
    });
  });
});
