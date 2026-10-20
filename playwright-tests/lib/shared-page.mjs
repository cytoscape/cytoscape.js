/*
One page per worker, reset between tests instead of reloaded.

Every renderer in a realm shares one WebGPU device and its compiled
pipelines (src/gpu-context.mts), but a fresh page is a fresh realm: on
the SwiftShader adapter that recompile was ~3.4 s of every spec's first
frame.  This `test` keeps a worker's page alive across its specs, so
only the worker's first spec pays it.

It is a drop-in for `@playwright/test`'s: a spec's own `page.goto(url)`
to playwright-page/index.html, when the page is already there, resets it
in place instead of navigating —

- every instance `cytoscape()` made is destroyed, and the DOM nodes,
  attributes and window globals the last spec added are removed;
- methods it stubbed on `console`, `navigator`, `navigator.gpu`, `document` or
  the canvas, GPU and Worker prototypes are put back, and the page is
  scrolled to the top;
- the listeners, routes and init scripts it registered on the Page are
  dropped.

A spec that changes what a reset cannot undo — redefines
`navigator.gpu`, opens a CDP session (device-metrics emulation), adds an
init script or a route — marks the page dirty, and the next `goto`
navigates for real.  So does `page.reload()`.  A spec that needs a realm
with no device yet (one that stubs the adapter, as limits.spec.js does)
imports `@playwright/test` instead.  A failed spec tears
the worker, and so the page, down (Playwright's own rule), so a broken
page is never handed on.
*/

import { test as base, expect } from '@playwright/test';

/** The pages a reset knows how to return to: the plain spec page. */
const RESETTABLE = /\/playwright-page\/index\.html$/;

/** Installed after each real navigation: the snapshot a reset returns to. */
const install = () => {
  const orig = window.cytoscape;
  const instances = [];

  if (typeof orig !== 'function') {
    return; // not a Cytoscape page: nothing to reset to
  }

  window.cytoscape = new Proxy(orig, {
    apply(target, self, args) {
      const cy = Reflect.apply(target, self, args);

      instances.push(cy);

      return cy;
    },
  });

  const nodes = new Set(document.querySelectorAll('*'));
  const attrs = new Map(
    [...nodes].map((el) => [
      el,
      [...el.attributes].map((a) => [a.name, a.value]),
    ]),
  );
  // the window's globals, and the objects specs stub methods on
  // (console.warn, a canvas getContext, an adapter's requestAdapter): any
  // own property added is deleted and any changed is put back — by
  // descriptor, never by assignment, which would freeze a replaceable
  // accessor such as window.innerWidth at its old value
  const guarded = [
    window,
    console,
    navigator,
    navigator.gpu,
    document,
    document.fonts,
    HTMLCanvasElement.prototype,
    globalThis.OffscreenCanvas?.prototype,
    globalThis.GPU?.prototype,
    globalThis.GPUAdapter?.prototype,
    globalThis.GPUDevice?.prototype,
    Worker.prototype,
  ]
    .filter((o) => o != null)
    .map((o) => [o, Object.getOwnPropertyDescriptors(o)]);

  window.__sharedPage = {
    gpu: navigator.gpu,
    reset() {
      for (const cy of instances.splice(0)) {
        try {
          cy.destroy();
        } catch {
          // already destroyed by the spec
        }
      }

      for (const el of document.querySelectorAll('*')) {
        if (!nodes.has(el)) {
          el.remove();
        }
      }

      for (const [el, list] of attrs) {
        for (const a of [...el.attributes]) {
          el.removeAttribute(a.name);
        }

        for (const [name, value] of list) {
          el.setAttribute(name, value);
        }
      }

      for (const [o, descs] of guarded) {
        for (const k of Reflect.ownKeys(o)) {
          if (!(k in descs) && k !== '__sharedPage') {
            delete o[k];
          }
        }

        for (const [k, d] of Object.entries(descs)) {
          const now = Object.getOwnPropertyDescriptor(o, k);

          if (
            now?.value !== d.value ||
            now?.get !== d.get ||
            now?.set !== d.set
          ) {
            try {
              Object.defineProperty(o, k, d);
            } catch {
              // non-configurable: it cannot have changed
            }
          }
        }
      }

      window.scrollTo(0, 0);

      return navigator.gpu === this.gpu;
    },
  };
};

/** Make `page` reset in place on a same-URL `goto`, and track dirt. */
const share = (page) => {
  const goto = page.goto.bind(page);
  const added = [];
  let dirty = false;

  for (const name of ['on', 'addListener', 'once', 'prependListener']) {
    const orig = page[name].bind(page);

    page[name] = (event, cb) => {
      added.push([event, cb]);

      return orig(event, cb);
    };
  }

  for (const name of ['route', 'routeFromHAR', 'addInitScript']) {
    const orig = page[name].bind(page);

    page[name] = (...args) => {
      dirty = true;

      return orig(...args);
    };
  }

  const context = page.context();
  const newCDPSession = context.newCDPSession.bind(context);

  context.newCDPSession = (...args) => {
    dirty = true;

    return newCDPSession(...args);
  };

  page.goto = async (url, options) => {
    if (!dirty && page.url() === url && RESETTABLE.test(url)) {
      const clean = await page
        .evaluate(() => window.__sharedPage?.reset() ?? false)
        .catch(() => false);

      if (clean === true) {
        return null;
      }
    }
    dirty = false;

    const response = await goto(url, options);

    await page.evaluate(install);

    return response;
  };

  /** End of a spec: drop what it registered on the Page. */
  return async () => {
    for (const [event, cb] of added.splice(0)) {
      page.off(event, cb);
    }

    if (dirty) {
      await page.unrouteAll({ behavior: 'ignoreErrors' });
    }
  };
};

export const test = base.extend({
  sharedPage: [
    async ({ browser }, use, workerInfo) => {
      const { viewport, deviceScaleFactor, userAgent, hasTouch, isMobile } =
        workerInfo.project.use;
      const context = await browser.newContext({
        viewport,
        deviceScaleFactor,
        userAgent,
        hasTouch,
        isMobile,
      });
      const page = await context.newPage();
      const cleanup = share(page);

      await use({ page, cleanup });
      await context.close();
    },
    { scope: 'worker' },
  ],
  page: async ({ sharedPage }, use) => {
    await use(sharedPage.page);
    await sharedPage.cleanup();
  },
});

export { expect };
