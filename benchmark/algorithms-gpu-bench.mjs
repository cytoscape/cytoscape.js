// GPU-vs-CPU executor benchmark for the round-65 async algorithm tier.
//
// Drives the playwright page (built UMD bundle) in Chromium and times the
// same call under `executor: 'cpu'` and `executor: 'gpu'` on deterministic
// generated fixtures, per family per size.  What each row prices is the
// *whole* public call — matrix build, upload, kernels, readback, result
// assembly — because that is what the executor router chooses between, so
// a ratio here is exactly what `'auto'` should be tuned by (GPU_MIN_N).
//
//   npm run benchmark:algorithms-gpu                     # the full sweep
//   npm run benchmark:algorithms-gpu -- --family markov  # one family
//
// Results write to `benchmark/results/` in the standard results shape —
// `results-alggpu-<stamp>.json` plus `report.html` — under the
// **`algorithms-gpu` profile**, exactly as `render-bench.mjs` does for the
// renderer: `npm run benchmark:publish` then promotes a run onto the
// status site, where it renders through the same report and joins the
// per-(machine, profile) cross-commit comparison once a second run
// exists.  Benches are named `cpu` / `gpu` (the report's cpu-baseline
// pair form — both sides are v4) plus `gpu first call`, which carries
// the once-per-page pipeline-compile stall the steady-state rows
// deliberately exclude.
//
// Iteration knobs are pinned where an algorithm's iteration count could
// differ per executor (the round-33.2 rule: measure the algorithm, not how
// long each side wanders): AP runs maxIterations 100 / minIterations 20;
// everything else converges identically by construction (shared f64 build,
// same convergence rule) or runs a fixed count (FW's n panels, pageRank's
// precision loop).
//
// Needs built UMD bundles (npm run build) and an adapter; the run reports
// the adapter identity and REFUSES SwiftShader unless --allow-swiftshader,
// because a software-rasterizer "GPU" number is a lie about the crossover.

import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { toStats, oneShotStats } from './render-stats.mjs';
import { renderReport } from './report-html.mjs';
import { buildMeta } from './run-meta.mjs';
import { stampHarness } from './harness-id.mjs';
import { describeMachine } from '../scripts/machine-info.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(DIR, '..');
const RESULTS_DIR = join(DIR, 'results');
const PORT = 3396;
const REPS = 5;

const args = process.argv.slice(2);
const allowSwiftshader = args.includes('--allow-swiftshader');
const familyAt = args.indexOf('--family');
const familyFilter = familyAt >= 0 ? args[familyAt + 1] : null;

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
};

const server = createServer((req, res) => {
  const path = join(ROOT, req.url.split('?')[0]);

  if (!existsSync(path)) {
    res.writeHead(404).end();

    return;
  }

  res.writeHead(200, {
    'content-type': MIME[extname(path)] ?? 'application/octet-stream',
  });
  res.end(readFileSync(path));
});

await new Promise((ok) => server.listen(PORT, ok));

const startedAt = Date.now();
const browser = await chromium.launch({
  channel: 'chromium',
  args: [
    '--enable-unsafe-webgpu',
    '--enable-unsafe-swiftshader',
    '--use-gl=angle',
    '--use-angle=vulkan',
    '--enable-features=Vulkan',
  ],
});
const browserVersion = browser.version();
const page = await browser.newPage();

page.on('pageerror', (err) => console.error('[pageerror]', err.message));
await page.goto(`http://127.0.0.1:${PORT}/playwright-page/index.html`);

const adapter = await page.evaluate(async () => {
  const a = await navigator.gpu?.requestAdapter();

  if (a == null) {
    return null;
  }

  return {
    vendor: a.info?.vendor ?? '',
    architecture: a.info?.architecture ?? '',
    description: a.info?.description ?? '',
  };
});

if (adapter == null) {
  console.error('no WebGPU adapter — nothing to measure');
  process.exit(1);
}

const adapterLabel =
  `${adapter.vendor} ${adapter.architecture} ${adapter.description}`.trim();

console.log(`adapter: ${adapterLabel}`);

if (/swiftshader|software/i.test(adapterLabel) && !allowSwiftshader) {
  console.error(
    'refusing to benchmark on SwiftShader (pass --allow-swiftshader to force)',
  );
  process.exit(1);
}

/* Each family: build a deterministic fixture of `n` nodes in-page, then
 * one call per timing.  op() must return something the harness can
 * cheaply consume so the call cannot be dead-code-eliminated. */
const FAMILIES = [
  {
    key: 'markovClustering',
    sizes: [256, 512, 1024],
    kind: 'graph',
    op: `(cy, executor) =>
      cy.elements().markovClustering({ executor }).then((cs) => cs.length)`,
  },
  {
    key: 'pageRank',
    sizes: [512, 1024, 2048],
    kind: 'graph',
    op: `(cy, executor) =>
      cy.elements().pageRank({ executor })
        .then((r) => r.rank(cy.nodes()[0]))`,
  },
  // 65.10: the sparse CPU iteration owns sparse graphs outright, so the
  // GPU's dense mat-vec is priced where it can compete — E = n²/12,
  // above the wrapper's density gate
  {
    key: 'pageRankDense',
    sizes: [512, 1024, 2048],
    kind: 'graph-dense',
    op: `(cy, executor) =>
      cy.elements().pageRank({ executor })
        .then((r) => r.rank(cy.nodes()[0]))`,
  },
  {
    key: 'floydWarshall',
    sizes: [256, 512, 1024],
    kind: 'graph',
    op: `(cy, executor) =>
      cy.elements().floydWarshall({ executor })
        .then((r) => r.distance(cy.nodes()[0], cy.nodes()[1]))`,
  },
  {
    key: 'betweennessCentrality',
    sizes: [512, 1024, 2048],
    kind: 'graph',
    op: `(cy, executor) =>
      cy.elements().betweennessCentrality({ executor })
        .then((r) => r.betweenness(cy.nodes()[0]))`,
  },
  {
    key: 'affinityPropagation',
    sizes: [256, 512, 1024],
    kind: 'feature',
    op: `(cy, executor) =>
      cy.elements().affinityPropagation({
        executor,
        damping: 0.8,
        preference: 'median',
        maxIterations: 100,
        minIterations: 20,
        attributes: [(n) => n.data('a'), (n) => n.data('b')],
      }).then((cs) => cs.length)`,
  },
  {
    key: 'kMeans',
    sizes: [4096, 16384, 65536],
    kind: 'feature',
    op: `(cy, executor) =>
      cy.elements().kMeans({
        executor,
        k: 8,
        maxIterations: 10,
        attributes: [(n) => n.data('a'), (n) => n.data('b')],
        testMode: true,
        testCentroids: Array.from({ length: 8 }, (_, c) => [c * 5, c % 3]),
      }).then((cs) => cs.length)`,
  },
  {
    key: 'fuzzyCMeans',
    sizes: [4096, 16384, 65536],
    kind: 'feature',
    op: `(cy, executor) =>
      cy.elements().fuzzyCMeans({
        executor,
        k: 8,
        maxIterations: 10,
        attributes: [(n) => n.data('a'), (n) => n.data('b')],
      }).then((r) => r.clusters.length)`,
  },
  {
    key: 'kMedoids',
    sizes: [1024, 2048, 4096],
    kind: 'feature',
    op: `(cy, executor) =>
      cy.elements().kMedoids({
        executor,
        k: 8,
        maxIterations: 10,
        attributes: [(n) => n.data('a'), (n) => n.data('b')],
      }).then((cs) => cs.length)`,
  },
  {
    key: 'hierarchicalClustering',
    sizes: [1024, 2048, 4096],
    kind: 'feature',
    op: `(cy, executor) =>
      cy.elements().hierarchicalClustering({
        executor,
        attributes: [(n) => n.data('a'), (n) => n.data('b')],
        threshold: 0.75,
      }).then((cs) => cs.length)`,
  },
  // round 69: closeness rides the blocked FW relaxation with an on-device
  // row fold, so its readback is n floats where floydWarshall's is 2n² —
  // the same sizes as FW price the difference
  {
    key: 'closenessCentralityNormalized',
    sizes: [256, 512, 1024],
    kind: 'graph',
    op: `(cy, executor) =>
      cy.elements().closenessCentralityNormalized({ executor })
        .then((r) => r.closeness(cy.nodes()[0]))`,
  },
  // round 69: the A²∘A families are priced on the dense fixture because
  // that is where their 'auto' gate routes to the GPU at all — the CPU's
  // O(Σ deg²) walk owns sparse graphs outright, which is the gate's point
  {
    key: 'triangleCount',
    sizes: [512, 1024, 2048],
    kind: 'graph-dense',
    op: `(cy, executor) =>
      cy.elements().triangleCount({ executor })
        .then((r) => r.totalTriangles)`,
  },
  {
    key: 'neighborhoodSimilarity',
    sizes: [512, 1024, 2048],
    kind: 'graph-dense',
    op: `(cy, executor) =>
      cy.elements().neighborhoodSimilarity({ executor })
        .then((r) => r.similarity(cy.nodes()[0], cy.nodes()[1]))`,
  },
  // round 69: priced on the sparse fixture to document why 'auto' never
  // routes Katz to the GPU — the pageRank verdict (65.10) for the same
  // iteration shape; the gpu bench is the explicit-'gpu' price
  {
    key: 'katzCentrality',
    sizes: [512, 1024, 2048],
    kind: 'graph',
    op: `(cy, executor) =>
      cy.elements().katzCentrality({ executor })
        .then((r) => r.katz(cy.nodes()[0]))`,
  },
  // round 70: effective resistance is O(n³) on BOTH executors (a dense
  // inverse has no sparse shortcut), so like MCL it is priced on the
  // plain fixture and wins at every density
  {
    key: 'effectiveResistance',
    sizes: [256, 512, 1024],
    kind: 'graph',
    op: `(cy, executor) =>
      cy.elements().effectiveResistance({ executor })
        .then((r) => r.resistance(cy.nodes()[0], cy.nodes()[1]))`,
  },
  // round 70: the iterated-product families, priced dense (their 'auto'
  // gates route to the GPU only there — sparse CPU walks own the rest).
  // Iteration knobs are pinned (the round-33.2 rule), and sizes stop at
  // 1024 because the dense CPU references are MCL-cost there already —
  // simRank pays 2·n·m per iteration and rwrProximity one sparse solve
  // per column; heatKernel's time is small so its scaling exponent (and
  // with it the CPU's 2^s operator applications) stays bounded
  {
    key: 'simRank',
    sizes: [256, 512, 1024],
    kind: 'graph-dense',
    op: `(cy, executor) =>
      cy.elements().simRank({ executor, maxIterations: 10 })
        .then((r) => r.similarity(cy.nodes()[0], cy.nodes()[1]))`,
  },
  {
    key: 'rwrProximity',
    sizes: [256, 512, 1024],
    kind: 'graph-dense',
    op: `(cy, executor) =>
      cy.elements().randomWalkWithRestartProximity({
        executor,
        restartProbability: 0.3,
        tolerance: 0.00001,
      }).then((r) => r.proximity(cy.nodes()[0], cy.nodes()[1]))`,
  },
  {
    key: 'heatKernel',
    sizes: [256, 512, 1024],
    kind: 'graph-dense',
    op: `(cy, executor) =>
      cy.elements().heatKernel({ executor, time: 0.02 })
        .then((r) => r.heat(cy.nodes()[0], cy.nodes()[1]))`,
  },
  {
    key: 'motifCensus',
    sizes: [512, 1024, 2048],
    kind: 'graph-dense',
    op: `(cy, executor) =>
      cy.elements().motifCensus({ executor })
        .then((r) => r.counts['030T'])`,
  },
];

const jobs = [];
const failures = [];
const families = familyFilter
  ? FAMILIES.filter((f) => f.key.includes(familyFilter))
  : FAMILIES;

for (const family of families) {
  for (const n of family.sizes) {
    const t0 = Date.now();
    let row;

    try {
      row = await runCell(family, n);
    } catch (err) {
      console.error(`  ${family.key} n=${n} FAILED: ${err.message}`);
      failures.push({ job: `${family.key} n=${n}`, exitCode: 1 });
      continue;
    }

    // the standard results shape: one job per (family, size), so the
    // report merges same-n families into one section and its scaling
    // table reads families × sizes
    jobs.push({
      suite: 'algorithms-gpu',
      n,
      op: null,
      durationMs: Date.now() - t0,
      context: { arch: null, runtime: 'chromium', cpu: null },
      groups: [
        {
          name: family.key,
          benches: [
            { name: 'cpu', stats: toStats(row.cpuSamples) },
            { name: 'gpu', stats: toStats(row.gpuSamples) },
            { name: 'gpu first call', stats: oneShotStats(row.firstGpu) },
          ],
        },
      ],
    });

    const cpu = median(row.cpuSamples);
    const gpu = median(row.gpuSamples);

    console.log(
      `${family.key.padEnd(24)} n=${String(n).padEnd(6)} ` +
        `cpu ${cpu.toFixed(1).padStart(9)} ms   ` +
        `gpu ${gpu.toFixed(1).padStart(9)} ms   ` +
        `×${(cpu / gpu).toFixed(2).padStart(7)}   ` +
        `(first gpu call ${row.firstGpu.toFixed(1)} ms)`,
    );
  }
}

function median(samples) {
  const s = [...samples].sort((a, b) => a - b);

  return s[Math.floor(s.length / 2)];
}

/** Time one (family, size) cell in-page: warmups, then REPS samples of
 * each executor.  Returns raw sample arrays so the report gets real
 * percentiles rather than a pre-collapsed median. */
async function runCell(family, n) {
  return await page.evaluate(
    async ({ key, kind, opSrc, n, reps }) => {
      // deterministic fixtures: graph = ring + chords, degree ~2.3;
      // feature = pseudo-random points from a seeded LCG
      const els = [];

      if (kind === 'graph' || kind === 'graph-dense') {
        for (let i = 0; i < n; i++) {
          els.push({ data: { id: 'n' + i } });
        }

        for (let i = 0; i < n; i++) {
          els.push({
            data: { source: 'n' + i, target: 'n' + ((i + 1) % n) },
          });

          if (i % 7 === 0) {
            els.push({
              data: { source: 'n' + i, target: 'n' + ((i * 13 + 29) % n) },
            });
          }
        }

        if (kind === 'graph-dense') {
          // ~n²/12 extra edges: dense enough for the pageRank gate
          const fanout = Math.max(1, (n / 12) | 0);

          for (let i = 0; i < n; i++) {
            for (let k = 2; k < 2 + fanout; k++) {
              els.push({
                data: { source: 'n' + i, target: 'n' + ((i + k) % n) },
              });
            }
          }
        }
      } else {
        let seed = 42;
        const rand = () => {
          seed = (seed * 1103515245 + 12345) & 0x7fffffff;

          return seed / 0x7fffffff;
        };

        for (let i = 0; i < n; i++) {
          els.push({
            data: { id: 'n' + i, a: rand() * 40, b: rand() * 10 },
          });
        }
      }

      const cy = cytoscape({ elements: els });
      const op = new Function('return ' + opSrc)();
      const time = async (executor) => {
        const samples = [];

        for (let r = 0; r < reps; r++) {
          const t0 = performance.now();

          await op(cy, executor);
          samples.push(performance.now() - t0);
        }

        return samples;
      };

      // warmup both sides once; the gpu warmup also pays pipeline
      // compilation, which is timed as the separate first-call figure
      const tFirst = performance.now();

      await op(cy, 'gpu');

      const firstGpu = performance.now() - tFirst;

      await op(cy, 'cpu');

      const cpuSamples = await time('cpu');
      const gpuSamples = await time('gpu');

      cy.destroy?.();

      return { key, n, cpuSamples, gpuSamples, firstGpu };
    },
    { key: family.key, kind: family.kind, opSrc: family.op, n, reps: REPS },
  );
}

// -- output: the standard results file + report, render-bench's shape ---------
mkdirSync(RESULTS_DIR, { recursive: true });

// the harness that produced these rows (round 65.12)
stampHarness(jobs, 'algorithms-gpu-bench.mjs');

const results = {
  meta: buildMeta({
    startedAt,
    profile: 'algorithms-gpu',
    suiteFilter: familyFilter,
    failures,
    context: { ...jobs[0]?.context, runtime: 'chromium' },
    adapter,
    // the browser is part of the measurement, as for the renderer bench
    machine: {
      ...describeMachine(),
      browser: { name: 'chromium', version: browserVersion },
    },
  }),
  jobs,
};

const stamp = results.meta.date.replace(/[:.]/g, '-');
const resultsPath = join(RESULTS_DIR, `results-alggpu-${stamp}.json`);

writeFileSync(resultsPath, JSON.stringify(results, null, 2));
writeFileSync(join(RESULTS_DIR, 'report.html'), renderReport(results));
console.log(`\nreport:  ${join(RESULTS_DIR, 'report.html')}`);
console.log(`results: ${resultsPath}`);
console.log(`total: ${(results.meta.totalMs / 60000).toFixed(1)} min`);

await browser.close();
server.close();

if (failures.length > 0) {
  console.error(
    `${failures.length} cell(s) failed: ${failures.map((f) => f.job).join('; ')}`,
  );
  process.exit(jobs.length === 0 ? 1 : 0);
}
