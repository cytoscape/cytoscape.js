import { test, expect } from '@playwright/test';
import {
  decodePng,
  diffPngs,
  maskRects,
  writeDiffArtifacts,
  compareToGolden,
} from './lib/image-diff.mjs';
import { existsSync } from 'node:fs';
import path from 'node:path';

/*
Visual regression specs for the WebGPU prototype, in two families:

- **v4 goldens**: each scene exports a png and diffs it against a PNG
  checked into playwright-tests/goldens/.  Run under the 'visual'
  project, which pins the SwiftShader software adapter so rasterization is
  deterministic across machines.  Regenerate after an intended visual
  change with:  UPDATE_GOLDENS=1 npx playwright test --project=visual
  Geometry goldens carry a tight bound.  The label golden uses the fixed
  Open Sans web font (an OFL devDependency, pre-loaded before instance
  creation so the lazily-caching atlas never rasters a fallback font) at
  a looser bound: the one un-pinnable layer is Chrome's atlas raster,
  which goes through CoreText on macOS vs FreeType on Linux — sub-pixel
  edge differences the SDF pipeline shrinks but cannot erase.  If CI
  proves the tolerance insufficient, per-platform golden suffixes are
  the escape hatch.

- **v3-vs-v4 parity**: the same fixture rendered by the classic canvas
  renderer and the GPU prototype in the same run, diffed with a tolerance
  (both images come from this machine, so determinism is a non-issue).
  The renderers differ by design in anti-aliasing (SDF vs canvas-2D), so
  parity asserts placement/color agreement, not pixel identity.
*/

const PAGE = 'http://127.0.0.1:3333/playwright-page/index.html';
const PARITY_PAGE = 'http://127.0.0.1:3333/playwright-page/parity.html';

const hasAdapter = async (page) => {
  return await page.evaluate(async () => {
    if (navigator.gpu == null) {
      return false;
    }

    return (await navigator.gpu.requestAdapter()) != null;
  });
};

/** Make the instance, await readiness and one presented frame. */
const makeReadyCy = async (page, options) => {
  await page.evaluate(async (options) => {
    const cy = window.makeCy(options);

    await cy.ready;

    await new Promise((resolve) => {
      cy.one('render', () => resolve());
      cy.panBy({ x: 1, y: 0 });
      cy.panBy({ x: -1, y: 0 });
    });
  }, options);
};

const waitFrames = async (page, n = 3) => {
  await page.evaluate(async (n) => {
    for (let i = 0; i < n; i++) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  }, n);
};

const exportPng = async (page, opts = {}) => {
  return await page.evaluate(async (opts) => await window.cy.png(opts), opts);
};

test.describe('WebGPU visual goldens', () => {
  let deviceErrors = [];

  test.beforeEach(async ({ page }) => {
    deviceErrors = [];

    page.on('console', (msg) => {
      const text = msg.text();

      if (/WGSL|is invalid|Validation error/i.test(text)) {
        deviceErrors.push(text);
      }
    });

    await page.setViewportSize({ width: 400, height: 300 });
    await page.goto(PAGE);
  });

  test.afterEach(() => {
    expect(deviceErrors, 'WebGPU reported validation errors').toEqual([]);
  });

  /**
   * Give one scene a larger canvas than the 400x300 the suite defaults to
   * (round 56).
   *
   * Must run before `makeReadyCy`: the container is sized from the
   * viewport by CSS, and the instance reads its dimensions at
   * construction.
   *
   * @param page — the Playwright page
   * @param width — canvas width in CSS px
   * @param height — canvas height in CSS px
   */
  const useViewport = async (page, width, height) => {
    await page.setViewportSize({ width, height });
  };

  /**
   * Assert the whole graph is inside the exported viewport (round 56).
   *
   * Goldens export the *viewport*, not the graph, so a scene that has
   * outgrown its canvas is silently cropped — and the cropped part is
   * then covered by no test at all while the golden goes on passing.
   * Six scenes were in that state when this check was written, the worst
   * (`arrow-shapes`, and it is an *arrow* golden) losing **109 px** of a
   * 300 px canvas: over a third of the scene, including whole rows of
   * heads.
   *
   * Called by every golden before its diff, so a scene that grows past
   * its canvas fails here rather than quietly shrinking its own coverage.
   *
   * @param page — the Playwright page, with `window.cy` live
   * @param name — the golden's name, for the failure message
   */
  const expectGraphFits = async (page, name) => {
    const r = await page.evaluate(() => {
      const bb = window.cy.elements().renderedBoundingBox();

      return {
        x1: bb.x1,
        y1: bb.y1,
        x2: bb.x2,
        y2: bb.y2,
        w: window.cy.width(),
        h: window.cy.height(),
      };
    });
    const over = {
      left: Math.max(0, -r.x1),
      top: Math.max(0, -r.y1),
      right: Math.max(0, r.x2 - r.w),
      bottom: Math.max(0, r.y2 - r.h),
    };
    const worst = Math.max(over.left, over.top, over.right, over.bottom);

    expect(
      worst,
      `${name}: the graph spills outside the exported ${r.w}x${r.h} viewport ` +
        `(left ${over.left.toFixed(1)}, top ${over.top.toFixed(1)}, ` +
        `right ${over.right.toFixed(1)}, bottom ${over.bottom.toFixed(1)} px). ` +
        'Give the scene a larger canvas with useViewport(), or bring its ' +
        'content in — a cropped golden tests less than it looks like it does.',
    ).toBeLessThanOrEqual(0.5);
  };

  const checkGolden = (name, uri, testInfo, opts = {}) => {
    // throws with diff artifacts on mismatch; writes the golden under
    // UPDATE_GOLDENS=1
    compareToGolden(name, decodePng(uri), {
      artifactsDir: testInfo.outputPath(''),
      ...opts,
    });
  };

  test('golden: nodes, borders, opacity, edges, arrows', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    await makeReadyCy(page, {
      elements: [
        { data: { id: 'a', kind: 'plain' }, position: { x: -120, y: -60 } },
        { data: { id: 'b', kind: 'boxy' }, position: { x: 120, y: -60 } },
        { data: { id: 'c', kind: 'round' }, position: { x: -120, y: 60 } },
        { data: { id: 'd', kind: 'ghost' }, position: { x: 120, y: 60 } },
        { data: { id: 'ab', source: 'a', target: 'b' } },
        { data: { id: 'cd', source: 'c', target: 'd' } },
        { data: { id: 'ad', source: 'a', target: 'd' } },
      ],
      style: {
        nodes: {
          width: 50,
          height: 40,
          shape: {
            case: [
              { when: { data: 'kind', eq: 'boxy' }, then: 'rectangle' },
              { when: { data: 'kind', eq: 'round' }, then: 'round-rectangle' },
            ],
            else: 'ellipse',
          },
          'background-color': {
            case: [
              { when: { data: 'kind', eq: 'boxy' }, then: '#2980b9' },
              { when: { data: 'kind', eq: 'round' }, then: '#27ae60' },
            ],
            else: '#c0392b',
          },
          'border-width': 3,
          'border-color': '#2c3e50',
          opacity: {
            case: [{ when: { data: 'kind', eq: 'ghost' }, then: 0.4 }],
            else: 1,
          },
        },
        edges: {
          width: 3,
          'line-color': '#7f8c8d',
          'target-arrow-shape': 'triangle',
          'target-arrow-color': '#8e44ad',
        },
      },
      zoom: 1,
      pan: { x: 200, y: 150 },
    });
    await waitFrames(page);

    await expectGraphFits(page, 'nodes-edges-arrows');
    checkGolden(
      'nodes-edges-arrows',
      await exportPng(page, { bg: '#fff' }),
      testInfo,
    );
  });

  test('golden: the selection look (round 57.1)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    // Round 57.1 replaced v4's accent *ring* with v3's own rule: the
    // selected node's **fill** goes #0169D9 and its border keeps its own
    // colour, and a selected compound parent takes v3's lighter
    // #CCE1F9 / #aec8e5 pair instead.  Both cases are here, beside their
    // unselected twins — the comparison is what makes the golden say
    // anything, since a golden only ever answers "did this change?".
    //
    // **The sheet must not declare `background-color`**, and this scene
    // did until the rule moved out of the shader.  The colour is a rule
    // in the *default* stylesheet now, so a sheet that names a fill
    // replaces it — which meant this golden was showing a selected node
    // and an unselected one painted identically, i.e. measuring nothing.
    // The sibling below covers the override case deliberately.
    await makeReadyCy(page, {
      elements: [
        { data: { id: 'a' }, position: { x: -120, y: -60 }, selected: true },
        { data: { id: 'b' }, position: { x: 0, y: -60 } },
        { data: { id: 'ab', source: 'a', target: 'b' } },
        { data: { id: 'p' }, selected: true },
        { data: { id: 'c', parent: 'p' }, position: { x: -90, y: 70 } },
        { data: { id: 'd', parent: 'p' }, position: { x: 20, y: 70 } },
        { data: { id: 'q' } },
        { data: { id: 'e', parent: 'q' }, position: { x: 140, y: 70 } },
      ],
      style: {
        nodes: {
          width: 60,
          height: 60,
          'border-width': 2,
          'border-color': '#95a5a6',
        },
        edges: { width: 2 },
      },
      zoom: 1,
      pan: { x: 200, y: 150 },
    });
    await waitFrames(page);

    await expectGraphFits(page, 'selection-accent');
    checkGolden(
      'selection-accent',
      await exportPng(page, { bg: '#fff' }),
      testInfo,
    );
  });

  test('golden: a sheet that names its own fill replaces the selection colour (round 57.1)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    // The other half of the rule, and the half that is easy to get wrong
    // in the direction of "the affordance always wins".  Three rows, all
    // with one node selected and one not:
    //
    //   top     the default sheet             — selected goes v3 blue
    //   middle  a sheet naming its own fill   — no selection colour at
    //           all, exactly as v3 behaves for a styled palette
    //   bottom  the same sheet, with the app's own `{ selected: true }`
    //           case — selection back, in the app's colours
    //
    // One sheet cannot style three groups differently, so the rows are
    // separated by a data key and the middle/bottom sheets are `case`
    // mappers over it.  What makes the golden discriminate is that the
    // three rows must not look alike.
    const row = (y, tag) => [
      {
        data: { id: `${tag}-on`, tag },
        position: { x: -70, y },
        selected: true,
      },
      { data: { id: `${tag}-off`, tag }, position: { x: 50, y } },
    ];

    await makeReadyCy(page, {
      elements: [...row(-90, 'default'), ...row(0, 'named'), ...row(90, 'own')],
      style: {
        nodes: {
          width: 60,
          height: 60,
          'border-width': 2,
          'border-color': '#95a5a6',
          'background-color': {
            case: [
              // row 2: a flat colour, which replaces the default rule
              { when: { data: 'tag', eq: 'named' }, then: '#e67e22' },
              // row 3: the app's own selection rule, in its own palette
              {
                when: [{ data: 'tag', eq: 'own' }, { selected: true }],
                then: '#8e44ad',
              },
              { when: { data: 'tag', eq: 'own' }, then: '#e67e22' },
              // row 1 falls through to v4's default rule, restated —
              // declaring the prop at all is what drops the default
              { when: { selected: true }, then: '#0169D9' },
            ],
            else: '#999',
          },
        },
      },
      zoom: 1,
      pan: { x: 200, y: 150 },
    });
    await waitFrames(page);

    await expectGraphFits(page, 'selection-overridden');
    checkGolden(
      'selection-overridden',
      await exportPng(page, { bg: '#fff' }),
      testInfo,
    );
  });

  test('golden: polygon node shapes (round 10)', async ({ page }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    const shapes = [
      'triangle',
      'pentagon',
      'hexagon',
      'heptagon',
      'octagon',
      'diamond',
      'rhomboid',
      'vee',
      'star',
      'tag',
    ];
    const elements = shapes.map((shape, i) => ({
      data: { id: shape, shape },
      position: { x: (i % 5) * 70 - 140, y: Math.floor(i / 5) * 70 - 55 },
    }));

    // one anisotropic polygon: inside-ness must stay exact under stretch
    elements.push({
      data: { id: 'wide-hex', shape: 'hexagon' },
      position: { x: 0, y: 75 },
    });

    await makeReadyCy(page, {
      elements,
      style: {
        nodes: {
          width: {
            case: [{ when: { data: 'id', eq: 'wide-hex' }, then: 130 }],
            else: 50,
          },
          height: {
            case: [{ when: { data: 'id', eq: 'wide-hex' }, then: 34 }],
            else: 50,
          },
          shape: {
            case: [
              { when: { data: 'shape', eq: 'triangle' }, then: 'triangle' },
              { when: { data: 'shape', eq: 'pentagon' }, then: 'pentagon' },
              { when: { data: 'shape', eq: 'hexagon' }, then: 'hexagon' },
              { when: { data: 'shape', eq: 'heptagon' }, then: 'heptagon' },
              { when: { data: 'shape', eq: 'octagon' }, then: 'octagon' },
              { when: { data: 'shape', eq: 'diamond' }, then: 'diamond' },
              { when: { data: 'shape', eq: 'rhomboid' }, then: 'rhomboid' },
              { when: { data: 'shape', eq: 'vee' }, then: 'vee' },
              { when: { data: 'shape', eq: 'star' }, then: 'star' },
              { when: { data: 'shape', eq: 'tag' }, then: 'tag' },
            ],
            else: 'ellipse',
          },
          'background-color': '#3498db',
          'border-width': 3,
          'border-color': '#2c3e50',
        },
      },
      zoom: 1,
      pan: { x: 200, y: 150 },
    });
    await waitFrames(page);

    await expectGraphFits(page, 'polygon-shapes');
    checkGolden(
      'polygon-shapes',
      await exportPng(page, { bg: '#fff' }),
      testInfo,
    );
  });

  test('golden: the round-27.2 shape keywords', async ({ page }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    // right-rhomboid and concave-hexagon are point tables.  cut-rectangle
    // is not — its chamfer is an absolute length, so the scene shows it
    // at three sizes with corner-radius left at 'auto': the chamfer must
    // stay the same size as the box grows and stretches, and on the small
    // node it must stay 8px where round-rectangle's auto rule would give
    // 6 — that last node is what makes this golden discriminate between
    // the two 'auto' meanings.
    const elements = [
      {
        data: { id: 'rr', shape: 'right-rhomboid' },
        position: { x: -110, y: -45 },
      },
      {
        data: { id: 'ch', shape: 'concave-hexagon' },
        position: { x: -35, y: -45 },
      },
      {
        data: { id: 'cr', shape: 'cut-rectangle' },
        position: { x: 40, y: -45 },
      },
      {
        data: { id: 'cr-small', shape: 'cut-rectangle' },
        position: { x: 105, y: -45 },
      },
      {
        data: { id: 'cr-wide', shape: 'cut-rectangle' },
        position: { x: -20, y: 45 },
      },
    ];

    await makeReadyCy(page, {
      elements,
      style: {
        nodes: {
          width: {
            case: [
              { when: { data: 'id', eq: 'cr-wide' }, then: 150 },
              { when: { data: 'id', eq: 'cr-small' }, then: 24 },
            ],
            else: 60,
          },
          height: {
            case: [
              { when: { data: 'id', eq: 'cr-wide' }, then: 40 },
              { when: { data: 'id', eq: 'cr-small' }, then: 24 },
            ],
            else: 60,
          },
          shape: {
            case: [
              {
                when: { data: 'shape', eq: 'right-rhomboid' },
                then: 'right-rhomboid',
              },
              {
                when: { data: 'shape', eq: 'concave-hexagon' },
                then: 'concave-hexagon',
              },
              {
                when: { data: 'shape', eq: 'cut-rectangle' },
                then: 'cut-rectangle',
              },
            ],
            else: 'ellipse',
          },
          'background-color': '#3498db',
          'border-width': 3,
          'border-color': '#2c3e50',
        },
      },
      zoom: 1,
      pan: { x: 200, y: 150 },
    });
    await waitFrames(page);

    await expectGraphFits(page, 'shapes-27');
    checkGolden('shapes-27', await exportPng(page, { bg: '#fff' }), testInfo);
  });

  test('golden: the round-corner shape family (round 27.4)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    const shapes = [
      'round-triangle',
      'round-diamond',
      'round-pentagon',
      'round-hexagon',
      'round-heptagon',
      'round-octagon',
      'round-tag',
      'bottom-round-rectangle',
      'barrel',
    ];
    const elements = shapes.map((shape, i) => ({
      data: { id: shape, shape },
      position: { x: (i % 4) * 85 - 128, y: Math.floor(i / 4) * 85 - 42 },
    }));

    // the anisotropic case the family was deferred for: the corner arcs
    // must stay circular while the body stretches
    elements.push({
      data: { id: 'wide', shape: 'round-pentagon' },
      position: { x: 0, y: 110 },
    });

    await makeReadyCy(page, {
      elements,
      style: {
        nodes: {
          width: {
            case: [{ when: { data: 'id', eq: 'wide' }, then: 160 }],
            else: 60,
          },
          height: {
            case: [{ when: { data: 'id', eq: 'wide' }, then: 44 }],
            else: 60,
          },
          'corner-radius': 12,
          shape: {
            case: shapes.map((shape) => ({
              when: { data: 'shape', eq: shape },
              then: shape,
            })),
            else: 'ellipse',
          },
          'background-color': '#27ae60',
          'border-width': 3,
          'border-color': '#145a32',
        },
      },
      zoom: 1,
      pan: { x: 200, y: 130 },
    });
    await waitFrames(page);

    await expectGraphFits(page, 'shapes-27-round');
    checkGolden(
      'shapes-27-round',
      await exportPng(page, { bg: '#fff' }),
      testInfo,
    );
  });

  test('golden: arrowhead shapes (round 10)', async ({ page }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');
    // round 56: this scene needs more than the suite's 400x300 — at
    // 400x300 it was cropped, and expectGraphFits now says so
    await useViewport(page, 400, 440);

    const shapes = [
      'triangle',
      'vee',
      'chevron',
      'circle',
      'square',
      'diamond',
      'tee',
      // round 27.6: v3's compound heads
      'triangle-tee',
      'circle-triangle',
      'triangle-cross',
      'triangle-backcurve',
    ];
    const elements = [];

    for (let i = 0; i < shapes.length; i++) {
      const y = i * 36 - 108;

      elements.push(
        { data: { id: `l${i}` }, position: { x: -140, y } },
        { data: { id: `r${i}` }, position: { x: 140, y } },
        {
          data: {
            id: `e${i}`,
            source: `l${i}`,
            target: `r${i}`,
            shape: shapes[i],
          },
        },
      );
    }

    // one source-end arrow: pins the source/target byte order in the packed column
    elements.push({
      data: {
        id: 'e-src',
        source: 'l0',
        target: 'r6',
        shape: 'vee',
        atSource: 1,
      },
    });

    await makeReadyCy(page, {
      elements,
      style: {
        nodes: { width: 14, height: 14, 'background-color': '#95a5a6' },
        edges: {
          width: 4,
          'line-color': '#7f8c8d',
          'target-arrow-shape': {
            case: [
              { when: { data: 'atSource', eq: 1 }, then: 'none' },
              { when: { data: 'shape', eq: 'vee' }, then: 'vee' },
              { when: { data: 'shape', eq: 'chevron' }, then: 'chevron' },
              { when: { data: 'shape', eq: 'circle' }, then: 'circle' },
              { when: { data: 'shape', eq: 'square' }, then: 'square' },
              { when: { data: 'shape', eq: 'diamond' }, then: 'diamond' },
              { when: { data: 'shape', eq: 'tee' }, then: 'tee' },
              // Round 56.  These four were added to the `shapes` list by round
              // 27.6 and never given a clause, so they fell through to
              // `triangle` — and the rows they occupy were below the 300 px
              // crop, so the golden showed seven heads while claiming eleven.
              // Two defects hiding each other: the crop hid the missing
              // mapper, and the missing mapper meant the crop removed nothing
              // that looked wrong.
              {
                when: { data: 'shape', eq: 'triangle-tee' },
                then: 'triangle-tee',
              },
              {
                when: { data: 'shape', eq: 'circle-triangle' },
                then: 'circle-triangle',
              },
              {
                when: { data: 'shape', eq: 'triangle-cross' },
                then: 'triangle-cross',
              },
              {
                when: { data: 'shape', eq: 'triangle-backcurve' },
                then: 'triangle-backcurve',
              },
            ],
            else: 'triangle',
          },
          'target-arrow-color': '#8e44ad',
          'source-arrow-shape': {
            case: [{ when: { data: 'atSource', eq: 1 }, then: 'chevron' }],
            else: 'none',
          },
          'source-arrow-color': '#c0392b',
        },
      },
      zoom: 1,
      pan: { x: 200, y: 150 },
    });
    await waitFrames(page);

    await expectGraphFits(page, 'arrow-shapes');
    checkGolden(
      'arrow-shapes',
      await exportPng(page, { bg: '#fff' }),
      testInfo,
    );
  });

  test('golden: the arrow gap — hollow and translucent heads (round 56)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');
    await useViewport(page, 400, 500);

    /*
     * The goldens could not see round 56's arrow trim land: of 43, eleven
     * moved and the largest by **0.178%**, against a 0.5% bound.  That is
     * not an accident of tuning — it is what the trim *is*.  v3 sizes its
     * gap so the line stops under the head, so on an opaque filled head
     * the whole difference is covered, and every arrow golden in this
     * suite used opaque filled heads.
     *
     * So this scene is built from the heads that do *not* cover it:
     * hollow ones, whose interior shows what is under it, and translucent
     * ones, where line and head each contribute their own alpha.  Those
     * are also the two cases the maintainer reported.
     *
     * Sized for sensitivity rather than looks: short edges at zoom 4, so
     * the band between v3's gap point and the head's back edge is tens of
     * pixels rather than single digits, and six ends rather than two,
     * because the band is per end.
     */
    // width 4 rather than 5: v3's `getArrowWidth` floors at 29 before
    // applying `arrow-scale`, so below about width 3.2 the head stops
    // shrinking while the gap keeps going — which *widens* the band this
    // scene is built to see.  Four rows because the band is per end.
    const rows = [
      { y: -51, fill: 'hollow', opacity: 1 },
      { y: -17, fill: 'filled', opacity: 0.45 },
      { y: 17, fill: 'hollow', opacity: 0.45 },
      { y: 51, fill: 'hollow', opacity: 1 },
    ];
    const elements = rows.flatMap((r, i) => [
      { data: { id: `s${i}` }, position: { x: -34, y: r.y } },
      { data: { id: `t${i}` }, position: { x: 34, y: r.y } },
      { data: { id: `e${i}`, row: i, source: `s${i}`, target: `t${i}` } },
    ]);

    await makeReadyCy(page, {
      elements,
      style: {
        nodes: { width: 16, height: 16, 'background-color': '#c0392b' },
        edges: {
          'curve-style': 'straight',
          width: 4,
          'arrow-scale': 2.4,
          'line-color': '#2c3e50',
          'source-arrow-shape': 'triangle',
          'target-arrow-shape': 'triangle',
          'source-arrow-color': '#2c3e50',
          'target-arrow-color': '#2c3e50',
          'source-arrow-fill': {
            case: rows.map((r, i) => ({
              when: { data: 'row', eq: i },
              then: r.fill,
            })),
            else: 'filled',
          },
          'target-arrow-fill': {
            case: rows.map((r, i) => ({
              when: { data: 'row', eq: i },
              then: r.fill,
            })),
            else: 'filled',
          },
          'line-opacity': {
            case: rows.map((r, i) => ({
              when: { data: 'row', eq: i },
              then: r.opacity,
            })),
            else: 1,
          },
        },
      },
      zoom: 4,
      pan: { x: 200, y: 250 },
    });
    await waitFrames(page);

    await expectGraphFits(page, 'arrow-gap');
    checkGolden('arrow-gap', await exportPng(page, { bg: '#fff' }), testInfo);
  });

  test('golden: edge line styles (solid, dashed, dotted)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    const rows = ['solid', 'dashed', 'dotted'];
    const elements = [];

    for (let i = 0; i < rows.length; i++) {
      const y = i * 60 - 60;

      elements.push(
        { data: { id: `l${i}`, ls: rows[i] }, position: { x: -160, y } },
        { data: { id: `r${i}`, ls: rows[i] }, position: { x: 160, y } },
        {
          data: { id: `e${i}`, source: `l${i}`, target: `r${i}`, ls: rows[i] },
        },
      );
    }

    // a diagonal wide dashed edge: the pattern runs along the edge, not an axis
    elements.push({
      data: { id: 'e-diag', source: 'l0', target: 'r2', ls: 'dashed' },
    });

    await makeReadyCy(page, {
      elements,
      style: {
        nodes: { width: 16, height: 16, 'background-color': '#7f8c8d' },
        edges: {
          width: {
            case: [{ when: { data: 'id', eq: 'e-diag' }, then: 6 }],
            else: 3,
          },
          'line-color': '#2c3e50',
          'line-style': {
            case: [
              { when: { data: 'ls', eq: 'dashed' }, then: 'dashed' },
              { when: { data: 'ls', eq: 'dotted' }, then: 'dotted' },
            ],
            else: 'solid',
          },
        },
      },
      zoom: 1,
      pan: { x: 200, y: 150 },
    });
    await waitFrames(page);

    await expectGraphFits(page, 'line-styles');
    checkGolden('line-styles', await exportPng(page, { bg: '#fff' }), testInfo);
  });

  test('golden: border and outline styles, every shape tier (round 38)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    // The whole matrix on one canvas: eight shapes spanning every
    // perimeter tier (closed-form, generated polygon walk, sampled
    // barrel, octagon walk, round-* source approximation) x dashed /
    // dotted / double, plus dashed and dotted OUTLINE rows.  The
    // outline rows carry the polygon-family shapes deliberately: their
    // dash phase vs v3 is a recorded deviation (v3 miters corners
    // where v4's ring rounds them), so this golden is their only pixel
    // coverage — the parity scene pins the ellipse family instead.
    const shapes = [
      'ellipse',
      'rectangle',
      'round-rectangle',
      'hexagon',
      'star',
      'barrel',
      'cut-rectangle',
      'round-hexagon',
    ];
    const rows = ['dashed', 'dotted', 'double', 'o-dashed', 'o-dotted'];
    const elements = [];

    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < shapes.length; c++) {
        elements.push({
          data: {
            id: `n${r}_${c}`,
            sh: shapes[c],
            st: rows[r],
            // the dashed ellipse also draws a ghost: fsGhost carries the
            // same dash machinery as fsNode, and this cell is its only
            // pixel coverage
            g: r === 0 && c === 0 ? 1 : 0,
          },
          position: { x: c * 62 - 217, y: r * 64 - 128 },
        });
      }
    }

    await useViewport(page, 560, 380);
    await makeReadyCy(page, {
      elements,
      style: {
        nodes: {
          width: 50,
          height: 42,
          'background-color': '#fdf6e3',
          'border-width': {
            case: [
              { when: { data: 'st', eq: 'o-dashed' }, then: 0 },
              { when: { data: 'st', eq: 'o-dotted' }, then: 0 },
            ],
            else: 5,
          },
          'border-color': '#1a5276',
          'border-style': {
            case: [
              { when: { data: 'st', eq: 'dashed' }, then: 'dashed' },
              { when: { data: 'st', eq: 'dotted' }, then: 'dotted' },
              { when: { data: 'st', eq: 'double' }, then: 'double' },
            ],
            else: 'solid',
          },
          'border-dash-pattern': [7, 3],
          'outline-width': {
            case: [
              { when: { data: 'st', eq: 'o-dashed' }, then: 5 },
              { when: { data: 'st', eq: 'o-dotted' }, then: 5 },
            ],
            else: 0,
          },
          'outline-color': '#7d3c98',
          'outline-offset': 3,
          'outline-style': {
            case: [{ when: { data: 'st', eq: 'o-dotted' }, then: 'dotted' }],
            else: 'dashed',
          },
          ghost: {
            case: [{ when: { data: 'g', eq: 1 }, then: 'yes' }],
            else: 'no',
          },
          'ghost-offset-x': 9,
          'ghost-offset-y': 7,
          'ghost-opacity': 0.5,
          shape: {
            case: [
              { when: { data: 'sh', eq: 'ellipse' }, then: 'ellipse' },
              { when: { data: 'sh', eq: 'rectangle' }, then: 'rectangle' },
              {
                when: { data: 'sh', eq: 'round-rectangle' },
                then: 'round-rectangle',
              },
              { when: { data: 'sh', eq: 'hexagon' }, then: 'hexagon' },
              { when: { data: 'sh', eq: 'star' }, then: 'star' },
              { when: { data: 'sh', eq: 'barrel' }, then: 'barrel' },
              {
                when: { data: 'sh', eq: 'cut-rectangle' },
                then: 'cut-rectangle',
              },
              {
                when: { data: 'sh', eq: 'round-hexagon' },
                then: 'round-hexagon',
              },
            ],
            else: 'ellipse',
          },
        },
      },
      zoom: 1,
      pan: { x: 280, y: 190 },
    });
    await waitFrames(page);

    await expectGraphFits(page, 'border-styles');
    checkGolden(
      'border-styles',
      await exportPng(page, { bg: '#fff' }),
      testInfo,
    );
  });

  test('golden: GPU-evaluated color mappers (viridis scale)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    await page.evaluate(async () => {
      const nodes = [];
      const edges = [];

      for (let i = 0; i < 9; i++) {
        nodes.push({
          data: { id: `n${i}`, weight: i / 8 },
          position: { x: (i % 3) * 100 - 100, y: Math.floor(i / 3) * 80 - 80 },
        });

        if (i > 0) {
          edges.push({
            data: {
              id: `e${i}`,
              source: `n${i - 1}`,
              target: `n${i}`,
              w: i / 8,
            },
          });
        }
      }

      const cy = window.makeCy({
        elements: [...nodes, ...edges],
        style: {
          nodes: {
            width: 40,
            height: 40,
            'background-color': {
              data: 'weight',
              domain: [0, 1],
              range: 'viridis',
            },
          },
          edges: {
            width: 3,
            'line-color': {
              data: 'w',
              domain: [0, 1],
              range: ['#e74c3c', '#3498db'],
            },
          },
        },
        zoom: 1,
        pan: { x: 200, y: 150 },
      });

      await cy.ready;
      await new Promise((resolve) => {
        cy.one('render', () => resolve());
        cy.panBy({ x: 1, y: 0 });
        cy.panBy({ x: -1, y: 0 });
      });
    });
    await waitFrames(page);

    await expectGraphFits(page, 'mapped-colors');
    checkGolden(
      'mapped-colors',
      await exportPng(page, { bg: '#fff' }),
      testInfo,
    );
  });

  test('golden: far-zoom LOD (width floors, decimation, plain discs)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    await page.evaluate(async () => {
      // a deterministic 30×20 grid with row-wise chains: at zoom 0.05 the
      // nodes collapse to plain discs and the hairline edges floor + dim
      const nodes = [];
      const edges = [];

      for (let row = 0; row < 20; row++) {
        for (let col = 0; col < 30; col++) {
          const i = row * 30 + col;

          nodes.push({
            data: { id: `n${i}` },
            position: { x: col * 120, y: row * 120 },
          });

          if (col > 0) {
            edges.push({
              data: { id: `e${i}`, source: `n${i - 1}`, target: `n${i}` },
            });
          }
        }
      }

      const cy = window.makeCy({
        elements: [...nodes, ...edges],
        style: {
          nodes: { width: 30, height: 30, 'background-color': '#34495e' },
          edges: { width: 2, 'line-color': '#7f8c8d' },
        },
        zoom: 0.05,
        pan: { x: 110, y: 90 },
      });

      await cy.ready;
      await new Promise((resolve) => {
        cy.one('render', () => resolve());
        cy.panBy({ x: 1, y: 0 });
        cy.panBy({ x: -1, y: 0 });
      });
    });
    await waitFrames(page);

    await expectGraphFits(page, 'far-zoom-lod');
    checkGolden(
      'far-zoom-lod',
      await exportPng(page, { bg: '#fff' }),
      testInfo,
    );
  });

  test('golden: labels in the fixed web font (Open Sans)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    // the atlas caches lazily and forever: the font MUST be loaded before
    // the instance exists, or fallback-font glyphs get cached instead
    await page.evaluate(async () => {
      await document.fonts.load(`32px 'Open Sans'`);

      if (!document.fonts.check(`32px 'Open Sans'`)) {
        throw new Error('Open Sans did not load');
      }
    });

    await makeReadyCy(page, {
      elements: [
        { data: { id: 'Alpha 1' }, position: { x: -100, y: -70 } },
        { data: { id: 'beta-2' }, position: { x: 100, y: -70 } },
        { data: { id: 'GAMMA_3' }, position: { x: -100, y: 50 } },
        { data: { id: 'the quick brown fox' }, position: { x: 100, y: 50 } },
        { data: { id: 'e1', source: 'Alpha 1', target: 'beta-2' } },
      ],
      style: {
        nodes: {
          width: 40,
          height: 30,
          'background-color': '#dfe6e9',
          'border-width': 1,
          'border-color': '#b2bec3',
          label: { data: 'id' },
          'font-size': 14,
          color: '#2d3436',
          'font-family': `'Open Sans', sans-serif`,
        },
        edges: { width: 2 },
      },
      zoom: 1,
      pan: { x: 200, y: 160 },
    });
    await waitFrames(page);

    // looser bound than geometry goldens: the OS text rasterizer under the
    // atlas differs per platform (see the header comment)
    await expectGraphFits(page, 'labels-open-sans');
    checkGolden(
      'labels-open-sans',
      await exportPng(page, { bg: '#fff' }),
      testInfo,
    );
  });

  test('golden: edge labels at midpoints (round 10)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    await page.evaluate(async () => {
      await document.fonts.load(`32px 'Open Sans'`);

      if (!document.fonts.check(`32px 'Open Sans'`)) {
        throw new Error('Open Sans did not load');
      }
    });

    await makeReadyCy(page, {
      elements: [
        { data: { id: 'a' }, position: { x: -140, y: -70 } },
        { data: { id: 'b' }, position: { x: 140, y: -70 } },
        { data: { id: 'c' }, position: { x: -140, y: 30 } },
        { data: { id: 'd' }, position: { x: 140, y: 110 } },
        {
          data: {
            id: 'ab',
            source: 'a',
            target: 'b',
            lbl: 'connects',
            boxed: 0,
          },
        },
        {
          data: {
            id: 'cd',
            source: 'c',
            target: 'd',
            lbl: 'diagonal',
            boxed: 1,
          },
        },
      ],
      style: {
        // the shared atlas font is the node sheet's font-family (one font
        // per atlas), even though only edges are labelled here
        nodes: {
          width: 20,
          height: 20,
          'background-color': '#b2bec3',
          'font-family': `'Open Sans', sans-serif`,
        },
        edges: {
          width: 2,
          'line-color': '#b2bec3',
          label: { data: 'lbl' },
          'font-size': 14,
          color: '#2d3436',
          'text-background-color': '#ffeaa7',
          'text-background-opacity': {
            case: [{ when: { data: 'boxed', eq: 1 }, then: 1 }],
            else: 0,
          },
          'text-background-padding': 2,
        },
      },
      zoom: 1,
      pan: { x: 200, y: 150 },
    });
    await waitFrames(page);

    await expectGraphFits(page, 'edge-labels');
    checkGolden('edge-labels', await exportPng(page, { bg: '#fff' }), testInfo);
  });

  test('golden: edge label autorotate (angles + the flip rule)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');
    // round 56: this scene needs more than the suite's 400x300 — at
    // 400x300 it was cropped, and expectGraphFits now says so
    await useViewport(page, 400, 330);

    await page.evaluate(async () => {
      await document.fonts.load(`32px 'Open Sans'`);

      if (!document.fonts.check(`32px 'Open Sans'`)) {
        throw new Error('Open Sans did not load');
      }
    });

    await makeReadyCy(page, {
      elements: [
        // downhill left-to-right diagonal: rotates to the positive slope
        { data: { id: 'a' }, position: { x: -160, y: -100 } },
        { data: { id: 'b' }, position: { x: -20, y: 20 } },
        // the delta points left (source right of target): the flip rule
        // negates it, so the label still reads left-to-right — its
        // background box pins that the quad rotates with the text
        { data: { id: 'c' }, position: { x: 160, y: -100 } },
        { data: { id: 'd' }, position: { x: 20, y: 20 } },
        // vertical: reads top-to-bottom at +90° (the dx == 0 case)
        { data: { id: 'e' }, position: { x: 0, y: 40 } },
        { data: { id: 'f' }, position: { x: 0, y: 130 } },
        {
          data: {
            id: 'ab',
            source: 'a',
            target: 'b',
            lbl: 'downhill',
            boxed: 0,
          },
        },
        {
          data: { id: 'cd', source: 'c', target: 'd', lbl: 'uphill', boxed: 1 },
        },
        { data: { id: 'ef', source: 'e', target: 'f', lbl: 'down', boxed: 0 } },
      ],
      style: {
        nodes: {
          width: 16,
          height: 16,
          'background-color': '#b2bec3',
          'font-family': `'Open Sans', sans-serif`,
        },
        edges: {
          width: 2,
          'line-color': '#b2bec3',
          label: { data: 'lbl' },
          'font-size': 14,
          color: '#2d3436',
          'text-rotation': 'autorotate',
          'text-background-color': '#ffeaa7',
          'text-background-opacity': {
            case: [{ when: { data: 'boxed', eq: 1 }, then: 1 }],
            else: 0,
          },
          'text-background-padding': 2,
        },
      },
      zoom: 1,
      pan: { x: 200, y: 150 },
    });
    await waitFrames(page);

    await expectGraphFits(page, 'edge-label-autorotate');
    checkGolden(
      'edge-label-autorotate',
      await exportPng(page, { bg: '#fff' }),
      testInfo,
    );
  });

  test('golden: bezier bundles (round 12a)', async ({ page }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    await makeReadyCy(page, {
      elements: [
        // 2-bundle: symmetric fan
        { data: { id: 'a1' }, position: { x: -140, y: -90 } },
        { data: { id: 'b1' }, position: { x: 40, y: -90 } },
        { data: { id: 'p0', source: 'a1', target: 'b1' } },
        { data: { id: 'p1', source: 'a1', target: 'b1' } },
        // 3-bundle with an antiparallel member: middle edge straight
        { data: { id: 'a2' }, position: { x: -140, y: 10 } },
        { data: { id: 'b2' }, position: { x: 40, y: 10 } },
        { data: { id: 'q0', source: 'a2', target: 'b2' } },
        { data: { id: 'q1', source: 'a2', target: 'b2' } },
        { data: { id: 'q2', source: 'b2', target: 'a2' } },
        // a lone bezier edge renders straight (the signed-off v3 rule)
        { data: { id: 'a3' }, position: { x: -140, y: 110 } },
        { data: { id: 'b3' }, position: { x: 40, y: 110 } },
        { data: { id: 'r0', source: 'a3', target: 'b3' } },
        // a dashed curved pair: dashes ride the curve's arc length
        { data: { id: 'c1' }, position: { x: 130, y: -80 } },
        { data: { id: 'c2' }, position: { x: 130, y: 100 } },
        { data: { id: 's0', source: 'c1', target: 'c2', dashed: 1 } },
        { data: { id: 's1', source: 'c1', target: 'c2', dashed: 1 } },
      ],
      style: {
        nodes: { width: 24, height: 24, 'background-color': '#3498db' },
        edges: {
          'curve-style': 'bezier',
          width: 3,
          'line-color': '#7f8c8d',
          'line-style': {
            case: [{ when: { data: 'dashed', eq: 1 }, then: 'dashed' }],
            else: 'solid',
          },
        },
      },
      zoom: 1,
      pan: { x: 200, y: 150 },
    });
    await waitFrames(page);

    await expectGraphFits(page, 'bezier-bundles');
    checkGolden(
      'bezier-bundles',
      await exportPng(page, { bg: '#fff' }),
      testInfo,
    );
  });

  test('golden: self-loops (round 12a)', async ({ page }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    await makeReadyCy(page, {
      elements: [
        // one default loop: -45deg, extending upper-left
        { data: { id: 'n1' }, position: { x: -90, y: -30 } },
        { data: { id: 'l1', source: 'n1', target: 'n1' } },
        // three same-direction loops: the j-stagger
        { data: { id: 'n2' }, position: { x: 80, y: -30 } },
        { data: { id: 'l2a', source: 'n2', target: 'n2' } },
        { data: { id: 'l2b', source: 'n2', target: 'n2' } },
        { data: { id: 'l2c', source: 'n2', target: 'n2' } },
        // custom direction/sweep: opens to the right, wide sweep
        { data: { id: 'n3' }, position: { x: -90, y: 100 } },
        { data: { id: 'l3', source: 'n3', target: 'n3', wide: 1 } },
        // a straight-styled loop still draws as a loop (v4 rule)
        { data: { id: 'n4' }, position: { x: 80, y: 100 } },
        { data: { id: 'l4', source: 'n4', target: 'n4', plain: 1 } },
      ],
      style: {
        nodes: { width: 26, height: 26, 'background-color': '#3498db' },
        edges: {
          'curve-style': {
            case: [{ when: { data: 'plain', eq: 1 }, then: 'straight' }],
            else: 'bezier',
          },
          width: 3,
          'line-color': '#7f8c8d',
          'loop-direction': {
            case: [{ when: { data: 'wide', eq: 1 }, then: '90deg' }],
            else: '-45deg',
          },
          'loop-sweep': {
            case: [{ when: { data: 'wide', eq: 1 }, then: '-150deg' }],
            else: '-90deg',
          },
        },
      },
      zoom: 1,
      pan: { x: 200, y: 150 },
    });
    await waitFrames(page);

    await expectGraphFits(page, 'self-loops');
    checkGolden('self-loops', await exportPng(page, { bg: '#fff' }), testInfo);
  });

  test('golden: curved-edge arrowheads on end tangents (round 12a)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    await makeReadyCy(page, {
      elements: [
        // a 2-bundle: the target arrows must tilt with each curve's end
        // tangent (toward the fan), not lie on the chord
        { data: { id: 'a1' }, position: { x: -140, y: -60 } },
        { data: { id: 'b1' }, position: { x: 60, y: -60 } },
        { data: { id: 'p0', source: 'a1', target: 'b1' } },
        { data: { id: 'p1', source: 'a1', target: 'b1' } },
        // an antiparallel pair: one arrow at each node, tangents mirrored
        { data: { id: 'a2' }, position: { x: -140, y: 70 } },
        { data: { id: 'b2' }, position: { x: 60, y: 70 } },
        { data: { id: 'q0', source: 'a2', target: 'b2' } },
        { data: { id: 'q1', source: 'b2', target: 'a2' } },
        // a loop: the arrow rides the loop's in-ray tangent
        { data: { id: 'n' }, position: { x: 150, y: 10 } },
        { data: { id: 'loop', source: 'n', target: 'n' } },
      ],
      style: {
        nodes: { width: 30, height: 30, 'background-color': '#3498db' },
        edges: {
          'curve-style': 'bezier',
          'control-point-step-size': 60,
          width: 3,
          'line-color': '#7f8c8d',
          'target-arrow-shape': 'triangle',
          'target-arrow-color': '#8e44ad',
        },
      },
      zoom: 1,
      pan: { x: 200, y: 150 },
    });
    await waitFrames(page);

    await expectGraphFits(page, 'curved-arrows');
    checkGolden(
      'curved-arrows',
      await exportPng(page, { bg: '#fff' }),
      testInfo,
    );
  });

  test('golden: curved-edge labels at the curve midpoint (round 12a)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    await page.evaluate(async () => {
      await document.fonts.load(`32px 'Open Sans'`);

      if (!document.fonts.check(`32px 'Open Sans'`)) {
        throw new Error('Open Sans did not load');
      }
    });

    await makeReadyCy(page, {
      elements: [
        // a bundle: each label rides its own curve's midpoint; the boxed
        // one autorotates — on a bezier the midpoint tangent is the
        // chord, so the tilt matches the diagonal
        { data: { id: 'a' }, position: { x: -150, y: -110 } },
        { data: { id: 'b' }, position: { x: 90, y: 30 } },
        {
          data: {
            id: 'p0',
            source: 'a',
            target: 'b',
            lbl: 'over',
            rot: 1,
            boxed: 1,
          },
        },
        {
          data: {
            id: 'p1',
            source: 'a',
            target: 'b',
            lbl: 'under',
            rot: 0,
            boxed: 0,
          },
        },
        // a loop label at the loop midpoint; autorotated along the
        // loop's c1->c2 tangent
        { data: { id: 'n' }, position: { x: 120, y: 110 } },
        {
          data: {
            id: 'loop',
            source: 'n',
            target: 'n',
            lbl: 'loop',
            rot: 1,
            boxed: 0,
          },
        },
      ],
      style: {
        nodes: {
          width: 22,
          height: 22,
          'background-color': '#b2bec3',
          'font-family': `'Open Sans', sans-serif`,
        },
        edges: {
          'curve-style': 'bezier',
          'control-point-step-size': 60,
          width: 2,
          'line-color': '#b2bec3',
          label: { data: 'lbl' },
          'font-size': 14,
          color: '#2d3436',
          'text-rotation': {
            case: [{ when: { data: 'rot', eq: 1 }, then: 'autorotate' }],
            else: 'none',
          },
          'text-background-color': '#ffeaa7',
          'text-background-opacity': {
            case: [{ when: { data: 'boxed', eq: 1 }, then: 1 }],
            else: 0,
          },
          'text-background-padding': 2,
        },
      },
      zoom: 1,
      pan: { x: 200, y: 150 },
    });
    await waitFrames(page);

    await expectGraphFits(page, 'curved-edge-labels');
    checkGolden(
      'curved-edge-labels',
      await exportPng(page, { bg: '#fff' }),
      testInfo,
    );
  });

  test('golden: unbundled bezier splines (round 12b)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    // one sheet-wide control list (list props are constants), varied by
    // arrangement: S-curves across three orientations, a dashed run
    // (dashes ride the route's arc length) and an unbundled loop (its
    // loop distance is control-point-distances[0])
    await makeReadyCy(page, {
      elements: [
        { data: { id: 'a1' }, position: { x: -150, y: -100 } },
        { data: { id: 'b1' }, position: { x: 30, y: -100 } },
        { data: { id: 'h', source: 'a1', target: 'b1' } },
        { data: { id: 'a2' }, position: { x: -140, y: -20 } },
        { data: { id: 'b2' }, position: { x: -140, y: 120 } },
        { data: { id: 'v', source: 'a2', target: 'b2' } },
        { data: { id: 'a3' }, position: { x: -40, y: 0 } },
        { data: { id: 'b3' }, position: { x: 120, y: 110 } },
        { data: { id: 'diag', source: 'a3', target: 'b3', dashed: 1 } },
        { data: { id: 'n' }, position: { x: 120, y: -60 } },
        { data: { id: 'loop', source: 'n', target: 'n' } },
      ],
      style: {
        nodes: { width: 24, height: 24, 'background-color': '#3498db' },
        edges: {
          'curve-style': 'unbundled-bezier',
          'control-point-distances': [50, -50],
          'control-point-weights': [0.25, 0.75],
          width: 3,
          'line-color': '#7f8c8d',
          'line-style': {
            case: [{ when: { data: 'dashed', eq: 1 }, then: 'dashed' }],
            else: 'solid',
          },
        },
      },
      zoom: 1,
      pan: { x: 200, y: 150 },
    });
    await waitFrames(page);

    await expectGraphFits(page, 'unbundled-bezier');
    checkGolden(
      'unbundled-bezier',
      await exportPng(page, { bg: '#fff' }),
      testInfo,
    );
  });

  test('golden: segments and round-segments (round 12b)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    await makeReadyCy(page, {
      elements: [
        // sharp vs round on the same zig-zag lists (miter corners above,
        // radius-18 arcs below)
        { data: { id: 'a1' }, position: { x: -150, y: -100 } },
        { data: { id: 'b1' }, position: { x: 130, y: -100 } },
        { data: { id: 'sharp', source: 'a1', target: 'b1', round: 0 } },
        { data: { id: 'a2' }, position: { x: -150, y: 10 } },
        { data: { id: 'b2' }, position: { x: 130, y: 10 } },
        { data: { id: 'round', source: 'a2', target: 'b2', round: 1 } },
        // a vertical round run + a dashed sharp one (dashes follow legs)
        { data: { id: 'a3' }, position: { x: -150, y: 60 } },
        { data: { id: 'b3' }, position: { x: -150, y: 130 } },
        { data: { id: 'vert', source: 'a3', target: 'b3', round: 1 } },
        { data: { id: 'a4' }, position: { x: 0, y: 70 } },
        { data: { id: 'b4' }, position: { x: 130, y: 120 } },
        {
          data: { id: 'dash', source: 'a4', target: 'b4', round: 0, dashed: 1 },
        },
      ],
      style: {
        nodes: { width: 24, height: 24, 'background-color': '#e67e22' },
        edges: {
          'curve-style': {
            case: [{ when: { data: 'round', eq: 1 }, then: 'round-segments' }],
            else: 'segments',
          },
          'segment-distances': [40, -40],
          'segment-weights': [0.3, 0.7],
          'segment-radii': 18,
          width: 3,
          'line-color': '#7f8c8d',
          'line-style': {
            case: [{ when: { data: 'dashed', eq: 1 }, then: 'dashed' }],
            else: 'solid',
          },
        },
      },
      zoom: 1,
      pan: { x: 200, y: 150 },
    });
    await waitFrames(page);

    await expectGraphFits(page, 'segments-families');
    checkGolden(
      'segments-families',
      await exportPng(page, { bg: '#fff' }),
      testInfo,
    );
  });

  test('golden: taxi and round-taxi (round 12b)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    await makeReadyCy(page, {
      elements: [
        // auto (horizontal here), with a target arrow riding the final leg
        { data: { id: 'a1' }, position: { x: -160, y: -110 } },
        { data: { id: 'b1' }, position: { x: -20, y: -40 } },
        {
          data: {
            id: 'auto',
            source: 'a1',
            target: 'b1',
            dir: 'auto',
            round: 0,
          },
        },
        // explicit vertical with a px turn
        { data: { id: 'a2' }, position: { x: 60, y: -120 } },
        { data: { id: 'b2' }, position: { x: 160, y: 10 } },
        {
          data: {
            id: 'vert',
            source: 'a2',
            target: 'b2',
            dir: 'vertical',
            round: 0,
            turnPx: 30,
          },
        },
        // round-taxi corners
        { data: { id: 'a3' }, position: { x: -160, y: 30 } },
        { data: { id: 'b3' }, position: { x: -20, y: 130 } },
        {
          data: { id: 'rt', source: 'a3', target: 'b3', dir: 'auto', round: 1 },
        },
        // rightward against the delta (the forced-direction growth case)
        { data: { id: 'a4' }, position: { x: 150, y: 130 } },
        { data: { id: 'b4' }, position: { x: 50, y: 60 } },
        {
          data: {
            id: 'forced',
            source: 'a4',
            target: 'b4',
            dir: 'rightward',
            round: 0,
            turnPx: 25,
          },
        },
      ],
      style: {
        nodes: { width: 24, height: 24, 'background-color': '#16a085' },
        edges: {
          'curve-style': {
            case: [{ when: { data: 'round', eq: 1 }, then: 'round-taxi' }],
            else: 'taxi',
          },
          'taxi-direction': { data: 'dir' },
          'taxi-turn': { data: 'turnPx', fallback: 40 },
          'taxi-radius': 12,
          width: 3,
          'line-color': '#7f8c8d',
          'target-arrow-shape': 'triangle',
          'target-arrow-color': '#8e44ad',
        },
      },
      zoom: 1,
      pan: { x: 200, y: 150 },
    });
    await waitFrames(page);

    await expectGraphFits(page, 'taxi-families');
    checkGolden(
      'taxi-families',
      await exportPng(page, { bg: '#fff' }),
      testInfo,
    );
  });

  test('golden: label visuals (outline, background, margins)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    await page.evaluate(async () => {
      await document.fonts.load(`32px 'Open Sans'`);

      if (!document.fonts.check(`32px 'Open Sans'`)) {
        throw new Error('Open Sans did not load');
      }
    });

    await makeReadyCy(page, {
      elements: [
        {
          data: { id: 'outlined', kind: 'outline' },
          position: { x: -100, y: -60 },
        },
        { data: { id: 'boxed', kind: 'bg' }, position: { x: 100, y: -60 } },
        { data: { id: 'shifted', kind: 'margin' }, position: { x: 0, y: 60 } },
      ],
      style: {
        nodes: {
          width: 40,
          height: 30,
          'background-color': '#dfe6e9',
          label: { data: 'id' },
          'font-size': 16,
          color: '#ffffff',
          'font-family': `'Open Sans', sans-serif`,
          'text-outline-width': {
            case: [{ when: { data: 'kind', eq: 'outline' }, then: 3 }],
            else: 0,
          },
          'text-outline-color': '#c0392b',
          'text-background-color': '#2c3e50',
          'text-background-opacity': {
            case: [{ when: { data: 'kind', eq: 'bg' }, then: 1 }],
            else: 0,
          },
          'text-background-padding': 3,
          'text-margin-x': {
            case: [{ when: { data: 'kind', eq: 'margin' }, then: 30 }],
            else: 0,
          },
          'text-margin-y': {
            case: [{ when: { data: 'kind', eq: 'margin' }, then: -60 }],
            else: 0,
          },
        },
      },
      zoom: 1,
      pan: { x: 200, y: 150 },
    });
    await waitFrames(page);

    await expectGraphFits(page, 'label-visuals');
    checkGolden(
      'label-visuals',
      await exportPng(page, { bg: '#888' }),
      testInfo,
    );
  });

  /**
   * The round-95 scene: dark ink with a *contrasting* outline over
   * several words — the configuration that exposes the outline-order
   * defect, since a same-colour outline paints over it.  Before the
   * two-phase draw, each glyph's opaque outline ring composited over
   * the previous letter's ink and cut light notches into every word,
   * and the control is the diff itself: the pre-95 render fails this
   * golden by 1,984 px (1.653%) — the notches.  The rotated node is
   * here because rotated glyph quads overlap differently; the boxed
   * node pins the background quad staying under both phases.
   */
  const OUTLINE_WORDS_SCENE = {
    elements: [
      {
        data: { id: 'Wavelength Wavelength', kind: 'words' },
        position: { x: 0, y: -85 },
      },
      {
        data: { id: 'Notch Watch Vans', kind: 'rot' },
        position: { x: 0, y: 5 },
      },
      {
        data: { id: 'Wavelength Boxed', kind: 'boxed' },
        position: { x: 0, y: 90 },
      },
    ],
    style: {
      nodes: {
        width: 30,
        height: 20,
        'background-color': '#dfe6e9',
        label: { data: 'id' },
        'font-size': 14,
        'font-family': `'Open Sans', sans-serif`,
        color: '#2d3436',
        'text-outline-width': 2,
        'text-outline-color': '#ffffff',
        'text-rotation': {
          case: [{ when: { data: 'kind', eq: 'rot' }, then: 0.663 }], // 38°
          else: 0,
        },
        'text-background-color': '#ffeaa7',
        'text-background-opacity': {
          case: [{ when: { data: 'kind', eq: 'boxed' }, then: 1 }],
          else: 0,
        },
        'text-background-padding': 2,
      },
    },
  };

  test('golden: outlined words — the outline under the ink (round 95)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    await page.evaluate(async () => {
      await document.fonts.load(`32px 'Open Sans'`);

      if (!document.fonts.check(`32px 'Open Sans'`)) {
        throw new Error('Open Sans did not load');
      }
    });

    await makeReadyCy(page, {
      ...OUTLINE_WORDS_SCENE,
      zoom: 1,
      pan: { x: 200, y: 150 },
    });
    await waitFrames(page);

    await expectGraphFits(page, 'label-outline-words');
    checkGolden(
      'label-outline-words',
      await exportPng(page, { bg: '#888' }),
      testInfo,
    );
  });

  test('golden: outlined words close up at zoom 4 (round 95)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    // the close-up pins the zoomed look of the ring itself.  Note what
    // it does not do: the pre-95 render differs by only 15 px here —
    // at 14px the requested 2px outline saturates the 0.45 SDF-unit
    // cap, and the zoom-1 notches on this scene are that capped ring's
    // fwidth fringe bleeding into the neighbour's ink, a fringe zoom 4
    // narrows fourfold.  The zoom-1 golden above is the discriminating
    // control; this one answers "did the close-up rendering change?"
    await useViewport(page, 800, 300);
    await page.evaluate(async () => {
      await document.fonts.load(`32px 'Open Sans'`);

      if (!document.fonts.check(`32px 'Open Sans'`)) {
        throw new Error('Open Sans did not load');
      }
    });

    await makeReadyCy(page, {
      elements: [OUTLINE_WORDS_SCENE.elements[0]],
      style: OUTLINE_WORDS_SCENE.style,
      zoom: 1,
      pan: { x: 400, y: 150 },
    });
    await page.evaluate(() => {
      window.cy.zoom(4);
      window.cy.center();
    });
    await waitFrames(page);

    await expectGraphFits(page, 'label-outline-closeup');
    checkGolden(
      'label-outline-closeup',
      await exportPng(page, { bg: '#888' }),
      testInfo,
    );
  });

  test('golden: haystack edges (round 12c)', async ({ page }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    // hash-stable angles make this scene deterministic across machines
    // (v3 uses Math.random() here, so haystack has no exact v3 parity —
    // this golden is the standing visual pin for radius > 0)
    await makeReadyCy(page, {
      elements: [
        { data: { id: 'a' }, position: { x: -140, y: -80 } },
        { data: { id: 'b' }, position: { x: 120, y: -100 } },
        { data: { id: 'c' }, position: { x: -100, y: 90 } },
        { data: { id: 'd' }, position: { x: 130, y: 70 } },
        { data: { id: 'ab1', source: 'a', target: 'b' } },
        { data: { id: 'ab2', source: 'a', target: 'b' } },
        { data: { id: 'ac', source: 'a', target: 'c' } },
        { data: { id: 'bd1', source: 'b', target: 'd' } },
        { data: { id: 'bd2', source: 'b', target: 'd' } },
        { data: { id: 'cd', source: 'c', target: 'd' } },
        { data: { id: 'ad', source: 'a', target: 'd' } },
        { data: { id: 'cb', source: 'c', target: 'b' } },
      ],
      style: {
        nodes: { width: 50, height: 50, 'background-color': '#2980b9' },
        edges: {
          'curve-style': 'haystack',
          'haystack-radius': 0.9,
          width: 3,
          'line-color': '#e74c3c',
        },
      },
      zoom: 1,
      pan: { x: 200, y: 150 },
    });
    await waitFrames(page);

    await expectGraphFits(page, 'haystack');
    checkGolden('haystack', await exportPng(page, { bg: '#fff' }), testInfo);
  });

  test('golden: straight-triangle edges (round 12c)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    await makeReadyCy(page, {
      elements: [
        { data: { id: 'a1' }, position: { x: -150, y: -100 } },
        { data: { id: 'b1' }, position: { x: 130, y: -100 } },
        { data: { id: 'h', source: 'a1', target: 'b1' } },
        { data: { id: 'a2' }, position: { x: -140, y: -30 } },
        { data: { id: 'b2' }, position: { x: -140, y: 120 } },
        { data: { id: 'v', source: 'a2', target: 'b2' } },
        { data: { id: 'a3' }, position: { x: -20, y: 0 } },
        { data: { id: 'b3' }, position: { x: 140, y: 110 } },
        { data: { id: 'diag', source: 'a3', target: 'b3' } },
        // an arrowed triangle: the arrow rides the apex
        { data: { id: 'a4' }, position: { x: 40, y: -40 } },
        { data: { id: 'b4' }, position: { x: 150, y: 20 } },
        { data: { id: 'arr', source: 'a4', target: 'b4', arrow: 1 } },
      ],
      style: {
        nodes: { width: 26, height: 26, 'background-color': '#8e44ad' },
        edges: {
          'curve-style': 'straight-triangle',
          width: 14,
          'line-color': '#95a5a6',
          'target-arrow-shape': {
            case: [{ when: { data: 'arrow', eq: 1 }, then: 'triangle' }],
            else: 'none',
          },
          'target-arrow-color': '#2c3e50',
        },
      },
      zoom: 1,
      pan: { x: 200, y: 150 },
    });
    await waitFrames(page);

    await expectGraphFits(page, 'straight-triangle');
    checkGolden(
      'straight-triangle',
      await exportPng(page, { bg: '#fff' }),
      testInfo,
    );
  });

  test('golden: manual endpoints + distances (round 12c)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    // endpoint props are constants-only (the point form is a list), so
    // one config shows across orientations: a px point source end, an
    // angle target end, a source distance — on straight chords and on an
    // unbundled bezier whose frame re-bases on the manual anchors
    // (edge-distances: endpoints)
    await makeReadyCy(page, {
      elements: [
        { data: { id: 'a1' }, position: { x: -150, y: -90 } },
        { data: { id: 'b1' }, position: { x: 110, y: -90 } },
        { data: { id: 'h', source: 'a1', target: 'b1' } },
        { data: { id: 'a2' }, position: { x: -140, y: -10 } },
        { data: { id: 'b2' }, position: { x: -140, y: 130 } },
        { data: { id: 'v', source: 'a2', target: 'b2' } },
        { data: { id: 'a3' }, position: { x: -30, y: 20 } },
        { data: { id: 'b3' }, position: { x: 140, y: 120 } },
        {
          data: {
            id: 'unb',
            source: 'a3',
            target: 'b3',
            fam: 'unbundled-bezier',
          },
        },
      ],
      style: {
        nodes: { width: 28, height: 28, 'background-color': '#27ae60' },
        edges: {
          'curve-style': {
            case: [
              {
                when: { data: 'fam', eq: 'unbundled-bezier' },
                then: 'unbundled-bezier',
              },
            ],
            else: 'straight',
          },
          'source-endpoint': '18 30',
          'target-endpoint': '225deg',
          'source-distance-from-node': 8,
          'edge-distances': 'endpoints',
          'control-point-distances': [45],
          'control-point-weights': [0.5],
          width: 5,
          'line-color': '#d35400',
          'target-arrow-shape': 'triangle',
          'target-arrow-color': '#2c3e50',
        },
      },
      zoom: 1,
      pan: { x: 200, y: 150 },
    });
    await waitFrames(page);

    await expectGraphFits(page, 'manual-endpoints');
    checkGolden(
      'manual-endpoints',
      await exportPng(page, { bg: '#fff' }),
      testInfo,
    );
  });

  test('golden: ghost bodies (round 13 A1)', async ({ page }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    // the simplified decided form: shape + border + background duplicated
    // at the offset, under the node — no labels or decorations
    await makeReadyCy(page, {
      elements: [
        { data: { id: 'a', shp: 'ellipse' }, position: { x: -100, y: -60 } },
        { data: { id: 'b', shp: 'rectangle' }, position: { x: 60, y: -60 } },
        { data: { id: 'c', shp: 'diamond' }, position: { x: -20, y: 70 } },
      ],
      style: {
        nodes: {
          width: 44,
          height: 36,
          'background-color': '#c0392b',
          'border-width': 4,
          'border-color': '#2c3e50',
          shape: { data: 'shp' },
          ghost: 'yes',
          'ghost-offset-x': 24,
          'ghost-offset-y': 18,
          'ghost-opacity': 0.45,
        },
      },
      zoom: 1,
      pan: { x: 200, y: 150 },
    });
    await waitFrames(page);

    await expectGraphFits(page, 'ghost');
    checkGolden('ghost', await exportPng(page, { bg: '#fff' }), testInfo);
  });

  test('golden: overlay and underlay layers (round 13 A2)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    await makeReadyCy(page, {
      elements: [
        { data: { id: 'a', kind: 'over' }, position: { x: -100, y: -50 } },
        { data: { id: 'b', kind: 'under' }, position: { x: 60, y: -50 } },
        { data: { id: 'c', kind: 'both' }, position: { x: -20, y: 70 } },
      ],
      style: {
        nodes: {
          width: 44,
          height: 36,
          'background-color': '#2980b9',
          'overlay-color': '#e74c3c',
          'overlay-padding': 8,
          'overlay-opacity': {
            case: [{ when: { data: 'kind', in: ['over', 'both'] }, then: 0.4 }],
            else: 0,
          },
          'overlay-shape': 'ellipse',
          'underlay-color': '#27ae60',
          'underlay-padding': 14,
          'underlay-opacity': {
            case: [
              { when: { data: 'kind', in: ['under', 'both'] }, then: 0.8 },
            ],
            else: 0,
          },
        },
      },
      zoom: 1,
      pan: { x: 200, y: 150 },
    });
    await waitFrames(page);

    await expectGraphFits(page, 'node-layers');
    checkGolden('node-layers', await exportPng(page, { bg: '#fff' }), testInfo);
  });

  test('golden: edge overlay/underlay strokes (round 13 A2)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    await makeReadyCy(page, {
      elements: [
        { data: { id: 'a' }, position: { x: -140, y: -70 } },
        { data: { id: 'b' }, position: { x: 120, y: -70 } },
        { data: { id: 'straight', source: 'a', target: 'b' } },
        { data: { id: 'c' }, position: { x: -140, y: 60 } },
        { data: { id: 'd' }, position: { x: 120, y: 60 } },
        { data: { id: 'taxi', source: 'c', target: 'd', fam: 'taxi' } },
        { data: { id: 'e' }, position: { x: -20, y: 130 } },
        { data: { id: 'loop', source: 'e', target: 'e', fam: 'bezier' } },
      ],
      style: {
        nodes: { width: 30, height: 30, 'background-color': '#8e44ad' },
        edges: {
          'curve-style': {
            case: [
              { when: { data: 'fam', eq: 'taxi' }, then: 'taxi' },
              { when: { data: 'fam', eq: 'bezier' }, then: 'bezier' },
            ],
            else: 'straight',
          },
          width: 5,
          'line-color': '#2c3e50',
          'overlay-color': '#e67e22',
          'overlay-opacity': 0.45,
          'overlay-padding': 5,
          'underlay-color': '#16a085',
          'underlay-opacity': 0.9,
          'underlay-padding': 10,
          'taxi-turn': 30,
        },
      },
      zoom: 1,
      pan: { x: 200, y: 150 },
    });
    await waitFrames(page);

    await expectGraphFits(page, 'edge-layers');
    checkGolden('edge-layers', await exportPng(page, { bg: '#fff' }), testInfo);
  });

  test('golden: label boxes — transform, borders, round shape (round 13 B6)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    // pre-load the fixed web font (the atlas caches lazily and forever)
    await page.evaluate(async () => {
      await document.fonts.load(`32px 'Open Sans'`);

      if (!document.fonts.check(`32px 'Open Sans'`)) {
        throw new Error('Open Sans did not load');
      }
    });
    await makeReadyCy(page, {
      elements: [
        { data: { id: 'a', kind: 'upper' }, position: { x: -100, y: -60 } },
        { data: { id: 'b', kind: 'boxed' }, position: { x: 80, y: -60 } },
        { data: { id: 'c', kind: 'round' }, position: { x: -10, y: 60 } },
      ],
      style: {
        nodes: {
          width: 24,
          height: 24,
          'background-color': '#2980b9',
          label: 'Mixed Case',
          'font-size': 18,
          'font-family': `'Open Sans', sans-serif`,
          'text-transform': {
            case: [{ when: { data: 'kind', eq: 'upper' }, then: 'uppercase' }],
            else: 'none',
          },
          'text-background-color': '#f1c40f',
          'text-background-opacity': {
            case: [{ when: { data: 'kind', in: ['boxed', 'round'] }, then: 1 }],
            else: 0,
          },
          'text-background-padding': 4,
          'text-background-shape': {
            case: [
              { when: { data: 'kind', eq: 'round' }, then: 'round-rectangle' },
            ],
            else: 'rectangle',
          },
          'text-border-width': {
            case: [{ when: { data: 'kind', in: ['boxed', 'round'] }, then: 2 }],
            else: 0,
          },
          'text-border-color': '#c0392b',
          'text-border-opacity': 1,
        },
      },
      zoom: 1,
      pan: { x: 200, y: 150 },
    });
    await waitFrames(page);

    await expectGraphFits(page, 'label-boxes');
    checkGolden('label-boxes', await exportPng(page, { bg: '#fff' }), testInfo);
  });

  test('golden: arrow scalars — scale, hollow, stroke widths (round 13 B7)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');
    // round 56: this scene needs more than the suite's 400x300 — at
    // 400x300 it was cropped, and expectGraphFits now says so
    await useViewport(page, 400, 360);

    await makeReadyCy(page, {
      elements: [
        { data: { id: 'a1' }, position: { x: -150, y: -90 } },
        { data: { id: 'b1' }, position: { x: 120, y: -90 } },
        { data: { id: 'plain', source: 'a1', target: 'b1', kind: 'plain' } },
        { data: { id: 'a2' }, position: { x: -150, y: 0 } },
        { data: { id: 'b2' }, position: { x: 120, y: 0 } },
        { data: { id: 'big', source: 'a2', target: 'b2', kind: 'big' } },
        { data: { id: 'a3' }, position: { x: -150, y: 90 } },
        { data: { id: 'b3' }, position: { x: 120, y: 90 } },
        { data: { id: 'hollow', source: 'a3', target: 'b3', kind: 'hollow' } },
        { data: { id: 'a4' }, position: { x: -150, y: 170 } },
        { data: { id: 'b4' }, position: { x: 120, y: 170 } },
        { data: { id: 'thick', source: 'a4', target: 'b4', kind: 'thick' } },
      ],
      style: {
        nodes: { width: 22, height: 22, 'background-color': '#2c3e50' },
        edges: {
          width: 5,
          'line-color': '#95a5a6',
          'source-arrow-shape': 'circle',
          'source-arrow-color': '#16a085',
          'target-arrow-shape': 'triangle',
          'target-arrow-color': '#c0392b',
          'arrow-scale': {
            case: [{ when: { data: 'kind', eq: 'big' }, then: 2 }],
            else: 1,
          },
          'target-arrow-fill': {
            case: [
              {
                when: { data: 'kind', in: ['hollow', 'thick'] },
                then: 'hollow',
              },
            ],
            else: 'filled',
          },
          'source-arrow-fill': {
            case: [{ when: { data: 'kind', eq: 'thick' }, then: 'hollow' }],
            else: 'filled',
          },
        },
      },
      zoom: 1,
      pan: { x: 200, y: 150 },
    });
    await waitFrames(page);

    await expectGraphFits(page, 'arrow-scalars');
    checkGolden(
      'arrow-scalars',
      await exportPng(page, { bg: '#fff' }),
      testInfo,
    );
  });

  test('golden: mid arrows on straight, bezier, taxi and haystack (round 13 C1)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');
    // round 56: this scene needs more than the suite's 400x300 — at
    // 400x300 it was cropped, and expectGraphFits now says so
    await useViewport(page, 400, 350);

    await makeReadyCy(page, {
      elements: [
        { data: { id: 'a1' }, position: { x: -150, y: -100 } },
        { data: { id: 'b1' }, position: { x: 120, y: -100 } },
        { data: { id: 's', source: 'a1', target: 'b1' } },
        { data: { id: 'a2' }, position: { x: -150, y: -20 } },
        { data: { id: 'b2' }, position: { x: 120, y: -20 } },
        { data: { id: 'q1', source: 'a2', target: 'b2', fam: 'bezier' } },
        { data: { id: 'q2', source: 'a2', target: 'b2', fam: 'bezier' } },
        { data: { id: 'a3' }, position: { x: -150, y: 60 } },
        { data: { id: 'b3' }, position: { x: -30, y: 160 } },
        { data: { id: 't', source: 'a3', target: 'b3', fam: 'taxi' } },
        { data: { id: 'a4' }, position: { x: 40, y: 60 } },
        { data: { id: 'b4' }, position: { x: 150, y: 160 } },
        { data: { id: 'h', source: 'a4', target: 'b4', fam: 'haystack' } },
      ],
      style: {
        nodes: { width: 26, height: 26, 'background-color': '#7f8c8d' },
        edges: {
          width: 4,
          'line-color': '#bdc3c7',
          'taxi-turn': 40,
          'haystack-radius': 0.8,
          'curve-style': {
            case: [
              { when: { data: 'fam', eq: 'bezier' }, then: 'bezier' },
              { when: { data: 'fam', eq: 'taxi' }, then: 'taxi' },
              { when: { data: 'fam', eq: 'haystack' }, then: 'haystack' },
            ],
            else: 'straight',
          },
          'mid-target-arrow-shape': 'triangle',
          'mid-target-arrow-color': '#8e44ad',
          'mid-source-arrow-shape': 'circle',
          'mid-source-arrow-color': '#16a085',
        },
      },
      zoom: 1,
      pan: { x: 200, y: 150 },
    });
    await waitFrames(page);

    await expectGraphFits(page, 'mid-arrows');
    checkGolden('mid-arrows', await exportPng(page, { bg: '#fff' }), testInfo);
  });

  test('golden: gradient fills — directions, radial, curved lines (round 13 C2)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');
    // round 56: this scene needs more than the suite's 400x300 — at
    // 400x300 it was cropped, and expectGraphFits now says so
    await useViewport(page, 400, 350);

    await makeReadyCy(page, {
      elements: [
        { data: { id: 'a', dir: 'to-right' }, position: { x: -120, y: -70 } },
        { data: { id: 'b', dir: 'to-top' }, position: { x: -10, y: -70 } },
        {
          data: { id: 'c', dir: 'to-bottom-right' },
          position: { x: 100, y: -70 },
        },
        { data: { id: 'd', radial: 1 }, position: { x: -120, y: 40 } },
        { data: { id: 'e', radial: 1, round: 1 }, position: { x: -10, y: 40 } },
        { data: { id: 'p' }, position: { x: -140, y: 140 } },
        { data: { id: 'q' }, position: { x: 150, y: 140 } },
        { data: { id: 'g1', source: 'p', target: 'q', fam: 'bezier' } },
        { data: { id: 'g2', source: 'p', target: 'q', fam: 'bezier' } },
      ],
      style: {
        nodes: {
          width: 64,
          height: 52,
          shape: {
            case: [{ when: { data: 'round', eq: 1 }, then: 'ellipse' }],
            else: 'rectangle',
          },
          'background-fill': {
            case: [
              { when: { data: 'radial', eq: 1 }, then: 'radial-gradient' },
            ],
            else: 'linear-gradient',
          },
          'background-gradient-stop-colors': '#e74c3c #f1c40f #2ecc71',
          'background-gradient-direction': {
            case: [
              { when: { data: 'dir', eq: 'to-right' }, then: 'to-right' },
              { when: { data: 'dir', eq: 'to-top' }, then: 'to-top' },
              {
                when: { data: 'dir', eq: 'to-bottom-right' },
                then: 'to-bottom-right',
              },
            ],
            else: 'to-bottom',
          },
        },
        edges: {
          width: 8,
          'curve-style': {
            case: [{ when: { data: 'fam', eq: 'bezier' }, then: 'bezier' }],
            else: 'straight',
          },
          'line-fill': 'linear-gradient',
          'line-gradient-stop-colors': '#8e44ad #3498db #16a085',
        },
      },
      zoom: 1,
      pan: { x: 200, y: 150 },
    });
    await waitFrames(page);

    await expectGraphFits(page, 'gradients');
    checkGolden('gradients', await exportPng(page, { bg: '#fff' }), testInfo);
  });

  test('golden: custom polygons — convex, concave, bordered, anisotropic (round 13 C3)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    // shape-polygon-points is constants-only (one list per sheet), so
    // the golden exercises one concave outline (a right-pointing arrow,
    // covering the SDF sign loop) across varied node geometry:
    // bordered, anisotropic, and small
    await makeReadyCy(page, {
      elements: [
        { data: { id: 'a' }, position: { x: -110, y: -50 } },
        { data: { id: 'b', wide: 1 }, position: { x: 40, y: -50 } },
        { data: { id: 'c', bordered: 1 }, position: { x: -60, y: 70 } },
        { data: { id: 'd', small: 1 }, position: { x: 70, y: 70 } },
      ],
      style: {
        nodes: {
          shape: 'polygon',
          // a right-pointing arrow: concave at the tail (sign-loop coverage)
          'shape-polygon-points': [
            -1, -0.5, 0.2, -0.5, 0.2, -1, 1, 0, 0.2, 1, 0.2, 0.5, -1, 0.5, -0.6,
            0,
          ],
          width: {
            case: [
              { when: { data: 'wide', eq: 1 }, then: 110 },
              { when: { data: 'small', eq: 1 }, then: 36 },
            ],
            else: 70,
          },
          height: {
            case: [{ when: { data: 'small', eq: 1 }, then: 30 }],
            else: 60,
          },
          'background-color': '#27ae60',
          'border-width': {
            case: [{ when: { data: 'bordered', eq: 1 }, then: 5 }],
            else: 0,
          },
          'border-color': '#2c3e50',
        },
      },
      zoom: 1,
      pan: { x: 200, y: 150 },
    });
    await waitFrames(page);

    await expectGraphFits(page, 'shape-polygon');
    checkGolden(
      'shape-polygon',
      await exportPng(page, { bg: '#fff' }),
      testInfo,
    );
  });

  test('golden: bold italic labels in the fixed web font (round 13 D1)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    // font-style/-weight are global constants (one face per atlas), so
    // the whole scene rasters bold italic; v3 pixel parity for labels
    // is impossible by recorded design (raster + placement differ), so
    // the golden pins the face like the other label goldens
    await page.evaluate(async () => {
      await document.fonts.load(`italic bold 32px 'Open Sans'`);

      if (!document.fonts.check(`italic bold 32px 'Open Sans'`)) {
        throw new Error('Open Sans (bold italic) did not load');
      }
    });

    await makeReadyCy(page, {
      elements: [
        { data: { id: 'Alpha 1' }, position: { x: -100, y: -70 } },
        { data: { id: 'beta-2' }, position: { x: 100, y: -70 } },
        { data: { id: 'weighty words' }, position: { x: -100, y: 50 } },
        { data: { id: 'the quick brown fox' }, position: { x: 100, y: 50 } },
      ],
      style: {
        nodes: {
          width: 40,
          height: 30,
          'background-color': '#dfe6e9',
          'border-width': 1,
          'border-color': '#b2bec3',
          label: { data: 'id' },
          'font-size': 14,
          color: '#2d3436',
          'font-family': `'Open Sans', sans-serif`,
          'font-style': 'italic',
          'font-weight': 'bold',
        },
      },
      zoom: 1,
      pan: { x: 200, y: 160 },
    });
    await waitFrames(page);

    await expectGraphFits(page, 'labels-bold-italic');
    checkGolden(
      'labels-bold-italic',
      await exportPng(page, { bg: '#fff' }),
      testInfo,
    );
  });

  test('golden: the 3x3 label alignment grid (round 13 D3)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    await page.evaluate(async () => {
      await document.fonts.load(`32px 'Open Sans'`);

      if (!document.fonts.check(`32px 'Open Sans'`)) {
        throw new Error('Open Sans did not load');
      }
    });

    // nine nodes, one per (halign, valign) pair, with background boxes
    // so the anchored block (not just the glyphs) is pinned
    const aligns = ['left', 'center', 'right'];
    const valigns = ['top', 'center', 'bottom'];
    const elements = [];

    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        elements.push({
          data: {
            id: `${aligns[i]}-${valigns[j]}`,
            h: aligns[i],
            v: valigns[j],
          },
          position: { x: -120 + i * 120, y: -90 + j * 95 },
        });
      }
    }

    await makeReadyCy(page, {
      elements,
      style: {
        nodes: {
          width: 46,
          height: 30,
          'background-color': '#dfe6e9',
          'border-width': 1,
          'border-color': '#b2bec3',
          label: 'lbl',
          'font-size': 12,
          color: '#2d3436',
          'font-family': `'Open Sans', sans-serif`,
          'text-background-color': '#ffeaa7',
          'text-background-opacity': 1,
          'text-background-padding': 1,
          'text-halign': {
            case: [
              { when: { data: 'h', eq: 'left' }, then: 'left' },
              { when: { data: 'h', eq: 'right' }, then: 'right' },
            ],
            else: 'center',
          },
          'text-valign': {
            case: [
              { when: { data: 'v', eq: 'top' }, then: 'top' },
              { when: { data: 'v', eq: 'bottom' }, then: 'bottom' },
            ],
            else: 'center',
          },
        },
      },
      zoom: 1,
      pan: { x: 200, y: 150 },
    });
    await waitFrames(page);

    await expectGraphFits(page, 'label-align');
    checkGolden('label-align', await exportPng(page, { bg: '#fff' }), testInfo);
  });

  test('golden: source/target labels along straight, bezier, taxi and loop edges (round 13 D4)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');
    // round 56: this scene needs more than the suite's 400x300 — at
    // 400x300 it was cropped, and expectGraphFits now says so
    await useViewport(page, 440, 400);

    await page.evaluate(async () => {
      await document.fonts.load(`32px 'Open Sans'`);

      if (!document.fonts.check(`32px 'Open Sans'`)) {
        throw new Error('Open Sans did not load');
      }
    });

    // end labels ride every curve family's arc walk; the diagonal pair
    // exercises autorotate at the end tangents
    await makeReadyCy(page, {
      elements: [
        { data: { id: 'a' }, position: { x: -140, y: -100 } },
        { data: { id: 'b' }, position: { x: 140, y: -100 } },
        { data: { id: 'st', source: 'a', target: 'b', fam: 'straight' } },
        { data: { id: 'c' }, position: { x: -140, y: -30 } },
        { data: { id: 'd' }, position: { x: 140, y: 30 } },
        {
          data: { id: 'bz1', source: 'c', target: 'd', fam: 'bezier', rot: 1 },
        },
        {
          data: { id: 'bz2', source: 'c', target: 'd', fam: 'bezier', rot: 1 },
        },
        { data: { id: 'e' }, position: { x: -140, y: 110 } },
        { data: { id: 'f' }, position: { x: 60, y: 160 } },
        { data: { id: 'tx', source: 'e', target: 'f', fam: 'taxi' } },
        { data: { id: 'g' }, position: { x: 150, y: 130 } },
        { data: { id: 'lp', source: 'g', target: 'g', fam: 'loop' } },
      ],
      style: {
        nodes: {
          width: 26,
          height: 26,
          'background-color': '#dfe6e9',
          'border-width': 1,
          'border-color': '#b2bec3',
          'font-family': `'Open Sans', sans-serif`,
        },
        edges: {
          width: 2,
          'line-color': '#b2bec3',
          'curve-style': {
            case: [
              { when: { data: 'fam', eq: 'bezier' }, then: 'bezier' },
              { when: { data: 'fam', eq: 'taxi' }, then: 'taxi' },
              { when: { data: 'fam', eq: 'loop' }, then: 'bezier' },
            ],
            else: 'straight',
          },
          'font-size': 11,
          color: '#2d3436',
          'source-label': 'src',
          'source-text-offset': 30,
          'target-label': 'tgt',
          'target-text-offset': 45,
          'source-text-rotation': {
            case: [{ when: { data: 'rot', eq: 1 }, then: 'autorotate' }],
            else: 'none',
          },
          'target-text-rotation': {
            case: [{ when: { data: 'rot', eq: 1 }, then: 'autorotate' }],
            else: 'none',
          },
          'source-text-margin-y': -2,
          'text-background-color': '#ffeaa7',
          'text-background-opacity': 1,
        },
      },
      zoom: 1,
      pan: { x: 210, y: 165 },
    });
    await waitFrames(page);

    await expectGraphFits(page, 'end-labels');
    checkGolden('end-labels', await exportPng(page, { bg: '#fff' }), testInfo);
  });

  test('golden: compound parents — nesting, padding, borders (round 14.9)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    // gp > p > (a, b) exercises the depth-ordered parent stream (outer
    // under inner under leaves); q > c is a second top-level parent with
    // explicit compound style; the a-c edge crosses both parent bands
    // (edges draw over parent bodies, v3's compound order)
    await makeReadyCy(page, {
      elements: [
        { data: { id: 'gp' } },
        { data: { id: 'p', parent: 'gp' } },
        { data: { id: 'a', parent: 'p' }, position: { x: -140, y: -20 } },
        { data: { id: 'b', parent: 'p' }, position: { x: -60, y: 30 } },
        { data: { id: 'q' } },
        { data: { id: 'c', parent: 'q' }, position: { x: 130, y: 0 } },
        { data: { id: 'ac', source: 'a', target: 'c' } },
      ],
      style: {
        nodes: {
          width: 40,
          height: 30,
          'background-color': '#e17055',
          'border-width': 2,
          'border-color': '#2d3436',
        },
        parents: {
          'background-color': '#dfe6e9',
          'border-width': 2,
          'border-color': '#0984e3',
          padding: 12,
        },
        edges: { width: 4, 'line-color': '#6c5ce7' },
      },
      zoom: 1,
      pan: { x: 200, y: 150 },
    });
    await waitFrames(page);

    await expectGraphFits(page, 'compounds');
    checkGolden('compounds', await exportPng(page, { bg: '#fff' }), testInfo);
  });

  test('golden: compound loop edges (round 14.10)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    // gp > p > (a, b): a child-to-parent edge, an ancestor edge two
    // levels up, and a parent self-loop all route around the outside
    // (v3's findCompoundLoopPoints) regardless of curve style
    await makeReadyCy(page, {
      elements: [
        { data: { id: 'gp' } },
        { data: { id: 'p', parent: 'gp' } },
        { data: { id: 'a', parent: 'p' }, position: { x: -40, y: -20 } },
        { data: { id: 'b', parent: 'p' }, position: { x: 60, y: 30 } },
        { data: { id: 'ap', source: 'a', target: 'p' } },
        { data: { id: 'agp', source: 'a', target: 'gp' } },
        { data: { id: 'pp', source: 'p', target: 'p' } },
      ],
      style: {
        nodes: {
          width: 40,
          height: 30,
          'background-color': '#e17055',
          'border-width': 2,
          'border-color': '#2d3436',
        },
        parents: {
          'background-color': '#dfe6e9',
          'border-width': 2,
          'border-color': '#0984e3',
        },
        edges: { width: 4, 'line-color': '#6c5ce7' },
      },
      zoom: 1,
      pan: { x: 230, y: 200 },
    });
    await waitFrames(page);

    await expectGraphFits(page, 'compound-loops');
    checkGolden(
      'compound-loops',
      await exportPng(page, { bg: '#fff' }),
      testInfo,
    );
  });

  // a deterministic 16x16 quadrant png (red/green/blue/yellow) as a data
  // uri — no fixture files, byte-identical everywhere
  const QUAD_PNG =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAASUlEQVR4AaXBQQ2DQAAAwWVTPSVBBg5QUDkVwQs5/BGBA3Bwn52ZrmV+GDh+JyMSSSSRRBJJJNFn3XZG/veXEYkkkkgiiSSS6AV8gQcyZv0HPAAAAABJRU5ErkJggg==';

  /** Wait until every registry entry settled (ready or failed), then a
   * few frames so uploads land on screen. */
  const waitForImages = async (page) => {
    await page.waitForFunction(
      () => window.cy._store.images.pendingCount() === 0,
    );
    await waitFrames(page, 4);
  };

  test('golden: background images — auto size, position, clip, opacity (round 15.3)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    await makeReadyCy(page, {
      elements: [
        { data: { id: 'a', kind: 'plain' }, position: { x: -120, y: -60 } },
        { data: { id: 'b', kind: 'faded' }, position: { x: 0, y: -60 } },
        { data: { id: 'c', kind: 'bare' }, position: { x: 120, y: -60 } },
        { data: { id: 'd', kind: 'plain' }, position: { x: -120, y: 60 } },
        { data: { id: 'e', kind: 'plain' }, position: { x: 0, y: 60 } },
      ],
      style: { nodes: { width: 60, height: 50 } },
      zoom: 1,
      pan: { x: 200, y: 150 },
    });

    // the imaged style lands page-side (the data uri rides an argument);
    // the imageless node opts out via the url mapper, and image opacity
    // varies per node through its own mapper
    await page.evaluate((uri) => {
      window.cy.style({
        nodes: {
          width: 60,
          height: 50,
          shape: 'rectangle',
          'background-color': '#ecf0f1',
          'border-width': 3,
          'border-color': '#2c3e50',
          'background-image': {
            case: [{ when: { data: 'kind', eq: 'bare' }, then: 'none' }],
            else: uri,
          },
          'background-image-opacity': {
            case: [{ when: { data: 'kind', eq: 'faded' }, then: 0.35 }],
            else: 1,
          },
          // fit none + auto size: the 16px quadrant image at natural size,
          // positioned toward the top-left, nudged by a px offset
          'background-fit': 'none',
          'background-position-x': '25%',
          'background-position-y': '25%',
          'background-offset-y': 4,
        },
      });
    }, QUAD_PNG);
    await waitForImages(page);

    await expectGraphFits(page, 'images-basic');
    checkGolden(
      'images-basic',
      await exportPng(page, { bg: '#fff' }),
      testInfo,
    );
  });

  test('golden: background images — cover on ellipses, clip vs none, repeat (round 15.3)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    await makeReadyCy(page, {
      elements: [
        { data: { id: 'a' }, position: { x: -110, y: 0 } },
        { data: { id: 'b' }, position: { x: 110, y: 0 } },
      ],
      style: { nodes: { width: 70, height: 56 } },
      zoom: 1,
      pan: { x: 200, y: 150 },
    });
    await page.evaluate((uri) => {
      window.cy.style({
        nodes: {
          width: 70,
          height: 56,
          shape: 'ellipse',
          'background-color': '#ecf0f1',
          'border-width': 4,
          'border-color': '#2c3e50',
          'background-image': uri,
          // cover scales the quadrant image over the ellipse; clip: node
          // masks it by the shape with the border kept visible
          'background-fit': 'cover',
        },
      });
    }, QUAD_PNG);
    await waitForImages(page);

    await expectGraphFits(page, 'images-cover-clip');
    checkGolden(
      'images-cover-clip',
      await exportPng(page, { bg: '#fff' }),
      testInfo,
    );
  });

  // 8x8 #6c5ce7, top half opaque / bottom half 50% alpha — pins the
  // multi-image blend math as well as the layer order
  const HALF_PNG =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAKklEQVR4AYXBAREAIAzEsPI3mUjABGqRwRysyTr7fQZBBBFEAZdBEEEE0QaYA0GAoqM/AAAAAElFTkSuQmCC';

  test('golden: multi-image compositing — order, overlap, per-image props (round 15.4)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    await makeReadyCy(page, {
      elements: [{ data: { id: 'a' }, position: { x: 0, y: 0 } }],
      style: { nodes: { width: 160, height: 120 } },
      zoom: 1,
      pan: { x: 200, y: 150 },
    });
    await page.evaluate(
      ({ quad, half }) => {
        window.cy.style({
          nodes: {
            width: 160,
            height: 120,
            shape: 'rectangle',
            'background-color': '#ecf0f1',
            'border-width': 3,
            'border-color': '#2c3e50',
            // four images, per-image sizes and positions; the overlaps pin
            // v3's layer order (later list entries composite on top) and
            // the translucent half pins the blend math
            'background-image': [quad, half, quad, half],
            'background-fit': 'none',
            'background-width': ['50%', '45%', '30%', '35%'],
            'background-height': ['50%', '45%', '30%', '35%'],
            'background-position-x': ['0%', '30%', '100%', '65%'],
            'background-position-y': ['0%', '30%', '0%', '85%'],
            'background-image-opacity': [1, 0.8, 1, 1],
          },
        });
      },
      { quad: QUAD_PNG, half: HALF_PNG },
    );
    await waitForImages(page);

    await expectGraphFits(page, 'images-multi');
    checkGolden(
      'images-multi',
      await exportPng(page, { bg: '#fff' }),
      testInfo,
    );
  });

  test('golden: sdf icon mode — tint mapper, crisp at zoom (round 15.5)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    await makeReadyCy(page, {
      elements: [
        { data: { id: 'a', hue: 'red' }, position: { x: -32, y: 0 } },
        { data: { id: 'b', hue: 'teal' }, position: { x: 32, y: 0 } },
      ],
      style: { nodes: { width: 40, height: 40 } },
      zoom: 2.5,
      pan: { x: 200, y: 150 },
    });
    await page.evaluate(() => {
      const heart =
        'data:image/svg+xml;utf8,' +
        encodeURIComponent(
          `<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32'>` +
            `<path d='M16 29 C2 18 2 8 9 5 C13 3 16 6 16 9 C16 6 19 3 23 5 C30 8 30 18 16 29Z'/></svg>`,
        );

      window.cy.style({
        nodes: {
          width: 40,
          height: 40,
          shape: 'round-rectangle',
          'background-color': '#f5f6fa',
          'border-width': 1.5,
          'border-color': '#7f8c8d',
          'background-image': heart,
          'background-fit': 'contain',
          'background-image-type': 'sdf-icon', // constants-only (recorded)
          'background-image-color': {
            case: [{ when: { data: 'hue', eq: 'teal' }, then: '#00b894' }],
            else: '#d63031',
          },
        },
      });
    });
    await waitForImages(page);

    // svg rasterization + the EDT ride the browser raster stack, so the
    // golden carries the label-family tolerance
    await expectGraphFits(page, 'images-sdf-icons');
    checkGolden(
      'images-sdf-icons',
      await exportPng(page, { bg: '#fff' }),
      testInfo,
    );
  });

  test('sdf icons stay crisp where the rgba path softens (round 15.5)', async ({
    page,
  }) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    // a solid square: its vertical edge gives a clean scanline transition
    // to measure.  The sdf path (an svg square) re-thresholds at screen
    // resolution (~1px ramp); the rgba contrast uses a 32px *raster*
    // square — raster sources never promote (source resolution is the
    // ceiling), so at zoom 6 its edge smears across several px.
    // background-image-type is constants-only, so the same node restyles
    // between the two exports.
    await makeReadyCy(page, {
      elements: [{ data: { id: 'n' }, position: { x: 0, y: 0 } }],
      style: { nodes: { width: 30, height: 30 } },
      zoom: 6,
      pan: { x: 200, y: 150 },
    });

    const styleWith = async (type) => {
      await page.evaluate((type) => {
        const svgSquare =
          'data:image/svg+xml;utf8,' +
          encodeURIComponent(
            `<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32'>` +
              `<rect x='6' y='6' width='20' height='20'/></svg>`,
          );
        // the same square as a 32px raster png (transparent margins)
        const pngSquare =
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAP0lEQVR4Ae3BsQ2AQADEsHz23xkWgA4pBWcz83uHdxffOjyQmMQkJjGJSUxiEpOYxCQmMYlJTGISk5jEZGZiN04cASgO7jz2AAAAAElFTkSuQmCC';

        window.cy.style({
          nodes: {
            width: 30,
            height: 30,
            shape: 'rectangle',
            'background-color': '#ffffff',
            'background-image': type === 'sdf-icon' ? svgSquare : pngSquare,
            'background-fit': 'contain',
            'background-image-type': type,
            'background-image-color': '#000000',
          },
        });
      }, type);
      await waitForImages(page);
    };

    // transition width along the center scanline: the longest run of
    // intermediate (neither white nor black) pixels
    const transition = (png) => {
      const y = Math.round(png.height / 2);
      let run = 0;
      let best = 0;

      for (let x = 0; x < png.width; x++) {
        const v = png.data[(y * png.width + x) * 4]; // r channel

        if (v > 30 && v < 225) {
          run++;
          best = Math.max(best, run);
        } else {
          run = 0;
        }
      }

      return best;
    };

    await styleWith('sdf-icon');

    const sdfRamp = transition(
      decodePng(await exportPng(page, { bg: '#fff' })),
    );

    await styleWith('auto');

    const rgbaRamp = transition(
      decodePng(await exportPng(page, { bg: '#fff' })),
    );

    expect(sdfRamp, 'sdf edge transition (px)').toBeLessThanOrEqual(2);
    expect(rgbaRamp, 'rgba edge transition (px)').toBeGreaterThanOrEqual(3);
  });

  // shared scanline-ramp measure for the 15.6 promotion specs
  const rampOf = (png) => {
    const y = Math.round(png.height / 2);
    let run = 0;
    let best = 0;

    for (let x = 0; x < png.width; x++) {
      const v = png.data[(y * png.width + x) * 4];

      if (v > 30 && v < 225) {
        run++;
        best = Math.max(best, run);
      } else {
        run = 0;
      }
    }

    return best;
  };

  const SQUARE_SVG_STYLE = {
    width: 30,
    height: 30,
    shape: 'rectangle',
    'background-color': '#ffffff',
    'background-fit': 'contain',
    'background-image-color': '#000000',
  };

  test('svg images re-raster to a higher tier after zooming in (round 15.6)', async ({
    page,
  }) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    await makeReadyCy(page, {
      elements: [{ data: { id: 'n' }, position: { x: 0, y: 0 } }],
      style: { nodes: { width: 30, height: 30 } },
      zoom: 1,
      pan: { x: 200, y: 150 },
    });
    await page.evaluate((style) => {
      const square =
        'data:image/svg+xml;utf8,' +
        encodeURIComponent(
          `<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32'>` +
            `<rect x='6' y='6' width='20' height='20'/></svg>`,
        );

      window.cy.style({ nodes: { ...style, 'background-image': square } });
    }, SQUARE_SVG_STYLE);
    await waitForImages(page);

    // at zoom 1 the 32px intrinsic raster suffices
    const before = await page.evaluate(() => {
      const entry = window.cy._store.images.get(0);

      return { rasterPx: entry.rasterPx, vector: entry.vector };
    });

    expect(before.vector).toBe(true);
    expect(before.rasterPx).toBeLessThanOrEqual(128);

    // zoom in: demand 30 * 6 = 180 px -> the meter re-rasters at 512
    await page.evaluate(() => window.cy.zoom(6));
    await page.waitForFunction(
      () => window.cy._store.images.get(0).rasterPx >= 512,
    );
    await page.waitForFunction(
      () => window.cy._store.images.pendingCount() === 0,
    );
    await waitFrames(page, 6);

    const png = decodePng(await exportPng(page, { bg: '#fff' }));

    // the promoted raster keeps the edge tight where the 32px original
    // would have smeared ~6px
    expect(rampOf(png), 'edge ramp after promotion (px)').toBeLessThanOrEqual(
      3,
    );
  });

  test('png export re-rasters svg images at the export scale (round 15.6)', async ({
    page,
  }) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    await makeReadyCy(page, {
      elements: [{ data: { id: 'n' }, position: { x: 0, y: 0 } }],
      style: { nodes: { width: 30, height: 30 } },
      zoom: 1,
      pan: { x: 200, y: 150 },
    });
    await page.evaluate((style) => {
      const square =
        'data:image/svg+xml;utf8,' +
        encodeURIComponent(
          `<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32'>` +
            `<rect x='6' y='6' width='20' height='20'/></svg>`,
        );

      window.cy.style({ nodes: { ...style, 'background-image': square } });
    }, SQUARE_SVG_STYLE);
    await waitForImages(page);

    // the screen never demanded more than 30px — the export must
    // promote for its own scale before encoding (WYSIWYG at scale)
    const uri = await page.evaluate(
      async () => await window.cy.png({ bg: '#fff', scale: 6 }),
    );
    const promoted = await page.evaluate(
      () => window.cy._store.images.get(0).rasterPx,
    );

    expect(promoted).toBeGreaterThanOrEqual(512);

    const png = decodePng(uri);

    expect(rampOf(png), 'export edge ramp (px)').toBeLessThanOrEqual(3);
  });

  test('golden: multiline labels — wrap, ellipsis, justification (round 16.3)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    await makeReadyCy(page, {
      elements: [
        {
          data: { id: 'a', mode: 'wrap', just: 'left' },
          position: { x: -120, y: -70 },
        },
        {
          data: { id: 'b', mode: 'wrap', just: 'center' },
          position: { x: 0, y: -70 },
        },
        {
          data: { id: 'c', mode: 'wrap', just: 'right' },
          position: { x: 120, y: -70 },
        },
        {
          data: { id: 'd', mode: 'ellipsis', just: 'center' },
          position: { x: -120, y: 60 },
        },
        {
          data: { id: 'e', mode: 'none', just: 'center' },
          position: { x: 60, y: 60 },
        },
      ],
      style: {
        nodes: {
          width: 50,
          height: 30,
          shape: 'rectangle',
          'background-color': '#dfe6e9',
          'border-width': 1,
          'border-color': '#636e72',
          label: 'wrapping label text here',
          'font-size': 12,
          color: '#2d3436',
          'text-background-color': '#ffeaa7',
          'text-background-opacity': 1,
          'text-background-padding': 2,
          'text-wrap': { data: 'mode' },
          'text-max-width': 70,
          'line-height': 1.2,
          'text-justification': { data: 'just' },
        },
        edges: {},
      },
      zoom: 1,
      pan: { x: 200, y: 150 },
    });
    await waitFrames(page);

    await expectGraphFits(page, 'labels-wrap');
    checkGolden('labels-wrap', await exportPng(page, { bg: '#fff' }), testInfo);
  });

  test('golden: wrapped edge labels rotate as a block (round 16.3)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    await makeReadyCy(page, {
      elements: [
        { data: { id: 'a' }, position: { x: -130, y: -80 } },
        { data: { id: 'b' }, position: { x: 130, y: 60 } },
        { data: { id: 'ab', source: 'a', target: 'b' } },
      ],
      style: {
        nodes: { width: 24, height: 24, 'background-color': '#b2bec3' },
        edges: {
          width: 2,
          'line-color': '#636e72',
          label: 'two line\nedge label',
          'font-size': 12,
          color: '#2d3436',
          'text-background-color': '#dfe6e9',
          'text-background-opacity': 1,
          'text-background-padding': 2,
          'text-wrap': 'wrap',
          'text-rotation': 'autorotate',
        },
      },
      zoom: 1,
      pan: { x: 200, y: 150 },
    });
    await waitFrames(page);

    await expectGraphFits(page, 'labels-wrap-edge');
    checkGolden(
      'labels-wrap-edge',
      await exportPng(page, { bg: '#fff' }),
      testInfo,
    );
  });

  test('golden: node charts — pies, hole, start angle, stripes (round 23)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    await makeReadyCy(page, {
      elements: [
        // full pie on the default palette
        {
          data: { id: 'full', kind: 'pieFull' },
          position: { x: -120, y: -70 },
        },
        // partial pie: the remainder stays unpainted (v3 percents)
        {
          data: { id: 'partial', kind: 'piePart' },
          position: { x: 0, y: -70 },
        },
        // donut with a start angle, on an ellipse with a border
        { data: { id: 'donut', kind: 'donut' }, position: { x: 120, y: -70 } },
        // vertical stripes (v3's default direction)
        { data: { id: 'sv', kind: 'stripesV' }, position: { x: -120, y: 70 } },
        // horizontal stripes on a round-rectangle (shape clip)
        { data: { id: 'sh', kind: 'stripesH' }, position: { x: 30, y: 70 } },
        // chart-size < 1 leaves a ring of plain body
        { data: { id: 'small', kind: 'small' }, position: { x: 140, y: 70 } },
      ],
      style: {
        nodes: {
          width: 80,
          height: {
            case: [{ when: { data: 'kind', eq: 'donut' }, then: 60 }],
            else: 80,
          },
          'background-color': '#dfe6e9',
          shape: {
            case: [
              { when: { data: 'kind', eq: 'donut' }, then: 'ellipse' },
              {
                when: { data: 'kind', eq: 'stripesH' },
                then: 'round-rectangle',
              },
              { when: { data: 'kind', eq: 'stripesV' }, then: 'rectangle' },
            ],
            else: 'ellipse',
          },
          'border-width': {
            case: [{ when: { data: 'kind', eq: 'donut' }, then: 4 }],
            else: 0,
          },
          'border-color': '#2d3436',
          chart: {
            case: [
              {
                when: { data: 'kind', in: ['stripesV', 'stripesH'] },
                then: 'stripes',
              },
            ],
            else: 'pie',
          },
          'chart-values': { data: 'parts' },
          'chart-hole': {
            case: [{ when: { data: 'kind', eq: 'donut' }, then: 0.5 }],
            else: 0,
          },
          'chart-start-angle': {
            case: [{ when: { data: 'kind', eq: 'donut' }, then: 0.7853981634 }],
            else: 0,
          }, // 45deg
          'chart-size': {
            case: [{ when: { data: 'kind', eq: 'small' }, then: 0.6 }],
            else: 1,
          },
          'chart-direction': {
            case: [
              { when: { data: 'kind', eq: 'stripesH' }, then: 'horizontal' },
            ],
            else: 'vertical',
          },
        },
      },
      zoom: 1,
      pan: { x: 200, y: 150 },
    });

    await page.evaluate(() => {
      window.cy.$id('full').data('parts', [0.4, 0.3, 0.2, 0.1]);
      window.cy.$id('partial').data('parts', [0.25, 0.25]);
      window.cy.$id('donut').data('parts', [0.5, 0.3, 0.2]);
      window.cy.$id('sv').data('parts', [0.3, 0.3, 0.4]);
      window.cy.$id('sh').data('parts', [0.2, 0.2, 0.2, 0.4]);
      window.cy.$id('small').data('parts', [0.6, 0.4]);
    });
    await waitFrames(page);

    await expectGraphFits(page, 'charts-pie-stripes');
    checkGolden(
      'charts-pie-stripes',
      await exportPng(page, { bg: '#fff' }),
      testInfo,
    );
  });

  test('imageMinPx skips image sampling on unreadably small nodes (round 15.7)', async ({
    page,
  }) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    await makeReadyCy(page, {
      elements: [{ data: { id: 'n' }, position: { x: 0, y: 0 } }],
      style: { nodes: { width: 20, height: 20 } },
      renderer: { imageMinPx: 30 },
      zoom: 1,
      pan: { x: 200, y: 150 },
    });
    await page.evaluate((uri) => {
      window.cy.style({
        nodes: {
          width: 20,
          height: 20,
          shape: 'rectangle',
          'background-color': '#ffffff',
          'border-width': 1,
          'border-color': '#ccc',
          'background-image': uri,
          'background-fit': 'cover',
        },
      });
    }, QUAD_PNG);
    await waitForImages(page);

    const inkOf = (png) => {
      let n = 0;

      for (let i = 0; i < png.data.length; i += 4) {
        const [r, g, b] = [png.data[i], png.data[i + 1], png.data[i + 2]];

        // the quadrant image's saturated colors, not the white/gray body
        if (Math.max(r, g, b) - Math.min(r, g, b) > 60) {
          n++;
        }
      }

      return n;
    };

    // at zoom 1 the node shows 20px < imageMinPx: no image sampled
    const small = inkOf(decodePng(await exportPng(page, { bg: '#fff' })));

    expect(small, 'image ink below the floor').toBe(0);

    // at zoom 2 it shows 40px >= imageMinPx: the image appears
    await page.evaluate(() => window.cy.zoom(2));
    await waitFrames(page, 3);

    const big = inkOf(decodePng(await exportPng(page, { bg: '#fff' })));

    expect(big, 'image ink above the floor').toBeGreaterThan(200);
  });

  // Round 66.3: a constant channel opacity no longer demotes its colour
  // channel off the eval kernel — the multiplier rides the packed
  // program and the shader folds it (`domain.w`) exactly as the CPU
  // write path does.  This is the claim that the two produce the *same
  // bytes*, and it is a self-comparison rather than a golden on purpose:
  // the control is in the test.
  //
  // The CPU side is forced by mapping the opacity to a constant range —
  // a *mapped* channel opacity still demotes, so both scenes resolve to
  // the same value by different paths.  Degrade the fold (drop
  // `alphaMul` in `packPrograms`) and the two diverge.
  test('the kernel folds a constant channel opacity as the CPU does', async ({
    page,
  }) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    const scene = (mode) => {
      const ramp = {
        data: 'x',
        scale: 'linear',
        domain: [0, 1],
        range: ['#cc0033', '#009966'],
      };
      // mapped-with-a-constant-range: same value everywhere, CPU path
      const flat = (v) => ({
        data: 'x',
        scale: 'linear',
        domain: [0, 1],
        range: [v, v],
      });
      const opacity = (v) => (mode === 'kernel' ? v : flat(v));
      const nodes = [];
      const edges = [];

      for (let i = 0; i < 36; i++) {
        nodes.push({
          data: { id: `n${i}`, x: i / 35 },
          position: {
            x: -180 + (i % 6) * 72,
            y: -110 + Math.floor(i / 6) * 45,
          },
        });
      }
      for (let i = 0; i < 30; i++) {
        edges.push({
          data: {
            id: `e${i}`,
            source: `n${i}`,
            target: `n${i + 6}`,
            x: i / 29,
          },
        });
      }

      return {
        elements: [...nodes, ...edges],
        style: {
          nodes: {
            width: 34,
            height: 34,
            'background-color': ramp,
            'background-opacity': opacity(0.5),
            'border-width': 6,
            'border-color': ramp,
            'border-opacity': opacity(0.25),
          },
          edges: {
            width: 7,
            'line-color': ramp,
            'line-opacity': opacity(0.75),
          },
        },
        zoom: 1,
        pan: { x: 200, y: 150 },
      };
    };

    const shots = {};

    for (const mode of ['kernel', 'cpu']) {
      await makeReadyCy(page, scene(mode));
      await waitFrames(page);

      const owned = await page.evaluate(() => {
        const o = window.cy._styleEngine.gpuOwnedProps;

        return {
          nodes: [...(o.nodes || [])],
          edges: [...(o.edges || [])],
          fill: window.cy.$id('n20').style('background-color'),
          line: window.cy.$id('e10').style('line-color'),
        };
      });

      // the precondition: the two scenes really do take different paths
      if (mode === 'kernel') {
        expect(owned.nodes, 'kernel owns the node colours').toContain(
          'background-color',
        );
        expect(owned.edges, 'kernel owns line-color').toContain('line-color');
      } else {
        expect(owned.nodes, 'mapped opacity demotes').toEqual([]);
        expect(owned.edges, 'mapped opacity demotes').toEqual([]);
      }

      shots[mode] = {
        png: decodePng(await exportPng(page, { bg: '#fff' })),
        owned,
      };
    }

    // style() must agree too: it re-evaluates for a kernel-owned prop,
    // and has to fold the same constant it stores and draws
    expect(shots.kernel.owned.fill).toBe(shots.cpu.owned.fill);
    expect(shots.kernel.owned.line).toBe(shots.cpu.owned.line);

    const a = shots.kernel.png;
    const b = shots.cpu.png;

    expect(a.width, 'same canvas').toBe(b.width);
    expect(a.height, 'same canvas').toBe(b.height);

    let differing = 0;

    for (let i = 0; i < a.data.length; i += 4) {
      if (
        a.data[i] !== b.data[i] ||
        a.data[i + 1] !== b.data[i + 1] ||
        a.data[i + 2] !== b.data[i + 2] ||
        a.data[i + 3] !== b.data[i + 3]
      ) {
        differing++;
      }
    }

    expect(differing, 'kernel-folded and CPU-folded pixels').toBe(0);
  });
});

test.describe('v3-vs-v4 render parity', () => {
  /*
  The same fixture rendered by the classic canvas renderer and the GPU
  prototype in the same run, exports diffed with a tolerance.  Interiors
  of solid shapes must agree exactly; the renderers' anti-aliasing
  differs by design (analytic SDF vs canvas-2D), so the assertions bound
  the mismatch ratio instead of demanding pixel identity.  Labels are
  excluded outright: glyph rasterization and placement policy both differ
  by design.
  */

  // shared element defs (both sides accept the v3 definition form); the
  // ghost node exercises opacity compositing over the bg
  const PARITY_ELEMENTS = [
    { data: { id: 'a', kind: 'plain' }, position: { x: -120, y: -60 } },
    { data: { id: 'b', kind: 'boxy' }, position: { x: 120, y: -60 } },
    { data: { id: 'c', kind: 'plain' }, position: { x: -120, y: 60 } },
    { data: { id: 'd', kind: 'ghost' }, position: { x: 120, y: 60 } },
    { data: { id: 'ab', source: 'a', target: 'b' } },
    { data: { id: 'cd', source: 'c', target: 'd' } },
    { data: { id: 'ad', source: 'a', target: 'd' } },
  ];

  // one look, two dialects: v3 selectors vs v4 case mappers
  const V3_STYLE = [
    {
      selector: 'node',
      style: {
        width: 50,
        height: 40,
        shape: 'ellipse',
        'background-color': '#c0392b',
        'border-width': 3,
        'border-color': '#2c3e50',
      },
    },
    {
      selector: 'node[kind = "boxy"]',
      style: { shape: 'rectangle', 'background-color': '#2980b9' },
    },
    { selector: 'node[kind = "ghost"]', style: { opacity: 0.4 } },
    {
      selector: 'edge',
      style: { width: 3, 'line-color': '#7f8c8d', 'curve-style': 'straight' },
    },
  ];

  const V4_STYLE = {
    nodes: {
      width: 50,
      height: 40,
      shape: {
        case: [{ when: { data: 'kind', eq: 'boxy' }, then: 'rectangle' }],
        else: 'ellipse',
      },
      'background-color': {
        case: [{ when: { data: 'kind', eq: 'boxy' }, then: '#2980b9' }],
        else: '#c0392b',
      },
      'border-width': 3,
      'border-color': '#2c3e50',
      opacity: {
        case: [{ when: { data: 'kind', eq: 'ghost' }, then: 0.4 }],
        else: 1,
      },
    },
    edges: { width: 3, 'line-color': '#7f8c8d' },
  };

  const MAX_PARITY_RATIO = 0.02;

  /*
   * Round 56: the close-up tier's bounds, one per scene and each set
   * from that scene's own measured control rather than from a suite
   * default.  They are 4-20x tighter than the zoom-1 tier's 2-3%, which
   * is the whole point: at zoom the anti-aliased fringe stays a pixel
   * wide while the ink grows, so the ambient mismatch falls and a real
   * geometry difference has nowhere to hide.
   *
   * Controls (2026-08-07, the same scene with the feature under test
   * removed): gap 0.573% (no heads), hollow 0.000% (filled), curves
   * 0.002% (no heads), edges and heads are their own floors.
   *
   * Measured before and after round 56's trim:
   *
   *     scene     before    after    bound
   *     gap        5.610%   0.020%    0.3%
   *     heads      0.149%   0.000%    0.2%
   *     hollow     2.555%   0.898%    1.2%
   *     edges      0.093%   0.004%    0.2%
   *     curves     0.972%   0.005%    0.2%
   *
   * `hollow` keeps the loosest bound of the five and is the only one
   * whose residual is not anti-aliasing: its `filled` control reads
   * **0.000%**, so what is left is entirely the hollow *stroke*.  v4
   * strokes by offsetting a distance field, which rounds a join by
   * construction, where canvas2d miters it — so v3's back corners come
   * to a point and v4's are radiused.  A recorded deviation, of the same
   * family as the butt-cap note the edge layers already carry.
   */
  const CLOSE_UP_BOUND = {
    gap: 0.003,
    heads: 0.002,
    hollow: 0.012,
    edges: 0.002,
    curves: 0.002,
    layers: 0.002,
    midarrow: 0.002,
  };

  let deviceErrors = [];

  /*
  Round 42 moved v3 into its own subproject, so its UMD bundle is no longer
  a by-product of building v4 — `parity.html` loads `../v3/build/
  cytoscape.umd.js`, which only `cd v3 && npm run build:umd` produces.  A
  missing baseline is checked here and **fails**, deliberately, rather than
  skipping: the whole point of these specs is that a golden answers "did
  this change?" while only parity answers "is this right?", and a parity
  suite that quietly stops running is worth less than one that is absent.
  */
  test.beforeAll(() => {
    // cwd-anchored like GOLDENS_DIR in lib/image-diff.mjs — Playwright's
    // transpiler rejects import.meta in spec files
    const bundle = path.resolve(
      process.cwd(),
      'v3',
      'build',
      'cytoscape.umd.js',
    );

    if (!existsSync(bundle)) {
      throw new Error(
        "v3's UMD bundle is missing, so the v3-vs-v4 parity diffs cannot run.\n" +
          'Build the comparison baseline first:  cd v3 && npm install && npm run build:umd',
      );
    }
  });

  test.beforeEach(async ({ page }) => {
    deviceErrors = [];

    page.on('console', (msg) => {
      const text = msg.text();

      if (/WGSL|is invalid|Validation error/i.test(text)) {
        deviceErrors.push(text);
      }
    });

    await page.setViewportSize({ width: 820, height: 320 });
    await page.goto(PARITY_PAGE);
  });

  test.afterEach(() => {
    expect(deviceErrors, 'WebGPU reported validation errors').toEqual([]);
  });

  /** Render both sides at the given viewport and export both as pngs. */
  const exportBoth = async (page, viewport) => {
    return await page.evaluate(
      async ({ elements, v3Style, v4Style, viewport }) => {
        // per-side deep copies: v3 adopts position objects by reference and
        // its default layout is 'grid', so it must get an explicit preset
        // layout (fit: false keeps the option viewport) and its own defs
        const cloneEles = () => JSON.parse(JSON.stringify(elements));
        const cy3 = window.makeV3({
          elements: cloneEles(),
          style: v3Style,
          layout: { name: 'preset', fit: false },
          ...viewport,
        });
        const cy4 = window.makeV4({
          elements: cloneEles(),
          style: v4Style,
          ...viewport,
        });

        await cy4.ready;
        await new Promise((resolve) => requestAnimationFrame(resolve));
        await new Promise((resolve) => requestAnimationFrame(resolve));

        return {
          v3uri: cy3.png({ bg: '#fff' }), // v3 export is synchronous
          v4uri: await cy4.png({ bg: '#fff' }),
        };
      },
      {
        elements: PARITY_ELEMENTS,
        v3Style: V3_STYLE,
        v4Style: V4_STYLE,
        viewport,
      },
    );
  };

  /** Non-white pixels — the ink floor's measure of "something rendered". */
  const inked = (png) => {
    let n = 0;

    for (let i = 0; i < png.data.length; i += 4) {
      if (png.data[i] < 250 || png.data[i + 1] < 250 || png.data[i + 2] < 250) {
        n++;
      }
    }

    return n;
  };

  /**
   * The one place a v3-vs-v4 diff is asserted (round 55).
   *
   * Before this there were three: `expectParity` (8 scenes), `runParity`
   * (15) and four scenes that inline-copied the diff body.  Only
   * `runParity`'s copy had an **ink floor**, so twelve of the 29 parity
   * scenes would have passed on two blank canvases — the failure mode
   * AGENTS.md names for a benchmark row, in a pixel test.  Both bounds
   * are parameters rather than constants because the two families
   * genuinely differ: solid-shape scenes hold 0.02, curve scenes 0.03
   * (v4 clamps miter joins where v3 rounds them).
   *
   * The ink counts are logged on every run, not only on failure, so a
   * scene drifting toward its floor is visible before it crosses it.
   */
  const expectParityImages = (v3uri, v4uri, name, testInfo, opts = {}) => {
    const actual = decodePng(v4uri);
    const expected = decodePng(v3uri);
    const bound = opts.bound ?? MAX_PARITY_RATIO;
    const minInk = opts.minInk ?? 2000;
    // pixelmatch's per-pixel threshold, not the ratio bound: the
    // rotated-label scene raises it to 0.3 because glyph rasterization
    // differs by design (canvas vs SDF)
    const threshold = opts.threshold ?? 0.2;

    const inkV4 = inked(actual);
    const inkV3 = inked(expected);
    const { mismatched, ratio, diff } = diffPngs(actual, expected, {
      threshold,
    });

    console.log(
      `[parity] ${name}: ${mismatched} px differ (${(ratio * 100).toFixed(3)}%)` +
        `  ink v4 ${inkV4} / v3 ${inkV3}  bound ${(bound * 100).toFixed(1)}%`,
    );

    expect(inkV4, `v4 rendered ink for ${name}`).toBeGreaterThan(minInk);
    expect(inkV3, `v3 rendered ink for ${name}`).toBeGreaterThan(minInk);

    if (ratio > bound) {
      writeDiffArtifacts(testInfo.outputPath(''), name, actual, expected, diff);
    }

    expect(ratio, `v3-vs-v4 mismatch ratio for ${name}`).toBeLessThanOrEqual(
      bound,
    );
  };

  const expectParity = (v3uri, v4uri, name, testInfo, opts = {}) =>
    expectParityImages(v3uri, v4uri, name, testInfo, opts);

  test('parity: nodes, borders, opacity and straight edges', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    const { v3uri, v4uri } = await exportBoth(page, {
      zoom: 1,
      pan: { x: 200, y: 150 },
    });

    expectParity(v3uri, v4uri, 'parity-basic', testInfo);
  });

  test('parity: the viewport transform (zoom + pan) agrees', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    const { v3uri, v4uri } = await exportBoth(page, {
      zoom: 1.7,
      pan: { x: 57, y: 23 },
    });

    expectParity(v3uri, v4uri, 'parity-transform', testInfo);
  });

  test('parity: background images — fit, position, opacity (round 15.3)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    // the same 16px quadrant data uri both sides: fit contain on
    // rectangles pins the scale-to-box math, the 25%/75% position pins
    // v3's percent-of-free-space placement, and the 0.5 image opacity
    // pins the alpha fold.  Solid borders, so the border-inner-edge clip
    // (v4) and the shape-path clip (v3) are pixel-equivalent.
    const QUAD =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAASUlEQVR4AaXBQQ2DQAAAwWVTPSVBBg5QUDkVwQs5/BGBA3Bwn52ZrmV+GDh+JyMSSSSRRBJJJNFn3XZG/veXEYkkkkgiiSSS6AV8gQcyZv0HPAAAAABJRU5ErkJggg==';
    const elements = [
      { data: { id: 'a' }, position: { x: -120, y: -60 } },
      { data: { id: 'b' }, position: { x: 120, y: -60 } },
      { data: { id: 'c' }, position: { x: 0, y: 60 } },
    ];
    const shared = {
      width: 64,
      height: 48,
      shape: 'rectangle',
      'background-color': '#ecf0f1',
      'border-width': 4,
      'border-color': '#2c3e50',
      'background-image': QUAD,
      'background-fit': 'contain',
      'background-position-x': '25%',
      'background-position-y': '75%',
      'background-image-opacity': 0.5,
    };

    const { v3uri, v4uri } = await page.evaluate(
      async ({ elements, shared }) => {
        const cloneEles = () => JSON.parse(JSON.stringify(elements));
        const viewport = { zoom: 1, pan: { x: 200, y: 150 } };
        const cy3 = window.makeV3({
          elements: cloneEles(),
          style: [{ selector: 'node', style: shared }],
          layout: { name: 'preset', fit: false },
          ...viewport,
        });
        const cy4 = window.makeV4({
          elements: cloneEles(),
          style: { nodes: shared },
          ...viewport,
        });

        await cy4.ready;

        // both sides load the image asynchronously; v4 exposes the pending
        // count, v3 settles within the same generous window
        await new Promise((resolve) => {
          const poll = () => {
            if (cy4._store.images.pendingCount() === 0) {
              resolve();
            } else {
              setTimeout(poll, 20);
            }
          };

          poll();
        });
        await new Promise((resolve) => setTimeout(resolve, 250));
        await new Promise((resolve) => requestAnimationFrame(resolve));
        await new Promise((resolve) => requestAnimationFrame(resolve));

        return {
          v3uri: cy3.png({ bg: '#fff' }),
          v4uri: await cy4.png({ bg: '#fff' }),
        };
      },
      { elements, shared },
    );

    expectParity(v3uri, v4uri, 'parity-images', testInfo);
  });

  test('parity: multi-image layer order (round 15.4)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    // two overlapping images per node: if either side drew index 0 on
    // top (the CSS convention) instead of v3's later-on-top canvas
    // order, the overlap region diffs solidly
    const QUAD =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAASUlEQVR4AaXBQQ2DQAAAwWVTPSVBBg5QUDkVwQs5/BGBA3Bwn52ZrmV+GDh+JyMSSSSRRBJJJNFn3XZG/veXEYkkkkgiiSSS6AV8gQcyZv0HPAAAAABJRU5ErkJggg==';
    const HALF =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAKklEQVR4AYXBAREAIAzEsPI3mUjABGqRwRysyTr7fQZBBBFEAZdBEEEE0QaYA0GAoqM/AAAAAElFTkSuQmCC';
    const elements = [
      { data: { id: 'a' }, position: { x: -100, y: 0 } },
      { data: { id: 'b' }, position: { x: 100, y: 0 } },
    ];
    const shared = {
      width: 100,
      height: 80,
      shape: 'rectangle',
      'background-color': '#ecf0f1',
      'border-width': 3,
      'border-color': '#2c3e50',
      'background-image': [QUAD, HALF],
      'background-fit': 'none',
      'background-width': ['60%', '55%'],
      'background-height': ['60%', '55%'],
      'background-position-x': ['15%', '70%'],
      'background-position-y': ['15%', '70%'],
    };

    const { v3uri, v4uri } = await page.evaluate(
      async ({ elements, shared }) => {
        const cloneEles = () => JSON.parse(JSON.stringify(elements));
        const viewport = { zoom: 1, pan: { x: 200, y: 150 } };
        const cy3 = window.makeV3({
          elements: cloneEles(),
          style: [{ selector: 'node', style: shared }],
          layout: { name: 'preset', fit: false },
          ...viewport,
        });
        const cy4 = window.makeV4({
          elements: cloneEles(),
          style: { nodes: shared },
          ...viewport,
        });

        await cy4.ready;
        await new Promise((resolve) => {
          const poll = () => {
            if (cy4._store.images.pendingCount() === 0) {
              resolve();
            } else {
              setTimeout(poll, 20);
            }
          };

          poll();
        });
        await new Promise((resolve) => setTimeout(resolve, 250));
        await new Promise((resolve) => requestAnimationFrame(resolve));
        await new Promise((resolve) => requestAnimationFrame(resolve));

        return {
          v3uri: cy3.png({ bg: '#fff' }),
          v4uri: await cy4.png({ bg: '#fff' }),
        };
      },
      { elements, shared },
    );

    expectParity(v3uri, v4uri, 'parity-images-multi', testInfo);
  });

  test("parity: arrow sizing follows v3's nonlinear formula (round 27.3)", async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    // The claim 27.3 makes is "v3's getArrowWidth", so the check is v3
    // itself.  Three widths spanning the formula's floor: at width 1 and
    // 2 the 29-unit floor dominates, and by width 6 the pow() term has
    // taken over — the arrows must be the same size on both renderers in
    // every regime, which the old linear rule could not manage anywhere.
    const elements = [
      { data: { id: 'a' }, position: { x: -150, y: -90 } },
      { data: { id: 'b' }, position: { x: 150, y: -90 } },
      { data: { id: 'c' }, position: { x: -150, y: 0 } },
      { data: { id: 'd' }, position: { x: 150, y: 0 } },
      { data: { id: 'e' }, position: { x: -150, y: 90 } },
      { data: { id: 'f' }, position: { x: 150, y: 90 } },
      { data: { id: 'thin', source: 'a', target: 'b', w: 1 } },
      { data: { id: 'mid', source: 'c', target: 'd', w: 2 } },
      { data: { id: 'fat', source: 'e', target: 'f', w: 6 } },
    ];
    const edgeStyle = {
      'line-color': '#7f8c8d',
      'curve-style': 'straight',
      'target-arrow-shape': 'triangle',
      'target-arrow-color': '#2c3e50',
      'source-arrow-shape': 'square',
      'source-arrow-color': '#c0392b',
    };
    const v3Style = [
      {
        selector: 'node',
        style: {
          width: 30,
          height: 30,
          shape: 'ellipse',
          'background-color': '#bdc3c7',
          'border-width': 0,
        },
      },
      { selector: 'edge', style: { ...edgeStyle, width: 'data(w)' } },
    ];
    const v4Style = {
      nodes: {
        width: 30,
        height: 30,
        'background-color': '#bdc3c7',
        'border-width': 0,
      },
      edges: { ...edgeStyle, width: { data: 'w' } },
    };

    delete v4Style.edges['curve-style'];

    const { v3uri, v4uri } = await page.evaluate(
      async ({ elements, v3Style, v4Style }) => {
        const cloneEles = () => JSON.parse(JSON.stringify(elements));
        const viewport = { zoom: 1, pan: { x: 200, y: 150 } };
        const cy3 = window.makeV3({
          elements: cloneEles(),
          style: v3Style,
          layout: { name: 'preset', fit: false },
          ...viewport,
        });
        const cy4 = window.makeV4({
          elements: cloneEles(),
          style: v4Style,
          ...viewport,
        });

        await cy4.ready;
        await new Promise((resolve) => requestAnimationFrame(resolve));
        await new Promise((resolve) => requestAnimationFrame(resolve));

        return {
          v3uri: cy3.png({ bg: '#fff' }),
          v4uri: await cy4.png({ bg: '#fff' }),
        };
      },
      { elements, v3Style, v4Style },
    );

    expectParity(v3uri, v4uri, 'parity-arrow-size', testInfo);
  });

  test('parity: the round-corner shape family (round 27.4)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    // The round-* family was deferred in round 13 because corner-rounding
    // an anisotropically scaled polygon has no clean closed form.  27.4
    // builds the field as sdPolygon(inward-offset) - r, which *is* exact
    // under anisotropy — so the scene deliberately includes a stretched
    // node, and v3 is the judge.
    const shapes = [
      'round-triangle',
      'round-diamond',
      'round-pentagon',
      'round-hexagon',
      'round-heptagon',
      'round-octagon',
      'round-tag',
    ];
    const elements = shapes.map((shape, i) => ({
      data: { id: shape, shape },
      position: { x: (i % 4) * 90 - 135, y: Math.floor(i / 4) * 90 - 45 },
    }));

    elements.push({
      data: { id: 'wide', shape: 'round-hexagon' },
      position: { x: 90, y: 45 },
    });

    // a deliberately large radius: at v3's 'auto' (6px here) the rounded
    // and sharp outlines differ by only ~180px, so a generous radius is
    // what makes a 0-pixel result mean something
    const nodeStyle = {
      'background-color': '#3498db',
      'border-width': 3,
      'border-color': '#2c3e50',
      'corner-radius': 14,
    };
    const v3Style = [
      { selector: 'node', style: { width: 60, height: 60, ...nodeStyle } },
      { selector: 'node[id = "wide"]', style: { width: 120, height: 44 } },
      ...shapes.map((shape) => ({
        selector: `node[shape = "${shape}"]`,
        style: { shape },
      })),
    ];
    const v4Style = {
      nodes: {
        width: {
          case: [{ when: { data: 'id', eq: 'wide' }, then: 120 }],
          else: 60,
        },
        height: {
          case: [{ when: { data: 'id', eq: 'wide' }, then: 44 }],
          else: 60,
        },
        shape: {
          case: shapes.map((shape) => ({
            when: { data: 'shape', eq: shape },
            then: shape,
          })),
          else: 'ellipse',
        },
        ...nodeStyle,
      },
    };

    const { v3uri, v4uri } = await page.evaluate(
      async ({ elements, v3Style, v4Style }) => {
        const cloneEles = () => JSON.parse(JSON.stringify(elements));
        const viewport = { zoom: 1, pan: { x: 200, y: 150 } };
        const cy3 = window.makeV3({
          elements: cloneEles(),
          style: v3Style,
          layout: { name: 'preset', fit: false },
          ...viewport,
        });
        const cy4 = window.makeV4({
          elements: cloneEles(),
          style: v4Style,
          ...viewport,
        });

        await cy4.ready;
        await new Promise((resolve) => requestAnimationFrame(resolve));
        await new Promise((resolve) => requestAnimationFrame(resolve));

        return {
          v3uri: cy3.png({ bg: '#fff' }),
          v4uri: await cy4.png({ bg: '#fff' }),
        };
      },
      { elements, v3Style, v4Style },
    );

    expectParity(v3uri, v4uri, 'parity-round-shapes', testInfo);
  });

  test('parity: barrel (round 27.5)', async ({ page }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    // v4 samples barrel's four bezier corners into segments rather than
    // solving the curve exactly.  Whether that is good enough is not a
    // judgement call — v3 renders the real quadraticCurveTo, so this diff
    // is the answer.  Three sizes, because the corner offsets are
    // size-relative until they hit v3's absolute caps (height 15, width
    // 100), and the tall node is what exercises the capped regime.
    const elements = [
      { data: { id: 'small', shape: 'barrel' }, position: { x: -120, y: -50 } },
      { data: { id: 'wide', shape: 'barrel' }, position: { x: 60, y: -50 } },
      { data: { id: 'tall', shape: 'barrel' }, position: { x: -120, y: 70 } },
      { data: { id: 'huge', shape: 'barrel' }, position: { x: 90, y: 70 } },
    ];
    const nodeStyle = {
      'background-color': '#8e44ad',
      'border-width': 3,
      'border-color': '#3c1361',
    };
    const size = {
      small: [60, 50],
      wide: [150, 44],
      tall: [70, 120],
      huge: [160, 110],
    };
    const v3Style = [
      { selector: 'node', style: { shape: 'barrel', ...nodeStyle } },
      ...Object.entries(size).map(([id, [w, h]]) => ({
        selector: `node[id = "${id}"]`,
        style: { width: w, height: h },
      })),
    ];
    const v4Style = {
      nodes: {
        shape: 'barrel',
        width: {
          case: Object.entries(size).map(([id, [w]]) => ({
            when: { data: 'id', eq: id },
            then: w,
          })),
          else: 60,
        },
        height: {
          case: Object.entries(size).map(([id, [, h]]) => ({
            when: { data: 'id', eq: id },
            then: h,
          })),
          else: 50,
        },
        ...nodeStyle,
      },
    };

    const { v3uri, v4uri } = await page.evaluate(
      async ({ elements, v3Style, v4Style }) => {
        const cloneEles = () => JSON.parse(JSON.stringify(elements));
        const viewport = { zoom: 1, pan: { x: 200, y: 150 } };
        const cy3 = window.makeV3({
          elements: cloneEles(),
          style: v3Style,
          layout: { name: 'preset', fit: false },
          ...viewport,
        });
        const cy4 = window.makeV4({
          elements: cloneEles(),
          style: v4Style,
          ...viewport,
        });

        await cy4.ready;
        await new Promise((resolve) => requestAnimationFrame(resolve));
        await new Promise((resolve) => requestAnimationFrame(resolve));

        return {
          v3uri: cy3.png({ bg: '#fff' }),
          v4uri: await cy4.png({ bg: '#fff' }),
        };
      },
      { elements, v3Style, v4Style },
    );

    expectParity(v3uri, v4uri, 'parity-barrel', testInfo);
  });

  test('parity: compound arrowheads (round 27.6)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    // The four heads are built three different ways — a union of two
    // polygons (triangle-tee), a polygon plus an analytic disc
    // (circle-triangle), a polygon plus an edge-width-driven bar
    // (triangle-cross), and a sampled curve baked into a point table
    // (triangle-backcurve).  v3 judges all four at once.
    const heads = [
      'triangle-tee',
      'circle-triangle',
      'triangle-cross',
      'triangle-backcurve',
    ];
    const elements = [];

    heads.forEach((head, i) => {
      const y = i * 60 - 90;

      elements.push({ data: { id: `a${i}` }, position: { x: -140, y } });
      elements.push({ data: { id: `b${i}` }, position: { x: 140, y } });
      // widths differ per row so triangle-cross's bar is exercised
      elements.push({
        data: { id: `e${i}`, head, w: 2 + i * 2 },
        source: undefined,
        target: undefined,
      });
      elements[elements.length - 1].data.source = `a${i}`;
      elements[elements.length - 1].data.target = `b${i}`;
    });

    const edgeCommon = {
      'line-color': '#7f8c8d',
      'target-arrow-color': '#2c3e50',
      'curve-style': 'straight',
    };
    const v3Style = [
      {
        selector: 'node',
        style: {
          width: 26,
          height: 26,
          'background-color': '#bdc3c7',
          'border-width': 0,
        },
      },
      { selector: 'edge', style: { ...edgeCommon, width: 'data(w)' } },
      ...heads.map((head) => ({
        selector: `edge[head = "${head}"]`,
        style: { 'target-arrow-shape': head },
      })),
    ];
    const v4Style = {
      nodes: {
        width: 26,
        height: 26,
        'background-color': '#bdc3c7',
        'border-width': 0,
      },
      edges: {
        'line-color': '#7f8c8d',
        'target-arrow-color': '#2c3e50',
        width: { data: 'w' },
        'target-arrow-shape': {
          case: heads.map((head) => ({
            when: { data: 'head', eq: head },
            then: head,
          })),
          else: 'none',
        },
      },
    };

    const { v3uri, v4uri } = await page.evaluate(
      async ({ elements, v3Style, v4Style }) => {
        const cloneEles = () => JSON.parse(JSON.stringify(elements));
        const viewport = { zoom: 1, pan: { x: 200, y: 150 } };
        const cy3 = window.makeV3({
          elements: cloneEles(),
          style: v3Style,
          layout: { name: 'preset', fit: false },
          ...viewport,
        });
        const cy4 = window.makeV4({
          elements: cloneEles(),
          style: v4Style,
          ...viewport,
        });

        await cy4.ready;
        await new Promise((resolve) => requestAnimationFrame(resolve));
        await new Promise((resolve) => requestAnimationFrame(resolve));

        return {
          v3uri: cy3.png({ bg: '#fff' }),
          v4uri: await cy4.png({ bg: '#fff' }),
        };
      },
      { elements, v3Style, v4Style },
    );

    expectParity(v3uri, v4uri, 'parity-compound-arrows', testInfo);
  });

  test('parity: numeric text-rotation (round 27.7)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    // Glyph rasterization differs between the renderers by design, so
    // this is not a glyph-shape check — it is a *placement* check: if the
    // rotation frame or its pivot were wrong the blocks would land in
    // visibly different places, which a mismatch ratio catches even
    // through AA noise.  Node labels are the interesting case: they had
    // no rotation path at all before 27.7.
    // the scene is deliberately ink-dominated: a small label rotated by a
    // small angle moves almost no pixels, so an under-powered version of
    // this test passed even with v4 ignoring rotation entirely (checked)
    const angles = [Math.PI / 2, -Math.PI / 2, Math.PI / 4, -Math.PI / 4];
    const elements = angles.map((_, i) => ({
      data: { id: `n${i}`, i },
      position: { x: (i % 2) * 180 - 90, y: Math.floor(i / 2) * 140 - 70 },
    }));

    const common = {
      width: 20,
      height: 20,
      'background-color': '#dfe6e9',
      'border-width': 0,
      label: 'MMMM',
      'font-size': 40,
      color: '#2d3436',
      'text-valign': 'center',
      'text-halign': 'center',
    };
    const v3Style = [
      { selector: 'node', style: common },
      ...angles.map((a, i) => ({
        selector: `node[i = ${i}]`,
        style: { 'text-rotation': a },
      })),
    ];
    const v4Style = {
      nodes: {
        ...common,
        'text-rotation': {
          case: angles.map((a, i) => ({ when: { data: 'i', eq: i }, then: a })),
          else: 0,
        },
      },
    };

    const { v3uri, v4uri } = await page.evaluate(
      async ({ elements, v3Style, v4Style }) => {
        const cloneEles = () => JSON.parse(JSON.stringify(elements));
        const viewport = { zoom: 1, pan: { x: 200, y: 150 } };
        const cy3 = window.makeV3({
          elements: cloneEles(),
          style: v3Style,
          layout: { name: 'preset', fit: false },
          ...viewport,
        });
        const cy4 = window.makeV4({
          elements: cloneEles(),
          style: v4Style,
          ...viewport,
        });

        await cy4.ready;
        await new Promise((resolve) => requestAnimationFrame(resolve));
        await new Promise((resolve) => requestAnimationFrame(resolve));

        return {
          v3uri: cy3.png({ bg: '#fff' }),
          v4uri: await cy4.png({ bg: '#fff' }),
        };
      },
      { elements, v3Style, v4Style },
    );

    // Glyph rasterization differs by design (canvas vs SDF), and this
    // scene is nearly all 40px text, so the floor is glyph noise rather
    // than placement error — the bound is 3%, not the 2% used elsewhere.
    // What makes it meaningful is the control: with v4 ignoring rotation
    // the same scene measures 5.8% and fails, against 2.3% when it
    // honours it.
    expectParityImages(v3uri, v4uri, 'parity-text-rotation', testInfo, {
      bound: 0.03,
      threshold: 0.3,
      minInk: 1500,
    });
  });

  test('parity: outlined labels — outline under ink (round 95)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    // Dark ink, a contrasting outline, several words: v3 strokes the
    // whole line and fills over it, and round 95 makes v4 layer the
    // same way, so this scene's agreement is the round's live parity.
    // Every bound is from the scene's own measurements (2026-08-28).
    // The ratio is the *placement* guard: ambient glyph noise measures
    // 2.103% (canvas-vs-SDF raster, threshold 0.3), bounded at 2.5%.
    // What the ratio cannot see, measured rather than assumed: the
    // pre-95 notch pixels (2.105% — inside the ring band the raster
    // noise already mismatches; the label-outline-words golden is the
    // notch control) and even total outline loss (2.097% with the v4
    // outline zeroed — a pale outline on the white page sits under any
    // workable pixelmatch threshold; a saturated red outline at
    // threshold 0.2 raises ambient to 4.975% and still cannot separate
    // it).  Outline *presence* is therefore the ink floor's assertion:
    // v4 inks 10,840 px with outlines against 4,872 without, so the
    // 8,000 floor separates the two decisively.
    const common = {
      width: 30,
      height: 20,
      'background-color': '#dfe6e9',
      label: 'Wavelength Watch Vans',
      'font-size': 24,
      color: '#2d3436',
      'text-outline-width': 3,
      'text-outline-color': '#ffdd59',
      'text-valign': 'bottom',
      'text-halign': 'center',
    };
    const elements = [
      { data: { id: 'w1' }, position: { x: 0, y: -70 } },
      { data: { id: 'w2' }, position: { x: 0, y: 30 } },
    ];
    const v3Style = [{ selector: 'node', style: common }];
    const v4Style = { nodes: common };

    const { v3uri, v4uri } = await page.evaluate(
      async ({ elements, v3Style, v4Style }) => {
        const cloneEles = () => JSON.parse(JSON.stringify(elements));
        const viewport = { zoom: 1, pan: { x: 200, y: 150 } };
        const cy3 = window.makeV3({
          elements: cloneEles(),
          style: v3Style,
          layout: { name: 'preset', fit: false },
          ...viewport,
        });
        const cy4 = window.makeV4({
          elements: cloneEles(),
          style: v4Style,
          ...viewport,
        });

        await cy4.ready;
        await new Promise((resolve) => requestAnimationFrame(resolve));
        await new Promise((resolve) => requestAnimationFrame(resolve));

        return {
          v3uri: cy3.png({ bg: '#fff' }),
          v4uri: await cy4.png({ bg: '#fff' }),
        };
      },
      { elements, v3Style, v4Style },
    );

    expectParityImages(v3uri, v4uri, 'parity-outlined-labels', testInfo, {
      bound: 0.025,
      threshold: 0.3,
      minInk: 8000,
    });
  });

  test('parity: compound parents — auto-bounds, padding, draw order (round 14.9)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    // both sides run their DEFAULT parent styling (v3's :parent block is
    // v4's parents-group overlay: rectangle, #eee, 1px #ccc, padding 10)
    // over the same auto-bounds math, so parent boxes must land
    // identically; the leaf-to-leaf edge draws over the parent bodies on
    // both renderers (v3's compound z-order)
    const elements = [
      { data: { id: 'gp' } },
      { data: { id: 'p', parent: 'gp' } },
      { data: { id: 'a', parent: 'p' }, position: { x: -120, y: -30 } },
      { data: { id: 'b', parent: 'p' }, position: { x: -40, y: 30 } },
      { data: { id: 'q' } },
      { data: { id: 'c', parent: 'q' }, position: { x: 130, y: 0 } },
      { data: { id: 'ac', source: 'a', target: 'c' } },
    ];
    const v3Style = [
      {
        selector: 'node',
        style: {
          width: 40,
          height: 30,
          shape: 'rectangle',
          'background-color': '#e17055',
          'border-width': 2,
          'border-color': '#2d3436',
        },
      },
      {
        selector: 'edge',
        style: { width: 4, 'line-color': '#6c5ce7', 'curve-style': 'straight' },
      },
    ];
    const v4Style = {
      nodes: {
        width: 40,
        height: 30,
        shape: 'rectangle',
        'background-color': '#e17055',
        'border-width': 2,
        'border-color': '#2d3436',
      },
      edges: { width: 4, 'line-color': '#6c5ce7' },
    };

    const { v3uri, v4uri } = await page.evaluate(
      async ({ elements, v3Style, v4Style }) => {
        const cloneEles = () => JSON.parse(JSON.stringify(elements));
        const viewport = { zoom: 1, pan: { x: 200, y: 150 } };
        const cy3 = window.makeV3({
          elements: cloneEles(),
          style: v3Style,
          layout: { name: 'preset', fit: false },
          ...viewport,
        });
        const cy4 = window.makeV4({
          elements: cloneEles(),
          style: v4Style,
          ...viewport,
        });

        await cy4.ready;
        await new Promise((resolve) => requestAnimationFrame(resolve));
        await new Promise((resolve) => requestAnimationFrame(resolve));

        return {
          v3uri: cy3.png({ bg: '#fff' }),
          v4uri: await cy4.png({ bg: '#fff' }),
        };
      },
      { elements, v3Style, v4Style },
    );

    // Known systematic difference (recorded in src/README.md): v3's
    // node bb includes the border's miter-corner overshoot
    // (~(sqrt(2)-1) x border/2 per side on cornered shapes), which
    // compounds pick up as slightly larger parent boxes when children
    // are bordered — v4's child extents are the plain border-inclusive
    // outerHalf.  Sub-pixel per level (~0.4-0.6 px here), but the AA
    // classifier flags whole perimeter rings, so the bound is looser
    // than the solid-shape scenes (the parity-curves precedent).
    expectParityImages(v3uri, v4uri, 'parity-compounds', testInfo, {
      bound: 0.03,
    });
  });

  test('parity: compound loop edges (round 14.10)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    // neither side declares a curve style: v3's default stylesheet routes
    // related edges as 'compound' (its edge:compound block), and v4
    // routes on the relation — the same construction on both renderers.
    // v3's edge:compound block also defaults the *endpoints* to
    // outside-to-line where v4 uses outside-to-node (toward the control),
    // a small angular difference at the boundary — bounded like the
    // other curve parity scenes.
    const elements = [
      { data: { id: 'p' } },
      { data: { id: 'a', parent: 'p' }, position: { x: -60, y: -20 } },
      { data: { id: 'b', parent: 'p' }, position: { x: 40, y: 30 } },
      { data: { id: 'ap', source: 'a', target: 'p' } },
      { data: { id: 'pp', source: 'p', target: 'p' } },
    ];
    const nodeStyle = {
      width: 40,
      height: 30,
      shape: 'rectangle',
      'background-color': '#e17055',
      'border-width': 0,
    };
    const v3Style = [
      { selector: 'node', style: nodeStyle },
      { selector: 'edge', style: { width: 4, 'line-color': '#6c5ce7' } },
    ];
    const v4Style = {
      nodes: nodeStyle,
      parents: { 'border-width': 0 },
      edges: { width: 4, 'line-color': '#6c5ce7' },
    };

    const { v3uri, v4uri } = await page.evaluate(
      async ({ elements, v3Style, v4Style }) => {
        const cloneEles = () => JSON.parse(JSON.stringify(elements));
        const viewport = { zoom: 1, pan: { x: 230, y: 200 } };
        const cy3 = window.makeV3({
          elements: cloneEles(),
          style: v3Style,
          layout: { name: 'preset', fit: false },
          ...viewport,
        });
        const cy4 = window.makeV4({
          elements: cloneEles(),
          style: v4Style,
          ...viewport,
        });

        await cy4.ready;
        await new Promise((resolve) => requestAnimationFrame(resolve));
        await new Promise((resolve) => requestAnimationFrame(resolve));

        return {
          v3uri: cy3.png({ bg: '#fff' }),
          v4uri: await cy4.png({ bg: '#fff' }),
        };
      },
      { elements, v3Style, v4Style },
    );

    expectParityImages(v3uri, v4uri, 'parity-compound-loops', testInfo, {
      bound: 0.03,
    });
  });

  test('parity: bezier bundles + self-loops (round 12a)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    // v3's default look, opted into explicitly on both sides: a 3-bundle
    // with an antiparallel member (odd middle renders straight), a
    // 2-bundle, and a default self-loop.  Circle nodes keep the boundary
    // math exact on both sides; no arrows ('none' has gap 0, so v3 draws
    // boundary-to-boundary exactly like v4).
    const elements = [
      { data: { id: 'a' }, position: { x: -120, y: -60 } },
      { data: { id: 'b' }, position: { x: 120, y: -60 } },
      { data: { id: 'q0', source: 'a', target: 'b' } },
      { data: { id: 'q1', source: 'a', target: 'b' } },
      { data: { id: 'q2', source: 'b', target: 'a' } },
      { data: { id: 'c' }, position: { x: -120, y: 80 } },
      { data: { id: 'd' }, position: { x: 120, y: 80 } },
      { data: { id: 'p0', source: 'c', target: 'd' } },
      { data: { id: 'p1', source: 'c', target: 'd' } },
      { data: { id: 'n' }, position: { x: 20, y: 30 } },
      { data: { id: 'loop', source: 'n', target: 'n' } },
    ];
    // wide strokes on purpose: pixelmatch skips AA-classified pixels,
    // and a 3px curve is nearly all AA — 8px strokes have solid
    // interiors, so a misplaced curve produces real mismatches
    const v3Style = [
      {
        selector: 'node',
        style: {
          width: 30,
          height: 30,
          shape: 'ellipse',
          'background-color': '#c0392b',
        },
      },
      {
        selector: 'edge',
        style: { width: 8, 'line-color': '#7f8c8d', 'curve-style': 'bezier' },
      },
    ];
    const v4Style = {
      nodes: { width: 30, height: 30, 'background-color': '#c0392b' },
      edges: { width: 8, 'line-color': '#7f8c8d', 'curve-style': 'bezier' },
    };

    const { v3uri, v4uri } = await page.evaluate(
      async ({ elements, v3Style, v4Style }) => {
        const cloneEles = () => JSON.parse(JSON.stringify(elements));
        const viewport = { zoom: 1, pan: { x: 200, y: 150 } };
        const cy3 = window.makeV3({
          elements: cloneEles(),
          style: v3Style,
          layout: { name: 'preset', fit: false },
          ...viewport,
        });
        const cy4 = window.makeV4({
          elements: cloneEles(),
          style: v4Style,
          ...viewport,
        });

        await cy4.ready;
        await new Promise((resolve) => requestAnimationFrame(resolve));
        await new Promise((resolve) => requestAnimationFrame(resolve));

        return {
          v3uri: cy3.png({ bg: '#fff' }),
          v4uri: await cy4.png({ bg: '#fff' }),
        };
      },
      { elements, v3Style, v4Style },
    );

    // curves are nearly all AA fringe (the highest perimeter-to-area of
    // any parity scene), so the bound is looser than the solid-shape
    // scenes' 2% — placement agreement is what this pins
    expectParityImages(v3uri, v4uri, 'parity-curves', testInfo, {
      bound: 0.03,
    });
  });

  test('parity: unbundled bezier, segments and taxi (round 12b)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    // one pair per 12b family, identical params on both sides.  Circle
    // nodes keep boundary math exact; 8px strokes give solid interiors
    // (see the 12a parity note).  Known systematic difference: sharp
    // segment corners join with a clamped miter in v4 vs v3's round
    // canvas joins — confined to the outer join wedge.
    const elements = [
      { data: { id: 'ua' }, position: { x: -150, y: -120 } },
      { data: { id: 'ub' }, position: { x: 130, y: -120 } },
      {
        data: {
          id: 'unb',
          source: 'ua',
          target: 'ub',
          fam: 'unbundled-bezier',
        },
      },
      { data: { id: 'sa' }, position: { x: -150, y: -30 } },
      { data: { id: 'sb' }, position: { x: 130, y: -30 } },
      { data: { id: 'seg', source: 'sa', target: 'sb', fam: 'segments' } },
      { data: { id: 'ra' }, position: { x: -150, y: 60 } },
      { data: { id: 'rb' }, position: { x: 130, y: 60 } },
      {
        data: { id: 'rseg', source: 'ra', target: 'rb', fam: 'round-segments' },
      },
      { data: { id: 'ta' }, position: { x: -140, y: 110 } },
      { data: { id: 'tb' }, position: { x: -40, y: 240 } },
      { data: { id: 'taxi', source: 'ta', target: 'tb', fam: 'taxi' } },
      { data: { id: 'rta' }, position: { x: 40, y: 110 } },
      { data: { id: 'rtb' }, position: { x: 140, y: 240 } },
      {
        data: { id: 'rtaxi', source: 'rta', target: 'rtb', fam: 'round-taxi' },
      },
    ];
    const shared = {
      width: 8,
      'line-color': '#7f8c8d',
      'control-point-distances': [50, -50],
      'control-point-weights': [0.25, 0.75],
      'segment-distances': [40, -40],
      'segment-weights': [0.3, 0.7],
      'segment-radii': 18,
      'taxi-turn': 30,
      'taxi-radius': 12,
    };
    const v3Style = [
      {
        selector: 'node',
        style: {
          width: 30,
          height: 30,
          shape: 'ellipse',
          'background-color': '#c0392b',
        },
      },
      {
        selector: 'edge',
        style: Object.assign({ 'curve-style': 'straight' }, shared),
      },
      ...[
        'unbundled-bezier',
        'segments',
        'round-segments',
        'taxi',
        'round-taxi',
      ].map((fam) => ({
        selector: `edge[fam = '${fam}']`,
        style: { 'curve-style': fam },
      })),
    ];
    const v4Style = {
      nodes: { width: 30, height: 30, 'background-color': '#c0392b' },
      edges: Object.assign({ 'curve-style': { data: 'fam' } }, shared),
    };

    const { v3uri, v4uri } = await page.evaluate(
      async ({ elements, v3Style, v4Style }) => {
        const cloneEles = () => JSON.parse(JSON.stringify(elements));
        const viewport = { zoom: 1, pan: { x: 200, y: 150 } };
        const cy3 = window.makeV3({
          elements: cloneEles(),
          style: v3Style,
          layout: { name: 'preset', fit: false },
          ...viewport,
        });
        const cy4 = window.makeV4({
          elements: cloneEles(),
          style: v4Style,
          ...viewport,
        });

        await cy4.ready;
        await new Promise((resolve) => requestAnimationFrame(resolve));
        await new Promise((resolve) => requestAnimationFrame(resolve));

        return {
          v3uri: cy3.png({ bg: '#fff' }),
          v4uri: await cy4.png({ bg: '#fff' }),
        };
      },
      { elements, v3Style, v4Style },
    );

    expectParityImages(v3uri, v4uri, 'parity-routes', testInfo, {
      bound: 0.03,
    });
  });

  /**
   * Shared 12c parity runner: render the same defs both sides, diff.
   *
   * `opts.zoom` (round 55) scales the shared viewport.  The arrow scenes
   * need it: an arrow gap is a handful of model px, and at zoom 1 on a
   * 400x300 canvas it sits three orders of magnitude under the bound.
   */
  const runParity = async (
    page,
    testInfo,
    name,
    elements,
    v3Style,
    v4Style,
    opts = {},
  ) => {
    const { v3uri, v4uri } = await page.evaluate(
      async ({ elements, v3Style, v4Style, zoom }) => {
        const cloneEles = () => JSON.parse(JSON.stringify(elements));
        const viewport = { zoom, pan: { x: 200, y: 150 } };
        const cy3 = window.makeV3({
          elements: cloneEles(),
          style: v3Style,
          layout: { name: 'preset', fit: false },
          ...viewport,
        });
        const cy4 = window.makeV4({
          elements: cloneEles(),
          style: v4Style,
          ...viewport,
        });

        await cy4.ready;
        await new Promise((resolve) => requestAnimationFrame(resolve));
        await new Promise((resolve) => requestAnimationFrame(resolve));

        return {
          v3uri: cy3.png({ bg: '#fff' }),
          v4uri: await cy4.png({ bg: '#fff' }),
        };
      },
      { elements, v3Style, v4Style, zoom: opts.zoom ?? 1 },
    );

    // the spread goes first: `{ bound: …, ...opts }` would let an opts
    // object without a `bound` key overwrite the default with undefined,
    // which the helper then reads as its own 0.02 default — tightening
    // every curve scene by a third, silently
    expectParityImages(v3uri, v4uri, name, testInfo, {
      ...opts,
      bound: opts.bound ?? 0.03,
    });
  };

  test('parity: manual endpoints + distances (round 12c)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    // one endpoint config (constants-only props) across orientations: a
    // px point source end, an angle target end, a source distance — on
    // straight chords and an unbundled bezier re-based on the manual
    // anchors (edge-distances: endpoints).  No arrows: 'none' has gap 0,
    // so v3's shorten matches v4's dist-only rule exactly.
    const elements = [
      { data: { id: 'a1' }, position: { x: -150, y: -90 } },
      { data: { id: 'b1' }, position: { x: 110, y: -90 } },
      { data: { id: 'h', source: 'a1', target: 'b1' } },
      { data: { id: 'a2' }, position: { x: -140, y: -10 } },
      { data: { id: 'b2' }, position: { x: -140, y: 130 } },
      { data: { id: 'v', source: 'a2', target: 'b2' } },
      { data: { id: 'a3' }, position: { x: -30, y: 20 } },
      { data: { id: 'b3' }, position: { x: 140, y: 120 } },
      { data: { id: 'unb', source: 'a3', target: 'b3', fam: 1 } },
    ];
    const shared = {
      width: 8,
      'line-color': '#7f8c8d',
      'source-endpoint': '18 30',
      'target-endpoint': '225deg',
      'source-distance-from-node': 8,
      'edge-distances': 'endpoints',
      'control-point-distances': [45],
      'control-point-weights': [0.5],
    };
    const v3Style = [
      {
        selector: 'node',
        style: {
          width: 28,
          height: 28,
          shape: 'ellipse',
          'background-color': '#c0392b',
        },
      },
      {
        selector: 'edge',
        style: Object.assign({ 'curve-style': 'straight' }, shared),
      },
      {
        selector: 'edge[fam = 1]',
        style: { 'curve-style': 'unbundled-bezier' },
      },
    ];
    const v4Style = {
      nodes: { width: 28, height: 28, 'background-color': '#c0392b' },
      edges: Object.assign(
        {
          'curve-style': {
            case: [{ when: { data: 'fam', eq: 1 }, then: 'unbundled-bezier' }],
            else: 'straight',
          },
        },
        shared,
      ),
    };

    await runParity(
      page,
      testInfo,
      'parity-endpoints',
      elements,
      v3Style,
      v4Style,
    );
  });

  test('parity: straight-triangle edges (round 12c)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    const elements = [
      { data: { id: 'a1' }, position: { x: -150, y: -90 } },
      { data: { id: 'b1' }, position: { x: 120, y: -90 } },
      { data: { id: 'h', source: 'a1', target: 'b1' } },
      { data: { id: 'a2' }, position: { x: -140, y: -10 } },
      { data: { id: 'b2' }, position: { x: -140, y: 130 } },
      { data: { id: 'v', source: 'a2', target: 'b2' } },
      { data: { id: 'a3' }, position: { x: -20, y: 10 } },
      { data: { id: 'b3' }, position: { x: 140, y: 120 } },
      { data: { id: 'diag', source: 'a3', target: 'b3' } },
    ];
    const v3Style = [
      {
        selector: 'node',
        style: {
          width: 28,
          height: 28,
          shape: 'ellipse',
          'background-color': '#c0392b',
        },
      },
      {
        selector: 'edge',
        style: {
          'curve-style': 'straight-triangle',
          width: 14,
          'line-color': '#7f8c8d',
        },
      },
    ];
    const v4Style = {
      nodes: { width: 28, height: 28, 'background-color': '#c0392b' },
      edges: {
        'curve-style': 'straight-triangle',
        width: 14,
        'line-color': '#7f8c8d',
      },
    };

    await runParity(
      page,
      testInfo,
      'parity-triangle',
      elements,
      v3Style,
      v4Style,
    );
  });

  test('parity: haystack at radius 0 (round 12c)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    // radius 0 pins the haystack *pipeline* against v3 exactly: both
    // sides draw center-to-center lines (v3's random unit offsets are
    // scaled to zero).  Radius > 0 has no exact v3 parity — v3 seeds
    // with Math.random() — so the deterministic v4 golden covers it.
    const elements = [
      { data: { id: 'a' }, position: { x: -120, y: -60 } },
      { data: { id: 'b' }, position: { x: 120, y: -60 } },
      { data: { id: 'c' }, position: { x: -120, y: 80 } },
      { data: { id: 'd' }, position: { x: 120, y: 80 } },
      { data: { id: 'ab', source: 'a', target: 'b' } },
      { data: { id: 'cd', source: 'c', target: 'd' } },
      { data: { id: 'ad', source: 'a', target: 'd' } },
      { data: { id: 'cb', source: 'c', target: 'b' } },
    ];
    const v3Style = [
      {
        selector: 'node',
        style: {
          width: 30,
          height: 30,
          shape: 'ellipse',
          'background-color': '#c0392b',
        },
      },
      {
        selector: 'edge',
        style: {
          'curve-style': 'haystack',
          'haystack-radius': 0,
          width: 8,
          'line-color': '#7f8c8d',
        },
      },
    ];
    const v4Style = {
      nodes: { width: 30, height: 30, 'background-color': '#c0392b' },
      edges: {
        'curve-style': 'haystack',
        'haystack-radius': 0,
        width: 8,
        'line-color': '#7f8c8d',
      },
    };

    await runParity(
      page,
      testInfo,
      'parity-haystack0',
      elements,
      v3Style,
      v4Style,
    );
  });

  test('parity: ghost bodies (round 13 A1)', async ({ page }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    // for label-free nodes v3's whole-node ghost redraw IS the body
    // duplicate v4 draws, so the scenes are pixel-comparable
    const elements = [
      { data: { id: 'a' }, position: { x: -100, y: -60 } },
      { data: { id: 'b' }, position: { x: 60, y: -60 } },
      { data: { id: 'c' }, position: { x: -20, y: 70 } },
    ];
    const shared = {
      width: 44,
      height: 44,
      'background-color': '#c0392b',
      'border-width': 4,
      'border-color': '#2c3e50',
      ghost: 'yes',
      'ghost-offset-x': 24,
      'ghost-offset-y': 18,
      'ghost-opacity': 0.45,
    };
    const v3Style = [
      { selector: 'node', style: Object.assign({ shape: 'ellipse' }, shared) },
    ];
    const v4Style = { nodes: Object.assign({}, shared) };

    await runParity(
      page,
      testInfo,
      'parity-ghost',
      elements,
      v3Style,
      v4Style,
      { minInk: 1000 },
    );
  });

  test('parity: overlay and underlay layers (round 13 A2)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    // label-free nodes: both sides draw body + underlay + overlay only,
    // so the scenes compare directly (v4 draws overlays under the label
    // layer, but there are no labels here)
    const elements = [
      { data: { id: 'a' }, position: { x: -100, y: -50 } },
      { data: { id: 'b' }, position: { x: 60, y: -50 } },
      { data: { id: 'c' }, position: { x: -20, y: 70 } },
    ];
    const shared = {
      width: 44,
      height: 44,
      'background-color': '#2980b9',
      'overlay-color': '#e74c3c',
      'overlay-padding': 8,
      'overlay-opacity': 0.4,
      'overlay-shape': 'ellipse',
      'underlay-color': '#27ae60',
      'underlay-padding': 14,
      'underlay-opacity': 0.8,
      'underlay-shape': 'round-rectangle',
      'underlay-corner-radius': 8,
    };
    const v3Style = [
      { selector: 'node', style: Object.assign({ shape: 'ellipse' }, shared) },
    ];
    const v4Style = { nodes: Object.assign({}, shared) };

    await runParity(
      page,
      testInfo,
      'parity-node-layers',
      elements,
      v3Style,
      v4Style,
      { minInk: 1000 },
    );
  });

  test('parity: edge overlay/underlay strokes (round 13 A2)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    // v3 strokes edge overlays with round caps; v4 keeps butt caps (a
    // recorded deviation confined to the stroke ends) — the bound
    // absorbs the caps while the stroke body must agree
    const elements = [
      { data: { id: 'a' }, position: { x: -120, y: -60 } },
      { data: { id: 'b' }, position: { x: 120, y: -60 } },
      { data: { id: 'c' }, position: { x: -120, y: 80 } },
      { data: { id: 'd' }, position: { x: 120, y: 80 } },
      { data: { id: 'ab', source: 'a', target: 'b' } },
      { data: { id: 'cd', source: 'c', target: 'd' } },
      { data: { id: 'ad', source: 'a', target: 'd' } },
    ];
    const shared = {
      width: 6,
      'line-color': '#7f8c8d',
      'overlay-color': '#e67e22',
      'overlay-opacity': 0.4,
      'overlay-padding': 6,
      'underlay-color': '#16a085',
      'underlay-opacity': 0.9,
      'underlay-padding': 12,
    };
    const v3Style = [
      {
        selector: 'node',
        style: {
          width: 34,
          height: 34,
          shape: 'ellipse',
          'background-color': '#c0392b',
        },
      },
      {
        selector: 'edge',
        style: Object.assign({ 'curve-style': 'straight' }, shared),
      },
    ];
    const v4Style = {
      nodes: { width: 34, height: 34, 'background-color': '#c0392b' },
      edges: Object.assign({}, shared),
    };

    await runParity(
      page,
      testInfo,
      'parity-edge-layers',
      elements,
      v3Style,
      v4Style,
      { minInk: 1500 },
    );
  });

  test('parity: the channel opacity split (round 13 B1)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    const elements = [
      { data: { id: 'a' }, position: { x: -120, y: -60 } },
      { data: { id: 'b' }, position: { x: 120, y: -60 } },
      { data: { id: 'c' }, position: { x: -120, y: 80 } },
      { data: { id: 'd' }, position: { x: 120, y: 80 } },
      { data: { id: 'ab', source: 'a', target: 'b' } },
      { data: { id: 'cd', source: 'c', target: 'd' } },
      { data: { id: 'ad', source: 'a', target: 'd' } },
    ];
    const nodeShared = {
      width: 44,
      height: 44,
      'background-color': '#c0392b',
      'background-opacity': 0.5,
      'border-width': 6,
      'border-color': '#2c3e50',
      'border-opacity': 0.4,
    };
    const edgeShared = {
      width: 8,
      'line-color': '#7f8c8d',
      'line-opacity': 0.45,
      'target-arrow-shape': 'triangle',
      'target-arrow-color': '#8e44ad',
    };
    const v3Style = [
      {
        selector: 'node',
        style: Object.assign({ shape: 'ellipse' }, nodeShared),
      },
      {
        selector: 'edge',
        style: Object.assign({ 'curve-style': 'straight' }, edgeShared),
      },
    ];
    const v4Style = {
      nodes: Object.assign({}, nodeShared),
      edges: Object.assign({}, edgeShared),
    };

    await runParity(
      page,
      testInfo,
      'parity-opacity-split',
      elements,
      v3Style,
      v4Style,
      { minInk: 1500 },
    );
  });

  test('parity: border positions and corner radii (round 13 B2)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    const elements = [
      { data: { id: 'a', bp: 'center' }, position: { x: -110, y: -60 } },
      { data: { id: 'b', bp: 'inside' }, position: { x: 30, y: -60 } },
      { data: { id: 'c', bp: 'outside' }, position: { x: 160, y: -60 } },
      { data: { id: 'd', bp: 'center', rr: 1 }, position: { x: -110, y: 70 } },
      {
        data: { id: 'e', bp: 'center', rr: 1, r: 14 },
        position: { x: 30, y: 70 },
      },
      {
        data: { id: 'f', bp: 'center', rr: 1, r: 3 },
        position: { x: 160, y: 70 },
      },
    ];
    const v3Style = [
      {
        selector: 'node',
        style: {
          width: 60,
          height: 44,
          shape: 'ellipse',
          'background-color': '#f1c40f',
          'border-width': 8,
          'border-color': '#2c3e50',
        },
      },
      {
        selector: "node[bp = 'inside']",
        style: { 'border-position': 'inside' },
      },
      {
        selector: "node[bp = 'outside']",
        style: { 'border-position': 'outside' },
      },
      { selector: 'node[rr = 1]', style: { shape: 'round-rectangle' } },
      { selector: 'node[r = 14]', style: { 'corner-radius': 14 } },
      { selector: 'node[r = 3]', style: { 'corner-radius': 3 } },
    ];
    const v4Style = {
      nodes: {
        width: 60,
        height: 44,
        'background-color': '#f1c40f',
        'border-width': 8,
        'border-color': '#2c3e50',
        'border-position': {
          case: [
            { when: { data: 'bp', eq: 'inside' }, then: 'inside' },
            { when: { data: 'bp', eq: 'outside' }, then: 'outside' },
          ],
          else: 'center',
        },
        shape: {
          case: [{ when: { data: 'rr', eq: 1 }, then: 'round-rectangle' }],
          else: 'ellipse',
        },
        // else 8 == the auto value for 60×44 (min(15, 11, 8)); the auto
        // keyword itself is a constant, exercised by parity-basic
        'corner-radius': {
          case: [
            { when: { data: 'r', eq: 14 }, then: 14 },
            { when: { data: 'r', eq: 3 }, then: 3 },
          ],
          else: 8,
        },
      },
    };

    await runParity(
      page,
      testInfo,
      'parity-border-geom',
      elements,
      v3Style,
      v4Style,
      { minInk: 1500 },
    );
  });

  test('parity: dash patterns, offsets and caps (round 13 B3)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    const elements = [
      { data: { id: 'a' }, position: { x: -140, y: -80 } },
      { data: { id: 'b' }, position: { x: 140, y: -80 } },
      { data: { id: 'p1', source: 'a', target: 'b' } },
      { data: { id: 'c' }, position: { x: -140, y: 0 } },
      { data: { id: 'd' }, position: { x: 140, y: 0 } },
      { data: { id: 'p2', source: 'c', target: 'd', off: 1 } },
      { data: { id: 'e' }, position: { x: -140, y: 80 } },
      { data: { id: 'f' }, position: { x: 140, y: 80 } },
      { data: { id: 'p3', source: 'e', target: 'f', cap: 'round' } },
      { data: { id: 'g' }, position: { x: -140, y: 160 } },
      { data: { id: 'h' }, position: { x: 140, y: 160 } },
      { data: { id: 'p4', source: 'g', target: 'h', cap: 'square' } },
    ];
    const shared = {
      width: 8,
      'line-color': '#7f8c8d',
      'line-style': 'dashed',
      'line-dash-pattern': [14, 10],
    };
    const v3Style = [
      {
        selector: 'node',
        style: {
          width: 26,
          height: 26,
          shape: 'ellipse',
          'background-color': '#c0392b',
        },
      },
      {
        selector: 'edge',
        style: Object.assign({ 'curve-style': 'straight' }, shared),
      },
      { selector: 'edge[off = 1]', style: { 'line-dash-offset': 9 } },
      { selector: "edge[cap = 'round']", style: { 'line-cap': 'round' } },
      { selector: "edge[cap = 'square']", style: { 'line-cap': 'square' } },
    ];
    const v4Style = {
      nodes: { width: 26, height: 26, 'background-color': '#c0392b' },
      edges: Object.assign(
        {
          'line-dash-offset': {
            case: [{ when: { data: 'off', eq: 1 }, then: 9 }],
            else: 0,
          },
          'line-cap': {
            case: [
              { when: { data: 'cap', eq: 'round' }, then: 'round' },
              { when: { data: 'cap', eq: 'square' }, then: 'square' },
            ],
            else: 'butt',
          },
        },
        shared,
      ),
    };

    await runParity(
      page,
      testInfo,
      'parity-dash-props',
      elements,
      v3Style,
      v4Style,
      { minInk: 1200 },
    );
  });

  test('parity: line-outline casing (round 13 B4)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    // straight, bezier-pair and taxi edges under an 8px casing; the
    // casing strokes with butt caps in v4 (v3 rounds stroke ends —
    // the recorded edge-layer deviation, confined to the ends)
    const elements = [
      { data: { id: 'a' }, position: { x: -130, y: -80 } },
      { data: { id: 'b' }, position: { x: 130, y: -80 } },
      { data: { id: 's', source: 'a', target: 'b' } },
      { data: { id: 'c' }, position: { x: -130, y: 10 } },
      { data: { id: 'd' }, position: { x: 130, y: 10 } },
      { data: { id: 'q1', source: 'c', target: 'd', fam: 'bezier' } },
      { data: { id: 'q2', source: 'c', target: 'd', fam: 'bezier' } },
      { data: { id: 'e' }, position: { x: -130, y: 90 } },
      { data: { id: 'f' }, position: { x: -20, y: 200 } },
      { data: { id: 't', source: 'e', target: 'f', fam: 'taxi' } },
    ];
    const shared = {
      width: 6,
      'line-color': '#e67e22',
      'line-outline-width': 8,
      'line-outline-color': '#2c3e50',
      'taxi-turn': 40,
    };
    const v3Style = [
      {
        selector: 'node',
        style: {
          width: 28,
          height: 28,
          shape: 'ellipse',
          'background-color': '#c0392b',
        },
      },
      {
        selector: 'edge',
        style: Object.assign({ 'curve-style': 'straight' }, shared),
      },
      { selector: "edge[fam = 'bezier']", style: { 'curve-style': 'bezier' } },
      { selector: "edge[fam = 'taxi']", style: { 'curve-style': 'taxi' } },
    ];
    const v4Style = {
      nodes: { width: 28, height: 28, 'background-color': '#c0392b' },
      edges: Object.assign(
        {
          'curve-style': {
            case: [
              { when: { data: 'fam', eq: 'bezier' }, then: 'bezier' },
              { when: { data: 'fam', eq: 'taxi' }, then: 'taxi' },
            ],
            else: 'straight',
          },
        },
        shared,
      ),
    };

    await runParity(
      page,
      testInfo,
      'parity-casing',
      elements,
      v3Style,
      v4Style,
      { minInk: 1500 },
    );
  });

  test('parity: node outlines (round 13 B5)', async ({ page }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    // circles keep v3's scaled-path outline identical to v4's constant
    // SDF band (anisotropic shapes deviate by construction — recorded)
    const elements = [
      { data: { id: 'a' }, position: { x: -100, y: -50 } },
      { data: { id: 'b', off: 1 }, position: { x: 60, y: -50 } },
      { data: { id: 'c', bordered: 1 }, position: { x: -20, y: 80 } },
    ];
    const shared = {
      width: 50,
      height: 50,
      'background-color': '#f39c12',
      'outline-width': 6,
      'outline-color': '#8e44ad',
      'outline-opacity': 0.9,
    };
    const v3Style = [
      { selector: 'node', style: Object.assign({ shape: 'ellipse' }, shared) },
      { selector: 'node[off = 1]', style: { 'outline-offset': 10 } },
      {
        selector: 'node[bordered = 1]',
        style: { 'border-width': 6, 'border-color': '#2c3e50' },
      },
    ];
    const v4Style = {
      nodes: Object.assign(
        {
          'outline-offset': {
            case: [{ when: { data: 'off', eq: 1 }, then: 10 }],
            else: 0,
          },
          'border-width': {
            case: [{ when: { data: 'bordered', eq: 1 }, then: 6 }],
            else: 0,
          },
          'border-color': '#2c3e50',
        },
        shared,
      ),
    };

    await runParity(
      page,
      testInfo,
      'parity-outline',
      elements,
      v3Style,
      v4Style,
      { minInk: 1200 },
    );
  });

  test('parity: dashed borders — the closed-form tier (round 38)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    // Transparent fills, so the dashes are the scene's only ink (an
    // opaque fill would paint over half of any error — the round-55
    // lesson), and the tier's whole vocabulary: circle (exact angular
    // arc length), eccentric ellipse (the recorded angle-parameterized
    // deviation), rectangle and round-rectangle (v3's exact path
    // walks), plus border-position and a dash offset, each of which
    // moves every dash if mishandled.
    // compact grid at zoom 2 (the round-56 close-up lesson): at zoom 1
    // the AA fringe smears the 2 px gaps and a solid border reads
    // within a percent of a dashed one — magnified, the gaps are real
    // pixels and the feature-off control jumps
    const elements = [
      { data: { id: 'circ' }, position: { x: -58, y: -28 } },
      { data: { id: 'circ2', doff: 1 }, position: { x: 0, y: -28 } },
      { data: { id: 'rect', sh: 'rectangle' }, position: { x: 58, y: -28 } },
      {
        data: { id: 'rrect', sh: 'round-rectangle' },
        position: { x: -58, y: 28 },
      },
      {
        data: { id: 'inside', sh: 'rectangle', bp: 'inside' },
        position: { x: 0, y: 28 },
      },
      {
        data: { id: 'offset', sh: 'round-rectangle', doff: 1 },
        position: { x: 58, y: 28 },
      },
    ];
    const shared = {
      width: 44,
      height: 44,
      'background-opacity': 0,
      'border-width': 5,
      'border-color': '#c0392b',
      'border-style': 'dashed',
    };
    const v3Style = [
      {
        selector: 'node',
        style: Object.assign(
          { shape: 'ellipse', 'border-dash-pattern': [8, 4] },
          shared,
        ),
      },

      { selector: "node[sh = 'rectangle']", style: { shape: 'rectangle' } },
      {
        selector: "node[sh = 'round-rectangle']",
        style: { shape: 'round-rectangle', 'corner-radius': 12 },
      },
      {
        selector: "node[bp = 'inside']",
        style: { 'border-position': 'inside' },
      },
      { selector: 'node[doff = 1]', style: { 'border-dash-offset': 6 } },
    ];
    const v4Style = {
      nodes: Object.assign(
        {
          'border-dash-pattern': [8, 4],
          shape: {
            case: [
              { when: { data: 'sh', eq: 'rectangle' }, then: 'rectangle' },
              {
                when: { data: 'sh', eq: 'round-rectangle' },
                then: 'round-rectangle',
              },
            ],
            else: 'ellipse',
          },

          'corner-radius': {
            case: [{ when: { data: 'sh', eq: 'round-rectangle' }, then: 12 }],
            else: -1,
          },
          'border-position': {
            case: [{ when: { data: 'bp', eq: 'inside' }, then: 'inside' }],
            else: 'center',
          },
          'border-dash-offset': {
            case: [{ when: { data: 'doff', eq: 1 }, then: 6 }],
            else: 0,
          },
        },
        shared,
      ),
    };

    await runParity(
      page,
      testInfo,
      'parity-border-dashed',
      elements,
      v3Style,
      v4Style,
      { minInk: 2000, bound: 0.008, zoom: 2 },
    );
  });

  test('parity: dashed borders — the polygon tier (round 38)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    // the generated-walk tier: sharp polygons (exact), a round-*
    // polygon (the recorded source-polygon approximation), barrel,
    // cut-rectangle and the custom polygon blob walk
    const shapes = [
      'hexagon',
      'star',
      'diamond',
      'triangle',
      'cut-rectangle',
      'barrel',
      'round-hexagon',
      'polygon',
    ];
    const elements = shapes.map((sh, i) => ({
      data: { id: sh, sh },
      position: { x: (i % 4) * 48 - 72, y: Math.floor(i / 4) * 52 - 26 },
    }));
    const shared = {
      width: 42,
      height: 38,
      'background-opacity': 0,
      'border-width': 4,
      'border-color': '#2c3e50',
      'border-style': 'dashed',
      'border-dash-pattern': [7, 4],
    };
    const poly = [-1, -1, 1, -1, 1, 0.2, 0, 0.2, 0, 1, -1, 1];
    const v3Style = [
      { selector: 'node', style: Object.assign({}, shared) },
      ...shapes.map((sh) => ({
        selector: `node[sh = '${sh}']`,
        style:
          sh === 'polygon'
            ? { shape: 'polygon', 'shape-polygon-points': poly }
            : { shape: sh },
      })),
    ];
    const v4Style = {
      nodes: Object.assign(
        {
          shape: {
            case: shapes.map((sh) => ({
              when: { data: 'sh', eq: sh },
              then: sh,
            })),
            else: 'ellipse',
          },
          'shape-polygon-points': poly,
        },
        shared,
      ),
    };

    await runParity(
      page,
      testInfo,
      'parity-border-poly',
      elements,
      v3Style,
      v4Style,
      { minInk: 2000, bound: 0.012, zoom: 2 },
    );
  });

  test('parity: dashed and dotted ellipses — exact arc length (round 38)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    // The round-38 plan budgeted an ANGLE-parameterized ellipse dash
    // with a recorded deviation, and this scene is where that plan
    // died: measured, the angle version's 5.0% mismatch was LARGER
    // than the 3.6% a solid border scores, so the scene could not
    // discriminate — round 27's measuring-nothing case.  v4 now
    // integrates true elliptic arc length (Simpson, dash-gated) with a
    // two-step Newton nearest-point parameter (the radial estimate
    // shears +-2 px of phase across the band), and the eccentric
    // ellipses land within AA noise of v3.  The [1, 1] dotted pair is
    // the hard half: a 2 px period turns any phase error into
    // anti-aligned ink.
    const elements = [
      { data: { id: 'e1' }, position: { x: -45, y: -28 } },
      { data: { id: 'e2', dotted: 1 }, position: { x: 45, y: -28 } },
      { data: { id: 'e3' }, position: { x: -45, y: 30 } },
      { data: { id: 'e4', dotted: 1 }, position: { x: 45, y: 30 } },
    ];
    const shared = {
      width: 70,
      height: 34,
      'background-opacity': 0,
      'border-width': 5,
      'border-color': '#c0392b',
      'border-dash-pattern': [8, 4],
    };
    const v3Style = [
      {
        selector: 'node',
        style: Object.assign(
          { shape: 'ellipse', 'border-style': 'dashed' },
          shared,
        ),
      },
      { selector: 'node[dotted = 1]', style: { 'border-style': 'dotted' } },
    ];
    const v4Style = {
      nodes: Object.assign(
        {
          'border-style': {
            case: [{ when: { data: 'dotted', eq: 1 }, then: 'dotted' }],
            else: 'dashed',
          },
        },
        shared,
      ),
    };

    await runParity(
      page,
      testInfo,
      'parity-border-ellipse',
      elements,
      v3Style,
      v4Style,
      { minInk: 1500, bound: 0.02, zoom: 2 },
    );
  });

  test('parity: dotted and double borders (round 38)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    // dotted is v3's hardcoded [1, 1] (the declared pattern must be
    // ignored — one node declares a wild pattern to prove it); double
    // keeps the fill opaque, because the erase stripe IS the feature:
    // the middle third must show the page through both fill and border
    const elements = [
      {
        data: { id: 'd1', st: 'dotted', sh: 'round-rectangle' },
        position: { x: -58, y: -30 },
      },
      {
        data: { id: 'd2', st: 'dotted', sh: 'rectangle' },
        position: { x: 0, y: -30 },
      },
      {
        data: { id: 'd3', st: 'dotted', sh: 'hexagon' },
        position: { x: 58, y: -30 },
      },
      { data: { id: 'b1', st: 'double' }, position: { x: -58, y: 30 } },
      {
        data: { id: 'b2', st: 'double', sh: 'rectangle' },
        position: { x: 0, y: 30 },
      },
      {
        data: { id: 'b3', st: 'double', sh: 'round-rectangle' },
        position: { x: 58, y: 30 },
      },
    ];
    const shared = {
      width: 48,
      height: 42,
      'background-color': '#f1c40f',
      'border-width': 9,
      'border-color': '#8e44ad',
    };
    const v3Style = [
      { selector: 'node', style: Object.assign({ shape: 'ellipse' }, shared) },
      { selector: "node[st = 'dotted']", style: { 'border-style': 'dotted' } },
      { selector: "node[st = 'double']", style: { 'border-style': 'double' } },
      { selector: "node[sh = 'rectangle']", style: { shape: 'rectangle' } },
      { selector: "node[sh = 'hexagon']", style: { shape: 'hexagon' } },
      {
        selector: "node[sh = 'round-rectangle']",
        style: { shape: 'round-rectangle' },
      },
      // the declared pattern is wild ON EVERY NODE: dotted must ignore
      // it (v3 hardcodes [1, 1]) and double reads no pattern at all, so
      // if either style consults the pattern the whole scene shifts
      { selector: 'node', style: { 'border-dash-pattern': [15, 15] } },
    ];
    const v4Style = {
      nodes: Object.assign(
        {
          shape: {
            case: [
              { when: { data: 'sh', eq: 'rectangle' }, then: 'rectangle' },
              { when: { data: 'sh', eq: 'hexagon' }, then: 'hexagon' },
              {
                when: { data: 'sh', eq: 'round-rectangle' },
                then: 'round-rectangle',
              },
            ],
            else: 'ellipse',
          },
          'border-style': {
            case: [
              { when: { data: 'st', eq: 'dotted' }, then: 'dotted' },
              { when: { data: 'st', eq: 'double' }, then: 'double' },
            ],
            else: 'solid',
          },
          // list props are constants-only in v4 — the wild pattern is
          // constant for the scene, and both styles here must ignore it
          'border-dash-pattern': [15, 15],
        },
        shared,
      ),
    };

    await runParity(
      page,
      testInfo,
      'parity-border-dotted-double',
      elements,
      v3Style,
      v4Style,
      { minInk: 4000, bound: 0.02, zoom: 2 },
    );
  });

  test('parity: outline styles — the ellipse family (round 38)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    // v3 hardcodes [4, 2] dashed / [1, 1] dotted, taking no props, and
    // builds each shape's outline path by a per-shape expansion
    // heuristic.  For ellipses that path is a uniformly scaled ellipse,
    // which v4's ring + arc-length dash coordinate matches; for the
    // polygon family v3 miters sharp corners where v4's ring is an SDF
    // offset with ROUNDED corners (the recorded round-13 B5 ring-shape
    // deviation), so no dash coordinate can align geometrically
    // different corner paths — those shapes are covered by the
    // `border-styles` golden instead, and the deviation is recorded in
    // src/README.md.  This scene pins the family that CAN match.
    const elements = [
      { data: { id: 'a' }, position: { x: -50, y: -30 } },
      { data: { id: 'b', wide: 1 }, position: { x: 50, y: -30 } },
      { data: { id: 'c', ost: 'dotted' }, position: { x: -50, y: 30 } },
      {
        data: { id: 'd', wide: 1, ost: 'dotted' },
        position: { x: 50, y: 30 },
      },
    ];
    const shared = {
      'background-opacity': 0,
      'outline-width': 5,
      'outline-color': '#16a085',
      'outline-offset': 4,
    };
    const v3Style = [
      {
        selector: 'node',
        style: Object.assign(
          {
            shape: 'ellipse',
            width: 46,
            height: 46,
            'outline-style': 'dashed',
          },
          shared,
        ),
      },
      { selector: 'node[wide = 1]', style: { width: 66, height: 38 } },
      {
        selector: "node[ost = 'dotted']",
        style: { 'outline-style': 'dotted' },
      },
    ];
    const v4Style = {
      nodes: Object.assign(
        {
          width: {
            case: [{ when: { data: 'wide', eq: 1 }, then: 66 }],
            else: 46,
          },
          height: {
            case: [{ when: { data: 'wide', eq: 1 }, then: 38 }],
            else: 46,
          },
          'outline-style': {
            case: [{ when: { data: 'ost', eq: 'dotted' }, then: 'dotted' }],
            else: 'dashed',
          },
        },
        shared,
      ),
    };

    await runParity(
      page,
      testInfo,
      'parity-outline-style',
      elements,
      v3Style,
      v4Style,
      { minInk: 1500, bound: 0.02, zoom: 2 },
    );
  });

  test('parity: the selection look (round 57.1)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    // **This scene could not have passed before round 57.1**, which is
    // the argument for it: v3 fills a selected node #0169D9 and v4 drew
    // a ring at its boundary, so the two disagreed over the whole
    // interior of every selected node and no parity scene covered it.
    // Neither stylesheet mentions selection — v3's default sheet carries
    // `:selected` and `:parent:selected`, and v4's carries the same rule
    // as a `{ selected: true }` condition — so what this compares is
    // precisely the two libraries' *defaults*.
    //
    // The parent pair is here because v3 gives it a different colour
    // (#CCE1F9 / #aec8e5), and a scene with leaves alone would pass with
    // that case unimplemented.
    //
    // **The sheet sets no colour at all, deliberately** — this scene is
    // about the two libraries' *defaults*.  Its sibling below covers the
    // other direction, where both sheets name a fill and neither shows a
    // selection colour.
    const elements = [
      { data: { id: 'a' }, position: { x: -150, y: -100 }, selected: true },
      { data: { id: 'b' }, position: { x: -30, y: -100 } },
      { data: { id: 'c' }, position: { x: 90, y: -100 }, selected: true },
      // a selected edge and its unselected twin, straight and curved:
      // v3's `:selected` recolours `line-color` and all four arrow
      // colours, so the heads have to follow their edge
      { data: { id: 'e1' }, position: { x: -150, y: -10 } },
      { data: { id: 'e2' }, position: { x: 90, y: -10 } },
      { data: { id: 'sel', source: 'e1', target: 'e2' }, selected: true },
      { data: { id: 'f1' }, position: { x: -150, y: 60 } },
      { data: { id: 'f2' }, position: { x: 90, y: 60 } },
      { data: { id: 'plain', source: 'f1', target: 'f2' } },
      { data: { id: 'g1' }, position: { x: -150, y: 140 } },
      { data: { id: 'g2' }, position: { x: 90, y: 140 } },
      {
        data: { id: 'curved', source: 'g1', target: 'g2', c: 1 },
        selected: true,
      },
      { data: { id: 'p' }, selected: true },
      { data: { id: 'p1', parent: 'p' }, position: { x: -110, y: 240 } },
      { data: { id: 'p2', parent: 'p' }, position: { x: -10, y: 240 } },
      { data: { id: 'q' } },
      { data: { id: 'q1', parent: 'q' }, position: { x: 110, y: 240 } },
    ];
    // a border but no border *colour*: both libraries default it to
    // black, and it staying black under selection is what says the rule
    // recolours the fill rather than the whole element
    const shared = { width: 56, height: 56, 'border-width': 6 };
    // `curve-style` is stated on both sides: v3's raw default is
    // `haystack` and v4's is `straight` (round 12's signed-off call), a
    // difference this scene is not about
    const edgeShared = {
      width: 8,
      'curve-style': 'straight',
      'target-arrow-shape': 'triangle',
      'source-arrow-shape': 'circle',
    };

    await runParity(
      page,
      testInfo,
      'parity-selection',
      elements,
      [
        { selector: 'node', style: Object.assign({}, shared) },
        { selector: 'edge', style: Object.assign({}, edgeShared) },
        {
          selector: 'edge[c = 1]',
          style: {
            'curve-style': 'unbundled-bezier',
            'control-point-distances': 60,
            'control-point-weights': 0.5,
          },
        },
      ],
      {
        nodes: Object.assign({}, shared),
        edges: Object.assign({}, edgeShared, {
          'curve-style': {
            case: [{ when: { data: 'c', eq: 1 }, then: 'unbundled-bezier' }],
            else: 'straight',
          },
          'control-point-distances': 60,
          'control-point-weights': 0.5,
        }),
      },
      // Measured **0 differing pixels** across nodes, a compound parent,
      // straight and curved edges and both arrowheads — v4's selection
      // look is not merely close to v3's here, it is the same image.
      // The bound is 0.1% rather than the suite's 3% default because
      // every control sits well above it: **3.147%** with the node
      // colour removed, **5.883%** with a selected parent taking the
      // leaf colour rather than v3's lighter pair, **0.690%** with the
      // edge line left untinted and **0.367%** with the arrowheads left
      // untinted.  At the default bound the last two would pass with
      // the feature missing, which is the whole failure mode round 27
      // recorded (a test that cannot fail is not evidence).
      { minInk: 3000, bound: 0.001 },
    );
  });

  test('parity: a named fill replaces the selection colour, in both (round 57.1)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    // The sibling of the scene above, and the one that could not have
    // existed at all before the rule moved out of v4's shader.
    //
    // Both sheets name a fill, so in **v3** the user block comes after
    // the default `:selected` and beats it: a selected node looks like an
    // unselected one.  v4 now behaves the same way, because its
    // selection colour is a default rule and the spread puts the user's
    // block last.  Until round 57.1 it was a shader constant that always
    // won, and this scene would have shown every selected element in
    // v4-blue against v3's orange.
    //
    // Half the elements are selected and half are not, so the scene also
    // fails if *neither* library draws anything at all.
    const elements = [
      { data: { id: 'a' }, position: { x: -150, y: -70 }, selected: true },
      { data: { id: 'b' }, position: { x: -30, y: -70 } },
      { data: { id: 'c' }, position: { x: 90, y: -70 }, selected: true },
      { data: { id: 'd' }, position: { x: -150, y: 40 } },
      { data: { id: 'e' }, position: { x: 90, y: 40 }, selected: true },
      { data: { id: 'de', source: 'd', target: 'e' }, selected: true },
      { data: { id: 'f' }, position: { x: -150, y: 130 } },
      { data: { id: 'g' }, position: { x: 90, y: 130 } },
      { data: { id: 'fg', source: 'f', target: 'g' } },
    ];
    const nodeStyle = {
      width: 56,
      height: 56,
      'border-width': 6,
      'background-color': '#e67e22',
    };
    const edgeStyle = {
      width: 8,
      'curve-style': 'straight',
      'line-color': '#16a085',
      'target-arrow-shape': 'triangle',
      'target-arrow-color': '#16a085',
    };

    await runParity(
      page,
      testInfo,
      'parity-selection-named',
      elements,
      [
        { selector: 'node', style: Object.assign({}, nodeStyle) },
        { selector: 'edge', style: Object.assign({}, edgeStyle) },
      ],
      {
        nodes: Object.assign({}, nodeStyle),
        edges: Object.assign({}, edgeStyle),
      },
      // The control is the change itself: spreading the default block
      // *after* the user's rather than before it — v4's pre-57.1
      // "selection always wins" — takes this scene from 0 differing
      // pixels to **12.333%**, three orders of magnitude over the bound.
      { minInk: 3000, bound: 0.001 },
    );
  });

  test('parity: background and line gradients (round 13 C2)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    // rectangles keep the gradient geometry exact on both sides; sRGB
    // interpolation matches v3's canvas gradients
    const elements = [
      { data: { id: 'a', dir: 'to-right' }, position: { x: -110, y: -60 } },
      { data: { id: 'b', dir: 'to-bottom' }, position: { x: 40, y: -60 } },
      {
        data: { id: 'c', dir: 'to-bottom-right' },
        position: { x: 170, y: -60 },
      },
      { data: { id: 'd', radial: 1 }, position: { x: -40, y: 70 } },
      { data: { id: 'p' }, position: { x: -140, y: 160 } },
      { data: { id: 'q' }, position: { x: 160, y: 160 } },
      { data: { id: 'pq', source: 'p', target: 'q' } },
    ];
    const v3Style = [
      {
        selector: 'node',
        style: {
          width: 70,
          height: 56,
          shape: 'rectangle',
          'background-fill': 'linear-gradient',
          'background-gradient-stop-colors': '#e74c3c #f1c40f #2ecc71',
          'background-gradient-direction': 'to-bottom',
        },
      },
      {
        selector: "node[dir = 'to-right']",
        style: { 'background-gradient-direction': 'to-right' },
      },
      {
        selector: "node[dir = 'to-bottom-right']",
        style: { 'background-gradient-direction': 'to-bottom-right' },
      },
      {
        selector: 'node[radial = 1]',
        style: { 'background-fill': 'radial-gradient' },
      },
      {
        selector: 'edge',
        style: {
          'curve-style': 'straight',
          width: 10,
          'line-fill': 'linear-gradient',
          'line-gradient-stop-colors': '#8e44ad #3498db',
        },
      },
    ];
    const v4Style = {
      nodes: {
        width: 70,
        height: 56,
        shape: 'rectangle',
        'background-fill': 'linear-gradient',
        'background-gradient-stop-colors': '#e74c3c #f1c40f #2ecc71',
        'background-gradient-direction': 'to-bottom',
      },
      edges: {
        width: 10,
        'line-fill': 'linear-gradient',
        'line-gradient-stop-colors': '#8e44ad #3498db',
      },
    };

    // per-element direction/radial exercised on the v3 side only would
    // desync — restrict the shared scene to the sheet-wide config and
    // let the golden cover directions.  Trim the v3 style accordingly:
    const v3Trim = v3Style.filter((_, i) => i === 0 || i === 4);
    const trimmed = elements.filter(
      (e) =>
        (e.data.dir == null && e.data.radial == null) ||
        e.data.id === 'a' ||
        e.data.id === 'b' ||
        e.data.id === 'c' ||
        e.data.id === 'd',
    );

    await runParity(
      page,
      testInfo,
      'parity-gradients',
      trimmed,
      v3Trim,
      v4Style,
      { minInk: 2000 },
    );
  });

  test('parity: custom polygon shapes (round 13 C3)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    // one shared point list (constants-only on the v4 side) over varied
    // node geometry; pure geometry, so the two renderers should agree
    // to the pixel
    const points = '-1 -0.5 0.2 -0.5 0.2 -1 1 0 0.2 1 0.2 0.5 -1 0.5 -0.6 0';
    const elements = [
      { data: { id: 'a' }, position: { x: -100, y: -50 } },
      { data: { id: 'b', wide: 1 }, position: { x: 60, y: -50 } },
      { data: { id: 'c', bordered: 1 }, position: { x: -20, y: 80 } },
    ];
    const shared = {
      shape: 'polygon',
      'shape-polygon-points': points,
      'background-color': '#27ae60',
      'border-color': '#2c3e50',
    };
    const v3Style = [
      {
        selector: 'node',
        style: Object.assign({ width: 70, height: 60 }, shared),
      },
      { selector: 'node[wide = 1]', style: { width: 110 } },
      { selector: 'node[bordered = 1]', style: { 'border-width': 5 } },
    ];
    const v4Style = {
      nodes: Object.assign(
        {
          width: {
            case: [{ when: { data: 'wide', eq: 1 }, then: 110 }],
            else: 70,
          },
          height: 60,
          'border-width': {
            case: [{ when: { data: 'bordered', eq: 1 }, then: 5 }],
            else: 0,
          },
        },
        shared,
      ),
    };

    await runParity(
      page,
      testInfo,
      'parity-polygon',
      elements,
      v3Style,
      v4Style,
      { minInk: 1500 },
    );
  });

  test('parity: pie charts vs the v3 pie-i props (round 23)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    // the same fractions and colors through both prop surfaces: v3's
    // numbered pie-i-background-* vs v4's chart-values list.  Angular
    // slice edges AA differently between the canvas and the SDF, so
    // the bound is looser than pure-geometry scenes.
    const elements = [
      { data: { id: 'full' }, position: { x: -100, y: -50 } }, // full pie
      { data: { id: 'part', partial: 1 }, position: { x: 60, y: -50 } }, // remainder gap
      { data: { id: 'donut', holed: 1 }, position: { x: -20, y: 80 } }, // hole + start angle
    ];
    const colors = ['#e74c3c', '#f1c40f', '#2ecc71', '#3498db'];
    const v3Pie = {
      'pie-1-background-color': colors[0],
      'pie-1-background-size': 40,
      'pie-2-background-color': colors[1],
      'pie-2-background-size': 30,
      'pie-3-background-color': colors[2],
      'pie-3-background-size': 20,
      'pie-4-background-color': colors[3],
      'pie-4-background-size': 10,
    };
    const v3Style = [
      {
        selector: 'node',
        style: Object.assign(
          {
            width: 80,
            height: 80,
            'background-color': '#dfe6e9',
            'pie-size': '100%',
          },
          v3Pie,
        ),
      },
      {
        selector: 'node[partial = 1]',
        style: {
          'pie-3-background-size': 0,
          'pie-4-background-size': 0,
        },
      },
      {
        selector: 'node[holed = 1]',
        style: {
          'pie-hole': '50%',
          'pie-start-angle': '45deg',
        },
      },
    ];
    // list props are constants-only in v4, so per-node value lists ride
    // the data passthrough
    const v4Style = {
      nodes: {
        width: 80,
        height: 80,
        'background-color': '#dfe6e9',
        chart: 'pie',
        'chart-colors': colors.join(' '),
        'chart-values': { data: 'parts' },
        'chart-hole': {
          case: [{ when: { data: 'holed', eq: 1 }, then: 0.5 }],
          else: 0,
        },
        'chart-start-angle': {
          case: [{ when: { data: 'holed', eq: 1 }, then: 0.7853981634 }],
          else: 0,
        },
      },
    };

    elements[0].data.parts = [0.4, 0.3, 0.2, 0.1];
    elements[1].data.parts = [0.4, 0.3];
    elements[2].data.parts = [0.4, 0.3, 0.2, 0.1];

    await runParity(
      page,
      testInfo,
      'parity-charts-pie',
      elements,
      v3Style,
      v4Style,
      {
        minInk: 8000,
        bound: 0.02,
      },
    );
  });

  test('parity: stripe charts vs the v3 stripe-i props (round 23)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    // vertical only, on square nodes: v3's 'horizontal' keyword is
    // inert upstream (the canvas draw switch tests a typo'd 'righward'
    // the style type rejects, so horizontal renders as vertical) and
    // v3's drawStripe swaps W/H in its centering offsets (visible on
    // non-square nodes) — v4's horizontal direction and non-square
    // stripes are pinned by the charts golden instead (recorded)
    const elements = [
      { data: { id: 'v' }, position: { x: -80, y: -40 } },
      { data: { id: 'v2', partial: 1 }, position: { x: 80, y: 40 } },
    ];
    const v3Style = [
      {
        selector: 'node',
        style: {
          width: 90,
          height: 90,
          shape: 'rectangle',
          'background-color': '#dfe6e9',
          'stripe-size': '100%',
          'stripe-direction': 'vertical',
          'stripe-1-background-color': '#e74c3c',
          'stripe-1-background-size': 30,
          'stripe-2-background-color': '#f1c40f',
          'stripe-2-background-size': 30,
          'stripe-3-background-color': '#2ecc71',
          'stripe-3-background-size': 40,
        },
      },
      {
        selector: 'node[partial = 1]',
        style: { 'stripe-3-background-size': 0 },
      },
    ];
    const v4Style = {
      nodes: {
        width: 90,
        height: 90,
        shape: 'rectangle',
        'background-color': '#dfe6e9',
        chart: 'stripes',
        'chart-values': { data: 'parts' },
        'chart-colors': '#e74c3c #f1c40f #2ecc71',
        'chart-direction': 'vertical',
      },
    };

    elements[0].data.parts = [0.3, 0.3, 0.4];
    elements[1].data.parts = [0.3, 0.3]; // the remainder stays unpainted

    await runParity(
      page,
      testInfo,
      'parity-charts-stripes',
      elements,
      v3Style,
      v4Style,
      {
        minInk: 8000,
        bound: 0.02,
      },
    );
  });

  /*
   * Round 55: the arrow tier, which no parity scene had ever exercised.
   *
   * Every curve scene above deliberately sets `arrow-shape: none`,
   * justified as "gap 0 is where v3 and v4 agree" — true, and exactly the
   * configuration in which this round's defects cannot appear.  These
   * three scenes do the opposite.
   *
   * Scale is the whole design.  v3 shortens its drawn line by
   * `arrowShapes[shape].gap(edge)` = 2 x width x arrow-scale for a
   * triangle; at the suite's usual width 3 that is 6 model px, which on a
   * 400x300 canvas is 0.005% — four hundred times under the bound, i.e.
   * invisible.  So these scenes use few elements, thick lines and large
   * heads, and put the affected geometry across the frame.
   */

  /**
   * The three scenes share a graph: four long horizontal edges, i.e.
   * eight arrow ends.  Two rows were not enough for the spill scene —
   * the wedge each end contributes is only ~width^2/2 px, so the count
   * of *ends* is what puts the difference over a bound rather than the
   * size of any one of them.
   */
  const ARROW_ELEMENTS = [
    { data: { id: 'a' }, position: { x: -150, y: -114 } },
    { data: { id: 'b' }, position: { x: 150, y: -114 } },
    { data: { id: 'c' }, position: { x: -150, y: -38 } },
    { data: { id: 'd' }, position: { x: 150, y: -38 } },
    { data: { id: 'f' }, position: { x: -150, y: 38 } },
    { data: { id: 'g' }, position: { x: 150, y: 38 } },
    { data: { id: 'h' }, position: { x: -150, y: 114 } },
    { data: { id: 'i' }, position: { x: 150, y: 114 } },
    { data: { id: 'e1', source: 'a', target: 'b' } },
    { data: { id: 'e2', source: 'c', target: 'd' } },
    { data: { id: 'e3', source: 'f', target: 'g' } },
    { data: { id: 'e4', source: 'h', target: 'i' } },
  ];

  const arrowSheets = (edgeStyle) => ({
    v3Style: [
      {
        selector: 'node',
        style: {
          width: 46,
          height: 46,
          shape: 'ellipse',
          'background-color': '#c0392b',
        },
      },
      { selector: 'edge', style: { 'curve-style': 'straight', ...edgeStyle } },
    ],
    v4Style: {
      nodes: { width: 46, height: 46, 'background-color': '#c0392b' },
      edges: { 'curve-style': 'straight', ...edgeStyle },
    },
  });

  test('parity: the line spills past a narrow arrowhead (round 55)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    /*
     * This scene is named for what it can actually see, which is not what
     * the first draft assumed.
     *
     * The first version used width 20 with `arrow-scale: 3` — a huge head
     * — reasoning that a 120 px gap against a 300 px chord would dominate
     * the frame.  It read **0.495% and passed**, and the reason is worth
     * recording: an opaque filled head *covers its own overlap*.  v3's
     * line stops 120 px behind the tip and v4's runs on to the node
     * centre, but the head spans 137 px back and is opaque, so the two
     * renderers paint the same pixels over almost all of the difference.
     *
     * What remains visible is the wedge near the tip where the head is
     * narrower than the line: the head's half-width grows as k/2 with
     * distance behind the tip, so v4's line pokes out sideways for
     * roughly the first `width` px.  That wedge is ~width^2/2 per end and
     * is what the maintainer described as "a bit of the line peeking out
     * by the triangle point".
     *
     * So the scene is tuned the opposite way from the first draft — a
     * *thick line and a small head*, over four ends — and it is the
     * hollow and translucent scenes below, not this one, that carry the
     * gap's real consequences.
     *
     * Measured 2026-08-06.  First draft, width 20 / scale 3: **0.495%**
     * — passing, i.e. measuring nothing.  Tuned (width 34, scale 1, four
     * edges): **3.537%**.  Control, the same tuned scene with
     * `arrow-shape: none` on both sides: **0.333%**, a 10.6x drop, so
     * what this scene measures is the heads and the line around them
     * rather than ambient node or AA difference.
     */
    const { v3Style, v4Style } = arrowSheets({
      width: 34,
      'arrow-scale': 1,
      'line-color': '#2c3e50',
      'source-arrow-shape': 'triangle',
      'target-arrow-shape': 'triangle',
      'source-arrow-color': '#2c3e50',
      'target-arrow-color': '#2c3e50',
    });

    await runParity(
      page,
      testInfo,
      'parity-arrow-gap',
      ARROW_ELEMENTS,
      v3Style,
      v4Style,
      { minInk: 4000 },
    );
  });

  test('parity: hollow arrowheads show the background, not the line (round 55)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    // v3 erases the arrow footprint (`destination-out`) before painting a
    // hollow head, so its interior shows the page background.  v4 draws a
    // ring over an unshortened line, so its interior shows the line.
    //
    // Measured 2026-08-06: **11.775%**, and the ink counts are the
    // clearest single number in this round — v4 inks 36380 px against
    // v3's 17484, more than double, because the line is visible through
    // every hollow head.
    //
    // Control: `arrow-fill: filled` on both sides reads **0.563%**, a 21x
    // drop, which isolates the fill from the gap.
    const { v3Style, v4Style } = arrowSheets({
      width: 16,
      'arrow-scale': 4,
      'line-color': '#2c3e50',
      'source-arrow-shape': 'triangle',
      'target-arrow-shape': 'triangle',
      'source-arrow-color': '#2c3e50',
      'target-arrow-color': '#2c3e50',
      'source-arrow-fill': 'hollow',
      'target-arrow-fill': 'hollow',
    });

    await runParity(
      page,
      testInfo,
      'parity-arrow-hollow',
      ARROW_ELEMENTS,
      v3Style,
      v4Style,
      { minInk: 3000 },
    );
  });

  test('parity: a translucent edge is one shape, not a line plus an arrow (round 55)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    /*
     * The first scene in the suite to combine `opacity < 1` with an arrow
     * at all.  Where v4's line and head overlap, each contributes its own
     * alpha: 0.5 over 0.5 reads 0.75 against v3's 0.5.  Round 55 measured
     * **26.707%**, the largest divergence anywhere in the parity suite.
     *
     * Retuned in round 56, and the reason is the round's own cautionary
     * case arriving a second time.  At `arrow-scale: 4` each head is 167
     * model px long on a 254 px chord, so the *two heads overlap each
     * other* — and v3 erases before painting each one, which flattens
     * that overlap too.  The scene was therefore reading a
     * head-over-head difference under a name that says line-over-head,
     * and it stayed at 18.6% after the trim landed for that reason
     * alone.  Scale 1.5 keeps the heads clear of one another, so what is
     * left is the compositing this test is named for.
     *
     * The head-over-head case is real and is recorded as a deviation
     * (v4 has no erase pass, so two translucent heads that overlap
     * composite where v3's flatten); it is not this scene's job.
     */
    const { v3Style, v4Style } = arrowSheets({
      width: 18,
      'arrow-scale': 1.5,
      'line-color': '#000',
      'line-opacity': 0.5,
      'source-arrow-shape': 'triangle',
      'target-arrow-shape': 'triangle',
      'source-arrow-color': '#000',
      'target-arrow-color': '#000',
    });

    await runParity(
      page,
      testInfo,
      'parity-arrow-alpha',
      ARROW_ELEMENTS,
      v3Style,
      v4Style,
      { minInk: 3000 },
    );
  });

  /* ----------------------------------------------------------------
   * Round 56: the close-up tier.
   *
   * Every parity scene above this one views its fixture at zoom 1,
   * where an arrowhead is ~30 device px across.  At that size the
   * difference between a correct head and a nearly-correct one is a
   * handful of pixels — inside the anti-aliasing budget the bounds have
   * to allow, which is how round 27 could close "arrow parity" with the
   * line running to the node centre underneath.
   *
   * These scenes render **short edges at high zoom** instead, so the
   * geometry under test fills the frame.  Two properties make that
   * worth doing rather than just bigger:
   *
   *   - **Anti-aliasing is a boundary effect and does not scale.**
   *     Zooming grows the ink roughly quadratically while the AA fringe
   *     stays about a pixel wide, so AA's *share* of the mismatch falls.
   *     A close-up scene can carry a far tighter bound than a zoom-1
   *     one, which is what makes it able to fail.
   *   - **Short edges keep both ends on screen.**  A long edge at zoom 6
   *     puts its ends outside the frame, which would quietly turn an
   *     arrow test into a test of the middle of a line.
   *
   * Each scene records its measured ratio and the control that shows it
   * discriminates.  The bounds are set from those measurements, not
   * from the suite's zoom-1 defaults.
   * ---------------------------------------------------------------- */

  /**
   * Two nodes and one short edge, sized so that at `zoom` the pair fills
   * the 400x300 frame.  `rows` repeats it vertically.
   */
  const closeUpElements = ({ chord = 60, rows = [0] } = {}) =>
    rows.flatMap((y, i) => [
      { data: { id: `s${i}` }, position: { x: -chord / 2, y } },
      { data: { id: `t${i}` }, position: { x: chord / 2, y } },
      { data: { id: `e${i}`, source: `s${i}`, target: `t${i}` } },
    ]);

  /** One look in both dialects, for a close-up edge scene. */
  const closeUpSheets = (nodeStyle, edgeStyle) => ({
    v3Style: [
      {
        selector: 'node',
        style: {
          shape: 'ellipse',
          'background-color': '#c0392b',
          ...nodeStyle,
        },
      },
      { selector: 'edge', style: { 'curve-style': 'straight', ...edgeStyle } },
    ],
    v4Style: {
      nodes: { 'background-color': '#c0392b', ...nodeStyle },
      edges: { 'curve-style': 'straight', ...edgeStyle },
    },
  });

  const CLOSE_UP_NODE = { width: 16, height: 16 };

  test('parity close-up: the gap between the line and a filled head (round 56)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');
    // Measured 2026-08-07, before the trim: **5.610%**, against a
    // no-heads control of 0.573% — a 9.8x drop, so the scene measures
    // the heads and the line around them, not ambient AA.
    /*
     * Tuned, not guessed — and the first draft is worth recording because
     * it repeated round 55's mistake at a higher zoom.
     *
     * Draft: width 6 at `arrow-scale` 1, one edge at zoom 5, reasoning
     * that v3's 12-model-px gap is 60 device px of blank line and could
     * not possibly hide.  It read **0.624%**.  It hides completely: v3
     * sizes the gap so the line stops *under* the head (here a 15.5 px
     * back extent over a 12 px gap), and an opaque filled head paints
     * the same pixels either way.  Magnification does not help, because
     * the thing being measured is covered at every scale.
     *
     * What a filled head does leak is the wedge near the tip, where the
     * head is narrower than the line — so the scene is tuned for that:
     * a *thick* line under a *small* head (the head's half-width only
     * reaches the line's over the last fifth of its length), across
     * three rows because the wedge is per-end and does not grow with
     * zoom the way ink does.
     */
    const { v3Style, v4Style } = closeUpSheets(CLOSE_UP_NODE, {
      width: 12,
      'arrow-scale': 0.45,
      'line-color': '#2c3e50',
      'source-arrow-shape': 'triangle',
      'target-arrow-shape': 'triangle',
      'source-arrow-color': '#2c3e50',
      'target-arrow-color': '#2c3e50',
    });

    await runParity(
      page,
      testInfo,
      'parity-closeup-gap',
      closeUpElements({ chord: 60, rows: [-25, 0, 25] }),
      v3Style,
      v4Style,
      { zoom: 4, minInk: 4000, bound: CLOSE_UP_BOUND.gap },
    );
  });

  test("parity close-up: every arrowhead in v3's vocabulary (round 56)", async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    // Twelve heads, three per row, at zoom 3.  This is the scene that
    // sees a head's *outline* — a clipped corner, a mis-sized bar, a
    // disc centred a radius out — rather than only its overall extent.
    const heads = [
      'triangle',
      'triangle-tee',
      'triangle-cross',
      'triangle-backcurve',
      'vee',
      'chevron',
      'square',
      'diamond',
      'circle',
      'tee',
      'circle-triangle',
      'none',
    ];
    const elements = heads.flatMap((head, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const cx = (col - 1) * 42;
      const y = (row - 1.5) * 24 + 12;

      return [
        { data: { id: `s${i}` }, position: { x: cx - 17, y } },
        { data: { id: `t${i}` }, position: { x: cx + 17, y } },
        { data: { id: `e${i}`, head, source: `s${i}`, target: `t${i}` } },
      ];
    });

    const shared = {
      width: 3,
      'arrow-scale': 0.75,
      'line-color': '#2c3e50',
      'target-arrow-color': '#2c3e50',
    };
    const v3Style = [
      {
        selector: 'node',
        style: { width: 10, height: 10, 'background-color': '#c0392b' },
      },
      { selector: 'edge', style: { 'curve-style': 'straight', ...shared } },
      ...heads.map((head) => ({
        selector: `edge[head = "${head}"]`,
        style: { 'target-arrow-shape': head },
      })),
    ];
    const v4Style = {
      nodes: { width: 10, height: 10, 'background-color': '#c0392b' },
      edges: {
        'curve-style': 'straight',
        ...shared,
        'target-arrow-shape': { data: 'head' },
      },
    };

    await runParity(
      page,
      testInfo,
      'parity-closeup-heads',
      elements,
      v3Style,
      v4Style,
      { zoom: 3, minInk: 4000, bound: CLOSE_UP_BOUND.heads },
    );
  });

  test('parity close-up: hollow heads, where a clipped stroke shows (round 56)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');
    // Measured 2026-08-07, before the trim: **2.555%**, against a
    // `filled` control of 0.137% — an 18.6x drop.

    // A hollow head is the case where the arrow quad's own margin has to
    // hold more than the polygon: the stroke straddles the outline, so it
    // reaches `arrow-width / 2` *outside* it — furthest out at the back
    // corners, which is where the maintainer reported clipping.
    const { v3Style, v4Style } = closeUpSheets(CLOSE_UP_NODE, {
      width: 4,
      'arrow-scale': 2.5,
      'line-color': '#2c3e50',
      'source-arrow-shape': 'triangle',
      'target-arrow-shape': 'triangle',
      'source-arrow-color': '#2c3e50',
      'target-arrow-color': '#2c3e50',
      'source-arrow-fill': 'hollow',
      'target-arrow-fill': 'hollow',
      'source-arrow-width': 5,
      'target-arrow-width': 5,
    });

    await runParity(
      page,
      testInfo,
      'parity-closeup-hollow',
      closeUpElements({ chord: 66 }),
      v3Style,
      v4Style,
      { zoom: 4, minInk: 3000, bound: CLOSE_UP_BOUND.hollow },
    );
  });

  test('parity close-up: plain edges against the node boundary (round 56)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    // No arrows at all: this is the edge-vs-node control for the whole
    // close-up tier.  Three widths on three slopes, magnified — it sees
    // where the line meets the node outline, the extrusion half-width,
    // and the butt cap, none of which any zoom-1 scene resolves.
    // A regression in the trim that shortened an *unarrowed* edge would
    // show here and nowhere else.
    const elements = [
      { data: { id: 'a' }, position: { x: -40, y: -30 } },
      { data: { id: 'b' }, position: { x: 40, y: -30 } },
      { data: { id: 'c' }, position: { x: -40, y: 8 } },
      { data: { id: 'd' }, position: { x: 40, y: 26 } },
      { data: { id: 'f' }, position: { x: -18, y: 44 } },
      { data: { id: 'g' }, position: { x: 30, y: -8 } },
      { data: { id: 'e1', w: 12, source: 'a', target: 'b' } },
      { data: { id: 'e2', w: 6, source: 'c', target: 'd' } },
      { data: { id: 'e3', w: 2, source: 'f', target: 'g' } },
    ];
    const v3Style = [
      {
        selector: 'node',
        style: {
          width: 22,
          height: 22,
          'background-color': '#c0392b',
          'border-width': 2,
          'border-color': '#2c3e50',
        },
      },
      // no arrow props at all: `arrow-shape` is not a property in either
      // library (v3 registers only the four prefixed spellings), and no
      // head is the default on both sides
      {
        selector: 'edge',
        style: { 'curve-style': 'straight', 'line-color': '#16a085' },
      },
      ...[12, 6, 2].map((w) => ({
        selector: `edge[w = ${w}]`,
        style: { width: w },
      })),
    ];
    const v4Style = {
      nodes: {
        width: 22,
        height: 22,
        'background-color': '#c0392b',
        'border-width': 2,
        'border-color': '#2c3e50',
      },
      edges: {
        'curve-style': 'straight',
        'line-color': '#16a085',
        width: { data: 'w' },
      },
    };

    await runParity(
      page,
      testInfo,
      'parity-closeup-edges',
      elements,
      v3Style,
      v4Style,
      { zoom: 3.5, minInk: 4000, bound: CLOSE_UP_BOUND.edges },
    );
  });

  test('parity close-up: curved edges carrying arrowheads (round 56)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');
    // Measured 2026-08-07, before the trim: **0.972%**, against a
    // no-heads control of **0.002%** — a 486x drop.  That control is
    // also the strongest statement in this tier that v4's curve routing
    // is exact: three families, magnified, two pixels apart from v3.

    // The curve families with arrows on, magnified — the combination no
    // scene in the suite had: the curve scenes all set `arrow-shape:
    // none` (round 55's finding), and the arrow scenes are all straight.
    // A trim applied along the wrong direction at a curve's end shows
    // here as a kinked or over-shortened tail.
    const elements = [
      { data: { id: 'a' }, position: { x: -44, y: -34 } },
      { data: { id: 'b' }, position: { x: 44, y: -34 } },
      { data: { id: 'c' }, position: { x: -44, y: 4 } },
      { data: { id: 'd' }, position: { x: 44, y: 4 } },
      { data: { id: 'f' }, position: { x: -44, y: 40 } },
      { data: { id: 'g' }, position: { x: 44, y: 40 } },
      {
        data: { id: 'e1', kind: 'unbundled-bezier', source: 'a', target: 'b' },
      },
      { data: { id: 'e2', kind: 'segments', source: 'c', target: 'd' } },
      { data: { id: 'e3', kind: 'taxi', source: 'f', target: 'g' } },
    ];
    const shared = {
      width: 5,
      'arrow-scale': 1,
      'line-color': '#2c3e50',
      'target-arrow-shape': 'triangle',
      'target-arrow-color': '#2c3e50',
      'source-arrow-shape': 'vee',
      'source-arrow-color': '#2c3e50',
      'control-point-distances': 18,
      'control-point-weights': 0.5,
      'segment-distances': '10 -10',
      'segment-weights': '0.3 0.7',
      'taxi-direction': 'horizontal',
      'taxi-turn': '50%',
    };
    const v3Style = [
      {
        selector: 'node',
        style: { width: 16, height: 16, 'background-color': '#c0392b' },
      },
      { selector: 'edge', style: shared },
      ...['unbundled-bezier', 'segments', 'taxi'].map((kind) => ({
        selector: `edge[kind = "${kind}"]`,
        style: { 'curve-style': kind },
      })),
    ];
    const v4Style = {
      nodes: { width: 16, height: 16, 'background-color': '#c0392b' },
      edges: { ...shared, 'curve-style': { data: 'kind' } },
    };

    await runParity(
      page,
      testInfo,
      'parity-closeup-curves',
      elements,
      v3Style,
      v4Style,
      { zoom: 3, minInk: 4000, bound: CLOSE_UP_BOUND.curves },
    );
  });

  test('parity close-up: layer strokes stop where the drawn line does (round 58)', async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');
    // Measured 2026-08-09: **0.000%** with the trim, **1.535%** with the
    // vsEdgeLayer branch deliberately removed — the control fails by
    // 7.7x the bound.

    // The scene round 58's layer trim needs: a *casing* (line-outline)
    // on short edges carrying filled heads (opaque, so v3's
    // erase-vs-trim compositing deviation stays out of frame),
    // magnified.  Before the trim, v4's layer strokes ran node centre
    // to node centre, so the casing filled the whole gap span behind
    // each head where v3 shows background — per-end ink, which is why
    // three rows.  Casing specifically, because it is the one layer
    // whose *width* the two libraries agree on (edgeWidth +
    // outlineWidth, butt-capped): the first two drafts used an
    // underlay and measured everything but the trim — overlapping big
    // heads land on the recorded erase-overlap deviation (3.160%), and
    // v3's underlay band is 2 x padding wide where v4's is width +
    // 2 x padding (PLAN.md item 27, found by this scene's second
    // draft: 7.105%, all of it band-width and round caps).
    const { v3Style, v4Style } = closeUpSheets(CLOSE_UP_NODE, {
      width: 4,
      'arrow-scale': 0.75,
      'line-color': '#2c3e50',
      'source-arrow-shape': 'triangle',
      'target-arrow-shape': 'triangle',
      'source-arrow-color': '#2c3e50',
      'target-arrow-color': '#2c3e50',
      'line-outline-width': 3,
      'line-outline-color': '#e67e22',
    });

    await runParity(
      page,
      testInfo,
      'parity-closeup-layers',
      closeUpElements({ chord: 66, rows: [-25, 0, 25] }),
      v3Style,
      v4Style,
      { zoom: 4, minInk: 4000, bound: CLOSE_UP_BOUND.layers },
    );
  });

  test("parity close-up: mid arrows sit at v3's four-point midpoint (round 58)", async ({
    page,
  }, testInfo) => {
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');
    // Measured 2026-08-09: **0.000%** with the four-point anchor,
    // **5.580%** with the centre chord deliberately restored — the
    // control fails by 27.9x the bound.  (Both control runs needed
    // `npm run test:playwright:build` first: the first attempt ran the
    // controls against a stale bundle and both scenes stayed green,
    // which is AGENTS.md's silent-stale-bundle trap doing exactly what
    // it warns.)

    // A mid arrow on a straight edge with *asymmetric* end heads: v3
    // anchors it at rs.mid — the mean of the two gap-shortened line
    // ends and the two spacing-shortened arrow points — which the
    // target-only head pulls toward the source.  Before round 58, v4
    // anchored it at the centre chord, a shift of (gap + spacing) / 4
    // model px that magnification turns into most of a head's length.
    // The end head is filled and opaque so only the mid head's
    // placement is in frame.
    const { v3Style, v4Style } = closeUpSheets(CLOSE_UP_NODE, {
      width: 6,
      'arrow-scale': 1.5,
      'line-color': '#2c3e50',
      'target-arrow-shape': 'triangle',
      'target-arrow-color': '#2c3e50',
      'mid-target-arrow-shape': 'triangle',
      'mid-target-arrow-color': '#c0392b',
    });

    await runParity(
      page,
      testInfo,
      'parity-closeup-midarrow',
      closeUpElements({ chord: 66, rows: [-25, 0, 25] }),
      v3Style,
      v4Style,
      { zoom: 4, minInk: 4000, bound: CLOSE_UP_BOUND.midarrow },
    );
  });
});
