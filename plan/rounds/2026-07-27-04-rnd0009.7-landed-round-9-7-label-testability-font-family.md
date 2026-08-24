## Landed (round 9.7 — label testability + `font-family`, 2026-07-27)

Direction set in discussion (amendment to round 9.6: "it's important to
test labels").  The 9.6 goldens excluded labels because the atlas
hardcoded `32px sans-serif` — the browser's *generic* sans-serif, which
resolves to a different font per OS, making label pixels unpinnable even
in principle.  The package, with the load-bearing piece being a missing
API, not harness design:

- **`font-family` as a constant, effectively global node style prop**
  (default `sans-serif`) — the atlas is keyed by character, one font per
  atlas by design, so per-element fonts (atlas re-keyed by (font, char))
  are out of scope; mappers for the prop and the edges-group form throw.
  A change routes `store.labelFont` → atlas reset (cache/pen/full +
  re-measured ascent, same texture object so bind groups survive) → all
  labelled slots marked label-dirty → one `LabelLayer.process()` pass
  rebuilds every glyph run against the new metrics.
- **A vendored OFL web font for the specs** (`@fontsource/open-sans` as
  a devDependency; `@font-face` in the test pages; specs `await`
  `document.fonts.load` *before* instance creation).  The pre-load
  matters because the atlas rasters lazily and caches forever: a glyph
  built before the font loads is cached from the fallback with no
  invalidation.  A `document.fonts.ready` re-raster hook for the library
  is logged as a follow-up, not built here.
- **Label goldens as their own tolerance tier** in `visual`: the
  fixed font pins glyph shapes/metrics and SwiftShader pins the GPU, but
  Chrome's atlas raster still goes through CoreText (macOS) vs FreeType
  (Linux), so label goldens get a looser bound (threshold ~0.25, ratio
  ~2%) than geometry goldens (0.5%).  Escape hatch if CI disagrees:
  per-platform golden suffixes.  A font-swap Playwright spec proves the
  atlas rebuild path (pixels change when the sheet's font changes).
- Already covering labels and unchanged: the WYSIWYG self-diff
  (same-machine export-vs-screen, includes glyphs) and the behavioural
  label specs (placement, follow-on-drag, LOD fade).  v3 parity keeps
  excluding labels — raster and placement differ by design.
- **Verification**: 1461 Node tests (9 new font-family specs) + 47
  module tests, typecheck and lint clean; 33/33 `webgpu` (incl. the
  font-swap spec) and 7/7 `visual` specs (incl. the
  `labels-open-sans` golden), the visual project stable across three
  consecutive runs.
