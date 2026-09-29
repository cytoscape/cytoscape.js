## The small style wins bundle

Four items gathered from the demand log.  Planning re-read the
sources rather than the demand's sentences, which mattered twice:
the gradients item is **already landed** — round 13 C2 shipped the
whole surface the demand asks for, with a golden and a *live v3
parity scene*, because v3 has had `background-fill`/`line-fill`
gradients since 3.6/3.7 and the demand's premise that they have no
v3 counterpart is itself stale — and the screen-space-sizing item
is bigger than a bundle slot.  What the code does today, verified:

1. **Gradients exist.**  `background-fill`
   (solid | linear-gradient | radial-gradient) with
   `background-gradient-stop-colors`/`-positions`/`-direction`
   (`src/style.mts:812-814`) and `line-fill` with stops along the
   drawn span (`src/style.mts:903-904`), packed into the
   `node.gradient`/`edge.gradient` Uint32Array×8 columns with the
   recorded 5-stop cap (`src/contract.mts:565-575`); sRGB
   interpolation, stop lists constants-only, enums mapper-capable
   (`src/README.md:853-862`).  Pinned by the `gradients` golden
   (`playwright-tests/visual.spec.js:2211`) and a live parity
   scene that drives *v3's own* gradient props
   (`visual.spec.js:5996`).  What does not exist: no benchmark
   row prices the gradient fragment path, anywhere.
2. **`text-border-style` is the one honest gap.**
   `text-border-width`/`-color`/`-opacity` exist
   (`src/style.mts:874-876`) and draw in `fsLabel` as a band
   inward from the padded box on solid quads
   (`src/render/shaders.mts:4411-4419`); the style keyword is
   recorded not-yet (`CHANGELOG.md:244`, `MIGRATING.md:314/548`)
   by round 38's deliberate docs-first call
   (`src/README.md:4042`): the label box is a different pipeline
   and node-border dashing made nothing free there.  The solid
   quad's shape id rides `uv1.x` (`shaders.mts:4379`); `uv1.y`
   appears unbound on solid quads (`glyph-buffer.mts:219` — the
   spare lane a style id would take; **to-verify** at
   implementation).
3. **Screen-space sizing touches every model-px reader.**
   `boundingBox()` reads `node.size` in model px
   (`src/collection.mts:2899`) with labels *in* the box by
   default (round 16.4, `collection.mts:2846`); `fit` derives
   zoom from that box (`src/core.mts:1754`) — a screen-px
   element's bounds depend on zoom, so fit becomes a fixpoint
   problem.  The GPU cull computes extents as size × zoomDpr and
   bakes the label LOD floor as a zoomDpr threshold
   (`src/render/cull.mts:153,189,389-419`); the CPU pick scales
   model sizes by zoomDpr per candidate
   (`src/render/cpu-pick.mts:106-107`); arrow trims and curve
   geometry consume `edge.width` model px per vertex.
4. **Ledger 23's arithmetic, re-derived.**  `edge.arrowShapes`
   holds arrow-scale ×16 in bits 24..31 with bits 18..23 reserved
   (`src/contract.mts:374-397`); the measured cost is 1.8% on
   every arrow quantity at `arrow-scale: 1.4` (ledger item 23).
   The round-56 SHOWS_LINE flags live at bits 18/19 **of the
   mirror copy only**, and the contract already warns they move
   if the reserve is spent (`contract.mts:400-427`).  The part
   the ledger does not spell out: a full 14-bit ×128 spend uses
   all 32 bits (16 id + 2 hollow + 14 scale) and leaves the
   mirror word *no room* for its two flags; a 12-bit ×64 spend
   (bits 20..31) keeps mirror 18/19 free and still quarters the
   error.

### 76.1 — gradients: the stale item closed honestly

No new props.  Scope: sweep the three demand issues
(#2091/#3407/#2207) against the shipped surface and add the
MIGRATING/CHANGELOG sentences that close them; correct the demand
log (v3 *has* gradients — the parity scene is the proof); add the
missing measurement — a render-bench pair scene, solid vs
gradient fills at the 25k size (`benchmark/render-bench.mjs`, the
solid/dashed hexagon-border pair's shape at :121-133; compare
device rows).  **Measure-first gate:** the pair *is* the gate —
the border precedent says a fragment premium may be unmeasurable
at scene level; record the number either way.  A close-up scene
is deliberately declined: a gradient error is a ramp, not a
boundary effect, so magnification buys the diff nothing — record
the reasoning.  Batch the bench edit with 80.3's scene (below) so
the renderer fingerprint moves once.  Files:
`benchmark/render-bench.mjs`, `benchmark/render-bench.html`,
`MIGRATING.md`, `CHANGELOG.md`, `src/README.md`.

### 76.2 — screen-space sizing: read, decide, split

The reading supports a split, and this pass says so.  The
knock-ons are structural, not shader-local: the bb/fit fixpoint
(a screen-px element's box must either evaluate at the current
zoom — making `boundingBox()` zoom-dependent, a semantics change
`fit`/`animate` and every caller inherits — or stay excluded the
way v3 excluded labels), a per-element branch in the cull
kernels, the CPU pick's scale term, the baked label LOD
thresholds, and every per-vertex consumer of `edge.width`.  That
is a round, not a bundle slot.  76.2 delivers the design for the
sitting: property scope proposal (**first tranche: `font-size`
only** — fixed-px labels are the bulk of #789's nineteen
comments, and labels are the one surface with an existing
exclusion story; node size/edge width follow only if the label
round proves the bb rule), and the API shape — per-property unit
(a `'12 screen'` suffix string, the `'N%'` precedent; no
functions, the serializable-sheet rule) versus a per-sheet flag —
plus the bb rule choice.  The implementation is proposed as its
own round with this skeleton attached.  Nothing else lands in 76.

### 76.3 — `text-border-style`

Parse v3's enum (solid | dotted | dashed | double) into a
computed field, carry it to the solid-quad glyph record (the
spare `uv1.y` lane; if occupied in fact, the record grows a word
— measure the glyph-buffer size cost first), and give `fsLabel` a
dash-gated perimeter coordinate for the rect/round-rect box —
round 38's closed-form tier shape, and the easy tier only: no
polygon case exists here.  Derivatives hoist above the branch
(the chart-FS uniformity rule).  Dash constants come from reading
v3's `drawText` source, not from assumption; if v3's `double` is
degenerate the way its outline double is
(`src/README.md:4035-4038`), record and match.  Verification: a
golden with all four styles on labeled nodes and edges; a live
close-up parity scene vs v3 at zoom ≥ 2 (round 38's lesson: at
zoom 1 a solid border reads within a percent of a dashed one)
with a feature-off control past the bound; Node specs for
parse/readback/throw.  No new bench row — dash-gated label-box
fragments are a smaller frame share than the hexagon-border case
that already measured unmeasurable; the record says so.  Files:
`src/style.mts`, `src/render/glyph-buffer.mts`,
`src/render/shaders.mts`, `test/` label specs,
`playwright-tests/visual.spec.js`, `MIGRATING.md`, `CHANGELOG.md`.

### 76.4 — ledger 23, forced

This round puts the reserve on the sitting's table with the costs
priced, and item 23 closes whichever way it goes.  (a)
**De-quantize**, two flavors: 14-bit ×128 (0.11% error; evicts
the mirror's two SHOWS_LINE flags, which then need a new home —
none is free in `edge.width`'s two lanes) or 12-bit ×64 (bits
20..31; ~0.4% error; mirror flags stay put; bits 18..19 remain
reserved).  Branch plan: repack `ARROW_SHIFT_SCALE`,
`packArrowShapes`, the shader unpacks, the mirror derivation; the
routing ledger's two-sided bands **fail by design** and force the
re-measure (the item's own note); arrow goldens regenerate —
diff-read first, exact-goldens rule.  (b) **Hold the span for a
17th arrow shape**: verified, no candidate shape is named
anywhere in the ledger or the demand log — evidence the sitting
weighs, not a decision.  (c) **Leave it**: 1.8% is sub-pixel at
most zooms; zero cost.  **Measure-first gate:** before any
repack, re-run `routing-ledger.mjs` and confirm the residuals
still center where round 56 left them.

### Risks named at planning

- Goldens are exact; branch (a) moves every arrow golden with a
  non-representable scale — regenerate deliberately, never widen.
- `fsLabel` gains a non-trivial branch: derivatives before
  non-uniform control flow, or the device-error guard fires.
- Two render-bench scene additions this round (76.1, 80.3) —
  batch them so the `renderer` fingerprint moves once.
- The stale-item lesson: 76.1's record must correct the premise
  (v3 has gradients) so no future round re-plans this.

**Open:** the ledger-23 call itself (a/b/c — and within (a), the
12-bit flavor that keeps the mirror flags vs the 14-bit flavor
that moves them); whether the screen-space round is approved, its
API shape (unit suffix vs sheet flag) and the bb rule
(zoom-evaluated vs excluded); whether gradient stop lists should
ever take the `{ data }` passthrough (declined by default — no
named consumer); `text-border-style: double` behavior if v3's
proves degenerate.

**Decided at the eleventh design sitting (2026-09-28):** ledger 23 is
**left as it is** (the 1.8% stays a recorded deviation; PLAN.md item 72,
the arrow-shape review, was raised beside it), so 76.4 has nothing to
repack; screen-space sizing (76.2) **folds into the semantic-zoom
work**, its API shape and bounding-box rule decided there; `{ data }`
for gradient stop lists is **still open** (PLAN.md item 74); if v3's
`text-border-style: double` proves degenerate, v4 **matches it and
records it**.

**Carried in from round 73 (2026-09-29), the WebGL2 constraints.**  The
WebGL2 renderer (round 137) is full parity at alpha and is built after
this round, so what this round draws must port without a redesign: (1)
nothing drawn depends on a compute pass without a CPU path — what the
renderer reads is CPU-canonical or CPU-derivable; (2) a new pipeline's
cull predicate is a pure function of the pulled columns and the frame
uniform, so it can move into the vertex stage, and no draw count exists
only on the GPU; (3) no storage writes from a draw, no atomics in the
draw path, no dual-source blending, subgroups or f16 in a drawn shader;
(4) per-instance data stays within 16 vertex-stage bindings; (5) the
feature lands with a golden that sets its properties, or the parity
project cannot see it.  The reasons and the measurements are in round
73's record.

### The round, as carried out (2026-09-29)

| # | Commit | What landed |
| --- | --- | --- |
| 76.5 | `f60b7e26` | `mid-source/-target-arrow-width` (PLAN.md item 21's width half): parsed like the end widths, bypassable, read back resolved against the edge width; no column |
| 76.3 | `33908c5a` | `text-border-style` on node and edge label boxes; the band re-centred on the box edge; the close-up parity scene and the `label-border-styles` golden |
| 76.1 | `d5a25db9` | the gradient render-bench pair, and the docs that close #2091/#3407/#2207 |
| 76.2 | — | folded into the semantic-zoom work (the sitting); nothing lands |
| 76.4 | — | ledger 23 left as it is (the sitting); nothing to repack |

**The plan's file references, re-checked first.**  Many rounds had
moved the code: the label shader is `src/render/shaders/label.mts`
(not `shaders.mts:4411`), the solid quad is written in
`src/render/label-layer.mts` (not `glyph-buffer.mts:219`), the style
engine's parse/read/write sides are `src/style/*`.  The `uv1.y`
**to-verify** resolved as the plan hoped: the solid quad wrote `-1`
there and the VS only fed it to the atlas uv the solid branch never
samples, so the style id rides it and the 64-byte glyph record did not
grow (no size cost to measure).  Round 80 has not landed, so its 80.3
scene could not be batched with 76.1's; the renderer harness
fingerprint moves once, here.

**76.5 — the mid width, and what it is.**  Read from v3's
`drawArrowhead`/`drawArrowShape`: `*-arrow-width` is the stroke width
of a *hollow* head (`context.lineWidth` is set only for fill
`hollow`/`both`).  A filled head never reads it, and item 21's call
keeps mid heads filled — so in both libraries it draws nothing.  The
round therefore ported the property, not a picture: constants-only
like the end widths, read back resolved against the stored edge width,
bypassable.  It takes no column (a column that nothing draws would
cost 8 bytes an edge on the GPU); the reader resolves the def's record
patched by the slot's bypass — `ReadContext.bypassPatch` is new for it,
and the control (patch ignored) fails the bypass spec.  **Sheet diff
(round 133): narrow**, with a no-op writer — nothing is stored to
re-derive.  Golden coverage classifies both as no-static-pixels and
the round's golden sets them anyway.

**76.3 — `text-border-style`.**  Dash constants read from v3's
`drawText`: dotted `[1, 1]`, dashed `[4, 2]`, model px; `double` sets
`lineWidth = width / 4`, strokes the box path, then strokes again inset
by `width / 2`.  That `double` is not degenerate (unlike v3's outline
double) — two quarter-width lines with the fill between — and v4
matches it exactly as drawn, the sitting's rule either way.  The dash
coordinate follows v3's path: `rect` from the top-left corner,
clockwise; `roundRect` from one radius along the top edge (easy tier,
no polygon case).  Derivatives: none inside the branch (analytic AA in
device px), so nothing needed hoisting.  **Sheet diff: full pass** (a
label prop; labels have no narrow writer).

*Found and fixed in-round:* B6 drew the text border as a band
*inward* from the padded box, where v3 strokes the box's path and the
band straddles it — invisible until a parity scene existed (B6 had
none, "label parity excluded by design").  The quad now grows by half
the width per side, the FS insets by the same half, under the same
condition; the `label-boxes` golden moved 1.27% of its pixels, all on
the three bordered boxes, regenerated deliberately after reading the
diff.

*Measured:* the close-up parity scene (zoom 3, four rectangle boxes,
text inked in the fill colour) reads **0.384%** against v3, and
**7.509%** with v4 drawing every box solid (the control); bound 0.6%.
Its first two versions read 2.99% / 4.54% with controls at 3.73% /
7.53% — not separable enough.  The diff showed why: v3's box was 0.67
model px wider, and the probe found v3 **rounds a label's measured
width up** (`calculateLabelDimensions`: 'MM' at 8 px, v3 14 against
v4 13.33), which drifted the dash phase by half a dotted period on the
right and bottom sides.  A label of integral width ('M' at 6 px, 4.998)
removed it.  The residue left is the four corners (canvas joins dash
ends through a corner; v4 splits the band on the diagonal) — recorded.

*Recorded deviations of the label box* (MIGRATING's re-check table,
and PLAN.md item 87): v4 draws the box only when
`text-background-opacity` > 0, where v3 strokes a border-only box; v4
keeps its auto round-rectangle radius where v3's `roundRect` uses 2 px;
v4 does not round the text width up.

*Coverage:* Node specs for parse, mapper, bypass, readback and the
throw (`test/label-box.mjs`), and the quad's growth and `uv1.y` with a
control (`test/modules/glyph-atlas-tier.mjs`); the
`label-border-styles` golden — every style on both box shapes and on
edge labels, with the mid heads and their widths.  Golden coverage:
universe 212 → 216, unexercised 75 → **71** (paintable 56 → 52), keyword
gaps 67 → 66.  No bench row, as planned: a dash-gated label-box
fragment is a smaller frame share than the hexagon-border pair that
measured unmeasurable.  The page: the debug harness's labels network
drawn with all four styles on rotated, multiline and autorotated
labels.  WebGL2 (round 73's constraints): no compute input, no new
binding, no storage write; the style is a CPU-written instance field.

*Also found:* `text-transform` reads back from the def alone, so a
mapped or bypassed value reads the sheet's constant while the drawn
text is transformed (which is also why golden coverage lists its
keywords as never shown although `label-boxes` draws uppercase) —
logged as PLAN.md item 86.

**76.1 — gradients, the stale item closed.**  The premise is
corrected in the tenth sitting's line: v3 has had `background-fill` /
`line-fill` since 3.6/3.7 and v4 shipped them in round 13 C2, with the
`gradients` golden and a live parity scene.  The missing measurement
is now a render-bench pair (`gen-25k-fills-solid` / `-gradient`, one
geometry and one set of stop lists, only the fill kind differs).  On
the i9-9900K + RX 580 (`npm run gpu`: HARDWARE), render scale pinned
1, device p50 over two runs: fit-all 3.70 → 3.74 ms, zoomed-in 4.78 →
4.83, far-zoom 0.686 → 0.707, with labels 3.97 → 3.99 and 5.19 → 5.22
— **+0.7% to +3%**, ≈0.04 ms a frame; wall rows on the vsync floor.
The border pair's precedent (unmeasurable at scene level) nearly held:
measurable, negligible.  v3 on the pair goes 632 → 1171 ms a fit-all
frame.  No close-up scene, as planned: a gradient error is a ramp, not
a boundary effect.  MIGRATING and CHANGELOG close the three issues
against the shipped surface.

**Deferred:** nothing of this round's scope.  76.2 and 76.4 were
decided away by the sitting; gradient stops from data stay item 74.

**Gates at close:** `npm run -s test:node:quiet` green (zero output);
`test:types:run` and `test:types:surface:run` green; the `visual`
project 138/138 (every golden exact, every parity scene in bound) and
`renderer` 224 passed, 1 skipped.
