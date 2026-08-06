# Cytoscape.js v4 (`src`)

First pass of the v4 performance redesign spec'd in
[#3486](https://github.com/cytoscape/cytoscape.js/issues/3486): a separate
prototype core with a **CPU-canonical columnar model** (typed-array columns,
stable slots, per-column coalesced dirty spans) written through to
**persistent GPU buffers**, rendered by a **WebGPU pipeline** (SDF node
shapes, straight and curved edges — round 12a's bundled bezier +
self-loops and round 12b's unbundled-bezier/segments/taxi families —
reading endpoint positions and curve params on-GPU, GPU picking,
compute culling + indirect draws + LOD).  Round 13 (2026-07-31) swept
the straightforward v3 style props into the prototype — ghosts,
overlay/underlay + core theming, the opacity split, border/outline
geometry, dashes and casing, arrow scalars and mid-arrows, gradients,
custom polygons, and the label prop families (fonts,
min-zoomed-font-size, the alignment grid, source/target labels) —
each with stored-truth readback and a golden and/or live v3
pixel-parity pin (details per prop below and in PLAN.md).  Round 14
(2026-07-31) brought **compound nodes**: parent/child hierarchy with
auto-sized parents materialized into the columnar model,
parents-under-descendants draw order, ancestor-gated visibility and
rendered effective opacity, ported event bubbling, a `parents` sheet
group with structural query/case terms, and compound loop edges.
Rounds 15–18 (2026-08-01) closed the design queue: **background
images** (tiered texture arrays + mips, SVG zoom-promotion, the SDF
icon mode, multi-image parity), **multiline labels + label bounding
boxes** (the wrap family; labels join bb/fit by default),
the **event vocabulary + extension contract** (the curated set +
pointer events; registry-free layouts), and the **GPU force layout**
(CPU reference + on-device integrator under the position lease).
Round 19 (2026-08-01) closed the last open architecture item:
**slot-moving compaction** — live elements move down to a dense slot
prefix (a monotone remap, so compaction is a visual no-op) with
forwarded lazy ref repair, an automatic dead-slot trigger plus
`cy.compact()`, and highWater/capacity shrinking to the current graph
instead of its peak.  Round 20 (2026-08-01) closed the interaction
options + touch parity gap: the tuning quartet (`wheelSensitivity`,
`desktopTapThreshold`/`touchTapThreshold`, `tapholdDuration` — ctor
options + getter/setters), the `events`/`text-events`
pointer-transparency props (a flag bit read by every pick path), and
v3's two-finger cxt and three-finger box touch gestures.  Rounds
21–23 (2026-08-01, the third design sitting) removed the animation
queue (concurrency by channel; promises sequence), split
display/visibility (`show()`/`hide()` keeps the structural tier —
now re-fanning bezier bundles — while the `visibility` style prop is
paint-only invisibility that keeps space and bundle ranks), and
brought **node charts**: v3's pie/stripe props as the lean
list-valued `chart` family with data-driven values and scheme
palettes.  Round 24 (2026-08-01, the fourth design sitting) closed
the animation follow-up: **style transitions** (the `transition-*`
config per sheet group — restyles tween on stored truth with
latest-wins eviction, GPU-offloaded when all-paint, under the
auto-vs-explicit mapper-domain performance contract) and the
**animation controls** (`pause`/`resume`/`reverse` + read-only
`progress`/`paused`).  Round 25 (2026-08-02) built that record's
logged follow-up, the **geometry tweens**: node `width`/`height`,
edge `width` (its style-write-baked derivatives riding along),
compound `padding` and `font-size` animate and transition on the
CPU path — never leased, never stale (`width()`/`bb()`/pick read
the mid-flight value) — with the per-tick invalidation cascade run
by the store's write funnel (label re-anchor, auto-bounds, the
ride lanes) and priced by a dedicated benchmark sweep.
Round 26 (2026-08-02) changed no behaviour at all: it built the
**authoring surface** the release documentation will be generated
from — JSDoc on every public member of the prototype (a 46% → 100%
sweep, gated by a coverage test), and the first shipped
**TypeScript declarations** for `cytoscape`, which carry those
comments into consumers' editors.  See "Documenting the source"
below.
Round 27 (2026-08-02) closed the visual-parity tail rounds 13–16 had
left: v4 now renders **v3's complete node-shape vocabulary** (the
seven `round-*` keywords, `cut-rectangle`, `right-rhomboid`,
`concave-hexagon`, `bottom-round-rectangle` and `barrel`) and
**v3's complete arrowhead vocabulary** (`triangle-tee`,
`circle-triangle`, `triangle-cross`, `triangle-backcurve`), sizes
arrowheads by v3's own nonlinear formula, and accepts a numeric
`text-rotation` on any label.  Each family is pinned by a live
v3-vs-v4 parity diff rather than by a golden alone — see the
round-27 records in PLAN.md for the measurements.  `border-style`/
`outline-style` remain the one unported style pair.
Round 28 (2026-08-03) took what was left of the gap ledger that
needed no design call: **CPU-pick coverage** for round 27's shapes
(the shader halves were pinned by parity diffs, the CPU replicas by
nothing — and three specs named for picking asserted only
`boundingBox()`, so they held with the shape swapped out), the
**`panBy` viewport-animation target**, and the ledger's own drift.
What remains in the ledger is now open *calls* rather than open work
— see PLAN.md.
Round 29 (2026-08-03) asked a different question — not what is
unbuilt but what is **unpinned** — and answered it in five passes:
the 83-method alias surface is now asserted (its type declarations
and its runtime wiring were separate, so deleting a wiring line
typechecked clean), four public methods no spec had ever called are
covered, and the **decided-design drops are enforced at the API
boundary** rather than merely intended — which took fixing three
places where a dropped v3 form was accepted and then failed
elsewhere, or silently not at all.  It also priced curved edges on
the CPU (`benchmark/curves.mjs`) and re-ran the renderer
benchmark on real hardware, which showed round 27's shader branches
cost nothing measurable per frame.
Round 30 (2026-08-03) continued that axis onto the part of the
surface this file states most often and the suite tested least:
**what v4 throws**.  Failing loudly is a decided design — an unknown
sheet key, style property, query key or `boundingBox()` option all
throw — and, measured with source-mapped coverage, **34 of the 191
throw sites in `src` had never executed**.  Every Node-reachable
one now does (20 specs), the six `png()`/`jpg()` export guards are
pinned in the browser project, three pieces of public surface the
survey turned up beside them are covered (`cy.stop()`,
`renderedTargetEndpoint`, the `squaredEuclidean`/`max` clustering
metrics), and the measurement itself ships as
`scripts/throw-coverage.mjs` — see "Measuring the error contract"
below.
Round 31 (2026-08-03) asked the follow-on question — when those throws
fire, do they say the right thing, and does the shipped documentation
admit they exist?  It found **one message advising a form v4 rejects**
(the per-element bypass error sent callers at the style *function*
form, removed in round 8 and throwing since 29.3, and its doc comment
said the same), fixed it to name the mapper replacement, and closed
the documentation half: **every public member that throws now carries
an `@throws` tag** (16/16 at the time, up from 7; **18/18** today),
gated beside the round-26
coverage rule.  It also covered `mouseout` and `pointercancel`, the
only two names of the round-17 event vocabulary no test mentioned.
Note where that defect lived: *this file* has always described the
bypass correctly — the stale advice was in the runtime message and the
JSDoc, which a markdown sweep never reads.
Round 32 (2026-08-03) finished that sentence's last clause: **every
public member that takes arguments now documents them** (221/221 at the
time, up from 143; **232/232** today — round 36.2 widened the audit to
the exported functions it had never walked and 37.3 to the entry point
itself), gated the same way, because
docmaker emits a description per argument and a missing one is a hole in
the release docs rather than only in an editor.
Round 33 (2026-08-03) changed no behaviour either: it was the
**benchmark sweep**, taking the suites from 14 to 22 so that the
surfaces with no measurement at all — layouts, the algorithm tail, the
style engine, loading and the wire format, picking/box-selection/bounds,
the data sidecar and structured queries, events and the animation
lifecycle, store internals — have one, plus a breadth pass over the rest
of the public API and a third audit script (`scripts/bench-coverage.mjs`).
Its real output was **five paths slower than v3 or than v4's own design
implies**, which round 34 (2026-08-03) then **fixed** — `indexOf`,
`mutableElements()` and the emit path's no-listener gate to parity, the
style getters 5.8× → 2.3×, and the layout contract 333 µs → 795 ns per
run.  Both rounds are recorded in "Benchmarks" below.  Round 35
(2026-08-03) answered the maintainer's question about the residual —
why a 150-case switch and not a lookup — by making `readProp` a
dispatch table, **flattening** the per-property spread rather than
uniformly lowering it.
Round 36 (2026-08-04) is the **completion round**: the tail of work
that needed no decision at all, now that what remains in PLAN.md is
otherwise open calls.  `@returns` is complete (276/276 at the time;
ungated until round 37.1), the `@param` gate was found never to have
walked the public tier's exported functions (229/229 then), the
browser-only
throw tier is closed by four specs and three honest reclassifications,
three measurements this repo had promised and never recorded are
recorded, and a **stranded-doc-block check** shipped — which found six
more instances of this codebase's most repeated defect on its first
run, one of them shipping in `dist/cytoscape.d.ts`.
The **fifth design sitting** (2026-08-04) then took every open call in
PLAN.md's ledger at once and planned rounds 37–51 through the release:
`border-style`/`outline-style` at full coverage, a v4 Event and emitter,
the packaging move that makes v4 *the* package (v3 to a self-contained
`v3/`), the small feature tail, the docs generator and site, and the
release engineering — with one question deliberately left open, the
**error policy** (round 40's own sitting).  A second joined it later:
round 41 found that *which* gesture defaults `preventDefault()` should
suppress cannot be derived from v3, so that list is a v4 contract still
to be designed.
Round 37 (2026-08-04) is that roadmap's governance close-out, and it
changes almost no behaviour: the two audits held back on policy calls
now **gate** (throw coverage at zero tolerance, `@returns` at 277/277
then, 279/279 today),
the legacy-alias triage is finally applied as written (`roundrectangle`
drops; `autolockNodes`/`autoungrabifyNodes` are kept as recorded
exceptions), constructor strictness is closed at the *type* layer where
the runtime stays deliberately permissive, and the event-name contract
is documented — a round that also corrected two things this file said
that were not true of the code (see the events and JSDoc sections).
Round 39 (2026-08-04) built the sitting's **decided feature tail**, three
independent small things: **overlap box selection**
(`boxSelectionMode`), **graph-level `data()` on the binary wire**
(format version 4, applied by `options.elements` and deliberately
ignored by `cy.add`), and **`cy.gc()`** as the explicit alias of
`compact()`.
Round 41 (2026-08-04) gave v4 **its own Event object and emitter**,
severing the last import v4 made of v3's event machinery: `event.target`
is typed, `originalEvent` is populated by the interaction layer at last,
and the namespace parsing v4 had been inheriting — and contradicting its
own design with — is gone.  Two of that round's premises turned out to be
unmeasured claims: the emitter was not v4's *only* remaining shared
import (five utility modules remain, now audited), and
`preventDefault()`'s gesture half could not be enumerated from v3, which
never reads the flag either — so that half is an open call.
Round 42 (2026-08-04) is the packaging move, and it changes no
behaviour: **v4 became the package.**  This source promoted from
`src/gpu/` to `src/`, the whole v3 file set moved into a
self-contained `v3/` subproject that still builds and tests on its
own (`cd v3 && npm run build`), and the root `package.json` is v4's
alone — `cytoscape@4.0.0-unstable`, v4 as `exports["."]`, `./gpu`
kept as a deprecated alias.  The `gpu-`/`webgpu-` prefixes dropped
from the test, benchmark, script, debug and Playwright names; the
five utility modules v4 had still been importing from v3 are now
v4's own copies, so nothing under `src/` imports outside it.  The
factory, the bundles, the declaration, the UMD global **and the
exported type names** are all plainly `cytoscape`'s now: `Core`,
`Collection`, `Event`, `Stylesheet`, `CytoscapeOptions` and the rest
lost the `Gpu` prefix in 42.6, with no deprecated aliases — the
prerelease line has no published consumers to break.  Six internal
names keep it (`GpuContext`, `GpuTimer`, `GpuForceRuntime`,
`GpuTweenRuntime`, `GpuTweenSink`, `GpuWriteKind`), where it means
the *device* half against a CPU counterpart rather than "the
prototype"; that is the same rule that kept `gpu-context.mts` and
`render/gpu-*.mts` while `gpu-types.mts` became `public-types.mts`.
v3 stays untouched inside `v3/`, so every v3 asset remains
available for comparison benchmarks and parity work.
Round 43 (2026-08-04) rebuilt the **debug harness** — v4's only
manual page — which had been quietly discarding the whole style
surface: its sanitizer kept a 14-property whitelist and dropped
every mapper, so each fixture rendered as flat monochrome discs.
It now carries hand-authored v4 sheets per network (including the
real enrichmentmap.org style, whose per-element colour function
becomes one `diverging` mapper), two genuinely compound graphs, the
v3 page's view/layout/toggle/selection/event/add-remove sections,
and a module spec that compiles every sheet against its own fixture.
The round also fixed the background-grab indicator, which had never
followed the cursor — see the core-theming notes below.
Rounds 44, 45, 47 and 48 (2026-08-04/05) are the release sequence's
decision-free part: **44** gates the packaging chain (rolldown
outputs → `dist:copy` → the manifest → the tarball, every link
hand-maintained and none of its failures loud); **45** is the
**docs generator**, turning nineteen rounds of gated JSDoc into 362
documented members validated against the shipped declaration —
and it found `event.mts` outside the audit's public tier, optional
class members invisible to every audit, and a layout-extension
contract that shipped no types at all; **47** is the **migration
guide** (`MIGRATING.md`) and `CHANGELOG.md`, whose property table is
measured against both libraries rather than remembered; and **48**
is the **soak tier**, which found four defects — a corrupt wire
buffer that made a load never return, two more costing 25.9 s and
5.7 s, and element identity comparing equal across two instances,
so `union()` silently dropped the other graph's elements.  Each has
its own section below.

Culling: a compute pre-pass per group (nodes, edges, glyphs) compacts the
drawable slots into a visible list + `drawIndexedIndirect` args — a
deterministic three-dispatch stream compaction that preserves slot order
(the in-group z-order), with an exact segment-vs-rect test for edges — so
the render pass draws exactly what's visible instead of running the vertex
shader over every allocated slot.

- Entry point: `cytoscape(options)` from `src/index.mts`
  (`import cytoscape from 'cytoscape'`, UMD global `cytoscape`).
  It ships **TypeScript declarations** since round 26.5 —
  `dist/cytoscape.d.ts`, built by `npm run build:types`, carrying
  the source JSDoc through to editors.
- Headless-friendly: without a `container` no GPU is required (Node-testable).
  With a `container`, WebGPU is mandatory — the factory throws synchronously
  when `navigator.gpu` is missing, and `.ready` rejects when no adapter can
  be acquired.
- Events: v4 owns its own `event.mts` and `emitter.mts` since round 41
  — one emitter per core holding every listener (core, delegated and
  per-element) told apart by a qualifier, and an Event object with a
  typed `target`, a populated `originalEvent` and no namespace field.
  Before that round both came from v3's shared modules, which is how
  v4 spent thirty rounds running namespace semantics its own design
  had dropped.
- `contract.mts` is the co-signed source of truth for the column/flag layout
  shared by the model (`store/`) and the renderer (`render/`) — change it
  first when the layout changes.
- Manual testing: `npm run watch` → http://localhost:3333/.  The harness
  (round 43) offers nine networks — six from real exports (four fixtures
  shared with v3's WebGL harness under `v3/debug/webgl/`, the 465k-edge
  `ndex-x-large` local to `debug/`, and a clustered variant derived from
  em-web in-page) and three built in-page — each with a hand-authored v4
  stylesheet, plus sections for
  the viewport, layouts, the core toggles, query-object selection, an
  event log and add/remove.  `test/modules/debug-harness.mjs` is its only
  automated coverage: every fixture exists at the path the page fetches,
  every sheet compiles against that fixture's real data, the compound
  fixture lays out into disjoint parent boxes, the event log reads
  layout once per frame rather than once per event, and `watch:sync`
  binds livereload on every interface (the 2026-08-05 review pass —
  three defects the harness's first real user found, recorded under
  round 43 in PLAN.md).
  Browser tests: the `renderer` Playwright project, plus the
  `visual` project — golden-image diffs (pixelmatch against PNGs
  in `playwright-tests/goldens/`, pinned to the SwiftShader adapter so
  the goldens are machine-independent; regenerate intended changes with
  `UPDATE_GOLDENS=1`) and live v3-vs-v4 parity diffs
  (`playwright-page/parity.html` renders both renderers side by side —
  no v3 baselines are checked in).  The two answer different
  questions, and round 27 is the cautionary tale: a golden compares
  v4 against *its own* previous output at a 0.5% tolerance, so it
  asks "did this change?", while only the parity diff asks "is this
  right?".  v4's arrow sizing deviated from v3 at every width and
  the arrow goldens passed throughout, before and after the fix.
  **Anything claiming v3 parity needs the parity diff**, and a new
  parity test should be run once with its feature disabled to prove
  it can fail.  A WYSIWYG self-diff spec pins
  `png()` to the on-screen pixels.  On Linux both Chromium projects add
  ANGLE-on-Vulkan compositing flags (see `playwright.config.js`) —
  without them Dawn renders fine but WebGPU canvases *present* blank in
  headless Chromium (adapters acquire, composited pixels stay
  transparent); the flags are Linux-gated because `--use-angle=vulkan`
  does not exist on macOS (Metal).  A second adapter footgun
  (2026-08-01): `requestAdapter()` returns null on `about:blank`, so
  probe adapters from a served page — a bare-page probe reads as
  "no GPU" on a box that has one.

## API scope (pass 1)

v3's method **aliases** are kept throughout (`each`/`forEach`,
`centre`/`center`, `bc`/`betweennessCentrality`, the set-op spellings,
…): 84 of them across the core and collection (83 through round 29;
`gc` joined in 39.3), each a `declare` in the
class body plus a separate prototype assignment.  Since round 29.1 the
whole surface is pinned by a table in `test/aliases.mjs` that
asserts alias-target identity and cross-checks itself against the
sources in both directions — the type declaration alone would keep the
typecheck green if a wiring line were deleted.

Core: viewport fns (`zoom`, `pan`, `panBy`, `fit`, `center`, `extent`,
plus `reset`, `viewport`, `zoomRange`, `getFitViewport`/`getCenterPan`,
`renderedExtent`, `size`), events (with the usual aliases +
`onRender`/`offRender`; delegation via predicate functions), graph
manipulation, `style()` (the `{ nodes, edges, parents, core }`
sheet), `layout()`/
`makeLayout` (grid, preset, circle, concentric, breadthfirst, random,
and — round 18 — the GPU-capable `force`; plus the round-17
**extension contract**: `cy.layout({ impl })` runs a user layout
class/object with no registry — plus `eles.layout()` for subset
scopes and the v3 `layoutPositions`
plumbing with spacingFactor/transform/animate — an animated layout
fits by animating the viewport to the box at the *final* positions,
concurrently with the node tweens), `pick()`, `png()`/`jpg()` (async image
export — see the design decisions below),
`renderer()`/`forceRender()`/`resize()`, graph-level
`data()`/`scratch()`, batching (`startBatch`/`endBatch`/`batch`/
`batchData`/`batching` — see below), `json()` (export-only),
box selection (`elementsInBox` + the pointer gesture — mouse/pen,
and the round-20.5 three-finger touch box),
`selectionType`, `boxSelectionIncludesLabels` (round 16.5) and
`boxSelectionMode` (round 39.1),
the round-20.1 interaction tuning quartet (`wheelSensitivity`,
`desktopTapThreshold`/`touchTapThreshold`, `tapholdDuration` —
ctor options + getter/setters, see the gestures notes below),
interaction gating
(`autolock`/`autoungrabify`/`autounselectify`,
`panningEnabled`/`zoomingEnabled` + `user*` variants,
`boxSelectionEnabled`), introspection (`instanceString`, `isReady`,
`headless`, `mutableElements`, `hasElementWithId`/`$id`, `options`),
`destroy()`, `width()`/`height()`, and `compact()` (round 19 — the
explicit form of the automatic slot-compaction trigger; see below;
`gc` is its alias since round 39.3).
Collections: `cy()`/`renderer()`/`element()`, events, graph
manipulation (incl. edge `move()`), position/dimensions (model +
rendered, `shift`, silent variants, edge `midpoint`/endpoints —
curve-aware since round 12a, along with `controlPoints`/
`renderedControlPoints`/`isBundledBezier`, and — 12b —
`segmentPoints`/`renderedSegmentPoints` for segments/taxi edges, with
`controlPoints` covering unbundled-bezier control lists; since 12c
haystack edges answer endpoints/midpoint/bb with their offset
points, and manual-endpoint edges resolve everything through the
route evaluator),
iteration (`sort`, `reduce`, `max`/`min`), comparison, building/
filtering (`byGroup`, `diff`, `absoluteComplement`, set aliases),
traversal (`outgoers`/`incomers`, `roots`/`leaves`,
`successors`/`predecessors`, `edgesWith`/`edgesTo`,
`parallelEdges`/`codirectedEdges`, `components`), the compound
surface (round 14: `parent`/`parents`/`ancestors`/`children`/
`descendants`/`siblings`/`orphans`/`nonorphans`/`commonAncestors`,
`isParent`/`isChildless`/`isChild`/`isOrphan`, `move({ parent })`,
compound-relative `relativePosition`, real `padding()`/
`paddedWidth`/`paddedHeight`), degree
(`degree`/`indegree`/`outdegree` are singular first-element accessors as
in v3 — the whole-collection sum is `totalDegree` — plus min/max stats),
`select`/`unselect`/`selectify`, `grabbable`/`lock`,
`active`/`activate`, `pannable`/`panify`,
`show`/`hide`, `data()`/`scratch()`/`json()`, `label()` (read-only),
read-only style getters (`style`/`css`, `renderedStyle`,
`numericStyle`, `effectiveOpacity`/`transparent`/`takesUpSpace`/
`interactive` — since round 20.2 `interactive()` folds the `events`
prop, and since round 22 `visible()` is the draw tier while
`takesUpSpace()` is the space tier — see below),
`boundingBox({ includeLabels })` +
`labelBoundingBox()` (round 16.4), the `background-image` family
(round 15), the wrap family (round 16), the round-22 `visibility`
prop, the round-23 `chart` family, the round-24 `transition-*`
config in the sheet (whose tweenable set grew the geometry numerics
in round 25 — width/height, edge width, padding, font-size — the
same channels `animate()` accepts), the round-17
event vocabulary (pointer*/tap*/grab-drag-free families, viewport
gestures), and graph algorithms (round 10, growing):
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

Ghost props (round 13 A1): `ghost` ('yes' | 'no'), `ghost-offset-x/y`
and `ghost-opacity` duplicate the *basic node body* — shape, border,
background — at the offset as one extra instance draw under the node
(the 2026-07-29 triage's simplified scope: never a whole-node redraw;
labels and decorations excluded).  All four are node-only and
mapper-capable; offsets grow the bounding-box scans.  Recorded
deviations: ghosts are not pickable and box selection ignores ghost
extents.  The renderer pays nothing while no node styles a ghost (the
ghost cull + draw are skipped outright at a live count of 0).

Overlay/underlay (round 13 A2, nodes): the 10 `overlay-*`/
`underlay-*` props draw a filled round-rectangle or ellipse around
the node's size + padding — the underlay under the body, the overlay
above it (and, a recorded deviation, *under* the label layer — v3
draws overlay over its node's label).  Color/opacity/padding are
mapper-capable; layer opacity folds into the stored color (folded
readback); padding grows the bb scans; zero-cost when unused.
`line-outline-width`/`-color` (round 13 B4) stroke a casing under
the edge line at width + outline width via the same layer machinery,
alpha folded by v3's effective line opacity; an enabled casing
demotes the element-opacity mapper to the CPU path (the fold must
track writes).  Edge layers stroke the edge geometry at width + 2 × padding (every
family — haystack offsets and the triangle taper included), the
underlay under the edges and the overlay over edges + arrows, both
under the nodes; strokes are solid with butt caps (v3 rounds stroke
ends — a recorded deviation), and `overlay-shape`/`-corner-radius`
stay node-only.

Core theming (round 13 A2): the sheet takes an optional `core` group
with v3's core-selector props, constants only —
`selection-box-color`/`-opacity`/`-border-color`/`-border-width`
theme the DOM selection box, and `active-bg-color`/`-opacity`/`-size`
drive the background-grab indicator circle at the press point (a DOM
element above the canvas, like the selection box — v3 draws it into
the canvas, so v4 exports never include it; recorded).
**The indicator is anchored in model space** (round 43.7, v3's rule):
it was positioned once at pointerdown in screen space and never moved
again, so a background pan slid the graph out from under it.  The
press point is now stored as a model position and re-projected per
move, which keeps it glued to the point pressed.  The two are
observationally identical during a pan — the graph delta *is* the
cursor delta — and differ only when a press stays in pan mode while
nothing pans, which needs both `userPanningEnabled` and
`boxSelectionEnabled` off (otherwise the drag becomes a box gesture
and shows no indicator at all).

The channel-opacity split (round 13 B1): `background-opacity`,
`border-opacity`, `line-opacity` and `text-opacity` fold into the
stored channel alphas at write time (element `opacity` stays the
master multiplier, its own column).  The arrow fold is
base × opacity × line-opacity (v3's effective arrow opacity), all
four props take CPU mappers, and readback is folded.  A non-1 (or
mapped) channel opacity demotes the sibling color channel's GPU
mapper eval to the CPU path (the kernel would overwrite the folded
bytes) — a recorded scope note.  Note the pre-existing band rule:
the node FS picks border *or* fill per fragment, so a translucent
border shows the border color alone where v3 blends it over the
fill in the inner band half.

Node outlines (round 13 B5): `outline-color`/`-opacity`/`-width`/
`-offset` draw a solid ring outside the border at offset/2 past its
outer edge — exactly v3's scaled-path stroke for circles and squares
(anisotropic shapes deviate from v3's per-axis scaling, recorded);
ghosts carry their outline; outlines are not pickable and grow the
bb by offset/2 + width.  `outline-style` is still unbuilt, with
`border-style`: both need a *perimeter* coordinate the node
fragment shader does not have.  The edge shader dashes for free
because it carries `u` (model px along the edge) as a varying,
whereas `nodeSD` returns a bare signed distance and discards the
nearest-feature information a perimeter parameter would be built
from.  Closed form exists for circles and rectangles; polygons need
the SDF loop to also track the argmin edge and its clamped
projection against a cumulative perimeter — which is a scope call
(which shapes earn the cost) rather than a missing technique.

Border geometry (round 13 B2): `border-position` defaults to v3's
`center` (the band straddles the boundary — v4 previously drew all
borders inside, an unrecorded deviation now closed), and
`corner-radius` (number | 'auto') feeds the round-rectangle SDF in
the node/ghost shaders, the depth prepass and the CPU pick alike,
with 'auto' = v3's min(w/4, h/4, 8) (previously min(w, h)/8; also
closed).  bb keeps the outerHalf center convention for every border
position, matching v3's outerWidth.

Gradients (round 13 C2): `background-fill`
(solid | linear-gradient | radial-gradient) with stop
colors/positions and v3's `to-*` directions, and `line-fill` with
stops along the drawn span (the polyline arc length on curved
edges; radial mirrors about the midpoint).  Stops interpolate in
sRGB (v3's canvas gradients — OKLab stays the mapper default), cap
at 5 per element, and stop lists are constants-only; the
fill/direction enums take mappers.  The depth prepass skips
gradient fills conservatively, and plain-LOD far-zoom discs show
the flat base color (both recorded).

Custom polygons (round 13 C3): `shape: 'polygon'` with
`shape-polygon-points` — flat unit pairs in v3's [-1, 1] space —
stored per element in a second curve-blob pool whose packed
offset|count ref rides the `borderGeom` radius word (meaningless
for polygons).  The node FS runs an exact sdPolygon loop over the
blob range (crisp AA and borders under anisotropy, like the
generated shapes) and CPU pick runs point-in-polygon over the same
record — dual consumers, agreeing by construction.  Points are
constants-only (one list per sheet), validated (even count, >= 3
pairs, values in [-1, 1]) and capped at 32 points (recorded); unit
points keep the bb term at the node box.

## Multiline labels + label bounding boxes (round 16)

Landed 2026-08-01, per the PLAN.md round-16 plan:

- **The wrap family** (both label groups, mapper-capable):
  `text-wrap` (`none | wrap | ellipsis`), `text-max-width`,
  `line-height`, `text-overflow-wrap` (`whitespace | anywhere`) and
  `text-justification` (`auto | left | center | right`) — v3's
  keyword sets, defaults and breaking rules (`wrap` honors embedded
  newlines and greedily word-wraps; over-long words overflow under
  `whitespace` and split under `anywhere`; `ellipsis` truncates one
  line with '…'; `auto` justification resolves against
  `text-halign`, v3's hanging-label rule).
- **One breaker, three consumers**: `label-wrap.mts` (gpu root) is a
  pure module with injected advances — the renderer lays glyphs with
  real atlas advances behind a **shaping memo** (labels are
  model-space, so breaking is zoom-invariant and identical
  (text, wrap-params) pairs share one laid block; hits/misses ride
  `renderer().stats()`), while the store estimates dims with flat
  advances so bounds work headless.  Exact laid dims feed back into
  the store per glyph build.
- **Labels join `boundingBox()`/`fit()` by default**:
  `boundingBox({ includeLabels })` (default true; unknown keys
  throw) on collections, `renderedBoundingBox`, the whole-graph
  store scan behind no-arg `fit`/`center`/`getFitViewport`, and
  `boundingBoxAt` (animated-layout fit targets cover labels).  Node
  labels are exact (the laid block at its D3 anchor + text-box
  padding); edge labels are conservative (a rotation-safe
  block-covering radius about both endpoints — sound wherever the
  anchor lands on the drawn path).  `eles.labelBoundingBox()` is
  the public exact measure — the v4 form of v3's text-metrics.
- **`boxSelectionIncludesLabels`** (core option + ctor, default
  false — v3's box-select-labels default): when on, box selection
  requires the node's label box to be contained too.
- Recorded deviations: headless label dims are flat-advance
  *estimates* (rendered instances upgrade them to exact); the
  edge-label bb term is conservative (fit may slightly over-fit,
  never under); alignment shifts and text boxes use block metrics
  (advance width × line-stacked height), not ink extents.
- Costs (Node sweep, `benchmark/labels.mjs`): wrapped-label
  builds ~5 µs/label at 100k (write-driven — per frame only under a
  round-25 font-size tween on a *wrapped* label, the recorded
  expensive configuration; wrap-none tweens ride the dims fast path);
  the whole-graph bb scan pays ~0.1 µs/label for its label terms.

## The force layout (round 18)

Landed 2026-08-01, per the PLAN.md round-18 plan — the round-9 "GPU
layouts" design, built:

- **`cy.layout({ name: 'force' })`** — spring–electric with
  uniform-grid cutoff repulsion, springs toward per-edge ideal
  lengths (`edgeLength` as a number or a plain fn resolved once),
  centering gravity, and pure damped gradient integration under
  d3-shaped alpha annealing.  Seeded and deterministic on the CPU
  executor (`seed`, `randomize`); leaves only (parents derive);
  locked nodes pin as obstacles; subset scopes simulate the subset
  only.  Runs through the round-17 extension contract — the
  built-in is the contract's first production consumer.
- **Two executors, one spec.**  The CPU reference
  (`layout/force-sim.mts`) always exists — headless instances,
  compound graphs (the 14.11 lease rule), `animate: false` — and is
  what the Node specs pin.  Under `animate: true` on a flat
  rendered graph, the **GPU integrator** (`render/gpu-force.mts`)
  takes over: six dispatches per iteration (grid build by counting
  sort → force gather → apply-and-publish) encoded ahead of the
  cull pass, so 100k-node layouts animate live with edges and
  labels following on-GPU.  `node.position` is GPU-owned for the
  run (the tween lease — CPU reads stale mid-run, the
  motion-staleness rule), and convergence triggers **one readback**
  (the round-9 exception) that settles the CPU columns through the
  normal dirty-span path.
- Recorded deviations/limits: a cutoff model does not promise
  global untangling (a curled chain is a legitimate local minimum —
  multilevel refinement is future work); the repulsion cutoff is
  the mean ideal edge length (a connected pair's equilibrium is L
  itself); GPU trajectories are not bit-stable run-to-run (atomic
  in-cell scatter order) — seeded bit-reproducibility is the CPU
  executor's guarantee, and the executors agree on invariants, not
  trajectories; live streaming writes through the bulk slot path,
  which emits no per-node position events.
- Harness: `debug/?layout=force` (+ `&seed=N`); benchmark:
  `benchmark:renderer -- --layout` runs a live force to
  convergence per scene (v3's cose as the classic baseline, bounded
  by nested test-style timeouts — a 30 s in-page stop reporting a
  measured floor and a 60 s runner-side bail reporting "> 60 s",
  since a single cose iteration outgrows any in-page cap at
  benchmark scale; `--layout-uncapped` measures full runs).  On an
  RX 580 (re-measured 2026-08-04, round 36.5; first run 2026-08-01,
  PLAN.md "hardware validation pass"): force converges in **0.76–1.6 s**
  across 25k, 100k and ndex — and in **14.8 s** on the compound scene,
  which runs the CPU executor under the 14.11 lease rule — where the
  cose baseline exceeds the 60 s bail on every scene.  Read these rows
  as **±25%**: round 18.3 recorded that GPU trajectories are not
  bit-stable run-to-run (atomic in-cell scatter order), so the iteration
  count to convergence varies, and the 2026-08-01 and 2026-08-04 runs
  differ by −20% to +24% *in both directions* with nothing in the layout
  path having changed between them.

## Slot compaction (round 19)

Landed 2026-08-01, per the PLAN.md round-19 plan — the last open
architecture item, closing the policy questions logged since the
2026-07-27 compaction analysis (the slot-stable tier — id blob, CSR,
dictionaries — has self-compacted since round 11; this round moves
the element slots themselves):

- **What it does.**  Live elements move down to a dense slot prefix
  per group, so `highWater` (every CPU pick walk and GPU cull
  dispatch width) and column capacity (CPU columns, GPU mirrors,
  mapper regions) shrink to the *current* graph instead of its peak.
  The remap is **monotone** — relative slot order is preserved by
  construction — which is what makes the three design calls cheap:
  draw order is unchanged (compaction is a **visual no-op**, pinned
  by a byte-identical screenshot spec), curve bundle rank / loop
  stagger / orientation signs are unchanged (derived params survive
  with no re-derivation), and CSR incident order is unchanged.
- **Refs survive via forwarding + lazy repair.**  Moved elements take
  fresh generations, so every stale ref *fails* plain validation and
  routes through a per-group forwarding chain that rewrites the ref
  **in place** on first touch — fixing every holder of that object.
  Collections sync lazily against a compaction epoch (one int compare
  on the hot path; the packed membership cache drops with it),
  interned handles keep their identity and scratch (`cy.$id` returns
  the same object), element-bound listeners keep firing and stay
  removable, and running animations re-key with their slot lists
  re-pointed.  A removed element's ref stays dead — repair never
  resurrects.  Forwarding entries persist and compose across
  compactions.
- **Triggers: auto + explicit.**  The automatic trigger applies the
  round-11 waste-over-half policy to slots — dead slots exceeding the
  live count, past a 1024-slot floor — at safe boundaries (a
  completed `remove()`, the outermost `endBatch`).  `cy.compact()` is
  the explicit form for deterministic timing — **`cy.gc()` is its alias**
  (round 39.3), v3's name for the same idea, kept because an upgrading
  app already types it and v4 has no separate garbage-collection concept
  for it to name instead; it throws mid-batch and
  defers (with a warning) while a GPU force run owns the position
  column.  Mid-flight GPU tweens **demote** to the CPU path (they
  write the value reached, leave the device, and finish on repaired
  slot lists — not ended early, unlike the reparent settle).
- **Renderer handshake**: the `resized` flags drive the mirror's
  capacity-aware realloc + full re-upload and the pick-cache
  invalidation; the mapper runtime rebuilds its capacity-aligned data
  regions; the parent draw permutation re-uploads; and the glyph
  streams **clear wholesale** before rebuilding (owner slots are baked
  into glyph instances — an incremental rebuild could alias a moved
  element's stale run onto a different element's new slot).
- Recorded limits: data-sidecar column buffers permute **in place**
  and never shrink (bound mapper evaluators hold them by reference);
  the conservative monotone maxima (curve slack terms) are not
  recomputed at compaction (sound — slack can only be loose); the
  auto trigger never fires mid-batch or during a live force run
  (deferred to the next boundary).
- Costs and wins (Node sweep, `benchmark/compaction.mjs`,
  200k-node peak cut to 10%; the renderer bench's compaction scenario
  measures the device side — see below): `compact()` is a ~114 ms
  one-shot, and the auto trigger adds it to a removal whose own
  cascade + emits cost ~1.8 s at this scale (~6% overhead); the
  held-collection first-touch repair of 20k moved refs is ~0.5 ms;
  the synchronous CPU node pick drops ~5.5× (2.15 → 0.39 ms
  background miss); cull dispatch width falls 200k → 20k lanes per
  group per frame; column memory falls 37 → 4.6 MiB (nodes) and
  76 → 0 MiB (edges).  The forwarding machinery is free on the hot
  path: `isCurrent` on a current ref is parity (1.01×) with forwards
  present, and a stale-ref chase + rewrite is ~40 ns once per ref.
  Honesty controls pin what compaction does *not* change: order-list
  scans and whole-graph bounds are ≈parity (1.1–1.2×, dense-prefix
  cache locality), since those ride the insertion-order list that has
  self-compacted since round 11.  On the device (RX 580, the renderer
  bench's compaction scenario): wall time stays at the vsync floor —
  a 10%-live scene was already fast — but the *unbounded* GPU pass
  isolates the dead-lane overhead compaction removes: panning 10k
  live nodes over 100k + 300k peak lanes costs 2.2 ms/frame of
  device time, 0.5 ms once compacted (4.4×); in-browser `compact()`
  is a ~60 ms one-shot at that scale.

## Event vocabulary + the extension contract (round 17)

Landed 2026-08-01, per the PLAN.md round-17 plan — two permanent-API
calls made deliberately rather than by accretion:

- **The curated event vocabulary.**  Adopted with v3 semantics:
  the drag-state family (`grab`/`grabon`, `drag`, `free`/`freeon`,
  `dragfree`/`dragfreeon` — the `-on` variants only on the directly
  grabbed element, the plain forms on it and every selected
  companion), the device-normalized family (`tapstart`, `tapdrag`
  while pressed, `tapend`, `tapselect`/`tapunselect`,
  `tapdragover`/`tapdragout`, `cxtdragover`/`cxtdragout`), the
  viewport gestures (`dragpan`, `scrollzoom`, `pinchzoom` — core
  level, with positions), and the **official pointer family**
  (`pointerdown`/`pointermove`/`pointerup`/`pointercancel`/
  `pointerover`/`pointerout`) — the events the interaction layer
  itself consumes, so touch rides the same paths by construction.
  **Dropped, recorded**: the `vmouse*` aliases (`tap*` is the
  normalized vocabulary) and v3's raw mouse/touch re-emits
  (`mousedown`/`click`/`touchstart`/... — `pointer*` is their one
  modern spelling; the existing `mouseover`/`mouseout` stay);
  `event.preventDefault()` is **half wired** (round 41.4).  The DOM
  half works: `originalEvent` is populated by the interaction layer
  since 41.4 — the DOM event a gesture came from is reachable from the
  handler, and `preventDefault()` reaches the browser's default through
  it.  The *gesture* half does not: nothing in `src` reads
  `isDefaultPrevented()`, so the call cannot stop a tap selecting or a
  grab starting, and those defaults stay gated by options.  The fifth
  sitting decided that half should be built; round 41 found the
  enumeration it planned to derive **cannot be derived** — v3 never
  reads the flag either, so the list of preventable defaults is a v4
  contract to design rather than a v3 behaviour to port.  It is open
  call 12 in PLAN.md.
  **"Dropped" here means "never emitted", not "rejected"** (measured
  2026-08-03): `cy.on('vmousedown', h)`, `cy.on('mousedown', h)`,
  `cy.on('click', h)` and `cy.on('touchstart', h)` all register
  cleanly and then never fire, so a ported v3 handler silently does
  nothing.  **Call taken (2026-08-04, fifth sitting): these names stay
  open** — custom events are supported API (`node.emit('foo')`), so a
  name cannot be validated against a list without breaking them.  No
  denylist; the behaviour is documented on `on()`/`emit()` instead
  (round 37.4) and pinned by specs.
  Event **namespaces** were a longer story than this file told.  It
  claimed for several rounds that `'tap.ns'` fired for neither `tap`
  nor `tap.ns`, and that the shared emitter kept its namespace parsing
  "only for v3"; round 37.4 measured both and found them wrong — v4
  imported v3's emitter, so namespaces worked in **full v3 semantics**,
  and the only true part was that v4 never *emits* a qualified name.
  **Round 41.2 closed it properly** by giving v4 its own emitter: a
  type is matched whole, so `'tap.ns'` is one literal name that
  `emit('tap')` does not reach and `emit('tap.ns')` reaches alone.  The
  design and the code finally agree, and a spec pins the new rule row
  by row.
  Deviation: `tapdragover`/`cxtdragover` target **nodes only** (the
  synchronous CPU pick; edges would need the async GPU tile).
- **Extensions are direct objects — no registry.**  No
  `cytoscape.use`, no string registration, no global state: an
  extension layout is an import passed straight to
  `cy.layout({ impl, ...opts })` (or `eles.layout`) — a class or
  object implementing `{ run(ctx), stop?() }`, `run` optionally
  async (the GPU-layout shape).  The **LayoutContext** is
  columnar-first — `nodeSlots()` pre-filtered to unlocked leaves,
  live position/endpoint views, O(1) CSR degrees, bulk
  `setPositions`, the `layoutPositions` finisher with the whole v3
  plumbing — with handles reachable at `ctx.eles`.  Lifecycle
  events fire on the core exactly once per run; layout instances
  stay non-emitters.  Core/collection/renderer extension points
  stay out (recorded: mappers + predicates cover the common cases;
  revisit on demand).  A worked example (`SpiralLayout`) ships in
  `debug` (`?layout=spiral`), and the contract-conformance
  specs in `test/layout-contract.mjs` are the template external
  authors can crib.
  **The contract's types ship since round 45**: `LayoutContext`,
  `LayoutImpl` and `CustomLayout` are exported from the entry point, so
  `run( ctx )` has a real parameter type.  Until then only
  `CustomLayoutOptions` reached the declaration and `LayoutContext` was
  in none at all, so the one surface the contract exists to make obvious
  was the one an external author had to type by hand.

## Design decisions (v4 API direction)

Decisions made for the v4 direction and reflected in this prototype;
each is deliberate, not a pass-1 deferral:

- **No selector strings, anywhere.**  v4 drops the selector language
  outright — there is no parser, no dialect of v3 selectors, and no plan
  to grow one back.  The replacements, by role:
  - *Queries* (evaluate now → collection): structured **query objects**
    compiled to the matcher IR — `cy.nodes({ selected: true })`,
    `cy.filter({ group: 'edges' })`, `eles.filter({ selected: false })`,
    structural booleans (round 14.7: `parent`/`child` — nodes only,
    answering v3's `:parent`/`:childless`/`:child`/`:orphan` as pure
    flag scans; an explicitly-edges query with a structural key
    throws), and data conditions over the sidecar columns (round 10):
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
  - **The rejection is enforced at the boundary** (round 29.3), which it
    was not before: a selector string now throws from the query
    compiler, from the twelve collection methods that take another
    collection, and from event delegation, each message naming the
    replacement.  Previously a v3 string produced "Unknown query key
    '0'" (its character indices read as keys), an internal
    `other._refs is not iterable`, a silent `same() === false`, or — for
    `cy.on('tap', 'node', cb)` — a TypeError raised *inside the emitter
    on the next tap*, which is both late and somewhere else.  The whole
    ledger of removals is pinned by `test/decided-drops.mjs`.
- **The matcher IR is the contract, not a syntax.**  `matcher.mts`
  compiles a query to per-group `(mask, want)` flag tests answered by
  one columnar scan (`GraphStore.scanRefsInto`) — no element handles, no
  per-element matching.  Richer predicates later (data over the sidecar
  columns, structural terms) extend the IR with more test kinds; any
  future frontend (chained builder, serialized JSON query) compiles to
  it rather than growing its own matching.
- **Strictness resolves at the type layer at the constructor, and at
  runtime everywhere else** (decided 2026-08-04, fifth design sitting;
  pinned by round 37.3).  v4 fails loudly on an unknown sheet key,
  style property, query key or `boundingBox()` option, on the
  reasoning that a typo must not silently do nothing.  The
  **constructor is the deliberate exception**: `{ motionBlur: true }`
  and `{ totallyUnknownOption: 1 }` construct happily and round-trip
  through `cy.options()`.  The reason is that the typo guard already
  exists one layer up — TypeScript's excess-property check rejects
  both against `CytoscapeOptions` — and v4 does not replicate at
  runtime what the build checks.  The boundary is TypeScript's, and
  worth knowing: excess-property checking applies to object
  *literals*, so options assembled into a variable first are widened
  and pass.  Both halves are pinned — a Node spec for the
  permissiveness, and four `@ts-expect-error` directives in
  `typescript/tests/api.test-d.ts` that fail the typecheck if the
  options type ever stops rejecting excess keys.
- **No classes in v4** (`addClass`/`removeClass`/class selectors).  The
  role classes played in v3 — user-defined state driving filtering and
  styling — belongs to the columnar `data()` sidecar (for state) plus
  mappers and predicates (for behaviour).
- **No z-index in v4** (decided 2026-08-01).  Draw order is
  structural — compound parent bodies, then edges, then leaf nodes,
  then labels, slot order within a stream — and stays that way:
  `z-index`, `z-compound-depth` and `z-index-compare` are not coming
  to v4, and neither is a built-in grab-raise.  Element stacking is a
  document/UI concept without a strong graph use case: node overlap
  is a layout artifact rather than an authored arrangement, layered
  emphasis is served structurally (overlay/underlay props, opacity
  dimming), and v3 carried the prop triple at the cost of a
  whole-scene comparator sort per frame.  Edges into child nodes stay
  visible because parent bodies draw under all edges (the round-14
  stream split).  If real demand for raise-above-the-crowd styling
  ever appears, the logged extension is a single boolean elevated
  tier (one extra batch per group) — never arbitrary integer
  stacking.
- **Style is `{ nodes, edges }`, no selector blocks and no style
  functions.**  Each key is a props object whose values are constants or
  mapper objects; all per-element variation is declarative (scales and
  `case` conditionals), so every value is analyzable, serializable, and
  GPU-evaluable.  The opaque `(ele) => props` form was removed — its
  cases are covered by mappers (`case` for conditionals, `data(id)` for
  identity), and selection-dependent recolouring is intentionally gone
  (the `:selected` accent ring is shader-drawn).  Removed means
  **rejected**, since round 29.3: a group written as a function throws
  at `setSheet`.  Until then it was silently *ignored*, so a v3
  stylesheet ported wholesale produced an unstyled graph and no error —
  the worst available failure mode for a decision this deliberate.
  Everything stays fresh
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
  values only) — the O(n) case; an explicit `domain` keeps every data
  write O(changed elements), the round-24 performance contract (pin
  `domain` when a stream grows its own extent — see the transitions
  bullet).  Refresh is dependency-gated per (group, key, channel);
  edge data writes refresh edge channels; `label` takes the passthrough
  form only (`{ data: key }`, or the legacy `'data(key)'` string sugar).
- **Conditionals: the `case` mapper.**  `{ case: [{ when: { data,
  gt/lt/eq/ne/in/... }, then }], else }` — clauses in order, conditions
  AND-ed within a clause, first match wins; `when` reads any data key or
  the first-class `id`, plus the structural forms `{ parent: bool }` /
  `{ child: bool }` (round 14.7 — nodes only; a structural condition
  stands alone, AND it with data conditions via the `when` array
  form).  Structural conditions re-evaluate automatically on
  hierarchy changes.  The declarative replacement for
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
- **Animations sequence by promise, not by queue** (decided
  2026-08-01, third design sitting; built as round 21): v4 drops
  v3's per-element animation queue — queueing existed to sequence
  animations, which `await a.promise()` does better.  Animations on
  disjoint channels run concurrently; starting one that overlaps a
  running animation's channels stops the older one in place (its
  promise resolves, values freeze, any GPU lease settles) and the
  new one captures from there.  There is no `queue` option (nothing
  to opt out of — the spelling throws) and no v3 `step` callback
  (`onRender` + promises observe progress).  The
  `pause`/`progress`/`reverse` controls and style transitions were
  logged open at the sitting; the fourth sitting (2026-08-01) scoped
  both as round 24 — **style transitions landed as 24.1/24.2** (the
  bullet below) and **the controls landed as 24.3**:
  `pause()`/`resume()`/`reverse()` on the Animation handle (element
  and viewport), plus read-only `progress()`/`paused()` (`progress`
  is a getter only — no scrubbing; `apply`/`applying` stay out).
  Pause freezes elapsed in place (values hold, the promise stays
  pending) and resume excludes the paused span from the timeline;
  reverse swaps the tween's ends remapping elapsed to 1 − t — value-
  continuous exactly for point-symmetric easings (linear included),
  v3's start/end-swap rule — and reversing inside the delay
  completes at the captured start state.  A paused GPU tween settles
  its lease (the CPU holds the exact value reached) and re-acquires
  on resume with the shifted clock; a paused animation still owns
  its channels, so the round-21 eviction stops it like any running
  one.
- **Style transitions (rounds 24.1–24.2, landed 2026-08-01).**  The
  `transition-property`/`-duration`/`-delay`/`-timing-function`
  family, per sheet group (`nodes`/`edges`/`parents` — the parents
  spec merges nodes-then-parents under v3's order precedence),
  constants-only.  A transition fires whenever a *restyle* changes
  an element's stored tweenable channel — sheet re-application,
  mapper re-evaluation on data writes (`case` flips, scale moves,
  auto-domain extent shifts), structural restyles (leaf↔parent
  flips) — under the *destination* sheet's config; an element's
  first style application on add is instant (v3's rule, kept by a
  per-slot styled-generation mark), batched writes capture one
  transition per net change at the outermost `endBatch`, and
  `show()`/`hide()`/`visibility` flips are non-triggers (fade is
  spelled with an `opacity` transition).  Interruption is the
  round-21 rule uniformly: latest wins between transitions and user
  animations, both directions, capturing from the frozen mid-flight
  value.  `transition-property` accepts **every** prop name of its
  group (unknown or wrong-group names throw): number/color channels
  in the animatable set tween (opacity both groups,
  background/border/line colors, border-width; since round 25 —
  node `width`/`height` as `node.size` lane channels, edge
  `width` with its baked derivatives as lane rides — casing/overlay/
  underlay strokes and the match-line/percent arrow widths, moving
  only when the width itself moved, with parent slots never
  recording a size transition (auto-bounds own them) — plus
  compound `padding` (captured beside the channel funnel in the
  parents' compound-style write; a px↔% unit flip snaps) and
  `font-size` (the label sidecar; a diff with no entry on either
  side snaps)), while discrete props snap at the transition's
  start (recorded).
  Mechanics: the diff runs on **stored truth** around the engine's
  one channel funnel and packs into bulk per-column ChannelWrites
  (one preset animation per apply pass — never per-element
  animations), which keeps the auto-domain worst case (one write
  moves a live extent → the whole channel re-derives) in the cost
  class it already occupies; the store holds the pre-restyle values
  until the first post-delay tick (CSS's delay semantics — no
  target flash, and sync reads during the delay report the old
  state).  Recorded consequences of stored-truth diffing:
  channel-opacity folds ride the color they fold into
  (`background-opacity` moves transition under
  `'background-color'`), and an edge-`opacity` transition carries
  the pre-folded arrow alphas along.  **The domain performance
  contract** (docs guidance, both modes supported): with an
  explicit `domain` a data write re-evaluates the written elements
  only — O(changed), never whole-channel — while `'auto'` pays the
  O(n) re-derive only when a write actually moves the live extent;
  pin `domain` when a stream grows its own extent.  **GPU path
  (24.2)**: an all-paint transition offloads to the existing
  gpu-tween kernels (per-frame CPU ~zero; a border-width write
  keeps the whole preset on the CPU, the all-or-nothing rule), and
  a listed transition prop's *mapper eval* demotes to the CPU —
  the diff needs fresh stored bytes, so transitions and kernel
  ownership are mutually exclusive per channel while the tween
  itself still runs on-device.  Measured
  (`benchmark/transitions.mjs`, headless 200k): the
  auto-extent whole-channel re-derive is 326 → 594 ms with
  transitions on (a 1.82× constant factor, not a new class), an
  explicit-domain write 4.2 → 6.8 µs (O(changed)), a whole-sheet
  swap 1.46 → 1.67 s (1.15×), and the 200k-slot CPU tween tick is
  15 ms/frame — the cost the GPU offload deletes on rendered
  instances.
- **Animation: CPU-canonical, with a GPU fast path for position and paint
  under a transient lease.**  An animation tweens element style/position
  (or the viewport) from captured start values to explicit targets over a
  duration, easing normalized time (`eles.animate/animation/animated/
  stop/delay`, `cy.animate` for the viewport; since round 24.3 the
  handle also carries `pause`/`resume`/`reverse` and read-only
  `progress`/`paused` — see the controls bullet above).  Because a tween is a
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
    `border-width`, `edge.width`, padding, font-size) stays CPU: it is
    read by cull, CPU pick, and every columnar scan
    (`width()`/`height()`, `boundingBox`/fit, box select), so a
    GPU-owned size tween would reopen the store→style layering seam
    R8.5 flagged — round 25 built the geometry tweens and kept this
    rule (the geometry-tweens bullet below).  Eligibility is
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
    `border-width`, and — round 25 — node `width`/`height`, edge
    `width`, compound `padding` and `font-size` (the geometry-tween
    round; see the bullet below).
  - **Viewport targets** (round 10): `cy.animate`/`cy.animation` take
    `pan`/`zoom`, plus `fit: { eles | boundingBox, padding }` and
    `center: { eles }` — resolved to concrete pan/zoom when the
    animation is *created* (v3 semantics), so later graph changes don't
    retarget a pending fit.  `eles.boundingBoxAt(posOrFn)` computes the
    box at hypothetical positions (no store writes), which is what an
    animated layout fit targets.  **`panBy` (round 28.2)** joins them as
    the relative form: the delta resolves against the pan at creation,
    so it is an absolute target by the time the tween runs and gates on
    `panningEnabled` like any other.  v3's override order is kept —
    `fit` beats `center` beats `panBy` beats `pan` — with one deviation:
    passing `panBy` *and* `pan` throws, where v3 silently preferred
    `panBy`.  Core-only, as in v3.
- **Geometry tweens (round 25): CPU-canonical per tick, never leased,
  never stale.**  The geometry numerics tween on the CPU path with the
  per-tick invalidation cascade run by the store's write funnel — the
  round-9.4 tier rule kept, now a recorded contract point: because a
  geometry tween is a plain column write every tick, `width()`/
  `boundingBox()`/pick mid-tween read the exact mid-flight value
  (unlike leased paint/position tweens, which go stale against the
  device).  Landed 25.1 — node `width`/`height`: two lanes of the size
  pair column via the `lane` write kind and the store's cascading
  `setLane` (`setPair` runs the cascade: outerHalf write-through, the
  monotone cull meters, **label re-anchor** — hoisted from the
  parent-materialize path, closing the raw-size-write staleness hole —
  and compound auto-bounds marking, so a child's size tween drives its
  parent's derived box per tick).  Landed 25.2 — **edge `width`**: the
  width column itself reads live everywhere (quad/strip expansion,
  arrow sizing, cull), but three derived channels bake it at
  style-write, all linear in it, so the capture carries them as
  ride-along lane writes (the arrow-alpha-fold pattern): the casing
  and overlay/underlay strokes ride *additively from stored truth*
  (to = stored + Δwidth — mapper-resolved paddings and outline widths
  need no engine round trip), gated per slot on the layer being
  enabled, and the hollow-arrow `edge.arrowWidths` ride by mode
  ('match-line' → the target width, percent → pct × target, plain
  numbers never baked the width and stay), modes answered by
  `StyleEngine.arrowWidthModes()` (arrow widths are constants-only
  props).  The stroke lanes of the layer records are ×256 fixed-point;
  the store's `setLane` encodes on the way in.  Landed 25.4 —
  **compound `padding`**: the tween writes the *declared* padding (px,
  or the fraction under the '%' unit) through a new partial-merge
  `updateCompoundStyle` (a `{ padding }` tick must not reset the unit
  or min sizes — sheet writes keep their reset-what-you-omit
  semantics), the auto-bounds flush resolves it per tick (relative
  modes follow live), and parents-only is the mirror of the size
  rule: leaves are filtered at capture and re-checked per tick.  The
  transition capture wraps the parents' compound-style write beside
  the channel funnel (the styled marks are read before the channel
  pass marks fresh slots, so instant-on-add holds for padding too),
  and a px↔% unit flip snaps — tweening across units has no meaning
  (recorded).  Landed 25.5 —
  **`font-size`** (both label groups): the tween patches the label
  sidecar per tick through `setLabelFontSize` — no engine round trip
  (the `reanchorLabel` pattern); an edge's write drives all three of
  its streams (mid + end labels) and re-derives the fontSize-baked
  edge `anchorY` (−fs/2 + marginY); unlabelled elements are filtered
  at capture, and a transition diff with no sidecar entry on either
  side snaps (the −1 sentinel — a label added by a restyle has
  nothing to tween from).  Wrapped labels re-break honestly per tick
  (correct, and the expensive configuration — priced in the
  benchmark); the default `text-wrap: none` case is cheap through
  four label-path fixes shipped with the pass, each useful beyond
  tweens: (a) a pure font-size delta with unchanged breaking
  scale-patches the stored dims by the ratio — exactness *preserved*
  (scaling a laid block is exact) — instead of re-running the
  estimator; (b) the shaping-memo key drops `maxWidth` under wrap
  'none' (the breaker ignores it), so a tween tick is a memo hit
  instead of an unbounded-growth miss; (c) `GlyphBuffer.set` rewrites
  a same-count replacement **in place** (no tombstones, no highWater
  growth, no compaction-forced whole-stream re-uploads under a steady
  tween); (d) label writes no longer bump the global `geoEpoch` — its
  only consumer is the per-edge exact curve-bb memo, which has no
  label terms, so a font-size tick no longer invalidates every edge's
  cached bb.  The compound-loop excursion bound
  needs no new invalidation: auto-bounds read children's *outer*
  halves, so an ancestor's outerHalfW always dominates its
  descendants' and the bound (a max over both ends' stretches) can
  only change when the ancestor's own box changes — exactly the event
  `materializeParentGeom` already invalidates on (the containment
  argument, recorded in PLAN.md round 25).  Recorded calls: `width`
  and `height` share the `node.size` eviction channel (a running width
  tween is evicted by a starting height tween); compound parents are
  skipped at capture *and* per tick (auto-bounds own their size —
  `padding` is the parent knob); lane writes are geometry-tier by
  construction and never register on the device (the runtime throws on
  the invariant).  Costs (25.6, headless 200k-element ticks,
  `benchmark/geometry-tween.mjs` — relative factors are the story;
  wall numbers are machine-local): against a 65 ms paint-tick
  baseline, a node size tick is 122 ms unlabelled and 136 ms with
  center-anchored labels (the re-anchor diff early-outs), rising to
  510 ms when every label hangs off an edge of the node (a sidecar
  rewrite per tick — riding the dims fast path, never the estimator);
  an edge width tick over 400k edges is 86 ms bare and 130 ms with
  the full ride set; a padding tick + auto-bounds flush over 25k
  parents (×8 children) is 75 ms; a font-size tick is 213 ms under
  wrap `none` vs 767 ms wrapped (the honest per-tick re-break —
  the recorded expensive configuration).  Browser pins (the `webgpu`
  project): a sheet-swap width transition tweens pixels mid-flight
  with `width()` reading the mid-flight value and the hanging label's
  anchor tracking −w/2 exactly, and an edge-width transition passes
  through the casing-band state (white → black casing → red line) at
  a fixed sample point — only a riding stroke produces it.
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
  channel.  `font-style` and `font-weight` (round 13 D1) ride the same
  rule: global constants feeding the atlas's CSS font shorthand, with
  v3's value sets (normal | italic | oblique; the weight keywords plus
  the numeric hundreds), any face change resetting the atlas the same
  way.  Per-element fonts would re-key the atlas by (font, char) and
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
  move re-uploads ≤ 64 bytes *of position column* — no glyph is
  rewritten — and the label lands at the new midpoint).
  The cull predicate mirrors the edge cull (edge SHOWN + both endpoint
  nodes SHOWN); the model side group-keys the label sidecar,
  label-dirty channel and StyleEngine label channels (the `label`
  passthrough, `font-size`, `color` and all the round-10 text visuals
  work for edges; the text block centers on the midpoint by font
  size).  Edge labels are not pickable, like node labels.  Text draws
  horizontally by default; **`text-rotation: autorotate`** (landed
  2026-07-29) rotates the glyph run to the edge's angle **in the vertex
  shader**, so the rotation also reads live positions and follows
  drags/layouts/position tweens on-GPU with zero rebuild.  The flip
  rule is v3's verbatim: the angle is the edge's *undirected* slope
  (`atan(dy/dx)`), so the baseline stays within (−90°, 90°] and text
  never reads upside-down — vertical edges read top-to-bottom at +90°.
  The keyword (`none` | `autorotate`; numeric rotations throw, and the
  prop throws on the nodes group — per-element numeric rotation is a
  logged parity gap) is mapper-capable like the other label channels;
  the model bakes only a flag — bit 31 of the glyph instance's owner
  word (element slots stay far below 2³¹, and the dead sentinel is the
  full-ones word) — which the background quad carries too, so a text
  box rotates with its text, and the edge-glyph cull kernel tests the
  exact rotated-rect AABB in the same rotation frame as the VS.
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
  (dead element slots, `highWater`, pass widths) was deferred here and
  **since landed as round 19** (see the slot-compaction section above —
  the policy calls this bullet once logged open are all taken).
- **GPU layouts: logged for later.**  A force layout is *stateful*
  (`pos[t+1] = pos[t] + forces(pos[t])`), so unlike animation it is *not*
  cheaply CPU-reproducible — the GPU would be authoritative during a run
  with a readback on convergence, and headless would fall back to a CPU
  reference implementation (which doubles as the spec the kernel must
  match).  It reuses this round's lease + readback machinery, but the
  per-algorithm kernels and convergence detection are a future round.
  (Since built: the round-18 `force` layout below is exactly this
  design.)
- **Curved edges (round 12; the two flagged calls signed off
  2026-07-30).**  v4's default `curve-style` stays **`straight`** — the
  perf-first default at v4's target scales, a deliberate divergence
  from v3's bundled-bezier default (apps and parity scenes opt into
  `bezier` explicitly).  And `bezier` bundles **multi-edges only,
  verbatim v3**: a lone edge between two nodes renders straight under
  `curve-style: bezier`, only parallel edges fan out, and the middle
  edge of an odd bundle is straight (v3's rule), so curved scenes are
  pixel-comparable in the live v3-parity harness.
  - *Geometry (12a)*: `curve-geometry.mts` is the CPU twin of the
    curve WGSL — v3's formulas verbatim (the intersection frame, the
    bundle stagger, the loop construction, boundary endpoints toward
    the control point), one fixed drawn subdivision (CURVE_SEGS = 24
    quads per curved edge), and the conservative hull-deviation bound
    for cull/fit.  Per-edge parameters live in the `edge.curveParams`
    column (f32×4, kind packed at [3]) and are position-independent —
    offsets/weights/angles in the endpoint-relative frame — so drags,
    layouts and position tweens follow on-GPU with zero rebuild.
    Node boundaries reuse the arrow shader's approximation tier
    (ellipse/rect exact, round-rect as its box, polygon as its
    inscribed ellipse) rather than v3's exact per-shape intersections
    — a recorded deviation, exact for the default ellipse nodes.
    **Round 55 measured it** rather than leaving it as prose, in two
    independent places that agree: `test/curve-geometry.mjs` twins the
    offsets directly against v3's `intersectLineEllipse`,
    `polygonIntersectLine` and `roundRectangleIntersectLine`, and the
    `shapes` scene in `playwright-tests/routing.spec.js` measures the
    same tier at the end of a real edge.  On a 40x24 node: ellipse,
    circle and rectangle **exact to 2e-13**; round-rectangle **2.247
    model px** at a corner (0.008 on a typical chord); triangle
    **8.453** at the leaf and 8.462 through an edge — the polygon
    tier's worst case.  Those numbers are now assertions with
    two-sided bands, so the deviation fails the build if it grows *or*
    shrinks without the record being updated.
  - *Props + derivation (12a)*: `curve-style` (`straight` | `bezier`),
    `control-point-step-size`, `control-point-weight`,
    `loop-direction`, `loop-sweep` — edge-only, v3 defaults, constants
    or mappers; angles take numbers (radians, v3's pfValue convention)
    or `deg`/`rad` strings and read back in radians.  Readback follows
    the *styled* record (a lone `bezier` edge reads back `'bezier'`
    though it renders straight — v3 semantics).  The
    `store/curve-index.mts` bundle index derives `edge.curveParams`
    from the records: the pair map is built lazily on the first bezier
    record (a straight-only graph pays one loop check per edge add and
    nothing else), per-node loop lists are always maintained (loops
    render as loops under *every* curve style — a v4 deviation:
    v3 routes straight-styled loops through its unbundled path, v4
    always uses the bundled loop construction), and pending pairs
    re-derive lazily at takeDelta/boundingBox/accessor reads.  Fit
    reads a conservative hull bound per curved edge; the frame-level
    `store.curveSlack()` bound (monotone maxima) is what the cull
    kernels grow their straight-chord tests by, since per-edge params
    can't bind in every kernel within the 8-storage-buffer budget.
  - *Accessors + exact bb (12a)*: `isBundledBezier()` (the v3 style
    check), `controlPoints()`/`renderedControlPoints()` (one point for
    a bundled bezier, two for a loop, undefined for straight edges —
    since 12b also the unbundled control list, with
    `segmentPoints()` covering segments/taxi);
    `midpoint()` is the curve midpoint and `source/targetEndpoint()`
    the curve's boundary endpoints when the edge curves.  Public
    `eles.boundingBox()` is the *exact lazy* tier of the
    expensive-geometry design: the flattened polyline at the drawn
    subdivision, memoized per edge against a store-wide geometry epoch
    (any geometry write invalidates every cached box — over-broad but
    sound); fit/cull keep the conservative bounds.
  - *CPU costs (round 29.4, Node sweep, `benchmark/curves.mjs`,
    20k nodes / 40k bundled-bezier edges, every row against the
    straight graph of the same shape)*: **derivation is deferred to the
    first read**, which is the shape of every number here — a bulk
    `positions()` write is 0.97× (curves cost the *write* nothing), the
    first read after it 1.46×, the same read again 1.22×.  The
    premiums that matter: box selection **~2.3×** (the exact
    curve-vs-rect test — *corrected in round 33.5, see below*), a bundle
    re-fan on `hide()`/`show()` **2.7–3.8×** (~3.5–5.2 µs per pair, paid
    at a sibling's next read), `controlPoints()` ~1.6×, a single-node
    drag ~1.5×, the whole-graph exact `boundingBox()` ~1.2×, the
    conservative `fit()` scan 1.05×.
    Two rows read ≈1.0× until the benchmark was corrected to force the
    deferred work: the bulk write genuinely is free, but the re-fan row
    was measuring a flag write until it read a sibling afterwards.
    **Round 33.5 corrected a third**: the box-selection row passed a box
    *object* to `cy.elementsInBox`, which takes four numbers and silently
    answers the empty collection when handed one — so the 3.29×
    originally published here was measured on a call that never ran the
    curve-vs-rect test it names.  Fixed, the premium is 2.28–2.35× over
    two runs.  Note also that this suite times one shot per row rather
    than sampling like the mitata suites, so its ratios move ~±20%
    run-to-run (the unchanged re-fan row read 3.79× when first published
    and 2.66–2.98× on re-measurement); read them as magnitudes.
  - *Rendering (12a)*: curved edges draw in their own pipeline — one
    instance per edge as a strip of 24 quads whose vertex shader
    evaluates the curve analytically from live positions + the params
    column (the WGSL twin of `curve-geometry.mts`), extruding along
    the curve normal at each vertex's own t so the strip is watertight
    without miter joints.  The VS binds exactly 7 columns + the
    visible list (the base 8-storage-buffer budget); line
    color/opacity/style fetch in the fragment stage, and dashes follow
    the curve's polyline arc length.  The cull pass splits the edge
    draw into straight and curved streams on the store-managed
    FLAG_CURVED bit — the curved stream's chord test grows by the
    frame's `curveSlack` and is **not decimated** (curved edges are
    opt-in and far fewer; a far-zoom haystack revisits this in 12c) —
    and the GPU pick tile draws the same strips, so what you see is
    what you pick.  Curved edges draw *after* straight edges (two
    streams; slot order within each — a z-order deviation alongside
    the existing edges-under-nodes rule); both stream under arrows,
    nodes and labels, and early-z applies to both.
  - *Arrows (12a)*: curved-edge arrowheads point along the curve's
    true end tangent — the straight arrow math with the control point
    substituted for the far endpoint (a quadratic's end tangent runs
    control → endpoint), one quad per end off the curved stream's
    single-quad indirect args block.  (12a recorded a border-exclusive
    deviation — no spare binding for the node border column — which
    the 12b `node.outerHalf` derived column closed: tips sit on the
    border-inclusive outer boundary now, like the straight arrows.)
  - *Props + derivation (12b)*: `curve-style` gains
    `unbundled-bezier` | `segments` | `round-segments` | `taxi` |
    `round-taxi` (haystack/straight-triangle stay 12c), with
    `control-point-distances`/`-weights`, `segment-distances`/
    `-weights`/`-radii`, `radius-type` (per-point
    `arc-radius`/`influence-radius` lists, last entry repeating —
    v3's rule), `edge-distances` (`intersection` | `node-position`;
    `'endpoints'` throws until 12c's manual endpoints exist),
    `taxi-direction`, `taxi-turn` (px, negative = from the target, or
    a percent string storing v3's fraction), `taxi-turn-min-distance`
    and `taxi-radius`.  All edge-only; scalars/enums are
    mapper-capable like the 12a props, **list props take constants
    only** (a mapper value is one number/keyword, not a list — a
    recorded scope note).  List constants accept arrays or v3's
    space-separated strings; lists read back as space-separated
    strings, percent turns as the percent string.  Derivation is
    **per-edge** (none of these families bundle) into blob-backed
    records via the CurveIndex; deviations, recorded: interior counts
    cap at 8 controls / 11 segment points (the strip subdivision);
    weights clamp to [-1, 2] and any weight outside [0, 1] marks the
    edge box-bounded (FLAG_CURVED_BOX) for the cull tier;
    `unbundled-bezier` without `control-point-distances` takes a
    single control at the step size — **matching v3**, whose
    staggered `normctrlptDist` is dead on that path (its
    `edgeIsUnbundled` branch assigns the plain `ctrlptDist`), so
    this is parity, not a deviation;
    unbundled-family **loops** use `control-point-distances[0]` as the
    loop distance (v3), falling back to the step size when unset (v3
    yields NaN geometry there); and segments/taxi-styled loops keep
    rendering as loops (the 12a all-loops deviation extended).
  - *Props + derivation (12c)*: `curve-style` gains
    `haystack` (+ `haystack-radius`, validated [0, 1], default 0 — v3)
    and `straight-triangle` — both derive to *straight-stream* kinds
    (FLAG_CURVED clear: they draw in the straight pipeline, so
    haystack keeps far-zoom decimation).  Haystack angles are
    id-hash-seeded (deterministic across loads/machines; v3 uses
    Math.random()), offsets scale by the outer halves (inner size in
    v3 — identical at border 0, recorded), and haystack edges draw no
    arrows (v3 skips them; stored-truth arrow getters read 'none' —
    recorded).  `source/target-endpoint` (keyword | 'x y' point with
    per-component %/px units | angle; `-or-label` keywords throw — no
    label bb) and `source/target-distance-from-node` resolve through a
    10-float endpoint block prefixed to the edge's blob record
    (`CURVE_HAS_ENDPT`): straight + endpoints ⇒ the MULTI n = 0
    chord, bundled bezier + endpoints ⇒ promoted MULTI n = 1
    (identical control formula), taxi keeps distances but forces the
    keyword modes (v3's override), and loops ignore endpoints
    entirely (v3 overrides keywords; v4 also drops loop distances —
    recorded).  `edge-distances: 'endpoints'` re-bases the frame on
    the raw manual anchors when both ends are manual, else warns and
    falls back (v3's rule).  Scalar 12c props are mapper-capable;
    endpoint props are constants-only (the point form is a list).
    Cull bounds: px offsets ride the header deviation; pct offsets
    ≤ node-half ride the slack's node-half term, larger ones mark
    FLAG_CURVED_BOX and feed the monotone pct term in curveSlack();
    haystackSlack() bounds the straight-stream tests.
  - *Geometry + rendering (12b)*: the route families share 12a's one
    curved stream of CURVE_SEGS strips (one indirect draw needs one
    indexCount).  Variable-length records live in the **curve param
    blob** (`store/curve-blob.mts` — round-11 waste-threshold
    compaction; the params column holds the `[offset, dev, n, kind]`
    header, so records stay position-independent and drags/layouts/
    tweens cost zero blob traffic); the blob mirrors as one storage
    buffer, bindable because `node.outerHalf` freed a slot in every
    curve shader.  The route evaluator (`evalRoute` / `evalRouteW` —
    dual impls, same blob) maps subdivision indices onto route pieces
    so **piece boundaries land exactly on indices**: legs stay
    pixel-straight and corners exact regardless of quad distribution
    (hence the 8-control/11-point caps).  Sharp corners join with a
    **clamped discrete miter** (v3's canvas sets `lineJoin: 'round'`
    on edge paths — a recorded deviation confined to the outer join
    wedge; the live parity diff still measures 0 px at 8 px strokes);
    round corners are v3's `getRoundCorner` arcs, ported as the pure
    `computeCorner`/`computeCornerW` pair.  Cull: chord-bounded routes
    grow the 12a chord test by their header deviation via the frame
    slack; **box-bounded ones (taxi, extrapolated weights —
    FLAG_CURVED_BOX) test the endpoint AABB grown by slack + chord
    length** instead, since no frame constant bounds their excursion.
    The pick tile draws the same strips, and `refsInBox` tests curve
    boundary endpoints (the box-selection revisit, closed).
  - *Arrows + accessors (12b)*: a route's end tangent runs from the
    first/last interior point to the boundary endpoint, so route
    arrowheads are the straight arrow math with that point substituted
    (taxi arrows ride the final axis-aligned leg).  The curved-arrow
    vertex stage needed the blob, so this end's arrow *colors* moved
    to the fragment stage — no-arrow ends rasterize a small
    fully-transparent quad instead of collapsing in the VS (bounded
    overdraw on the opt-in curved stream).  Accessors:
    `segmentPoints()`/`renderedSegmentPoints()` answer for segments
    *and* taxi (v3 types taxi as 'segments'); `controlPoints()` covers
    the unbundled control list; `midpoint()`/endpoints and the exact
    lazy `boundingBox()` follow the route via the shared evaluator.
  - *Edge labels (12a; routes since 12b)*: labels of curved edges
    anchor at the **curve midpoint**, computed in the label vertex
    shader from live positions + the params column (zero rebuild,
    like everything else) — since 12b, route owners anchor at
    `routeMidpointW` (v3's per-family midpoint rules).
    `text-rotation: autorotate` needed no new math for beziers — a
    quadratic's t = 0.5 tangent *is* its chord direction, so the
    endpoint frame is exact — loops rotate along their c1→c2 midpoint
    tangent, and route owners take the route midpoint tangent (the
    arc-apex tangent on round middles, the leg direction on
    polylines).  The edge-glyph cull grows its chord-midpoint test by
    the frame's curve slack for curved owners (its own 8-buffer
    budget precludes a params binding), plus the chord length for
    box-bounded owners; rotated curved labels cull against a
    frame-independent anchor-centred bound.
- **Parity triage (2026-07-29)** — decisions on the v3 leftovers from
  the gap analysis.  *Dropped*: the canvas-era perf degradation
  options (`hideEdgesOnViewport`, `textureOnViewport` +
  `outside-texture-bg-*`, `motionBlur`/`motionBlurOpacity` — compute
  culling + adaptive render scale solve the same problem without
  degrading output), `background-blacken` (compute the shade in a
  color mapper's range instead), `bounds-expansion` (bounds are
  computed correctly instead), and the legacy aliases (`content`,
  `padding-{left,right,top,bottom}`, no-dash shape spellings,
  redundant `attr`-family duplicates — one name per concept).
  **Two recorded exceptions to that rule** (fifth design sitting,
  2026-08-04): `cy.autolockNodes()` and `cy.autoungrabifyNodes()`
  were listed in the original triage and are **kept** — judged
  possibly useful, and wired and working since long before the call.
  The same sitting went the other way on the third survivor:
  `roundrectangle` was accepted where `cutrectangle` and
  `concavehexagon` threw, and now throws with them (round 37.2).
  *Kept, with direction*: `curve-style: haystack` (+
  `haystack-radius`) and `straight-triangle` return as real visual
  styles — not perf modes — with the curved-edge work; ghost props
  return for SBGN in a simplified form (the ghost duplicates only the
  basic node body — shape, border, background — at the offset as an
  extra draw, never a whole-cloth redraw of the full node with labels
  and decorations); overlay/underlay, `active-bg-*` and
  `selection-box-*` become stylable props, with today's baked-in
  affordances (shader hover/active brighten, the accent ring, the DOM
  selection box) as the styled defaults.  *Deferred*:
  `text-metrics`/`box-select-labels` get their v4 form in the
  multiline/label-bb round.  (Since landed, round 16.4/16.5:
  `eles.labelBoundingBox()` and `boxSelectionIncludesLabels`.)

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
GPU column); `font-family`, `font-style` and `font-weight` (round 13 D1) are
constants and effectively global (one face per atlas, defaults
`sans-serif`/`normal`/`normal` — a change resets the atlas and
re-lays-out every label; see the fonts design decision above).  Glyphs
come from a runtime SDF atlas (canvas-2D raster → Euclidean distance
transform → one r8 texture) and live in a persistent instance buffer keyed
by node slot — the label vertex shader reads the node position buffer, so
labels follow drags and layouts on-GPU with zero rebuild.  Labels fade out
below the `labelFadePx` LOD threshold.

Events: **no namespaces**, in the design and — since round 41.2 — in the
code.  v4 dropped the `'tap.foo'` form (unused, and a per-emit parse
cost), but until round 41 it imported v3's emitter and so inherited v3's
namespace parsing wholesale: a hand-emitted `'tap.ns'` behaved exactly as
in v3, which round 37.4 measured after this paragraph had claimed for
several rounds that the parsing was kept "only for v3".  v4's own emitter
matches a type **whole**, so a dot is an ordinary character in a name:
`on( 'tap.ns' )` registers a listener for the literal type `'tap.ns'`,
which v4 never emits and which a plain `emit( 'tap' )` does not reach.
Delegation is
predicate-based (`cy.on('tap', ele => ele.isNode(), cb)`); on `remove`
events the target handle's cached `id()`/`group()` stay readable inside
the predicate, while live state reads report false.  **Compound
bubbling (round 14.5)**: every element event on a parented node
bubbles origin → ancestors → core with v3 semantics — `event.target`
stays the originator, the callback context (`this`) is the phase
element (v3's currentTarget), and `stopPropagation()` or a callback
returning `false` halts the walk.  Core predicates keep firing once
against the originator (v3's core-selector delegation), and
orphan/edge targets emit flat exactly as before.  The remaining
order deviation is within-phase only: listeners registered on the
same element (or the core) fire in registration order.

Out of scope (deferred): string-formatting label mappers beyond the
passthrough, and the GPU tween fast path for *size* channels
(position and paint offload today; size is a geometry-tier project,
see the design decisions above).  **Compound nodes landed as round
14** (PLAN.md, "Round 14 plan — compound nodes", planned and landed
2026-07-31): parent/child hierarchy in the columnar store with
auto-sized parents materialized into the position/size columns,
parents-under-descendants draw order, ancestor-gated visibility +
rendered effective opacity, ported event bubbling, a `parents` sheet
group plus structural `case`/query conditions, compound loop edges,
and the layout/tween/interaction rules — each item its own
tests-first commit, with the design decisions and deviations
recorded in the round-14 paragraphs above and the summary bullet in
the deviations list below.  v3 compound surface *not* ported (the
usual one-name-per-concept and geometry-tier calls): the four
min-size bias props (the centered clamp instead; a future round may
add per-side padding props), `compound-sizing-wrt-labels: 'include'`
(compound auto-sizing reads child body extents, not labels — the
reason narrowed by round 16.4, which put labels into public bb/fit),
`:parent:selected` restyling, and
`z-compound-depth`/`z-index-compare` (dropped outright with z-index,
2026-08-01).

Landed so far (round 14.1 — the hierarchy model): `parent` is a
**first-class node field**, not sidecar data — like edge
`source`/`target` it is reserved at ingest, immutable through
`data()` (reparenting is `move({ parent })`, round 14.2), and
synthesized on read from the hierarchy (`data('parent')` returns
the parent's id, absent for orphans).  The hierarchy itself lives
in a store-side index (`store/hierarchy.mts`): parent links with
generation guards, per-parent child lists, nesting depth, and the
store-managed `FLAG_PARENT`/`FLAG_CHILD` bits in the flags column
(so parent/child predicates stay pure flag scans and the cull
kernels can split the node draw without new bindings).  Cycle rule
is v3's: an assignment that would make a node its own ancestor
warns and drops the ref, no throw.  A node with children can not be
removed (the collection layer cascades descendants first, v3's
removal semantics), and `cy.hasCompoundNodes()` reflects live
parents.

Round 14.2 (the compound collection API + lifecycle): the traversal
surface — `parent`/`parents` (=`ancestors`)/`children`/
`descendants`/`siblings`/`orphans`/`nonorphans`/`commonAncestors`
and the `isParent`/`isChildless`/`isChild`/`isOrphan` predicates —
is slot-native over the hierarchy index with v3 orderings
(ancestors nearest-first, children in link order, descendants
pre-order).  One recorded deviation: `parent()` always returns a
proper collection (v3's single-element fast path returned a raw
element ref and ignored the selector argument).  `remove()`
cascades over descendants and their incident edges (v3);
`move({ parent })` re-parents **in place** — the node keeps its
slot, id, data and edges (v3 does a remove/restore refs cycle) —
emitting `moveout` then `move` per changed node; an unknown parent
id is a silent no-op (v3) and a cyclic assignment warns + drops.
Def ingest resolves `data.parent` in a second pass once the batch's
nodes all exist, so forward references work in any def order;
numeric parents coerce to string ids (v3), and unknown/non-node
parents warn and leave the node an orphan.  Element `json()`
carries `parent` and round-trips through `cy.add()`.

Round 14.3 (auto-bounds): a parent's geometry is **derived from its
children and materialized into the real `node.position`/`node.size`
columns** by a lazy flush (the CurveIndex pattern: geometry writes
mark ancestor chains pending; `GraphStore.flushDerived()` — always
hierarchy before curves — drains at takeDelta/bb/refsInBox and the
geometry accessors), so bounding boxes, culling, picking and the GPU
mirror consume parent boxes with no special cases.  The derived box
is v3's `updateCompoundBounds` math: direct children's
border-inclusive extents (hidden children excluded — v3's
display:none rule), padding in px or % of the pre-clamp children bb
per `padding-relative-to`, the **centered** `min-width`/`min-height`
clamp (the four bias props are dropped by decided design — a future
round may add per-side padding props instead), and a degenerate
fallback to the stashed style size at the stored position when no
shown children remain.  The stored size is the padded/drawn box:
`width()`/`height()` subtract 2·padding (v3's autoWidth/autoHeight),
`paddedWidth`/`paddedHeight` return the drawn box, `outerWidth` adds
the border, and `padding()` answers the resolved padding.  Setting a
parent's position shifts its whole subtree by the delta (locked
children move too — v3), `shift()` skips elements whose ancestor is
also shifted (v3's dedupe), descendants moved by a parent's write
emit `position` (listener-gated), and `relativePosition` is
compound-relative (model minus the immediate parent's position).
A parent's label re-anchors when auto-bounds resize it (the store
inverts the engine's anchor bake from the sidecar entry).  A node
that stops being a parent returns to its stashed style size.

Round 14.4 (ancestor gating): `hide()` on a parent hides its whole
subtree.  The element's own state lives in a new `FLAG_SELF_HIDDEN`
bit and **`FLAG_VISIBLE` is the effective shown bit** (own state AND
no hidden ancestor), recomputed over affected subtrees on visibility
and hierarchy changes — so the cull kernels, columnar scans, bounding
boxes, box selection and the CPU pick all honor ancestor gating by
reading the one bit they already read.  A child's own hidden state
survives parent toggles (v3's `visible()` semantics);
`takesUpSpace()`/`interactive()` ride `visible()`.  Box selection
now also requires both edge endpoints shown (the drawn-edge rule —
previously a hidden endpoint's edges stayed box-selectable, a gap
this closes).  **Effective opacity renders**: the stored node
opacity is `base × ∏ ancestor bases` (v3's product rule — a
deliberate extension of the round-13 fold pattern to a cross-element
fold), so descendants dim with their ancestors on screen;
`style('opacity')`/`numericStyle` read the declared base,
`effectiveOpacity()`/`transparent()` the fold, and edges keep their
own opacity (v3: edges have no parent).  While compounds exist a
GPU-mapped node `opacity` demotes to the CPU path (the kernel would
overwrite the fold) — the demotion engages/disengages on the
compounds 0↔>0 transitions.

Round 14.6 (the `parents` sheet group): parent nodes style through a
**fourth sheet key** — `{ nodes, edges, parents, core }` — whose
channel props overlay the nodes group for parent slots, with v3's
order-based precedence (the default `:parent` overlay — `rectangle`,
`#eee` fill, 1px `#ccc` border, padding 10 — < user nodes block <
user parents block; v3 applies style blocks in order, and the default
stylesheet sits before the user's, so a user `node` block restyles
parents too — pinned by the live parity scene).
Parents-block values are constants or mappers, evaluated for parent
slots only; a leaf↔parent flip restyles the node against the right
group automatically.  The **compound props** live in the parents
group and are constants-only: `padding` (px, or `'N%'` of the
children bb per `padding-relative-to`: width | height | average |
min | max), `min-width`/`min-height` (the centered clamp), and
`compound-sizing-wrt-labels`, where `'exclude'` is the only
accepted value (`'include'` throws — compound auto-sizing reads
the children's *body* extents, not their labels; since round 16.4
public bb/fit do include labels, but the auto-bounds derivation
deliberately does not — recorded).  Compound props throw outside the
parents group.  Readback answers from the per-parent record
(`style('padding')` returns the declared px number or the percent
string; leaves read 0, as v3 leaves do).  The v3 `:parent:selected`
tint is not ported — v4 never restyles on selection (the shader
accent ring is the selection affordance); recorded deviation.
GPU mapper eval: nodes-group paint mappers on channels the parents
group resolves differently (default-overlay channels the nodes block
does not override, plus any user parents-block prop) demote to the
CPU path while compounds exist — the eval kernel runs over every
slot and would repaint parents with the nodes-group value; a
recorded scope note.

Round 14.9 (the parent draw stream): parent bodies render in their
own culled stream drawn right after the depth prepass — under every
edge layer, arrow, leaf and label, v3's compound order — while the
main node stream (and the depth prepass with it) excludes parents on
`FLAG_PARENT`.  Draw order **among parents** is depth-asc, slot-asc
(outer under inner): the parent cull kernel iterates a CPU-built
permutation uploaded only on hierarchy changes and writes the
permuted slots, so its visible list is already in paint order with
no GPU sorting.  The CPU node pick mirrors this in two passes —
leaves by descending slot, then parents in reverse permutation
order — so a parent never swallows its children's picks and the
padding band picks the parent.  Recorded deviations: parents are
excluded from the early-z prepass (their interiors must not kill
the edges/children drawn over them — they lose the occlusion
benefit); parent ghost/underlay/overlay/label decorations keep
their existing post-edge draw positions (permanent since the
2026-08-01 z-index drop — decorations are top-tier accents by
design); and v4's parent boxes sit smaller than v3's, for **two
separate reasons that round 55 had to disentangle**.  The one
recorded first: v3's node bb includes the border's miter-corner
overshoot (~(√2−1)·border/2 per side on cornered shapes) while
v4's child extents are the plain border-inclusive `outerHalf` (the
`parity-compounds` scene carries a looser bound for exactly this).
The second, measured in round 55 and **independent of the border**:
v4's parent box is the children's union plus padding *exactly*,
where v3's is that plus **1.0 model px on every side** — the same
1 px at `border-width` 0, 1 and 4, on ellipse children that have no
miter corners at all.  Reading a parent-box difference as the
border effect alone will therefore mis-explain it; the routing
harness's `compound` scene pins `border-width: 0` on both sides so
that only the second reason can be in play.  Whether v4 should
inflate to match is open — see PLAN.md's ledger item 19, and note
that round 54 is scheduled to tighten these bounds further.

Round 14.10 (compound loop edges): an edge between a node and its
own ancestor/descendant — or a self-loop on a parent — **routes
around the outside**, whatever its declared `curve-style` (v3's
default `edge:compound` block produces the same behavior; a
recorded rule like the forced self-loop construction).  The
construction is v3's `findCompoundLoopPoints` verbatim: two control
points off the endpoints' min top-left corner, stretched by
`max(0.5, ln(outerWidth × 0.01))` per end, drawn as two
C1-continuous quadratics through the control midpoint (the loop
pipeline).  Control points evaluate from live positions and outer
halves in both the WGSL and the CPU twin, so drags, layouts and
auto-bounds resizes follow on-GPU with zero re-derivation;
reparenting re-derives the moved subtree's incident edges, and a
leaf↔parent flip re-routes its self-loops.  Compound loops are
box-bounded for culling (`FLAG_CURVED_BOX`) with a derivation-time
excursion bound feeding `curveSlack()` (a 2× stretch margin —
stretch grows only logarithmically with node size, and parent
resizes refresh the bound; recorded).  **The conservative fit box
does not add the chord length** for this kind (corrected
2026-08-05): the chord belongs to the *weight-extrapolated* blob
routes that share `FLAG_CURVED_BOX`, where a
`control-point-weight` outside [0, 1] puts a control that far past
an endpoint.  A compound loop's controls hang off the union of the
two node boxes, at most half the excursion bound past its top-left
corner, so the endpoint AABB grown by header + node-half already
contains the curve — and the bb scan visits *both* endpoints, so
whichever node owns that corner covers it.  Adding a chord made
`fit()` draw every compound graph with a related edge at a
fraction of its size (measured on `debug/`'s compound fixture:
1718 × 1572 against an exact 802 × 637).  The **cull** kernel
keeps the chord term deliberately: over-inclusion there costs
efficiency, never correctness.  Deviation: v4 anchors the
curve endpoints outside-to-node (toward the near control) where
v3's `edge:compound` block defaults them outside-to-line — a small
angular difference at the boundary, measured at 0.022% in the live
parity scene.  `controlPoints()`/`midpoint()`/`boundingBox()`
answer through the shared evaluator like loops.

Round 14.11 (layouts, tweens, interaction): every built-in layout
positions **leaves only** — parents derive from their placed
children (v3's `layoutPositions` rule; preset skips parent entries
in both its forms, since a parent position write shifts the whole
subtree).  `boundingBoxAt` skips parent bodies (the leaves'
hypothetical boxes stand in; the parent padding margin is not
modeled — a recorded fit-target approximation).  A position
animation targeting any compound-related node (parent or child) is
**not GPU-offload-eligible**: the lease would leave the CPU
position columns stale under the auto-bounds derivation, and a
tweened parent must shift its subtree per tick — both CPU-only
semantics; unrelated leaves in compound graphs still offload.
Reparenting settles any live GPU tween to the CPU first
(`AnimationManager.settleGpuAll`).  Dragging a parent needs no
special pointer handling — the grab resolves through the compound
pick order and the position write shifts the subtree; dragging a
selected parent together with its selected child moves the child
exactly once (the collection shift dedupe).

Manual edge endpoints + haystack/straight-triangle landed as round
12c (2026-07-30/31 — the round-12 curved-edges plan is complete).
The 2026-08-01 design sitting dropped z-index outright and scoped
rounds 15–18, **all landed the same day**: background images (15),
multiline labels + label bounding boxes (16 — closing the multiline
direction), the event vocabulary + extension contract (17), and the
GPU `force` layout (18 — closing the round-9 "GPU layouts: logged"
hook).  Their sections above and the PLAN.md records carry the
detail.

## Background images (round 15, landing)

The 16-prop `background-image` family lands on the design calls
recorded in PLAN.md ("Round 15 plan"): size-tiered texture arrays
with hardware mips (never a shelf atlas), SVG zoom-promotion with
export-time re-raster, an explicit SDF icon mode for monochrome
vector icons, and multi-image parity (up to 4 per node, blob-pool
records).  Landed so far:

- **15.1 — the ImageRegistry** (`src/image-registry.mts`):
  unique images dedup by (kind, crossorigin, url) into refcounted
  entries — the string-dictionary discipline applied to rasters.
  Entry ids are slots (free-list recycle; `takeFreed()` is the
  renderer's layer-reclaim channel), rgba entries take a size tier
  from their decoded longest side (128² / 512² / 1024² cap), and
  sdf-icon entries raster once at the fixed 128² for the r8 icon
  array.  Decoding runs behind an injectable async rasterizer —
  headless instances stay pending and never throw, the renderer
  attaches the browser decoder at mount (`setDecoder` kicks
  everything acquired before it), a failed url warns once and
  renders imageless (recorded: no per-element error state), and
  stale decodes landing after a free are dropped by object
  identity.  `promote(id, demandPx)` re-rasters vector entries at
  the smallest covering tier — the primitive under 15.6's
  zoom-promotion meter; raster sources never promote (source
  resolution is their ceiling, as in v3).

- **15.2 — props + model**: the 16-prop surface parses, validates
  and reads back with v3's keyword sets and defaults —
  `background-image` (url / data-URI lists; `url(...)` wrappers
  strip), `-fit` (none | contain | cover), `-image-opacity`,
  `-position-x/-y` and `-offset-x/-y` (%/px), `-width/-height`
  (auto | %/px), `-repeat`, `-clip` (none | node),
  `-image-containment` (inside | over), `-image-smoothing`,
  `-image-crossorigin`, plus the v4 `-image-type` (auto | sdf-icon)
  and `-image-color` (the icon tint).  Per-image lists distribute
  v3-style (last value repeats); at most **4 images per node** (a
  fixed FS loop — recorded); `background-width/height-relative-to`
  throws as unported (a parent's stored size is already the padded
  box — v3's include-padding default).  Records live in an image
  param blob (round-11 compaction) behind the packed
  `node.imageRef` column; restyles acquire-then-release so shared
  urls survive; image props are draw-only paint — never in
  `boundingBox()`, never pickable, and always CPU-evaluated.
  **Mapper rules**: `background-image` takes mappers through a
  string-interning enum channel — `{ data: 'photo' }` passthrough
  (photo-per-node), `case`/ordinal urls (icon-per-type) — and
  `-image-opacity`/`-image-color` are plain number/color channels;
  every other image prop is a constants-only list (the 12b rule).

- **15.3 — the RGBA draw path**: imaged nodes draw one extra
  instanced quad per stream (leaves right after their bodies,
  parents right after theirs — v3's layering), off the same culled
  visible lists, with imageless instances collapsing in the VS and
  the whole pass skipped while no node styles an image.  Unique
  images live in per-tier `texture_2d_array`s (128²/512²/1024²)
  with full blit-generated mip chains — minification samples a
  coherent low mip instead of scattering across full-res texels —
  behind an entry-indexed image-table buffer (status/tier/layer +
  natural/raster dims); layers are slots with free-list reclaim and
  doubling growth, capped at the 256-layer base limit (warn-once,
  the glyph-atlas precedent).  The FS composites a node's records
  in list order (later over earlier), sampling with explicit
  gradients (`textureSampleGrad`, so per-record branching needs no
  uniformity), and `smoothing: no` snaps to texel centers.
  Deviations, recorded: `clip: node` masks by the node SDF with
  containment `inside` clipping at the border's *inner edge* — the
  border stays visible over the image, but a translucent border
  shows fill rather than image (the B1 band-rule sibling); repeat
  tiles are confined to the node box; the browser decoder narrows
  crossorigin `null` to same-origin fetches (WebGPU cannot upload
  tainted content).  Pinned by the `images-basic` /
  `images-cover-clip` goldens and a live v3 parity scene at
  **0.000%** mismatch (fit/position/opacity math is pixel-exact
  against v3's canvas renderer).

- **15.4 — multi-image parity**: up to 4 images per node composite
  in **v3's layer order — later list entries on top** (v3's canvas
  draws ascending index with source-over; not the CSS first-on-top
  convention), each with fully independent per-image props at its
  list index.  Pinned by the `images-multi` golden (overlaps +
  translucent blending) and a second live v3 parity scene at
  0.000% mismatch.

- **15.5 — sdf icon mode**: `background-image-type: 'sdf-icon'`
  sends a source through the glyph pipeline — the decoder returns
  its alpha silhouette (multi-color sources collapse to it;
  recorded), the glyph atlas's exact EDT runs at upload, and the
  distance field lives in a dedicated 128² r8 array (~16 KB per
  icon vs ~1.3 MB for a 512² rgba mip chain).  The FS thresholds
  at 0.5 with an analytic AA width (the field re-thresholds at
  screen resolution, so icons stay **crisp at every zoom** with no
  promotion machinery) and tints by `background-image-color` —
  mapper-drivable, so one shared raster serves any per-type
  palette.  `background-image-type` itself is constants-only (a
  list prop, the 12b rule; recorded).  Pinned by the
  `images-sdf-icons` golden and a crispness spec: at zoom 6 the
  sdf edge ramps ≤ 2 px where the rgba path ramps ≥ 3.

- **15.6 — svg zoom-promotion + export re-raster**: vector sources
  have no native resolution, so a fixed raster is v4's artifact —
  the renderer meters each unique svg entry's max on-screen demand
  (shown, in-viewport users; debounced 250 ms behind viewport
  events; re-checked when uploads land) and re-rasters at the
  smallest covering tier once demand exceeds the current raster by
  1.5× (hysteresis).  Momentary softness self-corrects — the
  late-font precedent — and promotion ends at the cap tier
  (recorded blur past it); raster sources never promote, and there
  is no demotion (the waste policy reclaims; recorded).
  `png()`/`jpg()` promote at the *export* scale and await the
  decodes before encoding, so a high-scale figure is crisp even
  when the screen never demanded it; at scale 1 promotion no-ops
  and the WYSIWYG self-diff (now with an imaged phase) still
  pixel-matches the screen.

## Documenting the source (round 26)

The v3 code **and** the v3 documentation stay in the repo untouched
— since round 42 inside `v3/` — so every v3 asset remains available
for comparison benchmarks and parity work.  v4 therefore has no docs
site yet, and `v3/documentation/` is not touched by v4 work.
Instead:

- **JSDoc on the source is v4's documentation source of truth.**
  Prose about what a member does lives next to the member.  The
  release documentation will be *generated* from these comments
  (docmaker's per-function shape is `{ name, descr, formats: [ {
  descr, args: [ { name, descr } ] } ] }` — a summary sentence,
  per-overload descriptions and named arguments, all of which
  standard JSDoc carries).
- **This file and PLAN.md keep their roles.**  The README is scope,
  design decisions, deviations and the cross-cutting narrative;
  PLAN.md is the logbook.  Neither duplicates per-member
  documentation.
- **Standard tags only** — `@param`, `@returns`, `@throws`,
  `@example`, `@see`, `@defaultValue`.  Overloads get one block per
  signature (docmaker's `formats`).  There is deliberately **no**
  bespoke `@section`/`@docs` tag: a generator reads the existing
  `// -- <group> --` banner comments in `core.mts` and
  `collection.mts` for placement, since those groupings already
  mirror the docs' subsections, so the banners must stay complete
  and accurate.
- **A doc comment states the contract, not the implementation** —
  what it does, what it takes, what it returns, what it throws, and
  where v4 deliberately differs from v3, in this file's voice ("v3
  does X; v4 does Y because Z").  Round references (`(19.3)`,
  `(round 25)`) stay: they are how this codebase cites its own
  history.
- **The declarations ship, with the docs in them** (26.5).
  `cytoscape` has a real `.d.ts`: `rolldown.dts.config.mjs`
  rolls the prototype's declarations up through the same pipeline
  the v3 entry uses, `scripts/build-dts.mjs` finalizes it (the gpu entry is
  ESM-only — the `./gpu` export has no `require` condition — so it
  keeps the generated ESM shape and only gains the UMD global
  name), and the `./gpu` export carries a `types` condition.  Over
  a thousand JSDoc blocks survive into `dist/cytoscape.d.ts`,
  so the comments above are hover text in a consumer's editor —
  which is what makes the pass pay off now rather than at release.
  Two guards: `npm run test:types:surface` audits the shipped shape
  (default export, the named type surface with no leaks, the
  factory's statics, and a floor on the surviving doc blocks) and
  `typescript/tests/api.test-d.ts` is a compile-only consumer test
  in the `test:types` project.  **Closed by round 41.1**: the event
  object is v4's own, and `event.target` types as the core or a
  one-element collection (`EventTarget`), so a handler narrows with
  a type guard instead of casting `unknown` — the compile-only
  consumer test lost its `as` with it.
  The round-37.3 additions to this test are the other direction: four
  `@ts-expect-error` directives pinning that the options type rejects
  unknown constructor keys, since that is where v4's constructor
  strictness deliberately lives.
- **Coverage is enforced, and it is at 100%.**
  `scripts/jsdoc-coverage.mjs` audits every member of an
  exported class whose name does not start with `_`, plus every
  top-level exported function, split into a public-API tier (the
  entry point, `Core`, `Collection`, `Viewport`, the
  animation handle, the layout contract, the public
  style/wire/columnar surface) and an internal tier.  Round 26 took
  the surface from **46% overall** (43% public, 55% internal) to
  **100% in both tiers**, so `test/jsdoc-coverage.mjs`
  gates the simplest possible rule: **no file in `src` may have
  an undocumented public member**, and the failure message names
  it.  Overload *signatures* each carry their own block; the
  implementation signature that closes a run of them is not
  separately documentable and is skipped.  Run
  `node scripts/jsdoc-coverage.mjs --verbose` for the
  per-member list.
- **`@throws` is enforced too, since round 31.2.**  The rule above
  gates that a comment *exists*; this one gates half of what it must
  say.  `auditThrowTags()` (same script, tally printed under the
  coverage report) flags a public member whose body contains a
  `throw` and whose comment carries no `@throws` — 7 of 16 did when
  the audit was written; the surface was 16/16 by the end of round 31
  and is **18/18** today.  It
  **under-detects deliberately**: a member that throws only through a
  helper it calls is not flagged, since whether that belongs to *its*
  contract is a judgement.  Round 31.1 is why this is worth gating —
  a stale doc comment shipped bad advice into every consumer's editor
  via `dist/cytoscape.d.ts`.
- **`@param` is enforced on the public tier, since round 32.**  This
  one is not about editors: docmaker's per-function shape carries a
  **description per argument** and has no return field at all, so a
  missing `@param` is a hole in the release documentation v4 will
  generate while a missing `@returns` is hover text.  That is where
  the gate stops, deliberately.  143 of the 221 public members taking
  arguments documented them when the audit was written; round 32 took
  it to 221/221, and **round 36 found the audit had been walking class
  bodies only** — so the public tier's *exported functions*, which are
  the whole surface of `wire.mts` and `columnar.mts` and are public
  members by the script's own definition, sat outside a gate that read
  as complete.  They are inside it now, at **232/232** — the 230th
  arriving in round 37.3, which found the same failure a third time:
  the exported-function pattern round 36 added did not spell
  `default`, so `src/index.mts`, listed in the public tier since
  round 26, contributed **zero** members to *every* audit while
  reading as audited and complete.  Its whole surface is
  `export default function cytoscape` — the package's entry point —
  and all three of its tags were in fact missing.  The standing lesson
  is the one round 36 wrote into `AGENTS.md`: an audit's scope is part
  of its claim, so check what it enumerates before quoting its 100%.
- **`@returns` is written, and gated since round 37.1** (written in
  round 36).  Round 32 measured this tail at 63 of 276 and left it, on
  the reasoning above; round 36 wrote all 63, so the surface is
  **279/279** (276 at the time; the 277th is the entry point round 37.3
  brought inside the audit, the 278th round 41's event and emitter, the
  279th round 45's widening to `src/event.mts` itself),
  and left the *gate's* boundary exactly
  where round 32 drew it — a policy call of the kind PLAN.md's open call 8 held for
  test coverage.  The fifth design sitting (2026-08-04) took both
  calls, and this one ratchets: `auditReturnTags()` prints the tally
  under the coverage report, `--verbose` lists any miss, and
  `test/jsdoc-coverage.mjs` fails the build on a miss or on the
  tally falling below its ratchet (276 at round 36's completion, 279
  today).  The argument that moved it is that these
  comments ship as `.d.ts` hover text whether or not the docs
  generator reads them, and round 36's own history — a tail completed
  once, by hand, four rounds after it was measured — is what an
  ungated rule looks like.  A
  member counts when its signature carries a return annotation that is
  not `void`/`Promise<void>`/`undefined`/`never`/`this`; one with no
  annotation is skipped rather than guessed at, so the tally is a lower
  bound.  What the tags say is the contract the type cannot: the
  first-element rule and the undefined case, where a reader answers the
  *effective* value rather than the declared one
  (`effectiveOpacity`, `grabbable`), and which predicates are not the
  negations they look like (`inactive` is not `!active`;
  `isChildless` is not `!isParent`).

### The generator (round 45)

`npm run docs:api` (`scripts/docs-generate.mjs`) turns those comments into
the API reference, in docmaker's shape —
`{ name, descr, formats: [ { descr, args: [ { name, descr } ] } ] }` —
grouped into the `// -- section --` banners, which is what round 26 chose
them over a bespoke `@section` tag *for*.  Reading: **362 documented
members over 48 sections in 7 namespaces** (`cytoscape`, `cy`, `eles`,
`ani`, `layout`, `ctx`, `event` — v3's prefixes where v4 has the same
thing, so an upgrading reader lands where they expect).  Nineteen rounds
of gating are what made it a small script: there was no content to write,
because the tags have been complete and enforced since rounds 31.2, 32
and 37.1.

- It **extends the coverage audit's scanner** rather than adding a second
  one — `auditFile` returns each member's doc block and banner beside its
  name — so the generator and the gates cannot disagree about what a
  public member is.
- **Overloads become formats.**  `descr` is the first paragraph (docmaker's
  field is a summary sentence); each format keeps its own block's full
  prose, so an overload's contract is never flattened into its sibling's.
  `pureAliases` carries the 84 `declare x: this['y']` aliases, as v3's
  docmaker does.  `@returns`, `@throws` and `@see` are emitted as their
  own fields: docmaker has no field for them, but folding them into prose
  is lossy in a way a template cannot undo.
- **What is published is derived, not listed**: an exported function is
  documented iff `index.mts` hangs it on the factory, which is what
  separates `serializeElements` from the type predicates beside it.  The
  classes deliberately *not* published — `Viewport`, `StyleEngine`,
  `AnimationManager`, `Emitter` — are a checked table with a reason each:
  being documented for the next maintainer and being published in the API
  reference are different questions.
- **Validated against the shipped declaration, not against the sources it
  was generated from.**  `test/docs-generate.mjs` checks the model against
  `dist/cytoscape.d.ts` — a different artifact, from a different tool, and
  the thing a consumer actually holds — in both directions: a phantom
  entry sends a reader to a method that does not ship, and a dropped one
  silently reintroduces what round 26's gate exists to prevent.  The
  stranded-block check is a precondition here and **gated at zero for
  published files**, where a displaced block would ship twice under the
  wrong name; it stays report-only elsewhere, for round 36's reason.

Two things this round changed beyond the generator, both recorded in
PLAN.md: `src/event.mts` joined the audit's public tier (`Event` is a named
type export and the object every handler receives — the fourth time an
audit's *scope* has been the thing that was wrong), and optional class
members (`target?: EventTarget`) turned out to match no audit's member
pattern at all.  Neither was undocumented; both were uncounted.

## Measuring the error contract (round 30; gated since round 37)

v4 fails loudly by decided design, which makes its throws part of the
public contract — and until round 30 most of them were unverified.
`scripts/throw-coverage.mjs` finds every `throw new` in `src`
and reports which the Node suite reaches, the same way
`scripts/jsdoc-coverage.mjs` reports documented members:
`node scripts/throw-coverage.mjs [--verbose] [--lcov <file>]`, or
`npm run test:throws` (part of `npm test`).

- **A gate since round 37.1, at zero tolerance.**  A `throw new` in
  `src` that the Node suite never runs fails the build unless it is
  classified.  The floor was a policy call while it stood open (PLAN.md
  open call 8); the fifth design sitting took it, and by then round
  36.4 had finished the browser tier, so the reading was already 0 and
  the gate held the day it was written.  The script exits nonzero and
  the failure names the site.
- **The classification lists are maintained allowlists**, which is what
  makes zero tolerance honest.  `UNREACHABLE` (a guard no caller's
  input can reach) and `MISATTRIBUTED` (a line the coverage data reads
  as covered and cannot be) are the only exemptions, so the gate also
  checks *them*: an entry that no longer names a `throw new` line, or
  that carries no reason, fails in its own right.  That check earns its
  place — the keys are `file:line`, and round 34 moved a site out from
  under its entry by inserting two methods above it.  An unchecked
  exemption silently transfers to whatever line lands on the number.
- **Reading (2026-08-05, after round 48)**: **197 sites — 182 run by
  the Node suite**, **10 browser-only, 5 unreachable by design**, **0
  Node-reachable and never run**.  Round 36.4 read 191/176 with the
  same three classifications; round 41's emitter added one Node-run
  site, and round 48.3's fuzzing added five more — the guards it
  needed for corrupt dictionary indices, packed-id blob lengths and
  data-key counts, each specced deterministically in `test/wire.mjs`
  because this gate measures `test/*.mjs` and cannot see a guard
  reachable only from `test/soak/`.  Round 30 read 13 browser-only and 2
  unreachable, and pinned six of the browser tier (the export guards,
  30.2); round 36.4 finished that tier by **specs for four and
  classification for three**.  Specced in the `renderer` project: no
  adapter, no webgpu canvas context, no 2d context for glyph
  rasterization, and a 404 background image (the one a caller reaches,
  whose contract is warn-once-and-render-imageless).  Moved to
  unreachable, each with its reason: `gpu-context`'s
  `navigator.gpu` check is **shadowed by construction** (the factory's
  attach path checks it and then synchronously constructs the
  Renderer, whose ctor reads it again — nothing runs in between), the
  column-mirror lookup is a spec/group invariant no public input
  chooses, and the gpu-tween write-kind guard is barred one layer up
  by the round-25.1 eligibility rule.  They join the big-endian
  platform guard and the SHAPE_MASK field invariant, all listed with
  reasons rather than silently skipped.  (36.4 also fixed a tally bug
  the reclassification exposed: a site in a browser directory *and* in
  the unreachable list was counted twice, so the tallies summed past
  the site total.  `unreachable` wins, as it already did in the
  `--verbose` labels.)
- **Two measurement footguns are recorded in the script header**,
  because the round hit both.  Raw `NODE_V8_COVERAGE` offsets do not
  line up with the `.mts` sources — tsx transpiles before V8 sees the
  file — so the first version of this measurement was fiction (it
  reported 47 dead sites including two that have had throw specs
  since round 13); coverage is collected through the test runner's
  own source-mapped lcov instead.  And function-level (`FN`/`FNDA`)
  records misattribute one-line arrow functions badly enough to be
  useless, so nothing reads them.
- **The tool measured its own error, and says so.**  Line-level data
  attributes the body of a module-level arrow const to the
  module-evaluation count, so one guard (`exportScale` in
  `renderer.mts`) reads as covered in Node where no renderer exists.
  Calibrated against the browser-only tier — 2 of its 14 sites read
  as covered, one of them genuinely (a Node spec drives `GlyphBuffer`
  with a mock device) — the known error is one site in 192, listed in
  `MISATTRIBUTED`.  The tally is a **lower bound** on dead sites.

## Benchmarks

**Round 33 (2026-08-03) is the benchmark sweep**: the suites below grew
from 14 to cover the surfaces that had no measurement at all — layouts,
the algorithm tail, the style engine, loading and the wire format,
picking/box-selection/bounds, the data sidecar and structured queries,
events and the animation manager, images/charts/store internals, and a
breadth pass over the remaining public members.  Two rules came out of
it and now apply to every row here: a row is either **v3-comparative**
(with an idiomatic v3 analogue on the other side) or **gpu-only** (an
absolute cost, or a premium against a v4 baseline of the same shape),
and it says which; and **every performance figure in this file has a
re-runnable source**, or is marked in place as a historical one-off
with the date and machine it came from.  A number nobody can re-run is
a record, not a measurement.  `node scripts/bench-coverage.mjs`
reports which public surfaces have a benchmark and which do not.

`npm run benchmark` (Mitata; `BENCH_N` scales the graph) compares each
core/collection op against its v3 analogue in `v3/src/`.  The suites in
`benchmark/`, by what they answer:

| suite | what it prices |
|---|---|
| `index.mjs` (`core` + `collection`) | the core/collection micro surface vs v3 |
| `materializers.mjs` | whole-graph query materializers (runnable at 200k) |
| `mutators.mjs` | bulk flag/position/data writes vs v3 |
| `traversal.mjs` | the slot-native walks |
| `scenarios.mjs` | five composed traces **with listeners attached** |
| `algorithms.mjs` | all 21 graph algorithms vs v3 (33.2) |
| `layouts.mjs` | every built-in layout, the force executor, the round-17 contract (33.1) |
| `style.mjs` | sheet compile/apply, the parents partition, the readback getters (33.3) |
| `style-bundle.mjs` | the same getters **through the built bundle**, where tsx's `__name` wrapper does not exist (36.5) |
| `load.mjs` | the three ingest forms, conversion, export, incremental add (33.4) |
| `spatial.mjs` | CPU pick by shape, box selection, bounds/fit (33.5) |
| `data.mjs` | the sidecar's column kinds; data + structural queries vs selectors (33.6) |
| `events.mjs` | emits by qualifier kind, the phased compound walk, animation start/stop (33.7) |
| `store.mjs` | id index, CSR, blob pool, dirty tracker, image registry, charts (33.8) |
| `surface.mjs` | the breadth pass: 119 rows over the rest of the public API (33.9, 36.3) |
| `mappers.mjs` | mapper data-write cost per evaluation policy |
| `compaction.mjs` | round 19's shrink profile, repair, forwarding hot path |
| `compound.mjs` | parent/child drags and reparenting vs v3 |
| `curves.mjs` | the **curve premium** — every row against the straight graph |
| `labels.mjs` | shaping, the store label write, the bb label terms |
| `transitions.mjs` | transitions off vs on, incl. the auto-extent worst case |
| `geometry-tween.mjs` | one manager tick per geometry channel |

`npm run benchmark:report` renders a self-contained single-page HTML
report (v3-vs-gpu medians as dumbbells on log time axes, a ranked speedup
overview, per-suite stat tables) into `benchmark/results/`
(gitignored) next to the timestamped results JSON.  Three profiles:
**quick** by default (the v3-vs-v4 micro and scenario suites — kept quick
deliberately), `-- --all` for every standalone sweep as well, and
`-- --full` for the 2k/20k/200k matrix (one process per group at 200k, as
the suite headers require).  `-- --suite <substr>` filters any of them and
`-- --render-only <results.json>` re-renders without re-running.  The two
manually-timed suites (`curves`, `labels`) join the table through
`finishManualRun`, which shapes one-shot rows into the report's job
format; without `BENCH_JSON` their terminal output is unchanged.

**Provenance, and publishing a run** (round 46.5).  A results file now
carries a structured `meta.machine` beside the old `meta.cpu` string —
CPU with the physical/logical split and both clocks, RAM, OS, and a GPU
*inventory* with VRAM — plus the commit's date and subject and a
**`dirty` flag**, because a measurement taken on a dirty tree is not
attributable to the sha it prints, and the report renders that in the
failure colour.  A `--renderer` run additionally records the WebGPU
adapter that actually rendered, which had been captured and discarded
at the `--json` boundary since the renderer benchmarks landed.
`benchmark/results/` stays gitignored and machine-local; **`npm run
benchmark:publish` promotes a run into the tracked
`benchmark/published/`**, which is what the status site renders.  Runs
are grouped by a machine fingerprint and never compared across
machines — see `benchmark/published/README.md`.  The report renders
every published run through the same `renderReport()`, and a results
file written before round 46.5 still renders, which is a spec rather
than a courtesy.

**What a profile costs**, measured 2026-08-04 on the i9-9900K these
rounds have used (round 33's risk register promised this number and no
round had recorded it; the runner prints its own total, so it was
always a run away): **quick 7.1 min, `--all` 17.4 min.**  `--full` adds
the 2k/20k/200k matrix and is unmeasured — it is the profile nobody
runs casually, which is the point of keeping quick quick.

**What round 33 found, and round 34 fixed** — the measurements that went
the *other* way.  Round 33 logged them; round 34 fixed all five, and the
before/after numbers below are through the built bundle at N=2000
(`ele.style` rows from a dedicated process, since a micro-row in a
shared one varies ±30%):

- **The style getters — 292 ns → 122 ns** (round 34.5), against v3's
  52 ns: the gap went 5.8× → **2.3×**; round 35 then replaced the
  150-case switch behind them with a dispatch table, which **flattens**
  what remains — see below.  Profiling the *bundle* put 36%
  of `readProp` in `normalizeProp` — a regex replace and a lowercase
  allocation per read, turning `backgroundColor` into
  `background-color` before the dispatch it precedes — so it is
  memoized.  `numericStyle` 215 → 84 ns, `effectiveOpacity` 240 → 92
  ns.  The five per-call closures were hoisted to module scope in the
  same pass; that is worth 1848 → 255 ns *under tsx* and nothing in the
  bundle, and is reported as what it is: a fix to the harness, not the
  product.
  *(Round 33 published this as 13–21× from a suite that imports `src/`
  through tsx; round 34.0 traced the difference to esbuild's `__name`
  wrapper, which tsx injects on every closure creation and the bundle
  does not have.  For a closure-heavy hot path, benchmarking the
  transpiled sources measures the transpiler.)*
- **The emit path's no-listener gate — 338 ns → 8 ns** for a node two
  ancestors deep (round 34.3): `_emitOnEle` now returns before building
  the event or walking ancestors when nothing listens for the type,
  which is sound because v4's emitter never bubbles to a parent.  It
  matters because the *pointer layer's* sixteen call sites are ungated
  and fire on hover transitions and pointer moves.
  *Round 33 stated this as "a compound child never gets the
  no-listener fast path", citing a `child.position()` row — which
  never reached `_emitOnEle` at all, since the position writers already
  gate.  That row measured compound **auto-bounds invalidation**
  (round 14.3, working as designed).  The narrower claim was the true
  one.*
- **The layout contract — 333 µs → 795 ns** per run for an impl that
  does nothing (round 34.4).  `ctx.eles`/`.nodes` became lazy getters,
  and `nodeSlots()`/`edgeSlots()` read the store's insertion-order list
  (or the scope collection's refs) instead of interning a handle per
  element.  Order is preserved exactly — layouts place by index — and
  specs pin it against `cy.nodes()`/`cy.edges()`.
- **`mutableElements()` — 121 µs → 20 ns** (round 34.2): the three
  unfiltered collections (`elements`, `nodes`, `edges` with no query)
  are memoized against a store *structure epoch*, bumped wherever an
  element enters or leaves the insertion-order list.  A counter and not
  a count, so add-one-remove-one between two calls cannot read as
  unchanged.  Two calls with no structural change now return the same
  object, which is the one visible consequence and is pinned by a spec.
- **`indexOf()` — 12.5 µs → 41 ns** (round 34.1), parity with v3: the
  lazily-built packed-key membership `Set` became a `Map` from key to
  first index, so the cache the set ops already build now carries the
  answer.
- Whole-object `data()` is 6.3× v3 — the columnar rebuild-the-object
  cost, showing up exactly where the design predicts.

**Round 35 — the readback dispatch table.**  `StyleEngine.readProp`
answered all 150 readable property labels from one switch of the same
size, which is a dispatch table written as control flow.  V8 does not
hash a string switch that large, so a property's cost depended on where
it sat in the file: moving `border-width`'s case (body untouched) from
sixth to last took it from 56 ns to 90 ns.  It is now a `Map` of 111
readers, and `readProp` is 60 lines.  The effect is a **flattening**
rather than a uniform speedup — the spread went from **56–286 ns (5.1×)
to 48–110 ns (2.3×)**, the worst property is 2.6× faster and the
earliest few are ~15 ns slower — and on the aggregate a whole-object
`style()` is **1.27× faster on a node and 1.48× on an edge**, edges
gaining more because their properties sat at the back of the switch.
Equivalence is pinned by `test/style-readback-all.mjs`, which reads
every one of the 153 properties on a styled node and a styled edge.
The write path's `applyProp` is a 147-case switch of the same shape and
is **deliberately unchanged**: it runs per *sheet compile* (three times
at construction, once per group per `cy.style()`), not per element and
not per read, so its dispatch is a handful of comparisons against a
27.7 µs compile.  The read path earned the change because of how often
it runs, not because a large switch is wrong on sight.

**Round 36.5 gave those figures a re-runnable source, and refined one.**
Rounds 34 and 35 measured through the built bundle with *throwaway*
harnesses, which contradicts round 33's rule that every published figure
has a source; `benchmark/style-bundle.mjs` is that source, and it
joins `--all`.  Re-measured, round 35's numbers reproduce — 68 ns at the
old sixth case, 53 and 50 in the middle, 93 and 110 at the back — but
the spread is **two populations, not one**.  A colour-valued read builds
an `rgb()`/`rgba()` string, which costs about as much again as the whole
dispatch-and-decode: `background-color` 118 ns and `border-color` 116
against `border-width` 64 and `width` 61, and those two colours sat at
opposite ends of the old switch, so it is not residual positional cost.
`background-color` was the only colour among round 35's six, which is
why it topped that table and why the remaining spread looked larger than
the dispatch actually is.

`node scripts/bench-coverage.mjs [--verbose]` reports which public
members a benchmark calls (83.7% of the callable surface; core 98.9%,
collection 98.5% since round 36.3 added `allAre` and `is`; the total
dipped from 84% when round 45 brought `src/event.mts` into the public
tier, which is the audit widening rather than coverage falling).  Like the stranded-doc-block check it reports and never
gates (throw coverage, its other sibling, has *gated* since round 37.1) —
and it is the weakest of the three audits, matching *call-shaped
mentions*, so it over-detects (a comment counts) and under-detects (a
member reached through a wrapper is missed, which is why the engine-side
`Viewport`/`StyleEngine`/`Animation` files read low: the core calls them
for you).  Read it differentially, not as a score.

**Renderer benchmarks** (`npm run benchmark:renderer`, or
`benchmark:report -- --renderer` to fold them into the same report):
`benchmark/render-bench.mjs` drives `render-bench.html` in Chromium
via Playwright — needs built UMD bundles and a **real GPU adapter** (the
run aborts on none; software adapters are warned about, their numbers are
a different machine class).
*Reading its device numbers* (round 29.5): most `gpu (device)` rows
reproduce run-to-run to ±0.02 ms, which is what makes them usable as a
regression signal — but the **compound scene's `fit-all` pair is bimodal
at the ±40% level** (2.11 ms and 3.00 ms on consecutive runs of the same
build).  Re-measure before believing a change in those two rows; the
round-29.5 comparison first read a 30% "improvement" there that was
nothing but the other mode.  The **`--layout` rows are noisier still**
(±25%, and for a structural reason — see the force-layout section), and
round 36.5 adds the obvious-in-hindsight caveat that applies to every
row here: **do not run anything else on the box.**  Its first `--layout`
run overlapped this repo's own test suite and was discarded.  It replays the interactions behind the
recorded renderer numbers on six scenes (seeded 25k×50k and 100k×300k
generators, ndex-x-large, a 25k×50k *curved* scene whose edges come
in bezier parallel pairs so every edge actually curves, a 25k×50k
*compound* scene with 1k parents, and a 25k×50k *images* scene with
icon-per-type url mappers), v3 canvas vs
v4 WebGPU: continuous-pan steady
state at fit-all / zoomed-in 20× / far-zoom (labels off and on),
hover-while-panning `pick()` latency, and one-shot init / columnar-init /
full-png-export timings.  Wall ms-per-rendered-frame is the comparison
metric (vsync-bound — both sides floor at the display refresh when
fast); `gpu (device)` table rows carry the GPU-pass time from
`timestamp-query`, the unbounded cost.  dpr 2, 1280×800, adaptive render
scale pinned to 1; `--scene <substr>` filters scenes, `--headed` debugs,
`--gpu-only` skips the v3 side (for the gpu-vs-gpu scenarios),
`--layout` swaps the pan scenarios for the live force-layout mode (see
the round-18 section above; `--layout-uncapped` lifts its bounds).  The
gpu side also runs the round-19 **compaction scenario** on a fresh
instance last: the scene is cut to ~10% of its nodes through the store
(so the auto trigger doesn't compact the peak state it exists to
measure), panned at peak slot widths, compacted, and panned again —
wall and device ms per frame before/after, plus the in-page
`compact()` one-shot.  Read-heavy structure ops are where
v4 pulls ahead:
`degree`/`totalDegree` are O(1) off the adjacency index (~100–200× v3),
`components`/`add`+`remove` ~25–35×, set operations up to ~25×.  Collection
identity keys on a packed `{group, slot, gen}` integer (not a string) and
each collection lazily caches its packed keys (sound because `_refs` is
immutable), so `same`/`contains`/`intersection`/`difference` beat v3 once a
collection is reused.  Since round 34.1 that cache is a **Map from key to
first index** rather than a Set, so `indexOf` answers from it too — one
cache, two consumers, and `indexOf` went from a linear re-packing scan
(81× v3) to parity.  `$id` resolves through the O(1) id index rather
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

Collection-scale *writes* are columnar too (`benchmark/mutators.mjs`
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

Composed traces hold up too (`benchmark/scenarios.mjs`: five
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
`benchmark/mappers.mjs` for the write-cost sweep per evaluation
policy.)

Traversal walks (`connectedEdges`, `outgoers`/`incomers`,
`neighborhood`, `roots`/`leaves`, `successors`/`predecessors`, edge
endpoints) are slot-native (`benchmark/traversal.mjs`): they collect
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

The graph algorithms have their own sweep (`benchmark/algorithms.mjs`;
superlinear ops gate on `BENCH_N`): the slot-native walks win every op at
N=2000 — bfs ~34×, dfs ~39×, dijkstra+pathTo ~33×, tarjan SCC ~19×,
betweenness ~13× — while the dense-matrix ops (pageRank, floydWarshall,
markov/hierarchical/kMeans clustering) are parity as expected, identical
math dominating (within ±1.2× at N=500).

## Loading

`options.elements` accepts the classic definition form (v3-style JSON) or
a **columnar bulk-load form**: `{ columnar: true, nodes: { count, ids?,
positions?, parent?, data? }, edges: { count, ids?, sources, targets,
data? } }`
with typed-array columns and edge endpoints as node *indices* — it
ingests straight into the store (contiguous slot runs are memcpys) with
no per-element objects and no id lookups per edge.  `data` holds sidecar
columns by key (plain arrays, Float64Array with NaN holes, or
dictionary-encoded string columns).  Columnar payloads are self-contained: every
edge endpoint indexes a node in the same payload.  Convert classic JSON
with `cytoscape.toColumnarElements(json)`.  There is also a **binary
wire format** — `cytoscape.serializeElements(elements)` (takes either
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
JSON per present value.  Compound hierarchy rides both forms (round
14.8): `nodes.parent` is a `Uint32Array` of payload node indices with
`0xffffffff` (`NO_PARENT`) for orphans — the def converter lifts
`data.parent` into it, ingest links it cycle-guarded after the batch's
nodes exist, and the wire stores it as its own section (format version
3; version-2 buffers still load, and `cy.serialize()` exports the live
hierarchy).  **Graph-level `data()` joined the wire in round 39.2**
(format version 4; every earlier version still loads, since the reader
branches on the presence flags and never on the version number).  It is
one JSON string rather than a column, deliberately — everything else in
the format is per element and scales with the graph, while `cy.data()`
is a single small object of arbitrary values.  Its **load is
asymmetric**, which is the round's one decision: `options.elements`
applies graph data, and **`cy.add( buffer )` ignores it**, because
adding elements to a populated graph must not overwrite that graph's
own `data()`; a caller who wants it after an `add` applies it
explicitly (`cy.data( deserializeElements( buf ).data )`).  Either way, the
factory's load path materializes no per-element handles and emits no
`add` events (nobody can be listening yet); `cy.add()` keeps full
per-element semantics and takes all three forms.  The reverse
direction exists too (round 10): **`cy.serialize()`** exports the live
graph as the wire buffer — ids, positions, selection state, the data()
sidecar and graph-level data (style/viewport/scratch are not part of
the wire) — and
the result feeds straight back into `options.elements`/`cy.add()`.
ndex-x-large (19.6k
nodes / 465k edges, 28.6 MB JSON): definition-form init 236 ms, columnar
init 80 ms — down from 662 ms before the bulk path.  The wire form of the
same graph is 9.2 MB and deserializes in ~5 ms, replacing the JSON path's
90–113 ms parse + 27–48 ms convert.

## Packaging (round 44)

What ships, and what keeps the manifest honest.  The package is
`cytoscape@4`: `exports["."]` (plus `./gpu`, the deprecated alias v3's
users already type) resolves `types` → `dist/cytoscape.d.ts`, `import`
→ `dist/cytoscape.esm.mjs`, `require` → `dist/cytoscape.cjs.js`, with
the legacy `main`/`module`/`types` fields carrying the same three and
`unpkg`/`jsdelivr` the minified UMD.  The tarball is those bundles, the
declaration, `src/` (source-map resolution, as v3 ships it), the README
and the licence, plus `MIGRATING.md` and `CHANGELOG.md` — 106 files
today, before a release build populates `dist/`.

`dist/` holds only the committed declaration in a checkout, and that is
the inherited convention rather than a gap: v3 tracks all six of its
`dist/` artifacts and refreshes them at release, so v4's appear when
its first release build runs (round 50).  Nothing under `dist/` is
gitignored.

`test/modules/packaging.mjs` gates the chain
**rolldown outputs → `dist:copy` → the manifest → the tarball**, which
is hand-maintained at every link.  It asks npm for the real file list
rather than re-implementing `.npmignore` — a denylist, so every new
directory ships by default and the failure mode is additive and silent
— and it imports `rolldown.config.mjs` rather than parsing it.  What it
checks: no development tree or repo document ships; every path the
manifest names is produced by a build script; `dist:copy` copies
exactly rolldown's five outputs, both directions; `types` is the first
condition wherever it appears (TypeScript takes the first match, so a
later one is silently dead); `import`/`require`/`types` point at
`.mjs`/`.js`/`.d.ts`; the legacy fields agree with the `.` conditions;
and `./gpu` resolves to identical files.  It deliberately does not
check that the bundles *exist* — they do not until a release build
runs, and whether one ran is release-workflow business.

## Robustness + soak (round 48)

`npm run test:soak` (`test/soak/`, 24 specs, in the `npm test` chain) is
the tier a release needs and feature rounds never owed: leaks, sustained
churn, malformed input, and more than one instance on a page.  It has its
own script because the leak specs need `--expose-gc` — a leak spec that
cannot force a collection is a flake generator.

- **Leaks are gated on reachability, not on bytes**, and that is the
  round's method note.  1000 create/destroy cycles of a 400-element graph
  grow `heapUsed` by a steady ~2.2 KB per cycle, linear across five
  blocks — which reads exactly like a leak and is not one: a `WeakRef` to
  each destroyed core shows every one collected, and what grows is V8's
  bookkeeping.  A byte bound would have encoded the engine's behaviour as
  v4's contract.  The byte check survives as a wide backstop.
- **The round-11 churn profile is a pass/fail gate**, not a recorded
  measurement: 40 rounds of a 400-element band over a 4000-node graph
  with fresh ids and fresh strings each round (re-adding the same ids
  would refill the same blob bytes and pass with every reclaim removed).
  The id blob holds ~42 KiB at round 0 and at round 40; capacity and
  `highWater` never move.
- **The wire format is fuzzed**, and three defects came out of the first
  run — all one shape, a count or index read out of the payload and
  driving allocation unchecked.  A dictionary index of 2,566,914,049
  against a 3-entry dictionary made `cytoscape( { elements: buffer } )`
  never return; a corrupt flags word made the packed-id offsets a float
  bit pattern and the load took 25.9 s.  Each guard sits at the cheapest
  honest place: the dictionary check is fused into `ingestColumn`'s
  existing walk (free, where the same check in `deserializeElements`
  measured 4× on a reader whose point is being O(1) per column), and the
  other two are O(1).
- **Elements from different instances no longer compare** (48.4).  A ref
  is `{ group, slot, gen }` and identity packs those three, all of which
  are per instance — so the first node of one graph and the first node of
  another packed identically, and all twelve of round 29.3's guarded
  methods answered accordingly: `same()` true, `intersection()`
  everything, `difference()` nothing, `union()` silently dropping the
  other graph's elements.  They now throw, through the same
  `assertCollection` guard and for the same stated reason.  **A
  behaviour change to public API**, carried in `CHANGELOG.md`.

- **Device loss under load** is covered in the `renderer` project (48.5).
  Round 10's spec loses the device on an idle instance; these lose it
  mid-animation (a GPU-leased tween), mid-export (the one readback in the
  architecture) and mid-force-run (the stronger lease — the sim owns the
  position column for its whole run), and require the promise to settle,
  the lease to release, and every position to come back finite and
  writable.  Running the control is what earned the third one: with the
  loss hook neutered the export spec still passed, since it accepts a
  resolved *or* rejected export, so it now asserts the loss as well.

Not yet covered, and the remainder of the round: the documented limit
edges — the 256-layer image cap, a full glyph atlas, the export texture
cap.  Each needs a fixture large enough to reach the limit.

## First-frame cost: deferred pipelines (round 53)

The renderer builds its *feature* pipelines on the first frame that draws
them, not at init.  Only the pipelines every graph needs — nodes, straight
edges, arrows — plus picking and the label layer are built when the device
arrives.

The reason is that creating a pipeline is not where the cost is.  Dawn
returns from `createRenderPipeline` in 0 ms and compiles the shader when
the pipeline is first *used*, so building the whole set at init does not
pay for itself: it moves that compilation onto the first frame, including
for every feature the graph does not use.  Measured as the wall time of
the first presented frame of a one-node graph, on the SwiftShader adapter
the visual goldens pin:

| | first frame |
|---|---|
| all 12 draw pipelines | 4.60 s |
| node pipeline only | 2.65 s |
| no draw pipelines at all | 1.06 s |

A real adapter shows the same shape an order of magnitude smaller
(0.53 s).  Deferring the eight feature pipelines takes the one-node case
to **2.72 s** software / proportionally on hardware, and leaves a graph
that uses every feature exactly where it was.

The same property bites once more at *animation* time, and it is worth
knowing about because it is visible to users rather than only to CI: a
tween's compute pipelines also compile on first use, so the **first**
`animate()` on a page stalls.  Measured on the software adapter under load,
a 1500 ms linear position tween had run *zero* frames 800 ms after
`animate()` returned and had not moved a pixel until ~1.2 s; on a real
adapter the same tween clears its start position at 187 ms.  Nothing in the
renderer defers those pipelines — they are built in `GpuTweenRuntime`'s
constructor at init — which is exactly the point: creating a pipeline is
not what costs, using it first is.  Warming them with a throwaway dispatch
during startup would move the cost to where the device is already being set
up; that is a trade against an already-slow first frame, and it has not been
made.

Two notes for anyone changing this.

- **`createRenderPipelineAsync` is not the answer.**  Awaited, it is ~15%
  better and scales perfectly linearly (1/4/8 pipelines → 621/2409/4756 ms
  sync against 613/2013/4053 ms async): Dawn compiles them serially on one
  thread either way.  The lever is not compiling what you do not draw.
- **The curved gate is monotone.**  `GraphStore.hasCurvedEdges()` goes true
  where `FLAG_CURVED` is written and never goes back, so a graph that
  curves an edge once holds the curved edge and curved arrow pipelines for
  its lifetime.  Recompiling costs more than holding them, and the gate is
  read once per frame.  `test/curve-stream-gate.mjs` pins which curve
  styles reach the curved stream — `haystack` and `straight-triangle` do
  not, and neither does `bezier` until a parallel pair bundles.

A deferred pipeline moves a failure from mount to first draw.  The
`visual` Playwright project draws every gated feature, which is what makes
that checkable.

## Porting from v3 (round 47)

`MIGRATING.md` at the repo root is the porting guide, and it ships in the
package — someone who has just installed v4 and found their selectors
throwing should have it locally.  It carries a recipe table per v3
selector form, the style-property diff, the event names that register and
then silently never fire, and a "behaviour to re-check" table for the
things that compile and then differ (the `straight` curve-style default,
`bottom` text-valign, nodes-then-edges `elements()` order, Float32
positions, OKLab colour tweens, `spring( bounce )`).  `CHANGELOG.md` is
the summary; this file stays the reasoning.

**The property table is measured, not transcribed.**  v3's registry was
enumerated from a live v3 instance — 291 names, properties plus aliases —
and each offered to v4's sheet in all four groups: **153 accepted** (7
only in `core`), **138 rejected**, of which 96 are the numbered
`pie-N-*`/`stripe-N-*` families that became the round-23 `chart` family.
The classification keys on the *property-name* rejection message
specifically, because v4 also says "unsupported" for an invalid keyword —
a first pass matching the word alone reported `shape` and
`source-arrow-fill` as dropped.
`test/modules/migration-guide.mjs` keeps the table honest: every property
it names as dropped must still be rejected, every replacement it offers
must still compile, and the defaults it tells readers to re-check must
still be what it says.

## Known deviations from v3 (accepted for pass 1)

- **Listener firing order**: one core emitter with ref/predicate-qualified
  listeners.  Since round 14.5, compound bubbling gives v3's cross-phase
  order (origin → ancestors → core, stopPropagation honored); the
  remaining deviation is *within* a phase, where listeners fire in plain
  registration order.  Round 41.2 added a second, and it is a fix rather
  than a loss: v3 snapshots its listener list once per `emit()` *call*,
  so in `emit( 'a b' )` a handler for `a` that calls `off( 'b' )` does
  not stop `b` firing; v4's emitter snapshots per event, so the removal
  takes effect.
- **No z-index**: compound parent bodies draw first (round 14.9, in
  depth-asc/slot-asc order), then edges, then leaf nodes, then labels;
  within a stream draw order is slot order (≈ insertion order, but a
  reused slot draws at the recycled position).  A grabbed node does not
  pop above later-inserted nodes.  **Permanent since 2026-08-01**:
  z-index is dropped from v4 by decided design (see "Design
  decisions" above), so draw order stays structural for good.
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
  through a ring of 3 staging buffers (latest-wins; a frame that finds
  the ring exhausted *defers* the still-coalescing request to the next
  frame with a free slot — bounded extra latency, never a spurious
  `null`; ring saturation is observable as `stats().pickDeferrals`).
  Scene submissions are capped at 2 in flight, so even stage-3 picks
  resolve in ~1 rAF plus bounded GPU work on GPU-bound graphs.  Measured on ndex-x-large at dpr 2: node
  hovers ~0 ms, cold background/edge ~7 ms, cached ~0.2 ms,
  hover-while-panning median ~0 ms (was ~70 ms).
- **Far-zoom edge decimation**: once width-floored (hairline) edges fall
  below half alpha, a hash-stable 1-in-N subset draws at N× alpha (N a
  power of two ≤ 64).  Aggregate edge density is preserved, but individual
  sub-half-alpha edges may neither draw nor pick at far zoom.  This removes
  the far-zoom worst case where every edge rasterized into a few hundred
  pixels and serialized at the blend stage (~33 ms → ~8 ms on 465k edges).
- **Curved edges (rounds 12a/12b)**: `curve-style: bezier` bundles and
  self-loops (12a) plus `unbundled-bezier`, `segments`,
  `round-segments`, `taxi` and `round-taxi` (12b) all render on-GPU
  in **one curved stream** of 24-quad strips evaluated from live
  positions (see the design decision above): bezier/loops keep the
  12a analytic evaluation, the 12b route families evaluate their
  route (from the curve param blob) with piece boundaries landing
  exactly on subdivision indices — legs pixel-straight, corners
  exact — and discrete miter normals at sharp corners.  Deviations,
  all recorded: node boundaries use the arrow tier's approximations
  (round-rect as box, polygon as inscribed ellipse); curved edges
  draw after straight edges (two streams, slot order within each);
  the curved stream is never decimated at far zoom; sharp segment
  corners join with a **clamped miter** where v3's canvas uses round
  joins (the difference is confined to the outer join wedge); interior
  point counts cap at 8 controls / 11 segment points; and v3's
  near-overlap control-point correction (`tryToCorrectInvalidPoints`)
  is not ported — overlapping-node curves may differ slightly from
  v3 in the region the nodes occlude anyway.  (12a's border-exclusive
  curved-arrow tips were fixed in 12b via `node.outerHalf`.)  Cull:
  chord-bounded curves grow the Liang-Barsky chord test by the frame
  slack; box-bounded ones (taxi, extrapolated weights —
  FLAG_CURVED_BOX) test the endpoint AABB grown by slack + chord
  length.
- **Round 12c (manual endpoints, haystack, straight-triangle)**:
  `source/target-endpoint` and `source/target-distance-from-node`
  derive through a 10-float endpoint block on the edge's blob record;
  straight + endpoints renders as the `CURVE_MULTI n = 0` chord in
  the curved stream, and a bundled bezier with endpoints promotes to
  `CURVE_MULTI n = 1` (identical control math).  Deviations, all
  recorded: the `-or-label` endpoint keywords throw (no label bb in
  v4); loops ignore endpoint props entirely (v3 overrides the
  keywords; v4 also drops loop distances); taxi forces keyword modes
  to outside-to-node (v3's rule) while distances apply; endpoint
  props are constants-only (the point form is a list); angle
  endpoints intersect the arrow tier's approximate boundaries.
  `curve-style: haystack` (+ `haystack-radius`) and
  `straight-triangle` are *straight-stream* kinds: FLAG_CURVED stays
  clear, so both ride the straight pipeline — haystack keeps
  far-zoom decimation (the 12a "curved stream is never decimated"
  trade-off does not apply to it).  Haystack angles are id-hash
  seeded (deterministic across machines — v3 uses Math.random(), so
  haystack has no exact v3 parity above radius 0; the radius-0
  parity scene pins the pipeline and a deterministic golden covers
  radius > 0); offsets scale by outer halves (v3 uses inner size —
  identical at border 0); haystack edges draw no arrows (v3 skips
  them) and their stored-truth arrow getters read 'none'.  Haystack
  box selection tests the offset points (v3's haystackPts);
  triangle/straight edges keep the endpoint-center approximation.
  The straight-edge and edge-glyph cull tests grow by the monotone
  `haystackSlack()` bound (radiusMax × node half).
- **`node.outerHalf` is a store-derived column** (12b): size/2 +
  border/2 per axis, written through on every node size/border write.
  The curve, arrow and edge-label shaders bind it in place of the
  size + border pair, which keeps each of those vertex stages within
  WebGPU's base 8-storage-buffer budget with a slot to spare for the
  curve param blob; the CPU curve evaluator reads the same column, so
  both implementations consume identical f32 half-extents.  It also
  closes a latent gap: border writes now invalidate the pick-tile
  cache through the derived column's dirty span (borders move curved
  pick geometry, but `node.borderWidth` itself is pick-neutral).
- **Early-z**: a depth prepass writes depth for guaranteed-opaque node
  interiors (skipping translucent fills/borders, LOD alpha and the AA
  fringe — output is pixel-identical), and edges depth-test against it so
  fragments under opaque nodes skip blending.  Depth values come from a
  per-element **z-rank** (two ranks today: edges far, nodes near), a
  mechanism that could carry more ranks and batches if ever needed
  (z-index itself is dropped by decided design — see above); content
  ranked above merely loses the occlusion benefit, never correctness.  The round-14 compound split took the batch route
  instead of a rank: parent bodies draw in their own pre-edge stream and
  are excluded from the prepass (they must not occlude the edges and
  children drawn over them).  Nodes that can't occlude (translucent or
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
  `dotted`, in model px so dashes zoom with content, drawn as an
  AA'd mask in the edge fragment stage.  Since round 13 B3 dashed
  edges use the per-edge `line-dash-pattern` (constants-only,
  normalized to two on/off pairs — longer patterns truncate, a
  recorded cap) and `line-dash-offset`, with `line-cap`
  (butt | round | square) shaping each dash segment; dotted stays
  [1, 1].  Dash phase launches at the source boundary (v3's rule);
  caps apply to dash segments only, not the line ends (the quads
  end at the endpoints — identical to v3's default butt).  Picking
  ignores the gaps, as v3 does.  `border-style` is not ported
  (dashing an arbitrary SDF boundary needs perimeter
  parameterization — see the border-geometry note above).
- **Node shapes** (round 10): `ellipse`/`circle`, `rectangle`/`square`,
  `round-rectangle`, plus the polygon family — `triangle`, `pentagon`,
  `hexagon`, `heptagon`, `octagon`, `diamond`, `rhomboid`, `vee`,
  `star`, `tag` — from the same unit point tables v3 builds
  (`shape-points.mts`), rendered by generated WGSL polygon SDFs with
  vertices scaled to device space (exact distance, so AA and borders
  stay crisp under anisotropy) and picked by an exact CPU
  point-in-polygon in normalized space.  **Round 27 completed the
  vocabulary** — every v3 shape keyword is accepted, with the
  no-dash legacy aliases (`cutrectangle`, `concavehexagon` and, since
  round 37.2, `roundrectangle`) left out by the 2026-07-29 "one name
  per concept" triage.  `roundrectangle` had survived that triage in
  the code for eight rounds while its two siblings threw — an
  unevenly applied policy, pinned rather than patched because
  removing public API is the maintainer's call.  The fifth design
  sitting took it as **one call over three names** (the round-29 docs
  check having found `cy.autolockNodes()`/`cy.autoungrabifyNodes()`
  in the same state) and **split** it: the shape spelling drops, the
  two core aliases stay as recorded exceptions.  It was accepted in
  three enums — the node `shape`, `overlay`/`underlay-shape` and
  `text-background-shape` — and drops from all three, since removing
  it from one would have moved the inconsistency rather than closed
  it.  `right-rhomboid` and `concave-hexagon` joined as
  point tables; `cut-rectangle` (a chamfer of *absolute* length),
  `bottom-round-rectangle` and `barrel` (four sampled bezier
  corners) are parameterized shapes with their own fields; and the
  seven `round-*` keywords render as `sdPolygon( inward-offset ) − r`
  — the identity that makes corner-rounding exact under anisotropic
  scaling, which is what the earlier "no clean closed form" note
  had missed.  Round-* shapes reuse their sharp counterparts' tables,
  as v3 registers them.  One prop, `corner-radius`, carries three
  different 'auto' rules — `min(w/4, h/4, 8)` for round-rectangle,
  a flat 8 for cut-rectangle, `min(w/10, h/10, 8)` for the round-*
  family — all of them v3's.
  Each parameterized shape carries a matching `cpu-pick` branch, and
  since 28.1 the twins are pinned by specs rather than only by
  construction: the shader halves are proved by round 27's live v3
  parity diffs, the CPU halves by hit tests aimed at what is
  particular to each branch (the absolute chamfer, the capped barrel
  offsets, the rounded vertex).  Note that `insideRoundPolygon` is
  the one shape test that is **not** affine-invariant — the corner
  radius is a device-px length — so unlike the sharp polygons it
  works in device space and is pinned at more than one zoom.
  The custom `polygon` landed in round 13 C3 with per-element points
  in a blob pool (`shape-polygon-points`, constants-only).  Arrow
  tips on
  polygon nodes sit on the inscribed *ellipse* boundary
  (approximation); the depth prepass treats polygon interiors exactly
  via their SDF.
- **Labels**: nodes *and edges* (round 10 — edge labels draw at the
  midpoint, following endpoint moves on-GPU; horizontal by default, or
  rotated to the edge's angle with `text-rotation: autorotate`, never
  upside-down — see the edge-labels design decision; since round 27.7
  any label can also take a fixed rotation in radians),
  **multiline since round 16** (`text-wrap: wrap | ellipsis`,
  `text-max-width`, `line-height`, `text-overflow-wrap`,
  `text-justification`; under `text-wrap: none` newlines still
  collapse to spaces), placement on v3's 3×3
  `text-halign`/`text-valign` grid for nodes (round 13 D3 —
  mapper-capable; **v4 defaults to `'bottom'` valign**, keeping the
  round-10 below-node placement, where v3 defaults to `'top'`; the
  gap on the top/bottom rows is the fixed 4 px label margin, as v4
  has no `padding` prop); edges stay
  centered on the midpoint — the curve or route midpoint for curved
  edges (rounds 12a/12b, v3's per-family rules); both offset by
  `text-margin-x/y`; not pickable, one
  global font face (`font-family`/`-style`/`-weight` — the atlas
  holds one font), and the
  glyph atlas is a fixed 1024² texture — once full, new glyphs stop
  rendering with a console warning.  Label color/text bake into glyph
  instances, so `:selected`/hover styling does not restyle label text.
  Round 13 D4 added the `source-label`/`target-label` families (all
  ten props): two more glyph streams anchored at arc distance
  `source/target-text-offset` from each end, walked along the drawn
  path in the label VS (v3's `calculateEndProjection` on-GPU —
  segments exactly; bezier/loop/multibezier via fixed-sample
  polylines; route families along the route polyline, corner
  rounding ignored as v3 does), with per-end margins and
  `autorotate` at the local tangent; the remaining text channels are
  shared with the main label, exactly v3's unprefixed reads.
  Round 13 D2 added per-element `min-zoomed-font-size` (v3's rule —
  the label hides when `font-size × zoom × dpr` drops below it),
  baked into each glyph as a zoom threshold and tested in the glyph
  cull, so the floor costs nothing per frame.
  Round 13 B6 added `text-transform` (applied at glyph-run build),
  `text-border-width`/`-color`/`-opacity` (a band inward from the
  padded background box) and `text-background-shape`
  (rectangle | round-rectangle, v3's auto radius); `text-border-style`
  stays out with the dash-a-boundary styles — a **round-38** question,
  where the scope call (full coverage, every shape) is taken but three
  sub-calls found while scoping it are not; see PLAN.md's open call 1.
  `text-rotation` takes a **number of radians** on any label since
  round 27.7, alongside the `autorotate` keyword (edge labels only —
  it resolves from an edge's slope).  The stored value *is* the
  angle, with `NaN` as the autorotate sentinel: 'none' and 0 radians
  are the same rendering, so collapsing them leaves the whole real
  line free for numeric values, where an enum id would have collided
  with 1 radian.  Recorded cost: the glyph instance grew from 56 to
  64 bytes to carry the angle, ~14% on the heaviest stream, chosen
  over a per-owner storage buffer because the edge label pipeline is
  already at 7 of a base 8.
  Label visuals (round 10): `text-outline-width`/`-color`/`-opacity`
  (a second SDF distance threshold — near-free), `text-background-
  color`/`-opacity`/`-padding` (one solid quad instance preceding the
  run's glyphs, riding the same buffer/cull/draw; it carries the glyph
  block's height so it fades and culls exactly with its text), and
  `text-margin-x/y` — all mapper-capable (CPU-evaluated, like
  font-size), as is `text-rotation`.  Outline and background opacities
  fold into their stored alphas, so their getters read back folded
  (the arrow-color precedent).
- **Arrowheads**: `source/target-arrow-shape` supports `triangle`
  (+`arrow` alias), `vee`, `chevron`, `circle`, `square`, `diamond`,
  `tee` and `none` (round 10 — SDFs generated from v3's arrow point
  tables and evaluated in the fragment stage; the shape ids ride a
  fragment-only storage binding, keeping the vertex stage at its
  8-buffer budget).  **Round 27.6 completed the set** with v3's
  compound heads: `triangle-tee` (a union of two generated polygons
  — coverage is a smoothstep over the distance, so a union is just
  `min( sdA, sdB )`), `circle-triangle` (a polygon plus an analytic
  disc, pulled back by its radius so the *disc* meets the node
  boundary — v3's `spacing`, and the only head v3 offsets),
  `triangle-cross` (whose bar thickness tracks the **edge width**,
  resolved per fragment) and `triangle-backcurve` (its quadratic
  sampled at codegen into an ordinary point table).  Recorded
  deviation: `arrow-fill: hollow` on a compound head falls back to
  filled — the stroke `abs( sd )` is wrong at the seam where a
  union's parts meet, and v3 does not stroke compounds either.
  Round 13 B7 added `arrow-scale` (quantized ×1/16 in
  storage — readback rounds accordingly), `source/target-arrow-fill`
  (filled | hollow — a stroke ring at the per-end
  `source/target-arrow-width`, which takes px, 'match-line' or % of
  the edge width, resolved at style-write).  **Round 27.3 ported
  v3's arrow sizing**: `max( (13.37 w)^0.9, 29 ) × scale`, evaluated
  in *model* space before the zoom scale — the 29-unit floor is a
  model floor, so applying it to the LOD-floored device width would
  make arrows grow as you zoom out.  Note that v3's `size` is the
  point-table *scale*, not the drawn length (its tables span 0.3),
  and that the arrow quad sizes from a computed `ARROW_MAX_BACK`
  rather than a fixed 0.3, since the compound heads reach 0.5 and
  0.6.  Round 13
  C1 added `mid-source/mid-target-arrow-shape`/`-color`: mid arrows
  anchor at the curve/route midpoint on the midpoint tangent
  (mid-source pointing backward), follow drags/layouts/tweens
  on-GPU, and are always filled at the standard width (the mid
  fill/width props are unsupported — a recorded scope note).
  `source/target-arrow-color` as before (v3-like `#999`
  default).  One quad per visible edge per enabled end, reusing the
  edge cull stream; the tip sits on the endpoint node's boundary
  (round-rect approximated by its box, polygons by their inscribed
  ellipse).  Arrows draw *over* the line — a translucent
  arrow shows the line through it — are not pickable (the GPU pick pass
  stays edges-only), and size with the drawn (floored) edge width.
- **Gestures** (round 10 additions): the **cxttap family** — right
  button emits `cxttapstart` / `cxtdrag` (once moving) / `cxttapend`,
  plus `cxttap` when the press never moved; the browser context menu is
  suppressed on the canvas.  **`taphold`** fires after an unmoved
  press of `cy.tapholdDuration()` ms (default 500 — v3's constant,
  made a ctor option + getter/setter in round 20.1).  **`dbltap`**
  fires on a second tap
  on the same target within `cy.multiClickDebounceTime()` (default
  250 ms; ctor option + getter/setter), and the debounced **`onetap`**
  fires when no second tap arrives — plain `tap` always fires
  immediately, as v3.  **Dragging a selected node drags every
  draggable selected node** (the whole set moves via one bulk shift
  per pointer move, all flagged grabbed).
- **Pointer transparency: the `events` prop** (round 20.2): v3's
  `events: 'yes' | 'no'` on both groups (default `'yes'`), constants
  or `case` mappers (CPU-evaluated — the channel is a store-managed
  flag bit, `FLAG_NO_EVENTS`).  `'no'` makes an element invisible to
  every pointer path while it still renders: the CPU node pick scans
  past it (grab/tap targeting, hover and tapdragover fall through to
  the element beneath), the GPU edge pick tile drops it (the edge
  cull kernels test the bit in **pick mode only** — a `pickMode`
  Frame field the scene pass leaves 0, so scene culling is
  untouched), and the box-selection *gesture* skips it (no
  selection, no box/boxselect events — v3 boxes over its interactive
  set).  `interactive()` reads `visible() && events !== 'no'`.
  Recorded scope notes: `cy.elementsInBox()` stays a pure geometric
  query (the gesture filters, the query does not), and an `events`
  flag change invalidates the pick-tile cache through the flags
  column's dirty span (it changes pick answers, not pixels).
  **`text-events`** (round 20.3, default `'no'` — v3's): with
  `'yes'` the node's *label block box* (the exact laid dims at the
  D3 anchor + text-background padding, round 16.4) is part of the
  node for the CPU pick — tap/grab/hover on the label resolve the
  node; node labels never rotate, so the test is an exact AABB.
  Node-only in v4: the edges group **throws** (edge labels are
  never pickable — the GPU tile draws edge geometry only; recorded
  deviation), and an `events: 'no'` element stays transparent
  whatever `text-events` says.  Recorded: the label box picks even
  when the label is LOD-faded at far zoom (`labelFadePx` is a
  renderer readability threshold, not a pick predicate).
- **The display/visibility split** (round 22; third-sitting call —
  "the distinction is useful"): two tiers.  **`show()`/`hide()` stays
  the display tier** (structural element state): a hidden element
  draws nothing, picks nothing and **takes no space** — excluded
  from bb/fit (round 22 also closed a gap where the fit scan and
  collection `boundingBox()` still included hidden elements) and
  from compound auto-bounds — and, new in 22.3, a hidden
  `bezier`-styled bundle member **leaves its bundle**: siblings
  re-fan, and the per-node loop stagger and compound-loop index skip
  it (v3's display semantics; a hidden *node* needs no bundle work —
  every member of a pair shares both endpoints, so the whole bundle
  disappears together, recorded).  **`visibility` is a style prop**
  (`'visible' | 'hidden'`, both groups, constants or `case` mappers
  — the v4 mechanism for per-element variation): paint-only — an
  invisible element draws nothing (body, label, ghost, layers — the
  one WGSL `SHOWN` mask covers every stream) and is not
  pickable/hoverable/box-selectable, but **keeps its space** (bb,
  fit, auto-bounds, layouts) **and its bundle ranks** (visibility
  flips never touch the curve index, so sibling curves are
  byte-stable).  Ancestor-gated for nodes (descendants of an
  invisible parent are invisible — v3); an edge is invisible while
  either endpoint is (the kernels' existing endpoint tests).
  Mechanism: the style engine maintains `FLAG_SELF_INVISIBLE`; the
  store derives **`FLAG_DRAWN`** beside effective `FLAG_VISIBLE` in
  the same subtree walk, and the WGSL `SHOWN` constant reads
  `ALIVE|DRAWN` — every cull kernel and the CPU pick honor
  visibility with zero new bindings.  Getters: `visible()` = drawn
  (edges fold endpoints — v3's rule, now implemented);
  `takesUpSpace()` = the display tier alone (it can now differ from
  `visible()`); `interactive()` rides `visible()`;
  `style('visibility')` reads the element's own state.
  `cy.elementsInBox()` stays geometric (invisible elements are
  inside; the box gesture's interactive filter skips them).
- **Node charts: pie + stripes** (round 23; third-sitting call —
  "definitely yes, and consider other charts in future"): v3's 101
  numbered `pie-*`/`stripe-*` props return as the lean 8-prop
  **`chart` family** (node-only): `chart`
  (`none | pie | stripes`), `chart-values` (a number list — a
  constant array/string, or the `{ data: key }` passthrough reading
  a **per-element array** from the sidecar, refreshed on writes of
  the key), `chart-colors` (a color list *or* a named scheme from
  the mapper DSL's palette table — `category10` default, cycling
  past its length), `chart-size` and `chart-hole` ([0, 1] fractions
  or 'N%' — the hole makes donuts from the same surface),
  `chart-start-angle`, `chart-direction`
  (stripes: `vertical | horizontal`) and `chart-opacity` (folds
  into slice alphas, the B1 pattern).  Scalars/enums are
  mapper-capable; the two list props are constants-only (the 12b
  rule) with the values passthrough as the per-element form.
  Values are **absolute fractions of the whole** (v3's percents: a
  sum under 1 leaves an unpainted remainder, over 1 clamps);
  slices cap at 16 (v3's N).  Records live in a
  round-11-compacting blob behind `node.chartRef`; rendering is a
  dedicated pass (one quad per charted node off the culled visible
  lists, after the image pass — v3's order — clipped to the node
  shape at the border's inner edge, SDF-native with px-space AA at
  slice boundaries), skipped outright while nothing charts.
  Charts are paint-only: never in bb, never pickable.  Pinned by
  the `charts-pie-stripes` golden and two live v3 parity scenes —
  pies at **0.000%** (pixel-exact), stripes at 0.005%.  Recorded:
  charts share the `imageMinPx` readability floor; two upstream v3
  stripe bugs constrain the stripe parity to vertical square-node
  scenes (v3's 'horizontal' keyword is inert — its draw switch
  tests a typo'd 'righward' — and its drawStripe swaps W/H in the
  centering offsets), with the golden pinning v4's horizontal and
  non-square behavior.
- **Interaction tuning options** (round 20.1, all v3 defaults, all
  ctor options with `multiClickDebounceTime`-style validated
  getter/setters read live by the pointer layer):
  `wheelSensitivity` (default 1 — a multiplier on the wheel-zoom
  exponent; custom values keep v3's once-per-instance console
  warning about hardware variance), `desktopTapThreshold` (default
  4) and `touchTapThreshold` (default 8) — css px a press may move
  and still count as a tap, chosen per event by pointer type (v4
  previously used 4 for all pointer types) — and `tapholdDuration`
  (default 500 ms; v3 hardcodes it, v4 makes it configurable — a
  deliberate small surface addition).  `pixelRatio` (`'auto'` |
  number — the ctor option overriding the renderer's device pixel
  ratio) predates the round and is spec-pinned since it: the backing
  store scales by it while picking stays css-px addressed.
- **Box selection**: with `boxSelectionEnabled` (default on), a drag
  while a multiple-select key (shift/ctrl/cmd) is held — or any drag
  when panning is disabled — draws a selection box (a DOM overlay above
  the canvas) and on release selects the contained elements with the v3
  event flow (`boxstart`/`boxend` on the core, `box`/`boxselect` per
  element).  Geometry is v3's default 'contain' semantics answered by
  one columnar scan (`cy.elementsInBox(x1, y1, x2, y2)`, model
  coordinates): a node counts when its bounding box (incl. border) lies
  fully inside; an edge when both of its endpoints do.  Since 12b,
  **curved edges test their curve boundary endpoints** — exactly v3's
  on-boundary rule, via the full-family CPU evaluator (the revisit
  deferred from 12a); straight edges keep the endpoint-*center*
  approximation (a recorded deviation).
  **`boxSelectionMode` (round 39.1)** picks the other rule v3 offers:
  `'contain'` (the default, above) or `'overlap'`, where a node counts
  when its box *intersects* the band and an edge when any part of its
  drawn path crosses it — either endpoint inside, or a segment clipped
  by Liang-Barsky, `curve-geometry.mts`'s `segmentHitsBox` being the
  CPU twin of the test the cull pass has run per edge per frame since
  the first cull.  Curved edges take the conservative-then-exact shape
  the rest of the curve geometry uses: the memoized exact bb rejects the
  common miss, and only a survivor pays for the flattened walk at the
  drawn subdivision.  Two boundaries are deliberate.  The mode is read
  by the **gesture** only — `cy.elementsInBox()` stays the pure
  geometric containment query, so a programmatic caller's results never
  move under an interaction preference — and
  `boxSelectionIncludesLabels` **reverses sense** with it, since that is
  all it can mean in each: under 'contain' the label box must *also* be
  inside, under 'overlap' a label crossing the band is *enough*
  (containment is an AND over an element's parts, overlap an OR).
  Recorded shape difference: v3 spells this as a per-element style prop
  (`box-selection`, whose third value `'none'` v4 covers with the
  `events` prop); v4 makes it a whole-instance option, with the
  interaction quartet on the core.  Cost (`benchmark/spatial.mjs`,
  N=2000 / 4000 edges, a band over half the graph): overlap is **~1.9×**
  containment on straight edges (246 → 470 µs) and **~1.9×** on curved
  ones (968 µs → 1.80 ms), the curved pair being dearer on both sides
  because containment already evaluates curve endpoints there.
  `selectionType()`
  is 'single' (tap/box replaces the selection) or 'additive' (taps
  toggle, boxes add).  **Three-finger touch box selection** landed in
  round 20.5 (v3's gesture): with `boxSelectionEnabled`, three fingers
  sweep a box from the start *centroid* of the three to the moving
  centroid — `boxstart` on the first move, the themed DOM box drawn
  live, applied (boxend / box / boxselect, the 20.2 interactive
  filter, the 16.5 label-containment option) when a finger lifts —
  and a gesture that boxed never degrades to a pinch (v3's didSelect
  latch; leftover fingers stay inert until all lift).  The box
  preempts a pinch in progress (v3's branch order), and a third
  finger landing on an *undragged* cxt pair converts it to the box
  gesture (`cxttapend` first) — pointer events land fingers
  sequentially, so this is the v4 form of v3's simultaneous
  three-finger landing (recorded call).  As v3, the touch box is
  **additive** (it never clears the prior selection, unlike the
  mouse box under 'single'), and an aborted gesture (pointercancel)
  selects nothing.
- **Batch flush granularity**: `endBatch` re-applies style to elements
  added during the batch and refreshes mapped labels; a sheet set during
  the batch flushes as one whole-graph `applyAll`.  Unlike v3 there is
  no per-notification queue to replay — the renderer is dirty-driven.
- **`cy.json()` is export-only**: the import/restore form throws
  (rebuilding from a snapshot needs stored defs the prototype does not
  keep).  Exported element jsons round-trip through the definition form
  of `elements`/`cy.add()`.
- **Two-finger touch: cxt or pinch** (the round-20.4 split, v3's
  rules): a second finger landing **closer than 200 css px** to the
  first starts the **touch cxt gesture** — `cxttapstart` on the node
  under finger 1 (else finger 2, else the core; the synchronous CPU
  pick), `cxtdrag` + `cxtdragover`/`cxtdragout` as the pair moves,
  `cxttapend` (+ `cxttap` when it never dragged) when either finger
  lifts — and the pair **spreading past 1.5× (or 150 px)** cancels it
  into a pinch (`cxttapend`, then the pinch machinery takes over from
  the current spread).  A farther pair pinch-zooms about its midpoint
  immediately (panning with it).  Either way the second finger
  cancels any pan/grab in progress, and the finger left over after
  the gesture stays inert until lifted.  Like other viewport
  gestures, no hover/tap semantics apply mid-pinch.  Trackpad pinches
  arrive as ctrl+wheel and take the wheel path.  Recorded deviation:
  v4 thresholds `cxtdrag` on finger-1 movement past
  `touchTapThreshold` (matching its mouse cxt path) where v3's touch
  cxt emits `cxtdrag` on any move event.
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
- **Compound nodes** (round 14) — the deviations in one place (the
  round-14 paragraphs above carry the detail): parent decorations
  (ghost/underlay/overlay/labels) keep their post-edge draw
  positions while parent *bodies* draw first (permanent — z-index
  dropped 2026-08-01);
  parents are excluded from the early-z prepass; parent boxes can
  sit sub-pixel smaller than v3's with bordered children (no
  miter-corner overshoot in the child extents); `parent()` always
  returns a proper collection; `move({ parent })` re-parents in
  place (no remove/restore refs cycle); compound-loop endpoints
  anchor outside-to-node rather than v3's outside-to-line;
  `boundingBoxAt` skips parent bodies (fit-target approximation);
  drag sets don't flag descendants `grabbed`; and the min-size
  bias props / `compound-sizing-wrt-labels: 'include'` (compound
  auto-sizing reads body extents; public bb includes labels since
  16.4) /
  `:parent:selected` / `z-compound-depth`/`z-index-compare` are
  not ported (decided design).
- **Background images** (round 15) — the deviations in one place
  (the round-15 section above carries the detail): at most 4 images
  per node (fixed FS loop; warn-once); every per-image list prop is
  constants-only, with mappers on the single forms of
  `background-image`, `-image-opacity` and `-image-color` only;
  `background-width/height-relative-to` is not ported; images never
  join `boundingBox()` or picking (unclipped overflow is not in bb —
  the `bounds-expansion` drop's sibling); `clip: node` +
  `containment: inside` clips at the border's *inner* edge, so a
  translucent border shows fill rather than image; repeat tiles
  confine to the node box; raster resolution caps at the top tier
  (1024²); sdf-icon mode collapses multi-color sources to their
  alpha silhouette; crossorigin `null` narrows to same-origin
  fetches (WebGPU cannot upload tainted content); no demotion after
  zoom-promotion (the waste policy reclaims); `imageMinPx`
  (default 8 displayed px) skips images on unreadably small nodes;
  ghosts do not carry images (the A1 simplified-body rule).
- **Slot compaction** (round 19) — the deviations in one place (the
  round-19 section above carries the detail): moved elements take
  fresh generations, so refs held across a compaction repair lazily
  (in place) rather than staying bit-identical; data-sidecar column
  buffers never shrink (in-place constraint); the curve-slack maxima
  stay monotone rather than recomputing; the auto trigger defers
  mid-batch and during a live GPU force run; a compaction demotes
  mid-flight GPU tweens to the CPU for the rest of their run.
- **Interaction + pointer transparency** (round 20) — the deviations
  in one place (the round-20 bullets above carry the detail): the
  touch tap threshold now differs from the desktop one (8 vs 4 — v4
  previously applied 4 to both); `tapholdDuration` is configurable
  (v3 hardcodes 500); `events: 'no'` elements stay out of the box
  *gesture* while `cy.elementsInBox()` stays geometric;
  `text-events` is node-only (the edges group throws; edge labels
  are never pickable) and a LOD-faded label still picks; touch
  `cxtdrag` thresholds on finger movement (v3 fires on any move
  event); the touch box is additive and a third finger on an
  undragged cxt pair converts to the box gesture (the sequential
  pointer-events form of v3's simultaneous landing).
- **No animation queue** (round 21, user-approved divergence):
  animations start immediately and compose by channel; overlapping
  channels evict the older animation in place; sequencing is
  `await animation.promise()`; `stop(jumpToEnd?)` lost v3's
  clearQueue argument; the `queue`/`step` option spellings throw.
- **Display vs visibility** (round 22) — the deviations in one place
  (the split's bullet above carries the detail): `visibility` is a
  style prop, not an element-state API (per-element variation is a
  `case` mapper); edge `visible()` now folds endpoint state (v3's
  rule — previously own-flag only); `hide()` re-fans bezier bundles
  (previously kept ranks); the fit scan and collection
  `boundingBox()` now exclude display-hidden elements (previously a
  gap); `takesUpSpace()` can now differ from `visible()`.
- **Node charts** (round 23) — the deviations in one place (the
  charts bullet above carries the detail): 16-slice cap; values are
  absolute fractions clamping at 1 (no normalize option — apps
  normalize); list props (`chart-values`, `chart-colors`) are
  constants-only with the `{ data }` passthrough as the per-element
  form; charts share the `imageMinPx` readability floor; readback
  reports resolved fractions (declared percent strings do not
  round-trip); the stripe v3 parity covers vertical square-node
  scenes only — v3's 'horizontal' keyword and non-square centering
  are broken upstream (recorded), the golden pins v4's behavior.
- **Transitions + controls** (round 24) — the deviations in one
  place (the design bullets above carry the detail): the trigger
  taxonomy is v4-specific (no classes, no bypass — restyles and
  mapper re-evaluations trigger; v3 transitioned on class/bypass
  changes); durations/delays are plain numbers of milliseconds (no
  v3 time-unit strings); transition config is constants-only (no
  per-element transition props); discrete channels snap at the
  transition's start (geometry numerics tween since round 25);
  channel-opacity folds transition under their color prop
  (stored-truth diffing); a listed prop's mapper eval never runs on
  the GPU eval kernel (mutually exclusive per channel); `progress`
  is a getter only (v3's setter/scrubbing is out), `apply`/
  `applying` are out, and reverse's value continuity is exact only
  for point-symmetric easings (v3's start/end swap shared the
  rule).
- **Device-loss recovery** (round 10): an external device loss emits
  `devicelost` and auto-recovers once — the core re-mounts a fresh
  renderer against the same container (the model is CPU-canonical, so
  columns, glyph runs and pipelines all rebuild), then emits
  `devicerestored`.  If a loss lands while a recovery is in flight, or
  the device can't be re-acquired, the instance goes headless-dead and
  emits `error` (the previous behavior).

## Follow-up hooks

- **The release sequence** (rounds 44–51), and what is left of the four
  that have landed.  **44** (packaging) is complete as a source
  concern; its one remaining act is release-time and belongs to round
  50 — the first release build must actually commit the five `dist/`
  bundles, and `pre_release_test.sh` should run
  `test/modules/packaging.mjs` after `npm run dist`, where the
  "do these files exist" half is meaningful.  **45** (the docs
  generator) is complete, and it unblocks **46**, the docs site, which
  now has its input rather than a plan for one.  **47** (the migration
  guide and CHANGELOG) is complete; both ship in the package, so they
  are documents to keep true rather than to write once.  **48** (soak)
  landed its Node tier and its device-loss-under-load specs; what
  remains of it is the documented **limit edges** — the 256-layer image
  cap, a full glyph atlas, the export texture cap — each of which needs
  a fixture big enough to reach the limit rather than any new
  technique.  **49–51** (cross-platform validation, release
  engineering, the release bake) are untouched; 49 needs hardware this
  box does not have.
  Two public-surface changes were made in these rounds without a call,
  and both are logged in PLAN.md's "Open calls for the maintainer" as
  items 14 and 15 rather than left in a diff: round 45 exported the
  layout contract's types, and round 48.4 made twelve collection
  methods throw across instances where they had been answering wrongly.
- ~~Slot compaction~~ — **closed by round 19** (2026-08-01, the
  section above): live slots compact with a monotone remap, forwarded
  lazy ref repair, and the auto + explicit trigger pair.  The
  slot-stable tier (id blob, CSR adjacency, string dictionaries) has
  self-compacted since round 11.  No architecture hooks remain open;
  demand-gated feature hooks (the elevated draw tier, per-side
  compound padding, multilevel force refinement, more layouts, future
  chart kinds on the round-23 surface) stay
  logged in their sections above.
- **Open API follow-ups**: ~~the animation controls and style
  transitions~~ — **closed by round 24** (2026-08-01, the design
  bullets above): transitions landed with the stored-truth trigger
  diff + GPU offload, and the handle carries
  `pause`/`resume`/`reverse` + read-only `progress`/`paused`.
  ~~The geometry-tween round~~ — **closed by round 25**
  (2026-08-02, the geometry-tweens bullet above): node
  width/height, edge width (+ ride lanes), compound padding and
  font-size tween through the animation system and
  `transition-property`, CPU-canonical per tick with the
  invalidation cascade in the store's write funnel, benchmarked.
  ~~The small parity remnants~~ — **mostly closed by round 27**
  (2026-08-02): the unported shape keywords, the compound arrow
  shapes, v3's nonlinear arrow-size formula and per-element numeric
  `text-rotation` all landed, completing v3's node-shape and
  arrowhead vocabularies.  **`border-style` / `outline-style`** was
  the last one left, waiting on a scope call rather than a technique;
  the fifth design sitting took it — **full coverage, every shape** —
  and it builds as round 38, which has not started: scoping it turned
  up three further sub-calls the sitting did not reach (v3's `double`
  *erases* a stripe rather than drawing a second band;
  `dashed` borders need `border-dash-pattern`/`-offset`, which v4 has
  for edges and not for nodes; `border-cap`/`-join` have no v4
  counterpart), logged in PLAN.md's open call 1.
  ~~The `panBy` animation target~~ — **closed by round 28.2**
  (2026-08-03, the viewport-targets bullet above).  Round 28 also
  closed the verification gap round 27 left behind (its CPU-pick
  branches were untested) and trued up the gap ledger, which then
  held only open design calls.
  **Every one of them was taken at the fifth design sitting**
  (2026-08-04), together with the contradictions rounds 28–29 turned
  up between the code and the decided-design ledger and round 30's
  question of whether error-contract coverage should gate.  The
  outcomes, and where each lands: `border-style`/`outline-style` at
  full coverage (round 38); the **legacy-alias policy** split —
  `roundrectangle` dropped, `autolockNodes`/`autoungrabifyNodes` kept
  as recorded exceptions (landed, round 37.2); overlap box selection,
  `cy.gc()` and graph-level `data` in the *binary* wire format all
  build — **all three landed in round 39** (2026-08-04);
  core/collection extension points stay
  demand-gated deferred; unknown constructor options stay
  runtime-permissive, closed at the type layer instead (landed, round
  37.3); dropped v3 event names stay legal and silent, documented
  (landed, round 37.4); `preventDefault()` is **half wired** — its DOM
  half landed with the v4 Event (round 41.4) while the *gesture* half
  became a new open question, since the enumeration of preventable
  defaults turned out not to be derivable from v3 at all; and both
  audits gate (landed, round 37.1).
  `cytoscape.warnings()` builds too, but the **error policy** behind
  it — v3's mostly-no-throw stance against v4's fail-loudly design —
  is the one question deliberately left open, and is round 40's own
  sitting.
  The sitting's **packaging** decision — v4 becomes the package, v3
  into a self-contained `v3/` — **landed as round 42** (2026-08-04),
  with the two calls it left to docs-first taken there: the
  `gpu-`/`webgpu-` prefixes drop, and the five shared utility modules
  duplicate rather than stay shared, so nothing under `src/` imports
  outside it.  A third call the plan had not foreseen — the `Gpu*`
  exported *type* names, logged as open call 13 — was taken the same
  day and executed as **42.6**, so the whole public surface is
  unprefixed.  What round 42 deliberately did *not* do, each logged
  for its owning round: the dist/exports hardening and the pack spec
  (round 44), and the three v3 release workflows, which stay in
  `.github/` because GitHub reads workflows only from the repo root —
  marked as unadapted rather than half-repointed, and round 50's job.
  PLAN.md's **"Open calls for the maintainer"** remains the one place
  to read before deciding anything about v4's surface: contradictions
  are logged there rather than patched, because removing public API is
  a call to be made, not inferred.
- ~~**The debug harness**~~ — **rebuilt by round 43** (2026-08-04), which
  was inserted ahead of the release sequence (and renumbered the old
  43–50 to 44–51).  It found the harness both broken and misleading:
  four of its seven networks had 404'd since round 42 moved the v3 tree,
  silently, and its style sanitizer kept a 14-property whitelist that
  dropped every mapper — so v4's whole style surface was being discarded
  before it reached the core, and the page read as "v4 can't style".
  Now hand-authored sheets per fixture (the real enrichmentmap.org style
  among them), two genuinely compound graphs, the v3 page's control
  sections, and `test/modules/debug-harness.mjs` — `debug/`'s first test.
  The round also fixed the background-grab indicator, which had never
  followed the cursor (see the core-theming notes above).
  **A maintainer review pass on 2026-08-05 found three more**, all of
  which only a person opening the page could have: livereload had
  never connected (it binds `localhost`, which resolves to `::1`
  here, while `http-server -o` opens the page at `127.0.0.1`); box
  selection cost seconds of forced layout, because the event log read
  `scrollHeight` after every appended row and box selection emits
  three events per element; and the compound fixture was not the
  verbatim port of `v3/debug/compound.js` its record claimed — the
  node order had been sorted and v3's `cols: 3` dropped, which is
  what made its parent boxes overlap.  Fixing the third is what
  turned up the `fit()` over-estimate corrected in the
  compound-loop-edge notes above.
- ~~**The completion tail**~~ — **closed by round 36** (2026-08-04):
  the `@returns` tail round 32 measured and deferred (63 written, so
  276/276 — reported and not gated at the time; **round 37.1 gates
  it**, and the surface is 279/279 today), the `@param` gate's own
  blind spot (it had never walked the public tier's exported
  functions; 229/229 then, 232/232 now), the four reachable
  browser-only throws and the three that are not, the two public
  collection members no benchmark called, and the three measurements
  this repo had promised and never taken (`--layout` on real
  hardware, the report profiles' wall times, and a re-runnable source
  for rounds 34–35's bundle figures).  What it *found* rather than
  closed: a **stranded-doc-block check**, whose first run turned up
  six more instances of the eleven-instance pattern — one of them
  shipping in `dist/cytoscape.d.ts` — and which reports rather
  than gates because the third shape of the defect is not statically
  detectable at all.
- ~~**Five measured slow paths**~~ (round 33) — **all five fixed in
  round 34** (2026-08-03): the style getters (292 → 122 ns, via
  memoizing `normalizeProp`), the emit path's missing no-listener gate
  (338 → 8 ns), the layout contract's per-run materialization
  (333 µs → 795 ns), `mutableElements()` (121 µs → 20 ns, via a
  structure-epoch memo) and `indexOf()` (12.5 µs → 41 ns, parity).  Two
  of the five findings were **corrected while being fixed** — the style
  gap was 5.8× rather than 13–21× (tsx's `__name` wrapper inflated it)
  and the emit row round 33 cited never reached the emit path at all.
  The before/after numbers are in the Benchmarks section above.
- **Documentation** — round 26 (2026-08-02) settled the near-term
  shape: JSDoc on the source is v4's documentation source of truth
  and the declarations ship with it (see "Documenting the source"
  above).  The **generator** that turns those comments into docmaker
  input was the half left open there, and **round 45 built it**
  (2026-08-04; `npm run docs:api`, and "The generator" above).  What
  stays open is the release docs themselves: the site is round 46, and
  `v3/documentation/` belongs to v3 until then.  What *is* ready is the
  input: after rounds 31–32 the public surface carries all three of
  the tags a generator reads — a doc comment on every member (26),
  `@throws` wherever a member throws (31.2), and `@param` on every
  member that takes arguments (32, widened in 36.2 to the exported
  functions the audit had never walked, and again in 37.3 to
  `export default function` — the entry point, and again in round 45 to
  `src/event.mts`, a whole file the tier had never listed: **232/232**) — each
  gated, so the generator's input cannot rot before the generator
  exists.  **`@returns` is complete since round 36** (**279/279**) and
  **gated since 37.1**: docmaker's shape still has no return field,
  but the tags ship as `.d.ts` hover text regardless, and a tail
  completed by hand four rounds after it was measured is what an
  ungated rule looks like.  **The generator landed as round 45**
  (2026-08-04; see "The generator" above) — `npm run docs:api`, 362
  documented members over 48 sections, validated against the shipped
  declaration rather than against the sources it reads.  The site is
  round 46 — no longer "not until v4 ships" but scheduled, and now with
  its input built.
  Also logged from 26.5: `event.target` typed as `unknown` on the
  shared v3 event object — **closed by round 41**, which gave v4 its
  own Event and emitter.  It did *not* sever v4's last shared-module
  import of v3, as the round-41 plan assumed: five generic utility
  modules remain (`math`, `types`, `util/colors`, `util/position`,
  `util/sort`), now a maintained allowlist in
  `test/modules/import-graph.mjs` and a round-42 call.
