/*
Round 16.5: the label shaping cost sweep — pure Node, no GPU.

Measures the shared breaking logic (breakLines / estimateBlock) and the
store-side label write path (setLabel with its dims estimate) at
BENCH_N labels (default 100k), plus the write-refresh case (a mapped
label rewritten by a data write).  Run:

  node --import tsx benchmark/labels.mjs           # 100k
  BENCH_N=20000 node --import tsx benchmark/labels.mjs
*/

import {
  breakLines,
  estimateBlock,
  WRAP_WRAP,
  OFLOW_WHITESPACE,
  JUSTIFY_CENTER,
} from '../src/label-wrap.mjs';
import { computeSdf, SDF_PAD, SDF_RADIUS } from '../src/render/glyph-atlas.mjs';
import { GraphStore } from '../src/store/graph-store.mjs';
import { finishManualRun } from './bench-run.mjs';

const N = Number(process.env.BENCH_N ?? 100000);
const opts = {
  wrap: WRAP_WRAP,
  maxWidth: 80,
  overflowWrap: OFLOW_WHITESPACE,
  justification: JUSTIFY_CENTER,
  lineHeight: 1.2,
};
const adv = (ch) => (ch === ' ' ? 0.28 : 0.54) * 16;

const texts = Array.from(
  { length: N },
  (_, i) => `node ${i} with a label long enough to wrap over lines`,
);

const rows = [];

const time = (label, fn, per = N, unit = 'label') => {
  const t0 = performance.now();
  const out = fn();
  const ms = performance.now() - t0;

  console.log(
    `${label}: ${ms.toFixed(1)} ms (${((ms * 1e6) / per).toFixed(0)} ns/${unit})`,
  );
  rows.push({ label, ms });

  return out;
};

time(`breakLines x ${N}`, () => {
  let lines = 0;

  for (const text of texts) {
    lines += breakLines(text, adv, opts).length;
  }

  return lines;
});

time(`estimateBlock x ${N}`, () => {
  let w = 0;

  for (const text of texts) {
    w += estimateBlock(text, 16, opts).width;
  }

  return w;
});

// the store write path: setLabel + the dims estimate per label
const store = new GraphStore();
const entry = (text) => ({
  text,
  fontSize: 16,
  color: 0xff000000,
  anchorY: 19,
  marginX: 0,
  marginY: 0,
  outlineWidth: 0,
  outlineColor: 0,
  bgColor: 0,
  bgPadding: 0,
  bgShape: 0,
  bgBorderColor: 0,
  bgBorderWidth: 0,
  anchorX: 0,
  halignShift: 0,
  valignShift: 0,
  endOffset: 0,
  minZoomedFontSize: 0,
  rotate: false,
  wrap: 1,
  maxWidth: 80,
  lineHeight: 1.2,
  overflowWrap: 0,
  justification: 1,
});

const slots = time(`addNode x ${N}`, () =>
  texts.map((_, i) => store.addNode('n' + i, i % 1000, i / 1000)),
);

time(`setLabel (build) x ${N}`, () => {
  for (let i = 0; i < N; i++) {
    store.setLabel(slots[i], entry(texts[i]), 'nodes');
  }
});

store.takeLabelDirty('nodes');

time(`setLabel (rewrite) x ${N}`, () => {
  for (let i = 0; i < N; i++) {
    store.setLabel(slots[i], entry(texts[i] + '!'), 'nodes');
  }
});

time(`boundingBox with ${N} label terms`, () => store.boundingBox());

/*
Round 94: the EDT per glyph, both raster tiers.  This is the price of a
tier promotion (and of the em-web first-frame glyph population): the
atlas re-rasters every glyph in use through computeSdf, and tier 2's
cells hold 4x the pixels.  Priced per glyph over a typical Latin cell
(0.55 x 0.95 em of ink plus pads) with a real ink pattern — a filled
block with a hole, so the two EDT passes traverse genuine seed
distributions rather than a degenerate all-zero grid.  GLYPHS scales
the batch to an em-web-sized population, so the row reads as "one full
re-raster costs this".
*/
const GLYPHS = 96;

const sdfRow = (tier) => {
  const cellW = Math.round(0.55 * 32 * tier) + 2 * SDF_PAD * tier;
  const cellH = Math.round(0.95 * 32 * tier) + 2 * SDF_PAD * tier;
  const alpha = new Uint8Array(cellW * cellH);

  for (let y = 4 * tier; y < cellH - 4 * tier; y++) {
    for (let x = 3 * tier; x < cellW - 3 * tier; x++) {
      const hole =
        y > cellH * 0.3 &&
        y < cellH * 0.6 &&
        x > cellW * 0.3 &&
        x < cellW * 0.6;

      alpha[y * cellW + x] = hole ? 0 : 255;
    }
  }

  time(
    `computeSdf tier ${tier} (${cellW}x${cellH}) x ${GLYPHS} glyphs`,
    () => {
      let sum = 0;

      for (let g = 0; g < GLYPHS; g++) {
        const sdf = computeSdf(alpha, cellW, cellH, SDF_RADIUS * tier);

        sum += sdf[0];
      }

      return sum;
    },
    GLYPHS,
    'glyph',
  );
};

sdfRow(1);
sdfRow(2);

// join report.mjs's job table (round 33.10)
finishManualRun(
  'labels',
  rows.map((r) => ({
    name: `labels: ${r.label}`,
    benches: [{ name: 'gpu', ms: r.ms }],
  })),
);
