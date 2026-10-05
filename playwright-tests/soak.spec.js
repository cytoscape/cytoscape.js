import { test, expect } from '@playwright/test';
import { soakInPage, trend } from './lib/renderer-soak.mjs';

/*
The renderer soak tier (round 138, PLAN.md item 34).  `test:soak` churns
the model under `--expose-gc`; nothing churned the GPU side.  These specs
churn it and read the renderer's own allocation ledger (`cy.stats().gpu`
— every buffer and texture the device creates, counted at creation and
at `destroy()`), because Dawn exposes no memory meter.  The driver and
the verdict are `lib/renderer-soak.mjs`; the hardware run the item's
first measurement was taken with is `benchmark/scale-ceiling.mjs --soak`
(10,000 cycles on the RX 580, recorded in the round).

**The first spec is the probe's own control** (testing.md's rule for any
leak gate): a buffer leaked per cycle must show, to the byte, or every
flat reading after it passes by doing nothing.

The sizes here are CI's.  The figures are the ledger's, so they are
deterministic: "flat" is exact equality over the second half of the
samples, not a tolerance.

**The budgets are measured, on SwiftShader** (CI=1 pins it).  Alone on a
16-thread desktop the three specs take 20 s, 34 s and 45 s; pinned to
four cores with two workers — a GitHub runner's shape, where the two
soaks run side by side — 55 s, 90 s and 60 s; and the runner itself is
about twice slower again (device loss took 2.0 min there, CI run
37331587280).  That put the first two at ~110 s and ~180 s against
budgets of 120 s and 180 s, and both timed out on every retry — their
first CI run, since every run after round 138.4 had died earlier on the
GeneMANIA fixture.  Each budget is now about twice the runner's figure.
*/

const PAGE = 'http://127.0.0.1:3333/playwright-page/index.html';

const hasAdapter = async (page) =>
  page.evaluate(async () => {
    if (navigator.gpu == null) {
      return false;
    }

    return (await navigator.gpu.requestAdapter()) != null;
  });

/** 200 labelled nodes, 400 bezier edges, a mapper and a bypass per cycle */
const SCENE = { nodes: 200, edges: 400, churn: 10 };

test.describe('the renderer soak (round 138)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
  });

  test('control: a buffer leaked every cycle shows in the ledger, to the byte', async ({
    page,
  }) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');
    test.setTimeout(240000);

    const LEAK = 4096;
    const { samples } = await page.evaluate(soakInPage, {
      ...SCENE,
      cycles: 100,
      block: 10,
      leakBytes: LEAK,
    });
    const live = trend(samples.map((s) => s.liveBytes));
    const allocations = trend(samples.map((s) => s.allocations));

    // eleven samples: the second half runs from cycle 50 to cycle 100
    expect(samples.map((s) => s.cycle)).toEqual([
      0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100,
    ]);
    expect(live.flat).toBe(false);
    // exactly the leak: nothing else moved over those 50 cycles
    expect(live.growth).toBe(50 * LEAK);
    expect(allocations.growth).toBe(50);
  });

  test('add / remove / restyle / zoom at a fixed size: the ledger stays flat', async ({
    page,
  }) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');
    test.setTimeout(360000);

    const { samples } = await page.evaluate(soakInPage, {
      ...SCENE,
      cycles: 200,
      block: 20,
    });

    // the scene held its size, and the device raised nothing
    for (const s of samples) {
      expect(s.nodes).toBe(SCENE.nodes);
      expect(s.edges).toBe(SCENE.edges);
      expect(s.errors).toBe(0);
    }

    for (const figure of ['liveBytes', 'allocations', 'buffers', 'textures']) {
      const t = trend(samples.map((s) => s[figure]));

      expect(t, figure).toMatchObject({ flat: true, growth: 0 });
    }

    // and it was a real scene: megabytes live, a hundred-odd buffers
    expect(samples.at(-1).liveBytes).toBeGreaterThan(1e6);
    expect(samples.at(-1).buffers).toBeGreaterThan(100);
  });

  test('device loss and recovery, five times: the same ledger each time, the lost one closed', async ({
    page,
  }) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');
    test.setTimeout(240000);

    const out = await page.evaluate(async () => {
      const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
      const els = [];

      for (let i = 0; i < 200; i++) {
        els.push({
          data: { id: 'n' + i, label: 'n' + i, w: i % 10 },
          position: { x: (i % 20) * 30, y: Math.floor(i / 20) * 30 },
        });
      }

      for (let j = 0; j < 400; j++) {
        els.push({
          data: {
            id: 'e' + j,
            source: 'n' + (j % 200),
            target: 'n' + ((j * 7) % 200),
          },
        });
      }

      const cy = window.makeCy({
        elements: els,
        renderer: { renderScaleMin: 1, renderScaleMax: 1 }, // as the soak
        style: {
          nodes: {
            label: { data: 'label' },
            'background-color': {
              data: 'w',
              domain: [0, 10],
              range: 'viridis',
            },
          },
          edges: { 'curve-style': 'bezier' },
        },
      });

      await cy.ready;

      const settle = async () => {
        await cy.renderer().device.queue.onSubmittedWorkDone();
        cy.panBy({ x: 1, y: 0 });
        await frame();
        await frame();
        await frame();
      };

      await settle();

      const first = {
        liveBytes: cy.stats().gpu.liveBytes,
        allocations: cy.stats().gpu.allocations,
        listeners: cy._emitter.listeners.length,
      };
      const recoveries = [];

      for (let k = 0; k < 5; k++) {
        const old = cy.renderer();
        const restored = new Promise((r) => cy.one('devicerestored', r));

        old._debugLoseDevice();
        await restored;
        await settle();

        recoveries.push({
          liveBytes: cy.stats().gpu.liveBytes,
          allocations: cy.stats().gpu.allocations,
          listeners: cy._emitter.listeners.length,
          fresh: cy.renderer() !== old,
          oldClosed: old.ledger.closed,
          oldLive: old.ledger.snapshot().liveBytes,
          drew: cy.stats().frames > 0,
        });
      }

      cy.destroy();

      return { first, recoveries };
    });

    expect(out.first.liveBytes).toBeGreaterThan(1e6);

    for (const r of out.recoveries) {
      // each recovered renderer rebuilds exactly what the first one
      // held, and the core gained no listener per recovery
      expect(r).toEqual({
        liveBytes: out.first.liveBytes,
        allocations: out.first.allocations,
        listeners: out.first.listeners,
        fresh: true,
        oldClosed: true,
        oldLive: 0,
        drew: true,
      });
    }
  });
});
