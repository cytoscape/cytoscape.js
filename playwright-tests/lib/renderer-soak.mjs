/*
The renderer soak (round 138, PLAN.md item 34): churn the GPU side and
read the renderer's own allocation ledger (`cy.stats().gpu`), which
counts every buffer and texture its device creates and destroys — Dawn
exposes no memory meter, so the instrumentation is the renderer's.

`soakInPage` is handed to `page.evaluate` by `playwright-tests/soak.spec.js`
(the CI-sized run) and by `benchmark/scale-ceiling.mjs --soak` (the
hardware run the item's first measurement was taken with).  At a fixed
graph size, a cycle removes `churn` random nodes (their edges go with
them), adds nodes and edges back to size, writes one mapped data value
and one bypass, and sets a new zoom — then waits for a frame.  Every
`block` cycles it drains the queue (so the renderer's deferred destroys
have run) and samples the ledger.

`leakBytes > 0` is the probe's own control: every cycle also creates a
buffer of that size on the renderer's device and never destroys it.  The
ledger must show it, or every flat reading after it proves nothing.

The verdict is `trend()`: growth that trends is the failure.  A pool
that settles at a high water after a warm-up — the glyph streams double
once as tombstones accumulate — is not a leak, so the judgement is over
the second half of the samples: flat means every one of them equal.
*/

/**
 * The in-page soak.  Self-contained (it is serialized into the page):
 * no imports, no closure.  Needs `window.makeCy` (the Playwright page).
 *
 * @param {object} o
 * @param {number} o.cycles — cycles to run
 * @param {number} o.block — cycles per ledger sample
 * @param {number} o.nodes — the fixed node count
 * @param {number} o.edges — the fixed edge count
 * @param {number} o.churn — nodes removed and re-added per cycle
 * @param {number} [o.leakBytes] — the control: bytes leaked per cycle
 * @param {number} [o.seed] — the churn's PRNG seed
 * @returns {Promise<{ ms: number, samples: object[] }>}
 */
export async function soakInPage(o) {
  const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
  let seed = o.seed ?? 7;
  const rnd = () => (seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32;
  const N = o.nodes;
  const M = o.edges;
  const els = [];

  for (let i = 0; i < N; i++) {
    els.push({
      data: { id: 'n' + i, w: i % 10, label: 'n' + i },
      position: { x: (i % 20) * 30, y: Math.floor(i / 20) * 30 },
    });
  }

  for (let j = 0; j < M; j++) {
    els.push({
      data: {
        id: 'e' + j,
        source: 'n' + Math.floor(rnd() * N),
        target: 'n' + Math.floor(rnd() * N),
      },
    });
  }

  const cy = window.makeCy({
    elements: els,
    // the adaptive render scale reallocates the scene and depth targets
    // at whatever scale the load drives — real allocations, bounded, and
    // timing-dependent (SwiftShader under parallel workers moved them
    // mid-run) — so the soak pins the scale and the ledger is exact
    renderer: { renderScaleMin: 1, renderScaleMax: 1 },
    style: {
      nodes: {
        label: { data: 'label' },
        width: { data: 'w', domain: [0, 10], range: [8, 20] },
        'background-color': {
          data: 'w',
          domain: [0, 10],
          range: 'viridis',
        },
      },
      edges: { 'curve-style': 'bezier', width: 1 },
    },
  });

  await cy.ready;

  const samples = [];
  let next = N;
  const sample = async (cycle) => {
    await cy.renderer().device.queue.onSubmittedWorkDone();
    await frame();
    await frame();

    // a browser launched with --js-flags=--expose-gc (the probe's --soak)
    // collects first, so the heap figure is what is reachable, not what
    // the collector has yet to visit
    if (typeof globalThis.gc === 'function') {
      globalThis.gc();
    }

    const g = cy.stats().gpu;

    samples.push({
      cycle,
      liveBytes: g.liveBytes,
      allocations: g.allocations,
      buffers: g.buffers,
      textures: g.textures,
      errors: g.errors,
      nodes: cy.nodes().length,
      edges: cy.edges().length,
      heapMB: performance.memory
        ? +(performance.memory.usedJSHeapSize / 1e6).toFixed(1)
        : null,
    });
  };
  const t0 = performance.now();

  await sample(0);

  for (let i = 0; i < o.cycles; i++) {
    const ns = cy.nodes();
    let victims = cy.collection();

    for (let k = 0; k < o.churn; k++) {
      victims = victims.union(ns[Math.floor(rnd() * ns.length)]);
    }

    cy.remove(victims);

    const nodeDefs = [];

    for (let n = cy.nodes().length; n < N; n++) {
      nodeDefs.push({
        group: 'nodes',
        data: { id: 'x' + next, w: next % 10, label: 'x' + next },
        position: { x: rnd() * 600, y: rnd() * 600 },
      });
      next++;
    }

    cy.add(nodeDefs);

    const ids = cy.nodes().map((n) => n.id());
    const edgeDefs = [];

    for (let m = cy.edges().length; m < M; m++) {
      edgeDefs.push({
        group: 'edges',
        data: {
          source: ids[Math.floor(rnd() * ids.length)],
          target: ids[Math.floor(rnd() * ids.length)],
        },
      });
    }

    cy.add(edgeDefs);
    // restyle: a mapped data write and a bypass
    cy.nodes()[Math.floor(rnd() * N)].data('w', Math.floor(rnd() * 10));
    cy.nodes()[Math.floor(rnd() * N)].style('border-width', rnd() * 4);
    cy.zoom({
      level: 0.5 + rnd() * 2,
      renderedPosition: { x: 300, y: 300 },
    });

    if (o.leakBytes > 0) {
      // the control: allocated on the renderer's device, never destroyed
      cy.renderer().device.createBuffer({
        label: 'soak-leak',
        size: o.leakBytes,
        usage: 0x0008, // COPY_DST
      });
    }

    await frame();

    if ((i + 1) % o.block === 0) {
      await sample(i + 1);
    }
  }

  const ms = performance.now() - t0;

  cy.destroy();

  return { ms, samples };
}

/**
 * The verdict on one series of samples: over the second half, flat
 * means every sample equal; `growth` is the last minus the first of
 * that half.  The first half is the warm-up a pool may settle in.
 *
 * @param {number[]} series — one ledger figure per sample, in order
 * @returns {{ flat: boolean, growth: number, from: number, to: number }}
 */
export const trend = (series) => {
  const tail = series.slice(Math.floor(series.length / 2));
  const from = tail[0];
  const to = tail[tail.length - 1];

  return {
    flat: tail.every((v) => v === from),
    growth: to - from,
    from,
    to,
  };
};
