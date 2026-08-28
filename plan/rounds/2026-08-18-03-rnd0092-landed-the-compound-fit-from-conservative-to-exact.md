## The compound fit, from conservative to exact

The maintainer: the compound fixture does not fit to screen
properly.  Reproduced on the page (930×900 viewport, the fixture's
own `cy.fit(undefined, 30)`), and the residual is round 54's own
recorded cushion, now judged on screen and found not modest:

1. **Measured today**: fit zoom 0.874 against an exact-box fit of
   1.077 (`Collection.boundingBox` reads 807.7×637.3 for the graph;
   (930−60)/807.7 = 1.077) — a **1.23× over-frame**, matching round
   54's recorded "~1.25×, the kept p2 cushion showing".
2. **The slack is asymmetric, so it also de-centers.**  54.1's
   directional compound-loop box grows **up and left only**; `fit`
   centers the conservative box, so the graph sits visibly
   down-right with dead space up-left — the screenshot shows it
   plainly.  An over-frame reads as "zoomed out a bit"; an
   off-center over-frame reads as "fit is broken", which is what was
   reported.
3. **The formulation already has its successor in the same
   function.**  54.2 moved taxi from a margin bound to the
   **memoized exact curve bb** (`curveBBAt`, epoch-invalidated,
   already computed per curved edge by the box-selection path) after
   the sweep proved the margin unsound.  The compound-loop and
   blob-bezier kinds still ride the conservative terms; extending
   the exact tier to them removes both the 1.23× and the asymmetry
   in one move, with no new bound to prove sound — exact ⊇ nothing.
4. The cull kernels keep their conservative terms deliberately
   (43.13/54's standing rule: over-inclusion in a cull costs
   efficiency, never correctness).  This round touches the two CPU
   scan sites only (`GraphStore.boundingBox`,
   `Collection.boundingBoxAt`), like 54 before it.

### 92.1 — exact curve bounds for the remaining conservative kinds

`CURVE_CMPD` and the weight-extrapolated blob kinds take the
`curveBBAt` route in both scan sites; the p2-cushion terms for those
kinds are deleted rather than tightened (54.3's precedent —
`curveBoxMargin()` died the same way).  The staleness question 54.1
raised (p2's 2× cushion as the memo's staleness allowance) must be
re-answered for the exact tier: `curveBBAt` is epoch-invalidated, so
freshness is structural, not margin-based — confirm the epoch covers
every input the compound-loop geometry reads (positions, outer
halves, the loop params), which is the round's one soundness task.

**The cost is the round's gate, measured not assumed.**  The scan's
headline property is the ndex fast path (235 → 15 ms when the
columnar scan landed).  `benchmark/spatial.mjs` already carries the
round-54 group (warm 86 µs / cold 162 µs on the 100-parent
fixture); this round re-measures warm and cold on that row, adds the
ndex-shaped case (curved share ~0: the cost must not move at all
where no edge is curved), and publishes per the `--repeat 3` rule.
If the cold scan regresses beyond the page's own noise band on a
realistic mix, the fallback is a hybrid: exact for the kinds that
misframe (compound loops are rare and expensive to over-bound),
conservative for the rest — recorded either way.

**Verified by** the 54 sweep re-run (conservative ⊇ exact holds
trivially once both sides are exact — the sweep then pins
exact-vs-flattened-route containment instead, both directions); the
compound fixture's fit driven on the page with the zoom asserted
near 1.077 (spec sets `headlessWidth/Height` to 930×900 — the
round-43.12 trap); and a centering assertion (left and right
margins within a few px of each other), which is the spec the
asymmetry defect was missing all along.  Control: reintroduce the
directional slack once — the centering spec must go red.

### Risks named at planning

- First-fit cost on a cold instance now derives curve geometry for
  every compound-loop/blob edge before the first frame; the memo
  amortizes it but the *first* `fit()` is startup-visible.  Measure
  on em-web-clustered (41 parents, real data) before and after.
- `boundingBoxAt` (hypothetical positions — `layoutPositions`' bounds
  source) takes the same change via `curveRouteAtPositions`; layouts
  call it in loops, so the layout benches watch it.
- The fixture's fit was *photographed* in round 54's record as
  acceptable; this round supersedes that judgement — update
  `src/README.md`'s bounds paragraph and the round-54 cross-refs in
  the same commit, per the docs-travel rule.

**Open:** whether the whole-graph store scan keeps *any*
conservative kind once compound loops go exact (recommended: yes —
haystack/straight stay pure-columnar; exactness is bought only where
the box was visibly wrong); whether `fit` should ever pad
asymmetrically to compensate residual slack (recommended: no — fix
the box, not the frame).


### Landed (2026-08-28)

92.1 landed as planned, plus one restructure the measurement forced.

- [x] **92.1 Exact curve bounds for the remaining conservative kinds.**
  Both CPU scan sites now route every `FLAG_CURVED_BOX` kind — compound
  loops, taxi, weight-extrapolated blobs — through the exact memoized
  curve bb: `GraphStore.boundingBox` generalizes round 54's taxi-only
  `curveBBAt` branch (the directional `p2` box and the per-edge
  outer-half + chord margin are deleted, 54.3's `curveBoxMargin`
  precedent), and `Collection.boundingBoxAt` calls the new
  `curveBBAtPositions` — `curveBBAt`'s sampling at hypothetical
  centres, unmemoized (no epoch covers a hypothetical), backed by the
  new `curveEvalAtPositions` (the `CurveEval` twin of 54.2's
  `curveRouteAtPositions`) so compound loops evaluate there too.
- [x] **The staleness question, re-answered structurally.**  Every
  input the compound-loop geometry reads writes through a
  `geoEpoch`-bumping path, checked setter by setter: positions
  (`setPosition`/`setPositions`/`setPositionsConst`/`shiftPositions`),
  sizes and borders — and therefore the derived `outerHalf` —
  including **materialized parent auto-bounds**
  (`materializeParentGeom` bumps after writing, and `curveBBAt` runs
  `flushDerived()` before consulting the memo, so a flush-time bump
  invalidates before anything is computed), shapes and curve params
  (`setScalar`/`setPair`/both curve-param sinks), and arrow trim
  (`setArrowShapes`/the arrow-scale writer).  Freshness is structural;
  no margin stands in for it.
- [x] **`curveBBAt` answers a fresh memo without evaluating.**  The
  eval ran *before* the memo check, so every warm read paid a full
  route/curve evaluation it then threw away — invisible while only
  taxi used the memo in the scan, and the first post-change benchmark
  run showed it (warm 82 → 97 µs).  The kind gate now reads the params
  column, the memo answers first, and the eval runs only on a stale
  slot.  Warm scan 82 → **20 µs** — 4× faster than round 54's own
  number, and the box-selection path shares the win.

**Measured, on the debug harness's compound fixture (930 × 900,
`cy.fit(undefined, 30)`, the 43.12 headless dimensions):** fit zoom
**0.874 → 1.077**, exactly the exact-box fit ((930−60)/807.7); the
scan box collapses onto the exact box (995.8 × 825.8 → 807.7 × 637.3);
margins go **194/30 → 30/30** left/right and **254/89 → 106.8/106.8**
top/bottom — the de-centering was the reported defect, and it is gone
to the pixel.

**The cost gate, measured not assumed** (`benchmark/spatial.mjs`,
N=2000 profile, the 100-parent round-54 fixture: 100 compound-loop +
99 taxi edges): warm 86 → **20 µs** (the memo-first restructure);
cold — a geometry write per call, which the wholesale epoch
invalidation turns into a full re-derive of every curved bb —
154 → **204 µs**, the price of sampling 100 compound loops exactly
instead of reading two columns, on a fixture built entirely of the
affected kinds.  The new **ndex-shaped control row** (same element
count, every edge straight) reads 34.3 µs before and 35.2 after —
noise; the fast path is untouched, as the flag gate predicts.
First fit on a cold instance: the generated compound-cluster fixture
(2000 nodes / 4000 edges, 80 compound loops + 161 leaf loops) p50
1.58 → 1.65 ms over 30 runs, inside its own min–max spread;
em-web-clustered (41 MCODE parents, real data) is **unaffected by
construction** — all 6,899 of its edges derive haystack, none
box-bounded (p50 1.51 → 1.39 ms, noise).  No hybrid fallback needed:
the regression is confined to the cold scan of the kinds that were
misframing, and it buys the exact fit.

**Verification.**  The 54 sweep re-ran and, as planned, its
containment half went trivial for the exact kinds — so it now pins
**exactness both directions** on every graph whose curved edges are
all box-bounded (39 of the 60 seeded graphs; a floor of 10 guards the
generator), with the chord-hull kinds (a random leaf self-loop, a
bundled-bezier pair) keeping containment-only.  The compound fixture's
fit is driven headlessly at 930 × 900 in
`test/modules/debug-harness.mjs`: zoom pinned to the exact-box fit
(and > 1, where 0.874 was measured), plus **the centering assertion
the asymmetry defect was missing all along** — the exact box's
rendered margins equal side to side within 3 px.
`test/compound-loop-edges.mjs`'s round-54 pin (`x1 = -15 - p2`)
became its inversion: the scan box equals the edge's exact bb and
sits strictly *inside* the old conservative corner, with right/down
still contributing nothing beyond the nodes.  Control, run once with
round 54's directional slack reintroduced in the scan: **four specs
go red** — the centering spec, the sweep's exactness half, the
sweep's own control, and the compound-loop pin — and were watched
failing before the slack came back out.  Node tier green end to end
(2260 node:test + modules/soak/throws, lint, format, types; the
throw gate's line-keyed `UNREACHABLE` entry for graph-store re-pointed
after the insertions above it), shipped declaration regenerated, and
the full Playwright suite green — no golden frames a fit over the
affected kinds, so none moved.

**Opens, decided as recommended.**  The whole-graph scan keeps its
conservative hull terms for the chord-bounded kinds (haystack and
straight stay pure-columnar; exactness was bought only where the box
was visibly wrong), and `fit` pads symmetrically as ever — the box
was fixed, not the frame.
