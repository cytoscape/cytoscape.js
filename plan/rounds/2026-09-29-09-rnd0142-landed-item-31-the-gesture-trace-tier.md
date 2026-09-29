## Ledger item 31, the trace tier: the gestures replayed, compared as numbers

Ledger item 31's second half, taken as a round.  There was no plan file:
the spec is the item's text in `PLAN.md`, its line in the eleventh
sitting's note
(`2026-09-28-01-rnd0000-note-the-eleventh-design-sitting-the-open-calls-one-by-one.md`)
and round 136's record, which built the inventory and named the traces.

The item (raised 2026-08-19): a Playwright tier that replays recorded
pointer traces — drag, box select, wheel zoom, pinch, cxt press,
grab-and-throw — and diffs *end states numerically* (`routing.spec.js`'s
method): positions, the selection set, pan/zoom.  Round 136 inventoried
30 gestures, named nine traces with the end-state fields each compares,
and read six behaviours from the code for this tier to confirm or fix.
Round 137 (the WebGL2 renderer) expects the traces to run against its
backend unchanged: "the gesture traces on both backends".

**Call taken (2026-09-28, the eleventh sitting): the inventory now, the
trace tier before the WebGL implementation**, so both renderers are held
to it.

### The round, as carried out (2026-09-29)

Landed the same day as the inventory, on the sitting's call.  Measured
on the i9-9900K (Fedora 43, Linux 7.1), Node 24.18, Playwright 1.61.1,
the `visual` project's pinned SwiftShader adapter, 8 workers.

| # | Commit | What landed |
| --- | --- | --- |
| 142.1 | `3249156d` | the traces, the replayer, the spec, the records (captured before any fix), the v3 ledger, the Node gate, the inventory's rows |
| 142.2 | `90b5beb7` | the four clear bugs fixed, the records moved with them; items 88 and 89 logged |
| 142.3 | this commit | the close |

**The shape.**

- **Scripts, not recordings.**  `playwright-tests/lib/gesture-traces.mjs`
  writes the inventory's traces as step lists on one scene — five nodes
  (one locked), three edges, 400×300 at zoom 1 — in container
  coordinates: `hover` (move, then poll the hover pick), `down`/`up`,
  paced `drag`, `key`, `wheel`, `touch`/`touches` (in-page
  `PointerEvent`s — the only multi-touch a page can make), `set` (an
  option between gestures), `viewport`, `wait`, and `mark`, which cuts
  the trace into phases.  A tenth trace, `pointer-leave`, joined the
  nine for the one uncovered row they did not reach, with a `hovered`
  end-state field.
- **Snapshots per phase.**  `lib/trace-replay.mjs` plays a script on
  `parity.html` and at every mark and at the end records positions, the
  selection, the viewport, the grabbed and hovered sets, and the event
  log.  The log is normalized: discrete events in order, each run of
  per-move events (`pointermove`, `tapdrag`, `position`, `drag`, `pan`,
  `zoom`, `viewport`, `dragpan`, `pinchzoom`, the wheel gestures)
  between two of them collapsed to its sorted set of `type:target`
  pairs — how many moves a browser delivers is not the gesture's
  business, which of them happened on what is.  `onetap` is not
  recorded (a timer after the debounce; its row cites the spec that
  waits for it).
- **One record, every host.**  `playwright-tests/gestures.spec.js` holds
  every v4 host in `HOSTS` to one checked-in record per trace
  (`playwright-tests/gesture-traces/<trace>.json`): the same-thread
  WebGPU renderer and the worker host today.  Round 137 adds
  `{ id: 'webgl2', options: { backend: 'webgl2' } }` and nothing else.
  `UPDATE_GESTURE_TRACES=1 … -g webgpu` rewrites the records; their diff
  is the behaviour change, which is how 142.2 was reviewed.
- **v3 on the same scripts.**  The mouse traces replay on v3's container
  (its stylesheet translated, a preset layout so it keeps the scene's
  positions) and are compared, phase by phase, on the fields both have —
  positions, selection, viewport, grabbed, and the events in the shared
  vocabulary, runs of one type across a collection sorted.  Every
  difference is a keyed `V3_DIVERGENCES` entry with its reason, asserted
  to *still* differ, so a fixed difference turns red until its entry
  goes (142.2 removed two that way).  The touch traces do not replay on
  v3, which takes touch as `TouchEvent`s.
- **The Node gate** (`test/modules/gesture-traces.mjs`): scripts and
  inventory name the same traces; every step has one known kind; each
  record has the script's phases and the inventory's fields; the log
  uses only the recorded vocabulary with the stream in its runs; the
  vocabulary is exactly what `src/interact/` emits (by round 136's
  scanner, moved into the inventory module to share it) plus the model's
  events, less `onetap`; every divergence names a phase v3 reaches and a
  field it is compared on; and the comparator's controls.  Controls
  run: a renamed mark and a dropped stream type turn three tests red.

**Determinism, measured.**  The first worker-host run differed from the
record in one place: a `pointermove` run from the hover poll's nudges,
which the WebGPU run had not needed.  Two rules, both the replayer's,
fixed it for every trace: each pointer step waits for its DOM event to
arrive (a capture-phase counter) before the next, and moves are paced
past the 25 ms hover and drag-hover throttles, so a browser coalescing
moves under load cannot change what the gesture saw; the hover poll's
nudges are not recorded.  After that: **80 of 80** host runs green at
`--repeat-each=4`, and the whole file — 20 host runs and 8 v3 runs — in
**31 s** at 8 workers.

**The six behaviours, confirmed or fixed.**

1. *A second finger on a grabbed node clears the grab with no `free`,
   and the fingers the gesture consumes get no `pointerup` / `tapend`.*
   Confirmed (`pinch`'s over-a-grab phase: `grabon:a grab:a …` then the
   pinch, no free), and worse than read: with a drag set only the
   pressed node's flag was cleared.  **Fixed**: `releaseGrab`
   (`pointer-press.mts`), the path a release, a cancel and an overruled
   parent press already shared, now also ends a press a pinch, a touch
   cxt or a touch box takes over — `free` / `freeon` (and the
   `dragfree` pair when it had dragged) on the whole set, every flag
   cleared.  v3's pinch frees the same way.  The consumed fingers'
   missing `pointerup` / `tapend` stays, logged (item 88 (h)): v3 emits
   one `tapend` when the last finger lifts, and which release event a
   multi-finger gesture owes is a call.
2. *A right press emits no `tapstart` but its release emits `tapend`.*
   Confirmed, and v3 emits neither.  **Fixed**: the right release emits
   `pointerup` and the cxt family only — and its `pointerup` now goes to
   the target the `pointerdown` had.  It had fallen through to the last
   hover pick, so a right click on an edge went down on the core and up
   on the edge (`cxt-press`'s end phase).
3. *An edge press starts on the core.*  Confirmed: `pointerdown:cy
   tapstart:cy`, then `pointerup:ab tapend:ab tap:ab`.  v3 targets the
   edge from the press, and its right press takes edges, where v4's
   targets nodes or the core.  Not a bug with a local fix — the press
   needs a synchronous edge hit test or a deferred `tapstart` —
   **logged as item 89**.
4. *`dragpan` fires with `panningEnabled` false; `pinchzoom` is gated
   on `userZoomingEnabled` alone; `scrollzoom` fires at the zoom clamp.*
   The first two confirmed (`drag-pan`'s end phase, `pinch`'s end
   phase) and **fixed** — both now need both toggles, as v3 gates them.
   The third confirmed and **kept**: v3 emits `scrollzoom` after its
   zoom call unconditionally (`wheel-zoom`'s at-the-clamp phase: the
   zoom stays 1, `scrollzoom` fires).
5. *A shift box is always additive; a box replaces only when it began
   because panning was off.*  Confirmed and **kept**: v3's selection
   matches the record in both of `box-select`'s phases.
6. *`tap` still fires on the release after a `taphold`.*  Confirmed —
   `tap-select`'s last phase holds a press past `tapholdDuration` —
   and **kept**: v3 does the same (its `taphold:e … tap:e`).

**What the v3 replay found that the reading did not.**  One more bug,
fixed in 142.2: `tapunselect` fired only on a toggled-off target, where
v3 — whose semantics the README adopts for the event — fires it on
every element a tap deselects (a single tap's others, the background
clear).  The rest are orders and targets, logged as **item 88** and in
the migration guide's re-check table: the release order (v3 taps and
selects before it frees, `-on` variant first), v3's mouse box
unselecting before it emits `box`, `tapend` at the release point (v3)
against the pressed element (v4), v3's `dbltap` on any second tap in
the window, v3's grab on a multiple-select-key press, a drag from a
locked node that pans in v4 and does nothing in v3, and v3's wheel
rate, which clamps its first ticks while it samples the device (two
ticks in and one out: ×1.047 in v3, ×1.585 in v4).  Positions and
selections agree with v3 in every phase both replay.

**The three uncovered gestures.**  All three are covered now: the
pointer leaving the canvas (`pointer-leave`: `mouseout` / `pointerout`
and the hovered set emptied), the additive tap (`tap-select`: shift and
ctrl taps keep the others, a shift tap toggles, `selectionType:
'additive'` keeps them on a plain tap), and gestures on the worker host
(all ten traces, the same record).  One-finger touch, the headless-only
row, has its browser trace too (`touch-tap-drag`).  The inventory reads
**30 of 30 with a browser-level assertion** (was 26), and the gaps the
traces closed are gone from their rows: the background `dbltap`, the
replacing box, the pinch translation and the grab under it,
`tapdragover` during a grab and a pan, a right press on an edge, the
zoom clamp, the horizontal wheel pan.

**Calls taken in-round.**

- **Records, not a live cross-host diff.**  A host compares against the
  checked-in record rather than against the same-thread run in the same
  test: the record is reviewable, a host added later needs no second
  host to run, and a behaviour change shows as a diff.
- **v3 is compared against the record too**, on the phases it can reach
  — a script's `v3` bound is a mark, all of it, or a reason; a step
  carrying a `v3` string is skipped there (the taphold phase's
  `tapholdDuration`, which v3 hardcodes).
- **The debounce is 2 s in the scene**, so the background double tap
  lands whatever the machine's pace — which makes v3's any-target
  `dbltap` fire on every phase, a recorded divergence rather than a
  flake.
- **The spec rides the `visual` project**: it needs `parity.html`, both
  bundles and an adapter, which that project already provides pinned.
  The v4 hosts soft-skip without an adapter (the hover and edge picks
  are GPU picks); the v3 half needs none and never skips.

**Deferred.**  Items 88 and 89 (the calls above).  The traces do not
cover `pointercancel` (its two synthetic specs do), the touch hit pads,
a one-finger hold, or `onetap`; the inventory's rows keep those gaps.

**Verification.**  The gesture traces 28/28 (both hosts, v3); the
renderer project's `renderer.spec.js` and `worker-renderer.spec.js`
after the fixes (177 passed, 1 skipped); `npm run -s test:node:quiet`
green (zero output).
