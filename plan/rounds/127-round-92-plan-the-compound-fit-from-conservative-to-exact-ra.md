## Round 92 plan — the compound fit, from conservative to exact (raised by the maintainer 2026-08-18)

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

