## Use-case bundles: `cytoscape/headless`, `cytoscape/headless-gpu`, and a shake-clean tree

The maintainer's ask (2026-09-21): bundles for particular use cases,
slimmer than the one entry the package ships.  The main one is
headless, CPU-only — CI, and edge isolates such as Cloudflare Workers,
which have no GPU, no `Worker`, and a script-size ceiling the
maintainer states as **1,000,000 bytes minified, gzip not counted**.
The second is headless with a GPU but no DOM — Deno's native WebGPU.
And the standing question behind both: could the tree be structured so
that a consumer's bundler slims it automatically, so that "headless,
CPU-only" is what you get by not using the rest?

The round takes round 100's capability ladder as written (100.1 —
**T0** headless core, **T1** + Web Workers, **T2** + WebGPU, **T3** +
DOM/canvas) and ships the tiers as entries; it discharges 99.2 (Deno's
native WebGPU driving the GPU executors) as a smoke on the T2 entry.
Neither of those rounds is renamed: 100.2's environment census and
99.1/99.3 stay planned.

### What the code does today, measured (2026-09-21)

- One entry (`src/index.mts`) in five single-file formats.  The
  minified ESM is **890,212 bytes** (250,445 gzipped).
- **A consumer's bundler shakes nothing.**  A scratch app importing the
  shipped ESM, using it headless, bundled by rolldown with tree shaking
  on: **877,780 bytes** out of 890,212.  The factory closes over the
  renderer, the pointer handler, both worker entries and the worker pool
  so that `container` and `mount()` can work; nothing a bundler can
  prove unused.
- **The renderer seam holds.**  A scratch entry that constructs `Core`
  and bulk-adds, bundled from source with the shipping config: **578,787
  bytes minified, 174,211 gzipped**, and it runs headless end to end —
  grid, BFS, a sheet with a constant read back, CPU `pageRank`, a
  five-iteration force run, and `executor: 'gpu'` rejecting with the
  WebGPU-unavailable message.  Nothing under `src/render/` reaches it
  except two leaves: `render/picking.mts` (`EDGE_PICK_BIT`, read by
  `core/export.mts:5`) and `render/webgpu-constants.mts` (through
  `algorithms/algo-gpu.mts:23`).
- **What still reaches that entry and should not**: every `algo-gpu-*`
  module (~130 KB unminified, ~45 KB minified), because each async
  algorithm statically imports its kernel and hands `runAlgo` a closure
  over it (`page-rank.mts:7,77`); and `executor.mts:70-74` value-imports
  `acquireAlgoGpu` / `algoGpuSupported` / `GpuUnfitError`.
- The bundle by area (unminified ESM, region markers): core + store +
  style + collection 44.3%, renderer + interact 24.5%, layouts 13.3%,
  CPU algorithms 8.9%, non-render GPU code 6.4%, animation 2.7%.
- The GPU force integrator runs only through a renderer:
  `force-run.mts:635` reads `cy.renderer()` as the `ForceHostLike`;
  `GpuForceRuntime` itself (`render/gpu-force.mts:750`) takes a
  `GPUDevice` and nothing else.
- No `sideEffects` field, no size gate anywhere (`scripts/status/
  repo-state.mjs` measures, nothing asserts), and tree-shaking the
  library has never been discussed in the record (three hits, all about
  the extension contract, the `wgsl` tag, and the declaration).

### The design calls (decided with the maintainer, 2026-09-21)

**Entries, not annotations.**  Automatic slimming is not available to
this API shape, and the record says why so nobody re-litigates it: the
factory must reference the renderer to honour `container`/`mount()`;
`executor: 'auto'` probes `navigator.gpu` at run time, so the kernels
are reachable from every algorithm call; and the prototype API
(`cy.nodes().pageRank()`) retains every method with its class.  A
dynamic `import()` of the renderer on mount would be automatic in
theory and was declined: it makes the package multi-chunk (breaking the
single-file invariant the worker spawn-from-own-URL relies on, 74.2 /
86.3 / 129.3) and `mount()` asynchronous.  What the round does instead
is make the tree **shake-clean by structure** — each entry reaches
exactly its tier, gated — so that the entries are exact today and a
composable factory can be exposed later without another refactor.

| Entry | Tier | Carries | Does not carry |
| --- | --- | --- | --- |
| `cytoscape` (`src/index.mts`) | T3 | everything, unchanged | — |
| `cytoscape/headless` (`src/headless.mts`, new) | T0 + T1 | store, style, collection, the CPU algorithms, every layout, animation, the wire, the worker pool and the force sim worker with their statics (`__algoWorkerSource__`, `__runForceSimWorker__`, stats/reset) | `src/render/`, `src/interact/`, `src/gpu/`, `algo-gpu-*`, `__runRenderWorker__` |
| `cytoscape/headless-gpu` (`src/headless-gpu.mts`, new) | T0 + T1 + T2 | headless plus the GPU algorithm lanes and a headless GPU force host | `src/render/`, `src/interact/` |

- **Names**: `headless` and `headless-gpu`.  `./gpu` stays the
  deprecated alias of the full entry it is today (round 44); it is now
  ambiguous beside `headless-gpu`, which is an open call, not this
  round's change.
- **The headless entry drops the GPU executors** through a registry the
  entries populate (below), touching ~16 algorithm files mechanically;
  the alternative — leave them in at ~45 KB of dead weight where
  `navigator.gpu` is absent — was declined.
- **Cloudflare is gated twice**: a Node `vm` isolate smoke in the Node
  tier every run, and a `ci-workerd` job on the real runtime via the
  `workerd` npm package (round 100's "Tier-1½" open question, answered
  yes).
- **Headless GPU force lands this round**, not as a deferral.
- **The composable factory stays `@internal`**; exposing
  `cytoscape/core` plus capability modules is logged as an open call.

Every edge is loud, never a silent fallback (the guard-nothing-triggers
rule): a headless entry given a `container` throws
`this build has no renderer — import 'cytoscape'` at the same point
`index.mts:75-83` throws today, before `_bulkAdd`
(`test/core-api.mjs:172-186` asserts the container error wins over an
ingest error), and `cy.mount()` throws the same; on `cytoscape/headless`
an explicit `executor: 'gpu'` — algorithms and force — rejects
`this build has no GPU executors — import 'cytoscape/headless-gpu' or
'cytoscape'` and `'auto'` skips the lane; on `cytoscape/headless-gpu` a
force `executor: 'gpu'` runs on the compute device, and a headless
`'auto'` **stays synchronous** (the MIGRATING.md contract, and what
keeps the Node suites' timing honest), so the GPU host is reached only
by an explicit `'gpu'`.

### The mechanisms

**A — the capability seam (`src/factory.mts`, new, `@internal`).**
`createCore(options, caps)` takes the body of today's `cytoscape()`
(`index.mts:74-137`): the container guard, `new Core`, the bulk add,
`options.layout`, and `_attachFn` when `caps.attach` exists.  `caps` is
`{ attach, gpu, forceHost, noRendererMessage }`, stored as `cy._caps`.
`mount()` (`core/lifecycle.mts:112-137`) mutates `_container`,
`_readyResolved` and label dirtiness *before* calling `_attachFn`, so a
throwing `_attachFn` would leave the instance half-mounted: the headless
entries leave it **null**, and the guard at `:117` distinguishes
`_caps == null` (a bare `new Core`, keeping the "not created via the
factory" message `test/core-api.mjs:210` asserts) from
`_caps.attach == null` (the build's message).  `_handleDeviceLost`
already tolerates a null `_attachFn`.  The statics stay assigned in each
entry file, not in a helper, because `scripts/docs-generate.mjs:209,398`
reads `cytoscape.X = …` and its import line from `src/index.mts`, and
`scripts/jsdoc-coverage.mjs:27` lists that file in `PUBLIC_API` — the
two new entries join that list.  Type re-exports live once, in
`src/public-exports.mts`.

**B — the GPU registry (`src/algorithms/gpu-registry.mts`, new,
GPU-free).**  Every GPU call already goes through `runAlgo`
(`executor.mts:236`), but as a closure capturing per-algorithm
arguments (`page-rank.mts:77`, `neighborhood-similarity.mts:245`,
`triangle-counting.mts:202`), and three sites pick a lane conditionally
(`closeness-centrality.mts:153-155` by density, `k-clustering.mts:410`
when features are GPU-unfit, `betweenness-centrality.mts:58` when
weighted).  So the lane is not a bare key: the registry holds
`GpuRuntime { supported(); acquire(); lanes: GpuLaneTable }` with each
lane's real signature (closeness has two keys), `registerGpu(rt)`,
`gpuRuntime()`, `gpuLane(key)` returning the registered function or
null, the `AlgoGpu` interface and `GpuUnfitError` (re-exported from
`algo-gpu.mts` for the specs that import it there).  A new
`gpu-lanes.mts` imports every `algo-gpu-*` and exports `GPU_RUNTIME`;
the full and headless-gpu entries register it.  **`runAlgo`'s signature
is unchanged** (the executor and cancel specs call it with a function):
an algorithm replaces its kernel import with
`const lane = gpuLane('pageRank'); runAlgo(…, lane && ((ctx) => lane(ctx, coll, options)), …)`.
`route()` consults the registry first — `'gpu'` with no registry gives
the build message, so a headless build is never mistaken for "no GPU
path for these options"; then `!rt.supported()` (today's text); then
`gpu == null` → `gpuNoPathReason`.  `'auto'` takes the lane only when a
runtime is registered, the closure exists, `n >= minGpuN` and
`supported()`.  The crossovers stay in `executor.mts`.  The stale "five
single-file bundles" comment at `algo-workers.mts:19` is corrected.

**C — the headless GPU force host (`src/gpu/headless-force-host.mts`,
new).**  `force-run.mts:632-637` reaches the host block for `'auto'`
and `'gpu'`; the selection becomes
`cy.renderer() ?? (executor === 'gpu' ? cy._caps.forceHost?.(cy) : null)`,
so headless `'auto'` keeps its synchronous contract.  The explicit-`'gpu'`
error at `:693-698` is reworded per build but keeps the prefix
`executor 'gpu' needs the GPU integrator` (`test/force-worker.mjs:422`).
The host implements `ForceHostLike`: `startForce` returns a runtime proxy
at once (the worker host's deferred proxy, 129.2, is the precedent),
acquires the device through the registry, constructs
`GpuForceRuntime(device, inputs)` and runs an **async** loop —
encode with `silentTarget()` → submit → `await
device.queue.onSubmittedWorkDone()` → `pollConvergence()` → `nextBatch`.
The await is not optional: `pollConvergence` (`gpu-force.mts:1334-1367`)
maps a staging buffer asynchronously and `converged()`/`idle()` only move
in its continuation; a synchronous loop would also starve the
displacement copy behind `dispInFlight` (`:1312-1322`).  `nextBatch`
(`:106`) is exported and pure; its `behind` input is the frame-skip
signal and never true headless, so growth is bounded by the price cap
and `MAX_BATCH` only — stated here so nobody expects the renderer's
skip-driven growth.  The loop stops encoding when `idle()` (an infinite
run) and `wakeForce()` restarts it (`fl.current.wake` fires on reheat /
position / topology); `finishForce()` sets a stopped flag before
`destroy()` so no pending continuation encodes on a destroyed run.
`runGpu` (`force-executors.mts:239`) needs no change.  One hidden Core
dependency: `core/batching.mts:22,53` defer slot compaction only while
`_renderer?.forceActive()`, and a compaction under a headless run would
remap `inputs.slots` beneath the settle — the host gets `active()` and
the guard reads either.  `silentTarget()` sizes its own buffer
(`:1154-1177`) and `applyGroup` is built inside `encode`, so there is no
mirror dependency.

**The moves that make the tiers exact.**  `render/gpu-force.mts`,
`render/wgsl.mts` and `render/webgpu-constants.mts` move to `src/gpu/`
(none contains a `throw`, so `scripts/throw-coverage.mjs`'s browser-only
classification is untouched by the move; the new host, the factory and
the entries add Node-reachable throws that get specs, and the
`UNREACHABLE` note citing `index.mts`'s `_attachFn` is reworded to
`factory.mts`).  `EDGE_PICK_BIT` moves from `render/picking.mts:41` to
`contract.mts`.  Types leave the tiers so the walk needs no type
awareness: `ForceHostLike`/`ForceRuntimeLike` → `layout/force-host.mts`,
`AlgoGpu` → the registry, `label-wrap.mts:29-30`'s imports from
`render/glyph-atlas.mjs` / `label-layout.mjs` → a neutral
`label-types.mts`.  `core.mts:11-19`'s layout imports become
`import type`.

**Build, packaging, types.**  Per slim entry, ESM / minified ESM / CJS
and no UMD — eleven outputs.  The `FILE=` filter (`rolldown.config.mjs`)
becomes an exact basename match so `build:esm` keeps meaning the full
ESM and `FILE=headless.esm` selects a slim one.  `package.json` gains
`exports["./headless"]` and `["./headless-gpu"]` (`types` first), the
`./dist/…` literal subpaths, the `dist:copy` entries, and
`sideEffects: false` — safe because every module-evaluation effect
(`SELF_URL`, `GLOBAL_WINDOW`) is internal to the single-file bundle an
entry imports, so a bundler can only drop a whole unused entry; recorded
so nobody "fixes" it.  Declarations: **three single-input dts configs**
(one config with three inputs emits shared `.d.ts` chunks —
`rolldown-plugin-dts`'s documented behaviour), each with a fixed
`entryFileNames`, and `scripts/build-dts.mjs` parameterised
`(src, out, { umdGlobal })` so **only** `dist/cytoscape.d.ts` carries
`export as namespace cytoscape;` (two would be a duplicate identifier for
a consumer resolving both).  The headless factories take
`HeadlessOptions`, `CytoscapeOptions` minus the renderer- and
pointer-only fields (`container`, `renderer`, `pixelRatio`,
`pointerCursors`, `wheelSensitivity`, the tap thresholds and taphold /
multi-click timings, the box-selection fields, `userPanningEnabled`,
`userZoomingEnabled`), exported and checked by a slim-surface spec.
Every gate that enumerates bundles by literal learns the new ones:
`test/modules/packaging.mjs` (the count of five, the produced set, the
exports-map checks), `algo-worker-body.mjs` (the four headless bundles
carry the worker source), `runtime-smoke.mjs` (the ok-line regex; the
full ESM stays first), `quiet-scripts.mjs` (the new twins), and
`test/runtimes/smoke.mjs`'s `BUNDLES` (six more, with per-kind
assertions: the container throw and the `'gpu'` rejection text on the
slim ones).  The status site's size table globs `build/*` and picks the
new files up on its own.

### The gates that are new

- **`test/modules/bundle-size.mjs`** — each headless minified artifact
  ≤ 1,000,000 raw bytes (the maintainer's stated budget; the assertion
  names the budget, not the vendor — see the risk below), plus a
  per-artifact ratchet in raw and gzip bytes measured at landing with
  ~10% headroom, which a round raises consciously.  The full bundle is
  recorded, not gated.  Control: the spec against the full bundle with
  the headless ratchet must fail.
- **The tier rule in `test/modules/import-graph.mjs`** — walking value
  imports from `src/headless.mts` reaches nothing under `src/render/`,
  `src/interact/`, `src/gpu/`, `src/algorithms/algo-gpu*` or
  `gpu-lanes.mts`; from `src/headless-gpu.mts` nothing under
  `src/render/` or `src/interact/`.  The walk counts the modules it
  touched (pinned) and lands **red before 131.1's moves**, which is its
  control.
- **`test/modules/isolate-smoke.mjs`** — the headless minified ESM
  loaded in a `node:vm` context with WinterTC globals only (no `Worker`,
  `document`, `window`, `navigator.gpu`, `URL.createObjectURL`), the
  runtime smoke's value assertions run there, and `executor: 'auto'`
  asserted to have run on the CPU.  `--control=dict-as-array` must fail
  there too.
- **`test:runtimes:workerd`** (+ `:quiet`) — the `workerd` devDependency,
  a `test/runtimes/workerd.capnp` serving the headless ESM as a module
  worker whose fetch handler runs the smoke and returns its assertion
  count; a `ci-workerd` job beside `ci-bun` / `ci-deno`.
- **`test:runtimes:deno:gpu`** — `deno run --unstable-webgpu --allow-read
  test/runtimes/gpu-smoke.mjs` on the headless-gpu ESM: `pageRank` CPU
  against GPU within the parity suite's bounds, a force
  `executor: 'gpu'` run that moves nodes to finite positions, and the
  adapter **named** in the output (99.2's rule; wgpu is not Dawn, so this
  is the first non-Dawn compile of those kernels).  A separate step in
  `ci-deno`, `continue-on-error`, with `mesa-vulkan-drivers` attempted:
  on a GPU-less runner it exits with the named failing assertion — no
  soft skip — and this file records whether CI or only a local run went
  green.  No Deno on the planning machine; the local number is a
  measurement for whoever has one.

### The plan

| # | What |
| --- | --- |
| 131.1 | The moves (`src/gpu/`, `EDGE_PICK_BIT`, the type homes, layout `import type`); the tier walk lands red, then green |
| 131.2 | The GPU registry (B): `gpu-registry.mts`, `gpu-lanes.mts`, `route()`'s order, ~16 algorithm files; specs on a registered and an empty registry, the control a fake `navigator.gpu` on the full entry taking the lane |
| 131.3 | The seam (A): `factory.mts`, `public-exports.mts`, the two entries, `index.mts` rewired, `_caps`, the `mount()` guard, `PUBLIC_API` |
| 131.4 | The headless force host (C) with the compaction guard; a Node spec with a fake device pinning the ordering (submit → done → poll; nothing after finish; wake from idle); the Deno GPU smoke for the real device |
| 131.5 | Build, packaging, types: eleven outputs, the exact `FILE` filter, the exports map, `sideEffects`, three dts configs, `build-dts` parameterised, every enumerating gate |
| 131.6 | The new gates: bundle size, the isolate smoke, the runtime smoke extended, workerd and its job, the Deno GPU smoke and its step |
| 131.7 | Docs and close: `src/README.md` gains "Builds: the entries and what each carries", `MIGRATING.md` an install snippet per entry, `docs/features.csv` its rows, `AGENTS.md` the routing row and commands, `EXECUTIVE_SUMMARY.md`'s Bundle and Runtimes rows rewritten from the record, the open calls logged, `npm run plan:index` |

Verification, every sub-round: `npm run -s verify`; before handing back
`npm run -s test:node:quiet`, `npm run build && npm run build:types`,
`test:modules:quiet`, `test:runtimes:node:quiet`, `test:types:all`,
`test:throws:quiet`; and `npm run -s test:playwright:quiet` after 131.1
and 131.3, since `gpu-force` and the pick bit move — the 45 goldens
exact-zero is the renderer-untouched claim.  Sizes go in this file at
landing: the full bundle unchanged within noise, `headless` targeted at
or under **540 KB** minified, `headless-gpu` under **600 KB**, each with
its gzip number.  Controls run and written down: the tier walk red
before 131.1; the size gate red against the full bundle; the isolate
smoke red under its control; the lane spec taking the GPU lane with a
fake adapter on the full entry and rejecting on the headless one.
`git worktree list` clean at close.

### Risks named at planning

- **The stated ceiling may be stale.**  Cloudflare's published Worker
  size limits have moved (the current documentation is reported as 3 MB
  free / 10 MB paid, measured *compressed*); the maintainer's 1,000,000
  raw bytes is the budget this round gates on, the gzip number is
  recorded beside it, and the assertion text names the budget rather
  than the vendor so a changed vendor limit is a one-line edit, not a
  rewrite.  Either way the headless artifact clears both readings by a
  wide margin; the ratchet is the number that does the work.
- **The registry is a behaviour change in disguise** if `route()`'s
  order is wrong: a full-entry `'auto'` run that used to take the GPU
  lane and now falls through is invisible to a spec that only checks the
  answer.  The executor specs already assert *where* a run ran
  (`algorithms-executor.mjs`, the workers profile's rows); 131.2 keeps
  them and adds the empty-registry cases.
- **The async tick loop and the settle.**  A readback racing a
  continuation is the round-118/119 class of defect (a zero readback
  looks like convergence).  The Node spec with a fake device pins the
  ordering; the Deno smoke pins the real device; the `stopped` flag is
  what makes `finishForce()` safe under a pending await.
- **Three declarations, one namespace.**  Shipping the UMD global twice
  breaks consumers who resolve both; the parameterised `build-dts` and a
  spec asserting exactly one `export as namespace` line across `dist/`
  are the guard.
- **workerd on runners.**  A new devDependency with a platform binary is
  a repo-wide convention change and a download per CI run; the job is
  opt-in like `ci-bun` / `ci-deno`, and if the runtime proves flaky on
  runners the isolate smoke stays the gate and workerd drops to a
  release-time run, recorded here.
- **Two more entries to keep documented**: the JSDoc gate covers them
  through `PUBLIC_API`, the runtime smoke through `BUNDLES`; anything
  that enumerates bundles by literal and was missed shows up as a red
  `test:modules`, which is the right failure mode.

**Open:** whether `./gpu` (the deprecated full-entry alias) is removed at
the next major or kept with a note, now that `headless-gpu` exists;
whether to expose the composable factory (`cytoscape/core` plus
`renderer` / `gpu` / `workers` capability modules) once the seam has
settled — the mechanism is built, the exposure is surface, types and
docs; whether layouts become a capability (the name switch in
`core/lifecycle.mts:43-96` keeps every layout in every entry, ~118 KB
minified, and a `layouts` table would let T0 drop force and flow);
and whether round 126's shader minification and item 63's constants
price are the next levers on the *full* bundle, which this round leaves
at its size.
