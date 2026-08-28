/*
Round 98.2: the cross-runtime smoke — one file, three runtimes, over the
built bundles.

    node test/runtimes/smoke.mjs
    bun test/runtimes/smoke.mjs
    deno run --allow-read test/runtimes/smoke.mjs

Plain asserts, zero test framework, and zero imports beyond what loading
the bundles requires (`node:module` and `node:url` for the
CJS require; all three runtimes provide both) — anything more and this file silently becomes a
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
on all three runtimes; Deno's require-compat held when measured, so CJS
is asserted there too, not skipped): factory + headless init with
`headlessWidth`/`headlessHeight` set (a smoke inheriting 800×600 by luck
tests a different graph); the definition-form load and the wire
round-trip with every dictionary column checked value-for-value; a sheet
with constants, a scale mapper and a bypass read back as *values*; grid
plus a few CPU-force ticks; one sync algorithm and one async through the
promise tier with `executor: 'cpu'` (which also pins microtask ordering);
events, `json()`, and the bypasses section export.
*/
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

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

let assertions = 0;

const assert = (ok, what) => {
  assertions++;

  if (!ok) {
    throw new Error(`smoke assertion failed: ${what}`);
  }
};

const eq = (actual, expected, what) =>
  assert(
    actual === expected,
    `${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );

const near = (actual, expected, what, tol = 1e-9) =>
  assert(
    typeof actual === 'number' && Math.abs(actual - expected) <= tol,
    `${what}: expected ~${expected}, got ${actual}`,
  );

const FIXTURE = () => ({
  nodes: [
    { data: { id: 'a', label: 'alpha', score: 2 }, position: { x: 1, y: 2 } },
    {
      data: { id: 'b', label: 'beta', score: 5 },
      position: { x: 3, y: 4 },
      selected: true,
    },
    // 'alpha' repeats so the label column dictionary-encodes on the wire
    { data: { id: 'c', label: 'alpha', score: 10 }, position: { x: 5, y: 6 } },
  ],
  edges: [
    { data: { id: 'ab', source: 'a', target: 'b', kind: 'x' } },
    { data: { id: 'bc', source: 'b', target: 'c', kind: 'y' } },
  ],
});

const SHEET = () => ({
  nodes: {
    width: 30,
    'background-color': '#ff0000',
    height: {
      data: 'score',
      scale: 'linear',
      domain: [0, 10],
      range: [10, 50],
    },
  },
  bypasses: { b: { width: 55 } },
});

const HEADLESS = { headlessWidth: 640, headlessHeight: 480 };

/**
 * The round-46.5 dict-as-array control: read every dictionary column as if
 * it were a plain array (`col[ i ]` instead of
 * `col.dict[ col.indices[ i ] - 1 ]`), which hands back `undefined` for
 * every string value — the plausible-looking graph with no labels.  The
 * value assertions below must then fail, on every runtime.
 */
const degradeDictColumns = (payload) => {
  for (const group of [payload.nodes, payload.edges]) {
    for (const [key, col] of Object.entries(group.data ?? {})) {
      if (col != null && col.dict != null) {
        group.data[key] = Array.from(col.indices, (_, i) => col[i]);
      }
    }
  }

  return payload;
};

/** Assert the graph the fixture describes, value for value. */
const checkGraph = (cy, label) => {
  eq(cy.nodes().length, 3, `${label}: node count`);
  eq(cy.edges().length, 2, `${label}: edge count`);

  // every dictionary column still carries values — the 46.5 lesson
  eq(cy.$id('a').data('label'), 'alpha', `${label}: a.label`);
  eq(cy.$id('b').data('label'), 'beta', `${label}: b.label`);
  eq(cy.$id('c').data('label'), 'alpha', `${label}: c.label`);
  eq(cy.$id('ab').data('kind'), 'x', `${label}: ab.kind`);
  eq(cy.$id('bc').data('kind'), 'y', `${label}: bc.kind`);

  // the numeric column and the flags column
  eq(cy.$id('c').data('score'), 10, `${label}: c.score`);
  eq(cy.$id('b').selected(), true, `${label}: b.selected`);
  eq(cy.$id('a').selected(), false, `${label}: a.selected`);

  // positions
  eq(cy.$id('a').position().x, 1, `${label}: a.x`);
  eq(cy.$id('c').position().y, 6, `${label}: c.y`);
};

const smokeOneBundle = async (cytoscape, label) => {
  // ── factory + headless init, sizes set explicitly (the standing rule)
  const cy = cytoscape({ ...HEADLESS, elements: FIXTURE(), style: SHEET() });

  eq(cy.width(), 640, `${label}: headlessWidth`);
  eq(cy.height(), 480, `${label}: headlessHeight`);
  checkGraph(cy, `${label}: definition form`);

  // ── the wire round-trip: definition form → buffer → columnar → instance
  const buffer = cytoscape.serializeElements(FIXTURE());

  assert(
    buffer instanceof ArrayBuffer && buffer.byteLength > 0,
    `${label}: serializeElements returns a non-empty ArrayBuffer`,
  );

  const payload = cytoscape.deserializeElements(buffer);

  eq(payload.columnar, true, `${label}: wire payload is columnar`);

  const wired = cytoscape({
    ...HEADLESS,
    elements:
      control === 'dict-as-array' ? degradeDictColumns(payload) : payload,
    style: SHEET(),
  });

  checkGraph(wired, `${label}: wire round trip`);

  // ── style: constants, the scale mapper and the bypass, read as values
  eq(cy.$id('a').width(), 30, `${label}: constant width`);
  eq(cy.$id('b').width(), 55, `${label}: bypass width wins`);
  eq(
    cy.$id('a').style('background-color'),
    'rgb(255,0,0)',
    `${label}: constant colour readback`,
  );
  near(cy.$id('a').height(), 18, `${label}: mapped height (score 2)`);
  near(cy.$id('c').height(), 50, `${label}: mapped height (score 10)`);

  // ── the bypasses section export rides json()
  eq(
    JSON.stringify(cy.json().style.bypasses),
    JSON.stringify({ b: { width: 55 } }),
    `${label}: json().style.bypasses`,
  );

  // ── layouts: grid, then a few CPU-force ticks
  cy.layout({ name: 'grid', fit: false }).run();

  const gridPositions = cy.nodes().map((n) => ({ ...n.position() }));

  assert(
    gridPositions.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)),
    `${label}: grid positions are finite`,
  );
  assert(
    new Set(gridPositions.map((p) => `${p.x},${p.y}`)).size === 3,
    `${label}: grid positions are distinct`,
  );

  await cy
    .layout({ name: 'force', seed: 7, iterations: 5, fit: false })
    .run()
    .promise();

  const forcePositions = cy.nodes().map((n) => ({ ...n.position() }));

  assert(
    forcePositions.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)),
    `${label}: force positions are finite`,
  );
  assert(
    forcePositions.some(
      (p, i) => p.x !== gridPositions[i].x || p.y !== gridPositions[i].y,
    ),
    `${label}: force ticks moved the nodes`,
  );

  // ── algorithms: one sync, one async through the promise tier on the CPU
  const depths = {};

  cy.elements().bfs({
    roots: cy.$id('a'),
    visit: (v, _e, _u, _i, depth) => {
      depths[v.id()] = depth;
    },
  });
  eq(
    JSON.stringify(depths),
    JSON.stringify({ a: 0, b: 1, c: 2 }),
    `${label}: bfs depths`,
  );

  const ranks = await cy
    .elements()
    .pageRank({ iterations: 20, executor: 'cpu' });
  const rank = (id) => ranks.rank(cy.$id(id));

  near(
    rank('a') + rank('b') + rank('c'),
    1,
    `${label}: pageRank ranks sum to 1`,
    1e-6,
  );
  assert(
    rank('c') > rank('b') && rank('b') > rank('a'),
    `${label}: pageRank ranks the directed chain tail > middle > head`,
  );

  // ── events: synchronous dispatch, with extra parameters, in order
  const seen = [];

  cy.on('smoke', (event, extra) => {
    seen.push(['handler', event.type, extra]);
  });
  cy.emit('smoke', ['payload']);
  seen.push(['after-emit']);
  eq(
    JSON.stringify(seen),
    JSON.stringify([['handler', 'smoke', 'payload'], ['after-emit']]),
    `${label}: event dispatch order and arguments`,
  );

  // ── json(): the export carries the values put in
  const json = cy.json();

  eq(json.headless, true, `${label}: json().headless`);
  eq(json.elements.nodes.length, 3, `${label}: json() node defs`);
  eq(json.style.nodes.width, 30, `${label}: json() sheet constant`);

  cy.destroy();
  wired.destroy();
};

const BUNDLES = [
  { file: 'cytoscape.esm.mjs', load: (url) => import(url.href) },
  // the minified ESM is what CDN users run; one more import is cheap
  { file: 'cytoscape.esm.min.mjs', load: (url) => import(url.href) },
  {
    file: 'cytoscape.cjs.js',
    // `createRequire` exists on all three runtimes (Deno's require-compat
    // held when measured — 2.9.6), so the CJS bundle is contract, not bonus
    load: (url) => ({
      default: createRequire(import.meta.url)(fileURLToPath(url)),
    }),
  },
];

const runtime =
  globalThis.navigator?.userAgent ?? `unknown (${typeof globalThis.Deno})`;

for (const { file, load } of BUNDLES) {
  const url = bundleUrl(file);
  const before = assertions;
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
  await smokeOneBundle(cytoscape, file);
  console.log(`ok ${file} (${assertions - before} assertions) on ${runtime}`);
}
