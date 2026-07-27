# WebGPU model + renderer prototype (#3486)

**Status: implemented and evolving** on `feature/webgpu`.  The base pass
(11 commits, `e30542cf4..9b177c193`) landed first — including SDF node
labels, pulled into scope so labelled rendering could be assessed for
performance — and subsequent rounds (follow-ups, API gap closure, the
selector removal, mappers, animation, image export, label testability)
are recorded below as "Landed (round N)" sections, each verified green
when it landed.  `src/gpu/README.md` is the maintained scope /
deviations doc; this file records each round's plan and outcome.

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
  style-scales.mts       # mapper DSL: object specs compiled to a closure-free IR + CPU evaluator
  style-schemes.mts      # named color schemes (viridis, ColorBrewer, ...) + sRGB↔OKLab
  animation.mts          # Animation + AnimationManager: CPU tween + queue; routes position to the GPU sink
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
    mapper-runtime.mts   # GPU mapper eval: program/stop/data packing + the per-frame runtime
    mapper-shaders.mts   # the eval kernel WGSL (scale math mirrors style-scales.mts)
    gpu-tween.mts        # GPU position tween runtime + kernel (per-slot from/to, now uniform)
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
  - **No event namespaces**: v4 drops namespaced events (`'tap.foo'`) — they are unused and cost a per-emit parse on the hot path. `emit()` treats an event string as bare type(s) only; the shared emitter's namespace parsing (retained for v3) is simply not exercised by v4. Listeners/emits should use plain type names.
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
- `data()`, arrows, compounds, bezier, non-grid layouts: still deferred (animations landed round 9; GPU layouts logged).

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
6. ~~Cheap wins remaining: arrows, pinch zoom~~ — **done**.  Triangle
   source/target arrowheads render as one quad per visible edge per
   enabled end off the edge cull stream, tips on the endpoint node's
   boundary computed on-GPU (drags/layouts need no rebuild); the vertex
   stage stays within WebGPU's base 8-storage-buffer limit (per-end
   color column binding; edge opacity folded into stored arrow alpha).
   Two-finger pinch zooms about the touch midpoint with grab
   cancellation and an inert leftover finger.  Playwright also runs on
   WebKit now (classic renderer specs green; WebGPU specs soft-skip
   until Playwright's WebKit build ships navigator.gpu).

All follow-ups are done.  Open hooks beyond pass 1: slot/blob/CSR
compaction, z-index ranks, compound nodes, bezier edges,
more layouts, a binary export of live graphs (serializeElements already
covers payloads).  (Mappers landed as the round-7 object DSL below.)

## API gaps vs v3

Pass-1 scope held, but a lot of the familiar v3 core/collection surface
was missing.  The **LHF** (buildable on the existing columnar/flag/
adjacency model with no new architecture) and **small-touch** (one
localized store/renderer/pointer change, no new subsystem) tiers are now
**done** — see "Landed" below.  What remains is split into **needs a
call** (a new selector type, storage, lifecycle, or readback path) and
**deferred** (already-declared out-of-scope blocks, for completeness).

### Landed (LHF + small-touch)

Done across 11 isolated commits, each with Node tests (interaction-gated
behaviour also covered by Playwright).

Core:
- Viewport math/setters: `reset`, `viewport({zoom,pan})`, `minZoom(v)`/
  `maxZoom(v)`/`zoomRange` setters, `getFitViewport`/`getCenterPan`
  (compute without committing), `renderedExtent`, `size`, `centre`.
  (`getZoomedViewport` skipped — internal in v3.)
- Introspection/aliases: `instanceString`, `isReady` (via a
  `_readyResolved` flag), `headless`, `styleEnabled`,
  `hasCompoundNodes`, `hasElementWithId`, `$id`, `mutableElements`,
  `window`, `options`.
- Events: `once`, `listen`/`bind`, `unlisten`/`unbind`, `pon`;
  `onRender`/`offRender`.
- `renderer()`, `forceRender()` (renderer got a public `requestRender`),
  `resize()`/`invalidateSize`, `makeLayout`/`createLayout`.
- Graph-level `data`/`removeData`/`scratch`/`removeScratch` (+`attr`/
  `removeAttr`), plain objects on the core.
- Interaction gating: `autolock`/`autoungrabify`/`autounselectify`
  (+`*Nodes` aliases) and `panningEnabled`/`userPanningEnabled`/
  `zoomingEnabled`/`userZoomingEnabled`/`boxSelectionEnabled`; all ctor
  options too.  `pan`/`panBy`/`zoom` gate on the programmatic flags; the
  pointer gates drag-pan/wheel/pinch on the `user*` flags and drag on
  grabbable+unlocked; `autounselectify` suppresses tap selection.

Collection:
- Reference/identity: `cy()` (was absent), `renderer()`, `element()`,
  `collection()`, `instanceString`, `hasElementWithId`, `indexOf`/
  `indexOfId`.
- Traversal (existing CSR adjacency): `roots`, `leaves`, `successors`,
  `predecessors`, `edgesWith`, `edgesTo`, `parallelEdges`,
  `codirectedEdges`, `components`/`component`/`componentsOf`,
  `allAreNeighbors`.
- Set/iter/degree: `byGroup`, `absoluteComplement` (+`complement`/
  `abscomp`), `diff`, `reduce`, `max`/`min` ({value,ele}), `sort`,
  `merge`/`unmerge`/`relativeComplement` aliases, `isLoop`/`isSimple`,
  `equal`/`equals`, `min/maxDegree`/`min/max{In,Out}degree`/
  `totalDegree`.  `degree`/`indegree`/`outdegree` are **singular**
  first-element accessors (undefined when the first element isn't a live
  node), as in v3 — the whole-collection sum is `totalDegree`.
- Dimensions: `renderedBoundingBox`, `renderedWidth`/`renderedHeight`
  (+outer), `renderedPosition` setter, `shift`/`silentShift`,
  `silentPosition(s)`, `midpoint`/`renderedMidpoint`, `source`/
  `targetEndpoint` (+rendered; node-center approx), `relativePosition`,
  `point`/`modelPosition` aliases.
- Data/scratch/json: `removeData` (+`attr`/`removeAttr`), per-element
  `scratch`/`removeScratch` (plain JS on the interned handle),
  `json`/`jsons`; `once`/`pon`/`listen`/`bind`/`unlisten`/`unbind`.
- Flags: `selectify`/`unselectify`, `grabbable`/`grabify`/`ungrabify`,
  `locked`/`lock`/`unlock`, `grabbed` getter, `show`/`hide`/`visible`/
  `hidden`.  `FLAG_GRABBABLE`/`FLAG_LOCKED` added; grabbable defaults on;
  def/ctor-level `grabbable`/`locked`.  `show`/`hide` turned out to be
  pure LHF — the cull kernels and CPU pick already mask on
  `SHOWN = ALIVE|VISIBLE`, so toggling `FLAG_VISIBLE` needed no shader
  change.
- `move()` for edges (re-endpoint in place via `store.moveEdge`).

Not yet ported from the small list: ~~`active`/`activate`,
`pannable`/`panify`, `inactive`~~ — landed in round 6 (below).

### Collection/core API performance

Benchmarked against the v3 analogue in `src/` via Mitata
(`npm run benchmark:gpu`, `BENCH_N` scales the graph; suites in
`benchmark/gpu/`).  The harness rotates over a pool of distinct operands
so V8 can't hoist pure loop-invariant calls out of the measured region —
without that, allocation-free ops (e.g. `same()`) mis-report by 5 orders of
magnitude.  On a 2k-node/4k-edge graph:

- **Where v4 wins big**: `degree`/`totalDegree`/`maxDegree` ~100–230× (O(1)
  off the adjacency index vs v3 rebuilding `connectedEdges`); `add`+`remove`
  ~32×; `components` ~30×; `intersection`/`difference` ~24×; `collection()`
  ~14×; mutations (`data`/`position` set) ~10–12×; `map` ~2.6×; traversal
  1.5–4×.
- **Optimizations applied** (each its own commit, all revealed by the
  benchmark): pure `#id` selectors resolve through the O(1) id index instead
  of materializing + scanning the graph (`$('#id')` went ~420× slower →
  ~3× faster than v3); set membership keys on a packed `{group, slot, gen}`
  integer instead of a `group:slot:gen` string; each collection lazily
  caches its membership `Set` (sound — `_refs` is immutable), so
  `same`/`contains`/set ops are O(other) once a collection is reused
  (`contains` ~13× slower → ~4× faster); subset results
  (`filter`/`nodes`/`edges`/`slice`/`difference`/`intersection`) spawn via a
  dedupe-skipping `_spawnUnique`; `map`/`forEach`/`filter` preallocate and
  hoist the `thisArg` branch; `position()` reads its column once.
- **Columnar flag-selector scan (perf round 3)** — closed the residual
  whole-graph losses without copying v3's maintained-set approach.  The
  mini-selector language minus `#id` (which keeps its id-index path) is
  entirely (group, flag-mask) predicates, so `compileFlagPlan` compiles any
  flag-only selector to per-group `(mask, want)` tests and
  `GraphStore.scanRefsInto` answers them with one preallocated pass over
  the flags column — no handles, no per-element term matching; today's
  pseudos always collapse to one test per group (a multi-flag language
  would generalize to a test list).  `cy.elements/nodes/edges/filter/$`
  route through it (`_select`: id index → flag scan → materialize+match
  fallback for mixed id+flag comma lists), collection `filter(selector)`
  tests refs against the plan directly, the interned-handle pool went
  `Map` → dense slot-indexed array, and scan-built collections skip
  `_eleFromRef` (refs known current).  Callback iteration
  (`forEach`/`map`/`filter(fn)`/`some`/`every`/min/max) now plain-calls
  when no `thisArg` is given, matching v3's semantics (`this` is
  undefined, not the element) — rebinding the receiver per element via
  `fn.call()` cost ~2× at 20k.  Verified at N = 2k/20k/200k (the focused
  `benchmark/gpu/materializers.mjs` sweep runs where the full suite
  can't): `$(':selected')` ~2× slower → 16–59× faster, `$('node')` →
  9–14×, `$('node:selected')` → 46–166×, `nodes(':selected')` → 70–198×,
  `nodes()`/`edges()` → 3–9×, `elements()` ~2.6× slower → ~parity-to-2×
  faster, `filter(fn)` flipped to a win, `forEach` ~3.3× slower → ~1.8×.
- **Columnar bulk writes (perf round 4)** — the write-side counterpart of
  round 3, driven by a new `benchmark/gpu/mutators.mjs` sweep (whole-graph
  mutation round-trips vs v3 at 2k/20k/200k; `BENCH_OP` runs one group per
  process at 200k, where eight v3 instances exceed the heap).  The sweep
  exposed `eles.select()` as the one outright loss: per-element
  `_applyStyle` (a defaults-spread + full block match per element) and an
  unconditional per-element emit made 200k-node select+unselect 178 ms —
  behind v3 at 2k and only ~1.4× ahead at 200k.  Fixes, each revealed by a
  benchmark line: (a) `GraphStore.flagRefs` — one bulk flag pass over a
  collection's refs with the flags/gen columns hoisted out of the loop, a
  `requireBit` filter (selectable-only for selection), changed-index
  collection and one coalesced dirty span per group — now backs
  select/unselect *and* all `_setBit` mutators (`show/hide`, `lock`,
  `grabify`, `selectify`); (b) select/unselect skips restyle outright
  unless some block matches on `:selected/:unselected`
  (`StyleEngine.dependsOnSelection`; the accent ring is shader-drawn, so
  the default stylesheet never restyles), else restyles only the changed
  slots via `applyBulk`; emits are gated on registered listeners;
  (c) `shift()` and constant/partial `positions()` write the position
  column directly (`GraphStore.shiftPositions`/`setPositionsConst` — no
  per-element handles, callbacks or Position allocations) and the
  `positions(fn)` path reads previous coords off the column instead of
  allocating via `position()`.  At 200k vs v3: select+unselect 178 → 6.2 ms
  (1.4× → 38×), hide+show 2.4 ms (~1400×; v3 pays a style bypass per
  element), lock 96×, positions(obj) 71×, positions(fn) 44×, shift
  18.8 → 2.6 ms (106×), remove+re-add of a 256-node band ~1000×.  The gpu
  side improved 3–54× per op at 2k (select 54×, shift 5×, lock 8×,
  hide 6×); `data set` is dominated by per-(group,key) column resolution
  and stayed ~1× (16–22× over v3; its 200k timing is GC-noisy on both
  sides).
- **Slot-native traversal (round 4b)** — traversal walks built results by
  pushing refs per adjacency hit and re-deduping in `_spawn` (a
  packRef-keyed Set over ref objects), iterated CSR runs through the
  iterator protocol, and `successors/predecessors` spawned a full
  collection per hop — ~10.5 s for one 20k-node closure on the benchmark
  ring (diameter ~N/3; v3 ~40 s).  Now every walk (`connectedEdges`/
  `connectedNodes`, `outgoers`/`incomers`, `neighborhood`,
  `roots`/`leaves`, `sources`/`targets`, `successors`/`predecessors`)
  collects current refs straight off CSR with an int-packed (group, slot)
  seen-set and index loops, and spawns through `_spawnLive` — a trusted
  `{unique, live}` constructor path that skips per-element
  `_eleFromRef` re-validation.  `neighborhood` pre-seeds the seen-set
  with its own elements instead of a `difference()` post-pass, and
  `successors/predecessors` is a raw slot BFS (no per-hop collections at
  all): 2k-node closure 92.7 ms → 352 µs (2.9× → ~725× vs v3).  Verified
  by `benchmark/gpu/traversal.mjs` at 2k/20k: the two residual v3 wins
  flipped (100-node-band `connectedEdges` 1.2–1.5× loss → 1.3–1.5× win,
  band `sources` 1.1–1.3× loss → 1.3× win), and the rest widened —
  `neighborhood` 2× → ~4×, `outgoers`/`incomers` ~3.4× → ~4.5×, band
  `neighborhood` 2.5× → ~5.4×, band `roots` ~64× → ~110×.  The ~2–5×
  ceiling on single-hop traversal is structural, not unfinished work: v3
  is already O(degree) there (each element object holds its incident
  edges as a direct array), and a traversal must *return* a v3-shaped
  collection — per output element the gpu side allocates a ref, dedupes
  and interns a handle, a floor comparable to v3 assembling its result
  from already-materialized objects.  Bulk writes have no such floor
  (they touch columns and return nothing), which is why `shift` can be
  ~106× while `outgoers` is ~4.7×; the big traversal multipliers only
  appear where an *algorithmic* layer was removed (the per-hop collection
  machinery in `successors`).
- **Scenario sweep (round 5)** — with the micro surface swept, the open
  question was whether the wins survive *composition* and the
  listener-gated emit paths the micro suites deliberately exclude (their
  emits never fire — no listeners are registered).
  `benchmark/gpu/scenarios.mjs` replays five composed traces with core
  listeners attached, at 2k/20k/200k (`BENCH_OP` one-group-per-process at
  200k; v3 instances styleEnabled + preset layout — the realistic app
  config, and required for meaningful v3 bounds headless).  Results (× vs
  v3): explore (2-hop expand + select + fit) 8.4/5.3/34×; select-all +
  whole-graph fit with 2N emits per iter 18/10/12.6×; 100-band drag with
  a position listener (800 emits/iter) 8.5/7.3/10.6×; remove + re-add
  256 + cascade with add/remove listeners 20/162/529×; dashboard refresh
  (bulk data write + mapped labels + filter(fn) + fit, data listener)
  3.8/4.0/4.2× before the fix below, 9.5/6.4× at 20k/200k after.  Emit
  cost itself is ~85 ns/listener call (~17 ms for 200k emits) — no
  batching policy is urgently needed.  Two fixes fell out: (a) `pan()`
  get returned a fresh `{x,y}` per call — now returns the live internal
  object (v3 parity; setters always swap in a new object), ~4× slower →
  ~2.3× faster; (b) the refresh trace exposed the **data-write label
  path**: `_onDataChanged` ran a *full* per-element style apply (defaults
  spread, every block matched, all six node channels + dirty spans
  rewritten) per element per write whenever any label mapped any data
  key — 64 ms of an 85 ms 200k bulk write.  Now the StyleEngine tracks
  which keys labels map (`labelDependsOn(keys)`, decided once per
  `_setData` call), and `refreshLabels(slots)` recomputes only the label
  sidecar, resolving the stylesheet once per selectedness like
  `applyBulk` (per-element fallback only under `#id` blocks); writes of
  unmapped keys skip the pass outright.  200k bulk write with
  mapper+listener: 85 → 37 ms.
- **Residual v3 wins** (micro-ops at 20k, accepted): `forEach` (~1.8×),
  `getElementById` (~1.4×), `data()`/`position()` get (~1.1×,
  noise-level).

### Landed (round 6 — the needs-a-call tier)

Five isolated commits (2026-07-24), each with Node tests; box selection
also has a Playwright spec (18 webgpu specs total, all green on a real
adapter).  `src/gpu/README.md` records the policies.

- **`active`/`pannable` states**: `FLAG_ACTIVE`/`FLAG_PANNABLE` bits;
  `activate`/`unactivate`/`active`/`inactive`, `panify`/`unpanify`/
  `pannable` through the bulk flag path.  v3 defaults (edges pannable,
  nodes not; per-def override); pannable overrides `grabbable()` and
  drag eligibility, so dragging a pannable element pans.
- **Batching** (`startBatch`/`endBatch`/`batch`/`batchData`/
  `batching`): v3 semantics — defers style application (first apply of
  added elements, sheet re-application, mapped-label refresh) to one
  bulk flush at the outermost `endBatch`, filtered to live refs; events
  keep firing; a sheet set mid-batch flushes as one `applyAll`.
  Renderer scheduling needed no deferral (the dirty tracker already
  coalesces per microtask), so `notify`/`noNotifications` have no v4
  counterpart.
- **Read-only style getters**: `style`/`css`, `renderedStyle`
  (length props × zoom), `numericStyle`, `effectiveOpacity`/
  `transparent`/`takesUpSpace`/`interactive`.  Values read back from
  the stored channels (columns + label sidecar); label channels of
  unlabelled nodes resolve through the sheet.  Setter forms throw — no
  per-element bypass in v4 (mappers are the per-element mechanism).
- **Core `json()` export**: elements (grouped, or flat via
  `json(true)`), sheet, graph data, viewport, gating flags; element
  json gained `locked`/raw `grabbable`/`pannable` (v3 parity).  The
  import/restore form throws (needs stored defs); exported elements
  round-trip through the definition form.
- **`selectionType` + box selection**: validated
  `'single'`/`'additive'` (ctor option; additive taps toggle without
  clearing, mult-sel keys shift/ctrl/cmd match v3);
  `GraphStore.refsInBox` answers the box query in one columnar scan
  over shown elements (v3 'contain': node bb incl. border fully
  inside, straight edges by both endpoint centers), public as
  `cy.elementsInBox`; the pointer boxes on mult-sel-key drags (or when
  panning is disabled) with a DOM overlay box and the v3 event flow
  (`boxstart`/`boxend`, `box`/`boxselect` per element).  Mouse/pen
  only.

### Needs a call — note only, don't build yet

- **Classes** (`classes`/`addClass`/`removeClass`/`toggleClass`/
  `hasClass`/`flashClass`): new per-element class storage + class
  selectors in the mini-selector + restyle on change.  Couples to the
  constrained (constants-only) style engine.  **Call made: not in v4** —
  see "Selector removal + stylesheet reshape" below.
- ~~**Style getters**~~ — the read-only surface landed in round 6
  (shape call: stored-channel truth, numbers + `rgb()` strings);
  `bypass`/per-element style *setters* remain out by design (the fn
  mapper is the per-element mechanism; `pstyle` stays internal-only in
  v3 and has no v4 counterpart).
- ~~**Batching**~~ — landed in round 6 with the v3 policy (defer style
  apply, keep events); `notify`/`noNotifications` deliberately have no
  v4 counterpart (the renderer is dirty-driven).
- ~~**Core `json()` *import*** and element `clone`/`copy`/`restore`~~ —
  **call made (round 10 planning, 2026-07-27): not in v4.**  Removed
  elements are terminally dead (see the design decision in
  `src/gpu/README.md`): their column bytes are tombstoned and the slot
  free-listed, so nothing keeps a removed element readable or
  restorable.  `restore()`/`clone()` and the import form of `cy.json()`
  are permanently closed; re-adding from kept definitions is the app's
  job (exported element json round-trips through `cy.add()`).
- ~~**Image export** (`png`/`jpg`/`jpeg`/`renderTo`)~~ — landed in round
  9.6 (below) as the offscreen render + buffer readback path;
  `renderTo` remains out.
- **`mount`/`unmount`**: the container is fixed at construction today;
  re-mounting means renderer teardown/re-init.
- **Lazy / slot-backed collections**: the only way past traversal's ~2–5×
  handle-materialization floor (see round 4b) is returning collections
  that hold slot lists and intern handles on demand — an API-shape change
  (it moves the cost of `eles[i]`/`forEach` from build time to access
  time, and complicates the "handles are interned singletons" invariant).
  **Call made (round 5): not warranted.**  The scenario sweep measured
  the floor in composed traces: in the worst one (dashboard refresh, the
  narrowest win) the per-element handle reads in `filter(fn)` cost
  5.2 ms of a ~90 ms iteration at 200k (vs 1.9 ms for a direct columnar
  scan) — ~4–6% of the trace — and the traversal-heavy explore trace runs
  a 200k click-interaction in ~45 µs median, 34× v3.  Revisit only if a
  real profile ever disagrees.
- Odds and ends that each need a small feature, not just wiring
  (~~`selectionType` + box selection, `active`/`activate`, `pannable`/
  `panify`~~ — landed in round 6): `multiClickDebounceTime`
  (multi-click), `eles.layout()`/`layoutPositions`/`layoutDimensions`,
  `boundingBoxAt` (bbox at a hypothetical position),
  `sortByZIndex`/`zDepth` (needs z-index),
  `padding`/`paddedWidth`/`paddedHeight`.

## Selector removal + stylesheet reshape (v4 API direction)

Decided in design discussion (2026-07-24) and implemented in one pass;
`src/gpu/README.md` ("Design decisions") is the maintained record.  The
decisions, explicitly:

- **v4 has no classes.**  The class system (`addClass`/class selectors)
  is not coming to v4; user-defined state lives in the columnar `data()`
  sidecar, with mappers and predicates supplying the styling/filtering
  behaviour classes provided in v3.
- **v4 has no selector strings at all.**  Rather than porting a dialect
  of the v3 selector language, the language is gone: `selector.mts` was
  deleted and replaced by `matcher.mts` — a **matcher IR** of structured
  queries (`{ group, selected }` today) compiled to the round-3 columnar
  flag scans.  Query objects answer whole-graph queries
  (`cy.nodes({ selected: true })`, throwing on unknown keys), predicate
  functions cover everything richer (lodash-style), including event
  delegation (`cy.on('tap', ele => ele.isNode(), cb)`, identity-compared
  in `off()`), and ids go through `$id`/`getElementById`.  `cy.$()` and
  string arguments to set ops/`edgesWith`/`components`/`remove`/`fit`
  were removed.  Future richer matching (data predicates, structural
  terms) extends the IR; any frontend (chained builder, serialized
  query) compiles to it.
- **Style is `{ nodes, edges }`** (keys renamed from `{ node, edge }`
  2026-07-24 to match the group names) — each key a props object
  (constants, camelCase or kebab-case, and mapper objects).  Selector
  blocks, `:selected` restyling and `#id` blocks are gone (the accent
  ring is shader-drawn).  The `(ele) => props` **function form was
  removed in round 8** (below): all per-element styling is declarative
  (`case` conditionals, `data(key)` scales), so every value is
  analyzable, serializable, and GPU-evaluable.  Refresh: a data write
  re-derives the affected mapped channels, key-gated.
- ~~**Mapper DSL direction**~~ — landed in round 7 (below), as a plain
  object spec rather than strings/builder; round 8 added conditionals
  and removed the fn form.

Verification: typecheck, lint, `test:js` (1221 passing, incl. the new
`gpu-query.mjs` matcher suite and rewritten style/events/flag-scan
suites), and all 17 Playwright webgpu specs on a real adapter.
Benchmarks compare idiomatic forms per side now (`cmp(name, v3Op,
gpuOp)` where they differ); `pointer.mts` tap-clear uses
`elements({ selected: true })`.

## Landed (round 7 — the mapper DSL, 2026-07-24)

Ten isolated commits (after a `{ nodes, edges }` sheet-key rename to
match the group names): OKLab + scheme tables → mapper compile/IR →
engine integration → data-write plumbing → program packing → GPU eval
(scalars, then colors) → ordinal dict path + mixed demotion → benchmark
→ docs.  All green throughout: typecheck, lint, `test:js` (1360 tests;
three new mapper suites), `test:modules`, 20 Playwright webgpu specs on
a real adapter.  `src/gpu/README.md` ("Design decisions") is the
maintained record; the shape, briefly:

- **Spec**: plain serializable objects as style prop values —
  `{ data, scale?, domain?, range?, clamp?, fallback?, ... }`.  Scales:
  linear/log/sqrt/pow/symlog, diverging ([min, mid, max]), ordinal,
  threshold, quantize.  Colors interpolate in OKLab (opt-out
  `interpolate: 'srgb'`) with named schemes (viridis family, ColorBrewer
  ramps, category10/dark2) and multi-stop ranges.  Missing/unmappable
  data → `fallback` else the channel default.  `domain` omitted/'auto'
  is a **live extent** (Vega-Lite semantics): re-checked on writes of
  the mapped key, whole-channel re-derive when moved.  Compiles to a
  closure-free IR (`style-scales.mts`): everything continuous lowers to
  one piecewise program over transformed stops; refresh is gated per
  (group, key); edge data writes now refresh edge channels; fn-sheet
  returns may not contain mappers; `label` takes the passthrough only.
- **GPU eval — the paint/geometry split**: paint channels (fill/border/
  line colors, opacities, arrow colors) evaluate in a per-group compute
  kernel that interprets a packed program array (64 B uniform structs +
  vec4 stop/LUT tables + f32 data-region shadows with present masks)
  and writes the *existing* channel buffers — render pipelines
  untouched, zero permutations, fits base device limits.  Data writes
  upload only the touched bytes and dispatch once (200k color write:
  78.5 → 15.9 ms; the getter answers by evaluating the shared IR
  lazily, within ±1/byte of pixels — Playwright-pinned).  Geometry
  (size, border-width, shape, edge width) + labels stay eagerly
  CPU-evaluated: anything read by culling, CPU picking, or columnar
  scans stays CPU-canonical.  Arrow alpha folds in-kernel; mapped arrow
  *shapes* and mixed-promoted columns demote to CPU; string ordinals
  run as dict-index LUTs (dict growth repacks); headless stays fully
  CPU-correct with no renderer.

## Landed (round 8 — conditionals + fn removal, 2026-07-24)

Direction set in discussion: maximize GPU offload / minimize CPU resolve
by making the analyzable mapper IR the *only* way to style, and removing
the one construct that can never be offloaded — the opaque style
function.  Isolated commits; all green (typecheck, lint, `test:js`,
`test:modules`, 20 Playwright webgpu specs).

- **CPU-evaluable invariant (established).**  Every mapper must be cheaply
  CPU-evaluable.  That is what keeps `ele.style()` synchronous, keeps
  headless mode and Node tests working (one IR runs on CPU, GPU, and in
  tests), and keeps determinism.  Reads stay **sync** — async reads were
  considered and rejected (viral, reentrancy windows, breaks
  headless/testability, and unnecessary while the IR is CPU-evaluable).
  GPU eval is an optimization over the IR, never a value source the CPU
  can't reproduce.  Async is reserved for genuinely GPU-only reads
  (rendered pixels, image export).
- **`case` conditional mapper.**  `{ case: [{ when: { data,
  gt/lt/eq/ne/in/... }, then }], else }` — ordered clauses, conditions
  AND-ed within a clause, first match wins; `when` reads any data key or
  the first-class `id`.  The declarative replacement for `(ele) => cond ?
  a : b` and the form for typed edges.  Compiles to a closure-free
  program; CPU-evaluated (multi-key), so the GPU eval kernel is
  untouched.  Dependency tracking generalized to `CompiledMapper.keys`.
- **The `(ele) => props` fn form removed.**  `GpuStyleFn` is gone; the
  sheet is props-only.  The engine collapsed to one path (no `def.fn`
  branches in applyBulk/refreshMapped/labelChannels/setSheet, no
  fn-return throw, `eleFor` dropped).  Selection-dependent recolouring
  is intentionally gone (the accent ring is shader-drawn); id-based
  styling migrates to `case` on `data: 'id'`.  Tests/docs migrated.
- **Deferred:** derived-data *expression* mappers (arithmetic over keys —
  no current use needs them); and geometry channels → GPU eval (the
  direct ~48 ms/200k offload, but it inverts the store→style layering
  since `boundingBox`/`refsInBox`/CPU-pick read resolved size — a later
  round).

## Landed (round 9 — animation, 2026-07-24)

Direction (discussion): animation is a v4 priority and should scale.  API
first, on the CPU-canonical path (complete + correct + Node-testable); a
GPU tween fast path is the planned optimization underneath, transparent to
the API.

- **Animation API + CPU tweening** (`src/gpu/animation.mts`).  Tween
  element style/position (and the viewport) from captured start values to
  explicit targets over a duration, easing normalized time.  Collection:
  `animate`/`animation`/`animated`/`stop`/`delay`/`delayAnimation` +
  `promise()` + a per-element queue; core: `animate` (viewport pan/zoom),
  `animated`, `stop`.  Each tick writes the store columns (works headless;
  a rAF-or-timeout auto-driver, plus a deterministic `tick(now)` for
  tests).  Standard easings.  Animatable: `position`, node `opacity`,
  `border-width`, `background/border/line-color` — the coupling-free set;
  size (width/height circle-collapse) and arrow-folded channels are a
  follow-up.
- **Ownership: transient lease** (design set this round).  A tween is
  CPU-reproducible (pure fn of time), so the CPU columns stay
  authoritative on the CPU path.  The lease model — default
  CPU-authoritative, GPU-authoritative during a position episode with
  readback-on-settle — is the shared substrate for the GPU tween path and
  (later) GPU layouts.  **Grabbing is forbidden while an element
  animates** (`pointer.canDrag` consults `isAnimating`), removing the
  two-way drag-feedback boundary.
- **GPU position fast path** (`render/gpu-tween.mts`, landed).  Position
  animations offload to a compute pass: per-slot from/to uploaded once, a
  `now` uniform bumped per frame, `node.position = mix(from, to, ease(t))`
  on-device in its own pre-cull pass (barrier → cull + edges read the
  tweened positions).  `node.position` is GPU-owned during the tween (the
  mirror skips its uploads), CPU reads stale, settle-on-complete
  re-derives the exact final on the CPU (no readback — tween is
  CPU-reproducible).  The renderer drives the frame clock while active;
  the manager routes position-only animations to the sink and cedes its
  auto-loop.  Playwright proves the lease on a real adapter (CPU
  `position()` stays at start mid-flight while the node moves; settles
  after).  Paint/size GPU tweens are a follow-up.
- **Deferred:** GPU tween for paint/size channels; and **GPU layouts**
  (stateful, not CPU-reproducible → GPU-authoritative-with-readback + a
  CPU reference for headless) — reuse the lease machinery; per-algorithm
  kernels are a future round.

## Design discussion (2026-07-24) — GPU geometry & the read-staleness contract

Direction set in discussion after round 9, ahead of building the paint/size
GPU tween extension.  No code yet; these are the locked calls that scope that
work and the expensive-geometry cases (multiline labels, bundled bezier) that
sit behind it.  `src/gpu/README.md` ("Design decisions") is the maintained
record.

- **Paint tween is the clean next extension; size is a geometry-tier
  project.**  The `gpu-tween.mts` runtime generalizes to paint channels
  (`node.opacity`, fill/border/line color, `edge.opacity`) with low risk —
  paint has **no CPU consumer** (cull, CPU pick and columnar scans never read
  it, which is why it went GPU-evaluable in the mapper split), so a paint
  tween owns its column with no staleness hazard.  Work: widen `fromTo` for
  color (two `vec4f` per slot; sRGB per-channel to match the current CPU
  tween unless we deliberately unify on OKLab), fold `edge.opacity` into
  arrow alpha in-kernel, and an ownership-precedence rule so an active tween
  wins over the mapper eval kernel writing the same channel.  **Size**
  (`width`/`height`/`border-width`, `edge.width`) is *not* a peer: it is
  geometry read by cull, CPU pick, and every columnar scan, so a GPU-owned
  size tween reopens the store→style layering seam R8.5 flagged and belongs
  with that geometry work.  Recommendation: ship paint-only (an R9.4), bundle
  size with the R8.5 geometry-seam work.

- **The read-staleness contract.**  A frame-stale sync-read contract (GPU
  owns expensive geometry, CPU reads a frame behind) was floated and
  **rejected as a default**, for three reasons: (1) read-after-write is
  pervasive and load-bearing — `data()`/`position()` then `width()`/`bb()`
  in one synchronous tick must reflect the write (layouts, extensions, user
  code all rely on it); (2) headless has no frame and no readback, so it
  would still need the complete CPU implementation *plus* a weaker contract —
  strictly worse than CPU-canonical; (3) "a frame stale" is undefined in
  synchronous code (a build-graph → query-bbs loop never yields to a frame,
  so staleness is unbounded, not one frame; real GPU→CPU latency is 1–3
  frames regardless).  Staleness is admitted **only for values already in
  frame-driven motion** — the position tween lease is exactly that, and
  `edge.bb()` mid-tween inheriting it is consistent, not a new rule.  A
  discrete user write is never stale.  Escape hatch for GPU-exact geometry
  after a write batch: an explicit `await` on a settle/flush, not a relaxed
  sync default.

- **Expensive GPU geometry → dual implementations, not readback** (multiline
  labels, bundled bezier — v4-but-not-yet).  These are expensive *and* read
  by `.bb()`, so the position lease's no-readback trick doesn't apply
  directly (they aren't cheaply CPU-reproducible).  The model: **two
  deterministic implementations that agree by construction** — WGSL for
  render, CPU for reads, run on the same inputs, neither reading back the
  other — the OKLab-LUT/mapper-table discipline generalized to expensive
  computations.  The standing cost is keeping the two impls bit-agreeable
  (divergence = bb-doesn't-match-pixels), which is the actual gate on whether
  GPU is worth it per case.  Two consumer tiers keep it affordable: **cull/
  fit read a cheap conservative CPU over-approximation** (guaranteed to
  contain the true box), **public `.bb()` triggers the exact lazy CPU
  compute, memoized per element**.  For bezier: control points are
  `f(positions, membership)` — stale via the position lease mid-tween
  (consistent), settle when positions are reclaimed; bundle *membership* is a
  cheap CPU structural index rebuilt on add/remove edge, not per frame.

- **Labels are model-space only** (no viewport-fixed mode).  `font-size` and
  the wrap width are both model coordinates (v3 parity).  Load-bearing three
  ways: (1) line breaking is zoom-invariant (font-size and wrap width share a
  space), so shaping — the expensive part — **memoizes** and the GPU metrics
  pass runs on text/font/wrap writes, not per frame (a *mixed* space reflows
  on zoom and defeats both memo and offload); (2) **image export is WYSIWYG**
  — a `full`/high-`scale` export is the screen arrangement over identical
  shaping, so scientific figures don't reflow between screen and export and
  the export reuses the screen memo; (3) v3 parity, so existing figures
  reproduce.  Screen-space labels were rejected: they break export WYSIWYG
  (reflow at a scale ≠ current zoom) and their apparent legibility win on
  dense graphs is overlap that makes a worse figure (a data-density limit,
  answered editorially, not by a coordinate system).  The visibility
  sub-decision was taken in round 9.6: label LOD thresholds evaluate at
  **export scale** (self-consistent figure), as leaned.

### Deferred by design (out of scope for the prototype)

- **Compounds**: `parent`/`parents`/`children`/`descendants`/
  `commonAncestors`/`siblings`/`orphans`/`nonorphans`/`isParent`/
  `isChild`/`isChildless`/`isOrphan`, and compound-relative
  `relativePosition`/`padding`/bounds.
- ~~**Animations**~~ — landed in round 9 (CPU-canonical path; below).
- **Graph algorithms** (`src/collection/algorithms/*`): bfs/dfs,
  dijkstra, aStar, kruskal, bellmanFord, floydWarshall, pageRank, all
  centralities (degree/closeness/betweenness), all clustering
  (markov/k-means/k-medoids/fuzzy-c-means/hierarchical/affinity), tarjan
  & hopcroft-tarjan, hierholzer, kargerStein.
- **Bezier/segment geometry**: `controlPoints`/`segmentPoints`/
  `isBundledBezier` and curved edge rendering — a v4 direction, in the
  expensive-geometry tier (see the design discussion above): dual CPU/WGSL
  impls, conservative CPU bound for cull/fit, exact lazy CPU `.bb()`,
  membership as a structural index.
- **Full stylesheet + mappers** beyond the constant blocks and the label
  `data(key)` mapper; layouts beyond grid/preset.

## Landed (round 9.4 — GPU paint tweens, 2026-07-27)

Executes the paint half of the round-9 follow-up under the design calls above.
The scope correction made while planning it: `border-width` was listed with the
paint channels in round 9, but it is **geometry** — `boundingBox()` reads
position ± size/2 + border/2 — so it stays CPU-canonical and moves to the R8.5
geometry-seam work.

- **Paint/geometry tiers** (`animation.mts`).  Channels carry a `tier`:
  *paint* (`opacity` both groups, `background-color`, `border-color`,
  `line-color`) may offload, *geometry* (`border-width`, and later size /
  `edge.width`) may not.  Paint has **no CPU consumer** — nothing in cull, CPU
  pick, or a columnar scan reads it, which is why it went GPU-evaluable in the
  mapper split — so a tween can own the column outright.  Eligibility is
  all-or-nothing per animation, so a column is never half-owned.
- **One capture, two executors.**  `capture()` snapshots start values into
  per-channel `ChannelWrite`s (column, kind, slots, packed from/to) once; the
  CPU tick and the GPU kernels consume the same numbers, so they agree by
  construction rather than by parallel implementations.
- **Three kernels** (`render/gpu-tween.mts`): `position` (vec2), `scalar`
  (f32), `color` (packed rgba8).  Dispatch counts come from WGSL
  `arrayLength(&slots)`, not a uniform — `queue.writeBuffer` is ordered against
  submitted command buffers, *not* against dispatches inside one, so a
  per-dispatch value cannot live in a shared uniform (a bug caught while
  authoring; pinned by a test).
- **Tween-wins precedence, free mapper reclaim.**  Paint dispatches are encoded
  inside the cull pass *after* `mapperRuntime.encode()`; dispatches in one pass
  observe prior dispatches' writes (the guarantee the cull kernels already rely
  on), so a live tween beats the eval kernel for the same channel.  On settle,
  the CPU write dirties the column — already the mapper's re-evaluation
  trigger — so the mapped value returns with no new machinery.
- **Colors tween in OKLab**, matching color mappers' default: one perceptual
  model across the library instead of a mapper/animation split.  Endpoints are
  converted on the CPU and packed as two `vec4f` (L, a, b, alpha), so the
  kernel needs only the OKLab→sRGB direction it shares with the mapper kernel.
  **Deliberate v3 divergence** (v3 tweened per-channel in sRGB) and a change to
  round 9's shipped CPU behaviour.
- **Arrow-alpha fold rides along.**  The arrow VS is at WebGPU's base
  8-storage-buffer limit, so edge opacity is pre-folded into stored arrow alpha
  (`stored.a = base.a × opacity`).  The fold is linear in opacity, so animating
  `edge.opacity` also emits a color tween per arrow end to `base × toOpacity` —
  identical math on both executors.  The base comes from
  `StyleEngine.arrowBase()`, not the stored bytes, which cannot recover it when
  the folded opacity was 0.
- **Bugs fixed on the way in** (all pre-existing, all now covered):
  `eles.animate({style: {opacity}})` was a silent no-op on **edges** (the
  channel map was node-only); `stop()` on a GPU-driven animation left the CPU
  at the start value while the device buffers held the last frame drawn, with
  nothing to reconcile them (it now settles, matching v3's leave-it-where-it-got
  -to); a custom easing **function** was silently downgraded to `'ease'` on the
  GPU (made ineligible here, then dropped from the API in R9.5); and the GPU
  path captured start values *before* the delay elapsed,
  unlike the CPU path.
- **A reserved-word trap, and the guard for it.**  `target` is a WGSL reserved
  keyword: all three tween pipelines failed to compile, the dispatches became
  silent no-ops, and the specs still passed on stale buffer contents.  Two
  guards now close that hole — the webgpu Playwright project fails any test
  whose console reports a WGSL/validation error, and a Node test
  (`test/modules/gpu-wgsl-identifiers.mjs`) checks every shader's declared
  identifiers against the reserved list, so a GPU-less CI catches it too.
- **Verification**: 1411 Node tests + 47 module tests, typecheck and lint
  clean, and 24/24 webgpu Playwright specs on a real (SwiftShader) adapter —
  including a paint-lease spec (pixels fade through the OKLab path mid-flight
  while CPU `style()` reads the start value; settles exactly on the target) and
  a precedence spec (a tween outranks a mapped `opacity`, which reclaims the
  channel on stop).
- **Still deferred:** the *size* tween (`width`/`height`, `border-width`,
  `edge.width`) with the R8.5 geometry seam, and GPU layouts.

## Landed (round 9.5 — the easing layer, 2026-07-27)

Round 9 shipped eight ad-hoc easings, with the four names shared with v3 drawn
as *different curves* (max deviation 0.33 for `ease`) and unknown names falling
back to `ease` silently.  This round replaces that with one curve layer
(`src/gpu/easing.mts`) that both executors run.

- **v3's enum, verbatim.**  `linear` plus the 25 named cubic-beziers, using v3's
  own control points, so every named curve is now identical to v3's (pinned by a
  test that samples both implementations across t).  One exact Newton solve
  covers the whole enum *and* `cubic-bezier(x1, y1, x2, y2)`, so there is no
  per-name code — the 8 hand-written curves and their WGSL twins are gone.
- **`linear(...)` progression arrays**, in the full CSS form: bare values,
  explicit `%` stops, two stops on one entry for a flat segment, and the CSS
  fill rules (first stop 0, last 1, runs spread evenly, every stop pulled up to
  the largest one before it, so a decreasing stop reads as a jump).
- **`spring(bounce)` replaces v3's `spring(tension, friction)`** with Apple's
  perceptual parameterization (via kvin.me): mass 1, stiffness (2π/D)², damping
  4π(1 − bounce)/D — which reduces to a damping ratio of exactly `1 − bounce`.
  So one number sets the shape: 0 is critically damped, positive rings,
  negative is overdamped.  **A spring compiles to a progression array on the
  CPU** — the closed-form step response sampled over the whole settling window,
  densely enough that the chord error stays under the residual that counts as
  settled — so the kernel needs no physics and a spring costs exactly what
  `linear()` costs.
- **`duration` is perceptual for springs** (the article's model, and SwiftUI's):
  it sets the pace of the key movement and is held constant as bounce changes,
  so the animation runs on past it while the ringing decays —
  `durationMs = duration × durationScale`, where the scale is the settling
  window measured in perceptual units.
- **One program, two evaluators.**  `compileEasing` returns
  `{kind, bezier, points, durationScale, fn}`; the CPU calls `fn`, and the
  kernel reads kind/bezier out of its params (now 48 bytes) with progression
  arrays on a storage buffer at binding 4 (a shared 8-byte dummy when the curve
  needs none).  The WGSL mirrors the CPU step for step — same 11-sample bracket
  and Newton refinement, same binary-search lerp — so they agree to float
  precision; the ends are exact on both sides and a settle re-derives anyway.
- **No custom easing functions** (a v3 feature, and an API break here).  A
  closure cannot cross to the device, so keeping it would mean a curve that
  silently depends on whether the animation was offloaded; with `cubic-bezier()`
  and `linear()` covering any drawable curve, parity is worth more than the
  escape hatch.  Unknown names now **throw** with the list, rather than
  animating on the wrong curve.
- **Overshoot handling.**  Bouncy curves pass their endpoints: position is let
  through (that is the point), while scalar channels clamp to per-property
  bounds on both executors (`opacity` [0,1], `border-width` ≥ 0), mirroring v3's
  `type.min`/`type.max`; color bytes clamp on pack, with alpha clamped
  explicitly (a `Uint8Array` write would wrap).
- **Verification**: 1448 Node tests (28 new easing specs + 5 overshoot specs) +
  47 module tests, typecheck and lint clean, 26/26 webgpu Playwright on
  SwiftShader — including a spring spec (the node visibly passes the target,
  still animating past its perceptual duration, then settles exactly on it) and
  a steep-bezier spec (`ease-in-expo` has barely moved at 40% of the time),
  which together prove both device evaluators.

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
  straight-alpha RGBA, canvas-2D encode in the core.  v3's options (`bg`,
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
- **v4 goldens** (new `webgpu-visual` Playwright project, pinned to
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
  clean, 32/32 `webgpu` + 6/6 `webgpu-visual` Playwright specs; goldens
  byte-stable across repeat runs.

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
- **Label goldens as their own tolerance tier** in `webgpu-visual`: the
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
  font-swap spec) and 7/7 `webgpu-visual` specs (incl. the
  `labels-open-sans` golden), the visual project stable across three
  consecutive runs.

## Logged direction — edge labels (a future round; nodes-only today)

Needed regardless (discussion, 2026-07-27).  A generalization, not new
architecture: a **second glyph stream** parallel to the node one (own
instance buffer + cull group + draw); edge glyphs anchor at the edge
midpoint computed in the VS from the two endpoint positions, so edge
labels follow drags/layouts/position tweens on-GPU with zero rebuild —
the node-label trick extended to labels whose *endpoints* move.  Cull
predicate mirrors the edge cull (edge SHOWN + both endpoints SHOWN);
the atlas is shared (keyed by char, so the 9.7 font work is
owner-agnostic); the model side group-keys the label sidecar,
label-dirty channel and StyleEngine label channels.  Pass-1 scope:
horizontal at the midpoint (v3's default); autorotate — cheap in the VS
via the endpoint delta, but with flip-when-upside-down readability
rules — is a separate follow-up call.  Sequencing: after 9.7, so the
label goldens/WYSIWYG harness exists to verify it; the edge-label round
then just adds a golden scene.

## Round 10 plan — autonomous parity sprint (planned 2026-07-27)

Scope criteria set with the user: this round is composed **only of items
whose design is already decided** (or is a mechanical v3 port) **and
that are easily verifiable in the existing harnesses** — Node
`test/gpu-*.mjs`, the `webgpu`/`webgpu-visual` Playwright projects,
`benchmark/gpu/` — so the round can run autonomously as far as
possible.  Anything needing iterative design discussion is deferred and
logged (see the compaction section below and the deferred list at the
end).  Two design calls were made during planning:

- **Removed elements are terminally dead in v4** (recorded in
  `src/gpu/README.md`, "Design decisions"): only the handle's cached
  `id()`/`group()` survive removal.  This permanently closes
  `restore()`/`clone()`/`cy.json()` import — the needs-a-call entry
  above is closed.
- **Compaction is out of this round** — the motivation analysis is
  logged below with all policy calls left explicitly open.

Process (user-set):

- **Per-item cadence, full verify.**  Each item lands as its own
  isolated commit(s) on `v4`, gated on typecheck + lint + `test:js`
  (+ `test:modules` where relevant) + the relevant Playwright projects.
  Goldens are regenerated/added autonomously when a visual change is
  intended (`UPDATE_GOLDENS=1`), noted in the commit message.
- **Docs land in the same commit as the code they describe**:
  `src/gpu/README.md` (scope / deviations / design decisions) and this
  file's round record are updated per commit, not batched at the end.
- **Escalation rule**: if an item turns out to need a real design call
  mid-implementation, stop that item, log the question under "Needs a
  call", and move on to the next item — API semantics are never
  improvised autonomously.
- Perf-relevant items run the matching `benchmark/gpu/` sweep and
  record numbers here.

Items, in execution order — CPU-first (banks autonomous wins with zero
renderer risk), then shader/golden work, then interaction/lifecycle.
Each entry converts into a "Landed" record as it ships:

**Phase A — pure CPU, Node-testable**

- [x] **A1 Algorithms: search + paths** — landed 2026-07-27.
  `bfs`/`dfs` (+ `breadthFirstSearch`/`depthFirstSearch`), `dijkstra`,
  `aStar`, `bellmanFord`, `floydWarshall`, `kruskal` in
  `src/gpu/algorithms/` (a shared `SubgraphView` — dense node index +
  edge membership over the calling collection — plus an indexed
  binary min-heap in `algo-shared.mts`; one file per algorithm), all
  slot-native over CSR with dense typed-array state, no per-node
  string ids.  v3 option/result shapes preserved, including the
  positional bfs/dijkstra forms, bfs's exact multi-root queue
  mechanics, bellmanFord's same-edge relax guard and canonical
  negative-cycle rotation, and pathTo edge cases (unreachable
  dijkstra target → `[target]`, unreachable bellmanFord target →
  empty).  v4 deltas: node args are collections (strings throw),
  missing required roots/goals throw, and cycle collections dedupe
  the closing node (v4 collections are sets).  39 specs in
  `test/gpu-algorithms.mjs` ported from the v3 fixtures (1500 Node
  tests total green).
- [x] **A2 Algorithms: structure** — landed 2026-07-27.
  `tarjanStronglyConnected` (+`tsc`/`tscc`/long alias; converted to an
  **iterative** DFS so deep graphs can't overflow the JS stack —
  component sets identical to v3's recursive form, verified against
  the v3 fixtures including exact component order),
  `hopcroftTarjanBiconnected` (+`htbc`/`htb`/long alias; recursive
  like v3, quirks preserved: parent edges skipped incl. parallels,
  non-cut vertices' edges absorbed), `hierholzer` (slot-keyed literal
  port; trail dedupes to first-traversal order as v3's does),
  `kargerStein` (index-based port; throws on <2 nodes as v3's error()
  does).  Tests assert order-independent graph-theoretic results
  (blocks, cut vertices, Eulerian properties) where v3 pinned
  traversal-order sequences; 12 specs in
  `test/gpu-algorithms-structure.mjs` (1512 Node tests green).
- [x] **A3 Algorithms: pageRank + centralities** — landed 2026-07-27.
  `pageRank` (dense power method on Float64Arrays), `degreeCentrality`
  /`degreeCentralityNormalized` (+`dc`/`dcn`/`...Normalised`; Opsahl's
  alpha, loops counted on both directed sides as v3), `closeness
  Centrality`/`closenessCentralityNormalized` (+`cc`/`ccn`; harmonic
  default; dijkstra per root, floydWarshall for normalized),
  `betweennessCentrality` (+`bc`; Brandes over deduped neighbor lists
  with first-edge weight pick as v3, but a proper decrease-key heap so
  S is truly distance-ordered).  19 specs pin v3's exact numeric
  expectations (all matched, incl. the multiple-shortest-paths case);
  `test/gpu-algorithms-centralities.mjs` (1531 Node tests green).
- [ ] **A4 Algorithms: clustering** — markov, k-means, k-medoids,
  fuzzy c-means, hierarchical, affinity propagation (+ the shared
  distance helpers).
- [ ] **A5 Algorithm benchmark** — `benchmark/gpu/algorithms.mjs` vs v3
  (at least bfs/dijkstra/pageRank/tarjan).
- [ ] **A6 Layouts** — `circle`, `concentric`, `breadthfirst`, `random`
  ported to the slot-native bulk `setPositions` path (the grid-port
  pattern), plus `eles.layout()`/`layoutPositions` for subset layouts.
  Non-animated first; `animate: true` only if it falls out of the
  existing animation system cheaply, else noted as deferred.
- [ ] **A7 Viewport animation targets** —
  `cy.animate({ fit: { eles, padding } })` / `{ center: { eles } }` and
  animated `fit()`/`center()` options, over the existing viewport
  tween; deterministic-tick Node tests.
- [ ] **A8 Data query predicates** — the matcher IR extension named in
  the selector-removal section: `cy.nodes({ data: { weight: { gt:
  0.5 } } })` (+ bare-value equality shorthand), `gt/lt/gte/lte/eq/ne/
  in` vocabulary shared with `case` mappers, answered during the
  columnar scan against the sidecar columns; unknown keys keep
  throwing.
- [ ] **A9 Small items** — `boundingBoxAt`; `padding()`/`paddedWidth`/
  `paddedHeight` (smallest v3-consistent form; investigate whether
  padding is a geometry channel or accessor-only without compounds);
  live-graph binary export `cy.serialize()` → wire ArrayBuffer
  (round-trips through `options.elements`/`add()`); the
  `document.fonts.ready` atlas re-raster hook logged in round 9.7.

**Phase B — renderer/shader work, golden-verified**

- [ ] **B1 Node shape parity** — closed-form SDFs: regular polygons
  (`triangle`, `pentagon`, `hexagon`, `heptagon`, `octagon`),
  `diamond`, `star`, `vee`, `rhomboid`, `tag`; `round-*` variants via
  SDF shrink+offset where closed-form allows.  `contract.mts` shape ids
  first; new golden scene.
- [ ] **B2 `line-style: solid | dashed | dotted`** — fract-along-length
  in the edge FS, v3 default pattern.  `border-style` is stretch-only
  (`double` is easy in SDF; dashed borders need perimeter
  parameterization on arbitrary shapes — skip if not clean, note in
  deviations).
- [ ] **B3 Label visuals** — `text-outline-width`/`-color`(/`-opacity`)
  (a second SDF distance threshold), `text-background-color`/
  `-opacity`/`-padding` (one background quad per label run off the
  extent the layout already computes), `text-margin-x/y`.  Constants
  through the label sidecar; label-tier golden bound.
- [ ] **B4 Arrow shape parity** — `vee`, `chevron`, `circle`, `square`,
  `diamond`, `tee` as SDFs in the arrow quad FS (compound shapes like
  `triangle-tee`/`circle-triangle`/`backcurve` are stretch).  Golden
  scene update.
- [ ] **B5 Edge labels pass 1** — the logged direction above, built:
  second glyph stream (own instance buffer + cull group + draw call),
  midpoint computed in the VS from the endpoints, cull = edge SHOWN +
  both endpoints SHOWN, shared atlas, group-keyed label sidecar /
  label-dirty channel / StyleEngine label channels.  Horizontal only
  (autorotate stays deferred).  Golden scene + follows-drag + LOD
  specs; the WYSIWYG self-diff already covers glyphs.

**Phase C — interaction & lifecycle, Playwright-verified**

- [ ] **C1 Gesture parity** — `cxttap`/`cxttapstart`/`cxttapend`,
  `taphold`, `dbltap` + the `multiClickDebounceTime` option, and v3's
  drag-all-selected (dragging a selected node moves the whole
  selection).  `interact/pointer.mts`; Playwright specs per gesture.
- [ ] **C2 `mount`/`unmount`** — `unmount()` tears down the renderer
  (instance becomes headless); `mount(container)` re-inits and rebuilds
  mirrors/atlas from CPU-canonical state (the ColumnMirror full-upload
  path already exists).  Playwright: render → unmount → mutate → mount
  → pixels reflect the mutations.
- [ ] **C3 Device-loss recovery** — proposed policy, to be recorded as
  the decision when it lands: auto-recover **once per loss** —
  re-acquire adapter/device, rebuild mirrors/pipelines/atlas from
  CPU-canonical state, emit `devicelost` + `devicerestored`; if
  re-acquisition fails, today's behavior (dead instance + `error`).
  Playwright via `device.destroy()`.

Deferred out of this round (logged, not built): compaction (below);
autorotated edge labels; multiline labels; bezier edges; compounds;
z-index; GPU layouts; size tweens (the R8.5 geometry seam); `renderTo`;
restore/clone/json-import (closed — not in v4); the three-finger touch
box gesture.

## Logged — compaction (analysis only; out of round 10)

Discussed 2026-07-27 while planning round 10 and **deliberately left
out of the sprint**: the analysis below is settled, but the policy
calls are **open** — none of the options named here is decided.

**When compaction is motivated** — three distinct profiles:

1. **Shrink** (big removals without re-add — e.g. a filter UI cuts 200k
   elements to 20k).  Dead slots pile up and `highWater` never falls:
   every compute dispatch (cull count/scan/scatter, mapper eval) still
   runs over `highWater` lanes; every CPU columnar scan
   (`scanRefsInto`, `boundingBox`, `refsInBox`, CPU pick) still
   iterates `highWater` slots — cost proportional to the *peak* graph,
   not the current one.  CPU columns and GPU mirrors stay at peak
   capacity, and one-coalesced-span dirty tracking uploads dead bytes
   when writes straddle dead regions.
2. **Churn** (sustained remove+add at stable size — streaming /
   sliding-window dashboards, expand/collapse exploration).  The
   free-list recycles slots, so the tables don't grow — but three
   append-only structures leak unboundedly in *time*: the **id blob**
   (removed ids' UTF-8 bytes + probe entries never reclaimed; new ids
   append fresh bytes), the **CSR adjacency** (removed edges strand CSR
   space; incremental adds accumulate in the per-node overlay), and
   **string-dictionary data columns** (dictionaries only grow).  This
   is the most motivated real-world case — and it is invisible to a
   dead-slot-ratio meter, since slots recycle.
3. **Peak-then-small memory reclaim** (transient huge load, then
   narrow): capacity stays at peak until slots compact and columns
   realloc down.

Not motivated: add-only or stable graphs (zero waste), and moderate
removal on big graphs (cull already keeps draw cost O(visible); dead
slots only cost pass-iteration width and memory).

**The tier split** — the tiers differ by trigger meter, not just
difficulty.  Blob/CSR/dictionary compaction is **slot-stable**: no
identity moves, no renderer or ref implications, metered by plain waste
counters — it could safely run automatically.  **Slot compaction**
moves live elements, is metered by dead-slot ratio, and carries all the
policy weight: outstanding refs (plain `{group, slot, gen}` objects in
user-held collections, plus packed-int membership-set caches — they
cannot be found and rewritten eagerly), z-order (slot order is draw
order), GPU full re-upload (the existing `resized` path), and remap of
in-flight animation slot lists.

**Open policy questions** (options discussed, none chosen): (a) ref
survival across a slot move — a forwarding table with lazy ref repair +
an epoch stamp invalidating cached membership sets, vs
handles-survive-collections-stale, vs everything-stale; (b) trigger —
explicit `cy.compact()` vs auto thresholds (with slot-stable tiers
plausibly auto regardless); (c) draw order after compacting — stable
(visually a no-op) vs restore-insertion-order (heals the recycled-slot
z-order wart at the cost of a visible change and a per-slot sequence
number).

**Settled adjacent question**: removed-element readability is
*orthogonal* to compaction — v4 already gave it up when it chose
tombstones + a free-list (the next add may recycle the slot), and the
round-10 design call above makes that permanent.  Compaction changes
nothing for removed refs under any option: a removed ref matches no
forwarding entry and its generation is already stale, and the cached
`id()`/`group()` live on the JS handle, not in the columns.
