import {
  EVENT_TYPES,
  SCENE,
  SCRIPTS,
  phasesOf,
  v3PhasesOf,
  v3Scene,
} from './gesture-traces.mjs';

/*
Round 142 (item 31, the trace tier): the replayer — one function that
plays a script from `gesture-traces.mjs` against a live instance on
`parity.html` and returns a snapshot per phase.

It drives v4 through any host (the same-thread renderer, the worker host,
and the WebGL2 backend once round 137 lands) and v3 through its own
container, with the same steps.  Mouse input is trusted Playwright input
(`page.mouse` / `page.keyboard`), so it goes through the real listeners;
touch is `PointerEvent`s dispatched on the canvas, the only multi-touch a
page can produce (round 136: `page.touchscreen` is single-point).

The two traps round 136 wrote down are handled here, once, rather than in
each trace:

- **Delivery, not timing.**  Every mouse step waits for the page to have
  received its DOM event (a capture-phase counter on the window) before
  the next one, and moves are spaced `pace` ms apart — past the 25 ms
  hover and drag-hover throttles — so a browser that coalesces moves
  under load cannot change which moves the gesture saw.
- **Hover is polled, never slept for.**  v4 hover-picks asynchronously on
  the GPU, latest-wins, so a `hover` step nudges the pointer inside the
  target until the pick answers (round 89.3's `hoverOnto`).
*/

/** Polls that wait on a first pick share this (renderer.spec.js's bound). */
const FIRST_PICK_TIMEOUT_MS = 30_000;

/** Mount the scene on a host and install the event recorder. */
const mount = async (page, { lib, options, selected }) => {
  await page.evaluate(
    async ({ lib, scene, v3, options, selected, types }) => {
      const sel = new Set(selected);
      const withSelection = (els) =>
        els.map((e) => (sel.has(e.data.id) ? { ...e, selected: true } : e));
      const cy =
        lib === 'v3'
          ? window.makeV3({ ...v3, elements: withSelection(v3.elements) })
          : window.makeV4({
              ...scene.options,
              ...options,
              elements: withSelection(scene.elements),
              style: scene.style,
              zoom: scene.zoom,
              pan: scene.pan,
            });

      if (lib !== 'v3') {
        await cy.ready;
        await new Promise((resolve) => {
          cy.one('render', () => resolve());
          cy.panBy({ x: 1, y: 0 });
          cy.panBy({ x: -1, y: 0 });
        });
      }

      // `muted` silences the hover nudges' own moves: they are the
      // replayer's mechanics, and how many a pick needs is timing
      const tr = { cy, lib, log: [], dom: 0, muted: false };

      window.__tr = tr;

      for (const type of types) {
        cy.on(type, (e) => {
          if (tr.muted && type === 'pointermove') {
            return;
          }

          tr.log.push(`${type}:${e.target === cy ? 'cy' : e.target.id()}`);
        });
      }

      // the delivery handshake: the replayer waits for this to move
      for (const type of ['pointermove', 'pointerdown', 'pointerup', 'wheel']) {
        window.addEventListener(type, () => tr.dom++, true);
      }
    },
    {
      lib,
      scene: SCENE,
      v3: v3Scene(SCENE),
      options,
      selected,
      types: EVENT_TYPES,
    },
  );
};

/** The container's top-left in page coordinates. */
const originOf = async (page, lib) =>
  await page.evaluate(
    (id) => {
      const r = document.getElementById(id).getBoundingClientRect();

      return { x: r.left, y: r.top };
    },
    lib === 'v3' ? 'v3' : 'v4',
  );

const domCount = async (page) => await page.evaluate(() => window.__tr.dom);

/** Run one input and wait until the page has received a DOM event for it. */
const delivered = async (page, input) => {
  const before = await domCount(page);

  await input();
  await page.waitForFunction((n) => window.__tr.dom > n, before, {
    polling: 'raf',
    timeout: 10_000,
  });
};

const sleep = (page, ms) =>
  ms > 0 ? page.waitForTimeout(ms) : Promise.resolve();

const frames = async (page, n) => {
  await page.evaluate(async (n) => {
    for (let i = 0; i < n; i++) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  }, n);
};

/** Wait until the event log stops growing (two quiet 50 ms polls). */
const quiesce = async (page) => {
  await frames(page, 2);

  let last = -1;
  let quiet = 0;

  while (quiet < 2) {
    const n = await page.evaluate(() => window.__tr.log.length);

    quiet = n === last ? quiet + 1 : 0;
    last = n;
    await page.waitForTimeout(50);
  }
};

const hoveredId = async (page) =>
  await page.evaluate(() => {
    const { cy, lib } = window.__tr;

    if (lib === 'v3') {
      return undefined; // v3 keeps no hover state to read
    }

    const h = cy.elements({ hovered: true });

    return h.length === 0 ? null : h[0].id();
  });

/** Snapshot every end-state field, and start the next phase's log. */
const snapshot = async (page) =>
  await page.evaluate(() => {
    const tr = window.__tr;
    const { cy, lib } = tr;
    const r = (n) => Math.round(n * 1e6) / 1e6;
    const ids = (c) =>
      c
        .map((e) => e.id())
        .slice()
        .sort();
    const positions = {};

    cy.nodes().forEach((n) => {
      const p = n.position();

      positions[n.id()] = { x: r(p.x), y: r(p.y) };
    });

    const pan = cy.pan();
    const out = {
      positions,
      selection: ids(
        lib === 'v3'
          ? cy.elements(':selected')
          : cy.elements({ selected: true }),
      ),
      viewport: { zoom: r(cy.zoom()), pan: { x: r(pan.x), y: r(pan.y) } },
      grabbed: ids(
        lib === 'v3' ? cy.nodes(':grabbed') : cy.nodes({ grabbed: true }),
      ),
      hovered: lib === 'v3' ? null : ids(cy.elements({ hovered: true })),
      events: tr.log,
    };

    tr.log = [];

    return out;
  });

/**
 * Replay a script and snapshot each phase.
 *
 * @param page — a Playwright page on `parity.html`
 * @param trace — a `SCRIPTS` key
 * @param host — `{ lib: 'v4' | 'v3', options }`
 * @returns `{ phases: { name: snapshot } }`, with raw event logs, over
 *   the phases this library replays
 */
export const replay = async (page, trace, host) => {
  const script = SCRIPTS[trace];
  const lib = host.lib ?? 'v4';
  const wanted = lib === 'v3' ? v3PhasesOf(script) : phasesOf(script);

  await mount(page, {
    lib,
    options: host.options ?? {},
    selected: script.selected ?? [],
  });

  const o = await originOf(page, lib);
  const at = ([x, y]) => ({ x: o.x + x, y: o.y + y });
  const mouse = { x: 0, y: 0 };
  const touches = new Map();
  const phases = {};

  const moveTo = async (p) => {
    const q = at(p);

    await delivered(page, () => page.mouse.move(q.x, q.y));
    mouse.x = p[0];
    mouse.y = p[1];
  };

  const touch = async (type, id, p) => {
    await page.evaluate(
      ({ type, id, x, y }) => {
        const canvas = document.querySelector('#v4 canvas');
        const rect = canvas.getBoundingClientRect();

        canvas.dispatchEvent(
          new PointerEvent(type, {
            pointerId: id,
            pointerType: 'touch',
            clientX: rect.left + x,
            clientY: rect.top + y,
            button: type === 'pointermove' ? -1 : 0,
            buttons: type === 'pointerup' ? 0 : 1,
            bubbles: true,
          }),
        );
      },
      { type, id, x: p[0], y: p[1] },
    );
  };

  for (const step of script.steps) {
    if (lib === 'v3' && typeof step.v3 === 'string') {
      continue; // an option v3 does not have; the step says so
    }

    if (step.mark != null) {
      await quiesce(page);
      phases[step.mark] = await snapshot(page);

      if (lib === 'v3' && step.mark === script.v3) {
        break; // v3 stops at its last shared phase
      }
    } else if (step.hover != null || step.leave != null) {
      const p = step.hover ?? step.leave;

      await moveTo(p);

      if (lib === 'v3') {
        continue; // v3 hover-picks synchronously on the move
      }

      const deadline = Date.now() + FIRST_PICK_TIMEOUT_MS;

      while ((await hoveredId(page)) !== step.expect) {
        if (Date.now() > deadline) {
          throw new Error(
            `${trace}: the hover at ${p} never answered ${step.expect} ` +
              `(last ${await hoveredId(page)})`,
          );
        }

        if (step.leave != null) {
          await page.waitForTimeout(30); // outside: nothing to nudge
          continue;
        }

        // the hover pick is throttled and latest-wins: nudge inside the
        // target until one lands (round 89.3's hoverOnto), unrecorded
        await page.evaluate(() => (window.__tr.muted = true));
        await sleep(page, 30);
        await moveTo([p[0] + 1, p[1]]);
        await sleep(page, 30);
        await moveTo(p);
        await page.evaluate(() => (window.__tr.muted = false));
      }
    } else if (step.down != null) {
      await delivered(page, () => page.mouse.down({ button: step.down }));
    } else if (step.up != null) {
      await delivered(page, () => page.mouse.up({ button: step.up }));
    } else if (step.drag != null) {
      const from = [mouse.x, mouse.y];
      const n = step.steps ?? 1;

      for (let i = 1; i <= n; i++) {
        await sleep(page, step.pace ?? 30);
        await moveTo([
          from[0] + ((step.drag[0] - from[0]) * i) / n,
          from[1] + ((step.drag[1] - from[1]) * i) / n,
        ]);
      }
    } else if (step.key != null) {
      await (step.held
        ? page.keyboard.down(step.key)
        : page.keyboard.up(step.key));
    } else if (step.wheel != null) {
      for (let i = 0; i < (step.times ?? 1); i++) {
        await delivered(page, () =>
          page.mouse.wheel(step.wheel[0], step.wheel[1]),
        );
        await quiesce(page);
      }
    } else if (step.touch != null) {
      await touch(`pointer${step.touch}`, step.id, step.at);

      if (step.touch === 'up') {
        touches.delete(step.id);
      } else {
        touches.set(step.id, step.at);
      }

      await sleep(page, 30);
    } else if (step.touches != null) {
      const n = step.steps ?? 1;
      const from = new Map(
        Object.keys(step.touches).map((id) => [id, touches.get(Number(id))]),
      );

      for (let i = 1; i <= n; i++) {
        for (const [id, to] of Object.entries(step.touches)) {
          const f = from.get(id);
          const p = [
            f[0] + ((to[0] - f[0]) * i) / n,
            f[1] + ((to[1] - f[1]) * i) / n,
          ];

          await touch('pointermove', Number(id), p);
          touches.set(Number(id), p);
        }

        await sleep(page, 30);
      }
    } else if (step.set != null) {
      await quiesce(page);
      await page.evaluate((set) => {
        const { cy } = window.__tr;

        for (const [name, value] of Object.entries(set)) {
          cy[name](value);
        }
      }, step.set);
    } else if (step.tween != null) {
      // round 144: an animated layout's tween over these nodes, targets
      // where they stand — they are tweening, and move nowhere, so the
      // phase is as deterministic as any other
      await quiesce(page);
      await page.evaluate((ids) => {
        const { cy } = window.__tr;
        const positions = {};
        let eles = cy.collection();

        for (const id of ids) {
          eles = eles.union(cy.$id(id));
          positions[id] = { ...cy.$id(id).position() };
        }

        eles
          .layout({
            name: 'preset',
            positions,
            animate: true,
            animationDuration: 1e7,
            fit: false,
          })
          .run();
      }, step.tween);
    } else if (step.stop != null) {
      await quiesce(page);
      await page.evaluate((ids) => {
        for (const id of ids) {
          window.__tr.cy.$id(id).stop();
        }
      }, step.stop);
    } else if (step.viewport != null) {
      await quiesce(page);
      await page.evaluate((v) => window.__tr.cy.viewport(v), step.viewport);
    } else if (step.wait != null) {
      await sleep(page, step.wait);
      await frames(page, 5);
    } else {
      throw new Error(`${trace}: unknown step ${JSON.stringify(step)}`);
    }
  }

  if (wanted.includes('end')) {
    await quiesce(page);
    phases.end = await snapshot(page);
  }

  // leave the keyboard as it was found, whatever the script did
  for (const key of ['Shift', 'Control']) {
    await page.keyboard.up(key);
  }

  return { phases };
};
