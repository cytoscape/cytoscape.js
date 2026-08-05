<img style="width: 200px; height: 200px;" src="https://raw.githubusercontent.com/cytoscape/cytoscape.js/unstable/v3/documentation/img/cytoscape-logo.png" width="200" height="200">

[![GitHub repo](https://img.shields.io/badge/Repo-GitHub-yellow.svg)](https://github.com/cytoscape/cytoscape.js)
[![News and tutorials](https://img.shields.io/badge/News%20%26%20tutorials-Blog-yellow.svg)](https://blog.js.cytoscape.org)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](https://raw.githubusercontent.com/cytoscape/cytoscape.js/master/LICENSE)
[![npm](https://img.shields.io/npm/v/cytoscape.svg)](https://www.npmjs.com/package/cytoscape)
[![Automated tests](https://github.com/cytoscape/cytoscape.js/actions/workflows/tests.yml/badge.svg)](https://github.com/cytoscape/cytoscape.js/actions/workflows/tests.yml)

# Cytoscape.js 4 (in development)

Graph theory (network) library for visualisation and analysis.

**This branch is v4** — the performance redesign specified in
[#3486](https://github.com/cytoscape/cytoscape.js/issues/3486): a
CPU-canonical columnar model (typed-array columns, stable slots, coalesced
dirty spans) written through to persistent GPU buffers, rendered by a WebGPU
pipeline with SDF node shapes, GPU-evaluated style mappers, compute culling
and GPU picking.

v4 is not released yet. **For the released library, use
[cytoscape@3](https://www.npmjs.com/package/cytoscape) and
[js.cytoscape.org](https://js.cytoscape.org).**

## Repository layout

Round 42 made v4 *the* package: v4's source is `src/` at the repo root, and
the entire v3 file set moved into a self-contained `v3/` subproject that still
builds and tests on its own, so comparison benchmarks and the v3-vs-v4 pixel
parity harness keep working against it.

| Path | What it is |
| --- | --- |
| `src/` | v4's source — the columnar core, the WebGPU renderer, layouts, algorithms |
| `src/README.md` | the maintained scope / deviations / design-decisions doc |
| `test/`, `test/modules/` | v4's `node:test` suites |
| `test/soak/` | the robustness tier — leaks, sustained churn, wire-format fuzzing, multi-instance isolation |
| `playwright-tests/` | v4's browser coverage: the `renderer` project, and `visual` (goldens + live v3-vs-v4 parity diffs) |
| `benchmark/` | v4's benchmark suites, most of them measured against v3 |
| `debug/` | the manual dev harness — nine networks, each with a production-grade v4 stylesheet |
| `scripts/` | the audits (JSDoc coverage, throw coverage, benchmark coverage) and the docs generator |
| `v3/` | Cytoscape.js v3, self-contained — its own `package.json`, build, tests and documentation site |
| `MIGRATING.md` | the v3 → v4 porting guide (ships in the package) |
| `CHANGELOG.md` | the 4.0 changelog (ships in the package) |
| `PLAN.md` | the development record: every round's plan and outcome |
| `AGENTS.md` | contributor guidelines |

## Usage

```js
import cytoscape from 'cytoscape';

const cy = cytoscape( {
  container: document.getElementById( 'cy' ),
  elements: [
    { data: { id: 'a' } },
    { data: { id: 'b' } },
    { data: { id: 'ab', source: 'a', target: 'b' } }
  ],
  style: {
    nodes: { 'background-color': '#c0392b', width: 30, height: 30 },
    edges: { width: 3, 'line-color': '#7f8c8d' }
  },
  layout: { name: 'grid' }
} );
```

`import cytoscape from 'cytoscape/gpu'` also resolves, as a deprecated alias
of the same entry point through the prerelease line.

The public type names carry no prefix: `Core`, `Collection`, `Event`,
`Stylesheet`, `CytoscapeOptions` and the rest are all importable as types
from the same entry point.

### Requirements

- **Headless needs no GPU.** Omit `container` and the whole model, style
  engine, layouts and algorithms run in Node.
- **A rendered instance requires WebGPU.** With a `container`, the factory
  throws synchronously when `navigator.gpu` is missing, and `cy.ready` rejects
  when no adapter can be acquired.

v4 is a deliberate break from v3 — no selector strings (structured query
objects and predicates instead), no classes, no z-index, a different
stylesheet shape. **[`MIGRATING.md`](MIGRATING.md) is the porting guide**:
recipe tables per v3 selector form, a measured property-by-property diff
(v4 accepts 153 of v3's 291 style property names), the event names that
register and then silently never fire, and the behaviours that compile and
then differ. [`CHANGELOG.md`](CHANGELOG.md) is the summary.
`src/README.md` records every decision and every accepted deviation.

## Development

```sh
npm install
npm run build        # bundles into build/
npm test             # typecheck, Node suites, soak tier, throw gate, browser specs, lint
npm run test:soak    # leaks, churn, wire fuzzing, isolation (needs --expose-gc)
npm run docs:api     # generate the API reference from the source JSDoc
npm run watch        # the debug harness -> http://localhost:3333
npm run benchmark    # the v3-vs-v4 micro sweep
```

`npm run watch` is the fastest way to see v4 working: pick a network from the
dropdown and it loads with a hand-authored stylesheet, labels and layout, plus
panels for the viewport, layouts, core options, query-object selection and a
live event log.

v3 builds and tests as its own project:

```sh
cd v3
npm install
npm run build
npm test
```

The v3-vs-v4 parity diffs in the `visual` Playwright project need v3's UMD
bundle, so run `cd v3 && npm run build:umd` before them; the specs fail with
that instruction rather than skipping.

See `AGENTS.md` for the full contributor guide and `PLAN.md` for the
development record.

## License

MIT
