## Native Bun verification and Deno withdrawal

**Depends on:** 65, 74, 98, 2026-08-19-01

**12 October scope replacement:** drop Deno completely, including existing
runtime/GPU tests, CI and support claims; keep Bun. Require the complete Node
verification tier under Bun (public specs, modules/packaging, soak and throws),
with test-count parity and preserved Node coverage. Shared runner-neutral
refactoring is allowed; smoke-only fallback no longer closes this round.
Browser tests remain Playwright. Alpha publication is npm-only; reconsider JSR
post-alpha. Revise the pass plan to this contract before implementation. The
[interview](2026-10-12-01-rnd0000-note-bun-documentation-and-table-benchmark-interview.md) supersedes the historical Deno, test:js-only and JSR plans below.

### Current implementation and acceptance sequence

This sequence is authoritative for round 99. The historical 99.1–99.4 plan
below records the superseded proposal; Deno measurements in rounds 98 and 131
remain historical evidence and are not support promises or work to preserve.

1. **Capture the Node baseline and pin the Bun matrix.** Record exact Node and
   Bun versions, discovered test files, executed test identities, pass/skip/fail
   totals for each suite, and throw-site coverage. Keep the Bun floor at 1.4.0
   unless an observed incompatibility requires a justified floor change; CI
   runs that floor and latest stable as gating jobs.
2. **Adapt the full Node tier to Bun.** Probe actual incompatibilities in the
   test preload, `.mjs`→`.mts` resolution, callback hooks, workers, GC and test
   reporters. Add a Bun-specific adapter or shared runner-neutral code only
   where the probe demonstrates it is needed. Bun must execute every public
   spec, module/packaging spec and soak spec itself. No Bun test command may
   delegate those suites to Node.
3. **Gate parity, including throws coverage.** Compare Node and Bun by test
   identity where available, and always by discovered file count and executed,
   skipped and failed counts for each suite. A missing or malformed report, a
   file not run, an unexpected skip or a mismatch fails closed. Run the throws
   gate against each runtime's own suite coverage; compare covered, dead and
   classified sites and retain the Node source-mapped coverage gate. Coverage
   must refer to original `.mts` lines, not transpiled offsets.
4. **Withdraw Deno support from active v4 surfaces.** Remove Deno runtime and
   GPU smoke files, npm scripts, Deno-only assertions, CI job/setup and
   Deno-specific compatibility guidance or workarounds. Keep the general
   Node/Bun bundle smoke, WinterTC isolate, workerd and browser-worker checks.
   Do not rewrite historical Deno run records or v3 files.
5. **Make alpha publication npm-only.** Remove JSR from alpha instructions or
   planned release work. Record JSR as a post-alpha reconsideration, without
   publishing from this round or changing the release action itself.
6. **Verify and record the contract.** Run the full Node verification tier and
   the same public/module/soak/throws coverage under Bun; run the existing
   browser tier through Playwright where changed behavior requires it. Record
   runtime versions, per-suite test identities/counts/skips, throw coverage,
   controls for the parity gates and any remaining implementation gap. A
   smoke-only result, incomplete suite or unmeasured coverage is not closure.

### Landed 12 October — complete native Bun verification

The native adapter runs one isolated process per discovered file. Node uses
its test runner with the existing TypeScript/shim preload and a structured
event reporter; Bun uses its own test runner, native TypeScript loading and
temporary `.test.mjs` wrappers. Node operates the controller and build tools,
but does not execute Bun's test cases. The controller compares complete
file/suite/test identities and outcomes, including duplicate names. Missing,
truncated or malformed reports, omitted files, unexpected skips and count
mismatches fail closed. Output/time limits and signal cleanup bound failures.
The quiet composite preserves the zero-output success contract.
The implementation uses round 101's later quiet tooling and round 128's
settled-run lifecycle. The dependency header retains the original August
plan's chronological prerequisites; these October integration inputs are
recorded here rather than adding dependencies that postdate that section.

Bun throws verification has two complete public-suite passes: native LCOV
and an exact source-site probe derived from the original TypeScript AST.
Instrumentation wraps throws in blocks, preserving unbraced statement
semantics. The test-only worker preload instruments both imported source and
copied algorithm kernels. Main/worker provenance, discovered files, identities,
outcomes and complete probe records are checked. Native line coverage is an
independent check, not a substitute for exact throw-site hits. The existing
Node source-mapped gate and its classifications remain intact. Nineteen
new regression cases exercise 34 previously unhit defensive guards; disabling
representative guards makes their tests fail. Reporter, omitted-file and
worker-import controls also prove the gates reject incomplete evidence.

The runtime probes exposed retention differences under Bun 1.4.3. Destroyed
instances stayed reachable from completed worker frames despite empty
registries. The source cleanup separates the pool's void queue gate from its
result promise, clears settled lifecycle records, retains only dense indices
in betweenness result accessors, and consumes the worker lane's graph inputs
before dispatch. CSR preparation stays synchronous; its errors remain promise
rejections. A separate async runner carries only numeric arrays and the dense
index across the worker await. CPU/GPU routing, weight callback timing and
counts, cancellation and result values retain their prior contracts.

The approved final frame change was tested in temporary copies of the exact
seven-test worker soak: 40 paired Bun 1.4.3 runs gave 10 baseline WeakRef
failures and zero candidate failures. A strong external reference keeps the
actual Core alive in the control, then releases it within the existing
collector bound. Separate regressions retain the completed result and the
settled AlgoRun while requiring their destroyed source Core to collect. The
held-handle control passed 10/10 candidate runs and failed 10/10 baseline runs
on each of Bun 1.4.0 and 1.4.3; a second await and real result lookups remain
usable. The collectors still allow at most ten iterations and assert zero retained instances; they
now stop early only at stable zero, rather than abandoning collection at a
stable nonzero count. Queue error/cancel/recovery ordering has a regression
test. Earlier route-callback cleanup experiments did not withstand frozen
paired runs and were reverted; they are not part of the fix.

Deno's active runtime/GPU probes, scripts, CI setup and support rows are
removed. Historical measurements, source import prohibitions and general
GPU zero-byte guards remain; v3 is unchanged. Alpha instructions target npm
without performing publication. JSR is a post-alpha reconsideration.

### Final-tree verification evidence

Node 24.18.0 passed `npm run -s verify`, bundle/declaration builds and the
full `npm run -s test:node:quiet` gate. The later addition of one held-handle
soak case was followed by a green Node soak run; production source did not
change afterward.

The complete `mise exec bun@1.4.0 -- npm run -s test:bun` and
`mise exec bun@1.4.3 -- npm run -s test:bun` composites passed. Bun 1.4.0
is the supported floor; CI also gates floating latest stable, measured here
as 1.4.3. Each suite's exact identities and outcomes match Node 24.18.0:

| Suite | Files per runtime | Passing tests per runtime | Failed / skipped / cancelled / todo |
| --- | ---: | ---: | --- |
| Public | 174 | 3,310 | 0 / 0 / 0 / 0 |
| Modules and packaging | 72 | 1,226 | 0 / 0 / 0 / 0 |
| Soak | 7 | 40 | 0 / 0 / 0 / 0 |

Both Bun versions' throws verification matched all 3,310 identities in 174 files
between native and instrumented passes. It discovered/instrumented 387
source throw sites, hit 361 exactly, and classified the remaining 19
browser-only and seven unreachable sites. There were zero dead, unknown or
misattributed sites, and zero exact hits lacking native LCOV evidence. The
probe instrumented 97 source files and recorded 60 worker contexts; native
LCOV recorded 363 positive throw lines and coverage on 286 of 291 source files. The
composite also passed typecheck, lint, builds and all nine runtime smoke
variants: 49 assertions per full bundle, 51 per headless and 50 per
headless-GPU bundle. Node smoke passed the same nine variants; workerd
passed 56 assertions against the headless minified ESM bundle.
`npx playwright test playwright-tests/algorithms-workers.spec.js
--project=renderer --project=renderer-webkit` passed all six focused
Blob-worker parity, minified-body and cancellation tests (three per browser).
Both measured Bun versions expose workers but no `navigator.gpu`; neither
WebGPU compute nor a Bun renderer is promised. No Bun test exclusions or
throw allowlists were widened to make these gates pass.

Round 99 is complete under the interview contract. Node/browser/workerd gates
are preserved, Deno active support is withdrawn, and npm is the alpha channel.
Publication itself remains a release action; JSR can be reconsidered post-alpha.
No worktree was created for this round; existing unrelated worktrees remain.

### Historical proposal, superseded by the sequence above

### 99.1 — the full suite under the native runners, measured

Can Bun and Deno run the real Node tier — `node:test` + chai +
the `.mjs`→`.mts` remap tsx does today?  This is an experiment
with a written record, not assumed work.  Method: run `test:js`'s
glob under each runtime's Node-compat, and **compare the executed
test count to Node's** — the enumerator rule, because the failure
mode to fear is not red, it is a runner that skips what it cannot
parse and reads green at a fraction of the suite.  Acceptable
outcomes, pre-declared: (a) a runtime runs the suite whole, and a
CI job is added running it; (b) it cannot, the record says exactly
where (the shim? the remap? chai?), and **the 98.2 smoke stays the
cross-runtime contract** — the suite remains Node's.  Both are
fine; a silent half-run is the only failure.

### 99.2 — Deno's native WebGPU drives the GPU executors

The flagship: the round-65 async algorithm tier with
`executor: 'gpu'` under plain Deno — no browser, no Dawn-in-Node
build, `algo-gpu.mts` already gating on `navigator.gpu` alone.
Go/no-go criteria written before the probe, 78.4-style: pipelines
compile on our WGSL set; CPU-vs-GPU parity holds by reusing the
`algorithms-gpu` parity spec *shape* (same fixtures, same bounds)
in a Deno-runnable form; the adapter is **identified in the
record** (the benchmark tier refuses SwiftShader for pricing —
the same honesty here: name Deno's backend, and note wgpu is not
Dawn, so this is also the first non-Dawn WGSL compile our shaders
get).  Findings feed 78.4's decision memo either way — a *go*
here is the cheapest "WebGPU outside a browser" answer on the
table.  Standing rule adapted: no "blocked, no adapter" without a
probe from a real Deno script with the permission flags right.

### 99.3 — the install story and the publish surfaces

- **Docs**: an install section covering npm, pnpm, yarn and bun,
  plus Deno's `npm:cytoscape@^4` specifier and the CDN `<script>`
  form — landing in `src/README.md`/`MIGRATING.md` now and in the
  round-46 site when it builds (round 46's plan carries the
  matching bullet as of today).  One snippet per manager, kept
  adjacent so drift is visible.
- **A runtime-support statement** with the tier language round
  100 firms up: which runtimes are CI-gated, at what floor.
- **JSR: a decision memo, not a decision** — the 78.3 shape,
  because publishing is round 50's to own.  Priced options:
  npm-only (Deno consumes `npm:` fine today), or an additional
  JSR publish (what it wants from `dist/`, what it does to the
  release workflows, who asks for it).

### 99.4 — close

CHANGELOG row, `MIGRATING.md` (the headless/cytosnap audience
overlaps the server-runtime audience), `AGENTS.md` gains the
smoke tier under Development flow, `EXECUTIVE_SUMMARY.md`
rewritten per the standing rule, gates green.

### Risks named at planning

- 99.1's compat surface is the moving target 98 already named,
  squared — pin the versions the record was taken on, and date
  the record; a "Bun cannot X" sentence is a claim future rounds
  must re-measure, per the plans-are-claims rule.
- 99.2 can eat unbounded time chasing wgpu/Dawn divergence; the
  pre-written go/no-go and the scratch-tree constraint (no `src/`
  changes from an investigation) bound it, as they bound 78.4.
- Coordination: ledger item 29's worker pool spells its workers
  `node:worker_threads` / browser `Worker` — if round 74 lands
  first, its runtime seam should prefer the Web Worker API where
  it exists (Bun and Deno both have it; Node does not), or the
  pool becomes the one v4 feature that is Node-shaped.  Named
  here so neither round discovers it in review.

**Open:** whether a green 99.1 job gates or only ci-node does
(recommended: the smoke gates everywhere, the full-suite jobs
gate only where they run whole); whether 99.2's parity subset
joins CI on a Deno runner or stays a recorded manual probe until
GitHub's runners say what adapter they give it; the JSR memo's
recommendation (leaning npm-only until someone asks).

**Decided at the eleventh design sitting (2026-09-28):** **every Bun and
Deno job gates**, the full-suite ones included; the Deno GPU parity
subset stays **a recorded manual probe** until GitHub's runners show
their adapter; the package **also publishes to JSR**.
