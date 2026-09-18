// CPU-vs-workers executor benchmark for the round-74 worker pool.
//
// Prices the per-source-parallel families — both betweenness forms, the
// unweighted closeness BFS, heatKernel and RWR proximity — under
// `executor: 'cpu'` against `executor: 'workers'` on deterministic
// generated fixtures, per family per size, **through the built ESM
// bundle** (`build/cytoscape.esm.mjs`): the CPU references build
// closures per call, which is the shape tsx's `__name` wrapper distorts
// (the round-34 lesson), so a number from `src/` would flatter the pool.
// What each row prices is the whole public call — snapshot, clone,
// jobs, merge, result assembly — because that is what `'auto'` chooses
// between, so a ratio here is what `WORKERS_MIN_N` is tuned by.
//
//   npm run benchmark:algorithms-workers                        # the sweep
//   npm run benchmark:algorithms-workers -- --family betweenness
//   npm run benchmark:algorithms-workers -- --repeat 3          # publish
//   npm run benchmark:algorithms-workers -- --sizes 64,128,256  # crossover
//
// Benches per (family, size): `cpu` / `workers` (pool warm, REPS samples
// each) and `workers first call` (a fresh pool: spawn + snapshot + first
// run — the amortization the 74.1 gate named).  **Every row asserts it
// ran where its name says** through the bundle's `__algoWorkersStats__`
// hook: a `workers` sample that did not add a pool run, or a `cpu`
// sample that did, fails the cell — the round-33 rule that a row is
// guilty until it discriminates.  The pool is the environment's own size
// (one less than the cores, at most eight), reported per row.
//
// The suite saturates every core by design, so it is a standalone
// profile like `algorithms-gpu` — never a job in `report.mjs`'s table,
// where `--jobs` would pack it beside other work and measure contention.
// Results write to `benchmark/results/` in the standard results shape
// (`results-algworkers-<stamp>.json` + `report.html`) under the
// **`algorithms-workers` profile**; `npm run benchmark:publish` promotes
// a run onto the status site.  `--repeat N` merges N passes per cell
// with `mergeRepeats`, as the GPU sweep does; publish with `--repeat 3`.
//
// The offload tier (round 129.4) prices the families the pool cannot
// partition — pageRank, Katz, Floyd–Warshall, triangles, neighborhood
// similarity, the motif census, SimRank, effective resistance, MCL and
// affinity propagation — under `'cpu'` against `'workers'`, which runs
// their kernel on ONE worker (the offload lane).  Its rows are `cpu` /
// `offload` / `offload first call` and, beside them, **`main thread held
// (cpu)` / `main thread held (offload)`**: the wall time over which a 1 ms
// interval on the calling thread did not tick (calibrated idle first), so
// an in-thread run reads its whole length held and an offloaded run reads
// near zero — the value the lane buys, measured rather than inferred, and
// each row asserts its property (a held row over half the wall for the
// cpu executor, under half for the offload; an `offload` sample that did
// not add an offload fails the cell).  `--tier pool|offload|all` picks
// the tier (default all); the offload crossovers (`offloadMinN`, one per
// family) are stamped from `--tier offload --sizes …` at the small end.
//
// Needs the built bundles (`npm run build`).

import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { toStats, oneShotStats } from './render-stats.mjs';
import { renderReport } from './report-html.mjs';
import { buildMeta } from './run-meta.mjs';
import { stampHarness } from './harness-id.mjs';
import { mergeRepeats } from './repeat-merge.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(DIR, '..');
const RESULTS_DIR = join(DIR, 'results');
const BUNDLE = join(ROOT, 'build', 'cytoscape.esm.mjs');
const REPS = 5;

const args = process.argv.slice(2);
const familyAt = args.indexOf('--family');
const familyFilter = familyAt >= 0 ? args[familyAt + 1] : null;
const repeatAt = args.indexOf('--repeat');
const repeat = Math.max(1, Number(repeatAt >= 0 ? args[repeatAt + 1] : 1) || 1);
// `--sizes 64,128,256,512` overrides every family's sizes: the crossover
// sweep that stamps WORKERS_MIN_N runs the same instrument at the small
// end, where the published rows deliberately do not sit
const sizesAt = args.indexOf('--sizes');
const sizesOverride =
  sizesAt >= 0
    ? args[sizesAt + 1]
        .split(',')
        .map((v) => Number(v))
        .filter((v) => v > 0)
    : null;

const tierAt = args.indexOf('--tier');
const tier = tierAt >= 0 ? args[tierAt + 1] : 'all';

if (!['pool', 'offload', 'all'].includes(tier)) {
  console.error(`--tier must be pool, offload or all — got ${tier}`);
  process.exit(1);
}

if (!existsSync(BUNDLE)) {
  console.error(`missing ${BUNDLE} — run \`npm run build\` first`);
  process.exit(1);
}

const cytoscape = (await import(pathToFileURL(BUNDLE).href)).default;
const stats = cytoscape.__algoWorkersStats__;
const resetPool = cytoscape.__resetAlgoWorkers__;

if (typeof stats !== 'function' || typeof resetPool !== 'function') {
  console.error('the bundle carries no pool hooks — rebuild it');
  process.exit(1);
}

/* The fixture every family shares: a ring plus one chord every third
 * node (mean degree ~2.7 — the sparse shape the per-source walks own),
 * with a data-driven weight for the weighted rows. */
function fixture(n, dense = false) {
  const els = [];

  for (let i = 0; i < n; i++) {
    els.push({ data: { id: 'n' + i } });
  }

  for (let i = 0; i < n; i++) {
    els.push({
      data: {
        source: 'n' + i,
        target: 'n' + ((i + 1) % n),
        w: 1 + ((i * 31) % 7),
      },
    });

    if (i % 3 === 0) {
      els.push({
        data: {
          source: 'n' + i,
          target: 'n' + ((i * 13 + 29) % n),
          w: 1 + ((i * 17) % 5),
        },
      });
    }
  }

  if (dense) {
    // ~n²/12 extra edges — the GPU sweep's `graph-dense` shape, so the
    // dense closeness row here and there price the same graph
    const fanout = Math.max(1, (n / 12) | 0);

    for (let i = 0; i < n; i++) {
      for (let k = 2; k < 2 + fanout; k++) {
        els.push({
          data: { source: 'n' + i, target: 'n' + ((i + k) % n) },
        });
      }
    }
  }

  return els;
}

const weight = (e) => e.data('w');

/* Each family: one call per timing; op() returns something the harness
 * consumes so the call cannot be dead-code-eliminated. */
const FAMILIES = [
  {
    key: 'betweennessCentrality (weighted)',
    sizes: [512, 1024, 2048],
    op: (cy, executor) =>
      cy
        .elements()
        .betweennessCentrality({ weight, executor })
        .then((r) => r.betweenness(cy.nodes()[0])),
  },
  {
    key: 'betweennessCentrality',
    sizes: [512, 1024, 2048],
    op: (cy, executor) =>
      cy
        .elements()
        .betweennessCentrality({ executor })
        .then((r) => r.betweenness(cy.nodes()[0])),
  },
  {
    key: 'closenessCentralityNormalized',
    sizes: [1024, 2048, 4096],
    op: (cy, executor) =>
      cy
        .elements()
        .closenessCentralityNormalized({ executor })
        .then((r) => r.closeness(cy.nodes()[0])),
  },
  // the dense route (E ≈ n²/12): where the GPU relaxes Floyd–Warshall
  // instead of walking the BFS, and where a per-source BFS is O(n·E) —
  // priced so the three-way 'auto' ordering on dense graphs is measured
  // rather than inferred from the sparse row
  {
    key: 'closenessCentralityNormalizedDense',
    sizes: [256, 512, 1024],
    dense: true,
    op: (cy, executor) =>
      cy
        .elements()
        .closenessCentralityNormalized({ executor })
        .then((r) => r.closeness(cy.nodes()[0])),
  },
  {
    key: 'heatKernel',
    sizes: [256, 512, 1024],
    op: (cy, executor) =>
      cy
        .elements()
        .heatKernel({ executor })
        .then((r) => r.heat(cy.nodes()[0], cy.nodes()[1])),
  },
  {
    key: 'randomWalkWithRestartProximity',
    sizes: [256, 512, 1024],
    op: (cy, executor) =>
      cy
        .elements()
        .randomWalkWithRestartProximity({ executor })
        .then((r) => r.proximity(cy.nodes()[0], cy.nodes()[1])),
  },
];

const families =
  tier === 'offload'
    ? []
    : familyFilter != null
      ? FAMILIES.filter((f) => f.key.includes(familyFilter))
      : FAMILIES;

/* The offload tier's families (129.4): the same fixture; the sizes sit
 * where the in-thread run is milliseconds to seconds, which is where a
 * free calling thread is worth a clone. */
const OFFLOAD_FAMILIES = [
  {
    key: 'pageRank',
    sizes: [2048, 4096, 8192, 16384],
    op: (cy, executor) =>
      cy
        .elements()
        .pageRank({ weight, executor })
        .then((r) => r.rank(cy.nodes()[0])),
  },
  {
    key: 'katzCentrality',
    sizes: [2048, 4096, 8192, 16384],
    op: (cy, executor) =>
      cy
        .elements()
        .katzCentrality({ weight, alpha: 0.05, executor })
        .then((r) => r.katz(cy.nodes()[0])),
  },
  {
    key: 'floydWarshall',
    sizes: [128, 256, 512],
    op: (cy, executor) =>
      cy
        .elements()
        .floydWarshall({ weight, executor })
        .then((r) => r.distance(cy.nodes()[0], cy.nodes()[1])),
  },
  {
    key: 'triangleCount',
    sizes: [2048, 4096, 8192],
    op: (cy, executor) =>
      cy
        .elements()
        .triangleCount({ executor })
        .then((r) => r.transitivity),
  },
  {
    key: 'neighborhoodSimilarity',
    sizes: [512, 1024, 2048],
    op: (cy, executor) =>
      cy
        .elements()
        .neighborhoodSimilarity({ executor })
        .then((r) => r.similarity(cy.nodes()[0], cy.nodes()[1])),
  },
  {
    key: 'motifCensus',
    sizes: [2048, 4096, 8192],
    op: (cy, executor) =>
      cy
        .elements()
        .motifCensus({ executor })
        .then((r) => r.counts['030T']),
  },
  {
    key: 'simRank',
    sizes: [128, 256, 512],
    op: (cy, executor) =>
      cy
        .elements()
        .simRank({ executor })
        .then((r) => r.similarity(cy.nodes()[0], cy.nodes()[1])),
  },
  {
    key: 'effectiveResistance',
    sizes: [128, 256, 512],
    op: (cy, executor) =>
      cy
        .elements()
        .effectiveResistance({ weight, executor })
        .then((r) => r.resistance(cy.nodes()[0], cy.nodes()[1])),
  },
  {
    key: 'markovClustering',
    sizes: [64, 128, 256],
    op: (cy, executor) =>
      cy
        .elements()
        .markovClustering({ executor })
        .then((clusters) => clusters.length),
  },
  {
    key: 'affinityPropagation',
    sizes: [64, 128, 256],
    op: (cy, executor) =>
      cy
        .nodes()
        .affinityPropagation({
          damping: 0.8,
          preference: 'median',
          attributes: [(n) => n.data('w') ?? 1],
          executor,
        })
        .then((clusters) => clusters.length),
  },
];

const offloadFamilies =
  tier === 'pool'
    ? []
    : familyFilter != null
      ? OFFLOAD_FAMILIES.filter((f) => f.key.includes(familyFilter))
      : OFFLOAD_FAMILIES;

/** The calling thread's availability over a run: a 1 ms interval's
 * ticks, against the rate it ticks at when idle (calibrated once), so
 * `held` is the wall time the thread could not tick — a synchronous
 * run reads its whole length, an offloaded run near zero. */
let idleTickMs = null;

async function calibrateTicks() {
  let ticks = 0;
  const iv = setInterval(() => ticks++, 1);
  const t0 = performance.now();

  await new Promise((r) => setTimeout(r, 300));
  clearInterval(iv);
  idleTickMs = (performance.now() - t0) / Math.max(1, ticks);
}

async function timedHeld(run) {
  let ticks = 0;
  const iv = setInterval(() => ticks++, 1);
  const t0 = performance.now();

  await run();

  const wall = performance.now() - t0;

  clearInterval(iv);

  return { wall, held: Math.max(0, wall - ticks * idleTickMs) };
}

const startedAt = Date.now();
const jobs = [];
const failures = [];
let poolSize = 0;

/** Time one (family, size) cell: a fresh pool's first call, then REPS
 * samples of each executor, each asserting where it ran. */
async function runCell(family, n) {
  const cy = cytoscape({
    headless: true,
    elements: fixture(n, family.dense === true),
  });

  try {
    // the cold figure: spawn + snapshot + first run on a fresh pool
    resetPool();

    const runsBefore = stats().runs;
    const tFirst = performance.now();

    await family.op(cy, 'workers');

    const firstWorkers = performance.now() - tFirst;

    if (stats().runs !== runsBefore + 1) {
      throw new Error('the workers first call did not run on the pool');
    }

    poolSize = stats().workers;

    // warm both sides once more, then sample
    await family.op(cy, 'cpu');
    await family.op(cy, 'workers');

    const sample = async (executor) => {
      const samples = [];

      for (let r = 0; r < REPS; r++) {
        const before = stats().runs;
        const t0 = performance.now();

        await family.op(cy, executor);
        samples.push(performance.now() - t0);

        const ran = stats().runs - before;

        if (executor === 'workers' && ran !== 1) {
          throw new Error(`a workers sample ran ${ran} pool runs, not 1`);
        }

        if (executor === 'cpu' && ran !== 0) {
          throw new Error(`a cpu sample touched the pool (${ran} runs)`);
        }
      }

      return samples;
    };

    const cpuSamples = await sample('cpu');
    const workersSamples = await sample('workers');

    return { cpuSamples, workersSamples, firstWorkers };
  } finally {
    cy.destroy();
  }
}

/** Time one offload cell (129.4): a fresh worker's first call, then
 * REPS samples of each executor with the thread's held time beside
 * each, every sample asserting where it ran. */
async function runOffloadCell(family, n) {
  const cy = cytoscape({ headless: true, elements: fixture(n) });

  try {
    resetPool();

    const offloadsBefore = stats().offloads;
    const tFirst = performance.now();

    await family.op(cy, 'workers');

    const firstOffload = performance.now() - tFirst;

    if (stats().offloads !== offloadsBefore + 1) {
      throw new Error('the offload first call did not run on a worker');
    }

    await family.op(cy, 'cpu');
    await family.op(cy, 'workers');

    const sample = async (executor) => {
      const walls = [];
      const helds = [];

      for (let r = 0; r < REPS; r++) {
        const before = stats().offloads;
        const runs = stats().runs;
        const { wall, held } = await timedHeld(() => family.op(cy, executor));

        walls.push(wall);
        helds.push(held);

        const ran = stats().offloads - before;

        if (executor === 'workers' && ran !== 1) {
          throw new Error(`an offload sample ran ${ran} offloads, not 1`);
        }

        if (executor === 'cpu' && (ran !== 0 || stats().runs !== runs)) {
          throw new Error('a cpu sample touched the pool');
        }
      }

      return { walls, helds };
    };

    const cpu = await sample('cpu');
    const offload = await sample('workers');
    const median = (xs) => [...xs].sort((a, b) => a - b)[xs.length >> 1];
    const cpuWall = median(cpu.walls);

    // the rows assert their property: a synchronous run holds the
    // thread for most of its wall, an offloaded one for little of it
    // (judged where the run is long enough for a 1 ms tick to see)
    if (cpuWall >= 8 && median(cpu.helds) < cpuWall * 0.5) {
      throw new Error(
        `the cpu row read the thread free (${median(cpu.helds).toFixed(1)} of ${cpuWall.toFixed(1)} ms held)`,
      );
    }

    if (cpuWall >= 8 && median(offload.helds) > median(offload.walls) * 0.5) {
      throw new Error(
        `the offload row read the thread held (${median(offload.helds).toFixed(1)} of ${median(offload.walls).toFixed(1)} ms)`,
      );
    }

    return { cpu, offload, firstOffload, workers: stats().workers };
  } finally {
    cy.destroy();
  }
}

if (offloadFamilies.length > 0) {
  await calibrateTicks();
}

for (const family of offloadFamilies) {
  for (const n of sizesOverride ?? family.sizes) {
    const t0 = Date.now();
    const passes = [];

    for (let pass = 0; pass < repeat; pass++) {
      let row;

      try {
        row = await runOffloadCell(family, n);
      } catch (err) {
        console.error(`  ${family.key} n=${n} FAILED: ${err.message}`);
        failures.push({ job: `${family.key} n=${n}`, exitCode: 1 });
        continue;
      }

      passes.push({
        suite: 'algorithms-workers',
        n,
        op: null,
        durationMs: 0,
        context: { arch: process.arch, runtime: 'node', cpu: null },
        groups: [
          {
            name: `${family.key} (offload)`,
            benches: [
              { name: 'cpu', stats: toStats(row.cpu.walls) },
              { name: 'offload', stats: toStats(row.offload.walls) },
              {
                name: 'offload first call',
                stats: oneShotStats(row.firstOffload),
              },
              {
                name: 'main thread held (cpu)',
                stats: toStats(row.cpu.helds),
              },
              {
                name: 'main thread held (offload)',
                stats: toStats(row.offload.helds),
              },
            ],
          },
        ],
      });
    }

    const merged = mergeRepeats(passes);

    if (merged == null) {
      continue;
    }

    merged.durationMs = Date.now() - t0;
    jobs.push(merged);

    const b = merged.groups[0].benches;
    const ms = (i) => b[i].stats.p50 / 1e6;
    const spread =
      repeat > 1 ? `  spread ×${b[1].stats.repeatSpread.toFixed(2)}` : '';

    console.log(
      `${family.key.padEnd(36)} n=${String(n).padEnd(6)} ` +
        `cpu ${ms(0).toFixed(1).padStart(9)} ms   ` +
        `offload ${ms(1).toFixed(1).padStart(9)} ms   ` +
        `held ${ms(3).toFixed(1).padStart(8)} → ${ms(4).toFixed(1).padStart(6)} ms   ` +
        `(first call ${ms(2).toFixed(1)} ms)${spread}`,
    );
  }
}

for (const family of families) {
  for (const n of sizesOverride ?? family.sizes) {
    const t0 = Date.now();
    const passes = [];

    for (let pass = 0; pass < repeat; pass++) {
      let row;

      try {
        row = await runCell(family, n);
      } catch (err) {
        console.error(`  ${family.key} n=${n} FAILED: ${err.message}`);
        failures.push({ job: `${family.key} n=${n}`, exitCode: 1 });
        continue;
      }

      passes.push({
        suite: 'algorithms-workers',
        n,
        op: null,
        durationMs: 0,
        context: { arch: process.arch, runtime: 'node', cpu: null },
        groups: [
          {
            name: family.key,
            benches: [
              { name: 'cpu', stats: toStats(row.cpuSamples) },
              { name: 'workers', stats: toStats(row.workersSamples) },
              {
                name: 'workers first call',
                stats: oneShotStats(row.firstWorkers),
              },
            ],
          },
        ],
      });
    }

    const merged = mergeRepeats(passes);

    if (merged == null) {
      continue;
    }

    merged.durationMs = Date.now() - t0;
    jobs.push(merged);

    const benches = merged.groups[0].benches;
    const cpu = benches[0].stats.p50 / 1e6;
    const workers = benches[1].stats.p50 / 1e6;
    const first = benches[2].stats.p50 / 1e6;
    const spread =
      repeat > 1 ? `  spread ×${benches[1].stats.repeatSpread.toFixed(2)}` : '';

    console.log(
      `${family.key.padEnd(36)} n=${String(n).padEnd(6)} ` +
        `cpu ${cpu.toFixed(1).padStart(9)} ms   ` +
        `workers ${workers.toFixed(1).padStart(9)} ms   ` +
        `×${(cpu / workers).toFixed(2).padStart(7)}   ` +
        `(first call ${first.toFixed(1)} ms, ${poolSize} workers)${spread}`,
    );
  }
}

resetPool();

// -- output: the standard results file + report, the GPU sweep's shape ------
mkdirSync(RESULTS_DIR, { recursive: true });
stampHarness(jobs, 'algorithms-workers.mjs');

const results = {
  meta: buildMeta({
    startedAt,
    profile: 'algorithms-workers',
    suiteFilter: familyFilter,
    repeat,
    failures,
    context: { arch: process.arch, runtime: 'node', cpu: null },
  }),
  jobs,
};

const stamp = results.meta.date.replace(/[:.]/g, '-');
const resultsPath = join(RESULTS_DIR, `results-algworkers-${stamp}.json`);

writeFileSync(resultsPath, JSON.stringify(results, null, 2));
writeFileSync(join(RESULTS_DIR, 'report.html'), renderReport(results));
console.log(`\npool: ${poolSize} workers`);
console.log(`report:  ${join(RESULTS_DIR, 'report.html')}`);
console.log(`results: ${resultsPath}`);
console.log(`total: ${(results.meta.totalMs / 60000).toFixed(1)} min`);

if (failures.length > 0) {
  console.error(
    `${failures.length} cell(s) failed: ${failures.map((f) => f.job).join('; ')}`,
  );
  process.exit(jobs.length === 0 ? 1 : 0);
}
