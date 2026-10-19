import { expect } from 'chai';
import cytoscape from '../src/index.mjs';
import {
  _algoWorkersStats,
  _resetAlgoWorkers,
} from '../src/algorithms/algo-workers.mjs';
import { CancelledError } from '../src/algorithms/cancel.mjs';
import { resolveDistance } from '../src/algorithms/clustering-distances.mjs';
import {
  FUZZY_C_MEANS_OFFLOAD_MIN_N,
  K_MEANS_OFFLOAD_MIN_N,
  K_MEDOIDS_OFFLOAD_MIN_N,
} from '../src/algorithms/k-clustering.mjs';
import { HIERARCHICAL_OFFLOAD_MIN_N } from '../src/algorithms/hierarchical-clustering.mjs';

/*
Round 134 (ledger item 70): the feature-space clusterers' offload lane.

k-means, k-medoids, fuzzy c-means and hierarchical clustering run one
kernel over materialized attribute vectors for a *named* metric — in
this thread under `'cpu'`, on one pool worker under `'workers'` and
`'auto'` — and keep the closure path, on the calling thread, for a
custom distance function (and, for hierarchical, a per-pair linkage).

Two parity records, both asserted with `===`, never a tolerance:

1. **The reference's own change.**  Before round 134 a named metric ran
   the closure path; since, it runs the kernel.  The closure path still
   exists (it is the custom-metric path), so the record is taken here
   directly: the kernel under a metric's *name* against the closure path
   under a custom function that *is* that metric (`resolveDistance`'s
   implementation) — every metric, every mode, every cluster member,
   every membership value.  The one respelling (a square as `x * x`
   where the closure says `Math.pow(x, 2)`) is pinned by its own spec
   below.  The round record also carries the same comparison against
   the pre-round bundle at n = 1024 / 5120 on the `algorithms-gpu`
   feature fixture: every digest identical.
2. **The worker against the reference.**  The worker runs the same
   function from its own source text, so `'workers'` answers `'cpu'`'s
   bits by construction; asserted per family, with the pool's
   `offloads` counter proving where each ran.

Controls run while writing this file (2026-09-29), each restored:
turning the kernel's classification `<` into `<=` (last-wins ties)
turned eleven k-means / k-medoids parity specs red on the
integer-coordinate fixture; dropping the stale-cluster carry
(`kept[c]`) turned the stale-cluster spec red (and every k-means /
k-medoids parity); skipping `moving = true` after a k-medoids swap
turned twelve k-medoids parity specs red; routing a custom metric to
the lane (dropping the `typeof` test) turned the custom-metric
placement and rejection specs red.
*/

/** Deterministic points with integer coordinates (ties on purpose) in
 * three attributes, and a node with a missing attribute. */
const points = (n, seed = 11) => {
  let s = seed;
  const rand = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;

    return s / 0x7fffffff;
  };
  const els = [];

  for (let i = 0; i < n; i++) {
    els.push({
      data: {
        id: 'n' + i,
        a: Math.round(rand() * 40),
        b: Math.round(rand() * 10) / 4,
        c: rand() * 7,
      },
    });
  }

  return els;
};

const attrs = {
  1: [(n) => n.data('a')],
  2: [(n) => n.data('a'), (n) => n.data('b')],
  3: [(n) => n.data('a'), (n) => n.data('b'), (n) => n.data('c')],
};

const METRICS = ['euclidean', 'squaredEuclidean', 'manhattan', 'max'];

/** The closure path's spelling of a named metric: the same
 * implementation, handed over as a custom function. */
const asCustom = (name) => {
  const impl = resolveDistance(name);

  return (length, getP, getQ) => impl(length, getP, getQ);
};

/** A seeded Math.random for the span of `fn` (fuzzy c-means' U, the
 * random centroid and medoid seeding). */
const seeded = async (seed, fn) => {
  const real = Math.random;
  let s = seed;

  Math.random = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;

    return s / 0x7fffffff;
  };

  try {
    return await fn();
  } finally {
    Math.random = real;
  }
};

/** Clusters as id lists; a hole stays a hole, and the length counts. */
const ids = (clusters) =>
  Array.from({ length: clusters.length }, (_, c) =>
    clusters[c] == null ? null : clusters[c].map((e) => e.id()),
  );

const rejection = (promise) =>
  promise.then(
    () => {
      throw new Error('expected the promise to reject');
    },
    (err) => err,
  );

describe('algorithms: the k-clusterings offload lane (round 134)', function () {
  let cy;

  before(function () {
    _resetAlgoWorkers(2);
  });

  after(function () {
    _resetAlgoWorkers();
  });

  beforeEach(function () {
    cy = cytoscape({ elements: points(140) });
  });

  afterEach(function () {
    cy.destroy();
  });

  describe('the reference: the kernel under a name answers the closure path under a function, bit for bit', function () {
    it('the one respelling: Math.pow(x, 2) and x * x round identically', function () {
      let s = 3;
      let checked = 0;

      for (let i = 0; i < 200000; i++) {
        s = (s * 1103515245 + 12345) & 0x7fffffff;

        // spread over magnitudes, both signs, and the subnormal end
        const x =
          ((s / 0x7fffffff) * 2 - 1) * Math.pow(2, (i % 2100) - 1074 + 20);

        expect(Math.pow(x, 2) === x * x, String(x)).to.equal(true);
        checked++;
      }

      expect(checked).to.equal(200000);
    });

    for (const d of [1, 2, 3]) {
      for (const metric of METRICS) {
        it(`kMeans, ${metric}, ${d}-D: test centroids and random seeding`, async function () {
          const centres = () =>
            [
              [3, 1, 2],
              [20, 0.5, 5],
              [21, 2, 1],
              [38, 2.5, 6],
            ].map((c) => c.slice(0, d));
          const base = { k: 4, attributes: attrs[d], executor: 'cpu' };
          const kernel = await cy.nodes().kMeans({
            ...base,
            distance: metric,
            testMode: true,
            testCentroids: centres(),
          });
          const closure = await cy.nodes().kMeans({
            ...base,
            distance: asCustom(metric),
            testMode: true,
            testCentroids: centres(),
          });

          expect(ids(kernel)).to.deep.equal(ids(closure));

          const kernelR = await seeded(5, () =>
            cy.nodes().kMeans({ ...base, distance: metric }),
          );
          const closureR = await seeded(5, () =>
            cy.nodes().kMeans({ ...base, distance: asCustom(metric) }),
          );

          expect(ids(kernelR)).to.deep.equal(ids(closureR));
        });

        it(`kMedoids, ${metric}, ${d}-D: test medoids (one outside the collection) and random seeding`, async function () {
          const sub = cy.nodes().slice(0, 120);
          const medoids = () => [
            cy.$id('n3'),
            cy.$id('n130'), // not in `sub`: its vector is a row of its own
            cy.$id('n77'),
          ];
          const base = { k: 3, attributes: attrs[d], executor: 'cpu' };
          const kernel = await sub.kMedoids({
            ...base,
            distance: metric,
            testMode: true,
            testCentroids: medoids(),
          });
          const closure = await sub.kMedoids({
            ...base,
            distance: asCustom(metric),
            testMode: true,
            testCentroids: medoids(),
          });

          expect(ids(kernel)).to.deep.equal(ids(closure));

          const kernelR = await seeded(9, () =>
            sub.kMedoids({ ...base, distance: metric }),
          );
          const closureR = await seeded(9, () =>
            sub.kMedoids({ ...base, distance: asCustom(metric) }),
          );

          expect(ids(kernelR)).to.deep.equal(ids(closureR));
        });

        it(`fuzzyCMeans, ${metric}, ${d}-D: every membership, and the crisp clusters`, async function () {
          const base = { k: 3, attributes: attrs[d], executor: 'cpu', m: 2.5 };
          const kernel = await seeded(21, () =>
            cy.nodes().fuzzyCMeans({ ...base, distance: metric }),
          );
          const closure = await seeded(21, () =>
            cy.nodes().fuzzyCMeans({ ...base, distance: asCustom(metric) }),
          );

          expect(kernel.degreeOfMembership.length).to.equal(140);
          kernel.degreeOfMembership.forEach((row, i) => {
            row.forEach((u, c) => {
              expect(Object.is(u, closure.degreeOfMembership[i][c])).to.equal(
                true,
              );
            });
          });
          expect(ids(kernel.clusters)).to.deep.equal(ids(closure.clusters));
        });
      }
    }

    for (const metric of METRICS) {
      for (const linkage of ['min', 'max', 'mean']) {
        it(`hierarchicalClustering, ${metric}, ${linkage}: threshold and dendrogram`, async function () {
          const base = { attributes: attrs[2], linkage, executor: 'cpu' };
          // a cut that leaves several clusters under each linkage
          const cut = { min: 0.6, max: 6, mean: 3 }[linkage];
          const threshold = metric === 'squaredEuclidean' ? cut * cut : cut;
          const kernel = await cy
            .nodes()
            .hierarchicalClustering({ ...base, distance: metric, threshold });
          const closure = await cy.nodes().hierarchicalClustering({
            ...base,
            distance: asCustom(metric),
            threshold,
          });

          expect(kernel.length).to.be.greaterThan(1);
          expect(ids(kernel)).to.deep.equal(ids(closure));

          const tree = {
            ...base,
            mode: 'dendrogram',
            dendrogramDepth: 4,
          };

          expect(
            ids(
              await cy
                .nodes()
                .hierarchicalClustering({ ...tree, distance: metric }),
            ),
          ).to.deep.equal(
            ids(
              await cy.nodes().hierarchicalClustering({
                ...tree,
                distance: asCustom(metric),
              }),
            ),
          );
        });
      }
    }

    it("a k-means cluster that empties keeps the members it last held, as the closure path's does (and v3's)", async function () {
      // found by search: centroid 0 holds nodes in the first iteration
      // and loses them all to centroid 2 in the second
      const small = cytoscape({
        elements: [1, 16, 20, 6, 5, 14].map((x, i) => ({
          data: { id: 'p' + i, x },
        })),
      });
      const base = {
        k: 3,
        attributes: [(n) => n.data('x')],
        testMode: true,
        executor: 'cpu',
      };
      const kernel = await small.nodes().kMeans({
        ...base,
        testCentroids: [[23], [-9], [17]],
      });
      const closure = await small.nodes().kMeans({
        ...base,
        distance: asCustom('euclidean'),
        testCentroids: [[23], [-9], [17]],
      });
      const members = ids(kernel).reduce(
        (sum, c) => sum + (c == null ? 0 : c.length),
        0,
      );

      small.destroy();

      // the property the spec is named for: some node is in two clusters
      expect(members).to.be.greaterThan(6);
      expect(ids(kernel)).to.deep.equal(ids(closure));
    });

    it('the caller’s test centroids are read, no longer written', async function () {
      const centres = [
        [3, 1],
        [30, 2],
      ];

      await cy.nodes().kMeans({
        k: 2,
        attributes: attrs[2],
        testMode: true,
        testCentroids: centres,
        executor: 'cpu',
      });

      expect(centres).to.deep.equal([
        [3, 1],
        [30, 2],
      ]);
    });
  });

  describe('the worker: the same kernel, the same bits', function () {
    it("kMeans / kMedoids / fuzzyCMeans / hierarchicalClustering: 'workers' answers 'cpu', and ran on a worker", async function () {
      const nodes = cy.nodes();
      const base = { attributes: attrs[3], distance: 'manhattan' };
      const runs = [
        [
          'kMeans',
          (executor) =>
            nodes.kMeans({
              ...base,
              k: 3,
              executor,
              testMode: true,
              testCentroids: [
                [1, 1, 1],
                [20, 2, 3],
                [39, 2, 6],
              ],
            }),
        ],
        [
          'kMedoids',
          (executor) =>
            seeded(3, () => nodes.kMedoids({ ...base, k: 4, executor })),
        ],
        [
          'hierarchicalClustering',
          (executor) =>
            nodes.hierarchicalClustering({
              ...base,
              linkage: 'max',
              threshold: 6,
              executor,
            }),
        ],
      ];

      for (const [name, run] of runs) {
        const before = _algoWorkersStats().offloads;
        const workers = await run('workers');

        expect(_algoWorkersStats().offloads, name).to.equal(before + 1);
        expect(ids(workers), name).to.deep.equal(ids(await run('cpu')));
        expect(_algoWorkersStats().offloads, name).to.equal(before + 1);
      }

      const fcm = (executor) =>
        seeded(4, () => nodes.fuzzyCMeans({ ...base, k: 3, executor }));
      const before = _algoWorkersStats().offloads;
      const w = await fcm('workers');
      const c = await fcm('cpu');

      expect(_algoWorkersStats().offloads).to.equal(before + 1);
      w.degreeOfMembership.forEach((row, i) => {
        row.forEach((u, k) => {
          expect(Object.is(u, c.degreeOfMembership[i][k])).to.equal(true);
        });
      });
      expect(ids(w.clusters)).to.deep.equal(ids(c.clusters));
    });

    it("dendrogram mode with addDendrogram adds the same tree from a worker's merge log", async function () {
      const opts = {
        attributes: attrs[2],
        mode: 'dendrogram',
        dendrogramDepth: 2,
        addDendrogram: true,
      };
      const a = cytoscape({ elements: points(40) });
      const b = cytoscape({ elements: points(40) });
      const fromWorker = await a
        .nodes()
        .hierarchicalClustering({ ...opts, executor: 'workers' });
      const inThread = await b
        .nodes()
        .hierarchicalClustering({ ...opts, executor: 'cpu' });
      const tree = (cy) =>
        cy
          .edges()
          .map((e) => `${e.source().id()}>${e.target().id()}`)
          .sort();

      expect(ids(fromWorker)).to.deep.equal(ids(inThread));
      expect(a.nodes().length).to.equal(40 + 39);
      expect(tree(a)).to.deep.equal(tree(b));

      a.destroy();
      b.destroy();
    });
  });

  describe("where 'auto' puts the lane", function () {
    const sized = (n) => cytoscape({ elements: points(n) });

    it('each family offloads at its crossover and stays in-thread below it', async function () {
      const families = [
        [
          'kMeans',
          K_MEANS_OFFLOAD_MIN_N,
          (eles) => eles.kMeans({ k: 3, attributes: attrs[2] }),
        ],
        [
          'kMedoids',
          K_MEDOIDS_OFFLOAD_MIN_N,
          (eles) => eles.kMedoids({ k: 3, attributes: attrs[2] }),
        ],
        [
          'fuzzyCMeans',
          FUZZY_C_MEANS_OFFLOAD_MIN_N,
          (eles) => eles.fuzzyCMeans({ k: 3, attributes: attrs[2] }),
        ],
        [
          'hierarchicalClustering',
          HIERARCHICAL_OFFLOAD_MIN_N,
          (eles) => eles.hierarchicalClustering({ attributes: attrs[2] }),
        ],
      ];

      for (const [name, minN, run] of families) {
        const at = sized(minN);
        const below = sized(minN - 1);
        const before = _algoWorkersStats().offloads;

        await run(below.nodes());
        expect(_algoWorkersStats().offloads, `${name} below`).to.equal(before);

        await run(at.nodes());
        expect(_algoWorkersStats().offloads, `${name} at`).to.equal(before + 1);

        at.destroy();
        below.destroy();
      }
    });

    it('a custom metric never leaves the calling thread, whatever the size', async function () {
      const distance = asCustom('euclidean');
      const stats = { ..._algoWorkersStats() };
      const at = (n, run) => {
        const big = sized(n);

        return Promise.resolve(run(big.nodes())).finally(() => big.destroy());
      };

      // each family at its own crossover, where a named metric offloads
      await at(K_MEANS_OFFLOAD_MIN_N, (eles) => {
        const run = eles.kMeans({ k: 3, attributes: attrs[2], distance });

        // the reference completed inside the call: no lane was consulted
        expect(run.cancel()).to.equal(false);

        return run;
      });
      await at(K_MEDOIDS_OFFLOAD_MIN_N, (eles) =>
        eles.kMedoids({ k: 3, attributes: attrs[2], distance }),
      );
      await at(FUZZY_C_MEANS_OFFLOAD_MIN_N, (eles) =>
        eles.fuzzyCMeans({ k: 3, attributes: attrs[2], distance }),
      );
      await at(HIERARCHICAL_OFFLOAD_MIN_N, (eles) =>
        eles.hierarchicalClustering({ attributes: attrs[2], distance }),
      );
      // a per-pair linkage keeps the closure path too, even named
      await at(HIERARCHICAL_OFFLOAD_MIN_N, (eles) =>
        eles.hierarchicalClustering({ attributes: attrs[2], linkage: 'other' }),
      );

      expect(_algoWorkersStats().offloads).to.equal(stats.offloads);
      expect(_algoWorkersStats().runs).to.equal(stats.runs);
    });

    it("an explicit 'workers' rejects a custom metric and a per-pair linkage, each with its reason", async function () {
      const distance = asCustom('euclidean');

      for (const run of [
        () =>
          cy
            .nodes()
            .kMeans({ attributes: attrs[2], distance, executor: 'workers' }),
        () =>
          cy
            .nodes()
            .kMedoids({ attributes: attrs[2], distance, executor: 'workers' }),
        () =>
          cy.nodes().fuzzyCMeans({
            attributes: attrs[2],
            distance,
            executor: 'workers',
          }),
        () =>
          cy.nodes().hierarchicalClustering({
            attributes: attrs[2],
            distance,
            executor: 'workers',
          }),
      ]) {
        expect((await rejection(run())).message).to.match(
          /custom distance function runs on the calling thread/,
        );
      }

      const linkage = await rejection(
        cy.nodes().hierarchicalClustering({
          attributes: attrs[2],
          linkage: 'other',
          executor: 'workers',
        }),
      );

      expect(linkage.message).to.match(
        /linkage other than 'min', 'max' or 'mean' runs on the calling thread/,
      );
    });

    it("k-medoids' k guard fires from the snapshot on every lane, and from the closure path", async function () {
      for (const executor of ['cpu', 'workers', 'auto']) {
        const err = await rejection(
          cy.nodes().kMedoids({ k: 141, attributes: attrs[2], executor }),
        );

        expect(err.message, executor).to.match(
          /cannot exceed the number of nodes/,
        );
      }

      // and from the closure path, for a custom metric
      const closure = await rejection(
        cy.nodes().kMedoids({
          k: 141,
          attributes: attrs[2],
          distance: asCustom('manhattan'),
        }),
      );

      expect(closure.message).to.match(/cannot exceed the number of nodes/);
    });
  });

  describe('cancellation (round 128) through the lane', function () {
    it('cancelled while queued: nothing posts; the next run answers the reference', async function () {
      const opts = { attributes: attrs[3], linkage: 'mean', threshold: 4 };
      const before = { ..._algoWorkersStats() };
      const run = cy
        .nodes()
        .hierarchicalClustering({ ...opts, executor: 'workers' });

      expect(run.cancel()).to.equal(true);

      const err = await rejection(run);

      expect(err).to.be.instanceOf(CancelledError);
      expect(_algoWorkersStats().offloads).to.equal(before.offloads);

      const again = await cy
        .nodes()
        .hierarchicalClustering({ ...opts, executor: 'workers' });

      expect(ids(again)).to.deep.equal(
        ids(
          await cy.nodes().hierarchicalClustering({ ...opts, executor: 'cpu' }),
        ),
      );
    });

    it('cancelled mid-run: the answer is dropped', async function () {
      // two clusters of ~750: the swap cost is quadratic in cluster
      // size, so the kernel runs for tens of milliseconds
      const big = cytoscape({ elements: points(1500) });
      const run = big
        .nodes()
        .kMedoids({ k: 2, attributes: attrs[3], executor: 'workers' });

      await new Promise((r) => setTimeout(r, 5));
      expect(run.cancel()).to.equal(true);
      expect(await rejection(run)).to.be.instanceOf(CancelledError);

      big.destroy();
    });
  });
});
