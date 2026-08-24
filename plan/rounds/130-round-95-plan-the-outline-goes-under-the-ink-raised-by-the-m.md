## Round 95 plan — the outline goes under the ink (raised by the maintainer 2026-08-18)

The maintainer: label outlines overlap the previous characters of a
word, cutting white notches into the letters.  Reproduced at zoom 1
(the notches are visible in 'Wavelength' at 14 px) and worse zoomed.
Mechanism, pinned:

1. **v4 computes fill and outline in one fragment pass per glyph
   quad** (`src/render/shaders.mts:4426-4435`: fill alpha from the
   0.5 threshold, outline from `0.5 − outlineWidth`, maxed) and
   alpha-blends the quads **in glyph order**.  Glyph quads overlap
   by construction — each carries the SDF pad halo (6/32 of the em)
   past its ink, and advances are narrower than ink + 2×pad — so
   glyph N's opaque outline ring composites *over* glyph N−1's
   already-blended fill.  The notch is the next letter's white ring
   biting the previous letter.
2. **v3 never composites a stroke over a fill within a line**: it
   draws `strokeText` for the whole line, then `fillText` over it
   (`v3/src/extensions/renderer/canvas/drawing-label-text.mts:
   399-413`) — all outline under all ink, per wrapped line.
3. The fix is therefore a **draw-order** fix, not a shader-math fix:
   outline first for the run, fill second.  The label pipeline draws
   one indirect instanced pass off the culled glyph list
   (`label-pipeline.mts:185-205`); a phase uniform (outline-only /
   fill-only thresholds in `fsLabel`) turns that into two passes
   over the same instances with no new buffers.

### 95.1 — the two-phase label draw

Pass 1 renders outline coverage only (skipped entirely — one branch
on a per-frame flag — when no visible label carries an outline);
pass 2 renders fill (plus outline-under-fill mixing as today for the
colour, minus the max that lets a ring beat ink).  The granularity
question is the one real decision: **global two-phase** (all visible
labels' outlines, then all fills) is one extra draw call and matches
v3 everywhere except where two *different* labels overlap — there v3
draws label B's stroke over label A's ink and v4 would not.  Per-run
phases inside one pass would match v3 exactly but breaks the single
instanced draw into per-run draws, which is the label pipeline's
whole cost model.  Recommended: global two-phase, deviation recorded
(overlapping distinct labels are already unreadable in both
libraries; within-word legibility is what the defect is about).
Text-background quads (`solid` path, :4393-4423) stay in the fill
pass under both phases — they already draw under their own run.

**Cost, priced before landing**: the second pass doubles label
vertex work and rasterized quads only when outlines are in use, and
only for the visible set the cull already produced.  Measure on the
labels-heavy bench scene with outlines on and off; the
outline-free path must measure unchanged (the flag skips pass 1
before any GPU work).

**Verified by** a golden of an outlined multi-word label (today's
render fails it — the notches are pixels, so the control is the
diff itself), a close-up golden at zoom 4, and a live parity diff
against v3 on the same scene with the bound tuned per round 55's
lesson (dark ink, contrasting outline, several words — the
configuration that *exposes* the defect, since same-colour outlines
paint over it); plus the standing drive of `?network=v3-default`,
whose edge labels all carry `text-outline-width: 2`.

### Risks named at planning

- Every outlined-label golden regenerates; the label parity bounds
  retune downward, never up.
- The fill pass must keep the outline *colour* mixing at the glyph
  boundary (the `mix(outlineColor.rgb, color.rgb, fillA)` term) or
  edges get a dark AA fringe on light outlines — the phase split
  changes coverage, not the colour math.
- Edge labels ride the same shader (`EDGE_LABEL_SHADER`,
  :4442-4443) — both pipelines take the phase, or edge labels keep
  the notch.
- Rotated labels overlap differently; one golden rotates (v3-default
  has the 38°/45° pair ready-made).

**Open:** whether pass 1 also underlays the text-background quad
order (v3 draws background under both; v4's solid path already does
— confirm, don't assume); whether the per-run exact-parity variant
is worth a follow-up if a real scene surfaces the distinct-label
case (recommended: no, record it).

