/*
Round 98.2: the cross-runtime smoke — one file, three runtimes, over the
built bundles.

    node test/runtimes/smoke.mjs
    bun test/runtimes/smoke.mjs
    deno run --allow-read test/runtimes/smoke.mjs

Plain asserts, zero test framework, and zero imports beyond what loading
the bundles requires (`node:module` and `node:url` for the
CJS require; all three runtimes provide both) and its own checks, which
live in `smoke-checks.mjs` since round 131 so the isolate and workerd
hosts run them too — anything more and this file silently becomes a
fourth test tier with its own compat needs.  `test/modules/runtime-smoke.mjs`
lints exactly that, enumerates the npm scripts that wrap this file
(`test:runtimes:node` / `:bun` / `:deno`, each `run-s build …` so a stale
bundle cannot pass for a fresh one), and runs the Node controls.

The exit code is the contract: every assertion is on *values and
ordering*, never on "it didn't throw", because a compat layer can pass a
completion check while handing back a subtly wrong `TextDecoder` — the
round-46.5 defect produced exactly that plausible-looking graph with no
labels, and its dict-as-array control lives on here (`--control=dict-as-array`
must fail, on every runtime).  A bundle that cannot be loaded fails loudly
too (`node smoke.mjs <missing-dir>` is the other control); nothing here
soft-skips.

What runs, per bundle (ESM, minified ESM — what CDN users run — and CJS,
of the full entry and, since round 131, of `cytoscape/headless` and
`cytoscape/headless-gpu`, on all three runtimes; Deno's require-compat held when measured, so CJS
is asserted there too, not skipped): factory + headless init with
`headlessWidth`/`headlessHeight` set (a smoke inheriting 800×600 by luck
tests a different graph); the definition-form load and the wire
round-trip with every dictionary column checked value-for-value; a sheet
with constants, a scale mapper and a bypass read back as *values*; grid
plus a few CPU-force ticks; one sync algorithm and one async through the
promise tier with `executor: 'cpu'` (which also pins microtask ordering);
events, `json()`, and the bypasses section export.  Per build (131):
the slim builds refuse a container with the build's message and carry no
render worker entry; the headless build refuses an explicit `'gpu'` with
its own message, and the GPU builds never give that message.
*/
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import {
  assert,
  assertionCount,
  smokeKind,
  smokeOneBundle,
} from './smoke-checks.mjs';

const args = (globalThis.process?.argv ?? []).slice(2);
const control = args.find((a) => a.startsWith('--control='))?.slice(10);
const dirArg = args.find((a) => !a.startsWith('--'));

/** Resolve a bundle file against build/ or the directory argument. */
const bundleUrl = (file) =>
  dirArg == null
    ? new URL(`../../build/${file}`, import.meta.url)
    : new URL(
        file,
        new URL(
          dirArg.endsWith('/') ? dirArg : `${dirArg}/`,
          new URL(`file://${globalThis.process?.cwd() ?? ''}/`),
        ),
      );

const esm = (url) => import(url.href);
// `createRequire` exists on all three runtimes (Deno's require-compat
// held when measured — 2.9.6), so the CJS bundle is contract, not bonus
const cjs = (url) => ({
  default: createRequire(import.meta.url)(fileURLToPath(url)),
});

const BUNDLES = [
  { file: 'cytoscape.esm.mjs', kind: 'full', load: esm },
  // the minified ESM is what CDN users run; one more import is cheap
  { file: 'cytoscape.esm.min.mjs', kind: 'full', load: esm },
  { file: 'cytoscape.cjs.js', kind: 'full', load: cjs },
  // round 131: the slim entries, each in the three formats it ships
  { file: 'cytoscape-headless.esm.mjs', kind: 'headless', load: esm },
  { file: 'cytoscape-headless.esm.min.mjs', kind: 'headless', load: esm },
  { file: 'cytoscape-headless.cjs.js', kind: 'headless', load: cjs },
  { file: 'cytoscape-headless-gpu.esm.mjs', kind: 'headless-gpu', load: esm },
  {
    file: 'cytoscape-headless-gpu.esm.min.mjs',
    kind: 'headless-gpu',
    load: esm,
  },
  { file: 'cytoscape-headless-gpu.cjs.js', kind: 'headless-gpu', load: cjs },
];

const runtime =
  globalThis.navigator?.userAgent ?? `unknown (${typeof globalThis.Deno})`;

for (const { file, kind, load } of BUNDLES) {
  const url = bundleUrl(file);
  const before = assertionCount();
  let mod;

  try {
    mod = await load(url);
  } catch (cause) {
    throw new Error(
      `smoke: could not load ${url.href} on ${runtime} — run \`npm run build\` first`,
      { cause },
    );
  }

  const cytoscape = mod.default;

  assert(
    typeof cytoscape === 'function',
    `${file}: default export is the factory`,
  );
  await smokeOneBundle(cytoscape, file, control);
  await smokeKind(cytoscape, kind, file);
  console.log(
    `ok ${file} (${assertionCount() - before} assertions) on ${runtime}`,
  );
}
