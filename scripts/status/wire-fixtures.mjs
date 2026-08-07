// Round 46.5: re-encode a harness fixture into v4's binary wire format.
//
// Measured on the five fetched fixtures (26,173 nodes / 574,515 edges):
//
//   on disk   102.5 MiB      minified json  82.1 MiB      binary  37.5 MiB
//
// and the one that mattered, `ndex-x-large`, goes 34.1 -> 9.5 MiB.  Every
// fixture then sits under Cloudflare Pages' 25 MiB per-file cap, so the deploy
// carries all nine networks itself and needs no off-site bucket and no CORS
// rule on one.
//
// **What this is not.**  Gzipped, binary and minified JSON are within 1% of
// each other (7.6 vs 7.7 MiB), and Cloudflare compresses on the wire anyway.
// The win is the stored file — which is what the cap measures — plus the parse,
// since the page maps typed-array views instead of `JSON.parse`-ing 34 MB.
//
// The encoder runs `debug/fixtures.js`'s own `toGpuElements` first, so the
// buffer holds *normalised* elements and the page's two paths converge: JSON
// goes through `toGpuElements`, binary through `fromColumnar`, and both hand
// the same shape to the sheet builders.  Reusing the harness's converter
// rather than reimplementing it is the same rule round 45 applied to the docs
// generator — a second copy of a transform is a second thing to drift.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createContext, runInContext } from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/** The file extension the wire form ships under. */
export const WIRE_EXT = '.cyge'; // the format's magic is 'CYGE'

let cached = null;
let lib = null;

/**
 * The wire helpers, taken from the **built CJS bundle** rather than from
 * `src/`.
 *
 * Three reasons, in order of weight.  It is the same code the page will decode
 * with, so an encoder/decoder mismatch is impossible by construction.  It keeps
 * the status build free of `.mts` and therefore of tsx, so Cloudflare's plain
 * `npm ci` + `npm run status:all` is enough.  And it keeps the build's import
 * graph out of `src/`, which a spec pins.
 *
 * @returns the factory, or `null` when the bundle has not been built
 * @throws when the bundle exists but predates the wire helpers — a stale
 * build otherwise surfaces as `cy.toColumnarElements is not a function`
 * deep in the encoder, which reads as a defect rather than as "rebuild"
 */
export function wireLib(root) {
  if (lib !== null) {
    return lib;
  }

  const path = join(root, 'build', 'cytoscape.cjs.js');

  if (!existsSync(path)) {
    return null;
  }

  const mod = require(path);
  const cy = mod.default ?? mod;

  if (
    typeof cy.toColumnarElements !== 'function' ||
    typeof cy.serializeElements !== 'function'
  ) {
    throw new Error(
      'build/cytoscape.cjs.js is stale — it lacks the wire helpers; run `npm run build`',
    );
  }

  lib = cy;

  return lib;
}

/** `wireLib`, but a missing bundle is an error with its one fix in the message. */
function requireWireLib(root) {
  const cy = wireLib(root);

  if (cy == null) {
    throw new Error('build/cytoscape.cjs.js is missing — run `npm run build`');
  }

  return cy;
}

/**
 * `debug/fixtures.js`'s exports, loaded the way
 * `test/modules/debug-harness.mjs` loads them: it is a plain browser script
 * declaring a global, not a module.
 */
export function harnessFixtures(root) {
  if (cached != null) {
    return cached;
  }

  // TextDecoder is a browser global `fromColumnar` uses; a bare vm context
  // lacks it, and the failure reads like a defect in the harness rather than
  // a missing sandbox global
  const ctx = createContext({ window: {}, console, TextDecoder });

  runInContext(readFileSync(join(root, 'debug', 'fixtures.js'), 'utf8'), ctx);

  cached = ctx.fixtures;

  return cached;
}

/**
 * Encode one fixture file.
 *
 * @param root — the repo root
 * @param path — the fixture's absolute path
 * @returns a `Uint8Array` of the wire buffer
 */
export function encodeFixture(root, path) {
  const cy = requireWireLib(root);

  const json = JSON.parse(readFileSync(path, 'utf8'));
  const elements = harnessFixtures(root).toGpuElements(json.elements);

  return new Uint8Array(cy.serializeElements(cy.toColumnarElements(elements)));
}

/**
 * The encoded size, or `null` when the fixture itself cannot be encoded.
 *
 * A missing or stale bundle **throws** instead of answering `null`: that is an
 * environment problem with one fix (`npm run build`), and swallowing it here
 * once turned a stale bundle into "the fixture could not be encoded at all"
 * two layers up (2026-08-06).
 */
export function wireSize(root, path) {
  requireWireLib(root); // throws with the rebuild instruction before the try can eat it

  try {
    return encodeFixture(root, path).byteLength;
  } catch {
    return null;
  }
}
