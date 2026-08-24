## Round 82 plan — cluster hulls + collapse/aggregation proxies (planned 2026-08-14)

The LOD section of issue #3486 names "cluster or component proxies"
as a progressive-detail tool; the AutoAnnotate/EnrichmentMap idiom
(shaded, labelled cluster regions) is the visual half of the same
idea, and EM web today fakes it with cytoscape-bubblesets + automove
over v3.  This round designs both natively.  What the code does
today, verified:

1. **Draw order is structural and z-index is gone for good**
   (`src/README.md:1307`): the scene pass runs depth prepass →
   compound parents → edges/arrows → ghosts → node bodies +
   image/chart/overlay → labels (`src/render/renderer.mts:50-52`).
   A hull tier therefore gets a *position in the pass*, not a
   z value — first in the scene pass, under the parent bodies.
2. **No classes, no selector strings** (`src/README.md:1303`;
   `src/matcher.mts:14`).  The query IR is a plain serializable
   object — per-group flag tests plus data-sidecar conditions in the
   case-mapper vocabulary (`src/matcher.mts:49-78`); unknown keys
   throw (`src/matcher.mts:187-193`).  A hull grouping has the same
   two honest declaration forms available: a data key, or explicit
   ids.
3. **Removed elements are terminally dead** (`src/README.md:1998`) —
   no `restore()`, no import-form `cy.json()`.  But the **display
   tier** is exactly the non-destructive hiding collapse needs:
   `show()`/`hide()` is structural state (`src/collection.mts:
   3644-3673`, `GraphStore.setVisibility` at
   `src/store/graph-store.mts:1795`) — a hidden element draws
   nothing, picks nothing, takes no space, and *hidden children
   leave their parent's auto-bounds*; a parent with no shown
   children keeps its position at its stashed style size — v3's
   degenerate fallback (`src/store/hierarchy.mts:306-309, 371-377`).
   That fallback is, verbatim, the collapsed-proxy rendering: hide
   the children and the parent *already* draws as a normal node at
   its style size.
4. **The compound machinery is a narrow-host sidecar**
   (`src/store/hierarchy.mts:38-44`): parent links, child lists,
   depth, lazily-flushed derived geometry, never touching columns
   directly.  The same pattern (and the CurveIndex's lazy
   `flush()`) is the mold for a HullIndex.
5. **Dirty tracking is one coalesced span per column per frame**
   (`src/store/dirty.mts:13-19`, `mark` at :57), drained by the
   renderer's `takeDelta`.  Hull recompute can key off the
   `node.position` span the same way — over-recompute inside the
   span hull is the accepted cost, per the tracker's own doc.
6. **Labels are four slot-keyed glyph streams** over one SDF atlas
   (`src/render/label-layer.mts:14-25`); the owner word carries
   slot + a rotate flag (`src/render/glyph-buffer.mts:18`).  A
   hull-label stream is a fifth GlyphBuffer keyed by hull index.
7. **The harness already has the exact fixtures this round needs**
   (`debug/networks.js:23-38`): `em-web` ships
   `mcode_cluster_id` on 354/569 nodes, and `em-web-clustered`
   materialises those 41 MCODE clusters as real compound parents.
8. Serialization gap, verified: element `json()` exports
   selected/selectable/locked/grabbable/pannable but **not the
   display-tier hidden state** (`src/collection.mts:920-940`), and
   the wire format's flag list has no hidden column
   (`src/wire.mts:66-77`).  Collapsed state does not round-trip
   today; the round must decide whether it starts to.
9. To-verify at implementation: whether built-in layouts skip
   display-hidden nodes (a grep over `src/layout/` finds no
   SHOWN/hidden test, so the presumption is they do not).

**Design calls.**

- **Hulls are declared by data key, not by member list.**
  `cy.hulls({ groupBy: 'mcode_cluster_id', ... })` — one hull per
  distinct value, membership read straight from the columnar
  sidecar, elements with the key absent belong to no hull (the
  matcher's missing-value rule).  This is AutoAnnotate's own model
  (clusters are node attributes) and it makes membership *live*: a
  data write moves a node between hulls through the existing
  watched-key machinery, and there is no second membership store to
  keep alive across add/remove.  Rejected: explicit member-id
  lists — a parallel membership structure with its own
  staleness rules; an app that has lists writes them into a key.
  Rejected: compound-parent hulls — a hull around a compound
  duplicates the parent body the renderer already draws.
- **Geometry is a padded, corner-rounded convex hull**, computed on
  the CPU per dirty hull (hull of member outer boxes, O(k log k),
  Minkowski-padded; corners arc-sampled), drawn on the GPU as a
  triangle fan (convex ⇒ fan is valid) plus a border strip.
  Rejected for v1: bubble-set concave outlines — a marching-squares
  field costs O(grid cells × members) per recompute per drag frame,
  which is precisely the jank EM web lives with today.  Logged as
  the v2 candidate instead: a fragment-shader SDF blob
  (smooth-union of member discs + intra-cluster capsules) — GPU-
  native concavity with no CPU field, but per-pixel cost O(members)
  needs a member cap and coarse tiling, so it enters only behind a
  measurement.
- **Hulls draw first in the scene pass** — structurally under
  parents, edges and nodes.  No pick surface in v1 (a recorded
  deviation from desktop AutoAnnotate's selectable annotations).
- **Collapse is non-destructive by construction**: `hide()` the
  member nodes (edges follow — an edge with a hidden endpoint
  leaves bounds and draw via the existing endpoint gating), keep
  every original element alive in the store, and let the compound
  parent *be* the proxy via the degenerate fallback (finding 3).
  Nothing is removed on collapse, so terminal-death never bites.
  Only the derived **meta-edges** are added on collapse and removed
  on expand — they are cheap to recreate, which is the one shape of
  element for which terminal death is free.  Rejected: a shadow
  "removed but restorable" tier — it re-opens the 2026-07-27
  decision for one feature.
- **v1 collapses compound parents only** (`em-web-clustered` is the
  fixture; EM's collapse is compound-shaped; iVis's
  expand-collapse tracker is compound-based).  Data-key clusters
  get the hull idiom; a helper that wraps a key's clusters in
  parents can come later.  Meta-edges are real elements with
  deterministic ids (`meta:<parentId>:<otherId>`), one per
  (collapsed side, outside endpoint) pair, so layouts, algorithms,
  queries, picking and export all work on the collapsed graph with
  zero new code paths.
- **v1 aggregation: `collapsedCount` always; summed numeric keys on
  request** (`aggregate: { sum: ['weight'] }`), the sums written
  *under the original key names* — so an existing
  width-by-weight mapper styles meta-edges with no sheet change
  (EM's summed-edge behaviour).  Means are derivable; min/max wait
  for demand.
- **Collapsed state is session state in v1.**  Adding a hidden
  column to the wire format is a version bump (`src/wire.mts:57`)
  and `json()` would need the field too; before paying that,
  ship `cy.collapsed()` (the collection of collapsed parents) and
  document re-collapse-after-load as the app idiom — consistent
  with "re-adding from kept definitions is the app's job".  The
  Open paragraph carries the round-trip question.
- **One round or two?  Split — and this plan is written at the
  seam.**  The halves share only one wire: hidden members leave
  their hull, which the HullIndex gets *free* from the SHOWN mask
  it already tests.  Hulls are a renderer feature (a pipeline, a
  glyph stream, goldens); collapse is a model feature (a sidecar,
  aggregation semantics, events) with nearly no renderer work.
  Sizing: hulls ≈ 1.5× a typical round (a new draw tier + labels),
  collapse ≈ 1×.  Recommendation: land 82.1–82.3 and close; run
  82.4–82.6 as the next round.  If the maintainer wants one round,
  the passes stand as ordered.

### 82.1 — the HullIndex (store tier)

New `src/store/hull-index.mts` on the hierarchy/curve narrow-host
pattern: the `cy.hulls( spec | null )` declaration (get/set;
serializable; unknown keys throw — the matcher precedent), the
value→members index off the `groupBy` column, and per-hull padded
convex-hull geometry flushed lazily.  Dirt: membership from
watched-key data writes and add/remove/show/hide; geometry from the
`node.position` span (recompute hulls intersecting the span) and
from `outerHalf` changes.  Hidden members are excluded by the SHOWN
mask; a hull with < 1 shown member emits nothing.  Spec props v1:
`groupBy`, `padding`, `fill`, `fill-opacity`, `border-width`,
`border-color`, `border-opacity`, `label` (on/off + per-value text
map, default the value itself) — constants plus a per-value
override map; no mappers in v1.  **Verified by** Node specs: hulls
over a fixture with known membership (geometry containment —
every shown member's outer box inside its hull, padding respected),
membership moves on a data write, hide/show flips, and every new
throw pinned (`test:throws` at zero).  Files: `src/store/
hull-index.mts`, `src/store/graph-store.mts`, `src/core.mts`,
`src/public-types.mts`.

### 82.2 — the hull pipeline (render tier)

New `src/render/hull-pipeline.mts` + a `wgsl`-tagged shader: fill
fan + border strip per hull from a hull-vertex storage buffer the
mirror uploads on hull dirt, drawn first in the scene pass
(`renderer.mts` drawScene) — structurally under everything, no
depth participation.  Not pickable; excluded from `boundingBox()`
and fit in v1 (hulls follow content, recorded).  **Verified by**
goldens: a clustered scene with hulls (exact, per the round-57.1e
rule) plus the two controls that must fail — the hull pass dropped
(diff jumps) and the draw moved after edges (nodes/edges no longer
paint over the fill; per AGENTS.md, the scene is built so the hull
is *not* hidden under opaque bodies — translucent fill, visible
borders).  No v3 parity scene exists (v3 has no hulls) — goldens
plus the debug page are the coverage, recorded.  Files:
`src/render/hull-pipeline.mts`, `src/render/renderer.mts`,
`src/render/column-mirror.mts`, `src/render/shaders.mts`.

### 82.3 — hull labels, the harness, and the price

A fifth GlyphBuffer keyed by hull index, anchored top-center of
the hull, laid through the existing atlas/wrap path; far-zoom
behaviour is the LOD point of hulls, so hull labels are exempt
from the glyph fade floor (recorded; the per-hull count is tiny).
`debug/`: hulls toggle on `em-web` via `mcode_cluster_id`
(excluding 'None'), sanity-driven per code standard 5.  Bench: a
new `benchmark/hulls.mjs` row pricing per-frame hull recompute
under a synthetic drag on em-web (41 hulls) and a generated
500-cluster scene — each row **prints the hull count and total
member count it recomputed** (the row asserts the property it is
named for), plus an at-rest row proving a clean frame recomputes
zero hulls.  **Measure-first gate:** if the drag row shows hull
recompute above ~1 ms at the 500-cluster scale, geometry moves
from per-frame to a per-frame budget (stale hulls lag a frame)
before any GPU-side scheme is considered.  Docs: JSDoc (100%,
`@param`/`@returns`/`@throws` gated), `src/README.md` section,
MIGRATING row (bubblesets/automove → `cy.hulls`), CHANGELOG,
d.ts regenerated.  **The seam: the round can close here.**

### 82.4 — collapse/expand (model tier)

New `src/store/collapse-index.mts` (narrow-host again):
`parents.collapse( opts )` / `parents.expand()` /
`node.collapsed()` / `cy.collapsed()`.  Collapse: assert the
target is a parent (throw otherwise — fail loudly), `hide()` its
descendants, compute boundary-crossing edges (hidden-by-endpoint,
including meta-edges of already-collapsed inner parents, which
makes nesting compose), add aggregated meta-edges with
deterministic ids, emit `collapse`.  Expand: remove this parent's
meta-edges, `show()` descendants (their own collapsed sub-parents
keep *their* descendants hidden via own-state flags), re-aggregate
one level down, emit `expand`.  v1 rule, documented loudly: the
display tier of a collapsed parent's descendants belongs to
collapse — an app's own `hide()` under a collapsed parent is
overridden on expand (recorded deviation; revisit on demand).
**Verified by** Node specs: collapse/expand round-trip restores the
exact shown set and bounds; crossing-edge aggregation counts;
collapsed↔collapsed pair yields one meta-edge; nested
collapse/expand in both orders; every throw pinned; and a
`test:soak` churn spec (repeated collapse/expand cycles — the
meta-edge add/remove churn is profile 2 of the compaction
analysis, and the id blob/CSR meters must hold it).

### 82.5 — aggregation + the API surface priced

`aggregate: { sum: [...] }` semantics (absent values contribute
nothing; non-numeric values under a summed key throw — loudly,
not NaN), `collapsedCount` always written; directed pairs fold to
one meta-edge per unordered pair in v1 (Open below).  Bench: a
`benchmark/collapse.mjs` row collapsing all 41 em-web-clustered
parents and expanding them, printing the meta-edge count it
created (the discriminating property); a row against v3 +
expand-collapse extension is impossible in the Node tier (the
extension is browser-shaped) — the row prices v4 against its own
budget instead, recorded.  Goldens: collapsed em-web-clustered
scene + the control (expand ⇒ diff jumps); a hulls+collapse scene
proving a fully-hidden cluster's hull vanishes — the one coupling
wire, asserted where it lives.

### 82.6 — the close

Standing close: this record, `src/README.md` (Design decisions +
deviations: hull tier, collapse-owns-display rule, session-state
serialization), MIGRATING/CHANGELOG rows,
`EXECUTIVE_SUMMARY.md` rewritten, d.ts regenerated, gates green
(`test:js`, `test:modules`, `test:soak`, `test:throws` at zero,
JSDoc 100%, Playwright visual + renderer projects), bench runs
published serial `--repeat 3` with all bench-file edits batched so
each profile's fingerprint moves once.

### Risks named at planning

- The degenerate-fallback proxy depends on the parent's stashed
  style size and position surviving an all-hidden flip
  (`hierarchy.mts:371-377` reads current position) — a parent that
  was *never* positioned independently needs a defined collapsed
  position (children centroid at collapse time, written once).
  Pin it with a spec before building on it.
- Layouts likely move hidden nodes (finding 9) — a layout after
  collapse then expand may scatter revealed children.  Verify
  early; if true, the v1 answer is documentation (run layouts on
  shown subsets), not a layout change.
- The hull pipeline is a new always-first draw; a zero-hull graph
  must pay nothing (the ghost-pipeline precedent: skip outright at
  count 0) — assert it in the at-rest bench row.
- Stranded-doc-block hazard on the two new sidecars — run the
  JSDoc gate per commit.

**Open:** (1) Split confirmation: close after 82.3 and run
82.4–82.6 as the next round, or one long round?  (2) Should
collapsed/hidden state join the wire format (version 5) and
`json()` so collapse survives a round-trip, or stay session state?
(3) Hull pick surface: is click-a-hull (select members? an event
only?) wanted enough to justify a pick tier, and if so in which
round?  (4) Directed meta-edges: fold to one per unordered pair
(v1) or keep per-direction aggregates?  (5) Hull label text
source: is the per-value map enough, or is a second data key
(`labelBy`) wanted in v1?  (6) The SDF-blob concave hull: log as
an extension candidate (cyext, round 71) or keep as core v2?
