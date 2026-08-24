## Round 55 — edge routing and arrow parity, measured (2026-08-06)

Inserted ahead of round 38 at the maintainer's request, and for a reason
that makes it a prerequisite rather than a queue-jump: **38's verification
plan is per-tier live parity diffs, and this round is what makes such a
diff able to fail.**

### Where it came from

A maintainer opened `debug/?network=v3-default` and reported five things
as impressions — segment edges looking wrong, the taxi edge "breaking in
the middle", arrows "not on par", hollow arrows showing the line
underneath, filled arrows leaking a sliver of line past the triangle's
point, and semitransparent edges reading as two overlapping shapes rather
than one.  None of them were visible to any test in this repository, and
the reason is structural:

- The 44 goldens are **v4-vs-v4**.  They answer "did this change?", never
  "is this right?", and they had happily locked in every one of these
  defects.
- The 29 live v3-vs-v4 parity scenes do ask the right question, but at
  400x300 with `MAX_PARITY_RATIO = 0.02` they carry **2400 px of slack**.
  A missing arrow gap at `width: 3` is about 6 px of line per end —
  0.005% of the canvas, 400x under the bound.
- Worse, the curve parity scenes deliberately set `arrow-shape: none`,
  justified in a comment as "gap 0 is where v3 and v4 agree".  True, and
  precisely the configuration in which the defect cannot appear.
- **Twelve of the 29 parity scenes had no ink floor at all**, so
  blank-vs-blank would have passed.

### Decisions taken with the maintainer (2026-08-06)

1. **Hollow and translucent heads are fixed by trimming the line, not by
   porting v3's erase.**  v3 makes them read as one shape by erasing the
   arrow footprint from the canvas (`destination-out`).  But between the
   gap point and the head's back edge the line is always strictly *inside*
   the head — the triangle's half-width at distance `k` behind the tip is
   `k/2`, and v3's `gap = 2w` starts the line where the head is already
   wider than it — so trimming the line to the head's back extent produces
   the same visible pixels.  That deletes an entire pipeline, a second
   draw per end, ~0.1-0.2 s of first-frame shader compile, and a forced
   change to `cy.png`'s background compositing.

   Recorded deviations: v3's
   erase also punches through whatever is under the head (compound parent
   bodies, other edges) and this does not, and **mid arrows are not
   covered** — they sit mid-line where a trim cannot reach.  Logged as the
   round's follow-up.
2. **Carrier: widen `edge.width` to two components** and bitcast the
   existing `edge.arrowShapes` u32 into `.y`, deriving the trim in-shader.
   +4 B/edge (1.86 MB at the 465k-edge fixture), no new bind-group entry,
   no CPU per-edge work.  The two rejected carriers are logged here for
   the record, in case measurement ever says the vertex stage minds:
   **CPU-computed trims** in the same widened column (+8-12 B/edge, no
   vertex ALU) and **widening `edge.curveParams` 4 -> 8** (+16 B/edge,
   7.4 MB — the heaviest, but the one column already bound in all four
   relevant vertex stages, with room for mid-arrow windows).

   The arrow *shaders* need nothing at all: they already bind
   `edge.width` and `edge.arrowShapes`, so v3's `spacing` derives in
   place.
3. **Order: baselines -> harness -> mechanical fixes**, so every fix lands
   with a before/after number.
4. **Harness: browser tier for composition, Node twins for v3's leaf
   math.**  v3 computes routing only inside its renderer, and importing
   v3's entry from `test/` would make the Node tier depend on a v3
   install, which `ci-node` deliberately does not do.

### Phase 0 — the baselines (landed)

`benchmark/arrows.mjs` (new) and two renderer scenes.  Nothing priced
arrows before: `curves.mjs` measures an arrow-free graph and
`render-bench.mjs`'s eight scenes all drew `arrow-shape: none`, so the
arrow pipelines contributed to no published number.

Two corrections the suite needed before its numbers meant anything, both
general:

- **Measurement order biased every row by ~20%.**  Timing the arrowed
  side then the plain side read 1.21x on a node drag and 1.19x on build —
  operations that touch no arrow data.  Timing each side twice as
  **A B B A** and keeping the faster of each pair collapses both to
  1.00x.  `A B A B` would preserve the bias.
- **Rows sized by the graph rather than by the work** put the accessor
  rows under a millisecond, where the two sides differed by more than the
  thing being measured.  They now do a fixed 200k operations, on an
  edge-heavy graph (four edges per node pair) because a per-edge property
  cannot be seen past two thirds of the elements being nodes.

Baseline (i9-9900K, amd gcn-4, 20k nodes / 40k edges): every CPU row
reads 0.98-1.06x — the honest answer, since v4 does almost nothing with
arrows on the CPU, which *is* the defect.  Because a suite whose rows all
read 1.00x cannot show that it can move, it carries its own
discrimination control: the same accessor on a bezier edge, which already
resolves a real boundary point, reads **326 ns/edge against the straight
path's 260 (1.25x)** — so the rows do see endpoint work, and that is
roughly where they should land once the gap fix is in.

Device time, 25k x 50k, fit-all p50: **3.400 ms with no arrows, 3.550 ms
filled (+4.4%), 3.556 ms half-hollow**, against run-to-run noise of 0.2%.
Filled and hollow costing the same is itself worth recording: it is
exactly what a second `destination-out` pass would have changed.

### Phase 1a — one parity assertion, with the ink floor (landed)

There were three diff implementations: `expectParity` (8 scenes),
`runParity` (15) and four scenes that inline-copied the body.  **Only
`runParity`'s had an ink floor.**  All 29 now go through one
`expectParityImages`, which asserts the floor, prints the ink counts on
every run (so a scene drifting toward its floor is visible before it
crosses), and takes both the ratio bound and pixelmatch's threshold as
parameters — the two families genuinely differ, and the rotated-label
scene genuinely needs 0.3.

Proven behaviour-neutral the way round 42's restructure should have been:
**all 28 logged scenes' mismatch counts compared before and after,
byte-identical** (text-rotation reads 2.328% both sides; its old log line
simply had a different format).  Not "the suite is green".

One defect found while writing it, in the new code: spreading `opts`
*after* the default bound would let a caller without a `bound` key
overwrite it with `undefined`, which the helper then reads as its own
0.02 — silently tightening every curve scene by a third.

### Phase 1b — numeric routing parity (landed)

`playwright-tests/routing.spec.js` + `playwright-tests/lib/route-compare.mjs`,
`playwright-tests/lib/routing-scenes.mjs`, `playwright-tests/lib/routing-ledger.mjs`, and
`playwright-page/route-probe.js`.  Nine scenes, ~90 edges, ~440 compared
fields.  A pixel diff says "3% of the canvas"; this says "edge
`parent-parent` disagrees on `tgt.y` by 16.23 model px".

Three properties, each deliberate:

- **No adapter, no frames, no screenshots.**  Routing is model-space and
  both libraries resolve it on read, so the suite carries no `hasAdapter`
  skip and runs in ~11 s where the pixel half cannot run at all.
- **The probe is symmetric** — one function asks both libraries the same
  public question.  A per-side fixup is where a finding goes to die.
- **Non-finite is structural, never numeric.**  `NaN > tol` is `false`,
  so the obvious comparator passes a NaN silently.

**What it found on its first run** — and the headline is not what the
round expected:

| scene | result |
|---|---|
| `taxi` (8 edges, 4 orientations) | **0 diverged, 80 fields exact** |
| `segments`, `round-segments` | **0 diverged** |
| `loops` (3-loop stagger) | **0 diverged** |
| `bundles` | exact to 8.9e-15 — except the odd bundle's straight middle member |
| `families` | every curve family exact; only the two *straight* families diverge |
| `shapes` | ellipse and rectangle exact; the polygon tier measured |
| `compound` | **46 of 62 fields diverge** |
| `arrows` | 14 fields diverge, by v3's spacing formula exactly |

So **v4's curve routing is correct** — segments and taxi, the two the
maintainer suspected, match v3 to the last bit including the
axis-aligned degenerates.  Whatever is wrong on that page is downstream
of routing, in the strip or the arrows.  That is worth as much as a
defect: it removes a whole subsystem from the search.

The real findings:

1. **The straight-edge endpoint defect is everywhere.**  Every straight
   family diverges by exactly the node's boundary offset — v4's
   `sourceEndpoint()` answers the node *centre* where v3 answers the
   boundary.  It is a public-API defect independent of arrows, and
   `test/collection-dimensions.mjs` currently pins v4's answer as correct.
2. **The compound tier, with the controls clean.**  `sibling` and `cross`
   — the two arrangements that must route normally — match exactly, which
   is what makes the rest trustworthy.  Against that: `p-child`,
   `p-grandchild` and `child-p` diverge on **every field by exactly
   1.000000 model px**, and `parent-parent` (16.23) and `leaf-parent`
   (8.21) diverge by much more, clipping against a derived parent box.
   This is the maintainer's "edge routing is a bit buggy when compounds
   are involved", now localized to three arrangements and one constant.
3. **v3's arrow spacing, measured to four decimals.**  `tee` diverges by
   16 = radius 15 + v3's constant 1 px spacing; `circle` by 24.8804 =
   radius 15 + `getArrowWidth(5, 1.5) * 0.15` = 9.8804.  The harness
   reproduces v3's formula without being told it.

Two ledger mechanisms, both of which earned their place immediately:

- **Edge-level entries** (`<scene>/<edge>/*`) record the deliberate
  boundary-approximation tier as three readable entries instead of
  eighteen per-field ones, with a two-sided band — a deviation that
  *shrank* is a decision that changed, and the entry describing it is
  then wrong.
- **The staleness check caught the round's own first mistake.**  The
  initial ledger pinned the axis-aligned `round-taxi` NaN on `mid.x` /
  `mid.y`; on that configuration v4's midpoint is finite and only
  `boundingBox()` collapses.  The entries named fields that never
  diverged and were reported stale on the first run.  The defect now
  belongs to a separate finiteness spec, because a bounding box is not
  comparable between the libraries in the first place — a parity check
  would have called two broken values a match.

Five scenes carry `test.fail()` naming the fix that will flip them, so
the suite is green and honest rather than permanently red; a fix that
earns one removes it.  The `finite geometry: <scene>` specs are the
guard against a `test.fail()` swallowing a crash — they build the same
scenes, are never marked failing, and assert the record count.

### Phase 1c — Node twins for v3's leaf math (landed)

`test/curve-geometry.mjs` gains five twins against `v3/src/math.mjs`,
which imports nothing at runtime and so keeps `ci-node`'s
no-v3-install invariant intact.  Ellipses, circles and rectangles match
v3 **exactly (2e-13)**; round-rectangles and polygons carry measured
bands, so the tier that has been described in prose since it was written
finally has numbers: **2.247 model px** for a 40x24 round-rectangle at
its corner, **8.453** for a triangle.

The control: applying the *wrong* tier reads 6.45 px on the same fixture,
against 2e-13 for the exact rows — ten orders of magnitude, so those rows
discriminate.  And the browser scene independently measures 8.462 for the
same triangle at the end of a real edge, against the leaf's 8.453; two
tiers built from different code agreeing to a hundredth of a pixel is the
reason to trust either.

One bug found by the twins failing: v3 passes **half** extents to
`polygonIntersectLine` (it scales unit base points by them), so the
obvious call reads as a shape twice the size — a silent 2x rather than an
error.

### Phase 2, fix 2 — the zero-leg guard (landed)

`computeCorner` and its WGSL twin now return the no-arc corner when
either leg has zero length, instead of normalizing it.

**This is a deliberate divergence from v3**, and the only one in that
function.  v3's `asVec` (`v3/src/round.mts`) divides unguarded and
produces NaN for every field, and v3's own collinear short-circuit cannot
save it because that test runs *after* the normalize, where
`abs( NaN ) < 1e-6` is false.

Matching v3 was not an option because v4's
consequence was strictly worse: v3 keeps finite `allpts` and only loses
its `roundCorners`, while v4's NaN reached every strip vertex, the
bounding box and the hit test — `boundingBox()` answered
`{x1: null, y1: null, x2: null, y2: null}`, so the edge was invisible on
the GPU (a NaN clip position is dropped), unpickable, and poisoned any
bound that contained it.

The trigger is ordinary rather than exotic: an axis-aligned node pair
under `round-taxi` makes `evalTaxi` emit two coincident interior points
in *both* libraries — a faithful port — and a grid layout produces
axis-aligned pairs by construction.  Four edges of `debug/`'s
`v3-default` network are exactly this, which is what the maintainer saw
as "the taxi edge breaks in the middle".

Pinned in three places, deliberately: the `computeCorner` twin in
`test/curve-routes.mjs` (three coincidence cases, each asserting *v3 is
NaN here* first, so the spec pins a divergence rather than describing
agreement), public-behaviour specs in `test/curve-route-accessors.mjs`,
and the browser tier's `finite geometry` specs, whose allowlist the fix
emptied — which is what "a failing test the fix has to satisfy" means in
practice.

**Control, and a finding inside it.**  With the guard removed, six of the
new specs fail — but *only the bounding-box spec* of the three
public-behaviour ones does.  The midpoint and hit-test specs pass either
way, because a NaN corner does not reach the midpoint (which comes from
the route points, not the arcs) and `elementsInBox` answers from the
conservative store bound on this path.  They are kept as contract
breadth, with a comment saying they are not what makes the block
discriminate — a spec that reads like a guard but cannot fail is exactly
what this repo's notes keep warning about.

### The compound finding, corrected — and an open call

The first pass through this round's record said the compound tier showed
"a constant 1.0 px offset on ancestry edges".  True, but the attribution
that suggests itself is wrong, and `src/README.md` is what suggests it:
it records that "v4's parent boxes can sit sub-pixel smaller than v3's
when children have borders — v3's node bb includes the border's
miter-corner overshoot (~(√2−1)·border/2 per side on cornered shapes)".
Reading the divergence as that known deviation would have closed the
question.

It is not that.  Measured directly, with a parent holding two 30x30
ellipse children at x = 0 and x = 90 and padding 10:

| `border-width` | v3 parent width | v4 parent width | left edge, v3 vs v4 |
|---|---|---|---|
| default | 122.00 | 120.00 | −26.500 vs −25.500 |
| 0 | 122.00 | 120.00 | −26.000 vs −25.000 |
| 4 | 126.00 | 124.00 | −30.000 vs −29.000 |

**The gap is exactly 1.0 model px per side and does not move with the
border at all** — not at 0, where the recorded explanation cannot apply,
and not at 4, where it would have to scale.  The children are ellipses,
which have no miter corners to overshoot in the first place.  v4's box is
the children's union plus padding, exactly; v3's is that plus 1 px on
each side, for a reason that is not the border.

So the README's note is not wrong about the effect it describes, but it
is **incomplete as an explanation of parent-box differences**, and this
round's scene now pins `border-width: 0` on both sides precisely so that
explanation is removed from the picture and whatever remains cannot be
about borders.

Every ancestry-edge divergence (`p-child`, `p-grandchild`, `child-p`:
1.000000 on every field) follows from that 1 px, since v3's
`findCompoundLoopPoints` builds its control points from
`min(pos − outerW/2)` over the two endpoints.  The larger divergences —
`parent-parent` at 16.04 and `leaf-parent` at 8.07 — are **not yet
isolated**; they are consistent with the same box difference amplified
where an endpoint clips a box at a shallow angle, but that has not been
demonstrated and should not be recorded as though it had.

Direction matters here, which is why this is a call and not a fix.  Round
54 is already scheduled to *tighten* v4's compound bounds, and item 16
ratified the tighter compound `fit()` — so v4 being the tighter of the
two is very likely the intended behaviour and the right answer is to
record a deviation, not to inflate v4's box by a pixel to match v3.  But
that is the maintainer's call on public geometry, so it is logged rather
than taken; see the ledger entry below.

### Phase 1d — the arrow pixel scenes (landed)

Three scenes, all doing the opposite of what every existing curve parity
scene does: arrows and translucency deliberately included.  Measured
2026-08-06, with each scene's control run and recorded:

| scene | mismatch | control | drop |
|---|---|---|---|
| `parity-arrow-hollow` | **11.775%** | filled heads: 0.563% | 21x |
| `parity-arrow-alpha` | **26.707%** | `line-opacity: 1`: 0.777% | 34x |
| `parity-arrow-gap` (the tip spill) | **3.537%** | no heads: 0.333% | 10.6x |

`parity-arrow-alpha` is now the largest divergence anywhere in the parity
suite, and `parity-arrow-hollow` carries the round's clearest single
number: **v4 inks 36380 px where v3 inks 17484**, more than double,
because the line is visible through every hollow head.

**The gap scene had to be rebuilt, and why is the useful part.**  The
first version reasoned that width 20 at `arrow-scale: 3` puts v3's gap at
120 model px against a 300 px chord, so the two renderers would disagree
about most of the edge.  It read **0.495% and passed**.  An opaque filled
head *covers its own overlap*: v3's line stops 120 px behind the tip and
v4's runs on to the node centre, but the head spans 137 px back and is
opaque, so both renderers paint the same pixels over nearly all of the
difference.

What survives is only the wedge near the tip where the head
is narrower than the line — the head's half-width grows as `k/2`, so the
line pokes out sideways for roughly the first `width` px, contributing
about `width²/2` per end.  That wedge *is* what the maintainer described
as "a bit of the line peeking out by the triangle point".

So the scene is tuned the opposite way from the first draft — a thick
line and a *small* head, over eight ends rather than four, since the
count of ends is what accumulates.  And the general lesson is worth
keeping: **v3's gap exists mostly so that hollow and translucent heads
work**, not to hide a filled head's overlap, which is why the two scenes
that read 11.8% and 26.7% are the ones that matter and this one is a
supporting detail.

All three carry `test.fail()` naming fix 3, so they are green-and-honest
until the fix earns their removal.

### Phase 2, fix 3 — the arrow gap: designed and measured, NOT landed

This is the round's honest shortfall, recorded rather than glossed.

**What landed**: the data, verified against v3's own functions rather
than read off its source.  `src/shape-points.mts` gains `ARROW_GAP_K`,
`ARROW_GAP_K_DEFAULT`, `ARROW_GAP_CONST`, `ARROW_SPACING_CONST` and a
per-shape `ARROW_BACK` (the existing `ARROW_MAX_BACK` is a single max
over all shapes, which is right for sizing the arrow quad and wrong for
deciding where a line stops).  v3's `registerArrowShapes` only touches
`this.arrowShapes` and `this.arrowShapeWidth`, so calling it on a bare
object with a `getArrowWidth` stub yields the real table; every constant
was read from it at `width: 5, arrow-scale: 1.5`, and the numbers are in
the table's doc comment.

`circle`'s spacing of 9.8804 has two
independent confirmations — that probe, and the routing harness measuring
v3's rendered endpoint from the other direction.

**What did not land**: the plumbing.  The chosen carrier — widen
`edge.width` from one component to two and bitcast the existing
`edge.arrowShapes` u32 into `.y`, so the edge vertex shaders can derive
the trim from data they already bind — is correct and still the
recommendation, but its blast radius is wider than the plan's estimate.
Widening that column reaches:

- every `[ slot ]` index into it becoming `[ slot * 2 ]` — `collection.mts`
  (2 sites), `style.mts` (4), `animation.mts` (2);
- the **tween machinery**, since `'width'` is a `kind: 'scalar'` channel
  on `edge.width` and `captureEdgeWidthRides` reads the column directly;
- the **cull kernel**, which is handed `edge.width`'s buffer in
  `renderer.mts`;
- four render pipelines' WGSL, where `widths[slot]` becomes
  `widths[slot].x`.

That is the `endpoints[ at / 2 ]` stride hazard the plan flagged, spread
over five subsystems, and it is the kind of change that renders plausibly
when it is wrong.  Starting it without room to verify it properly would
have been the worse call.

**What the next round starts from**, which is more than this round
started with: three failing pixel scenes with measured controls, a
numeric harness that will show the gap as exact per-shape magnitudes the
moment the trim exists, the constants verified, and a baseline
(`benchmark/arrows.mjs` plus two renderer scenes) to measure the change
against.  The design note stands as written above — including the
decision that **trimming to the head's back extent replaces v3's
`destination-out` erase**, which is what keeps this a geometry change
rather than a new render pass.

One correction to the plan's own estimate, worth carrying forward: the
plan said the arrow shaders "need nothing at all" because they already
bind `edge.width` and `edge.arrowShapes`.  True for `spacing`, and
`spacing` is only non-zero for `tee` (1 model px) — v4's `circle` and
`circle-triangle` SDFs already bake their offset in.  So the arrow-side
half of this fix is genuinely one constant; all the difficulty is on the
line side.

### Fix 2, verified on the page — and two corrections to its own record

The standing rule is that something has to open the page, so the debug
harness was driven before and after with a scripted browser, at the exact
network the maintainer reported (`debug/?network=v3-default`).  The
before/after is unambiguous:

- **before**: one edge — `gh`, `round-taxi`, between `g` and a child of
  the compound parent — answered
  `boundingBox() = {x1: null, y1: null, x2: null, y2: null}`;
- **after**: zero of the 23 edges answer a non-finite box.

Two corrections to what this round first wrote about that defect, both
found by checking rather than by reasoning:

1. **The consequence is worse than recorded.**  The first write-up said
   the edge was unpickable and "poisoned any bound that contained it".
   Measured: `cy.elements().boundingBox()` — the *whole graph's* bound —
   also came back all-null.  `cy.fit()` reads that, so **a single
   degenerate edge broke framing for the entire graph**.  A spec now pins
   the graph bound as well as the edge's.
2. **One claim was overstated and is withdrawn.**  The record said the
   edge was "invisible on the GPU (a NaN clip position is dropped)".
   That was inferred, not observed: the before/after screenshots of the
   page show the edge drawn in both.  The NaN reaches the corner arc, and
   the strip evidently still renders something.  What is *demonstrated*
   is the public geometry — the edge's box and the graph's — so that is
   what the record should claim.

The second correction is the more useful one to carry forward.  Both
statements were plausible, both came from the same reading of the code,
and only one survived being looked at.

### Fix 1 — the straight-edge endpoint, landed (2026-08-06)

The call went to the maintainer as ledger item 20 and came back "match
v3", so `_endpointPoint` now resolves the node boundary along the chord
for a straight edge instead of falling through to the node centre.  The
resolve itself lives in `GraphStore.straightEndpointAt`, beside
`curveEvalAt` and the other column readers, because it is the **CPU twin
of the straight arrow shader's own tip placement** — which is the
property that makes it right: the accessor reports the point the
renderer draws to.

One v3 term is deliberately left out.  v3 also subtracts the arrow
shape's `spacing`, non-zero only for `tee` (a constant 1 px) and the
circle heads; that arrives with the gap/trim port, where the *shader*
gets it too.  Adding it now would have made the accessor describe a
point v4 does not draw — trading one wrong answer for a subtler one.

What it did to the harness, which is the useful record:

| scene | before | after |
|---|---|---|
| `base` | 4 diverged | clean, `test.fail()` removed |
| `families` | 8 diverged (both straight families) | clean, marker removed |
| `bundles` | 2 diverged (the odd bundle's straight middle member) | clean, marker removed |
| `arrows` | 14 diverged | **4**, and exactly v3's spacing term |

The `arrows` residual is worth quoting because it is the fix's own
receipt: `circle` by 9.880383 — `getArrowWidth( 5, 1.5 ) x 0.15` to six
decimals — and `tee` by 1.000000, with the other five heads clean.  The
harness reproduces v3's spacing formula without being told it, twice
now.

**A third correction to this round's predictions.**  The plan expected
the Playwright probe at `renderer.spec.js:4516-4546` to fail and it did
not: that spec exercises a *manual* endpoint (12c), which resolves
through the route path rather than the straight fall-through this
touched.  Only `test/collection-dimensions.mjs` needed rewriting, and its
new expectations are hand-derived rather than pasted from the output —
the boundary of a 40x20 ellipse along the (2, 1) chord is `10*sqrt(2)`
across and `5*sqrt(2)` down.

That makes three predictions in one round that measurement corrected: the
arrow-gap scene that measured nothing, the "invisible on the GPU" claim,
and this one.  All three were plausible readings of the code.  None
survived being run.
