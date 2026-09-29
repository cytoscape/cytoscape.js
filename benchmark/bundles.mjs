// Round 105's width sweep: what parallel-edge bundles cost, by bundle
// width, in both libraries — ingest, curve derivation, a render frame and
// a pick, at widths 2 / 8 / 32, under `bezier` (the bundling style) and
// `haystack` (v3's answer for this shape at scale, and GeneMANIA's own).
//
//   npm run build                               # both UMD bundles
//   node benchmark/bundles.mjs                  # both scales, repeat 3
//   node benchmark/bundles.mjs --scale large    # one scale
//   node benchmark/bundles.mjs --repeat 5 --json out.json
//   node benchmark/bundles.mjs --allow-software
//
// In a browser on a real adapter, through the built UMD bundles, because
// v3's routing and picking live in its canvas renderer: a headless v3 in
// Node has no control points and no pick at all.  Both libraries load on
// playwright-page/parity.html; each scene gets a fresh page.
//
// **Width is the only thing that varies.**  At each scale the edge count
// and node count are fixed and the edges are dealt into E / W distinct
// random node pairs, W parallel edges each — so the rows at one scale
// differ only in how the same edges are bundled.  Two scales:
//
//   small  32 nodes, 768 edges — GeneMANIA's scale (its example query is
//          32 genes and 712 interactions), where the LOD question is asked
//   large  4,096 nodes, 32,768 edges — where per-edge costs show
//
// **Each row asserts the width it is named for** (the 39.1 rule: a fixture
// can be styled into a mode it never enters, and `bezier` bundles
// multi-edges only).  Before measuring, the scene checks on the live
// instance that every sampled pair has exactly W members, that under
// `bezier` their W control points are distinct (every member of an even
// bundle curves — none straight), and that under `haystack` their W
// midpoints are distinct; a scene that fails throws rather than prints.
//
// Rows (median of --repeat for the one-shots):
//
//   ingest   cytoscape() to ready, a fresh instance each repeat
//   derive   move every node 1px, then the first whole-graph bounds read —
//            which is where both libraries derive every edge's route (v4
//            defers derivation to the first read; v3's boundingBox
//            recalculates the rendered style of bundled edges)
//   frame    a continuous pan at fit, 90 frames: wall ms per frame (vsync-
//            floored when fast), and v4's device ms (timestamp-query)
//   pick     200 hover picks with v3's mouse halos (8 px edges, 2 px
//            nodes) on bundle members' midpoints: v3's findNearestElement
//            (synchronous, CPU), v4's renderer pick with its tile cache
//            invalidated each time (asynchronous, GPU — about a frame)
//
// Refuses a software adapter unless told not to.

import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cpus, totalmem } from 'node:os';
import { chromium } from '@playwright/test';

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(DIR, '..');
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, fallback) => {
  const i = args.indexOf(name);

  return i >= 0 && i + 1 < args.length ? args[i + 1] : fallback;
};
const REPEAT = Number(opt('--repeat', 3));
const allowSoftware = flag('--allow-software');
const jsonOut = opt('--json', null);
const SCALES = {
  small: { nodes: 32, edges: 768 },
  large: { nodes: 4096, edges: 32768 },
};
const scaleNames = opt('--scale', 'small,large').split(',');
const WIDTHS = opt('--widths', '2,8,32').split(',').map(Number);
const CURVES = opt('--curves', 'bezier,haystack').split(',');
const SIDES = opt('--sides', 'v3,v4').split(',');

for (const b of ['v3/build/cytoscape.umd.js', 'build/cytoscape.umd.js']) {
  if (!existsSync(join(ROOT, b))) {
    console.error(
      `missing ${b} — run \`npm run build\` (and \`cd v3 && npm run build:umd\`) first`,
    );
    process.exit(1);
  }
}

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
};

const server = createServer((req, res) => {
  const path = resolve(ROOT, '.' + new URL(req.url, 'http://x').pathname);
  let body;

  try {
    body = readFileSync(path);
  } catch {
    res.writeHead(404);
    res.end();
    return;
  }

  res.writeHead(200, {
    'content-type': MIME[extname(path)] ?? 'application/octet-stream',
  });
  res.end(body);
});

await new Promise((r) => server.listen(0, '127.0.0.1', r));

const PAGE = `http://127.0.0.1:${server.address().port}/playwright-page/parity.html`;

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

/** The in-page half: build the scene, assert its width, measure. */
const scene = async ({ side, curve, width, nodes: N, edges: E, repeat }) => {
  const now = () => performance.now();
  const raf = () => new Promise((r) => requestAnimationFrame(r));
  const median = (xs) => [...xs].sort((a, b) => a - b)[xs.length >> 1];

  // a seeded scatter and a seeded deal of distinct unordered pairs
  let seed = 105;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;

    return seed / 4294967296;
  };
  const side_ = Math.ceil(Math.sqrt(N)) * 60;
  const nodeDefs = [];

  for (let i = 0; i < N; i++) {
    nodeDefs.push({
      data: { id: 'n' + i },
      position: { x: rand() * side_, y: rand() * side_ },
    });
  }

  const pairs = [];
  const taken = new Set();

  while (pairs.length < E / width) {
    const a = Math.floor(rand() * N);
    const b = Math.floor(rand() * N);
    const key = a < b ? a + ',' + b : b + ',' + a;

    if (a !== b && !taken.has(key)) {
      taken.add(key);
      pairs.push([a, b]);
    }
  }

  const edgeDefs = [];

  pairs.forEach(([a, b], p) => {
    for (let k = 0; k < width; k++) {
      // alternate directions inside a bundle, as GeneMANIA's do
      const [s, t] = k & 1 ? [b, a] : [a, b];

      edgeDefs.push({
        data: { id: `e${p}_${k}`, source: 'n' + s, target: 'n' + t },
      });
    }
  });

  const container = document.getElementById(side);

  container.style.width = '1280px';
  container.style.height = '800px';
  container.style.left = '0';

  const style3 = [
    { selector: 'node', style: { width: 10, height: 10 } },
    {
      selector: 'edge',
      style: { 'curve-style': curve, width: 1, 'haystack-radius': 0.5 },
    },
  ];
  const style4 = {
    nodes: { width: 10, height: 10 },
    edges: { 'curve-style': curve, width: 1, 'haystack-radius': 0.5 },
  };
  const make = async () => {
    const elements = {
      nodes: nodeDefs.map((n) => ({
        data: { ...n.data },
        position: { ...n.position },
      })),
      edges: edgeDefs.map((e) => ({ data: { ...e.data } })),
    };

    if (side === 'v3') {
      const cy = window.cytoscapeV3({
        container,
        elements,
        style: style3,
        layout: { name: 'preset' },
      });

      await new Promise((r) => cy.ready(r));

      return cy;
    }

    const cy = window.cytoscape({
      container,
      elements,
      style: style4,
      layout: { name: 'preset' },
      renderer: { renderScaleMin: 1, renderScaleMax: 1 },
    });

    await cy.ready;

    return cy;
  };

  // -- ingest --
  const ingest = [];
  let cy = null;

  for (let r = 0; r < repeat + 1; r++) {
    if (cy != null) {
      cy.destroy();
    }

    const t0 = now();

    cy = await make();

    if (r > 0) {
      ingest.push(now() - t0); // the first builds the pipelines
    }
  }

  cy.fit(undefined, 20);
  await raf();
  await raf();

  // -- the width this row is named for, asserted on the live instance --
  const sample = Math.min(pairs.length, 16);

  for (let p = 0; p < sample; p++) {
    const members = [];

    for (let k = 0; k < width; k++) {
      members.push(cy.getElementById(`e${p}_${k}`));
    }

    const [a, b] = pairs[p];
    const between = cy
      .getElementById('n' + a)
      .edgesWith(cy.getElementById('n' + b));

    if (between.length !== width) {
      throw new Error(`pair ${p}: ${between.length} members, not ${width}`);
    }

    const keys = new Set(
      members.map((e) => {
        if (curve === 'bezier') {
          const cps = e.controlPoints();

          if (cps == null || cps.length === 0) {
            throw new Error(`e${p}: a bezier bundle member renders straight`);
          }

          return cps.map((c) => c.x.toFixed(3) + ',' + c.y.toFixed(3)).join();
        }

        const m = e.midpoint();

        return m.x.toFixed(3) + ',' + m.y.toFixed(3);
      }),
    );

    if (keys.size !== width) {
      throw new Error(
        `pair ${p}: ${keys.size} distinct ${curve === 'bezier' ? 'curves' : 'haystack lines'}, not ${width}`,
      );
    }
  }

  // -- derive: bulk move, then the first bounds read --
  const derive = [];

  for (let r = 0; r < repeat + 1; r++) {
    const dx = r & 1 ? -1 : 1;
    const t0 = now();

    cy.nodes().shift({ x: dx, y: 0 });
    cy.elements().boundingBox();

    if (r > 0) {
      derive.push(now() - t0);
    }
  }

  cy.fit(undefined, 20);
  await raf();
  await raf();

  // -- frame: a continuous pan at fit --
  const FRAMES = 90;
  const wall = [];
  const device = [];
  let lastReading = side === 'v4' ? cy.renderer().stats().gpuFrameReadings : 0;
  let prev = now();

  for (let f = 0; f < FRAMES; f++) {
    cy.panBy({ x: f & 1 ? -2 : 2, y: 0 });
    await raf();

    const t = now();

    wall.push(t - prev);
    prev = t;

    if (side === 'v4') {
      const s = cy.renderer().stats();

      if (s.gpuFrameReadings !== lastReading && s.gpuFrameMs > 0) {
        device.push(s.gpuFrameMs);
        lastReading = s.gpuFrameReadings;
      }
    }
  }

  // -- pick: hover picks on bundle members' midpoints, v3's mouse halos --
  const PICKS = 200;
  const picks = [];
  let hits = 0;
  const zoom = cy.zoom();
  const pan = cy.pan();

  for (let i = 0; i < PICKS; i++) {
    const p = i % pairs.length;
    const k = Math.floor(i / pairs.length) % width;
    const m = cy.getElementById(`e${p}_${k}`).midpoint();
    const rx = m.x * zoom + pan.x;
    const ry = m.y * zoom + pan.y;
    let hit;
    const t0 = now();

    if (side === 'v3') {
      hit = cy.renderer().findNearestElement(m.x, m.y, true, false);
    } else {
      // the renderer's own pick (cy.pick is exact by contract; the
      // gesture layer passes the halos, and so does this row)
      const r = cy._renderer;

      r.picking.invalidateCache();
      hit = cy._decodePick(
        await r.pick(rx, ry, { edgePadPx: 8, nodePadPx: 2 }),
      );
    }

    picks.push(now() - t0);

    if (hit != null && hit.isEdge?.()) {
      hits++;
    }
  }

  cy.destroy();

  return {
    ingest: median(ingest),
    derive: median(derive),
    frame: median(wall),
    device: device.length > 0 ? median(device) : null,
    deviceReadings: device.length,
    pick: median(picks),
    pickHits: hits / PICKS,
    pairs: pairs.length,
  };
};

const adapterOf = async (page) =>
  page.evaluate(async () => {
    const a = await navigator.gpu?.requestAdapter();
    const i = a?.info;

    return a == null
      ? null
      : `${i?.vendor ?? '?'} ${i?.architecture ?? ''} ${i?.description ?? ''}`.trim();
  });

const rows = [];
let adapterName = null;

for (const scaleName of scaleNames) {
  const scale = SCALES[scaleName];

  if (scale == null) {
    throw new Error(`no scale ${scaleName}; known: ${Object.keys(SCALES)}`);
  }

  for (const curve of CURVES) {
    for (const width of WIDTHS) {
      for (const side of SIDES) {
        const page = await (
          await browser.newContext({ viewport: { width: 1300, height: 820 } })
        ).newPage();
        const errors = [];

        page.on('pageerror', (err) => errors.push(err.message));
        await page.goto(PAGE);

        if (adapterName == null) {
          adapterName = await adapterOf(page);

          if (adapterName == null) {
            console.error('no WebGPU adapter — this sweep needs one');
            process.exit(1);
          }

          if (
            !allowSoftware &&
            /swiftshader|software|llvmpipe/i.test(adapterName)
          ) {
            console.error(
              `adapter "${adapterName}" is a software rasterizer; pass --allow-software to measure it anyway`,
            );
            process.exit(1);
          }
        }

        const row = await page.evaluate(scene, {
          side,
          curve,
          width,
          ...scale,
          repeat: REPEAT,
        });

        row.scale = scaleName;
        row.curve = curve;
        row.width = width;
        row.side = side;
        row.errors = errors;
        rows.push(row);
        process.stderr.write(`  ${scaleName} ${curve} w${width} ${side}\n`);
        await page.context().close();
      }
    }
  }
}

await browser.close();
server.close();

const f = (v, d = 2) => (v == null ? '   -' : v.toFixed(d).padStart(8));

console.log(
  `\nbundle-width sweep — ${adapterName}; ${cpus()[0].model}, ` +
    `${Math.round(totalmem() / 2 ** 30)} GiB; built UMD; 1280x800 at dpr 1; ` +
    `repeat ${REPEAT} (median)`,
);

for (const scaleName of scaleNames) {
  const { nodes, edges } = SCALES[scaleName];

  console.log(`\n${scaleName}: ${nodes} nodes, ${edges} edges`);
  console.log(
    'curve     width side    ingest    derive  frame ms  device ms  pick ms  hits',
  );

  for (const r of rows.filter((x) => x.scale === scaleName)) {
    console.log(
      `${r.curve.padEnd(9)} ${String(r.width).padStart(5)} ${r.side.padEnd(4)} ` +
        `${f(r.ingest, 1)}  ${f(r.derive)}  ${f(r.frame)}  ${f(r.device, 3)}  ${f(r.pick, 3)}  ` +
        `${(r.pickHits * 100).toFixed(0).padStart(3)}%` +
        (r.errors.length > 0 ? `  ERRORS ${r.errors.join('; ')}` : ''),
    );
  }
}

if (jsonOut != null) {
  writeFileSync(
    jsonOut,
    JSON.stringify({ adapter: adapterName, repeat: REPEAT, rows }, null, 2),
  );
}
