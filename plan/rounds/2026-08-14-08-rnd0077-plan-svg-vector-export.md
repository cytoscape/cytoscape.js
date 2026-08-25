## SVG vector export

Issue #639 (2014) is the most-demanded export feature ever filed
against this library, and both flagship consumers — Cytoscape Web
and EnrichmentMap web — bolt on third-party `cytoscape-svg` +
`cytoscape-pdf-export` for publication figures.  The design
sitting's thesis was that v4 makes this a *serializer*, not a
second renderer, because the geometry is CPU-side.  Planning
verified that claim member by member, and it holds with one
exception worth naming.  What the code does today:

1. **Image export is `png()`/`jpg()` only, promise-only, and
   renderer-bound** — `core.mts:2053`/`2064` route through
   `_exportImage` (`core.mts:2070`), which throws on headless
   instances (`core.mts:2087-2091`), calls
   `renderer.exportImage()` (`render/renderer.mts:657`, offscreen
   render + GPU readback), and encodes through a DOM canvas
   (`core.mts:2094-2102`).  The option surface is `ExportOptions`
   (`public-types.mts:338-358`): `bg`, `full`, `scale` or
   `maxWidth`/`maxHeight`, `quality`, `output`.  The view math —
   full-graph bounds vs viewport, the scale fit — is
   `computeExportView` (`renderer.mts:833`).
2. **Edge routing is CPU-canonical.**  `store/curve-index.mts`
   derives every family's route (v3's derivation verbatim, per its
   header), and the public accessors read it with no renderer:
   `controlPoints()` (`collection.mts:3347`), `segmentPoints()`
   (`collection.mts:3400`), endpoints including the *arrow* points
   `asx/asy` recorded `spacing` behind each boundary
   (`collection.mts:3442-3482`, `curve-geometry.mts:202`, `:811`),
   and midpoint + tangent (`curve-geometry.mts:1899`).  This is
   exactly the surface `routing.spec.js` compares numerically with
   no WebGPU adapter and no frame drawn.
3. **Arrow polygons are CPU tables; arrow *rotation* is the one
   GPU-only derivation.**  `shape-points.mts:185` holds
   `ARROW_POINTS` in v3's arrow frame (tip at (0,0), lateral
   ±0.15), plus the compound tables and the computed
   `ARROW_MAX_BACK`/`ARROW_AXIAL_DEPTH`.  The head's
   position+rotation quad is built in the arrow vertex shader; the
   CPU carries twins of `boundaryOffset`/`arrowGap`/`arrowSpacing`
   (`curve-geometry.mts:66`, `:117-134`) but no per-end *angle*
   accessor exists today (to-verify at build time: none found by
   grep; the serializer derives angles from the stored routes'
   end tangents, which is new CPU code with a WGSL twin to agree
   with).
4. **Label shaping is a pure CPU module with injected advances**
   (`label-wrap.mts:1-28`): the renderer's LabelLayer runs it with
   real atlas advances (exact dims fed back to the store,
   `label-layer.mts:169`), the headless estimator with flat
   per-character advances (`graph-store.mts:4029`, a recorded
   approximation).  Labels are model-space only, which is what
   makes export WYSIWYG (`src/README.md`, "Labels are model-space
   only").  The font is one global family/style/weight feeding one
   atlas (`style.mts:493` default `sans-serif`;
   `graph-store.mts:280`) — SVG `<text>` can carry that exact CSS
   font string, and there is no per-element font to represent.
5. **Everything else the SVG needs has CPU style records:**
   gradients (`background-fill` linear/radial with ≤5 stops,
   `style.mts:268-273` → `<linearGradient>`/`<radialGradient>`
   defs), line/border dashes already normalized to two on/off
   pairs (`style.mts:359-365`, `:250-257` → `stroke-dasharray`),
   pie/stripe chart records (`style.mts:1685-1690`), node shape
   polygon tables (`shape-points.mts`, the same tables the SDF and
   the exact CPU pick consume), corner radii, hollow/filled arrow
   fills (`style.mts:378-381`).  Paint order is explicit in
   `drawScene` (`renderer.mts:1710`): parent bodies under
   everything, then parent decorations, edges, arrows, node
   underlays/bodies/images/charts/overlays, node labels, edge
   labels — SVG is painter's order, so the serializer emits in
   that sequence and the round-14 z-decisions carry over for free.

One trap verified so it is designed around: edge opacity is folded
into the stored arrow alpha at style-write time
(`arrow-pipeline.mts` header comment) — the serializer reads
**style records and store sidecars**, never the GPU-mirrored
columns, or it inherits render-encoding artifacts.

### 77.1 — the serializer core: nodes, paint order, viewport

New `src/svg-export.mts`: a pure string builder (no DOM — the
round-78 headless path depends on this) over the store + style
engine.  Scope: the export view math extracted from
`computeExportView` into a shared renderer-free helper (full =
`store.boundingBox()`, viewport = container or
headless dims; `scale`/`maxWidth`/`maxHeight` set the SVG
width/height while the viewBox carries model coords — no texture
cap applies, record that as the deviation it is), `bg`, node
bodies from the shape tables (polygons as `<path>`,
ellipse/rectangle/round-rect analytic), borders with style/dash,
gradients as defs, opacity, visibility/display gating as the cull
does.  Files: `src/svg-export.mts`, `src/core.mts` (`cy.svg()`),
`src/public-types.mts` (`SvgExportOptions extends` the shared
subset of `ExportOptions`, minus `quality`, plus `output:
'string' | 'base64uri' | 'blob'`).  Returns a promise for
consistency with `png()`/`jpg()` even though the common path is
synchronous — image embedding (77.4) is genuinely async, and one
signature is kinder than two.  New throws (empty-graph `full`,
zero-sized viewport, invalid `output`) each with a spec — the
throw gate stays at zero.  **Verification:** Node specs asserting
structure on the string (element counts, path data numerically
against `position()`/size getters), each shown able to fail by
skewing the serializer's transform.

### 77.2 — edges and arrows: the routes serialized

Scope: every curve family from the accessors' own data — straight
(chord between the round-55 boundary endpoints), bundled bezier
(quadratic `Q` through the control point), unbundled bezier,
segments (`L` runs), round-segments/round-taxi (arc corners — see
the gate below), taxi, haystack, loops — plus `stroke-dasharray`
from the normalized pairs and the arrow heads: `ARROW_POINTS`
polygons placed at the CPU arrow points with angles derived from
the route end tangents (the one new geometry derivation, kept in
`curve-geometry.mts` beside its WGSL twins so the agreement is
by-construction like gap/spacing), hollow heads as stroked paths,
mid-arrows at the midpoint+tangent.  **Measure-first gate:**
round-segments/round-taxi corners and loop curves can be emitted
as true arcs/beziers or as sampled polylines at the shader's
`CURVE_SEGS`; build the analytic form only if a sampled control
scene shows visible divergence at close-up zoom — otherwise
sampling wins on simplicity and matches the GPU by construction.
**Verification:** Node specs diffing emitted path anchor points
against `controlPoints()`/`segmentPoints()`/endpoint accessors
numerically (the routing.spec.js discipline, in-process); control:
skew the tangent derivation and watch the arrow-angle spec fail.

### 77.3 — labels: real text, pinned breaks

The fidelity call, stated as contract: **SVG uses real `<text>`,
not SDF glyph quads.**  Line breaking is *pinned* by the export —
the serializer runs the same `breakLines` the renderer ran, with
the renderer's atlas advances when a renderer exists, and emits
one `<text>`/`<tspan>` per broken line with explicit x/y and
`text-anchor` from the justification — so a viewer's font engine
can never reflow the block; only intra-line glyph spacing may
differ from the GPU raster.  Scope: halign/valign anchoring,
`text-rotation` incl. edge `autorotate` (a `rotate` transform at
the midpoint tangent), text outline as paint-order stroke, text
background rect, margins, end labels, `min-zoomed-font-size`/LOD
evaluated at the export scale exactly as the GPU export does
(`src/README.md`, round 9.6).  The global font family/style/weight
is emitted verbatim on a group.  **Verification:** Node structural
specs (line count and per-line text against `estimateBlock`'s
breaks); browser parity in 77.5.

### 77.4 — images, charts, compounds, the rest of the surface

Background images as `<image>` (async: data-URI embedding via the
image registry when the raster is held, URL passthrough
otherwise — the CORS/embedding split is an Open item), pie/stripe
charts as arc-wedge/band paths clipped to the node shape,
compound parent bodies in their draw position, ghost/underlay/
overlay quads, selection styling deliberately **excluded** (the
canvas overlay rule: v4 exports never include the selection box —
same here).  A `src/README.md` section writes the **fidelity
contract** as a table: representable exactly / representable with
recorded deviation (text rasterizes through the viewer's font
engine; overlapping translucent hollow arrows composite rather
than erase — the round-56 recorded deviation carries over) / not
represented (anything GPU-transient like mid-tween GPU-owned
positions: the serializer reads the CPU model, so a mid-animation
`svg()` sees the CPU-stale value — recorded, with the `png()`
contrast stated).

### 77.5 — the parity suite: rasterize and compare, with controls

New `playwright-tests/svg-parity.spec.js` + a scene page under
`playwright-page/`: for each scene, render live, `cy.png()` at
scale 1, `cy.svg()`, inject the SVG **inline** into the page (an
`<img>`-loaded SVG cannot reach the document's fonts; inline
`<svg>` uses the vendored Open Sans the label harness already
loads), screenshot the SVG element, pixelmatch the pair under a
per-scene bound.  Scenes are per-feature and built to expose, not
conceal (the round-55/56 lessons: hollow and translucent heads,
thick-line/small-head, many ends, close-up tier at zoom 3-4 where
AA cannot hide geometry).  Label scenes carry their own looser
bound with the reason written down (Skia text vs SDF text is a
real, accepted difference); geometry scenes stay tight because
their ink is identical by construction.  **Every scene runs its
control once, deliberately broken** (serializer transform skewed,
arrow angle negated, dash pattern dropped) and the mismatch must
jump — a scene that cannot fail is deleted, per the standing rule.
**Measure-first gate:** if the all-features composite scene cannot
discriminate under any bound (AA noise dominating), it is dropped
in favor of the per-feature set alone, and that finding is
recorded rather than tolerated.

### 77.6 — close

JSDoc (`@param`/`@returns`/`@throws` at 100%), d.ts regenerated,
`src/README.md` fidelity contract, MIGRATING/CHANGELOG rows (v3
had no core SVG; the `cytoscape-svg` extension's users are the
audience), `EXECUTIVE_SUMMARY.md` rewritten, gates green
(`test:js`, `test:modules`, `test:throws` at zero, Playwright
incl. the new suite).

### Risks named at planning

The SDF-vs-real-text divergence is the honest ceiling on pixel
parity — the design accepts it as contract rather than chasing
glyph-quad SVG output, and the per-line pinning bounds the damage
to intra-line spacing.  The arrow-angle derivation is new CPU
geometry with a shader twin; it gets the gap/spacing treatment
(shared constants, generated agreement) or it will drift.  Output
size on the 465k-edge fixture is unmeasured — measure before
promising anything; a `full` export of ndex-x-large may be a
string no viewer opens, and that is an editorial limit to
document, not an engineering fix this round.  The serializer
reading style records means every future style prop has an SVG
half to consider; the fidelity-contract table in `src/README.md`
is where that debt becomes visible instead of silent.

**Open:** whether `svg()` throws on headless instances in this
round (renderer-free by construction, but label advances degrade
to the flat estimate — round 78 owns making that respectable, so
the conservative call is to allow it and record the estimate
deviation now); image embedding policy (data-URI embed vs href
passthrough, a CORS and file-size trade the maintainer should
pick); whether hollow *mid* arrows — already a recorded GPU
deviation (open call 21) — are drawn trimmed in SVG or kept
deviation-identical; PDF stays out of scope (SVG is the input
every PDF toolchain wants — say so in the docs and close #639's
sibling asks by pointer).
