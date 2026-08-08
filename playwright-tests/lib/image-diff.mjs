import fs from 'node:fs';
import path from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

/*
Pixel-diff harness for the visual Playwright specs (pixelmatch + pngjs).

Three uses, one toolset:
- self-diffs (e.g. export-vs-screen WYSIWYG): diffPngs on two same-run images;
- v4 golden regressions: compareToGolden against PNGs checked into
  playwright-tests/goldens/, regenerated with UPDATE_GOLDENS=1;
- v3-vs-v4 parity: diffPngs on images rendered live in the same run (both
  sides come from the same machine, so font/AA determinism is a non-issue),
  with maskRects to exclude regions that differ by design (labels).

On failure every comparison writes actual/expected/diff PNGs next to the
test output (attach via testInfo) so the mismatch is inspectable.
*/

// cwd-anchored (Playwright's transpiler rejects import.meta in helpers);
// the test scripts always run from the repo root
export const GOLDENS_DIR = path.resolve(
  process.cwd(),
  'playwright-tests',
  'goldens',
);

/** Decode a PNG buffer (or a base64 data URI) to { width, height, data }. */
export const decodePng = (source) => {
  const buffer =
    typeof source === 'string'
      ? Buffer.from(source.slice(source.indexOf(',') + 1), 'base64')
      : source;

  return PNG.sync.read(buffer);
};

/** Zero out rects ([x, y, w, h]) in a decoded PNG, in place — for masking
 * regions that differ by design (e.g. labels in v3-vs-v4 parity diffs). */
export const maskRects = (png, rects) => {
  for (const [x0, y0, w, h] of rects) {
    for (let y = Math.max(0, y0); y < Math.min(png.height, y0 + h); y++) {
      for (let x = Math.max(0, x0); x < Math.min(png.width, x0 + w); x++) {
        png.data.fill(0, (y * png.width + x) * 4, (y * png.width + x) * 4 + 4);
      }
    }
  }

  return png;
};

/**
 * Diff two decoded PNGs.  `threshold` is pixelmatch's per-pixel color
 * tolerance (0..1); mismatch counts exclude anti-aliased pixels.  Returns
 * { mismatched, ratio, diff } where diff is a decoded PNG of the mismatch
 * map.  Throws when dimensions differ (that is already a failure worth a
 * clearer message than a pixel count).
 */
export const diffPngs = (actual, expected, { threshold = 0.1 } = {}) => {
  if (actual.width !== expected.width || actual.height !== expected.height) {
    throw new Error(
      `Image dimensions differ: ${actual.width}×${actual.height} vs ${expected.width}×${expected.height}`,
    );
  }

  const { width, height } = actual;
  const diff = new PNG({ width, height });
  const mismatched = pixelmatch(
    actual.data,
    expected.data,
    diff.data,
    width,
    height,
    { threshold },
  );

  return { mismatched, ratio: mismatched / (width * height), diff };
};

/** Write actual/expected/diff PNGs for a failed comparison; returns the paths. */
export const writeDiffArtifacts = (dir, name, actual, expected, diff) => {
  fs.mkdirSync(dir, { recursive: true });

  const paths = {
    actual: path.join(dir, `${name}-actual.png`),
    expected: path.join(dir, `${name}-expected.png`),
    diff: path.join(dir, `${name}-diff.png`),
  };

  fs.writeFileSync(paths.actual, PNG.sync.write(actual));
  fs.writeFileSync(paths.expected, PNG.sync.write(expected));
  fs.writeFileSync(paths.diff, PNG.sync.write(diff));

  return paths;
};

/**
 * Compare a decoded PNG against the checked-in golden `name`.  With
 * UPDATE_GOLDENS=1 the golden is (re)written and the comparison passes;
 * without it a missing golden is a failure that says how to create it.
 * On mismatch beyond `maxDiffRatio`, writes actual/expected/diff PNGs
 * into `artifactsDir` (pass testInfo.outputPath('')) and throws.
 *
 * **The default is exact — zero differing pixels** (round 57.1e).  It
 * used to be 0.5%, with eleven label scenes granted 2% on top, and the
 * cost of that was measured rather than guessed: **six** goldens'
 * committed PNGs no longer matched what the code rendered, one by
 * 1.597%, drift accumulated across five label modules and the shaders
 * over a week of green runs.  A tolerance does not make a golden robust,
 * it makes it quiet — and "did this change?" is the only question a
 * golden answers, so a bound that swallows changes leaves it answering
 * nothing.
 *
 * Exact is defensible here because every input is pinned: the visual
 * project pins SwiftShader, Playwright pins the browser, and the label
 * font is vendored through `@fontsource/open-sans` in `node_modules`
 * rather than taken from the system.  Measured over all 45 goldens,
 * repeatedly and at different worker counts: zero differing pixels.
 *
 * So when a browser or driver bump legitimately moves antialiasing, this
 * fails — and that is the intended behaviour.  Look at the diff, and if
 * it is the bump, regenerate and commit.  Do not widen the bound: that
 * is how the six got there.
 */
export const compareToGolden = (
  name,
  actual,
  { threshold = 0, maxDiffRatio = 0, artifactsDir } = {},
) => {
  const goldenPath = path.join(GOLDENS_DIR, `${name}.png`);

  if (process.env.UPDATE_GOLDENS) {
    fs.mkdirSync(GOLDENS_DIR, { recursive: true });
    fs.writeFileSync(goldenPath, PNG.sync.write(actual));

    return { updated: true, ratio: 0 };
  }

  if (!fs.existsSync(goldenPath)) {
    throw new Error(
      `No golden image '${name}'; run the visual specs with UPDATE_GOLDENS=1 to create it ` +
        `(then commit ${path.relative(process.cwd(), goldenPath)})`,
    );
  }

  const expected = decodePng(fs.readFileSync(goldenPath));
  const { mismatched, ratio, diff } = diffPngs(actual, expected, { threshold });

  if (ratio > maxDiffRatio) {
    let where = '';

    if (artifactsDir != null) {
      const paths = writeDiffArtifacts(
        artifactsDir,
        name,
        actual,
        expected,
        diff,
      );

      where = `; see ${paths.diff}`;
    }

    throw new Error(
      `Image differs from the golden '${name}': ${mismatched} px ` +
        `(${(ratio * 100).toFixed(3)}% > ${(maxDiffRatio * 100).toFixed(3)}%)` +
        `${where}.  If the change is intended, regenerate with UPDATE_GOLDENS=1.`,
    );
  }

  return { updated: false, ratio };
};
