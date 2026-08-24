## Round 53 — CI, green then fast (2026-08-06)

CI had been red on **every push since round 42** on one job and **since round
46.5** on the other, and nobody had read a log: the Actions log API answers 403
without repository admin, so the failures were diagnosed by reproducing both
jobs in a clean `git worktree` and confirmed against the real logs afterwards.
Both reproductions matched the runner exactly.

### The two failures

**`ci-v3` died in 0.4 s, before a single test.**  `v3/tsconfig.json` carried
`"types": ["@webgpu/types"]` — v4 tsconfig that came along in the round-42
split — while `@webgpu/types` is a devDependency of the *root* package.  Every
developer machine and the `ci` job resolve it by walking up into the root
`node_modules`; the `ci-v3` job installs only in `v3/`, so there is nothing to
walk up into.  v3 references no WebGPU type at all.  `"types": []` keeps the
"no ambient `@types`" restriction the config always had.

**`ci` died 40 s in, at `test:modules`**, on the three `status-site.mjs` specs
that plan the mirror of the debug harness — which loads
`../build/cytoscape.umd.js`, and `build/` is gitignored.  Playwright's
webServer does build one, but that runs *later in the `run-s` chain* than
`test:modules`.  On any machine that has ever built, the specs pass.  A `npm
run build` step before the suite fixes it and costs 0.7 s under rolldown.

Both are the same shape, and it is worth naming: **a fresh checkout is a
configuration nothing here tests.**  Every developer machine carries state —
a hoisted dependency, a stale `build/` — that CI does not.

### Then: why the suite was slow

With the failures fixed, the Playwright projects dominate, and the timeouts
that had been blamed for it were a symptom.  Instrumenting every helper in
`renderer.spec.js` (CI flags, 4 workers, the runner's parallelism):

| helper | calls | total |
|---|---|---|
| `waitFrames` | 156 | **570 s** |
| `makeReadyCy` | 98 | 19 s |
| `pixelAt` | 143 | 14 s |
| everything else | — | 5 s |

`waitFrames` waits for three animation frames and averaged **3.65 s**.  The
in-page gaps read `[7 ms, 5934 ms, 16 ms]` — one stall, then 60 fps.

**What it was not.**  Not contention: identical at `--workers=1`.  Not idle
rAF throttling: forcing damage every tick changed nothing, and
`--disable-gpu-vsync --disable-frame-rate-limit` fixed idle rAF (171 → 17 ms)
only to move the stall onto `page.screenshot()` (4.6 s) and cost 13 failures.
Not a timeout: it burns **105% of one core for 4.45 s**.  Not cacheable: a
persistent Chrome profile makes no difference.  Not the browser's: a bare
WebGPU triangle — new device, new canvas, same flags, same page-per-test
pattern — costs 20–244 ms to set up and 30–50 ms for its first frames.

**It is v4's own shaders**, compiled by SwiftShader on the first frame of every
instance.  Dawn returns from `createRenderPipeline` in 0 ms and compiles when
the pipeline is first *used*, so building the set at init does not pay for
itself — it moves the compile onto the first frame, for every feature the graph
does not use.  Priced by stubbing each out, on a one-node graph:

| | first frame |
|---|---|
| all 12 draw pipelines (as shipped) | 4.60 s |
| node pipeline only | 2.65 s |
| no draw pipelines at all | 1.06 s |
| — of which: node 1.58, curved edge 0.68, curved arrow 0.28, edge label 0.22, image 0.17, chart 0.13, arrow 0.12, ghost 0.20 | |

A real adapter shows the same shape an order of magnitude smaller (0.53 s), so
this is first-frame latency for every consumer, not only a CI cost.

**`createRenderPipelineAsync` does not help**, which is worth recording so the
next round does not try it: awaited, it is ~15% better and scales *perfectly
linearly* (1/4/8 pipelines → 621/2409/4756 ms sync, 613/2013/4053 ms async).
Dawn compiles them serially on one thread either way.  The lever is not
compiling what you do not draw.

### What landed

1. **Deferred pipelines** (`src/render/renderer.mts`).  Image, chart, overlay,
   underlay, curved edge, curved arrow and both label pipelines build on the
   first frame that draws them; `NodePipeline`'s ghost pipeline likewise.  Four
   already sat behind a store count.  The curved pair needed a new one —
   `GraphStore.hasCurvedEdges()`, monotone, set where `FLAG_CURVED` is written
   — because recompiling costs more than holding a pipeline.  **4.60 s → 2.72 s**
   on a one-node scene, and unchanged for a graph that uses everything.
2. **A frame driver on the harness page** (`playwright-page/frame-driver.js`).
   This one fixed *correctness*, not only speed.  The renderer schedules
   through rAF, and an animation started while the page is idle does not begin
   for ~1 s on the software adapter: a 1500 ms linear tween had run **zero**
   frames 800 ms after `animate()` returned and had not moved a pixel until
   ~1.2 s, so two specs sampling mid-flight failed *deterministically* at
   `--workers=1` (verified against the unmodified tree — they were failing
   before this round touched anything) and several more were intermittent.

   A
   1 px element at `z-index: -1`, behind the opaque full-viewport container,
   ticking its opacity every frame, keeps BeginFrames coming.  It cannot change
   a pixel any spec samples, and it does not make Cytoscape redraw.
3. **`pixelAt` reads a clipped screenshot** decoded in Node rather than a
   full-page one shipped into the page as base64 and decoded through an Image
   and a 2D canvas: 67 ms + 68 ms → 6 ms, over ~94 calls.
4. **The workflow splits** into `ci-node` and one `ci-browser` job per
   Playwright project, each installing only the browser it drives and only
   `visual` building v3's baseline.  `npm test` is now
   `run-s test:node test:playwright`, so the chain a developer runs and the one
   CI runs still have a single definition.

### Measured, on this machine, CI flags, 4 workers

| | before | after |
|---|---|---|
| `renderer` project | 3.1 min, 100 passed / 4 flaky | **2.1 min, 104 passed** |
| `visual` project | — | 2.3 min, 75 passed |
| both in one run | 3.6 min, 2 failed / 1 flaky | 3.6 min, **179 passed** |
| node tier (`test:node`) | — | 64 s |

Sharded, the browser tier's wall clock becomes its slowest project rather than
their sum.

### Risks tracked

- **The deferred pipelines move a failure from init to first draw.**  A broken
  pipeline used to throw while mounting; now it throws inside the frame that
  first needs it.  The `visual` project draws every gated feature, which is
  what makes the change checkable at all — and it is why the curved gate has
  its own spec (`test/curve-stream-gate.mjs`, controlled both ways).
- **`hasCurvedEdges()` is monotone**, so a graph that curves an edge once holds
  two pipelines for its lifetime.  That is the intended trade; a counter that
  falls back to zero would recompile on the next curve.
- **The frame driver makes the harness page unlike a real page**, which is a
  real cost: a stall a user would see is now invisible to the suite.  The stall
  it hides is documented above and in the file, and it is a property of the
  *software adapter*, not of the library — but if v4 ever ships a
  frame-scheduling change, this is the file to read first.

### Round 53.1 — the browser suite made honest (2026-08-06)

The maintainer's read of the first pass: *"the tests should not be inherently
flakey, so address that"*, and *"run the webkit tests here locally anyway"*.
Both turned out to be the same kind of finding — a check nobody had ever run.

**WebKit had never run on this machine, and the job it now has would have been
red.**  Playwright refuses to launch a browser whose host requirements it
cannot verify, and it verifies them by mapping shared-library needs onto *apt*
package names — a false negative on any non-Debian distro.  Skipping that
check (and supplying WebKit's `libjpeg.so.8`, the jpeg8 ABI Fedora does not
build) took the project from "cannot start" to **102 skipped, 2 passed, 1
failed**.  The failure is real and predates everything this round did:
`ready rejects when no adapter can be acquired` stubs `navigator.gpu` — which
Linux WebKit does not have — so it threw instead of asserting.

It skips now;
the sibling that covers *that* state, `hard error when WebGPU is unavailable`,
is one of the two specs that do run there, and passes.

That is the second time in two rounds that the answer to "is this green?" was
"nothing has ever run it".

**The flakiness was structural, and its cause is a real product characteristic.**
Nine specs asserted something about a running tween by sleeping to a fixed
offset and reading one pixel.  Rewritten to poll for the state they are named
for, they are both more honest and **faster: 29.5 s -> 12.7 s** for the ten
animation specs, because a poll returns when the state arrives rather than
sleeping a fixed remainder.

The bound on those polls is where the round learned something.  A first
attempt used tight timeouts, reasoning that a bound below the tween's duration
was what proved a sample was mid-flight — and it failed **5 runs in 10**.
Tracing it with four concurrent browsers: a screenshot taken **1779 ms** after
`animate()` returned still showed the node at its start with `animated()`
true.  A tween's compute pipelines compile on the *first* `animate()` of a
page — Dawn defers compilation to first use, the same property behind this
round's deferred draw pipelines — and on the software adapter under load that
stalls the first animation by up to ~1.8 s.  The tween's clock starts after
the stall.

So the timeout is not what keeps such a spec honest; **the state being
unobservable at rest is**.  For most of the nine the predicate itself carries
that (a settled node does not sit 35 px past its target).  For the four paint
specs the end colour satisfies the predicate, and the assertion after the poll
is the discriminator — a stale CPU column, or green leading red on the OKLab
path, which yellow fails with them equal.  `untilMidFlight`'s doc comment says
so, because that pairing is what an editor could break without noticing.  Five
controls, each breaking one behaviour deliberately, all fail.

**One worker per core is the setting that fails.**  Every project drives a
browser rendering WebGPU, and without hardware that is SwiftShader, which is
itself multi-threaded.  Three retry-free runs of the renderer project at each
setting, 16-core box, software adapter:

| workers | wall | result |
|---|---|---|
| 16 | 1.5 min | 3 failed / 1 failed / clean |
| 8 | 1.6 min | clean / clean / clean |
| 4 | 2.1 min | clean / clean / clean |
| 2 | 3.5 min | 1 failed |
| 1 | >10 min | — |

One-per-core is exactly what the runner was using (4 workers, 4 vCPU).  Half
is as fast and does not fail.  Serial — which was the maintainer's first
instinct — is 6× the wall clock, and its long tail brings its own timeouts.

### Where it ended up

`npm test` runs clean on this machine end to end, **2m41s, exit 0**: 2021 +
248 + 24 Node tests, the throw gate, lint, and all three Playwright projects
(181 passed, 102 skipped).  Under the CI configuration, three retry-free runs
of the renderer project are 104/104, and `visual` is 75/75.

### Risks tracked

- **Generous poll timeouts trade failure latency for reliability.**  A broken
  tween now takes 6 s per spec to fail instead of 1.2.  That is the right
  trade while the first-`animate()` compile stall exists, and it is the number
  to revisit if that stall is ever fixed.
- **The first-animation stall is not a test problem.**  A user's first
  animation on a software adapter is late by up to a second.  Warming the
  tween pipelines at init would move the cost into startup, which is already
  slow; that is a judgement call, not a bug fix, and it is left open.
  *(Logged as open call 18 at the sixth sitting, 2026-08-06 — revisit with
  data, alongside a noted future direction: a possible WebGL fallback
  renderer for platforms without WebGPU.)*
- **The libjpeg fix lives in Playwright's browser cache**, outside the repo,
  and `playwright install` will undo it.  AGENTS.md carries the command.

### Round 53.2 — what running it actually found (2026-08-06)

Three more defects, all of the same kind as 53's and 53.1's: things that had
never been executed in the configuration CI uses.  Plus a merge of the
**test/fix-v4** branch, which had been fixing one of them from the other
direction.  (Not in backticks: a code span holding only a rooted path is a
link candidate to the status build, and a branch name is not a file.)

**The merge.**  That branch makes the npm scripts self-sufficient —
`test:modules` and `test:playwright` build the bundles they read instead of
assuming someone did — and adds a stale-bundle diagnostic to the status wire
encoder, a tracked `v3/package-lock.json`, and the same `navigator.gpu` skip
53.1 had landed independently.  `package.json` merged cleanly and kept both
sides: `test` is still `run-s test:node test:playwright` from the CI split,
while `test:modules` is now `run-s build test:modules:run`.  Verified from
`rm -rf build v3/build`: **`npm test` exits 0 in 2m42s**, having built v4's
five bundles and v3's UMD baseline itself along the way.

The tracked lockfile also let both jobs that install v3 move to `npm ci`.
`ci-v3` had been running `npm install` against caret ranges, so it resolved a
different dependency set on every push — which is why an upstream release
could turn that job red with no commit touching this repo.

**`heap`, and a spec that needed one integer.**  Splitting the workflow lost
v3's install from the Node job, and `test/modules/benchmark-report.mjs` —
a spec about rendering an HTML report — failed with
`Cannot find package 'heap'`.  The first fix was to reinstate the install.
That was treating a symptom, and the maintainer's question ("why do we need
the heap package in the v4 tests?") was the right one.  Tracing it:

    benchmark-report.mjs  -> bench-run.mjs   (finishManualRun)
    bench-run.mjs         -> graph.mjs       (N)
    graph.mjs             -> v3/src/test.mjs (makeV3)  -> heap

`N` is `Number( process.env.BENCH_N ) || 2000`.  One integer.  It lived in
`graph.mjs`, which imports **both** libraries to build its `makeV3` /
`makeGpu` factories — and an ESM import evaluates the whole module, so
reading that number loaded all of v3 and all of v4.  `bench-run.mjs` is the
only one of graph.mjs's twenty importers that wants a constant rather than a
factory.  The run size moved to `benchmark/bench-size.mjs`, which imports
nothing; `graph.mjs` re-exports it, so the other nineteen suites are
untouched.  `test:modules` is now **250/250 with no v3 install at all**, the
CI step came back out, and AGENTS.md's "install both" rule — which named this
exact spec as its reason — was corrected to what is now true.

Worth noting how the failure *reads* on a runner, because it is misleading:
the spec file fails to **load**, so its 21 tests never register.  The suite
reports 229 rather than 250 and one failure named after the module rather
than the cause.  It looks like a broken spec and is a missing install.

**A console warning nobody had seen**, because the renderer project had never
run to completion on CI: `Canvas2D: Multiple readback operations using
getImageData are faster with the willReadFrequently attribute set to true`.
`pngAndSample` decodes an export into a 2D canvas and reads one pixel per
sample point, which is exactly the shape being named.  All four in-page
decodes in `renderer.spec.js` set the attribute now, as the two readback
sites in `src/` always have.

The two remaining unflagged 2D contexts in
`src/` are deliberately left alone: they are write-only (`putImageData` +
`toBlob`; `drawImage` + `createImageBitmap`), and forcing a canvas that never
reads back into software memory is a pessimization, not a fix.

### Is every suite in CI?

Asked, and audited rather than assumed.  Every test script is: v4's
`typecheck` / `test:js` / `test:modules` / `test:soak` / `test:throws` /
`lint` and its three Playwright projects; v3's whole `npm test` and its six
type suites.  There are also no spec files that no glob picks up — all 128
`test/*.mjs` are matched, and the only two excluded are the setup shim and
`types-surface.mjs`, which has its own script.

Three things run only by proxy.  Two are deliberate: **benchmarks** do not
run in CI because they are machine-dependent and reach the site only through
`benchmark:publish` from the machine that measured (their *tooling* is
gated by specs), and **`npm run dist`** is never executed —
`test/modules/packaging.mjs` proves a release *would* produce every file by
parsing `dist:copy` and `.npmignore`, which its own header states.

The third is worth recording as a known gap rather than closing:
`test/modules/status-site.mjs` imports `buildPlan` and nothing else, so
**`executePlan()` — the half that writes the deployable site — has no
coverage**, and `npm run status` runs nowhere.  The pure/writing split exists
so the spec need not copy 30 MiB of fixtures, and the consequence had not been
drawn.  It is 6.3 s to run; the decision was that CI is for tests, so if the
site build breaks it will surface on a deploy.

### Standing lesson from 53, 53.1 and 53.2 together

Every defect this round found was in something that had never been executed
in the configuration that matters — a fresh checkout, a runner without a
hoisted dependency, a browser project nobody could launch locally.  None of
them were regressions in the library.  A green suite says the paths that ran
are fine; it says nothing about the ones that never did.
