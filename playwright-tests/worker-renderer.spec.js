import { test, expect } from '@playwright/test';
import { decodePng, diffPngs, writeDiffArtifacts } from './lib/image-diff.mjs';

/*
Round 86.3: the worker-hosted renderer (`renderer: { worker: true }`),
verified against the same-thread renderer in the same run.

The strongest available parity statement (the plan's own): the same
scene exported through both hosts on the same SwiftShader adapter must
match **exactly — zero differing pixels** — because both run the same
engine, shaders and inputs; only the thread differs.  The exact tier
deliberately excludes labels: the worker's glyph atlas rasterizes with
the worker's FontFaceSet, which does not inherit the page's @font-face
registrations, so label pixels may legitimately differ (a recorded
pass-1 deferral).  Labels get their own non-exact assertions below —
including the label-dims write-back, whose observable is the
main-thread bounding box.

Soft-skips mirror renderer.spec.js: no adapter, no test.  A second
guard skips where OffscreenCanvas workers are unsupported (WebKit),
after asserting the mount rejects loudly there.
*/

const PAGE = 'http://127.0.0.1:3333/playwright-page/index.html';

const hasAdapter = async (page) => {
  return await page.evaluate(async () => {
    if (navigator.gpu == null) {
      return false;
    }

    return (await navigator.gpu.requestAdapter()) != null;
  });
};

const hasWorkerCanvas = async (page) => {
  return await page.evaluate(
    () =>
      typeof Worker !== 'undefined' &&
      typeof OffscreenCanvas !== 'undefined' &&
      HTMLCanvasElement.prototype.transferControlToOffscreen != null,
  );
};

/**
 * Make the instance, await readiness and one presented frame.
 *
 * `'render'` fires when a frame is *submitted*, not when the device has run
 * it.  The first frame is where Dawn compiles the node and cull shaders, and
 * on the SwiftShader adapter CI pins that holds the GPU process for ~4 s
 * (0.35 s on the RX 580; longer under parallel load) — during which the page
 * gets no rendering update at all: no rAF, no ResizeObserver delivery, no
 * placeholder commit, and a tween's wall clock runs on without a frame.  A
 * spec whose window opened at `'render'` spent that window in the stall.
 * `viewportCounts()` resolves from a readback of a later frame, so the
 * device has finished the first one; the rAF after it is a rendering update
 * that ran past the stall.
 */
const makeReadyCy = async (page, options) => {
  await page.evaluate(async (options) => {
    const cy = window.makeCy(options);

    await cy.ready;

    // nudge the viewport so a fresh frame definitely presents
    await new Promise((resolve) => {
      cy.one('render', () => resolve());
      cy.panBy({ x: 1, y: 0 });
      cy.panBy({ x: -1, y: 0 });
    });

    // …and wait for the device to have run it (see above)
    await cy.viewportCounts();
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }, options);
};

const destroyCy = async (page) => {
  await page.evaluate(() => {
    window.cy?.destroy();
    window.cy = null;
  });
};

const exportPng = async (page, opts = {}) => {
  return await page.evaluate(async (opts) => await window.cy.png(opts), opts);
};

// geometry-only scene: shapes, borders, straight + parallel (curved)
// edges, arrows both ends, a compound parent — no labels (see header)
const SCENE = {
  elements: {
    nodes: [
      { data: { id: 'p' } },
      { data: { id: 'a', parent: 'p' }, position: { x: -80, y: -40 } },
      { data: { id: 'b', parent: 'p' }, position: { x: 40, y: -60 } },
      { data: { id: 'c' }, position: { x: 100, y: 60 } },
      { data: { id: 'd' }, position: { x: -60, y: 80 } },
    ],
    edges: [
      { data: { id: 'ab', source: 'a', target: 'b' } },
      { data: { id: 'bc1', source: 'b', target: 'c' } },
      { data: { id: 'bc2', source: 'b', target: 'c' } }, // bundle ⇒ curved
      { data: { id: 'cd', source: 'c', target: 'd' } },
    ],
  },
  style: {
    nodes: {
      width: 30,
      height: 30,
      'background-color': '#48a',
      'border-width': 2,
      'border-color': '#123',
      shape: 'round-rectangle',
    },
    edges: {
      width: 3,
      'line-color': '#a84',
      'target-arrow-shape': 'triangle',
      'target-arrow-color': '#a84',
      'source-arrow-shape': 'circle',
      'source-arrow-color': '#48a',
    },
    parents: { 'background-color': '#eee', 'border-color': '#999' },
  },
  zoom: 1.25,
  pan: { x: 200, y: 150 },
};

test.describe('worker-hosted renderer (round 86.3)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 300 });
    await page.goto(PAGE);
  });

  test('rejects loudly where OffscreenCanvas workers are unsupported', async ({
    page,
  }) => {
    test.skip(await hasWorkerCanvas(page), 'this platform supports it');

    const message = await page.evaluate(() => {
      try {
        window.makeCy({ renderer: { worker: true } });

        return null;
      } catch (err) {
        return err.message;
      }
    });

    expect(message).toMatch(/Worker and OffscreenCanvas/);
  });

  test('renders the same pixels as the same-thread host, exactly', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter here');
    test.skip(!(await hasWorkerCanvas(page)), 'no OffscreenCanvas workers');

    await makeReadyCy(page, SCENE);

    const mainThread = decodePng(await exportPng(page));

    await destroyCy(page);

    await makeReadyCy(page, { ...SCENE, renderer: { worker: true } });

    const worker = decodePng(await exportPng(page));
    const { mismatched, diff } = diffPngs(worker, mainThread, {
      threshold: 0,
    });

    if (mismatched !== 0) {
      writeDiffArtifacts(
        testInfo.outputPath(''),
        'worker-vs-main',
        worker,
        mainThread,
        diff,
      );
    }

    expect(mismatched).toBe(0);
    await destroyCy(page);
  });

  test('an emphasis crosses to the worker: the same two tiers, exactly (round 102)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter here');
    test.skip(!(await hasWorkerCanvas(page)), 'no OffscreenCanvas workers');

    // the emphasis is a flag span plus one store scalar (emphasisDim),
    // which the worker receives in the batch's scalars — an export from
    // each host must match exactly, and must differ from the scene
    // without it (the control: an emphasis that never crossed would
    // match the plain export instead)
    const emphasized = async (worker) => {
      await makeReadyCy(page, {
        ...SCENE,
        ...(worker ? { renderer: { worker: true } } : {}),
      });

      const plain = decodePng(await exportPng(page));

      await page.evaluate(async () => {
        const cy = window.cy;

        cy.emphasize(cy.$id('a').closedNeighborhood());
        await new Promise((resolve) => cy.one('render', () => resolve()));
      });

      const image = decodePng(await exportPng(page));

      await destroyCy(page);

      return { plain, image };
    };

    const main = await emphasized(false);
    const worker = await emphasized(true);

    expect(
      diffPngs(worker.image, worker.plain, { threshold: 0 }).mismatched,
      'the emphasis changes the worker frame',
    ).toBeGreaterThan(1000);

    const { mismatched, diff } = diffPngs(worker.image, main.image, {
      threshold: 0,
    });

    if (mismatched !== 0) {
      writeDiffArtifacts(
        testInfo.outputPath(''),
        'emphasis-worker-vs-main',
        worker.image,
        main.image,
        diff,
      );
    }

    expect(mismatched).toBe(0);
  });

  test('mutations and viewport changes reach the worker frame', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter here');
    test.skip(!(await hasWorkerCanvas(page)), 'no OffscreenCanvas workers');

    await makeReadyCy(page, { ...SCENE, renderer: { worker: true } });

    const before = decodePng(await exportPng(page));

    // a style write, a position write and a zoom — the batch, viewport
    // and export paths all cross the boundary here
    await page.evaluate(async () => {
      window.cy.style({ nodes: { 'background-color': '#e33' } });
      window.cy.$id('c').position({ x: 140, y: 20 });
      window.cy.zoom(1.5);

      await new Promise((resolve) => window.cy.one('render', resolve));
    });

    const after = decodePng(await exportPng(page));
    const { mismatched } = diffPngs(after, before, { threshold: 0 });

    expect(mismatched, 'the mutation must repaint').toBeGreaterThan(500);

    // and the result must equal the same-thread render of the same state
    await destroyCy(page);
    await makeReadyCy(page, SCENE);
    await page.evaluate(async () => {
      window.cy.style({ nodes: { 'background-color': '#e33' } });
      window.cy.$id('c').position({ x: 140, y: 20 });
      window.cy.zoom(1.5);

      await new Promise((resolve) => window.cy.one('render', resolve));
    });

    const mainThread = decodePng(await exportPng(page));
    const cmp = diffPngs(after, mainThread, { threshold: 0 });

    if (cmp.mismatched !== 0) {
      writeDiffArtifacts(
        testInfo.outputPath(''),
        'worker-mutated-vs-main',
        after,
        mainThread,
        cmp.diff,
      );
    }

    expect(cmp.mismatched).toBe(0);
    await destroyCy(page);
  });

  test('labels draw, and their measured dims reach the main thread', async ({
    page,
  }) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter here');
    test.skip(!(await hasWorkerCanvas(page)), 'no OffscreenCanvas workers');

    await makeReadyCy(page, {
      elements: [{ data: { id: 'a' }, position: { x: 0, y: 0 } }],
      style: { nodes: { width: 20, height: 20 } },
      zoom: 1,
      pan: { x: 200, y: 150 },
      renderer: { worker: true },
    });

    const bare = await page.evaluate(() => {
      const bb = window.cy.$id('a').boundingBox();

      return { w: bb.w, h: bb.h };
    });

    const labelled = await page.evaluate(async () => {
      window.cy.style({ nodes: { label: 'a long enough label' } });

      await new Promise((resolve) => window.cy.one('render', resolve));
      // the dims message is a worker→main round trip; poll for it (the
      // suite's standing rule: wait for the state, never sleep to an
      // offset)
      for (let i = 0; i < 200; i++) {
        const bb = window.cy.$id('a').boundingBox();

        if (bb.w > 30) {
          return { w: bb.w, h: bb.h };
        }

        await new Promise((resolve) => setTimeout(resolve, 25));
      }

      const bb = window.cy.$id('a').boundingBox();

      return { w: bb.w, h: bb.h };
    });

    // the label widens the box only if the worker measured it and the
    // dims crossed back (the write-back under test)
    expect(labelled.w).toBeGreaterThan(bare.w + 10);

    // and label ink actually reached the frame: the export differs from
    // the unlabelled one
    const withLabel = decodePng(await exportPng(page));

    await page.evaluate(async () => {
      window.cy.style({ nodes: {} });

      await new Promise((resolve) => window.cy.one('render', resolve));
    });

    const withoutLabel = decodePng(await exportPng(page));
    const { mismatched } = diffPngs(withLabel, withoutLabel, { threshold: 0 });

    expect(
      mismatched,
      'label glyphs must put ink on the frame',
    ).toBeGreaterThan(50);
    await destroyCy(page);
  });

  test('picks answer through the worker: node sync, edge async, background', async ({
    page,
  }) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter here');
    test.skip(!(await hasWorkerCanvas(page)), 'no OffscreenCanvas workers');

    await makeReadyCy(page, {
      elements: [
        { data: { id: 'a' }, position: { x: -60, y: 0 } },
        { data: { id: 'b' }, position: { x: 60, y: 0 } },
        { data: { id: 'ab', source: 'a', target: 'b' } },
      ],
      style: {
        nodes: { width: 40, height: 40 },
        edges: { width: 6 },
      },
      zoom: 1,
      pan: { x: 200, y: 150 },
      renderer: { worker: true },
    });

    const picks = await page.evaluate(async () => {
      const node = await window.cy.pick(140, 150); // a's center
      const edge = await window.cy.pick(200, 150); // mid-edge
      const bg = await window.cy.pick(20, 20);

      return {
        node: node != null ? node.id() : null,
        edge: edge != null ? edge.id() : null,
        bg: bg != null ? bg.id() : null,
      };
    });

    expect(picks.node).toBe('a');
    expect(picks.edge).toBe('ab');
    expect(picks.bg).toBe(null);
    await destroyCy(page);
  });

  test('resize crosses to the worker; the canvas CSS box is fixed px (round 91)', async ({
    page,
  }) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter here');
    test.skip(
      !(await hasWorkerCanvas(page)),
      'no OffscreenCanvas worker support',
    );

    await makeReadyCy(
      page,
      Object.assign({}, SCENE, { renderer: { worker: true } }),
    );

    // fixed px from the mount (the letterbox-not-stretch shape, 91.1):
    // a worker frame is always at least a message late behind a layout
    // change, so the CSS box must never scale stale content
    const before = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');

      return { cssW: canvas.style.width, cssH: canvas.style.height };
    });

    expect(before.cssW).toBe('400px');
    expect(before.cssH).toBe('300px');

    // the proxy re-fits the CSS box synchronously in resize()…
    const after = await page.evaluate(() => {
      const container = document.getElementById('cytoscape');

      container.style.width = '250px';
      container.style.height = '280px';
      window.cy.resize();

      const canvas = document.querySelector('canvas');

      return { cssW: canvas.style.width, cssH: canvas.style.height };
    });

    expect(after.cssW).toBe('250px');
    expect(after.cssH).toBe('280px');

    // …and the new device-px size crosses to the worker's backing
    // store, which the placeholder canvas reflects on commit
    await expect
      .poll(
        async () =>
          await page.evaluate(() => {
            const canvas = document.querySelector('canvas');

            return { w: canvas.width, h: canvas.height };
          }),
      )
      .toEqual({ w: 250, h: 280 });

    await destroyCy(page);
  });

  test('round 75 through the worker: nodeAt, viewportCounts and the observer resize event', async ({
    page,
  }) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter here');
    test.skip(!(await hasWorkerCanvas(page)), 'no OffscreenCanvas workers');

    await makeReadyCy(page, {
      elements: [
        { data: { id: 'a' }, position: { x: -60, y: 0 } },
        { data: { id: 'b' }, position: { x: 60, y: 0 } },
        { data: { id: 'far' }, position: { x: 5000, y: 0 } },
        { data: { id: 'ab', source: 'a', target: 'b' } },
      ],
      style: {
        nodes: { width: 40, height: 40 },
        edges: { width: 6 },
      },
      zoom: 1,
      pan: { x: 200, y: 150 },
      renderer: { worker: true },
    });

    const answers = await page.evaluate(async () => {
      const cy = window.cy;
      const resized = new Promise((resolve) => {
        cy.one('resize', () => resolve(true));
        setTimeout(() => resolve(false), 3000);
      });

      const out = {
        // 75.4: the proxy's canonical-column pick, synchronously
        node: cy.nodeAt(140, 150)?.id() ?? null,
        edge: cy.nodeAt(200, 150)?.id() ?? null,
        // 75.6: the engine's cull, over the message channel
        counts: await cy.viewportCounts(),
      };

      // 75.1: the proxy's observer emits resize without cy.resize()
      document.getElementById('cytoscape').style.width = '250px';
      out.resized = await resized;

      return out;
    });

    expect(answers).toEqual({
      node: 'a',
      edge: null,
      counts: { nodes: 2, edges: 1 },
      resized: true,
    });
    await destroyCy(page);
  });

  test('create/destroy cycles leave no stuck worker instance', async ({
    page,
  }) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter here');
    test.skip(!(await hasWorkerCanvas(page)), 'no OffscreenCanvas workers');
    // four instances, each a fresh device that compiles its first frame's
    // shaders again (nothing is cached across devices): ~4 s apiece on
    // SwiftShader, 17.7 s serially, past the 30 s default when the
    // runner's other workers load the same software rasterizer
    test.slow();

    for (let i = 0; i < 3; i++) {
      await makeReadyCy(page, { ...SCENE, renderer: { worker: true } });
      await destroyCy(page);
    }

    // the page is still healthy: a fresh worker instance renders
    await makeReadyCy(page, { ...SCENE, renderer: { worker: true } });

    const png = decodePng(await exportPng(page));

    expect(png.width).toBeGreaterThan(0);
    await destroyCy(page);
  });

  // -- the force integrator across the boundary (round 129.2) -----------

  const RING = (n, seedLine = false) => {
    const els = [];

    for (let i = 0; i < n; i++) {
      els.push({
        data: { id: 'n' + i },
        position: seedLine
          ? { x: i * 30 - (n * 30) / 2 + 15, y: (i % 2) * 40 - 20 }
          : { x: 0, y: 0 },
      });
      els.push({
        data: { id: 'e' + i, source: 'n' + i, target: 'n' + ((i + 1) % n) },
      });
    }

    return els;
  };

  // a provably long run (the same-thread spec's shape): threshold 0
  // never settles by displacement and the tiny decay keeps alpha hot
  const LONG_RUN = {
    name: 'force',
    seed: 9,
    animateLive: true,
    fit: false,
    iterations: 100000,
    threshold: 0,
    decay: 0.0005,
    stepsPerFrame: 6,
  };

  test('the force integrator runs in the worker: frames draw and the main thread stays free during the run, the settle lands (129.2)', async ({
    page,
  }) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter here');
    test.skip(!(await hasWorkerCanvas(page)), 'no OffscreenCanvas workers');

    await makeReadyCy(page, {
      elements: RING(40),
      style: {
        nodes: { width: 12, height: 12, 'background-color': '#c0392b' },
      },
      zoom: 1,
      pan: { x: 200, y: 150 },
      renderer: { worker: true },
    });

    const result = await page.evaluate(async (LONG_RUN) => {
      const cy = window.cy;
      const before = { ...cy.$id('n7').position() };
      const layout = cy.layout(LONG_RUN);
      let resolved = false;

      layout.run();
      layout.promise().then(() => {
        resolved = true;
      });

      // the main thread's availability while the worker integrates: a
      // 5 ms interval's tick count over the sample — a held thread counts
      // none, a free one about one per 5 ms (round 129.3's instrument).
      // Not rAF: begin-frames are paced by the GPU process, and on a
      // SwiftShader runner loaded past its workers a free main thread
      // read 9 and 10 rAF ticks over 700 ms with the worker drawing —
      // rAF read the rasterizer, not the thread.  framesDuring below is
      // what reads the drawing
      let ticks = 0;

      // the run opens with the force pipelines' compile stall, then
      // 60 fps.  The stall is ~300 ms on the RX 580 but up to ~4 s on
      // SwiftShader, where it holds the GPU process and so rAF too (the
      // main thread's timers run on) — measured 2026-09-25.  A fixed
      // 700 ms window from run() fell inside it on CI every time.  Nor is
      // "the second frame" past it: the counter counts submits, and the
      // run's first two frames are submitted before the device has run
      // the first, so under a loaded runner the window still fell in the
      // stall (0 frames, or 4 rAF ticks, in 700 ms — 2026-09-29).  A
      // viewport-count readback resolves only once the device has run
      // everything before it, so the window opens after the stall
      await cy.viewportCounts();

      const f1 = cy.stats().frames;

      const t1 = performance.now();
      const interval = setInterval(() => {
        ticks++;
      }, 5);

      await new Promise((resolve) => setTimeout(resolve, 700));
      clearInterval(interval);

      const sampleMs = performance.now() - t1;

      const framesDuring = cy.stats().frames - f1;
      const midRun = { ...cy.$id('n7').position() };
      const staleDuring = midRun.x === before.x && midRun.y === before.y;
      const stillRunning = !resolved;
      const activeDuring = cy.renderer().forceActive();

      layout.stop();
      await layout.promise();

      const after = { ...cy.$id('n7').position() };
      const settledMoved =
        Math.hypot(after.x - before.x, after.y - before.y) > 20;
      const a = cy.$id('n3').position();
      const b = cy.$id('n4').position();
      const linkLen = Math.hypot(b.x - a.x, b.y - a.y);
      const activeAfter = cy.renderer().forceActive();

      return {
        ticks,
        sampleMs,
        framesDuring,
        staleDuring,
        stillRunning,
        activeDuring,
        settledMoved,
        linkLen,
        activeAfter,
      };
    }, LONG_RUN);

    expect(result.stillRunning, 'the run outlived the sample').toBe(true);
    expect(
      result.framesDuring,
      'the worker drew frames mid-run',
    ).toBeGreaterThan(3);
    expect(
      result.ticks,
      `the main thread ticked through the run: ${result.ticks} timer ticks over ${result.sampleMs.toFixed(0)} ms`,
    ).toBeGreaterThan(Math.max(4, result.sampleMs / 20));
    expect(result.staleDuring, 'CPU reads stale mid-run (the lease)').toBe(
      true,
    );
    expect(result.activeDuring, 'forceActive() mirrors the run').toBe(true);
    expect(result.settledMoved, 'the settle readback landed').toBe(true);
    expect(result.linkLen).toBeGreaterThan(10);
    expect(result.linkLen).toBeLessThan(250);
    expect(result.activeAfter).toBe(false);
    await destroyCy(page);
  });

  test('a silent force run under the worker host (animate: true) settles and tweens as the same-thread host does (87.2; 129.2)', async ({
    page,
  }) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter here');
    test.skip(!(await hasWorkerCanvas(page)), 'no OffscreenCanvas workers');

    const run = async (renderer) => {
      await makeReadyCy(page, {
        elements: RING(30),
        style: {
          nodes: { width: 12, height: 12, 'background-color': '#c0392b' },
        },
        zoom: 1,
        pan: { x: 200, y: 150 },
        renderer,
      });

      const out = await page.evaluate(async () => {
        const cy = window.cy;
        const layout = cy.layout({
          name: 'force',
          seed: 4,
          animate: true,
          animationDuration: 150,
          fit: false,
          iterations: 300,
        });

        layout.run();
        await layout.promise();

        const a = cy.$id('n3').position();
        const b = cy.$id('n4').position();
        const c = cy.$id('n18').position();

        return {
          link: Math.hypot(b.x - a.x, b.y - a.y),
          spread: Math.hypot(c.x - a.x, c.y - a.y),
        };
      });

      await destroyCy(page);

      return out;
    };

    const mainThread = await run(undefined);
    const worker = await run({ worker: true });

    // the same invariants, not the same trajectory (the executors agree
    // on invariants — 18.4): links near the ideal length, the ring open
    for (const r of [mainThread, worker]) {
      expect(r.link).toBeGreaterThan(10);
      expect(r.link).toBeLessThan(250);
      expect(r.spread).toBeGreaterThan(r.link * 2);
    }
  });

  test('layout.cancel() on a worker-hosted force run: no settle lands, the mirror shows the snapshot (128; 129.2)', async ({
    page,
  }) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter here');
    test.skip(!(await hasWorkerCanvas(page)), 'no OffscreenCanvas workers');

    await page.setViewportSize({ width: 800, height: 600 });
    await makeReadyCy(page, {
      elements: RING(24, true),
      style: {
        nodes: { width: 16, height: 16, 'background-color': '#c0392b' },
      },
      zoom: 1,
      pan: { x: 400, y: 300 },
      renderer: { worker: true },
    });

    const result = await page.evaluate(async (LONG_RUN) => {
      const cy = window.cy;
      const before = cy.nodes().map((n) => ({ ...n.position() }));
      const layout = cy.layout(LONG_RUN);
      let outcome = 'pending';

      layout.run();
      layout.promise().then(
        () => {
          outcome = 'resolved';
        },
        (err) => {
          outcome = err.name;
        },
      );

      await new Promise((resolve) => setTimeout(resolve, 300));

      const stillRunning = outcome === 'pending';
      let cancelledEvent = null;

      cy.on('layoutstop', (e) => {
        cancelledEvent = e.cancelled === true;
      });
      layout.cancel();

      try {
        await layout.promise();
      } catch {
        // the rejection is the expected outcome
      }

      const after = cy.nodes().map((n) => ({ ...n.position() }));
      const restored = after.every(
        (p, i) => p.x === before[i].x && p.y === before[i].y,
      );

      // the mirror followed the restore: an edge pick through the
      // worker at the restored geometry — wait for the batch and a frame
      for (let i = 0; i < 6; i++) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }

      const pan = cy.pan();
      const zoom = cy.zoom();
      const probe = before[5];
      const hit = await cy.pick(probe.x * zoom + pan.x, probe.y * zoom + pan.y);

      return {
        stillRunning,
        outcome,
        cancelledEvent,
        restored,
        hitId: hit == null ? null : hit.id(),
        forceActive: cy.renderer().forceActive(),
      };
    }, LONG_RUN);

    expect(result.stillRunning, 'the run outlived the sample').toBe(true);
    expect(result.outcome).toBe('CancelledError');
    expect(result.cancelledEvent).toBe(true);
    expect(result.restored, 'the CPU column is back on the snapshot').toBe(
      true,
    );
    expect(result.hitId, 'the mirror shows the restored positions').toBe('n5');
    expect(result.forceActive).toBe(false);
    await destroyCy(page);
  });

  test('destroy() under a worker-hosted force run resolves the run without a settle (128.4; 129.2)', async ({
    page,
  }) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter here');
    test.skip(!(await hasWorkerCanvas(page)), 'no OffscreenCanvas workers');

    await makeReadyCy(page, {
      elements: RING(30),
      style: { nodes: { width: 12, height: 12 } },
      zoom: 1,
      pan: { x: 200, y: 150 },
      renderer: { worker: true },
    });

    const result = await page.evaluate(async (LONG_RUN) => {
      const cy = window.cy;
      const layout = cy.layout(LONG_RUN);
      let outcome = 'pending';

      layout.run();
      layout.promise().then(
        () => {
          outcome = 'resolved';
        },
        (err) => {
          outcome = err.name;
        },
      );
      await new Promise((resolve) => setTimeout(resolve, 200));

      const stillRunning = outcome === 'pending';

      cy.destroy();
      window.cy = null;

      // the rejection lands on a microtask after the destroy's cancel
      await new Promise((resolve) => setTimeout(resolve, 50));

      return { stillRunning, outcome };
    }, LONG_RUN);

    expect(result.stillRunning).toBe(true);
    expect(result.outcome).toBe('CancelledError');
  });

  // -- the CPU simulation on a worker (round 129.3) ----------------------

  const COMPOUND_SCENE = () => {
    const els = [{ data: { id: 'p' } }, { data: { id: 'q' } }];

    for (let i = 0; i < 12; i++) {
      els.push({
        data: { id: 'n' + i, parent: i < 6 ? 'p' : 'q' },
        position: { x: (i % 6) * 20 - 50, y: i < 6 ? -40 : 40 },
      });
      els.push({
        data: { id: 'e' + i, source: 'n' + i, target: 'n' + ((i + 1) % 12) },
      });
    }

    return els;
  };

  for (const host of ['same-thread', 'worker']) {
    test(`a compound graph's force run takes the sim worker on a rendered instance (${host} host): bit-identical to 'cpu', the main thread ticking (129.3)`, async ({
      page,
    }) => {
      test.skip(!(await hasAdapter(page)), 'no WebGPU adapter here');
      test.skip(
        host === 'worker' && !(await hasWorkerCanvas(page)),
        'no OffscreenCanvas workers',
      );

      await makeReadyCy(page, {
        elements: COMPOUND_SCENE(),
        style: { nodes: { width: 12, height: 12 } },
        zoom: 1,
        pan: { x: 200, y: 150 },
        renderer: host === 'worker' ? { worker: true } : undefined,
      });

      const result = await page.evaluate(async () => {
        const cy = window.cy;
        const positionsOf = () =>
          cy
            .nodes()
            .filter((n) => !n.isParent())
            .map((n) => [n.id(), n.position().x, n.position().y]);

        // the in-thread reference first, synchronously — the same
        // options the 'auto' run takes below, or the two are not one
        // simulation
        const RUN = {
          name: 'force',
          seed: 4,
          fit: false,
          iterations: 2000,
          threshold: 0,
        };

        cy.layout({ ...RUN, executor: 'cpu' }).run();

        const reference = positionsOf();

        // reseed the scene so the 'auto' run starts from the same
        // positions the reference started from
        cy.nodes()
          .filter((n) => !n.isParent())
          .forEach((n, i) => {
            n.position({ x: (i % 6) * 20 - 50, y: i < 6 ? -40 : 40 });
          });

        const before = cytoscape.__forceWorkerStats__();
        const layout = cy.layout(RUN);
        // the main thread's availability: a 5 ms interval's tick count.
        // Not rAF here — a run that draws nothing until it lands gets no
        // begin-frames in headless Chromium (measured 2026-09-18: 2 rAF
        // ticks over an idle 300 ms against 60 timer ticks, and 0 timer
        // ticks over a held 300 ms), so the timer is the instrument
        // that reads a held thread as zero and a free one as the wall
        let ticks = 0;
        const interval = setInterval(() => {
          ticks++;
        }, 5);

        const t0 = performance.now();

        layout.run();

        // 'auto' on a rendered compound graph: asynchronous now — the
        // positions land at the promise, not inside run()
        const syncStill = positionsOf().every(
          ([, x, y], i) => x === (i % 6) * 20 - 50 && y === (i < 6 ? -40 : 40),
        );

        await layout.promise();
        clearInterval(interval);

        const wallMs = performance.now() - t0;
        const after = cytoscape.__forceWorkerStats__();

        return {
          syncStill,
          ticks,
          wallMs,
          ran: after.runs - before.runs,
          same: JSON.stringify(positionsOf()) === JSON.stringify(reference),
        };
      });

      expect(result.ran, 'the run went to the sim worker').toBe(1);
      expect(result.syncStill, 'the run is asynchronous').toBe(true);
      expect(result.same, "bit-identical to 'cpu'").toBe(true);
      // the main thread ticked through the run: a held thread counts
      // none (the item-51 reading of this fixture class: zero frames
      // over 12.8 s), a free one about one tick per 5 ms
      expect(
        result.ticks,
        `${result.ticks} timer ticks over ${result.wallMs.toFixed(0)} ms`,
      ).toBeGreaterThan(Math.max(4, result.wallMs / 20));
      await destroyCy(page);
    });
  }
});

/*
Round 141 (ledger item 51): the worker host's background images and
label fonts.  Images decode in the worker (raster sources there, SVG on
the main thread, which has the `<img>` it needs), and the parity
statement is 86.3's: the same scene through both hosts, exact-zero.
Fonts come from the app's `renderer.fonts` list, registered from bytes
in the worker; with the same face registered on the page for the
same-thread host, the labelled scene is held to the same exact tier.

The mechanics test at the end needs no adapter, so it is the one that
runs on WebKit here (Playwright's Linux WebKit has no WebGPU, and the
host itself soft-skips there): it is the "WebKit verified" half of the
eleventh sitting's call, for everything the host does in a worker short
of the GPU.
*/

const QUAD_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAASUlEQVR4AaXBQQ2DQAAAwWVTPSVBBg5QUDkVwQs5/BGBA3Bwn52ZrmV+GDh+JyMSSSSRRBJJJNFn3XZG/veXEYkkkkgiiSSS6AV8gQcyZv0HPAAAAABJRU5ErkJggg==';
const RING_SVG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32">' +
      '<circle cx="16" cy="16" r="11" fill="none" stroke="#27a" stroke-width="5"/>' +
      '<rect x="13" y="2" width="6" height="28" fill="#a72"/></svg>',
  );
const OPEN_SANS =
  '../node_modules/@fontsource/open-sans/files/open-sans-latin-400-normal.woff2';

const imageScene = (type, imgs) => ({
  elements: imgs.map((img, i) => ({
    data: { id: `n${i}`, img },
    position: { x: -90 + i * 60, y: 0 },
  })),
  style: {
    nodes: {
      width: 50,
      height: 50,
      shape: 'round-rectangle',
      'background-color': '#e4e4e4',
      'border-width': 2,
      'border-color': '#333',
      'background-image': { data: 'img' },
      'background-fit': 'contain',
      ...(type === 'sdf-icon'
        ? {
            'background-image-type': 'sdf-icon',
            'background-image-color': '#c33',
          }
        : {}),
    },
  },
  zoom: 1.5,
  pan: { x: 200, y: 150 },
});

/** Export until two consecutive exports agree and `done` holds (the
 * worker's decodes land asynchronously, with no main-side signal). */
const settledExport = async (page, done = () => true) => {
  let last = null;

  for (let i = 0; i < 60; i++) {
    const png = decodePng(await exportPng(page));

    if (
      last != null &&
      diffPngs(png, last, { threshold: 0 }).mismatched === 0 &&
      done(png)
    ) {
      return png;
    }

    last = png;
    await page.waitForTimeout(100);
  }

  return last;
};

test.describe("the worker host's images and fonts (round 141)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 300 });
    await page.goto(PAGE);
  });

  for (const type of ['auto', 'sdf-icon']) {
    test(`background images decode in the worker (${type}): raster and SVG, exactly the same-thread pixels, through a restyle`, async ({
      page,
    }, testInfo) => {
      test.skip(!(await hasAdapter(page)), 'no WebGPU adapter here');
      test.skip(!(await hasWorkerCanvas(page)), 'no OffscreenCanvas workers');
      // two fresh devices, each compiling its first frame, the image
      // pipelines and the export's (see the create/destroy spec): ~11 s
      // serially on SwiftShader, and it met the 30 s default once in 20
      // under a runner loaded with its neighbours
      test.slow();

      const first = [QUAD_PNG, RING_SVG, QUAD_PNG, null];
      // a restyle: n0 swaps to the SVG (sharing its entry), n1's SVG
      // entry survives through n0, n2 frees the PNG and n3 takes it —
      // frees, shared refs and a recycled id all cross
      const restyle = async () => {
        await page.evaluate(
          async ([png, svg]) => {
            const cy = window.cy;

            cy.batch(() => {
              cy.$id('n0').data('img', svg);
              cy.$id('n2').data('img', null);
              cy.$id('n3').data('img', png);
            });
            await new Promise((resolve) => cy.one('render', resolve));
          },
          [QUAD_PNG, RING_SVG],
        );
      };

      // the same-thread reference, both phases
      await makeReadyCy(page, imageScene(type, first));
      await page.waitForFunction(
        () => window.cy._store.images.pendingCount() === 0,
      );

      const mainFirst = await settledExport(page);

      await restyle();
      await page.waitForFunction(
        () => window.cy._store.images.pendingCount() === 0,
      );

      const mainSecond = await settledExport(page);

      await destroyCy(page);

      // the worker host
      await makeReadyCy(page, {
        ...imageScene(type, first),
        renderer: { worker: true },
      });

      const same = (ref) => (png) =>
        diffPngs(png, ref, { threshold: 0 }).mismatched === 0;
      const workerFirst = await settledExport(page, same(mainFirst));

      // the main thread decoded nothing: its registry has no decoder
      // under the worker host, so every entry there stays pending
      const mainSide = await page.evaluate(() => ({
        live: window.cy._store.images.liveCount(),
        pending: window.cy._store.images.pendingCount(),
      }));

      expect(mainSide.live).toBe(2);
      expect(mainSide.pending).toBe(2);

      await restyle();

      const workerSecond = await settledExport(page, same(mainSecond));

      for (const [name, worker, main] of [
        ['first', workerFirst, mainFirst],
        ['restyled', workerSecond, mainSecond],
      ]) {
        const { mismatched, diff } = diffPngs(worker, main, { threshold: 0 });

        if (mismatched !== 0) {
          writeDiffArtifacts(
            testInfo.outputPath(''),
            `images-${type}-${name}`,
            worker,
            main,
            diff,
          );
        }

        expect(mismatched, `${name} phase`).toBe(0);
      }

      // control: the images are in the frame (the restyle moved pixels)
      expect(
        diffPngs(workerFirst, workerSecond, { threshold: 0 }).mismatched,
      ).toBeGreaterThan(200);
      await destroyCy(page);
    });
  }

  const LABEL_SCENE = {
    elements: [
      { data: { id: 'a', label: 'Worker fonts' }, position: { x: 0, y: -30 } },
      {
        data: { id: 'b', label: 'Hamburgefonstiv' },
        position: { x: 0, y: 40 },
      },
    ],
    style: {
      nodes: {
        width: 16,
        height: 16,
        'background-color': '#bbb',
        label: 'data(label)',
        'font-size': 22,
        color: '#000',
        'font-family': `'Probe Sans', serif`,
      },
    },
    zoom: 1,
    pan: { x: 200, y: 150 },
  };

  test("listed fonts reach worker-rastered labels: exactly the same-thread pixels with the page face, a late face re-rasters (Chromium's stale description escaped)", async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter here');
    test.skip(!(await hasWorkerCanvas(page)), 'no OffscreenCanvas workers');
    // four instances, each a fresh device paying its own first-frame
    // compile (see the create/destroy spec): 17.8 s serially on
    // SwiftShader, past the 30 s default under a loaded runner
    test.slow();

    // the same-thread reference: the face registered on the page
    await page.evaluate(async (url) => {
      const face = new FontFace('Probe Sans', `url('${url}')`);

      document.fonts.add(face);
      await face.load();
    }, OPEN_SANS);
    await makeReadyCy(page, LABEL_SCENE);

    const main = await settledExport(page);

    await destroyCy(page);

    // the worker host with no list: the fallback face (the control —
    // proves the scene can tell the faces apart)
    await makeReadyCy(page, { ...LABEL_SCENE, renderer: { worker: true } });

    const fallback = await settledExport(page);

    await destroyCy(page);

    // a late face: the font answers only after the first labelled
    // frames, so the atlas has resolved the description on the fallback
    // before the face exists — the Chromium trap the atlas's font epoch
    // escapes
    let release;
    const held = new Promise((resolve) => {
      release = resolve;
    });

    await page.route('**/late-probe-sans.woff2', async (route) => {
      await held;
      await route.fulfill({
        path: 'node_modules/@fontsource/open-sans/files/open-sans-latin-400-normal.woff2',
        contentType: 'font/woff2',
      });
    });
    await makeReadyCy(page, {
      ...LABEL_SCENE,
      renderer: {
        worker: true,
        fonts: [{ family: 'Probe Sans', source: '../late-probe-sans.woff2' }],
      },
    });

    const early = await settledExport(page);

    release();

    const settled = await page.evaluate(
      async () => await window.cy._renderer._fontsSettled,
    );

    expect(settled).toEqual({ loaded: 1, failed: 0 });

    const same = (png) =>
      diffPngs(png, main, { threshold: 0 }).mismatched === 0;
    const late = await settledExport(page, same);

    await destroyCy(page);

    // and the plain case: a listed face that lands before any label
    await makeReadyCy(page, {
      ...LABEL_SCENE,
      renderer: {
        worker: true,
        fonts: [{ family: 'Probe Sans', source: OPEN_SANS }],
      },
    });
    await page.evaluate(async () => await window.cy._renderer._fontsSettled);

    const listed = await settledExport(page, same);

    await destroyCy(page);

    const vsMain = (png) => diffPngs(png, main, { threshold: 0 });

    expect(
      vsMain(fallback).mismatched,
      'control: the fallback face differs from the listed one',
    ).toBeGreaterThan(100);
    expect(
      vsMain(early).mismatched,
      'the late face is not in yet',
    ).toBeGreaterThan(100);

    for (const [name, png] of [
      ['listed', listed],
      ['late', late],
    ]) {
      const { mismatched, diff } = vsMain(png);

      if (mismatched !== 0) {
        writeDiffArtifacts(
          testInfo.outputPath(''),
          `fonts-${name}`,
          png,
          main,
          diff,
        );
      }

      expect(mismatched, `${name} face vs the page face`).toBe(0);
    }
  });

  test('a listed face that fails to load emits one error and keeps the fallback', async ({
    page,
  }) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter here');
    test.skip(!(await hasWorkerCanvas(page)), 'no OffscreenCanvas workers');

    const result = await page.evaluate(async () => {
      const errors = [];
      const cy = window.makeCy({
        elements: [{ data: { id: 'a' } }],
        style: { nodes: { label: 'x', 'font-family': 'Nowhere Sans' } },
        renderer: {
          worker: true,
          fonts: [{ family: 'Nowhere Sans', source: 'no-such-font.woff2' }],
        },
      });

      cy.on('error', (e, message) => errors.push(String(message)));
      await cy.ready;

      const settled = await cy._renderer._fontsSettled;

      return { settled, errors };
    });

    expect(result.settled).toEqual({ loaded: 0, failed: 1 });
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(
      /'Nowhere Sans' from .*no-such-font\.woff2.*HTTP 404/,
    );
    await destroyCy(page);
  });

  test('an entry with no family throws at mount, before a worker spawns', async ({
    page,
  }) => {
    // the mount checks WebGPU before the renderer options
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter here');
    test.skip(!(await hasWorkerCanvas(page)), 'no OffscreenCanvas workers');

    const message = await page.evaluate(() => {
      try {
        window.makeCy({
          renderer: { worker: true, fonts: [{ source: 'a.woff2' }] },
        });

        return null;
      } catch (err) {
        return err.message;
      }
    });

    expect(message).toMatch(/fonts\[0\] needs a family/);
  });

  test('the worker mechanics the host relies on, in this engine (no adapter needed)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasWorkerCanvas(page)), 'no OffscreenCanvas workers');

    const workerSrc = `
      const measure = (font) => {
        const ctx = new OffscreenCanvas(300, 60).getContext('2d');
        ctx.font = font;
        return ctx.measureText('Hello World').width;
      };
      self.onmessage = async (e) => {
        const out = {};
        const desc = 'normal normal 32px "Mech Sans", sans-serif';
        // resolved before the face exists: the atlas's situation when a
        // listed face lands late
        out.before = measure(desc);
        const bytes = await (await fetch(e.data.font)).arrayBuffer();
        const face = new FontFace('Mech Sans', bytes);
        await face.load();
        self.fonts.add(face);
        out.sameDescription = measure(desc);
        out.epochDescription = measure(desc + ', "cy-font-epoch-1"');
        out.fresh = measure('normal normal 32px "Mech Sans", serif');
        try {
          const blob = await (await fetch(e.data.png)).blob();
          const bitmap = await createImageBitmap(blob, { premultiplyAlpha: 'none' });
          out.png = [bitmap.width, bitmap.height];
        } catch (err) { out.png = String(err); }
        try {
          const svg = new Blob([e.data.svg], { type: 'image/svg+xml' });
          await createImageBitmap(svg);
          out.svg = 'decoded';
        } catch (err) { out.svg = 'refused'; }
        self.postMessage(out);
      };`;

    const result = await page.evaluate(
      async ({ workerSrc, font, png }) => {
        const url = new URL(font, location.href).href;
        const worker = new Worker(
          URL.createObjectURL(
            new Blob([workerSrc], { type: 'text/javascript' }),
          ),
        );
        const out = await new Promise((resolve, reject) => {
          worker.onmessage = (e) => resolve(e.data);
          worker.onerror = (e) => reject(new Error(e.message));
          worker.postMessage({
            font: url,
            png,
            svg: '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8"/></svg>',
          });
        });

        worker.terminate();

        // the page's own advance for the same face
        const face = new FontFace('Mech Page', `url('${url}')`);

        await face.load();
        document.fonts.add(face);

        const ctx = document.createElement('canvas').getContext('2d');

        ctx.font = 'normal normal 32px "Mech Page", sans-serif';
        out.page = ctx.measureText('Hello World').width;

        return out;
      },
      { workerSrc, font: OPEN_SANS, png: QUAD_PNG },
    );

    testInfo.annotations.push({
      type: 'worker mechanics',
      description: JSON.stringify(result),
    });

    // a bytes-registered face reaches worker OffscreenCanvas text,
    // advance for advance with the page's
    expect(result.fresh).toBeCloseTo(result.page, 3);
    // the epoch description re-resolves in every engine, whether or not
    // this one kept the stale description (Chromium does; WebKit not)
    expect(result.epochDescription).toBeCloseTo(result.page, 3);
    expect(result.before).not.toBeCloseTo(result.page, 1);
    // raster sources decode in a worker
    expect(result.png).toEqual([16, 16]);
  });
});

test.describe("an animated layout's tween on both hosts (round 144)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 300 });
    await page.goto(PAGE);
  });

  /** The export's RGBA at a model position (null off the image). */
  const pixelAt = (png, cy, model) => {
    const sx = png.width / cy.width;
    const x = Math.round((model.x * cy.zoom + cy.pan.x) * sx);
    const y = Math.round((model.y * cy.zoom + cy.pan.y) * sx);
    const i = (y * png.width + x) * 4;

    return [png.data[i], png.data[i + 1], png.data[i + 2], png.data[i + 3]];
  };
  const isNode = (px) => px[0] > 180 && px[1] < 90 && px[3] > 200;

  for (const host of ['same-thread', 'worker']) {
    test(`one batch on the device; a stopped node and a node outside the tween draw where position() reads (${host})`, async ({
      page,
    }) => {
      test.skip(!(await hasAdapter(page)), 'no WebGPU adapter here');
      test.skip(
        host === 'worker' && !(await hasWorkerCanvas(page)),
        'no OffscreenCanvas workers',
      );

      // count what crosses to the worker: tween messages, and the bytes
      // of node.position spans in batches
      await page.evaluate(() => {
        const census = {
          tweenregister: 0,
          tweenunregister: 0,
          tweendetach: 0,
          positionSpanBytes: 0,
        };
        const post = Worker.prototype.postMessage;

        window.census = census;
        Worker.prototype.postMessage = function (msg, transfer) {
          if (msg != null && msg.kind in census) {
            census[msg.kind]++;
          }

          if (msg?.kind === 'batch') {
            for (const span of msg.batch.spans) {
              if (span.column === 'node.position') {
                census.positionSpanBytes += span.bytes.byteLength;
              }
            }
          }

          return post.call(this, msg, transfer);
        };
      });

      await makeReadyCy(page, {
        elements: [
          { data: { id: 'a' }, position: { x: -150, y: 0 } },
          { data: { id: 'b' }, position: { x: -150, y: 60 } },
          { data: { id: 'c' }, position: { x: -150, y: -60 } },
          { data: { id: 'd' }, position: { x: 0, y: 110 } },
        ],
        style: {
          nodes: { width: 24, height: 24, 'background-color': '#e22' },
        },
        zoom: 1,
        pan: { x: 200, y: 150 },
        renderer: host === 'worker' ? { worker: true } : undefined,
      });

      const view = await page.evaluate(() => ({
        width: window.cy.width(),
        zoom: window.cy.zoom(),
        pan: window.cy.pan(),
      }));

      // a slow linear tween of the scope a, b, c — d is outside it
      await page.evaluate(() => {
        const cy = window.cy;

        window.log = [];
        cy.on('layoutready layoutstop', (e) => window.log.push(e.type));
        window.layout = cy
          .$id('a')
          .union(cy.$id('b'))
          .union(cy.$id('c'))
          .layout({
            name: 'preset',
            positions: {
              a: { x: 150, y: 0 },
              b: { x: 150, y: 60 },
              c: { x: 150, y: -60 },
            },
            animate: true,
            animationDuration: 6000,
            animationEasing: 'linear',
            fit: false,
          });
        window.layout.run();
      });

      // mid-flight, polled: position() moves (the lease read, round 144)
      await expect
        .poll(() => page.evaluate(() => window.cy.$id('a').position('x')), {
          timeout: 15000,
        })
        .toBeGreaterThan(-140);

      // one batch on the device: the ledger's pooled tween row
      await expect
        .poll(
          () =>
            page.evaluate(
              () =>
                window.cy.stats().gpu.byLabel[
                  'cy-gpu:tween-slots:node.position'
                ]?.count ?? 0,
            ),
          { timeout: 10000 },
        )
        .toBe(1);

      // stop b where it is; move d, which the tween does not own
      const frozen = await page.evaluate(() => {
        const cy = window.cy;

        cy.$id('b').stop();
        cy.$id('d').position({ x: -100, y: 110 });

        return { ...cy.$id('b').position() };
      });

      // let the tween run on well past a node's width (50 px/s): a
      // stopped node the device still moved would leave its place.  A
      // wait, not a poll — what is asserted is that nothing moves
      await page.waitForTimeout(800);

      const snap = await page.evaluate(async () => {
        const png = await window.cy.png();

        return {
          png,
          a: { ...window.cy.$id('a').position() },
          b: { ...window.cy.$id('b').position() },
        };
      });
      const png = decodePng(snap.png);

      expect(snap.b.x).toBeCloseTo(frozen.x, 3); // b holds
      expect(snap.a.x).toBeGreaterThan(frozen.x); // a ran on
      expect(
        isNode(pixelAt(png, view, frozen)),
        'b drawn where it stopped',
      ).toBe(true);
      expect(
        isNode(pixelAt(png, view, { x: -100, y: 110 })),
        'd drawn where it was moved mid-tween',
      ).toBe(true);
      expect(
        isNode(pixelAt(png, view, { x: 0, y: 110 })),
        'd not left at its old place',
      ).toBe(false);
      // a moves ~50 px/s; the export trails the read by a frame or two
      expect(
        isNode(pixelAt(png, view, snap.a)),
        'a drawn where position() reads',
      ).toBe(true);

      // the tween stopped: layoutstop once, and the batch freed
      await page.evaluate(() => window.layout.stop());
      await expect
        .poll(
          () =>
            page.evaluate(
              () =>
                window.cy.stats().gpu.byLabel[
                  'cy-gpu:tween-slots:node.position'
                ]?.count ?? 0,
            ),
          { timeout: 10000 },
        )
        .toBe(0);

      const out = await page.evaluate(() => ({
        log: window.log,
        census: window.census,
        n: window.cy.nodes().length,
      }));

      expect(out.log).toEqual(['layoutready', 'layoutstop']);

      if (host === 'worker') {
        // one registration, one detach (b), one release — and no
        // position span per frame: d's move and b's and the settle's
        // frozen values are all that crossed
        expect(out.census.tweenregister).toBe(1);
        expect(out.census.tweendetach).toBe(1);
        expect(out.census.tweenunregister).toBe(1);
        expect(out.census.positionSpanBytes).toBeLessThan(out.n * 8 * 4);
      }

      await destroyCy(page);
    });
  }
});
