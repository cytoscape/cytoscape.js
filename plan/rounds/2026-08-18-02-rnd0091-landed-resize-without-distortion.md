## Resize without distortion

The maintainer, resizing the debug page: the network view stretches
or squishes with the window.  What the code does today, verified:

1. **The steady state is already correct.**  Measured on a served
   page: an 800×600 container resized to 1300×500 leaves the backing
   store at exactly 1300×500, circles round, zoom and pan untouched —
   the `ResizeObserver` (`src/render/renderer.mts:356-360`) calls
   `resize()` → `applySize()` (`renderer.mts:2407-2415`), which sizes
   `canvas.width/height` from `container.clientWidth × dpr`.  So the
   distortion is **transient, not steady-state** — but during a live
   window drag "transient" is every frame of the drag.
2. **The stretch mechanism is the `100%` canvas CSS plus a
   frame-late redraw.**  v4's canvas is styled `width/height: 100%`
   (`renderer.mts:330-331`), so the compositor scales whatever was
   last presented to the new CSS size immediately; the redraw that
   would correct it is `schedule()`d to the *next* rAF
   (`renderer.mts:402-410`, :1236-1247), and ResizeObserver callbacks
   run *after* this frame's rAF in the event-loop rendering steps —
   so every resize step composites at least one frame of
   stale-content-stretched-to-new-size.  A continuous drag is a
   continuous rubber-band.
3. **v3 is structurally immune, and not by redrawing faster.**  v3
   sizes its canvases in **fixed CSS px**, written only inside the
   synchronous redraw (`canvas.style.width = width + 'px'`,
   `v3/src/extensions/renderer/canvas/drawing-redraw.mts:219-239`),
   and its resize handler is *debounced 100 ms*
   (`v3/src/extensions/renderer/base/load-listeners.mts:326-343`).
   During a drag a v3 canvas is momentarily the wrong *size*
   (letterboxed), never the wrong *shape* — stale coverage reads as
   lag; stale stretch reads as the graph deforming.
4. **`dpr` is frozen at construction** (`renderer.mts:319-322`) where
   v3 reads `devicePixelRatio` live per redraw
   (`drawing-redraw.mts:12`).  A browser-zoom change or a move to a
   different-density monitor leaves v4 rasterizing at the stale
   ratio — uniform blur rather than stretch, but the same round owns
   it: `applySize` is the one consumer.  Note browser zoom does not
   change `clientWidth` (CSS px), so the ResizeObserver alone will
   not catch it — the standard hook is a `matchMedia('(resolution:
   …)')` listener re-armed per change.
5. `cy.resize()` is public (`src/core.mts:2008-2011`) and the debug
   container is a plain absolutely-positioned box
   (`debug/style.css:2`), so nothing harness-side contributes.

### 91.1 — the canvas presents at the size it was drawn

Two candidate shapes, decided by driving the page, cheapest first:

- **Synchronous frame in `resize()`** (recommended first look): call
  `frame()` directly after `applySize()` instead of `schedule()`ing.
  ResizeObserver runs before paint in the same rendering update, so
  the frame that composites the new layout composites new content —
  the stretched frame never exists.  Cost: nothing new per frame
  (RO fires at most once per frame); the care point is re-entrancy
  (a `frame()` mid-rAF-chain must not double-tick animations — the
  clock is `performance.now()`-driven, but assert it).
- **v3's fixed-px canvas CSS**, written in `applySize`: even when a
  frame is late, a wrongly-*sized* canvas letterboxes rather than
  distorts.  Belt-and-braces with the above; costs a style write per
  actual size change.

**Verified by** a Playwright spec that resizes the container and
asserts, without waiting extra frames, that the presented pixels are
undistorted — render one filled circle, resize, screenshot on the
next compositor frame, assert the ink's width/height ratio (the
steady-state half is cheap; the transient half is the reason the
spec exists, and if the harness cannot observe a single compositor
frame deterministically, the spec asserts the synchronous-path
invariant instead: after `resize()` returns, the canvas has already
presented at the new size).  Plus the standing rule: drive `debug/`
and drag the window edge, before and after.

### 91.2 — live pixel ratio

`applySize` re-reads `devicePixelRatio` when `opts.pixelRatio` is
`'auto'`/absent (the constructor keeps honouring an explicit number),
and a `matchMedia` resolution listener — re-armed per change, removed
on destroy — triggers `resize()` so browser zoom re-rasterizes.  The
scene/depth/pick targets already rebuild off canvas size, and the
label thresholds already scale by `dpr`; the sweep is checking the
few places that cached `this.dpr` at init.

**Verified by** a spec that flips a mocked `devicePixelRatio` (CDP
`Emulation.setDeviceMetricsOverride` in the renderer project) and
asserts the backing store follows; control: pin `pixelRatio: 1` and
assert it does not.

### Risks named at planning

- A synchronous `frame()` from the RO callback runs GPU submits
  inside the rendering steps — Dawn is fine with it, but the frame
  must tolerate `canvas.width === 0` (already guarded,
  `renderer.mts:1263`) and a destroyed renderer racing a late RO
  fire (already guarded, :403).
- Goldens and parity scenes never resize, so none should move; if
  one does, something leaked into the steady state.
- The debounce question: v3 debounced 100 ms to keep canvas
  reallocation off the drag's critical path.  v4 reallocates no
  canvas DOM (one canvas, `width`/`height` writes) and the swapchain
  resize is the browser's own; if profiling shows reallocation churn
  in `ensureSceneTarget` during drags (a texture rebuild per step),
  the fix is a short settle for the *offscreen targets only* — never
  for the presented size, which is what must track the drag.

**Open:** whether 91.1 ships both halves or the synchronous frame
alone (recommended: both — the fixed-px CSS also covers the
no-ResizeObserver fallback path, where today nothing resizes at
all); whether a `devicePixelRatio` change should also emit `resize`
on the core (recommended: yes — v3's `cy.resize()` semantics).

### Landed (2026-08-28)

Landed as planned, both opens taken as recommended: **91.1 ships both
halves** (the synchronous frame *and* v3's fixed-px canvas CSS), and a
device-pixel-ratio change **emits `resize` on the core** — v3's
`cy.resize()` semantics.

**91.1, as shipped.**  `resize()` calls `frame()` directly after
`applySize()` whenever the renderer is ready: ResizeObserver callbacks
run after this rendering update's rAF and before its paint, so the
frame that composites the new layout composites new content — the
stretched frame never exists.  The named re-entrancy risk resolved two
ways: the animation clock is `performance.now()`-driven, so an extra
tick inside the same rendering update advances no tween beyond wall
clock; and the one true recursion — a
`cy.resize()` called from inside a `render` handler — is cut by an
`inFrame` latch that falls back to the scheduler (`frame()` became a
latch wrapper over `frameBody()`).  `applySize` now writes the canvas
CSS box in fixed px (`clientWidth`/`clientHeight`), so whenever a
frame *is* late — the no-ResizeObserver path, or the worker mount,
which is always at least a message late — the canvas letterboxes
rather than stretches.  Both halves are mirrored on the worker mount:
the proxy re-fits the CSS box synchronously in its `resize()` and at
mount.

**91.2, as shipped.**  `applySize` re-reads `devicePixelRatio` per
measure when the ctor option was `'auto'`/absent (the constructor
keeps honouring an explicit number), and a matchMedia
`(resolution: …dppx)` listener — re-armed per change, torn down on
destroy — triggers `resize()` and emits `resize` on the core through
a new `RenderHost.emitResize()` seam.  A ratio change drops the
cached pick tile (device-px addressed), in both `applySize` and
`setSize`.  The worker mount keeps its ratio pinned worker-side and
receives updates explicitly: the proxy re-reads the live ratio, arms
the same matchMedia watch, and the `resize` protocol message now
carries `dpr`, which `setSize` applies — so worker-side edge picks
scale correctly after a zoom change.  The planned sweep of cached
`this.dpr` consumers found none stale: every same-thread consumer
reads the field live per call, labels scale through the per-frame
`zoomDpr` uniform, and the CPU pick params are built per pick.

**Verified by** three tiers, every control run and failed on cue.
`test/modules/renderer-resize.mjs` exercises the DOM-facing half
headless against a fake document (fixed-px CSS at mount and re-fit,
live-ratio re-read, pinned-ratio control, matchMedia arm → fire →
re-arm → emit → destroy teardown; controls: the fixed-px write
removed fails 2 specs, the ratio re-read removed fails 2, the
re-arm/emit removed fails 1).  In `playwright-tests/renderer.spec.js`,
the 91.1 spec asserts the synchronous-path invariant the plan named:
sampled in the same task as `cy.resize()` — no await, no rAF —
`stats().frames` has already advanced and the canvas is already at
the new size in both device px and CSS px; then the steady-state ink
of a 100 px circle stays square within 2 px after a 500×300 reshape,
and a bare layout change with no `resize()` call still re-measures
through the ResizeObserver (control: the pre-91 `schedule()` shape
fails the frames assertion deterministically).  The 91.2 spec runs a
real CDP `Emulation.setDeviceMetricsOverride` — with one measured
surprise below — plus a stubbed-input pass through the real bundle
and the pinned-ratio control; a worker spec pins the proxy's fixed-px
CSS re-fit and the size crossing to the worker's backing store
(control: the resize-path CSS write reverted to `100%` fails it).

**One measurement the plan did not predict.**  Headless Chromium's
CDP metrics override moves `devicePixelRatio` and flips a resolution
query's `matches`, but **never dispatches the matchMedia change
event** (measured: 1 s of driven frames, `matches` false, zero
events) — and Playwright's own emulation re-asserts its viewport
override under screenshots, silently clobbering the CDP ratio back.
So the browser spec splits per the plan's own escape hatch: part A
pins the applySize re-read against the *real* override through one
`cy.resize()`; part B stubs the two platform inputs in-page
(matchMedia + `devicePixelRatio`) and fires the armed listener, so
everything from the handler down — re-measure, re-rasterize, emit,
re-arm — runs through the shipped bundle; the event *dispatch* itself
is the platform's contract, pinned headless in the Node spec's fake
and un-pinnable in this harness.

**The debounce question** stayed answered as planned: no debounce
anywhere on the presented size.  A scripted seven-step window drag on
the debug harness (`?network=v3-default`) drew exactly one
synchronous frame per step — `stats().frames` 2 → 9 — with the
canvas device-px and CSS-px sizes tracking every step, per-frame cost
steady at ~0.5 ms CPU / 0.5 ms GPU, and no device errors; the
offscreen scene/depth targets rebuild per size change as before, and
the goldens and parity scenes moved by nothing (the steady state was
already correct, and stayed so).
