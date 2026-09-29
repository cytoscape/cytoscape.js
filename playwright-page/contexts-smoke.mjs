/*
Round 100.2: the model tier in a browser context with no page — a
dedicated worker, a shared worker and a service worker all import this
module (`contexts-worker.mjs`, `contexts-sw.mjs`), and
`playwright-tests/contexts.spec.js` reads what it answers.

It loads the minified UMD — what a CDN user runs; the UMD sets
`globalThis.cytoscape` when imported as a module — and not the page's
development UMD, whose inline source map makes it 8.9 MB: Chromium will
not start a service worker that imports it ("ServiceWorker cannot be
started", measured 2026-09-29), while the same import in a dedicated
worker, and the minified or the source-map-free UMD in a service worker,
all load.  (`algorithms-workers.spec.js` already reads the minified UMD;
CI's browser job builds every bundle.)  Then it runs the cross-runtime smoke's checks
(`test/runtimes/smoke-checks.mjs` — the same assertions Node, Bun, Deno,
the isolate and workerd run), then the one property a page-less context
adds today: `executor: 'auto'` answers with the reference's values.
The worker pool is not asserted either way — it refuses a host with no
`document` (PLAN.md item 82), and 'auto' is correct whichever lane it
takes.
*/
import '../build/cytoscape.min.js';
import * as checks from '../test/runtimes/smoke-checks.mjs';

/** Run the checks; answer a plain object the context posts back. */
export const runContextSmoke = async (label) => {
  const cytoscape = globalThis.cytoscape;

  try {
    checks.eq(typeof document, 'undefined', `${label}: no document here`);
    await checks.smokeOneBundle(cytoscape, label, null);
    await checks.smokeKind(cytoscape, 'full', label);

    const cy = cytoscape({ ...checks.HEADLESS, elements: checks.FIXTURE() });
    const auto = await cy.elements().pageRank({ iterations: 20 });
    const ref = await cy
      .elements()
      .pageRank({ iterations: 20, executor: 'cpu' });

    for (const id of ['a', 'b', 'c']) {
      checks.eq(
        auto.rank(cy.$id(id)),
        ref.rank(cy.$id(id)),
        `${label}: 'auto' pageRank of ${id} is the reference's`,
      );
    }

    cy.destroy();

    return { ok: true, assertions: checks.assertionCount() };
  } catch (err) {
    return { ok: false, error: String(err?.message ?? err) };
  }
};
