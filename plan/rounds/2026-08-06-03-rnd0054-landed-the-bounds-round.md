## The bounds round

Item 16's follow-up, promoted from logged to scheduled at the sixth
sitting.  The conservative whole-graph fit scan still over-frames the
compound fixture at ~1.8× its exact box after 43.13, and the residual is
the *formulation*, not the constant:

- The scan grows a **disc** of `p2 + nodeHalfMax` around each endpoint
  **centre**, where a compound loop's geometry is **directional** — its
  controls only ever go up and left of the union of the two node boxes —
  so a box-based, one-directional term is far tighter.
- `nodeHalfMax` is a **global** maximum: one big parent inflates the bound
  for every box-bounded edge in the graph.  The term should be per-edge.

Scope: the two CPU call sites only (`GraphStore.boundingBox`,
`Collection.boundingBoxAt`) — the cull kernel keeps its conservative terms
deliberately, exactly as 43.13 recorded (over-inclusion in a cull costs
efficiency, never correctness, and touching WGSL would put goldens and
parity scenes in scope for a pure efficiency gain).

Verification is 43.13's own method, promoted to the round's gate: the
randomized soundness sweep (hundreds of compound-loop edges over dozens of
randomly-shaped compound graphs, every conservative box must contain its
exact box), specs pinning the tightened box both directions with controls,
a `benchmark/spatial.mjs` row for the scan cost, and the compound fixture's
fit driven in the page — the standing rule that something has to open it.

### Landed (2026-08-08)

Both formulation fixes landed as planned, and the sweep earned its
promotion on its first run by catching a soundness hole the plan had not
predicted.

- [x] **54.1 The directional compound-loop box.**  A `CURVE_CMPD` edge
  now contributes the union of its two endpoints' *outer boxes*
  (`node.outerHalf`, per-edge) grown by the stored excursion bound `p2`
  **up and left only** — v3's construction hangs both controls off that
  union's top-left corner, one up and one left, and the curve lies in
  the hull of the controls and the boundary points on the node
  outlines, so right and down the edge contributes nothing beyond the
  nodes the node pass already scanned.  The full stored `p2` is kept
  rather than the tight `p2 / 2`: it is exactly the derivation-time
  bound whose 2× cushion the curve-index records as its staleness
  allowance, and `p2 / 2` would be zero-margin at freshness — one f32
  rounding from unsound.  Both call sites take the same form
  (`Collection.boundingBoxAt` at the hypothetical centres, with
  `outerWidth()/outerHeight()` per end).
- [x] **54.2 Per-edge margins for box-bounded routes — and taxi went
  exact instead.**  The plan said "make `nodeHalfMax` per-edge", and for
  the weight-extrapolated blob kinds that is what landed (the edge's own
  endpoints' outer halves, plus the chord — sound for weights in
  [-1, 2], the envelope the old form bounded too).  For taxi the sweep
  proved the plan's formulation **unsound on its first run**: a
  `downward` taxi whose target sits *above* the source is a
  forced-direction route that overshoots both endpoints by the turn,
  which no node-half margin bounds — the old global margin had covered
  it only when some unrelated big node happened to inflate it.
  Measured: 14.5 px under-contained on sweep graph 23.  The fix is not
  a cleverer margin (the Z/L fallbacks have their own excursions, and a
  hand-derived bound over evalTaxi's branches is exactly the kind of
  second implementation that drifts): the scan uses the **memoized
  exact curve bb** (`curveBBAt`, epoch-invalidated, already computed
  per curved edge by the box-selection path), so taxi is exact and pays
  once per geometry change.  `boundingBoxAt` gets the new
  `curveRouteAtPositions` — the same route evaluation at hypothetical
  centres — and hull-bounds the raw route points.
- [x] **54.3 `curveBoxMargin()` deleted.**  Its only callers were the
  two rewritten sites; the cull kernels never used it (they carry
  `frame.curveSlack`, whose global monotone maxima stay deliberately).
  The shipped declaration regenerated (45 type exports / 3 statics /
  1205 doc blocks).

**Measured, on the debug harness's compound fixture (930×900, the
43.13 viewport):** fit zoom **0.607 → 0.822**, conservative box
705×769 against an exact 555×618 — the residual per-axis over-frame is
now ~1.25×, which is the kept p2 cushion showing, down from ~1.8×.
The page was driven per the standing rule (screenshot checked: the
compound-loop arcs sit fully framed with modest up-left headroom, and
nothing clips).

**Verification.**  `test/modules/bounds-sweep.mjs`: 60 seeded
randomized compound graphs (sizes 10–250, padding 0–40, nesting,
step sizes 5–200, five taxi directions with px and % turns,
extrapolated weights in [-0.6, 1.8]) assert conservative ⊇ exact in
all four directions; a deterministic taxi spec pins the overshoot case
and that a 400 px node 2000 px away moves nothing; the rewritten
`compound-loop-edges.mjs` spec pins the directional box in both
directions (`x1 = -15 - p2` **and** `x2`/`y2` at the plain node edges,
where the disc used to hang `p2 + margin` past the centres).  Controls,
each run and each failing what it should: dropping the p2 extension
fails 4 specs, reverting taxi to a per-edge margin fails 2 (the sweep
itself and the taxi pin), and collapsing the union corner to the
source end alone fails the sweep.  Node tier green end to end (2078 +
283 + 24, throw gate 182/10/5/0, lint, format, types), full Playwright
green with goldens byte-stable and every parity scene at its recorded
value — no golden frames a fit over compound loops or taxi, which is
why none moved.  `benchmark/spatial.mjs` gains the round-54 group with
a fixture that asserts its own kinds (100 compound-loop + 99 taxi
edges over 100 parents): warm scan 86 µs (curve bbs memoized), cold
162 µs with a geometry write per call (N=2000 profile).

**Recorded limits.**  The extrapolated-weight chord bound is sound for
weights in [-1, 2] only — outside that envelope the old global form
under-contained too, so this is a pre-existing edge, now written down;
widening it means scaling the chord term by max(|w|, |1-w|), which no
graph has yet asked for.  And the sweep's own graphs stay inside that
envelope deliberately.
