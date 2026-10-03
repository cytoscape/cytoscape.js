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
