import fs from 'node:fs';
import path from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

/** The latest tested capture, independent of the approved reference. */
export const GOLDEN_CURRENT_DIR = path.resolve(
  process.cwd(),
  'playwright-tests',
  'golden-current',
);

// A status build may read while a test is running; never expose half a PNG.
function writeCapture(file, content) {
  const temporary = `${file}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temporary, content);
    fs.renameSync(temporary, file);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

/** Save on every comparison, including passing, missing and mismatched references. */
export function recordGoldenCurrent(name, actual, { dir, threshold }) {
  fs.mkdirSync(dir, { recursive: true });
  writeCapture(path.join(dir, `${name}.png`), PNG.sync.write(actual));
  writeCapture(
    path.join(dir, `${name}.json`),
    JSON.stringify({ testedAt: new Date().toISOString(), threshold }, null, 2) +
      '\n',
  );
}

/** Test comparison: preserve pixelmatch's threshold and antialias handling. */
export function diffPngs(actual, expected, { threshold = 0.1 } = {}) {
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
}

/**
 * Gallery comparison. Neon magenta marks counted pixels; a small halo makes
 * even a one-pixel difference visible on a dimmed grayscale scene. A size
 * change also counts every pixel present in only one of the images.
 */
export function goldenComparison(actual, expected, { threshold = 0 } = {}) {
  const width = Math.max(actual.width, expected.width);
  const height = Math.max(actual.height, expected.height);
  const pad = (source) => {
    const target = new PNG({ width, height });
    PNG.bitblt(source, target, 0, 0, source.width, source.height, 0, 0);
    return target;
  };
  const now = pad(actual);
  const gold = pad(expected);
  const mask = new PNG({ width, height });
  let mismatched = pixelmatch(now.data, gold.data, mask.data, width, height, {
    threshold,
    diffMask: true,
  });
  const sizeChanged =
    actual.width !== expected.width || actual.height !== expected.height;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const inNow = x < actual.width && y < actual.height;
      const inGold = x < expected.width && y < expected.height;
      const alpha = (y * width + x) * 4 + 3;

      if (inNow !== inGold && mask.data[alpha] === 0) {
        mask.data[alpha] = 255;
        mismatched++;
      }
    }
  }

  const diff = new PNG({ width, height });

  for (let i = 0; i < diff.data.length; i += 4) {
    const alpha = now.data[i + 3] / 255;
    const luminance =
      0.2126 * now.data[i] +
      0.7152 * now.data[i + 1] +
      0.0722 * now.data[i + 2];
    const gray = Math.round(
      28 + (luminance * alpha + 255 * (1 - alpha)) * 0.18,
    );
    diff.data.set([gray, gray, gray, 255], i);
  }

  // Paint halos first, then exact pixels, so nearby halos never obscure ink.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask.data[(y * width + x) * 4 + 3] === 0) continue;

      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const hx = x + dx;
          const hy = y + dy;

          if (hx >= 0 && hx < width && hy >= 0 && hy < height) {
            diff.data.set([130, 20, 150, 255], (hy * width + hx) * 4);
          }
        }
      }
    }
  }

  for (let i = 0; i < mask.data.length; i += 4) {
    if (mask.data[i + 3] !== 0) diff.data.set([255, 0, 255, 255], i);
  }

  return { mismatched, diff, sizeChanged };
}
