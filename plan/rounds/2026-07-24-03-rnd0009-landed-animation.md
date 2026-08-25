## Animation

Direction (discussion): animation is a v4 priority and should scale.  API
first, on the CPU-canonical path (complete + correct + Node-testable); a
GPU tween fast path is the planned optimization underneath, transparent to
the API.

- **Animation API + CPU tweening** (`src/animation.mts`).  Tween
  element style/position (and the viewport) from captured start values to
  explicit targets over a duration, easing normalized time.  Collection:
  `animate`/`animation`/`animated`/`stop`/`delay`/`delayAnimation` +
  `promise()` + a per-element queue (the queue since removed — round
  21 runs animations concurrently by channel); core: `animate` (viewport pan/zoom),
  `animated`, `stop`.  Each tick writes the store columns (works headless;
  a rAF-or-timeout auto-driver, plus a deterministic `tick(now)` for
  tests).  Standard easings.

  Animatable: `position`, node `opacity`,
  `border-width`, `background/border/line-color` — the coupling-free set;
  size (width/height circle-collapse) and arrow-folded channels are a
  follow-up (both since landed — the arrow fold in round 9.4, the
  geometry channels in round 25).
- **Ownership: transient lease** (design set this round).  A tween is
  CPU-reproducible (pure fn of time), so the CPU columns stay
  authoritative on the CPU path.  The lease model — default
  CPU-authoritative, GPU-authoritative during a position episode with
  readback-on-settle — is the shared substrate for the GPU tween path and
  (later) GPU layouts.  **Grabbing is forbidden while an element
  animates** (`pointer.canDrag` consults `isAnimating`), removing the
  two-way drag-feedback boundary.
- **GPU position fast path** (`render/gpu-tween.mts`, landed).  Position
  animations offload to a compute pass: per-slot from/to uploaded once, a
  `now` uniform bumped per frame, `node.position = mix(from, to, ease(t))`
  on-device in its own pre-cull pass (barrier → cull + edges read the
  tweened positions).  `node.position` is GPU-owned during the tween (the
  mirror skips its uploads), CPU reads stale, settle-on-complete
  re-derives the exact final on the CPU (no readback — tween is
  CPU-reproducible).  The renderer drives the frame clock while active;
  the manager routes position-only animations to the sink and cedes its
  auto-loop.

  Playwright proves the lease on a real adapter (CPU
  `position()` stays at start mid-flight while the node moves; settles
  after).  Paint/size GPU tweens are a follow-up.
- **Deferred:** GPU tween for paint/size channels; and **GPU layouts**
  (stateful, not CPU-reproducible → GPU-authoritative-with-readback + a
  CPU reference for headless) — reuse the lease machinery; per-algorithm
  kernels are a future round.
