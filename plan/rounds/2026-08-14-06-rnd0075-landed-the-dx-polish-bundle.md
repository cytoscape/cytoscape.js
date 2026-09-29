## The DX polish bundle

Six small items from the backlog's DX bundle, each re-verified
against the source before planning — which mattered immediately:
two of the six are further along than their backlog sentences say.
The auto-resize observer **already exists**, unrecorded and
untested; the font re-raster hook **already lands the hard half**
(the round-10 `loadingdone` listener re-measures and re-rasters
everything), and what remains are its edge cases.  What the code
does today, verified:

1. **Container auto-resize (#2401) is two-thirds landed.**  The
   renderer installs a `ResizeObserver` on the container at
   construction (`src/render/renderer.mts:356-360`, arriving with
   the round-42 restructure blob; no PLAN.md round records it) and
   disconnects it on destroy (`renderer.mts:458`); `resize()`
   itself (`renderer.mts:402-410`) re-applies size and schedules a
   redraw, and its own doc comment already describes the observer.
   Headless is a structural no-op — no renderer exists to observe.
   The gaps: the observer calls `renderer.resize()` directly, so
   the public `'resize'` event fires only from manual `cy.resize()`
   (`src/core.mts:2008-2013`); no option gates the observer; and
   **no spec anywhere exercises the observer path** — grep
   `playwright-tests/` for `resize`: nothing.
2. **Font-load re-raster (#3408 + the round-9.7 follow-up) landed
   its core in round 10.**  `renderer.mts:302-317` hooks
   `document.fonts` `'loadingdone'` → `labelLayer.reraster()`
   (`src/render/label-layer.mts:70-74`: atlas reset, shaping memo
   cleared, `markAllLabelsDirty` — a full re-measure, not just new
   pixels), removed on destroy (`renderer.mts:462-468`), pinned by
   a Playwright spec (`renderer.spec.js:5102`).  The verified
   gaps: (a) *any* `loadingdone` — an unrelated icon font — costs
   a full atlas re-raster and every-label re-layout; (b) the spec's
   own comment names the constraint — "a set-initiated load, so
   the FontFaceSet fires 'loadingdone'" — and the other order,
   `face.load()` *then* `document.fonts.add(face)`, fires no event
   at all, leaving fallback glyphs forever; (c) no
   `document.fonts.ready` belt exists; (d) there is no user escape
   hatch — `setFont` with the same family early-returns
   (`src/render/glyph-atlas.mts:243-249`).
3. **Collections are not iterable.**  `Symbol.iterator` appears
   nowhere in `src/`; iteration is `forEach`/`each`
   (`src/collection.mts:683,6321`), `toArray`, and numeric index +
   `length` (`collection.mts:232-238`, interned singleton handles
   per slot).  `cy.add` takes `ElementsInput`
   (`src/public-types.mts:134-139`): defs (array or
   `{nodes,edges}`), columnar, or a wire `ArrayBuffer`/view —
   no generic iterables.  Hazard verified for the design: typed
   arrays are themselves iterable, so any iterable branch must sit
   *after* the wire-payload checks.
4. **The elements-at-position internals are public in one half
   already.**  `cy.pick(x, y)` — async, CSS px, exact, null when
   headless — has shipped since the pick work
   (`core.mts:1980-1984`), resolving through the 3-stage renderer
   pick (`renderer.mts:521-568`: sync CPU node pick → cached tile
   → GPU edge tile).  The sync CPU node pick `pickNodeSync`
   (`renderer.mts:580`) is what the pointer layer uses for
   pan-vs-grab (`src/interact/pointer.mts:371`) — but it is absent
   from `RendererLike` (`core.mts:82-95`), so no public surface
   reaches it.  #1209 reduces to: expose the sync half, and name
   the pair.
5. **Gesture toggles: the quartet + tuning options exist
   (`public-types.mts:610-672`), the wheel is hardwired, and one
   real deviation surfaced.**  `onWheel`
   (`pointer.mts:235-277`) calls `e.preventDefault()`
   **unconditionally, before** the `userZoomingEnabled` check — so
   a zoom-disabled v4 canvas still swallows page scroll, where v3
   preventDefaults only when all four pan/zoom toggles allow it
   (`v3/src/extensions/renderer/base/load-listeners.mts:
   1130-1131`).  Trackpad pinch arrives as ctrl+wheel through the
   same path (`pointer.mts:50-51`).  Drag-from-element panning
   needs **no new toggle**: per-element `pannable` exists
   (`public-types.mts:33`, edges default true), `panify`/
   `unpanify` exist (`collection.mts:3772,3782`), pannable
   overrides grabbable in `canDrag` (`pointer.mts:494`), and a
   press on any non-draggable node already pans
   (`pointer.mts:385-387`).  The 41.5 decree stands: toggles are
   the whole story, `preventDefault()` is browser-level only —
   new *options* are the sanctioned mechanism.
6. **Cull counts are on-device only.**  The compaction's scan
   writes `instanceCount` into the indirect args
   (`src/render/cull.mts:445`) in a buffer created
   `STORAGE | INDIRECT` — no `COPY_SRC`, and no readback of it
   exists anywhere (`cull.mts:862`); `stats()` reports *store*
   counts, not visible ones (`renderer.mts:382-383`).  So the
   decision the backlog left open is decided by the code: **exact
   viewport counts need a readback, so the API is async** — the
   `picking.mts` staging/coalescing pattern is the in-repo
   precedent.  The model-space sync form already exists as a
   composition: `cy.elementsInBox(...)` (`core.mts:1274`) over
   `cy.extent()` (`core.mts:1824`) — geometric containment, which
   deliberately does not see draw-tier hide/LOD.

Sequencing: the items are independent, but three of them edit
`renderer.mts`; those land in sequence (75.1 → 75.2 → 75.6) while
the core/pointer items (75.3, 75.4, 75.5) interleave freely.  Each
pass lands whole — specs, JSDoc (`@param`/`@returns`/`@throws` at
100%), d.ts regen, MIGRATING/CHANGELOG rows where public surface
moves — so an item slipping does not hold the bundle.

### 75.1 — auto-resize, recorded and closed honestly

No new machinery; the round makes the existing observer true and
proven.  (a) Route the observer through the core: the callback
becomes `this.cy.resize()` so observer-driven resizes fire the
public `'resize'` event exactly as manual calls do — one path, one
emit (no loop: `applySize` touches the canvas, and the canvas's
CSS size is 100% of the container, so the observer does not
re-fire from its own work).  (b) Decline the opt-out option and
the debounce, in writing: the observer *is* the v4 contract (the
`resize()` doc comment already says so), ResizeObserver batches
per frame and `applySize` is cheap, and `cy.resize()` stays for
what an observer cannot see (a devicePixelRatio change).  (c) The
missing coverage: a Playwright spec that resizes the container
element, awaits the `'resize'` event and asserts the canvas's
device-pixel dimensions followed — **control**: the same scene
with the observer disconnected must time out the event.  (d)
Record the observer's existence and provenance in
`src/README.md`; MIGRATING row ("no manual `cy.resize()` on
container resize — v3 needed one").

### 75.2 — the font edge cases, and the escape hatch question

Three verified gaps, smallest honest fix for each.  (a)
**Family-filter the re-raster**: `onFontsLoadingDone` reads the
event's `fontfaces` and re-rasters only when a loaded face's
family matches the atlas font (normalized: case, quotes) — an
unrelated font no longer costs an every-label re-layout.
Conservative fallback: an event with no readable face list
re-rasters as today (WebKit's event payload here is to-verify).
The match logic lands as a pure exported function with a
`test/modules/` spec; **control**: force the filter to answer
false and the round-10 Playwright late-font spec must fail.  (b)
**A `document.fonts.ready` one-shot belt**: the atlas marks
itself *provisional* when it rasters any glyph while
`document.fonts.check(font)` is false; `document.fonts.ready`
resolution re-checks and re-rasters once if still provisional —
covering a face that finishes between atlas construction and
listener traffic.  (c) **The load-then-add orphan**
(`face.load()` before `document.fonts.add`): no event exists for
it, period.  The plan's mechanism: while provisional, each
*rendered* frame re-checks `document.fonts.check` (a sync string
lookup) and re-rasters on the flip — this catches the orphan on
any page that is animating or interacting; a page fully at rest
with a post-hoc font add stays wrong until any redraw, which the
JSDoc states, with "add before load" as the documented order.
Whether that residual deserves a low-frequency timer is left to
the maintainer (Open).  New Playwright spec pinning the orphan
order end-to-end; **control**: provisional flag forced false.

### 75.3 — iterable collections

`Collection.prototype[Symbol.iterator]` yielding the interned
singleton handles off `_arr()` — so `[...eles][0] === eles[0]`
(the identity story is already the interning contract,
`collection.mts:226-229`), `for..of`, spread and `Array.from`
all work, and iteration sees the members at collection creation
(refs are immutable; dead members yield as stale handles, exactly
as `forEach` passes them).  d.ts: `Collection` implements
`Iterable<Collection>`.  `cy.add` gains generic iterables of
element definitions, materialized with `Array.from` — the branch
sits **after** `isSerializedElements`/`ArrayBuffer.isView` and
the columnar discriminant, because typed arrays are iterable and
a wire payload must never be walked as defs; a bare string (also
iterable) falls through to the existing def-validation errors, so
no new throw site is expected — if one proves necessary, it lands
with its spec for the zero-tolerance gate.  Specs extend
`test/collection-iteration.mjs` (identity, order, spread,
`Array.from`, empty collection, post-removal iteration) plus a
`cy.add(generator)` spec and a
`cy.add(wireBufferAsUint8Array)`-still-decodes regression;
**control**: an iterator yielding reversed order must fail the
order assertion.  MIGRATING row (v3 collections were not iterable
either — this is a v4 addition, not a parity item).

### 75.4 — the public sync node pick

Expose the half that interaction already trusts: `pickNodeSync`
joins `RendererLike`, and the core gains the sync counterpart of
`cy.pick` — CPU, nodes only, exact (halo-free, like `cy.pick`;
the 57.9 halos stay the gesture's), CSS px relative to the
container, `Collection | null`, null when headless (matching
`cy.pick`'s headless null — the draw-tier frame parameters
belong to a renderer).  Working name `cy.pickNode(x, y)`, final
name a maintainer call (Open).  The two-API shape is justified by
how interaction itself uses picking: pan-vs-grab *must* answer in
the same microtask (`pointer.mts:369-374`), edges genuinely need
the GPU tile — so the public surface mirrors the real split
rather than inventing a third path.  JSDoc cross-references the
pair and the halo note; d.ts regen; MIGRATING row (#1209 — v3
never had a public form).  Specs: Playwright (hit, miss,
topmost-overlap agreement with `cy.pick`, an edge answering only
through `cy.pick`); Node spec for the headless null.  Control:
the shape-aware assertions from `test/cpu-pick.mjs` are the
template — a spec named for slanted-outline picking must fail
with the shape test swapped for the bounding box (the round-27
lesson, verbatim).

### 75.5 — wheel behavior, scoped to two changes

Both inside the 41.5 settlement: options-level toggles, and the
library only ever preventDefaults events it consumes.  (a) **Fix
the deviation**: `onWheel` preventDefaults only when it will act
(zooming enabled, or the configured behavior consumes the event)
— restoring v3's contract that a zoom-disabled canvas lets the
page scroll.  This is a behavior fix, not an option.  Playwright
spec on a scrollable page: `userZoomingEnabled(false)`, wheel
over the canvas, assert `window.scrollY` moved and zoom did not;
**control**: revert the ordering.  (b) **One new option +
accessor**, `wheelBehavior: 'zoom' | 'pan' | 'modifier-zoom'`
(default `'zoom'`, the current behavior; accessor in the
`wheelSensitivity` pattern, settable at runtime).  `'pan'`:
wheel pans by delta (gated by `panningEnabled`/
`userPanningEnabled`), ctrl+wheel — the pinch encoding — still
zooms, so trackpads keep pinch-zoom.  `'modifier-zoom'`: plain
wheel is **not consumed** (no preventDefault; the page scrolls —
the embedded-map idiom of #1905/#3287), ctrl- or meta-wheel
zooms; pinch keeps working for free since it arrives as
ctrl+wheel.  Whether wheel-pan emits a `'scrollpan'` sibling to
`'scrollzoom'` in the 17.4 vocabulary is a maintainer call
(Open).  **Deliberately excluded, named**: a wheel-pan speed
multiplier, axis swap/inversion options, configurable modifier
keys, touch-gesture remapping, any preventable-gesture mechanism
(41.5, permanently), and a drag-from-element panning toggle —
verified already expressible (per-element `pannable`/`panify`,
`autoungrabify`, and the press-on-undraggable-pans default at
`pointer.mts:385-387`), so a new option would duplicate surface.
MIGRATING table row + `test/modules/migration-guide.mjs` update;
Node specs for the accessor plumbing; Playwright specs per mode;
**control**: swap the mode branch and each mode's spec must fail.

### 75.6 — viewport counts, async because the code says so

`cy.viewportCounts(): Promise<{ nodes, edges } | null>` — null
when headless (the `cy.pick` precedent; Open to a reject
instead).  Implementation: the cull groups' indirect args gain
`COPY_SRC` (to-verify against Dawn's usage validation, expected
fine); the renderer copies the `instanceCount` u32 of the four
element groups (node + parentNode, edge + curvedEdge) into one
small staging buffer — the copy encoded **after** the cull
dispatches in the same submission, so the numbers are exactly the
frame's — then `mapAsync`.  When the scene is clean, the request
schedules a frame (render-on-dirty stays intact; a pick-style
count-only frame is the cheap path).  Concurrent requests
coalesce latest-wins and resolve together; destroy/device-loss
resolves null (both patterns from `picking.mts`).  Glyph streams
are excluded and the JSDoc says why: those counts are glyph
instances, not labels.  The JSDoc also names the sync
alternative — `cy.elementsInBox(...cy.extent())` — and the
deliberate difference (model-space geometry; no hide/LOD).  The
mask form (visible-list readback → a Collection) is logged as a
follow-up, not built: counts serve #2283's stated need, and the
list is a larger readback with a compaction-order contract worth
its own round.  Specs: Playwright — known scene, exact count;
pan half the graph out, count moves; `visibility: hidden`
excluded; **control**: read args offset 0 (`indexCount`,
constant 6) instead of offset 4 and every count spec must fail.
Node: headless null; throw specs for any new guard, gate at
zero.

### 75.7 — the close

MIGRATING/CHANGELOG rows for the five public-surface moves
(pickNode, wheelBehavior + the preventDefault fix, viewportCounts,
iterables, the auto-resize event note), `src/README.md` sweep
(the observer's provenance, the font contract, the pick pair),
d.ts regenerated and committed, `EXECUTIVE_SUMMARY.md` rewritten
from this file, gates green: `test:js`, `test:modules`,
`test:throws` at zero, JSDoc three-tag 100%, oxfmt, the
`renderer` Playwright project, and goldens untouched (nothing
here should move a pixel; if one moves, that is a finding).

### Risks named at planning

- Every new Playwright spec runs on SwiftShader behind the frame
  driver: wheel and resize specs must poll for state
  (`untilMidFlight`'s rule), never sleep to an offset, and the
  first `animate()`-free frames still pay first-use pipeline
  compilation.
- The font family filter can suppress a legitimate re-raster if
  normalization misses a spelling (quoted families, fallback
  lists); the conservative no-face-list fallback bounds the
  damage, and the control run proves the filter can fail red.
- Routing the observer through `cy.resize()` emits `'resize'`
  from a browser callback — any listener that itself resizes the
  container can oscillate.  That is app behavior, but the spec
  suite should include the guard case (observer fires during an
  in-flight `applySize`), and the plan asserts no feedback loop
  from the canvas's own sizing.
- `STORAGE | INDIRECT | COPY_SRC` is expected valid everywhere
  WebGPU ships, but it is marked to-verify; if a backend rejects
  it, the fallback is a tiny dedicated copy of the args via a
  compute pass, not a feature cut.
- The stranded-doc-block hazard: 75.4 and 75.5 insert members
  into the two largest doc surfaces (`core.mts`, `pointer.mts`)
  — run the JSDoc gate before each commit, and read the d.ts
  hover text for the neighbors of every insertion.

**Open:** the maintainer decisions this plan parks rather than
guesses.  (1) Naming: `cy.pickNode` vs `cy.nodeAt` for the sync
pick, and `'modifier-zoom'` vs `'ctrl-zoom'` for the wheel value.
(2) Headless answers: null (planned) vs reject for
`viewportCounts`, and whether the sync node pick should *compute*
headless from the viewport at dpr 1 instead of answering null —
feasible, since the CPU pick reads only store columns and frame
params.  (3) Whether wheel-pan joins the 17.4 event vocabulary as
`'scrollpan'` or emits nothing.  (4) The font orphan residual: is
the rendered-frame re-check plus documented ordering enough, or
does a low-frequency provisional-state timer earn its keep?  (5)
Confirming the two declines recorded here as decisions: no
auto-resize opt-out option, and no debounce.

**Decided at the eleventh design sitting (2026-09-28):** the sync pick
is **`cy.nodeAt(x, y)`, with `cy.pickNode` as an alias**, and it
**computes headless** (store columns and the viewport at dpr 1) rather
than answering null; the wheel mode is **`'modifier-zoom'`**;
wheel-panning emits **`'scrollpan'`**; `cy.viewportCounts()` resolves
**null** headless (an honest "no renderer", as `cy.pick` and
destroy/device-loss answer); the load-then-add font orphan is
**documented only**, no timer; both 75.1 declines (no auto-resize
opt-out, no debounce) are confirmed.

### The round, as carried out (2026-09-28)

Landed the same day as the eleventh sitting, on its calls: `cy.nodeAt`
with `cy.pickNode` as an alias, computed headless; `'modifier-zoom'`;
`'scrollpan'`; `viewportCounts()` null headless; the font orphan
documented, no timer; no auto-resize opt-out and no debounce.  Built
against the tree as it stands, not as the plan knew it: the renderer
reaches the model only through the round-86 `RenderHost` (so the
observer emits through `host.emitResize()`, not `cy.resize()`), the
worker proxy (86.3) mirrors every renderer surface, the round-131 tiers
forbid the core from reaching `src/render/`, and round 79's options
schema is gated both ways against `CytoscapeOptions`.  Every plan line
reference was re-read; the files had moved under round 130's split
(`renderer/lifecycle.mts`, `renderer/frame.mts`, `pointer-handlers.mts`,
`core/elements.mts`, `core/export.mts`).

| # | Commit | What landed |
| --- | --- | --- |
| 75.1 | `d17dc272` | the observer emits `'resize'` (`observedResize`, both hosts); the two declines recorded |
| 75.2 | `51fb0653` | the filtered `loadingdone`, the provisional atlas and its `fonts.ready` belt, the load-then-add watch |
| 75.3 | `aec3368d` | `Collection[Symbol.iterator]`; `cy.add()` of any iterable of definitions |
| 75.4 | `9b091e49` | `cy.nodeAt` / `cy.pickNode`; `src/render/cpu-pick.mts` → `src/cpu-pick.mts` |
| 75.5 | `4f02fd55` | `wheelBehavior`, `scrollpan`, and `preventDefault()` only on a wheel the canvas acts on |
| 75.6 | `a33ca0d5` | `cy.viewportCounts()`, through both hosts |
| 75.7 | this commit | the close |

**Measured, and what it decided** (Chromium 149.0.7827.55 via Playwright, this
machine: the harness flags reach the AMD RX 580 — `npm run gpu`:
HARDWARE — and the debug-page drive reported adapter vendor `amd`):

- *The FontFaceSet's answers* (a probe page, 2026-09-28):
  `document.fonts.check()` is **true** for a family the set does not
  hold at all, before and after `face.load()`; `loadingdone` reports a
  face's `family` **quoted** (`"Late Font"`); adding an already-loaded
  face fires **no** event.  So the plan's orphan mechanism — mark the
  atlas provisional while `check()` is false, re-check per frame — could
  never see the load-then-add order: `check()` says true throughout.
  The orphan is caught by a different tell, the set's size, diffed on
  each rendered frame against the faces already seen; the provisional
  flag stays for the case it does fit (glyphs rastered while a face the
  set holds is still loading).  The family filter normalizes quotes
  because of the second finding.
- *The ready belt needs the check after the label pass*: the first run
  of the at-rest spec failed — the frame that rastered the glyphs was
  the last frame, so a check *before* the label pass never saw the atlas
  provisional and never armed `document.fonts.ready`.  Moved after it.
- *`STORAGE | INDIRECT | COPY_SRC`* is valid under Dawn: every
  renderer-project spec asserts an empty WebGPU validation-error log,
  and the counts specs ran green under it.  The plan's to-verify is
  closed for Dawn; WebKit's Metal backend is untested here (Linux WebKit
  has no WebGPU).
- *Stale indirect args are real*: `CulledGroup.encode()` returns early
  at a zero high-water, and the parent stream is not encoded at all
  once the last parent is gone — its args keep the old count.  The
  plan did not name this; `CulledGroup.encodes` is compared across the
  cull pass and an undispatched group reads 0, and the spec that
  flattens the last parent reads 8 nodes for 7 without it.

**Calls taken in-round, and why:**

- *75.1*: the observer emits only when the canvas's CSS box changed
  (compared before and after `resize()`), which is what keeps it to one
  event per change — no event for the initial observation, none for a
  change a manual `cy.resize()` already applied.
- *75.2*: no public re-raster call (the plan's "escape hatch
  question"): any redraw runs the check, which the README says.
- *75.3*: `cy.add( collection )` throws — iterability would otherwise
  have turned v3's restore idiom from a `TypeError` into a garbage add.
  One new throw site, spec'd, the gate at zero.  `options.elements` is
  unchanged (the JSON-shaped payload its schema describes), and
  `cy.load()` keeps reading an iterable as chunks.
- *75.4*: the CPU pick moved below the renderer tier (`src/cpu-pick.mts`,
  with `DEFAULT_HIDE_PX`/`DEFAULT_NODE_LOD_PX` beside it) because the
  import-graph spec forbids the core from reaching `src/render/`.  The
  renderer's `pickNodeSync` no longer waits for the device — the scan
  reads only the store and the viewport — so `cy.nodeAt` answers right
  after construction; the pointer's pan-vs-grab gains the same.
- *75.5*: meta counts as ctrl in both `'pan'` and `'modifier-zoom'`
  (the macOS spelling of the zoom modifier); `'pan'` scales a
  line-mode delta by 33 px as the zoom path does and a page-mode delta
  by the viewport height; the zoom path's delta handling is unchanged.
- *75.6*: a request on a scene at rest draws one full frame; the plan's
  cheaper counts-only frame was not needed and is a follow-up hook.  The
  worker proxy forwards the request to its engine (`counts` /
  `countsresult`), so the method is on `RendererLike` for both hosts.

**Controls, each run and each red**: 75.1 the observer without its emit;
75.2 the filter forced false (the round-10 late-font spec times out),
forced true (the unrelated-font spec re-shapes), the size watch off (the
orphan spec), the ready belt off (the at-rest spec); 75.3 an iterator
yielding the members reversed; 75.4 cpu-pick's shape test swapped for
the bounding box (the slanted-outline spec — the round-27 lesson); 75.5
`preventDefault()` moved back first (three browser specs), the
`'pan'`/`'modifier-zoom'` branches swapped (the Node table and both mode
specs), and the option left out of the options schema (the schema gate);
75.6 the args read at offset 0 (both count specs, 7/3 read as 12/198)
and every group treated as dispatched.

**The page, opened** (a scripted Chromium on `debug/index.html
?network=v3-default`, 1400×900): `cy.nodeAt` over node `a` answered `a`;
`cy.viewportCounts()` answered all 10 nodes and 23 edges in view; the
new `wheelBehavior` select set `'pan'`, and a wheel logged `scrollpan`;
under `'modifier-zoom'` a plain wheel did nothing to the graph; shrinking
the container by 200 px logged `resize` with no `cy.resize()` call, the
canvas followed to 850 device px, and the counts fell to 9 nodes as one
left the view.  The screenshot showed the graph redrawn at the new
width, letterboxed, nothing stretched.

**Browser runs at the close**: the `renderer` project 197 passed, 1
skipped (its standing skip), 36.9 s; the `visual` project 130 of 130 —
every golden exact and every parity scene inside its bound, 2.3 min —
so nothing here moved a pixel, as the plan expected.  The
`renderer-webkit` project was not run: Linux WebKit has no WebGPU, and
its specs soft-skip.

**Deferred**: the viewport counts' mask form (the visible list as a
Collection, with a compaction-order contract) and a counts-only frame —
both follow-up hooks in `src/README.md`; the iterator ships as
declaration hover text, since the docs generator lists identifier
members only; the font at-rest residual, documented per the sitting.

**Logged in passing**, from round 79's findings, as new ledger items:
**79** — the force layout reads an undeclared `tidyComponents`
(`ForceRunOptions` declares it; the public `ForceLayoutOptions` does
not); **80** — `options.elements: { nodes: {} }` loads an empty graph
while `cy.add()` of the same object throws (`nodeDefs is not
iterable`), both reproduced on this tree.

**The gates at the close**: `npm run -s test:node:quiet` green — zero
bytes (3,024 unit and 1,029 module tests; 526 browser tests listed
across the Playwright projects — this round's 14 browser specs, listed
in both the `renderer` and `renderer-webkit` projects, are 28 of them);
`test:throws` at zero; JSDoc 100%
on all three gated tags (377 public members; `@throws` 12/12, `@param`
219/219, `@returns` 268/268); the generated API at 343 documented
members; plan-record, agent-docs, feature-inventory, status-features
and migration-guide green.  One red found at the close and fixed in it:
75.4's README note quoted the pick's old path, which the status site's
documented-path gate reads as a dead link — `src/render/cpu-pick.mts`
joins `HISTORICAL_PATHS` (round 97's record and rounds 76/81's plans
quote it as it was), the round-131.1 `wgsl.mts` precedent.

