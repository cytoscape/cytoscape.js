## The performance review: the full suite against the 13 Aug baseline

The maintainer's directive, 2026-09-01: **run the full benchmark suite,
fix the straightforward regressions, log the complex ones.**  The last
published runs were the post-merge baseline at `0d3561de` (13 Aug: the
`all`, `renderer` and `algorithms-gpu` profiles); 43 source commits had
landed since — rounds 85–98 (the layout, renderer and runtime rounds),
90's API review, 101, 108–112.  This round is the measurement of that
span, read the way the archive's own rules say to read it: medians of
three, screened against each row's own band, with the frozen v3 twin as
the control.

### What the review found, in one table

| profile | run | rows shared with 13 Aug | drift | screened regressions | v4-slower pairs |
|---|---|--:|--:|--:|--:|
| `all` (Node 22 — **discarded**) | `results-2026-09-01T22-32-32-993Z` | 450 | **+7.9%** | 72 | 2 |
| `all` (Node 24) | `results-2026-09-01T23-46-31-527Z` | 450 (281 epoch breaks) | −0.8% | **1** | **1** |
| `renderer` | `results-render-2026-09-02T00-36-36-160Z` | 0 (348 epoch breaks) | — | — | 0 |
| `algorithms-gpu` | `results-alggpu-2026-09-02T00-59-16-334Z` | 171 | −4.5% | 0 | — |

The library did not regress across the span.  The one screened
regression is a row whose own band is 17% and which moved 19%
(below); the one v4-slower pair had read at parity in the baseline
too and was fixed in 113.2.  The first hour of the review measured the
wrong thing entirely, and two of the three fixes this round shipped are
about the instrument, not the library — which is the round's actual
finding.

### 113.0 — the review that measured two engines (2026-09-01)

The sweep was launched from a shell that had not activated mise, so
the system Node ran: **22.22.2 against an archive measured on 24.18.0**.
Nothing refused it.  The machine fingerprint ignores the Node version
*by design* — round 46.5 decided an upgrade must not split a box's
history — and so nothing downstream can tell a V8 change from a
library change.  The comparison came back with 72 screened
regressions, +7.9% whole-run drift, and **every frozen v3 control
moving too** (+17% to +49% on the traversal rows, +78% on `pan() get`).
That last column is what gave it away: v3 is frozen code, so when it
moves, the box or the engine moved.  An hour of measurement, discarded.

The same run failed `layouts.mjs` on all three passes, and came back
under a **different machine fingerprint** (`0e0e967f` against the
archive's `2d2ea233`) on the same i9-9900K, because a kernel upgrade
(6.19.14 → 7.1.10) had moved `os.totalmem()` by 1,187,840 bytes and
total RAM entered the hash byte-exact.  `buildComparison` refused to
draw a line from any published run to the new one — the cross-machine
rule doing its job on the wrong input.

### 113.1 — three instrument fixes (2026-09-01)

- **The flow row's fixture is one component** (`317305a0`).  The
  failure was "90 distinct rows for ~45 stages — ranks are not forming
  rows", and the assertion was right: the fixture's skew edge used a
  fixed column map (`i * 7 % stageW`), which is a permutation of the
  columns, so the staged DAG split into one component per orbit and
  flow packed the components as stacked tiles.  The same count
  reproduces at `240d80a2`, the commit that added the row — **it had
  never passed at the size the `--all` table runs it at**.  Adding the
  stage to the skew links different column pairs at each rank; the
  fixture is one component, flow draws 36,538 crossings to
  breadthfirst's 45,473, 45 rank rows, 178 ms/iter.
- **The fingerprint rounds RAM to the GiB; the archive re-stamped**
  (`5107c36e`).  `fingerprint()` hashes `Math.round(totalBytes / 2 **
  30)`; a fitted 16 GiB still changes the id, a kernel's reservation
  does not, and the spec pins both.  `scripts/benchmark-backfill-fingerprint.mjs`
  recomputes the id from each published run's stored `meta.machine`
  block — the harness backfill's shape from 65.12 — and all 21 runs
  moved from `2d2ea233` to **`5cf3f79c`**, which is also what the new box
  state hashes to.  One machine, one history.
- **The runner refuses a Node other than `.nvmrc`'s** (`0f7ff936`).
  `report.mjs` exits before spawning anything on a different major
  (`--any-node` is the deliberate override, for pricing a runtime rather
  than the library); `benchmark:publish` carries `meta.nodeVersion`
  into the index as `node` and warns when it differs from the previous
  run of that (machine, profile).  The benchmarking note gained a
  "before the run" section with all three lessons.

### The Node 24 review run, read row by row

`--all --repeat 3`, serial, Node 24.18.0, at `5107c36e` (tree clean;
the two 113.1 commits touch no `src/`).  45.4 min.  450 rows shared
with 13 Aug; **281 epoch breaks**, all in four suites whose harness
files changed in the span — `layouts` (85.1/85.2's radial and mapping
rows, and 113.1's fixture), `spatial` (92.1's exact-tier bounds rows),
`surface` (90.5's removals) and `labels` (94.1's EDT rows) — which the
page renders as breaks rather than percentages, as 65.12 designed.
Those suites are read within-run only: every v3-vs-v4 pair in them
reads v4-faster.

**The one screened regression.**  `data · query: predicate function
(both sides) · gpu`, 76.1 → 90.3 µs (+19%), its own band 17% on both
sides, v3 control +3.3%.  Three probes before touching code, per the
benchmarking note:

1. *Through the built bundle*, the same operation (`nodes().filter(n =>
   n.data('weight') > 3)`, 2,000 nodes) read 68.6 µs at `0d3561de` and
   73.4 µs at HEAD — +7%, not +19%; the suite's tsx `__name` wrapper
   amplifies closure-heavy rows (round 34's lesson).
2. *Finer*: handle-only iteration was *faster* at HEAD (10.0 → 8.5 µs),
   a single handle's `data()` read was equal (36.2 vs 35.8 µs per 2,000
   reads).  Nothing on the path got slower in isolation.
3. *Per commit*: the bundle was built and the micro run at each of the
   43 source commits in the span.  `nodes.forEach(data)` read **45.8 to
   52.5 µs, median 47.7**, with docs-only commits at both ends of the
   band (51.7 µs at `a34e96bd`, a record rewrite) and no step anywhere.

So the row's movement is the row's band.  Logged, not fixed: what it
needs is not a code change but a narrower instrument — the `(x32)`
amplification 62.6b gave the nanosecond rows, applied to a row whose
per-element cost is ~40 ns.

**Unscreened movers (13)**: eight one-shot rows in `curves` and
`arrows` (edge.controlPoints ×4000 +94% beside `boundingBox` ×20 −49%
in the same suite — the one-shot pattern 62.7 named), and five inside
their own bands.  None carries evidence; none was acted on.

**The pairs.**  269 v3-comparative pairs, geometric mean **10.6×**
(13 Aug: 270 pairs, 10.7×).  One pair v4-slower: `core: filter(fn)` at
**0.96×**.  Worth recording against the executive summary's standing
claim that "all 366 pairs read v4-faster": the 13 Aug baseline already
had two pairs at or under parity (`style('background-color')` 0.98×,
`getElementById()` 1.00×), and `filter(fn)` had read 1.01× there.  The
claim was true when round 62 wrote it and was not re-measured by the
rounds that published after — exactly the staleness the summary's own
rules warn about.  This round re-measures it.

### 113.2 — the predicate filter stops re-interning (2026-09-01)

`core: filter(fn)` — `cy.filter(e => e.isNode())` over 6,000
elements — read 429 µs against v3's 414.  Not a regression (1.01× on
13 Aug, 0.96× now, band 5%) but a pair at parity for a year-old
reason, and a straightforward one.  Two costs, both on the predicate
path only (`1cf40818`):

- **`Core._query` answered a function by scanning.**  It compiled an
  empty query and built a fresh whole-graph collection — 6,000 handles
  re-interned through `_eleFromRef` — before the predicate saw one
  element, while `elements()` had answered the same question from the
  round-34.2 memo since round 34.  It now filters `_allOf(restrict)`,
  so `cy.filter(fn)`, `cy.nodes(fn)` and `cy.edges(fn)` all start from
  the memo.
- **`Collection.filter(fn)` re-interned every kept ref** to build the
  result, though the handle it had just called the predicate with is
  exactly what re-interning returns.  It now passes those handles
  through the constructor's `handles` path, which `slice()` has used
  since 62.4 for the same reason.

Measured through the built bundle (Node 24.18, medians of 9), then in
the suites:

| row | before | after | v3 |
|---|--:|--:|--:|
| bundle: `cy.filter(isNode)`, 6k elements | 260 µs | **101 µs** | — |
| bundle: `nodes.filter(isNode)`, 2k nodes | 71 µs | 60 µs | — |
| bundle: `nodes.filter(data('weight') > 3)` | 68 µs | 64 µs | — |
| suite `core: filter(fn)` | 429 µs (0.96×) | **101 µs (4.1×)** | 414 µs |
| suite `iter: filter(fn)` | 127 µs | 107 µs | 249 µs |
| suite `sweep: filter(fn)` | 265 µs | 79 µs | 427 µs |
| suite `data: predicate function` | 90 µs | 86 µs | 669 µs |

The data row barely moves because its cost is the `data()` read per
element, which confirms probe 2 above.  Nothing observable changes:
order is store order either way, the result is always a new collection
(never the memo itself), the handles are the same interned objects,
and a `thisArg` still binds — the new spec in
`test/collection-building-filtering.mjs` pins each, plus that a
structure change between two calls is seen.  `npm run -s verify` and
`npm run -s test:node:quiet` green.

### The renderer profile: an epoch, read raw

All 348 rows are harness breaks — the render bench changed in 87.2
(the `--layout` rows) and 95.1 (the outlined-labels row), and the page
refuses the line.  Read raw, knowing that, the span's renderer rounds
show as they were priced:

- **Device time down 50–66%** on every scene's far-zoom pan (1.41 →
  0.69 ms) and on the compaction pans (0.98 → 0.34 ms compacted) — the
  91–94 rounds' resize, exact-fit and atlas work.
- **The curved scene's device time up**: fit-all 10.6 → 13.2 ms,
  far-zoom 7.2 → 12.9 ms.  Round 93's table priced exactly this when
  it chose 32 segments over 24 (13.19 / 14.14 ms measured then); a
  deliberate trade, recorded there, confirmed here.
- **`init: create + ready (labels)` on the wrapped-labels scene**: 190
  ms on 13 Aug, **307 ms** in this run, **224 ms** on an immediate
  single-scene rerun, with its outlined twin at 209 / 215.  A one-shot
  row (unscreenable by rule) with a 40% spread between two readings an
  hour apart; the candidate is 94.1's atlas zoom tier, which does more
  work at first raster.  **Logged** — see the follow-ups — because the
  row cannot say whether it moved.

### The algorithms-gpu profile

171 rows, no epoch break, drift −4.5%, nothing screened (the profile
runs once per row, so every mover is unscreened by rule).  The GPU side
read 20–52% faster on the n=512 families (affinity propagation 114 →
55 ms, heat kernel −37%, Floyd–Warshall −24%) with **no commit under
`src/algorithms/` in the span** — a driver or box state change, and
the cpu control's ±1% says the CPU side did not move with it.  Two CPU
one-shots read up (affinity propagation n=1024 1.10 → 1.39 s,
neighbourhood similarity n=1024 90 → 110 ms), and the sub-millisecond
cpu rows (katz, pageRank) move by 0.1 ms steps because that is the
profile's timer resolution.  Logged with the other one-shots.

### Follow-ups logged, not taken

Each is a measurement question before it is a code question, and none
met the round's bar of *straightforward*:

1. **The wrapped-labels init one-shot** (190 → 307 / 224 / 264 ms).  Give the
   renderer's init rows repeats, or at least the two-reading band the
   `--repeat` runs record, before deciding whether 94.1's first-raster
   work is a cost worth a lazy tier.
2. **The predicate-row band** (`data · predicate function`, 17%).  A
   row at ~40 ns per element needs the `(x32)` amplification or a
   larger N to carry evidence; until then it will flag on every third
   run.
3. **The algorithms-gpu one-shots** (AP n=1024 +27%, neighbourhood
   similarity +22%).  The profile's rows are single-shot by design
   (a GPU sweep at three repeats is 50 minutes); a `--repeat` for the
   CPU side alone would screen them.
4. **The GPU-side speedups with no source change.**  Worth one
   `npm run gpu` and a driver-version line in `meta.adapter` so the
   next such step has a suspect on the record.

### Verification run (2026-09-02)

A clean re-measurement at `9ed49abc` (the record commit; `src/` is
113.2's) — the renderer and algorithms-gpu profiles again, because
their first runs ended on a tree carrying the then-uncommitted 113.2
edit and are flagged dirty, then `--all --repeat 3` — published
alongside the `5107c36e` review run (four runs, all Node 24.18.0,
all under the one fingerprint `5cf3f79c`):

| profile | run | against 13 Aug | against the review run |
|---|---|---|---|
| `all` | `results-2026-09-02T02-03-57-714Z` | drift −1.4%, **0 regressions**, 3 improvements (`core: filter(fn)` −76%, `sweep: filter(fn)` −69%, `iter: filter(fn)` −14%) | 749 shared rows, drift −0.6%, the same two filter rows as improvements |
| `renderer` | `results-render-2026-09-02T01-25-18-372Z` | epoch break (by design) | curved device 13.2 / 12.9 ms again; wrapped init (labels) **264 ms** |
| `algorithms-gpu` | `results-alggpu-2026-09-02T01-47-37-618Z` | drift −4.5%, 0 screened | AP cpu n=1024 back to 1.07 s (13 Aug: 1.10) |

**The pairs, re-measured for the summary**: `all` **269 v3-comparative
pairs, geometric mean 10.7×, minimum 1.02× (`data: get`), zero
v4-slower**; renderer **104 pairs, geometric mean 31×, zero v3-faster**;
algorithms-gpu 57 cpu/gpu pairs, geometric mean 7.7× (13 Aug: 7.2× —
the summary's "13×" was a different sample, round 65.9's seven
families; this is the whole executor sweep including the propagation
tier's CPU-favoured sizes).  So the round-62 property — every
comparative pair v4-faster — holds again at **373 pairs**, having been
broken at one pair (and the baseline at two) without anyone measuring.

Two things the verification run added to the log rather than the
ledger.  One screened mover against the review run, `compaction ·
control: nodes({ selected }) scan · peak` +13% (22.4 → 25.2 µs, bands
4–7%) — a v4-vs-v4 *control* row whose source did not change between
the runs; its compacted twin did not move, and it goes on item 54's
list as a fifth row whose band is narrower than its behaviour.  And
the wrapped-labels init one-shot's fourth reading, 264 ms — the row's
readings are now 190 / 307 / 224 / 264 against its outlined twin's
188–215, which is the shape of a row that needs repeats, not a fix.
