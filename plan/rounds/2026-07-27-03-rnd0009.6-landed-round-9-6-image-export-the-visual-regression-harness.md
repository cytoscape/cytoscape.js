## Landed (round 9.6 — image export + the visual regression harness, 2026-07-27)

Direction (discussion): ship image export next as the small design-clean
round, and build a pixel-diff harness on top of it — v3 output as a
**tolerance-based parity check**, v4-vs-v4 **golden diffs** as the standing
regression backbone (v3 can't be a strict baseline: SDF vs canvas-2D AA,
label raster/placement, the shader-drawn accent ring all differ by design).

Two calls made explicitly: goldens are checked into the repo (that is what
makes them a regression tool), and v3 parity renders **live in the same
Playwright run** rather than from checked-in v3 snapshots — same-machine
images sidestep cross-platform font/AA determinism entirely and can't go
stale against the v3 code actually in the repo.

- **`cy.png()`/`cy.jpg()`** (`Renderer.exportImage`): offscreen render at
  the requested viewport (current view, or `store.boundingBox()` with
  `full`) into a transient texture + depth target, culled by a dedicated
  export Frame uniform and export CulledGroups through the same
  `drawScene` sequence as the screen; `copyTextureToBuffer` readback
  (256-byte row alignment stripped), BGRA swizzle + unpremultiply to
  straight-alpha RGBA, canvas-2D encode in the core.

  v3's options (`bg`,
  `full`, `scale`, `maxWidth`/`maxHeight` override scale, `quality`,
  `output`); every form resolves through one promise (sync readback is
  impossible on WebGPU); jpg defaults `bg` white; headless rejects;
  dimensions beyond the device texture limit throw (no tiling in pass 1).
- **Frame-coherent by construction**: exports are encoded in the frame
  loop after that frame's scene work (deferred while backpressure keeps
  `needsRedraw` set), so they see exactly what the screen shows — a
  Playwright spec exports mid-position-tween and finds the node at its
  GPU-tweened position while CPU `position()` is lease-stale.  Exports
  always render native (adaptive render scale never applies); label LOD
  thresholds evaluate at **export scale**, taking the sub-decision parked
  with the label design (self-consistent figures).
- **Latent bug fixed on the way in**: the label pipeline cached one bind
  group keyed only on mirror/glyph versions — sound only while labels
  drew exclusively with the scene uniform; it now caches per uniform
  buffer like the other pipelines.
- **Pixel-diff harness** (`playwright-tests/lib/image-diff.mjs`;
  pixelmatch + pngjs as devDeps): decode, rect masking, tolerance diffs,
  failure artifacts (actual/expected/diff PNGs), and
  `compareToGolden` with an `UPDATE_GOLDENS=1` regen flow.
- **WYSIWYG self-diff** (no golden needed): a viewport export at scale 1
  pixel-matches a screenshot of the live canvas (≤ 0.1% of pixels) over a
  scene exercising all four pipelines — pins the export path to the
  screen path both ways.
- **v4 goldens** (new `visual` Playwright project, pinned to
  SwiftShader via `--use-webgpu-adapter=swiftshader` so rasterization is
  machine-independent): four checked-in scenes — shapes/borders/opacity/
  arrows, the selection accent ring, GPU-evaluated color mappers, and
  far-zoom LOD (floors, decimation, plain discs).  Goldens stayed
  label-free in this round — SDF glyphs raster via OS fonts, which is
  not cross-platform stable — superseded in round 9.7, where a fixed
  web font made a label golden possible.
- **v3 parity** (`playwright-page/parity.html` loads both UMD bundles):
  the same fixture rendered by both renderers in the same run, exports
  diffed in memory — nodes/borders/opacity/straight edges, and a
  zoom+pan transform case; one look in two dialects (v3 selector blocks
  vs v4 case mappers).  Interiors agree exactly; AA differs by design,
  so the specs bound the mismatch ratio (measured 0.5–0.8%, asserted
  ≤ 2%).  Two v3 gotchas guarded: v3's default layout is 'grid' (parity
  passes an explicit preset layout, `fit: false`), and v3 adopts
  position objects by reference (each side deep-copies the defs).
- **Verification**: 1452 Node tests + 47 module tests, typecheck and lint
  clean, 32/32 `webgpu` + 6/6 `visual` Playwright specs; goldens
  byte-stable across repeat runs.
