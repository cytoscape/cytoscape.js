## The runtime horizon: which other JavaScript environments are worth supporting

An investigation round with a written record — the WebGL-scoping
shape.  No `src/` changes except where a one-line capability
guard buys a whole environment (the `animation.mts`
rAF-fallback shape), each such line with a spec.

### 100.1 — the capability ladder, stated once

What each tier of v4 *actually* needs, so environments are judged
against requirements rather than vibes:

- **T0 — headless core** (store, wire, style, layouts,
  CPU algorithms, `json()`, and round 77's `svg()` when it
  lands): the WinterTC baseline v4 already confines itself to —
  typed arrays, TextEncoder/Decoder, `queueMicrotask`, timers.
- **T1 — + Web Workers**: the round-74 pool.
- **T2 — + WebGPU**: the GPU executors (no canvas — 99.2's
  tier), then the renderer's export path if 78.4 goes.
- **T3 — + DOM/canvas**: the full renderer, glyph atlas, image
  decode, gestures — browsers and browser-shells only.

### 100.2 — the candidates, each run through the 98.2 smoke

Measured, not assumed — the smoke is the instrument, and for
each environment the record says which tier it reaches and names
the first failing assertion when it misses:

- **Cloudflare Workers / workerd** (locally via the wrangler dev
  runtime): the real use case is server-side layout, metrics and
  `svg()` at the edge; the thing to measure is T0 under the CPU
  budget an isolate actually grants, on a real fixture, not a toy.
- **Vercel Edge and friends** — workerd-adjacent; record, do not
  re-investigate.
- **Electron / Tauri-with-Node-sidecar**: expected to be Node +
  Chromium wearing a trenchcoat; verify with the smoke and one
  renderer sanity check, one line of record each.
- **React Native / Hermes**: T0 would put the graph *model* and
  algorithms in apps; Hermes' standard-library gaps are exactly
  what the smoke enumerates.
- **Embedded engines (QuickJS, GraalJS)**: long tail; run the
  smoke where it is cheap, record-only, no support claim.
- **Service workers / worklets**: T0/T1 contexts inside the
  browser; round 86 owns the worker-hosted *renderer*, so this
  round only checks the model tier loads there.

### 100.3 — the deliverable: a support matrix with teeth

A tiered statement, docs-side: **Tier 1** — CI-gated (Node, Bun,
Deno, the Playwright browsers); **Tier 2** — expected-to-work
(WinterTC-baseline environments; the smoke is run against them at
release time, the round-51 bake being the natural first
occasion); **Tier 3** — recorded as unsupported *with the failing
assertion named*, so the answer to "does it run on X" is a link,
not a shrug.  Anything that earns real work becomes a ledger item
with its measurement attached, not a bullet in this round.

### Risks named at planning

- The environment zoo is unbounded; the pre-agreed candidate list
  and the ladder bound it, and "record-only" is a legitimate
  verdict.
- A smoke that *completes* in an exotic environment with subtly
  wrong values is the 98.2 risk again, and the same answer
  applies: the smoke asserts values and ordering, so "runs" means
  "computed the right numbers".
- Publishing a support matrix creates an expectation of
  maintenance; Tier 2's release-time cadence is the deliberate
  ceiling, and the matrix says so in its own text.

**Open:** whether workerd joins CI as a Tier-1½ (cheap and
high-signal if the wrangler runtime is stable on runners);
whether the matrix lives in `src/README.md` or becomes a docs-site
page in round 46 (recommended: README now, page at 46); whether
React Native demand justifies a tracked example app (default no —
wait for an issue with a real use case).

**Decided at the eleventh design sitting (2026-09-28):** **workerd joins
CI** as a gating smoke job if wrangler's local runtime is stable on
runners (Tier 2 otherwise); the support matrix lives in `src/README.md`
now and becomes a docs page at round 46; **no React Native example app**
until a real use case asks.

### The round, as carried out (2026-09-29)

On the eleventh sitting's three calls.  Two of them had already been
acted on: round 131 took this plan's capability ladder as written,
shipped it as the `cytoscape/headless` and `cytoscape/headless-gpu`
entries, and put workerd in CI (`ci-workerd`, plus the `node:vm` isolate
smoke every Node-tier run) — the "Tier-1½" question, answered yes and
done.  Round 73 fetched the browser reach table this round would
otherwise have needed.  So this round did the census (100.2) and the
matrix (100.3), and restated the ladder there (100.1) with what the
census found each tier actually requires.  Measured on the i9-9900K
(16 threads, RX 580), Fedora 43, Node 24.18.

| # | Commit | What landed |
| --- | --- | --- |
| 100.2 | `bc06d3bb` | `playwright-tests/contexts.spec.js` (the smoke's checks in a dedicated, shared and service worker, Chromium and WebKit); `test/runtimes/engines.mjs` (the release-time embedded-engine census); the no-engine refusal as a spec |
| 100.1, 100.3 | this commit | `src/README.md`'s "Supported environments" (the ladder and the matrix), `docs/features.csv`'s row, items 82 and 83, the close |

**The instrument** was the smoke's checks (`test/runtimes/
smoke-checks.mjs`) — value and ordering assertions, the dict-as-array
control run beside every green, so "runs" means "computed the right
numbers" (the risk this plan named).  Every environment ran the
headless build's minified ESM unless it says otherwise.

**The census (100.2), environment by environment:**

- **Node 24.18, Bun 1.4.2, Deno 2.9.6** (the latter two from npm, in
  the scratchpad): the smoke green over all nine bundles on each.  T1
  measured beyond what CI asserts — a 300-node closeness under
  `executor: 'workers'` on an 8-worker pool, bit-identical to `'cpu'`,
  and the force sim worker spawned, on all three.  Deno's CJS sim-worker
  bootstrap still fails (item 76), the values landing regardless.
- **Cloudflare workerd** (2026-09-28): the CPU budget on real fixtures,
  the thing 100.2 asked for.  A scratch worker served the headless ESM
  with two debug networks embedded as JSON modules; each request did
  one task; median of 15 after a warm-up, the no-op request's 1.7 ms
  subtracted.  `Date.now()` does not advance inside a workerd request
  (the Spectre mitigation), so the time is the client's round trip of
  a CPU-bound request:

  | Task | reactome (227 / 245) | npm-deps (439 / 510) | Node, npm-deps |
  | --- | --: | --: | --: |
  | ingest | 1.6 | 1.9 | 2.1 |
  | `force` to settle (`executor: 'cpu'`) | 29.8 | 83.0 | 78.6 |
  | `flow` | 5.6 | 23.3 | 22.6 |
  | `pageRank` + betweenness | 6.1 | 12.0 | 5.3 |
  | `json()` | 1.2 | 2.4 | 2.9 |
  | all of it | 34.6 | 92.2 | 83.9 |

  Cloudflare's limits page (fetched 2026-09-29, "last updated Sep 5,
  2026"): 10 ms CPU per invocation on Free, 30 s default and 5 min
  maximum on Paid, 64 MiB uncompressed script size on both, 128 MB per
  isolate.  So the free plan holds ingest, metrics and export of a
  few-hundred-node graph and not a force layout; the paid default holds
  everything measured, the largest request by more than 300×.  The 1,000,000-byte budget in
  `bundle-size.mjs` is now far under the vendor's figure; it stays, as
  round 131 said, because the assertion names the budget, not the
  vendor.
- **Vercel Edge** — record-only, as planned.  Its runtime page (fetched
  2026-09-29, "last_updated 2026-08-03") lists the WinterTC surface the
  isolate smoke models, forbids `eval` and `new Function` (both bundles
  contain neither — grepped), limits code to 1 MB gzipped on Hobby (the
  headless build is 176,097), and **recommends migrating from Edge to
  Node** — Next.js 16.3 no longer supports `runtime = 'edge'`.  Tier 2
  by shape; the Node row is where that audience is going.
- **Electron 44.4.5** (Chromium 152, Node 24.21; from npm, in the
  scratchpad).  As Node (`ELECTRON_RUN_AS_NODE`): the smoke green on all
  nine bundles, the control red.  The main process proper (an ESM main):
  the headless checks green and a `'workers'` pageRank on the pool.  A
  renderer, mounting the minified UMD in a hidden window on the
  machine's own session: under Wayland, no adapter — `cytoscape()`
  rejects "WebGPU is available but no adapter could be acquired"; with
  `--enable-unsafe-webgpu`, SwiftShader, and the mounted graph picks
  node `a` at its rendered position and exports a 7,622-byte PNG; under
  X11 with `--use-angle=vulkan --enable-features=Vulkan`, the hardware
  adapter (`amd / gcn-4`) with or without the unsafe flag, the same
  pick and export.  Electron refuses Vulkan under Wayland ("not
  compatible with Vulkan").  Two traps for whoever re-runs it: a
  top-level `await app.whenReady()` in an ESM main deadlocks (`ready`
  waits for the module), and `--ozone-platform=headless` segfaults at
  the first `BrowserWindow`.  One line of record, as the plan asked:
  Node plus Chromium, and on Linux the app decides whether WebGPU is
  reachable.
- **Tauri with a Node sidecar**: not run — no Rust toolchain here, and
  nothing to learn that its parts do not say: the sidecar is the Node
  row, the view is the platform webview's engine.  The matrix composes
  it and claims nothing of its own.
- **React Native / Hermes.**  The Hermes React Native 0.87.1 pins
  (`hermes-compiler` 250829098.0.17) has no standalone CLI release, so
  it was built from the tag `hermes-v250829098.0.17` (cmake, gcc,
  `HERMES_UNICODE_LITE`, ~2 min at -j14).  With the two globals React
  Native's `InitializeCore` installs (`queueMicrotask`,
  `performance.now`), the bundle as an IIFE (rolldown; Metro's shape
  without Babel) parses and fails `Property 'TextDecoder' doesn't
  exist` at module evaluation; with a UTF-8 `TextDecoder` polyfill —
  Hermes' own `TextEncoder` has `encodeInto` — 56 assertions green and
  the control red.  Through `@react-native/babel-preset` 0.87.1 the
  same.  Hermes 0.13.0, the last standalone release (2024), cannot
  parse the bundle (async functions, class expressions, private
  fields), and the current preset no longer lowers classes, so there is
  no configuration in which it runs.  No example app (the sitting).
- **QuickJS-ng 0.17.0 and GraalJS 25.4.4.1.1** (jsvu, in the
  scratchpad): both fail bare on `TextDecoder` at module evaluation;
  with the codec shim (and `queueMicrotask` on GraalJS's plain
  launcher, which has neither it nor timers) both green, 56
  assertions, the control red.  QuickJS-ng has no `setTimeout` either,
  so the smoke needs no timers.
- **Browser contexts** (Playwright's Chromium 149, Firefox 151, WebKit
  26.5; WebKit here needs `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1`
  for a missing gstreamer library).  A page, a dedicated, a shared and a
  service worker: the smoke green in every one of the twelve.  The pool:
  green in a page, refused in every worker kind ("requires … a browser
  page with Worker and Blob") — item 82.  An AudioWorklet: the module
  never registers its processor, because evaluation fails — Chromium
  and Firefox expose no `TextEncoder`/`TextDecoder`, `queueMicrotask`,
  `setTimeout` or `performance` there, WebKit has the codec but not
  `queueMicrotask`.  PaintWorklet: not measured — it has no channel to
  report back on, and nothing a paint worklet would want from a graph
  model.

**What the census says about the ladder (100.1).**  T0's real floor is
narrower than "the WinterTC baseline" suggested: it is `TextEncoder`
**with `encodeInto`** and `TextDecoder`, constructed at module
evaluation by the id map, so every failure above is one failure — the
bundle cannot load — rather than a degraded T0.  A lazy construction
would not buy an environment: every id goes through them, so the
one-line-guard shape this plan allowed has nothing to guard here, and
the round changed nothing under `src/`.  Timers are not needed;
`queueMicrotask` is (the dirty-set scheduler), which is what stops the
WebKit worklet.

**The calls taken in-round, and why:**

- **The page-less browser contexts became a CI gate**, not a Tier-2
  row: the contexts exist in both CI engines, the spec costs three
  tests per project and no adapter, and the model in a worker is a
  shape real apps use (and round 86 already made the renderer one).
  Its control, run by hand: the dict-as-array reader fails all three
  contexts on `a.label`.  It loads the **minified** UMD because
  Chromium will not start a service worker importing the page's 8.9 MB
  development UMD (inline source map) — bisected: the same import in a
  dedicated worker loads, and so do the minified and the source-map-free
  UMD in a service worker.
- **The embedded engines got a harness, not a job.**  They are not
  devDependencies (Hermes has to be built), so a CI job would be a
  download-and-compile per push for Tier-3 rows.
  `test/runtimes/engines.mjs` is what the release bake runs; its one
  Node-tier property is that naming no engine fails.
- **Tier 3 for engines that pass with a shim.**  They run, but only
  with a polyfill the library does not ship and cannot test per push;
  "supported" would be a promise about someone else's polyfill.  The
  matrix names the shim so the answer is actionable.
- **Firefox stays Tier 2** (item 83): adding a CI project is a CI
  convention change this investigation round should not make alone.
- **The worker-pool refusal is a ledger item** (82), not a fix: the
  `document` test is what keeps Bun and Deno on `worker_threads`, and
  changing it wants specs on four hosts.

**Observed, not this round's**: the headless minified ESM is now
567,858 raw / 176,097 gzip against `bundle-size.mjs`'s ratchet of
578,000 / 178,000 — 1.8% and 1.1% of headroom left, after rounds since
131 grew it from 525,271.  The next round to add core code will meet
the ratchet; raising it is that round's conscious call.

**Deferred**: the Tier-2 re-run at release (round 51's bake is the
first occasion); round 99 (the native test runners, the install story,
JSR), whose matrix rows are the round-98 smoke's until it runs; the
documentation-site page (round 46).

**Gates at close**: `npm run -s test:node:quiet` zero bytes;
`npx playwright test contexts` green on `renderer` and
`renderer-webkit` (3 + 3); the plan-record, agent-docs,
feature-inventory, status-features and migration-guide specs green;
`git worktree list` the main tree alone.
