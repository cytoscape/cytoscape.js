## Round 60 plan — the performance record, kept honest (raised by the maintainer 2026-08-09)

The maintainer's ask, in three parts: more performance-related work; **a
way in the status page to compare performance across commits**, so
progression or regression is visible rather than remembered; and better
coverage on both the benchmark and the test side.  No library semantics
change in this round — it is measurement infrastructure, measurement
coverage, and the specs that keep both honest.

The premise is one this file already carries: the archive
(`benchmark/published/`) keeps every published run's full results JSON
precisely so that "a report improvement applies to every past run" — and
until this round nothing joined two runs.  The only cross-commit signal
on the site was one geo-mean per run in the trend table, which is a
single number over the run's ~109 v3-vs-v4 pairs: a 2× regression in
one row moves it by ln 2 / 109 ≈ 0.6%.  Detecting a regression was a
manual diff nobody had ever run.

### Items

- [x] **60.1 The cross-commit comparison** (2026-08-09) — landed:
  `benchmark/report-compare.mjs` (pure, Node-testable — the
  `report-html.mjs` pattern) joins the published runs of one
  (machine, profile) into per-row p50 series and renders a
  self-contained comparison page; `scripts/status/bench-pages.mjs`
  plans one such page for every (machine, profile) with ≥ 2 runs and
  links it from the trend table ("Across commits").

  Three judgements carry the design, each with its reason recorded in
  the module header:
  - **Runs from different machines never share a page** —
    `buildComparison` throws on mixed fingerprints rather than
    producing what the archive's README warns about (a hardware
    history wearing a performance history's clothes).  Unfingerprinted
    pre-46.5 runs get no comparison at all.
  - **A missing row renders as a gap, never dropped.**  Runs with a
    `--suite` filter measure a subset, so the join is sparse; a row's
    change bridges the gap to the nearest earlier run that measured
    it, and the page discloses each run's filter.  Silent truncation
    is the failure mode this repo's benchmark rules name most often.
  - **Every mover carries its noise controls.**  The movers lists
    (beyond ±10%, strong past ±30%) cover v4-side benches only — v3
    is frozen code, so a "v3 regression" is the machine — and each
    mover prints its v3 twin's change over the same span as a per-row
    control, with the page's headline **drift** figure (geometric mean
    change over every shared row, v3 included) as the whole-run
    control.  A mover near the drift factor is the box, not the
    commit.

  **Verified against the archive's own two renderer runs**, which is
  the strongest check available: the computed drift is ×1.014 where
  round 52.2 independently measured the same pair at a 1.018
  geometric-mean ratio, and the top movers are exactly the
  sub-millisecond compaction device rows whose ±40% bimodality rounds
  29.5 and 52.2 already recorded — appearing in *both* directions
  (×2.53 and ×0.40 on the same row family), which is what noise looks
  like and what the drift line exists to say.

  15 specs in `test/modules/benchmark-compare.mjs`, five controls run
  and each failing the spec named for it (the header lists them):
  change inverted to prev/latest — 4 fail; the gap bridge removed — 2
  fail; v3 rows admitted into the movers — 1 fails; the fingerprint
  guard removed — 1 fails; `planComparisons` merging profiles — 1
  fails.  Comparison pages are grouped by *exact* profile,
  deliberately: `renderer` and the Node-tier profiles measure disjoint
  suites, so a joined page would be mostly gaps presented as history.

- [x] **60.2 Benchmark coverage for the unpriced recent rounds**
  (2026-08-09) — `node scripts/bench-coverage.mjs --verbose` reads
  83.5%, and its missing names are mostly the audit's documented error
  direction (internals reached through benchmarked public paths — the
  Viewport methods behind `cy.pan()`, the StyleEngine members behind
  `cy.style()`).  The real gaps were the *recent* rounds nothing
  priced, and each new row is in the suite that owns its surface:

  - **The 57.1d state-condition partition** (`style.mjs`, three rows).
    `applyAll` under a fully state-conditioned sheet against the
    constant sheet it claims to match (~1×, the claim), against a
    fully data-conditioned sheet (the per-element path the partition
    avoids — 1.18× at N=2000), and **what a select now costs**: a
    256-band select+unselect is 9 µs under a constant sheet (round 4's
    skip) and **989 µs** under the state-conditioned sheet — ~110×,
    the restyle every selection pays once a sheet conditions on state,
    which is v4's own default look.  A re-runnable price, not a
    defect: it is the per-slot channel rewrite, and the constant-sheet
    row is the escape hatch's number.
  - **The round-59 seed split** (`layouts.mjs`).  59.7's "the
    spectral seed dominates the capped row" was a one-off
    decomposition; the new row runs the same 20-iteration force with
    `init: 'spectral'` vs `init: 'scatter'` — 111.7 vs 59.9 ms at
    N=2000, so the landmark-MDS seed is ~52 ms of the row and the
    figure is re-runnable rather than remembered.
  - **The 57.9 hit halo** (`spatial.mjs`).  The full miss walk with
    `padPx: 24` (the touch halo) against exact: **~2%** — the halo is
    effectively free on the hover path, with two startup assertions
    proving the pad is live (a point 8 px outside a boundary must miss
    exactly and hit padded) so the ≈1× is a finding, not a vacuous
    row.

  **Two rows were caught measuring nothing while being written**,
  which is design call 33.5 earning its keep twice more.  The first
  constant-vs-state row case-mapped two channels of seven and read
  ~1× — *with `applyPartitioned` disabled outright it still read
  1.02×*, so the control failed to fail and the sheets now condition
  every channel (the control then flips the row to 1.07× slower, and
  restoring the partition flips it back).  And the first select band
  was **empty**: `cy.collection()` takes no arguments in v4 and
  silently ignored the array it was handed — a 256-band selecting in
  53 ns, caught because that is not a number a real select can
  produce.  The row builds by `union()` now and asserts its own
  length.  The spatial probe's first point was inside a neighbour
  (30 px nodes on a 10 px grid overlap), caught by its own startup
  assertion.  The silent-argument behaviour itself is **logged as
  ledger item 28** rather than patched — it is public surface.

- [x] **60.3 The tests the tooling was owed** (2026-08-09) — two
  recorded gaps closed in `test/modules/status-site.mjs`, both about
  the status site's own machinery rather than the library:

  - **`executePlan()` finally has coverage.**  Round 53.2 recorded the
    gap by name ("the half that writes the deployable site has no
    coverage, and `npm run status` runs nowhere") and left it open
    because the spec would have copied 30 MiB of fixtures.  It does
    not have to: the plan is data, so three specs run `executePlan`
    over a synthetic five-op plan in a tmpdir — every op kind lands
    (write writes, `jsonmin` re-serialises rather than copying, copy
    is byte-for-byte, omit writes nothing and stays out of the size
    report), nested output directories are created, and the returned
    byte counts are the real on-disk sizes, which matters because the
    25 MiB cap check downstream reads exactly those numbers.
  - **The benchmark index page's judgements are pinned**: `geoSpeedup`
    is a geometric mean and answers null (not a fake 1×) when a run
    has no v3/gpu pair; `byMachine` quarantines unfingerprinted
    pre-46.5 runs in their own group rather than guessing them into a
    real machine; the empty archive renders unavailable with the
    publish command in its reason; and the trend table links the
    60.1 comparison page when a machine has two comparable runs.

  Six controls, each failing exactly the spec written for it:
  `jsonmin` degraded to a plain copy (2 fail — the minify spec and
  the byte-count spec, the second being the cap check's number);
  the `mkdirSync` dropped (2); omit ops written as empty files (1);
  `geoSpeedup` as an arithmetic mean (1); unfingerprinted runs merged
  into the first machine (1); the comparison link dropped from the
  trend table (1).

- [x] **60.4 The first real runs through the comparison — and it found
  a regression on its first use** (2026-08-09).  Both profiles were
  measured fresh at `e37d2444` on the archive's machine (2d2ea233,
  the box otherwise idle) and published: the quick profile (7.1 min,
  all 8 jobs, clean tree) and the full renderer profile (19.9 min,
  all 12 scenes — the suite grew from the baselines' 8, which the
  page shows as new rows; published `--allow-dirty` because the only
  dirt was the quick run sitting uncommitted in the archive itself,
  no source differing from the commit).

  **The renderer tier is clean.**  Drift −0.7% over 290 shared rows
  against the 2026-08-05/06 baselines — a span containing the round-56
  arrow trim, 57.1d's shader changes, round 52's WGSL minification and
  round 58 — and every mover family appears in *both directions*
  across scenes, which is the signature of the families the record
  already calls noisy: the sub-millisecond compaction device rows
  (×2.54 up on one scene, −60% on two others — rounds 29.5 and 52.2's
  bimodality), the compound fit-all pair (+49% with labels, −29%
  without, same scene), and the init/export rows (+19% labelled
  against −32% unlabelled on the same 100k scene).  The steady-state
  frame rows are unmoved and wall time holds the vsync floor
  everywhere.

  **The Node tier is not, and the finding is real.**  Drift reads
  +8.2%, and decomposing it shows the drift *is* the regression
  rather than the box (v3 controls all single-digit): one family
  moved — everything containing a select.  `mut-bulk: select +
  unselect` went **47.9 µs → 6.30 ms (×131)** with its v3 twin at
  +6%, so v4 flipped from **38× faster than v3 to 3.3× slower** on
  that row; the single-element round-trip went 106 ns → 4.92 µs
  (v3: 2.6 µs), and the select-all/explore/drag scenarios follow at
  ×10/×6.5/×4.5.

  The cause is round 57.1d's designed behaviour arriving in rows that
  predate it: the suites' bare `makeGpu` instances run v4's **default
  stylesheet**, which now conditions on `selected`, so `dependsOnState`
  is true out of the box and every select/unselect restyles the
  changed slots — the round-4 skip that produced the 47.9 µs no longer
  engages for a default-sheet instance.  The per-slot cost matches
  60.2's deliberate measurement (~1.9 µs/slot).  **The headroom is
  measured and directional, logged rather than fixed** (a measurement
  round measures): `core.mts`'s `onStateChange` routes a flag flip
  into `refreshMapped` — the general per-slot mapped-refresh path —
  while the default sheet's defs are state-only *partitioned* (57.1d),
  so a flip could resolve the slot's partition record by mask and
  write only the channels whose value differs between the two
  records, the machinery `applyPartitioned` already owns.  That is
  appetite, not a call: no API moves.  Until then, the recorded
  mitigation is the one 60.2's row already prices — a sheet that does
  not condition on state keeps the 47.9 µs path, and
  `mutators.mjs`/`scenarios.mjs`/`core+collection` now measure the
  default-sheet price, which is the honest configuration for rows
  named for what an app does out of the box.
  ***Closed by round 61 (2026-08-09, the same day)*** — exactly the
  routing described: through the built bundle the 256-band
  select+unselect went 541.9 → 63.5 µs, and the mutators row reads
  ~8.5× *faster* than v3 again.  See the round-61 record.

  Smaller Node-tier movers, deliberately *not* acted on: `elements()`
  8.5 → 39 ns, `forEach` +48%, `contains` +11%, `lock + unlock` +63% —
  nanosecond-to-microsecond rows measured through tsx, where round 34
  showed a closure-heavy path measures the transpiler.  Each needs a
  `style-bundle.mjs`-style re-check against the built bundle before
  anyone rewrites anything; listed so they are looked at, not so they
  are believed.
  ***Re-checked by round 61.5 (2026-08-09)***: three of the four are
  measurement artifacts (`elements()`/`contains` noise, `forEach`
  order bias), and `lock + unlock` was real — 57.1d's flag path built
  a changed-slot array for states no condition watches — fixed the
  same day.  See the 61.5 record.
