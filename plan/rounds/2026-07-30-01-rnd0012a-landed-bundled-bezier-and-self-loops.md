## Bundled bezier and self-loops

Ran under the round-10 process rules (isolated commits, docs
in-commit, full verify per item, escalation on real API calls).  Items
landed in CPU-first order; each entry below was written in the commit
that landed it.  (Since superseded: pass 12b — unbundled/segments/taxi
— landed 2026-07-30/31, see its round record; pass 12c — endpoints +
haystack/straight-triangle — remains in the round-12 plan above.)

- [x] **Curve geometry module + contract columns.**
  `src/curve-geometry.mts` is the CPU half of the dual-impl
  discipline for curves: v3's math ported verbatim (bundle stagger
  `(0.5 − n/2 + i)·step`, loop rays `loopDir − π/2 ∓ sweep/2` at radius
  `1.4·step·(j/3 + 1)`, the `edge-distances: intersection` frame with
  the impossible-bezier clamp, endpoints on the node boundary toward
  the near control point, the loop's two C1-continuous quadratics
  through the control midpoint), with node boundaries at the arrow
  shader's approximation tier (ellipse/rect exact, round-rect as box,
  polygon as inscribed ellipse — recorded deviation).

  Also:
  `curvePointAt`/`flattenCurve` (the drawn subdivision, CURVE_SEGS =
  24) and the conservative `curveDeviation` hull bound for cull/fit.
  Contract: `edge.curveParams` column (f32×4; kind packed at [3] so
  the curve shaders fit the vertex stage's 8-storage-buffer budget)
  + `CURVE_*` kinds + the store-managed `FLAG_CURVED` bit the cull
  kernels will split the edge streams on.  17 Node specs pin the port
  against hand-derived v3 values (incl. the antiparallel-edge
  world-invariance of the stagger sign and the C1 loop join).
- [x] **Curve style props + bundle index + param derivation.**  Five
  edge props (`curve-style` straight|bezier, `control-point-step-size`,
  `control-point-weight`, `loop-direction`, `loop-sweep` — v3 defaults;
  angles take numbers-as-radians or deg/rad strings, constants and
  mappers alike, stored-truth readback off the styled record, nodes
  group throws).

  `store/curve-index.mts` owns the styled records and
  derives `edge.curveParams`: a lazily-built parallel-edge pair map
  (straight-only graphs pay nothing but a loop check per edge add),
  always-maintained per-node loop lists, and pending-pair lazy flush
  (takeDelta / boundingBox / accessor reads) so a bulk load or style
  apply derives each pair once.  v3 rules pinned: 2-bundle ±step/2
  stagger, odd-middle straight, lone-bezier straight, per-edge step,
  antiparallel sign flip, loop j-stagger per (direction, sweep), and
  re-derivation on add/remove/`move()`/restyle/mapper-refresh.

  `store.boundingBox()` grows its edge term by the conservative hull
  deviation, and `store.curveSlack()` gives the frame-level bound the
  cull kernels will use (monotone maxima — never shrinks, costs only
  cull efficiency).  24 Node specs (`test/curve-index.mjs`).
- [x] **Curve-aware accessors + the exact lazy edge bb.**
  `isBundledBezier()` (style check, v3 semantics — true for the lone
  edge that renders straight), `controlPoints()` (one point for a
  bundled bezier, two for a loop, undefined for straight — v3's
  surface) + `renderedControlPoints()`; `midpoint()` returns the curve
  midpoint (v3's rs.mid) and `source/targetEndpoint()` return the
  curve's boundary endpoints for curved edges (straight edges keep the
  node-center approximation).

  `eles.boundingBox()` reads the **exact
  lazy tier**: `store.curveBBAt()` flattens the curve at the drawn
  subdivision and memoizes per slot against a geometry epoch (any
  geometry write invalidates all cached boxes at once — sound, cheap,
  and consistent with the position-tween lease).  `boundingBoxAt`
  (animated-layout fit targets) expands curved edges by the
  conservative hull deviation.  16 Node specs
  (`test/curve-accessors.mjs`).
- [x] **Renderer: the curved-edge pipeline, cull stream and pick.**
  `CURVED_EDGE_SHADER` + `CurvedEdgePipeline`: one instance per curved
  edge drawn as a strip of CURVE_SEGS quads whose VS evaluates the
  curve (the WGSL twin of `curve-geometry.mts` — same intersection
  frame, boundary approximations, clamps) from live positions + the
  params column; vertices extrude along the curve normal *at their own
  t*, so adjacent quads share exact edge geometry and the strip is
  watertight without miters.  The vertex stage binds exactly 7 columns
  + the visible list (the base 8-storage-buffer budget); paint columns
  (line color/opacity/line-style) moved to the fragment stage via flat
  instance fetch, and dashes ride a per-vertex polyline arc-length
  varying.  Cull: a new `curvedEdge` kind splits the edge draw on
  FLAG_CURVED (the straight predicate rejects the bit) — same five
  inputs, chord test grown by `frame.curveSlack` (the Frame uniform's
  spare pad slot), no decimation on the curved stream; `CullInfo`
  gained `indexCount` so one scan kernel serves both 6-index quads and
  6×CURVE_SEGS strips.

    The pick pass draws the same strips
  (edges-only tile, `pickCull.curved`), so pick coverage equals pixels
  by construction; image export gained the curved group too.  One
  init-order bug found by the specs: the mirror's construction-time
  full upload ran *before* the lazy curve flush whose usual flush
  point (takeDelta) is discarded at init — flush now runs first.

  Verified: 3 new `webgpu` specs (fan-off-the-chord with pixels at
  the CPU-computed `renderedMidpoint` — the dual-impl guarantee made a
  test; ≤64 B re-shape on drag; pick on the bulge vs chord; loops
  render as loops), 2 new goldens (`bezier-bundles`, `self-loops`),
  and a live v3-parity curve scene measuring **0 differing pixels**
  (8px strokes so pixelmatch's AA skip can't mask placement error,
  plus an ink guard) — 59/59 Playwright, 1707 Node, 59 module tests,
  typecheck + lint green; pre-existing goldens byte-identical.
- [x] **Arrows on curve end tangents.**  The insight that made this a
  small change: a quadratic's end tangent points from the control to
  the endpoint, so the curved arrow is *the straight arrow math with
  the control point substituted for the far endpoint* (source end uses
  c1, target end c2 — coincident for a bundled bezier).
  `CURVED_ARROW_SHADER`/`CurvedArrowPipeline` ride the curved cull
  stream's new **single-quad args block** (the scan kernel now writes
  a second `[6, n, 0, 0, 0]` at byte 20 of the indirect buffer, so
  strip streams can also drive one-quad-per-instance draws).

  Budget
  cut, recorded: no node-border column fits in the 8-buffer vertex
  stage, so curved-edge arrow tips sit on the size/2 boundary and the
  frame uses border-exclusive halves — exact for the default border 0,
  ≤ border/2 off otherwise (revisit with 12c endpoints).  New
  `curved-arrows` golden (bundle fan converging on the target, an
  antiparallel pair, a loop arrow riding the in-ray tangent); 60/60
  Playwright, 1707 Node, 60 module tests green.
- [x] **Edge labels at the curve midpoint + autorotate tangent.**  The
  edge label VS binds the curve inputs (7 storage buffers + the
  visible list — exactly the vertex-stage budget) and anchors curved
  owners at the curve midpoint computed from live positions, so
  curved-edge labels keep the zero-rebuild property.  Autorotate
  generalizes for free on beziers — a quadratic's t = 0.5 tangent *is*
  the chord direction, so the existing endpoint frame is already exact
  — and loops rotate along their c1→c2 midpoint tangent.

  The
  edge-glyph cull (at its own 8-buffer budget, no params binding)
  grows its chord-midpoint test by the frame's curve slack for
  FLAG_CURVED owners; rotated curved labels take a frame-independent
  anchor-centred bound (a loop's rotation frame differs from the
  chord's).  New webgpu spec (glyphs at the CPU-computed
  `renderedMidpoint`, none on the chord, ≤ 64 B re-anchor on drag) +
  `curved-edge-labels` golden (bundle labels per-curve, an autorotated
  boxed label tilted with the chord, a loop label on the loop
  tangent); 62/62 Playwright, 1707 Node, 60 module tests green.
- [x] **Renderer benchmark: the curved pan scene.**  A new
  `gen-25k-curved` scene generates its 50k edges as parallel *pairs*
  (a lone bezier renders straight, so a random-edge scene would
  measure nothing) with `curve-style: bezier` opted into on both
  sides; the runner also gained the platform-gated Linux
  ANGLE-on-Vulkan flags from playwright.config.js — without them it
  silently fell back to SwiftShader (and the software rasterizer then
  lost the device under the curved load).

  Same-machine A/B on this
  box (AMD RX 580 / RADV, dpr 2, 1280×800, scale pinned 1), GPU
  device-time p50, straight `gen-25k` vs `gen-25k-curved`:
  continuous-pan fit-all 3.3 → 8.6 ms (~2.6× for 24 quads/edge over
  every edge — well under a 60 fps frame; wall clock stays
  vsync-bound at 16.7 ms on both scenes), zoomed-in 20× 4.4 → 3.8 ms
  (culling keeps the curved stream cheap), far-zoom 1.2 → 6.4 ms —
  the documented no-decimation trade-off on the curved stream showing
  up exactly where expected (revisit with 12c's haystack).  v3 canvas
  ~650 ms/frame fit-all either way (bezier barely moves its cost);
  init 3.0 s v3 vs 169 ms gpu; hover-while-panning pick p50 ~18 ms on
  this box.

  Round 12a is complete: props, derivation, accessors,
  exact bb, render, cull, pick, arrows, labels, goldens, parity and
  benchmarks all landed.
