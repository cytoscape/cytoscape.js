## Label fidelity under zoom

The maintainer: labels break down in quality when zoomed in a fair
bit.  Reproduced: at zoom 4 (font-size 14 → 56 displayed px) v4's
glyphs go soft, corners round off, and a 'g' descender deforms,
beside a v3 render that is crisp at every zoom.  Mechanism, pinned:

1. **The atlas is a runtime single-channel SDF at a fixed 32 px per
   glyph** (`src/render/glyph-atlas.mts:15`, TinySDF-style: canvas2d
   alpha raster → Euclidean distance transform, pad 6, radius 8,
   1024² r8unorm, ~1 MiB).  The header's claim — "crisp at any zoom
   from one 32px-per-glyph atlas" (:9, restated at
   `shaders.mts:4387-4388`) — is true of the *edge AA* (fwidth-based,
   scale-free) and false of the *letterform*: raster + EDT
   quantization error is baked in SDF px, so it magnifies linearly
   with displayed-px / 32, and single-channel SDFs round every sharp
   corner at ~1 SDF px radius by construction.  At 56 displayed px
   that is ~2 px of visible corner rot; at zoom 1 it is sub-pixel,
   which is why nothing noticed before the maintainer zoomed.
2. v3 rasterizes text per frame at the current zoom (canvas
   `fillText` under the zoom transform), so it is crisp everywhere
   and pays for it on every frame — the design v4 rejected for
   throughput.  The ask is not v3's cost model; it is more fidelity
   from the atlas model, bought cheaply.
3. **The re-raster machinery already exists**: `labelLayer.reraster()`
   re-rasters every cached glyph today when web fonts finish loading
   (`renderer.mts:302-317`, `label-layer.mts:70-72`), and the
   zoom-promotion meter pattern (15.6, `schedulePromotionCheck`,
   `renderer.mts:351`) already watches zoom to re-tier images — the
   two halves of a zoom-tiered atlas are built and shipping.

### 94.1 — measure the two cheap levers, ship the winner

- **Lever A — raise `SDF_FONT_SIZE` 32 → 64** (atlas 1024 → 2048,
  1 → 4 MiB, EDT per glyph 4× on a one-time cost): halves every
  artifact's on-screen size at a given zoom, uniformly, no runtime
  machinery.  Measure the raster stall (the em-web glyph population
  on first frame — the atlas rasters on demand) and the memory.
- **Lever B — a zoom-tiered re-raster**: keep 32 px as the base
  tier; when the promotion meter reports sustained zoom past a
  threshold, re-raster *the glyphs in use* at 64/128 px into new
  shelves and swap runs, exactly as the font-loading re-raster does.
  Costs nothing until someone zooms; costs a visible one-frame
  sharpen when they do (the image promotion tier has the same
  behaviour and it reads fine).
- **MSDF is investigated and expected to be declined**: sharp
  corners at any scale, but a faithful MSDF needs the glyph's vector
  outline, which canvas2d does not expose — raster-derived MSDFs are
  exactly the fragile hand-derived second implementation this repo
  keeps declining.  If declined, the decline is recorded with the
  reason (no-deps rule + fidelity risk), per house practice.

The round ships A, B, or A+B based on measured quality-per-cost at
zoom 3–6 over the labels fixture; the quality judgement is a
close-up golden set, the cost judgement is the label benches plus
first-frame timings.

**Verified by** close-up label goldens (zoom 4, the round-56 tier —
which today has **no zoomed label scene**, itself a gap this round
closes) regenerated intentionally; a live parity diff against v3 at
zoom 4 with a bound the pre-change render measurably fails (run the
control: today's render must exceed the bound, or the scene is not
discriminating); the soak tier watches atlas growth if B ships
(shelf churn across zoom cycles must plateau, not grow — the leak
gate's reachability rule applied to texture shelves).

### Risks named at planning

- Every label golden regenerates if A ships (the raster changes
  everywhere); read the diffs, per the exact-golden rule.
- B's swap must not tear mid-frame (runs re-point atlas UVs while a
  frame is in flight) — the font-loading re-raster already solves
  this; reuse its sequencing, do not invent a second one.
- The 'g'-descender deformation seen in the repro may be quad/pad
  clipping rather than SDF error (outline width eats into the 6 px
  pad) — check `SDF_PAD` against the worst outline before choosing
  levers, since a clipped quad no tier fixes.
- dpr interacts: a dpr-2 display at zoom 2 already shows 4× — 91.2's
  live dpr work makes the meter's input honest; land 91 first or
  meter on displayed px directly.

**Open:** the tier thresholds and count for B (recommended: one
extra tier at 64 px triggered near displayed 40 px, judged on the
goldens); whether the atlas grows to 2048 in both levers (A: yes by
necessity; B: only on first promotion).

### Landed (2026-08-28)

**Lever B shipped; A and MSDF declined on measurement.**  The atlas is
zoom-tiered: `GlyphAtlas.setTier` rasters at `SDF_FONT_SIZE × tier`
with pad and encoded radius scaled together, so the SDF halo and the
field's em-span are tier-invariant and the outline-width conversion
needed no change.  Metrics normalize back to base-tier SDF px —
layout, the shaping memo and the run scale math never see the raster
resolution (pinned headless: a leaked raster px is a strict spec
failure).  One extra tier at 64 px, as recommended; the texture grows
1024 → 2048 (1 → 4 MiB) only on first promotion, answering the open
question — and the bind-group cache keys on a new atlas `generation`,
since the texture object is the one identity the promotion replaces.

**The meter.**  `LabelLayer.maybePromote(zoomDpr)`: monotone max label
font size × displayed device px per model px (zoom × dpr,
render-scale-free like the label LOD thresholds — 91.2's live dpr
landed first, so the input is honest on density changes), threshold
`LABEL_PROMOTE_PX = 40`.  It runs on the image meter's own
settle-debounced timer (never per wheel tick), *and* — a gap the round
found — on arrival: construction sets the viewport without firing a
viewport event, so a graph built already zoomed never promoted until
the label layer learned to flag a process() pass that raised its max
font size (the 15.6 fresh-upload rule applied to text).  Image exports
promote at the export scale in `exportFromView`, both same-thread and
worker paths; the export frame's process() rebuilds the runs before
the encode.  Promotion is **one-way**: a promoted atlas draws zoom 1
identically, so demotion would buy back 3 MiB at the price of shelf
churn on zoom cycles — the soak concern dissolves by construction, and
the plateau is pinned (twenty zoom cycles after promotion create no
further textures).  `stats().glyphAtlasTier` publishes the state; the
swap reuses the font-loading re-raster's sequencing verbatim (atlas
reset + shaping-memo clear + markAllLabelsDirty, rebuilt by the next
frame's process() before anything draws), per the plan's tear risk.

**The costs, measured.**  EDT per glyph 0.19 ms base, 0.41 ms promoted
(2.1× for 4× the pixels — the O(n) transform's per-pass overhead
amortizing; two new rows in `benchmark/labels.mjs` price a 96-glyph
em-web-sized population at ~18 vs ~39 ms).  Lever A would have moved
that 4× onto every graph's first paint and 4 MiB onto every graph, for
identical zoom-4 quality — declined and recorded.  MSDF declined as
planned (no vector outline from canvas2d; a raster-derived MSDF is the
fragile second implementation the no-deps rule exists to refuse).  In
the debug harness (`?network=labels`, 209 glyphs, SwiftShader) the
promotion lands 258 ms after the zoom settles and the sharpen frame's
cpuFrameMs is 16.7.  The pad risk note was checked and held: the
outline clamp (0.45 × SDF_RADIUS = 3.6 SDF px) sits inside the 6 px
pad at every tier, so the 'g'-descender deformation was SDF error, not
quad clipping — confirmed by the promoted render.

**Verified by** — each control run and failing on cue:

- `test/modules/glyph-atlas-tier.mjs` (10 specs over a fake
  proportional-metrics canvas): tier-free metrics, the 2048 growth +
  generation bump + old-texture destroy, double-resolution cells in
  the grown uv space, no-op same-tier setTier, the texture plateau,
  and the meter (under-threshold no-op; promotion re-lays every run at
  an unchanged model size, budgeted at the raster's own ceil
  quantization; one-way including never demoting; monotone across
  removals).  Five controls: un-normalized advances, no generation
  bump, a two-way meter (whose first draft hid behind canPromote and
  failed nothing — itself the testing note's lesson, rebuilt until it
  bit), promotion without markAllLabelsDirty, churning setTier.
- `parity-closeup-labels`, the close-up tier's first label scene:
  letterform-dominated by construction (2 px invisible nodes, short
  descender/corner-rich words wholly on frame, 24 px font at zoom 4 =
  96 displayed px, both sides on the pinned Open Sans — parity.html
  gains the @font-face).  The placement policies differ by design and
  the ~0.28 em block-centering offset out-signals the letterforms
  (measured 11.3% mismatch dominated by it, tier-invariant), so the
  scene compensates with text-margin-y −6.75 and what remains is glyph
  shape.  Promoted **0.112%**, the tier-1 control **1.202%**, bound
  0.4% — the pre-round render fails it 3× over, as the plan demanded.
  A promoted-but-soft raster control reads 18.3%.  A finding for the
  suite: the diff's AA-exclusion classifies sub-2 px softness as
  antialiasing, so the raw ratio *under-weights* exactly this defect
  until displayed px push the error into multi-pixel structure —
  which is why the scene runs at 96 displayed px rather than zoom 4
  over 14 px text.
- `labels-zoom-closeup`, the round-56 tier's first zoomed label golden
  (14 px labels at zoom 4, built already zoomed, so it pins the
  arrival promotion too), exported only after `stats()` reports tier 2
  — `waitForAtlasTier`, because frame-count exports race the 250 ms
  settle meter.  `label-outline-closeup` gains the same wait and
  regenerated: read against the old PNG, the move is exactly the
  sharpen.  Every other golden is byte-stable across the full visual
  project (130 specs) — the base-tier raster path is arithmetically
  unchanged.
- The renderer spec drives the meter through public stats: no
  promotion at zoom 1 (bounded wall-clock control past the debounce),
  promotion after zoom 4 settles, unchanged glyph count across the
  swap, no demotion on zoom-out; with the threshold disabled at source
  the spec fails on cue.

**Deviations from the plan.**  The zoom-promotion meter was not
extended from `promoteVectors` itself (its demand walk is per-image
column data); the label half shares the *timer* and the settle
semantics, and the label layer owns its own one-line meter — same
pattern, no second debounce.  The close-up parity scene runs its
letterforms at 96 displayed px via a 24 px font at zoom 4 rather than
14 px text, for the AA-exclusion reason above; the 14 px case is
carried by the golden instead.
