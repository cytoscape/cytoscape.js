## Geometry tweens

The follow-up round 24.4 logged: the geometry numerics —
node `width`/`height`, edge `width`, `font-size`, parent `padding` —
become animatable and transition-tweenable, with the per-tick
invalidation cascade built once and benchmarked.  The API surface
does not change (the fourth sitting's call): `transition-property`
already accepts these names and `animate({ style })` starts
accepting them; what changes is that they tween instead of
snapping/throwing.

**Code investigation (2026-08-02, precedes this plan)** — every
consumer of node size / edge width / font-size classified as
live-read vs derivation-baked:

- Node size is read **live** by nearly everything: node/ghost/
  overlay/underlay/image/chart quads and their cull extents, CPU
  pick, `refsInBox`, `boundingBox`, endpoint clipping, haystack
  offsets, taxi/segment/bezier evaluation (curve *derivations* are
  size-free).  Exactly two consumers bake it: **label anchors**
  (sidecar `anchorX`/`anchorY` + the glyph run's baked offsets —
  today only the style engine's same-pass `writeLabel` keeps them
  in sync, and the store's `reanchorLabel` covers only the parent
  auto-bounds path) and the **compound-loop excursion bound** `p2`
  (cull slack only; drawn CMPD geometry is live).

  The CMPD
  invalidation lives only in `materializeParentGeom`, so it has a
  pre-existing hole: a child size change that does not move the
  parent's box (non-extremal child, or a min-size-pinned parent)
  never refreshes the bound.  Slack meters (`nodeHalfMax`,
  `borderMax`) are monotone grow-only — sound under tweens.
- Edge width is read live by the quad/strip expansion, arrow
  sizing and edge cull; three derived channels bake it at
  style-write, all **linear in width**: `edge.arrowWidths` under
  `match-line`/percent, `edge.casing` stroke (width + outline
  width), `edge.overlay`/`edge.underlay` strokes (width +
  2·padding).
- Font-size is baked into the glyph instances in model px (the
  build is per-label incremental, never whole-stream), and the
  shaping memo keys on `maxWidth/fontSize` — a tween would miss
  (and grow the memo) every tick, `GlyphBuffer.set` would
  tombstone-and-append per tick until compaction forces
  whole-stream re-uploads, and every label write bumps the global
  `geoEpoch`, nuking the per-edge exact-bb memo.  Edge-label
  `anchorY` is fontSize-dependent (`-fontSize/2 + marginY`); node
  label anchors are not.
- Padding already cascades: `setCompoundStyle` marks the hierarchy
  geo-stale and the lazy flush re-derives auto-bounds.

**Design calls (round 25):**

1. **Geometry tweens never offload and are never stale.**  The
   round-9.4 tier rule stands: these channels are read by cull,
   CPU pick and the columnar scans, so every tick is a CPU column
   write (the mirror uploads dirty spans as usual).  Consequence,
   recorded as a contract point: unlike leased paint/position
   tweens, a geometry tween is always synchronously readable —
   `width()`/`bb()`/pick mid-tween report the mid-flight value
   (v3's behaviour).  `gpuEligible` stays false via the existing
   tier mechanism; the GPU tween kernels never see the new write
   kinds.
2. **The write vocabulary grows three CPU-only kinds.**
   `ChannelWrite` gains `lane` (scalar tween of one component of a
   multi-lane column — `node.size` lanes 0/1, `edge.arrowWidths`
   lanes, and the ×256 fixed-point stroke lanes of
   `edge.casing`/`edge.overlay`/`edge.underlay`), `padding`
   (writes `setCompoundStyle({ padding })` per tick), and
   `fontSize` (patches the label sidecar per tick).  Store entry
   points: `setLane` (with per-column cascade) and
   `setLabelFontSize`; both usable by the style engine too.
3. **The size-write cascade closes the label hole at the store;
   the CMPD bound needs nothing** (amended while building 25.1 —
   the investigation's "pinned-parent hole" did not survive a
   closer look).  `setPair('node.size')`/`setLane` re-anchor the
   label (`reanchorLabel` hoisted out of the parent-only path;
   early-outs when unlabelled or center-anchored).

   The planned
   CMPD `invalidateRelation` hoist is **unnecessary by a
   containment argument**: the excursion bound is a max over both
   ends' stretches, stretch is monotone in `outerHalfW`, and
   auto-bounds derive parents from children's *outer* halves — so
   an ancestor's outerHalfW always dominates its descendants' and
   the max is always the ancestor's, which can only change when
   the ancestor's own box changes: exactly the event
   `materializeParentGeom` already invalidates on.  A
   descendant-size change that leaves the ancestor's box unmoved
   provably leaves the bound unmoved too.

   (The same argument
   dissolves the investigation's monotone-safety worry: a stretch
   change implies a parent-box change implies a re-derive.)
   Pinned by a spec: a child size tween grows p2 through the
   parent's own materialization.
4. **Edge width carries its baked derivatives as ride-along lane
   writes**, the arrow-alpha-fold pattern: casing and
   overlay/underlay strokes ride additively (to = stored + Δwidth,
   only when the layer/casing is enabled), `arrowWidths` rides per
   mode (match-line → toWidth, percent → pct·toWidth, number →
   no ride), modes answered by the style engine at capture (the
   `captureArrowFold` precedent).  Transitions get the same rides
   from stored-truth diffing (the apply pass rewrites the derived
   channels; the txn records them as lane rides of `width`).
5. **Parent size is auto-bounds-owned: width/height tweens skip
   parent slots** (capture filters them; apply re-checks
   FLAG_PARENT per tick so a mid-tween leaf→parent flip drops the
   slot rather than fighting the derivation).  Recorded deviation:
   animating/transitioning `width`/`height` on a compound parent
   is a no-op — `padding`/min-size are the parent knobs, and the
   padding tween is this round's parent-size story.  Also
   recorded: `width` and `height` share the `node.size` channel,
   so the round-21 eviction treats them as one channel (a running
   width tween is evicted by a starting height tween).
6. **Padding tweens the declared value in its declared unit** (px
   or %-fraction; the resolution against the children bb happens
   at the flush, per tick, so relative modes follow live).  A
   unit change between sheets snaps (recorded).  Leaves have no
   padding — capture filters to parent slots.  The transition
   capture wraps the parents' `setCompoundStyle` apply (its own
   small capture beside the `write()` funnel, honouring the
   styled-generation instant-on-add rule).
7. **Font-size tweens re-break honestly, made affordable by four
   label-path fixes** (each useful beyond tweens): (a) a pure
   fontSize delta with unchanged breaking (wrap `none`, the
   default) scale-patches the stored dims instead of re-running
   `estimateBlock`; (b) the shaping-memo key drops `maxWidth`
   when wrap is `none` (kills the spurious per-tick miss +
   unbounded memo growth); (c) `GlyphBuffer.set` updates in place
   when the new run has the same glyph count (no tombstone
   growth, no forced compactions/whole-stream re-uploads under a
   steady tween); (d) label writes stop bumping the global
   `geoEpoch` (labels get their own epoch; the per-edge exact-bb
   memo keys on geometry alone).

   Wrapped labels (`wrap`/
   `ellipsis` with a finite `maxWidth`) genuinely re-break per
   tick — correct, priced in the benchmark, and recorded as the
   expensive configuration.  The tween patches `fontSize` (and
   the fontSize-dependent `anchorY` on the three edge streams)
   across `nodes`/`edges` + end-label streams; min-zoomed-font
   culling follows automatically (the per-glyph threshold is
   rebuilt with the instances).
8. **Transitions wire through the same channels.**
   `TRANSITION_CHANNELS` gains nodes `width`/`height` (size
   lanes), `padding`, `font-size` and edges `width` (+ lane
   rides), `font-size`; the txn capture learns the lane/fontSize
   read-restore forms (the delay rule keeps holding pre-restyle
   values, sidecar included).  The round-24 "geometry snaps"
   specs flip to "geometry tweens" — the API surface is
   unchanged.
9. **Scale is measured, not assumed.**  A new
   `benchmark/geometry-tween.mjs` sweep prices: the size-tween
   tick at 2k/20k/200k animated nodes (labelled vs unlabelled —
   the re-anchor term), the edge-width tick with rides, the
   padding tick (auto-bounds flush per tick at compound scale),
   the font-size tick (wrap none vs wrapped — the re-break term),
   against the round-24 paint-tick baseline (15 ms/200k slots).
   The glyph-buffer in-place path is pinned by a
   no-growth/no-compaction assertion under a steady tween.

**Pass split** (tests-first; docs in-commit; each pass its own
commit(s)):

- [x] **25.1 The lane vocabulary + node width/height**
  (2026-08-02) — landed as planned, with design call 3 amended
  (above): the `lane` write kind (`ChannelWrite.lane`, stride 2,
  geometry-tier by construction — `TWEEN_SHADERS`/pipelines
  narrowed to a `GpuWriteKind` that excludes it, and the runtime
  throws if one ever reaches `register`), the store's cascading
  `setLane` (`node.size` routes through `setPair`; other float
  columns write the lane raw + dirty), the **label re-anchor
  hoist** into `setPair('node.size')` (the raw-size-write anchor
  staleness hole, closed for style writes and tween ticks alike),
  and `STYLE_CHANNELS` `width`/`height` as `node.size` lanes 0/1
  with parent slots filtered at capture and re-checked per tick
  (a mid-tween leaf→parent flip hands the slot to auto-bounds).

  No CMPD invalidation was added — the containment argument in
  call 3, pinned by the p2-growth spec.  Tests-first: 12 Node
  specs (`test/geometry-tween.mjs`, red then green) — width+
  height and width-only tweens, never-stale `width()`/`bb()`
  reads, outerHalf write-through, hanging-label re-anchor
  mid-tween, child tween drives parent auto-bounds per tick, the
  CMPD p2-growth pin, width-vs-height channel eviction, reverse
  continuity, spring clamp at the 0 floor, pause/resume.  2260
  Node tests, 63 module tests, typecheck + lint clean.
- [x] **25.2 Edge width + rides** (2026-08-02) — landed as
  planned: `STYLE_CHANNELS.width` gains the `edge.width` column
  (plain scalar, geometry tier) and the capture carries the three
  style-write-baked derivatives as ride-along lane writes
  (`captureEdgeWidthRides`, the `captureArrowFold` pattern): the
  casing/overlay/underlay strokes additively from stored truth
  (to = stored + Δwidth, per-slot gated on the layer record being
  enabled — mapper-resolved paddings/outline widths need no
  engine round trip), and `edge.arrowWidths` by mode via the new
  constants-only `StyleEngine.arrowWidthModes()` ('match-line' →
  target width, percent → pct × target, numbers stay).
  `setLane` encodes the layer records' ×256 fixed-point stroke
  lane.  Tests: 4 specs (red then green) — live `width()` reads,
  match-line + percent rides with stored-truth readback, the
  additive casing ride, ride-only-when-enabled (a disabled
  underlay's record never moves).  2264 Node tests, 63 module
  tests, typecheck + lint clean.
- [x] **25.3 Size transitions** (2026-08-02) — landed:
  `TRANSITION_CHANNELS` gains nodes `width`/`height` (`node.size`
  lane channels) and edges `width` with its baked derivatives as
  **lane rides** (casing/overlay/underlay stroke lanes ×256
  fixed-point, both `edge.arrowWidths` lanes — stored-truth
  diffing catches them because the apply pass rewrites them in
  the same funnel; rides move only when the width moved).  The
  txn machinery learned the `lane` kind end to end: descriptors
  (`TxnChannelDesc`, rides as full descriptors now), lane
  read/restore (restore runs the full size cascade, so the label
  the apply pass baked at the target re-anchors back to the held
  size), entries keyed `column:lane` (arrowWidths carries two),
  `buildChannelWrite` takes the lane through to the write.
  Parent slots never record a `node.size` transition (the
  auto-bounds rule, checked per slot in the diff).  The round-24
  "geometry snaps" spec flipped to "geometry tweens"; 5 new specs:
  sheet-swap both lanes with live bb, per-tick label re-anchor
  under a transition (held size restores the anchor too),
  edge-width rides (match-line + casing) with held pre-restyle
  values, a mapped width transition on a data write (scale move),
  and the parent-slot never-records pin (parent follows through
  auto-bounds only).  2269 Node tests, 63 module tests, typecheck
  + lint clean.
- [x] **25.4 Padding** (2026-08-02) — landed: the `padding` write
  kind targets the `node.padding` pseudo-column (`TweenColumn` =
  `ColumnId` + the pseudo target; padding is a compound style
  input, not a stored column) and writes through a new
  **`updateCompoundStyle`** — a partial merge over the *current*
  record, split from `setCompoundStyle` because a `{ padding }`
  tick must not reset the unit/min sizes while sheet writes keep
  their reset-what-you-omit semantics.  Parents-only mirrors the
  size rule (leaves filtered at capture, re-checked per tick);
  the declared value tweens in its declared unit (px, or the
  %-fraction — the auto-bounds flush resolves relative modes
  live).

  The transition capture wraps the parents' compound
  write beside the channel funnel (`applyCompoundStyle`): styled
  marks read *before* the channel pass marks fresh slots
  (instant-on-add holds), diff + held-value restore as usual, and
  a px↔% unit flip snaps (recorded).  The GPU-kind narrowing
  extends to `padding` (`GpuWriteKind` excludes both geometry
  kinds; the runtime guard throws).  5 specs (red then green,
  minus the unit-flip snap which pinned the status quo):
  auto-bounds per tick via `paddedWidth()`, leaf no-op that still
  completes, %-fraction tween, the parents-sheet transition with
  held value, unit-flip snap.  2274 Node tests, 63 module tests,
  typecheck + lint clean.
- [x] **25.5 Font-size** (2026-08-02) — landed: the `fontSize`
  write kind (pseudo-columns `node.fontSize`/`edge.fontSize`) and
  `GraphStore.setLabelFontSize` — the per-tick sidecar patch, no
  engine round trip: an edge write drives all three streams and
  re-derives the fontSize-baked edge `anchorY` (−fs/2 + marginY);
  node anchors are size-derived and untouched.  Unlabelled
  elements filter at capture (animation) and snap via the −1
  sentinel (transition diff — a label added by a restyle has
  nothing to tween from).

  The four label-path fixes shipped
  with it: the wrap-none scale-patch keeps dims **exact** (the
  round-16 wrap spec updated to pin the new contract — scaling a
  laid block is exact; a text change still re-estimates), the
  memo key drops `maxWidth` under wrap none, `GlyphBuffer.set`
  rewrites same-count replacements in place (pinned by a
  50-tick no-growth/no-tombstone spec with a single coalesced
  span), and label writes stop bumping `geoEpoch` (its only
  consumer is the edge curve-bb memo — no label terms).

  Tests: 3 animation specs (node dims/readback, edge anchorY +
  end-stream ride, unlabelled filter), 2 transition specs (held
  value tween, label-added snap), the glyph-buffer in-place
  spec, and the amended wrap-dims spec.  2280 Node tests, 63
  module tests, typecheck + lint clean.
- [x] **25.6 Benchmarks + browser specs** (2026-08-02) — landed:
  `benchmark/geometry-tween.mjs` (standalone, the
  transitions.mjs pattern) prices one manager tick per geometry
  channel at `BENCH_N` scale.  At 200k elements (headless,
  avg/iter, machine-local — the factors are the story): paint
  baseline 65 ms; node size 122 ms unlabelled / 136 ms with
  center-anchored labels (the re-anchor early-out is ~12%) /
  510 ms with hanging labels (a sidecar rewrite per tick — the
  25.5 dims fast path keeps the estimator out of the loop); edge
  width over 400k edges 86 ms bare / 130 ms with the full ride
  set; padding + auto-bounds flush 75 ms over 25k parents × 8
  children; font-size 213 ms wrap-none vs 767 ms wrapped (the
  honest re-break, the recorded expensive configuration).  Two
  `webgpu`-project Playwright specs: the sheet-swap width
  transition (pixels move mid-flight; `width()` reads the
  mid-flight value — the never-stale contract — and the hanging
  label's anchorX tracks −w/2 exactly, read atomically in one
  evaluate), and the edge-width casing ride (a fixed sample
  point passes white → black casing band → red line; the
  mid-state is *polled*, not slept for — suite load shifts the
  clock).  87/87 webgpu Playwright (2 new), run twice for
  stability.
- [x] **25.7 Closing docs sweep** (2026-08-02) — swept both docs
  for the round's vocabulary and staleness markers: the README
  header carries round 25, the follow-up hooks close the
  geometry-tween item (the parity remnants stay the open tail),
  the two-tiers bullet notes the round kept the geometry-stays-CPU
  rule, the round-16 label-cost line qualifies "never per frame"
  (per frame exactly under a wrapped font-size tween, recorded),
  and the gap ledger's two live sequencing references move past
  the round.

  Full verification: typecheck, 2280 Node tests, 63
  module tests, lint, and 173/173 Playwright across the
  chromium + renderer + visual projects (goldens untouched;
  the webkit/webgpu-webkit projects could not launch on this
  box — `browserType.launch` fails on missing host system
  libraries, an environment gap needing sudo, not a regression;
  re-verify on a webkit-capable machine when convenient).
  **Round 25 is complete.**
