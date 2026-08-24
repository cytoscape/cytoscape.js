# Changelog

All notable changes to Cytoscape.js are recorded here. This file starts at
the 4.0 line; for the 3.x history see the [releases
page](https://github.com/cytoscape/cytoscape.js/releases).

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [semantic versioning](https://semver.org/).

---

## [Unreleased] — 4.0.0

v4 is a rewrite of the model and the renderer. The public API keeps v3's
*shape* — `cy.add()`, `eles.filter()`, `node.position()`, the traversal and
algorithm surfaces, the alias spellings — while several v3 mechanisms were
removed rather than reimplemented.

**Porting a v3 app: read [`MIGRATING.md`](MIGRATING.md).** It carries the
recipe tables, the measured property-by-property diff, and the list of things
that compile and then behave differently.

> Not released. `cytoscape@3` remains the released library.

### Added

- **A columnar, CPU-canonical model.** Elements live in typed-array columns
  with stable slots, per-column coalesced dirty spans, a CSR adjacency index
  and a dictionary-encoded `data()` sidecar. Reads stay synchronous.
- **A WebGPU renderer**: SDF node shapes, curved-edge families evaluated in
  the vertex stage from live positions, compute culling with indirect draws,
  GPU picking with a synchronous CPU fast path for nodes, an SDF glyph atlas,
  early-z, and an adaptive render scale.  Gestures hit-test with v3's
  halos (8/24 rendered px around edges for mouse/touch, 2/8 around
  nodes), arrowheads are hit targets (hollow counts as filled, as in
  v3), and pressing any element — edges included — shows v3's `:active`
  overlay; `cy.pick( x, y )` stays exact.
- **`cy.$()` is back** (round 64) as a plain alias of `cy.filter()`
  over the query/predicate forms (selector strings still throw), and
  **`cy.byId()`** joins `$id`/`getElementById` as the brevity id
  lookup.  **`cy.collection()` now throws if passed any argument** —
  it used to silently ignore one where v3 builds from it.
- **Per-element bypasses** (round 63): the stylesheet's `bypasses`
  section — `{ bypasses: { id: { prop: constant } } }` — with v3's
  method spellings as sugar (`ele.style( name, value )`, the object
  form, `removeStyle( name? )`, `removeCss`).  A bypass beats every
  sheet rule (default-sheet selection included), survives remove/
  re-add of its element, and exports from `cy.json()` — better than
  v3, which drops bypasses on export.  Constants only; a full
  `cy.style( sheet )` replaces the section (spread the exported sheet
  to keep it).  Style prop keys accept dash-case and camelCase
  everywhere (`foo-bar` ≡ `fooBar`), the bypasses included.
- **Structured queries and predicates** replacing the selector language —
  `cy.nodes( { selected: true } )`, `cy.nodes( { data: { w: { gt: 1 } } } )`,
  and plain functions for everything richer.
- **Element state is a style condition**, which is what replaces v3's state
  selectors: `{ when: { selected: true } }`, `{ active: true }`,
  `{ locked: true }`, `{ grabbed: true }` and the rest, on any property.
  Each takes a boolean, so v3's negative selectors are the same key with
  `false`, and the same keys work as query keys. v4's default stylesheet
  carries v3's `:selected`, `:parent:selected` and `:active` blocks, spread
  before your own — so declaring the property replaces the rule, exactly as
  in v3.
- **A serializable mapper DSL** for style: `linear`/`log`/`sqrt`/`pow`/
  `symlog`/`diverging`/`ordinal`/`threshold`/`quantize` scales, OKLab colour
  interpolation with named schemes, and `case` conditionals. Paint channels
  evaluate in a compute kernel; anything read by culling, picking or a
  columnar scan stays CPU-canonical.
- **Columnar and binary loading.** `cytoscape.toColumnarElements()`,
  `cytoscape.serializeElements()` / `deserializeElements()`, both accepted
  directly by `options.elements` and `cy.add()`. Numeric columns deserialize
  as zero-copy views.
- **Style transitions** (`transition-property`/`-duration`/`-delay`/
  `-timing-function`) and animation controls (`pause`/`resume`/`reverse`,
  read-only `progress`/`paused`).
- **The `force` layout** — GPU-native force-directed layout, animating live
  at 100k nodes, with a CPU reference executor for headless and compound
  graphs; spectral (landmark-MDS) initial placement, degree-normalised
  springs, grid-pyramid long-range repulsion, per-compound gravity and
  nesting (`gravityCompound`, `nestingFactor`), and component packing
  (`componentSpacing`).
- **A registry-free extension contract**: `cy.layout( { impl } )` runs an
  imported class or object; `LayoutContext` is columnar-first, and it,
  `LayoutImpl` and `CustomLayout` are exported types, so an external layout
  author writes against real types rather than `any`.
- **Border and outline stroke styles on every shape** — `border-style`
  (`solid`/`dashed`/`dotted`/`double`, with v3's erase behaviour for
  `double`), `outline-style`, and `border-dash-pattern`/`-offset`. Dash
  patterns follow each shape's outline with the phase anchored where v3's
  canvas path starts, including exact elliptic arc length.
- **`chart`** — v3's 101 numbered pie/stripe properties as one list-valued
  family with data-driven values, scheme palettes and donut holes.
- **`visibility`** as a paint-only style property beside the structural
  `show()`/`hide()`.
- **Slot compaction** — `cy.compact()` (alias `cy.gc()`) plus an automatic
  trigger, shrinking scan widths and buffers to the current graph rather than
  its peak.
- **`boxSelectionMode`** (`'contain'` | `'overlap'`),
  `boxSelectionIncludesLabels`, `wheelSensitivity`, `desktopTapThreshold`,
  `touchTapThreshold`, `tapholdDuration`.
- **`eles.labelBoundingBox()`**, and labels join `boundingBox()`/`fit()` by
  default.
- **TypeScript declarations** built from the source JSDoc, so the API
  documentation is hover text in an editor.
- **GPU executors for the expensive whole-graph algorithms** (round 65).
  `markovClustering`, `affinityPropagation`, `pageRank`,
  `floydWarshall`, `betweennessCentrality`, `kMeans`, `kMedoids`,
  `fuzzyCMeans` and `hierarchicalClustering` accept
  `executor: 'cpu' | 'gpu' | 'auto'` (default `'auto'`): the CPU is
  the bit-reproducible reference, the GPU runs WGSL compute kernels
  where WebGPU exists, and `'auto'` picks per measured per-family
  crossovers.  Measured on an RX 570-class adapter: Markov clustering
  up to 663× (31.3 s → 47 ms at 1,024 nodes), k-medoids up to 146×,
  fuzzy c-means up to 70×, Floyd–Warshall up to 28×, betweenness up
  to 18×, k-means up to 25×.  PageRank and hierarchical clustering
  route to the CPU under `'auto'`: the CPU PageRank iterates sparsely
  (O(E) per iteration — orders of magnitude on sparse graphs) and the
  hierarchical merge engine went flat-typed, leaving the GPU no edge
  to win there.
- **Eight new algorithm families, designed matmul-first for the GPU
  tier** (rounds 69–70), all on the same async `executor` contract
  and with no v3 counterpart.  Round 69: **`eles.triangleCount()`**
  (per-node triangle counts, local clustering coefficients, total
  triangles and transitivity — A²∘A on the GPU),
  **`eles.neighborhoodSimilarity()`** (pairwise Jaccard / cosine /
  overlap coefficients over neighbor sets — A·Aᵀ on the GPU) and
  **`eles.katzCentrality()`** (attenuated walk counting; like
  PageRank its sparse CPU iteration owns `'auto'` and the GPU path
  serves an explicit `'gpu'`).  Round 70, aimed at network-biology
  workloads: **`eles.randomWalkWithRestart()`** (seed-set network
  propagation — the disease-gene-prioritization primitive) and
  **`eles.randomWalkWithRestartProximity()`** (the all-pairs
  proximity matrix, a Neumann matmul iteration on the GPU),
  **`eles.heatDiffusion()`** / **`eles.heatKernel()`** (HotNet-style
  heat propagation; exp(−t·L) by scaling-and-squaring on the GPU),
  **`eles.effectiveResistance()`** (resistance distance and commute
  time off the Laplacian pseudo-inverse — f64 elimination on the CPU,
  Newton–Schulz matmul iteration on the GPU; O(n³) on both sides, so
  the GPU wins at every density), **`eles.simRank()`** (the Jeh–Widom
  recursive similarity, two matmuls per iteration) and
  **`eles.motifCensus()`** (the sixteen-class Holland–Leinhardt triad
  census — '030T' is the feed-forward loop — computed from seven
  trace primitives and pinned by a brute-force classifier spec).
  The whole-collection `closenessCentralityNormalized` joined the
  async tier in round 69: its GPU path rides the blocked
  Floyd–Warshall kernels and folds each distance row on the device,
  reading back n floats instead of the n² matrix.

### Changed

- **The stylesheet is `{ nodes, edges, parents, core }`** — an object of
  property objects, not a list of selector blocks. State-dependent styling
  is a `case` condition rather than a `:selected`-style block.
- **Draw order is structural** and stays that way: compound parents, then
  edges, then leaf nodes, then labels; slot order within a stream.
- **Animations run concurrently by channel** and sequence by promise;
  overlapping channels evict the older animation in place.
- **The expensive whole-graph algorithms are async** (round 65; the
  closeness family joined in round 69): the executor-tier methods
  above return promises — `await` the call, then use the result
  exactly as in v3.  Runtime option validation on them surfaces as a
  rejection; a bad `executor` value still throws synchronously.  The
  traversal tier (`bfs`, `dfs`, `dijkstra`, `aStar`, `bellmanFord`,
  `kruskal`, components, degree centrality and the single-root
  `closenessCentrality`) stays synchronous; only the O(n³)
  whole-collection `closenessCentralityNormalized` moved.
- **`hierarchicalClustering`'s `mean` linkage works** (round 65.10) —
  a deliberate deviation: v3's mean linkage never assigned the cluster
  sizes its weighted-average formula read, so the first mean merge
  produced NaN distances and the linkage silently degenerated.  v4
  tracks sizes; `mean` is the weighted-average linkage the docs always
  claimed.
- **Colours tween in OKLab**, matching the mapper default (v3 tweened
  per-channel in sRGB).
- **`spring( bounce )`** replaces `spring( tension, friction )`.
- **Default `curve-style` is `straight`** (v3: `bezier`), and default
  `text-valign` is `bottom` (v3: `top`).
- **`cy.elements()` returns nodes then edges**, not mixed insertion order.
- **Positions are Float32** (~7 significant digits).
- **Compound event bubbling** is v3's, with the remaining ordering deviation
  confined to within a phase (registration order).
- **`stop( jumpToEnd )`** — the `clearQueue` argument is gone with the queue.
- **`font-family`, `font-style`, `font-weight` are global constants**, one
  face per glyph atlas.
- **Rendering requires WebGPU**; headless requires nothing.

- **Comparing elements across two instances throws** instead of answering
  wrongly. Element identity is a slot in *one* store, so the first node of
  one graph and the first node of another used to compare as the same
  element: `same()` returned true, `intersection()` returned everything,
  `difference()` returned nothing, and `union()` silently dropped the other
  graph's elements. The twelve affected methods (`same`, `anySame`,
  `contains`, `indexOf`, `union`, `difference`, `intersection`,
  `symmetricDifference`, `diff`, `allAreNeighbors`, `edgesWith`, `edgesTo`)
  now reject a collection from another instance.
- **A corrupt binary payload fails fast** rather than allocating for what it
  declares. Three cases found by fuzzing — an out-of-range dictionary index,
  an over-long packed-id blob length, and an impossible data-key count —
  could hang a load or take tens of seconds before erroring; each now throws
  a contract error naming the field.

### Removed

- **The round-90 API review's parity baggage**: `cy.forceRender()`,
  `cy.batchData()`, `cy.mutableElements()` (it was `elements()` by
  another name), `onRender`/`offRender` (use `cy.on( 'render', … )`),
  and the `bind`/`unbind`/`listen`/`unlisten` listener aliases — the
  event surface follows Node's `EventEmitter` spellings, plus `pon`.
  Demoted rather than removed (working, but `@internal` and out of the
  typed surface): `cy.renderer()` — `cy.stats()` is the public
  frame-stats snapshot in its place — `instanceString()`, the
  `silentPosition(s)`/`silentShift` writes, the `StyleEngine` and
  animation machinery, and the `Viewport` class.
- **Selector strings**, everywhere — and `cy.$()` with them (`cy.$id()` is
  the id lookup). Passing one throws, naming the replacement.
- **Classes** (`addClass`/`removeClass`/`toggleClass`/`hasClass`/
  `flashClass`) — `data()` plus mappers is the replacement.
- **Style functions** (`( ele ) => props`) throw; per-element bypasses
  are back since round 63 (see Added), spelled as in v3 and canonically
  the stylesheet's `bypasses` section.
- **CSS-string stylesheets** and `cytoscape.stylesheet()`.
- **`z-index`**, `z-compound-depth`, `z-index-compare`, `sortByZIndex`,
  `zDepth`.
- **`restore()`, `clone()`, `copy()`** and the import form of `cy.json()`:
  removed elements are terminally dead.
- **The animation queue**, the `queue` option and the `step` callback (all
  three spellings throw).
- **Custom easing functions** — `cubic-bezier()` and `linear()` cover any
  drawable curve.
- **Event namespaces**: a type is matched whole, so `'tap.ns'` is one literal
  name.
- **The `vmouse*` aliases and raw mouse/touch re-emits** (`mousedown`,
  `click`, `touchstart`, …) — `pointer*` is their modern spelling.
  `mouseover`/`mouseout` still fire. *These names still register and then
  never fire*, because custom event names must stay legal.
- **`cy.notify()` / `noNotifications()`** — the renderer is dirty-driven.
- **`renderTo`**; per-element `font-family`; viewport-fixed labels.
- **The canvas-era performance options** — `hideEdgesOnViewport`,
  `textureOnViewport` (+ `outside-texture-bg-*`), `motionBlur`,
  `motionBlurOpacity`.
- **Style properties**: `background-blacken`, `bounds-expansion`, `content`,
  `padding-{left,right,top,bottom}`, `position`, `display`, `text-metrics`,
  `box-selection`, `box-select-labels`, `edge-text-rotation`, the
  `min-*-bias-*` quartet, the singular `control-point-distance`/
  `segment-distance`/`segment-weight`/`segment-radius` spellings, the
  `mid-*-arrow-fill`/`-width` pairs, and the numbered `pie-N-*`/`stripe-N-*`
  families. The no-dash shape spellings (`roundrectangle`, `cutrectangle`,
  `concavehexagon`) throw in all three enums that took them.
- **The `cose` layout** — not ported; `force` is v4's answer.
- **The extension registry** — no `cytoscape.use()`; extensions are imports.

### Not yet implemented

- `text-border-style` (the label box border does not dash).
  `border-style`/`outline-style` and `border-dash-pattern`/`-offset`
  themselves work on every shape; `border-cap`/`border-join` are dropped
  (dash ends are perpendicular cuts by construction).
- Core, collection and renderer extension points.

Decided against rather than pending: `cytoscape.warnings()` (errors throw
and warnings warn, with no toggle over either — the fail-loudly contract
stands whole) and functional `preventDefault()` for v4's own gesture
defaults (the explicit toggles are the gesture-control surface; the call
reaches the browser's default only).

### Known deviations

Accepted differences from v3's rendering and semantics — arrow tips on
approximate boundaries for some shapes, butt caps on layer strokes, outline
dash phase on polygon-family shapes, a conservative edge-label bounding term, no
decimation on the curved edge stream, and others — are enumerated in
`src/README.md` under "Known deviations from v3". Each is recorded where the
feature is described, with the reason.

One is worth naming here because it is visible in ordinary styling: v3 makes
a hollow or translucent arrowhead read as one shape with its edge by erasing
the head's footprint from the canvas, and v4 shortens the line instead — no
extra pass, and the same pixels wherever the head covers the line. It does
not reach **mid arrows**, which sit mid-line, so `arrow-fill: hollow` on a
`mid-source`/`mid-target` head still shows the line through it.
