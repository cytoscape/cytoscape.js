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
   `taxi-bundle: source`, the default), so a fan-out reads as one
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
   `min(taxi-bundle-spacing, band/(k+1))`, so a crowded gap
   compresses rather than falling into the Z-/L-fallback.  A lone
   bundle sits at the band's middle — an `auto` edge with nothing to
   disambiguate draws exactly what `'50%'` draws today.
4. **Delivery is one f32 column, not the blob.**  `edge.taxiTrack`
   (px, signed as `taxi-turn` is) is written by a CPU pass over the
   `auto` edges whenever positions land (bulk layout write, drag,
   animation frame, `position()`); the blob record carries a flag
   and both `evalTaxi` and `evalRouteW` read the column when the flag
   is set.  The blob stays position-independent; what a drag now
   costs is one sweep over the taxi-auto edges whose bands moved,
   O(E log E) with E the auto edges — a 7k-edge DAG is well under a
   millisecond, and the pass is skipped entirely when no `auto` edge
   exists.  `segmentPoints()`, `boundingBox()`, picking and the
   parity ledger follow because they read the same route.
5. **The casing becomes per-edge — v3's order.**  Instead of the
   global casing pass, an edge with casing draws as a pair of
   instances in the line pass, casing then line (instance parity in
   the shader; both streams), so a later edge's casing gaps an
   earlier edge's line where they cross — the picture's device 5 —
   and the separate casing pass goes away.  This is a parity fix
   with a visible change for anyone using `line-outline-*` today;
   the round says so in the changelog and the ledger scene re-baselines.
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
| `taxi-bundle` | `source` \| `target` \| `family` | `source` | which edges share a track |
| `taxi-bundle-spacing` | px | `10` | the ideal distance between neighbouring tracks |

`taxi-bundle` and `taxi-bundle-spacing` are mapper-capable scalars
like the other taxi props; `auto` on a mapped `taxi-turn` is a
`fallback`-able keyword.  Flow's option: `edgeSep` (px, default 10).

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
  `edge.taxiTrack` column and its refresh on the position-write path,
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
  and a Greek-gods scene with `taxi-bundle: family`, `dark2` per
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

**Open (the maintainer's calls):** (1) style-side tracks against a
layout-written turn — the plan's reason is the drag rule and
layout-agnosticism; (2) the spellings — `taxi-turn: auto` plus
`taxi-bundle` / `taxi-bundle-spacing`, or one `taxi-track` prop
carrying the grouping with `none` as its off state; (3) the default
grouping (`source`) — the genealogy picture wants `family`, the
general DAG does not; (4) whether the per-edge casing lands as parity
without a switch, or behind a `line-outline-order` style for the
global halo look some drawings may want.
