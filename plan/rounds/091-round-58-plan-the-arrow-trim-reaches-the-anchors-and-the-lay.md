## Round 58 plan — the arrow trim reaches the anchors and the layer strokes (ledger item 24; planned 2026-08-09)

Scheduled at the seventh sitting, after the maintainer asked what it
would cost (answer: negligible — see item 24's ledger entry).  Round 56
landed the trim where the *ink* is drawn and left three consumers
reading untrimmed geometry, each blocked by a vertex stage at the
8-storage-buffer budget or simply unimplemented.  Scoping this round
against the code found the defect family is wider than item 24's two
entries, and gave the fix one rule:

**Ink hugs the draw trim; anchors sit at the gap trim.**  The drawn
line uses `arrowDrawTrimW` — v3's `gap`, extended to the head's axial
depth for hollow/translucent heads, reproducing v3's `destination-out`
erase.  The accessors (`midpoint()`, the endpoints) use v3's plain
`gap`/`spacing` via `arrowTrimAt`.  So: layer strokes (overlay /
underlay / casing) take the **draw trim** — v3 strokes its casing along
the shortened path and its erase then reaches the layers too — while
label anchors and mid-arrow anchors take the **gap trim**, because they
must land exactly where `midpoint()` answers, which is v3's `rs.mid`
built from the gap-shortened `allpts`.  (Measured 2026-08-09:
`calculateEndProjection` walks `rs.allpts`, whose first point is
`rs.startX/Y` = the boundary intersect shortened by `gap` —
`edge-endpoints.mts:327-334` — so end labels walk gap-trimmed geometry
in v3 too.)

The binding math, measured per stage:

- **Straight stream** (`EDGE_SHADER`): one bind group layout serves the
  scene, pick and layer entry points, and `edge.width` is already in it
  at vertex visibility — `vsEdgeLayer` just never reads it.  No layout
  change at all; the layer VS today runs node centre to node centre,
  not even stopping at the boundary.
- **Curved layer VS** (`vsCurvedLayer`): its own layout, at 8 exactly —
  endpoints, nodePositions, nodeOuterHalf, nodeShapes, curveParams,
  curveBlob, edgeLayer + the visible list — with no slot for
  `edge.width`.
- **Edge label VS** (`vsLabel`, edge variant): at 8 exactly — glyphs,
  endpoints, nodePositions, curveParams, nodeOuterHalf, nodeShapes,
  curveBlob + the visible list.
- **Straight mid arrows** (`vsMidArrow`): binds everything it needs
  already; anchoring at the centre-chord midpoint instead of v3's
  four-point mean is unimplemented math, not a binding.

Both starved stages bind `node.outerHalf` *and* `node.shape`, which is
the freed slot: a derived **`node.outerGeom`** column fuses them.

### Items

- **58.1  `node.outerGeom`** — Float32Array(4·cap), derived:
  `[ outerHalf.x, outerHalf.y, shapeId, 0 ]`.  Contract first
  (`contract.mts` owns the layout).  Written by `updateOuterHalf`
  (which already follows every size/border write, and geometry tweens
  are CPU-per-tick through the same cascade, so the column is
  tween-correct for free) and by the `node.shape` branch of
  `setScalar`.  Shape ids are ≤ 26, so `f32(shape)` is exact.  Nothing
  reads it on the CPU — like `edge.width` lane 1 it exists for the
  vertex stages — and it holds no slot references, so compaction moves
  it like any other column.  A modules spec pins it in lockstep with
  its two sources across add, restyle, size writes and compaction,
  with the control run (drop the shape hook) confirming the spec can
  fail.  +16 B/node CPU and GPU.
- **58.2  The straight stream** — `vsEdgeLayer` resolves boundary
  points and applies the draw trim exactly as `vsEdge` does (including
  the crossing-collapse clamp and the haystack/triangle exclusions);
  `vsMidArrow` anchors at v3's four-point mean
  `(lineStart + lineEnd + arrowStart + arrowEnd) / 4` — the CPU
  `midpoint()` formula — instead of the centre chord.  No binding
  changes.
- **58.3  The curved layer VS** — its layout swaps
  `nodeOuterHalf` + `nodeShapes` for `outerGeom`, spends the freed slot
  on `edge.width`, and passes `arrowTrimOf` to the evaluators where it
  passes `vec4f(0.0)` today.
- **58.4  The edge label VS** — same swap, same freed slot.  A new
  generated `arrowGapTrimOf` (the plain-gap twin of `arrowTrimOf`,
  mirroring CPU `arrowTrimAt`) feeds every evaluator call that passes
  `vec4f(0.0)` today, the straight mid-label fallback becomes the
  four-point mean, and the straight end-label walk starts from the
  gap-trimmed chord (v3's `allpts`).  The two curved mid-arrow call
  sites switch `arrowTrimOf` → `arrowGapTrimOf` for the same reason —
  a mid arrow is an anchor, not ink, and with a hollow *end* head the
  draw trim would seat it off `midpoint()`.
- **58.5  Verification** — the lockstep spec (58.1); a live v3-vs-v4
  close-up parity scene per fixed consumer, built to *expose* the fix
  (labels on short arrowed edges with asymmetric heads; casing/overlay
  on arrowed edges with hollow heads, where the untrimmed stroke shows
  through), each run once with the fix disabled to prove it
  discriminates; goldens regenerated for scenes the anchors move, each
  diff inspected before committing; the round-56 "untrimmed" comments
  in `shaders.mts` and both documents' deviation notes swept.

Deliberately out of scope: hollow *mid* arrows (item 21, punted by the
sixth sitting) and the `arrow-scale` quantization (item 23, deferred —
this round spends no reserved bits, exactly like round 56).

### Landed (round 58) — 2026-08-09

All four items shipped as planned, in two commits (58.1 the store
column; 58.2–58.4 the renderer, whose pieces cannot land separately),
plus the closing docs commit.  The suites at the close: 2090 Node +
304 module tests, throw gate clean, renderer 116, visual 121 — the two
new close-up scenes included, goldens exact.

**What the verification measured.**  Both new parity scenes read
**0.000%** — pixel-exact against v3 — with the fix in, and fail hard
with it removed: `parity-closeup-layers` 1.535% (7.7x its 0.2% bound)
with the vsEdgeLayer branch deleted, `parity-closeup-midarrow` 5.580%
(27.9x) with the centre chord restored.  The label property spec pins
the rendered ink centroid to `renderedMidpoint()` on a straight edge
whose asymmetric head shifts the four-point midpoint 16 rendered px
off the centre chord (precondition-asserted, so the spec cannot be
satisfied by the untrimmed anchor), and on an unbundled bezier; its
control fails it.  One golden moved — `edge-layers`, only at the
straight row's two ends, where the strokes now stop at the boundary
instead of running under the node discs — inspected and regenerated.

**What the round found beyond its plan, in the order found:**

- **The stale-bundle trap caught this round's own controls.**  The
  first control run flipped the shaders off and re-ran the scenes
  without rebuilding — both stayed green at 0.000%, because `npx
  playwright test` invoked directly exercises whatever bundle is on
  disk.  AGENTS.md warns exactly this; the scene comment now records
  the instance.  Every control number above is from a rebuilt bundle.
- **A parity scene's first two drafts each measured a real thing that
  was not the trim** — the round's own instance of "ask what is
  painted over it".  Draft one (big heads) read 3.160%, all of it the
  recorded erase-overlap compositing deviation where two huge heads
  meet mid-span.  Draft two (small heads, underlay + casing) read
  7.105%, and the diff showed band-width, not trim: **v3's edge
  underlay/overlay stroke is `2 × padding` wide where v4's is
  `width + 2 × padding`** — a divergence nothing had measured, logged
  as ledger item 27 rather than silently patched.  The shipped scene
  is casing-only, because `line-outline` is the one layer whose width
  formula the two libraries share; it still exercises the same layer
  entry points the underlay draws through.
- **The round-37.1 throw gate fired correctly** on 58.1's store
  insertion shifting the SHAPE_MASK invariant off its `file:line`
  key — re-keyed 2888 → 2906, the maintained-allowlist flow working
  as designed, in its second live firing.

**Cost, as predicted**: +16 B/node CPU and GPU for the fused column,
no new per-frame CPU work, no new draw calls; the trim math runs in
two more vertex stages over the smallest streams the renderer draws.
The curved *end* arrows deliberately keep `arrowTrimOf` — their tips
sit at spacing points that are identical under both trim functions,
and their evaluator inputs stay byte-identical with round 56's.
