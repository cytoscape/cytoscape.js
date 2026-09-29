import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { TRACES } from './lib/gesture-inventory.mjs';
import {
  HOSTS,
  PARITY_PAGE,
  SCRIPTS,
  V3_DIVERGENCES,
  V3_SHARED,
  V3_FIELDS,
  compareSnapshots,
  formatDiffs,
  normalizeLog,
  phasesOf,
  readRecord,
  sortRuns,
  v3PhasesOf,
  writeRecord,
} from './lib/gesture-traces.mjs';
import { replay } from './lib/trace-replay.mjs';

/*
Round 142 (item 31, the trace tier): the scripted gesture traces,
replayed and compared numerically.

Each trace in `lib/gesture-traces.mjs` is played by `lib/trace-replay.mjs`
on `parity.html` and snapshotted per phase — positions, the selection,
the viewport, the grabbed and hovered sets, and the normalized event
log, as far as the inventory's `TRACES` entry names them.  Every v4 host
in `HOSTS` is held to the same checked-in record
(`playwright-tests/gesture-traces/<trace>.json`); v3 replays the mouse
traces on its own container and is compared on the fields both
libraries have, its known differences asserted in `V3_DIVERGENCES`.

Regenerate the records after an intended change in gesture behaviour
with `UPDATE_GESTURE_TRACES=1 npx playwright test gestures -g webgpu`
(the same-thread host writes; review the diff — it is the behaviour).

No pixels are read, but the v4 hosts need a GPU: the hover and edge
picks are GPU picks.  They soft-skip without an adapter, as every
renderer spec does; the v3 half needs none and never skips.  The spec
rides the `visual` project, which pins SwiftShader and already builds
both bundles for this page.
*/

const UPDATE = !!process.env.UPDATE_GESTURE_TRACES;

const hasAdapter = async (page) =>
  await page.evaluate(async () => {
    if (navigator.gpu == null) {
      return false;
    }

    return (await navigator.gpu.requestAdapter()) != null;
  });

const hasWorkerCanvas = async (page) =>
  await page.evaluate(
    () =>
      typeof Worker !== 'undefined' &&
      typeof OffscreenCanvas !== 'undefined' &&
      HTMLCanvasElement.prototype.transferControlToOffscreen != null,
  );

/** The record's form of a replay: the trace's fields, events normalized. */
const recordOf = (trace, replayed) => {
  const fields = TRACES[trace].endState;
  const phases = {};

  for (const [name, snap] of Object.entries(replayed.phases)) {
    phases[name] = {};

    for (const field of fields) {
      phases[name][field] =
        field === 'events' ? normalizeLog(snap.events) : snap[field];
    }
  }

  return { phases };
};

/** Replay on a v4 host and hold it to the record (or write it). */
const checkV4 = async (page, trace, host) => {
  const record = recordOf(
    trace,
    await replay(page, trace, { lib: 'v4', options: host.options }),
  );

  expect(Object.keys(record.phases)).toEqual(phasesOf(SCRIPTS[trace]));

  if (UPDATE) {
    if (host.id === HOSTS[0].id) {
      writeRecord(trace, record);
    }

    return;
  }

  const stored = readRecord(trace);

  expect(
    stored,
    `no record for the trace '${trace}'; run with UPDATE_GESTURE_TRACES=1 -g ${HOSTS[0].id}`,
  ).not.toBeNull();

  const diffs = [];

  for (const phase of phasesOf(SCRIPTS[trace])) {
    const d = compareSnapshots(
      stored.phases[phase],
      record.phases[phase],
      TRACES[trace].endState,
    );

    if (d.length > 0) {
      diffs.push(formatDiffs(`${host.id} ${trace}/${phase}`, d));
    }
  }

  expect(diffs.join('\n'), `${trace} on ${host.id} left its record`).toBe('');
};

for (const host of HOSTS) {
  test.describe(`gesture traces on the ${host.id} host (round 142)`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(PARITY_PAGE);
      await page.waitForFunction(() => window.makeV4 != null);

      test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

      if (host.needs === 'worker-canvas') {
        test.skip(!(await hasWorkerCanvas(page)), 'no OffscreenCanvas workers');
      }
    });

    test('trace drag: a node drag, then a selected node drags the selection', async ({
      page,
    }) => {
      await checkV4(page, 'drag', host);
    });

    test('trace box-select: a shift box adds, a panning-off box replaces', async ({
      page,
    }) => {
      await checkV4(page, 'box-select', host);
    });

    test('trace wheel-zoom: each wheelBehavior, the modifiers and the clamp', async ({
      page,
    }) => {
      await checkV4(page, 'wheel-zoom', host);
    });

    test('trace pinch: a spread, a pinch over a grab, a pinch with zooming off', async ({
      page,
    }) => {
      await checkV4(page, 'pinch', host);
    });

    test('trace cxt-press: a right click, a right drag, a right click on an edge', async ({
      page,
    }) => {
      await checkV4(page, 'cxt-press', host);
    });

    test('trace grab-and-throw: nothing moves after a fast release', async ({
      page,
    }) => {
      await checkV4(page, 'grab-and-throw', host);
    });

    test('trace tap-select: single, additive by key and by selectionType, edge, background, dbltap', async ({
      page,
    }) => {
      await checkV4(page, 'tap-select', host);
    });

    test('trace drag-pan: background, a locked node, and panning off', async ({
      page,
    }) => {
      await checkV4(page, 'drag-pan', host);
    });

    test('trace touch-tap-drag: one finger taps, drags a node and pans', async ({
      page,
    }) => {
      await checkV4(page, 'touch-tap-drag', host);
    });

    test('trace pointer-leave: leaving the canvas ends the hover', async ({
      page,
    }) => {
      await checkV4(page, 'pointer-leave', host);
    });
  });
}

test.describe('gesture traces on v3, against the v4 record (round 142)', () => {
  test.beforeAll(() => {
    const bundle = path.resolve(
      process.cwd(),
      'v3',
      'build',
      'cytoscape.umd.js',
    );

    if (!existsSync(bundle)) {
      throw new Error(
        "v3's UMD bundle is missing, so the v3 trace comparison cannot run.\n" +
          'Build it first:  cd v3 && npm install && npm run build:umd',
      );
    }
  });

  test.beforeEach(async ({ page }) => {
    await page.goto(PARITY_PAGE);
    await page.waitForFunction(() => window.makeV3 != null);
  });

  for (const trace of Object.keys(SCRIPTS)) {
    const phases = v3PhasesOf(SCRIPTS[trace]);

    if (phases.length === 0) {
      continue; // the script says why (touch traces)
    }

    test(`v3 trace ${trace}`, async ({ page }) => {
      test.skip(UPDATE, 'the v4 records are being rewritten');

      const stored = readRecord(trace);
      const replayed = await replay(page, trace, { lib: 'v3' });
      const fields = TRACES[trace].endState.filter((f) =>
        V3_FIELDS.includes(f),
      );
      const unexpected = [];
      const seen = new Set();

      for (const phase of phases) {
        const v4 = stored.phases[phase];
        const v3 = replayed.phases[phase];
        const shared = (events) =>
          sortRuns(
            events.filter(
              (e) => !e.startsWith('~') && V3_SHARED.has(e.split(':')[0]),
            ),
          );
        const diffs = compareSnapshots(
          { ...v4, events: shared(v4.events ?? []) },
          { ...v3, events: sortRuns(normalizeLog(v3.events, V3_SHARED)) },
          fields,
        );

        if (process.env.DEBUG_TRACES && diffs.length > 0) {
          console.log(
            `${trace}/${phase}\n  v4 ${shared(v4.events ?? []).join(' ')}\n  v3 ${sortRuns(normalizeLog(v3.events, V3_SHARED)).join(' ')}`,
          );
        }

        for (const field of new Set(diffs.map((d) => d.field))) {
          const key = `${trace}/${phase}/${field}`;

          if (key in V3_DIVERGENCES) {
            seen.add(key);
          } else {
            unexpected.push(
              formatDiffs(
                `v3 ${trace}/${phase}`,
                diffs.filter((d) => d.field === field),
              ),
            );
          }
        }
      }

      const stale = Object.keys(V3_DIVERGENCES).filter(
        (k) => k.startsWith(`${trace}/`) && !seen.has(k),
      );

      expect(unexpected.join('\n'), 'v3 differs where no entry says so').toBe(
        '',
      );
      expect(stale, 'V3_DIVERGENCES entries that no longer differ').toEqual([]);
    });
  }
});
