import { test, expect } from '@playwright/test';

/*
Round 74.4: the `'workers'` executor in a real browser.

Two things only a browser can prove: that the Blob-URL worker path
constructs and answers (the Node tier spawns `worker_threads`), and
that the *minified* stringified body survives the minifier — the
unminified UMD serves the page, so the second test swaps in
`build/cytoscape.min.js` and runs the same comparison.

No adapter is needed and there is no `hasAdapter` skip (the
`routing.spec.js` rule: a suite that soft-skips where CI is cheapest
stops running there).  The comparison is cpu-vs-workers on the same
fixture: closeness must match to the bit, betweenness to f64 rounding.
*/

const PAGE = 'http://127.0.0.1:3333/playwright-page/index.html';

const compare = async (page) =>
  await page.evaluate(async () => {
    const n = 320;
    const els = [];

    for (let i = 0; i < n; i++) {
      els.push({ data: { id: 'n' + i } });
    }

    for (let i = 0; i < n; i++) {
      els.push({
        data: {
          source: 'n' + i,
          target: 'n' + ((i + 1) % n),
          w: 1 + ((i * 31) % 7),
        },
      });

      if (i % 3 === 0) {
        els.push({
          data: { source: 'n' + i, target: 'n' + ((i * 13 + 29) % n), w: 2 },
        });
      }
    }

    const cy = cytoscape({ headless: true, elements: els });
    const eles = cy.elements();
    const nodes = cy.nodes();
    const weight = (e) => e.data('w');
    const t0 = performance.now();
    const bcW = await eles.betweennessCentrality({
      weight,
      executor: 'workers',
    });
    const workersMs = performance.now() - t0;
    const t1 = performance.now();
    const bcC = await eles.betweennessCentrality({ weight, executor: 'cpu' });
    const cpuMs = performance.now() - t1;
    const ccW = await eles.closenessCentralityNormalized({
      executor: 'workers',
    });
    const ccC = await eles.closenessCentralityNormalized({ executor: 'cpu' });
    let bcErr = 0;
    let ccBits = true;

    nodes.forEach((node) => {
      const a = bcW.betweenness(node);
      const b = bcC.betweenness(node);

      bcErr = Math.max(bcErr, Math.abs(a - b) / Math.max(1, Math.abs(b)));

      if (ccW.closeness(node) !== ccC.closeness(node)) {
        ccBits = false;
      }
    });

    // a family with neither a pool lane nor an offload lane still
    // rejects an explicit 'workers' (129.1 moved pageRank to the offload
    // lane, so the k-means clustering is the probe now) — and pageRank
    // runs its kernel on one Blob worker, answering 'cpu''s bits
    let noPath = null;

    try {
      await nodes.kMeans({
        k: 2,
        attributes: [(node) => node.data('w') ?? 0],
        executor: 'workers',
      });
    } catch (err) {
      noPath = err.message;
    }

    const prW = await eles.pageRank({ weight, executor: 'workers' });
    const prC = await eles.pageRank({ weight, executor: 'cpu' });
    let prBits = true;

    nodes.forEach((node) => {
      if (prW.rank(node) !== prC.rank(node)) {
        prBits = false;
      }
    });

    const offloads = cytoscape.__algoWorkersStats__().offloads;

    cy.destroy();

    return {
      hardwareConcurrency: navigator.hardwareConcurrency,
      workersMs,
      cpuMs,
      bcErr,
      ccBits,
      noPath,
      prBits,
      offloads,
    };
  });

test.describe('the workers executor in the browser (round 74)', () => {
  test('Blob workers: cpu-vs-workers parity through the served UMD', async ({
    page,
  }) => {
    await page.goto(PAGE);

    const out = await compare(page);

    expect(out.bcErr).toBeLessThan(1e-12);
    expect(out.ccBits).toBe(true);
    expect(out.noPath).toMatch(/no workers path/);
    expect(out.prBits, 'the offload kernel answers the reference bits').toBe(
      true,
    );
    expect(out.offloads).toBeGreaterThan(0);
  });

  test('the minified bundle: the stringified body survives the minifier', async ({
    page,
  }) => {
    await page.goto(PAGE);
    // the served page loads the unminified UMD; swap in the minified
    // one, whose body text is what a CDN consumer's pool evaluates
    await page.addScriptTag({ url: '/build/cytoscape.min.js' });

    const out = await compare(page);

    expect(out.bcErr).toBeLessThan(1e-12);
    expect(out.ccBits).toBe(true);
    expect(out.noPath).toMatch(/no workers path/);
    // the kernels' source text survives the minifier too (129.1)
    expect(out.prBits).toBe(true);
    expect(out.offloads).toBeGreaterThan(0);
  });
});

test.describe('cancellation on the workers executor in the browser (round 128)', () => {
  test('a cancelled Blob-worker run rejects, the pool stands, and the next run agrees with the CPU', async ({
    page,
  }) => {
    await page.goto(PAGE);

    const out = await page.evaluate(async () => {
      const n = 400;
      const els = [];

      for (let i = 0; i < n; i++) {
        els.push({ data: { id: 'n' + i } });
      }

      for (let i = 0; i < n; i++) {
        els.push({
          data: {
            source: 'n' + i,
            target: 'n' + ((i + 1) % n),
            w: 1 + ((i * 31) % 7),
          },
        });

        if (i % 3 === 0) {
          els.push({
            data: { source: 'n' + i, target: 'n' + ((i * 13 + 29) % n), w: 2 },
          });
        }
      }

      const cy = cytoscape({ headless: true, elements: els });
      const eles = cy.elements();
      const weight = (e) => e.data('w');

      await eles.closenessCentralityNormalized({ executor: 'workers' });

      const before = cytoscape.__algoWorkersStats__();
      const run = eles.betweennessCentrality({ weight, executor: 'workers' });

      await new Promise((r) => setTimeout(r, 5));

      const cancelled = run.cancel();
      let name = null;

      try {
        await run;
      } catch (err) {
        name = err.name;
      }

      const w = await eles.closenessCentralityNormalized({
        executor: 'workers',
      });
      const c = await eles.closenessCentralityNormalized({ executor: 'cpu' });
      const after = cytoscape.__algoWorkersStats__();
      let bits = true;

      cy.nodes().forEach((node) => {
        if (w.closeness(node) !== c.closeness(node)) {
          bits = false;
        }
      });

      return {
        cancelled,
        name,
        bits,
        respawned: after.spawns !== before.spawns,
        workers: after.workers,
      };
    });

    expect(out.cancelled).toBe(true);
    expect(out.name).toBe('CancelledError');
    expect(out.bits).toBe(true);
    expect(out.respawned).toBe(false);
    expect(out.workers).toBeGreaterThan(0);
  });
});
