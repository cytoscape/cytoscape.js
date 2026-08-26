## The select regression: state flips write the diff, not the element

The fix round for what 60.4 measured, taking exactly the headroom that
record logged: a state flip routes through `refreshMapped` — the
general per-slot mapped-refresh path, whose `write()` rewrites **every**
channel of the element — while the default sheet's defs are state-only
*partitioned* (57.1d), so the styling consequence of a one-bit flip is
knowable up front: it is the difference between two cached partition
records, and for the default sheet that difference is one channel on a
node (`background-color`) and five on an edge (`line-color` + the four
arrow colours), against the ~25 store calls plus the label/image/chart
writes a full `write()` performs per slot.

**Re-measured through the built bundle before any change** (the
round-34 rule; the numbers the round is judged against, N=2000 nodes /
4000 edges on this machine): a 256-band select + unselect is
**541.9 µs under the default sheet against 15.5 µs under a constant
sheet** (×35 — the published suite's ×131 is tsx-inflated, as 60.4
itself predicted for the smaller movers), and the single-element
round-trip 3.4 µs against 1.5.

### Design calls

1. **A dedicated `StyleEngine.refreshState( group, key, slots )`**,
   wired from `core.onStateChange` in place of the `refreshMapped`
   call.  It knows something `refreshMapped` cannot: the old flag word
   is the new word with one known bit flipped, so per slot it has both
   partition keys (`to = flags & mask`, `from = to ^ bit`) and both
   records are in `part.records`.  `onReparented` keeps using
   `refreshMapped` — its two pseudo-keys flip together, and reparents
   are rare structural ops.
2. **The record diff is computed per (from, to) pair and cached on the
   def**, never per slot: for each of the def's mappers, evaluate the
   case program against both flag words (the `partitionRecord` reader,
   which is what makes the records per-combination in the first place)
   and compare.  The cache lives beside `part.records` and dies with
   the def on sheet swap, the same lifetime rule; its size is bounded
   by pairs over 2^(bits the sheet reads), which is single digits in
   practice.
3. **Narrow writes only where they are provably safe; the partition
   record's full `write()` otherwise.**  The `applyMapped` comment is
   the constraint: per-channel writes break the cross-channel couplings
   that live in `writeChannels` (circle collapse, the arrow-alpha fold,
   the label re-anchor).  So each fast writer is a private method
   **factored out of `writeChannels` and called by it** — one source
   for the fold math, the dual-consumers discipline — and the fast set
   is deliberately small: the single-call paint channels
   (node fill/border colours, node opacity, both layer records per
   group, the edge line colour, the four arrow colours).  A diff
   touching anything else — geometry, labels, charts, edge `opacity`
   with its fold cluster — falls back to the full per-slot `write()`
   of the target record, which is byte-for-byte today's behaviour.
   The store setters are already self-consistent underneath (the
   arrow-bits mirror re-derives inside `setColor`, the layer counts
   inside `setNodeLayer`/`setEdgeLayer`), which is what makes a narrow
   write complete.
4. **Fall back to the general path entirely** when `def.partition` is
   null (a data mapper puts the group per-element anyway), when the
   group's transition spec is live (the txn capture is exactly what
   the general path owns, and a sheet transitioning on a state flip is
   rare), or when `demoted[group]` is set.  Compounds split
   leaves/parents against `defs.nodes`/`defs.parents` exactly as
   `refreshMapped` does.  Note what is *not* a concern: GPU-owned
   channels — a partitioned def is all-`case` by definition and case
   conditionals never join the eval kernel.
5. **An empty diff is a no-op**, which the path gets for free: the
   store's `watchedStates` set is per group, not per def, so a bit
   only the parents def reads notifies for leaf slots too — those
   slots' def diff is empty and they are skipped rather than written.

### Pass split (tests-first; docs in-commit)

- [x] **61.0 Docs-first** — this section.
- [x] **61.1 The specs** (2026-08-09) — seven in
  `test/state-conditions.mjs` beside the partition suite, **five seen
  red** against HEAD (the write-count assertions and the diff cache)
  and two green by design (the fallback pins, which exist so the
  controls can prove they discriminate): a paint flip runs no full
  `write()` and reads back the target record; the diff caches per
  flag pair, not per slot; every fast paint channel round-trips in
  both directions on both groups (arrow shapes as constants, since a
  'none' end stores NO_ARROW whatever the colour says); a
  geometry-prop condition still moves `boundingBox()` through the
  fallback; a transition on a state flip still tweens; the parents
  overlay's diff applies to parents and the nodes def's to leaves;
  and a bit watched for the group but unread by the slot's def skips
  the slot.  The which-path-ran assertions instance-shadow the
  engine's `write` — the partition suite's private-reach idiom.
- [x] **61.2 The implementation** (2026-08-09) — as designed, plus
  one addition measurement forced: `refreshState` /
  `refreshStateDef` / `partitionDiffWriters` and the `diffs` cache on
  `def.partition`; eleven narrow writers factored out of
  `writeChannels` (both callers, one fold definition — `foldRgba` /
  `foldLayerRgba` replaced four inline copies); `partRecordFor`
  extracted from `applyPartitioned`; the `core.mts` wiring.  The
  addition: the first cut resolved the diff per slot (a string key
  and two Map hits each) and measured 131.5 µs on the 256-band — a
  bulk flip's slots almost always share one masked word, so the
  record and writers now resolve **once per run of equal words**,
  which took it to 63.5 µs.
- [x] **61.3 Controls + measurement** (2026-08-09) — all three
  controls run, each failing exactly what it should and nothing else:
  the fast path disabled outright fails the five write-count/cache
  specs while the fallback pins stay green (the optimisation is
  invisible — 57.1d's control shape); the writers neutered fail the
  four readback specs while the write-count specs stay green (the
  failures come from the writers, not the routing); the classifier
  claiming `width` fails both geometry specs — the round-61 fallback
  pin and 57.1d's own bounding-box spec.
  **Measured through `build/cytoscape.esm.mjs`** (N=2000, this
  machine): 256-band select+unselect **541.9 → 63.5 µs** under the
  default sheet (constant sheet 15.5 µs — the residual ~4× is the
  restyle actually happening, one colour write per slot at ~50 ns);
  single-element 3.4 → 2.2 µs; a 256-band lock+unlock (a state no
  default-sheet condition reads) at 21.6 µs, pure flag work — the
  unwatched path stays free.  Through tsx, the suites whose rows
  regressed: `mut-bulk: select + unselect` **6.30 ms → 250.9 µs**
  (v3 2.14 ms — v4 is ~8.5× faster than v3 on that row again),
  `scn: explore` 164.7 → 39.3 µs, `scn: select-all + fit` 7.14 →
  0.99 ms, `scn: drag` 411.9 → 103.7 µs.  The residuals over the
  pre-57.1d published numbers are the default sheet genuinely
  restyling on select, which pre-57.1d sheets never did.
  **`style.mjs` gained the row that prices the fork** — its 60.2
  state sheet conditions *geometry* (width/height/border-width), so
  it correctly keeps the full-write price (989 → 583 µs, the leaner
  dispatch only) and a new paint-only state row (the default sheet's
  shape) prices the diff path: 8.9 µs (no restyle) / **31.4 µs**
  (round-61 diff path) / 595 µs (all channels), with a startup probe
  asserting the paint sheet actually restyles, which is what catches
  control 2 in a benchmark run.
  **And the quick profile was re-measured and published at the
  round's close** (`6df994f1`, clean tree), so the 60.1 comparison
  page — the tool that found the regression — shows the recovery
  against its own baselines: whole-run drift vs the pre-regression
  2026-08-05 run is **×1.017**, inside machine noise, with every
  regressed select row recovered (mut-bulk 6301 → 231 µs against the
  baseline's 47.9, the residual being the default sheet genuinely
  restyling).
- [x] **61.4 Closing docs sweep** (2026-08-09) — the 60.4 record
  annotated with the closure; the README's default-stylesheet
  performance note rewritten from "what is not free" to the
  three-configuration contract; the `style.mjs` header and select-row
  comments; the summary rewrite (week 4 and the what-remains table).
- [x] **61.5 The smaller flagged movers, re-checked through built
  bundles** (2026-08-09, maintainer-requested) — the 60.4 list's
  deferred half, measured the way that record demanded: the baseline
  commit (`dc6d3505`, the 2026-08-05 published run's sha) built in a
  worktree with today's rolldown so the A/B isolates library code
  from toolchain, both bundles raced in one process under the suites'
  own K=8 rotation and `do_not_optimize`.
  **Three of four are noise, one was real, and the real one is
  fixed.**  `elements()` reads 33.4 vs 35.4 ns (the published
  8.5 → 39 ns was a tsx-environment artifact on both ends);
  `contains()` is 1.00×; `forEach()` read 1.45× in a combined run
  and **parity in all six isolated runs at both bench orders**
  (3.51–3.66 µs both sides, with whichever side runs *first*
  slightly ahead — the round-55 measurement-order bias, which is
  what the published +48% was too).  `lock + unlock` reproduced at
  **1.83×** (3.64 → 6.69 µs on a 256-band) — real, and localized on
  sight: 57.1d's `flagRefs` gate collects changed slots for any
  condition-*family* bit, but `noteStateChange` discards the array
  for a key no `case` condition watches, so every bulk
  lock/grabify/selectify under the default sheet (which watches
  selection and press only) built a slot array nobody consumed.
  The fix folds the per-group `watchedStates` check into the gate;
  attribution proven by the fix collapsing the row to **4.51 vs
  4.52 µs**.  No observable behaviour changes — the discarded array
  was the whole defect — so the pin is the existing state-conditions
  suite (watched bits still notify and restyle) plus the
  `mutators.mjs` lock row.  The insertion moved the SHAPE_MASK
  allowlist key and the throw gate failed naming it — the 37.1
  mechanism's fifth live firing — re-keyed 2906 → 2912.
  Verification: typecheck, 2111 + 337 + 24 Node specs, the throw
  gate at 184/10/5/0, lint, format.  Playwright not re-run: the
  change gates an allocation in the store and touches no rendered
  or observable path, and the full Node tier is the coverage that
  exercises `flagRefs` in both directions.
  Verification for the round: typecheck, **2111 Node + 315 module +
  24 soak tests**, the throw gate green at 184/10/5/0 over 199
  sites, lint, format, JSDoc 100%/100% with `@throws` 18/18,
  `@param` 241/241, `@returns` 280/280, the regenerated
  `dist/cytoscape.d.ts` (45 type exports / 3 statics / 1226 doc
  blocks), and the full Playwright suite against a fresh bundle with
  **goldens exact** — the factored writers are instruction-identical
  for a full apply, and the exact goldens are what proves it.
