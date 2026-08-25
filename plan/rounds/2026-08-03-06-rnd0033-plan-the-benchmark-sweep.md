## The benchmark sweep

Rounds 29–32 worked one axis in four passes: what exists and is
asserted by nothing (29), what throws and is *run* by nothing (30),
what those throws say when they fire (31), and what the shipped
documentation states about what a member takes (32).  This round takes
the same question to the third measurement axis — **what costs what** —
and the starting answer is that roughly a third of the prototype has no
benchmark at all, while the report's job table runs eight jobs out of
fourteen suites.

The round's scope, set by the user (2026-08-03): **benchmark
everything possible** — core, elements, layouts, algorithms, the store,
the style engine, loading, interaction, the renderer.  Not "add a few
suites": close the gap between what v4 claims about its performance and
what a single command can reproduce.

### Code investigation (2026-08-03, precedes this plan)

**What exists** — 14 Mitata suites, the browser renderer bench, and
the report harness (`bench-run.mjs`, `graph.mjs`, `report.mjs`,
`report-html.mjs`, `render-stats.mjs`):

- **In the job table** (`report.mjs`, quick profile — eight jobs):
  `index.mjs` (= `core.mjs` + `collection.mjs`), `materializers`,
  `mutators`, `scenarios`, `traversal`, `algorithms` (twice — at 2k,
  and at 500 for the superlinear ops the 2k run gates off), `mappers`.
  `--full` adds the 20k/200k matrix, with `BENCH_OP` splitting
  `mutators`/`scenarios` one group per process at 200k.
- **Standalone, by hand only** — the six of open call 7:
  `compaction` (19.5), `labels` (16.5), `transitions` (24.2),
  `geometry-tween` (25.6), `compound` (14.12), `curves` (29.4).
- **Browser** — `render-bench.mjs`: six scenes (25k and 100k flat,
  ndex-x-large, 25k curved, 25k compound, 25k images), opt-in behind
  `--renderer`, needing built bundles and a real adapter.

**What is unmeasured.**  Fifteen findings, each a surface the docs
describe and no suite prices:

1. **Layouts: nothing at all.**  Six built-ins (`grid`, `preset`,
   `circle`, `concentric`, `breadthfirst`, `random`) plus `force`, and
   not one Node benchmark — the only layout numbers in this file are
   the pass-1 record's grid figure (200k nodes 270 → 24 ms, from
   one-off profiling of the perf-round-2 slot path) and the browser
   bench's `--layout` force-vs-cose mode, run once on the RX 580.  The
   `layoutPositions` plumbing (spacingFactor/transform/fit, the
   animated path) and the round-17 contract's `ctx.setPositions` are
   likewise unpriced, and the contract is the surface external authors
   build on.
2. **The algorithm tail.**  `algorithms.mjs` prices 18 rows covering
   17 of the 21 algorithms: `kMedoids`, `fuzzyCMeans`,
   `affinityPropagation`,
   `kargerStein` and unnormalized `degreeCentrality` have no row, and
   the *weighted* variants of `betweennessCentrality` and
   `closenessCentrality` (the branch that actually runs a heap) are
   only exercised unweighted.
3. **The style engine.**  `cy.style(sheet)` compile + `applyAll`,
   the first apply of elements added inside a batch, the round-4
   selection-restyle skip (`dependsOnSelection`), the round-14.6
   parents-overlay partition, and the stored-truth readback getters
   (`style()`/`renderedStyle()`/`numericStyle()`) are all unpriced on
   their own.  A whole-sheet swap appears in `transitions.mjs`, but
   only as a transitions-off-vs-on ratio, and in `scenarios.mjs` as
   one step of the refresh trace.
4. **Loading and the wire format.**  The init figures this file
   quotes most (definition-form 662 → 236 ms, columnar 80 ms,
   deserialize ~5 ms, 9.2 MB vs 30 MB) come from one-off profiling of
   ndex-x-large during the pass-1 follow-ups.  There is no suite:
   `toColumnarElements`, `serializeElements`/`deserializeElements`,
   `cy.serialize()` and the three `options.elements` forms have no
   re-runnable row.  Round 29's survey dropped this as "already
   priced", which is exactly the assumption this round exists to
   question — **a number nobody can re-run is a record, not a
   measurement.**
5. **CPU picking.**  `pickNodeAt` is the pointer layer's hot path and
   is priced only *inside* `compaction.mjs`, as a peak-vs-compacted
   before/after.  Nothing measures it against v3's renderer pick, or
   across the shape branches round 27 added (the round-* offset
   polygon, `barrel`'s four sampled beziers, the custom polygon blob
   walk), or with `text-events` label boxes in the scan, or at
   different zooms — and 28.1 recorded `insideRoundPolygon` as the one
   shape test that is not affine-invariant, so zoom is a real axis.
6. **Box selection.**  `elementsInBox`/`refsInBox` appears once, as a
   curve *premium* row in `curves.mjs` (3.29× — a figure 33.5 then
   found to be measuring a degenerate call; really ~2.3×).  Its
   absolute cost,
   and the comparison against v3's `getAllInBox`, are unmeasured — as
   are the round-16.5 label-containment term and the round-20.2
   interactive filter.
7. **Bounds and fit.**  The whole-graph scan is priced only in
   fragments: label terms in `labels.mjs` (~0.1 µs/label), the curve
   premium in `curves.mjs` (1.05–1.16×), a parity control in
   `compaction.mjs`.  The pass-1 fast-path figure (ndex 235 → 15 ms)
   is another one-off.  Nothing prices `boundingBox`/`fit`/
   `getFitViewport`/`boundingBoxAt` against v3 across graph sizes.
8. **The data() sidecar.**  One `data set` row in `mutators.mjs`,
   which its own record calls GC-noisy at 200k.  Unmeasured: the
   per-column kind split (f64 + present mask vs dictionary strings vs
   the plain-array fallback), dictionary growth and the round-11
   refcount/compaction path, `removeData`, whole-object `data()`
   reads, and the `DataStore.reader` hoisting the scan paths depend on.
9. **Queries beyond flag scans.**  `materializers.mjs` covers the
   `(mask, want)` flag scans thoroughly.  The round-10 A8 **data
   conditions** (`{ data: { weight: { gt: 0.5 } } }` — per-key readers
   hoisted out of the loop) and the round-14.7 **structural terms**
   (`{ parent: true }`) have no row, though both are the documented
   replacement for v3 selectors people will benchmark against.
10. **Events.**  The whole emit surface rests on one figure — ~85
    ns/listener call, from round 5's scenario sweep.  Unmeasured: cost
    by qualifier kind (ref-qualified vs predicate vs unqualified core),
    scaling in listener count, the listener-gated no-op path that most
    of the write side depends on for its numbers, and — the claim most
    worth pinning — round 14.5's **"the flat no-compounds path stays
    byte-identical (zero cost)"**, which no measurement has ever
    checked.
11. **The animation manager.**  `transitions.mjs` and
    `geometry-tween.mjs` price *ticks*, thoroughly.  Nothing prices
    animation **start/stop**, the round-21 channel-eviction compare
    (`touchedColumns()` across shared refs — the per-start cost that
    replaced the queue), `delay`, the round-24.3 controls, or the
    viewport path.
12. **Images and charts.**  The round-15 registry (url dedup,
    refcounts, tier assignment, the blob records) and the round-23
    chart blob writes have no CPU sweep; `chart-values` via the
    `{ data }` passthrough refreshes per data write and is unpriced.
    On the device side the `gen-25k-images` scene has **never been
    measured** — 15.7 recorded "software adapter on this box", which
    2026-08-03 corrected as wrong for the third time.
13. **Store internals.**  `compaction.mjs`'s churn section proves the
    round-11 reclaims *hold* (blob KB, dict entries, CSR shape) but
    prices none of them: the id-map probe/insert and blob compaction,
    the `Adjacency.rebuild` two counting passes, `CurveBlob` waste
    reclaim, and `DirtyTracker` span coalescing are all unpriced, and
    they are what every bulk path funnels through.
14. **Renderer-bench gaps.**  Beyond the images scene: `--layout` has
    been run once (2026-08-01); the 100k and ndex scenes have not been
    re-run since round 27 (29.5 deliberately scoped its comparison to
    the four 25k scenes); no scene exercises the round-22 visibility
    split, the round-20.2 `events` pick mode, or a label-heavy wrapped
    configuration — the one round 25.6 named as the expensive case.
15. **The report understates the suite.**  Open call 7: six suites are
    outside the job table, the renderer bench is opt-in, and there is
    no profile that runs everything.  A reader of `report.html` sees
    less than half of what has been measured.

**Negative results, recorded so they are not re-derived.**

- **`benchmark/` (v3's own suites) stays untouched.**  It runs against
  `documentation/`-era fixtures and the v3 API, and v3 is frozen until
  v4 ships.  v3 comparisons belong in `benchmark/`, where
  `graph.mjs` already builds one element list for both factories.
- **The anti-hoisting methodology does not need revisiting.**
  `core.mjs`/`collection.mjs` rotate operands over a pool of K = 8 so
  V8 cannot hoist a pure loop-invariant call out of the measured
  region — the fix that stopped `same()` mis-reporting by five orders
  of magnitude.  New suites reuse it rather than inventing a harness.
- **Suite health is not the problem.**  30.0 re-ran all six standalone
  suites at `BENCH_N=2000`, exit 0 apiece.  This round is coverage and
  reporting, not bit-rot.

### Design calls (round 33)

1. **A benchmark is either v3-comparative or gpu-only, and says
   which.**  A comparative row needs an *idiomatic* v3 analogue on the
   other side (the `cmp( name, v3Op, gpuOp )` shape the suites already
   use where the dialects differ); everything else is a gpu-only
   absolute cost, or a premium against a v4 baseline of the same shape
   (the 29.4 form).  No row fakes a comparison by benchmarking v4
   against a v3 call that means something else — the report's speedup
   overview is only worth reading if every 1× line is real.
2. **Every performance claim in the docs gets a re-runnable source.**
   The round's honesty rule, and the direct analogue of round 30's
   throw coverage: a figure quoted in `src/README.md` or this file
   either becomes a row in a suite, or is marked in place as a
   **historical one-off** with the date and machine it came from.  The
   four that matter most are the init figures (finding 4), the grid
   layout figure (1), the fit fast-path figure (7) and the emit figure
   (10).
3. **Standalone suites join the report; the report gains a profile
   that runs everything.**  `report.mjs`'s job table takes all
   fourteen suites, with a `gpuOnly: true` marker for the ones that
   have no v3 side, so `report-html.mjs` renders them as absolute
   costs rather than against a 1× reference line that means nothing
   for them.  `--all` runs every suite plus the renderer bench.  This
   closes open call 7 with the answer the user's scope implies.
4. **Warmup and deferral discipline is mandatory, and stated per
   suite.**  29.4's two corrections are the standing method: whichever
   side is measured first pays the module's JIT warmup (a drag read
   2.52× and settled at 1.16× once both sides were warm), and v4
   **defers derivation to the first read**, so a row that writes and
   never reads measures a flag write.  Every new suite documents which
   of the two it had to handle, in its header.
5. **A row that reads ≈1× is checked before it is reported.**  The
   generalization of the same pass: parity is a finding only after the
   row has been shown to be measuring the thing it names.  Two of
   29.4's rows were not.
6. **Scale points are declared, not implied.**  Comparative suites run
   the existing 2k/20k/200k ladder (`BENCH_N`), superlinear ops gate
   on it, and any group whose 200k form exceeds the heap with two live
   instances runs one group per process via `BENCH_OP` — with the
   `report.mjs` op tables kept in step with the group names, which is
   the coupling that already exists for `mutators`/`scenarios`.
7. **Numbers are recorded as factors first.**  Wall figures are
   machine-local (the RX 580 / i9-9900K box these rounds have used);
   the round record states the machine once and reports ratios and
   per-element costs, the convention 25.6 and 19.5 already follow.
8. **A benchmark-coverage audit ships, and reports only.**  The third
   tool in the `gpu-jsdoc-coverage` / `gpu-throw-coverage` family:
   `scripts/bench-coverage.mjs` maps a maintained manifest of
   public surfaces to the suites that price them and lists what has
   nothing.  It **always exits 0** — a benchmark floor is a policy
   call, and the mapping is a name-mention scan whose limits are
   recorded up front (round 31's event survey misreported 31 names
   because browser specs register them from an array, and the same
   failure mode applies here).  It answers "is this still true?" for
   the claim this round is making, and nothing stronger.

### Pass split (docs in-commit; each pass its own commit(s))

- [x] **33.0 Docs-first** (2026-08-03) — this plan section, open call 7
  marked scoped, and the README's Benchmarks section opened with the
  round's two rules (a row is v3-comparative or gpu-only and says
  which; every figure has a re-runnable source or is marked a
  historical one-off).  Landed before any suite, and amended in the
  same commit with the breadth pass 33.9 on the user's restatement of
  scope.
- [x] **33.1 Layouts** (2026-08-03) — landed as
  `benchmark/layouts.mjs`, and **two of its first rows were not
  measuring anything**, which is design call 5 earning its place on the
  first pass that used it.
  Rows (i9-9900K, N=2000 / 4000 edges, `fit: false` and a shared
  explicit `boundingBox` on both sides — a headless v3 viewport is
  1×1 px, so a viewport-sized layout would pack 2000 nodes into a
  pixel): **grid 153×**, preset map-form 21×, preset fn-form 32×,
  circle 9.9×, concentric 20×, breadthfirst 32×, random 6.9×, and an
  `eles.layout()` 10% scope 5.6×.

  The slot-path/handle-path split the
  plan predicted shows up exactly: grid is the outlier because it is
  the one layout that never materializes a handle.  At N=500 the same
  rows read 84× / 23× / 32× / 9.1× / 20× / 36× / 7.1× / 6.0×, and the
  `force` CPU executor runs 20 iterations in 4.81 ms (29.5 ms at 2k)
  against v3 `cose` at 10 iterations — **48×**, the two capped
  identically, and gated to N ≤ 500 because cose is superlinear (4.5 s
  per iteration at 25k on the hardware-pass box).

  **The two corrected rows.**  `preset` first read **2388×**, which is
  not a layout result: with no `positions` v4's preset does *no work at
  all* (positions are already in the model — its own module comment
  says so) while v3 still walks every node.  It now passes a real
  `positions` map, which is both the honest comparison and the real use
  case (restoring saved positions), plus a second row for the fn form
  since that one takes handles by contract on both sides.

  And the
  contract row first compared `{ impl: BulkLayout }` against the
  built-in grid at 4.5× — **not a comparison**, since the two place
  different positions by different maths, so it measured the impl's own
  body as much as the wrapper (design call 1).  It is now an empty impl
  against the same wrapper doing a full bulk placement.

  **The finding that came out of that row.**  The contract's fixed cost
  scales with the *graph*, not the run: **106 µs at 500 nodes, 391 µs
  at 2000, for an impl that does nothing.**  `LayoutContext`'s
  constructor eagerly evaluates `cy.elements()` and `.nodes()` to
  populate the handle-tier `ctx.eles`/`ctx.nodes`, so every run interns
  handles for the whole graph — including for a columnar-first layout
  that never touches them, which is the case the contract exists to
  make obvious.  Making those two fields lazy getters would delete it.
  **Logged, not fixed**: this is a measurement round, and `eles` is a
  declared public field of the shipped declarations.

  Also priced: the `layoutPositions` finisher against the bare bulk
  write underneath it — 1.68× at 2k (804 → 478 µs), the cost of v3's
  spacingFactor/transform/fit conveniences.
  Control: every built-in was run against a 200-node fixture seeded at
  one shared position and asserted to place **200 moved, 200 distinct**
  positions, so no row is measuring a layout that silently does
  nothing — the check `preset` failed.
- [x] **33.2 The algorithm tail** (2026-08-03) — landed in
  `algorithms.mjs`, taking it from 18 rows over 17 algorithms to 25
  over all 21.  At N=500: `kMedoids` **1.25×**, `fuzzyCMeans` 1.11×,
  `affinityPropagation` 1.64×, `kargerStein` 1.06× — parity, which is
  the *correct* reading for these four and the one the plan predicted:
  they are attribute-space algorithms that v4 deliberately keeps
  handle-level on both sides (round 10 A4 — feature space, not
  adjacency walks), so identical maths dominates and a large win would
  have meant the row was wrong.

  They sit beside the existing
  dense-matrix rows (floydWarshall 1.2× *to v3*, markov 1.34×,
  hierarchical 1.02×) which read the same way for the same reason.
  The two that are not parity are the ones with a real implementation
  difference: **weighted `betweennessCentrality` 8.9×** and weighted
  `closenessCentrality`, which are the branch that actually runs the
  heap — every centrality row before this round passed no weight, so
  round 10 A3's decrease-key heap (v3 re-sorts instead) had never been
  measured.  Unnormalized `degreeCentrality` joins its normalized
  sibling, the 29.2/30.3 shape arriving in the benchmark suite.

  Iteration counts are capped on both sides (AP 10, kMedoids 10, fcm
  10) so the rows measure the algorithm and not how long each
  implementation happens to wander; `kargerStein` is randomized on both
  sides and neither takes a seed, so what is stable is its *cost* (the
  trial count is a function of n) and its result is not compared.
  One methodology note worth keeping: a one-off probe had `kMedoids`
  reading 1.4× *slower* on v4, which did not survive mitata warming
  both sides — the 29.4 lesson, reproduced.
- [x] **33.3 The style engine** (2026-08-03) — landed as
  `benchmark/style.mjs`, and it found **the place where v4 does not
  beat v3**, which no previous round had looked at directly.
  At N=2000 (2000 nodes / 4000 edges, constants-only sheets alternating
  so no apply can be skipped as unchanged): a whole-sheet swap is
  **1.09×** — parity — at 14.2 ms for 6000 elements, or ~2.4 µs per
  element for what is supposed to be a columnar write.  Compile alone
  is 27.7 µs (separated from apply through the public batching
  semantics: inside a batch `cy.style()` compiles and validates and
  defers the apply), so **the whole 14 ms is the apply**.  The first
  apply of a 256-node band on `add()` is 1.36× v4's way, and the
  round-14.6 parents partition costs 1.08× against the same graph
  without the hierarchy (100 parents over 2000 leaves).
  **The finding: the style getters are 13–21× *slower* than v3.**
  ***Corrected by round 34.0 (2026-08-03): 5.8×, not 13–21×.*** These
  numbers come from a suite that imports `src/` through tsx, and
  profiling `readProp` for round 34 found **23% of its samples in
  `__name`** — esbuild's name-preserving wrapper, an
  `Object.defineProperty` per closure *creation*, injected by tsx and
  absent from the built bundle.  Through
  `build/cytoscape.esm.mjs` the same getter is **292 ns** against
  v3's 50 ns.  The gap is real and round 34 fixes it; the magnitude
  below is inflated by the transpiler.  The rest of this record stands
  — the *localization* (all of it inside `readProp`, against a 9 ns
  column read) was measured the same way on both sides.*
  `ele.style( 'background-color' )` is 2.13 µs on v4 against 106 ns on
  v3; `style( 'width' )` 15×, `numericStyle` 13×, `renderedStyle` 2.0×,
  whole-object `style()` 2.2×.  Localized, not just observed: the cost
  is entirely inside `StyleEngine.readProp` (1.85 µs measured directly
  against the ref, so the collection wrapper is not it) while the
  column read underneath it is **9 ns** — a ~200× gap between the read
  and its data.  It is flat across props (background-color, width and
  label all ~1.85 µs), which rules out the switch walking to a late
  case and points at the per-call setup: `readProp` is a ~536-line
  method with a 145-case switch that allocates four closures before it
  dispatches.  This matters more than a micro-benchmark usually would,
  because these getters are the documented public read path — the
  synchronous-reads invariant is what round 8 called load-bearing, and
  `renderedStyle`/`numericStyle` sit on it.  **Logged, not fixed**: a
  measurement round measures, and hoisting the closures out of
  `readProp` is a source change with its own verification.
  *Plan correction, recorded*: the **selection restyle skip** cannot be
  benchmarked as this plan described it.  The round-4 finding compared
  a sheet with and without a `:selected`-dependent block, and v4 has no
  selection-dependent blocks at all — they left with the selector
  removal and the accent ring is shader-drawn, so there is nothing to
  turn on and off.  What survives of that comparison is the plain
  select/unselect round-trip, which `mutators.mjs` has priced since
  round 4 (~38× at 200k).  The suite header says so rather than the
  row silently not existing.
  Two rows were corrected before landing (design call 5, twice in two
  passes): the compound row first read 3.55× *faster* than flat, which
  was 4000 edges missing from one side rather than the partition being
  free; both sides now come from one generator.
- [x] **33.4 Loading and the wire format** (2026-08-03) — landed as
  `benchmark/load.mjs`.  At N=2000 (6000 elements): definition-form
  init is **5.47×** v3 (153 → 28 ms, construct *and* dispose on both
  sides), v4's own three ingest forms are 25.7 ms (definitions) / 17.7
  (columnar) / 17.0 (wire), and the def-clone control that the def rows
  necessarily pay is 628 µs — so the columnar and wire payloads are
  ~1.5× v4's own definition path, not the headline the pass-1 record's
  ndex figures suggest at a different scale and fixture.

  Conversion:
  `toColumnarElements` 789 µs, `serializeElements` 967 µs from
  definitions and 211 µs from columnar, and **`deserializeElements`
  4.09 µs** — 52–236× cheaper than every other path in the group, which
  is the wire format's whole point (numeric columns deserialize as
  zero-copy views) and is now a row rather than a recollection.
  `cy.json()` is 1.17× and `cy.serialize()` 5.5× cheaper than
  `cy.json()` on the same graph; a 256-node band `add()` is 1.39×, and
  the three forms of the same add are 3.04 / 2.76 / 2.77 ms.

  **Two methodology bugs in this suite's own first version, pulling in
  opposite directions**, which is why the number moved from 1.89× to
  5.47×: a headless v3 defaults `styleEnabled` to *false*, so the v3
  side was doing less work than v4 (which always applies its sheet);
  and v3's default layout is **grid**, so `cytoscape( { elements } )`
  ran a whole layout inside the measured region.  The v3 side is now
  `styleEnabled` with an explicit preset layout — the configuration
  `scenarios.mjs` and `layouts.mjs` already use, for exactly these
  reasons.

  Also recorded in the header: the def-form rows **must** clone inside
  the timed region, because a factory consumes its definition objects
  (v3 adopts position objects by reference and writes through them —
  measured: positions read back as {0,0} from the second iteration on),
  which is why the clone gets its own control row.  Columnar and wire
  payloads are re-used as-is, verified by reading positions and data
  back after repeated loads — and that re-use is the realistic case.
- [x] **33.5 Pick, box selection and bounds** (2026-08-03) — landed as
  `benchmark/spatial.mjs`.
  *Plan correction, measured*: picking and box selection **cannot** be
  compared against v3, because `findNearestElement` and `getAllInBox`
  live on v3's canvas renderer and a headless v3 instance has neither
  (`cy.renderer()` is a bare object on which both are `undefined`).
  They are gpu-only absolute costs; bounds is the one of the three v3
  answers headless, and it stays comparative.
  **Picking.**  A hit is ~20 µs and a background miss 42 µs at N=2000
  (the full descending walk — the hover-over-background case).

  The
  shape branches are **invisible at realistic density**: the scan stops
  at the first candidate whose box contains the point, so exactly one
  inside-test runs per pick and all seven shapes read within 3% of each
  other.

  A row per shape would have been seven copies of the walk
  wearing different labels — so the shape tests get their own fixture
  (N coincident oversized nodes, the point inside every box and outside
  every shape, so the walk runs N tests and misses all of them), and
  there the spread is real: ellipse 88 µs, `cut-rectangle` 97 µs,
  custom `polygon` 212 µs, `star` 242 µs, `barrel` 789 µs,
  `round-hexagon` 823 µs — **9.6× between the cheapest and the dearest
  inside-test**, with round 27's two computed shapes at the top.

  `insideRoundPolygon`'s cost turns out to be zoom-*independent*
  (1.05× between zoom 1 and 2) even though its correctness is not —
  worth knowing, since 28.1 had to pin it at two zooms for exactly the
  opposite reason.  `text-events: yes` costs **2.9×** on the miss walk
  (the laid label box joins the scan per candidate).
  **Box selection.**  `elementsInBox` is 153 / 214 / 370 µs over 10 /
  50 / 100% of the graph, and the round-16.5 label-containment option
  adds 15%.
  **Bounds** (v3-comparative, labels included by default per 16.4):
  whole-graph `boundingBox()` **6.2×**, `cy.fit()` **33×**,
  `getFitViewport()` **35×**, one node's `boundingBox()` 1.6×.

  Turning
  the label terms off is 1.73× — so the honest default row is the
  expensive one, which is why both are reported.  v4-only rows for
  reference: `boundingBoxAt` 1.65 ms whole-graph, `labelBoundingBox`
  465 ns per element.
  **Two rows were void before they were fixed, and one of them was
  already shipped elsewhere.**  (a) `elementsInBox` takes four numbers,
  not a box object; passed an object it silently answers the *empty*
  collection (0 elements against 480 for the same band spelled
  positionally), so the first version of the box rows measured a
  degenerate call — and `benchmark/curves.mjs` has had the same bug
  since round 29.4, in a number `src/README.md` publishes.

  Fixed
  and re-measured in its own commit (33.5b below).  (b) the
  custom-`polygon` row read 549 ns against 88–842 µs for every other
  shape, because the box corner is *inside* that polygon, so the walk
  stopped at the first node: one test, not N.  Each shape now has its
  own miss point, and the suite **asserts the miss** at startup — a row
  that hits prints a warning naming itself, because a shape-test row
  that stops early is measuring nothing.
- [x] **33.6 The data sidecar and structured queries** (2026-08-03) —
  landed as `benchmark/data.mjs`.  At N=2000, bulk writes across
  the whole node set are **18–24× v3** and the storage kind barely
  moves it: numeric 24×, dictionary string (4 values) 19×, one new
  dictionary entry per pass 18×, the plain-array object fallback 23×.
  `removeData` is 1.7×.

  Reads are parity — one numeric key 1.04×, one
  dictionary string 1.34× *v4's way* (the decode is cheaper than v3's
  object hop) — with one exception recorded as a finding: **the
  whole-object `data()` read is 6.3× slower on v4** (266 ns against
  42 ns), because v4 rebuilds the object from its columns where v3
  hands back the object it already stores.  That is the columnar
  trade-off showing up exactly where the design predicts, and it is
  worth knowing before someone writes `data()` inside a loop.

  **Structured queries against the selector strings they replaced** —
  the comparison a porting v3 user actually makes: data equality 15.6×,
  a comparison (`gt`) 11.9×, two keys AND-ed 12.7×, membership (`in`)
  14.9×; the predicate form (both sides materializing handles) is the
  narrow one.  Structural terms are the widest: `{ parent: true }`
  **49.8×** against `:parent`, `{ child: false }` **48.5×** against
  `:orphan`, `{ parent: false }` 16.3× against `:childless` — pure
  flag scans against v3's per-element pseudo evaluation.

  One row is named for what it does rather than what it was meant to
  do: a "dictionary churn" row would need per-element distinct strings,
  which takes a per-element loop that would measure the loop on both
  sides rather than the column.  The row writes one *new* value across
  the collection per pass, so the dictionary grows by an entry per pass
  and not per element, and it says so.
- [x] **33.7 Events and the animation manager** (2026-08-03) — landed
  as `benchmark/events.mjs`, and it produced the round's second
  finding about a documented claim.
  **Emits** (a position write on one node, N=2000): with **no listeners
  26×** v3 — that is the listener-gated fast path every bulk-write
  number in `mutators.mjs` rests on, now measured at 53 ns against
  v3's 1.39 µs — one core listener 4.4×, one ref-qualified element
  listener 4.4×, a delegated listener 4.9× (v3's selector string
  against v4's predicate — the idiomatic spelling on each side), ten
  core listeners 2.6×.  `on()` + `off()` registration is 1.17×.

  **The finding: a compound child never gets the no-listener fast
  path.**  Round 14.5 says the *flat* path "stays byte-identical (zero
  cost)", which is a claim about the path bubbling does not apply to
  and is not re-measurable without the pre-14.5 code — so this suite
  measures the other half instead, which nothing had: what the phased
  walk costs when it *does* apply.  With one core listener, a child two
  ancestors deep costs **2.35×** an orphan's emit (1.29 µs vs 551 ns).
  With **nothing listening at all** it costs **6.4×** (566 ns vs
  89 ns) — so the phase walk runs regardless of whether any phase has
  a listener, and a compound graph pays it on every position write.

  That is a real optimization opportunity (hoist the whole-chain
  listener check ahead of the walk) and is **logged, not fixed**.
  **The animation manager**, whose *lifecycle* had never been priced —
  only its ticks: v4 is **4.3× slower than v3 to start and stop one
  element's animation** (5.45 µs vs 1.26 µs) and 5× slower on
  `delay()`, but **3.7× faster** starting and stopping the same
  animation over a 512-node collection (127 µs vs 469 µs).  So the
  capture-into-ChannelWrites design carries a per-animation constant
  that amortizes at scale — v3 wins the single-element case, v4 wins
  the bulk case, and both are worth knowing since a UI does the former
  and a layout the latter.

  The round-21 **eviction compare costs
  nothing measurable**: starting an overlapping animation reads
  identically to starting a disjoint one (10.32 vs 10.35 µs), so
  `touchedColumns()` across shared refs is not a cost worth avoiding.
  The 24.3 controls are 3.4 µs (pause + resume) and 4.3 µs (reverse).
- [x] **33.8 Images, charts and store internals** (2026-08-03) —
  landed as `benchmark/store.mjs`, gpu-only throughout because v3
  has no counterpart to any of it.  The structures are driven directly
  rather than through the public API, so a row is the structure's cost.
  At N=2000: the **id index** builds in 307 µs (2000 `set`s), and its
  single-key ops are `has` 55 ns / `get` 62 ns / `hashAt` 7.6 ns /
  `idAt` 9.2 ns — the last of which is the *memoized* hit, since
  `idAt` caches the decoded name per slot; the cold UTF-8 decode is not
  separable through the surface, and that is the useful fact (an id
  decodes once per slot, ever).

  A remove + re-set round-trip, which is
  what drives the round-11 blob reclaim, is 250 ns.
  **CSR adjacency** rebuilds 4000 edges in 66 µs (the two counting
  passes), and its reads are the design in three numbers: `outDegree`
  **6.5 ns** — the O(1) claim, measured — `outEdges` 48 ns,
  `connectedEdges` 183 ns; an overlay add + remove is 147 ns.
  **The blob pool** writes 2000 records in 127 µs, rewrites one in
  place in 32 ns (the same-length fast path), reads `offsetOf` in
  4.6 ns, and pays 181 ns for a free + rewrite.
  **The dirty tracker**, which every column write in the store funnels
  through, marks in 13.7 ns contiguous / 19.2 ns scattered and drains a
  64-mark frame in 742 ns.

  **The image registry** (round 15's bookkeeping, headless — no
  decoder): 214 ns to acquire a url already known (the icon-per-type
  case) and 636 ns for a fresh entry plus its release.
  **Charts**: a `chart` sheet with per-element `{ data }` values costs
  **1.01×** the same sheet without one — the blob record per node is
  noise beside the apply it rides in, which is the 33.3 finding showing
  up from the other side.  A data write refreshing every node's
  `chart-values` is 529 µs.
- [x] **33.9 The remaining public surface** (2026-08-03) — landed as
  `benchmark/surface.mjs`: **90 rows, 80 of them v3-comparative**,
  covering the members no dedicated suite touches — the viewport
  quartet and its compute-without-committing twins, introspection and
  the gating flags, batching, the iteration/comparison/set-building
  surface, traversal, degree, the rendered-coordinate accessors, the
  curve accessors, the compound traversals, the flag families, element
  data/json/scratch.

  Every op is **smoke-tested once before it is
  benched**, and the ones that could not be called are reported by
  name rather than silently dropped: `midpoint`/`renderedMidpoint` and
  the two endpoint accessors have no headless v3 side (they go through
  the renderer — the same cause as 33.5's pick), so those rows are
  gpu-only.

  *(This record said "three"; the suite reports **four**.  The fourth is
  `core: zoomRange get [v3]`, which throws headless in v3 independently
  of anything v4 does — verified directly in round 36.3, which noticed
  the discrepancy while adding rows.  An off-by-one in the record, not a
  regression.)*
  Most of the surface is where the earlier rounds said it would be:
  set ops 4–175×, traversal 1.3–4×, `reset()` 127× and `viewport()`
  77×, `collection()` 8.9×, batching ~7×.  **Four rows go the other
  way, and they are the pass's value:**
  - **`mutableElements()` — v4 251 µs against v3's 120 ns.**  v4's is
    `elements()`, so it materializes the whole graph on every call
    where v3 answers in constant time.
  - **`indexOf()` — 12.5 µs against 204 ns** over a 2000-collection:
    v4 scans linearly where v3 keeps an index.
  - **`effectiveOpacity()` 34× slower** (4.7 µs vs 313 ns) and the
    `takesUpSpace`/`interactive`/`transparent` trio 11× — all three
    read through the style engine, which is 33.3's `readProp` finding
    arriving from a second direction.
  - `json()`/`jsons()` are ~1.2× v3's way, the columnar
    rebuild-the-object cost 33.6 found on `data()`.
  Two rows are named for their mechanism rather than their multiplier,
  because the multiplier is not about v4: core `data()` and `scratch()`
  read as ~8,600× and ~87,000×, and the cause is that a **styled** v3
  runs a whole-graph style update on any core data *or scratch* write
  (1.9 ms here, against 1.1 µs for the same instance unstyled).  That
  is a real cost a v3 app pays, so the rows stay — but a reader should
  not take 87,000× as a statement about v4's scratch.
- [x] **33.10 The report: every suite, one command** (2026-08-03) —
  landed, and **open call 7 is answered**.  `report.mjs` now has three
  tiers instead of two: `quick` (the v3-vs-v4 micro and scenario suites
  at their default scales — deliberately unchanged, because a default
  profile nobody waits for is worth as little as a report showing half
  the suite), **`--all`** (+ the fifteen standalone sweeps: the eight
  this round added plus `compaction`, `compound`, `curves`, `labels`,
  `transitions`, `geometry-tween` and the algorithms' superlinear
  tier), and `--full` (+ the 2k/20k/200k matrix).  `--suite <substr>`
  filters any tier, which is how one sweep gets run and re-rendered on
  its own.

  The blocker was mechanical and is now gone: `curves.mjs` and
  `labels.mjs` **time one shot per row** rather than sampling through
  mitata — deliberately, since their rows mutate or are one-offs — so
  they had no mitata results to hand over and wrote their own JSON
  shape (or none), which `report.mjs` cannot read (it needs
  `job.groups`).  `finishManualRun( suite, groups )` in `bench-run.mjs`
  turns one-shot rows into that shape via `oneShotStats`, the
  convention the renderer bench already uses for its init/export
  timings.

  No suite's terminal behaviour changed: without `BENCH_JSON`
  it writes nothing, exactly like `finishRun`.
  The renderer already handled gpu-only groups (benches not named
  `v3`/`gpu` render as individual labelled rows rather than as
  dumbbells against a 1× line that would mean nothing for them), so no
  `gpuOnly` marker was needed — the plan's proposed flag turned out to
  be describing something the report already did.
  Verified end to end: `report.mjs --all --suite labels` runs the suite
  and its five rows appear in `report.html`.  `test/modules/
  gpu-benchmark-report.mjs` gains three specs (the manual-run shape,
  the no-`BENCH_JSON` no-op, and a single-bench section rendering) —
  14 module tests, with the control run: breaking `finishManualRun`'s
  group mapping fails the spec written for it.
- [x] **33.11 The renderer bench gaps** (2026-08-03) — run on the
  RX 580 (`amd gcn-4`, dpr 2, 1280×800, render scale pinned to 1).
  **The images scene is measured at last** — round 15.7 recorded
  "software adapter on this box", which was wrong for the third time
  in this file's history, and 29.5 scoped its comparison to four
  scenes without it.  It holds the **vsync floor (16.7 ms wall) in
  every pan scenario**, labels on and off, where v3 canvas runs
  333–760 ms/frame; device time is 3.44 ms fit-all, 4.46 zoomed-in,
  1.42 far-zoom, with labels adding ~0.3 ms.  Init 294 ms against
  v3's 3510 (12×); `png()` full export 290 ms against 4666 (16×).

  **The 100k and ndex scenes are re-measured post-round-27**, closing
  the scope limit 29.5 left deliberately: 100k device 9.29 ms fit-all
  / 18.68 zoomed-in / 1.63 far-zoom, and 20.06 ms for the
  zoomed-in-with-labels pass — against the 2026-08-01 hardware pass's
  19.6 ms for that same worst-case row, i.e. **+2.3%**, inside the
  +0.3–3.6% band 29.5 measured for round 27's shader branches on the
  25k set.  ndex fit-all device 36.96 ms (the pass recorded ~37 ms)
  at 33.4 ms wall — two vsync frames, still the one scene above the
  floor — with pick p50 **0.3 ms** off the CPU fast path, init 1648 ms
  against v3's 17070 (10×), and a full png export 213 ms against 6125
  (29×).

  Both scenes' compaction rows reproduce round 19.5b:
  100k device **2.21 → 0.53 ms** (4.2×; 19.5b recorded 2.2 → 0.5).
  **Two scenes added**, the configurations nothing exercised:
  `gen-25k-wrap` (round 25.6's expensive label case — wrapped
  multi-line labels — measured on the device rather than on the CPU
  tick) and `gen-25k-invisible` (round 22's paint-only `visibility`
  and round 20.2's `events` transparency, half the nodes each,
  expressed as `case` mappers on the v4 side and selector blocks on
  v3's).  A same-session run of the whole 25k family gives them a
  baseline (device p50, ms):

  | 25k scene | fit-all | fit-all + labels | zoomed-in + labels |
  |---|---|---|---|
  | flat (baseline) | 3.40 | 3.67 | 4.77 |
  | curved (bezier pairs) | 9.89 | 10.17 | 4.17 |
  | compound (1k parents) | 2.11 | 2.34 | 4.50 |
  | images (icon-per-type) | 3.44 | 3.71 | 4.80 |
  | **wrapped labels** | 3.40 | **4.55** | **5.95** |
  | **half-invisible / half-inert** | **1.66** | **1.96** | **2.57** |

  Two results worth keeping.  **Wrapped labels cost +24% on the
  labelled passes** (3.67 → 4.55 fit-all, 4.77 → 5.95 zoomed-in) — and
  that scene's *unlabelled* row is 3.40 ms, identical to the
  baseline's, which is the control: the delta is the labels and
  nothing else.

  And **half-invisible is 2.05× cheaper than the
  baseline** (1.66 vs 3.40): the round-22 `FLAG_DRAWN` mask drops
  invisible elements in the **cull**, so they cost no vertex or
  fragment work at all rather than being discarded late — a design
  claim from that round, unmeasured until now.  The image pass costs
  ~1% over the flat scene at this scale (3.44 vs 3.40).
  Two notes for whoever re-runs this: the harness printed
  "build/ bundles are older than src/" throughout, which was a **false
  positive** — the only `src/` file this round touched is
  `src/README.md`, and the check compares mtimes without
  distinguishing docs from code; and `--scene gen-25k` is a substring
  filter, so it selects the whole 25k family, which is how the
  same-session baseline for the two new scenes was obtained.
- [x] **33.12 `scripts/bench-coverage.mjs` + the closing docs
  sweep** (2026-08-03) — the audit landed first (its record is above,
  under the surface pass it drove), then the sweep.
  **The README's Benchmarks section is now an index**: a table of every
  suite and what it answers (21 rows over the 22 files —
  `core`/`collection` share `index.mjs`), the three report profiles, the
  `finishManualRun` note, the round's five findings, and the audit with
  its limits.  Its follow-up hooks gained a "five measured slow paths"
  entry so the findings are reachable from the doc a reader starts in.

  **`AGENTS.md` gained two benchmark notes**, both earned this round: a
  row is guilty until it discriminates (with all six of the round's
  non-measuring rows named, including the `elementsInBox` signature
  trap that had been live in `curves.mjs` since 29.4), and a v3 side
  needs `styleEnabled` *and* an explicit layout, because the two
  defaults bias in opposite directions.  `scripts/` picked up the third
  audit in the repo-structure list, and `package.json` gained
  `benchmark:all`.

  **The three named drift sites, checked by name**: "Suggested
  sequencing" gained the round-33 paragraph; the "Needs a call" ledger
  needed nothing (round 33 closed no design calls — it is measurement
  work); "Gaps with direction already set" likewise.  Open call 7 is
  struck through with what closed it.  The status header at the top of
  this file was two rounds stale when the round started (it ended at
  30) and now runs through 33.
  **Round 33 is complete.**

### What the round found (2026-08-03)

The wins were mostly where earlier rounds said they would be — bulk
writes 18–24×, structural queries 16–50×, layouts 7–153×, fit 33×,
algorithms unchanged where the maths is identical and 8.9× where the
data structure differs.  The **useful** output is the other direction.

**Five slow paths, each localized, none fixed** (a measurement round
measures; every one of these is a source change with its own
verification, and three of them touch shipped declarations):

1. **`StyleEngine.readProp`** — the style getters run 13–21× v3 as
   measured through tsx (**5.8× through the built bundle — see the
   round-34.0 correction**; 292 ns vs 50 ns) with a **9 ns** column
   read underneath.  Flat across props, so it is the per-call
   setup: a ~536-line method with a 145-case switch that allocates four
   closures before dispatching.  `numericStyle`, `renderedStyle`,
   `effectiveOpacity` and the `takesUpSpace`/`interactive`/
   `transparent` trio all ride it.  Biggest surface of the five.
2. **The compound emit path never takes the no-listener fast path** —
   a position write on a node two ancestors deep costs 6.4× an
   orphan's *with nothing listening* (566 ns vs 89 ns), because the
   phase walk runs before anything checks whether a phase has a
   listener.
3. **`LayoutContext` materializes the whole graph per run** — the
   layout contract's fixed cost is 391 µs at 2000 nodes for an impl
   that does nothing, because the constructor eagerly evaluates
   `cy.elements()` and `.nodes()` for the handle tier, including for
   the columnar-first layouts the contract exists to encourage.
4. **`mutableElements()`** does the same per *call* — 251 µs against
   v3's 120 ns.
5. **`indexOf()`** scans where v3 indexes — 12.5 µs against 204 ns
   over a 2000-element collection.

**Six rows were caught measuring nothing**, by design call 5, and
rewritten: `preset` (2388×, because v4's preset does no work without a
`positions` map while v3 walks every node), the compound style row
(3.55× "faster", because one side was built without edges), the
layout-contract row (comparing two different placements), the
custom-polygon pick row (1500× faster, because the pick point was
*inside* the shape so the walk stopped at the first node), and two
box-selection rows — which turned up the round's one **defect in
shipped documentation**: `cy.elementsInBox` takes four numbers and
silently answers the empty collection when handed a box object, so
`curves.mjs`'s box-selection premium had been measuring a degenerate
call since round 29.4, and the README published it as 3.29× (really
~2.3×).

**Two methodology traps, both now in `AGENTS.md`:** a v3 side needs
`styleEnabled: true` *and* an explicit layout (unstyled v3 does less
work than v4; v3's default layout is grid and runs inside the measured
region — fixing both moved 33.4's init comparison from 1.89× to
5.47×), and a benchmark row is guilty until shown to discriminate.

### Verification (2026-08-03)

Typecheck, lint, **2487 Node tests** and **77 module tests** (68 → 77:
three report specs and six for the new audit, each with its control
run), JSDoc coverage 100%, `@throws` 16/16, `@param` 221/221, and
`gpu-throw-coverage` still at 0 Node-reachable dead sites — the three
existing audits are unchanged, which matters because this round edited
the gated one (`auditFile` now also returns the members it saw).
No `src/` code changed: the round's only source edit is
`src/README.md`, so the browser suites are unaffected and were not
re-run.  The renderer benchmark ran on the RX 580 (33.11).

### Risks tracked

- **Benchmark bloat vs signal.**  Fourteen suites become ~twenty, and
  a full profile that nobody waits for is worth as little as a report
  that shows half the suite.  Mitigation: the quick profile stays
  quick (default scales only), `--all` is the opt-in, and the round
  records the wall time of each profile so the cost of running it is
  itself a documented number.
- **v3 comparisons that are not comparisons** (design call 1).  The
  most likely offenders are the layout rows — v3's layouts take
  different options and, for cose, a wholly different quality target —
  and the loading rows, where v3 has no columnar or wire form.  Where
  no honest comparison exists, the row is gpu-only and says so.
- **Fixture drift.**  `graph.mjs` builds one degree-4 grid graph; the
  new suites need compound, curved, labelled and imaged fixtures.
  These should extend `graph.mjs` (the existing shared seam) rather
  than each suite growing its own generator — the failure mode is six
  slightly different "20k graphs" whose numbers cannot be compared.
- **Heap ceilings at 200k.**  Two live instances of a 200k graph
  already force one-group-per-process for `mutators`/`scenarios`; the
  style, spatial and data suites will hit the same wall, and the
  `BENCH_OP` tables in `report.mjs` are a hand-maintained coupling to
  group names that silently degrades when a group is renamed.
- **Randomized and deferred work** (design calls 4–5).  `kargerStein`,
  the force executors and anything reading derived geometry are the
  rows most likely to measure variance or a deferred no-op.  Each gets
  the 29.4 treatment: force the work, then check the row can move.
- **The audit over-claiming** (design call 8).  A name-mention scan
  will report a surface as benchmarked because a suite happens to
  mention it, and will miss one exercised through a wrapper.  It
  reports, it does not gate, and the header says which direction it
  errs in.
