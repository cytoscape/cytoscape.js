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

/** Make the instance, await readiness and one presented frame. */
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
      writeDiffArtifacts(testInfo, 'worker-vs-main', worker, mainThread, diff);
    }

    expect(mismatched).toBe(0);
    await destroyCy(page);
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
        testInfo,
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

  test('create/destroy cycles leave no stuck worker instance', async ({
    page,
  }) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter here');
    test.skip(!(await hasWorkerCanvas(page)), 'no OffscreenCanvas workers');

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

      const f0 = cy.stats().frames;

      layout.run();
      layout.promise().then(() => {
        resolved = true;
      });

      // the main thread's availability while the worker integrates: rAF
      // ticks over the sample — a blocked thread counts none
      let ticks = 0;
      let sampling = true;
      const tick = () => {
        ticks++;

        if (sampling) {
          requestAnimationFrame(tick);
        }
      };

      // the run opens with the force pipelines' compile stall (one frame
      // drawn), then 60 fps.  The stall is ~300 ms on the RX 580 but ~4 s
      // on SwiftShader, where it holds the GPU process and so rAF too
      // (the main thread's timers run on) — measured 2026-09-25.  A fixed
      // 700 ms window from run() fell inside it on CI every time, so wait
      // (bounded) for the second frame, then sample 700 ms from there
      const waitStart = performance.now();

      while (
        cy.stats().frames - f0 < 2 &&
        performance.now() - waitStart < 20000
      ) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      const f1 = cy.stats().frames;

      requestAnimationFrame(tick);
      await new Promise((resolve) => setTimeout(resolve, 700));
      sampling = false;

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
      'the main thread ticked through the run',
    ).toBeGreaterThan(10);
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
