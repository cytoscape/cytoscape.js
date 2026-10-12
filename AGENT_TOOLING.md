# What this repo does to help AI coding agents

An inventory of every mechanism in this repository that exists, wholly or
partly, so that AI coding agents (Claude Code, Codex and similar) work faster,
waste less context and make fewer silent mistakes.  Surveyed 2026-10-12 at
`b13766fb` on `v4`.

Each entry says **what** it is, **where** it lives, **how it helps an agent**,
and **what holds it in place** (the spec or rule that stops it rotting).  A
recurring pattern: almost every convention here is *gated by a spec*, so an
agent that breaks it gets a red test instead of a silent drift.

---

## Contents

1. [Instruction files and routing](#1-instruction-files-and-routing)
2. [Context economy](#2-context-economy)
3. [Fast, narrow feedback loops](#3-fast-narrow-feedback-loops)
4. [Quiet twins: zero-byte green runs](#4-quiet-twins-zero-byte-green-runs)
5. [Conventions enforced by specs](#5-conventions-enforced-by-specs)
6. [The development record (`PLAN.md`, `plan/`)](#6-the-development-record-planmd-plan)
7. [Maintained prose an agent reads before working](#7-maintained-prose-an-agent-reads-before-working)
8. [Process rules written for autonomous work](#8-process-rules-written-for-autonomous-work)
9. [Encoded testing lessons: the "control"](#9-encoded-testing-lessons-the-control)
10. [Verification beyond unit tests](#10-verification-beyond-unit-tests)
11. [Determinism and environment pinning](#11-determinism-and-environment-pinning)
12. [Traps the repo defuses for agents](#12-traps-the-repo-defuses-for-agents)
13. [Agent-harness hygiene](#13-agent-harness-hygiene)
14. [Self-documenting code conventions](#14-self-documenting-code-conventions)
15. [Observations and gaps](#15-observations-and-gaps)

---

## 1. Instruction files and routing

### 1.1 `CLAUDE.md` → `AGENTS.md`

- **What:** `CLAUDE.md` is one line, `@AGENTS.md`, an import.  `AGENTS.md` is
  the single source of agent instructions, readable by any tool that follows
  the `AGENTS.md` convention (Codex etc.) as well as Claude Code.
- **Why it helps:** one file to maintain; no divergence between the
  instructions different agents see.

### 1.2 `AGENTS.md` is a router, not a handbook

- **What:** Since round 108.1 the root file holds only what is true for every
  task: the repo's shape, the commands, and the invariants where a wrong guess
  fails silently.  It opens with a **"what are you about to do?" table** that
  maps a task type to the command to run and the note to read:

  | Task | Run | Read |
  | --- | --- | --- |
  | Anything under `src/` | `verify`, then `test:node:quiet` | `architecture.md` |
  | Write/change a spec | `test:js:quiet` | `testing.md` (and run its control) |
  | Renderer/shader/gesture | `verify`, `watch`, `test:playwright:quiet` | `rendering.md` |
  | Public API | `verify`, `build:types`, `test:throws:quiet` | `documentation.md` |
  | Benchmark | `benchmark` / `benchmark:all` | `benchmarking.md` |
  | Store / wire / lifecycle | + `test:soak:quiet` | `testing.md` |
  | Bundle / packaging | `build`, `build:types`, `test:modules:quiet`, `test:runtimes:node:quiet` | `architecture.md` |
  | Slim entry / tier move | + `test:runtimes:workerd:quiet` (+ Deno GPU) | `architecture.md` |
  | Harness / docs / report | `status` + `status:serve` — open it | `rendering.md` |
  | `v3/` | — frozen | `v3/AGENTS.md` |
  | Unsure | `test:quiet` | — |

- **Why it helps:** an agent picks the narrowest verification for its change
  without reading anything else, and loads the deep notes only when relevant.
- **Held by:** `test/modules/agent-docs.mjs` (see §5.1).

### 1.3 The topic notes, `docs/agents/*.md`

Five files, moved out of `AGENTS.md` *verbatim* in round 108.1 so no lesson
was lost.  Each opens with a title and a "read this before…" sentence.

| Note | Covers |
| --- | --- |
| `architecture.md` | Directory-by-directory map: `src/` subsystems, the three entries and tiers, the facade+sibling-directory split, `schemas/`, `scripts/`, CI, `v3/` |
| `testing.md` | The suites, CI shape, Playwright frame/worker pitfalls, goldens and parity, soak and fuzzing, the throw gate, "specs that test what they say", the quiet twins |
| `rendering.md` | Minified WGSL/GLSL rules, the `debug/` harness and its fixtures, "something has to open the page", GPU adapter verification, worker-font and columnar-payload pitfalls |
| `benchmarking.md` | Suites, `--repeat 3`, harness fingerprints, `--jobs`, pinned Node, rows that measured nothing, `__name`/tsx distortion, v3-side fairness |
| `documentation.md` | `docs/features.csv`, the JSDoc gates (`@throws`/`@param`/`@returns`), stranded doc blocks, `EXECUTIVE_SUMMARY.md` rules, "a plan's claims are claims to re-measure" |

- **Why it helps:** each note is a body of *measured* failures ("rows that
  measured nothing", "a golden only sees what is not painted over"), so an
  agent inherits the project's scar tissue instead of repeating it.

### 1.4 `v3/AGENTS.md` — a "do not touch" fence

- **What:** v3 is kept whole in `v3/` as the baseline for benchmarks and
  pixel parity.  Its own `AGENTS.md` says: don't edit unless the task says v3;
  never "fix" v3 to match v4; read it freely for parity questions; how to
  build it; its port (3334).
- **Why it helps:** `v3/CLAUDE.md` (`@AGENTS.md`) makes Claude Code load the
  fence when it reads files under `v3/`, so an agent wandering there is
  stopped before moving the baseline every parity claim depends on.

### 1.5 Pointers from human docs

`README.md` and `CONTRIBUTING.md` both point to `AGENTS.md` and
`src/README.md`, so agents that start from the README land in the same place.

---

## 2. Context economy

### 2.1 A byte budget on `AGENTS.md`

- **What:** `test/modules/agent-docs.mjs` caps `AGENTS.md` at **16 KiB**.  The
  spec's header records why: it had grown to 62,818 bytes (~15.7k tokens),
  and "an agent fixing a typo in a benchmark comment read the golden-image
  tolerance history, the SwiftShader worker ratio and a Fedora `libjpeg.so.8`
  recipe."
- **Why it helps:** a fixed, small per-session tax; new lessons must go to a
  note, not the root.

### 2.2 `.ignore` hides `v3/` from searches

- **What:** a root `.ignore` (read by ripgrep/fd, not git) excludes `v3/`,
  `status/`, `test-results/`, `playwright-report/`.  Its comment gives the
  measurement: v3 was ~57% of repo-wide hits (`style` 457 vs 189 outside v3).
  `AGENTS.md` and `v3/AGENTS.md` give the escape hatch:
  `rg --no-ignore -g 'v3/**' <pattern>`.
- **Why it helps:** agent searches (Grep/Glob tools use ripgrep) return the
  codebase being worked on, not a frozen copy of the old one.

### 2.3 Quiet twins

See §4.  A green `test:node` was ~3,800 lines of context; its quiet twin is 0.

### 2.4 The record split into small files

- **What:** `PLAN.md` was a 1.5 MB append log.  Since round 108.2 each round
  is its own file in `plan/rounds/` (193 today); `PLAN.md` keeps only the
  standing sections (process rules, open calls).  `plan-record.mjs` gates
  "PLAN.md itself readable in one sitting" with a byte budget.
- **Why it helps:** an agent reads or amends one round's file without loading
  the history; edits are small and local instead of blind appends.

### 2.5 Generated index instead of browsing

`plan/INDEX.md` (generated) lists every section with round, date, kind and
title, plus a derived landed/planned table — one read answers "what's the
state of round N?".

### 2.6 v3 API as JSON

`v3/documentation/docmaker.json` is pointed to as the greppable v3 API, so a
parity question is one targeted search, not a site crawl.

---

## 3. Fast, narrow feedback loops

### 3.1 The inner loop: `npm run -s verify`

- **What:** `typecheck` + `lint` + `test:js` in one command, documented as
  ~9 s (§15 notes a 29 s measurement today).  `verify:quiet` is the zero-output
  form.
- **Why it helps:** a cheap whole-picture check an agent can run after every
  edit.

### 3.2 One spec file: `npm run -s test:js:one -- test/<f>.mjs`

- **What:** the tier's own invocation minus the glob, with the
  `describe`/`it` shim preloaded.  Accepts `--test-name-pattern`.
- **Why it helps:** a hand-rolled `node --test test/foo.mjs` dies with
  `ReferenceError: describe is not defined`; this removes the guesswork
  (`testing.md` documents exactly that failure).

### 3.3 Isolated suites

| Script | What it runs |
| --- | --- |
| `test:js` | public-behaviour specs in `test/*.mjs` |
| `test:modules` | internal + tooling specs in `test/modules/` (builds first) |
| `test:soak` | leaks, churn, wire fuzzing, multi-instance isolation, `--expose-gc` |
| `test:throws` | throw-site coverage gate |
| `test:types`, `test:types:surface`, `test:types:all` | consumer compile test, `.d.ts` surface audit |
| `test:runtimes:node` / `:bun` / `:deno` / `:deno:gpu` / `:workerd` | the built bundles under each runtime |
| `test:playwright` | browser projects (renderer, renderer-webkit, visual) |
| `test:node` | the whole Node tier (CI's `ci-node`) |
| `test` | Node tier + Playwright |
| `test:js:debug`, `test:modules:debug` | `--inspect-brk`, single concurrency |
| `lint`, `typecheck`, `format:check` | each alone |

- **Why it helps:** an agent can verify exactly the area it touched, and the
  routing table tells it which.

### 3.4 Sub-second builds

- **What:** rolldown builds every bundle in ~1 s; `build:esm`, `build:cjs`,
  `build:umd`, `build:min` build one format; `watch` rebuilds the UMD only.
- **Why it helps:** suites that need a bundle (`test:modules`,
  `test:runtimes:*`, `test:playwright`) can afford to **build for
  themselves**, which removes ordering and staleness bugs (§12).

### 3.5 No v3 install for the Node tier

The Node tier needs only the root `npm install`; `v3/` needs `npm ci` only for
the browser suite.  `benchmark/bench-size.mjs` exists so specs can read run
sizes without importing (and evaluating) v3.  CI's `ci-node` deliberately does
no v3 install so an accidental dependency fails loudly.

### 3.6 Per-tool diagnostic scripts

- `npm run -s gpu` — does the harness browser reach a real WebGPU adapter?
  HARDWARE / SOFTWARE-ONLY / UNKNOWN, never "no GPU" on a failed probe.
- `npm run machine` — CPU/RAM/OS/GPU inventory for benchmark provenance.
- `node scripts/jsdoc-coverage.mjs --verbose`, `node scripts/throw-coverage.mjs
  --verbose`, `node scripts/bench-coverage.mjs --verbose`,
  `node --import tsx scripts/golden-coverage.mjs --verbose` — the audits as
  readable lists.
- `npm run plan:index -- --check` — is the index current?

---

## 4. Quiet twins: zero-byte green runs

- **What (round 101):** every verification script has a `:quiet` twin —
  `typecheck:quiet`, `lint:quiet`, `build:quiet`, `test:js:quiet`,
  `test:modules:quiet`, `test:soak:quiet`, `test:throws:quiet`, every
  `test:runtimes:*:quiet`, `test:playwright:quiet`, and the composites
  `verify:quiet`, `test:node:quiet`, `test:quiet`.  A green run prints
  **nothing**; the exit code is the contract.  A red run prints only the
  failures.
- **How:**
  - `test/quiet-reporter.mjs` — a failures-only `node:test` reporter.  It
    replays the failing *file's* output (the header explains why: stdout
    events can't be attributed to a test).
  - `playwright-tests/quiet-reporter.mjs` — the Playwright twin.
  - `scripts/quiet-run.mjs` — a capture wrapper for tools with no quiet mode
    (tsc, oxlint, rolldown, `playwright install`): silent on 0, byte-for-byte
    replay and same exit code on non-zero.
  - `npm run -s` — measured to drop npm's banner on the outer call *and* every
    nested `run-s` child, so a composite is zero bytes end to end.
- **Deliberate limits:** the loud twins remain for humans, hang diagnosis
  and CI (whose logs are the record); `:debug` scripts have no quiet twin.
- **Held by:** `test/modules/quiet-scripts.mjs` — every twin must equal its
  loud command modulo the reporter flag or `quiet-run` prefix, every
  `*:quiet` must be registered, and every composite step must resolve to a
  quiet script.  The pairs cannot drift.

---

## 5. Conventions enforced by specs

The repo turns "please remember to…" into failing tests.  An agent does not
need to know a convention to be told when it breaks one.

### 5.1 Agent docs — `test/modules/agent-docs.mjs`

`AGENTS.md` within budget; every note linked from it and every link resolves;
**every path named in `AGENTS.md` and the notes resolves on disk** (round 42's
lesson: grep-based doc sweeps fix only the spellings you thought of); an
allowlist of quoted historical spellings that must *not* resolve; **every npm
script named exists**; the verification scripts an agent is meant to run are
actually routed; each note opens with a title and a reason to read it.

### 5.2 The record — `test/modules/plan-record.mjs`

Filename shape `YYYY-MM-DD-NN-rndRRRR-kind-slug.md`, contiguous `NN` per date;
headings must not repeat what the filename says; every file starts with its
`##` heading; `plan/INDEX.md` matches the files; every section linked once;
`PLAN.md` within its size budget; a `plan` file can't declare its own landing
and a round can't be both `plan` and `landed`; the derived landed/planned
table is published; every section has a `**Depends on:**` line naming only
*earlier* nodes; `debug/network-plan.json` is current.

### 5.3 Module boundaries — `test/modules/import-graph.mjs`

Nothing under `src/` imports outside `src/`; a slim entry
(`src/headless.mts`, `src/headless-gpu.mts`) must not reach a higher tier,
type imports included.

### 5.4 String vocabularies — `test/modules/string-keys.mjs`

Column ids, style property names, reserved data keys and group names must be
the constants (`COL.*`, `PROP.*`, `DATA_*`, `GROUP_*`), never literals, under
`src/`.  The walker is comment/string/regex-aware, carries planted controls,
and **pins how many files it walked** so a scanner that stops early can't pass.

### 5.5 Docs on the source

- `test/jsdoc-coverage.mjs` + `scripts/jsdoc-coverage.mjs` — every public
  member documented; `@throws` required where the body throws, `@param` where
  it takes arguments, `@returns` gated.
- `test/modules/jsdoc-returns.mjs`, `jsdoc-stranded.mjs` (report-only
  stranded-block detector), `internal-tag.mjs` (`@internal` stripping from the
  `.d.ts`).
- `test/docs-generate.mjs` — the API model generator against the shipped
  declaration.

### 5.6 Error contract — `npm run test:throws`

`scripts/throw-coverage.mjs` gates at **zero tolerance**: every Node-reachable
`throw new` in `src/` must be fired by a spec in `test/`; exemptions
(`UNREACHABLE`/`MISATTRIBUTED`) need a reason and must still point at a throw.

### 5.7 Inventories held to the code

| Spec | Holds |
| --- | --- |
| `test/modules/schemas.mjs` | hand-written `schemas/*.json` both ways against `PROP`, the compiler and `public-types.mts` — a new style property/layout option/factory option fails until it is in the schema |
| `test/modules/feature-inventory.mjs` | `docs/features.csv` coverage against the generated API and style registries |
| `test/modules/migration-guide.mjs` | `MIGRATING.md`'s property table against the running library |
| `test/modules/layout-options-panel.mjs` | the debug page's options table against every layout option interface |
| `test/modules/gesture-inventory.mjs` | every emitted gesture event is inventoried; cited spec titles exist |
| `test/modules/gesture-traces.mjs` | trace scripts, records, inventory and comparator agree |
| `test/modules/golden-coverage.mjs` | pins how many style properties no golden exercises |
| `test/modules/bundle-size.mjs` | slim-build size budget and per-artifact ratchet |
| `test/modules/packaging.mjs` | what `npm pack` ships, and that the manifest points at real files |
| `test/modules/debug-harness.mjs` | every debug fixture exists at the fetched path; every sheet compiles against its data |
| `test/modules/runtime-smoke.mjs` | the cross-runtime smoke never soft-skips; its controls fail |
| `test/modules/status-site.mjs` | the status site's intended output |
| `test/modules/wgsl-minify.mjs`, `wgsl-identifiers.mjs`, `const-inline.mjs` | the shader build transforms |

### 5.8 Lint and format are tools, not taste

oxlint (`.oxlintrc.json`, explicit rule list) and oxfmt (`.oxfmtrc.json`
overrides only `singleQuote` and `printWidth: 80`).  `AGENTS.md` says
"formatting is oxfmt's, not yours: run `npm run format`", removing style
judgement from agent output.  TypeScript runs `strict`.

---

## 6. The development record (`PLAN.md`, `plan/`)

Designed so many agent sessions, over months, can continue one project
coherently.

### 6.1 One file per round section

`plan/rounds/YYYY-MM-DD-NN-rndRRRR-kind-slug.md`.  The filename carries date,
order, round number and **kind** (`plan`, `landed`, `note`); the heading
carries only the title.  A planned round's file is renamed `plan`→`landed`
when it ships, so the record's state is readable from `ls`.

### 6.2 Derived state, never typed

`npm run plan:index` (`scripts/plan-index.mjs`, `scripts/plan-record.mjs`)
generates `plan/INDEX.md`: every section, plus which rounds have landed vs are
planned — derived from filenames, so it cannot go stale.

### 6.3 Dependency lines and the `plan-deps` scene

Every section carries `**Depends on:** 30, 112, 2026-08-06-02` (or `none`):
real prerequisites, not mentions.  `plan:index` turns them into
`debug/network-plan.json`, drawn by the debug harness as the `plan-deps`
scene.  An agent can see what a round rests on before changing its premise.

### 6.4 `PLAN.md`: standing sections only

The intro (including an explicit warning that a record of closed rounds
"reads optimistically by construction"), the **Process** rules (§8), and
**"Open calls for the maintainer"**: scope calls and *contradictions between
code and the decided-design ledger*.

### 6.5 Interview notes and the open-questions register

Maintainer decisions from design interviews are recorded as `note` sections
(`2026-10-03 alpha design interview`, `2026-10-06 alpha contract interview`),
with a topic-organised register of what is still unanswered
(`2026-10-11 … open questions`).  `PLAN.md` states that explicit interview
answers supersede older alternatives.  An agent can distinguish "decided"
from "proposed" from "open".

### 6.6 `EXECUTIVE_SUMMARY.md`

The five-minute version, by calendar week, in outcomes not file names;
rewritten from the record when a round closes.  Rules: **restate, don't
append**; **re-measure every figure**; an item leaves the open table when
*decided*, not when scheduled.  It carries its own "How to maintain this file"
section.  It is published on the status site, so `AGENTS.md` calls a stale
one "the most public thing this repo can get wrong".

### 6.7 Commit messages as record

Commits are isolated and detailed: what changed, why, which gates were added,
what was validated and what *couldn't* be (e.g. "visual report review was
unavailable because the computer connector exposes no browser").  Agent
commits carry a `Claude-Session:` trailer linking the session.

---

## 7. Maintained prose an agent reads before working

| File | Role |
| --- | --- |
| `src/README.md` (~8,900 lines) | v4's scope, deviations from v3 and design decisions, by subsystem and round — "the best thing to read before changing anything" |
| `docs/features.csv` (~960 rows) | Feature inventory: status, limitations, replacements, a cited `Reference`; published as the status site's Features page |
| `docs/feature-direction.md` | What "Proposed" in the CSV means (analysis, not approval) |
| `MIGRATING.md`, `CHANGELOG.md` | Shipped with the package; the former is spec-checked |
| `schemas/*.json` | Machine-readable contracts for elements, stylesheets, layouts, options |
| `dist/cytoscape.d.ts` | Generated declarations carrying the JSDoc as hover text |
| `v3/documentation/docmaker.json`, `md/**` | v3's API and prose, for parity questions |

`documentation.md` adds a meta-rule: **a plan's statements about the code are
claims to re-measure, not facts to build on**, with three consecutive rounds
that tripped on stale ones.

---

## 8. Process rules written for autonomous work

From `PLAN.md`'s Process list and `AGENTS.md`'s Development flow:

- **Isolated commits as you go**, detailed messages, never leave a round
  uncommitted.
- **Docs travel with the code, every commit** — `src/README.md`, the round
  file, JSDoc, `docs/features.csv`, schemas.
- **A closing docs sweep ends every round** — grep for staleness markers
  ("open", "remains", "not yet", stale counts), sweep `PLAN.md` too, then run
  `plan:index` and rewrite `EXECUTIVE_SUMMARY.md`.
- **Check `git worktree list` when closing** — an abandoned agent worktree once
  put 141 of 278 files into `npm pack` and turned `test:modules` red.
- **Log a contradiction; never silently patch it.**  Keeping or removing
  public API is the maintainer's call even when a ledger entry seems to
  authorise it; it goes in "Open calls for the maintainer".
- **Renderer, gesture or grab-state changes: open the page** — round 43
  shipped three defects a person found in one sitting.
- **Run the routed verification before handing back**; call out public-API,
  selector, style, layout or rendering semantic changes in the summary.
- **Keep changes narrow; extend existing tests/demos/docs rather than adding
  parallel mechanisms; no new tools or conventions unless asked.**

---

## 9. Encoded testing lessons: the "control"

`testing.md`'s theme: *run the spec once with the thing it tests deliberately
broken, and watch it fail.*  Specific rules an agent inherits:

- A spec's name is not evidence; assert the behaviour named (three "picks by
  outline" specs only checked `boundingBox()`).
- A spec accepting either outcome discriminates on neither — assert the
  precondition too.
- A fixture must be in the shape the tool actually parses.
- A control that fails to fail is a finding: the code or the spec is redundant.
- A source scanner that skips a file looks like a clean file — count what it
  touched.
- Reformatting the tree is a free control on every text-scanning tool.
- A leak gate measures reachability (`WeakRef` + `--expose-gc`), not bytes.
- Headless layout specs must set `headlessWidth/Height` to the page they stand
  in for.
- Layout changes go through `test/layout-quality.mjs` first, whose overlap rows
  each carry a red control.
- Mid-flight browser assertions poll for state; they don't sleep to an offset.
- Pin each guard deterministically in `test/`, not only via a fuzzer.
- Coverage of transpiled code needs source maps.

Spec files themselves open with a header comment naming the round and the
defect that motivated them, so an agent changing a spec sees why it exists.

---

## 10. Verification beyond unit tests

### 10.1 The debug harness (`debug/`, `npm run watch` → :3333)

Twenty-one networks (real exports and in-page generators), hand-authored
sheets, layout options panel generated from the type declarations, a
`cy.layout({...})` readout of the exact call, airiness metrics, minimap,
console handles (`window.minimap`, `cy._renderer.labelLayer.declutter`).
`debug/load-error.js` names the failure **phase** (`network`, `http`, `decode`,
`init`) so a scripted browser or a person reports the right cause.  Its pure
halves are exported and spec'd headless.

### 10.2 The status site (`npm run status`, `status:serve` → :3335)

A deployable snapshot of the branch: the harness, the benchmark archive and
cross-commit comparisons, the generated API reference, the repo documents
including `EXECUTIVE_SUMMARY.md`, the features page, the schemas page, the
golden gallery, and a machine-readable `status/version.json`.  Split into a
pure `buildPlan()` and a writing `executePlan()` so it is testable.

### 10.3 Visual goldens and live v3 parity (Playwright `visual`)

Goldens are **exact** (zero differing pixels) because every input is pinned;
live v3-vs-v4 diffs in one page; a close-up tier at zoom 3–4; numeric routing
parity (`routing.spec.js`) comparing geometry, not pixels.  Regeneration is
an env flag, never a hand edit: `UPDATE_GOLDENS=1`, `UPDATE_GOLDEN_COVERAGE=1`,
`UPDATE_GESTURE_TRACES=1` — and the resulting record diff *is* the behaviour
change to review.

### 10.4 Golden style coverage and the degrade control

Each golden records which style properties it sets; the Node tier pins how
many none exercises.  `DEGRADE_CONTROL=1` resets each recorded property and
counts moved pixels, proving "set" is "seen".

### 10.5 Scripted gesture traces

`playwright-tests/lib/gesture-traces.mjs` + `trace-replay.mjs` replay scripted
input and compare positions, selection, viewport and event logs as numbers
against checked-in records, on every v4 host and on v3 (with listed
divergences).

### 10.6 Cross-runtime smoke

One import-free checks module run under Node, Bun, Deno, a WinterTC-shaped
`node:vm` isolate, Cloudflare `workerd`, Deno WebGPU, and browser workers.
Never soft-skips; a dict-as-array control must fail.

### 10.7 Benchmarks with provenance

Machine and harness fingerprints, `--repeat 3` medians with spread, pinned
Node, refusal of SwiftShader for GPU profiles, tracked `benchmark/published/`,
cross-commit comparison with frozen v3 rows as a noise control.  An agent's
"it got faster" claim has to survive all of that.

---

## 11. Determinism and environment pinning

- **Node:** `.nvmrc` (24) and `mise.toml`; `benchmark:report` refuses another
  major without `--any-node`.  `mise exec -- …` is the documented safe form.
- **npm + `package-lock.json`** only.
- **Rendering:** goldens pinned to SwiftShader; browser pinned by Playwright;
  label font vendored via `@fontsource/open-sans`.
- **Playwright workers:** half the cores (measured; one-per-core oversubscribes
  SwiftShader).
- **Frame driver:** `playwright-page/frame-driver.js` keeps BeginFrames coming
  so idle-started animations run on schedule.
- **Ports:** v4 harness 3333, v3 3334, status 3335 — a stray server can't be
  mistaken for another.
- **Fedora/non-Debian:** host check skipped locally (never on CI); the
  `libjpeg.so.8` workaround is documented.

---

## 12. Traps the repo defuses for agents

| Trap | Defusal |
| --- | --- |
| `.mts` on disk, `.mjs` in imports — looks like a bug | Called out as an invariant in `AGENTS.md`: don't "fix" it |
| Assuming ESLint/Prettier/Mocha/Rollup | `AGENTS.md` names oxlint, oxfmt, `node:test` (+ shim), rolldown |
| Stale bundle under Playwright (`reuseExistingServer`) | `test:playwright` always builds first; trap documented for direct `npx playwright test` |
| Stale bundle under module/runtime specs | `test:modules`, `test:runtimes:*` run `build` themselves |
| Concluding "no GPU" from SwiftShader | `npm run gpu`; rule repeated in three notes |
| `navigator.gpu` null on `about:blank` | Probes serve a loopback page |
| `cy.elementsInBox` silently empty for a box object | Recorded in `benchmarking.md` |
| tsx's `__name` distorting hot-path benchmarks | Re-measure through the built bundle |
| Importing `benchmark/graph.mjs` evaluates v3 | `bench-size.mjs` exists for constants |
| Unanchored ignore pattern swallowing `scripts/status/` | Anchored `/status`, lesson in `testing.md` |
| Editing generated files | `build/`, `dist/`, `plan/INDEX.md`, goldens: regenerate via scripts only |
| Over-trusting the record | "A plan's statements are claims to re-measure" |
| Deno panics on zero-byte `writeBuffer` | Noted in `testing.md` |

---

## 13. Agent-harness hygiene

- **`.gitignore`** ignores `/.claude/worktrees/` (and notes Codex's
  equivalent).
- **`.npmignore`** excludes `.claude` with the reason (a 352 MB abandoned
  worktree), plus `AGENTS.md`, `CLAUDE.md`, `PLAN.md`, `plan/`, `docs/`;
  `test/modules/packaging.mjs` gates the pack contents.
- **`.claude/settings.local.json`** sets the Concise output style.
- **Worktree cleanup** is a closing-sweep rule (§8).
- **Commit trailers** link each agent commit to its session.

---

## 14. Self-documenting code conventions

- **JSDoc on the source is the documentation** (standard tags, one block per
  overload, contract and deviations, not implementation); it ships in the
  `.d.ts`, so hover text is what an agent reading the API sees.
- **Facade + sibling directory** once a file passes ~1,000 lines
  (`collection.mts` → `src/collection/`, `renderer.mts` →
  `src/render/renderer/`): paths stay stable, each module stays readable in
  one read.
- **`// -- <group> --` banners** in `core.mts`/`collection.mts` are read by the
  docs generator.
- **One place each name is spelled:** `src/contract.mts`,
  `src/style-props.mts`, `src/public-exports.mts`.
- **Pure/impure splits for testability** (`buildPlan`/`executePlan`, parsers vs
  probes in `machine-info.mjs`, debug-page pure halves).
- **Header comments with history** in specs and scripts: the round, the
  defect, the measurement.

---

## 15. Observations and gaps

Found while surveying; none changed.

- **Inner-loop timing has drifted.**  `AGENTS.md` says `verify` takes ~9 s;
  `npm run -s verify:quiet` took **29.4 s** wall (3 m 5 s CPU) here today,
  green and silent.  Worth re-measuring and updating the table.
- **Agent worktrees are piling up.**  `git worktree list` shows six locked
  `.claude/worktrees/*` trees and seven detached Codex trees under
  `~/.codex/worktrees/`, despite the closing-sweep rule.  They are gitignored
  and npmignored, but they still hold full copies of the repo.
- **No project-level Claude Code configuration** beyond the output style: no
  committed `.claude/settings.json` (permission allowlist for the `npm run -s`
  scripts, which would cut approval prompts), no hooks (e.g. running
  `format` after edits), no slash commands or skills (e.g. a "close a round"
  skill encoding §8's checklist, or "add a plan section" that fills the
  filename and `Depends on:` line).
- **CI's release workflows are v3's** and marked not yet adapted (round 50).
- **`PULL_REQUEST_TEMPLATE.md` is v3-era** (mentions `index.d.ts`, `master`)
  and does not mention the v4 gates.
