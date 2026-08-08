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
  early-z, and an adaptive render scale.
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
- **The `force` layout** — GPU-native spring–electric, animating live at 100k
  nodes, with a CPU reference executor for headless and compound graphs.
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

### Changed

- **The stylesheet is `{ nodes, edges, parents, core }`** — an object of
  property objects, not a list of selector blocks. State-dependent styling
  is a `case` condition rather than a `:selected`-style block.
- **Draw order is structural** and stays that way: compound parents, then
  edges, then leaf nodes, then labels; slot order within a stream.
- **Animations run concurrently by channel** and sequence by promise;
  overlapping channels evict the older animation in place.
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

- **Selector strings**, everywhere — and `cy.$()` with them (`cy.$id()` is
  the id lookup). Passing one throws, naming the replacement.
- **Classes** (`addClass`/`removeClass`/`toggleClass`/`hasClass`/
  `flashClass`) — `data()` plus mappers is the replacement.
- **Style functions** (`( ele ) => props`) and **per-element style bypass**
  (`ele.style( name, value )`) — both throw.
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
- `cytoscape.warnings()` and the error policy behind it.
- Functional `preventDefault()` for v4's own gesture defaults; the DOM half
  works.
- Core, collection and renderer extension points.

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
