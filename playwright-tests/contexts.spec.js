import { test, expect } from '@playwright/test';

/*
Round 100.2: the model tier in the browser's page-less contexts — a
dedicated worker, a shared worker and a service worker.

Round 100's support matrix (`src/README.md`, "Supported environments")
claims T0 — the headless core — in each of them, and this is the gate
that makes the claim CI's rather than the round's: each context imports
the page's own bundle and runs the cross-runtime smoke's value
assertions (`playwright-page/contexts-smoke.mjs`), and answers how many
ran.  It rides the `renderer` and `renderer-webkit` projects, so Chromium
and WebKit both hold it.  No adapter is needed and nothing soft-skips:
every context named here exists in both engines, and a context that
cannot be constructed fails the test with the reason.

Worklets are recorded, not gated: they fail at module evaluation
(Chromium and Firefox have no `TextDecoder` there, WebKit no
`queueMicrotask`), which the matrix states as unsupported.
*/

const PAGE = 'http://127.0.0.1:3333/playwright-page/index.html';

/** The smoke's answer from one context, or the reason it gave none. */
const runIn = async (page, kind) =>
  await page.evaluate(async (kind) => {
    const within = (promise, what) =>
      Promise.race([
        promise,
        new Promise((resolve) =>
          setTimeout(
            () => resolve({ ok: false, error: `${what}: no answer in 30 s` }),
            30_000,
          ),
        ),
      ]);
    const failed = (target, what) =>
      new Promise((resolve) =>
        target.addEventListener('error', (e) =>
          resolve({ ok: false, error: `${what}: ${e.message ?? e.type}` }),
        ),
      );
    const url = (file) => new URL(file, location.href).href;

    try {
      if (kind === 'dedicated') {
        const w = new Worker(url('contexts-worker.mjs'), { type: 'module' });

        return await within(
          Promise.race([
            new Promise((resolve) => (w.onmessage = (e) => resolve(e.data))),
            failed(w, 'worker'),
          ]),
          'dedicated worker',
        );
      }

      if (kind === 'shared') {
        const w = new SharedWorker(url('contexts-worker.mjs'), {
          type: 'module',
          name: 'contexts-smoke',
        });

        return await within(
          Promise.race([
            new Promise((resolve) => {
              w.port.onmessage = (e) => resolve(e.data);
              w.port.start();
            }),
            failed(w, 'shared worker'),
          ]),
          'shared worker',
        );
      }

      const reg = await navigator.serviceWorker.register(
        url('contexts-sw.mjs'),
        { type: 'module' },
      );

      await navigator.serviceWorker.ready;

      const answer = await within(
        new Promise((resolve) => {
          navigator.serviceWorker.onmessage = (e) => resolve(e.data);
          reg.active.postMessage('run');
        }),
        'service worker',
      );

      await reg.unregister();

      return answer;
    } catch (err) {
      return { ok: false, error: `${kind}: ${err?.message ?? err}` };
    }
  }, kind);

for (const kind of ['dedicated', 'shared', 'service']) {
  test(`the headless core runs in a ${kind} worker`, async ({ page }) => {
    await page.goto(PAGE);

    const answer = await runIn(page, kind);

    expect(answer.error ?? null).toBeNull();
    expect(answer.ok).toBe(true);
    // the smoke's value assertions actually ran (≈50), not a vacuous pass
    expect(answer.assertions).toBeGreaterThan(40);
  });
}
