// Round 104's measurement: how bad the label soup is on the flagship
// fixtures, what the greedy occupancy pass costs at those counts, and
// how much a slow pan strobes the winners with and without hysteresis.
//
//   node --import tsx benchmark/label-declutter.mjs
//   node --import tsx benchmark/label-declutter.mjs --repeat 15
//   node --import tsx benchmark/label-declutter.mjs --only em-web
//
// Headless, through src/ (the pass is renderer-internal, so no bundle
// exports it): the fixtures load with their debug-page sheets at the
// page's canvas size (930 × 900 CSS px, dpr 1) and are fitted.  Each
// label's rect comes from the same helper the label layer uses
// (`nodeLabelRect`) over the store's label dims — the canvas-free
// estimate, so within a few percent of the laid block — and its LOD
// height is 1.3 em, the tallest SDF cell of the vendored face (ink +
// the 2 × 6 px pad, at the 32 px raster).  So the census is the model
// of the drawn set, not a readback from the GPU; the browser spec
// checks the renderer agrees with it.
//
// Sections:
//
//   1. **census** — labels the GPU would draw (the fade and floors
//      applied) at fit and at 2/4/8/16 × fit, under the page sheet and
//      with its `min-zoomed-font-size` floor removed (what an app would
//      do once decluttering exists), and the fraction of them whose
//      rect overlaps another drawn label's — exact rects, a sweep, not
//      the grid.
//   2. **cost** — the pass (`LabelDeclutter.run`, cull mode) at those
//      counts: the first pass (no incumbents) and a settled one, median
//      of --repeat; the order build (the sort) priced on its own.
//   3. **cell size** — shown, *false culls* (a culled label whose rect
//      touches no shown label's: the grid's conservativeness) and cost
//      per cell edge, which is what DECLUTTER_CELL_PX was chosen by.
//   4. **flicker** — 60 frames of a slow pan (0.5 CSS px per frame) and
//      of a slow zoom (0.5% per frame): winners that flip on or off
//      inside the viewport, per variant — a screen-anchored grid without
//      hysteresis (emulated by shifting the model under the model grid
//      by the pan's sub-cell phase), the model-anchored grid without,
//      and with the hysteresis margin.
//
// Priorities are node degree (the GeneMANIA shape: rank from the
// graph), ties by slot.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';
import { performance } from 'node:perf_hooks';
import { cpus } from 'node:os';

import cytoscape from '../src/index.mjs';
import {
  LabelDeclutter,
  DECLUTTER_CULL,
  DECLUTTER_NONE,
  DECLUTTER_CELL_PX,
  DECLUTTER_HYSTERESIS,
  DECLUTTER_INSET_CELLS,
  DECLUTTER_MARGIN_PX,
  nodeLabelRect,
  labelFade,
  fadeScale,
} from '../src/render/label-declutter.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(DIR, '..');
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);

  return i >= 0 ? args[i + 1] : fallback;
};
const REPEAT = Number(opt('--repeat', 9));
const ONLY = opt('--only', null);
const W = 930;
const H = 900;
const LOD_EM = 1.3;
const FADE_PX = 6;

const loadGlobal = (name) => {
  const ctx = createContext({ module: { exports: {} }, console, TextDecoder });

  runInContext(readFileSync(join(ROOT, 'debug', `${name}.js`), 'utf8'), ctx);

  return ctx.module.exports;
};
const networks = loadGlobal('networks');
const fixtures = loadGlobal('fixtures');
const styles = loadGlobal('styles');
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const pct = (a, b) => (b === 0 ? '-' : `${((100 * a) / b).toFixed(1)}%`);

/** The fixture under its page sheet (optionally with the floor off). */
function load(id, floorOff) {
  const def = networks[id];
  const json = JSON.parse(readFileSync(join(ROOT, 'debug', def.url), 'utf8'));
  const elements = fixtures.toGpuElements(json.elements);
  const sheet = styles.sheet('production', id, elements, def);

  if (floorOff) {
    sheet.nodes = { ...sheet.nodes, 'min-zoomed-font-size': 0 };
  }

  const cy = cytoscape({
    headless: true,
    headlessWidth: W,
    headlessHeight: H,
    elements: { nodes: elements.nodes, edges: elements.edges },
    style: sheet,
    layout: { name: 'preset' },
  });

  cy.fit();

  return cy;
}

/** A declutter state filled from the store, as the label layer fills it. */
function fill(cy) {
  const store = cy._store;
  const d = new LabelDeclutter();
  const rect = [0, 0, 0, 0];
  const hi = store.highWater('nodes');

  d.ensure(store.capacity('nodes'));

  for (let slot = 0; slot < hi; slot++) {
    const entry = store.labelAt(slot, 'nodes');
    const dims = store.labelDimsAt(slot, 'nodes');

    if (entry == null || dims == null) {
      continue;
    }

    nodeLabelRect(entry, dims.w, dims.h, rect);
    d.setLabel(
      slot,
      rect[0],
      rect[1],
      rect[2],
      rect[3],
      entry.fontSize * LOD_EM,
      entry.minZoomedFontSize > 0
        ? entry.minZoomedFontSize / entry.fontSize
        : 0,
      cy.nodes()[0] != null ? degreeOf(cy, slot) : 0,
    );
  }

  return d;
}

const degreeCache = new WeakMap();

function degreeOf(cy, slot) {
  let map = degreeCache.get(cy);

  if (map == null) {
    map = new Map();
    cy.nodes().forEach((n) => map.set(n._refs[0].slot, n.degree()));
    degreeCache.set(cy, map);
  }

  return map.get(slot) ?? 0;
}

/** The view for a zoom factor about the fitted centre, plus a pan offset. */
function viewAt(cy, factor, dx = 0, dy = 0) {
  const zoom = cy.zoom() * factor;
  const pan = cy.pan();
  // zoom about the viewport centre, then pan by (dx, dy) CSS px
  const cx = (W / 2 - pan.x) / cy.zoom();
  const cyy = (H / 2 - pan.y) / cy.zoom();
  const px = W / 2 - cx * zoom + dx;
  const py = H / 2 - cyy * zoom + dy;
  const m = DECLUTTER_MARGIN_PX / zoom;

  return {
    zoom,
    zoomDpr: zoom,
    x1: -px / zoom - m,
    y1: -py / zoom - m,
    x2: (W - px) / zoom + m,
    y2: (H - py) / zoom + m,
    fadePx: FADE_PX,
    minPx: 0,
    // the viewport proper, for the census and the flicker count
    vx1: -px / zoom,
    vy1: -py / zoom,
    vx2: (W - px) / zoom,
    vy2: (H - py) / zoom,
  };
}

/** Exact rects of the labels drawn by the last pass, inside the
 * viewport — under `none` the gate admits every label and the GPU's
 * fade and floors decide, so the census applies them (`flags` given). */
function drawnRects(cy, d, view, positions, flags = null) {
  const out = [];
  const store = cy._store;
  const rect = [0, 0, 0, 0];

  for (let slot = 0; slot < store.highWater('nodes'); slot++) {
    if (!d.drawn(slot)) {
      continue;
    }

    if (
      flags != null &&
      !candidate(d, store.labelAt(slot, 'nodes'), slot, view, flags)
    ) {
      continue;
    }

    const entry = store.labelAt(slot, 'nodes');
    const dims = store.labelDimsAt(slot, 'nodes');

    nodeLabelRect(entry, dims.w, dims.h, rect);

    const x = positions[slot * 2];
    const y = positions[slot * 2 + 1];
    const r = [x + rect[0], y + rect[1], x + rect[2], y + rect[3], slot];

    if (
      r[2] < view.vx1 ||
      r[0] > view.vx2 ||
      r[3] < view.vy1 ||
      r[1] > view.vy2
    ) {
      continue;
    }

    out.push(r);
  }

  return out;
}

/** How many rects overlap at least one other (a sweep on x). */
function overlapping(rects) {
  const sorted = [...rects].sort((a, b) => a[0] - b[0]);
  const hit = new Uint8Array(sorted.length);
  const active = [];

  for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i];

    for (let j = active.length - 1; j >= 0; j--) {
      const o = sorted[active[j]];

      if (o[2] < r[0]) {
        active.splice(j, 1);
        continue;
      }

      if (o[1] < r[3] && r[1] < o[3]) {
        hit[i] = 1;
        hit[active[j]] = 1;
      }
    }

    active.push(i);
  }

  return hit.reduce((a, b) => a + b, 0);
}

/** Culled candidates whose rect touches no shown label's rect. */
function falseCulls(cy, d, view, positions, flags) {
  const store = cy._store;
  const rect = [0, 0, 0, 0];
  const shown = drawnRects(
    cy,
    d,
    { ...view, vx1: view.x1, vy1: view.y1, vx2: view.x2, vy2: view.y2 },
    positions,
  );
  let n = 0;

  for (let slot = 0; slot < store.highWater('nodes'); slot++) {
    const entry = store.labelAt(slot, 'nodes');

    if (
      entry == null ||
      d.drawn(slot) ||
      !candidate(d, entry, slot, view, flags)
    ) {
      continue;
    }

    const dims = store.labelDimsAt(slot, 'nodes');

    nodeLabelRect(entry, dims.w, dims.h, rect);

    const x = positions[slot * 2];
    const y = positions[slot * 2 + 1];
    const r = [x + rect[0], y + rect[1], x + rect[2], y + rect[3]];

    if (
      r[2] < view.vx1 ||
      r[0] > view.vx2 ||
      r[3] < view.vy1 ||
      r[1] > view.vy2
    ) {
      continue;
    }

    if (
      !shown.some(
        (o) => o[0] < r[2] && r[0] < o[2] && o[1] < r[3] && r[1] < o[3],
      )
    ) {
      n++;
    }
  }

  return n;
}

/** The pass's membership test, restated (flags aside) for the census. */
function candidate(d, entry, slot, view, flags) {
  const heightPx = entry.fontSize * LOD_EM * view.zoomDpr;
  const zMin =
    entry.minZoomedFontSize > 0 ? entry.minZoomedFontSize / entry.fontSize : 0;

  return (
    (flags[slot] & 1) === 1 &&
    view.zoomDpr >= zMin &&
    labelFade(heightPx, view.fadePx * fadeScale(d.rankOf(slot))) > 0.001
  );
}

const FACTORS = [1, 2, 4, 8, 16];
const IDS = ['em-web', 'ndex-x-large'].filter(
  (id) => ONLY == null || ONLY === id,
);

console.log(
  `\n== label declutter (round 104.1; ${W}×${H} CSS px, dpr 1; ${REPEAT} repeats; ${cpus()[0].model}, Node ${process.version}) ==`,
);

for (const id of IDS) {
  for (const floorOff of [false, true]) {
    const cy = load(id, floorOff);
    const store = cy._store;
    const positions = store.column('node.position');
    const flags = store.column('node.flags');
    const d = fill(cy);
    const t0 = performance.now();

    // the order build alone (the suspect): force a rebuild
    const sortMs = [];

    for (let i = 0; i < REPEAT; i++) {
      d.setLabel(0, ...Array.from(labelRecord(cy, 0)), -1e9 - i);
      const s = performance.now();

      d.rankOf(0);
      sortMs.push(performance.now() - s);
    }
    void t0;

    console.log(
      `\n-- ${id} (${cy.nodes().length} nodes, ${d.count()} labelled; sheet ${floorOff ? 'with min-zoomed-font-size 0' : 'as the page has it'}; fit zoom ${cy.zoom().toFixed(4)}; order build ${median(sortMs).toFixed(2)} ms) --`,
    );
    console.log(
      '   zoom      drawn  overlapping   | cull: shown  culled  overlap  false  | first ms  settled ms',
    );

    for (const factor of FACTORS) {
      const view = viewAt(cy, factor);

      d.run(DECLUTTER_NONE, view, positions, flags);

      const drawn = drawnRects(cy, d, view, positions, flags);
      const over = overlapping(drawn);
      const first = [];
      const settled = [];
      let stats = null;

      for (let i = 0; i < REPEAT; i++) {
        d.run(DECLUTTER_NONE, view, positions, flags); // clears incumbency
        first.push(d.run(DECLUTTER_CULL, view, positions, flags).ms);
        stats = d.run(DECLUTTER_CULL, view, positions, flags);
        settled.push(stats.ms);
      }

      const shownRects = drawnRects(cy, d, view, positions);

      console.log(
        `   ${String(factor).padStart(2)}× fit  ${String(drawn.length).padStart(6)}  ${String(over).padStart(6)} ${pct(over, drawn.length).padStart(6)}  |  ${String(shownRects.length).padStart(10)}  ${String(stats.culled).padStart(6)}  ${String(overlapping(shownRects)).padStart(7)}  ${String(falseCulls(cy, d, view, positions, flags)).padStart(5)}  |  ${median(first).toFixed(2).padStart(8)}  ${median(settled).toFixed(2).padStart(10)}`,
      );
    }

    if (floorOff) {
      // cell size: at the zoom with the most drawn labels
      const best = FACTORS.map((f) => {
        const view = viewAt(cy, f);

        d.run(DECLUTTER_NONE, view, positions, flags);

        return [f, drawnRects(cy, d, view, positions, flags).length];
      }).sort((a, b) => b[1] - a[1])[0][0];
      const view = viewAt(cy, best);

      console.log(
        `   cell size at ${best}× fit (default ${DECLUTTER_CELL_PX} px):`,
      );

      for (const cell of [2, 4, 8, 16, 32]) {
        d.cellPx = cell;
        const ms = [];
        let stats;

        for (let i = 0; i < REPEAT; i++) {
          d.run(DECLUTTER_NONE, view, positions, flags);
          stats = d.run(DECLUTTER_CULL, view, positions, flags);
          ms.push(stats.ms);
        }

        const shown = drawnRects(cy, d, view, positions).length;

        console.log(
          `     ${String(cell).padStart(2)} px: shown ${String(shown).padStart(5)}, false culls ${String(falseCulls(cy, d, view, positions, flags)).padStart(5)}, first pass ${median(ms).toFixed(2)} ms`,
        );
      }

      d.cellPx = DECLUTTER_CELL_PX;

      // flicker: 60 frames of a slow pan and of a slow zoom
      // [name, rank margin, inset cells, screen-anchored]
      const variants = [
        ['screen grid, no hysteresis', 0, 0, true],
        ['model grid, no hysteresis', 0, 0, false],
        ...[0.1, 1].map((h) => [`model grid, rank margin ${h}`, h, 0, false]),
        ...[1, 2].map((c) => [`model grid, inset ${c} cell`, 0, c, false]),
        [
          `model grid, both (default: ${DECLUTTER_HYSTERESIS}, ${DECLUTTER_INSET_CELLS} cell)`,
          DECLUTTER_HYSTERESIS,
          DECLUTTER_INSET_CELLS,
          false,
        ],
      ];

      for (const [motion, frameView] of [
        ['pan 0.5 px/frame', (i) => viewAt(cy, best, 0.5 * i, 0.3 * i)],
        ['zoom 0.5%/frame', (i) => viewAt(cy, best * 1.005 ** i)],
      ]) {
        console.log(`   flicker over 60 frames (${motion}) at ${best}× fit:`);

        for (const [name, h, inset, screen] of variants) {
          d.hysteresis = h;
          d.insetCells = inset;
          d.run(DECLUTTER_NONE, frameView(0), positions, flags);

          let flips = 0;
          let prev = null;
          // transitions per label: a second one is a strobe (on-off-on)
          const turns = new Map();
          const turn = (slot) => turns.set(slot, (turns.get(slot) ?? 0) + 1);
          const moved = new Float32Array(positions.length);

          for (let i = 0; i < 60; i++) {
            const view = frameView(i);
            let pos = positions;
            let v = view;

            if (screen) {
              // a screen-anchored grid is the model grid shifted by the
              // pan's phase: shift the model (and the region) instead
              const cm = DECLUTTER_CELL_PX / view.zoom;
              const panX = -view.vx1 * view.zoom;
              const panY = -view.vy1 * view.zoom;
              const ox = (((panX / view.zoom) % cm) + cm) % cm;
              const oy = (((panY / view.zoom) % cm) + cm) % cm;

              for (let k = 0; k < positions.length; k += 2) {
                moved[k] = positions[k] + ox;
                moved[k + 1] = positions[k + 1] + oy;
              }

              pos = moved;
              v = {
                ...view,
                x1: view.x1 + ox,
                x2: view.x2 + ox,
                y1: view.y1 + oy,
                y2: view.y2 + oy,
                vx1: view.vx1 + ox,
                vx2: view.vx2 + ox,
                vy1: view.vy1 + oy,
                vy2: view.vy2 + oy,
              };
            }

            d.run(DECLUTTER_CULL, v, pos, flags);

            const now = new Set(drawnRects(cy, d, v, pos).map((r) => r[4]));

            if (prev != null) {
              for (const s of now) {
                if (!prev.has(s) && wasInView(s, prev, pos, v, cy)) {
                  flips++;
                  turn(s);
                }
              }

              for (const s of prev) {
                if (!now.has(s) && inView(s, pos, v, cy)) {
                  flips++;
                  turn(s);
                }
              }
            }

            prev = now;
          }

          let strobes = 0;

          for (const n of turns.values()) {
            strobes += Math.max(0, n - 1);
          }

          console.log(
            `     ${name.padEnd(44)} ${String(flips).padStart(6)} flips, ${String(strobes).padStart(6)} strobes (repeat flips of one label)`,
          );
        }
      }

      d.hysteresis = DECLUTTER_HYSTERESIS;
      d.insetCells = DECLUTTER_INSET_CELLS;
    }

    cy.destroy();
  }
}

/** A label newly drawn counts as a flip only if it was already in view
 * (entering the viewport is not a flip). */
function wasInView(slot, _prev, pos, view, cy) {
  return inView(slot, pos, view, cy);
}

function inView(slot, pos, view, cy) {
  const store = cy._store;
  const entry = store.labelAt(slot, 'nodes');
  const dims = store.labelDimsAt(slot, 'nodes');
  const rect = nodeLabelRect(entry, dims.w, dims.h);
  const x = pos[slot * 2];
  const y = pos[slot * 2 + 1];

  // strictly inside, by a label's height, so an edge-crossing is not
  // counted as a flip either
  const m = dims.h;

  return (
    x + rect[0] > view.vx1 + m &&
    x + rect[2] < view.vx2 - m &&
    y + rect[1] > view.vy1 + m &&
    y + rect[3] < view.vy2 - m
  );
}

/** Slot 0's record, re-set with a new priority to force an order build. */
function labelRecord(cy, slot) {
  const store = cy._store;
  const entry = store.labelAt(slot, 'nodes');
  const dims = store.labelDimsAt(slot, 'nodes');
  const rect = nodeLabelRect(entry, dims.w, dims.h);

  return [
    rect[0],
    rect[1],
    rect[2],
    rect[3],
    entry.fontSize * LOD_EM,
    entry.minZoomedFontSize > 0 ? entry.minZoomedFontSize / entry.fontSize : 0,
  ];
}
