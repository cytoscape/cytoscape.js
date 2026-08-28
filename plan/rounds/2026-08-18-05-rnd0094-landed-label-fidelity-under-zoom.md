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

