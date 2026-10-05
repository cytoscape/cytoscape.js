import { test, expect } from '@playwright/test';
import { decodePng } from './lib/image-diff.mjs';

/*
Device limits and allocation failure (round 138, PLAN.md items 35–36),
in the browser: the limits every device is requested with, the boundary
`cy.add()` refuses to cross — read from `device.limits`, never a
hard-coded count — and the degradation order when a buffer does not fit
or the device refuses it.

Two instruments, both installed in the page before the instance exists:

- **Small limits.**  `withLimits` shadows the device's `limits` with an
  own property carrying a 16 KiB storage binding, so every ceiling the
  renderer and the model read is about a thousand slots — while the real
  device keeps its real limits, so nothing the spec does is itself
  invalid.  That is what lets a spec reach the boundary with 1,024
  nodes rather than 16.7 million (and keeps each scene small enough for
  SwiftShader, which draws a few thousand on-screen nodes at ~1 s a
  frame).
- **An injected refusal.**  `refuseNext` makes the next allocation with
  a given label ask for 2^40 bytes, which the device answers exactly as
  it answers exhaustion — an invalid buffer and an error, never a throw
  (the probe's `--inject`, item 36's first measurement).

The Node half — the growth rule, the message, every add path, the store
unchanged — is `test/gpu-fit.mjs`; the ledger's counting is
`test/modules/gpu-ledger.mjs`.
*/

const PAGE = 'http://127.0.0.1:3333/playwright-page/index.html';

const hasAdapter = async (page) =>
  page.evaluate(async () => {
    if (navigator.gpu == null) {
      return false;
    }

    return (await navigator.gpu.requestAdapter()) != null;
  });

/** Every device created from here on reports a 16 KiB storage binding. */
const withLimits = (page) =>
  page.evaluate(() => {
    const requestDevice = GPUAdapter.prototype.requestDevice;

    GPUAdapter.prototype.requestDevice = async function (desc) {
      const device = await requestDevice.call(this, desc);
      const limits = {};

      // WebIDL attributes are enumerable accessors on the prototype
      for (const key in device.limits) {
        limits[key] = device.limits[key];
      }

      limits.maxStorageBufferBindingSize = 16 * 1024;
      Object.defineProperty(device, 'limits', { value: limits });

      return device;
    };
  });

/** The next buffer created with this label asks for 2^40 bytes. */
const refuseNext = (page) =>
  page.evaluate(() => {
    const createBuffer = GPUDevice.prototype.createBuffer;

    window.__refuse = null;
    GPUDevice.prototype.createBuffer = function (desc) {
      if (window.__refuse != null && window.__refuse === desc.label) {
        window.__refuse = null;

        return createBuffer.call(this, { ...desc, size: 2 ** 40 });
      }

      return createBuffer.call(this, desc);
    };
  });

/** A labelled grid, and a `gpuerror` log on `window.__gpuerrors`. */
const makeScene = (page, { nodes = 0, labels = true, style = {} } = {}) =>
  page.evaluate(
    async ({ nodes, labels, style }) => {
      const els = [];

      for (let i = 0; i < nodes; i++) {
        els.push({
          data: { id: 'n' + i, label: 'label ' + i },
          position: { x: (i % 20) * 30, y: Math.floor(i / 20) * 30 },
        });
      }

      window.__gpuerrors = [];

      const cy = window.makeCy({
        elements: els,
        style: {
          nodes: {
            width: 10,
            height: 10,
            ...(labels ? { label: { data: 'label' } } : {}),
            ...style,
          },
        },
      });

      cy.on('gpuerror', (e, info) => window.__gpuerrors.push(info));
      await cy.ready;
    },
    { nodes, labels, style },
  );

/** `n` frames, each after a viewport nudge so every one draws. */
const drawFrames = (page, n = 10) =>
  page.evaluate(async (n) => {
    for (let i = 0; i < n; i++) {
      window.cy.panBy({ x: i % 2 === 0 ? 1 : -1, y: 0 });
      await new Promise((r) => requestAnimationFrame(() => r()));
    }

    await window.cy.renderer().device?.queue.onSubmittedWorkDone();
  }, n);

const stats = (page) =>
  page.evaluate(() => {
    const s = window.cy.stats();

    return {
      frames: s.frames,
      errors: s.gpu.errors,
      allocationFailures: s.gpu.allocationFailures,
      degraded: [...window.cy.renderer().degraded],
      gpuerrors: window.__gpuerrors,
    };
  });

test.describe('device limits (round 138)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
  });

  test('both devices are requested with the adapter’s own limits', async ({
    page,
  }) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    const out = await page.evaluate(async () => {
      const requested = [];
      const requestDevice = GPUAdapter.prototype.requestDevice;

      GPUAdapter.prototype.requestDevice = function (desc) {
        requested.push(desc?.requiredLimits ?? null);

        return requestDevice.call(this, desc);
      };

      const adapter = await navigator.gpu.requestAdapter();
      const own = {
        maxBufferSize: adapter.limits.maxBufferSize,
        maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
        maxComputeWorkgroupsPerDimension:
          adapter.limits.maxComputeWorkgroupsPerDimension,
      };
      // the renderer's device
      const cy = window.makeCy({ elements: [{ data: { id: 'a' } }] });

      await cy.ready;

      const d = cy.renderer().device.limits;
      const device = {
        maxBufferSize: d.maxBufferSize,
        maxStorageBufferBindingSize: d.maxStorageBufferBindingSize,
        maxComputeWorkgroupsPerDimension: d.maxComputeWorkgroupsPerDimension,
      };
      // the algorithm device (round 65): a headless run on the GPU lane
      const headless = cytoscape({
        elements: [
          { data: { id: 'x' } },
          { data: { id: 'y' } },
          { data: { source: 'x', target: 'y' } },
        ],
      });

      await headless.elements().pageRank({ executor: 'gpu' });

      return { own, device, fit: cy._gpuFit.limits, requested };
    });

    expect(out.device).toEqual(out.own);
    expect(out.fit).toEqual(out.own);
    // two devices, the renderer's and the algorithm executor's, and each
    // asked for exactly the adapter's values
    expect(out.requested).toEqual([out.own, out.own]);
  });

  test('cy.add() one past the device’s own ceiling throws, and adds nothing', async ({
    page,
  }) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    const out = await page.evaluate(async () => {
      const cy = window.makeCy({ elements: [{ data: { id: 'a' } }] });

      await cy.ready;

      // the ceiling from the device's limits, not a count: the node
      // table's capacity doubles from 32, so the most slots it can hold
      // is the largest power of two whose widest column binds, capped by
      // one dispatch's reach
      const { limits, nodes } = cy._gpuFit;
      const bindable = Math.min(
        limits.maxBufferSize,
        limits.maxStorageBufferBindingSize,
      );
      let capacity = 32;

      while (capacity * 2 * nodes.bytes <= bindable) {
        capacity *= 2;
      }

      const ceiling = Math.min(
        capacity,
        limits.maxComputeWorkgroupsPerDimension * 256,
      );
      const adding = ceiling - cy.nodes().length + 1;
      let caught = null;

      try {
        // count-only columnar: refused before a slot or array is taken
        cy.add({ columnar: true, nodes: { count: adding } });
      } catch (err) {
        caught = { name: err.name, message: err.message };
      }

      return {
        ceiling,
        adding,
        caught,
        nodes: cy.nodes().length,
        capacity: cy._store.capacity('nodes'),
      };
    });

    expect(out.ceiling).toBeGreaterThan(4194304); // past the old default
    expect(out.caught?.name).toBe('GpuUnfitError');
    expect(out.caught.message).toContain(`adding ${out.adding} nodes would`);
    expect(out.caught.message).toMatch(/nothing was added$/);
    expect(out.nodes).toBe(1);
    expect(out.capacity).toBe(32);
  });
});

test.describe('the fit, at small limits (round 138)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');
    await withLimits(page);
  });

  test('the add boundary: 1,024 nodes fit a 16 KiB binding, the 1,025th throws', async ({
    page,
  }) => {
    await makeScene(page, { nodes: 10, labels: false });

    const out = await page.evaluate(() => {
      const cy = window.cy;

      cy.add({ columnar: true, nodes: { count: 1024 - 10 } });

      const atCeiling = cy.nodes().length;
      let caught = null;

      try {
        cy.add({ data: { id: 'over' } });
      } catch (err) {
        caught = { name: err.name, message: err.message };
      }

      return {
        atCeiling,
        caught,
        after: cy.nodes().length,
        over: cy.getElementById('over').length,
      };
    });

    expect(out.atCeiling).toBe(1024);
    expect(out.caught).toEqual({
      name: 'GpuUnfitError',
      message:
        'cy.add(): adding 1 nodes would grow the nodes table to 2048 ' +
        "slots, and its 'node.outerGeom' column to a 32768-byte buffer — " +
        "past this device's 16384-byte storage binding limit; nothing was " +
        'added',
    });
    expect(out.after).toBe(1024);
    expect(out.over).toBe(0);

    // the graph at the ceiling draws, and the device raised nothing
    const before = await stats(page);

    await drawFrames(page);

    const after = await stats(page);

    expect(after.frames).toBeGreaterThan(before.frames);
    expect(after.errors).toBe(0);
  });

  test('a graph built past the device rejects cy.ready with the same error', async ({
    page,
  }) => {
    const out = await page.evaluate(async () => {
      const els = [];

      for (let i = 0; i < 1500; i++) {
        els.push({ data: { id: 'n' + i } });
      }

      const cy = window.makeCy({ elements: els });

      try {
        await cy.ready;

        return 'resolved';
      } catch (err) {
        return {
          name: err.name,
          message: err.message,
          nodes: cy.nodes().length,
        };
      }
    });

    expect(out).toEqual({
      name: 'GpuUnfitError',
      message:
        'mounting: this graph does not fit the device — its nodes would ' +
        "grow the nodes table to 2048 slots, and its 'node.outerGeom' " +
        "column to a 32768-byte buffer — past this device's 16384-byte " +
        'storage binding limit',
      nodes: 1500,
    });
  });

  test('labels past the binding degrade first: the rest draws, the device raises nothing', async ({
    page,
  }) => {
    await makeScene(page, { nodes: 0 });
    // 60 labels of ~8 glyphs: past the 256 glyph slots a 16 KiB binding
    // holds
    await page.evaluate(() => {
      const els = [];

      for (let i = 0; i < 60; i++) {
        els.push({
          data: { id: 'n' + i, label: 'label ' + i },
          position: { x: (i % 20) * 30, y: Math.floor(i / 20) * 30 },
        });
      }

      window.cy.add(els);
      window.cy.fit();
    });
    await drawFrames(page);

    const out = await stats(page);

    expect(out.gpuerrors).toHaveLength(1);
    expect(out.gpuerrors[0]).toMatchObject({
      kind: 'unfit',
      label: 'cy-gpu:glyphs',
      degraded: 'labels',
    });
    // a power-of-two stream past the 256 glyphs of 64 bytes that bind
    expect(out.gpuerrors[0].bytes).toBeGreaterThan(256 * 64);
    expect(out.gpuerrors[0].message).toBe(
      `cy-gpu:glyphs: a ${out.gpuerrors[0].bytes}-byte glyph buffer ` +
        `(${out.gpuerrors[0].bytes / 64} glyphs) is past the 256 one label ` +
        'stream can bind and cull on this device',
    );
    expect(out.degraded).toEqual(['labels']);
    // the discriminating half: without the degrade the glyph cull binds
    // a buffer too small for its stream and every frame is rejected
    expect(out.errors).toBe(0);
    expect(out.frames).toBeGreaterThan(1);
  });

  test('charts and gradients past the binding degrade: reported once each, frames valid', async ({
    page,
  }) => {
    await makeScene(page, {
      nodes: 0,
      labels: false,
      style: {
        chart: 'pie',
        'chart-values': [0.5, 0.3, 0.2],
        'chart-colors': ['red', 'lime', 'blue'],
      },
    });
    await page.evaluate(() => {
      const cy = window.cy;
      const els = [];

      // 600 nodes fit (1,024 slots × 16 B); their 32-byte gradient
      // column (1,024 × 32 B) and a chart apiece do not
      for (let i = 0; i < 600; i++) {
        els.push({
          data: { id: 'n' + i },
          position: { x: (i % 30) * 12, y: Math.floor(i / 30) * 12 },
        });
      }

      cy.add(els);
      cy.$id('n1').style({
        'background-fill': 'linear-gradient',
        'background-gradient-stop-colors': 'red blue',
      });
    });

    await drawFrames(page, 20);

    const s = await stats(page);

    expect(s.gpuerrors.map((e) => [e.kind, e.label, e.degraded])).toEqual([
      ['unfit', 'cy-gpu:node.gradient', 'gradients'],
      ['unfit', 'cy-gpu:chart-blob', 'charts'],
    ]);
    expect(s.gpuerrors[0].bytes).toBe(1024 * 32);
    // both passes stand down: the placeholder buffers keep every bind
    // group valid (the real device would take the larger buffers — only
    // its reported limits are small — so `errors` alone would not
    // discriminate here; the degraded set is what gates the draws)
    expect(s.degraded).toEqual(['gradients', 'charts']);
    expect(s.errors).toBe(0);
  });
});

test.describe('a refused allocation (round 138)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');
    await refuseNext(page);
  });

  test('a refused glyph buffer is reported, labels degrade, and the errors stop', async ({
    page,
  }) => {
    // 400 labels and 40 drawn frames on SwiftShader: 25–30 s on a GitHub
    // runner, against the 30 s default (CI run 37331587280: failed once at
    // 30.1 s, passed on retry at 25.4 s)
    test.slow();
    await makeScene(page, { nodes: 1 });
    await page.evaluate(() => {
      window.__refuse = 'cy-gpu:glyphs';

      const els = [];

      for (let i = 1; i < 400; i++) {
        els.push({
          data: { id: 'n' + i, label: 'label ' + i },
          position: { x: (i % 20) * 30, y: Math.floor(i / 20) * 30 },
        });
      }

      window.cy.add(els);
    });
    await drawFrames(page, 20);

    const first = await stats(page);

    await drawFrames(page, 20);

    const later = await stats(page);

    expect(first.gpuerrors[0]).toMatchObject({
      kind: 'validation',
      label: 'cy-gpu:glyphs',
      bytes: expect.any(Number),
      degraded: 'labels',
    });
    expect(first.allocationFailures).toBeGreaterThanOrEqual(1);
    expect(first.degraded).toEqual(['labels']);
    // the frames the failure landed in were rejected (the refusal is
    // reported asynchronously); after the degrade no frame is
    expect(later.errors).toBe(first.errors);
    expect(later.frames).toBeGreaterThan(first.frames);
  });

  test('a refused core column holds the last frame: picks answer null, exports reject', async ({
    page,
  }) => {
    await makeScene(page, { nodes: 1, labels: false });
    await page.evaluate(() => {
      window.__refuse = 'cy-gpu:node.position';

      const els = [];

      for (let i = 1; i < 400; i++) {
        els.push({ data: { id: 'n' + i } });
      }

      window.cy.add(els);
    });
    await drawFrames(page, 20);

    const first = await stats(page);

    await drawFrames(page, 20);

    const later = await stats(page);
    const out = await page.evaluate(async () => {
      const pick = await window.cy.pick(100, 100);
      let png = null;

      try {
        await window.cy.png();
        png = 'resolved';
      } catch (err) {
        png = err.message;
      }

      return { pick, png };
    });

    expect(first.gpuerrors[0]).toMatchObject({
      kind: 'validation',
      label: 'cy-gpu:node.position',
      degraded: 'frames',
    });
    expect(first.degraded).toEqual(['frames']);
    expect(later.frames).toBe(first.frames);
    expect(later.errors).toBe(first.errors);
    expect(out.pick).toBe(null);
    expect(out.png).toBe(
      'Cannot export an image: a renderer buffer failed to allocate (see ' +
        'the gpuerror event)',
    );
  });
});

test.describe('the worker host reports its device too (round 138)', () => {
  test('the fit and the ledger cross the boundary', async ({ page }) => {
    await page.goto(PAGE);
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    const supported = await page.evaluate(
      () =>
        typeof OffscreenCanvas !== 'undefined' &&
        HTMLCanvasElement.prototype.transferControlToOffscreen != null,
    );

    test.skip(!supported, 'no OffscreenCanvas workers here');

    const out = await page.evaluate(async () => {
      const adapter = await navigator.gpu.requestAdapter();
      const cy = window.makeCy({
        elements: [{ data: { id: 'a' } }, { data: { id: 'b' } }],
        renderer: { worker: true },
      });

      await cy.ready;
      await new Promise((r) => {
        cy.one('render', r);
        cy.panBy({ x: 1, y: 0 });
      });

      return {
        fit: cy._gpuFit?.limits.maxStorageBufferBindingSize,
        own: adapter.limits.maxStorageBufferBindingSize,
        liveBytes: cy.stats().gpu.liveBytes,
      };
    });

    expect(out.fit).toBe(out.own);
    expect(out.liveBytes).toBeGreaterThan(0);
  });
});

/*
Round 145: the record ref's reach.  `node.chartRef`/`node.imageRef`
pack `offset | count << 24`; a pool past 2^24 floats cannot be
referenced, so the feature degrades like a declined allocation (round
138's order).  The real boundary, no instrument: records of 254 values
(769 floats) put the 21,818th charted node past it, 254 images (3,048
floats) the 5,506th imaged node.  The records are written through the
store's own writers (the style layer caps at 16 slices and 4 images,
which would take 305k nodes); everything but two nodes sits off-screen.
*/

const REF_FLOATS = 2 ** 24;
const CHART_FLOATS = 7 + 254 * 3;
const IMAGE_FLOATS = 254 * 12;

/** Nodes `from`..`to` - 1 off-screen, with a 254-value red pie each. */
const addCharts = (page, from, to) =>
  page.evaluate(
    ({ from, to }) => {
      const cy = window.cy;
      const els = [];

      for (let i = from; i < to; i++) {
        els.push({ data: { id: 'n' + i }, position: { x: 1e5, y: i } });
      }

      cy.add(els);

      const rec = {
        kind: 1,
        size: 1,
        hole: 0,
        startAngle: 0,
        direction: 0,
        opacity: 1,
        values: new Array(254).fill(1 / 254),
        colors: new Array(254).fill([255, 0, 0, 255]),
      };

      for (let i = from; i < to; i++) {
        cy._store.setChart(cy._store.lookup('n' + i).slot, rec);
      }
    },
    { from, to },
  );

/** Pixels of the export that are the pies' red. */
const redPixels = async (page) => {
  const png = decodePng(await page.evaluate(() => window.cy.png()));
  let red = 0;

  for (let i = 0; i < png.data.length; i += 4) {
    if (png.data[i] > 200 && png.data[i + 1] < 60 && png.data[i + 2] < 60) {
      red++;
    }
  }

  return red;
};

for (const worker of [false, true]) {
  const host = worker ? 'the worker host' : 'the main-thread host';

  test.describe(`the record ref's reach, ${host} (round 145)`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(PAGE);
      test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

      if (worker) {
        const supported = await page.evaluate(
          () =>
            typeof OffscreenCanvas !== 'undefined' &&
            HTMLCanvasElement.prototype.transferControlToOffscreen != null,
        );

        test.skip(!supported, 'no OffscreenCanvas workers here');
      }
    });

    test('a chart pool past 2^24 floats degrades charts: reported once, no chart drawn', async ({
      page,
    }) => {
      test.setTimeout(120_000);

      // the last node inside the reach and the first past it
      const inside = Math.floor(REF_FLOATS / CHART_FLOATS);

      expect(inside * CHART_FLOATS).toBeLessThanOrEqual(REF_FLOATS);

      await page.evaluate(async (worker) => {
        window.__gpuerrors = [];

        const cy = window.makeCy({
          elements: [],
          style: { nodes: { width: 40, height: 40 } },
          ...(worker ? { renderer: { worker: true } } : {}),
        });

        cy.on('gpuerror', (e, info) => window.__gpuerrors.push(info));
        await cy.ready;
        cy.zoom(1);
        cy.pan({ x: 100, y: 100 });
      }, worker);

      await addCharts(page, 0, inside);
      // two on screen: the first record, and the last inside the reach
      await page.evaluate((last) => {
        window.cy.$id('n0').position({ x: 0, y: 0 });
        window.cy.$id('n' + last).position({ x: 60, y: 0 });
      }, inside - 1);
      await drawFrames(page, 5);

      const before = await redPixels(page);
      const quiet = await page.evaluate(() => window.__gpuerrors);

      // the control inside the spec: at the reach, both pies draw
      expect(quiet).toEqual([]);
      expect(before).toBeGreaterThan(1000);

      // one record more, and the next is past the reach
      await addCharts(page, inside, inside + 2);
      await page.evaluate((n) => {
        window.cy.$id('n' + n).position({ x: 120, y: 0 });
      }, inside + 1);
      await drawFrames(page, 10);

      const after = await redPixels(page);
      const errors = await page.evaluate(() => window.__gpuerrors);

      expect(errors.map((e) => [e.kind, e.label, e.degraded])).toEqual([
        ['unfit', 'cy-gpu:chart-blob', 'charts'],
      ]);
      expect(errors[0].message).toMatch(/past the 16777216 floats .* 24-bit/);
      // nothing draws a ref the field could not hold
      expect(after).toBe(0);

      if (!worker) {
        const s = await stats(page);

        expect(s.degraded).toEqual(['charts']);
        expect(s.errors).toBe(0);
      }
    });

    test('an image pool past 2^24 floats degrades images, once', async ({
      page,
    }) => {
      test.setTimeout(120_000);

      const n = Math.floor(REF_FLOATS / IMAGE_FLOATS) + 2;

      await page.evaluate(
        async ({ worker, n }) => {
          window.__gpuerrors = [];

          const els = [];

          for (let i = 0; i < n; i++) {
            els.push({ data: { id: 'n' + i }, position: { x: 1e5, y: i } });
          }

          const cy = window.makeCy({
            elements: els,
            ...(worker ? { renderer: { worker: true } } : {}),
          });

          cy.on('gpuerror', (e, info) => window.__gpuerrors.push(info));
          await cy.ready;

          const spec = {
            url:
              'data:image/png;base64,' +
              'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8Dw' +
              'HwAFBQIAX8jx0gAAAABJRU5ErkJggg==',
            sdf: false,
            crossOrigin: 'anonymous',
            fit: 0,
            repeat: 0,
            clip: 0,
            containment: 0,
            smoothing: true,
            opacity: 1,
            posX: { v: 50, pct: true },
            posY: { v: 50, pct: true },
            offX: { v: 0, pct: false },
            offY: { v: 0, pct: false },
            w: { mode: 0, v: 0 },
            h: { mode: 0, v: 0 },
            tint: [0, 0, 0, 0],
          };
          const specs = new Array(254).fill(spec);

          for (let i = 0; i < n; i++) {
            cy._store.setNodeImages(cy._store.lookup('n' + i).slot, specs);
          }
        },
        { worker, n },
      );
      await drawFrames(page, 10);

      const errors = await page.evaluate(() => window.__gpuerrors);

      expect(errors.map((e) => [e.kind, e.label, e.degraded])).toEqual([
        ['unfit', 'cy-gpu:image-blob', 'images'],
      ]);

      if (!worker) {
        expect((await stats(page)).degraded).toEqual(['images']);
      }
    });
  });
}
