## Round 20 plan — interaction options + touch parity (planned 2026-08-01)

With the architecture queue closed (round 19), round 20 takes the
largest remaining "needs a call" cluster: gap item 8 — the
interaction tuning options and the touch gestures v4 still lacks.
Everything here is app-facing parity work; the option names and prop
semantics are permanent API, so the calls are made deliberately up
front (the round-17 discipline).

**Signed-off design calls:**

1. **The option quartet is core-level, with getter/setters.**  v3
   buries `wheelSensitivity`, `desktopTapThreshold` and
   `touchTapThreshold` in renderer options and hardcodes
   `tapholdDuration = 500`; v4 has no renderer-option surface for
   interaction (the `renderer` block is GPU tuning), so all four are
   **constructor options with `multiClickDebounceTime`-style
   getter/setters** — readable and settable at runtime, validated
   (throw on non-finite/negative; `wheelSensitivity` must be > 0),
   live-read by the pointer layer (no re-init).

   Defaults are v3's:
   `wheelSensitivity: 1` (a multiplier on the wheel-zoom exponent —
   v4's base rate is unchanged), `desktopTapThreshold: 4`,
   `touchTapThreshold: 8` (css px of movement before a press stops
   being a tap; v4 previously used 4 for all pointer types),
   `tapholdDuration: 500` ms (v4 makes v3's constant configurable —
   the one deliberate surface addition, logged in the gap list).
   v3's console warning on a custom `wheelSensitivity` is **kept
   verbatim** (the hardware-variance advice is as true under WebGPU;
   emitted once per instance, from the setter or ctor).
2. **`events` is a style prop compiled to a flag bit.**  v3's
   `events: 'yes' | 'no'` ports to both element groups (default
   `'yes'`), constants or `case` mappers (CPU-evaluated — a flag
   write, like every non-paint channel).

   The engine maintains a new
   store-managed `FLAG_NO_EVENTS` bit; **every pointer path excludes
   flagged elements by reading the one bit**: the CPU node pick
   (grab/tap targeting, hover, tapdragover), the GPU edge pick tile
   (the cull kernels gain a `pickMode` Frame field and drop flagged
   edges in pick mode only — scene draws are untouched: `events: no`
   elements still render), and the **box-selection gesture** (v3's
   `getAllInBox` runs over the `interactive` set, so `events: no`
   elements are not box-selectable; the gesture filters, while
   `cy.elementsInBox()` stays a pure geometric query — a recorded
   scope note).  `interactive()` becomes
   `visible() && events !== 'no'`.

   An `events` flag change
   invalidates the pick-tile cache (it changes pick answers, not
   pixels).
3. **`text-events` is node-only in v4.**  v3's default is `'no'`
   (labels are pointer-transparent), which v4 already matches; the
   port makes `'yes'` mean *the node's label box is part of the node
   for picking* — the CPU pick tests the exact laid label block at
   its D3 anchor (the round-16 dims; node labels never rotate, so
   the test is an AABB in model space) after the shape test misses.
   Constants or `case` mappers, `FLAG_TEXT_EVENTS`.  **Edge labels
   stay unpickable** whatever the prop says (edges pick through the
   GPU tile, which draws edge geometry only; the label quads are a
   different stream — a recorded deviation, consistent with the
   round-10 "labels are not pickable" rule).

   The label bb term
   already rides `boundingBox({ includeLabels })`, so no bounds work.
4. **Touch gestures port v3's rules verbatim.**  Two-finger cxt: a
   second finger landing within 200 css px of the first starts the
   cxt gesture — `cxttapstart` on the node under finger 1 (else
   finger 2, else the core; the synchronous CPU pick), `cxtdrag`
   (+ `cxtdragover`/`cxtdragout`) while the pair moves, **cancelling
   into a pinch** when the finger distance grows past 1.5× or 150 px
   (`cxttapend` fires, then the pinch machinery takes over),
   `cxttapend` + `cxttap` (when never dragged) on release.  A
   two-finger press *farther* than 200 px apart pinches immediately
   (v3's threshold).

   Three-finger box: with `boxSelectionEnabled`,
   three fingers select — the box spans the start centroid to the
   moving centroid (v3's `(f1+f2+f3)/3` corners), `boxstart` on the
   first move, applied through the existing box flow (boxend / box /
   boxselect + the round-16.5 label containment option) when the
   third finger lifts; a gesture that boxed never degrades to a
   pinch (v3's `didSelect` latch).  Both gestures ride the existing
   pointer-event handlers (v4 has no touch-event path by design).
5. **Closed or deferred without building:** `pixelRatio` turned out
   to be **already landed** (ctor option, `'auto' | number`, plumbed
   to the renderer's dpr — this round adds the missing spec + docs
   and records it); a box-selection **overlap mode** is *not* v3
   surface (v3 selects by containment) and is **deferred as a
   demand-gated hook** — the logged shape is a
   `boxSelectionMode: 'contain' | 'overlap'` core option whose
   overlap test is bb-intersect for nodes and segment/route-vs-rect
   for edges (the cull pass already owns that math).

**Pass split** (tests-first per item; docs in-commit):

- [x] **20.0 Docs-first** (2026-08-01) — this plan section; gap
  item 8 marked scoped.
- [x] **20.1 The option quartet** (2026-08-01) — `wheelSensitivity`,
  `desktopTapThreshold`, `touchTapThreshold`, `tapholdDuration`:
  ctor options + validated getter/setters on the core (throws on
  non-finite/negative; wheelSensitivity must be > 0 and keeps v3's
  once-per-instance warning on non-default values, from ctor or
  setter), read live by the pointer layer — the wheel exponent
  gains the multiplier (base rate unchanged), press-move thresholds
  resolve per event by pointer type (touch 8 / desktop 4 — v4
  previously used 4 for both), and the taphold timer takes the
  configured duration.

  Tests-first: 4 Node specs
  (`test/interaction-options.mjs`, red then green) for the
  option surface incl. the warn-once rule, and a `webgpu`
  Playwright spec pinning behavior — sensitivity 2 doubles the
  zoom log-ratio of an identical wheel tick; a 6 px desktop
  press-move drags at threshold 4 and taps (position unmoved,
  `tap` fired) at threshold 10; a 350 ms hold fires no `taphold`
  at duration 5000 and fires it at 150.  2179 Node tests,
  typecheck + lint clean.
- [x] **20.2 `events`** (2026-08-01) — the prop lands exactly as
  called: an enum channel on both groups (constants or `case`
  mappers) whose write() maintains `FLAG_NO_EVENTS`; the CPU node
  pick scans past flagged slots (grab/hover/tap fall through to
  what's beneath), the Frame uniform grew a `pickMode` field (18
  floats, one struct for every pass; scene/export leave it 0) and
  both edge cull kernels drop flagged edges in pick mode only; the
  box gesture filters to `interactive()` (which now folds the
  flag); the flags-column dirty span already invalidates the
  pick-tile cache (setFlag no-ops on unchanged bits, so restyles
  don't churn it).

  Tests-first: 6 Node specs
  (`test/events-prop.mjs`, red then green — defaults, readback,
  validation, case-mapper refresh on data writes, the
  elementsInBox-stays-geometric scope note, CPU-pick
  pass-through) and a `webgpu` Playwright spec (a blue `events: no`
  node still wins the pixel but hover *and* a drag pass through to
  the node beneath; a `cy.pick` on an `events: no` edge answers
  null and flips live after a restyle — the same-cursor pick-cache
  pin; the box gesture selects and box-events only the interactive
  elements).  2185 Node tests, 143/143 Playwright, typecheck +
  lint clean.
- [x] **20.3 `text-events`** (2026-08-01) — node-only enum channel
  (constants or `case` mappers) maintaining `FLAG_TEXT_EVENTS`; the
  CPU pick tests the label block box (`store.nodeLabelBox`, the
  round-16.4 laid dims at the D3 anchor — now on the ModelView
  contract) in device px before the body's quick reject, so label
  hits resolve the node for tap/grab/hover alike; `events: 'no'`
  still wins (checked first).  **Call finalized during the pass**
  (the plan draft waffled between parse-inert and throw): the
  edges group **throws** — accepting an inert prop would be a
  silent no-op, against the unknown-keys-throw rule; edge labels
  stay unpickable (recorded).

  Also recorded: the label box picks
  even when the label is LOD-faded (labelFadePx is a readability
  threshold, not a pick predicate).  Tests-first: 5 Node specs
  (`test/text-events.mjs`, red then green — default/readback,
  edges-group throw, case mapper, label-box pick on/off, the
  events-wins rule) and a `webgpu` Playwright spec (a click on the
  label below the node background-taps under the default and
  selects the node under `text-events: 'yes'`).  2190 Node tests,
  typecheck + lint clean.
- [x] **20.4 Two-finger cxt** (2026-08-01) — the v3 split lands in
  the pointer layer's touch bookkeeping: a second finger closer
  than 200 css px starts the cxt gesture (`cxttapstart` on the node
  under finger 1, else finger 2, else the core — the sync CPU
  pick), the pair moving emits `cxtdrag` + `cxtdragover`/`out`
  (via the existing 17.3 drag-hover pick), spreading past 1.5× or
  150 px cancels into a pinch (`cxttapend`, pinch rebased at the
  current spread — no zoom jump), and either finger lifting ends it
  (`cxttapend` + `cxttap` when never dragged, never on
  pointercancel) with the leftover finger inert, like a pinch's.

  A
  pair ≥ 200 px apart pinches immediately, so the two existing
  pinch specs' fingers moved to 220 px spacing (they'd have started
  cxt gestures under the new rule — exactly v3's behavior).
  Recorded deviation: `cxtdrag` thresholds on finger-1 movement
  past `touchTapThreshold` (v4's mouse cxt rule) where v3's touch
  cxt fires on any move event.

  Pinned in a `webgpu` Playwright
  spec (four synthetic-touch scenarios: close-pair tap on the node
  → exactly cxttapstart/cxttapend/cxttap; parallel background drag
  → cxtdrag, no cxttap, no pinchzoom; spread → cxttapend then
  pinchzoom with the zoom actually rising; far pair → pinch only),
  verified red against the pre-20.4 pointer layer before the
  implementation was restored.  80/80 webgpu Playwright specs,
  2190 Node tests, typecheck + lint clean.
- [x] **20.5 Three-finger box** (2026-08-01) — v3's centroid box on
  the pointer layer: three fingers (with `boxSelectionEnabled`)
  sweep from the start centroid (+1 px seed, v3) to the moving
  centroid, `boxstart` on the first move, the themed DOM box drawn
  live (the overlay/styling shared with the mouse box via a new
  `showBoxRect` helper), applied on any box finger's lift —
  boxend/box/boxselect through `elementsInBox` (so the 16.5 label
  option applies) filtered to `interactive()` (the 20.2 rule), and
  **additive** as v3's touch box is (it never clears the prior
  selection).

  The box preempts a pinch in progress (v3's
  touchmove branch order) and the didSelect latch keeps leftover
  fingers inert until all lift.  **Design call, recorded**: a third
  finger landing on an *undragged* cxt pair converts it to the box
  gesture (`cxttapend` first) — pointer events land fingers
  sequentially, so v3's simultaneous three-finger landing has no
  direct v4 equivalent, and without the conversion the gesture
  would be unreachable over close pairs.  An aborted gesture
  (pointercancel) hides the box and selects nothing.

  Pinned in a
  `webgpu` Playwright spec (close-pair + third finger →
  cxttapstart/cxttapend then boxstart/boxend/boxselect of exactly
  the swept nodes, zoom + pan byte-unchanged, leftover fingers
  inert; boxSelectionEnabled off → no box events, nothing
  selected), verified red against the pre-20.5 pointer layer.
  81/81 webgpu Playwright specs, 2190 Node tests, typecheck + lint
  clean.
- [x] **20.6 pixelRatio spec + closing docs sweep** (2026-08-01) —
  the `webgpu` spec confirmed the pre-existing option end to end
  (`pixelRatio: 1` → backing store = css size, `2` → doubled, and
  `cy.pick` at css coordinates still resolves the node), so no
  code was needed.  Closing sweep per the standing rule: both docs
  grepped for the round's vocabulary and staleness markers — fixed
  the round-10 deferred list (12c/compounds/z-index/GPU
  layouts/multiline/three-finger entries all stale since their
  rounds landed), trued up both file headers with rounds 19–20,
  and recorded pixelRatio + the touch-box close in their sections.

  **Round 20 is complete**: 2190 Node + 63 module tests, 147
  Playwright specs (renderer + visual — goldens untouched),
  typecheck + lint clean.

**Risks tracked**: Frame-uniform layout change touches every pass
(one struct, asserted by the existing goldens — any misalignment is
loudly visual); pick-cache staleness on `events` writes (spec pins a
flag flip between two picks at the same cursor); touch synthesis
fidelity in Playwright (the pinch spec's synthetic-pointer precedent;
gestures are driven through pointer events, so no Touch APIs needed);
threshold semantics drift (the pointer layer must pick the threshold
by `pointerType` per event, not per instance).
