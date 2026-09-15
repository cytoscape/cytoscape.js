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
