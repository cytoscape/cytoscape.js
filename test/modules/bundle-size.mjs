import { expect } from 'chai';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

/*
Round 131: what the slim builds weigh, gated.

Two limits per artifact:

- **The budget** — each headless *minified* artifact (what an edge
  deployment ships) is at most 1,000,000 raw bytes, gzip not counted: the
  maintainer's stated ceiling for a Cloudflare Worker script (2026-09-21).
  The assertion names the budget, not the vendor, because vendor limits
  move — Cloudflare's published limits were reported at planning as 3 MB
  free / 10 MB paid, measured *compressed* — so a changed limit is a
  one-line edit here.  The headless builds clear either reading by a wide
  margin, which is why the budget is not the number that does the work.
- **The ratchet** — every slim artifact, raw and gzip (zlib level 9, the
  status site's measure), stays under a measured ceiling.  Initial rows
  allowed about 10% over landing; rounds 126 and 80 re-measured to keep a
  tighter headroom.  This is what catches a tier leak: a renderer module
  reached from a slim entry would add tens of kilobytes at once.  A round
  that grows a slim build on purpose raises its row here, consciously,
  with the reason.

The full build is recorded, not gated: at landing
`cytoscape.esm.min.mjs` was 893,415 bytes, 251,250 gzipped; at round
126, 959,490 / 273,959.

Measured at landing (2026-09-28, Node 24, rolldown 1.1.5):

  cytoscape-headless.esm.min.mjs       525,271 / 161,782
  cytoscape-headless.esm.mjs         1,529,847 / 409,737
  cytoscape-headless.cjs.js          1,529,786 / 409,727
  cytoscape-headless-gpu.esm.min.mjs   604,356 / 180,228
  cytoscape-headless-gpu.esm.mjs     1,682,446 / 445,803
  cytoscape-headless-gpu.cjs.js      1,682,385 / 445,789

**Raised, round 82:** the hull geometry and picking code adds 1.4 KB gzip to the minified headless bundle; the compound-outline shader path adds 2.0 KB gzip to the headless-gpu build.  The headless ESM/CJS rows also add 10 KB raw and 0.5 KB gzip.  The ceilings below include 4–6 KB of room above the new measurements.

**Raised, round 138:** the two unminified headless rows' gzip ceiling,
451,000 -> 456,000.  The device pre-flight is model-side by design —
`cy.add()` throws before the store changes — so `core/gpu-fit.mts`,
`device-fit.mts` and `GpuUnfitError` as a factory static ship in every
build: +1,939 gzip bytes on `cytoscape-headless.esm.mjs` (449,366 ->
451,305), on a row the rounds since landing had already brought to
within 0.4% of its ceiling.  The minified rows still clear theirs
(569,228 / 177,157).

**Re-measured, round 126 (2026-09-29, Node 24.18, rolldown 1.1.5), and
left where they are.**  The rounds since landing grew every slim build
8–9% (rounds 132–141), so the gzip rows stood 0.2–1.4% under
their ceilings — `cytoscape-headless.esm.min.mjs` at 177,594 of 178,000.
Round 126's build transforms (the constant tables inlined, PLAN.md item
63; shader constants spliced; floats shortened) took back 8.8–9.1 KB
raw and 3.2–3.3 KB gzipped per minified artifact:

  cytoscape-headless.esm.min.mjs       562,015 / 174,366  (was 570,845 / 177,594)
  cytoscape-headless.esm.mjs         1,647,619 / 445,183  (was 1,670,830 / 452,900)
  cytoscape-headless.cjs.js          1,647,558 / 445,172  (was 1,670,769 / 452,893)
  cytoscape-headless-gpu.esm.min.mjs   641,040 / 193,039  (was 650,114 / 196,295)
  cytoscape-headless-gpu.esm.mjs     1,800,111 / 481,610  (was 1,824,074 / 489,564)
  cytoscape-headless-gpu.cjs.js      1,800,050 / 481,598  (was 1,824,013 / 489,551)

Landing's rule (size + ~10%) applied to these would *raise* every row
by 14–130 KB, so no row moves: the ceilings stay the tighter gate, with
1.9–3.6% of headroom where there was 0.2–2.2%.  Against round 131's
targets: headless 562,015 against 540 KB (4.1% over), headless-gpu
641,040 against 600 KB (6.8% over).

**Raised, round 80 (2026-10-05, Node 24.18, rolldown 1.1.5).**  The
shared chart scale compiler, signed bars and chart legend add about
16 KB raw / 5 KB gzip to each minified headless entry, and 31 KB raw / 8
KB gzip to each unminified ESM/CJS entry.  Measured against the
word-addressed storage build at `bf8a0dda`:

  artifact                              before raw / gzip       now raw / gzip
  cytoscape-headless.esm.min.mjs          569,581 / 176,604       585,933 / 181,548
  cytoscape-headless.esm.mjs            1,674,021 / 451,552     1,705,230 / 459,260
  cytoscape-headless.cjs.js             1,673,960 / 451,542     1,705,169 / 459,252
  cytoscape-headless-gpu.esm.min.mjs      648,611 / 195,254       664,966 / 200,152
  cytoscape-headless-gpu.esm.mjs        1,826,511 / 488,027     1,857,720 / 495,777
  cytoscape-headless-gpu.cjs.js         1,826,450 / 488,015     1,857,659 / 495,764

The round 80 ceilings kept roughly 1% headroom over its measured landing:
592,000 / 184,000; 1,723,000 / 464,000; and 672,000 / 203,000 for the
minified headless ESM, unminified headless ESM/CJS, and minified GPU
headless ESM respectively; GPU unminified ESM/CJS use 1,877,000 /
501,000.  Both minified artifacts remain below the 1,000,000-byte edge
budget.

**Raised for the combined October 3 implementation (2026-10-05).** After
round 80 charts, round 82 hulls and round 148 miniature geometry were merged,
the six artifacts measured 601,340 / 186,306; 1,739,949 / 468,132;
1,739,888 / 468,122; 680,350 / 204,909; 1,892,439 / 504,546;
and 1,892,378 / 504,535 (raw / gzip, in the order of the rows below).
The combined ceilings keep about 1% headroom; they will be remeasured after
the remaining round 148 consumers land.

Needs the built bundles (`test:modules` builds first).
*/

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));

/** The edge budget: raw bytes of a minified headless artifact. */
export const EDGE_BUDGET = 1_000_000;

/** Per-artifact ceilings, raw and gzip: measured landing plus headroom. */
export const RATCHET = {
  'cytoscape-headless.esm.min.mjs': { raw: 608_000, gzip: 189_000 },
  // round 138: gzip 451,000 -> 456,000 (see the header)
  'cytoscape-headless.esm.mjs': { raw: 1_758_000, gzip: 473_000 },
  'cytoscape-headless.cjs.js': { raw: 1_758_000, gzip: 473_000 },
  'cytoscape-headless-gpu.esm.min.mjs': { raw: 687_000, gzip: 208_000 },
  'cytoscape-headless-gpu.esm.mjs': { raw: 1_912_000, gzip: 510_000 },
  'cytoscape-headless-gpu.cjs.js': { raw: 1_912_000, gzip: 510_000 },
};

/** The minified headless artifacts the edge budget applies to. */
const MINIFIED = Object.keys(RATCHET).filter((f) => f.includes('.min.'));

/**
 * One artifact's sizes.
 *
 * @param {string} file — a basename under build/
 * @returns {{ raw: number, gzip: number }}
 */
const measure = (file) => {
  const buf = readFileSync(join(ROOT, 'build', file));

  return { raw: buf.length, gzip: gzipSync(buf, { level: 9 }).length };
};

/**
 * What exceeds its limits, as messages (empty when within them).
 *
 * @param {string} label — the artifact's name, for the message
 * @param {{ raw: number, gzip: number }} size — the measured sizes
 * @param {{ raw: number, gzip: number }} limit — the ceilings
 * @param {number} [budget] — the raw budget, when it applies
 * @returns {string[]}
 */
export const overruns = (label, size, limit, budget) => {
  const out = [];

  if (budget != null && size.raw > budget) {
    out.push(
      `${label}: ${size.raw} raw bytes exceeds the ${budget}-byte edge budget`,
    );
  }

  if (size.raw > limit.raw) {
    out.push(
      `${label}: ${size.raw} raw bytes exceeds its ratchet ${limit.raw}`,
    );
  }

  if (size.gzip > limit.gzip) {
    out.push(
      `${label}: ${size.gzip} gzip bytes exceeds its ratchet ${limit.gzip}`,
    );
  }

  return out;
};

describe('bundle size: the slim builds (round 131)', function () {
  for (const [file, limit] of Object.entries(RATCHET)) {
    it(`${file} is within its ratchet${MINIFIED.includes(file) ? ' and the edge budget' : ''}`, function () {
      const size = measure(file);

      expect(
        overruns(
          file,
          size,
          limit,
          MINIFIED.includes(file) ? EDGE_BUDGET : undefined,
        ),
      ).to.deep.equal([]);
      // the ratchet is a ceiling, not a guess: a build a third under it
      // means the row is stale (or the walk stopped emitting a tier)
      expect(
        size.raw,
        `${file} shrank far below its ratchet — lower the row`,
      ).to.be.greaterThan(limit.raw * 0.66);
    });
  }

  it('control: the full bundle fails the headless ratchet', function () {
    // the gate can fail: the full minified ESM carries the renderer, the
    // pointer and the kernels, and must overrun the headless row
    const full = measure('cytoscape.esm.min.mjs');
    const failures = overruns(
      'cytoscape.esm.min.mjs',
      full,
      RATCHET['cytoscape-headless.esm.min.mjs'],
      EDGE_BUDGET,
    );

    expect(failures).to.have.length.of.at.least(2);
    expect(failures.join('\n')).to.match(/exceeds its ratchet/);
  });

  it('control: the edge budget is checked on raw bytes', function () {
    expect(
      overruns(
        'x',
        { raw: EDGE_BUDGET + 1, gzip: 1 },
        { raw: 2e6, gzip: 2e6 },
        EDGE_BUDGET,
      ),
    ).to.deep.equal([
      `x: ${EDGE_BUDGET + 1} raw bytes exceeds the ${EDGE_BUDGET}-byte edge budget`,
    ]);
    expect(
      overruns(
        'x',
        { raw: EDGE_BUDGET, gzip: 1 },
        { raw: 2e6, gzip: 2e6 },
        EDGE_BUDGET,
      ),
    ).to.deep.equal([]);
  });
});
