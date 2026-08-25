## Style-prop parity

Executed the round-13 plan below under the round-10 process rules.
Each item landed as isolated commits with docs in-commit; the records
below were written per item, in the same commits as the work.

- [x] **A1 Ghost props** (2026-07-31).  `ghost` ('yes' | 'no'),
  `ghost-offset-x/y`, `ghost-opacity` (validated [0, 1]; v3 defaults —
  a ghost is invisible until given opacity) — node-only, all four
  mapper-capable ('case' works for `ghost` as an enum).

  The decided
  simplified form, verbatim: a new `node.ghost` column
  ([offX, offY, opacity, enabled], f32×4) drives a **ghost pass** —
  the node shader gained `vsGhost`/`fsGhost` entry points drawing the
  body (shape, border, background — no accent ring, no hover/grab
  brighten, no labels) at the offset with alpha × ghost-opacity, off
  its own cull stream (a new 'ghost' cull kind: node SHOWN + enabled +
  visible opacity + the *offset* quad on screen), drawn after
  edges/arrows and depth-tested 'less' at NODE_Z so ghost fragments
  under opaque node interiors are killed — exactly v3's
  node-over-ghost layering, for free off the early-z prepass.
  Zero-cost when unused: the store tracks a live ghost-enabled count
  and the renderer skips the ghost cull + draw entirely at 0.  Ghost
  offsets are geometry: both bb scans (store fit + collection) grow by
  the offset body when enabled.  Deviations, recorded: ghosts are not
  pickable (v3 same — decoration only), and box selection ignores
  ghost extents (v4's `refsInBox` tests the body box only).  8 Node
  specs (`test/ghost.mjs`), a `webgpu` spec (ghost at the offset,
  not pickable, follows drags on-GPU, old spot clears), a `ghost`
  golden (three shapes with borders at one offset), and a
  `parity-ghost` live v3 scene — 0.945% mismatch (AA-classification
  seams only; for label-free nodes v3's whole-node ghost redraw *is*
  the body duplicate, so the scenes are directly comparable).  1850
  Node tests, 55 `webgpu` + 30 `visual` specs, typecheck + lint
  green.

- [x] **A2 (nodes): overlay/underlay layers** (2026-07-31).  The 10
  `overlay-*`/`underlay-*` element props for **nodes** (edge layers
  are the next A2 slice): color/opacity/padding mapper-capable,
  shape (`round-rectangle` | `ellipse`) and corner-radius (number |
  `'auto'` — v3's min(w/4, h/4, 8), resolved in the shader from live
  extents) as constants; v3 defaults (opacity 0, padding 10).

  Two
  packed `Uint32Array×4` columns ([rgba folded, padding×256, shape,
  radius×256|auto]) drive one `NODE_LAYER_SHADER` instantiated per
  layer, drawn off a shared 'nodeLayer' cull kind (two CulledGroups,
  each binding its layer's column): the underlay after ghosts and
  under the bodies (depth-tested — early-z hides it under opaque
  interiors, v3's layering for free), the overlay after the bodies.
  Layer opacity folds into the stored alpha (readback follows the
  arrow-color precedent); element opacity does not multiply (v3).
  Padding is geometry: both bb scans grow by the enabled layer's
  pad.  Zero-cost when unused (per-layer live counts gate cull +
  draw).

  Deviations, recorded: v4 overlays draw *under* the label
  layer (v3 draws overlay over its node's label); overlays are not
  pickable and box selection ignores their pads.  8 Node specs
  (`test/node-layers.mjs`), a `webgpu` spec (overlay wash +
  underlay ring), a `node-layers` golden, and a
  `parity-node-layers` live v3 scene at **0 px differing**.  1858
  Node tests, 56 `webgpu` + 32 `visual` specs, typecheck +
  lint green.

- [x] **A2 (edges): overlay/underlay strokes** (2026-07-31).  The
  layer paint props (`overlay-color`/`-opacity`/`-padding` +
  underlay) now apply to **edges** too: the edge geometry re-stroked
  at width + 2 × padding (pre-derived at style-write into packed
  `Uint32Array×2` columns — [rgba folded, strokeWidth×256] — so the
  layer shaders need no width binding), the underlay under the
  edges, the overlay over edges + arrows, both under the nodes
  (v3's layering).

  New `vsEdgeLayer`/`vsCurvedLayer` entry points
  ride the *existing* edge/curved visible lists with a VS collapse
  for disabled instances (no new cull kind; per-layer live counts
  gate the draws — zero cost when unused); the curved layer draw
  has its **own bind group layout** that omits the widths column —
  pipeline *layouts* count against the per-stage 8-storage-buffer
  limit even for bindings a shader never references, which the
  Playwright console-error guard caught as an invalid-pipeline
  cascade on the first cut.

  Haystack offsets and the
  straight-triangle taper apply to layer strokes too; layer strokes
  are solid (no dashes) with butt caps where v3 rounds stroke ends —
  a recorded deviation confined to the ends.  `overlay-shape`/
  `-corner-radius` stay node-only (v3 ignores them on edges; v4
  rejects them).  Edge-layer readback: color folded, padding =
  (stroke − width) / 2.  Node-layer suite extended (edge cases);
  an `edge-layers` golden (straight + taxi + loop under both
  layers) and a `parity-edge-layers` live v3 scene at 2.047%
  mismatch (the caps + AA).  1858 Node tests, 90 Playwright specs,
  typecheck + lint green.

- [x] **A2 (core): selection-box + active-bg theming** (2026-07-31).

  The sheet gains an optional **`core` group** — the v4 home for v3's
  core-selector props, constants only (there is no element to map
  over): `selection-box-color`/`-opacity`/`-border-color`/
  `-border-width` theme the DOM selection box (previously hardcoded ≈
  v3 colors; now v3's exact defaults — #ddd at 0.65 with a 1px #aaa
  border — applied per show, so a sheet swap restyles the next box),
  and `active-bg-color`/`-opacity`/`-size` drive the **background-grab
  indicator**: v3's active-bg circle, shown at the press point while
  the background is grabbed (v4 implements it as a DOM circle above
  the canvas, like the selection box — a recorded implementation
  note: v3 draws it into the canvas, so it never appears in v4
  exports), radius = active-bg-size screen px (v3's size/zoom-in-model
  ⇒ screen-fixed rule).

  A2 is now **complete** (nodes + edges +
  core).  4 Node specs (`test/core-style.mjs` — defaults,
  camel/kebab parsing, sheet-reset, throws) and a `webgpu` spec
  (themed box colors mid-drag; the circle appears on a background
  press at 2×size px and hides on release).  1862 Node tests, 91
  Playwright specs, typecheck + lint green.

- [x] **B1 Opacity split** (2026-07-31).  `background-opacity`,
  `border-opacity` (nodes), `line-opacity` (edges) and `text-opacity`
  (both groups) land as **write-time folds** into the stored channel
  alphas — no new columns, no shader changes: fill alpha ×= bg
  opacity, border ×= border opacity, line ×= line opacity, and the
  label sidecar folds text-opacity into the text/outline/background
  alphas alike (v3's parentOpacity).

  Element `opacity` stays its own
  column multiplied in the FS, so v3's effective = channel × element
  holds; the arrow fold gains the line-opacity factor (v3's
  `effectiveArrowOpacity = opacity × lineOpacity`), threaded through
  `foldedArrow`, the kernel's constOpacity, and the edge-opacity
  tween's arrow targets.  All four are mapper-capable
  (CPU-evaluated).  GPU-eval interplay, the recorded scope note: a
  non-1 (or mapped) channel opacity **demotes that color channel's
  kernel eval to the CPU path** — the kernel would overwrite the
  folded bytes — via a `paintInputs` exclusion (a mapped line-opacity
  also demotes the arrow colors).

  Early-z stays sound for free: the
  prepass already discards nodes whose stored fill alpha < 1.
  Readback is folded (stored alpha / 255 — the outline/arrow
  precedent), and a line-transparent edge reads its arrows as 'none'.
  7 Node specs (`test/opacity-split.mjs` — folds, mappers, the
  kernel demotion, ranges) and a `parity-opacity-split` live v3
  scene at 0.934% mismatch (translucent AA seams).  1869 Node tests,
  92 Playwright specs, typecheck + lint green.

- [x] **B2 border-position + corner-radius** (2026-07-31).  One new
  `node.borderGeom` column ([cornerRadius | −1 = auto,
  borderPosition]).  `border-position` (center | inside | outside —
  and **v4's default flips to v3's `center`**: the border band now
  straddles the boundary, [−bw/2, +bw/2]; v4 had silently drawn all
  borders inside, an unrecorded deviation this closes — parity-basic
  fell 0.766% → 0.072% and parity-transform 0.486% → 0.238% on the
  spot).

  `corner-radius` (number | 'auto') feeds the
  round-rectangle SDF everywhere the radius appears — node FS, ghost
  FS, the depth prepass' interior test, and the CPU pick replica —
  with **'auto' now v3's min(w/4, h/4, 8)** (v4 had used
  min(w, h)/8; also closed).  The node/ghost quads, node cull and
  ghost cull grow by the border's outward extent (the ghost cull
  uses the full border width — the compute stage had no slot left
  for the position column; conservative only).  Both props are
  mapper-capable (enum/number, CPU — geometry tier: the pick reads
  them).  bb keeps the outerHalf center convention for all positions
  (v3's outerWidth does the same — recorded).

  Caught by the guard
  en route: the first ghost-cull cut hit 9 compute storage buffers.
  4 goldens regenerated as the intended visual change
  (nodes-edges-arrows, polygon-shapes, selection-accent, ghost); a
  new `parity-border-geom` scene (three positions × explicit radii)
  measures **0 px differing**.  4 Node specs
  (`test/border-geom.mjs`) + the CPU-pick suite pinned to the
  new auto rule.  1873 Node tests, 93 Playwright specs, typecheck +
  lint green.

- [x] **B3 line-cap + dash patterns** (2026-07-31).
  `line-dash-pattern` (constants-only list, normalized to two on/off
  pairs — odd patterns double per canvas semantics, longer ones
  truncate, a recorded cap), `line-dash-offset` and `line-cap`
  (butt | round | square; cap + offset mapper-capable) land in two
  columns (`edge.dashPattern` f32×4, `edge.dashMeta` [offset, cap])
  bound fragment-side on both edge pipelines.

  The dash mask became
  a proper 2D coverage: `dashInsideSd` (signed model-px distance
  inside the nearest on-segment, wrap-exact) + `dashCoverage` —
  butt is the plain product (pixel-identical to the old mask, so
  the pre-B3 goldens held), round is a capsule about the segment,
  square extends each dash by the half width.  Dashed edges use the
  per-edge pattern (v3); dotted stays [1, 1]; triangle fills ignore
  line-style (v3).

  **A dash-phase deviation found and fixed**: v3
  launches the pattern at the *source boundary* while v4's straight
  edges measured u from the node center — the straight VS now
  subtracts the source boundary offset (haystack lines keep their
  offset-point origin, matching v3's haystackPts), taking the new
  `parity-dash-props` scene (pattern + offset + all three caps)
  from 2.501% to **0 px differing**.  Caught en route by the Node
  WGSL-identifier guard's runtime sibling: `meta` is a WGSL reserved
  word.

  Line-end caps are dash-segment-only (quads don't extend
  past the endpoints; v3's default butt behaves identically) — a
  recorded deviation.  6 Node specs (`test/dash-props.mjs`);
  the line-styles golden regenerated for the intended phase shift.
  1879 Node tests, 94 Playwright specs, typecheck + lint green.

- [x] **B4 edge casing** (2026-07-31).  `line-outline-width`/
  `line-outline-color` ride the A2 layer machinery verbatim: an
  `edge.casing` column in the layer record layout ([rgba folded by
  v3's effectiveLineOpacity = opacity × line-opacity,
  strokeWidth×256 = width + outline width — v3's lineWidth]), drawn
  by the existing `vsEdgeLayer`/`vsCurvedLayer` entry points between
  the edge underlay and the edge line, on every family (haystack
  offsets and the triangle taper included).  Both props
  mapper-capable; zero-cost when unused (casingCount gating).

  A
  kernel-owned element opacity would leave stale casing bytes, so an
  enabled (or mapped) casing demotes the `opacity` mapper to the CPU
  path — the B1 exclusion list extended.  `parity-casing` (straight
  + bezier pair + taxi under an 8 px casing) measures **0.061%** —
  the recorded butt-vs-round stroke-end deviation only.  5 Node
  specs (`test/edge-casing.mjs`).  1884 Node tests, 95
  Playwright specs, typecheck + lint green.

- [x] **B5 node outlines** (2026-07-31).  `outline-color`/
  `-opacity`/`-width`/`-offset` (solid only — `outline-style` stays
  out with `border-style`, the perimeter-parameterization limit).
  The `node.borderGeom` column widened to `Uint32Array×4`
  ([radius×256 | auto, position, outlineRgba (opacity folded),
  width×256 | offset×256 ≪ 16]) — the node FS sat at exactly 8
  storage buffers, so the outline packs into the existing binding.

  The ring renders as a second disjoint SDF band at
  `borderOutward + offset/2` (v3 strokes a path scaled by
  (size + bEff + width + offset)/size, which reduces to exactly
  this band for circles/squares — pinned by `parity-outline` at
  **0 px** including an offset-10 case and a bordered case;
  anisotropic shapes deviate from v3's scaled-path stroke by
  construction, recorded).  Ghost bodies draw their outline too
  (v3).  Node quads/cull grow exactly; the ghost cull grows by the
  new monotone `outlineSlack()` via the Frame's last pad (no
  binding left there); both bb scans grow by offset/2 + width.

  All
  four props mapper-capable; readback folded/packed.  5 Node specs
  (`test/node-outline.mjs`); the B2/CPU-pick suites re-pinned
  to the packed format.  1889 Node tests, 96 Playwright specs,
  typecheck + lint green.

- [x] **B6 label box parity** (2026-07-31).  `text-transform`
  (none | uppercase | lowercase — applied at glyph-run build, as v3
  transforms before measuring), `text-border-width`/`-color`/
  `-opacity` (a band drawn inward from the padded background box —
  the bg quad's unused outline instance fields carry the border, so
  the glyph layout is unchanged) and `text-background-shape`
  (rectangle | round-rectangle, v3's auto radius — the shape flag
  rides the solid quad's free uv1.x).  The label FS's solid branch
  became a proper quad SDF (corner-space + quad-size varyings), so
  round boxes and borders AA exactly; all five props are
  mapper-capable and stored-truth readback follows the folded rule.

  `text-border-style` stays out with the other dash-a-boundary
  styles.  **No live v3 parity by design**: label raster *and*
  placement differ from v3 (the round-9.6/9.7 decisions), so the
  visual pin is the label-tier `label-boxes` golden (uppercase
  transform, bordered box, round bordered box in the fixed web
  font) — v3 comparison for label props is structurally excluded,
  as recorded since round 9.6.  6 Node specs
  (`test/label-box.mjs`).  1895 Node tests, 97 Playwright
  specs, typecheck + lint green.

- [x] **B7 arrow scalars** (2026-07-31).  `arrow-scale` (edge-wide,
  positive; quantized ×16 into the shapes word's top byte — quantized
  readback, recorded), `source/target-arrow-fill`
  (filled | hollow — flags at bits 16/17) and
  `source/target-arrow-width` (px | 'match-line' | %, resolved
  against the edge width at style-write into a new
  `edge.arrowWidths` column).

  Both arrow shaders restructured:
  exact sizing moved to the **fragment stage** — the quad covers the
  frame's monotone `arrowScaleMax` (a Frame pad slot) and the FS
  renders the exact per-edge scale within it, which is what lets the
  curved arrow VS (whose 8 storage-buffer slots were all taken) stay
  untouched; hollow fills render as an `|sd|` ring at the per-end
  stroke width.  Scale/fill are mapper-capable; widths are constants
  (keyword/% forms).

  **No pixel parity vs v3 by design**: v4 keeps
  its own linear arrow sizing (round-10 B4's recorded decision; v3
  uses max((13.37 w)^0.9, 29) with a 29-unit floor), so arrow sizes
  never coincide — the visual pins are the `arrow-scalars` golden
  (scale 2, hollow ends, thick hollow strokes) and a `webgpu`
  hollow-ring pixel spec.  6 Node specs
  (`test/arrow-scalars.mjs`).  1901 Node tests, 99 Playwright
  specs, typecheck + lint green.

- [x] **C1 mid-arrows** (2026-07-31).

  `mid-source/mid-target-arrow-
  shape`/`-color` land exactly as re-triaged: two folded color columns
  plus the mid shape ids packed into the arrowShapes word's free bits
  (18..20 / 21..23 — every ARROW_* id fits in 3 bits), drawn by new
  `vsMidArrow` entry points on both arrow pipelines whose `End`
  uniform generalized to an endId (target / source / mid-target /
  mid-source, four cached bind groups each).  Straight edges anchor
  the tip at the chord midpoint (the haystack *offset* midpoint for
  kind 6 — the straight arrow layout gained the curveParams binding,
  landing at its 8-buffer budget exactly); curved edges reuse the
  label VS's midpoint machinery — the curve midpoint/loop c1→c2
  tangent analytically, `routeMidpointW` for the route families — so
  mid arrows follow drags/layouts/tweens on-GPU like everything else;
  mid-source points backward (v3's midsrcArrowAngle).  Mid arrows are
  always filled at standard width (the mid fill/width props are
  unsupported — recorded), shapes/colors are mapper-capable, stored
  truth reads transparent mids as 'none', and per-edge draws gate on
  a live midArrowCount.  **Fixed en route: a latent round-10 gate bug**
  — the arrow-draw enable checked `shape === 'triangle'`, so constant
  vee/chevron/circle/... sheets never drew arrows at all; now any
  non-'none' shape draws.  (Follow-up, same day: the B7
  `arrow-scalars` golden predated this fix — its scene's constant
  `source-arrow-shape: circle` arrows never drew when the golden was
  generated — so it went stale the moment the gate was fixed;
  regenerated in its own commit once the C3 full-suite run caught
  the 0.931% drift.)  Sizing shares B7's v4-linear formula (no
  pixel parity vs v3 by the recorded B4 decision) — the pins are the
  `mid-arrows` golden (straight + bezier pair + taxi + haystack) and
  a `webgpu` spec asserting purple mid-arrow ink at the CPU-computed
  `renderedMidpoint()` of both a straight and a curved edge.  3 Node
  specs (`test/mid-arrows.mjs`).  1904 Node tests, 100 Playwright
  specs, typecheck + lint green.

- [x] **C2 gradients** (2026-07-31).

  `background-fill`
  (solid | linear-gradient | radial-gradient) with
  `background-gradient-stop-colors`/`-stop-positions`/`-direction`
  (v3's eight `to-*` keywords), and `line-fill` with
  `line-gradient-stop-colors`/`-stop-positions`.  Storage: one packed
  `Uint32Array×8` record per element ([meta kind|dir|count, 5 stop
  colors, packed positions]) — **stops cap at 5** and stop lists are
  constants-only (recorded); fills/directions are mapper-capable
  enums.  Stops interpolate in **sRGB** (the plan's lean: v3's canvas
  gradients; OKLab stays the mapper default), positions spread evenly
  when unset and clamp monotone (canvas semantics), and the channel
  opacity folds into each stop.  Binding budget: the node FS was full,
  so the **shape id folded into borderGeom** (bits 16..19, written
  with the style's other geometry) freeing the shapes binding for the
  gradient record; edge gradients bind fragment-side on both edge
  pipelines, with the drawn span (boundary-to-boundary for straight,
  the polyline arc length for curved) as a new flat varying so linear
  fills run v3's extent and radial fills mirror about the midpoint.
  The depth prepass conservatively discards gradient fills
  (translucent-anywhere); plain-LOD discs keep the flat base color
  (recorded).  `parity-gradients` (three-stop linear on rectangles +
  a gradient line vs v3) measures **0 px differing** — the sRGB lerp
  matches canvas exactly; the `gradients` golden covers directions,
  radial, ellipse and curved-line fills.  6 Node specs
  (`test/gradients.mjs`).  1910 Node tests, 102 Playwright specs,
  typecheck + lint green.
