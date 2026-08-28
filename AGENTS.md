# Cytoscape.js AGENTS.md

Guidelines for agents contributing to the Cytoscape.js graph theory and
visualisation library.  **This file routes; the notes in
`docs/agents/` explain.**  It is loaded into every session
before anyone knows what the task is, so it holds only what is true for
every task — the shape of the repo, the commands, and the invariants a
wrong guess breaks silently.  The hard-won lessons behind each area live in
the linked notes, and round 108.1 moved them there verbatim rather than
deleting a word of them.

## Start here: what are you about to do?

| Task | Run | Read first |
| --- | --- | --- |
| Anything under `src/` | `npm run -s verify` while iterating; `npm run -s test:node:quiet` before handing back | [`docs/agents/architecture.md`](docs/agents/architecture.md) |
| Write or change a spec | `npm run -s test:js:quiet` | [`docs/agents/testing.md`](docs/agents/testing.md) — **and run its control** |
| Renderer, shader, gesture or anything drawn | `npm run -s verify`, then `npm run watch` and open the page; `npm run -s test:playwright:quiet` when browser behaviour changes | [`docs/agents/rendering.md`](docs/agents/rendering.md) |
| Add or change a public API member | `npm run -s verify`, `npm run build:types`, `npm run -s test:throws:quiet` | [`docs/agents/documentation.md`](docs/agents/documentation.md) |
| Add or interpret a benchmark | `npm run benchmark` / `npm run benchmark:all` | [`docs/agents/benchmarking.md`](docs/agents/benchmarking.md) |
| Store, wire-format, lifecycle or multi-instance work | also `npm run -s test:soak:quiet` | [`docs/agents/testing.md`](docs/agents/testing.md) |
| Bundle or packaging work | `npm run build`, `npm run build:types`, `npm run -s test:modules:quiet`, `npm run -s test:runtimes:node:quiet` | [`docs/agents/architecture.md`](docs/agents/architecture.md) |
| Change the harness, the docs or the report | `npm run status` then `npm run status:serve` — **open it** | [`docs/agents/rendering.md`](docs/agents/rendering.md) |
| Anything in `v3/` | see `v3/AGENTS.md` — it is frozen | — |
| Broad, or unsure | `npm run -s test:quiet` | this file |

## The shape of the repo

- **v4 is the package and lives at the repo root** (`src/`, `test/`,
  `benchmark/`, `debug/`, `playwright-tests/`, `scripts/`).  Everything
  here describes v4 unless it says otherwise.
- **v3 is kept whole in `v3/`** — its own `package.json`, build, tests and
  documentation site — because the comparison benchmarks and the
  v3-vs-v4 pixel-parity harness run against it.  **Do not change it**
  unless the task says v3; see `v3/AGENTS.md`.
- Nothing under `src/` imports outside `src/`, and a spec enforces that
  (`test/modules/import-graph.mjs`).
- **`src/README.md` is v4's maintained scope / deviations / design
  decisions doc**, and **`PLAN.md` plus `plan/` is the
  development record** — start there, not with v3's site.  The record is
  one file per section under `plan/rounds/`, indexed in
  `plan/INDEX.md`.
- Searches exclude `v3/` by default (the root `.ignore`), because it was
  ~57% of every hit.  To search it deliberately:
  `rg --no-ignore -g 'v3/**' <pattern>` — which is also how to read the v3
  API in JSON form (`rg --no-ignore -e 'cy.on' v3/documentation/docmaker.json`)
  or its prose (`v3/documentation/md/**/*.md`).  Both describe **v3**, and
  v4 deviates deliberately in many places.
- Full directory-by-directory map:
  [`docs/agents/architecture.md`](docs/agents/architecture.md).

## Invariants — a wrong guess here is silent

- **Source is TypeScript ESM (`.mts`) imported through `.mjs` specifiers.**
  Under `src/` every import — in the build config, in tests, between
  modules — spells the extension `.mjs` while the file on disk is `.mts`.
  So `./src/index.mjs` is a real specifier that resolves to
  `src/index.mts`; do not "fix" one into the other.
- **Linting is oxlint, not ESLint; formatting is oxfmt, not Prettier**
  (`npm run lint`, `npm run format`).
- **Tests run on the `node:test` runner**, not Mocha: specs use chai's
  `expect` and a small `describe`/`it`/`beforeEach` shim in
  `test/node-test-setup.mjs`, which is why they look like Mocha suites.
  Browser coverage is Playwright.
- **Bundles are produced with rolldown** (`rolldown -c`, not Rollup) from
  the `./src/index.mjs` entry into UMD, minified UMD, CJS, ESM and
  minified ESM.  v3 has its own `v3/rolldown.config.mjs`.
- **The bundles ship minified WGSL**, so a shader literal carries the
  `wgsl` tag and never holds an interpolation inside a comment —
  [`docs/agents/rendering.md`](docs/agents/rendering.md).
- **Library source of truth is `src/`.**  `build/` and `dist/` are updated
  only via the project scripts.
- Use Node via `.nvmrc` when possible (`nvm use` or `mise en`), and `npm` —
  the repo is configured around `package-lock.json` and its npm scripts.

## The commands

**Every verification script has a `:quiet` twin** (round 101) that prints
**only actual failures**: a green run is zero bytes and the exit code is
the contract.  Invoke them as **`npm run -s <script>`** — `-s` drops npm's
banner on the outer call and on every nested `run-s` child, so a green
composite is zero bytes end to end.  A green `test:node` was ~3,800 lines
of context; its quiet twin is 0.  The loud originals remain for humans
watching progress, for debugging (a quiet run shows nothing until it
finishes — diagnose a hang by rerunning the loud twin) and for CI, whose
logs are the record.  `test/modules/quiet-scripts.mjs` enforces that each
twin is the loud command modulo the reporter flag, so the pairs cannot
drift.

| Command | Time | What it is |
| --- | --: | --- |
| `npm run -s verify` | ~9 s | typecheck + lint + `test:js` — **the inner loop** |
| `npm run -s test:js:one -- test/<f>.mjs` | — | one spec file, with the shim preloaded |
| `npm run -s test:node:quiet` | ~90 s | the gate before handing work back |
| `npm run -s test:quiet` | minutes | the Node tier plus Playwright (the quiet `npm test`) |
| `npm run build` | ~1 s | all bundles; only needed when changing the build |
| `npm run watch` | — | the dev harness at http://localhost:3333/ |
| `npm run status` / `status:serve` | — | the status site (port 3335) |
| `npm run plan:index` | — | regenerate `plan/INDEX.md` after adding a round |

First run in a fresh checkout: `npm install` at the root, and `cd v3 && npm
ci` **only** for the full browser suite — the Node tier (`test:js`,
`test:modules`, `test:soak`, `test:throws`) needs no v3 install.  Browser
coverage also needs `npx playwright install --with-deps`.  The v3-vs-v4
parity diffs need v3's UMD bundle, which `npm run test:playwright` now
builds itself.

## Development flow

- Read the repo docs for the area you are changing before starting
  significant work: `src/README.md`, then the relevant `docs/agents/` note.
- Make your changes; run the narrowest useful loop while iterating
  (`npm run -s verify`), and the relevant verification from the routing
  table before handing work back.
- **Renderer, gesture or grab-state changes: open the page.**  `npm run
  watch`, or a scripted browser that loads `debug/index.html`.  Visual
  regressions are not always caught by the Node suites alone, and round 43
  shipped three defects that a person found in one sitting.
- **Commit in isolated commits, with detailed messages.**  Docs travel
  with the code in the same commit.
- **Closing a round?**  Sweep the round's file in `plan/rounds/` and
  `src/README.md`, run `npm run plan:index`, then **rewrite
  `EXECUTIVE_SUMMARY.md` from the record** — the status site publishes it,
  so a stale summary is the most public thing this repo can get wrong.
  Check `git worktree list` and remove the round's worktree: one left
  behind put 141 of 278 files into `npm pack` and turned `test:modules`
  red.

## Code standards

1. **Formatting is `oxfmt`'s, not yours: run `npm run format`.**
   `.oxfmtrc.json` overrides exactly two defaults — `singleQuote` and
   `printWidth: 80`.  What survives as a *rule* rather than a setting:
   two-space indentation, ESM imports/exports, and concise readable
   functions.  `npm run format:check` is the read-only form.
2. Do not hand-edit generated outputs when a source file exists instead —
   prefer `src/` over `build/`, `dist/` and compiled docs assets.
3. Keep module boundaries aligned with the existing architecture.  New
   source files live near the corresponding subsystem in `src/`.
4. When fixing a bug, add or update a regression test whenever practical.
   Public-behaviour tests in `test/`; internal-only coverage in
   `test/modules/`.
5. For renderer, gesture or grab-state changes, verify behaviour in
   `debug/` — see the flow above.
6. Keep docs in sync with API or behaviour changes: for v4 that means the
   JSDoc on the source and `src/README.md`.  v3's markdown under
   `v3/documentation/md/` is only for v3 changes.
7. Avoid introducing new build tools, frameworks or repo-wide conventions
   unless the task explicitly requires it.
8. When adding new top-level workflows, major directories or important
   source areas not already documented here, update `AGENTS.md`.

## Contribution notes

- Keep changes narrowly scoped.  Cytoscape.js has a large public API and
  small internal regressions can surface broadly.
- Prefer extending existing tests, demos and docs over adding parallel
  mechanisms.
- If a change affects public API semantics, selectors, style behaviour,
  layouts, rendering or documentation structure, call that out explicitly
  in your summary to the user.

## The notes

Each of these is a body of measured experience, not advice.  Read the one
that covers what you are touching — the routing table above says which.

- [`docs/agents/architecture.md`](docs/agents/architecture.md) — the
  repository, directory by directory.
- [`docs/agents/testing.md`](docs/agents/testing.md) — the suites, and what
  a spec has to do to count.
- [`docs/agents/rendering.md`](docs/agents/rendering.md) — the renderer,
  the shaders and the debug harness.
- [`docs/agents/benchmarking.md`](docs/agents/benchmarking.md) — making a
  row measure the thing it is named for.
- [`docs/agents/documentation.md`](docs/agents/documentation.md) — the
  JSDoc gates and the records.

`test/modules/agent-docs.mjs` gates this file's size, every path it names,
and the links between it and the notes.
