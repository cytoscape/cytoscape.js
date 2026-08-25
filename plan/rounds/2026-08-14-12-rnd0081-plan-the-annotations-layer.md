## The annotations layer

v4 contains no annotation code of any kind (`grep -ri annotation
src/` answers zero lines), and the ecosystem demand is the tenth
sitting's shortlist entry with "the longest paper trail": Cytoscape
Web renders desktop annotations today *beside* cytoscape.js, through
a layered-canvas library (cytoscape/cyannotation-cx2js — its own
description: "Renders Cytoscape Desktop annotations from CX files
via cytoscape.js-canvas"; Web's PRs #400 "Render annotations for
cy.js networks", #426, and #526 "Support linear gradient fill for
annotations" — titles verified 2026-08-14).  Read-only, off to the
side, and reimplemented per app is exactly the shape of a missing
core feature.

The wire dialect, verified from that converter's source
(`src/cx_to_cy_canvas.js`) rather than from its README (which
documents nothing): annotations live in the CX `networkAttributes`
aspect as an element named `__Annotations` whose value is a list of
strings, each a `|`-joined list of `key=value` pairs
(`getAnnotationElementsFromNiceCX`).  Common keys: `uuid`, `type`
(Java FQNs — `ShapeAnnotation`, `TextAnnotation`,
`BoundedTextAnnotation`, `ArrowAnnotation`, `ImageAnnotation`,
`GroupAnnotation`), `canvas` (`foreground` | `background` — desktop
has exactly two annotation canvases), integer `z` (the converter
sorts each canvas descending and draws in that order, so *lower* z
paints later and sits on top), `x`/`y`/`width`/`height`, and `zoom`
(a recorded scale the converter divides sizes and font sizes by).
Shapes carry `shapeType` (`RECTANGLE`, `ROUNDEDRECTANGLE`,
`ELLIPSE`, `TRIANGLE`, `PENTAGON`, `HEXAGON`, `OCTAGON`, `STAR5`,
`STAR6`, `PARALLELOGRAM`, `CUSTOM` with an `M/L/Q/C` path string),
`fillColor` (int RGB) + `fillOpacity` (0–100), `edgeColor` /
`edgeOpacity` / `edgeThickness`; text carries `text`, `fontSize`,
`fontFamily`, `fontStyle`, `color`.  Two honesty notes from the
same read: the reference converter's `ArrowAnnotation` body is
commented out in full ("would take a great deal of math … left for
later work"), and `ImageAnnotation`/`GroupAnnotation` are not
handled at all — so the "parity" baseline Web ships is shapes and
text only.

What v4 offers to build on, verified: draw order is structural and
z-index is dropped for good (`src/README.md:1307`), with the one
logged escape being a single boolean **elevated tier**
(`src/README.md:1321`; PLAN.md round-14 sitting: "never arbitrary
integer stacking").  The store's groups are exactly two —
`GroupName = 'nodes' | 'edges'` (`src/contract.mts:12`) — and that
spelling is load-bearing across `StoreDelta.resized`
(`src/contract.mts:879`), `ModelView` (`src/contract.mts:990`), the
mirror, the cull kernels and the wire header.  The contract already
has a precedent for model-owned data that is *not* a column: the
label sidecar (`LabelEntry`, `src/contract.mts:911`; the store's
per-stream arrays at `src/store/graph-store.mts:268`) and the four
optional blob-dirt channels on the delta (`src/contract.mts:889`).
The frame is a render-on-dirty loop whose scene pass runs prepass →
parents → edges/arrows → ghosts → node bodies → image/chart/overlay
→ labels (`src/render/renderer.mts:44`).  Node picking is a
synchronous CPU scan (`src/render/cpu-pick.mts:35`), and
pointerdown already decides pan-vs-grab from it
(`src/interact/pointer.mts:22`).  Images have a refcounted pool
with warn-once decode failure (`src/image-registry.mts:17`).
Labels are SDF from one atlas keyed by character, so `font-family`
is a global constant (`src/README.md:1926`).  Removed elements are
terminally dead (`src/README.md:1998`).  Extension points stay
demand-gated deferred (`src/README.md:4996`) — this round builds a
core feature, not a hook.

### Design calls

1. **Representation: a store-owned sidecar table, not a third
   element group.**  Annotations are authored singletons in the
   tens, not data populations in the hundreds of thousands: they
   take no part in selectors, mappers, layouts, algorithms,
   adjacency, or the columnar dirty-span machinery that exists to
   price element churn.  Promoting `GroupName` to a three-way union
   would touch every co-signed surface in `src/contract.mts`, the
   wire header, the mirror and every cull kernel, to buy reuse the
   feature does not want (per-population styling) or does not need
   (GPU picking of tens of items).  Instead: an `AnnotationTable`
   owned by the store — the label-sidecar precedent — holding an
   ordered list per tier, a monotonically-assigned id, an alive
   generation (so removed handles read as dead, the terminal-death
   contract applied unchanged: no restore, re-adding from a kept
   definition is the app's job), and one coarse dirty flag on the
   delta (`annotations?: true` beside the blob channels — the
   whole population re-uploads when anything changes, which at
   tens of records is cheaper than span bookkeeping).  Rejected:
   the third columnar group — churn across the whole contract for
   machinery annotations cannot exercise; also rejected: a pure
   renderer-side feature — the model must own annotations so
   headless instances can import, hold and export them with no
   canvas, which is the Cytoscape Web server-side story.

2. **Layering: two structural tiers, no z integer.**  Each
   annotation carries `layer: 'background' | 'foreground'`
   (default `'foreground'`) — precisely desktop's two canvases,
   and precisely v4's philosophy: the tier is the single-boolean
   structural placement the elevated-tier hook already sketched,
   arriving on annotations first.  Background draws after the
   depth prepass and before parent bodies (depth-tested against
   opaque node interiors exactly as edges are — free early-z,
   correct under translucent nodes); foreground draws after
   labels, no depth.  Within a tier, draw order is list order,
   insertion at the end; desktop's integer `z` exists only at the
   wire boundary — import sorts each canvas by the converter's
   own comparator once and discards the integers, export
   synthesizes fresh ones from list position.  Rejected: a stored
   per-annotation z-index — re-litigates the 2026-08-01 decision
   for no consumer; the two-tier + list-order model reproduces
   every desktop file's paint order exactly.

3. **Style: direct properties on the annotation object; no
   stylesheet participation.**  An annotation is one authored
   thing, not a keyed member of a population — there is no data
   column to map from and no state vocabulary to condition on.
   Properties are plain serializable values (`fillColor`,
   `fillOpacity`, `borderColor`, `borderWidth`, `shape`, `text`,
   `fontSize`, geometry…), which is the desktop model verbatim and
   keeps interop 1:1; the no-style-functions rule holds trivially
   because there is nowhere to put one.  Validation is fail-loud
   per the error policy: unknown `kind`, unknown shape keyword,
   non-finite geometry, and updates against a dead handle all
   throw, each with a spec (the throw gate is at zero and stays
   there).  Rejected: an `annotations` sheet group with mappers —
   it would drag the compiler, the columns and the GPU mapper
   runtime into a feature whose population is countable on hands.

4. **Interaction: minimal v1 = hit-test + move, default inert;
   render-only is the fallback, maintainer chooses.**  Recommended
   scope (81.4): a CPU hit test over the lists (reverse draw
   order; foreground before elements, background only when no
   element hits — desktop's own reachability), a programmatic
   `update()` move, and pointer drag *only* for annotations
   opted in with `movable: true` — the default is
   pointer-transparent, so a graph with imported annotations
   behaves byte-for-byte like today's Web read-only rendering
   unless the app opts in.  Events on the core (annotations are
   not event targets; no bubbling): `annotationgrab` /
   `annotationdrag` / `annotationfree` / `annotationtap`, payload
   = the handle.  Resize/rotate handles and any editing chrome are
   permanently the app's job.  The rejected-but-offered
   alternative: render-only v1 (drop 81.4 whole; the API and hit
   test become a later round) — it still covers the first
   consumer, and the pass is severable to the commit.

5. **Interop: the `__Annotations` dialect is the wire story.**  A
   pure module (no instance, no renderer) parses the `|`-separated
   `key=value` records into v4 annotation definitions and
   serializes back: `annotationsFromCx()` / `annotationsToCx()`,
   exported as named exports beside the default (they attach as
   properties of the UMD global; the packaging and d.ts-surface
   specs pick them up).  Unrecognized keys are preserved
   per-annotation in a `foreign` bag and re-emitted on export, so
   a desktop file round-trips its content even where v4 renders a
   deviation (fonts, below) — the cheap honesty a bridge format
   owes.  Import maps `shapeType` onto v4's existing SDF shape ids
   (`RECTANGLE`/`ROUNDEDRECTANGLE`/`ELLIPSE` plus the regular
   polygons and stars); `CUSTOM` paths warn once, are not drawn,
   and survive in `foreign` (the image-decode-failure precedent:
   degrade visibly-absent, never crash).  `ArrowAnnotation`'s
   endpoint attachment resolves to static coordinates at import
   (recorded deviation: endpoints do not track their targets —
   the reference converter draws nothing at all here, so this
   *exceeds* the parity baseline).  `zoom` normalizes into model
   px once at the border.  Annotations do not join the CYGE binary
   format in v1 — they are small and object-shaped, the
   graph-data-as-JSON reasoning (`src/wire.mts:36`) applied again.
   Rejected: inventing a v4-native annotation JSON dialect first —
   the desktop dialect has the installed base and the first
   consumer; v4's constructor option simply takes the parsed
   definition objects.

6. **Text: rendered in the instance's one global face — stated,
   not fudged.**  The glyph atlas is keyed by character with one
   font per atlas by design (`src/README.md:1926`); per-annotation
   `fontFamily`/`fontStyle` would re-key it by (font, char) and is
   out of scope, same as it is for labels.  v1 honors `text`,
   `fontSize` and `color`; the imported family/style ride the
   `foreign` bag so export returns them untouched.  This goes in
   "Known deviations from v3" — strictly, deviations from
   *desktop* — as its own entry, beside `CUSTOM` shapes and
   non-tracking arrow endpoints.

### 81.1 — the model: contract types, the sidecar, the API

The `Annotation` definition union in `src/contract.mts` (kinds:
`shape` — with optional centered `text`, covering desktop's
BoundedText — `text`, `line`, `arrow`, `image`) plus the tier
type and the delta's `annotations?` flag; the `AnnotationTable`
in `src/store/` (add/remove/update/list per tier, id + generation,
dirty signaling through the store's existing invalidate channel);
the core surface — constructor option `annotations: [...]`,
`cy.addAnnotation(def)` returning a handle,
`cy.annotations()` returning the live handles, handle
`update(patch)` / `remove()` / getters.  Headless-complete: every
spec in this pass runs in `test/` under the Node tier.  All new
throws (invalid kind/shape/geometry, dead-handle update) get
message-asserted specs; JSDoc on every public member (the gate is
at 100% and the d.ts regenerates); `src/README.md` gains the
design-decisions entry.  Files: `src/contract.mts`,
`src/store/annotation-table.mts` (new), `src/store/graph-store.mts`,
`src/core.mts`, `src/public-types.mts`.  Verification: `test:js`,
`test:modules`, `test:throws` at zero, `test:soak` (the sidecar
joins the churn/leak tier — annotations across destroy cycles
must collect).

### 81.2 — the draw: two tiers in the frame graph

Renderer-side mirror of the annotation lists into small instance
buffers (full re-upload on the dirty flag — tens of records), and
three deferred-compiled pipelines (the round-53 first-frame rule:
nothing compiles until the first annotation exists): shapes (one
instanced quad pipeline reusing the node SDF shape functions from
`shaders.mts` — rect/round-rect/ellipse/polygons cost no new
distance code; `line`/`arrow` reuse the arrowhead SDFs), text
(glyph runs laid through the existing `GlyphAtlas` into a fifth
`GlyphBuffer`; anchor positions baked into the instances and
rebuilt on move — annotations are few and moves are rare, so no
shader change and no slot-reference scheme), and images (through
the `ImageRegistry` pool + a variant of the image pipeline).  Two
draw sites: background after the prepass, before parents,
depth-tested; foreground after labels.  No GPU cull: a CPU
frustum test per annotation per frame, drawn direct rather than
indirect — at tens of instances the cull dispatch would cost more
than it saves, and the honest bench row (81.6) prices the claim.
All new WGSL literals carry the `wgsl` tag.  Files:
`src/render/annotation-pipeline.mts` (new),
`src/render/renderer.mts`, `src/render/shaders.mts`,
`src/render/label-layer.mts`.  Verification: 81.3's goldens;
`debug/` gains an annotations toggle on one fixture and the page
gets driven (AGENTS.md code standard 5).

### 81.3 — goldens built to expose the tiers, with failing controls

New `visual` scenes constructed so the *ordering* is the
measurement, not hidden under opaque paint (the round-55/56
lesson): a translucent background rectangle straddling nodes and
edges (its color must show through nothing and be shown through
by nothing it sits under), a translucent foreground ellipse over
an edge bundle and labels, a text annotation beside a node label
at matching font size, an arrow/line pair, an image annotation
over the canvas edge (crop check via `expectGraphFits` /
`useViewport`).  Controls, each run once and observed red: flip
one scene's tier (`background` ↔ `foreground`) — the diff must
jump; disable the annotation draw entirely — every scene fails.
Goldens are exact (zero differing pixels) and generated on Linux;
the text scene inherits the label-scene platform note.  There is
no v3 parity diff to run — v3 has no annotations — so goldens +
controls carry this feature alone, and the round record says so.

### 81.4 — interaction (the maintainer's scope call)

If minimal-v1 is chosen: the hit-test walk (foreground reverse
list order → existing element paths → background), `movable`
drag through the pointer state machine (a new mode beside
pan/grab/box; position writes go through the store so the dirty
flag schedules frames), the four core events, and
`cy.annotationAt(position)` public.  Specs: hit order pinned
(foreground annotation over a node wins; inert annotation never
intercepts — the control: mark it movable and the same gesture
must grab it), drag writes verified headlessly through the
table, and a Playwright gesture spec on the served page.
Renderer/gesture changes get a `debug/` drive.  If render-only
is chosen, this pass is dropped whole and its API surface waits.

### 81.5 — interop: the CX dialect, round-tripped

`src/annotation-cx.mts` (new): the parser/serializer pair as pure
functions, the `foreign` round-trip, the z-sort at import, the
`zoom` normalization, warn-once for `CUSTOM`/`GroupAnnotation`
(groups flatten; members import individually), and the throws for
structurally invalid records (a record with no `type`, an
unparseable numeric) — fuzz-shaped malformations get
deterministic pins in `test/` since the throw gate cannot see
soak-only guards (AGENTS.md).  Fixtures: annotation strings
excerpted from cyannotation-cx2js's own example `.cx` resources,
vendored small under `test/fixtures/`, with the spec asserting
per-key values after the round trip, not just that parsing
succeeded (the round-46.5 dictionary-column lesson: a payload can
lose a whole field and still look plausible).  Named exports join
`src/index.mts`; `test:types:surface` and the packaging spec are
the gates that notice.

### 81.6 — the bench row, and the close

One renderer-profile scene pricing frame cost at N annotations
over a mid-size graph, run at two N values so the row
discriminates — it must move with N, and its comment says what
would make it not move (opaque overdraw hiding the tier work).
Standing close: `src/README.md` (design decision, the three
recorded deviations, the follow-up hook for what v1 excludes),
MIGRATING/CHANGELOG rows (new public surface; "v3 had no
annotations — this is a desktop-parity addition" stated plainly),
AGENTS.md untouched unless a new directory appeared (none
should), d.ts regenerated, `EXECUTIVE_SUMMARY.md` rewritten from
this file, all gates green including JSDoc 100% and throws at
zero.

### Risks named at planning

The largest is scope gravity: desktop annotations trail an editor
UI, rotation, gradients (Web's #526), and group semantics, and
every one is out of v1 — the pass list draws the line at
render + dialect (+ minimal interaction), and the Open paragraph
is where the rest lives rather than the diff.  Second, the
foreground tier draws after labels with no depth, so it is the
first pipeline family outside the early-z scheme; if a scene ever
puts hundreds of large translucent foreground annotations over a
dense graph the overdraw is unmitigated — the 81.6 row exists to
keep that priced rather than assumed.  Third, 81.4 touches the
pointer state machine, historically the code most likely to
regress invisibly to Node suites — the debug-harness drive is
mandatory there, not advisory.  Fourth, the dialect is
reverse-engineered from a converter, not from a spec: keys
verified against `cx_to_cy_canvas.js` are cited above, but
`ImageAnnotation`'s key set and desktop's exact z conventions are
**to-verify** against a real desktop export before 81.5 hardens —
the fixtures pass exists to force that check.  Sequencing: 81.1 →
81.2 → 81.3 strictly; 81.4 and 81.5 are independent of each other;
81.6 last.

**Open:** the 81.4 scope call — minimal interaction (recommended)
versus render-only; whether annotations ever join `cy.fit()` /
`boundingBox()` (v1 excludes them, recorded — an opt-in flag is
the natural follow-up if Web asks); a reorder affordance
(`bringToFront`/`sendToBack` within a tier) — v1 ships insertion
order only; whether the CYGE binary format gains an optional
annotations section once Web consumes the feature at scale;
`GroupAnnotation` fidelity beyond flatten-and-preserve; and
whether `line`/`arrow` annotations should later re-resolve
attachment to live node positions (tracking endpoints), which
would move them from sidecar-static toward store-coupled and
deserves its own sitting.
