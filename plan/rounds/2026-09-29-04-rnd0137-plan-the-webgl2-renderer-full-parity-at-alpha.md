## The WebGL2 renderer, full parity at alpha

The implementation round that round 73's feasibility record planned
(`2026-08-14-04-rnd0073-landed-the-webgl2-fallback-scoped.md`, "The
round, as carried out").  It carries out the eleventh sitting's call —
**full parity at alpha**: everything the WebGPU renderer draws, drawn
under WebGL2 — and `docs/feature-direction.md`'s alpha minimum, working
rendering without WebGPU.  Every design call below was taken in round 73
on measurement or on the source; this file sequences them and says how
each sub-round is verified.

### When it starts

The maintainer's sequencing note on round 73 stands: a fallback written
against a moving render contract re-pays its port on every contract
change.  So the round opens once these have landed, and not before:

- the drawn-feature rounds still planned — **76** (style wins), **80**
  (charts), **81** (annotations), **82** (hulls and collapse), **83**
  (edge bundling) and **105** (parallel edges) — each of which now
  carries round 73's constraints in its own file;
- **77** (SVG export), because the two share "the rendering information"
  `docs/feature-direction.md` asks be defined once, and 77 is where that
  vocabulary is first written down outside WGSL;
- **126** (shader minification), whose transform this round extends to
  the GLSL literals;
- **item 31's trace tier** (the gesture traces, called "before the WebGL
  implementation") and **item 30's tier 2** (the degrade control), so
  both renderers are held to the same inventories from the first commit;
- **items 35–36** (device limits and allocation failure), so the
  `cy.add()` throw is designed once for both backends' limits.

If the queue moves, the rule is the note's: the render-affecting rounds
first, this round after.

### What round 73 decided, which this round builds

1. **The seam.**  The WebGL2 renderer is a second `Renderer`
   implementation mounting through the model↔renderer seam of round 86
   (`RenderHost`, `src/README.md` "The model↔renderer seam"), in
   `src/render/gl/`.  Everything above the GPU boundary is shared, not
   ported: label layout and wrapping, the glyph atlas raster and its EDT,
   the declutter pass, the scale controller, the sync CPU node pick, the
   image decoder, the emphasis bookkeeping, the frame scheduling.
2. **Capability selection** — `renderer: { backend: 'auto' | 'webgpu' |
   'webgl2' }`, default `'auto'`: WebGPU when `requestAdapter()` answers
   an adapter that is not a fallback adapter (`adapter.info
   .isFallbackAdapter`) and `requestDevice()` succeeds; otherwise WebGL2;
   otherwise `cy.ready` rejects, naming both.  The backend taken is
   reported (`cy.renderer().stats().backend`).  An explicit backend never
   falls back.  The visual suite pins `'webgpu'` for its existing goldens
   (SwiftShader classifies as software and `'auto'` would move them).
   **Item 18 is closed by this rule: the tween pipelines are not warmed**
   (round 73's record gives the reach data).
3. **The data layer: a `TextureMirror` standing where `ColumnMirror`
   stands** — the same dirty-span / `resized` / `version` contract, one
   texture per column, the slot at texel `(slot & (W−1), slot >> log2 W)`
   with `W = min(4096, MAX_TEXTURE_SIZE)`.  Formats per column are round
   73's 73.1 table (`RG32F`, `RGBA32F`, `R32UI`, `RG32UI`, `RGBA32UI`;
   `edge.width` as `RG32UI`, bit-safe for its u32 lane; the colour words
   as `R32UI` with a hand-written unpack, since `unpack4x8unorm` is not
   GLSL ES 3.00); blobs as `R32F` addressed the same way; glyph records
   as four `RGBA32UI` texels.  The 8-storage-buffer budget does not exist
   here; the ceiling is 16 texture units per stage (the ES 3.00
   minimum), and no vertex stage needs more than 8 nor any fragment
   stage more than 12 (the image pass).
4. **Culling is a vertex-stage collapse, not a compaction.**  Every
   instanced draw draws the group's high-water slot count; the vertex
   shader evaluates the cull's predicate (the flags, the LOD rules, the
   viewport test, the emphasis tier, the declutter gate) and emits a
   degenerate position for a culled slot.  Measured in 73.2: 0.03–0.33
   ms more GPU time than drawing a CPU-compacted list from 100k to 800k
   elements, against a CPU walk of 0.4–4.5 ms a frame that the collapse
   does not pay, with no upload, and slot order — the painter's order
   the compute cull preserves — kept for free.
   `drawIndexedIndirect` becomes `drawElementsInstanced`; the paired
   (cased) block draws `2 × n`.
5. **Picking**: the 64×64 `R32UI` tile, read with
   `readPixels(RGBA_INTEGER)` into a three-slot `PIXEL_PACK_BUFFER`
   ring, a `fenceSync` per read polled from a task loop, and the pick
   cache carried over unchanged.  No region cull: the tile draws every
   slot (1.4 ms of GPU at 465k edges, against 2.3 ms of CPU walk plus
   0.6 ms of GPU to cull to the region first).  Nodes stay on the sync
   CPU pick.
6. **The compute subsystems take their CPU paths**, which exist:
   mapper eval (`gpuMappers: null`), tweens (no sink — the manager ticks
   on the CPU), force (no `startForce` — the worker or in-thread sim),
   the algorithm GPU tier (independent of the renderer; `'auto'` falls
   back, `'gpu'` rejects).  `viewportCounts()` evaluates the same
   predicates on the CPU columns when called.
7. **The rest maps directly**: the emphasis veil by `blendColor`, the
   upscaler by `textureLod`, `frag_depth` by `gl_FragDepth`, texture
   arrays by `sampler2DArray` with `generateMipmap` or a per-layer blit
   chain, `copyTextureToTexture` by `copyTexSubImage3D`, device loss by
   `webglcontextlost`/`webglcontextrestored` into the existing re-mount,
   backpressure by a fence per frame, `gpuFrameMs` by
   `EXT_disjoint_timer_query_webgl2` where exposed (Chrome desktop; not
   Firefox, Safari or Android — 0 there, with the stall-ratio fallback).
8. **Shaders are hand-ported GLSL ES 3.00 twins**, family by family, in
   `src/render/gl/shaders/` mirroring `src/render/shaders/`, each literal
   tagged for round 126's minifier.  A build-time WGSL→GLSL translator is
   not taken: the WGSL reads storage buffers, which GLSL ES 3.00 does
   not have, so a translation would still need the data-layer rewrite
   by hand, and a new build tool needs a reason `AGENTS.md` rule 7 would
   accept.

### The gate every family lands against

**A live v4-webgl-vs-v4-webgpu diff project** on the v3-parity
harness's shape: every golden scene and every parity scene rendered by
both backends in one page, diffed numerically, with a tolerance
calibrated in 137.2 and never widened to admit a failure.  Plus the
backend's own goldens, the gesture traces run on both backends, and the
golden-coverage list (round 135: the paintable properties no golden
sets) run against both, so a property with no golden is not silently
unported.  Each family's sub-round names its degraded control: a
deliberately broken port of one feature must turn its parity scenes red.

### 137.1 — selection, the context, the lifecycle

The `backend` option and its types, the selection rule, a WebGL2
`Renderer` that mounts, clears, resizes, reports `stats()` (with
`backend`) and re-mounts on context loss; the fence-per-frame
backpressure.  Item 18's call written into `src/README.md`.
**Verified by** a selection matrix spec with the adapter mocked (no
`navigator.gpu`, a fallback adapter, a failing `requestDevice`, an
explicit backend that must not fall back), the loss spec driven by
`WEBGL_lose_context`, and `npm run -s test:throws:quiet` for the
rejection messages.

### 137.2 — the texture mirror and the parity project

`TextureMirror` over the store's deltas, the blobs, the glyph buffer,
the label gate and the image table; the address function and its
limits.  The parity project, every scene expected-red by family until
its family lands.  **Verified by** a spec that drives arbitrary deltas
(growth, spans, compaction) through both mirrors and compares the
texture read-back to the column bytes, bit for bit; the parity
project's calibration run (webgpu against webgpu must be zero).

### 137.3 — nodes

The node body, depth prepass, ghost, parents, node layers: every shape
SDF, borders and their styles, dashes, gradients, the outline — the
largest family (`NODE_SHADER` expands to 74k characters).

### 137.4 — straight edges and their arrows

The straight stream's kinds (haystack, the triangle kind), dashes,
gradients, the edge layers (caps, joins, the per-edge depth of round
88), casing, and the straight and mid arrowheads.

### 137.5 — curved edges and their arrows

The curve and route evaluators (bezier, unbundled, segments, taxi
including round 124's tracks), the 32-segment strip, the layered depth
writes, curved casing and curved arrows.  Watch the vertex stage's
register pressure: the route evaluator's local arrays are the one
construct a GLES driver may handle badly, and the parity project's
timing rows say so if it does.

### 137.6 — labels

The `R8` atlas and its tier promotion, glyph records as texels, node
labels, edge labels and both end streams, the outline phase as a second
program, the LOD fade and the declutter gate in the collapse predicate.

### 137.7 — images, icons and charts

The three `RGBA8` array tiers with their mips, the `R8` icon array,
tier growth, `textureGrad`, the chart pass (after round 80 has settled
its capacity).

### 137.8 — interaction and the frame's other passes

The pick tile, ring and cache; the gesture traces on both backends;
the two-tier emphasis and its veil; the upscaler and the scale
controller; the timer query; `viewportCounts()` on the CPU.  **Verified
by** the gesture inventory's specs run against `backend: 'webgl2'`,
and the pick latency priced beside `Picking.lastLatencyMs` on the same
scenes.

### 137.9 — export, the worker host and the limits

`png()`/`jpg()` from a framebuffer (un-premultiply pass, `readPixels`
into a PBO, the Y flip, tiling past the renderbuffer limit); the
worker host on `OffscreenCanvas.getContext('webgl2')`; items 35–36's
limits read from the WebGL2 context.

### 137.10 — the price, the docs and the close

`benchmark:renderer --backend webgl2` on the published scenes, beside
the WebGPU rows on the same machine; the CI browser cost of the second
project, measured and recorded; `docs/features.csv`, `src/README.md`,
`MIGRATING.md` (what a WebGL2 user does not get: `executor: 'gpu'`,
the GPU force executor, `gpuFrameMs` off Chrome desktop), the types,
and the executive summary.

### Risks named at planning

- **The standing tax is the real cost.**  Every drawn feature after
  this round is written three times (CPU where it is read, WGSL, GLSL),
  and the parity project is what keeps the third honest.  The round
  should not end without that project gating in CI.
- **Scoping by porting**, round 73's warning, turned around: a sub-round
  that ports its family by rewriting the WGSL design rather than
  translating it has left the round's mandate, and the parity diff is
  where that shows.
- **Browser reach goes stale fastest.**  Round 73's table is dated
  2026-09-29; 137.1 re-fetches it before the selection rule's
  documentation is written.
