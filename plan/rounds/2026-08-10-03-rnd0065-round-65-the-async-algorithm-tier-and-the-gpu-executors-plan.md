## Round 65 — the async algorithm tier and the GPU executors (planned and landed 2026-08-10)

The design question arrived as "which algorithms could the GPU speed
up?", and the answer split the algorithm surface in two.  The
traversal tier (bfs/dfs, dijkstra, aStar, bellmanFord, kruskal,
tarjan, hopcroft-tarjan, hierholzer, kargerStein, degree/closeness
centrality) already beats v3 by 13–39× slot-native and is called
per-root in tight loops — the round-62.1 memo lesson is exactly that
usage — so it stays synchronous forever, and no GPU formulation would
beat it.  The dense-matrix and clustering tier (pageRank,
floydWarshall, betweennessCentrality, markovClustering,
affinityPropagation, kMeans, kMedoids, fuzzyCMeans,
hierarchicalClustering) sat at deliberate CPU-parity with v3
(identical math dominating, the round-33 reading) — which is precisely
the statement that only a different execution model moves it.

**Design calls (maintainer-approved in discussion, 2026-08-10):**

1. **The nine whole-graph algorithms are async-only** —
   Promise-returning, awaited once per computation (they are
   call-once-query-many, so the await is idiomatic), decided *now*
   because pre-4.0 the contract change costs a migration row and
   post-4.0 it is semver-major.  No `asyncPageRank()` twins: one
   spelling, and the executor choice stays inside the library.
2. **`executor: 'cpu' | 'gpu' | 'auto'`** (default 'auto') on each.
   'cpu' is the bit-reproducible f64 reference — the spec, the
   round-18.4 force-layout determinism precedent applied to
   algorithms.  'gpu' rejects rather than silently degrading when
   WebGPU or the algorithm's GPU path is missing.  'auto' takes the
   GPU above a per-family measured crossover; only acquisition
   failure and GpuUnfitError (input past device buffer limits) fall
   back — a kernel error propagates, so a defect cannot hide behind
   the router.
3. **Contracted CPU-only paths** say so: weighted betweenness
   (Brandes over weights needs a priority queue), custom distance
   functions and attribute-less feature runs (kernels never call back
   into user code).

**Landed, in six commits (65.1–65.6):**

- **65.1** the async reshape: per-module `*Async` wrappers (sync
  validation throws at the call site; everything later is a
  rejection), the executor router (`src/algorithms/executor.mts`),
  standalone device acquisition (`algo-gpu.mts` — no canvas, no
  renderer coupling, cache cleared on loss), the four spec files
  converted to await, `test/algorithms-executor.mjs` pinning the
  routing contract with stubbed-navigator paths so every guard fires
  in the Node tier (throw gate at zero), `cmpAsync` in
  `benchmark/algorithms.mjs` (rotation + 62.5c pre-warm preserved;
  the gpu-side await asymmetry is µs-noise under ms rows),
  MIGRATING.md, d.ts.
- **65.2–65.4** the kernels, family by family, each validated on a
  real adapter before its commit: shared dense WGSL
  (`algo-gpu-dense.mts` — tiled matmul, column ops, rounded compare,
  the flags discipline: all iterations encoded up front,
  barrier-free kernels early-return on the converge bit, the matmul
  guards its store instead because WGSL uniformity analysis forbids
  divergent returns before workgroup barriers), MCL, pageRank, FW
  (per-k relaxation over a bumped storage counter; finite 3.0e38
  sentinel instead of Inf — WGSL may assume finite floats),
  AP (row/column-owning kernels; the exemplar-history convergence
  ring verbatim; 'as' is a WGSL reserved word), the feature-space
  clusterers (featuresOf materializes attributes once; k-medoids
  turns its iterations into O(n²) lookups over two device-built
  matrices; fcm's one deliberate deviation — denominators clamp at
  1e-30 where the CPU would NaN/Inf — is noted on the kernel), the
  hierarchical pair-matrix (merge chain stays CPU under every
  executor), and pulled level-synchronous Brandes (one writer per
  node, no atomics; 64-source batches; weighted contracted out).
  One live catch: extracting `buildBrandesNeighbors` displaced the
  impl's doc block onto it — the seventeen-instance stranded-block
  hazard — and the JSDoc gate caught it red before commit.
- **65.5** the parity suite (`playwright-tests/algorithms-gpu.spec.js`,
  riding the renderer projects): nine live CPU-vs-GPU comparisons —
  discrete results exact, floats under f32-honest tolerances, plus
  the in-browser routing contract.  Controls run per the
  can-it-fail rule: MCL fails with the inflate exponent degraded,
  betweenness fails with sigma corrupted; both reverted, 9/9 green.
  One assertion corrected by its own first failure: the pageRank
  fixture has genuinely *tied* ranks, which f64 and f32 break
  differently, so the ordering invariant is zero inversions among
  pairs separated by >1e-4, not total-sort equality.
- **65.6** the sweep (`npm run benchmark:algorithms-gpu`): whole
  public call, cpu vs gpu, per family per size, adapter identity
  reported and SwiftShader refused.  On this machine (amd gcn-4,
  RX 570-class): markovClustering **71.9× / 266× / 478×** at
  n=256/512/1024 (31.2 s → 65 ms), kMedoids 9.6–36.6×,
  floydWarshall 2.4–16.7×, fuzzyCMeans ~7.5×, kMeans ~2×,
  hierarchical ~2× (the CPU merge chain is the shared floor),
  betweenness 0.74× → 3.6× (crossover ~1024), affinityPropagation
  0.65× → 1.43×, pageRank 0.70× → 1.33× (both ~1024) — the serial
  per-row/column kernels are the modest tier, the dense-matmul and
  n²-matrix families the headline one.  Each wrapper's 'auto'
  threshold now encodes its measured crossover in place of the
  uniform 256 guess, machine-stamped for re-measure.

**Open follow-ups, logged not scheduled:** two-stage reductions for
the serial pageRank/AP kernels (would move their crossovers left); a
device-side benchmark row via gpu-timer to split kernel time from
upload/readback; Playwright coverage of the algorithms-gpu suite on
WebKit once its compute story firms up; and revisiting `GPU_MIN_N`
constants when a second machine's published sweep exists.

### 65.8 — the kernel performance pass (2026-08-10)

"See how far you can push it."  The 65.6 sweep's modest tier had a
common signature once read as a profile rather than a scoreboard:
kernels launching one *invocation* per row, column or cluster — n
threads total, two workgroups at n=512, a >95%-idle device.  The pass
was therefore mostly an occupancy pass, plus three structural items,
each verified against the parity suite and re-measured in isolation
before moving on:

- **Workgroup-per-line rewrites**: pageRank's mat-vec (256 lanes
  stride the row — fixing coalescing and occupancy in one move — and
  tree-reduce), AP's responsibility/availability updates (the R row's
  top-two reduces with a (value, index)-lexicographic champion,
  reproducing the CPU's ascending `>=` tie-break exactly), the
  k-means/fcm centroid updates, and k-medoids' cost/pick kernels
  (argmin by (cost, index) — the CPU's first-minimum rule).
- **Dispatch-count surgery**: pageRank's epilogue (sum, scale, diff,
  converge) fused into one single-workgroup kernel — after the matvec
  fix, per-dispatch overhead × 200 encoded iterations was the
  dominant term; AP's tracking similarly fused from four kernels to
  two.  `workgroupUniformLoad` joined the flags discipline: it makes
  the converged bit *uniform*, so barrier kernels may return whole
  workgroups early instead of running converged iterations to
  completion and discarding the stores.
- **Blocked Floyd–Warshall**: the per-k chain (2n dispatches; most of
  the n=1024 run was dispatch overhead) replaced by the textbook
  three-phase blocked formulation — 32-wide k-panels, four dispatches
  per panel, shared-tile working sets, and a per-cell best-k register
  accumulation in phase 3.  The 5-node parity fixture is a single
  phase-1 block, so a multi-block n=100 spec joined the suite —
  distance parity plus path-sums-to-its-own-distance consistency
  (tie-tolerant where f32/f64 executors may route differently) — and
  its control (phase-3 relaxation weakened) fails exactly it while
  the 5-node spec stays green, which is the reason it exists.
- **Brandes batching**: 256-wide source batches, and a per-level
  check kernel that latches a frontier-empty bit the moment a level
  assigns nothing — every remaining encoded level no-ops, the
  between-chunk readback becomes a 16-byte completion probe carrying
  the deepest level (which sizes the dependency sweep exactly), and a
  batch costs two submits and one probe instead of a sync per 32
  levels.
- **The one CPU finding**: profiling AP showed ~640 ms of its n=1024
  run was *fixed* cost — the shared similarity build evaluated the
  attribute accessors per **pair** (n²·d calls, the round-18/62.2
  rule violated in code that shipped citing it) and took a
  comparator-sorted median of a million-entry plain array.  The build
  now materializes vectors once, runs named metrics as a tight
  symmetric typed-array loop, and `math.median` sorts typed input
  without a comparator (identical ordering — non-finites are
  rewritten before the sort).  The CPU executor got faster too, and
  the stats helpers' widened signatures displaced `min`'s doc block
  onto the new type alias — the stranded-block hazard's second
  appearance this round, caught red by the JSDoc gate both times.

Re-measured, one run, same machine (gpu ms, cpu×):

  markovClustering   47.2 ms at n=1024   663×   (65.6: 65.3 ms, 478×)
  kMedoids           11.8 ms at n=4096   146×   (61.3 ms, 37×)
  fuzzyCMeans        39.6 ms at n=65536   70×   (306.6 ms, 7.8×)
  floydWarshall      47.2 ms at n=1024    28×   (72.2 ms, 17×)
  kMeans             26.5 ms at n=65536   25×   (237.9 ms, 2.4×)
  betweenness        35.5 ms at n=2048    18×   (182.3 ms, 3.6×)
  affinityPropagation 298.8 ms at n=1024  3.8×  (1109.8 ms, 1.43×)
  pageRank           75.4 ms at n=2048   1.65×  (93.1 ms, 1.33×)
  hierarchical       (unchanged ~2× — the CPU merge chain is the
                      floor both executors pay)

Every family is now GPU-favored at every benchmark size, and the
'auto' thresholds moved left accordingly (pageRank/betweenness 1024 →
512, AP 1024 → 256, kMeans 2048 → 1024, fcm 1024 → 512, kMedoids
512 → 256).  What was deliberately left on the table, logged in the
round's open follow-ups: transposed R/A copies to coalesce AP's
column walks (~2.6 ms/iteration remains), 4×4 matmul register blocks
(shared-memory-limit tradeoffs), and pageRank's dense mat-vec, which
is now genuinely memory-bound — its real headroom is a sparse CSR
formulation, which would change the memory story rather than the
kernel.

### 65.9 — every benchmarked thing reaches the status site (2026-08-10)

The GPU sweep measured well and published nowhere: an ad-hoc JSON shape
in gitignored results/, invisible to the report, the publish machinery
and the archive — while the site's algorithm rows showed only the
Node-tier CPU executor, from runs that predated round 65 entirely.
The maintainer's directive: all the benchmarked things represented.

- **The sweep is a first-class producer** on render-bench's exact
  pattern: standard results shape (one job per family × size, benches
  `cpu` / `gpu` / `gpu first call` — the last carrying the
  once-per-page pipeline-compile stall the steady-state rows exclude),
  raw sample arrays through `toStats`, buildMeta provenance with the
  adapter identity, its own **`algorithms-gpu` profile**.  Publish,
  the index, pruning and compare-page grouping needed zero changes —
  the round-46.5 machinery was already generic.
- **The report learned the second pair form**: exact-named `cpu`
  beside `gpu` is a comparison pair (both sides v4) next to the
  classic v3/gpu one.  Dumbbells, the speedup overview, the scaling
  table (which now reads families × sizes for the sweep — 72×/300×/
  642× across MCL's three sizes on one row) and the tiles all light
  up; legends, tooltips, the pairs tile and the page tagline name the
  baseline honestly per run, and the run-time tile stops mislabeling
  'all'/'renderer' runs as 'quick' (hardcoded since 46.5).  The
  compare page's v3-twin noise control is deliberately *not* extended
  to cpu twins: v3 is frozen code, the cpu executor is live v4, and
  calling it a noise control would launder real regressions.
- **Three fresh runs published** (quick, all, algorithms-gpu — commit
  1f324088, plus the quick run on d4ff0730), so nothing on the site
  predates the round.  The first ladder design published between
  measurements and tainted its own second run's provenance — the
  dirty-tree refusal caught it, working as built; ladder 2 measures
  everything first and publishes at the end.
- **Reading the log, not the exit code, found a round-42 corpse**:
  `style-bundle.mjs` has been a module-level SyntaxError since the
  restructure's factory-rename sweep collapsed its two bundle imports
  onto one identifier — published as a recorded failure in every
  `--all` run since, its rows (the one measurement of style reads
  through the *built bundle*, the round-34 `__name` lesson's suite)
  absent from the archive the whole time.  Fixed (`cytoscapeV3`),
  and un-masking the compile error un-masked the guard beneath: the
  suite needs v3's ESM bundle, which the parity harness's UMD-only
  build does not produce.
- **The new compare-all page did its job on arrival**: it surfaced a
  +17–34% mover cluster in the curve-premium rows (no v3 twin)
  between the pre-65 run and the ladder's.  A solo re-run on the idle
  box read 2.2 ms where the ladder run read 4.43 (old run: 1.89) —
  the cluster is the box running hot late in an 18-minute profile,
  not a regression; the drift/twin framing exists for exactly this
  readout, and rows without a twin are where it must be done by hand.

Verified: the built site driven in Chromium (benchmark index lists all
four profiles; the sweep page renders 27 dumbbells, the cpu legend,
the scaling matrix; screenshots taken), module tier 344/344 including
the three new cpu-pair specs and their inexact-name control.

### 65.10 — the CPU takes two families back (2026-08-10)

The maintainer's directive after the wasm/SIMD/threads assessment:
build the plain-JS items, log the worker pool (ledger item 29).  Both
plain-JS items landed, and both ended somewhere more interesting than
"faster":

- **The hierarchical merge chain went flat** — distance matrix, min
  pointers, active order and sizes in typed arrays, the merge
  *structure* as a (left, right) log replayed iteratively at the end
  (a single-linkage chain makes the tree n deep; recursion was the
  tarjan lesson waiting to happen).  Custom linkage functions keep
  the object path — they need live Collections per merge.  Semantics
  pinned to the object path exactly: lower-triangle min seeding,
  first-in-order tie-breaks, the stale-min repair rule, in-order
  member order.  Then the profile said the *matrix build* dominated,
  and the 65.8 AP-build treatment (vectors once, metric inlined —
  `Math.pow(x, 2)` and `x·x` round identically, so entries are
  bit-identical) closed that too.  Net: CPU 73/306/1245 ms →
  **30/103/435 ms** at n=1024/2048/4096 — 2.5–2.9×, and now a *wash*
  with the GPU (0.92–1.03×), whose only edge was the matrix build the
  CPU just matched.  `'auto'` routes hierarchical to the CPU.
- **En route, a v3 defect**: `mean` linkage never worked — its `size`
  field is read by the weighted-average formula and never assigned,
  in v3 and the port alike, so the first mean merge wrote NaN
  distances and froze those rows out of every later merge (v3 tests
  only exercise `min`).  v4 now tracks sizes and deviates
  deliberately; two specs discriminate both the NaN behavior and a
  dropped size weighting, and both controls were run red.
- **PageRank went sparse**: temp = M·v decomposes into an O(E) edge
  gather plus two rank-1 terms (damping teleport, dangling mass), so
  an iteration costs O(E + n) instead of O(n²).  On the sparse bench
  fixture the CPU dropped from 30–124 ms to **0.3–0.6 ms**; at
  E = n²/12 — dense enough that the GPU's mat-vec was expected to
  win — the sparse CPU still measured ~5× ahead, because denser
  graphs converge in *fewer* power iterations.  `'auto'` therefore
  never routes pageRank to the GPU; the kernels stay for an explicit
  `executor: 'gpu'` and the parity suite, and the revisit that could
  change the verdict is a sparse SpMV kernel.  A `pageRankDense`
  family joined the sweep so the losing configuration stays measured
  rather than asserted.
- **The status site's benchmark archive went wide** (maintainer
  request): the shell gained a `wide` page variant that lifts the
  82ch prose cap while keeping paragraph caps, and the run table now
  uses the screen it is given.  A follow-up (2026-08-11, same
  request) made its rows **single-line unless the note needs more**:
  every column but the note holds a short fixed-shape value, and each
  was wrapping because the browser could shrink it to make room for
  the note — so a run with a one-line note, or none at all, still
  cost a two-line row.  `BENCH_CSS` pins those columns to `nowrap`
  and leaves the remainder to the note.  Measured at 1440 px: nine of
  thirteen rows fell from 50 px to 31 px, the four that stayed tall
  having notes that genuinely wrap.  The note's `min-width: 46ch` is
  the other half — without it the fixed columns win the layout on a
  narrow screen and the note is squeezed into a ribbon (760 px: a
  193 px note column, rows five lines deep — *worse* than before), and
  with it the table overflows and `.table-wrap` scrolls, which is what
  that wrapper exists for.

The round-65 scoreboard reads differently after this: the "GPU-modest
tier" is gone — not because the GPU got faster, but because the CPU
implementations stopped leaving their own headroom on the table.  The
honest routing table now sends pageRank and hierarchical to the CPU
under 'auto', and the GPU keeps the seven families where it wins
outright.

### 65.11 — the comparison's movers, re-investigated: the instrument, not the library (2026-08-11)

The maintainer asked what the cross-commit pages are reporting as
performance regressions.  Across the four (machine, profile)
comparisons the mover tables flag **56** rows as slower than the
previous run beyond +10%.  Every one of them was traced, and **none
survives as a library regression** — four instrument mechanisms
account for the list, three of them measurable on this box in an
hour.  What follows is the evidence, because a verdict of "noise"
that is not measured is worth no more than the alarm it dismisses.

- **The mover threshold sits below the harness's own repeatability.**
  Eight back-to-back runs of `index.mjs` at one commit (identical
  code, idle box): **14 of 35 v4 rows span more than 10%** across the
  eight, 8 span more than 20%, 3 more than 30%.  The v3 rows — frozen
  code, same processes — span >10% just as often (15/35) but **never
  exceed 20%**, which is the shape to expect when the noise is
  proportional and v4's ops are ten to ten-thousand times smaller.
  `mut: position set [gpu]` reads
  `[50.7, 66.1, 66.1, 61.0, 69.3, 64.0, 47.6, 68.9]` ns over those
  eight — two clusters, not a trend — and the all profile's headline
  "+39% regression" is that flip caught between two published runs.
  A ±10% flag on the v4 side is therefore a coin toss for two rows in
  five.

- **The round-62 step in the core+collection series is 62.5c's own
  pre-warm.**  Every row that steps at `cf5727b4` steps on the *v4
  side only* — `core: filter(fn)` 263.5k → 344.2k ns with its v3 twin
  flat at 423.7k → 416.3k, and the same shape for `same()`,
  `collection()`, `degree()`, `outgoers()`, `neighborhood()`,
  `iter: filter(fn)`, `nodes ($("node") vs filter({group}))`.  Two
  controls place it:

  1. **Remove the eight alternations at HEAD and the old numbers come
     back.**  `core: filter(fn)` falls 352.2k → **261.8k**, against
     263.5k measured at `6df994f1` before the pre-warm existed;
     `outgoers()` 490.2 → **436.7** (was 439.9); `neighborhood()`
     963.7 → **898.2** (was 886.5); `degree()` 28.4 → **25.9** (was
     24.1); `iter: filter(fn)` 133.6k → **117.1k** (was 101.6k);
     `same()` 15.0 → **14.0** (was 12.5).  The v3 side moves ±2% under
     the same control.
  2. **The library is flat across the whole of round 62 when probed in
     isolation.**  A fixed probe — one library per process, monomorphic
     call sites, best-of-9 — run against ten worktrees from `6df994f1`
     to `cf5727b4` and HEAD: `cy.collection()` 46.4 → 47.8 → 47.3 ns,
     `node.degree()` 23.0 → 22.6 → 20.8, `nodes.same()` 11.9 → 12.1 →
     10.9, `nodes.filter(fn)` 107.0k → 109.5k → 101.9k, and
     `node.position()` 23.0 → 16.8 → 15.7 with the step visible at
     `90b71d6b`, which is round 62.5's hot column caches doing exactly
     what they were written to do.

  This corrects the record rather than the code.  62.5c priced the
  bias it removed at "~0.5–1 ns/call on the trivial accessor rows";
  measured, the pre-warm costs the **v4 side 12–35%** on any row that
  iterates, because the shared closure's *inner* per-element call site
  goes polymorphic too, so the cost scales with elements touched
  rather than with calls.  It lands on v4 alone because v4's
  per-element work is small enough for a polymorphic dispatch to be a
  large share of it and v3's is not.  Whether the pre-warmed number is
  the more honest one is a **question, not a defect**: it removes a
  real order bias between the two sides, and it also measures v4 in a
  state no application produces, since an app loads one library.  What
  is not defensible is the published series crossing a methodology
  change with nothing recording it — the step reads as a regression to
  every later reader, and did.

- **One-shot rows still lead the tables.**  **17 of the 56** flagged
  regressions are rows with `samples = 1` — twelve of the renderer
  profile's sixteen — the class round 62.7 already ruled out as a
  regression signal and wrote into `src/README.md`.  The comparison
  page carries no mark for it, and ranks by magnitude, so the all
  profile's number one (`curve premium: cy.elements().boundingBox()
  x 20`, **+52%**) is one measurement against one measurement.  49 of
  the 791 rows in an all run are one-shot (curves 22, arrows 21,
  labels 6).

- **The renderer's device pair flips between two modes, and the cause
  is still open.**  *(This entry was rewritten on 2026-08-11 after
  round 65.12 measured it.  The original said the sampler was the
  cause — `panScenario` recorded `gpuFrameMs` only when the value
  changed, so a two-mode series would contribute one sample per
  transition — and that was wrong.  The sample counts say so: the old
  sampler already yielded 120 of 121 frames, because the per-frame
  values jitter rather than repeat.  The dedupe-by-value was worth
  removing on its own terms, and 65.12 removed it, but it never
  explained the flip.  Recorded in full because a wrong mechanism
  confidently written down is worse than an open question.)*

  What is measured: across the four published runs the peak-slot p50
  reads 460 µs, 1.16 ms, 465 µs, 1.17 ms with no relation to the
  commit, and the page ranked the flip first at **+152%**.  Within a
  run the row is *stable* — at `e37d2444` min through p75 all 0.46 —
  so this is bistability per run, not per frame.  And 65.12's
  verification run pins it tighter still: in **one process**, the ten
  scenes split 0.46/0.47 (five), 0.57, 0.64, and 1.10/1.17/1.18
  (three), while the compacted twin reads 0.98 in every one of them.
  So it is per *scene instance*, not per run, machine or driver.

  The clue worth following: where the peak-slot row reads 0.46 it is
  **twice as fast as its compacted twin**, which is backwards — the
  peak-slot pan walks a 25 000-slot instance range with 2 500 live,
  the compacted one walks 2 500, and the cull pass covers the whole
  range either way.  A number that is too *good* usually means the
  measurement is covering less, not that the work is.  `GpuTimer.read`
  reports the span from the earliest begin to the latest end **across
  whichever passes have non-zero timestamps**, skipping any pair that
  comes back zero — so a frame whose render pass reported no
  timestamps would yield the cull pass alone and land exactly where
  0.46 does.  That is a hypothesis with a mechanism, not a finding:
  proving it needs the timer to report which pairs contributed, which
  is its own pass.

  `pick: hover while panning` is a different and simpler problem —
  **25 samples**, a 100 µs-quantized clock, min 0 · p25 100 µs · p50
  400 µs · p75 43 ms · max 73 ms on the ndex scene, where one sample
  crossing the median prints as +100%.  65.12 took it to 80 samples.
  Note what that verification could and could not show: on the
  `generated 25k × 50k` scene the p50 was already stable (17.4 ms at
  25 samples, 17.3 ms at 80), so the fix is justified by the ndex
  scene's distribution rather than demonstrated on it.

- **The algorithms-gpu movers track the sweep's composition.**  65.10
  changed three files under `src/algorithms/`:
  `src/algorithms/hierarchical-clustering.mts`,
  `src/algorithms/page-rank.mts`, and one **purely additive** export in
  `src/algorithms/clustering-distances.mts`.  Nothing on the
  kMeans / kMedoids /
  fuzzyCMeans / floydWarshall paths the page flags at +11–31%.  Two
  fresh runs at HEAD, same code, same adapter: `fuzzyCMeans` n=16384
  reads **12.8 and 12.8 ms** against the published pair's 12.4 → 16.3
  (the "+31%"), `kMeans` n=16384 **8.0 and 7.8** against 7.7 → 9.0,
  and `kMedoids` n=1024 **4.1 and 3.2** — a ×1.28 spread on identical
  code, bracketing both published values.  Where a systematic shift is
  plausible at all (floydWarshall n=1024, HEAD 46.4/50.4 against 42.1
  before), it tracks the sweep gaining the `pageRankDense` family
  *ahead* of those families in one shared page and one device, not any
  source change.  That profile's mover list also has **no noise
  control at all**: `twinOf` in `report-compare.mjs` looks up a bench
  named `v3`, and 65.9 taught `report-html.mjs`'s `pairOf` about the
  `cpu` baseline without teaching the comparison, so all ten rows
  print "no v3 twin" while their cpu twin sits in the same file.

- **One row is left open, with two suspects excluded.**
  `core: collection()` steps 57.1 → 68.2 ns at `cf5727b4` and stays
  there (66–68 at HEAD).  The pre-warm does not explain it (65.9 with
  the alternations removed), and neither does round 64's arity guard —
  deleting the `arguments.length` check at HEAD reads 65.4 and 66.6,
  i.e. free — while the isolated probe holds the constructor flat at
  46–48 ns across the same span.  So it is a suite-context cost of
  ~10 ns on a 57 ns row, not a library one, and it is the only flagged
  row this pass could not attribute.

**What the pass recommends** (none of it applied here — changing the
instrument changes the record, which is the maintainer's call):
mark `samples = 1` rows in the mover table or drop them from it;
give the comparison a per-row noise envelope from two same-commit runs
instead of a flat ±10%; teach `twinOf` the `cpu` baseline; record a
harness-methodology epoch in the published index so a step like
62.5c's is attributable at a glance; sample `gpuFrameMs` per frame
rather than per change; report the pick scenario's deferral share
instead of a 25-sample p50; and give `cmpMutEle` (collection.mjs),
`cmpMut` (core.mjs) and `cmpMut` (mutators.mjs) the 62.5c pre-warm —
they still share one op closure between the two sides, which is the
bias 62.5c exists to remove and the shape `mut: position set` is
bistable in.

### 65.12 — the instrument gets the rules 65.11 wrote down (2026-08-11)

The maintainer's concern, put plainly: the status site must not
suggest performance has been degrading when it has not.  Round 65.11
established that it had been doing exactly that — 56 flagged
regressions across four comparison pages, none of them the library —
and proposed rules.  This round builds them, because a rule that
lives in prose is read once by the person who already knows it.

The principle the whole round reduces to: **a comparison may display a
change only when it can name what was held constant.**  Machine
(enforced since 46.5), harness (new), and sampling (new).  Anything
else is a value, not a change.

- **`--repeat 3`, and the number is not arbitrary.**  The runner runs
  each job N times in N processes and publishes the per-row median,
  carrying **one repeat's whole stats object** — the median by p50 —
  rather than a per-key median, so no published row is a distribution
  assembled from parts.  Beside it goes `repeatSpread`, the band the
  repeats spanned, which is the per-row noise the comparison screens
  against.  Measured over the eight identical-code runs 65.11 left
  behind: single-vs-single flags **28 of 245** row pairs beyond ±10%
  (worst +48%); median-of-3 flags **0 of 105** (worst +9%).  Two is
  not enough (10% still flagged — these rows are bimodal, so a 2-run
  aggregate lands between the modes), and min-of-3 is no better than
  no aggregation at all (11%), because best-of takes the fast mode
  whenever it appears.  Three is the smallest N that reports the
  *majority* mode.  An even count resolves to the **slower** middle
  value, deliberately: an even split is where the evidence is weakest
  and flattering the library there is how a benchmark stops being one.
- **The harness fingerprint** (`benchmark/harness-id.mjs`), the
  machine fingerprint's twin.  Each job carries a hash of the suite
  file, its `./`-relative import closure (which is what makes
  `index.mjs` answer for `core.mjs` and `collection.mjs`, where its
  benches live) and the shared inputs — never `src/`, which is the
  subject.  `buildComparison` refuses a change across two hashes and
  renders `⋮ harness`, exactly as it refuses one across machines.
  Nobody declares an epoch; editing a bench file starts one.
- **What the hash ignores, and why that mattered immediately.**  The
  first thing it would have flagged is round 57.2 — `oxfmt`
  reformatted every benchmark file in one commit and moved no number.
  A break nobody believes is worse than no break, so the hash is over
  comments-stripped, whitespace-normalised text, and the control is a
  spec: a reformat is inert, a changed constant is not.  What survives
  normalisation can be declared in `EQUIVALENT_HARNESSES` with a
  reason — the shape of `throw-coverage.mjs`'s exemption lists, and
  audited the same way, so an entry naming a hash the archive no
  longer carries fails rather than sitting there reading as
  permission.
- **The archive was backfilled from git**
  (`scripts/benchmark-backfill-harness.mjs`), so all thirteen
  published runs carry the hashes their own commits imply.  An
  unstamped run is treated as *unknown*, never as unchanged.
- **The mover table screens, and the page leads with the verdict.**  A
  row that moved is a regression only if it clears its own measured
  band; a one-shot row (`samples = 1`) never is — round 62.7's rule,
  enforced rather than written down.  Everything else goes to a
  collapsed *unscreened* list with the reason stated, ranked nowhere.
  The verdict sits above the tables and refuses to overclaim in the
  other direction too: "no row regressed" and "no row could be
  compared" are different sentences, and a page spanning a harness
  change says the second.  `twinOf` also learnt the `cpu` baseline,
  which `report-html.mjs` was taught in 65.9 and this module was not —
  all ten algorithms-gpu movers had been printing "no v3 twin" with
  their twin in the same file.
- **The two renderer samplers — and what verifying them corrected.**
  `panScenario` recorded a device time only when the *value* changed,
  which cannot distinguish a repeat from a stale reading; `GpuTimer`
  counts its readings now and `RendererStats.gpuFrameReadings` exposes
  the counter, which is what a sampler needs (a value cannot say "I am
  new").  That is right in principle and **it is not what caused the
  +152% flip**, which 65.11 had claimed: the run that verified it
  reads 121 samples where the old sampler read 120, because the
  per-frame values jitter rather than repeat.  The 65.11 entry above
  is rewritten with the measurement and the flip is back to being an
  open question, with a hypothesis (the timer's pass-span may be
  covering fewer passes in the fast mode) and the observation that
  makes it interesting: in one process the ten scenes split
  0.46–0.64 ms and 1.10–1.18 ms while the compacted twin holds 0.98
  throughout, and where peak reads 0.46 it is *faster than a pan over
  a tenth as many slots*.  The pick scenario went from 25 samples to
  80, on the same reasoning as before but with its evidence stated
  properly: it is justified by the ndex scene's 0 → 73 ms spread, and
  the scene the verification actually ran was already stable at 25.
- **The three mutation helpers got the 62.5c pre-warm** they never
  had.  This was the *cause* of the archive's most bistable row, not
  only its symptom: `mut: position set` spanned 47.6–69.3 ns in two
  clusters over eight runs, and with the pre-warm it measures a
  **2.7% band** across three repeats at 52.0 ns.

**What the pages say now.**  Re-rendering the existing archive through
the new comparison: **0 regressions on all four pages**.  Not because
the tables were emptied — because 81 of the algorithms-gpu profile's
rows and 184 of quick's are behind a harness break (the sweep gained
the `pageRankDense` family; the core suites crossed 62.5c), and the
remainder are listed as unscreened with their reason, the archive
having been measured without repeats.  The mechanism reproduced
65.11's two manual findings on its own, which is the argument for
having built it: the algorithms-gpu movers *were* a sweep-composition
artifact, and the quick profile's step *was* 62.5c, and neither
conclusion now depends on someone remembering.

**The acid test, and what it cost to run honestly.**  Two `--repeat 3`
quick runs at one commit, on a clean tree, 22.6 min each — identical
code, so every change between them is false by construction.  The
comparison reports **0 screened regressions** and drift +0.1% over 219
rows.  Six rows moved beyond ±10%; five were caught by their own band.

The sixth is the number worth publishing: `mut-bulk: select + unselect`
moved **−11.3%** where run A's three repeats had agreed to 1.3% and run
B's to 9.2%, so the screen let it through.  That is not a bug to tune
away — a three-repeat band is a *sample* of the noise, not the noise,
and a row whose distribution has a mode three draws can miss will
occasionally clear it.  Stated as a rate: **1 false flag in 219 rows,
against 6 under the flat ±10% the page used before.**  The pair is
published as replicates with notes saying so, and the mover row carries
its band in the evidence column, so a reader sees the same thing this
paragraph says.

The instrument also measured its own blind spot.  Of 106 v4 rows, **94
(89%) have a band tight enough to detect a real +10% regression**; 12
do not, 3 are worse than 20%, and the worst is `sweep: elements()` at
4.9 ns with a **551%** band — round 62's sub-floor rule, arriving as a
measurement instead of a warning.

A first pair was discarded before publishing: both runs carried
`dirty: true`, because a `report-html.mjs` edit sat in the tree when
`buildMeta` stamped them.  That file cannot touch a number and is
excluded from the fingerprint by design — and publishing the run that
establishes the epoch's noise floor with an asterisk on it is exactly
the asterisk this round exists to remove, so the pair was re-run on a
clean tree.

Verification: 2167 test:js, 384 test:modules (25 comparison specs, 29
new for the fingerprint and the merge, 2 for the index marker), 24
soak, throw gate 213/0 never-run, JSDoc 100% with the new
`gpuFrameReadings` documented, types regenerated, lint and format
clean.  Eight controls run red, each failing exactly its spec — the
formatter rule, the import walk, the whole-stats merge, the union
shape, the ledger audit (both entries), `sameEpoch` forced true,
`screenOf` forced true, and the cpu-twin fallback.

### 65.13 — "the debug page doesn't work with the binary networks" (2026-08-11)

The report: the hosted harness fails on the networks that load from a
fixture — enrichmentmap named as the example — while the generated ones
are fine.  The investigation found the binary path **correct**, and the
message it prints **wrong in a way that produces exactly that report**.

**What was measured before changing anything.**  Every fetched fixture,
encoded and decoded through the page's own two functions and compared
column by column against the JSON path: 26,173 nodes and 574,515 edges,
**no column lost, no value changed**, positions within 2.3e-4 of f32,
edge endpoints identical.  Then the page itself, driven in Chromium on
both servers — the JSON tree on 3333's shape and the built `status/` on
3335 — for all **fourteen** networks: identical node/edge/glyph counts,
and the two screenshots of em-web differ by **20 pixels of 765,000**
(0.003%), which is antialiasing.  Picking, a data query, a click-select
and a wheel-zoom all agree across the two paths.  The `?columnar=true`
and `?binary=true` toggles work on every fetched network, up to the
465k-edge one.  A six-day-old encoder round-trips every fixture too, so
the format is as tolerant as its version rule claims.

**The defect is the error handling, and it is binary-specific by
accident.**  `init.js` called `loadNetwork` *inside* the fixture's
promise chain, under a single `.catch( fail )`.  So every error the
library threw — the sheet compile, `cytoscape()`, the layout — was
reported as a fixture failure, and for a wire-loaded network the text
was "A decode failure means the buffer and the library disagree —
rebuild the site".  The eight generated networks build outside any
promise, so the identical failure surfaced there as itself.  A WebGPU
problem therefore reads as *"the binary networks are broken, the
built-in ones are fine"*.  Reproduced in Firefox (no WebGPU): em-web
printed the decode message, `v3-default` printed the real one.

**And a second, worse one underneath: the stats overlay erased the
error.**  `startStats` rewrites `#stats` every 500 ms, and the
`cy.ready` rejection — the *most common* real failure, no GPU adapter —
wrote its message there.  Measured in plain Chromium with no adapter:
the console carried "no adapter could be acquired" and the page showed
a blank canvas above "569 nodes, 6899 edges, 0 glyphs".  The one thing
a harness owes you, it was deleting twice a second.

Landed:

- [x] **`debug/load-error.js`** — the message, with the **phase passed
  in by the caller that knows it** rather than guessed from the error:
  `network` (the fetch never completed), `http` (the server answered,
  badly), `decode` (bytes arrived, would not parse), `init` (the data
  is loaded and the library failed).  Only `decode` may blame the wire
  buffer; `init` says how many nodes and edges came through and that
  the data is not the suspect.
- [x] **`init.js` restructured** so `loadNetwork` runs outside the
  fetch chain, and `showFatal`/`showStats` make a fatal message stick —
  the overlay cannot overwrite one.
- [x] **A `file://` diagnosis**, because opening `status/debug/index.html`
  from disk breaks every fetched network and nothing else, which is the
  reported symptom exactly.  It now says so and names the two servers.
- [x] **The encoder uses the bundle the page loads.**  `wire-fixtures.mjs`
  encoded with `build/cytoscape.cjs.js` while `debug/index.html` decodes
  with `build/cytoscape.umd.js`, and its own comment claimed that made a
  mismatch "impossible by construction".  It did not: `npm run watch`
  rebuilds the UMD alone and `npm run status` builds nothing, so a tree
  can hold a fresh UMD beside a CJS from any earlier commit.  Latent, not
  broken — but the invariant the comment asserted is now the one the code
  has, pinned by a spec that reads the page's script tag.

Verification: 7 new specs in `test/modules/debug-harness.mjs` and 1 in
`status-site.mjs` (388 test:modules, 0 fail), and three controls run
red — every phase given the wire-decode hint fails exactly the four
specs its comment names, renaming a phase string fails the routing
spec, and pointing the encoder back at the CJS fails the bundle spec.
All fourteen networks re-driven on both servers after the change, plus
the four failure paths: no-adapter Chromium, Firefox, `file://` and a
404 each report their own cause now.

**What is *not* explained.**  Nothing measured here makes a binary
fixture fail on a working browser, so if the page is still blank after
this, the message on it is now the evidence — it will name the phase.
