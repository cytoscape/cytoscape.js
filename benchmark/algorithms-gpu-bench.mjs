// GPU-vs-CPU executor benchmark for the round-65 async algorithm tier.
//
// Drives the playwright page (built UMD bundle) in Chromium and times the
// same call under `executor: 'cpu'` and `executor: 'gpu'` on deterministic
// generated fixtures, per family per size.  What each row prices is the
// *whole* public call — matrix build, upload, kernels, readback, result
// assembly — because that is what the executor router chooses between, so
// a ratio here is exactly what `'auto'` should be tuned by (GPU_MIN_N).
//
//   npm run benchmark:algorithms-gpu               # the full sweep
//   node --import tsx benchmark/algorithms-gpu-bench.mjs --json out.json
//
// Iteration knobs are pinned where an algorithm's iteration count could
// differ per executor (the round-33.2 rule: measure the algorithm, not how
// long each side wanders): AP runs maxIterations 100 / minIterations 20;
// everything else converges identically by construction (shared f64 build,
// same convergence rule) or runs a fixed count (FW's n steps, pageRank's
// precision loop).
//
// Needs built UMD bundles (npm run build) and an adapter; the run reports
// the adapter identity and REFUSES SwiftShader unless --allow-swiftshader,
// because a software-rasterizer "GPU" number is a lie about the crossover.
// Timing is wall-clock per call (median of REPS after one warmup call that
// pays pipeline compilation — the compile stall is priced separately as
// its own row, since a first call pays it once per page).

import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(DIR, '..');
const PORT = 3396;
const REPS = 5;

const args = process.argv.slice(2);
const allowSwiftshader = args.includes('--allow-swiftshader');
const jsonAt = args.indexOf('--json');
const jsonPath = jsonAt >= 0 ? args[jsonAt + 1] : null;
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
];

const rows = [];
const families = familyFilter
  ? FAMILIES.filter((f) => f.key.includes(familyFilter))
  : FAMILIES;

for (const family of families) {
  for (const n of family.sizes) {
    const row = await page.evaluate(
      async ({ key, kind, opSrc, n, reps }) => {
        // deterministic fixtures: graph = ring + chords, degree ~2.3;
        // feature = pseudo-random points from a seeded LCG
        const els = [];

        if (kind === 'graph') {
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

          samples.sort((x, y) => x - y);

          return samples[Math.floor(samples.length / 2)];
        };

        // warmup both sides once; the gpu warmup also pays pipeline
        // compilation, which is timed as the separate firstGpu figure
        const tFirst = performance.now();

        await op(cy, 'gpu');

        const firstGpu = performance.now() - tFirst;

        await op(cy, 'cpu');

        const cpu = await time('cpu');
        const gpu = await time('gpu');

        cy.destroy?.();

        return { key, n, cpu, gpu, firstGpu };
      },
      { key: family.key, kind: family.kind, opSrc: family.op, n, reps: REPS },
    );

    row.ratio = row.cpu / row.gpu;
    rows.push(row);
    console.log(
      `${row.key.padEnd(24)} n=${String(row.n).padEnd(6)} ` +
        `cpu ${row.cpu.toFixed(1).padStart(9)} ms   ` +
        `gpu ${row.gpu.toFixed(1).padStart(9)} ms   ` +
        `×${row.ratio.toFixed(2).padStart(7)}   ` +
        `(first gpu call ${row.firstGpu.toFixed(1)} ms)`,
    );
  }
}

const out = {
  adapter: adapterLabel,
  when: new Date().toISOString(),
  reps: REPS,
  rows,
};

if (jsonPath) {
  writeFileSync(jsonPath, JSON.stringify(out, null, 2));
} else {
  const dir = join(DIR, 'results');

  mkdirSync(dir, { recursive: true });

  const stamp = out.when.replace(/[:.]/g, '-');

  writeFileSync(
    join(dir, `algorithms-gpu-${stamp}.json`),
    JSON.stringify(out, null, 2),
  );
}

await browser.close();
server.close();
