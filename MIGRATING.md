# Migrating from Cytoscape.js 3 to 4

v4 is a deliberate break, not an incremental release. The model is columnar
(typed-array columns, stable slots) and the renderer is WebGPU, and several
v3 APIs were removed rather than reimplemented — because keeping them would
have blocked the design, or because v4 has one name for the concept where v3
had two.

This guide is the porting reference: what changed, what it changed *to*, and
what has no replacement. It is written from the decided-design ledger in
`src/README.md`, and every property and default named here was **measured
against the running library** rather than transcribed.

> **v4 is not released yet.** For production use `cytoscape@3` and
> [js.cytoscape.org](https://js.cytoscape.org).

---

## Contents

1. [Before you start](#before-you-start)
2. [The five changes that touch every app](#the-five-changes-that-touch-every-app)
3. [Selector recipes](#selector-recipes)
4. [Style properties that moved](#style-properties-that-moved)
5. [Events](#events)
6. [Behaviour to re-check](#behaviour-to-re-check)
7. [Constructor options](#constructor-options)
8. [Layouts and extensions](#layouts-and-extensions)
9. [Worth adopting once you have ported](#worth-adopting-once-you-have-ported)
10. [Not ported](#not-ported)

---

## Before you start

**Rendering requires WebGPU.** With a `container`, the factory throws
synchronously when `navigator.gpu` is missing, and `cy.ready` rejects when no
adapter can be acquired. There is no canvas fallback — v4's renderer is a
WebGPU pipeline, not a mode of v3's.

**Headless requires nothing.** Omit `container` and the whole model, style
engine, layouts and algorithms run in Node. Every v4 API except image export
works headless, which is also how the test suite runs.

**Types ship**, and they are the fastest porting tool you have: a v3 app run
through `tsc` against v4's declarations will surface most of this document as
compile errors before you run anything. `cy.on( 'tap', 'node', h )` is the
exception worth knowing — the selector string is a *runtime* rejection.

---

## The five changes that touch every app

### 1. There are no selector strings

v4 has no selector parser and no dialect of one. The language is replaced by
three mechanisms, split by role:

```js
// v3
cy.$( '#a' );
cy.nodes( ':selected' );
cy.filter( '[weight > 0.5]' );
cy.on( 'tap', 'node', handler );

// v4
cy.$id( 'a' );                                  // id -> the O(1) id index
cy.nodes( { selected: true } );                 // query object -> a columnar scan
cy.nodes( { data: { weight: { gt: 0.5 } } } );  // data conditions, same scan
cy.on( 'tap', ele => ele.isNode(), handler );   // predicate delegation
```

- **Query objects** answer whole-graph questions and compile to per-group
  flag tests answered in one pass over the columns. Keys: `group`,
  `selected`, `parent`, `child`, and `data`. An unknown key throws — a typo
  must not silently match everything.
- **Predicates** are plain functions and cover everything richer. In `off()`
  they compare by identity, so removing a delegated handler takes the same
  `( events, predicate, handler )` triple that added it.
- **`cy.$()` is gone.** `cy.$id()` / `cy.getElementById()` is the id lookup.

Passing a selector string anywhere throws with the replacement named — at the
query compiler, at the twelve collection methods that take another collection,
and at event delegation. It is a loud failure by design; before round 29.3
some of these were silent.

### 2. There are no classes

`addClass`/`removeClass`/`toggleClass`/`hasClass`/`flashClass` and class
selectors are gone. The role classes played — user-defined state that drives
filtering and styling — belongs to `data()` plus mappers:

```js
// v3
node.addClass( 'highlighted' );
// style: { selector: '.highlighted', style: { 'background-color': 'red' } }

// v4
node.data( 'highlighted', true );
// style: { nodes: { 'background-color': {
//   case: [ { when: { data: 'highlighted', eq: true }, then: 'red' } ],
//   else: '#666'
// } } }
```

The style updates automatically: a data write re-derives exactly the mapped
channels that depend on the written key.

### 3. The stylesheet is an object, not a list of selector blocks

```js
// v3
style: [
  { selector: 'node', style: { 'background-color': '#666' } },
  { selector: 'edge', style: { width: 3 } },
  { selector: ':parent', style: { 'background-color': '#eee' } }
]

// v4
style: {
  nodes: { 'background-color': '#666' },
  edges: { width: 3 },
  parents: { 'background-color': '#eee' },
  core: { 'selection-box-color': '#ddd' }
}
```

Four groups, fixed: `nodes`, `edges`, `parents` (overlaying `nodes` for
compound parents) and `core` (v3's core-selector props). Per-element
variation is **declarative** — a mapper, not a block:

```js
// v3: a style function
{ selector: 'node', style: { width: ele => ele.data( 'size' ) * 2 } }

// v4: a scale mapper
{ nodes: { width: { data: 'size', range: [ 10, 80 ] } } }

// v4: a conditional
{ nodes: { shape: { case: [ { when: { data: 'type', eq: 'gene' }, then: 'ellipse' } ],
                    else: 'rectangle' } } }
```

A style group written as a function **throws**, naming mappers as the
replacement. That is worth knowing precisely, because before round 29.3 it
was silently ignored: a v3 sheet ported wholesale produced an unstyled graph
and no error at all.

There is also **no per-element bypass** — `ele.style( name, value )` throws.
Mappers are the per-element mechanism.

**CSS-string stylesheets and `cytoscape.stylesheet()` are gone** with the
block form.

### 4. Animations sequence by promise, not by queue

```js
// v3
node.animate( { position: p1 } ).animate( { position: p2 } ); // queued

// v4
await node.animate( { position: p1 } ).promise();
node.animate( { position: p2 } );
```

Animations on **disjoint channels run concurrently** (a position tween and an
opacity fade compose). Starting one that overlaps a running animation's
channels stops the older one in place — its promise resolves, its values
freeze, and the new one captures from there.

There is no `queue` option, and the spelling **throws** (there is no queue to
opt out of). The v3 `step` callback is out too: use `onRender` plus promises.
`stop()` lost its `clearQueue` argument — it is `stop( jumpToEnd )` now.

### 5. Removed elements are terminally dead

`remove()` tombstones the slot, bumps its generation and returns it to the
free list; the next `add()` may recycle those bytes. So a removed element is
not readable and not restorable:

- `restore()`, `clone()`, `copy()` — **gone**
- `cy.json( obj )` (the import form) — **throws**; `cy.json()` export works

Only the handle's cached `id()` and `group()` survive removal, which is what
keeps `remove` handlers and predicates working. Re-adding from definitions
you kept is the app's job — exported element JSON round-trips through
`cy.add()`.

---

## Selector recipes

| v3 selector | v4 |
| --- | --- |
| `cy.$( '#a' )` | `cy.$id( 'a' )` |
| `cy.$( 'node' )` | `cy.nodes()` |
| `cy.$( 'edge' )` | `cy.edges()` |
| `cy.$( '*' )` | `cy.elements()` |
| `cy.$( 'node:selected' )` | `cy.nodes( { selected: true } )` |
| `cy.$( ':unselected' )` | `cy.elements( { selected: false } )` |
| `cy.$( ':parent' )` | `cy.nodes( { parent: true } )` |
| `cy.$( ':childless' )` | `cy.nodes( { parent: false } )` |
| `cy.$( ':child' )` | `cy.nodes( { child: true } )` |
| `cy.$( ':orphan' )` | `cy.nodes( { child: false } )` |
| `cy.$( '[weight > 0.5]' )` | `cy.nodes( { data: { weight: { gt: 0.5 } } } )` |
| `cy.$( '[type = "gene"]' )` | `cy.nodes( { data: { type: 'gene' } } )` |
| `cy.$( '[type != "gene"]' )` | `cy.nodes( { data: { type: { ne: 'gene' } } } )` |
| `cy.$( '[^weight]' )`, `[?weight]` | a predicate: `cy.nodes( n => n.data( 'weight' ) == null )` |
| `cy.$( '.cls' )` | `cy.nodes( { data: { cls: true } } )` — classes are data now |
| `cy.$( 'node[x], edge[y]' )` (comma) | two queries plus `.union()` |
| `eles.filter( 'node' )` | `eles.filter( { group: 'nodes' } )` or `eles.nodes()` |
| `node.neighborhood( '.foo' )` | `node.neighborhood().filter( pred )` |
| `cy.on( 'tap', 'node', h )` | `cy.on( 'tap', ele => ele.isNode(), h )` |

Data-condition operators: `eq`, `ne`, `lt`, `lte`, `gt`, `gte`, `in`. A bare
value means `eq`; keys within one object are AND-ed; a missing value fails
every operator, `ne` included.

---

## Style properties that moved

v3 registers **291** property names (properties plus aliases). v4 accepts
**153** of them — 7 only in the `core` group — and rejects **138**. Of the
rejections, 96 are v3's numbered `pie-N-*` / `stripe-N-*` props, which became
one `chart` family. The remaining 42 are the table below.

*(Measured against both libraries, not transcribed. A rejected property name
throws at `cy.style()` with "The style property 'x' is unsupported"; v4 never
ignores one silently.)*

| v3 property | v4 |
| --- | --- |
| `z-index`, `z-compound-depth`, `z-index-compare` | **dropped outright.** Draw order is structural: compound parents, then edges, then leaf nodes, then labels; slot order within a stream |
| `pie-*` (48), `pie-size`, `pie-hole`, `pie-start-angle` | `chart: 'pie'` + `chart-values`, `chart-colors`, `chart-size`, `chart-hole`, `chart-start-angle` |
| `stripe-*` (48), `stripe-size`, `stripe-direction` | `chart: 'stripes'` + the same family, plus `chart-direction` |
| `content` | `label` |
| `padding-left/-right/-top/-bottom` | `padding` (one value; per-side padding is a logged future extension) |
| `min-width-bias-left/-right`, `min-height-bias-top/-bottom` | **dropped.** `min-width`/`min-height` clamp centred — v3's default-bias behaviour |
| `display` | `show()` / `hide()` for the structural tier; the `visibility` style prop for paint-only invisibility |
| `position` | not a style property — use `ele.position()` |
| `text-metrics` | `eles.labelBoundingBox()` |
| `box-select-labels` | the core option `boxSelectionIncludesLabels` |
| `box-selection` | the core option `boxSelectionMode` (`'contain'` \| `'overlap'`); its third value `'none'` is the `events` property |
| `edge-text-rotation` | `text-rotation` (a keyword `autorotate`, or a number of radians on any label) |
| `control-point-distance` | `control-point-distances` (plural — v4 has no singular alias) |
| `segment-distance`, `segment-weight`, `segment-radius` | `segment-distances`, `segment-weights`, `segment-radii` |
| `background-blacken` | **dropped.** Compute the shade in a colour mapper's range |
| `bounds-expansion` | **dropped.** Bounds are computed correctly instead |
| `outside-texture-bg-color/-opacity` | **dropped** with `textureOnViewport` |
| `mid-source-arrow-fill/-width`, `mid-target-arrow-fill/-width` | **unsupported.** Mid arrows are always filled at standard width |
| `border-style`, `outline-style`, `text-border-style` | **not yet ported** — see [Not ported](#not-ported) |
| `border-dash-pattern`, `border-dash-offset`, `border-cap`, `border-join` | **not yet ported**, with `border-style` |

Also renamed or re-scoped without being rejected:

- **`font-family`, `font-style`, `font-weight` are global constants.** The
  glyph atlas holds one face, so these are effectively per-instance; a change
  resets the atlas and re-lays out every label. Per-element fonts are out of
  scope. Mappers on them throw.
- **The no-dash legacy shape spellings throw**: `roundrectangle`,
  `cutrectangle`, `concavehexagon`. Use `round-rectangle`, `cut-rectangle`,
  `concave-hexagon`. This applies in all three enums that took them — the node
  `shape`, `overlay-shape`/`underlay-shape`, and `text-background-shape`.
- **Channel opacities fold at write time.** `background-opacity`,
  `border-opacity`, `line-opacity` and `text-opacity` fold into the stored
  channel alpha; element `opacity` stays the master multiplier. Reading them
  back gives the folded value.

---

## Events

**The vocabulary is curated.** v4 emits the drag-state family
(`grab`/`grabon`/`drag`/`free`/`freeon`/`dragfree`/`dragfreeon`), the
device-normalized family (`tapstart`, `tapdrag`, `tapend`, `tap`, `taphold`,
`dbltap`, `onetap`, `tapselect`/`tapunselect`, `tapdragover`/`tapdragout`,
the `cxt*` family), the viewport gestures (`dragpan`, `scrollzoom`,
`pinchzoom`), the official pointer family (`pointerdown`/`pointermove`/
`pointerup`/`pointercancel`/`pointerover`/`pointerout`), and the model events
(`add`, `remove`, `data`, `position`, `select`, `unselect`, `style`,
`layoutstart`/`layoutready`/`layoutstop`, `render`, `destroy`, `error`,
`mouseover`/`mouseout`, `box`/`boxstart`/`boxend`/`boxselect`,
`devicelost`/`devicerestored`, `move`/`moveout`).

**Dropped names register and then never fire, silently.** This is the porting
hazard worth reading twice:

```js
cy.on( 'mousedown', h );   // registers fine. Never fires.
cy.on( 'click', h );       // registers fine. Never fires.
cy.on( 'vmousedown', h );  // registers fine. Never fires.
cy.on( 'touchstart', h );  // registers fine. Never fires.
```

They cannot be rejected, because custom events are supported API —
`ele.emit( 'myEvent' )` must keep working, so a name cannot be validated
against a list. Port event names **from the vocabulary**, not by trying them.
`pointer*` is the modern spelling of the raw mouse/touch re-emits;
`mouseover`/`mouseout` do still fire.

**There are no namespaces.** A type is matched whole, so `'tap.ns'` is one
literal name that `emit( 'tap' )` does not reach and `off( 'tap.ns' )`
removes on its own. (v4 inherited v3's namespace semantics by accident until
round 41 gave it its own emitter; if you tested against an older v4 build,
re-check.)

**`event.preventDefault()` is half wired.** `originalEvent` is populated, so
the call reaches the browser's default — but no v4 code reads
`isDefaultPrevented()`, so it cannot stop a tap from selecting or a grab from
starting. Those defaults are gated by options (`autounselectify`,
`autoungrabify`, `userPanningEnabled`, …) instead.

**Bubbling** works as in v3 for compounds: origin → ancestors → core, with
`event.target` the originator and `stopPropagation()` (or returning `false`)
halting the walk. The one deviation is *within* a phase, where listeners fire
in plain registration order.

---

## Behaviour to re-check

These compile and run, but behave differently. They are the things a ported
app trips on after everything else works.

| Area | v3 | v4 |
| --- | --- | --- |
| Default `curve-style` | `bezier` | **`straight`** — opt into `bezier` explicitly. It is the perf-first default at v4's target scales |
| Default `text-valign` | `top` | **`bottom`** — v4 keeps its below-node placement |
| Draw order | `z-index`, then a whole-scene comparator sort | structural, permanently. A grabbed node does **not** pop above later-inserted nodes |
| `cy.elements()` order | mixed insertion order | **nodes then edges** |
| Position precision | Float64 | **Float32** (~7 significant digits) |
| `bezier` bundling | same | same — a *lone* edge under `curve-style: bezier` still renders straight; only parallel edges fan |
| Colour animation | per-channel sRGB | **OKLab**, matching colour mappers |
| `spring()` easing | `spring( tension, friction )` | **`spring( bounce )`** — one number; 0 is critically damped |
| Custom easing functions | accepted | **throw.** A closure cannot cross to the GPU; `cubic-bezier()` and `linear()` cover any drawable curve |
| Label bounding boxes | opt-in | **`boundingBox()` includes labels by default**; opt out with `{ includeLabels: false }` |
| Arrow sizing | `max( (13.37w)^0.9, 29 )` | the same formula, ported in round 27.3 — earlier v4 builds differed |
| `outerWidth()` with a border | includes the miter overshoot | plain border-inclusive `outerHalf`, so parent boxes can sit sub-pixel smaller |
| Compound auto-sizing | can include labels | reads child **body** extents only (`compound-sizing-wrt-labels: 'include'` throws) |
| `:parent:selected` | tints parents | **not ported** — v4 never restyles on selection; the accent ring is drawn by the shader |

**Selection never restyles.** v3's `:selected` blocks are gone; the selection
affordance is a shader-drawn accent ring. If your app coloured selected
elements through a `:selected` block, that visual is now the ring — or a
`case` mapper over a data key you set yourself.

---

## Constructor options

**Unknown options are ignored at runtime, deliberately.** `{ motionBlur:
true }` and `{ totallyUnknownOption: 1 }` both construct happily and
round-trip through `cy.options()`. The typo guard is TypeScript's
excess-property check against `CytoscapeOptions` — v4 does not replicate at
runtime what the build already checks. (Note the boundary: excess-property
checking applies to object *literals*, so options assembled into a variable
first are widened and pass.)

Dropped, and therefore ignored: `hideEdgesOnViewport`, `textureOnViewport`,
`motionBlur`, `motionBlurOpacity` — canvas-era degradation modes that compute
culling and the adaptive render scale solve without degrading output.

New, and worth setting: `boxSelectionMode`, `boxSelectionIncludesLabels`,
`wheelSensitivity`, `desktopTapThreshold`, `touchTapThreshold`,
`tapholdDuration`, `multiClickDebounceTime`, `pixelRatio`, and the `renderer`
block (`renderScaleMin`/`renderScaleMax`, `labelMinPx`, `imageMinPx`,
`imageMaxSize`).

---

## Layouts and extensions

**Built in**: `grid`, `preset`, `circle`, `concentric`, `breadthfirst`,
`random`, and `force` — a GPU-native spring–electric layout that animates
live at 100k nodes.

**`cose` is not ported.** Its option surface and per-iteration structure are
CPU-shaped; `force` is v4's answer, and it converges in about a second on
graphs where cose exceeds a 60-second bail. `cy.layout({ name: 'cose' })`
throws, listing the built-ins.

**There is no extension registry.** No `cytoscape.use()`, no string
registration, no global state. An extension layout is an import you pass in:

```js
import Fcose from 'some-layout';

cy.layout( { impl: Fcose, ...options } ).run();
```

The implementation is a class or object with `{ run( ctx ), stop?() }`, where
`ctx` is a `LayoutContext` — columnar-first (`nodeSlots()`, live `positions()`
views, O(1) `degreeOf`, bulk `setPositions`) with handles still reachable at
`ctx.eles`. `LayoutContext`, `LayoutImpl` and `CustomLayout` are exported
types. Core, collection and renderer extension points stay out for 4.0.

Layout lifecycle events fire **on the core**, exactly once per run; layout
instances are not emitters.

---

## Worth adopting once you have ported

- **Columnar and binary loading.** `cytoscape.toColumnarElements( json )`
  converts the definition form; `cytoscape.serializeElements()` produces one
  little-endian `ArrayBuffer` that `options.elements` and `cy.add()` accept
  directly. On a 19.6k-node / 465k-edge graph that is 9.2 MB and ~5 ms
  against 28.6 MB and a ~100 ms JSON parse.
- **Mapper domains.** An explicit `domain` keeps a data write O(changed);
  `'auto'` is a live extent and pays O(n) only when a write actually moves it.
  Pin `domain` when a stream grows its own extent.
- **Style transitions** — `transition-property`/`-duration`/`-delay`/
  `-timing-function` per sheet group, tweening whenever a restyle changes a
  stored channel.
- **`cy.compact()`** (alias `cy.gc()`) after a big removal, though an
  automatic trigger already fires at safe boundaries.
- **`cy.pick( x, y )`**, which resolves node hits synchronously on the CPU.

---

## Not ported

Deliberately, with no replacement planned:

- classes, selector strings, style functions, per-element style bypass
- `z-index` and companions; `sortByZIndex`, `zDepth`
- `restore`/`clone`/`copy`, `cy.json()` import
- event namespaces; the `vmouse*` aliases and raw mouse/touch re-emits
- `cy.notify()`/`noNotifications()` (the renderer is dirty-driven)
- `renderTo`
- per-element `font-family`; viewport-fixed labels
- the canvas-era performance options

Not yet built, and tracked:

- **`border-style` / `outline-style` / `text-border-style`** — the technique
  is settled and the scope call is taken (full coverage, every shape); three
  sub-questions are open. See PLAN.md's open call 1.
- **`cytoscape.warnings()`** and the error policy behind it.
- **Functional `preventDefault()`** for v4's own gesture defaults.
- Core/collection/renderer extension points — demand-gated.

---

For the reasoning behind any decision here, `src/README.md` is the maintained
record and `PLAN.md` is the development log. Both are in the repository, not
in the published package.
