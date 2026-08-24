## Round 12 plan — curved edges (planned 2026-07-29)

The head of the design queue: v4 renders `curve-style: straight` only,
and the curve families are the single biggest visual gap — bundled
bezier is v3's *default* look, and a self-loop currently degenerates
to a point in v4 (a standing correctness wart, not just a missing
style).  The design tier was decided 2026-07-24 (the expensive-GPU-
geometry model): **dual CPU/WGSL implementations that agree by
construction** — never one side reading back the other — with a
**conservative CPU over-approximation for cull/fit**, **exact lazy
CPU eval memoized per element for public `.bb()`**, and bundle
*membership* as a cheap CPU structural index rebuilt on edge
add/remove/move, not per frame.

The 2026-07-29 triage added
`haystack` (+ `haystack-radius`) and `straight-triangle` to this
surface as real visual styles.  This section slices the work into
passes and records the implementation calls so the passes can run
under the round-10 process rules (isolated commits, docs in-commit,
full verify per item, escalation on any real API call discovered
mid-implementation).

**Implementation calls (made at planning):**

- **Geometry ports v3's math verbatim.**  Control points, loop
  construction, segment/taxi routing and endpoint math come from the
  same formulas v3 uses (`v3/src/extensions/renderer/base/coord-ele-math/
  edge-control-points.mts` — the step-size stagger for bundles, the
  loop-direction/sweep construction, the distance/weight frame for
  unbundled beziers and segments, the taxi turn logic), so curves are
  pixel-comparable in the live v3-parity harness and existing figures
  reproduce.  No silent simplifications: any spot where v3's math
  can't ride the GPU path becomes its own logged call.
- **Curves evaluate in the vertex stage from live endpoint positions
  plus per-edge curve parameters.**  Rendered curves are instanced
  segment strips — K quads per edge instead of 1 — whose VS computes
  the curve point analytically from the two endpoint positions (the
  same buffer straight edges already fetch) and a small per-edge
  parameter record (curve kind, bundle offset, loop angles, segment/
  taxi params).  The parameters are position-independent (offsets and
  weights in the endpoint-relative frame), so drags, layouts and
  position tweens follow on-GPU with **zero rebuild**, exactly like
  straight edges, arrows and edge labels today.

  Variable-length
  params (segment lists) live in a param blob + per-edge offset
  column — the one storage-layout addition.  K is fixed per curve
  family (bezier/loops subdivide; segments/taxi are exact polylines,
  K = their true segment count), with a far-zoom LOD reduction as a
  tune knob resolved by goldens + the renderer benchmark during 12a —
  not an API surface.
- **One flattening, every consumer.**  The CPU twin evaluates the
  same closed forms: exact lazy `.bb()` (memoized, invalidated by the
  same dirty channels that invalidate the render), CPU pick against
  the flattened polyline at the same subdivision the shader draws (so
  pick agrees with pixels by construction; the GPU pick tile draws
  the same segment strips for the edge stages), and cull/fit read the
  conservative bound — endpoint hull expanded by the maximum control
  offset (bundle stagger, loop extent, segment/taxi excursion) — per
  the decided tier.

  Arrows sit on the endpoint node's boundary along
  the curve's **end tangent**; edge labels anchor at the curve
  midpoint (t = 0.5) computed in the VS, so autorotate's angle
  generalizes from the endpoint delta to the midpoint tangent.
- **Box selection keeps endpoint-center containment in 12a** (the
  existing straight-edge approximation, already a recorded
  deviation); upgrading `refsInBox` is revisited with 12b when the
  CPU evaluator covers every family.  (Since done: 12b's revisit took
  v3's exact rule — curved edges test their *curve boundary
  endpoints*, which is what v3's 'contain' actually checks, rather
  than the flattened polyline; straight edges keep centers.)

**Pass split** (each pass lands as isolated commits with Node
geometry tests pinned against v3's math, a golden scene per family, a
live v3-parity scene under the standard tolerance bound, and a
follows-drag/tween Playwright spec pinning the zero-rebuild property):

- **12a — bundled bezier + self-loops** (landed 2026-07-30 — see the
  round 12a record; the default v3 look, and the loop fix): `curve-style` prop (`straight` | `bezier`),
  `control-point-step-size`, `control-point-weight`, `loop-direction`,
  `loop-sweep`; the parallel-edge bundle membership index (keyed on
  the unordered endpoint pair, incremental on add/remove/`move()`);
  the curve-params column + VS quadratic-bezier eval for render and
  pick tile; arrows on end tangents; edge labels at the curve
  midpoint; conservative bound into cull/fit/`boundingBox`; exact
  lazy `.bb()`; `isBundledBezier`/`controlPoints`/
  `renderedControlPoints` accessors.
- **12b — unbundled-bezier + segments + taxi (+ round variants)**
  (landed 2026-07-30/31 — see the round 12b record):
  `control-point-distances`/`-weights`, `edge-distances`,
  `segment-distances`/`-weights`/`-radii`, `radius-type`,
  `round-segments` corner arcs, `taxi-direction`/`taxi-turn`/
  `taxi-turn-min-distance`, `round-taxi` radius; the param-blob
  storage for variable-length lists; `segmentPoints`.
- **12c — endpoints + the triage keeps**: `source/target-endpoint`
  (keyword/percent/coordinate forms),
  `source/target-distance-from-node`; `haystack` (+
  `haystack-radius`) as hash-stable intra-node endpoint offsets (the
  decimation trick's determinism, applied to endpoints);
  `straight-triangle`.  Mid-arrows (`mid-source`/`mid-target`,
  `arrow-scale`, `arrow-fill: hollow`, compound arrow shapes) stay in
  the arrow-parity needs-a-call batch — not pulled in here.

Perf: the renderer benchmark gains a curved variant of the pan
scenes (expected cost is ~K× edge vertex work, bounded by cull and
decimation; record the numbers in the round record).

**Open calls — both signed off 2026-07-30** (as the leans):

1. **v4's default `curve-style` is `straight`** — the perf-first
   default at v4's target scales; parity scenes and apps opt into
   `bezier` explicitly.  A deliberate divergence from v3's
   bundled-bezier default, recorded in `src/README.md`.
2. **`bezier` bundles multi-edges only, verbatim v3**: a lone edge
   between two nodes stays a straight line under `curve-style:
   bezier`; only parallel edges fan out (the odd-bundle middle edge
   is straight too, v3's rule).  Pixel-comparable in the live
   v3-parity harness.
