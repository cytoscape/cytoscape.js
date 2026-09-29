// Round 103's browser measurement: time to the first frame and to the
// whole graph, monolithic against `cy.load()`, on a real adapter through
// the built UMD bundle — the round-67 decomposition's instrument, with the
// load path as the new row.
//
//   npm run build
//   node benchmark/progressive-browser.mjs                  # k = 10, repeat 3, no link model
//   node benchmark/progressive-browser.mjs --k 5,10,20 --repeat 5
//   node benchmark/progressive-browser.mjs --mbps 100       # chunks arrive over a 100 Mbit/s link
//   node benchmark/progressive-browser.mjs --compare        # + a pixel diff of the final frames
//   node benchmark/progressive-browser.mjs --allow-software
//
// The fixture is ndex-x-large with the harness's production sheet, fetched
// and cut into chunks in the page *before* the timed region (the network
// is modelled, not measured): every payload is a wire buffer — the
// monolithic one whole, each chunk with its cut edges as node references
// (round 103.2).  Two chunk shapes: **nodes first** (one chunk of every
// node, then the edges — the first frame is the whole graph's layout,
// and the one fit is the monolithic fit) and **vertex-closed** (nodes in
// payload order, an edge with its later endpoint).
//
// `--mbps N` models the link: payload byte i is available at
// `i / (N Mbit/s)` after t0 — the monolithic buffer after all of it, chunk
// j after the bytes of chunks 0..j.  Without it every chunk is in hand at
// t0, which isolates the library's own overhead.
//
// Per scene, each in a fresh browser process (a first frame compiles its
// pipelines, and a warm process would hide that):
//
//   * `first` — t0 to the first frame carrying elements: for the
//     monolithic load, the first `render` after `cy.ready`; for the load,
//     `cy.ready` itself (which is what the round made it mean).
//   * `complete` — t0 to the whole graph in the model: the factory's
//     return for the monolithic load, the load's promise otherwise.
//   * `whole` — t0 to the first frame after completion: the whole graph
//     on screen.
//   * `frames` — frames drawn between t0 and completion (the partial
//     graph the user saw); `mirror` — GPU column-mirror (re)allocations
//     (`cy-gpu:node.*` / `cy-gpu:edge.*` buffers) and their megabytes,
//     the renderer's reallocation cadence under growth.
//
// Refuses a software adapter unless told not to.

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, resolve, extname } from 'node:path';
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
const KS = opt('--k', '10').split(',').map(Number);
const REPEAT = Number(opt('--repeat', 3));
const MBPS = opt('--mbps', null) == null ? null : Number(opt('--mbps'));
const allowSoftware = flag('--allow-software');
const compare = flag('--compare');

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

const PAGE = `http://127.0.0.1:${server.address().port}/playwright-page/index.html`;

const launch = () =>
  chromium.launch({
    channel: 'chromium',
    headless: true,
    args: [
      '--enable-unsafe-webgpu',
      ...(process.platform === 'linux'
        ? ['--use-gl=angle', '--use-angle=vulkan', '--enable-features=Vulkan']
        : []),
    ],
  });

/** The in-page half: the payloads, then one timed scene. */
const scene = async ({ mode, k, mbps, shot, reserve }) => {
  const now = () => performance.now();
  const json = (await (await fetch('/debug/network-ndex-x-large.json')).json())
    .elements;
  const NET = 'ndex-x-large';
  const style = styles.sheet('production', NET, json, networks[NET]);
  const nodes = json.nodes;
  const edges = json.edges.map((e, i) => ({
    ...e,
    data: { id: 'e' + i, ...e.data },
  }));

  const chunksOf = () => {
    if (mode === 'nodes-first') {
      const out = [{ nodes, edges: [] }];
      const per = Math.ceil(edges.length / (k - 1));

      for (let i = 0; i < edges.length; i += per) {
        out.push({ nodes: [], edges: edges.slice(i, i + per) });
      }

      return out;
    }

    const per = Math.ceil(nodes.length / k);
    const chunkOf = new Map();
    const out = Array.from({ length: k }, () => ({ nodes: [], edges: [] }));

    nodes.forEach((n, i) => {
      chunkOf.set(n.data.id, Math.floor(i / per));
      out[Math.floor(i / per)].nodes.push(n);
    });

    for (const e of edges) {
      out[
        Math.max(chunkOf.get(e.data.source), chunkOf.get(e.data.target))
      ].edges.push(e);
    }

    return out;
  };

  const payloads =
    mode === 'monolithic'
      ? [cytoscape.serializeElements({ nodes, edges })]
      : chunksOf().map((c) =>
          cytoscape.serializeElements(
            cytoscape.toColumnarElements(c, { refs: true }),
          ),
        );
  const bytes = payloads.reduce((n, p) => n + p.byteLength, 0);
  // when each payload's last byte arrives, ms after t0
  const arrive = [];
  let acc = 0;

  for (const p of payloads) {
    acc += p.byteLength;
    arrive.push(mbps == null ? 0 : (acc * 8) / (mbps * 1000));
  }

  // the mirror's (re)allocations, counted from here on
  const mirror = { calls: 0, bytes: 0 };
  const createBuffer = GPUDevice.prototype.createBuffer;

  GPUDevice.prototype.createBuffer = function (desc) {
    if (/^cy-gpu:(node|edge)\./.test(desc.label ?? '')) {
      mirror.calls++;
      mirror.bytes += desc.size;
    }

    return createBuffer.call(this, desc);
  };

  const container = document.getElementById('cytoscape');
  const at = (ms, t0) =>
    new Promise((r) => setTimeout(r, Math.max(0, t0 + ms - now())));
  let frames = 0;
  let completeAt = null;
  const out = { mode, k, bytes, chunks: payloads.length };

  await new Promise((r) => requestAnimationFrame(r));

  const t0 = now();
  let cy;

  if (mode === 'monolithic') {
    await at(arrive[0], t0);
    cy = cytoscape({ container, elements: payloads[0], style });
    completeAt = now();
    out.complete = completeAt - t0;
    cy.on('render', () => frames++);
    await cy.ready;
    await new Promise((r) => cy.one('render', r));
    out.first = now() - t0;
    out.whole = out.first;
    // the load path fits once; the monolithic load is fitted after
    // (outside the timed region) so the final frames compare
    cy.fit();
  } else {
    cy = cytoscape({ container, style });

    // the whole graph on screen: the first frame after the last chunk
    // landed (it may draw before the load's promise settles)
    let lastIn = false;
    let wholeAt = null;
    let onWhole = null;

    cy.on('loadchunk', (e) => {
      lastIn = e.progress.chunks === payloads.length;
    });
    cy.on('render', () => {
      if (completeAt == null) {
        frames++;
      }

      if (lastIn && wholeAt == null) {
        wholeAt = now();
        onWhole?.();
      }
    });

    async function* source() {
      for (let i = 0; i < payloads.length; i++) {
        await at(arrive[i], t0);
        yield payloads[i];
      }
    }

    if (reserve) {
      // probe only: pre-size the store, as a size hint would
      cy._store.reserve(nodes.length, edges.length);
    }

    const done = cy.load(source());

    cy.ready.then(() => {
      out.first = now() - t0;
    });
    await done;
    completeAt = now();
    out.complete = completeAt - t0;

    if (wholeAt == null) {
      await new Promise((r) => {
        onWhole = r;
      });
    }

    out.whole = wholeAt - t0;
  }

  out.frames = frames;
  out.mirrorAllocs = mirror.calls;
  out.mirrorMB = +(mirror.bytes / 1e6).toFixed(1);
  out.elements = cy.elements().length;

  if (shot) {
    // settle, then hand the final frame back for the pixel compare
    for (let i = 0; i < 5; i++) {
      await new Promise((r) => requestAnimationFrame(r));
    }
  }

  return out;
};

const adapterOf = async (page) =>
  page.evaluate(async () => {
    const a = await navigator.gpu.requestAdapter();
    const i = a?.info;

    return `${i?.vendor ?? '?'} ${i?.architecture ?? ''} ${i?.description ?? ''}`.trim();
  });

const median = (xs) => {
  const s = xs.filter((x) => x != null).sort((a, b) => a - b);

  return s.length === 0 ? null : s[Math.floor(s.length / 2)];
};

const runScene = async (params) => {
  const browser = await launch();

  try {
    const page = await (
      await browser.newContext({ viewport: { width: 1280, height: 800 } })
    ).newPage();
    const errors = [];

    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (flag('--verbose')) {
        console.log(`[page] ${msg.text()}`);
      }
    });
    await page.goto(PAGE);

    const adapter = await adapterOf(page);

    if (!allowSoftware && /swiftshader|software|llvmpipe/i.test(adapter)) {
      console.error(
        `adapter "${adapter}" is a software rasterizer; pass --allow-software to measure it anyway`,
      );
      process.exit(1);
    }

    await page.addScriptTag({ url: '/debug/networks.js' });
    await page.addScriptTag({ url: '/debug/styles.js' });

    const row = await page.evaluate(scene, params);
    const png = params.shot ? await page.screenshot() : null;

    if (errors.length > 0) {
      row.errors = errors;
    }

    return { row, png, adapter };
  } finally {
    await browser.close();
  }
};

const scenes = [{ mode: 'monolithic', k: 1 }];

for (const k of KS) {
  scenes.push({ mode: 'nodes-first', k }, { mode: 'vertex-closed', k });
}

let adapterName = null;
const rows = [];
const shots = {};

for (const s of scenes) {
  const samples = [];

  for (let r = 0; r < REPEAT; r++) {
    const shot = compare && r === 0 && s.mode !== 'vertex-closed';
    const { row, png, adapter } = await runScene({
      ...s,
      mbps: MBPS,
      shot,
      reserve: flag('--reserve'),
    });

    adapterName ??= adapter;
    samples.push(row);

    if (png != null) {
      shots[`${s.mode}-${s.k}`] = png;
    }
  }

  const pick = (key) => median(samples.map((x) => x[key]));
  const row = {
    ...s,
    first: pick('first'),
    complete: pick('complete'),
    whole: pick('whole'),
    frames: pick('frames'),
    mirrorAllocs: pick('mirrorAllocs'),
    mirrorMB: pick('mirrorMB'),
    bytes: samples[0].bytes,
    elements: samples[0].elements,
    errors: samples.flatMap((x) => x.errors ?? []),
  };

  rows.push(row);
}

const f = (x) => (x == null ? '   —' : x.toFixed(0).padStart(6));

console.log(
  `progressive ingest, browser — ${adapterName}; ${cpus()[0].model}, ` +
    `${Math.round(totalmem() / 2 ** 30)} GiB; built UMD; repeat ${REPEAT} ` +
    `(median); link ${MBPS == null ? 'none (all in hand at t0)' : MBPS + ' Mbit/s'}`,
);
console.log(
  'scene                     first  complete  whole  frames  mirror allocs (MB)  wire MB',
);

for (const r of rows) {
  const name = r.mode === 'monolithic' ? 'monolithic' : `${r.mode} k=${r.k}`;

  console.log(
    `${name.padEnd(24)} ${f(r.first)}  ${f(r.complete)}  ${f(r.whole)}  ${f(r.frames)}  ${f(r.mirrorAllocs)} (${r.mirrorMB})  ${(r.bytes / 1e6).toFixed(2)}` +
      (r.elements !== 484264 ? `  ELEMENTS ${r.elements}` : '') +
      (r.errors.length > 0 ? `  ERRORS ${r.errors.join('; ')}` : ''),
  );
}

if (compare) {
  const { PNG } = await import('pngjs');
  const base = PNG.sync.read(shots['monolithic-1']);

  for (const [name, png] of Object.entries(shots)) {
    if (name === 'monolithic-1') {
      continue;
    }

    const img = PNG.sync.read(png);
    let differ = 0;

    for (let i = 0; i < img.data.length; i += 4) {
      if (
        img.data[i] !== base.data[i] ||
        img.data[i + 1] !== base.data[i + 1] ||
        img.data[i + 2] !== base.data[i + 2]
      ) {
        differ++;
      }
    }

    console.log(
      `final frame, ${name} vs monolithic: ${differ} differing pixels of ${img.width * img.height}`,
    );
  }
}

server.close();
