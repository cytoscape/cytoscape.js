## Style-prop parity

A prop-level sweep of the v3 style registry
(`v3/src/style/properties.mts`: 280 registered props + 11 aliases)
against the v4 engine, asking one question per prop: is it
implementable **entirely under existing design decisions** — a new
channel column plus parse/mapper/stored-truth-readback plumbing plus
fragment-stage shader work, the pattern rounds 10 B2/B3/B4 (line
styles, label visuals, arrow shapes) established — with no new
subsystem and no open API-semantics call?  Roughly 55 props qualify;
they are this round.

The paint props are cheap for a structural
reason: colors/opacities fetch in the fragment stage (the
flat-instance-fetch precedent), so they never touch the
8-storage-buffer vertex budgets that constrain geometry work.  This
round refills the autonomous shelf; the design queue (compounds →
background images → event vocabulary/extension contract → force
layout) is not consumed by it.

- [x] **C3 custom polygons** (2026-07-31).  `shape: 'polygon'` +
  `shape-polygon-points` land on the round-11 blob pattern: a second
  `CurveBlob` pool holds each node's flat unit pairs, slot-stable
  compaction rewrites the packed offset|count<<24 ref that rides the
  `borderGeom` radius word (meaningless for polygons), and the
  column mirror ships the pool as one more growable buffer
  (`delta.polyBlob`).

  The node FS gained `customPolySD` — iq's
  exact sdPolygon over the blob range scaled to device space, so AA,
  borders and the depth prepass's interior test stay crisp under
  anisotropy like the generated shapes — and CPU pick runs
  point-in-polygon over the same record: dual consumers of one ref,
  agreeing by construction.  Binding budget: the poly blob is the
  node stage's 9th storage buffer, so the node pipelines split into
  two layouts — main/prepass drop the ghost column (their entry
  points never read it), the ghost pipeline drops `node.flags` (no
  accent/hover on ghosts) — each landing at exactly 8 FS storage
  buffers; the ghost FS also gained the C2 gradient branch it was
  missing.

  Points are constants-only, validated (even count, >= 3
  pairs, [-1, 1] range — v3's evenMultiple/min/max rules), capped
  at 32 points (recorded), default to v3's unit square, read back
  as the space-joined list, and free their pool record on
  non-polygon restyle and node removal.  WGSL lesson repeated:
  `ref` is a reserved word (caught by the console-error guard).

  Verification: 9 Node specs (`test/shape-polygon.mjs`: parse /
  readback / validation / blob refs / free-on-restyle / pick
  inside-ness incl. a pool-rewrite case), a `webgpu` spec (draw +
  pick agree on the point list at pixel level), the `shape-polygon`
  golden (concave arrow outline over bordered / anisotropic / small
  nodes), and **`parity-polygon` vs v3 at 0.005%** (6 px of AA on a
  shared concave-arrow scene — pure geometry, near pixel-exact).
  1919 Node tests, 106 Playwright specs, typecheck + lint green.

- [x] **D1 `font-style` + `font-weight`** (2026-07-31).  Both land
  as global constants riding the `font-family` rule: the store's
  face triple (`labelFont`/`labelFontStyle`/`labelFontWeight`) feeds
  the atlas's CSS font shorthand
  (`style weight ${SDF_FONT_SIZE}px family`), and any change marks
  every labelled slot dirty so the atlas reset and the glyph-run
  rebuild land in one pass — no new columns, no shader changes.
  Values: v3's sets (`normal | italic | oblique`; the weight
  keywords plus the numeric hundreds 100..900, read back as
  strings); edges-group use and mappers throw via the generalized
  `GLOBAL_FONT_PROPS` guard (same messages as `font-family`).

  The
  playwright page gained the real Open Sans 700-italic `@font-face`
  so the D1 golden pins an actual face, not browser synthesis.  No
  v3 pixel parity for labels by recorded design (raster + placement
  differ) — the pins are the `labels-bold-italic` golden (label
  tolerance) and a `webgpu` spec asserting bold ink > normal ink in
  the label band plus a nonzero italic-vs-upright pixel diff.  7
  Node specs (`test/font-props.mjs`).  1926 Node tests, 108
  Playwright specs, typecheck + lint green.

- [x] **D2 `min-zoomed-font-size`** (2026-07-31).  Per-element, as
  planned: the prop rides the label sidecar (mapper-capable, both
  groups, v3's default 0 = no floor) and bakes into each glyph as a
  precomputed `zoomDprMin = minZoomed / fontSize` — the Glyph struct
  grew 12→14 words (56-byte stride, one f32 + explicit pad) — so
  both glyph cull kinds test `frame.zoomDpr < zoomDprMin` before the
  global `labelFadePx`/`labelMinPx` predicates: v3's
  `eleTextBiggerThanMin` (`fontSize × zoom × pxRatio < minSize` ⇒
  hide), evaluated on-GPU per glyph with zero per-frame CPU work,
  and the background quad hides with its text.

  Fixed en route:
  `setLabel`'s no-op equality check learns the new field (a restyle
  changing only the floor previously kept the stale sidecar).  No
  label pixel parity vs v3 by recorded design — the pin is a
  `webgpu` LOD spec (floored + unfloored labels: both draw at zoom
  1, only the floored one vanishes at zoom 0.7, and it returns at
  zoom 1 — a pure cull, no rebuild) plus 4 Node specs
  (`test/min-zoomed-font-size.mjs`).  1930 Node tests, 109
  Playwright specs, typecheck + lint green.

- [x] **D3 `text-valign`/`text-halign`** (2026-07-31).  v3's 3×3
  node-label anchor grid, mapper-capable and node-only (the edges
  group throws, like v3 forcing edge labels to center/center).  The
  sidecar entry carries the node-extent base (`anchorX` =
  (halign−1)·w/2; `anchorY` per valign with the round-10 4 px
  label margin on the top/bottom rows) plus block-fraction shifts
  (halign −0.5/0/+0.5 of the laid width; valign −1/−0.5/0 of the
  laid height) that the glyph builder resolves once the run's real
  dimensions are known — placement only, no shader or cull changes,
  and the background box anchors with its text.

  **Recorded
  deviation: v4's default `text-valign` stays `'bottom'`** (the
  round-10 below-node placement every existing golden pins); v3
  defaults to `'top'`.  The v3 `padding`-based gap is approximated
  by the fixed 4 px label margin (v4 has no `padding` prop).  No
  label pixel parity vs v3 by recorded design — pins are the
  `label-align` golden (all nine (halign, valign) pairs with
  background boxes) and a `webgpu` spec asserting ink moves
  above-left for top-left and below-right after a bottom-right
  restyle, with the opposite bands empty.  6 Node specs
  (`test/text-align.mjs`).  1936 Node tests, 111 Playwright
  specs, typecheck + lint green.

- [x] **D4 `source-label`/`target-label` families** (2026-07-31).
  All ten props land: `source/target-label` (constants or the
  `data(key)` passthrough, refreshing on data writes),
  `-text-offset` (non-negative, mapper-capable), `-text-margin-x/y`
  and `-text-rotation` (`none | autorotate`) — with the remaining
  text channels (font, color, boxes, opacity, transform,
  min-zoomed-font-size) shared with the main label, exactly v3's
  unprefixed reads.  Two more sidecar streams
  (`edgeSource`/`edgeTarget` in the widened `LabelStream` type) feed
  two more `GlyphBuffer`s from the same builder; the glyph word 13
  pad became the **endParam encoding** (sign picks the end,
  |v|−1 the arc offset — the +1 bias keeps offset 0 distinct from
  the midpoint streams).  The edge label VS re-anchors end glyphs by
  walking the drawn path — v3's `calculateEndProjection` on-GPU:
  straight/haystack segments exactly, bezier/loop as a 32-sample
  polyline of the quad chain (v3 itself walks a ~16-segment
  approximation), route families along the route polyline (v3's
  allpts walk — both ignore corner rounding) and multibezier at 8
  samples per quad chain link; autorotate takes the local tangent.
  The shared edge-glyph cull kind grows the viewport slack by half
  the chord for end glyphs (the anchor can sit anywhere on the
  path); two more `CulledGroup`s of the same kind and two more
  draws through the same `LabelPipeline` (its bind cache re-keyed
  per (uniform, stream)).  Edge removal and restyles clear the
  streams.  No label pixel parity vs v3 by recorded design — the
  pins are the `end-labels` golden (straight + bezier pair with
  autorotate + taxi + loop, boxed labels) and a `webgpu` spec
  asserting the straight-edge anchors land at v3's exact arc
  positions (boundary + offset) and slide on restyle.  8 Node specs
  (`test/end-labels.mjs`).  1944 Node tests, 113 Playwright
  specs, typecheck + lint green.  **Round 13 complete.**

**Sequencing**: pass 12c (the round-12 plan above) runs first, then
this round's phases in order — the 2026-07-29 triage keeps (ghost,
overlay/underlay) lead, per the discussion that produced this plan.
Process: the round-10 rules verbatim (isolated commits, docs
in-commit, full verify per item, escalation to "Needs a call" on any
real API-semantics question discovered mid-implementation; goldens
regenerated autonomously when a visual change is intended).

**Tier discipline** (the existing invariants, applied to the new
channels):

- Colors and opacities are *paint*: fragment-stage fetch, eligible
  for the GPU mapper eval kernel and paint tweens where the packing
  fits, always CPU-evaluable.
- Anything read by bb/fit, the CPU pick replica, or a columnar scan
  is *geometry*: eagerly CPU-evaluated, with its bounds/pick
  consumers extended in the same commit — `corner-radius` is read by
  the CPU pick inside-test; node `outline-width`/`-offset`,
  overlay/underlay padding and ghost offsets grow the store bb scan
  the way `border-width` already does.
- List props are constants-only (the 12b scope rule: a mapper value
  is one number/keyword, not a list), capped where they feed
  fixed-iteration shader loops, caps recorded as deviations.

**Implementation leans recorded at planning** (so the passes can run
autonomously):

- Gradients interpolate in **sRGB**, matching v3's canvas gradients —
  the live parity harness is the point of porting them.  (OKLab stays
  the default for *mapper* ranges; a gradient is a v3-parity visual,
  not a data encoding.)
- `font-style`/`font-weight` follow the `font-family` rule: global
  constants (one font per atlas); per-element forms stay out.
- Dashed `border-style`/`outline-style`/`text-border-style` stay out
  (dashing an SDF boundary needs perimeter parameterization — the
  recorded B2 reason); these props ship with `solid` semantics only
  where the rest of their group lands.
- `text-valign`/`text-halign` are placement only: labels stay
  excluded from `boundingBox()` (the recorded deviation), so the
  anchor grid carries no bb implications.
- Arrow scalars are draw-only in v4 (arrows are not pickable and not
  in bb — both existing recorded deviations), so `arrow-scale`/
  `arrow-width`/`arrow-fill` are pure FS/quad-sizing work.
  *(Half-superseded by 57.10: arrows pick now.  Not-in-bb stands.)*

**Phase A — the 2026-07-29 triage keeps** (direction already set)

- [x] **A1 Ghost props** (`ghost`, `ghost-offset-x/y`,
  `ghost-opacity`) — the decided simplified form: one extra instance
  draw of the basic node body (shape, border, background) at the
  offset, never labels or decorations.  Offsets grow the bb scan
  (geometry tier).  Landed 2026-07-31 — see the round-13 record.
- [x] **A2 Overlay/underlay theming** — the 10 `overlay-*`/
  `underlay-*` element props plus the `active-bg-*` and
  `selection-box-*` core props; the baked-in affordances (shader
  hover/active brighten, accent ring, DOM selection box) become the
  styled defaults.  Overlay/underlay padding grows bounds (geometry
  tier); underlay draws under the node within the existing pass
  order.  Landed 2026-07-31 in three slices — see the round-13
  record.

**Phase B — paint & stroke channels** (pure FS + channel plumbing)

- [x] **B1 Opacity split**: `background-opacity`, `border-opacity`,
  `line-opacity`, `text-opacity` — v3 semantics (element `opacity`
  is the master multiplier; effective = opacity × channel opacity).
  Early-z's guaranteed-opaque predicate consumes the product (more
  conservative, never wrong); text opacity folds into glyph alpha
  and reads back folded (the outline/background-opacity precedent).
  Landed 2026-07-31 — see the round-13 record.
- [x] **B2 `border-position`** (inside | center | outside — a pure
  SDF band offset) + **`corner-radius`** (a scalar channel feeding
  the existing round-rectangle SDF; CPU pick inside-test reads it —
  geometry tier).  Landed 2026-07-31 — see the round-13 record.
- [x] **B3 `line-cap`** (butt | round | square — endpoint cap SDF in
  the edge FS) + **`line-dash-pattern`/`line-dash-offset`**
  (arbitrary patterns over the existing arc-length varying;
  constants-only lists, pattern length capped).  Landed 2026-07-31 —
  see the round-13 record.
- [x] **B4 Edge casing**: `line-outline-width`/`-color` — a border
  band on the edge strip (straight and curved), colors fetched
  fragment-side.  Landed 2026-07-31 — see the round-13 record.
- [x] **B5 Node `outline-*`**: `outline-color`/`-opacity`/`-width`/
  `-offset` as an SDF band outside the shape (distance ∈
  [offset, offset + width]); solid only.  Bb scan and conservative
  bounds grow by offset + width; the pick body stays the shape
  itself (v3-consistent).  Landed 2026-07-31 — see the round-13
  record (the band derives as offset/2 past the border's outer
  edge, matching v3's scaled-path stroke exactly for circles).
- [x] **B6 Label box parity**: `text-transform` (none | uppercase |
  lowercase, applied when the glyph run is built),
  `text-border-width`/`-color`/`-opacity` (a border on the existing
  text-background quad), `text-background-shape` (rectangle |
  round-rectangle on the quad's SDF).  Landed 2026-07-31 — see the
  round-13 record.
- [x] **B7 Arrow scalars**: `arrow-scale`, `arrow-width`,
  `arrow-fill: hollow` (an FS ring test on the existing arrow SDFs).
  Compound arrow shapes stay out (recorded in round 10 B4).  Landed
  2026-07-31 — see the round-13 record.

**Phase C — re-triaged: 12a/12b built the machinery** (these sat in
needs-a-call batches; this plan's sign-off pulls them onto the
shelf, since the expensive part now exists)

- [x] **C1 Mid-arrows** (landed 2026-07-31 — see the round-13
  record): `mid-source-*`/`mid-target-*` arrow props —
  anchored at the curve/route midpoint with the midpoint tangent,
  exactly the anchor + frame edge labels and autorotate already
  compute in the VS (straight edges use the chord midpoint).  One
  more quad per enabled end off the edge cull streams.
- [x] **C2 Gradients** (landed 2026-07-31 — see the round-13
  record): `background-fill` (linear-gradient |
  radial-gradient) + `background-gradient-stop-colors`/
  `-stop-positions`/`-direction`; `line-fill` +
  `line-gradient-stop-colors`/`-stop-positions`.  Stop lists
  constants-only and capped (cap recorded); node FS evaluates along
  the gradient frame, edge FS along the arc-length varying; sRGB
  interpolation per the lean above.
- [x] **C3 `shape-polygon-points`** (landed 2026-07-31 — see the
  round-13 record) (custom polygon): the
  per-element unit point list lives in a blob (the curve-blob
  storage pattern, round-11 compaction rules), the node FS runs the
  generated sdPolygon loop over the blob range, and CPU pick runs
  point-in-polygon over the same points — dual consumers of one
  record, agreeing by construction.  Unit points are normalized, so
  the bb term stays the node box.

**Phase D — label props with recorded constraints**

- [x] **D1 `font-style` + `font-weight`** (landed 2026-07-31 — see
  the round-13 record) as global constants (the
  `font-family` rule: one font per atlas; a change resets the atlas
  and re-lays-out every label).
- [x] **D2 Per-element `min-zoomed-font-size`** (landed 2026-07-31 —
  see the round-13 record): a sidecar channel
  baked per glyph run, tested in the glyph cull predicate beside the
  global `labelFadePx`/`labelMinPx` (which stay the defaults).
- [x] **D3 `text-valign`/`text-halign`** (landed 2026-07-31 — see
  the round-13 record) for node labels: v3's 3×3
  anchor grid, anchor math off the node half-extents
  (`node.outerHalf` is already a bindable column); placement only
  per the lean above.
- [x] **D4 `source-label`/`target-label` families** (10 props;
  landed 2026-07-31 — see the round-13 record): two
  more glyph streams from the round-10 B5 template, anchored at
  v3's offsets along the edge (`source/target-text-offset` as arc
  distance via the route evaluator), each with its own margins and
  rotation per v3.  The chunkiest item — last for a reason.

**Excluded from this round, with reasons** (each stays in its parked
tier; none of these is newly decided): dashed
border/outline/text-border styles (perimeter parameterization);
`round-*` polygon variants, `cut-rectangle`, `barrel`,
`concave-hexagon`, `right-rhomboid`, `bottom-round-rectangle` (no
closed form under anisotropic scale — recorded in round 10 B1);
multiline props (`text-wrap`, `text-max-width`,
`text-justification`, `line-height`, `text-overflow-wrap`,
`text-metrics`, `box-select-labels` — their round designs label bb);
the `background-image` family (texture-atlas architecture call);
pie/stripe (wanted-at-all call); the compound group; `z-index` props
(coupled to the compaction draw-order call); `transition-*`
(animation-surface call); `display`/`visibility` split,
`events`/`text-events`, `box-selection: overlap` (interaction
calls); and everything in the dropped-by-decided-design ledger.

**Verification per item**: parse/readback/mapper Node specs; a
golden scene per visual group; live v3-parity scenes where the
visual is v3-comparable (gradients, casing, caps, mid-arrows, the
valign grid); the WGSL identifier/validation guards as usual.  The
renderer benchmark re-runs only for items touching hot paths (B1's
early-z predicate, C2's node-FS cost).
