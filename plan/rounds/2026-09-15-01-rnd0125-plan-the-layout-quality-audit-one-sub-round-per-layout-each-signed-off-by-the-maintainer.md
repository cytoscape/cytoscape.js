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

One sub-round per layout, and one for packing, in the order below.
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
required.**

**125.2 — `flow`.**  The Sugiyama-class built-in (112) with 124's
tracks.  Fixtures: the seven DAG fixtures, all four `direction`s on
deps and greek-gods.  Criteria in focus: crossings against the 112.1
harness's dagre and elkjs rows — "comparable to dagre" is still the
bar — rank compactness, the long-edge and skip-edge cases
(deep-skips), compound ranking (compound.json), and the taxi
corridors' run-overlap count (124: 0 / 1 / 0 / 0).  The one on
workflow-1k is the case to look at.  Runtime: workflow-10k end to
end, and 124.7's sweep row.  **Maintainer review required.**

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
documentation should point at flow.  **Maintainer review required.**

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
sizes.  **Maintainer review required.**

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

125.1 and 125.2 first — the flagships the apps actually run — then
125.9, since packing is what the pictures of every other layout are
seen through.  125.3 to 125.8 in any order after.  The sub-rounds are
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
ships in 4.0 or waits for the round to land whole.
