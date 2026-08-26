// Round 86.4: main-thread occupancy per frame, worker versus
// same-thread — the row whose subject is the point.  Total frame time
// would measure nothing (the work does not shrink, it moves), so this
// bench measures what the main thread pays while a sustained CPU
// position writer redraws a large graph every frame, under each host.
//
//   npm run build && node benchmark/worker-occupancy-bench.mjs
//
// The scenario is the 86.1 gate's worst case made real: a main-side
// rAF loop rewrites every node position each frame (the shape of an
// external CPU layout tick or a whole-graph drag), and the renderer —
// same-thread or worker — must repaint.  Three instruments per mode:
//
//   writer ms/frame — the writer's own rAF cadence (wall clock / frames):
//       the same-thread mode's rAF also carries the renderer frame, so
//       this is the end-to-end main-loop budget
//   main busy %     — share of wall time the main thread is executing
//       tasks, sampled by a 0-delay setTimeout probe whose gap
//       overshoot is time the thread was busy (or throttled)
//   renderer cpuFrameMs — the engine's own per-frame CPU cost, from
//       stats(): spent ON MAIN same-thread, IN THE WORKER under
//       worker: true
//   pick rtt ms     — median async edge-pick latency (the one-hop cost
//       the worker adds)
//
// SwiftShader caveat: CI-class boxes rasterize WebGPU in software, so
// the absolute renderer cost is inflated and the occupancy win reads
// larger than real-GPU numbers would; the *shape* (whose thread pays)
// is what the row pins.  The run prints the adapter identity.

import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(DIR, '..');
const PORT = 3397;
const N_NODES = 20000; // harness scale: ndex-x-large carries 19,607
const N_EDGES = 30000;
const FRAMES = 240;
const PICKS = 40;

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
};

const args = process.argv.slice(2);
// --swiftshader pins the software adapter: the render-cost-heavy case,
// where the worker's occupancy win is at its largest
const useSwiftshader = args.includes('--swiftshader');

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
    ...(useSwiftshader ? ['--use-webgpu-adapter=swiftshader'] : []),
    '--use-gl=angle',
    '--use-angle=vulkan',
    '--enable-features=Vulkan',
  ],
});
const page = await browser.newPage();

page.on('pageerror', (err) => console.error('[pageerror]', err.message));
await page.setViewportSize({ width: 800, height: 600 });
await page.goto(`http://127.0.0.1:${PORT}/playwright-page/index.html`);

const adapter = await page.evaluate(async () => {
  const a = await navigator.gpu?.requestAdapter();

  return a == null
    ? null
    : `${a.info?.vendor ?? ''} ${a.info?.description ?? ''}`.trim();
});

if (adapter == null) {
  console.error('no WebGPU adapter — nothing to measure');
  process.exit(1);
}

console.log(`adapter: ${adapter}`);
console.log(
  `graph: ${N_NODES} nodes / ${N_EDGES} edges; ` +
    `${FRAMES} frames of a full-position rewrite per mode\n`,
);

const measure = async (worker) => {
  return await page.evaluate(
    async ({ worker, N_NODES, N_EDGES, FRAMES, PICKS }) => {
      const nodes = [];
      const edges = [];

      for (let i = 0; i < N_NODES; i++) {
        nodes.push({
          data: { id: `n${i}` },
          position: {
            x: (i % 200) * 8,
            y: Math.floor(i / 200) * 8,
          },
        });
      }

      for (let i = 0; i < N_EDGES; i++) {
        edges.push({
          data: {
            id: `e${i}`,
            source: `n${i % N_NODES}`,
            target: `n${(i * 7 + 1) % N_NODES}`,
          },
        });
      }

      const cy = window.makeCy({
        elements: { nodes, edges },
        style: { nodes: { width: 6, height: 6 }, edges: { width: 1 } },
        renderer: worker ? { worker: true } : {},
      });

      await cy.ready;
      cy.fit();
      await new Promise((r) => cy.one('render', r));

      // busy probe: a 0-delay timer chain; gap overshoot beyond the
      // clamped ~1ms is time the main thread could not run it
      let busyMs = 0;
      let probeLast = performance.now();
      let probeAlive = true;
      const probe = () => {
        const now = performance.now();
        const gap = now - probeLast;

        busyMs += Math.max(0, gap - 2); // 2ms allowance for timer clamp
        probeLast = now;

        if (probeAlive) {
          setTimeout(probe, 0);
        }
      };

      setTimeout(probe, 0);

      // the writer: every node moves every frame (a CPU layout's shape)
      const eles = cy.nodes();
      const t0 = performance.now();
      let phase = 0;

      for (let f = 0; f < FRAMES; f++) {
        phase += 0.05;

        const p = phase;

        eles.positions((node, i) => ({
          x: (i % 200) * 8 + Math.sin(p + i * 0.01) * 6,
          y: Math.floor(i / 200) * 8 + Math.cos(p + i * 0.013) * 6,
        }));
        await new Promise((r) => requestAnimationFrame(r));
      }

      const wall = performance.now() - t0;

      probeAlive = false;

      const stats = cy.stats();

      // pick latency: async edge pick at the viewport center
      const pickTimes = [];

      for (let i = 0; i < PICKS; i++) {
        const s = performance.now();

        await cy.pick(400, 300);
        pickTimes.push(performance.now() - s);
      }

      pickTimes.sort((a, b) => a - b);

      const result = {
        writerMsPerFrame: wall / FRAMES,
        fps: (FRAMES / wall) * 1000,
        busyPct: (busyMs / wall) * 100,
        rendererCpuFrameMs: stats.cpuFrameMs,
        frames: stats.frames,
        pickRttMs: pickTimes[pickTimes.length >> 1],
      };

      cy.destroy();
      window.cy = null;

      return result;
    },
    { worker, N_NODES, N_EDGES, FRAMES, PICKS },
  );
};

const fmt = (r) =>
  `writer ${r.writerMsPerFrame.toFixed(2)} ms/frame (${r.fps.toFixed(1)} fps)  ` +
  `main busy ${r.busyPct.toFixed(0)}%  ` +
  `renderer cpuFrame ${r.rendererCpuFrameMs.toFixed(2)} ms  ` +
  `pick rtt ${r.pickRttMs.toFixed(1)} ms  ` +
  `(${r.frames} frames drawn)`;

// scenario 2: renderer-dominated — the writer only spins the viewport
// (cheap main-side), so main-thread busyness is renderer share + probe
const measureViewport = async (worker) => {
  return await page.evaluate(
    async ({ worker, N_NODES, N_EDGES, FRAMES }) => {
      const nodes = [];
      const edges = [];

      for (let i = 0; i < N_NODES; i++) {
        nodes.push({
          data: { id: `n${i}` },
          position: { x: (i % 200) * 8, y: Math.floor(i / 200) * 8 },
        });
      }

      for (let i = 0; i < N_EDGES; i++) {
        edges.push({
          data: {
            id: `e${i}`,
            source: `n${i % N_NODES}`,
            target: `n${(i * 7 + 1) % N_NODES}`,
          },
        });
      }

      const cy = window.makeCy({
        elements: { nodes, edges },
        style: { nodes: { width: 6, height: 6 }, edges: { width: 1 } },
        renderer: worker ? { worker: true } : {},
      });

      await cy.ready;
      cy.fit();
      await new Promise((r) => cy.one('render', r));

      let busyMs = 0;
      let probeLast = performance.now();
      let probeAlive = true;
      const probe = () => {
        const now = performance.now();

        busyMs += Math.max(0, now - probeLast - 2);
        probeLast = now;

        if (probeAlive) {
          setTimeout(probe, 0);
        }
      };

      setTimeout(probe, 0);

      const base = cy.zoom();
      const t0 = performance.now();

      for (let f = 0; f < FRAMES; f++) {
        cy.zoom(base * (1 + 0.3 * Math.sin(f * 0.05)));
        await new Promise((r) => requestAnimationFrame(r));
      }

      const wall = performance.now() - t0;

      probeAlive = false;

      const stats = cy.stats();
      const result = {
        writerMsPerFrame: wall / FRAMES,
        fps: (FRAMES / wall) * 1000,
        busyPct: (busyMs / wall) * 100,
        rendererCpuFrameMs: stats.cpuFrameMs,
        frames: stats.frames,
        pickRttMs: 0,
      };

      cy.destroy();
      window.cy = null;

      return result;
    },
    { worker, N_NODES, N_EDGES, FRAMES },
  );
};

// warmup both paths once (pipeline compiles), then measure
await measure(false);

const same = await measure(false);

console.log(`same-thread   ${fmt(same)}`);

await measure(true);

const workered = await measure(true);

console.log(`worker: true  ${fmt(workered)}`);

console.log('\nviewport spin (renderer-dominated, writer trivial):');

await measureViewport(false);

const sameVp = await measureViewport(false);

console.log(`same-thread   ${fmt(sameVp)}`);

await measureViewport(true);

const workerVp = await measureViewport(true);

console.log(`worker: true  ${fmt(workerVp)}`);

console.log(
  `\nmain-thread renderer cost moved off-thread: ` +
    `${same.rendererCpuFrameMs.toFixed(2)} ms/frame → ` +
    `(worker-side) ${workered.rendererCpuFrameMs.toFixed(2)} ms/frame; ` +
    `writer loop ${same.writerMsPerFrame.toFixed(2)} → ` +
    `${workered.writerMsPerFrame.toFixed(2)} ms/frame; ` +
    `pick +${(workered.pickRttMs - same.pickRttMs).toFixed(1)} ms rtt`,
);

await browser.close();
server.close();
