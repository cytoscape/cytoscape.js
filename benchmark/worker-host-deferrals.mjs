// Ledger item 51 (taken 2026-09-18): the worker host's three pass-1
// deferrals, priced before anything is built — what the boundary would
// have to carry for background images, what the CPU-side tweens and
// force layout actually cost in span traffic under `renderer: { worker:
// true }`, and whether a face loaded into a worker's FontFaceSet reaches
// OffscreenCanvas 2D rasterization at all.
//
//   npm run build
//   node benchmark/worker-host-deferrals.mjs            # all three
//   node benchmark/worker-host-deferrals.mjs --images   # one of images /
//                                                       #   tweens / fonts
//   node benchmark/worker-host-deferrals.mjs --allow-software
//
// Images run on the same-thread host only — the worker host zeroes the
// image count (its recorded fallback) — with the registry's own
// `acquire` / `release` / `takeReady` / `takeFreed` wrapped in-page, so
// the rows count the entry lifecycle the worker design would mirror
// (messages, url bytes) and the rasters a worker-side decode would
// produce (bytes), per second, on a load, a url churn and a vector
// promotion sweep.  Tweens and the force layout run on both hosts with
// the census's instruments (`GPUQueue.writeBuffer`, `Worker.postMessage`)
// so the worker row is the span traffic the CPU path pays where the
// same-thread host tweens on-device.  Fonts run in Chromium and WebKit
// with no adapter need: a Blob worker registers the page's Open Sans
// face in `self.fonts`, rasterizes before and after `load()`, and the
// page's own raster is the reference — the face applied iff the worker's
// post-load advance equals the page's.
//
// Rows assert what they are named for: the churn row's acquire count
// must equal its restyled-node count, the worker tween row must post a
// position span per drawn frame, the font row must move the advance —
// anything else prints as a warning rather than a number believed.

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from '@playwright/test';

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(DIR, '..');
const args = process.argv.slice(2);
const only = ['--images', '--tweens', '--fonts'].filter((a) =>
  args.includes(a),
);
const modes =
  only.length > 0 ? only.map((a) => a.slice(2)) : ['images', 'tweens', 'fonts'];
const allowSoftware = args.includes('--allow-software');
const FRAMES = 240;
const FONT_PATH =
  '/node_modules/@fontsource/open-sans/files/open-sans-latin-400-normal.woff2';
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
    'access-control-allow-origin': '*',
  });
  res.end(body);
});

await new Promise((r) => server.listen(0, '127.0.0.1', r));

const origin = `http://127.0.0.1:${server.address().port}`;
const PAGE = `${origin}/playwright-page/index.html`;
const out = { warnings: [] };

const openChromium = async () => {
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
  await page.goto(PAGE);

  return { browser, page };
};

// -- the in-page instruments, shared by the images and tweens sessions --
const INSTRUMENTS = `
  const now = () => performance.now();
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

  const post = { calls: 0, bytes: 0, ms: 0 };
  const postMessage = Worker.prototype.postMessage;

  Worker.prototype.postMessage = function (msg, transfer) {
    let bytes = 0;

    if (Array.isArray(transfer)) {
      for (const b of transfer) {
        bytes += b.byteLength ?? 0;
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
  const raf = () => new Promise((r) => requestAnimationFrame(r));
  const nextRender = (cy) => new Promise((r) => cy.one('render', r));
  const container = document.getElementById('cytoscape');
`;

const adapterName = async (page) =>
  await page.evaluate(async () => {
    const adapter = await navigator.gpu?.requestAdapter();
    const info = adapter?.info;

    return adapter == null
      ? 'none'
      : `${info?.vendor ?? '?'} ${info?.architecture ?? ''} ${info?.description ?? ''}`.trim();
  });

const refuseSoftware = (adapter) => {
  if (/swiftshader|software|llvmpipe|none/i.test(adapter) && !allowSoftware) {
    console.error(
      `adapter "${adapter}" is a software rasterizer (or absent); pass --allow-software to price it anyway`,
    );
    process.exit(1);
  }
};

// -- images ----------------------------------------------------------------
if (modes.includes('images')) {
  const { browser, page } = await openChromium();

  out.adapter = await adapterName(page);
  refuseSoftware(out.adapter);

  out.images = await page.evaluate(
    async ({ INSTRUMENTS, FRAMES }) => {
      const warnings = [];
      const r = {};
      // eslint-disable-next-line no-eval
      const env = new Function(
        'FRAMES',
        INSTRUMENTS +
          '; return { now, snap, delta, raf, nextRender, container };',
      )(FRAMES);
      const { now, raf, nextRender, container } = env;

      // a pool of distinct raster urls (64×64 png data urls — what the
      // decoder fetches and createImageBitmap's) and vector urls (svg,
      // re-rastered on zoom promotion)
      const rasterUrl = (i) => {
        const c = document.createElement('canvas');

        c.width = 64;
        c.height = 64;

        const ctx = c.getContext('2d');

        ctx.fillStyle = `hsl(${(i * 37) % 360} 70% 50%)`;
        ctx.beginPath();
        ctx.arc(32, 32, 20 + (i % 10), 0, Math.PI * 2);
        ctx.fill();
        // the index as ink, so every url is a distinct png (hue and
        // radius alone repeat every 360)
        ctx.fillStyle = '#000';
        ctx.font = '10px monospace';
        ctx.fillText(String(i), 2, 12);

        return c.toDataURL('image/png');
      };
      const vectorUrl = (i) =>
        'data:image/svg+xml;utf8,' +
        encodeURIComponent(
          `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><circle cx="32" cy="32" r="${20 + (i % 10)}" fill="hsl(${(i * 37) % 360} 70% 50%)"/></svg>`,
        );
      const POOL = 200;
      const NODES = 2000;
      const rasters = Array.from({ length: POOL }, (_, i) => rasterUrl(i));
      const vectors = Array.from({ length: 50 }, (_, i) => vectorUrl(i));
      const urlBytes = (u) => new TextEncoder().encode(u).byteLength;

      r.pool = {
        rasterUrls: POOL,
        rasterUrlBytesMedian: urlBytes(rasters[0]),
        vectorUrls: vectors.length,
        vectorUrlBytes: urlBytes(vectors[0]),
      };

      const elements = [];

      for (let i = 0; i < NODES; i++) {
        elements.push({
          data: { id: 'n' + i, img: rasters[i % POOL] },
          position: { x: (i % 50) * 40, y: Math.floor(i / 50) * 40 },
        });
      }

      const style = {
        nodes: {
          width: 30,
          height: 30,
          'background-image': { data: 'img' },
        },
      };

      // the registry instruments: the lifecycle the worker design would
      // mirror across the boundary
      const instrument = (cy) => {
        const reg = cy._store.images;
        const c = {
          acquire: 0,
          acquireUrlBytes: 0,
          release: 0,
          ready: 0,
          readyBytes: 0,
          freed: 0,
          promotions: 0,
        };
        const acquire = reg.acquire.bind(reg);
        const release = reg.release.bind(reg);
        const takeReady = reg.takeReady.bind(reg);
        const takeFreed = reg.takeFreed.bind(reg);
        const promote = reg.promote?.bind(reg);

        reg.acquire = (url, ...rest) => {
          c.acquire++;
          c.acquireUrlBytes += urlBytes(url);

          return acquire(url, ...rest);
        };
        reg.release = (id) => {
          c.release++;

          return release(id);
        };
        reg.takeReady = () => {
          const ids = takeReady();

          for (const id of ids) {
            const e = reg.get(id);
            const w = e?.data?.width ?? e?.width ?? 0;
            const h = e?.data?.height ?? e?.height ?? 0;

            c.ready++;
            c.readyBytes += w * h * 4;
          }

          return ids;
        };
        reg.takeFreed = () => {
          const ids = takeFreed();

          c.freed += ids.length;

          return ids;
        };

        if (promote != null) {
          reg.promote = (...a) => {
            c.promotions++;

            return promote(...a);
          };
        }

        return { reg, c, snapshot: () => ({ ...c }) };
      };
      const diff = (a, b) => {
        const d = {};

        for (const k of Object.keys(a)) {
          d[k] = b[k] - a[k];
        }

        return d;
      };
      const settled = async (cy, reg) => {
        // decodes are async; wait for the registry to drain and the
        // uploads to land on a frame
        for (let i = 0; i < 400; i++) {
          if (!reg.busy()) {
            break;
          }

          await new Promise((res) => setTimeout(res, 10));
        }

        await reg.whenSettled();
        cy.panBy({ x: 1, y: 0 });
        await nextRender(cy);
      };

      // -- load: 2,000 nodes over 200 distinct rasters -------------------
      // (the instance mounts without the image style, so the wrapped
      // registry sees the style apply that acquires every entry)
      const cy = cytoscape({
        container,
        elements,
        style: { nodes: { width: 30, height: 30 } },
      });
      const ins = instrument(cy);

      await cy.ready;
      await nextRender(cy);

      let t = now();

      cy.style(style);

      const applyMs = now() - t;

      await settled(cy, ins.reg);

      const loadMs = now() - t;
      const s0 = ins.snapshot();

      r.load = {
        nodes: NODES,
        distinctUrls: POOL,
        styleApplyMs: +applyMs.toFixed(1),
        wallMs: +loadMs.toFixed(0),
        ...s0,
        liveEntries: ins.reg.liveCount(),
      };

      if (s0.acquire !== NODES) {
        warnings.push(
          `images load: ${s0.acquire} acquires for ${NODES} image nodes`,
        );
      }

      if (s0.ready !== POOL) {
        warnings.push(
          `images load: ${s0.ready} rasters decoded for ${POOL} distinct urls`,
        );
      }

      // -- churn: 5% of the nodes swap url every frame ---------------------
      const nodes = cy.nodes();
      const per = Math.floor(NODES * 0.05);
      let cursor = 0;
      let restyled = 0;

      t = now();

      const c0 = ins.snapshot();

      for (let f = 0; f < FRAMES; f++) {
        for (let k = 0; k < per; k++) {
          const i = cursor++ % NODES;
          const node = nodes[i];

          // walk each node through the pool so entries keep freeing
          // and re-acquiring rather than saturating the registry
          node.data('img', rasters[(i + f + 1) % POOL]);
          restyled++;
        }

        await raf();
      }

      await settled(cy, ins.reg);

      const churnMs = now() - t;
      const cd = diff(c0, ins.snapshot());
      const perSec = (v) => +((v * 1000) / churnMs).toFixed(0);

      r.churnPoolHits = {
        frames: FRAMES,
        restyledNodes: restyled,
        wallMs: +churnMs.toFixed(0),
        ...cd,
        perSecond: {
          acquire: perSec(cd.acquire),
          release: perSec(cd.release),
          ready: perSec(cd.ready),
          freed: perSec(cd.freed),
          lifecycleMessages: perSec(
            cd.acquire + cd.release + cd.ready + cd.freed,
          ),
          acquireUrlBytes: perSec(cd.acquireUrlBytes),
          rasterBytes: perSec(cd.readyBytes),
        },
        liveEntries: ins.reg.liveCount(),
      };

      if (cd.acquire !== restyled) {
        warnings.push(
          `images churn: ${cd.acquire} acquires for ${restyled} restyled nodes`,
        );
      }

      cy.destroy();

      // -- churn, fresh urls: 1,000 nodes each on its own raster; every
      //    frame 50 of them move to a never-seen url, so each restyle is
      //    one acquire + one decode + one release + one free — the
      //    lifecycle worst case the boundary would carry
      const FRESH_NODES = 1000;
      const FRESH_FRAMES = 120;
      const FRESH_PER = 50;
      const fresh = Array.from(
        { length: FRESH_NODES + FRESH_FRAMES * FRESH_PER },
        (_, i) => rasterUrl(1000 + i),
      );
      const felements = [];

      for (let i = 0; i < FRESH_NODES; i++) {
        felements.push({
          data: { id: 'f' + i, img: fresh[i] },
          position: { x: (i % 50) * 40, y: Math.floor(i / 50) * 40 },
        });
      }

      const fcy = cytoscape({ container, elements: felements, style });
      const fins = instrument(fcy);

      await fcy.ready;
      await settled(fcy, fins.reg);

      const fnodes = fcy.nodes();
      let next = FRESH_NODES;
      let frestyled = 0;

      t = now();

      const f0 = fins.snapshot();

      for (let f = 0; f < FRESH_FRAMES; f++) {
        for (let k = 0; k < FRESH_PER; k++) {
          fnodes[(f * FRESH_PER + k) % FRESH_NODES].data('img', fresh[next++]);
          frestyled++;
        }

        await raf();
      }

      await settled(fcy, fins.reg);

      const freshMs = now() - t;
      const fd = diff(f0, fins.snapshot());
      const fPerSec = (v) => +((v * 1000) / freshMs).toFixed(0);

      r.churnFreshUrls = {
        frames: FRESH_FRAMES,
        restyledNodes: frestyled,
        wallMs: +freshMs.toFixed(0),
        ...fd,
        perSecond: {
          acquire: fPerSec(fd.acquire),
          release: fPerSec(fd.release),
          ready: fPerSec(fd.ready),
          freed: fPerSec(fd.freed),
          lifecycleMessages: fPerSec(
            fd.acquire + fd.release + fd.ready + fd.freed,
          ),
          acquireUrlBytes: fPerSec(fd.acquireUrlBytes),
          rasterBytes: fPerSec(fd.readyBytes),
        },
        liveEntries: fins.reg.liveCount(),
      };

      if (fd.ready !== frestyled || fd.freed !== frestyled) {
        warnings.push(
          `images fresh churn: ${fd.ready} decodes and ${fd.freed} frees for ${frestyled} restyles`,
        );
      }

      fcy.destroy();

      // -- promotion: 500 vector nodes, zoom 0.5 → 4 in 120 frames --------
      const velements = [];

      for (let i = 0; i < 500; i++) {
        velements.push({
          data: { id: 'v' + i, img: vectors[i % vectors.length] },
          position: { x: (i % 25) * 40, y: Math.floor(i / 25) * 40 },
        });
      }

      const vcy = cytoscape({ container, elements: velements, style });
      const vins = instrument(vcy);

      await vcy.ready;
      await settled(vcy, vins.reg);
      vcy.zoom({ level: 0.5, position: { x: 500, y: 400 } });
      await nextRender(vcy);

      const p0 = vins.snapshot();
      const statuses = { pending: 0, ready: 0, failed: 0 };

      for (let id = 0; id < 64; id++) {
        const e = vins.reg.get(id);

        if (e != null) {
          statuses[['pending', 'ready', 'failed'][e.status]]++;
        }
      }

      t = now();

      for (let f = 0; f < 120; f++) {
        vcy.zoom({
          level: 0.5 * Math.pow(8, (f + 1) / 120),
          position: { x: 500, y: 400 },
        });
        await raf();
      }

      // the meter runs 250 ms after the viewport settles (renderer's
      // schedulePromotionCheck), then the re-rasters decode
      await new Promise((res) => setTimeout(res, 400));
      await settled(vcy, vins.reg);

      const promoMs = now() - t;
      const pd = diff(p0, vins.snapshot());

      r.promotion = {
        vectorNodes: 500,
        distinctUrls: vectors.length,
        loadDecodes: p0.ready,
        loadRasterBytes: p0.readyBytes,
        entryStatusesAtLoad: statuses,
        zoom: '0.5 → 4',
        frames: 120,
        wallMs: +promoMs.toFixed(0),
        ...pd,
        rasterBytesPerSecond: +((pd.readyBytes * 1000) / promoMs).toFixed(0),
      };

      vcy.destroy();

      return { ...r, warnings };
    },
    { INSTRUMENTS, FRAMES },
  );
  out.warnings.push(...out.images.warnings);
  delete out.images.warnings;
  await browser.close();
}

// -- tweens and the force layout, both hosts -------------------------------
if (modes.includes('tweens')) {
  const { browser, page } = await openChromium();

  out.adapter ??= await adapterName(page);
  refuseSoftware(out.adapter);

  out.tweens = await page.evaluate(
    async ({ INSTRUMENTS }) => {
      const warnings = [];
      const env = new Function(
        'FRAMES',
        INSTRUMENTS +
          '; return { now, snap, delta, raf, nextRender, container };',
      )(0);
      const { now, snap, delta, nextRender, container } = env;
      const style = {
        nodes: { width: 12, height: 12, 'background-color': '#4a7dbd' },
        edges: { width: 1, 'line-color': '#bbb', opacity: 0.6 },
      };
      const json = await (
        await fetch('/debug/network-ndex-x-large.json')
      ).json();
      const columnar = cytoscape.toColumnarElements(json.elements);
      const wire = cytoscape.serializeElements(columnar);
      const result = {
        nodes: columnar.nodes.count,
        edges: columnar.edges.count,
      };

      const session = async (host) => {
        const renderer = host === 'worker' ? { worker: true } : undefined;
        const r = {};
        const cy = cytoscape({
          container,
          elements: cytoscape.deserializeElements(wire),
          style,
          renderer,
        });

        await cy.ready;
        cy.fit();
        await nextRender(cy);

        const nodeBytes = cy.nodes().length * 8; // one position column
        const row = async (name, run, opts = {}) => {
          const a = snap();
          const f0 = cy.stats().frames;
          const t = now();
          // the main thread's availability over the row (129.2): rAF
          // ticks that landed while the work ran — a synchronous run
          // counts none, a run on the worker (or the device) counts
          // one per frame
          let rafTicks = 0;
          let sampling = true;
          const tick = () => {
            rafTicks++;

            if (sampling) {
              requestAnimationFrame(tick);
            }
          };
          // and a 5 ms timer beside it: headless Chromium issues no
          // begin-frames while nothing draws, so a run that lands its
          // positions only at the end reads ~2 rAF ticks per 300 ms
          // free or held alike (measured 2026-09-18) — the timer reads
          // a held thread as zero
          let timerTicks = 0;
          const interval = setInterval(() => {
            timerTicks++;
          }, 5);

          requestAnimationFrame(tick);

          await run();

          sampling = false;
          clearInterval(interval);

          const wallMs = now() - t;
          const framesDrawn = cy.stats().frames - f0;
          const d = delta(a, snap());
          const traffic = host === 'worker' ? d.postBytes : d.upBytes;
          const perFrame =
            framesDrawn > 0 ? traffic / framesDrawn / nodeBytes : 0;

          r[name] = {
            wallMs: +wallMs.toFixed(0),
            framesDrawn,
            rafTicks,
            timerTicks,
            ...d,
            positionColumnsPerFrame: +perFrame.toFixed(2),
            msPerFrame: +(
              (host === 'worker' ? d.postMs : d.upMs) / Math.max(1, framesDrawn)
            ).toFixed(3),
          };

          if (opts.expectSpans && host === 'worker' && perFrame < 0.9) {
            warnings.push(
              `${host} ${name}: ${perFrame.toFixed(2)} position columns per frame, expected one`,
            );
          }

          if (opts.expectTicks && timerTicks < wallMs / 20) {
            warnings.push(
              `${host} ${name}: ${timerTicks} timer ticks over ${wallMs.toFixed(0)} ms — the main thread was held`,
            );
          }
        };

        // 1. a layout tween: every node's position over 1 s (the
        //    finisher's per-node animations — GPU-eligible on the
        //    same-thread host, CPU spans on the worker host)
        const layoutTween = (name) => async () => {
          const stopped = cy.promiseOn('layoutstop');

          cy.layout({
            name,
            animate: true,
            animationDuration: 1000,
            fit: false,
          }).run();
          await stopped;
        };

        await row('layout tween (grid)', layoutTween('grid'), {
          expectSpans: true,
        });
        await row('layout tween (circle)', layoutTween('circle'), {
          expectSpans: true,
        });

        // 2. a paint tween: every node's opacity over 1 s
        await row('paint tween (opacity)', async () => {
          await cy
            .nodes()
            .animate({ style: { opacity: 0.3 }, duration: 1000 })
            .promise?.();
          await new Promise((res) => setTimeout(res, 1100));
        });

        // 3. the force layout, silent (`animate: true` lands a tween at
        //    the end) and streaming (`animateLive`), iteration-capped so
        //    the CPU executor's run is bounded on this fixture
        for (const [name, extra] of [
          ['force (animate)', { animate: true }],
          ['force (animateLive)', { animateLive: true }],
        ]) {
          await row(
            name,
            async () => {
              const stopped = cy.promiseOn('layoutstop');

              cy.layout({
                name: 'force',
                iterations: 60,
                fit: false,
                ...extra,
              }).run();
              await stopped;
            },
            // since 129.2 the worker host integrates on its own device
            // (item 51's force deferral closed): no position span
            // crosses per frame under either host, so the row asserts
            // its rAF ticks instead — the main thread ticking through
            // the run is what the round bought
            { expectSpans: false, expectTicks: true },
          );
        }

        cy.destroy();

        return r;
      };

      for (const host of ['same-thread', 'worker']) {
        result[host] = await session(host);
      }

      return { ...result, warnings };
    },
    { INSTRUMENTS },
  );
  out.warnings.push(...out.tweens.warnings);
  delete out.tweens.warnings;
  await browser.close();
}

// -- fonts: a worker FontFaceSet.load spike, per engine --------------------
if (modes.includes('fonts')) {
  // the worker body: raster before and after registering the face
  const WORKER = `
    const draw = (font) => {
      const c = new OffscreenCanvas(480, 80);
      const ctx = c.getContext('2d');

      ctx.font = font;
      ctx.fillStyle = '#000';
      ctx.fillText('Hamburgefonstiv 0123', 4, 56);

      const w = ctx.measureText('Hamburgefonstiv 0123').width;
      const d = ctx.getImageData(0, 0, 480, 80).data;
      let ink = 0;

      for (let i = 3; i < d.length; i += 4) {
        if (d[i] > 0) ink++;
      }

      return { advance: +w.toFixed(2), inkPx: ink };
    };

    self.onmessage = async (e) => {
      const { url } = e.data;
      const out = {
        fontsApi: typeof self.fonts,
        fontFace: typeof FontFace,
        offscreen2d: typeof OffscreenCanvas,
        inheritedSize: typeof self.fonts === 'object' ? self.fonts.size : null,
      };

      try {
        out.before = draw('40px "Probe Sans 51"');
        out.serif = draw('40px serif');

        const t = performance.now();
        const face = new FontFace('Probe Sans 51', 'url(' + url + ')');

        self.fonts.add(face);
        await face.load();
        out.loadMs = +(performance.now() - t).toFixed(1);
        out.status = face.status;
        out.check = self.fonts.check('40px "Probe Sans 51"');
        out.after = draw('40px "Probe Sans 51"');
        await self.fonts.ready;
        out.afterReady = draw('40px "Probe Sans 51"');
        await new Promise((res) => setTimeout(res, 50));
        out.afterTask = draw('40px "Probe Sans 51"');

        // a face from bytes rather than a url
        const bytes = await (await fetch(url)).arrayBuffer();
        const face2 = new FontFace('Probe Sans 51b', bytes);

        self.fonts.add(face2);
        await face2.load();
        out.bytesStatus = face2.status;
        out.afterBytes = draw('40px "Probe Sans 51b"');
        out.afterBytesAdvance = out.afterBytes.advance;
      } catch (err) {
        out.error = String(err);
      }

      self.postMessage(out);
    };
  `;
  const fontProbe = async (page) =>
    await page.evaluate(
      async ({ WORKER, fontUrl }) => {
        const r = {};

        // the page's reference raster: the same woff2 registered under a
        // family name no system font can answer to (Open Sans itself is
        // installed on the benchmark box, which would let a worker's
        // fallback pass for the page's face)
        const pageFace = new FontFace('Probe Sans 51', `url(${fontUrl})`);

        document.fonts.add(pageFace);
        await pageFace.load();

        const draw = (font) => {
          const c = document.createElement('canvas');

          c.width = 480;
          c.height = 80;

          const ctx = c.getContext('2d');

          ctx.font = font;
          ctx.fillStyle = '#000';
          ctx.fillText('Hamburgefonstiv 0123', 4, 56);

          const w = ctx.measureText('Hamburgefonstiv 0123').width;
          const d = ctx.getImageData(0, 0, 480, 80).data;
          let ink = 0;

          for (let i = 3; i < d.length; i += 4) {
            if (d[i] > 0) ink++;
          }

          return { advance: +w.toFixed(2), inkPx: ink };
        };

        r.page = {
          probeFace: draw('40px "Probe Sans 51"'),
          serif: draw('40px serif'),
          check: document.fonts.check('40px "Probe Sans 51"'),
        };

        const url = URL.createObjectURL(
          new Blob([WORKER], { type: 'text/javascript' }),
        );
        const worker = new Worker(url);

        r.worker = await new Promise((res) => {
          worker.onmessage = (e) => res(e.data);
          worker.onerror = (e) => res({ error: e.message });
          worker.postMessage({ url: fontUrl });
        });
        worker.terminate();

        const same = (a, b) =>
          a != null && b != null && Math.abs(a.advance - b.advance) < 0.5;

        r.verdict = {
          workerFellBackBeforeLoad:
            r.worker.before != null && !same(r.worker.before, r.page.probeFace),
          faceAppliesAfterLoad: same(r.worker.after, r.page.probeFace),
          faceAppliesAfterReady: same(r.worker.afterReady, r.page.probeFace),
          faceAppliesAfterTask: same(r.worker.afterTask, r.page.probeFace),
          bytesFaceApplies: same(r.worker.afterBytes, r.page.probeFace),
        };

        return r;
      },
      { WORKER, fontUrl: `${origin}${FONT_PATH}` },
    );

  out.fonts = {};

  for (const [name, engine, opts] of [
    ['chromium', chromium, { channel: 'chromium' }],
    ['webkit', webkit, {}],
  ]) {
    let browser;

    try {
      browser = await engine.launch({ headless: true, ...opts });

      const page = await browser.newPage();

      page.on('pageerror', (err) => console.error(`[${name}] ${err.message}`));
      await page.goto(PAGE);
      out.fonts[name] = await fontProbe(page);
      out.fonts[name].version = browser.version();
    } catch (err) {
      out.fonts[name] = { error: String(err.message ?? err) };
    } finally {
      await browser?.close();
    }

    const v = out.fonts[name].verdict;

    if (v != null && !v.workerFellBackBeforeLoad) {
      out.warnings.push(
        `${name}: the worker's pre-load raster already matched the page's — the control did not move`,
      );
    }
  }
}

server.close();

console.log(`\n== worker-host deferrals (adapter: ${out.adapter ?? 'n/a'}) ==`);
console.log(JSON.stringify(out, null, 1));
