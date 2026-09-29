import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import path from 'node:path';

/*
Round 105: picking inside a wide parallel-edge bundle.

GeneMANIA draws a bundle of up to ~30 edges per gene pair, and a tap on
one opens that interaction's details — so which member a pointer
resolves to is the interaction.  With v3's hit halos (57.9: 8 rendered
px around an edge for a mouse) most points inside such a bundle lie
within the halo of several members at once.  Measured on the scene
below before the round:

  - **v3** (`findNearestElement`) scans every element and keeps the edge
    whose centreline is **nearest**, a tie going to the topmost;
  - **v4** kept whichever grown stroke the pick pass **drew last** — the
    r32uint target had no depth — so near the bundle's ends, where the
    members converge, a pointer on one member's stroke answered a
    neighbour: 55 of 182 transect points disagreed with v3, one of them
    0.49 px from the centreline of the edge it did not pick;
  - both answers were **stable** frame to frame (0 of 182 changed across
    five re-picks), so the defect was deterministic, not flicker.

The round gave the pick pass a depth target: each pick fragment writes
its distance from its own centreline and the test is less-equal, so v4
now resolves nearest-wins as v3 does (`src/render/picking.mts`).  One
spec per outcome: agreement with v3 on the bezier bundle, agreement with
its own geometry on the haystack bundle (v3 and v4 place haystack lines
at different pseudo-random angles, so there each is held to its own
nearest), and stability.

**Where a disagreement is allowed.**  The GPU answers per texel, at the
texel centre, from interpolated distances; the reference is analytic.
So a probe may differ where two members are within DIST_TOL of equally
near, or where the nearest sits within DIST_TOL of the halo's edge — and
only there.  Probes are taken at texel centres (x + 0.5) on both sides.

Control (run once, 2026-09-29, SwiftShader): with PICK_DEPTH_STENCIL's
compare set to 'always' — the old last-draw-wins — 'the bezier bundle'
fails with 122 of its 273 probes wrong outside the tolerance and 'the
haystack bundle' with 8; the stability spec stays green (the old answer
was stable too — which is why it is its own spec).
*/

const PARITY_PAGE = 'http://127.0.0.1:3333/playwright-page/parity.html';
// v3's mouse halos, which the gesture layer passes (MOUSE_PADS)
const EDGE_PAD = 8;
const DIST_TOL = 0.75;
// v3's own distance to a quadratic is an approximation that runs up to
// ~1 px long (measured: it hit at 10.5 px against a 9.5 px reach), so the
// halo's edge gets a wider band than the equal-nearness one
const HALO_TOL = 1.5;
const WIDTH = 3;
const MEMBERS = 30;

const hasAdapter = async (page) =>
  page.evaluate(async () => {
    if (navigator.gpu == null) {
      return false;
    }

    return (await navigator.gpu.requestAdapter()) != null;
  });

/**
 * Build the same 30-wide bundle in both libraries at zoom 1, pan 0, and
 * pick along transects across it: near the source end (where the members
 * converge), the middle, and near the target end.  Returns per probe the
 * v3 answer, the v4 answer (with the gesture's halos), and the two
 * nearest members by *each* library's own geometry.
 */
const probeBundle = (page, curve) =>
  page.evaluate(
    async ({ curve, members, width, pad }) => {
      const els = [
        { data: { id: 'a' }, position: { x: 60, y: 150 } },
        { data: { id: 'b' }, position: { x: 340, y: 150 } },
      ];

      for (let i = 0; i < members; i++) {
        // alternate directions, as GeneMANIA's bundles do
        els.push({
          data: {
            id: 'e' + i,
            source: i & 1 ? 'b' : 'a',
            target: i & 1 ? 'a' : 'b',
          },
        });
      }

      const edgeStyle = {
        'curve-style': curve,
        width,
        'haystack-radius': 0.5,
      };
      const cy3 = window.makeV3({
        elements: JSON.parse(JSON.stringify(els)),
        style: [
          { selector: 'node', style: { width: 30, height: 30 } },
          { selector: 'edge', style: edgeStyle },
        ],
        layout: { name: 'preset', fit: false },
        zoom: 1,
        pan: { x: 0, y: 0 },
      });
      const cy4 = window.makeV4({
        elements: JSON.parse(JSON.stringify(els)),
        style: { nodes: { width: 30, height: 30 }, edges: edgeStyle },
        layout: { name: 'preset', fit: false },
        zoom: 1,
        pan: { x: 0, y: 0 },
      });

      await cy4.ready;
      // model = rendered coordinates on both sides, whatever a layout did
      for (const cy of [cy3, cy4]) {
        cy.zoom(1);
        cy.pan({ x: 0, y: 0 });
      }
      await new Promise((r) =>
        requestAnimationFrame(() => requestAnimationFrame(r)),
      );

      // each library's own centrelines, sampled finely: a quadratic
      // through the control point (bezier), or the drawn segment (haystack)
      const polylines = (cy, lib) =>
        cy.edges().map((e) => {
          const s = e.sourceEndpoint();
          const t = e.targetEndpoint();
          const cps = curve === 'bezier' ? e.controlPoints() : null;
          const pts = [];

          for (let i = 0; i <= 600; i++) {
            const u = i / 600;

            if (cps != null && cps.length === 1) {
              const c = cps[0];

              pts.push([
                (1 - u) * (1 - u) * s.x + 2 * (1 - u) * u * c.x + u * u * t.x,
                (1 - u) * (1 - u) * s.y + 2 * (1 - u) * u * c.y + u * u * t.y,
              ]);
            } else {
              pts.push([s.x + (t.x - s.x) * u, s.y + (t.y - s.y) * u]);
            }
          }

          return { id: e.id(), pts, lib };
        });
      const nearestTwo = (lines, x, y) => {
        const ds = lines
          .map((l) => ({
            id: l.id,
            d: Math.min(...l.pts.map(([px, py]) => Math.hypot(px - x, py - y))),
          }))
          .sort((p, q) => p.d - q.d);

        return [ds[0], ds[1]];
      };
      const lines3 = polylines(cy3, 'v3');
      const lines4 = polylines(cy4, 'v4');
      const probes = [];

      for (const X of [100, 200, 300]) {
        for (let y = 60; y <= 240; y += 2) {
          // texel centres, both sides: the GPU rasters (x + 0.5, y + 0.5)
          const cx = X + 0.5;
          const cyy = y + 0.5;
          const n3 = cy3.renderer().findNearestElement(cx, cyy, true, false);
          const r = cy4._renderer;

          r.picking.invalidateCache();

          const n4 = cy4._decodePick(
            await r.pick(X, y, { edgePadPx: pad, nodePadPx: 2 }),
          );

          probes.push({
            x: X,
            y,
            v3: n3 != null && n3.isEdge() ? n3.id() : null,
            v4: n4 != null && n4.isEdge() ? n4.id() : null,
            near3: nearestTwo(lines3, cx, cyy),
            near4: nearestTwo(lines4, cx, cyy),
          });
        }
      }

      return probes;
    },
    { curve, members: MEMBERS, width: WIDTH, pad: EDGE_PAD },
  );

/** The id a nearest-wins pick with the halo must answer, or undefined
 * when the probe sits inside the tolerance band (either answer is fair). */
const expected = ([best, second]) => {
  const reach = WIDTH / 2 + EDGE_PAD;

  if (Math.abs(best.d - reach) < HALO_TOL) {
    return undefined; // on the halo's edge
  }

  if (best.d > reach) {
    return null; // background
  }

  if (second != null && second.d - best.d < DIST_TOL) {
    return undefined; // two members equally near
  }

  return best.id;
};

/** Probes whose answer is not the one expected of it. */
const disagreements = (probes, answerOf, nearOf) =>
  probes.filter((p) => {
    const want = expected(nearOf(p));

    return want !== undefined && answerOf(p) !== want;
  });

test.describe('picking in a wide bundle (round 105)', () => {
  test.beforeAll(() => {
    if (!existsSync(path.resolve('v3', 'build', 'cytoscape.umd.js'))) {
      throw new Error(
        "v3's UMD bundle is missing: cd v3 && npm install && npm run build:umd",
      );
    }
  });

  test.beforeEach(async ({ page }) => {
    await page.goto(PARITY_PAGE);
    await page.waitForFunction(() => window.makeV3 != null);
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');
  });

  test('the bezier bundle: v4 resolves the nearest member, as v3 does', async ({
    page,
  }) => {
    const probes = await probeBundle(page, 'bezier');
    // the scene has to be the dense one it is named for: points where
    // more than one member is inside the halo
    const contested = probes.filter(
      (p) => p.near4[1] != null && p.near4[1].d <= WIDTH / 2 + EDGE_PAD,
    );

    expect(contested.length).toBeGreaterThan(60);

    // v3 is the reference behaviour — hold the reference to itself first
    expect(
      disagreements(
        probes,
        (p) => p.v3,
        (p) => p.near3,
      ),
    ).toEqual([]);
    expect(
      disagreements(
        probes,
        (p) => p.v4,
        (p) => p.near4,
      ),
    ).toEqual([]);

    // and the two libraries' own answers, wherever neither is borderline
    const cross = probes.filter((p) => {
      const w3 = expected(p.near3);
      const w4 = expected(p.near4);

      return w3 !== undefined && w4 !== undefined && p.v3 !== p.v4;
    });

    expect(cross).toEqual([]);
  });

  test('the haystack bundle: each library resolves the nearest of its own lines', async ({
    page,
  }) => {
    const probes = await probeBundle(page, 'haystack');
    const hits = probes.filter((p) => p.v4 != null);

    // haystack bundles are a sheaf inside the node's radius: the probes
    // that hit must be many, and mostly contested
    expect(hits.length).toBeGreaterThan(20);
    expect(
      disagreements(
        probes,
        (p) => p.v3,
        (p) => p.near3,
      ),
    ).toEqual([]);
    expect(
      disagreements(
        probes,
        (p) => p.v4,
        (p) => p.near4,
      ),
    ).toEqual([]);
  });

  test('the answer is stable frame to frame', async ({ page }) => {
    test.setTimeout(180_000);

    const first = await probeBundle(page, 'bezier');
    const again = await page.evaluate(
      async (points) => {
        const cy4 = window.cy4;
        const r = cy4._renderer;
        const out = [];

        for (const { x, y } of points) {
          const ids = [];

          for (let k = 0; k < 3; k++) {
            // a fresh tile each time, and a pan round trip in between, so
            // every answer is a new raster of a moved view
            cy4.panBy({ x: 7, y: -3 });
            await new Promise((res) => requestAnimationFrame(res));
            cy4.panBy({ x: -7, y: 3 });
            await new Promise((res) => requestAnimationFrame(res));
            r.picking.invalidateCache();

            const hit = cy4._decodePick(
              await r.pick(x, y, { edgePadPx: 8, nodePadPx: 2 }),
            );

            ids.push(hit != null && hit.isEdge() ? hit.id() : null);
          }

          out.push(ids);
        }

        return out;
      },
      first.filter((_, i) => i % 4 === 0),
    );

    const sampled = first.filter((_, i) => i % 4 === 0);
    const changed = sampled.filter((p, i) =>
      again[i].some((id) => id !== p.v4),
    );

    expect(sampled.filter((p) => p.v4 != null).length).toBeGreaterThan(30);
    expect(changed).toEqual([]);
  });
});
