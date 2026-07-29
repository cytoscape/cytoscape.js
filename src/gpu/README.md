# Cytoscape.js GPU prototype (`src/gpu`)

First pass of the v4 performance redesign spec'd in
[#3486](https://github.com/cytoscape/cytoscape.js/issues/3486): a separate
prototype core with a **CPU-canonical columnar model** (typed-array columns,
stable slots, per-column coalesced dirty spans) written through to
**persistent GPU buffers**, rendered by a **WebGPU pipeline** (SDF node
shapes, straight edges reading endpoints from the node position buffer
on-GPU, GPU picking, compute culling + indirect draws + LOD).  The
existing v3 core, collection and renderers are untouched.

Culling: a compute pre-pass per group (nodes, edges, glyphs) compacts the
drawable slots into a visible list + `drawIndexedIndirect` args — a
deterministic three-dispatch stream compaction that preserves slot order
(the in-group z-order), with an exact segment-vs-rect test for edges — so
the render pass draws exactly what's visible instead of running the vertex
shader over every allocated slot.

- Entry point: `cytoscapeGpu(options)` from `src/gpu/index.mts`
  (`import cytoscapeGpu from 'cytoscape/gpu'`, UMD global `cytoscapeGpu`).
- Headless-friendly: without a `container` no GPU is required (Node-testable).
  With a `container`, WebGPU is mandatory — the factory throws synchronously
  when `navigator.gpu` is missing, and `.ready` rejects when no adapter can
  be acquired.
- `contract.mts` is the co-signed source of truth for the column/flag layout
  shared by the model (`store/`) and the renderer (`render/`) — change it
  first when the layout changes.
- Manual testing: `npm run watch` → http://localhost:3333/webgpu/.
  Browser tests: the `webgpu` Playwright project, plus the
  `webgpu-visual` project — golden-image diffs (pixelmatch against PNGs
  in `playwright-tests/goldens/`, pinned to the SwiftShader adapter so
  the goldens are machine-independent; regenerate intended changes with
  `UPDATE_GOLDENS=1`) and live v3-vs-v4 parity diffs
  (`playwright-page/parity.html` renders both renderers side by side —
  no v3 baselines are checked in).  A WYSIWYG self-diff spec pins
  `png()` to the on-screen pixels.  On Linux both Chromium projects add
  ANGLE-on-Vulkan compositing flags (see `playwright.config.js`) —
  without them Dawn renders fine but WebGPU canvases *present* blank in
  headless Chromium (adapters acquire, composited pixels stay
  transparent); the flags are Linux-gated because `--use-angle=vulkan`
  does not exist on macOS (Metal).

## API scope (pass 1)

Core: viewport fns (`zoom`, `pan`, `panBy`, `fit`, `center`, `extent`,
plus `reset`, `viewport`, `zoomRange`, `getFitViewport`/`getCenterPan`,
`renderedExtent`, `size`), events (with the usual aliases +
`onRender`/`offRender`; delegation via predicate functions), graph
manipulation, `style()` (the `{ nodes, edges }` sheet), `layout()`/
`makeLayout` (grid, preset, circle, concentric, breadthfirst, random —
plus `eles.layout()` for subset scopes and the v3 `layoutPositions`
plumbing with spacingFactor/transform/animate — an animated layout
fits by animating the viewport to the box at the *final* positions,
concurrently with the node tweens), `pick()`, `png()`/`jpg()` (async image
export — see the design decisions below),
`renderer()`/`forceRender()`/`resize()`, graph-level
`data()`/`scratch()`, batching (`startBatch`/`endBatch`/`batch`/
`batchData`/`batching` — see below), `json()` (export-only),
box selection (`elementsInBox` + the pointer gesture) and
`selectionType`, interaction gating
(`autolock`/`autoungrabify`/`autounselectify`,
`panningEnabled`/`zoomingEnabled` + `user*` variants,
`boxSelectionEnabled`), introspection (`instanceString`, `isReady`,
`headless`, `mutableElements`, `hasElementWithId`/`$id`, `options`),
`destroy()`, `width()`/`height()`.
Collections: `cy()`/`renderer()`/`element()`, events, graph
manipulation (incl. edge `move()`), position/dimensions (model +
rendered, `shift`, silent variants, edge `midpoint`/endpoints),
iteration (`sort`, `reduce`, `max`/`min`), comparison, building/
filtering (`byGroup`, `diff`, `absoluteComplement`, set aliases),
traversal (`outgoers`/`incomers`, `roots`/`leaves`,
`successors`/`predecessors`, `edgesWith`/`edgesTo`,
`parallelEdges`/`codirectedEdges`, `components`), degree
(`degree`/`indegree`/`outdegree` are singular first-element accessors as
in v3 — the whole-collection sum is `totalDegree` — plus min/max stats),
`select`/`unselect`/`selectify`, `grabbable`/`lock`,
`active`/`activate`, `pannable`/`panify`,
`show`/`hide`, `data()`/`scratch()`/`json()`, `label()` (read-only),
read-only style getters (`style`/`css`, `renderedStyle`,
`numericStyle`, `effectiveOpacity`/`transparent`/`takesUpSpace`/
`interactive` — see below), and graph algorithms (round 10, growing):
`bfs`/`dfs` (+ long aliases), `dijkstra`, `aStar`, `bellmanFord`,
`floydWarshall`, `kruskal`, `tarjanStronglyConnected` (+`tsc` etc.,
iterative — deep graphs cannot overflow the JS stack),
`hopcroftTarjanBiconnected` (+`htbc` etc.), `hierholzer`,
`kargerStein`, `pageRank`, `degreeCentrality`/`dc` (+normalized),
`closenessCentrality`/`cc` (+normalized), `betweennessCentrality`/`bc`,
`kMeans`, `kMedoids`, `fuzzyCMeans`/`fcm`, `hierarchicalClustering`/
`hca`, `markovClustering`/`mcl`, `affinityPropagation`/`ap`
— the full v3 algorithm surface.  Graph walks are slot-native over the
CSR adjacency; the attribute-space clustering algorithms work on
handles as v3 does.  v3 option/result shapes are kept, except that
node arguments are collections (selector strings throw) and
`weight`/`heuristic`/`attributes` are plain functions.

Batching (v3 semantics): a `startBatch()`/`endBatch()` pair (or
`cy.batch(fn)`) defers *style application* — the first apply of
elements added inside the batch, sheet re-application (`cy.style(sheet)`
compiles and validates immediately, applies at the flush), and
data-mapped label refresh — into one bulk pass at the outermost
`endBatch`, filtered to still-live elements.  Events keep firing during
the batch, and style-derived reads (`width()`, `label()`, `style()`)
may be stale inside it.  Renderer scheduling needs no batch deferral:
the dirty tracker already coalesces per microtask, which fires after
the batch's synchronous block anyway.  v3's `notify`/`noNotifications`
have no v4 counterpart for the same reason.

Style getters read the **stored channels** — the resolved values the
renderer draws from — not the sheet's declarations: `style(name)`
returns numbers for numeric props, `rgb()`/`rgba()` strings for colors
and keywords otherwise; `style()` returns the whole group's props;
`renderedStyle` scales length props (width, height, border-width,
font-size) by the zoom; `numericStyle` returns the number (throws for
non-numeric props).  Consequences of reading stored truth: an
equal-radii ellipse reads back as `'ellipse'` whatever keyword compiled
it, arrow getters derive from the stored arrow color (alpha folds in
edge opacity, so a fully transparent arrow reads shape `'none'`), and
label channels (`font-size`, `color`) come from the label sidecar when
the node is labelled, else resolve through the sheet (mapped channels
evaluate for that slot).  When the GPU eval kernel owns
a paint channel (see the mapper DSL below), its stored bytes go stale
after data writes and the getter evaluates the shared mapper IR lazily
instead — same math as the kernel, agreeing with rendered pixels within
±1 per RGBA byte.  The setter forms throw: v4 has no per-element bypass —
per-element styling is a mapper (`case` conditionals, `data(key)`
scales).

## Design decisions (v4 API direction)

Decisions made for the v4 direction and reflected in this prototype;
each is deliberate, not a pass-1 deferral:

- **No selector strings, anywhere.**  v4 drops the selector language
  outright — there is no parser, no dialect of v3 selectors, and no plan
  to grow one back.  The replacements, by role:
  - *Queries* (evaluate now → collection): structured **query objects**
    compiled to the matcher IR — `cy.nodes({ selected: true })`,
    `cy.filter({ group: 'edges' })`, `eles.filter({ selected: false })`,
    and data conditions over the sidecar columns (round 10):
    `cy.nodes({ data: { weight: { gt: 0.5 } } })` — one of
    `eq/ne/lt/lte/gt/gte/in` per key (a bare value means `eq`; keys AND
    together), sharing the `case` mapper's vocabulary and semantics
    (a missing value fails every op, `ne` included), answered inside
    the columnar scan with per-key readers hoisted out of the loop.
    Unknown query keys throw (a typo must not silently match-all).
  - *Predicates* (evaluate per element, lodash-style): plain functions —
    `cy.filter( ele => ele.data('weight') > 0.5 )`, and event delegation
    `cy.on('tap', ele => ele.isNode(), handler)` (predicates compare by
    function identity in `off()`, so removing a delegated handler takes
    the same `(events, predicate, handler)` triple).
  - *Id lookup*: `cy.$id(id)` / `getElementById` (the O(1) id index).
  - `cy.$()` is gone; set ops and `edgesWith`-style methods take
    collections, not selector strings.
- **The matcher IR is the contract, not a syntax.**  `matcher.mts`
  compiles a query to per-group `(mask, want)` flag tests answered by
  one columnar scan (`GraphStore.scanRefsInto`) — no element handles, no
  per-element matching.  Richer predicates later (data over the sidecar
  columns, structural terms) extend the IR with more test kinds; any
  future frontend (chained builder, serialized JSON query) compiles to
  it rather than growing its own matching.
- **No classes in v4** (`addClass`/`removeClass`/class selectors).  The
  role classes played in v3 — user-defined state driving filtering and
  styling — belongs to the columnar `data()` sidecar (for state) plus
  mappers and predicates (for behaviour).
- **Style is `{ nodes, edges }`, no selector blocks and no style
  functions.**  Each key is a props object whose values are constants or
  mapper objects; all per-element variation is declarative (scales and
  `case` conditionals), so every value is analyzable, serializable, and
  GPU-evaluable.  The opaque `(ele) => props` form was removed — its
  cases are covered by mappers (`case` for conditionals, `data(id)` for
  identity), and selection-dependent recolouring is intentionally gone
  (the `:selected` accent ring is shader-drawn).  Everything stays fresh
  automatically: a data write re-derives the affected mapped channels,
  gated on the mapped keys.
- **Every mapper is cheaply CPU-evaluable — a load-bearing invariant.**
  It is what keeps `ele.style()` (and `numericStyle`/`renderedStyle`)
  *synchronous*, keeps headless mode and Node tests working (the same IR
  runs on CPU, on the GPU, and in tests), and keeps determinism.  Reads
  are **not** async: an async read would be viral across every call site,
  open reentrancy windows, and break headless/testability — all to
  answer a question the CPU can already answer from the IR in
  nanoseconds.  GPU evaluation is an optimization layered over the
  CPU-evaluable IR, never a source of values the CPU can't reproduce; a
  mapper that can't be GPU-packed (conditional, multi-key, mixed column)
  simply stays CPU-evaluated.  Async is reserved for genuinely GPU-only
  reads (rendered pixels, image export — already async), a different
  category from resolved-style reads.
- **Mappers are a serializable object DSL, evaluated GPU-side** (landed;
  design decided 2026-07-24).  A style prop value can be a plain object
  spec — `{ data, scale?, domain?, range?, ... }` — no string parsing,
  no builder; the spec is JSON-round-trippable and compiles to a
  closure-free IR (`style-scales.mts`).  Scales: `linear` (default),
  `log`, `sqrt`, `pow`, `symlog`, `diverging` ([min, mid, max] domain),
  `ordinal` (categories), `threshold` and `quantize` (bins).  Colors
  interpolate in **OKLab** by default (`interpolate: 'srgb'` opts out)
  with named schemes (`viridis`/`plasma`/`magma`/`inferno`, ColorBrewer
  ramps, `category10`/`dark2`) and multi-stop ranges (pairwise when
  domain and range lengths match, evenly spread otherwise).  Semantics:
  clamp by default; missing/unmappable data resolves to `fallback` else
  the channel default (never keep-previous — refresh is idempotent);
  `domain` omitted/'auto' is a **live extent** (Vega-Lite semantics):
  the data extent re-checks on writes of the mapped key and a moved
  extent re-derives the whole channel (log auto-extents use positive
  values only).  Refresh is dependency-gated per (group, key, channel);
  edge data writes refresh edge channels; `label` takes the passthrough
  form only (`{ data: key }`, or the legacy `'data(key)'` string sugar).
- **Conditionals: the `case` mapper.**  `{ case: [{ when: { data,
  gt/lt/eq/ne/in/... }, then }], else }` — clauses in order, conditions
  AND-ed within a clause, first match wins; `when` reads any data key or
  the first-class `id`.  The declarative replacement for
  `(ele) => cond ? a : b`, and the natural form for typed edges
  (`type == 'activation' → ...`).  CPU-evaluated (multi-key,
  conditional), so it stays off the GPU eval kernel and refreshes via the
  CPU path.
- **GPU evaluation: the paint/geometry split.**  Paint channels — fill,
  border and line colors, opacities, arrow colors — are evaluated by a
  per-group compute kernel that interprets the packed program array
  (`render/mapper-runtime.mts`, `mapper-shaders.mts`) and writes the
  *existing* channel storage buffers: render pipelines are untouched and
  there are zero pipeline permutations.  A bulk data write uploads only
  the touched data bytes (f32 shadow + present mask; dict indices for
  string ordinals) and dispatches once — no CPU restyle (200k color
  write: 78.5 → 15.9 ms, the rest being the data-write loop itself).
  Geometry channels (size, border-width, shape, edge width) and the
  label sidecar stay eagerly CPU-evaluated — the invariant: *anything
  read by a cull predicate, the CPU pick replica, or a columnar scan
  (fit, box selection, grid layout) stays CPU-canonical.*  Arrow alpha
  folds in-kernel (evaluated or constant opacity; a mapped arrow
  *shape* demotes all edge paint to the CPU, as does a mapped column
  promoting to mixed).  Headless or adapterless instances run the whole
  DSL eagerly on the CPU — the kernel is an optimization layer, not a
  requirement.
- **Animation: CPU-canonical, with a GPU fast path for position and paint
  under a transient lease.**  An animation tweens element style/position
  (or the viewport) from captured start values to explicit targets over a
  duration, easing normalized time (`eles.animate/animation/animated/
  stop/delay`, `cy.animate` for the viewport).  Because a tween is a
  *pure function of time*, it is CPU-reproducible — the CPU is always the
  reference (works headless, Node-testable), and there is **no readback**
  (a settle/stop re-derives the exact current value on the CPU).
  - **One capture, two executors.**  `capture()` snapshots start values
    into per-channel `ChannelWrite`s (column, kind, slots, packed
    from/to) *once*; the CPU tick and the GPU kernels then consume the
    same numbers, so the two executors agree by construction rather than
    by parallel implementations.
  - **CPU path**: each tick writes the store columns (dirty → redraw).
    The default headless path, and the path for geometry tweens.
  - **GPU fast path** (`render/gpu-tween.mts`): when a renderer is
    present, three kernels (`position`/`scalar`/`color`) evaluate
    `mix(from, to, ease(t))` on-device — per-slot from/to uploaded once, a
    per-batch params buffer holding `{start, duration, now, curve}`
    bumped per frame.  Per-frame CPU cost is ~zero (no tween loop, no
    column upload) — the layout-transition-and-fade-at-scale case.
    Dispatch counts come from WGSL `arrayLength(&slots)`, *not* a uniform:
    `queue.writeBuffer` is ordered against submitted command buffers, not
    against dispatches inside one, so a per-dispatch value cannot live in
    a shared uniform.
  - **Two tiers decide what may offload.**  *Position* runs in its own
    pre-cull pass, so the pass barrier lets cull and the edge shaders read
    the tweened positions (edges follow for free).  *Paint* (`opacity`,
    fill/border/line color, and the arrow colors) is encoded **inside the
    cull pass after `mapperRuntime.encode()`**: dispatches in one pass
    observe prior dispatches' writes, so a live tween wins the channel
    over the mapper eval kernel.  *Geometry* (`width`/`height`,
    `border-width`, `edge.width`) stays CPU: it is read by cull, CPU pick,
    and every columnar scan (`width()`/`height()`, `boundingBox`/fit, box
    select), so a GPU-owned size tween reopens the store→style layering
    seam R8.5 flagged and belongs with that geometry work.  Eligibility is
    **all-or-nothing per animation** (`gpuEligible`), so a column is never
    half-owned.  Easings never affect eligibility: every accepted form
    compiles to something both executors can run.
  - **One curve layer, two executors** (`easing.mts`).  `compileEasing`
    turns an easing into an `EasingProgram` — `kind` plus a bezier tuple or
    a progression array — which the CPU calls directly and the kernel reads
    out of its params (progression arrays ride a storage buffer).  Accepted:
    v3's full enum (`linear` plus 25 named cubic-beziers, the same control
    points, so the curves are unchanged), `cubic-bezier(x1, y1, x2, y2)`,
    CSS `linear(...)` progression arrays (stops and all), and
    `spring(bounce)`.  The two evaluators mirror each other step for step
    (the same 11-sample bracket and Newton refinement; the same
    binary-search lerp) and agree to float precision, not bit-exactly —
    invisible mid-flight, and moot at the ends, where t=0/t=1 are exact on
    both sides and a settle re-derives on the CPU.
  - **Easings are names only** — a custom easing *function* is rejected
    (v3 accepted one).  A closure cannot cross to the device, so keeping it
    would mean a curve that silently depends on whether the animation got
    offloaded; `cubic-bezier()`/`linear()` cover any curve you can draw.
  - **`spring(bounce)` is perceptual, and compiles on the CPU.**  It
    replaces v3's `spring(tension, friction)` with Apple's parameterization,
    which reduces to a damping ratio of exactly `1 − bounce` (0 is
    critically damped, positive rings, negative is overdamped).  The
    compiler samples the closed-form step response over the whole settling
    window into a progression array, so the kernel needs no physics and
    springs cost exactly what `linear()` costs.  `duration` is the
    *perceptual* duration — the pace of the key movement, held constant as
    bounce changes — so the animation runs on past it while the ringing
    decays (`durationMs = duration × durationScale`).
  - **Bouncy curves overshoot, and scalars clamp.**  Position is let
    through (overshoot is the point of a spring); scalar channels clamp to
    their property bounds on both executors (`opacity` to [0,1],
    `border-width` at 0), as v3 does via each property's `min`/`max`, and
    color bytes clamp on pack.
  - **Transient lease**: a tweened column is GPU-owned while the tween
    runs (the mirror skips its CPU uploads), so sync reads are a stale
    mirror during the animation — `position()`/pick/extent for position,
    `style('background-color')` for paint.  On completion *or* stop the
    CPU settles the value it reached and reclaims ownership; the settle's
    write dirties the column, which is already the mapper's re-evaluation
    trigger, so a mapped channel reclaims itself with no extra machinery.
    **Grabbing is forbidden while an element animates**
    (`pointer.canDrag` consults `isAnimating`), removing the two-way
    drag-feedback boundary.  The renderer drives the frame clock while
    animations are active (the manager cedes its auto-loop).
  - **Colors tween in OKLab**, matching what color mappers already do by
    default — one perceptual color model across the library rather than a
    mapper/animation split.  Endpoints are converted on the CPU and packed
    as two `vec4f` (L, a, b, alpha), so the kernel needs only the
    OKLab→sRGB direction it already shares with the mapper kernel and both
    executors mix identical numbers.  This deliberately diverges from v3,
    which tweened per-channel in sRGB.
  - Animating `edge.opacity` also tweens the arrow colors, because the
    arrow vertex stage is at WebGPU's base 8-storage-buffer limit and so
    edge opacity is *pre-folded* into stored arrow alpha
    (`stored.a = base.a × opacity`).  The fold is linear in opacity, so
    each arrow rides along as a plain color tween to `base × toOpacity`.
    The base comes from `StyleEngine.arrowBase()`, not the stored bytes,
    which cannot recover it when the folded opacity was 0.
  - Animatable today: `position`, `opacity` (both groups), node
    `background-color`/`border-color`, `edge.line-color`, node
    `border-width`.  Size (width/height circle-collapse) is a follow-up
    with the geometry seam.
  - **Viewport targets** (round 10): `cy.animate`/`cy.animation` take
    `pan`/`zoom`, plus `fit: { eles | boundingBox, padding }` and
    `center: { eles }` — resolved to concrete pan/zoom when the
    animation is *created* (v3 semantics), so later graph changes don't
    retarget a queued fit.  `eles.boundingBoxAt(posOrFn)` computes the
    box at hypothetical positions (no store writes), which is what an
    animated layout fit targets.
- **Synchronous reads reflect writes; staleness is scoped to motion,
  never to a frame.**  A frame-stale read contract was considered
  (let the GPU own expensive geometry and read back a frame later) and
  **rejected as a default**: read-after-write is pervasive and
  load-bearing (`data()` then `width()`/`bb()` in one tick must see the
  write — layouts and extensions rely on it), headless has no frame or
  readback so it would still need the full CPU implementation *plus* a
  weaker contract, and "a frame stale" is undefined in synchronous code
  (build-graph → query-bbs loops never reach a frame, so the staleness is
  unbounded).  Staleness is admitted only where a value is already in
  **frame-driven motion** — the position tween lease is exactly this, and
  `edge.bb()` mid-tween inheriting that staleness is consistent, not a new
  rule.  A discrete user write is never stale.  The escape hatch for
  callers who want GPU-exact geometry after a batch of writes is an
  explicit `await` on a settle/flush, not a relaxed sync contract.
- **Expensive GPU-computed geometry uses dual implementations, not
  readback.**  Some geometry is both *expensive* and read by `.bb()` —
  multiline label metrics (line breaking + block extent) and bundled
  bezier control points (a v4-but-not-yet direction).  Unlike a position
  tween, these are not cheaply CPU-reproducible, so the position lease's
  no-readback trick does not apply directly; the safe model is **two
  deterministic implementations that agree by construction** (WGSL for
  the render path, a CPU implementation for reads), each run on the same
  inputs — never one side reading back the other's result.  This is the
  same discipline already used for the OKLab LUT, mapper stop tables and
  easing curves, generalized to expensive computations; the cost is
  keeping the two impls bit-agreeable (divergence shows as bb-doesn't-
  match-pixels), which is the real gate on whether GPU is worth it per
  case.  Two consumer tiers keep it affordable: **cull/fit read a cheap
  conservative CPU over-approximation** (guaranteed to contain the true
  box — e.g. label: node size + charcount × max advance; bezier: endpoint
  hull + control-offset bound), while **public `.bb()` triggers the exact
  lazy CPU compute, memoized per element**.  For bezier, control points
  are `f(positions, membership)`, so mid-position-tween they are stale via
  the lease (consistent) and settle when positions are reclaimed;
  bundle *membership* is a cheap CPU structural index rebuilt on
  add/remove edge, not per frame.
- **Labels are model-space only.**  `font-size` and the wrap width are
  both in model coordinates (v3 parity), and there is **no viewport-fixed
  label mode**.  This is load-bearing three ways: (1) line breaking is
  then zoom-invariant (font-size and wrap width share a space), so label
  shaping — the expensive part — **memoizes** and the GPU metrics pass
  runs on text/font/wrap writes, not per frame (a *mixed* space would
  reflow on every zoom and defeat both the CPU memo and the GPU offload);
  (2) **image export is WYSIWYG** — a `full`/high-`scale` export is the
  screen arrangement at a different transform over *identical* shaping, so
  figures for scientific publishing don't reflow between screen and
  export, and the export path reuses the screen memo verbatim; (3) it
  matches v3, so existing figures reproduce.  Screen-space labels were
  rejected because they break export WYSIWYG (labels reflow at a scale ≠
  current zoom) and their apparent legibility win on dense graphs is
  really overlap that makes a *worse* figure — unreadable labels on a
  huge network are a data-density limit answered editorially (export
  resolution, label a subset, `min-zoomed-font-size`), not by a
  coordinate system.  The label-visibility sub-decision is taken (round
  9.6): LOD thresholds (`labelFadePx`, `labelMinPx`) evaluate at
  **export scale** — a full/high-scale export is a self-consistent
  figure, not a copy of the screen's label culling.
- **Image export is async, WYSIWYG, and pixel-pinned.**  `cy.png()`/
  `cy.jpg()` render the scene into an offscreen texture at the requested
  viewport (the current view, or the graph bounds with `full`) and read
  the pixels back — the one category where async is the design: rendered
  pixels are genuinely GPU-only, unlike resolved-style reads, which stay
  synchronous.  v3's option surface is kept (`bg`, `full`, `scale` or
  `maxWidth`/`maxHeight`, `quality`, `output`), every output form
  resolves through the returned promise, and jpg defaults `bg` to white
  (JPEG has no alpha).  Exports are encoded inside the frame loop after
  that frame's scene work, so they see exactly the state the screen
  shows — including GPU-owned columns mid-tween (a mid-animation export
  shows the tweened position the lease makes stale on the CPU).  They
  always render at native resolution (the adaptive render scale never
  applies), and label LOD evaluates at the export scale (above).  The
  WYSIWYG guarantee is enforced by a Playwright self-diff: a viewport
  export at scale 1 pixel-matches a screenshot of the live canvas.
  Headless instances reject (there is no renderer to export from).
- **Fonts: one global `font-family`, and a fixed web font for label
  tests** (round 9.7).  The glyph atlas is keyed by character — one font
  per atlas by design — so `font-family` is a **constant, effectively
  global** node style prop (default `sans-serif`); changing it resets
  the atlas and re-lays-out every label through the existing label-dirty
  channel.  Per-element fonts would re-key the atlas by (font, char) and
  are out of scope.  Label-test reliability comes from pinning all three
  variance sources: the *font file* (a vendored OFL web font, Open Sans
  via devDependency, loaded with FontFace before instance creation), the
  *GPU* (the SwiftShader-pinned visual project), and *tolerance* for the
  one layer a web font cannot pin — Chrome rasters the atlas via
  CoreText on macOS and FreeType on Linux, so label goldens carry a
  looser diff bound than geometry goldens (per-platform goldens are the
  reserve escape hatch if CI proves that insufficient).  Footgun, and
  why specs pre-load the font: the atlas rasters glyphs lazily and
  caches them forever, so a glyph rasterized before the web font
  finishes loading is cached from the fallback font — **but** (round
  10) the renderer listens for the font set's `loadingdone` event and
  re-rasters the atlas + rebuilds every glyph run when a web font
  finishes loading, so late-loading fonts self-correct.  Specs still
  pre-load to keep goldens deterministic.
- **Edge labels: built (round 10, pass 1)** — exactly the committed
  shape: a second glyph stream parallel to the node one (own instance
  buffer, own cull group, own draw call, shared atlas); edge glyphs
  anchor at the edge midpoint computed **in the vertex shader** from
  the two endpoint positions, so edge labels follow drags, layouts and
  position tweens on-GPU with zero rebuild (spec-pinned: an endpoint
  move re-uploads ≤ 64 bytes and the label lands at the new midpoint).
  The cull predicate mirrors the edge cull (edge SHOWN + both endpoint
  nodes SHOWN); the model side group-keys the label sidecar,
  label-dirty channel and StyleEngine label channels (the `label`
  passthrough, `font-size`, `color` and all the round-10 text visuals
  work for edges; the text block centers on the midpoint by font
  size).  Horizontal text only — autorotate (with its
  flip-when-upside-down readability rules) stays a separate follow-up
  call.  Edge labels are not pickable, like node labels.
- **Removed elements are terminally dead** (decided 2026-07-27).  An
  element's substance lives in the columns, not the handle, and
  `remove()` tombstones the slot, bumps its generation and free-lists
  it — the next `add()` may recycle and overwrite those bytes.  So v4
  does not keep removed elements readable: a ref held in an old
  collection fails generation validation and reads as dead, and only
  the handle's cached `id()`/`group()` stay readable (kept for
  `remove`-event handlers and predicates).  This closes v3's
  hold-a-removed-element pattern permanently: `restore()`/`clone()` and
  the import form of `cy.json()` are not coming to v4 — re-adding from
  kept definitions is the app's job (exported element json round-trips
  through `cy.add()`).
- **Slot-stable structures self-compact on waste thresholds** (round
  11).  Three append-only structures leak under remove/add churn even
  though the tables' slot free-list keeps the columns from growing:
  the id blob (removed ids' UTF-8 bytes), the CSR adjacency (stranded
  per-node segment space plus the incremental overlay arrays), and
  string data dictionaries (entries whose last reference was
  overwritten or cleared).  Each meters its waste and reclaims
  automatically when it exceeds half the live size (small floors keep
  tiny structures from churning) — the threshold policy the
  insertion-order list has always used, and no new API.  These
  reclaims move no element slots, so refs, draw order and the GPU
  mirrors are unaffected.  Specifics: the id blob compacts live byte
  ranges into a right-sized blob (the probe table keys on (group,
  slot), never offsets, so it survives; peak-then-small graphs shrink
  back toward the floor); the adjacency rebuilds CSR from the live
  edges in insertion order (preserving per-node incident order — the
  one exception being an edge re-pointed by `move()`, which sits at
  its re-add position until a rebuild returns it to insertion order —
  and folding purely incremental graphs into the compact CSR shape
  once past the floor); dictionaries refcount their entries and remap the
  indices column in place with a per-column epoch, so the GPU ordinal
  LUT and uploaded index shadow repack through the normal watched-key
  span path while element values never change (ordinal domains are
  explicit, so no styling output can move).  *Slot-moving* compaction
  (dead element slots, `highWater`, pass widths) is deliberately not
  built: its policy calls (ref survival across a move, trigger, draw
  order) are logged open in `PLAN.md`.
- **GPU layouts: logged for later.**  A force layout is *stateful*
  (`pos[t+1] = pos[t] + forces(pos[t])`), so unlike animation it is *not*
  cheaply CPU-reproducible — the GPU would be authoritative during a run
  with a readback on convergence, and headless would fall back to a CPU
  reference implementation (which doubles as the spec the kernel must
  match).  It reuses this round's lease + readback machinery, but the
  per-algorithm kernels and convergence detection are a future round.

`data()`: element data lives in a **columnar sidecar** — per-(group, key)
columns, not per-element objects: numbers as Float64Array, strings
dictionary-encoded, a plain-array fallback for the rest, each column
adapting to what it holds.  `id` (and `source`/`target` on edges) stay
first-class and immutable.  Setters emit `data` per element.

Node labels (SDF): the `label` style prop takes constant strings or the
passthrough mapper (`{ data: key }`, or the legacy `'data(key)'` string;
`id` reads the first-class id); mapped labels refresh on data writes (fn
styles do not — see the refresh policy above).  `font-size` and `color`
take constants or mappers (CPU-evaluated — the label sidecar is not a
GPU column); `font-family` is a constant and effectively global (one
font per atlas, default `sans-serif` — a change resets the atlas and
re-lays-out every label; see the fonts design decision above).  Glyphs
come from a runtime SDF atlas (canvas-2D raster → Euclidean distance
transform → one r8 texture) and live in a persistent instance buffer keyed
by node slot — the label vertex shader reads the node position buffer, so
labels follow drags and layouts on-GPU with zero rebuild.  Labels fade out
below the `labelFadePx` LOD threshold.

Events: no namespaces — v4 drops the `'tap.foo'` form (unused, and a
per-emit parse cost). Listen/emit with plain type names; the shared
`src/emitter.mts` keeps namespace parsing only for v3.  Delegation is
predicate-based (`cy.on('tap', ele => ele.isNode(), cb)`); on `remove`
events the target handle's cached `id()`/`group()` stay readable inside
the predicate, while live state reads report false.

Out of scope (deferred): compound nodes,
string-formatting label mappers beyond the passthrough, and the GPU
tween fast path for *size* channels (position and paint offload today;
size is a geometry-tier project, see the design decisions above).  Multiline
labels and bundled bezier edges are a v4 direction (single-line labels
and straight edges today); both are the *expensive GPU-computed
geometry* tier — dual CPU/WGSL implementations with a conservative CPU
bound for cull/fit and exact lazy CPU eval for public `.bb()`, no
readback — and GPU layouts remain logged for later.

## Benchmarks

`npm run benchmark:gpu` (Mitata; `BENCH_N` scales the graph) compares each
core/collection op against its v3 analogue in `src/`. See
`benchmark/gpu/` (`materializers.mjs` is a focused standalone sweep that
stays runnable at `BENCH_N=200000`).
`npm run benchmark:gpu:report` runs every suite and renders a
self-contained single-page HTML report (v3-vs-gpu medians as dumbbells on
log time axes, a ranked speedup overview, per-suite stat tables) into
`benchmark/gpu/results/` (gitignored) next to the timestamped results
JSON — quick profile by default, `-- --full` for the 2k/20k/200k matrix
(one process per group at 200k, as the suite headers require),
`-- --render-only <results.json>` to re-render without re-running.

**Renderer benchmarks** (`npm run benchmark:gpu:renderer`, or
`benchmark:gpu:report -- --renderer` to fold them into the same report):
`benchmark/gpu/render-bench.mjs` drives `render-bench.html` in Chromium
via Playwright — needs built UMD bundles and a **real GPU adapter** (the
run aborts on none; software adapters are warned about, their numbers are
a different machine class).  It replays the interactions behind the
recorded renderer numbers on three scenes (seeded 25k×50k and 100k×300k
generators, ndex-x-large), v3 canvas vs v4 WebGPU: continuous-pan steady
state at fit-all / zoomed-in 20× / far-zoom (labels off and on),
hover-while-panning `pick()` latency, and one-shot init / columnar-init /
full-png-export timings.  Wall ms-per-rendered-frame is the comparison
metric (vsync-bound — both sides floor at the display refresh when
fast); `gpu (device)` table rows carry the GPU-pass time from
`timestamp-query`, the unbounded cost.  dpr 2, 1280×800, adaptive render
scale pinned to 1; `--scene <substr>` filters scenes, `--headed` debugs.  Read-heavy structure ops are where
v4 pulls ahead:
`degree`/`totalDegree` are O(1) off the adjacency index (~100–200× v3),
`components`/`add`+`remove` ~25–35×, set operations up to ~25×.  Collection
identity keys on a packed `{group, slot, gen}` integer (not a string) and
each collection lazily caches its membership Set (sound because `_refs` is
immutable), so `same`/`contains`/`intersection`/`difference` beat v3 once a
collection is reused.  `$id` resolves through the O(1) id index rather
than materializing and scanning the graph; structured queries are
(group, flag-mask) predicates, so they compile through the matcher IR to
per-group `(mask, want)` tests answered by one preallocated scan over
the flags column (`GraphStore.scanRefsInto`) — no element handles, no
per-element matching.  With that scan behind
`elements/nodes/edges/filter` (and the interned-handle pool an array
indexed by slot instead of a Map), the whole-graph materializers and
flag queries all beat v3 — e.g. at 200k nodes
`filter({ group: 'nodes', selected: true })` is ~140× v3's
`$('node:selected')` — and no maintained membership sets (v3's approach)
are needed.
Callback iteration (`forEach`/`map`/...) plain-calls the callback when no
`thisArg` is given, matching v3's semantics (`this` is undefined inside
the callback) — rebinding the receiver per element cost ~2× on large
collections.

Collection-scale *writes* are columnar too (`benchmark/gpu/mutators.mjs`
sweeps them at up to 200k nodes; `BENCH_OP` runs one group per process at
that scale).  Flag mutators (`select`/`unselect`, `show`/`hide`, `lock`,
`grabify`, `selectify`) go through one bulk pass over the flags column
(`GraphStore.flagRefs`: hoisted columns, one coalesced dirty span per
group); select/unselect skips its restyle pass entirely unless some style
block matches on `:selected`/`:unselected` (the selected accent ring is
drawn by the shader, so the default stylesheet never restyles) and only
emits when someone is listening.  `shift()` and constant `positions()`
are direct column arithmetic — no per-element handles or Position
objects.  At 200k nodes vs v3: select+unselect ~38×, lock ~96×, shift
~106×, hide+show ~1400× (v3 pays a style bypass per element), and
removing + re-adding a 256-node band with its incident edges ~1000×.

Composed traces hold up too (`benchmark/gpu/scenarios.mjs`: five
interaction scenarios — explore/click-expand, select-all + fit, band
drag, remove/re-add, dashboard refresh — replayed **with core listeners
attached**, the axis the micro suites exclude since their emits are
listener-gated).  At 200k nodes the gpu side wins every trace 6–530×:
a click-expand-select-fit interaction runs in ~45 µs median (34× v3),
and per-element emit cost is ~85 ns/listener call.  The sweep also
settled the lazy-collection question (handle materialization is ~4–6%
of the worst trace — not worth the API change) and exposed the
data-write label path, since fixed: mapped-label refresh on `data()`
writes is a label-only bulk pass gated on the written keys, not a full
per-element style apply — a 200k bulk write under a mapped label
dropped 85 → 37 ms.  (The mapper DSL later generalized this into
`StyleEngine.refreshMapped` — per-group, per-key gating for every
mapped channel, with the label-only fast path preserved; see
`benchmark/gpu/mappers.mjs` for the write-cost sweep per evaluation
policy.)

Traversal walks (`connectedEdges`, `outgoers`/`incomers`,
`neighborhood`, `roots`/`leaves`, `successors`/`predecessors`, edge
endpoints) are slot-native (`benchmark/gpu/traversal.mjs`): they collect
current refs straight off the CSR index with an int-packed (group, slot)
seen-set — no intermediate handles, no packRef dedupe pass — and
`successors`/`predecessors` is a raw slot BFS with no per-hop collection
spawns (a 2k-node whole-graph closure is ~350 µs vs ~92 ms before,
~725× v3).  Single-hop ops run ~2–5× v3 and a 100-node-band
`roots()` ~110×.  The ~2–5× is a structural ceiling rather than headroom:
v3 traversal is already O(degree) off per-element adjacency arrays, and
returning a v3-shaped collection costs a ref + interned handle per output
element on either side — unlike bulk writes, which touch columns and
return nothing.  Going further would mean lazy slot-backed collections
(an API-shape change, noted in PLAN.md under "needs a call").

The graph algorithms have their own sweep (`benchmark/gpu/algorithms.mjs`;
superlinear ops gate on `BENCH_N`): the slot-native walks win every op at
N=2000 — bfs ~34×, dfs ~39×, dijkstra+pathTo ~33×, tarjan SCC ~19×,
betweenness ~13× — while the dense-matrix ops (pageRank, floydWarshall,
markov/hierarchical/kMeans clustering) are parity as expected, identical
math dominating (within ±1.2× at N=500).

## Loading

`options.elements` accepts the classic definition form (v3-style JSON) or
a **columnar bulk-load form**: `{ columnar: true, nodes: { count, ids?,
positions?, data? }, edges: { count, ids?, sources, targets, data? } }`
with typed-array columns and edge endpoints as node *indices* — it
ingests straight into the store (contiguous slot runs are memcpys) with
no per-element objects and no id lookups per edge.  `data` holds sidecar
columns by key (plain arrays, Float64Array with NaN holes, or
dictionary-encoded string columns).  Columnar payloads are self-contained: every
edge endpoint indexes a node in the same payload.  Convert classic JSON
with `cytoscapeGpu.toColumnarElements(json)`.  There is also a **binary
wire format** — `cytoscapeGpu.serializeElements(elements)` (takes either
form) produces one little-endian ArrayBuffer (fixed header + columns; ids
as a UTF-8 blob with prefix offsets), and `options.elements`/`cy.add()`
accept the buffer directly (or use `deserializeElements` to inspect it) —
so a graph can be served as a static binary asset and fed straight from
`fetch(...).arrayBuffer()` with no JSON parse.  Numeric columns
deserialize as zero-copy views into the buffer, and ids stay packed all
the way into the store — the id index is itself blob-native (UTF-8 bytes
+ an open-addressing probe table, no JS strings), so id strings are
decoded lazily, only for elements actually touched via handles.  The
wire carries the data() sidecar too: numeric columns as f64, string
columns as dictionaries (only the small dictionary decodes), the rest as
JSON per present value.  Either way, the
factory's load path materializes no per-element handles and emits no
`add` events (nobody can be listening yet); `cy.add()` keeps full
per-element semantics and takes all three forms.  The reverse
direction exists too (round 10): **`cy.serialize()`** exports the live
graph as the wire buffer — ids, positions, selection state and the
data() sidecar (style/viewport/scratch are not part of the wire) — and
the result feeds straight back into `options.elements`/`cy.add()`.
ndex-x-large (19.6k
nodes / 465k edges, 28.6 MB JSON): definition-form init 236 ms, columnar
init 80 ms — down from 662 ms before the bulk path.  The wire form of the
same graph is 9.2 MB and deserializes in ~5 ms, replacing the JSON path's
90–113 ms parse + 27–48 ms convert.

## Known deviations from v3 (accepted for pass 1)

- **Listener firing order**: one core emitter with ref/predicate-qualified
  listeners; element-vs-core listeners fire in plain registration order, not
  v3 bubble order.
- **No z-index**: edges always draw under nodes; within a group draw order
  is slot order (≈ insertion order, but a reused slot draws at the recycled
  position).  A grabbed node does not pop above later-inserted nodes.
  Escape hatch: an optional `array<u32>` index-indirection pass later.
- **Float32 positions**: ~7 significant digits of precision (pure-memcpy
  uploads are worth the trade at this stage).
- **Pan-vs-grab is exact**: pointerdown does a synchronous CPU node pick
  (positions are CPU-canonical), so grab targeting has no staleness and a
  cold start needs no resolved pick.
- **Hover pauses during viewport gestures**: pan drags and wheel zooms are
  viewport-only ops with no mouseover/tap semantics, so no pick passes run
  mid-gesture; a wheel gesture re-picks under the cursor once it settles
  (~200 ms after the last tick).
- **Frame timing in `stats()`**: `cpuFrameMs` is the encode/submit cost
  (submission is fire-and-forget, so it stays ~0.1 ms by design);
  `gpuFrameMs` is real scene-pass GPU time via the optional
  `timestamp-query` feature (0 when unsupported).  Reconcile fps against
  `gpuFrameMs`, not `cpuFrameMs`.
- **No selector strings** (a v4 decision, not a gap — see "Design
  decisions" above): queries are structured objects ({ group, selected }
  today), everything richer is a predicate function, ids go through
  `$id`.  Style prop values are constants or mapper objects (see the
  mapper DSL above); per-element styling is declarative (there are no
  style functions).
- **`cy.elements()` order**: nodes (insertion order) then edges, not the
  mixed insertion order of v3.
- **Picking** resolves in three stages, cheapest first.  (1) Nodes pick
  **synchronously on the CPU** — positions are CPU-canonical, and a
  columnar scan replicating the shader semantics (flooring, plain-disc
  LOD, shape inside-tests, topmost-slot-wins) answers in ~0.1 ms with
  zero GPU work.  (2) The last GPU pick tile doubles as a **pick cache**:
  while the cursor stays inside it and neither the viewport nor any
  pick-affecting geometry changed, edge/background answers are instant
  (color/opacity-only changes keep the cache).  (3) Otherwise the GPU
  pick pass draws a fixed 64×64 cursor-centered tile — **edges only** — 
  (a pick-specific Frame uniform turns the cull pass's viewport test into
  cursor-region culling, O(region) not O(scene)), submits in its own
  command buffer ahead of scene work, and reads the whole tile back
  through a ring of 3 staging buffers (latest-wins; requests drop to
  `null` when the ring is exhausted).  Scene submissions are capped at 2
  in flight, so even stage-3 picks resolve in ~1 rAF plus bounded GPU
  work on GPU-bound graphs.  Measured on ndex-x-large at dpr 2: node
  hovers ~0 ms, cold background/edge ~7 ms, cached ~0.2 ms,
  hover-while-panning median ~0 ms (was ~70 ms).
- **Far-zoom edge decimation**: once width-floored (hairline) edges fall
  below half alpha, a hash-stable 1-in-N subset draws at N× alpha (N a
  power of two ≤ 64).  Aggregate edge density is preserved, but individual
  sub-half-alpha edges may neither draw nor pick at far zoom.  This removes
  the far-zoom worst case where every edge rasterized into a few hundred
  pixels and serialized at the blend stage (~33 ms → ~8 ms on 465k edges).
- **Early-z**: a depth prepass writes depth for guaranteed-opaque node
  interiors (skipping translucent fills/borders, LOD alpha and the AA
  fringe — output is pixel-identical), and edges depth-test against it so
  fragments under opaque nodes skip blending.  Depth values come from a
  per-element **z-rank** (two ranks today: edges far, nodes near), which
  is the same mechanism a future `z-index`/compound pass would use — more
  ranks, more batches; content ranked above merely loses the occlusion
  benefit, never correctness.  Nodes that can't occlude (translucent or
  < 4 px) collapse out of the prepass so it costs ~nothing at far zoom.
- **Adaptive render scale** (`renderScaleMin`/`renderScaleMax`, defaults
  0.5/1): the renderer moves its resolution in quarter steps within the
  band, driven by measured GPU frame time over ~400 ms windows — median
  above ~14 ms steps down; stepping up requires the *projected* cost at
  the higher step (~scale²) to fit under ~10 ms, so raises never pump
  (backpressure stalls are the fallback signal without
  `timestamp-query`).  Shortly after drawing stops (~250 ms) one frame
  re-renders at max, so still images are always full resolution — low-res
  frames only ever exist mid-interaction on expensive scenes.  Scaled
  frames draw into an offscreen target and a fullscreen Catmull-Rom
  bicubic pass upscales to the canvas (preserves SDF borders and
  hairlines far better than bilinear).  Raster LOD floors (edge width,
  node size) apply in render px; label thresholds (`labelFadePx`,
  `labelMinPx`) are readability criteria and apply in *displayed* px, so
  labels don't blink out when the scale drops mid-gesture.  Picking
  always runs at native resolution.  Pin `min === max` for a fixed
  scale.  (ndex-x-large fit-all pan at dpr 2: settles at 0.5 within
  ~0.8 s, 25 → 76 fps; far-zoom and idle stay native.)
- **Label LOD**: labels fade below `labelFadePx` (glyphs past the fade's
  zero point are culled in compute, not drawn at zero alpha); the optional
  `labelMinPx` renderer option hard-culls labels whose on-screen glyph
  height is below it — too small to read anyway (default 0 = off).
- **Edge `line-style`** (round 10): `solid` (default) | `dashed` |
  `dotted`, with v3's patterns ([6, 3] and [1, 1] in model px, so
  dashes zoom with content as v3's model-space canvas dashes do),
  drawn as an AA'd mask in the edge fragment stage.  Picking ignores
  the gaps, as v3 does.  `border-style` is not ported (dashing an
  arbitrary SDF boundary needs perimeter parameterization).
- **Node shapes** (round 10): `ellipse`/`circle`, `rectangle`/`square`,
  `round-rectangle`, plus the polygon family — `triangle`, `pentagon`,
  `hexagon`, `heptagon`, `octagon`, `diamond`, `rhomboid`, `vee`,
  `star`, `tag` — from the same unit point tables v3 builds
  (`shape-points.mts`), rendered by generated WGSL polygon SDFs with
  vertices scaled to device space (exact distance, so AA and borders
  stay crisp under anisotropy) and picked by an exact CPU
  point-in-polygon in normalized space.  Not ported: `round-*` polygon
  variants (corner-rounding an anisotropically scaled polygon has no
  clean closed form), `cut-rectangle`, `barrel`,
  `bottom-round-rectangle`, `concave-hexagon`, `right-rhomboid`, and
  the custom `polygon` (needs per-element point data).  Arrow tips on
  polygon nodes sit on the inscribed *ellipse* boundary
  (approximation); the depth prepass treats polygon interiors exactly
  via their SDF.
- **Labels**: nodes *and edges* (round 10 — edge labels draw
  horizontally at the midpoint, following endpoint moves on-GPU),
  single line (newlines collapse to spaces), fixed
  placement (nodes: horizontally centered below the node; edges:
  centered on the midpoint; both offset by
  `text-margin-x/y`), not pickable, one
  global `font-family` (the atlas holds one font), and the
  glyph atlas is a fixed 1024² texture — once full, new glyphs stop
  rendering with a console warning.  Label color/text bake into glyph
  instances, so `:selected`/hover styling does not restyle label text.
  Label visuals (round 10): `text-outline-width`/`-color`/`-opacity`
  (a second SDF distance threshold — near-free), `text-background-
  color`/`-opacity`/`-padding` (one solid quad instance preceding the
  run's glyphs, riding the same buffer/cull/draw; it carries the glyph
  block's height so it fades and culls exactly with its text), and
  `text-margin-x/y` — all mapper-capable (CPU-evaluated, like
  font-size).  Outline and background opacities fold into their stored
  alphas, so their getters read back folded (the arrow-color
  precedent).
- **Arrowheads**: `source/target-arrow-shape` supports `triangle`
  (+`arrow` alias), `vee`, `chevron`, `circle`, `square`, `diamond`,
  `tee` and `none` (round 10 — SDFs generated from v3's arrow point
  tables and evaluated in the fragment stage; the shape ids ride a
  fragment-only storage binding, keeping the vertex stage at its
  8-buffer budget).  Compound shapes (`triangle-tee`,
  `circle-triangle`, `triangle-cross`, `triangle-backcurve`) are not
  ported.  `source/target-arrow-color` as before (v3-like `#999`
  default).  One quad per visible edge per enabled end, reusing the
  edge cull stream; the tip sits on the endpoint node's boundary
  (round-rect approximated by its box, polygons by their inscribed
  ellipse).  Arrows draw *over* the line — a translucent
  arrow shows the line through it — are not pickable (the GPU pick pass
  stays edges-only), and size with the drawn (floored) edge width.
- **Gestures** (round 10 additions): the **cxttap family** — right
  button emits `cxttapstart` / `cxtdrag` (once moving) / `cxttapend`,
  plus `cxttap` when the press never moved; the browser context menu is
  suppressed on the canvas.  **`taphold`** fires after a 500 ms
  unmoved press (v3's duration).  **`dbltap`** fires on a second tap
  on the same target within `cy.multiClickDebounceTime()` (default
  250 ms; ctor option + getter/setter), and the debounced **`onetap`**
  fires when no second tap arrives — plain `tap` always fires
  immediately, as v3.  **Dragging a selected node drags every
  draggable selected node** (the whole set moves via one bulk shift
  per pointer move, all flagged grabbed).
- **Box selection**: with `boxSelectionEnabled` (default on), a drag
  while a multiple-select key (shift/ctrl/cmd) is held — or any drag
  when panning is disabled — draws a selection box (a DOM overlay above
  the canvas) and on release selects the contained elements with the v3
  event flow (`boxstart`/`boxend` on the core, `box`/`boxselect` per
  element).  Geometry is v3's default 'contain' semantics answered by
  one columnar scan (`cy.elementsInBox(x1, y1, x2, y2)`, model
  coordinates): a node counts when its bounding box (incl. border) lies
  fully inside; a straight edge when both endpoint node *centers* do
  (v3 tests the on-boundary endpoints; centers are the straight-edge
  approximation used elsewhere in the prototype).  `selectionType()`
  is 'single' (tap/box replaces the selection) or 'additive' (taps
  toggle, boxes add).  Mouse/pen only — v3's three-finger touch box
  gesture is not implemented.
- **Batch flush granularity**: `endBatch` re-applies style to elements
  added during the batch and refreshes mapped labels; a sheet set during
  the batch flushes as one whole-graph `applyAll`.  Unlike v3 there is
  no per-notification queue to replay — the renderer is dirty-driven.
- **`cy.json()` is export-only**: the import/restore form throws
  (rebuilding from a snapshot needs stored defs the prototype does not
  keep).  Exported element jsons round-trip through the definition form
  of `elements`/`cy.add()`.
- **Pinch zoom**: two touch pointers zoom about their midpoint (panning
  with it); a second finger cancels any pan/grab in progress, and the
  finger left over after a pinch stays inert until lifted.  Like other
  viewport gestures, no hover/tap semantics apply mid-pinch.  Trackpad
  pinches arrive as ctrl+wheel and take the wheel path.
- **Image export is promise-only**: `png()`/`jpg()` return promises for
  every output form (a synchronous readback is impossible on WebGPU;
  `'blob-promise'` is accepted as an alias of `'blob'`).  Output
  dimensions are capped by the device's max texture size (typically
  8192 px — the export throws rather than tiling; `maxWidth`/`maxHeight`
  are the tool to stay under it), and a viewport export of a zero-sized
  container throws.  `renderTo` is not implemented.
- **`mount`/`unmount`** (round 10): `cy.unmount()` tears down the
  renderer and pointer — the instance becomes headless, with nothing
  lost (the model is CPU-canonical); `cy.mount(container)` re-attaches
  a fresh renderer, which re-uploads every column and rebuilds all
  glyph runs from the model, so mutations made while headless render
  on re-mount.  Re-mounting to the same container is a no-op;
  a different container unmounts first.
- **Device-loss recovery** (round 10): an external device loss emits
  `devicelost` and auto-recovers once — the core re-mounts a fresh
  renderer against the same container (the model is CPU-canonical, so
  columns, glyph runs and pipelines all rebuild), then emits
  `devicerestored`.  If a loss lands while a recovery is in flight, or
  the device can't be re-acquired, the instance goes headless-dead and
  emits `error` (the previous behavior).

## Follow-up hooks

- Slot compaction (tombstones + degenerate quads for now; the cull
  pass already keeps tombstones out of the draw stream).  The
  slot-stable tier — id blob, CSR adjacency, string dictionaries —
  self-compacts since round 11 (see the design decision above); what
  remains is moving live element slots so `highWater`, column capacity
  and pass-iteration widths can shrink, which carries the open policy
  calls (ref survival across a move, trigger, draw order) logged in
  `PLAN.md` ("Logged — compaction").
