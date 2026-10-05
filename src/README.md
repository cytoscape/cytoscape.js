# Cytoscape.js v4 (`src`)

First pass of the v4 performance redesign spec'd in
[#3486](https://github.com/cytoscape/cytoscape.js/issues/3486): a separate
prototype core with a **CPU-canonical columnar model** (typed-array columns,
stable slots, per-column coalesced dirty spans) written through to
**persistent GPU buffers**, rendered by a **WebGPU pipeline** (SDF node
shapes, straight and curved edges — round 12a's bundled bezier +
self-loops and round 12b's unbundled-bezier/segments/taxi families —
reading endpoint positions and curve params on-GPU, GPU picking,
compute culling + indirect draws + LOD).

**What this document is.**  The maintained scope, deviations and
design-decisions record for v4 — what it does, what it deliberately does
*not* do, and why.  It is not a tutorial and not an API reference: the
API is documented in JSDoc on the source (and shipped in
`dist/cytoscape.d.ts`), and the development record with its per-round
measurements is `PLAN.md`.  If you are looking for what to port and what
to change, read `MIGRATING.md` first.

The three sections a reader usually wants are **"Design decisions"**
(the calls that make v4 different from v3, each with its reason),
**"Known deviations from v3"** (where v4 does not match and what it does
instead), and **"Follow-up hooks"** (what is deliberately still open).
Everything between here and them is a chronology, and skipping it costs
nothing.

**How far along this is.**  v4 covers its own documented scope and is
being hardened; it is **not close to a release**, and the round list in
`PLAN.md` is what has been *written down* rather than everything 4.0
needs — several rounds are known to be needed and are not logged yet.
This document has the same optimistic bias `PLAN.md` does and for the
same reason: it is assembled from rounds that closed green, so "landed",
"complete" and "at parity" appear on almost every line.  Each is true of
the scope it names.  None of them is a statement about the distance to
4.0, and "Follow-up hooks" at the end is the closest thing here to an
honest inventory — an inventory, not an estimate.

## Alpha decisions awaiting implementation (3 October)

The alpha interview in the plan record scopes the next batch;
none of the following changes is shipped by this planning update:

- 146: triangle-tee replaces triangle-cross without an alias; width-aware
  tee bars and hollow compound end heads.
- 147 and 80: partial automatic scale endpoints, cy.legend() JSON and
  legendchange, then 255-value charts, explicit heat scales, signed bars,
  compact records and shared domains. Per-node autoscaling and chart labels
  are excluded; applications own normalization, labels, axes and legends.
- 82: convex then organic/concave compound shapes over actual child outlines,
  and implementation of the existing compound-sizing-wrt-labels: include.
- 148: manual miniature compounds, actual positions plus effective-size
  multipliers, optional animation and collapse state synchronized by follow.
  Children/edges remain real and visible; locked positions stay put while
  sizes shrink. Style readback remains unscaled and geometry readback scaled.

The earlier proxy/aggregate collapse proposal is superseded. Aggregate edges
are deferred display objects with their own open persistence/direction calls.
Automatic viewport snapping, obstacle-avoiding hulls and a public concavity
control remain future maintainer decisions. Existing implementation sections
below still describe the current code, not these planned capabilities.

## What landed, round by round

Round 13 (2026-07-31) swept
the straightforward v3 style props into the prototype — ghosts,
overlay/underlay + core theming, the opacity split, border/outline
geometry, dashes and casing, arrow scalars and mid-arrows, gradients,
custom polygons, and the label prop families (fonts,
min-zoomed-font-size, the alignment grid, source/target labels) —
each with stored-truth readback and a golden and/or live v3
pixel-parity pin (details per prop below and in PLAN.md).

Round 14
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
instead of its peak.

Round 20 (2026-08-01) closed the interaction
options + touch parity gap: the tuning quartet (`wheelSensitivity`,
`desktopTapThreshold`/`touchTapThreshold`, `tapholdDuration` — ctor
options + getter/setters), the `events`/`text-events`
pointer-transparency props (a flag bit read by every pick path), and
v3's two-finger cxt and three-finger box touch gestures.

Rounds
21–23 (2026-08-01, the third design sitting) removed the animation
queue (concurrency by channel; promises sequence), split
display/visibility (`show()`/`hide()` keeps the structural tier —
now re-fanning bezier bundles — while the `visibility` style prop is
paint-only invisibility that keeps space and bundle ranks), and
brought **node charts**: v3's pie/stripe props as the lean
list-valued `chart` family with data-driven values and scheme
palettes.

Round 24 (2026-08-01, the fourth design sitting) closed
the animation follow-up: **style transitions** (the `transition-*`
config per sheet group — restyles tween on stored truth with
latest-wins eviction, GPU-offloaded when all-paint, under the
auto-vs-explicit mapper-domain performance contract) and the
**animation controls** (`pause`/`resume`/`reverse` + read-only
`progress`/`paused`).

Round 25 (2026-08-02) built that record's
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
`outline-style` remained the one unported style pair until round 38
(2026-08-08) closed it.

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
elsewhere, or silently not at all.

It also priced curved edges on
the CPU (`benchmark/curves.mjs`) and re-ran the renderer
benchmark on real hardware, which showed round 27's shader branches
cost nothing measurable per frame.

Round 30 (2026-08-03) continued that axis onto the part of the
surface this file states most often and the suite tested least:
**what v4 throws**.  Failing loudly is a decided design — an unknown
sheet key, style property, query key or `boundingBox()` option all
throw — and, measured with source-mapped coverage, **34 of the 191
throw sites in `src` had never executed**.

Every Node-reachable
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
coverage rule.

It also covered `mouseout` and `pointercancel`, the
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
suppress cannot be derived from v3, so that list is a v4 contract to
design — its docs-first proposal was written 2026-08-08 (PLAN.md's
"Round 41.5 docs-first" section).  **The seventh sitting (2026-08-09)
closed both, each by declining the surface**: errors and warnings stay
exactly as built (no `cytoscape.warnings()`, no demotion — the
fail-loudly contract stands whole, with the 198-site classification as
its recorded rationale), and gesture defaults are controlled by their
explicit toggles alone — `preventDefault()` is browser-level only,
permanently.

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
kept as a deprecated alias (removed before alpha by round 131).  The `gpu-`/`webgpu-` prefixes dropped
from the test, benchmark, script, debug and Playwright names; the
five utility modules v4 had still been importing from v3 are now
v4's own copies, so nothing under `src/` imports outside it.

The factory, the bundles, the declaration, the UMD global **and the
exported type names** are all plainly `cytoscape`'s now: `Core`,
`Collection`, `Event`, `Stylesheet`, `CytoscapeOptions` and the rest
lost the `Gpu` prefix in 42.6, with no deprecated aliases — the
prerelease line has no published consumers to break.

Six internal
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
so `union()` silently dropped the other graph's elements.

Each has
its own section below.

Round 55 (2026-08-06) is the **edge-routing and arrow parity** round,
inserted after a maintainer opened `debug/?network=v3-default` and
reported five things no test could see — because every golden compares
v4 against v4, and the scenes that do compare against v3 were both too
coarse (a 6 px arrow gap is 0.005% of their canvas) and deliberately
arrow-free.  It built a **numeric** v3-vs-v4 routing harness that
compares routed geometry field by field rather than photographing it,
put an ink floor under all 29 pixel-parity scenes (twelve had none), and
pinned the boundary-approximation tier against v3's own math.

Its
headline is a negative result worth as much as a fix: **v4's curve
routing is correct** — taxi, segments, self-loop stagger and bundle
sign all match v3 exactly, including the axis-aligned degenerates — so
the search moved downstream to the strip and the arrows.  It fixed the
`round-taxi` zero-leg NaN (which broke `boundingBox()` for the whole
graph, and so `fit()`), corrected `source/targetEndpoint()` to v3's
node-boundary answer, and established that v4's tighter compound box is
*correct* rather than a shortfall.  Its one unbuilt piece, the arrow
`gap`, landed as **round 56** (2026-08-07).

Round 56 ports v3's `gap` and `spacing` in full.  v3 keeps two shortened
points per edge end — the drawn line stops `gap` behind the node
boundary, the arrow tip sits `spacing` behind it — and v4 had neither, so
its line ran to the node *centre* and showed through every hollow head.
The shape word rides in `edge.width`'s second lane, which is how it
reaches four vertex stages that are all at the 8-storage-buffer budget,
and the WGSL for `gap` is **generated from the same tables** the CPU
reads.  The gap is routing rather than paint: v3 builds its drawn path
from the shortened points, so a head shortens the *curve* and moves its
midpoint.

Two further findings, both from looking at pixels rather than at code.
A hollow head **strokes its outline**, reaching half a stroke width
outside the polygon and furthest out at the back corners — clipped to the
quad's 1 px margin, which is the flat-cut corners the maintainer saw.
And six goldens were **cropping the graph**, the worst losing
109 px of a 300 px canvas; uncropping it exposed four compound arrowheads
that had been listed in the scene and never given a mapper clause since
round 27.6.

**Round 57** (2026-08-07) is a cleanup round the maintainer raised: the
repository adopts `oxfmt`, these documents are made readable and honest
about how far v4 is from ready, `debug/` gains four networks ported from
v3's demos, and the default look moves onto v3's — which measurement
narrowed to the two affordances that are *not* style properties.

v4's
colours already matched (`#999` on both sides for nodes and edges since
round 1); what did not was that a selected edge looked exactly like an
unselected one, and that `FLAG_ACTIVE` existed with **nothing reading
it** — no shader bound the bit and the pointer layer never set it.
Both are drawn now: v3's `:selected` (and `:parent:selected`) in the
node fragment shader and on every edge and arrow colour, and v3's
`:active` through the round-13 A2 overlay machinery, which is what that
machinery was ported for.  The live parity scene over selected leaves, a
selected parent, straight and curved edges and their arrowheads reads
**0 differing pixels**.  See the round-57 plan in PLAN.md.

The round then kept growing the same way it started — the maintainer
looking at the running page — through four follow-ons on 8 August.
57.8: pressing an **edge** activates it (the press resolves through the
async GPU pick; the active-bg circle waits for the same answer).  57.9:
v3's **hit-test halos** — 8/24 rendered px around edges for
mouse/touch, 2/8 around nodes — applied by every gesture pick while
`cy.pick` stays exact.  57.10: **arrowheads are hit targets**,
answering as their edge with the filled area counting regardless of
`arrow-fill`, via pick twins of the arrow pipelines reusing the scene
SDFs.  57.11: the debug harness moves onto the **default style** — the
non-production style kind is now literally the empty sheet, the four
v3 demo ports are as minimal as v3's own, and every custom sheet
re-states selection (a spec selects an element under each sheet and
fails if nothing visible changes).

Round 52 (2026-08-08) minifies the WGSL at build time — the answer to
the maintainer's "why is v4's bundle bigger than v3's".  Shader text was
23.7% of the minified bundle because a JS minifier does not touch string
contents; a `wgsl` template tag now marks every multi-line shader
literal and a rolldown plugin strips comments and collapses whitespace
with `${...}` interpolations byte-for-byte opaque, taking
`cytoscape.min.js` from 663.3 to 601.1 KiB (182.3 → 163.3 KiB gzipped).
See "Shipped shaders" below.

Round 38 (2026-08-08, out of numeric order — it waited on its design
sitting) ports the last unported v3 style pair: **`border-style` and
`outline-style` at full coverage, every shape**, plus
`border-dash-pattern`/`-offset`.  The node fragment shader gained the
perimeter coordinate the pair needed — per-shape arc length with u = 0
and direction matching v3's canvas path construction, exact elliptic
arc length included — and v3's `double` erase, dotted's hardcoded
[1, 1], and the outline's hardcoded [4, 2]/[1, 1] all draw as v3 draws
them.  Five live parity scenes pin it (the exact tiers at 0.18–1.19%
with feature-off controls at 3.6–10.9%); the details and the recorded
deviations are in the border-style section below.

Round 54 (2026-08-08) is the bounds round: the conservative fit scan's
compound-loop term went from a disc of `p2 + the global nodeHalfMax`
around both endpoint centres to a *directional per-edge box* (v3's
construction only ever hangs the controls up-left of the union of the
two node boxes), the remaining box-bounded margins went per-edge, and
taxi went **exact** — because the round's new randomized soundness
sweep caught, on its first run, a forced-direction taxi overshooting
any node-half margin by its turn.  Fit zoom on the compound fixture:
0.607 → 0.822.  The sweep is a standing gate now
(`test/modules/bounds-sweep.mjs`); the compound-loop section below
carries the formulation.  **Round 92 (2026-08-28, raised by the
maintainer) finished the move from conservative to exact**: the
compound-loop and weight-extrapolated terms 54 had kept conservative
now read the same memoized exact curve bb taxi does, in both CPU scan
sites — the kept p2 cushion still over-framed the compound fixture
1.23× and, growing up-left only, de-centered every compound fit
(fit centers the box it is given, so one-sided slack reads as "fit is
broken").  Fit zoom on the compound fixture: 0.822 → **1.077**, the
exact box's own fit, centered to the pixel; the warm scan got 4×
faster as a side effect (a fresh memo now answers without evaluating
the curve).  The sweep pins exactness both directions where every
curve is box-bounded; the cull kernels keep their conservative terms
deliberately (43.13's standing rule).

Round 59 (2026-08-09, raised by the maintainer) rebuilt the force
layout's model after it was measured diverging exponentially on any
graph with hubs or high mean degree — em-web ended at a 3e11-px
bounding box, and the compound fixture NaN'd wholesale.  The
round-59 model is stability-by-construction (d3's degree-normalised
springs, a capped step), gains a real far field (a monopole pyramid
over the binning grid, cosmos.gl's shipped scheme), is
component-aware end to end (packed anchors, constant-magnitude
gravity, a settle re-pack — v3 cose's own `separateComponents`),
seeds from a landmark-MDS spectral draft (fCoSE's approach), and
gives compounds the Bilkent gravity + nesting terms on the CPU
executor.  ndex-x-large — mean degree 47, the explosive shape —
converges live on the GPU in 1.3 s and fits at zoom 0.76.  The
force-layout section below carries the model.

Round 91 (2026-08-28, raised by the maintainer — the first of the
screen-pass rounds) is the resize round: the network view stretched and
squished while the window was dragged.  The steady state was already
correct; the distortion was the transient — a `100%`-CSS canvas lets
the compositor scale *stale* content to the new layout for at least one
frame, because ResizeObserver callbacks run after this update's rAF and
the redraw was `schedule()`d to the next one.  `resize()` now draws the
frame synchronously (the RO callback runs before paint, so the frame
that composites the new layout composites new content — the stretched
frame never exists), and `applySize` writes the canvas CSS box in
fixed px, v3's shape — a late frame can then only letterbox, never
stretch — with both halves mirrored on the worker mount.  The same
round un-froze the device-pixel ratio: with `pixelRatio: 'auto'` (the
default) every measure re-reads `devicePixelRatio`, and a matchMedia
resolution query — re-armed per change, torn down on destroy —
triggers the re-measure and emits `resize` on the core (v3's
`cy.resize()` semantics), so browser zoom or a move to a
different-density monitor re-rasterizes instead of blurring at the
construction-time ratio.  An explicit `pixelRatio` number stays
pinned (spec-pinned both ways), the cached pick tile drops on a ratio
change (it is device-px addressed), and the worker proxy posts the
re-resolved ratio with each resize message.

Round 98 (2026-08-28, the first of the runtime rounds) made "runs on
Bun and Deno" true and gated rather than fortunate.  The import-graph
spec now asserts the set of non-relative specifiers under `src/` is
empty (no `node:*`/`bun:*`/`deno:*`, no bare package — the scanner
strips comments with a string-aware walk first); a framework-free
cross-runtime smoke (`test/runtimes/smoke.mjs`) runs the built ESM,
minified-ESM and CJS bundles under Node, Bun and Deno with the exit
code as the contract, asserting values and ordering — never "it didn't
throw"; and `ci-bun`/`ci-deno` gate merges at latest stable plus a
pinned floor (Bun 1.4.0, Deno 2.9.6).  The smoke found zero defects on
its first run — the headless path already spoke web-platform — so the
round's fix budget went unspent.  Details in the "Runtimes" section
below.

Round 94 (2026-08-28, the screen pass's label-fidelity round) made
zoomed-in labels stop going soft.  The atlas header claimed "crisp at
any zoom from one 32px-per-glyph atlas", and it was true of the *edge
AA* (fwidth-based, scale-free) and false of the *letterform*: raster +
EDT quantization error is baked into the field at raster resolution,
so it magnifies as displayed px / 32 — at zoom 4 a 14 px label carries
~2 px of corner rot and a deformed 'g' descender.  The fix is a
**zoom-tiered re-raster** (the plan's lever B): a settle-debounced
meter — the svg image meter's twin, sharing its timer — watches the
largest label's displayed px (font x zoom x dpr, render-scale-free)
and past 40 px re-rasters every glyph in use at **64 px per glyph**
into a 2048 atlas, swapping runs with the font-loading re-raster's
exact sequencing (no mid-frame tear; bind groups re-key on the atlas
generation).  Metrics normalize to base-tier SDF px, so layout, the
shaping memo and the run math never see the raster resolution.
Promotion is one-way (a promoted atlas draws zoom 1 identically;
demand cycles must not churn shelves), covers graphs *built* already
zoomed (the 15.6 fresh-upload rule) and image exports at the export
scale, and reports as `stats().glyphAtlasTier`.  Costs, measured:
nothing until someone zooms; then one EDT re-raster (~39 ms for a
96-glyph population, 0.41 ms/glyph — 2.1x the base tier's 0.19) and
3 MiB of texture, once.  Lever A (raise the base to 64 px) was
measured and declined — it moves the 4x raster cost onto every
graph's first paint and 4 MiB onto every graph's memory for the same
zoom-4 quality — and MSDF stays declined (a faithful MSDF needs the
vector outline canvas2d does not expose; a raster-derived one is the
fragile hand-derived second implementation this repo keeps refusing).
The verifying parity scene is the close-up tier's first label scene:
letterform-dominated at 96 displayed px, the promoted render reads
0.112% against v3 where the pre-round render reads 1.202% against a
0.4% bound.

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
  (round 43) offers **twenty-one networks** — ten from real exports
  checked in (four fixtures shared with v3's WebGL harness under
  `v3/debug/webgl/`, the 465k-edge `ndex-x-large`, round 112's
  `npm-deps` and `reactome` local to `debug/`, round 105's two real
  GeneMANIA results — committed with the GeneMANIA authors' approval
  since 2026-10-05 and regenerated by `node debug/genemania.mjs` — and a
  clustered variant derived from em-web in-page) and eleven built
  in-page — each with a
  hand-authored v4 stylesheet, plus sections for
  the viewport, layouts, the core toggles, query-object selection, an
  event log and add/remove.

  Five of them are about *drawing* rather than scale, and they are the
  ones to open when a rendering change needs an eye on it: v3's own
  default debug graph (`?network=v3-default`, round 46.6) and its four
  documentation demos (`node-types`, `edge-types`, `edge-arrows`,
  `labels` — round 57.5), which between them put every shape keyword,
  every curve style, every arrowhead in both fills and the whole label
  surface on one screen.

  When it does not come up, the message on the page names the *phase* —
  `network`, `http`, `decode` or `init` (round 65.13, `debug/load-error.js`).
  That distinction is load-bearing: `init.js` used to build the instance
  inside the fixture's promise chain, so a library error on a
  binary-loaded network was reported as "a decode failure … rebuild the
  site", while the generated networks showed the real cause — a WebGPU
  problem read as "the binary networks are broken".  A fatal message is
  sticky, too; the stats overlay had been erasing it twice a second.

  `test/modules/debug-harness.mjs` is its only
  automated coverage: every fixture exists at the path the page fetches,
  every sheet compiles against that fixture's real data, the compound
  fixture lays out into disjoint parent boxes, the event log reads
  layout once per frame rather than once per event, `watch:sync`
  binds livereload on every interface (the 2026-08-05 review pass —
  three defects the harness's first real user found, recorded under
  round 43 in PLAN.md), and — round 57.5 — **every keyword each demo
  names reads back as itself**, which is the `case`-clause drift that
  left four arrowheads undrawn for nine rounds under a passing golden.

  Browser tests: the `renderer` Playwright project, plus the
  `visual` project — golden-image diffs (pixelmatch against PNGs
  in `playwright-tests/goldens/`, pinned to the SwiftShader adapter and
  **exact** since round 57.1e — zero differing pixels; regenerate
  intended changes with `UPDATE_GOLDENS=1`) and live v3-vs-v4 parity
  diffs (`playwright-page/parity.html` renders both renderers side by
  side — no v3 baselines are checked in).  The two answer different
  questions, and round 27 is the cautionary tale: a golden compares
  v4 against *its own* previous output, so it asks "did this change?",
  while only the parity diff asks "is this right?".  v4's arrow sizing deviated from v3 at every width and
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

Round 130 (2026-09-20) split the ten largest source files — `style`,
`collection`, `graph-store`, `shaders`, `core`, `renderer`,
`animation`, `curve-geometry`, `force`, `pointer` — on the pattern
`collection.mts` already used for `src/algorithms/`: the class hub keeps
its path as a facade, with every signature and doc comment on the class
body where the JSDoc gates read them, and delegates its bodies to a
sibling directory (or flat siblings, for the `force-*` and `pointer-*`
families) of functions that take the instance first; the two files that
were only functions re-export from theirs.  Nothing on the public
surface moved (the docs generator's output is identical modulo line
stamps; the shipped declaration only lost the demoted `private` lines),
`features.csv`'s 371 line-anchored rows were re-anchored, and the
line-keyed gates (`throw-coverage`'s tables and fixtures,
`wgsl-minify`'s file list, the inventory's style-registry read,
`PUBLIC_API`) follow the code.  Item 26 in the ledger below carries
the before/after sizes; PLAN.md item 71 lists the eleven files that
still sit between 1,000 and 1,600 lines, for the maintainer's call.

Round 133 (2026-09-28, ledger item 67 — an alpha round, because
Cytoscape Web depends on it) made a whole-sheet `cy.style( sheet )`
re-apply a **sheet diff**: only the channels whose declaration changed
are re-written, per group def, and the end state is the whole-sheet
pass's, column for column.  On ndex-x-large a one-constant change went
from 250 ms and 59.6 MB of dirty columns to 1.5 ms and 0.08 MB; see
"Sheet replacement is a diff" below.

Round 75 (2026-09-28, the DX polish bundle, on the eleventh sitting's
calls) made six small things true: the container observer emits
`resize`, the web-font re-raster is filtered and catches every loading
order but one documented residual, collections are iterable and
`cy.add()` takes iterables, `cy.nodeAt()` (alias `cy.pickNode`) is the
public sync node pick — computed headless — `wheelBehavior` chooses what
a wheel does and an inert wheel scrolls the page again, and
`cy.viewportCounts()` reads the cull's visible counts back.  See "The DX
polish bundle (round 75)" below.

Round 138 (2026-09-29, PLAN.md items 34–36, on the eleventh sitting's
calls) requested every device's own limits and made growth past them
throw from `cy.add()` — a `GpuUnfitError`, the store unchanged — which
moved the element ceiling from 4,194,304 to 16,776,960 per group on the
RX 580; gave the renderer an allocation ledger (`cy.stats().gpu`) and a
`gpuerror` event; degrades labels, then charts and images, then
gradients instead of blanking the canvas; and soaks the GPU side over
the ledger, which found the label shaping memo unbounded.  See "Device
limits, the degradation order and the renderer soak" below.

Round 140 (2026-09-29, PLAN.md item 45, on the eleventh sitting's call)
typed element data: `cytoscape<NodeData, EdgeData>( … )` flows the
application's data shapes through `data()`, the collections, events,
the add/patch/load/clone payloads, queries and the stylesheet's mapper
fields, and with no generic every type is exactly the untyped one.  The
prototype measured first that the declaration roll-up keeps generics and
their hover docs in all three shipped declarations.  See "Typed element
data" below.

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
plus `reset`, `viewport`, `zoomRange`, `renderedExtent`, `size`;
`getFitViewport`/`getCenterPan` are `@internal` since round 90), events
(Node's `EventEmitter` spellings plus `pon` since round 90 —
`bind`/`unbind`/`listen`/`unlisten` are gone, and `on( 'render', … )`
replaced `onRender`/`offRender`; delegation via predicate functions), graph
manipulation, `style()` (the `{ nodes, edges, parents, core }`
sheet), `layout()`/
`makeLayout` (grid, preset, circle, concentric, breadthfirst, random,
the round-85 hierarchy-aware `radial` tree,
round 18's GPU-capable `force` and round 112's layered `flow` — every
one of them, since round 114, spacing by one reading of node
dimensions (labels on request), avoiding overlap in its own geometry
— exactly per pair since round 115 — holding locked nodes where they are, and tweening to
its result under `animate: true`; plus the round-17
**extension contract**: `cy.layout({ impl })` runs a user layout
class/object with no registry — plus `eles.layout()` for subset
scopes and the v3 `layoutPositions`
plumbing with spacingFactor/transform/animate — an animated layout
fits by animating the viewport to the box at the *final* positions,
concurrently with the node tweens), `pick()`, `png()`/`jpg()` (async image
export — see the design decisions below),
`stats()`/`resize()` (round 90: `renderer()` is `@internal`,
`forceRender` is gone — the loop is render-on-dirty — and `cy.stats()`
is the public frame-stats snapshot), graph-level
`data()`/`scratch()`, batching (`startBatch`/`endBatch`/`batch`;
`batchData` was removed and `batching` demoted in round 90), `json()`
(export-only),
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
`boxSelectionEnabled`), introspection (`isReady`, `headless`,
`hasElementWithId`/`$id`, `options`; round 90 removed
`mutableElements` — it was `elements()` — and demoted
`instanceString`),
`destroy()`, `width()`/`height()`, and `compact()` (round 19 — the
explicit form of the automatic slot-compaction trigger; see below;
`gc` is its alias since round 39.3).
Collections: `cy()`, events, graph
manipulation (incl. edge `move()`), position/dimensions (model +
rendered, `shift`; the silent variants — and `renderer()`/`element()` —
are `@internal` since round 90, edge `midpoint`/endpoints —
curve-aware since round 12a, along with `controlPoints`/
`renderedControlPoints`/`isBundledBezier`, and — 12b —
`segmentPoints`/`renderedSegmentPoints` for segments/taxi edges, with
`controlPoints` covering unbundled-bezier control lists; since 12c
haystack edges answer endpoints/midpoint/bb with their offset
points, and manual-endpoint edges resolve everything through the
route evaluator),
iteration (`sort`, `reduce`, `max`/`min`), comparison, building/
filtering (`diff`, `absoluteComplement`, set aliases; `byGroup` is
`@internal` since round 90),
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
— the full v3 algorithm surface — plus the v4-only families designed
matmul-first for the GPU tier.  Round 69: `triangleCount` (per-node
triangles, local clustering coefficients, transitivity — A²∘A),
`neighborhoodSimilarity` (pairwise Jaccard/cosine/overlap over
neighbor sets — A·Aᵀ) and `katzCentrality` (attenuated walk counting).
Round 70, aimed at network-biology workloads: `randomWalkWithRestart`
(seed propagation) and `randomWalkWithRestartProximity` (the all-pairs
matrix via Neumann matmul iteration), `heatDiffusion`/`heatKernel`
(exp(−tL) by scaling-and-squaring; `laplacian: 'normalized'` since
round 72.4 swaps D − A for I − D^{-½}AD^{-½}, bounded spectrum, no
conservation), `effectiveResistance` (the
Laplacian pseudo-inverse via f64 elimination on the CPU and
Newton–Schulz matmuls on the GPU — O(n³) both sides, so the GPU wins
at every density), `simRank` (two matmuls per iteration) and
`motifCensus` (the 16-class triad census from seven trace primitives,
pinned by a brute-force classifier spec; '030T' = the feed-forward
loop).  All of them read the collection as a simple graph (parallel
edges collapse, loops excluded); the seed forms of RWR and heat
diffusion are CPU-only by design — O(E) sparse walks with nothing for
a kernel to win — and an explicit `executor: 'gpu'` on them rejects,
pointing at the dense form.

Graph walks are slot-native over the
CSR adjacency; the attribute-space clustering algorithms work on
handles as v3 does.  v3 option/result shapes are kept, except that
node arguments are collections (selector strings throw) and
`weight`/`heuristic`/`attributes` are plain functions — and, since
round 65, **the expensive whole-graph tier is async with a GPU
executor**: `pageRank`, `floydWarshall`, `betweennessCentrality`,
`closenessCentralityNormalized` (round 69 — its GPU path rides the
blocked FW kernels and folds each distance row on the device, so the
readback is n floats rather than the n² matrix), `markovClustering`,
`affinityPropagation`, `kMeans`, `kMedoids`, `fuzzyCMeans`,
`hierarchicalClustering` and the rounds-69/70 families return
promises, and an `executor` option ('cpu' | 'gpu' | 'workers' | 'auto',
default 'auto') picks where the maths runs.  'cpu' is the bit-reproducible f64 reference (the
spec, and what headless Node ran alone before round 74); 'gpu' runs the WGSL kernels
and rejects rather than degrading when WebGPU or the algorithm's GPU
path is missing (weighted betweenness, custom distance functions, and
attribute-less feature runs are contracted CPU-only — kernels never
call back into user code); **'workers' (round 74) runs the
per-source-parallel families — both betweenness forms, unweighted
`closenessCentralityNormalized`, `heatKernel`,
`randomWalkWithRestartProximity` — on a pool of plain workers** (Node
`worker_threads` or browser `Worker`s, at most eight, one less than
the cores; the worker entry ships as source text inside every bundle,
so the bundles stay single-file and no bundler configuration is asked
of an embedder), **and since round 129.1 runs the families the pool
cannot partition on ONE worker** — the *offload lane*: `pageRank`,
`katzCentrality`, `floydWarshall` and weighted
`closenessCentralityNormalized`, `triangleCount`,
`neighborhoodSimilarity`, `motifCensus`, `simRank`,
`effectiveResistance`, `markovClustering`, `affinityPropagation` —
and since round 134 `kMeans`, `kMedoids`, `fuzzyCMeans` and
`hierarchicalClustering` for a *named* metric (and, for hierarchical,
a 'min' / 'max' / 'mean' linkage).
Each of those references is one self-contained kernel over a snapshot
(`src/algorithms/algo-kernels.mts`; the builders evaluate every user
closure — `weight`, MCL's `attributes`, AP's `attributes` and
`distance` — on the calling thread first), the in-thread `'cpu'` path
calls the same function, and the pool carries that function's own
source text, so a worker answers the reference's bits by
construction.  The value is the calling thread, not speed: a run on
the lane costs a clone and a wake and frees the UI thread for its
whole length.  The feature-space clusterers (round 134, ledger item
70) needed a reshaping first: their references called the metric per
iteration through per-node caches, and the metric may be a caller's
function, so the maths was not a loop over a snapshot.  For the named
metrics the snapshot now carries the attribute vectors (evaluated
once per node on the calling thread) and the metric as a code, and
the in-thread reference runs the kernel too
(`src/algorithms/algo-kernels-cluster.mts`: `kClusteringKernel` for
the three k-clusterings, `hierarchicalKernel` for the 65.10 merge
engine, which the GPU executor's merge phase also runs); a custom
distance function — and a per-pair hierarchical linkage — keeps the
closure path, on the calling thread, because it is called inside the
loop.  The reference's own change of path is bit-neutral, recorded
two ways: every result digest at n = 1024 / 5120, four metrics, is
identical before and after (the `algorithms-gpu` feature fixture), and
`test/algorithms-offload-clustering.mjs` asserts the kernel under a
metric's name `===` the closure path under a function that *is* that
metric.  It is also faster, because the closure path spawned every
cluster's collection every iteration and rebuilt each cluster in a
pass over all nodes: k-medoids at n = 5120 2,980 → 311 ms, fuzzy
c-means 207 → 60, k-means 45 → 15 (hierarchical was already the flat
engine, unchanged).  `'workers'` rejects only on the families with no
lane of either kind (the one-column seed forms `heatDiffusion` and
`randomWalkWithRestart`), on a clusterer given a custom metric or a
per-pair linkage (with that reason), or where no worker can be
constructed; 'auto' takes the GPU above a per-family
measured crossover, then the pool from the family's stamped crossover
(74.5: weighted betweenness and RWR proximity 128, unweighted
betweenness and the heat kernel 256, closeness 512) where a family
has that lane and no GPU lane fits (headless Node, a blocklisted
adapter, an input past the device's buffer limits), then the offload
lane from the family's `offloadMinN` (129.4, stamped from the
`algorithms-workers` offload rows by one rule — the smallest size
whose in-thread run reaches a quarter frame: affinity propagation 32,
MCL 64, Floyd–Warshall / SimRank / effective resistance 128, the
similarity count 1024, the census 4096, triangles 8192, Katz 16384,
pageRank 32768; round 134 by the same rule: fuzzy c-means and
hierarchical 512, k-medoids 768, k-means 4096 — the lane's clone-and-wake costs 0.2–0.6 ms, and what
it frees is the kernel's share of the run: on a sparse graph pageRank's
and Katz's structure is built in-thread and is most of the call), then
the CPU —
except the sparse closeness BFS, where the pool measured ahead of the
GPU at every size (4.0 vs 14.6 ms at n = 1024, 50.1 vs 87.5 at 4096)
and is tried first.  The pool spawns lazily (129.1): one worker at
acquisition, the size on the first whole-pool run, so an offload
never pays for workers it will not use.
Determinism is a ladder, cpu > workers > gpu: the pool partitions the
sources into a fixed number of ranges (a function of n, never of the
pool size) and merges in range order, so a workers result is
bit-stable across runs, machines and pool sizes, bit-identical to
'cpu' for the per-column families (closeness, heat, RWR — each
element computed whole by one worker in the reference's operation
order) and f64-tight but not bit-equal for betweenness (whose sums
across sources round differently when grouped by range).  Measured
on the 8-core benchmark machine (74.1): weighted betweenness at
n = 2048 12.2× the sequential reference warm, 7.2× cold including the
spawn; the per-worker snapshot clone of a 103 KB CSR 0.21 ms against
0.10 ms shared memory, which is why SharedArrayBuffer — and the
COOP/COEP demand it would put on every embedder — was declined.  The
GPU's own 'auto' crossovers are per family — for the rounds-69/70 iterated-product families a
*density* gate as well, since their sparse CPU walks own sparse
graphs however large (round 72.6 re-measured the triangle, similarity
and census gates across three sizes and six densities and found the
crossover a constant *mean degree*, E ≥ 32·n, rather than a share of
n²; `GPU_MIN_EDGES_PER_NODE` spells it once), for unweighted
`closenessCentralityNormalized` a BFS on both executors with the GPU
from n = 1024 sparse or earlier dense (72.3), and for `katzCentrality`
and `pageRank` never (their sparse CPU iteration is under one GPU
readback) — and otherwise the CPU, falling back only on
acquisition failure or an input past the device's buffer limits — a
kernel error propagates.  GPU results may differ from CPU results in
f32 detail (the force layout's round-18.4 determinism precedent);
discrete results (cluster memberships, path sequences) are pinned
identical by the parity suite (`playwright-tests/algorithms-gpu.spec.js`).
The traversal tier — everything called per root in loops — stays
synchronous by design.  The kernels live beside the wrappers as
`src/algorithms/algo-gpu*.mts`: a standalone compute device (no
canvas, no renderer coupling), shared dense-matrix kernels, and one
driver module per family, each run encoding all its iterations up
front behind converge-flag-guarded kernels so a run costs exactly one
readback (the round-9 discipline, compute form).

**Every one of these returns its promise with `cancel()` on it (round
128).**  A pending run rejects with `cytoscape.CancelledError` the
moment `cancel()` is called and answers `true`, once; a run that has
settled answers `false` — and a `'cpu'` run always does, since the
reference completes inside the call.  The router polls the run's
token after each await (the GPU or pool acquisition, a
`GpuUnfitError` fallback, the CPU fallthrough), so a cancel during
acquisition starts no lane; a lane already running completes on its
own — the device work was submitted, the pool's in-flight ranges
answer — and its value is discarded rather than decoded, while the
pool stops posting the ranges not yet sent and stands for the next
run.  `cy.destroy()` cancels every pending handle.  See "Cancellation"
below.

Batching (v3 semantics): a `startBatch()`/`endBatch()` pair (or
`cy.batch(fn)`) defers *style application* — the first apply of
elements added inside the batch, sheet re-application (`cy.style(sheet)`
compiles and validates immediately, applies at the flush — as one diff
against the sheet the columns were derived under, round 133), and
data-mapped label refresh — into one bulk pass at the outermost
`endBatch`, filtered to still-live elements.  Events keep firing during
the batch, and style-derived reads (`width()`, `label()`, `style()`)
may be stale inside it.  Renderer scheduling needs no batch deferral:
the dirty tracker already coalesces per microtask, which fires after
the batch's synchronous block anyway.

v3's `notify`/`noNotifications`
have no v4 counterpart for the same reason.

**Transaction events** (round 139, PLAN.md item 41's alpha part; v3
has none).  The outermost `startBatch()`/`endBatch()` pair is a
transaction, and the core fires **`batchstart`** and **`batchend`**
around it — the hooks an app's undo stack records against.  The
contract, each clause pinned in `test/batch.mjs` with its control:

- **Nesting: the outermost pair only.**  Only the outermost close
  flushes, so only it is an observable boundary; an inner pair is part
  of the enclosing transaction, as it is part of the enclosing flush.
  A depth counter on the event would hand every recorder the job of
  ignoring the inner ones.
- **`batchstart` fires after the depth is taken and before any
  mutation** — `batching()` is true, nothing of the batch has landed,
  so a listener reads the state the transaction starts from (the
  snapshot point), and whatever it mutates belongs to the transaction.
- **The element events fire between the pair, unchanged** (they
  already fired during a batch).  They are the transaction's content.
- **`batchend` is the transaction's last event**: after the flush and
  the compaction check (style reads are fresh, `batching()` is false),
  and after a `patch` summary the batch produced.  A `cy.patch()` is
  one transaction — `batchstart`, its element events, `patch`,
  `batchend` — and inside an app's batch it joins that one.
- **`batchend` carries no diff.**  A diff on it would oblige every
  mutating path — data, bypasses, classes, hierarchy moves, add,
  remove — to report into the batch: the completeness obligation of
  the inverse-operation log, which is the fork the snapshot measurement
  below decides.  `patch` keeps its own `event.diff`.
- **No rollback**: a `batch( fn )` whose `fn` throws still closes, and
  still fires `batchend`, with what landed before the throw.  An
  unbalanced `endBatch()` fires nothing.
- **Not transactions**: a `cy.load()` spans macrotasks and has its own
  lifecycle (`loadstart` … `loadstop`); layouts, animations and
  gestures write outside any batch unless the app wraps them.  A
  follower's sync (round 106) is a batch on the follower, so a follower
  sees one transaction per sync.
- **The sheet is inside the transaction but outside any snapshot**:
  `cy.style( sheet )` in a batch applies at the flush, before
  `batchend`; the wire format carries no style, so an app undoing sheet
  changes keeps its own sheet history.

The snapshot undo those events allow is four lines —
`cy.on( 'batchstart', () => stack.push( cy.serialize() ) )`, and
`cy.patch( stack.pop() )` to undo — and what it costs at 100k elements
is measured under "Undo: the snapshot price" below.

Style getters read the **stored channels** — the resolved values the
renderer draws from — not the sheet's declarations: `style(name)`
returns numbers for numeric props, `rgb()`/`rgba()` strings for colors
and keywords otherwise; `style()` returns the whole group's props;
`renderedStyle` scales length props (width, height, border-width,
font-size) by the zoom; `numericStyle` returns the number (throws for
non-numeric props).

Consequences of reading stored truth: an
equal-radii ellipse reads back as `'ellipse'` whatever keyword compiled
it, arrow getters derive from the stored arrow color (alpha folds in
edge opacity, so a fully transparent arrow reads shape `'none'`), and
label channels (`font-size`, `color`) come from the label sidecar when
the node is labelled, else resolve through the sheet (mapped channels
evaluate for that slot).  When the GPU eval kernel owns
a paint channel (see the mapper DSL below), its stored bytes go stale
after data writes and the getter evaluates the shared mapper IR lazily
instead — same math as the kernel, agreeing with rendered pixels within
±1 per RGBA byte.

The setter forms are **per-element bypasses** (round 63 — reversing
the 29.3 drop; the design record is PLAN.md's round-63 plan, ledger
item 25).  `ele.style( name, value )`, the object form and
`removeStyle( name? )` are sugar over the stylesheet's **`bypasses`
section** — `{ bypasses: { [id]: { prop: constant } } }` — which is
the canonical, exported form.  The contract: a bypass **beats
everything** (the user's blocks and the default sheet's state
conditionals included — a bypassed channel hides selection blue for
that element, exactly as in v3); values are **constants only**
(mappers stay the sheet's job); entries are **id-keyed declarations**
rather than element state (they survive remove/re-add, may name an id
that does not exist yet — inert until it does — and round-trip
through `cy.json()`, which is better than v3, whose export drops
bypasses); and a full `cy.style( sheet )` **replaces** the section
like any other, with spreading the exported sheet as the keep-them
idiom (a v3 difference, recorded: v3's bypasses live on elements and
survive sheet swaps; round 133's sheet diff keeps this rule — every
slot bypassed under the old sheet or the new takes the full write).
Implementation: an overlay merged at the write
funnel — bypass-free graphs pay one count load (measured unchanged),
apply and select punch-outs are O(bypassed), a channel carrying a
bypass demotes its GPU mapper eval while one exists (count-gated,
reversible), and the set path measures 2× *faster* than v3's through
the built bundles.

**The demotion reaches the screen since round 143.**  The golden
degrade control (item 30's tier 2) bypassed the `mapped-colors` scene's
viridis fill after its first frame and moved no pixel: the first bypass
re-derived every slot's bytes on the CPU while the kernel still owned
the column, the mirror skipped those spans as kernel-owned, and when the
runtime's repack cleared the ownership on the next frame nothing
re-uploaded the column — the node drew its mapped colour for good, and
until the repack `style()` read the mapped value too.  A column leaving
kernel ownership is now re-uploaded whole from the CPU truth
(`ColumnMirror.setGpuOwned`), and a bypassed channel reads its stored
bytes, never the mapper's lazy evaluation.  The same pass found two
readback slips: a rotation-only label change (a bypass, a data write, a
sheet swap) was dropped by the label record's no-op check, which
compared every field but the angle; and a custom polygon's
`corner-radius` read its point-record ref (`196608.0234375`) as a
radius — it now reads the sheet's.

**A channel-opacity bypass demotes the colour it folds into** (round
105, found by the same control on the GeneMANIA-width golden).  The
kernel folds a *constant* channel opacity into a mapped colour's alpha
(66.3's `alphaMul`), so an ordinal `line-color` under a sheet
`line-opacity: 0.6` stayed kernel-owned when one edge took a
`line-opacity: 1` bypass — the GeneMANIA highlight — and that edge
neither drew nor read back its new opacity.  A bypass on a folded
opacity (`OPACITY_FOLDS`: background, border and line opacity, by the
colours they fold into) now demotes those colours exactly as a mapped
opacity does, and the readback treats the colour as bypassed.  The same
golden found a readback slip in the edge layers: their strokes are
stored on a 1/256 px grid, and a mapped width off the grid (1.85) read
`overlay-padding` back as 10.00039 and an unset `line-outline-width` as
0.00078; the readers now subtract the width on the same grid.

One consequence worth naming (round 96): for the **list-valued curve
props** — `control-point-distances`/`-weights`,
`segment-distances`/`-weights`/`-radii`, which take constants only and
reject mappers — the bypass is the **only** per-edge spelling, so it is
the porting path for a v3 sheet that gave edges their own arrays
(`MIGRATING.md` says so; the debug harness's v3-default and edge-types
sheets do so, spec-pinned to v3's routed values, and a routing-parity
scene measures the bypass path against v3's id selectors).

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
the edge line at width + outline width, alpha folded by v3's
effective line opacity; an enabled casing demotes the
element-opacity mapper to the CPU path (the fold must track writes).
**Since round 124.4 the casing draws per edge, in v3's order** —
casing then line for each edge in z order, as one paired draw (two
instances per visible edge off a third indirect args block) — so a
later edge's casing gaps an earlier edge's line where they cross;
before 124 it was a global pass under all lines, a halo against nodes
only.  The global-halo look is the edge *underlay*, which is still a
global pass.  Edge layers stroke the edge geometry at width + 2 × padding (every
family — haystack offsets and the triangle taper included), the
underlay under the edges and the overlay over edges + arrows, both
under the nodes; strokes are solid with **round caps, as v3's**
(round 88.1 — they were butt caps, a recorded deviation, until the
maintainer saw the difference on screen): the straight quad and the
curved and route strips reach half the stroke width past each end,
and the fragment stage shades the capsule about the span.  Self
edges are rounded too — v3 butt-caps a self edge only on its no-paths
fallback, which its path cache makes the rare case, and v4 does not
copy that exception; a straight-triangle layer keeps its taper and
flat base.  **Joins are round and blend once, as v3's** (round 88.2):
v3 strokes a layer as one path stroked once, and Canvas composites a
stroke atomically, so a translucent layer never darkens where its own
path folds — v4's curved and route layer strips were a quad per step,
mitred, and blended every fold twice (visibly at taxi and segments
corners).  The layer strip is now built of *capsule steps*: each quad
bounds its step widened by the half-width and reaching past each end
only as far as that joint's round join needs (half-width ×
sin(turn / 2) — the whole of it at a path end, none along a straight
run), and the fragment stage shades the distance to the polyline about
the step (three distinct points either side), which is v3's stroke —
round caps, round joins at any angle.  The quads overlap at every
joint, so the pass writes depth per instance (see Early-z below): a
fragment of the same edge fails where an earlier quad of it drew, a
later edge still blends over an earlier one.  Measured on round 88's
close-up scenes (SwiftShader): a black translucent overlay on
zigzag segments and taxi reads 2.566% against v3 before the round,
0.392% with equal-depth on the old mitred strip, 3.459% with the
capsule steps and no depth write, and **0.010%** with both.  Two
residuals, recorded: where a path comes back near itself from outside
a step's neighbourhood (a self-loop's two ends, a route crossing
itself) the fringe of the earlier leg can blend under the later leg's
body once more (a fringe fragment sits half a depth step deeper so it
never blocks the body, which would leave a light seam instead); and
more than 200,000 visible curved edges wrap each layer's depth band,
so two layer strokes that far apart in the list lose their blend
where they cross.  The line and the casing keep their mitred strips —
a translucent *line* on a sharp route still folds (PLAN.md item 81).
`overlay-shape`/`-corner-radius` stay node-only.  Two more things about that stroke, both found by
round 58's parity scenes: since round 58 the underlay stops where the
drawn line does (the draw trim; it used to run node centre to node
centre on the straight stream) — and **since round 88.3 the overlay
does not**: v3 strokes the overlay after the heads along its
gap-shortened path, nothing erases it, and its round cap is what
paints over a head.  Measured through `parity.html` before building
anything: v3's overlay reaches its `rs.allpts` end plus the padding at
every hollow head tried, and no further, so v4's overlay spans the gap
(`gapSpanW` / `arrowGapTrimOf`) with its round cap and needs no
arrow-shaped pass (the hollow-head close-up scene meets its no-layer
floor, 0.124%, from 5.060% before the round).  The underlay keeps the
draw trim because v3's head erase *does* reach it, and at a head that
shows the line (hollow or translucent) keeps a **flat end** there
(`LAYER_BUTT_WGSL`) — a round cap would poke into the hollow head
where v3 has erased it (1.794% on that scene with the cap, 0.329%
without, over the same floor).  The width formula is the other: it **diverges from v3's**
— v3 strokes the edge underlay/overlay at `2 × padding` alone, so a
padding under half the line width draws a halo narrower than the
line; v4's `width + 2 × padding` always shows the halo, and **is
kept as a deliberate deviation** (PLAN.md item 27, decided at the
eleventh design sitting, 2026-09-28); the casing (`line-outline`) is
unaffected, both libraries agreeing on `width + outlineWidth`.

Core theming (round 13 A2): the sheet takes an optional `core` group
with v3's core-selector props, constants only —
`selection-box-color`/`-opacity`/`-border-color`/`-border-width`
theme the DOM selection box, and `active-bg-color`/`-opacity`/`-size`
drive the background-grab indicator circle at the press point (a DOM
element above the canvas, like the selection box — v3 draws it into
the canvas, so v4 exports never include it; recorded).
**The indicator is anchored in model space** (round 43.7, v3's rule):
it was positioned once at pointerdown in screen space and never moved
again, so a background pan slid the graph out from under it.

The
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
four props take CPU mappers, and readback is folded.

**A constant channel opacity does not demote its colour channel**
(round 66.3).  The multiplier rides the packed program and the kernel
folds it in the shader (`domain.w`) exactly as the CPU write path does
— the mechanism the arrow programs have used since round 13, now
resolved per colour prop.  Only a *mapped* channel opacity still
demotes, its value varying per element.  This is a performance rule
before it is a correctness one: an unowned colour channel re-derives
per element on the CPU on every data write, so before this a sheet
that said `line-opacity: 0.25` paid **3.5×** on every restyle of a
mapped colour (measured, 50k data writes on the 465k-edge fixture:
91 → 26 ms to the next frame) for a property a web developer
reasonably expects to be the cheap one.  Verified by rendering the
same scene both ways — a *mapped* opacity with a constant range takes
the CPU path and resolves to the same value — and diffing: **zero
differing pixels**, with `style()` agreeing on both paths.

Note the pre-existing band rule:
the node FS picks border *or* fill per fragment, so a translucent
border shows the border color alone where v3 blends it over the
fill in the inner band half.

Node outlines (round 13 B5): `outline-color`/`-opacity`/`-width`/
`-offset` draw a solid ring outside the border at offset/2 past its
outer edge — exactly v3's scaled-path stroke for circles and squares
(anisotropic shapes deviate from v3's per-axis scaling, recorded);
ghosts carry their outline; outlines are not pickable and grow the
bb by offset/2 + width.  `outline-style` and `border-style` landed in
round 38: the node fragment shader gained the *perimeter* coordinate
they both needed — see the round-38 border-style section below.

The edge shader dashes for free
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

Priced in round 76.1 (2026-09-29), after no row had ever exercised
the gradient fragment path: a render-bench pair over one geometry
and one set of stop lists, differing only in the fill kind
(`gen-25k-fills-solid` / `-gradient`, 25k nodes × 50k edges, every
node and edge filled).  Device p50, two runs, i9-9900K + RX 580
(Chromium on Vulkan, render scale pinned 1): fit-all 3.70 → 3.74 ms,
zoomed-in 4.78 → 4.83, far-zoom 0.686 → 0.707, with labels 3.97 →
3.99 and 5.19 → 5.22 — **+0.7% to +3%**, about 0.04 ms a frame; the
wall rows sit on the vsync floor on both sides.  The border pair's
precedent (a fragment premium unmeasurable at scene level) nearly
held: the stop walk is measurable, and negligible.  v3 on the same
pair: 632 → 1171 ms a fit-all frame.  No close-up scene: a gradient
error is a ramp, not a boundary effect, so magnification buys a diff
nothing — the `gradients` golden and the live parity scene stand.

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
  `renderer().stats()`), while the store measures dims through the
  same breaker where a 2D canvas exists (`label-measure.mts`, round
  125.1: `measureText` advances at the atlas's 32 px scaled to the em,
  so the number is the laid block's) and estimates them with flat
  advances where none does, so bounds work headless.  Exact laid dims
  feed back into the store per glyph build either way.
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
- Recorded deviations: label dims under headless Node are
  flat-advance *estimates* (a canvas-bearing host measures them at
  style time since 125.1 — before, an app's load-time layout under
  `nodeDimensionsIncludeLabels` separated estimates the first frame
  then outgrew: on em-web 154 of 569 labels lay wider, one by 36 px,
  and a force run at load left 14 label pairs overlapping); the
  edge-label bb term is conservative (fit may slightly over-fit,
  never under); alignment shifts and text boxes use block metrics
  (advance width × line-stacked height), not ink extents.
- Costs (Node sweep, `benchmark/labels.mjs`): wrapped-label
  builds ~5 µs/label at 100k (write-driven — per frame only under a
  round-25 font-size tween on a *wrapped* label, the recorded
  expensive configuration; wrap-none tweens ride the dims fast path);
  the whole-graph bb scan pays ~0.1 µs/label for its label terms.

## The layout portfolio (round 122, item 49)

One flagship per use case, audited on 2026-09-09 against what the two
flagship apps ship (the round record has the demand, read from their
repositories at pinned commits): Cytoscape Web carries three engines
— G6's dagre / gForce / radial, v3's grid / circle / cose / concentric
plus a third-party left-to-right layered layout, and Cosmos for GPU
force — and routes to gForce under 1,000 elements, dagre for a
hierarchy, and v3's `grid` at 1,000 and above; EnrichmentMap runs
fcose with data-driven edge lengths, a vendored layout-utilities
packer, and a NES-sorted `grid` for the singletons.

| Use case | v4 flagship | Also | The apps ship |
| --- | --- | --- | --- |
| Force / organic | `force` | — | fcose; gForce, cose, Cosmos |
| Layered / DAG | `flow` (four `direction`s) | `breadthfirst` (directed) | dagre; biological-flow |
| Tree | `radial` | `breadthfirst`, `flow` | G6 radial |
| Circular | `circle` (`sort` mapping), `concentric` (`concentric` mapping) | — | circle, concentric |
| Grid / tabular | `grid` | — | grid |
| Component packing | force's settle re-pack; flow's own; `ctx.packComponents` | — | EM's vendored packer |
| Positions from data | `preset` | — | both (CX2) |
| Scatter | `random` | — | — |

Every use case the apps ship has a v4 flagship, and none is a
second-best of another: `breadthfirst` is v3's depth rows, a different
picture from `flow`'s and the cheapest tree there is; `circle` and
`concentric` are one use case spelled by order and by level.  What
the audit found missing, by demand: **component packing on the
discrete layouts and a standalone re-pack** (EM's case; the packing
machinery of rounds 120–121 was reachable only through `force` and
`flow`) — item 58, taken by round 123 below.  Declined until an
app asks: a tidy tree (tidytree's case), a crossing-minimised or
clustered circle (avsdf, cise), and any second force layout — eleven
of the nineteen v3 layout extensions are force-directed, and `force`
absorbed fcose's constraints, its spectral seed, cola's `infinite` and
cose's compound gravity rather than shipping beside them.  Scale is
not a use case: Cytoscape Web's `grid` fallback at 1,000 elements and
its Cosmos engine are v3-cose limitations, and `force` runs em-web
(7.5k elements) in 0.3 s and 25k × 50k in 3.0 s on the GPU from a
seed.

**The geometric layouts, and `condense` (round 125.3 / 5 / 6 / 7).**
The audit of `radial`, `circle`, `concentric` and `grid` found the
four sizing themselves three different ways: `grid` fills the box
unless `condense: true` (then each cell is the largest node plus
`avoidOverlapPadding`); `concentric` always sizes its rings by their
nodes (each ring at the smallest radius that clears its own nodes and
the ring inside it, the gap `minNodeSpacing`) and reads the box only
with `avoidOverlap` off; `circle` and `radial` filled the box's
shorter side and let `avoidOverlap` grow the ring(s) from there.  The
maintainer's ask was an explicit node separation on the geometric
layouts — say the margin, not a factor — and the one spelling that
already existed for it is grid's, so **`condense: true` now exists on
`circle` and `radial`** with `avoidOverlapPadding` as the margin: the
ring is the tangential radius at that gap, every radial ring the
smallest that clears at that gap (`levelSpacing`, given, stays the
floor).  Off by default: the pictures the apps ship are unchanged
until a sitting says otherwise.  Measured on the app graphs it
changes nothing — reactome under radial and em-web's packed
components are already past the box's share, since the clearance
rule sets those rings — and everything on a six-node star (a 270 px
ring becomes a 60 px one).  Two findings for the sittings, not
changed: radial infers its roots by maximum degree, breadthfirst's
undirected rule, so on reactome — a directed hierarchy with one true
root — the centre goes to *Innate Immune System* (degree 17) and the
root sits on ring 1; and every ring layout's outer ring is set by its
most crowded ring's circumference, so a shallow wide tree draws as a
rim around an empty middle.

**Preset and random, audited for their contract (round 125.8).**  The
two built-ins without an algorithm were audited for what they promise
rather than for a picture.  `preset`: an id-keyed map or a function;
a node without an entry keeps its position (a node never positioned
sits at the model's `(0, 0)`); parents derive from their children and
locked nodes hold; `fit` wins over `zoom` / `pan` when both are given
(v3's rule — set `fit: false` to use them); `spacingFactor` is ignored
on both paths, since explicit positions are not scaled.  **A supplied
position must carry a finite x and y**: a map entry of `{ x: 100 }`
used to write `y: NaN` into the store and a `null` axis became `0`
through the column, both silently — the half-positions a data import
produces — and both now throw a `TypeError` naming the node, on the
direct path and the finisher path alike.  `random`: uniform over the
viewport box or the given `boundingBox`; **a `seed` makes the scatter
deterministic** (mulberry32; omitted, `Math.random` as v3), which is
the stability the audit asks of every layout.  Neither takes
`avoidOverlap` — a pushed-apart scatter is neither random nor uniform,
and preset's positions are the user's.

## Component packing on the discrete layouts, and the `pack` layout (round 123, item 58)

**`packComponents: true`** on `circle`, `concentric`, `grid`,
`breadthfirst` and `radial` lays each disconnected component out on
its own — one ring, one set of rings, one grid, one tree per
component — and shelf-packs the drawings largest first under
`componentSpacing`, `componentGroup`, `componentOrder` and
`groupSpacing`, the spellings and the component description
(`{ nodes, size, width, height }`) a force run's settle re-pack takes
(121.1).  Off, the default, every layout is v3's one figure about one
centre.  The mechanism (`layout/per-component.mts`): the layout's own
placement, called once per component in a box sized to the
component's share of the scope's area; the body boxes packed
(`packComponentBodies`); the field centred on the viewport, or scaled
down — never up — into an explicit `boundingBox` (flow's rule); and
moved off any locked node it would cover, locked nodes being left out
of the placement as they hold under every layout since 114.3.  Per
layout: circle's `sort` orders each ring and a singleton is a point;
concentric resolves its scores once over the scope and bins the
levels per component (`levelWidth` sees that component's nodes);
radial without the switch keeps 85.1's one radial of wedges, with it
each component is its own tree, root at its own centre; a grid's
singletons become one-cell grids that pack into rows —
EnrichmentMap's picture — and `sort` / `position` apply within each
grid; a packed breadthfirst tree is spaced by its overlap need alone
(bodies apart, `spacingFactor` the air), so it is as small as it can
be drawn.  Grouping and order functions throw at start when they are
not functions, as on force.

**The shelf fills a row's slack by stacking** (round 125.9).  The
shelf packer places boxes largest first into rows that wrap at about
the square root of the total area, and a row is as tall as its
tallest box — so every shorter box in it left a column of empty space
beneath, and the waste compounded when component sizes were far
apart: on em-web under `radial` with `packComponents`, the 78-node
component's column beside the 187-node disc was two thirds empty
(the packed field held 66 % component boxes by area), which is the
limitation EnrichmentMap's own packer has.  Now a box that fits the
room left under an earlier box of the same row goes there, under the
leftmost such column, rather than opening a new one; a column is as
wide as the box that opened it, and boxes of like size never stack
(the room under one is never a box plus a spacing), so the rows of
singletons and small shapes read as they did.  Measured on em-web:
`radial` + `packComponents` 66 % → 83 %, `pack` 58 % → 67 %, `grid`
+ `packComponents` 48 % → 51 %; npm-deps under `radial` 71 % → 85 %;
em-desktop's force settle 62 % → 75 %; force on em-web and flow on
npm-deps unchanged (the rows there had no column with the room).  A
skyline packer measured higher on two rows (em-web `radial` 87 %,
force 67 %) and lower on two (em-desktop 75 %, npm-deps 76 %), and
dissolves the rows that the singleton block, the group rows and the
comparator's reading order are built on, so the shelf stayed.
Stacking is **off under a `componentOrder`**: a caller's order is
read along rows, left to right (EnrichmentMap's singleton rows by
score, 121.4), and a stacked box would read down a column instead;
the reading order with stacking is rows top to bottom, columns left
to right within a row, top to bottom within a column.  The re-pack
costs the same (em-web `pack` 37 ms against 30 ms with rows alone,
em-desktop 44 ms either way), and a one-node edit to a small
component moves nothing else.

**`cy.layout({ name: 'pack' })`** is the re-pack on its own: the
components at their current positions, shelf-packed by their body
boxes under the same four options, the largest component's centre
held, an explicit `boundingBox` honoured after the pack.  Translation
only — no shapes and no orientation, which need edge lengths and
belong to `force`.  For a drawing whose structure is done (a sim, a
preset, an arrangement by hand) and only wants its components
grouped and ordered: EnrichmentMap's keep-the-layout, regroup-by-sign
case in one call.

**Breadthfirst draws its trees as blocks by default** (123.4).  With
several components in a row drawing, v3 spread every rank across the
box and sorted it by the parents' positions alone, so the trees
interleaved and a root sat at the middle of a row that ran the whole
width.  Now each rank is ordered component-first — the largest tree
leftmost, the parent heuristic (or `depthSort`) within it — and each
component takes a column band as wide as its widest rank needs,
bodies included, each rank centred in its band, so a root stands
above the middle of its own subtree; the singletons share one band, a
block of rows as wide as a shelf; and the bands wrap into shelves up
to the box's width (or the one band wider than it), `componentSpacing`
apart, the next shelf's rows under the deepest band of the one
before, the rows spread over every shelf's rows.  Depth rows stay
shared within a shelf, so levels align across its trees and no height
is spent.  One component is v3's picture exactly (the spec pins the
positions); `circle: true` rings are untouched.  On em-web (144
components) the page reads as the big tree, shelves of the medium and
the small trees, rows of pairs and rows of singletons, in 142 ms;
`packComponents: true` there is 109 ms.  The debug page has a **Pack
components** box and a **Pack** entry.

## The radial tree layout (round 85.1, #2493)

Discrete, breadthfirst's shape, with the one property breadthfirst's
`circle: true` cannot promise: **hierarchy-aware angular allocation**.
A BFS tree grows from the roots (`roots`: collection or id array — a
selector string throws; omitted, a component's *true* roots, the nodes
with no incoming edge, or its max-degree nodes when it has none —
125.3's sitting: radial is a hierarchy's picture, and reactome's centre
had gone to the degree-17 node with the one root on ring 1), then
every node takes a *wedge* — a share of its parent's
wedge proportional to its subtree's weight (`weight: 'leaves'`
default, or `'subtree'`) — and sits at the wedge bisector at radius
depth × `levelSpacing` (derived from the bounding box when unset).  A
subtree is one contiguous sector, so tree edges never cross the
circle — the #2493 / Vega-radial-tree ask.  Multiple roots partition
the `sweep` proportionally to their trees, in the caller's roots
order; a lone root sits exactly at the centre, several move out to
the first ring; unreached nodes seed their own trees in scope order,
so a disconnected component always gets a wedge.  Non-tree edges just
draw (breadthfirst's stance); leaves only, parents derive.  **Rings
grow to clear overlap** (round 114.6, `avoidOverlap`, default true;
exact since 115): the wedge angles are the structure, so radius is the
one degree of freedom — each ring starts at its share of
`levelSpacing` and takes the smallest radius at which neither the ring
inside it nor the neighbours along it (whatever wedge they belong to)
touch, every pair separated along its own direction
(`layout/separation.mts`), node boxes read through the shared
dimensions (labels under `nodeDimensionsIncludeLabels: true`, padded by
`avoidOverlapPadding`).  Options: `roots`,
`startAngle`, `sweep`, `clockwise`, `levelSpacing` (a floor under
`avoidOverlap`), `avoidOverlap`, `avoidOverlapPadding`, `weight`, plus
the shared finisher plumbing.  No v3 twin exists; the
benchmark's comparison partner is v4's own breadthfirst-circle,
pricing what the hierarchy-awareness costs.

## The flow layout (round 112)

The Sugiyama-class layered built-in — open call 49's "comparable to
dagre" bar, taken up as **build, not port** (dagre is unmaintained and
predates the Brandes–Köpf erratum; elkjs is a ~1.5 MB transpilation;
the round-112 record carries the survey and the measured baselines:
dagre crashes on the long-skip fixture, hangs on nested clusters and
DNFs at 10k nodes).  `cy.layout({ name: 'flow' })` rides the
extension contract like force, so `promise()` comes for free.

The pipeline, per weak component (`flow-graph` / `flow-rank` /
`flow-order` / `flow-position`, all typed-array): greedy-FAS cycle
removal (Eades–Lin–Smyth bucket lists, model-order ties; `cycleRemoval:
'dfs'` keeps input order dominant), GKNV network-simplex layering
(tight tree, subtree-net-weight cut values, balance; longest-path as
seed, fast path and `layering: 'auto'` fallback past 50k nodes),
dummy-chain normalization, bidirectional barycenter/median sweeps with
transpose scored by exact weighted Barth–Jünger–Mutzel cross counting
(budgeted by `thoroughness` 1..10), and Brandes–Köpf coordinates —
four alignments with type-1 marking, **block-graph longest-path
compaction** in place of the paper's class/shift machinery (the
BK-2020 erratum documents two defects in it; a block-DAG pass has
neither, and the four-way balance recovers what it forgoes),
size-aware separation (`nodeSep` between bodies, half beside a dummy
corridor).  **The extents are per side and per direction (125.2)**:
a node's left, right, top and bottom are read as it has them and
mapped onto the canonical axes by the direction, so a label hung to
one side extends that side alone and a rightward rank is separated by
heights — the first version used the larger side twice, and the model
width along a rank whatever the direction, which is what made the
label-inclusive pictures several times too wide (reactome 21.7 →
17.0 Mpx²; the Greek-gods scene rightward with labels 3.4 → 1.6) and
the rows 27 % too tall under bottom-hung labels.  **Compaction ends
with a placement pass for free singletons (125.2)**: a real node no
alignment took — a leaf in the sweeps that align to lower neighbours,
or a node whose median parent was taken or marked — was left at the
leftmost feasible x (rightmost, mirrored), and the balance of four
such candidates put a leaf with one parent in the middle of whatever
empty interval its rank had (reactome's "IRAK1 recruits IKK complex
upon TLR7/8 or 9 stimulation": 1,632 px from its only neighbour, now
68).  Each such block now moves, within the slack its rank neighbours
leave, to the median x of its neighbours on the sweep's side; the
rank order is untouched, so crossings are unchanged (deps 4189 →
4192, workflow-1k 19589 → 19550) and mean edge length falls on every
DAG fixture.  Components pack by *body* boxes (point-bbox packing
overlapped deps' 164 singleton components).  Ranking honours
`rankConstraints` (`same` contracts nodes — welding components if
needed — `min`/`max` pin via zero-weight anchor edges; contradictions
throw), and `minLength`/`edgeWeight` take the 85.3 mapping spellings.

**No edge routing, by decided design** (the maintainer's call, round
112): flow emits node positions only, so style-driven edges keep
routing themselves after any drag.  The taxi contract, as round 124
left it: rank gaps are node-free bands where a `taxi-direction:
downward` turn lands, and under `taxi-turn: auto` each fan-out's run
takes its own line in the gap (the track pass, below); BK's aligned
chains make `src.x === tgt.x` drops exactly straight; **the long
edges into one target share one merged chain, anchored at the target
(124.5)**, so the taxi leg at the target's x meets no node body on
the intermediate ranks (a corridor probe over 400 seeded DAGs: 187
violations before, 7 after — the residue being chains the ordering
left crossing); and **the gap below a rank grows to hold its tracks**
— `max(rankSep, tracks × edgeSep + 20)`, `edgeSep` a new option
defaulting to 10, `tracks` the overlap depth of that rank's fan-out
runs.  112.4 had measured the 50 %-turn polyline scoring *more*
crossings than the straight drawing and withheld `alignLongEdges` as
a placebo; 124.1's run-overlap column showed why — collinear runs are
not crossings, they are ambiguity — and the corridor landed in the
form the measurement asked for.

Leaves place, parents derive (round 14.11); compound-aware global
layering is pass 112.3.  Options: `direction`, `nodeSep`, `rankSep`,
`edgeSep` (124.5), `layering`, `thoroughness`, `minLength`,
`edgeWeight`, `acyclic`,
`cycleRemoval`, `rankConstraints`,
`componentSpacing`, `avoidOverlap` and `avoidOverlapPadding` (114.6:
extents come from the shared dimensions, labels on request,
and a `boundingBox` now holds the bodies rather than the centres),
plus the shared plumbing (finisher path when animate / transform /
spacingFactor are asked for; bare runs take the columnar bulk write —
one rule, `ctx.finish`, since 114.2).  Quality is measured, not
asserted:
`npm run benchmark:layout-quality` runs flow beside dagre and elkjs on
the round-112 fixture set (crossings, edge length, area, validity,
runtime), and the round file records the numbers.

## Taxi tracks: automatic turn distances per bundle (round 124, item 59)

Flow's one open legibility problem was *which edge goes to which
node*: with `curve-style: taxi` every edge out of a rank turned at
the same distance, so the horizontal runs of different sources lay on
one line.  The reference picture is Abrate's tangled-tree genealogy
(GeneaQuilts with curved links), whose universal device is a
different turn distance per family; its general form is Sander's
hyperedge routing slots, which ELK's orthogonal router assigns per
layer gap.

**`taxi-turn: auto`** takes the edge's px turn from a *track* the
store assigns from live positions — style-side, by the maintainer's
call, so edges keep routing themselves after any drag and every
layout benefits (`flow`, `breadthfirst`, `preset`, hand placement).
**`taxi-track: source | target | family`** (default `source`) says
which edges share a track: the edges out of one node (ELK's
hyperedge — a fan-out reads as one orthogonal bus on its own line),
into one node (the mirror, for fan-in drawings), or into the targets
that share a parent set (the GeneaQuilts key: k parents and m
children on one trunk; it multiplies the track count on a general
DAG, so it is opt-in).  **`taxi-track-spacing`** (default 10) is the
ideal distance between neighbouring tracks.  All three are
mapper-capable edge props; `auto` on a mapped `taxi-turn` is a
`fallback` keyword; `taxi-turn` reads back `'auto'`.

The pass (`src/taxi-tracks.mts`, pure): per edge the axis, sign and
ideal band are derived exactly as `evalTaxi` derives them; bundles
key on the grouping per axis and direction, and a bundle's band is
the intersection of its members' bands (members whose bands do not
intersect split); the band is cut by the node bodies the run would
cross and keeps the stretch nearest the source (nearest the target
for `target` bundles), which is what puts a long edge's run in the
first gap and its leg at the target's x; two bundles conflict when
both their runs and their bands overlap; conflicting bundles are
ordered by ELK's pairwise crossing rule — for each pair, count the
legs each order makes cross the other's runs, orient the pair the
cheaper way, keep orientations by decreasing margin unless one closes
a cycle, colour greedily in the topological order — with the
staircase (by source position) as the control; slot s of k lands at
`mid + sgn × (s − (k − 1)/2) × min(spacing, band/(k + 1))`, so a
crowded gap compresses rather than falling to the Z-shape, and a lone
bundle draws exactly what `'50%'` draws.  **Delivery is a lane, not a
column and not the blob**: the taxi record's third float is a turn
*mode* (px / percent / auto) and an auto edge's px turn is the params
header's n lane, which taxi never used — both `evalTaxi` and the WGSL
twin read it, the blob stays position-independent, and no new binding
was needed (the curved vertex stage sits at the 8-storage-buffer
budget, which is why the plan's separate column became this lane).
`GraphStore.refreshTaxiTracks` runs from `flushDerived` **once per
geo epoch** — at frame start and on the CPU readers — over the exact
set of auto slots the curve index keeps, with the shown leaf bodies
as obstacles, writing the changed lanes as one dirty span and never
bumping the epoch it is keyed on; a single size check when nothing is
auto.  Two limits, recorded: under a GPU position tween or a GPU
force lease the CPU column is stale, so tracks refresh when the
positions land; and the sweep is whole, not incremental — measured
(124.7) at 8 ms on workflow-1k (1.9k edges), 26 ms on a dense
2.7k-edge bench where every source fans across its row and 160 ms on
a pathological 8.7k-edge one, the crossing rule's pair costs being
the cost (bounded per conflict component at 128 bundles, past which
that component keeps the staircase; the first version's per-pair
cycle search was 1.3 s there).

Measured (124.1; the harness's new `runOverlap` column counts pairs
of bundles whose runs are collinear and overlap): on deps,
workflow-1k, reactome and the Greek-gods genealogy the count falls
from 43 / 1141 / 37 / 10 under the 50 % turn to 0 / 3 / 0 / 0 under
tracks, and the crossing rule beats the staircase on crossings on all
four (4259 vs 4515, 23176 vs 29266, 59 vs 62, 134 vs 144), so it is
the default; after 124.5's corridors the tracked rows read 4142 / 0,
22929 / 1, 59 / 0, 134 / 0.  The 50 %-turn crossing counts are not
comparable:
collinear runs are not proper intersections, and separating them
exposes the leg crossings they hid (reactome's 3 becomes 59).

Round 124 also drew **the casing per edge** (124.4, the casing
paragraph under round 13 above) and gave **flow** its corridors and
`edgeSep` (124.5, the flow section).  Declined, as recipes: colour per
family is a `line-color` ordinal mapper over an edge data key
(`range: 'dark2'`, cycled past eight); the long-edge radius is a
`taxi-radius` mapper over a span key; stretching a node to stagger its
attachment points is not done (the merge at a shared target reads as
a metro junction).  The debug page's flow sheets use `auto` with a
background-coloured casing, and `?network=greek-gods` reproduces the
reference picture (rightward, `taxi-track: family`, dark2 per
family).

## Data-driven layout mappings (round 85.3, #1514)

The five layout params that take per-element values accept
serializable objects beside the function forms
(`layout/layout-mapping.mts`).  The census found exactly two shapes:
**score** — `{ data, scale?, range?, invert?, default? }` on
`force.edgeLength` and `concentric.concentric` (bare `{ data }`
passes the column through; with `range`, the column's extent
normalizes through `'linear' | 'log' | 'sqrt'` into it, and
`invert: true` flips it — the "large scores, shorter edges" recipe in
one literal) — and **sort** — `{ data, order? }` on `grid.sort`,
`circle.sort` and `breadthfirst.depthSort` (missing values last, ties
on the id — deterministic where a hand-rolled comparator often is
not).  The fn forms stay as escape hatches; the objects are the
canonical spellings.  Everything resolves **once at layout start** —
no live refresh, which is why it is ~80 lines and not the style
mapper IR.  Validation fails loudly, naming the option and key:
unknown keys, wrong-kind columns (the store's own
'number' | 'string' | 'mixed' vocabulary), and `scale`/`invert`
without a `range` all throw.

Round 87.3 made **grid and preset honor the finisher options** —
`animate`, `animateFilter`, `transform`, `ready`, `stop` — which
their benchmarked bulk write paths had been skipping (callbacks
included, not just tweens); a bare call still takes the bulk path.

## The force layout (rounds 18 + 59)

**Round 129.3 put the CPU simulation on a worker.**  The force layout
has three executors now, and an `executor` option (`'auto' | 'cpu' |
'gpu' | 'workers'`, default `'auto'`) names them: the GPU integrator
(a flat, unconstrained graph on a rendered instance with a device —
either host since 129.2), the CPU simulation on a worker that loaded
this same bundle (`src/layout/force-worker.mts` the loop,
`src/layout/force-remote.mts` the spawn and the run handle, the render
worker's mechanism rather than a stringified kernel because `ForceSim`
is a class over `OverlapGrid` and the constraint projection), and the
in-thread simulation.  `'auto'` is availability-driven, as 87.2 made
it: the integrator where the renderer offers one, else the worker
wherever one can be constructed — a compound graph, a constrained run
and a page without an adapter no longer hold the main thread for the
run, and **headless too** (round 131 revisited 129.3's deviation on
the maintainer's addendum: a Node process wants its main thread free
for the event loop as much as a page wants its UI thread free), so a
headless `'auto'` run is asynchronous where the platform offers a
worker — else in-thread.  `'cpu'` is the in-thread reference and the
synchronous spelling; `'workers'` is the worker, throwing at start
where none can be constructed; `'gpu'` throws at start where no
integrator is available.  The worker's
trajectory is **bit-identical** to the in-thread sim's — the same
class, the same inputs cloned — on the plain, the compound and the
constrained fixtures (`test/force-worker.mjs`, asserted with `===`);
a live run streams its frames through the layout's own write-back,
an infinite run's verbs (a drag, a pin, a reheat, a wake) are messages,
`stop()` / `cancel()` / `destroy()` propagate, one worker serves a
page or process for the session (spawned lazily; a second concurrent
run while it is busy runs in-thread), and the constraint projection
is a pure function (`projectConstraints`) so the settle projects a
remote run's positions as it projects the in-thread sim's.  In the
Node suites the worker loads the source tree: a worker thread inherits
tsx's loader but not its `.mjs` → `.mts` aliasing, so the bootstrap
registers tsx inside the worker first — a source-tree-only branch.

**Round 85.2 added constraints** (fcose #54/#53 absorbed): **fixed** is
already spelled `lock()` (deliberately no second spelling);
**alignment** — `alignment: { horizontal?: string[][], vertical?:
string[][] }` (fcose's shape; id arrays, serializable; groups sharing a
node merge transitively; a locked member pins its group's coordinate);
**relative placement** — `relativePlacement: [{ left, right, gap? } |
{ top, bottom, gap? }]`, `gap` defaulting to the run's mean ideal edge
length.  Validation fails loudly at start: unknown ids, a cycle in
either axis's placement DAG, and two locked members of one group at
different coordinates all throw.  Method: **constraint projection after
each integration step** (the IPSep/CoLa-lineage standard, and what
fcose runs) — alignment snaps to the group mean (or the locked pin),
violated relative pairs split the correction Jacobi-style, pinned nodes
never move; the projection's corrections are deliberately *not* folded
into the convergence displacement (folding reads as never settling),
and the seed projects once before the first tick.  The settle re-pack
is skipped for any constrained run (it would translate a group past its
pin).  **Constrained runs take the CPU executor** — the measure-first
gate ran (render-bench --layout): at 25k×50k the demoted sync settle is
~26 s against ~0.4 s silent GPU, but the constraint feature's consumers
(fcose migrators) run hundreds-to-thousands of nodes where the CPU
settle is seconds — so v1 accepts the demotion (the compound
precedent), the losing configuration stays measured in the bench, and
the on-device `constrain` dispatch design (one dispatch after `apply`;
groups as a [starts][members] buffer tree-reducing the mean, one
workgroup per group; pairs as a Jacobi list) is recorded in the round
for the day demand justifies it.

Round 18 built the layout (2026-08-01); **round 59 rebuilt its model**
(2026-08-09) after the maintainer reported it drifting apart on large
networks until a fit left everything invisible.  Scoping measured the
round-18 model as explicit-Euler *unstable* past node degree ~20 — the
em-web fixture ended at a 3e11-px bounding box, and the compound twin
NaN'd — so what follows describes the round-59 model; PLAN.md's two
round records carry the histories.

- **`cy.layout({ name: 'force' })`** — a force-directed layout with:
  - **degree-normalised springs** (d3-force's rule: per-edge strength
    `stiffness / min(deg)`, each end weighted by the other end's
    degree share) toward per-edge ideal lengths (`edgeLength` as a
    number, a plain fn resolved once, or an 85.3 `{ data, … }` score
    mapping) — a node's aggregate per-tick
    spring correction is bounded by `stiffness` whatever its degree,
    which is the stability guarantee;
  - **inverse-square repulsion with a real far field**: one law
    (`repulsion · (cutoff/d)²`, sfdp's p = 2) across all pairs — the
    near field exact over the binning grid's 3×3, the far field from
    a **monopole pyramid** over the same grid (per level, the aligned
    6×6 block refining the parent's 3×3 minus the level's own 3×3 —
    cosmos.gl v3's shipped scheme);
  - **component-aware constant-magnitude gravity**: components are
    found up front (union-find), their anchors shelf-packed by
    estimated radius, every node seeded around its component's anchor
    and pulled toward it at constant magnitude (ForceAtlas2's
    containment rule), with an exact translation-only re-pack of the
    settled component boxes at the end (`componentSpacing`, v3
    cose's option and 40px default) — skipped whenever the scope
    holds a locked node, since a re-pack moves whole components;
  - **a spectral seed** (`init: 'spectral'`, the default): landmark
    MDS per component — BFS hop distances from ≤ 25 farthest-first
    pivots, double-centred, top-2 eigenpairs by power iteration —
    fCoSE's approach, and the thing that uncurls chains and separates
    clusters where local refinement cannot (measured: a 40-node chain
    ends 3208 px end-to-end against 346 px under `init: 'scatter'`);
  - **capped damped-gradient integration** under d3-shaped alpha
    annealing: each step is clamped to an alpha-annealed multiple of
    the repulsion range (v3 cose's `limitForce` discipline), and a
    non-finite displacement never reads as settled;
  - **compound terms on the CPU executor** (compound graphs never
    take the GPU path — the 14.11 lease rule): each leaf pulls toward
    its direct parent's live centroid (`gravityCompound`, a multiple
    of `gravity`), and an edge spanning compound boundaries takes
    `length × levels × nestingFactor` (v3 cose's multiplicative
    rule and 1.2 default).
- Seeded and deterministic on the CPU executor (`seed`, `randomize`);
  leaves only (parents derive); locked nodes pin as obstacles; subset
  scopes simulate the subset only.  Runs through the round-17
  extension contract — the built-in is the contract's first
  production consumer.
- **Two executors, one spec.**  The CPU reference
  (`layout/force-sim.mts`, with `layout/force-init.mts` holding the
  pure component/seed machinery) always exists — headless instances,
  compound graphs, constrained runs (85.2) — and is what the Node
  specs pin.  On a flat rendered graph with a device, the **GPU
  integrator** (`gpu/gpu-force.mts`) takes over **however the run
  is shown** (87.2 — executor choice is availability-driven, not
  presentation-driven): per iteration,
  grid build by counting sort → pyramid aggregate + per-level reduce
  → force gather → apply-and-publish, encoded ahead of the cull pass
  so 100k-node layouts animate live with edges and labels following
  on-GPU.  The force kernel sits at 7 storage bindings —
  `cellStart`/`cellItems`/pyramid share one grid buffer, and the
  gravity anchors ride the CSR buffer's tail.

  Under `animateLive: true` the run publishes into the position
  mirror, streaming to the screen per frame; otherwise it publishes
  into a runtime-owned slot-capacity **scratch buffer**
  (`GpuForceRuntime.silentTarget`) while draws keep reading the
  untouched mirror — the screen holds the pre-run frame, and the
  settle lands in one write, or (round 114.5) as a **tween** under
  `animate: true`: the discrete layouts' meaning at last, the nodes
  tweening from where they were to where they landed through the
  shared finisher with the viewport fitting alongside, so
  `spacingFactor`, `transform`, `animateFilter`, the duration and
  easing, `zoom` and `pan` all apply to force.  The named semantics
  change: `animate: false` on a flat rendered graph went synchronous →
  async (positions readable at `layoutstop` / `promise()`), recorded
  in MIGRATING / CHANGELOG / the option's JSDoc.  Priced at 25k×50k
  at the time: silent GPU ~346 ms vs the old sync CPU settle ~25.3 s,
  with an in-row frames-delta assertion refusing the bench row on a
  device-less fallback — **a nine-iteration figure** (116.1's
  readback defect stopped every GPU run there); the converged run on
  that scene is 3.3 s on the page since round 119, 11.8 s before it.

  **The settle separates node bodies** (114.5, `avoidOverlap`, default
  true; the dense case rebuilt in 115): the sim is point-based, so
  overlapping boxes — labels under `nodeDimensionsIncludeLabels: true`,
  padded by `avoidOverlapPadding` (10) — are pushed apart along the
  axis of smaller overlap over a grid hash (the sparse case, a sweep or
  two), and what a pile leaves is opened by PRISM's proximity stress
  (Gansner & Hu): near pairs get target distances — an overlapping
  pair's the factor that clears it along its own direction, capped per
  round, a clear pair's its current distance at a quarter weight — and
  stress majorization moves each node to what its neighbours ask, so
  the pile opens locally and the far field never moves.  114.5's
  version scaled the whole component by its *worst* pair's factor and
  spread every settled graph several times over (em-web's 2.4k px
  field became 11.6k; it is 2.8k now).  **The crammed case is an
  expansion** (118.1, item 57): round 117 found the pass handing the
  25k × 50k random scene back with more overlap than it was given
  (12,352 pairs at 5.6 px in, 13,406 at 11.8 px out), and the
  per-stage measurement said why — on a field where nine nodes in ten
  sit inside a neighbour's padded box, the sweeps push pairs the full
  box depth into the next node and forty stress rounds add pairs
  without moving the bounding box, because a stress round is a local
  Jacobi step and a uniformly dense field's neighbours ask for nothing
  net.  So a component of a thousand nodes or more with over 60% of
  them touching is scaled about its centroid by what its median
  overlapping pair asks for, capped at 1.25 per round, while it stays
  crammed; then the local passes clear the residue.  Piles stay with
  the stress rounds (the 60-clique of labels fills 0.45 of its field
  under them and 0.33 under a scale), and a pinned node holds its
  component back from the scale.  Measured on the sim's own fields: 5k,
  10k and 25k all come out with zero overlapping bodies where before
  the 25k scene held 13,498 and the 10k scene 1,015 at full depth, the
  pass runs in 0.2–3 s at 25k against 7 s, and the settled field grows
  1.4–1.8× linearly — what the padded boxes need.  A **best-state
  guard** measures the summed overlap depth after every stage and
  restores the shallowest, so the pass can never return a deeper field
  than it was given (on the real 25k field with the expansion withheld
  it restores the fortieth stress round over the closing sweeps).  The
  quality suite's crammed 3k row and `test/modules/force-separation.mjs`
  gate it.  Pinned nodes are obstacles
  throughout, the body-box component re-pack follows.  The one
  post-pass in the layout portfolio (the round-114 decision against a
  generic remover: every other layout spaces constructively).

  `node.position` is GPU-owned for the run (the tween lease — CPU
  reads stale mid-run, the motion-staleness rule), and convergence
  triggers **one readback** (the round-9 exception) that settles the
  CPU columns through the normal dirty-span path.
- Recorded deviations/limits: GPU trajectories are not bit-stable
  run-to-run (atomic in-cell scatter order) — seeded
  bit-reproducibility is the CPU executor's guarantee, and the
  executors agree on invariants, not trajectories; live streaming
  writes through the bulk slot path, which emits no per-node position
  events; the settle's body separation and re-pack are a visible
  end-of-run shift under `animateLive: true` (v3 has the same shift;
  the anchors keep it small — and under `animate: true` the tween
  absorbs it);
  compound gravity reaches direct parents only (deeply nested
  coherence rides the nesting-elevated edges); expander graphs settle
  with mean link lengths several times the ideal, which is
  topology-intrinsic rather than a model defect (no planar embedding
  of a random graph has short edges); and multilevel refinement stays
  the logged future direction for tree/mesh quality beyond the
  spectral seed's.
- **The infinite run** (118.3, `infinite: true`) is the live
  force-directed layout that never ends, done so that it costs nothing
  at rest.  It streams like `animateLive`, and the sim ticks only while
  its field is moving: `ForceSim.idle()` / `GpuForceRuntime.idle()` is
  the settle test without the iteration cap (alpha at its floor with a
  quiet sweep, or the displacement under `threshold` for three ticks),
  the CPU loop schedules no frame on it and the renderer neither
  encodes the run nor keeps its clock running.  A `grab` pins the
  grabbed node into the sim for the gesture (`setPinned` on either
  executor — on the device, the pin bit of one slot word), every
  `position` event on a scoped node writes the store's coordinates into
  the sim (`setPosition`; on the device an 8-byte queue write ahead of
  the next encode) and reheats it (`reheat`, alpha to 0.3, d3's drag
  convention), a `free` releases it and reheats again so the field
  relaxes, and an `add` or `remove` under a whole-graph scope rebuilds
  the sim on the live graph from the positions as they stand
  (`LayoutContext.refreshScope`, then `runOnce` again with the seed
  skipped) — a subset scope is the caller's collection and ignores
  them.  `layout.reheat(alpha?)` is the handle for a change the run
  cannot see (an edge length under a data mapping, a restyle that
  resized the boxes).  `stop()` ends it, landing the positions as they
  stand — no separation pass, no re-pack, no fit and no tween: the
  person is looking at them; `cancel()` (round 128) ends it the other
  way, the nodes back where the run found them.  So `avoidOverlap` under `infinite` means
  the per-tick sweep (`'sim'`), `iterations` is ignored, and the
  lifecycle's `layoutstop` fires at `stop()`.  Priced: at rest an
  infinite run is the cost of its listeners.
- Options added by round 114.5: `animateLive` (the streaming run —
  the pre-114 `animate: true`), `avoidOverlap`, `avoidOverlapPadding`;
  `animate` now tweens, and the shared finisher options apply.
- **The sim can keep the bodies apart itself** (116.1 as a contact
  force; **projection since 118.2**; opt-in since 117).  `avoidOverlap`
  says how the padded boxes are kept apart: `true` / `'settle'` (the
  default) is the settle's exact pass; `'sim'` runs the settle's own
  primitive — one Gauss–Seidel separation sweep, `OverlapGrid.sweep`
  in `layout/separation.mts`, a second for the residue the first's
  pushes made — after every integration step on both executors, and
  no settle pass; `'both'` runs the sweeps and the pass; `false`
  neither; anything else throws at start.  The sweep's largest push
  counts toward the convergence displacement, and at alpha's floor
  the run keeps sweeping until a sweep is quiet, because at the floor
  each tick *is* a sweep and a pile opens under pairwise pushes only
  slowly (a 200-clique of padded boxes needed 92 sweeps past the
  floor under one per tick; two per tick end the 30-clique at 458
  iterations and the 200-clique at 636, both overlap-free at the
  padding).  A pair that never overlaps is never touched — a ring
  seeded clear runs byte-identically with boxes and without — and a
  pile the springs press together is held open tick by tick: mid-
  transient the springs move a node a box deep every tick and the
  sweeps hold the 30-clique at ~45 of its 435 pairs overlapping where
  the point sim has the whole pile, then clear it from about tick 400
  of 458.  So `'sim'` is the mechanism for a run with no end for a
  settle to land on (118.3's `infinite`) and for a streamed run that
  should look separated as it streams; `'settle'` is cheaper for a
  one-shot run, which is why it is the default (117, item 56).  **A
  sweep is a local pass, and a field denser than its boxes allow is
  not its to open** (118.4, found on the page): the 25k random scene
  in padded 12 px bodies under `'sim'` alone ended its iteration cap
  with 2,565 overlapping pairs and its bounding box where the point
  sim left it, where `'both'` and `'settle'` end clear — the settle's
  expansion (118.1) is what such a field needs.  And at alpha's floor
  a boxed run keeps sweeping only for `FLOOR_SWEEP_BUDGET` (200)
  ticks: a pile opens within a hundred, a crammed field never does,
  and without the bound an `infinite` run on such a field never
  rested (a minute of frames on the page, and counting).  On
  the GPU the sweep is a Jacobi gather — every node sums its
  overlapping neighbours' pushes over a grid rebuilt after `apply`,
  clamped to the largest single pair's, then `applySep` moves and
  republishes — so the executors agree on the invariants (clear at
  the end, the padding kept) and not the trajectory, as everywhere.
  The boxes ride the CSR buffer's tail behind the anchors (four f32
  per node), so the kernels keep their binding budget.  **Why 116.1's
  contact force is gone**: item 56's measurement (117) showed a force
  bounded by its 1 px gap clamp loses to the spring pressure of a
  dense random graph (the fully annealed 25k sim still held 36,042
  overlapping pairs), and its stiffness annealed every run to the
  floor; a projection after the step cannot be out-pushed by the
  springs and does not bounce.  `avoidOverlapInSim` (117) is gone
  with it — the mode is the option's value.
- **The GPU displacement readback never landed** (found by 116.1's
  browser spec, fixed with it).  The renderer polls convergence at
  frame start, before the frame's encode, so the poll mapped the
  staging buffer ahead of every copy, the copy was skipped on every
  frame (the buffer was mapped), and every readback was the buffer's
  initial zero — which counted as settled, so **any GPU run with the
  default threshold stopped at nine iterations**, four frames, from
  the spectral seed, the settle's separation hiding the pile.  Round
  18.3's lease spec ran with `threshold: 0` and 18.4's invariants are
  loose enough that a nine-iteration run passed both.  The runtime
  now maps only once a copy has been encoded since the last map, so a
  poll reads a batch (one frame late, latest-wins); a 30-clique's
  point run takes 44 frames and its boxed run 141, and the 116.1 spec
  asserts the frame count.  Every browser force number measured before
  this — the render bench's `--layout` rows included — was a
  nine-iteration run.
- **`boundingBox` is honoured** (116.2), by flow's rule made shared
  (`layout/pack.mts`'s `fitBodiesToBox`): after the settle's separation
  and re-pack the drawing scales down — never up — until every body
  lies within the box, then its body extents centre in it.  Uniform,
  so the sim's structure is kept; `edgeLength` and `repulsion` own the
  density, the box owns placement.  Held back exactly when the re-pack
  is (a pinned node, or constraints), and under `animateLive` it lands
  with the end-of-run adjustment.  v3 cose stretched the centres to
  fill the box, up or down and size-blind; that is not carried.
- Options added by round 59: `componentSpacing`, `init`,
  `nestingFactor`, `gravityCompound`.  Re-read by round 59 (same
  names, new units): `repulsion` (the push at one cutoff length),
  `stiffness` (fraction of the residual per tick), `gravity`
  (constant px/tick toward the anchor).
- Harness: `debug/?layout=force` (+ `&seed=N`); benchmark:
  `benchmark:renderer -- --layout` runs a live force to convergence
  per scene (v3's cose as the classic baseline, bounded by nested
  test-style timeouts — a 30 s in-page stop reporting a measured
  floor and a 60 s runner-side bail reporting "> 60 s";
  `--layout-uncapped` measures full runs).

  **Round 119: the GPU executor's iteration cost.**  The maintainer's
  first sitting in front of 118's page found force on em-web at two
  seconds where it had been "near instant" — the instant run was
  116.1's nine-iteration defect (a 90 ms run with a field four times
  too wide), and the two seconds were the converged run at three
  iterations per rendered frame, vsync-paced, plus the page's tween.
  Two changes: a **non-presenting run batches** — `animate: false`
  and `animate: true`'s tween are not watched mid-run, so the renderer
  asks `nextBatch` (`gpu/gpu-force.mts`) each frame and the batch
  doubles while the device keeps up, halves the frame after a scene
  pass was skipped under the frames-in-flight backpressure, within
  `[stepsPerFrame, 64]`; `animateLive` and `infinite` keep their
  watchable rate — and the **cell scan is parallel**: `scanCells` was
  one thread walking every grid cell through a dependent atomic chain
  (~0.3 µs a cell, 65k cells at the cap — 3.2 ms an iteration on 569
  nodes, 19 ms at 10k, and what the executor's cost scaled with), now
  one 256-thread workgroup scanning chunk totals in shared memory.
  em-web silent 1,470 → 270 ms, 25k silent 11.8 → 3.3 s, 25k under
  `'sim'` 50 → 18 s (the sweep rebuilds the grid through the same
  kernel).  The tables are on the round.

  **119.3: the settle threshold is relative, for a run nobody
  watches.**  The maintainer's eye said the nine-iteration field had
  looked fine, and the fixture sweep agreed: on em-web, em-desktop,
  npm-deps, reactome, a 1k random graph, a 500-node tree and a grid,
  the edge-length spread, a sampled stress and the overlap count
  plateau by 60–100 iterations and do not move between 100 and the
  0.1 px settle at ~300 — the spectral seed places the graph, and the
  anneal's last two hundred ticks moved nodes by less than anything
  measured.  `threshold` now defaults to **2% of the mean ideal edge
  length** (1.2 px at the default 60) for `animate: false` and the
  tween — measured to reproduce the 0.1 px settle's metrics within
  noise at 2–3× the speed headless — while a *presented* run
  (`animateLive`, `infinite`) keeps 0.1 px, since its stop is motion
  the eye sees and a field still creeping a pixel a tick would stop
  visibly short.  Two things had to come apart from the threshold for
  that: the separation sweep's quiet test (`SWEEP_QUIET`, 0.1 px, its
  own atomic max on the device — a pixel-scale settle would have left
  pairs a pixel deep), and the GPU's settle count, which now credits a
  quiet batch with every iteration it covers (the batch's max is over
  all of them) instead of counting polls two frames apart — the run
  had been going to 460 iterations on em-web waiting for three polls.
  em-web silent 270 → 145–240 ms in 7–9 frames, ndex-large 585 → 380
  ms, and the debug page's readout now splits the layout from the
  tween it shows under Animate.

  **Round 120: the smallest components take shapes.**  At the settle,
  before the separation pass and the re-pack, a component of two
  nodes stands as a vertical barbell, three make a point-up
  equilateral triangle and four a diamond (`tidySmallComponents`,
  `layout/pack.mts`; the option is `tidyComponents`, default true).
  The radius is the larger of the component's edge length along every
  side and what its bodies need — since 125.1, for every pair of the
  shape's points, the distance along the pair's own direction at which
  their boxes stop intersecting (`separationAlong`, the separation
  pass's rule), because 120 cleared only the shape's *neighbours* a
  body apart along the sides and the axis-aligned pass that followed
  broke every diamond of square bodies it was handed (0 of em-web's 4
  survived a `settle` run; with labels, no triangle did).  The pass
  now also separates only *within* components when the re-pack
  follows (the re-pack places components apart by their boxes; a sweep
  across them only pushed foreign nodes into the shapes) — measured on
  em-web: 20/20 pairs, 9/9 triangles and 4/4 diamonds stand in every
  `avoidOverlap` mode, bodies and labels alike.  The perimeter is
  walked depth-first from a path's end or a star's hub.  Every component of a size is
  then the same box, so the largest-first re-pack lays the quads,
  triples, pairs and singletons out in rows — the EnrichmentMap
  preset's shape — and two centre labels on a pair never sit side by
  side.  Left alone: singletons, five nodes and up, a component with
  a locked node, one whose edges ask for different lengths, and
  constrained or infinite runs.  The debug page has the box, and a
  dropdown entry **Force, then pack by sign** that runs force once
  per sign of the network's `signKey` (NES on the EM fixtures) and
  sets the positive side to the right of the negative — the EM
  preset's red-right / blue-left packing from two scoped force calls
  and a shift.

  **Round 121: the re-pack takes a grouping and an order, and the
  larger components turn.**  `componentGroup` is a function of each
  component's description — `{ nodes, size, width, height }`, the box
  as the re-pack will see it — returning a key; the components sharing
  a key pack on their own and the groups stand in a row, numbers
  ascending, then strings, then the unkeyed, `groupSpacing` apart
  (three component spacings).  `componentOrder` is a comparator over
  two descriptions, ahead of the largest-box-first order that breaks
  its ties, so `(a, b) => b.size - a.size || score(b) - score(a)` is
  rows by node count with each row by score — the EnrichmentMap
  preset's, measured: within a size the singletons read NES
  descending on each side.  Both skip with the re-pack (a locked node,
  constraints) and throw at start when not functions.  Components of
  five nodes and up turn to a canonical angle at the settle
  (`orientComponents`): the principal axis flat by the smaller turn,
  or an isotropic ring's farthest member to the top; under
  `tidyComponents`, and only where the settle pass follows, since a
  turn re-overlaps axis-aligned boxes (a `'sim'` run keeps the sim's
  angles).  The debug page's EM entry is now one force run through
  these — a mixed component (its minority sign a quarter or more)
  packs between the sides.  And the non-presenting GPU batch is priced
  before doubling (`BATCH_FRAME_BUDGET_MS`, 100): the device's time on
  the last completed batch, timed from the previous frame's completion
  to its own, over its iterations, bounds the next batch to what the
  budget buys — on the 25k scene the batch rides 3–16 and no run frame
  passes 50 ms.  The run's synchronous start is the spectral seed's,
  and its BFS is typed now (121.6: neighbour CSR, a typed local index,
  one queue — bit-identical): 190–204 → 70–75 ms at 25k × 50k, the
  library's `run()` call there 95–120 ms.

  Measured at the round-59 close (RX 580, dpr 2): ndex-x-large
  (19.6k nodes, **465k edges, mean degree 47 — the shape the
  round-18 model exploded on**) converges live on the GPU in
  **1.3 s** and fits at zoom 0.76; em-web fits at zoom 0.44 (from
  2.3e-9), the clustered compound twin at 0.40 (from 571-of-610
  NaN).  Read wall-clock convergence rows as **±25%**: trajectories
  are not bit-stable, so the iteration count to convergence varies
  (the round-36.5 caveat, unchanged).

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
  resurrects.

  Forwarding entries persist and compose across
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
  column.

  Mid-flight GPU tweens **demote** to the CPU path (they
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
  76 → 0 MiB (edges).

  The forwarding machinery is free on the hot
  path: `isCurrent` on a current ref is parity (1.01×) with forwards
  present, and a stale-ref chase + rewrite is ~40 ns once per ref.
  Honesty controls pin what compaction does *not* change: order-list
  scans and whole-graph bounds are ≈parity (1.1–1.2×, dense-prefix
  cache locality), since those ride the insertion-order list that has
  self-compacted since round 11.

  On the device (RX 580, the renderer
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
  viewport gestures (`dragpan`, `scrollzoom`, `pinchzoom`, and since
  round 75.5 `scrollpan` — core level, with positions), and the **official pointer family**
  (`pointerdown`/`pointermove`/`pointerup`/`pointercancel`/
  `pointerover`/`pointerout`) — the events the interaction layer
  itself consumes, so touch rides the same paths by construction.

  **Dropped, recorded**: the `vmouse*` aliases (`tap*` is the
  normalized vocabulary) and v3's raw mouse/touch re-emits
  (`mousedown`/`click`/`touchstart`/... — `pointer*` is their one
  modern spelling; the existing `mouseover`/`mouseout` stay);
  `event.preventDefault()` is **browser-level only, by decided design**
  (seventh sitting, 2026-08-09; wired in round 41.4).  `originalEvent`
  is populated by the interaction layer, so the DOM event a gesture
  came from is reachable from the handler and `preventDefault()`
  suppresses the *browser's* default through it — and that is the whole
  contract.  Nothing in `src` reads `isDefaultPrevented()`: the call
  cannot stop a tap selecting or a grab starting, and gesture defaults
  are controlled exclusively by their explicit toggles
  (`autoungrabify`, `autounselectify`, `boxSelectionEnabled`,
  `userPanningEnabled`/`userZoomingEnabled`, and the per-element
  grains).  This spent two sittings as an open design question — round
  41 found the preventable-defaults list could not be derived from v3,
  which never reads the flag either, and a docs-first proposal
  (PLAN.md's "Round 41.5 docs-first" section) mapped every candidate
  default to its toggle — and the maintainer closed it by declining
  the whole table: the toggle map showed the toggles were already
  sufficient, so the proposal became the rationale for not building
  what it proposed.
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

  **The gestures apply v3's hit halos** (round 57.9,
  `findNearestElement`'s thresholds): a press or hover counts within
  8 rendered px of an edge's stroke for a mouse and 24 for touch, and
  nodes inflate by 2/8 the way v3 pads `outerWidth` — without them a
  default 3px edge is a ~3px target, which reads as "edges are too
  hard to click".  The halo rides the pick *frames*: the edge pick
  quads, their fragment test and the cull margins grow by
  `frame.pickPadPx` (zero in scene frames, so drawing is untouched
  — the exact goldens pin that), the CPU node pick takes a `padPx`,
  and the cached pick tile remembers the halo it was drawn with so a
  tile rendered for one pad never answers for another.  Arrowheads are
  hit targets too (round 57.10, closing the last of v3's
  `findNearestElement` surface): each head answers as its edge, its
  filled area counting regardless of `arrow-fill`, grown by the same
  halo.  `cy.pick` stays **exact** deliberately: the halo belongs to
  the gesture, not the API — exact still includes an arrowhead's
  interior, which is a place, not a halo.

  **Among edges the pick resolves nearest-wins** (round 105), as v3's
  `findNearestElement` does: each pick fragment writes its distance
  from its own centreline (an arrowhead its SDF distance, 0 inside) as
  depth into a tile-sized `depth32float` target tested `less-equal`, so
  the nearest stroke wins and a tie — coincident geometry — keeps the
  later draw, v3's topmost.  Before it the r32uint tile kept whichever
  grown stroke drew last, so inside a wide bundle (GeneMANIA's 20–30
  parallel edges), where several members' halos cover each point,
  pointing at one member's stroke near the bundle's ends answered a
  neighbour: 55 of 182 transect points on a 30-wide bundle disagreed
  with v3, one 0.49 px from the centreline of the edge it missed; now
  every probe off the analytic tolerance band agrees
  (`playwright-tests/bundles.spec.js`).  It also retires a draw-order
  artefact: straight edges drew before curved ones in the pick pass,
  so a curved edge beat a nearer straight one.  WebGL2 ports it as
  `gl_FragDepth` and a depth test — no storage writes, no atomics.
- **Extensions are direct objects — no registry.**  No
  `cytoscape.use`, no string registration, no global state: an
  extension layout is an import passed straight to
  `cy.layout({ impl, ...opts })` (or `eles.layout`) — a class or
  object implementing `{ run(ctx), stop?() }`, `run` optionally
  async (the GPU-layout shape).  The **LayoutContext** is
  columnar-first — `nodeSlots()` pre-filtered to unlocked leaves,
  live position/endpoint views, O(1) CSR degrees,
  `nodeDimensions()` (round 114.1 — the one reading of node boxes
  every built-in spaces by, labels on request),
  `components()`, bulk `setPositions`, the `layoutPositions( fn,
  overrides? )` finisher with the whole v3 plumbing and an impl's own
  defaults merged in, `finish( slots, xy, overrides? )` (114.2 — the
  one landing rule: the finisher when animate / animateFilter /
  transform / spacingFactor ask for it, the bulk write plus fit /
  zoom / pan otherwise — what flow and force land through), and
  `packComponents( spacing?, { bodies?, includeLabels?, positions? } )`
  (round 87.1 — v3 layout-utilities' `separateComponents` in one
  call, shelf-packing the laid-out components via `layout/pack.mts`;
  body boxes since 114.4, and `positions` packs the impl's own array
  so nothing lands before a tween starts) — with handles reachable at
  `ctx.eles`.  Lifecycle events fire on the core exactly once per
  run; layout instances stay non-emitters.

  Core/collection/renderer extension points
  stay out (recorded: mappers + predicates cover the common cases;
  revisit on demand).  A worked example (`SpiralLayout`,
  `debug/spiral-layout.js`, rewritten in 114.7 over exactly those
  members so it animates and avoids overlap) ships in `debug`
  (`?layout=spiral`), the module suite runs it headless, and the
  contract-conformance specs in `test/layout-contract.mjs` are the
  template external authors can crib.
  **The contract's types ship since round 45**: `LayoutContext`,
  `LayoutImpl` and `CustomLayout` are exported from the entry point, so
  `run( ctx )` has a real parameter type.  Until then only
  `CustomLayoutOptions` reached the declaration and `LayoutContext` was
  in none at all, so the one surface the contract exists to make obvious
  was the one an external author had to type by hand.

## Pointer cursors (round 89)

The canvas says what a gesture will do.  **v3 set no CSS cursor
anywhere** — not in `v3/src/`, not in v4's before this round — and left
the affordance to userland, where the standard recipe is a
`mouseover`/`mouseout` pair writing `container.style.cursor`.  v4's
canvas fills its container, so an inline *canvas* cursor overrides
exactly that recipe, and the whole design is shaped around not breaking
it.

- **The map is pure and lives in `src/interact/cursor.mts`**:
  `cursorFor( { gesture, hover, pointerType }, setting )` returns a CSS
  cursor keyword, and writes nothing.  That is what makes every cell of
  gesture x hover x pointer type assertable from Node, where there is no
  canvas — `test/pointer-cursors.mjs`.
- **The defaults**: `pointer` over any interactive element, `grab` over a
  node the drag predicate accepts, `grabbing` from the pointerdown of a
  pan or grab press (not from the tap-threshold flip — the feedback is
  immediate, and a tap restores within the click), `crosshair` for a
  box-selection press, and **`''` (inherit) idle over background**.  The
  last is deliberate and is the compat decision: a v4 instance with
  nothing to say leaves the app's own container cursor in force.
  `default` would be the compat-breaking spelling.
- **A press outranks hover.**  The gesture is decided once at
  pointerdown, so a drag that crosses another node keeps saying
  `grabbing` rather than flickering.
- **Touch never gets a cursor.**  There is nothing to show, and a
  keyword written for a finger would stick after it lifts.
- **An active drag mirrors onto `documentElement`.**  Drags run under
  `setPointerCapture`, which routes *events*, not the cursor: while the
  pointer is physically outside the canvas the browser shows whatever the
  element underneath declares.  The mirror saves the page's own root
  cursor and puts it back on every release path.
- **`pointerCursors`** (`boolean | Partial<CursorMap>`, default `true`,
  with a runtime `cy.pointerCursors()` beside its sibling toggles):
  `false` means the layer never touches `style.cursor`; an object
  overrides individual entries (`{ pan: 'move' }`), where `''` hands one
  state back to the app.  A runtime flip reaches the canvas immediately
  rather than at the next pointer event.  It is also the browser suite's
  own control — with the feature off, every positive assertion inverts.

**One deviation from the plan, deliberately.**  Round 89.1 enumerated the
seven transitions the writer should hook (`updateHover`, pointerdown,
pointerup/pointercancel, the three gesture-cancel paths, `destroy`).  The
writer instead runs from the **DOM-listener wrapper** — the same
`finally` that clears `originalEvent` (41.4) — plus `updateHover`, which
resolves asynchronously outside it, plus `destroy`.  That is a superset,
and the plan's own risk note is the reason to prefer it: *every*
gesture-end path must restore, and the ones where a sticky `grabbing`
hides are the cancel paths nobody enumerates correctly — pinch
degradation, the touch cxt split, the three-finger box, each of which
clears `this.down` in its own branch.  The cost is one string compare per
DOM event, against handlers that already pick and emit.

Recorded, not scheduled: a `cursor` **style property** in the sheet DSL
(`node.clickable { cursor: pointer }`) is the CSS-shaped end state and
needs a dictionary column and a contract change; the state map covers the
common cases without either.  A cxt-gesture cursor is cheap once the
writer exists and was skipped because v3 suppresses the browser menu and
no app expectation exists.  A `progress` cursor for long synchronous work
was **declined**: 87.2 removed the largest sync stall, and a cursor that
says "wait" is the wrong fix for work that should not block.

## The DX polish bundle (round 75)

Six small developer-experience items, each re-verified against the code
before it was built.

- **Container auto-resize (75.1, #2401).**  The renderer has observed its
  container with a `ResizeObserver` since the round-42 restructure — the
  observer arrived unrecorded, and no spec exercised it until this round.
  Its callback (`observedResize` in `src/render/renderer/lifecycle.mts`,
  mirrored on the worker proxy) re-measures through `resize()`, the path
  `cy.resize()` takes, and emits the core's `'resize'` event when the
  canvas's CSS box changed: once per real change, never for the initial
  observation, and not again for a change a manual `cy.resize()` already
  applied.  It cannot feed itself — `applySize` writes the canvas, which
  is absolutely positioned and never changes the container's box.  Two
  declines are recorded as decisions (the eleventh sitting confirmed
  both): **no option to turn the observer off** — the observer is the v4
  contract — and **no debounce**, since ResizeObserver already batches
  per frame and `applySize` is cheap.  `cy.resize()` stays for what an
  observer cannot see.  Pinned by the renderer project's "75.1" specs,
  with the disconnected observer as the control.
- **Web fonts, the edge cases (75.2, #3408).**  Round 10's `loadingdone`
  re-raster stays the main path, with three changes
  (`src/render/font-watch.mts` holds the pure halves,
  `src/render/renderer/fonts.mts` the wiring).  **It is filtered**: only
  a loaded face whose family the atlas's `font-family` list names
  re-rasters — normalized for case, whitespace and quotes, since
  Chromium reports the family quoted (`"Late Font"`) — so an icon font
  loading elsewhere on the page no longer re-lays every label; an event
  with no readable face list re-rasters as before.  **The atlas marks
  itself provisional** when it rasters a glyph while
  `document.fonts.check()` says the font is still loading, and a
  provisional atlas re-rasters when the font settles — checked on each
  rendered frame and, once per episode, on `document.fonts.ready`, so
  it lands on a page at rest too.  **The load-then-add order** —
  `face.load()` *before* `document.fonts.add( face )` — fires no event,
  and `check()` answers true for a family the set does not hold (both
  measured in Chromium), so nothing marks the atlas; the renderer
  watches the set's size instead, and on a rendered frame after it
  moves, a new *loaded* face the atlas names re-rasters.  **The
  residual is documented, not timed** (the eleventh sitting): a page
  fully at rest keeps the fallback glyphs of a face added after it
  loaded until anything redraws.  Add the face to `document.fonts`
  before loading it, and the event path covers it.  There is no public
  re-raster call: any redraw (a viewport nudge, a style write) runs
  the check.  Pinned by the four 75.2 browser specs — each failed its
  control (filter forced false: the round-10 late-font spec times out;
  filter forced true: the unrelated-font spec re-shapes; size watch
  off: the orphan spec; ready belt off: the at-rest spec) — and by
  `test/modules/font-watch.mjs`.
- **Iterable collections (75.3).**  `Collection.prototype[
  Symbol.iterator ]` yields the interned singleton handles off the
  cached dense array (`_arr()`), so `[ ...eles ][ 0 ] === eles[ 0 ]` and
  `for..of`, spread and `Array.from` see exactly what indexing and
  `forEach` see — including a member removed since, as its stale handle.
  The declaration says `Collection implements Iterable<Collection>`.
  `cy.add()` takes any iterable of definitions, read once with
  `Array.from` (`_definitionsOf` in `src/core/elements.mts`); the branch
  sits **after** the wire check because a typed-array view is iterable
  too, and it only takes non-array objects, so arrays, `{ nodes, edges
  }`, a single definition and the columnar form pass through as before
  and a bare string reaches the definition path's own errors.  One new
  throw, spec'd: `cy.add( collection )` — which iteration would
  otherwise have turned from a `TypeError` into a garbage add — names
  the v4 way (keep the definitions; v4 restores no removed element).
  `options.elements` is unchanged (it stays the JSON-shaped payload the
  options schema describes), and `cy.load()` keeps reading an iterable
  as *chunks*, not definitions.  The docs generator lists identifier
  members only, so the iterator ships as declaration hover text rather
  than an API-reference entry.
- **The public sync node pick (75.4, #1209): `cy.nodeAt( x, y )`, alias
  `cy.pickNode`** (the eleventh sitting's names).  The pick pair mirrors
  how interaction itself picks: pan-vs-grab must answer in the same
  microtask, and edges genuinely need the GPU tile — so `cy.nodeAt` is
  the CPU half (`pickNodeSync`, now on `RendererLike`) and `cy.pick` the
  whole leaf > edge > parent answer.  Exact like `cy.pick` (the 57.9
  halos stay the gesture's), nodes only, `Collection | null`.  **It
  computes headless** rather than answering null: `src/render/cpu-pick.mts`
  moved to `src/cpu-pick.mts`, below the renderer tier, with the
  renderer's default `hidePx`/`nodeLodPx` beside it (`renderer.mts`
  re-exports them), so the core runs the same scan from the store and
  the viewport at dpr 1 — the answer a default renderer gives at dpr 1.
  With a renderer mounted it is the renderer's own pick (its dpr and
  thresholds), which no longer waits for the device: the scan reads
  only the store and the viewport.  Specs: `test/node-at.mjs` (headless;
  its slanted-outline spec failed with the shape test swapped for the
  bounding box, the round-27 control) and the renderer project's 75.4
  spec (a hit, the topmost of an overlap agreeing with `cy.pick`, a
  mid-edge point that only `cy.pick` answers, background).
- **Wheel behaviour, scoped to two changes (75.5, #1905/#3287).**  Both
  inside the 41.5 settlement (options are the mechanism; the library
  only ever prevents default on events it consumes).  **The fix**: v4's
  `onWheel` called `preventDefault()` unconditionally, before the
  `userZoomingEnabled` check, so a zoom-disabled canvas swallowed page
  scroll; it now asks `wheelAction()` (`src/interact/pointer-handlers.mts`,
  pure and spec'd) first and leaves an inert wheel to the page — v3's
  contract.  **The option**: `wheelBehavior: 'zoom' | 'pan' |
  'modifier-zoom'` with its runtime accessor, `'zoom'` the default.
  `'pan'` pans by the wheel's delta (gated by `panningEnabled` and
  `userPanningEnabled`) and emits **`scrollpan`**, which joins the 17.4
  vocabulary (the eleventh sitting's call); `'modifier-zoom'` (the
  sitting's name, over `'ctrl-zoom'`) leaves the plain wheel to the page
  — the embedded-map idiom — and zooms on a ctrl or meta wheel.  A
  trackpad pinch arrives as a ctrl+wheel, so every mode keeps pinch-zoom.
  **Excluded, named**: a wheel-pan speed multiplier, axis swap or
  inversion, configurable modifier keys, touch remapping, any
  preventable-gesture mechanism (41.5, permanently), and a
  drag-from-element panning toggle — already expressible with the
  per-element `pannable`/`panify()`, `autoungrabify` and the default
  that a press on an undraggable node pans.  Specs: the accessor and the
  decision table in `test/interaction-options.mjs` (control: the
  pan/modifier branches swapped), the migration guide's claim in
  `test/modules/migration-guide.mjs`, and four renderer-project specs on
  a scrollable page (controls: `preventDefault()` moved back first fails
  the zoom-disabled, `'modifier-zoom'` and `'pan'` specs; the swapped
  branches fail the two mode specs).  The debug harness has a
  `wheelBehavior` select and logs `scrollpan`.
- **Viewport counts, async because the code says so (75.6, #2283):
  `cy.viewportCounts(): Promise<{ nodes, edges } | null>`.**  The
  visible counts exist only on the device — the cull's scan writes each
  group's `instanceCount` into its indirect draw args — so the answer is
  a readback (`src/render/renderer/counts.mts`).  The cull groups'
  indirect args gained `COPY_SRC` (valid under Dawn: the renderer
  project's validation-error listener stayed empty); a request copies the
  `instanceCount` word of the four element groups (node + parent,
  straight + curved edge — disjoint by their predicates) into one
  16-byte staging buffer after the scene cull pass, in the same
  submission, so the numbers are exactly that frame's, then maps it.  A
  group the frame did not dispatch (the parent stream once the last
  parent is gone) left stale args, so `CulledGroup.encodes` is compared
  across the pass and an undispatched group reads 0.  A clean scene gets
  a frame scheduled; concurrent requests coalesce onto one copy; destroy
  and a failed map resolve null; the worker proxy forwards the request
  to its engine (`counts` / `countsresult`).  **Headless it resolves
  null** (the eleventh sitting weighed null, zeros and a geometric
  count).  Glyph streams are excluded — their counts are glyphs, not
  labels.  The JSDoc names the sync alternative, `cy.elementsInBox()`
  over `cy.extent()`, and the difference: model-space geometry, no hide
  or LOD.  One cost to know: on a scene at rest a request draws one full
  frame (a counts-only frame, culling without drawing, is the cheaper
  path the plan named and was not needed).  Specs: exact counts on a
  scene with a compound parent and a curved edge, concurrent requests,
  the last parent flattened (stale args), half the graph panned out,
  `visibility: hidden` (with its edge), null on destroy — controls: the
  args read at offset 0 (`indexCount`) fail both count specs (7/3 read
  as 12/198), and every group treated as dispatched reads 8 nodes for 7
  — plus `test/viewport-counts.mjs` (headless null) and a worker-host
  spec.

## Design decisions (v4 API direction)

Decisions made for the v4 direction and reflected in this prototype;
each is deliberate, not a pass-1 deferral:

- **WebGPU is not required at 4.0: a WebGL2 renderer draws everything
  it draws (round 73, scoped; round 137, planned).**  Full parity at
  alpha, the eleventh sitting's call; today the package still requires
  WebGPU to mount a renderer, and this entry changes when round 137
  lands.  The feasibility record is round 73's file
  (`plan/rounds/2026-08-14-04-rnd0073-landed-the-webgl2-fallback-scoped.md`):
  per pipeline, what WebGL2 binds instead (data textures read with
  `texelFetch`, measured free against instanced attributes); the
  compute cull replaced by a vertex-stage collapse (+0.03–0.33 ms of GPU
  from 100k to 800k elements, no CPU walk); the edge pick through an
  `R32UI` tile, a PBO ring and a fence (no slower than WebGPU's); the
  GPU-only subsystems — mapper eval, tweens, force, the algorithm tier —
  on the CPU paths they already have; and the dated reach table the
  choice rests on.  Capability selection: `renderer.backend: 'auto'`
  takes WebGPU only on a non-fallback adapter that yields a device,
  else WebGL2 — which is also why the tween pipelines are **not warmed
  at init** (PLAN.md item 18, closed): no user is served a software
  WebGPU adapter.
- **Copying is priced, not assumed away (round 110).**  A copy is
  removed only when its measured cost clears an absolute gate (1 ms per
  frame sustained, or 5% of init) — never for a ratio.  The census
  section below carries the table; what it declined is written there
  with its number: adopting wire buffers as store backing (the copy is
  0.4% of init), a SharedArrayBuffer tier for the worker host (0.018
  ms per frame against a 1 ms trigger), and removing `png()`'s canvas
  hop (2.6 ms at 4k).  What it took: the export readback's
  per-pixel JavaScript loop, now a compute pass (81 → 12 ms at 4k).
- **Cancellation is a handle, not a signal (round 128).**  The
  promise an async algorithm returns carries `cancel()`, and a layout
  has `cancel()` beside `stop()` — rather than an `AbortSignal` option
  on every entry.  The handle is what a caller already holds, it
  composes with `destroy()` (the core keeps the runs in flight and
  cancels them last), and it lets each ending say what it reclaims:
  `stop()` keeps what stands, `cancel()` puts the nodes back where the
  run found them, and both close the lifecycle with `layoutstop`, the
  cancelled one carrying `cancelled: true`.  A `'cpu'` algorithm run
  cannot be cancelled and the handle says so (`cancel()` answers
  `false`) instead of pretending: the reference is synchronous by
  design, and chunking it for cancellability would cost the very
  speed it exists for.
- **No selector strings, anywhere.**  v4 drops the selector language
  outright — there is no parser, no dialect of v3 selectors, and no plan
  to grow one back.  The replacements, by role:
  - *Queries* (evaluate now → collection): structured **query objects**
    compiled to the matcher IR — `cy.nodes({ selected: true })`,
    `cy.filter({ group: 'edges' })`, `eles.filter({ selected: false })`,
    the **state booleans** (`selected`, `selectable`, `locked`,
    `grabbed`, `grabbable`, `active`, `hovered`, `emphasized`, plus the structural
    `parent`, `childless`, `child`, `orphan` — nodes only, and an
    explicitly-edges query with one of those throws), answered as pure
    flag scans, and data conditions over the sidecar columns (round 10):
    `cy.nodes({ data: { weight: { gt: 0.5 } } })` — one of
    `eq/ne/lt/lte/gt/gte/in` per key (a bare value means `eq`; keys AND
    together), sharing the `case` mapper's vocabulary and semantics
    (a missing value fails every op, `ne` included), answered inside
    the columnar scan with per-key readers hoisted out of the loop.

    Unknown query keys throw (a typo must not silently match-all), and
    the message lists the whole vocabulary — with no selector language
    behind it, that error *is* the discoverability surface.

    **The state keys come from the same table the `case` conditions
    compile from** (round 57.1f), so anything you can style on you can
    query for.  They were two hand-written lists until then and the query
    one was three entries shorter; a spec now walks the table through
    both compilations rather than sampling either.
  - *Predicates* (evaluate per element, lodash-style): plain functions —
    `cy.filter( ele => ele.data('weight') > 0.5 )`, and event delegation
    `cy.on('tap', ele => ele.isNode(), handler)` (predicates compare by
    function identity in `off()`, so removing a delegated handler takes
    the same `(events, predicate, handler)` triple).
  - *Id lookup*: `cy.$id(id)` / `getElementById` / `byId` (the O(1)
    id index; `byId` is round 64's brevity alias).
  - `cy.$()` **returned in round 64 as a plain alias of `filter()`**
    over the query/predicate forms above — in line with `cy.$id()` —
    after leaving with the selector language.  A selector string
    passed to it still throws, through filter's own rejection.  Set
    ops and `edgesWith`-style methods take collections, not selector
    strings.
  - `cy.collection()` takes **no arguments** and throws if given any
    (round 64, ledger item 28): v3 also built from a string/array/
    collection there, and the v3-shaped call used to return the empty
    collection silently — the one boundary where a typo did nothing.
    Build with `union()` over the accumulator, or query with
    `cy.$( query )`.
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
- **Each string vocabulary is spelled once** (round 127).  A column
  id is `COL.NODE_POSITION`, never `'node.position'`, anywhere under
  `src/` but the contract: `COL` in `src/contract.mts` is the one
  declaration, `ColumnId` is derived from it, and `COLUMN_SPECS` is
  written against it.  The three tween pseudo-columns (compound
  padding, the two label font-sizes) are `TWEEN_COL` beside
  `TweenColumn` in `animation.mts`.  The string values are unchanged —
  they are what crosses the worker wire and what the specs under
  `test/` spell out, deliberately, so a test still pins the value a
  constant resolves to.  The four reserved data keys are `DATA_ID`,
  `DATA_PARENT`, `DATA_SOURCE` and `DATA_TARGET` in the same file, and
  `EndKey` names the source/target pair; every `key === 'id'`-style
  test in the data, ingest, style and label paths reads them.  The
  group names are `GROUP_NODES` / `GROUP_EDGES` and `GroupName` is
  derived from them (127.6, on the maintainer's call — 718 sites, the
  largest of the four vocabularies); the public `group` field's type
  is that `GroupName`, so the shipped declaration now names the pair
  once too.  The
  style property names — all 173 the engine accepts — are `PROP` in
  `src/style-props.mts` (`PROP.BACKGROUND_COLOR`), keying the engine's
  switches, read sets, mapper channels, readers and defaults, the
  tween channel table and the collection's bulk-write list.  Property
  *values* (`'round-rectangle'`, `'match-line'`) are not in the table:
  the shape and arrow vocabularies already map through their id
  tables, and a value is what a user writes, not what the engine
  spells.  `test/modules/string-keys.mjs` holds the line: it scans
  `src/` for a column-id literal, a data-key comparison or a
  hyphenated property literal or a group-name literal outside its
  declaration, with a control per rule and the walk's size pinned.  The price: the minified bundle
  grew 1.0% (1.2% gzipped), since the minifier mangles `PROP` but not
  `.BACKGROUND_COLOR`; the round record has the numbers.  **Round 126
  took the price back** (PLAN.md item 63): `scripts/const-inline.mjs`
  runs before every bundle's minifier and rewrites `COL.X`, `PROP.X`
  and `TWEEN_COL.X` to their literals from the module's AST — the
  import followed through re-exports to the `as const` table it names,
  a shadowed name left alone, a missing member or a write a build
  error — so the source keeps the constant and the bundle ships the
  literal, and the tables themselves no longer ship.  1,520 sites in
  the full build; its minified ESM 8,908 bytes smaller and 3,428
  gzipped, more than round 127 recorded as the cost.  The scalar
  constants (`DATA_SOURCE`, `GROUP_NODES`) were already one mangled
  name each; rolldown's `inlineConst: 'all'` would inline them too, and
  was measured at +3.8 KB raw for −0.7 KB gzip, so it is not on.
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
  runtime what the build checks.

  The boundary is TypeScript's, and
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
  whole-scene comparator sort per frame.

  Edges into child nodes stay
  visible because parent bodies draw under all edges (the round-14
  stream split).  If real demand for raise-above-the-crowd styling
  ever appears, the logged extension is a single boolean elevated
  tier (one extra batch per group) — never arbitrary integer
  stacking.  Round 102 built exactly that tier, scoped to one
  purpose: while `cy.emphasize()` is set, the emphasized set draws in
  a second cull-and-draw above the dimmed rest (see "Transient
  emphasis").  It is not a styling prop, and it raises nothing else.
- **A locked node holds its place, everywhere** (round 114.3).  v3's
  rule, and what `locked()`'s doc always promised: a locked node — or
  every node under `cy.autolock( true )` — ignores `position()` /
  `positions()` / `shift()` writes and the position tween channel
  (style channels still animate), and every layout holds it where it
  is while keeping it in the structure it computes (grid and circle,
  which place by index, give it no cell; force pins it as an obstacle
  its settle separates the others from).  Until 114.3 only force and
  flow honoured the lock, through the contract's `nodeSlots()`; the
  store tier (`setPosition*`) stays raw for the renderer's settle, the
  wire and animation `apply`.  `cy.json()` exports the node's own
  flag, not autolock's.  A locked **child** stays when its compound
  parent is positioned, shifted or dragged — its own subtree with it —
  and the parent re-derives about the stayers and the movers rather
  than reading back the written position (116.3, v3's rule; until then
  `shiftSubtree` moved every descendant raw).
- **A label dims with its element** (115.6).  v3's effective label
  alpha is `opacity × text-opacity`; v4's label pass multiplied only
  `text-opacity`, so a node at `opacity: 0.15` drew a fully opaque
  label.  Node labels now read the `node.opacity` column on the GPU as
  bodies do; edge labels (at the storage-buffer budget) take the fold
  at style-write like edge lines, and the readers divide it back out.
- **Every layout avoids overlap in its own geometry, exactly** (rounds
  114 and 115).  `nodeDimensionsIncludeLabels` defaults to **false**
  again — v3's default; 114.1 had flipped it, and 115 flipped it back
  once a graph of long labels spaced by them turned out several times
  the size of the same graph spaced by its bodies (the maintainer's
  call: the fence was there for a reason).  The boxes come from one
  reading (`layout/dims.mts`); the spacing rule is exact per pair
  (`layout/separation.mts`: two boxes are clear once separated on
  either axis, so the distance a pair needs depends on the direction
  between them — 114's rules took the largest node's diagonal for every
  pair, which is what over-separated everything); and each
  layout's `avoidOverlap` (default true) is a constructive rule in its
  own terms — cell size, ring radius, rank separation, spiral pitch —
  except force, whose settle separates the point sim's result exactly
  (115; the crammed case 118.1) and whose sim can sweep the same
  boxes apart after every tick on request (`avoidOverlap: 'sim'` or
  `'both'`, 118.2 — opt-in because the settle's pass is cheaper for a
  one-shot run).  A generic push-apart remover was considered
  and declined: structure-blind, iterative, and a second meaning for
  the option.  Preset and random have no `avoidOverlap` — positions
  are the caller's, and a pushed-apart scatter is neither random nor
  uniform.
- **Style is `{ nodes, edges }`, no selector blocks and no style
  functions.**  Each key is a props object whose values are constants or
  mapper objects; all per-element variation is declarative (scales and
  `case` conditionals), so every value is analyzable, serializable, and
  GPU-evaluable.  The opaque `(ele) => props` form was removed — its
  cases are covered by mappers (`case` for conditionals, `data(id)` for
  identity), and state-dependent recolouring — v3's `:selected`,
  `:active` and the rest — is a **`case` condition on the state**, which
  is what v4 has instead of a state selector (round 57.1; see "State
  conditions" below).  Removed means
  **rejected**, since round 29.3: a group written as a function throws
  at `setSheet`.

  Until then it was silently *ignored*, so a v3
  stylesheet ported wholesale produced an unstyled graph and no error —
  the worst available failure mode for a decision this deliberate.
  Everything stays fresh
  automatically: a data write re-derives the affected mapped channels,
  gated on the mapped keys.
- **The CPU apply pass costs per *distinct value*, not per element,
  wherever it can** (round 66.1).  Two things make a mapped sheet's
  whole-graph apply cheaper, and both were priced on the harness's
  465k-edge fixture, whose one diverging edge-colour mapper was
  **354 ms** of a 1.36 s init:
  - a **per-value memo** on continuous/discrete evaluation over a numeric
    column.  Real data repeats — that fixture has 1,920 distinct values
    over 464,657 edges, its two commonest covering 43% of them — and a
    colour evaluation is a segment search, an OKLab lerp, `oklabToSrgb`
    and three `Math.pow`s, allocating four arrays.  Whether to memo is
    decided **once, from a 512-value sample of the column**, so the
    un-memoized path keeps calling the evaluator directly: an adaptive
    memo that gave up when it saw all-distinct data was measured and
    rejected, its wrapper alone costing ~5% on 200k distinct values.
  - the **state hoist**: a group denied the round-57.1 partition by one
    data mapper still evaluates its state-only `case` mappers once per
    distinct `flags & mask` rather than once per element.  At rest that
    word never changes, so a sheet's selection affordances cost one
    evaluation for the whole group.

  Together: that fixture's init **1364 → 1149 ms**, the harness page's
  first frame 2129 → 2022 ms (JSON) and 1914 → 1756 (wire), with every
  computed value identical.  The hoist is the larger half (~219 ms of
  the 215 measured together; the two overlap).
- **A run of edges that shares a styled record is written once and
  *filled*, not written per element** (round 67.2).  Round 67 measured
  the whole-graph apply and found the mappers were not the cost: with the
  edge branch of `writeChannels` reduced to its one mapped channel, a
  464,657-edge load ran in 470 ms against 483 for writing nothing at all
  — the other **687 ms of a 1170 ms init** was per-element writes of
  channels whose value is the same for every edge.  `store.setScalar` is
  26.4 ns, of which 15.8 is `column( id )`'s two string-keyed lookups;
  a `fill()` over the same run is 0.1 ns per element.

  So a contiguous edge run writes one template slot the ordinary way,
  fills every `EDGE_STYLE_COLUMNS` column from it (`copyWithin`
  doubling), and pays per slot only the mapped props — through the
  round-61 narrow writers — plus `writeEdgePerSlot` (the two flag bits,
  the invisibility cascade, the curve record, the label sidecar).  The
  route is admissible when every mapped prop either has a narrow writer,
  which by round 61's invariant writes *every* column that prop affects,
  or reads state flags only over a run whose masked word never changes —
  which is what a freshly loaded graph is, and what lets the sheets in
  `debug/` take it despite mapping `line-opacity`.

  **Nodes decline**, deliberately: their branch hands out per-slot blob
  records (custom polygons, images, charts) whose refs a copy would
  alias, and their labels are usually mapped, which the gate declines
  anyway.

  A state-only mapper is skipped **before** its writer is looked up, not
  after (round 67.2b): over a uniform run its value cannot leave the
  template's whether or not the prop has a writer, and the selection
  affordances are most of the mappers on an ordinary sheet — v4's default
  sheet alone contributes five to the edge def.  Checking the writer
  first cost 143 ms of a 498 ms apply, rewriting bytes the fill had
  already placed.

  Measured on ndex-x-large: headless init 1031 → **~665 ms**, the harness
  page's fetch-to-first-frame 1864 → **~1543**; on a synthetic 50k/150k
  graph, a minimal sheet ~370 → **~250** and a typical one ~445 → **~295**.
  `EDGE_PER_ELEMENT_COLUMNS` in `contract.mts` carries the whole safety
  argument — the three columns a shared record does not determine — and a
  spec fails until a newly added edge column is classified.
- **An unlabelled element pays nothing for a label** (round 67.2c).  The
  label record is ~15 colour folds, a closure and an anchor solve, and it
  was built even when the resolved text was empty — for a `setLabel(
  null )` that discards it on the first line.  An element whose main and
  both end-label (D4) texts are all empty now clears its three streams
  and returns.  Worth ~5% of a 464,657-edge load, where no edge carries a
  label; at the noise floor on a 50k/150k graph.
- **A bulk load marks curve derivations once, not per edge** (round
  67.1).  Every edge's style apply marks its endpoint pair pending,
  because in isolation any record change may re-fan a bundle; over a
  whole load that is 464,657 `Set` inserts (112 ms measured) deriving
  nothing that one pass over the finished pair map would not.
  `Core._bulkAdd` holds a window in which the marks are suppressed and
  `CurveIndex.endBulk` takes their union.  `cy.add()` gets no window:
  adding into a populated graph touches a small subset of the pairs.
  Measured: headless init 1223 → **1044 ms**.
- **Every mapper is cheaply CPU-evaluable — a load-bearing invariant.**
  It is what keeps `ele.style()` (and `numericStyle`/`renderedStyle`)
  *synchronous*, keeps headless mode and Node tests working (the same IR
  runs on CPU, on the GPU, and in tests), and keeps determinism.  Reads
  are **not** async: an async read would be viral across every call site,
  open reentrancy windows, and break headless/testability — all to
  answer a question the CPU can already answer from the IR in
  nanoseconds.

  GPU evaluation is an optimization layered over the
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
  `ordinal` (categories), `threshold` and `quantize` (bins).

  Colors
  interpolate in **OKLab** by default (`interpolate: 'srgb'` opts out)
  with named schemes (`viridis`/`plasma`/`magma`/`inferno`, ColorBrewer
  ramps, `category10`/`dark2`) and multi-stop ranges (pairwise when
  domain and range lengths match, evenly spread otherwise).

  Semantics:
  clamp by default; missing/unmappable data resolves to `fallback` else
  the channel default (never keep-previous — refresh is idempotent);
  `domain` omitted/'auto' is a **live extent** (Vega-Lite semantics):
  the data extent re-checks on writes of the mapped key and a moved
  extent re-derives the whole channel (log auto-extents use positive
  values only) — the O(n) case; an explicit `domain` keeps every data
  write O(changed elements), the round-24 performance contract (pin
  `domain` when a stream grows its own extent — see the transitions
  bullet).

  Refresh is dependency-gated per (group, key, channel);
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
  (`type == 'activation' → ...`).

  CPU-evaluated (multi-key,
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
  (`on( 'render', … )` + promises observe progress).

  The
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
  constants-only.

  A transition fires whenever a *restyle* changes
  an element's stored tweenable channel — sheet re-application,
  mapper re-evaluation on data writes (`case` flips, scale moves,
  auto-domain extent shifts), structural restyles (leaf↔parent
  flips) — under the *destination* sheet's config; an element's
  first style application on add is instant (v3's rule, kept by a
  per-slot styled-generation mark), batched writes capture one
  transition per net change at the outermost `endBatch`, and
  `show()`/`hide()`/`visibility` flips are non-triggers (fade is
  spelled with an `opacity` transition).

  Interruption is the
  round-21 rule uniformly: latest wins between transitions and user
  animations, both directions, capturing from the frozen mid-flight
  value.

  `transition-property` accepts **every** prop name of its
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
  state).

  Recorded consequences of stored-truth diffing:
  channel-opacity folds ride the color they fold into
  (`background-opacity` moves transition under
  `'background-color'`), and an edge-`opacity` transition carries
  the pre-folded arrow alphas along.  **The domain performance
  contract** (docs guidance, both modes supported): with an
  explicit `domain` a data write re-evaluates the written elements
  only — O(changed), never whole-channel — while `'auto'` pays the
  O(n) re-derive only when a write actually moves the live extent;
  pin `domain` when a stream grows its own extent.

  **GPU path
  (24.2)**: an all-paint transition offloads to the existing
  gpu-tween kernels (per-frame CPU ~zero; a border-width write
  keeps the whole preset on the CPU, the all-or-nothing rule), and
  a listed transition prop's *mapper eval* demotes to the CPU —
  the diff needs fresh stored bytes, so transitions and kernel
  ownership are mutually exclusive per channel while the tween
  itself still runs on-device.

  Measured
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
    over the mapper eval kernel.

    *Geometry* (`width`/`height`,
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
    `spring(bounce)`.

    The two evaluators mirror each other step for step
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
    runs (the mirror skips the CPU uploads of the slots it tweens — round
    144 made that per slot: the runtime keeps a count per slot, and a
    span still uploads the slots at zero, so a node outside a subset
    layout's tween, or one stopped out of it, draws where it is moved
    mid-flight; before, such a write was skipped and never re-uploaded),
    so the CPU column is stale
    during the animation — pick/extent/box selection for position,
    `style('background-color')` for paint.  **`position()` is the
    exception since round 144**: it reads the value the last frame drew
    (the tween evaluated at the manager's last tick), v3's answer and
    the CPU path's, so a per-node read agrees on every host; the column
    scans still read the start until the settle.  On completion *or* stop the
    CPU settles the value it reached and reclaims ownership; the settle's
    write dirties the column, which is already the mapper's re-evaluation
    trigger, so a mapped channel reclaims itself with no extra machinery.
    **Grabbing is forbidden while an element animates**
    (`pointer.canDrag` consults `isAnimating`), removing the two-way
    drag-feedback boundary.

    The renderer drives the frame clock while
    animations are active (the manager cedes its auto-loop).
  - **An animated layout's tween is one column animation** (round 144,
    PLAN.md item 68).  The finisher (`layoutPositions` under
    `animate: true`) builds `Animation.column`: every animated node's
    start and target in one position write — one capture, one CPU loop
    a tick, and one GPU registration and upload — where it built one
    animation per node, and at 20k nodes the same-thread host drew two
    frames in a one-second tween (each animation re-uploading its
    params every frame).  Its nodes stay individually addressable
    (`perRef`): `node.stop()` (and `jumpToEnd`), a new animation over
    the node's position, `lock()`, `cy.autolock( true )`, `remove()`
    and `cy.patch()` **detach** that node — it holds where it got to
    (or lands), both executors skip its entry (the CPU apply's `off`
    mask, the kernel through the sink's `detach`), the ref leaves the
    running set so `animated()` reads false and it can be grabbed —
    and the rest run on.  Every other multi-element animation keeps
    round 21's whole-animation rule for a stop or an eviction; a
    removal detaches from any animation, so a GPU batch never writes a
    slot the next `add()` reuses.  `layoutready` fires in `run()` and
    `layoutstop` when the tween ends, as before; the eight discrete
    built-ins gained `layout.stop()` (the tween stops where it stands,
    `layoutstop` fires on the spot, once, uncancelled — v3's), and a
    custom layout's `stop()` does the same once only its finisher tween
    is in flight.  Three defects the contract specs found on the way:
    a handle's `stop()` went round the manager, so a GPU-driven tween
    stopped by handle — `layout.cancel()` mid-tween on the same-thread
    host — left its batch registered and the column leased for good;
    `settleGpuAll` settled without releasing either; and a reparent
    mid-tween (14.11) now *demotes* the device's tweens to the CPU
    rather than settling them, so the tween runs on to its targets.
    Pinned in `test/layout-tween.mjs` on both executors (the CPU path
    and a mock sink).
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
    `panningEnabled` like any other.

    v3's override order is kept —
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
  device).

  Landed 25.1 — node `width`/`height`: two lanes of the size
  pair column via the `lane` write kind and the store's cascading
  `setLane` (`setPair` runs the cascade: outerHalf write-through, the
  monotone cull meters, **label re-anchor** — hoisted from the
  parent-materialize path, closing the raw-size-write staleness hole —
  and compound auto-bounds marking, so a child's size tween drives its
  parent's derived box per tick).

  Landed 25.2 — **edge `width`**: the
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
  props).

  The stroke lanes of the layer records are ×256 fixed-point;
  the store's `setLane` encodes on the way in.  Landed 25.4 —
  **compound `padding`**: the tween writes the *declared* padding (px,
  or the fraction under the '%' unit) through a new partial-merge
  `updateCompoundStyle` (a `{ padding }` tick must not reset the unit
  or min sizes — sheet writes keep their reset-what-you-omit
  semantics), the auto-bounds flush resolves it per tick (relative
  modes follow live), and parents-only is the mirror of the size
  rule: leaves are filtered at capture and re-checked per tick.

  The
  transition capture wraps the parents' compound-style write beside
  the channel funnel (the styled marks are read before the channel
  pass marks fresh slots, so instant-on-add holds for padding too),
  and a px↔% unit flip snaps — tweening across units has no meaning
  (recorded).

  Landed 25.5 —
  **`font-size`** (both label groups): the tween patches the label
  sidecar per tick through `setLabelFontSize` — no engine round trip
  (the `reanchorLabel` pattern); an edge's write drives all three of
  its streams (mid + end labels) and re-derives the fontSize-baked
  edge `anchorY` (−fs/2 + marginY); unlabelled elements are filtered
  at capture, and a transition diff with no sidecar entry on either
  side snaps (the −1 sentinel — a label added by a restyle has
  nothing to tween from).

  Wrapped labels re-break honestly per tick
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
  cached bb.

  The compound-loop excursion bound
  needs no new invalidation: auto-bounds read children's *outer*
  halves, so an ancestor's outerHalfW always dominates its
  descendants' and the bound (a max over both ends' stretches) can
  only change when the ancestor's own box changes — exactly the event
  `materializeParentGeom` already invalidates on (the containment
  argument, recorded in PLAN.md round 25).

  Recorded calls: `width`
  and `height` share the `node.size` eviction channel (a running width
  tween is evicted by a starting height tween); compound parents are
  skipped at capture *and* per tick (auto-bounds own their size —
  `padding` is the parent knob); lane writes are geometry-tier by
  construction and never register on the device (the runtime throws on
  the invariant).

  Costs (25.6, headless 200k-element ticks,
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
  the recorded expensive configuration).

  Browser pins (the `webgpu`
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
  unbounded).

  Staleness is admitted only where a value is already in
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
  inputs — never one side reading back the other's result.

  This is the
  same discipline already used for the OKLab LUT, mapper stop tables and
  easing curves, generalized to expensive computations; the cost is
  keeping the two impls bit-agreeable (divergence shows as bb-doesn't-
  match-pixels), which is the real gate on whether GPU is worth it per
  case.  Two consumer tiers keep it affordable: **cull/fit read a cheap
  conservative CPU over-approximation** (guaranteed to contain the true
  box — e.g. label: node size + charcount × max advance; bezier: endpoint
  hull + control-offset bound), while **public `.bb()` triggers the exact
  lazy CPU compute, memoized per element**.

  For bezier, control points
  are `f(positions, membership)`, so mid-position-tween they are stale via
  the lease (consistent) and settle when positions are reclaimed;
  bundle *membership* is a cheap CPU structural index rebuilt on
  add/remove edge, not per frame.
- **Labels are model-space only.**  `font-size` and the wrap width are
  both in model coordinates (v3 parity), and there is **no viewport-fixed
  label mode**.

  This is load-bearing three ways: (1) line breaking is
  then zoom-invariant (font-size and wrap width share a space), so label
  shaping — the expensive part — **memoizes** and the GPU metrics pass
  runs on text/font/wrap writes, not per frame (a *mixed* space would
  reflow on every zoom and defeat both the CPU memo and the GPU offload);
  (2) **image export is WYSIWYG** — a `full`/high-`scale` export is the
  screen arrangement at a different transform over *identical* shaping, so
  figures for scientific publishing don't reflow between screen and
  export, and the export path reuses the screen memo verbatim; (3) it
  matches v3, so existing figures reproduce.

  Screen-space labels were
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
  (JPEG has no alpha).

  Exports are encoded inside the frame loop after
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
  way.

  Per-element fonts would re-key the atlas by (font, char) and
  are out of scope.  Label-test reliability comes from pinning every
  variance source rather than tolerating any: the *font file* (a vendored
  OFL web font, Open Sans via devDependency, loaded with FontFace before
  instance creation), the *GPU* (the SwiftShader-pinned visual project),
  the *browser* (Playwright's, by version) — and the *platform*, which is
  the one a web font cannot pin, since Chrome rasters the atlas through
  CoreText on macOS and FreeType on Linux.

  Round 57.1e settled that last one the other way from how it started.
  Label goldens used to carry a looser diff bound for it, and the bound
  turned out to hide **six** goldens whose committed pixels no longer
  matched what the code drew — one by 1.597%, accumulated over a week of
  green runs.  The goldens are **exact** now, generated on Linux and
  gated on Linux, which is where CI runs them.  A maintainer on macOS
  will see the label scenes differ; that is the platform showing, not a
  regression, and the answer is to read the diff rather than to
  regenerate on the wrong platform or to widen the bound.  Per-platform
  goldens remain the reserve escape hatch if that becomes a real cost.

  Footgun, and
  why specs pre-load the font: the atlas rasters glyphs lazily and
  caches them forever, so a glyph rasterized before the web font
  finishes loading is cached from the fallback font — **but** (round
  10) the renderer listens for the font set's `loadingdone` event and
  re-rasters the atlas + rebuilds every glyph run when a web font
  finishes loading, so late-loading fonts self-correct.  Specs still
  pre-load to keep goldens deterministic.  Round 75.2 narrowed and
  belted it — see "The DX polish bundle (round 75)": only a face the
  atlas font names re-rasters, and the load-then-add order is caught on
  the next rendered frame.
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
  drags/layouts/position tweens on-GPU with zero rebuild.

  The flip
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
  `remove`-event handlers and predicates).

  This closes v3's
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
  insertion-order list has always used, and no new API.

  These
  reclaims move no element slots, so refs, draw order and the GPU
  mirrors are unaffected.

  Specifics: the id blob compacts live byte
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
  explicit, so no styling output can move).

  *Slot-moving* compaction
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
  design — and round 65 carried the same pattern to the graph
  algorithms, with CPU references as specs and per-family WGSL
  kernels behind the async `executor` contract.)
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
    though it renders straight — v3 semantics).

    The
    `store/curve-index.mts` bundle index derives `edge.curveParams`
    from the records: the pair map is built lazily on the first bezier
    record (a straight-only graph pays one loop check per edge add and
    nothing else), per-node loop lists are always maintained (loops
    render as loops under *every* curve style — a v4 deviation:
    v3 routes straight-styled loops through its unbundled path, v4
    always uses the bundled loop construction), and pending pairs
    re-derive lazily at takeDelta/boundingBox/accessor reads.

    Fit
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
    v3's **arrow** points — its `rs.arrowStartX/Y`, which sit the arrow
    shape's `spacing` behind the node boundary, not the drawn line's
    ends, which sit `gap` behind it.

    Round 55 corrected them from the
    node *centre* (off by a whole node radius on a straight edge) to the
    boundary; round 56 added `spacing`, non-zero for `tee` (1 px) and the
    two disc heads, and the renderer draws to the same point.
    `midpoint()` follows v3 per family, which on a **straight** edge is
    not the chord midpoint but `( startX + endX + arrowStartX +
    arrowEndX ) / 4` — the two shortenings cancel only when both ends
    carry the same head.

    Public
    `eles.boundingBox()` is the *exact lazy* tier of the
    expensive-geometry design: the flattened polyline at the drawn
    subdivision, memoized per edge against a store-wide geometry epoch
    (any geometry write invalidates every cached box — over-broad but
    sound); the cull kernels keep the conservative bounds, and the fit
    scan keeps them for the chord-bounded kinds only (the box-bounded
    kinds read this same memo since rounds 54/92).
  - *CPU costs (round 29.4, Node sweep, `benchmark/curves.mjs`,
    20k nodes / 40k bundled-bezier edges, every row against the
    straight graph of the same shape)*: **derivation is deferred to the
    first read**, which is the shape of every number here — a bulk
    `positions()` write is 0.97× (curves cost the *write* nothing), the
    first read after it 1.46×, the same read again 1.22×.

    The
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
    instance per edge as a strip of 32 quads (`CURVE_SEGS`; 24 until
    round 93.2 priced the raise on hardware) whose vertex shader
    evaluates the curve analytically from live positions + the params
    column (the WGSL twin of `curve-geometry.mts`), extruding along
    the curve normal at each vertex's own t so the strip is watertight
    without miter joints.  The VS binds exactly 7 columns + the
    visible list (the base 8-storage-buffer budget); line
    color/opacity/style fetch in the fragment stage, and dashes follow
    the curve's polyline arc length.

    The cull pass splits the edge
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
    `taxi-direction`, `taxi-turn` (px, negative = from the target, a
    percent string storing v3's fraction, or **`auto`** — round 124's
    track pass assigns it), `taxi-turn-min-distance`, `taxi-radius`,
    and (124) `taxi-track` (`source` | `target` | `family`) and
    `taxi-track-spacing`.

    All edge-only; scalars/enums are
    mapper-capable like the 12a props, **list props take constants
    only** (a mapper value is one number/keyword, not a list — a
    recorded scope note).  List constants accept arrays or v3's
    space-separated strings; lists read back as space-separated
    strings, percent turns as the percent string.

    Derivation is
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
    (hence the 8-control/11-point caps).  Since round 93 the quads
    distribute by **bend**, not uniformly: every piece keeps one
    mandatory quad (a straight leg needs exactly one) and the
    leftover splits proportionally to each piece's tangent turn — an
    arc piece by its sweep angle, a multibezier piece by the turn
    between its control legs — by cumulative floor
    (`allocRouteQuads` / `allocRouteQuadsW`), so a 90° round-taxi
    corner gets ~20 chords where the uniform split left it 3–8
    beside pixel-straight legs.  A no-bend route keeps the uniform
    split; the map is a pure function of the evaluated route
    (canonical per index — the watertight rule), built lazily on the
    CPU (the evaluators share scratch; `evalRoute` invalidates) and
    once per invocation on the GPU by the two entry points that
    subdivide.  The dash coordinate accumulates the same polyline's
    chord lengths, so dashes follow the map by construction — pinned
    by the arc-length spec in `test/curve-routes.mjs`; mid-arrows
    anchor through the analytic route midpoint and never read the
    map.  The 93.2 residual — a many-point round route (5+
    rounded corners is 11+ pieces) kept ~3 chords per arc even
    weighted, 0.384% v3 mismatch at zoom 3 with 5 points at radius
    20 — closed when the budget itself was priced on hardware
    (RX 580, round 93.2): CURVE_SEGS 24 → 32 takes that probe to
    0.003% while the 25k curved scene's device time stays under the
    frame budget (9.6 → 13.2 ms, wall on the vsync floor); 48
    measured 25.7 ms device / 33 ms wall (two vsync frames) for no
    measurable probe gain and was declined — the dash arc-length
    loop is O(CURVE_SEGS²) per edge, so the budget prices
    superlinearly.  Sharp corners join with a
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
    overdraw on the opt-in curved stream).

    Accessors:
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
    polylines).

    The edge-glyph cull grows its chord-midpoint test by
    the frame's curve slack for curved owners (its own 8-buffer
    budget precludes a params binding), plus the chord length for
    box-bounded owners; rotated curved labels cull against a
    frame-independent anchor-centred bound.
- **Parity triage (2026-07-29)** — decisions on the v3 leftovers from
  the gap analysis.

  *Dropped*: the canvas-era perf degradation
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
  selection box) as the styled defaults.  **Round 57.1 finished that
  sentence, and finished it more literally than it was written**: v3's
  `:selected`, `:parent:selected` and `:active` blocks are *rules in v4's
  default stylesheet* rather than anything a shader knows about, and the
  hover brighten — which v3 has no rule for — was deleted rather than
  given a default.  Nothing is baked in any more: every one of those
  affordances is a `case` mapper an app can restyle or drop.  *Deferred*:
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
re-lays-out every label; see the fonts design decision above).

Glyphs
come from a runtime SDF atlas (canvas-2D raster → Euclidean distance
transform → one r8 texture) and live in a persistent instance buffer keyed
by node slot — the label vertex shader reads the node position buffer, so
labels follow drags and layouts on-GPU with zero rebuild.  Labels fade out
below the `labelFadePx` LOD threshold.  The atlas is **zoom-tiered**
(round 94): the base tier rasters at 32 px per glyph, and when the
largest label in use would display taller than 40 device px the
settle-debounced meter re-rasters every glyph in use at 64 px into a
2048 atlas (one-way, ~250 ms after the viewport settles — the svg
image promotion's pattern, sharing its timer), because the fwidth AA
is scale-free but the letterform's baked raster error is not.
`stats().glyphAtlasTier` reports which tier is live.

**Text outlines draw under the ink, globally per frame (round 95).**
Glyph quads overlap by construction (each carries the SDF pad halo
past its ink), so a single fill+outline pass composited each glyph's
opaque outline ring over the previous letter's already-blended fill —
white notches cut into every outlined word.  v3 strokes the whole
line, then fills over it; v4 now specializes the label shader
(a `LABEL_PHASE` pipeline-overridable constant — same module, same
instances, no extra buffers) and encodes every stream's outline
coverage before every stream's fill.  Streams without an outlined
glyph skip the outline pass before any GPU work (a count the glyph
buffer maintains), so outline-free rendering encodes exactly the
passes it did before.  The recorded deviation: the split is global
across labels where v3's is per wrapped line, so where two *distinct*
labels overlap, v3 strokes the later label over the earlier one's ink
and v4 keeps all outline under all ink — both are unreadable there,
and within-word legibility is what the defect was about.  Text
background quads stay in the fill pass, under their own run, as v3
draws them under both.

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
orphan/edge targets emit flat exactly as before.

The remaining
order deviation is within-phase only: listeners registered on the
same element (or the core) fire in registration order.

Out of scope (deferred): string-formatting label mappers beyond the
passthrough, and the GPU tween fast path for *size* channels
(position and paint offload today; size is a geometry-tier project,
see the design decisions above).

**Compound nodes landed as round
14** (PLAN.md, "Round 14 plan — compound nodes", planned and landed
2026-07-31): parent/child hierarchy in the columnar store with
auto-sized parents materialized into the position/size columns,
parents-under-descendants draw order, ancestor-gated visibility +
rendered effective opacity, ported event bubbling, a `parents` sheet
group plus structural `case`/query conditions, compound loop edges,
and the layout/tween/interaction rules — each item its own
tests-first commit, with the design decisions and deviations
recorded in the round-14 paragraphs above and the summary bullet in
the deviations list below.

v3 compound surface *not* ported (the
usual one-name-per-concept and geometry-tier calls): the four
min-size bias props (the centered clamp instead; round 85.4 added
per-side padding props — `padding-left`/`-right`/`-top`/`-bottom`,
each px or 'N%' like `padding`, defaulting to the uniform value —
which cover the bias use cases without touching the clamp),
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
kernels can split the node draw without new bindings).

Cycle rule
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
element ref and ignored the selector argument).

`remove()`
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
mirror consume parent boxes with no special cases.

The derived box
is v3's `updateCompoundBounds` math: direct children's
border-inclusive extents (hidden children excluded — v3's
display:none rule), padding in px or % of the pre-clamp children bb
per `padding-relative-to`, the **centered** `min-width`/`min-height`
clamp (the four bias props are dropped by decided design — round
85.4's per-side padding props are the replacement: the clamp stays
centered, then each side's padding grows the box about it, the
centre shifting by half the imbalance), and a degenerate
fallback to the stashed style size at the stored position when no
shown children remain.

The stored size is the padded/drawn box:
`width()`/`height()` subtract the per-axis padding sums — 2·padding,
or left+right / top+bottom under 85.4's per-side props (v3's
autoWidth/autoHeight),
`paddedWidth`/`paddedHeight` return the drawn box, `outerWidth` adds
the border, and `padding()` answers the resolved padding.  Setting a
parent's position shifts its whole subtree by the delta (locked
children move too — v3), `shift()` skips elements whose ancestor is
also shifted (v3's dedupe), descendants moved by a parent's write
emit `position` (listener-gated), and `relativePosition` is
compound-relative (model minus the immediate parent's position).
A parent's label re-anchors when auto-bounds resize it (the store
inverts the engine's anchor bake from the sidecar entry).

A node
that stops being a parent returns to its stashed style size.

Round 14.4 (ancestor gating): `hide()` on a parent hides its whole
subtree.

The element's own state lives in a new `FLAG_SELF_HIDDEN`
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
group automatically.

The **compound props** live in the parents
group and are constants-only: `padding` (px, or `'N%'` of the
children bb per `padding-relative-to`: width | height | average |
min | max), `min-width`/`min-height` (the centered clamp), and
`compound-sizing-wrt-labels` (`'exclude'` by default or `'include'`,
implemented in round 82.1). With `'include'`, each visible direct
child's model-space label box joins that parent's sizing inputs before
padding; headless estimates update when the mounted renderer reports
exact metrics. Rotation is included, and zoom fading/decluttering do
not change geometry. A parent's own label never sizes itself. Compound
props throw outside the parents group.

Readback answers from the per-parent record
(`style('padding')` returns the declared px number or the percent
string; leaves read 0, as v3 leaves do).  v3's `:parent:selected`
tint **is** drawn since round 57.1 — its `#CCE1F9` fill and `#aec8e5`
border are `{ selected: true }` conditions in the default sheet's parents
block, exactly as the leaf rule is in its nodes block, so a user parents
block replaces them the way a v3 stylesheet does.  The live parity scene
reads **0 differing pixels** over selected leaves, a selected parent,
straight and curved selected edges and their arrowheads.

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
padding band picks the parent.

**Round 97.1 carried that draw order into the node-vs-edge combine:
`pick()` resolves leaf > edge > parent**, the reverse of what is
drawn.  Before it, any CPU node hit answered before the edge tile was
ever consulted, so a click on an edge crossing a parent's body
selected the parent the renderer had drawn *underneath* the edge — the
one place picking contradicted its own "what you see is what you pick"
contract.  A leaf still answers synchronously with no GPU work; a
*parent* hit is now held while the cached tile (then the GPU pass)
answers, and spends only over background, so the added latency lands
exactly on clicks and hovers inside parent bodies.  **Nesting depth
does not enter into it**: every parent draws in the same pre-edge
stream, so an inner parent is no more above an edge than an outer one,
and among parents the deepest still wins.  The press seat carries the
same rule (`src/interact/pointer.mts`): a parent grab is *provisional*
— it starts immediately, so dragging a parent body keeps its
zero-latency feel — and is dropped, with the balancing `free`/`freeon`,
if the edge tier outranks it before the press moves; a release that has
not moved waits for that answer before it taps, which is what makes a
fast click select the edge rather than the parent under it.
Recorded deviation from v3: v3 orders these by `z-index` /
`z-compound-depth` (`zsort.mts` — compound depth first, edges under
nodes only *within* a depth) and its `findNearestElement` walks that
same z-sorted list, so a deeply nested v3 parent can beat a shallower
edge.  v4 dropped both properties on 2026-08-01, so the interleave has
no v4 spelling; the flat tier is the consequence.  Not ported with it:
v3's compound-only preference for an edge's *connected nodes* over the
edge itself (`coords.mts` — a softener for the same interleave).
Two residuals, deliberate: the **pan-vs-grab** decision and the
`taphold` target still read the synchronous nodes-only pick, so a
press-and-drag that starts on an edge inside a parent drags the parent
(the sync seat cannot see edges without the GPU tile — the same
recorded limit `dragHoverPick` carries).

Recorded deviations: parents are
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
that only the second reason can be in play.
**v4 keeps the tighter box, decided 2026-08-06, and the reason v3
has the pixel is worth knowing**: v3 caches elements as textures and
composites them through canvas2d, where antialiasing leaves the true
extent uncertain by about a pixel, so the margin is a rendering
allowance rather than geometry.  v4 has no per-element textures and
rasterizes the whole scene on the GPU, so it has nothing to allow
for — which is also why the gap never moved with the border.  The
consequence for parity: every ancestry-edge control point sits 1 px
from v3's, and that is correct rather than a defect.

Round 14.10 (compound loop edges): an edge between a node and its
own ancestor/descendant — or a self-loop on a parent — **routes
around the outside**, whatever its declared `curve-style` (v3's
default `edge:compound` block produces the same behavior; a
recorded rule like the forced self-loop construction).  The
construction is v3's `findCompoundLoopPoints` verbatim: two control
points off the endpoints' min top-left corner, stretched by
`max(0.5, ln(outerWidth × 0.01))` per end, drawn as two
C1-continuous quadratics through the control midpoint (the loop
pipeline).

Control points evaluate from live positions and outer
halves in both the WGSL and the CPU twin, so drags, layouts and
auto-bounds resizes follow on-GPU with zero re-derivation;
reparenting re-derives the moved subtree's incident edges, and a
leaf↔parent flip re-routes its self-loops.  Compound loops are
box-bounded for culling (`FLAG_CURVED_BOX`) with a derivation-time
excursion bound feeding `curveSlack()` (a 2× stretch margin —
stretch grows only logarithmically with node size, and parent
resizes refresh the bound; recorded).

**The fit box is *exact* for this kind** (round 92, 2026-08-28;
superseding round 54's directional conservative box, 2026-08-08,
and the chord-term correction preceding it, 2026-08-05): a
compound loop contributes the memoized exact curve bb
(`curveBBAt`, epoch-invalidated — the box the box-selection path
and public `.boundingBox()` already compute), in both CPU scan
sites (`GraphStore.boundingBox` and `Collection.boundingBoxAt`,
the latter via `curveBBAtPositions` at the hypothetical centres).
The history is three formulations, each measured on `debug/`'s
compound fixture (930 × 900): the pre-54 disc of `p2 + the global
nodeHalfMax` around both endpoint centres fit at zoom 0.607
(~1.8× over-framed); round 54's directional box — the union of
the two endpoints' outer boxes grown by the stored excursion
bound `p2` up and left only, keeping the full `p2` as the
curve-index's recorded 2× staleness cushion — fit at 0.822, and
the same round made the remaining box-bounded margins **per-edge**
and **taxi exact** via the memoized curve bb, because its
randomized soundness sweep caught a forced-direction taxi (a
`downward` route whose target sits above) overshooting any
node-half margin by its turn on the sweep's first run; round 92
retired the two conservative terms 54 had kept (the directional
`p2` box, the extrapolated-weight outer-half + chord margin)
because the cushion still over-framed 1.23× and — the half a zoom
number does not show — grew **up-left only**, so `fit`, which
centers the box it is given, sat every compound graph visibly
down-right (measured margins 194/30 left/right, 254/89
top/bottom).  Fit zoom now **1.077**, the exact box's own fit,
centered to the pixel; freshness of the exact tier is structural
rather than margin-based (every input the geometry reads —
positions, sizes/borders and materialized parent auto-bounds
through `outerHalf`, shapes, curve params, arrow trim — writes
through a `geoEpoch`-bumping path).  The warm scan is 4× faster
than 54's (a fresh memo answers without evaluating the curve —
20 µs vs 82 on the 100-parent benchmark fixture); the cold scan
(a geometry write per call) pays 154 → 204 µs there, on a fixture
built entirely of the two exact kinds, and a straight-edge
(ndex-shaped) scan is unmoved at ~35 µs.

Before those corrections the scan added the chord length here —
a term that belongs to the *weight-extrapolated* blob routes
sharing `FLAG_CURVED_BOX` — which made `fit()` draw every compound
graph with a related edge at a fraction of its size (measured:
1718 × 1572 against an exact 802 × 637).  The **cull** kernel
keeps its chord term and global maxima deliberately: over-inclusion
there costs efficiency, never correctness.  Deviation: v4 anchors the
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
modeled — a recorded fit-target approximation).

A position
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

## State conditions (round 57.1)

v3 expresses element state in *selectors* — `:selected`, `:active`,
`:locked`, `:grabbed` and about thirty more.  v4 has no selectors, so the
same thing is a **condition on a `case` mapper**, beside the data
conditions and round 14.7's structural `{ parent }` / `{ child }`:

```js
cytoscape({
  style: {
    nodes: {
      'background-color': {
        case: [{ when: { selected: true }, then: '#0169D9' }],
        else: '#999',
      },
      'border-width': {
        case: [{ when: { locked: true }, then: 4 }],
        else: 0,
      },
    },
  },
});
```

The vocabulary is `selected`, `selectable`, `locked`, `grabbed`,
`grabbable`, `active`, `hovered`, `emphasized` (round 102), plus the
structural `parent`, `child` and their v3-named negations `childless`
and `orphan`.  Every one takes
a boolean, so `{ selected: false }` is v3's `:unselected`, `{ grabbed:
false }` its `:free`, and so on — one key per state rather than v3's
pair.

Three properties of the design are worth stating, because each was a
choice:

- **A state condition is not tied to any property.**  It compiles to a
  reserved key (`'::active'`) that the style engine's value reader
  answers from the flags word, so it is evaluated wherever every other
  mapper is and writes the same computed record.  `{ when: { active:
  true } }` on `width` works exactly as it does on `background-color`,
  and the bounding box, the cull extent and the pick all follow.
- **The affordances v3 gives you for free are default rules, not engine
  behaviour.**  v4's default stylesheet carries v3's `:selected`,
  `:parent:selected` and `:active` blocks, spread *before* your own — so
  declaring `background-color` yourself replaces the selection colour
  along with it, which is precisely what happens in v3, where those
  blocks sit in the default sheet and any later block beats them.
  `overlay-opacity: 0` turns the press highlight off.
- **The default sheet costs nothing to apply — and a measured price per
  state change.**  A group whose mappers read only state flags has one
  computed record per distinct combination of the bits it reads — two
  for the default sheet at rest — so it is applied with a mask and a
  lookup rather than a program run per element.  A 150k-element load
  measures the same as an all-constant sheet; without it the default
  sheet cost about 6%.  One data-driven mapper in the group turns the
  fast path off, because the group is on the per-element path anyway.

  A state *flip* is cheap under it too, since round 61 took the
  headroom round 60.4 had logged: `onStateChange` routes through
  `StyleEngine.refreshState`, which resolves the old and new partition
  records (the old masked word is the new one with the flipped bit
  undone), diffs them once per flag pair — cached on the def beside
  the records — and writes **only the differing channels** through
  narrow writers factored out of `writeChannels`, so the fold math has
  one definition.  For the default sheet that is one colour write per
  selected node and five per selected edge: bulk select+unselect of a
  256-band measures 63.5 µs through the built bundle against 15.5 µs
  under a constant sheet (it was 541.9 µs through the general
  per-element refresh — the regression 60.4's comparison caught, now
  ~8.5× *faster* than v3 on that row again).  A diff touching a
  channel with cross-channel consequences — geometry (bb/cull/pick,
  label anchors), labels, charts, the edge-opacity fold cluster —
  falls back to the full per-slot `write()` of the target record, as
  does a group with a live transition spec, an unpartitioned def or a
  demoted group, so a sheet conditioning `width` on `selected` still
  pays (and must pay) the full restyle.  `benchmark/style.mjs`'s
  select rows price all three configurations: no restyle, the round-61
  diff path, and the all-channels full write.

The same keys are **query** keys (round 57.1f): `cy.nodes( { locked: true } )`
answers what `{ when: { locked: true } }` styles, because `matcher.mts`
compiles from the same table.  Anything you can style on, you can search for.

Deliberately absent from the vocabulary, and why: `:compound` (its node
meaning is exactly `parent`, and its edge meaning — touching a parent —
is not a bit), `:loop` / `:simple` (source == target is a column compare,
not a flag), and `:visible` / `:hidden` / `:transparent` (computed *from*
style, so a rule conditioned on one would be circular).  `:animated`,
`:backgrounding`, `:removed` and `:inside` have no stable bit and no
obvious use in a sheet.

## Transient emphasis (round 102)

The hover highlight every graph app implements — emphasize the hovered
node's neighbourhood, dim everything else, restore on leave — as core
API, on the eleventh design sitting's call:

```js
cy.on('mouseover', (ele) => ele.isNode(), (e) =>
  cy.emphasize(e.target.closedNeighborhood()),
);
cy.on('mouseout', (ele) => ele.isNode(), () => cy.unemphasize());
```

`cy.emphasize( eles )` makes `eles` exactly the emphasized set (only
what enters or leaves is written) and turns the dim on;
`cy.unemphasize()` clears both; `eles.emphasized()` reads the bit.  The
look is split by what it costs:

- **The emphasized set is a state** — `FLAG_EMPHASIZED`, a
  `CONDITION_FLAGS` entry like `hovered`, so `{ when: { emphasized: true
  } }` styles it (a thicker border, an opaque edge) and `{ emphasized:
  true }` queries it.  A change restyles the set through the round-61
  diff path: O(set).
- **Everything else is dimmed by the renderer**, as one composite.
  While an emphasis is set every cull kernel runs twice — the first
  tier admits only elements *without* the bit, the second only elements
  *with* it (`emphasisKeeps` in the WGSL prelude, reading the owner's
  flags word) — and between the two draws a fullscreen veil composites
  the first tier at the core `dim-opacity` (default 0.15) over the
  cleared background (`src/render/emphasis-veil.mts` has the algebra: on
  screen it is a plain scale, in an export it re-mixes the `bg`).  The
  second tier gets a fresh depth attachment, so the emphasized set draws
  *above* the dimmed rest: an emphasized edge crossing a dimmed node is
  on top.  That is the single boolean elevated tier the no-z-index
  record logged, and nothing else uses it.

**Decided by measurement** (the plan's rule; `benchmark/emphasis.mjs`,
ndex-x-large — 19,607 nodes / 464,657 edges — through the built bundle,
i9-9900K, Node 24.18; per hover change, emphasize + restore, at a
degree-11 node / at the 733-degree hub):

| spelling | per hover change | upload |
| --- | --: | --: |
| app today: opacity bypass over the rest | 2,922 / 2,888 ms | 3.9 MB |
| app today: `hide()` the rest | 171 / 164 ms | 3.9 MB |
| (a) dim as a state bit over the rest (set, or derived) | 1,125 / 1,142 ms | 7.7 MB |
| (a) the neighbourhood's own records only | 0.05 / 2.7 ms | 4.7 / 7.2 MB |
| **(b) `cy.emphasize` (shipped)** | **0.015 / 0.42 ms** | 2.3 / 3.6 MB |
| (b) + a sheet styling `emphasized` | 0.14 / 4.3 ms | 5.4 / 8.2 MB |
| the query, `closedNeighborhood()` | 0.025 / 0.64 ms | — |

A dim that is a style — a bit on every non-emphasized element, or one
*derived* from "an emphasis is on" — rewrites every element's record on
the frame the emphasis turns on or off; at this scale that is 1.1 s
(the edge `opacity` has no narrow writer, so each edge takes the full
write) and no writer makes an O(V) toggle fit a frame.  So the dim is
the renderer's (b), and the half of (a) that is O(set) — the
emphasized state — stays in the sheet.  The query does not dominate,
so no slot-native neighbourhood walk was needed.  The upload column is
the dirty-span hull, which a scattered neighbourhood widens; it is the
flags column, 1.9 MB at most.  On the GPU (Chromium on the RX 580, the
debug page, hub emphasized) the second tier costs **0.64 ms per frame**
(6.54 → 7.18 ms median `gpuFrameMs`, 40 frames each); the frame
timer's reading spans both tiers, so the adaptive scale prices it.

The calls taken in the round:

- **Naming** — `emphasize` / `unemphasize` / `emphasized`, the plan's
  own spelling (American, as `neighborhood()`), over highlight and
  spotlight.  The core prop is `dim-opacity`.
- **`dimmed` is derived, never stored** — it is "an emphasis is set and
  this element is not in it", and it has no state key: a `{ when: {
  dimmed: true } }` rule would *be* the O(V) toggle the measurement
  ruled out.  `style()` on a dimmed element reads the element's own
  values; the composite is view, not truth.
- **Replace, not add.**  `cy.emphasize( eles )` replaces the set — the
  gesture is one call per hover change — and there is no additive
  `eles.emphasize()`: a second write path into one view state would
  make "what is emphasized" depend on call order.
- **An empty collection is an emphasis** (everything dims), and the
  emphasis stays set through removals and adds until `unemphasize()`;
  a new element is not emphasized.
- **"Dim unselected" is not a mode.**  The plan asked whether select
  gets the same treatment; it gets the same *API*:
  `cy.on('select unselect', () => cy.emphasize(cy.elements({ selected:
  true })))` is O(selection) per change.
- **View state** (the round-106 rule: a clone owns its view state):
  never serialized, never carried by `clone()` (the wire and the carried
  flags exclude it, as they do hover and selection), kept by `patch()` on
  survivors and never read from a payload.  `png()`/`jpg()` draw it as
  the screen does.  A worker renderer receives it as one more batch
  scalar (`emphasisDim`), beside the flags span.
- **Picking ignores it.**  A dimmed node still picks and hovers (so the
  pointer can move to it), and where an emphasized edge is raised over a
  dimmed node the node wins the pick — `pick()`'s documented structural
  order, left alone rather than made emphasis-dependent.
- `viewportCounts()` sums both tiers (the partition is exact).

Controls: `test/emphasis.mjs` counts the per-element work of a hover
change at two graph sizes ten times apart and asserts it equal (a
counted probe, not a timing — `node:test` runs files concurrently); the
control, the dim-bit spelling, grows 11.1× under the same probe.  In the
browser, `renderer.spec.js` asserts the pixels of both tiers (the veil
removed: the rest reads undimmed; the second tier removed: the raised
edge is gone; the export's `bg` ignored: the dimmed body reads
(0, 0, 38) where (217, 217, 255) is right), the
`emphasis-tiers` golden moves 11.4% when the dim opacity changes to 0.25
and 8.1% without the second tier, and the worker host's export matches
the same-thread one exactly (and differs from the plain scene — a
scalar that never crossed makes it fail).

Follow-up hooks, not built: a dim *colour* (the veil composites toward
the background; a tint would need a second constant); an `emphasize`
event; and a transition on the dim (it switches in one frame).  Round
104's label decluttering, logged here as the fourth, took it: the
emphasized set's labels claim their space first and fade last.

## Label decluttering (round 104)

At fit zoom on a large graph the label layer is soup — round 104's
census: ndex-x-large draws all 19,607 labels at fit with its
`min-zoomed-font-size` floor removed and 99.4% of them overlap another;
with the floor, 14,092 at 2× fit and every one overlaps — which is why
apps hide labels wholesale.  Two props address it, both v4 additions
with no v3 counterpart:

```js
style: {
  core: { 'label-declutter': 'cull' },           // default 'none'
  nodes: { 'label-priority': { data: 'score', fallback: 0 } },
}
```

- **`label-priority`** — a node prop, any number, mapper-able (a data
  score, a degree the app writes into data, or a constant per group).
  Higher ranks first.  It orders two things: the declutter's claims,
  and — the eleventh sitting's call — **the zoom fade**: a label's
  fade band is `labelFadePx` scaled by k = 1 + (1 − rank), rank in
  [0, 1] with ties sharing one (1 − the fraction of labels strictly
  above it), so as the zoom falls the lowest-ranked labels fade first,
  over [F, 2F] displayed px, and the top rank keeps today's [F/2, F].
  With no priority declared every label ranks top and draws exactly as
  before.
- **`label-declutter: cull`** — a core prop (default `none`: the
  sitting's call, off and opt-in).  A screen-space occupancy pass over
  the labels the GPU would draw, highest priority first: a label claims
  the cells of a 4 CSS px grid its rect covers, and a label that would
  land on a claimed cell is **culled** — hidden, never half-faded.

**Edge labels do not join, this round** (the plan's lean, taken): they
overlap worst, but their rects move with routing, and the edge glyph
cull is already at the eight-storage-buffer budget with no slot for the
gate.  `label-priority` is therefore node-only and the edges group
rejects it; node labels ignore edge labels when they claim.

**How the renderer does it** (`src/render/label-declutter.mts`, the
pass; `src/render/renderer/declutter.mts`, the frame glue).  The label
layer records, as it rebuilds each node label run, the label's rect
(`nodeLabelRect`: the laid block placed as the glyphs are, grown by the
outline or a visible background's padding, a rotated label's bound
turned about its anchor), its tallest glyph's LOD height, its
`min-zoomed-font-size` floor and its priority.  The pass writes one
f32 per node slot into a storage buffer — the **gate**: 0 culled, else
the label's fade scale k — which the glyph cull and the node label
shader read beside the glyph (one binding each; the gate is 1
everywhere until a pass writes otherwise, so an unprioritized,
undecluttered graph draws bit-identically, and every golden stayed
exact).  Three properties are designed in, each from the round's
measurement (`benchmark/label-declutter.mjs`):

- **The grid is anchored in model space**: cell edges at multiples of
  the cell size in model px from the origin.  Labels are model-space,
  so overlap itself is pan-invariant, and with the grid anchored too a
  pan re-decides nothing — a screen-anchored grid strobed 27,349 times
  over a 60-frame slow pan on ndex-x-large; this one, 0.  Zoom
  re-quantizes, which is the point: zoomed in, the cells are fine
  against the labels and more of them fit.
- **Membership is the pre-fade set.**  A candidate is a label the GPU
  would draw: its node shown, above its floor and `labelMinPx`, fade >
  0 on its own band, inside the viewport plus a 128 CSS px margin.  A
  half-faded candidate claims as a whole one; a label faded to nothing
  claims nothing.  The cull decides membership, the fade decides alpha.
  A label outside the decided region is undecided, and undecided never
  draws, so a stale gate cannot draw soup.
- **Hysteresis**, in two halves.  A label the last pass showed (an
  incumbent) keeps its claim until a challenger outranks it by 0.1 in
  rank, and tests its rect *inset by one cell* while stamping all of
  it, so a zoom's re-quantization cannot make two incumbents collide.
  The rank margin alone cut a slow zoom's strobes (a label flipping
  back) from 36,703 to 21,095; the inset to 439; both, 142 (em-web:
  227 → 0).  The price is a band: an incumbent may keep up to one cell
  of overlap before it yields.  A second pass at the same view is a
  fixed point.

The emphasized set (round 102) ranks above every priority and fades on
the top band — the hover's labels are the ones it is about.  Ties break
by slot.  The whole state is renderer-local by contract: never stored,
never serialized, never read back through the public API (a label's box
stays in `boundingBox()` and in a `text-events` pick either way).

**When it runs, and what it costs.**  Under `none` the gate is the fade
order alone, so a pass runs only when a node label run or a node flag
changes (O(labels), no grid).  Under `cull` it runs on every drawn frame
whose inputs changed — the viewport, a label, a node position or flag,
the mode — before the frame's culls read the gate; only the changed
span of the gate is uploaded.  Measured headless at 19,607 labels: 1.66
ms a pass, 0.05–0.2 ms on em-web; in the browser (Chromium, the dev UMD,
i9-9900K / RX 580) 1.6–2.0 ms median a frame through a pan on
ndex-x-large, 0.1 ms on em-web.  The sort the plan suspected is paid
only when a priority or the labelled set changes (3.8 ms at 19.6k); a
pass walks the prebuilt order and merges incumbents and challengers
linearly.  So the pass is CPU-only; a GPU variant was the plan's
fallback if this missed budget, and it did not.  Positions a GPU lease
owns (a position tween, a presenting force run) are stale on the CPU,
so through such a run the pass holds its last decision, and re-decides
on the frame the columns land.  An export declutters its own view (the
figure's region at the figure's LOD scale, on the screen's grid, seeded
with the screen's winners) so a `png()` of the viewport shows what the
screen shows and a full export extends the decision to the rest of the
graph; the screen's state is untouched.

The cell size is the measured knee: 8 px tripled the *false culls* (a
culled label touching no shown one) on ndex-x-large at fit, 992 →
2,853; 2 px halved them for 14% more time and four times the cells a
zoomed-in label stamps.

The debug page carries both knobs (Labels → *Declutter*, and *Label
priority: degree*, which writes each node's degree into its data before
load and maps it — `?network=ndex-x-large&declutter=true&labelPriority=degree`
is the soup, decluttered).

Follow-up hooks, not built: edge labels in the pass (a gate slot for
the edge glyph cull, and rects that follow routing); a per-element
opt-out (a label that neither claims nor yields); padding between
labels as a prop; and the census's other reading — at fit the page
sheets draw no labels at all, so what apps want there is the
top-ranked few, which the fade order gives only as far as the band
reaches.

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
  array.

  Decoding runs behind an injectable async rasterizer —
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
  and `-image-color` (the icon tint).

  Per-image lists distribute
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
  the whole pass skipped while no node styles an image.

  Unique
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
  palette.

  `background-image-type` itself is constants-only (a
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
  name), and the `./gpu` export carries a `types` condition (round
  131 removed `./gpu` and added two slim entries, each with its own
  declaration — see "Builds").  Over
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
  contract is a judgement.

  Round 31.1 is why this is worth gating —
  a stale doc comment shipped bad advice into every consumer's editor
  via `dist/cytoscape.d.ts`.
- **`@param` is enforced on the public tier, since round 32.**  This
  one is not about editors: docmaker's per-function shape carries a
  **description per argument** and has no return field at all, so a
  missing `@param` is a hole in the release documentation v4 will
  generate while a missing `@returns` is hover text.

  That is where
  the gate stops, deliberately.  143 of the 221 public members taking
  arguments documented them when the audit was written; round 32 took
  it to 221/221, and **round 36 found the audit had been walking class
  bodies only** — so the public tier's *exported functions*, which are
  the whole surface of `wire.mts` and `columnar.mts` and are public
  members by the script's own definition, sat outside a gate that read
  as complete.

  They are inside it now, at **232/232** — the 230th
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
  test coverage.

  The fifth design sitting (2026-08-04) took both
  calls, and this one ratchets: `auditReturnTags()` prints the tally
  under the coverage report, `--verbose` lists any miss, and
  `test/jsdoc-coverage.mjs` fails the build on a miss or on the
  tally falling below its ratchet (276 at round 36's completion, 279
  today).  The argument that moved it is that these
  comments ship as `.d.ts` hover text whether or not the docs
  generator reads them, and round 36's own history — a tail completed
  once, by hand, four rounds after it was measured — is what an
  ungated rule looks like.

  A
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
One rejection is not a failure: `CancelledError` (round 128) is what a
run rejects with when its caller — or `cy.destroy()` — cancelled it,
and a `.catch` tells it from a defect by `instanceof
cytoscape.CancelledError` or `error.name`.
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
- **Reading (2026-08-08, after round 38)**: **198 sites — 183 run by
  the Node suite**, **10 browser-only, 5 unreachable by design**, **0
  Node-reachable and never run**.  (Round 38's stroke-style guard is
  the 198th; the round-40 prep in PLAN.md classifies all 198 into
  contract vs recoverable tiers for the pending sitting.)

  The 2026-08-05 reading after round 48 was 197/182 with the same
  three classifications; round 36.4 read 191/176 with the
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
breadth pass over the remaining public members.

Two rules came out of
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
| `layouts.mjs` | every built-in layout, the force executor + the round-59 seed split, the round-17 contract (33.1, 60.2) |
| `style.mjs` | sheet compile/apply, the parents partition, the 57.1d state-condition partition + what a select restyles — no-restyle vs the round-61 diff path vs the all-channels full write, the readback getters (33.3, 60.2, 61) |
| `style-bundle.mjs` | the same getters **through the built bundle**, where tsx's `__name` wrapper does not exist (36.5) |
| `load.mjs` | the three ingest forms, conversion, export, incremental add (33.4) |
| `spatial.mjs` | CPU pick by shape + the 57.9 hit halo, box selection, bounds/fit (33.5, 60.2) |
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
`-- --render-only <results.json>` re-renders without re-running.

The two
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
always a run away): **quick 7.1 min, `--all` 18.2 min** (the latter
grew with round 65.9b's resurrection of style-bundle).  `--full` adds
the 2k/20k/200k matrix and is unmeasured — it is the profile nobody
runs casually, which is the point of keeping quick quick.

**As of round 62 (2026-08-10), every v3-comparative row reads
v4-faster** — that round's idle-box `--all` run carried 287 v3/gpu
pairs and its published run (`benchmark/published/`, the i9-9900K) had
zero v3-faster rows; round 65's re-measurement holds the property at
**270 all-profile pairs (plus 96 renderer pairs), still zero
v3-faster**, the count having grown with round 63's bypass rows and
style-bundle's return.  **Round 113's review (2026-09-01) found the
property had lapsed unmeasured** — the 13 Aug baseline carried two
pairs at or under parity and the review run one (`core: filter(fn)`,
0.96×, a predicate path that re-interned every element) — and restored
it: the verification run at `9ed49abc` reads **269 all-profile pairs
(geometric mean 10.7×, minimum 1.02×) plus 104 renderer pairs, zero
v3-faster**.  That was a goal, so say what it took: rounds 62.4–62.6
fixed 28 genuinely losing rows (the animation handle lifecycle, the
whole-object `data()` cache, per-raw-name style read plans, the
id → index map, the CSR-in-place traversal walk among them) — and then
found that the last handful of "losers" were the **harness measuring
itself**.  Two mechanisms, both now standing rules for `cmp()`-style
rows: a shared op closure samples the first-declared side against
monomorphic inline caches (fixed by pre-warm alternations before either
bench samples, 62.5c); and below ~10 ns a row sits at the harness
floor, where the pair's sign belongs to group-order sampling artifacts
— `pan() get` lost eight consecutive runs in-suite while per-process
monomorphic loops read v4 at 0.49 ns against v3's 1.96, so the row now
does 32 reads per op and is named `(x32)` for it.  A sub-floor row
that cannot discriminate is round 33's "guilty until shown to
discriminate" applied to the instrument rather than the subject.

**Reading the cross-commit comparison** (round 65.11, after tracing all
56 rows its four pages flag as regressions — none of them the library).
Three rules, each measured on the i9-9900K — and each **built into the
instrument by round 65.12**, so they are enforced now rather than
remembered:

- **±10% is inside this harness's repeatability on the v4 side.**
  Eight back-to-back `index.mjs` runs at one commit: 14 of 35 v4 rows
  span >10% across the eight, 8 span >20%.  The v3 rows span >10% just
  as often and **never** exceed 20% — proportional noise on ops that
  are ten to ten-thousand times larger.  Some rows are outright
  bistable: `mut: position set` read 47.6–69.3 ns over those eight in
  two clusters.  **65.12's answer**: `--repeat 3` publishes the median
  of three processes per row and records the band they spanned, which
  takes identical-code false flags from 28 of 245 row pairs to **0 of
  105**; the comparison screens each change against that band rather
  than against one global threshold.  Publish with `--repeat 3`.
  (The bistability had a cause as well as a treatment: `cmpMutEle`,
  `cmpMut` and `mutators.mjs`'s `cmpMut` never got round 62.5c's
  pre-warm.  With it, `mut: position set` measures a 2.7% band.)
- **One-shot rows (`samples = 1`) are not a regression signal.**  49
  of an all run's 791 rows are one-shot (curves 22, arrows 21, labels
  6), 17 of the 56 flagged regressions were among them, and the all
  profile's largest flag (+52%) was one measurement against one.  This
  is round 62.7's renderer rule, holding for the Node suites too —
  and since 65.12 the comparison **enforces** it: a one-shot mover is
  listed as unscreened, never ranked as a regression.
- **A step in the series can be the harness.**  Round 62.5c's pre-warm
  costs the **v4 side 12–35%** on rows that iterate — not the ~0.5–1
  ns/call its own commit estimated, because the shared closure's
  *inner* per-element site goes polymorphic as well, so the cost
  scales with elements touched.  Removing the alternations at HEAD
  returns `core: filter(fn)` to 261.8 µs against the 263.5 µs measured
  before 62.5c existed, and a per-commit probe in isolation shows the
  library flat or faster across all of round 62.  The pre-warm is
  right about the bias it removes; the problem was a published series
  crossing it with nothing recording the change.  **65.12's answer**:
  every job carries a hash of the harness that produced it
  (`benchmark/harness-id.mjs`), and a change across two hashes renders
  as `⋮ harness` instead of a percentage — the machine fingerprint's
  rule, applied to the instrument.

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
  ns.

  The five per-call closures were hoisted to module scope in the
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
- **`mutableElements()` — 121 µs → 20 ns** (round 34.2; the member was
  removed in round 90 — it was `elements()` by another name, and the
  memo lives on under that spelling): the three
  unfiltered collections (`elements`, `nodes`, `edges` with no query)
  are memoized.  Round 34.2 keyed the memo on a store *structure
  epoch* — a counter and not a count, so add-one-remove-one between
  two calls cannot read as unchanged; rounds 62.5b/62.6 made the store
  **push-invalidate** it instead (the one `bumpStructureEpoch()`
  funnel nulls the cache), so the hit is a single field load with no
  epoch compare — ~2.4 ns, past v3's own O(1) return.  Two calls with
  no structural change return the same object, which is the one
  visible consequence and is pinned by a spec.
- **`indexOf()` — 12.5 µs → 41 ns** (round 34.1), parity with v3: the
  lazily-built packed-key membership `Set` became a `Map` from key to
  first index, so the cache the set ops already build now carries the
  answer.  (Round 62.6 took it past parity — ~1.5× v3 — by letting one
  identity compare prove the argument same-instance before the full
  guard walk runs; the cross-instance throw is unchanged.)
- Whole-object `data()` read 6.3× v3 when round 34 measured it — the
  columnar rebuild-the-object cost, showing up exactly where the
  design predicted.  Round 62.4 closed it: the built object caches on
  the handle against the DataStore's write epoch (plus the synthesized
  fields' own inputs), so the no-write read is a pointer return again —
  a logged public-surface change (PLAN.md ledger 17b), since two calls
  with no write between them now return the same object.

**Round 35 — the readback dispatch table.**  `StyleEngine.readProp`
answered all 150 readable property labels from one switch of the same
size, which is a dispatch table written as control flow.  V8 does not
hash a string switch that large, so a property's cost depended on where
it sat in the file: moving `border-width`'s case (body untouched) from
sixth to last took it from 56 ns to 90 ns.  It is now a `Map` of 111
readers, and `readProp` is 60 lines.

The effect is a **flattening**
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
the spread is **two populations, not one**.

A colour-valued read builds
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
tier, which is the audit widening rather than coverage falling).

Like the stranded-doc-block check it reports and never
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
build).

Re-measure before believing a change in those two rows; the
round-29.5 comparison first read a 30% "improvement" there that was
nothing but the other mode.  The **`--layout` rows are noisier still**
(±25%, and for a structural reason — see the force-layout section), and
round 36.5 adds the obvious-in-hindsight caveat that applies to every
row here: **do not run anything else on the box.**  Its first `--layout`
run overlapped this repo's own test suite and was discarded.

**The one-shot CPU rows swing ±40–50% between runs of the same
binary** (round 62.7): `convert (toColumnarElements)`, `compact()`
one-shot, `export: png` and the `init` rows are each measured once
per run, so they sample a GC-noisy distribution — measured directly,
`compact()` read 19.7 then 30.7 ms on back-to-back runs of one scene
and one bundle, and a best-of-7 conversion A/B put HEAD and a
28-commit-older build within 0.3 ms of each other while single shots
spanned 13–23 ms.  The first renderer comparison page flagged exactly
these rows at +14–66% across a span where the frame rows drifted
+0.7%; the direct A/B exonerated the code.  Before attributing a
one-shot row's movement to a commit, reproduce it best-of on one
binary — the frame rows (121 frames per press) and pick p50s are the
regression signal here, not the one-shots.

**The `gpu device (peak slots)` row is not a regression signal either,
and nobody knows why yet** (round 65.12).  It flips between ~0.46 and
~1.17 ms with no relation to the commit — across published runs, and
in one process across scenes (five scenes at 0.46–0.47, three at
1.10–1.18) while its compacted twin holds 0.98 ms in every one.  Where
it reads 0.46 it is *faster than a pan over a tenth as many slots*,
which is backwards, so the suspicion is that the fast mode measures
fewer passes rather than less work: `GpuTimer.read` spans the earliest
begin to the latest end over whichever timestamp pairs are non-zero,
and a frame whose render pair came back zero would report the cull
pass alone.  Untested.  Round 65.11 first attributed the flip to the
benchmark's own sampler and 65.12 measured that away — the sampler was
already recording 120 of 121 frames.

It replays the interactions behind the
recorded renderer numbers on six scenes (seeded 25k×50k and 100k×300k
generators, ndex-x-large, a 25k×50k *curved* scene whose edges come
in bezier parallel pairs so every edge actually curves, a 25k×50k
*compound* scene with 1k parents, and a 25k×50k *images* scene with
icon-per-type url mappers), v3 canvas vs
v4 WebGPU: continuous-pan steady
state at fit-all / zoomed-in 20× / far-zoom (labels off and on),
hover-while-panning `pick()` latency, and one-shot init / columnar-init /
full-png-export timings.

Wall ms-per-rendered-frame is the comparison
metric (vsync-bound — both sides floor at the display refresh when
fast); `gpu (device)` table rows carry the GPU-pass time from
`timestamp-query`, the unbounded cost.  dpr 2, 1280×800, adaptive render
scale pinned to 1; `--scene <substr>` filters scenes, `--headed` debugs,
`--gpu-only` skips the v3 side (for the gpu-vs-gpu scenarios),
`--layout` swaps the pan scenarios for the live force-layout mode (see
the round-18 section above; `--layout-uncapped` lifts its bounds).

The
gpu side also runs the round-19 **compaction scenario** on a fresh
instance last: the scene is cut to ~10% of its nodes through the store
(so the auto trigger doesn't compact the peak state it exists to
measure), panned at peak slot widths, compacted, and panned again —
wall and device ms per frame before/after, plus the in-page
`compact()` one-shot.  Read-heavy structure ops are where
v4 pulls ahead:
`degree`/`totalDegree` are O(1) off the adjacency index (~100–200× v3),
`components`/`add`+`remove` ~25–35×, set operations up to ~25×.

Collection
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
group); a flag write reaches the style engine at all only when some
`case` condition reads that state, so a sheet that declares its own
`background-color` makes selection free again — round 4's trade,
arriving from the other side once round 57.1 made the *default* sheet the
thing that reads the bit.  And it only emits when someone is listening.  `shift()` and constant `positions()`
are direct column arithmetic — no per-element handles or Position
objects.  At 200k nodes vs v3: select+unselect ~38×, lock ~96×, shift
~106×, hide+show ~1400× (v3 pays a style bypass per element), and
removing + re-adding a 256-node band with its incident edges ~1000×.
**The select figure is the skip-path number and no longer the
out-of-the-box one** (round 60.4): under the default stylesheet —
which conditions on `selected` since 57.1d — the same row measures the
per-slot restyle, and it read ~3× *slower* than v3 at 2k until round
61's `refreshState` diff path (resolve the old and new partition
records once, write only the channels that differ) took the
default-sheet configuration back to v4-faster;
`mutators.mjs`/`scenarios.mjs` price that configuration, and the
state-condition bullet in the styling section above carries the
mechanism.

Composed traces hold up too (`benchmark/scenarios.mjs`: five
interaction scenarios — explore/click-expand, select-all + fit, band
drag, remove/re-add, dashboard refresh — replayed **with core listeners
attached**, the axis the micro suites exclude since their emits are
listener-gated).  At 200k nodes the gpu side won every trace 6–530×
when round 5 measured it: a click-expand-select-fit interaction ran in
~45 µs median (34× v3), and per-element emit cost is ~85 ns/listener
call.  The select-bearing traces have since changed class under the
default stylesheet (round 60.4 measured select-all + fit at 3.6× v3 at
2k, from 35× — still a win, no longer that one); the suite re-runs, so
read the newest published run rather than this sentence.

The sweep also
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
`roots()` ~110×.

The ~2–5× is a structural ceiling rather than headroom:
v3 traversal is already O(degree) off per-element adjacency arrays, and
returning a v3-shaped collection costs a ref + interned handle per output
element on either side — unlike bulk writes, which touch columns and
return nothing.  Going further would mean lazy slot-backed collections
(an API-shape change, noted in PLAN.md under "needs a call").

The graph algorithms have their own sweep (`benchmark/algorithms.mjs`;
superlinear ops gate on `BENCH_N`): the slot-native walks win every op at
N=2000 — bfs ~34×, dfs ~39×, dijkstra+pathTo ~33×, tarjan SCC ~19×,
betweenness ~13× — while the dense-matrix ops (pageRank, floydWarshall,
markov/hierarchical/kMeans clustering) are CPU-parity with v3 as
expected, identical math dominating (within ±1.2× at N=500).  That
parity is exactly why round 65 gave the dense tier its GPU executor:
`npm run benchmark:algorithms-gpu` prices executor 'cpu' vs 'gpu' per
family per size on a real adapter (refusing SwiftShader).  After the
65.8 kernel-performance pass (workgroup-per-line occupancy, blocked
Floyd–Warshall, register-blocked matmul, uniform-flag early exits,
batched Brandes with device-side termination, and the shared
similarity-build fix), the round-65 bench machine (amd gcn-4)
measures markovClustering 70–663×, kMedoids 19–146×, fuzzyCMeans
30–70×, floydWarshall 3.4–28×, betweennessCentrality 4.1–18×, kMeans
8–25×, affinityPropagation 1.9–3.8× — the figures each wrapper's
'auto' threshold encodes.  **pageRank and hierarchicalClustering
route to the CPU under 'auto'** since 65.10: the CPU pageRank went
sparse (O(E + n) per iteration — 0.3–0.6 ms where the dense form took
30–124 ms, and still ~5× ahead of the GPU's dense mat-vec at
E = n²/12, because denser graphs converge in fewer power iterations),
and the flattened, typed hierarchical build took the CPU to a wash
with the GPU (0.92–1.03×).  Their kernels stay for an explicit
`executor: 'gpu'` and the parity suite.  Round 72.1 replaced the
dense mat-vec behind pageRank and Katz with a CSR SpMV (32 lanes per
row, O(E) bytes, one build shared by both executors) and re-measured:
an explicit `'gpu'` call fell 2–19× (69 → 3.7 ms at n=2048 sparse,
80.5 → 20.6 ms dense) but the verdict held, because the GPU call
floors at one ~3.5 ms `mapAsync` readback on this box while the sparse
CPU run is under 1 ms, and on dense graphs the shared O(E) build
dominates both sides (15.4 vs 20.6 ms at n=2048, E = n²/12).  The
crossover exists only past ~1M edges, so `'auto'` keeps `Infinity`
for both families, spelled once as `PAGE_RANK_GPU_MIN_N` and
`KATZ_GPU_MIN_N`.

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
with `cytoscape.toColumnarElements(json)`.

**The factory converts for you** (round 66): a definition-form
`options.elements` is turned into the columnar form and ingested through
that path, because convert-then-ingest is cheaper than the definition
loop — measured **1.2–1.8×** end to end, the spread being the payload's:
1.19–1.36× on synthetic graphs from 4k to 800k elements carrying data on
both groups, 1.50× on `benchmark/load.mjs`'s warmed N=2000 init row
(which took that row from 6.28× to 8.87× v3 on one machine), and
**1696 → 980 ms** on `benchmark:renderer`'s ndex-x-large scene (19.6k ×
465k, lean defs, auto-generated edge ids), taking that scene from 11.4×
to 19.0× v3.  The definition loop pays a
`Table.alloc` per element and two `IdIndex` lookups per edge, where the
columnar path takes one contiguous `allocBulk` run and resolves endpoints
by index; a CPU profile of a 50k/150k load put 159 ms of a 924 ms init in
`Table.alloc` alone and none in the columnar path, against ~85 ms for the
whole conversion.  Three things bound the route: it is the **bulk path
only** (`cy.add()` into a populated graph keeps the definition path,
since it may legitimately name nodes already in the graph); it applies
only to **self-contained** payloads, and a payload that is not falls back
to the definition path, which raises the error in its own words; and
`locked`/`grabbable`/`pannable` have **no columnar column**, so the
converter reports the defs that set them and the loader writes those
flags per element after the ingest.  That last one is also the caveat on
the public converter: `cytoscape.toColumnarElements(json)` drops those
three flags, and the factory does not use it for that reason.

There is also a **binary
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
JSON per present value.

  Compound hierarchy rides both forms (round
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

**Node references** (round 103) lift the self-contained rule where a
payload asks: `refs` lists the ids of nodes it indexes but does not carry
— an edge endpoint or a node parent at `nodes.count + i` names `refs[i]`
— and the ingest resolves each id once against the live id index (packed
bytes on the wire, no string decoded), however many edges index it.
They exist for chunks: 103.1 measured a chunked ndex-x-large load at
2.5–3.3× the monolithic one, nearly all of it the cut edges — which at
k ≥ 5 are 87–97% of the edges on that fixture's node order — travelling
as definitions through the per-element path, since a columnar endpoint
could only index its own payload.  The rules: an endpoint's reference
that names no node (or names an edge) throws **before anything is
added**; a parent's warns and orphans, as the definition path does; the
factory's `options.elements` starts empty, so a payload with references
cannot load there; `cy.patch()` refuses them (a patch payload is a whole
state).  `toColumnarElements( defs, { refs: true } )` builds them from
definitions, and the wire carries them as a trailing section (u32 count
+ packed ids) under a new flag bit, 2048 — the header is unchanged and
the version stays 4, by the eleventh sitting's rule for the format
(public but **experimental until 4.x**: sections are new flag bits, no
cross-version promise at 4.0).

## Progressive ingest: a first frame before the last byte (round 103)

`cy.load( source, { fit, padding } )` loads a graph chunk by chunk from an
async iterable — a streamed response, a server's pages, or a plain array
of chunks — and shows a correct partial graph before the last byte
arrives.  Decided at the eleventh sitting: the explicit method (not an
options-form iterable), `cy.ready` meaning **the first chunk drawn**, and
completion signalled separately — here, the returned promise.

The contract:

- **Chunks** are any input form.  A later chunk names an earlier chunk's
  nodes by id in the definition form, and through **node references**
  (`refs`, see "Loading") in the columnar and wire forms — so the order
  rule is the obvious one: a node before its edges and its children.
  Every chunk takes the bulk path: a definition chunk is converted with
  references (`buildColumnar( …, 'refs' )`), ingested columnar with one
  bulk style pass and no per-element handle; `add` fires per element only
  while someone listens, as the factory's bulk path does.
- **The renderer gets a turn between chunks** — one macrotask
  (`MessageChannel` in a page, a timer elsewhere), so a synchronous
  source cannot starve it — and **the second chunk is not asked for until
  the first is drawn**, so the first frame never waits on later chunks'
  ingest.
- **An initial load** — one that starts on an instance with no elements,
  the streamed counterpart of `options.elements` — holds `cy.ready` (and
  `isReady()`) until its first chunk is drawn (headless: until it is in
  the model), **fits the viewport once**, to the first chunk, and then
  holds it — never a re-fit per chunk, so the screen does not jump —
  and applies a wire chunk's graph-level `data()`.  A load into a
  populated graph is a streamed `cy.add()`: `cy.ready`, the viewport and
  `data()` are left alone, and `fit` defaults off.  The load re-points
  `cy.ready`, so read it after calling `load()`.
- **Events**: `loadstart`, `loadchunk` per chunk, `loadready` once the
  first chunk is drawn, `loadstop` when the load ends — completed,
  failed or cancelled (`event.cancelled`) — each with `event.progress`
  (`{ chunks, nodes, edges }` so far); `loadready` always precedes
  `loadstop`.
- **Completion** is the promise, resolving with the final progress and
  carrying `cancel()` (round 128's contract): cancelling stops pulling,
  closes the source's iterator, keeps what landed and rejects with
  `CancelledError`; `cy.destroy()` cancels a running load.  A chunk that
  fails rejects the load, the chunks before it stay, and a reference
  naming no node fails its chunk before anything of it is added.
- **Positions are the payload's** — the preset case both flagship apps
  stream.  A layout started while a load runs **throws** (the plan's
  recommended "refuse": it would lay out a moving target); run it once
  the promise resolves.  One load at a time per instance.
- **What is guaranteed**: every element drawn is correct — its data,
  style and position are the ones the finished load will have — and
  completeness arrives; the chunked end state is columns-equal to the
  monolithic load of the same payload (`test/load.mjs`, from every form
  and both chunk shapes, with its control).

**Measured** (i9-9900K, Node 24.18, AMD RX 580 via Chromium/Vulkan,
ndex-x-large with the harness's production sheet, 19,607 nodes /
464,657 edges).  Headless, through the built bundle
(`benchmark/progressive.mjs`, median of 3) — the baseline first, then
the round:

| | first chunk | total | vs monolithic |
|---|---:|---:|---:|
| monolithic, definitions / wire | 575 / 428 | 575 / 428 | 1 |
| 103.1: factory + `cy.add()` per chunk, k = 10, cut edges as definitions | 13 | 1,734–1,849 | 3.0–3.2× |
| `cy.load()`, k = 10, definition chunks | 13 | 671 | 1.21× (of 556) |
| `cy.load()`, k = 10, wire chunks with refs | 12 | 523 | 1.27× (of 413) |
| `cy.load()`, k = 100, wire chunks with refs | 2 | 665 | 1.61× |

In the browser, each scene in a fresh process, wire payloads cut in the
page before t0 (`benchmark/progressive-browser.mjs`, median of 5; the
link rows median of 3) — "first" is the first frame carrying elements,
"whole" the first frame of the whole graph:

| link | scene | first | whole |
|---|---|---:|---:|
| none | monolithic | 902 | 902 |
| none | nodes first, k = 10 | 515 | 1,122 |
| none | vertex-closed, k = 10 | 374 | 1,107 |
| 100 Mbit/s | monolithic | 1,960 | 1,960 |
| 100 Mbit/s | nodes first, k = 10 | 406 | 1,214 |
| 100 Mbit/s | vertex-closed, k = 10 | 110 | 1,210 |
| 20 Mbit/s | monolithic | 6,176 | 6,176 |
| 20 Mbit/s | nodes first, k = 10 | 470 | 5,928 |
| 20 Mbit/s | vertex-closed, k = 10 | 350 | 5,667 |

- **With the whole payload in hand** the first frame comes 1.8–2.4×
  sooner and the whole graph ~23% later: the ingest churn (~100 ms
  headless) plus nine partial frames.  **Over a link the load wins
  both**: at 100 Mbit/s the first frame is 4.8–18× sooner and the whole
  graph 38% sooner, because the ingest and the device's acquisition
  overlap the transfer; at 20 Mbit/s the first frame is 13–18× sooner.
  The nodes-first shape's final frame is **pixel-identical** to the
  monolithic load's (0 differing of 1,024,000).
- **Granularity**: a chunk costs ~1.5 ms of fixed overhead headless
  (k = 10 → 100 adds 142 ms at this size) plus a frame in a page; 5–20
  chunks is the useful range, and the first chunk small.  Node
  references cost bytes (each chunk repeats the ids its cut edges name:
  +6% vertex-closed and +12% nodes first at k = 10, +19% nodes first at
  k = 20) — which is why the 20 Mbit/s nodes-first load finishes only 4%
  ahead of the monolithic one.
- **Where the churn went**: the 103.1 baseline's 3× was the cut edges as
  definitions (0.9–1.5 s); references took it to 1.2–1.3×.  The curve
  index's per-edge pair marks (~100 ms at this size) are gone for later
  chunks — a chunk closes the round-67 bulk window over its own edges
  (`CurveIndex.endBulk( edgeSlots )`), marking nothing where no pair map
  exists, which is where a mark derives nothing.  The curve flush a frame
  runs is 7–13 ms.  **The renderer's reallocation cadence is not the
  cost**: the ×2 growth reallocates the column mirror 95 times over a
  nodes-first k = 10 load (38 for the monolithic one), and pre-sizing the
  store (`--reserve`, the probe) brought that to 38 and changed the
  total by nothing while making the first frame slower (654 against 289
  ms) — the first frame then uploads full-capacity buffers.  So there is
  no size hint.
- **First-frame pacing**: pulling chunks greedily put the first frame
  anywhere between 279 and 638 ms depending on k (it lands behind
  whichever chunk is being ingested when the device arrives); waiting for
  the first frame before the second chunk made it steady — nodes first
  501–518 ms at k = 5, 10 and 20, vertex-closed 101–409 ms — for the
  same total (−1% to +7%), and it is the rule now.

## Patch: an id-keyed reconcile of a fresh payload (round 107)

`cy.json( obj )` stays export-only by decided design — restoring a
*serialized session* needs the stored definitions the columnar model does
not keep.  **`cy.patch( payload, { mode } )` is a different thing**: the
payload is the next state of the *same* graph (the next query result, a
server's refresh), and the patch reconciles it into the live instance by
id — computes the adds, removes and updates, applies them as one batch,
and returns `{ added, removed, updated }`.  Everything attached to a
surviving element survives: selection, positions the payload does not
move, bypasses (id-keyed), running animations, listeners, scratch.  The
sheet, the viewport and graph-level `data()` are never touched (a wire
buffer's graph data is ignored, as `cy.add()` ignores it).

The rules, fixed at planning and decided at the eleventh sitting:

- **Mode**: `'reconcile'` (default) removes every live element the
  payload does not name; `'merge'` keeps it, and there a
  definition-form payload may name kept nodes as endpoints and parents.
- **Data** is *replaced* per element, not deep-merged: a key the payload
  element lacks is cleared.  Values compare structurally, so a fresh
  payload's objects equal to the stored ones are not a change.
- **Positions**: present in the payload → written; absent → kept.  A
  locked node (every node, under `autolock`) holds, as against
  `position()`, and a compound parent's position derives from its
  children, as at load.  No `keepPositions` option: the returned diff is
  the app's policy hook (sitting 11).
- **Parents** are structure, replaced like data: a survivor follows the
  payload's parent, and none means an orphan.  A survivor whose old
  parent is removed is detached first, so the cascade cannot take it.
- **Endpoints**: an edge whose source or target changed identity is a
  remove + add under its id — rewiring is not a patch.  An id that
  changed group is the same.  Both appear in `removed` *and* `added`.
- **Session state** — `selected`, `selectable`, `locked`, `grabbable`,
  `pannable` — is never read from the payload for a survivor, only for an
  added element, which loads exactly as `cy.add()` would load it.  (This
  is also round 106's "a clone owns its state".)
- **Events**: `remove`, `add`, `moveout` + `move`, `data` and `position`
  once per element, inside the batch, after every mutation has landed —
  a listener never sees a half-applied payload — then one core-level
  `patch` event carrying the diff as `event.diff` (sitting 11: the
  summary beside the per-element events).  An identity patch fires only
  the summary.  Round 139 brackets the whole as one transaction:
  `batchstart` first, `batchend` after `patch`.
- **Validation before mutation**: a repeated id, an edge naming no node,
  a column that does not fit its count, a corrupt packed id section, an
  unknown option or mode — all throw from the planner, with the graph
  untouched.

**One funnel with round 66's load path.**  `src/store/patch.mts` is the
planner: every input form arrives as the columnar form — the wire buffer
deserialized, its packed ids resolved through `IdMap.codeBytes` against
the probe table with no string decoded for a survivor (fresh ids are
checked for repeats in a scratch `IdMap` through `setBytes`, bytes in);
the definition form converted with the load path's own
`collectDataColumns`, plus *reference* entries for the endpoints and
parents a merge payload names without carrying.  Data compares **column
against store** — a payload value reader against the `DataStore`'s
per-key reader — with no per-element data object on either side.
`src/core/patch.mts` applies the plan: detach, remove (`remove()`'s
closure without its events, `_removeClosure`), add through the columnar
store path (added edges index a slot table of their own, so they may
join survivors), link parents, write, then announce.  The diff's
collections are built before the outermost `endBatch()`, which may
compact.

**Measured** (`benchmark/patch.mjs`, built headless bundle, i9-9900K,
Node 24.18, 100k elements — 25k nodes, 75k edges — median of 5; 10% of
surviving nodes change a mapped value, 1% of surviving edges rewire):

| overlap | recreate (defs) | recreate (wire) | app diff | patch (defs) | patch (columnar) | patch (wire) |
|---:|---:|---:|---:|---:|---:|---:|
| 90% | 209.9 | 167.4 | 265.6 | 124.3 | 86.5 | 96.2 |
| 80% | 299.4 | 236.5 | 314.4 | 173.2 | 139.2 | 145.2 |
| 70% | 206.4 | 161.2 | 369.2 | 222.0 | 194.2 | 197.9 |
| 60% | 313.2 | 258.1 | 433.0 | 283.8 | 252.3 | 259.0 |
| 50% | 206.9 | 168.1 | 498.4 | 335.3 | 308.5 | 310.6 |
| 10% | 301.5 | 230.2 | 777.7 | 564.5 | 535.2 | 522.2 |

(ms; the recreate rows are bimodal run to run — ~165 or ~240 ms from
the wire — which is GC placement, not the payload.)  The identity patch
— a payload equal to the state — costs **18–24 ms** at 100k, one scan.

- **At the 90% headline row a patch is 1.7–2.4× cheaper than
  destroy-and-recreate** and keeps every survivor's state, which
  recreate does not; the app-side diff over the public API is *slower
  than recreate at every overlap* (0.79× at 90%), which is why the
  reconcile belongs in the library.
- **The crossover is ~70% id overlap.**  At 70% the wire reload
  already matches a patch, and **below it recreating is cheaper — 1.8×
  at 50%, 2.3× at 10%**.  The patch's own work is small; what grows is
  per-element store removal and adds into a populated graph (the free
  list scatters slots, so the contiguous-run fast paths of a fresh load
  do not apply).  A low-overlap refresh that has no state worth keeping
  should reload.
- **Following another instance** — `follower.patch( master.serialize() )`
  after 1% of the master's nodes moved, the round-106 clone-sync burst:
  serialize 0.29 / 2.1 / 24 ms and patch 0.26 / 1.8 / 23 ms at 1k / 10k /
  100k elements.

**Controls** (`test/patch.mjs`): the identity patch from each form (empty
diff, zero element events, zero dirty spans, zero mapper spans) against
the same payload with one value perturbed; the listener census (each
event once, all inside the batch, the summary once after it) against a
no-op payload; end-state equivalence — patch A→B leaves every column a
fresh load of B has, id by id, endpoints as ids, selection masked — with
its control, a B with one value moved, which the comparison must reject.
Ten mutations of the implementation were run against the file; two
first stayed green (a source-only rewire and a compound parent written
after its children), and each gained the spec that now fails.

## Undo: the snapshot price (round 139, item 41)

v4 ships **no undo stack**; it ships the transaction events above
(`batchstart`/`batchend`) and this measurement, and whether core ever
ships a stack is the maintainer's call on these numbers (PLAN.md item
41 and the ledger line that follows it).  The design fork item 41
names: **snapshots** (simple, priced in memory and a per-transaction
copy) against an **inverse-operation log** (cheap per op, but every
mutating path must emit its inverse — a completeness obligation the
audits would have to learn).

**Measured** (`benchmark/undo-cost.mjs`, built headless bundle,
i9-9900K, Node 24.18, 100k elements — 25k nodes, 75k edges, round 107's
fixture under a mapped sheet with labels — median of 5, three runs;
the range is across the runs):

| | ms | bytes |
|---|---:|---:|
| snapshot: `cy.serialize()` | 26.9–27.4 | 3.07 MB |
| (v3-shaped: `JSON.stringify( eles.jsons() )`) | 107.7–110.3 | 21.2 MB |
| restore `cy.patch( snapshot )`: nothing changed | 19.9–20.3 | |
| … after one data value | 17.9–18.2 | |
| … after 1% of nodes moved | 17.6–19.2 | |
| … after 10% of nodes' data | 23.1–24.2 | |
| … after 1% of nodes removed (cascades re-added) | 27.8–30.9 | |
| restore by recreating the instance | 200.7–208.1 | |
| core floor: every store column + data column, `slice` | 6.2–6.5 | 17.2 MB |
| … written back, `set` | 1.8–2.0 | |
| … the model subset (positions, flags, endpoints, gen, data) | 0.7–1.1 | 2.57 MB |

Inverse log, per op, over the public API (2,000 ops in one batch):
recording `data()`'s old value costs nothing measurable (−0.4 to +0.2
µs on a 4.3–4.7 µs op — noise), `position()`'s 0.2 µs on 1.1 µs, and a
node `remove()`'s — which must capture the removed closure as
definitions, since v4 cannot restore a removed element — 14–15 µs on a
16 µs op.

What the numbers say:

- **The snapshot undo an app can write today works and is priced at
  ~27 ms per transaction and 3 MB per history step at 100k** —
  `cy.on( 'batchstart', () => stack.push( cy.serialize() ) )` and
  `cy.patch( stack.pop() )`.  The tax is paid at *every* transaction,
  one data value included, and it is 1.6 frames; a 50-step history is
  ~150 MB.  Restoring is 18–31 ms whatever the edit, because a patch
  scans the whole payload (its identity cost, round 107).  Fine for
  discrete editor actions at 100k, not for a transaction per pointer
  move, and linear in the graph (5.7 ms / 0.6 MB at 20k).
- **Core could make the snapshot ~25× cheaper to take, not to
  restore.**  The model columns copy in ~1 ms (2.57 MB), but that floor
  omits the id map, adjacency, hierarchy, blob pools, label sidecars and
  untyped data, and a restore must rebuild those, re-apply style and
  repair handles — work a patch already does in the 18–31 ms above.  A
  core snapshot stack would buy the take, not the undo.
- **The inverse log is orders of magnitude cheaper per transaction**
  — ten node removals record in ~150 µs, ten data writes in
  unmeasurable time, against the snapshot's 27 ms — and its cost is
  the completeness obligation, not time: every mutator (data,
  position, bypasses, classes, hierarchy moves, add, remove, the sheet)
  must record its inverse, and the per-element events cannot carry it today — they fire
  after the write, with no old value.  That is where "transaction hooks
  in the core" would have to go if core undo is wanted.

## N viewers, by cloning (round 106)

A second view of a graph is a **second instance**, not a second renderer
over one store: `cy.clone()` builds it over the serialize/ingest path and
round 107's `patch()` keeps it current.  Every instance keeps v4's
one-core / one-viewport / one-renderer invariant, so no "whose
viewport?" semantics enter the API, and each clone has its own sheet,
selection, hover, events and `png()`.  The shared-store alternative (N
renderers over one store) was measured and kept only as a fallback
design: it needed six drain-once channels made multi-reader, three
singleton leases (animation clock, image decoder, GPU column ownership)
made per-view, and the hover/grab/active flag bits split out of the
shared model — view-awareness seeping into channel after channel, the
Cytoscape desktop lesson in miniature.  The plan file records the
evaluation.

### Consumer cursors on the dirty stream (106.2)

The renderer's frame used to be the dirty stream's only reader, and the
drain is destructive: a second `takeDelta()` caller starves the frame or
is starved by it.  `GraphStore.registerConsumer()` hands out a
`DeltaConsumer` (`src/contract.mts`: `take` / `hasDirty` /
`onInvalidate` / `dispose`, plus `takeMapperSpans`) — the reconcile
trigger below is one, and round 47's devtools observer will be another.
The store's own `takeDelta()` / `hasDirty()` / `onInvalidate()` are the
**primary** cursor, never disposed, so no call site changed.

- **Drain-and-republish.**  `mark()` / `markResized()` / `touch()` are
  byte-identical: they write one live state, as with one consumer.
  Whichever consumer takes first drains it and folds it into every other
  consumer's pending buffer — the column spans in the tracker
  (`src/store/dirty.mts`), the four blob pools' ranges and the
  watched-key mapper spans in the store
  (`src/store/graph-store/consumers.mts`) — so the fan-out costs at the
  drain rate, not the mutation rate.  With no consumer registered the
  take is the one-consumer code it always was.
- **A late registrant starts full-sync**: both groups `resized`, every
  blob resized over its used length, a mapper span over each watched key.
- **Per-consumer wake.**  The microtask bail that skipped the frame when
  the delta had been taken synchronously is now per cursor: A draining
  synchronously skips A's wake and not B's, whose pending buffer now
  holds the state.
- **`StoreDelta.dataWritten`**: an element `data()` write to a key no
  mapper watches marks no column, so a mirror would miss it.
  `setData` reports it through `DirtyTracker.markData()`, which is a
  no-op while no consumer is registered (a data write costs what it
  did) and never reaches the primary.
- **`cy.destroy()` disposes every consumer**, so a mutation whose wake
  was already queued fires nothing afterwards.

Measured (`benchmark/store.mjs`, `BENCH_OP=dirty`, tsx, i9-9900K, Node
24.18, N = 2,000; before → after): `mark` 13.1–13.2 → 13.1–13.2 ns
contiguous and 18.1–18.5 → 18.0–18.1 ns scattered; the tracker's take
behind 64 marks 832–866 → 807–824 ns; the store-level drain behind 64
position writes, at one consumer, interleaved before/after over five
process pairs, 1.42 → 1.48 µs median (pairwise −11% to +4%: zero within
this row's run-to-run spread of 1.25–1.77 µs).  With a second consumer
registered the same drain plus its take is ~0.3–0.4 µs more.

Controls (`test/dirty-consumers.mjs`): two raw `takeDelta()` calls — the
second reader starves; two consumers at different cadences (every step,
every third step) each keeping a byte mirror of every `COLUMN_SPECS`
column and the curve blob from their own deltas over a seeded 400-step
mix (adds, moves, mapped and unwatched data writes, selection, removes,
compactions), which must equal the store's columns byte for byte — with
the mirror's own control (a span drained elsewhere must show); late
registration; the per-consumer wake, both directions; `dataWritten`;
the mapper fold.  Four mutations were run against the file (the
tracker's fold, the blob fold, the old global wake bail, the mapper
fold) and each fails a spec; the blob fold at first **stayed green**,
because a bundled-bezier fixture never writes the curve blob — the mix
now uses `segments` edges.  The soak tier's isolation suite adds dispose
mid-stream (the peer unaffected) and destroy with a live consumer (no
throw, no dangling callback — red with the destroy hook removed).

### `cy.clone( options )` and `follow` (106.3)

`cy.clone()` serializes this instance and builds a new one from the
buffer, **through the same entry** (`core._caps` into the factory's
`createCore`), so a clone of a `cytoscape/headless` instance has no
renderer either.  What each source form carries of an element, measured
by `test/clone.mjs`'s carriage spec rather than asserted:

| | ids, data, positions, parents, endpoints | `selected` / `selectable` | `locked` / `grabbable` / `pannable` | bypasses |
| --- | :-: | :-: | :-: | :-: |
| wire (`serialize()`) — the fast path | yes | yes | **no** | no (the sheet's) |
| `json()` element form — definition speed | yes | yes | yes | no (the sheet's) |
| `cy.clone()` | yes | yes | yes — copied slot for slot after the wire load | yes, in the carried sheet |

Beside the elements a clone carries graph `data()` (the wire), the sheet
as `style().json()` exports it (bypasses included, copied so the engines
share no object), the viewport (zoom, pan, limits), the gating flags and
every interaction setting a setter can change (read through the getters,
so a post-construction change is carried), and the construction options
minus `elements`, `container` and `layout`.  `options` overrides any of
it; a `style` replaces the whole sheet, bypasses included — the minimap
case.  Not carried, by design: scratch, listeners, running animations and
layouts, and the transient hover / active / grabbed bits.  A clone's
`options()` reads back the merged options without the buffer, so a clone
of a large graph does not retain its payload.

**`follow: true | { throttle }`** registers a consumer (106.2) on the
source and syncs by `patch( clone, source.serialize() )` — round 107's
loop, specced and priced there.  The rules:

- **A sync runs only after a change the payload carries**: the store's
  `structureEpoch` (adds, removes, compaction), `hierarchyEpoch` (new:
  every effective `setParent`), `positionEpoch` (new: every explicit
  position write, never a compound parent's derived bounds), an
  `edge.endpoints` span, a resize, or `dataWritten`.  A restyle, a
  bypass, a hover or a selection on the source costs the clone nothing.
  The epochs, not the position span, because a restyle that resizes a
  compound's children moves the parent's *derived* position and marks the
  same span a drag does — the first version keyed on the span and synced
  on a restyle, which the "owns its state" spec caught.
- **Throttle**: the wake is the consumer's microtask; a sync then waits
  `max( throttle, lastSyncCost )` after the previous one (default 50 ms),
  so a burst coalesces into one sync and following never takes more than
  half the main thread however large the graph.  `throttle: 0` syncs on
  the next macrotask.
- **The clone owns its state** — the replan's second call: patch never
  reads selection or flags for a survivor, so selection in one view is
  not selection in the other; linked brushing is app wiring.  An element
  a sync *adds* starts as a clone's elements start: the lock / grab / pan
  bits are copied from the source by id, since the wire lacks them.
- **Positions are the source's**: a sync writes through the clone's locks
  and `autolock` (an internal flag on the applier; `cy.patch()` itself
  still holds locked nodes) — a minimap is typically `autolock`ed and must
  still follow.  Compound parents stay derived.
- **Elements only**: the clone's sheet, viewport, bypasses and graph data
  are never synced, and its own element edits are reconciled away at the
  next sync.
- **Lifetime**: a follow link is on both cores' `_follows`; `destroy()` of
  either stops it (the timer cleared, the consumer disposed).

Controls (`test/clone.mjs`): equivalence — every element `json()` and
every `COLUMN_SPECS` column id by id — against a source changed after the
clone, which both comparisons reject; the carriage table; the follow of
adds, removes, moves, mapped and unwatched data writes, a reparent, a
rewire and a parent's removal, columns compared after each sync; the
state-ownership spec with its control (a data write does sync); lock
bypass; burst coalescing and the throttle; both destroy orders.  Eight
mutations were run against the file — no `positionEpoch`, no
`dataWritten`, no `hierarchyEpoch`, no relevance filter at all, no
carried flags on a sync's adds, no lock bypass, no destroy hook, no
one-shot flag carriage — and each fails at least one spec.

### Measured (106.4)

`benchmark/clone.mjs` (built headless bundle, i9-9900K, Node 24.18,
`--expose-gc`, median of 5; a mapped sheet with labels; each timed region
after a forced GC).  The follow burst is 1% of the nodes moved, timed
from the last write to the clone's `patch` event; "restyle syncs" is the
control — a sheet change on the source, which must cost the clone
nothing.  Memory is `heapUsed + arrayBuffers` after a forced GC, before
and after one clone:

| scale | elements | clone ms | serialize ms | load from wire ms | follow burst ms | restyle syncs | clone memory MB | wire MB |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1k | 1,000 | 4.6 | 0.4 | 3.7 | 2.3 | 0 | 0.5 | <0.1 |
| 10k | 10,000 | 30.4 | 2.5 | 20.6 | 8.0 | 0 | 4.4 | 0.3 |
| 100k | 100,000 | 248.4 | 25.2 | 184.4 | 50.9 | 0 | 49.8 | 3.0 |
| ndex-x-large shape (19.6k nodes, 465k edges) | 484,600 | 1,089 | 79.3 | 795 | 202.5 | 0 | 113.5 | 13.5 |

- **A clone is a serialize plus a load**: profiled through `src/` at the
  ndex shape, 85 ms + 1.17 s + **~20 ms** for the lock/grab/pan carry (two
  `slotsOrdered` walks).  The clone column runs above the sum of its halves
  by 7–300 ms run to run, and which of the three pays the most moved with
  the order they ran in (the serialize read 292 ms when it ran first) —
  GC placement at this heap size, not the clone's own work.
- **The duplicated memory, measured**: ~0.5 KB per element at 1k–100k
  (49.8 MB per 100k — nodes carry labels here), and **113.5 MB at the
  ndex-x-large shape**, against the plan's 80–90 MB computed from
  `COLUMN_SPECS` alone — the difference is what the columns do not count:
  the id index, adjacency, the data columns, the label sidecar and the
  style engine's per-slot state.
- **The follow burst**: ~2 / 8 / 51 / 203 ms at 1k / 10k / 100k / 485k.
  Round 107 priced the loop's two calls at 0.29 + 0.26, 2.1 + 1.8 and
  24 + 23 ms; the rest is the wake, the macrotask hop and the event.  With
  the throttle's `max( throttle, lastCost )` a minimap following a drag on
  a 100k graph refreshes every ~50–100 ms and holds at most half the
  main thread.
- **A restyle costs the follower nothing** at every scale (zero syncs).

### The minimap proof (106.5)

`debug/`'s View section has a **Minimap** box (`?minimap=true`):
`debug/minimap.js` clones the main view into a 240 × 180 container with
its own sheet (40 px dots, 4 px straight hairlines, no labels or arrows),
`follow`, `autolock`, `autoungrabify`, `autounselectify` and no user
pan, zoom or box selection; it refits on each `patch` event, draws
`cy.extent()` as a rectangle in its rendered px, and a tap centres the
main view there.  Driven on em-web (569 nodes, 6,899 edges) through the
harness's hardware adapter: the clone took 57 ms, moving 40 nodes on the
main view produced one sync (`~40`, nothing added or removed), and zooming
the main view moved only the rectangle.  The pure half is
`test/modules/minimap.mjs` (headless, against the library); the renderer
project's "a following clone renders its own sheet in its own container"
spec checks two live canvases on one page — the clone's lime node at its
own viewport, the main view's red one, the clone's node moving after a
move on the main view, and a selection that stays in the view it was made
in — and times out with the position trigger removed.

## Sheet replacement is a diff (round 133, item 67)

`cy.style( sheet )` replaces the stylesheet, and until round 133 it
re-applied the new one to every channel of every element — on
ndex-x-large (19,607 nodes, 464,657 edges) **250 ms and 59.6 MB of
dirty columns** for a sheet whose only change was one node
`background-color` constant.  An app that re-sends its whole sheet on
every edit — Cytoscape Web's style editor does — paid that per
keystroke.  The replace is now a **diff**: each group def (`nodes`,
`edges`, and the `parents` overlay) keeps a snapshot of the
declarations it compiled from, and a replace re-writes only the props
whose declaration differs, through the round-61 narrow channel writers
(`fastStateWriter` — fill, border, opacity, the layer records, line
and arrow colours).  Each slot's writers read its own resolved record
(the partition cache, the constants, or a per-slot mapper evaluation),
so a fold partner that is mapped — a data-driven `background-opacity`
beside a changed `background-color` — folds exactly as the full pass
folds it.  Behaviour is unchanged; this is a performance change.

**The contract is end-state equivalence**: after any sequence of
operations, the columns, the blob pools and every element's read-back
style equal what the whole-sheet pass leaves.  So everything that pass
re-derived for a reason other than the sheet's own text is kept:

- **A prop with no narrow writer** — geometry, labels, charts, images,
  the edge-opacity fold cluster, `width` — sends its def through the
  full pass (the other defs still diff: an edge `width` change leaves
  the nodes alone).
- **The bypass-clearing rule** of a sheet replace (round 63): the
  `bypasses` section is whole-replaced, so every slot bypassed under
  the old sheet *or* the new takes the full write — a cleared bypass
  returns its slot to the sheet, a new one merges.
- **Animated stored truth**: an animation writes columns directly, and
  the full pass overwrote its values; a group an animation has written
  since its last whole-group pass (`store.styleTouched`) takes the full
  pass.  A live `transition-*` spec on the def, an open transition
  capture and a demoted group do too.
- **Kernel-owned channels** have stale stored bytes (the GPU eval
  owns them), so they count as changed and re-derive on the CPU.
- **A live auto-domain extent** that moved since the columns were
  derived (an element holding the maximum was removed) counts its prop
  as changed.
- **A batch** accumulates every sheet set inside it: the diff is
  against the sheet the columns were derived under, not the previous
  call's, and an element restyled under an intermediate sheet is
  covered by the union.  The batch's additions take the full write and
  its deferred data refreshes still run after the diff (the whole-sheet
  pass used to subsume both).
- **A sheet object mutated in place** and set again diffs against the
  snapshot of what was installed, not against itself.

Measured through the built bundle on ndex-x-large, headless, 60
replaces per row (`benchmark/sheet-diff.mjs`, i9-9900K, Node 24.18):

| replace | ms per replace | dirty per replace |
| --- | --: | --: |
| the whole-sheet pass, before (any change) | 250 | 59.6 MB |
| the item's target: the one change by hand, `cy.nodes().style(...)` | 71 | 0.08 MB |
| **diff**: one node `background-color` constant | **1.5** | 0.08 MB |
| diff: an identical sheet | 0.06 | 0 |
| diff: a node colour constant ↔ `case` mapper | 2.5 | 0.08 MB |
| diff: one edge `line-color` constant (464,657 narrow writes) | 36 | 1.9 MB |
| diff: an edge `width` (no narrow writer — edges full, nodes skipped) | 235 | 59.5 MB |

In Chromium on the hardware adapter (`benchmark/copy-census.mjs`, the
round-110 restyle row: 60 replaces, one per frame), the same-thread
host uploaded **1.79 GB in 658 ms before and 2.4 MB in 0.6 ms after**,
and the 60 replaces took 12.0 s of wall clock before and 1.0 s — the
frame rate — after; the worker host posted 3.57 GB before and 4.7 MB
after.

`cy.style().update()` (re-snapshot the live extents) is still the
whole-sheet pass, and so is the first sheet an instance applies.  The
diff can be switched off per instance with the internal
`_styleEngine.sheetDiff = false`, which is what `test/sheet-diff.mjs`
compares it against: every narrow-writer prop, each clause above, and
sixty alternating replaces, with a control per clause recorded in the
round.

## Builds: the entries and what each carries (round 131)

The package ships **three entries**, each a single-file bundle with its
own declaration, each carrying exactly its tier of round 100.1's
capability ladder (**T0** headless core, **T1** + Web Workers, **T2** +
WebGPU, **T3** + DOM/canvas):

| Entry | Source | Tier | Carries | Minified ESM (raw / gzip) |
| --- | --- | --- | --- | --: |
| `cytoscape` | `src/index.mts` | T3 | everything: the renderer (same-thread or the worker host), the pointer, the GPU executors | 893,415 / 251,250 |
| `cytoscape/headless` | `src/headless.mts` | T0 + T1 | store, style, collections, the CPU algorithms, every layout, animation, the wire, the worker pool and the force sim worker | 525,271 / 161,782 |
| `cytoscape/headless-gpu` | `src/headless-gpu.mts` | T0 + T1 + T2 | headless, plus the WGSL algorithm kernels and a compute-only host for an explicit force `executor: 'gpu'` | 604,356 / 180,228 |

(Measured at landing, 2026-09-28; the full ESM was 890,212 at planning
— it now also carries the headless force host.)  The full entry ships
UMD, minified UMD, CJS, ESM and minified ESM; each slim entry ESM,
minified ESM and CJS — a script-tag consumer wants the full build.

**Entries, not annotations.**  Automatic slimming — a consumer's bundler
dropping the renderer because a headless app never mounts — is not
available to this API shape, and the reasons are structural, so nobody
need re-litigate them: the factory must reference the renderer to
honour `container` and `mount()`; `executor: 'auto'` probes
`navigator.gpu` at run time, so every kernel is reachable from every
algorithm call; and the prototype API (`cy.nodes().pageRank()`) retains
every method with its class.  Measured at planning: a headless-only app
bundled against the old single entry kept 877,780 of 890,212 bytes.  A
dynamic `import()` of the renderer on mount was declined: it makes the
package multi-chunk, breaking the single-file invariant the worker
spawn-from-own-URL relies on (74.2 / 86.3 / 129.3), and makes `mount()`
asynchronous.  Instead the tree is **shake-clean by structure**:

- **The capability seam** (`src/factory.mts`, `@internal`):
  `createCore(options, caps)` is the factory body every entry shares —
  the container guard, `new Core`, the bulk add, `options.layout`, and
  the attach path `mount()` reuses.  `CoreCaps` is `{ attach, gpu,
  forceHost, noRendererMessage }`, stored as `cy._caps`.  The composable
  factory (`cytoscape/core` plus capability modules) is **not exposed
  at alpha** (the eleventh design sitting); the mechanism is here so
  exposing it later is surface, types and docs, not a refactor.
- **The GPU registry** (`src/algorithms/gpu-registry.mts`, GPU-free):
  every async algorithm asks for its lane by key (`gpuCall('pageRank',
  coll, options)`), and the kernels are reached only through the
  `GpuRuntime` an entry registered (`gpu-lanes.mts`'s `GPU_RUNTIME`; the
  full and headless-gpu entries register it).  `runAlgo`'s signature is
  unchanged; `route()` asks the registry first.
- **The device tier's own directory** (`src/gpu/`): the force
  integrator, the `wgsl` tag, the WebGPU constants and the headless force
  host.  The types lower tiers need live in them — `ForceHostLike` in
  `layout/force-host.mts`, the glyph types in `label-types.mts`,
  `EDGE_PICK_BIT` in `contract.mts`.
- **The tier walk** (`test/modules/import-graph.mjs`) follows every
  import from each entry — type imports included, by design, so no type
  checker is in the loop — and fails if `cytoscape/headless` reaches
  anything under `render/`, `interact/`, `gpu/`, an `algo-gpu-*` kernel
  or `gpu-lanes.mts`, or `cytoscape/headless-gpu` anything under
  `render/` or `interact/`.

**Every edge is loud**, never a silent fallback:

- a slim build given a `container` throws `this build has no renderer —
  import 'cytoscape'` before any work (an ingest error never wins over
  it), and `cy.mount()` throws the same; `mount()`'s guard tells a bare
  `new Core` (the old "not created via the factory" message) from a
  slim build;
- on `cytoscape/headless` an explicit `executor: 'gpu'` — algorithm or
  force layout — rejects `this build has no GPU executors — import
  'cytoscape/headless-gpu' or 'cytoscape'` (the force error keeps its
  `executor 'gpu' needs the GPU integrator` prefix), and `'auto'` finds
  no GPU lane;
- on `cytoscape/headless-gpu` (and on an unmounted full-build instance)
  an explicit force `executor: 'gpu'` runs on the compute device, while
  a headless `'auto'` never reaches it — the GPU host is reached only by
  an explicit `'gpu'`.

**The headless GPU force host** (`src/gpu/headless-force-host.mts`)
drives `GpuForceRuntime` with no frame: encode into `silentTarget()` →
submit → `await device.queue.onSubmittedWorkDone()` →
`pollConvergence()` → `nextBatch`.  The await is what lets the
convergence map land (a synchronous loop would starve the displacement
copy behind `dispInFlight`, and a zero readback reads as converged — the
118/119 class of defect).  `nextBatch`'s `behind` is never true here, so
the batch grows until the price cap or `MAX_BATCH` holds it.  An infinite
run parks when `idle()`; `wakeForce()` restarts it; `finishForce()` sets
the `stopped` flag before `destroy()`; the core's compaction guard asks
the host's `active()` as it asks the renderer's `forceActive()`.

**Packaging.**  `exports["./headless"]` and `["./headless-gpu"]` (types
first), their `./dist/…` literal subpaths and `dist:copy` entries; the
`FILE` build filter is an exact key (`FILE=headless.esm`).  Three
single-input declaration configs (one config with three inputs would
emit shared chunks) finalized by `scripts/build-dts.mjs`, and **only**
`dist/cytoscape.d.ts` names the UMD global — two `export as namespace
cytoscape;` lines are a duplicate identifier for a consumer whose
program resolves both.  Each declaration stands alone, so each entry's
`Core` is its own type: a program mixing entries imports the types from
the entry it uses.  The slim factories take `HeadlessOptions`,
`CytoscapeOptions` minus the renderer- and pointer-only fields.

**`sideEffects: false` — true for consumers, false for our own build.**
Every module-evaluation effect (`SELF_URL`, `GLOBAL_WINDOW`, the GPU
registration, the style reader tables) is internal to the single-file
bundle an entry resolves to, so a consumer's bundler can only drop a
whole unused entry — measured: an app bundled by rolldown against the
packed layout reads style values correctly, and shakes the full ESM to
880,861 bytes and the headless to 516,436.  But rolldown reads the field
for *our* sources too, where `style.mts` imports its reader tables for
registration alone: honouring it dropped them and every style read came
back undefined.  So every bundle config sets `treeshake:
{ moduleSideEffects: () => true }` (the function form is what overrides
the package field; `true` does not), and a packaging spec pins it.
Do not "fix" either half.

**The gates.**  `test/modules/bundle-size.mjs`: each headless minified
artifact under a **1,000,000-raw-byte edge budget** (the maintainer's
stated Cloudflare Worker ceiling; the assertion names the budget, not
the vendor, because vendor limits move — Cloudflare's current published
limits were reported as 3 MB free / 10 MB paid, compressed), plus a raw
and gzip ratchet per slim artifact at landing + ~10% — the number that
does the work, since a tier leak adds tens of kilobytes at once.
`test/modules/isolate-smoke.mjs`: the headless minified ESM in a
WinterTC-shaped `node:vm` isolate (no `Worker`, `document`, `window`,
`process`, `navigator.gpu`, `URL.createObjectURL`), the cross-runtime
checks there, and `'auto'` shown to have run on the calling thread.
`npm run test:runtimes:workerd`: the same checks on Cloudflare's own
runtime (`workerd`, a devDependency), in CI's `ci-workerd` job.
`npm run test:runtimes:deno:gpu`: `cytoscape/headless-gpu` on Deno's
native WebGPU — wgpu, not Dawn — naming the adapter, `pageRank` GPU
against CPU within the parity bounds, an explicit `'gpu'` force run
settling; green at landing on Deno 2.9.6 with an RX 580 (RADV), a
`continue-on-error` step in `ci-deno`.  Deno's binding panics on a
zero-byte `writeBuffer`, which the spec makes a no-op, so the algorithm
uploads and the integrator never issue one.

## Packaging (round 44)

What ships, and what keeps the manifest honest.  The package is
`cytoscape@4`: `exports["."]` resolves `types` → `dist/cytoscape.d.ts`, `import`
→ `dist/cytoscape.esm.mjs`, `require` → `dist/cytoscape.cjs.js`, with
the legacy `main`/`module`/`types` fields carrying the same three and
`unpkg`/`jsdelivr` the minified UMD.  Round 131 added `./headless` and
`./headless-gpu` (each its own declaration, ESM and CJS — see "Builds:
the entries and what each carries") and removed `./gpu`, the deprecated
alias of the full entry that round 42.3 kept for v3's users: beside
`./headless-gpu` it read as "the GPU build" while resolving to
everything, and v4 is unreleased (the eleventh design sitting).  The tarball is those bundles, the
declaration, `src/` (source-map resolution, as v3 ships it), the README
and the licence, plus `MIGRATING.md` and `CHANGELOG.md`, and — since
round 79 — the JSON schemas under `schemas/`, exported by subpath
(`./schemas/*.json`, so `cytoscape/schemas/stylesheet.schema.json`
resolves; see "JSON schemas") — 287 files today, before a release build
populates `dist/`.

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
— and it imports `rolldown.config.mjs` rather than parsing it.

What it
checks: no development tree or repo document ships; every path the
manifest names is produced by a build script; `dist:copy` copies
exactly rolldown's outputs (eleven since round 131), both directions; `types` is the first
condition wherever it appears (TypeScript takes the first match, so a
later one is silently dead); `import`/`require`/`types` point at
`.mjs`/`.js`/`.d.ts`; the legacy fields agree with the `.` conditions;
`./gpu` is gone; each slim entry maps to its own declaration and
bundles; exactly one shipped declaration names the UMD global; and the
package declares `sideEffects: false` while its own build keeps every
source module (round 131); every schema ships and resolves through the
`./schemas/*.json` export (round 79 — with an `exports` map, a subpath
it does not name is unimportable however the file ships).  It
deliberately does not
check that the bundles *exist* — they do not until a release build
runs, and whether one ran is release-workflow business.

## Typed element data (round 140, item 45)

`cytoscape<NodeData, EdgeData>( … )` (and the two slim entries' factories)
types an instance by the application's node and edge data shapes:

```ts
interface Gene { weight: number; label: string }
interface Link { kind: 'activation' | 'inhibition' }

const cy = cytoscape<Gene, Link>({
  elements: { nodes: [{ data: { id: 'g', weight: 1, label: 'G' } }] },
  style: { nodes: { width: { data: 'weight', range: [10, 60] } } },
});

cy.nodes().data('weight'); // number | undefined
cy.nodes().connectedEdges().data('kind'); // 'activation' | 'inhibition' | undefined
cy.nodes().data('kind'); // error: not a node field
```

What the shapes reach:

- **`data()`** — four overloads (whole object, one key, key + value,
  patch) plus a first-class one (`'id'`, `'source'`, `'target'`,
  `'parent'`, read-only).  A read answers the field's type *or
  `undefined`*, since a read can miss (an empty collection), as `id()`
  already says.
- **Collections and handles** — `Collection<NodeData, EdgeData, Data>`
  knows its group: `nodes()`, `source()`, `children()`, `roots()` … read
  `NodeData`; `edges()`, `connectedEdges()`, `edgesWith()` … read
  `EdgeData`; set operations, `filter`, `first`, iteration and callbacks
  keep the collection's own shape; `neighborhood()`, `union()` of two
  groups and the other mixed results read the union, whose keys are the
  fields the two share — narrow with `nodes()`/`edges()` to read the
  rest.  A narrowed collection widens to the mixed one and to the plain
  `Collection`, so a helper typed against either takes it.
- **Events** — `Event<NodeData, EdgeData>`: the handler's `target`,
  `cy` and a `patch` event's `diff` carry the shapes; predicates and
  `promiseOn` too.
- **Payloads** — `add()`, `patch()` (and its `PatchDiff`), `load()`'s
  chunks, `clone()`'s options and the constructor's `elements`: a
  definition's `data` is the shape plus the first-class fields, so a
  misspelt or mistyped field is an excess-property error.
- **Field references** — a mapper's `data`, a `case` condition's `data`
  (per group: `nodes`/`parents` from `NodeData`, `edges` from
  `EdgeData`) and a query's `data` keys.

**The untyped rule.**  Every parameter defaults to `Untyped` (`any`,
meaning "no generic given"), and each position maps it back to its
pre-140 type, so the plain `Core` and `Collection` *are* the untyped
instantiations: `data()` reads `unknown`, any key is accepted, a mapper's
field is any string.  The existing type tests pass unchanged, and the new
`typescript/tests/typed-data.test-d.ts` asserts the untyped types by
*equality*.  The factory's `options` take `NoInfer`, so the generics are
never inferred from the elements — without that, a plain
`cytoscape({ elements })` typed itself from its first node (measured:
the untyped half of the type tests went red).  `NodeData` alone types the nodes and leaves
the edges' keys open (`EdgeData` defaults to `Record<string, unknown>`).
The one visible difference untyped is hover text: `cy.nodes()` shows
`Collection<any, any, any>`, which is the same type as `Collection`.

**Why the untyped test reads the instance, not the collection.**  A
class's type parameter measured through a conditional type's check
position is invariant, so testing `Data` for `any` inside `Collection`
made `const m: Collection<N, E> = cy.nodes()` an error through every
`data()` overload.  `IfTyped<NodeData, EdgeData, …>` tests the
instance's shapes, which a narrow and a wide collection share, and
`Data` appears only as `keyof Data`, `Data[K]` and `Partial<Data>`,
which measure covariant (`src/data-typing.mts`).  The same variance is
why a collection's own subset members (`filter`, `is`, `allAre`, the
traversal criteria) key their queries on both shapes rather than the
narrowed one; the core's `nodes( query )`/`edges( query )` key theirs
per group.

**Where it stops, and why.**
- *The columnar and wire payloads* stay untyped: an `ArrayBuffer`
  carries no type, and `ColumnarElements`' `data` columns are keyed at
  run time.  `toColumnarElements( defs )` accepts typed definitions.
- *The `'data(name)'` label string* — a style value is any string (a
  colour, a keyword), so its field cannot be checked; the `{ data }`
  mapper is the typed form.
- *A condition's value* (`eq`, `gt`, `in`) is not correlated with its
  field's type — it would need a distributive union over the shape's
  keys per condition, for little.
- *The algorithms and layouts* — their callbacks (`weight`, `attributes`,
  a layout's `sort`) and results (`pathTo()`, `components` of a search)
  take and return plain `Collection`s.  Typing them threads the generics
  through some thirty option and result types in `algorithms/` and
  `layout/` for callbacks whose element is almost always read by one
  key; deferred, not declined.  The clustering results
  (`kMeans`, `markovClustering`, …) are typed — node collections.
- *`json()`/`jsons()`* stay `Record<string, unknown>`: they are an
  export format.
- *`isNode()` does not narrow* — it answers for the first element, so a
  type predicate would lie about a mixed collection.

**Measured** (round 140, i9-9900K, TypeScript 7.0.2, non-incremental,
three runs): `tsc --noEmit` over `src/` 0.49 s / ~197 MB before, 0.50 s
/ ~209 MB after; the type tests 0.46 s / ~108 MB before, 0.48 s /
~119 MB after (with the new file).  `test/types-surface.mjs` gates the
roll-up: each of the three declarations must answer a typed
`data( key )` with the field's type and that overload's hover doc,
through the language service.

## JSON schemas (round 79, #3487)

v4 ships JSON Schema (draft 2020-12) documents for the formats it takes
as JSON, in the package under `schemas/`:

| Schema | Describes |
|---|---|
| `element.schema.json` | one element definition (`options.elements`, `cy.add()`, `cy.patch()`, a `cy.load()` chunk, `ele.json()`) |
| `elements.schema.json` | the `elements` input: an array, a `{ nodes, edges }` map, or one definition |
| `stylesheet.schema.json` | the v4 sheet: per group, every property the compiler accepts, and whether it takes a mapper |
| `layout-options.schema.json` | `cy.layout()` options: one branch per built-in, by `name`, plus the `impl` escape |
| `cytoscape-options.schema.json` | the factory's options (and `cy.json()`'s export), composing the three above |

A consumer resolves them from the package — `import schema from
'cytoscape/schemas/stylesheet.schema.json' with { type: 'json' }` — and
validates with any draft 2020-12 validator; they reference each other by
relative filename, so a validator needs all five loaded.

**The contract.**  A schema pass means the document is *well-formed*:
the right keys, per group the property names the compiler knows,
mappers only where the channel takes them, keywords from the engine's
own sets, the number-or-string and percent forms.  It does **not** mean
the document loads.  What stays the library's job: whether a colour
string parses, a scheme name's case, whether a data key exists, a
mapper's domain against its scale, unique ids, endpoints and parents
that name real nodes, a `transition-property` listing the group's own
props.  The library's error is the answer there, and the schemas say so
in their own descriptions.  Where the runtime *ignores* unknown keys —
element definitions, mapper objects, layout options, the factory's
options (the fifth sitting's decision) — the schemas stay open; where it
throws — the sheet's keys, a group's property names, a bypass entry —
they are closed.  Where the runtime coerces a form the declaration does
not name (a string where the type says number, a numeric id), the
declaration is the contract and the schema follows it.

**Hand-written, and gated.**  The types are vacuous exactly where a
schema is valuable (`StyleProps` is `Record<string, StylePropValue>`),
so the schemas are hand-maintained documents rather than generated ones,
and `test/modules/schemas.mjs` holds them to the running library:
every debug network's elements, every sheet in `debug/styles.js`, every
layout run the harness makes and `cy.json()`'s output validate; paired
probes run one payload through the library and the schema and require
the same answer where the library is strict; property names are held to
the declaration through the TypeScript checker; and the stylesheet is
gated **both ways** against the style engine — every property the schema
enumerates compiles in its group with the examples it carries, and every
name in `PROP` (the engine's census) the schema leaves out of a group is
refused there by name.  **A round that adds a style property, a layout
option or a factory option must add it to the schema**, or that spec is
red.  The status site's schemas page shows each document beside the same
fixture run (`scripts/schemas.mjs`, shared).

**Decided at the eleventh sitting.**  The `$id` base is a placeholder —
`https://placeholder.invalid/cytoscape/schemas/`, `SCHEMA_BASE` in
`scripts/schemas.mjs`, the one place it is decided — until round 46 (the
documentation site) says where the schemas are served.  The validator
is ajv, a devDependency only: there is no runtime `cytoscape.validate()`,
which would drag a validator into the bundle.  The columnar form's
schema is held until 4.x with the wire format's experimental status (the
wire format is binary; no JSON Schema applies).  SchemaStore submission
waits for 4.0, once the schemas are stable; until then they version with
the package.

## Runtimes: Bun and Deno run the package (round 98)

**Supported runtimes: Node >= 24 (`engines`), Bun >= 1.4 and Deno >= 2.9
run the built bundles** — `engines` cannot express Bun or Deno, so their
floors live in this sentence and in `ci-bun`/`ci-deno`'s version matrix
(latest stable plus the pinned floor), and a runtime bump that breaks CI
moves the pin after reading the failure, never the assertion.  The claim
rests on two gates, not on fortune:

- **The runtime-clean invariant** (98.1): the set of non-relative import
  specifiers under `src/` is empty — no `node:*`, no `bun:*`, no
  `deno:*`, no bare package — asserted by
  `test/modules/import-graph.mjs` over comment-stripped sources.
  Everything the headless path needs (`TextEncoder`/`TextDecoder`,
  `queueMicrotask`, `performance.now()`, typed arrays) is in the
  WinterTC minimum-common-API baseline every standards-shaped runtime
  ships.
- **The cross-runtime smoke** (98.2): `test/runtimes/smoke.mjs`, one
  framework-free file run as `node`/`bun`/`deno run --allow-read`, loads
  the ESM, minified-ESM and CJS bundles and asserts values and ordering
  — headless init, the wire round-trip with every dictionary column
  checked value-for-value, style constants + a scale mapper + a bypass,
  grid + CPU-force ticks, one sync and one async algorithm with
  `executor: 'cpu'`, events, `json()` and the bypasses export.  Deno's
  require-compat held when measured (2.9.6), so the CJS bundle is
  contract on all three runtimes.  `npm run test:runtimes:node` /
  `:bun` / `:deno` each build first; the smoke found **zero defects**
  at landing (98.3's budget went unspent), which is what item 2 of the
  runtime-rounds note predicted — the headless path already spoke
  web-platform, and now both halves are gated rather than fortunate.

The renderer proper stays browser-bound (canvas + container).  Deno's
native WebGPU driving the GPU *algorithm* executors and the force
integrator is round 131's `test:runtimes:deno:gpu` on
`cytoscape/headless-gpu` (discharging 99.2); edge isolates are round
131's `cytoscape/headless`, gated in a `node:vm` isolate every run and on
`workerd` — see "Builds" above.  Every other environment, and what each
one gets, is the matrix below.

## Supported environments (round 100)

The answer to "does it run on X", per environment: which capability
tier it reaches, how that is known, and what is not promised.  This is
the alpha gate's "decide supported browser and headless capabilities"
(`docs/feature-direction.md`) stated as a contract; it moves to the
documentation site at round 46.  The full measurements, with versions
and the machine, are round 100's record
(`plan/rounds/2026-08-19-04-rnd0100-landed-the-runtime-horizon-which-other-javascript-environments.md`).

**The capability ladder** — what each tier actually needs, so an
environment is judged against requirements:

| Tier | What it is | What it needs |
| --- | --- | --- |
| **T0** headless core | store, wire, style, collections, every layout, the CPU algorithms, events, `json()` | ES2022 (classes with private fields, `async`), typed arrays, `TextEncoder` with `encodeInto`, `TextDecoder`, `queueMicrotask` — the WinterTC baseline.  `TextDecoder`/`TextEncoder` are constructed **at module evaluation** (`store/id-map.mts`, every id goes through them), so an engine without them cannot even load the bundle.  The smoke needs no timers: QuickJS-ng and GraalJS have no `setTimeout` and pass. |
| **T1** + workers | the algorithm pool (`executor: 'workers'`, and `'auto'`'s lane) and the force sim worker | Node's `worker_threads` (Node, Bun, Deno), or a browser **page** with `Worker`, `Blob` and `URL.createObjectURL` |
| **T2** + WebGPU compute | the GPU algorithm lanes and the headless force integrator (`cytoscape/headless-gpu`, or the full entry) | `navigator.gpu` and an adapter; no canvas, no DOM |
| **T3** + rendering | the renderer, pointer, image export | a browser (or browser shell) page with WebGPU; WebGL2 at round 137 |

**The support tiers.**  **Tier 1 — CI-gated**: a job fails when it
breaks.  **Tier 2 — expected to work**: measured at least once, the
WinterTC-shaped or browser-shaped environments; the smoke is re-run
against them **at release time** (the round-51 bake is the first
occasion), and that cadence is the ceiling of the promise — a Tier-2 row
can be stale between releases.  **Tier 3 — not supported**: recorded
with the failing assertion named, so the answer is a link, not a shrug;
where named shims make it run, the shims are stated, and that is still
not a support claim.

| Environment | T0 | T1 | T2 | T3 | How it is known | Tier |
| --- | --- | --- | --- | --- | --- | --- |
| **Node ≥ 24** | yes | yes (`worker_threads`) | no — no `navigator.gpu`; `'gpu'` rejects, `'auto'` stays on the CPU | no | `ci-node`: the whole Node tier from source, and the smoke over all nine bundles | **1** |
| **Bun ≥ 1.4** | yes | yes — measured (1.4.2: an 8-worker pool, closeness bit-identical to `'cpu'`; the sim worker spawned) | no | no | `ci-bun` (1.4.0 floor + latest) runs the smoke: T0 gated, T1 measured only | **1** (T0), 2 (T1) |
| **Deno ≥ 2.9** | yes | yes — measured (2.9.6, as Bun), **except the CJS bundles' sim worker** (item 76; the ESM is fine) | yes, `cytoscape/headless-gpu` — local only (2.9.6, RX 580 via wgpu/Vulkan, round 131) | no | `ci-deno` (2.9.6 floor + latest) runs the smoke; its GPU step is `continue-on-error`, a manual probe until runners show an adapter (the eleventh sitting) | **1** (T0), 2 (T1, T2) |
| **Cloudflare Workers** (workerd) | yes, `cytoscape/headless` | no — no `Worker`; `'auto'` runs in-thread, asserted | no | no | the isolate smoke every Node-tier run; `ci-workerd` on the real runtime | **1** |
| **Vercel Edge** and other V8-isolate edges | expected: the same WinterTC surface, no `eval`/`new Function` (the bundles contain neither) | no | no | no | not run on Vercel; the isolate smoke is its shape.  Vercel now recommends Node functions over Edge, and Next.js 16.3 drops `runtime = 'edge'` — the Node row covers that path | 2 |
| **Chromium, WebKit** — a page | yes | yes (Blob workers) | where WebGPU exists | where WebGPU exists — round 73's reach table (`plan/rounds/2026-08-14-04-rnd0073-landed-the-webgl2-fallback-scoped.md`); WebGL2 for the rest is round 137 | `ci-browser`: `renderer` (Chromium, SwiftShader) and `renderer-webkit` — the renderer, GPU-algorithm, workers and load specs; GPU specs soft-skip without an adapter | **1** |
| **Chromium, WebKit** — dedicated, shared and service workers | yes | **no** — the pool and the sim worker require a `document` (item 82); `'auto'` answers on the worker's own thread | not measured | no (the worker-hosted renderer is a page's `renderer: { worker: true }`, round 86) | `contexts.spec.js` in both projects | **1** (T0) |
| **Firefox** — page and workers | yes (151, page and all three worker kinds) | yes in a page, as above in workers | where WebGPU exists (Windows 141+, Apple Silicon 145+; **not Linux**) | same | measured locally this round; **no CI project** (item 83) | 2 |
| **Worklets** (Audio; Paint not measured) | **no** — module evaluation fails: Chromium 149 and Firefox 151 have no `TextDecoder` there, WebKit 26.5 no `queueMicrotask` | no | no | no | measured this round | 3 |
| **Electron** | main process: yes (it is Node) | yes, main process | renderer: as Chromium, with the app's own switches | renderer: yes where an adapter is found — on Linux the app must opt in (below) | Electron 44.4.5 (Chromium 152, Node 24.21): the smoke on all nine bundles as Node, the pool in the main process, a mounted graph that picks and exports in a renderer | 2 |
| **Tauri** + a Node sidecar | the sidecar is the Node row | the sidecar's | the webview's | the webview's: WebView2 (Chromium) on Windows, WKWebView (Safari 26+) on macOS; WebKitGTK on Linux not measured | not run — composed from its parts, no claim of its own | 2 (by parts) |
| **React Native** (Hermes) | **only with a `TextDecoder` polyfill** — bare it fails `Property 'TextDecoder' doesn't exist` at module evaluation | no `Worker` | no | no | the Hermes React Native 0.87.1 pins (built from `hermes-v250829098.0.17`) with React Native's own `queueMicrotask`/`performance` installed: 56 assertions with the polyfill.  Hermes 0.13 (the last standalone release) cannot parse the bundle (`async`, class expressions), and React Native's Babel preset no longer lowers classes | 3 |
| **QuickJS-ng**, **GraalJS** | **only with shims** — bare, both fail `TextDecoder is not defined`; with a UTF-8 codec (and `queueMicrotask` on GraalJS's plain launcher) both pass | no | no | no | `test/runtimes/engines.mjs`, run at landing (QuickJS-ng 0.17.0, GraalJS 25.4.4.1.1) | 3 |

What the rows mean in practice:

- **At the edge the budget is CPU, not bytes.**  Measured on workerd
  (2026-09-28 build, the i9-9900K, per request, median of 15, the no-op
  request subtracted; wall time of a CPU-bound request): the reactome
  fixture (227 nodes / 245 edges) ingests in 1.6 ms, lays out with
  `flow` in 5.6 ms and with `force` in 30 ms, and takes `pageRank` plus
  betweenness in 6.1 ms; npm-deps (439 / 510) takes 1.9, 23, 83 and 12
  ms, and the whole request (ingest, force, both metrics, `json()`) 92
  ms, against Node's 84 for the same work (the layouts within ~6% of
  Node's; the metrics the outlier, 12.0 against 5.3 ms).  So Cloudflare's
  **free plan's 10 ms CPU limit** fits ingest, metrics and `json()` of a
  few-hundred-node graph but **not a force layout**; the paid plan's 30 s
  default fits all of it by a wide margin.  The
  headless bundle (567,858 bytes minified) is far inside Cloudflare's
  published 64 MiB script limit and Vercel's 1 MB-gzipped Hobby limit;
  `test/modules/bundle-size.mjs`'s 1,000,000-byte budget stays the gate.
- **Electron on Linux: WebGPU is the app's decision.**  Out of the box
  (Wayland) the renderer finds no adapter and `cytoscape()` rejects with
  the named message; with `--use-angle=vulkan --enable-features=Vulkan`
  (under X11 — Electron refuses Vulkan on Wayland) it gets the hardware
  adapter, and `--enable-unsafe-webgpu` alone gets SwiftShader.  An
  Electron app can set these itself (`app.commandLine.appendSwitch`
  before `ready`); a web page cannot, which is round 73's Linux gap.
- **A model hosted in a worker gets T0 and no pool.**  The page-less
  contexts run everything on their own thread — already off the main
  thread, so the loss is parallelism, not responsiveness.  Opening the
  pool to them is item 82 (the `document` test protects Bun and Deno,
  which have `Worker` and `Blob` but must take the `worker_threads`
  path).
- **React Native gets the model, not a view**: T0 with one polyfill, no
  workers, no rendering.  There is no example app until a real use case
  asks (the eleventh sitting).
- **Not promised anywhere**: a canvas renderer (excluded — see the
  features inventory), rendering outside a browser or browser shell,
  GPU compute in a page-less worker (unmeasured), and any Tier-2 row
  between releases.

**Keeping it true.**  Tier 1 rows are CI's.  Tier 2 and 3 rows are
re-measured at release time: `node test/runtimes/engines.mjs --qjs=…
--hermes=… --graaljs=…` for the engines, the Electron and Firefox
checks as the round-100 record describes them.  A row changes tier by
measurement, and the reason goes in the round that moves it.  Round 99
(Bun and Deno first-class — the native test runners, the install story,
JSR) has not run: its rows here are the round-98 smoke's, and it will
raise them.

## Shipped shaders: WGSL minified at build time (round 52)

The bundles do not ship the WGSL as written.  Every multi-line shader
literal carries the `wgsl` template tag (`src/gpu/wgsl.mts` — an
identity join at runtime, so tsx-driven tests and benchmarks through
`src/` see the original text), and a build-time rolldown plugin
(`scripts/wgsl-minify.mjs`, in every bundle config) strips comments,
collapses whitespace where tokens cannot fuse, and drops the tag.  The
win is 62.2 KiB raw / 19.0 KiB gzipped off the minified bundle — 10.4%
of the download — and most of it is comments, which are unique prose
gzip cannot dedupe.

The rules a shader author needs:

- **Tag every multi-line WGSL literal** with `wgsl`.  Single-line
  generated fragments (per-polygon `case` lines) stay bare — nothing to
  strip.  An untagged multi-line literal still works; it just ships fat.
- **Never put an interpolation inside a WGSL comment** — stripping the
  comment would strand the interpolated text as live shader code, so the
  build fails naming the site.  Spell the constant's name in prose.
- `${...}` interpolations are byte-for-byte opaque, and whitespace
  *adjacent* to one is preserved as a single space, never deleted and
  never invented — `return ${X}` keeps its space, `poly${id}SD` stays
  glued.
- The transform is **unconditional across dev and production** builds,
  deliberately: the Playwright projects run the dev UMD build, and the
  pixel gate only means something if it exercises the transform that
  ships.  The cost is that Dawn's shader compile errors reference
  collapsed one-line text; error positions are less readable in
  `debug/`, which is the accepted price of testing what ships.

**Round 126 (2026-09-29) measured the next step and took the parts that
pay.**  A WGSL-aware minifier (identifier renaming, dead-code removal)
needs a complete module; expanding each of the 23 complete shaders into
one — the only form miniray or wgslender accept — duplicates the shared
fragments this representation ships once, and the full minified bundle
grew +49,960 bytes raw / +12,752 gzipped under the best configuration
(wgslender 1.4.1 with its compression-friendly ordering; +61 KB / +36 KB
under its defaults).  Renaming only function locals, fragments kept
shared, cut the corpus 11% raw and *grew* it 10% gzipped.  So the
round-52 representation stays, and gains:

- **Float literals shortened** where the value cannot change — `1.0`
  -> `1.`, `0.50` -> `.5`, `2.0e3` -> `2.e3`; integers, hex and any
  number touching an interpolation are copied as written.  −1.1 KB raw
  on the full minified bundle.
- **Shader constants spliced at build time.**  `scripts/const-inline.mjs`
  (above, the vocabularies) also replaces an interpolation that is one
  identifier naming a module-level number — `${WG}`, `${SHAPE_SHIFT}u` —
  with `String(value)`, exactly what the runtime join produced, so the
  minifier sees text there and collapses around it.  324 sites in the
  full build.  `test/modules/const-inline.mjs` evaluates every inlined
  shader module and compares its exported strings with the original's.
- **A `glsl` tag**, minified under GLSL ES 3.00's lexical rules (block
  comments do not nest; a preprocessor line keeps its newline and its
  inner spaces), ready for the WebGL2 renderer (round 137).  glslx,
  which round 126's plan named for that renderer, rejects uniform
  blocks, `switch` and `uintBitsToFloat` and renames uniform-struct
  members, so it was not taken.

Verification is layered (`test/modules/wgsl-minify.mjs`): unit specs pin
the contract with the plan's own control (a transform that does *not*
treat `${}` as opaque must mangle the fixture, and does); a token-stream
audit runs all 110 tagged literals — the 32 files found by scanning the
tree, where a hand-kept list had covered 15 until round 126 — through
an independent tokenizer and requires the identical WGSL token sequence
after minification (a float compared by value); a bundle
spec asserts the built outputs carry the shaders comment-free and
tag-free; and the `visual` project's exact goldens (round 57.1e — zero
differing pixels) plus the live parity scenes are the gate that the
browser still draws the same image from text no human wrote.

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

- **The documented limit edges are pinned at their exact edges** (48.6,
  2026-08-08, the `renderer` project — the round's last item).  Exactly
  256 unique images fit one tier with no warning and a pixel proves an
  under-cap image renders; the 257th warns **once** and its node draws
  its background colour, undisturbed beside the images that fit.  ~1500
  distinct characters overfill the glyph atlas, after which a label of
  novel characters lays out empty without re-warning while a label of
  cached characters still renders in full.  And `png()` succeeds at
  output width exactly `maxTextureDimension2D`, rejects at one past it
  naming both, and — round 31's lesson — the `maxWidth` form the error
  recommends is followed on the same instance and must resolve.  Five
  controls (the cap at 255 and at 512, a silently-full atlas, the guard
  at `>=`, the guard deleted) each fail exactly the assertion written
  for them.  Round 48 is complete.

## Device limits, the degradation order and the renderer soak (round 138)

PLAN.md items 34–36, built together on one instrument.  Until round 138
no device requested a limit, so every instance ran under WebGPU's
*default* limits — a 128 MiB storage binding — and a store whose widest
column outgrew it (4,194,305 slots of the 32-byte gradient column)
produced an invalid bind group and a frame rejected at `queue.submit`,
every frame, with nothing but a devtools line to say so; an allocation
the device refused did the same (item 36 measured 26 uncaptured errors in
30 frames and nothing else).  The eleventh sitting's calls: request the
adapter's limits, make growth past them **throw from `cy.add()` with the
store unchanged**, surface allocation failures as an instance event, and
degrade in item 36's order.

- **Every device requests its adapter's own limits**
  (`src/device-fit.mts`, `adapterBufferLimits`): `maxBufferSize`,
  `maxStorageBufferBindingSize` and `maxComputeWorkgroupsPerDimension`, at
  the adapter's values — the renderer's device (`initGpuContext`, which
  both hosts share) and the algorithm device (`acquireAlgoGpu`, which the
  headless GPU force host borrows too).  On the RX 580 that moves the
  storage binding from 128 MiB to 4 GiB − 4.
- **The pre-flight is model-side.**  Once the mirror exists the renderer
  reports a `DeviceFit` to the core (`RenderHost.reportDeviceFit`; the
  worker host posts it) — the three limits and, per group, the widest
  column it cannot draw without (16 bytes a slot in both groups:
  `node.outerGeom` and its peers, `edge.dashPattern` /
  `edge.curveParams`).  `cy.add()`, `cy.load()` and `cy.patch()` run
  `core/gpu-fit.mts` before the first slot is taken: the capacity the
  table would grow to (`ColumnTable.growthFor` — the free list first,
  then the ×2 growth `reserve` takes; a patch's own removals counted as
  freed) times that width against the bindable size, and the high water
  against one dispatch's reach (`maxComputeWorkgroupsPerDimension × 256`,
  the width of every per-slot kernel).  Past either it throws
  **`GpuUnfitError`** — the algorithm executors' "does not fit the device"
  class, now public as `cytoscape.GpuUnfitError` with `name` set — naming
  the group, the column, the bytes and the limit, and ending "nothing was
  added"; the store, the ids and the events are untouched.  Headless there
  is nothing to check.  A graph built headless and then mounted on a
  device too small for it reaches the same check in the renderer's init,
  and `cy.ready` rejects with the same error.
- **Detection: the allocation ledger** (`src/gpu/gpu-ledger.mts`).  WebGPU
  has no memory meter, so the renderer counts for itself: its device's
  `createBuffer` / `createTexture` are wrapped (own properties on that one
  device, nothing global patched) and so is every returned object's
  `destroy`; the ledger keeps live bytes, peak, counts and cumulative
  allocations by label, and holds no reference to what it counts.
  `cy.stats().gpu` is its snapshot (`GpuMemoryStats`), which the worker
  host carries on its frame messages.  Every allocation is bracketed by an
  `out-of-memory` and a `validation` error scope, and an
  `uncapturederror` listener catches the rest; both surface as the
  core's **`gpuerror`** event, `cy.on( 'gpuerror', ( evt, info ) => … )`
  with `info` a `GpuErrorInfo` — `kind` (`'out-of-memory'`,
  `'validation'`, `'internal'`, or `'unfit'` for a buffer the renderer
  declined), the device's message, and for an allocation the label and
  the bytes.  An uncaptured message fires once however many frames repeat
  it; `stats().gpu.errors` counts them all.  The browser's own console
  line is left alone — loud stays loud.
- **Degradation, in item 36's order.**  What cannot fit or failed to
  allocate stops drawing, once, with a `gpuerror` carrying `degraded`,
  and the frame stays valid:
  1. **labels** (`'labels'`) — the glyph streams are capped at the
     bindable size over 64 bytes and the cull's reach; a stream that
     outgrows it stops uploading and every label pass stands down (runs
     are still built: the laid dimensions the model reads come from the
     same pass);
  2. **charts and images** (`'charts'`, `'images'`) — a blob past the
     bindable size is replaced by a four-byte placeholder, so every bind
     group holding it stays valid, and its pass is skipped; the curve
     route blob follows the same rule (`'curves'`);
  3. **gradients** (`'gradients'`) — the gradient columns are **lazy**:
     a one-record placeholder of zeros (meta 0 = solid) until some slot's
     meta names a gradient, then allocated at capacity; a group that
     outgrows its gradient column keeps growing and its gradients draw
     solid.  Allocated for every scene before, they were 32 of the 196
     bytes a node slot costs and 32 of an edge's 164 — the widest column
     in both groups, and the one that set the old ceiling.

  A refused allocation of a degradable buffer takes the same path when
  the error scope reports it (a frame or two after, since scopes resolve
  asynchronously; those frames are rejected, the ones after are not).  A
  refused **core column** has nothing to degrade to: the scene holds its
  last frame (`'frames'`), a pending pick or count answers null and an
  export rejects, until a re-mount.
- **The renderer soak** (item 34) is the ledger under churn:
  `playwright-tests/lib/renderer-soak.mjs` removes and re-adds nodes and
  edges at a fixed size, writes a mapped value and a bypass, and sets a
  new zoom per cycle, sampling the ledger per block after draining the
  queue.  `playwright-tests/soak.spec.js` runs it at CI size — its first
  spec the probe's own control, a buffer leaked per cycle that must show
  **to the byte** — plus five device-loss recoveries, each of which must
  rebuild exactly the first renderer's ledger with the lost one closed and
  no listener gained; `benchmark/scale-ceiling.mjs --soak` is the
  hardware run.  The verdict is exact equality over the second half of the
  samples, since a pool may settle at a high water once (the glyph
  streams double as tombstones accumulate).  The soak pins the render
  scale: the adaptive scale reallocates the scene and depth targets at
  whatever scale load drives, which moved them mid-run on SwiftShader.
  **What it found:** the label shaping memo (round 16.3) was an unbounded
  `Map` only a font change cleared, so churned labels grew the reachable
  heap ~15 KB a cycle, linearly; it is two generations of 4,096 now
  (`src/render/shape-memo.mts`).

**The ceiling, measured** (2026-09-29, `benchmark/scale-ceiling.mjs`,
the RX 580 through Chromium's hardware adapter, the built UMD, a columnar
payload with n = m/4, each scene in a fresh browser; VRAM is the
renderer's ledger, which agreed with the probe's own `createBuffer`
instrument to the tenth of a megabyte on every row):

| scene | init | ready | VRAM | JS heap | GPU frame | outcome |
| --- | --: | --: | --: | --: | --: | --- |
| 1,048,576 × 4,194,305 | 4.0 s | 1.02 s | 1,357 MB | 2.47 GB | 23.8 ms | rendered (blank before) |
| 1.25M × 5M | 5.0 s | 1.18 s | 1,466 MB | 2.90 GB | 29.3 ms | rendered (blank before) |
| 2M × 8M | 7.9 s | 1.11 s | 1,466 MB | 3.24 GB | 48.4 ms | rendered |
| 2.5M × 10M | 10.5 s | 2.31 s | 2,926 MB | 5.46 GB | 61.4 ms | rendered |
| 4,194,240 × 16,776,960 | 17.9 s | 2.12 s | 2,926 MB | 6.02 GB | 106.2 ms | rendered |
| 4,194,240 × 16,776,961 | 17.9 s | — | — | 6.02 GB | — | `cy.ready` rejects: GpuUnfitError |
| 1M × 3M, labelled | 4.4 s | 0.57 s | 1,306 MB | 1.81 GB | 32.8 ms | rendered (blank before) |
| 2M × 2M, labelled | 6.3 s | 0.48 s | 1,776 MB | 1.97 GB | 41.8 ms | rendered |
| 2.5M × 2.5M, labelled | 8.3 s | 0.99 s | 1,247 MB | 2.94 GB | 30.2 ms | rendered, labels degraded |

So **the ceiling is 16,776,960 elements per group** — 4× round 35's
4,194,304 — bisected exactly, and it is no longer a buffer: it is one
dispatch's reach, 65,535 workgroups × 256, which binds before the 4 GiB
binding would (2²⁴ slots × 16 bytes is 256 MiB).  With labels it is
16,776,960 glyphs per stream, ~2M labelled nodes at this label length (8×
round 35's 2,097,152); past it the labels degrade and the rest draws
(the 2.5M row: a 33.5M-glyph stream refused, the gigabyte the stream held
released, 1,073.7 MB of its 2,321 MB peak).  The JS heap is not the
limiter item 35 projected: 6.02 GB at 21M elements, past the ~4 GB it
read as V8's cap.  The per-slot price falls with the lazy gradient
columns — node 196 -> 164 bytes, edge 164 -> 132 — and the measured
totals with it: 14 / 121 / 899 MB -> 12.6 / 100.8 / 735.4 MB unlabelled,
23 / 193 / 1,470 -> 21.5 / 172.1 / 1,306.1 MB labelled, at 10k × 30k /
100k × 300k / 1M × 3M.  The next limiter is the dispatch: a
two-dimensional dispatch over the per-slot kernels (cull, mapper, tween)
would move it to the card's memory — logged, not built.

**The soak, measured** (`--soak`, the same machine): 10,000 cycles at
400 nodes / 800 edges, 20 nodes churned a cycle, 16.8 ms a cycle.  The
ledger settles by cycle 500 — the glyph streams' one doubling, +418 KB in
11 allocations — and reads 6,047,797 bytes, 142 allocations, 125 buffers
and 5 textures at every sample from 500 to 10,000.  The heap, collected
before each reading, ranges 13.8–18.2 MB over the same span; before the
memo was bounded it rose 12.4 -> 52.2 MB over 3,000 cycles.

What round 137's WebGL2 renderer inherits from this contract, recorded in
its plan: report a `DeviceFit` from the WebGL2 context's limits (the
texture-and-buffer limits its storage emulation binds, in place of the
storage binding), emit `gpuerror` from its own allocation checks
(`gl.getError()` after a large `bufferData` is its error scope), keep a
ledger with the same labels so the soak runs unchanged, and degrade in
the same order.

### The record ref's reach (round 145)

`node.chartRef` and `node.imageRef` pack `offset | count << 24`, so they
address the first 2^24 floats of their pool (`REF_OFFSET_FLOATS`, 64
MiB).  Until round 145 nothing checked it: a record appended past that
ORed its offset's high bits into the count, and both readback and the
draw read a wrong-length record from the wrong place.  Item 73's
measurement found it; at the style layer's caps it is reached by the
305,042nd node charted with 16 slices, or the 349,527th with four
images, both well inside the 16,776,960-slot ceiling.  The packing is
unchanged (item 73's sitting decides it); the guard, following round
138's rule that charts and images degrade rather than refuse:

- **The store never corrupts a ref.**  `packRecordRef` saturates an
  unaddressable offset at `0xffffff` and keeps the count exact, so a
  compaction's relocation — which reads the count back out of the ref —
  writes an exact ref once the record moves back under the reach.
  Readback (`chartAt`, `nodeImagesAt`, so `style('chart-values')` and
  `style('background-image')`) takes the offset from the pool's own
  table, and is exact on either side of the boundary, headless included.
- **The renderer degrades the feature.**  Once the chart or image pool's
  used length passes 2^24 floats, the mirror stands a placeholder in, as
  for a pool past the binding, and the renderer stops drawing that
  feature for its life with one `gpuerror` (`kind: 'unfit'`, the blob's
  label, `degraded: 'charts'` or `'images'`, a message naming the 24-bit
  reach).  No saturated ref is ever drawn.  The check is conservative by
  at most one record (the one straddling the boundary is still
  addressable).  The worker host runs the same mirror, so the same rule
  holds there; its demand meter skips degraded images, since the
  worker's pool mirror decodes from the ref's field.
- **Why degrade, not refuse:** round 138's pre-flight holds only the
  columns a group cannot draw without, and charts and images are the
  degradation order's second step — `cy.add()` refusing a graph because
  its pies no longer fit would be the throw-over-a-feature round 138
  declined.
- **Not guarded: the custom-polygon pool**, whose ref in
  `node.borderGeom[0]` has the same packing.  A polygon is the node's
  shape, not a feature it can draw without, so it has no degradation
  step; it is reached at ~1M nodes with 8-point custom polygons.
  Recorded in round 145 as a follow-up.

Specs: `test/record-ref.mjs` at the real boundary (the store, the
mirror, and both through the public API) and `limits.spec.js`'s "record
ref's reach" block on both hosts, which draws two pies just inside the
reach and none once one record is past it.

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
not what costs, using it first is.

Warming them with a throwaway dispatch
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

## The model↔renderer seam (round 86)

The renderer takes everything it consumes from one `RenderHost`
(`src/render/host.mts`) handed to its constructor; it imports nothing
from the core or the collection.  The host is the enumerated census of
the model↔renderer boundary:

- `RenderStoreView` — the contract's `ModelView` plus the reads the
  renderer and label layer actually make beyond it (frame-uniform
  scalars, draw-gating counts, `flushDerived`, `boundingBox`,
  `compactEpoch`, `takeMapperSpans`, `nodeImagesAt`, the label font
  surface and the `setLabelDims` write-back).  `GraphStore` satisfies
  it structurally.  A new renderer read has to be added here, visibly,
  before it compiles.
- `ViewportView` (`pan()`/`zoom()`, read per frame), `AnimationClock`
  (tick/active/attachDriver/detachDriver), `arrowEnds()` /
  `midArrowEnds()`, `onViewportChange`, `emitRender`/`emitError`.
- Two capability seams: `gpuMappers` (null ⇒ no GPU mapper runtime is
  built and the CPU-applied style columns stay canonical) and
  `createImageDecoder` (null ⇒ the image registry gets no rasterizer).

**Picks are slots and ids at this boundary.**  `Renderer.pick()`
resolves a packed pick id (a node's `slot + 1`; edges carry
`EDGE_PICK_BIT`), `pickNodeSync()` a slot; `Core._decodePick` decodes
and re-validates (a GPU pick can be up to two frames stale) and makes
the element handle.  The same-thread host (`coreRenderHost`) is a thin
closure over the core, and the seam pass was verified behaviour-neutral:
all 45 goldens exact-zero, the renderer interaction suite and the full
Node tier green.

This seam is what a worker host, a WebGL fallback renderer (round 73)
or a headless-Node renderer mounts through.

**The worker host (round 86.3), behind `renderer: { worker: true }`.**
The same engine runs in a worker against a `RemoteModelView`
(`src/render/remote-view.mts`) fed by transferable span batches
(`src/render/worker-protocol.mts` — the message contract, maintained
under the contract.mts discipline); the main thread keeps the canonical
store, the canvas element (control transferred; pointer events still
land on it), the sync CPU node pick, the animation clock and export
view resolution (`src/render/worker-renderer.mts`, the proxy).  The
worker is spawned from the bundle's own URL — `importScripts` for the
UMD script tag, a buffered dynamic import for native-ESM loads — so one
build artifact serves both threads (`cytoscape.__runRenderWorker__`,
underscored machinery, excluded from the docs and the shipped
declaration).  Mounting rejects loudly without Worker/OffscreenCanvas
or worker-side WebGPU; there is no silent same-thread fallback.
Verified: the same scene exported through both hosts diffs **exact-zero**
on the pinned adapter, and mutation/viewport/pick/export/label-dims
round trips are spec'd (`playwright-tests/worker-renderer.spec.js`,
`test/modules/worker-renderer.mjs` — the protocol crossing a real
structuredClone).

**The force integrator runs in the worker** (round 129.2, closing the
first of item 51's deferrals): the proxy answers the layout's
`startForce` at once with a remote runtime, the run's inputs cross as
one cloned message, the worker's engine runs the integrator it already
owns and posts the run's state when converged / idle flip, the one
readback comes back transferred, and `finishForce` releases the lease
in the worker; `stop()`, `cancel()` and `destroy()` propagate through
the same poll the same-thread host uses.  Measured on ndex-x-large
(19.6k nodes, 465k edges, RX 580): the worker host's `animate: true`
force run went from **12.8 s with the main thread held** (the CPU
fallback, item 51) to **1.4 s with the main thread ticking** (24 rAF
ticks over the run; the same-thread host reads 1.75 s / 30 ticks), the
streaming run from 11.5 s to 1.4 s / 38 ticks.  The first ~300 ms of a
run on either host are the force pipelines' compile stall.

**Background images decode in the worker** (round 141, closing item
51's images).  The canonical `ImageRegistry` stays main-side — style
application acquires and releases there — and journals each entry's
create and free while a worker host mirrors it; the batch carries the
journal (`StoreBatch.images`, the full set on the init transfer), and
the worker's registry replays it by id (`adopt` / `drop`), owns the
decoder and runs it there: `fetch` + `createImageBitmap` off the main
thread, the vector promotion meter over the mirrored records.  SVG is
the exception: it needs an `<img>`, and `createImageBitmap` refuses SVG
blobs in a worker in Chromium and WebKit alike, so the worker sends the
fetched blob back and the proxy rasters it (`rasterVectorInPage`,
transferred).  Worker-vs-main exports with raster and SVG images, auto
and sdf-icon, through a restyle that frees, shares and recycles
entries, diff exact-zero.  Measured (`benchmark/worker-host-deferrals.mjs
--image-hosts`, RX 580): a style apply acquiring 1,000 distinct rasters
is one 124–142 ms long task same-thread (issuing the fetches and
decodes: ~44 + ~52 ms) and 5 ms under the worker host, one 3 ms batch
post of 1,000 create ops.

**Label fonts come from `renderer.fonts`** (round 141, closing item
51's fonts).  A worker's FontFaceSet starts empty, so the app lists the
faces its sheet names — `{ family, source: url | bytes, style?, weight?,
stretch?, unicodeRange? }` — and the worker fetches each, builds the
`FontFace` from its bytes, loads it and adds it to `self.fonts`
(`src/render/worker-fonts.mts`).  Round 75's semantics hold: labels draw
at once in the fallback, and a landed face re-rasters them only when the
atlas font names it; a face that fails emits one `error` event.
Chromium's worker canvas keeps a font description it resolved before
the face existed on the fallback for good, so that re-raster runs on a
fresh description (the atlas's font epoch, an inert trailing family) —
see `docs/agents/rendering.md`.  Listed and late faces diff exact-zero
against the same-thread host with the same page face.  **Engines**: the
worker host is verified end to end in Chromium; Playwright's Linux
WebKit has no WebGPU, so the host soft-skips there, and what WebKit
verifies is every worker mechanism short of the GPU (bytes faces reach
OffscreenCanvas text advance for advance, the epoch re-resolves, raster
blobs decode, SVG blobs are refused) — the adapter-free mechanics spec.

**Position tweens evaluate on the worker's device** (round 144, PLAN.md
item 68).  The animation manager keeps its own rAF clock and the CPU
reference main-side, and attaches a *remote* tween sink
(`RemoteTweenSink`, `drives: false`): a position tween — an animated
layout's column tween above all — registers with the worker's tween
runtime in one message (the slots and endpoints copied and transferred,
its start on the epoch clock, `performance.timeOrigin + start`, since
the threads' `performance.now()` origins differ), a detach and the
release are one message each, and the settle crosses as the one span it
writes.  Before, the CPU tick posted a position span per frame: 8.75 MB
over a one-second 20k-node grid tween, 23–66 ms rAF gaps.  The main-side
columns are leased as on the same-thread host, so `position()` reads the
tween's value and the column scans (and the sync CPU node pick) read
the start until the settle.  A registration that arrives before the
worker's device is up waits for the runtime to attach.  Paint tweens
keep the CPU path here (the sink is `positionOnly`) and cross as
ordinary spans; item 51 priced those at 0.013–0.052 ms per post,
1/20th–1/50th of the 1 ms trigger.  Specs: the both-hosts tween spec in
`playwright-tests/worker-renderer.spec.js` (one registration, one
detach, one release, no per-frame position span; a stopped node and a
node outside the tween draw where `position()` reads).

## Cancellation (round 128)

The execution model — CPU, GPU and worker executors, Promise
completion, the error contract — had no cancellation contract until
round 128.  What exists now, and what each ending reclaims:

- **`CancelledError`** (`cytoscape.CancelledError`, a factory static
  so `instanceof` works through the UMD global; `error.name ===
  'CancelledError'` for a check without the class) is the rejection a
  cancelled run carries: an async algorithm whose handle's `cancel()`
  was called, a layout's `promise()` after `layout.cancel()`, or
  either when `cy.destroy()` ran while the run was in flight.
- **Async algorithms** return `AlgoRun<T>` — the promise plus
  `cancel(): boolean`.  Per executor: `'cpu'` has completed inside the
  call (`cancel()` answers `false`; nothing is hidden); `'gpu'`'s
  submitted device work cannot be recalled, so the pending readback is
  abandoned and the bytes are never decoded, the kernel's own epilogue
  releasing its buffers as it always did; `'workers'` stops posting
  ranges, drops the partials still in flight as they land and leaves
  the pool standing — `_algoWorkersStats().jobs` counts only the
  ranges that completed, which is the spec's evidence that the unsent
  ones never ran.  The router polls the token after each await, so a
  cancel during acquisition starts no lane.
- **Layouts**: `cancel()` beside `stop()`.  `stop()` keeps what
  stands.  `cancel()` abandons the run: the impl's loop exits (an impl
  is asked to `cancel()`, or `stop()` when it has no `cancel`; one
  with neither runs to completion before the wrapper closes the
  cancelled run), a tween under way is stopped where it is, the
  scope's leaf positions go back to a snapshot taken at `run()` — one
  `Float32Array` copy, restored through the store's bulk write as one
  dirty span — the viewport is left as it is, `layoutstop` fires once
  with `cancelled: true` (the lifecycle always closes; the caller's
  `stop` callback runs too), and `promise()` rejects with
  `CancelledError`, marked handled at creation so a caller who never
  awaits it sees no unhandled rejection.  The force layout lands no
  settle on a cancel; under the GPU integrator the lease is released
  first and the restore uploads through the normal dirty-span path,
  so the next frame shows the snapshot (the Playwright spec picks a
  node at its pre-run spot after the cancel).
- **`destroy()` is the last cancel**: the core keeps every pending
  handle and open layout run in `_inflight`, cancels them before the
  listeners and the renderer go — so a `layoutstop` still reaches a
  listener and nothing in flight writes into a dead renderer — and an
  `await` outstanding across a destroy rejects rather than hanging.
  The registry is observed through each handle's own settle promise,
  never through `run.then`, so a cancelled algorithm run nobody catches
  stays the caller's unhandled rejection to see.
- **Out of scope, deliberately**: `cy.pick()` and `cy.png()`/`jpg()`
  are one-shot frame-scale operations with nothing to reclaim;
  animations have `stop()`; the worker-hosted renderer's batch
  protocol is fire-and-forget.

## Zero-copy: the copy census (round 110)

Every copy a byte pays between a wire payload and the screen, priced on
the benchmark machine (RX 580, Chromium on the hardware adapter) against
ndex-x-large (19.6k nodes, 465k edges), with the two instruments that
re-take the table: `benchmark/copy-census-headless.mjs` (the ingest
phases through the built ESM bundle, and a CPU-profile splitter) and
`benchmark/copy-census.mjs` (patches `writeBuffer`, `mapAsync` and
`postMessage` in-page and runs a load, a viewport spin, the every-node
writer, whole-sheet restyles and four exports through both hosts).  The
round's finding: **v4 was already at the zero-copy floor on every path
but one, and the floor is WebGPU's, not v4's.**

| pathway | what it copies | measured | verdict |
| --- | --- | --: | --- |
| wire decode | nothing — every numeric column is a view over the buffer | 5.3 ms (the name dictionary) | zero-copy; the bench fails if a copy creeps in |
| bulk ingest, column copy | the position column (157 KB memcpy) and the endpoint index→slot remap (3.7 MB) | 0.006 + 1.4 ms of a 370 ms init (0.4%) | **adoption declined**: the gate was 5% |
| bulk ingest, the rest | id registration 120 ms, style apply 177 ms, adjacency 7 ms | 82% of init | not copies — see ledger item 66 |
| first frame's full-state upload | 95 MB through 54 `writeBuffer`s | 62 ms one-shot | at the floor: `writeBuffer` 33.6 ms vs `mappedAtCreation` 32.1 vs a JS memcpy 37.5 for the same bytes |
| per-frame upload, every node moved every frame | one position column, 153 KB | 0.012 ms/frame | at the floor |
| worker host, the same writer | one 153 KB batch per frame, transferred | 0.018 ms/frame | 86.1's copy design holds at 1/50th of its 1 ms trigger; the SAB tier stays designed-not-built |
| whole-sheet `cy.style()` re-apply | every column re-derived, 60 MB | 22 ms of a 198 ms apply | the dirty-span floor for a full re-apply — the apply is the cost (item 67) — **round 133 made it a diff**: one fill column, 39 KB and 0.01 ms of upload per apply |
| export readback loop | row un-pad + swizzle + un-premultiply in JS | 81 ms at 4k, 332 at 8k | **moved to the device (110.4)**: 12 and 52 ms |
| `png()`'s canvas hop | `putImageData` | 2.6 ms at 4k | at the floor; the PNG encoder (177 ms) is not a copy |

The export pack pass (`src/render/export-pack.mts`): one compute
dispatch reads the premultiplied export target through `textureLoad`,
un-premultiplies as the CPU loop did (alpha 0 and 1 pass through) and
packs each pixel to a `u32` in a tightly packed storage buffer, copied
into the staging buffer the readback maps — so the map yields the final
image and the readback is a single `slice()`, the one copy WebGPU's
mapping model cannot remove.  The dispatch runs in 64-row-multiple
bands so every band's byte offset is 256-aligned under the storage
binding limit, which is smaller than the largest export the texture
limit allows.  Both hosts take the pass.  A spec pins the conversion
with a half-opaque body over a transparent background — the case the
older export specs passed through unchanged.

**The SharedArrayBuffer tier for the worker host is designed and not
built** (110.3, the design in full in the round record): `renderer: {
worker: true, sharedMemory: true }`, probing `crossOriginIsolated` and
throwing without it; one SAB per column, double-buffered by epoch so a
batch becomes a byte-less notice and the region being read is never the
region being written; growth by re-sharing a new pair under a declared
`maxSlots` ceiling; blobs and labels stay on the message path.  It is
built the day a real application measures span traffic above 1 ms per
frame — the census reads 0.018.

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

## Border and outline styles (round 38)

The last unported v3 style pair, landed at the sitting's full-coverage
scope: `border-style` (`solid` | `dashed` | `dotted` | `double`),
`outline-style` (same keywords), `border-dash-pattern` (normalized to
two on/off pairs exactly like `edge.dashPattern`; v3's default [4, 2])
and `border-dash-offset`.  All four are sheet props on the nodes group;
the two styles and the offset are case-mappable, the pattern is
constants-only like every list prop.  v3 semantics, each measured in
v3's source rather than assumed: `dashed` reads the pattern and offset;
`dotted` hardcodes [1, 1] and IGNORES the declared pattern (v3's
drawBorder switch); `double` strokes solid and then erases the middle
third (destination-out at width/3); `outline-style` takes no props at
all ([4, 2] dashed, [1, 1] dotted).

**Where the data lives** is shaped by the storage-buffer budget: the two
style enums ride free bits of `borderGeom.y` (8..9 and 10..11), which
the fragment stage already binds, while the dash pattern and offset are
two new columns (`node.borderDash`, `node.borderDashMeta`) bound
**vertex-only** — the node FS sits at exactly 8 storage buffers in both
layouts — and reach the fragment stage as flat varyings, the round-57.1b
slot trick in reverse.  The ghost pipeline's vertex stage lands at
exactly 8 with them.

**The perimeter coordinate** (`perimeterCoord` in the node shader) is
the piece the pair was waiting on: the arc-length position, along the
shape outline, of the boundary point nearest the fragment — with u = 0
and walk direction matching v3's canvas path construction per shape,
because the dash phase starts where the path starts and a half-period
error reads as anti-aligned dashes.  Per tier:

- **Closed form**: rectangle (v3's 4-gon — top-left corner, down the
  left side first), round-rectangle and bottom-round-rectangle (v3's
  arcTo paths from the top middle, clockwise, corner arcs measured
  exactly), cut-rectangle (the octagon walk in v3's vertex order).
- **Ellipse and circle: exact elliptic arc length.**  The round-38 plan
  budgeted an angle-parameterized approximation with a recorded
  deviation, and measurement killed it: the angle version's 5.0%
  parity mismatch exceeded the 3.6% a SOLID border scores, so the
  deviation scene could not discriminate (round 27's measuring-nothing
  case).  What shipped integrates arc length numerically (composite
  Simpson, 48 intervals, dash-gated so solid borders never pay) with a
  two-step Newton refinement to the nearest-point parameter — the
  radial estimate shears ±2 px of phase across a ±2.5 px border band,
  which anti-aligned v3's 2-px-period dots.  Worst case measured
  0.003 px.
- **The polygon family**: generated per-shape perimeter twins beside
  the SDF functions — the same vertex tables walked in v3's path order
  with an argmin edge and cumulative length — plus the same walk over
  the custom-polygon blob and over barrel's sampled corner curves (in
  v3's path order, which differs from the SD function's own vertex
  order).  Round-* shapes walk their SOURCE polygon's edges: a
  recorded approximation (the drawn corner arcs are shorter than the
  sharp corners), measured inside the polygon tier's 0.54% parity
  reading.

**The double erase** ports as alpha-0 stripe fragments — fill and
border are one draw, so "erase the middle third" is those fragments
contributing nothing.  Two consequences, both recorded: the stripe
shows whatever the scene drew beneath the node, where v3's
destination-out punches through to the page (an edge under a double
border shows through the gap in v4 and not in v3 — in the migration
guide's re-check table); and double-bordered nodes are excluded from
the opaque depth prepass, on the gradient-fill precedent, because a
node with a hole in it is not an occluder.

**Outline dashes** evaluate the perimeter at the ring's own radius
(v3 dashes a scaled path, so without this the phase drifts a period
per side), with v3's anisotropic pad reproduced for the polygon family
(expandPolygon pads in unit space divided by nodeWidth alone) and the
corner radius padded for the round-rectangle family.  Two recorded
deviations remain: **outline dash phase on polygon-family shapes** — v3
miters sharp outline corners where v4's ring is an SDF offset with
rounded corners, geometrically different paths no dash coordinate can
align, so the parity scene pins the ellipse family and the
`border-styles` golden covers the rest; and **`outline-style: double`
draws solid** — v3's drawOutline erase strokes at *border* width / 3
(a v3 bug: with no border that is lineWidth 0), so there is no sane
v3 behaviour to match and the keyword reads back but adds no stripe.

**`border-cap` / `border-join` drop** (the sitting's third sub-call):
dash ends are perpendicular cuts by construction.  Rows are in the migration guide.
`text-border-style` stayed out here — the label-box border is a
different pipeline and nothing here made it free (the docs-first call
the plan reserved); round 76.3 built it in the label shader (see the
labels section).

**Verification.**  Five live parity scenes at zoom 2 (the round-56
close-up lesson: at zoom 1 the AA fringe smears 2 px gaps and a solid
border reads within a percent of a dashed one): the closed-form tier
0.178%, polygons 0.538%, exact-arc ellipses 0.793%, dotted + double
1.190%, ellipse-family outlines 0.791% — with feature-off controls at
4.17% / 4.03% / 3.61% / 10.86% / 3.61%, each far past its scene's
bound.  A 40-cell golden (`border-styles`) covers every shape tier ×
style including the polygon-family outline rows parity deliberately
excludes, and one cell draws a ghost with a dashed border — the
fsGhost dash path's only pixel coverage, proven load-bearing by a
ghost-only shader control.  The renderer benchmark gained a
solid/dashed hexagon-border scene pair: the accepted ~2× dashed-border
fragment premium is **unmeasurable at scene level** on real hardware
(3.41 vs 3.41 ms device fit-all, 4.48 vs 4.52 ms zoomed-in, RX 580 at
25k nodes) because border-band fragments are a small share of a frame.

## Known deviations from v3 (accepted for pass 1)

> Everything in this section is a decision, not a backlog item.  (The
> two entries that once said otherwise are both closed: the arrow `gap`
> landed in round 56, and `border-style` / `outline-style` in round 38.)

- **`breadthfirst` is sized by the viewport in pixels, not by the
  zoomed extent** (round 125.4).  v3 spreads its rows and ranks over
  `cy.extent()` — the viewport in model coordinates — so the drawing
  scales with 1 / zoom at the moment the layout runs: on the debug page
  after a fitted `flow` run (zoom 0.11) the same reactome tree came out
  nine times airier than headless (nearest gap 269 px against 30 for
  18 px nodes), which is what the layout quality audit's first sitting
  saw as "too airy even without avoidOverlap".  v4 reads the pixel
  viewport, as its grid, circle, concentric and radial already did, so
  a layout's output is not a function of where the user was zoomed; at
  zoom 1 nothing changes.  The same round made a compound parent never
  a root: v3's undirected root inference took the maximal-degree node
  of every component, and an edgeless parent is its own component of
  degree 0, so it was walked into a depth and every node's dimensions
  were then read through an index the parent was never in — NaN for
  the whole drawing on any graph with such a parent (the npm-deps
  scene).  Parents derive from their children and are never placed.
- **`:active` reaches edges a frame late** (round 57.1, narrowed in
  round 57.8 — kept here because the answer changed).  As recorded in
  57.1, pressing an edge activated *nothing*: the press target was the
  synchronous CPU pick, nodes-only by the round-17.3 deviation.  The
  reversal note said the press path would have to wait for the async
  GPU pick, and now it does: a press the node pick misses resolves
  through `Renderer.pick()`, an edge under it carries `FLAG_ACTIVE`
  (v3's `near.activate()` on mousedown — an edge not being draggable
  does not make it unclickable, and the wash signifies the click in
  progress) and becomes the release's tap target, and the active-bg
  circle waits for the same answer so it shows only on true background
  presses, as in v3.  When the press pans, a pannable element
  unactivates and the circle takes over at the press point — v3's
  mousemove rule.  What still deviates is *latency*: v3 activates in
  the mousedown handler, v4 one pick later (~a frame; a microtask when
  the cursor sits in the cached pick tile), so a press-and-release
  faster than the pick never shows the wash — and `tapstart` itself
  still targets the core rather than the edge, since it is emitted
  synchronously at press time.

- **Straight-edge endpoint accessors** (round 55, *fixed* — kept here
  because the answer changed): `source/targetEndpoint()` used to report
  the node **centre** on a straight edge, off by a whole node radius from
  v3.  They now report the node boundary along the chord, which is also
  the point the arrow shader draws to.  One v3 term is still outstanding
  and arrives with the arrow gap: v3 additionally subtracts the head's
  `spacing`, non-zero only for `tee` and the circle heads.
- **Compound parent boxes are a pixel tighter per side than v3's**, and
  this is correct rather than a shortfall.  v3 caches elements as
  textures and composites them through canvas2d, where antialiasing
  leaves the true extent uncertain by about a pixel, so its margin is a
  rendering allowance; v4 rasterizes the whole scene on the GPU with no
  per-element textures and has nothing to allow for.  Measured invariant
  to `border-width` (0, 1 and 4 all give the same 1.0 px), which is what
  distinguishes it from the border/miter difference recorded separately
  above.  Consequence: every compound ancestry edge's control points sit
  1 px from v3's.
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
- **Arrow compositing is a trim, not an erase** (round 56).  v3 makes a
  hollow or translucent head read as one shape by erasing the head's
  footprint out of the canvas (`destination-out`) before painting it; v4
  stops the line short instead, which costs no second pass.  The two
  agree wherever the head covers the line, which is v3's own reason for
  sizing `gap` as it does — but three cases fall outside a single trim
  distance, and all three are accepted:
  - **v3's erase punches through whatever is under the head** — a
    compound parent's body, another edge — and a trim does not.
  - **Two translucent heads that overlap *each other*** composite in v4
    where v3's erase flattens them.  Reachable when `arrow-scale` makes
    the heads longer than the chord they sit on.  A translucent head over
    its own line is exact: the trim reaches the head's depth whenever the
    head does not hide the line, and that parity scene reads **0
    differing pixels**.
  - **Mid arrows are not covered at all**: they sit mid-line, where a
    trim cannot reach.  PLAN.md item 21 decided it (2026-09-28): mid
    arrows are filled only and `mid-*-arrow-fill` is dropped;
    `mid-*-arrow-width` landed in round 76 (readback only — see the C1
    passage below).
- **A hollow head's back corners are radiused**, where canvas2d miters
  them: v4 strokes by offsetting a distance field, and that rounds a join
  by construction.  It is the whole of the close-up hollow parity scene's 0.898%
  residual — the same scene with `arrow-fill: filled` reads 0.000%.
- **The arrow trim reaches every consumer since round 58** (2026-08-09,
  closing PLAN.md's open call 24), under one rule: *ink hugs the draw
  trim; anchors sit at the gap trim.*  The layer strokes drawn before
  the heads (underlay and casing, both streams) follow the drawn line's
  own `drawnSpanW` — v3 strokes its casing along the shortened path and
  its head erase reaches them too; the overlay, drawn after the heads
  and erased by nothing, spans the gap since round 88.3 — while
  edge-label anchors and mid
  arrows use `arrowGapTrimOf`, the WGSL twin of `arrowTrimAt`, so they
  land exactly where `midpoint()` answers.  The straight mid anchor is
  v3's four-point mean (line ends + arrow points), not the centre
  chord, which equals it only when both ends carry the same head.  The
  binding the two starved stages needed came from `node.outerGeom` —
  `outerHalf` + `shape` fused into one derived column — freeing a slot
  for `edge.width`'s arrow word.
- **`arrow-scale` is quantized to 1/16** and always was (round 13 B7) —
  but it is not only readback, as this file used to imply.  The drawn
  head's size takes the quantized value, and since round 56 so do v3's
  `gap` and `spacing`, so `arrow-scale: 1.4` renders at **1.375**: 1.8%
  small on every arrow quantity.  PLAN.md's open call 23.
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
  (color/opacity-only changes keep the cache).

  (3) Otherwise the GPU
  pick pass draws a fixed 64×64 cursor-centered tile — **edges only** — 
  (a pick-specific Frame uniform turns the cull pass's viewport test into
  cursor-region culling, O(region) not O(scene)), submits in its own
  command buffer ahead of scene work, and reads the whole tile back
  through a ring of 3 staging buffers (latest-wins; a frame that finds
  the ring exhausted *defers* the still-coalescing request to the next
  frame with a free slot — bounded extra latency, never a spurious
  `null`; ring saturation is observable as `stats().pickDeferrals`).
  Scene submissions are capped at 2 in flight, so even stage-3 picks
  resolve in ~1 rAF plus bounded GPU work on GPU-bound graphs.

  Measured on ndex-x-large at dpr 2: node
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
  in **one curved stream** of 32-quad strips evaluated from live
  positions (see the design decision above): bezier/loops keep the
  12a analytic evaluation, the 12b route families evaluate their
  route (from the curve param blob) with piece boundaries landing
  exactly on subdivision indices — legs pixel-straight, corners
  exact — discrete miter normals at sharp corners, and the strip's
  quads distributed by bend (round 93: arcs by sweep, straight legs
  one quad each; round 93.2 raised the budget 24 → 32, priced on
  hardware), so magnified round corners draw as arcs rather than
  chord chains.

  Deviations,
  all recorded: node boundaries use the arrow tier's approximations
  (round-rect as box, polygon as inscribed ellipse); curved edges
  draw after straight edges (two streams, slot order within each);
  the curved stream is never decimated at far zoom; sharp segment
  corners join with a **clamped miter** where v3's canvas uses round
  joins (the difference is confined to the outer join wedge); interior
  point counts cap at 8 controls / 11 segment points; and v3's
  near-overlap control-point correction (`tryToCorrectInvalidPoints`)
  is not ported — overlapping-node curves may differ slightly from
  v3 in the region the nodes occlude anyway.

  (12a's border-exclusive
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
  `CURVE_MULTI n = 1` (identical control math).

  Deviations, all
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
  ranked above merely loses the occlusion benefit, never correctness.
  One pass besides the prepass **writes** depth: the curved edge layer
  strokes (round 88.2), each instance at its own depth so an edge's
  overlapping quads blend once — the underlay's band above EDGE_Z, the
  overlay's under it, both above NODE_Z, which
  `test/modules/edge-layer-depth.mjs` pins.

  The round-14 compound split took the batch route
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
  frames only ever exist mid-interaction on expensive scenes.

  Scaled
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
  Since round 104 a node label's `label-priority` orders the fade (the
  lowest rank fades first, over up to twice the band) and the core
  `label-declutter: cull` hides overlapped labels — "Label decluttering
  (round 104)" above.
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
  ignores the gaps, as v3 does.

  `border-style` dashes every
  shape since round 38 (the perimeter coordinate the note above asked
  for — see the round-38 section).
- **Node shapes** (round 10): `ellipse`/`circle`, `rectangle`/`square`,
  `round-rectangle`, plus the polygon family — `triangle`, `pentagon`,
  `hexagon`, `heptagon`, `octagon`, `diamond`, `rhomboid`, `vee`,
  `star`, `tag` — from the same unit point tables v3 builds
  (`shape-points.mts`), rendered by generated WGSL polygon SDFs with
  vertices scaled to device space (exact distance, so AA and borders
  stay crisp under anisotropy) and picked by an exact CPU
  point-in-polygon in normalized space.

  **Round 27 completed the
  vocabulary** — every v3 shape keyword is accepted, with the
  no-dash legacy aliases (`cutrectangle`, `concavehexagon` and, since
  round 37.2, `roundrectangle`) left out by the 2026-07-29 "one name
  per concept" triage.  `roundrectangle` had survived that triage in
  the code for eight rounds while its two siblings threw — an
  unevenly applied policy, pinned rather than patched because
  removing public API is the maintainer's call.

  The fifth design
  sitting took it as **one call over three names** (the round-29 docs
  check having found `cy.autolockNodes()`/`cy.autoungrabifyNodes()`
  in the same state) and **split** it: the shape spelling drops, the
  two core aliases stay as recorded exceptions.  It was accepted in
  three enums — the node `shape`, `overlay`/`underlay-shape` and
  `text-background-shape` — and drops from all three, since removing
  it from one would have moved the inconsistency rather than closed
  it.

  `right-rhomboid` and `concave-hexagon` joined as
  point tables; `cut-rectangle` (a chamfer of *absolute* length),
  `bottom-round-rectangle` and `barrel` (four sampled bezier
  corners) are parameterized shapes with their own fields; and the
  seven `round-*` keywords render as `sdPolygon( inward-offset ) − r`
  — the identity that makes corner-rounding exact under anisotropic
  scaling, which is what the earlier "no clean closed form" note
  had missed.  Round-* shapes reuse their sharp counterparts' tables,
  as v3 registers them.

  One prop, `corner-radius`, carries three
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
  rendering with a console warning.

  Label color/text bake into glyph
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
  (rectangle | round-rectangle, v3's auto radius).

  Round 76.3 (2026-09-29) added **`text-border-style`** (solid |
  dashed | dotted | double, both label groups, mapper-capable), which
  round 38 had left out.  The style id rides the solid quad's free
  `uv1.y` (the glyph record did not grow), and `fsLabel`'s solid branch
  lays v3's hardcoded patterns — dashed `[4, 2]`, dotted `[1, 1]`,
  model px, as v3's transformed context sets them — along a closed-form
  perimeter coordinate that follows v3's own stroke path: `rect` from
  the top-left corner, `roundRect` from one radius along the top edge,
  both clockwise (`labelBoxPerim`, the easy tier of round 38's — there
  is no polygon case).  An off-segment shows the fill, as v3's
  stroke-over-fill does.  `double` is matched as v3 draws it, per the
  eleventh sitting: the stroke at width / 4 on the path and again
  inset by width / 2 — two thin lines with the fill between, nothing
  past the outer line.  No derivative is taken inside the branch (the
  AA is analytic in device px), so no derivative hoisting was needed.

  The round also **re-centred the band**: B6 drew the border inward
  from the padded box, where v3 strokes the box's path so the band
  straddles it.  The solid quad now grows by half the border width on
  every side and the FS insets the box by the same half, under the
  same condition (width > 0 and a visible colour); the label bounding
  box is unchanged (it never counted the border, as it never counted
  the outline).  The `label-boxes` golden moved by 1.27% of its pixels
  for it — every one on the three bordered boxes.

  Verified by a live close-up parity scene at zoom 3
  (`parity-closeup-text-border-style`): the four styles on rectangle
  boxes with the text inked in the fill colour, **0.384%** against v3,
  **7.509%** with v4 drawing every box solid.  The residue is the four
  corners, where canvas joins the dash ends through the corner and v4
  splits the band on the diagonal (recorded).  The scene uses a label
  whose width is integral, because v3 rounds a label's measured width
  up (`calculateLabelDimensions`): with `'MM'` at 8 px v3's box was
  0.67 model px wider and the dash phase on the right and bottom sides
  drifted by half a dotted period.  That rounding, v3's 2 px
  round-rectangle corner (v4 keeps its auto radius) and v3 stroking a
  border with no background (v4 draws the box only when
  `text-background-opacity` > 0) are the label box's recorded
  deviations, in the migration guide.  The `label-border-styles`
  golden covers every style on both box shapes and on edge labels.
  No bench row: a dash-gated label-box fragment is a smaller frame
  share than the hexagon-border pair that already measured
  unmeasurable.

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
  8-buffer budget).

  **Round 27.6 completed the set** with v3's
  compound heads: `triangle-tee` (a union of two generated polygons
  — coverage is a smoothstep over the distance, so a union is just
  `min( sdA, sdB )`), `circle-triangle` (a polygon plus an analytic
  disc, pulled back by its radius so the *disc* meets the node
  boundary — v3's `spacing`; **not** the only head v3 offsets, as
  this note used to claim: measured off v3's own table at
  `width: 5, arrow-scale: 1.5`, `circle` offsets by the same
  9.8804 and `tee` by a constant 1 px),
  `triangle-cross` (whose bar thickness tracks the **edge width**,
  resolved per fragment) and `triangle-backcurve` (its quadratic
  sampled at codegen into an ordinary point table).

  Recorded
  deviation: `arrow-fill: hollow` on a compound head falls back to
  filled — the stroke `abs( sd )` is wrong at the seam where a
  union's parts meet.  (This note used to add "and v3 does not
  stroke compounds either", which round 55 checked and found false:
  v3's `triangleTee` builds both subpaths into one path and
  `drawArrowShape` strokes whatever path it built.  The seam is the
  real reason and the only one.)
  Round 13 B7 added `arrow-scale` (quantized ×1/16 in
  storage — readback rounds accordingly), `source/target-arrow-fill`
  (filled | hollow — a stroke ring at the per-end
  `source/target-arrow-width`, which takes px, 'match-line' or % of
  the edge width, resolved at style-write).

  **Round 27.3 ported
  v3's arrow sizing**: `max( (13.37 w)^0.9, 29 ) × scale`, evaluated
  in *model* space before the zoom scale — the 29-unit floor is a
  model floor, so applying it to the LOD-floored device width would
  make arrows grow as you zoom out.  Note that v3's `size` is the
  point-table *scale*, not the drawn length (its tables span 0.3),
  and that the arrow quad sizes from a computed `ARROW_MAX_BACK`
  rather than a fixed 0.3, since the compound heads reach 0.5 and
  0.6.

  Round 13
  C1 added `mid-source/mid-target-arrow-shape`/`-color`: mid arrows
  anchor at the curve/route midpoint on the midpoint tangent
  (mid-source pointing backward), follow drags/layouts/tweens
  on-GPU, and are always filled (`mid-*-arrow-fill` is dropped —
  PLAN.md item 21).  Round 76 added `mid-source/mid-target-arrow-width`
  on the item's call: v3's hollow-stroke width, parsed like the end
  widths (a number, `'match-line'` or a percent; constants-only),
  bypassable and read back resolved against the edge width.  It draws
  nothing — v3 reads a head's width only to stroke a hollow one, and a
  mid head is never hollow — so it takes **no column**: the reader
  resolves the def's record patched by the slot's bypass
  (`ReadContext.bypassPatch`), and its sheet-diff writer is a no-op
  (the narrow path, since nothing is stored to re-derive).
  `source/target-arrow-color` as before (v3-like `#999`
  default).  One quad per visible edge per enabled end, reusing the
  edge cull stream; the tip sits on the endpoint node's boundary
  (round-rect approximated by its box, polygons by their inscribed
  ellipse).  Arrows size with the drawn (floored) edge width, and
  since round 57.10 they are *pickable*: each head draws into the pick
  tile with its edge's id, its filled area counting as the hit region
  regardless of `arrow-fill` (v3's `shape.collide` semantics), grown
  by the round-57.9 hit halo.  (They were not pickable from C1 through
  57.9 — the pick pass stayed edges-only.)

  **Outstanding deviation — v4 draws no arrow `gap`** (round 55,
  measured; scheduled, *not* accepted).  v3 keeps two shortened
  endpoints per edge end: the arrow tip at `spacing` behind the node
  boundary and the drawn *line's* end at `gap` behind it
  (`2 x width x arrow-scale` for a triangle, less for `vee`,
  `diamond`, `chevron`, a constant 1 for `tee`).  v4 subtracts
  neither, so its line runs under the head and out the other side.

  Three consequences, each measured against v3 by the
  `parity-arrow-*` scenes: a filled head leaks a wedge of line around
  its tip where the head is narrower than the line (**3.5%** of the
  frame); a hollow head shows the line through its interior instead of
  the background (**11.8%**, and v4 inks more than twice what v3 does
  in that scene); and a translucent edge composites line and head
  separately, so 0.5 over 0.5 reads 0.75 (**26.7%**, the largest
  divergence in the parity suite).  The fix is to trim the line to the
  head's back extent — which reproduces v3's `destination-out` erase
  without a second pass — and its constants already live in
  `src/shape-points.mts`, verified against v3's own functions.  Mid
  arrows are deliberately out of that scope: they sit mid-line where a
  trim cannot reach, and `arrow-fill: hollow` on a mid arrow is not
  supported (decided 2026-09-28: the mid fill prop is dropped; the mid
  width prop landed in round 76, readback only).
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
  immediately, as v3.

  **Dragging a selected node drags every
  draggable selected node** (the whole set moves via one bulk shift
  per pointer move, all flagged grabbed).
- **The gesture traces** (round 142, item 31).  Ten scripted traces
  (`playwright-tests/lib/gesture-traces.mjs`) replay on every v4 host
  and on v3 and are compared as numbers — positions, selection,
  viewport, grabbed and hovered sets, the ordered events — against a
  checked-in record per trace (`playwright-tests/gesture-traces/`).
  They pinned the six behaviours round 136 read from the code, and four
  were fixed as bugs:
  - a second finger that takes a press over (pinch, touch cxt, touch
    box) now **releases the grab** through the same path as a release —
    `free`/`freeon` (and `dragfree`/`dragfreeon` when it had dragged)
    on the whole drag set, every held node's grabbed flag cleared —
    where it had cleared the pressed node's flag alone, silently, and
    left a drag set's companions flagged (`releaseGrab`,
    `pointer-press.mts`);
  - a **right release** emits `pointerup` on the target its
    `pointerdown` had (the core included) and **no `tapend`** — the
    press emits no `tapstart`, and v3 ends a right press with the cxt
    family alone;
  - **`dragpan` and `pinchzoom` need both toggles**, as v3: a drag with
    `panningEnabled( false )` (and box selection off) reported a
    `dragpan` for a pan that did not happen, and a pinch with
    `zoomingEnabled( false )` a `pinchzoom`;
  - **`tapunselect` fires on every element a tap deselects** — a
    single-mode tap's others and the background clear, after their
    `unselect` — as v3's `unselect( ['tapunselect'] )`; it had fired on
    a toggled-off target only.

  Confirmed as v3's and kept: a shift box is always additive and a box
  replaces only when it began because panning was off; `tap` still
  fires on the release after a `taphold`; `scrollzoom` fires at the
  zoom clamp.  Kept and recorded (PLAN.md items 88 and 89): an edge
  press starts on the core (`pointerdown`/`tapstart`), the edge taking
  the release and the tap once the GPU pick answers, and a right press
  never takes an edge; the fingers a pinch or touch cxt consumes get no
  `pointerup`/`tapend`; and the differences the traces found against
  v3 — the release order, v3's any-target `dbltap`, v3's grab on a
  multiple-select-key press, a drag from a locked node (v4 pans, v3
  does nothing), v3's `tapend` at the release point and v3's adaptive
  wheel rate — each listed in the traces' `V3_DIVERGENCES`.
- **Pointer transparency: the `events` prop** (round 20.2): v3's
  `events: 'yes' | 'no'` on both groups (default `'yes'`), constants
  or `case` mappers (CPU-evaluated — the channel is a store-managed
  flag bit, `FLAG_NO_EVENTS`).

  `'no'` makes an element invisible to
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
  "the distinction is useful"): two tiers.

  **`show()`/`hide()` stays
  the display tier** (structural element state): a hidden element
  draws nothing, picks nothing and **takes no space** — excluded
  from bb/fit (round 22 also closed a gap where the fit scan and
  collection `boundingBox()` still included hidden elements) and
  from compound auto-bounds — and, new in 22.3, a hidden
  `bezier`-styled bundle member **leaves its bundle**: siblings
  re-fan, and the per-node loop stagger and compound-loop index skip
  it (v3's display semantics; a hidden *node* needs no bundle work —
  every member of a pair shares both endpoints, so the whole bundle
  disappears together, recorded).

  **`visibility` is a style prop**
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
  into slice alphas, the B1 pattern).

  Scalars/enums are
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
  Charts are paint-only: never in bb, never pickable.

  Pinned by
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
  deliberate small surface addition).

  `pixelRatio` (`'auto'` |
  number — the ctor option overriding the renderer's device pixel
  ratio) predates the round and is spec-pinned since it: the backing
  store scales by it while picking stays css-px addressed.  Since
  round 91 `'auto'` is *live* — re-read on every measure and watched
  by a matchMedia resolution query, so browser zoom and monitor moves
  re-rasterize (and emit `resize` on the core) rather than blurring at
  the construction-time ratio; an explicit number stays pinned.
- **Box selection**: with `boxSelectionEnabled` (default on), a drag
  while a multiple-select key (shift/ctrl/cmd) is held — or any drag
  when panning is disabled — draws a selection box (a DOM overlay above
  the canvas) and on release selects the contained elements with the v3
  event flow (`boxstart`/`boxend` on the core, `box`/`boxselect` per
  element).  Geometry is v3's default 'contain' semantics answered by
  one columnar scan (`cy.elementsInBox(x1, y1, x2, y2)`, model
  coordinates): a node counts when its bounding box (incl. border) lies
  fully inside; an edge when both of its endpoints do.

  Since 12b,
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
  the first cull.

  Curved edges take the conservative-then-exact shape
  the rest of the curve geometry uses: the memoized exact bb rejects the
  common miss, and only a survivor pays for the flattened walk at the
  drawn subdivision.  Two boundaries are deliberate.

  The mode is read
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
  interaction quartet on the core.

  Cost (`benchmark/spatial.mjs`,
  N=2000 / 4000 edges, a band over half the graph): overlap is **~1.9×**
  containment on straight edges (246 → 470 µs) and **~1.9×** on curved
  ones (968 µs → 1.80 ms), the curved pair being dearer on both sides
  because containment already evaluates curve endpoints there.
  `selectionType()`
  is 'single' (tap/box replaces the selection) or 'additive' (taps
  toggle, boxes add).

  **Three-finger touch box selection** landed in
  round 20.5 (v3's gesture): with `boxSelectionEnabled`, three fingers
  sweep a box from the start *centroid* of the three to the moving
  centroid — `boxstart` on the first move, the themed DOM box drawn
  live, applied (boxend / box / boxselect, the 20.2 interactive
  filter, the 16.5 label-containment option) when a finger lifts —
  and a gesture that boxed never degrades to a pinch (v3's didSelect
  latch; leftover fingers stay inert until all lift).

  The box
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
  immediately (panning with it).

  Either way the second finger
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
  bias props /
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
  taxonomy is v4-specific (no classes — restyles and mapper
  re-evaluations trigger, and since round 63 a bypass set or removal
  does too, riding the same write-funnel capture; v3 transitioned on
  class/bypass changes); durations/delays are plain numbers of milliseconds (no
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

*This list is where an over-confident document has to be honest, so read
it as the counterweight to everything above.  It is also the section
that drifts hardest: the entry immediately below described round 55's
unbuilt arrow `gap` for a day after **round 56 built it**, which is the
failure mode the standing closing-sweep rule exists for and which found
it here in round 57.4.*

- **Viewport counts' mask form** (round 75.6): `cy.viewportCounts()`
  reads four words back; the *visible list* as a Collection (#2283's
  larger ask) is a readback of the compacted slot lists with a
  compaction-order contract to define — logged for its own round, not
  built.  A counts-only frame (cull without draw) would make a request
  on a scene at rest cheaper than the full frame it draws now.
- **The sheet diff's full-pass props** (round 133): a replace that
  changes a prop without a round-61 narrow writer — `width`/`height`,
  the label family, shapes, curve props, the edge `opacity`/
  `line-opacity` fold cluster — still takes its whole group def through
  the full pass (an edge `width` change on ndex-x-large: 235 ms, the
  nodes skipped).  Narrow writers for the geometry cascade (size →
  outer half, bounds, the curve records of incident edges) and for the
  label sidecar would widen the diff; not built — the round's
  measurement was the colour edit, which is what a style editor sends
  most, and every new writer carries round 61's invariant (it writes
  *every* column its prop affects) with a spec.  An animation also
  sends its group through the full pass on the next replace, including
  a finished transition, whose values already equal the sheet's.
- **Progressive ingest** (round 103): a layout is refused while a load
  runs — the layout-after-complete convention is "await the load"; a
  queued layout (`layout.run()` deferring to the load's end) is the
  alternative the plan named, not built.  `cy.patch()` refuses node
  references, even in `'merge'` mode, where they would mean what the
  definition form's references mean there.  Chunk-per-chunk cost is
  ~1.2–1.3× a monolithic ingest on ndex-x-large; the rest is per-chunk
  style application and adjacency overlay into a populated graph.
- **The low-overlap patch** (round 107): below ~70% id overlap a
  `cy.patch()` costs more than destroy-and-recreate (2.3× at 10%),
  because removals and adds run the per-element store paths — a
  bulk removal (one adjacency rebuild, one id-blob pass) and a
  contiguous re-add would move the crossover.  Not built: the headline
  refresh is high-overlap, and the number is documented in "Patch"
  above.  (The live-following clone and its minimap proof, which the
  round-107 plan said land with it, landed with round 106 on that loop.)
- **What a following clone does not do** (round 106): it syncs per
  burst, not per frame — ~50 ms a sync at 100k elements, so a minimap
  lags a drag on a large graph by a sync; it shares no view state (an
  opt-in selection or viewport sync waits for an app that proves the
  need — `docs/features.csv`'s linked-view row); it duplicates the
  model (~50 MB per 100k elements); and a clone of a worker-hosted
  instance (`renderer: { worker: true }`) carries that option into an
  untested combination.
  Same-frame fidelity would need the shared-store design the round-106
  plan records as the fallback.
- ~~**Round 55's remainder — the arrow `gap`**~~ — **landed as round 56**
  (2026-08-07).  v3's `gap` and `spacing` both port, on the CPU and in
  generated WGSL; the three scenes that measured 3.5% / 11.8% / 26.7%
  against v3 now read **0.000% / 0.442% / 0 differing pixels**.  What is
  left of it is recorded deviations rather than unbuilt work, and
  they are below: hollow **mid** arrows (no trim reaches mid-line — open
  call 21, and they may end up unsupported), and two overlapping
  translucent heads compositing where v3's erase flattens them.  (A
  third — edge labels and the layer strokes riding the *untrimmed*
  path — was open call 24 and **landed as round 58**, 2026-08-09.)
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
  are documents to keep true rather than to write once.

  **48** (soak)
  is complete: the Node tier, the device-loss-under-load specs, and —
  landed 2026-08-08 as 48.6 — the documented **limit edges** (the
  256-layer image cap, a full glyph atlas, the export texture cap),
  each specced at its exact edge with the fixture big enough to reach
  it: the resource just inside the limit works, the first past it
  degrades warn-once without a crash, and the instance carries
  on.  **49–51** (cross-platform validation, release
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
  demand-gated feature hooks (the elevated draw tier, multilevel
  force refinement, more layouts, future
  chart kinds on the round-23 surface) stay
  logged in their sections above; per-side compound padding closed —
  round 85.4.
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
  arrowhead **vocabularies** — which round 55 had to distinguish from
  arrow *compositing*, ported in turn by **round 56**: v3's `gap` and
  `spacing`, the hollow-stroke clipping, and the six goldens that were
  cropping their own scenes.  What is left of arrow compositing is the
  three deviations listed under "Known deviations" — mid arrows, the
  erase's reach under a head, and overlapping translucent heads.

  **`border-style` / `outline-style`** was
  the last one left, waiting on a scope call rather than a technique;
  the fifth design sitting took it — **full coverage, every shape** —
  its three sub-calls were taken at the sixth, and **round 38 landed it
  in full on 2026-08-08** (v3's `double` erase included, plus
  `border-dash-pattern`/`-offset`; `border-cap`/`-join` are dropped by
  the sitting's call).
  ~~The `panBy` animation target~~ — **closed by round 28.2**
  (2026-08-03, the viewport-targets bullet above).

  Round 28 also
  closed the verification gap round 27 left behind (its CPU-pick
  branches were untested) and trued up the gap ledger, which then
  held only open design calls.
  **Every one of them was taken at the fifth design sitting**
  (2026-08-04), together with the contradictions rounds 28–29 turned
  up between the code and the decided-design ledger and round 30's
  question of whether error-contract coverage should gate.

  The
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
  (landed, round 37.4); `preventDefault()` is **browser-level only** —
  its DOM half landed with the v4 Event (round 41.4), the *gesture*
  half became an open question when the enumeration of preventable
  defaults turned out not to be derivable from v3 at all, and the
  seventh sitting (2026-08-09) closed it by declining the rows:
  explicit toggles are the whole gesture-control story; and both
  audits gate (landed, round 37.1).

  `cytoscape.warnings()` was to build too, pending the **error
  policy** behind it — v3's mostly-no-throw stance against v4's
  fail-loudly design — which was round 40's own sitting.  That sitting
  (2026-08-09, with the 198-site classification in hand) closed it the
  other way: **errors and warnings stay exactly as built**, and
  `warnings()` is not built at all — the recoverable tier measured too
  small (~11 sites, half meaningless without a fallback renderer) to
  justify any policy surface.
  The sitting's **packaging** decision — v4 becomes the package, v3
  into a self-contained `v3/` — **landed as round 42** (2026-08-04),
  with the two calls it left to docs-first taken there: the
  `gpu-`/`webgpu-` prefixes drop, and the five shared utility modules
  duplicate rather than stay shared, so nothing under `src/` imports
  outside it.

  A third call the plan had not foreseen — the `Gpu*`
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
  what made its parent boxes overlap.

  Fixing the third is what
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
  for rounds 34–35's bundle figures).

  What it *found* rather than
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
  `v3/documentation/` belongs to v3 until then.

  What *is* ready is the
  input: after rounds 31–32 the public surface carries all three of
  the tags a generator reads — a doc comment on every member (26),
  `@throws` wherever a member throws (31.2), and `@param` on every
  member that takes arguments (32, widened in 36.2 to the exported
  functions the audit had never walked, and again in 37.3 to
  `export default function` — the entry point, and again in round 45 to
  `src/event.mts`, a whole file the tier had never listed: **232/232**) — each
  gated, so the generator's input cannot rot before the generator
  exists.

  **`@returns` is complete since round 36** (**279/279**) and
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
  (`@param` reads **240/240** today — 239 when round 57.2 landed, not
  232: the gate had never seen a member whose parameters *wrapped*, and
  adopting a formatter made five of them visible at once; round 52's
  `wgsl` tag is the 240th.)
- **Two directions logged in round 57, neither scheduled** (PLAN.md's
  ledger items 25 and 26).  **25 landed as round 63** (2026-08-10) —
  and *not* in the case-rewrite shape this entry first sketched, which
  measurement rejected on three walls (it could not compose with
  scale-mapped channels, one id clause re-opened the round-60.4 select
  regression for its whole group, and the chain was O(k·V)).  What
  shipped is the `bypasses` sheet section with the v3 method spellings
  as sugar; the style-getters section above carries the contract.

  **26 landed as round 130** (2026-09-20): the ten largest files split
  the way `src/algorithms/` already was — each class hub keeps its path
  as the facade (every signature and doc on the class body, where the
  four gates read them) and delegates its bodies to a sibling directory
  of functions over the instance; the two pure-function files re-export
  from theirs.  The constraint this entry named held: nothing left a
  class body's public surface, and the docs generator's output is
  byte-identical modulo line stamps.  `style.mts` 9,961 → 789,
  `collection.mts` 6,581 → 3,870 (2,180 of which are the doc comments
  that must stay), `graph-store.mts` 5,665 → 2,279, `shaders.mts` 5,220
  → 26, `core.mts` 3,385 → 2,218, `renderer.mts` 3,016 → 832,
  `animation.mts` 2,328 → 64, `curve-geometry.mts` 2,166 → 100,
  `force.mts` 1,968 → 263, `pointer.mts` 1,916 → 540; every new module
  under 1,050.  The round file has the per-file layouts and the tool
  rules the split taught (`plan/rounds/2026-09-20-01-rnd0130-…`).
- **One deviation round 57.1 recorded**, in "Known deviations from v3"
  above: `:active` reached nodes only, because the press target is the
  synchronous CPU pick and that has been nodes-only since round 17.3.
  The styling is v3's; only the pointer's reach differed — round 57.8
  narrowed the deviation to latency by resolving the press through the
  async pick.

  The round's *first* pass recorded a second one — that v4's selection
  colour always won, where v3's is a default any user block beats — and
  it was rejected rather than accepted, which is why the deviation is not
  here.  Making it a default rule instead of a shader constant took no
  new concept: `case` mappers and the reserved condition keys already
  existed, and the state family joined `{ parent }`/`{ child }`.
