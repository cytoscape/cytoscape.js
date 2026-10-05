## Arrow vocabulary and hollow compound heads

Implements item 72's decisions from the alpha interview, before round 77
and the WebGL2 port. Input evidence is the prepared 29 September gallery
and usage census; do not repeat that investigation without new evidence.

### Settled contract

- Keep `triangle-tee`; remove `triangle-cross`, **without an alias**. A
  sheet containing the removed name fails normal unknown-value validation.
  Migration changes the name and records the changed bar geometry.
- Plain `tee` and the bar of `triangle-tee` both use
  `max(0.1 * arrowSize, edgeWidth)`, in consistent model units. `arrowSize`
  includes the existing arrow scale. Keep the current triangle-tee placement
  and shape-size law; this is not a general redesign of arrow proportions.
- Hollow compound end heads outline each component separately, then combine
  coverage before applying colour/opacity so intersections do not darken.
  `triangle-tee` and `circle-triangle` must honour hollow styling.
- Mid-edge heads remain filled-only. Existing line-under-translucent-head
  compositing deviations are not silently reversed by this round.
- Keep `vee`, `chevron`, `triangle-backcurve`, `circle-triangle`, the other
  existing heads, and the `arrow` alias for `triangle`. No new heads.

### 146.1 — one vocabulary and geometry contract

Trace `src/shape-points.mts`, `src/style/tables.mts`, the style parser,
`src/style/engine-write.mts`, and the generated shape cases. Remove only the
public cross spelling; avoid unnecessary renumbering of existing packed IDs.
Replace its active case with the canonical geometry, and define how legacy
experimental records are rejected/translated rather than silently decoded
as another shape. Update the schema in the same commit.

Make tee thickness and the resulting axial/back extent CPU-reproducible.
Update line trimming, arrow bounds, picking, node endpoints and straight,
curved and mid paths wherever the geometry is used. Expose shared geometry
helpers to 77; do not leave the new width law only in WGSL. Check CPU shape
tables and `src/render/shaders/sdf.mts`/`arrow.mts` together.

### 146.2 — component outlines

Replace the `COMPOUND_ARROWS` forced-fill write with a real per-component
outline path. Retain filled union coverage. Exercise touching parts, thick
strokes, antialiasing, translucency and independent source/target widths.
The pick halo and bounds must contain the same ink that is drawn.

### 146.3 — acceptance and handoff

- Gallery at edge widths 1/4/12 and scales 1/2, both end fills; plain tee,
  canonical compound and circle-triangle. Include straight, curved, loop
  and mid placements. Compare unchanged shapes against existing goldens.
- Controls: restore the old tee law; force hollow compounds filled; omit a
  width-dependent trim/bounds update. Each corresponding test must fail.
- App fixture maps desktop's open compound arrow to hollow triangle-tee.
  Explicit removed-name validation and alias readback tests.
- Measure the arrow pass on the same scenes before/after; do not claim the
  per-component coverage is free without timing it.
- Open the debug gallery. Run verify, Node, throws, types and Playwright
  gates. Run specs with their controls per `docs/agents/testing.md`.
- Update JSDoc, schemas, `src/README.md`, `MIGRATING.md`, feature inventory,
  the prepared gallery note and item 72. Export and WebGL plans consume this
  geometry; their implementation is not part of this round.

### What landed (2026-10-05)

- Removed `triangle-cross` from the public style vocabulary without an
  alias. Packed id 10 remains reserved and is rejected instead of decoding
  old experimental records as a different head; `arrow` still reads back as
  `triangle`.
- Plain `tee` and `triangle-tee` bars share the model-space rule
  `max(0.1 * arrowSize, edgeWidth)`. CPU helpers and WGSL now agree on the
  drawn bar, back extent, axial trim, bounds and picking geometry. Existing
  gap, spacing, tip placement and triangle proportions stay intact.
- Hollow `triangle-tee` and `circle-triangle` end heads outline each part
  independently, max their coverage before opacity, and keep the union
  pickable. Mid heads remain filled. The app fixture now maps its open
  compound arrow to hollow `triangle-tee`.
- The debug gallery covers widths 1/4/12, scales 1/2, straight/curved/loop
  routes, source/mid/target heads, and the filled/hollow switch. The prepared
  note retains pre-round observations and adds the landed measurements.

| Commit | Change |
| --- | --- |
| `472215ee` | vocabulary, width-aware geometry, hollow compound coverage, schema/migration/docs and regressions |
| `8606eacc` | gallery and compound-arrow renderer benchmark scene |
| this commit | round record, benchmark results and executive-summary closeout |

### Renderer measurement

Compared the same generated 25k-node / 50k-edge hollow-compound scene before
(`6848537a`) and after (`8606eacc`) on the i9-9900K / AMD gcn-4 RX 580, in
Chromium at dpr 2, 1280×800 and render scale 1. Each value is the median of
three independent benchmark runs' GPU timestamp-query p50s; brackets give the
three-run min–max range.

| View | Before (ms) | Landed (ms) | Change |
| --- | ---: | ---: | ---: |
| Fit all | 9.82128 (9.82064–9.82144) | 10.37264 (10.37104–10.37600) | +5.6% |
| Zoomed in 20× | 9.00368 (9.00240–9.00384) | 9.61760 (9.61520–9.61872) | +6.8% |
| Far zoom ÷8 | 2.00848 (0.92544–2.01360) | 0.94448 (0.94448–2.02816) | −53.0%, noisy |
| Fit all, labels | 10.07888 (10.07824–10.07936) | 10.62672 (10.62656–10.62688) | +5.4% |
| Zoomed in 20×, labels | 9.35232 (9.34960–9.35312) | 9.96912 (9.96480–9.97056) | +6.6% |

The fit and zoom increases are consistent across repeats and exceed their
measured run-to-run spread, so the roughly 0.5–0.6 ms cost is not benchmark
noise. Each stays below the repository's ±10% mover threshold. Far zoom has
wide, overlapping repeat ranges and does not support a reliable delta. This
is a measured renderer cost, not a no-cost claim.

### Verification

- `npm run -s verify` passed; its eight oxlint warnings name unrelated
  pre-existing files, not round 146.
- `npm run -s test:node:quiet` passed. The JS portion reported 3,220 tests
  across 544 suites; typecheck, modules, soak, throws and lint completed in
  the composite gate. `npm run -s test:throws:quiet` and
  `npm run -s build:types` also passed.
- Both round 146 Playwright regressions passed on the final source: hollow
  compound outlines/picking and the wide hollow tee's trim/pick behavior.
  The full fixed-port Playwright gate could not be isolated because port
  3333 is held by an external listener whose process is not visible from
  this execution namespace. Focused browser runs used temporary local ports;
  no unknown listener was stopped.
- Manual gallery review found no JS, WGSL or console errors. At close zoom,
  width-1 tee and circle-triangle components visibly switched between filled
  and hollow at scales 1 and 2; all width/scale cells responded to the fill
  control, and straight, curve and loop routes were present.
- Three negative controls failed at their intended assertions: the old
  size-only tee law failed the geometry spec; forced-filled compounds failed
  the component pixel assertion; static tee trim/bounds left line ink in the
  hollow interior. Every temporary source and test edit was restored exactly.

**Round 146 is complete.**
