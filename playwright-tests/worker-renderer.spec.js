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
});
