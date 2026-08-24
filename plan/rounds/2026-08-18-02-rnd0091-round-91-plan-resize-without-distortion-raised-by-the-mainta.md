## Round 91 plan — resize without distortion (raised by the maintainer 2026-08-18)

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

