import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { SCENES } from './lib/routing-scenes.mjs';
import { compareRoutes, formatRouteDiff, TOL } from './lib/route-compare.mjs';
import { DIVERGENCES, ledgerFor } from './lib/routing-ledger.mjs';

/*
Round 55: numeric v3-vs-v4 edge-routing parity.

The pixel scenes in `visual.spec.js` answer "do these two pictures
differ, and by how much of the canvas".  This file answers "which
number, on which edge, by how far" — the maintainer's `ctrlpts(v3) ~=
ctrlpts(v4)`.  A 6-model-px arrow gap is 0.005% of a 400x300 canvas and
sits 400x under the pixel bound; here it is 6.000000.

Two properties of this suite are deliberate and worth preserving:

  - **No WebGPU adapter is required, and there is no `hasAdapter` skip.**
    Routing is model-space, and both libraries' accessors resolve it on
    read (v4 flushes its derivation; v3's canvas renderer recalculates
    rendered style).  Nothing here screenshots or draws a frame.  A
    suite that soft-skips on an adapterless machine is a suite that
    stops running exactly where CI is cheapest.
  - **The probe is symmetric.**  One function asks both libraries the
    same public question — see `playwright-page/route-probe.js`.

The `visual` project already serves this page and builds both bundles,
so this file joins that project rather than adding another.
*/

const PARITY_PAGE = 'http://127.0.0.1:3333/playwright-page/parity.html';

test.describe('v3-vs-v4 routing parity (numeric)', () => {
  test.beforeAll(() => {
    const bundle = path.resolve(
      process.cwd(),
      'v3',
      'build',
      'cytoscape.umd.js',
    );

    if (!existsSync(bundle)) {
      throw new Error(
        "v3's UMD bundle is missing, so the routing-parity comparison cannot run.\n" +
          'Build the comparison baseline first:  cd v3 && npm install && npm run build:umd',
      );
    }
  });

  test.beforeEach(async ({ page }) => {
    await page.goto(PARITY_PAGE);
    await page.waitForFunction(
      () => window.probeScene != null && window.makeV3 != null,
    );
  });

  for (const scene of SCENES) {
    test(`routing: ${scene.name} — ${scene.note}`, async ({ page }) => {
      // A scene with `expectFail` documents a defect this round has
      // measured but not yet fixed.  Playwright fails the run if such a
      // test *passes*, so the marker is removed by the fix that earns it
      // — which makes each one a failing test the fix has to satisfy
      // rather than a note in a file.
      //
      // The risk of a whole-test `test.fail()` is that it also swallows a
      // crash: a scene that throws would read as an expected failure.  The
      // `finite geometry: <scene>` specs below are the guard — they build
      // the same scene, are never marked failing, and assert it produced
      // records.
      if (scene.expectFail != null) {
        test.fail(true, scene.expectFail);
      }

      const { v3, v4 } = await page.evaluate(
        (s) => window.probeScene(s),
        scene,
      );
      const result = compareRoutes(v3, v4, {
        scene: scene.name,
        tolClass: scene.tolClass,
        ledger: DIVERGENCES,
      });
      const report = formatRouteDiff(scene.name, result);

      console.log(report);

      // A scene that compared nothing would otherwise pass silently — the
      // same failure mode as a pixel diff with no ink floor.
      expect(
        result.rows.length,
        `${scene.name} compared no fields`,
      ).toBeGreaterThan(0);

      expect(
        result.staleLedger,
        `stale ledger entries for ${scene.name}`,
      ).toEqual([]);
      expect(
        result.structural,
        `structural mismatches in ${scene.name}`,
      ).toEqual([]);
      expect(
        result.diverged.map((r) => `${r.key} by ${r.delta.toFixed(4)}`),
        `numeric divergences in ${scene.name}\n${report}`,
      ).toEqual([]);

      // The tolerance must stay a bound, not a ceiling the data has crept
      // up to.  If this fires, re-derive the class in route-compare.mjs
      // from what actually quantizes — do not raise it to fit.
      expect(
        result.maxDelta,
        `${scene.name}: matching fields have crept to within 4x of the ${result.tol} tolerance; ` +
          're-derive the bound rather than raising it',
      ).toBeLessThan(result.tol / 4);
    });
  }

  /**
   * The bound's own control, and the most important test in the file.
   *
   * If a 0.01-model-px perturbation does not break every tolerance class,
   * then the comparison is not measuring geometry and every green scene
   * above is worthless.  Round 33's rule — a row is guilty until it is
   * shown to discriminate — applied to a tolerance.
   */
  test('control: a 0.01 px perturbation fails at every tolerance class', async ({
    page,
  }) => {
    const scene = SCENES[0];
    const { v3, v4 } = await page.evaluate((s) => window.probeScene(s), scene);

    const nudged = JSON.parse(JSON.stringify(v4));

    for (const rec of Object.values(nudged)) {
      if (rec.src != null && typeof rec.src.x === 'number') {
        rec.src.x += 0.01;
      }
    }

    for (const tolClass of Object.keys(TOL)) {
      const result = compareRoutes(v3, nudged, {
        scene: scene.name,
        tolClass,
        ledger: [],
      });

      expect(
        result.diverged.length,
        `a 0.01 px nudge must diverge at tolerance class '${tolClass}' (${TOL[tolClass]})`,
      ).toBeGreaterThan(0);
    }
  });

  /**
   * The comparator's other control: a NaN must be reported as structural,
   * not swallowed.  `NaN > tol` is false, so the naive comparator passes
   * it — and v4 really does produce NaN on axis-aligned round-taxi, so
   * this is the guard that stops that defect reading as parity.
   */
  test('control: a non-finite value is structural, not a passing delta', async ({
    page,
  }) => {
    const scene = SCENES[0];
    const { v3, v4 } = await page.evaluate((s) => window.probeScene(s), scene);

    const before = compareRoutes(v3, v4, {
      scene: scene.name,
      tolClass: 'exact',
      ledger: [],
    });

    const broken = JSON.parse(JSON.stringify(v4));
    let nanned = 0;

    for (const rec of Object.values(broken)) {
      if (rec.mid != null) {
        rec.mid.x = 'NaN';
        nanned++;
      }
    }

    const after = compareRoutes(v3, broken, {
      scene: scene.name,
      tolClass: 'exact',
      ledger: [],
    });

    // Deltas, not absolutes: this scene has real divergences of its own
    // right now (v4 answers the node centre where v3 answers the
    // boundary), so asserting `diverged === 0` would have been a control
    // that fails for a reason unrelated to what it is checking — which is
    // exactly what the first draft of this spec did.
    expect(
      nanned,
      'the control must actually corrupt something',
    ).toBeGreaterThan(0);
    expect(
      after.structural.length - before.structural.length,
      'every NaN must be reported structurally',
    ).toBe(nanned);
    expect(
      after.diverged.length,
      'a NaN must not be counted as a numeric divergence',
    ).toBeLessThanOrEqual(before.diverged.length);
  });

  /**
   * v4's own geometry must be finite, independent of v3.
   *
   * This is not a parity check and deliberately does not compare against
   * v3 — v3 has the identical zero-leg division in `round.mts` and gets
   * NaN corners of its own there, so a parity check would call two NaNs a
   * match.  What matters to an application is that `boundingBox()`
   * answers numbers, and on axis-aligned `round-taxi` v4's comes back
   * `{x1: null, …}`: `evalTaxi` emits two coincident interior points (a
   * faithful port — v3 does too) and `computeCorner` then normalizes a
   * zero-length leg.
   *
   * The allowlist is what makes this the failing test round 55's second
   * fix has to satisfy: when the guard lands, the entry stops being hit
   * and this spec fails until it is removed.
   */
  // Empty since round 55's zero-leg guard landed.  It was not empty when
  // this spec was written: `round-taxi-vert` and `round-taxi-horiz` both
  // answered a non-finite `boundingBox()`, and removing those two entries
  // is what the fix had to earn.
  const NON_FINITE_ALLOWED = [];

  for (const scene of SCENES) {
    test(`finite geometry: ${scene.name}`, async ({ page }) => {
      const { v4 } = await page.evaluate((s) => window.probeScene(s), scene);
      const bad = [];
      const allowedHit = new Set();

      // the well-formedness half: this spec is the guard that stops a
      // crashing scene reading as an expected failure above, so it has to
      // assert the scene actually produced something
      expect(Object.keys(v4).length, `${scene.name} produced no records`).toBe(
        scene.edges.length,
      );

      for (const rec of Object.values(v4)) {
        for (const [field, value] of Object.entries(rec.finite ?? {})) {
          if (value === true) {
            continue;
          }

          const allowed = NON_FINITE_ALLOWED.find(
            (a) =>
              a.scene === scene.name && a.id === rec.id && a.field === field,
          );

          if (allowed != null) {
            allowedHit.add(`${allowed.id}/${allowed.field}`);
            continue;
          }

          bad.push(`${scene.name}/${rec.id}/${field}`);
        }
      }

      expect(bad, `v4 produced non-finite geometry in ${scene.name}`).toEqual(
        [],
      );

      // the allowlist is a contract too: an entry that no longer fires
      // means the defect is fixed and the entry must go
      const expectedHits = NON_FINITE_ALLOWED.filter(
        (a) => a.scene === scene.name,
      ).map((a) => `${a.id}/${a.field}`);

      expect(
        [...allowedHit].sort(),
        `allowlisted non-finite geometry that no longer occurs in ${scene.name} — remove the entry`,
      ).toEqual(expectedHits.sort());
    });
  }

  /**
   * Scenes reuse `window.cy3`/`cy4`, and `makeV3`/`makeV4` overwrite them
   * without tearing down the previous graph.  If a scene ever forgot to
   * rebuild, it would read the *previous* scene's numbers and agree with
   * itself perfectly.  Two different scenes back to back must not.
   */
  test("control: consecutive scenes do not read each other's numbers", async ({
    page,
  }) => {
    const first = await page.evaluate((s) => window.probeScene(s), SCENES[0]);
    const second = await page.evaluate((s) => window.probeScene(s), SCENES[1]);

    expect(JSON.stringify(first.v4)).not.toEqual(JSON.stringify(second.v4));
    expect(JSON.stringify(first.v3)).not.toEqual(JSON.stringify(second.v3));
  });

  /** Every ledger entry must name a scene the matrix still produces. */
  test('the divergence ledger names only live scenes', () => {
    const names = new Set(SCENES.map((s) => s.name));
    const orphans = DIVERGENCES.filter(
      (e) => !names.has(e.key.split('/')[0]),
    ).map((e) => e.key);

    expect(
      orphans,
      'ledger entries naming a scene the matrix no longer has',
    ).toEqual([]);

    for (const scene of SCENES) {
      for (const entry of ledgerFor(scene.name)) {
        const id = entry.key.split('/')[1];

        expect(
          scene.edges,
          `ledger entry ${entry.key} names an edge ${scene.name} does not probe`,
        ).toContain(id);
      }
    }
  });
});
