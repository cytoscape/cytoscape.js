## Round 16 plan — multiline labels + label bounding boxes (planned 2026-08-01)

The multiline/label-bb round the parity triage kept deferring to —
`text-wrap` and friends, plus the labels-in-bb call.  All calls
signed off 2026-08-01.

**Signed-off design calls:**

1. **Labels join `boundingBox()` and `fit()` by default** (v3
   parity — the most user-visible payoff: fit stops cropping
   labels).  `boundingBox(options?)` gains an options object —
   `{ includeLabels: true }` default, unknown keys throw — honored
   by element/collection bb, `renderedBoundingBox`, the store's
   whole-graph scan (no-arg `fit`/`center`), `getFitViewport`,
   animated `fit:`/`center:` targets and `boundingBoxAt`.  Because
   label shaping is **write-eager and memoized** (it runs on
   text/font/wrap writes, never per frame — the model-space
   decision), node-label laid dims sit in the sidecar before any bb
   read: the store scan's node-label term is the anchored laid box
   (cheap and exact).

   Edge labels keep the dual tier: the scan
   uses a conservative anchor bound (chord midpoint / end-offset
   position ± block + margins + curve slack), public `.bb()` the
   exact anchor via the route evaluator.  Goldens whose fits change
   regenerate once, in the landing item (recorded).

2. **The wrap family** (v3 semantics; node labels, edge labels and
   the D4 end-label streams alike): `text-wrap` (`none | wrap |
   ellipsis`, default `none`), `text-max-width` (model px),
   `line-height` (multiplier, default 1), `text-overflow-wrap`
   (`whitespace | anywhere`), `text-justification` (`auto | left |
   center | right`, `auto` side-aware per v3).  `wrap` honors
   embedded `\n` and breaks at `text-max-width`; `ellipsis`
   truncates with `…`; `none` keeps today's single line.  All
   mapper-capable (CPU-evaluated, the label sidecar tier).

3. **Shaping stays CPU — memoized, write-driven.**  One pure module
   (extending `label-layout.mts`): breaker + justification + block
   metrics, keyed by (text, face, font-size, wrap, max-width,
   overflow-wrap, line-height); glyph runs rebuild only on
   shaping-input writes.  The earlier design sketch of a *GPU
   metrics pass* is **retired as unnecessary** (recorded): shaping
   costs ~µs/label and runs on writes only; the offload slot stays
   logged if a profile ever disagrees.

4. **Renderer**: multi-line glyph emission into the existing
   GlyphBuffer ranges (per-line x offsets by justification, y by
   line-height), the text background/border box takes the block
   extent, the `text-valign`/`halign` grid anchors the block,
   autorotate rotates the block as a unit, and the
   fade/`min-zoomed-font-size` cull predicates are unchanged (the
   block AABB grows the cull bound).

5. **The parked props' v4 forms** (from the 2026-07-29 triage):
   `box-select-labels` becomes the core option
   `boxSelectionIncludesLabels` (default false, v3's default) — one
   more term in `refsInBox` off the same laid dims;
   `text-metrics`'s v4 form is the public exact measure
   `eles.labelBoundingBox()` (laid block at the anchor, memoized) —
   an API, not a style prop.

**Pass split** (tests-first per item; docs in-commit):

- [x] **16.0 Docs-first** — landed with the design-sitting commit
  (`0f0ee859`), before any round-16 implementation.
- [x] **16.1 Shaping engine** (2026-08-01) —
  `src/label-wrap.mts`: `breakLines` (v3's `text-wrap` semantics —
  `none` collapses newlines, `wrap` honors `\n` + greedy word wrap
  with `whitespace` overflow vs `anywhere` mid-word splits,
  `ellipsis` truncates one line with '…'), `layoutLabelBlock`
  (lines stacked by lineHeight × em, justified inside the block,
  block centered about x = 0), and **`estimateBlock`** — the same
  breaking logic over flat per-char advances, which is what keeps
  the 16.4 label bb meaningful *headless*: the store estimates dims
  with no renderer, and rendered instances upgrade them to exact
  laid dims (a recorded approximation).

  Advances are injected, so
  one breaker serves both consumers by construction.  11 Node specs
  in `test/label-wrap.mjs`.  2096 Node tests, typecheck + lint
  clean.  (The memo lands with the LabelLayer integration in 16.3,
  where the atlas-keyed cache lives.)
- [x] **16.2 Props + sidecar** (2026-08-01) — the five wrap props
  parse/read back/map with v3's keyword sets and defaults
  (`text-wrap` none | wrap | ellipsis, `text-max-width` 9999,
  `line-height` 1, `text-overflow-wrap` whitespace | anywhere,
  `text-justification` auto | left | center | right); all five are
  mapper-capable (the sidecar tier), both label groups.  The
  sidecar entry stores the **resolved** justification (auto folds
  against `text-halign` at write — v3's hanging-label rule; edges
  center) while `style('text-justification')` reads back the
  declared value incl. 'auto', as v3.

  **Label dims live in the
  store** (`labelDimsAt`/`setLabelDims`, per stream): `setLabel`
  estimates immediately via `estimateBlock` — the headless bb
  input — and the renderer's glyph build upgrades to exact laid
  dims (never marking label-dirty — no rebuild loop); dims changes
  bump the geometry epoch, since labels join bounding boxes in
  16.4.  `label-wrap.mts` moved to the gpu root (a dual-consumer
  module, the curve-geometry precedent).  One historical pin
  updated: gpu-style's unsupported-prop example was `text-wrap`,
  which now exists — it pins `background-blacken` (dropped by
  decided design) instead.

  Tests-first: 10 specs in
  `test/text-wrap-props.mjs` red then green — 2106 Node tests,
  typecheck + lint clean.
- [x] **16.3 Renderer** (2026-08-01) — LabelLayer lays every stream
  through `layoutLabelBlock` behind the **shaping memo** (keyed on
  text + scale-free wrap params, cleared with the atlas face — hit
  counters exposed for the 16.5 benchmark), feeds **exact laid
  dims** back to the store per build (the 16.4 bb term's upgrade
  path), and switched the alignment shifts + text-background box
  from ink extents to **block metrics** (advance width ×
  line-stacked height — ink undershot multi-line blocks); the
  change stayed within the label goldens' tolerance, so no golden
  churn.

  Autorotate needed nothing: glyphs rotate about the anchor
  individually, so a multi-line block rotates as a unit by
  construction.  Pins: the `labels-wrap` golden (three-line wrap
  under left/center/right justification via mappers, ellipsis
  truncation, unwrapped control) and `labels-wrap-edge` (a two-line
  autorotated edge label with its block-sized box).  2106 Node
  tests, 131/131 Playwright, typecheck + lint clean.
- [x] **16.4 Label bb** (2026-08-01) — labels join
  `boundingBox()`/`fit()` **by default**: the options object
  (`{ includeLabels }`, unknown keys throw) rides collection bb,
  `renderedBoundingBox` and the store's whole-graph scan (no-arg
  fit/center/getFitViewport read it implicitly), and
  `boundingBoxAt` carries the node-relative label box to
  hypothetical positions (animated-layout fit targets cover labels).

  Terms: **node labels are exact** — `store.nodeLabelBox` places
  the laid (or headless-estimated) dims at the D3 anchor with
  halign/valign shifts, margins and the text-background padding
  (pad counts only when a box draws); **edge labels are
  conservative** — `edgeLabelSlack` is a block-covering radius
  (rotation-safe: width/2 + |margins| + vertical extent + pad +
  endOffset) grown about both endpoints, sound wherever the anchor
  lands on the drawn path (a recorded approximation; the exact
  per-anchor edge tier was not needed — fit may slightly over-fit,
  never under).

  `eles.labelBoundingBox()` is the public exact
  measure (the v4 form of v3's text-metrics surface): node labels
  at anchors, mid-labels at the drawn (curve-aware) midpoint, end
  labels via the endpoint radius.  Headless dims are estimates
  (recorded — 16.1's estimator); rendered instances re-fit exact.
  No golden churn (goldens pin explicit viewports) and zero
  regressions across the 2116-test suite; the fit semantics are
  pinned headless in `test/label-bb.mjs` (10 specs, red first —
  incl. getFitViewport reading the label-inclusive box), which
  covers what the planned browser fit spec would have.  131/131
  Playwright, typecheck + lint clean.
- [x] **16.5 Box-select labels + benchmark + true-up** (2026-08-01)
  — **`boxSelectionIncludesLabels`** (ctor option +
  getter/setter, default false — v3's box-select-labels default):
  `refsInBox` additionally requires the node's label box inside the
  band; Node-pinned (label poking out excludes the node only when
  opted in; runtime toggle).  **Shaping cost swept**
  (`benchmark/labels.mjs`, pure Node at 100k wrapped labels):
  breakLines ~3.8 µs, estimateBlock ~4.6 µs, the full
  setLabel-with-estimate write ~5.1 µs/label (write-driven, never
  per frame), and the whole-graph bb scan pays ~0.1 µs/label for
  its label terms.

  **Memo hit-rate pinned** in a `webgpu` spec:
  120 same-text wrapped labels shape ≤ 3 times
  (`stats().labelShapeHits/Misses`).  Final docs true-up (README
  round-16 section).  **Round 16 is complete.**  2117 Node tests,
  132/132 Playwright, typecheck + lint clean.

**Risks tracked**: golden churn confined to 16.4's one commit;
whole-graph scan cost with the label term (two extra reads per
labelled slot — benchmarked); long-text glyph counts (no new cap —
glyph instances already scale; ellipsis is the bounding tool);
edge-label conservative bounds vs autorotated blocks (reuse the D4
chord-slack machinery).
