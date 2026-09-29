# The repository, directory by directory

Where things live and why, for a change that has to be put in the
right place.  Moved out of `AGENTS.md` verbatim in round 108.1 — that file
routes, these files explain.

## The v3/v4 split

- **Round 42 split the repo in two.**  v4 is *the* package and lives at the
  repo root (`src/`, `test/`, `benchmark/`, `debug/`, `playwright-tests/`,
  `scripts/`).  v3 is kept whole, self-contained and buildable in **`v3/`** —
  its own `package.json`, build, tests and documentation site — because the
  comparison benchmarks and the v3-vs-v4 pixel-parity harness run against it.
  Nothing under `src/` imports outside `src/`, and a spec enforces that
  (`test/modules/import-graph.mjs`).  Everything in these notes describes the v4 project
  unless it says otherwise.

## `src/` — v4's source

- `src/`: v4's source — the columnar core and WebGPU renderer (issue #3486).  `src/README.md` is the maintained scope and design-decisions doc; `PLAN.md` (repo root) records each development round and the standing process rules (docs travel with every commit; a closing docs sweep ends every round).
  - `src/core.mts`, `src/collection.mts`: the core facade and the collection API.  Since round 130 each keeps the class — every signature and doc — and delegates its bodies to `src/core/` (batching, elements, query, events, viewport, export, graph-data, serialize, lifecycle, patch, clone, load) and `src/collection/` (see below).
  - `src/store/`: the columnar model — tables, indexes, sidecars, dirty tracking.  `graph-store.mts` is the facade; its curve reads, scans, compound hierarchy, compaction, mutation, layer/channel/image/label/position/flag writers are functions over the store in `src/store/graph-store/` (round 130), and `consumers.mts` there is the store half of the dirty stream's consumer cursors (round 106: the renderer's `takeDelta()` is the primary cursor; any other reader registers its own with `registerConsumer()`).
  - `src/render/`: the WebGPU frame graph, pipelines, shaders, culling, picking.  `renderer.mts` is the facade; the frame, scene, pick, export, force, targets, pipelines and lifecycle bodies are functions over the renderer in `src/render/renderer/` (round 130).
  - `src/interact/`: pointer, wheel and touch gestures.  `pointer.mts` holds the handler's fields and listener wiring; the DOM entry points, the press gesture, the touch gestures, box selection and hover/cursor are flat `pointer-*` siblings (round 130).
  - **A file that outgrew ~1,000 lines keeps its path as the facade and its implementation in a sibling directory of the same name** (round 130), the way `collection.mts` delegates to `src/algorithms/`: `src/render/shaders/` (one shader per file), `src/curve-geometry/` (`bezier`, `route`, `taxi`, `route-quads`), `src/style/` (the parsers, tables, defaults, `applyProp`, `MAPPABLE`, the compile, sheet and reader modules, and `StyleEngine`'s apply/refresh/read/write/txn/bypass/sheet sides as functions over the engine) , `src/animation/` (`handle`, `animation`, `manager` — one class each, listed in `PUBLIC_API` — plus `channels`, `capture`, `apply`), `src/collection/` (`shared`, then one module per section banner: `iteration`, `filtering`, `identity`, `position`, `animation`, `data`, `style`, `bounds`, `edge-geometry`, `state`, `manipulation`, `traversal`, `hierarchy`, `layout`, `degree`) — each facade re-exports what it exported before, and a class facade keeps every signature and doc.
  - **Three entries** (round 131): `src/index.mts` (the full build), `src/headless.mts` (cytoscape/headless: no renderer, no WebGPU code) and `src/headless-gpu.mts` (cytoscape/headless-gpu: the GPU executors, no renderer).  Each calls `createCore` in `src/factory.mts` (`@internal`, the capability seam) with the capabilities it carries, and assigns its own statics (the docs generator reads the full entry's).  Type re-exports live once, in `src/public-exports.mts`.  **A slim entry must not reach a higher tier** — `test/modules/import-graph.mjs` walks every import, type imports included, so a type a lower tier needs lives in that tier.
  - `src/gpu/`: the WebGPU device tier the renderer and cytoscape/headless-gpu share — the force integrator (`gpu-force.mts`), the `wgsl` tag, the WebGPU constants, and the headless force host (round 131.1 moved the first three out of `src/render/`).  The algorithm kernels (`src/algorithms/algo-gpu-*`) are reached only through `src/algorithms/gpu-registry.mts`, which an entry populates from `gpu-lanes.mts`.
  - `src/layout/`, `src/algorithms/`: built-in layouts (incl. the GPU force) and the graph algorithms.  The force family is flat siblings: `force.mts` (the layout object), `force-options`, `force-separate`, `force-run` (one run's preparation and dispatch), `force-executors` (live, worker, GPU), beside `force-sim`, `force-init`, `force-constraints`, `force-remote`, `force-worker` (round 130).
  - `src/style.mts`, `src/style-scales.mts`, `src/style-schemes.mts`: the sheet compiler and the mapper DSL.  `src/style-props.mts` is the property vocabulary — `PROP.BACKGROUND_COLOR` — the one place a property name is spelled (round 127).
  - `src/contract.mts`: the co-signed model↔renderer column/flag layout — change it first when the layout changes.  Column ids are `COL.NODE_POSITION`, never the literal, the reserved data keys are `DATA_ID`/`DATA_PARENT`/`DATA_SOURCE`/`DATA_TARGET`, and the groups are `GROUP_NODES`/`GROUP_EDGES` (`GroupName` derives from them); `test/modules/string-keys.mjs` rejects a literal anywhere else under `src/` (round 127).
  - `src/math.mts`, `src/types.mts`, `src/util/`: v4's own copies of the generic helpers it used to import from v3 (round 42).  `src/math.mts` is deliberately *lean* — the functions v4 calls, not v3's 1500-line geometry module.
  - The `gpu-` prefix survives only where it names the *device* half against a CPU counterpart: `gpu-context.mts`, `src/gpu/gpu-force.mts`, `src/render/gpu-tween.mts`, `src/render/gpu-timer.mts`.  (`gpu-types.mts` was **not** such a case — it holds the public option surface — and became `public-types.mts` in round 42.6.)

## `schemas/` — the shipped JSON schemas

- `schemas/`: the official JSON Schema (draft 2020-12) documents (round 79, #3487) — element, elements, stylesheet, layout options and the options envelope — shipped in the package and exported as `cytoscape/schemas/*.json`.  Hand-written, not generated: `test/modules/schemas.mjs` holds them to the running library (the stylesheet both ways against `PROP` and the compiler, every schema's names against `src/public-types.mts` through the TypeScript checker, paired probes where the library is strict), and `scripts/schemas.mjs` is the shared harness — the placeholder `$id` base (`SCHEMA_BASE`, finalized by round 46), the ajv loader (a devDependency; there is no runtime `validate()`) and the fixture run the status site's schemas page shows.  A round that adds a style property, a layout option or a factory option adds it to the schema, or that spec is red.

## `test/`

- `test/`: `node:test` suites (Mocha-shaped, see above). Add regression coverage here for API and logic changes; `test/modules/` holds internal-only and tooling coverage; `test/soak/` holds the round-48 robustness tier (leaks, churn, wire fuzzing, multi-instance isolation), run by `npm run test:soak` under `--expose-gc`.  `test/runtimes/` holds the round-98 cross-runtime smoke — one framework-free file the `test:runtimes:node`/`test:runtimes:bun`/`test:runtimes:deno` scripts run over the built bundles; see `docs/agents/testing.md`.

## `typescript/`

- `typescript/`: TypeScript-related tests and fixtures (the compile-only consumer test).

## `scripts/` — the repo tooling

- `scripts/`: Repo tooling run by hand or by a spec — the v4 audits (`jsdoc-coverage.mjs`, `throw-coverage.mjs`, `bench-coverage.mjs`), the docs generator (`docs-generate.mjs`, round 45: `npm run docs:api`, gated by `test/docs-generate.mjs` against the shipped declaration), and round 46.5's status site.  `oxlint src scripts` covers this directory since 46.5; it did not before.
  - `scripts/status-build.mjs` + `scripts/status/`: **`npm run status`** builds the gitignored `status/` — a deployable preview of the branch (the debug harness, the benchmark archive, the API reference, the repo documents, the golden gallery).  Split into a pure `buildPlan()` and a writing `executePlan()` so `test/modules/status-site.mjs` can check the intended output without copying 30 MiB of fixtures.  Serve it with `npm run status:serve` (port **3335** — 3333 is v4's harness, 3334 is v3's).
  - `scripts/machine-info.mjs`: `npm run machine` — CPU/cores/clock, RAM, OS, and a GPU *inventory* with VRAM, for benchmark provenance.  Parsers are pure and exported; probes are separate and never throw.
  - `scripts/gpu-info.mjs`: `npm run gpu` — whether the harness-flagged Chromium reaches a real WebGPU adapter, with a one-line HARDWARE / SOFTWARE-ONLY / UNKNOWN verdict.  The card being present and the browser reaching it are different facts; twice a session has read SwiftShader and wrongly concluded "no GPU".  A failed probe reports UNKNOWN (exit 1), never "no GPU".
  - `scripts/benchmark-publish.mjs`: `npm run benchmark:publish` — promotes a local run into the tracked `benchmark/published/`.
  - `scripts/quiet-run.mjs`: the round-101 capture wrapper behind the `:quiet` scripts for tools with no quiet mode (rolldown, oxlint, tsc, playwright install) — green prints nothing, red replays the captured output byte-for-byte and preserves the exit code.  Its `node:test` twin is `test/quiet-reporter.mjs` (failures-only reporter; note in its header why it replays the failing *file's* output, not the failing test's) and its Playwright twin is `playwright-tests/quiet-reporter.mjs`.
  - `scripts/theme.mjs`: the design tokens and `esc`, shared by the benchmark report and the status site so the two read as one system.
  - `scripts/wgsl-minify.mjs`: the round-52 build transform behind the WGSL note in `docs/agents/rendering.md` — `minifyWgslTemplate`/`transformWgslTags` are pure and spec'd (`test/modules/wgsl-minify.mjs`); `wgslMinifyPlugin()` is what `rolldown.config.mjs` wires into every bundle.

## `.github/workflows/`

- `.github/workflows/`: CI and release workflows.  `tests.yml` runs both projects; the three release workflows are still v3's and are **marked as not yet adapted** (round 50 owns them) — they stay at the root only because GitHub reads workflows nowhere else.

## `v3/` — frozen (see `v3/AGENTS.md`)

- `v3/`: Cytoscape.js v3, whole and self-contained — `v3/src/`, `v3/test/`, `v3/benchmark/`, `v3/debug/`, `v3/documentation/`, `v3/playwright-tests/` (port **3334**, so a stray server cannot be mistaken for v4's on 3333), and its own build/tsconfig/package.json.


