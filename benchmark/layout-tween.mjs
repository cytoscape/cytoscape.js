// Ledger item 68 (round 144): the animated layout's tween at scale, on
// both hosts.  Item 51's census found the same-thread host drawing 6
// frames in a 1.5 s grid tween on ndex-x-large (19,607 nodes) — one
// animation per node, each registered with the GPU tween sink and
// re-uploading its params every frame — while the worker host, whose
// animations took the CPU path, drew 31.  This suite is the item's
// first measurement and its after: the grid tween at 2k / 5k / 10k /
// 20k nodes on both hosts, the frames it drew, the uploads and posts
// it paid, and the main thread's availability while it ran.
//
//   npm run build
//   node benchmark/layout-tween.mjs                  # grid, 2k–20k
//   node benchmark/layout-tween.mjs --sizes 20000 --layouts grid,circle
//   node benchmark/layout-tween.mjs --allow-software
//
// Each row runs `cy.layout( { name, animate: true, animationDuration:
// 1000, fit: false } )` over nodes placed at random, so every node
// moves, and waits for `layoutstop`.  The rows assert what they are
// named for: the tween must move every node (a mid-tween sample of
// `position()` differs from both ends on some node — a tween that
// jumped would pass a frame count), must end at the layout's own
// positions, and `layoutstop` must land no sooner than the duration.
// Anything else prints as a warning rather than a number believed.
//
// `framesDrawn` is `cy.stats().frames`, the renderer's own count;
// `rafTicks` the page's; `upCalls` / `postCalls` count
// `GPUQueue.writeBuffer` and `Worker.postMessage` through in-page
// wrappers (the worker host's device writes happen in the worker and
// are not seen here — its cost crosses as posts).

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(DIR, '..');
const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = args.indexOf(name);

  return i >= 0 && args[i + 1] != null ? args[i + 1] : fallback;
};
const SIZES = argOf('--sizes', '2000,5000,10000,20000').split(',').map(Number);
const LAYOUTS = argOf('--layouts', 'grid').split(',');
const HOSTS = argOf('--hosts', 'same-thread,worker').split(',');
const allowSoftware = args.includes('--allow-software');
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

const origin = `http://127.0.0.1:${server.address().port}`;
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
await page.goto(`${origin}/playwright-page/index.html`);

const adapter = await page.evaluate(async () => {
  const a = await navigator.gpu?.requestAdapter();
  const info = a?.info;

  return a == null
    ? 'none'
    : `${info?.vendor ?? '?'} ${info?.architecture ?? ''} ${info?.description ?? ''}`.trim();
});

if (/swiftshader|software|llvmpipe|none/i.test(adapter) && !allowSoftware) {
  console.error(
    `adapter "${adapter}" is a software rasterizer (or absent); pass --allow-software to price it anyway`,
  );
  process.exit(1);
}

const out = await page.evaluate(
  async ({ SIZES, LAYOUTS, HOSTS }) => {
    const warnings = [];
    const now = () => performance.now();
    const up = { calls: 0, bytes: 0 };
    const post = { calls: 0, bytes: 0 };
    const writeBuffer = GPUQueue.prototype.writeBuffer;
    const postMessage = Worker.prototype.postMessage;

    GPUQueue.prototype.writeBuffer = function (buf, off, data, dOff, size) {
      const width = data.BYTES_PER_ELEMENT ?? 1;

      up.calls++;
      up.bytes +=
        size != null ? size * width : data.byteLength - (dOff ?? 0) * width;

      return writeBuffer.call(this, buf, off, data, dOff, size);
    };
    Worker.prototype.postMessage = function (msg, transfer) {
      post.calls++;

      if (Array.isArray(transfer)) {
        for (const b of transfer) {
          post.bytes += b.byteLength ?? 0;
        }
      }

      return postMessage.call(this, msg, transfer);
    };

    const container = document.getElementById('cytoscape');
    const nextRender = (cy) => new Promise((r) => cy.one('render', r));
    // a seeded scatter, so both hosts start every size from the same
    // positions and the grid moves every node
    const graph = (n) => {
      let s = 12345;
      const rnd = () => (s = (s * 1103515245 + 12345) >>> 0) / 2 ** 32;
      const els = [];

      for (let i = 0; i < n; i++) {
        els.push({
          data: { id: `n${i}` },
          position: { x: rnd() * 4000, y: rnd() * 4000 },
        });
      }

      for (let i = 1; i < n; i++) {
        els.push({
          data: { id: `e${i}`, source: `n${i}`, target: `n${(i * 7) % i}` },
        });
      }

      return els;
    };
    const style = {
      nodes: { width: 12, height: 12, 'background-color': '#4a7dbd' },
      edges: { width: 1, 'line-color': '#bbb', opacity: 0.6 },
    };
    const rows = [];

    for (const n of SIZES) {
      const elements = graph(n);

      for (const host of HOSTS) {
        const cy = cytoscape({
          container,
          elements,
          style,
          layout: { name: 'preset' },
          renderer: host === 'worker' ? { worker: true } : undefined,
        });

        await cy.ready;
        cy.fit();
        await nextRender(cy);

        for (const name of LAYOUTS) {
          // reset to the scatter, so each layout row moves every node
          cy.nodes().positions((node, i) => elements[i].position);
          await nextRender(cy);

          // the layout's own positions, for the end-state assertion
          const target = cy.nodes().map(() => null);
          const probe = cy.layout({ name, animate: false, fit: false });

          probe.run();
          cy.nodes().forEach((node, i) => {
            target[i] = { ...node.position() };
          });
          cy.nodes().positions((node, i) => elements[i].position);
          await nextRender(cy);

          const u0 = { ...up };
          const p0 = { ...post };
          const f0 = cy.stats().frames;
          let rafTicks = 0;
          let maxGap = 0;
          let last = now();
          let sampling = true;
          let mid = null;
          const t0 = now();
          const tick = () => {
            const t = now();

            maxGap = Math.max(maxGap, t - last);
            last = t;
            rafTicks++;

            // one mid-flight sample of every position, ~half-way
            if (mid == null && t - t0 > 450) {
              mid = cy.nodes().map((node) => ({ ...node.position() }));
            }

            if (sampling) {
              requestAnimationFrame(tick);
            }
          };
          const stopped = cy.promiseOn('layoutstop');

          requestAnimationFrame(tick);
          cy.layout({
            name,
            animate: true,
            animationDuration: 1000,
            fit: false,
          }).run();
          await stopped;

          const stopMs = now() - t0;

          sampling = false;

          const framesDrawn = cy.stats().frames - f0;
          const row = {
            nodes: n,
            host,
            layout: name,
            stopMs: +stopMs.toFixed(0),
            framesDrawn,
            fps: +((framesDrawn * 1000) / stopMs).toFixed(1),
            rafTicks,
            maxRafGapMs: +maxGap.toFixed(1),
            upCalls: up.calls - u0.calls,
            upKB: +((up.bytes - u0.bytes) / 1024).toFixed(0),
            postCalls: post.calls - p0.calls,
            postKB: +((post.bytes - p0.bytes) / 1024).toFixed(0),
          };

          // the rows assert what they are named for
          let moved = 0;
          let wrong = 0;

          cy.nodes().forEach((node, i) => {
            const p = node.position();
            const m = mid?.[i];

            if (
              m != null &&
              Math.hypot(
                m.x - elements[i].position.x,
                m.y - elements[i].position.y,
              ) > 1 &&
              Math.hypot(m.x - p.x, m.y - p.y) > 1
            ) {
              moved++;
            }

            if (Math.hypot(p.x - target[i].x, p.y - target[i].y) > 0.01) {
              wrong++;
            }
          });

          row.midFlightMoved = moved;

          if (moved === 0) {
            warnings.push(
              `${host} ${name} ${n}: no node read mid-flight between its ends`,
            );
          }

          if (wrong > 0) {
            warnings.push(
              `${host} ${name} ${n}: ${wrong} nodes did not end at the layout's positions`,
            );
          }

          if (stopMs < 990) {
            warnings.push(
              `${host} ${name} ${n}: layoutstop after ${stopMs.toFixed(0)} ms, under the duration`,
            );
          }

          rows.push(row);
        }

        cy.destroy();
      }
    }

    return { rows, warnings };
  },
  { SIZES, LAYOUTS, HOSTS },
);

await browser.close();
server.close();

console.log(`\n== layout tween (adapter: ${adapter}) ==`);
console.table(out.rows);

for (const w of out.warnings) {
  console.warn(`warning: ${w}`);
}

console.log(JSON.stringify({ adapter, ...out }));
