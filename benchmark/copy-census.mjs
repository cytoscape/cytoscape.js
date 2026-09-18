// Round 110.1: the copy census, rendered half — every byte a frame, a
// load, a worker batch or an export copies, priced in Chromium on a real
// adapter through the built UMD bundle.
//
//   npm run build
//   node benchmark/copy-census.mjs                 # same-thread + worker host
//   node benchmark/copy-census.mjs --same-thread   # one host
//   node benchmark/copy-census.mjs --allow-software
//
// The instruments are the platform's own entry points, patched in-page
// before the instance exists: `GPUQueue.writeBuffer` (calls, bytes, ms —
// the per-frame CPU→GPU upload), `GPUBuffer.mapAsync` (the export's GPU
// wait, so the JS readback loop can be split from it) and
// `Worker.postMessage` (the worker host's batch traffic, bytes counted
// *before* the call detaches them).  Sessions, per host: the load
// (fetch / parse / toColumnar / serialize / deserialize / init / ready /
// first frame, with the first frame's full-state upload), 60 idle
// frames, 240 frames of viewport spin (no model dirt), 240 frames of the
// 86.1 worst case (every node repositioned every frame), 60 whole-sheet
// restyles, and four exports (viewport 1× and 2×, full at 4k and 8k)
// with the readback loop, the GPU wait and the PNG encode apart.
//
// Rows assert what they are named for: the idle row must read zero
// bytes, the spin row only the uniform, the writer row one position
// column per drawn frame — a row that reads otherwise is printed with a
// warning rather than believed.  The run refuses a software adapter
// unless told not to, because a SwiftShader number lies about every
// GPU-side figure here.

import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(DIR, '..');
const args = process.argv.slice(2);
const hosts = args.includes('--same-thread')
  ? ['same-thread']
  : args.includes('--worker')
    ? ['worker']
    : ['same-thread', 'worker'];
const allowSoftware = args.includes('--allow-software');
const FRAMES = 240;
const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
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
const page = await (
  await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
  })
).newPage();

page.on('pageerror', (err) => console.error(`[page] ${err.message}`));
await page.goto(
  `http://127.0.0.1:${server.address().port}/playwright-page/index.html`,
);

const result = await page.evaluate(
  async ({ hosts, FRAMES }) => {
    const now = () => performance.now();
    const median = (a) => {
      const s = [...a].sort((x, y) => x - y);

      return s[Math.floor(s.length / 2)];
    };
    const adapter = await navigator.gpu.requestAdapter();
    const info = adapter?.info;
    const out = {
      adapter:
        `${info?.vendor ?? '?'} ${info?.architecture ?? ''} ${info?.description ?? ''}`.trim(),
      warnings: [],
    };

    // -- the instruments ---------------------------------------------
    const up = { calls: 0, bytes: 0, ms: 0 };
    const writeBuffer = GPUQueue.prototype.writeBuffer;

    GPUQueue.prototype.writeBuffer = function (buf, off, data, dataOff, size) {
      const t = now();
      const r = writeBuffer.call(this, buf, off, data, dataOff, size);
      const width = data.BYTES_PER_ELEMENT ?? 1;

      up.ms += now() - t;
      up.calls++;
      up.bytes +=
        size != null ? size * width : data.byteLength - (dataOff ?? 0) * width;

      return r;
    };

    const maps = { resolvedAt: 0, waitMs: 0 };
    const mapAsync = GPUBuffer.prototype.mapAsync;

    GPUBuffer.prototype.mapAsync = async function (...a) {
      const t = now();
      const r = await mapAsync.apply(this, a);

      maps.resolvedAt = now();
      maps.waitMs = maps.resolvedAt - t;

      return r;
    };

    const post = { calls: 0, bytes: 0, ms: 0 };
    const postMessage = Worker.prototype.postMessage;

    Worker.prototype.postMessage = function (msg, transfer) {
      let bytes = 0;

      if (Array.isArray(transfer)) {
        for (const b of transfer) {
          bytes += b.byteLength ?? 0; // before the call detaches it
        }
      }

      const t = now();
      const r = postMessage.call(this, msg, transfer);

      post.ms += now() - t;
      post.calls++;
      post.bytes += bytes;

      return r;
    };

    const snap = () => ({ up: { ...up }, post: { ...post } });
    const delta = (a, b) => ({
      upCalls: b.up.calls - a.up.calls,
      upBytes: b.up.bytes - a.up.bytes,
      upMs: +(b.up.ms - a.up.ms).toFixed(2),
      postCalls: b.post.calls - a.post.calls,
      postBytes: b.post.bytes - a.post.bytes,
      postMs: +(b.post.ms - a.post.ms).toFixed(2),
    });

    const style = {
      nodes: {
        width: 12,
        height: 12,
        'background-color': {
          case: [{ when: { data: 'Node_Type', eq: 'TF' }, then: '#c0392b' }],
          else: '#4a7dbd',
        },
        label: { data: 'name' },
        'font-size': 10,
        color: '#333',
      },
      edges: { width: 1, 'line-color': '#bbb', opacity: 0.6 },
    };
    const raf = () => new Promise((r) => requestAnimationFrame(r));
    const nextRender = (cy) => new Promise((r) => cy.one('render', r));

    // -- the load ----------------------------------------------------
    let t = now();
    const text = await (await fetch('/debug/network-ndex-x-large.json')).text();
    const fetchMs = now() - t;

    t = now();
    const json = JSON.parse(text);
    const parseMs = now() - t;
    t = now();
    const columnar = cytoscape.toColumnarElements(json.elements);
    const toColumnarMs = now() - t;
    t = now();
    const wire = cytoscape.serializeElements(columnar);
    const serializeMs = now() - t;

    out.load = {
      nodes: columnar.nodes.count,
      edges: columnar.edges.count,
      fetchMs: +fetchMs.toFixed(0),
      parseMs: +parseMs.toFixed(0),
      toColumnarMs: +toColumnarMs.toFixed(0),
      serializeMs: +serializeMs.toFixed(0),
      wireMB: +(wire.byteLength / 1e6).toFixed(2),
    };

    const container = document.getElementById('cytoscape');

    const session = async (host) => {
      const renderer = host === 'worker' ? { worker: true } : undefined;
      const r = {};
      const s0 = snap();

      t = now();
      const dec = cytoscape.deserializeElements(wire);
      r.deserializeMs = +(now() - t).toFixed(1);
      t = now();
      const cy = cytoscape({ container, elements: dec, style, renderer });
      r.initMs = +(now() - t).toFixed(0);
      t = now();
      await cy.ready;
      r.readyMs = +(now() - t).toFixed(0);
      t = now();
      await nextRender(cy);
      r.firstFrameMs = +(now() - t).toFixed(0);
      cy.fit();
      await nextRender(cy);
      r.initUpload = delta(s0, snap());

      let a = snap();

      for (let f = 0; f < 60; f++) {
        await raf();
      }

      r.idle = delta(a, snap());

      if (r.idle.upBytes !== 0 || r.idle.postBytes !== 0) {
        out.warnings.push(`${host}: the idle row uploaded bytes`);
      }

      a = snap();

      for (let f = 0; f < FRAMES; f++) {
        cy.panBy({ x: f % 2 ? 1 : -1, y: 0 });
        await raf();
      }

      r.spin = delta(a, snap());

      const eles = cy.nodes();
      const st1 = cy.stats();
      let phase = 0;

      a = snap();
      t = now();

      for (let f = 0; f < FRAMES; f++) {
        phase += 0.05;

        const p = phase;

        eles.positions((node, i) => ({
          x: (i % 200) * 8 + Math.sin(p + i * 0.01) * 6,
          y: Math.floor(i / 200) * 8 + Math.cos(p + i * 0.013) * 6,
        }));
        await raf();
      }

      const st2 = cy.stats();

      r.writer = {
        ...delta(a, snap()),
        wallMs: +(now() - t).toFixed(0),
        frames: FRAMES,
        framesDrawn: st2.frames - st1.frames,
        statsUploadedBytes: st2.uploadedBytes - st1.uploadedBytes,
      };

      const perFrame =
        (host === 'worker'
          ? r.writer.postBytes / r.writer.postCalls
          : r.writer.upBytes / r.writer.framesDrawn) /
        (cy.nodes().length * 8);

      if (perFrame < 0.9 || perFrame > 1.5) {
        out.warnings.push(
          `${host}: the writer row moved ${perFrame.toFixed(2)} position columns per frame, not one`,
        );
      }

      a = snap();
      t = now();

      const st3 = cy.stats();

      for (let f = 0; f < 60; f++) {
        cy.style({
          nodes: {
            ...style.nodes,
            'background-color': f % 2 ? '#123456' : '#654321',
          },
          edges: style.edges,
        });
        await raf();
      }

      r.restyle = {
        ...delta(a, snap()),
        wallMs: +(now() - t).toFixed(0),
        applies: 60,
        framesDrawn: cy.stats().frames - st3.frames,
      };

      cy.fit();
      await nextRender(cy);
      r.exports = {};

      for (const [name, opts] of [
        ['viewport 1x', { scale: 1 }],
        ['viewport 2x', { scale: 2 }],
        ['full 4k', { full: true, maxWidth: 4096, maxHeight: 4096 }],
        ['full 8k', { full: true, maxWidth: 8192, maxHeight: 8192 }],
      ]) {
        const runs = [];

        for (let i = 0; i < 3; i++) {
          const e0 = now();
          const img = await cy._renderer.exportImage(opts);
          const e1 = now();
          // read the map instrument before png()'s own export overwrites it
          const gpuWaitMs = maps.waitMs;
          const loopMs = e1 - maps.resolvedAt;
          const p0 = now();

          await cy.png(opts);
          runs.push({
            w: img.width,
            h: img.height,
            bytes: img.data.byteLength,
            exportMs: e1 - e0,
            gpuWaitMs,
            loopMs,
            pngMs: now() - p0,
          });
        }

        const m = (k) => +median(runs.map((x) => x[k])).toFixed(1);

        r.exports[name] = {
          w: runs[0].w,
          h: runs[0].h,
          MB: +(runs[0].bytes / 1e6).toFixed(1),
          exportMs: m('exportMs'),
          pngMs: m('pngMs'),
          encodeMs: +(m('pngMs') - m('exportMs')).toFixed(1),
          // the split is only observable where the readback runs in-page
          ...(host === 'worker'
            ? {}
            : { gpuWaitMs: m('gpuWaitMs'), readbackLoopMs: m('loopMs') }),
        };
      }

      cy.destroy();

      return r;
    };

    for (const host of hosts) {
      out[host] = await session(host);
    }

    return out;
  },
  { hosts, FRAMES },
);

await browser.close();
server.close();

const software = /swiftshader|software|llvmpipe/i.test(result.adapter);

if (software && !allowSoftware) {
  console.error(
    `adapter "${result.adapter}" is a software rasterizer; pass --allow-software to price it anyway`,
  );
  process.exit(1);
}

console.log(`\n== copy census, rendered (adapter: ${result.adapter}) ==`);
console.log(JSON.stringify(result, null, 1));

const outFile = join(DIR, 'results', 'copy-census.json');

try {
  writeFileSync(outFile, JSON.stringify(result, null, 1));
  console.log(`\nwritten to ${outFile}`);
} catch {
  // results/ is untracked and may be absent; the console has the table
}

for (const w of result.warnings) {
  console.warn(`warning: ${w}`);
}
