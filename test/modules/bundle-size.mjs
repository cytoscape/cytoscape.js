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
  status site's measure), under its size at landing plus ~10% headroom.
  This is what catches a tier leak: a renderer module reached from a slim
  entry would add tens of kilobytes at once.  A round that grows a slim
  build on purpose raises its row here, consciously, with the reason.

The full build is recorded, not gated (its levers — round 126's shader
minification, item 63's constants price — are other rounds'):
at landing `cytoscape.esm.min.mjs` was 893,415 bytes, 251,250 gzipped.

Measured at landing (2026-09-28, Node 24, rolldown 1.1.5):

  cytoscape-headless.esm.min.mjs       525,271 / 161,782
  cytoscape-headless.esm.mjs         1,529,847 / 409,737
  cytoscape-headless.cjs.js          1,529,786 / 409,727
  cytoscape-headless-gpu.esm.min.mjs   604,356 / 180,228
  cytoscape-headless-gpu.esm.mjs     1,682,446 / 445,803
  cytoscape-headless-gpu.cjs.js      1,682,385 / 445,789

Needs the built bundles (`test:modules` builds first).
*/

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));

/** The edge budget: raw bytes of a minified headless artifact. */
export const EDGE_BUDGET = 1_000_000;

/** Per-artifact ceilings, raw and gzip: landing size + ~10%. */
export const RATCHET = {
  'cytoscape-headless.esm.min.mjs': { raw: 578_000, gzip: 178_000 },
  'cytoscape-headless.esm.mjs': { raw: 1_683_000, gzip: 451_000 },
  'cytoscape-headless.cjs.js': { raw: 1_683_000, gzip: 451_000 },
  'cytoscape-headless-gpu.esm.min.mjs': { raw: 665_000, gzip: 199_000 },
  'cytoscape-headless-gpu.esm.mjs': { raw: 1_851_000, gzip: 491_000 },
  'cytoscape-headless-gpu.cjs.js': { raw: 1_851_000, gzip: 491_000 },
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
