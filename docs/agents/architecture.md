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
  - `src/core.mts`, `src/collection.mts`: the core facade and the collection API.  Since round 130 each keeps the class — every signature and doc — and delegates its bodies to `src/core/` (batching, elements, query, events, viewport, export, graph-data, serialize, lifecycle) and `src/collection/` (see below).
  - `src/store/`: the columnar model — tables, indexes, sidecars, dirty tracking.  `graph-store.mts` is the facade; its curve reads, scans, compound hierarchy, compaction, mutation, layer/channel/image/label/position/flag writers are functions over the store in `src/store/graph-store/` (round 130).
  - `src/render/`: the WebGPU frame graph, pipelines, shaders, culling, picking.  `renderer.mts` is the facade; the frame, scene, pick, export, force, targets, pipelines and lifecycle bodies are functions over the renderer in `src/render/renderer/` (round 130).
  - `src/interact/`: pointer, wheel and touch gestures.
  - **A file that outgrew ~1,000 lines keeps its path as the facade and its implementation in a sibling directory of the same name** (round 130), the way `collection.mts` delegates to `src/algorithms/`: `src/render/shaders/` (one shader per file), `src/curve-geometry/` (`bezier`, `route`, `taxi`, `route-quads`), `src/style/` (the parsers, tables, defaults, `applyProp`, `MAPPABLE`, the compile, sheet and reader modules, and `StyleEngine`'s apply/refresh/read/write/txn/bypass/sheet sides as functions over the engine) , `src/collection/` (`shared`, then one module per section banner: `iteration`, `filtering`, `identity`, `position`, `animation`, `data`, `style`, `bounds`, `edge-geometry`, `state`, `manipulation`, `traversal`, `hierarchy`, `layout`, `degree`) — each facade re-exports what it exported before, and a class facade keeps every signature and doc.
  - `src/layout/`, `src/algorithms/`: built-in layouts (incl. the GPU force) and the graph algorithms.
  - `src/style.mts`, `src/style-scales.mts`, `src/style-schemes.mts`: the sheet compiler and the mapper DSL.  `src/style-props.mts` is the property vocabulary — `PROP.BACKGROUND_COLOR` — the one place a property name is spelled (round 127).
  - `src/contract.mts`: the co-signed model↔renderer column/flag layout — change it first when the layout changes.  Column ids are `COL.NODE_POSITION`, never the literal, the reserved data keys are `DATA_ID`/`DATA_PARENT`/`DATA_SOURCE`/`DATA_TARGET`, and the groups are `GROUP_NODES`/`GROUP_EDGES` (`GroupName` derives from them); `test/modules/string-keys.mjs` rejects a literal anywhere else under `src/` (round 127).
  - `src/math.mts`, `src/types.mts`, `src/util/`: v4's own copies of the generic helpers it used to import from v3 (round 42).  `src/math.mts` is deliberately *lean* — the functions v4 calls, not v3's 1500-line geometry module.
  - The `gpu-` prefix survives only where it names the *device* half against a CPU counterpart: `gpu-context.mts`, `src/render/gpu-force.mts`, `src/render/gpu-tween.mts`, `src/render/gpu-timer.mts`.  (`gpu-types.mts` was **not** such a case — it holds the public option surface — and became `public-types.mts` in round 42.6.)

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


