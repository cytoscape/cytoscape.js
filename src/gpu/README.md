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
(grid and preset), `pick()`, `destroy()`, `width()`/`height()`.
Collections: events, graph manipulation, position/dimensions, iteration,
comparison, building/filtering, basic traversal (`outgoers` etc.),
`select`/`unselect`, `data()`, `label()` (read-only).

`data()`: element data lives in a **columnar sidecar** — per-(group, key)
columns, not per-element objects: numbers as Float64Array, strings
dictionary-encoded, a plain-array fallback for the rest, each column
adapting to what it holds.  `id` (and `source`/`target` on edges) stay
first-class and immutable.  Setters emit `data` per element.

Node labels (SDF): the `label` style prop takes constant strings or a
`data(key)` mapper (any sidecar key; `data(id)` reads the first-class
id); mapped labels refresh on data writes.  `font-size` and `color` are
constants.  Glyphs
come from a runtime SDF atlas (canvas-2D raster → Euclidean distance
transform → one r8 texture) and live in a persistent instance buffer keyed
by node slot — the label vertex shader reads the node position buffer, so
labels follow drags and layouts on-GPU with zero rebuild.  Labels fade out
below the `labelFadePx` LOD threshold.

Out of scope (deferred): animations, full stylesheets/mappers beyond the
label `data(key)` mapper, arrows, compound nodes, bezier edges, layouts
beyond grid/preset, graph algorithms.

## Loading

`options.elements` accepts the classic definition form (v3-style JSON) or
a **columnar bulk-load form**: `{ columnar: true, nodes: { count, ids?,
positions?, data? }, edges: { count, ids?, sources, targets, data? } }`
with typed-array columns and edge endpoints as node *indices* — it
ingests straight into the store (contiguous slot runs are memcpys) with
no per-element objects and no id lookups per edge.  `data` holds sidecar
columns by key (plain arrays, Float64Array with NaN holes, or
dictionary-encoded string columns).  Columnar payloads are self-contained: every
edge endpoint indexes a node in the same payload.  Convert classic JSON
with `cytoscapeGpu.toColumnarElements(json)`.  There is also a **binary
wire format** — `cytoscapeGpu.serializeElements(elements)` (takes either
form) produces one little-endian ArrayBuffer (fixed header + columns; ids
as a UTF-8 blob with prefix offsets), and `options.elements`/`cy.add()`
accept the buffer directly (or use `deserializeElements` to inspect it) —
so a graph can be served as a static binary asset and fed straight from
`fetch(...).arrayBuffer()` with no JSON parse.  Numeric columns
deserialize as zero-copy views into the buffer, and ids stay packed all
the way into the store — the id index is itself blob-native (UTF-8 bytes
+ an open-addressing probe table, no JS strings), so id strings are
decoded lazily, only for elements actually touched via handles.  The
wire carries the data() sidecar too: numeric columns as f64, string
columns as dictionaries (only the small dictionary decodes), the rest as
JSON per present value.  Either way, the
factory's load path materializes no per-element handles and emits no
`add` events (nobody can be listening yet); `cy.add()` keeps full
per-element semantics and takes all three forms.  ndex-x-large (19.6k
nodes / 465k edges, 28.6 MB JSON): definition-form init 236 ms, columnar
init 80 ms — down from 662 ms before the bulk path.  The wire form of the
same graph is 9.2 MB and deserializes in ~5 ms, replacing the JSON path's
90–113 ms parse + 27–48 ms convert.

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
- **Pan-vs-grab is exact**: pointerdown does a synchronous CPU node pick
  (positions are CPU-canonical), so grab targeting has no staleness and a
  cold start needs no resolved pick.
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
- **Picking** resolves in three stages, cheapest first.  (1) Nodes pick
  **synchronously on the CPU** — positions are CPU-canonical, and a
  columnar scan replicating the shader semantics (flooring, plain-disc
  LOD, shape inside-tests, topmost-slot-wins) answers in ~0.1 ms with
  zero GPU work.  (2) The last GPU pick tile doubles as a **pick cache**:
  while the cursor stays inside it and neither the viewport nor any
  pick-affecting geometry changed, edge/background answers are instant
  (color/opacity-only changes keep the cache).  (3) Otherwise the GPU
  pick pass draws a fixed 64×64 cursor-centered tile — **edges only** — 
  (a pick-specific Frame uniform turns the cull pass's viewport test into
  cursor-region culling, O(region) not O(scene)), submits in its own
  command buffer ahead of scene work, and reads the whole tile back
  through a ring of 3 staging buffers (latest-wins; requests drop to
  `null` when the ring is exhausted).  Scene submissions are capped at 2
  in flight, so even stage-3 picks resolve in ~1 rAF plus bounded GPU
  work on GPU-bound graphs.  Measured on ndex-x-large at dpr 2: node
  hovers ~0 ms, cold background/edge ~7 ms, cached ~0.2 ms,
  hover-while-panning median ~0 ms (was ~70 ms).
- **Far-zoom edge decimation**: once width-floored (hairline) edges fall
  below half alpha, a hash-stable 1-in-N subset draws at N× alpha (N a
  power of two ≤ 64).  Aggregate edge density is preserved, but individual
  sub-half-alpha edges may neither draw nor pick at far zoom.  This removes
  the far-zoom worst case where every edge rasterized into a few hundred
  pixels and serialized at the blend stage (~33 ms → ~8 ms on 465k edges).
- **Early-z**: a depth prepass writes depth for guaranteed-opaque node
  interiors (skipping translucent fills/borders, LOD alpha and the AA
  fringe — output is pixel-identical), and edges depth-test against it so
  fragments under opaque nodes skip blending.  Depth values come from a
  per-element **z-rank** (two ranks today: edges far, nodes near), which
  is the same mechanism a future `z-index`/compound pass would use — more
  ranks, more batches; content ranked above merely loses the occlusion
  benefit, never correctness.  Nodes that can't occlude (translucent or
  < 4 px) collapse out of the prepass so it costs ~nothing at far zoom.
- **Adaptive render scale** (`renderScaleMin`/`renderScaleMax`, defaults
  0.5/1): the renderer moves its resolution in quarter steps within the
  band, driven by measured GPU frame time over ~400 ms windows — median
  above ~14 ms steps down; stepping up requires the *projected* cost at
  the higher step (~scale²) to fit under ~10 ms, so raises never pump
  (backpressure stalls are the fallback signal without
  `timestamp-query`).  Shortly after drawing stops (~250 ms) one frame
  re-renders at max, so still images are always full resolution — low-res
  frames only ever exist mid-interaction on expensive scenes.  Scaled
  frames draw into an offscreen target and a fullscreen Catmull-Rom
  bicubic pass upscales to the canvas (preserves SDF borders and
  hairlines far better than bilinear).  Raster LOD floors (edge width,
  node size) apply in render px; label thresholds (`labelFadePx`,
  `labelMinPx`) are readability criteria and apply in *displayed* px, so
  labels don't blink out when the scale drops mid-gesture.  Picking
  always runs at native resolution.  Pin `min === max` for a fixed
  scale.  (ndex-x-large fit-all pan at dpr 2: settles at 0.5 within
  ~0.8 s, 25 → 76 fps; far-zoom and idle stay native.)
- **Label LOD**: labels fade below `labelFadePx` (glyphs past the fade's
  zero point are culled in compute, not drawn at zero alpha); the optional
  `labelMinPx` renderer option hard-culls labels whose on-screen glyph
  height is below it — too small to read anyway (default 0 = off).
- **Labels**: nodes only, single line (newlines collapse to spaces), fixed
  placement (horizontally centered below the node), not pickable, and the
  glyph atlas is a fixed 1024² texture — once full, new glyphs stop
  rendering with a console warning.  Label color/text bake into glyph
  instances, so `:selected`/hover styling does not restyle label text.
- Pinch zoom is deferred; wheel/drag/hover/tap/grab are implemented.
- No device-loss recovery: the instance goes dead and emits an `error`
  event.

## Follow-up hooks

- Slot compaction (tombstones + degenerate quads for now; the cull pass
  already keeps tombstones out of the draw stream).  Removal also leaks
  id-blob bytes and freed CSR adjacency space until such a compaction —
  the same tombstone policy throughout.
