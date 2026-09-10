## Taxi tracks: automatic turn distances per bundle, the per-edge casing, and flow's corridors

Raised by the maintainer on 2026-09-10.  Flow's one open legibility
problem is *which edge goes to which node*: with `curve-style: taxi`
every edge out of a rank turns at the same distance, so the horizontal
runs of different sources lie on one line and a reader cannot follow
an edge through the gap.  The reference picture is Matteo Abrate's
tangled-tree visualisation (Observable, `@nitaku/tangled-tree-
visualization-ii`), built on GeneaQuilts [Bezerianos, Dragicevic,
Fekete, Bae, Watson, *GeneaQuilts: A System for Exploring Large
Genealogies*, IEEE TVCG 16(6), 2010, doi:10.1109/TVCG.2010.159] with
curved links in place of the matrices.  Its two devices are colour per
group — not universal, most DAGs have no natural grouping — and, the
universal one, **a different turn distance per group**, so each
group's runs sit on their own line in the gap.

### What the picture does, read from the notebook's code

The Greek-gods figure (levels as columns, nodes stacked within a
column, links leftward from parent to child):

1. **Bundles are families**: the children of one *parent set* share a
   bundle (`n.parents.map(id).sort().join('-X-')` is the key).  A node
   in several families (Zeus, Poseidon, Gaea, Aeneas) is in several
   bundles.
2. **Each bundle owns one trunk column in the gap** between its
   level and the one before: `b.x = max(parent.x) + node_width +
   (l.bundles.length − 1 − b.i) × bundle_width`, with
   `bundle_width = 14`.  That is the "gradual variation": the k
   bundles of a level take k adjacent trunk positions.  A child
   attaches by a horizontal run from the trunk; a parent by a
   horizontal run to it.  In Cytoscape terms every link is a
   `taxi-direction: rightward` edge whose `taxi-turn` (px from the
   parent) is `b.x − parent.x` — **the bundle's trunk is a taxi turn
   distance, and the family's trunks are routing tracks**.
3. **A node in several bundles is stretched** so the attachment points
   stagger by `metro_d = 4` px (the metro-map merge).
4. **Long links get a larger corner radius** (`c1 = min(bigc, xb−xt,
   yb−yt) − c` when the span is > 1) so they read as a sweep rather
   than a step.
5. **Every bundle's path is drawn twice, casing then colour, bundle by
   bundle** (`stroke=white width 5`, then `color(b) width 2`), so a
   later bundle's casing gaps the earlier line at a crossing.
6. Colour is `d3.scaleOrdinal(d3.schemeDark2)` per bundle.

Device 2 is the transferable one.  Its general form is not new: it is
the orthogonal edge routing of layered layouts — Sander's hyperedge
routing (*Layout of Directed Hypergraphs with Orthogonal Hyperedges*,
GD 2003), which ELK's layered algorithm ships as its `ORTHOGONAL`
edge router: the edges out of one node between two layers are one
hyperedge segment; the segments of a layer gap that overlap in x
conflict; conflicting segments take distinct *routing slots* in the
gap, ordered to minimise crossings between their vertical stubs, and
the gap grows by `slots × edgeSpacing`.  dagre has nothing of the
kind, which is one reason dagre-plus-taxi reads badly on a fan-heavy
DAG.  The picture's per-family trunk *is* a routing slot; the picture's
"families" are a hyperedge keyed on the parent set instead of the
source.

### What v4 has today, verified

- **Flow emits positions only, by decided design** (`src/layout/
  flow.mts:17-21`, `src/README.md:1188-1199`): "style-driven edges
  keep routing themselves after any drag".  No layout writes style,
  bypasses or data; two leave `scratch` (`concentric.mts:153`,
  `breadthfirst.mts:82`).  The `LayoutContext` (`src/layout/
  contract.mts:52-540`) has no per-edge result channel.
- **`taxi-turn` is a mappable edge prop** (`src/style.mts:3512-3522`;
  mapped turns are px, a percent is constant-only); bypasses re-derive
  the curve record (`src/style.mts:9392-9448` → `src/store/curve-
  index.mts:1310-1332`).  So a per-edge turn is already *expressible*;
  what is missing is a producer.
- **Curve records are position-independent by design** (`src/store/
  curve-blob.mts:16-19`): drags and layouts cost zero blob traffic;
  the taxi route is evaluated from live positions in both `evalTaxi`
  (`src/curve-geometry.mts:1387-1560`, v3's `findTaxiPoints` verbatim)
  and `evalRouteW` in `src/render/shaders.mts` — the dual-
  implementation discipline.  The px turn is measured from the source
  boundary along the taxi axis (`d = turn × sgnL`, then
  `srcH/2` when `edge-distances` includes the body); a turn inside
  `taxi-turn-min-distance` (10) of either end silently falls to the
  Z-/L-shape (`:1466-1470`).
- **The casing exists** — `line-outline-width` / `line-outline-color`
  (round 13 B4, column `edge.casing`, `src/style.mts:9366-9378`) —
  but it is a **global pass**: all underlays, then all casings, then
  all lines, then arrows, then overlays (`src/render/
  renderer.mts:2124-2240`).  A casing therefore halos an edge against
  nodes and the background, never against another edge.  **v3 draws
  the outline and the line per edge in order** (`drawEdge`), so a
  crossing *is* gapped there — this is a parity gap, not a feature.
- **Flow's long edges** are dummy chains (`src/layout/flow-
  order.mts:64-159`); BK aligns the inner segments to one x and that
  corridor is discarded at `flow.mts:593-598`.  With a turn near the
  source the taxi leg runs at the *target's* x through the
  intermediate ranks, which nothing keeps node-free; 112.4 measured
  the 50 %-turn polyline scoring more crossings than the straight
  drawing and withheld `alignLongEdges` (112.5's first lever).
- **The harness already scores the taxi polyline**: `benchmark/
  layout-quality.mjs:387-417` (`flow-taxi`, 50 % turn) over
  `countCrossings` (`:56-165`, proper intersections only).
- A categorical scheme is on hand for the colour recipe
  (`dark2`, `src/style-schemes.mts:214`).

### The decisions

1. **The pass lives in the style layer, not in the layout.**  A
   `taxi-turn: auto` edge takes its turn from a *track* the curve
   subsystem assigns from live positions.  Three reasons: the
   maintainer's rule that edges route themselves after any drag (a
   layout-written turn goes stale on the first drag); it works under
   every layout — `flow`, `breadthfirst`, `preset`, a dagre port, hand
   placement — and under animation; and it is how the bezier bundle
   already works (the renderer derives the pair's fan from topology,
   no layout writes `control-point-distances`).  Flow's contribution
   is what only the layout can give: node-free corridors and a gap
   wide enough for the tracks.
2. **A bundle is the edges out of one source** (ELK's hyperedge;
   `taxi-track: source`, the default), so a fan-out reads as one
   orthogonal bus — the reactome win 112.4 recorded (3 crossings
   against dagre's 73) kept, now on its own line.  `family` groups
   the edges into the targets that share a parent set (the
   GeneaQuilts key: k sources and m children on one trunk; each
   source drops to the trunk's line, each child from it), which is
   the genealogy and ontology case and explodes the track count on a
   general DAG, so it is opt-in.  `target` is the mirror for fan-in
   drawings (the turn near the target, v3's negative-turn sense).
3. **Tracks are assigned by conflict, ordered for crossings.**  A
   bundle's run is the interval on the cross axis from its source x
   to its farthest target x, on a band along the taxi axis from the
   source's far boundary plus `taxi-turn-min-distance` to the nearest
   target's near boundary minus it.  Two bundles conflict when both
   intervals overlap.  Conflicting bundles are coloured greedily in
   an order that is, in v1, the source's cross-axis position (left to
   right ⇒ near to far, the staircase every metro map draws); ELK's
   pairwise crossing rule — for a conflicting pair, count the
   crossings of a's verticals with b's run in either order and orient
   the pair the cheaper way, break cycles greedily — is the second
   pass, taken only if the first measurement says the staircase
   loses crossings on the fixtures.  Slot s of k in a band lands at
   `bandMid + (s − (k−1)/2) × spacing`, spacing =
   `min(taxi-track-spacing, band/(k+1))`, so a crowded gap
   compresses rather than falling into the Z-/L-fallback.  A lone
   bundle sits at the band's middle — an `auto` edge with nothing to
   disambiguate draws exactly what `'50%'` draws today.
4. **Delivery is one f32 column, not the blob.**  `edge.taxiTrack`
   (px, signed as `taxi-turn` is) is written by a CPU pass over the
   `auto` edges, **refreshed lazily off the geo epoch**, not eagerly
   in the position write: the store's `setPositions` only writes the
   column and bumps `geoEpoch`, a drag fires many pointermoves per
   frame and a layout writes positions in several passes, so the
   sweep runs once at frame start (the renderer's pre-draw) and on
   the CPU readers (`segmentPoints()`, `boundingBox()`, picking),
   each keyed on the epoch it last saw.  The blob record carries a
   flag and both `evalTaxi` and `evalRouteW` read the column when the
   flag is set.  The blob stays position-independent; what a drag now
   costs is one sweep per frame over the taxi-auto edges whose bands
   moved, O(E log E) with E the auto edges — a 7k-edge DAG is well
   under a millisecond, and the pass is a single count check when no
   `auto` edge exists.  `segmentPoints()`, `boundingBox()`, picking and the
   parity ledger follow because they read the same route.
5. **The casing becomes per-edge — v3's order.**  Instead of the
   global casing pass, an edge with casing draws as a pair of
   instances in the line pass, casing then line (instance parity in
   the shader; both streams), so a later edge's casing gaps an
   earlier edge's line where they cross — the picture's device 5 —
   and the separate casing pass goes away.  Verified in v3's
   `drawEdge`: outline, underlay, line, arrows, overlay, one edge at
   a time in z order.  The pair lands after v4's global underlay
   pass — the same z-ordering deviation the README already records
   for underlay and overlay — and only cased edges pair (the store
   already counts them), so the instance count grows only where
   casing is on.  This is a parity fix with a visible change for
   anyone using `line-outline-*` today; the round says so in the
   changelog and the ledger scene re-baselines, and MIGRATING names
   the recipe for the old global-halo look: the edge underlay, which
   is still a global pass under all edges.
6. **Flow keeps the corridor and sizes the gap.**  (a) *Target-
   anchored corridors*: a span-≥2 edge's chain aligns to its
   target's x (the chain's last segment joins BK's protected inner
   segments and the block is anchored at the target), and the chains
   of the long edges into one target merge into one dummy per shared
   rank — they are the same physical leg — which makes the sweep's
   crossing count taxi-aware for the legs (112.5's first lever, in
   the form the measurement asked for).  (b) *Gap growth*: after
   `assignX`, flow runs the same track counter over each rank gap and
   sets that gap to `max(rankSep, slots × edgeSep + 2 ×
   minTurn)`, `edgeSep` a new option defaulting to the style
   default's 10 — positions only, ELK's `edgeSpacing`.  Both hold
   when `taxi-turn` is a constant too; the gap is simply wider.
7. **Declined**: stretching a node to stagger its attachment points
   (device 3 — `source-endpoint`/`target-endpoint` are constants and
   the merge at a shared target already reads as a metro junction);
   the long-edge radius (device 4 — `taxi-radius` is mappable, a
   recipe); a colour-per-bundle mechanism (device 6 — a `line-color`
   ordinal mapper over an edge data key is the recipe, documented).

### The style surface

| prop | values | default | note |
| --- | --- | --- | --- |
| `taxi-turn` | px, `'N%'`, **`auto`** | `'50%'` | `auto`: the track's turn; reads back as `'auto'` |
| `taxi-track` | `source` \| `target` \| `family` | `source` | which edges share a track |
| `taxi-track-spacing` | px | `10` | the ideal distance between neighbouring tracks |

`taxi-track` and `taxi-track-spacing` are mapper-capable scalars
like the other taxi props; `auto` on a mapped `taxi-turn` is a
`fallback`-able keyword, with the corner-radius parser's sentinel-
and-readback pattern as the precedent.  There is no `none` value:
the off state is a non-`auto` turn, so a constant turn with a
grouping set is a plain no-op rather than two competing switches.
The grouping is spelled *track*, not *bundle*, because *bundle*
already names the bezier parallel-edge pair throughout
`curve-index.mts` and the README.  Flow's option: `edgeSep` (px,
default 10).

### The passes

- **124.1 — measure first.**  The harness grows a *run-overlap*
  column — pairs of bundles whose horizontal runs are collinear and
  overlap, the figure this round exists to lower — and a
  `flow-taxi-tracks` row that assigns tracks from a prototype of the
  module over flow's positions.  Rows: `flow-taxi` at 50 %, at
  `20px`, and tracked, on deps, workflow-1k, reactome and the
  Greek-gods genealogy (the notebook's data, 67 nodes / 92 edges,
  added as a fixture) — crossings and run-overlap side by side.  The
  staircase-vs-crossing-rule order is decided here.
- **124.2 — `src/taxi-tracks.mts`.**  A pure function: edge slots,
  endpoint slots, per-edge direction and bundle key, node boxes →
  per-edge turn px; sweep-line over the taxi axis, conflict colouring,
  the slot formula.  Shared by the store and by flow (both under
  `src/`).  `test/taxi-tracks.mjs`: disjoint runs untouched, a bus
  shares one turn, `family` puts two sources on one line, the
  min-distance clamp keeps every turn ideal, compression in a
  crowded gap, determinism, and the lone-bundle = 50 % identity.
- **124.3 — the style props and the column.**  Parse, computed
  record, `EDGE_DEFAULTS`, `MAPPABLE`, readback, the blob flag, the
  `edge.taxiTrack` column and its epoch-keyed refresh at frame start
  and on the CPU readers,
  `evalTaxi` and `evalRouteW` reading it.  Gates: `test/curve-
  derivation.mjs`, `test/curve-routes.mjs`, `test/style-readback-
  all.mjs` and `test/style-camel-case.mjs` (a new edge prop fails
  their coverage otherwise), `test/curve-route-accessors.mjs`
  (`segmentPoints()` reflects the track after a drag), a Playwright
  routing scene.
- **124.4 — the per-edge casing.**  The paired-instance line pass in
  both streams, the casing pass removed, `test/edge-casing.mjs` and
  the routing ledger re-baselined with the crossing gap asserted in
  pixels.
- **124.5 — flow.**  `edgeSep` and the gap growth; target-anchored,
  merged corridors in `flow-order.mts`/`flow-position.mts`; the
  withheld long-edge corridor spec (no node body in the leg, the
  merge off as the control); the crossing table against 112.4's
  numbers.
- **124.6 — docs and the page.**  `src/README.md` (the taxi props,
  the flow section's taxi contract rewritten around tracks, the
  colour and radius recipes), JSDoc and the shipped d.ts, MIGRATING
  (casing order) and the changelog; the debug page's flow sheet
  switches to `taxi-turn: auto` with a background-coloured casing,
  and a Greek-gods scene with `taxi-track: family`, `dark2` per
  family and `direction: 'rightward'` reproduces the reference
  picture.

### The specs that discriminate

Tracks: two overlapping fan-outs from the same rank land on distinct
lines (the control: `taxi-turn: '50%'` puts them on one); a bundle's
edges share one turn to the px; a `family` of two parents draws one
trunk line (per-source draws two); every `auto` turn satisfies the
min-distance test so no edge falls to the Z-shape; a drag that moves
a source across another's run re-assigns before the next frame.
Casing: at a crossing the later edge's casing colour is what the
pixel under the earlier edge's line shows.  Flow: a span-3 edge's
leg at the target's x meets no node body on the intermediate ranks;
two long edges into one target share one dummy per rank; the gap
between two ranks with k conflicting bundles is at least
`k × edgeSep + 2 × minTurn`.

### Risks named at planning

- The position-write path is the hot path; the track sweep must be
  incremental in the drag case (only bands touching the moved nodes)
  and must never run when no `auto` edge exists — the render bench's
  drag row is the detector.
- Track order flips as nodes move (a source crosses another's run):
  the staircase order is stable under small drags, the crossing rule
  is not; if 124.1 chooses the crossing rule, hysteresis is its
  price.
- The per-edge casing changes what existing `line-outline-*` users
  see at crossings; it is v3's picture, and the ledger says by how
  much.
- Chain merging changes ordering on every dummy-heavy graph, not only
  taxi-styled ones; the harness's straight-line rows must not move
  by more than noise, or the merge becomes conditional on a flow
  option.

**Decided (the maintainer, 2026-09-10):** (1) style-side tracks, for
the drag rule and layout-agnosticism, with the column refreshed
lazily off the geo epoch; (2) `taxi-turn: auto` is the switch and
the grouping is `taxi-track` / `taxi-track-spacing`, no `none`
value; (3) the default grouping is `source` — bounded by the nodes
in a rank and what the reactome win was measured on; `family` is
the genealogy recipe; (4) the per-edge casing lands as parity
without a switch — the global halo was never v3's, and the edge
underlay already gives it to anyone who wants it.

---

## What landed (2026-09-10)

Item 59, the day it was planned, on the four calls above.  What
follows is the round pass by pass, and where the work departed from
the plan and why.

### 124.2 — the pass, as a pure function

`src/taxi-tracks.mts`: edges (source/target slots, direction, min
distance, body mode, grouping, spacing) plus node centres and outer
halves in, one px turn per edge out.  Per edge the axis, sign and
ideal band are derived exactly as `evalTaxi` derives them
(body-subtracted deltas, the auto-axis choice, the min distance at
both ends); an edge whose band is empty keeps the 50 % turn.  Bundles
key on the grouping per axis and direction, with an interval-clique
split when members' bands do not intersect (a family whose parents
sit at different heights).  **Added over the plan:** the band is cut
by the node bodies the run would cross and keeps the stretch nearest
the source (nearest the target for `target` bundles) — without it a
lone long edge's run landed in an intermediate rank row, and with it
a long edge's run takes the first gap and its leg the target's x,
which is exactly the corridor 124.5 keeps free.  Conflicts are pairs
whose runs and bands both overlap, found by a sweep along the axis
with an active band list; components by union-find; slot s of k at
`mid + sgn × (s − (k−1)/2) × min(spacing, band/(k+1))`.  `runDepth`
(the interval colouring) is what flow sizes a gap with.  Twelve
specs, including the lone-bundle = 50 % identity, the crowded gap
compressing to 150/21 px with every turn ideal, and determinism
under edge permutation.

### 124.1 — the measurement, and the order it decided

The harness grew a `runOverlap` column — pairs of bundles (the edges
out of one source) whose horizontal runs are collinear and overlap,
the figure this round exists to lower — with self-tests, four taxi
rows (`flow-taxi` at 50 %, `flow-taxi-20`, `flow-taxi-tracks` in the
staircase order, `flow-taxi-tracks-x` in ELK's pairwise crossing
order) and the Greek-gods genealogy as a fixture (Abrate's data, 67
nodes over 7 generations, 92 edges, 20 two-parent nodes; the
derivation script is beside it).

| fixture | flow-taxi | flow-taxi-20 | tracks (staircase) | tracks (crossings) |
| --- | --- | --- | --- | --- |
| deps | 5168 / 43 | 4344 / 24 | 4515 / 0 | 4259 / 0 |
| workflow-1k | 26851 / 1141 | 26273 / 492 | 29266 / 3 | 23176 / 3 |
| reactome | 3 / 37 | 3 / 37 | 62 / 0 | 59 / 0 |
| greek-gods | 16 / 10 | 16 / 10 | 144 / 0 | 134 / 0 |

(crossings / run overlaps, before 124.5's positions.)  The run-overlap
count falls to 0 (3 on workflow-1k) under either order.  The 50 %
rows' crossing counts are not comparable: collinear overlapping runs
are not proper intersections, so reactome's 37 overlaps hid the leg
crossings that separating the lines exposes.  Between the two orders
**the crossing rule wins on all four fixtures and is the default**,
the staircase kept as the control.  Its cost counts per edge run with
the shared-endpoint exclusion — the way the harness counts — after a
first bundle-level version chose the dearer order in 5 of 7 pairs on
the gods; a per-bundle count is the perceptual truth (a bus is one
line), but the instrument is per edge, and the rule optimises what is
measured.

### 124.3 — the props, the lane, the store

`taxi-turn` takes `auto` (stored as the 50 % default with an auto
flag, reads back `'auto'`; a mapper's `fallback: 'auto'` compiles to
a sentinel the setter reads back as the flag), `taxi-track: source |
target | family` and `taxi-track-spacing` (px, default 10), all
mapper-capable edge props with readers, 155 readable edge props now.
**Departure from the plan:** delivery is not a new `edge.taxiTrack`
column.  The taxi blob record's third float became a turn *mode* (0
px, 1 percent, 2 auto) and an auto edge's px turn is the params
header's n lane, which taxi never used — both `evalTaxi` (now taking
the lane) and the WGSL `evalRouteW` (`header.z`) read it.  The reason
is the binding budget: the curved vertex stage binds 7 storage
buffers plus the visible list, WebGPU's base limit, so a new column
had nowhere to bind; the lane rides a column the stage already reads,
the blob stays position-independent, and the plan's intent holds.  An
auto turn routes toward the target like a percent turn (the
forced-direction rule never applies).  `CurveIndex` keeps the exact
set of auto slots (set on style, cleared on release, moved on
compaction), and `GraphStore.refreshTaxiTracks` runs from
`flushDerived` once per geo epoch — at frame start (`takeDelta`) and
on the CPU readers — building the track edges from the extras, the
shown leaf bodies as obstacles, writing the changed lanes as one
dirty span and never bumping the epoch it is keyed on; a single size
check when nothing is auto.  Two limits, recorded: under a GPU tween
or force lease the CPU positions are stale, so tracks refresh when
they land; and the sweep is whole, not incremental — see 124.7 for
what it costs.  `test/taxi-auto.mjs` (13 specs) covers the
props, the pass through `segmentPoints()` — two overlapping fan-outs
10 px apart with the '50%' control on one line, the identity, family
vs source, a drag off and back onto the other run — the bounding box
and the lane written with the blob untouched; a renderer spec reads
each colour on its own row in the browser.

### 124.4 — the casing, per edge

With any casing on, each stream's scene draw spends two instances per
visible edge off a third indirect args block (the scan kernel doubles
the count): the even instance the casing at the layer record's
width, the odd the line, so within one draw each edge's casing lands
over every earlier edge's line — v3's `drawEdge` order, verified
(outline, underlay, line, arrows, overlay, per edge in z order).  The
straight shader factors `vsEdge`'s body into `edgeVertexAt`, shared
with `vsEdgeCased`; `fsEdge` shades a casing instance solid.  The
curved shader factors the layer stage's fused-geometry body into
`curvedVertexFused` (with the dash/gradient length walk the line
instance needs); the cased pipeline takes a third bind layout — the
fused vertex set plus the paint set, the casing record visible to
both stages — and `fsCurvedCased` shades the casing branch before the
shared `shadeCurved`.  The separate casing layer pass is gone; the
pair lands after the global underlay pass, the deviation the README
already records for the layers.  Measured: `parity-casing` 72 px
(0.060 %) → 10 px (0.008 %) against v3; `parity-closeup-layers` stays
at 0.  A renderer spec draws an X and reads the later edge's casing
colour on the earlier edge's line 5 px from the crossing, with the
z-order swapped as the control.  The changelog and MIGRATING say
what a `line-outline-*` user sees now, and name the underlay as the
global-halo recipe.

### 124.5 — flow's corridors and gaps

The chains of the long edges into one target merge into one dummy per
shared rank, the merged unit edges carry the summed weight, and a
chain's last segment is protected like an inner segment; BK's marking
reads a protected up-edge on real targets too.  **Found on the way:**
the first version left the up-sweeps anchoring the chain elsewhere
(a real parent competing for the target won it in sweep order) and
the four-way median split the block, so vertical alignment gained a
pre-pass — protected edges align first under their own monotonic
guard, and the ordinary pass stays between the protected alignments
ahead of and behind it.  A dummy aligns only along its protected
edge, so the topmost dummy of a merged chain, joined only by sources'
first segments, anchors the block at the target.  Compound mode keeps
plain chains.  A corridor probe over 400 seeded random DAGs (does the
vertical line at a long edge's target x meet a node body on the
intermediate ranks?) read **187 violations before, 7 after**, the
residue being chains the ordering left crossing (a type-2 conflict),
where the guard can anchor only one; the public spec is the probe's
seed-1 fixture, which fails on the pre-124.5 flow, and the module
spec pins the shared dummy, the summed weight and the protected tail
with plain chains as the control.  `edgeSep` (px, default 10;
negative throws): after `assignX` the gap below each rank becomes
`max(rankSep, tracks × edgeSep + 2 × 10)`, `tracks` the overlap
depth of that rank's fan-out runs (long edges included, since the
pass puts their runs in the first gap); `assignY` takes the per-gap
array.  The straight `flow` row moved within noise (deps 4407 →
4189, workflow-1k 19482 → 19589, reactome 64 → 67, gods 117 → 117),
so the merge stays unconditional; the tracked rows after 124.5: deps
4142 / 0, workflow-1k 22929 / 1, reactome 59 / 0, gods 134 / 0.

### 124.6 — the page and the record

The debug page's flow and breadthfirst sheets take `taxi-turn: auto`
with a 2 px background-coloured casing, and `?network=greek-gods`
reproduces the reference picture: flow rightward, `taxi-track:
family`, dark2 cycled over the 25 families, a 3 px white casing —
opened and looked at: one trunk per parent pair, Zeus's families on
parallel lines, the crossings gapped.  The README carries the taxi
props, the flow contract rewritten around tracks, the per-edge casing
and the two recipes (colour per family as an ordinal mapper, the
long-edge radius as a `taxi-radius` mapper); the shipped declaration
carries `edgeSep` and the extras' fields; the changelog and MIGRATING
carry the user-visible changes.  Gates: the Node tier, the throw gate
(two exemptions re-keyed for moved lines), the harness spec (105),
the two new renderer specs and the casing parity scenes.

### 124.7 — the sweep's cost, measured and cut

The plan's risk note named the position-write path as the hot path
and the plan's own estimate ("well under a millisecond at 7k edges")
was wrong: the first sweep on a 3k-node, 8.7k-edge layered DAG took
1.1 s.  Three causes, three fixes.  The crossing rule's cycle check
was a DFS over the whole preference DAG per pair (1.3 s alone at 139k
conflicting pairs): it is now a bitset transitive closure per conflict
component, walking set bits only, with the component capped at 128
bundles (past which that component keeps the staircase; 64 cost
crossings on deps and workflow-1k, whose components sit between).
The obstacle cut scanned every node body per bundle: the bodies are
sorted along each axis once and a bundle walks the ones whose lower
edge lies in its band.  Bundle keys were strings: they are numbers.
Two alternatives were measured and declined — Pearce–Kelly
incremental cycle detection (196 ms: the bounded searches still walk
dense successor lists) and a Copeland-seeded adjacent-swap
refinement (5 % more crossings on workflow-1k than the margin-greedy,
which the bitset closure reproduces exactly).  Measured after: 8 ms
on workflow-1k (1.9k edges, 6.6k pairs), 26 ms on a dense 2.7k-edge
bench where every source fans across its row, 160 ms on the
pathological 8.7k-edge one (29 gaps, each a 100-clique of bundles);
a graph with no auto edge pays a size check (5 µs).  The realistic
figure is the workflow one: a drag on a 2k-edge auto graph spends 8
ms a frame in the sweep.  Incremental sweeps stay the follow-up if a
real graph ever needs them.

### What the plan said that the code corrected

- A separate f32 column could not bind in the curved vertex stage;
  the params header's unused n lane carries the track instead.
- The staircase was the plan's first order; the measurement chose the
  crossing rule.
- The plan had no obstacle cut; without it a lone long edge's run sat
  in a rank row, so the pass cuts the band by node bodies.
- The plan's alignment change ("the chain's last segment joins the
  protected inner segments") was not enough on its own; the pre-pass
  with a look-ahead bound is what anchors the block in all four
  alignments.
- The harness's crossing counts under the 50 % turn were never
  comparable to separated lines, which is the sentence 112.4's
  withholding was missing.
