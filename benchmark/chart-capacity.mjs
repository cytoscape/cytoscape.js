// Chart capacity measurement (round 80.1). It compares the shipped
// cumulative-stop binary search with a shader variant that uses the same
// record and walks the stops linearly. Pixels must match before timing is
// reported; this isolates the search change from storage and draw setup.
//
//   node --import tsx benchmark/chart-capacity.mjs            # full sweep
//   node --import tsx benchmark/chart-capacity.mjs --quick    # 16 and 64
//   node --import tsx benchmark/chart-capacity.mjs --variant pie-bsearch
//   node --import tsx benchmark/chart-capacity.mjs --json out.json
//
// Each row reports a 25k fit view and 1k close-up with 1/16/64/255 values.
// The harness reads the render target and requires pie-bsearch and pie-walk
// to produce identical pixels. It refuses a software adapter.

import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { CHART_SHADER } from '../src/render/shaders/chart.mjs';
import { COMMON } from '../src/render/shaders/common.mjs';
import {
  CHART_COUNT_WORD,
  CHART_HEADER,
  CHART_VALUE_WORDS,
  SHAPE_ELLIPSE,
  SHAPE_SHIFT,
  CHART_PIE,
} from '../src/contract.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(DIR, '..');
const args = process.argv.slice(2);
const quick = args.includes('--quick');
const jsonAt = args.indexOf('--json');
const jsonOut = jsonAt >= 0 ? args[jsonAt + 1] : null;
const onlyAt = args.indexOf('--variant');
const only = onlyAt >= 0 ? args[onlyAt + 1] : null;

const SEARCH_START =
  '  // Lower-bound search over cumulative stops: first stop strictly\n';
const SEARCH_END = '  var color = chartColor(off, n, k);';
const LINEAR_SEARCH =
  '  // Reference walk over the same cumulative stops.\n' +
  '  var acc = 0.0;\n' +
  '  var k = n;\n' +
  '  var lower = 0.0;\n' +
  '  var upper = 1.0;\n\n' +
  '  for (var i = 0u; i < n; i = i + 1u) {\n' +
  `    let stop = bitcast<f32>(chartBlob[off + ${CHART_HEADER}u + i * ${CHART_VALUE_WORDS}u]);\n` +
  '    if (t < stop && k == n) {\n' +
  '      k = i;\n' +
  '      lower = acc;\n' +
  '      upper = stop;\n' +
  '    }\n\n' +
  '    acc = stop;\n' +
  '  }\n\n' +
  '  if (k == n) { lower = acc; }\n' +
  '  let total = acc;\n\n';

const pieWalkShader = () => {
  const start = CHART_SHADER.indexOf(SEARCH_START);
  const end = CHART_SHADER.indexOf(SEARCH_END, start);

  if (
    start < 0 ||
    end < start ||
    CHART_SHADER.indexOf(SEARCH_START, start + 1) >= 0
  ) {
    throw new Error('pie-walk: chart shader search block did not match once');
  }

  return CHART_SHADER.slice(0, start) + LINEAR_SEARCH + CHART_SHADER.slice(end);
};

const VARIANTS = {
  'pie-walk': { wgsl: pieWalkShader(), kind: CHART_PIE },
  'pie-bsearch': { wgsl: CHART_SHADER, kind: CHART_PIE },
};

const SCENES = [
  { key: 'fit-25k', nodes: 25000, px: 12 },
  { key: 'close-1k', nodes: 1000, px: 60 },
];

const COUNTS = quick ? [16, 64] : [1, 16, 64, 255];

const MIME = { '.html': 'text/html', '.js': 'text/javascript' };
const server = createServer((req, res) => {
  const path = resolve(ROOT, '.' + new URL(req.url, 'http://x').pathname);

  try {
    const body = readFileSync(path);

    res.writeHead(200, {
      'content-type': MIME[extname(path)] ?? 'application/octet-stream',
    });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
});

await new Promise((r) => server.listen(0, '127.0.0.1', r));

const browser = await chromium.launch({
  channel: 'chromium',
  headless: true,
  args: [
    '--enable-unsafe-webgpu',
    ...(process.platform === 'linux'
      ? ['--use-gl=angle', '--use-angle=vulkan', '--enable-features=Vulkan']
      : []),
  ],
});
const page = await browser.newPage();

page.on('pageerror', (e) => console.error('[page]', e.message));
await page.goto(
  `http://127.0.0.1:${server.address().port}/benchmark/chart-capacity.html`,
);

const adapter = await page.evaluate(() => window.capacity.init());

console.log(
  `adapter: ${adapter.vendor} ${adapter.architecture} ${adapter.description}` +
    ` · timestamp-query ${adapter.timestamps ? 'yes' : 'NO (wall time)'}` +
    ` · maxStorageBufferBindingSize ${adapter.maxBinding}`,
);

if (/swiftshader|llvmpipe|lavapipe/i.test(JSON.stringify(adapter))) {
  console.error('refusing a software adapter: run `npm run gpu`');
  process.exit(1);
}

const rows = [];
const shapeBits = (SHAPE_ELLIPSE << SHAPE_SHIFT) >>> 0;

console.log(
  '\nscene      variant        n      gpu ms (median)  covered  blob MiB',
);

for (const scene of SCENES) {
  for (const [name, v] of Object.entries(VARIANTS)) {
    if (only != null && name !== only) {
      continue;
    }

    for (const n of COUNTS) {
      const words =
        scene.nodes *
        (CHART_HEADER + CHART_VALUE_WORDS * n + Math.ceil(n / 32));

      const r = await page.evaluate((a) => window.capacity.run(a), {
        wgsl: v.wgsl,
        kind: v.kind,
        n,
        nodes: scene.nodes,
        px: scene.px,
        shapeBits,
        header: CHART_HEADER,
        valueWords: CHART_VALUE_WORDS,
        countWord: CHART_COUNT_WORD,
        validityBits: 32,
        expectedBlobBytes: words * 4,
      });

      if (r.error != null) {
        rows.push({ scene: scene.key, variant: name, n, error: r.error });
        console.log(
          `${scene.key.padEnd(10)} ${name.padEnd(14)} ${String(n).padStart(4)}   error: ${r.error}`,
        );
        continue;
      }

      // A full chart covers most of the scene. A smaller fraction means
      // the shader or its records stopped drawing the property being priced.
      if (r.covered < 0.01) {
        throw new Error(
          `${scene.key} ${name} n=${n}: covered ${r.covered} — the row drew nothing`,
        );
      }

      // an alternative search must draw exactly what the shipped walk
      // draws (the pixel hash; its broken-on-purpose control — k off by
      // one — was run once and fails here)
      const walk = rows.find(
        (w) => w.scene === scene.key && w.variant === 'pie-walk' && w.n === n,
      );

      if (name === 'pie-bsearch' && walk != null) {
        r.sameAsWalk = r.ink === walk.ink;

        if (!r.sameAsWalk) {
          throw new Error(
            `${scene.key} pie-bsearch n=${n}: draws different pixels from pie-walk`,
          );
        }
      }

      rows.push({ scene: scene.key, variant: name, n, ...r });
      console.log(
        `${scene.key.padEnd(10)} ${name.padEnd(14)} ${String(n).padStart(4)}` +
          `   ${r.ms.toFixed(3).padStart(10)}       ${(r.covered * 100).toFixed(0).padStart(3)}%` +
          `   ${(r.blobBytes / 2 ** 20).toFixed(1).padStart(7)}`,
      );
    }
  }
}

await browser.close();
server.close();

if (jsonOut != null) {
  writeFileSync(
    jsonOut,
    JSON.stringify({ adapter, date: new Date().toISOString(), rows }, null, 2),
  );
}
