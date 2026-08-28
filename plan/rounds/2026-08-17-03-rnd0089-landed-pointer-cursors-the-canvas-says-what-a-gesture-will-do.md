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

### Landed (2026-08-27)

The canvas carries the affordances, every gesture-end path puts them
back, and `pointerCursors` turns the whole thing off.  The plan's five
verified facts were re-checked before starting and all five held —
including fact 1, that nothing in either library sets `style.cursor`,
which a grep confirmed still true.  Every "Open" was taken as
recommended.  Three things the plan did not have right are recorded
below; two of them changed the code.

**89.1 — the map.**  `src/interact/cursor.mts` is pure: `cursorFor( {
gesture, hover, pointerType }, setting )` and a `DEFAULT_CURSORS`
constant, no DOM.  That is what makes every cell of gesture x hover x
pointer type assertable from Node, and it is why the browser tier can
then test the *writes* rather than the decisions behind them.
`CursorState` and `CursorMap` live in `public-types.mts` beside
`BoxSelectionMode`, so `export type *` carries them to consumers.

**89.1 — the writer, and the plan's one wrong instruction.**  The plan
enumerated seven transitions for `PointerHandler` to hook.  It hooks the
**DOM-listener wrapper** instead — the same `finally` that clears
`originalEvent` (41.4) — plus `updateHover`, which resolves
asynchronously outside that wrapper, plus `destroy`.

The reason is the
plan's own risk note.  `this.down` is cleared in **six** places, and
three of them are touch paths the plan's list does not name:
`beginPinch`, `beginTouchCxt` and the three-finger `touchBoxMove`.  Each
would have been a live sticky-`grabbing` path on a hybrid device, and
each is the kind of branch an enumeration gets wrong quietly.  Deriving
the cursor after every DOM handler is a superset that cannot miss one,
and it costs a string compare per event against handlers that already
pick and emit.  The plan's enumeration was not wrong about *those seven*
— it was wrong that seven was the count.

**The document mirror ships, and the release-outside-canvas spec does
not.**  The plan made the mirror conditional on that spec ("it ships
only with the release-outside-canvas spec proving every path restores
it, or it drops to canvas-only").  `playwright-page`'s container fills
the viewport, so there is no outside to release into without resizing
the shared page — round 91's territory, and not a change to make from
here.  The condition is met a different way, and the substitution is
recorded rather than glossed: the browser suite asserts the *mirror*
(`documentElement` reads `grabbing` mid-drag, `''` at every release, on
pan, grab, box and cancel), and `test/pointer-cursors.mjs` asserts the
half a full-viewport page cannot — that the mirror **saves and restores
the page's own root cursor** rather than clobbering it, with a `wait`
planted before the drag and read back after.  The mirror is the
mechanism the excursion depends on; both halves of it are pinned.

**89.2 — the option.**  `pointerCursors?: boolean | Partial<CursorMap>`,
default `true`, with `cy.pointerCursors()` in the getter/setter shape
every sibling toggle uses.  No validation and no throw: a typo'd map key
is a no-op, and the constructor's stated design (fifth sitting) is that
option strictness resolves at the type layer.  One thing the plan did
not think of: **a runtime flip has to reach the canvas immediately**, or
turning cursors off while one reads `grab` leaves it there until the
next pointer event.  The setter calls the handler's `applyCursor()`, and
`Core._pointer`'s structural type grew the method for it.  It is not
in `cy.json()`, matching every other v4-only option.

**89.3 — the browser tier**, and three things the specs had to be
taught, each a first draft that passed or hung for the wrong reason:

- **A gesture moves its own target.**  A pan moves the viewport and a
  node drag moves the node, so a second gesture aimed at a remembered
  coordinate misses.  Two specs failed on exactly that before `at()`
  started asking the element where it is now.
- **The last move of a `steps` batch is routinely dropped.**  Hover
  picking is throttled to 25 ms and latest-wins, so moving once and then
  polling the cursor waits for a pick nothing will ever ask for — two
  more specs failed here.  `hoverOnto` nudges *inside* the poll, which
  is state-driven, not a sleep-to-offset.
- **Waiting on the hover is what makes the control honest.**  With
  `pointerCursors: false` a poll for `''` passes instantly and proves
  nothing.  Waiting for the pick to land first turns each assertion into
  "the hover really happened, and nothing was written anyway" —
  testing.md's rule about asserting the precondition when the end state
  satisfies the predicate on its own.

**Controls, three of them, all landing:**

| control | result |
| --- | --- |
| `cursorFor` keyed to return `''` unconditionally | 10 of 18 Node specs red |
| the map intact, only the DOM write neutered | 6 of 18 Node specs red |
| `applyCursor()` made a no-op | all 6 browser specs red |

The first two failing for different reasons is the point: the two tiers
fail for their own reasons rather than each other's.  The debug-harness
gate has its own pair — mistype the checkbox id in `index.html`, rename
the member in `toggles.js`, one each.

**89.4 — the harness, driven.**  A `pointerCursors` checkbox joins Core
toggles, and the page was driven in a scripted browser on
`?network=em-web` — the rule this round could not have satisfied any
other way, since the feature is observable only by a person or a browser:

    at rest          canvas ''         root ''
    hovering a node  canvas 'grab'     root ''
    pressed, drag    canvas 'grabbing' root 'grabbing'
    released         canvas 'grab'     root ''
    checkbox off     canvas ''         setting false
    hover, off       canvas ''         setting false

One row looked like a defect for a moment and is not: re-checking the
box reads `''`, not `grab`, because clicking a side-panel control moves
the pointer off the canvas, `pointerleave` clears the hover, and
idle-over-nothing is the right answer.

`test/modules/debug-harness.mjs` gained a gate for the failure mode a
new control has, which is silence: `boolControl` returns early when its
selector matches nothing, so a typo'd id is a checkbox that never
appears and never fires.  Two text checks — every selector literal
`toggles.js` names exists in `index.html`, and every core member its
getters call exists on a real instance.

`scripts/status/markdown.mjs` dropped `src/interact/cursor.mts` from
`PLANNED_PATHS`, which is that list's designed lifecycle: a planned
round names a file before it exists, the round lands, and the "no exempt
spelling resolves" spec goes red until the entry is removed.  It went
red on this round's first `test:modules` run.

**Verification.**  `npm run -s test:node:quiet` green (2260 Node specs);
`npx playwright test --project=renderer` green; `npm run build:types`
regenerated `dist/cytoscape.d.ts` — the docs gate fails on a documented
member the declaration does not carry, which is how the first run caught
that it had not been rebuilt.

**Recorded, not scheduled** (unchanged from the plan): a `cursor` style
property in the sheet DSL is the CSS-shaped end state and needs a
dictionary column plus a contract change; a cxt-gesture cursor is cheap
once the writer exists and waits on an app expectation; a `progress`
cursor for long synchronous work is **declined** — 87.2 removed the
largest sync stall, and a cursor that says "wait" is the wrong fix for
work that should not block.
