## The autonomous parity sprint

Scope criteria set with the user: this round is composed **only of items
whose design is already decided** (or is a mechanical v3 port) **and
that are easily verifiable in the existing harnesses** — Node
`test/*.mjs`, the `webgpu`/`visual` Playwright projects,
`benchmark/` — so the round can run autonomously as far as
possible.  Anything needing iterative design discussion is deferred and
logged (see the compaction section below and the deferred list at the
end).  Two design calls were made during planning:

- **Removed elements are terminally dead in v4** (recorded in
  `src/README.md`, "Design decisions"): only the handle's cached
  `id()`/`group()` survive removal.  This permanently closes
  `restore()`/`clone()`/`cy.json()` import — the needs-a-call entry
  above is closed.
- **Compaction is out of this round** — the motivation analysis is
  logged below with all policy calls left explicitly open.

Process (user-set):

- **Per-item cadence, full verify.**  Each item lands as its own
  isolated commit(s) on `v4`, gated on typecheck + lint + `test:js`
  (+ `test:modules` where relevant) + the relevant Playwright projects.
  Goldens are regenerated/added autonomously when a visual change is
  intended (`UPDATE_GOLDENS=1`), noted in the commit message.
- **Docs land in the same commit as the code they describe**:
  `src/README.md` (scope / deviations / design decisions) and this
  file's round record are updated per commit, not batched at the end.
- **Escalation rule**: if an item turns out to need a real design call
  mid-implementation, stop that item, log the question under "Needs a
  call", and move on to the next item — API semantics are never
  improvised autonomously.
- Perf-relevant items run the matching `benchmark/` sweep and
  record numbers here.

**Round complete (2026-07-27): all 17 items landed**, each as isolated
commits with docs in-commit and the full verification gate per item.
Net across the round: 1461 → 1629 Node tests, 33 → 44 `webgpu` + 7 → 14
`visual` Playwright specs (51 total), 7 new golden scenes, and
the full v3 algorithm surface, four more layouts, viewport animation
targets, data query predicates, ten node shapes, line styles, label
visuals, arrow shapes, edge labels, the gesture set, mount/unmount and
device-loss recovery in v4.

Items, in execution order — CPU-first (banks autonomous wins with zero
renderer risk), then shader/golden work, then interaction/lifecycle.
Each entry converts into a "Landed" record as it ships:

**Phase A — pure CPU, Node-testable**

- [x] **A1 Algorithms: search + paths** — landed 2026-07-27.
  `bfs`/`dfs` (+ `breadthFirstSearch`/`depthFirstSearch`), `dijkstra`,
  `aStar`, `bellmanFord`, `floydWarshall`, `kruskal` in
  `src/algorithms/` (a shared `SubgraphView` — dense node index +
  edge membership over the calling collection — plus an indexed
  binary min-heap in `algo-shared.mts`; one file per algorithm), all
  slot-native over CSR with dense typed-array state, no per-node
  string ids.

  v3 option/result shapes preserved, including the
  positional bfs/dijkstra forms, bfs's exact multi-root queue
  mechanics, bellmanFord's same-edge relax guard and canonical
  negative-cycle rotation, and pathTo edge cases (unreachable
  dijkstra target → `[target]`, unreachable bellmanFord target →
  empty).  v4 deltas: node args are collections (strings throw),
  missing required roots/goals throw, and cycle collections dedupe
  the closing node (v4 collections are sets).  39 specs in
  `test/algorithms.mjs` ported from the v3 fixtures (1500 Node
  tests total green).
- [x] **A2 Algorithms: structure** — landed 2026-07-27.
  `tarjanStronglyConnected` (+`tsc`/`tscc`/long alias; converted to an
  **iterative** DFS so deep graphs can't overflow the JS stack —
  component sets identical to v3's recursive form, verified against
  the v3 fixtures including exact component order),
  `hopcroftTarjanBiconnected` (+`htbc`/`htb`/long alias; recursive
  like v3, quirks preserved: parent edges skipped incl. parallels,
  non-cut vertices' edges absorbed), `hierholzer` (slot-keyed literal
  port; trail dedupes to first-traversal order as v3's does),
  `kargerStein` (index-based port; throws on <2 nodes as v3's error()
  does).

  Tests assert order-independent graph-theoretic results
  (blocks, cut vertices, Eulerian properties) where v3 pinned
  traversal-order sequences; 12 specs in
  `test/algorithms-structure.mjs` (1512 Node tests green).
- [x] **A3 Algorithms: pageRank + centralities** — landed 2026-07-27.

  `pageRank` (dense power method on Float64Arrays), `degreeCentrality`
  /`degreeCentralityNormalized` (+`dc`/`dcn`/`...Normalised`; Opsahl's
  alpha, loops counted on both directed sides as v3), `closeness
  Centrality`/`closenessCentralityNormalized` (+`cc`/`ccn`; harmonic
  default; dijkstra per root, floydWarshall for normalized),
  `betweennessCentrality` (+`bc`; Brandes over deduped neighbor lists
  with first-edge weight pick as v3, but a proper decrease-key heap so
  S is truly distance-ordered).  19 specs pin v3's exact numeric
  expectations (all matched, incl. the multiple-shortest-paths case);
  `test/algorithms-centralities.mjs` (1531 Node tests green).
- [x] **A4 Algorithms: clustering** — landed 2026-07-27.  `kMeans`,
  `kMedoids`, `fuzzyCMeans`/`fcm`, `hierarchicalClustering`/`hca`
  (threshold + dendrogram modes, `addDendrogram`), `markovClustering`/
  `mcl` (Float64Array matrices), `affinityPropagation`/`ap`, plus the
  shared `clustering-distances` metric module.  The attribute-space
  algorithms stay handle-level like v3 (they're feature-space, not
  adjacency walks); markov builds its matrix off the slot view.

  v3
  quirks preserved: raw-option validation for affinity (damping and
  preference effectively required), the 2-arg custom distance form
  when no attributes are given, kMedoids' k>n throw.  25 specs pin the
  v3 fixtures' numeric expectations (k-means/k-medoids/fcm/markov
  cluster memberships in exact order, dendrogram levels 0–10);
  affinity gets a compact deterministic fixture instead of v3's
  700-line one.  `test/algorithms-clustering.mjs` (1556 Node tests
  green).
- [x] **A5 Algorithm benchmark** — landed 2026-07-27.
  `benchmark/algorithms.mjs` (standalone Mitata sweep; superlinear
  ops gate on BENCH_N).  At N=2000 (4k edges) the slot-native walks win
  every op vs v3: bfs 34×, dfs 39×, dijkstra+pathTo 33×, bellmanFord
  22×, kruskal 14×, tarjan SCC 19×, hopcroft-tarjan 20×, betweenness
  13×, degreeCentralityNormalized 22×, closenessCentrality 31×, aStar
  2.1×, hierholzer 2–3×.  The dense-matrix ops are parity, as expected
  (identical math dominates): pageRank/floydWarshall/markov/
  hierarchical/kMeans all within ±1.2× at N=500.
- [x] **A6 Layouts** — landed 2026-07-27.  `circle`, `concentric`,
  `breadthfirst`, `random` (handle-level ports of the v3 math — these
  layouts are per-node-callback-shaped, unlike grid's slot path), plus
  the v3 plumbing on the collection: `layoutDimensions`,
  `layoutPositions` (spacingFactor scaling, `transform`, fit/zoom/pan,
  the layoutstart/ready/stop event flow, and `animate: true` via the
  existing animation system — handle-memoized, `animateFilter`
  honored; the fit applies at layoutstop until A7's animated fit), and
  `eles.layout()`/`makeLayout`/`createLayout` (grid and preset honor
  `eles` scoping too, incl. fit-to-eles).

  Two corrections vs the
  repo's v3 files, both noted in code: circle calls layoutPositions on
  the *sorted* collection (upstream v3 behavior — the repo's TS port
  calls it on the unsorted one, so `sort` does nothing there), and
  breadthfirst compacts the nulls left by maximal shifts before
  sorting a depth (v3 passes them into its comparator).  28 specs in
  `test/layouts.mjs` (1584 Node tests green).
- [x] **A7 Viewport animation targets** — landed 2026-07-27.
  `cy.animate`/`cy.animation` (the handle form is new, mirroring
  `eles.animation`) take `fit: { eles | boundingBox, padding }` and
  `center: { eles }`, resolved to concrete pan/zoom at creation time
  (v3 semantics — pinned by a spec that moves a node after creating
  the animation); fit/center bypass the pan/zoom gating flags, like
  `fit()` itself.

  `eles.boundingBoxAt(posOrFn)` landed with it
  (side-effect-free direct computation, edges spanning out-of-
  collection endpoints at current positions) — pulled forward from A9
  because the animated layout fit needs it: `layoutPositions` with
  `animate: true` now animates the viewport to the final arrangement's
  box concurrently with the node tweens, exactly v3's shape (the A6
  fit-at-layoutstop compromise is gone).  Note: v3's animated
  `fit()`/`center()` *options* don't exist in v3 either — the target
  form is the parity surface.  9 specs in
  `test/viewport-animation.mjs` (1593 Node tests green).
- [x] **A8 Data query predicates** — landed 2026-07-27.  `Query`
  gains `data: { key: value | { eq/ne/lt/lte/gt/gte/in } }` (bare
  value = `eq`; keys AND together), compiled to `CompiledCondition[]`
  on the plan and evaluated with the *same* `testCondition` the `case`
  mapper uses (missing value fails every op, `ne` included; exactly
  one op per condition; `in` non-empty; ordinal ops numeric — all
  throwing as the mapper does).  The whole-graph scan
  (`scanRefsInto`) takes the tests with per-key column readers hoisted
  out of the loop (`DataStore.reader`); the collection-filter and
  `planMatchesRef` paths apply them too.  10 specs in
  `test/query-data.mjs` (1603 Node tests green).
- [x] **A9 Small items** — landed 2026-07-27.  (`boundingBoxAt` landed
  with A7.)  `padding()`/`paddedWidth`/`paddedHeight`: accessor-only —
  v4 has no `padding` style prop (compounds-era), so padding reads 0
  and padded dims equal plain dims; kept so v3 call sites work.
  **`cy.serialize()`**: live-graph export to the wire ArrayBuffer
  (ids, positions, selected/selectable flags, and the data() sidecar
  via `DataStore.exportColumns` — numbers as f64+NaN holes, strings as
  dictionary columns, mixed as arrays), round-tripping through
  `options.elements`/`cy.add()`; 7 Node specs incl. selection state,
  post-load mutations and empty graphs.

  **Web-font re-raster hook**:
  the renderer listens for `document.fonts`'s `loadingdone` and
  re-rasters the atlas + rebuilds all glyph runs (`GlyphAtlas.
  reraster`, `store.markAllLabelsDirty`), closing 9.7's
  cached-fallback-glyph footgun; removed on destroy.  Playwright spec
  registers a FontFace *after* the label renders and pins the pixel
  change (an @font-face family can't test this — the atlas's own
  canvas use starts its load).  Verified: 1610 Node + 47 module tests,
  34 webgpu + 7 visual Playwright specs on a fresh bundle
  (note: a stale http-server on :3333 silently serves an old bundle to
  Playwright — kill it before trusting a run).

**Phase B — renderer/shader work, golden-verified**

- [x] **B1 Node shape parity** — landed 2026-07-27.  Ten polygon
  shapes (`triangle`, `pentagon`, `hexagon`, `heptagon`, `octagon`,
  `diamond`, `rhomboid`, `vee`, `star`, `tag`, + `square` alias) from
  **one point-table source of truth** (`shape-points.mts`, built with
  the same shared math generators v3's node-shapes registration uses —
  identical geometry).

  Shape ids 4–13 in `contract.mts`; WGSL
  per-shape SDF functions are *generated* from the tables (iq's
  sdPolygon, vertices scaled by half-size so the device-space distance
  is exact — first cut evaluated in normalized space and showed
  smeared borders on stretched nodes in the golden; exact-space fixed
  it); CPU pick uses exact point-in-polygon in normalized space
  (inside-ness is affine-invariant); the depth prepass treats polygon
  interiors via their SDF (conservative rect/roundrect/ellipse
  fast paths kept).

  `round-*` polygon variants deliberately not
  ported (no clean closed form under anisotropic scale) along with
  cut-rectangle/barrel/etc — README records the list.  Verified: 5
  polygon CPU-pick specs (incl. concave star/vee and an anisotropic
  hexagon), keyword parse+readback specs, and a `polygon-shapes`
  golden (11 nodes incl. a selected star's accent ring and a stretched
  hexagon), stable across repeat runs; 1617 Node + 47 module tests,
  42 Playwright specs green.
- [x] **B2 `line-style: solid | dashed | dotted`** — landed
  2026-07-27.

  New `edge.lineStyle` column (contract LINE_* ids) with
  the full style plumbing (keyword parse, case mappers, stored-truth
  readback); the edge VS emits a model-px longitudinal varying and a
  flat style id, and the FS applies an AA'd dash mask (v3's patterns:
  dashed [6, 3], dotted [1, 1], model units so dashes zoom with
  content).  Picking ignores gaps as v3 does; the pick FS is
  untouched.  `border-style` skipped per the plan's stretch clause
  (dashing an SDF boundary needs perimeter parameterization) — README
  records it.  `line-styles` golden (three styles + a wide diagonal
  dashed edge proving the pattern runs along the edge); 1618 Node +
  47 module tests, 43 Playwright specs green.
- [x] **B3 Label visuals** — landed 2026-07-27.  `text-outline-width`/
  `-color`/`-opacity` (second SDF threshold in the label FS; width
  precomputed CPU-side into SDF sample units), `text-background-color`
  /`-opacity`/`-padding` (a solid quad instance preceding the run's
  glyphs — a negative-u0 sentinel skips the atlas sample; it carries
  the glyph block's height so LOD fade/cull match the text exactly),
  `text-margin-x/y` (margin-y folds into the anchor; both kept in the
  entry for readback).  All eight props are **mapper-capable** (added
  to the MAPPABLE table; `applyMapped` writes whole elements so the
  label sidecar rebuilds through the existing path).

  Glyph instances
  grew 40 → 48 bytes (outline color + width).  Two WGSL
  uniform-control-flow traps hit and fixed: `textureSample` and
  `fwidth` both hoisted above the solid-quad branch (caught by the
  validation-error guard).  `label-visuals` golden (outline, boxed,
  margin-shifted) at the label tolerance tier; 1619 Node + 47 module
  tests, 44 Playwright specs green.
- [x] **B4 Arrow shape parity** — landed 2026-07-27.

  `vee`,
  `chevron`, `circle`, `square`, `diamond`, `tee` (+ the `arrow`
  alias), with WGSL SDFs generated from v3's arrow point tables
  (shared `ARROW_POINTS` in shape-points.mts; tip-at-origin frame,
  uniform scale — v4's arrow sizing turns out to be exactly uniform:
  halfBase/0.15 == arrowLen/0.3).  The arrow FS now evaluates a
  shape SDF in the arrow-local frame instead of the triangle's
  lateral-taper mask (the triangle's geometry is unchanged, only its
  AA method — nodes-edges-arrows golden regenerated); shape ids pack
  source|target<<8 into a new `edge.arrowShapes` column bound
  **fragment-only**, keeping the arrow VS at its 8-storage-buffer
  budget.  Readback keeps the stored-truth rule (transparent arrow →
  shape 'none'), now returning the real keyword otherwise.  Compound
  shapes not ported (README lists them).  `arrow-shapes` golden (7
  target shapes + a source-end chevron pinning the byte order);
  1621 Node + 47 module tests, 45 Playwright specs green.
- [x] **B5 Edge labels pass 1** — landed 2026-07-27, exactly the
  logged shape.  Model: the label sidecar, label-dirty channel and
  `setLabel`/`labelAt`/`takeLabelDirty` are **group-keyed** (trailing
  group param defaulting to 'nodes', so node call sites read
  unchanged); StyleEngine's label channels — the passthrough `label`,
  `font-size`, `color` and all the B3 text visuals — now compile for
  edges too (the edge write path calls the shared `writeLabel`, edges
  centering on the midpoint by font size).

  Renderer: a second
  GlyphBuffer in the LabelLayer, an `edgeGlyph` cull kind (predicate =
  edge SHOWN + both endpoints SHOWN + fade/min-height + viewport at
  the midpoint), and the label shader generated for both streams from
  one template — the edge variant binds `edge.endpoints` and computes
  the **midpoint anchor in the VS**, so edge labels follow drags/
  layouts/position tweens on-GPU with zero rebuild (spec-pinned: an
  endpoint move re-uploads ≤64 B and the label lands at the new
  midpoint).

  Also fixed en route: a hardcoded 40-byte glyph stride in
  the renderer's cull-capacity math (stale since B3's 48-byte
  instances; benign over-allocation) now uses GLYPH_BYTES.  Horizontal
  only — autorotate stayed the separate follow-up (since landed
  2026-07-29; see the autorotate entry below).  7 model specs
  (`test/edge-labels.mjs`), the follows-drag webgpu spec, and an
  `edge-labels` golden (midpoint + background box on a diagonal edge);
  1628 Node + 47 module tests, 47 Playwright specs green (twice).

**Phase C — interaction & lifecycle, Playwright-verified**

- [x] **C1 Gesture parity** — landed 2026-07-27.  Right button:
  `cxttapstart`/`cxtdrag`/`cxttapend` + `cxttap` (no-move), with the
  canvas context menu suppressed; `taphold` after a 500 ms unmoved
  press; `dbltap` on a same-target second tap within
  `cy.multiClickDebounceTime()` (default 250 ms; new ctor option +
  validated getter/setter) plus the debounced `onetap`; and
  drag-all-selected — grabbing a selected node collects every
  draggable selected node into a drag set moved by one bulk `shift`
  per pointermove (all flagged grabbed, unflagged on release/cancel).

  Verified by two Playwright specs (the event-order cxttap/dbltap/
  taphold sweep and a three-node drag-set spec) + a Node accessor
  spec; 1629 Node + 47 module tests, 49 Playwright specs green
  (serial run; parallel runs on this loaded machine flake one
  arbitrary visual spec — an env issue, not a code one).
- [x] **C2 `mount`/`unmount`** — landed 2026-07-27.

  The factory's
  renderer+pointer wiring moved into a reusable `_attachFn` on the
  core (with the WebGPU-availability check at attach time);
  `unmount()` destroys pointer + renderer and the instance reads
  headless with a resolved `ready`; `mount(container)` re-attaches a
  fresh renderer — the new ColumnMirror's from-zero realloc re-uploads
  every column, and `markAllLabelsDirty()` requeues every glyph run
  (the old LabelLayer had consumed the dirty channel).  Same-container
  re-mount no-ops; a different container unmounts first;
  `cy.destroy()` now also tears the pointer down.  Playwright spec:
  render → unmount (headless, canvas removed, png rejects) → move/
  relabel/add while headless → mount → the moved node, its rebuilt
  label, and the headless-added node all render.  1629 Node + 47
  module tests, 50 Playwright specs green (serial).
- [x] **C3 Device-loss recovery** — landed 2026-07-27, with the
  proposed policy recorded as the decision: an external loss emits
  `devicelost` and auto-recovers **once per loss** by re-mounting a
  fresh renderer against the same container via C2's machinery (the
  model is CPU-canonical, so mirrors/pipelines/glyph runs all
  rebuild), then emits `devicerestored`; a loss during recovery or a
  failed re-acquisition goes headless-dead + `error` (the previous
  behavior).

  Plumbing: `gpu-context` now surfaces *every* loss and
  the renderer distinguishes its own teardown by its `destroyed` flag
  (so `renderer.destroy()` stays silent); a `_debugLoseDevice()` test
  hook destroys the device externally.  Playwright spec: lose the
  device → `devicelost` → `devicerestored` → post-loss writes render.
  1629 Node + 47 module tests, 51 Playwright specs green (serial).

Deferred out of this round (logged, not built): compaction (below;
the slot-stable tier since landed as round 11, the slot-moving tier
as round 19); autorotated edge
labels (since landed 2026-07-29); multiline labels (since landed,
round 16); bezier edges
(round-12 plan written; passes 12a/12b/12c since landed — round 12
is complete);
compounds (since landed, round 14);
z-index (since dropped by decided design, 2026-08-01); GPU layouts
(since landed, round 18); size tweens (the R8.5 geometry seam);
`renderTo`;
restore/clone/json-import (closed — not in v4); the three-finger touch
box gesture (since landed, round 20.5).
