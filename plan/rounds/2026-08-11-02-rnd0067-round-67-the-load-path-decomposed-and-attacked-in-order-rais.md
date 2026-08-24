## Round 67 — the load path, decomposed and attacked in order (raised by the maintainer 2026-08-11)

Round 66 took the ndex-x-large harness page from 2899 to 1756 ms and left
the question of what is *next*.  This round starts by measuring rather
than guessing, then takes the items in order, keeping only what its own
benchmark supports.

**The decomposition.**  ndex-x-large (19,607 nodes / 464,657 edges) in
Chromium on a real adapter (AMD GCN-4), JSON path, fetch to first
rendered frame:

| phase | ms | whose |
|---|---|---|
| fetch | 105 | app (the wire format takes this to ~37) |
| `JSON.parse` | 175 | app |
| `toGpuElements` | 105 | harness |
| **`cytoscape( { elements, style } )`** | **1150** | **library** |
| `cy.ready` | 100 | library |
| first frame | 85–400 (unstable — see 67.3) | library/driver |
| fit + frame | 18 | library |

Inside init, through the built ESM bundle (three loads, self time):
the style apply is **818 ms of 1150 (71%)** — `_applyStyle` →
`applyGroupDef` → `applyMapped` → `write` → `writeChannels`; the columnar
store ingest ~210; `buildColumnar` ~73; `fit()` ~30.

**The round's result, measured in one A/B rather than chained** (the
round's starting commit `44d84999` built in a detached worktree against
`HEAD`, bundles swapped and alternated, five browser reps and nine
headless):

| | before | after | |
|---|---|---|---|
| ndex-x-large, headless init | 1195 ms | **622 ms** | **1.92×** |
| ndex-x-large, browser init | 1164 | **649** | 1.79× |
| ndex-x-large, fetch → first frame | 2047 | **1569** | −478 ms |
| synthetic 50k/150k, minimal sheet | 385 | **221** | 1.74× |
| synthetic 50k/150k, typical sheet | 454 | **297** | 1.53× |

The rendered frame is **byte-identical** at both ends: the harness's
ndex-x-large page fitted and screenshotted through both bundles, **0
differing pixels** of 1,024,000.

**And inside the style apply, the cost is not the mappers.**  Two
controls through built bundles, on the edge branch of `writeChannels`:

| edge branch | init |
|---|---|
| as shipped | **1170 ms** |
| only the one *mapped* channel (`line-color`) written per edge | 470 ms |
| skipped entirely | 483 ms |

The mapped channel is at the noise floor (470 vs 483).  The **687 ms**
between them is per-element writes of ~20 channels whose value is the
same for every edge in the graph.  Priced directly: `store.setScalar` is
**26.4 ns**, of which **15.8 ns is `column( id )` alone** — two
string-keyed map lookups — and 1.2 ns is the write; a `fill()` over the
same run is **0.1 ns per element**.

Not specific to that fixture: on a synthetic 50k/150k graph with
all-constant sheets, skipping the edge branch takes a minimal sheet from
380 to 200 ms and a typical one from 470 to 260.

### 67.1 — the curve index takes one pass, not a mark per edge (2026-08-11)

`CurveIndex.setStyle` marks the edge's endpoint pair pending for every
edge, since any one record change may re-fan a bundle.  Over a whole
load that is 464,657 `Set` inserts of a float pair key — measured at
**112 ms** of self time — plus a flush that iterates all of them, and it
derives nothing that one pass over the finished pair map would not: at
the end of a load every pair is new, so the union of the marks is the
whole map.

Landed: `beginBulk()`/`endBulk()` on the index (marks suppressed inside
the window; `endBulk` marks every key in the pair map and every loop
list), `beginBulkLoad()`/`endBulkLoad()` on the store, and
`Core._bulkAdd` holding the window across the whole ingest in a
`finally`.  `cy.add()` deliberately gets none: adding into a populated
graph touches a small subset of the pairs, so the union would be more
work than the marks.

**Measured** (bundles swapped, alternated, own process): headless init of
ndex-x-large with the derivations flushed **1223 → 1044 ms, 1.17×**
(medians of 9); the same page in Chromium init **1142 → 1021**, total
**2017 → 1893** — every "after" total below every "before".  Synthetic
50k/150k, no flush in the timed region: 392 → 371 and 450 → 434.

Verification: `test/curve-bulk-window.mjs` compares the two routes into
the same graph — `cytoscape( { elements } )` against `cytoscape()` +
`cy.add()` — over every derived curve param, blob record and curve flag,
on a fixture with three- and two-member bezier bundles (one reversed), a
lone member, three staggering self-loops, a compound relation and a
blob-family edge.  **Control**: with `endBulk` marking nothing, **42**
specs across the existing suite fail and two of the three new ones do.

### 67.2 — the bulk edge style apply (2026-08-11)

The 687 ms above, taken directly.  A contiguous run of edges whose
per-element variation is confined to props with round-61 **narrow
writers** takes its whole styled record from one template slot: the
template is written the ordinary way, every column in
`EDGE_STYLE_COLUMNS` is filled from it by `copyWithin` doubling, and each
remaining slot pays only its own mapped props plus the per-slot half of
the edge branch.

Three pieces:

- [x] **The column split lives in `contract.mts`.**
  `EDGE_PER_ELEMENT_COLUMNS` names the three a shared record does *not*
  determine — `edge.endpoints` (the ingest's), `edge.flags` (per-element
  bits) and `edge.curveParams` (derived) — and `EDGE_STYLE_COLUMNS` is
  everything else.  It sits beside `COLUMN_SPECS` because adding a
  column is what forces the classification, and a spec fails until a new
  edge column appears in one list or the other.
- [x] **`writeChannels`'s edge branch splits in two**: `writeEdgeColumns`
  (the fillable columns) and `writeEdgePerSlot` (the two flag bits, the
  invisibility cascade, the curve record, the label sidecar).  One
  definition, two callers — the round-61 discipline.
- [x] **The gate.**  A run qualifies when it is edges, contiguous,
  ≥ 64 slots, has no open transition capture and no bypasses, *and* every
  mapped prop either has a `fastStateWriter` (which by round 61's
  invariant writes every column that prop affects) **or** reads state
  flags only over a run whose masked word never changes — which is what a
  freshly loaded graph is.  That second clause is what admits this
  repo's own sheets: `line-opacity` has no narrow writer and could not
  have one without the whole B1 fold cluster, but at rest its value is
  the template's for every edge.  Nodes decline outright: their branch
  hands out per-slot blob records (custom polygons, images, charts) whose
  refs a copy would alias.

**Measured** (bundles swapped, alternated, own process, on top of 67.1):

| workload | before | after | |
|---|---|---|---|
| ndex-x-large, headless init | 1031 ms | **836 ms** | 1.23× |
| ndex-x-large, browser init | 992 | **790** | −203 ms |
| ndex-x-large, fetch → first frame | 1864 | **1674** | −190 ms |
| synthetic 50k/150k, minimal sheet | ~370 | **~250** | 1.48× |
| synthetic 50k/150k, typical sheet | ~445 | **~295** | 1.5× |

Over 67.1 and 67.2 together the harness page goes **2017 → 1674 ms**, and
init **1142 → 790**.

**The spec's own history is the lesson of this round.**  The first
version of `test/bulk-style-apply.mjs` compared the bulk route against a
one-element-at-a-time route over a rich sheet and passed — and so did
*four* controls that deleted a column from the fill.  The sheet mapped
`curve-style` and `label`, neither of which has a narrow writer, so the
gate declined and every assertion compared the per-element path against
itself.  The fix is a counter (`StyleEngine._bulkRuns`) the spec
**asserts**, plus a second fixture that must decline.  With the route
actually taken, five of six column controls land — and the sixth
(`edge.gradient`) only after a gradient was added to the sheet, since a
column the fixture leaves at its default cannot show a missing fill.
That is round 46.5's "a control that fails to fail is a finding" twice in
one afternoon.

**A second control**: the whole existing suite run with `BULK_MIN_RUN`
forced to 2 — which takes the route on hundreds of runs that normally
never reach it — passes 2195/2195.

**And the picture is byte-identical.**  The harness's ndex-x-large page
driven in Chromium on a real adapter, fitted and screenshotted through
both bundles: **0 differing pixels** of 1,024,000.  That is the check
`AGENTS.md` asks for when a change touches drawing — the goldens answer
"did v4 change?", and this answers it on the one network that actually
takes the route.

Verification: 2203 test:js, 394 test:modules, 24 test:soak, all audits
100%, throw gate 0.

### 67.2b — the state affordances leave the per-slot loop too (2026-08-11)

Re-profiling after 67.2 put **143 ms of the remaining 498 ms apply** in
the narrow writers themselves: eight of them per edge, 464,657 times.
Seven were rewriting bytes the fill had already put there.

`bulkEdgeWriters` checked for a narrow writer *first* and only fell
through to the uniform-state clause when there was none.  But the two
clauses are not alternatives — a state-only mapper over a uniform run
never leaves the template's value **whether or not its prop has a
writer**, so the writer is pure waste.  Ordering the state clause first
is the whole change.  It matters because the selection affordances are
most of the mappers on an ordinary sheet: v4's *default* sheet alone
contributes five to the edge def, and the harness sheet's
`underlay-color`/`underlay-opacity`/`underlay-padding` all resolve to
the same writer, so the same record was being rebuilt three times per
edge.

**Measured** (bundles swapped, alternated, own process; medians of 9 for
the headless rows, two independent A/Bs): headless init **816–824 →
660–679 ms, 1.20–1.25×**; the harness page's init **792 → 655** and its
fetch-to-first-frame **1676 → 1543**.  The screenshot is again **0
differing pixels**.

The spec that guards it is the one this change makes load-bearing:
*'is exact when the run's state word is NOT uniform'* selects every third
edge, re-applies the whole sheet and compares columns against the
per-element route.  **Control**: making `uniformMaskedWord` always answer
true fails exactly that spec and nothing else.

**And writing it found a real bug in 67.2, which had shipped an hour
earlier.**  A state-only mapper reaches the per-slot loop only when the
word is *not* uniform — and `applyBulkEdges` evaluated the state mappers
**once, for the template**, so its writer wrote the template's value to
every slot.  The first spec written for it passed, twice, for two
different wrong reasons: the sheet's only state mapper had no narrow
writer (so the route declined), and then `_bulkRuns > 0` was satisfied by
the *initial* load rather than by the re-apply under test.  What exposes
it is narrow — a **data** mapper beside a state mapper that **has** a
writer (the data mapper is what denies the def a round-57.1 partition and
so routes the pass through `applyMapped`), over a mixed selection,
asserting the run count *delta* across the re-apply.  The fix is round
66.1's hoist inside the bulk loop: watch `flags & mask` and re-evaluate
the state mappers when it changes.  A uniform run passes `null` for the
flags column and skips the watch entirely.

Two lessons, both old ones in new clothes.  A graph **loaded at rest**
cannot exercise the non-uniform branch at all, so the entire round's
benchmark workload is blind to it.  And an accumulating counter answers
"has this ever happened", not "did it happen here" — assert the delta.

**Not done, and named**: the node branch.  Its per-element cost is real
(128 ms for 50k labelled nodes on the synthetic fixture) but it is
smaller than the edge side on every graph measured, its blob refs make
replication unsafe without further conditions, and node labels are
usually mapped — which the gate declines anyway.

### 67.2c — an unlabelled element stops paying for a label (2026-08-11)

Re-profiling after 67.2b left `writeEdgePerSlot` as the largest item in
the apply, and most of it was `writeLabel` — on a fixture whose edges
carry **no label of any kind**.  An unlabelled element built the whole
record anyway (~15 colour folds, a closure per call, the anchor solve)
to hand `setLabel` a `null` it discards on the first line.

Landed: the two end-label texts (D4) resolve up front rather than in
their own loop below, and an element whose main and end texts are all
empty clears its three streams and returns before the record is built.
Clearing is still correct for a slot that *had* a label — `setLabel(
null )` is what does it, and it is the cheap half.

**Measured**, and worth recording because the profile oversold it.  The
CPU profile put `writeLabel` at ~75 ms per load; three independent A/Bs
(bundles swapped, alternated, medians of 9) put it at **1.04×, 1.06× and
1.08×** — 669 → 641, 649 → 613, 656 → 609 ms.  Consistent in direction,
about **35–45 ms**, and roughly half what the profile suggested: at
1 ms sampling over a 650 ms load there are only ~650 samples to divide
among a hundred functions, so a per-function figure is a hypothesis to
A/B, not a measurement.  On the 50k/150k synthetic it is at the noise
floor.  The harness page: init **677 → 644**, total **1569 → 1526**,
screenshot **0 differing pixels**.

**Controls**, both landing: an early-out that forgets to clear fails 5
specs; end-label texts that never resolve fail 9.

### 67.3 — overlapping GPU acquisition with the ingest: measured, and not landed (2026-08-11)

`src/index.mts` ingests the elements and runs the layout *before* it
constructs the `Renderer`, so `requestAdapter()` + `requestDevice()` —
which need nothing from the model and nothing from the DOM — start after
~1.1 s of synchronous CPU work they could have overlapped.  Probed on an
idle page they cost **~100 ms**, and a synthetic control looked
promising: an acquisition started before a 1000 ms `spin()` costs only
~38 ms after it, so ~60 ms overlaps.

Implemented — `requestGpuDevice()` split out of `initGpuContext`, the
promise started in the factory before `_bulkAdd`, adopted once by the
renderer — with a Node spec against a fake `navigator.gpu` for the
adoption, and it **does exactly what it claims**: instrumented in the
browser, `requestAdapter` moves from 2 ms before the factory returns to
**1121 ms** before, and the container holds no canvas yet when it fires.

**And it buys nothing.**  Five reps, bundles swapped and alternated:
`cy.ready` 99.0 vs 99.8 ms, totals indistinguishable.  The reason,
measured in situ: the adapter promise resolves **~34 ms after the factory
returns in both cases** — whether the request was issued 2 ms or 1100 ms
earlier.  Whatever the synthetic `spin()` case overlaps, a real ingest
does not: the remaining cost is main-thread work that cannot run while
the main thread is busy.  Reverted.

The lesson is round 33's, in a new place: the ~100 ms came from an
**idle-page** probe, and an idle page is exactly the configuration this
measurement is not about.

### 67.4 — the first frame is not measurable on this machine, and that is the finding

The first frame read **85 ms, 390 ms and 1100 ms** across runs differing
only in browser launch environment, with the library unchanged.  One
observation is worth recording because it was stable across seven
consecutive runs before it stopped reproducing: **312 of a 390 ms first
frame was a single synchronous stall on the glyph atlas canvas's first
draw op** — `ctx.clearRect` in `GlyphAtlas.build`, where the *immediately
following identical* `clearRect` cost 0.0 ms.  The whole fixture
rasterizes 40 distinct glyphs and `computeSdf` accounts for 7 ms of the
total, so this is not the SDF and not the glyph count.  Warming that
canvas in the atlas constructor removed it in one run and did nothing in
a later 3-rep A/B with bundles swapped.

So: a real stall with an unidentified trigger, and **not** a validated
fix.  Anyone taking the first frame should pin the trigger before
writing code, and should expect to need a way to hold the machine in the
state that reproduces it.

