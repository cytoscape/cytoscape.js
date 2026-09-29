## Ledger item 31, the inventory: every gesture, its events and the specs that hold it

Ledger item 31, its first measurement taken as a round.  There was no
plan file: the spec is the item's text in `PLAN.md` and its line in the
eleventh sitting's note
(`2026-09-28-01-rnd0000-note-the-eleventh-design-sitting-the-open-calls-one-by-one.md`).

The item (raised 2026-08-19): goldens cover static frames; gestures are
verified by Node specs plus a person driving `debug/`.  The item's
round adds a Playwright tier that replays recorded pointer traces —
drag, box select, wheel zoom, pinch, cxt press, grab-and-throw —
against both renderers and diffs *end states numerically*
(`routing.spec.js`'s method): positions, the selection set, pan/zoom.
**First measurement**: the inventory — which gestures have any
browser-level assertion today, and which only headless synthetic-event
coverage.

**Call taken (2026-09-28, the eleventh sitting): the inventory now,
the trace tier before the WebGL implementation**, so both renderers are
held to it.  This round is the inventory, built to set the trace tier
up; the tier itself is not built.

### The round, as carried out (2026-09-29)

| # | Commit | What landed |
| --- | --- | --- |
| 136.1 | `90ac2723` | the inventory as data, the gate, the testing note |
| 136.2 | this commit | the close (with round 135's) |

**The shape.**  The inventory is a module, not a document:
`playwright-tests/lib/gesture-inventory.mjs`, beside the Playwright
helpers the trace tier will be written with, so the tier imports its
gesture list, end-state fields and traces rather than re-deriving them.
Per gesture: the input, the options and element states that gate it,
the public events in emission order, the end state, the source files,
and the covering specs — each citation a `[file, title, kind]` whose
kind separates what the item asked to separate:

- *browser, `'real'`*: trusted Playwright input (`page.mouse`,
  `page.keyboard`) through the real `PointerHandler`;
- *browser, `'synthetic'`*: `PointerEvent`s dispatched in the page —
  every touch spec (`page.touchscreen` is never used) and the two
  `pointercancel` specs;
- *headless, `'driven'`*: `test/pointer-cursors.mjs`'s stub-canvas
  harness, the only Node spec that runs the real handler — and it
  asserts cursors only, never moving past the tap threshold;
- *headless, `'api'`*: the consequence reproduced through the public
  API (`ele.emit('grab')`, `position()`, `select()`,
  `_elementsInGestureBox`) with no pointer at all.

`test/modules/gesture-inventory.mjs` holds the table to the tree: all
76 cited titles exist verbatim as `test(` / `it(` literals in their
files; every cited source exists; every event name `src/interact/`
emits — 40, scanned by call shape, with the drag-hover `prefix + 'over'`
composition expanded — is named by some row; every trace is used; and
the tallies are pinned.  Controls: a title one character short and a
title in a plain string are refused; planted call shapes (a multi-line
`emitGesture`, `emit({ type })`, the prefix union) are scanned and a
plain literal is not; removing `scrollpan` from its row fails the event
check.

**The first measurement.**  **30 gestures: 26 have a browser-level
assertion, 1 has only headless coverage, 3 have none.**

- *None at either tier*: the pointer leaving the canvas (`mouseout` /
  `pointerout` from `pointerleave`); **the additive tap** — shift / ctrl
  / meta click or `selectionType: 'additive'` — where no spec holds that
  the others stay selected; and **every gesture under the worker
  renderer host** (`renderer.worker: true`), whose spec covers the pick
  seam only.
- *Headless only*: one-finger touch — tap, drag, pan, hold under
  `touchTapThreshold` and the touch hit pads — covered by one driven
  spec asserting that a touch press gets no cursor.
- *Browser-covered, headless API only*: tap/select, taphold, the press
  overlay, compound drag, box selection's query semantics, the
  wheel-mode mapping, the drag reheat of a live force run.  The Node
  tier drives no gesture past the tap threshold anywhere.

Sub-cases no spec reaches, listed on their rows as `gaps`: `onetap`
(subscribed in one spec, never asserted), a background `dbltap` and
the debounce window; a taphold cancelled by movement; a replacing box
(panning off, no key), a box under `autounselectify`,
`boxSelectionIncludesLabels` through the gesture, ctrl / meta as the
box key; a drag under `autolock` or of a panified or animating node;
`tapdragover` / `tapdragout` during a grab or a pan; the `contextmenu`
suppression; wheel `deltaMode` line and page, horizontal wheel pan and
the zoom clamp; pinch with zooming off, its translation and a third
finger; touch `pointercancel`; the touch hit pads.

**What landed since the item was raised, inventoried.**  Round 75.5's
`wheelBehavior` is three rows — `'zoom'` (the default), `'pan'` (the
plain wheel pans and emits `scrollpan`; ctrl, the trackpad pinch, still
zooms) and `'modifier-zoom'` (the plain wheel scrolls the page) — each
with its browser spec.  Rounds 102, 104 and 106 add no gesture:
`cy.emphasize()` is API-only (the debug page's Hover select binds it to
`mouseover` / `mouseout`), `label-declutter` re-runs on every frame
after a viewport change, so pan and zoom feed it, but its specs set the
viewport by API, and the minimap tap is `debug/` only.  All three are
recorded in `NOT_GESTURES`, beside `keyboard` (src/ listens for no key
events; modifiers are read off pointer and wheel events) and v3's
never-fired names.

**Setting up the trace tier.**  `TRACES` names nine traces with their
input kind and end-state fields (`END_STATE`: positions, selection,
viewport, grabbed, the ordered events): item 31's six, plus
`tap-select`, `drag-pan` and `touch-tap-drag`, which reach the three
uncovered or headless-only rows the six do not.  Every row names the
trace that will replay it, or says why none will (hover, cursors and
the press overlay are transient; taphold is one timed event;
`drag-live-force`'s end state is a simulation).  One call: **v4 has
no grab-and-throw** — nothing in src/ carries momentum — so the item's
sixth trace pins the absence (nothing moves after a fast release, on
either renderer) rather than a behaviour.  The machinery the tier
generalizes is round 89.3's hover helpers (`hoverOnto` nudges inside
its poll to beat the 25 ms latest-wins throttle), 75.5's `wheelOnce`,
the in-page `PointerEvent` synthesizer (copied into five specs — the
tier's first refactor), the `__events` recorder pattern, and
`routing.spec.js`'s numeric compare on `parity.html` with the frame
driver loaded.

**Read from the code, for the trace tier to pin** (not driven here;
recorded so the tier asserts them one way or the other):

1. A second finger landing on a node grabbed by the first — pinch,
   two-finger cxt, or the touch box — clears the grab flag with no
   `free` / `freeon`, and the fingers the gesture consumes get no
   `pointerup` / `tapend` (`pointer-touch.mts`, `beginPinch`,
   `beginTouchCxt`, `touchBoxMove`).
2. A right press emits `pointerdown` and `cxttapstart` but no
   `tapstart`, while its moves and release do emit `tapdrag` and
   `tapend`.
3. An edge press starts on the core: `pointerdown` / `tapstart` go to
   the core (the sync pick sees nodes), and the edge becomes the target
   only once the async pick answers.
4. `dragpan` fires with `panningEnabled` false though nothing moved;
   `pinchzoom` is gated on `userZoomingEnabled` alone; `scrollzoom`
   fires at the zoom clamp.
5. A shift-drag box is always additive, since shift is what started
   it; the box replaces the selection only when it began because
   panning was off.
6. `tap` still fires on the release after a `taphold`.

Each may be v3's behaviour too; that is the trace tier's parity
question, and why these are recorded rather than changed.

**Deferred.**  The trace tier, by the sitting's call, before the WebGL
implementation.

**Verification.**  `npm run -s test:node:quiet` green (zero output).
