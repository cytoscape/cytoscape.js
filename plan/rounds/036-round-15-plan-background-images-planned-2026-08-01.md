## Round 15 plan — background images (planned 2026-08-01)

The 16-prop `background-image` family — the "sleeper third" pillar of
the 2026-07-29 sweep (near-universal in production apps).  All calls
below signed off in the 2026-08-01 sitting.

**Signed-off design calls:**

1. **Storage is size-tiered texture arrays with hardware mips** —
   not a shelf atlas, not batch-per-image.  Unique images dedup by
   URL into an `ImageRegistry` (the string-dictionary discipline:
   refcounted entries, round-11 waste-threshold reclaim); each image
   rasters into a layer of a per-tier `texture_2d_array` (128² /
   512² / 1024², rgba8, full mip chain generated at upload), native
   w/h kept per entry for UV/aspect math.  Layers are slots:
   free-list alloc/reclaim, growth by realloc-copy.

   Rationale from
   the sitting, recorded: mips make minification *cheaper* as well
   as crisper (coherent low-mip reads vs scattered full-res texels —
   an unmipped atlas is a bandwidth spike at far zoom); array layers
   churn and grow like every other store structure, where a shelf
   atlas fragments toward a repack-the-world cliff; and the draw
   stays one instanced call per stream (batch-per-unique-image was
   ruled out — it breaks the cull → indirect-draw shape).  Cap:
   images raster at most at the top tier (1024²; the `imageMaxSize`
   renderer option moves the cap) — a recorded deviation for large
   photo sources.

2. **Full-color SVG stays crisp by zoom-promotion.**  A vector
   source has no native resolution, so a fixed raster is our
   artifact: per unique SVG the renderer tracks the max on-screen
   device-px demand among visible users (a CPU-side max over unique
   images riding existing per-frame state) and, when demand exceeds
   the current raster by ~1.5× (with hysteresis), re-rasters into
   the next tier asynchronously and swaps the (tier, layer) ref —
   momentary softness that self-corrects, the glyph-atlas
   `loadingdone` precedent.  Promotion ends at the cap tier
   (recorded blur past it).  Raster sources never promote (source
   resolution is their ceiling, as in v3).

   **Exports re-raster**:
   `png()`/`jpg()` raster visible SVG images at the export scale
   before encoding (the export path is already async), preserving
   the WYSIWYG guarantee at high `scale`.

3. **SDF icon mode — the glyph trick, generalized.**  A large class
   of node images (SBGN glyphs, icon sets) are monochrome
   silhouettes — glyph-shaped data.  The per-image
   `background-image-type: 'auto' | 'sdf-icon'` (explicit, never
   sniffed — detecting "really monochrome" SVGs is fragile) sends
   `sdf-icon` sources through the glyph pipeline: one raster at
   128², the glyph atlas's exact EDT, a single-channel r8 array
   layer (~16 KB vs ~1.3 MB for a 512² rgba mip chain), rendered by
   threshold + fwidth AA — **crisp at every zoom** with no promotion
   machinery — and tinted at render time by
   `background-image-color` (the label-color precedent), which makes
   icon color mapper-drivable.

   Recorded: a multi-color source in
   icon mode collapses to its alpha-thresholded silhouette in one
   color — well-defined, documented; full-color imagery belongs to
   `auto`.

4. **Multi-image parity.**  v3's image arrays port: up to **4
   images per node** (a fixed FS loop — cap recorded, the round-13
   list discipline), composited in v3's layer order (the exact
   order is pinned against v3 in the live parity scene during
   implementation), each with its own per-image props.  Per-node
   image lists are **blob-pool records** (the curve-blob/polygon
   pattern: packed per-image entries — registry ref + fit/position/
   size/offset/repeat/flags/opacity/tint — with round-11
   compaction), one packed offset|count ref column on nodes.

5. **Prop surface** (14 of v3's 16, plus the two new props):
   `background-image` (URL / data-URI; list-capable),
   `background-fit` (`none | contain | cover`),
   `background-image-opacity`, `background-position-x/-y`,
   `background-offset-x/-y`, `background-width/-height`
   (`auto` | %/px), `background-repeat` (`no-repeat | repeat-x |
   repeat-y | repeat`), `background-clip`,
   `background-image-containment` (`inside | over`),
   `background-image-smoothing` (`yes | no`),
   `background-image-crossorigin` (`anonymous | use-credentials |
   null`), plus `background-image-type` and
   `background-image-color` (keyword sets and %-defaults are v3's,
   verified against v3 source at implementation).

   `background-width/height-relative-to` is **not ported** (one name
   per concept: leaves have no padding in v4, and a compound
   parent's stored size is already the padded box — matching v3's
   `include-padding` default; the `inner` variant is the unported
   spelling, recorded).
   **Mapper rules** (the 12b list discipline): list forms are
   constants-only; the single-image forms of `background-image`,
   `background-image-opacity` and `background-image-color` take
   mappers (`data(key)` URLs resolve through the ordinal-dictionary
   path — the icon-per-type pattern; `case` works as everywhere).

   All image props are draw-only **paint** evaluated on the CPU into
   the blob records — a mapped image channel does not join the GPU
   eval kernel (recorded scope note).

6. **Async loading policy.**  Images decode off the hot path
   (`fetch` + `createImageBitmap`, crossorigin per prop); a node
   whose image hasn't landed draws its other layers and
   self-corrects when the upload lands (dirty the touched slots —
   the late-font precedent).  A failed load warns once per URL and
   renders imageless (recorded; no per-element error state).
   Headless instances parse/validate and store records with no
   raster (Node-testable); ghosts do not carry images (the A1
   simplified-body rule, recorded).

7. **Geometry non-interaction + LOD.**  Images never grow
   `boundingBox()` (unclipped overflow is not in bb — consistent
   with the `bounds-expansion` drop) and never affect picking (the
   pick body stays the shape).  The FS skips image sampling below
   the `imageMinPx` on-screen node size (default ~8 px; below ~3 px
   the plain-disc LOD already owns the pixel) — recorded.

8. **Bindings budget.**  Image sampling is FS-only: three rgba tier
   arrays + one r8 icon array + samplers ride the sampled-texture
   binding budget (16 per stage at base limits — separate from the
   8-storage-buffer budget), and the image blob pool is one more FS
   storage buffer, rebalanced per the C3 split precedent if a
   layout overflows.

**Pass split** (tests-first per item; docs in-commit):

- [x] **15.0 Docs-first** — landed with the design-sitting commit
  (`0f0ee859`): this plan section + the README pointer preceded all
  round-15 implementation.
- [x] **15.1 ImageRegistry + loader** (2026-08-01) —
  `src/image-registry.mts`: entries dedup by (kind, crossorigin,
  url) with refcounts; freed ids recycle through a free-list and
  report to the renderer via `takeFreed()` (the layer reclaim
  channel); rgba tier assignment from the decoded longest side
  (128/512/1024, cap tier clamps); sdf-icon entries raster at the
  fixed `SDF_IMAGE_SIZE` and carry no rgba tier; decode runs behind
  an injectable async rasterizer (`setDecoder` kicks entries
  acquired headless — the mount path), failures warn once per url
  and stay failed (re-acquire never re-kicks), and a decode
  resolving after its entry was freed is dropped by object identity
  so recycled ids can never take stale rasters.

  `promote(id,
  demandPx)` re-rasters *vector* entries at the smallest covering
  tier (the 15.6 meter's primitive; raster sources and covered
  demands no-op).  Tests-first: 10 specs in
  `test/image-registry.mjs` red then green — 2059 Node tests,
  typecheck + lint clean.
- [x] **15.2 Props + model** (2026-08-01) — contract first:
  `node.imageRef` (offset | count << 24 into the new image-record
  pool — a third `CurveBlob` with round-11 compaction, relocations
  rewriting the ref column) + `delta.imageBlob` +
  `ModelView.imageBlob()/images`.

  `GraphStore.setNodeImages` packs
  IMG_STRIDE(12)-float records (entry id, mode flags, opacity,
  pos/offset/size values + unit bits, sdf tint at 2 bytes/float) and
  acquires new registry entries *before* releasing old ones, so
  shared urls never transit refcount 0 on restyle; the imageless
  fast path is one ref-column read; `removeNode` releases through
  the same call.  Style: all 16 props parse/validate/read back
  (v3's keyword sets and defaults; per-image lists distribute
  last-value-repeats; `relative-to` throws as unported; image props
  are node-only), stored-truth readback reads the blob records
  (lists space-joined, the 12b convention).  Mappers: the
  **string-interning enum channel** — `background-image` compiles
  as an enum mapper whose parseEnum interns urls per compile (case
  `then`s, ordinal ranges and raw passthrough data values alike),
  covering both icon-per-type and photo-per-node; `-image-opacity`
  and `-image-color` are plain number/color channels; every other
  image prop rejects mappers (the 12b list rule).  Tests-first: 17
  specs in `test/background-image.mjs` red then green — 2076
  Node tests, typecheck + lint clean.
- [x] **15.3 RGBA draw path** (2026-08-01) — the tiered-array draw,
  in its own pass + pipeline: the node FS sits at exactly 8 storage
  buffers, so imaged nodes draw **one extra instanced quad** off the
  same culled visible lists (leaf stream right after the node
  bodies, parent stream right after the parent bodies — v3's
  layering), imageless instances collapsing in the VS and the whole
  pass skipped at `store.imageCount() === 0`.

  `render/image-arrays.mts`: per-tier `texture_2d_array`s with full
  mip chains (blit-generated — WebGPU has no generateMipmaps),
  layers as slots (`TierAllocator`: free-list, doubling growth with
  live-mip copy-over, 256-layer base-limit cap warn-once), and the
  entry-indexed **image table** storage buffer
  (status/tier/layer + natural + raster dims) that gates sampling
  and scales UVs into partially-filled layers.

  The FS walks the
  blob records in list order compositing later-over-earlier,
  samples with **textureSampleGrad** (explicit gradients hoisted to
  uniform flow, so the per-record branching is legal), emulates
  smoothing: no by texel-center snapping, masks `clip: node` by the
  node SDF — containment `inside` clips at the border's inner edge
  (border stays visible; a translucent border shows fill, not
  image — recorded beside the B1 band rule), `over` at the shape
  boundary — and confines repeat tiles to the node box (recorded).
  `clip: none` rects grow the quad in the VS.

  The mirror gained
  the image blob's realloc/span twin; the browser decoder
  (`render/image-decoder.mts`: fetch + createImageBitmap, SVG via
  img + canvas at target size, decode-time downscale into the cap
  tier, crossorigin modes with `null` narrowed to same-origin —
  recorded) attaches at init and detaches on destroy.  WGSL lesson
  re-hit and re-recorded: `ref` is reserved (the console-error
  guard caught it).  Verifies: 6 Node specs
  (`test/image-arrays.mjs`, tests-first), the `images-basic` and
  `images-cover-clip` goldens, and **`parity-images` vs v3 at
  0.000%** — fit/position/opacity math is pixel-exact.  2082 Node
  tests, 122/122 Playwright, typecheck + lint clean.
- [x] **15.4 Multi-image compositing** (2026-08-01) — the 15.3 FS
  loop verified across full multi-image records: a Node spec pins
  per-image independence of every list prop at its index (fit /
  repeat / clip / containment / smoothing / type, four distinct
  registry entries), the `images-multi` golden pins four
  overlapping images with per-image sizes/positions/opacities and
  a half-translucent source (blend math), and
  **`parity-images-multi` vs v3 at 0.000%** pins the layer order —
  v3's canvas draws ascending index with source-over, so **later
  list entries composite on top** (not the CSS first-on-top
  convention; verified against v3's drawImages loop and now
  pixel-pinned).

  The cap-overflow warn landed in 15.2.  2083 Node
  tests, 124/124 Playwright, typecheck + lint clean.
- [x] **15.5 SDF icon mode** (2026-08-01) — the glyph trick,
  generalized: sdf-icon sources raster once through the decoder's
  alpha-grid path (SVG via img + canvas, rasters via bitmap +
  canvas — a multi-color source collapses to its alpha silhouette;
  recorded), the **glyph atlas's exact `computeSdf` EDT** runs at
  upload, and the field lands in a dedicated r8
  `texture_2d_array` (fixed 128², layers slot-allocated as tier
  index 3 in the shared TierAllocator, no mips — the field
  re-thresholds at any scale).

  The FS icon branch samples with
  the same explicit gradients and applies an **analytic AA width**
  (fwidth is illegal in the non-uniform record loop: coverage per
  screen px = sampled texels-per-px / SDF_RADIUS), tinting by the
  record's `background-image-color` — so icon color is
  mapper-drivable while the raster is shared.  Pins: the
  `images-sdf-icons` golden (tint mapper, red + teal hearts from
  one SVG entry) and a programmatic crispness spec — at zoom 6 the
  sdf edge transition stays ≤ 2 px while the rgba path's 128px
  raster ramps ≥ 3 px (the same node restyled between exports,
  since `background-image-type` is constants-only — recorded).
  2083 Node tests, 126/126 Playwright, typecheck + lint clean.
- [x] **15.6 SVG zoom-promotion + export re-raster** (2026-08-01) —
  the demand meter: per unique *vector* entry, the max on-screen
  device-px demand among its shown, in-viewport user nodes (one
  scan over the imageRef column), debounced 250 ms behind viewport
  events and re-checked when fresh uploads land (a graph built
  zoomed-in promotes on arrival); demand > raster × 1.5 (the
  hysteresis — wheel jitter never thrashes) calls
  `registry.promote`, which snaps to the covering tier and clamps
  at the cap.  No demotion — the round-11 waste policy is the
  eventual reclaimer (recorded simplification).

  **Exports
  re-raster**: `exportImage` promotes at the export view's
  zoomDpr (no viewport test) and awaits `registry.whenSettled()`
  (bounded 2 s; in-flight tracking landed in the registry with its
  own Node specs), syncing the fresh rasters before the export
  frame encodes.  Fix fallout caught by the suite: the 15.5
  crispness spec's rgba contrast switched to a *raster* square —
  the meter (correctly) sharpened its auto SVG.

  Pins: zoom 6 →
  rasterPx ≥ 512 + edge ramp ≤ 3 px after settle; `png({ scale: 6 })`
  promotes and exports crisp while the screen never demanded it;
  the WYSIWYG self-diff gained an imaged phase (scale-1 exports
  still pixel-match the screen).  2084 Node tests, 128/128
  Playwright, typecheck + lint clean.
- [x] **15.7 LOD + benchmark + true-up** (2026-08-01) —
  **`imageMinPx`** (renderer option, default 8): the image VS
  collapses the quad when the node shows below the floor in
  displayed px (the labelMinPx semantics; export uniforms use the
  export scale — a figure's own resolution), so far-zoom scenes pay
  zero image sampling; pinned by a Playwright spec (no image ink at
  20 px under a 30 px floor, ink appears at zoom 2).

  The renderer
  benchmark gained **`gen-25k-images`** (25k × 50k, four icon types
  via `data.itype`, styled through the ordinal url mapper on the
  gpu side and type selectors on v3; icon data-uris built at page
  runtime) — the scene is wired like its siblings; numbers were not
  recorded on this box (software adapter — a different machine
  class, per the benchmark's own warning).  *Correction
  (2026-08-03)*: that parenthesis is wrong for the same reason 18.5's
  was — this box has an AMD RX 580 and the benchmark reaches it (see
  the hardware validation pass below); the images scene simply has not
  been measured.  The ordinal-url mapper
  form is Node-pinned.  Final docs true-up in this commit.

  **Round 15 is complete.**  2085 Node tests, 129/129 Playwright,
  typecheck + lint clean.

**Risks tracked**: upload bursts on initial load (decode is already
async; uploads coalesce per frame); WGSL non-uniform texture access
(explicit-gradient sampling or sample-both-select — chosen at
implementation, pinned by goldens); crossorigin/tainting differences
between decode paths; registry leaks under style churn (refcount
specs); multi-image FS cost (the benchmark item guards it).
