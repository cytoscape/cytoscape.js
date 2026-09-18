// Ledger items 35 and 36 (measured 2026-09-18): the scale ceiling and
// the VRAM price, on a real adapter through the built UMD bundle.
//
//   npm run build
//   node benchmark/scale-ceiling.mjs                      # the bisect: 1M, 2M, 5M edges
//   node benchmark/scale-ceiling.mjs --sizes 250000:1000000,500000:2000000
//   node benchmark/scale-ceiling.mjs --price               # bytes per node / edge / label
//   node benchmark/scale-ceiling.mjs --inject              # item 36: an allocation failure mid-session
//   node benchmark/scale-ceiling.mjs --oom                 # item 36: real VRAM exhaustion, then a load
//   node benchmark/scale-ceiling.mjs --allow-software
//
// Every scene runs in a *fresh browser process* with its own timeout, so
// a scene that hangs or takes the GPU process down is a row of the table
// ("hang" / "crash") rather than a wedged run.  The instruments are the
// platform's own entry points, patched in-page before the instance
// exists: `GPUDevice.createBuffer` / `createTexture` (bytes by label,
// live bytes via `destroy`), `GPUAdapter.requestDevice` (to reach the
// device for `uncapturederror` and `lost`, and — under `--inject` — to
// arm a deliberately invalid allocation), plus `window.onerror`,
// `unhandledrejection` and the core's own `error` event.  A scene is
// built as a columnar payload in-page (random positions, uniform random
// endpoints, `n = m / 4` unless the size says otherwise) so no JSON of
// millions of objects is parsed first — the subject is the store and the
// renderer, not the parser.
//
// Phases, each timed and each a place the run can die: `init` (the
// synchronous `cytoscape()` call: ingest + style apply), `ready` (device
// acquisition + the mirror's full allocation), `frame` (the first drawn
// frame: cull, curve blob, labels), `fit` (a second frame after
// `cy.fit()`), `pick` (`cy.pick()` at the container centre).  The bytes
// table splits allocations by label prefix — the mirror's per-column
// buffers, the four blobs, the cull scratch, the glyph buffer and atlas,
// the pick tile, the frame targets — so the per-element price is a
// difference between two measured sizes, not a number read off the
// column specs.
//
// Refuses a software adapter unless told not to: a SwiftShader ceiling is
// a host-memory ceiling and says nothing about the card.

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(DIR, '..');
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, fallback) => {
  const i = args.indexOf(name);

  return i >= 0 && i + 1 < args.length ? args[i + 1] : fallback;
};
const allowSoftware = flag('--allow-software');
const mode = flag('--price')
  ? 'price'
  : flag('--inject')
    ? 'inject'
    : flag('--oom')
      ? 'oom'
      : 'bisect';
const SCENE_TIMEOUT_MS = Number(opt('--timeout', 300000));
const labels = flag('--labels');

/** `nodes:edges` pairs, or a bare edge count with n = m / 4 */
const parseSizes = (spec) =>
  spec.split(',').map((s) => {
    const [a, b] = s.split(':').map(Number);

    return b == null ? { n: Math.round(a / 4), m: a } : { n: a, m: b };
  });

const sizes =
  mode === 'price'
    ? parseSizes(opt('--sizes', '10000:30000,100000:300000,1000000:3000000'))
    : mode === 'bisect'
      ? parseSizes(opt('--sizes', '1000000,2000000,5000000'))
      : parseSizes(opt('--sizes', '20000:60000'));

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

const PAGE = `http://127.0.0.1:${server.address().port}/playwright-page/index.html`;

const launch = () =>
  chromium.launch({
    channel: 'chromium',
    headless: true,
    args: [
      '--enable-unsafe-webgpu',
      '--enable-precise-memory-info',
      ...(process.platform === 'linux'
        ? ['--use-gl=angle', '--use-angle=vulkan', '--enable-features=Vulkan']
        : []),
    ],
  });

/** The in-page half: instruments, the scene, the phases. */
const scene = async ({ n, m, mode, labels, sceneIndex, oomCap }) => {
  const now = () => performance.now();
  const out = { n, m, phases: {}, errors: [], events: [], alloc: {} };
  const heap = () => {
    const mem = performance.memory;

    return mem ? +(mem.usedJSHeapSize / 1e6).toFixed(0) : null;
  };

  // -- the instruments ---------------------------------------------
  const BYTES_PER_TEXEL = { r8unorm: 1, r32uint: 4, depth24plus: 4 };
  const alloc = new Map(); // label group → { calls, bytes, live }
  const groupOf = (label) => {
    const l = label ?? '(unlabelled)';

    if (/^cy-gpu:(node|edge)\./.test(l)) {
      return l.replace(/^cy-gpu:((node|edge)\.[^ ]*).*$/, 'mirror:$1');
    }

    return l.replace(/-\d+$/, '');
  };
  const record = (label, bytes, obj) => {
    const g = groupOf(label);
    const row = alloc.get(g) ?? { calls: 0, bytes: 0, live: 0, max: 0 };

    row.calls++;
    row.bytes += bytes;
    row.live += bytes;
    row.max = Math.max(row.max, bytes);
    alloc.set(g, row);

    if (obj != null) {
      const destroy = obj.destroy;

      obj.destroy = function () {
        row.live -= bytes;
        bytes = 0;

        return destroy.call(this);
      };
    }
  };
  const createBuffer = GPUDevice.prototype.createBuffer;
  let injectArmed = null;

  GPUDevice.prototype.createBuffer = function (desc) {
    let d = desc;

    if (injectArmed != null && injectArmed.test(desc.label ?? '')) {
      // the failure the library would see from an out-of-memory
      // allocation: an invalid buffer object plus an uncaptured error
      // (WebGPU never throws for either), produced here by asking for
      // more than the device can address
      d = { ...desc, size: 2 ** 40 };
      injectArmed = null;
      out.events.push(`injected an invalid allocation at ${desc.label}`);
    }

    let buf;

    try {
      buf = createBuffer.call(this, d);
    } catch (err) {
      out.errors.push(
        `createBuffer(${desc.label}, ${desc.size}) threw: ${err.message}`,
      );
      throw err;
    }

    record(desc.label, desc.size, buf);

    return buf;
  };

  const createTexture = GPUDevice.prototype.createTexture;

  GPUDevice.prototype.createTexture = function (desc) {
    const tex = createTexture.call(this, desc);
    const size = desc.size;
    const w = Array.isArray(size) ? size[0] : size.width;
    const h = Array.isArray(size) ? size[1] : (size.height ?? 1);
    const bpp = BYTES_PER_TEXEL[desc.format] ?? 4;

    record(desc.label, w * h * bpp, tex);

    return tex;
  };

  let device = null;
  const requestDevice = GPUAdapter.prototype.requestDevice;

  GPUAdapter.prototype.requestDevice = async function (desc) {
    const dev = await requestDevice.call(this, desc);

    device = dev;
    out.limits = {
      maxBufferSize: dev.limits.maxBufferSize,
      maxStorageBufferBindingSize: dev.limits.maxStorageBufferBindingSize,
    };
    dev.addEventListener('uncapturederror', (e) => {
      const err = e.error;
      const kind =
        err instanceof GPUOutOfMemoryError
          ? 'out-of-memory'
          : err instanceof GPUValidationError
            ? 'validation'
            : 'internal';

      out.errors.push(`uncapturederror[${kind}]: ${err.message.slice(0, 300)}`);
    });
    dev.lost.then((info) => {
      out.events.push(`device lost (${info.reason}): ${info.message}`);
    });

    return dev;
  };

  window.addEventListener('error', (e) => {
    out.errors.push(`window error: ${e.message}`);
  });
  window.addEventListener('unhandledrejection', (e) => {
    out.errors.push(`unhandled rejection: ${e.reason?.message ?? e.reason}`);
  });

  // -- the payload ---------------------------------------------------
  let t = now();
  const positions = new Float32Array(n * 2);
  const side = Math.ceil(Math.sqrt(n)) * 50;

  for (let i = 0; i < n; i++) {
    positions[i * 2] = Math.random() * side;
    positions[i * 2 + 1] = Math.random() * side;
  }

  const sources = new Uint32Array(m);
  const targets = new Uint32Array(m);

  for (let j = 0; j < m; j++) {
    sources[j] = Math.floor(Math.random() * n);
    targets[j] = Math.floor(Math.random() * n);
  }

  const nodes = { count: n, positions };

  if (labels) {
    // a dictionary column: every node labelled, 1,000 distinct strings,
    // so the atlas holds a bounded glyph set and the glyph buffer holds
    // one entry per drawn character
    const dict = Array.from({ length: 1000 }, (_, i) => `node ${i}`);
    const indices = new Uint32Array(n);

    for (let i = 0; i < n; i++) {
      indices[i] = 1 + (i % 1000);
    }

    nodes.data = { name: { dict, indices } };
  }

  const elements = {
    columnar: true,
    nodes,
    edges: { count: m, sources, targets },
  };

  out.phases.payloadMs = +(now() - t).toFixed(0);
  out.heapAfterPayloadMB = heap();

  const style = {
    nodes: {
      width: 12,
      height: 12,
      'background-color': '#4a7dbd',
      ...(labels ? { label: { data: 'name' }, 'font-size': 10 } : {}),
    },
    edges: { width: 1, 'line-color': '#bbb', opacity: 0.6 },
  };
  const container = document.getElementById('cytoscape');
  const nextRender = (cy) => new Promise((r) => cy.one('render', r));
  const withTimeout = (p, ms, what) =>
    Promise.race([
      p,
      new Promise((_, rej) =>
        setTimeout(
          () => rej(new Error(`${what} did not complete in ${ms} ms`)),
          ms,
        ),
      ),
    ]);
  const phase = async (name, fn) => {
    const t0 = now();

    console.log(`phase ${name} start`);

    try {
      await fn();
      out.phases[name + 'Ms'] = +(now() - t0).toFixed(0);
    } catch (err) {
      out.phases[name + 'Ms'] = +(now() - t0).toFixed(0);
      out.failedAt = name;
      out.errors.push(`${name} threw: ${err.message.slice(0, 300)}`);
      throw err;
    }
  };

  let cy;

  try {
    await phase('init', () => {
      cy = cytoscape({ container, elements, style });
      cy.on('error', (e, msg) => {
        out.errors.push(`cy error event: ${String(msg).slice(0, 300)}`);
      });
      cy.on('devicelost', () => out.events.push('cy devicelost'));
      cy.on('devicerestored', () => out.events.push('cy devicerestored'));
    });
    out.heapAfterInitMB = heap();
    await phase('ready', () => withTimeout(cy.ready, 120000, 'ready'));
    await phase('frame', () =>
      withTimeout(nextRender(cy), 120000, 'first frame'),
    );
    await phase('fit', async () => {
      const before = cy.stats().frames;

      cy.fit();

      // wait for a drawn frame after the fit (a render event can land
      // before a listener attaches, so poll the frame counter instead)
      for (let f = 0; f < 600 && cy.stats().frames === before; f++) {
        await new Promise((r) => requestAnimationFrame(r));
      }

      out.fitDrew = cy.stats().frames > before;
    });
    await phase('pick', async () => {
      const r = container.getBoundingClientRect();

      out.pick = await withTimeout(
        cy.pick(r.width / 2, r.height / 2),
        60000,
        'pick',
      );
      out.pick = out.pick == null ? null : out.pick.length;
    });

    if (mode === 'inject') {
      // item 36: arm one invalid allocation on the next mirror growth,
      // then grow the graph so the mirror reallocates — what happens to
      // the frame loop, the instance and the caller afterwards?
      injectArmed = /^cy-gpu:node\.position/;

      const before = cy.stats().frames;

      await phase('inject', async () => {
        const add = [];

        for (let i = 0; i < n + 1; i++) {
          add.push({
            group: 'nodes',
            data: { id: `x${i}` },
            position: { x: i, y: i },
          });
        }

        cy.add(add);

        for (let f = 0; f < 30; f++) {
          await new Promise((r) => requestAnimationFrame(r));
        }

        out.inject = {
          armedStill: injectArmed != null,
          framesAfter: cy.stats().frames - before,
          nodes: cy.nodes().length,
        };
        // does the instance still answer, and can it still export?
        try {
          const png = await withTimeout(cy.png({ scale: 0.1 }), 30000, 'png');

          out.inject.pngBytes = typeof png === 'string' ? png.length : png.size;
        } catch (err) {
          out.inject.pngError = err.message.slice(0, 200);
        }
      });
    }

    if (mode === 'oom') {
      // item 36's real failure: with the scene up, take the scene's own
      // device to the wall 256 MiB at a time (each chunk written, so a
      // lazy allocator commits it) and record what the instance sees —
      // an out-of-memory error scope (the graceful path), an uncaptured
      // error, a device loss, or the GPU process going away.
      const chunk = device.limits.maxBufferSize;
      const hog = [];
      const framesBefore = cy.stats().frames;
      // one full-size fill, reused: a chunk touched in one page stays
      // uncommitted on an overcommitting driver (measured: 32 GiB of
      // 256 MiB chunks "allocated" on an 8 GiB card with a 4 KiB write
      // each and never an error), so every byte is written
      const fill = new Uint8Array(chunk);

      out.hog = { chunkMiB: chunk / 2 ** 20 };

      for (let i = 0; i < oomCap; i++) {
        device.pushErrorScope('out-of-memory');

        const b = device.createBuffer({
          label: `hog-${i}`,
          size: chunk,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });

        device.queue.writeBuffer(b, 0, fill);
        hog.push(b);

        const err = await device.popErrorScope();

        try {
          await device.queue.onSubmittedWorkDone();
        } catch (e) {
          out.errors.push(
            `onSubmittedWorkDone rejected at chunk ${i}: ${e.message}`,
          );
          break;
        }
        const GiB = +(((i + 1) * chunk) / 2 ** 30).toFixed(2);

        console.log(
          `hog ${i}: ${GiB} GiB ${err ? err.constructor.name + ': ' + err.message.slice(0, 120) : 'ok'}`,
        );

        if (err != null) {
          out.hog.oom = {
            chunk: i,
            GiB,
            kind: err.constructor.name,
            message: err.message.slice(0, 200),
          };
          break;
        }

        // a frame between chunks, so the scene's own allocations and
        // uploads run against the shrinking budget
        cy.panBy({ x: 1, y: 0 });
        await new Promise((r) => requestAnimationFrame(r));
      }

      out.hog.chunks = hog.length;
      out.hog.GiB = +((hog.length * chunk) / 2 ** 30).toFixed(2);

      for (let f = 0; f < 30; f++) {
        cy.panBy({ x: 1, y: 0 });
        await new Promise((r) => requestAnimationFrame(r));
      }

      out.hog.framesAfter = cy.stats().frames - framesBefore;
      out.hog.gpuFrameMsAfter = cy.stats().gpuFrameMs;

      for (const b of hog) {
        b.destroy();
      }

      for (let f = 0; f < 10; f++) {
        cy.panBy({ x: 1, y: 0 });
        await new Promise((r) => requestAnimationFrame(r));
      }

      out.hog.gpuFrameMsAfterRelease = cy.stats().gpuFrameMs;
    }
  } catch {
    // recorded in out.failedAt / out.errors
  }

  // let any deferred uncapturederror events arrive before reading
  if (device != null) {
    try {
      await withTimeout(
        device.queue.onSubmittedWorkDone(),
        30000,
        'queue drain',
      );
    } catch (err) {
      out.errors.push(err.message);
    }
  }

  await new Promise((r) => setTimeout(r, 200));

  const st = cy?.stats?.();

  out.stats = st
    ? {
        frames: st.frames,
        cpuFrameMs: +st.cpuFrameMs.toFixed(2),
        gpuFrameMs: +st.gpuFrameMs.toFixed(2),
        uploadedMB: +(st.uploadedBytes / 1e6).toFixed(1),
      }
    : null;
  out.heapAfterMB = heap();

  let total = 0;
  let live = 0;

  for (const [g, row] of [...alloc.entries()].sort(
    (a, b) => b[1].bytes - a[1].bytes,
  )) {
    total += row.bytes;
    live += row.live;
    out.alloc[g] = {
      calls: row.calls,
      MB: +(row.bytes / 1e6).toFixed(2),
      liveMB: +(row.live / 1e6).toFixed(2),
      maxMB: +(row.max / 1e6).toFixed(2),
    };
  }

  out.allocTotalMB = +(total / 1e6).toFixed(1);
  out.allocLiveMB = +(live / 1e6).toFixed(1);
  out.sceneIndex = sceneIndex;

  return out;
};

const adapterOf = async (page) =>
  page.evaluate(async () => {
    const a = await navigator.gpu.requestAdapter();
    const i = a?.info;

    return `${i?.vendor ?? '?'} ${i?.architecture ?? ''} ${i?.description ?? ''}`.trim();
  });

const results = [];
let adapterName = null;

for (let i = 0; i < sizes.length; i++) {
  const { n, m } = sizes[i];
  const browser = await launch();
  const page = await (
    await browser.newContext({ viewport: { width: 1280, height: 800 } })
  ).newPage();
  const pageErrors = [];
  let crashed = null;

  page.on('pageerror', (err) => pageErrors.push(err.message));
  page.on('console', (msg) => {
    if (flag('--verbose')) {
      console.log(`[page] ${msg.text()}`);
    }
  });
  page.on('crash', () => {
    crashed = 'page crashed';
  });

  const t0 = performance.now();
  let row;

  try {
    await page.goto(PAGE);
    adapterName ??= await adapterOf(page);

    if (!allowSoftware && /swiftshader|software|llvmpipe/i.test(adapterName)) {
      console.error(
        `adapter "${adapterName}" is a software rasterizer; pass --allow-software to measure it anyway`,
      );
      process.exit(1);
    }

    row = await Promise.race([
      page.evaluate(scene, {
        n,
        m,
        mode,
        labels,
        sceneIndex: i,
        oomCap: Number(opt('--oom-cap', 64)),
      }),
      new Promise((_, rej) =>
        setTimeout(
          () => rej(new Error(`scene timed out after ${SCENE_TIMEOUT_MS} ms`)),
          SCENE_TIMEOUT_MS,
        ),
      ),
    ]);
  } catch (err) {
    row = {
      n,
      m,
      outcome: crashed ?? (/timed out/.test(err.message) ? 'hang' : 'crash'),
      error: err.message.slice(0, 400),
    };
  }

  row.wallS = +((performance.now() - t0) / 1000).toFixed(1);
  row.pageErrors = pageErrors;
  const frameRejected = (row.errors ?? []).some((e) =>
    /Invalid CommandBuffer from CommandEncoder "cy-gpu:frame"/.test(e),
  );

  row.outcome ??= row.failedAt
    ? `failed at ${row.failedAt}`
    : frameRejected
      ? 'blank — the frame was rejected by the device'
      : 'rendered';
  results.push(row);
  console.log(
    `\n== ${n} nodes × ${m} edges (${mode}${labels ? ', labels' : ''}) — ${row.outcome} in ${row.wallS} s ==`,
  );

  if (flag('--json')) {
    console.log(JSON.stringify(row, null, 1));
  } else {
    const { alloc, ...rest } = row;

    console.log(JSON.stringify(rest, null, 1));

    if (alloc != null) {
      console.log(
        'allocations by label group (MB requested / live / largest single):',
      );

      for (const [g, r] of Object.entries(alloc)) {
        if (r.MB >= 0.05) {
          console.log(
            `  ${g.padEnd(40)} ${String(r.calls).padStart(4)} calls  ${String(r.MB).padStart(9)}  ${String(r.liveMB).padStart(9)}  ${String(r.maxMB).padStart(9)}`,
          );
        }
      }
    }
  }

  try {
    await browser.close();
  } catch {
    // a crashed browser is already gone
  }
}

server.close();
console.log(`\nadapter: ${adapterName}`);

process.exit(0);
