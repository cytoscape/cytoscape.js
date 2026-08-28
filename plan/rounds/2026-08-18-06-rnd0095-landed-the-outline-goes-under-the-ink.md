## The outline goes under the ink

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

### Landed (2026-08-28)

Landed as planned: global two-phase, the recommended granularity, with
both opens taken as recommended.  The background-quad question was
confirmed rather than assumed — the solid branch draws inside its own
run's fill order, and pass 1 now returns zero for solid quads
explicitly, so the box sits under both phases; the per-run
exact-parity variant is declined and recorded (`src/README.md` carries
the deviation: where two *distinct* labels overlap, v3 strokes the
later label over the earlier one's ink and v4 keeps all outline under
all ink).

**The mechanism, as shipped.**  `LABEL_PHASE` is a pipeline-overridable
constant on the one label shader module — not the phase *uniform* the
plan sketched, and better than it: two specializations of the same
module share the bind groups and buffers outright, and no per-draw
uniform write exists to get wrong.  Phase 1 renders outline coverage
only (zero for solid quads and outline-free glyphs); phase 0 renders
fill, keeping the `mix(outlineColor.rgb, color.rgb, fillA)` boundary
term — the risk note held: coverage changed, not colour math — and
dropping the `max()` that let a ring beat ink.  The outline pipeline
compiles lazily on the first outlined draw.  The per-frame flag is a
per-stream count the GlyphBuffer maintains across set/replace/clear/
compact (solid quads excluded — their outline words are the B6
text-border), pinned by `test/modules/glyph-outline-flag.mjs` because
a stale count fails silently in both directions: stuck-true pays a
second pass every frame, stuck-false erases every outline.

**The cost, priced.**  A `gen-25k-wrap-outline` renderer-bench row
joins the outline-free wrapped-label scene it varies.  On the amd
gcn-4 adapter: the outline-free row is unchanged against the published
13 Aug baseline to the microsecond (fit-all labels 4.555 ms, zoomed-in
labels 5.946 vs 5.948 ms device p50), and the outlined row pays
+0.087 ms (+1.5%) device time at the zoomed-in label view, nothing
measurable at fit-all, where the LOD has faded most glyphs.  Wall
stays at the 16.7 ms vsync floor everywhere.

**Verified by** the planned coverage, each control measured:
`label-outline-words` (three multi-word outlined labels — one rotated
38°, one boxed; dark ink, white outline) fails by 1,984 px (1.653%) on
the pre-95 renderer — the notches are the diff, exactly as planned.
`label-visuals` regenerated (170 px moved on its outlined node's
word); no other golden moved, and the full visual project is green.
`?network=v3-default` drove clean in a scripted browser (206 glyphs,
no device errors), its outlined edge labels intact at zoom 3.

**Two measurements the plan did not predict.**  First, the close-up
tier: the pre-95 render differs by only **15 px** at zoom 4 on the
same words.  At 14 px the requested 2 px outline saturates the 0.45
SDF-unit cap, so the zoom-1 notches are that capped ring's *fwidth
fringe* bleeding into the neighbour's ink — a fringe zoom 4 narrows
fourfold.  The close-up golden stays as a regression pin with a
comment saying exactly what it does not test; the zoom-1 golden
carries the discrimination.  Second, the parity ratio cannot see
outline defects at all through cross-renderer raster noise: the pre-95
notches measure 2.105% against 2.103% fixed, and even zeroing the v4
outline entirely reads 2.097% — a pale outline on the white page sits
under any workable pixelmatch threshold, and a saturated red one
raises ambient to 4.975% without separating either.  So
`parity-outlined-labels` splits the assertion per round 55's actual
lesson: the ratio guards *placement* (ambient 2.103%, bound 2.5% —
tuned downward from the suite's 3%), and outline *presence* is the ink
floor's job — v4 inks 10,840 px with outlines against 4,872 without,
floor 8,000, decisive where the ratio is blind.

