## Round 62 plan — every benchmark beats v3 (maintainer goal, 2026-08-09)

The maintainer's directive, verbatim: **"Every benchmark for v4 should
beat v3."**  The survey that preceded it (recorded in the 61.5 record
and the conversation that followed) found the quick profile at 106
v3/gpu pairs with **11 reading v4-slower**, plus known losers in the
`--all` tier (the style getters' 2.3× residual, the whole-object
`data()` read at 6.3×).  This round works the list worst-first until a
fresh run on an idle box reads **every pair v4-faster**, then publishes
that run.

The known losers at the round's open, from the 2026-08-09 published
quick run (ratio = v3/gpu; <1 is a v4 loss):

| row | ratio | standing diagnosis |
|---|---|---|
| `algo: degreeCentrality (one root)` | 0.03–0.11× | per-call `subgraph()` view build — O(V+E) for an O(degree) question; 333.7 µs direct through the bundle vs v3's ~7 |
| `mut: data set` (single element) | 0.58× | per-write (group, key) column resolution (33.6) |
| `core: getElementById()` | 0.80× | blob-probe + handle fetch vs v3's Map.get |
| `algo: closenessCentralityNormalized` | 0.85× | runs `floydWarshall` inside — one fix, two rows |
| `algo: floydWarshall` | 0.85× | dense triple loop, v4's inner loop paying an indirection v3's does not (to be profiled) |
| `json: element` | 0.88× | per-call object build |
| `position: get` / `core: pan() get` | 0.92× | nanosecond rows; need genuine shaves to hold a margin over noise |
| `algo: hierarchicalClustering` | 0.95× | attribute-space parity band; needs a real few-% edge |
| `algo: kMedoids` / `iter: forEach()` | 0.99× | noise band; forEach gets margin via a cached handle array |

Ground rules, all standing ones applied: fixes are measured through
the **built bundle** before and after (round 34); a row that cannot be
beaten without changing observable public behaviour gets the change
**logged in "Public-surface changes"** with a spec pinning it, never
silently (the `elements()` memo of 34.2 is the precedent shape); the
enumeration run may share the box with editing, but the **verification
run gets an idle machine** (36.5); and every fix keeps its suites and
controls.

### Pass split (tests-first where behaviour is pinned; docs in-commit)

- [x] **62.0 Docs-first** — this section; the full-`--all` enumeration
  running as it lands.
- [x] **62.1 `degreeCentrality` (one root)** (2026-08-09) — solved one
  level up from the plan's fast path: the `SubgraphView` is a
  structural snapshot valid exactly until the store adds or removes
  elements, which is what `structureEpoch` (34.2) counts, so
  `subgraph()` **memoizes the view on the collection against that
  epoch** — every algorithm entry amortizes, not only dc, and the
  O(N·E) per-node-dc app pattern collapses to O(E).  Weights and
  endpoints read live per call (the view holds structure only), so
  data writes and `moveEdge` need no invalidation.  Measured through
  the bundle: **333.7 → 0.62 µs**, ~11× faster than v3 on the row
  that was ~47× slower.  Four specs in
  `test/modules/algo-subgraph-memo.mjs` (identity, both
  invalidations, live weights); both controls fail exactly their
  specs; the four algorithm suites pass unchanged.
- [x] **62.2 The dense/attribute algorithm tail** (2026-08-09) —
  `floydWarshall`: running ij/kj indices (the inner loop recomputed
  `k·n+j` twice per iteration), a single-`alt` relax, and an
  Infinity-row skip (an unreachable (i, k) pair relaxes nothing) —
  296 → 151 ms at N=500 against v3's 299, **0.85× to ~2×**, with
  `closenessCentralityNormalized` riding it.  The clustering family
  recomputed every node's attribute projection per *pair* — the
  round-18 rule applied to none of them — and re-resolved the metric
  impl per call: `hierarchicalClustering` gets a per-run
  `makeGetDist` (impl once, per-node vectors cached on the interned
  handles), `k-clustering` a run-token WeakMap vector cache behind
  its unchanged `getDist` signature (the token, bumped per public
  entry, is the staleness guard; mutating feature-array centroids
  stay live-read), and `fuzzyCMeans`' k-invariant numerator hoists
  out of its k loop, float-identical.  Measured at N=500 vs v3, both
  capped at 10 iterations: hierarchical 16.8 vs 29.9 ms (0.95× →
  1.8×), kMedoids 52 vs 426 ms (0.99× → ~8×), fcm 5.7 vs 45.9 ms
  (1.05× → ~8×).  All 102 algorithm specs pass, v3-fixture numeric
  pins included.
- [x] **62.3 The micro rows** (2026-08-09) — two were real, and both
  were the round-34 transpiler tax on new paths (the suite runs both
  sides through tsx, so a closure-per-call path pays `__name` there
  even when the bundle does not).  `mut: data set`:
  `stylesDependOnData` — called twice per write — built 2–3 closures
  per call, 701 ns through tsx against 41 through the bundle;
  rewritten as plain loops, `ele.data(k, v)` reads 134 ns through
  tsx against v3's 893 (0.58× → ~6×), and `dependsOnState` shares
  the method.  `getElementById`: `lookup()` allocated an IdEntry and
  a Ref per call; `IdMap.code()` / `GraphStore.lookupCode()` answer
  the packed `(slot << 1) | groupBit` integer and the pool answers
  the handle — 102 → 72 ns through tsx against v3's 81 (0.80× →
  1.13×).  The other four flagged rows (`json: element`,
  `position get`, `pan get`, `forEach`) probed as wins or noise-band
  through tsx and ride to the verification run.  Fallout, both
  audits working: the `resolveDistance` insertion stranded
  `clusteringDistance`'s doc block (instance #18; the coverage gate
  caught it) and `lookupCode` moved the SHAPE_MASK allowlist key
  (the 37.1 mechanism's sixth firing) — both fixed in the pass.
- [x] **62.4 The `--all` tier's losers** (2026-08-09) — the first
  enumeration's "146 pairs, no `--all`-only losers" was **wrong,
  from a partial run**: launched under this round's own editing
  contention, several jobs died and the reading was taken as
  complete (the 36.5 idle-box rule violated by its own round).  The
  idle-box run reads **287 pairs with 28 losers**, most in the
  `surface`/`events` suites.  All fixed, worst first: `indexOfId`
  (0.02× — a lazy id → index map on `_keys`' immutability grounds,
  preserving 34.1's answers-for-removed contract); the animation
  lifecycle (0.12–0.57× — the nine per-handle closures became the
  prototype-method `AnimationHandleImpl` at ~93 ns vs ~2.9 µs, the
  chaining `animate()` skips the Promise it never exposed, `start()`
  allocates its eviction Set only on overlap, `animated()` gates on
  an O(1) `anyRunning()`; delay+stop 3420 → 488 ns vs v3's 561);
  whole-object `data()` (0.20× — cached on the handle against a new
  DataStore write epoch + parent/endpoints + gen, a **logged
  public-surface change**, ledger item 17b; `json()`/`jsons()` ride
  it); the style colour read (0.78× — per-raw-name read plans
  replace the normalize hop, four set tests and a per-edge-read
  regex, plus a packed-word rgba string cache); `slice()` (handle
  reuse); `source()`/`target()` (lean endpoint accessor);
  `hasElementWithId` (lookupCode), `window()` (module-load
  resolve), `mutableElements()` (inlined memo hit).  The audits
  fired three more times (SHAPE_MASK re-keys, stranded block #19,
  the handle class joining the public tier) and each was fixed in
  the pass.
- [x] **62.5 The nanosecond tail** (2026-08-09/10, three batches) —
  the verification loop's residue after 62.4: ~10 rows per run in the
  sub-30 ns band, **rotating membership across runs** (forEach read
  1.00×, 0.67× and 0.80× in three consecutive runs with no code
  change between them).  What landed, batch by batch:
  - *Hot column caches* (62.5): `ColumnTable.arraysVersion`, bumped
    in the same call that swaps the arrays (grow/compact) — the
    timing-safe validity key an epoch cannot be — and the four
    hottest arrays (node/edge flags, positions, endpoints) cached on
    the store against it.  `flags()`/`hasFlag` and every state
    predicate ride it, as do `position()` and `source()`/`target()`.
    `Collection._store` became a constructor field; `sort()` passes
    its handles through the 62.4 ctor path; `toArray()`
    preallocates.
  - *The dense handle array* (62.5b): `_arr()` caches the interned
    handles as a dense array (safe on `_refs` immutability), and
    `forEach`/`map`/`some`/`toArray` iterate it — array-element
    access holds its speed in the JIT modes where indexed
    own-property access is bimodal.  `toArray()` becomes a `slice()`
    of the cache: 795 ns against v3's 9.5 µs at 2000 elements.
    `removed()`/`inside()` read the raw first ref (isCurrent repairs
    a forwarded ref itself); `removeAllListeners()` gates on an
    empty list before `off('*')` allocates to remove nothing;
    `structureEpoch` converted from getter to field; the
    `isParent`/`isChild`/`isChildless`/`isOrphan` family reads the
    store-managed FLAG_PARENT/FLAG_CHILD bits through the hot cache
    instead of the child-list map; the whole-graph collection cache
    is push-invalidated (`onStructureChange` from the one
    `bumpStructureEpoch()` funnel) so the `elements()` memo hit is
    two loads.  One over-reach reverted by measurement: routing
    `eq()` through `_arr()` cost more than the property read it
    replaced on three accesses.
  - *The harness itself* (62.5c) — the finding that explains the
    rotation.  Every `cmp()`-style suite shares one op closure
    between the v3 and gpu benches, and v3 is always declared first,
    so **v3 sampled against monomorphic inline caches and v4 against
    polymorphic ones** — a systematic, one-directional ~0.5–1 ns/call
    bias, exactly the band where rows kept losing in-suite while
    measuring at-parity-or-faster in isolated A/B probes (isolated:
    minZoom+maxZoom 1.0 vs 4.6 ns, pan 4.4 vs 6.2, gating tied).
    This is the round-55 measurement-order rule in IC form, and
    round 33's "every 1× line is real" cuts against a row whose sign
    is decided by which side sampled first.  A few alternations
    through both sides before either bench samples (eight for the
    micro suites, two for algorithms, whose rows run to seconds)
    take every call site to its steady polymorphic state.
    `style.mjs`'s cmp takes separate closures per side and was
    already fair.
  Audit fallout across the batches, every instance caught by its
  gate: the SHAPE_MASK `file:line` key moved four more times, the
  `_arr` insertion stranded `forEach`'s doc block (instance #20,
  caught by three gates at once), and the one-off single-spec
  `test:js` flake fired twice more without reproducing (the
  2026-08-02 record's shape; output captured on the re-runs only).
- [x] **62.6 The last five, and the goal** (2026-08-10, three passes) —
  run six read 287 pairs / 5 losers; runs seven through nine each
  cleared some and surfaced a floor-row flicker; **run ten reads 287
  pairs, zero v3-faster rows**, and is the published run.  The
  progression across the round's ten idle-box `--all` runs: 28 → 12 →
  10 → 10 → 11 → 5 → 2 → 1 → 0.  What landed:
  - *Real shaves* (62.6/62.6b/62.6c), each probed with margin before
    riding to a verification run: `indexOf` skips the full
    `assertCollection` walk when one identity compare proves the
    argument is this instance's (the 29.3/48.4 throw intact for
    everything else; 1.52× from 0.675×); `effectiveOpacity` reads the
    stored opacity column directly behind a new
    `StyleEngine.ownsProp()` gate — the one case stored bytes lie is
    a kernel-owned mapper, the same rule `readProp` keeps (2.27×);
    `mutableElements()` flattens its memo to one dedicated field
    (1.38×); band `connectedEdges()` was profiled to 17.7 of 22.2 µs
    in the walk — `outEdges`/`inEdges` allocate a CSR **subarray view
    per node** — and `AdjacencyIndex.appendIncident()` now reads the
    CSR rows in place (14.1 µs against v3's ~25); `data(key)` dropped
    its rest-parameter args-array allocation (arity via
    `arguments.length`; 1.13×); `_liveNodeRef` (the
    `isParent`/`isChild`/`isChildless`/`isOrphan` shared head) and
    the `data()` getters read the raw ref and let `isCurrent` repair
    forwarded ones in place (the flags ×4 row: 1.36× from 0.895×).
  - *The harness, twice more* (62.6b): `data.mjs`'s `cmpRead` had
    been **missed by 62.5c's pre-warm sweep** — its three rows still
    sampled v3 against monomorphic ICs, and the one-numeric-key row
    flickered at 0.985–0.996× until it joined.  And `pan() get`
    exposed the artifact 62.5c's fix cannot reach: 0.83–0.87×
    across eight independent `--all` runs while replicating at 1.01×
    outside the suite through the same factories, pre-warm and
    rotation.  Order-swap probes showed the sign belongs to
    **group-order sampling at the ~6 ns harness floor** (declared
    order swapped, the same row reads ~1.1× the other way; lead- and
    tail-bench controls bounce both directions), while per-process
    monomorphic loops read gpu **0.49 ns vs v3 1.96 ns** — v4 is
    genuinely ~4× faster, v3's `arguments` use blocking full
    inlining; the subject outran the instrument.  The row now does 32
    reads per op — the round-33 rule (a row is guilty until shown to
    discriminate) applied to the row itself — renamed `pan() get
    (x32)` since it is a different measurement.
  - *Process fallout*: 62.5c had shipped with the SHAPE_MASK
    allowlist key stale (the 37.1 gate said so on the next
    `test:modules` run, its seventh firing; the key now sits at the
    `throw` line, 2989) — the round's one red-tier commit, caught by
    the gate it exists for.
  - *Verification*: the green run published
    (`benchmark/published/`, all profile, 287 pairs at cf5727b4);
    Node tier green throughout (2115 + 341 + 24; throw gate
    184/10/5/0; JSDoc 100% with 244 `@param` / 288 `@returns`);
    Playwright over the changed source; the closing docs sweep.
- [x] **62.7 The renderer run, and the comparison's first false alarm**
  (2026-08-10) — a fresh renderer run at c182dd0c (12 scenes, amd
  gcn-4, published as the profile's fourth run) read clean where it
  matters: v4 vsync-bound at 16.7 ms wall on every scene, whole-run
  drift +0.7% over 348 shared rows.  The comparison page's mover list,
  though, flagged a one-directional CPU-side cluster spanning exactly
  rounds 61–62: `convert (toColumnarElements)` +14–66% across five
  scenes, `compact()` one-shot +40–42%, pick-hover ×2 on ndex, export
  and labeled init +11–18% with flat v3 twins.  The follow-up
  **exonerated the code and convicted the sampling**: a best-of-7
  conversion A/B through both trees' built bundles (a worktree at
  e37d2444, per the round-53 reproduction rule) put the two within
  0.3 ms while single shots on *one* binary spanned 13–23 ms; and
  back-to-back runs of one scene on one bundle read `compact()` at
  19.7 then 30.7 ms — the published "+42%" inside same-binary
  run-to-run spread.  These rows are measured **once per run** and
  have no v3 twin, so they sample a GC-noisy distribution the frame
  rows (121 frames per press) never see.  The device-pair "×2.5"
  flag was its own tell: the peak-slot row slowed by the same factor
  its compacted twin sped up, i.e. the bimodal pair the round-29.5
  record already documents, trading modes.  Recorded as a caveat in
  the README's renderer-benchmark section (one-shot rows are not a
  regression signal; reproduce best-of on one binary before
  attributing movement to a commit) — and the run's own publish
  commit carries the original flag so the record shows the alarm and
  the resolution both.  Also in the pass: the stale-bundle warning
  compared v3's frozen UMD against v4's src mtimes and cried wolf on
  a fresh build; each bundle now checks against its own tree.
