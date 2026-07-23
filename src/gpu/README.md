# Cytoscape.js GPU prototype (`src/gpu`)

First pass of the v4 performance redesign spec'd in
[#3486](https://github.com/cytoscape/cytoscape.js/issues/3486): a separate
prototype core with a **CPU-canonical columnar model** (typed-array columns,
stable slots, per-column coalesced dirty spans) written through to
**persistent GPU buffers**, rendered by a **WebGPU pipeline** (SDF node
shapes, straight edges reading endpoints from the node position buffer
on-GPU, GPU picking, compute culling + indirect draws + LOD).  The
existing v3 core, collection and renderers are untouched.

Culling: a compute pre-pass per group (nodes, edges, glyphs) compacts the
drawable slots into a visible list + `drawIndexedIndirect` args — a
deterministic three-dispatch stream compaction that preserves slot order
(the in-group z-order), with an exact segment-vs-rect test for edges — so
the render pass draws exactly what's visible instead of running the vertex
shader over every allocated slot.

- Entry point: `cytoscapeGpu(options)` from `src/gpu/index.mts`
  (`import cytoscapeGpu from 'cytoscape/gpu'`, UMD global `cytoscapeGpu`).
- Headless-friendly: without a `container` no GPU is required (Node-testable).
  With a `container`, WebGPU is mandatory — the factory throws synchronously
  when `navigator.gpu` is missing, and `.ready` rejects when no adapter can
  be acquired.
- `contract.mts` is the co-signed source of truth for the column/flag layout
  shared by the model (`store/`) and the renderer (`render/`) — change it
  first when the layout changes.
- Manual testing: `npm run watch` → http://localhost:3333/webgpu/.
  Browser tests: the `webgpu` Playwright project.

## API scope (pass 1)

Core: viewport fns (`zoom`, `pan`, `panBy`, `fit`, `center`, `extent`),
events, graph manipulation, `style()` (constrained blocks), `layout()`
(grid only), `pick()`, `destroy()`, `width()`/`height()`.
Collections: events, graph manipulation, position/dimensions, iteration,
comparison, building/filtering, basic traversal (`outgoers` etc.),
`select`/`unselect`, `label()` (read-only).

Node labels (SDF): the `label` style prop takes constant strings or the
single mapper `data(id)`; `font-size` and `color` are constants.  Glyphs
come from a runtime SDF atlas (canvas-2D raster → Euclidean distance
transform → one r8 texture) and live in a persistent instance buffer keyed
by node slot — the label vertex shader reads the node position buffer, so
labels follow drags and layouts on-GPU with zero rebuild.  Labels fade out
below the `labelFadePx` LOD threshold.

Out of scope (deferred): animations, full stylesheets/mappers, `data()`
(ids/source/target are first-class), arrows, compound nodes, bezier
edges, non-grid layouts, graph algorithms.

## Known deviations from v3 (accepted for pass 1)

- **Listener firing order**: one core emitter with ref/selector-qualified
  listeners; element-vs-core listeners fire in plain registration order, not
  v3 bubble order.
- **No z-index**: edges always draw under nodes; within a group draw order
  is slot order (≈ insertion order, but a reused slot draws at the recycled
  position).  A grabbed node does not pop above later-inserted nodes.
  Escape hatch: an optional `array<u32>` index-indirection pass later.
- **Float32 positions**: ~7 significant digits of precision (pure-memcpy
  uploads are worth the trade at this stage).
- **Pan-vs-grab staleness**: pointerdown consults the last *resolved* GPU
  pick, which can be ≤2 frames stale; a cold start defaults to pan.
- **Hover pauses during viewport gestures**: pan drags and wheel zooms are
  viewport-only ops with no mouseover/tap semantics, so no pick passes run
  mid-gesture; a wheel gesture re-picks under the cursor once it settles
  (~200 ms after the last tick).
- **Frame timing in `stats()`**: `cpuFrameMs` is the encode/submit cost
  (submission is fire-and-forget, so it stays ~0.1 ms by design);
  `gpuFrameMs` is real scene-pass GPU time via the optional
  `timestamp-query` feature (0 when unsupported).  Reconcile fps against
  `gpuFrameMs`, not `cpuFrameMs`.
- **Selectors/styles**: only `node`, `edge`, `*`, `#id`, `:selected`,
  `:unselected` and comma lists; style blocks are constants only.
- **`cy.elements()` order**: nodes (insertion order) then edges, not the
  mixed insertion order of v3.
- **Picking**: the pick pass draws a fixed 64×64 cursor-centered tile (a
  pick-specific Frame uniform turns the cull pass's viewport test into
  cursor-region culling, so picking costs O(region) not O(scene)) and
  submits in its own command buffer ahead of any scene work; the center
  texel reads back through a ring of 3 staging buffers (latest-wins;
  requests drop to `null` when the ring is exhausted).  Scene submissions
  are capped at 2 in flight — when the GPU is behind, the loop coalesces
  state into the next frame instead of queueing deeper — so `pick()`/hover
  resolve in ~1 rAF plus bounded GPU work even on GPU-bound graphs.
- **Far-zoom edge decimation**: once width-floored (hairline) edges fall
  below half alpha, a hash-stable 1-in-N subset draws at N× alpha (N a
  power of two ≤ 64).  Aggregate edge density is preserved, but individual
  sub-half-alpha edges may neither draw nor pick at far zoom.  This removes
  the far-zoom worst case where every edge rasterized into a few hundred
  pixels and serialized at the blend stage (~33 ms → ~8 ms on 465k edges).
- **Labels**: nodes only, single line (newlines collapse to spaces), fixed
  placement (horizontally centered below the node), not pickable, and the
  glyph atlas is a fixed 1024² texture — once full, new glyphs stop
  rendering with a console warning.  Label color/text bake into glyph
  instances, so `:selected`/hover styling does not restyle label text.
- Pinch zoom is deferred; wheel/drag/hover/tap/grab are implemented.
- No device-loss recovery: the instance goes dead and emits an `error`
  event.

## Follow-up hooks

- CSR adjacency (incremental per-node lists for now).
- Slot compaction (tombstones + degenerate quads for now; the cull pass
  already keeps tombstones out of the draw stream).
