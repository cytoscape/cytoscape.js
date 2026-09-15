## The layout quality audit: one sub-round per layout, each signed off by the maintainer

Raised by the maintainer on 2026-09-14 (`docs/features.csv`, "Layout
quality audit & iteration", **Partial / WIP**) and planned on
2026-09-15.  Round 122 closed the *portfolio* audit — which use cases
exist, which built-in is the flagship for each — and round 123 filled
the one gap it found.  What that did not do is look at the pictures.
Round 114.8's quality suite asserts properties a spec can assert
(placement, fit, `boundingBox`, body and label overlap, locked nodes,
component separation, the lifecycle), and rounds 116–124 improved
`force` and `flow` where a measurement pointed; nothing has yet sat a
person in front of each layout on the application graphs and asked
whether the result is *good*.  The maintainer's clarification is that
built-in coverage does not establish finished quality, and that the
quality review is a review of representative app graphs for overlaps,
crossings, spacing, hierarchy readability, component packing and
stability, iterated on algorithms and defaults with runtime measured
alongside.

### The shape of the round

One sub-round per layout, one for packing, and one for the page the
sittings run on, in the order below.
Each sub-round has the same four parts, and **each ends with a
maintainer review sitting** — the sub-round is not landed until the
sitting is recorded on this file with the maintainer's verdict and the
findings it raised.  Agents prepare; the maintainer judges.

1. **The fixture set for the layout.**  Three to five graphs drawn
   from the application graphs already in the repo — em-web and the
   ndex-x-large scene on the debug page, the npm-deps and reactome
   networks, the DAG fixtures under `benchmark/fixtures/dag/` (deps,
   workflow-1k, workflow-10k, reactome, greek-gods, compound,
   deep-skips) — plus one small synthetic graph that exercises the
   layout's known weak case.  Each fixture is named, sized and pinned
   so the pictures are reproducible from a seed.
2. **The measured baseline.**  The quality suite's probes run on each
   fixture and the numbers written down *before* anything changes:
   body and label overlap pairs, edge crossings, edge-length mean and
   variance, bounding area against the sum of node areas, and the run
   time at that N from the render-bench `--layout` rows.  For the
   layouts with an order (flow, breadthfirst, circle, concentric) the
   crossing count is the headline; for force it is the settle's
   overlap and the edge-length variance; for the packers it is area
   and the largest component's centre.
3. **The pictures, and the iteration.**  Every fixture rendered on the
   debug page at fit and at one working zoom, saved to the round's
   directory with the commit and seed in the filename.  The agent
   reads the pictures against the six criteria — overlaps, crossings,
   spacing, hierarchy readability, component packing, stability
   across re-runs and across small edits — and lists what it sees.
   Fixes to algorithms and defaults that the pictures justify are
   made in the sub-round, each with its baseline re-measured and its
   runtime re-measured, so a quality gain that costs the performance
   priority is visible as such.  A default changed is a changelog and
   MIGRATING entry.
4. **The maintainer review sitting.**  The maintainer opens the page,
   runs the fixtures, and records on this file: accepted as is, or the
   findings that stay open and whether they block.  Findings that
   block become items in `PLAN.md`; findings that do not are logged
   under the sub-round and dated.  **A sub-round with no recorded
   sitting is not landed**, whatever its specs say.

The shared lever across all of them is the quality suite: every
sub-round that finds a defect the suite could have caught adds the
row, with its control (`docs/agents/testing.md`), so the next audit
starts from a stronger floor.  A property that only a person can
judge — readability — stays with the sitting and is not faked as a
spec.

### The maintainer's first sitting (2026-09-14 and 15), before any sub-round

The maintainer sat in front of the debug page ahead of the round and
reported what follows.  These are the round's opening findings — each
is assigned to its sub-round below, and each sub-round's sitting
starts by checking that it is gone.

- **`avoidOverlap` with labels is broken, at least on `force`.**  The
  label-inclusive overlap path does not hold the labels apart.
  → 125.1.
- **`avoidOverlap` fights the tidy small components** on `force`: the
  N = 4 diamond (120) and the overlap pass pull the four nodes in
  different directions.  → 125.1.
- **The shelf packer wastes the space EnrichmentMap's packer wastes.**
  `shelfPack` (`src/layout/pack.mts`) places boxes in rows, one
  component per column, and every row is as tall as its tallest
  member — so a row holding one tall component and several short ones
  leaves the short ones' columns mostly empty, and the effect
  compounds when component sizes are far apart.  This is the same
  limitation the maintainer sees in EM web's vendored packer.
  Reproduction: the EM sample network on the page, `radial`,
  `avoidOverlap` on, `packComponents` on, tidy on.  → 125.9.
- **`flow` is too spread out on reactome, even with `avoidOverlap`
  off**; with it on, and especially with labels, the picture becomes
  far too spaced.  The Greek-gods network shows the same, but only in
  the label-inclusive `avoidOverlap` case.  With `avoidOverlap` off,
  reactome under `flow` is mostly fine.  → 125.2.
- **`flow` has degenerate cases on reactome**: "IRAK1 recruits IKK
  complex …" sits far from its only neighbour with no crossing to
  justify it (at least with taxi edges), which reads as wrong.
  → 125.2.
- **`breadthfirst` on reactome is too airy even without
  `avoidOverlap`.**  → 125.4.
- **The rendered reference picture is now on disk**:
  `benchmark/fixtures/dag/greek-gods-reference.svg`, Abrate's tangled
  tree as the notebook draws it, the bar for the flow and taxi
  pictures.  → 125.2.
- **Edges coloured as their source node** would make the reactome and
  workflow scenes more legible.  A style-side change on the page's
  scenes, not a layout change; it is also what the reference picture
  does.  → 125.10.
- **The page needs a second spacing slider that acts live.**  The
  existing one sets `spacingFactor` for the next run.  The new one
  should rescale the *current* positions about their centre as it is
  dragged — a `preset` with the scaled positions, or the equivalent —
  so a sitting can find the right spacing by eye and read the factor
  off.  → 125.10, and it goes first, since every later sitting uses
  it.

Two general levers fall out of the findings, and both are shared
across the sub-rounds:

- **A measured "too airy".**  The quality suite has an overlap probe
  and no probe for the opposite failure, and the findings above are
  mostly the opposite failure.  The probe: the distance from each
  node's bounding box to its nearest neighbour's, and for each edge
  the gap between its endpoints' boxes, summarised as a distribution
  per fixture (median, p90, max against the median node size).  A
  quadtree over the boxes, used only in the tests, keeps it linear-ish
  at the app graphs' sizes.  For `flow` the DAG form of the same
  probe: each node's distance from its parent in the DAG, against the
  rank gap — the IRAK1 case is a large outlier on that column with
  nothing on the crossing column to explain it.  Every sub-round's
  baseline carries these columns from 125.1 on, with the control the
  testing note requires (a deliberately spread fixture must read
  airy).
- **Explicit node separation on the geometric layouts.**  `circle`,
  `radial`, `grid` and `concentric` compute their spacing from a
  factor over their own default; the maintainer's suggestion is an
  option that names the margin between nodes directly (a
  `nodeSeparation` / margin in model pixels), so a picture can be
  fixed by saying what is wanted rather than by guessing a factor.
  Whether one spelling fits all four, and how it composes with
  `spacingFactor` and `avoidOverlap`, is a call for the sittings of
  125.3, 125.5, 125.6 and 125.7; the option is designed once, in
  whichever of those runs first.

### The sub-rounds

**125.1 — `force`.**  The flagship for organic graphs and the layout
with the longest history of measured fixes (59, 85.2, 116, 117, 118,
119).  Fixtures: em-web (569 × 6,899), ndex-x-large, npm-deps, the
25k scene, and a small compound graph with locked children.  Criteria
in focus: edge-length variance and the crammed-settle overlap that
118.1 fixed; whether the spectral seed's determinism holds across
`animate` / `live` / `infinite`; compound gravity's reading of parents
at fit; the `avoidOverlap` sim half now that it is opt-in (117) — is
the default picture the right default?  Runtime: the CPU and GPU
executors at each N against 119's rows.  **Maintainer review
required.**  Opening findings: the label-inclusive
`avoidOverlap` does not hold labels apart, and `avoidOverlap` fights
the N = 4 tidy diamond; both are reproduced on the page first, and
the label case gets a quality-suite row with its control before the
fix.

**125.2 — `flow`.**  The Sugiyama-class built-in (112) with 124's
tracks.  Fixtures: the seven DAG fixtures, all four `direction`s on
deps and greek-gods.  Criteria in focus: crossings against the 112.1
harness's dagre and elkjs rows — "comparable to dagre" is still the
bar — rank compactness, the long-edge and skip-edge cases
(deep-skips), compound ranking (compound.json), and the taxi
corridors' run-overlap count (124: 0 / 1 / 0 / 0).  The one on
workflow-1k is the case to look at.  Runtime: workflow-10k end to
end, and 124.7's sweep row.  **Maintainer review required.**  Opening findings: the picture is too spread on reactome with
`avoidOverlap` off and far worse with it on and labels included; the
Greek-gods picture shows the label case only; IRAK1's degenerate
placement.  The airiness columns above are this sub-round's first
measurement — rank gap and within-rank spacing as they are computed
against what the picture wants, and the label-inclusive dimension
read (114's one reading) checked for double-counting the label into
the spacing.  The picture is judged against
`greek-gods-reference.svg`.

**125.3 — `radial`.**  The tree flagship (85.1).  Fixtures: reactome
as a tree from its roots, a deep unbalanced synthetic tree, a wide
shallow one, and a forest (three roots).  Criteria in focus: sibling
spacing at the outer rings against label width, the root choice when
none is given, non-tree edges' crossings, and a forest's packing now
that 123 exists.  **Maintainer review required.**

**125.4 — `breadthfirst`.**  The v3 layout kept for parity, now with
123's trees as blocks.  Fixtures: deps as an undirected traversal,
reactome directed, and the forest.  Criteria in focus: whether the
`circle: true` form still earns its place beside `radial` and
`concentric`, the block bands' spacing, the `spacingFactor` default,
and the picture against `flow` on the same DAG — if breadthfirst's
directed picture is a worse flow, the record should say so and the
documentation should point at flow.  **Maintainer review required.**  Opening finding: too airy on reactome without `avoidOverlap`,
so the spacing defaults are the first thing measured.

**125.5 — `circle`.**  Fixtures: a 40-node clustered graph with a
`sort` mapping by cluster, em-web's largest component, and a ring of
labelled nodes at three label widths.  Criteria in focus: crossings
under the attribute-grouped order (round 122 declined an AVSDF order
"until an app asks" — the sitting decides whether the picture asks),
radius against label width, `startAngle` / `sweep` defaults, and
`clockwise`.  **Maintainer review required.**

**125.6 — `concentric`.**  Fixtures: em-web with `concentric` mapped
to degree, ndex-x-large with the same, and a synthetic graph whose
mapping has one heavy level.  Criteria in focus: level spacing when
one ring is crowded (`minNodeSpacing` and the ring's radius growth),
the `equidistant` picture, the per-component binning 123 added, and
label overlap on the outer rings.  **Maintainer review required.**

**125.7 — `grid`.**  Fixtures: em-web's singletons (EnrichmentMap's
actual use), ndex-x-large as a table, and a labelled set at three
label widths.  Criteria in focus: `rows` / `cols` inference against
the viewport's aspect, `avoidOverlapPadding`, label-aware cell size,
the `sort` and `position` mappings' picture, and whether `condense`
should be the default for the singleton case.  **Maintainer review
required.**

**125.8 — `preset` and `random`.**  The two without an algorithm,
audited for their contract rather than their picture: `preset`'s
handling of missing and partial positions, `fit` / `pan` / `zoom`
semantics on the CX2 round trip both apps ship, and `random`'s
bounding-box and seed determinism.  One fixture each.  Short, and the
sitting may take minutes.  **Maintainer review required.**

**125.9 — packing.**  Rounds 120, 121 and 123's machinery, audited as
one system: `packComponents` on the five discrete layouts, the `pack`
layout's regroup, force's settle re-pack, flow's own pass, the small
component shapes, `componentGroup` and `componentOrder`.  Fixtures:
em-web (the EM case: keep the sim, regroup), ndex-x-large, reactome's
forest, and a synthetic mix of sizes from singleton to hundreds.
Criteria in focus: packed area against the sum of component areas,
the largest component's centre held, the shelf's aspect against the
viewport, the orientation pass's turns, stability of the arrangement
under a one-node edit, and the cost of the re-pack at 121's batch
sizes.  **Maintainer review required.**  Opening finding: the
shelf's rows waste space when component sizes are far apart, one
component per column and the row as tall as its tallest — the EM web
limitation reproduced on the EM sample network under `radial` with
`avoidOverlap`, `packComponents` and tidy on.  The candidates are a
guillotine or skyline packer, or a shelf that fills a tall column's
slack with short components; the area column decides, with the
re-pack cost row beside it.

**125.10 — the page, as the audit's instrument.**  Not a layout, but
the sittings run on it, so it comes first.  Two changes from the
first sitting: a live spacing slider that rescales the current
positions about their centre as it is dragged (a `preset` with the
scaled positions, or the equivalent), beside the existing
`spacingFactor` slider that only applies on the next run; and edges
coloured as their source node on the reactome and workflow scenes.
The airiness probe gets a readout on the page too — the median and
p90 nearest-box distance for the current positions — so a sitting
reads the number it is judging.  **Maintainer review required.**

### What the round does not do

- **It does not add a layout.**  Round 122's declined candidates — a
  tidy tree, a crossing-minimised or clustered circle, a second force
  layout — stay declined.  If a sitting finds a picture that only a
  new algorithm fixes, that is a finding for `PLAN.md`, not a
  sub-round.
- **It does not change a default without the sitting.**  An agent may
  propose and measure a new default; the maintainer's review is where
  it is accepted.
- **It does not trade the performance priority for a picture.**  Every
  algorithmic change carries its runtime row, and a regression is a
  finding the sitting weighs, not a cost the sub-round absorbs.

### Sequencing

125.10 first — the page is the instrument, and the live spacing
slider is what every sitting uses.  Then 125.1 and 125.2 — the
flagships the apps actually run, and where the first sitting found
the most — then 125.9, since packing is what the pictures of every
other layout are seen through.  125.3 to 125.8 in any order after,
125.4 early because it already has a finding.  The sub-rounds are
independent enough to run in parallel worktrees, but the review
sittings are serial on the maintainer's time, so the plan is one
sitting per sub-round rather than one for the round; the round lands
when the last sitting is recorded and `docs/features.csv`'s row moves
from Partial.

### Controls

Each measured property is paired with the red control the testing
note requires: the crossing counter run on a fixture whose known
crossing count is nonzero; the overlap probe on the crammed fixture
with `avoidOverlap` off; the area probe on an unpacked forest.  The
pictures themselves have no control — that is what the sitting is.

**Open (maintainer):** whether the sittings are recorded here or one
file per sub-round; whether 125.8 is worth a sitting at all or folds
into 125.7's; and whether a default change accepted in a sitting
ships in 4.0 or waits for the round to land whole; the spelling of
the explicit node-separation option on the geometric layouts, and
whether it is one option across the four.

### The round, as carried out (from 2026-09-15)

The sub-rounds below were carried out in the planned order — 125.10
first, then the four with findings in parallel worktrees (125.1,
125.2, 125.9, 125.4), then the geometric quartet and 125.8 — each
against the maintainer's rule: defects fixed, defaults measured and
recommended but not changed, and **every sub-round pending its
sitting**.  The record is one section per sub-round; the sittings
are recorded under each as they happen.

### 125.1 — force

The two opening findings, both reproduced, both defects, both fixed.
Pictures and tables in `plan/pictures/rnd0125/125.1/`; the numbers
below are `npm run benchmark:layout-audit` rows, headless (the CPU
executor — what headless runs; the page's GPU executor was checked
separately for the label finding and reads the same), seed 1, the
page's production sheet.

**(a) Label-inclusive `avoidOverlap` — reproduced only at load, and
that is the app's case.**  Through the page's Apply button, after a
frame had been drawn, every mode the panel offers — `settle` with
animate off, on, and live, `sim`, `both`, and an infinite run stopped
after four seconds — left **0** label-box overlaps on em-web, on the
GPU executor (AMD gcn-4) and on the CPU one, flat and compound
(em-web-clustered, parents excluded), and on reactome, greek-gods and
workflow-dag.  The label boxes the layout separates are the label
boxes `boundingBox({ includeLabels: true })` reports, and they were
held apart.  What reproduced was the run **before the first frame**:
`?layout=force&avoidOverlap=true&overlapLabels=true` at load — the
`layout` option of `cytoscape()`, what an app does — left **14**
overlapping label pairs.  Cause: the store estimated every label's
block with a flat 0.54 em advance and let the renderer's glyph build
overwrite it with the laid block in the first frame *after* the
labels were set; a layout that ran before that frame separated
estimates.  On em-web 154 of 569 labels lay wider than their estimate
once laid, the widest by 36 px, so the boxes the frame drew overlapped
where the boxes the layout saw did not — and a page that had drawn a
frame before Apply never showed it.  Fix: `src/label-measure.mts` —
where a 2D canvas exists (a document, or an `OffscreenCanvas` in a
worker) the store measures the block with the same `breakLines` over
`measureText` advances at the atlas's 32 px scaled to the em, and
marks the dims exact; headless Node keeps the estimate (a recorded
deviation, as before).  After: at-create boxes against after-frame
boxes on em-web, **0 of 569 differ** (from 154), and the load-time run
reads **0** overlaps.  Spec: `test/modules/label-measure.mjs` — the
measurer, the store's exact box, a force run holding measured boxes
apart, and the control in the defect's own shape (laid out on
estimates, then the frame's own `setLabelDims` with the real widths:
overlaps).  The fix is store-side, so every layout under
`nodeDimensionsIncludeLabels`, every `fit()` and every
`boundingBox()` before the first frame reads the laid box now — the
flow and breadthfirst sub-rounds' label-inclusive rows inherit it.

**(b) `avoidOverlap` broke the tidy shapes — every diamond, and with
labels every triangle.**  Probed on em-web (20 pairs, 9 triangles, 4
diamonds among its components), shapes intact after a run:

| avoidOverlap | bodies: pairs / triangles / diamonds | labels: pairs / triangles / diamonds |
| --- | --- | --- |
| `false` | 20/20, 9/9, 4/4 | 20/20, 9/9, 4/4 |
| `'settle'` (default), before | 20/20, 9/9, **0/4** | **18/20, 0/9, 1/4** |
| `'sim'`, before | 20/20, 9/9, 4/4 | 20/20, 9/9, 4/4 |
| `'both'`, before | 20/20, 9/9, **0/4** | **19/20, 0/9, 1/4** |
| every mode, after | 20/20, 9/9, 4/4 | 20/20, 9/9, 4/4 |

Two causes.  Round 120 sized each shape so its *neighbours* along the
shape's sides stood a body apart; the separation pass that follows
clears axis-aligned boxes on either axis, which a diamond's top and
right — a body width apart along the diagonal — are not, so the pass
pushed them and the diamond became the plus and the kite the first
sitting saw.  And the pass's sweeps ran across components: at the
settle, before the re-pack, a shape's new footprint could intrude on a
foreign node, and the sweep pushed the shape's node rather than leave
the pair to the re-pack that places components apart anyway (the
stress rounds and the expansion already skipped foreign pairs; the
sweeps did not).  Fixes, `src/layout/pack.mts` and
`src/layout/force.mts`: the radius is now the largest over every pair
of the shape's points of `separationAlong` — the pass's own rule — plus
the gap and its half-pixel, so the pass finds the shape clear (the
settle's dims already carry the padding, so force passes 0 gap there;
the old radius double-counted it); and `separateBodies` takes
`withinComponents`, true when the re-pack follows, under which the
sweeps and the best-state guard's depth leave foreign pairs alone.
Round 120's own specs hold (the 30 px-body diamond on 60 px edges is
unchanged; the star spec's 80 px bodies read the half-pixel).  New
specs: `test/modules/pack-tidy.mjs` — the diamond stands after
`separateBodies`, with the control (sized for its edges alone, the
pass breaks it); the within-components rule with its control — and
the public case in `test/force-layout.mjs`, 40 px bodies on 20 px
edges, the diamond and the triangle stand and nothing overlaps.

**The baseline** (before → after; `overlaps` are body or label boxes
as marked, `gap` the median nearest-box gap in px and in node sizes,
`area` Mpx², `fill` the boxes' share of it):

| scene | run | ms | overlaps | area | fill | gap | edge gap median / p90 / max |
| --- | --- | --: | --: | --: | --: | --- | --- |
| em-web (569 / 6,899) | defaults | 266 → 264 | 0 | 4.84 → 4.81 | 0.19 | 10 px, 0.26× | 171 / 363 / 609 |
| em-web | `avoidOverlap: false` | 192 | 713 | 3.62 | 0.25 | 0 | 58 / 138 / 305 |
| em-web, labels | `settle` + labels | 358 → 339 | 0 | 7.24 → 6.67 | 0.22 → 0.24 | 10 px, 0.14× | 230 / 496 / 818 → 219 / 486 / 791 |
| em-web, labels | `sim` + labels | 1,182 | 0 | 7.37 | 0.22 | 10 px | 227 / 635 / 1,167 |
| white-matter (1,499 / 18,288) | defaults | 881 | 0 | **5.80** | **0.09** | 12 px, 0.64× | 219 / 495 / 1,597 |
| white-matter | `avoidOverlap: false` | 802 | 742 | 2.26 | 0.24 | 0 | 121 / 284 / 933 |
| ndex-large (3,238 / 68,641) | defaults | 2,676 | 0 | **20.83** | **0.08** | 10 px, 0.46× | 243 / 464 / 1,788 |
| ndex-large | `avoidOverlap: false` | 2,315 | 2,970 | 8.58 | 0.20 | 0 | 127 / 253 / 1,147 |
| compound, generated 200 × 400 | defaults | 54 | 0 | 1.55 | 0.02 | 30 px, 2.5× | 76 / 199 / 325 |

The em-web rows barely move (the shapes are a handful of nodes); the
label row's area drops 8 % because the tidy shapes no longer get
pushed about.  The `compound` generator is unseeded, so its `stable`
column is meaningless (noted, not fixed).  Seeds 1 / 2 / 3 on em-web:
area 4.81 / 4.61 / 4.78, gap median 10 px throughout, the same fill
to 1 % — stable in the sense the criteria ask.

**What the numbers say about the defaults** (measured, not changed —
the sitting's calls):

1. **The crammed expansion grows the large scenes 2.4–2.6×.**
   white-matter's area goes 2.26 → 5.80 Mpx² under the default
   `settle` (fill 0.24 → 0.09), ndex-large 8.58 → 20.83 (0.20 →
   0.08): 118.1's expansion stage (a component of ≥ 1,000 nodes with
   ≥ 60 % of its nodes overlapping is scaled about its centroid,
   capped 1.25× per round, up to 12 rounds) is doing what it was
   built to do, and the result reads airy — the median nearest gap is
   only 10–12 px but the *edge* gaps are 220–240 px on 19–23 px
   nodes.  `'sim'` on the same scenes lands at 3.11 Mpx² (fill 0.17)
   and 12.05 (0.14) — half the area — at 4× and 2.7× the time (3.7 s
   and 7.2 s headless).  Candidate: the expansion's per-round cap or
   its percentile (`EXPAND_CAP` 1.25, `EXPAND_PERCENTILE` 0.5) is
   where the growth comes from; a run of the settle with the
   expansion stage traced per round would show how much of the 2.5×
   is the expansion and how much the stress rounds after it.
   Recommendation: measure that trace in the sitting's presence
   before touching the constant; do not switch the default to `'sim'`
   for its picture — the time is the performance priority's.
2. **`avoidOverlapPadding` 10 → 4** on em-web: area 4.81 → 4.19
   (−13 %), fill 0.19 → 0.22, gap median 4 px; with labels 6.67 →
   5.86.  On white-matter 5.80 → 3.21 (−45 %, fill 0.17) — because
   the padding feeds the crammed test too.  Recommendation: keep 10
   for the small graphs (the picture at 4 px reads crowded on 40 px
   discs) and let item 1's measurement decide the large-scene growth
   rather than shrinking the padding to work around it.
3. **`edgeLength` 60** with 40 px em-web nodes gives an edge gap
   median of 168 px in the big cliques — three node widths of open
   edge between neighbours, which is the cliques' density more than
   the constant; the same constant on 19 px white-matter nodes reads
   airier (edge gap 219).  No recommendation from this sub-round; the
   live spacing slider on the page is the instrument for it.

**What changed on disk.**  `src/label-measure.mts` (new),
`src/store/graph-store.mts` (measure before estimate),
`src/layout/pack.mts` (the radius by `separationAlong`, imported from
`separation.mts`), `src/layout/separation.mts` (`sweep` takes
`compOf`; `ExtentsLike`), `src/layout/force.mts` (`withinComponents`;
the gap force passes tidy), `scripts/throw-coverage.mjs` (one site
re-keyed), `benchmark/layout-audit.mjs` (the crossing counter without
its pair set — it threw on white-matter), `src/README.md` (the label
dims deviation; the tidy paragraph), the three spec files, and the
pictures.  Gates: `verify`, `test/layout-quality.mjs`,
`test/force-layout.mjs`, `test:node:quiet` green.

**Not reproduced as stated, and worth saying so:** on a page that has
drawn a frame, label-inclusive `avoidOverlap` on force was never
broken in any mode; if the maintainer saw it there rather than at
load, the sitting needs the exact network, sheet and checkboxes.

**Maintainer review: pending.**  The sitting should open em-web with
labels on, and look at: (1) the small components' rows — every
four-node component a diamond, every three a triangle
(`em-web-force-after-fit.png` against `em-web-force-before-fit.png`,
where the diamonds are pluses and kites); (2) the same with Avoid
overlap + labels on (`em-web-force-labels-after-fit.png` /
`-close.png`); (3) `?network=em-web&layout=force&avoidOverlap=true&overlapLabels=true&labels=true`
— the load-time run, which is where the label finding lived — and
count nothing overlapping at zoom 2; (4) reactome under force with
labels (`reactome-force-labels-before-close.png` — unchanged by the
fixes, the picture to judge the label spacing itself on); and decide
the three default questions above, item 1 first.

**Maintainer sitting, 2026-09-15 (first pass, from the desk).**  **Deferred.**  Requires more maintainer review before a decision; the two fixes stay as landed code, the expansion recommendation is undecided, and the sub-round is not signed off.

### 125.2 — flow

The first sitting's three findings on `flow` — too spread on reactome
even with `avoidOverlap` off and far worse with labels, the Greek-gods
scene wrong only with labels, and a leaf far from its only neighbour —
came apart into three wrong readings, one placement the block-graph
compaction had given up, and one question of defaults that stays with
the sitting.

#### What was found

- **The page's "avoid overlap off" is `avoidOverlap: false`, which
  places points.**  Flow then reads `nodeSep` centre to centre: a 50 px
  pitch for 18 px bodies, a 32 px gap — 1.78 node sizes.  The
  library's own default (bodies separated) is a 50 px *gap*, 2.78
  sizes.  Neither is a defect; both are the default question below.
- **Symmetric halves.**  `assignX` separated a rank by `halfW =
  max(-x1, x2)` and `assignY` stacked rows by `halfH` likewise, so a
  label hung to one side was read as twice its larger side.  The
  Greek-gods labels (hung right, 76 px box) read as 140 px; reactome's
  bottom-hung wrapped labels doubled the rows: 148 px apart where 116
  fit.
- **The model axes whatever the direction.**  The within-rank axis
  always took the model *width* and the rank axis the model *height*.
  Under `direction: 'rightward'` a rank is a column, so its members
  were separated by their widths — invisible on 12 px discs, and the
  whole of the "only with labels" finding: with labels the scene went
  to aspect 0.3, a column 3.4 Mpx² tall.  The compound walls and rank
  margins had the same swap (`padX` along a rightward rank).
- **The free singleton.**  Compaction is a longest-path pass over the
  block graph; a block nothing aligned — a leaf in the two sweeps that
  align to lower neighbours, or a node whose median parent was taken
  by a sibling or marked by a type-1 conflict — sat at its leftmost
  feasible x (rightmost, mirrored).  The balance of four such
  candidates put reactome's "IRAK1 recruits IKK complex upon TLR7/8
  or 9 stimulation" (R-HSA-975144, one parent, no children) at
  candidates [5238, 7346, 4694, 7346] → 6292, **1,632 px** from its
  parent at 4660.  The header of `flow-position.mts` had recorded
  giving this up ("what is given up is only the original's placement
  of totally unconstrained classes, which the four-way balance step
  reintroduces") — the balance does not reintroduce it; it averages
  two packings.
- **The two-parent IRAK1** (R-HSA-937039, parents at 3775 and 4014,
  placed at 2891) is order-bound, not a placement defect: the rank
  order puts it left of two six-parent nodes whose parents' median is
  further left, so no candidate can carry it under its parents without
  a crossing the ordering did not choose.  Unchanged, and recorded as
  such.

#### What changed on disk

- `src/layout/flow-graph.mts`: the scope and component carry
  `left / right / top / bottom` on the canonical axes
  (`CanonicalExtents`) in place of `halfW / halfH`.
- `src/layout/flow.mts`: `canonicalExtents(ext, direction)` maps the
  four model sides by direction (rightward: canonical x = model y);
  the walls take the padding of the axis they are on
  (`padAcross` / `padAlong`); the packer and the boundingBox fit read
  the real model extents (`state.ext`) rather than symmetric halves.
- `src/layout/flow-position.mts`: `assignX(L, left, opts, right)`
  separates by `right(u) + left(v) + gap` (mirrored runs swap the
  sides) and reads the min-width balance from the same sides;
  `assignY(L, top, rankSep, margins, bottom)` builds a row from its
  tallest top and deepest bottom; `compact` ends with `placeFree` —
  each real singleton block moves, within the slack its rank
  neighbours leave, to the median x of its neighbours on the sweep's
  side (the other side when it has none), right to left within a rank
  so every bound is a placed position.  `flow-compound.mts`'s
  `rankPadMargins` takes the pad array.
- `test/layout-flow.mjs`, "extents and placement (125.2)": a
  right-hung label's boxes sit `nodeSep` apart; an under-hung label's
  rows sit `rankSep` apart; a rightward rank of 60 × 10 nodes is
  separated by heights (with the downward control); the leaf on a
  12-node DAG a seeded search found (n5 under n0: 220 px before, one
  pitch after), with the separation control.  Against the pre-fix
  code the first three read 371, 47 and 100 px where 50, 24 and 50 are
  asserted; the first hand-built leaf fixture did *not* go red — the
  drift needs a sibling that takes the parent in one sweep and a
  crossing that blocks the other — which is why the fixture is a
  found one.  `test/modules/layout-flow-internals.mjs`'s fixtures
  carry the four extents.
- `src/public-types.mts` (`nodeSep`, `rankSep`, `avoidOverlap` docs),
  `src/README.md`'s flow section.

#### Before and after (headless, the page's sheets; `benchmark:layout-audit`)

| network | run | area Mpx² | aspect | gap med px (× size) | edge gap med / p90 / max | parent gap med / p90 / max |
| --- | --- | --: | --: | --: | --: | --: |
| reactome | defaults, before | 5.72 | 9.7 | 50 (2.78) | 110 / 1169 / 3281 | 106 / 909 / 3281 |
| reactome | defaults, after | 5.72 | 9.7 | 50 (2.78) | 84 / 1047 / 3281 | 60 / 798 / 3281 |
| reactome | avoidOverlap false, before | 3.33 | 9.0 | 32 (1.78) | 82 / 855 / 2408 | 76 / 664 / 2408 |
| reactome | avoidOverlap false, after | 3.33 | 9.0 | 32 (1.78) | 57 / 765 / 2408 | 42 / 582 / 2408 |
| reactome | labels, before | 21.68 | 11.2 | 50 (0.53) | 173 / 2444 / 6902 | 164 / 1896 / 6902 |
| reactome | labels, after | 16.95 | 14.3 | 50 (0.53) | 118 / 2160 / 6902 | 84 / 1643 / 6902 |
| greek-gods rightward | defaults, before | 0.90 | 0.5 | 50 (4.17) | 112 / 546 / 1042 | 60 / 419 / 918 |
| greek-gods rightward | defaults, after | 0.90 | 0.5 | 50 (4.17) | 112 / 546 / 825 | 60 / 354 / 670 |
| greek-gods rightward | labels, before | 3.42 | 0.3 | 24 (0.49) | 282 / 1284 / 2458 | 53 / 1001 / 2142 |
| greek-gods rightward | labels, after | 1.62 | 0.9 | 50 (1.03) | 112 / 546 / 825 | 87 / 354 / 670 |
| npm-deps | defaults, before | 42.11 | 9.1 | 50 (2.78) | 1992 / 6398 / 14863 | 1616 / 6667 / 10038 |
| npm-deps | defaults, after | 42.11 | 9.1 | 50 (2.78) | 1771 / 5613 / 10656 | 1324 / 5953 / 10038 |
| npm-deps | labels, before | 83.72 | 9.8 | 50 (0.61) | 3143 / 10038 / 22260 | 2588 / 10359 / 14520 |
| npm-deps | labels, after | 73.51 | 11.1 | 50 (0.61) | 2883 / 9016 / 15252 | 2108 / 9433 / 14520 |
| workflow-dag | defaults, before | 2.56 | 3.2 | 50 (2.78) | 256 / 905 / 2724 | 113 / 375 / 2045 |
| workflow-dag | defaults, after | 2.59 | 3.2 | 50 (2.78) | 256 / 900 / 2724 | 118 / 375 / 2045 |
| workflow-dag | labels, before | 3.44 | 2.5 | 51 (1.54) | 271 / 923 / 2769 | 125 / 380 / 2088 |
| workflow-dag | labels, after | 3.07 | 2.8 | 50 (1.52) | 271 / 916 / 2769 | 118 / 381 / 2089 |

Crossings and overlaps are unchanged on every row (reactome 67,
greek-gods 117, npm-deps 6090 ± 3, workflow-dag 759–762; overlaps 0).
Runtime: reactome 14–18 ms, npm-deps ~57 ms, workflow-dag ~18 ms on
the headless CPU path, unchanged within noise.  The parent-gap
*maxima* that remain (reactome 3281, "Innate Immune System" under
"Immune System") are a parent centred over sixteen children — the
shape of the data, not a placement.

The DAG harness (`benchmark:layout-quality`, straight-line geometry):

| fixture | flow before | flow after | dagre | elk |
| --- | --- | --- | --- | --- |
| deps | 4189 cross, len 1067, 21.0 Mpx², 26 ms | 4192, 1063, 21.0, 26 ms | 4279, 1934, 33.3, 384 ms | 3382, 1964, 94.4, 336 ms |
| workflow-1k | 19589, 4557, 174.3, 118 ms | 19550, 4449, 173.9, 107 ms | 20570, 6224, 103.4, 11.2 s | 21825, 4945, 554.9, 1.7 s |
| reactome | 67, 464, 7.79, 10 ms | 67, 425, 7.79, 12 ms | 73, 407, 6.75, 78 ms | 54, 497, 9.44, 106 ms |
| greek-gods | 117, 382, 1.33, 6 ms | 117, 348, 1.33, 5 ms | 126, 396, 1.35, 21 ms | 120, 470, 1.66, 51 ms |

The placement pass leaves the rank order alone, so crossings hold
and the mean edge length falls on every fixture; workflow-1k's one
tracked run overlap (124) is 0 after.

#### The pictures (`plan/pictures/rnd0125/125.2/`)

`reactome-flow-labels-close-{before,after}.png` (zoom 1, the labels
readable): rows 148 → 116 px apart, the within-rank pitch 146 px in
both.  `reactome-flow-labels-fit-*`: the whole picture, 21.7 → 17.0
Mpx².  `reactome-flow-defaults-close-*`: the placement pass at
defaults (edge gap median 82 → 57 on the page's `avoidOverlap: false`
run).  `greek-gods-rightward-labels-fit-{before,after}.png`: the
column of 0.3 aspect against the picture the reference SVG draws —
after, the columns are label-width apart and the rows one label
height, which is the reference's shape (`greek-gods-reference.svg`
draws 10 px text on rows ~16 px apart with columns set by the longest
name; the after picture's rows are 12 px discs at a 50 px gap, the
default question again).  `greek-gods-rightward-defaults-fit-after.png`
for the sitting's comparison without labels.

#### Defaults: measured, not changed

`nodeSep` 50 / `rankSep` 60 against 18 px bodies is the spread the
sitting saw with `avoidOverlap` on.  A sweep over nodeSep ∈ {20, 30,
40, 50} × rankSep ∈ {30, 40, 60}, with and without labels, on
reactome, npm-deps, workflow-dag and greek-gods (rightward):

- **`nodeSep` sets the area almost linearly**: reactome without
  labels 2.33 / 2.94 / 3.55 / 4.16 Mpx² at rankSep 30 for 20 / 30 /
  40 / 50; the median gap is exactly nodeSep in every row.
- **`rankSep` below the track floor does nothing**: the gap below a
  rank is `max(rankSep, tracks × 10 + 20)`, so 30 and 40 read the
  same on workflow-dag (every gap has tracks) and differ on reactome
  only where a gap has one fan-out.  60 costs 15–20 % of area over 40.
- **With labels the label boxes sit `nodeSep` apart** — 50 px between
  95 px label columns on reactome — and the area at nodeSep 20 is
  13.4 vs 17.0 Mpx² (−21 %); a smaller gap between *label* boxes than
  between bodies is the lever if the sitting wants the label case
  tighter without touching the body case.

Recommendation for the sitting: **`nodeSep` 30, `rankSep` 40** —
reactome 3.20 Mpx² (−44 % against today's 5.72), gap 1.67 node sizes,
crossings unchanged by construction; dagre's own defaults are 50/50
for 30–60 px boxes, i.e. roughly one body's width of gap, which 30
is for 18 px bodies and a label-column is not.  A label-aware gap
(`nodeSep` for bodies, a smaller `labelSep` or a fraction for label
boxes) is a second, independent call.  Neither is changed in code.

#### Noted, out of scope

The page's Apply runs `flow` downward whatever the network's load
layout says (`greek-gods` loads rightward): `layoutOptions` does not
read `def.layout`.  The rightward-with-labels pictures here were taken
through `cy.layout()` directly.  `elkjs` is `--engine elk` on the DAG
harness.

**Maintainer review: pending.**  What the sitting should look at: the
four `reactome-flow-labels-*` pictures side by side (the rows), the
two `greek-gods-rightward-labels-*` against `greek-gods-reference.svg`
(the shape), the `defaults-close` pair for the leaves now beside their
siblings; then the two calls — `nodeSep` 30 / `rankSep` 40 as the
defaults, and whether label boxes get a smaller gap than bodies —
with the sweep's table above.

**Maintainer sitting, 2026-09-15 (first pass, from the desk).**  **Deferred** until the page sitting, which needs 125.11's option controls first.  Direction given: the gaps might become automatic defaults derived from node size (a 1× separation by default), or simply smaller values for `nodeSep` / `rankSep`.  The three fixes stay as landed code.

**Raised by the other sub-rounds, for this one's sitting.**  125.4
measured npm-deps under flow at 3–6× breadthfirst's straight-line
crossings and 13× its area — the compound mode (11 scope parents)
holding each scope's members contiguous per rank at the price of the
crossings between scopes; whether that trade is right for a
dependency DAG is a call on the compound mode's picture.  And the
page's Apply runs flow downward whatever the network's load-layout
direction (`layoutOptions` ignores `def.layout`), so the Greek-gods
scene re-applied from the panel is not the reference picture; the
page should carry the direction — a 125.10 follow-up.

### 125.3 — radial

**Fixtures.**  Reactome as a tree (227 nodes, 245 edges, one true
root, ten multi-parent joins); the quality suite's unbalanced tree
(a 2-leaf and an 8-leaf branch); em-web's components under
`packComponents` (569 nodes, a 187-node giant and a shelf of small
ones).  The page's production sheet, so the label boxes are the
page's (reactome's wrapped 110 px labels: a 95 px box).

**Baseline** (`benchmark:layout-audit`, headless 1400 × 1000, commit
9339dfbc):

| run | ms | crossings | area Mpx² | gap median / p90 | ratio | edge gap median / p90 / max | parent gap max (node) |
| --- | --: | --: | --: | --- | --: | --- | --- |
| reactome, defaults | 9 | 140 | 4.74 | 20 / 29 | 1.10 | 73 / 589 / 1561 | 1561 (R-HSA-448424) |
| reactome, labels | 10 | 139 | 44.14 | 54 / 107 | 0.56 | 195 / 1886 / 4637 | 4637 (R-HSA-448424) |
| reactome, `roots: [Immune System]` | 7 | 274 | 4.26 | 20 / 39 | 1.09 | 87 / 708 / 1800 | 1743 (R-HSA-975138) |
| reactome, `condense: true` | 8 | 140 | 4.74 | 20 / 29 | 1.10 | 73 / 589 / 1561 | 1561 |
| em-web, packed | 112 | 3.81 M | 31.19 | 25 / 50 | 0.61 | 1439 / 3311 / 3746 | 3076 |
| em-web, packed, labels | 106 | 3.81 M | 58.29 | 34 / 54 | 0.46 | 1975 / 4514 / 5110 | 4227 |

Stable across re-runs on every row.

**What the pictures show** (`plan/pictures/rnd0125/125.3/`).
`reactome-radial-9339dfbc.png`: the centre is not the root.  Radial
infers its roots by maximum degree — breadthfirst's undirected rule,
copied in 85.1 — so on a directed hierarchy the centre goes to
*Innate Immune System* (degree 17) and *Immune System*, the one true
root, sits on ring 1 to its left, its blue edges the only ones that
run inward.  The tree is then a different tree: BFS from the wrong
node makes the root a child, and the depth-2 nodes under it fan out
from the far side.  `reactome-radial-true-root-9339dfbc.png` is the
same graph with `roots` given: the root at the centre, the hierarchy
reading outward — at the price of 274 crossings against 140, because
the true tree is deeper (six rings against four) and the outer rings
are set by the most crowded one's circumference.  Both pictures share
the second thing to see: **a rim around an empty middle.**  Every ring
layout's outer ring takes the radius its most crowded ring needs, and
reactome's leaves (150 of 227 nodes) all sit on the last ring, so the
ring is 1,500 px across and the inner rings — a handful of nodes each
— float in the middle with their edges running the whole radius
(edge gap p90 589 px, the parent gap max the same node).  The
label-inclusive picture (`reactome-radial-labels-close-9339dfbc.png`)
is the same shape at three times the radius: the 95 px label boxes
set the chord.

**`condense`** (125.3 / 125.5, one option designed once): grid's
spelling adopted on radial — `condense: true` sizes every ring by its
nodes and `avoidOverlapPadding`, the box only centres, `levelSpacing`
stays the floor.  Off by default.  Measured on reactome it changes
nothing (the table's row: the clearance rule already set the rings
past the box's share); on the unbalanced tree in a 600 px box the
first ring goes from 100 px to 40 px.  The spec pins both.

**What changed on disk.**  `condense` on `radial` (and `circle`),
its JSDoc, the README's geometric-layouts entry, the changelog; two
specs in `test/layout-radial.mjs` (the condensed rings against the
boxed control, every pair at the padding; `levelSpacing` as the
floor).  No default changed.

**For the sitting — recommendations, not changes.**
1. **Root inference on a directed component.**  Infer `roots` as the
   nodes with no incoming edge when a component has any (v3's
   breadthfirst rule under `directed: true`), falling back to maximum
   degree; the picture reads as a hierarchy, at 274 crossings against
   140 on reactome.  A `directed` option (breadthfirst's) is the
   alternative spelling that keeps today's default.
2. **The rim.**  The outer ring's radius is set by the most crowded
   ring; a shallow wide tree draws as a rim around an empty middle.
   Nothing in the option surface reaches it: the fix is either to let
   the outer ring's leaves stagger onto two radii (a leaf ring drawn
   as a band, the way the reference tidy trees do), or to accept that
   a wide shallow tree is `breadthfirst`'s or `flow`'s picture, not
   radial's, and say so in the docs.  The sitting decides whether the
   band is worth a sub-round.
3. `condense` as the default is the third call; the app graphs are
   unaffected either way.
4. Raised by 125.9 while packing em-web: radial draws the 187-node
   component as one 3,883 × 4,020 px ring — the rim finding (2) at
   its worst, since a dense component has one root and every other
   node on ring 1 or 2.  A component that is not a tree is not
   radial's picture; whether the layout should say so (fall back to
   `concentric`, or warn) is the same call as 2.

**Maintainer review: pending.**  Open the page on reactome, Radial,
Avoid overlap on; then set `roots` in the console
(`cy.layout({name:'radial', roots:['R-HSA-168256']}).run()`); then
labels on.  Pictures: the three under `plan/pictures/rnd0125/125.3/`.
Decide 1–3 above.

**Maintainer sitting, 2026-09-15 (first pass, from the desk).**  **Decided on the roots**: radial is designed for hierarchies, so a component's default roots are its true roots — the nodes with no incoming edge — with a fallback where a component has none (a cycle): the maximum-degree rule stays as that fallback.  Shipped in this round (the sitting also ruled that an accepted default ships as accepted): reactome's centre is its root, 274 crossings against 140 as measured above, area 4.26 Mpx²; em-web's packed radial goes from 31.19 to 23.98 Mpx² and 3.81 M to 3.80 M crossings (many of its components have indegree-0 nodes, which now seed the trees).  `reactome-radial-true-root-default-after.png` is the default picture now.  The rim (2), `condense` as the default (3) and the non-tree component (4): not ruled on, deferred to the page.

### 125.4 — breadthfirst

The first sitting's finding: too airy on reactome even without
`avoidOverlap`.  Measured on the page and headless at the same
options, it was two pictures, not one:

| reactome, `avoidOverlap: false`, spacingFactor 1.75 | gap median | in node sizes | area |
| --- | --: | --: | --: |
| the page (after the fitted `flow` load, zoom 0.11) | 269 px | 14.96 | — |
| headless (zoom 1) | 30 px | 1.68 | 2.86 Mpx² |

**Cause 1 — the drawing scaled with 1 / zoom.**  v3's breadthfirst
spreads its rows and ranks over `cy.extent()`, the viewport in *model*
coordinates, and v4 kept that line (round 42's port); grid, circle,
concentric and radial read the viewport in pixels.  So the box
breadthfirst fills is the viewport divided by the zoom at the moment
Apply is clicked — after a fitted `flow` run the page sits at zoom
0.11, and the same tree came out nine times airier than headless, the
nodes reduced to dots (`reactome-breadthfirst-page-off-fit.png`).
Fixed: the pixel viewport, as the other four.  At zoom 1 nothing
changes, which is why the headless suites never saw it.  The spec lays
the tree out at zoom 0.1 and at zoom 1 with `fit: false` and asserts
the same positions; the control (the extent read back in) is a tenfold
span.  After: page gap median 17 px (0.97 node sizes),
`reactome-breadthfirst-page-off-fit-after.png`.

**Cause 2 — a compound parent as a root: NaN for the whole drawing.**
The audit script's npm-deps row read `stable false` and every column
NaN under the undirected default (directed and `packComponents` were
fine).  v3's undirected root inference takes the maximal-degree node of
every component; an edgeless compound parent (npm-deps' eleven scope
parents) is its own component of degree 0, so it became a root, the
walk placed it in a depth, and every node's dimensions were then read
through an index the parent was never in — NaN everywhere.  Bisected
to one parent with two children plus a singleton (a, b and s1 NaN).
Fixed: roots are inferred over the placed (childless) nodes and the
walk skips a parent it reaches; the spec is that four-node graph.
After: npm-deps 1055 crossings, gap 1.04 node sizes, stable.

**What is v3's design, not a defect, and the sitting's call.**  With
one component the drawing is the box-fill: every rank is spread over
the full width whatever its count (reactome's four-node rank at a
463 px pitch, its 53-node rank at 43), the rows over the full height
(179 px for 18 px nodes), floored by the overlap need, then
`spacingFactor` 1.75 over all of it.  The `packComponents` path
(`'compact'` sizing) spaces by the need alone — 32 px pitch and row
step at 1.75, bodies touching at 1 — which is the other extreme.
Neither is the flow rule (need plus a gap).  Measured candidates on
reactome, headless:

| reactome | crossings | area Mpx² | aspect | fill | gap (sizes) | edge gap median | parent gap max |
| --- | --: | --: | --: | --: | --: | --: | --: |
| default (box-fill, sf 1.75) | 71 | 2.86 | 1.8 | 0.026 | 1.68 | 341 | 1739 |
| sf 1 | 71 | 0.95 | 1.8 | 0.077 | 0.53 | 187 | 986 |
| directed | 97 | 3.35 | 2.1 | 0.022 | 0.84 | 220 | 599 |
| compact (packComponents), sf 1.75 | 71 | 0.39 | 6.9 | 0.186 | 0.75 | 234 | 1274 |
| compact, sf 1, padding 8 | 71 | 0.27 | 6.8 | 0.268 | 0.44 | 190 | 1048 |
| compact, sf 1, padding 12 | 71 | 0.36 | 6.9 | 0.204 | 0.67 | 222 | 1212 |
| compact, sf 1, padding 12, directed | 97 | 0.57 | 11.0 | 0.129 | 0.67 | 267 | 777 |
| labels, default | 71 | 13.23 | 7.5 | 0.065 | 0.95 | 1447 | 7670 |
| labels, compact, sf 1, padding 12 | 71 | 5.51 | 7.3 | 0.156 | 0.23 | 893 | 4836 |

Recommendation for the sitting: for a single component, space by the
need plus an explicit gap (the flow rule; the round file's
node-separation option, designed in whichever of 125.3/5/6/7 runs
first) rather than the box-fill, and keep the box-fill only under an
explicit `boundingBox`, since "fill the viewport" is what `fit` does
anyway.  The default `spacingFactor` 1.75 is v3's and was kept in 115.6;
under a need-plus-gap rule it would multiply a gap, not a box, and 1
with a 12 px gap reads as the tightest legible row above.  Not changed
in code.

**The undirected root inference is v3's, and reads oddly on a tree.**
The maximal-degree node of a component is the root; on a 1 + 4 + 16
tree the four middle nodes have degree 5 against the root's 4, so all
four are roots and the tree draws in two rows from the middle.  v3
parity; the sitting may want `directed: true` to be the page's default
for a DAG scene, or a root inference by in-degree when the edges are
directed.  Not changed.

**Breadthfirst directed against flow, the same DAG.**

| fixture | layout | crossings (straight) | area Mpx² | gap (sizes) | parent gap max | ms |
| --- | --- | --: | --: | --: | --: | --: |
| reactome | breadthfirst, directed | 97 | 3.35 | 0.84 | 599 | 10 |
| reactome | breadthfirst, undirected | 71 | 2.86 | 1.68 | 1739 | 11 |
| reactome | flow | 67 | 5.72 | 2.78 | 3281 | 15 |
| reactome | dagre (112.1 harness) | 73 | 6.75 | — | — | 73 |
| npm-deps | breadthfirst, directed | 2166 | 3.31 | 0.76 | 1754 | 21 |
| npm-deps | breadthfirst, undirected (after the fix) | 1055 | 3.37 | 1.04 | 1833 | 30 |
| npm-deps | flow | 6090 | 42.11 | 2.78 | 10038 | 59 |
| deps (harness, 30 px boxes) | flow | 4189 | 21.04 | — | — | 24 |
| deps (harness) | dagre | 4279 | 33.32 | — | — | 376 |

On reactome the two are close on crossings (67 against 71–97) and
breadthfirst's picture is half the area; on npm-deps flow's straight
lines cross three to six times as often as breadthfirst's rows do and
the drawing is thirteen times the area — the compound scope parents put
flow in its compound mode (npm-deps in the audit script is the page's
fixture with parents; the harness's `deps` has none and reads 4189,
level with dagre's 4279).  Breadthfirst's directed picture is not a
worse flow: it is the cheaper, squarer drawing with more long edges
(parent gap max) and no crossing minimisation.  The documentation
should keep pointing at `flow` for a DAG whose edges must be followed
(the corridors, the tracks, the rank compaction), and at `breadthfirst`
for a tree or a DAG read as levels — which is what the portfolio table
already says.  The npm-deps flow row belongs to 125.2's sitting.

**`circle: true` beside radial and concentric**, on the quality suite's
balanced tree (1 + 3 + 9 + 27, 30 px nodes) and on reactome:

| fixture | layout | crossings | area Mpx² | fill | gap (sizes) | edge gap median |
| --- | --- | --: | --: | --: | --: | --: |
| tree | breadthfirst `circle: true` | 18 | 3.17 | 0.011 | 4.53 | 444 |
| tree | radial | 3 | 0.48 | 0.075 | 1.12 | 129 |
| tree | concentric | 35 | 0.25 | 0.143 | 0.55 | 118 |
| tree | breadthfirst rows | 6 | 1.21 | 0.030 | 1.64 | 501 |
| reactome | breadthfirst `circle: true` | 2557 | 3.95 | 0.019 | 2.34 | 290 |
| reactome | radial | 140 | 4.74 | 0.016 | 1.10 | 73 |
| reactome | concentric | 5076 | 4.58 | 0.016 | 0.97 | 802 |

Verdict: `circle: true` is the worst of the three on every column
that matters — six times radial's crossings on the tree, eighteen
times on reactome, and the airiest drawing (4.53 node sizes) because
each ring is the box's radius step, not the ring's need.  It earns its
place only as v3 parity; the documentation should point at `radial`
for a tree drawn in rings and at `concentric` for rings by a score.
Whether to keep the flag or deprecate it is the sitting's call; not
changed.

**The forest and 123's blocks**, on a three-tree forest (21 + 7 + 7)
with three pairs and twenty singletons, headless: bands A / B / C side
by side, the pairs and the singleton block on a second shelf below
(rows 3), singleton cell pitch 68 px at 1.75 and 39 at 1, the block 20
wide in one row; under `packComponents` the singletons wrap into four
rows of five at a 105 px pitch.  Nothing wrong found.  Note for 125.9:
the singleton cells take the *root row's* box spread as their pitch
(`distanceX[0]`), so a forest with few roots gives the block wide
cells; under the need-plus-gap rule above that goes away.

**What changed on disk.**  `src/layout/breadthfirst.mts`: the pixel
viewport as the default box; roots inferred over placed nodes; the
walk skips parents.  `src/public-types.mts`: the interface's doc.
`src/README.md`: a deviations entry.  `test/layouts.mjs`: the two
specs.  `benchmark/layout-audit.mjs`: `--elements <file>` for the
suites' synthetic fixtures.  Pictures under
`plan/pictures/rnd0125/125.4/`: reactome before (fit, close-up) and
after (fit, close-up), the compact candidate, npm-deps after, flow on
the same graph.  Gates: `verify`, `test/layout-quality.mjs` (210
green, the "not too airy" rows included), `test/layouts.mjs` (36),
`test:node:quiet` green.

**Maintainer review: pending.**  The sitting should open reactome on
the page, run `flow` first (so the zoom is where it was in the first
sitting), then `breadthfirst` with avoidOverlap off, and compare with
`reactome-breadthfirst-page-off-fit.png` (before) and
`-after.png`; then npm-deps under breadthfirst (finite now; the
scope parents are not roots).  Three calls to make: (1) whether a
single component keeps v3's box-fill or takes need-plus-gap spacing
(the compact rows in the first table are the candidates, at padding 8
and 12); (2) whether `circle: true` stays, given the ring table; (3)
whether the page's DAG scenes should default breadthfirst to
`directed: true`.  The label case (`labels, default` row: a 7.5:1
drawing, parent gap max 7670) is the same 84-labels-in-a-rank problem
as flow's and belongs with 125.2's label-gap call.

**Maintainer sitting, 2026-09-15 (first pass, from the desk).**  **Deferred**, with the root issue named: the dilemma between compacting (`condense: true`) and the bounding box.  In v3 the box was a constraint — the result must lie inside it unless another option conflicts.  For v4 the default might instead read the box as a *hint* of the available space, which helps a layout work better by default, with a new explicit option (`constrainWithinBounds: true`, or a spelling like it) saying when and how the box binds.  A cross-layout design call, not breadthfirst's alone — taken into **item 61**.  The two fixes stay as landed code.

### 125.5 — circle

**Fixtures.**  A 40-node clustered graph (four clusters of ten, half
the pairs inside a cluster joined, twelve cross-cluster edges,
insertion order shuffled) with and without a `sort` mapping by
cluster; a ring of twelve labelled nodes at three label widths (10,
40 and 80 characters, 30 px bodies); em-web's components under
`packComponents` (the giant component as one ring).

**Baseline** (commit 9339dfbc):

| run | crossings | gap median | ratio | note |
| --- | --: | --: | --: | --- |
| clustered, no sort | 1,375 | 36 | 1.18 | insertion order |
| clustered, `sort: { data: 'cluster' }` | 318 | 36 | 1.18 | the attribute-grouped ring |
| 12 labels × 10 chars, default | — | 101 | — | radius 414 px (the box's) |
| 12 labels × 10 chars, `condense` | — | 15 | — | radius 193 px |
| 12 labels × 40 chars, either | — | 62 | — | radius 448: the 346 px label boxes set the chord |
| 12 labels × 80 chars, either | — | 125 | — | radius 701 |
| em-web packed | 6.06 M | 21 | 0.53 | 63 ms; area 32.1 Mpx² |
| em-web packed, labels | 6.06 M | 34 | 0.46 | 64 ms; area 81.7 Mpx² |

**What the pictures show** (`plan/pictures/rnd0125/125.5/em-web-circle-pack-9339dfbc.png`).
The giant component is a 187-node ring of 6,899 chords — a disc of
grey, which is what a circle of a dense component is and not a
defect; the ring itself is even and its `sort`-by-NES order would put
the reds together (not run here).  The second row is the shelf
packer's row-height waste the first sitting named (125.9): a 60-node
ring beside 5-node rings, the row as tall as the big one.  The
singleton rows at the bottom are right.

**Findings.**
- **The ring fills the box by default** — a six-node ring on a 600 px
  viewport is a 270 px ring — and only `radius` or `avoidOverlap`'s
  growth changed that.  `condense: true` (designed with 125.3) makes
  the ring the tangential radius at `avoidOverlapPadding`: 193 px for
  twelve short labels against 414.  Where the labels are wide the
  chord rule already sets the radius and condense is the same picture.
- **The attribute-grouped order works**: the `sort` mapping cuts
  crossings 4.3× on the clustered graph.  A crossing-minimised order
  (AVSDF, declined by 122) would cut further; the sitting decides
  whether the picture asks.
- `startAngle` (3π/2, the top), `sweep` (a full circle less one gap)
  and `clockwise` read as v3's; nothing to change.

**What changed on disk.**  `condense` on `circle` (with 125.3), a
spec in `test/layouts.mjs` (the condensed radius under 100 px against
the boxed control's 270, every pair at the padding, a smaller padding
a smaller ring); README and changelog entries shared with 125.3.  No
default changed.

**For the sitting.**  Whether `condense` should be circle's default
(the ring by its nodes, the viewport by `fit`) — the v3 picture fills
the box, and every ring the apps draw is a packed component whose box
is its own, so the apps would not change.  Whether an AVSDF order is
worth a sub-round now that the clustered fixture measures it.

**Maintainer review: pending.**  Open the page on em-web, Circle,
Pack components on; the picture above.  Decide the two calls.

**Maintainer sitting, 2026-09-15 (first pass, from the desk).**  `condense` as a default: **deferred** — the geometric layouts need one consistent rule (item 61).  AVSDF, the crossing-minimised ring order round 122 declined: **reconsider it** — logged as **item 62**.

### 125.6 — concentric

**Fixtures.**  em-web with `concentric` mapped to degree (the default)
under `packComponents`, with and without labels; a synthetic graph
with one heavy level (a hub, six mid nodes, sixty leaves — the leaf
ring holds 60 of 67 nodes).

**Baseline** (commit 9339dfbc):

| run | ms | gap median / p90 | ratio | area Mpx² | note |
| --- | --: | --- | --: | --: | --- |
| em-web packed | 68 | 22 / 50 | 0.55 | 13.61 | crossings 5.5 M; fill 0.067 |
| em-web packed, labels | 73 | 35 / 60 | 0.48 | 26.39 | fill 0.061 |
| heavy leaf level | — | 20 / 26 | 0.68 | — | r(mid) 46, r(leaf) 540; no overlap |
| heavy leaf level, `equidistant` | — | 75 / 87 | 2.50 | — | r(leaf) 1,127 |

**What the pictures show** (`plan/pictures/rnd0125/125.6/em-web-concentric-pack-labels-9339dfbc.png`).
The giant component's rings by degree, the hubs at the centre, the
labels held apart at the outer rings; the same shelf waste in the
second row as every packed layout shows (125.9).

**Findings.**
- **Concentric is already the condensed ring layout**: each ring at
  the smallest radius that clears its own nodes and the ring inside
  it, the gap `minNodeSpacing` (10) — the box is read only with
  `avoidOverlap` off.  It is the model the 125.3 / 125.5 `condense`
  option copies, and its spelling (`minNodeSpacing`) is v3's; the
  sitting's call on one spelling across the four is whether
  `minNodeSpacing` should also exist on circle and radial as the gap,
  or `avoidOverlapPadding` on concentric.
- **`equidistant` spreads every ring by the largest ring step** (v3's
  rule): with one crowded outer ring the inner rings, which needed
  46 px, are pushed to that ring's 587 px step, and the picture is
  2.5 node sizes airy where the default is 0.68.  Not a defect —
  equidistant means equidistant — but the default is the better
  picture on a heavy level, and the doc should say why.
- The per-component binning of 123 holds: each component's levels
  are its own, the singletons one ring each.
- Label overlap on the outer rings: none, on em-web with the wrapped
  labels (the row above).

**What changed on disk.**  Nothing in `src/`; the README's
geometric-layouts entry records the sizing model.

**Maintainer review: pending.**  Open the page on em-web, Concentric,
Pack components on, labels on; the picture above.  Decide the
spelling question (with 125.3 / 125.5) and whether `equidistant`
wants a doc note.

**Maintainer sitting, 2026-09-15 (first pass, from the desk).**  Specifics **deferred**; the rule given is that options should be generally consistent between the layouts, spacing options included — one spelling for the gap, the box's handling and the compacting (item 61).  The `equidistant` note was not ruled on.

### 125.7 — grid

**Fixtures.**  em-web's singletons under `packComponents` —
EnrichmentMap's actual use of grid, the singleton rows — with labels;
thirty labelled singletons on three viewport aspects (1400 × 1000,
1000 × 1400, 800 × 200), with and without `condense`.

**Baseline** (commit 9339dfbc):

| run | ms | gap median / p90 | ratio | area Mpx² | fill | note |
| --- | --: | --- | --: | --: | --: | --- |
| em-web packed | 62 | 10 / 40 | 0.25 | 2.71 | 0.336 | crossings 4.1 M |
| em-web packed, labels | 76 | 26 / 42 | 0.35 | 6.42 | 0.253 | |
| 30 singletons 1400 × 1000 | — | 77 | 0.50 | 1323 × 850 | | 6 cols |
| … `condense` | — | 10 | 0.06 | 985 × 290 | | 6 cols |
| 30 singletons 1000 × 1400 | — | 44 | 0.28 | 956 × 1217 | | 5 cols |
| … `condense` | — | 10 | 0.06 | 819 × 350 | | 5 cols |
| 30 singletons 800 × 200 | — | 10 | 0.06 | 1648 × 183 | | 10 cols — overflows the box either way |

**What the pictures show** (`plan/pictures/rnd0125/125.7/`).
`em-web-grid-pack-labels-9339dfbc.png` and its close-up: each
component its own grid, the singletons as rows (123's block), labels
clear; the shelf's row-height waste between the rows of 7-node
components and the rows of pairs (125.9's finding, seen through
grid).

**Findings.**
- **`rows` / `cols` inference follows the box's aspect** (v3's
  `sqrt(cells × h / w)`): 6 columns on a landscape box, 5 on a
  portrait one, 10 on a strip — and on the strip the cells overflow
  the box since a 30-node grid cannot fit 800 × 200 at label size; the
  overflow is the documented `avoidOverlap` behaviour.
- **`condense` is what the singleton case wants**: the box-filling
  default spreads thirty singletons over 1323 × 850 px at half a
  node-size apart; condensed they are a 985 × 290 block at the padding.
  Under `packComponents` the singleton block is *already* condensed
  (123's block is sized by its members), which is why em-web's row
  reads 0.25 — so the apps' picture is right and the call is the
  standalone one: whether `condense` should default on when grid is
  the whole layout.  v3's default is off.
- `avoidOverlapPadding` (10) is the gap in the condensed picture and
  reads right at label size; the label-aware cell (114) sizes rows by
  heights and columns by widths.
- The `sort` and `position` mappings (85.3) were not re-audited; the
  quality suite covers them.

**What changed on disk.**  Nothing in `src/`; the README entry.

**Maintainer review: pending.**  Open the page on em-web, Grid, Pack
components on, labels on; the two pictures.  Decide whether
`condense` defaults on for a standalone grid.

**Maintainer sitting, 2026-09-15 (first pass, from the desk).**  **Deferred** into the consistent rule (item 61).

### 125.8 — preset and random

Audited for their contract, not their picture, on the quality
suite's fixtures and a three-node probe.

**Preset, as found.**  The map form and the function form; a node
without an entry keeps its position, a node never positioned sits at
the model's (0, 0); parents derive and locked nodes hold (114.3);
`fit` wins over `zoom` / `pan` when both are given, v3's rule, so
`fit: false` is what enables them; `spacingFactor` is ignored on both
paths.  The apps' CX2 round trip is `elements[].position` at load,
which preset with no `positions` honours (only the viewport options
apply).  **Two silent failures**, both the half-positions a data
import produces: a map entry of `{ x: 100 }` wrote `y: NaN` into the
store, and `{ x: 1, y: null }` became `y: 0` through the Float32
column.  Fixed: a supplied position must carry a finite x and y or
the run throws a `TypeError` naming the node, on the direct path and
the finisher path alike; the spec runs four bad shapes through both
and checks nothing was written.

**Random, as found.**  Uniform over the viewport box or the given
`boundingBox`, rounded to whole pixels; no seed, so two runs never
agree — the one built-in that failed the audit's stability criterion
by construction.  Fixed: a `seed` (mulberry32) makes the scatter a
function of the graph; omitted, `Math.random` as before.  The spec
pins same-seed equality, different-seed difference, the unseeded
control and the box; a non-finite seed throws.

**What changed on disk.**  `src/layout/preset.mts` (the check),
`src/layout/random.mts` (`mulberry32`, `seed`), the option type, the
specs, the README's contract note, the changelog, the throw gate
(both guards covered).  Types rebuilt.

**Maintainer review: pending.**  Nothing to look at on the page; the
sitting is the two calls: whether the throw on a half position is the
right severity (the alternative is to keep the missing axis), and
whether `random` should take `seed` from the page's seed box.

**Maintainer sitting, 2026-09-15 (first pass, from the desk).**  **Accepted** — the throw and random's `seed` stand.  Caveat recorded as a design note: seeds should generally be per-operation, and how an app supplies them depends on its architecture — a constant seed passed on every layout run, or a global seed on the `cy` instance; this needs more consideration before a wider seed surface is designed.

### 125.9 — packing: the shelf's rows waste the room under a short component, and now fill it

**The finding, reproduced.**  The maintainer's steps — the EM sample
network (`em-web`, 144 components: 187, 78, 32, 15, 14, 14, 11, 10 …
and 99 singletons) under `radial` with `avoidOverlap`,
`packComponents` and tidy on — give the picture in
`plan/pictures/rnd0125/125.9/em-web-radial-pack-before.png`: the
187-node disc (3883 × 4020) opens the first row, the 78-node
component (about 1500 tall) stands beside it, and the two thirds of
the column under the 78 is empty; the mid-sized components then open
a second row, the singletons a third.  `shelfPack`
(`src/layout/pack.mts`) is a shelf: rows wrap at about
`sqrt(total area) × 1.25`, a row is as tall as its tallest box, and
every shorter box in it leaves a column of slack beneath — the
limitation EnrichmentMap's vendored packer has.  The measure for it
is the **packing efficiency**: the component body boxes' summed area
over the packed bounding box (1 is a tiling of the boxes).  A scratch
probe over the page's own sheet and elements (headless 1400 × 1000)
read, before:

| network, layout (options) | components | efficiency | field | aspect |
| --- | --: | --: | --- | --: |
| em-web `radial` + `packComponents` + `avoidOverlap` | 144 | 0.656 | 5858 × 5324 | 1.10 |
| em-web `radial` … with labels | 144 | 0.661 | 5949 × 5324 | 1.12 |
| em-web `force` (the settle's re-pack, seed 1) | 144 | 0.503 | 2438 × 1984 | 1.23 |
| em-web `pack` | 144 | 0.584 | 3054 × 2652 | 1.15 |
| em-web `grid` + `packComponents` | 144 | 0.483 | 1880 × 1440 | 1.31 |
| npm-deps `radial` + `packComponents` | 164 | 0.712 | 3267 × 2663 | 1.23 |
| em-desktop `force` (seed 1) | 147 | 0.621 | 2833 × 2406 | 1.18 |

reactome and ndex-large are one component each (the plan called
reactome a forest; it is not), so they measure nothing here and were
dropped.

**The candidates, measured on the same boxes.**  A scratch harness
took each layout's component boxes and re-packed them four ways:
the shelf as shipped; the shelf with **column stacking** — a box that
fits the room under an earlier box of the same row goes there — into
the last column only, or first-fit into any column; and a **skyline
bottom-left** packer (each box at the lowest point of the skyline
where it fits, leftmost on ties), the guillotine's usual stand-in.

| boxes from | shelf | stack, last column | stack, any column | skyline |
| --- | --: | --: | --: | --: |
| em-web `radial` | 0.664 | 0.830 | 0.830 | 0.871 |
| em-web `force` | 0.543 | 0.543 | 0.543 | 0.671 |
| em-web `grid` | 0.483 | 0.513 | 0.513 | 0.563 |
| em-web `pack` | 0.584 | 0.650 | 0.671 | 0.779 |
| em-desktop `force` | 0.621 | 0.770 | 0.788 | 0.751 |
| npm-deps `radial` | 0.712 | 0.887 | 0.887 | 0.760 |
| npm-deps `flow` (flow's own pass) | 0.836 | 0.836 | 0.836 | 0.836 |

Skyline wins on em-web's four rows and loses on em-desktop and
npm-deps; column stacking wins or ties everywhere but em-web `force`
and `pack`, where the force blobs' bounding boxes are all of a height
and the slack is inside each blob's box, not under it.  What decided
it: skyline dissolves the rows — the singleton block, the group rows
(121.1), breadthfirst's shelves (123.4) and the comparator's reading
order are all built on rows — and its gain on force is on bounding
boxes of irregular blobs, which a tighter packing of boxes does not
make a tighter picture.  **Column stacking, first fit, went in.**

**What changed on disk.**  `shelfPack` keeps a list of the current
row's open columns (where it starts, how wide the box that opened it
was, how far down it is filled); a box shorter than the room under
the leftmost column whose width holds it stacks there, `spacing`
below, and otherwise the shelf runs as before.  Boxes of like size
never stack — the room under one is never a box plus a spacing — so
the rows of singletons and of the small shapes read as they did.
**Stacking is off under a comparator** (a fourth parameter, `stack`,
defaulting to "no comparator"): a caller's `componentOrder` is read
along rows, left to right — EnrichmentMap's singleton rows by score
(121.4) — and a stacked box would read down a column; with `stack`
forced on under a comparator the order still holds, read as rows top
to bottom, columns left to right within a row, top to bottom within a
column.  `packComponentBodies`, `packAnchors`, the discrete layouts'
`packComponents`, the `pack` layout, force's settle re-pack and
flow's own pass all go through it unchanged.  Specs:
`test/modules/layout-pack.mjs` pins the stacking on hand-computed
boxes (the stacked positions, the spacing respected, a box wider than
its column or taller than the room opening a new column, like sizes
never stacking, the comparator turning it off, `stack: true` under a
comparator column-major), with the control that the packed height is
the tallest box where rows alone would have wrapped;
`test/layout-pack.mjs` runs the `pack` layout over a tall chain, a
wide pair and two singletons — the singletons stack in the pair's
column and the field is exactly the chain's height — with the control
that under a `componentOrder` the first singleton continues the row,
the second wraps, and the field is taller.  `src/README.md`'s packing
section carries the mechanism and the numbers.

**After.**

| network, layout (options) | before | after | field after | aspect after |
| --- | --: | --: | --- | --: |
| em-web `radial` + `packComponents` + `avoidOverlap` | 0.656 | **0.826** | 5636 × 4390 | 1.28 |
| em-web `pack` | 0.584 | **0.671** | 3056 × 2305 | 1.33 |
| em-web `grid` + `packComponents` | 0.483 | **0.513** | 1880 × 1355 | 1.39 |
| npm-deps `radial` + `packComponents` | 0.712 | **0.854** | 2913 × 2489 | 1.17 |
| em-desktop `force` (seed 1) | 0.621 | **0.745** | 2775 × 2031 | 1.37 |
| em-web `force` (seed 1) | 0.503 | 0.488 | 2303 × 1970 | 1.17 |
| npm-deps `flow` | 0.836 | 0.836 | — | — |

em-web `force` moves by noise for a second reason: `packAnchors`
seeds the sim through the same shelf, so the seed field changed and
the settle with it (its own boxes shrank, 2.43 → 2.21 Mpx²); the
settle's re-pack had no column with the room either way.  Pictures:
`em-web-radial-pack-{before,after}.png`, `em-web-force-{before,after}.png`,
`em-web-pack-{before,after}.png` under `plan/pictures/rnd0125/125.9/`
— in the radial picture the 32-, 15- and 14-node components now sit
under the 78 beside the disc, and the small components' row takes
the singletons in columns of three; in the force picture the
7-node rings stack two deep and the barbells' row continues in
singleton pairs.

**The system, audited.**  The largest component's centre is held
through the re-pack as before (`holdLargest`, spec'd).  The field's
aspect on the landscape page (1.4) reads 1.17–1.39 after against
1.10–1.31 before — stacking makes rows shorter, so the square-tending
width leaves a wider field.  The row-width factor's candidates on
em-web (stacking on): 1.0 gives 0.905 at aspect 0.67 under `radial`
and 0.570 at 0.72 under `pack`; 1.25 gives 0.830 at 1.28 and 0.671
at 1.33; 1.5 gives 0.780 at 1.62 and 0.671 at 1.88.  The orientation
pass (121.2) is unchanged and its specs green.  **Stability**: a
one-node edit to a 2-node component of em-web and of em-desktop
followed by a re-pack moved **0** other nodes (the grown box kept its
slot).  **Cost**: the `pack` layout on em-web 36.8 ms with stacking
against 30.4 ms with rows alone (the column scan is per box per open
column), em-desktop 43.5 against 44.9 — noise at 121's batch sizes.

**Default recommendations (not changed in code).**  (1) Keep the
row-width factor at 1.25 for a landscape viewport, or better, make
the target aspect the viewport's (the packer knows neither today; the
`pack` layout and `packComponents` could pass `cy.width() /
cy.height()` in), since 1.0 packs tighter but portrait and 1.5
wider than the page.  (2) `componentSpacing` 40 is not what makes
the picture airy; leave it.  (3) The sitting should decide whether
the singleton block stacking into columns of two or three under a
taller row (the radial picture's bottom row) reads well enough, or
whether like-sized singletons should be kept to their own rows even
without a comparator — a one-line rule (`stack` only boxes shorter
than half the row) if not.

**Maintainer review: pending.**  Look at
`em-web-radial-pack-before.png` against `-after.png` (the column
under the 78, and the singleton block's columns), `em-web-pack-*`
(the EM keep-the-sim case), and `em-web-force-*` (the settle); run
the EM combo entry (force by sign) to confirm its rows read as
before, since a comparator turns stacking off; then call (3) above
and the aspect question.

**Maintainer sitting, 2026-09-15 (first pass, from the desk).**  **Deferred** — review on the page, with the option controls, before a decision; the stacking shelf stays as landed code.

### 125.10 — the page, as the audit's instrument

Done first, as sequenced: everything after it was measured through it.

**The live spacing slider.**  A second slider beside Spacing —
which stays what it was, a `spacingFactor` for the next run — that
rescales the *current* positions about their bounding-box centre as
it is dragged: `layoutConfig.scaledPositions(base, factor)` over a
snapshot taken at each `layoutstop` (and at load), applied through
`positions()` rather than a `preset` run, because a layout's stop
would re-base the slider to its own output and the factor would read
1 again.  Dragging back to 1 restores the layout's output exactly.
One apply per animation frame, so the 19.6k-node scene follows the
drag.

**The airiness readout.**  `debug/airiness.js`, one implementation
loaded by the page and required by the suites: for every leaf node
the gap to its nearest neighbour's box (the larger axis separation, 0
when touching or overlapping), found through a quadtree keyed by box
centres with the extent of the boxes under each quad as the pruning
bound; for every edge the gap between its endpoint boxes; each
summarised as median / p90 / max, and the headline *ratio* — the
median nearest gap in median node sizes, 1 meaning the typical node's
nearest neighbour is a node-size away.  The readout refreshes at
every `layoutstop`, every slider move and the labels box.
`test/modules/airiness.mjs` pins the quadtree against a brute-force
twin on random fields of 3 to 2,000 boxes (gaps equal everywhere; the
neighbour equal where the gap is unique), the summaries against
hand-placed boxes, and the control: a field scaled 3× about its
centre reads more than twice the gap.  The same probe is the audit
script's gap columns and the quality suite's "not too airy" rows.

**Edges coloured as their source node** on the reactome, npm-deps and
workflow scenes: a `source-band` derivation in `debug/fixtures.js`
copies each edge's source `band` onto the edge at load (a mapper
cannot reach across an edge), and the workflow sheet maps
`line-color` and the arrow colour from it with the nodes' ordinal
scale; the generated networks now run through `derive` as the
fetched ones do.  A rank's fan-out reads as one colour through the
gap, which is also what the reference tangled tree does.

**The baseline script.**  `benchmark/layout-audit.mjs`
(`npm run benchmark:layout-audit -- --network <id> --layout <name>
[--opts json] [--labels] [--json file]`): one layout on one of the
page's networks, headless at the page's size with the page's own
sheet and elements, printing overlaps, straight-line crossings, area
and fill, the gap columns, the edge gap, the per-node gap to its
nearest DAG parent with the worst node named (the IRAK1 column),
stability across a re-run and the time.  Every table in this round
is its output.

**The quality suite.**  A "not too airy" describe: every layout's
default picture on the fan and tree fixtures pinned under a
per-layout ceiling on the ratio (grid 2.5, breadthfirst 3.5, the rest
3.0 — the measured values at the round's start rounded up, a bound
and not a target), with the control that `spacingFactor: 3` reads at
least twice the ratio at 1.

**Maintainer review: pending.**  Open any network, run a layout, drag
Live spacing and read Airiness; open reactome under flow for the
source-coloured edges.

**Maintainer sitting, 2026-09-15 (first pass, from the desk).**  Findings, not an accept: the page should expose more — perhaps all — of each layout's options, flow's direction first, with an option shown only when a compatible layout is selected; in general the debug UI should show more of the option surface.  Taken as **sub-round 125.11** below.

### The first sitting pass (2026-09-15)

The maintainer took the ten sub-rounds' questions one at a time, from
the desk — by experience and logic, on the questions that were clear
at once, without opening the page; the page sittings, with the fuller
option controls the pass asked for, are still to come, and every
"deferred" above means exactly that.  What the pass decided:

- **Round-level.**  Sittings are recorded here, under each sub-round
  (not one file per sub-round).  A default change accepted in a
  sitting ships as accepted, with its changelog entry, rather than
  waiting for the round to land whole.  The 125.8 question (fold into
  125.7) was moot — it ran on its own and is the one sub-round signed
  off.
- **Signed off:** 125.8.  **Decided in part:** 125.3 (the roots;
  shipped).  **Deferred to the page:** 125.1, 125.2, 125.4, 125.5,
  125.6, 125.7, 125.9, and 125.10 with findings.
- **Three pieces of work raised**, in the order the sittings need
  them:
  1. **Sub-round 125.11 — the page's option surface.**  Expose more,
     perhaps all, of each layout's options on the debug page, flow's
     `direction` first, each option shown only when a compatible
     layout is selected.  The page sittings for 125.2 and 125.9 wait
     on it.
  2. **Item 61 — one consistent option surface across the layouts:
     spacing, compacting and the bounding box.**  The maintainer's
     framing: v3's box was a constraint; v4's default might read it as
     a hint of the available space, with an explicit
     `constrainWithinBounds`-style option saying when it binds; the
     gap's spelling and `condense`'s default are decided once, for
     every layout that has them.  Absorbs the deferred calls of
     125.4, 125.5, 125.6 and 125.7 and the round file's open
     node-separation spelling.
  3. **Item 62 — AVSDF, reconsidered.**  The crossing-minimised ring
     order round 122 declined, now that the clustered fixture measures
     it (the `sort` mapping alone cuts crossings 4.3×).
- **A design note for later:** seeds should be per-operation, and how
  an app supplies them — a constant per layout run, or a global seed
  on the instance — depends on the app's architecture; more
  consideration before a wider seed surface is designed.
