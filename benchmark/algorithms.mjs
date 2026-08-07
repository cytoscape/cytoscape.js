// Focused graph-algorithm sweep: v3 vs GPU/v4 at BENCH_N scale.
//
// Standalone (not part of index.mjs).  The round-10 algorithm ports run
// slot-native over CSR; this sweep compares them against the v3
// implementations on the shared deterministic fixture (every node degree 4).
// Ops with superlinear cost gate on N so the default run stays quick:
//
//   npm's default            BENCH_N=2000  — linear-ish ops + betweenness
//   BENCH_N=500 node --import tsx benchmark/algorithms.mjs
//                                          — adds pageRank, floydWarshall,
//                                            closeness-normalized, clustering
//
// v4 API deltas vs v3 baked into the op pairs: roots/goals are collections
// on the gpu side (v3 takes them too), and weight fns are plain functions.

import { bench, group, summary, do_not_optimize } from 'mitata';
import { finishRun } from './bench-run.mjs';
import { buildElements, makeV3, makeGpu, MIDNUM, N } from './graph.mjs';

const elements = buildElements();

const v3 = makeV3(elements);
const gpu = makeGpu(elements);

const K = 8; // rotation pool size (power of two)
const MASK = K - 1;

function cmp(name, setup, op) {
  const vs = Array.from({ length: K }, (_, k) => setup(v3, k));
  const gs = Array.from({ length: K }, (_, k) => setup(gpu, k));
  let i = 0;

  group(name, () => {
    summary(() => {
      bench('v3', () => {
        const k = i++ & MASK;
        return do_not_optimize(op(vs[k], k));
      });
      bench('gpu', () => {
        const k = i++ & MASK;
        return do_not_optimize(op(gs[k], k));
      });
    });
  });
}

// operand builders: { eles, root, goal } per rotation slot
const ctx = (cy, k) => ({
  eles: cy.elements(),
  root: cy.$id('n' + (MIDNUM + k)),
  goal: cy.$id('n' + ((MIDNUM + k + Math.floor(N / 4)) % N)),
});

const weight = (edge) => 1 + (edge.data('w') ?? 0); // constant fn: measures the call path
const attrs = [(n) => n.data('foo'), (n) => n.data('weight')]; // feature space for the clustering rows

console.log(`\n== algorithm sweep (N=${N} nodes, ${2 * N} edges) ==`);

cmp('algo: bfs (whole graph)', ctx, (c) => c.eles.bfs({ roots: c.root }));
cmp('algo: dfs (whole graph)', ctx, (c) => c.eles.dfs({ roots: c.root }));
cmp('algo: dijkstra + pathTo', ctx, (c) =>
  c.eles.dijkstra({ root: c.root, weight }).pathTo(c.goal),
);
cmp('algo: aStar', ctx, (c) =>
  c.eles.aStar({ root: c.root, goal: c.goal, weight }),
);
cmp('algo: bellmanFord', ctx, (c) =>
  c.eles.bellmanFord({ root: c.root, weight }),
);
cmp('algo: kruskal', ctx, (c) => c.eles.kruskal(weight));
cmp('algo: tarjan SCC', ctx, (c) => c.eles.tarjanStronglyConnected());
cmp('algo: hopcroft-tarjan biconnected', ctx, (c) =>
  c.eles.hopcroftTarjanBiconnected(),
);
cmp('algo: hierholzer (directed)', ctx, (c) =>
  c.eles.hierholzer({ root: c.root, directed: true }),
);
cmp('algo: betweennessCentrality (unweighted)', ctx, (c) =>
  c.eles.betweennessCentrality(),
);
cmp('algo: degreeCentralityNormalized', ctx, (c) =>
  c.eles.degreeCentralityNormalized({}),
);
cmp('algo: closenessCentrality (one root)', ctx, (c) =>
  c.eles.closenessCentrality({ root: c.root }),
);

// round 33.2: the unnormalized sibling of the row above it — v3 and v4
// both require a root here, and the normalized form has had a row since
// round 10 while this one had none (the 29.2/30.3 sibling-gap shape,
// arriving in the benchmark suite this time)
cmp('algo: degreeCentrality (one root)', ctx, (c) =>
  c.eles.degreeCentrality({ root: c.root }),
);

if (N <= 1000) {
  cmp('algo: pageRank (20 iters)', ctx, (c) =>
    c.eles.pageRank({ iterations: 20 }),
  );

  // round 33.2: the weighted branch is the one that actually runs the
  // heap; every centrality row before this round passed no weight, so
  // the decrease-key path round 10 A3 deliberately built (v3 re-sorts
  // instead) had never been measured
  cmp('algo: closenessCentrality (weighted, one root)', ctx, (c) =>
    c.eles.closenessCentrality({ root: c.root, weight }),
  );
}

if (N <= 500) {
  cmp('algo: floydWarshall', ctx, (c) => c.eles.floydWarshall({ weight }));
  cmp('algo: closenessCentralityNormalized', ctx, (c) =>
    c.eles.closenessCentralityNormalized({}),
  );
  cmp('algo: markovClustering', ctx, (c) => c.eles.markovClustering({}));
  cmp('algo: hierarchicalClustering (threshold)', ctx, (c) =>
    c.eles.hierarchicalClustering({
      attributes: [(n) => n.data('foo'), (n) => n.data('weight')],
    }),
  );
  cmp('algo: kMeans (fixed centroids)', ctx, (c) =>
    c.eles.kMeans({
      k: 4,
      attributes: [(n) => n.data('foo'), (n) => n.data('weight')],
      testMode: true,
      testCentroids: [
        [0, 0],
        [N / 3, 2],
        [(2 * N) / 3, 4],
        [N, 6],
      ],
    }),
  );

  // -- round 33.2: the four algorithms that had no row at all ---------------
  // The three clustering ones are attribute-space and stay handle-level
  // on *both* sides by design (round 10 A4: they are feature-space, not
  // adjacency walks, so v4 ports v3's shape rather than going
  // slot-native).  Parity is therefore the expected reading here, and a
  // large win would mean the row is wrong — the opposite of how to read
  // the slot-native walks above.  Iteration counts are capped on both
  // sides so the rows measure the algorithm rather than how long each
  // implementation happens to wander.
  cmp('algo: kMedoids', ctx, (c) =>
    c.eles.kMedoids({
      k: 4,
      attributes: attrs,
      maxIterations: 10,
    }),
  );

  cmp('algo: fuzzyCMeans', ctx, (c) =>
    c.eles.fuzzyCMeans({
      k: 4,
      attributes: attrs,
      maxIterations: 10,
    }),
  );

  cmp('algo: affinityPropagation', ctx, (c) =>
    c.eles.affinityPropagation({
      attributes: attrs,
      damping: 0.8,
      preference: 'median',
      maxIterations: 10,
      minIterations: 5,
    }),
  );

  // kargerStein is randomized on both sides (neither takes a seed), so
  // what is stable here is the *cost* — the trial count is a function of
  // n, not of the draw.  Its result is not compared.
  cmp('algo: kargerStein', ctx, (c) => c.eles.kargerStein());

  // the weighted centrality branch (see the closeness row above): at
  // this scale v3 pays its re-sort per relaxation
  cmp('algo: betweennessCentrality (weighted)', ctx, (c) =>
    c.eles.betweennessCentrality({ weight }),
  );
}

await finishRun('algorithms');

process.exit(0);
