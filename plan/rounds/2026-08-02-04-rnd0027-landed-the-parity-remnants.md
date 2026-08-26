## The parity remnants

The tail the README's follow-up hooks have carried since round 13:
compound arrow shapes, per-element numeric `text-rotation`, the
unported shape keywords, `border-style`/`outline-style`, and v3's
nonlinear arrow-size formula.  These are the last *visual* parity
gaps against v3 — everything else in the ledger is either landed,
dropped by decided design, or an open design call.  No new API is
invented here: every item is a v3 property or keyword whose
direction was set when its family landed.

**Code investigation (2026-08-02, precedes this plan):**

- **`edge.arrowShapes` is a full u32.**  Source shape at bits 0..7,
  target at 8..15, the two hollow flags at 16/17, mid-source at
  **18..20** and mid-target at **21..23** — three bits each, which
  ids 0..7 fill exactly — and the ×16 arrow scale in the top byte.
  Any new arrow id silently truncates for mid arrows.  But v3's
  whole arrow vocabulary is 12 shapes, so **four bits each is
  enough for all of them**: repacking to four 4-bit ids (0..15),
  the flags at 16/17 and the scale in the top byte fits in the same
  word with six bits spare and costs no extra memory.
- **The node shape field has room to spare.**  `borderGeom.y` packs
  borderPosition in bits 0..7 and the shape id in bits **16..19**
  — four bits, 15 of 16 ids used.  Bits 8..15 and 20..31 are free,
  so widening the shape field to a full byte (16..23) is a
  mask-and-shift change at five shader sites plus the pack site,
  and leaves room far beyond this round's twelve keywords.
- **Three of the twelve shape keywords are plain polygons** in v3
  (`right-rhomboid`, `concave-hexagon`, `cut-rectangle`): point
  tables that the existing SDF codegen, CPU pick and depth prepass
  pick up for free.  The seven `round-*` keywords are not — v3
  builds explicit per-corner arc geometry, and the naive
  "offset the polygon SDF by r" fails under anisotropic scaling,
  which is exactly why the README recorded them as deferred.
  `barrel` and the `triangle-backcurve` arrow both need a
  **quadratic-bezier SDF** — one primitive, two consumers.
- **`border-style` needs a perimeter parameter the node FS does not
  have.**  The edge shader dashes for free because it carries `u`
  (model px along the edge) as a varying; `nodeSD` returns a bare
  signed distance and discards the nearest-feature information a
  perimeter coordinate would be built from.  Closed form exists for
  circles and rectangles; polygons need the SDF loop to also track
  the argmin edge and its clamped projection.
- **`text-rotation` is one bit, not a value.**  The label sidecar
  stores `rotate: boolean`, packed as bit 31 of the glyph's owner
  word, and the angle is derived *live on the GPU* from the edge
  endpoints.  A numeric value needs a per-glyph `f32`, and
  `GLYPH_WORDS` is 14 with every word used.

**Design calls (round 27):**

1. **Repack before adding, both times.**  27.1 lands the two
   packing changes on their own, with no new keywords, so the
   existing suites and goldens prove the repack is a no-op.  Adding
   ids first would silently truncate — both packings are *lossy*,
   not loud, which is the argument for doing this as its own pass.
   The arrow word keeps its single-u32 footprint (four 4-bit ids);
   the shape field widens to a byte.  Recorded cap: 16 arrow
   shapes, which is v3's vocabulary plus four.
2. **v3's arrow-size formula, in model space.**  v4 sizes arrows
   `widthPx * 3 + 2` in *device* px off the LOD-floored width; v3
   uses `max( pow( width * 13.37, 0.9 ), 29 ) * scale` in *model*
   units.  Port the formula and evaluate it in model px before
   scaling by zoom, because v3's 29-unit floor is a model-space
   floor — evaluating it on the floored device width would make
   far-zoom arrows grow instead of shrink.  The quad extents and
   the store's `arrowScaleMax` slack meter must grow with it or
   arrows clip.
3. **Round corners get a real per-corner arc SDF**, not an offset
   hack.  Generated in the codegen beside the polygon tables, with
   the matching branch in `cpu-pick.insideShape`, so the two
   consumers agree by construction as they already do for
   polygons.  This is what unblocks all seven `round-*` keywords
   plus `bottom-round-rectangle` at one line each.
4. **One quadratic-bezier SDF, two consumers** — `barrel`'s four
   corner regions and the `triangle-backcurve` arrow.  Built once
   in 27.5 and consumed by 27.6, which is why the arrow pass comes
   after the shape pass rather than with the other arrows.
5. **Compound arrows are SDF unions**, `min( sdA, sdB )`, since
   coverage is a smoothstep over the distance.  Recorded
   deviation: `arrow-fill: hollow` on a compound shape falls back
   to filled — the stroke `abs( sd )` is wrong at the seam between
   the two parts, and v3 does not stroke compounds either.
   `triangle-cross` shifts with the edge width, which the FS
   already has as a varying, so its points are computed per
   fragment rather than read from a static table.
6. **Numeric `text-rotation` costs a glyph word.**  `GLYPH_WORDS`
   goes 14 → 16 (15 would break the 8-byte struct alignment) and
   the angle rides as an `f32`.  Node labels gain a rotation path
   they have never had, which forces two twins to follow: the
   glyph cull's rotated-rect AABB must read the stored angle
   instead of reconstructing the autorotate frame, and
   `cpu-pick.mts` must gain an OBB test — it currently *asserts*
   that node labels never rotate.  Recorded: node `boundingBox`
   label terms stay axis-aligned-conservative rather than exact.
7. **`border-style` gets the exact perimeter parameter, gated.**
   `u` is computed only in the dashed/dotted branch, so a solid
   border — the overwhelming default — pays a branch, not the
   extra work.  Closed form for circle/ellipse (angle-parameterized
   on the ellipse, whose arc length is elliptic; recorded as a
   deviation for eccentric ellipses) and rectangles; the polygon
   loop tracks the argmin edge and clamped projection against a
   per-fragment cumulative perimeter.  `double` is not a dash at
   all — a second inner band, no parameterization needed.
   `outline-style` reuses the same `u` at the ring radius, whose
   perimeter is offset and therefore a different length.
8. **Goldens are the proof.**  Every new keyword joins the existing
   per-shape golden grid, and each family gets a live v3 parity
   diff where v3 renders it correctly.

**Pass split** (tests-first; docs in-commit; each pass its own
commit(s)):

- [x] **27.1 The two repacks** (2026-08-02) — landed as planned.
  `edge.arrowShapes` now carries four 4-bit ids (source, target,
  mid-source, mid-target), the two hollow flags at 16/17 and the
  ×16 scale in the top byte, with six bits spare — the same single
  u32, so no column grew.  The layout lives in `contract.mts`
  behind `packArrowShapes`/`unpackArrowShape` and named shift
  constants, which the two arrow shaders **interpolate into their
  WGSL** rather than restating: one source of truth for a packing
  that four readers share.

  `packArrowShapes` throws on an id that
  does not fit, so the next person to add an arrow gets an error
  instead of the silent mid-arrow truncation this pass existed to
  remove.  The node shape field widened from a nibble to a byte
  (`SHAPE_SHIFT`/`SHAPE_MASK`, five shader sites plus the pack
  site), and `setBorderGeom` throws past the field width too; its
  hardcoded `shapeId === 14` became `SHAPE_POLYGON_CUSTOM`.

  Tests-first: the three existing specs that pin the bit layout
  were rewritten to the new one (red), then the code moved (green),
  and `test/packing.mjs` adds 8 specs — every id round-trips in
  all four arrow positions, the positions stay independent, the
  flags and scale byte stay clear of the ids, over-wide ids throw,
  a real mid-arrow restyle survives, and the shape field's margin
  over the enum is asserted rather than assumed.
  The pass changes no pixels, and that is the point: 2293 Node
  tests, 63 module tests, typecheck, lint, 87/87 webgpu and
  **68/68 visual with the goldens untouched**.

  *Correction, made while landing 27.2*: that browser verification
  was first run against a **stale bundle** and re-run afterwards
  before it meant anything.  `playwright.config.js` sets
  `reuseExistingServer: !CI`, so with an `http-server` already
  listening on 3333 Playwright attaches to it and the
  `test:playwright:build` half of `test:playwright:setup` never
  runs — the suite exercises whatever was built last, and a green
  run proves nothing about the change under test.  Re-run against a
  freshly built bundle (with 27.2 in as well), the 68 pre-existing
  goldens are still byte-identical, so the repack *is* the visual
  no-op claimed — but the first run had not shown it.

  The trap is
  now recorded in `AGENTS.md`'s testing notes, since its only
  symptom is a pass you did not earn.
- [x] **27.2 The three unported shape keywords** (2026-08-02) —
  landed, with the plan's own framing corrected: only **two** of
  the three are plain polygons.

  `right-rhomboid` and
  `concave-hexagon` are v3 point tables, so they are entries in
  `POLYGON_POINTS` and nothing else — the SDF codegen, the CPU
  pick and the depth prepass pick them up with no per-shape code,
  which is the payoff of the round-10 table design.
  `cut-rectangle` is **not** a unit polygon: v3 chamfers by an
  *absolute* length (`getCutRectangleCornerLength()` = 8 model px,
  or the element's `corner-radius`), so a unit table would make the
  chamfer scale with the node, which is exactly what v3 does not
  do.  It gets its own SDF — the box intersected with the diagonal
  half-plane `|x| + |y| <= hw + hh - c`, whose max of two exact
  convex fields is itself exact — plus a matching `cpu-pick`
  branch.  Its `'auto'` resolves to a flat 8 px where
  round-rectangle's is `min(w/4, h/4, 8)`: **one prop, two
  defaults**, as in v3, so the shader gained `cornerLengthPx` over
  `cornerRadiusPx` and every one of the five call sites now passes
  the shape.  Tests-first: 11 Node specs (red then green) covering
  compile/store/readback per keyword, both v3 point tables
  verbatim, the fact that `cut-rectangle` is deliberately absent
  from `POLYGON_POINTS`, the explicit-radius path, and that an
  unported keyword still throws.

  A `shapes-27` golden shows all
  three, with `cut-rectangle` at three sizes under `'auto'` — the
  24px node is what makes the golden discriminate between the two
  auto rules, since at 60px they coincide at 8.
  2304 Node tests, 63 module tests, typecheck, lint, 87/87 webgpu
  and 69/69 visual (68 unchanged goldens + the new one),
  all against a freshly built bundle.
- [x] **27.3 v3's nonlinear arrow-size formula** (2026-08-02) —
  landed.

  v4 sized arrows `widthPx * 3 + 2` off the LOD-floored
  *device* width; v3 uses
  `max( pow( width * 13.37, 0.9 ), 29 ) * scale` in *model* units.
  The formula now lives in `arrowSizePx` in both arrow shaders and
  is evaluated in model space before the zoom scale, because v3's
  29-unit floor is a model floor — applying it to a floored device
  width would make arrows *grow* as you zoom out.
  Two things had to be got right that the plan did not anticipate:
  the exact arrow scale lives in the packed shapes word, which is a
  **fragment-visible** binding, so a first attempt that read it in
  the vertex stage produced pipeline-validation errors on every
  arrow pipeline; the varying now carries the model width and the
  fragment stage resolves the size (which is also what 27.6's
  edge-width-dependent `triangle-cross` will need).  And v3's
  `size` is the **point-table scale, not the drawn length** — its
  transform scales the ±0.15 / −0.3 table by `size` directly, so
  the arrow is 0.3 × size long.  v4's old code folded that 0.3 into
  its own constant, and porting the formula without unfolding it
  made arrows 3.3× too long.
  **The parity diff is what caught both.**  A new live v3-vs-v4
  arrow-sizing test renders three edge widths spanning the
  formula's floor (1 and 2, where the 29 floor dominates; 6, where
  the pow term has taken over).  The measured arrow extents now
  match v3's **exactly** in all three regimes, and the whole-scene
  mismatch went 4.459% → **0.013%** (16 px of pure anti-aliasing).
  Recorded: the 0.5% golden tolerance was loose enough that the
  arrow goldens *passed* both before and after the change, so the
  goldens alone would never have caught the old deviation — the
  parity diff is the load-bearing check for anything claiming to
  match v3.  Eight arrow-scene goldens regenerated (the intended
  visual change); eight label-only goldens that also drifted were
  **reverted**, since their scenes contain no arrows and the drift
  predates this pass — a sub-tolerance glyph-AA wobble worth
  noticing but not this pass's to absorb.
  2304 Node tests, 63 module tests, typecheck, lint, 87/87 renderer,
  70/70 visual.
- [x] **27.4 The round-corner SDF** (2026-08-02) — landed, and
  with a better primitive than the plan called for.  The plan
  proposed porting v3's per-corner arc construction; the identity
  that makes it unnecessary is that **a polygon with every corner
  replaced by a tangent arc of radius r is exactly the Minkowski
  sum of the inward-offset polygon with a disc of radius r**.

  So
  the field is `sdPolygon( offset ) - r`, with the offset vertices
  in the standard miter form
  `o = v + r · (n1 + n2) / (1 + n1·n2)` — and that is exact under
  anisotropic scaling, which is the precise reason round 13
  deferred the family ("corner-rounding an anisotropically scaled
  polygon has no clean closed form" — the README's recorded
  deviation, now closed).  Winding is folded in at codegen from the
  signed area, so the shader does no orientation test, and the
  seven keywords reuse their sharp counterparts' point tables
  exactly as v3 registers them (`ROUND_POLYGON_SOURCE`), so the
  family costs one shared generated SDF rather than seven tables.

  `bottom-round-rectangle` rides the round-rectangle field with the
  radius selected by the sign of `p.y`.  `cpu-pick` gained the
  matching `insideRoundPolygon` — note it is *not* affine-invariant
  the way the sharp polygons are, so unlike them it must test in
  device space.  The round family's `'auto'` is v3's
  `getRoundPolygonRadius` = `min(w/10, h/10, 8)`: a **third**
  meaning for `corner-radius`, after round-rectangle's
  `min(w/4, h/4, 8)` and cut-rectangle's flat 8 — all three are
  v3's, not v4 inventions.
  **The parity diff is the proof**: a live v3-vs-v4 scene of all
  seven keywords plus a deliberately stretched node differs by
  **58 px (0.048%)**, pure arc anti-aliasing.

  A control run with
  v4 drawing the *sharp* shapes against v3's round ones was checked
  first, to confirm the test discriminates at all, and the scene
  uses a generous 14px radius for the same reason — at v3's 'auto'
  the rounded and sharp outlines differ by only ~180px, which would
  have made a clean result far less meaningful.  A
  `shapes-27-round` golden covers the family plus the anisotropic
  case.  17 Node specs; 2311 Node tests, 63 module tests,
  typecheck, lint, 87/87 renderer, 72/72 visual.
- [x] **27.5 `barrel`** (2026-08-02) — landed, and the plan's
  premise turned out to be wrong in a useful way.  It called for an
  exact quadratic-bezier SDF (a cubic solve) shared with
  `triangle-backcurve`.  But **v3 itself approximates**: its barrel
  hit test samples each corner's curve at t = 0.15/0.5/0.85 and runs
  a polygon test.  So v4 rebuilds the outline per fragment — four
  bezier corners sampled into `BARREL_CURVE_SEGMENTS` = 4 segments,
  the same fidelity v3's own hit test uses — and runs the standard
  exact-polygon distance loop over the result.  Sign and distance
  are exact *for that outline*; the only approximation is the
  outline itself.

  Barrel's offsets are size-relative until they hit v3's absolute
  caps (height 15, width 100), so like `cut-rectangle` it is a
  parameterized shape rather than a unit table, and `nodeSD` gained
  a `zoomDpr` argument to resolve them.  `cpu-pick` gained
  `insideBarrel`, built from the same constants.
  **Whether the sampling is good enough was measured, not
  asserted**: v3 draws the real `quadraticCurveTo`, so the parity
  diff is the answer — four sizes spanning the capped and uncapped
  regimes differ by **14 px (0.012%)**.

  At v3's corner offsets the
  sampled and exact curves are indistinguishable, so the exact
  bezier SDF was not built.  27.6 will decide `triangle-backcurve`
  on its own evidence rather than inheriting the assumption.
  **This completes v3's node-shape vocabulary.**  A pre-existing
  spec that used `'barrel'` as its example of an unsupported
  keyword had to be changed to name something that is not a shape
  at all — there is no unported v3 node shape left.
- [x] **27.6 Compound arrow shapes** (2026-08-02) — landed, built
  three different ways.  `triangle-tee` is a union of two generated
  polygons (`min( sdA, sdB )` — coverage is a smoothstep over the
  distance, so a union needs no stitching); `circle-triangle` is a
  polygon plus an analytic disc; `triangle-cross`'s bar tracks the
  **edge width** rather than the arrow size, so it is computed per
  fragment from the model-width varying 27.3 introduced — the
  reason that varying carries the width instead of the finished
  size.

  And `triangle-backcurve` needed **no new machinery at
  all**: 27.5 established that sampling a quadratic at codegen is
  indistinguishable from solving it, so its curve is baked into an
  ordinary point table and it rides the existing generator.  The
  exact bezier SDF the plan reserved for it was never needed.
  **Two real bugs surfaced from the parity diff, not from the
  suites.**  The first measurement came back at 0.141% — passing,
  but an order of magnitude worse than 27.4's and 27.5's, which is
  what prompted a per-head breakdown rather than acceptance.

  (a) The arrow quad's extent was hardcoded to the plain triangle's
  0.3 reach, so `triangle-tee` (0.5) and `circle-triangle` (0.6)
  drew **clipped**.  `ARROW_MAX_BACK` is now *computed* from the
  tables, so adding a head cannot silently clip it again, and
  `triangle-cross`'s bar adds the edge width on top.  (b) v3 pulls
  `circle-triangle` back by its circle radius (the shape's
  `spacing` — the only head v3 offsets at all) so the *disc* meets
  the node boundary rather than the disc's centre; that shift is
  baked into the points and the disc centre, so it costs no runtime
  logic.  After both: **44 px (0.037%)**, in line with the round's
  other heads.

  Recorded deviation: `arrow-fill: hollow` on a compound head falls
  back to filled — the stroke `abs( sd )` is wrong at the seam
  where a union's parts meet, and v3 does not stroke compounds
  either.
  **This completes v3's arrow vocabulary**, and as with 27.5's
  shapes a pre-existing spec had to stop using a real keyword
  (`'triangle-backcurve'`) as its example of an unsupported one.
  2315 Node tests, 63 module tests, typecheck, lint, 87/87 renderer,
  74/74 visual.
- [x] **27.7 Numeric `text-rotation`** (2026-08-02) — landed.
  Rotation was one bit — `autorotate`, edge labels only, the angle
  derived live on-GPU from the edge's slope.  v3 also takes a plain
  number of radians, on any label.
  **The encoding is the interesting call.**  The stored value is the
  angle in radians with **`NaN` meaning autorotate**.  That works
  because `'none'` and a rotation of 0 radians are the *same
  rendering*, so collapsing them costs nothing — and it leaves the
  whole real line free for numeric values, where an enum id would
  have collided outright: autorotate's id was `1`, and 1 radian is
  a perfectly ordinary rotation (pinned by a spec).

  `GLYPH_WORDS` went 14 → 16.  15 would hold the data but breaks the
  struct's 8-byte alignment, and the alternative — a per-owner
  storage buffer — was rejected because the edge label pipeline is
  already at 7 storage buffers against a base limit of 8.  Recorded
  cost: 64 bytes per glyph instead of 56, ~14% on the heaviest
  stream.
  Node labels gained a rotation path they never had (the VS now
  takes one branch for both modes), the glyph cull computes the
  exact rotated-rect AABB from the stored angle on both the node
  and edge streams, and `cpu-pick` gained an **OBB** test — it
  previously asserted in a comment that node labels never rotate,
  which stopped being true here.  `autorotate` stays edge-only and
  now says so in its error message.
  **The parity test had to be rebuilt to mean anything.**  The first
  version — four modest labels at small angles — passed at 0.514%,
  and then passed at 0.672% with v4 **ignoring rotation entirely**.
  A test that cannot fail is not evidence.  The scene is now
  ink-dominated (40px text, ±90°/±45°): 2.3% with rotation honoured
  against **5.8% for the same control, which fails the bound**.
  The floor is glyph rasterization, not placement — canvas vs SDF —
  which is why this one bound is 3% where the shape diffs sit near
  0.05%.  13 Node specs; 2328 Node tests, 63 module tests,
  typecheck, lint, 87/87 renderer, 75/75 visual.
- [ ] **27.8 `border-style` / `outline-style`** — **stopped for a
  scope call** (2026-08-02), not for a technical blocker.
  The technique is settled.  `double` is not a dash at all — a
  second inner band, no parameterization needed, and it works on
  every shape.  For `dashed`/`dotted` the existing `dashInsideSd`
  machinery is reusable verbatim; the only missing ingredient is a
  **perimeter coordinate** in the node fragment shader, which comes
  in three tiers of cost:
  - *closed form, cheap*: circle (exact — `θ·r`), rectangle and
    round-rectangle (walk the sides plus corner arcs, ~30 lines);
  - *closed form, approximate*: ellipse, whose arc length is an
    elliptic integral — angle-parameterizing it makes dashes
    unevenly spaced on eccentric ellipses, a recordable deviation;
  - *real work*: the polygon family (the round-* shapes, `barrel`
    and the custom `polygon` included), where the SDF loop must also
    track the argmin edge and its clamped projection against a
    per-fragment cumulative perimeter — roughly doubling the polygon
    fragment cost wherever a dash is enabled.
  The 2026-07-28 gap ledger flagged this family as **"needs a scope
  call on which subset earns its shader/channel cost"**, and that
  call is still open: shipping `dashed`/`dotted` on
  circle/rect/round-rect only is a genuine v3 deviation (v3 dashes
  any shape), while covering every shape is the round's largest
  single piece of shader work for a property with no other consumer.
  Deciding that unilaterally would be improvising API scope, so it
  waits.  Everything else in round 27 landed.
- [x] **27.9 Verification** (2026-08-02) — the golden grids and
  parity diffs landed with their own passes rather than in a
  trailing sweep, which is why each was able to *change the code*:
  27.3's diff caught two wrong ports of v3's arrow formula, 27.6's
  caught a clipped arrow quad and a missing offset, and 27.7's first
  version was rebuilt after a control showed it passed with the
  feature disabled.  Five new live parity tests in total (arrow
  sizing, the round family, barrel, compound arrowheads, text
  rotation), two new goldens, and three golden grids extended.

  Costs: `benchmark/labels.mjs` re-run at 100k — breakLines
  3.8 µs, estimateBlock 4.6 µs, setLabel build 5.1 µs, the
  whole-graph bb's label terms 0.11 µs — all matching the round-16
  baselines, so 27.7's wider glyph instance costs nothing on the
  CPU side.  Its device-side cost is arithmetic and recorded: 64
  bytes per glyph instead of 56.
  **Not measured here**: the device-side frame cost of the new
  shader branches.
  *Correction (2026-08-03)*: the reason given for that was **wrong**.

  This record said `benchmark:renderer` "requires a real adapter
  and this box has only SwiftShader" — the box has an **AMD RX 580**
  (RADV POLARIS10, alongside an Intel UHD 630), which is the same
  hardware the 2026-08-01 validation pass benchmarked on, and the
  benchmark harness does get the hardware adapter.  Only the *golden*
  project pins SwiftShader, deliberately, and only for the WebGPU
  adapter.  This is the second time that conclusion has been reached
  and corrected: the 18.5 note claiming a software-only adapter was
  corrected by the same hardware pass, which traced it to
  `requestAdapter()` returning null on `about:blank` — probe from a
  served page.

  The measurement was therefore *skipped*, not blocked.
  **Answered by round 29.5** (2026-08-03): re-run on the RX 580
  against the pre-round-27 baseline, every stable device row moved
  +0.3% to +3.6% — the label rows at the top of that band, consistent
  with 27.7's wider glyph instance, and the shape and arrow branches
  invisible.  Round 27 cost nothing measurable per frame.
- [x] **27.10 Closing docs sweep** (2026-08-02) — swept both
  documents for the round's vocabulary.  The README header carries
  round 27; the node-shape section now records the completed
  vocabulary, the three parameterized shapes, and the fact that one
  `corner-radius` prop carries **three** different 'auto' rules (all
  v3's); the arrowhead section records the compound heads, how each
  is built, the hollow-fallback deviation, and v3's sizing formula
  with its model-space caveat; the label section records numeric
  `text-rotation` and its glyph-memory cost; and the border-geometry
  note now explains *why* `border-style` is unported (the missing
  perimeter coordinate) instead of just asserting it.

  Corrected while sweeping: the shape section still said the
  `round-*` family had "no clean closed form" under anisotropic
  scaling — 27.4 found one, so leaving that note in place would have
  discouraged exactly the work that closed it.  The follow-up hooks
  now list `border-style`/`outline-style` as the single remaining
  parity item, waiting on a scope call rather than on a technique.
  **Amended after a second pass (2026-08-02)**: this sweep did the
  README end to end and stopped there, leaving *this file's* gap
  ledger still asserting that the shape keywords, the compound
  arrow shapes and numeric `text-rotation` were unbuilt — three
  things the round had just built — and the "Suggested sequencing"
  summary still listing them as remaining.  Items 4, 5 and 6 of the
  needs-a-call ledger and the sequencing paragraph are now true up;
  the directory layout picked up round 27's changes to
  `shape-points.mts` and `contract.mts`; the README's JSDoc-coverage
  paragraph still described round 26.1's file-allowlist gate rather
  than the 100%-everywhere rule 26.4 replaced it with; and both
  documents now record the round's most transferable finding — that
  a golden answers "did this change?" while only a parity diff
  answers "is this right?", and that a parity test should be run
  once with its feature disabled to prove it can fail.  The standing
  process rule above gained "sweep this file too".
  A read-the-code verification pass over the README's factual
  claims (13 checked against source, most confirmed) turned up three
  that were wrong, all now fixed: the curved-edge section recorded a
  **deviation that does not exist** — it said v3 staggers an
  `unbundled-bezier` without `control-point-distances` by the
  unbundled pair group and that v4 does not port it, when v3's
  `edgeIsUnbundled` branch assigns the plain step size and its
  staggered `normctrlptDist` is dead on that path, so the two agree;
  the event section said `event.preventDefault()` "stays unported"
  with `originalEvent` keeping the DOM method, when in fact the
  method **is** present (v4 emits the shared v3 `Event`) and
  silently does nothing because no v4 code reads
  `isDefaultPrevented`, while `originalEvent` is never populated at
  all — the old wording told a reader to reach for a route that is
  not there; and "round 26 took both tiers from 46%" conflated a
  combined figure with per-tier ones (43% public, 55% internal).
  Two more findings from the second pass, both outside the docs
  themselves: the **debug harness** (`debug/init.js`) carried
  allowlists that silently dropped any shape outside
  ellipse/rect/round-rect and any arrowhead but triangle when
  converting a v3 fixture stylesheet — stale since round 10, and
  now inverted into a much shorter list of the v3 spellings v4 does
  *not* accept.  And that shorter list exposed a small
  **inconsistency worth a call rather than a silent patch**: the
  2026-07-29 triage dropped the no-dash legacy aliases, yet
  `roundrectangle` is still accepted while `cutrectangle` and
  `concavehexagon` are not.  Recorded in the README next to the
  shape vocabulary.
  **Round 27 is complete apart from 27.8, which is held for that
  call.**
