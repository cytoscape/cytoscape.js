## Round 76 plan — the small style wins bundle (planned 2026-08-14)

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
