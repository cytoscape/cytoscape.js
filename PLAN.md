# WebGPU model + renderer prototype (first pass of #3486)

**Status: implemented** on `feature/webgpu` (11 commits, `e30542cf4..9b177c193`),
including SDF node labels, which were pulled into scope after the base pass
landed so labelled rendering could be assessed for performance.  All
verification below is green.  `src/gpu/README.md` is the maintained scope /
deviations doc; this file records the plan and its outcome.

## Context

Issue #3486 specs a v4 performance redesign: columnar/GPU-native model, persistent GPU buffers, WebGPU rendering. This first pass, on `feature/webgpu` (branched from the TS refactor, PR #3477), builds a **separate v4-style prototype** — not a mode of the canvas renderer like WebGL. It ships a new GPU-oriented data layer with the familiar synchronous core/element API on top, plus a WebGPU render pipeline. The existing v3 core, collection, and renderers are **not modified**.

Agreed constraints (from user):
- **CPU-canonical columnar model**, write-through to persistent GPU buffers via dirty-range uploads. Sync API reads always hit CPU typed-array columns. Model works headless (Node-testable, no GPU). ✅
- **Parallel core** in a new directory with its own entry point; familiar API shapes. ✅
- **API scope**: core — viewport fns, events, graph manip, grid layout only. Collections — events, graph manip, position/dims, iteration, comparison, building/filtering, basic traversal (outgoers etc.), select/unselect. **No**: animations, stylesheets (constrained compiled-style blocks instead, constants only, no mappers), other layouts, algorithms, compound nodes, `data()` (deferred; ids/source/target are first-class). ✅ — with one deliberate scope addition: the `label` style prop accepts the single mapper `data(id)`, since ids are first-class.
- **Rendering scope**: SDF node shapes, straight edges (endpoints read from node position buffer on-GPU), GPU picking, basic culling/LOD. Originally **no labels or arrows**; **SDF labels were added** in the follow-up commits (see below). Arrows remain out. ✅
- **Hard error** when WebGPU unavailable (only when a container is given; headless never throws). ✅

## Directory layout (as built)

```
src/gpu/
  index.mts              # default factory cytoscapeGpu(options); hard-error gate; wires model↔renderer↔pointer
  gpu-types.mts          # public option/type surface (incl. GpuRendererOptions LOD knobs)
  core.mts               # GpuCore facade: add/remove/getElementById/elements/nodes/edges/$/filter/
                         #   collection, on/off/one/emit/promiseOn, style(), layout(), pick(), destroy(), width/height
  collection.mts         # GpuCollection ("element is a length-1 collection", v3-style; interned handles)
  viewport.mts           # zoom/pan/panBy/fit/center/extent state + math (core-owned; core emits the events)
  events.mts             # single core Emitter (reuse src/emitter.mts) with ref/selector-qualified listeners
  selector.mts           # mini selector: node|edge|*, #id, :selected/:unselected, comma lists
  style.mts              # StyleEngine: constant-value blocks compiled into channel columns + label sidecar
  layout/grid.mts        # ported grid layout (cell-packing math from src/extensions/layout/grid.mts)
  store/
    graph-store.mts      # GraphStore: NodeTable + EdgeTable + IdMap + Adjacency + label sidecar; mutation API
    table.mts            # ColumnTable: typed-array columns, x2 growth, free-list, generations
    id-map.mts           # string id ⇄ slot dictionary (ids unique across groups)
    adjacency.mts        # per-node incremental out/in incident-edge lists (not CSR)
    dirty.mts            # DirtyTracker: per-column coalesced [min,end) span, resized flag, touch() for sidecars
  contract.mts           # model↔renderer contract: ColumnId specs, flag bits, ModelView, StoreDelta, LabelEntry
  gpu-context.mts        # adapter/device/canvas configure, device-lost handling
  render/
    renderer.mts         # frame graph: rAF render-on-dirty loop, pass ordering, ResizeObserver/DPR, stats()
    column-mirror.mts    # GPU storage-buffer mirror; dirty-span writeBuffer; realloc+full re-upload on resized
    node-pipeline.mts    # node render + picking pipelines (vertex pulling, 6 verts/instance)
    edge-pipeline.mts    # edge render + picking pipelines (endpoints fetched from node position buffer)
    label-pipeline.mts   # SDF label pipeline (glyph instances; draws after nodes; not pickable)
    label-layer.mts      # consumes the label-dirty channel; lays out glyphs into the GlyphBuffer
    label-layout.mts     # pure single-line centered glyph layout (Node-testable)
    glyph-atlas.mts      # runtime SDF atlas: canvas-2D raster → exact EDT → shelf-packed r8 texture
    glyph-buffer.mts     # persistent glyph-instance buffer: per-node ranges, tombstones, compaction
    picking.mts          # r32uint picking texture, 3-buffer staging ring, latest-wins async pick()
    shaders.mts          # all WGSL as template-literal strings (SDF ported from webgl/shader-sdf.mts)
    webgpu-constants.mts # numeric usage/stage flags so render modules stay Node-importable
  interact/pointer.mts   # pointer/wheel: pan, zoom-about-cursor, hover, tap-select, node drag
  README.md              # scope + accepted deviations (the maintained doc)
debug/webgpu/            # dev harness: network/bg/LOD/labels URL params, ?gen=NxM generator, stats overlay
playwright-page/webgpu.html
playwright-tests/webgpu.spec.js
test/gpu-*.mjs           # 16 Node-runner suites (auto-picked-up by the test:js glob)
```

## Model half — implemented as planned

Columns, flag bits and shape ids are exactly as originally specced; `contract.mts` is the co-signed source of truth and was implemented first. Key decisions that held up:

- **Stable slots**: free-list + tombstones (cleared flags) + per-slot generation counters; renderer draws `highWater` instances, dead ones collapse to degenerate quads in the VS. No compaction in pass 1.
- **Dirty tracking**: one coalesced `[min,end)` span per column per frame + `resized` flag; `takeDelta()` returns-and-clears; `onInvalidate(cb)` fires ≤ once per microtask. Extended with `touch()` so non-column sidecars (labels) join the same scheduling.
- **Adjacency**: incremental per-node `outEdges[]`/`inEdges[]` (O(1) degree, cascade removal). CSR deferred.
- **Element handles**: interned singleton length-1 collections per live slot; `{group, slot, gen}` refs validated on access; cached `id()`/`group()` stay readable after removal (needed for `remove` events).
- **Events**: single core `Emitter` (src/emitter.mts unmodified) with per-ref listeners for collections and selector qualifiers for the core. Emitted: add, remove, position (skipped when no listeners), select, unselect, zoom, pan, viewport, fit, layoutstart/ready/stop, style, render, destroy, error, tap, mouseover/mouseout.
- **Style**: constant blocks on `node|edge|*|#id` + `:selected/:unselected`; node channels background-color/width/height/shape/opacity/border-*, edge line-color/width/opacity; **plus label/font-size/color** (label sidecar, `data(id)` allowed). Applied on setBlocks, add, and select/unselect. Equal-radii ellipses compile to the exact circle SDF.
- **Grid layout**: cell-packing math ported verbatim; bulk `store.setPositions` (one dirty span) + layout events; `cy.layout({name})` errors on anything but `grid`.
- **Positions**: Float32 canonical; headless dims via `headlessWidth/headlessHeight` (800×600 defaults).

## Render half — implemented as planned, plus labels

- **Init/ready/device-lost**: as specced (sync throw without `navigator.gpu`; `.ready` rejects on null adapter; premultiplied canvas; dead instance + `error` event on loss).
- **Frame uniform**: 48-byte struct — viewportPx, panPx, zoomDpr, edgeWidthFloor, nodeLodPx, hidePx, edgeDim, labelFadePx (+2 pads). Not a mat3x3, as planned.
- **Node/edge pipelines**: pure vertex pulling from the mirrored columns; colors bound as `array<u32>` + `unpack4x8unorm` (byte-identical uploads); border band + selected accent ring (#0169d9) + hover/grab brighten in the node FS; edges extrude in screen space and fetch endpoints from the node position buffer (drags follow on-GPU).
- **Z-order**: single pass — edges, then nodes, then labels; slot order within a group. **Early-z (added)**: a depth buffer + node depth prepass (opaque interiors only, conservative cheap SD tests, no Newton solver) kills edge fragments under opaque nodes before blending; depth = per-element z-rank (edges far / nodes near), designed to generalize to `z-index`/compound ordering as more ranks + batches. Pixel-identical output (verified by screenshot diff); ndex-x-large fit-all at dpr 2: 37.7 → 31.4 ms.
- **ColumnMirror**: per-column storage buffers, span uploads at `start × bps`, realloc + full re-upload on `resized` with `destroy()` deferred behind `onSubmittedWorkDone()`, version-bumped lazy bind-group rebuild. Unit-tested against a mock GPUQueue.
- **Picking**: r32uint id target, same draw order, ids 0/slot+1/high-bit-edge; latest-wins requests through a ring of 3 staging buffers (drop-to-null when full). Exposed as `cy.pick(x, y)`. Reworked after the initial pass (the original full-scene pick pass + unbounded frame queueing made hover picks take ~1 s on GPU-bound graphs): the pick pass now draws a fixed 64×64 cursor-centered tile — a pick-specific Frame uniform whose viewport is the tile turns the shaders' own conservative culling into cursor-region culling, O(region) not O(scene) — submits in its own command buffer ahead of scene work, reads back a single center texel, and pick-only frames skip the scene pass entirely. Scene submissions are capped at 2 in flight (backpressure; a behind GPU coalesces state into the next frame instead of queueing deeper). Result at 100k×300k: hover-while-panning pick latency ~956 ms → ~70 ms median, idle picks ~58 ms → ~13 ms.
- **Culling/LOD**: originally VS conservative collapse; now a **compute cull pre-pass + drawIndexedIndirect** per group (nodes, edges, glyphs) — a deterministic three-dispatch stream compaction (count / serial scan / scatter with a workgroup Hillis-Steele scan) that preserves slot order, with an exact Liang-Barsky segment-vs-rect test for edges; the pick pass reuses the kernels with the pick-tile uniform (O(region) picks). LOD: edge width floor with alpha compensation; **far-zoom edge decimation** (below half alpha, a hash-stable 1-in-N subset at N× alpha, N ≤ 64); plain-disc nodes below ~3 px; sub-pixel size flooring with alpha compensation; optional zoom-based edge dimming. Indexed instance quads (4 VS invocations per quad via vertex reuse). Node decoration columns moved to the fragment stage (flat-instance fetch) to stay within per-stage storage-buffer limits. ndex-x-large pan benchmarks (GPU ms/frame): far zoom 33 → 3.5; zoomed-in 20× at dpr 1 12.4 → 8.8; fit-all at dpr 1 18.5 → 10.2; labels at 117k glyphs now ~free (38.6 vs 37.7 ms at dpr 2 fit-all).
- **Labels (added)**: runtime SDF glyph atlas (TinySDF-style canvas raster → exact Euclidean distance transform → one shelf-packed 1024² r8 texture, glyphs added lazily; edge encoded at sample 0.5, fwidth-AA in the FS). Persistent glyph-instance buffer (40 B/glyph) with per-node ranges, tombstones + compaction, coalesced span uploads and ColumnMirror realloc rules. Glyph instances reference the **node slot**, so labels follow drags/layouts on-GPU with zero rebuild (a node move uploads 8 bytes). Labels fade out below `labelFadePx`; single-line, centered below the node, not pickable.
- **Interaction**: wheel zoom-about-cursor, drag pan, throttled latest-wins hover picking (HOVERED bit + mouseover/mouseout), pan-vs-grab via an exact synchronous CPU node pick (no staleness), node drag through the core position API, tap-toggle selection (shift additive, background clears). Hover picking pauses during viewport-only gestures (pan drags never pick; wheel zooms suppress picks and re-pick once settled). Pinch deferred.
- **Pick fast paths (added)**: nodes pick synchronously on the CPU (columnar scan replicating shader semantics — flooring, plain-disc LOD, shape tests, topmost wins; unit-tested); the GPU tile (now edges-only) reads back whole and doubles as a cursor-region pick cache invalidated on viewport/geometry changes. ndex-x-large at dpr 2: node hover ~0 ms, cold edge/background ~7 ms, cached ~0.2 ms, hover-while-panning median ~0 ms (was ~70 ms), with zero GPU pick passes for node hovers and cache hits.
- **Frame timing**: `stats()` reports `cpuFrameMs` (encode/submit cost, ~0.1 ms by design) separately from `gpuFrameMs` (real frame GPU time via the optional `timestamp-query` feature — the span across the cull/render/upscale passes, which is robust to backends that emulate pass-boundary timestamps at command-buffer granularity) — CPU-side timers cannot see GPU execution, which is what bounds fps on large graphs.
- **Adaptive render scale (added)**: `renderScaleMin`/`renderScaleMax` band (defaults 0.5/1), quarter steps driven by median `gpuFrameMs` over ~400 ms windows (drop > 14 ms; raise only when the projected cost at the higher step fits under 10 ms — no pumping; backpressure stalls as the no-timestamp fallback; pure `ScaleController`, unit-tested). Idle settles back to max after ~250 ms so stills are always native — chosen over a static scale because far zoom is maximally resolution-sensitive (floors are render-px-defined, sub-pixel statistics change, decimation engages earlier) yet nearly free at native after decimation+culling. Scaled frames render offscreen + Catmull-Rom bicubic upscale (9 bilinear taps). Verified: fit-all pan at dpr 2 steps 1 → 0.75 → 0.5 within ~0.8 s (25 → 76 fps, 8.3 ms GPU); idle returns to 1; far-zoom pan holds 1. Picking stays native; `labelMinPx` option hard-culls unreadably small labels in the glyph cull predicate.

- **Whole-graph fit fast path (added)**: no-arg `fit()`/`center()` compute bounds via `GraphStore.boundingBox()` — a direct columnar scan (nodes: position ± size/2 + border/2; edges as a first-class extent term, today the endpoint centers) instead of materializing ~500k element handles through `cy.elements()`. ndex-x-large: 235 → 15 ms, identical zoom/pan. Future edge geometry (bezier, arrows) extends the edge term in the store scan and `GpuCollection.boundingBox` together.

## Integration — done

- devDep `@webgpu/types`; tsconfig `"types": ["@webgpu/types"]`.
- rolldown: `build/cytoscape-gpu.umd.js` (global `cytoscapeGpu`) + `build/cytoscape-gpu.esm.mjs`; the `FILE=umd` watch filter picks the gpu UMD up automatically (verified).
- package.json: `exports["./gpu"]`, gpu bundles in `dist:copy`, `debug/webgpu` in `watch:sync`.
- `debug/webgpu/`: network/bg/LOD/labels URL params, `?gen=NxM` random-graph generator, best-effort constant-prop conversion of the v3 fixture styles, FPS/counts/upload-bytes/glyphs/pick-latency overlay.
- playwright: `webgpu` project — `channel: 'chromium'` new headless + `--enable-unsafe-webgpu --enable-unsafe-swiftshader`, loading via `http://127.0.0.1:3333`; soft-skips without an adapter; the default chromium project ignores the webgpu spec.

## Verification — all green

- **Node tests** (`npm run test:js`): 16 gpu suites / ~240 gpu assertions within the 918-test suite — store, dirty contract, core graph manip, collection iteration/comparison/building-filtering/traversing, selectors, selection, events, viewport, style, grid layout, ColumnMirror (mock GPUQueue), labels model channel, label layout/EDT/GlyphBuffer.
- **Playwright** (`webgpu.spec.js`, 10 specs on a real Metal adapter): ready; hard error with `navigator.gpu` removed; headless never requires GPU; red-node-on-white composited pixels (pins premultiplied compositing); pick() node vs background; mouse-drag moves node in model + pixels; tap select/clear; label renders below node; label follows a move with ≤64 B upload; label LOD fade-out.
- **Manual/scripted**: `?gen=` harness runs verified via scripted Chromium (render-on-dirty confirmed: 1 frame while idle); typecheck and lint green.

### Benchmark (Apple Silicon Metal, 1280×800, continuous-pan steady state)

| | 25k nodes / 50k edges | 100k nodes / 300k edges |
|---|---|---|
| Glyph instances | 139k | 589k |
| FPS fit-all, labels off → on | 73 → 73 | 41 → 37 |
| FPS zoomed-in, labels off → on | 74 → 74 | 38 → 31 |
| One-time glyph build | ~0.8 s | ~4.1 s |
| Extra GPU upload for labels | +5.2 MiB | +22.5 MiB |

CPU stays ~0.1 ms/frame throughout — the renderer is GPU-bound (instance count in the VS). Steady-state labels are near-free at fit-all zoom (LOD collapse) and cost ≤~18% zoomed in at the 100k scale.

## Known deviations (accepted; detailed in src/gpu/README.md)

- Element/core listener firing order is registration order (not v3 bubble order).
- No z-index; edges under nodes under labels; within a group, slot order (reused slots draw at the recycled position).
- Float32 position precision (~7 significant digits).
- Pan-vs-grab uses the ≤2-frame-stale resolved pick.
- `cy.elements()` returns nodes then edges, not mixed insertion order.
- Labels: nodes only, single-line, fixed below-node placement, not pickable, fixed-size atlas, color/text baked per glyph run.
- `data()`, arrows, compounds, bezier, animations, non-grid layouts: still deferred.

## Follow-ups (informed by the benchmark)

1. ~~Compute-shader culling + `drawIndirect`~~ — done (see the culling/LOD
   section above).
2. ~~Batch the one-time glyph build~~ — **dead on re-measurement**: 100k
   labels (588,890 glyphs) build in ~160 ms (~1.6 µs/label; init-time delta
   110 ms wall), not the ~4.1 s / ~40 µs per label originally recorded.  The
   build path is unchanged since labels landed, so the original figure did
   not survive a controlled re-measurement (runtime `style()` apply → stable
   frame, CPU-profiled).  SDF raster/EDT is per *unique* glyph and cached in
   the atlas; per-label work is layout + instance emission only.
3. ~~Bulk element load~~ — **done** (the actual init bottleneck).
   Profiling the ndex-x-large load (28.6 MB JSON, 19.6k nodes / 465k
   edges, ~960 ms end to end) showed `cytoscapeGpu` init at 662 ms —
   dominated not by the columnar model but by eager per-element handle
   materialization (`GpuCollection` interning for 484k elements the loader
   never touches), a per-element `add` emit with no listener early-out,
   def-clone churn and the ~110 ms GC echo.  Landed as two pieces: (a) a
   bulk add path — no handles or emits on the factory load, clone-free def
   partitioning, one up-front table reservation, and `applyBulk` (the mini
   selector language resolves per (group, selected), not per element) —
   init 662 → 236 ms; (b) a **columnar elements form** (`{ columnar:
   true, ... }`, typed-array columns, integer-indexed edge endpoints,
   contiguous-slot memcpy ingest) with the compat converter
   `cytoscapeGpu.toColumnarElements(json)` — init 236 → 80 ms, and ~76 ms
   with a prebuilt payload (what fetching a binary format would enable;
   `JSON.parse` itself is 90–113 ms on this fixture).  The serialized
   wire layout for the columnar form is also **done**: one little-endian
   ArrayBuffer (header + columns; ids as a UTF-8 blob + prefix offsets
   with an ASCII fast path) via `cytoscapeGpu.serializeElements` /
   `deserializeElements`, accepted directly by
   `options.elements`/`cy.add()`.  Numeric columns deserialize as
   zero-copy views; deserialize is ~5 ms on this fixture (replacing the
   90–113 ms parse + 27–48 ms convert of the JSON path) and the payload
   is 9.2 MB vs 30 MB JSON.
4. ~~`data()` sidecar~~ — **done**, columnar like everything else:
   per-(group, key) adaptive columns (f64 + presence for numbers,
   dictionary-encoded strings, plain-array fallback), `ele.data()` with
   v3 semantics (immutable id/source/target, `data` events), ingest from
   defs, columnar `data:` columns and the wire (v2 data blocks — f64 and
   dictionary indices deserialize zero-copy).  Labels now take any
   `data(key)` mapper and refresh on data writes.
5. ~~Perf round 2 (post-load-path)~~ — **done**: (a) grid layout got a
   slot path (no handles; bulk `setPositions`; 200k nodes 270 → 24 ms)
   plus a new **preset layout**; (b) the id index went blob-native —
   UTF-8 blob + open-addressing probe table, no stored JS strings, lazy
   per-slot decode; packed wire ids ingest with zero string
   materialization (484k ids: ~69 ms Map inserts / ~50 MB → ~10 ms /
   ~9 MB); (c) adjacency is CSR built in two counting passes from the
   endpoints column, with a per-node overlay for incremental adds
   (~15.5 MB of per-node arrays → ~4 MB).  Wire-payload init on
   ndex-x-large: ~106 → 68 ms median (deserialize itself ~0 ms).
6. Cheap wins remaining: arrows, pinch zoom.
