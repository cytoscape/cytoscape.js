## Pointer cursors: the canvas says what a gesture will do

The maintainer's ask: the pointer should carry the standard
affordances — a grab/grabbing pair around panning, something over a
hoverable element — instead of staying the browser default through
every gesture.  What the code does today, verified:

1. **Nothing sets a CSS cursor, in either library.**  v4's renderer
   writes exactly five inline styles on its canvas — position, size,
   display (`src/render/renderer.mts:326-332`) — and no file under
   `src/` or `v3/src/` touches `style.cursor` (grep; v3's only
   "cursor" hits are prose and the WebGL pick comments).  v3 left
   cursors to userland, and the standard pattern there is a
   `mouseover`/`mouseout` pair writing `container.style.cursor`.
   v4's canvas fills the container, so an inline *canvas* cursor
   overrides exactly that pattern — which is the constraint the
   defaults below are shaped around.
2. **Every state the cursor depends on is already tracked in one
   object.**  `PointerHandler` owns hover (`updateHover`,
   `src/interact/pointer.mts:1586`, fed by the throttled async pick
   at :1563 and cleared on `pointerleave` at :195), the press mode
   `'pan' | 'grab' | 'box'` decided once at pointerdown (:405), the
   tap-threshold `moved` flip (:588), and the draggability predicate
   (`canDrag`, :471 — grabbable, unlocked, not pannable, not
   animating).  A cursor writer piggybacks on transitions the
   handler already makes: no new pick passes, no new listeners, no
   keydown tracking.
3. **Hover is asynchronous and throttled** (25 ms + a pick
   round-trip; paused during wheel with the settle re-pick at :256,
   and never run during a pan drag) — so a hover cursor carries
   exactly the latency `mouseover` already has, and the pan/drag
   cursors must key off the press, never off hover.
4. **A captured drag outlives the canvas.**  Drags run under
   `setPointerCapture` (:1660), and capture routes *events*, not the
   cursor: while the pointer is physically outside the canvas the
   browser shows whatever the element underneath declares, so a
   mid-drag excursion past the container edge drops the `grabbing`
   affordance unless something writes at document level.
5. **The option surface has an obvious seat.**  `CytoscapeOptions`
   carries the interaction knobs — `userPanningEnabled`,
   `boxSelectionEnabled`, `selectionType`, the round-20.1 tuning
   quartet (`src/public-types.mts:610-667`) — each with a runtime
   getter/setter on the core.  A cursor option lands beside them.

### 89.1 — the cursor map and its single writer

New `src/interact/cursor.mts`: a pure
`cursorFor( state ): string` over
`{ gesture: 'idle' | 'pan' | 'grab' | 'box', hover: 'none' |
'element' | 'draggable-node', pointerType }`, returning a CSS cursor
keyword or `''` for inherit.  The default map:

- idle over background: **`''`** (inherit) — deliberately not
  `default` or `grab`: it leaves the app's own container cursor in
  force, so the v3 userland pattern keeps working wherever v4 has
  nothing to say;
- hover over any interactive element: `pointer`;
- hover over a node `canDrag` accepts: `grab`;
- an active pan- or grab-mode press: `grabbing`, from the pointerdown
  itself rather than the threshold flip — immediate feedback, and a
  tap restores within the click so nothing reads as flicker;
- a box-mode press: `crosshair` (press-time only — the mode is
  decided at pointerdown, and the handler reads modifiers off
  pointer events alone, so there is no pre-press armed state to
  show);
- `pointerType === 'touch'`: never writes — there is no cursor to
  show, and a synthetic write would stick after the finger lifts.

`PointerHandler` applies it at exactly the transitions it already
owns — `updateHover`, pointerdown, pointerup/pointercancel, the
gesture-cancel paths (:946, :1017, :1214), `destroy` — through one
`applyCursor()` that writes `canvas.style.cursor` only when the
computed value changes and restores `''` on destroy (destroy runs on
the device-loss re-mount, round 10, so nothing leaks across mounts).
For fact 4, an active pan/grab/box drag also mirrors the cursor onto
the canvas's `ownerDocument.documentElement`, cleared on every
release path — that is what keeps the affordance honest when a
captured drag leaves the canvas.  A hover pick resolving after
destroy must be tolerated the way `updateHover` already tolerates a
removed element.

**Verified by** Node unit specs over the pure map — every gesture ×
hover × pointerType cell asserted, plus the `canDrag`-driven
distinctions (a locked, ungrabified or animating node hovers as
`pointer`, not `grab`) — with the round-27 control run once (the map
keyed to return `''` unconditionally → the file must go red).  The
DOM writes are 89.3's: headless has no canvas, so the Node tier can
only see the pure half — that split is the design, not a gap.

### 89.2 — the option: `pointerCursors`

`CytoscapeOptions.pointerCursors?: boolean | Partial<CursorMap>` —
default **true**; `false` means the writer never touches the DOM; an
object overrides individual entries (`{ pan: 'move' }`,
`{ hoverNode: 'pointer' }`), with `''` meaning inherit so any single
state can be handed back to the app.  Runtime
`cy.pointerCursors()` getter/setter beside its sibling toggles.
JSDoc with all three gated tags; `npm run build:types` and the
surface audit; the compile-only consumer test exercises both option
shapes.  MIGRATING.md gains the one-line compat note — v3 never set
cursors, so an app whose own mouseover/mouseout cursor code now
fights the default passes `false` — and CHANGELOG.md and
`src/README.md`'s interaction section record the feature.

**Verified by** the types tier and 89.3's runtime flip spec; the
docs edits ride the JSDoc gates (stranded-block territory — run them
per commit).

### 89.3 — the gestures drive it, in a real browser

Playwright specs in the `renderer` project, every assertion
poll-based on `canvas.style.cursor` (hover is async + throttled —
the house rule against sleep-to-offset applies verbatim):

- hover a node → `grab`; after `cy.autoungrabify( true )` the same
  hover reads `pointer`; hover an edge → `pointer`; leave the
  canvas → `''`;
- background press-drag → `grabbing` from the press, `''` on
  release; a node drag likewise, including a release *outside* the
  canvas under pointer capture — which is the spec that proves the
  document-level mirror restores;
- a multiple-select-key drag → `crosshair`, restored at boxend;
- pointercancel mid-pan → restored (the cancel paths are where a
  sticky `grabbing` would live);
- `pointerCursors: false` → all of the above read `''` throughout —
  the suite's own control, since with the feature off every positive
  assertion must invert.

Node hovers ride the sync CPU pick, so none of this needs more than
the adapter the renderer project already has.

### 89.4 — the harness shows it

Drive `debug/` (`npm run watch`) through pan, node hover/drag and
box select on `?network=em-web` and `?network=v3-default` — the
"something has to open the page" rule; this feature is *only*
observable by a person or a browser spec.  A `pointerCursors`
checkbox joins the core-toggles section so the page can demonstrate
both states, pinned by `test/modules/debug-harness.mjs` where
practical.

### Suggested further directions (recorded, not scheduled)

- **A `cursor` style property in the sheet DSL**
  (`node.clickable { cursor: pointer }`) — the CSS-shaped end state:
  per-selector cursors read at hover time.  Needs a dictionary
  column and a contract change; the state map covers the common
  cases without either.  Revisit if consumers ask.
- **A cxt-gesture cursor** (`context-menu` during an active cxt
  press) — cheap once the writer exists; skipped in v1 because v3
  suppresses the browser menu and no app expectation exists.
- **A busy cursor for long synchronous work** (`progress` during a
  sync layout) — recorded to decline it deliberately: 87.2 removes
  the largest sync stall, and a cursor that says "wait" is the wrong
  fix for work that should not block.

### Risks named at planning

- The inline canvas cursor overrides the app-container pattern —
  the `''` idle default and the `false` opt-out are the mitigations,
  and MIGRATING.md names the behaviour.  Do not "improve" idle to
  `default`: that is the compat-breaking spelling.
- Every gesture-end path must restore — pointerup, pointercancel,
  the touch/pinch cancels, destroy.  The cancel spec exists because
  that is where a sticky cursor hides.
- The document-level mirror touches state outside the container; it
  ships only with the release-outside-canvas spec proving every path
  restores it, or it drops to canvas-only (Open below).
- A hover pick's promise can resolve after unmount; the writer must
  tolerate it (the existing `updateHover` shape).
- All specs poll; none sleeps to an offset.  Any spec that also
  animates inherits the frame-driver and compile-stall notes.

**Open:** whether idle-over-background stays `''` (recommended) or
becomes `grab` when panning is enabled — the map-app affordance; one
map entry either way, flippable later; whether a draggable node
hovers as `grab` (recommended) or uniformly `pointer`; whether the
mid-drag document-level mirror ships in v1 (recommended: yes — it is
what makes release-outside-canvas honest) or the writer stays
canvas-only; whether `pointerCursors` needs the runtime setter
(recommended: yes, matching every sibling toggle).
